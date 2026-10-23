import { Mastra } from '@mastra/core/mastra';
import { createApplication } from './application.js';

export const mastra = new Mastra(await createApplication());
