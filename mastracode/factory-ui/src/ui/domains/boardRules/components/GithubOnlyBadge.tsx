import { Badge } from '@mastra/playground-ui/components/Badge';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';

/** Marks a lane GitLab never fires, so a rule there for a GitLab project would never run. */
export function GithubOnlyBadge() {
  return (
    <Badge size="xs" variant="neutral" emphasis="subtle" icon={<GithubIcon aria-hidden="true" />}>
      GitHub only
    </Badge>
  );
}
