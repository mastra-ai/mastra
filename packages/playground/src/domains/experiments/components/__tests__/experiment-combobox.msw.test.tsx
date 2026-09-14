import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_EXPERIMENTS, ExperimentCombobox } from '../experiment-combobox';
import { experiment, experimentsResponse } from '@/domains/experiments/__tests__/fixtures/experiment-item-route';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

// Base UI popups don't open in jsdom; a native select exposes the same contract.
vi.mock('@mastra/playground-ui/components/Combobox', () => ({
  Combobox: ({
    options,
    value,
    onValueChange,
    placeholder,
  }: {
    options: Array<{ label: string; value: string; description?: string; start?: React.ReactNode }>;
    value?: string | string[];
    onValueChange?: (value: string) => void;
    placeholder?: string;
  }) => (
    <>
      {/* The real trigger renders the selected option's start adornment. */}
      {options.find(option => option.value === value)?.start}
      <select
        aria-label={placeholder}
        value={Array.isArray(value) ? (value[0] ?? '') : (value ?? '')}
        onChange={event => onValueChange?.(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map(option => (
          <option key={option.value} value={option.value} data-description={option.description}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  ),
}));

const unnamedExperiment = { ...experiment, id: 'abcdef1234567890', name: null, description: null };
const longDescription = 'x'.repeat(120);
const describedExperiment = { ...experiment, id: 'described-1', name: 'described', description: longDescription };

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/experiments`, () =>
      HttpResponse.json({
        experiments: [experiment, unnamedExperiment, describedExperiment],
        pagination: { ...experimentsResponse.pagination, total: 3 },
      }),
    ),
  );
});

describe('ExperimentCombobox', () => {
  describe('when experiments have loaded', () => {
    it('lists every project experiment by display name', async () => {
      renderWithProviders(<ExperimentCombobox onValueChange={() => {}} />);

      await screen.findByRole('option', { name: 'entity-extraction / model-a' });
      expect(screen.getByRole('option', { name: 'Experiment #abcdef12' })).toBeDefined();
    });

    it('describes each option with its truncated description, or the short id when there is none', async () => {
      renderWithProviders(<ExperimentCombobox onValueChange={() => {}} />);

      const described = await screen.findByRole('option', { name: 'described' });
      const description = described.getAttribute('data-description')!;
      expect(description.length).toBeLessThan(longDescription.length);
      expect(description.endsWith('…')).toBe(true);

      const unnamed = screen.getByRole('option', { name: 'Experiment #abcdef12' });
      expect(unnamed.getAttribute('data-description')).toBe('abcdef12');
    });

    it('reflects the selected experiment', async () => {
      renderWithProviders(<ExperimentCombobox value={experiment.id} onValueChange={() => {}} />);

      const select = await screen.findByRole('combobox');
      await waitFor(() => expect((select as HTMLSelectElement).value).toBe(experiment.id));
    });

    it('shows the experiments icon next to the selected experiment', async () => {
      renderWithProviders(<ExperimentCombobox value={experiment.id} onValueChange={() => {}} />);

      await screen.findByTestId('experiments-icon');
    });
  });

  describe('with the "All experiments" option', () => {
    it('lists it first and selects it when no value is set', async () => {
      renderWithProviders(<ExperimentCombobox allOption onValueChange={() => {}} />);

      const all = await screen.findByRole('option', { name: 'All experiments' });
      const options = screen.getAllByRole('option').filter(option => option.getAttribute('value') !== '');
      expect(options[0]).toBe(all);
      expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(ALL_EXPERIMENTS);
    });

    it('is absent by default', async () => {
      renderWithProviders(<ExperimentCombobox onValueChange={() => {}} />);

      await screen.findByRole('option', { name: 'entity-extraction / model-a' });
      expect(screen.queryByRole('option', { name: 'All experiments' })).toBeNull();
    });
  });

  describe('when the user picks an experiment', () => {
    it('emits the experiment id', async () => {
      const onValueChange = vi.fn();
      renderWithProviders(<ExperimentCombobox onValueChange={onValueChange} />);

      await screen.findByRole('option', { name: 'Experiment #abcdef12' });
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'abcdef1234567890' } });

      expect(onValueChange).toHaveBeenCalledWith('abcdef1234567890');
    });
  });
});
