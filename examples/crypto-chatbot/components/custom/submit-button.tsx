'use client';

import { useFormStatus } from 'react-dom';

import { LoaderIcon } from '@/components/custom/icons';

import { Button } from '../ui/button';

export function SubmitButton({
  children,
  isSuccessful,
}: {
  children: React.ReactNode;
  isSuccessful: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type={pending ? 'button' : 'submit'}
      aria-disabled={pending || isSuccessful}
      disabled={pending || isSuccessful}
      className="relative"
    >
      {children}

      {(pending || isSuccessful) && (
        <span className="animate-spin absolute right-4">
          <LoaderIcon />
        </span>
      )}

      <span aria-live="polite" className="sr-only" role="status">
        {pending || isSuccessful ? 'Loading' : 'Submit form'}
      </span>
    </Button>
  );
}
