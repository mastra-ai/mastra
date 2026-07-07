import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { OverlaysProvider, useOverlays } from '../../../../lib/overlays';
import { ChatHeader } from '../ChatHeader';

/** Exposes the sidebar overlay state so the spec can observe toggling. */
function SidebarStateProbe() {
  const overlays = useOverlays();
  return <output data-testid="sidebar-state">{overlays.isOpen('sidebar') ? 'open' : 'closed'}</output>;
}

describe('ChatHeader', () => {
  describe('when the user clicks the sidebar toggle', () => {
    it('toggles the sidebar overlay open and closed', async () => {
      render(
        <OverlaysProvider>
          <ChatHeader />
          <SidebarStateProbe />
        </OverlaysProvider>,
      );

      expect(screen.getByTestId('sidebar-state')).toHaveTextContent('closed');

      await userEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
      expect(screen.getByTestId('sidebar-state')).toHaveTextContent('open');

      await userEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
      expect(screen.getByTestId('sidebar-state')).toHaveTextContent('closed');
    });
  });
});
