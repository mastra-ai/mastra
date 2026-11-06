import { createAssistant } from './assistant';
import { loadConfig } from './config';

export const mastra = createAssistant(loadConfig());
