import chalk from 'chalk';
import { config } from 'dotenv';
import express from 'express';
import { join } from 'path';
import path from 'path';

import fsExtra from 'fs-extra/esm';
import fs from 'fs/promises';

import { getFirstExistingFile } from '../utils.js';
import { bundle } from '../utils/bundle.js';

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
    console.log(`🦄Server running on port ${chalk.blueBright(port)}`);
  });

  return;
}
