import { Client } from '@elastic/elasticsearch';
import packageJson from '../../../package.json';

if (!process.env.ELASTICSEARCH_URL) {
  throw new Error('ELASTICSEARCH_URL environment variable is required');
}

export const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL,
  auth: process.env.ELASTICSEARCH_API_KEY ? { apiKey: process.env.ELASTICSEARCH_API_KEY } : undefined,
  name: 'mastra-elasticsearch-chat',
  headers: { 'user-agent': `mastra-elasticsearch-chat/${packageJson.version}` },
});
