import express, { Request, Response } from 'express';
import expressJSDocSwagger from 'express-jsdoc-swagger';
import { join } from 'path';
import serverless from 'serverless-http';

const { mastra } = await import(join(process.cwd(), 'mastra.mjs'));

const app = express();

app.use(express.json());

// Swagger configuration
const options = {
  info: {
    version: '1.0.0',
    title: 'Mastra API',
    description: 'API documentation for Mastra agent and workflow operations',
  },
  security: {
    BasicAuth: {
      type: 'http',
      scheme: 'basic',
    },
  },
  servers: [
    {
      url: 'http://localhost:4111',
      description: 'Local server',
    },
  ],
  baseDir: __dirname,
  filesPattern: 'index.mjs',
  swaggerUIPath: '/openapi',
  exposeSwaggerUI: true,
  exposeApiDocs: true,
  apiDocsPath: '/openapi.json',
  notRequiredAsNullable: false,
  swaggerUiOptions: {},
};

expressJSDocSwagger(app)(options);

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

/**
 * GET /
 * @summary Health check endpoint
 * @tags System
 * @return {string} 200 - Health check response
 */
app.get('/', (_req: Request, res: Response) => {
  res.send('Hello World!');
});

/**
 * GET /agent/{agentId}
 * @summary Get agent information
 * @tags Agent
 * @param {string} agentId.path.required - Agent identifier
 * @return {Agent} 200 - Agent information
 */
app.get('/agent/:agentId', (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const agent = mastra.getAgent(agentId);

    res.json({
      agentId: agent.name,
      enabledTools: agent.enabledTools,
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting agent', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error getting agent' });
    return;
  }
});

/**
 * POST /agent/{agentId}/text
 * @summary Send text messages to agent
 * @tags Agent
 * @param {string} agentId.path.required - Agent identifier
 * @param {Messages} request.body.required - Messages to send
 * @return {object} 200 - Agent response
 */
app.post('/agent/:agentId/text', async (req: Request, res: Response) => {
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

    const result = await agent.text({ messages });
    res.json(result);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error texting from agent', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error texting from agent' });
    return;
  }
});
/**
 * POST /agent/{agentId}/stream
 * @summary Stream messages to agent
 * @tags Agent
 * @param {string} agentId.path.required - Agent identifier
 * @param {Messages} request.body.required - Messages to stream
 * @return {stream} 200 - Agent response stream
 */
app.post('/agent/:agentId/stream', async (req: Request, res: Response) => {
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

    const streamResult = await agent.stream({
      messages,
    });

    streamResult.pipeDataStreamToResponse(res);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error streaming from agent', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error streaming from agent' });
    return;
  }
});

/**
 * POST /agent/{agentId}/text-object
 * @summary Get structured output from agent
 * @tags Agent
 * @param {string} agentId.path.required - Agent identifier
 * @param {TextObjectRequest} request.body.required - Request with messages and structured output spec
 * @return {object} 200 - Structured output response
 * @return {Error} 400 - Validation error
 * @return {Error} 500 - Server error
 */
app.post('/agent/:agentId/text-object', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const agent = mastra.getAgent(agentId);
    const messages = req.body.messages;
    const structuredOutput = req.body.structuredOutput;

    const { ok, errorResponse } = await validateBody({
      messages,
      structuredOutput,
    });

    if (!ok) {
      res.status(400).json({ error: errorResponse });
      return;
    }

    if (!Array.isArray(messages)) {
      res.status(400).json({ error: { messages: 'Messages should be an array' } });
      return;
    }

    const result = await agent.textObject({ messages, structuredOutput });
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

/**
 * POST /agent/{agentId}/stream-object
 * @summary Stream structured output from agent
 * @tags Agent
 * @param {string} agentId.path.required - Agent identifier
 * @param {TextObjectRequest} request.body.required - Request with messages and structured output spec
 * @return {stream} 200 - Structured output stream
 * @return {Error} 400 - Validation error
 * @return {Error} 500 - Server error
 */
app.post('/agent/:agentId/stream-object', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const agent = mastra.getAgent(agentId);
    const messages = req.body.messages;
    const structuredOutput = req.body.structuredOutput;

    const { ok, errorResponse } = await validateBody({
      messages,
      structuredOutput,
    });

    if (!ok) {
      res.status(400).json({ error: errorResponse });
      return;
    }

    if (!Array.isArray(messages)) {
      res.status(400).json({ error: { messages: 'Messages should be an array' } });
      return;
    }

    const streamResult = await agent.streamObject({
      messages,
      structuredOutput,
    });

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

/**
 * POST /workflows/{workflowId}/execute
 * @summary Execute a workflow
 * @tags Workflow
 * @param {string} workflowId.path.required - Workflow identifier
 * @param {object} request.body.required - Workflow input data
 * @return {object} 200 - Workflow execution result
 * @return {Error} 500 - Server error
 */
app.post('/workflows/:workflowId/execute', async (req: Request, res: Response) => {
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

/**
 * GET /memory/threads/get-by-resourceid/{resourceid}
 * @summary Get threads by resource ID
 * @tags Memory
 * @param {string} resourceid.path.required - Resource identifier
 * @return {Thread[]} 200 - Array of threads
 * @return {Error} 400 - Memory not initialized
 * @return {Error} 500 - Server error
 */
app.get('/memory/threads/get-by-resourceid/:resourceid', async (req: Request, res: Response) => {
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

/**
 * GET /memory/threads/{threadId}
 * @summary Get thread by ID
 * @tags Memory
 * @param {string} threadId.path.required - Thread identifier
 * @return {Thread} 200 - Thread details
 * @return {Error} 400 - Memory not initialized
 * @return {Error} 404 - Thread not found
 * @return {Error} 500 - Server error
 */
app.get('/memory/threads/:threadId', async (req: Request, res: Response) => {
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

/**
 * POST /memory/threads
 * @summary Create a new thread
 * @tags Memory
 * @param {Thread} request.body.required - Thread details
 * @return {Thread} 200 - Thread created successfully
 * @return {Error} 400 - Memory not initialized or validation error
 * @return {Error} 500 - Server error
 */
app.post('/memory/threads', async (req: Request, res: Response) => {
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

app.patch('/memory/threads/:threadId', async (req: Request, res: Response) => {
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

app.delete('/memory/threads/:threadId', async (req: Request, res: Response) => {
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

app.get('/memory/threads/:threadId/messages', async (req: Request, res: Response) => {
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

app.get('/memory/threads/:threadId/context-window', async (req: Request, res: Response) => {
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

app.post('/memory/save-messages', async (req: Request, res: Response) => {
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

app.post('/memory/threads/:threadId/tool-result', async (req: Request, res: Response) => {
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

app.post('/memory/validate-tool-call-args', async (req: Request, res: Response) => {
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

export const handler = serverless(app);

app.listen(process.env.PORT || 4111, () => {
  console.log(`🦄Server running on port ${process.env.PORT || 4111}`);
  console.log(`📚 Open API documentation available at http://localhost:${process.env.PORT || 4111}/openapi.json`);
});
