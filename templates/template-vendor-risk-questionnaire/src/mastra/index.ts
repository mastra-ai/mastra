import { Mastra } from '@mastra/core';
import { mkdirSync } from 'node:fs';
import { storage, runtimeRoot } from './persistence/database.ts';

mkdirSync(runtimeRoot, { recursive: true });
export const mastra = new Mastra({ storage });
