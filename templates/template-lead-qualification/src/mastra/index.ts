import { Mastra } from '@mastra/core/mastra';
import { createApplicationRuntime } from './application';

const application = await createApplicationRuntime();

export const mastra = new Mastra(application.mastraConfig);
