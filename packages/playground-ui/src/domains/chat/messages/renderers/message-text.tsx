import { CheckCircleIcon } from 'lucide-react';
import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Components, ExtraProps } from 'react-markdown';
import { KnowledgePageLink, useHasKnowledgeLinks } from '../../knowledge/knowledge-links';
import type { MessageMetadata } from '../message-metadata';
import { TripwireNotice } from '../tripwire-notice';
import { errorMessage, messageTextKind } from './message-text-kind';
import { KNOWLEDGE_REF_PROPERTY, remarkKnowledgeChatLinks } from '@/domains/knowledge/lib/remarkKnowledgeLinks';
import { Badge } from '@/ds/components/Badge';
import { DisclosureChevron } from '@/ds/components/DisclosureChevron';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import type { MarkdownExternalLinkTarget } from '@/ds/components/MarkdownRenderer';
import { Notice } from '@/ds/components/Notice';
import { Icon } from '@/ds/icons/Icon';

function ChatKnowledgeRef({ node, ...props }: ComponentProps<'span'> & ExtraProps) {
  const raw = node?.properties[KNOWLEDGE_REF_PROPERTY];
  if (typeof raw !== 'string') return <span {...props} />;
  const ref = raw.trim();
  return (
    <KnowledgePageLink pageRef={ref} className="text-foreground underline underline-offset-2">
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
            <Badge variant="blue" icon={<CheckCircleIcon />}>
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
