import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import type { FactoryFsEntry } from '../../../../../api/types';
import { FactoryFsBrowser } from '../FactoryFsBrowser';

const entries: FactoryFsEntry[] = [
  { name: 'shared', path: 'shared', type: 'directory', size: 0, updatedAt: '' },
  { name: 'org-note.md', path: 'shared/org-note.md', type: 'file', size: 8, updatedAt: '2026-08-07T00:00:00.000Z' },
  { name: 'projects', path: 'projects', type: 'directory', size: 0, updatedAt: '' },
  { name: 'Alpha', path: 'projects/Alpha', type: 'directory', size: 0, updatedAt: '' },
  {
    name: 'plan.md',
    path: 'projects/Alpha/plans/plan.md',
    type: 'file',
    size: 20,
    updatedAt: '2026-08-07T00:00:00.000Z',
  },
  { name: 'Beta', path: 'projects/Beta', type: 'directory', size: 0, updatedAt: '' },
];

function renderBrowser(props: Partial<Parameters<typeof FactoryFsBrowser>[0]> = {}) {
  const selected: string[] = [];
  renderWithProviders(
    <FactoryFsBrowser
      entries={entries}
      isLoading={false}
      isRefreshing={false}
      onRefresh={() => {}}
      onFileSelect={path => selected.push(path)}
      {...props}
    />,
  );
  return { selected };
}

describe('FactoryFsBrowser', () => {
  it('opens the current project directory by default, keeping siblings closed', () => {
    renderBrowser({ defaultOpenDir: 'projects/Alpha' });

    // The default-open chain (projects → Alpha) is expanded…
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('plans')).toBeInTheDocument();
    // …while closed folders keep their contents hidden.
    expect(screen.queryByText('org-note.md')).not.toBeInTheDocument();
    // Sibling projects are visible but closed.
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('lets the user navigate up into other directories', async () => {
    const user = userEvent.setup();
    renderBrowser({ defaultOpenDir: 'projects/Alpha' });

    await user.click(screen.getByText('shared'));
    expect(screen.getByText('org-note.md')).toBeInTheDocument();
  });

  it('reports file selection with the org-relative path', async () => {
    const user = userEvent.setup();
    const { selected } = renderBrowser({ defaultOpenDir: 'projects/Alpha' });

    await user.click(screen.getByText('plans'));
    await user.click(screen.getByText('plan.md'));
    expect(selected).toEqual(['projects/Alpha/plans/plan.md']);
  });

  it('shows an empty state when there are no files', () => {
    renderBrowser({ entries: [] });
    expect(screen.getByText(/No files yet/)).toBeInTheDocument();
  });
});
