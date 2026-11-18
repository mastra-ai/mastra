import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

import { SignInLayout } from './SignInLayout';

export function SignInSkeleton({ label }: { label: string }) {
  return (
    <SignInLayout>
      <div role="status" aria-label={label}>
        <Skeleton aria-hidden className="h-control-lg w-80 max-w-full rounded-full motion-reduce:before:animate-none" />
      </div>
    </SignInLayout>
  );
}
