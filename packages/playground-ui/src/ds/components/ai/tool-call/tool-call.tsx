import { ChevronRight, X } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

import { Card } from '../../Card';
import { Code } from '../../Code';
import { HighlightedTokenLine } from '../../Code/highlighted-code';
import { useHighlightedCode } from '../../Code/use-highlighted-code';
import { CodeBlock } from '../../CodeBlock';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../Collapsible';
import { CopyButton } from '../../CopyButton';
import { Shimmer } from '../../Shimmer';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../Tooltip';
import { Txt } from '../../Txt';
import { languageForPath } from './tool-call-language';
import { presentTool } from './tool-presentation';
import { cn } from '@/lib/utils';

export type ToolCallStatus = 'running' | 'success' | 'error';

export interface ToolProps extends HTMLAttributes<HTMLDivElement> {
  status: ToolCallStatus;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  collapsible?: boolean;
}

export interface ToolHeaderProps {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export interface ToolIconProps extends HTMLAttributes<HTMLSpanElement> {
  tooltip?: ReactNode;
}
export type ToolContentProps = HTMLAttributes<HTMLDivElement>;

export interface ToolCallListItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Draw a connector from this item to the next item in the same tool-call sequence. */
  continued?: boolean;
}

interface ToolContextValue {
  collapsible: boolean;
  expanded: boolean;
  failed: boolean;
  running: boolean;
}

const ToolContext = createContext<ToolContextValue | null>(null);

function useToolContext(): ToolContextValue {
  const context = useContext(ToolContext);
  if (!context) throw new Error('Tool compound components must be rendered inside Tool');
  return context;
}

