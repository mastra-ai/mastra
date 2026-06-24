import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import { StreamRunningContext } from '../../../../contexts/stream-chat-context';
import type { AgentTool } from '../../../../types/agent-tool';
import { AgentProfileToolsStep } from '../agent-profile-tools-step';

const BASE_URL = 'http://localhost:4111';

const editPageState = vi.hoisted(() => ({
  availableAgentTools: [] as AgentTool[],
}));

vi.mock('@/domains/agent-builder/contexts/edit-page-context', () => ({
  useEditPage: () => ({ availableAgentTools: editPageState.availableAgentTools }),
}));

vi.mock('../tools', () => ({
  Tools: () => <div data-testid="tools-picker" />,
}));

const Harness = ({ isStreaming = false, children }: { isStreaming?: boolean; children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AgentColorProvider agentId="agent_test">
            <StreamRunningContext.Provider value={{ isRunning: isStreaming }}>{children}</StreamRunningContext.Provider>
          </AgentColorProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('AgentProfileToolsStep', () => {
  afterEach(() => {
    cleanup();
    editPageState.availableAgentTools = [];
  });

  it('shows the selected tools count in the onboarding description', () => {
    editPageState.availableAgentTools = [
      { id: 'weather', name: 'Weather', isChecked: true, type: 'tool' },
      { id: 'calendar', name: 'Calendar', isChecked: false, type: 'tool' },
      { id: 'agent-helper', name: 'Agent Helper', isChecked: true, type: 'agent' },
    ];

    render(
      <Harness>
        <AgentProfileToolsStep />
      </Harness>,
    );

    expect(screen.getByText('Selected tools:')).toBeTruthy();
    const count = screen.getByText('2');
    expect(count.tagName).toBe('STRONG');
    expect(count.className).toContain('text-neutral6');
    expect(count.parentElement?.className).toContain('rounded-full');
  });

  it('renders the navigation footer with a top border and pt-6 spacing', () => {
    render(
      <Harness>
        <AgentProfileToolsStep />
      </Harness>,
    );

    const footer = screen.getByTestId('agent-step-footer');
    expect(footer.className).toContain('border-t');
    expect(footer.className).toContain('pt-6');
  });
});
