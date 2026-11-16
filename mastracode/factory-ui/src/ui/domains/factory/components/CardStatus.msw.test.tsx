import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../e2e/ui/render';
import { CardStatus } from './BoardCardParts';

const label =
  'The GitHub Issues board does not allow moving from build to triage. Next stages declared from build: done, cancelled.';

function renderStatus(props: Parameters<typeof CardStatus>[0]) {
  return renderWithProviders(
    <TooltipProvider>
      <CardStatus {...props} />
    </TooltipProvider>,
  );
}

describe('CardStatus', () => {
  it('keeps a list-row error to one truncated line and puts the full message in the tooltip', async () => {
    const user = userEvent.setup();
    renderStatus({ status: { kind: 'error', label }, compact: true });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(label);
    expect(alert.querySelector('span')).toHaveClass('truncate');
    expect(alert.querySelector('span')).not.toHaveClass('wrap-anywhere');

    await user.hover(alert);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(label);
  });

  it('shows both the message and the raw detail in a compact error tooltip', async () => {
    const user = userEvent.setup();
    renderStatus({ status: { kind: 'error', label: 'Move failed', detail: 'HTTP 409: conflict' }, compact: true });

    await user.hover(screen.getByRole('alert'));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Move failed');
    expect(tooltip).toHaveTextContent('HTTP 409: conflict');
  });

  it('lets a card error wrap in place with no tooltip', () => {
    renderStatus({ status: { kind: 'error', label } });

    const alert = screen.getByRole('alert');
    expect(alert.querySelector('span')).toHaveClass('wrap-anywhere');
    expect(alert).not.toHaveAttribute('tabindex');
  });
});
