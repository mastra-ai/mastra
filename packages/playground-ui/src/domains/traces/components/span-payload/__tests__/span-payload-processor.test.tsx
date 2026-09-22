// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { SpanDataPanelView } from '../../span-data-panel-view';
import { SpanDetailsView } from '../../span-details-view';
import { SpanInputRenderer } from '../span-input-renderers';
import { SpanOutputRenderer } from '../span-output-renderers';
import { SpanProcessorAttributes } from '../span-processor-attributes';
import {
  legacyProcessorSpan,
  malformedProcessorSpan,
  processorClearedMessagesSpan,
  processorSystemMutationSpan,
  processorInputSpan,
  processorOutputStreamSpan,
  processorRequestErrorSpan,
  processorToolResultSpan,
  processorTripwireSpan,
} from './fixtures/span-payloads';

// jsdom does not provide PointerEvent, which Base UI switches dispatch.
beforeAll(() => vi.stubGlobal('PointerEvent', MouseEvent));
afterAll(() => vi.unstubAllGlobals());
afterEach(cleanup);

describe('processor span payloads', () => {
  it('reads the phase from the span rather than the payload shape', () => {
    const { container } = render(<SpanInputRenderer span={processorToolResultSpan} />);

    expect(container.querySelector('[data-slot="span-payload-processor"]')?.getAttribute('data-phase')).toBe(
      'toolResult',
    );
    expect(screen.getByText('search')).toBeTruthy();
    expect(screen.getByText('call_17')).toBeTruthy();
  });

  it('renders processor input messages with the shared message components', () => {
    const { container } = render(<SpanInputRenderer span={processorInputSpan} />);

    expect(container.querySelector('[data-slot="span-payload-messages"]')).toBeTruthy();
    expect(screen.getByText('What colour is the sky?')).toBeTruthy();
  });

  it('renders the system messages a processor added as output', () => {
    render(<SpanOutputRenderer span={processorInputSpan} />);

    expect(screen.getByText('Answer in exactly three words.')).toBeTruthy();
  });

  it('says a processor changed nothing instead of showing an empty object', () => {
    const { container } = render(<SpanOutputRenderer span={processorSystemMutationSpan} />);

    expect(screen.getByText('No changes')).toBeTruthy();
    expect(container.textContent).not.toContain('{}');
  });

  it('shows the error a request-error processor saw', () => {
    render(<SpanInputRenderer span={processorRequestErrorSpan} />);

    expect(screen.getByText('Provider returned 429')).toBeTruthy();
    expect(screen.getByText('What colour is the sky?')).toBeTruthy();
  });

  it('keeps the two output hooks apart', () => {
    const { container } = render(<SpanOutputRenderer span={processorOutputStreamSpan} />);

    expect(container.querySelector('[data-slot="span-payload-processor"]')?.getAttribute('data-phase')).toBe(
      'outputStream',
    );
    expect(screen.getByText('The sky is blue.')).toBeTruthy();
  });

  it('falls back to JSON for a span stored before the phase was recorded', () => {
    const { container } = render(<SpanInputRenderer span={legacyProcessorSpan} />);

    expect(container.querySelector('[data-slot="span-payload-processor"]')).toBeNull();
  });
});

describe('processor span attributes', () => {
  it('presents the pipeline facts as labelled values', () => {
    render(<SpanProcessorAttributes span={processorInputSpan} />);

    expect(screen.getByText('Processor')).toBeTruthy();
    expect(screen.getByText('context-note')).toBeTruthy();
    expect(screen.getByText('Phase')).toBeTruthy();
    expect(screen.getByText('Input')).toBeTruthy();
    expect(screen.getByText('Workflow')).toBeTruthy();
    // processorIndex is 0-based; position reads as 1-based.
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('1.84s')).toBeTruthy();
  });

  it('presents message-list mutations as readable actions', () => {
    render(<SpanProcessorAttributes span={processorInputSpan} />);

    expect(screen.getByText('Added system message')).toBeTruthy();
    expect(screen.getByText('context-note · 1 message')).toBeTruthy();
  });

  it('surfaces a tripwire as a blocked run with its reason', () => {
    render(<SpanProcessorAttributes span={processorTripwireSpan} />);

    expect(screen.getByText('Run blocked')).toBeTruthy();
    expect(screen.getByText('Prompt injection detected')).toBeTruthy();
    expect(screen.getByText('No retry')).toBeTruthy();
  });

  it('renders nothing for a span with no recorded phase', () => {
    const { container } = render(<SpanProcessorAttributes span={legacyProcessorSpan} />);

    expect(container.innerHTML).toBe('');
  });
});

