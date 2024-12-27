import express, { Request, Response } from 'express';
import { join } from 'path';
import serverless from 'serverless-http';
import { stringify } from 'superjson';
import zodToJsonSchema from 'zod-to-json-schema';

const { mastra } = await import(join(process.cwd(), 'mastra.mjs'));

const app = express();

app.use(express.json());

interface ValidationResult {
  ok: boolean;
  errorResponse?: Record<string, string>;
}

interface ApiError extends Error {
  message: string;
  status?: number;
}

const validateBody = async (body: Record<string, unknown>): Promise<ValidationResult> => {
  const errorResponse = Object.entries(body).reduce<Record<string, string>>((acc, [key, value]) => {
    if (!value) {
      acc[key] = `${key} is required`;
    }
    return acc;
  }, {});

  if (Object.keys(errorResponse).length > 0) {
    return { ok: false, errorResponse };
  }

  return { ok: true };
};

app.get('/', (_req: Request, res: Response) => {
  res.send('Hello World!');
});

app.get('/api/agents', async (_req: Request, res: Response) => {
  try {
    const agents = mastra.getAgents();
    res.json(agents);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting agents', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error getting agents' });
    return;
  }
});

app.get('/api/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const agent = mastra.getAgent(agentId);
    res.json(agent);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting agent', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error getting agent' });
    return;
  }
});

app.post('/api/agents/:agentId/text', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const agent = mastra.getAgent(agentId);
    const messages = req.body.messages;
    const { ok, errorResponse } = await validateBody({
      messages,
    });

    if (!ok) {
      res.status(400).json({ error: errorResponse });
      return;
    }

    if (!Array.isArray(messages)) {
      res.status(400).json({ error: { messages: 'Messages should be an array' } });
      return;
    }

    const result = await agent.generate(messages);
    res.json(result);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error texting from agent', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error texting from agent' });
    return;
  }
});

app.post('/api/agents/:agentId/stream', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const agent = mastra.getAgent(agentId);
    const messages = req.body.messages;
    const { ok, errorResponse } = await validateBody({
      messages,
    });

    if (!ok) {
      res.status(400).json({ error: errorResponse });
      return;
    }

    if (!Array.isArray(messages)) {
      res.status(400).json({ error: { messages: 'Messages should be an array' } });
      return;
    }

    const streamResult = await agent.generate(messages, { stream: true });

    streamResult.pipeDataStreamToResponse(res);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error streaming from agent', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error streaming from agent' });
    return;
  }
});

app.post('/api/agents/:agentId/text-object', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const agent = mastra.getAgent(agentId);
    const messages = req.body.messages;
    const schema = req.body.schema;

    const { ok, errorResponse } = await validateBody({
      messages,
      schema,
    });

    if (!ok) {
      res.status(400).json({ error: errorResponse });
      return;
    }

    if (!Array.isArray(messages)) {
      res.status(400).json({ error: { messages: 'Messages should be an array' } });
      return;
    }

    const result = await agent.generate(messages, { schema });
    res.json(result);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting structured output from agent', apiError);
    res
      .status(apiError.status || 500)
      .json({ error: apiError.message || 'Error getting structured output from agent' });
    return;
  }
});

app.post('/api/agents/:agentId/stream-object', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const agent = mastra.getAgent(agentId);
    const messages = req.body.messages;
    const schema = req.body.schema;

    const { ok, errorResponse } = await validateBody({
      messages,
      schema,
    });

    if (!ok) {
      res.status(400).json({ error: errorResponse });
      return;
    }

    if (!Array.isArray(messages)) {
      res.status(400).json({ error: { messages: 'Messages should be an array' } });
      return;
    }

    const streamResult = await agent.generate(messages, { schema, stream: true });

    streamResult.pipeTextStreamToResponse(res);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error streaming structured output from agent', apiError);
    res
      .status(apiError.status || 500)
      .json({ error: apiError.message || 'Error streaming structured output from agent' });
    return;
  }
});

app.get('/api/workflows', async (_req: Request, res: Response) => {
  try {
    const workflows = mastra.getWorkflows();
    res.json(workflows);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting workflows', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error getting workflows' });
    return;
  }
});

