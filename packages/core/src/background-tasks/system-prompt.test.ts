import { describe, expect, it } from 'vitest';
import { generateBackgroundTaskSystemPrompt } from './system-prompt';
import type { AgentBackgroundConfig, ToolBackgroundConfig } from './types';

function tools(entries: Record<string, ToolBackgroundConfig | undefined>) {
  return Object.fromEntries(
    Object.entries(entries).map(([name, backgroundConfig]) => [name, { backgroundConfig, description: name }]),
  );
}

/** Tool names as they appear in the prompt's `- <name> (default: ...)` lines. */
function listed(prompt: string | undefined): string[] {
  if (!prompt) return [];
  return [...prompt.matchAll(/^- (\S+) \(default: (\w+)\)$/gm)].map(m => `${m[1]}:${m[2]}`);
}

describe('generateBackgroundTaskSystemPrompt', () => {
  it('lists only tools that can actually reach the background', () => {
    const prompt = generateBackgroundTaskSystemPrompt(
      tools({ readFile: undefined, editFile: undefined, research: undefined }),
      { tools: { research: { enabled: true } } },
    );

    // `_background` is a modifier on a prior opt-in, never a standalone one, so
    // announcing the other two would advertise a field the resolver ignores.
    expect(listed(prompt)).toEqual(['research:background']);
  });

  it('returns undefined when no tool is opted in', () => {
    // The doc comment has always promised this; the loop used to push every
    // tool unconditionally, so it could only trigger on an empty tools map.
    expect(generateBackgroundTaskSystemPrompt(tools({ readFile: undefined, editFile: undefined }))).toBeUndefined();
  });

  it('strips the agent- prefix before the agent-level lookup', () => {
    // Sub-agent tools register as `agent-<name>` while the whitelist is keyed by
    // the bare registered name. Without normalization the lookup misses and the
    // one tool that *is* opted in gets reported as foreground.
    const prompt = generateBackgroundTaskSystemPrompt(tools({ 'agent-biExecutor': undefined }), {
      tools: { biExecutor: { enabled: true, timeoutMs: 900_000 } },
    });

    expect(listed(prompt)).toEqual(['agent-biExecutor:background']);
  });

  it('strips the workflow- prefix before the agent-level lookup', () => {
    const prompt = generateBackgroundTaskSystemPrompt(tools({ 'workflow-nightlyReport': undefined }), {
      tools: { nightlyReport: true },
    });

    expect(listed(prompt)).toEqual(['workflow-nightlyReport:background']);
  });

  it('honors a tool-level opt-in when the agent config says nothing about it', () => {
    // "not configured at the agent level" must stay distinct from "configured
    // off": only the former falls through to the tool's own config.
    const prompt = generateBackgroundTaskSystemPrompt(tools({ research: { enabled: true } }), {
      tools: { somethingElse: true },
    });

    expect(listed(prompt)).toEqual(['research:background']);
  });

  it('lets an explicit agent-level false override a tool-level opt-in', () => {
    const prompt = generateBackgroundTaskSystemPrompt(tools({ research: { enabled: true } }), {
      tools: { research: false },
    });

    expect(prompt).toBeUndefined();
  });

  it('lists every tool when the agent opts in with "all"', () => {
    const prompt = generateBackgroundTaskSystemPrompt(tools({ readFile: undefined, research: undefined }), {
      tools: 'all',
    });

    expect(listed(prompt)).toEqual(['readFile:background', 'research:background']);
  });

  it('returns undefined when the agent has background dispatch disabled', () => {
    const agentConfig: AgentBackgroundConfig = { disabled: true, tools: { research: { enabled: true } } };

    expect(generateBackgroundTaskSystemPrompt(tools({ research: { enabled: true } }), agentConfig)).toBeUndefined();
  });

  it('still explains the _background field itself', () => {
    const prompt = generateBackgroundTaskSystemPrompt(tools({ research: { enabled: true } }));

    expect(prompt).toContain('_background');
    expect(prompt).toContain('"enabled": true/false');
  });
});
