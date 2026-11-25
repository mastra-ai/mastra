import type { BrowserSessionProbe } from '@mastra/react/hooks/agents';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useActivatedSkills } from '@/domains/agents/context/activated-skills-context';
import {
  isBrowserTool,
  isBrowserToolError,
  useBrowserToolCallsSafe,
} from '@/domains/agents/context/browser-tool-calls-context';
import type { ToolPartFields } from '@/domains/chat/messages/renderers/tool-part';
import { isRecord } from '@/domains/chat/messages/signal-data';
import { isSettledState } from '@/domains/chat/tools/tool-card-kind';

export type ToolCallEffectsProps = ToolPartFields;

const PROBE_QUERY = { queryKey: ['browser-session-probe'] };

/**
 * What a live call does to the page besides drawing. Mounted per call, so a card folded away still does it.
 * A call read back from a record does nothing to the page: `MessageRow` does not mount it then.
 */
export function ToolCallEffects({ toolName, toolCallId, input, output, state }: ToolCallEffectsProps) {
  const browserCalls = useBrowserToolCallsSafe();
  const queryClient = useQueryClient();
  const { activateSkill } = useActivatedSkills();
  const isBrowser = isBrowserTool(toolName);
  const settled = isSettledState(state);
  const skillName = toolName === 'skill' && isRecord(input) && typeof input.name === 'string' ? input.name : '';

  useEffect(() => {
    if (!isBrowser || !browserCalls) return;
    browserCalls.registerToolCall({
      toolCallId,
      toolName,
      args: isRecord(input) ? input : {},
      result: output,
      status: output === undefined ? 'pending' : isBrowserToolError(output) ? 'error' : 'complete',
      timestamp: Date.now(),
    });
    // A browser call proves the thread has a session. `setQueriesData` notifies observers even
    // when nothing changes, so read first and only write the probes that must flip.
    const probes = queryClient.getQueriesData<BrowserSessionProbe>(PROBE_QUERY);
    if (!probes.some(([, probe]) => probe?.screencastAvailable && !probe.hasSession)) return;
    queryClient.setQueriesData<BrowserSessionProbe>(PROBE_QUERY, probe =>
      probe?.screencastAvailable && !probe.hasSession ? { ...probe, hasSession: true } : probe,
    );
  }, [isBrowser, browserCalls, queryClient, toolCallId, toolName, input, output]);

  useEffect(() => {
    if (!settled || skillName === '') return;
    activateSkill(skillName);
  }, [settled, skillName, activateSkill]);

  return null;
}
