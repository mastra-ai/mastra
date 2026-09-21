import { CreateButton } from '@mastra/playground-ui/components/Button';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useLinkComponent } from '@/lib/framework';

/** Renders the "New prompt" CTA for the page header of the prompts listing page. */
export function PromptBlocksHeaderCreateAction() {
  const { isCmsAvailable } = useIsCmsAvailable();
  const { Link, paths } = useLinkComponent();
  if (!isCmsAvailable) return null;
  return (
    <CreateButton
      render={<Link href={paths.cmsPromptBlockCreateLink()} />}
      tooltip="Create a prompt"
      variant="ghost"
      size="sm"
    >
      New prompt
    </CreateButton>
  );
}
