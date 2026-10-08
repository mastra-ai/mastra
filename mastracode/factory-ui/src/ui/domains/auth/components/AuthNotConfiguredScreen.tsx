import { Txt } from '@mastra/playground-ui/components/Txt';

export function AuthNotConfiguredScreen() {
  return (
    <div className="bg-sidebar grid h-dvh w-full place-items-center px-6 text-center">
      <div className="max-w-md space-y-3">
        <Txt as="h1" variant="heading" tone="ink">
          This MastraCode server has no authentication provider configured
        </Txt>
        <Txt as="p" variant="body" tone="muted">
          MastraCode web requires authenticated remote Factories. Configure a supported auth provider on the server,
          then reload this page.
        </Txt>
      </div>
    </div>
  );
}
