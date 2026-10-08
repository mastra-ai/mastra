import { Txt } from '@mastra/playground-ui/components/Txt';

export function CustomDomainAuthError({ hostname }: { hostname: string }) {
  return (
    <div role="alert" className="border-destructive-edge bg-card rounded-lg border px-4 py-3">
      <Txt as="h2" variant="subheading" className="text-destructive-foreground">
        Mastra Platform sign-in isn&apos;t available on custom domains
      </Txt>
      <Txt as="p" variant="caption" tone="muted" className="mt-2">
        This Factory is served from {hostname}. Mastra Platform authentication only works on Mastra-hosted domains
        (*.mastra.cloud). To use a custom domain, configure your own auth provider — for example WorkOS (WORKOS_API_KEY
        + WORKOS_CLIENT_ID) or Better Auth — and redeploy.
      </Txt>
      <Txt as="p" variant="caption" tone="muted" className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        <a
          href="https://mastra.ai/docs/auth/overview"
          target="_blank"
          rel="noreferrer"
          className="text-foreground hover:underline"
        >
          Auth overview
        </a>
        <a
          href="https://mastra.ai/integrations/auth/workos"
          target="_blank"
          rel="noreferrer"
          className="text-foreground hover:underline"
        >
          WorkOS integration
        </a>
      </Txt>
    </div>
  );
}
