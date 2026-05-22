// @vitest-environment jsdom
import { stringToColor } from '@mastra/playground-ui';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentColors } from '../agent-color-context';
import { AgentColorProvider, useAgentColor } from '../agent-color-context';

const Consumer = ({ observed }: { observed: AgentColors[] }) => {
  const color = useAgentColor();
  observed.push(color);
  return (
    <div
      data-testid="consumer"
      data-bg={color?.background ?? ''}
      data-fg={color?.foreground ?? ''}
      data-tint={color?.tint ?? ''}
    />
  );
};

describe('AgentColorProvider', () => {
  afterEach(() => {
    cleanup();
  });

  it('returns null when agentId is an empty string', () => {
    const observed: AgentColors[] = [];
    const { getByTestId } = render(
      <AgentColorProvider agentId="">
        <Consumer observed={observed} />
      </AgentColorProvider>,
    );
    const consumer = getByTestId('consumer');
    expect(consumer.getAttribute('data-bg')).toBe('');
    expect(consumer.getAttribute('data-fg')).toBe('');
    expect(observed.at(-1)).toBeNull();
  });

  it('derives an hsl background, a darker hsl foreground, and a mid-lightness tint from the agentId', () => {
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
    expect(consumer.getAttribute('data-bg')).toMatch(/hsl\(-?\d+, 100%, 90%\)/);
    expect(consumer.getAttribute('data-fg')).toMatch(/hsl\(-?\d+, 100%, 20%\)/);
    expect(consumer.getAttribute('data-tint')).toMatch(/hsl\(-?\d+, 100%, 50%\)/);
  });

  it('produces different colors for different agentIds', () => {
    const a: AgentColors[] = [];
    const b: AgentColors[] = [];
    render(
      <AgentColorProvider agentId="agent_alpha">
        <Consumer observed={a} />
      </AgentColorProvider>,
    );
    render(
      <AgentColorProvider agentId="agent_omega">
        <Consumer observed={b} />
      </AgentColorProvider>,
    );
    expect(a.at(-1)?.background).not.toBe(b.at(-1)?.background);
  });
});

describe('useAgentColor', () => {
  afterEach(() => {
    cleanup();
  });

  it('returns null when used outside of an AgentColorProvider', () => {
    const observed: AgentColors[] = [];
    render(<Consumer observed={observed} />);
    expect(observed.at(-1)).toBeNull();
  });
});
