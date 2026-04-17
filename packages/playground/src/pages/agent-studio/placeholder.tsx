import { EmptyState } from '@mastra/playground-ui';
import { SparklesIcon } from 'lucide-react';

type AgentStudioPlaceholderProps = {
  title: string;
  description?: string;
};

/**
 * Temporary placeholder used while the Agent Studio pages are being built out.
 * Replaced by real page content in a follow-up change.
 */
export function AgentStudioPlaceholder({ title, description }: AgentStudioPlaceholderProps) {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <EmptyState
        iconSlot={<SparklesIcon className="h-6 w-6" />}
        titleSlot={title}
        descriptionSlot={description ?? 'This Agent Studio surface is coming soon.'}
      />
    </div>
  );
}
