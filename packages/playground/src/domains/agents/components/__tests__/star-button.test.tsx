// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StarButton } from '../star-button';

vi.mock('@/domains/agent-builder', () => ({
  useBuilderAgentFeatures: () => ({ stars: true }),
}));

vi.mock('../../hooks/use-stored-agent-star', () => ({
  useToggleStoredAgentStar: () => ({ isPending: false, mutate: vi.fn() }),
}));

describe('StarButton', () => {
  it('renders singular Star text with the count', () => {
    render(<StarButton agentId="agent-1" starCount={1} />);

    expect(screen.getByRole('button', { name: 'Star agent' })).toBeTruthy();
    expect(screen.getByText('Star')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('renders plural Stars text with the count', () => {
    render(<StarButton agentId="agent-1" starCount={2} />);

    expect(screen.getByText('Stars')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });
});
