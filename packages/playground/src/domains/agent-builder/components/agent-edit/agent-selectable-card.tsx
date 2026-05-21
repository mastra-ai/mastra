import { Txt, cn } from '@mastra/playground-ui';
import { Check } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useAgentColor } from '../../contexts/agent-color-context';

export interface AgentSelectableCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  isSelected: boolean;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel?: string;
  testId?: string;
  checkTestId?: string;
}

export const AgentSelectableCard = ({
  title,
  subtitle,
  icon,
  isSelected,
  disabled = false,
  onClick,
  ariaLabel,
  testId,
  checkTestId,
}: AgentSelectableCardProps) => {
  const agentColor = useAgentColor();
  const hasAgentColor = agentColor !== null;
  const useAgentColors = isSelected && hasAgentColor;

  const containerStyle: CSSProperties | undefined = hasAgentColor
    ? {
        ['--agent-color-bg' as string]: agentColor.background,
        ...(isSelected ? { borderColor: agentColor.background } : null),
      }
    : undefined;

  const checkStyle: CSSProperties | undefined = useAgentColors
    ? {
        borderColor: agentColor.background,
        backgroundColor: agentColor.background,
        color: agentColor.foreground,
      }
    : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isSelected}
      aria-label={ariaLabel}
      data-testid={testId}
      style={containerStyle}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-surface3 p-4 text-left transition-colors cursor-pointer active:opacity-90',
        hasAgentColor
          ? 'focus-visible:!border-[var(--agent-color-bg)] focus-visible:outline-none'
          : 'hover:bg-surface4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent1',
        hasAgentColor && 'hover:bg-surface4',
        isSelected
          ? useAgentColors
            ? 'bg-surface4'
            : 'border-accent1 bg-surface4 ring-1 ring-accent1'
          : 'border-border1',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      {icon}
      <div className="flex min-w-0 flex-1 flex-col">
        <Txt variant="ui-md" className="truncate font-medium text-neutral6">
          {title}
        </Txt>
        {subtitle && (
          <Txt variant="ui-sm" className="truncate text-neutral3">
            {subtitle}
          </Txt>
        )}
      </div>
      <span
        aria-hidden="true"
        data-testid={checkTestId}
        style={checkStyle}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
          isSelected
            ? useAgentColors
              ? ''
              : 'border-accent1 bg-accent1 text-surface1'
            : 'border-border1 bg-transparent',
        )}
      >
        {isSelected && <Check className="h-3 w-3" />}
      </span>
    </button>
  );
};
