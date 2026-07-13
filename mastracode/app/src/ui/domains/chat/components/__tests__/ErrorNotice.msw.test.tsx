import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { OverlaysProvider, useOverlays } from '../../../../lib/overlays';
import { ErrorNotice } from '../ErrorNotice';

function OverlayState() {
  const overlays = useOverlays();
  return (
    <output aria-label="Open error resolution">
      {overlays.isOpen('provider-settings')
        ? 'provider-settings'
        : overlays.isOpen('model-settings')
          ? 'model-settings'
          : overlays.isOpen('settings')
            ? 'settings'
            : 'none'}
    </output>
  );
}

function renderNotice(message: string) {
  return render(
    <OverlaysProvider>
      <ErrorNotice message={message} />
      <OverlayState />
    </OverlaysProvider>,
  );
}

describe('ErrorNotice', () => {
  it('given invalid credentials, shows the actual error and routes to model or provider settings', async () => {
    const user = userEvent.setup();
    renderNotice('undefined: The security token included in the request is invalid.');

    expect(screen.getByText('The security token included in the request is invalid.')).toBeInTheDocument();
    expect(screen.queryByText(/^undefined:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Check the selected model credentials/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Choose model' }));
    expect(screen.getByLabelText('Open error resolution')).toHaveTextContent('model-settings');

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByLabelText('Open error resolution')).toHaveTextContent('provider-settings');
  });

  it('given a provider usage limit, routes directly to another model', async () => {
    const user = userEvent.setup();
    renderNotice('You have reached your usage limit');

    expect(screen.getByText('Provider limit reached')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Choose model' }));
    expect(screen.getByLabelText('Open error resolution')).toHaveTextContent('model-settings');
  });

  it('given an unclassified error, keeps the exact message and opens general settings', async () => {
    const user = userEvent.setup();
    renderNotice('The request could not be completed');

    expect(screen.getByText('The request could not be completed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review settings' }));
    expect(screen.getByLabelText('Open error resolution')).toHaveTextContent('settings');
  });
});