app.get('/api/workflows/:workflowId', async (req: Request, res: Response) => {
  try {
    const workflowId = req.params.workflowId;
    const workflow = mastra.getWorkflow(workflowId);
    const triggerSchema = workflow.triggerSchema;
    res.json({
      ...workflow,
      triggerSchema: triggerSchema ? stringify(zodToJsonSchema(triggerSchema)) : undefined,
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting workflow', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error getting workflow' });
    return;
  }
});

app.post('/api/workflows/:workflowId/execute', async (req: Request, res: Response) => {
  try {
    const workflowId = req.params.workflowId;
    const workflow = mastra.workflows.get(workflowId);
    console.log('req.body', req.body);
    const result = await workflow.execute(req.body);
    res.json(result);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error executing workflow', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error executing workflow' });
    return;
  }
});

app.get('/api/memory/threads/get-by-resourceid/:resourceid', async (req: Request, res: Response) => {
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
    const apiError = error as ApiError;
    console.error('Error getting threads from memory', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error getting threads from memory' });
    return;
  }
});

app.get('/api/memory/threads/:threadId', async (req: Request, res: Response) => {
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
    const apiError = error as ApiError;
    console.error('Error getting thread from memory', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error getting thread from memory' });
    return;
  }
});

app.post('/api/memory/threads', async (req: Request, res: Response) => {
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
    const apiError = error as ApiError;
    console.error('Error saving thread to memory', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error saving thread to memory' });
    return;
  }
});

app.patch('/api/memory/threads/:threadId', async (req: Request, res: Response) => {
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
    };
    const result = await memory.saveThread({ thread: updatedThread });
    res.json(result);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error saving thread to memory', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error saving thread to memory' });
    return;
  }
});

app.delete('/api/memory/threads/:threadId', async (req: Request, res: Response) => {
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

    await memory.deleteThread(threadId);
    res.json({ result: 'Thread deleted' });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error deleting thread from memory', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error deleting thread from memory' });
    return;
  }
});

app.get('/api/memory/threads/:threadId/messages', async (req: Request, res: Response) => {
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
    const apiError = error as ApiError;
    console.error('Error getting messages from memory', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error getting messages from memory' });
    return;
  }
});

app.get('/api/memory/threads/:threadId/context-window', async (req: Request, res: Response) => {
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
    const apiError = error as ApiError;
    console.error('Error getting context window from memory', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error getting context window from memory' });
    return;
  }
});

app.post('/api/memory/save-messages', async (req: Request, res: Response) => {
  try {
    const memory = mastra.memory;
    const messages = req.body;

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
      res.status(400).json({ error: { messages: 'Messages should be an array' } });
      return;
    }

    const processMessages = messages.map(message => {
      return {
        ...message,
        id: memory.generateId(),
        createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
      };
    });
    const result = await memory.saveMessages({ messages: processMessages });
    res.json(result);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error saving messages to memory', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error saving messages to memory' });
    return;
  }
});

app.post('/api/memory/threads/:threadId/tool-result', async (req: Request, res: Response) => {
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
    const apiError = error as ApiError;
    console.error('Error getting tool result from memory', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error getting tool result from memory' });
    return;
  }
});

app.post('/api/memory/validate-tool-call-args', async (req: Request, res: Response) => {
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
    const apiError = error as ApiError;
    console.error('Error validating tool call args', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error validating tool call args' });
    return;
  }
});

/**
 * POST /syncs/{syncId}/execute
 * @summary Execute a sync operation
 * @tags Sync
 * @param {string} syncId.path.required - Sync identifier
 * @param {object} request.body.required - Sync parameters
 * @param {string} request.body.runId - Run identifier
 * @param {object} request.body.params - Sync parameters
 * @return {object} 200 - Sync execution result
 * @return {Error} 400 - Validation error
 * @return {Error} 500 - Server error
 */
app.post('/api/syncs/:syncId/execute', async (req: Request, res: Response) => {
  try {
    const syncId = req.params.syncId;
    const { runId, params } = req.body;

    const { ok, errorResponse } = await validateBody({ params });
    if (!ok) {
      res.status(400).json({ error: errorResponse });
      return;
    }

    const result = await mastra.sync(syncId, params, runId);
    res.json(result);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error executing sync', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error executing sync' });
    return;
  }
});

export const handler = serverless(app);
