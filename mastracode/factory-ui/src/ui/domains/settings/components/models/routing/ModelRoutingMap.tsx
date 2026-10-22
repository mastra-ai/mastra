import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import { AppWindow } from 'lucide-react';

import { GitLabIcon, IncidentIoIcon, JiraIcon } from '../../../../../ui/icons';
import type { FactoryModelScope } from '../../../../workspaces/services/github';
import { FactoryDefaultModel } from '../defaults/FactoryDefaultModel';
import { PersonalDefaultModel } from '../defaults/PersonalDefaultModel';
import { ProviderList } from '../providers/ProviderList';
import { DefaultsCard } from './DefaultsCard';
import { LaneCard, LaneSource } from './LaneCard';
import { MODEL_DEFAULTS_TONES, MODEL_LANES, MODEL_ROUTES, connectorPath, defaultsInUse } from './model-routes';
import { useConnectorLayout } from './useConnectorLayout';

export function ModelRoutingMap({ factoryId, modelScope }: { factoryId: string; modelScope: FactoryModelScope }) {
  const routes = MODEL_ROUTES[modelScope];
  const { svgRef, anchorRef, layout } = useConnectorLayout();

  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-3 @min-[44rem]:grid-cols-[13rem_minmax(4rem,1fr)_minmax(0,26rem)] @min-[44rem]:gap-0">
        <div className="flex flex-col gap-3 self-center">
          <LaneCard lane="chats" destination={routes.chats} anchorRef={anchorRef('chats')}>
            <LaneSource label="Web app">
              <AppWindow />
            </LaneSource>
            <LaneSource label="Slack">
              <SlackIcon />
            </LaneSource>
          </LaneCard>
          <LaneCard lane="runs" destination={routes.runs} anchorRef={anchorRef('runs')}>
            <LaneSource label="GitHub">
              <GithubIcon />
            </LaneSource>
            <LaneSource label="GitLab">
              <GitLabIcon />
            </LaneSource>
            <LaneSource label="Linear">
              <LinearIcon />
            </LaneSource>
            <LaneSource label="Jira">
              <JiraIcon />
            </LaneSource>
            <LaneSource label="incident.io">
              <IncidentIoIcon />
            </LaneSource>
          </LaneCard>
        </div>
        <svg ref={svgRef} aria-hidden="true" className="hidden h-full w-full overflow-visible @min-[44rem]:block">
          {layout &&
            MODEL_LANES.map(lane => {
              const fromY = layout.y[lane];
              const toY = layout.y[routes[lane]];
              if (fromY === undefined || toY === undefined) return null;
              return (
                <g key={lane} className={MODEL_DEFAULTS_TONES[routes[lane]]} fill="currentColor">
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
          <DefaultsCard
            defaults="personal"
            inUse={defaultsInUse(modelScope, 'personal')}
            anchorRef={anchorRef('personal')}
            model={<PersonalDefaultModel />}
            providers={<ProviderList credentialScope="user" />}
          />
          <DefaultsCard
            defaults="factory"
            inUse={defaultsInUse(modelScope, 'factory')}
            anchorRef={anchorRef('factory')}
            model={<FactoryDefaultModel factoryId={factoryId} />}
            providers={<ProviderList credentialScope="org" />}
          />
        </div>
      </div>
    </div>
  );
}
