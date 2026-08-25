import { Txt } from '@mastra/playground-ui/components/Txt';
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
          className="border-border1 bg-surface3 fixed inset-x-0 bottom-0 z-50 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <img src="/pwa-192.png" alt="" className="size-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <Txt as="p" variant="ui-md" className="text-icon6 font-medium">
                Install app
              </Txt>
              <Txt as="p" variant="ui-sm" className="text-icon4 truncate">
                Get faster access from your home screen
              </Txt>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="text-icon4 hover:text-icon6 focus-visible:ring-accent1 text-ui-sm shrink-0 rounded-md px-3 py-1.5 focus-visible:ring-2 focus-visible:outline-none"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={onInstall}
              className="bg-accent1 text-ui-sm focus-visible:ring-accent1 shrink-0 rounded-md px-3 py-1.5 font-medium text-black focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Install
            </button>
          </div>
        </div>
      )}
      <PwaInstallInstructions open={instructionsOpen} onOpenChange={setInstructionsOpen} />
    </>
  );
}
