import { createContext, useContext } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import type { Components, ExtraProps } from 'react-markdown';
import { KnowledgePageLink } from '../../knowledge/knowledge-links';
import { isRecord } from '../../messages/signal-data';
import type { BodyExtent } from './knowledge-body-range';
import { readExtent, writeExtent } from './knowledge-body-range';
import type { MessageMetadata } from '@/domains/chat';
import type { ToolApprovalRequest } from '@/domains/chat/tools/badges/tool-approval-badge';
import { ToolApprovalBadge } from '@/domains/chat/tools/badges/tool-approval-badge';
import { KNOWLEDGE_REF_PROPERTY, remarkKnowledgeLinks } from '@/domains/knowledge/lib/remarkKnowledgeLinks';
import type { ActivityStatus } from '@/ds/components/ai/activity';
import { presentTool, ToolCallOutput } from '@/ds/components/ai/tool-call';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { Metadata } from '@/ds/components/Metadata';
import { Txt } from '@/ds/components/Txt';

/** The tools `Knowledge.createTools()` gives an agent. */
export const KNOWLEDGE_TOOLS = new Set([
  'knowledge_search',
  'knowledge_read',
  'knowledge_page',
  'knowledge_note',
  'knowledge_pin',
  'knowledge_list',
]);

interface PageSummary {
  id: string;
  name: string;
  address?: string;
  scope?: string;
  /** The full readable ref (`docs:mastra#observability/logging`); older cores send only the last `key`. */
  ref?: string;
  key?: string;
  description?: string;
  version?: number;
  body?: string;
}

interface NoteSummary {
  id: string;
  text: string;
  author?: string;
  page?: PageSummary;
  /** Which `[[ref]]` in `text` links to which page id; refs the server couldn't resolve aren't here. */
  mentions?: Record<string, string>;
}

const str = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined);

function asPage(value: unknown): PageSummary | undefined {
  if (!isRecord(value) || !str(value.id) || typeof value.name !== 'string') return undefined;
  return value as unknown as PageSummary;
}

function asNotes(value: unknown): NoteSummary[] {
  return Array.isArray(value)
    ? value.filter((note): note is NoteSummary => isRecord(note) && typeof note.text === 'string')
    : [];
}

/** The collapsed row's detail: the page name, then which part of it was read or written. */
const withExtent = (name: string, extent: BodyExtent | undefined) => (extent?.row ? `${name}: ${extent.row}` : name);

/** The numbered lines of a part read: a window, or each match, under the range it covers. */
function ReadLines({ page }: { page: unknown }) {
  if (!isRecord(page)) return null;
  const parts = Array.isArray(page.matches)
    ? page.matches.filter(isRecord).map(match => str(match.lines))
    : [str(page.lines)];
  const lines = parts.filter((part): part is string => part !== undefined);
  if (!lines.length) return null;
  return (
    <Txt as="p" variant="meta" font="mono" className="whitespace-pre-wrap">
      {lines.join('\n⋯\n')}
    </Txt>
  );
}

const where = (page: PageSummary) => page.address ?? page.scope;

function PageLink({ page }: { page: PageSummary }) {
  return <KnowledgePageLink pageId={page.id}>{page.name}</KnowledgePageLink>;
}

function Meta({ children }: { children: ReactNode }) {
  return (
    <Txt as="span" variant="meta" tone="muted" className="truncate">
      {children}
    </Txt>
  );
}

function PageLine({ page, linked = true }: { page: PageSummary; linked?: boolean }) {
  const scope = where(page);
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <Txt as="span" variant="label">
        {linked ? <PageLink page={page} /> : page.name}
      </Txt>
      {page.ref ? <Meta>{page.ref}</Meta> : scope ? <Meta>{page.key ? `${scope}#${page.key}` : scope}</Meta> : null}
    </div>
  );
}

const MENTION_LINK_CLASS = 'text-foreground underline decoration-dotted underline-offset-2 hover:decoration-solid';

/** Which page id each `[[ref]]` a card shows answers to, as far as this tool result says. */
type RefIds = ReadonlyMap<string, string>;

/**
 * The refs a tool result resolves: the page's own id and ref, and every ref a note in the result
 * mentions (the server resolved those to page ids). A page body's links usually reappear in a note's
 * mentions; any that don't stay plain, since a chat has no page store to look them up in.
 */
