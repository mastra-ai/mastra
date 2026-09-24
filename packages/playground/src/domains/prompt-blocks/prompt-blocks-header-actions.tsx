import { HeaderCreateAction } from '@/components/ui/header-create-action';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useLinkComponent } from '@/lib/framework';

/** Renders the "New prompt" CTA for the page header of the prompts listing page. */
export function PromptBlocksHeaderCreateAction() {
  const { isCmsAvailable } = useIsCmsAvailable();
  const { paths } = useLinkComponent();
  if (!isCmsAvailable) return null;
  return (
    <HeaderCreateAction href={paths.cmsPromptBlockCreateLink()} tooltip="Create a prompt">
      New prompt
    </HeaderCreateAction>
  );
}
