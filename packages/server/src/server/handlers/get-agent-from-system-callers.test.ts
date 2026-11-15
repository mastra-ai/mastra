import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `getAgentFromSystem` only enforces stored-agent visibility when it's given the caller's `requestContext`; without it
 * there is no caller to check, so a private stored agent resolves for anyone. Every server handler must pass it.
 */
describe('getAgentFromSystem callers', () => {
  it('pass requestContext in every server handler', () => {
    const dir = __dirname;
    const missing: string[] = [];
    let calls = 0;

    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const source = readFileSync(join(dir, file), 'utf8');
      const pattern = /getAgentFromSystem\(\{/g;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source))) {
        // Skip the definition itself.
        if (source.slice(Math.max(0, match.index - 'function '.length), match.index) === 'function ') continue;
        let depth = 0;
        let end = match.index + 'getAgentFromSystem('.length;
        for (; end < source.length; end++) {
          if (source[end] === '{') depth++;
          else if (source[end] === '}' && --depth === 0) break;
        }
        calls++;
        const args = source.slice(match.index, end + 1);
        if (!/\brequestContext\b/.test(args)) {
          missing.push(`${file}:${source.slice(0, match.index).split('\n').length}`);
        }
      }
    }

    expect(calls).toBeGreaterThan(30);
    expect(missing).toEqual([]);
  });

  /**
   * Looking an agent up directly skips the stored-agent visibility check: hydrated stored agents are registered on
   * Mastra, so `mastra.getAgentById` returns them too. Handlers should resolve agents through `getAgentFromSystem`.
   * Each remaining direct lookup is listed here with why it's safe; a new one fails until it's reviewed.
   */
  it('only look agents up directly where the stored-agent check is applied', () => {
    const allowed: Record<string, { count: number; reason: string }> = {
      'agents.ts': { count: 3, reason: 'getAgentFromSystem itself (checked) + GET /agents (author-filtered first)' },
      'memory.ts': { count: 4, reason: 'memory resolvers call assertStoredAgentAccess on the resolved agent' },
      'schedules.ts': {
        count: 2,
        reason:
          "assertStoredAgentAccess before scheduling, and in canAccessScheduleAgent for existing schedules' agents",
      },
      'scores.ts': { count: 1, reason: 'scorer listing is author-filtered before hydration' },
      'stored-agents.ts': {
        count: 1,
        reason:
          'DELETE only reads the registered agent to tell a code agent override apart; nothing is returned or run',
      },
      'workspace.ts': {
        count: 1,
        reason: "isAgentWorkspaceVisible applies assertStoredAgentAccess to the workspace's agent",
      },
      'channels.ts': { count: 1, reason: 'stored agents are write-checked against storage first; code agents only' },
      'agent-versions.ts': {
        count: 1,
        reason: 'code-agent existence check only; stored records go through assertVersionAccess (read/write)',
      },
    };
    const found: Record<string, number> = {};

    for (const file of readdirSync(__dirname)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const source = readFileSync(join(__dirname, file), 'utf8');
      const count = (source.match(/\.getAgentById\(|\bagent\??\.getById\(/g) ?? []).length;
      if (count) found[file] = count;
    }

    expect(found).toEqual(Object.fromEntries(Object.entries(allowed).map(([file, { count }]) => [file, count])));
  });

  /**
   * Every route that takes an `:agentId` must resolve it through a visibility-checked path, so a new agent route (e.g.
   * a run-control route) can't hand a private stored agent to another user. Routes that check access another way are
   * listed with why; a new one fails until it's reviewed.
   */
  it('resolve the agent of every :agentId route through a visibility-checked path', () => {
    const checked =
      /getAgentFromSystem\(|handleAgentMessageRoute\(|getAgentForModelListMutation\(|handler: \w+\.handler/;
    const allowed: Record<string, string> = {
      'a2a.ts /.well-known/:agentId/agent-card.json': 'getAgentCardByIdHandler calls getAgentFromSystem (read)',
      'a2a.ts /a2a/:agentId': 'getAgentExecutionHandler calls getAgentFromSystem (execute)',
      'agent-versions.ts /stored/agents/:agentId/versions': 'assertVersionAccess (read/write) on the stored record',
      'agent-versions.ts /stored/agents/:agentId/versions/:versionId': 'assertVersionAccess',
      'agent-versions.ts /stored/agents/:agentId/versions/:versionId/activate': 'assertVersionAccess',
      'agent-versions.ts /stored/agents/:agentId/versions/:versionId/restore': 'assertVersionAccess',
      'agent-versions.ts /stored/agents/:agentId/versions/compare': 'assertVersionAccess',
      'agents.ts /agents/:agentId/streamVNext': 'deprecated: always throws, never resolves the agent',
      'agents.ts /agents/:agentId/stream/vnext/ui': 'deprecated: always throws, never resolves the agent',
      'channels.ts /channels/:platform/:agentId/reconcile': 'assertChannelAgentWriteAccess on the stored record',
      'channels.ts /channels/:platform/:agentId/disconnect': 'assertChannelAgentWriteAccess on the stored record',
    };
    const unchecked = new Set<string>();

    for (const file of readdirSync(__dirname)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const source = readFileSync(join(__dirname, file), 'utf8');
      for (const route of source.split('createRoute(').slice(1)) {
        const body = route.split('\nexport ')[0]!;
        const path = /path: '([^']*:agentId[^']*)'/.exec(body)?.[1];
        if (path && !checked.test(body)) unchecked.add(`${file} ${path}`);
      }
    }

    expect([...unchecked].sort()).toEqual(Object.keys(allowed).sort());
  });
});
