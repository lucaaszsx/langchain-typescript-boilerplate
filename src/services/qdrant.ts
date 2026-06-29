import { QdrantClient } from '@qdrant/js-client-rest';
import { Env } from '../config.js';

export const qdrant = new QdrantClient({ host: Env.qdrant.host, port: Env.qdrant.port });
