import { readFile, readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface Knowledge {
    filename: string;
    content: string;
    hash: string;
}

export const KNOWLEDGE_BASE_PATH = join(__dirname, '..', '..', 'knowledge');
export const KNOWLEDGE_SYSTEM_PROMPT = join(KNOWLEDGE_BASE_PATH, '_system.md');

export async function listKnowledgeFiles(): Promise<string[]> {
    return (await readdir(KNOWLEDGE_BASE_PATH))
        .filter((dir) => !dir.startsWith('_'))
        .map((dir) => join(KNOWLEDGE_BASE_PATH, dir));
}

export async function readKnowledge(path: string): Promise<Knowledge> {
    if (!existsSync(path)) throw new Error(`The file "${path}" does not exist`);

    const content = await readFile(path, 'utf-8');
    return {
        filename: basename(path),
        hash: sha256(content),
        content
    };
}

export async function hasKnowledgeChanged(originalHash: string, path: string): Promise<boolean> {
    return sha256(await readFile(path, 'utf-8')) !== originalHash;
}

function sha256(str: string): string {
    return createHash('sha256').update(str).digest('hex');
}
