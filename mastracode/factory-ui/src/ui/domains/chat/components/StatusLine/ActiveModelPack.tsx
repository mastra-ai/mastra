import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { useState } from 'react';

import { useActivateModelPack, useModelPacksQuery } from '../../../../../hooks/use-model-packs';
import { useChatConnection } from '../../context/useChatConnection';
import { useChatSessionContext } from '../../context/useChatSessionContext';

export function ActiveModelPack() {
  const { resourceId, projectPath, draftSessionId, kind } = useChatSessionContext();
  const { status } = useChatConnection();
  const packsQuery = useModelPacksQuery(resourceId, projectPath);
  const activateMutation = useActivateModelPack(resourceId, projectPath);
  const [pendingPackId, setPendingPackId] = useState<string>();

  const selectedPackId = pendingPackId ?? packsQuery.data?.sessionPackId ?? undefined;
  const selectedPack = packsQuery.data?.packs.find(pack => pack.id === selectedPackId);

  if (kind !== 'user' || draftSessionId || status !== 'ready' || !packsQuery.data?.packs.length) return null;

  return (
    <Select
      value={selectedPackId}
      disabled={Boolean(pendingPackId)}
      onValueChange={packId => {
        if (pendingPackId || packId === packsQuery.data.sessionPackId) return;
        setPendingPackId(packId);
        void activateMutation.mutateAsync({ id: packId, target: 'session' }).then(
          () => {
            setPendingPackId(undefined);
          },
          (cause: unknown) => {
            setPendingPackId(undefined);
            toast.error(cause instanceof Error ? cause.message : 'Failed to apply model pack');
          },
        );
      }}
    >
      <SelectTrigger
        variant="ghost"
        size="xs"
        aria-label="Thread model pack"
        aria-busy={Boolean(pendingPackId)}
        className="text-neutral3 w-auto"
        title={selectedPack?.name}
      >
        <span>Pack · {selectedPack?.name ?? 'Choose'}</span>
      </SelectTrigger>
      <SelectContent>
        {packsQuery.data.packs.map(pack => (
          <SelectItem key={pack.id} value={pack.id}>
            {pack.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
