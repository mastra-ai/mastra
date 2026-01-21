'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';

// Priority emoji to color mapping
const PRIORITY_COLORS = {
  '🔴': 'text-red-500',
  '🟡': 'text-yellow-500',
  '🟢': 'text-green-500',
} as const;

const PRIORITY_BG = {
  '🔴': 'bg-red-500/10',
  '🟡': 'bg-yellow-500/10',
  '🟢': 'bg-green-500/10',
} as const;

type Priority = keyof typeof PRIORITY_COLORS;

interface ParsedObservation {
  priority: Priority | null;
  time: string | null;
  content: string;
  children: ParsedObservation[];
  isNested: boolean;
}

interface ParsedDateBlock {
  date: string;
  relativeTime?: string; // e.g., "(3 days ago)"
  observations: ParsedObservation[];
}

interface ParsedThread {
  threadId: string;
  dateBlocks: ParsedDateBlock[];
}

interface ParsedObservations {
  threads: ParsedThread[];
  currentTask?: string;
  suggestedResponse?: string;
}

/**
 * Parse a single observation line
 */
function parseObservationLine(line: string, isNested: boolean = false): ParsedObservation | null {
  // Match: * 🔴 (14:30) Content or * -> nested content
  const trimmed = line.trim();
  
  if (!trimmed) return null;
  
  // Check for nested arrow format: * -> content
  if (trimmed.startsWith('* ->') || trimmed.startsWith('->')) {
    const content = trimmed.replace(/^\*?\s*->\s*/, '');
    return {
      priority: null,
      time: null,
      content,
      children: [],
      isNested: true,
    };
  }
  
  // Check for standard format: * 🔴 (14:30) Content
  const match = trimmed.match(/^\*\s*(🔴|🟡|🟢)?\s*(?:\((\d{1,2}:\d{2})\))?\s*(.+)$/);
  
  if (match) {
    const [, priority, time, content] = match;
    return {
      priority: (priority as Priority) || null,
      time: time || null,
      content: content.trim(),
      children: [],
      isNested,
    };
  }
  
  // Fallback for lines that don't match the pattern
  if (trimmed.startsWith('*')) {
    return {
      priority: null,
      time: null,
      content: trimmed.replace(/^\*\s*/, ''),
      children: [],
      isNested,
    };
  }
  
  return null;
}

/**
 * Parse the raw observations string into structured data
 */
function parseObservations(raw: string): ParsedObservations {
  const result: ParsedObservations = {
    threads: [],
  };
  
  // Extract current-task if present
  const currentTaskMatch = raw.match(/<current-task>\s*([\s\S]*?)\s*<\/current-task>/);
  if (currentTaskMatch) {
    result.currentTask = currentTaskMatch[1].trim();
  }
  
  // Extract suggested-response if present
  const suggestedMatch = raw.match(/<suggested-response>\s*([\s\S]*?)\s*<\/suggested-response>/);
  if (suggestedMatch) {
    result.suggestedResponse = suggestedMatch[1].trim();
  }
  
  // Extract observations content
  const observationsMatch = raw.match(/<observations>\s*([\s\S]*?)\s*<\/observations>/);
  const observationsContent = observationsMatch ? observationsMatch[1] : raw;
  
  // Split by thread headers if present
  const threadSections = observationsContent.split(/(?=Thread [a-f0-9]+:)/i);
  
  for (const section of threadSections) {
    const trimmedSection = section.trim();
    if (!trimmedSection) continue;
    
    // Check for thread header
    const threadMatch = trimmedSection.match(/^Thread ([a-f0-9]+):/i);
    const threadId = threadMatch ? threadMatch[1] : 'default';
    const content = threadMatch ? trimmedSection.replace(/^Thread [a-f0-9]+:\s*/i, '') : trimmedSection;
    
    const thread: ParsedThread = {
      threadId,
      dateBlocks: [],
    };
    
    // Split by date headers
    const lines = content.split('\n');
    let currentDateBlock: ParsedDateBlock | null = null;
    let lastObservation: ParsedObservation | null = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check for date header: "Date: Dec 4, 2025" or "Date: Dec 4, 2025 (3 days ago)"
      const dateMatch = trimmedLine.match(/^Date:\s*(.+?)(?:\s*\(([^)]+)\))?$/);
      if (dateMatch) {
        if (currentDateBlock) {
          thread.dateBlocks.push(currentDateBlock);
        }
        currentDateBlock = {
          date: dateMatch[1].trim(),
          relativeTime: dateMatch[2]?.trim(),
          observations: [],
        };
        lastObservation = null;
        continue;
      }
      
      // Check indentation for nested observations
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1].length : 0;
      const isNested = indent >= 2 && (trimmedLine.startsWith('* ->') || trimmedLine.startsWith('->'));
      
      const observation = parseObservationLine(trimmedLine, isNested);
      
      if (observation) {
        if (!currentDateBlock) {
          // Create a default date block if none exists
          currentDateBlock = {
            date: 'Recent',
            observations: [],
          };
        }
        
        if (observation.isNested && lastObservation) {
          // Add as child of last observation
          lastObservation.children.push(observation);
        } else {
          currentDateBlock.observations.push(observation);
          lastObservation = observation;
        }
      }
    }
    
    if (currentDateBlock) {
      thread.dateBlocks.push(currentDateBlock);
    }
    
    if (thread.dateBlocks.length > 0) {
      result.threads.push(thread);
    }
  }
  
  return result;
}

