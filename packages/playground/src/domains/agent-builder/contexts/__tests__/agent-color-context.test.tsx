// @vitest-environment jsdom
import { stringToColor } from '@mastra/playground-ui';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentColors } from '../agent-color-context';
import { AgentColorProvider, useAgentColor } from '../agent-color-context';

const Consumer = ({ observed }: { observed: AgentColors[] }) => {
  const color = useAgentColor();
  observed.push(color);
  return <div data-testid="consumer" data-bg={color.background} data-fg={color.foreground} data-tint={color.tint} />;
};

describe('AgentColorProvider', () => {
  afterEach(() => {
    cleanup();
  });

  it('throws when mounted without an agentId', () => {
    const observed: AgentColors[] = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <AgentColorProvider agentId="">
          <Consumer observed={observed} />
        </AgentColorProvider>,
      ),
    ).toThrow(/AgentColorProvider requires a non-empty agentId/);
    errorSpy.mockRestore();
  });

  it('derives background, foreground, and tint colors from the agentId', () => {
    const observed: AgentColors[] = [];
    const { getByTestId } = render(
      <AgentColorProvider agentId="agent_123">
        <Consumer observed={observed} />
      </AgentColorProvider>,
    );
    const consumer = getByTestId('consumer');
    expect(consumer.getAttribute('data-bg')).toBe(stringToColor('agent_123'));
    expect(consumer.getAttribute('data-fg')).toBe(stringToColor('agent_123', 20));
    expect(consumer.getAttribute('data-tint')).toBe(stringToColor('agent_123', 50));
    // Background uses lightness 90%, foreground uses lightness 20%, tint uses lightness 50%.
    expect(consumer.getAttribute('data-bg')).toMatch(/hsl\(-?\d+, 100%, 90%\)/);
    expect(consumer.getAttribute('data-fg')).toMatch(/hsl\(-?\d+, 100%, 20%\)/);
    expect(consumer.getAttribute('data-tint')).toMatch(/hsl\(-?\d+, 100%, 50%\)/);
  });

  it('keeps the color object referentially stable across re-renders with the same agentId', () => {
    const observed: AgentColors[] = [];
    const { rerender } = render(
      <AgentColorProvider agentId="stable-id">
        <Consumer observed={observed} />
      </AgentColorProvider>,
    );
    const first = observed[observed.length - 1];

    rerender(
      <AgentColorProvider agentId="stable-id">
        <Consumer observed={observed} />
      </AgentColorProvider>,
    );

    const latest = observed[observed.length - 1];
    expect(latest).toBe(first);
  });

  it('produces different colors for different agentIds', () => {
    const observed: AgentColors[] = [];
    const { getByTestId, rerender } = render(
      <AgentColorProvider agentId="alpha">
        <Consumer observed={observed} />
      </AgentColorProvider>,
    );
    const consumer = getByTestId('consumer');
    expect(consumer.getAttribute('data-bg')).toBe(stringToColor('alpha'));

    rerender(
      <AgentColorProvider agentId="omega">
        <Consumer observed={observed} />
      </AgentColorProvider>,
    );

    expect(consumer.getAttribute('data-bg')).toBe(stringToColor('omega'));
  });
});

describe('useAgentColor', () => {
  afterEach(() => {
    cleanup();
  });

  it('throws when used outside of an AgentColorProvider', () => {
    const observed: AgentColors[] = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer observed={observed} />)).toThrow(
      /useAgentColor must be used inside an AgentColorProvider/,
    );
    errorSpy.mockRestore();
  });
});
