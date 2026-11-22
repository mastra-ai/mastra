---
'@mastra/playground-ui': minor
---

Added the prompt-block list and edit components (`PromptsList`, `PromptBlockEditMain`, `PromptBlockEditSidebar`, `usePromptBlockEditForm`, version combobox, delete action) under `@mastra/playground-ui/domains/prompt-blocks`, so other apps can host a Prompts library page.

The components read and write prompt blocks through the `@mastra/react` hooks, so render them inside `MastraReactProvider` and a React Query `QueryClientProvider`:

```tsx
import { usePromptBlockVersions, useStoredPromptBlock, useStoredPromptBlocks } from '@mastra/react/hooks/prompt-blocks';
import { PromptsList, PromptBlockEditContent } from '@mastra/playground-ui/domains/prompt-blocks';

function PromptsPage() {
  const { data, isLoading } = useStoredPromptBlocks({ page: 0, perPage: 20 });
  return <PromptsList promptBlocks={data?.promptBlocks ?? []} isLoading={isLoading} />;
}

function PromptEditPage({ blockId }: { blockId: string }) {
  const { data: block } = useStoredPromptBlock({ blockId, status: 'draft' });
  const { data: versions } = usePromptBlockVersions({ blockId });
  const latestVersionId = versions?.versions?.[0]?.id;
  if (!block) return null;
  return (
    <PromptBlockEditContent
      block={block}
      blockId={blockId}
      selectedVersionId={null}
      hasDraft={Boolean(latestVersionId && latestVersionId !== block.activeVersionId)}
      latestVersionId={latestVersionId}
      activeVersionId={block.activeVersionId}
      onClearVersion={() => {}}
    />
  );
}
```
