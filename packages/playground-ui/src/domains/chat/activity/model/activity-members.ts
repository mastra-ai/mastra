import type { ReactNode } from 'react';

import type { ReasoningContent } from '@/ds/components/ai/activity';

export type ActivityCallStatus = 'running' | 'done' | 'error';

/** A tool call in a stretch. The app draws its row and body; the stretch words and folds them. */
export interface ActivityCall {
  kind: 'call';
  key: string;
  toolName: string;
  args: unknown;
  status: ActivityCallStatus;
  startedAt?: number;
  row: ReactNode;
  /** What opening the call alone shows; absent when it has nothing to show. */
  body?: ReactNode;
}

export interface ActivityThought {
  kind: 'thought';
  key: string;
  content: ReasoningContent;
}

/** One uninterrupted run of tool calls and thoughts, read as a single activity line. */
export type ActivityMember = ActivityCall | ActivityThought;
