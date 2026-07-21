import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import { useOverlays } from '../../../../lib/overlays';
import { ChatOverlays } from '../ChatOverlays';
import { OverlayTestProviders, useOverlayControllerHandlers } from './overlay-test-utils';

function OverlayLauncher() {
  const { open } = useOverlays();
  return (
    <>
      <button onClick={() => open('shortcuts')}>Shortcuts</button>
      <ChatOverlays />
    </>
  );
}

function renderOverlays() {
  return renderWithProviders(
    <OverlayTestProviders>
      <OverlayLauncher />
    </OverlayTestProviders>,
  );
}

beforeEach(useOverlayControllerHandlers);

describe('ChatOverlays', () => {
  it('mounts and closes the keyboard-shortcuts dialog', async () => {
    const user = userEvent.setup();
    renderOverlays();

    await user.click(screen.getByRole('button', { name: 'Shortcuts' }));
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
  });
});
