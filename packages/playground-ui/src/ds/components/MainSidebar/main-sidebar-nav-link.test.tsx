// @vitest-environment jsdom

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, assert, beforeAll, describe, expect, it, vi } from 'vitest';

import { MainSidebarProvider } from './main-sidebar-context';
import { MainSidebarNavLink } from './main-sidebar-nav-link';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/ds/components/Tooltip';

const getTooltipPopup = () => {
  const popup = document.querySelector<HTMLElement>('.bg-surface3');
  assert(popup, 'Expected tooltip popup');
  return popup;
};

// MainSidebarProvider reads matchMedia at mount to decide mobile vs desktop.
// jsdom does not implement it, so polyfill before any render.
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }
});

afterEach(() => cleanup());

// Floating UI / Base UI computes the arrow `transform` from the trigger's
// bounding rect. jsdom returns zeros for layout, so this suite does NOT assert
// absolute pixel positions. Instead it asserts the invariants that broke the
// sidebar arrow in production:
//
//  1. The trigger is rendered as the real DOM element passed to `render` (an
//     `<a>` from the consumer), so Floating UI anchors to the right node.
//  2. The popup className does NOT contain CSS margin utilities. A margin on
//     the popup shifts it AFTER Floating UI has positioned the anchor, so the
//     arrow stays at the calculated anchor while the popup drifts away —
//     producing an arrow stranded in the middle of empty space.

describe('MainSidebarNavLink (collapsed) — tooltip regression', () => {
  it('applies a pointer cursor to sidebar nav items', () => {
    render(
      <ul>
        <MainSidebarNavLink state="default" link={{ name: 'Agents', url: '/agents' }} />
      </ul>,
    );

    expect(screen.getByRole('link', { name: 'Agents' }).className).toContain('cursor-pointer');
  });

  it('renders the trigger as a real <a> so Floating UI can anchor to it', () => {
    render(
      <MainSidebarProvider defaultState="collapsed">
        <TooltipProvider delay={0}>
          <ul>
            <MainSidebarNavLink state="collapsed" link={{ name: 'Agents', url: '/agents' }} />
          </ul>
        </TooltipProvider>
      </MainSidebarProvider>,
    );

    const trigger = screen.getByRole('link', { name: 'Agents' });
    expect(trigger.tagName).toBe('A');
    expect(trigger.getAttribute('href')).toBe('/agents');
  });

  it('throws when asChild receives a non-element child', () => {
    expect(() =>
      render(
        <ul>
          <MainSidebarNavLink asChild>Agents</MainSidebarNavLink>
        </ul>,
      ),
    ).toThrow(/asChild.*SlottedNavChildProps.*itemClassName/);
  });

  it('hides nested subitems in collapsed icon-only mode', () => {
    render(
      <ul>
        <MainSidebarNavLink
          state="collapsed"
          link={{ name: 'Agents', url: '/agents' }}
          subItems={
            <ul>
              <MainSidebarNavLink state="collapsed" link={{ name: 'Templates', url: '/agents/templates' }} />
            </ul>
          }
        />
      </ul>,
    );

    expect(screen.getByRole('link', { name: 'Agents' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Templates' })).toBeNull();
  });

  it('does not apply CSS margin utilities on TooltipContent that would dislocate the arrow', async () => {
    render(
      <TooltipProvider delay={0}>
        {/* Force the tooltip open so the popup is mounted and inspectable. */}
        <TooltipPrimitive.Root open>
          <TooltipTrigger render={<a href="/agents">Agents</a>} />
          <TooltipContent side="right" align="center" sideOffset={16}>
            Agents tooltip
          </TooltipContent>
        </TooltipPrimitive.Root>
      </TooltipProvider>,
    );

    // The Positioner and Popup both expose data-side. Target the Popup
    // specifically via its unique design-system class (bg-surface3) so the
    // assertions cannot accidentally pass against the Positioner wrapper.
    const popup = await waitFor(getTooltipPopup);

    // Critical: no margin classes on the popup. Margins shift the popup AFTER
    // Floating UI calculated the arrow's anchor; use `sideOffset` instead.
    expect(popup.className).not.toMatch(/(^|\s)-?m[trblxy]?-(\[|\d|auto)/);
  });

  it('renders the popup with a data-side attribute so the arrow can pick its rotation', async () => {
    render(
      <TooltipProvider delay={0}>
        <TooltipPrimitive.Root open>
          <TooltipTrigger render={<a href="#trigger">trigger</a>} />
          <TooltipContent side="right" align="center" sideOffset={16}>
            content
          </TooltipContent>
        </TooltipPrimitive.Root>
      </TooltipProvider>,
    );

    // The Positioner and Popup both expose data-side. Target the Popup
    // specifically via its unique design-system class (bg-surface3) so the
    // assertions cannot accidentally pass against the Positioner wrapper.
    const popup = await waitFor(getTooltipPopup);

    // jsdom has no layout, so Floating UI may flip the requested side away
    // from "right". Assert only that *some* side is set, which proves the
    // positioner saw a real trigger ref.
    expect(popup.getAttribute('data-side')).toMatch(/^(top|bottom|left|right)$/);
  });

  it('exposes role="tooltip" on the popup so consumers can query via getByRole("tooltip")', async () => {
    // Regression: Base UI's Popup does not set role="tooltip" automatically
    // (unlike Radix). Several Playwright E2E tests assert on `getByRole`, so
    // the wrapper must add it explicitly. Without this the agent observability
    // tab tests fail with a 5s tooltip-not-found timeout.
    render(
      <TooltipProvider delay={0}>
        <TooltipPrimitive.Root open>
          <TooltipTrigger asChild>
            <button type="button">Traces</button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Add @mastra/observability to enable this tab.</TooltipContent>
        </TooltipPrimitive.Root>
      </TooltipProvider>,
    );

    const popup = await waitFor(getTooltipPopup);

    expect(popup.getAttribute('role')).toBe('tooltip');
  });
});

describe('MainSidebarNavLink custom rows', () => {
  it('keeps the rendered item and trailing action independently interactive', () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();

    render(
      <ul>
        <MainSidebarNavLink
          link={{ name: 'Feature work', url: '/sessions/feature-work' }}
          size="sm"
          render={
            <button type="button" onClick={onOpen}>
              Feature work
            </button>
          }
          action={
            <button type="button" onClick={onDelete}>
              Delete session
            </button>
          }
        />
      </ul>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Feature work' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));

    expect(onOpen).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });
});

describe('TooltipTrigger render prop', () => {
  it('renders the consumer element directly so events attach to the real DOM node', () => {
    render(
      <TooltipProvider delay={0}>
        <Tooltip>
          <TooltipTrigger
            render={
              <a href="/x" data-testid="anchor">
                anchor
              </a>
            }
          />
          <TooltipContent>content</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    const anchor = screen.getByTestId('anchor');
    expect(anchor.tagName).toBe('A');
    expect(anchor.getAttribute('href')).toBe('/x');
  });
});
