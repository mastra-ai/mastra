// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkflowConditionCard } from '../cards/workflow-condition-card';

afterEach(cleanup);

describe('WorkflowConditionCard', () => {
  describe('when used without Studio providers', () => {
    it('opens a condition function and closes its dialog', async () => {
      render(<WorkflowConditionCard conditions={[{ type: 'when', fnString: 'input.approved' }]} />);

      fireEvent.click(screen.getByRole('button', { name: 'View condition function' }));

      expect(screen.getByRole('dialog', { name: 'Condition Function' })).not.toBeNull();
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('expands a collapsed condition', async () => {
      render(
        <WorkflowConditionCard initiallyOpen={false} conditions={[{ type: 'while', fnString: 'output.hasMore' }]} />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Expand condition' }));

      expect(await screen.findByRole('button', { name: 'View condition function' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Collapse condition' })).not.toBeNull();
    });
  });
});
