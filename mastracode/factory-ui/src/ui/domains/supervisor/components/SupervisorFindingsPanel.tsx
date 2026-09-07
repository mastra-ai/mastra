import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Brain, ChevronRight, PanelRightIcon } from 'lucide-react';
import { Link } from 'react-router';

import type { FactoryHealthFinding } from '../services/supervisor';
import { findingPrompt } from '../services/supervisor';

interface SupervisorFindingsPanelProps {
  factoryId: string | undefined;
  findings: FactoryHealthFinding[];
  open: boolean;
  canDock: boolean;
  onOpenChange: (open: boolean) => void;
  onAsk: (prompt: string) => void;
}

const MAX_VISIBLE_FINDINGS_PER_GROUP = 5;

const FINDING_LABELS: Record<FactoryHealthFinding['kind'], string> = {
  'decision-failed': 'Failed decisions',
  'decision-stuck': 'Stuck decisions',
  'start-stalled': 'Stalled starts',
  'seat-orphaned': 'Orphaned seats',
  'seat-missing': 'Missing seats',
  'proposal-waiting': 'Proposals waiting',
  'held-waiting': 'Held cards waiting',
  'label-drift': 'Label drift',
};

function formatAge(ageMs: number) {
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function groupFindings(findings: FactoryHealthFinding[]) {
  const groups = new Map<FactoryHealthFinding['kind'], FactoryHealthFinding[]>();
  for (const finding of findings) {
    const group = groups.get(finding.kind) ?? [];
    group.push(finding);
    groups.set(finding.kind, group);
  }
  return [...groups.entries()];
}

function FindingsContent({
  factoryId,
  findings,
  onAsk,
}: Pick<SupervisorFindingsPanelProps, 'factoryId' | 'findings' | 'onAsk'>) {
  const groups = groupFindings(findings);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      role="region"
      aria-label="Supervisor findings"
      data-testid="supervisor-findings-panel"
    >
      <div className="flex shrink-0 items-center gap-2 px-3 py-3">
        <Brain className="size-4" aria-hidden />
        <Txt variant="ui-md" className="text-neutral6">
          Findings
        </Txt>
        <Badge variant="neutral" size="sm">
          {findings.length}
        </Badge>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {groups.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <Txt variant="ui-sm" className="text-neutral3">
              No findings — everything looks healthy.
            </Txt>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {groups.map(([kind, items]) => (
              <Collapsible key={kind}>
                <CollapsibleTrigger className="group flex w-full items-center gap-2 px-2 py-2 text-left">
                  <ChevronRight
                    className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90"
                    aria-hidden
                  />
                  <Txt variant="ui-sm" className="text-neutral6 min-w-0 flex-1">
                    {FINDING_LABELS[kind]}
                  </Txt>
                  <Badge variant="neutral" size="sm">
                    {items.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="flex flex-col gap-1 pb-2 pl-3">
                    {items.slice(0, MAX_VISIBLE_FINDINGS_PER_GROUP).map(finding => (
                      <li key={finding.id} className="flex flex-col gap-2 px-2 py-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <Txt variant="ui-sm" className="text-neutral6 block wrap-anywhere">
                              {finding.title}
                            </Txt>
                            <Txt variant="ui-xs" className="text-neutral3 mt-0.5 block wrap-anywhere">
                              {finding.evidence}
                            </Txt>
                          </div>
                          {finding.ageMs !== null && (
                            <Txt variant="ui-xs" className="text-neutral3 shrink-0">
                              {formatAge(finding.ageMs)}
                            </Txt>
                          )}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => onAsk(findingPrompt(finding))}>
                          Ask supervisor
                        </Button>
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </div>

      {findings.length > 0 && factoryId && (
        <Link
          to={`/factories/${factoryId}/attention`}
          className="border-border1 text-ui-sm text-neutral4 hover:text-neutral6 shrink-0 border-t px-4 py-3 text-center transition-colors"
        >
          View all in Attention
        </Link>
      )}
    </div>
  );
}

export function SupervisorFindingsToggle({
  factoryId,
  findings,
  open,
  canDock,
  onOpenChange,
  onAsk,
}: SupervisorFindingsPanelProps) {
  const button = (
    <Button
      size="icon-sm"
      variant={open ? 'default' : 'ghost'}
      tooltip={open ? 'Hide supervisor findings' : 'Show supervisor findings'}
      aria-label="Supervisor findings"
      aria-pressed={open}
      onClick={() => onOpenChange(!open)}
    >
      <PanelRightIcon />
    </Button>
  );

  if (canDock) return button;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{button}</PopoverTrigger>
      <PopoverContent align="end" className="flex h-120 w-84 p-0">
        <FindingsContent factoryId={factoryId} findings={findings} onAsk={onAsk} />
      </PopoverContent>
    </Popover>
  );
}

export function SupervisorFindingsSurface({ factoryId, findings, open, canDock, onAsk }: SupervisorFindingsPanelProps) {
  if (!canDock) return null;

  return (
    <div
      className={cn(
        'border-border1 bg-surface3 shadow-dialog absolute top-3 right-3 z-20 flex h-[calc(100%-1.5rem)] w-84 overflow-hidden border',
        'transition-[opacity,scale,translate] duration-200 motion-reduce:transition-none',
        open ? 'translate-x-0 scale-100 opacity-100' : 'pointer-events-none translate-x-3 scale-98 opacity-0',
      )}
      aria-hidden={!open}
      inert={!open}
    >
      <FindingsContent factoryId={factoryId} findings={findings} onAsk={onAsk} />
    </div>
  );
}
