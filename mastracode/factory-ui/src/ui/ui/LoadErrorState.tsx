import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState, EmptyStateIllustration } from '@mastra/playground-ui/components/EmptyState';
import type { EmptyStateIllustrationName } from '@mastra/playground-ui/components/EmptyState';
import { IconArrowBoxRight } from '@mastra/playground-ui/icons/central/IconArrowBoxRight';
import { IconArrowRotateCounterClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateCounterClockwise';
import { Link, useLocation } from 'react-router';

export { SidebarEmptyNote, SidebarLoadError } from '@mastra/playground-ui/domains/factory';

interface LoadFailure {
  art: EmptyStateIllustrationName;
  description: string;
  /** Repeating the request can't fix an expired session; signing in again does. */
  signIn?: true;
}

// Each browser words a request that never reached the server differently.
const UNREACHABLE = /failed to fetch|networkerror|load failed|fetch failed/i;

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') return error.status;
  return undefined;
}

/** Why a read inside a factory failed: the art for it and a sentence saying what to do next. */
export function describeLoadFailure(error: unknown): LoadFailure {
  const status = statusOf(error);
  if (status === undefined && error instanceof Error && UNREACHABLE.test(error.message)) {
    return {
      art: 'disconnected',
      description: 'The server could not be reached. Check your connection and try again.',
    };
  }
  switch (status) {
    case 401:
      return { art: 'locked', description: 'Your session expired. Sign in again to continue.', signIn: true };
    case 403:
      return { art: 'not-a-member', description: 'You don’t have access to this factory.' };
    case 404:
      return { art: 'not-a-member', description: 'This factory isn’t in your organization. It may have been deleted.' };
    case 429:
      return { art: 'rate-limited', description: 'Too many requests. Wait a moment and try again.' };
    default:
      return { art: 'server-error', description: 'The server returned an error. Try again in a moment.' };
  }
}

interface RetryProps {
  onRetry: () => void;
  /** The retry is in flight; the action waits for it instead of stacking requests. */
  retrying?: boolean;
}

/** A page whose data failed to load: art for the kind of failure, what to do about it, and the way to do it. */
export function LoadErrorState({ title, error, onRetry, retrying }: RetryProps & { title: string; error: unknown }) {
  const failure = describeLoadFailure(error);
  // Signing in comes back to this page, like the app's other ways into /signin.
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  return (
    <EmptyState
      variant="fill"
      tone="error"
      iconSlot={<EmptyStateIllustration name={failure.art} />}
      titleSlot={<span role="alert">{title}</span>}
      descriptionSlot={failure.description}
      actionSlot={
        failure.signIn ? (
          <Button
            icon={<IconArrowBoxRight />}
            render={<Link to={`/signin?returnTo=${encodeURIComponent(returnTo)}`} />}
          >
            Sign in
          </Button>
        ) : (
          <Button icon={<IconArrowRotateCounterClockwise />} onClick={onRetry} loading={retrying}>
            Try again
          </Button>
        )
      }
    />
  );
}
