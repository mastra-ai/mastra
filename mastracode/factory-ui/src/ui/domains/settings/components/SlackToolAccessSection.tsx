import { Button } from '@mastra/playground-ui/components/Button';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxOption } from '@mastra/playground-ui/components/Combobox';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { X } from 'lucide-react';

import { useSaveSlackToolSettingsMutation, useSlackToolSettingsQuery } from '../../../../hooks/useSlackToolSettings';
import { SettingsRowsSkeleton } from '../../../ui/SettingsRowsSkeleton';
import type { SlackChannelOption, SlackToolSettings } from '../services/slackToolSettings';
import { SettingsSubsection } from './SettingsSubsection';

const CHANNEL_OPTIONS: Array<{ value: SlackToolSettings['channels']; label: string }> = [
  { value: 'session', label: "Only the session's own channel" },
  { value: 'selected', label: 'Its own channel and the ones below' },
  { value: 'all', label: 'Every channel the app is in' },
];

const ACCESS_OPTIONS: Array<{ value: SlackToolSettings['channelAccess']; label: string }> = [
  { value: 'post', label: 'Read and post' },
  { value: 'read', label: 'Read only' },
];

const DM_OPTIONS: Array<{ value: SlackToolSettings['directMessages']; label: string }> = [
  { value: 'none', label: 'No one' },
  { value: 'linked', label: 'People connected to this Factory' },
  { value: 'anyone', label: 'Anyone in the workspace' },
];

function ModeSelect<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <Select value={value} disabled={disabled} onValueChange={next => onChange(next)}>
      <SelectTrigger size="sm" aria-label={label} className="w-auto">
        <Txt as="span" variant="caption">
          {options.find(option => option.value === value)?.label}
        </Txt>
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function channelOption(channel: SlackChannelOption): ComboboxOption {
  return {
    value: channel.id,
    label: `#${channel.name}`,
    description: channel.isPrivate ? 'Private' : channel.appIsMember ? undefined : 'The app will join this channel',
    keywords: [channel.id],
  };
}

/** Factory-wide: what sessions started from Slack may read, post and DM. */
export function SlackToolAccessSection({ factoryId }: { factoryId: string }) {
  const query = useSlackToolSettingsQuery(factoryId);
  const save = useSaveSlackToolSettingsMutation(factoryId);

  const update = (settings: SlackToolSettings, join?: string) =>
    save.mutate(
      { settings, join },
      {
        onSuccess: () => toast.success('Saved Slack access'),
        onError: error => toast.error(error instanceof Error ? error.message : 'Failed to save Slack access'),
      },
    );

  if (query.isPending) {
    return (
      <SettingsSubsection scope="factory" title="What sessions can do in Slack">
        <SettingsContainer>
          <SettingsRowsSkeleton label="Loading Slack access" rows={3} />
        </SettingsContainer>
      </SettingsSubsection>
    );
  }
  if (query.error) {
    return (
      <Txt as="p" variant="caption" className="text-destructive-foreground">
        {query.error instanceof Error ? query.error.message : 'Failed to load Slack access'}
      </Txt>
    );
  }

  const { settings, channels, linked } = query.data;
  const pending = save.isPending;

  const byId = new Map(channels.map(channel => [channel.id, channel]));
  const chosen = settings.channelIds.map(id => byId.get(id) ?? { id, name: id, isPrivate: false, appIsMember: true });
  const addable = channels.filter(channel => !settings.channelIds.includes(channel.id)).map(channelOption);

  const addChannel = (id: string) => {
    const channel = byId.get(id);
    if (!channel || settings.channelIds.includes(id)) return;
    update({ ...settings, channelIds: [...settings.channelIds, id] }, channel.appIsMember ? undefined : id);
  };
  const removeChannel = (id: string) =>
    update({ ...settings, channelIds: settings.channelIds.filter(channelId => channelId !== id) });

  return (
    <SettingsSubsection
      scope="factory"
      title="What sessions can do in Slack"
      description="Applies to every session in this Factory that was started from Slack. Sessions act as the Slack app, so they only reach channels the app is in."
    >
      <SettingsContainer>
        <SettingsRow label="Channels" description="Where sessions can read messages.">
          <ModeSelect
            label="Channels"
            value={settings.channels}
            options={CHANNEL_OPTIONS}
            disabled={pending}
            onChange={channelsMode => update({ ...settings, channels: channelsMode })}
          />
        </SettingsRow>
        <SettingsRow label="Other channels" description="Sessions can always post in their own thread.">
          <ModeSelect
            label="Other channels"
            value={settings.channelAccess}
            options={ACCESS_OPTIONS}
            disabled={pending || settings.channels === 'session'}
            onChange={channelAccess => update({ ...settings, channelAccess })}
          />
        </SettingsRow>
        <SettingsRow label="Direct messages" description="Who sessions can send a direct message to.">
          <ModeSelect
            label="Direct messages"
            value={settings.directMessages}
            options={DM_OPTIONS}
            disabled={pending}
            onChange={directMessages => update({ ...settings, directMessages })}
          />
        </SettingsRow>
      </SettingsContainer>

      {settings.channels === 'selected' && (
        <SettingsContainer>
          <SettingsRow
            label="Chosen channels"
            description={
              linked
                ? 'Private channels show up once the app is in them: run /invite with the app in the channel.'
                : 'Connect your Slack account above to pick from the channels you are in.'
            }
          >
            {linked && (
              <Combobox
                aria-label="Add a channel"
                placeholder="Add a channel"
                searchPlaceholder="Search channels"
                emptyText="No matching channels"
                size="sm"
                options={addable}
                value=""
                disabled={pending}
                onValueChange={addChannel}
              />
            )}
          </SettingsRow>
          {chosen.length > 0 && (
            <ul aria-label="Channels sessions can use" className="flex flex-col">
              {chosen.map(channel => (
                <li key={channel.id} className="flex items-center gap-3 px-4 py-2">
                  <Txt as="span" variant="caption" className="min-w-0 flex-1 truncate">
                    #{channel.name}
                  </Txt>
                  {channel.isPrivate && (
                    <Txt as="span" variant="meta" tone="muted">
                      Private
                    </Txt>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove #${channel.name}`}
                    disabled={pending}
                    onClick={() => removeChannel(channel.id)}
                  >
                    <X aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SettingsContainer>
      )}
    </SettingsSubsection>
  );
}
