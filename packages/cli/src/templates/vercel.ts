import { createVercelServer } from '@mastra/deployer';
import { join } from 'path';
import { pathToFileURL } from 'url';

export const runtime = 'nodejs';

const mastraPath = pathToFileURL(join(process.cwd(), 'mastra.mjs')).href;
const { mastra } = await import(mastraPath);

const { MGET, MPOST } = await createVercelServer(mastra);

export const GET = MGET;
export const POST = MPOST;
