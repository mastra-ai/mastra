import { linkCountsText } from '../lib/linkCountsText';
import { Metadata } from '@/ds/components/Metadata';
import { Txt } from '@/ds/components/Txt';

export interface KnowledgePageCardProps {
  name: string;
  /** `Page`, `Scope` or a scope's display label. */
  kind: string;
  /** Where the page is addressed, e.g. `org:acme#policies/refunds`. */
  pageRef?: string;
  /** Where the page sits, from its root scope down. */
  path?: string;
  /** Already formatted (`1000+` when the server capped the count); left out when unknown or zero. */
  childCount?: string;
  /** Left out when unknown or both zero. */
  links?: { in: number; out: number };
  /** Of `links`, how many go to pages the graph doesn't draw. */
  notShown?: number;
}

/**
 * What the explorer's graph tooltip says about a page: name, kind and ref, children, links. The graph's
 * dots and the hover cards on page links in chat both draw it.
 */
export function KnowledgePageCard({ name, kind, pageRef, path, childCount, links, notShown }: KnowledgePageCardProps) {
  const children =
    childCount && childCount !== '0' ? `${childCount} ${childCount === '1' ? 'child' : 'children'}` : null;
  const linkText = links && (links.in > 0 || links.out > 0) ? linkCountsText(links, notShown) : null;
  return (
    <>
      <Txt as="span" variant="label" tone="ink">
        {name}
      </Txt>
      <Txt as="span" variant="meta" tone="muted">
        <Metadata>
          <Metadata.Item>{kind}</Metadata.Item>
          {pageRef && <Metadata.Item>{pageRef}</Metadata.Item>}
        </Metadata>
      </Txt>
      {path ? (
        <Txt as="span" variant="meta" tone="muted">
          {path}
        </Txt>
      ) : null}
      {children ? (
        <Txt as="span" variant="meta" tone="muted">
          {children}
        </Txt>
      ) : null}
      {linkText ? (
        <Txt as="span" variant="meta" tone="muted">
          {linkText}
        </Txt>
      ) : null}
    </>
  );
}
