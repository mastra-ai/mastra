import { Button } from '@mastra/playground-ui/components/Button';

import { ProviderAccessSection } from '../../settings/components/ProviderAccessSection';

export interface PersonalProviderFactoryStepProps {
  /** False when the organization has no shared provider the user could pick a model from. */
  hasOrgProvider?: boolean;
  onContinue: () => void;
}

export function PersonalProviderFactoryStep({ hasOrgProvider = true, onContinue }: PersonalProviderFactoryStepProps) {
  return (
    <section aria-label="Personal provider setup" className="flex max-w-3xl flex-col gap-6">
      <ProviderAccessSection
        fixedScope="user"
        description={
          hasOrgProvider
            ? 'Optional: add personal credentials for any providers you want to use. Your organization provider already supports shared Factory runs.'
            : 'Your organization has not connected a shared provider yet. Add your own credentials to run Factory, or ask an organization admin to connect one.'
        }
      />
      <div>
        <Button variant="primary" size="lg" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </section>
  );
}
