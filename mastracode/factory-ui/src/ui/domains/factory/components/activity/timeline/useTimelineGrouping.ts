import { useSearchParams } from 'react-router';

import { EVERY_EVENT_PARAM } from '../../../activity';
import type { ActivityGrouping } from '../../../activity';

/** Grouping lives in the URL so the old audit link can land ungrouped. */
export function useTimelineGrouping(): [ActivityGrouping, (next: ActivityGrouping) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const grouping = searchParams.get(EVERY_EVENT_PARAM.key) === EVERY_EVENT_PARAM.value ? 'none' : 'similar';

  const setGrouping = (next: ActivityGrouping) => {
    setSearchParams(
      current => {
        if (next === 'none') current.set(EVERY_EVENT_PARAM.key, EVERY_EVENT_PARAM.value);
        else current.delete(EVERY_EVENT_PARAM.key);
        return current;
      },
      { replace: true },
    );
  };

  return [grouping, setGrouping];
}
