import { ChevronRight, X } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { useState } from 'react';

import { CodeBlock } from '../../CodeBlock';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../Collapsible';
import { CopyButton } from '../../CopyButton';
import { Shimmer } from '../../Shimmer';
import { Txt } from '../../Txt';
import { highlightCode, languageForPath } from './tool-call-highlight';
import { presentTool } from './tool-presentation';
import { cn } from '@/lib/utils';

export type ToolCallStatus = 'running' | 'success' | 'error';

export interface ToolCallProps extends HTMLAttributes<HTMLDivElement> {
  toolName: string;
  input?: unknown;
  result?: unknown;
  output?: string;
  status: ToolCallStatus;
  defaultOpen?: boolean;
  headerActions?: ReactNode;
  children?: ReactNode;
}

const ROW_TRIGGER = 'group/row hover:bg-neutral6/5 w-full cursor-pointer rounded-md text-left transition-colors';

const ROW_RAIL =
  "relative ml-[14px] max-w-full min-w-0 py-1.5 pr-1 pl-4 before:bg-border1 before:absolute before:inset-y-0 before:left-0 before:w-px before:content-[''] before:mask-b-from-[calc(100%-min(40%,80px))]";

const ROW_LINE = 'flex w-full min-w-0 items-center gap-2 px-1.5 py-1';

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) + '…' : value;
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

// CSI/OSC escape sequences emitted by terminal tools.
// eslint-disable-next-line no-control-regex
const ANSI_RE =
  /[\u001b\u009b][[\]()#;?]*(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007|(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~])/g;
const ESCAPED_ANSI_RE = /\\u001[bB]\[[0-9;]*[a-zA-Z]/g;

function stripSerializedAnsi(value: string): string {
  return value.replace(ANSI_RE, '').replace(ESCAPED_ANSI_RE, '');
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'text-icon3 flex shrink-0 items-center transition duration-150 group-hover/row:opacity-100 group-focus-visible/row:opacity-100',
        expanded ? 'rotate-90' : 'opacity-0',
      )}
    >
      <ChevronRight size={13} />
    </span>
  );
}

interface ToolRowProps {
  icon: ReactNode;
  label: string;
  detail?: string;
  running: boolean;
  expanded: boolean;
  failed: boolean;
}

function ToolRow({ icon, label, detail, running, expanded, failed }: ToolRowProps) {
  const Line = running ? Shimmer : 'span';

  return (
    <Line className={ROW_LINE}>
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      <Txt as="span" variant="ui-sm" className="text-icon3 max-w-[55%] shrink-0 truncate">
        {label}
      </Txt>
      {detail !== undefined && (
        <Txt as="span" variant="ui-xs" font="mono" className="text-icon3 min-w-0 truncate">
          {detail}
        </Txt>
      )}
      <span aria-hidden className="min-w-2 flex-1" />
      {failed && <X size={13} role="img" aria-label="Failed" className="text-error shrink-0" />}
      <span className="flex size-4 shrink-0 items-center justify-center">
        <Chevron expanded={expanded} />
      </span>
    </Line>
  );
}

