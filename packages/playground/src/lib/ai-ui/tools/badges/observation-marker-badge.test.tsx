// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ExtractedValuesBadge, ExtractionFailedBadge } from './observation-marker-badge';

describe('ObservationMarkerBadge extractor states', () => {
  it('renders extracted values summary and expanded details', () => {
    render(
      <ExtractedValuesBadge
        toolName="observational-memory"
        args={{}}
        result={{
          omData: {
            _state: 'extracted',
            operationType: 'observation',
            extractedValues: {
              'active-topic': {
                topic: 'billing',
                confidence: 0.91,
                normalized: true,
              },
            },
          },
        }}
      />,
    );

    expect(screen.getByTestId('om-extracted-marker')).toBeTruthy();
    expect(screen.getByTestId('om-extracted-summary').textContent).toContain('active-topic');
    expect(screen.getByTestId('om-extracted-summary').textContent).toContain('billing');
    expect(screen.queryByTestId('om-extracted-values')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /extracted values/i }));

    expect(screen.getByTestId('om-extracted-values').textContent).toContain('normalized');
  });

  it('renders extraction failures with operation-specific labels', () => {
    render(
      <ExtractionFailedBadge
        toolName="observational-memory"
        args={{
          _state: 'extraction-failed',
          operationType: 'reflection',
          error: 'schema validation failed',
        }}
      />,
    );

    expect(screen.getByTestId('om-extraction-failed-marker').textContent).toContain('Reflection extraction failed');
    expect(screen.getByText('schema validation failed')).toBeTruthy();
  });
});
