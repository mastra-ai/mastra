import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent } from '@mastra/playground-ui/components/Collapsible';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { AccountSourceChoice } from '../../hooks/useAccountSource';
import type { OnboardingModelSetup } from '../../hooks/useOnboardingModelSetup';
import type { PreviewProvider } from '../../hooks/useProviderConnection';
import { OnboardingAccountLane } from './OnboardingAccountLane';

/** The accounts the answer needs, each with its provider and default model. */
export function OnboardingAccountLanes({
  setup,
  local,
  creating,
  companyChoice,
  personalChoice,
  onPreviewCompany,
  onPreviewPersonal,
}: {
  setup: OnboardingModelSetup;
  local: boolean;
  creating: boolean;
  companyChoice: AccountSourceChoice;
  personalChoice: AccountSourceChoice;
  onPreviewCompany: PreviewProvider;
  onPreviewPersonal: PreviewProvider;
}) {
  const { scope, company, personal } = setup;
  // Both accounts read the same provider list, so its failure is said once rather than in each account.
  const { catalogError, retrying, retry } = company.connection;
  if (catalogError)
    return (
      <div className="flex flex-col items-start gap-3">
        <Txt variant="caption" role="alert">
          {catalogError.message}
        </Txt>
        <Button disabled={retrying} onClick={retry}>
          {retrying && <Spinner size="sm" aria-hidden="true" />}
          Retry
        </Button>
      </div>
    );
  if (local)
    return (
      <OnboardingAccountLane
        scope="org"
        name="Factory default"
        lane={company}
        choice={companyChoice}
        creating={creating}
        onPreviewProvider={onPreviewCompany}
      />
    );

  // Both accounts stay rendered so switching the answer folds one away and opens the other in place.
  const hybrid = scope === 'hybrid';
  return (
    <>
      <Collapsible open={scope !== 'user'} className="onboarding-collapse">
        <CollapsibleContent>
          <OnboardingAccountLane
            scope="org"
            name="Company account"
            heading={{ label: 'Factory work', detail: 'Company account', shown: hybrid }}
            lane={company}
            choice={companyChoice}
            creating={creating}
            onPreviewProvider={onPreviewCompany}
          />
        </CollapsibleContent>
      </Collapsible>
      <Collapsible open={scope !== 'factory'} className="onboarding-collapse">
        <CollapsibleContent>
          <OnboardingAccountLane
            scope="user"
            name="Your account"
            heading={{ label: 'Your sessions', detail: 'Your own account', shown: hybrid }}
            lane={personal}
            choice={personalChoice}
            creating={creating}
            offersGateway={!hybrid}
            onPreviewProvider={onPreviewPersonal}
          />
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
