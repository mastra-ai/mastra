import type { StoryState } from './storyState';
import { laneAutoOn, laneRunsOn } from './storyState';

export type AutoStatus = { auto: boolean; label: string; reason: string; tone: 'auto' | 'click' | 'blocked' };

export function autoStatus(state: StoryState, stageId: string): AutoStatus {
  if (laneRunsOn(state, stageId) === 'owner')
    return {
      auto: false,
      label: 'Starts on click',
      reason: "Cards here bill their owner's plan, so a person has to click: nobody is billed when nobody is around.",
      tone: 'click',
    };
  const auto = laneAutoOn(state, stageId);
  if (auto && state.sharedAccount === null)
    return {
      auto,
      label: 'Auto-start paused',
      reason: 'This lane auto-starts cards, but no Factory account is connected to pay.',
      tone: 'blocked',
    };
  if (auto)
    return {
      auto,
      label: 'Auto-starts',
      reason: 'A card arriving here starts a run right away, paid by the Factory account.',
      tone: 'auto',
    };
  return {
    auto,
    label: 'Starts on click',
    reason: 'A card waits here until someone clicks to start the run.',
    tone: 'click',
  };
}
