import { linkCountsText } from '../lib/linkCountsText';
import { Metadata } from '@/ds/components/Metadata';
import { Txt } from '@/ds/components/Txt';

export interface KnowledgePageCardProps {
  name: string;
  kind: string;
  pageRef?: string;
  path?: string;
  childCount?: string;
  links?: { in: number; out: number };
  notShown?: number;
}

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
