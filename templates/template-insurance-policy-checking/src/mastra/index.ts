import { Mastra } from '@mastra/core/mastra';
import { createApplication } from './application-factory.js';

export const mastra = new Mastra(await createApplication());
