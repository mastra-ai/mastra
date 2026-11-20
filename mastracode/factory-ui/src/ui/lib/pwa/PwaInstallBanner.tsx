import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import { PwaInstallInstructions } from './PwaInstallInstructions';
import { usePwaInstall } from './usePwaInstall';

/**
 * Mobile-only banner offering to install the app as a PWA. Self-aware: renders
 * nothing unless an install path exists (native prompt or iOS manual install)
 * and the user hasn't recently dismissed it. Hidden on desktop via CSS.
 *
 * Renders in normal flow, so the host layout must give it a row above the page
 * instead of letting it overlay content.
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
          className="border-border bg-card shrink-0 border-b pt-[env(safe-area-inset-top)] lg:hidden"
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
            <Button variant="ghost" size="sm" className="shrink-0" onClick={dismiss}>
              Not now
            </Button>
            <Button variant="primary" size="sm" className="shrink-0" onClick={onInstall}>
              Install
            </Button>
          </div>
        </div>
      )}
      <PwaInstallInstructions open={instructionsOpen} onOpenChange={setInstructionsOpen} />
    </>
  );
}
