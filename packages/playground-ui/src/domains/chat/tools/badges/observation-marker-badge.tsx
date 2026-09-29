import { Brain, Eye, Unplug } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Extractions, ObservationSections, ObservationStats } from './observation-marker-details';
import { compressionRatio, extractedValueEntries, formatTokens } from './observation-marker-format';
import { Activity, ActivityContent, ActivityHeadline, ActivityTrigger } from '@/ds/components/ai/activity';
import type { ActivityStatus } from '@/ds/components/ai/activity';
import { ToolCallOutput } from '@/ds/components/ai/tool-call';

export interface OmMarkerData {
  observedAt?: string;
  completedAt?: string;
  failedAt?: string;
  disconnectedAt?: string;
  startedAt?: string;
  tokensObserved?: number;
  tokensToObserve?: number;
  observationTokens?: number;
  observations?: string;
  currentTask?: string;
  suggestedResponse?: string;
  extractedValues?: Record<string, unknown>;
  extractionFailures?: Array<{ slug: string; error: string }>;
  durationMs?: number;
  error?: string;
  recordId?: string;
  cycleId?: string;
  threadId?: string;
  threadIds?: string[];
  operationType?: 'observation' | 'reflection';
  _state?: 'loading' | 'complete' | 'failed' | 'buffering' | 'buffering-complete' | 'buffering-failed' | 'activated';
  chunksActivated?: number;
  tokensActivated?: number;
  messagesActivated?: number;
  config?: {
    scope?: string;
    messageTokens?: number;
    observationTokens?: number;
  };
  tokensToBuffer?: number;
  tokensBuffered?: number;
  bufferedTokens?: number;
}

type MarkerState = NonNullable<OmMarkerData['_state']> | 'disconnected';

interface MarkerLine {
  icon: ReactNode;
  label: string;
  detail?: string;
  status: ActivityStatus;
  body?: ReactNode;
}

export interface ObservationMarkerBadgeProps {
  toolName: string;
  omData: OmMarkerData;
}

function markerState(omData: OmMarkerData): MarkerState {
  if (omData._state) return omData._state;
  if (omData.failedAt) return 'failed';
  if (omData.completedAt) return 'complete';
  if (omData.disconnectedAt) return 'disconnected';
  return 'loading';
}

function tokenFlow(inputTokens?: number, outputTokens?: number): string {
  const ratio = compressionRatio(inputTokens, outputTokens);
  const input = inputTokens ? formatTokens(inputTokens) : '?';
  const output = outputTokens ? formatTokens(outputTokens) : '?';
  return `${input}→${output} tokens${ratio ? ` (-${ratio}x)` : ''}`;
}

function pendingTokens(tokens?: number): string | undefined {
  return tokens ? `~${formatTokens(tokens)} tokens` : undefined;
}

function markerLine(toolName: string, state: MarkerState, omData: OmMarkerData): MarkerLine {
  const isReflection = omData.operationType === 'reflection';
  const icon = isReflection ? <Brain /> : <Eye />;
  const doneLabel = isReflection ? 'Reflected' : 'Observed';
  const errorBody = omData.error ? <ToolCallOutput text={omData.error} error /> : undefined;

  switch (state) {
    case 'loading':
      return {
        icon,
        label: isReflection ? 'Reflecting' : 'Observing',
        detail: pendingTokens(omData.tokensToObserve),
        status: 'running',
      };
    case 'complete':
      return {
        icon,
        label: doneLabel,
        detail: tokenFlow(omData.tokensObserved, omData.observationTokens),
        status: 'idle',
        body: (
          <>
            <ObservationStats
              inputTokens={omData.tokensObserved}
              outputTokens={omData.observationTokens}
              durationMs={omData.durationMs}
            />
            <ObservationSections
              observations={omData.observations}
              isReflection={isReflection}
              maxHeight="500px"
              currentTask={omData.currentTask}
              suggestedResponse={omData.suggestedResponse}
            />
            <Extractions extractedValues={omData.extractedValues} extractionFailures={omData.extractionFailures} />
          </>
        ),
      };
    case 'disconnected':
      return {
        icon: <Unplug />,
        label: isReflection ? 'Reflection interrupted' : 'Observation interrupted',
        detail: pendingTokens(omData.tokensToObserve),
        status: 'idle',
      };
    case 'failed':
      return {
        icon,
        label: isReflection ? 'Reflection' : 'Observation',
        status: 'error',
        body: errorBody,
      };
    case 'buffering':
      return {
        icon,
        label: isReflection ? 'Buffering reflection' : 'Buffering observations',
        detail: pendingTokens(omData.tokensToBuffer),
        status: 'running',
      };
    case 'buffering-complete':
      return {
        icon,
        label: isReflection ? 'Buffered reflection' : 'Buffered observations',
        detail: tokenFlow(omData.tokensBuffered, omData.bufferedTokens),
        status: 'idle',
        body: (
          <>
            <ObservationSections observations={omData.observations} isReflection={isReflection} maxHeight="240px" />
            <Extractions extractedValues={omData.extractedValues} extractionFailures={omData.extractionFailures} />
          </>
        ),
      };
    case 'buffering-failed':
      return {
        icon,
        label: isReflection ? 'Buffered reflection' : 'Buffered observations',
        status: 'error',
        body: errorBody,
      };
    case 'activated':
      return {
        icon,
        label: doneLabel,
        detail: tokenFlow(omData.tokensActivated, omData.observationTokens),
        status: 'idle',
        body: (
          <>
            <ObservationStats inputTokens={omData.tokensActivated} outputTokens={omData.observationTokens} />
            <ObservationSections observations={omData.observations} isReflection={isReflection} maxHeight="500px" />
          </>
        ),
      };
    default:
      return { icon: <Brain />, label: toolName, status: 'idle' };
  }
}

/** `data-om-*` attributes let the thread's bracket overlay find each marker in the DOM. */
export const ObservationMarkerBadge = ({ toolName, omData }: ObservationMarkerBadgeProps) => {
  const state = markerState(omData);
  const isReflection = omData.operationType === 'reflection';
  const { icon, label, detail, status, body } = markerLine(toolName, state, omData);
  const hasExtractions =
    extractedValueEntries(omData.extractedValues).length > 0 || (omData.extractionFailures?.length ?? 0) > 0;
  const opensItself = (state === 'failed' && isReflection) || hasExtractions;
  const [openedByUser, setOpenedByUser] = useState<boolean>();

  return (
    <Activity
      open={openedByUser ?? opensItself}
      onOpenChange={setOpenedByUser}
      foldable={Boolean(body)}
      status={status}
      aria-label={label}
      data-om-badge={omData.cycleId ?? ''}
      data-om-state={state}
      data-om-type={isReflection ? 'reflection' : 'observation'}
      data-om-no-highlight={state === 'activated' ? 'true' : undefined}
    >
      <ActivityTrigger>
        <ActivityHeadline icon={icon} label={label} detail={detail} detailFont="sans" />
      </ActivityTrigger>
      {body && <ActivityContent>{body}</ActivityContent>}
    </Activity>
  );
};
