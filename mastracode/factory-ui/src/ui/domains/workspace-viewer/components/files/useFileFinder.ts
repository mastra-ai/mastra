import type { UseQueryResult } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useId, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { useApiConfig } from '../../../../../api/config';
import type { WorkspaceFileIndex } from '../../../../../api/types';
import { useWorkspaceFileIndex, workspaceFileIndexQueryOptions } from '../../../../../hooks/use-fs';
import { findFiles } from './find-files';
import type { FoundFiles } from './find-files';

const SHOWN_MATCHES = 50;
const NOTHING_FOUND: FoundFiles = { matches: [], total: 0 };

type Boost = Pick<ReadonlySet<string>, 'has'>;

interface UseFileFinderOptions {
  workspacePath: string;
  visible: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  boost: Boost;
  onOpen: (path: string) => void;
}

interface Ranking {
  paths: readonly string[] | undefined;
  searched: string;
  boost: Boost;
  found: FoundFiles;
}

function rank(paths: readonly string[] | undefined, searched: string, boost: Boost): Ranking {
  return {
    paths,
    searched,
    boost,
    found: paths ? findFiles(paths, searched, { limit: SHOWN_MATCHES, boost }) : NOTHING_FOUND,
  };
}

export interface FileFinder {
  finding: boolean;
  searched: string;
  index: UseQueryResult<WorkspaceFileIndex>;
  found: FoundFiles;
  showingResults: boolean;
  listboxId: string;
  optionId: (at: number) => string;
  active: number;
  setActive: (at: number) => void;
  open: (path: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  prefetch: () => void;
}

export function useFileFinder({
  workspacePath,
  visible,
  query,
  onQueryChange,
  boost,
  onOpen,
}: UseFileFinderOptions): FileFinder {
  const queryClient = useQueryClient();
  const { client } = useApiConfig();
  const listboxId = useId();
  const searched = useDeferredValue(query);
  const finding = searched.trim() !== '';
  const index = useWorkspaceFileIndex(workspacePath, { enabled: visible && query.trim() !== '' });
  const paths = finding && index.isSuccess && index.data.available ? index.data.paths : undefined;
  const [ranking, setRanking] = useState(() => rank(paths, searched, boost));
  let current = ranking;
  if (ranking.paths !== paths || ranking.searched !== searched || ranking.boost !== boost) {
    current = rank(paths, searched, boost);
    setRanking(current);
  }
  const { found } = current;
  const [cursor, setCursor] = useState({ query: searched, at: 0 });
  const count = found.matches.length;
  const showingResults = count > 0;
  const active = cursor.query === searched && cursor.at < count ? cursor.at : 0;
  const setActive = (at: number) => setCursor({ query: searched, at });

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && count > 0) {
      event.preventDefault();
      setActive((active + (event.key === 'ArrowDown' ? 1 : count - 1)) % count);
    } else if (event.key === 'Enter' && found.matches[active]) {
      event.preventDefault();
      onOpen(found.matches[active].path);
    } else if (event.key === 'Escape' && query) {
      event.preventDefault();
      event.stopPropagation();
      onQueryChange('');
    }
  };

  return {
    finding,
    searched,
    index,
    found,
    showingResults,
    listboxId,
    optionId: at => `${listboxId}-${at}`,
    active,
    setActive,
    open: onOpen,
    onKeyDown,
    prefetch: () => {
      if (visible) void queryClient.prefetchQuery(workspaceFileIndexQueryOptions(client, workspacePath));
    },
  };
}
