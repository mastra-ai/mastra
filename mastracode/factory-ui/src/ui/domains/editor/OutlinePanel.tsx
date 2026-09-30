import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Braces, Box, CircleDot, FunctionSquare, Hash, ListTree, Type } from 'lucide-react';
import type { ReactNode } from 'react';

import type { EditorLspSymbol } from '../../../api/types';

function symbolIcon(kind: string): ReactNode {
  switch (kind) {
    case 'function':
    case 'method':
    case 'constructor':
      return <FunctionSquare className="text-notice-info/70 size-3.5 shrink-0" />;
    case 'class':
    case 'interface':
    case 'struct':
    case 'enum':
      return <Box className="text-notice-warning/70 size-3.5 shrink-0" />;
    case 'type parameter':
      return <Type className="text-muted-foreground size-3.5 shrink-0" />;
    case 'property':
    case 'field':
    case 'enum member':
      return <Hash className="text-muted-foreground size-3.5 shrink-0" />;
    case 'variable':
    case 'constant':
      return <CircleDot className="text-muted-foreground size-3.5 shrink-0" />;
    default:
      return <Braces className="text-muted-foreground size-3.5 shrink-0" />;
  }
}

function SymbolRow({
  symbol,
  depth,
  activeLine,
  onJump,
}: {
  symbol: EditorLspSymbol;
  depth: number;
  activeLine: number | null;
  onJump(line: number): void;
}) {
  const containsCursor = activeLine !== null && symbol.line <= activeLine && activeLine <= symbol.endLine;
  return (
    <>
      <button
        type="button"
        onClick={() => onJump(symbol.line)}
        title={`${symbol.kind} · line ${symbol.line}`}
        className={cn(
          'text-body-sm hover:bg-fill-hover focus-visible:bg-fill-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent3/60 flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left',
          containsCursor ? 'bg-fill-subtle/60 text-foreground font-medium' : 'text-muted-foreground',
        )}
        style={{ paddingLeft: `${depth * 0.75 + 0.375}rem` }}
      >
        {symbolIcon(symbol.kind)}
        <span className="truncate">{symbol.name}</span>
      </button>
      {symbol.children?.map((child, index) => (
        <SymbolRow
          key={`${child.name}-${child.line}-${index}`}
          symbol={child}
          depth={depth + 1}
          activeLine={activeLine}
          onJump={onJump}
        />
      ))}
    </>
  );
}

interface OutlinePanelProps {
  symbols: EditorLspSymbol[] | null;
  loading: boolean;
  activeLine: number | null;
  onJump(line: number): void;
}

/** Document symbol tree for the active file; click a node to jump to it. */
export function OutlinePanel({ symbols, loading, activeLine, onJump }: OutlinePanelProps) {
  if (loading) {
    return (
      <div className="text-caption text-muted-foreground flex items-center gap-2 px-3 py-3">
        <Spinner className="size-3.5 shrink-0" /> Reading symbols…
      </div>
    );
  }
  if (!symbols || symbols.length === 0) {
    return (
      <div className="text-muted-foreground grid h-full place-items-center px-3 py-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <ListTree size={20} className="opacity-40" aria-hidden />
          <span className="text-caption">No symbols in this file.</span>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-0 overflow-y-auto py-1">
      {symbols.map((symbol, index) => (
        <SymbolRow
          key={`${symbol.name}-${symbol.line}-${index}`}
          symbol={symbol}
          depth={0}
          activeLine={activeLine}
          onJump={onJump}
        />
      ))}
    </div>
  );
}
