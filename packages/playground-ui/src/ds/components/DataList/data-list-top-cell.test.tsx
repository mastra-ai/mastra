// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DataListTopCellWithTooltip } from './data-list-top-cell';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { AgentIcon } from '@/ds/icons/AgentIcon';

afterEach(cleanup);

describe('DataListTopCellWithTooltip', () => {
  describe('when the header contains only an icon', () => {
    it('names the trigger and exposes its explanation through keyboard focus', async () => {
      render(
        <TooltipProvider delay={0}>
          <DataListTopCellWithTooltip tooltip="Number of attached Agents">
            <AgentIcon />
          </DataListTopCellWithTooltip>
        </TooltipProvider>,
      );
      const trigger = screen.getByRole('button', { name: 'Number of attached Agents' });

      act(() => trigger.focus());

      expect(document.activeElement).toBe(trigger);
      expect((await screen.findByRole('tooltip')).textContent).toBe('Number of attached Agents');
    });
  });
});
