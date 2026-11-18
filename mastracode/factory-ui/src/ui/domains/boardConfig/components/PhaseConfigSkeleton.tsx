import { Input } from '@mastra/playground-ui/components/Input';
import { Select, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import type { FactorySkillInfo, InstalledPhaseInfo } from '../../../../api/types';
import { PendingField, PendingSwitch, PendingValue } from '../../../ui/PendingField';
import { DEFAULT_SESSION } from '../boardDraft';
import { MarkdownEditor } from './PhaseConfig';
import { RestingPhaseLayout, WorkingPhaseLayout } from './PhaseConfigLayout';
import { PhaseMoves, PhaseMovesSkeleton } from './PhaseMoves';
import { APPROVE_ON_ITS_OWN, GOAL_PLACEHOLDER, phaseLabels } from './phaseLabels';
import { PhaseSkill } from './PhaseSkill';

function SwitchValue({ label, checked }: { label: string; checked: boolean | undefined }) {
  if (checked === undefined) return <PendingSwitch />;
  return <Switch aria-label={label} checked={checked} />;
}

function MarkdownValue({
  label,
  value,
  placeholder = '',
}: {
  label: string;
  value: string | undefined;
  placeholder?: string;
}) {
  return (
    <PendingField multiline pending={value === undefined}>
      <MarkdownEditor
        label={label}
        value={value ?? ''}
        placeholder={value === undefined ? '' : placeholder}
        onChange={() => undefined}
      />
    </PendingField>
  );
}

function InputValue({ label, value, placeholder }: { label: string; value: string | undefined; placeholder?: string }) {
  return (
    <PendingField pending={value === undefined}>
      <Input
        aria-label={label}
        value={value ?? ''}
        placeholder={value === undefined ? undefined : placeholder}
        readOnly
      />
    </PendingField>
  );
}

export function PhaseConfigSkeleton({
  factoryId,
  boardId,
  phaseKey,
  phases,
  skills,
  skillsEditable,
}: {
  factoryId: string;
  boardId: string;
  phaseKey: string;
  phases: readonly InstalledPhaseInfo[] | undefined;
  skills: FactorySkillInfo[] | undefined;
  skillsEditable: boolean;
}) {
  const phase = phases?.find(candidate => candidate.id === phaseKey);
  const moving = phases?.map(other => ({ key: other.id, name: other.name ?? other.title, kind: other.kind }));
  const current = moving?.find(other => other.key === phaseKey);
  const name = current?.name ?? '';
  const labels = phaseLabels(name);
  const moves =
    phase && moving && current ? (
      <PhaseMoves
        phase={current}
        phases={moving}
        next={phase.nextPhases ?? []}
        required={new Set()}
        boardId={boardId}
        disabled={false}
        onChange={() => undefined}
      />
    ) : (
      <PhaseMovesSkeleton />
    );

  return (
    <div role="status" aria-label="Loading phase" inert>
      {phase && phase.kind !== 'working' ? (
        <RestingPhaseLayout moves={moves} />
      ) : (
        <WorkingPhaseLayout
          label={phase ? labels.runs : 'Phase steps'}
          autoStart={<SwitchValue label={labels.autoStart} checked={phase && (phase.autoStart ?? false)} />}
          instructions={<MarkdownValue label={`${name} instructions`} value={undefined} />}
          goal={
            <MarkdownValue
              label={labels.goal}
              value={phase && (phase.goal?.objective ?? '')}
              placeholder={GOAL_PLACEHOLDER}
            />
          }
          session={
            <InputValue label={labels.session} value={phase && (phase.context ?? '')} placeholder={DEFAULT_SESSION} />
          }
          skill={
            phase ? (
              <PhaseSkill
                factoryId={factoryId}
                boardId={boardId}
                phaseName={name}
                skillName={phase.skill}
                skills={skills}
                skillsEditable={skillsEditable}
                disabled={false}
                onChange={() => undefined}
              />
            ) : (
              <Select value="">
                <SelectTrigger variant="ghost" size="sm" aria-label={`${name} skill`} className="-ml-2 w-40">
                  <PendingValue />
                </SelectTrigger>
              </Select>
            )
          }
          toolSwitch={tool => (
            <SwitchValue label={labels.tool(tool.label)} checked={phase && (phase.tools?.includes(tool.id) ?? false)} />
          )}
          exitTool={<InputValue label={labels.exitTool} value={phase && (phase.exitTool?.id ?? '')} />}
          exitApproval={
            phase?.exitTool && (
              <SettingsContainer>
                <SettingsRow label={APPROVE_ON_ITS_OWN}>
                  <Switch aria-label={labels.approve(phase.exitTool.id)} checked={phase.exitTool.autoApprove} />
                </SettingsRow>
              </SettingsContainer>
            )
          }
          moves={moves}
        />
      )}
    </div>
  );
}
