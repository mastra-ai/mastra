import type { ComponentProps } from 'react';
import { BoardListRow as SharedBoardListRow, useBoardNavigation, relativeTime } from '../board';

type SharedProps = ComponentProps<typeof SharedBoardListRow>;

export function WorkItemBoardListRow({
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
