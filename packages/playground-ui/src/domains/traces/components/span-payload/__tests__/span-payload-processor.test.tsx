// @vitest-environment jsdom
import { SpanType } from '@mastra/core/observability';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { SpanRecord } from '../../../types';
import { SpanDataPanelView } from '../../span-data-panel-view';
import { SpanDetailsView } from '../../span-details-view';
import { SpanInputRenderer } from '../span-input-renderers';
import { SpanOutputRenderer } from '../span-output-renderers';
import { SpanProcessorAttributes } from '../span-processor-attributes';
import {
  legacyProcessorSpan,
  malformedProcessorSpan,
  makeSpan,
  processorClearedMessagesSpan,
  processorInputSpan,
  processorInputStepSpan,
  processorOutputStreamSpan,
  processorRequestErrorSpan,
  processorSystemMutationSpan,
  processorToolResultSpan,
  processorTripwireSpan,
} from './fixtures/span-payloads';

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

const LAYOUTS = [
  ['data panel', (span: SpanRecord) => <SpanDataPanelView traceId="t" spanId="s" span={span} />],
  ['details', (span: SpanRecord) => <SpanDetailsView traceId="t" spanId="s" span={span} />],
] as const;

describe('SpanPayloadProcessor', () => {
  it('reads the phase from the span rather than the payload shape', () => {
    render(<SpanInputRenderer span={processorToolResultSpan} />);
    expect(slot('span-payload-processor')?.getAttribute('data-phase')).toBe('toolResult');
  });

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

  it('leaves the step and retry count out of the input, since Attributes shows them', () => {
    render(<SpanInputRenderer span={processorToolResultSpan} />);
    expect(screen.queryByText('Step')).toBeNull();
    cleanup();
    render(<SpanInputRenderer span={processorInputSpan} />);
    expect(screen.queryByText('Retries')).toBeNull();
  });

  it('keeps a step that is not a number in the input', () => {
    const span = makeSpan({
      ...processorToolResultSpan,
      input: { ...processorToolResultSpan.input, stepNumber: 'three' },
    });
    render(<SpanInputRenderer span={span} />);
    expect(valueOf('Step')).toBe('three');
    cleanup();
    render(<SpanProcessorAttributes span={span} />);
    expect(screen.queryByText('Step')).toBeNull();
  });

  it('keeps the two output hooks apart', () => {
    render(<SpanOutputRenderer span={processorOutputStreamSpan} />);
    expect(slot('span-payload-processor')?.getAttribute('data-phase')).toBe('outputStream');
    expect(screen.getByText('The sky is blue.')).toBeTruthy();
    expect(valueOf('Chunks')).toBe('126');
  });

  it('shows the error a request-error processor saw', () => {
    render(<SpanInputRenderer span={processorRequestErrorSpan} />);
    expect(screen.getByText('Error')).toBeTruthy();
    expect(screen.getByText('Provider returned 429')).toBeTruthy();
  });

  it('collapses secondary context with a count, and leaves out empty lists', () => {
    render(<SpanInputRenderer span={processorInputStepSpan} />);
    expect(screen.getByText('Active tools (1)')).toBeTruthy();
    expect(screen.queryByText(/^Tools/)).toBeNull();
    expect(screen.getByText('msg-step-0')).toBeTruthy();
  });

  it('keeps an empty output as JSON, as any other span would', () => {
    render(<SpanOutputRenderer span={processorSystemMutationSpan} />);
    expect(slot('span-payload-processor')).toBeNull();
    expect(slot('span-payload-json')?.textContent).toContain('{}');
  });

  it('keeps a known field with an unexpected shape under Other fields', () => {
    render(<SpanInputRenderer span={malformedProcessorSpan} />);
    fireEvent.click(screen.getByText('Other fields'));
    expect(slot('span-payload-processor')?.textContent).toContain('redacted-message-content');
  });

  it('falls back to JSON for a span stored before the phase was recorded', () => {
    render(<SpanInputRenderer span={legacyProcessorSpan} />);
    expect(slot('span-payload-processor')).toBeNull();
    expect(slot('span-payload-json')).not.toBeNull();
  });
});

