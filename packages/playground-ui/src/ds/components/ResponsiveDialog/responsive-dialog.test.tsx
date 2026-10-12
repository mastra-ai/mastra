// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from './responsive-dialog';

const PHONE_QUERY = '(max-width: 639px)';

let phoneMatches = false;
const phoneListeners = new Set<() => void>();

const setPhoneViewport = (matches: boolean) => {
  phoneMatches = matches;
  phoneListeners.forEach(listener => listener());
};

beforeEach(() => {
  phoneMatches = false;
  phoneListeners.clear();
  vi.spyOn(window, 'matchMedia').mockImplementation(
    query =>
      ({
        get matches() {
          return query === PHONE_QUERY && phoneMatches;
        },
        media: query,
        addEventListener: (_event: string, listener: () => void) => phoneListeners.add(listener),
        removeEventListener: (_event: string, listener: () => void) => phoneListeners.delete(listener),
      }) as unknown as MediaQueryList,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renderResponsiveDialog = () =>
  render(
    <ResponsiveDialog>
      <ResponsiveDialogTrigger>Open</ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Edit agent</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>Body content</ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>,
  );

const isDrawer = () => document.querySelector('[data-slot="drawer-popup"]') !== null;
const isDialog = () => document.querySelector('[data-slot="dialog-content"]') !== null;

describe('ResponsiveDialog', () => {
  it('opens a centered dialog above the phone breakpoint', () => {
    renderResponsiveDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('heading', { name: 'Edit agent' })).toBeDefined();
    expect(isDialog()).toBe(true);
    expect(isDrawer()).toBe(false);
  });

  it('opens a bottom drawer on a phone viewport', () => {
    setPhoneViewport(true);
    renderResponsiveDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('heading', { name: 'Edit agent' })).toBeDefined();
    expect(isDrawer()).toBe(true);
    expect(isDialog()).toBe(false);
  });

  it('stays open when the viewport crosses the phone breakpoint', () => {
    renderResponsiveDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(isDialog()).toBe(true);

    act(() => setPhoneViewport(true));

    expect(screen.getByText('Body content')).toBeDefined();
    expect(isDrawer()).toBe(true);
  });
});
