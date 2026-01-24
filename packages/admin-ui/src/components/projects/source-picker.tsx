import { useState } from 'react';
import { Check, FolderCode, Github } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ValidationStatus } from './validation-status';
import { SourceType, type ProjectSource } from '@/types/api';

interface SourcePickerProps {
  sources: ProjectSource[];
  loading?: boolean;
  selectedSourceId?: string;
  onSelect: (source: ProjectSource) => void;
  validationState?: 'idle' | 'validating' | 'valid' | 'invalid';
  validationMessage?: string;
}

export function SourcePicker({
  sources,
  loading = false,
  selectedSourceId,
  onSelect,
  validationState = 'idle',
  validationMessage,
}: SourcePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSources = sources.filter(
    source =>
      source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.path.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const localSources = filteredSources.filter(s => s.type === SourceType.LOCAL);
  const githubSources = filteredSources.filter(s => s.type === SourceType.GITHUB);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-full" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="source-search">Search Projects</Label>
        <Input
          id="source-search"
          placeholder="Search by name or path..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <ScrollArea className="h-[300px] rounded-md border border-border">
        <div className="p-4 space-y-4">
          {localSources.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-neutral6 uppercase mb-2">Local Projects</h4>
              <div className="space-y-2">
                {localSources.map(source => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    selected={selectedSourceId === source.id}
                    onSelect={() => onSelect(source)}
                  />
                ))}
              </div>
            </div>
          )}

          {githubSources.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-neutral6 uppercase mb-2">GitHub Repositories</h4>
              <div className="space-y-2">
                {githubSources.map(source => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    selected={selectedSourceId === source.id}
                    onSelect={() => onSelect(source)}
                  />
                ))}
              </div>
            </div>
          )}

          {filteredSources.length === 0 && (
            <div className="text-center py-8 text-neutral6">
              {searchQuery ? 'No projects match your search' : 'No projects available'}
            </div>
          )}
        </div>
      </ScrollArea>

      {selectedSourceId && <ValidationStatus state={validationState} message={validationMessage} />}
    </div>
  );
}

interface SourceCardProps {
  source: ProjectSource;
  selected: boolean;
  onSelect: () => void;
}

function SourceCard({ source, selected, onSelect }: SourceCardProps) {
  const Icon = source.type === SourceType.GITHUB ? Github : FolderCode;

  return (
    <Card
      className={cn(
        'p-3 cursor-pointer transition-colors',
        selected ? 'border-accent1 bg-accent1/5' : 'hover:border-accent1/50',
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <Icon className="h-5 w-5 text-neutral6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{source.name}</div>
          <div className="text-sm text-neutral6 truncate">{source.path}</div>
        </div>
        {selected && (
          <div className="flex-shrink-0">
            <Check className="h-5 w-5 text-accent1" />
          </div>
        )}
      </div>
    </Card>
  );
}
