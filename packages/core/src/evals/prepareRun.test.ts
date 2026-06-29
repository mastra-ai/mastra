import { describe, it, expect, vi } from 'vitest';
import { createScorer, filterRun } from './base';

describe('prepareRun', () => {
  it('transforms input/output before they reach the pipeline', async () => {
    const prepareRun = vi.fn(run => ({
      ...run,
      output: { trimmed: true },
    }));

    const scorer = createScorer({
      id: 'test-prepare',
      description: 'test',
      prepareRun,
    }).generateScore(({ run }) => {
      // The pipeline should see the transformed output
      expect(run.output).toEqual({ trimmed: true });
      return 1.0;
    });

    const result = await scorer.run({
      output: { original: true, largePayload: 'x'.repeat(10000) },
    });

    expect(prepareRun).toHaveBeenCalledOnce();
    expect(result.score).toBe(1.0);
  });

  it('reduces data visible to the pipeline when stripping fields', async () => {
    const scorer = createScorer({
      id: 'test-strip',
      description: 'test',
      prepareRun: run => ({
        ...run,
        input: { kept: true },
        groundTruth: undefined,
      }),
    }).generateScore(({ run }) => {
      expect(run.input).toEqual({ kept: true });
      expect(run.groundTruth).toBeUndefined();
      return 0.5;
    });

    const result = await scorer.run({
      input: { kept: true, extra: 'big data' },
      output: 'out',
      groundTruth: { expected: 'something' },
    });

    expect(result.score).toBe(0.5);
  });
});

