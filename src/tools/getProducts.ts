import { qdrant } from '../services/qdrant.js';
import { tool } from '@langchain/core/tools';
import { Env } from '../config.js';
import { z } from 'zod';

const PRODUCTS_SOURCE = 'products.md';

export default tool(
    async (): Promise<string> => {
        console.info('[tool] tool "get_products" called, getting info of all products...');

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

        console.info('[tool] tool "get_products" returned %d points', points.length);

        return points
            .map((point) => (point.payload?.['chunk'] as string) ?? null)
            .filter(Boolean)
            .join('\n\n');
    },
    {
        name: 'get_products',
        description:
            "Returns information about all the company's products. " +
            'Useful when the user asks about the available products or services, without specifying any.',
        schema: z.looseObject({})
    }
);
