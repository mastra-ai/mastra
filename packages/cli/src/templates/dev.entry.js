import { mastra } from '#mastra';
import { createNodeServer } from '#server';
await createNodeServer(mastra, { playground: true, isDev: true });
