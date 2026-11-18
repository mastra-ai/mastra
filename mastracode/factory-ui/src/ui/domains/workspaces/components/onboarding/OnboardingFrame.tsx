import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';

import { OnboardingAccountMenu } from './OnboardingAccountMenu';
import './onboarding.css';

interface OnboardingFrameContextValue {
  mainRef: RefObject<HTMLElement | null>;
  visualHost: HTMLDivElement | null;
}

const OnboardingFrameContext = createContext<OnboardingFrameContextValue | undefined>(undefined);

function useOnboardingFrame(): OnboardingFrameContextValue {
  const frame = useContext(OnboardingFrameContext);
  if (!frame) throw new Error('useOnboardingFrame must be used within an OnboardingFrame');
  return frame;
}

export function useOnboardingMainRef(): RefObject<HTMLElement | null> {
  return useOnboardingFrame().mainRef;
}

export function OnboardingFrameVisual({ children }: { children: ReactNode }) {
  const { visualHost } = useOnboardingFrame();
  return visualHost ? createPortal(children, visualHost) : null;
}

export function OnboardingFrame({ children }: { children: ReactNode }) {
  const showVisual = !useIsMobile(900);
  const mainRef = useRef<HTMLElement>(null);
  const [visualHost, setVisualHost] = useState<HTMLDivElement | null>(null);

  return (
    <OnboardingFrameContext.Provider value={{ mainRef, visualHost }}>
      <div className="bg-background text-foreground min-h-dvh min-[900px]:grid min-[900px]:grid-cols-[minmax(0,600px)_minmax(0,1fr)]">
        <div className="flex min-h-dvh flex-col">
          <header className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <LogoWithoutText className="w-6" aria-hidden="true" />
              <Txt as="span" variant="label">
                Factory
              </Txt>
            </div>
            <OnboardingAccountMenu />
          </header>
          <main
            ref={mainRef}
            className="mx-auto flex w-full max-w-[520px] flex-col gap-2 px-4 pt-6 pb-6 min-[900px]:px-5"
          >
            <Txt as="h1" variant="display" className="mb-4">
              Set up your factory
            </Txt>
            {children}
          </main>
          <Txt as="p" variant="meta" tone="muted" className="mt-auto px-6 pt-2 pb-32 min-[900px]:pb-5">
            You can change your codebase, work sources and model anytime in Settings.
          </Txt>
        </div>
        {/* The page scrolls the form; the preview stays pinned to the viewport beside it, like ChatGPT's main pane. */}
        {showVisual && (
          <div className="sticky top-0 h-dvh p-2">
            <div
              ref={setVisualHost}
              className="onboarding-card bg-card rounded-studio-frame h-full overflow-hidden p-px"
            />
          </div>
        )}
      </div>
    </OnboardingFrameContext.Provider>
  );
}
