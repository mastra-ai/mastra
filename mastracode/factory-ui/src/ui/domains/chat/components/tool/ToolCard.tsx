import type { WebSearchLink } from '@mastra/core/tools/provider-web-search';
import { isWebSearchToolName, webSearchLinks } from '@mastra/core/tools/provider-web-search';
import { CodeBlock as DsCodeBlock } from '@mastra/playground-ui/components/CodeBlock';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { highlightCode, languageForPath } from '../../../../ui/highlight';
import { stripSerializedAnsi } from '../../services/ansi';
import type { ToolCall } from '../../services/transcript';
import { ROW_RAIL, ROW_TRIGGER, TranscriptRow } from '../TranscriptRow';
import { presentTool } from './tool-presentation';

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function stringify(v: unknown): string {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2) ?? String(v);
  } catch {
    return String(v);
  }
}

function MonoBlock({ copyText, className, children }: { copyText: string; className?: string; children: ReactNode }) {
  return (
    <div className="group/block relative max-w-full min-w-0">
      <pre
        className={cn(
          'bg-surface1 m-0 max-h-60 max-w-full overflow-auto rounded-md px-3 py-2 font-mono text-xs leading-normal break-words whitespace-pre-wrap',
          className,
        )}
      >
        {children}
      </pre>
      <CopyButton
        content={copyText}
        size="sm"
        variant="ghost"
        className="absolute top-1 right-1 opacity-0 transition-opacity group-hover/block:opacity-100"
      />
    </div>
  );
}

const DIFF_MAX_LINES = 200;

const DIFF_SIDES = {
  removed: { sign: '-', row: 'bg-error/10', gutter: 'text-error' },
  added: { sign: '+', row: 'bg-accent1/10', gutter: 'text-accent1' },
} as const;

function boundedLines(text: string): { lines: string[]; hidden: number } {
  const lines = text.split('\n');
  return { lines: lines.slice(0, DIFF_MAX_LINES), hidden: Math.max(0, lines.length - DIFF_MAX_LINES) };
}

function DiffSide({ lines, side, lang }: { lines: string[]; side: keyof typeof DIFF_SIDES; lang: string | undefined }) {
  const { sign, row, gutter } = DIFF_SIDES[side];
  return (
    <>
      {lines.map((line, i) => (
        <div key={i} className={cn('flex whitespace-pre', row)}>
          <span className={cn('w-5 shrink-0 text-center opacity-70 select-none', gutter)}>{sign}</span>
          <span
            className="text-icon6 [&_span]:font-inherit [&_span]:leading-inherit flex-1 pr-2.5 [&_span]:text-inherit dark:[&_span]:![background-color:var(--shiki-dark-bg)] dark:[&_span]:![color:var(--shiki-dark)]"
            dangerouslySetInnerHTML={{ __html: highlightCode(line, lang) || '&nbsp;' }}
          />
        </div>
      ))}
    </>
  );
}

function DiffView({ oldText, newText, path }: { oldText: string; newText: string; path?: string }) {
  const lang = languageForPath(path);
  const removed = boundedLines(oldText);
  const added = boundedLines(newText);
  const hidden = removed.hidden + added.hidden;
  return (
    <div
      className="border-border1 bg-surface1 max-w-full min-w-0 overflow-x-auto rounded-md border font-mono text-xs leading-normal"
      role="group"
      aria-label="File change"
    >
      <DiffSide lines={removed.lines} side="removed" lang={lang} />
      <DiffSide lines={added.lines} side="added" lang={lang} />
      {hidden > 0 && <div className="text-icon3 px-2.5 py-1 select-none">… {hidden} more lines</div>}
    </div>
  );
}

interface EditArgs {
  path?: string;
  old_string?: string;
  new_string?: string;
  content?: string;
}

function hasProperty<K extends string>(value: object, key: K): value is object & Record<K, unknown> {
  return key in value;
}

function stringProperty(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object' || !hasProperty(value, key)) return undefined;
  return typeof value[key] === 'string' ? value[key] : undefined;
}

/** Detect edit-style tools whose args are better shown as a diff/code block. */
function editArgs(toolName: string, args: unknown): EditArgs | undefined {
  const edit = {
    path: stringProperty(args, 'path'),
    old_string: stringProperty(args, 'old_string'),
    new_string: stringProperty(args, 'new_string'),
    content: stringProperty(args, 'content'),
  };
  const isReplace = /string_replace|str_replace|edit_file/i.test(toolName) && edit.new_string !== undefined;
  const isWrite = /write_file|create_file/i.test(toolName) && edit.content !== undefined;
  return isReplace || isWrite ? edit : undefined;
}

