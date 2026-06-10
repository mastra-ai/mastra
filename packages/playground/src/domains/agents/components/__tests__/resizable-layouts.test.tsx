// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    CollapsiblePanel: ({
      id,
      className,
      children,
      minSize,
      defaultSize,
      onResize,
    }: {
      id?: string;
      className?: string;
      children: ReactNode;
      minSize?: number;
      defaultSize?: number;
      onResize?: (size: { inPixels: number }) => void;
    }) => (
      <aside
        data-testid={`collapsible-${id}`}
        data-min-size={minSize}
        data-default-size={defaultSize}
        className={className}
      >
        <button type="button" onClick={() => onResize?.({ inPixels: 520 })}>
          resize {id}
        </button>
        {children}
      </aside>
    ),
    PanelSeparator: () => <div data-testid="panel-separator" />,
  };
});

afterEach(cleanup);

function expectAgentResizableLayoutContract(mainPanelClassNames: string[]) {
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

function expectWorkflowFloatingLayoutContract() {
  const panelGroups = screen.getAllByTestId('panel-group');
  expect(panelGroups).toHaveLength(2);

  for (const panelGroup of panelGroups) {
    expect(panelGroup.className).toContain('pointer-events-none');
    expect(panelGroup.className).toContain('absolute');
    expect(panelGroup.className).toContain('inset-0');
    expect(panelGroup.className).toContain('h-full');
    expect(panelGroup.className).toContain('min-h-0');
    expect(panelGroup.className).toContain('w-full');
    expect(panelGroup.className).toContain('min-w-0');
    expect(panelGroup.className).not.toContain('min-w-min');
  }

  expect(screen.getByTestId('collapsible-left-slot').className).toContain('pointer-events-auto');
  expect(screen.getByTestId('collapsible-left-slot').className).toContain('min-w-0');
  expect(screen.getByTestId('collapsible-left-slot').className).toContain('bg-transparent');
  expect(screen.getByTestId('collapsible-left-slot').dataset.minSize).toBe('380');
  expect(screen.getByTestId('collapsible-left-slot').dataset.defaultSize).toBe('380');
  expect(screen.getByTestId('collapsible-right-slot').className).toContain('pointer-events-auto');
  expect(screen.getByTestId('collapsible-right-slot').className).toContain('min-w-0');
  expect(screen.getByTestId('collapsible-right-slot').className).toContain('bg-transparent');

  const workflowContentLayer = screen.getByTestId('workflow-content').parentElement;
  expect(workflowContentLayer?.className).toContain('absolute');
  expect(workflowContentLayer?.className).toContain('inset-0');
  expect(workflowContentLayer?.className).toContain('overflow-y-auto');

  const workflowRoot = workflowContentLayer?.parentElement;
  expect(workflowRoot?.style.getPropertyValue('--workflow-left-panel-width')).toBe('372px');

  fireEvent.click(screen.getByRole('button', { name: 'resize left-slot' }));
  expect(workflowRoot?.style.getPropertyValue('--workflow-left-panel-width')).toBe('512px');
}

describe('resizable service layouts', () => {
  it('keeps the agent panel group shrinkable when side slots are present', () => {
    render(
      <AgentLayout agentId="chef-agent" leftSlot={<div>threads</div>} rightSlot={<div>agent information</div>}>
        <div>chat</div>
      </AgentLayout>,
    );

    expectAgentResizableLayoutContract(['grid', 'overflow-y-auto']);
  });

  it('keeps the workflow panel group shrinkable when side slots are present', () => {
    render(
      <WorkflowLayout workflowId="workflow-id" leftSlot={<div>runs</div>} rightSlot={<div>workflow information</div>}>
        <div data-testid="workflow-content">workflow run</div>
      </WorkflowLayout>,
    );

    expectWorkflowFloatingLayoutContract();
  });
});
