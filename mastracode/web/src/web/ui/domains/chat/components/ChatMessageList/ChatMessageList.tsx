import { useActiveProjectContext } from '../../../workspaces';
import { ConnectionNotice } from './ConnectionNotice';
import { TranscriptPanel } from './TranscriptPanel';

export function ChatMessageList() {
  const { activeProject } = useActiveProjectContext();

  if (!activeProject) return null;

  return (
    <div className="flex min-h-0 flex-col overflow-y-auto">
      <ConnectionNotice />
      <TranscriptPanel />
    </div>
  );
}
