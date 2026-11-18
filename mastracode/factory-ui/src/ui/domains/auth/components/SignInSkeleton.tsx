import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import { HOSTED_SIGN_IN_BUTTON_CLASS, SignInLayout } from './SignInLayout';

export function SignInContentSkeleton({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div role="status" aria-label={label}>
      {children ? (
        <div inert>{children}</div>
      ) : (
        <Skeleton
          aria-hidden
          className={cn(HOSTED_SIGN_IN_BUTTON_CLASS, 'h-control-lg rounded-full motion-reduce:before:animate-none')}
        />
      )}
    </div>
  );
}

export function SignInSkeleton({ label }: { label: string }) {
  return (
    <SignInLayout>
      <SignInContentSkeleton label={label} />
    </SignInLayout>
  );
}