function resultRefIds(page: PageSummary | undefined, notes: NoteSummary[]): RefIds {
  const ids = new Map<string, string>();
  if (page) {
    ids.set(page.id, page.id);
    if (page.ref) ids.set(page.ref, page.id);
  }
  for (const note of notes) {
    if (!isRecord(note.mentions)) continue;
    for (const [ref, id] of Object.entries(note.mentions)) {
      if (typeof id === 'string' && id) ids.set(ref, id);
    }
  }
  return ids;
}

const BodyRefs = createContext<RefIds>(new Map());

/** A `[[ref]]` in a card body: a link when the result resolves it, the ref as quiet text when not. */
function BodyRef({ node, ...props }: ComponentProps<'span'> & ExtraProps) {
  const refIds = useContext(BodyRefs);
  const raw = node?.properties[KNOWLEDGE_REF_PROPERTY];
  if (typeof raw !== 'string') return <span {...props} />;
  const ref = raw.trim();
  const pageId = refIds.get(ref);
  return pageId ? (
    <KnowledgePageLink pageId={pageId} className={MENTION_LINK_CLASS}>
      {ref}
    </KnowledgePageLink>
  ) : (
    <span className="text-foreground" data-testid="knowledge-unresolved-mention">
      {ref}
    </span>
  );
}

const BODY_REMARK_PLUGINS = [remarkKnowledgeLinks];
const BODY_COMPONENTS: Components = { span: BodyRef };

function Body({ markdown, refIds = new Map() }: { markdown: string; refIds?: RefIds }) {
  return (
    <div className="border-border1 max-h-64 overflow-auto rounded-md border p-2" data-testid="knowledge-tool-body">
      <BodyRefs.Provider value={refIds}>
        <MarkdownRenderer remarkPlugins={BODY_REMARK_PLUGINS} components={BODY_COMPONENTS}>
          {markdown}
        </MarkdownRenderer>
      </BodyRefs.Provider>
    </div>
  );
}

const MENTION = /\[\[([^\]]+)\]\]/g;

/** A note's text with each resolved `[[Page Name]]` linking to its page; unresolved names stay plain. */
function NoteText({ note }: { note: NoteSummary }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of note.text.matchAll(MENTION)) {
    const ref = (match[1] ?? '').trim();
    // Own string values only: `[[constructor]]` must not read Object.prototype.
    const mentioned = note.mentions && Object.hasOwn(note.mentions, ref) ? note.mentions[ref] : undefined;
    const pageId = typeof mentioned === 'string' ? mentioned : undefined;
    parts.push(note.text.slice(last, match.index));
    parts.push(
      pageId ? (
        <KnowledgePageLink key={match.index} pageId={pageId} className={MENTION_LINK_CLASS}>
          {ref}
        </KnowledgePageLink>
      ) : (
        <span key={match.index} className="text-foreground" data-testid="knowledge-unresolved-mention">
          {ref}
        </span>
      ),
    );
    last = match.index + match[0].length;
  }
  parts.push(note.text.slice(last));
  return <>{parts}</>;
}