/**
 * Render a single observation
 */
function ObservationItem({ observation }: { observation: ParsedObservation }) {
  const priorityColor = observation.priority ? PRIORITY_COLORS[observation.priority] : 'text-muted-foreground';
  const bgColor = observation.priority ? PRIORITY_BG[observation.priority] : '';
  
  // Get a subtle left border color based on priority (instead of emoji)
  const borderColor = observation.priority 
    ? { '🔴': 'border-l-red-500', '🟡': 'border-l-yellow-500', '🟢': 'border-l-green-500' }[observation.priority]
    : 'border-l-transparent';
  
  return (
    <div className={cn('py-0.5', observation.isNested && 'ml-4 border-l border-border/50 pl-2')}>
      <div className={cn(
        'flex items-start gap-1.5 text-xs',
        bgColor && 'rounded px-1.5 py-0.5',
        bgColor,
        !observation.isNested && observation.priority && `border-l-2 ${borderColor} pl-1.5`
      )}>
        {observation.isNested && (
          <span className="text-muted-foreground flex-shrink-0">→</span>
        )}
        <span className={cn('flex-1', priorityColor, '[&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[10px]')}>
          <MarkdownRenderer>{observation.content}</MarkdownRenderer>
        </span>
        {observation.time && (
          <span className="text-muted-foreground flex-shrink-0 font-mono text-[10px] ml-2">
            {observation.time}
          </span>
        )}
      </div>
      {observation.children.length > 0 && (
        <div className="mt-0.5">
          {observation.children.map((child, i) => (
            <ObservationItem key={i} observation={child} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Render a date block
 */
function DateBlock({ block }: { block: ParsedDateBlock }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 mb-1 sticky top-0 bg-background/95 backdrop-blur-sm py-1">
        <span className="text-xs font-medium text-foreground">{block.date}</span>
        {block.relativeTime && (
          <span className="text-[10px] text-muted-foreground">({block.relativeTime})</span>
        )}
      </div>
      <div className="space-y-0">
        {block.observations.map((obs, i) => (
          <ObservationItem key={i} observation={obs} />
        ))}
      </div>
    </div>
  );
}

/**
 * Render a thread section
 */
function ThreadSection({ thread, showThreadId }: { thread: ParsedThread; showThreadId: boolean }) {
  return (
    <div className="mb-3">
      {showThreadId && thread.threadId !== 'default' && (
        <div className="text-[10px] font-mono text-muted-foreground mb-1 px-1 py-0.5 bg-muted/50 rounded inline-block">
          Thread {thread.threadId}
        </div>
      )}
      {thread.dateBlocks.map((block, i) => (
        <DateBlock key={i} block={block} />
      ))}
    </div>
  );
}

export interface ObservationRendererProps {
  observations: string;
  className?: string;
  maxHeight?: string;
  showCurrentTask?: boolean;
  showSuggestedResponse?: boolean;
}

/**
 * Renders raw observation text with proper formatting
 */
export function ObservationRenderer({
  observations,
  className,
  maxHeight = '300px',
  showCurrentTask = false,
  showSuggestedResponse = false,
}: ObservationRendererProps) {
  const parsed = useMemo(() => parseObservations(observations), [observations]);
  
  const hasMultipleThreads = parsed.threads.length > 1 || 
    (parsed.threads.length === 1 && parsed.threads[0].threadId !== 'default');
  
  if (parsed.threads.length === 0 && !parsed.currentTask && !parsed.suggestedResponse) {
    return (
      <div className={cn('text-xs text-muted-foreground italic', className)}>
        No observations
      </div>
    );
  }
  
  return (
    <div className={cn('text-sm', className)}>
      <div 
        className="overflow-y-auto pr-1" 
        style={{ maxHeight }}
      >
        {parsed.threads.map((thread, i) => (
          <ThreadSection 
            key={thread.threadId + i} 
            thread={thread} 
            showThreadId={hasMultipleThreads}
          />
        ))}
      </div>
      
      {showCurrentTask && parsed.currentTask && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Current Task
          </div>
          <div className="text-xs text-foreground whitespace-pre-wrap">
            {parsed.currentTask}
          </div>
        </div>
      )}
      
      {showSuggestedResponse && parsed.suggestedResponse && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Suggested Response
          </div>
          <div className="text-xs text-foreground/80 italic whitespace-pre-wrap">
            {parsed.suggestedResponse}
          </div>
        </div>
      )}
    </div>
  );
}

export default ObservationRenderer;
