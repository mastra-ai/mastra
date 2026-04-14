import type { SpanRecord } from '@mastra/core/storage';
import { Button, CombinedButtons, SearchFieldBlock, Icon } from '@mastra/playground-ui';
import { XIcon, CircleDashedIcon } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { useThrottledCallback } from 'use-debounce';
import type { UISpanType } from '../types';
import { spanTypePrefixes, getSpanTypeUi } from './shared';

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
        <SearchFieldBlock
          name="search-spans"
          label="Find span by name"
          labelIsHidden
          placeholder="Look for span name"
          value={localSearchPhrase}
          onChange={e => {
            setLocalSearchPhrase(e.target.value);
          }}
          onReset={() => setLocalSearchPhrase('')}
        />
      </div>
      <CombinedButtons>
        {usedSpanTypes.map(item => {
          const spanUI = getSpanTypeUi(item);
          const isFaded = fadedTypes?.includes(item);

          return (
            <Fragment key={item}>
              <Button
                onClick={() => handleToggle(item as UISpanType)}
                className={isFaded ? 'opacity-40' : ''}
                style={{ color: !isFaded ? spanUI?.color : undefined, backgroundColor: spanUI?.bgColor }}
              >
                {spanUI?.icon && <Icon>{spanUI.icon}</Icon>}
                {spanUI?.label}
              </Button>
            </Fragment>
          );
        })}
        {hasOtherSpanTypes && (
          <Button
            onClick={() => handleToggle('other' as UISpanType)}
            className={fadedTypes?.includes('other') ? 'opacity-40' : ''}
            style={{ color: !fadedTypes?.includes('other') ? undefined : undefined, backgroundColor: undefined }}
          >
            <Icon>
              <CircleDashedIcon />
            </Icon>
            Other
          </Button>
        )}
        <Button onClick={onLegendReset} disabled={fadedTypes?.length === 0}>
          <Icon>
            <XIcon />
          </Icon>
        </Button>
      </CombinedButtons>
    </div>
  );
}
