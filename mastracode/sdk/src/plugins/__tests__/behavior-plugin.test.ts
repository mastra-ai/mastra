import { defineBehavior, InMemoryBehaviorRuntimeStore } from '@mastra/behaviors';
import { describe, expect, it } from 'vitest';

import { createMastraCodeBehaviorPlugin } from '../behavior-plugin.js';

const definition = defineBehavior({
  id: 'coding',
  version: '1',
  initialState: 'work',
  states: [{ id: 'work', transitions: [{ id: 'exit', target: 'exit', exit: true }] }],
});

describe('createMastraCodeBehaviorPlugin', () => {
  it('returns the shared behavior provider through the plugin signal contract', async () => {
    const plugin = createMastraCodeBehaviorPlugin({
      id: 'coding-behavior',
      definition,
      store: new InMemoryBehaviorRuntimeStore(),
    });
    expect(typeof plugin.signalProviders).toBe('function');
    const providers = await plugin.signalProviders!({
      cwd: '/tmp/project',
      scope: 'project',
      pluginDir: '/tmp/project/.mastracode/plugins/coding-behavior',
      config: {},
    });
    expect(providers).toHaveLength(1);
    expect(providers[0]?.id).toBe('behavior-coding');
    expect(Object.keys(providers[0]?.getTools?.() ?? {})).toEqual([
      'behavior_select',
      'behavior_intent',
      'behavior_transition',
      'behavior_exit',
    ]);
  });
});
