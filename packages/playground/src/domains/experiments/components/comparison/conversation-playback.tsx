import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ScrollArea, ScrollAreaViewport } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { savedTurn } from '../../utils/conversation-playback';
import type { savedConversation } from '../../utils/conversation-playback';
import { ConversationPlaybackMessage } from './conversation-playback-message';
import { useConversationPlayback } from './use-conversation-playback';

type Conversation = NonNullable<ReturnType<typeof savedConversation>>;

/** One local clock and one scroll surface keep both recorded conversations aligned. */
export function ConversationPlayback({
  baseline,
  contender,
  input,
  onInspect,
}: {
  baseline?: Conversation;
  contender?: Conversation;
  input: unknown;
  onInspect: (turnIndex: number) => void;
}) {
  const count = Math.max(baseline?.count ?? 0, contender?.count ?? 0);
  const playback = useConversationPlayback(count);
  const status = playback.complete ? 'Playback complete' : playback.playing ? 'Playing saved results' : 'Paused';
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-5">
        <Button variant="primary" icon={playback.playing ? <Pause /> : <Play />} onClick={playback.toggle}>
          {playback.playing ? 'Pause' : playback.complete ? 'Play again' : 'Play'}
        </Button>
        <Button icon={<RotateCcw />} onClick={playback.restart}>
          Restart
        </Button>
        <Button
          size="icon-md"
          aria-label="Previous turn"
          disabled={playback.turnIndex === 0}
          onClick={() => playback.seek(playback.turnIndex - 1)}
        >
          <SkipBack />
        </Button>
        <Button
          size="icon-md"
          aria-label="Next turn"
          disabled={playback.turnIndex === count - 1}
          onClick={() => playback.seek(playback.turnIndex + 1)}
        >
          <SkipForward />
        </Button>
        <Button aria-label={`Playback speed: ${playback.speed}×`} onClick={playback.changeSpeed}>
          {playback.speed}×
        </Button>
        <Button variant="ghost" onClick={() => onInspect(playback.turnIndex)}>
          Inspect turn
        </Button>
        <div role="status" className="flex items-center gap-2 sm:ml-auto">
          <Txt variant="meta" tone="muted">
            Turn {playback.turnIndex + 1} of {count}
          </Txt>
          <Txt variant="meta" tone="muted">
            {status}
          </Txt>
        </div>
      </div>
      <nav aria-label="Playback turns" className="flex shrink-0 gap-1 overflow-x-auto px-5 py-2">
        {Array.from({ length: count }, (_, index) => (
          <Button
            key={index}
            size="sm"
            variant={index === playback.turnIndex ? 'primary' : 'ghost'}
            aria-label={`Go to turn ${index + 1}`}
            aria-pressed={index === playback.turnIndex}
            onClick={() => playback.seek(index)}
          >
            {index + 1}
          </Button>
        ))}
      </nav>
      <ScrollArea className="min-h-0 flex-1" autoScroll mask={false}>
        <ScrollAreaViewport>
          <div className="mx-auto w-full max-w-6xl">
            {Array.from({ length: playback.turnIndex + 1 }, (_, index) => {
              const left = savedTurn(baseline, index, input);
              const right = savedTurn(contender, index, input);
              const fraction = index < playback.turnIndex ? 1 : playback.fraction;
              const different = left.executed && right.executed && left.text !== right.text;
              return (
                <section key={index} aria-label={`Playback turn ${index + 1}`} className="border-t border-border">
                  <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-2">
                    <Txt variant="meta" tone="muted">
                      Turn {index + 1}
                    </Txt>
                    {fraction >= 1 && left.executed && right.executed && (
                      <Badge variant={different ? 'warning' : 'neutral'} emphasis="subtle">
                        {different ? 'Response differs' : left.text ? 'Same response text' : 'No response text'}
                      </Badge>
                    )}
                    {fraction >= 1 && (!left.executed || !right.executed) && (
                      <Badge variant="warning" emphasis="subtle">
                        Incomplete comparison
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-border">
                    <ConversationPlaybackMessage turn={left} fraction={fraction} />
                    <ConversationPlaybackMessage turn={right} fraction={fraction} />
                  </div>
                </section>
              );
            })}
          </div>
        </ScrollAreaViewport>
      </ScrollArea>
    </>
  );
}
