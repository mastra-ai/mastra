import type { SpanInputMessage } from '@mastra/core/observability';
import { MessagesSquareIcon, ScrollTextIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { SpanRecord } from '../types';
import { SpanPayloadJson, SpanPayloadMessages } from './span-payload';
import { parseAvailableSkills } from './span-payload/available-skills';
import { getPromptChanges, touchesSystemPrompt } from './span-prompt-impact';
import { CollapsibleBox, useCollapsibleBox } from '@/ds/components/CollapsibleBox';
import { DiffStat } from '@/ds/components/DiffStat';
import { DisclosureChevron } from '@/ds/components/DisclosureChevron';
import { Metadata } from '@/ds/components/Metadata';
import { Txt } from '@/ds/components/Txt';
import { focusRing } from '@/ds/primitives/transitions';
import { formatCompactNumber } from '@/lib/cost';
import { pluralize } from '@/lib/string';
import { cn } from '@/lib/utils';

type Change = Exclude<ReturnType<typeof getPromptChanges>[number], null | undefined>;

const COLLAPSED_HEIGHT = 160;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const countOf = (change: Change) => change.count ?? (change.message !== undefined ? 1 : (change.ids?.length ?? 1));

const isRemoval = (change: Change) => change.type === 'removeByIds' || change.type === 'clear';

function textOf(message: unknown): string {
  if (typeof message === 'string') return message;
  if (!isRecord(message)) return '';
  const { content } = message;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map(part => (typeof part === 'string' ? part : isRecord(part) && typeof part.text === 'string' ? part.text : ''))
    .join('\n');
}

function describeMessage(message: unknown): { title: string; meta: ReactNode } {
  const text = textOf(message);
  const size = `${formatCompactNumber(text.length)} chars`;
  const catalog = parseAvailableSkills(text);
  if (catalog && !catalog.before.trim() && !catalog.after.trim()) {
    return {
      title: 'Skills catalog',
      meta: (
        <Metadata>
          <Metadata.Item>{pluralize(catalog.skills.length, 'skill')}</Metadata.Item>
          <Metadata.Item>{size}</Metadata.Item>
        </Metadata>
      ),
    };
  }
  const firstLine = text
    .split('\n')
    .map(line => line.trim().replace(/^#+\s*/, ''))
    .find(Boolean);
  return { title: firstLine ?? 'Empty message', meta: size };
}

function describeCountOnly(change: Change): string {
  const what = pluralize(countOf(change), 'message');
  const { type, source } = change;
  if (type === 'clear') {
    if (source === 'input') return `${what} from this turn's input`;
    if (source === 'response') return `${what} from the model's response`;
    return `The whole conversation (${what})`;
  }
  if (source === 'memory') return `${what} from memory`;
  if (source === 'input') return `${what} in this turn's input`;
  if (source === 'response') return `${what} in the model's response`;
  if (source === 'context') return `${what} of context`;
  return what;
}

function mergeCountOnly(changes: readonly Change[]): Change[] {
  const merged: Change[] = [];
  for (const change of changes) {
    const previous = merged.at(-1);
    if (previous && isCountOnly(previous) && isCountOnly(change) && sameKind(previous, change)) {
      merged[merged.length - 1] = { ...previous, count: countOf(previous) + countOf(change) };
      continue;
    }
    merged.push(change);
  }
  return merged;
}

const isCountOnly = (change: Change) => change.message === undefined && !(change.ids && change.ids.length > 0);
const sameKind = (a: Change, b: Change) => a.type === b.type && a.source === b.source && a.tag === b.tag;

const isMessage = (value: unknown): value is SpanInputMessage => isRecord(value) && typeof value.role === 'string';

function keptSystemMessages(span: SpanRecord, changes: readonly Change[]): SpanInputMessage[] {
  const before =
    isRecord(span.input) && Array.isArray(span.input.systemMessages) ? span.input.systemMessages.filter(isMessage) : [];
  const removed = new Set(changes.filter(isRemoval).map(change => JSON.stringify(change.message)));
  return before.filter(message => !removed.has(JSON.stringify(message)));
}

type Sign = '+' | '−' | ' ';

const SIGN_LABEL: Record<Sign, string> = { '+': 'Added: ', '−': 'Removed: ', ' ': 'Unchanged: ' };

function DiffRow({
  sign,
  title,
  meta,
  defaultOpen = sign !== ' ',
  children,
}: {
  sign: Sign;
  title: ReactNode;
  meta?: ReactNode;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expandable = children !== undefined;

  const header = (
    <>
      <Txt
        as="span"
        aria-hidden
        variant="body-sm"
        font="mono"
        className={cn(
          'w-3 shrink-0 text-center',
          sign === '+' && 'text-success-indicator',
          sign === '−' && 'text-destructive-foreground',
        )}
      >
        {sign}
      </Txt>
      <Txt as="span" variant="body-sm" tone={sign === ' ' ? 'muted' : 'ink'} className="min-w-0 truncate">
        <span className="sr-only">{SIGN_LABEL[sign]}</span>
        {title}
      </Txt>
      {meta && (
        <Txt as="span" variant="meta" tone="faint" className="ml-auto shrink-0 tabular-nums">
          {meta}
        </Txt>
      )}
      {expandable && <DisclosureChevron open={open} className={cn('size-3 shrink-0', !meta && 'ml-auto')} />}
    </>
  );

  return (
    <li
      data-sign={sign === ' ' ? 'kept' : sign === '+' ? 'added' : 'removed'}
      className={cn(
        'min-w-0 border-l-2',
        sign === '+' && 'border-success-edge bg-success-subtle',
        sign === '−' && 'border-destructive-edge bg-destructive-subtle',
        sign === ' ' && 'border-transparent',
      )}
    >
      {expandable ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(current => !current)}
          className={cn(
            'flex w-full min-w-0 items-center gap-2 py-2 pr-3 pl-2.5 text-left hover:bg-fill-subtle',
            focusRing,
          )}
        >
          {header}
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-2 py-2 pr-3 pl-2.5">{header}</div>
      )}
      {expandable && open && <div className="min-w-0 pr-3 pb-3 pl-7.5">{children}</div>}
    </li>
  );
}

function Clipped({ children }: { children: ReactNode }) {
  const box = useCollapsibleBox({ collapsedHeight: COLLAPSED_HEIGHT });
  return (
    <CollapsibleBox state={box} expandLabel="Show all">
      {children}
    </CollapsibleBox>
  );
}

function MessageRow({ sign, message, tag }: { sign: Sign; message: SpanInputMessage; tag?: string }) {
  const { title, meta } = describeMessage(message);
  return (
    <DiffRow
      sign={sign}
      title={
        tag ? (
          <Metadata>
            <Metadata.Item>{title}</Metadata.Item>
            <Metadata.Item>{tag}</Metadata.Item>
          </Metadata>
        ) : (
          title
        )
      }
      meta={meta}
    >
      <Clipped>
        <SpanPayloadMessages value={[message]} />
      </Clipped>
    </DiffRow>
  );
}

function ChangeRow({ change }: { change: Change }) {
  const sign = isRemoval(change) ? '−' : '+';

  if (change.message !== undefined) return <MessageRow sign={sign} message={change.message} tag={change.tag} />;

  if (change.ids && change.ids.length > 0) {
    return (
      <DiffRow sign={sign} title={pluralize(change.ids.length, 'message')} meta="by id">
        <Clipped>
          <SpanPayloadJson value={change.ids} />
        </Clipped>
      </DiffRow>
    );
  }

  return <DiffRow sign={sign} title={describeCountOnly(change)} />;
}

function DiffCard({
  icon,
  title,
  changes,
  kept = [],
}: {
  icon: ReactNode;
  title: string;
  changes: Change[];
  kept?: SpanInputMessage[];
}) {
  const additions = changes.filter(change => !isRemoval(change)).reduce((sum, change) => sum + countOf(change), 0);
  const deletions = changes.filter(isRemoval).reduce((sum, change) => sum + countOf(change), 0);
  const summary = [
    additions > 0 && `${pluralize(additions, 'message')} added`,
    deletions > 0 && `${pluralize(deletions, 'message')} removed`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div data-slot="prompt-diff" className="min-w-0 overflow-clip rounded-md border border-border bg-card">
      <header className="flex min-w-0 flex-col gap-0.5 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="flex shrink-0 text-muted-foreground [&_svg]:size-4">
            {icon}
          </span>
          <Txt as="h4" variant="label" tone="ink" className="truncate">
            {title}
          </Txt>
          <Txt as="span" variant="meta" font="mono" className="ml-auto flex shrink-0 items-center gap-1.5">
            <DiffStat additions={additions} deletions={deletions} />
            <Txt as="span" variant="meta" tone="faint">
              {additions + deletions === 1 ? 'message' : 'messages'}
            </Txt>
          </Txt>
        </div>
        {/* Says in words what the +/− rows below mean, for anyone reading a prompt diff for the first time. */}
        <Txt as="p" variant="body-sm" tone="muted" className="pl-6">
          Changed by this processor: {summary}
        </Txt>
      </header>
      <ol className="flex min-w-0 list-none flex-col divide-y divide-border">
        {kept.map((message, index) => (
          <MessageRow key={`kept-${index}`} sign=" " message={message} />
        ))}
        {changes.map((change, index) => (
          <ChangeRow key={index} change={change} />
        ))}
      </ol>
    </div>
  );
}

export function SpanPromptChanges({ span }: { span: SpanRecord }) {
  const changes = mergeCountOnly(getPromptChanges(span).filter((change): change is Change => isRecord(change)));
  if (changes.length === 0) return null;

  const system = changes.filter(touchesSystemPrompt);
  const conversation = changes.filter(change => !touchesSystemPrompt(change));

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {system.length > 0 && (
        <DiffCard
          icon={<ScrollTextIcon />}
          title="System prompt"
          changes={system}
          kept={keptSystemMessages(span, system)}
        />
      )}
      {conversation.length > 0 && (
        <DiffCard icon={<MessagesSquareIcon />} title="Conversation" changes={conversation} />
      )}
    </div>
  );
}
