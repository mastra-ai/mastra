import { cn } from '@/lib/utils';
import { spanTypePrefixes, getSpanTypeUi } from './shared';
import { SpanRecord } from '@mastra/core/storage';
import { UISpanType } from '../types';
import { SearchField } from '@/components/ui/elements';
import { useThrottledCallback } from 'use-debounce';
import { Fragment, useEffect, useState } from 'react';
import { Button, CombinedButtons } from '@/components/ui/elements/buttons';

type TraceTimelineLegendProps = {
  spans?: SpanRecord[];
  fadedTypes?: string[];
  onLegendClick?: (val: string) => void;
  searchPhrase?: string;
  onSearchPhraseChange?: (val: string) => void;
};

export function TraceTimelineTools({
  spans = [],
  fadedTypes,
  onLegendClick,
  onSearchPhraseChange,
}: TraceTimelineLegendProps) {
  const [localSearchPhrase, setLocalSearchPhrase] = useState('');

  const usedSpanTypes =
    spanTypePrefixes.filter(typePrefix => spans.some(span => span?.spanType?.startsWith(typePrefix))) || [];

  const handleToggle = (type: UISpanType) => {
    onLegendClick?.(type);
  };

  useEffect(() => {
    handleSearchPhraseChange(localSearchPhrase);
  }, [localSearchPhrase, onSearchPhraseChange]);

  const handleSearchPhraseChange = useThrottledCallback((value: string) => {
    onSearchPhraseChange?.(value);
  }, 1000);

  return (
    <div className="flex gap-3 items-center justify-between sticky top-[10rem]">
      <div className="flex">
        <SearchField
          value={localSearchPhrase}
          onChange={e => {
            setLocalSearchPhrase(e.target.value);
          }}
          label="Find span by name"
          placeholder="Look for span name"
          onReset={() => setLocalSearchPhrase('')}
        />
      </div>
      <CombinedButtons>
        {usedSpanTypes.map((item, idx) => {
          const spanUI = getSpanTypeUi(item);
          const isFaded = fadedTypes?.includes(item);

          return (
            <Fragment key={item}>
              <Button
                onClick={() => handleToggle(item as UISpanType)}
                isFaded={isFaded}
                style={{ color: !isFaded ? spanUI?.color : undefined, backgroundColor: spanUI?.bgColor }}
              >
                {spanUI?.icon && spanUI.icon}
                {spanUI?.label}
              </Button>
            </Fragment>
          );
        })}
      </CombinedButtons>
    </div>
  );
}
