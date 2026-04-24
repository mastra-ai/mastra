// @vitest-environment jsdom
import type { MastraUIMessage } from '@mastra/react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MessageRow } from '../messages';

const buildMessage = (parts: MastraUIMessage['parts']): MastraUIMessage => ({
  id: 'msg-1',
  role: 'assistant',
  parts,
});

describe('MessageRow dynamic-tool rendering', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders tool display names for builder-agent-tool calls', () => {
    const { container } = render(
      <MessageRow
        message={buildMessage([
          {
            type: 'dynamic-tool',
            toolCallId: 'call-1',
            toolName: 'builder-agent-tool',
            state: 'output-available',
            input: {
              tools: [
                { id: 'web-search', name: 'Web Search' },
                { id: 'weather-lookup', name: 'Weather Lookup' },
              ],
            },
            output: { success: true },
          } as MastraUIMessage['parts'][number],
        ])}
      />,
    );

    expect(container.textContent).toContain('Web Search');
    expect(container.textContent).toContain('Weather Lookup');
    expect(container.textContent).not.toContain('web-search');
    expect(container.textContent).not.toContain('weather-lookup');
  });

  it('summarizes name and instructions updates when no tools are set', () => {
    const { container } = render(
      <MessageRow
        message={buildMessage([
          {
            type: 'dynamic-tool',
            toolCallId: 'call-3',
            toolName: 'builder-agent-tool',
            state: 'output-available',
            input: {
              name: 'Research Assistant',
              instructions: 'Do research',
            },
            output: { success: true },
          } as MastraUIMessage['parts'][number],
        ])}
      />,
    );

    expect(container.textContent).toContain('Research Assistant');
    expect(container.textContent).toContain('Updated instructions');
  });

  it('prefixes failures with "Failed:" on output-error state', () => {
    const { container } = render(
      <MessageRow
        message={buildMessage([
          {
            type: 'dynamic-tool',
            toolCallId: 'call-4',
            toolName: 'builder-agent-tool',
            state: 'output-error',
            input: {
              tools: [{ id: 'web-search', name: 'Web Search' }],
            },
            errorText: 'boom',
          } as MastraUIMessage['parts'][number],
        ])}
      />,
    );

    expect(container.textContent).toContain('Failed:');
    expect(container.textContent).toContain('Web Search');
  });

  it('renders the generic shimmer for non-builder dynamic tools', () => {
    const { container } = render(
      <MessageRow
        message={buildMessage([
          {
            type: 'dynamic-tool',
            toolCallId: 'call-5',
            toolName: 'some-other-tool',
            state: 'output-available',
            input: { tools: [{ id: 'web-search', name: 'Web Search' }] },
            output: { success: true },
          } as MastraUIMessage['parts'][number],
        ])}
      />,
    );

    // Generic shimmer ends with "..." — don't pin the exact word since it's random.
    expect(container.textContent?.endsWith('...')).toBe(true);
    expect(container.textContent).not.toContain('Web Search');
  });
});
