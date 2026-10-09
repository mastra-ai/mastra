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
        <SettingsRow label="Schedule" description={`Cron expression, ${schedule.timezone ?? 'UTC'}.`}>
          <div className="w-full lg:max-w-96">
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
          </div>
        </SettingsRow>
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
