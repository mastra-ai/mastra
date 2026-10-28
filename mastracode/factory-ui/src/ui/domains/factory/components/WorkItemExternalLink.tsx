import { buttonVariants } from '@mastra/playground-ui/components/Button';

import { externalLinkLabel } from '../boardItems';
import { workItemIdentifier } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import { SourceIcon } from './BoardIcons';

/** The item where it lives upstream, named by what a person types to find it there. */
export function WorkItemExternalLink({ item, variant = 'ghost' }: { item: WorkItem; variant?: 'ghost' | 'default' }) {
  if (item.url === null) return null;
  const identifier = workItemIdentifier(item);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      aria-label={identifier === undefined ? undefined : `${externalLinkLabel(item.source)}: ${identifier}`}
      className={buttonVariants({ variant, size: 'sm' })}
    >
      <SourceIcon source={item.source} />
      {identifier ?? externalLinkLabel(item.source)}
    </a>
  );
}
