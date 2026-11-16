import { useState } from 'react';
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
  isNetwork,
}: {
  toolCallId: string;
  payload: McpInputRequestPayload;
  readOnly?: boolean;
  /** A network run resumes through its own route, which can't carry these answers yet. */
  isNetwork?: boolean;
}) {
  const { approveToolcall, isRunning } = useToolCall();
  // Not `toolCallApprovals`: it keeps the call approved after the first answer, which would lock the
  // form when the same call suspends again. This state starts over with each suspension's key.
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <McpInputRequestTool
      payload={payload}
      readOnly={readOnly || isNetwork}
      notice={isNetwork ? "Studio can't answer this request in a network run yet." : undefined}
      isSubmitting={isRunning || sent}
      error={error}
      onSubmit={async resumeData => {
        setSent(true);
        setError(undefined);
        try {
          await approveToolcall(toolCallId, resumeData);
        } catch (failure) {
          setSent(false);
          setError(failure instanceof Error && failure.message ? failure.message : "Couldn't send the answer.");
          throw failure;
        }
      }}
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
