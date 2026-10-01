import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { X } from 'lucide-react';

import type { EditorLspLocation } from '../../../api/types';

export interface ReferencesResult {
  /** The symbol name the references were queried for. */
  symbol: string;
  locations: EditorLspLocation[];
}

interface ReferencesPanelProps {
  result: ReferencesResult;
  onOpen(path: string, line: number): void;
  onClear(): void;
}

/** Find-all-references results, grouped by file, click to jump. */
export function ReferencesPanel({ result, onOpen, onClear }: ReferencesPanelProps) {
  const groups = new Map<string, EditorLspLocation[]>();
  for (const location of result.locations) {
    const list = groups.get(location.path) ?? [];
    list.push(location);
    groups.set(location.path, list);
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex items-center gap-2 border-b px-2 py-1.5">
        <Txt variant="caption" className="text-muted-foreground min-w-0 flex-1 truncate">
          {result.locations.length} reference{result.locations.length === 1 ? '' : 's'} to{' '}
          <span className="text-foreground font-mono">{result.symbol}</span>
        </Txt>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Clear references" onClick={onClear}>
          <X size={14} />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {[...groups.entries()].map(([path, locations]) => (
          <div key={path} className="border-border/50 border-b py-1 last:border-b-0">
            <div
              className="text-meta text-muted-foreground bg-fill-subtle/50 flex items-center justify-between gap-2 px-2 py-1"
              title={path}
            >
              <span className="truncate font-mono">
                {path}
                {locations[0]?.external ? (
                  <span className="text-muted-foreground/70"> · library</span>
                ) : null}
              </span>
              <span className="tabular-nums">{locations.length}</span>
            </div>
            {locations.map((location, index) => (
              <button
                key={`${location.line}-${location.character}-${index}`}
                type="button"
                onClick={() => onOpen(location.path, location.line)}
                className="text-caption text-muted-foreground hover:bg-fill-hover hover:text-foreground focus-visible:bg-fill-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent3/60 flex w-full items-center gap-2 px-2 py-0.5 text-left"
              >
                <span className="text-muted-foreground/70 w-8 shrink-0 text-right font-mono tabular-nums">
                  {location.line}
                </span>
                <span className="text-muted-foreground/70 truncate">col {location.character}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
