import { SettingsItem, SettingsItemIcon } from '@mastra/playground-ui/new/settings';
import type { ReactNode } from 'react';

import { MODEL_DEFAULTS_LABELS, MODEL_LANE_ICONS, MODEL_LANE_LABELS } from './model-routes';
import type { ModelDefaults, ModelLane } from './model-routes';

/** One lane of the routing card: where its requests come from, and which defaults it uses. */
export function LaneItem({
  lane,
  destination,
  children,
}: {
  lane: ModelLane;
  destination: ModelDefaults;
  children: ReactNode;
}) {
  const Icon = MODEL_LANE_ICONS[lane];
  return (
    <SettingsItem
      role="group"
      aria-label={MODEL_LANE_LABELS[lane]}
      media={
        <SettingsItemIcon>
          <Icon />
        </SettingsItemIcon>
      }
      title={MODEL_LANE_LABELS[lane]}
      description={`Uses ${MODEL_DEFAULTS_LABELS[destination]}`}
    >
      <ul className="text-muted-foreground flex flex-wrap items-center justify-end gap-2.5 [&_svg]:size-3.5">
        {children}
      </ul>
    </SettingsItem>
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
