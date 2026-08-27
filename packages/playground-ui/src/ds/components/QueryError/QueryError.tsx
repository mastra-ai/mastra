import type * as React from 'react';

import { errorFallback, parseError } from '@/lib/errors';
import { is401UnauthorizedError, is403ForbiddenError } from '@/lib/query-utils';
import { ErrorState } from '../ErrorState';
import { PermissionDenied } from '../PermissionDenied';
import { SessionExpired } from '../SessionExpired';

export interface QueryErrorProps {
  /** The error from a failed query. */
  error: unknown;
  /** Heading for the generic arm, e.g. `Failed to load tools`. */
  title: string;
  /** What the user was denied, for the 403 copy: "You don't have permission to access {resource}". */
  resource?: string;
  /** Recovery affordance on the generic arm — a retry button, usually. */
  action?: React.ReactNode;
  className?: string;
}

export function QueryError({ error, title, resource, action, className }: QueryErrorProps) {
  if (is401UnauthorizedError(error)) return <SessionExpired className={className} />;
  if (is403ForbiddenError(error)) return <PermissionDenied className={className} resource={resource} />;

  const message = error instanceof Error ? parseError(error).error : errorFallback;

  return <ErrorState className={className} title={title} message={message} action={action} />;
}
