import { Agent } from '@mastra/core';
import { AutoRouter } from 'itty-router';
import { join } from 'path';
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

interface IRequest extends Request {
  params: Record<string, any>;
  query: Record<string, any>;
  json: () => Promise<any>;
}

interface ValidationResult {
  ok: boolean;
  errorResponse?: Record<string, string>;
}

interface ApiError extends Error {
  message: string;
  status?: number;
}

interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

const router = AutoRouter();

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

router.get('/', () => {
  return new Response('Hello to the Mastra API!', {
    headers: { 'Content-Type': 'text/plain' },
  });
});

router.get('/api/agents', async () => {
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
    return new Response(JSON.stringify(serializedAgents), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting agents', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error getting agents' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.get('/api/agents/:agentId', ({ params }: IRequest) => {
  try {
    const agentId = decodeURIComponent(params.agentId);
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
    return new Response(
      JSON.stringify({
        ...agent,
        tools: serializedAgentTools,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting agent', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error getting agent' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.post('/api/agents/:agentId/generate', async ({ params, json }: IRequest) => {
  try {
    const agentId = decodeURIComponent(params.agentId);
    const agent = mastra.getAgent(agentId);
    const { messages, threadId, resourceid } = await json();

    const { ok, errorResponse } = await validateBody({ messages });

    if (!ok) {
      return new Response(JSON.stringify({ error: errorResponse }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: { messages: 'Messages should be an array' } }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const result = await agent.generate(messages, { threadId, resourceid });
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error texting from agent', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error texting from agent' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.post('/api/agents/:agentId/stream', async ({ params, json }: IRequest) => {
  try {
    const agentId = decodeURIComponent(params.agentId);
    const agent = mastra.getAgent(agentId);
    const { messages, threadId, resourceid } = await json();

    const { ok, errorResponse } = await validateBody({ messages });

    if (!ok) {
      return new Response(JSON.stringify({ error: errorResponse }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: { messages: 'Messages should be an array' } }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const streamResult = await agent.stream(messages, { threadId, resourceid });

    return streamResult.toDataStreamResponse({
      headers: {
        'Content-Type': 'text/x-unknown',
        'content-encoding': 'identity',
        'transfer-encoding': 'chunked',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error streaming from agent', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error streaming from agent' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.post('/api/agents/:agentId/text-object', async ({ params, json }: IRequest) => {
  try {
    const agentId = decodeURIComponent(params.agentId);
    const agent = mastra.getAgent(agentId);
    const { messages, schema, threadId, resourceid } = await json();

    const { ok, errorResponse } = await validateBody({
      messages,
      schema,
    });

    if (!ok) {
      return new Response(JSON.stringify({ error: errorResponse }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: { messages: 'Messages should be an array' } }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const result = await agent.generate(messages, { output: schema, threadId, resourceid });
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting structured output from agent', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error getting structured output from agent' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.post('/api/agents/:agentId/stream-object', async ({ params, json }: IRequest) => {
  try {
    const agentId = decodeURIComponent(params.agentId);
    const agent: Agent = mastra.getAgent(agentId);
    const { messages, schema, threadId, resourceid } = await json();

    const { ok, errorResponse } = await validateBody({
      messages,
      schema,
    });

    if (!ok) {
      return new Response(JSON.stringify({ error: errorResponse }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: { messages: 'Messages should be an array' } }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const streamResult = await agent.stream(messages, { output: schema, threadId, resourceid });

    return streamResult.toTextStreamResponse({
      headers: {
        'Content-Type': 'text/x-unknown',
        'content-encoding': 'identity',
        'transfer-encoding': 'chunked',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error streaming structured output from agent', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error streaming structured output from agent' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.post('/api/agents/:agentId/tools/:toolId/execute', async ({ params, json }: IRequest) => {
  try {
    const agentId = decodeURIComponent(params.agentId);
    const toolId = decodeURIComponent(params.toolId);
    const agent = mastra.getAgent(agentId);
    const tool = Object.values(agent?.tools || {}).find((tool: any) => tool.id === toolId) as any;
    const body = await json();
    const result = await tool.execute({
      context: {
        ...body,
      },
      mastra,
      runId: agentId,
    });
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error executing tool', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error executing tool' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.get('/api/workflows', async () => {
  try {
    const workflows = mastra.getWorkflows({ serialized: true });

    return new Response(JSON.stringify(workflows), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting workflows', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error getting workflows' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.get('/api/workflows/:workflowId', async ({ params }: IRequest) => {
  try {
    const workflowId = decodeURIComponent(params.workflowId);
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
    return new Response(
      JSON.stringify({
        name: workflow.name,
        triggerSchema: triggerSchema ? stringify(zodToJsonSchema(triggerSchema)) : undefined,
        steps: serializedSteps,
        stepGraph,
        stepSubscriberGraph,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting workflow', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error getting workflow' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.post('/workflows/:workflowId/execute', async ({ params, json }: IRequest) => {
  try {
    const workflowId = decodeURIComponent(params.workflowId);
    const workflow = mastra.getWorkflow(workflowId);
    const body = await json();
    const result = await workflow.execute(body);

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error executing workflow', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error executing workflow' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.get('/api/memory/status', async () => {
  try {
    const memory = mastra.memory;

    if (!memory) {
      return new Response(JSON.stringify({ result: false }), {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    return new Response(JSON.stringify({ result: true }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting memory status', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error getting memory status' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.get('/api/memory/threads', async ({ query }: IRequest) => {
  try {
    const { resourceid } = query;
    const memory = mastra.memory;

    if (!memory) {
      return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    const threads = await memory.getThreadsByResourceId({ resourceid });
    return new Response(JSON.stringify(threads), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting threads from memory', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error getting threads from memory' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.get('/api/memory/threads/:threadId', async ({ params }: IRequest) => {
  try {
    const threadId = decodeURIComponent(params.threadId);
    const memory = mastra.memory;

    if (!memory) {
      return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    const thread = await memory.getThreadById({ threadId });
    if (!thread) {
      return new Response(JSON.stringify({ error: 'Thread not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    return new Response(JSON.stringify(thread), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting thread from memory', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error getting thread from memory' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.post('/api/memory/threads', async ({ json }: IRequest) => {
  try {
    const memory = mastra.memory;
    const { title, metadata, resourceid, threadId } = await json();

    if (!memory) {
      return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const { ok, errorResponse } = await validateBody({ resourceid });

    if (!ok) {
      return new Response(JSON.stringify({ error: errorResponse }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    const result = await memory.createThread({ resourceid, title, metadata, threadId });
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error saving thread to memory', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error saving thread to memory' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.patch('/api/memory/threads/:threadId', async ({ params, json }: IRequest) => {
  try {
    const threadId = decodeURIComponent(params.threadId);
    const memory = mastra.memory;
    const { title, metadata, resourceid } = await json();
    const updatedAt = new Date();

    if (!memory) {
      return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    const thread = await memory.getThreadById({ threadId });

    if (!thread) {
      return new Response(JSON.stringify({ error: 'Thread not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
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
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error saving thread to memory', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error saving thread to memory' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.delete('/api/memory/threads/:threadId', async ({ params }: IRequest) => {
  try {
    const threadId = decodeURIComponent(params.threadId);
    const memory = mastra.memory;
    if (!memory) {
      return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    const thread = await memory.getThreadById({ threadId });

    if (!thread) {
      return new Response(JSON.stringify({ error: 'Thread not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    await memory.deleteThread(threadId);
    return new Response(JSON.stringify({ result: 'Thread deleted' }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error deleting thread from memory', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error deleting thread from memory' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.get('/api/memory/threads/:threadId/messages', async ({ params }: IRequest) => {
  try {
    const threadId = decodeURIComponent(params.threadId);
    const memory = mastra.memory;

    if (!memory) {
      return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    const thread = await memory.getThreadById({ threadId });

    if (!thread) {
      return new Response(JSON.stringify({ error: 'Thread not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const result = await memory.getMessages({ threadId });
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting messages from memory', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error getting messages from memory' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.get('/api/memory/threads/:threadId/context-window', async ({ params, query }: IRequest) => {
  try {
    const threadId = decodeURIComponent(params.threadId);
    const { startDate, endDate, format } = query;
    const memory = mastra.memory;

    if (!memory) {
      return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    const thread = await memory.getThreadById({ threadId });

    if (!thread) {
      return new Response(JSON.stringify({ error: 'Thread not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const result = await memory.getContextWindow({ threadId, startDate, endDate, format });
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting context window from memory', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error getting context window from memory' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.post('/api/memory/save-messages', async ({ json }: IRequest) => {
  try {
    const memory = mastra.memory;
    const { messages } = await json();

    if (!memory) {
      return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const { ok, errorResponse } = await validateBody({ messages });

    if (!ok) {
      return new Response(JSON.stringify({ error: errorResponse }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: { messages: 'Messages should be an array' } }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const processMessages = messages.map(message => {
      return {
        ...message,
        id: memory.generateId(),
        createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
      };
    });
    const result = await memory.saveMessages({ messages: processMessages });
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error saving messages to memory', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error saving messages to memory' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.post('/api/memory/threads/:threadId/tool-result', async ({ params, json }: IRequest) => {
  try {
    const threadId = decodeURIComponent(params.threadId);
    const memory = mastra.memory;
    const { toolName, toolArgs } = await json();

    if (!memory) {
      return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const { ok, errorResponse } = await validateBody({ toolName, toolArgs });

    if (!ok) {
      return new Response(JSON.stringify({ error: errorResponse }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const thread = await memory.getThreadById({ threadId });

    if (!thread) {
      return new Response(JSON.stringify({ error: 'Thread not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const result = await memory.getToolResult({ threadId, toolName, toolArgs });
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting tool result from memory', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error getting tool result from memory' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.post('/api/memory/validate-tool-call-args', async ({ json }: IRequest) => {
  try {
    const memory = mastra.memory;
    const { hashedArgs } = await json();

    if (!memory) {
      return new Response(JSON.stringify({ error: 'Memory is not initialized' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const { ok, errorResponse } = await validateBody({ hashedArgs });

    if (!ok) {
      return new Response(JSON.stringify({ error: errorResponse }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const result = await memory.validateToolCallArgs({ hashedArgs });
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error validating tool call args', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error validating tool call args' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.post('/api/syncs/:syncId/execute', async ({ params, json }: IRequest) => {
  try {
    const syncId = decodeURIComponent(params.syncId);
    const { runId, params: syncParams } = await json();

    const { ok, errorResponse } = await validateBody({ params: syncParams });
    if (!ok) {
      return new Response(JSON.stringify({ error: errorResponse }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const result = await mastra.sync(syncId, syncParams, runId);
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error executing sync', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error executing sync' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.get('/api/logs', async () => {
  try {
    const logs = await mastra.getLogs();
    return new Response(JSON.stringify(logs), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting logs', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error getting logs' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.get('/api/logs/:runId', async ({ params }: IRequest) => {
  try {
    const runId = decodeURIComponent(params.runId);
    const logs = await mastra.getLogsByRunId(runId);
    return new Response(JSON.stringify(logs), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error getting logs', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error getting logs' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.get('/api/tools', async () => {
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
    return new Response(JSON.stringify(serializedTools), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } else {
    return new Response(JSON.stringify({}), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.get('/api/tools/:toolId', async ({ params }: IRequest) => {
  const toolId = decodeURIComponent(params.toolId);
  const tool = Object.values(tools || {}).find((tool: any) => tool.id === toolId) as any;
  if (tool) {
    const serializedTool = {
      ...tool,
      inputSchema: tool.inputSchema ? stringify(zodToJsonSchema(tool.inputSchema)) : undefined,
      outputSchema: tool.outputSchema ? stringify(zodToJsonSchema(tool.outputSchema)) : undefined,
    };
    return new Response(JSON.stringify(serializedTool), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } else {
    return new Response(JSON.stringify({ error: 'Tool not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

router.post('/api/tools/:toolId/execute', async ({ params, json }: IRequest) => {
  try {
    const toolId = decodeURIComponent(params.toolId);
    const tool = Object.values(tools || {}).find((tool: any) => tool.id === toolId) as any;
    if (!tool) {
      return new Response(JSON.stringify({ error: 'Tool not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    const { input } = await json();
    const result = await tool.execute({
      context: {
        ...input,
      },
      mastra,
      runId: mastra.runId,
    });
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const apiError = error as ApiError;
    console.error('Error executing tool', apiError);
    return new Response(JSON.stringify({ error: apiError.message || 'Error executing tool' }), {
      status: apiError.status || 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

// 404 handler
router.all('*', () => new Response('Not Found', { status: 404 }));

export default {
  async fetch(request: Request, env: Record<string, string>, ctx: ExecutionContext) {
    Object.entries(env || {}).forEach(([key, value]) => {
      process.env[key] = value;
    });

    return router.fetch(request, env, ctx);
  },
};
