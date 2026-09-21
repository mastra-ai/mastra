import { CreateButton } from '@mastra/playground-ui/components/Button';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useLinkComponent } from '@/lib/framework';

/** Renders the "New scorer" CTA for the page header of the scorers listing page. */
export function ScorersHeaderCreateAction() {
  const { isCmsAvailable } = useIsCmsAvailable();
  const { Link, paths } = useLinkComponent();
  if (!isCmsAvailable) return null;
  return (
    <CreateButton
      render={<Link href={paths.cmsScorersCreateLink()} />}
      tooltip="Create a scorer"
      variant="ghost"
      size="sm"
    >
      New scorer
    </CreateButton>
  );
}
