import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { useState } from 'react';

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
  const [dismissed, setDismissed] = useState(false);

  const total = preview.data?.total ?? 0;
  if (dismissed || total === 0) return null;
  const targets = new Set(preview.data?.moves.map(move => move.toBoard));
  const [only] = targets;
  const where = targets.size === 1 && only ? (boardNames.get(only) ?? only) : 'other boards';
  const cards = total === 1 ? '1 untouched card now belongs' : `${total} untouched cards now belong`;

  const onMove = () =>
    apply.mutate(undefined, {
      onSuccess: ({ moved, skipped }) => {
        const stayed = skipped > 0 ? ` ${skipped} changed meanwhile and stayed.` : '';
        toast.success(`Moved ${moved === 1 ? '1 card' : `${moved} cards`}.${stayed}`);
      },
      onError: error => toast.error(error.message),
    });

  return (
    <Notice
      variant="info"
      title="Rules changed"
      actionPlacement="end"
      action={
        <>
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            Not now
          </Button>
          {canEdit && (
            <Button size="sm" variant="primary" onClick={onMove} loading={apply.isPending}>
              Move them
            </Button>
          )}
        </>
      }
    >
      {cards} on {where}.
    </Notice>
  );
}
