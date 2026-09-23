import { CrumbSkeleton } from '@mastra/playground-ui/components/Breadcrumb';
import { useParams } from 'react-router';
import { useStoredPromptBlock } from './hooks/use-stored-prompt-blocks';

export function PromptBlockCrumb() {
  const { promptBlockId } = useParams<{ promptBlockId: string }>();
  const { data: promptBlock, isLoading } = useStoredPromptBlock(promptBlockId, { status: 'draft' });

  if (!promptBlockId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return promptBlock?.name ?? 'Prompt block not found';
}
