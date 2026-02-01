export interface Revision {
  id: string;
  publicationDate: string;
  instructions: string;
}

export interface RevisionListProps {
  revisions: Revision[];
  onRevisionClick: (revision: Revision) => void;
}

export interface RevisionListItemProps {
  revision: Revision;
  onClick: () => void;
}

export interface TxtDiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revisionId: string;
  previousText: string;
  currentText: string;
}

export interface RevisionsTabContentProps {
  agentId?: string;
  currentInstructions: string;
}
