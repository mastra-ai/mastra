import type { PlanResume } from '@mastra/client-js';

import { isPlanReadablePath, usePlanFile } from '../../../../hooks/use-fs';
import {
  isEndedPrompt,
  useRespondAgentControllerSuspensionMutation,
} from '../../../../hooks/useAgentControllerRunMutations';
import { useThreadWorkspacePath } from '../../workspace-viewer/hooks/useThreadWorkspacePath';
import { parsePlanMarkdown, resolveInlinePlan } from '../components/submit-plan-source';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import type { TimelineEntry } from '../services/transcript';

function pendingSubmitPlan(entries: TimelineEntry[]) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.kind === 'suspension' && entry.toolName === 'submit_plan') return entry;
  }
  return undefined;
}

export function usePendingPlanFeedback() {
  const { sessionId, sessionEnabled, baseUrl } = useChatSessionContext();
  const { transcript, resolvePrompt } = useChatTranscript();
  const prompt = pendingSubmitPlan(transcript.entries);
  const inline = resolveInlinePlan(prompt?.suspendPayload, undefined);
  const workspace = useThreadWorkspacePath();
  const fetchable = inline.plan === undefined && isPlanReadablePath(inline.path);
  const file = usePlanFile(workspace.workspacePath, inline.path, prompt?.toolCallId, {
    enabled: Boolean(prompt) && fetchable,
  });
  const fetched = fetchable && file.data?.content !== undefined ? parsePlanMarkdown(file.data.content) : undefined;
  const loading =
    Boolean(prompt) &&
    fetchable &&
    !fetched &&
    !file.isError &&
    (workspace.isPending || (Boolean(workspace.workspacePath) && file.isPending));
  const respondMutation = useRespondAgentControllerSuspensionMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId,
    baseUrl,
    enabled: sessionEnabled,
  });

  const submitFeedback = async (feedback: string) => {
    if (!prompt || !feedback.trim()) return;
    const title = inline.title ?? fetched?.title;
    const plan = inline.plan ?? fetched?.plan;
    const resumeData: PlanResume = {
      action: 'rejected',
      feedback: feedback.trim(),
      ...(inline.path ? { path: inline.path } : {}),
      ...(title ? { title } : {}),
      ...(plan ? { plan } : {}),
    };
    try {
      await respondMutation.mutateAsync({ toolCallId: prompt.toolCallId, resumeData, quietWhenEnded: true });
    } catch (error) {
      // Nothing will ever answer a prompt whose run has ended, so drop its card.
      // The caller decides what to do with the text instead.
      if (isEndedPrompt(error)) resolvePrompt(prompt.id);
      throw error;
    }
    resolvePrompt(prompt.id);
  };

  return {
    pending: Boolean(prompt),
    loading,
    isSubmitting: respondMutation.isPending,
    submitFeedback,
  };
}
