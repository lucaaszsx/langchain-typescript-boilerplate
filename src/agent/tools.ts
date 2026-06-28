import { tool } from "langchain";
import { z } from 'zod';

const SearchKnowledgeBaseSchema = z.object({
    query: z.string().describe('The query that should be used to search for entries in the knowledge base'),
    limit: z.number().default(5).describe('The number of document chunks to be returned (default = 5)')
});
const searchKnowledgeBase = tool(
    ({ query, limit }: z.infer<typeof SearchKnowledgeBaseSchema>): string => {
        console.log(`tool called: search_knowledge_base`);
        return `No results for ${query} with limit ${limit}`;
    },
    {
        name: 'search_knowledge_base',
        description: 'Searches for information within the database using a query. Returns the documents that best match the query',
        schema: SearchKnowledgeBaseSchema
    }
)

export const AssistantTools = [searchKnowledgeBase];