// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ObservationMarkerBadge } from '../observation-marker-badge';
import { ObservationRenderer } from '../observation-renderer';

afterEach(cleanup);

describe('ObservationRenderer', () => {
  describe('when stored observations contain nested priorities and task metadata', () => {
    it('renders the original observation and task text without application providers', () => {
      render(
        <ObservationRenderer
          observations={
            '<observations>\nDate: Sep 10, 2026\n* 🔴 (14:30) Preserve agent behavior\n  - Keep local interactions\n</observations>\n<current-task>Extract message rendering</current-task>'
          }
          showCurrentTask
        />,
      );
      expect(screen.getByText('Preserve agent behavior')).toBeTruthy();
      expect(screen.getByText('Keep local interactions')).toBeTruthy();
      expect(screen.getByText('Extract message rendering')).toBeTruthy();
    });
  });
});

describe('ObservationMarkerBadge', () => {
  describe('when an observation fails', () => {
    it('allows the reader to reveal its error without action callbacks', () => {
      render(
        <ObservationMarkerBadge
          toolName="__mastra_observe"
          args={{ _state: 'failed', error: 'Observation unavailable' }}
        />,
      );
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('Observation unavailable')).toBeTruthy();
    });
  });
});
