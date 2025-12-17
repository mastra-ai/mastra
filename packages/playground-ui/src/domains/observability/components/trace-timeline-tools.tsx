import { spanTypePrefixes, getSpanTypeUi } from './shared';
import { SpanRecord } from '@mastra/core/storage';
import { UISpanType } from '../types';
import { SearchField } from '@/components/ui/elements';
import { useThrottledCallback } from 'use-debounce';
import { Fragment, useEffect, useState } from 'react';
import { Button, CombinedButtons } from '@/components/ui/elements/buttons';
import { XIcon, CircleDashedIcon } from 'lucide-react';

type TraceTimelineLegendProps = {
  spans?: SpanRecord[];
  fadedTypes?: string[];
  onLegendClick?: (val: string) => void;
  onLegendReset?: () => void;
  searchPhrase?: string;
  onSearchPhraseChange?: (val: string) => void;
  traceId?: string;
};

export function TraceTimelineTools({
  spans = [],
  fadedTypes,
  onLegendClick,
  onLegendReset,
  onSearchPhraseChange,
  traceId,
}: TraceTimelineLegendProps) {
  const [localSearchPhrase, setLocalSearchPhrase] = useState('');

  useEffect(() => {
    setLocalSearchPhrase('');
  }, [traceId]);

  const usedSpanTypes =
    spanTypePrefixes.filter(typePrefix => spans.some(span => span?.spanType?.startsWith(typePrefix))) || [];

  const hasOtherSpanTypes = spans.some(span => {
    const isKnownType = spanTypePrefixes.some(typePrefix => span?.spanType?.startsWith(typePrefix));
    return !isKnownType;
  });

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
    <div className="flex gap-3 items-center justify-between">
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
        {hasOtherSpanTypes && (
          <Button
            onClick={() => handleToggle('other' as UISpanType)}
            isFaded={fadedTypes?.includes('other')}
            style={{ color: !fadedTypes?.includes('other') ? undefined : undefined, backgroundColor: undefined }}
          >
            <CircleDashedIcon />
            Other
          </Button>
        )}
        <Button onClick={onLegendReset} disabled={fadedTypes?.length === 0}>
          <XIcon />
        </Button>
      </CombinedButtons>
    </div>
  );
}
