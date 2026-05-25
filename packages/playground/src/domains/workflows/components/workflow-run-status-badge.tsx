import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { Badge, Spinner } from '@mastra/playground-ui';
import { Check, CirclePause, CircleSlash, Clock, X } from 'lucide-react';

export interface WorkflowRunStatusBadgeProps {
  status: WorkflowRunStatus;
}

export function WorkflowRunStatusBadge({ status }: WorkflowRunStatusBadgeProps) {
  if (status === 'running') {
    return (
      <Badge variant="default" icon={<Spinner />}>
        {status}
      </Badge>
    );
  }

  if (status === 'failed') {
    return (
      <Badge variant="default" icon={<X className="text-accent2" />}>
        {status}
      </Badge>
    );
  }

  if (status === 'canceled') {
    return (
      <Badge variant="default" icon={<CircleSlash className="text-neutral3" />}>
        {status}
      </Badge>
    );
  }

  if (status === 'pending' || status === 'waiting') {
    return (
      <Badge variant="default" icon={<Clock className="text-neutral3" />}>
        {status}
      </Badge>
    );
  }

  if (status === 'suspended') {
    return (
      <Badge variant="default" icon={<CirclePause className="text-accent3" />}>
        {status}
      </Badge>
    );
  }

  if (status === 'success') {
    return (
      <Badge variant="default" icon={<Check className="text-accent1" />}>
        {status}
      </Badge>
    );
  }

  return <Badge variant="default">{status}</Badge>;
}
