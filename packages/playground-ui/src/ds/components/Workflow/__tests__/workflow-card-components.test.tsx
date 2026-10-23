// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkflowConditionCardView, WorkflowStepCardView } from '../index';

afterEach(cleanup);

describe('Workflow card UI components', () => {
  describe('when a mapping step has completed', () => {
    it('shows its type, duration, description, and actions without providers', () => {
      render(
        <WorkflowStepCardView
          label="Map customer"
          description="Map the previous output"
          displayStatus="success"
          mapConfig="return input"
          startedAt={1000}
          endedAt={1123}
          actionBar={<button type="button">Map config</button>}
        />,
      );

      expect(screen.getByTitle('Map customer')).not.toBeNull();
      expect(screen.getByText('Map the previous output')).not.toBeNull();
      expect(screen.getByText('Map')).not.toBeNull();
      expect(screen.getByText('Completed')).not.toBeNull();
      expect(screen.getByText('123ms')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Map config' })).not.toBeNull();
    });
  });

  describe('when a foreach is processing its items', () => {
    it('shows the completed count as progress alongside the configured delay', () => {
      render(
        <WorkflowStepCardView
          label="Process customers"
          displayStatus="running"
          isForEach
          duration={1250}
          foreachProgress={{ completedCount: 2, totalCount: 4, iterationStatus: 'success' }}
        />,
      );

      expect(screen.getByText('For each')).not.toBeNull();
      const progress = screen.getByRole<HTMLProgressElement>('progressbar', {
        name: 'Process customers completed items',
      });
      expect(progress.value).toBe(2);
      expect(progress.max).toBe(4);
      expect(screen.getByText('Configured delay')).not.toBeNull();
      expect(screen.getByText('1.25s')).not.toBeNull();
    });
  });

  describe('when a caller supplies a condition with actions', () => {
    it('shows its expression inline with the supplied action', () => {
      render(
        <WorkflowConditionCardView
          type="when"
          conditions={[{ type: 'when', fnString: 'input.value > 0' }]}
          previousDisplayStatus="success"
          actionBar={<button type="button">Input</button>}
        />,
      );

      expect(screen.getByText('When')).not.toBeNull();
      expect(screen.getByRole('region', { name: 'Condition details' }).textContent).toContain('input.value > 0');
      expect(screen.getByRole('button', { name: 'Input' })).not.toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
