import _path, { join } from 'path';
import { fileURLToPath as _fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

import { createHonoServer } from './index.js';

const mastraPath = pathToFileURL(join(process.cwd(), 'mastra.mjs')).href;
const { mastra } = await import(mastraPath);

export const app = await createHonoServer(mastra);
