// @vitest-environment jsdom
import type { MastraUIMessage } from '@mastra/react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AGENT_BUILDER_TOOL_NAME } from '../../agent-builder-edit/hooks/use-agent-builder-tool';
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

  it('renders tool display names for agent-builder tool calls', () => {
    const { container } = render(
      <MessageRow
        message={buildMessage([
          {
            type: 'dynamic-tool',
            toolCallId: 'call-1',
            toolName: AGENT_BUILDER_TOOL_NAME,
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
