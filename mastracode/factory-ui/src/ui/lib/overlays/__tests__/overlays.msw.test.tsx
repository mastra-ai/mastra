import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { OverlaysProvider, useOverlays } from '../overlays';
import type { OverlayName } from '../overlays';

const OVERLAY_NAMES: OverlayName[] = ['search', 'sidebar', 'shortcuts', 'models'];

function Probe() {
  const overlays = useOverlays();
  return (
    <div>
      {OVERLAY_NAMES.map(name => (
        <div key={name}>
          <span data-testid={`state-${name}`}>{overlays.isOpen(name) ? 'open' : 'closed'}</span>
          <button onClick={() => overlays.open(name)}>open {name}</button>
          <button onClick={() => overlays.close(name)}>close {name}</button>
          <button onClick={() => overlays.toggle(name)}>toggle {name}</button>
        </div>
      ))}
    </div>
  );
}

function renderProbe() {
  return render(
    <OverlaysProvider>
      <Probe />
    </OverlaysProvider>,
  );
}

function stateOf(name: OverlayName) {
  return screen.getByTestId(`state-${name}`).textContent;
}

describe('OverlaysProvider', () => {
  it('given a fresh provider, then every overlay starts closed', () => {
    renderProbe();

    for (const name of OVERLAY_NAMES) {
      expect(stateOf(name)).toBe('closed');
    }
  });

  it('given a closed overlay, when opened, then only that overlay reports open', async () => {
    renderProbe();

    await userEvent.click(screen.getByRole('button', { name: 'open shortcuts' }));

    expect(stateOf('shortcuts')).toBe('open');
    for (const name of OVERLAY_NAMES.filter(n => n !== 'shortcuts')) {
      expect(stateOf(name)).toBe('closed');
    }
  });

  it('given two open overlays, when one is closed, then the other stays open', async () => {
    renderProbe();

    await userEvent.click(screen.getByRole('button', { name: 'open shortcuts' }));
    await userEvent.click(screen.getByRole('button', { name: 'open sidebar' }));
    await userEvent.click(screen.getByRole('button', { name: 'close shortcuts' }));

    expect(stateOf('shortcuts')).toBe('closed');
    expect(stateOf('sidebar')).toBe('open');
  });

  it('given an overlay, when toggled twice, then it returns to closed', async () => {
    renderProbe();

    await userEvent.click(screen.getByRole('button', { name: 'toggle shortcuts' }));
    expect(stateOf('shortcuts')).toBe('open');

    await userEvent.click(screen.getByRole('button', { name: 'toggle shortcuts' }));
    expect(stateOf('shortcuts')).toBe('closed');
  });

  it('given no provider, when useOverlays is called, then it throws a descriptive error', () => {
    expect(() => render(<Probe />)).toThrow('useOverlays must be used within an OverlaysProvider');
  });
});
