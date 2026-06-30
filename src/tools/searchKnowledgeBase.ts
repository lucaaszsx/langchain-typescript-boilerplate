import { embeddings } from '../services/embeddings.js';
import { qdrant } from '../services/qdrant.js';
import { Env } from '../config.js';
import { tool } from 'langchain';
import { z } from 'zod';

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
        console.info(
            `[tool] tool "search_knowledge_base" called with limit ${limit} and query: ${query}`
        );

        const vector = await embeddings.embedQuery(query);
        const results = await qdrant.search(Env.qdrant.collection, {
            with_payload: true,
            with_vector: false,
            score_threshold: Env.qdrant.scoreThreshold,
            vector,
            limit
        });
        console.info('[tool] tool "search_knowledge_base" returned results:', results);

        if (results.length === 0)
            return `The search in the knowledge base was conducted. However, no relevant results were found for the query: ${query}`;

        return results
            .map((point) => point?.payload?.['chunk'])
            .filter(Boolean)
            .join('\n\n');
    },
    {
        name: 'search_knowledge_base',
        description:
            'Searches for information within the knowledge base using a query. Returns the documents that best match the query',
        schema: SEARCH_KNOWLEDGE_BASE_SCHEMA
    }
);
