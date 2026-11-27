import { ProviderOAuthDialog as SharedProviderOAuthDialog } from '@mastra/playground-ui/domains/factory';
import type { ProviderOAuthDialogProps } from '@mastra/playground-ui/domains/factory';

import { useCompleteProviderOAuth, usePollProviderOAuth } from '../../../../hooks/use-providers';

export function ProviderOAuthDialog(props: Omit<ProviderOAuthDialogProps, 'actions'>) {
  const { mutateAsync: complete } = useCompleteProviderOAuth();
  const { mutateAsync: poll } = usePollProviderOAuth();
  return <SharedProviderOAuthDialog {...props} actions={{ complete, poll }} />;
}
