// @vitest-environment jsdom
import { SpanType } from '@mastra/core/observability';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { SpanRecord } from '../../../types';
import { SpanDataPanelView } from '../../span-data-panel-view';
import { SpanInputRenderer } from '../span-input-renderers';
import { SpanOutputRenderer } from '../span-output-renderers';
import { getSpanOutputPayload, hasSpanInputPreview, hasSpanOutputPreview } from '../span-payload-registry';
import {
  legacyProcessorSpan,
  malformedProcessorSpan,
  makeSpan,
  processorClearedMessagesSpan,
  processorInputSpan,
  processorInputStepSpan,
  processorLlmRequestSpan,
  processorWithExtrasSpan,
  processorOutputStreamSpan,
  processorRequestErrorSpan,
  processorSystemMutationSpan,
  processorToolResultSpan,
  processorTripwireSpan,
} from './fixtures/span-payloads';
import { renderWithProviders } from '@/test/render';

// jsdom does not provide PointerEvent, which Base UI switches dispatch.
beforeAll(() => vi.stubGlobal('PointerEvent', MouseEvent));
afterAll(() => vi.unstubAllGlobals());
afterEach(cleanup);

const slot = (name: string) => document.querySelector(`[data-slot="${name}"]`);

/** The value in the labelled row, e.g. `valueOf('Executor')` → `'Workflow'`. */
const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

const section = (title: string) => {
  const found = screen.getByText(title).closest('[data-slot="span-payload-section"]');
  if (!(found instanceof HTMLElement)) throw new Error(`Missing ${title} section`);
  return found;
};

