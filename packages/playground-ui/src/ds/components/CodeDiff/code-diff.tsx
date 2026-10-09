'use client';

import { MultiFileDiff, PatchDiff } from '@pierre/diffs/react';
import type { FileDiffOptions } from '@pierre/diffs/react';
import { useTheme } from '@/ds/components/ThemeProvider';
import { cn } from '@/lib/utils';
import './code-diff.css';

export type CodeDiffProps = {
  className?: string;
  layout?: 'split' | 'unified';
} & (
  | { codeA: string; codeB: string; filename?: string; patch?: never }
  | { patch: string; codeA?: never; codeB?: never; filename?: never }
);

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
    <div className="p-3 font-mono text-caption">
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

export function CodeDiff({ className, layout, ...source }: CodeDiffProps) {
  const { resolvedTheme } = useTheme();
  const isPatch = source.patch !== undefined;
  const options: FileDiffOptions<undefined, undefined> = {
    theme: { dark: 'pierre-dark', light: 'pierre-light' },
    themeType: resolvedTheme,
    diffStyle: layout ?? (isPatch ? 'unified' : 'split'),
    diffIndicators: 'classic',
    disableFileHeader: true,
    overflow: 'wrap',
  };

  return (
    <div className={cn('code-diff min-w-0 overflow-auto rounded-md border border-border bg-card', className)}>
      {source.patch !== undefined ? (
        <PatchContent patch={source.patch} options={options} />
      ) : (
        <MultiFileDiff
          oldFile={{ name: source.filename ?? 'content.txt', contents: source.codeA }}
          newFile={{ name: source.filename ?? 'content.txt', contents: source.codeB }}
          options={options}
        />
      )}
    </div>
  );
}
