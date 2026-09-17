import { describe, expect, it } from 'vitest';

import type { SkillMetadata } from '../../types';
import { SkillsTable } from '../skills-table';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const makeSkill = (name: string): SkillMetadata => ({
  name,
  description: `Description for ${name}`,
  path: `.agents/skills/${name}`,
});

const skills = [makeSkill('skill-a'), makeSkill('skill-b'), makeSkill('skill-c')];

const renderTable = (props?: Partial<Parameters<typeof SkillsTable>[0]>) =>
  renderWithProviders(
    <TestLinkProvider>
      <SkillsTable skills={skills} isLoading={false} {...props} />
    </TestLinkProvider>,
  );

describe('SkillsTable keyboard navigation', () => {
  describe('when the table renders plain rows', () => {
    it('applies a roving tabindex across skill rows', () => {
      renderTable();
      const rows = interactiveRows();
      expect(rows).toHaveLength(3);
      expectRovingTabindex(rows);
    });

    it('moves focus with Arrow/Home/End keys', () => {
      renderTable();
      expectArrowNavigation(interactiveRows());
    });
  });

  describe('when action callbacks enable the wrapper layout', () => {
    it('keeps keyboard navigation on the inner row buttons', () => {
      renderTable({ onUpdateSkill: () => {}, onRemoveSkill: () => {} });
      const rows = interactiveRows();
      expect(rows).toHaveLength(3);
      expectArrowNavigation(rows);
    });
  });
});