describe('processor spans in both span layouts', () => {
  it.each([
    ['data panel', (span: typeof processorInputSpan) => <SpanDataPanelView traceId="t" spanId="s" span={span} />],
    ['details', (span: typeof processorInputSpan) => <SpanDetailsView traceId="t" spanId="s" span={span} />],
  ])('shows a failed processor span with its error in the %s layout', (_name, renderView) => {
    const { container } = render(renderView(processorRequestErrorSpan));

    expect(screen.getByText('Request error')).toBeTruthy();
    expect(screen.getByText('rate-limit-retry')).toBeTruthy();
    expect(screen.getByText('Provider returned 429')).toBeTruthy();
    expect(container.textContent).toContain('Retry budget exhausted');
  });

  it.each([
    ['data panel', (span: typeof processorInputSpan) => <SpanDataPanelView traceId="t" spanId="s" span={span} />],
    ['details', (span: typeof processorInputSpan) => <SpanDetailsView traceId="t" spanId="s" span={span} />],
  ])('shows the processor preview in the %s layout', (_name, renderView) => {
    const { container } = render(renderView(processorInputSpan));

    expect(container.querySelector('[data-slot="span-processor-attributes"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="span-payload-processor"]')).toBeTruthy();
  });
  it.each([
    ['data panel', (span: typeof processorInputSpan) => <SpanDataPanelView traceId="t" spanId="s" span={span} />],
    ['details', (span: typeof processorInputSpan) => <SpanDetailsView traceId="t" spanId="s" span={span} />],
  ])('preserves recorded changes, raw data and fallback in the %s layout', (_name, renderView) => {
    const { rerender, container } = render(renderView(processorSystemMutationSpan));
    expect(screen.getByText('Answer briefly.')).toBeTruthy();
    expect(screen.getByText('Added system message')).toBeTruthy();

    const attributes = Array.from(container.querySelectorAll('[data-slot="span-payload-section"]')).find(section =>
      within(section).queryByText('Attributes'),
    );
    if (!attributes) throw new Error('Missing attributes section');
    fireEvent.click(within(attributes).getByRole('button', { name: 'JSON', exact: true }));
    expect(attributes.textContent).toContain('messageListMutations');
    expect(attributes.textContent).toContain('Answer briefly.');
    fireEvent.click(within(attributes).getByRole('button', { name: 'Preview', exact: true }));
    expect(within(attributes).queryByText('messageListMutations')).toBeNull();

    rerender(renderView(processorClearedMessagesSpan));
    expect(screen.getByText('No messages')).toBeTruthy();
    expect(screen.getByText('No system messages')).toBeTruthy();
    expect(screen.getByText('Cleared messages')).toBeTruthy();

    // A phase this release knows still previews. Values the layout cannot place
    // are not dropped: they stay reachable as JSON, so one odd field never hides
    // the rest of the span.
    rerender(renderView(malformedProcessorSpan));
    expect(container.querySelector('[data-slot="span-processor-attributes"]')).toBeTruthy();
    expect(container.textContent).toContain('keep-this-value');

    // `queryAllByText`: the phase value repeats a section's own name ("Input").
    const sectionNamed = (title: string) =>
      Array.from(container.querySelectorAll('[data-slot="span-payload-section"]')).find(
        section => within(section).queryAllByText(title).length > 0,
      );

    const malformedAttributes = sectionNamed('Attributes');
    if (!malformedAttributes) throw new Error('Missing attributes section');
    fireEvent.click(within(malformedAttributes).getByRole('button', { name: 'JSON', exact: true }));
    expect(malformedAttributes.textContent).toContain('redacted-mutation-log');

    const malformedInput = sectionNamed('Input');
    if (!malformedInput) throw new Error('Missing input section');
    fireEvent.click(within(malformedInput).getByRole('button', { name: 'JSON', exact: true }));
    expect(malformedInput.textContent).toContain('redacted-message-content');
  });
});
