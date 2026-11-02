import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Play } from 'lucide-react';
import { useState } from 'react';
import { savedConversation } from '../../utils/conversation-playback';
import type { ComparisonRow } from './build-comparison-rows';
import { columnLabel } from './constants';
import { ConversationPlayback } from './conversation-playback';

/** An additive view of saved results: opening and playing never runs an experiment. */
export function ConversationPlaybackDialog({
  row,
  names,
  onInspect,
}: {
  row: ComparisonRow;
  names: Record<string, string>;
  onInspect: (turnIndex: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [contenderId, setContenderId] = useState(row.sides[1]?.experimentId);
  const baselineSide = row.sides[0];
  const contenderSide = row.sides.find(side => side.experimentId === contenderId) ?? row.sides[1];
  const baseline = savedConversation(baselineSide?.output);
  const contender = savedConversation(contenderSide?.output);
  if ((!baseline && !contender) || !baselineSide || !contenderSide) return null;
  const contenderIndex = row.sides.indexOf(contenderSide);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button icon={<Play />} onClick={() => setOpen(true)}>
        Replay conversation
      </Button>
      <DialogContent size="full" className="max-w-7xl">
        <DialogHeader>
          <DialogTitle>Conversation playback</DialogTitle>
          <DialogDescription>
            Saved results, played side by side. Timing is illustrative; no models are running.
          </DialogDescription>
        </DialogHeader>
        <DialogBody layout="fill" flush>
          <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-4 px-5">
            <div className="min-w-0 space-y-1">
              <Txt variant="meta" tone="muted">
                Baseline
              </Txt>
              <Txt as="p" variant="heading" className="break-words">
                {names[baselineSide.experimentId] ?? baselineSide.experimentId}
              </Txt>
            </div>
            <div className="min-w-0 space-y-1">
              <Txt variant="meta" tone="muted">
                {columnLabel(contenderIndex)}
              </Txt>
              {row.sides.length > 2 ? (
                <Select value={contenderSide.experimentId} onValueChange={setContenderId}>
                  <SelectTrigger aria-label="Playback contender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {row.sides.slice(1).map(side => (
                      <SelectItem key={side.experimentId} value={side.experimentId}>
                        {names[side.experimentId] ?? side.experimentId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Txt as="p" variant="heading" className="break-words">
                  {names[contenderSide.experimentId] ?? contenderSide.experimentId}
                </Txt>
              )}
            </div>
          </div>
          {open && (
            <ConversationPlayback
              key={`${baselineSide.experimentId}:${contenderSide.experimentId}`}
              baseline={baseline}
              contender={contender}
              input={row.input}
              onInspect={index => {
                onInspect(index);
                setOpen(false);
              }}
            />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
