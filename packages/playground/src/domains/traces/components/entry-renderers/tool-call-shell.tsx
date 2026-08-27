import {
  stringifyToolValue,
  ToolCall,
  ToolCallContent,
  ToolCallDetail,
  ToolCallDisclosure,
  ToolCallHeader,
  ToolCallLabel,
  ToolCallMono,
  ToolCallTrigger,
} from '@mastra/playground-ui/components/ai/tool-call';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export interface ToolCallShellSection {
  /** Also the accessible name of the code block, e.g. `Arguments`, `Metadata`. */
  label: string;
  value: unknown;
}

export interface ToolCallShellProps {
  label: ReactNode;
  detail?: ReactNode;
  failed?: boolean;
  /** Payload blocks revealed by the disclosure, in reading order. Empty ones are skipped. */
  sections?: ToolCallShellSection[];
  /** Rendered beside the header, outside the trigger: a link inside a button is not a link. */
  adornment?: ReactNode;
  testId?: string;
}

/** A `{}` block is a section that exists but says nothing, and it reads as broken next to real ones. */
function isEmptyPayload(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;

  return value === '';
}

/**
 * The collapsed header-plus-payload row the chat uses for every invocation. Trace rows that stand
 * for a call — a tool, a workflow, a workflow step — read the same way, so they share this shell
 * and only vary their icon, label and detail.
 *
 * Rows drawn with it own their payload, which is why `rendersOwnPayload` keeps the generic details
 * disclosure off them.
 */
export function ToolCallShell({ label, detail, failed, sections = [], adornment, testId }: ToolCallShellProps) {
  const blocks = sections
    .map(({ label: sectionLabel, value }) => ({
      label: sectionLabel,
      text: isEmptyPayload(value) ? undefined : stringifyToolValue(value),
    }))
    .filter((block): block is { label: string; text: string } => Boolean(block.text));

  return (
    <ToolCall status={failed ? 'error' : 'idle'} className="min-w-0 flex-1" data-testid={testId}>
      {/* No hover plate: in chat a tool row is one of many cards, here it is a step on a rail and
          a filled block would read as a card the other rows do not have. The chevron and the
          focus ring carry the affordance. */}
      <div className="flex min-w-0 items-center gap-2">
        <ToolCallTrigger className="w-fit max-w-full min-w-0 rounded-none hover:bg-transparent">
          {/* The header is composed rather than `ToolCallPresentedHeader`, and drops its spacer:
            both throw the chevron to the far right, where a timeline row already keeps the comment
            bubble. Here the disclosure and the entity link stay with the label they belong to. */}
          {/* No `ToolCallIcon`: the timeline rail already marks what kind of step this is, and a
            second icon on the same line only repeats it. */}
          <ToolCallHeader className="w-auto px-0">
            {/* The DS label caps itself at 55% of the header, which suits a full-width header. This
              one hugs its content, so that cap would truncate every label. */}
            <ToolCallLabel className="max-w-none">{label}</ToolCallLabel>
            {detail ? <ToolCallDetail>{detail}</ToolCallDetail> : null}
            {failed ? <X size={13} role="img" aria-label="Failed" className="text-error shrink-0" /> : null}
            <ToolCallDisclosure />
          </ToolCallHeader>
        </ToolCallTrigger>
        {adornment}
      </div>
      <ToolCallContent>
        {blocks.map(block => (
          <div key={block.label} className="flex flex-col gap-1">
            {/* Labelled because a trace row can show three payloads at once; the chat card,
                which shows arguments then result, can leave them implicit. */}
            <span className="text-neutral3 text-ui-sm font-mono uppercase">{block.label}</span>
            <ToolCallMono copyText={block.text} aria-label={block.label}>
              {block.text}
            </ToolCallMono>
          </div>
        ))}
      </ToolCallContent>
    </ToolCall>
  );
}
