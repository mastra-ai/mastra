'use client';

import { ArtifactKind } from './artifact';

export const DocumentSkeleton = ({ artifactKind }: { artifactKind: ArtifactKind }) => {
  return artifactKind === 'image' ? (
    <div className="flex flex-col gap-4 w-full justify-center items-center h-[calc(100dvh-60px)]">
      <div className="animate-pulse rounded-lg bg-muted-foreground/20 size-96" />
    </div>
  ) : (
    <div className="flex flex-col gap-4 w-full">
      <div className="animate-pulse rounded-lg h-12 bg-muted-foreground/20 w-1/2" />
      <div className="animate-pulse rounded-lg h-5 bg-muted-foreground/20 w-full" />
      <div className="animate-pulse rounded-lg h-5 bg-muted-foreground/20 w-full" />
      <div className="animate-pulse rounded-lg h-5 bg-muted-foreground/20 w-1/3" />
      <div className="animate-pulse rounded-lg h-5 bg-transparent w-52" />
      <div className="animate-pulse rounded-lg h-8 bg-muted-foreground/20 w-52" />
      <div className="animate-pulse rounded-lg h-5 bg-muted-foreground/20 w-2/3" />
    </div>
  );
};

export const InlineDocumentSkeleton = () => {
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="animate-pulse rounded-lg h-4 bg-muted-foreground/20 w-48" />
      <div className="animate-pulse rounded-lg h-4 bg-muted-foreground/20 w-3/4" />
      <div className="animate-pulse rounded-lg h-4 bg-muted-foreground/20 w-1/2" />
      <div className="animate-pulse rounded-lg h-4 bg-muted-foreground/20 w-64" />
      <div className="animate-pulse rounded-lg h-4 bg-muted-foreground/20 w-40" />
      <div className="animate-pulse rounded-lg h-4 bg-muted-foreground/20 w-36" />
      <div className="animate-pulse rounded-lg h-4 bg-muted-foreground/20 w-64" />
    </div>
  );
};
