export const EXPRESS_SERVER = `
    import express from 'express';
    import { join } from 'path';

    const { mastra } = await import(join(process.cwd(), 'mastra.mjs'));

    const app = express();

    app.use(express.json());

    app.get('/', (req, res) => {
    res.send('Hello World!');
    });

    app.get('/agent/:agentId', (req, res) => {
    const agentId = req.params.agentId;
    const agent = mastra.getAgent(agentId);

    res.json({
        agentId: agent.name,
        enabledTools: agent.enabledTools,
    });
    });

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

    app.listen(3000, () => {
    console.log(\`🦄Server running on port ${3000}\`);
    });
`

export const NETLIFY = `
import { mastra } from './mastra.mjs';
import serverless from "serverless-http";
import express from "express";

const app = express();

 app.use(express.json());

    app.get('/', (req, res) => {
    res.send('Hello World!');
    });

    app.get('/agent/:agentId', (req, res) => {
    const agentId = req.params.agentId;
    const agent = mastra.getAgent(agentId);

    res.json({
        agentId: agent.name,
        enabledTools: agent.enabledTools,
    });
    });

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

export const handler = serverless(app);
`

export const WORKER = `
// For local modules, use relative paths
import { mastra } from './mastra.mjs';

export default {
    async fetch(request, env, ctx) {
        console.log('hello');
        return new Response('Hello World');  // Remember to always return a Response
    }
};
`