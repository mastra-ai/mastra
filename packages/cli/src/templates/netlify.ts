import express, { Request, Response } from 'express';
import { join } from 'path';
import serverless from 'serverless-http';
import { stringify } from 'superjson';
import { pathToFileURL } from 'url';
import zodToJsonSchema from 'zod-to-json-schema';

const { mastra } = await import(join(process.cwd(), 'mastra.mjs'));

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

app.post('/api/agents/:agentId/text', async (req: Request, res: Response) => {
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

    const streamResult = await agent.generate(messages, {
      stream: true,
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

    const result = await agent.generate(messages, { schema, threadId, resourceid });
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
    const { messages, schema, threadId, resourceid } = req.body;

    const { ok, errorResponse } = await validateBody({
      messages,
      schema,
    });

    if (!ok) {
      res.status(400).json({ error: errorResponse });
      return;
    }

    const streamResult = await agent.generate(messages, { schema, stream: true, threadId, resourceid });

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

export const handler = serverless(app);
