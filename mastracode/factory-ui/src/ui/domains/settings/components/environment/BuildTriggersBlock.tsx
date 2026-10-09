import type React from 'react';

import { Notice } from '@mastra/playground-ui/components/Notice';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import type { FactoryEnvironmentBuildTriggers } from '../../../workspaces/services/environment';
import { CommittedInput, type SaveEnvironment } from './CommittedInput';

const DEFAULT_CRON = '0 3 * * *';

/**
 * When the template is rebuilt on its own: on a cron schedule and after a
 * push to a repository's default branch (debounced). Changing a setting always
 * starts a build regardless.
 */
export function BuildTriggersBlock({
  triggers,
  disabled,
  onSave,
}: {
  triggers: FactoryEnvironmentBuildTriggers;
  disabled: boolean;
  onSave: SaveEnvironment;
}) {
  const { schedule, push } = triggers;

  return (
    <div className="flex flex-col gap-2">
      {!schedule.scheduleAvailable && (
        <Notice variant="info">
          Scheduled builds need a storage adapter with schedules. Build now and push builds still work.
        </Notice>
      )}
      <SettingsContainer>
        <SettingsRow
          label="On a schedule"
          description={
            <span className="flex flex-col gap-2">
              <span>Rebuild on a cron schedule when a repository head moved.</span>
              {schedule.enabled && (
                <Knob text="Cron" unit={schedule.timezone ?? 'UTC'}>
                  <CommittedInput
                    label="Build schedule cron"
                    value={schedule.cron ?? ''}
                    placeholder={DEFAULT_CRON}
                    disabled={disabled}
                    onCommit={cron => {
                      if (!cron) {
                        toast.error('Enter a cron expression');
                        return Promise.reject(new Error('cron is required'));
                      }
                      return onSave({ buildTriggers: { schedule: { enabled: true, cron } } });
                    }}
                  />
                </Knob>
              )}
            </span>
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
        <SettingsRow
          label="On push"
          description={
            <span className="flex flex-col gap-2">
              <span>Rebuild after a push to a repository's default branch.</span>
              {push.enabled && (
                <Knob text="Wait" unit="minutes after the last build attempt (0 to 1440)">
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
                </Knob>
              )}
            </span>
          }
        >
          <Switch
            aria-label="Rebuild on push"
            checked={push.enabled}
            disabled={disabled}
            onCheckedChange={enabled => void onSave({ buildTriggers: { push: { enabled } } })}
          />
        </SettingsRow>
      </SettingsContainer>
    </div>
  );
}

/** One inline setting under a trigger: a word, a small input, a unit. */
function Knob({ text, unit, children }: { text: string; unit: string; children: React.ReactNode }) {
  return (
    <span className="text-foreground flex flex-wrap items-center gap-2">
      <span>{text}</span>
      <span className="w-32">{children}</span>
      <span>{unit}</span>
    </span>
  );
}
