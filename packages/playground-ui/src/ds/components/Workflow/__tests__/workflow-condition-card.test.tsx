// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkflowConditionCard } from '../cards/condition/workflow-condition-card';

afterEach(cleanup);

describe('WorkflowConditionCard', () => {
  describe('when used without Studio providers', () => {
    it('shows the supplied expression inline with a copy action', () => {
      render(<WorkflowConditionCard conditions={[{ type: 'when', fnString: 'input.approved' }]} />);

      expect(screen.getByRole('region', { name: 'Condition details' }).textContent).toContain('input.approved');
      expect(screen.getByRole('button', { name: 'Copy expression' })).not.toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
