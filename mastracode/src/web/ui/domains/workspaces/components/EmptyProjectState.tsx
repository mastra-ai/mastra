import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

/** Project onboarding shown when no project is active yet. */
export function EmptyProjectState({ onOpenProjects }: { onOpenProjects: () => void }) {
  return (
    <div className="m-auto flex max-w-md flex-col items-center gap-3 px-6 text-center">
      <Txt as="h2" variant="header-md" className="text-icon6">
        Welcome to MastraCode
      </Txt>
      <Txt as="p" variant="ui-md" className="max-w-sm text-icon3">
        Open a project folder to start a coding session. Each project keeps its own threads, memory, and workspace —
        shared with the terminal.
      </Txt>
      <Button variant="primary" className="mt-2" onClick={onOpenProjects}>
        Open a project
      </Button>
    </div>
  );
}
