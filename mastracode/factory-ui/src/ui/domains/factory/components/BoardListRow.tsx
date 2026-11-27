import {
  BoardListRow as SharedBoardListRow,
  useBoardNavigation,
  relativeTime,
} from '@mastra/playground-ui/domains/factory';
import type { ComponentProps } from 'react';

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
