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
import { SpanProcessorMutations } from '../span-processor-mutations';
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

describe('SpanProcessorMutations', () => {
  it('tells each message-list change as a numbered step', () => {
    render(<SpanProcessorMutations span={processorInputSpan} />);
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
    render(<SpanProcessorMutations span={span} />);
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
    render(<SpanProcessorMutations span={span} />);
    expect(steps()).toEqual([
      "Took 1 message from this turn's input out of the conversation",
      "Took 1 message from the model's response out of the conversation",
      'Added 2 messages from memory to the conversation',
    ]);
  });

  it('shows cleared and removed messages, with the removed ids collapsed', () => {
    render(<SpanProcessorMutations span={processorClearedMessagesSpan} />);
    expect(steps()).toEqual([
      'Cleared the whole conversation (2 messages)',
      'Removed 2 messages from the conversation',
    ]);
    fireEvent.click(screen.getByText('Removed ids (2)'));
    expect(slot('span-processor-mutations')?.textContent).toContain('msg-1');
  });

  it('shows a mutation entry it cannot read as JSON', () => {
    const span = makeSpan({
      ...processorClearedMessagesSpan,
      attributes: { processorPhase: 'input', messageListMutations: [null, { type: 'clear', count: 2 }] },
    });
    render(<SpanProcessorMutations span={span} />);
    expect(screen.getByText('Cleared the whole conversation (2 messages)')).toBeTruthy();
    expect(slot('span-processor-mutations')?.querySelector('[data-slot="span-payload-json"]')).not.toBeNull();
  });

  it('renders nothing for a span that changed nothing', () => {
    const { container } = render(<SpanProcessorMutations span={legacyProcessorSpan} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('SpanProcessorAttributes', () => {
  const facts = () => {
    const found = slot('span-processor-attributes');
    if (!(found instanceof HTMLElement)) throw new Error('Missing processor facts');
    return found;
  };
  const factOf = (label: string) => within(facts()).getByText(label).nextElementSibling?.textContent;

  it('shows the pipeline facts as labelled values', () => {
    render(<SpanProcessorAttributes span={processorInputSpan} />);
    expect(factOf('Processor')).toBe('context-note');
    expect(factOf('Phase')).toBe('Input');
    expect(factOf('Executor')).toBe('Workflow');
    // processorIndex is 0-based; the position reads 1-based.
    expect(factOf('Pipeline position')).toBe('2');
    expect(factOf('Hook duration')).toBe('1.84s');
  });

  it('shows a tripwire with its full reason, retry state and metadata', () => {
    const span = makeSpan({
      ...processorTripwireSpan,
      attributes: {
        ...processorTripwireSpan.attributes,
        tripwireAbort: {
          reason: 'Prompt injection detected\nRule injection/v2 matched',
          retry: false,
          metadata: { rule: 'injection/v2' },
        },
      },
    });
    render(<SpanProcessorAttributes span={span} />);
    expect(factOf('Tripwire')).toBe('Prompt injection detected\nRule injection/v2 matched');
    expect(factOf('Retry')).toBe('No');
    expect(factOf('Tripwire metadata')).toBe('{"rule":"injection/v2"}');
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

  it('shows the messages a processor added in its summary, with their actions on the headline row', () => {
    render(<SpanDataPanelView traceId="t" spanId="s" span={processorSystemMutationSpan} />);
    const changes = slot('span-outcome')?.querySelector('[data-slot="span-payload-section"]');
    expect(changes?.firstElementChild?.querySelector('h3')?.textContent).toMatch(
      /added 1 message to the system prompt$/,
    );
    expect(changes?.querySelector('[data-slot="span-payload-view-toggle"]')).not.toBeNull();
    expect(changes?.textContent).toContain('Answer briefly.');
    expect(screen.queryByText('Changes')).toBeNull();
    expect(sectionTitles()[1]).toBe('Input');
  });

  it('reads as changes, then input, then output in the details layout too', () => {
    render(<SpanDetailsView traceId="t" spanId="s" span={processorSystemMutationSpan} />);
    expect(sectionTitles().slice(0, 2)).toEqual(['Changes', 'Input']);
  });

  it('reads a processor as what it changed in the system prompt, then its input, then its output', () => {
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

    expect(sectionTitles().slice(1, 3)).toEqual(['Input', 'Output']);

    const changes = slot('span-outcome');
    if (!changes) throw new Error('Missing summary');
    expect(steps()).toEqual(['Removed 1 message from the system prompt']);
    expect(changes.textContent).toContain('Old task list.');
    expect(changes.textContent).toContain('Task list state may appear.');
    expect(changes.textContent).not.toContain('You are Michel.');
  });
});

describe.each(LAYOUTS)('processor spans in the %s layout', (_name, renderView) => {
  it('previews the input and output', () => {
    render(renderView(processorInputSpan));
    expect(slot('span-payload-processor')).not.toBeNull();
  });

  it('shows what the processor changed, and keeps the recorded attributes folded as JSON', () => {
    render(renderView(processorSystemMutationSpan));
    // A change that carries its message shows the message, not a sentence about it.
    expect(steps()).toEqual([]);
    expect(slot('span-processor-changes')?.textContent).toContain('Answer briefly.');

    const attributes = section('Attributes');
    expect(attributes.textContent).not.toContain('messageListMutations');
    fireEvent.click(within(attributes).getByRole('button', { name: 'Attributes' }));
    expect(attributes.textContent).toContain('messageListMutations');
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
    expect(screen.getByText('Provider returned 429')).toBeTruthy();
    expect(document.body.textContent).toContain('Retry budget exhausted');
  });

  it('keeps a span stored before the phase was recorded on JSON only', () => {
    render(renderView(legacyProcessorSpan));
    expect(slot('span-payload-processor')).toBeNull();
    expect(slot('span-processor-changes')).toBeNull();
    expect(slot('span-processor-attributes')).toBeNull();
  });

  it('leads with the error of a failed processor, once', () => {
    render(renderView(processorRequestErrorSpan));
    const first = document.querySelector('[data-slot="span-payload-section"]');
    expect(first?.querySelector('[data-slot="span-error"]')).not.toBeNull();
    expect(document.querySelectorAll('[data-slot="span-error"]')).toHaveLength(1);
  });

  it('shows the processor facts on top, under the summary and before any section', () => {
    render(renderView(processorInputSpan));
    const facts = slot('span-processor-attributes');
    const firstSection = [...document.querySelectorAll('[data-slot="span-payload-section"]')].find(
      el => !el.closest('[data-slot="span-outcome"]'),
    );
    if (!facts || !firstSection) throw new Error('Missing processor facts or sections');
    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(facts, firstSection)).toBe(true);
    const summary = slot('span-outcome');
    if (summary) expect(follows(summary, facts)).toBe(true);
    expect(sectionTitles()).not.toContain('Processor');
    expect(sectionTitles().slice(-1)).toEqual(['Attributes']);
  });

  it('shows the full tripwire of a processor that stopped the run, once', () => {
    render(renderView(processorTripwireSpan));
    const facts = slot('span-processor-attributes');
    if (!(facts instanceof HTMLElement)) throw new Error('Missing processor facts');
    expect(within(facts).getByText('Tripwire')).toBeTruthy();
    expect(screen.getAllByText('Prompt injection detected')).toHaveLength(1);
  });

  it('still shows what a processor changed before its tripwire stopped the run', () => {
    render(
      renderView(
        makeSpan({
          ...processorTripwireSpan,
          attributes: {
            ...processorTripwireSpan.attributes,
            messageListMutations: [{ type: 'add', source: 'memory', count: 2 }],
          },
        }),
      ),
    );
    expect(section('Changes')).toBeTruthy();
    expect(steps()).toEqual(['Added 2 messages from memory to the conversation']);
  });
});
