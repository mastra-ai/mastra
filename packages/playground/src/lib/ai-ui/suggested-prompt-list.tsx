import { Button } from '@mastra/playground-ui/components/Button';

import { useChatRunning, useChatSend } from './chat/chat-context';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

interface SuggestedPromptListProps {
  prompts: string[];
}

/** Renders agent-configured prompts as chat actions that respect send permissions. */
export const SuggestedPromptList = ({ prompts }: SuggestedPromptListProps) => {
  const send = useChatSend();
  const { isRunning, canSendWhileStreaming } = useChatRunning();
  const { canExecute } = usePermissions();

  if (prompts.length === 0) return null;

  const sendBlocked = isRunning && !canSendWhileStreaming;
  const isDisabled = sendBlocked || !canExecute('agents');

  return (
    <div className="mt-6 flex max-w-full flex-row gap-2 overflow-x-auto px-4">
      {prompts.map(prompt => (
        <Button
          key={prompt}
          type="button"
          variant="outline"
          size="sm"
          disabled={isDisabled}
          onClick={() => send({ message: prompt })}
        >
          {prompt}
        </Button>
      ))}
    </div>
  );
};
