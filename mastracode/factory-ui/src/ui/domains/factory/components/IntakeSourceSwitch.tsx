import { cn } from '@mastra/playground-ui/utils/cn';

import { INTAKE_SOURCES } from '../boardCandidates';
import type { IntakeSource } from '../boardCandidates';

export function IntakeSourceSwitch({
  available,
  active,
  onSelect,
}: {
  available: readonly IntakeSource[];
  active?: IntakeSource;
  onSelect: (source: IntakeSource) => void;
}) {
  return (
    <div role="group" aria-label="Intake source" className="flex items-center gap-1">
      {INTAKE_SOURCES.filter(source => available.includes(source.id)).map(source => (
        <button
          key={source.id}
          type="button"
          aria-pressed={active === source.id}
          onClick={() => onSelect(source.id)}
          className={cn(
            'rounded-full border px-2.5 py-0.5 text-meta transition',
            active === source.id
              ? 'border-badge-green-indicator bg-fill text-foreground'
              : 'border-border bg-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {source.label}
        </button>
      ))}
    </div>
  );
}
