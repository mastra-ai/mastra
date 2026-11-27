import { useState } from 'react';

import type { RuleField } from '../boardConfig/boardDraft';

/**
 * The rule fields with a half-filled condition row on the open phase panel. Those rows live in the panel's editors,
 * so they only count on the `page` they were reported on: another phase, a discard or a breakpoint starts empty.
 */
export function useUnfinishedFields(page: string | undefined) {
  const [unfinished, setUnfinished] = useState<{ page: string | undefined; fields: RuleField[] }>({ page, fields: [] });
  // Editors only report a row from events, never as they mount, so a new visit has to reset here.
  if (unfinished.page !== page) setUnfinished({ page, fields: [] });
  const fields = unfinished.page === page ? unfinished.fields : [];
  const mark = (field: RuleField, value: boolean) =>
    setUnfinished(current => {
      const others = (current.page === page ? current.fields : []).filter(other => other !== field);
      return { page, fields: value ? [...others, field] : others };
    });
  return { fields, mark };
}
