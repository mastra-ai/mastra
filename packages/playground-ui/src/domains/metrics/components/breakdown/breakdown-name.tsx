import type { ReactNode } from 'react';
import { modelNameParts } from '@/domains/llm';
import { SegmentedName } from '@/ds/components/SegmentedName';

/**
 * A row's mark and name. With `provider` set (a model row with a name), the name reads
 * `openai › gpt-5-mini`; `title` is the name either way.
 */
export function BreakdownName({
  mark,
  title,
  model,
}: {
  mark: ReactNode;
  title: string;
  model?: { name: string; provider: string | undefined };
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {mark}
      <span className="truncate" title={title}>
        {model ? <SegmentedName parts={modelNameParts(model.name, model.provider)} /> : title}
      </span>
    </span>
  );
}
