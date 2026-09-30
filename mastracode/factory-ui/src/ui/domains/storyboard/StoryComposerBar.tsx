import { ArrowRight } from 'lucide-react';

import { useStoryboard } from './StoryboardProvider';
import { composerFooter, composerLocked, composerTopTray } from './storyComposer';
import { StoryComposerBlocked } from './StoryComposerBlocked';
import { StorySteerFooter, StorySteerHint } from './StoryComposerGate';
import { StoryComposerTray } from './StoryComposerTray';
import { ActorGlyph } from './StoryPayerChip';

export function useStoryComposerLocked(): boolean {
  const storyboard = useStoryboard();
  const card = storyboard?.state.cards[0];
  return storyboard && card ? composerLocked(storyboard.state, card) : false;
}

export function StoryComposerTopTray() {
  const storyboard = useStoryboard();
  const card = storyboard?.state.cards[0];
  if (!storyboard || !card) return null;

  const tray = composerTopTray(storyboard.state, card);
  if (!tray) return null;
  if (tray.kind === 'blocked')
    return <StoryComposerBlocked storyboard={storyboard} card={card} billing={tray.billing} />;
  return <StorySteerHint storyboard={storyboard} owner={tray.owner} />;
}

export function StoryComposerFooter() {
  const storyboard = useStoryboard();
  const card = storyboard?.state.cards[0];
  if (!storyboard || !card) return null;

  const footer = composerFooter(storyboard.state, card);
  if (!footer) return null;
  if (footer.kind === 'steer')
    return <StorySteerFooter storyboard={storyboard} card={card} owner={footer.owner} payer={footer.payer} />;
  return (
    <StoryComposerTray
      edge="bottom"
      label="What sending changes"
      icon={
        <span className="flex items-center gap-1">
          <ActorGlyph actor={footer.from} />
          <ArrowRight aria-hidden className="size-3" />
          <ActorGlyph actor={storyboard.state.viewer} />
        </span>
      }
    >
      Sending takes over this card
    </StoryComposerTray>
  );
}
