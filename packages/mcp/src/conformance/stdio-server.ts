import { createConformanceServer } from './fixture';

const server = createConformanceServer();

const close = async () => {
  await server.close();
};

process.once('SIGINT', close);
process.once('SIGTERM', close);

await server.startStdio();
