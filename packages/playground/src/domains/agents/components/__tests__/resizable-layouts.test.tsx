// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode, Ref } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowLayout } from '../../../workflows/components/workflow-layout';
import { AgentLayout } from '../agent-layout';

const resizeLeftPanel = vi.hoisted(() => vi.fn());
const memoryTimelineState = vi.hoisted(() => ({ isPanelOpen: false }));

vi.mock('react-resizable-panels', () => ({
  Group: ({ className, children }: { className?: string; children: ReactNode }) => (
    <div data-testid="panel-group" className={className}>
      {children}
    </div>
  ),
  Panel: ({
    id,
    className,
    children,
    panelRef,
    maxSize,
    defaultSize,
  }: {
    id?: string;
    className?: string;
    children: ReactNode;
    panelRef?: Ref<{ getSize: () => { inPixels: number; asPercentage: number }; resize: (size: string) => void }>;
    maxSize?: string | number;
    defaultSize?: string | number;
  }) => {
    if (id === 'left-slot' && panelRef) {
      const handle = {
        getSize: () => ({ inPixels: 300, asPercentage: 20 }),
        resize: resizeLeftPanel,
      };

      if (typeof panelRef === 'function') panelRef(handle);
      else panelRef.current = handle;
    }

    return (
      <section
        data-testid={`panel-${id}`}
        data-max-size={maxSize}
        data-default-size={defaultSize}
        className={className}
      >
        {children}
      </section>
    );
  },
  useDefaultLayout: () => ({ defaultLayout: undefined, onLayoutChange: vi.fn() }),
}));

vi.mock('../../context', async () => {
  const actual = await vi.importActual<typeof import('../../context')>('../../context');

  return {
    ...actual,
    useMemoryTimeline: () => ({
      isPanelOpen: memoryTimelineState.isPanelOpen,
      openPanel: vi.fn(),
      closePanel: vi.fn(),
      selectedTimestamp: null,
      setSelectedTimestamp: vi.fn(),
    }),
  };
});

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

afterEach(() => {
  cleanup();
  resizeLeftPanel.mockClear();
  memoryTimelineState.isPanelOpen = false;
});

function expectPanelGroupsShrinkable() {
  const panelGroups = screen.getAllByTestId('panel-group');
  expect(panelGroups.length).toBeGreaterThan(0);

  for (const panelGroup of panelGroups) {
    expect(panelGroup.className).toContain('h-full');
    expect(panelGroup.className).toContain('min-h-0');
    expect(panelGroup.className).toContain('w-full');
    expect(panelGroup.className).toContain('min-w-0');
    expect(panelGroup.className).not.toContain('min-w-min');
  }
}

function expectMainPanelContract(mainPanelClassNames: string[]) {
  const mainPanel = screen.getByTestId('panel-main-slot');
  expect(mainPanel.className).toContain('min-w-0');
  for (const className of mainPanelClassNames) {
    expect(mainPanel.className).toContain(className);
  }
}

describe('resizable service layouts', () => {
  it('renders the agent layout as a two-panel group with a non-collapsible left slot', () => {
    render(
      <AgentLayout agentId="chef-agent" leftSlot={<div>threads</div>}>
        <div>chat</div>
      </AgentLayout>,
    );

    expectPanelGroupsShrinkable();
    expectMainPanelContract(['grid', 'overflow-y-auto']);

    // The left slot is a plain resizable panel (no collapse affordance) …
    expect(screen.getByTestId('panel-left-slot').className).toContain('min-w-0');
    expect(screen.queryByTestId('collapsible-left-slot')).toBeNull();

    // … and the right slot only appears when a rightSlot is provided.
    expect(screen.queryByTestId('panel-right-slot')).toBeNull();
  });

  it('keeps observational memory detail inside the single expandable left slot', async () => {
    memoryTimelineState.isPanelOpen = true;

    render(
      <AgentLayout agentId="chef-agent" leftSlot={<div>threads and observational memory</div>}>
        <div>chat</div>
      </AgentLayout>,
    );

    const leftPanel = screen.getByTestId('panel-left-slot');
    const mainPanel = screen.getByTestId('panel-main-slot');
    expect(leftPanel.compareDocumentPosition(mainPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId('panel-left-adjacent-slot')).toBeNull();
    expect(leftPanel.getAttribute('data-max-size')).toBe('80%');
    expect(leftPanel.getAttribute('data-default-size')).toBe('760');
    await waitFor(() => expect(resizeLeftPanel).toHaveBeenCalledWith('760px'));
  });

  it('renders a resizable right slot when rightSlot is provided on desktop', () => {
    render(
      <AgentLayout agentId="chef-agent" leftSlot={<div>threads</div>} rightSlot={<div>memory studio</div>}>
        <div>chat</div>
      </AgentLayout>,
    );

    const rightPanel = screen.getByTestId('panel-right-slot');
    expect(rightPanel.className).toContain('min-w-0');
    expect(rightPanel.textContent).toContain('memory studio');
  });

  it('keeps the workflow panel group shrinkable when side slots are present', () => {
    render(
      <WorkflowLayout workflowId="workflow-id" leftSlot={<div>runs</div>} rightSlot={<div>workflow information</div>}>
        <div>workflow run</div>
      </WorkflowLayout>,
    );

    expectPanelGroupsShrinkable();
    expect(screen.getByTestId('collapsible-left-slot').className).toContain('min-w-0');
    expect(screen.getByTestId('collapsible-right-slot').className).toContain('min-w-0');
    expect(screen.getByText('workflow run').parentElement?.className).toContain('overflow-y-auto');
  });
});
