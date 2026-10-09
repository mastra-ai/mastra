import { useState } from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
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
      <SettingsRow
        label="Rebuild on a schedule"
        description={
          schedule.scheduleAvailable
            ? 'Rebuild on a cron schedule when a repository head moved.'
            : 'Needs a storage adapter with schedules. Build now and push builds still work.'
        }
      >
        <Switch
          aria-label="Rebuild on a schedule"
          checked={schedule.enabled}
          disabled={disabled || !schedule.scheduleAvailable}
          onCheckedChange={enabled =>
            void onSave({
              buildTriggers: {
                schedule: enabled ? { enabled, cron: schedule.cron ?? DEFAULT_CRON } : { enabled },
              },
            })
          }
        />
      </SettingsRow>
      {schedule.enabled && (
        <ScheduleRows
          cron={schedule.cron ?? DEFAULT_CRON}
          timezone={schedule.timezone ?? 'UTC'}
          disabled={disabled}
          onCommit={saveCron}
        />
      )}
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

type Frequency = 'daily' | 'weekly' | 'custom';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** A cron the preset rows can express: on the hour, every day or one weekday. */
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

/**
 * The schedule as rows: how often, which day, what time, or a cron expression
 * for anything the presets cannot say. The stored value is always a cron.
 */
function ScheduleRows({
  cron,
  timezone,
  disabled,
  onCommit,
}: {
  cron: string;
  timezone: string;
  disabled: boolean;
  onCommit: (cron: string) => Promise<unknown>;
}) {
  const preset = parsePreset(cron);
  const [custom, setCustom] = useState(preset === null);
  const frequency: Frequency = custom || preset === null ? 'custom' : preset.frequency;
  const hour = preset?.hour ?? 3;
  const day = preset?.day ?? 1;

  const pick = (next: Frequency) => {
    if (next === 'custom') {
      setCustom(true);
      return;
    }
    setCustom(false);
    void onCommit(presetCron(next, hour, day));
  };

  return (
    <>
      <SettingsRow label="Frequency" description="How often the template rebuilds when a repository head moved.">
        <Select value={frequency} onValueChange={next => pick(next as Frequency)} disabled={disabled}>
          <SelectTrigger size="sm" aria-label="Build frequency" className="w-auto">
            {frequency === 'daily' ? 'Daily' : frequency === 'weekly' ? 'Weekly' : 'Custom'}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </SettingsRow>
      {frequency === 'weekly' && (
        <SettingsRow label="Day" description="Which day of the week.">
          <Select
            value={String(day)}
            onValueChange={next => void onCommit(presetCron('weekly', hour, Number(next)))}
            disabled={disabled}
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
        </SettingsRow>
      )}
      {frequency !== 'custom' && (
        <SettingsRow label="Time" description={`On the hour, ${timezone}.`}>
          <Select
            value={String(hour)}
            onValueChange={next => void onCommit(presetCron(frequency, Number(next), day))}
            disabled={disabled}
          >
            <SelectTrigger size="sm" aria-label="Build time" className="w-auto">
              {pad(hour)}
            </SelectTrigger>
            <SelectContent>
              {HOURS.map(value => (
                <SelectItem key={value} value={String(value)}>
                  {pad(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>
      )}
      {frequency === 'custom' && (
        <SettingsRow label="Cron expression" description={`Five fields, ${timezone}.`}>
          <div className="w-full lg:max-w-96">
            <CommittedInput
              label="Build schedule cron"
              value={cron}
              placeholder={DEFAULT_CRON}
              disabled={disabled}
              onCommit={next => {
                if (!next) {
                  toast.error('Enter a cron expression');
                  return Promise.reject(new Error('cron is required'));
                }
                return onCommit(next);
              }}
            />
          </div>
        </SettingsRow>
      )}
    </>
  );
}
