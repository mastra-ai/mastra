// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';

import { AppFrame } from '../app-shell';
import { SessionPageFrame } from './index';

afterEach(cleanup);

function Action() {
  const [open, setOpen] = useState(false);
  return <button onClick={() => setOpen(!open)}>{open ? 'Close files' : 'Open files'}</button>;
}

it('keeps the header action open when the centered status arrives, without Factory providers', () => {
  const layout = (showStatus: boolean) => (
    <AppFrame sidebar={<nav aria-label="Workspace" />} mobileHeader={<span>Mobile navigation</span>}>
      <SessionPageFrame
        breadcrumbs={<h1>Session</h1>}
        headerCenter={showStatus ? <span>In review</span> : undefined}
        headerActions={<Action />}
      >
        <p>Transcript</p>
      </SessionPageFrame>
    </AppFrame>
  );

  const { rerender } = render(layout(false));
  fireEvent.click(screen.getByRole('button', { name: 'Open files' }));
  rerender(layout(true));

  const header = screen.getByRole('banner');
  expect(header.contains(screen.getByRole('heading', { name: 'Session' }))).toBe(true);
  expect(header.contains(screen.getByText('In review'))).toBe(true);
  expect(header.contains(screen.getByRole('button', { name: 'Close files' }))).toBe(true);
  expect(screen.getByRole('main').textContent).toContain('Transcript');
  expect(screen.getByRole('navigation', { name: 'Workspace' })).toBeTruthy();
  expect(screen.getByText('Mobile navigation')).toBeTruthy();
});

it('renders docked actions once, outside the header', () => {
  render(
    <SessionPageFrame
      breadcrumbs={<h1>Session</h1>}
      headerActions={<Action />}
      dockActions={actions => <aside aria-label="File dock">{actions}</aside>}
    >
      <p>Transcript</p>
    </SessionPageFrame>,
  );

  const action = screen.getByRole('button', { name: 'Open files' });
  expect(screen.getByRole('complementary', { name: 'File dock' }).contains(action)).toBe(true);
  expect(screen.getByRole('banner').contains(action)).toBe(false);
});
