// @vitest-environment jsdom
import type { DatasetItem } from '@mastra/client-js';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DatasetItemDetails } from '../dataset-item-details';
import {
  baseItem,
  itemWithEmptyObjectGroundTruth,
  itemWithEmptyStringGroundTruth,
  itemWithEmptyToolMocks,
  itemWithMocks,
  itemWithPreviousTextInput,
  itemWithTextPayload,
  itemWithUuid,
} from './fixtures/dataset-item-panel';

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
  describe('when the item has every field', () => {
    it('renders the created and updated rows', () => {
      render(<DatasetItemDetails item={fullItem} />);

      expect(screen.getByText('Created')).not.toBeNull();
      expect(screen.getByText('Updated')).not.toBeNull();
    });

    it('leaves out the dataset id and version rows', () => {
      render(<DatasetItemDetails item={fullItem} />);

      expect(screen.queryByText('Dataset Id')).toBeNull();
      expect(screen.queryByText('ds-1')).toBeNull();
      expect(screen.queryByText('Version')).toBeNull();
    });

    it('renders every data section except scorers', () => {
      render(<DatasetItemDetails item={fullItem} />);

      for (const title of [
        'Input',
        'Ground Truth',
        'Expected Trajectory',
        'Tool Mocks',
        'Request Context',
        'Metadata',
      ]) {
        expect(screen.getByText(title)).not.toBeNull();
      }
      expect(screen.queryByText('Scorers')).toBeNull();
    });
  });

  describe('when the item id is a UUID', () => {
    it('shows the short item id, like experiment results', () => {
      render(<DatasetItemDetails item={itemWithUuid} />);

      expect(screen.getByText('Item Id')).not.toBeNull();
      const shortId = screen.getByText('0bbd9730');
      expect(shortId.getAttribute('title')).toBe(itemWithUuid.id);
    });

    it('copies the full item id', () => {
      render(<DatasetItemDetails item={itemWithUuid} />);

      expect(screen.getByLabelText('Copy Item Id to clipboard')).not.toBeNull();
    });
  });

  describe('when the input and ground truth are plain strings', () => {
    it('renders them as text, without JSON quotes', () => {
      render(<DatasetItemDetails item={itemWithTextPayload} />);

      const input = screen.getByRole('region', { name: 'Input' });
      expect(within(input).getByText('What is the weather in Seattle?')).not.toBeNull();
      expect(input.textContent).not.toContain('"What is the weather in Seattle?"');

      const groundTruth = screen.getByRole('region', { name: 'Ground Truth' });
      expect(within(groundTruth).getByText('It is rainy.')).not.toBeNull();
    });
  });

  describe('when the input is structured', () => {
    it('renders it as JSON', () => {
      render(<DatasetItemDetails item={baseItem} />);

      const input = screen.getByRole('region', { name: 'Input' });
      expect(input.textContent).toContain('"q"');
      expect(input.textContent).toContain('weather in Seattle?');
    });
  });

  describe('when diffing against another item', () => {
    it('keeps the input as a code section so changed lines stay highlighted', () => {
      render(
        <DatasetItemDetails item={itemWithTextPayload} diff={{ against: itemWithPreviousTextInput, side: 'b' }} />,
      );

      expect(screen.queryByRole('region', { name: 'Input' })).toBeNull();
      expect(screen.getByText('Input')).not.toBeNull();
    });
  });

  describe('when the ground truth is an empty string', () => {
    it('omits the Ground Truth section', () => {
      render(<DatasetItemDetails item={itemWithEmptyStringGroundTruth} />);

      expect(screen.queryByText('Ground Truth')).toBeNull();
    });
  });

  describe('when the ground truth is an empty object', () => {
    it('omits the Ground Truth section', () => {
      render(<DatasetItemDetails item={itemWithEmptyObjectGroundTruth} />);

      expect(screen.queryByText('Ground Truth')).toBeNull();
    });
  });

  describe('when diffing two items that both lack a ground truth', () => {
    it('omits the Ground Truth section', () => {
      render(<DatasetItemDetails item={itemWithEmptyObjectGroundTruth} diff={{ against: baseItem, side: 'b' }} />);

      expect(screen.queryByText('Ground Truth')).toBeNull();
    });
  });

  describe('when the item is minimal', () => {
    it('omits the Updated row because the item was never updated', () => {
      render(<DatasetItemDetails item={baseItem} />);

      expect(screen.queryByText('Updated')).toBeNull();
      expect(screen.queryByText('n/a')).toBeNull();
    });

    it('omits the optional sections', () => {
      render(<DatasetItemDetails item={baseItem} />);

      expect(screen.queryByText('Expected Trajectory')).toBeNull();
      expect(screen.queryByText('Request Context')).toBeNull();
    });

    it('omits the Tool Mocks section', () => {
      render(<DatasetItemDetails item={baseItem} />);

      expect(screen.queryByText('Tool Mocks')).toBeNull();
    });
  });

  describe('when the tool mocks are an empty list', () => {
    it('omits the Tool Mocks section', () => {
      render(<DatasetItemDetails item={itemWithEmptyToolMocks} />);

      expect(screen.queryByText('Tool Mocks')).toBeNull();
    });
  });

  describe('when diffing two items that both lack tool mocks', () => {
    it('omits the Tool Mocks section', () => {
      render(<DatasetItemDetails item={itemWithEmptyToolMocks} diff={{ against: baseItem, side: 'b' }} />);

      expect(screen.queryByText('Tool Mocks')).toBeNull();
    });
  });
});
