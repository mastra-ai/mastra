import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Txt } from '@mastra/playground-ui/components/Txt';

/** Isolated, clearly labelled stand-in for the provider's authorization page. */
export function DemoProviderAuthorization() {
  return (
    <main className="bg-background text-foreground min-h-dvh px-8 py-20">
      <div className="mx-auto flex max-w-sm flex-col gap-5">
        <Txt as="h1" variant="title">
          Demo provider sign-in
        </Txt>
        <Txt variant="caption" tone="muted">
          No real account is connected. Copy this code and paste it in the onboarding tab.
        </Txt>
        <div className="flex items-center gap-4">
          <Txt font="mono" variant="title">
            DEMO
          </Txt>
          <CopyButton content="DEMO" tooltip="Copy demo code" />
        </div>
      </div>
    </main>
  );
}
