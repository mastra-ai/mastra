// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { EntryContent } from '..';
import type { TimelineSpan } from '../../../lib/build-thread-timeline';
import { summarize } from '../summarize';

afterEach(() => cleanup());

const renderSpan = (span: TimelineSpan) => render(<EntryContent span={span} />);

describe('summarize', () => {
  it('prefers a text-like field', () => {
    expect(summarize({ text: 'Hello' })).toBe('Hello');
  });

  it('falls back to JSON', () => {
    expect(summarize({ city: 'Paris' })).toBe('{"city":"Paris"}');
  });

  it('returns undefined on unusable payloads', () => {
    expect(summarize(undefined)).toBeUndefined();
    expect(summarize({})).toBeUndefined();
  });

  it('clamps long strings', () => {
    expect(summarize('a'.repeat(400))).toHaveLength(161);
  });
});

describe('EntryContent', () => {
  it('renders a model generation as the model id alone, without echoing the answer', () => {
    renderSpan({
      spanId: 'a',
      spanType: 'model_generation',
      attributes: { model: 'gpt-4o' },
      output: { text: 'The weather is fine' },
    });

    expect(screen.getByText('gpt-4o')).toBeTruthy();
    expect(screen.queryByText(/The weather is fine/)).toBeNull();
  });

  it('renders a tool call with its arguments', () => {
    renderSpan({ spanId: 'b', spanType: 'tool_call', entityId: 'weatherInfo', input: { city: 'Paris' } });

    expect(screen.getByText(/weatherInfo/)).toBeTruthy();
    expect(screen.getByText(/Paris/)).toBeTruthy();
  });

  it('renders a processor run with its mutation count', () => {
    renderSpan({
      spanId: 'c',
      spanType: 'processor_run',
      entityId: 'moderation',
      attributes: { messageListMutations: [{ type: 'add' }] },
    });

    expect(screen.getByText(/moderation/)).toBeTruthy();
    expect(screen.getByText(/1 message change/)).toBeTruthy();
  });

  it('renders a workflow step with its status', () => {
    renderSpan({ spanId: 'd', spanType: 'workflow_step', entityId: 'step-1', attributes: { status: 'success' } });

    expect(screen.getByText(/step-1/)).toBeTruthy();
    expect(screen.getByText(/success/)).toBeTruthy();
  });

  it('renders a failed workspace action', () => {
    renderSpan({
      spanId: 'e',
      spanType: 'workspace_action',
      name: 'workspace:filesystem:read_file',
      attributes: { success: false },
    });

    expect(screen.getByText(/read_file/)).toBeTruthy();
    expect(screen.getByText(/failed/)).toBeTruthy();
  });

  it('degrades to the subject alone on unexpected payloads', () => {
    renderSpan({ spanId: 'f', spanType: 'tool_call', entityId: 'weatherInfo', input: () => null });

    expect(screen.getByText(/weatherInfo/)).toBeTruthy();
  });
});
