// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ScoreAsItemDialog } from '../score-as-item-dialog';
import { createScore } from './fixtures/score-as-item';

vi.mock('@/domains/datasets/components/save-as-dataset-item-dialog', () => ({
  SaveAsDatasetItemDialog: ({ initialInput }: { initialInput: string }) => (
    <output data-testid="initial-input">{initialInput}</output>
  ),
}));

afterEach(() => cleanup());

describe('ScoreAsItemDialog', () => {
  describe('when a trace-linked score contains circular input and output', () => {
    it('prepares JSON-safe dataset input instead of crashing', () => {
      const input: Record<string, unknown> = { prompt: 'hello' };
      const output: Record<string, unknown> = { answer: 'world' };
      input.self = input;
      output.self = output;

      render(<ScoreAsItemDialog score={createScore(input, output)} isOpen onClose={vi.fn()} />);

      expect(screen.getByTestId('initial-input').textContent).toContain('"self": "[Circular]"');
    });
  });
});
