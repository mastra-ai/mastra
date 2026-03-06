import { Spinner } from '@mastra/playground-ui';

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <Spinner size="lg" />
    </div>
  );
}
