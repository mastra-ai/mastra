import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import { IconWindow } from '@mastra/playground-ui/icons/central/IconWindow';
import type { ReactNode, Ref } from 'react';

import { GitLabIcon, IncidentIoIcon, JiraIcon } from '../../../../../ui/icons';
import { IconTile } from './IconTile';
import { MODEL_DEFAULTS_LABELS, MODEL_LANE_ICONS, MODEL_LANE_LABELS } from './model-routes';
import type { ModelDefaults, ModelLane } from './model-routes';

const LANE_SOURCES: Record<ModelLane, { label: string; icon: ReactNode }[]> = {
  chats: [
    { label: 'Web app', icon: <IconWindow /> },
    { label: 'Slack', icon: <SlackIcon /> },
  ],
  runs: [
    { label: 'GitHub', icon: <GithubIcon /> },
    { label: 'GitLab', icon: <GitLabIcon /> },
    { label: 'Linear', icon: <LinearIcon /> },
    { label: 'Jira', icon: <JiraIcon /> },
    { label: 'incident.io', icon: <IncidentIoIcon /> },
  ],
};

export function LaneDestination({ defaults }: { defaults: ModelDefaults }) {
  return (
    <Txt variant="meta" tone="muted">
      Uses {MODEL_DEFAULTS_LABELS[defaults]}
    </Txt>
  );
}

// The settings card surface (no rim or shadow), like the defaults cards it connects to.
export function LaneCard({
  lane,
  destination,
  anchorRef,
}: {
  lane: ModelLane;
  destination: ReactNode;
  anchorRef?: Ref<HTMLDivElement>;
}) {
  return (
    <section
      ref={anchorRef}
      aria-label={MODEL_LANE_LABELS[lane]}
      className="bg-card flex items-center gap-3 rounded-xl p-3.5"
    >
      <IconTile icon={MODEL_LANE_ICONS[lane]} className="text-muted-foreground" />
      <div className="flex min-w-0 flex-col gap-1">
        <Txt as="h3" variant="label">
          {MODEL_LANE_LABELS[lane]}
        </Txt>
        <ul className="text-muted-foreground [&_svg]:size-icon-sm flex flex-wrap items-center gap-2.5">
          {LANE_SOURCES[lane].map(({ label, icon }) => (
            <li key={label} title={label} className="flex">
              {icon}
              <span className="sr-only">{label}</span>
            </li>
          ))}
        </ul>
        <div className="@min-[38rem]:sr-only">{destination}</div>
      </div>
    </section>
  );
}
