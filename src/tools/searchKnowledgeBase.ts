import { embeddings } from '../services/embeddings.js';
import { qdrant } from '../services/qdrant.js';
import { logger } from '../services/logger.js';
import { Env } from '../config.js';
import { tool } from 'langchain';
import { z } from 'zod';

const TOOL_NAME = 'search_knowledge_base';
const SEARCH_KNOWLEDGE_BASE_SCHEMA = z.object({
    query: z
        .string()
        .describe(
            'The keyword-based query that should be used to search the knowledge base.\n' +
                'Rules:\n' +
                '- Remove the filler conversation.\n' +
                "- Do not use the company's name unless it is really necessary.\n" +
                '- Keep only nouns, entities and concepts relevant to the search.\n' +
                '- Prefer terms likely to appear verbatim in documents.\n' +
                '- When possible, it is preferable that the queries be in English.'
        ),
    limit: z
        .number()
        .default(5)
        .describe('The number of document chunks to be returned (default = 5)')
});

export default tool(
    async ({ query, limit }: z.infer<typeof SEARCH_KNOWLEDGE_BASE_SCHEMA>): Promise<string> => {
        logger.debugTool(TOOL_NAME, 'search request with limit %d and query:', limit, query);

        const vector = await embeddings.embedQuery(query);
        const results = await qdrant.search(Env.qdrant.collection, {
            with_payload: true,
            with_vector: false,
            score_threshold: Env.qdrant.scoreThreshold,
            vector,
            limit
        });
        logger.debugTool(
            TOOL_NAME,
            '%d results were found for the specified query',
            results.length
        );

        if (results.length === 0)
            return `The search in the knowledge base was conducted. However, no relevant results were found for the query: ${query}`;

        return results
            .map((point) => point?.payload?.['chunk'])
            .filter(Boolean)
            .join('\n\n');
    },
    {
        name: TOOL_NAME,
        description:
            'Searches for information within the knowledge base using a query. Returns the documents that best match the query',
        schema: SEARCH_KNOWLEDGE_BASE_SCHEMA
    }
);
