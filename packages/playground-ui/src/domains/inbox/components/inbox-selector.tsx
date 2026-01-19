import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';

export interface InboxSelectorProps {
  inboxes: Array<{ id: string; name?: string }>;
  selectedInboxId: string | null;
  onSelect: (inboxId: string) => void;
  isLoading?: boolean;
}

export function InboxSelector({ inboxes, selectedInboxId, onSelect, isLoading }: InboxSelectorProps) {
  if (isLoading) {
    return <div className="h-10 w-48 animate-pulse rounded bg-surface3" />;
  }

  if (inboxes.length === 0) {
    return <div className="text-text3 text-sm">No inboxes configured</div>;
  }

  return (
    <Select value={selectedInboxId ?? undefined} onValueChange={onSelect}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Select inbox" />
      </SelectTrigger>
      <SelectContent>
        {inboxes.map(inbox => (
          <SelectItem key={inbox.id} value={inbox.id}>
            {inbox.name ?? inbox.id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
