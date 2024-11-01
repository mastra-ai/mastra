'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

export const ErrorHandler = ({
  error,
  reset,
  errorMessage = 'Something went wrong!',
}: {
  error: Error & { digest?: string };
  reset: () => void;
  errorMessage?: string;
}) => {
  const router = useRouter();

  if (process.env.NODE_ENV === 'development') {
    console.error(error);
  }
  return (
    <section className="grid h-full w-full place-items-center">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-medium">{errorMessage}</h2>
        <div className="mx-auto flex items-center gap-2">
          <Button
            onClick={router.back}
            type="button"
            className="items-center rounded mx-auto inline-flex h-6 py-2 text-center text-sm font-medium"
          >
            {/* <ChevronDown className="h-3 w-3 rotate-90" /> */}
            <p> Go back</p>
          </Button>

          <Button
            type="button"
            onClick={reset}
            className="h-6 flex-1 px-4 bg-mastra-bg-4 hover:bg-mastra-bg-4/70 text-white"
          >
            Reset
          </Button>
        </div>
      </div>
    </section>
  );
};
