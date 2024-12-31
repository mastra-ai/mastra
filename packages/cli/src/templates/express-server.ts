import express, { Request, Response } from 'express';
import expressJSDocSwagger, { Options } from 'express-jsdoc-swagger';
import _path, { join } from 'path';
import serverless from 'serverless-http';
import { stringify } from 'superjson';
import { fileURLToPath as _fileURLToPath } from 'url';
import { pathToFileURL } from 'url';
import zodToJsonSchema from 'zod-to-json-schema';

const ___filename = _fileURLToPath(import.meta.url);
const ___dirname = _path.dirname(___filename);

const mastraPath = pathToFileURL(join(process.cwd(), 'mastra.mjs')).href;
const { mastra } = await import(mastraPath);

const mastraToolsPaths = process.env.MASTRA_TOOLS_PATH;

const toolImports = mastraToolsPaths
  ? await Promise.all(
      mastraToolsPaths.split(',').map(async toolPath => {
        return import(pathToFileURL(toolPath).href);
      }),
    )
  : [];

const tools = toolImports.reduce((acc, toolModule) => {
  Object.entries(toolModule).forEach(([key, tool]) => {
    acc[key] = tool;
  });
  return acc;
}, {});

const app = express();

app.use(express.json());

// Swagger configuration
const options: Options = {
  info: {
    version: '1.0.0',
    title: 'Mastra API',
    description: 'API documentation for Mastra agent, sync, memory and workflow operations',
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
  baseDir: ___dirname,
  filesPattern: './**/*.mjs',
  exposeSwaggerUI: false,
  exposeApiDocs: true,
  apiDocsPath: '/openapi.json',
  notRequiredAsNullable: false,
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
 * GET /api/agents/{agentId}
 * @summary Get agent by ID
 * @tags Agent
 * @param {string} agentId.path.required - Agent identifier
 * @return {object} 200 - Agent response
 * @return {Error} 500 - Server error
 */
app.get('/api/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const agent = mastra.getAgent(agentId);
    const serializedAgentTools = Object.entries(agent?.tools || {}).reduce<any>((acc, [key, tool]) => {
      const _tool = tool as any;
      acc[key] = {
        ..._tool,
        inputSchema: _tool.inputSchema ? stringify(zodToJsonSchema(_tool.inputSchema)) : undefined,
        outputSchema: _tool.outputSchema ? stringify(zodToJsonSchema(_tool.outputSchema)) : undefined,
      };
      return acc;
    }, {});
    res.json({
      ...agent,
      tools: serializedAgentTools,
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting agent', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error getting agent' });
    return;
  }
});

/**
 * GET /api/agents
 * @summary Get all agents
 * @tags Agent
 * @return {object} 200 - Agent response
 * @return {Error} 500 - Server error
 */
app.get('/api/agents', async (_req: Request, res: Response) => {
  try {
    const agents = mastra.getAgents();

    const serializedAgents = Object.entries(agents).reduce<any>((acc, [_id, _agent]) => {
      const agent = _agent as any;
      const serializedAgentTools = Object.entries(agent?.tools || {}).reduce<any>((acc, [key, tool]) => {
        const _tool = tool as any;
        acc[key] = {
          ..._tool,
          inputSchema: _tool.inputSchema ? stringify(zodToJsonSchema(_tool.inputSchema)) : undefined,
          outputSchema: _tool.outputSchema ? stringify(zodToJsonSchema(_tool.outputSchema)) : undefined,
        };
        return acc;
      }, {});
      acc[_id] = {
        ...agent,
        tools: serializedAgentTools,
      };
      return acc;
    }, {});
    res.json(serializedAgents);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting agents', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error getting agents' });
    return;
  }
});

/**
 * POST /api/agents/{agentId}/generate
 * @summary Send text messages to agent
 * @tags Agent
 * @param {string} agentId.path.required - Agent identifier
 * @param {Messages} request.body.required - Messages to send
 * @return {object} 200 - Agent response
 * @return {Error} 400 - Validation error
 * @return {Error} 500 - Server error
 */
app.post('/api/agents/:agentId/generate', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const agent = mastra.getAgent(agentId);
    const { messages, threadId, resourceid } = req.body;
    const { ok, errorResponse } = await validateBody({
      messages,
    });

    if (!ok) {
      res.status(400).json({ error: errorResponse });
      return;
    }

    const result = await agent.generate(messages, { threadId, resourceid });
    res.json(result);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error texting from agent', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error texting from agent' });
    return;
  }
});

/**
 * POST /api/agents/{agentId}/stream
 * @summary Stream messages to agent
 * @tags Agent
 * @param {string} agentId.path.required - Agent identifier
 * @param {Messages} request.body.required - Messages to stream
 * @return {stream} 200 - Agent response stream
 * @return {Error} 400 - Validation error
 * @return {Error} 500 - Server error
 */
