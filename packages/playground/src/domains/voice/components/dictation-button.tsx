import { Button } from '@mastra/playground-ui/components/Button';
import { ComposerStopButton } from '@mastra/playground-ui/components/Composer';
import { Mic } from 'lucide-react';

export function DictationButton({ listening, onClick }: { listening: boolean; onClick: () => void }) {
  if (listening) return <ComposerStopButton tooltip="Stop dictation" onClick={onClick} />;
  return (
    <Button variant="default" size="icon-md" type="button" tooltip="Start dictation" onClick={onClick}>
      <Mic className="text-neutral3 hover:text-neutral6 size-5" />
    </Button>
  );
}
