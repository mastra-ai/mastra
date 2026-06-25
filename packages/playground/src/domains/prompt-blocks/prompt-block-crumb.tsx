import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useParams } from 'react-router';
import { useStoredPromptBlock } from './hooks/use-stored-prompt-blocks';

export function PromptBlockCrumb() {
  const { promptBlockId } = useParams<{ promptBlockId: string }>();
  const { data: promptBlock, isLoading } = useStoredPromptBlock(promptBlockId, { status: 'draft' });

  if (!promptBlockId) return null;
  if (isLoading) return <Skeleton className="h-5 w-36" />;

  return promptBlock?.name ?? 'Prompt block not found';
}
