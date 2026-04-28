// @vitest-environment jsdom
import { MainSidebarProvider, TooltipProvider } from '@mastra/playground-ui';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentBuilderSidebar } from '../agent-builder-sidebar';
import { LinkComponentProvider } from '@/lib/framework';

const StubLink = ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a {...props}>{children}</a>
);

const noopPaths = {
  agentLink: () => '',
  agentMessageLink: () => '',
  workflowLink: () => '',
  toolLink: () => '',
  scoreLink: () => '',
  scorerLink: () => '',
  toolByAgentLink: () => '',
  toolByWorkflowLink: () => '',
  promptLink: () => '',
  legacyWorkflowLink: () => '',
  policyLink: () => '',
  vNextNetworkLink: () => '',
  agentBuilderLink: () => '',
  mcpServerLink: () => '',
  mcpServerToolLink: () => '',
  workflowRunLink: () => '',
  datasetLink: () => '',
  datasetItemLink: () => '',
  datasetExperimentLink: () => '',
  experimentLink: () => '',
} as never;

function renderSidebar(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <LinkComponentProvider Link={StubLink as never} navigate={() => {}} paths={noopPaths}>
            <TooltipProvider>
              <MainSidebarProvider>
                <AgentBuilderSidebar />
              </MainSidebarProvider>
            </TooltipProvider>
          </LinkComponentProvider>
        ),
      },
    ],
    { initialEntries: [initialPath] },
  );

  return render(<RouterProvider router={router} />);
}

describe('AgentBuilderSidebar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders both Agents and Library links', async () => {
    renderSidebar('/agent-builder/agents');

    const agents = await screen.findByRole('link', { name: /My agents/i });
    const library = await screen.findByRole('link', { name: /Library/i });

    expect(agents.getAttribute('href')).toBe('/agent-builder/agents');
    expect(library.getAttribute('href')).toBe('/agent-builder/library');
  });

  it('marks the Library link active when on /agent-builder/library', async () => {
    renderSidebar('/agent-builder/library');

    const libraryLink = await screen.findByRole('link', { name: /Library/i });
    const libraryItem = libraryLink.closest('li');
    expect(libraryItem?.className).toMatch(/before:absolute/);

    const agentsLink = await screen.findByRole('link', { name: /My agents/i });
    const agentsItem = agentsLink.closest('li');
    expect(agentsItem?.className).not.toMatch(/before:absolute/);
  });
});
