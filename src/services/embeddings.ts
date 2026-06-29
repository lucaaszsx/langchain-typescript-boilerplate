import { OllamaEmbeddings } from '@langchain/ollama';
import { Env } from '../config.js';

export const embeddings = new OllamaEmbeddings({
    model: Env.embeddings.model,
    baseUrl: Env.embeddings.baseUrl
});
