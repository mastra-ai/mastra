import { Badge } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Fragment } from 'react';

import type { describeConditions } from '../settings/components/conditionFields';

/** A route's conditions as badges, with "and" or "or" between them so it's clear whether both or either must hold. */
export function ConditionBadges({ conditions }: { conditions: NonNullable<ReturnType<typeof describeConditions>> }) {
  return conditions.parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && (
        <Txt as="span" variant="meta" tone="muted">
          {conditions.join}
        </Txt>
      )}
      <Badge size="sm" emphasis="subtle">
        {part}
      </Badge>
    </Fragment>
  ));
}
