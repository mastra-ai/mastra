import type { MastraUIMessage } from '../lib/ai-sdk';

export const resolveInitialMessagesSync = ({
  currentMessages,
  formattedMessages,
  threadChanged,
}: {
  currentMessages: MastraUIMessage[];
  formattedMessages: MastraUIMessage[];
  threadChanged: boolean;
}) => {
  if (!threadChanged && currentMessages.length > formattedMessages.length) {
    return currentMessages;
  }

  return formattedMessages;
};
