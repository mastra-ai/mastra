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

const sectionTitles = () =>
  [...document.querySelectorAll('[data-slot="span-payload-section"]')].map(
    found => found.firstElementChild?.firstElementChild?.textContent,
  );

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

  it('leaves the step, retry count and response message id out of the input, since Attributes shows them', () => {
    render(<SpanInputRenderer span={processorToolResultSpan} />);
    expect(screen.queryByText('Step')).toBeNull();
    cleanup();
    render(<SpanInputRenderer span={processorInputSpan} />);
    expect(screen.queryByText('Retries')).toBeNull();
    cleanup();
    render(<SpanInputRenderer span={processorInputStepSpan} />);
    expect(screen.queryByText('Message id')).toBeNull();
    expect(screen.queryByText('msg-step-0')).toBeNull();
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
    expect(screen.queryByText(/^Available tools/)).toBeNull();
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

const steps = () =>
  Array.from(
    slot('span-processor-mutations')?.querySelectorAll('[data-slot="span-processor-mutation-step"]') ?? [],
  ).map(step => step.textContent);

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

  it('shows the assistant message the step answers with, shortened like the other ids and copied in full', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<SpanProcessorAttributes span={processorInputStepSpan} />);
    expect(valueOf('Assistant message id')).toBe('msg-st');
    fireEvent.click(screen.getByRole('button', { name: 'Copy assistant message id' }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('msg-step-0'));
  });

  it('tells each message-list change as a numbered step', () => {
    render(<SpanProcessorAttributes span={processorInputSpan} />);
    expect(steps()).toEqual(['Added a "context-note" message to the system prompt']);
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
    expect(steps()).toEqual([
      'Added 2 messages from memory to the conversation',
      "Added 1 message to this turn's input",
    ]);
  });

  it('keeps the order the changes happened in', () => {
    const span = makeSpan({
      ...processorInputSpan,
      attributes: {
        processorPhase: 'inputStep',
        messageListMutations: [
          { type: 'clear', source: 'input', count: 1 },
          { type: 'clear', source: 'response', count: 1 },
          { type: 'add', source: 'memory', count: 2 },
        ],
      },
    });
    render(<SpanProcessorAttributes span={span} />);
    expect(steps()).toEqual([
      "Took 1 message from this turn's input out of the conversation",
      "Took 1 message from the model's response out of the conversation",
      'Added 2 messages from memory to the conversation',
    ]);
  });

  it('shows cleared and removed messages, with the removed ids collapsed', () => {
    render(<SpanProcessorAttributes span={processorClearedMessagesSpan} />);
    expect(steps()).toEqual([
      'Cleared the whole conversation (2 messages)',
      'Removed 2 messages from the conversation',
    ]);
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
    expect(screen.getByText('Cleared the whole conversation (2 messages)')).toBeTruthy();
    expect(slot('span-processor-mutations')?.querySelector('[data-slot="span-payload-json"]')).not.toBeNull();
  });

  it('renders nothing for a span with no recorded phase', () => {
    const { container } = render(<SpanProcessorAttributes span={legacyProcessorSpan} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('processor spans in the data panel', () => {
  it('leads with what the processor did and shows the conversation it passed along', () => {
    render(<SpanDataPanelView traceId="t" spanId="s" span={processorInputSpan} />);
    expect(slot('span-outcome')).not.toBeNull();
    expect(slot('span-payload-processor')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Input & output|^Input$/ })).toBeNull();
  });

  it('shows the messages a processor added right after its input and output, not again in the attributes', () => {
    render(<SpanDataPanelView traceId="t" spanId="s" span={processorSystemMutationSpan} />);
    expect(slot('span-outcome')?.querySelector('[data-slot="span-processor-changes"]')).toBeNull();
    expect(
      sectionTitles()
        .filter(title => title !== 'Output')
        .slice(0, 2),
    ).toEqual(['Input', 'Changes']);
    expect(slot('span-processor-changes')?.textContent).toContain('Answer briefly.');
    expect(slot('span-processor-attributes')?.textContent).not.toContain('to the system prompt');
  });

  it('reads a processor as input, output, then what it changed in the system prompt', () => {
    const span = makeSpan({
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
    });
    render(<SpanDataPanelView traceId="t" spanId="s" span={span} />);

    expect(sectionTitles().slice(0, 3)).toEqual(['Input', 'Output', 'Changes']);

    const changes = section('Changes');
    expect(steps()).toEqual(['Removed 1 message from the system prompt']);
    expect(changes.textContent).toContain('Old task list.');
    expect(changes.textContent).toContain('Task list state may appear.');
    expect(changes.textContent).not.toContain('You are Michel.');
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
    // The data panel shows the change in the span outcome, ahead of the attributes.
    // A change that carries its message shows the message, not a sentence about it.
    expect(steps()).toEqual([]);
    expect(slot('span-processor-mutations')?.textContent).toContain('Answer briefly.');

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

  it('leaves out the empty output of a chunk that streamed nothing', () => {
    // e.g. encrypted reasoning: the chunk opens and closes without any delta.
    render(
      renderView(
        makeSpan({
          spanId: 'span-empty-chunk',
          spanType: SpanType.MODEL_CHUNK,
          attributes: { chunkType: 'reasoning', sequenceNumber: 0 },
          output: {},
        }),
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
