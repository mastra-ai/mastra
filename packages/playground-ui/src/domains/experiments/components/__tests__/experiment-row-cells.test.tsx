// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExperimentRowCells } from '../experiment-row-cells';
import type { ExperimentRowCellsProps } from '../experiment-row-cells';
import { completedExperiment } from './fixtures/experiments';
import { agents, processors } from './fixtures/target-registries';
import { DataList } from '@/ds/components/DataList';

const base = completedExperiment;
const registries = { agents, processors };

const renderCells = (experiment = base, targetRegistries: ExperimentRowCellsProps['targetRegistries'] = registries) =>
  render(
    <DataList columns="auto">
      <DataList.RowStatic>
        <ExperimentRowCells experiment={experiment} targetRegistries={targetRegistries} />
      </DataList.RowStatic>
    </DataList>,
  );

describe('ExperimentRowCells target column', () => {
  describe('when the agent target is in the registries', () => {
    it('shows the resolved target name with its type icon', () => {
      renderCells({ ...base, targetType: 'agent', targetId: 'agent-1' });
      expect(screen.getByText('Support Agent')).toBeDefined();
      expect(screen.getByRole('img', { name: 'Agent' })).toBeDefined();
      expect(screen.queryByText('agent agent-1')).toBeNull();
    });
  });

  describe('when the processor target is in the registries', () => {
    it('resolves the name from the processor registry', () => {
      renderCells({ ...base, targetType: 'processor', targetId: 'proc-1' });
      expect(screen.getByText('PII Redactor')).toBeDefined();
      expect(screen.getByRole('img', { name: 'Processor' })).toBeDefined();
    });
  });

  describe('when no registries are given', () => {
    it('falls back to the target id', () => {
      renderCells({ ...base, targetType: 'agent', targetId: 'agent-1' }, {});
      expect(screen.getByText('agent-1')).toBeDefined();
    });
  });

  describe('when the experiment was run by the caller', () => {
    it('labels it as external', () => {
      renderCells({ ...base, targetType: null, targetId: null });
      expect(screen.getByText('External (caller-run)')).toBeDefined();
    });
  });
});
