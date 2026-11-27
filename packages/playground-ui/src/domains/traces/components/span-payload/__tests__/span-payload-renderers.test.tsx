// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { SpanRecord } from '../../../types';

import { SpanDataPanelView } from '../../span-data-panel-view';
import { SpanErrorDetails } from '../span-error-renderer';
import { SpanInputRenderer } from '../span-input-renderers';
import { SpanOutputRenderer } from '../span-output-renderers';
import {
  agentRunAbortedSpan,
  agentRunInterruptedSpan,
  agentRunMessagesSpan,
  agentRunResumeSpan,
  agentRunSuspendedSpan,
  agentRunTripwireSpan,
  emptySpan,
  errorSpan,
  modelGenerationSpan,
  modelStepSpan,
  toolCallSpan,
  unknownPartSpan,
  workflowStepSpan,
} from './fixtures/span-payloads';
import { renderWithProviders } from '@/test/render';

// jsdom does not provide PointerEvent, which Base UI switches dispatch.
beforeAll(() => vi.stubGlobal('PointerEvent', MouseEvent));
afterAll(() => vi.unstubAllGlobals());
afterEach(cleanup);

const slot = (name: string) => document.querySelector(`[data-slot="${name}"]`);
const sectionTitles = () =>
  [...document.querySelectorAll('[data-slot="span-payload-section"]')].map(
    section => section.firstElementChild?.firstElementChild?.textContent,
  );

describe('Span metadata JSON sections', () => {
  const span = { ...emptySpan, metadata: { origin: 'metadata-value' }, attributes: { custom: 'attribute-value' } };

  it('open folded on their root in the data panel, with their heading always shown', async () => {
    render(<SpanDataPanelView span={span} spanId={span.spanId} traceId={span.traceId} />);

    for (const title of ['Metadata', 'Attributes']) {
      const section = screen.getByRole('region', { name: title });
      await waitFor(() => expect(section.querySelector('.cm-foldPlaceholder')?.textContent).toBe('…'));
      expect(section.textContent).not.toContain(`${title.toLowerCase().replace(/s$/, '')}-value`);
      expect(section.querySelector('[data-slot="collapsible-box"]')).toBeNull();
    }
  });
});

describe('SpanInputRenderer', () => {
  it('renders AGENT_RUN messages as a message list with tool parts', () => {
    render(<SpanInputRenderer span={agentRunMessagesSpan} />);

    expect(slot('span-payload-messages')).not.toBeNull();
    expect(document.querySelectorAll('[data-role="user"]').length).toBe(1);
    expect(document.querySelectorAll('[data-role="system"]').length).toBe(1);
    expect(screen.getByText('What is the weather like in Paris today?')).toBeTruthy();
    expect(slot('span-payload-tool')?.textContent).toContain('GetWeather');
    expect(document.querySelectorAll('[data-slot="span-payload-tool"]').length).toBe(2);
  });

  it('renders MODEL_STEP shallow messages', () => {
    render(<SpanInputRenderer span={modelStepSpan} />);
    expect(slot('span-payload-messages')).not.toBeNull();
    expect(document.querySelectorAll('[data-role]').length).toBeGreaterThan(0);
  });

  it('renders resumed agent runs with their target tool and resume data', () => {
    render(<SpanInputRenderer span={agentRunResumeSpan} />);
    expect(slot('span-agent-run-resume')).not.toBeNull();
    expect(screen.getByText('Resumes into')).toBeTruthy();
    expect(slot('span-payload-json')).not.toBeNull();
  });

  it('falls back to JSON for TOOL_CALL and WORKFLOW_STEP', () => {
    render(<SpanInputRenderer span={toolCallSpan} />);
    expect(slot('span-payload-json')?.textContent).toContain('"city": "Paris"');
    cleanup();
    render(<SpanInputRenderer span={workflowStepSpan} />);
    expect(slot('span-payload-json')?.textContent).toContain('"userId": "u-1"');
  });

  it('renders nothing when there is no input', () => {
    const { container } = render(<SpanInputRenderer span={emptySpan} />);
    expect(container.innerHTML).toBe('');
  });

  it('degrades an unknown message part to JSON instead of crashing', () => {
    render(<SpanInputRenderer span={unknownPartSpan} />);
    expect(slot('span-payload-messages')).not.toBeNull();
    expect(slot('span-payload-json')?.textContent).toContain('hologram');
  });
});

