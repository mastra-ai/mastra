import { Button } from '@mastra/playground-ui/components/Button';

import { ProviderAccessSection } from '../../settings/components/ProviderAccessSection';

export interface PersonalProviderFactoryStepProps {
  onContinue: () => void;
}

export function PersonalProviderFactoryStep({ onContinue }: PersonalProviderFactoryStepProps) {
  return (
    <section aria-label="Personal provider setup" className="flex max-w-3xl flex-col gap-6">
      <ProviderAccessSection
        fixedScope="user"
        description="Optional: add personal credentials for any providers you want to use. Your organization provider already supports shared Factory runs."
      />
      <div>
        <Button variant="primary" size="lg" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </section>
  );
}