function NoteList({ notes }: { notes: NoteSummary[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {notes.map(note => (
        <li key={note.id} className="flex flex-col">
          <Txt as="span" variant="body">
            <NoteText note={note} />
          </Txt>
          {note.page || note.author ? (
            <Meta>
              <Metadata singleLine>
                {note.page && (
                  <Metadata.Item>
                    <PageLink page={note.page} />
                  </Metadata.Item>
                )}
                {note.author && <Metadata.Item className="shrink-0">{note.author}</Metadata.Item>}
              </Metadata>
            </Meta>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** One entry of a `knowledge_list` result: a page or scope at some depth below the starting point. */
interface ListEntry {
  ref: string;
  name: string;
  description?: string;
  depth: number;
  children: number;
  scope?: boolean;
}

function asListEntry(value: unknown): ListEntry | undefined {
  if (!isRecord(value) || !str(value.ref) || typeof value.name !== 'string') return undefined;
  if (typeof value.depth !== 'number' || typeof value.children !== 'number') return undefined;
  return value as unknown as ListEntry;
}

const DEPTH_INDENT = ['', 'pl-4', 'pl-8'] as const;

/** A `knowledge_list` result as an indented tree: each name links to its page (scopes to their scope page), with its ref and child count. */
function ListTree({ entries }: { entries: ListEntry[] }) {
  return (
    <ul className="flex max-h-64 flex-col gap-1 overflow-auto" data-testid="knowledge-list-entries">
      {entries.map((entry, index) => (
        <li
          key={`${entry.ref}-${index}`}
          className={`flex min-w-0 flex-col ${DEPTH_INDENT[Math.min(Math.max(entry.depth, 1), 3) - 1]}`}
        >
          <div className="flex min-w-0 items-baseline gap-2">
            <Txt as="span" variant="label" className="truncate">
              <KnowledgePageLink pageRef={entry.ref}>{entry.name}</KnowledgePageLink>
            </Txt>
            {entry.ref !== entry.name ? <Meta>{entry.ref}</Meta> : null}
            {entry.children ? (
              <Meta>
                {entry.children} {entry.children === 1 ? 'child' : 'children'}
              </Meta>
            ) : null}
          </div>
          {entry.description ? <Meta>{entry.description}</Meta> : null}
        </li>
      ))}
    </ul>
  );
}

export interface KnowledgeCard {
  title: string;
  detail?: string;
  body: ReactNode;
}

const FAILED_TITLES: Record<string, string> = {
  knowledge_search: "Couldn't search Knowledge",
  knowledge_read: "Couldn't read",
  knowledge_page: "Couldn't change page",
  knowledge_note: "Couldn't change note",
  knowledge_pin: "Couldn't change pin",
};

/**
 * What each Knowledge tool's settled result says, or null when the shape isn't one we know.
 * A failed call (`errorText` set) gets a card naming what it tried and the error it got.
 */
export function knowledgeCard(
  toolName: string,
  input: unknown,
  output: unknown,
  errorText?: string,
): KnowledgeCard | null {
  const args = isRecord(input) ? input : {};
  const failedTitle = FAILED_TITLES[toolName];
  if (errorText !== undefined && failedTitle) {
    return {
      title: failedTitle,
      detail: str(args.page) ?? str(args.query),
      body: <ToolCallOutput text={errorText || 'The tool call failed.'} error data-testid="knowledge-tool-error" />,
    };
  }
  if (!isRecord(output)) return null;
  switch (toolName) {
    case 'knowledge_search': {
      if (!Array.isArray(output.results)) return null;
      const hits = output.results.filter(isRecord);
      return {
        title: 'Searched Knowledge',
        detail: str(args.query),
        body: hits.length ? (
          <ul className="flex flex-col gap-1.5">
            {hits.map((hit, index) => {
              const page = asPage(hit.page);
              const [note] = asNotes([hit.note]);
              return page ? (
                <li key={`${page.id}-${note?.id ?? index}`} className="flex flex-col">
                  <PageLine page={page} />
                  {note ? (
                    <Meta>
                      <NoteText note={note} />
                    </Meta>
                  ) : null}
                </li>
              ) : null;
            })}
          </ul>
        ) : (
          <Meta>No matches</Meta>
        ),
      };
    }
    case 'knowledge_read': {
      const page = asPage(output.page);
      if (!page) {
        if (!Array.isArray(output.scopes)) return null;
        const scopes = output.scopes.filter(isRecord);
        return {
          title: 'Listed Knowledge scopes',
          body: (
            <ul className="flex flex-col gap-1">
              {scopes.map(scope => (
                <li key={String(scope.address)}>
                  <Txt as="span" variant="body">
                    {String(scope.name)}
                  </Txt>{' '}
                  <Meta>{String(scope.address)}</Meta>
                </li>
              ))}
            </ul>
          ),
        };
      }
      const extent = readExtent(output, args);
      const notes = asNotes(output.notes);
      const children = Array.isArray(output.children)
        ? output.children.map(asPage).filter((child): child is PageSummary => child !== undefined)
        : [];
      const mentionedIn = asNotes(output.mentionedIn);
      const childScopes = Array.isArray(output.childScopes) ? output.childScopes.filter(isRecord) : [];
      return {
        title: 'Read',
        detail: withExtent(page.name, extent),
        body: (
          <div className="flex flex-col gap-2">
            <PageLine page={page} />
            {extent ? <Meta>{extent.summary}</Meta> : null}
            {page.description ? <Meta>{page.description}</Meta> : null}
            {page.body ? <Body markdown={page.body} refIds={resultRefIds(page, [...notes, ...mentionedIn])} /> : null}
            <ReadLines page={output.page} />
            {notes.length ? <NoteList notes={notes} /> : null}
            {children.length ? <Meta>Child pages: {children.map(child => child.name).join(', ')}</Meta> : null}
            {childScopes.length ? (
              <Meta>
                Child scopes:{' '}
                {childScopes
                  .map(scope =>
                    scope.address ? `${String(scope.name)} (${String(scope.address)})` : String(scope.name),
                  )
                  .join(', ')}
              </Meta>
            ) : null}
            {mentionedIn.length ? (
              <div className="flex flex-col gap-1">
                <Meta>Mentioned in</Meta>
                <NoteList notes={mentionedIn} />
              </div>
            ) : null}
          </div>
        ),
      };
    }
    case 'knowledge_page': {
      const page = asPage(output.page);
      if (!page) return null;
      const op = str(args.op);
      if (op === 'delete') {
        // The page no longer exists, so name it without a link.
        return { title: 'Deleted page', detail: page.name, body: <PageLine page={page} linked={false} /> };
      }
      const title =
        op === 'move' ? 'Moved page' : op === 'merge' ? 'Merged page' : args.page ? 'Updated page' : 'Created page';
      const body = str(args.body);
      const description = str(args.description);
      const extent = writeExtent(args);
      return {
        title,
        detail: withExtent(page.name, extent),
        body: (
          <div className="flex flex-col gap-2">
            <PageLine page={page} />
            {extent ? <Meta>{extent.summary}</Meta> : null}
            {op === 'merge' && str(args.page) ? <Meta>Merged {str(args.page)} into this page</Meta> : null}
            {typeof page.version === 'number' ? <Meta>Version {page.version}</Meta> : null}
            {description ? <Meta>{description}</Meta> : null}
            {body ? <Body markdown={body} refIds={resultRefIds(page, [])} /> : null}
          </div>
        ),
      };
    }
    case 'knowledge_note': {
      if (str(output.removed)) return { title: 'Removed note', body: <Meta>Note {String(output.removed)}</Meta> };
      const [note] = asNotes([output.note]);
      if (!note) return null;
      const pageRef = str(args.page);
      const pageId = str(output.page);
      return {
        title: str(args.op) === 'restamp' ? 'Restamped note' : 'Added note',
        detail: pageRef,
        body: (
          <div className="flex flex-col gap-1">
            <Txt as="span" variant="body">
              <NoteText note={note} />
            </Txt>
            {pageId ? (
              <Meta>
                On <PageLink page={{ id: pageId, name: pageRef ?? 'the page' }} />
              </Meta>
            ) : null}
          </div>
        ),
      };
    }
    case 'knowledge_pin': {
      const pageId = str(output.page);
      if (!pageId || !Array.isArray(output.audience)) return null;
      const pageRef = str(args.page);
      const audience = output.audience.filter((entry): entry is string => typeof entry === 'string');
      return {
        title: str(args.op) === 'unpin' ? 'Unpinned page' : 'Pinned page',
        detail: pageRef,
        body: (
          <div className="flex flex-col gap-1">
            <Meta>
              <PageLink page={{ id: pageId, name: pageRef ?? 'the page' }} />
            </Meta>
            <Meta>{audience.length ? `Pinned for ${audience.join(', ')}` : 'No longer pinned for anyone'}</Meta>
          </div>
        ),
      };
    }
    case 'knowledge_list': {
      if (!Array.isArray(output.entries)) return null;
      const entries = output.entries.map(asListEntry).filter((entry): entry is ListEntry => entry !== undefined);
      const from = str(args.from);
      const more = str(output.nextCursor) || output.more !== undefined;
      return {
        title: from ? 'Listed pages' : 'Listed Knowledge scopes',
        detail: from,
        body: (
          <div className="flex flex-col gap-2">
            {entries.length ? <ListTree entries={entries} /> : <Meta>{from ? 'No pages under it' : 'No scopes'}</Meta>}
            {more ? <Meta>More entries not shown</Meta> : null}
          </div>
        ),
      };
    }
    default:
      return null;
  }
}

export interface KnowledgeToolBadgeProps extends Omit<ToolApprovalRequest, 'toolCalled'> {
  card: KnowledgeCard;
  args: unknown;
  metadata?: MessageMetadata;
  status?: ActivityStatus;
}

export const KnowledgeToolBadge = ({
  card,
  args,
  toolName,
  metadata,
  toolCallId,
  toolApprovalMetadata,
  isNetwork,
  status = 'idle',
}: KnowledgeToolBadgeProps) => {
  const { icon: KnowledgeIcon } = presentTool(toolName, args);
  return (
    <ToolApprovalBadge
      approval={{
        toolCalled: true,
        toolCallId,
        toolApprovalMetadata,
        toolName,
        isNetwork,
        isGenerateMode: metadata?.mode === 'generate',
      }}
      data-testid="knowledge-tool-badge"
      icon={<KnowledgeIcon aria-hidden />}
      title={card.title}
      detail={card.detail}
      status={status}
    >
      {card.body}
    </ToolApprovalBadge>
  );
};
