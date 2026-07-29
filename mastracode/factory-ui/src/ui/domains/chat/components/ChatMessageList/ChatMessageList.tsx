import { workspaceFilesInsetClass } from '../../../workspace-viewer/layout';
import { GoalPanel } from '../GoalPanel';
import { ConnectionNotice } from './ConnectionNotice';
import { TranscriptPanel } from './TranscriptPanel';

export function ChatMessageList() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className={workspaceFilesInsetClass}>
        <GoalPanel />
        <ConnectionNotice />
      </div>
      <TranscriptPanel />
    </div>
  );
}
