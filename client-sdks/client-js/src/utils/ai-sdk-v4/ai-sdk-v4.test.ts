import { describe, expect, it, vi } from 'vitest';
import { formatDataStreamPart, parsePartialJson, processDataStream } from '.';

function streamOf(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe('parsePartialJson', () => {
  it('reports each parse state', () => {
    expect(parsePartialJson(undefined)).toEqual({ value: undefined, state: 'undefined-input' });
    expect(parsePartialJson('{"a":1}')).toEqual({ value: { a: 1 }, state: 'successful-parse' });
    expect(parsePartialJson('{"a":[1,"tw')).toEqual({ value: { a: [1, 'tw'] }, state: 'repaired-parse' });
    expect(parsePartialJson('}{')).toEqual({ value: undefined, state: 'failed-parse' });
  });
});

describe('processDataStream', () => {
  it('dispatches v4 data stream parts, including lines split across chunks', async () => {
    const text = formatDataStreamPart('text', 'Hello');
    const toolCall = formatDataStreamPart('tool_call', { toolCallId: 't1', toolName: 'x', args: { q: 1 } });
    const toolResult = formatDataStreamPart('tool_result', { toolCallId: 't1', result: 'ok' });
    const finish = formatDataStreamPart('finish_message', {
      finishReason: 'stop',
      usage: { promptTokens: 1, completionTokens: 2 },
    });

    const onTextPart = vi.fn();
    const onToolCallPart = vi.fn();
    const onToolResultPart = vi.fn();
    const onFinishMessagePart = vi.fn();

    await processDataStream({
      stream: streamOf([text.slice(0, 4), text.slice(4) + toolCall, toolResult + finish]),
      onTextPart,
      onToolCallPart,
      onToolResultPart,
      onFinishMessagePart,
    });

    expect(onTextPart).toHaveBeenCalledWith('Hello');
    expect(onToolCallPart).toHaveBeenCalledWith({ toolCallId: 't1', toolName: 'x', args: { q: 1 } });
    expect(onToolResultPart).toHaveBeenCalledWith({ toolCallId: 't1', result: 'ok' });
    expect(onFinishMessagePart).toHaveBeenCalledWith({
      finishReason: 'stop',
      usage: { promptTokens: 1, completionTokens: 2 },
    });
  });

  it('rejects unknown stream codes', async () => {
    await expect(processDataStream({ stream: streamOf(['z:1\n']) })).rejects.toThrow('Invalid code z');
  });
});
