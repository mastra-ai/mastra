// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowLayout } from '../../../workflows/components/workflow-layout';
import { AgentLayout } from '../agent-layout';

const { mockUseIsMobile } = vi.hoisted(() => ({
  mockUseIsMobile: vi.fn(() => false),
}));

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
    Drawer: ({
      side,
      variant,
      open,
      onOpenChange,
      children,
    }: {
      side?: 'left' | 'right' | 'top' | 'bottom';
      variant?: 'default' | 'floating';
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
      children: ReactNode;
    }) =>
      open ? (
        <aside data-testid={`drawer-${side}`} data-variant={variant}>
          {children}
          <button type="button" onClick={() => onOpenChange?.(false)}>
            dismiss drawer
          </button>
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
    useIsMobile: mockUseIsMobile,
  };
});

afterEach(() => {
  cleanup();
  mockUseIsMobile.mockReturnValue(false);
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

    // … and no right panel is allocated until a right slot is present.
    expect(screen.queryByTestId('panel-right-slot')).toBeNull();
    expect(screen.queryByTestId('collapsible-right-slot')).toBeNull();
  });

  it('renders the agent right slot in a floating desktop drawer', () => {
    render(
      <AgentLayout agentId="chef-agent" leftSlot={<div>threads</div>} rightSlot={<div>artifact preview</div>}>
        <div>chat</div>
      </AgentLayout>,
    );

    expectPanelGroupsShrinkable();
    expectMainPanelContract(['grid', 'overflow-y-auto']);
    expect(screen.getByTestId('panel-left-slot').className).toContain('min-w-0');
    expect(screen.queryByTestId('collapsible-right-slot')).toBeNull();
    expect(screen.getByTestId('drawer-right').getAttribute('data-variant')).toBe('floating');
    expect(screen.getByTestId('drawer-content').className).toContain('overflow-hidden');
    expect(screen.getByTestId('drawer-content').getAttribute('data-show-close-button')).toBe('false');
    expect(screen.getByText('Open right panel').className).toContain('sr-only');
    expect(screen.getByText('artifact preview')).toBeTruthy();
  });

  it('notifies when the agent floating drawer is dismissed', () => {
    const onRightDrawerOpenChange = vi.fn();

    render(
      <AgentLayout
        agentId="chef-agent"
        rightSlot={<div>artifact preview</div>}
        onRightDrawerOpenChange={onRightDrawerOpenChange}
      >
        <div>chat</div>
      </AgentLayout>,
    );

    fireEvent.click(screen.getByText('dismiss drawer'));

    expect(onRightDrawerOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps the left slot in a panel drawer and the right slot in a floating drawer on mobile', () => {
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
