import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';

interface AppBootScreenProps {
  accessibleLabel: string;
  message?: string;
}

export function AppBootScreen({ accessibleLabel, message = 'Opening your workspace' }: AppBootScreenProps) {
  return (
    <main role="status" aria-label={accessibleLabel} aria-live="polite" className="mastracode-boot-screen">
      <span className="mastracode-boot-atmosphere" aria-hidden="true" />
      <span className="mastracode-boot-grain" aria-hidden="true" />
      <div className="mastracode-boot-content">
        <span className="mastracode-boot-mark-shell" aria-hidden="true">
          <span className="mastracode-boot-mark">
            <LogoWithoutText className="h-12 w-auto" />
          </span>
        </span>

        <div className="mastracode-boot-copy">
          <strong>Mastra Code</strong>
          <span>{message}</span>
        </div>
      </div>
    </main>
  );
}
