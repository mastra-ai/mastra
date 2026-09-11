import type { ToolPartFields } from '@mastra/playground-ui/domains/chat/messages/renderers/tool-part';
import { isRecord } from '@mastra/playground-ui/domains/chat/messages/signal-data';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { isSettledState } from './tool-card-kind';
import { useActivatedSkills } from '@/domains/agents/context/activated-skills-context';
import {
  isBrowserTool,
  isBrowserToolError,
  useBrowserToolCallsSafe,
} from '@/domains/agents/context/browser-tool-calls-context';
import type { BrowserSessionProbe } from '@/domains/agents/hooks/use-browser-session-probe';

export interface ToolCallEffectsProps extends ToolPartFields {
  readOnly?: boolean;
}

const PROBE_QUERY = { queryKey: ['browser-session-probe'] };

/** What a call does to the page besides drawing. Mounted per call, so a card folded away still does it. */
export function ToolCallEffects({
  toolName,
  toolCallId,
  input,
  output,
  state,
  readOnly = false,
}: ToolCallEffectsProps) {
  const browserCalls = useBrowserToolCallsSafe();
  const queryClient = useQueryClient();
  const { activateSkill } = useActivatedSkills();
  const isBrowser = isBrowserTool(toolName);
  const settled = isSettledState(state);
  const skillName = toolName === 'skill' && isRecord(input) && typeof input.name === 'string' ? input.name : '';

  useEffect(() => {
    if (readOnly || !isBrowser || !browserCalls) return;
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
  }, [readOnly, isBrowser, browserCalls, queryClient, toolCallId, toolName, input, output]);

  useEffect(() => {
    if (readOnly || !settled || skillName === '') return;
    activateSkill(skillName);
  }, [readOnly, settled, skillName, activateSkill]);

  return null;
}
