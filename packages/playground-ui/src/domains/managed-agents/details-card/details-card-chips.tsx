import { Badge } from '@/ds/components/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

export interface DetailsCardChipsProps {
  items: string[];
  /** How many chips show before the rest fold into a +N chip whose tooltip lists them. */
  max?: number;
  label?: string;
}

export function DetailsCardChips({ items, max = 4, label = 'more' }: DetailsCardChipsProps) {
  const shown = items.slice(0, max);
  const hidden = items.slice(max);
  return (
    <ul className="flex flex-wrap gap-1.5">
      {shown.map(item => (
        <li key={item}>
          <Badge size="sm">{item}</Badge>
        </li>
      ))}
      {hidden.length > 0 ? (
        <li>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${hidden.length} ${label}: ${hidden.join(', ')}`}
                className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus"
              >
                <Badge size="sm">+{hidden.length}</Badge>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <ul className="flex flex-col gap-0.5">
                {hidden.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        </li>
      ) : null}
    </ul>
  );
}
