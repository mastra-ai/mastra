import { CodeDiffList } from '@mastra/playground-ui/components/CodeDiff';
import { useImperativeHandle, useRef } from 'react';
import type { Ref } from 'react';

import type { WorkspaceChangePatches } from '../../../../../../api/types';
import type { DiffLayout } from '../../../hooks/useDiffLayout';
import { changesInTreeOrder } from '../tree/change-tree';
import { ChangeDiff } from './ChangeDiff';

export interface StackedDiffsHandle {
  scrollToFile(path: string): void;
}

interface StackedDiffsProps {
  changes: WorkspaceChangePatches;
  layout: DiffLayout;
  className?: string;
  ref?: Ref<StackedDiffsHandle>;
}

function ownValue<T>(record: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

export function StackedDiffs({ changes, layout, className, ref }: StackedDiffsProps) {
  const cardsByPath = useRef(new Map<string, HTMLDivElement>());

  useImperativeHandle(
    ref,
    () => ({ scrollToFile: path => cardsByPath.current.get(path)?.scrollIntoView({ block: 'start' }) }),
    [],
  );

  const trackCard = (path: string) => (element: HTMLDivElement) => {
    cardsByPath.current.set(path, element);
    return () => void cardsByPath.current.delete(path);
  };

  return (
    <CodeDiffList className={className}>
      {changesInTreeOrder(changes).map(change => (
        <ChangeDiff
          key={change.path}
          ref={trackCard(change.path)}
          change={change}
          patch={ownValue(changes.patches, change.path)}
          omission={ownValue(changes.omittedPatches, change.path)}
          layout={layout}
        />
      ))}
    </CodeDiffList>
  );
}