describe('SpanProcessorAttributes', () => {
  it('shows the pipeline facts as labelled values', () => {
    render(<SpanProcessorAttributes span={processorInputSpan} />);
    expect(valueOf('Processor')).toBe('context-note');
    expect(valueOf('Phase')).toBe('Input');
    expect(valueOf('Executor')).toBe('Workflow');
    // processorIndex is 0-based; the position reads 1-based.
    expect(valueOf('Pipeline position')).toBe('2');
    expect(valueOf('Hook duration')).toBe('1.84s');
  });

  it('shows where in the generation the hook ran', () => {
    render(<SpanProcessorAttributes span={processorInputSpan} />);
    expect(valueOf('Retries')).toBe('0');
    cleanup();
    render(<SpanProcessorAttributes span={processorToolResultSpan} />);
    expect(valueOf('Step')).toBe('3');
  });

  it('shows message-list changes as readable actions', () => {
    render(<SpanProcessorAttributes span={processorInputSpan} />);
    expect(valueOf('Added system message')).toBe('context-note · 1 message');
  });

  it('adds up identical changes into a single row', () => {
    const span = makeSpan({
      ...processorInputSpan,
      attributes: {
        processorPhase: 'inputStep',
        messageListMutations: [
          { type: 'add', source: 'memory', count: 1 },
          { type: 'add', source: 'memory', count: 1 },
          { type: 'add', source: 'input', count: 1 },
        ],
      },
    });
    render(<SpanProcessorAttributes span={span} />);
    const rows = screen.getAllByText('Added messages').map(key => key.nextElementSibling?.textContent);
    expect(rows).toEqual(['memory · 2 messages', 'input · 1 message']);
    expect(slot('span-processor-mutations')).toBeNull();
  });

  it('shows cleared and removed messages, with the removed ids collapsed', () => {
    render(<SpanProcessorAttributes span={processorClearedMessagesSpan} />);
    expect(valueOf('Cleared messages')).toBe('2 messages');
    expect(screen.getByText('Removed messages')).toBeTruthy();
    fireEvent.click(screen.getByText('Removed ids (2)'));
    expect(slot('span-processor-mutations')?.textContent).toContain('msg-1');
  });

  it('shows a tripwire with its reason, retry state and metadata', () => {
    render(<SpanProcessorAttributes span={processorTripwireSpan} />);
    expect(screen.getByText('Tripwire')).toBeTruthy();
    expect(screen.getByText('Prompt injection detected')).toBeTruthy();
    expect(valueOf('Retry')).toBe('No');
    fireEvent.click(screen.getByText('Metadata'));
    expect(slot('span-processor-attributes')?.textContent).toContain('injection/v2');
  });

  it('keeps attributes it does not show under Other attributes', () => {
    render(<SpanProcessorAttributes span={processorTripwireSpan} />);
    fireEvent.click(screen.getByText('Other attributes'));
    expect(slot('span-processor-attributes')?.textContent).toContain('customGuardScore');
  });

  it('keeps a known attribute with an unexpected shape under Other attributes', () => {
    render(<SpanProcessorAttributes span={malformedProcessorSpan} />);
    fireEvent.click(screen.getByText('Other attributes'));
    expect(slot('span-processor-attributes')?.textContent).toContain('redacted-mutation-log');
  });

  it('shows a mutation entry it cannot read as JSON', () => {
    const span = makeSpan({
      ...processorClearedMessagesSpan,
      attributes: { processorPhase: 'input', messageListMutations: [null, { type: 'clear', count: 2 }] },
    });
    render(<SpanProcessorAttributes span={span} />);
    expect(screen.getByText('Cleared messages')).toBeTruthy();
    expect(slot('span-processor-mutations')?.querySelector('[data-slot="span-payload-json"]')).not.toBeNull();
  });

  it('renders nothing for a span with no recorded phase', () => {
    const { container } = render(<SpanProcessorAttributes span={legacyProcessorSpan} />);
    expect(container.innerHTML).toBe('');
  });
});

describe.each(LAYOUTS)('processor spans in the %s layout', (_name, renderView) => {
  it('previews the input, output and attributes', () => {
    render(renderView(processorInputSpan));
    expect(slot('span-payload-processor')).not.toBeNull();
    expect(slot('span-processor-attributes')).not.toBeNull();
  });

  it('keeps the recorded attributes one click away as JSON', () => {
    render(renderView(processorSystemMutationSpan));
    const attributes = section('Attributes');
    expect(within(attributes).getByText('Added system message')).toBeTruthy();

    fireEvent.click(within(attributes).getByRole('button', { name: 'JSON', exact: true }));
    expect(attributes.textContent).toContain('messageListMutations');
    expect(attributes.textContent).toContain('Answer briefly.');
  });

  it('leaves out the output of a processor that returned nothing', () => {
    render(renderView(processorSystemMutationSpan));
    expect(screen.queryByText('Output')).toBeNull();
    expect(section('Attributes')).toBeTruthy();
  });

  it('leaves out the empty output of a processor that retyped its span', () => {
    // e.g. memory recall: a processor run recorded as a memory operation.
    render(
      renderView(
        makeSpan({ ...processorSystemMutationSpan, spanId: 'span-memory-recall', spanType: SpanType.MEMORY_OPERATION }),
      ),
    );
    expect(screen.queryByText('Output')).toBeNull();
    expect(section('Attributes')).toBeTruthy();
  });

  it('still shows an empty output for spans that are not processors', () => {
    render(renderView(makeSpan({ spanId: 'span-empty-output', output: {} })));
    expect(section('Output')).toBeTruthy();
  });

  it('shows a failed processor span with its error', () => {
    render(renderView(processorRequestErrorSpan));
    expect(valueOf('Phase')).toBe('Request error');
    expect(screen.getByText('Provider returned 429')).toBeTruthy();
    expect(document.body.textContent).toContain('Retry budget exhausted');
  });

  it('keeps a span stored before the phase was recorded on JSON only', () => {
    render(renderView(legacyProcessorSpan));
    expect(slot('span-payload-processor')).toBeNull();
    expect(slot('span-processor-attributes')).toBeNull();
  });
});
