// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { SpanDataPanelView } from '../../span-data-panel-view';
import { SpanDetailsView } from '../../span-details-view';
import { SpanInputRenderer } from '../span-input-renderers';
import { SpanOutputRenderer } from '../span-output-renderers';
import { SpanProcessorAttributes } from '../span-processor-attributes';
import {
  legacyProcessorSpan,
  processorInputSpan,
  processorOutputStreamSpan,
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
    expect(screen.getByText('Tool result')).toBeTruthy();
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
    expect(screen.getByText(/context-note/)).toBeTruthy();
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
  ])('shows the processor preview in the %s layout', (_name, renderView) => {
    const { container } = render(renderView(processorInputSpan));

    expect(container.querySelector('[data-slot="span-processor-attributes"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="span-payload-processor"]')).toBeTruthy();
  });
});
