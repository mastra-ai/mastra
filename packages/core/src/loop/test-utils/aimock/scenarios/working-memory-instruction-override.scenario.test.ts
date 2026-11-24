import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import type { MemoryConfig } from '../../../../memory/types';
import type { WorkingMemoryInstructionArgs } from '../../../../processors/memory';
import { InMemoryStore } from '../../../../storage';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import type { LoopScenarioResult } from '../types';

// Technical: the `WorkingMemory` input processor kept a private copy of the instruction text, so a memory
// implementation that customized it (a `Memory` subclass overriding its instruction methods) changed
// `memory.getSystemMessage()` but never what the model received. The processor now asks the memory instance
// through `getWorkingMemoryInstruction()`. Every engine builds its processors from
// `MastraMemory.getInputProcessors`, so this runs on all of them. The `Memory`-specific mapping from its
// protected instruction methods to this hook is covered in @mastra/memory's
// working-memory-instruction-override test. (#29752)

const RESOURCE = 'wm-override-user';
const STORED = '# Profile\n- Name: Ada';
const TEMPLATE = '# Profile\n- Name:\n- Timezone:';
const BUILT_IN_HEADER = 'WORKING_MEMORY_SYSTEM_INSTRUCTION';

/** A team's memory that tells the agent to keep only durable facts, and records what it was asked to render. */
class DurableFactsMemory extends MockMemory {
  readonly seen: WorkingMemoryInstructionArgs[] = [];

  constructor(
    options: MemoryConfig,
    private readonly render: (args: WorkingMemoryInstructionArgs) => string | undefined = args =>
      `CUSTOM_WM (${args.kind}, ${args.template.format}${args.kind === 'read-only' ? `, autoUpdated: ${String(args.autoUpdated)}` : ''}): only store durable user facts.\n${args.data ?? 'empty'}`,
  ) {
    super({ storage: new InMemoryStore(), options: { lastMessages: 10, ...options } });
  }

  override getWorkingMemoryInstruction(args: WorkingMemoryInstructionArgs): string | undefined {
    this.seen.push(args);
    return this.render(args);
  }
}

const markdown = { enabled: true, template: TEMPLATE } as const;

function systemPromptSentToModel(requests: LoopScenarioResult['requests']): string {
  expect(requests.length).toBeGreaterThan(0);
  return requests[0]!.body.messages
    .filter(message => message.role === 'system')
    .map(message => (typeof message.content === 'string' ? message.content : JSON.stringify(message.content)))
    .join('\n');
}

describeForAllEngines('AIMock loop scenario: memory overrides the working memory instruction (#29752)', engine => {
  const getMock = useLoopScenarioAimock();

  async function runWithMemory(memory: DurableFactsMemory, threadId: string) {
    await memory.createThread({ threadId, resourceId: RESOURCE });
    await memory.updateWorkingMemory({ threadId, resourceId: RESOURCE, workingMemory: STORED });
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'I am searching Drive for the Q3 report',
      memory,
      threadId,
      resourceId: RESOURCE,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'ok' });
      },
    });
    expect(await output.text).toBe('ok');
    return systemPromptSentToModel(requests);
  }

  describe.each([
    { mode: 'tool', options: { workingMemory: markdown }, marker: 'CUSTOM_WM (tool, markdown)' },
    {
      mode: 'vnext',
      options: { workingMemory: { ...markdown, version: 'vnext' } },
      marker: 'CUSTOM_WM (vnext, markdown)',
    },
    {
      mode: 'read-only',
      options: { workingMemory: markdown, readOnly: true },
      marker: 'CUSTOM_WM (read-only, markdown, autoUpdated: false)',
    },
    {
      mode: 'app-managed',
      options: { workingMemory: { ...markdown, agentManaged: false } },
      marker: 'CUSTOM_WM (read-only, markdown, autoUpdated: true)',
    },
  ] satisfies Array<{ mode: string; options: MemoryConfig; marker: string }>)(
    '$mode working memory',
    ({ mode, options, marker }) => {
      it('the model receives the memory instance instruction, with the stored working memory', async () => {
        const memory = new DurableFactsMemory(options);

        const system = await runWithMemory(memory, `thread-${engine}-${mode}`);

        expect(system).toContain(marker);
        expect(system).toContain(STORED);
        expect(system.match(/CUSTOM_WM/g)).toHaveLength(1);
        expect(system).not.toContain(BUILT_IN_HEADER);
        expect(memory.seen).toContainEqual(
          expect.objectContaining({ template: { format: 'markdown', content: TEMPLATE }, data: STORED }),
        );
      });
    },
  );

  it('an instruction of undefined keeps the built-in text', async () => {
    const memory = new DurableFactsMemory({ workingMemory: markdown }, () => undefined);

    const system = await runWithMemory(memory, `thread-${engine}-undefined`);

    expect(system.match(new RegExp(BUILT_IN_HEADER, 'g'))).toHaveLength(1);
    expect(system).toContain(STORED);
    expect(memory.seen).toHaveLength(1);
  });

  it('an empty instruction sends no working memory to the model', async () => {
    const memory = new DurableFactsMemory({ workingMemory: markdown }, () => '');

    const system = await runWithMemory(memory, `thread-${engine}-empty`);

    expect(system).toContain('You are a test agent driven by scripted AIMock responses.');
    expect(system).not.toContain(BUILT_IN_HEADER);
    expect(system).not.toContain('- Name: Ada');
    expect(memory.seen).toHaveLength(1);
  });
});
