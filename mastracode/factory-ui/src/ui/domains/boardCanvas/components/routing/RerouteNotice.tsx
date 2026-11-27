import { toast } from '@mastra/playground-ui/components/Toaster';
import { RerouteNotice as SharedRerouteNotice } from '@mastra/playground-ui/domains/factory';

import { useApplyReroute, useReroutePreview } from '../../../../../hooks/useIntakeRoutes';

/**
 * After rules change, untouched cards (alone in their board's first phase, no session yet) may now belong on another
 * board. Offers to move them to the start of that board.
 */
export function RerouteNotice({
  factoryId,
  canEdit,
  boardNames,
}: {
  factoryId: string;
  canEdit: boolean;
  boardNames: ReadonlyMap<string, string>;
}) {
  const preview = useReroutePreview(factoryId);
  const apply = useApplyReroute(factoryId);

  const targets = new Set(preview.data?.moves.map(move => move.toBoard));
  const [only] = targets;
  const where = targets.size === 1 && only ? (boardNames.get(only) ?? only) : 'other boards';

  const onMove = () =>
    apply.mutate(undefined, {
      onSuccess: ({ moved, skipped }) => {
        const stayed = skipped > 0 ? ` ${skipped} changed meanwhile and stayed.` : '';
        toast.success(`Moved ${moved === 1 ? '1 card' : `${moved} cards`}.${stayed}`);
      },
      onError: error => toast.error(error.message),
    });

  return (
    <SharedRerouteNotice
      total={preview.data?.total ?? 0}
      where={where}
      canEdit={canEdit}
      moving={apply.isPending}
      onMove={onMove}
    />
  );
}
