import { HeaderCreateAction } from '@/components/ui/header-create-action';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useLinkComponent } from '@/lib/framework';

/** Renders the "New scorer" CTA for the page header of the scorers listing page. */
export function ScorersHeaderCreateAction() {
  const { isCmsAvailable } = useIsCmsAvailable();
  const { paths } = useLinkComponent();
  if (!isCmsAvailable) return null;
  return (
    <HeaderCreateAction href={paths.cmsScorersCreateLink()} tooltip="Create a scorer">
      New scorer
    </HeaderCreateAction>
  );
}
