import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Txt } from '@mastra/playground-ui/components/Txt';

interface PwaInstallInstructionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** iOS/iPadOS Safari has no install prompt; walk the user through Add to Home Screen. */
export function PwaInstallInstructions({ open, onOpenChange }: PwaInstallInstructionsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md" aria-label="Install this app">
        <DialogHeader className="px-5 pt-4 pb-2">
          <DialogTitle>Install this app</DialogTitle>
        </DialogHeader>
        <ol className="flex list-decimal flex-col gap-2 px-5 pb-5 pl-9">
          <li>
            <Txt as="span" variant="ui-sm" className="text-icon5">
              Tap the Share button in Safari&rsquo;s toolbar
            </Txt>
          </li>
          <li>
            <Txt as="span" variant="ui-sm" className="text-icon5">
              Scroll down and tap &ldquo;Add to Home Screen&rdquo;
            </Txt>
          </li>
          <li>
            <Txt as="span" variant="ui-sm" className="text-icon5">
              Tap &ldquo;Add&rdquo; to install the app
            </Txt>
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}
