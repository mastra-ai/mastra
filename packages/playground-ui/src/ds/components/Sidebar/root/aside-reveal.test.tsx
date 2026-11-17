// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AsideReveal, Sidebar, SidebarProvider } from '..';
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

function SessionPage() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <p>Session transcript</p>
      <button type="button" onClick={() => setOpen(true)}>
        Show details
      </button>
      <AsideReveal open={open} onOpenChange={setOpen} label="Session panel">
        <p>Changed files</p>
      </AsideReveal>
    </>
  );
}

function renderApp({ shortcut = false }: { shortcut?: boolean } = {}) {
  const view = render(
    <SidebarProvider disableKeyboardShortcut={!shortcut}>
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
        <SessionPage />
      </AppShell>
    </SidebarProvider>,
  );
  for (const panel of document.querySelectorAll(
    '[data-sidebar-reveal-layer="panel"], [data-aside-reveal-layer="panel"]',
  )) {
    Object.defineProperty(panel, 'offsetWidth', { configurable: true, value: PANEL_WIDTH });
  }
  return view;
}

function touch(type: 'touchstart' | 'touchmove' | 'touchend', target: Element, x: number, timeStamp: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const point = { identifier: 1, clientX: x, clientY: 300 };
  Object.defineProperties(event, {
    touches: { value: type === 'touchend' ? [] : [point] },
    changedTouches: { value: [point] },
    timeStamp: { value: timeStamp },
  });
  fireEvent(target, event);
}

function drag(target: Element, from: number, to: number) {
  touch('touchstart', target, from, 0);
  touch('touchmove', target, from + Math.sign(to - from) * 10, 16);
  touch('touchmove', target, (from + to) / 2, 200);
  touch('touchmove', target, to, 400);
  touch('touchend', target, to, 420);
}

const sessionPanel = () => screen.queryByRole('dialog', { name: 'Session panel' });
const navigation = () => screen.queryByRole('dialog', { name: 'Navigation' });
const transcript = () => screen.getByText('Session transcript');

describe('AsideReveal', () => {
  describe('when the page is dragged left past halfway and released', () => {
    it('opens the panel and leaves navigation closed', () => {
      renderApp();
      drag(transcript(), 350, 100);

      expect(sessionPanel()).not.toBeNull();
      expect(screen.getByText('Changed files')).toBeTruthy();
      expect(navigation()).toBeNull();
    });
  });

  describe('when the page is dragged right', () => {
    it('opens navigation, not the panel', () => {
      renderApp();
      drag(transcript(), 20, 250);

      expect(navigation()).not.toBeNull();
      expect(sessionPanel()).toBeNull();
    });
  });

  describe('when the page is nudged left a few pixels and released', () => {
    it('springs back closed', () => {
      renderApp();
      touch('touchstart', transcript(), 350, 0);
      touch('touchmove', transcript(), 340, 16);
      touch('touchmove', transcript(), 325, 200);
      touch('touchend', transcript(), 325, 220);

      expect(sessionPanel()).toBeNull();
    });
  });

  describe('while the panel is open', () => {
    it('closes on a rightward drag without opening navigation', async () => {
      renderApp();
      await userEvent.click(screen.getByRole('button', { name: 'Show details' }));
      expect(sessionPanel()).not.toBeNull();

      drag(screen.getByText('Changed files'), 100, 350);

      expect(sessionPanel()).toBeNull();
      expect(navigation()).toBeNull();
    });

    it('closes on Escape and returns the page to the panel-less state', async () => {
      renderApp();
      await userEvent.click(screen.getByRole('button', { name: 'Show details' }));
      await userEvent.keyboard('{Escape}');

      expect(sessionPanel()).toBeNull();
      await waitFor(() => expect(screen.queryByText('Changed files')).toBeNull());
    });

    it('closes when the uncovered page is tapped', async () => {
      renderApp();
      await userEvent.click(screen.getByRole('button', { name: 'Show details' }));
      await userEvent.click(screen.getByRole('button', { name: 'Close session panel' }));

      expect(sessionPanel()).toBeNull();
    });

    it('returns focus to the control that opened it, even without a trigger ref', async () => {
      renderApp();
      const opener = screen.getByRole('button', { name: 'Show details' });
      await userEvent.click(opener);
      expect(document.activeElement).not.toBe(opener);

      await userEvent.keyboard('{Escape}');

      expect(document.activeElement).toBe(opener);
    });

    it('ignores the sidebar shortcut, so navigation never opens over the panel', async () => {
      renderApp({ shortcut: true });
      await userEvent.click(screen.getByRole('button', { name: 'Show details' }));

      fireEvent.keyDown(window, { code: 'KeyB', key: 'b', ctrlKey: true });

      expect(navigation()).toBeNull();
      expect(sessionPanel()).not.toBeNull();
    });
  });

  describe('while navigation is open', () => {
    it('closes navigation on a leftward drag without opening the panel', async () => {
      renderApp();
      await userEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
      expect(navigation()).not.toBeNull();

      drag(screen.getByRole('link', { name: 'Agents' }), 280, 20);

      expect(navigation()).toBeNull();
      expect(sessionPanel()).toBeNull();
    });
  });

  describe('after the panel settles closed', () => {
    it('lets a rightward drag open navigation again', async () => {
      renderApp();
      await userEvent.click(screen.getByRole('button', { name: 'Show details' }));
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByText('Changed files')).toBeNull());

      drag(transcript(), 20, 250);

      expect(navigation()).not.toBeNull();
    });
  });
});
