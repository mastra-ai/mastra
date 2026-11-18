import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import { PersonalDefaultModelSkeleton } from '../defaults/PersonalDefaultModelSkeleton';
import { ORG_SCOPE_AUDIENCE } from '../providers/ProviderList';
import { ProviderRowsSkeleton } from '../providers/ProviderRowsSkeleton';
import { DEFAULTS_CARD_BODY, DEFAULTS_CARD_HEADER, DefaultsCardFields } from './DefaultsCard';
import { IconTile } from './IconTile';
import { LANE_CARD, LANE_CARD_TEXT, LANE_DESTINATION } from './LaneCard';
import {
  MODEL_DEFAULTS_ICONS,
  MODEL_DEFAULTS_LABELS,
  MODEL_DEFAULTS_TONES,
  MODEL_LANE_ICONS,
  MODEL_LANE_LABELS,
  MODEL_SCOPE_LABELS,
} from './model-routes';
import type { ModelDefaults, ModelLane } from './model-routes';
import {
  ROUTING_CONNECTOR_COLUMN,
  ROUTING_DEFAULTS_COLUMN,
  ROUTING_LANES_COLUMN,
  ROUTING_MAP_GRID_CLASS,
} from './RoutingMapLayout';

const LANE_SOURCES_WIDTH: Record<ModelLane, string> = { chats: 'w-10', runs: 'w-28' };

function LaneCardSkeleton({ lane }: { lane: ModelLane }) {
  return (
    <div className={LANE_CARD}>
      <IconTile icon={MODEL_LANE_ICONS[lane]} className="text-muted-foreground" />
      <div className={LANE_CARD_TEXT}>
        <Txt as="span" variant="label">
          {MODEL_LANE_LABELS[lane]}
        </Txt>
        <Skeleton className={cn('h-icon-sm motion-reduce:before:animate-none', LANE_SOURCES_WIDTH[lane])} />
        <div className={LANE_DESTINATION}>
          <SkeletonText line="text-meta" className="w-24 motion-reduce:before:animate-none" />
        </div>
      </div>
    </div>
  );
}

export function ModelRoutingSwitchSkeleton() {
  return (
    <Skeleton
      aria-hidden
      className="h-control-md inline-flex w-fit shrink-0 rounded-full p-0.5 motion-reduce:before:animate-none"
    >
      {Object.values(MODEL_SCOPE_LABELS).map(label => (
        <span key={label} className="text-label invisible inline-flex items-center gap-1.5 px-3 whitespace-nowrap">
          <span className="size-icon-sm shrink-0" />
          {label}
        </span>
      ))}
    </Skeleton>
  );
}

function DefaultsCardSkeleton({
  defaults,
  model,
  providers,
}: {
  defaults: ModelDefaults;
  model: ReactNode;
  providers: ReactNode;
}) {
  return (
    <SettingsContainer>
      <div>
        <div className={DEFAULTS_CARD_HEADER}>
          <IconTile icon={MODEL_DEFAULTS_ICONS[defaults]} className={MODEL_DEFAULTS_TONES[defaults]} />
          <Txt as="span" variant="label">
            {MODEL_DEFAULTS_LABELS[defaults]}
          </Txt>
        </div>
        <div className={DEFAULTS_CARD_BODY}>
          <DefaultsCardFields model={model} providers={providers} />
        </div>
      </div>
    </SettingsContainer>
  );
}

export function ModelRoutingSkeleton() {
  return (
    <div role="status" aria-label="Loading model routing" className="@container">
      <div inert aria-hidden className={ROUTING_MAP_GRID_CLASS}>
        <div className={ROUTING_LANES_COLUMN}>
          <LaneCardSkeleton lane="chats" />
          <LaneCardSkeleton lane="runs" />
        </div>
        <div className={ROUTING_CONNECTOR_COLUMN} />
        <div className={ROUTING_DEFAULTS_COLUMN}>
          <DefaultsCardSkeleton
            defaults="personal"
            model={<PersonalDefaultModelSkeleton />}
            providers={<ProviderRowsSkeleton rows={0} />}
          />
          <DefaultsCardSkeleton
            defaults="factory"
            model={<Skeleton className="h-control-sm w-full rounded-full motion-reduce:before:animate-none" />}
            providers={
              <div className="flex flex-col gap-2">
                <ProviderRowsSkeleton rows={1} />
                <Txt as="p" variant="caption" tone="muted">
                  {ORG_SCOPE_AUDIENCE}
                </Txt>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
