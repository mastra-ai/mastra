'use client';

import { MultiFileDiff, PatchDiff } from '@pierre/diffs/react';
import type { FileDiffOptions } from '@pierre/diffs/react';
import { useState } from 'react';
import type { Ref } from 'react';
import { CodeDiffHeader } from './code-diff-header';
import type { CodeDiffFileHeader } from './code-diff-header';
import { useTheme } from '@/ds/components/ThemeProvider';
import { cn } from '@/lib/utils';
import './code-diff.css';

type CodeDiffSource =
  | { codeA: string; codeB: string; filename?: string; patch?: never }
  | { patch: string; codeA?: never; codeB?: never; filename?: never };

type NoCodeDiffSource = { patch?: never; codeA?: never; codeB?: never; filename?: never };

export type CodeDiffProps = {
  className?: string;
  layout?: 'split' | 'unified';
  /** `wrap` (default) breaks long lines — best for prose. `scroll` keeps columns behind a horizontal scroll — best for source code. */
  overflow?: 'wrap' | 'scroll';
  ref?: Ref<HTMLDivElement>;
} & (({ header?: CodeDiffFileHeader } & CodeDiffSource) | ({ header: CodeDiffFileHeader } & NoCodeDiffSource));

const PATCH_METADATA_PREFIXES = [
  'Binary files ',
  'GIT binary patch',
  'similarity index ',
  'rename from ',
  'rename to ',
  'copy from ',
  'copy to ',
  'new file mode ',
  'deleted file mode ',
  'old mode ',
  'new mode ',
];

function PatchMetadata({ patch }: { patch: string }) {
  const lines = patch.split('\n').filter(line => PATCH_METADATA_PREFIXES.some(prefix => line.startsWith(prefix)));

  if (lines.length === 0) {
    return <p className="p-3 text-caption text-muted-foreground">No textual changes.</p>;
  }

  return (
    <div className="p-3 font-mono text-caption wrap-anywhere">
      {lines.map(line => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}

function PatchContent({ patch, options }: { patch: string; options: FileDiffOptions<undefined, undefined> }) {
  if (!/^@@ -\d/m.test(patch)) return <PatchMetadata patch={patch} />;
  return <PatchDiff patch={patch} options={options} />;
}

function DiffContent({
  source,
  options,
}: {
  source: CodeDiffSource | NoCodeDiffSource;
  options: FileDiffOptions<undefined, undefined>;
}) {
  if (source.patch !== undefined) return <PatchContent patch={source.patch} options={options} />;
  if (source.codeA === undefined) return null;
  const name = source.filename ?? 'content.txt';
  return (
    <MultiFileDiff
      oldFile={{ name, contents: source.codeA }}
      newFile={{ name, contents: source.codeB }}
      options={options}
    />
  );
}

export function CodeDiff({ className, layout, overflow = 'wrap', header, ref, ...source }: CodeDiffProps) {
  const { resolvedTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const isPatch = source.patch !== undefined;
  const hasDiff = isPatch || source.codeA !== undefined;
  const options: FileDiffOptions<undefined, undefined> = {
    theme: { dark: 'pierre-dark', light: 'pierre-light' },
    themeType: resolvedTheme,
    diffStyle: layout ?? (isPatch ? 'unified' : 'split'),
    diffIndicators: 'classic',
    disableFileHeader: true,
    overflow,
  };

  return (
    <div ref={ref} className={cn('code-diff min-w-0 overflow-clip rounded-md border border-border bg-card', className)}>
      {header ? (
        <CodeDiffHeader
          {...header}
          collapsed={collapsed}
          onToggle={hasDiff ? () => setCollapsed(current => !current) : undefined}
        />
      ) : null}
      {collapsed ? null : <DiffContent source={source} options={options} />}
    </div>
  );
}
