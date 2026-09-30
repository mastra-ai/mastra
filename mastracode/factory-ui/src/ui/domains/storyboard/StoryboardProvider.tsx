import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { BoardKind } from '../factory/boardStages';
import type { WorkItem } from '../factory/services/workItems';
import { STORIES, storyState } from './stories';
import type { Story, StoryStep } from './stories';
import type { CardFacts, StoryState, ViewerRole } from './storyState';
import { cardIndexFor } from './storyState';
import { isStorySeedItem, storySeedFacts, storySeedItems } from './storySeed';

const STORAGE_KEY = 'factory.storyboard';

type Saved = { storyId: string; stepIndex: number; overrides: Partial<StoryState>; viewerRole?: ViewerRole };

export type Storyboard = {
  story: Story;
  step: StoryStep;
  stepIndex: number;
  state: StoryState;
  /** Knob changes on top of the step; cleared when the step changes. */
  overridden: boolean;
  setStory: (storyId: string) => void;
  setStep: (stepIndex: number) => void;
  patch: (change: Partial<StoryState>) => void;
  setViewerRole: (viewerRole: ViewerRole) => void;
  patchCard: (index: number, facts: CardFacts) => void;
  reset: () => void;
  close: () => void;
};

const StoryboardContext = createContext<Storyboard | null>(null);

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : (JSON.parse(raw) as Saved);
  } catch {
    return null;
  }
}

function writeSaved(saved: Saved | null) {
  try {
    if (saved === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Private windows: the storyboard still works, it just forgets on reload.
  }
}

function initialSaved(): Saved | null {
  const flag = new URLSearchParams(window.location.search).get('storyboard');
  if (flag === 'off') return null;
  const story = STORIES.find(candidate => candidate.id === flag);
  if (story) return { storyId: story.id, stepIndex: 0, overrides: {} };
  return readSaved() ?? (flag === null ? null : { storyId: STORIES[0]!.id, stepIndex: 0, overrides: {} });
}

/** Prototype layer: `?storyboard` turns it on, `?storyboard=<story-id>` opens a story, `?storyboard=off` removes it. */
export function StoryboardProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved | null>(initialSaved);

  useEffect(() => writeSaved(saved), [saved]);

  const value = useMemo<Storyboard | null>(() => {
    if (saved === null) return null;
    const story = STORIES.find(candidate => candidate.id === saved.storyId) ?? STORIES[0]!;
    const stepIndex = Math.min(saved.stepIndex, story.steps.length - 1);
    const state = { ...storyState(story, stepIndex), ...saved.overrides, viewerRole: saved.viewerRole ?? 'admin' };
    const move = (next: Pick<Saved, 'storyId' | 'stepIndex'>) =>
      setSaved({ ...next, overrides: {}, viewerRole: saved.viewerRole });
    return {
      story,
      step: story.steps[stepIndex]!,
      stepIndex,
      state,
      overridden: Object.keys(saved.overrides).length > 0,
      setStory: storyId => move({ storyId, stepIndex: 0 }),
      setStep: index => move({ storyId: story.id, stepIndex: index }),
      patch: change => setSaved({ ...saved, overrides: { ...saved.overrides, ...change } }),
      setViewerRole: viewerRole => setSaved({ ...saved, viewerRole }),
      patchCard: (index, facts) =>
        setSaved({
          ...saved,
          overrides: { ...saved.overrides, cards: state.cards.map((card, i) => (i === index ? facts : card)) },
        }),
      reset: () => move({ storyId: story.id, stepIndex }),
      close: () => setSaved(null),
    };
  }, [saved]);

  return <StoryboardContext.Provider value={value}>{children}</StoryboardContext.Provider>;
}

/** Null when the storyboard is off: every injection point renders nothing then. */
export function useStoryboard(): Storyboard | null {
  return useContext(StoryboardContext);
}

export function useStoryCard(itemId: string): { storyboard: Storyboard; facts: CardFacts } | null {
  const storyboard = useStoryboard();
  if (storyboard === null) return null;
  const facts =
    storyboard.state.cardFacts[itemId] ??
    storySeedFacts(itemId) ??
    storyboard.state.cards[cardIndexFor(itemId, storyboard.state.cards.length)]!;
  return { storyboard, facts };
}

type BoardItems = { all: WorkItem[]; visible: WorkItem[]; remove: (id: string) => void };

export function useStorySeededItems<Items extends BoardItems>(
  items: Items,
  factoryProjectId: string,
  kind: BoardKind,
): Items {
  const storyboard = useStoryboard();
  const layout = storyboard?.state.boardLayout ?? 'standard';
  const seed = useMemo(
    () => storySeedItems(factoryProjectId, Date.now(), kind, layout),
    [factoryProjectId, kind, layout],
  );
  if (storyboard === null) return items;
  if (!storyboard.state.boardImported) return { ...items, all: [], visible: [] };
  if (seed.length === 0) return items;
  return {
    ...items,
    all: [...items.all, ...seed],
    visible: [...items.visible, ...seed],
    remove: id => {
      if (!isStorySeedItem(id)) items.remove(id);
    },
  };
}
