import { useToolCall } from '../../context/tool-call-context';
import type { McpInputRequestPayload } from '../mcp-input-request';
import { McpInputRequestTool } from '../mcp-input-request-tool';
import { resumeErrorMessage, useResumeBackgroundTask } from './use-deferred-input-request';
import type { OpenInputRequest } from './use-deferred-input-request';

/** A call the run is parked on: answering resumes the run, like any other suspended tool. */
export function ForegroundMcpInputRequest({
  toolCallId,
  payload,
  readOnly,
}: {
  toolCallId: string;
  payload: McpInputRequestPayload;
  readOnly?: boolean;
}) {
  const { approveToolcall, isRunning, toolCallApprovals } = useToolCall();
  const answered = toolCallApprovals?.[toolCallId]?.status === 'approved';
  return (
    <McpInputRequestTool
      payload={payload}
      readOnly={readOnly}
      isSubmitting={isRunning || answered}
      onSubmit={resumeData => approveToolcall(toolCallId, resumeData)}
    />
  );
}

/**
 * A deferred call whose background task waits on the question. The agent's turn already ended, so
 * the answer goes to the task directly and the chat stays free for other messages meanwhile.
 */
export function DeferredMcpInputRequest({
  backgroundTaskId,
  request,
}: {
  backgroundTaskId: string;
  request: OpenInputRequest;
}) {
  const resume = useResumeBackgroundTask(backgroundTaskId);
  return (
    <McpInputRequestTool
      payload={request.payload}
      isSubmitting={resume.isPending}
      error={resume.error ? resumeErrorMessage(resume.error) : undefined}
      onSubmit={resumeData => resume.mutateAsync({ resumeData, suspendedAt: request.suspendedAt })}
    />
  );
}