describe('SpanOutputRenderer', () => {
  it('renders suspended and aborted outputs as a warning', () => {
    render(<SpanOutputRenderer span={agentRunSuspendedSpan} />);
    expect(slot('span-interrupted')?.getAttribute('data-status')).toBe('suspended');
    expect(screen.getByText('Suspended')).toBeTruthy();
    expect(screen.getByText('Waiting for human approval before deploying.')).toBeTruthy();
    cleanup();
    render(<SpanOutputRenderer span={agentRunAbortedSpan} />);
    expect(screen.getByText('Aborted')).toBeTruthy();
    expect(screen.getByText('Client disconnected')).toBeTruthy();
    cleanup();
    render(<SpanOutputRenderer span={agentRunInterruptedSpan} />);
    expect(slot('span-interrupted')?.getAttribute('data-status')).toBe('interrupted');
    expect(screen.getByText('Interrupted')).toBeTruthy();
  });

  it('renders agent run results as markdown text and surfaces tripwires', () => {
    render(<SpanOutputRenderer span={agentRunMessagesSpan} />);
    expect(slot('span-agent-run-result')).not.toBeNull();
    expect(screen.getByText('sunny')).toBeTruthy();
    cleanup();
    render(<SpanOutputRenderer span={agentRunTripwireSpan} />);
    expect(screen.getByText('Tripwire')).toBeTruthy();
    expect(screen.getByText('Prompt injection detected')).toBeTruthy();
  });

  it('renders model generation results with chat reasoning, leaving tool calls to their own section', () => {
    render(<SpanOutputRenderer span={modelGenerationSpan} />);
    expect(slot('span-model-generation-result')).not.toBeNull();
    expect(slot('span-payload-tool-calls')).toBeNull();
    expect(screen.getByRole('button', { name: 'Reasoning' })).toBeTruthy();
  });

  it('falls back to JSON for TOOL_CALL', () => {
    render(<SpanOutputRenderer span={toolCallSpan} />);
    expect(slot('span-payload-json')?.textContent).toContain('"temperature": 21');
  });
});

describe('SpanErrorDetails', () => {
  it('renders the error message and metadata', () => {
    render(<SpanErrorDetails span={errorSpan} />);
    expect(slot('span-error')).not.toBeNull();
    expect(screen.getByText('City not found: Atlantis')).toBeTruthy();
  });

  it('renders nothing without an error', () => {
    const { container } = render(<SpanErrorDetails span={toolCallSpan} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('SpanDataPanelView integration', () => {
  const renderPanel = (span: SpanRecord) =>
    renderWithProviders(<SpanDataPanelView traceId="trace-1" spanId={span.spanId} span={span} />);
  const openTab = (name: string) => fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${name}`, 'i') }));
  const tabPanel = (name: string) => screen.getByRole('tabpanel', { name });

  it('reads a tool call as its input in one tab and its output in the other', () => {
    renderPanel(toolCallSpan);
    openTab('input');
    expect(within(tabPanel('Input')).getByRole('group', { name: 'Input' })).toBeTruthy();
    openTab('output');
    expect(within(tabPanel('Output')).getByRole('group', { name: 'Output' })).toBeTruthy();
    expect(slot('span-outcome')).toBeNull();
  });

  it('puts no summary over the output of a successful root span', () => {
    renderPanel(agentRunMessagesSpan);
    openTab('output');
    expect(slot('span-outcome')).toBeNull();
    expect(within(tabPanel('Output')).getByRole('group', { name: 'Output' })).toBeTruthy();
  });

  it('still says why a root span whose run was stopped stopped', () => {
    renderPanel(agentRunTripwireSpan);
    openTab('output');
    expect(within(tabPanel('Output')).getByRole('heading', { level: 3 })).toBeTruthy();
  });

  it('shows the error of a failed span once, at the top of the Output tab', () => {
    renderPanel(errorSpan);
    openTab('output');
    const output = tabPanel('Output');
    expect(within(output).getByRole('heading', { name: 'getWeather failed' })).toBeTruthy();
    expect(output.querySelectorAll('[data-slot="span-error"]')).toHaveLength(1);
    expect(within(output).getAllByText('City not found: Atlantis')).toHaveLength(1);
  });

  it('leads a failed root span with its error too', () => {
    renderPanel({ ...errorSpan, parentSpanId: null });
    openTab('output');
    expect(tabPanel('Output').querySelectorAll('[data-slot="span-error"]')).toHaveLength(1);
  });
});
