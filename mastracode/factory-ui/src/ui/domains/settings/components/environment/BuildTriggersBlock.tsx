import { useState } from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsRow } from '@mastra/playground-ui/new/settings';

import type { FactoryEnvironmentBuildTriggers } from '../../../workspaces/services/environment';
import { CommittedInput, type SaveEnvironment } from './CommittedInput';

const DEFAULT_CRON = '0 3 * * *';

/**
 * When the template is rebuilt on its own: on a cron schedule and after a
 * push to a repository's default branch. Each trigger is a switch row; turning
 * one on reveals its own settings as ordinary rows under it. Rendered inside
 * the caller's container. Changing a setting always starts a build regardless.
 */
export function BuildTriggersRows({
  triggers,
  disabled,
  onSave,
}: {
  triggers: FactoryEnvironmentBuildTriggers;
  disabled: boolean;
  onSave: SaveEnvironment;
}) {
  const { schedule, push } = triggers;
  const saveCron = (cron: string) => onSave({ buildTriggers: { schedule: { enabled: true, cron } } });

  return (
    <>
      <ScheduleRows
        schedule={schedule}
        disabled={disabled}
        onCommit={cron => (cron ? saveCron(cron) : onSave({ buildTriggers: { schedule: { enabled: false } } }))}
      />
      <SettingsRow label="Rebuild on push" description="Rebuild after a push to a repository's default branch.">
        <Switch
          aria-label="Rebuild on push"
          checked={push.enabled}
          disabled={disabled}
          onCheckedChange={enabled => void onSave({ buildTriggers: { push: { enabled } } })}
        />
      </SettingsRow>
      {push.enabled && (
        <SettingsRow label="Push debounce" description="Minimum minutes between push-triggered builds, 0 to 1440.">
          <div className="w-full lg:max-w-96">
            <CommittedInput
              label="Push debounce in minutes"
              type="number"
              min={0}
              max={1440}
              value={String(push.debounceMinutes)}
              disabled={disabled}
              onCommit={raw => {
                const debounceMinutes = Number(raw);
                if (!Number.isInteger(debounceMinutes) || debounceMinutes < 0 || debounceMinutes > 1440) {
                  toast.error('Enter a whole number between 0 and 1440');
                  return Promise.reject(new Error('out of range'));
                }
                return onSave({ buildTriggers: { push: { debounceMinutes } } });
              }}
            />
          </div>
        </SettingsRow>
      )}
    </>
  );
}

type Frequency = 'off' | 'daily' | 'weekly' | 'custom';

const FREQUENCY_LABEL: Record<Frequency, string> = { off: 'Off', daily: 'Daily', weekly: 'Weekly', custom: 'Custom' };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** A cron the preset controls can express: on the hour, every day or one weekday. */
function parsePreset(cron: string): { frequency: 'daily' | 'weekly'; hour: number; day: number } | null {
  const match = /^0 (\d{1,2}) \* \* (\*|[0-6])$/.exec(cron.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour > 23) return null;
  return match[2] === '*' ? { frequency: 'daily', hour, day: 1 } : { frequency: 'weekly', hour, day: Number(match[2]) };
}

function presetCron(frequency: 'daily' | 'weekly', hour: number, day: number) {
  return `0 ${hour} * * ${frequency === 'daily' ? '*' : day}`;
}

const pad = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

function describe(frequency: Frequency, cron: string, hour: number, day: number, timezone: string) {
  switch (frequency) {
    case 'off':
      return 'Rebuild on a schedule when a repository head moved.';
    case 'daily':
      return `Rebuilds daily at ${pad(hour)} ${timezone}, when a repository head moved.`;
    case 'weekly':
      return `Rebuilds every ${DAYS[day]} at ${pad(hour)} ${timezone}, when a repository head moved.`;
    case 'custom':
      return `Rebuilds on \`${cron}\` (${timezone}), when a repository head moved.`;
  }
}

