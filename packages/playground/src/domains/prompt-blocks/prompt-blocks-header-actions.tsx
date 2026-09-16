import { CreateButton } from '@mastra/playground-ui/components/Button';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useLinkComponent } from '@/lib/framework';
import { RouteHeaderActions } from '@/lib/route-header';

/** Portals the "New prompt" CTA into the route header from the prompts listing page. */
export function PromptBlocksHeaderCreateAction() {
  const { isCmsAvailable } = useIsCmsAvailable();
  const { Link, paths } = useLinkComponent();
  if (!isCmsAvailable) return null;
  return (
    <RouteHeaderActions owner="prompt-block-list">
      <CreateButton as={Link} to={paths.cmsPromptBlockCreateLink()} tooltip="Create a prompt" variant="ghost" size="sm">
        New prompt
      </CreateButton>
    </RouteHeaderActions>
  );
}
