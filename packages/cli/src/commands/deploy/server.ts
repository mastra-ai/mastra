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

    app.post('/agent/:agentId/text-object', async (req, res) => {
    const agentId = req.params.agentId;

    const agent = mastra.getAgent(agentId);

    const messages = req.body.messages;
    const structuredOutput = req.body.structuredOutput;

    if (!structuredOutput || !messages) {
        const messagesAndStructuredOutputError = !messages && !structuredOutput ? 'messages and structuredOutput are required' : '';
        const messagesError = messages ? '' : 'messages is required';
        const structuredOutputError = structuredOutput ? '' : 'structuredOutput is required';
        const errorMessage = messagesAndStructuredOutputError || messagesError || structuredOutputError;
        res.status(400).json({ error: errorMessage});
        return;
    }

    try {
        const result = await agent.textObject({ messages, structuredOutput });
        res.json(result);
    } catch (error) {
        console.error('Error getting structured output from agent', error);
        res.status(500).json({ error: 'Error getting structured output from agent' });
        return;
    }
    });

    app.post('/agent/:agentId/stream-object', async (req, res) => {
    const agentId = req.params.agentId;
    const agent = mastra.getAgent(agentId);
    const messages = req.body.messages;
    const structuredOutput = req.body.structuredOutput;

    if (!structuredOutput || !messages) {
        const messagesAndStructuredOutputError = !messages && !structuredOutput ? 'messages and structuredOutput are required' : '';
        const messagesError = messages ? '' : 'messages is required';
        const structuredOutputError = structuredOutput ? '' : 'structuredOutput is required';
        const errorMessage = messagesAndStructuredOutputError || messagesError || structuredOutputError;
        res.status(400).json({ error: errorMessage});
        return;
    }

    try {
        const streamResult = await agent.streamObject({
            messages,
            structuredOutput,
        });

        streamResult.pipeTextStreamToResponse(res);
     } catch (error) {
        console.error('Error streaming structured output from agent', error);
        res.status(500).json({ error: 'Error streaming structured output from agent' });
        return;}
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

    app.listen(process.env.PORT || 4111, () => {
    console.log(\`🦄Server running on port \${process.env.PORT || 4111}\`);
    });
`;

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
`;

export const WORKER = `
// For local modules, use relative paths
import { mastra } from './mastra.mjs';
import { AutoRouter } from 'itty-router'

// Create a new router
const router = AutoRouter();

router.get('/', () => {
  return new Response('Hello to the Mastra API!', {
    headers: { 'Content-Type': 'text/plain' }
  });
})

router.get('/agent/:agentId', ({ params }) => {
    const agentId = decodeURIComponent(params.agentId);
    const agent = mastra.getAgent(agentId);

    return new Response(JSON.stringify({
        agentId: agent.name,
        enabledTools: agent.enabledTools,
    }), {
        headers: {
            'Content-Type': 'application/json'
        }
    });
});

router.post('/agent/:agentId/text', async ({ params, json }) => {
    const agentId = decodeURIComponent(params.agentId);

    const agent = mastra.getAgent(agentId);

    const body = await json();

    const messages = body.messages;

    const result = await agent.text({ messages });

    return new Response(JSON.stringify(result), {
        headers: {
            'Content-Type': 'application/json'
        }
    });
});

router.post('/agent/:agentId/stream', async ({ params, json }) => {
    const agentId = decodeURIComponent(params.agentId);
    const agent = mastra.getAgent(agentId);
    const body = await json();
    const messages = body.messages;
    
    const streamResult = await agent.stream({
        messages,
    });

    console.log('streamResult');

    return streamResult.toDataStreamResponse({
       headers: {
          // add these headers to ensure that the
          // response is chunked and streamed
          "Content-Type": "text/x-unknown",
          "content-encoding": "identity",
          "transfer-encoding": "chunked",
        }
    })
});

router.post('/workflows/:workflowId/execute', async ({ params, json }) => {
    const workflowId = decodeURIComponent(params.workflowId);
    const workflow = mastra.workflows.get(workflowId);

    try {
        const body = await json()
        console.log('body', body);
        const result = await workflow.execute(body);
        
        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error executing workflow', error);
        return;
    }
});

// 404 handler
router.all('*', () => new Response('Not Found', { status: 404 }));

export default {
    async fetch(request, env, ctx) {
        Object.entries(env || {}).forEach(([key, value]) => {
            process.env[key] = value;
        })

        return router.fetch(request, env, ctx);
    }
};
`;
