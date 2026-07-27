import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
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
  /**
   * Optional content rendered inside the card, below the title/description.
   * Reserves vertical space even when empty so cards stay aligned across the
   * grid. Lives outside the selectable button so it can host its own
   * interactive controls without nesting buttons.
   */
  footer?: ReactNode;
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
  footer,
}: AgentSelectableCardProps) => {
  const agentColor = useAgentColor();

  const containerStyle: CSSProperties = {
    ['--agent-color-bg' as string]: agentColor.background,
    ...(isSelected ? { borderColor: agentColor.background } : null),
  };

  const checkStyle: CSSProperties | undefined = isSelected
    ? {
        borderColor: agentColor.background,
        backgroundColor: agentColor.background,
        color: agentColor.foreground,
      }
    : undefined;

  return (
    <div
      data-testid={testId}
      style={containerStyle}
      className={cn(
        'flex w-full flex-col gap-2 rounded-lg border bg-surface3 p-4 transition-colors',
        'focus-visible:!border-[var(--agent-color-bg)] focus-within:!border-[var(--agent-color-bg)]',
        isSelected ? 'bg-surface4' : 'border-border1',
        disabled && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={isSelected}
        aria-label={ariaLabel}
        className={cn(
          'flex w-full items-center gap-3 text-left outline-none',
          !disabled && 'cursor-pointer hover:opacity-90 active:opacity-80',
          disabled && 'cursor-not-allowed',
        )}
      >
        {icon}
        <div className="flex min-w-0 flex-1 flex-col">
          <Txt variant="ui-md" className="text-neutral6 truncate font-medium">
            {title}
          </Txt>
          {subtitle && (
            <Txt variant="ui-sm" className="text-neutral3 truncate">
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
            !isSelected && 'border-border1 bg-transparent',
          )}
        >
          {isSelected && <Check className="h-3 w-3" />}
        </span>
      </button>
      {footer}
    </div>
  );
};
