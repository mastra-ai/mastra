import { it, expect } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: working-memory instructions for app-managed memory (#28367).
 *
 * With `workingMemory.agentManaged: false` the agent has no update tool, but the app
 * updates working memory after each response. The system prompt the model receives must
 * say the memory updates automatically, not that it is read-only. Only `readOnly: true`
 * tells the model it cannot update working memory.
 */
describeForAllEngines('AIMock loop scenario: working memory agentManaged wording', engine => {
  const getMock = useLoopScenarioAimock();

  async function runWithMemory(options: ConstructorParameters<typeof MockMemory>[0]['options']) {
    const memory = new MockMemory({ enableWorkingMemory: true, options });
    const threadId = 'wm-agent-managed-thread';
    const resourceId = 'wm-agent-managed-resource';
    await memory.saveThread({
      thread: { id: threadId, title: 'WM', resourceId, metadata: {}, createdAt: new Date(), updatedAt: new Date() },
    });
    await memory.updateWorkingMemory({ threadId, resourceId, workingMemory: '# User\n- Location: WM_SOOKE' });

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'I moved to Victoria.',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Got it, Victoria.' });
      },
    });

    expect(requests).toHaveLength(1);
    const body = requests[0]?.body as { messages?: unknown[]; tools?: Array<{ function?: { name?: string } }> };
    return {
      prompt: JSON.stringify(body?.messages ?? []),
      toolNames: (body?.tools ?? []).map(tool => tool.function?.name),
    };
  }

  it('tells the model app-managed working memory updates automatically', async () => {
    const { prompt, toolNames } = await runWithMemory({ workingMemory: { enabled: true, agentManaged: false } });

    expect(prompt).toContain('WM_SOOKE');
    expect(prompt).toContain('WORKING_MEMORY_SYSTEM_INSTRUCTION (AUTO-UPDATED)');
    expect(prompt).toContain('This memory is updated automatically after each response');
    expect(prompt).not.toContain('read-only');
    expect(toolNames).not.toContain('updateWorkingMemory');
  });

  it('keeps read-only wording when readOnly is true', async () => {
    const { prompt, toolNames } = await runWithMemory({
      readOnly: true,
      workingMemory: { enabled: true, agentManaged: false },
    });

    expect(prompt).toContain('WM_SOOKE');
    expect(prompt).toContain('WORKING_MEMORY_SYSTEM_INSTRUCTION (READ-ONLY)');
    expect(prompt).toContain('read-only in the current session - you cannot update it');
    expect(prompt).not.toContain('updated automatically');
    expect(toolNames).not.toContain('updateWorkingMemory');
  });

  it('keeps tool instructions when the agent manages working memory', async () => {
    const { prompt, toolNames } = await runWithMemory({ workingMemory: { enabled: true } });

    expect(prompt).toContain('WM_SOOKE');
    expect(prompt).not.toContain('(READ-ONLY)');
    expect(prompt).not.toContain('(AUTO-UPDATED)');
    expect(toolNames).toContain('updateWorkingMemory');
  });
});
