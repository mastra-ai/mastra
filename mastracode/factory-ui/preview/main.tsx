import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import { setupWorker } from 'msw/browser';
import { ProviderConnectionNoticeContext } from '../src/ui/domains/settings/components/provider-connection-notice';
import { DemoProviderAuthorization } from './DemoProviderAuthorization';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { ApiConfigProvider } from '../src/api/config';
import { EmptyFactoryState } from '../src/ui/domains/workspaces/components/EmptyFactoryState';
import { OnboardingPreview } from '../src/ui/domains/workspaces/components/OnboardingPreview';
import { handlers, demoKey, resetDemo, saveDemoModelSetupPreset } from './handlers';
import { modelSetupPresetSchema } from '../src/ui/domains/workspaces/services/modelSetupPreset';
import '@fontsource-variable/mona-sans/standard.css';
import '@mastra/playground-ui/style.css';
import './preview.css';

const url = new URL(location.href);
const connected = url.searchParams.get('demo-connect') ?? url.pathname.match(/^\/auth\/(github|linear)\/connect/)?.[1];
if (connected === 'github' || connected === 'linear') {
  sessionStorage.setItem(demoKey(connected), 'true');
  history.replaceState(null, '', '/');
}

function Complete() {
  const stored = sessionStorage.getItem(demoKey('model-setup'));
  const preset = modelSetupPresetSchema.safeParse(stored ? JSON.parse(stored) : undefined).data;
  return (
    <main className="bg-background text-foreground grid min-h-dvh lg:grid-cols-2">
      <section className="flex flex-col items-start justify-center gap-6 p-10 lg:p-20">
        <Txt variant="caption" tone="muted">
          SETUP COMPLETE
        </Txt>
        <Txt as="h1" variant="display">
          Your factory is ready.
        </Txt>
        <Txt tone="muted">You’ve reached the end of this onboarding preview.</Txt>
        <Button variant="primary" size="lg" onClick={resetDemo}>
          Try another setup
        </Button>
      </section>
      <OnboardingPreview
        step="model-preset"
        preset={preset}
        factoryName={sessionStorage.getItem(demoKey('name')) ?? undefined}
        model={sessionStorage.getItem(demoKey('model')) ?? undefined}
      />
    </main>
  );
}

async function start() {
  const worker = setupWorker(...handlers);
  await worker.start({ quiet: true, onUnhandledRequest: 'bypass' });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 500 }, mutations: { retry: false } },
  });
  createRoot(document.getElementById('root')!).render(
    <ThemeProvider defaultTheme="light" storageKey="factory-onboarding-preview.theme">
      <TooltipProvider>
        <QueryClientProvider client={client}>
          <ApiConfigProvider baseUrl="">
            <ProviderConnectionNoticeContext value="Preview only: enter DEMO. Do not use a real API key; no live account is connected.">
              {url.searchParams.has('demo-provider') ? (
                <DemoProviderAuthorization sessionId={url.searchParams.get('session') ?? ''} />
              ) : (
                <MemoryRouter>
                  <Routes>
                    <Route path="/" element={<EmptyFactoryState onSaveModelPreset={saveDemoModelSetupPreset} />} />
                    <Route path="/factories/:id" element={<Complete />} />
                  </Routes>
                </MemoryRouter>
              )}
              <Toaster />
            </ProviderConnectionNoticeContext>
          </ApiConfigProvider>
        </QueryClientProvider>
      </TooltipProvider>
    </ThemeProvider>,
  );
}
void start().catch(error => {
  const root = document.getElementById('root');
  if (root) root.textContent = 'The preview could not start. Please reload in a browser that supports service workers.';
  console.error(error);
});
