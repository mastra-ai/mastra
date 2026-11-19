import { SkeletonRows } from '../../../ui/SkeletonRows';

/** Placeholder turns while a thread's first message window loads. */
export function TranscriptLoading() {
  return (
    <SkeletonRows label="Loading messages" rows={3} className="w-full gap-6" rowClassName="h-16 w-full rounded-lg" />
  );
}
