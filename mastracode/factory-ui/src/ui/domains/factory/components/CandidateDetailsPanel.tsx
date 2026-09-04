import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Popover, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { EllipsisVertical, Minimize2, PencilLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';

import type { BoardCandidate } from '../boardCandidates';
import type { BoardCardStatus } from '../boardCardStatus';
import type { RunAction } from '../boardRunSpecs';
import type { CardMorph } from '../hooks/useCardMorph';
import { CardSourceDescription } from './BoardCardDetails';
import { CardActions } from './BoardCardParts';
import { CandidateCardRows } from './CandidateCardRows';
import { CardDetailsPanel } from './CardDetailsPanel';

export function CandidateDetailsPanel({
  candidate,
  labelledBy,
  morph,
  status,
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
  status: BoardCardStatus;
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
    <CardDetailsPanel
      morph={morph}
      labelledBy={labelledBy}
      header={
        <CandidateCardRows
          candidate={candidate}
          status={status}
          titleId={labelledBy}
          controls={
            <>
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
            </>
          }
          actions={
            <CardActions
              actions={[
                {
                  label: runPending ? 'Starting…' : defaultAction.label,
                  disabled: disabled || runPending,
                  start: () => onRun(defaultAction),
                },
              ]}
              beforeStart={morph.closeDetails}
            >
              <Button
                ref={promptAnchorRef}
                type="button"
                variant="outline"
                size="sm"
                data-card-morph="reveal"
                onClick={() => setPromptOpen(true)}
              >
                <PencilLine size={13} aria-hidden />
                Custom prompt…
              </Button>
            </CardActions>
          }
        />
      }
    >
      <ScrollArea className="flex min-h-0 grow flex-col" viewPortClassName="min-h-0 grow">
        <div className="stream-landing flex flex-col gap-2 p-3">
          <h3 className="text-ui-smd text-icon6 m-0 font-[550] wrap-anywhere">{candidate.title}</h3>
          <CardSourceDescription
            item={candidate}
            projectRepositoryId={projectRepositoryId}
            factoryProjectId={factoryProjectId}
          />
        </div>
      </ScrollArea>
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
    </CardDetailsPanel>
  );
}
