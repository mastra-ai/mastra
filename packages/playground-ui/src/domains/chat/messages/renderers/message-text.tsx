import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Components, ExtraProps } from 'react-markdown';
import { KnowledgePageLink, useHasKnowledgeLinks, useKnowledgeLinksContext } from '../../knowledge/knowledge-links';
import type { UseKnowledgePagePreview } from '../../knowledge/knowledge-links';
import type { MessageMetadata } from '../message-metadata';
import { TripwireNotice } from '../tripwire-notice';
import { errorMessage, messageTextKind } from './message-text-kind';
import {
  KNOWLEDGE_BARE_PROPERTY,
  KNOWLEDGE_REF_PROPERTY,
  remarkKnowledgeChatLinks,
} from '@/domains/knowledge/lib/remarkKnowledgeLinks';
import { Badge } from '@/ds/components/Badge';
import { DisclosureChevron } from '@/ds/components/DisclosureChevron';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import type { MarkdownExternalLinkTarget } from '@/ds/components/MarkdownRenderer';
import { Notice } from '@/ds/components/Notice';
import { IconCircleCheck } from '@/ds/icons/central/IconCircleCheck';
import { Icon } from '@/ds/icons/Icon';

const REF_LINK_CLASS = 'text-foreground underline underline-offset-2';

/** Text like `localhost:3000#top` looks like an address; it links only if the host finds the page. */
function BareKnowledgeRef({ pageRef }: { pageRef: string }) {
  const { usePagePreview } = useKnowledgeLinksContext();
  return usePagePreview ? <ResolvedBareRef pageRef={pageRef} usePagePreview={usePagePreview} /> : <>{pageRef}</>;
}

function ResolvedBareRef({ pageRef, usePagePreview }: { pageRef: string; usePagePreview: UseKnowledgePagePreview }) {
  const card = usePagePreview({ pageRef });
  return card ? (
    <KnowledgePageLink pageRef={pageRef} className={REF_LINK_CLASS}>
      {pageRef}
    </KnowledgePageLink>
  ) : (
    <>{pageRef}</>
  );
}

function ChatKnowledgeRef({ node, ...props }: ComponentProps<'span'> & ExtraProps) {
  const raw = node?.properties[KNOWLEDGE_REF_PROPERTY];
  if (typeof raw !== 'string') return <span {...props} />;
  const ref = raw.trim();
  if (node?.properties[KNOWLEDGE_BARE_PROPERTY] === 'bare') return <BareKnowledgeRef pageRef={ref} />;
  return (
    <KnowledgePageLink pageRef={ref} className={REF_LINK_CLASS}>
      {ref}
    </KnowledgePageLink>
  );
}

const CHAT_REMARK_PLUGINS = [remarkKnowledgeChatLinks];
const CHAT_COMPONENTS: Components = { span: ChatKnowledgeRef };

export interface MessageTextProps {
  text: string;
  metadata: MessageMetadata | undefined;
  externalLinkTarget?: MarkdownExternalLinkTarget;
  streaming?: boolean;
  tableActions?: boolean;
}

/**
 * Part-level text renderer. Markdown for normal text, plus the legacy
 * error/completion handling previously in `ErrorAwareText` (which read part
 * metadata).
 */
export const MessageText = ({ text, metadata, externalLinkTarget, streaming, tableActions }: MessageTextProps) => {
  const [collapsedCompletionCheck, setCollapsedCompletionCheck] = useState(false);
  const knowledgeLinks = useHasKnowledgeLinks();

  switch (messageTextKind(text, metadata)) {
    case 'tripwire':
      return <TripwireNotice reason={text} tripwire={metadata?.tripwire} />;

    case 'warning':
      return (
        <Notice variant="warning" title="Warning">
          <Notice.Message>{text}</Notice.Message>
        </Notice>
      );

    case 'error':
      return (
        <Notice variant="destructive" title="Error">
          <Notice.Message>{errorMessage(text)}</Notice.Message>
        </Notice>
      );

    case 'completion':
      return (
        <div className="mb-2 space-y-2">
          <button
            onClick={() => setCollapsedCompletionCheck(s => !s)}
            aria-expanded={!collapsedCompletionCheck}
            className="flex items-center gap-2"
          >
            <Icon>
              <DisclosureChevron direction="right" />
            </Icon>
            <Badge variant="blue" icon={<IconCircleCheck />}>
              {collapsedCompletionCheck ? 'Show' : 'Hide'} completion check
            </Badge>
          </button>
          {!collapsedCompletionCheck && (
            <Notice variant="info" title={metadata?.completionResult?.passed ? 'Complete' : 'Not Complete'}>
              <MarkdownRenderer externalLinkTarget={externalLinkTarget}>{text}</MarkdownRenderer>
            </Notice>
          )}
        </div>
      );

    default:
      return (
        <MarkdownRenderer
          externalLinkTarget={externalLinkTarget}
          streaming={Boolean(streaming)}
          tableActions={tableActions}
          remarkPlugins={knowledgeLinks ? CHAT_REMARK_PLUGINS : undefined}
          components={knowledgeLinks ? CHAT_COMPONENTS : undefined}
        >
          {text}
        </MarkdownRenderer>
      );
  }
};
