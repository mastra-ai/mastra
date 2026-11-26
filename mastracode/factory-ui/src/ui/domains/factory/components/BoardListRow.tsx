import { BoardListRow as SharedBoardListRow } from '@mastra/playground-ui/domains/factory';
import type { ComponentProps } from 'react';
import { useNavigate } from 'react-router';

import { relativeTime } from '../../../../lib/date/relativeTime';
import { HrefLink } from '../../../ui/HrefLink';

type SharedProps = ComponentProps<typeof SharedBoardListRow>;

export function BoardListRow({
  createdAt,
  ...props
}: Omit<SharedProps, 'createdAt' | 'LinkComponent' | 'onOpen'> & { createdAt?: string }) {
  const navigate = useNavigate();
  return (
    <SharedBoardListRow
      {...props}
      createdAt={createdAt === undefined ? undefined : { dateTime: createdAt, label: relativeTime(createdAt) }}
      LinkComponent={HrefLink}
      onOpen={() => void navigate(props.href)}
    />
  );
}
