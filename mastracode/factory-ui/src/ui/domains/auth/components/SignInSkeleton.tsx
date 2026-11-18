import { Field } from '@mastra/playground-ui/components/Field';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

import {
  HOSTED_SIGN_IN_BUTTON_CLASS,
  SIGN_IN_DESCRIPTION_CLASS,
  SIGN_IN_FORM_CLASS,
  SIGN_IN_FORM_TOGGLE_CLASS,
  SIGN_IN_HEADER_CLASS,
  SignInLayout,
} from './SignInLayout';

function CredentialFieldSkeleton({ labelWidth }: { labelWidth: string }) {
  return (
    <Field>
      <SkeletonText line="text-label" className={cn(labelWidth, 'motion-reduce:before:animate-none')} />
      <Skeleton className="h-control-lg w-full rounded-full motion-reduce:before:animate-none" />
    </Field>
  );
}

function CredentialSignInSkeleton({ signUpDisabled }: { signUpDisabled: boolean }) {
  return (
    <div aria-hidden>
      <div className={SIGN_IN_HEADER_CLASS}>
        <SkeletonText line="text-title" className="w-44 max-w-full motion-reduce:before:animate-none" />
        <div className={SIGN_IN_DESCRIPTION_CLASS}>
          <SkeletonText line="text-body" className="w-72 max-w-full motion-reduce:before:animate-none" />
        </div>
      </div>
      <div className={cn('flex flex-col', SIGN_IN_FORM_CLASS)}>
        <CredentialFieldSkeleton labelWidth="w-10" />
        <CredentialFieldSkeleton labelWidth="w-16" />
        <Skeleton className="h-control-lg w-full rounded-full motion-reduce:before:animate-none" />
        {signUpDisabled ? (
          <SkeletonText line="text-caption" className="mx-auto w-72 max-w-full motion-reduce:before:animate-none" />
        ) : (
          <Skeleton
            className={cn(
              SIGN_IN_FORM_TOGGLE_CLASS,
              'h-control-sm w-36 rounded-full motion-reduce:before:animate-none',
            )}
          />
        )}
      </div>
    </div>
  );
}

export type SignInContentSkeletonProps = {
  label: string;
  credential?: { signUpDisabled: boolean };
};

export function SignInContentSkeleton({ label, credential }: SignInContentSkeletonProps) {
  return (
    <div role="status" aria-label={label}>
      {credential ? (
        <CredentialSignInSkeleton signUpDisabled={credential.signUpDisabled} />
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
