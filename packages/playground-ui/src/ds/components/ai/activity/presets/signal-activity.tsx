import {
  Activity,
  ActivityContent,
  ActivityDetail,
  ActivityDisclosure,
  ActivityHeader,
  ActivityIcon,
  ActivityItem,
  ActivityLabel,
  ActivityTrigger,
} from '../activity';
import type { ActivityAppearance } from '../activity';
import { messagePreview, messagePreviewShowsAll } from './message-preview';
import { agentGlyph } from '@/ds/components/AgentIndicator';
import { Badge } from '@/ds/components/Badge';
import { Txt } from '@/ds/components/Txt';

export interface SignalActivityProps {
  kind: 'state' | 'reactive' | 'reminder';
  label: string;
  message: string;
  detail?: string;
  mode?: string;
  defaultOpen?: boolean;
  /** `inline` reads like the agent's own lines: their glyph, type and weight, the message as prose. */
  appearance?: ActivityAppearance;
}

const signalKinds = {
  state: {
    Icon: agentGlyph('context'),
    accent: 'text-badge-purple-indicator',
    body: { variant: 'caption' },
  },
  reactive: {
    Icon: agentGlyph('notice'),
    accent: undefined,
    body: { variant: 'caption' },
  },
  reminder: {
    Icon: agentGlyph('notice'),
    accent: 'text-info-indicator',
    body: { variant: 'meta', font: 'mono' },
  },
} as const;

const spoken = (name: string) => name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]+/g, ' ');

function SignalLine({ kind, label, message, detail, mode, defaultOpen }: Omit<SignalActivityProps, 'appearance'>) {
  const { Icon } = signalKinds[kind];
  const name = spoken(label);
  const lineHoldsMessage = detail === undefined && messagePreviewShowsAll(message);

  return (
    <Activity
      appearance="inline"
      foldable={!lineHoldsMessage}
      defaultOpen={defaultOpen}
      data-signal-kind={kind}
      aria-label={`Signal: ${name}`}
    >
      <ActivityTrigger>
        <ActivityHeader>
          <ActivityIcon className="[&_svg]:size-4">
            <Icon />
          </ActivityIcon>
          <ActivityLabel className="text-body font-medium">{name}</ActivityLabel>
          {mode && <ActivityLabel className="-ml-1 text-body before:content-['·_']">{mode}</ActivityLabel>}
          {detail && (
            <ActivityDetail font="sans" className="text-body-sm">
              {detail}
            </ActivityDetail>
          )}
          {lineHoldsMessage && message && <ActivityLabel className="min-w-0 shrink text-body">{message}</ActivityLabel>}
          <ActivityDisclosure />
        </ActivityHeader>
      </ActivityTrigger>
      {!lineHoldsMessage && (
        <ActivityContent>
          <Txt tone="muted" className="break-words whitespace-pre-wrap">
            {message}
          </Txt>
        </ActivityContent>
      )}
    </Activity>
  );
}

export function SignalActivity({
  kind,
  label,
  message,
  detail,
  mode,
  defaultOpen,
  appearance = 'row',
}: SignalActivityProps) {
  if (appearance === 'inline') {
    return (
      <SignalLine kind={kind} label={label} message={message} detail={detail} mode={mode} defaultOpen={defaultOpen} />
    );
  }
  const { Icon, accent, body } = signalKinds[kind];
  const lineHoldsMessage = detail === undefined && messagePreviewShowsAll(message);

  return (
    <ActivityItem
      appearance={appearance}
      icon={<Icon className={accent} aria-hidden />}
      label={label}
      detail={detail ?? messagePreview(message)}
      badges={mode ? <Badge size="xs">{mode}</Badge> : undefined}
      defaultOpen={defaultOpen}
      data-signal-kind={kind}
      aria-label={`Signal: ${label}`}
    >
      {message && !lineHoldsMessage && (
        <>
          {detail && (
            <Txt variant="meta" font="mono" tone="muted" className="break-all">
              {detail}
            </Txt>
          )}
          <Txt {...body} className="break-words whitespace-pre-wrap">
            {message}
          </Txt>
        </>
      )}
    </ActivityItem>
  );
}
