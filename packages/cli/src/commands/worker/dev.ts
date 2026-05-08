import { buildWorker } from './build';
import { startWorker } from './start';

interface DevWorkerOptions {
  name?: string;
  dir?: string;
  root?: string;
  tools?: string;
  outputDir?: string;
  env?: string;
  debug?: boolean;
}

export async function devWorker(options: DevWorkerOptions = {}) {
  await buildWorker({
    dir: options.dir,
    root: options.root,
    tools: options.tools,
    outputDir: options.outputDir,
    debug: options.debug,
  });
  await startWorker({
    name: options.name,
    dir: options.outputDir,
    env: options.env,
  });
}
