import type { LightSpanRecord } from '@mastra/core/storage';
import { Button, CombinedButtons, SearchFieldBlock, Icon } from '@mastra/playground-ui';
import { XIcon, CircleDashedIcon } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { useThrottledCallback } from 'use-debounce';
import type { ExperimentUISpanType } from '../types';
import { spanTypePrefixes, getExperimentSpanTypeUi } from './experiment-trace-shared';

type ExperimentTraceTimelineToolsProps = {
  spans?: LightSpanRecord[];
  fadedTypes?: string[];
  onLegendClick?: (val: string) => void;
  onLegendReset?: () => void;
  searchPhrase?: string;
  onSearchPhraseChange?: (val: string) => void;
  traceId?: string;
};

export function ExperimentTraceTimelineTools({
  spans = [],
  fadedTypes,
  onLegendClick,
  onLegendReset,
  onSearchPhraseChange,
  traceId,
}: ExperimentTraceTimelineToolsProps) {
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

  const handleToggle = (type: ExperimentUISpanType) => {
    onLegendClick?.(type);
  };

  useEffect(() => {
    handleSearchPhraseChange(localSearchPhrase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          const spanUI = getExperimentSpanTypeUi(item);
          const isFaded = fadedTypes?.includes(item);

          return (
            <Fragment key={item}>
              <Button
                onClick={() => handleToggle(item as ExperimentUISpanType)}
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
            onClick={() => handleToggle('other' as ExperimentUISpanType)}
            className={fadedTypes?.includes('other') ? 'opacity-40' : ''}
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
