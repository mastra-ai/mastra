import { ClientScoreRowData } from '@mastra/client-js';
import {
  EntryList,
  EntryListEdging,
  EntryListEntries,
  EntryListHeader,
  EntryListEntriesSkeleton,
} from '@/components/ui/elements';
import { format, isToday } from 'date-fns';

export const entryListColumns = [
  { name: 'date', label: 'Date', size: '4.5rem' },
  { name: 'time', label: 'Time', size: '6.5rem' },
  { name: 'input', label: 'Input', size: '1fr' },
  { name: 'entityId', label: 'Entity', size: '10rem' },
  { name: 'score', label: 'Score', size: '3rem' },
];

type ScoresToolsProps = {
  scores?: ClientScoreRowData[];
  isLoading?: boolean;
};

export function ScoresList({ scores, isLoading }: ScoresToolsProps) {
  if (!scores) {
    return null;
  }

  const entries = scores.map(score => {
    const createdAtDate = new Date(score.createdAt);
    const isTodayDate = isToday(createdAtDate);

    return {
      id: score.id,
      date: isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd'),
      time: format(createdAtDate, 'h:mm:ss aaa'),
      input: score?.input?.inputMessages?.[0]?.content || '',
      entityId: score.entityId,
      score: score.score,
    };
  });

  return (
    <EntryList>
      <EntryListEdging>
        <EntryListHeader columns={entryListColumns} />
        <EntryListEntriesSkeleton columns={entryListColumns} />

        {/* {isLoading && <EntryListEntriesSkeleton columns={entryListColumns} />}
        <EntryListEntries entries={entries} columns={entryListColumns} /> */}
      </EntryListEdging>
    </EntryList>
  );
}
