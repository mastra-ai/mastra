import { lazy, Suspense } from 'react';
import { WorkspaceFileCode } from './workspace-file-code';
import { WorkspaceFileSkeleton } from './workspace-file-skeleton';
import { MAX_HIGHLIGHT_LENGTH } from '@/ds/components/CodeEditor/highlight';
import type { HighlightLanguage } from '@/ds/components/CodeEditor/highlight';

const CodeEditor = lazy(() => import('@/ds/components/CodeEditor/code-editor').then(m => ({ default: m.CodeEditor })));

export function WorkspaceCode({ path, code, lang }: { path: string; code: string; lang?: HighlightLanguage }) {
  if (code.length <= MAX_HIGHLIGHT_LENGTH) return <WorkspaceFileCode code={code} lang={lang} />;
  return (
    <Suspense fallback={<WorkspaceFileSkeleton />}>
      <div className="px-2 py-3">
        <CodeEditor
          value={code}
          language={lang ?? 'text'}
          editable={false}
          lineNumbers={false}
          lineWrapping={false}
          variant="embedded"
          aria-label={path}
        />
      </div>
    </Suspense>
  );
}
