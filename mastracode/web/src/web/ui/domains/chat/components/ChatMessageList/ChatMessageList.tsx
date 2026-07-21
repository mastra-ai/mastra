import { useActiveFactoryContext } from '../../../workspaces';
import { GoalPanel } from '../GoalPanel';
import { ConnectionNotice } from './ConnectionNotice';
import { TranscriptPanel } from './TranscriptPanel';

export function ChatMessageList() {
  const { activeFactory } = useActiveFactoryContext();

  if (!activeFactory) return null;

  return (
    <div className="flex min-h-0 flex-col overflow-y-auto">
      <GoalPanel />
      <ConnectionNotice />
      <TranscriptPanel />
    </div>
  );
}
