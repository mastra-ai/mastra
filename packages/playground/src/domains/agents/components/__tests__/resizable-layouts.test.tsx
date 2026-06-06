// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowLayout } from '../../../workflows/components/workflow-layout';
import { AgentLayout } from '../agent-layout';

vi.mock('react-resizable-panels', () => ({
  Group: ({ className, children }: { className?: string; children: ReactNode }) => (
    <div data-testid="panel-group" className={className}>
      {children}
    </div>
  ),
  Panel: ({ id, className, children }: { id?: string; className?: string; children: ReactNode }) => (
    <section data-testid={`panel-${id}`} className={className}>
      {children}
    </section>
  ),
  useDefaultLayout: () => ({ defaultLayout: undefined, onLayoutChange: vi.fn() }),
}));

vi.mock('@mastra/playground-ui', async () => {
  const actual = await vi.importActual<typeof PlaygroundUi>('@mastra/playground-ui');

  return {
    ...actual,
    CollapsiblePanel: ({ id, className, children }: { id?: string; className?: string; children: ReactNode }) => (
      <aside data-testid={`collapsible-${id}`} className={className}>
        {children}
      </aside>
    ),
    PanelSeparator: () => <div data-testid="panel-separator" />,
  };
});

afterEach(cleanup);

function expectResizableLayoutContract(mainPanelClassNames: string[]) {
  const panelGroup = screen.getByTestId('panel-group');
  expect(panelGroup.className).toContain('h-full');
  expect(panelGroup.className).toContain('min-h-0');
  expect(panelGroup.className).toContain('w-full');
  expect(panelGroup.className).toContain('min-w-0');
  expect(panelGroup.className).not.toContain('min-w-min');

  expect(screen.getByTestId('collapsible-left-slot').className).toContain('min-w-0');
  expect(screen.getByTestId('collapsible-right-slot').className).toContain('min-w-0');

  const mainPanel = screen.getByTestId('panel-main-slot');
  expect(mainPanel.className).toContain('min-w-0');
  for (const className of mainPanelClassNames) {
    expect(mainPanel.className).toContain(className);
  }
}

describe('resizable service layouts', () => {
  it('keeps the agent panel group shrinkable when side slots are present', () => {
    render(
      <AgentLayout agentId="chef-agent" leftSlot={<div>threads</div>} rightSlot={<div>agent information</div>}>
        <div>chat</div>
      </AgentLayout>,
    );

    expectResizableLayoutContract(['grid', 'overflow-y-auto']);
  });

  it('keeps the workflow panel group shrinkable when side slots are present', () => {
    render(
      <WorkflowLayout workflowId="workflow-id" leftSlot={<div>runs</div>} rightSlot={<div>workflow information</div>}>
        <div>workflow run</div>
      </WorkflowLayout>,
    );

    expectResizableLayoutContract(['overflow-y-auto']);
  });
});
