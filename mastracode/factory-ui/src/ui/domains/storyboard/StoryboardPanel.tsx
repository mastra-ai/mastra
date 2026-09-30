import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronLeft, ChevronRight, Download, MapIcon, Minus, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router';

import { settingsSectionPath } from '../settings/settingsSections';
import { KnobSelect, StoryboardKnobs } from './StoryboardKnobs';
import type { Storyboard } from './StoryboardProvider';
import { useStoryboard } from './StoryboardProvider';
import { STORIES } from './stories';
import type { StoryPlace } from './stories';
import { StoryOnboardingScreen, useOnboardingCoversApp } from './StoryOnboarding';
import { focusCardSummary } from './storySummary';
import type { ViewerRole } from './storyState';

const STORY_OPTIONS = STORIES.map(story => ({ value: story.id, label: story.title }));

const FIRST_ONBOARDING_STORY = 'onboarding-cloudflare';

const ROLE_OPTIONS: { value: ViewerRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
];

function RestartOnboarding({ storyboard }: { storyboard: Storyboard }) {
  const startsWithOnboarding = storyboard.story.steps[0]?.where === 'onboarding';
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={<RotateCcw aria-hidden />}
      onClick={() => storyboard.setStory(startsWithOnboarding ? storyboard.story.id : FIRST_ONBOARDING_STORY)}
    >
      Restart onboarding
    </Button>
  );
}

function ImportIssues({ storyboard }: { storyboard: Storyboard }) {
  if (storyboard.state.boardImported) return null;
  return (
    <Button variant="primary" icon={<Download aria-hidden />} onClick={() => storyboard.patch({ boardImported: true })}>
      Import the open issues
    </Button>
  );
}

const PLACE_LABELS: Record<StoryPlace, string> = {
  onboarding: 'Onboarding covers the app',
  board: 'Go to the board',
  session: 'Session',
  settings: 'Go to model settings',
  rules: 'Go to rules',
};

function placePath(place: StoryPlace, factoryId: string): string | null {
  if (place === 'board') return `/factories/${factoryId}/work`;
  if (place === 'settings') return settingsSectionPath(factoryId, 'models');
  if (place === 'rules') return `/factories/${factoryId}/rules`;
  return null;
}

function StepList({ storyboard }: { storyboard: Storyboard }) {
  return (
    <ol className="flex flex-col">
      {storyboard.story.steps.map((step, index) => (
        <li key={step.title}>
          <button
            type="button"
            aria-current={index === storyboard.stepIndex ? 'step' : undefined}
            onClick={() => storyboard.setStep(index)}
            className={cn(
              'text-body-sm flex w-full gap-2 rounded-md px-2 py-1 text-left',
              index === storyboard.stepIndex
                ? 'bg-fill-active text-foreground'
                : 'text-muted-foreground hover:bg-fill-hover hover:text-foreground',
              focusRing,
            )}
          >
            <span className="tabular-nums">{index + 1}.</span>
            <span>{step.title}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function GoThere({ place }: { place: StoryPlace }) {
  const { factoryId } = useParams<{ factoryId: string }>();
  const navigate = useNavigate();
  const path = factoryId ? placePath(place, factoryId) : null;
  if (path === null) {
    return (
      <Txt variant="caption" tone="muted">
        {place === 'session' ? 'Open any card’s session' : PLACE_LABELS[place]}
      </Txt>
    );
  }
  return (
    <Button size="sm" onClick={() => navigate(path)}>
      {PLACE_LABELS[place]}
    </Button>
  );
}

function ProblemMapLink() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const navigate = useNavigate();
  if (!factoryId) return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={<MapIcon aria-hidden />}
      onClick={() => navigate(`/factories/${factoryId}/problem-map`)}
    >
      Problem map
    </Button>
  );
}

export function StoryboardPanel() {
  return (
    <>
      <StoryOnboardingScreen />
      <FloatingPanel />
    </>
  );
}

function FloatingPanel() {
  const storyboard = useStoryboard();
  const [collapsed, setCollapsed] = useState(false);
  const [popupContainer, setPopupContainer] = useState<HTMLDivElement | null>(null);
  const onboardingCoversApp = useOnboardingCoversApp();
  if (storyboard === null) return null;

  const { story, step, stepIndex } = storyboard;
  const lastStepIndex = story.steps.length - 1;
  const goToStep = (index: number) => storyboard.setStep(Math.max(0, Math.min(lastStepIndex, index)));
  const dock = onboardingCoversApp ? 'fixed right-4 bottom-4 z-60' : 'fixed bottom-4 left-4 z-60';

  const stepWithArrowKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    if (event.key === 'ArrowLeft') goToStep(stepIndex - 1);
    else if (event.key === 'ArrowRight') goToStep(stepIndex + 1);
  };

  if (collapsed) {
    return (
      <div className={dock}>
        <Button size="sm" onClick={() => setCollapsed(false)}>
          Storyboard · {stepIndex + 1}/{story.steps.length}
        </Button>
      </div>
    );
  }

  const summary = focusCardSummary(storyboard.state);

  return (
    <div className={dock}>
      <section
        aria-label="Storyboard"
        tabIndex={-1}
        onKeyDown={stepWithArrowKeys}
        className="border-info-edge bg-popover shadow-overlay flex max-h-[calc(100dvh-2rem)] w-80 flex-col gap-3 overflow-y-auto rounded-xl border border-dashed p-3 outline-none"
      >
        <header className="flex items-center gap-1">
          <Txt as="span" variant="column" tone="muted" className="flex-1 uppercase">
            Storyboard · prototype
          </Txt>
          {storyboard.overridden && (
            <Button size="sm" variant="ghost" onClick={storyboard.reset}>
              Reset step
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" aria-label="Collapse storyboard" onClick={() => setCollapsed(true)}>
            <Minus />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Remove storyboard"
            tooltip="Remove storyboard (?storyboard to bring it back)"
            onClick={storyboard.close}
          >
            <X />
          </Button>
        </header>

        <div className="flex flex-col gap-1">
          <KnobSelect
            label="Story"
            value={story.id}
            options={STORY_OPTIONS}
            onChange={storyboard.setStory}
            popupContainer={popupContainer}
            wide
          />
          <Txt variant="caption" tone="faint">
            {story.who}
          </Txt>
        </div>

        <KnobSelect
          label="See as"
          value={storyboard.state.viewerRole}
          options={ROLE_OPTIONS}
          onChange={storyboard.setViewerRole}
          popupContainer={popupContainer}
        />

        <StepList storyboard={storyboard} />

        <div className="flex flex-col gap-2">
          <Txt variant="body-sm">{step.narration}</Txt>
          <ImportIssues storyboard={storyboard} />
          {step.decision && (
            <Notice variant="info" title="Open question">
              {step.decision}
            </Notice>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Previous step"
            disabled={stepIndex === 0}
            onClick={() => goToStep(stepIndex - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Next step"
            disabled={stepIndex === lastStepIndex}
            onClick={() => goToStep(stepIndex + 1)}
          >
            <ChevronRight />
          </Button>
          <div className="ml-auto">
            <GoThere place={step.where} />
          </div>
        </div>

        {summary && (
          <Txt variant="caption" tone="muted">
            {summary}
          </Txt>
        )}

        <div className="flex flex-wrap gap-1">
          <ProblemMapLink />
          <RestartOnboarding storyboard={storyboard} />
        </div>

        <StoryboardKnobs storyboard={storyboard} popupContainer={popupContainer} />
      </section>
      <div ref={setPopupContainer} />
    </div>
  );
}
