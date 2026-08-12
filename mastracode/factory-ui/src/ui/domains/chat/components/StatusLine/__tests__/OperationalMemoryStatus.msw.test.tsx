import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../../e2e/ui/render';
import { ChatRuntimeContext } from '../../../context/ChatRuntimeContext';
import type { ChatRuntimeApi } from '../../../context/ChatRuntimeContext';
import { OperationalMemoryStatus } from '../OperationalMemoryStatus';
import { RuntimeActivity } from '../RuntimeActivity';

const omProgress = {
  status: 'idle',
  pendingTokens: 14_900,
  threshold: 30_000,
  thresholdPercent: 49.7,
  observationTokens: 12_000,
  reflectionThreshold: 40_000,
  reflectionThresholdPercent: 30,
  projectedMessageRemoval: 0,
  projectedReflectionSavings: 0,
};

function renderStatus(runtime: Partial<ChatRuntimeApi>) {
  return renderWithProviders(
    <ChatRuntimeContext.Provider
      value={{
        followUpCount: 0,
        omProgress,
        omPhase: 'idle',
        bufferingMessages: false,
        bufferingObservations: false,
        tokensPerSec: 0,
        ...runtime,
      }}
    >
      <OperationalMemoryStatus />
      <RuntimeActivity />
    </ChatRuntimeContext.Provider>,
  );
}

describe('observational memory status', () => {
  describe('when memory consolidates in the background', () => {
    it('shimmers the budget it works on and stays silent otherwise', () => {
      renderStatus({ bufferingObservations: true });

      const budget = screen.getByLabelText(/Consolidating observations in the background/);
      expect(budget.parentElement?.querySelector('.shimmer-text')).not.toBeNull();
      expect(screen.queryByText('consolidating memory')).toBeNull();
    });
  });

  describe('when a reflection holds the turn', () => {
    it('names the wait', () => {
      renderStatus({ omPhase: 'reflecting' });

      expect(screen.getByText('consolidating memory')).toBeVisible();
      expect(screen.getByLabelText('Consolidating observations')).toBeVisible();
    });
  });

  describe('when a background reflection emits a retry start event', () => {
    it('keeps reporting background work rather than a wait', () => {
      renderStatus({ omPhase: 'reflecting', bufferingObservations: true });

      expect(screen.queryByText('consolidating memory')).toBeNull();
      expect(screen.getByLabelText(/Consolidating observations in the background/)).toBeVisible();
    });
  });

  describe('when memory is idle', () => {
    it('shows the budgets without movement', () => {
      const { container } = renderStatus({});

      expect(screen.getByText('14.9/30k')).toBeVisible();
      expect(container.querySelector('.shimmer-text')).toBeNull();
    });
  });
});
