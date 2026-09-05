// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IntegrationDialog } from './integration-dialog';

const items = [
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'slack', name: 'Slack' },
  { id: 'stripe', name: 'Stripe', disabled: true },
];

afterEach(() => cleanup());

function renderDialog(props: Partial<Parameters<typeof IntegrationDialog>[0]> = {}) {
  const onSelect = vi.fn();
  render(<IntegrationDialog defaultOpen title="Add connection" items={items} onSelect={onSelect} {...props} />);
  return { onSelect };
}

describe('IntegrationDialog', () => {
  describe('when opened', () => {
    it('lists every integration by name', () => {
      renderDialog();
      expect(screen.getByRole('dialog', { name: 'Add connection' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Anthropic' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Slack' })).toBeDefined();
    });

    it('disables items marked disabled', () => {
      renderDialog();
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Stripe' }).disabled).toBe(true);
    });
  });

  describe('when an integration is clicked', () => {
    it('reports the item to the caller', () => {
      const { onSelect } = renderDialog();
      fireEvent.click(screen.getByRole('button', { name: 'Slack' }));
      expect(onSelect).toHaveBeenCalledWith(items[1]);
    });
  });

  describe('when the search matches an id', () => {
    it('filters the list', () => {
      renderDialog();
      fireEvent.change(screen.getByRole('textbox', { name: 'Search integrations' }), { target: { value: 'slac' } });
      expect(screen.queryByRole('button', { name: 'Anthropic' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Slack' })).toBeDefined();
    });
  });

  describe('when the search matches nothing', () => {
    it('shows the empty message with the query', () => {
      renderDialog();
      fireEvent.change(screen.getByRole('textbox', { name: 'Search integrations' }), { target: { value: 'zzz' } });
      expect(screen.getByRole('status').textContent).toBe('No integrations match “zzz”.');
    });
  });

  describe('when there are no integrations', () => {
    it('shows a custom empty message', () => {
      renderDialog({ items: [], emptyMessage: 'Nothing to connect yet.' });
      expect(screen.getByRole('status').textContent).toBe('Nothing to connect yet.');
    });
  });
});
