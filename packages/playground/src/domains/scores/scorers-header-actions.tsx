import { CreateButton } from '@mastra/playground-ui/components/Button';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useLinkComponent } from '@/lib/framework';
import { RouteHeaderActions } from '@/lib/route-header';

/** Portals the "New scorer" CTA into the route header from the scorers listing page. */
export function ScorersHeaderCreateAction() {
  const { isCmsAvailable } = useIsCmsAvailable();
  const { Link, paths } = useLinkComponent();
  if (!isCmsAvailable) return null;
  return (
    <RouteHeaderActions owner="scorer-list">
      <CreateButton
        render={<Link href={paths.cmsScorersCreateLink()} />}
        tooltip="Create a scorer"
        variant="ghost"
        size="sm"
      >
        New scorer
      </CreateButton>
    </RouteHeaderActions>
  );
}
