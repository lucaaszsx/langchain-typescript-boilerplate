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

    /** QDrant Client */
    qdrant: {
        host: getEnvVariable('QDRANT_HOST') as string,
        port: parseInt(getEnvVariable('QDRANT_PORT') as string)
    }
} as const;