/**
 * One row: how often the template rebuilds, with an inset under it holding
 * the day and time for the presets, or the cron expression for custom. The
 * stored value is always a cron; Off disables the trigger. An empty commit
 * means Off.
 */
function ScheduleRows({
  schedule,
  disabled,
  onCommit,
}: {
  schedule: FactoryEnvironmentBuildTriggers['schedule'];
  disabled: boolean;
  onCommit: (cron: string) => Promise<unknown>;
}) {
  const cron = schedule.cron ?? DEFAULT_CRON;
  const timezone = schedule.timezone ?? 'UTC';
  const preset = parsePreset(cron);
  const [custom, setCustom] = useState(schedule.enabled && preset === null);
  const frequency: Frequency = !schedule.enabled ? 'off' : custom || preset === null ? 'custom' : preset.frequency;
  const hour = preset?.hour ?? 3;
  const day = preset?.day ?? 1;
  const locked = disabled || !schedule.scheduleAvailable;

  const pick = (next: Frequency) => {
    if (next === 'off') {
      setCustom(false);
      void onCommit('');
      return;
    }
    if (next === 'custom') {
      setCustom(true);
      if (!schedule.enabled) void onCommit(cron);
      return;
    }
    setCustom(false);
    void onCommit(presetCron(next, hour, day));
  };

  const hourSelect = (onPick: (hour: number) => void) => (
    <Select value={String(hour)} onValueChange={next => onPick(Number(next))} disabled={locked}>
      <SelectTrigger size="sm" aria-label="Build time" className="w-auto">
        {pad(hour)} {timezone}
      </SelectTrigger>
      <SelectContent>
        {HOURS.map(value => (
          <SelectItem key={value} value={String(value)}>
            {pad(value)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex flex-col">
      <SettingsRow
        label="Build schedule"
        description={
          schedule.scheduleAvailable
            ? describe(frequency, cron, hour, day, timezone)
            : 'Needs a storage adapter with schedules. Build now and push builds still work.'
        }
      >
        <Select value={frequency} onValueChange={next => pick(next as Frequency)} disabled={locked}>
          <SelectTrigger size="sm" aria-label="Build frequency" className="w-auto">
            {FREQUENCY_LABEL[frequency]}
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map(value => (
              <SelectItem key={value} value={value}>
                {FREQUENCY_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>
      {frequency !== 'off' && (
        <div className="bg-surface3 mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-md px-3 py-2">
          {frequency === 'daily' && (
            <>
              <Txt as="span" variant="caption" tone="muted">
                Rebuild at
              </Txt>
              {hourSelect(next => void onCommit(presetCron('daily', next, day)))}
            </>
          )}
          {frequency === 'weekly' && (
            <>
              <Txt as="span" variant="caption" tone="muted">
                On
              </Txt>
              <Select
                value={String(day)}
                onValueChange={next => void onCommit(presetCron('weekly', hour, Number(next)))}
                disabled={locked}
              >
                <SelectTrigger size="sm" aria-label="Build day" className="w-auto">
                  {DAYS[day]}
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((name, index) => (
                    <SelectItem key={name} value={String(index)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Txt as="span" variant="caption" tone="muted">
                at
              </Txt>
              {hourSelect(next => void onCommit(presetCron('weekly', next, day)))}
            </>
          )}
          {frequency === 'custom' && (
            <>
              <Txt as="span" variant="caption" tone="muted">
                Cron
              </Txt>
              <span className="w-48">
                <CommittedInput
                  label="Build schedule cron"
                  value={cron}
                  placeholder={DEFAULT_CRON}
                  disabled={locked}
                  onCommit={next => {
                    if (!next) {
                      toast.error('Enter a cron expression');
                      return Promise.reject(new Error('cron is required'));
                    }
                    return onCommit(next);
                  }}
                />
              </span>
              <Txt as="span" variant="caption" tone="muted">
                {timezone}
              </Txt>
            </>
          )}
        </div>
      )}
    </div>
  );
}
