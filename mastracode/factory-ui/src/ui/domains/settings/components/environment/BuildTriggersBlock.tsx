import { TriangleAlert } from 'lucide-react';
import type React from 'react';

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
          description={
            <span className="flex flex-col gap-2">
              <span>Rebuild when the interval has passed and a repository head moved.</span>
              {schedule.enabled && (
                <Knob text="Every" unit="hours (1 to 168)">
                  <CommittedInput
                    label="Schedule interval in hours"
                    type="number"
                    min={1}
                    max={168}
                    value={String(schedule.hours)}
                    disabled={disabled}
                    onCommit={raw => {
                      const hours = wholeNumber(raw, 1, 168);
                      return hours === undefined
                        ? Promise.resolve(false)
                        : onSave({ buildTriggers: { schedule: { hours } } });
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
            disabled={disabled}
            onCheckedChange={enabled => void onSave({ buildTriggers: { schedule: { enabled } } })}
          />
        </SettingsRow>
        <SettingsRow
          label="On push"
          description={
            <span className="flex flex-col gap-2">
              <span>Rebuild right after a push to a repository's base branch.</span>
              {pushSignal === 'none' && onPush.enabled && (
                <span role="alert" className="text-warning-foreground flex items-center gap-1.5">
                  <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
                  Pushes are not delivered to this Factory (no GitHub polling or webhook), so this trigger will not
                  fire.
                </span>
              )}
              {onPush.enabled && (
                <>
                  <Knob text="Then hold further pushes for" unit="minutes before building again (0 to 1440)">
                    <CommittedInput
                      label="Push debounce in minutes"
                      type="number"
                      min={0}
                      max={1440}
                      value={String(onPush.debounceMinutes)}
                      disabled={disabled}
                      onCommit={raw => {
                        const debounceMinutes = wholeNumber(raw, 0, 1440);
                        return debounceMinutes === undefined
                          ? Promise.resolve(false)
                          : onSave({ buildTriggers: { onPush: { debounceMinutes } } });
                      }}
                    />
                  </Knob>
                  <Knob text="At most" unit="builds per hour (1 to 60). Empty means unlimited.">
                    <CommittedInput
                      label="Max push builds per hour"
                      type="number"
                      min={1}
                      max={60}
                      placeholder="unlimited"
                      value={onPush.maxPerHour === null ? '' : String(onPush.maxPerHour)}
                      disabled={disabled}
                      onCommit={raw => {
                        if (raw === '') return onSave({ buildTriggers: { onPush: { maxPerHour: null } } });
                        const maxPerHour = wholeNumber(raw, 1, 60);
                        return maxPerHour === undefined
                          ? Promise.resolve(false)
                          : onSave({ buildTriggers: { onPush: { maxPerHour } } });
                      }}
                    />
                  </Knob>
                </>
              )}
            </span>
          }
        >
          <Switch
            aria-label="Rebuild on push"
            checked={onPush.enabled}
            disabled={disabled}
            onCheckedChange={enabled => void onSave({ buildTriggers: { onPush: { enabled } } })}
          />
        </SettingsRow>
      </SettingsContainer>
    </div>
  );
}

/** One inline setting under a trigger: a word, a small number input, a unit. */
function Knob({ text, unit, children }: { text: string; unit: string; children: React.ReactNode }) {
  return (
    <span className="text-foreground flex flex-wrap items-center gap-2">
      <span>{text}</span>
      <span className="w-24 [&_input]:text-right">{children}</span>
      <span>{unit}</span>
    </span>
  );
}
