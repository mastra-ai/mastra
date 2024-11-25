import { config } from 'dotenv';
import * as esbuild from 'esbuild';
import express from 'express';
import { mkdirSync } from 'fs';
import { join } from 'path';

import { getFirstExistingFile } from '../utils.js';

async function bundle() {
  try {
    // Ensure .mastra directory exists
    await mkdirSync('.mastra', { recursive: true });

    const entryPoint = getFirstExistingFile([
      join(process.cwd(), 'src/mastra', 'index.ts'),
      join(process.cwd(), 'mastra', 'index.ts'),
    ]);
    const outfile = join(process.cwd(), '.mastra', 'mastra.js');

    const result = await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      target: 'es2020',
      sourcemap: true,
      minify: false, // Set to true if you want minification
      metafile: true, // Generates build metadata
      logLevel: 'info',
      external: [
        // Mark node built-ins as external
        'fs',
        'path',
        'os',
        'crypto',
        'stream',
        'util',
        'events',
        'http',
        'https',
        'net',
        'tls',
        'zlib',
        'child_process',
        'worker_threads',
        'cluster',
        'dns',
        'dgram',
        'readline',
        'repl',
        'tty',
        'url',
        'v8',
        'vm',
        'module',
        'process',
      ],
      banner: {
        js: `
                  import { createRequire } from 'module';
                  const require = createRequire(import.meta.url);
                `,
      },
    });

    // Log build results
    console.log('Build completed successfully');

    // Output build metadata
    const text = await esbuild.analyzeMetafile(result.metafile);
    // console.log(text);

    return result;
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

export async function serve(port: number) {
  const dotMastraPath = join(process.cwd(), '.mastra');

  const envFile = getFirstExistingFile(['.env.development', '.env']);
  config({ path: envFile });

  await bundle();

  const { mastra } = await import(join(dotMastraPath, 'mastra.js'));

  const app = express();

  app.use(express.json());

  app.post('/agent/:agentId/text', async (req, res) => {
    const agentId = req.params.agentId;

    const agent = mastra.getAgent(agentId);

    const messages = req.body.messages;

    const result = await agent.text({ messages });

    res.json(result);
  });

  app.post('/agent/:agentId/stream', async (req, res) => {
    const agentId = req.params.agentId;
    const agent = mastra.getAgent(agentId);
    const messages = req.body.messages;

    const streamResult = await agent.stream({
      messages,
    });

    streamResult.pipeDataStreamToResponse(res);
  });

  app.post('/workflows/:workflowId/execute', async (req, res) => {
    const workflowId = req.params.workflowId;
    const workflow = mastra.workflows.get(workflowId);

    try {
      console.log('req.body', req.body);
      const result = await workflow.execute(req.body);
      res.json(result);
    } catch (error) {
      console.error('Error executing workflow', error);
      res.status(500).json({ error: 'Error executing workflow' });
      return;
    }
  });

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  return;
}
