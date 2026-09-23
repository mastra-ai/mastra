import { Button } from '@mastra/playground-ui/components/Button';

import { useChatRunning, useChatSend } from '@mastra/playground-ui/domains/chat/context/chat-context';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

interface SuggestedPromptListProps {
  prompts: string[];
}

const STAGGER_BASE_MS = 240;
const STAGGER_STEP_MS = 60;

/** Renders agent-configured prompts as chat actions that respect send permissions. */
export const SuggestedPromptList = ({ prompts }: SuggestedPromptListProps) => {
  const send = useChatSend();
  const { isRunning, canSendWhileStreaming } = useChatRunning();
  const { canExecute } = usePermissions();

  if (prompts.length === 0) return null;

  const sendBlocked = isRunning && !canSendWhileStreaming;
  const isDisabled = sendBlocked || !canExecute('agents');

  return (
    <ul className="flex w-full flex-col gap-1 px-3" data-testid="suggested-prompt-list">
      {prompts.map((prompt, index) => (
        <li
          key={prompt}
          className="starter-chip"
          style={{ animationDelay: `${STAGGER_BASE_MS + index * STAGGER_STEP_MS}ms` }}
        >
          <Button
            variant="ghost"
            className="h-auto w-full justify-start py-2 text-left whitespace-normal"
            disabled={isDisabled}
            onClick={() => send({ message: prompt })}
          >
            {prompt}
          </Button>
        </li>
      ))}
    </ul>
  );
};
