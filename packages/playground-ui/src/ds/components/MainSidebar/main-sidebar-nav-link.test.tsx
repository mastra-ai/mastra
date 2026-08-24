// @vitest-environment jsdom

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, assert, beforeAll, describe, expect, it, vi } from 'vitest';

import { useMobileDrawer } from './main-sidebar-context';
import { MainSidebarNavHeader } from './main-sidebar-nav-header';
import { MainSidebarNavLink } from './main-sidebar-nav-link';
import { MainSidebarProvider } from './main-sidebar-provider';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/ds/components/Tooltip';
import type { LinkComponentProps } from '@/ds/types/link-component';

const getTooltipPopup = () => {
  const popup = document.querySelector<HTMLElement>('.bg-surface3');
  assert(popup, 'Expected tooltip popup');
  return popup;
};

const DrawerToggle = () => {
  const { openMobile, setOpenMobile } = useMobileDrawer();
  return <button onClick={() => setOpenMobile(!openMobile)}>Toggle drawer</button>;
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
  it('does not re-render navigation rows when only the mobile drawer state changes', () => {
    const Link = vi.fn(({ children, ...props }: LinkComponentProps) => <a {...props}>{children}</a>);
    render(
      <MainSidebarProvider LinkComponent={Link}>
        <DrawerToggle />
        <MainSidebarNavHeader href="/workspace">Workspace</MainSidebarNavHeader>
        <ul>
          <MainSidebarNavLink link={{ name: 'Agents', url: '/agents' }} />
        </ul>
      </MainSidebarProvider>,
    );

    expect(Link).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle drawer' }));
    expect(Link).toHaveBeenCalledTimes(2);
  });

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

describe('MainSidebarNavLink — what it renders a row as', () => {
  const renderLink = (element: React.ReactElement) => render(<TooltipProvider>{element}</TooltipProvider>);

  it('refuses to be told twice how to render itself', () => {
    expect(() =>
      renderLink(
        <MainSidebarNavLink asChild render={<a href="/agents">Agents</a>}>
          <a href="/agents">Agents</a>
        </MainSidebarNavLink>,
      ),
    ).toThrow(/either `render` or `asChild`/);
  });

  it('hands back what it was given when there is no link to build', () => {
    const { container } = renderLink(<MainSidebarNavLink>just text</MainSidebarNavLink>);

    expect(container.textContent).toBe('just text');
    expect(container.querySelector('a')).toBeNull();
  });

  it.each([
    ['https://mastra.ai/docs', '_blank'],
    ['http://mastra.ai/docs', '_blank'],
    ['//mastra.ai/docs', '_blank'],
    ['/agents', ''],
    ['/redirect?to=https://mastra.ai', ''],
  ])('sends %s to %s', (url, target) => {
    renderLink(<MainSidebarNavLink link={{ name: 'Docs', url }} />);

    const anchor = screen.getByRole<HTMLAnchorElement>('link', { name: 'Docs' });
    expect(anchor.target).toBe(target);
    expect(anchor.rel).toBe(target === '_blank' ? 'noreferrer' : '');
  });

  it('marks a featured row so it reads apart from the rest', () => {
    const plain = renderLink(<MainSidebarNavLink link={{ name: 'Agents', url: '/agents' }} />);
    const plainClass = plain.container.querySelector('a')?.className ?? '';

    cleanup();

    const featured = renderLink(<MainSidebarNavLink link={{ name: 'Agents', url: '/agents', variant: 'featured' }} />);

    expect(featured.container.querySelector('a')?.className).not.toBe(plainClass);
  });

  it('wraps the row only when it has a trailing action to hold', () => {
    const plain = renderLink(<MainSidebarNavLink link={{ name: 'Agents', url: '/agents' }} />);
    expect(plain.container.querySelector('li > a')).toBeTruthy();

    cleanup();

    const withAction = renderLink(
      <MainSidebarNavLink link={{ name: 'Agents', url: '/agents' }} action={<button type="button">More</button>} />,
    );

    expect(withAction.container.querySelector('li > a')).toBeNull();
    expect(withAction.container.querySelector('li > div > a')).toBeTruthy();
  });

  it('keeps a caller class on the row it was told to render', () => {
    const { container } = renderLink(
      <MainSidebarNavLink
        render={<a href="/agents" className="my-own-class" />}
        link={{ name: 'Agents', url: '/agents' }}
      />,
    );

    const row = container.querySelector('a');
    expect(row?.classList.contains('my-own-class')).toBe(true);
    expect((row?.className.split(' ').length ?? 0) > 1).toBe(true);
  });

  it('keeps a caller class on a slotted row', () => {
    const { container } = renderLink(
      <MainSidebarNavLink asChild link={{ name: 'Agents', url: '/agents' }}>
        <a href="/agents" className="my-own-class">
          Agents
        </a>
      </MainSidebarNavLink>,
    );

    const row = container.querySelector('a');
    expect(row?.textContent).toBe('Agents');
    expect(row?.classList.contains('my-own-class')).toBe(true);
    expect((row?.className.split(' ').length ?? 0) > 1).toBe(true);
  });

  it('paints the whole row, action included, when it is the active one', () => {
    const inactive = renderLink(
      <MainSidebarNavLink link={{ name: 'Agents', url: '/agents' }} action={<button type="button">More</button>} />,
    );
    const inactiveClass = inactive.container.querySelector('li > div')?.className;

    cleanup();

    const active = renderLink(
      <MainSidebarNavLink
        isActive
        link={{ name: 'Agents', url: '/agents' }}
        action={<button type="button">More</button>}
      />,
    );

    expect(active.container.querySelector('li > div')?.className).not.toBe(inactiveClass);
  });

  it('indents a nested row that carries an action', () => {
    const flat = renderLink(
      <MainSidebarNavLink link={{ name: 'Agents', url: '/agents' }} action={<button type="button">More</button>} />,
    );
    const flatClass = flat.container.querySelector('li > div > a')?.className;

    cleanup();

    const nested = renderLink(
      <MainSidebarNavLink
        link={{ name: 'Agents', url: '/agents', indent: true }}
        action={<button type="button">More</button>}
      />,
    );

    expect(nested.container.querySelector('li > div > a')?.className).not.toBe(flatClass);
  });

  it('drops the trailing action on a collapsed rail, which has no room for it', () => {
    renderLink(
      <MainSidebarNavLink
        state="collapsed"
        link={{ name: 'Agents', url: '/agents' }}
        action={<button type="button">More</button>}
      />,
    );

    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });
});

describe('MainSidebarNavLink — how a row names itself', () => {
  const renderLink = (element: React.ReactElement) => render(<TooltipProvider>{element}</TooltipProvider>);
  const tooltipText = async () => (await screen.findByRole('tooltip')).textContent;

  it('says nothing extra while the label is on screen', () => {
    renderLink(<MainSidebarNavLink link={{ name: 'Agents', url: '/agents' }} />);

    fireEvent.focus(screen.getByRole('link', { name: 'Agents' }));

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('names itself while collapsed, since the label is hidden', async () => {
    renderLink(<MainSidebarNavLink state="collapsed" link={{ name: 'Agents', url: '/agents' }} />);

    fireEvent.focus(screen.getByRole('link'));

    expect(await tooltipText()).toBe('Agents');
  });

  it('says what the caller wrote while the label is on screen', async () => {
    renderLink(<MainSidebarNavLink link={{ name: 'Agents', url: '/agents', tooltipMsg: 'Your agents' }} />);

    fireEvent.focus(screen.getByRole('link', { name: 'Agents' }));

    expect(await tooltipText()).toBe('Your agents');
  });

  it('says both while collapsed', async () => {
    renderLink(
      <MainSidebarNavLink state="collapsed" link={{ name: 'Agents', url: '/agents', tooltipMsg: 'Your agents' }} />,
    );

    fireEvent.focus(screen.getByRole('link'));

    expect(await tooltipText()).toBe('Agents | Your agents');
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
