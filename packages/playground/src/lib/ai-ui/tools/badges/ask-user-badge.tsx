import { AskUser } from '@mastra/playground-ui/components/ai/ask-user';
import type { AskUserAnswer, AskUserResult, AskUserPayload } from '@mastra/playground-ui/components/ai/ask-user';
import { useToolCall } from '@/services/tool-call-provider';

export interface AskUserBadgeProps {
  toolCallId: string;
  suspendPayload: AskUserPayload;
  result: AskUserResult | undefined;
}

export const AskUserBadge = ({ toolCallId, suspendPayload, result }: AskUserBadgeProps) => {
  const { approveToolcall, isRunning, toolCallApprovals } = useToolCall();
  const isAnswered = toolCallApprovals?.[toolCallId]?.status === 'approved';

  const submitAnswer = (answer: AskUserAnswer) => {
    approveToolcall(toolCallId, answer);
  };

  return (
    <AskUser
      data-testid="ask-user-badge"
      payload={suspendPayload}
      result={result}
      isAnswered={isAnswered}
      isSubmitting={isRunning}
      onSubmit={submitAnswer}
      className="mb-4 w-full max-w-full"
    />
  );
};
