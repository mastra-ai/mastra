import { CodeBlock as DsCodeBlock } from '@mastra/playground-ui/components/CodeBlock';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import {
  ToolCall as ToolCallRoot,
  ToolCallContent,
  ToolCallDetail,
  ToolCallDisclosure,
  ToolCallHeader,
  ToolCallIcon,
  ToolCallLabel,
  ToolCallSpacer,
  ToolCallTrailing,
  ToolCallTrigger,
} from '@mastra/playground-ui/components/ai/tool-call';
import { cn } from '@mastra/playground-ui/utils/cn';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { highlightCode, languageForPath } from '../../../../ui/highlight';
import { stripSerializedAnsi } from '../../services/ansi';
import type { ToolCall } from '../../services/transcript';
import { useArriving } from '@mastra/playground-ui/components/Arrival';
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

function ToolBody({ tool, command }: { tool: ToolCall; command?: string }) {
  const edit = editArgs(tool.toolName, tool.args);
  const resultText =
    tool.status !== 'running' && tool.result !== undefined ? stripSerializedAnsi(stringify(tool.result)) : undefined;

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
        {tool.status === 'error' && resultText !== undefined && (
          <MonoBlock copyText={resultText} className="text-error/90">
            {truncate(resultText, 800)}
          </MonoBlock>
        )}
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
          resultText !== undefined && (
            <MonoBlock copyText={resultText} className="text-icon3">
              {truncate(resultText, 800)}
            </MonoBlock>
          )
        )}
      </>
    );
  }

  const argsPretty = tool.args !== undefined ? stringify(tool.args) : tool.argsText;
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
      {resultText !== undefined && (
        <MonoBlock copyText={resultText} className="text-icon3">
          {truncate(resultText, 800)}
        </MonoBlock>
      )}
    </>
  );
}

/** Its own element: the card is drawn the moment the call starts, its arguments land a beat later. */
function ToolDetail({ children }: { children: string }) {
  const arriving = useArriving();

  return <ToolCallDetail className={arriving}>{children}</ToolCallDetail>;
}

export function ToolCard({ tool }: { tool: ToolCall }) {
  const { icon: Icon, label, detail, command } = presentTool(tool.toolName, tool.args);
  const failed = tool.status === 'error';

  return (
    <ToolCallRoot
      status={tool.status === 'running' ? 'running' : failed ? 'error' : 'idle'}
      aria-label={`Tool: ${tool.toolName}`}
      aria-busy={tool.status === 'running'}
    >
      <ToolCallTrigger>
        <ToolCallHeader>
          <ToolCallIcon>
            <Icon size={14} strokeWidth={1.75} aria-hidden className={failed ? 'text-error/80' : 'text-icon2'} />
          </ToolCallIcon>
          <ToolCallLabel>{label}</ToolCallLabel>
          {detail && <ToolDetail>{detail}</ToolDetail>}
          <ToolCallSpacer />
          {failed && (
            <ToolCallTrailing>
              <X size={13} role="img" aria-label="Failed" className="text-error shrink-0" />
            </ToolCallTrailing>
          )}
          <ToolCallDisclosure />
        </ToolCallHeader>
      </ToolCallTrigger>
      <ToolCallContent>
        <ToolBody tool={tool} command={command} />
      </ToolCallContent>
    </ToolCallRoot>
  );
}
