export function getCanSendWhileStreaming({
  isSupportedModel,
  threadSignalsEnabled,
  threadId,
  threadSignalsUnsupported,
}: {
  isSupportedModel: boolean;
  threadSignalsEnabled: boolean;
  threadId?: string;
  threadSignalsUnsupported: boolean;
}) {
  return isSupportedModel && threadSignalsEnabled && Boolean(threadId) && !threadSignalsUnsupported;
}
