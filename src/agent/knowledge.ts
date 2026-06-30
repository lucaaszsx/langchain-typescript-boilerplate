import { MarkdownTextSplitter } from '@langchain/textsplitters';
import { lstatSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import type { Database as DatabaseType } from 'better-sqlite3';
import { embeddings } from '../services/embeddings.js';
import { createHash, randomUUID } from 'node:crypto';
import { relative, join, dirname } from 'node:path';
import { qdrant } from '../services/qdrant.js';
import { logger } from '../services/logger.js';
import { Env } from '../config.js';
import Database from 'better-sqlite3';

interface Document {
    content: string;
    metadata: DocumentMetadata;
}

interface DocumentMetadata {
    source: string;
    hash: string;
}

const sha256 = (str: string): string => createHash('sha256').update(str).digest('hex');

export class AssistantKnowledge {
    private static readonly BASE_KNOWLEDGE_PATH = join(
        import.meta.dirname,
        '..',
        '..',
        'knowledge'
    );
    private static readonly SYSTEM_PROMPT_PATH = join(this.BASE_KNOWLEDGE_PATH, '_system.md');
    private static readonly METADATA_DB_PATH = join(
        import.meta.dirname,
        '..',
        '..',
        '.cache',
        'metadata.db'
    );
    private static readonly EMBEDDINGS_CHUNK_SIZE = 500;
    private static readonly EMBEDDINGS_CHUNK_OVERLAP = 60;

    private readonly metadata: DatabaseType;

    constructor() {
        const { METADATA_DB_PATH } = AssistantKnowledge;
        mkdirSync(dirname(METADATA_DB_PATH), { recursive: true });

        this.metadata = new Database(METADATA_DB_PATH);
    }

    public async init(): Promise<void> {
        const { collection } = Env.qdrant;

        // Creates the QDrant collection if not exists
        if (!(await qdrant.collectionExists(collection)).exists) {
            logger.debug(
                'qdrant "%s" collection doesn\'t exists, attempting to create',
                collection
            );

            await qdrant.createCollection(collection, {
                vectors: {
                    size: Env.embeddings.dimension,
                    distance: 'Cosine'
                }
            });
        }

        // Creates the table to store the knowledge files metadata
        logger.debug(
            'creating table (if not exists) for storing metadata of knowledge base documents'
        );

        this.metadata.exec(`
            CREATE TABLE IF NOT EXISTS documents (
                source TEXT PRIMARY KEY,
                hash TEXT NOT NULL
            )
        `);

        // Check the hash of all the knowledge files to see which ones have changed and need their chunks reloaded in QDrant
        const { EMBEDDINGS_CHUNK_OVERLAP, EMBEDDINGS_CHUNK_SIZE, SYSTEM_PROMPT_PATH } =
            AssistantKnowledge;
        const splitter = new MarkdownTextSplitter({
            chunkOverlap: EMBEDDINGS_CHUNK_OVERLAP,
            chunkSize: EMBEDDINGS_CHUNK_SIZE
        });
        const hashes = this.getAllHashes();
        const sources = new Set<string>();

        for (const { content, metadata } of this.loadDocuments()) {
            const { source, hash } = metadata;
            logger.debug('processing document: %s', source);

            // Ignores the system prompt
            if (SYSTEM_PROMPT_PATH.endsWith(source)) continue;

            logger.debug(
                'loading document %s with %d characters of content length',
                source,
                content.length
            );
            sources.add(source);

            const originalHash = hashes.get(source);
            if (hash === originalHash || content.length === 0) {
                logger.debug(
                    'the content of the current document matches the stored one, skipping the generation of chunks and vectors'
                );
                continue;
            }
            if (originalHash) {
                logger.debug(
                    'the content of the current document does not match the stored one, deleting points before starting vector generation'
                );
                await this.deleteDocumentPoints(source);
            }

            const chunks = await splitter.splitText(content);
            logger.debug(
                'document content separated into a total of %d chunks. generating vectors',
                chunks.length
            );

            const t0 = Date.now();
            const vectors = await embeddings.embedDocuments(chunks);
            logger.debug('vectors generated. took: %dms', Date.now() - t0);

            const points = chunks.flatMap((chunk, index) => {
                const vector = vectors[index];
                if (!vector) return [];

                return [
                    {
                        id: randomUUID(),
                        vector,
                        payload: { source: source, chunk, index }
                    }
                ];
            });

            await qdrant.upsert(collection, { points });
            this.setHash(source, hash);
        }

        // Remove documents that no longer exist on knowledge base
        for (const source of hashes.keys()) {
            if (!sources.has(source)) {
                logger.debug(
                    '%s source was deleted from knowledge base, deleting points and stored hash',
                    source
                );
                await this.deleteDocumentPoints(source);
                this.deleteHash(source);
            }
        }
    }

    public getSystemPrompt(): string {
        return this.loadDocument(AssistantKnowledge.SYSTEM_PROMPT_PATH).content;
    }

    private deleteDocumentPoints(source: string) {
        return qdrant.delete(Env.qdrant.collection, {
            filter: {
                must: [{ key: 'source', match: { value: source } }]
            }
        });
    }

    private setHash(source: string, hash: string) {
        this.metadata
            .prepare(
                `
                INSERT INTO documents (source, hash)
                VALUES (?, ?)
                ON CONFLICT (source) DO UPDATE SET hash = excluded.hash
            `
            )
            .run(source, hash);
    }

    private getAllHashes() {
        const rows = this.metadata
            .prepare<[], DocumentMetadata>('SELECT source, hash FROM documents')
            .all();
        return new Map<string, string>(rows.map((row) => [row.source, row.hash]));
    }

    private deleteHash(source: string) {
        this.metadata.prepare('DELETE FROM documents WHERE source = ?').run(source);
    }

    private loadDocuments(basePath = AssistantKnowledge.BASE_KNOWLEDGE_PATH) {
        const collect = (dir: string): string[] =>
            readdirSync(dir)
                .map((entry) => join(dir, entry))
                .flatMap((fullPath) =>
                    lstatSync(fullPath).isFile() ? [fullPath] : collect(fullPath)
                );

        return collect(basePath).map((path) => this.loadDocument(path, basePath));
    }

    private loadDocument(
        source: string,
        basePath = AssistantKnowledge.BASE_KNOWLEDGE_PATH
    ): Document {
        const content = readFileSync(source, 'utf-8');
        return { content, metadata: { source: relative(basePath, source), hash: sha256(content) } };
    }
}
