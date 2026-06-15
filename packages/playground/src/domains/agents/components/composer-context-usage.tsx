import { Button, Popover, PopoverContent, PopoverTrigger, Txt, cn } from '@mastra/playground-ui';

import { usePlaygroundModelOptional } from '../context/playground-model-context';
import { useAgent } from '../hooks/use-agent';
import { useModelContextWindow } from '../hooks/use-model-context-window';
import { extractPrompt } from '../utils/extractPrompt';
import { useConversationUsage } from '@/lib/ai-ui/chat/conversation-usage-context';

export const formatTokens = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${value}`;
};

const ringColor = (percent: number | undefined): string => {
  if (percent === undefined) return 'text-neutral3';
  if (percent >= 90) return 'text-red-400';
  if (percent >= 70) return 'text-orange-400';
  return 'text-neutral4';
};

const RADIUS = 7;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ContextDonut({ percent }: { percent: number | undefined }) {
  // Without a known context window the ring stays an empty track; the popover
  // still exposes the absolute numbers.
  const fill = percent === undefined ? 0 : Math.min(percent, 100) / 100;
  return (
    <svg viewBox="0 0 18 18" className="h-[18px] w-[18px] -rotate-90" aria-hidden>
      <circle cx="9" cy="9" r={RADIUS} fill="none" strokeWidth="2.5" className="stroke-surface5" />
      <circle
        cx="9"
        cy="9"
        r={RADIUS}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={`${CIRCUMFERENCE * fill} ${CIRCUMFERENCE}`}
        stroke="currentColor"
        className={cn('transition-all duration-normal', ringColor(percent))}
      />
    </svg>
  );
}

function UsageRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Txt variant="ui-sm" className="text-neutral3">
        {label}
      </Txt>
      <Txt variant="ui-sm" className="text-neutral6 font-mono">
        {value}
      </Txt>
    </div>
  );
}

const countEntries = (value: unknown): number => {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return 0;
};

export interface ComposerContextUsageProps {
  agentId?: string;
  hasMemory?: boolean;
}

/**
 * Composer indicator for the live context occupancy of the conversation.
 * The ring fills with `inputTokens of the last step / model context window`
 * (context window resolved from models.dev when available). Before the first
 * run, the popover still breaks down what the context is made of.
 */
export function ComposerContextUsage({ agentId, hasMemory }: ComposerContextUsageProps) {
  const usage = useConversationUsage();
  const playgroundModel = usePlaygroundModelOptional();
  const contextWindow = useModelContextWindow(playgroundModel?.provider, playgroundModel?.model);
  const { data: agent } = useAgent(agentId);

  // Rough chars/4 estimate — good enough to show the prompt's order of magnitude.
  const systemPrompt = agent ? extractPrompt(agent.instructions) : '';
  const systemPromptTokens = systemPrompt ? Math.round(systemPrompt.length / 4) : undefined;
  const toolsCount = countEntries(agent?.tools);
  const workflowsCount = countEntries(agent?.workflows);
  const skillsCount = countEntries(agent?.skills);

  const contextTokens = usage.lastStep?.inputTokens;
  const percent =
    contextTokens !== undefined && contextWindow ? Math.round((contextTokens / contextWindow) * 100) : undefined;

  const tooltip =
    contextTokens === undefined
      ? 'Context usage'
      : percent === undefined
        ? `Context: ${formatTokens(contextTokens)} tokens`
        : `Context: ${percent}% of ${formatTokens(contextWindow!)}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="default"
          size="icon-md"
          type="button"
          tooltip={tooltip}
          data-testid="composer-context-usage-trigger"
        >
          <ContextDonut percent={percent} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-4">
        <div className="space-y-3" data-testid="composer-context-usage-content">
          <div className="flex items-center justify-between gap-4">
            <Txt variant="ui-md" className="text-neutral6">
              Context
            </Txt>
            {percent !== undefined && (
              <Txt variant="ui-sm" className={cn('font-mono', ringColor(percent))}>
                {percent}%
              </Txt>
            )}
          </div>

          {contextTokens !== undefined && contextWindow ? (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface5">
              <div
                className={cn('h-full rounded-full bg-current transition-all duration-normal', ringColor(percent))}
                style={{ width: `${Math.min(percent ?? 0, 100)}%` }}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            {contextTokens !== undefined ? (
              <UsageRow
                label="Context used"
                value={
                  contextWindow
                    ? `${formatTokens(contextTokens)} / ${formatTokens(contextWindow)}`
                    : formatTokens(contextTokens)
                }
              />
            ) : (
              contextWindow !== undefined && <UsageRow label="Context window" value={formatTokens(contextWindow)} />
            )}
            {playgroundModel?.model ? <UsageRow label="Model" value={playgroundModel.model} /> : null}
            {usage.lastStep?.cachedInputTokens ? (
              <UsageRow label="Cached input" value={formatTokens(usage.lastStep.cachedInputTokens)} />
            ) : null}
            {usage.lastStep?.outputTokens !== undefined && (
              <UsageRow label="Output (last step)" value={formatTokens(usage.lastStep.outputTokens)} />
            )}
            {usage.lastStep?.reasoningTokens ? (
              <UsageRow label="Reasoning" value={formatTokens(usage.lastStep.reasoningTokens)} />
            ) : null}
            {usage.runCount > 0 && (
              <UsageRow
                label={`Conversation total (${usage.runCount} ${usage.runCount === 1 ? 'run' : 'runs'})`}
                value={formatTokens(usage.cumulative.totalTokens)}
              />
            )}
          </div>

          {agent ? (
            <div className="space-y-1.5 border-t border-border1 pt-3" data-testid="composer-context-usage-breakdown">
              <Txt variant="ui-sm" className="text-neutral3">
                In every request
              </Txt>
              {systemPromptTokens !== undefined && (
                <UsageRow label="System prompt" value={`~${formatTokens(systemPromptTokens)}`} />
              )}
              <UsageRow label="Tools" value={`${toolsCount}`} />
              {workflowsCount > 0 && <UsageRow label="Workflows" value={`${workflowsCount}`} />}
              {skillsCount > 0 && <UsageRow label="Skills" value={`${skillsCount}`} />}
              {hasMemory !== undefined && <UsageRow label="Memory" value={hasMemory ? 'on' : 'off'} />}
            </div>
          ) : null}

          <Txt variant="ui-xs" className="text-neutral3">
            {contextTokens === undefined
              ? 'Send a message to measure live context usage.'
              : 'Context = everything sent on the last step: system prompt, tools, skills, memory and messages.'}
          </Txt>
        </div>
      </PopoverContent>
    </Popover>
  );
}
