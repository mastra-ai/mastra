// @vitest-environment jsdom
import type { AgentVersionLabel, ListAgentVersionsResponse } from '@mastra/client-js';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AgentExecutionTargetSelect } from '../agent-execution-target-select';

beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

afterEach(cleanup);

const versions: ListAgentVersionsResponse['versions'] = [
  {
    id: 'version-2',
    agentId: 'agent-1',
    versionNumber: 2,
    name: 'Agent',
    instructions: 'Version two',
    model: { provider: 'openai', name: 'gpt-5.4' },
    changeMessage: 'Version two',
    createdAt: '2026-08-31T12:00:00.000Z',
    labels: ['latest', 'pr-101'],
  },
  {
    id: 'version-1',
    agentId: 'agent-1',
    versionNumber: 1,
    name: 'Agent',
    instructions: 'Version one',
    model: { provider: 'openai', name: 'gpt-5.4' },
    changeMessage: 'Initial version',
    createdAt: '2026-08-30T12:00:00.000Z',
    labels: ['production'],
  },
];

const productionLabel: AgentVersionLabel = {
  name: 'production',
  kind: 'production',
  versionId: 'version-1',
  versionNumber: 1,
};
const latestLabel: AgentVersionLabel = {
  name: 'latest',
  kind: 'latest',
  versionId: 'version-2',
  versionNumber: 2,
};
const customLabel: AgentVersionLabel = {
  name: 'pr-101',
  kind: 'custom',
  versionId: 'version-2',
  versionNumber: 2,
  revisionToken: 'revision-pr-101-v2',
};
const replacementLabel: AgentVersionLabel = {
  name: 'candidate',
  kind: 'custom',
  versionId: 'version-2',
  versionNumber: 2,
  revisionToken: 'revision-candidate-v2',
};

describe('AgentExecutionTargetSelect', () => {
  it('emits the recreated label selector after deletion requires explicit reselection', async () => {
    const onTargetChange = vi.fn();
    const target = { kind: 'label' as const, label: 'pr-101' };
    const view = render(
      <AgentExecutionTargetSelect
        target={target}
        labels={[productionLabel, customLabel, latestLabel]}
        versions={versions}
        isAvailable
        onTargetChange={onTargetChange}
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Run target' }));
    const initiallySelectedOption = await screen.findByRole('option', { name: 'pr-101 · v2' });
    fireEvent.pointerDown(initiallySelectedOption, { pointerType: 'mouse' });
    fireEvent.click(initiallySelectedOption, { detail: 1 });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    onTargetChange.mockClear();
    const initialTrigger = screen.getByRole('combobox', { name: 'Run target' });

    view.rerender(
      <AgentExecutionTargetSelect
        target={target}
        labels={[productionLabel, customLabel, latestLabel]}
        versions={versions}
        isAvailable={false}
        onTargetChange={onTargetChange}
      />,
    );
    const invalidatedTrigger = screen.getByRole('combobox', { name: 'Run target' });
    expect(invalidatedTrigger).not.toBe(initialTrigger);
    expect(invalidatedTrigger.textContent).toContain('pr-101 · v2 · unavailable');

    view.rerender(
      <AgentExecutionTargetSelect
        target={target}
        labels={[productionLabel, replacementLabel, latestLabel]}
        versions={versions}
        isAvailable={false}
        onTargetChange={onTargetChange}
      />,
    );
    const replacedCollectionTrigger = screen.getByRole('combobox', { name: 'Run target' });
    expect(replacedCollectionTrigger).not.toBe(invalidatedTrigger);
    expect(replacedCollectionTrigger.textContent).toContain('pr-101 · unavailable');

    view.rerender(
      <AgentExecutionTargetSelect
        target={target}
        labels={[productionLabel, latestLabel]}
        versions={versions}
        isAvailable={false}
        onTargetChange={onTargetChange}
      />,
    );
    const deletedTrigger = screen.getByRole('combobox', { name: 'Run target' });
    expect(deletedTrigger).not.toBe(replacedCollectionTrigger);
    expect(deletedTrigger.textContent).toContain('pr-101 · unavailable');
    view.rerender(
      <AgentExecutionTargetSelect
        target={target}
        labels={[productionLabel, customLabel, latestLabel]}
        versions={versions}
        isAvailable={false}
        onTargetChange={onTargetChange}
      />,
    );
    const recreatedTrigger = screen.getByRole('combobox', { name: 'Run target' });
    expect(recreatedTrigger).not.toBe(deletedTrigger);
    expect(recreatedTrigger.textContent).toContain('pr-101 · v2 · unavailable');

    fireEvent.click(recreatedTrigger);
    expect((await screen.findAllByRole('option')).map(option => option.textContent)).toEqual([
      'production · v1',
      'pr-101 · v2',
      'latest · v2',
      'v2',
      'v1',
      'pr-101 · v2 · unavailable',
    ]);
    const recreatedOption = await screen.findByRole('option', { name: 'pr-101 · v2' });
    fireEvent.pointerDown(recreatedOption, { pointerType: 'mouse' });
    fireEvent.click(recreatedOption, { detail: 1 });

    await waitFor(() => {
      expect(onTargetChange).toHaveBeenCalledWith({ kind: 'label', label: 'pr-101' });
    });
  });
});
