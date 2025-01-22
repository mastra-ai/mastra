import { readFileSync } from 'fs';
import path, { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readTemplate = (path: string) => readFileSync(join(__dirname, path), 'utf-8');

export const TEMPLATE = readTemplate('../../templates/server.js');