export function Tool({
  status,
  defaultOpen = false,
  open,
  onOpenChange,
  collapsible = true,
  children,
  className,
  role = 'group',
  ...props
}: ToolProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultOpen);
  const expanded = open ?? internalExpanded;
  const [arrivedLive] = useState(() => status === 'running');

  useEffect(() => {
    if (open === undefined) setInternalExpanded(defaultOpen);
  }, [defaultOpen, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (open === undefined) setInternalExpanded(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const context: ToolContextValue = {
    collapsible,
    expanded,
    failed: status === 'error',
    running: status === 'running',
  };

  return (
    <ToolContext.Provider value={context}>
      <Collapsible
        open={expanded}
        onOpenChange={handleOpenChange}
        className={cn(
          'max-w-full min-w-0 rounded-md bg-surface2',
          arrivedLive && 'fade-in-0 slide-in-from-bottom-1 motion-safe:animate-in',
          className,
        )}
        role={role}
        aria-busy={status === 'running'}
        {...props}
      >
        {children}
      </Collapsible>
    </ToolContext.Provider>
  );
}

export function ToolHeader({ actions, children, className }: ToolHeaderProps) {
  const { collapsible, expanded, failed, running } = useToolContext();
  const Line = running ? Shimmer : 'span';
  const row = (
    <Line className={cn(ROW_LINE, 'text-sm text-neutral3')}>
      {children}
      <span aria-hidden className="min-w-2 flex-1" />
      {failed && <X size={13} role="img" aria-label="Failed" className="text-error shrink-0" />}
      {collapsible && (
        <span className="flex size-4 shrink-0 items-center justify-center">
          <Chevron expanded={expanded} />
        </span>
      )}
    </Line>
  );

  const trigger = collapsible ? (
    <CollapsibleTrigger className={cn(ROW_TRIGGER, className)}>{row}</CollapsibleTrigger>
  ) : (
    <div className={cn(ROW, className)}>{row}</div>
  );

  if (!actions) return trigger;

  return (
    <div className="flex min-w-0 items-center gap-1">
      <div className="min-w-0 flex-1">{trigger}</div>
      <div className="flex shrink-0 items-center">{actions}</div>
    </div>
  );
}

export function ToolIcon({ className, tooltip, ...props }: ToolIconProps) {
  const icon = (
    <span
      data-slot="tool-icon"
      className={cn(
        'flex size-4 shrink-0 items-center justify-center [&>svg]:size-4 [&>svg]:max-h-full [&>svg]:max-w-full',
        className,
      )}
      {...props}
    />
  );

  if (!tooltip) return icon;

  return (
    <Tooltip>
      <TooltipTrigger render={icon} />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function ToolContent({ className, children, ...props }: ToolContentProps) {
  const { collapsible } = useToolContext();
  if (!collapsible) return null;

  return (
    <CollapsibleContent className="max-w-full min-w-0">
      <div className={cn('flex w-full max-w-full min-w-0 flex-col gap-1.5 py-1.5 pr-1', className)} {...props}>
        {children}
      </div>
    </CollapsibleContent>
  );
}

/**
 * Sequence wrapper for adjacent tool calls. The connector sits behind the
 * item's own stacking context so expanded content always paints above it.
 */
export function ToolCallListItem({ continued = false, className, children, ...props }: ToolCallListItemProps) {
  return (
    <div className={cn('relative isolate -mx-1.5 min-w-0', continued && 'pb-1.5', className)} {...props}>
      <div data-tool-call-list-item-content className="relative z-10 min-w-0">
        {children}
      </div>
      {continued ? (
        <span
          aria-hidden="true"
          data-tool-call-rail
          className="bg-border1 pointer-events-none absolute top-6 bottom-0 left-[14px] z-0 w-px mask-b-from-[calc(100%-min(40%,80px))]"
        />
      ) : null}
    </div>
  );
}

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

const ROW = 'group/row w-full rounded-md text-left transition-colors';
const ROW_TRIGGER = `${ROW} hover:bg-neutral6/5 cursor-pointer`;

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

interface DisplayPayload {
  isJson: boolean;
  text: string;
}

function displayPayload(value: unknown): DisplayPayload {
  if (typeof value === 'string') {
    const cleanValue = stripSerializedAnsi(value);
    try {
      const formatted = JSON.stringify(JSON.parse(cleanValue), null, 2);
      if (formatted !== undefined) return { isJson: true, text: formatted };
    } catch {
      // A tool may return arbitrary text; it remains useful without JSON highlighting.
    }
    return { isJson: false, text: cleanValue };
  }

  try {
    const formatted = JSON.stringify(value, null, 2);
    if (formatted !== undefined) return { isJson: true, text: formatted };
  } catch {
    // Circular and otherwise non-serializable values fall back to readable text.
  }

  return { isJson: false, text: String(value) };
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

function ToolPayloadSection({ label, value }: { label: 'Input' | 'Output'; value: unknown }) {
  const payload = displayPayload(value);

  return (
    <section role="group" aria-label={label} className="border-border1 min-w-0 border-b last:border-b-0">
      <Txt as="div" variant="ui-xs" className="bg-surface2 text-neutral4 px-3 py-2 font-medium">
        {label}
      </Txt>
      <div className="group/payload relative min-w-0 bg-black">
        {payload.isJson ? (
          <Code
            code={payload.text}
            lang="json"
            className="text-neutral5 m-0 max-h-60 min-w-0 overflow-auto bg-black px-3 py-2 font-mono text-xs leading-normal whitespace-pre"
          />
        ) : (
          <pre className="text-neutral5 m-0 max-h-60 min-w-0 overflow-auto bg-black px-3 py-2 font-mono text-xs leading-normal break-words whitespace-pre-wrap">
            {payload.text}
          </pre>
        )}
        <CopyButton
          content={payload.text}
          size="sm"
          variant="ghost"
          className="absolute top-1 right-1 opacity-0 transition-opacity group-hover/payload:opacity-100"
        />
      </div>
    </section>
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
  const highlighted = useHighlightedCode(lines.join('\n'), lang);

  return (
    <>
      {lines.map((line, index) => (
        <div key={index} className={cn('flex whitespace-pre', row)}>
          <span className={cn('w-5 shrink-0 text-center opacity-70 select-none', gutter)}>{sign}</span>
          <span className="text-icon6 flex-1 pr-2.5">
            {highlighted?.tokens[index] ? (
              <HighlightedTokenLine tokens={highlighted.tokens[index]} />
            ) : (
              line || '\u00a0'
            )}
          </span>
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

  const outputValue = output !== undefined ? output : status !== 'running' ? result : undefined;
  const hasPayload = input !== undefined || outputValue !== undefined;

  return (
    <>
      {hasPayload && (
        <Card role="group" aria-label="Tool input and output" className="min-w-0 overflow-hidden">
          {input !== undefined && <ToolPayloadSection label="Input" value={input} />}
          {outputValue !== undefined && <ToolPayloadSection label="Output" value={outputValue} />}
        </Card>
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
  const { icon: Icon, label, detail, command } = presentTool(toolName, input);

  return (
    <Tool
      status={status}
      defaultOpen={defaultOpen}
      className={className}
      role={role}
      aria-label={ariaLabel ?? `Tool: ${toolName}`}
      {...props}
    >
      <ToolHeader actions={headerActions}>
        <ToolIcon tooltip="Tool">
          <Icon width={14} height={14} strokeWidth={1.75} aria-hidden className="text-accent6" />
        </ToolIcon>
        <Txt as="span" variant="ui-sm" className="text-neutral3 max-w-[55%] shrink-0 truncate">
          {label}
        </Txt>
        {detail !== undefined && (
          <Txt as="span" variant="ui-xs" font="mono" className="text-neutral3 min-w-0 truncate">
            {detail}
          </Txt>
        )}
      </ToolHeader>
      <ToolContent>
        <ToolBody toolName={toolName} input={input} result={result} output={output} status={status} command={command}>
          {children}
        </ToolBody>
      </ToolContent>
    </Tool>
  );
}
