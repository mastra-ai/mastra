// @vitest-environment jsdom
import type * as DrawerComponents from '@mastra/playground-ui/components/Drawer';
import type * as PlaygroundUi from '@mastra/playground-ui';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode, Ref } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowLayout } from '../../../workflows/components/workflow-layout';
import type * as AgentsContext from '../../context';
import { AgentLayout } from '../agent-layout';

const mockUseIsMobile = vi.hoisted(() => vi.fn(() => false));
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

vi.mock('@mastra/playground-ui/hooks/use-is-mobile', () => ({
  useIsMobile: mockUseIsMobile,
}));

vi.mock('@mastra/playground-ui/components/Drawer', async () => {
  const actual = await vi.importActual<typeof DrawerComponents>('@mastra/playground-ui/components/Drawer');

  return {
    ...actual,
    Drawer: ({
      side,
      variant,
      open,
      children,
    }: {
      side?: 'left' | 'right' | 'top' | 'bottom';
      variant?: 'default' | 'floating';
      open?: boolean;
      children: ReactNode;
    }) =>
      open ? (
        <aside data-testid={`drawer-${side}`} data-variant={variant}>
          {children}
        </aside>
      ) : null,
    DrawerContent: ({
      children,
      className,
      showCloseButton,
    }: {
      children: ReactNode;
      className?: string;
      showCloseButton?: boolean;
    }) => (
      <div data-testid="drawer-content" data-show-close-button={String(showCloseButton)} className={className}>
        {children}
      </div>
    ),
    DrawerTitle: ({ children, className }: { children: ReactNode; className?: string }) => (
      <h2 className={className}>{children}</h2>
    ),
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
    PanelDrawer: ({
      direction,
      label,
      children,
    }: {
      direction: 'left' | 'right';
      label: string;
      children: ReactNode;
    }) => (
      <aside data-testid={`panel-drawer-${direction}`} aria-label={label}>
        {children}
      </aside>
    ),
    PanelSeparator: () => <div data-testid="panel-separator" />,
  };
});

afterEach(() => {
  cleanup();
  mockUseIsMobile.mockReturnValue(false);
  resizeLeftPanel.mockClear();
  memoryTimelineState.isPanelOpen = false;
  defaultLayoutId.value = '';
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

describe('AgentLayout', () => {
  describe('when rendered on desktop', () => {
    it('keeps threads in a resizable left panel and artifacts in a floating drawer', () => {
      render(
        <AgentLayout agentId="chef-agent" leftSlot={<div>threads</div>} rightSlot={<div>artifact preview</div>}>
          <div>chat</div>
        </AgentLayout>,
      );

      expectPanelGroupsShrinkable();
      expectMainPanelContract(['grid', 'overflow-y-auto']);
      expect(screen.getByTestId('panel-left-slot').className).toContain('min-w-0');
      expect(screen.queryByTestId('collapsible-left-slot')).toBeNull();
      expect(screen.queryByTestId('panel-right-slot')).toBeNull();
      expect(screen.queryByTestId('collapsible-right-slot')).toBeNull();
      expect(screen.getByTestId('drawer-right').getAttribute('data-variant')).toBe('floating');
      expect(screen.getByTestId('drawer-content').className).toContain('overflow-hidden');
      expect(screen.getByTestId('drawer-content').getAttribute('data-show-close-button')).toBe('false');
      expect(screen.getByText('Open right panel').className).toContain('sr-only');
      expect(screen.getByText('artifact preview')).toBeTruthy();
    });

    it('does not allocate an artifact drawer when no artifact is selected', () => {
      render(
        <AgentLayout agentId="chef-agent" leftSlot={<div>threads</div>}>
          <div>chat</div>
        </AgentLayout>,
      );

      expect(screen.queryByTestId('drawer-right')).toBeNull();
      expect(screen.queryByTestId('panel-right-slot')).toBeNull();
    });

    it('expands the single left slot to 50% when observational memory opens and restores it on close', async () => {
      const { rerender } = render(
        <AgentLayout agentId="chef-agent" leftSlot={<div>threads and observational memory</div>}>
          <div>chat</div>
        </AgentLayout>,
      );

      expect(defaultLayoutId.value).toBe('agent-layout-v6-chef-agent');
      expect(screen.queryByTestId('panel-left-adjacent-slot')).toBeNull();
      expect(screen.getByTestId('panel-left-slot').compareDocumentPosition(screen.getByTestId('panel-main-slot'))).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );

      memoryTimelineState.isPanelOpen = true;
      rerender(
        <AgentLayout agentId="chef-agent" leftSlot={<div>threads and observational memory</div>}>
          <div>chat</div>
        </AgentLayout>,
      );

      expect(screen.getByTestId('panel-left-slot').getAttribute('data-max-size')).toBe('50%');
      await waitFor(() => expect(resizeLeftPanel).toHaveBeenCalledWith('50%'));

      resizeLeftPanel.mockClear();
      memoryTimelineState.isPanelOpen = false;
      rerender(
        <AgentLayout agentId="chef-agent" leftSlot={<div>threads and observational memory</div>}>
          <div>chat</div>
        </AgentLayout>,
      );

      await waitFor(() => expect(resizeLeftPanel).toHaveBeenCalledWith('300px'));
    });
  });

  describe('when rendered on mobile', () => {
    it('keeps threads in the left panel drawer and artifacts in the floating drawer', () => {
      mockUseIsMobile.mockReturnValue(true);

      render(
        <AgentLayout
          agentId="chef-agent"
          leftDrawerLabel="Open threads"
          leftSlot={<div>threads</div>}
          rightDrawerLabel="Open artifacts"
          rightSlot={<div>artifact preview</div>}
        >
          <div>chat</div>
        </AgentLayout>,
      );

      expect(screen.getByTestId('panel-drawer-left').getAttribute('aria-label')).toBe('Open threads');
      expect(screen.queryByTestId('panel-drawer-right')).toBeNull();
      expect(screen.getByTestId('drawer-right').getAttribute('data-variant')).toBe('floating');
      expect(screen.getByText('Open artifacts').className).toContain('sr-only');
      expect(screen.getByText('artifact preview')).toBeTruthy();
    });
  });
});

describe('WorkflowLayout', () => {
  describe('when side slots are present', () => {
    it('keeps the panel group shrinkable', () => {
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
});
