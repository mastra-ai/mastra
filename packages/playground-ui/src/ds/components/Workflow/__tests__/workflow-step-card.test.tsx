// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowStepCardView, WorkflowConditionCard } from '../index';

afterEach(cleanup);

describe('Workflow cards', () => {
  describe('when a workflow has an inspectable body', () => {
    it('reveals its body without opening another graph until requested', async () => {
      const onOpenBody = vi.fn();
      const onSelect = vi.fn();
      render(
        <WorkflowStepCardView
          label="analyze-document"
          isForEach
          onSelect={onSelect}
          body={<span>Count words and extract an excerpt</span>}
          onOpenBody={onOpenBody}
        />,
      );
      expect(screen.queryByText('Count words and extract an excerpt')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Inspect analyze-document' }));
      expect(await screen.findByText('Count words and extract an excerpt')).not.toBeNull();
      expect(onSelect).toHaveBeenCalledOnce();
      expect(onOpenBody).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Open full workflow' }));
      expect(onOpenBody).toHaveBeenCalledOnce();
    });
  });

  describe('when a foreach completes with no items', () => {
    it('shows the empty collection without claiming completed progress', () => {
      render(
        <WorkflowStepCardView
          label="Empty batch"
          isForEach
          displayStatus="success"
          foreachProgress={{ completedCount: 0, totalCount: 0, iterationStatus: 'success' }}
        />,
      );
      expect(screen.getByText('No items to process')).not.toBeNull();
      expect(screen.queryByRole('progressbar')).toBeNull();
    });
  });

  describe('when a loop contains a graph', () => {
    it('shows its nodes inline by default and collapses without selecting the parent', async () => {
      const onSelect = vi.fn();
      render(
        <WorkflowStepCardView
          label="Analyze documents"
          isForEach
          bodyLayout="graph"
          initiallyOpen
          onSelect={onSelect}
          body={<span>Count words</span>}
        />,
      );
      expect(screen.getByTestId('workflow-default-node').contains(screen.getByText('Count words'))).toBe(true);
      expect(screen.queryByRole('dialog')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Collapse loop' }));
      await waitFor(() => expect(screen.queryByText('Count words')).toBeNull());
      expect(onSelect).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Expand loop' }));
      expect(await screen.findByText('Count words')).not.toBeNull();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('when a deeper workflow is collapsed', () => {
    it('reveals interactive children without opening an overlay', async () => {
      const inspectChild = vi.fn();
      render(
        <WorkflowStepCardView
          label="Nested approval"
          isNestedWorkflowStep
          bodyLayout="graph"
          initiallyOpen={false}
          body={<button onClick={inspectChild}>Inspect approval</button>}
        />,
      );
      expect(screen.queryByRole('button', { name: 'Inspect approval' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Expand workflow' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Inspect approval' }));
      expect(inspectChild).toHaveBeenCalledOnce();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('when an else branch has no condition to inspect', () => {
    it('shows the fallback meaning without an expansion control', () => {
      render(<WorkflowConditionCard conditions={[{ type: 'else', fnString: '' }]} />);
      expect(screen.getByText('When no other branch matches')).not.toBeNull();
      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});

describe('Workflow status fallbacks', () => {
  describe('when execution pauses', () => {
    it('shows paused without suggesting the step is still running', () => {
      render(<WorkflowStepCardView label="Review" displayStatus="paused" startedAt={100} />);
      expect(screen.getByText('Paused')).not.toBeNull();
      expect(screen.getByLabelText('Timing unavailable')).not.toBeNull();
    });
  });

  describe('when a configured time is invalid', () => {
    it.each([
      { date: new Date('invalid'), message: 'Schedule unavailable' },
      { duration: NaN, message: 'Delay unavailable' },
      { duration: -1, message: 'Delay unavailable' },
    ])('shows $message', ({ message, ...timing }) => {
      render(<WorkflowStepCardView label="Delay" {...timing} />);
      expect(screen.getByText(message)).not.toBeNull();
    });
  });
});
