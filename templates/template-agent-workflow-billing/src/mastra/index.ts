import { Mastra } from '@mastra/core/mastra';
import { billingServerConfiguration } from './setup.js';

export const mastra = new Mastra({ server: await billingServerConfiguration() });
