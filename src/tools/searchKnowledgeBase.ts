import { tool } from 'langchain';
import { z } from 'zod';
import { qdrant } from '../services/qdrant.js';
import { embeddings } from '../services/embeddings.js';
import { Env } from '../config.js';

const SEARCH_KNOWLEDGE_BASE_SCHEMA = z.object({
    query: z
        .string()
        .describe('The query that should be used to search for entries in the knowledge base'),
    limit: z
        .number()
        .default(5)
        .describe('The number of document chunks to be returned (default = 5)')
});

export default tool(
    async ({ query, limit }: z.infer<typeof SEARCH_KNOWLEDGE_BASE_SCHEMA>): Promise<string> => {
        const vector = await embeddings.embedQuery(query);
        const results = await qdrant.search(Env.qdrant.collection, { vector, limit, with_payload: true });

        return results
            .map((point) => point?.payload?.["chunk"])
            .filter(Boolean)
            .join('\n\n');
    },
    {
        name: 'search_knowledge_base',
        description:
            'Searches for information within the database using a query. Returns the documents that best match the query',
        schema: SEARCH_KNOWLEDGE_BASE_SCHEMA
    }
);