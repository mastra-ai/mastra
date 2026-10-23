import { Mastra } from '@mastra/core/mastra';
import { createApplication } from './services/application.js';

export const mastra = new Mastra(await createApplication());