describe('filterRun', () => {
  // Helpers that match real MastraDBMessage shapes
  const makeToolInvocationMessage = (toolName: string, result?: string) => ({
    id: 'msg-' + toolName,
    role: 'assistant',
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'call-' + toolName,
            toolName,
            args: {},
            result: result ?? 'ok',
          },
        },
      ],
    },
  });

  const makeTextMessage = (text: string, role: string = 'user') => ({
    id: 'msg-text',
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    },
  });

  const makeDataMessage = (dataType: string) => ({
    id: 'msg-' + dataType,
    role: 'assistant',
    content: {
      format: 2,
      parts: [{ type: dataType, data: { some: 'payload' } }],
    },
  });

  const makeStepStartMessage = () => ({
    id: 'msg-step',
    role: 'assistant',
    content: {
      format: 2,
      parts: [{ type: 'step-start' }],
    },
  });

  it('filters tool invocations by toolNames', () => {
    const filter = filterRun({ toolNames: ['write_file', 'execute_command'] });

    const run = {
      input: {
        inputMessages: [],
        rememberedMessages: [
          makeTextMessage('hello'),
          makeToolInvocationMessage('write_file'),
          makeToolInvocationMessage('view'),
          makeToolInvocationMessage('execute_command'),
          makeToolInvocationMessage('search_content'),
        ],
        systemMessages: [],
        taggedSystemMessages: {},
      },
      output: [
        makeToolInvocationMessage('write_file'),
        makeToolInvocationMessage('view'),
        makeToolInvocationMessage('execute_command'),
      ],
    };

    const result = filter(run);

    // Text messages always kept, plus matching tool messages
    const remembered = (result.input as any).rememberedMessages;
    expect(remembered).toHaveLength(3); // text + write_file + execute_command
    expect(remembered[0].content.parts[0].type).toBe('text');
    expect(remembered[1].content.parts[0].toolInvocation.toolName).toBe('write_file');
    expect(remembered[2].content.parts[0].toolInvocation.toolName).toBe('execute_command');

    // Output filtered too
    expect(result.output).toHaveLength(2); // write_file + execute_command
  });

  it('toolNames prefix-matches tool names', () => {
    const filter = filterRun({ toolNames: ['string_replace'] });

    const run = {
      input: {
        inputMessages: [],
        rememberedMessages: [makeToolInvocationMessage('string_replace_lsp'), makeToolInvocationMessage('view')],
        systemMessages: [],
        taggedSystemMessages: {},
      },
      output: [],
    };

    const result = filter(run);
    const remembered = (result.input as any).rememberedMessages;
    expect(remembered).toHaveLength(1);
    expect(remembered[0].content.parts[0].toolInvocation.toolName).toBe('string_replace_lsp');
  });

  it('filters by partTypes to drop data-* messages', () => {
    const filter = filterRun({ partTypes: ['text', 'tool-invocation'] });

    const run = {
      input: {
        inputMessages: [],
        rememberedMessages: [
          makeTextMessage('hello'),
          makeToolInvocationMessage('view'),
          makeDataMessage('data-om-status'),
          makeDataMessage('data-workspace-metadata'),
          makeStepStartMessage(),
        ],
        systemMessages: [],
        taggedSystemMessages: {},
      },
      output: [],
    };

    const result = filter(run);
    const remembered = (result.input as any).rememberedMessages;
    expect(remembered).toHaveLength(2); // text + tool-invocation only
  });

  it('partTypes prefix-matches data- subtypes', () => {
    const filter = filterRun({ partTypes: ['text', 'data-om-'] });

    const run = {
      input: {
        inputMessages: [],
        rememberedMessages: [
          makeTextMessage('hello'),
          makeDataMessage('data-om-status'),
          makeDataMessage('data-om-activation'),
          makeDataMessage('data-workspace-metadata'),
          makeDataMessage('data-sandbox-exit'),
        ],
        systemMessages: [],
        taggedSystemMessages: {},
      },
      output: [],
    };

    const result = filter(run);
    const remembered = (result.input as any).rememberedMessages;
    expect(remembered).toHaveLength(3); // text + 2 data-om-* messages
  });

  it('limits remembered messages with maxRememberedMessages', () => {
    const filter = filterRun({ maxRememberedMessages: 2 });

    const run = {
      input: {
        inputMessages: [],
        rememberedMessages: [makeTextMessage('a'), makeTextMessage('b'), makeTextMessage('c'), makeTextMessage('d')],
        systemMessages: [],
        taggedSystemMessages: {},
      },
      output: 'response',
    };

    const result = filter(run);
    const remembered = (result.input as any).rememberedMessages;
    expect(remembered).toHaveLength(2);
    expect(remembered[0].content.parts[0].text).toBe('c');
    expect(remembered[1].content.parts[0].text).toBe('d');
  });

  it('drops requestContext when specified', () => {
    const filter = filterRun({ dropRequestContext: true });

    const run = {
      output: 'out',
      requestContext: { large: 'object', sensitive: true },
    };

    const result = filter(run);
    expect(result.requestContext).toBeUndefined();
  });

  it('combines toolNames filter with maxRememberedMessages', () => {
    const filter = filterRun({
      toolNames: ['write_file'],
      maxRememberedMessages: 1,
    });

    const run = {
      input: {
        inputMessages: [],
        rememberedMessages: [
          makeTextMessage('hi'),
          makeToolInvocationMessage('write_file'),
          makeToolInvocationMessage('view'),
          makeTextMessage('bye'),
          makeToolInvocationMessage('write_file'),
        ],
        systemMessages: [],
        taggedSystemMessages: {},
      },
      output: [],
    };

    const result = filter(run);
    const remembered = (result.input as any).rememberedMessages;
    // After toolNames filter: hi, write_file, bye, write_file (4 messages)
    // After max limit of 1: just the last write_file
    expect(remembered).toHaveLength(1);
    expect(remembered[0].content.parts[0].toolInvocation.toolName).toBe('write_file');
  });

  it('keeps plain string content messages', () => {
    const filter = filterRun({ toolNames: ['view'] });

    const run = {
      input: {
        inputMessages: [],
        rememberedMessages: [
          { role: 'user', content: 'plain string message' },
          makeToolInvocationMessage('view'),
          makeToolInvocationMessage('write_file'),
        ],
        systemMessages: [],
        taggedSystemMessages: {},
      },
      output: [],
    };

    const result = filter(run);
    const remembered = (result.input as any).rememberedMessages;
    // plain string kept (non-structured), view kept (matches), write_file dropped
    expect(remembered).toHaveLength(2);
  });
});
