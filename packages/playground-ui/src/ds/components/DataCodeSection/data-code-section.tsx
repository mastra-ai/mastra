import { Chunk } from '@codemirror/merge';
import { Text } from '@codemirror/state';
import { AlignJustifyIcon, AlignLeftIcon, ExpandIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { Code } from '@/ds/components/Code/code';
import { CopyButton } from '@/ds/components/CopyButton';
import { DataPanelSectionHeading } from '@/ds/components/DataPanel/data-panel-section-heading';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/ds/components/Dialog';
import { SearchFieldBlock } from '@/ds/components/FormFieldBlocks/fields/search-field-block';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

export interface DataCodeSectionDiff {
  /** The other document to compare against. */
  against: string;
  /** `a` = this document is the "before" (changes in red), `b` = "after" (changes in green). */
  side: 'a' | 'b';
}

/** Zero-based indexes of the lines of `doc` that differ from `diff.against`. */
function changedLines(doc: string, { against, side }: DataCodeSectionDiff): Set<number> {
  const [a, b] = side === 'a' ? [doc, against] : [against, doc];
  const text = Text.of(doc.split('\n'));
  const lines = new Set<number>();
  for (const chunk of Chunk.build(Text.of(a.split('\n')), Text.of(b.split('\n')))) {
    const from = side === 'a' ? chunk.fromA : chunk.fromB;
    const to = side === 'a' ? chunk.endA : chunk.endB;
    if (from >= to) continue;
    for (let pos = from; pos <= Math.min(to, text.length);) {
      const line = text.lineAt(pos);
      lines.add(line.number - 1);
      if (line.to >= to) break;
      pos = line.to + 1;
    }
  }
  return lines;
}

const diffLineStyles = {
  removed: 'code-diff-removed bg-destructive-indicator/18',
  added: 'code-diff-added bg-success-indicator/18',
};
const searchMatchStyle = 'code-search-match rounded-sm bg-warning-indicator/30';

interface CodeViewProps {
  code: string;
  changed?: Set<number>;
  diffSide?: DataCodeSectionDiff['side'];
  searchQuery: string;
}

function CodeView({ code, changed, diffSide, searchQuery }: CodeViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const query = searchQuery.toLowerCase();

  useEffect(() => {
    if (query) ref.current?.querySelector('.code-search-match')?.scrollIntoView({ block: 'nearest' });
  }, [query]);

  const lineClassName = useCallback(
    (index: number, text: string) => {
      const classes: string[] = [];
      if (diffSide && changed?.has(index)) classes.push(diffLineStyles[diffSide === 'a' ? 'removed' : 'added']);
      if (query && text.toLowerCase().includes(query)) classes.push(searchMatchStyle);
      return classes.length ? classes.join(' ') : undefined;
    },
    [changed, diffSide, query],
  );

  return (
    <div ref={ref}>
      <Code
        code={code}
        lang="json"
        lineClassName={lineClassName}
        className="font-mono text-caption break-all whitespace-pre-wrap"
      />
    </div>
  );
}

// -- Component ----------------------------------------------------------------

export interface DataCodeSectionProps {
  title: React.ReactNode;
  dialogTitle?: React.ReactNode;
  icon?: React.ReactNode;
  codeStr?: string;
  simplified?: boolean;
  className?: string;
  /** Highlight lines that differ from another document. */
  diff?: DataCodeSectionDiff;
  /** Extra controls rendered in the header, before the built-in copy/expand buttons. */
  actions?: React.ReactNode;
}

export function DataCodeSection({
  codeStr = '',
  title,
  dialogTitle,
  icon,
  simplified = false,
  className,
  diff,
  actions,
}: DataCodeSectionProps) {
  const changed = useMemo(() => (diff ? changedLines(codeStr, diff) : undefined), [codeStr, diff]);
  const [showAsMultilineText, setShowAsMultilineText] = useState(false);
  const [searchMinimized, setSearchMinimized] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOpen, setExpandedOpen] = useState(false);
  const [expandedSearchQuery, setExpandedSearchQuery] = useState('');
  const [expandedMultiline, setExpandedMultiline] = useState(false);

  const hasMultilineText = useMemo(() => {
    try {
      const parsed = JSON.parse(codeStr);
      return containsInnerNewline(parsed || '');
    } catch {
      return false;
    }
  }, [codeStr]);

  const finalCodeStr = showAsMultilineText ? codeStr?.replace(/\\n/g, '\n') : codeStr;
  const expandedFinalCodeStr = expandedMultiline ? codeStr?.replace(/\\n/g, '\n') : codeStr;
  const usePlainTextView = simplified || showAsMultilineText;

  if (!codeStr || codeStr === 'null') return null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <DataPanelSectionHeading icon={icon}>{title}</DataPanelSectionHeading>
        <div className="flex items-center gap-2">
          {actions}
          {!usePlainTextView && (
            <SearchFieldBlock
              name="code-section-search"
              label="Search code"
              labelIsHidden
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onReset={() => setSearchQuery('')}
              size="sm"
              isMinimized={searchMinimized}
              onMinimizedChange={setSearchMinimized}
            />
          )}
          <ButtonsGroup size="sm">
            <CopyButton content={codeStr || 'No content'} />
            {hasMultilineText && (
              <Button
                aria-label={showAsMultilineText ? 'Show escaped newlines' : 'Show multiline text'}
                tooltip={showAsMultilineText ? 'Show escaped newlines' : 'Show multiline text'}
                onClick={() => setShowAsMultilineText(v => !v)}
              >
                {showAsMultilineText ? <AlignLeftIcon /> : <AlignJustifyIcon />}
              </Button>
            )}
            <Button aria-label="Expand" tooltip="Expand" onClick={() => setExpandedOpen(true)}>
              <ExpandIcon />
            </Button>
          </ButtonsGroup>
        </div>
      </div>

      <div
        className={cn(
          raisedSurfaceStyle,
          'max-h-[30vh] overflow-hidden overflow-y-auto rounded-lg p-3 text-caption break-all text-muted-foreground',
        )}
      >
        {usePlainTextView ? (
          <div className="font-mono break-all text-muted-foreground">
            <pre className="text-wrap">{finalCodeStr}</pre>
          </div>
        ) : (
          <CodeView code={codeStr} changed={changed} diffSide={diff?.side} searchQuery={searchQuery} />
        )}
      </div>

      <Dialog open={expandedOpen} onOpenChange={setExpandedOpen}>
        <DialogContent className="grid h-[calc(100vh-6rem)]! max-w-[90vw]! grid-rows-[auto_1fr] [&>.absolute]:hidden">
          <DialogHeader className="flex-row items-center justify-between">
            <DialogTitle className="flex min-w-0 items-center gap-1.5 truncate text-caption [&>svg]:size-3.5">
              {dialogTitle ?? (
                <>
                  {icon}
                  {title}
                </>
              )}
            </DialogTitle>
            <DialogDescription>Expanded code view</DialogDescription>
            <div className="flex shrink-0 items-center gap-2">
              {!expandedMultiline && (
                <SearchFieldBlock
                  name="expanded-code-search"
                  label="Search code"
                  labelIsHidden
                  placeholder="Search..."
                  value={expandedSearchQuery}
                  onChange={e => setExpandedSearchQuery(e.target.value)}
                  onReset={() => setExpandedSearchQuery('')}
                  size="sm"
                />
              )}
              <ButtonsGroup size="sm">
                <CopyButton content={codeStr || 'No content'} />
                {hasMultilineText && (
                  <Button
                    aria-label={expandedMultiline ? 'Show escaped newlines' : 'Show multiline text'}
                    tooltip={expandedMultiline ? 'Show escaped newlines' : 'Show multiline text'}
                    onClick={() => setExpandedMultiline(v => !v)}
                  >
                    {expandedMultiline ? <AlignLeftIcon /> : <AlignJustifyIcon />}
                  </Button>
                )}
                <DialogClose asChild>
                  <Button aria-label="Close" tooltip="Close">
                    <XIcon />
                  </Button>
                </DialogClose>
              </ButtonsGroup>
            </div>
          </DialogHeader>
          <div className="overflow-auto px-6 pb-6">
            {expandedMultiline ? (
              <div
                className={cn(
                  raisedSurfaceStyle,
                  'overflow-hidden overflow-y-auto rounded-lg p-3 text-caption break-all text-muted-foreground',
                )}
              >
                <div className="font-mono break-all text-muted-foreground">
                  <pre className="text-wrap">{expandedFinalCodeStr}</pre>
                </div>
              </div>
            ) : (
              <CodeView code={codeStr} changed={changed} diffSide={diff?.side} searchQuery={expandedSearchQuery} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function containsInnerNewline(obj: unknown): boolean {
  if (typeof obj === 'string') {
    const idx = obj.indexOf('\n');
    return idx !== -1 && idx !== obj.length - 1;
  } else if (Array.isArray(obj)) {
    return obj.some(item => containsInnerNewline(item));
  } else if (obj && typeof obj === 'object') {
    return Object.values(obj).some(value => containsInnerNewline(value));
  }
  return false;
}
