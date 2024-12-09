import { JSONValue } from 'ai';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { useSWRConfig } from 'swr';

import { Suggestion } from '@/db/schema';

import { UIBlock } from './block';

type StreamingDelta = {
  type: 'text-delta' | 'title' | 'id' | 'suggestion' | 'clear' | 'finish';
  content: string | Suggestion;
};

export function useBlockStream({
  streamingData,
  setBlock,
}: {
  streamingData: JSONValue[] | undefined;
  setBlock: Dispatch<SetStateAction<UIBlock>>;
}) {
  const { mutate } = useSWRConfig();
  const [optimisticSuggestions, setOptimisticSuggestions] = useState<
    Array<Suggestion>
  >([]);

  useEffect(() => {
    if (optimisticSuggestions && optimisticSuggestions.length > 0) {
      const [optimisticSuggestion] = optimisticSuggestions;
      const url = `/api/suggestions?documentId=${optimisticSuggestion.documentId}`;
      mutate(url, optimisticSuggestions, false);
    }
  }, [optimisticSuggestions, mutate]);

  useEffect(() => {
    const mostRecentDelta = streamingData?.at(-1);
    if (!mostRecentDelta) return;

    const delta = mostRecentDelta as StreamingDelta;

    setBlock((draftBlock) => {
      switch (delta.type) {
        case 'id':
          return {
            ...draftBlock,
            documentId: delta.content as string,
          };

        case 'title':
          return {
            ...draftBlock,
            title: delta.content as string,
          };

        case 'text-delta':
          return {
            ...draftBlock,
            content: draftBlock.content + (delta.content as string),
            isVisible:
              draftBlock.status === 'streaming' &&
              draftBlock.content.length > 200 &&
              draftBlock.content.length < 250
                ? true
                : draftBlock.isVisible,
            status: 'streaming',
          };

        case 'suggestion':
          setTimeout(() => {
            setOptimisticSuggestions((currentSuggestions) => [
              ...currentSuggestions,
              delta.content as Suggestion,
            ]);
          }, 0);

          return draftBlock;

        case 'clear':
          return {
            ...draftBlock,
            content: '',
            status: 'streaming',
          };

        case 'finish':
          return {
            ...draftBlock,
            status: 'idle',
          };

        default:
          return draftBlock;
      }
    });
  }, [streamingData, setBlock]);
}
