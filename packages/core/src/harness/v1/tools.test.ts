import { describe, expect, it } from 'vitest';

import { buildSessionToolsets } from './tools';

const stub = (id: string) => ({ id, description: id, parameters: {} as never, execute: async () => null }) as never;

describe('buildSessionToolsets', () => {
  it('returns agent tools when no overrides are provided', () => {
    const a = stub('a');
    const b = stub('b');
    expect(buildSessionToolsets({ agentTools: { a, b } })).toEqual({ a, b });
  });

  it('mode.tools replaces agent tools entirely', () => {
    const a = stub('a');
    const x = stub('x');
    expect(buildSessionToolsets({ agentTools: { a }, modeOverrides: { tools: { x } } })).toEqual({ x });
  });

  it('mode.additionalTools merges on top of agent tools', () => {
    const a = stub('a');
    const b = stub('b');
    expect(buildSessionToolsets({ agentTools: { a }, modeOverrides: { additionalTools: { b } } })).toEqual({ a, b });
  });

  it('ignores additionalTools when tools (replacement) is set', () => {
    const a = stub('a');
    const x = stub('x');
    const y = stub('y');
    expect(
      buildSessionToolsets({ agentTools: { a }, modeOverrides: { tools: { x }, additionalTools: { y } } }),
    ).toEqual({ x });
  });

  it('appends built-in tools last so they cannot be shadowed', () => {
    const ask = stub('ask_user');
    const overridden = stub('mode-ask');
    const result = buildSessionToolsets({
      modeOverrides: { tools: { ask_user: overridden } },
      builtInTools: { ask_user: ask },
    });
    expect((result as Record<string, unknown>).ask_user).toBe(ask);
  });

  it('removes tools listed in disabledTools and permissionRules.deny', () => {
    const a = stub('a');
    const b = stub('b');
    const c = stub('c');
    const result = buildSessionToolsets({
      agentTools: { a, b, c },
      disabledTools: ['a'],
      permissionRules: { tools: { b: 'deny', c: 'allow' } },
    });
    expect(result).toEqual({ c });
  });

  it('caller-supplied built-ins override same-id built-ins (executing subagent over v1 stub)', () => {
    // HarnessCompat injects the legacy *executing* `subagent` tool over v1's
    // record-only stub by spreading it last into builtInTools (see
    // Session.#buildThreadStreamOptions). Proves the injected tool wins by id
    // so v1-dispatched runs run the real subagent rather than the stub.
    const v1Stub = stub('subagent');
    const executing = stub('subagent');
    const v1BuiltIns: Record<string, unknown> = { task_write: stub('task_write'), subagent: v1Stub };
    const additionalBuiltInTools: Record<string, unknown> = { subagent: executing };
    const result = buildSessionToolsets({
      builtInTools: { ...v1BuiltIns, ...additionalBuiltInTools } as never,
    });
    expect((result as Record<string, unknown>).subagent).toBe(executing);
  });
});
