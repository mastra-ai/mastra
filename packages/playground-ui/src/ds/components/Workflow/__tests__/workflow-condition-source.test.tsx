// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import * as prettier from 'prettier/standalone';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowConditionSource } from '../cards/condition/workflow-condition-source';
import { WorkflowConditionCard } from '../index';

vi.mock('prettier/standalone', { spy: true });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Workflow condition expressions', () => {
  it('formats the supplied expression without interpreting it as a visual rule', async () => {
    render(
      <WorkflowConditionCard
        conditions={[{ type: 'when', fnString: 'async({inputData})=>inputData.approval==="automatic"' }]}
      />,
    );
    const details = screen.getByRole('region', { name: 'Condition details' });
    await waitFor(() =>
      expect(details.textContent).toContain('async ({ inputData }) => inputData.approval === "automatic";'),
    );
    expect(screen.queryByRole('button', { name: 'Show condition rule' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show condition code' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy expression' })).not.toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('preserves compound conditions, function calls, and string contents', async () => {
    render(
      <WorkflowConditionCard
        conditions={[
          {
            type: 'when',
            fnString:
              'async({inputData})=>{const text="a=>b && c";return await allowed(inputData)&&inputData.note===text}',
          },
        ]}
      />,
    );
    const details = screen.getByRole('region', { name: 'Condition details' });
    await waitFor(() =>
      expect(details.textContent).toContain('return (await allowed(inputData)) && inputData.note === text;'),
    );
    expect(details.textContent).toContain('const text = "a=>b && c";');
  });

  it('keeps non-parsable serialized labels visible and drops stale formatting on change', async () => {
    const view = render(<WorkflowConditionCard conditions={[{ type: 'when', fnString: 'inputData.amount>100' }]} />);
    await waitFor(() => expect(screen.getByRole('region').textContent).toContain('inputData.amount > 100;'));
    view.rerender(
      <WorkflowConditionCard conditions={[{ type: 'when', fnString: 'custom condition: [native code]' }]} />,
    );
    expect(screen.getByRole('region').textContent).toBe('custom condition: [native code]');
    await waitFor(() => expect(screen.getByRole('region').textContent).toBe('custom condition: [native code]'));
  });

  it('preserves structured query operators without inventing JavaScript semantics', () => {
    render(
      <WorkflowConditionCard
        conditions={[
          { type: 'when', ref: { step: { id: 'lookup' }, path: 'tags' }, query: { $in: ['a', 'b'], $exists: true } },
        ]}
      />,
    );
    const text = screen.getByRole('region').textContent;
    expect(text).toContain('"$in": [');
    expect(text).toContain('"$exists": true');
    expect(text).toContain('"id": "lookup"');
  });

  it('does not imply an absent serialized expression means no runtime condition exists', () => {
    render(<WorkflowConditionCard conditions={[{ type: 'when', fnString: '' }]} />);
    expect(screen.getByText('Condition expression unavailable')).not.toBeNull();
  });
});

describe('Condition source fallback', () => {
  describe('when its source changes before formatting completes', () => {
    it('immediately displays the current source', async () => {
      const view = render(<WorkflowConditionSource source="inputData.amount>100" />);
      await waitFor(() => expect(view.container.textContent).toBe('inputData.amount > 100;'));
      view.rerender(<WorkflowConditionSource source="custom predicate: [native code]" />);
      expect(view.container.textContent).toBe('custom predicate: [native code]');
    });
  });

  describe('when the expression is unusually large', () => {
    it('retains the full source without formatting', async () => {
      const source = `inputData.text===${JSON.stringify('a'.repeat(20000))}`;
      const format = vi.mocked(prettier.format);
      format.mockClear();
      await act(async () => {
        render(
          <div data-testid="large-condition">
            <WorkflowConditionSource source={source} />
          </div>,
        );
      });
      expect(screen.getByTestId('large-condition').textContent).toBe(source);
      expect(format).not.toHaveBeenCalled();
    });
  });
});
