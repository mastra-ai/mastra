// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddToolsDialog } from './add-tools-dialog';

afterEach(cleanup);

const CATALOG = [
  { id: 'slack', name: 'Slack', description: 'Post messages', logo: <span />, connected: true },
  { id: 'notion', name: 'Notion', description: 'Edit pages', logo: <span />, connected: false },
  { id: 'jira', name: 'Jira', description: 'Update tickets', logo: <span />, connected: false },
];

describe('AddToolsDialog', () => {
  it('adds the tools you tick and closes', () => {
    const onAdd = vi.fn();
    const onOpenChange = vi.fn();
    render(<AddToolsDialog open onOpenChange={onOpenChange} catalog={CATALOG} onAdd={onAdd} />);

    expect(screen.getByRole('button', { name: 'Add tool' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Slack' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Jira' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 tools' }));

    expect(onAdd).toHaveBeenCalledWith(['slack', 'jira']);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('marks the tools that already have a connected account', () => {
    render(<AddToolsDialog open onOpenChange={vi.fn()} catalog={CATALOG} onAdd={vi.fn()} />);

    expect(screen.getAllByText('Connected')).toHaveLength(1);
  });

  it('narrows the list as you search, and says when nothing matches', () => {
    render(<AddToolsDialog open onOpenChange={vi.fn()} catalog={CATALOG} onAdd={vi.fn()} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tools' }), { target: { value: 'page' } });
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tools' }), { target: { value: 'zzz' } });
    expect(screen.getByText('No tools match “zzz”.')).toBeTruthy();
  });
});
