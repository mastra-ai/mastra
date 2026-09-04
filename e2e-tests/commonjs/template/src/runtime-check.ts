import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const { TokenCounter } = require('@mastra/memory/processors');
const { LocalFilesystem, Workspace } = require('@mastra/core/workspace');
const { Mastra } = require('@mastra/core/mastra');

async function main() {
  const directory = join(process.cwd(), 'commonjs-runtime-check');
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(join(directory, 'first.txt'), 'CommonJS dynamic imports work.'),
    writeFile(join(directory, 'second.txt'), 'ESM-only dependencies are deferred.'),
  ]);

  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: directory }),
    bm25: true,
  });
  await workspace.rebuildSearchIndex(['.']);
  const results = await workspace.search('CommonJS');

  const mastra = new Mastra({ logger: false });
  const schedule = await mastra.schedules.create({
    id: 'CommonJS ESM Only!',
    agentId: 'runtime-check',
    cron: '0 * * * *',
    prompt: 'Run the CommonJS runtime check.',
  });

  const tokens = await new TokenCounter().countString('CommonJS dynamic imports work.');
  await workspace.destroy();

  console.log(JSON.stringify({ indexed: results.length, scheduleId: schedule.id, tokens }));
}

void main();
