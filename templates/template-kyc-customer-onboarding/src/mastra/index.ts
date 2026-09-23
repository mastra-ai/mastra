import { loadConfig } from '../config/load-config.js';
import { createDependencies } from '../create-dependencies.js';

const dependencies = await createDependencies(loadConfig());

export const mastra = dependencies.mastra;
