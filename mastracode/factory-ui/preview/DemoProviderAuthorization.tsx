import { Txt } from '@mastra/playground-ui/components/Txt';
import { DemoProviderAuthorizationForm } from './DemoProviderAuthorizationForm';

/** Isolated, clearly labelled stand-in for the provider's authorization page. */
export function DemoProviderAuthorization({ sessionId }: { sessionId: string }) {
  return (
    <main className="bg-background text-foreground min-h-dvh px-8 py-20">
      <div className="mx-auto flex max-w-sm flex-col gap-5">
        <Txt as="h1" variant="title">
          Demo provider sign-in
        </Txt>
        <Txt variant="caption" tone="muted">
          No real account is connected. This page simulates provider authorization.
        </Txt>
        <DemoProviderAuthorizationForm key={sessionId} sessionId={sessionId} />
      </div>
    </main>
  );
}
