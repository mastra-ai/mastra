import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useSearchParams } from 'react-router';

import { useApiConfig } from '../../../../../shared/api/config';
import { Wordmark } from '../../../ui';
import { redirectToLogin } from '../services/auth';

/**
 * Only accept same-origin paths so a crafted `?returnTo=` can't bounce the
 * user to an external site after login. `//host` is protocol-relative, so it
 * is rejected too.
 */
function safeReturnTo(raw?: string): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/chat';
}

/**
 * Dedicated `/signin` route rendered when web auth is enabled and the session
 * is unauthenticated. Reuses the sidebar's ghost Sign in button behavior:
 * clicking navigates to the hosted WorkOS login, preserving where the user
 * was headed via `?returnTo=`.
 */
export function SignInPage() {
  const { baseUrl } = useApiConfig();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo')?.toString());

  return (
    <main className="grid h-dvh place-items-center">
      <div className="flex flex-col items-center gap-6">
        <Wordmark />
        <Txt as="p" variant="ui-sm" className="text-icon3">
          Sign in to continue
        </Txt>
        <Button variant="ghost" size="sm" onClick={() => redirectToLogin(baseUrl, returnTo)}>
          Sign in
        </Button>
      </div>
    </main>
  );
}
