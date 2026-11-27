import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Notice } from '@/ds/components/Notice';

/**
 * After rules change, untouched cards (alone in their board's first phase, no session yet) may now belong on another
 * board. Offers to move them to the start of that board.
 */
export function RerouteNotice({
  total,
  where,
  canEdit,
  moving,
  onMove,
}: {
  /** Untouched cards that now belong on another board; with none, nothing shows. */
  total: number;
  /** The board they belong on, or "other boards". */
  where: string;
  canEdit: boolean;
  /** The move is running. */
  moving: boolean;
  onMove: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || total === 0) return null;
  const cards = total === 1 ? '1 untouched card now belongs' : `${total} untouched cards now belong`;

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
            <Button size="sm" variant="primary" onClick={onMove} loading={moving}>
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
