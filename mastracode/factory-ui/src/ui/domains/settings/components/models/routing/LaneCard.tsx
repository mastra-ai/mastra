import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

import { IconTile } from './IconTile';
import { MODEL_DEFAULTS_LABELS, MODEL_LANE_ICONS, MODEL_LANE_LABELS } from './model-routes';
import type { ModelDefaults, ModelLane } from './model-routes';

export function LaneCard({
  lane,
  destination,
  anchorRef,
  children,
}: {
  lane: ModelLane;
  destination: ModelDefaults;
  anchorRef: (element: HTMLElement | null) => void;
  children: ReactNode;
}) {
  return (
    <Card as="section" ref={anchorRef} aria-label={MODEL_LANE_LABELS[lane]}>
      <CardContent className="flex items-center gap-3">
        <IconTile icon={MODEL_LANE_ICONS[lane]} className="text-muted-foreground" />
        <div className="flex min-w-0 flex-col gap-1">
          <Txt as="h3" variant="label">
            {MODEL_LANE_LABELS[lane]}
          </Txt>
          <ul className="text-muted-foreground flex flex-wrap items-center gap-2.5 [&_svg]:size-3.5">{children}</ul>
          <Txt variant="meta" tone="muted" className="@min-[44rem]:sr-only">
            Uses {MODEL_DEFAULTS_LABELS[destination]}
          </Txt>
        </div>
      </CardContent>
    </Card>
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
