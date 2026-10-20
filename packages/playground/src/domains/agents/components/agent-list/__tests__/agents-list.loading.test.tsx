import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AgentsList } from '../agents-list';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

describe('AgentsList loading state', () => {
  it('shows the captured agents-list bones and announces loading', () => {
    const { container } = renderWithProviders(
      <TestLinkProvider>
        <AgentsList agents={[]} isLoading hasSearch={false} />
      </TestLinkProvider>,
    );

    expect(screen.getByRole('status', { name: 'Loading agents' })).not.toBeNull();
    const skeleton = container.querySelector('[data-boneyard="agents-list"]');
    expect(skeleton?.getAttribute('aria-busy')).toBe('true');
  });
});
