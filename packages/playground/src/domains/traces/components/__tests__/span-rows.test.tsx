// @vitest-environment jsdom
import type { SpanNode } from '@mastra/playground-ui/domains/traces/components';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { TimelineSpan } from '../../lib/build-thread-timeline';
import { SpanRowList } from '../span-rows';
import { TestLinkProvider } from '@/test/link-provider';

afterEach(() => cleanup());

const node = (span: TimelineSpan, children: SpanNode<TimelineSpan>[] = []): SpanNode<TimelineSpan> => ({
  span,
  children,
});

const renderRows = (nodes: SpanNode<TimelineSpan>[]) =>
  render(
    <TestLinkProvider>
      <ul>
        <SpanRowList nodes={nodes} />
      </ul>
    </TestLinkProvider>,
  );

const workflow = () =>
  node({ spanId: 'w', spanType: 'workflow_run', entityId: 'recipe-maker', attributes: { status: 'success' } }, [
    node({ spanId: 's1', spanType: 'workflow_step', entityId: 'chop' }, [
      node({ spanId: 's1a', spanType: 'tool_call', entityId: 'knife' }),
    ]),
    node({ spanId: 's2', spanType: 'workflow_step', entityId: 'simmer' }),
  ]);

describe('SpanRows', () => {
  it('stands for its whole execution, without a row per step', () => {
    renderRows([workflow()]);

    expect(screen.getByText('recipe-maker')).toBeTruthy();
    expect(screen.queryByText('chop')).toBeNull();
    expect(screen.queryByText('simmer')).toBeNull();
    // nor anything the steps went on to do
    expect(screen.queryByText('Knife')).toBeNull();
  });

  it('shows the final state of the run instead', () => {
    renderRows([
      node({ spanId: 'w', spanType: 'workflow_run', entityId: 'recipe-maker', output: { dish: 'ratatouille' } }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: /recipe-maker/ }));

    expect(screen.getByLabelText('Result').textContent).toContain('ratatouille');
  });

  it('leaves other spans showing their children inline', () => {
    renderRows([
      node({ spanId: 'm', spanType: 'model_generation', attributes: { model: 'gpt-4o' } }, [
        node({ spanId: 't', spanType: 'tool_call', entityId: 'knife' }),
      ]),
    ]);

    expect(screen.getByText('Knife')).toBeTruthy();
  });
});
