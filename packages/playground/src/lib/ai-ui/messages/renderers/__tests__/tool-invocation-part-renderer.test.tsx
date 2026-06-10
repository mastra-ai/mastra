// @vitest-environment jsdom
import type { ToolInvocationPart } from '@mastra/react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ToolCardProps } from '../../../tools/tool-card';
import type { MessageMetadata } from '../../message-metadata';

const toolCardProps = vi.fn<(props: ToolCardProps) => void>();

// ToolCard owns a large dispatch tree covered by its own dedicated suite. Here
// we only assert that the renderer forwards the adapted props, so we stub it
// with a thin prop-capturing seam (not one of our data/service/auth hooks).
vi.mock('../../../tools/tool-card', () => ({
  ToolCard: (props: ToolCardProps) => {
    toolCardProps(props);
    return <div data-testid="tool-card" />;
  },
}));

import { ToolInvocationPartRenderer } from '../tool-invocation-part-renderer';

describe('ToolInvocationPartRenderer', () => {
  it('forwards toolName/input/output/toolCallId/state plus metadata and dataParts', () => {
    toolCardProps.mockClear();

    const part = {
      type: 'tool-invocation',
      toolInvocation: {
        toolName: 'searchDocs',
        toolCallId: 'call-1',
        state: 'result',
        args: { query: 'hello' },
        result: { hits: 3 },
      },
    } satisfies ToolInvocationPart;

    const metadata: MessageMetadata = { mode: 'stream' };
    const dataParts = [{ type: 'data-foo', data: { a: 1 }, toolCallId: 'call-1' }];

    render(<ToolInvocationPartRenderer part={part} metadata={metadata} dataParts={dataParts} />);

    expect(toolCardProps).toHaveBeenCalledTimes(1);
    const props = toolCardProps.mock.calls[0][0];
    expect(props.toolName).toBe('searchDocs');
    expect(props.input).toEqual({ query: 'hello' });
    expect(props.output).toEqual({ hits: 3 });
    expect(props.toolCallId).toBe('call-1');
    expect(props.state).toBe('result');
    expect(props.metadata).toBe(metadata);
    expect(props.dataParts).toBe(dataParts);
  });

  it('passes undefined input/output when args/result are absent', () => {
    toolCardProps.mockClear();

    const part = {
      type: 'tool-invocation',
      toolInvocation: { toolName: 'noop', toolCallId: 'call-2', state: 'call', args: undefined },
    } satisfies ToolInvocationPart;

    render(<ToolInvocationPartRenderer part={part} />);

    const props = toolCardProps.mock.calls[0][0];
    expect(props.input).toBeUndefined();
    expect(props.output).toBeUndefined();
    expect(props.toolName).toBe('noop');
    expect(props.toolCallId).toBe('call-2');
  });
});
