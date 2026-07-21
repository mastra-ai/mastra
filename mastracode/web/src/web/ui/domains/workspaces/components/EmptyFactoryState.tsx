import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

/** Factory onboarding shown when no factory is active yet. */
export function EmptyFactoryState({ onOpenFactories }: { onOpenFactories: () => void }) {
  return (
    <div className="m-auto flex h-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <Txt as="h2" variant="header-md" className="text-icon6">
        Welcome to MastraCode
      </Txt>
      <Txt as="p" variant="ui-md" className="max-w-sm text-icon3">
        Create a Factory bound to a local folder or GitHub repository to start a coding session. Each Factory keeps its
        own threads, memory, and workspace — shared with the terminal.
      </Txt>
      <Button variant="primary" className="mt-2" onClick={onOpenFactories}>
        Create factory from local folder
      </Button>
    </div>
  );
}
