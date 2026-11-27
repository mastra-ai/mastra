// @vitest-environment jsdom
import { traceQueryPredicateSchema } from '@mastra/core/storage';
import type { TraceQueryPredicate } from '@mastra/core/storage';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  expressionToTracePredicate,
  TRACE_PREDICATE_QUANTIFIERS,
  traceOperatorsFor,
  tracePredicateToExpression,
} from './trace-predicate-expression';
import { FilterBar } from '@/ds/components/FilterBar';
import type { FilterBarExpression, FilterBarOperator, FilterBarScope } from '@/ds/components/FilterBar';

const OPERATORS: FilterBarOperator[] = [
  { id: 'eq', label: 'is', arity: 'one' },
  { id: 'ne', label: 'is not', arity: 'one' },
  { id: 'gt', label: 'is more than', arity: 'one' },
  { id: 'hasAllTokens', label: 'contains every word', arity: 'one', freeText: true },
];

const SCOPES: FilterBarScope[] = [
  {
    id: 'spans',
    label: 'spans',
    quantifiers: TRACE_PREDICATE_QUANTIFIERS,
    fields: [
      { id: 'name', label: 'Span name', operators: ['eq', 'ne'] },
      { id: 'all', label: 'Span content', operators: ['hasAllTokens'] },
    ],
  },
];

function TraceWhereEditor({ initial, onChange }: { initial: TraceQueryPredicate; onChange: (p: unknown) => void }) {
  const [expression, setExpression] = useState<FilterBarExpression>(
    () => tracePredicateToExpression(initial) ?? { logic: 'and', nodes: [] },
  );
  return (
    <FilterBar
      fields={[
        { id: 'status', label: 'Status', operators: ['eq', 'ne'] },
        { id: 'durationMs', label: 'Duration', type: 'number', operators: ['gt'] },
      ]}
      operators={OPERATORS}
      value={expression}
      onValueChange={next => {
        setExpression(next);
        onChange(expressionToTracePredicate(next));
      }}
      negatable
      rootLogicToggle
      scopes={SCOPES}
      maxScopedGroups={8}
      operatorsFor={traceOperatorsFor}
    >
      <FilterBar.Chips />
      <FilterBar.Input placeholder="Filter" />
    </FilterBar>
  );
}

const status = { op: 'eq', left: { path: 'status' }, right: { literal: 'error' } } as const;
const lastPredicate = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)?.[0];

describe('editing a trace predicate in a FilterBar', () => {
  afterEach(cleanup);

  it('writes a negated chip back as `not`', () => {
    const onChange = vi.fn();
    render(<TraceWhereEditor initial={status} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^Negate/ }));
    const predicate = lastPredicate(onChange);
    expect(predicate).toEqual({ op: 'not', arg: status });
    expect(traceQueryPredicateSchema.safeParse(predicate).success).toBe(true);
  });

  it('writes the root logic toggle back as the root group', () => {
    const onChange = vi.fn();
    const duration = { op: 'gt', left: { path: 'durationMs' }, right: { literal: 500 } } as const;
    render(<TraceWhereEditor initial={{ op: 'and', args: [status, duration] }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /and/i }));
    expect(lastPredicate(onChange)).toEqual({ op: 'or', args: [status, duration] });
  });

  it('switches a related clause to `none` and writes it back', async () => {
    const onChange = vi.fn();
    const clause = { spans: { some: { op: 'eq', left: { path: 'name' }, right: { literal: 'llm' } } } } as const;
    render(<TraceWhereEditor initial={clause} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^Has spans/ }));
    const [hasNo] = await screen.findAllByRole('radio', { name: 'Has no' });
    if (!hasNo) throw new Error('no quantifier switch');
    fireEvent.click(hasNo);
    const predicate = lastPredicate(onChange);
    expect(predicate).toEqual({ spans: { none: clause.spans.some } });
    expect(traceQueryPredicateSchema.safeParse(predicate).success).toBe(true);
  });

  it('does not offer word search inside a `none` clause', async () => {
    const clause = { spans: { none: { op: 'eq', left: { path: 'name' }, right: { literal: 'llm' } } } } as const;
    render(<TraceWhereEditor initial={clause} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Has no spans/ }));
    const [editor] = await screen.findAllByRole('group', { name: /^Conditions joined with/ });
    if (!editor) throw new Error('no editor');
    fireEvent.click(within(editor).getByRole('button', { name: /Condition/ }));
    const input = within(editor).getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Span' } });
    expect(screen.getByRole('option', { name: /Span name/ })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Span content/ })).toBeNull();
  });
});
