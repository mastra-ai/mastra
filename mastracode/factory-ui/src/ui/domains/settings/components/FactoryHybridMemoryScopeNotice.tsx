import { Notice } from '@mastra/playground-ui/components/Notice';

import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';

/**
 * A `hybrid` Factory keeps one memory-settings row for its work items and its chats,
 * but the two contexts resolve Auto from different credentials: work items use the
 * Factory's, a chat session its owner's. The models on this page are what work items
 * get, so say so rather than let "Auto" read as what the person's chat will run.
 */
export function FactoryHybridMemoryScopeNotice({ factoryId }: { factoryId: string | undefined }) {
  const projectQuery = useFactoryProjectQuery(factoryId);

  if (!factoryId || projectQuery.data?.modelScope !== 'hybrid') return null;

  return (
    <div role="note">
      <Notice variant="info" title="Work items and chats resolve Auto differently here">
        Work items in this Factory run on its organization credentials, and so do the chat threads started from one, so
        the models above are what they use. Your other chats in this Factory use your own credentials, and Auto there
        picks from those instead.
      </Notice>
    </div>
  );
}
