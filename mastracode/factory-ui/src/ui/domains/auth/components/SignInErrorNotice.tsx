import { Txt } from '@mastra/playground-ui/components/Txt';

export function SignInErrorNotice({ error, description }: { error: string; description?: string }) {
  const accessDenied = error === 'access_denied';

  return (
    <div role="alert" className="border-destructive-edge bg-card mb-6 rounded-lg border px-4 py-3">
      <Txt as="p" variant="subheading" className="text-destructive-foreground">
        {accessDenied ? 'Access denied' : 'Sign-in failed'}
      </Txt>
      {description && (
        <Txt as="p" variant="caption" tone="muted" className="mt-1">
          {description}
        </Txt>
      )}
      {accessDenied && (
        <Txt as="p" variant="caption" tone="muted" className="mt-1">
          Ask an organization admin to add your account, then sign in again.
        </Txt>
      )}
    </div>
  );
}
