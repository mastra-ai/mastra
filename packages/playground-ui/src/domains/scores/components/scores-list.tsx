import { ClientScoreRowData } from '@mastra/client-js';
import { EntryList, EntryListTrim, EntryListHeader, EntryListEntries } from '@/components/ui/elements';
import { format, isToday } from 'date-fns';
import { useState } from 'react';
import { EntryListPagination } from '@/components/ui/elements/entry-list/entry-list-pagination';

export const scoresListColumns = [
  { name: 'date', label: 'Date', size: '4.5rem' },
  { name: 'time', label: 'Time', size: '6.5rem' },
  { name: 'input', label: 'Input', size: '1fr' },
  { name: 'entityId', label: 'Entity', size: '10rem' },
  { name: 'score', label: 'Score', size: '3rem' },
];

type ScoresToolsProps = {
  onScoreClick?: (id: string) => void;
  scores?: ClientScoreRowData[];
  pagination?: {
    total: number;
    hasMore: boolean;
    perPage: number;
    page: number;
  };
  onPageChange?: (page: number) => void;
};

export function ScoresList({ scores, pagination, onScoreClick, onPageChange }: ScoresToolsProps) {
  if (!scores) {
    return null;
  }

  const scoresHasMore = pagination?.hasMore;

  const entries = scores.map(score => {
    const createdAtDate = new Date(score.createdAt);
    const isTodayDate = isToday(createdAtDate);

    return {
      id: score.id,
      date: isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd'),
      time: format(createdAtDate, 'h:mm:ss aaa'),
      input: JSON.stringify(score?.input),
      entityId: score.entityId,
      score: score.score,
    };
  });

  const handleNextPage = () => {
    if (scoresHasMore) {
      onPageChange?.(pagination.page + 1);
    }
  };

  const handlePrevPage = () => {
    if (pagination?.page && pagination.page > 0) {
      onPageChange?.(pagination.page - 1);
    }
  };

  return (
    <EntryList>
      <EntryListTrim>
        <EntryListHeader columns={scoresListColumns} />
        <EntryListEntries entries={entries} columns={scoresListColumns} onEntryClick={onScoreClick} />
      </EntryListTrim>
      <EntryListPagination
        currentPage={pagination?.page || 0}
        onNextPage={handleNextPage}
        onPrevPage={handlePrevPage}
        hasMore={scoresHasMore}
      />
    </EntryList>
  );
}
