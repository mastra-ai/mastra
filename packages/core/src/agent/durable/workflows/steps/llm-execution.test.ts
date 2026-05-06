import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../../../../request-context';
import { setToolGateRuntimeStateForRun } from '../../../../tools/tool-gate';
import { MessageList } from '../../../message-list';
import { globalRunRegistry } from '../../run-registry';
import { createDurableLLMExecutionStep } from './llm-execution';

const RUN_ID = 'run-llm-tool-gate';

afterEach(() => {
  globalRunRegistry.delete(RUN_ID);
});

describe('durable LLM Tool Gate enforcement', () => {
  it('hides all tools when serialized Tool Gate state exists but runtime policy is unavailable', async () => {
    let modelToolNames: string[] = [];
    const model = new MockLanguageModelV2({
      doStream: async (options: any) => {
        modelToolNames = Array.isArray(options.tools)
          ? options.tools.map((tool: any) => tool.name)
          : Object.keys(options.tools ?? {});
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    const messageList = new MessageList();
    messageList.add('Use a tool', 'input');
    globalRunRegistry.set(RUN_ID, {
      tools: {
        public: { description: 'Allowed tool' },
        secret: { description: 'Denied tool' },
      },
      model: model as any,
      requestContext: new RequestContext(),
    } as any);

    const step = createDurableLLMExecutionStep();

    await (step as any).execute({
      inputData: {
        runId: RUN_ID,
        agentId: 'agent-1',
        agentName: 'Agent 1',
        messageListState: messageList.serialize(),
        toolsMetadata: [],
        modelConfig: {
          provider: 'mock',
          modelId: 'mock-model-id',
        },
        options: {},
        state: {
          toolGate: { policyId: 'missing-runtime-policy' },
        },
        messageId: 'message-1',
      },
      mastra: { getLogger: () => undefined },
      requestContext: new RequestContext(),
    });

    expect(modelToolNames).toEqual([]);
  });

  it('hides all tools when serialized Tool Gate policy does not match runtime policy', async () => {
    let modelToolNames: string[] = [];
    const model = new MockLanguageModelV2({
      doStream: async (options: any) => {
        modelToolNames = Array.isArray(options.tools)
          ? options.tools.map((tool: any) => tool.name)
          : Object.keys(options.tools ?? {});
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    const requestContext = new RequestContext();
    setToolGateRuntimeStateForRun(requestContext, RUN_ID, {
      policy: {
        id: 'wrong-runtime-policy',
        evaluate: async () => ({ effect: 'allow', reason: 'wrong policy allows everything' }),
      },
    });

    const messageList = new MessageList();
    messageList.add('Use a tool', 'input');
    globalRunRegistry.set(RUN_ID, {
      tools: {
        public: { description: 'Allowed tool' },
        secret: { description: 'Denied tool' },
      },
      model: model as any,
      requestContext,
    } as any);

    const step = createDurableLLMExecutionStep();

    await (step as any).execute({
      inputData: {
        runId: RUN_ID,
        agentId: 'agent-1',
        agentName: 'Agent 1',
        messageListState: messageList.serialize(),
        toolsMetadata: [],
        modelConfig: {
          provider: 'mock',
          modelId: 'mock-model-id',
        },
        options: {},
        state: {
          toolGate: { policyId: 'original-runtime-policy' },
        },
        messageId: 'message-1',
      },
      mastra: { getLogger: () => undefined },
      requestContext,
    });

    expect(modelToolNames).toEqual([]);
  });

  it('does not preserve a stale specific tool choice when Tool Gate denies that tool', async () => {
    let modelToolNames: string[] = [];
    let modelToolChoice: any;
    const model = new MockLanguageModelV2({
      doStream: async (options: any) => {
        modelToolNames = Array.isArray(options.tools)
          ? options.tools.map((tool: any) => tool.name)
          : Object.keys(options.tools ?? {});
        modelToolChoice = options.toolChoice;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    const requestContext = new RequestContext();
    setToolGateRuntimeStateForRun(requestContext, RUN_ID, {
      policy: {
        id: 'runtime-policy',
        evaluate: async ({ subject }) => ({
          effect: subject.toolName === 'secret' ? 'deny' : 'allow',
          reason: 'secret denied',
        }),
      },
    });

    const messageList = new MessageList();
    messageList.add('Use a tool', 'input');
    globalRunRegistry.set(RUN_ID, {
      tools: {
        public: { description: 'Allowed tool' },
        secret: { description: 'Denied tool' },
      },
      model: model as any,
      requestContext,
    } as any);

    const step = createDurableLLMExecutionStep();

    await (step as any).execute({
      inputData: {
        runId: RUN_ID,
        agentId: 'agent-1',
        agentName: 'Agent 1',
        messageListState: messageList.serialize(),
        toolsMetadata: [],
        modelConfig: {
          provider: 'mock',
          modelId: 'mock-model-id',
        },
        options: {
          toolChoice: { toolName: 'secret' },
        },
        state: {
          toolGate: { policyId: 'runtime-policy' },
        },
        messageId: 'message-1',
      },
      mastra: { getLogger: () => undefined },
      requestContext,
    });

    expect(modelToolNames).toEqual(['public']);
    expect(modelToolChoice).toEqual({ type: 'auto' });
  });

  it('hides provider-executed tools that require local approval', async () => {
    let modelToolNames: string[] = [];
    const model = new MockLanguageModelV2({
      doStream: async (options: any) => {
        modelToolNames = Array.isArray(options.tools)
          ? options.tools.map((tool: any) => tool.name)
          : Object.keys(options.tools ?? {});
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    const requestContext = new RequestContext();
    setToolGateRuntimeStateForRun(requestContext, RUN_ID, {
      policy: {
        id: 'runtime-policy',
        evaluate: async ({ subject }) =>
          subject.toolName === 'webSearch'
            ? { effect: 'requireApproval', reason: 'provider approval is local only' }
            : { effect: 'allow', reason: 'allowed' },
      },
    });

    const messageList = new MessageList();
    messageList.add('Use a tool', 'input');
    globalRunRegistry.set(RUN_ID, {
      tools: {
        localTool: { description: 'Allowed local tool' },
        webSearch: {
          type: 'provider-defined',
          id: 'openai.web_search',
          name: 'web_search',
        },
      },
      model: model as any,
      requestContext,
    } as any);

    const step = createDurableLLMExecutionStep();

    await (step as any).execute({
      inputData: {
        runId: RUN_ID,
        agentId: 'agent-1',
        agentName: 'Agent 1',
        messageListState: messageList.serialize(),
        toolsMetadata: [],
        modelConfig: {
          provider: 'mock',
          modelId: 'mock-model-id',
        },
        options: {},
        state: {
          toolGate: { policyId: 'runtime-policy' },
        },
        messageId: 'message-1',
      },
      mastra: { getLogger: () => undefined },
      requestContext,
    });

    expect(modelToolNames).toEqual(['localTool']);
  });

  it('does not adopt an ambient Tool Gate policy when durable state has no policy id', async () => {
    let modelToolNames: string[] = [];
    const model = new MockLanguageModelV2({
      doStream: async (options: any) => {
        modelToolNames = Array.isArray(options.tools)
          ? options.tools.map((tool: any) => tool.name)
          : Object.keys(options.tools ?? {});
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    const requestContext = new RequestContext();
    setToolGateRuntimeStateForRun(requestContext, RUN_ID, {
      policy: {
        id: 'ambient-policy',
        evaluate: async ({ subject }) => ({
          effect: subject.toolName === 'secret' ? 'deny' : 'allow',
          reason: 'ambient policy should not apply',
        }),
      },
    });

    const messageList = new MessageList();
    messageList.add('Use a tool', 'input');
    globalRunRegistry.set(RUN_ID, {
      tools: {
        public: { description: 'Allowed tool' },
        secret: { description: 'Denied tool' },
      },
      model: model as any,
      requestContext,
    } as any);

    const step = createDurableLLMExecutionStep();

    await (step as any).execute({
      inputData: {
        runId: RUN_ID,
        agentId: 'agent-1',
        agentName: 'Agent 1',
        messageListState: messageList.serialize(),
        toolsMetadata: [],
        modelConfig: {
          provider: 'mock',
          modelId: 'mock-model-id',
        },
        options: {},
        state: {},
        messageId: 'message-1',
      },
      mastra: { getLogger: () => undefined },
      requestContext,
    });

    expect(modelToolNames).toEqual(['public', 'secret']);
  });

  it('uses the registry request context instead of a transient step context for Tool Gate policy', async () => {
    let modelToolNames: string[] = [];
    const model = new MockLanguageModelV2({
      doStream: async (options: any) => {
        modelToolNames = Array.isArray(options.tools)
          ? options.tools.map((tool: any) => tool.name)
          : Object.keys(options.tools ?? {});
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    const registryRequestContext = new RequestContext();
    setToolGateRuntimeStateForRun(registryRequestContext, RUN_ID, {
      policy: {
        id: 'runtime-policy',
        evaluate: async ({ subject }) => ({
          effect: subject.toolName === 'secret' ? 'deny' : 'allow',
          reason: 'secret denied',
        }),
      },
    });

    const messageList = new MessageList();
    messageList.add('Use a tool', 'input');
    globalRunRegistry.set(RUN_ID, {
      tools: {
        public: { description: 'Allowed tool' },
        secret: { description: 'Denied tool' },
      },
      model: model as any,
      requestContext: registryRequestContext,
    } as any);

    const step = createDurableLLMExecutionStep();

    await (step as any).execute({
      inputData: {
        runId: RUN_ID,
        agentId: 'agent-1',
        agentName: 'Agent 1',
        messageListState: messageList.serialize(),
        toolsMetadata: [],
        modelConfig: {
          provider: 'mock',
          modelId: 'mock-model-id',
        },
        options: {},
        state: {
          toolGate: { policyId: 'runtime-policy' },
        },
        messageId: 'message-1',
      },
      mastra: { getLogger: () => undefined },
      requestContext: new RequestContext(),
    });

    expect(modelToolNames).toEqual(['public']);
  });

  it('passes the registry request context to durable LLM API error processors', async () => {
    const registryRequestContext = new RequestContext();
    let processedRequestContext: RequestContext | undefined;
    const processAPIError = vi.fn(async ({ requestContext }) => {
      processedRequestContext = requestContext;
      return undefined;
    });

    const messageList = new MessageList();
    messageList.add('Use a tool', 'input');
    globalRunRegistry.set(RUN_ID, {
      tools: {},
      model: { specificationVersion: 'v1' } as any,
      requestContext: registryRequestContext,
      errorProcessors: [{ id: 'capture-context', processAPIError }],
    } as any);

    const step = createDurableLLMExecutionStep();

    await expect(
      (step as any).execute({
        inputData: {
          runId: RUN_ID,
          agentId: 'agent-1',
          agentName: 'Agent 1',
          messageListState: messageList.serialize(),
          toolsMetadata: [],
          modelConfig: {
            provider: 'mock',
            modelId: 'mock-model-id',
          },
          options: {},
          state: {},
          messageId: 'message-1',
        },
        mastra: { getLogger: () => undefined },
        requestContext: new RequestContext(),
      }),
    ).rejects.toThrow('Unsupported model version');

    expect(processAPIError).toHaveBeenCalledOnce();
    expect(processedRequestContext).toBe(registryRequestContext);
  });

  it('clears generic tool choice when Tool Gate denies all tools', async () => {
    let modelToolNames: string[] = [];
    let modelToolChoice: any = 'unset';
    const model = new MockLanguageModelV2({
      doStream: async (options: any) => {
        modelToolNames = Array.isArray(options.tools)
          ? options.tools.map((tool: any) => tool.name)
          : Object.keys(options.tools ?? {});
        modelToolChoice = options.toolChoice;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    const requestContext = new RequestContext();
    setToolGateRuntimeStateForRun(requestContext, RUN_ID, {
      policy: {
        id: 'runtime-policy',
        evaluate: async () => ({
          effect: 'deny',
          reason: 'all denied',
        }),
      },
    });

    const messageList = new MessageList();
    messageList.add('Use a tool', 'input');
    globalRunRegistry.set(RUN_ID, {
      tools: {
        public: { description: 'Allowed tool' },
        secret: { description: 'Denied tool' },
      },
      model: model as any,
      requestContext,
    } as any);

    const step = createDurableLLMExecutionStep();

    await (step as any).execute({
      inputData: {
        runId: RUN_ID,
        agentId: 'agent-1',
        agentName: 'Agent 1',
        messageListState: messageList.serialize(),
        toolsMetadata: [],
        modelConfig: {
          provider: 'mock',
          modelId: 'mock-model-id',
        },
        options: {
          toolChoice: 'required',
        },
        state: {
          toolGate: { policyId: 'runtime-policy' },
        },
        messageId: 'message-1',
      },
      mastra: { getLogger: () => undefined },
      requestContext,
    });

    expect(modelToolNames).toEqual([]);
    expect(modelToolChoice).toBeUndefined();
  });
});
