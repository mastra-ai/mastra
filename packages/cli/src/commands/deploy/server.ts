export const EXPRESS_SERVER = `
    import express from 'express';
    import { join } from 'path';

    const { mastra } = await import(join(process.cwd(), 'mastra.mjs'));

    const app = express();

    app.use(express.json());

    const validateBody = async (body) => {
        const errorResponse = Object.entries(body).reduce((acc, [key, value]) => {
            if (!value) {
            acc[key] = \`\${key} is required\`;
            }
            return acc;
        }, {});

        if (Object.keys(errorResponse).length > 0) {
            return { ok: false, errorResponse };
        }

        return { ok: true };
    };

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

    const { ok, errorResponse } = await validateBody({ 
        messages, 
        structuredOutput 
    });

    if (!ok) {
        res.status(400).json({ error: errorResponse });
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

    const { ok, errorResponse } = await validateBody({ 
        messages, 
        structuredOutput 
    });

    if (!ok) {
        res.status(400).json({ error: errorResponse });
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

    app.get('/memory/threads/get-by-resourceid/:resourceid', async (req, res) => {
        const resourceid = req.params.resourceid;
        const memory = mastra.memory;

        if (!memory) {
            res.status(400).json({ error: 'Memory is not initialized' });
            return;
        }

        try {
            const threads = await memory.getThreadsByResourceId({ resourceid });
            res.json(threads);
        } catch (error) {
            console.error('Error getting threads from memory', error);
            res.status(500).json({ error: 'Error getting threads from memory' });
            return;
        }
    });

    app.get('/memory/threads/:threadId', async (req, res) => {
        const threadId = req.params.threadId;
        const memory = mastra.memory;

        if (!memory) {
            res.status(400).json({ error: 'Memory is not initialized' });
            return;
        }

        try {
            const thread = await memory.getThreadById({ threadId });
            if (!thread) {
                res.status(404).json({ error: 'Thread not found' });
                return;
            }
            res.json(thread);
        } catch (error) {
            console.error('Error getting thread from memory', error);
            res.status(500).json({ error: 'Error getting thread from memory' });
            return;
        }
    });

    app.post('/memory/threads', async (req, res) => {
    const memory = mastra.memory;

    const { title, metadata, resourceid, threadId } = req.body;

    if (!memory) {
        res.status(400).json({ error: 'Memory is not initialized' });
        return;
    }

    const { ok, errorResponse } = await validateBody({ resourceid });

    if (!ok) {
        res.status(400).json({ error: errorResponse });
        return;
    }

    try {
        const result = await memory.createThread({ resourceid, title, metadata, threadId });
        res.json(result);
    } catch (error) {
        console.error('Error saving thread to memory', error);
        res.status(500).json({ error: 'Error saving thread to memory' });
        return;
    }
    });

    app.patch('/memory/threads/:threadId', async (req, res) => {
    const threadId = req.params.threadId;

    const memory = mastra.memory;

    const { title, metadata, resourceid } = req.body;

    const updatedAt = new Date();

    if (!memory) {
        res.status(400).json({ error: 'Memory is not initialized' });
        return;
    }

    
    try {
        const thread = await memory.getThreadById({ threadId });
    
        if (!thread) {
            res.status(404).json({ error: 'Thread not found' });
            return;
        }
    
        const updatedThread = {
            ...thread,
            title: title || thread.title,
            metadata: metadata || thread.metadata,
            resourceid: resourceid || thread.resourceid,
            createdAt: thread.createdat,
            updatedAt,
        }
        const result = await memory.saveThread({ thread: updatedThread });
        res.json(result);
    } catch (error) {
        console.error('Error saving thread to memory', error);
        res.status(500).json({ error: 'Error saving thread to memory' });
        return;
    }
    });

    app.delete('/memory/threads/:threadId', async (req, res) => {
    const threadId = req.params.threadId;

    const memory = mastra.memory;

    if (!memory) {
        res.status(400).json({ error: 'Memory is not initialized' });
        return;
    }
    
    try {
        const thread = await memory.getThreadById({ threadId });
    
        if (!thread) {
            res.status(404).json({ error: 'Thread not found' });
            return;
        }

        const result = await memory.deleteThread(threadId);
        res.json({result: "Thread deleted"});
    } catch (error) {
        console.error('Error deleting thread from memory', error);
        res.status(500).json({ error: 'Error deleting thread from memory' });
        return;
    }
    });

    app.get('/memory/threads/:threadId/messages', async (req, res) => {
    const threadId = req.params.threadId;
    const memory = mastra.memory;

    if (!memory) {
        res.status(400).json({ error: 'Memory is not initialized' });
        return;
    }

    try {
        const thread = await memory.getThreadById({ threadId });
    
        if (!thread) {
            res.status(404).json({ error: 'Thread not found' });
            return;
        }
   
        const result = await memory.getMessages({ threadId });
        res.json(result);
    } catch (error) {
        console.error('Error getting messages from memory', error);
        res.status(500).json({ error: 'Error getting messages from memory' });
        return;
    }
    });

    app.get('/memory/threads/:threadId/context-window', async (req, res) => {
    const threadId = req.params.threadId;
    const { startDate, endDate, format } = req.query;
    const memory = mastra.memory;

    if (!memory) {
        res.status(400).json({ error: 'Memory is not initialized' });
        return;
    }

    try {
        const thread = await memory.getThreadById({ threadId });
    
        if (!thread) {
            res.status(404).json({ error: 'Thread not found' });
            return;
        }

        const result = await memory.getContextWindow({ threadId, startDate, endDate, format });
        res.json(result);
    } catch (error) {
        console.error('Error getting context window from memory', error);
        res.status(500).json({ error: 'Error getting context window from memory' });
        return;
    }
    });

    app.post('/memory/save-messages', async (req, res) => {
    const memory = mastra.memory;

    const messages = req.body.messages;

    if (!memory) {
        res.status(400).json({ error: 'Memory is not initialized' });
        return;
    }

    const { ok, errorResponse } = await validateBody({ messages });

    if (!ok) {
        res.status(400).json({ error: errorResponse });
        return;
    }

    try {
        const processMessages = messages.map((message) => {
            return {
                ...message,
                id: memory.generateId(),
                createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
            }
        })
        const result = await memory.saveMessages({ messages: processMessages });
        res.json(result);
    } catch (error) {
        console.error('Error saving messages to memory', error);
        res.status(500).json({ error: 'Error saving messages to memory' });
        return;
    }
    });

    app.post('/memory/threads/:threadId/tool-result', async (req, res) => {
    const threadId = req.params.threadId;
    const memory = mastra.memory;

    const { toolName, toolArgs } = req.body;

    if (!memory) {
        res.status(400).json({ error: 'Memory is not initialized' });
        return;
    }

    const { ok, errorResponse } = await validateBody({ toolName, toolArgs });

    if (!ok) {
        res.status(400).json({ error: errorResponse });
        return;
    }

    try {
        const thread = await memory.getThreadById({ threadId });
    
        if (!thread) {
            res.status(404).json({ error: 'Thread not found' });
            return;
        }

        const result = await memory.getToolResult({ threadId, toolName, toolArgs });
        res.json(result);
    } catch (error) {
        console.error('Error getting tool result from memory', error);
        res.status(500).json({ error: 'Error getting tool result from memory' });
        return;
    }
    });

    app.post('/memory/validate-tool-call-args', async (req, res) => {
    const memory = mastra.memory;

    const { hashedArgs } = req.body;

    if (!memory) {
        res.status(400).json({ error: 'Memory is not initialized' });
        return;
    }

    const { ok, errorResponse } = await validateBody({ hashedArgs });

    if (!ok) {
        res.status(400).json({ error: errorResponse });
        return;
    }

    try {
        const result = await memory.validateToolCallArgs({ hashedArgs });
        res.json(result);
    } catch (error) {
        console.error('Error validating tool call args', error);
        res.status(500).json({ error: 'Error validating tool call args' });
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
