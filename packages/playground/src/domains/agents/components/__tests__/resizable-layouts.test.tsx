import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode, Ref } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowLayout } from '../../../workflows/components/workflow-layout';
import type * as AgentsContext from '../../context';
import { AgentLayout } from '../agent-layout';

const resizeLeftPanel = vi.hoisted(() => vi.fn());
const memoryTimelineState = vi.hoisted(() => ({ isPanelOpen: false }));
const defaultLayoutId = vi.hoisted(() => ({ value: '' }));

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
  useDefaultLayout: ({ id }: { id: string }) => {
    defaultLayoutId.value = id;
    return { defaultLayout: undefined, onLayoutChange: vi.fn() };
  },
}));

vi.mock('../../context', async () => {
  const actual = await vi.importActual<typeof AgentsContext>('../../context');

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

vi.mock('@mastra/playground-ui/resize/collapsible-panel', () => ({
  CollapsiblePanel: ({ id, className, children }: { id?: string; className?: string; children: ReactNode }) => (
    <aside data-testid={`collapsible-${id}`} className={className}>
      {children}
    </aside>
  ),
}));

vi.mock('@mastra/playground-ui/resize/separator', () => ({
  PanelSeparator: () => <div data-testid="panel-separator" />,
}));

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

  it('expands the single left slot to 50% when observational memory opens and restores it on close', async () => {
    const { rerender } = render(
      <AgentLayout agentId="chef-agent" leftSlot={<div>threads and observational memory</div>}>
        <div>chat</div>
      </AgentLayout>,
    );

    // Persisted layout key is bumped so stale narrow widths cannot hide the OM detail.
    expect(defaultLayoutId.value).toBe('agent-layout-v6-chef-agent');

    // There is no separate adjacent OM slot — the OM detail replaces content in the one left panel.
    expect(screen.queryByTestId('panel-left-adjacent-slot')).toBeNull();
    const leftPanel = screen.getByTestId('panel-left-slot');
    const mainPanel = screen.getByTestId('panel-main-slot');
    expect(leftPanel.compareDocumentPosition(mainPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Opening OM widens the single left panel to ~50% (max-size config permits it).
    memoryTimelineState.isPanelOpen = true;
    rerender(
      <AgentLayout agentId="chef-agent" leftSlot={<div>threads and observational memory</div>}>
        <div>chat</div>
      </AgentLayout>,
    );

    expect(screen.getByTestId('panel-left-slot').getAttribute('data-max-size')).toBe('50%');
    await waitFor(() => expect(resizeLeftPanel).toHaveBeenCalledWith('50%'));

    // Closing OM restores the previously captured size.
    resizeLeftPanel.mockClear();
    memoryTimelineState.isPanelOpen = false;
    rerender(
      <AgentLayout agentId="chef-agent" leftSlot={<div>threads and observational memory</div>}>
        <div>chat</div>
      </AgentLayout>,
    );

    await waitFor(() => expect(resizeLeftPanel).toHaveBeenCalledWith('300px'));
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
