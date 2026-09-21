import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SkillMetadata } from '../../types';
import { SkillsTable } from '../skills-table';
import type { SkillsTableProps } from '../skills-table';
import { interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const makeSkill = (name: string, dir: string): SkillMetadata => ({
  name,
  description: `Description for ${name}`,
  path: `${dir}/${name}`,
});

const skills = [makeSkill('charlie', 'b-dir'), makeSkill('alpha', 'c-dir'), makeSkill('bravo', 'a-dir')];

const renderTable = (props?: Partial<SkillsTableProps>) =>
  renderWithProviders(
    <TestLinkProvider>
      <SkillsTable skills={skills} isLoading={false} {...props} />
    </TestLinkProvider>,
  );

const rowNames = () => interactiveRows().map(row => row.querySelector('.font-medium')?.textContent);

describe('SkillsTable', () => {
  describe('when sorted from the Skill column', () => {
    it('reports the requested direction to the parent', () => {
      const onSortChange = vi.fn();
      renderTable({ onSortChange });

      fireEvent.click(screen.getByRole('button', { name: 'Skill, not sorted, sort ascending' }));

      expect(onSortChange).toHaveBeenCalledWith('asc', 'name');
    });

    it('orders skills Z to A when descending', () => {
      renderTable({ sort: { key: 'name', direction: 'desc' }, onSortChange: () => {} });

      expect(rowNames()).toEqual(['charlie', 'bravo', 'alpha']);
    });
  });

  describe('when sorted from the Path column', () => {
    it('orders skills by path A to Z when ascending', () => {
      renderTable({ sort: { key: 'path', direction: 'asc' }, onSortChange: () => {} });

      expect(rowNames()).toEqual(['bravo', 'charlie', 'alpha']);
    });
  });
});
