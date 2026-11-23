import type { ReactNode } from 'react';
import { BrandLoader } from '@/ds/components/BrandLoader';
import { EmptyState } from '@/ds/components/EmptyState';
import { Txt } from '@/ds/components/Txt';

export type ObservabilityCapabilityGateProps = {
  isLoading: boolean;
  enabled: boolean;
  /** The page's screen-reader heading while its body is not shown (the body brings its own). */
  heading: string;
  /** Shown when the store does not support the capability. */
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
};

/** Renders its children once the store declares the capability they need. */
export function ObservabilityCapabilityGate({
  isLoading,
  enabled,
  heading,
  title,
  description,
  children,
}: ObservabilityCapabilityGateProps) {
  if (enabled) return children;

  return (
    <>
      <h1 className="sr-only">{heading}</h1>
      {isLoading ? (
        <BrandLoader fill aria-label="Loading storage capabilities" />
      ) : (
        <EmptyState variant="fill" titleSlot={title} descriptionSlot={description} />
      )}
    </>
  );
}
