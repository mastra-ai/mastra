import { Notice } from '@mastra/playground-ui/components/Notice';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import type {
  FactoryEnvironmentBuildTriggers,
  FactoryEnvironmentPushSignal,
} from '../../../workspaces/services/environment';
import { CommittedInput, wholeNumber, type SaveEnvironment } from './CommittedInput';

/**
 * When the template is rebuilt: on a schedule (only if a repository head moved),
 * after a push to a base branch (debounced and capped), and always after a
 * change to the environment itself.
 */
export function BuildTriggersBlock({
  triggers,
  pushSignal,
  disabled,
  onSave,
}: {
  triggers: FactoryEnvironmentBuildTriggers;
  pushSignal: FactoryEnvironmentPushSignal;
  disabled: boolean;
  onSave: SaveEnvironment;
}) {
  const { schedule, onPush } = triggers;

  return (
    <div className="flex flex-col gap-2">
      <Txt as="h3" variant="label">
        Build triggers
      </Txt>
      <Txt as="p" variant="meta" tone="muted">
        Changing resources, repositories or setup commands always starts a build. These triggers rebuild on top of that.
      </Txt>
      <SettingsContainer>
        <SettingsRow
          label="On a schedule"
          description="Rebuild when the interval has passed and a repository head moved."
        >
          <Switch
            aria-label="Rebuild on a schedule"
            checked={schedule.enabled}
            disabled={disabled}
            onCheckedChange={enabled => void onSave({ buildTriggers: { schedule: { enabled } } })}
          />
        </SettingsRow>
        <SettingsRow label="Interval" description="Hours between schedule checks (1 to 168).">
          <div className="w-full lg:max-w-32">
            <CommittedInput
              label="Schedule interval in hours"
              type="number"
              min={1}
              max={168}
              value={String(schedule.hours)}
              disabled={disabled || !schedule.enabled}
              onCommit={raw => {
                const hours = wholeNumber(raw, 1, 168);
                return hours === undefined
                  ? Promise.resolve(false)
                  : onSave({ buildTriggers: { schedule: { hours } } });
              }}
            />
          </div>
        </SettingsRow>
        <SettingsRow label="On push" description="Rebuild after a push to a repository's base branch.">
          <Switch
            aria-label="Rebuild on push"
            checked={onPush.enabled}
            disabled={disabled}
            onCheckedChange={enabled => void onSave({ buildTriggers: { onPush: { enabled } } })}
          />
        </SettingsRow>
        <SettingsRow label="Debounce" description="Minutes to wait after the last push before building (0 to 1440).">
          <div className="w-full lg:max-w-32">
            <CommittedInput
              label="Push debounce in minutes"
              type="number"
              min={0}
              max={1440}
              value={String(onPush.debounceMinutes)}
              disabled={disabled || !onPush.enabled}
              onCommit={raw => {
                const debounceMinutes = wholeNumber(raw, 0, 1440);
                return debounceMinutes === undefined
                  ? Promise.resolve(false)
                  : onSave({ buildTriggers: { onPush: { debounceMinutes } } });
              }}
            />
          </div>
        </SettingsRow>
        <SettingsRow
          label="Max builds per hour"
          description="Push-triggered builds per hour (1 to 60). Empty means unlimited."
        >
          <div className="w-full lg:max-w-32">
            <CommittedInput
              label="Max push builds per hour"
              type="number"
              min={1}
              max={60}
              placeholder="unlimited"
              value={onPush.maxPerHour === null ? '' : String(onPush.maxPerHour)}
              disabled={disabled || !onPush.enabled}
              onCommit={raw => {
                if (raw === '') return onSave({ buildTriggers: { onPush: { maxPerHour: null } } });
                const maxPerHour = wholeNumber(raw, 1, 60);
                return maxPerHour === undefined
                  ? Promise.resolve(false)
                  : onSave({ buildTriggers: { onPush: { maxPerHour } } });
              }}
            />
          </div>
        </SettingsRow>
      </SettingsContainer>
      {pushSignal === 'none' && onPush.enabled && (
        <Notice variant="warning">
          Pushes are not delivered to this Factory (no GitHub polling or webhook), so this trigger will not fire.
        </Notice>
      )}
    </div>
  );
}
