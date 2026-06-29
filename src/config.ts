import 'dotenv/config';

function getEnvVariable(key: string, fallback?: unknown): unknown {
    const value = process.env[key] ?? fallback;
    if (!value) throw new Error(`Missing a required environment variable: ${key}`);

    return value;
}

export const Env = {
    /** Timezone */
    tz: getEnvVariable('TZ') as string,

    /** Groq API key */
    apiKey: getEnvVariable('GROQ_API_KEY') as string,

    /** Ollama Embeddings */
    embeddings: {
        model: getEnvVariable('OLLAMA_EMBEDDINGS_MODEL') as string,
        baseUrl: getEnvVariable('OLLAMA_EMBEDDINGS_BASE_URL') as string,
        dimension: parseInt(getEnvVariable('OLLAMA_EMBEDDINGS_DIMENSION') as string, 10)
    },

    /** QDrant Client */
    qdrant: {
        host: getEnvVariable('QDRANT_HOST') as string,
        port: parseInt(getEnvVariable('QDRANT_PORT') as string, 10),
        collection: getEnvVariable('QDRANT_COLLECTION') as string
    }
} as const;
