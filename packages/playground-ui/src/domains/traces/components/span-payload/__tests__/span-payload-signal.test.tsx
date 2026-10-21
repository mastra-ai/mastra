// @vitest-environment jsdom
import { SpanType } from '@mastra/core/observability';
import { cleanup, render, screen } from '@testing-library/react';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SpanDetailsView } from '../../span-details-view';
import { SpanInputRenderer } from '../span-input-renderers';
import {
  agentRunLegacySignalSpan,
  agentRunReminderSignalSpan,
  agentRunResumeSpan,
  agentRunSkillSignalSpan,
  agentRunUserSignalSpan,
  makeSpan,
} from './fixtures/span-payloads';

beforeAll(() => vi.stubGlobal('PointerEvent', MouseEvent));
afterAll(() => vi.unstubAllGlobals());
afterEach(cleanup);

const slot = (name: string) => document.querySelector(`[data-slot="${name}"]`);

describe('Agent run started by a signal', () => {
  it('renders a skill signal as a skill row with its name, arguments and instructions', () => {
    render(<SpanInputRenderer span={agentRunSkillSignalSpan} />);

    const skill = screen.getByLabelText('Skill: factory-triage');
    expect(skill.textContent).toContain('factory-triage mastra-ai/mastra#123');
    expect(document.body.textContent).toContain('Read the issue and label it.');
    expect(document.body.textContent).not.toContain('ARGUMENTS:');
    expect(slot('span-payload-json')).toBeNull();
    expect(document.body.textContent).not.toContain('[Function]');
  });

  it('shows the signal metadata that identifies where the run came from', () => {
    render(<SpanInputRenderer span={agentRunSkillSignalSpan} />);

    const details = screen.getByText('Signal').parentElement;
    expect(details?.textContent).toContain('reactive');
    expect(details?.textContent).toContain('skill');
    expect(details?.textContent).toContain('factory-triage');
    expect(details?.textContent).toContain('signal-skill-1');
  });

  it('renders a user signal as a user message, not as a signal row', () => {
    render(<SpanInputRenderer span={agentRunUserSignalSpan} />);

    expect(slot('span-signal-input')?.getAttribute('data-signal-type')).toBe('user');
    expect(screen.getByText('Can you summarize the open triage queue?')).toBeTruthy();
    expect(document.body.textContent).toContain('user');
    expect(screen.queryByLabelText(/^Skill:/)).toBeNull();
  });

  it('renders a reactive signal labelled by its tag', () => {
    render(<SpanInputRenderer span={agentRunReminderSignalSpan} />);

    expect(document.body.textContent).toContain('system-reminder');
    expect(document.body.textContent).toContain('CI on main is red.');
    expect(document.body.textContent).toContain('ci-status');
    expect(slot('span-payload-json')).toBeNull();
  });

  it('recognises signals traced before the signal attribute was recorded', () => {
    render(<SpanInputRenderer span={agentRunLegacySignalSpan} />);

    const input = slot('span-signal-input');
    expect(input?.getAttribute('data-signal-type')).toBe('reactive');
    expect(document.body.textContent).toContain('system-reminder');
    expect(document.body.textContent).toContain('Deploy finished.');
    expect(document.body.textContent).not.toContain('[Function]');
  });

  it('leaves resumed runs and plain inputs with a contents field to their existing renderers', () => {
    render(<SpanInputRenderer span={agentRunResumeSpan} />);
    expect(slot('span-signal-input')).toBeNull();
    cleanup();

    render(
      <SpanInputRenderer span={makeSpan({ spanType: SpanType.AGENT_RUN, input: { contents: 'not a signal' } })} />,
    );
    expect(slot('span-signal-input')).toBeNull();
    expect(slot('span-payload-json')).not.toBeNull();
  });

  it('offers the preview / JSON toggle for the signal input in the span details', () => {
    const span = agentRunSkillSignalSpan;
    render(<SpanDetailsView span={span} spanId={span.spanId} traceId={span.traceId} onClose={() => {}} />);

    const section = screen.getByText('Input').closest('[data-slot="span-payload-section"]');
    expect(section?.querySelector('[data-slot="span-payload-view-toggle"]')).not.toBeNull();
    expect(section?.querySelector('[data-slot="span-signal-input"]')).not.toBeNull();
  });
});
