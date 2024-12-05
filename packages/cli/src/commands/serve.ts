import { execSync } from 'child_process';
import { config } from 'dotenv';
import * as esbuild from 'esbuild';
import express from 'express';
import { mkdirSync } from 'fs';
import path, { join } from 'path';
import color from 'picocolors';

import fsExtra from 'fs-extra/esm';
import fs from 'fs/promises';

import { getFirstExistingFile } from '../utils.js';
import { logger } from '../utils/logger.js';

import { getConfig } from './init/get-config.js';

export async function bundle() {
  const config = await getConfig(process.cwd());

  if (!config) {
    logger.warn(`
        Config is missing. Please run ${color.green(`init`)} to create a config.json file
        `);
    process.exit();
  }

  try {
    // Ensure .mastra directory exists
    mkdirSync('.mastra', { recursive: true });
    execSync(`echo ".mastra" >> .gitignore`);

    const entryPoint = getFirstExistingFile([join(config.dirPath, 'index.ts')]);
    const outfile = join(process.cwd(), '.mastra', 'mastra.mjs');

    const result = await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      target: 'node20',
      sourcemap: true,
      minify: false, // Set to true if you want minification
      metafile: true, // Generates build metadata
      logLevel: 'error',
      logOverride: {
        'commonjs-variable-in-esm': 'silent',
      },
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
        '@mastra/core',
      ],
    });

    // Log build results
    logger.success('Build completed successfully');

    // Output build metadata
    await esbuild.analyzeMetafile(result.metafile);

    return result;
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

export async function serve(port: number, env: Record<string, any>) {
  const dotMastraPath = join(process.cwd(), '.mastra');
  const key = env[0]?.name;
  const value = env[0]?.value;

  try {
    const envFile = getFirstExistingFile(['.env.development', '.env']);
    config({ path: envFile });
  } catch (err) {
    //create .env file
    await fsExtra.ensureFile('.env');
    await fs.writeFile(path.join(process.cwd(), '.env'), `${key}=${value}`);
  }

  await bundle();

  const { mastra } = await import(join(dotMastraPath, 'mastra.mjs'));

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
    console.log(`🦄Server running on port ${color.blueBright(port)}`);
  });

  return;
}
