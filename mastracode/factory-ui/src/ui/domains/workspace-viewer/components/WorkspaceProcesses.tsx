import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowLeft, Square, SquareTerminal } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import type { WorkspaceProcessSummary } from '../../../../api/types';
import { useKillWorkspaceProcess, useWorkspaceProcess, useWorkspaceProcesses } from '../../../../hooks/use-processes';
import { WakeSandbox } from './WakeSandbox';

function Header({ title, onBack, children }: { title: string; onBack: () => void; children?: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center gap-1.5 px-1.5 py-1">
      <Button size="icon-sm" variant="ghost" onClick={onBack} aria-label="Back">
        <ArrowLeft />
      </Button>
      <SquareTerminal className="text-muted-foreground shrink-0" size={14} />
      <Txt tone="ink" as="h2" variant="column" className="truncate">
        {title}
      </Txt>
      {children}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center">{children}</div>;
}

function Message({ children, tone }: { children: ReactNode; tone?: 'error' }) {
  return (
    <Txt
      as="span"
      variant="caption"
      tone={tone ? undefined : 'muted'}
      className={tone ? 'text-destructive-foreground' : undefined}
    >
      {children}
    </Txt>
  );
}

function StatusBadge({ process }: { process: Pick<WorkspaceProcessSummary, 'running' | 'exitCode'> }) {
  if (process.running) return <Badge variant="success">Running</Badge>;
  return <Badge variant={process.exitCode === 0 ? 'neutral' : 'destructive'}>Exited {process.exitCode ?? ''}</Badge>;
}

/** The session sandbox's processes: what is running, and what exited but hasn't been read. */
export function WorkspaceProcessList({
  workspacePath,
  visible = true,
  onSelect,
  onBack,
}: {
  workspacePath: string;
  visible?: boolean;
  onSelect: (pid: string) => void;
  onBack: () => void;
}) {
  const list = useWorkspaceProcesses(workspacePath, { enabled: visible, poll: true });

  let content: ReactNode;
  if (list.isLoading) content = <Spinner size="sm" />;
  else if (list.error) content = <Message tone="error">{list.error.message}</Message>;
  else if (list.data && !list.data.available) content = <WakeSandbox workspacePath={workspacePath} />;
  else if (!list.data?.processes.length) content = <Message>No processes</Message>;

  return (
    <aside className="flex min-h-0 w-full min-w-0 grow flex-col" aria-label="Workspace processes">
      <Header title="Processes" onBack={onBack} />
      {content ? (
        <Centered>{content}</Centered>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <ul className="flex flex-col gap-0.5 p-1.5">
            {list.data!.processes.map(process => (
              <li key={process.pid}>
                <Button
                  className="w-full justify-start"
                  size="sm"
                  variant="ghost"
                  onClick={() => onSelect(process.pid)}
                >
                  <span className="min-w-0 truncate font-mono">{process.command ?? `pid ${process.pid}`}</span>
                  <span className="ml-auto shrink-0">
                    <StatusBadge process={process} />
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </aside>
  );
}

function Output({ label, text, truncated }: { label: string; text: string; truncated: boolean }) {
  const end = useRef<HTMLSpanElement>(null);
  useEffect(() => end.current?.scrollIntoView?.({ block: 'end' }), [text]);
  return (
    <section className="flex flex-col gap-1" aria-label={label}>
      <Txt as="h3" variant="meta" tone="muted">
        {label}
        {truncated ? ' (showing the end)' : ''}
      </Txt>
      <pre className="bg-surface3 text-ui-sm rounded p-2 font-mono break-all whitespace-pre-wrap">
        {text || <span className="text-muted-foreground">Nothing yet</span>}
        <span ref={end} />
      </pre>
    </section>
  );
}

/** One process's stdout and stderr, re-read while it runs, with a Stop button. */
export function WorkspaceProcessDetail({
  workspacePath,
  pid,
  visible = true,
  onBack,
}: {
  workspacePath: string;
  pid: string;
  visible?: boolean;
  onBack: () => void;
}) {
  const process = useWorkspaceProcess(workspacePath, pid, { enabled: visible });
  const kill = useKillWorkspaceProcess(workspacePath);
  const data = process.data;

  return (
    <aside className="flex min-h-0 w-full min-w-0 grow flex-col" aria-label="Workspace process">
      <Header title={data?.command ?? `pid ${pid}`} onBack={onBack}>
        {data ? (
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            <StatusBadge process={data} />
            {data.running ? (
              <Button size="sm" variant="destructive-ghost" onClick={() => kill.mutate(pid)} disabled={kill.isPending}>
                {kill.isPending ? <Spinner size="sm" /> : <Square />}
                Stop
              </Button>
            ) : null}
          </span>
        ) : null}
      </Header>
      {kill.error ? (
        <div className="px-3">
          <Message tone="error">{kill.error.message}</Message>
        </div>
      ) : null}
      {process.isLoading ? (
        <Centered>
          <Spinner size="sm" />
        </Centered>
      ) : process.error ? (
        <Centered>
          <Message tone="error">{process.error.message}</Message>
        </Centered>
      ) : data ? (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-3 p-3">
            {data.attached ? <Message>Output since this process was attached.</Message> : null}
            <Output label="stdout" text={data.stdout} truncated={data.stdoutTruncated} />
            <Output label="stderr" text={data.stderr} truncated={data.stderrTruncated} />
          </div>
        </ScrollArea>
      ) : null}
    </aside>
  );
}