describe('SpanPayloadProcessor', () => {
  it('shows system and user messages as one list tagged by role', () => {
    render(<SpanInputRenderer span={processorRequestErrorSpan} />);
    expect(document.querySelectorAll('[data-slot="span-payload-messages"]').length).toBe(1);
    expect(document.querySelectorAll('[data-role="system"]').length).toBe(1);
    expect(document.querySelectorAll('[data-role="user"]').length).toBe(1);
    expect(screen.queryByText('System messages')).toBeNull();
  });

  it('shows the system messages a processor returned as output', () => {
    render(<SpanOutputRenderer span={processorInputSpan} />);
    expect(screen.getByText('Answer in exactly three words.')).toBeTruthy();
  });

  it('shows single values as labelled rows, with copy buttons on ids', () => {
    render(<SpanInputRenderer span={processorToolResultSpan} />);
    expect(valueOf('Tool')).toBe('search');
    expect(valueOf('Provider executed')).toBe('No');
    expect(screen.getByText('call_17')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy to clipboard' })).toBeTruthy();
  });

  it('keeps where in the generation the hook ran in the input', () => {
    render(<SpanInputRenderer span={processorToolResultSpan} />);
    expect(valueOf('Step')).toBe('3');
    cleanup();
    render(<SpanInputRenderer span={processorInputSpan} />);
    expect(valueOf('Retries')).toBe('0');
    cleanup();
    render(<SpanInputRenderer span={processorInputStepSpan} />);
    expect(screen.getByText('Message id')).toBeTruthy();
  });

  it('keeps the two output hooks apart', () => {
    render(<SpanOutputRenderer span={processorOutputStreamSpan} />);
    expect(screen.getByText('The sky is blue.')).toBeTruthy();
    expect(valueOf('Chunks')).toBe('126');
  });

  it('shows the prompt an llmRequest processor got as messages, not as collapsed JSON', () => {
    render(<SpanInputRenderer span={processorLlmRequestSpan} />);
    expect(document.querySelectorAll('[data-slot="span-payload-messages"]').length).toBe(1);
    expect(screen.getByText('You are Michel, a practical home chef.')).toBeTruthy();
    expect(screen.getByText('weather in paris')).toBeTruthy();
    expect(document.querySelectorAll('[data-role="assistant"]').length).toBe(1);
    expect(screen.getByText('Tool result')).toBeTruthy();
    expect(screen.queryByText(/^Prompt/)).toBeNull();
    expect(screen.queryByText('Other fields')).toBeNull();
  });

  it('shows the error a request-error processor saw', () => {
    render(<SpanInputRenderer span={processorRequestErrorSpan} />);
    expect(screen.getByText('Error')).toBeTruthy();
    expect(screen.getByText('Provider returned 429')).toBeTruthy();
  });

  it('collapses secondary context with a count, and leaves out empty lists', () => {
    render(<SpanInputRenderer span={processorInputStepSpan} />);
    expect(screen.getByText('Active tools (1)')).toBeTruthy();
    expect(screen.queryByText(/^Available tools/)).toBeNull();
  });

  it('keeps an empty output as JSON, as any other span would', () => {
    render(<SpanOutputRenderer span={processorSystemMutationSpan} />);
    expect(slot('span-payload-processor')).toBeNull();
    expect(slot('span-payload-json')?.textContent).toContain('{}');
  });

  it('shows a payload it places nothing from as a plain JSON block, not under Other fields', () => {
    render(<SpanInputRenderer span={malformedProcessorSpan} />);
    expect(screen.queryByText('Other fields')).toBeNull();
    expect(slot('span-payload-json')?.textContent).toContain('redacted-message-content');
  });

  it('shows an llmRequest output that only says it did not short-circuit as a plain JSON block', () => {
    render(<SpanOutputRenderer span={processorLlmRequestSpan} />);
    expect(screen.queryByText('Other fields')).toBeNull();
    expect(slot('span-payload-json')?.textContent).toContain('shortCircuited');
  });

  it('keeps unplaced keys under Other fields when they sit next to placed ones', () => {
    render(<SpanInputRenderer span={processorWithExtrasSpan} />);
    expect(screen.getByText('Be brief.')).toBeTruthy();
    fireEvent.click(screen.getByText('Other fields'));
    expect(slot('span-payload-processor')?.textContent).toContain('customFlag');
  });

  it('falls back to JSON for a span stored before the phase was recorded', () => {
    render(<SpanInputRenderer span={legacyProcessorSpan} />);
    expect(slot('span-payload-processor')).toBeNull();
    expect(slot('span-payload-json')).not.toBeNull();
  });
});

describe('processor preview toggle', () => {
  it('offers no preview when the preview would only repeat the raw JSON', () => {
    expect(hasSpanOutputPreview(processorLlmRequestSpan)).toBe(false);
    expect(hasSpanInputPreview(malformedProcessorSpan)).toBe(false);
  });

  it('offers a preview when it formats part of the payload', () => {
    expect(hasSpanInputPreview(processorLlmRequestSpan)).toBe(true);
    expect(hasSpanInputPreview(processorWithExtrasSpan)).toBe(true);
  });

  it('offers no preview when every formatted key is hidden by the caller', () => {
    const span = makeSpan({
      ...processorLlmRequestSpan,
      input: { stepNumber: 1, retryCount: 0 },
    });
    expect(hasSpanInputPreview(span)).toBe(true);
    expect(hasSpanInputPreview(span, ['stepNumber', 'retryCount'])).toBe(false);
  });
});

const openTab = (name: string) => fireEvent.click(screen.getByRole('tab', { name: new RegExp(name, 'i') }));
const promptDiff = () => screen.getByRole('region', { name: 'Prompt' });

describe('processor spans in the data panel', () => {
  const renderPanel = (span: SpanRecord) =>
    renderWithProviders(<SpanDataPanelView traceId="t" spanId="s" span={span} />);

  it('previews the conversation the processor got in the Input tab', () => {
    renderPanel(processorInputSpan);
    openTab('input');
    expect(slot('span-payload-processor')).not.toBeNull();
  });

  it('shows what the processor added to the system prompt as a diff in the Details tab', () => {
    renderPanel(processorSystemMutationSpan);
    const added = promptDiff().querySelectorAll('[data-sign="added"]');
    expect(added.length).toBeGreaterThan(0);
    expect(promptDiff().textContent).toContain('Answer briefly.');
  });

  it('shows what it removed from the system prompt, but not the messages it kept', () => {
    renderPanel(
      makeSpan({
        ...processorInputSpan,
        attributes: { processorPhase: 'input' },
        input: {
          messages: [{ role: 'user', content: 'Plan dinner' }],
          systemMessages: [
            { role: 'system', content: 'You are Michel.' },
            { role: 'system', content: 'Old task list.' },
          ],
        },
        output: {
          systemMessages: [
            { role: 'system', content: 'You are Michel.' },
            { role: 'system', content: 'Task list state may appear.' },
          ],
        },
      }),
    );
    const diff = promptDiff();
    expect(diff.querySelector('[data-sign="removed"]')?.textContent).toContain('Old task list.');
    expect(diff.querySelector('[data-sign="added"]')?.textContent).toContain('Task list state may appear.');
  });

  it('leaves the Prompt section out when the processor changed nothing', () => {
    renderPanel(legacyProcessorSpan);
    expect(screen.queryByRole('region', { name: 'Prompt' })).toBeNull();
  });

  it('keeps the recorded attributes as folded JSON in the Details tab', () => {
    renderPanel(processorSystemMutationSpan);
    expect(screen.getByRole('region', { name: 'Attributes' })).toBeTruthy();
  });

  it('shows a failed processor with its error once, in the Output tab', () => {
    renderPanel(processorRequestErrorSpan);
    openTab('output');
    const output = screen.getByRole('tabpanel', { name: 'Output' });
    expect(output.textContent?.match(/Retry budget exhausted/g)).toHaveLength(1);
  });

  it('shows why a tripwire stopped the run, once, in the Output tab', () => {
    renderPanel(processorTripwireSpan);
    openTab('output');
    const output = screen.getByRole('tabpanel', { name: 'Output' });
    expect(within(output).getByRole('heading', { name: 'prompt-guard stopped the run' })).toBeTruthy();
    expect(output.textContent?.match(/Prompt injection detected/g)).toHaveLength(1);
    expect(within(output).getByText('Not retried.')).toBeTruthy();
  });

  it('keeps a span stored before the phase was recorded on JSON only', () => {
    renderPanel(legacyProcessorSpan);
    openTab('input');
    expect(slot('span-payload-processor')).toBeNull();
  });
});

describe('getSpanOutputPayload', () => {
  it('leaves out the output of a processor that returned nothing', () => {
    expect(getSpanOutputPayload(processorSystemMutationSpan)).toBeUndefined();
  });

  it('leaves out the empty output of a processor that retyped its span', () => {
    // e.g. memory recall: a processor run recorded as a memory operation.
    const span = makeSpan({
      ...processorSystemMutationSpan,
      spanId: 'span-memory-recall',
      spanType: SpanType.MEMORY_OPERATION,
    });
    expect(getSpanOutputPayload(span)).toBeUndefined();
  });

  it('leaves out the empty output of a chunk that streamed nothing', () => {
    // e.g. encrypted reasoning: the chunk opens and closes without any delta.
    const span = makeSpan({
      spanId: 'span-empty-chunk',
      spanType: SpanType.MODEL_CHUNK,
      attributes: { chunkType: 'reasoning', sequenceNumber: 0 },
      output: {},
    });
    expect(getSpanOutputPayload(span)).toBeUndefined();
  });

  it('keeps an empty output for spans that are not processors', () => {
    expect(getSpanOutputPayload(makeSpan({ spanId: 'span-empty-output', output: {} }))).toEqual({});
  });
});
