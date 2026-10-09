import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Link } from 'react-router';

/** The same rail and rows as the populated history, drawn as a quiet, static preview. */
export function CommitRailEmptyState({
  linked,
  factoryProjectId,
}: {
  linked: boolean;
  factoryProjectId: string | undefined;
}) {
  return (
    <div className="flex min-h-32 items-center gap-6 sm:gap-10">
      <svg aria-hidden="true" viewBox="0 0 240 96" className="w-28 shrink-0 sm:w-48">
        <path d="M14 16V80" stroke="var(--border-strong)" strokeWidth="1" />
        {[16, 48, 80].map((y, index) => (
          <g key={y}>
            <circle cx="14" cy={y} r="4" fill="var(--background)" stroke="var(--border-strong)" />
            <circle cx="44" cy={y} r="7" fill="var(--fill)" />
            <rect x="60" y={y - 3} width={120 - index * 24} height="6" rx="3" fill="var(--fill)" />
            <rect x="208" y={y - 2} width="24" height="4" rx="2" fill="var(--fill-subtle)" />
          </g>
        ))}
      </svg>
      <div className="flex min-w-0 flex-col items-start gap-3">
        <Txt as="h4" variant="subheading" tone="muted">
          {linked ? 'No commits yet' : 'No repository linked yet'}
        </Txt>
        {!linked && factoryProjectId ? (
          <Button size="sm" render={<Link to={`/factories/${factoryProjectId}/settings/repositories`} />}>
            Link repository
          </Button>
        ) : null}
      </div>
    </div>
  );
}
