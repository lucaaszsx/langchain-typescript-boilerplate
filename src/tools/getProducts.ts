import { qdrant } from '../services/qdrant.js';
import { logger } from '../services/logger.js';
import { tool } from '@langchain/core/tools';
import { Env } from '../config.js';
import { z } from 'zod';

const TOOL_NAME = 'get_products';
const PRODUCTS_SOURCE = 'products.md';

export default tool(
    async (): Promise<string> => {
        logger.debugTool(TOOL_NAME, 'getting info of all products');

        const points = [];
        let nextOffset: string | number | Record<string, unknown> | null = null;

        do {
            const result = await qdrant.scroll(Env.qdrant.collection, {
                filter: {
                    must: [{ key: 'source', match: { value: PRODUCTS_SOURCE } }]
                },
                with_payload: true,
                with_vector: false,
                offset: nextOffset
            });

            nextOffset = result.next_page_offset ?? null;
            points.push(...result.points);
        } while (nextOffset !== null);

        logger.debugTool(TOOL_NAME, 'a total of %d points were returned', points.length);

        return points
            .map((point) => (point.payload?.['chunk'] as string) ?? null)
            .filter(Boolean)
            .join('\n\n');
    },
    {
        name: TOOL_NAME,
        description:
            "Returns information about all the company's products. " +
            'Useful when the user asks about the available products or services, without specifying any.',
        schema: z.looseObject({})
    }
);
