'use client';

import { useState } from 'react';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { SectionHeader } from '@/domains/cms';

import { RevisionList } from './revision-list';
import { TxtDiffModal } from './txt-diff-modal';
import type { RevisionsTabContentProps, Revision } from './types';

const MOCK_REVISIONS: Revision[] = [
  {
    id: 'rev_abc123def456',
    publicationDate: '2024-01-15T10:30:00Z',
    instructions:
      'You are a helpful assistant that specializes in answering questions about programming and software development. Be concise and provide code examples when relevant.',
  },
  {
    id: 'rev_ghi789jkl012',
    publicationDate: '2024-01-10T14:45:00Z',
    instructions:
      'You are an assistant that helps with programming questions. Focus on providing clear explanations.',
  },
  {
    id: 'rev_mno345pqr678',
    publicationDate: '2024-01-05T09:15:00Z',
    instructions: 'You are a test assistant for development purposes.',
  },
];

export function RevisionsTabContent({ agentId, currentInstructions }: RevisionsTabContentProps) {
  const [selectedRevision, setSelectedRevision] = useState<Revision | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleRevisionClick = (revision: Revision) => {
    setSelectedRevision(revision);
    setIsModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setSelectedRevision(null);
    }
  };

  // TODO: Replace MOCK_REVISIONS with real data fetched using agentId
  const revisions = MOCK_REVISIONS;

  return (
    <>
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-6 p-4">
          <SectionHeader
            title="Revisions"
            subtitle={
              agentId
                ? 'Click a revision to compare its instructions with your current draft.'
                : 'Mock revisions for testing. Save your agent to track real revisions.'
            }
          />

          <RevisionList revisions={revisions} onRevisionClick={handleRevisionClick} />
        </div>
      </ScrollArea>

      {selectedRevision && (
        <TxtDiffModal
          open={isModalOpen}
          onOpenChange={handleModalClose}
          revisionId={selectedRevision.id}
          previousText={selectedRevision.instructions}
          currentText={currentInstructions}
        />
      )}
    </>
  );
}
