import { createExampleServer } from './http.js';
import { persistence, storage } from './provider.js';

const tokens: unknown = JSON.parse(process.env.DEMO_API_TOKENS ?? '{}');
if (
  !tokens ||
  typeof tokens !== 'object' ||
  Array.isArray(tokens) ||
  Object.values(tokens).some(token => typeof token !== 'string')
)
  throw new Error('DEMO_API_TOKENS must be a JSON map of user names to tokens');
const server = createExampleServer(tokens as Record<string, string>);
const port = Number(process.env.PORT ?? 4318);
const host = process.env.HOST ?? '127.0.0.1';
server.listen(port, host, () => console.log(`Editorial review: http://${host}:${port}`));
async function close() {
  server.close();
  await persistence.close();
  await storage.close();
}
process.once('SIGINT', () => {
  void close();
});
process.once('SIGTERM', () => {
  void close();
});
