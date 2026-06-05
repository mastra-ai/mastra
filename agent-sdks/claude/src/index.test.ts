import type { Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { isAgentCompatible } from '@mastra/core/agent';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClaudeSDKAgent } from './index';

const queryMock = vi.hoisted(() => vi.fn());
const TEST_CLAUDE_MODEL = 'claude-sonnet-4-6';

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: queryMock,
}));

function createQuery(messages: SDKMessage[]): Query {
  return (async function* () {
    for (const message of messages) {
      yield message;
    }
  })() as Query;
}

function createStreamEvent(text: string): SDKMessage {
  return {
    type: 'stream_event',
    event: {
      type: 'content_block_delta',
      delta: {
        type: 'text_delta',
        text,
      },
    },
  } as SDKMessage;
}

function createResultMessage(result: string, structuredOutput?: unknown): SDKMessage {
  return {
    type: 'result',
    subtype: 'success',
    duration_ms: 25,
    duration_api_ms: 20,
    is_error: false,
    num_turns: 1,
    result,
    stop_reason: 'end_turn',
    total_cost_usd: 0.0123,
    usage: {
      input_tokens: 10,
      output_tokens: 4,
      cache_read_input_tokens: 2,
      cache_creation_input_tokens: 3,
    },
    modelUsage: {
      [TEST_CLAUDE_MODEL]: {
        inputTokens: 10,
        outputTokens: 4,
        cacheReadInputTokens: 2,
        cacheCreationInputTokens: 3,
        webSearchRequests: 0,
        costUSD: 0.0123,
        contextWindow: 200000,
        maxOutputTokens: 64000,
      },
    },
    permission_denials: [],
    structured_output: structuredOutput,
    uuid: 'message-uuid',
    session_id: 'session-id',
  } as SDKMessage;
}

function createCostOnlyResultMessage(result: string): SDKMessage {
  return {
    type: 'result',
    subtype: 'success',
    duration_ms: 25,
    duration_api_ms: 20,
    is_error: false,
    num_turns: 1,
    result,
    stop_reason: 'end_turn',
    total_cost_usd: 0.0123,
    permission_denials: [],
    uuid: 'message-uuid',
    session_id: 'session-id',
  } as SDKMessage;
}

function createAssistantMessage(id: string, usage: Record<string, number>): SDKMessage {
  return {
    type: 'assistant',
    message: {
      id,
      type: 'message',
      role: 'assistant',
      content: [],
      model: TEST_CLAUDE_MODEL,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage,
    },
    session_id: 'session-id',
  } as SDKMessage;
}

