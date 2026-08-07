import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowUpRight, Plus, Stethoscope } from 'lucide-react';

import type { FactoryRunPhase } from '../../../../hooks/useStartFactoryRun';
import type { BoardCandidate } from '../boardCandidates';
import { setDragPayload } from '../boardDrag';
import { AUTO_TRIAGED_LABEL, externalLinkLabel, hasLabel, metadataLabels } from '../boardItems';
import type { RunAction } from '../boardRunSpecs';
import { CardLabels, CardTitleTooltip, SourceTitle } from './BoardCardParts';
import { SourceIcon } from './BoardIcons';
import { FactoryItemActions } from './FactoryItemActions';

export function CandidateCard({
  candidate,
  pendingRunRoles,
  triageStarting,
  disabled,
  onRun,
  onFile,
  onTriage,
}: {
  candidate: BoardCandidate;
  pendingRunRoles: ReadonlyMap<string, FactoryRunPhase | undefined>;
  triageStarting: boolean;
  disabled: boolean;
  /** Start a run; `prompt` undefined = the action's default prompt. */
  onRun: (action: RunAction, prompt?: string) => void;
  /** File the candidate onto the board without starting a run. */
  onFile: () => void;
  /** Run first-contact issue triage without leaving the board. */
  onTriage?: () => void;
}) {
  const labels = metadataLabels(candidate.metadata);
  const showTriage = candidate.source === 'github-issue' && !hasLabel(labels, AUTO_TRIAGED_LABEL) && onTriage;
  const [defaultAction, ...otherActions] = candidate.runActions;
  return (
    <CardTitleTooltip title={candidate.title}>
      <article
        draggable
        aria-label={candidate.title}
        data-testid="candidate-card"
        onDragStart={event =>
          setDragPayload(event, {
            kind: 'candidate',
            candidate: {
              source: candidate.source,
              sourceKey: candidate.sourceKey,
              title: candidate.title,
              url: candidate.url,
              metadata: candidate.metadata,
            },
          })
        }
        className="group border-border1/50 bg-neutral6/5 hover:bg-surface3 flex cursor-grab flex-col gap-3 rounded-xl border p-3 transition-colors outline-none active:cursor-grabbing"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-ui-xs text-icon2 block truncate">{candidate.meta}</span>
          <div className="flex min-w-0 items-center gap-1.5">
            <SourceIcon source={candidate.source} />
            <button
              type="button"
              disabled={disabled}
              aria-busy={pendingRunRoles.has(defaultAction.role) || undefined}
              // Title click starts the default run — same as the primary action
              // button — so clicking a candidate always kicks off its work.
              onClick={() => onRun(defaultAction)}
              className="text-ui-smd text-icon6 min-w-0 flex-1 truncate text-left font-semibold hover:underline disabled:opacity-60"
            >
              <SourceTitle source={candidate.source} title={candidate.title} />
            </button>
            <a
              href={candidate.url}
              target="_blank"
              rel="noreferrer"
              aria-label={externalLinkLabel(candidate.source)}
              className="text-icon3 hover:text-icon5 shrink-0 transition-[opacity,translate] focus-visible:translate-x-0 focus-visible:translate-y-0 focus-visible:opacity-100 motion-reduce:transition-none pointer-fine:-translate-x-1 pointer-fine:translate-y-1 pointer-fine:opacity-0 pointer-fine:group-hover:translate-x-0 pointer-fine:group-hover:translate-y-0 pointer-fine:group-hover:opacity-100"
            >
              <ArrowUpRight size={12} aria-hidden />
            </a>
          </div>
        </div>
        <CardLabels labels={labels} />
        <FactoryItemActions
          actionLabel={defaultAction.label}
          itemLabel={candidate.title}
          starting={pendingRunRoles.has(defaultAction.role)}
          disabled={disabled}
          onAction={() => onRun(defaultAction)}
          extraActions={otherActions.map(action => ({
            label: action.label,
            starting: pendingRunRoles.has(action.role),
            onAction: () => onRun(action),
          }))}
          onRunPrompt={prompt => onRun(defaultAction, prompt)}
          menuExtras={
            <>
              <DropdownMenu.Item render={<a href={candidate.url} target="_blank" rel="noreferrer" />}>
                <ArrowUpRight aria-hidden />
                <span>{externalLinkLabel(candidate.source)}</span>
              </DropdownMenu.Item>
              {showTriage && (
                <DropdownMenu.Item disabled={triageStarting} onClick={onTriage}>
                  <Stethoscope aria-hidden />
                  <span>{triageStarting ? 'Starting…' : 'Triage issue'}</span>
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item onClick={onFile}>
                <Plus aria-hidden />
                <span>Add to board</span>
              </DropdownMenu.Item>
            </>
          }
        />
      </article>
    </CardTitleTooltip>
  );
}
