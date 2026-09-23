// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ObservationMarkerBadge } from '../observation-marker-badge';

afterEach(() => cleanup());

describe('ObservationMarkerBadge', () => {
  describe('when a completed observation marker carries extracted values', () => {
    it('shows scalar and structured extracted values once the panel is expanded', () => {
      render(
        <ObservationMarkerBadge
          toolName="mastra-memory-om-observation"
          args={{}}
          metadata={{
            omData: {
              _state: 'complete',
              cycleId: 'cycle-1',
              operationType: 'observation',
              completedAt: '2026-05-29T00:00:00.000Z',
              tokensObserved: 1200,
              observationTokens: 300,
              extractedValues: {
                mood: 'focused',
                profile: { plan: 'rewrite', priority: 1 },
              },
            },
          }}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /extractions \(2\)/i }));

      expect(screen.getByText('mood')).toBeTruthy();
      expect(screen.getByText('focused')).toBeTruthy();
      expect(screen.getByText('profile')).toBeTruthy();
      expect(screen.getByText(/"plan": "rewrite"/)).toBeTruthy();
      expect(screen.getByText(/"priority": 1/)).toBeTruthy();
    });
  });

  describe('when a buffered reflection marker carries extraction failures', () => {
    it('shows each failure with its slug and error once the panel is expanded', () => {
      render(
        <ObservationMarkerBadge
          toolName="mastra-memory-om-observation"
          args={{}}
          metadata={{
            omData: {
              _state: 'buffering-complete',
              cycleId: 'cycle-2',
              operationType: 'reflection',
              completedAt: '2026-05-29T00:00:00.000Z',
              tokensBuffered: 1600,
              bufferedTokens: 400,
              extractionFailures: [{ slug: 'profile', error: 'Expected object, received string' }],
            },
          }}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /extractions \(0\).*1 failed/i }));

      expect(screen.getByText('profile')).toBeTruthy();
      expect(screen.getByText('Expected object, received string')).toBeTruthy();
    });
  });
});
