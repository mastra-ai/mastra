import { Field, FieldDescription, FieldError } from '@mastra/playground-ui/components/Field';
import { IconDirection1 } from '@mastra/playground-ui/icons/central/IconDirection1';
import { IconFlag2 } from '@mastra/playground-ui/icons/central/IconFlag2';
import { IconPlay } from '@mastra/playground-ui/icons/central/IconPlay';
import { IconRobot } from '@mastra/playground-ui/icons/central/IconRobot';
import { SettingsContainer, SettingsGroup, SettingsRow, SettingsTitle } from '@mastra/playground-ui/new/settings';
import type { ReactNode } from 'react';

import { SettingsSubsection } from '../../settings/components/SettingsSubsection';
import { PHASE_TOOLS } from '../boardDraft';
import { PhaseStep, PhaseSteps } from './PhaseSteps';

function PhaseField({
  title,
  description,
  error,
  disabled,
  children,
  after,
}: {
  title: string;
  description: string;
  error?: string;
  disabled?: boolean;
  children: ReactNode;
  after?: ReactNode;
}) {
  return (
    <SettingsGroup>
      <Field invalid={Boolean(error)} disabled={disabled}>
        <SettingsTitle>{title}</SettingsTitle>
        <FieldDescription>{description}</FieldDescription>
        {children}
        {error && <FieldError>{error}</FieldError>}
      </Field>
      {after}
    </SettingsGroup>
  );
}

function MarkdownFrame({ children }: { children: ReactNode }) {
  return (
    <SettingsContainer>
      <div className="px-4 py-3">{children}</div>
    </SettingsContainer>
  );
}

function FieldWidth({ children }: { children: ReactNode }) {
  return <div className="sm:max-w-xs">{children}</div>;
}

export function WorkingPhaseLayout({
  label,
  disabled,
  autoStart,
  autoStartRule,
  instructions,
  instructionsCount = '',
  instructionsError,
  goal,
  goalCount = '',
  goalError,
  goalRuns,
  session,
  skill,
  toolSwitch,
  exitTool,
  exitApproval,
  moves,
  remove,
}: {
  label: string;
  disabled?: boolean;
  autoStart: ReactNode;
  autoStartRule?: ReactNode;
  instructions: ReactNode;
  instructionsCount?: string;
  instructionsError?: string;
  goal: ReactNode;
  goalCount?: string;
  goalError?: string;
  goalRuns?: ReactNode;
  session: ReactNode;
  skill: ReactNode;
  toolSwitch: (tool: (typeof PHASE_TOOLS)[number]) => ReactNode;
  exitTool: ReactNode;
  exitApproval?: ReactNode;
  moves: ReactNode;
  remove?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      <PhaseSteps label={label}>
        <PhaseStep icon={<IconPlay />} title="Starts">
          <SettingsContainer>
            <SettingsRow label="Start on its own" disabled={disabled}>
              {autoStart}
            </SettingsRow>
            {autoStartRule}
          </SettingsContainer>
        </PhaseStep>

        <PhaseStep icon={<IconRobot />} title="Agent runs">
          <PhaseField
            title="Instructions"
            description={`Added to the agent's prompt when the phase starts.${instructionsCount}`}
            error={instructionsError}
            disabled={disabled}
          >
            <MarkdownFrame>{instructions}</MarkdownFrame>
          </PhaseField>

          <PhaseField
            title="Goal"
            description={`The agent keeps working until a judge finds this objective met. Leave empty for a single run.${goalCount}`}
            error={goalError}
            disabled={disabled}
            after={goalRuns}
          >
            <MarkdownFrame>{goal}</MarkdownFrame>
          </PhaseField>

          <PhaseField
            title="Session"
            description="Phases with the same session share one agent session per card."
            disabled={disabled}
          >
            <FieldWidth>{session}</FieldWidth>
          </PhaseField>

          <SettingsSubsection title="Skill">
            <SettingsContainer>
              <div className="flex flex-col gap-1 px-4 py-3">{skill}</div>
            </SettingsContainer>
          </SettingsSubsection>

          <SettingsSubsection
            title="Factory tools"
            description="Given to the session that works the card in this phase."
          >
            <SettingsContainer>
              {PHASE_TOOLS.map(tool => (
                <SettingsRow key={tool.id} label={tool.label} disabled={disabled}>
                  {toolSwitch(tool)}
                </SettingsRow>
              ))}
            </SettingsContainer>
          </SettingsSubsection>
        </PhaseStep>

        <PhaseStep icon={<IconFlag2 />} title="Ends">
          <PhaseField
            title="Exit tool"
            description="Ends the phase when it succeeds. Leave empty for none."
            disabled={disabled}
          >
            <FieldWidth>{exitTool}</FieldWidth>
          </PhaseField>
          {exitApproval}
        </PhaseStep>

        <PhaseStep icon={<IconDirection1 />} title="Allowed moves">
          {moves}
        </PhaseStep>
      </PhaseSteps>

      {remove}
    </div>
  );
}

export function RestingPhaseLayout({ moves, remove }: { moves: ReactNode; remove?: ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      <SettingsSubsection title="Allowed moves">{moves}</SettingsSubsection>
      {remove}
    </div>
  );
}
