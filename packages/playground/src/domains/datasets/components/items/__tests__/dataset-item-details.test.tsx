// @vitest-environment jsdom
import type { DatasetItem } from '@mastra/client-js';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DatasetItemDetails } from '../dataset-item-details';
import { baseItem, itemWithMocks } from './fixtures/dataset-item-panel';

const fullItem: DatasetItem = {
  ...itemWithMocks,
  groundTruth: { answer: 'rainy' },
  expectedTrajectory: [{ toolName: 'getWeather' }],
  scorerIds: ['quality'],
  requestContext: { userId: 'u-1' },
  metadata: { tag: 'smoke' },
  updatedAt: '2026-02-01T00:00:00.000Z',
};

afterEach(() => cleanup());

describe('DatasetItemDetails', () => {
  it('renders metadata rows and every section for a full item', () => {
    render(<DatasetItemDetails item={fullItem} />);

    expect(screen.getByText('Dataset Id')).not.toBeNull();
    expect(screen.getByText('ds-1')).not.toBeNull();
    expect(screen.getByText('Version')).not.toBeNull();
    expect(screen.getByText('v1')).not.toBeNull();
    expect(screen.getByText('Created')).not.toBeNull();
    expect(screen.getByText('Updated')).not.toBeNull();

    for (const title of [
      'Input',
      'Ground Truth',
      'Expected Trajectory',
      'Tool Mocks',
      'Scorers',
      'Request Context',
      'Metadata',
    ]) {
      expect(screen.getByText(title)).not.toBeNull();
    }
  });

  it('omits optional sections and shows n/a for Updated on a minimal item', () => {
    render(<DatasetItemDetails item={baseItem} />);

    expect(screen.getByText('Updated')).not.toBeNull();
    expect(screen.getByText('n/a')).not.toBeNull();
    expect(screen.queryByText('Expected Trajectory')).toBeNull();
    expect(screen.queryByText('Request Context')).toBeNull();

    // Always-present sections still render with their fallbacks.
    expect(screen.getByText('Tool Mocks')).not.toBeNull();
    expect(screen.getByText('Scorers')).not.toBeNull();
    expect(screen.getByText(/Inherited from dataset/)).not.toBeNull();
  });
});