describe('ClaudeSDKAgent', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('is compatible with the Agent/SubAgent contract', () => {
    queryMock.mockImplementationOnce(() => createQuery([createResultMessage('ok')]));
    const agent = new ClaudeSDKAgent({
      id: 'claude-agent',
      name: 'Claude Agent',
      description: 'Use Claude Agent as a Mastra agent.',
      sdkOptions: {
        model: TEST_CLAUDE_MODEL,
      },
    });

    expect(agent.id).toBe('claude-agent');
    expect(agent.name).toBe('Claude Agent');
    expect(agent.getDescription()).toBe('Use Claude Agent as a Mastra agent.');
    expect(agent.supportsMemory()).toBe(false);
    expect(isAgentCompatible(agent)).toBe(true);
  });

  it('generate calls Claude Agent SDK query directly and returns Mastra output', async () => {
    queryMock.mockImplementationOnce(() => createQuery([createResultMessage('generated text')]));
    const abortController = new AbortController();
    const agent = new ClaudeSDKAgent({
      id: 'claude-agent',
      description: 'Claude',
      sdkOptions: {
        cwd: '/tmp/project',
        model: TEST_CLAUDE_MODEL,
        maxTurns: 1,
        permissionMode: 'acceptEdits',
        tools: ['Read', 'Bash'],
        allowedTools: ['Read'],
        disallowedTools: ['Bash'],
        mcpServers: {
          weather: { type: 'sdk', name: 'weather' },
        },
        env: {
          CLAUDE_AGENT_SDK_CLIENT_APP: 'mastra-test',
        },
        pathToClaudeCodeExecutable: '/usr/local/bin/claude',
      },
    });

    const result = await agent.generate('Generate prompt', {
      runId: 'mastra-run',
      abortSignal: abortController.signal,
      maxSteps: 1,
      sdkOptions: {
        resume: 'session-id',
      },
    });

    expect(result.text).toBe('generated text');
    expect(result.response.uiMessages[0]?.parts[0]).toMatchObject({
      type: 'text',
      text: 'generated text',
    });
    expect(result.runId).toBe('mastra-run');
    expect(result.usage.inputTokens).toBe(15);
    expect(result.usage.outputTokens).toBe(4);
    expect(result.usage.totalTokens).toBe(19);
    expect(result.providerMetadata).toMatchObject({
      claude: {
        totalCostUsd: 0.0123,
        model: TEST_CLAUDE_MODEL,
        cwd: '/tmp/project',
        permissionMode: 'acceptEdits',
        maxTurns: 1,
        allowedTools: ['Read'],
        disallowedTools: ['Bash'],
      },
    });
    expect(queryMock).toHaveBeenCalledWith({
      prompt: 'Generate prompt',
      options: expect.objectContaining({
        cwd: '/tmp/project',
        model: TEST_CLAUDE_MODEL,
        maxTurns: 1,
        permissionMode: 'acceptEdits',
        tools: ['Read', 'Bash'],
        allowedTools: ['Read'],
        disallowedTools: ['Bash'],
        mcpServers: {
          weather: { type: 'sdk', name: 'weather' },
        },
        env: {
          CLAUDE_AGENT_SDK_CLIENT_APP: 'mastra-test',
        },
        pathToClaudeCodeExecutable: '/usr/local/bin/claude',
        resume: 'session-id',
        abortController: expect.any(AbortController),
      }),
    });
  });

  it('keeps assistant token usage when the result message only includes cost', async () => {
    queryMock.mockImplementationOnce(() =>
      createQuery([
        createAssistantMessage('assistant-1', {
          input_tokens: 10,
          output_tokens: 4,
          cache_read_input_tokens: 2,
          cache_creation_input_tokens: 3,
        }),
        createCostOnlyResultMessage('generated text'),
      ]),
    );
    const agent = new ClaudeSDKAgent({
      id: 'claude-agent',
      description: 'Claude',
      sdkOptions: {
        model: TEST_CLAUDE_MODEL,
      },
    });

    const result = await agent.generate('Generate prompt');

    expect(result.usage.inputTokens).toBe(15);
    expect(result.usage.outputTokens).toBe(4);
    expect(result.usage.totalTokens).toBe(19);
    expect(result.providerMetadata).toMatchObject({
      claude: {
        totalCostUsd: 0.0123,
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          cacheReadInputTokens: 2,
          cacheCreationInputTokens: 3,
          totalCostUsd: 0.0123,
        },
      },
    });
  });

  it('stream emits Mastra chunks and resolves text from Claude stream events', async () => {
    queryMock.mockImplementationOnce(() =>
      createQuery([createStreamEvent('streamed '), createStreamEvent('text'), createResultMessage('streamed text')]),
    );
    const agent = new ClaudeSDKAgent({
      id: 'claude-agent',
      description: 'Claude',
      sdkOptions: {
        model: TEST_CLAUDE_MODEL,
      },
    });

    const stream = await agent.stream('Stream prompt', { runId: 'stream-mastra-run' });
    const chunks = [];
    for await (const chunk of stream.fullStream) {
      chunks.push(chunk);
    }

    expect(await stream.text).toBe('streamed text');
    expect((await stream.usage).inputTokens).toBe(15);
    expect(chunks.map(chunk => chunk.type)).toEqual([
      'start',
      'step-start',
      'response-metadata',
      'text-start',
      'text-delta',
      'text-delta',
      'text-end',
      'step-finish',
      'finish',
    ]);
  });

  it('uses Claude native structured output and exposes the validated object', async () => {
    queryMock.mockImplementationOnce(() => createQuery([createResultMessage('', { answer: 'yes' })]));
    const agent = new ClaudeSDKAgent({
      id: 'claude-agent',
      description: 'Claude',
      sdkOptions: {
        model: TEST_CLAUDE_MODEL,
      },
    });

    const result = await agent.generate<{ answer: string }>('Return a JSON answer', {
      structuredOutput: {
        schema: {
          type: 'object',
          properties: {
            answer: { type: 'string' },
          },
          required: ['answer'],
        },
      },
    });

    expect(result.object).toEqual({ answer: 'yes' });
    expect(queryMock).toHaveBeenCalledWith({
      prompt: 'Return a JSON answer',
      options: expect.objectContaining({
        model: TEST_CLAUDE_MODEL,
        outputFormat: {
          type: 'json_schema',
          schema: expect.objectContaining({
            type: 'object',
            properties: expect.objectContaining({
              answer: expect.objectContaining({ type: 'string' }),
            }),
          }),
        },
      }),
    });
  });

  it('resumeGenerate maps resumeData to Claude session resume options', async () => {
    queryMock.mockImplementationOnce(() => createQuery([createResultMessage('continued text')]));
    const agent = new ClaudeSDKAgent({
      id: 'claude-agent',
      description: 'Claude',
      sdkOptions: {
        model: TEST_CLAUDE_MODEL,
      },
    });

    const result = await agent.resumeGenerate(
      {
        message: 'Continue prompt',
        sessionId: 'session-id',
        forkSession: true,
        resumeSessionAt: 'assistant-message-id',
      },
      { runId: 'resume-run' },
    );

    expect(result.text).toBe('continued text');
    expect(result.runId).toBe('resume-run');
    expect(queryMock).toHaveBeenCalledWith({
      prompt: 'Continue prompt',
      options: expect.objectContaining({
        model: TEST_CLAUDE_MODEL,
        resume: 'session-id',
        forkSession: true,
        resumeSessionAt: 'assistant-message-id',
      }),
    });
  });

  it('resumeStream maps resumeData to Claude latest-session continuation', async () => {
    queryMock.mockImplementationOnce(() =>
      createQuery([createStreamEvent('continued '), createStreamEvent('text'), createResultMessage('continued text')]),
    );
    const agent = new ClaudeSDKAgent({
      id: 'claude-agent',
      description: 'Claude',
      sdkOptions: {
        model: TEST_CLAUDE_MODEL,
      },
    });

    const stream = await agent.resumeStream({ message: 'Continue prompt', continue: true }, { runId: 'resume-run' });
    for await (const _chunk of stream.fullStream) {
      // drain
    }

    expect(await stream.text).toBe('continued text');
    expect(queryMock).toHaveBeenCalledWith({
      prompt: 'Continue prompt',
      options: expect.objectContaining({
        model: TEST_CLAUDE_MODEL,
        continue: true,
      }),
    });
  });
});
