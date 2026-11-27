import type { RuleRetestInfo } from './types';
import { Txt } from '@/ds/components/Txt';

/** Where the item a test opened the rule from goes under the unsaved rules, and where the saved ones put it. */
export function RetestBox({ retest }: { retest: RuleRetestInfo | undefined }) {
  if (!retest) return null;
  const { title, after, before } = retest;

  return (
    <div role="status" className="flex flex-col gap-0.5 rounded-[10px] bg-fill-subtle px-3 py-2">
      <Txt as="p" variant="body-sm" className="truncate">
        {title} now goes to {after}
      </Txt>
      {before !== undefined && before !== after && (
        <Txt as="p" variant="caption" tone="muted">
          Was {before}
        </Txt>
      )}
    </div>
  );
}
