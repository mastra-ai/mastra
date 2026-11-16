import type { ReactNode } from 'react';
import { DisclosureChevron } from '@/ds/components/DisclosureChevron';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export interface CodeDiffFileHeader {
  path: string;
  /** The path before a rename or move, shown under the current one. */
  previousPath?: string;
  /** Shown before the path, e.g. the kind of change. Give it an accessible name. */
  icon?: ReactNode;
  /** Shown at the header's right edge, e.g. the line counts. */
  meta?: ReactNode;
}

function FilePath({ path, variant }: { path: string; variant: 'body-sm' | 'meta' }) {
  const nameStart = path.lastIndexOf('/') + 1;
  const directory = path.slice(0, nameStart);
  return (
    <span className="flex min-w-0">
      {/* rtl box + ltr isolate puts the ellipsis at the start, so the nearest folder stays visible */}
      {directory ? (
        <Txt as="span" dir="rtl" variant={variant} font="mono" tone="muted" className="min-w-[2ch] truncate">
          <bdi dir="ltr">{directory}</bdi>
        </Txt>
      ) : null}
      <Txt
        as="span"
        variant={variant}
        font="mono"
        tone={variant === 'body-sm' ? 'ink' : 'muted'}
        className={cn('shrink-0 truncate', directory ? 'max-w-[calc(100%-2ch)]' : 'max-w-full')}
      >
        {path.slice(nameStart)}
      </Txt>
    </span>
  );
}

function HeaderTitle({ path, previousPath }: Pick<CodeDiffFileHeader, 'path' | 'previousPath'>) {
  return (
    <span className="flex min-w-0 flex-col">
      <FilePath path={path} variant="body-sm" />
      {previousPath && previousPath !== path ? (
        <span className="flex min-w-0 gap-1">
          {' '}
          <Txt as="span" variant="meta" tone="muted" className="shrink-0">
            from
          </Txt>{' '}
          <FilePath path={previousPath} variant="meta" />
        </span>
      ) : null}
    </span>
  );
}

function FirstLineSlot({ children }: { children?: ReactNode }) {
  return <span className="flex h-5 shrink-0 items-center gap-2 [&_svg]:size-4">{children}</span>;
}

interface CodeDiffHeaderProps extends CodeDiffFileHeader {
  collapsed: boolean;
  onToggle?(): void;
}

export function CodeDiffHeader({ path, previousPath, icon, meta, collapsed, onToggle }: CodeDiffHeaderProps) {
  const title = (
    <>
      {icon ? <FirstLineSlot>{icon}</FirstLineSlot> : null}
      <HeaderTitle path={path} previousPath={previousPath} />
    </>
  );
  const titleClass = 'flex min-w-0 flex-1 items-start gap-1.5 py-2 pl-2 text-left';

  return (
    <div className="sticky top-0 z-10 flex items-start gap-2 bg-card pr-3 not-last:border-b not-last:border-border">
      {onToggle ? (
        <button type="button" aria-expanded={!collapsed} onClick={onToggle} className={titleClass}>
          <FirstLineSlot>
            <DisclosureChevron direction="right" className="text-muted-foreground" />
          </FirstLineSlot>
          {title}
        </button>
      ) : (
        <div className={titleClass}>
          <FirstLineSlot>
            <span aria-hidden className="size-4" />
          </FirstLineSlot>
          {title}
        </div>
      )}
      {meta ? (
        <span className="py-2">
          <FirstLineSlot>{meta}</FirstLineSlot>
        </span>
      ) : null}
    </div>
  );
}
