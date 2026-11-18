import { Notice } from '@mastra/playground-ui/components/Notice';
import { IconArrowRotateClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateClockwise';

import { PaletteRowsSkeleton } from '../../../ui/PaletteRowsSkeleton';

export function GlobalSearchSessionsStatus({
  pending,
  failed,
  onRetry,
}: {
  pending: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      {pending && <PaletteRowsSkeleton label="Loading sessions" />}
      {failed && (
        <div className="px-3 py-2">
          <Notice
            variant="destructive"
            action={
              <Notice.Button onClick={onRetry}>
                Retry <IconArrowRotateClockwise />
              </Notice.Button>
            }
          >
            Sessions could not be loaded.
          </Notice>
        </div>
      )}
    </>
  );
}
