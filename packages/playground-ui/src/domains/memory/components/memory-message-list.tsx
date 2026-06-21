import { format } from 'date-fns';
import { MessageSquareIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '../../../ds/components/Badge';
import { EmptyState } from '../../../ds/components/EmptyState';
import { Skeleton } from '../../../ds/components/Skeleton';
import { cn } from '../../../lib/utils';
import type { MemoryMessage } from '../types';

interface ContentPart {
  type: string;
  text?: string;
  toolInvocation?: {
    toolCallId?: string;
    toolName?: string;
    args?: unknown;
    result?: unknown;
    state?: 'call' | 'partial-call' | 'result';
  };
}

interface MastraV2Content {
  format?: number;
  parts: ContentPart[];
}

function isMastraV2(content: unknown): content is MastraV2Content {
  return typeof content === 'object' && content !== null && 'parts' in content && Array.isArray((content as { parts?: unknown }).parts);
}

function parseContent(content: unknown): unknown {
  let value = content;
  for (let i = 0; i < 3 && typeof value === 'string'; i++) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
      if (typeof parsed === 'string' && parsed !== value) {
        value = parsed;
        continue;
      }
      break;
    } catch {
      break;
    }
  }
  return value;
}

function getDisplayRole(message: MemoryMessage): 'user' | 'assistant' | 'tool' {
  if (message.role === 'assistant') {
    const parsed = parseContent(message.content);
    if (isMastraV2(parsed)) {
      const hasOnlyToolParts = parsed.parts.length > 0 && parsed.parts.every(p => p.type === 'tool-invocation');
      if (hasOnlyToolParts) return 'tool';
    }
    return 'assistant';
  }
  return message.role === 'user' ? 'user' : 'user';
}

function extractTextContent(content: unknown): string {
  const parsed = parseContent(content);
  if (typeof parsed === 'string') return parsed;
  if (isMastraV2(parsed)) {
    const textParts = parsed.parts.filter(p => p.type === 'text' && p.text).map(p => p.text!);
    if (textParts.length > 0) return textParts.join('\n');
    const toolParts = parsed.parts.filter(p => p.type === 'tool-invocation');
    if (toolParts.length > 0) {
      return toolParts
        .map(p => {
          const inv = p.toolInvocation;
          if (!inv) return '';
          if (inv.state === 'result') return `Tool result: ${inv.toolName} → ${JSON.stringify(inv.result)}`;
          return `Tool call: ${inv.toolName}(${JSON.stringify(inv.args)})`;
        })
        .join('\n');
    }
  }
  if (typeof parsed === 'object' && parsed !== null) {
    return JSON.stringify(parsed, null, 2);
  }
  return String(content ?? '');
}

function shouldCollapse(text: string): boolean {
  return text.length > 1200 || text.split('\n').length > 16;
}

function MessageBubble({ message }: { message: MemoryMessage }) {
  const role = getDisplayRole(message);
  const isUser = role === 'user';
  const isTool = role === 'tool';
  const text = useMemo(() => extractTextContent(message.content), [message.content]);
  const needsCollapse = shouldCollapse(text);
  const [expanded, setExpanded] = useState(!needsCollapse);

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('min-w-0 w-full', isUser ? 'max-w-[80%]' : 'max-w-full')}>
        <div className={cn('mb-1 flex items-center gap-1.5', isUser ? 'justify-end' : 'justify-start')}>
          {isUser ? (
            <>
              <span className="text-xs font-mono text-icon3">{format(new Date(message.createdAt), 'HH:mm:ss')}</span>
              <span className="text-icon3">·</span>
              <Badge variant="info" size="xs">User</Badge>
            </>
          ) : (
            <>
              <Badge variant={isTool ? 'warning' : 'success'} size="xs">
                {isTool ? 'Tool' : 'Assistant'}
              </Badge>
              <span className="text-icon3">·</span>
              <span className="text-xs font-mono text-icon3">{format(new Date(message.createdAt), 'HH:mm:ss')}</span>
            </>
          )}
        </div>
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm leading-relaxed',
            isUser ? 'bg-[var(--mastra-bg-3)] text-[var(--mastra-el-6)]' : 'bg-[var(--mastra-bg-2)] text-[var(--mastra-el-5)]',
          )}
        >
          <pre className={cn('whitespace-pre-wrap break-words font-sans', !expanded && 'max-h-[200px] overflow-hidden')}>
            {text}
          </pre>
          {needsCollapse && (
            <button
              type="button"
              className="mt-1 flex items-center gap-1 text-xs text-[var(--mastra-el-3)] hover:text-[var(--mastra-el-6)] transition-colors"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />}
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export interface MemoryMessageListProps {
  messages: MemoryMessage[];
  isLoading?: boolean;
}

export function MemoryMessageList({ messages, isLoading }: MemoryMessageListProps) {
  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-4">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-[60%] rounded-lg" />
        </div>
        <div className="flex justify-start">
          <Skeleton className="h-20 w-[75%] rounded-lg" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-12 w-[50%] rounded-lg" />
        </div>
        <div className="flex justify-start">
          <Skeleton className="h-24 w-[80%] rounded-lg" />
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        className="flex-1"
        iconSlot={<MessageSquareIcon className="size-4" />}
        titleSlot="No messages"
        descriptionSlot="This thread has no messages yet."
      />
    );
  }

  return (
    <div className="flex-1 space-y-3 p-4">
      {messages.map(message => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}
