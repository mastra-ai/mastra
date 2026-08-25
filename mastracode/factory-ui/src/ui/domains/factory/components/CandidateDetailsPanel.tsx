import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Popover, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { EllipsisVertical, Minimize2, PencilLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';

import type { BoardCandidate } from '../boardCandidates';
import type { RunAction } from '../boardRunSpecs';
import type { CardMorph } from '../hooks/useCardMorph';
import { CardSourceDescription } from './BoardCardDetails';
import { CardLabels } from './BoardCardParts';
import { SourceIcon } from './BoardIcons';
import { CardDetailsBody, CardDetailsPanel } from './CardDetailsPanel';

// The header repeats the card rows in the card order, so the box grows around them instead of re-staging them.
export function CandidateDetailsPanel({
  candidate,
  labelledBy,
  morph,
  labels,
  projectRepositoryId,
  factoryProjectId,
  menu,
  defaultAction,
  disabled,
  runPending,
  onRun,
}: {
  candidate: BoardCandidate;
  labelledBy: string;
  morph: CardMorph;
  labels: string[];
  projectRepositoryId: string;
  factoryProjectId: string;
  menu: ReactNode;
  defaultAction: RunAction;
  disabled: boolean;
  runPending: boolean;
  /** Start a run; `prompt` undefined = the action's default prompt. */
  onRun: (action: RunAction, prompt?: string) => void;
}) {
  const promptAnchorRef = useRef<HTMLButtonElement>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [prompt, setPrompt] = useState('');

  const closePrompt = () => {
    setPromptOpen(false);
    setPrompt('');
  };

  const runPrompt = () => {
    const trimmed = prompt.trim();
    if (!trimmed || runPending) return;
    closePrompt();
    morph.closeDetails();
    onRun(defaultAction, trimmed);
  };

  return (
    <CardDetailsPanel morph={morph} labelledBy={labelledBy}>
      <div className="flex flex-col gap-3 p-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-ui-xs text-icon2 min-w-0 flex-1 truncate">{candidate.meta}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Collapse ${candidate.title}`}
              onClick={morph.closeDetails}
            >
              <Minimize2 size={13} aria-hidden />
            </Button>
            <DropdownMenu>
              <DropdownMenu.Trigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`All actions for ${candidate.title}`}
                  >
                    <EllipsisVertical size={13} aria-hidden />
                  </Button>
                }
              />
              <DropdownMenu.Content align="end" className="min-w-44">
                {menu}
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <SourceIcon source={candidate.source} />
            <h2 id={labelledBy} className="text-ui-smd text-icon6 m-0 min-w-0 font-semibold wrap-anywhere">
              {candidate.title}
            </h2>
          </div>
        </div>
        <CardLabels labels={labels} />
      </div>
      {/* Only what the card never carried is staged in. */}
      <CardDetailsBody>
        <CardSourceDescription
          item={candidate}
          projectRepositoryId={projectRepositoryId}
          factoryProjectId={factoryProjectId}
        />
      </CardDetailsBody>
      <div className="flex flex-col gap-2 px-3 py-2.5" data-card-morph="reveal">
        <Button
          ref={promptAnchorRef}
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setPromptOpen(true)}
        >
          <PencilLine size={13} aria-hidden />
          Custom prompt…
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="w-full"
          disabled={disabled || runPending}
          onClick={() => {
            morph.closeDetails();
            onRun(defaultAction);
          }}
        >
          {defaultAction.label}
        </Button>
        <Popover open={promptOpen} onOpenChange={open => (open ? setPromptOpen(true) : closePrompt())}>
          <PopoverContent anchor={promptAnchorRef} align="end" className="w-80 p-3">
            <form
              aria-label={`Custom prompt for ${candidate.title}`}
              className="flex flex-col gap-2"
              onSubmit={event => {
                event.preventDefault();
                runPrompt();
              }}
            >
              <Textarea
                autoFocus
                rows={3}
                size="sm"
                value={prompt}
                placeholder="What should the agent do with this?"
                aria-label={`Prompt for ${candidate.title}`}
                onChange={event => setPrompt(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    runPrompt();
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="xs" onClick={closePrompt}>
                  Cancel
                </Button>
                <Button type="submit" size="xs" disabled={runPending || !prompt.trim()}>
                  Run
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      </div>
    </CardDetailsPanel>
  );
}
