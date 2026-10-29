// @vitest-environment jsdom
import { createSignal } from '@mastra/core/agent';
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
  modelGenerationSkillSpan,
  modelGenerationSpan,
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

    const details = screen.getByLabelText('Signal');
    expect(details.textContent).toContain('reactive');
    expect(details.textContent).toContain('skill');
    expect(details.textContent).toContain('factory-triage');
    expect(details.textContent).toContain('signal');
    expect(details.textContent).not.toContain('signal-skill-1');
    expect(screen.getByRole('button', { name: 'Copy signal id signal-skill-1' })).toBeTruthy();
  });

  it('renders a user signal as a user message, not as a signal row', () => {
    render(<SpanInputRenderer span={agentRunUserSignalSpan} />);

    expect(slot('span-signal')?.getAttribute('data-signal-type')).toBe('user');
    expect(screen.getByText('Can you summarize the open triage queue?')).toBeTruthy();
    expect(document.body.textContent).toContain('user');
    expect(screen.queryByLabelText(/^Skill:/)).toBeNull();
  });

  it('drops the type and tag of a user signal, which the user bubble already says, but keeps its id', () => {
    render(<SpanInputRenderer span={agentRunUserSignalSpan} />);

    const details = screen.getByLabelText('Signal');
    expect(details.textContent).not.toContain('Type');
    expect(details.textContent).not.toContain('Tag');
    expect(details.textContent).toContain('Signal idsignal');
    expect(screen.getByRole('button', { name: 'Copy signal id signal-user-1' })).toBeTruthy();
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

    const input = slot('span-signal');
    expect(input?.getAttribute('data-signal-type')).toBe('reactive');
    expect(document.body.textContent).toContain('system-reminder');
    expect(document.body.textContent).toContain('Deploy finished.');
    expect(document.body.textContent).not.toContain('[Function]');
  });

  it('leaves resumed runs and plain inputs with a contents field to their existing renderers', () => {
    render(<SpanInputRenderer span={agentRunResumeSpan} />);
    expect(slot('span-signal')).toBeNull();
    cleanup();

    render(
      <SpanInputRenderer span={makeSpan({ spanType: SpanType.AGENT_RUN, input: { contents: 'not a signal' } })} />,
    );
    expect(slot('span-signal')).toBeNull();
    expect(slot('span-payload-json')).not.toBeNull();
  });

  it('offers the preview / JSON toggle for the signal input in the span details', () => {
    const span = agentRunSkillSignalSpan;
    render(<SpanDetailsView span={span} spanId={span.spanId} traceId={span.traceId} onClose={() => {}} />);

    const section = screen.getByText('Input').closest('[data-slot="span-payload-section"]');
    expect(section?.querySelector('[data-slot="span-payload-view-toggle"]')).not.toBeNull();
    expect(section?.querySelector('[data-slot="span-signal"]')).not.toBeNull();
  });
});

describe('Model call whose user message is a skill', () => {
  it('uses the message core renders a skill signal to', () => {
    const message = createSignal({
      type: 'reactive',
      tagName: 'skill',
      attributes: { name: 'factory-triage' },
      contents:
        'Read the issue and label it.\n\nARGUMENTS: mastra-ai/mastra#123\n\n<work-item-feed>\n@alice: this blocks the release\n</work-item-feed>',
    }).toLLMMessage();
    expect((modelGenerationSkillSpan.input as { messages: unknown[] }).messages[1]).toEqual(message);
  });

  it('renders the skill markup as a skill row with its arguments, instructions and feed', () => {
    render(<SpanInputRenderer span={modelGenerationSkillSpan} />);

    const skill = screen.getByLabelText('Skill: factory-triage');
    expect(skill.textContent).toContain('factory-triage mastra-ai/mastra#123');
    expect(screen.getByText('Work item feed')).toBeTruthy();
    expect(document.body.textContent).toContain('Read the issue and label it.');
    expect(document.body.textContent).not.toContain('<skill');
    expect(document.body.textContent).not.toContain('ARGUMENTS:');
    expect(document.querySelector('[data-role="skill"]')).not.toBeNull();
  });

  it('leaves ordinary user messages as user bubbles', () => {
    render(<SpanInputRenderer span={modelGenerationSpan} />);

    expect(screen.queryByLabelText(/^Skill:/)).toBeNull();
    expect(document.querySelector('[data-role="user"]')).not.toBeNull();
  });
});

/** A signal as memory stores it, after the span serializer turned its dates into strings. */
const storedSignal = (...args: Parameters<typeof createSignal>) =>
  JSON.parse(JSON.stringify(createSignal(...args).toDBMessage({ threadId: 'thread-1', resourceId: 'agent-1' })));

describe('Signal messages a span recorded as memory stores them', () => {
  const processorSpan = makeSpan({
    spanId: 'span-processor-signal-messages',
    name: 'input processor: memory-input-filter',
    spanType: SpanType.PROCESSOR_RUN,
    entityType: 'input_processor',
    attributes: { processorPhase: 'input', processorExecutor: 'workflow', processorIndex: 0 },
    input: {
      messages: [
        storedSignal({ id: 'signal-user-2', type: 'user', contents: 'all good?' }),
        storedSignal({ id: 'signal-reminder-2', type: 'reactive', contents: 'CI on main is red.' }),
      ],
    },
  });

  it('draws them like the agent run it started does, not as a "signal" role block', () => {
    render(<SpanInputRenderer span={processorSpan} />);

    const [user, reminder] = document.querySelectorAll('[data-slot="span-signal"]');
    expect(user?.getAttribute('data-signal-type')).toBe('user');
    expect(user?.querySelector('[data-role="user"]')?.textContent).toContain('all good?');
    expect(screen.getByRole('button', { name: 'Copy signal id signal-user-2' })).toBeTruthy();

    expect(reminder?.getAttribute('data-signal-type')).toBe('reactive');
    expect(reminder?.textContent).toContain('system-reminder');
    expect(reminder?.textContent).toContain('CI on main is red.');
    expect(document.querySelector('[data-role="signal"]')).toBeNull();
  });
});
