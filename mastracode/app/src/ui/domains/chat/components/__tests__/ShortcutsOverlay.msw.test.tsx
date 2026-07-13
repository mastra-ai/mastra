import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '#test/render';

import { ShortcutsOverlay } from '../../index';
import { OverlayTestProviders, useOverlayControllerHandlers } from './overlay-test-utils';

beforeEach(useOverlayControllerHandlers);

describe('ShortcutsOverlay', () => {
  it('shows its shortcuts from the overlay provider stack', () => {
    renderWithProviders(
      <OverlayTestProviders>
        <ShortcutsOverlay />
      </OverlayTestProviders>,
    );
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    expect(screen.getByText('Open the command palette')).toBeInTheDocument();
    expect(screen.getByText('Insert a newline')).toBeInTheDocument();
  });
});
