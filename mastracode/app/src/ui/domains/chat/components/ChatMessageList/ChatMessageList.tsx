import { useActiveProjectContext } from '../../../workspaces/context/ActiveProjectProvider';
import { GoalPanel } from '../GoalPanel';
import { ConnectionNotice } from './ConnectionNotice';
import { TranscriptPanel } from './TranscriptPanel';

export function ChatMessageList() {
  const { activeProject } = useActiveProjectContext();

  if (!activeProject) return null;

  return (
    <div className="flex min-h-0 flex-col overflow-y-auto">
      <GoalPanel />
      <ConnectionNotice />
      <TranscriptPanel />
    </div>
  );
}
