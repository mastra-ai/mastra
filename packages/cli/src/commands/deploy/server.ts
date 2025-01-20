import { readFileSync } from 'fs';
import path, { join } from 'path';
import { fileURLToPath } from 'url';

export const SERVER_TEMPLATES = {
  server: '../../templates/server.js',
  vercel: '../../templates/vercel.js',
  netlify: '../../templates/netlify.js',
  worker: '../../templates/worker.js',
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readTemplate = (path: string) => readFileSync(join(__dirname, path), 'utf-8');

export const SERVER = readTemplate(SERVER_TEMPLATES.server);
export const VERCEL = readTemplate(SERVER_TEMPLATES.vercel);
export const NETLIFY = readTemplate(SERVER_TEMPLATES.netlify);
export const WORKER = readTemplate(SERVER_TEMPLATES.worker);
