import { AgentPlaygroundConfig } from './agent-playground-config';
import type { AgentConfigTab } from './agent-playground-config';
import { useAgentPlaygroundVersionBar } from './agent-playground-version-bar';

interface AgentPlaygroundEditorVersionState {
  isDirty: boolean;
  isSavingDraft: boolean;
  isPublishing: boolean;
  hasDraft: boolean;
  readOnly: boolean;
  isCodeSourceAgent?: boolean;
  showCodeModeActions?: boolean;
  canOpenPr?: boolean;
  isViewingPreviousVersion?: boolean;
}

interface AgentPlaygroundEditorPanelContentProps {
  agentId: string;
  activeVersionId?: string;
  selectedVersionId?: string;
  latestVersionId?: string;
  onVersionSelect: (versionId: string) => void;
  versionState: AgentPlaygroundEditorVersionState;
  openPrTitle?: string;
  onSaveDraft: (changeMessage?: string) => Promise<void>;
  onPublish: () => Promise<void>;
  onDownloadJson?: () => Promise<void>;
  onOpenPr?: () => Promise<void>;
  isViewingPreviousVersion?: boolean;
  selectedConfigTab?: AgentConfigTab;
  onConfigTabChange?: (tab: AgentConfigTab) => void;
}

export function AgentPlaygroundEditorPanelContent({
  agentId,
  activeVersionId,
  selectedVersionId,
  latestVersionId,
  onVersionSelect,
  versionState,
  openPrTitle,
  onSaveDraft,
  onPublish,
  onDownloadJson,
  onOpenPr,
  isViewingPreviousVersion,
  selectedConfigTab,
  onConfigTabChange,
}: AgentPlaygroundEditorPanelContentProps) {
  const { actionBar } = useAgentPlaygroundVersionBar({
    agentId,
    activeVersionId,
    selectedVersionId,
    onVersionSelect,
    ...versionState,
    openPrTitle,
    onSaveDraft,
    onPublish,
    onDownloadJson,
    onOpenPr,
    isViewingPreviousVersion,
    layout: 'panel',
  });

  return (
    <>
      <div className="flex-1 min-h-0">
        <AgentPlaygroundConfig
          agentId={agentId}
          selectedVersionId={selectedVersionId}
          latestVersionId={latestVersionId}
          selectedTab={selectedConfigTab}
          onSelectedTabChange={onConfigTabChange}
        />
      </div>

      {actionBar}
    </>
  );
}
