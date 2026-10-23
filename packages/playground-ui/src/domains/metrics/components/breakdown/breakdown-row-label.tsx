import { Txt } from '@/ds/components/Txt';

/** An org-wide entity row: the entity, then the project it ran in. */
export function BreakdownRowLabel({ name, project }: { name: string; project: string }) {
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="truncate">{name}</span>
      <Txt as="span" variant="caption" tone="muted" className="truncate">
        {project}
      </Txt>
    </span>
  );
}
