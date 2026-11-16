import { createAssistant } from './runtime';
import { loadConfig } from './config';

export const mastra = createAssistant(loadConfig());
