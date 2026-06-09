// @vitest-environment jsdom
import type { DynamicToolPart } from '@mastra/react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ToolCardProps } from '../../../tools/tool-card';
import type { MessageMetadata } from '../../message-metadata';

const toolCardProps = vi.fn<(props: ToolCardProps) => void>();

vi.mock('../../../tools/tool-card', () => ({
  ToolCard: (props: ToolCardProps) => {
    toolCardProps(props);
    return <div data-testid="tool-card" />;
  },
}));

import { DynamicToolPartRenderer } from '../dynamic-tool-part-renderer';

describe('DynamicToolPartRenderer', () => {
  it('uses part.toolName when present and forwards input/output/state plus context', () => {
    toolCardProps.mockClear();

    const part = {
      type: 'tool-customSearch',
      toolName: 'customSearch',
      toolCallId: 'dyn-1',
      state: 'output-available',
      input: { q: 'x' },
      output: { ok: true },
    } as unknown as DynamicToolPart;

    const metadata: MessageMetadata = { mode: 'stream' };
    const dataParts = [{ type: 'data-foo', data: {}, toolCallId: 'dyn-1' }];

    render(<DynamicToolPartRenderer part={part} metadata={metadata} dataParts={dataParts} />);

    const props = toolCardProps.mock.calls[0][0];
    expect(props.toolName).toBe('customSearch');
    expect(props.input).toEqual({ q: 'x' });
    expect(props.output).toEqual({ ok: true });
    expect(props.toolCallId).toBe('dyn-1');
    expect(props.state).toBe('output-available');
    expect(props.metadata).toBe(metadata);
    expect(props.dataParts).toBe(dataParts);
  });

  it('strips the tool- prefix from part.type when toolName is absent', () => {
    toolCardProps.mockClear();

    const part = {
      type: 'tool-weather',
      toolCallId: 'dyn-2',
      state: 'output-available',
    } as unknown as DynamicToolPart;

    render(<DynamicToolPartRenderer part={part} />);

    expect(toolCardProps.mock.calls[0][0].toolName).toBe('weather');
  });

  it('falls back to an empty toolCallId when none is provided', () => {
    toolCardProps.mockClear();

    const part = { type: 'tool-noid', toolName: 'noid' } as unknown as DynamicToolPart;

    render(<DynamicToolPartRenderer part={part} />);

    expect(toolCardProps.mock.calls[0][0].toolCallId).toBe('');
  });
});
