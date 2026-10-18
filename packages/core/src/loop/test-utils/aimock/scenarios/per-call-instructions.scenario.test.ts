import type { JournalEntry } from '@copilotkit/aimock';
import { it, expect } from 'vitest';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Concept: per-call prompt options.
 *
 * `stream(prompt, { instructions })` replaces the agent's instructions for that
 * call only; `stream(prompt, { system })` adds a system message on top of them.
 * Both must reach the outgoing model request on every engine.
 */
describeForAllEngines('AIMock loop scenario: per-call instructions and system', engine => {
  const getMock = useLoopScenarioAimock();

  function systemPromptOf(request: JournalEntry): string {
    const messages = request.body?.messages ?? [];
    return JSON.stringify(messages.filter(message => (message as { role?: string }).role === 'system'));
  }

  it('uses per-call instructions in place of the agent default', async () => {
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello.',
      instructions: 'DEFAULT_INSTRUCTIONS',
      callInstructions: 'OVERRIDDEN_INSTRUCTIONS',
      fixtures: llm => llm.onMessage(/.*/, { content: 'Hi.' }),
    });

    expect(requests).toHaveLength(1);
    const systemPrompt = systemPromptOf(requests[0]!);
    expect(systemPrompt).toContain('OVERRIDDEN_INSTRUCTIONS');
    expect(systemPrompt).not.toContain('DEFAULT_INSTRUCTIONS');
  });

  it('appends a per-call system message to the agent instructions', async () => {
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello.',
      instructions: 'DEFAULT_INSTRUCTIONS',
      system: 'EXTRA_SYSTEM_NOTE',
      fixtures: llm => llm.onMessage(/.*/, { content: 'Hi.' }),
    });

    expect(requests).toHaveLength(1);
    const systemPrompt = systemPromptOf(requests[0]!);
    expect(systemPrompt).toContain('DEFAULT_INSTRUCTIONS');
    expect(systemPrompt).toContain('EXTRA_SYSTEM_NOTE');
  });
});
