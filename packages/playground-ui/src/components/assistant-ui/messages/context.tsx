import { createContext, useContext } from 'react';

const AssistantMessageContext = createContext<{
  requireToolApproval?: boolean;
}>({
  requireToolApproval: false,
});

export const AssistantMessageProvider = AssistantMessageContext.Provider;

export const useAssistantMessage = () => useContext(AssistantMessageContext);
