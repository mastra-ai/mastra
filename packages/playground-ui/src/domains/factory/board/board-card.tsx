import type { ReactNode, Ref } from 'react';
import { setDragPayload } from './board-drag';
import type { DragPayload } from './board-drag';
import { BOARD_CARD_LAYOUT_CLASS } from './board-layout';
import { ActivityWick } from '@/ds/components/Activity';
import type { ActivityStatus } from '@/ds/components/Activity';
import { focusRingInset } from '@/ds/primitives/transitions';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/utils/cn';

/** A board-layout card: a draggable surface whose full area links to the card, with the host's rows inside. */
export function BoardCard({
  title,
  href,
  linkRef,
  dragPayload,
  busy = false,
  locked = false,
  highlighted = false,
  related = false,
  activityStatus,
  LinkComponent: Link = 'a',
  children,
}: {
  title: string;
  href: string;
  linkRef?: Ref<HTMLAnchorElement>;
  dragPayload?: DragPayload;
  busy?: boolean;
  /** A move of the signed-in user's is in flight: the card can't be dragged or acted on. */
  locked?: boolean;
  highlighted?: boolean;
  related?: boolean;
  activityStatus?: ActivityStatus;
  LinkComponent?: LinkComponent;
  children: ReactNode;
}) {
  const draggedPayload = locked ? undefined : dragPayload;
  return (
    <article
      draggable={draggedPayload !== undefined}
      aria-label={title}
      aria-busy={busy || undefined}
      data-testid="work-item-card"
      data-related={related ? 'true' : undefined}
      data-highlighted={highlighted || undefined}
      onDragStart={event => {
        if (draggedPayload) setDragPayload(event, draggedPayload);
      }}
      className={cn(
        BOARD_CARD_LAYOUT_CLASS,
        'group transition-colors outline-none hover:bg-fill-hover',
        // `content-visibility` clips at the padding box, which the wick's ring has to reach past.
        activityStatus ? 'border-transparent' : '[contain-intrinsic-size:auto_9rem] [content-visibility:auto]',
        locked ? 'cursor-wait opacity-70' : 'cursor-grab active:cursor-grabbing',
        highlighted && 'border-warning-edge bg-warning-subtle ring-1 ring-warning-edge',
      )}
    >
      {activityStatus && <ActivityWick status={activityStatus} />}
      <Link
        ref={linkRef}
        href={href}
        draggable={false}
        aria-label={`Open ${title}`}
        className={`absolute inset-0 cursor-pointer rounded-card ${focusRingInset}`}
      />
      {children}
    </article>
  );
}
