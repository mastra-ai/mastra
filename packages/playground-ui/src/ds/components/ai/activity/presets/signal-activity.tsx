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
import { humanize } from '@/lib/string';

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

function SignalLine({ kind, label, message, detail, mode, defaultOpen }: Omit<SignalActivityProps, 'appearance'>) {
  const { Icon } = signalKinds[kind];
  const name = humanize(label);
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
          {detail && <ActivityDetail className="text-body-sm">{detail}</ActivityDetail>}
          {lineHoldsMessage && message && (
            <ActivityLabel wrap className="text-body">
              {message}
            </ActivityLabel>
          )}
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

export function SignalActivity({ appearance = 'row', ...signal }: SignalActivityProps) {
  if (appearance === 'inline') return <SignalLine {...signal} />;
  const { kind, label, message, detail, mode, defaultOpen } = signal;
  const { Icon, accent, body } = signalKinds[kind];
  const lineHoldsMessage = detail === undefined && messagePreviewShowsAll(message);

  return (
    <ActivityItem
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
