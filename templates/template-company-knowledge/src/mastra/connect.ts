import { tools } from '@mastra/connect';

const hasPlatformCredential = Boolean(
  process.env.MASTRA_PLATFORM_ACCESS_TOKEN?.trim() || process.env.MASTRA_PLATFORM_SECRET_KEY?.trim(),
);
const hasConnectEnv = hasPlatformCredential && Boolean(process.env.MASTRA_PROJECT_ID?.trim());

export const connectTools = hasConnectEnv ? tools({ providers: ['linear', 'notion'] }) : undefined;
