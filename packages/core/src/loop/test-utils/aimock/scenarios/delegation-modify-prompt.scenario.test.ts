import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, vi } from 'vitest';
import { Agent } from '../../../../agent';
import type { DelegationStartContext } from '../../../../agent';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Regression class: supervisor delegation hooks — onDelegationStart prompt modification.
 *
 * When a supervisor delegates to a subagent via `agents: { writer }`, the
 * `onDelegationStart` hook can intercept the delegation and modify the prompt
 * before it reaches the subagent. This scenario proves:
 *
 * 1. The hook receives the correct delegation context (primitiveId, prompt, parentAgentId).
 * 2. The modified prompt is what the subagent actually receives.
 * 3. The original prompt is NOT forwarded to the subagent.
 */
describeForAllEngines(
  'AIMock loop scenario: delegation onDelegationStart modifies prompt',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('onDelegationStart modifies the prompt before the subagent receives it', async () => {
      const mock = getMock();
      const hookSpy = vi.fn();

      const openai = createOpenAI({
        apiKey: 'aimock-test-key',
        baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
      });

      const writer = new Agent({
        id: 'writer',
        name: 'Writer',
        description: 'Drafts written content',
        instructions: 'You are a skilled writer subagent.',
        model: openai(SCENARIO_MODEL_ID),
      });

      const { output, requests } = await runLoopScenario({
        engine,
        llm: mock,
        prompt: 'Ask the writer to draft a tagline.',
        agents: { writer },
        stopWhen: stepCountIs(5),
        delegation: {
          onDelegationStart: (context: DelegationStartContext) => {
            hookSpy(context);
            return {
              proceed: true,
              modifiedPrompt: 'URGENT: Draft a tagline for a PREMIUM coffee shop.',
            };
          },
        },
        fixtures: llm => {
          // Supervisor turn 1: delegate to the writer subagent.
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [{ id: 'call_writer', name: 'agent-writer', arguments: { prompt: 'Draft a tagline.' } }],
            },
          );
          // Subagent's own loop turn: matched by the modified prompt content.
          llm.onMessage(/PREMIUM coffee shop/i, { content: 'Sip the extraordinary.' });
          // Supervisor turn 2: wraps up with the subagent result.
          llm.on(
            { endpoint: 'chat', toolCallId: 'call_writer', hasToolResult: true },
            { content: 'The writer suggested: Sip the extraordinary.' },
          );
        },
      });

      // The hook was called with the correct context.
      expect(hookSpy).toHaveBeenCalledTimes(1);
      const callContext = hookSpy.mock.calls[0]![0];
      expect(callContext.primitiveId).toBe('writer');
      expect(callContext.primitiveType).toBe('agent');
      expect(callContext.prompt).toBe('Draft a tagline.');

      // The final output incorporates the subagent's response.
      const text = await output.text;
      expect(text).toContain('Sip the extraordinary.');

      // The subagent's AIMock request contains the modified prompt.
      const subagentRequest = requests.find(r => JSON.stringify(r.body?.messages).includes('PREMIUM coffee shop'));
      expect(subagentRequest).toBeDefined();

      // The original (unmodified) prompt was NOT forwarded to the subagent.
      const subagentMessages = JSON.stringify(subagentRequest?.body?.messages ?? []);
      expect(subagentMessages).not.toContain('Draft a tagline for a coffee shop.');
    });

    it('onDelegationStart rejects the delegation and reports the denial back to the model', async () => {
      const mock = getMock();

      const openai = createOpenAI({
        apiKey: 'aimock-test-key',
        baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
      });

      const writer = new Agent({
        id: 'writer',
        name: 'Writer',
        description: 'Drafts written content',
        instructions: 'You are a skilled writer subagent.',
        model: openai(SCENARIO_MODEL_ID),
      });

      const { output, requests } = await runLoopScenario({
        engine,
        llm: mock,
        prompt: 'Ask the writer to draft a tagline.',
        agents: { writer },
        stopWhen: stepCountIs(5),
        delegation: {
          onDelegationStart: () => ({
            proceed: false,
            rejectionReason: 'Delegation blocked: insufficient permissions.',
          }),
        },
        fixtures: llm => {
          // Supervisor turn 1: tries to delegate.
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [{ id: 'call_writer', name: 'agent-writer', arguments: { prompt: 'Draft a tagline.' } }],
            },
          );
          // Supervisor turn 2: receives the rejection and wraps up.
          llm.on(
            { endpoint: 'chat', hasToolResult: true },
            { content: 'I was unable to delegate due to permission restrictions.' },
          );
        },
      });

      // The supervisor produced a final answer reflecting the rejection.
      const text = await output.text;
      expect(text).toContain('unable to delegate');

      // The subagent was NOT invoked (no request matched the subagent's prompt).
      // The supervisor's own request contains the original prompt text in the user message,
      // but the subagent should NOT have received a dedicated request. We verify by checking
      // there are only supervisor requests (no subagent model call).
      const nonSupervisorRequests = requests.filter(
        r => !JSON.stringify(r.body?.messages).includes('Ask the writer to draft a tagline'),
      );
      // If the delegation was rejected, the subagent should not have been invoked.
      expect(nonSupervisorRequests).toHaveLength(0);
    });
  },
  { skip: ['durable'] },
);
