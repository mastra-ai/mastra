import { Txt } from '@mastra/playground-ui/components/Txt';
import { Bot, Brain, Hourglass, MessageSquare, User, Zap } from 'lucide-react';
import type { ReactNode } from 'react';

type PreviewKind = 'activity' | 'running' | 'stalled' | 'attention';

/** A static outline of a list row, without invented titles, stages, or timestamps. */
function PreviewRow({ y, detail = false, children }: { y: number; detail?: boolean; children: ReactNode }) {
  return (
    <g transform={`translate(0 ${y})`}>
      {children}
      <rect x="26" y={detail ? 0 : 4} width="92" height="6" rx="3" fill="var(--fill)" />
      {detail ? (
        <rect x="26" y="10" width="64" height="4" rx="2" fill="var(--fill-subtle)" />
      ) : (
        <rect x="142" y="0" width="48" height="14" rx="7" fill="none" stroke="var(--border)" strokeDasharray="3 3" />
      )}
      <rect x="208" y="5" width="24" height="4" rx="2" fill="var(--fill-subtle)" />
    </g>
  );
}

function PreviewRows({ kind }: { kind: PreviewKind }) {
  if (kind === 'activity') {
    return (
      <>
        <PreviewRow y={8}>
          <Bot size={14} />
        </PreviewRow>
        <PreviewRow y={40}>
          <User size={14} />
        </PreviewRow>
        <PreviewRow y={72}>
          <Zap size={14} />
        </PreviewRow>
      </>
    );
  }
  if (kind === 'attention') {
    return (
      <>
        <PreviewRow y={8} detail>
          <MessageSquare size={14} />
        </PreviewRow>
        <PreviewRow y={40} detail>
          <Brain size={14} />
        </PreviewRow>
        <PreviewRow y={72} detail>
          <MessageSquare size={14} />
        </PreviewRow>
      </>
    );
  }
  const Marker = kind === 'running' ? Bot : Hourglass;
  return (
    <>
      <PreviewRow y={8}>
        <Marker size={14} />
      </PreviewRow>
      <PreviewRow y={40}>
        <Marker size={14} />
      </PreviewRow>
      <PreviewRow y={72}>
        <Marker size={14} />
      </PreviewRow>
    </>
  );
}

/** Echo the populated list's actors, titles, stage pills, and times with one short status. */
export function OverviewListEmptyState({ kind, title }: { kind: PreviewKind; title: string }) {
  return (
    <div className="flex min-h-32 items-center gap-6 sm:gap-10">
      <svg aria-hidden="true" viewBox="0 0 240 96" className="text-placeholder w-28 shrink-0 sm:w-48">
        <PreviewRows kind={kind} />
      </svg>
      <Txt as="h4" variant="subheading">
        {title}
      </Txt>
    </div>
  );
}
