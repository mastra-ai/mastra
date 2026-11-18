import { Field } from '@mastra/playground-ui/components/Field';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { IconDirection1 } from '@mastra/playground-ui/icons/central/IconDirection1';
import { IconFlag2 } from '@mastra/playground-ui/icons/central/IconFlag2';
import { IconPlay } from '@mastra/playground-ui/icons/central/IconPlay';
import { IconRobot } from '@mastra/playground-ui/icons/central/IconRobot';
import { SettingsContainer, SettingsGroup, SettingsSkeleton, SettingsTitle } from '@mastra/playground-ui/new/settings';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import { SettingsSubsection } from '../../settings/components/SettingsSubsection';
import { PHASE_TOOLS } from '../boardDraft';
import { FIELD_WIDTH } from './PhaseConfig';
import { TILE } from './PhaseMoves';
import { PhaseStep, PhaseSteps } from './PhaseSteps';

const BAR = 'motion-reduce:before:animate-none';

function TitlePlaceholder({ width }: { width: string }) {
  return (
    <SettingsTitle>
      <SkeletonText line="text-subheading" className={cn(width, BAR)} />
    </SettingsTitle>
  );
}

function FieldPlaceholder({ titleWidth, children }: { titleWidth: string; children: ReactNode }) {
  return (
    <SettingsGroup>
      <Field>
        <TitlePlaceholder width={titleWidth} />
        <div className="-mt-1">
          <SkeletonText line="text-caption" className={cn('w-64 max-w-full', BAR)} />
        </div>
        {children}
      </Field>
    </SettingsGroup>
  );
}

function MarkdownPlaceholder() {
  return (
    <SettingsContainer>
      <div className="px-4">
        <div className="text-body-sm h-[3lh] leading-[1.4]">
          <SkeletonText line="text-body-sm" className={cn('w-3/5', BAR)} />
        </div>
      </div>
    </SettingsContainer>
  );
}

function InputPlaceholder() {
  return <Skeleton className={cn('h-control-md w-full rounded-full', FIELD_WIDTH, BAR)} />;
}

function MovesPlaceholder() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className={cn(TILE, 'w-24 border-transparent', BAR)} />
      ))}
    </div>
  );
}

export function PhaseConfigSkeleton({ working }: { working: boolean }) {
  return (
    <div role="status" aria-label="Loading phase">
      <div aria-hidden className="flex flex-col gap-8">
        {working ? (
          <PhaseSteps label="Phase steps">
            <PhaseStep icon={<IconPlay />} title="Starts">
              <SettingsContainer>
                <SettingsSkeleton label="Loading start" rows={1} />
              </SettingsContainer>
            </PhaseStep>
            <PhaseStep icon={<IconRobot />} title="Agent runs">
              <FieldPlaceholder titleWidth="w-24">
                <MarkdownPlaceholder />
              </FieldPlaceholder>
              <FieldPlaceholder titleWidth="w-12">
                <MarkdownPlaceholder />
              </FieldPlaceholder>
              <FieldPlaceholder titleWidth="w-16">
                <InputPlaceholder />
              </FieldPlaceholder>
              <SettingsGroup>
                <TitlePlaceholder width="w-10" />
                <SettingsContainer>
                  <div className="flex flex-col gap-1 px-4">
                    <div className="flex items-center gap-2">
                      <Skeleton className={cn('h-control-sm w-32 rounded-full', BAR)} />
                      <Skeleton className={cn('ml-auto h-control-sm w-16 rounded-full', BAR)} />
                    </div>
                    <SkeletonText line="text-caption" className={cn('w-40 max-w-full', BAR)} />
                  </div>
                </SettingsContainer>
              </SettingsGroup>
              <SettingsGroup>
                <TitlePlaceholder width="w-24" />
                <SettingsContainer>
                  <SettingsSkeleton label="Loading factory tools" rows={PHASE_TOOLS.length} />
                </SettingsContainer>
              </SettingsGroup>
            </PhaseStep>
            <PhaseStep icon={<IconFlag2 />} title="Ends">
              <FieldPlaceholder titleWidth="w-16">
                <InputPlaceholder />
              </FieldPlaceholder>
            </PhaseStep>
            <PhaseStep icon={<IconDirection1 />} title="Allowed moves">
              <MovesPlaceholder />
            </PhaseStep>
          </PhaseSteps>
        ) : (
          <SettingsSubsection title="Allowed moves">
            <MovesPlaceholder />
          </SettingsSubsection>
        )}
      </div>
    </div>
  );
}
