import { BrandLoader } from '@mastra/playground-ui/components/BrandLoader';

export function AuthPendingSkeleton({ label = 'Checking sign-in' }: { label?: string }) {
  return (
    <div className="bg-sidebar flex h-dvh w-full items-center justify-center">
      <BrandLoader size="lg" aria-label={label} />
    </div>
  );
}
