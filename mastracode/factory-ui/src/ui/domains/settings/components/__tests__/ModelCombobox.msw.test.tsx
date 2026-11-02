import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { ModelCombobox } from '../ModelCombobox';
import { datedModels } from './fixtures/models';

describe('ModelCombobox', () => {
  describe('when the catalog contains release dates', () => {
    it('offers the newest models first after Auto', async () => {
      renderWithProviders(<ModelCombobox models={datedModels} value="auto" auto={{}} onValueChange={() => {}} />);
      fireEvent.click(screen.getByRole('combobox'));
      const options = await screen.findAllByRole('option');
      expect(options.map(option => option.textContent)).toEqual([
        'AutoPicked for you',
        'GPT-5openai/gpt-5',
        'GPT-4.1openai/gpt-4.1',
        'GPT-4oopenai/gpt-4o',
      ]);
    });
  });
});
