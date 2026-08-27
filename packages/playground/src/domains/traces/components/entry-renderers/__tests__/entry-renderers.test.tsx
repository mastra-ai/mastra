// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

    expect(screen.getByText('Called model gpt-4o')).toBeTruthy();
    expect(screen.queryByText(/The weather is fine/)).toBeNull();
  });

  it('names the provider on the model line when the span exposes one', () => {
    renderSpan({
      spanId: 'a',
      spanType: 'model_generation',
      attributes: { model: 'gpt-4o', provider: 'openai' },
    });

    expect(screen.getByText('Called model gpt-4o on openai')).toBeTruthy();
  });

  it('keeps the prompt collapsed until the message count on the model line is clicked', () => {
    renderSpan({
      spanId: 'a',
      spanType: 'model_generation',
      attributes: { model: 'gpt-4o' },
      input: {
        messages: [
          { role: 'system', content: 'You are Michel, a home chef.' },
          { role: 'user', content: [{ type: 'text', text: 'What can I cook?' }] },
        ],
      },
    });

    expect(screen.queryByText('You are Michel, a home chef.')).toBeNull();
    expect(screen.getByTestId('model-prompt-messages').textContent).toBe('2 messages');

    fireEvent.click(screen.getByTestId('model-prompt-messages'));

    expect(screen.getByText('system')).toBeTruthy();
    expect(screen.getByText('You are Michel, a home chef.')).toBeTruthy();
    expect(screen.getByText('user')).toBeTruthy();
    expect(screen.getByText('What can I cook?')).toBeTruthy();
  });

  it('counts a single prompt message in the singular', () => {
    renderSpan({
      spanId: 'a',
      spanType: 'model_generation',
      attributes: { model: 'gpt-4o' },
      input: { messages: [{ role: 'system', content: 'You are Michel, a home chef.' }] },
    });

    expect(screen.getByTestId('model-prompt-messages').textContent).toBe('1 message');
  });

  it('keeps the model row to its label when the prompt is missing or unusable', () => {
    renderSpan({
      spanId: 'a',
      spanType: 'model_generation',
      attributes: { model: 'gpt-4o' },
      input: { messages: 'x' },
    });

    expect(screen.getByText('Called model gpt-4o')).toBeTruthy();
    expect(screen.queryByTestId('model-prompt-messages')).toBeNull();
  });

  it('renders a tool call as a collapsed row, its payload one click away', () => {
    renderSpan({
      spanId: 'b',
      spanType: 'tool_call',
      entityId: 'weatherInfo',
      input: { city: 'Paris' },
      output: { degrees: 21 },
    });

    expect(screen.getByText(/WeatherInfo/)).toBeTruthy();
    expect(screen.queryByText(/Paris/)).toBeNull();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByLabelText('Arguments').textContent).toContain('Paris');
    expect(screen.getByLabelText('Result').textContent).toContain('21');
  });

  it('renders a processor run as a collapsed row opening onto input, metadata and output', () => {
    renderSpan({
      spanId: 'c',
      spanType: 'processor_run',
      entityId: 'moderation',
      input: { messages: ['hello'] },
      output: { tripwire: 'blocked' },
      attributes: { messageListMutations: [{ type: 'add' }] },
    });

    expect(screen.getByText(/moderation/)).toBeTruthy();
    expect(screen.queryByText(/tripwire/)).toBeNull();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByLabelText('Input').textContent).toContain('hello');
    expect(screen.getByLabelText('Metadata').textContent).toContain('messageListMutations');
    expect(screen.getByLabelText('Output').textContent).toContain('tripwire');
  });

  it('renders a workflow step with its status', () => {
    renderSpan({ spanId: 'd', spanType: 'workflow_step', entityId: 'step-1', attributes: { status: 'success' } });

    expect(screen.getByText(/step-1/)).toBeTruthy();
    expect(screen.getByText(/success/)).toBeTruthy();
  });

  it('opens a workflow run onto its payload, like a tool call', () => {
    renderSpan({
      spanId: 'd',
      spanType: 'workflow_run',
      entityId: 'dinner-workflow',
      input: { servings: 2 },
      output: { recipe: 'ratatouille' },
    });

    expect(screen.queryByText(/servings/)).toBeNull();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByLabelText('Arguments').textContent).toContain('servings');
    expect(screen.getByLabelText('Result').textContent).toContain('ratatouille');
  });

  it('marks a failed workflow step on its header', () => {
    renderSpan({
      spanId: 'd',
      spanType: 'workflow_step',
      entityId: 'step-1',
      error: { message: 'step blew up' },
    });

    expect(screen.getByLabelText('Failed')).toBeTruthy();
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

    expect(screen.getByText(/WeatherInfo/)).toBeTruthy();
  });
});
