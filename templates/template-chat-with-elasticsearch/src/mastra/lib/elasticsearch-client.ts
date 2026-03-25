import { Client } from '@elastic/elasticsearch';
import packageJson from '../../../package.json';

if (!process.env.ELASTICSEARCH_URL) {
  throw new Error('ELASTICSEARCH_URL environment variable is required');
}

/**
 * Elasticsearch client configured with connection URL, authentication, and user-agent tracking.
 */
export const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL,
  auth: process.env.ELASTICSEARCH_API_KEY ? { apiKey: process.env.ELASTICSEARCH_API_KEY } : undefined,
  name: 'mastra-elasticsearch-chat',
  headers: { 'user-agent': `mastra-elasticsearch-chat/${packageJson.version}` },
});