function MonoBlock({ copyText, className, children }: { copyText: string; className?: string; children: ReactNode }) {
  return (
    <div className="group/block relative max-w-full min-w-0">
      <pre
        className={cn(
          'm-0 max-h-60 max-w-full overflow-auto rounded-md bg-surface1 px-3 py-2 font-mono text-xs leading-normal break-words whitespace-pre-wrap',
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

function boundedLines(value: string): { lines: string[]; hidden: number } {
  const lines = value.split('\n');
  return { lines: lines.slice(0, DIFF_MAX_LINES), hidden: Math.max(0, lines.length - DIFF_MAX_LINES) };
}

function DiffSide({ lines, side, lang }: { lines: string[]; side: keyof typeof DIFF_SIDES; lang: string | undefined }) {
  const { sign, row, gutter } = DIFF_SIDES[side];
  return (
    <>
      {lines.map((line, index) => (
        <div key={index} className={cn('flex whitespace-pre', row)}>
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

interface EditInput {
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

function editInput(toolName: string, input: unknown): EditInput | undefined {
  const edit = {
    path: stringProperty(input, 'path'),
    old_string: stringProperty(input, 'old_string'),
    new_string: stringProperty(input, 'new_string'),
    content: stringProperty(input, 'content'),
  };
  const isReplace = /string_replace|str_replace|edit_file/i.test(toolName) && edit.new_string !== undefined;
  const isWrite = /write_file|create_file/i.test(toolName) && edit.content !== undefined;
  return isReplace || isWrite ? edit : undefined;
}

function ToolBody({
  toolName,
  input,
  result,
  output,
  status,
  command,
  children,
}: Pick<ToolCallProps, 'toolName' | 'input' | 'result' | 'output' | 'status' | 'children'> & {
  command?: string;
}) {
  const edit = editInput(toolName, input);
  const resultText = status !== 'running' && result !== undefined ? stripSerializedAnsi(stringify(result)) : undefined;

  if (edit) {
    return (
      <>
        {edit.new_string !== undefined ? (
          <DiffView oldText={edit.old_string ?? ''} newText={edit.new_string} path={edit.path} />
        ) : (
          <CodeBlock
            code={truncate(edit.content ?? '', 2000)}
            lang={languageForPath(edit.path)}
            fileName={edit.path ?? 'Change'}
            overflow="scroll"
          />
        )}
        {status === 'error' && resultText !== undefined && (
          <MonoBlock copyText={resultText} className="text-error/90">
            {truncate(resultText, 800)}
          </MonoBlock>
        )}
        {children}
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
        {output !== undefined ? (
          <MonoBlock copyText={output} className="text-icon3">
            {output}
          </MonoBlock>
        ) : (
          resultText !== undefined && (
            <MonoBlock copyText={resultText} className="text-icon3">
              {truncate(resultText, 800)}
            </MonoBlock>
          )
        )}
        {children}
      </>
    );
  }

  const inputText = input !== undefined ? stringify(input) : undefined;
  return (
    <>
      {inputText !== undefined && (
        <MonoBlock copyText={inputText} className="text-icon5">
          {inputText}
        </MonoBlock>
      )}
      {output !== undefined && (
        <MonoBlock copyText={output} className="text-icon3">
          {output}
        </MonoBlock>
      )}
      {resultText !== undefined && (
        <MonoBlock copyText={resultText} className="text-icon3">
          {truncate(resultText, 800)}
        </MonoBlock>
      )}
      {children}
    </>
  );
}

export function ToolCall({
  toolName,
  input,
  result,
  output,
  status,
  defaultOpen = false,
  headerActions,
  children,
  className,
  role = 'group',
  'aria-label': ariaLabel,
  ...props
}: ToolCallProps) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const [arrivedLive] = useState(() => status === 'running');
  const { icon: Icon, label, detail, command } = presentTool(toolName, input);
  const failed = status === 'error';

  const trigger = (
    <CollapsibleTrigger className={ROW_TRIGGER}>
      <ToolRow
        icon={<Icon size={14} strokeWidth={1.75} aria-hidden className={failed ? 'text-error/80' : 'text-icon2'} />}
        label={label}
        detail={detail}
        running={status === 'running'}
        expanded={expanded}
        failed={failed}
      />
    </CollapsibleTrigger>
  );

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className={cn(
        'max-w-full min-w-0',
        arrivedLive && 'fade-in-0 slide-in-from-bottom-1 motion-safe:animate-in',
        className,
      )}
      role={role}
      aria-label={ariaLabel ?? `Tool: ${toolName}`}
      aria-busy={status === 'running'}
      {...props}
    >
      {headerActions ? (
        <div className="flex min-w-0 items-center gap-1">
          <div className="min-w-0 flex-1">{trigger}</div>
          <div className="flex shrink-0 items-center">{headerActions}</div>
        </div>
      ) : (
        trigger
      )}
      <CollapsibleContent className="max-w-full min-w-0">
        <div className={cn(ROW_RAIL, 'flex flex-col gap-1.5')}>
          <ToolBody toolName={toolName} input={input} result={result} output={output} status={status} command={command}>
            {children}
          </ToolBody>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
