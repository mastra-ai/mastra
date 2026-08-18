// @vitest-environment jsdom

import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { NetworkChoiceMetadataDialogTrigger } from '../network-choice-metadata-dialog';

afterEach(() => cleanup());

describe('NetworkChoiceMetadataDialogTrigger', () => {
  describe('when an agent network exposes its selection reason', () => {
    it('uses a compact labeled action that opens the metadata dialog', () => {
      render(
        <TooltipProvider>
          <NetworkChoiceMetadataDialogTrigger
            selectionReason="The request needs the weather specialist."
            input={{ location: 'Paris' }}
          />
        </TooltipProvider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Selection reason' }));

      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByText('The request needs the weather specialist.')).toBeTruthy();
    });
  });
});
