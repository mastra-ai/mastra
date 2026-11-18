import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode, Ref } from 'react';

import { IconTile } from './IconTile';
import { MODEL_DEFAULTS_LABELS, MODEL_LANE_ICONS, MODEL_LANE_LABELS } from './model-routes';
import type { ModelDefaults, ModelLane } from './model-routes';

// The settings card surface (no rim or shadow), like the defaults cards it connects to.
export const LANE_CARD = 'bg-card flex items-center gap-3 rounded-xl p-3.5';
export const LANE_CARD_TEXT = 'flex min-w-0 flex-col gap-1';
export const LANE_DESTINATION = '@min-[38rem]:sr-only';

export function LaneCard({
  lane,
  destination,
  anchorRef,
  children,
}: {
  lane: ModelLane;
  destination: ModelDefaults;
  anchorRef: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <section ref={anchorRef} aria-label={MODEL_LANE_LABELS[lane]} className={LANE_CARD}>
      <IconTile icon={MODEL_LANE_ICONS[lane]} className="text-muted-foreground" />
      <div className={LANE_CARD_TEXT}>
        <Txt as="h3" variant="label">
          {MODEL_LANE_LABELS[lane]}
        </Txt>
        <ul className="text-muted-foreground [&_svg]:size-icon-sm flex flex-wrap items-center gap-2.5">{children}</ul>
        <Txt variant="meta" tone="muted" className={LANE_DESTINATION}>
          Uses {MODEL_DEFAULTS_LABELS[destination]}
        </Txt>
      </div>
    </section>
  );
}

export function LaneSource({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li title={label} className="flex">
      {children}
      <span className="sr-only">{label}</span>
    </li>
  );
}
