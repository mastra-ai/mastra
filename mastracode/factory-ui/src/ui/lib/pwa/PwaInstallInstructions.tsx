import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@mastra/playground-ui/components/Drawer';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Menu, Share, Smartphone, SquarePlus } from 'lucide-react';
import type { ReactNode } from 'react';

import type { IosBrowser } from './platform';
import { detectIosBrowser } from './platform';

interface PwaInstallInstructionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Where the share menu lives differs per iOS browser. */
function shareStep(browser: IosBrowser): { icon: ReactNode; label: ReactNode } {
  switch (browser) {
    case 'chrome':
      return {
        icon: <Share className="size-4" aria-hidden="true" />,
        label: (
          <>
            Tap the <span className="text-icon6 font-medium">Share</span> button in Chrome&rsquo;s address bar
          </>
        ),
      };
    case 'firefox':
    case 'edge':
    case 'opera':
      return {
        icon: <Menu className="size-4" aria-hidden="true" />,
        label: (
          <>
            Open the browser menu and tap <span className="text-icon6 font-medium">Share</span>
          </>
        ),
      };
    case 'safari':
      return {
        icon: <Share className="size-4" aria-hidden="true" />,
        label: (
          <>
            Tap the <span className="text-icon6 font-medium">Share</span> button in Safari&rsquo;s toolbar
          </>
        ),
      };
  }
}

const commonSteps: Array<{ icon: ReactNode; label: ReactNode }> = [
  {
    icon: <SquarePlus className="size-4" aria-hidden="true" />,
    label: (
      <>
        Scroll down and tap <span className="text-icon6 font-medium">Add to Home Screen</span>
      </>
    ),
  },
  {
    icon: <Smartphone className="size-4" aria-hidden="true" />,
    label: (
      <>
        Tap <span className="text-icon6 font-medium">Add</span> to install the app
      </>
    ),
  },
];

/** iOS/iPadOS has no install prompt; walk the user through Add to Home Screen. */
export function PwaInstallInstructions({ open, onOpenChange }: PwaInstallInstructionsProps) {
  const steps = [shareStep(detectIosBrowser() ?? 'safari'), ...commonSteps];
  return (
    <Drawer open={open} onOpenChange={onOpenChange} side="bottom">
      <DrawerContent aria-label="Install this app">
        <DrawerHeader>
          <div className="flex items-center gap-3">
            <div className="border-border1 bg-surface5 text-icon6 flex size-10 shrink-0 items-center justify-center rounded-lg border">
              <Smartphone className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <DrawerTitle>Install this app</DrawerTitle>
              <DrawerDescription>Add it to your home screen in three steps</DrawerDescription>
            </div>
          </div>
        </DrawerHeader>
        <DrawerBody>
          <ol className="flex flex-col">
            {steps.map((step, index) => (
              <li key={index} className="flex items-center gap-3 py-3">
                <span
                  aria-hidden="true"
                  className="bg-surface5 text-icon6 text-ui-xs flex size-6 shrink-0 items-center justify-center rounded-full font-medium tabular-nums"
                >
                  {index + 1}
                </span>
                <Txt as="span" variant="ui-md" className="text-icon5 min-w-0 flex-1">
                  {step.label}
                </Txt>
                <span className="text-icon3 shrink-0">{step.icon}</span>
              </li>
            ))}
          </ol>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
