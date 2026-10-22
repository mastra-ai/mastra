import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { AppWindow, Building2, CircleUserRound, MessagesSquare, SquareKanban } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';

import { GitLabIcon, IncidentIoIcon, JiraIcon } from '../../../../ui/icons';
import type { FactoryModelScope } from '../../../workspaces/services/github';
import { MODEL_DEFAULTS_ANCHORS } from '../../settingsSections';
import type { CredentialScope } from '../provider-credential';
import {
  MODEL_DEFAULTS_LABELS,
  MODEL_LANES,
  MODEL_LANE_LABELS,
  MODEL_ROUTES,
  connectorPath,
  defaultsInUse,
} from './model-routes';
import type { ModelDefaults, ModelLane } from './model-routes';
import { FactoryDefaultModel } from './FactoryDefaultModel';
import { PersonalDefaultModel } from './PersonalDefaultModel';
import { ProviderList } from './ProviderList';

const LANE_ICONS: Record<ModelLane, LucideIcon> = { chats: MessagesSquare, runs: SquareKanban };

const LANE_SOURCES: Record<ModelLane, Array<{ label: string; icon: ReactNode }>> = {
  chats: [
    { label: 'Web app', icon: <AppWindow /> },
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

const DEFAULTS_ICONS: Record<ModelDefaults, LucideIcon> = { personal: CircleUserRound, factory: Building2 };
const DEFAULTS_TONE: Record<ModelDefaults, string> = { personal: 'text-chart-purple', factory: 'text-chart-blue' };
const DEFAULTS_CREDENTIAL_SCOPE: Record<ModelDefaults, CredentialScope> = { personal: 'user', factory: 'org' };

type AnchorKey = ModelLane | ModelDefaults;
type ConnectorLayout = { width: number; y: Partial<Record<AnchorKey, number>> };

/** Connector ends follow the cards they join, so they are measured rather than laid out in CSS. */
function useConnectorLayout() {
  const svgRef = useRef<SVGSVGElement>(null);
  const anchors = useRef(new Map<AnchorKey, HTMLElement>());
  const [layout, setLayout] = useState<ConnectorLayout>();

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const box = svg.getBoundingClientRect();
      const y: ConnectorLayout['y'] = {};
      for (const [key, element] of anchors.current) {
        const rect = element.getBoundingClientRect();
        y[key] = rect.top + rect.height / 2 - box.top;
      }
      setLayout({ width: box.width, y });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const anchorRef = (key: AnchorKey) => (element: HTMLElement | null) => {
    if (element) anchors.current.set(key, element);
    else anchors.current.delete(key);
  };

  return { svgRef, anchorRef, layout };
}

export function ModelRoutingMap({ factoryId, modelScope }: { factoryId: string; modelScope: FactoryModelScope }) {
  const routes = MODEL_ROUTES[modelScope];
  const { svgRef, anchorRef, layout } = useConnectorLayout();

  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-3 @min-[44rem]:grid-cols-[13rem_minmax(4rem,1fr)_minmax(0,26rem)] @min-[44rem]:gap-0">
        <div className="flex flex-col gap-3 self-center">
          {MODEL_LANES.map(lane => (
            <LaneCard key={lane} lane={lane} destination={routes[lane]} anchorRef={anchorRef(lane)} />
          ))}
        </div>
        <svg ref={svgRef} aria-hidden="true" className="hidden h-full w-full overflow-visible @min-[44rem]:block">
          {layout &&
            MODEL_LANES.map(lane => {
              const fromY = layout.y[lane];
              const toY = layout.y[routes[lane]];
              if (fromY === undefined || toY === undefined) return null;
              return (
                <g key={lane} className={DEFAULTS_TONE[routes[lane]]} fill="currentColor">
                  <path
                    d={connectorPath(0, fromY, layout.width, toY)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  />
                  <circle cx={0} cy={fromY} r={2.5} />
                  <circle cx={layout.width} cy={toY} r={2.5} />
                </g>
              );
            })}
        </svg>
        <div className="flex min-w-0 flex-col gap-3">
          <DefaultsNode
            defaults="personal"
            inUse={defaultsInUse(modelScope, 'personal')}
            anchorRef={anchorRef('personal')}
            model={<PersonalDefaultModel />}
          />
          <DefaultsNode
            defaults="factory"
            inUse={defaultsInUse(modelScope, 'factory')}
            anchorRef={anchorRef('factory')}
            model={<FactoryDefaultModel factoryId={factoryId} />}
          />
        </div>
      </div>
    </div>
  );
}

function LaneCard({
  lane,
  destination,
  anchorRef,
}: {
  lane: ModelLane;
  destination: ModelDefaults;
  anchorRef: (element: HTMLElement | null) => void;
}) {
  const Icon = LANE_ICONS[lane];
  return (
    <Card as="section" ref={anchorRef} aria-label={MODEL_LANE_LABELS[lane]}>
      <CardContent className="flex items-center gap-3">
        <span className="bg-fill-subtle text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <Txt as="h3" variant="label">
            {MODEL_LANE_LABELS[lane]}
          </Txt>
          <ul className="text-muted-foreground flex flex-wrap items-center gap-2.5 [&_svg]:size-3.5">
            {LANE_SOURCES[lane].map(({ label, icon }) => (
              <li key={label} title={label} className="flex">
                {icon}
                <span className="sr-only">{label}</span>
              </li>
            ))}
          </ul>
          <Txt variant="meta" tone="muted" className="@min-[44rem]:sr-only">
            Uses {MODEL_DEFAULTS_LABELS[destination]}
          </Txt>
        </div>
      </CardContent>
    </Card>
  );
}

function DefaultsNode({
  defaults,
  inUse,
  anchorRef,
  model,
}: {
  defaults: ModelDefaults;
  inUse: boolean;
  anchorRef: (element: HTMLElement | null) => void;
  model: ReactNode;
}) {
  const Icon = DEFAULTS_ICONS[defaults];
  const anchor = MODEL_DEFAULTS_ANCHORS[defaults];
  const { hash } = useLocation();
  const isLinkTarget = hash === `#${anchor}`;
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLinkTarget) cardRef.current?.scrollIntoView?.({ block: 'start' });
  }, [isLinkTarget]);

  return (
    <Card
      ref={cardRef}
      as="section"
      id={anchor}
      aria-label={MODEL_DEFAULTS_LABELS[defaults]}
      className={cn('scroll-mt-4', !inUse && 'opacity-60')}
    >
      <CardContent className="flex flex-col gap-4">
        <header ref={anchorRef} className="flex items-center gap-3">
          <span
            className={cn(
              'bg-fill-subtle flex size-8 shrink-0 items-center justify-center rounded-lg',
              DEFAULTS_TONE[defaults],
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col">
            <Txt as="h3" variant="label">
              {MODEL_DEFAULTS_LABELS[defaults]}
            </Txt>
            {!inUse && (
              <Txt variant="meta" tone="muted">
                Not used in this scope
              </Txt>
            )}
          </div>
        </header>
        {inUse && (
          <>
            <Field className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2">
              <FieldLabel size="smaller" className="h-control-sm text-muted-foreground">
                Model
              </FieldLabel>
              {model}
            </Field>
            <div className="flex flex-col gap-2">
              <Txt as="span" variant="caption" tone="muted">
                Providers
              </Txt>
              <ProviderList credentialScope={DEFAULTS_CREDENTIAL_SCOPE[defaults]} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
