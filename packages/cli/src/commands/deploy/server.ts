export const EXPRESS_SERVER = `
    import express from 'express';
    import { join } from 'path';
    import { fileURLToPath } from 'url';

    const __dirname = fileURLToPath(new URL('.', import.meta.url));
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
    
    // Serve static files from the Vite build first
    app.use('/assets', express.static(join(__dirname, 'agent-chat/assets'), {
      setHeaders: (res, path) => {
        // Set correct MIME types
        if (path.endsWith('.js')) {
          res.set('Content-Type', 'application/javascript');
        } else if (path.endsWith('.css')) {
          res.set('Content-Type', 'text/css');
        }
      }
    }));

    // Serve other static files
    app.use(express.static(join(__dirname, 'agent-chat')));

    // Serve the Vite app for /agent/:agentId
    app.get('/agent/:agentId', (req, res) => {
      res.sendFile(join(__dirname, 'agent-chat/index.html'));
    });

    // API routes
    app.post('/agent/:agentId/text', async (req, res) => {
        try {
            const agentId = req.params.agentId;
            const agent = mastra.getAgent(agentId);
            const messages = req.body.messages;
            const { ok, errorResponse } = await validateBody({
                messages
            });
            if (!ok) {
                res.status(400).json({ error: errorResponse });
                return;
            }
            if (!Array.isArray(messages)) {
                res.status(400).json({ error: { messages:'Messages should be an array' } });
                return;
            }
            const result = await agent.text({ messages });
            res.json(result);
        } catch (error) {
            console.error('Error texting from agent', error);
            res.status(500).json({ error: error?.message ||'Error texting from agent' });
            return;
        }
    });

    app.post('/agent/:agentId/stream', async (req, res) => {
        try {
            const agentId = req.params.agentId;
            const agent = mastra.getAgent(agentId);
            const messages = req.body.messages;
            const { ok, errorResponse } = await validateBody({ 
                messages 
            });

            if (!ok) {
                res.status(400).json({ error: errorResponse });
                return;
            }

            if (!Array.isArray(messages)) {
                res.status(400).json({ error: { messages:'Messages should be an array' } });
                return;
            }

            const streamResult = await agent.stream({
                messages,
            });

            streamResult.pipeDataStreamToResponse(res);
        } catch (error) {
            console.error('Error streaming from agent', error);
            res.status(500).json({ error: error?.message ||'Error streaming from agent' });
            return;
        }
    });

    app.post('/agent/:agentId/text-object', async (req, res) => {        
        try {
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

            if (!Array.isArray(messages)) {
                res.status(400).json({ error: { messages:'Messages should be an array' } });
                return;
            }
            const result = await agent.textObject({ messages, structuredOutput });
            res.json(result);
        } catch (error) {
            console.error('Error getting structured output from agent', error);
            res.status(500).json({ error: error?.message ||'Error getting structured output from agent' });
            return;
        }
    });

    app.post('/agent/:agentId/stream-object', async (req, res) => {    
        try {
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

            if (!Array.isArray(messages)) {
                res.status(400).json({ error: { messages:'Messages should be an array' } });
                return;
            }

            const streamResult = await agent.streamObject({
                messages,
                structuredOutput,
            });

            streamResult.pipeTextStreamToResponse(res);
        } catch (error) {
            console.error('Error streaming structured output from agent', error);
            res.status(500).json({ error: error?.message ||'Error streaming structured output from agent' });
            return;
        }
    });

    app.post('/workflows/:workflowId/execute', async (req, res) => {   
        try {
            const workflowId = req.params.workflowId;
            const workflow = mastra.workflows.get(workflowId);
            const result = await workflow.execute(req.body);
            res.json(result);
        } catch (error) {
            console.error('Error executing workflow', error);
            res.status(500).json({ error: error?.message ||'Error executing workflow' });
            return;
        }
    });

    app.get('/memory/threads/get-by-resourceid/:resourceid', async (req, res) => {
        try {
            const resourceid = req.params.resourceid;
            const memory = mastra.memory;
        
            if (!memory) {
                res.status(400).json({ error: 'Memory is not initialized' });
                return;
            }
            const threads = await memory.getThreadsByResourceId({ resourceid });
            res.json(threads);
        } catch (error) {
            console.error('Error getting threads from memory', error);
            res.status(500).json({ error: error?.message ||'Error getting threads from memory' });
            return;
        }
    });

    app.get('/memory/threads/:threadId', async (req, res) => {
        try {
            const threadId = req.params.threadId;
            const memory = mastra.memory;
        
            if (!memory) {
                res.status(400).json({ error: 'Memory is not initialized' });
                return;
            }
            const thread = await memory.getThreadById({ threadId });
            if (!thread) {
                res.status(404).json({ error: 'Thread not found' });
                return;
            }
            res.json(thread);
        } catch (error) {
            console.error('Error getting thread from memory', error);
            res.status(500).json({ error: error?.message ||'Error getting thread from memory' });
            return;
        }
    });

    app.post('/memory/threads', async (req, res) => {  
        try {
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
            const result = await memory.createThread({ resourceid, title, metadata, threadId });
            res.json(result);
        } catch (error) {
            console.error('Error saving thread to memory', error);
            res.status(500).json({ error: error?.message ||'Error saving thread to memory' });
            return;
        }
    });

    app.patch('/memory/threads/:threadId', async (req, res) => {
        try {
            const threadId = req.params.threadId;
        
            const memory = mastra.memory;
        
            const { title, metadata, resourceid } = req.body;
        
            const updatedAt = new Date();
        
            if (!memory) {
                res.status(400).json({ error: 'Memory is not initialized' });
                return;
            }
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
            res.status(500).json({ error: error?.message ||'Error saving thread to memory' });
            return;
        }
    });

    app.delete('/memory/threads/:threadId', async (req, res) => {   
        try {
            const threadId = req.params.threadId;
        
            const memory = mastra.memory;
        
            if (!memory) {
                res.status(400).json({ error: 'Memory is not initialized' });
                return;
            }
            const thread = await memory.getThreadById({ threadId });
        
            if (!thread) {
                res.status(404).json({ error: 'Thread not found' });
                return;
            }

            const result = await memory.deleteThread(threadId);
            res.json({result: "Thread deleted"});
        } catch (error) {
            console.error('Error deleting thread from memory', error);
            res.status(500).json({ error: error?.message ||'Error deleting thread from memory' });
            return;
        }
    });

    app.get('/memory/threads/:threadId/messages', async (req, res) => {
        try {
            const threadId = req.params.threadId;
            const memory = mastra.memory;
        
            if (!memory) {
                res.status(400).json({ error: 'Memory is not initialized' });
                return;
            }
            const thread = await memory.getThreadById({ threadId });
        
            if (!thread) {
                res.status(404).json({ error: 'Thread not found' });
                return;
            }
    
            const result = await memory.getMessages({ threadId });
            res.json(result);
        } catch (error) {
            console.error('Error getting messages from memory', error);
            res.status(500).json({ error: error?.message ||'Error getting messages from memory' });
            return;
        }
    });

    app.get('/memory/threads/:threadId/context-window', async (req, res) => {
        try {
            const threadId = req.params.threadId;
            const { startDate, endDate, format } = req.query;
            const memory = mastra.memory;
        
            if (!memory) {
                res.status(400).json({ error: 'Memory is not initialized' });
                return;
            }
            const thread = await memory.getThreadById({ threadId });
        
            if (!thread) {
                res.status(404).json({ error: 'Thread not found' });
                return;
            }

            const result = await memory.getContextWindow({ threadId, startDate, endDate, format });
            res.json(result);
        } catch (error) {
            console.error('Error getting context window from memory', error);
            res.status(500).json({ error: error?.message ||'Error getting context window from memory' });
            return;
        }
    });

    app.post('/memory/save-messages', async (req, res) => {    
        try {
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

            if (!Array.isArray(messages)) {
                res.status(400).json({ error: { messages:'Messages should be an array' } });
                return;
            }

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
            res.status(500).json({ error: error?.message ||'Error saving messages to memory' });
            return;
        }
    });

    app.post('/memory/threads/:threadId/tool-result', async (req, res) => {
        try {
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
            const thread = await memory.getThreadById({ threadId });
        
            if (!thread) {
                res.status(404).json({ error: 'Thread not found' });
                return;
            }

            const result = await memory.getToolResult({ threadId, toolName, toolArgs });
            res.json(result);
        } catch (error) {
            console.error('Error getting tool result from memory', error);
            res.status(500).json({ error: error?.message ||'Error getting tool result from memory' });
            return;
        }
    });

    app.post('/memory/validate-tool-call-args', async (req, res) => {      
        try {
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
            const result = await memory.validateToolCallArgs({ hashedArgs });
            res.json(result);
        } catch (error) {
            console.error('Error validating tool call args', error);
            res.status(500).json({ error: error?.message ||'Error validating tool call args' });
            return;
        }
    });

    app.post('/syncs/:syncId/execute', async (req, res) => {   
        try {
            const syncId = req.params.syncId;
            const { runId, params } = req.body
            const { ok, errorResponse } = await validateBody({ params });
            if (!ok) {
                res.status(400).json({ error: errorResponse });
                return;
            }
            const result = await mastra.sync(syncId, params, runId);
            res.json(result);
        } catch (error) {
            console.error('Error executing sync', error);
            res.status(500).json({ error: error?.message ||'Error executing sync' });
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
        try {
            const agentId = req.params.agentId;
            const agent = mastra.getAgent(agentId);

            res.json({
                agentId: agent.name,
                enabledTools: agent.enabledTools,
            });
        } catch (error) {
            console.error('Error getting agent', error);
            res.status(500).json({ error: error?.message ||'Error getting agent' });
            return;
        }
    });

    app.post('/agent/:agentId/text', async (req, res) => {
        try {
            const agentId = req.params.agentId;

            const agent = mastra.getAgent(agentId);

            const messages = req.body.messages;

            const { ok, errorResponse } = await validateBody({ 
                messages 
            });

            if (!ok) {
                res.status(400).json({ error: errorResponse });
                return;
            }

            if (!Array.isArray(messages)) {
                res.status(400).json({ error: { messages:'Messages should be an array' } });
                return;
            }

            const result = await agent.text({ messages });

            res.json(result);
        } catch (error) {
            console.error('Error texting from agent', error);
            res.status(500).json({ error: error?.message ||'Error texting from agent' });
            return;
        }
    });

    app.post('/agent/:agentId/stream', async (req, res) => {
        try {
            const agentId = req.params.agentId;
            const agent = mastra.getAgent(agentId);
            const messages = req.body.messages;
            const { ok, errorResponse } = await validateBody({ 
                messages 
            });

            if (!ok) {
                res.status(400).json({ error: errorResponse });
                return;
            }

            if (!Array.isArray(messages)) {
                res.status(400).json({ error: { messages:'Messages should be an array' } });
                return;
            }

            const streamResult = await agent.stream({
                messages,
            });

            streamResult.pipeDataStreamToResponse(res);
        } catch (error) {
            console.error('Error streaming from agent', error);
            res.status(500).json({ error: error?.message ||'Error streaming from agent' });
            return;
        }
    });

    app.post('/agent/:agentId/text-object', async (req, res) => {
        try {
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

            if (!Array.isArray(messages)) {
                res.status(400).json({ error: { messages:'Messages should be an array' } });
                return;
            }
            const result = await agent.textObject({ messages, structuredOutput });
            res.json(result);
        } catch (error) {
            console.error('Error getting structured output from agent', error);
            res.status(500).json({ error: error?.message ||'Error getting structured output from agent' });
            return;
        }
    });

    app.post('/agent/:agentId/stream-object', async (req, res) => {
        try {
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

            if (!Array.isArray(messages)) {
                res.status(400).json({ error: { messages:'Messages should be an array' } });
                return;
            }

            const streamResult = await agent.streamObject({
                messages,
                structuredOutput,
            });

            streamResult.pipeTextStreamToResponse(res);
        } catch (error) {
            console.error('Error streaming structured output from agent', error);
            res.status(500).json({ error: error?.message ||'Error streaming structured output from agent' });
            return;
        }
    });

    app.post('/workflows/:workflowId/execute', async (req, res) => {
        try {
            const workflowId = req.params.workflowId;
            const workflow = mastra.workflows.get(workflowId);
            const result = await workflow.execute(req.body);
            res.json(result);
        } catch (error) {
            console.error('Error executing workflow', error);
            res.status(500).json({ error: error?.message ||'Error executing workflow' });
            return;
        }
    });

    app.get('/memory/threads/get-by-resourceid/:resourceid', async (req, res) => { 
        try {
            const resourceid = req.params.resourceid;
            const memory = mastra.memory;
        
            if (!memory) {
                res.status(400).json({ error: 'Memory is not initialized' });
                return;
            }
            const threads = await memory.getThreadsByResourceId({ resourceid });
            res.json(threads);
        } catch (error) {
            console.error('Error getting threads from memory', error);
            res.status(500).json({ error: 'Error getting threads from memory' });
            return;
        }
    });

    app.get('/memory/threads/:threadId', async (req, res) => {
        try {
            const threadId = req.params.threadId;
            const memory = mastra.memory;
    
            if (!memory) {
                res.status(400).json({ error: 'Memory is not initialized' });
                return;
            }
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
        try {
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
            const result = await memory.createThread({ resourceid, title, metadata, threadId });
            res.json(result);
        } catch (error) {
            console.error('Error saving thread to memory', error);
            res.status(500).json({ error: 'Error saving thread to memory' });
            return;
        }
    });

    app.patch('/memory/threads/:threadId', async (req, res) => {
        try {
            const threadId = req.params.threadId;
        
            const memory = mastra.memory;
        
            const { title, metadata, resourceid } = req.body;
        
            const updatedAt = new Date();
        
            if (!memory) {
                res.status(400).json({ error: 'Memory is not initialized' });
                return;
            }
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
            res.status(500).json({ error: error?.message ||'Error saving thread to memory' });
            return;
        }
    });

    app.delete('/memory/threads/:threadId', async (req, res) => {   
        try {
            const threadId = req.params.threadId;
        
            const memory = mastra.memory;
        
            if (!memory) {
                res.status(400).json({ error: 'Memory is not initialized' });
                return;
            }
            const thread = await memory.getThreadById({ threadId });
        
            if (!thread) {
                res.status(404).json({ error: 'Thread not found' });
                return;
            }

            const result = await memory.deleteThread(threadId);
            res.json({result: "Thread deleted"});
        } catch (error) {
            console.error('Error deleting thread from memory', error);
            res.status(500).json({ error: error?.message ||'Error deleting thread from memory' });
            return;
        }
    });

    app.get('/memory/threads/:threadId/messages', async (req, res) => {
        try {
            const threadId = req.params.threadId;
            const memory = mastra.memory;
        
            if (!memory) {
                res.status(400).json({ error: 'Memory is not initialized' });
                return;
            }
            const thread = await memory.getThreadById({ threadId });
        
            if (!thread) {
                res.status(404).json({ error: 'Thread not found' });
                return;
            }
    
            const result = await memory.getMessages({ threadId });
            res.json(result);
        } catch (error) {
            console.error('Error getting messages from memory', error);
            res.status(500).json({ error: error?.message ||'Error getting messages from memory' });
            return;
        }
    });

    app.get('/memory/threads/:threadId/context-window', async (req, res) => {
        try {
            const threadId = req.params.threadId;
            const { startDate, endDate, format } = req.query;
            const memory = mastra.memory;
        
            if (!memory) {
                res.status(400).json({ error: 'Memory is not initialized' });
                return;
            }
            const thread = await memory.getThreadById({ threadId });
        
            if (!thread) {
                res.status(404).json({ error: 'Thread not found' });
                return;
            }

            const result = await memory.getContextWindow({ threadId, startDate, endDate, format });
            res.json(result);
        } catch (error) {
            console.error('Error getting context window from memory', error);
            res.status(500).json({ error: error?.message ||'Error getting context window from memory' });
            return;
        }
    });

    app.post('/memory/save-messages', async (req, res) => {    
        try {
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

            if (!Array.isArray(messages)) {
                res.status(400).json({ error: { messages:'Messages should be an array' } });
                return;
            }

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
            res.status(500).json({ error: error?.message ||'Error saving messages to memory' });
            return;
        }
    });

    app.post('/memory/threads/:threadId/tool-result', async (req, res) => {
        try {
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
            const thread = await memory.getThreadById({ threadId });
        
            if (!thread) {
                res.status(404).json({ error: 'Thread not found' });
                return;
            }

            const result = await memory.getToolResult({ threadId, toolName, toolArgs });
            res.json(result);
        } catch (error) {
            console.error('Error getting tool result from memory', error);
            res.status(500).json({ error: error?.message ||'Error getting tool result from memory' });
            return;
        }
    });

    app.post('/memory/validate-tool-call-args', async (req, res) => {      
        try {
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
            const result = await memory.validateToolCallArgs({ hashedArgs });
            res.json(result);
        } catch (error) {
            console.error('Error validating tool call args', error);
            res.status(500).json({ error: error?.message ||'Error validating tool call args' });
            return;
        }
    });

    app.post('/syncs/:syncId/execute', async (req, res) => {   
        try {
            const syncId = req.params.syncId;
            const { runId, params } = req.body
            const { ok, errorResponse } = await validateBody({ params });
            if (!ok) {
                res.status(400).json({ error: errorResponse });
                return;
            }
            const result = await mastra.sync(syncId, params, runId);
            res.json(result);
        } catch (error) {
            console.error('Error executing sync', error);
            res.status(500).json({ error: error?.message ||'Error executing sync' });
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

router.get('/', () => {
  return new Response('Hello to the Mastra API!', {
    headers: { 'Content-Type': 'text/plain' }
  });
})

router.get('/agent/:agentId', ({ params }) => {
    try {
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
    } catch (error) {
        console.error('Error getting agent', error);
        return new Response(JSON.stringify({ error: error?.message ||'Error getting agent' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
});

router.post('/agent/:agentId/text', async ({ params, json }) => {
    try {
        const agentId = decodeURIComponent(params.agentId);

        const agent = mastra.getAgent(agentId);

        const body = await json();

        const messages = body.messages;

        const { ok, errorResponse } = await validateBody({ 
            messages
        });
        
        if (!ok) {
            return new Response(JSON.stringify({ error: errorResponse }), {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        
        if (!Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: { messages:'Messages should be an array' } }), {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        const result = await agent.text({ messages });

        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error streaming from agent', error);
        return new Response(JSON.stringify({ error: error?.message || 'Error streaming from agent' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
});

router.post('/agent/:agentId/stream', async ({ params, json }) => {
    try {
        const agentId = decodeURIComponent(params.agentId);
        const agent = mastra.getAgent(agentId);
        const body = await json();
        const messages = body.messages;

        const { ok, errorResponse } = await validateBody({ 
            messages 
        });
        
        if (!ok) {
            return new Response(JSON.stringify({ error: errorResponse }), {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        if (!Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: { messages:'Messages should be an array' } }), {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        
        const streamResult = await agent.stream({
            messages,
        });

        return streamResult.toDataStreamResponse({
            headers: {
                // add these headers to ensure that the
                // response is chunked and streamed
                "Content-Type": "text/x-unknown",
                "content-encoding": "identity",
                "transfer-encoding": "chunked",
            }
        })
    } catch (error) {
        console.error('Error streaming from agent', error);
        return new Response(JSON.stringify({ error: error?.message || 'Error streaming from agent' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
});

router.post('/agent/:agentId/text-object', async ({params, json}) => {  
    try {
        const agentId = decodeURIComponent(params.agentId);
        
        const agent = mastra.getAgent(agentId);
        
        const body = await json();
        
        const messages = body.messages;
        const structuredOutput = body.structuredOutput;
        
        const { ok, errorResponse } = await validateBody({ 
            messages, 
            structuredOutput 
        });
        
        if (!ok) {
            return new Response(JSON.stringify({ error: errorResponse }), {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        if (!Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: { messages:'Messages should be an array' } }), {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        
        const result = await agent.textObject({ messages, structuredOutput });
        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error getting structured output from agent', error);
        return new Response(JSON.stringify({ error: error?.message || 'Error getting structured output from agent' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
});

router.post('/agent/:agentId/stream-object', async ({params, json}) => {
    try {
        const agentId = decodeURIComponent(params.agentId);
        const agent = mastra.getAgent(agentId);
        const body = await json();

        const messages = body.messages;
        const structuredOutput = body.structuredOutput;

        const { ok, errorResponse } = await validateBody({ 
            messages, 
            structuredOutput 
        });

        if (!ok) {
            return new Response(JSON.stringify({ error: errorResponse }), {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        const streamResult = await agent.streamObject({
            messages,
            structuredOutput,
        });

        return streamResult.toTextStreamResponse({
            headers: {
                // add these headers to ensure that the
                // response is chunked and streamed
                "Content-Type": "text/x-unknown",
                "content-encoding": "identity",
                "transfer-encoding": "chunked",
            }
        })
    } catch (error) {
        console.error('Error streaming structured output from agent', error);
        return new Response(JSON.stringify({ error: error?.message || 'Error steaming structured output from agent' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
});

router.post('/workflows/:workflowId/execute', async ({ params, json }) => {
    
    try {
        const workflowId = decodeURIComponent(params.workflowId);
        const workflow = mastra.workflows.get(workflowId);
        const body = await json()
        const result = await workflow.execute(body);
        
        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error executing workflow', error);
        return new Response(JSON.stringify({ error: error?.message || 'Error executing workflow' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
});

router.get('/memory/threads/get-by-resourceid/:resourceid', async ({ params }) => { 
    try {
        const resourceid = decodeURIComponent(params.resourceid);
        const memory = mastra.memory;
        
        if (!memory) {
            return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        const threads = await memory.getThreadsByResourceId({ resourceid });
        return new Response(JSON.stringify(threads), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error getting threads from memory', error);
        return new Response(JSON.stringify({ error: error?.message || 'Error getting threads from memory' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
});

router.get('/memory/threads/:threadId', async ({ params }) => { 
    try {
        const threadId = decodeURIComponent(params.threadId);
        const memory = mastra.memory;
        
        if (!memory) {
            return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        const thread = await memory.getThreadById({ threadId });
        if (!thread) {
            return new Response(JSON.stringify({ error: 'Thread not found' }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        return new Response(JSON.stringify(thread), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error getting thread from memory', error);
        return new Response(JSON.stringify({ error: error?.message || 'Error getting thread from memory' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
});

router.post('/memory/threads', async ({ json }) => {  
    try {
        const memory = mastra.memory;
        
        const { title, metadata, resourceid, threadId } = await json();
        
        if (!memory) {
            return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        
        const { ok, errorResponse } = await validateBody({ resourceid });
        
        if (!ok) {
            return new Response(JSON.stringify({ error: errorResponse }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        const result = await memory.createThread({ resourceid, title, metadata, threadId });
        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error saving thread to memory', error);
        return new Response(JSON.stringify({ error: error?.message || 'Error saving thread to memory' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
});

router.patch('/memory/threads/:threadId', async ({ params, json }) => {
    try {
        const threadId = decodeURIComponent(params.threadId);
        
        const memory = mastra.memory;
        
        const { title, metadata, resourceid } = await json();
        
        const updatedAt = new Date();
        
        if (!memory) {
            return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        const thread = await memory.getThreadById({ threadId });
    
        if (!thread) {
            return new Response(JSON.stringify({ error: 'Thread not found' }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
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
        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error saving thread to memory', error);
        return new Response(JSON.stringify({ error: error?.message || 'Error saving thread to memory' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
});

router.delete('/memory/threads/:threadId', async ({ params }) => {
    try {
        const threadId = decodeURIComponent(params.threadId);
        
        const memory = mastra.memory;
        
        if (!memory) {
            return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        const thread = await memory.getThreadById({ threadId });
    
        if (!thread) {
            return new Response(JSON.stringify({ error: 'Thread not found' }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        const result = await memory.deleteThread(threadId);
        return new Response(JSON.stringify({result: "Thread deleted"}), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error deleting thread from memory', error);
        return new Response(JSON.stringify({ error: error?.message || 'Error deleting thread from memory' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
});

router.get('/memory/threads/:threadId/messages', async ({ params }) => {
    try {
        const threadId = decodeURIComponent(params.threadId);
        const memory = mastra.memory;
        
        if (!memory) {
            return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        const thread = await memory.getThreadById({ threadId });
    
        if (!thread) {
            return new Response(JSON.stringify({ error: 'Thread not found' }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
   
        const result = await memory.getMessages({ threadId });
        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error getting messages from memory', error);
        return new Response(JSON.stringify({ error: error?.message || 'Error getting messages from memory' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
});

router.get('/memory/threads/:threadId/context-window', async ({ params, query }) => {
    const threadId = decodeURIComponent(params.threadId);
    const { startDate, endDate, format } = query;
    const memory = mastra.memory;

    if (!memory) {
        return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    try {
        const thread = await memory.getThreadById({ threadId });
    
        if (!thread) {
            return new Response(JSON.stringify({ error: 'Thread not found' }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        const result = await memory.getContextWindow({ threadId, startDate, endDate, format });
        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error getting context window from memory', error);
        return new Response(JSON.stringify({ error: 'Error getting context window from memory' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
});

router.post('/memory/save-messages', async ({ json }) => {
    try {
        const memory = mastra.memory;
        
        const messages = await json();
        
        if (!memory) {
            return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        
        const { ok, errorResponse } = await validateBody({ messages });
        
        if (!ok) {
            return new Response(JSON.stringify({ error: errorResponse }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        if (!Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: { messages:'Messages should be an array' } }), {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        const processMessages = messages.map((message) => {
            return {
                ...message,
                id: memory.generateId(),
                createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
            }
        })
        const result = await memory.saveMessages({ messages: processMessages });
        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error saving messages to memory', error);
        return new Response(JSON.stringify({ error: error?.message || 'Error saving messages to memory' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
});

router.post('/memory/threads/:threadId/tool-result', async ({ params, json }) => {
    try {
        const threadId = decodeURIComponent(params.threadId);
        const memory = mastra.memory;
    
        const { toolName, toolArgs } = await json();
    
        if (!memory) {
            return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
    
        const { ok, errorResponse } = await validateBody({ toolName, toolArgs });
    
        if (!ok) {
            return new Response(JSON.stringify({ error: errorResponse }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
    
        const thread = await memory.getThreadById({ threadId });

        if (!thread) {
            return new Response(JSON.stringify({ error: 'Thread not found' }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        const result = await memory.getToolResult({ threadId, toolName, toolArgs });
        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error getting tool result from memory', error);
        return new Response(JSON.stringify({ error: error?.message || 'Error getting tool result from memory' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
});

router.post('/memory/validate-tool-call-args', async ({ json }) => {
    try {
        const memory = mastra.memory;
    
        const { hashedArgs } = await json();
    
        if (!memory) {
            return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
    
        const { ok, errorResponse } = await validateBody({ hashedArgs });
    
        if (!ok) {
            return new Response(JSON.stringify({ error: errorResponse }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
    
        const result = await memory.validateToolCallArgs({ hashedArgs });
        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error validating tool call args', error);
        return new Response(JSON.stringify({ error: error?.message || 'Error validating tool call args' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
});

router.post('/syncs/:syncId/execute', async ({ params, json }) => {   
    try {
        const syncId = params.syncId;
        const { runId, params } = await json();
        const { ok, errorResponse } = await validateBody({ params });
        if (!ok) {
            return new Response(JSON.stringify({ error: errorResponse }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        const result = await mastra.sync(syncId, params, runId);
        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error executing sync', error);
        return new Response(JSON.stringify({ error: error?.message ||'Error executing sync' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
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