app.post('/api/agents/:agentId/stream', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const agent = mastra.getAgent(agentId);
    const { messages, threadId, resourceid } = req.body;
    const { ok, errorResponse } = await validateBody({
      messages,
    });

    if (!ok) {
      res.status(400).json({ error: errorResponse });
      return;
    }

    const streamResult = await agent.stream(messages, {
      threadId,
      resourceid,
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
 * POST /api/agents/{agentId}/text-object
 * @summary Get structured output from agent
 * @tags Agent
 * @param {string} agentId.path.required - Agent identifier
 * @param {TextObjectRequest} request.body.required - Request with messages and schema spec
 * @return {object} 200 - Structured output response
 * @return {Error} 400 - Validation error
 * @return {Error} 500 - Server error
 */
app.post('/api/agents/:agentId/text-object', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const agent = mastra.getAgent(agentId);
    const { messages, schema, threadId, resourceid } = req.body;

    const { ok, errorResponse } = await validateBody({
      messages,
      schema,
    });

    if (!ok) {
      res.status(400).json({ error: errorResponse });
      return;
    }

    const result = await agent.generate(messages, { output: schema, threadId, resourceid });
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
 * POST /api/agents/{agentId}/stream-object
 * @summary Stream structured output from agent
 * @tags Agent
 * @param {string} agentId.path.required - Agent identifier
 * @param {TextObjectRequest} request.body.required - Request with messages and schema spec
 * @return {stream} 200 - Structured output stream
 * @return {Error} 400 - Validation error
 * @return {Error} 500 - Server error
 */
app.post('/api/agents/:agentId/stream-object', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const agent = mastra.getAgent(agentId);
    const { messages, schema, threadId, resourceid } = req.body;

    const { ok, errorResponse } = await validateBody({
      messages,
      schema,
    });

    if (!ok) {
      res.status(400).json({ error: errorResponse });
      return;
    }

    const streamResult = await agent.stream(messages, { output: schema, threadId, resourceid });

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
 * POST /api/agents/{agentId}/tools/{toolId}/execute
 * @summary Execute an Agent tool
 * @tags Agent
 * @param {string} agentId.path.required - Agent identifier
 * @param {string} toolId.path.required - Tool identifier
 * @param {object} request.body.required - Tool input data
 * @return {object} 200 - Tool execution result
 * @return {Error} 500 - Server error
 */
app.post('/api/agents/:agentId/tools/:toolId/execute', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const toolId = req.params.toolId;
    const agent = mastra.getAgent(agentId);
    const tool = Object.values(agent?.tools || {}).find((tool: any) => tool.id === toolId) as any;
    const result = await tool.execute({
      context: {
        ...req.body,
      },
      mastra,
      runId: agentId,
    });
    res.json(result);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error executing tool', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error executing tool' });
    return;
  }
});

/**
 * GET /api/workflows
 * @summary Get all workflows
 * @tags Workflow
 * @return {object} 200 - Workflows response
 * @return {Error} 500 - Server error
 */
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

/**
 * GET /api/workflows/{workflowId}
 * @summary Get a workflow
 * @tags Workflow
 * @param {string} workflowId.path.required - Workflow identifier
 * @return {object} 200 - Workflow response
 * @return {Error} 500 - Server error
 */
app.get('/api/workflows/:workflowId', async (req: Request, res: Response) => {
  try {
    const workflowId = req.params.workflowId;
    const workflow = mastra.getWorkflow(workflowId);
    const triggerSchema = workflow.triggerSchema;
    const stepGraph = workflow.stepGraph;
    const stepSubscriberGraph = workflow.stepSubscriberGraph;
    const serializedSteps = Object.entries(workflow.steps).reduce<any>((acc, [key, step]) => {
      const _step = step as any;
      acc[key] = {
        ..._step,
        inputSchema: _step.inputSchema ? stringify(zodToJsonSchema(_step.inputSchema)) : undefined,
        outputSchema: _step.outputSchema ? stringify(zodToJsonSchema(_step.outputSchema)) : undefined,
      };
      return acc;
    }, {});
    res.json({
      ...workflow,
      triggerSchema: triggerSchema ? stringify(zodToJsonSchema(triggerSchema)) : undefined,
      steps: serializedSteps,
      stepGraph,
      stepSubscriberGraph,
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting workflow', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error getting workflow' });
    return;
  }
});

/**
 * POST /api/workflows/{workflowId}/execute
 * @summary Execute a workflow
 * @tags Workflow
 * @param {string} workflowId.path.required - Workflow identifier
 * @param {object} request.body.required - Workflow input data
 * @return {object} 200 - Workflow execution result
 * @return {Error} 500 - Server error
 */
app.post('/api/workflows/:workflowId/execute', async (req: Request, res: Response) => {
  try {
    const workflowId = req.params.workflowId;
    const workflow = mastra.getWorkflow(workflowId);
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
 * GET /api/memory/status
 * @summary Get memory status
 * @tags Memory
 * @return {object} 200 - Memory status
 * @return {Error} 500 - Server error
 */
app.get('/api/memory/status', async (_req: Request, res: Response) => {
  try {
    const memory = mastra.memory;

    if (!memory) {
      res.json({ result: false });
      return;
    }
    res.json({ result: true });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting memory status', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error getting memory status' });
    return;
  }
});

/**
 * GET /api/memory/threads
 * @summary Get threads
 * @tags Memory
 * @param {string} resourceid.query.required - Resource identifier
 * @return {Thread[]} 200 - Array of threads
 * @return {Error} 400 - Memory not initialized
 * @return {Error} 500 - Server error
 */
app.get('/api/memory/threads', async (req: Request, res: Response) => {
  try {
    const resourceid = req.query.resourceid as string;
    const memory = mastra.memory;

    if (!memory) {
      res.status(400).json({ error: 'Memory is not initialized' });
      return;
    }

    const { ok, errorResponse } = await validateBody({ resourceid });

    if (!ok) {
      res.status(400).json({ error: errorResponse });
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
 * GET /api/memory/threads/{threadId}
 * @summary Get thread by ID
 * @tags Memory
 * @param {string} threadId.path.required - Thread identifier
 * @return {Thread} 200 - Thread details
 * @return {Error} 400 - Memory not initialized
 * @return {Error} 404 - Thread not found
 * @return {Error} 500 - Server error
 */
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

/**
 * POST /api/memory/threads
 * @summary Create a new thread
 * @tags Memory
 * @param {Thread} request.body.required - Thread details
 * @return {Thread} 200 - Thread created successfully
 * @return {Error} 400 - Memory not initialized or validation error
 * @return {Error} 500 - Server error
 */
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

/**
 * PATCH /api/memory/threads/{threadId}
 * @summary Update thread details
 * @tags Memory
 * @param {string} threadId.path.required - Thread identifier
 * @param {object} request.body - Thread update data
 * @param {string} request.body.title - Thread title
 * @param {object} request.body.metadata - Thread metadata
 * @param {string} request.body.resourceid - Resource identifier
 * @return {Thread} 200 - Updated thread
 * @return {Error} 400 - Memory not initialized
 * @return {Error} 404 - Thread not found
 * @return {Error} 500 - Server error
 */
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

/**
 * DELETE /api/memory/threads/{threadId}
 * @summary Delete a thread
 * @tags Memory
 * @param {string} threadId.path.required - Thread identifier
 * @return {object} 200 - Deletion confirmation
 * @return {Error} 400 - Memory not initialized
 * @return {Error} 404 - Thread not found
 * @return {Error} 500 - Server error
 */
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

/**
 * GET /api/memory/threads/{threadId}/messages
 * @summary Get messages from a thread
 * @tags Memory
 * @param {string} threadId.path.required - Thread identifier
 * @return {Message[]} 200 - Array of messages
 * @return {Error} 400 - Memory not initialized
 * @return {Error} 404 - Thread not found
 * @return {Error} 500 - Server error
 */
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

/**
 * GET /api/memory/threads/{threadId}/context-window
 * @summary Get context window for a thread
 * @tags Memory
 * @param {string} threadId.path.required - Thread identifier
 * @param {string} startDate.query - Start date for context window
 * @param {string} endDate.query - End date for context window
 * @param {string} format.query - Output format
 * @return {object} 200 - Context window data
 * @return {Error} 400 - Memory not initialized
 * @return {Error} 404 - Thread not found
 * @return {Error} 500 - Server error
 */
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

/**
 * POST /api/memory/save-messages
 * @summary Save messages to memory
 * @tags Memory
 * @param {Message[]} request.body.required - Array of messages to save
 * @return {object} 200 - Save confirmation
 * @return {Error} 400 - Memory not initialized or validation error
 * @return {Error} 500 - Server error
 */
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

/**
 * POST /api/memory/threads/{threadId}/tool-result
 * @summary Get tool execution result
 * @tags Memory
 * @param {string} threadId.path.required - Thread identifier
 * @param {object} request.body.required - Tool execution details
 * @param {string} request.body.toolName.required - Name of the tool
 * @param {object} request.body.toolArgs.required - Tool arguments
 * @return {object} 200 - Tool execution result
 * @return {Error} 400 - Memory not initialized or validation error
 * @return {Error} 404 - Thread not found
 * @return {Error} 500 - Server error
 */
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

/**
 * POST /api/memory/validate-tool-call-args
 * @summary Validate tool call arguments
 * @tags Memory
 * @param {object} request.body.required - Validation request
 * @param {string} request.body.hashedArgs.required - Hashed tool arguments
 * @return {object} 200 - Validation result
 * @return {Error} 400 - Memory not initialized or validation error
 * @return {Error} 500 - Server error
 */
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
 * POST /api/syncs/{syncId}/execute
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

/**
 * GET /api/logs
 * @summary Get logs
 * @tags Logs
 * @return {string[]} 200 - Array of logs
 * @return {Error} 500 - Server error
 */
app.get('/api/logs', async (_req: Request, res: Response) => {
  try {
    const logs = await mastra.getLogs();
    res.json(logs);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting logs', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error getting logs' });
    return;
  }
});

/**
 * GET /api/logs/{runId}
 * @summary Get logs
 * @tags Logs
 * @return {string[]} 200 - Array of logs
 * @return {Error} 500 - Server error
 */
app.get('/api/logs/:runId', async (req: Request, res: Response) => {
  try {
    const runId = req.params.runId;
    const logs = await mastra.getLogsByRunId(runId);
    res.json(logs);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting logs', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error getting logs' });
    return;
  }
});

/**
 * GET /api/tools
 * @summary Get tools
 * @tags Tools
 * @return {object} 200 - Tools with schemas
 * @return {Error} 404 - Tools not found
 */
app.get('/api/tools', async (_req: Request, res: Response) => {
  if (tools) {
    const serializedTools = Object.entries(tools).reduce(
      (acc, [id, _tool]) => {
        const tool = _tool as any;
        acc[id] = {
          ...tool,
          inputSchema: tool.inputSchema ? stringify(zodToJsonSchema(tool.inputSchema)) : undefined,
          outputSchema: tool.outputSchema ? stringify(zodToJsonSchema(tool.outputSchema)) : undefined,
        };
        return acc;
      },
      {} as Record<string, any>,
    );
    res.json(serializedTools);
  } else {
    res.status(200).json({});
  }
});

/**
 * GET /api/tools/{toolId}
 * @summary Get tool
 * @tags Tools
 * @param {string} toolId.path.required - Tool identifier
 * @return {object} 200 - Tool with schemas
 * @return {Error} 404 - Tool not found
 */
app.get('/api/tools/:toolId', async (req: Request, res: Response) => {
  const toolId = req.params.toolId;
  const tool = Object.values(tools || {}).find((tool: any) => tool.id === toolId) as any;
  if (tool) {
    const serializedTool = {
      ...tool,
      inputSchema: tool.inputSchema ? stringify(zodToJsonSchema(tool.inputSchema)) : undefined,
      outputSchema: tool.outputSchema ? stringify(zodToJsonSchema(tool.outputSchema)) : undefined,
    };
    res.json(serializedTool);
  } else {
    res.status(404).json({ error: 'Tool not found' });
  }
});

/**
 * POST /api/tools/{toolId}/execute
 * @summary Execute a tool
 * @tags Tools
 * @param {string} toolId.path.required - Tool identifier
 * @return {object} 200 - Tool execution result
 * @return {Error} 404 - Tool not found
 */
app.post('/api/tools/:toolId/execute', async (req: Request, res: Response) => {
  try {
    const toolId = req.params.toolId;
    const tool = Object.values(tools || {}).find((tool: any) => tool.id === toolId) as any;
    if (!tool) {
      res.status(404).json({ error: 'Tool not found' });
      return;
    }
    const { input } = req.body;
    const result = await tool.execute({
      context: {
        ...input,
      },
      mastra,
      runId: mastra.runId,
    });
    res.json(result);
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error executing tool', apiError);
    res.status(apiError.status || 500).json({ error: apiError.message || 'Error executing tool' });
    return;
  }
});

// serve static files for playground
app.use(
  '/assets',
  express.static(join(__dirname, 'playground/assets'), {
    setHeaders: (res: Response, path: string) => {
      // Set correct MIME types
      if (path.endsWith('.js')) {
        res.set('Content-Type', 'application/javascript');
      } else if (path.endsWith('.css')) {
        res.set('Content-Type', 'text/css');
      }
    },
  }),
);

// Serve other static files
app.use(express.static(join(__dirname, 'playground')));

/**
 * GET /playground
 * @summary Serve playground
 * @tags System
 * @return  {html} 200 - Playground
 */
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(join(__dirname, 'playground/index.html'));
});

export const handler = serverless(app);

app.listen(process.env.PORT || 4111, () => {
  console.log(`🦄Server running on port ${process.env.PORT || 4111}`);
  console.log(`📚 Open API documentation available at http://localhost:${process.env.PORT || 4111}/openapi.json`);
  console.log(`👨‍💻 Playground available at http://localhost:${process.env.PORT || 4111}/`);
});

export default handler;
