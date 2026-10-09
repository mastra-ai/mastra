import { cn } from '@mastra/playground-ui/utils/cn';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { useState } from 'react';

import { PwaInstallInstructions } from './PwaInstallInstructions';
import { usePwaInstall } from './usePwaInstall';

/**
 * Mobile-only banner offering to install the app as a PWA. Self-aware: renders
 * nothing unless an install path exists (native prompt or iOS manual install)
 * and the user hasn't recently dismissed it. Hidden on desktop via CSS.
 */
export function PwaInstallBanner() {
  const { canInstall, installationMethod, install, dismiss } = usePwaInstall();
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  if (!canInstall && !instructionsOpen) return null;

  const onInstall = () => {
    if (installationMethod === 'manual') {
      setInstructionsOpen(true);
    }
    void install();
  };

  return (
    <>
      {canInstall && (
        <div
          role="region"
          aria-label="Install app"
          className="border-border bg-card fixed inset-x-0 bottom-0 z-50 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <img src="/pwa-192.png" alt="" className="size-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <Txt tone="ink" as="p" variant="subheading">
                Install app
              </Txt>
              <Txt tone="muted" as="p" variant="caption" className="truncate">
                Get faster access from your home screen
              </Txt>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className={cn(
                'text-muted-foreground',
                `hover:text-foreground shrink-0 rounded-md px-3 py-1.5 ${focusRing}`,
              )}
            >
              <Txt as="span" variant="caption" className="block">
                Not now
              </Txt>
            </button>
            <button
              type="button"
              onClick={onInstall}
              className={`bg-brand-green shrink-0 rounded-md px-3 py-1.5 text-black ${focusRing}`}
            >
              <Txt as="span" variant="column" className="block">
                Install
              </Txt>
            </button>
          </div>
        </div>
      )}
      <PwaInstallInstructions open={instructionsOpen} onOpenChange={setInstructionsOpen} />
    </>
  );
}
