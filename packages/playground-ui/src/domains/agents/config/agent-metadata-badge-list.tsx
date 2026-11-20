import type { ReactNode } from 'react';
import { AgentMetadataExpandableList } from './agent-metadata-expandable-list';
import { AgentMetadataListEmpty } from './agent-metadata-list';
import { Badge } from '@/ds/components/Badge';
import { useLinkComponent } from '@/lib/framework';

const metadataLinkClassName =
  'pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:items-center pointer-coarse:justify-center';

export interface AgentMetadataBadgeItem {
  id: string;
  label: string;
}

export interface AgentMetadataBadgeListProps {
  items: AgentMetadataBadgeItem[];
  emptyLabel: string;
  testId?: string;
  /** When set, each badge links. Omit it to render plain badges with no router. */
  getHref?: (item: AgentMetadataBadgeItem) => string;
}

export function AgentMetadataBadgeList({ items, emptyLabel, testId, getHref }: AgentMetadataBadgeListProps) {
  if (items.length === 0) {
    return <AgentMetadataListEmpty>{emptyLabel}</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataExpandableList
      items={items}
      getKey={item => item.id}
      renderItem={item =>
        getHref ? (
          <LinkedBadge href={getHref(item)} testId={testId}>
            {item.label}
          </LinkedBadge>
        ) : (
          <Badge data-testid={testId}>{item.label}</Badge>
        )
      }
    />
  );
}

function LinkedBadge({ href, testId, children }: { href: string; testId?: string; children: ReactNode }) {
  const { Link } = useLinkComponent();

  return (
    <Link href={href} data-testid={testId} className={metadataLinkClassName}>
      <Badge>{children}</Badge>
    </Link>
  );
}
