import { FoldVertical, X } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  ToolCall,
  ToolCallContent,
  ToolCallDetail,
  ToolCallDisclosure,
  ToolCallHeader,
  ToolCallIcon,
  ToolCallLabel,
  ToolCallSpacer,
  ToolCallSummary,
  ToolCallTrailing,
  ToolCallTrigger,
} from './tool-call';
import type { ToolCallStatus } from './tool-call';
import { presentTool } from './tool-presentation';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Txt } from '@/ds/components/Txt';

export interface ToolCallGroupStep {
  toolName: string;
  args: unknown;
  status: ToolCallStatus;
  /** A successful tool result was recorded. Supply for every step to enable outcome counts; omit to keep legacy summaries. */
  hasResult?: boolean;
}

export interface ToolCallGroupProps {
  steps: ToolCallGroupStep[];
  /** Rendered ahead of the icon, e.g. the time the first step began. */
  leading?: ReactNode;
  children: ReactNode;
}

const MAX_KIND_GLYPHS = 4;

export function ToolCallGroup({ steps, leading, children }: ToolCallGroupProps) {
  const running = steps.find(step => step.status === 'running');
  const liveDetail = running && presentTool(running.toolName, running.args).detail;

  return (
    <ToolCall status={running ? 'running' : 'idle'} aria-label={`Tool group: ${steps.length} steps`}>
      <ToolCallTrigger>
        <ToolCallHeader>
          {leading}
          <ToolCallIcon>
            <FoldVertical size={14} strokeWidth={1.75} aria-hidden className="text-icon2" />
          </ToolCallIcon>
          <ToolCallLabel>{steps.length} steps</ToolCallLabel>
          {liveDetail && <ToolCallDetail>{liveDetail}</ToolCallDetail>}
          <GroupKinds steps={steps} />
          <ToolCallSpacer rule />
          <ToolCallTrailing>
            <GroupProgress steps={steps} />
          </ToolCallTrailing>
          <ToolCallDisclosure />
        </ToolCallHeader>
      </ToolCallTrigger>
      <ToolCallContent className="py-0.5 pr-0 pl-2.5">
        <ScrollArea maxHeight="18rem" autoScroll={Boolean(running)} revealScrollbarOnHover={false}>
          {children}
        </ScrollArea>
      </ToolCallContent>
    </ToolCall>
  );
}

function GroupProgress({ steps }: { steps: ToolCallGroupStep[] }) {
  const done = steps.filter(step => step.status !== 'running').length;
  if (done < steps.length) {
    return (
      <Txt as="span" variant="ui-xs" className="text-icon3 shrink-0 tabular-nums">
        {done}/{steps.length}
      </Txt>
    );
  }
  const failed = steps.filter(step => step.status === 'error').length;
  const errorIndicator =
    failed > 0 ? <X size={13} role="img" aria-label="Failed" className="text-error shrink-0" /> : null;
  // Older consumers only supply visual status, which cannot distinguish completed from interrupted calls.
  if (steps.some(step => step.hasResult === undefined)) return errorIndicator;

  const succeeded = steps.filter(step => step.status === 'idle' && step.hasResult).length;
  const incomplete = steps.length - succeeded - failed;
  const summary = [
    succeeded > 0 && `${succeeded} OK`,
    failed > 0 && `${failed} failed`,
    incomplete > 0 && `${incomplete} incomplete`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      {errorIndicator}
      <Txt as="span" variant="ui-xs" className="text-icon3 shrink-0 tabular-nums">
        {summary}
      </Txt>
    </>
  );
}

function GroupKinds({ steps }: { steps: ToolCallGroupStep[] }) {
  const iconByLabel = new Map(
    steps.map(step => presentTool(step.toolName, step.args)).map(({ label, icon }) => [label, icon]),
  );
  const kinds = [...iconByLabel].slice(0, MAX_KIND_GLYPHS);

  return (
    <ToolCallSummary role="img" aria-label={kinds.map(([label]) => label).join(', ')} className="shrink-0 gap-1.5">
      {kinds.map(([label, Kind]) => (
        <Kind key={label} size={12} strokeWidth={1.75} className="text-icon2" />
      ))}
    </ToolCallSummary>
  );
}
