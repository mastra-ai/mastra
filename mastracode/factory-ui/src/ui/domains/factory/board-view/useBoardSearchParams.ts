import { useSearchParams } from 'react-router';
import {
  boardLabelsFromQuery,
  boardLabelsQueryValues,
  boardRelevanceFromQuery,
  boardRelevanceQueryValue,
} from '../boardRelevance';
import type { BoardRelevanceType } from '../boardRelevance';
import type { BoardKind } from '../boardStages';

function clearOpenCard(params: URLSearchParams) {
  params.delete('item');
  params.delete('comment');
}

export function useBoardSearchParams(kind: BoardKind) {
  const [searchParams, setSearchParams] = useSearchParams();
  const targetItemId = searchParams.get('item') || undefined;
  const targetCommentId = targetItemId !== undefined ? (searchParams.get('comment') ?? undefined) : undefined;
  const selectedParticipantId = searchParams.get('teammate') || undefined;
  const search = searchParams.get('q') ?? '';
  const selectedRelevanceTypes = boardRelevanceFromQuery(searchParams.get('relevance'), kind);
  const selectedLabels = boardLabelsFromQuery(searchParams.getAll('label'));
  const setSearch = (next: string) => {
    const params = new URLSearchParams(searchParams);
    clearOpenCard(params);
    if (next.trim()) params.set('q', next);
    else params.delete('q');
    setSearchParams(params, { replace: true });
  };
  const setParticipant = (participantId: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    clearOpenCard(next);
    if (participantId) next.set('teammate', participantId);
    else {
      next.delete('teammate');
      next.delete('relevance');
    }
    setSearchParams(next, { replace: true });
  };
  const setRelevanceType = (type: BoardRelevanceType, selected: boolean) => {
    const nextTypes = new Set(selectedRelevanceTypes);
    if (selected) nextTypes.add(type);
    else nextTypes.delete(type);
    const next = new URLSearchParams(searchParams);
    clearOpenCard(next);
    const value = boardRelevanceQueryValue(nextTypes, kind);
    if (value) next.set('relevance', value);
    else next.delete('relevance');
    setSearchParams(next, { replace: true });
  };
  const setLabel = (label: string, selected: boolean) => {
    const nextLabels = new Set(selectedLabels);
    if (selected) nextLabels.add(label);
    else nextLabels.delete(label);
    const next = new URLSearchParams(searchParams);
    clearOpenCard(next);
    next.delete('label');
    for (const value of boardLabelsQueryValues(nextLabels)) next.append('label', value);
    setSearchParams(next, { replace: true });
  };
  const resetFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('teammate');
    next.delete('relevance');
    next.delete('label');
    next.delete('q');
    clearOpenCard(next);
    setSearchParams(next, { replace: true });
  };
  const clearSelection = () => {
    if (!targetItemId) return;
    const next = new URLSearchParams(searchParams);
    clearOpenCard(next);
    setSearchParams(next, { replace: true });
  };
  return {
    targetItemId,
    targetCommentId,
    selectedParticipantId,
    search,
    selectedRelevanceTypes,
    selectedLabels,
    setSearch,
    setParticipant,
    setRelevanceType,
    setLabel,
    resetFilters,
    clearSelection,
  };
}
