// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Sidebar, SidebarProvider } from '..';
import { AppShell } from '@/ds/new/layout/app-shell';

const PANEL_WIDTH = 300;

beforeAll(() => {
  Element.prototype.getAnimations ??= () => [];
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

afterEach(() => cleanup());

function renderApp(page = <p>Agent overview</p>) {
  render(
    <SidebarProvider>
      <AppShell
        mobileHeader={<Sidebar.MobileTrigger />}
        sidebar={
          <Sidebar>
            <Sidebar.Nav>
              <Sidebar.NavList>
                <Sidebar.NavLink link={{ name: 'Agents', url: '/agents' }} />
              </Sidebar.NavList>
            </Sidebar.Nav>
          </Sidebar>
        }
      >
        {page}
      </AppShell>
    </SidebarProvider>,
  );
  const panel = document.querySelector('[data-sidebar-reveal-layer="panel"]');
  if (!panel) throw new Error('Sidebar reveal panel was not rendered');
  Object.defineProperty(panel, 'offsetWidth', { configurable: true, value: PANEL_WIDTH });
}

function touch(type: 'touchstart' | 'touchmove' | 'touchend', target: Element, x: number, timeStamp: number, y = 300) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const point = { identifier: 1, clientX: x, clientY: y };
  Object.defineProperties(event, {
    touches: { value: type === 'touchend' ? [] : [point] },
    changedTouches: { value: [point] },
    timeStamp: { value: timeStamp },
  });
  fireEvent(target, event);
  return event;
}

function swipe(target: Element, moves: Array<[x: number, timeStamp: number]>, release: number) {
  const [[startX]] = moves;
  touch('touchstart', target, startX, 0);
  for (const [x, timeStamp] of moves.slice(1)) touch('touchmove', target, x, timeStamp);
  touch('touchend', target, moves[moves.length - 1][0], release);
}

const navigation = () => screen.queryByRole('dialog', { name: 'Navigation' });
const trigger = () => screen.getByRole('button', { name: 'Open navigation menu' });
const scrim = () => screen.getByRole('button', { name: 'Close navigation menu', hidden: true });

describe('Sidebar mobile reveal', () => {
  describe('when the page is dragged right past halfway and released', () => {
    it('opens navigation', () => {
      renderApp();
      swipe(
        screen.getByText('Agent overview'),
        [
          [20, 0],
          [30, 16],
          [100, 200],
          [200, 400],
        ],
        420,
      );

      expect(navigation()).not.toBeNull();
    });
  });

  describe('when the page is dragged right past halfway and then back left before release', () => {
    it('stays closed', () => {
      renderApp();
      swipe(
        screen.getByText('Agent overview'),
        [
          [20, 0],
          [30, 16],
          [250, 300],
          [220, 500],
        ],
        520,
      );

      expect(navigation()).toBeNull();
    });
  });

  describe('when the page is flicked right in a single frame', () => {
    it('opens navigation even though the drag was short', () => {
      renderApp();
      swipe(
        screen.getByText('Agent overview'),
        [
          [20, 0],
          [70, 16],
        ],
        20,
      );

      expect(navigation()).not.toBeNull();
    });
  });

  describe('when the reader scrolls the page vertically', () => {
    it('leaves the scroll to the page and stays closed', () => {
      renderApp();
      const page = screen.getByText('Agent overview');

      touch('touchstart', page, 20, 0, 300);
      const move = touch('touchmove', page, 24, 16, 340);
      touch('touchend', page, 24, 20, 340);

      expect(move.defaultPrevented).toBe(false);
      expect(navigation()).toBeNull();
    });
  });

  describe('when the swipe starts inside a strip that can still scroll left', () => {
    it('scrolls the strip instead of opening navigation', () => {
      renderApp(
        <div data-testid="code-block" style={{ overflowX: 'auto' }}>
          <pre>const answer = 42;</pre>
        </div>,
      );
      const strip = screen.getByTestId('code-block');
      Object.defineProperties(strip, {
        scrollWidth: { configurable: true, value: 600 },
        clientWidth: { configurable: true, value: 300 },
        scrollLeft: { configurable: true, value: 120 },
      });

      touch('touchstart', strip, 20, 0);
      const move = touch('touchmove', strip, 60, 16);
      touch('touchend', strip, 60, 20);

      expect(move.defaultPrevented).toBe(false);
      expect(navigation()).toBeNull();
    });
  });

  describe('when navigation is open and the page strip is flicked left', () => {
    it('closes navigation and returns focus to the menu button', async () => {
      renderApp();
      fireEvent.click(trigger());

      swipe(
        scrim(),
        [
          [290, 0],
          [280, 16],
          [250, 24],
          [220, 32],
        ],
        36,
      );

      expect(navigation()).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(trigger()));
    });
  });

  describe('when navigation is open and the page is dragged left only partway, held, and released', () => {
    it('closes navigation instead of springing back open', () => {
      renderApp();
      fireEvent.click(trigger());

      swipe(
        scrim(),
        [
          [290, 0],
          [280, 16],
          [240, 200],
          [200, 400],
          [203, 416],
        ],
        700,
      );

      expect(navigation()).toBeNull();
    });
  });

  describe('when navigation is open and Escape is pressed', () => {
    it('closes navigation and returns focus to the menu button', async () => {
      renderApp();
      fireEvent.click(trigger());

      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

      expect(navigation()).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(trigger()));
    });
  });

  describe('when navigation is open', () => {
    it('keeps the page behind it out of reach', () => {
      renderApp();
      fireEvent.click(trigger());

      expect(screen.getByText('Agent overview').closest('[inert]')).not.toBeNull();
    });
  });
});
