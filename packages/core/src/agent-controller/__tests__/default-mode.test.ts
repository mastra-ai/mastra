import { describe, expect, it } from 'vitest';
import { Agent } from '../../agent';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerMode } from '../types';

const plan: AgentControllerMode = { id: 'plan', name: 'Plan', defaultModelId: 'openai/gpt-5.5' };
const build: AgentControllerMode = {
  id: 'build',
  name: 'Build',
  defaultModelId: 'anthropic/claude-opus-4-7',
  metadata: { default: true },
};
const fast: AgentControllerMode = { id: 'fast', name: 'Fast', defaultModelId: 'openai/gpt-5.4-mini' };

describe('AgentController.getDefaultMode', () => {
  it.each([
    { selector: 'defaultModeId', modes: [plan, build, fast], defaultModeId: 'fast', expected: fast },
    { selector: 'metadata.default', modes: [plan, build, fast], defaultModeId: undefined, expected: build },
    { selector: 'the first mode', modes: [plan, fast], defaultModeId: undefined, expected: plan },
  ])('returns the mode new sessions start in when chosen by $selector', async ({ modes, defaultModeId, expected }) => {
    const agent = new Agent({
      id: 'default-mode',
      name: 'Default mode',
      instructions: 'Test',
      model: new MastraLanguageModelV2Mock({}),
    });
    const controller = new AgentController({
      id: 'default-mode',
      agent,
      storage: new InMemoryStore(),
      workspace: createMockWorkspace(),
      modes,
      defaultModeId,
    });
    await controller.init();
    const session = await controller.createSession({ createInitialThread: false });

    expect(controller.getDefaultMode()).toEqual(expected);
    expect(session.mode.resolve()).toEqual(expected);
  });
});
