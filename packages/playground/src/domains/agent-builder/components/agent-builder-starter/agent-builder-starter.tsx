import { IconButton, Textarea } from '@mastra/playground-ui';
import { ArrowUpIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useState } from 'react';
import { useNavigate } from 'react-router';

export const AgentBuilderStarter = () => {
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const trimmed = message.trim();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (trimmed.length === 0) return;
    const id = nanoid();
    void navigate(`/agent-builder/agents/${id}/edit`, { state: { userMessage: trimmed } });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-ui-2xl font-medium text-text1">What do you want to build?</h1>
          <p className="text-ui-md text-text3">
            Describe the agent you want to create and we&apos;ll take it from there.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="relative">
          <Textarea
            testId="agent-builder-starter-input"
            size="lg"
            placeholder="Build an agent that…"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[160px] pr-14"
            autoFocus
          />
          <div className="absolute bottom-3 right-3">
            <IconButton
              type="submit"
              variant="primary"
              size="md"
              tooltip="Submit"
              disabled={trimmed.length === 0}
              data-testid="agent-builder-starter-submit"
            >
              <ArrowUpIcon />
            </IconButton>
          </div>
        </form>
      </div>
    </div>
  );
};
