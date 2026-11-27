import { Select, SelectContent, SelectItem, SelectTrigger } from '@/ds/components/Select';
import { Txt } from '@/ds/components/Txt';

export interface ConditionLogicProps {
  logic: 'AND' | 'OR';
  onChange: (logic: 'AND' | 'OR') => void;
}

/** The word on the wire between a group's conditions, "and" or "or", as a picker that switches how they all join. */
export function ConditionLogic({ logic, onChange }: ConditionLogicProps) {
  return (
    <Select value={logic} onValueChange={next => next && next !== logic && onChange(next)}>
      <SelectTrigger size="sm" variant="ghost" aria-label="Match all or any" className="w-fit self-center">
        <Txt as="span" variant="caption" tone="muted">
          {logic === 'AND' ? 'and' : 'or'}
        </Txt>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="AND">
          <span className="flex items-baseline gap-2">
            and
            <Txt as="span" variant="caption" tone="muted">
              all must match
            </Txt>
          </span>
        </SelectItem>
        <SelectItem value="OR">
          <span className="flex items-baseline gap-2">
            or
            <Txt as="span" variant="caption" tone="muted">
              any can match
            </Txt>
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
