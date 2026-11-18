import type { RuleGroup } from '@mastra/factory/rules/rule-group';
import type { FilterBarOption } from '@mastra/playground-ui/components/FilterBar';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { describeConditions } from '../../settings/components/conditionFields';

/** A rule's conditions as chips joined by "and"/"or"; a nested group sits in a dashed box headed "any of" or "all of". */
export function ConditionChips({
  when,
  options,
  everything,
}: {
  when: RuleGroup | null;
  options?: Record<string, FilterBarOption[]>;
  /** What a rule with no conditions matches, such as "Every card". */
  everything: string;
}) {
  const described = describeConditions(when, options);
  if (!when || !described) {
    return (
      <Txt as="span" variant="caption" tone="muted">
        {everything}
      </Txt>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      {described.parts.map((part, index) => {
        const member = when.conditions[index];
        const group = member && 'conditions' in member ? member : undefined;
        return (
          <span key={index} className="contents">
            {index > 0 && (
              <Txt as="span" variant="meta" tone="muted">
                {described.join}
              </Txt>
            )}
            {group ? (
              <span className="border-border inline-flex max-w-full items-center gap-1 rounded-md border border-dashed px-1 py-0.5">
                <Txt as="span" variant="meta" tone="muted">
                  {group.operator === 'OR' ? 'any of' : 'all of'}
                </Txt>
                <Chip>{part.replace(/^\((.*)\)$/, '$1')}</Chip>
              </span>
            ) : (
              <Chip>{part}</Chip>
            )}
          </span>
        );
      })}
    </span>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <Txt as="span" variant="caption" tone="muted" className="bg-fill max-w-full truncate rounded-sm px-1.5 py-0.5">
      {children}
    </Txt>
  );
}
