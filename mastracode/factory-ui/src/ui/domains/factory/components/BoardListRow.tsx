import { BoardListRow as SharedBoardListRow, useBoardNavigation } from '@mastra/playground-ui/domains/factory';
import type { ComponentProps } from 'react';

import { relativeTime } from '../../../../lib/date/relativeTime';

type SharedProps = ComponentProps<typeof SharedBoardListRow>;

export function BoardListRow({
  createdAt,
  ...props
}: Omit<SharedProps, 'createdAt' | 'LinkComponent' | 'onOpen'> & { createdAt?: string }) {
  const { LinkComponent, navigate } = useBoardNavigation();
  return (
    <SharedBoardListRow
      {...props}
      createdAt={createdAt === undefined ? undefined : { dateTime: createdAt, label: relativeTime(createdAt) }}
      LinkComponent={LinkComponent}
      onOpen={() => navigate(props.href)}
    />
  );
}
