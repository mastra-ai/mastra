// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { SpanDataPanelView } from '../../span-data-panel-view';
import { SpanDetailsView } from '../../span-details-view';
import { SpanErrorRenderer } from '../span-error-renderer';
import { SpanInputRenderer } from '../span-input-renderers';
import { SpanOutputRenderer } from '../span-output-renderers';
import { SpanPayloadSection } from '../span-payload-section';
import {
  agentRunAbortedSpan,
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

// jsdom does not provide PointerEvent, which Base UI switches dispatch.
beforeAll(() => vi.stubGlobal('PointerEvent', MouseEvent));
afterAll(() => vi.unstubAllGlobals());
afterEach(cleanup);

const slot = (name: string) => document.querySelector(`[data-slot="${name}"]`);

describe('Span metadata JSON sections', () => {
  it.each([SpanDataPanelView, SpanDetailsView])('uses the standard JSON renderer without a preview toggle', View => {
    const span = { ...emptySpan, metadata: { origin: 'metadata-value' }, attributes: { custom: 'attribute-value' } };
    render(<View span={span} spanId={span.spanId} traceId={span.traceId} onClose={() => {}} />);

    for (const title of ['Metadata', 'Attributes']) {
      const section = screen.getByText(title).closest('[data-slot="span-payload-section"]');
      expect(section?.querySelector('[data-slot="span-payload-json"]')).not.toBeNull();
      expect(section?.querySelector('[data-slot="span-payload-view-toggle"]')).toBeNull();
      expect(section?.querySelector('button')).not.toBeNull();
    }
    expect(document.querySelector('.cm-editor')).toBeNull();
    expect(document.body.textContent).toContain('metadata-value');
    expect(document.body.textContent).toContain('attribute-value');
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

  it('renders model generation results with tool calls and chat reasoning', () => {
    render(<SpanOutputRenderer span={modelGenerationSpan} />);
    expect(slot('span-model-generation-result')).not.toBeNull();
    expect(slot('span-payload-tool-calls')).not.toBeNull();
    expect(screen.getByRole('button', { name: /hide reasoning/i })).toBeTruthy();
  });

  it('falls back to JSON for TOOL_CALL', () => {
    render(<SpanOutputRenderer span={toolCallSpan} />);
    expect(slot('span-payload-json')?.textContent).toContain('"temperature": 21');
  });
});

describe('SpanErrorRenderer', () => {
  it('renders the error message and metadata', () => {
    render(<SpanErrorRenderer span={errorSpan} />);
    expect(slot('span-error')).not.toBeNull();
    expect(screen.getByText('City not found: Atlantis')).toBeTruthy();
  });

  it('renders nothing without an error', () => {
    const { container } = render(<SpanErrorRenderer span={toolCallSpan} />);
    expect(container.innerHTML).toBe('');
  });
});

describe.each(['panel', 'details'] as const)('SpanPayloadSection (%s)', layout => {
  it('toggles to the original JSON using the same renderer as tool payloads', () => {
    render(
      <SpanPayloadSection title="Input" raw={agentRunMessagesSpan.input} layout={layout}>
        <SpanInputRenderer span={agentRunMessagesSpan} />
      </SpanPayloadSection>,
    );
    expect(slot('span-payload-messages')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
    expect(slot('span-payload-messages')).toBeNull();
    expect(slot('span-payload-json')?.textContent).toBe(JSON.stringify(agentRunMessagesSpan.input, null, 2));
    expect(document.querySelector('.cm-editor')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Expand JSON' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(slot('span-payload-messages')).not.toBeNull();
  });

  it('renders nothing when raw is null', () => {
    const { container } = render(
      <SpanPayloadSection title="Input" raw={null}>
        <span>rich</span>
      </SpanPayloadSection>,
    );
    expect(container.innerHTML).toBe('');
  });
});

describe.each(['panel', 'details'] as const)('Span %s view', layout => {
  describe('when an error has a formatted preview', () => {
    it('shows the original error JSON and restores the preview independently of other sections', () => {
      const original = JSON.stringify(errorSpan);
      render(
        layout === 'panel' ? (
          <SpanDataPanelView traceId="trace-1" spanId={errorSpan.spanId} span={errorSpan} onClose={() => {}} />
        ) : (
          <SpanDetailsView spanId={errorSpan.spanId} span={errorSpan} onClose={() => {}} />
        ),
      );
      expect(slot('span-error')).not.toBeNull();
      const toggles = screen.getAllByRole('button', { name: 'JSON' });
      expect(toggles).toHaveLength(1);
      expect(slot('span-input-card')).toBeNull();
      expect(slot('span-payload-json')).not.toBeNull();
      const jsonToggle = toggles[0];
      if (!jsonToggle) throw new Error('Missing error JSON toggle');
      fireEvent.click(jsonToggle);
      expect(slot('span-error')).toBeNull();
      expect(document.body.textContent).toContain('"message": "City not found: Atlantis"');
      expect(screen.getAllByRole('button', { name: 'JSON' })[0]?.getAttribute('aria-pressed')).toBe('true');
      expect(screen.getAllByRole('button', { name: 'JSON' })).toHaveLength(1);
      const previewToggle = screen.getAllByRole('button', { name: 'Preview' })[0];
      if (!previewToggle) throw new Error('Missing error Preview toggle');
      fireEvent.click(previewToggle);
      expect(slot('span-error')).not.toBeNull();
      expect(JSON.stringify(errorSpan)).toBe(original);
    });
  });
});

describe('SpanDataPanelView integration', () => {
  it('shows rich payloads and the error banner for a span', () => {
    render(<SpanDataPanelView traceId="trace-1" spanId={errorSpan.spanId} span={errorSpan} onClose={() => {}} />);
    expect(slot('span-error')).not.toBeNull();
    expect(screen.getByText('City not found: Atlantis')).toBeTruthy();
  });
});
