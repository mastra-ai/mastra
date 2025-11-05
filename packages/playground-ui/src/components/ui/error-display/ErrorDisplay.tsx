import { Alert, AlertDescription, AlertTitle } from '@/ds/components/Alert';

export interface ErrorDisplayProps {
  title?: string;
  error: Error | unknown;
}

export const ErrorDisplay = ({ title = 'Error', error }: ErrorDisplayProps) => {
  const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

  return (
    <div className="py-12 text-center px-6 flex justify-center">
      <Alert variant="destructive">
        <AlertTitle as="h5">{title}</AlertTitle>
        <AlertDescription as="p">{errorMessage}</AlertDescription>
      </Alert>
    </div>
  );
};
