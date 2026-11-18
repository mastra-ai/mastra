import { SourceDescriptionPlaceholder } from './BoardCardDetails';
import { overviewSectionClass } from './CardOverview';
import { CardSourceRowSkeleton } from './CardSourceRow';

export function CardOverviewSkeleton() {
  return (
    <div role="status" aria-label="Loading overview" className={overviewSectionClass}>
      <CardSourceRowSkeleton />
      <SourceDescriptionPlaceholder />
    </div>
  );
}
