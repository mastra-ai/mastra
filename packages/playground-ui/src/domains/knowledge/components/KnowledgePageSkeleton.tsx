import { Fragment } from 'react';

import {
  KNOWLEDGE_NOTE,
  KNOWLEDGE_PAGE_ARTICLE,
  KNOWLEDGE_PAGE_ASIDE,
  KNOWLEDGE_PAGE_BADGES,
  KNOWLEDGE_PAGE_BODY,
  KNOWLEDGE_PAGE_HEADER,
  KNOWLEDGE_PAGE_MAIN,
  KNOWLEDGE_PEEK_BODY,
  KNOWLEDGE_PEEK_COUNTS,
  KNOWLEDGE_PEEK_PREVIEW,
} from '../lib/pageLayout';
import { KnowledgeDetailSection, PeekCount } from './KnowledgePageDetail';

import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { Skeleton, SkeletonText } from '@/ds/components/Skeleton';
import { cn } from '@/lib/utils';

const bar = 'motion-reduce:before:animate-none';
const NOTES = [0, 1];
const DETAILS = ['w-12', 'w-14', 'w-12', 'w-10'];

function NoteSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div className={KNOWLEDGE_NOTE[compact ? 'compact' : 'full']}>
      {compact ? null : <Skeleton className={cn('size-6 shrink-0 rounded-full', bar)} />}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <SkeletonText line="text-label" className={cn('w-24', bar)} />
          <SkeletonText line="text-caption" className={cn('w-10', bar)} />
        </div>
        <SkeletonText line="text-body" className={cn('w-full', bar)} />
        <SkeletonText line="text-body" className={cn('w-2/3', bar)} />
      </div>
    </div>
  );
}

export function KnowledgeNotesSkeleton({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <div role="status" aria-label="Loading notes" className={cn('flex flex-col gap-2', className)}>
      {NOTES.map(index => (
        <NoteSkeleton key={index} compact={compact} />
      ))}
    </div>
  );
}

const BODY_LINES = ['w-full', 'w-5/6', 'w-2/3'];

function PageBodySkeleton() {
  return (
    <div className="flex max-w-3xl flex-col">
      {BODY_LINES.map(width => (
        <SkeletonText key={width} line="text-body leading-6" className={cn(width, bar)} />
      ))}
    </div>
  );
}

function PeekSkeleton() {
  const count = <Skeleton className={cn('inline-block h-3.5 w-4 align-middle', bar)} />;
  return (
    <div className={KNOWLEDGE_PEEK_BODY}>
      <dl className={KNOWLEDGE_PEEK_COUNTS}>
        <PeekCount label="Links in" value={count} />
        <PeekCount label="Links out" value={count} />
        <PeekCount label="Notes" value={count} />
      </dl>
      <KnowledgeDetailSection label="Preview" className={KNOWLEDGE_PEEK_PREVIEW}>
        <PageBodySkeleton />
      </KnowledgeDetailSection>
    </div>
  );
}

function FullSkeleton() {
  return (
    <div className={KNOWLEDGE_PAGE_BODY}>
      <div className={KNOWLEDGE_PAGE_MAIN}>
        <PageBodySkeleton />
      </div>
      <aside className={KNOWLEDGE_PAGE_ASIDE}>
        <KnowledgeDetailSection label="Details">
          <DataKeysAndValues>
            {DETAILS.map((width, index) => (
              <Fragment key={index}>
                <DataKeysAndValues.Key>
                  <SkeletonText className={cn(width, bar)} />
                </DataKeysAndValues.Key>
                <DataKeysAndValues.Value>
                  <SkeletonText className={cn('w-20', bar)} />
                </DataKeysAndValues.Value>
              </Fragment>
            ))}
          </DataKeysAndValues>
        </KnowledgeDetailSection>
      </aside>
    </div>
  );
}

export function KnowledgePageSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div role="status" aria-label="Loading page" className={KNOWLEDGE_PAGE_ARTICLE}>
      <div className={KNOWLEDGE_PAGE_HEADER[compact ? 'compact' : 'full']}>
        <div className="flex h-7 items-center">
          <Skeleton className={cn('h-3.5 w-40', bar)} />
        </div>
        <div className="flex flex-col gap-2">
          {compact ? null : (
            <div className="flex min-w-0 items-center gap-2">
              <SkeletonText line="text-title" className={cn('h-4 w-48', bar)} />
              <Skeleton className={cn('h-5 w-6', bar)} />
            </div>
          )}
          <div className={KNOWLEDGE_PAGE_BADGES}>
            <Skeleton className={cn('h-5 w-10', bar)} />
            {compact ? <SkeletonText line="text-caption" className={cn('w-40', bar)} /> : null}
          </div>
        </div>
      </div>
      {compact ? <PeekSkeleton /> : <FullSkeleton />}
    </div>
  );
}
