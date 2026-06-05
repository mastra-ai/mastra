import type { Agent } from '@mastra/core/agent';
import { describe, it, expect, vi } from 'vitest';

import { resolveSkills } from './skills';

function makeAgent(ids: string[]) {
  const generate = vi.fn().mockResolvedValue({ object: { ids } });
  return { agent: { generate } as unknown as Agent, generate };
}

describe('resolveSkills', () => {
  it('maps each agent-selected id to true', async () => {
    const { agent } = makeAgent(['skill_a', 'skill_b']);
    await expect(
      resolveSkills(agent, [
        { id: 'skill_a', name: 'A' },
        { id: 'skill_b', name: 'B' },
      ]),
    ).resolves.toEqual({ skill_a: true, skill_b: true });
  });

  it('only includes the subset the agent selects', async () => {
    const { agent } = makeAgent(['skill_a']);
    await expect(
      resolveSkills(agent, [
        { id: 'skill_a', name: 'A' },
        { id: 'skill_b', name: 'B' },
      ]),
    ).resolves.toEqual({ skill_a: true });
  });

  it('returns an empty record and skips the agent for no entries', async () => {
    const { agent, generate } = makeAgent([]);
    await expect(resolveSkills(agent, [])).resolves.toEqual({});
    expect(generate).not.toHaveBeenCalled();
  });

  it('skips entries with an empty id before asking the agent', async () => {
    const { agent, generate } = makeAgent([]);
    await expect(resolveSkills(agent, [{ id: '', name: 'Empty' }])).resolves.toEqual({});
    expect(generate).not.toHaveBeenCalled();
  });

  it('ignores agent-selected ids that were not candidates', async () => {
    const { agent } = makeAgent(['skill_a', 'skill_x']);
    await expect(resolveSkills(agent, [{ id: 'skill_a', name: 'A' }])).resolves.toEqual({ skill_a: true });
  });
});
