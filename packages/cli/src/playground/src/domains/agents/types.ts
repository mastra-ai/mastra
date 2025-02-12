export interface PromptVersion {
  content: string;
  timestamp: Date;
  analysis?: string;
  status: 'original' | 'draft' | 'published' | 'active';
}

export interface VersionActionsProps {
  version: PromptVersion;
  index: number;
  isUpdating: boolean;
  onCopy: (content: string, index: number) => Promise<void>;
  onSetActive: (version: PromptVersion, index: number) => Promise<void>;
  onDelete: (index: number) => void;
  copiedVersions: Record<number, boolean>;
}
