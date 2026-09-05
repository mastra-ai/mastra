// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IntegrationDialog } from './integration-dialog';
import { parseIntegrationName } from './parse-integration-name';

const items = [
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'slack', name: 'Slack' },
  { id: 'stripe', name: 'Stripe', disabled: true },
  { id: 'render-mcp', name: 'Render (MCP)' },
  { id: 'sanity-mcp', name: 'Sanity', badge: 'MCP' },
  { id: 'notion', name: 'Notion', authType: 'OAUTH2' },
  { id: 'replicate-mcp', name: 'Replicate (MCP)', authType: 'MCP_OAUTH2' },
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

describe('parseIntegrationName', () => {
  it('splits a parenthesized suffix into a badge', () => {
    expect(parseIntegrationName('Render (MCP)')).toEqual({ name: 'Render', badge: 'MCP' });
  });

  it('leaves plain names alone', () => {
    expect(parseIntegrationName('Replicate')).toEqual({ name: 'Replicate' });
  });

  it('ignores parentheses that are not a suffix', () => {
    expect(parseIntegrationName('(Legacy) Mail')).toEqual({ name: '(Legacy) Mail' });
  });
});

describe('IntegrationDialog badges', () => {
  describe('when a name carries a parenthesized suffix', () => {
    it('renders the suffix as a badge next to the name', () => {
      renderDialog();
      const button = screen.getByRole('button', { name: 'Render MCP' });
      expect(button.querySelector('span:last-child')?.textContent).toBe('MCP');
    });
  });

  describe('when an item sets badge explicitly', () => {
    it('renders it without parsing the name', () => {
      renderDialog();
      expect(screen.getByRole('button', { name: 'Sanity MCP' })).toBeDefined();
    });
  });
});

describe('IntegrationDialog auth type', () => {
  describe('when an item has an auth type', () => {
    it('shows a readable label as muted text on the right of the row', () => {
      renderDialog();
      const button = screen.getByRole('button', { name: 'Notion OAuth' });
      expect(button.lastElementChild?.textContent).toBe('OAuth');
      expect(button.lastElementChild?.className).toContain('ml-auto');
    });

    it('shows MCP as a badge next to the name and its OAuth method on the right', () => {
      renderDialog();
      const button = screen.getByRole('button', { name: 'Replicate MCP OAuth' });
      expect(button.children[2]?.textContent).toBe('MCP');
      expect(button.lastElementChild?.textContent).toBe('OAuth');
    });
  });
});