function WebPageLinks({ links }: { links: WebSearchLink[] }) {
  return (
    <ul className="flex min-w-0 flex-col gap-1.5">
      {links.map((link, index) => (
        <li key={`${link.url}#${index}`} className="min-w-0">
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="text-icon3 hover:text-icon5 flex min-w-0 flex-col transition-colors"
          >
            {link.title && (
              <Txt as="span" variant="ui-sm" className="truncate">
                {link.title}
              </Txt>
            )}
            <Txt as="span" variant="ui-xs" font="mono" className="truncate">
              {link.url}
            </Txt>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Provider-executed tools declare an empty input schema, so `{}` is noise, not an argument. */
function argsBlockText(tool: ToolCall): string | undefined {
  const text = tool.args !== undefined ? stringify(tool.args) : tool.argsText;
  return text && text !== '{}' ? text : undefined;
}

/** A component, not a string: a collapsed card never pays for serializing a large result. */
function ResultBlock({ result, className }: { result: unknown; className: string }) {
  const text = stripSerializedAnsi(stringify(result));
  return (
    <MonoBlock copyText={text} className={className}>
      {truncate(text, 800)}
    </MonoBlock>
  );
}

function toolBody(tool: ToolCall, command?: string): ReactNode {
  const edit = editArgs(tool.toolName, tool.args);
  const hasResult = tool.status !== 'running' && tool.result !== undefined;

  if (edit) {
    return (
      <>
        {edit.new_string !== undefined ? (
          <DiffView oldText={edit.old_string ?? ''} newText={edit.new_string} path={edit.path} />
        ) : (
          <DsCodeBlock
            code={truncate(edit.content ?? '', 2000)}
            lang={languageForPath(edit.path)}
            fileName={edit.path ?? 'Change'}
            overflow="scroll"
          />
        )}
        {tool.status === 'error' && hasResult && <ResultBlock result={tool.result} className="text-error/90" />}
      </>
    );
  }

  if (command) {
    return (
      <>
        <MonoBlock copyText={command} className="text-icon5">
          <span className="text-icon3 select-none">$ </span>
          {command}
        </MonoBlock>
        {tool.output ? (
          <MonoBlock copyText={tool.output} className="text-icon3">
            {tool.output}
          </MonoBlock>
        ) : (
          hasResult && <ResultBlock result={tool.result} className="text-icon3" />
        )}
      </>
    );
  }

  if (isWebSearchToolName(tool.toolName) && tool.status !== 'error') {
    const links = webSearchLinks(tool.result);
    if (links.length > 0) return <WebPageLinks links={links} />;
    return typeof tool.result === 'string' ? <ResultBlock result={tool.result} className="text-icon3" /> : null;
  }

  const argsPretty = argsBlockText(tool);
  if (!argsPretty && !tool.output && !hasResult) return null;
  return (
    <>
      {argsPretty && (
        <MonoBlock copyText={argsPretty} className="text-icon5">
          {argsPretty}
        </MonoBlock>
      )}
      {tool.output && (
        <MonoBlock copyText={tool.output} className="text-icon3">
          {tool.output}
        </MonoBlock>
      )}
      {hasResult && <ResultBlock result={tool.result} className="text-icon3" />}
    </>
  );
}

export function ToolCard({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const { icon: Icon, label, detail, command } = presentTool(tool);
  const body = toolBody(tool, command);
  const failed = tool.status === 'error';
  // A card already on screen when the transcript loaded was not just called.
  const [arrivedLive] = useState(() => tool.status === 'running');

  const card = {
    className: cn('max-w-full min-w-0', arrivedLive && 'motion-safe:animate-in fade-in-0 slide-in-from-bottom-1'),
    role: 'group',
    'aria-label': `Tool: ${tool.toolName}`,
    'aria-busy': tool.status === 'running',
  } as const;

  const row = (
    <TranscriptRow
      icon={<Icon size={14} strokeWidth={1.75} aria-hidden className={failed ? 'text-error/80' : 'text-icon2'} />}
      label={label}
      detail={detail}
      running={tool.status === 'running'}
      expanded={body ? expanded : undefined}
      trailing={failed && <X size={13} role="img" aria-label="Failed" className="text-error shrink-0" />}
    />
  );

  if (!body) return <div {...card}>{row}</div>;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} {...card}>
      <CollapsibleTrigger className={ROW_TRIGGER}>{row}</CollapsibleTrigger>
      <CollapsibleContent className="max-w-full min-w-0">
        <div className={cn(ROW_RAIL, 'flex flex-col gap-1.5')}>{body}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
