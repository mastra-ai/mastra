import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  SCHEDULE_CHOICES,
  SCHEDULE_PRESETS,
  describeSchedule,
  formatRunTime,
  isScheduleChoice,
  nextRunTimes,
  parseCron,
} from '../schedule';
import type { ScheduleChoice } from '../schedule';
import { STOPS_NEW_IMPORTS_NOTE } from '../settings';

export interface ScheduleControlProps {
  choice: ScheduleChoice;
  /** The cron that would run: the draft's own, else the environment default. */
  cron: string;
  /** True when the draft has no cron of its own and leans on the environment default. */
  usingDefault: boolean;
  /** Saved settings had scheduled imports on — turning them off earns the narrowing note. */
  wasOn: boolean;
  readOnly: boolean;
  onChoose: (choice: ScheduleChoice) => void;
  onCronChange: (cron: string) => void;
}

const NEXT_RUN_COUNT = 3;

export function ScheduleControl({
  choice,
  cron,
  usingDefault,
  wasOn,
  readOnly,
  onChoose,
  onCronChange,
}: ScheduleControlProps) {
  if (readOnly) {
    return <Txt variant="body">{choice === 'off' ? 'Off — only manual imports.' : `${describeSchedule(cron)}.`}</Txt>;
  }

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        aria-label="Schedule"
        value={choice}
        onValueChange={value => {
          if (isScheduleChoice(value)) onChoose(value);
        }}
      >
        {SCHEDULE_CHOICES.map(option => (
          <SegmentedControlItem key={option.value} value={option.value}>
            {option.label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      {choice === 'custom' ? (
        <CustomSchedule cron={cron} onCronChange={onCronChange} />
      ) : (
        <ScheduleSentence choice={choice} cron={cron} usingDefault={usingDefault} wasOn={wasOn} />
      )}
    </div>
  );
}

function ScheduleSentence({
  choice,
  cron,
  usingDefault,
  wasOn,
}: Omit<ScheduleControlProps, 'readOnly' | 'onChoose' | 'onCronChange'>) {
  if (choice === 'off') {
    return (
      <Txt variant="body-sm" tone="muted">
        Off — only manual imports.{wasOn ? ` ${STOPS_NEW_IMPORTS_NOTE}` : ''}
      </Txt>
    );
  }
  const preset = SCHEDULE_PRESETS.find(item => item.id === choice);
  return (
    <Txt variant="body-sm" tone="muted">
      Imports {describeSchedule(preset?.cron ?? cron).toLowerCase()}
      {usingDefault ? ' (the environment default)' : ''}. Changes take effect on the next scheduler tick after you save.
    </Txt>
  );
}

function CustomSchedule({ cron, onCronChange }: { cron: string; onCronChange: (cron: string) => void }) {
  const parsed = cron.trim() === '' ? undefined : parseCron(cron);
  const upcoming = parsed?.ok ? nextRunTimes(parsed.cron, new Date(), NEXT_RUN_COUNT) : [];

  return (
    <Field>
      <FieldLabel>Cron expression</FieldLabel>
      <Input
        aria-label="Cron expression"
        placeholder="*/15 * * * *"
        className="font-mono"
        value={cron}
        aria-invalid={parsed?.ok === false}
        onChange={event => onCronChange(event.target.value)}
      />
      {parsed === undefined ? (
        <Txt variant="caption" tone="muted">
          Five fields: minute, hour, day of month, month, day of week.
        </Txt>
      ) : null}
      {parsed?.ok === false ? <FieldError>{parsed.error}</FieldError> : null}
      {parsed?.ok ? (
        <Txt variant="caption" tone="muted">
          {describeSchedule(cron)}.{' '}
          {upcoming.length > 0 ? `Next: ${upcoming.map(formatRunTime).join(', ')}.` : 'No run in the next year.'}
        </Txt>
      ) : null}
    </Field>
  );
}
