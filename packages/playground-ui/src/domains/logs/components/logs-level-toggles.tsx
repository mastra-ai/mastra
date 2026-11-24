import type { LogLevel } from '../types';
import { toggleLogLevel } from './toggle-log-level';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import type { ButtonsGroupProps } from '@/ds/components/ButtonsGroup';
import { Kbd } from '@/ds/components/Kbd';
import { logLevelDotClass } from '@/ds/components/LogsDataList';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { useIsApplePlatform } from '@/hooks/use-keyboard-shortcut-label';
import { cn } from '@/lib/utils';

const LEVEL_LABEL: Record<LogLevel, string> = {
  debug: 'Debug',
  info: 'Info',
  warn: 'Warn',
  error: 'Error',
  fatal: 'Fatal',
};

export type LogsLevelTogglesProps = Omit<ButtonsGroupProps, 'children' | 'onChange'> & {
  levels: readonly LogLevel[];
  value: readonly LogLevel[];
  onValueChange: (value: LogLevel[]) => void;
};

export function LogsLevelToggles({ levels, value, onValueChange, ...props }: LogsLevelTogglesProps) {
  const modifier = useIsApplePlatform() ? '⌘' : 'Ctrl';
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ButtonsGroup aria-label="Log levels" {...props}>
            {levels.map(level => {
              const on = value.includes(level);
              return (
                <Button
                  key={level}
                  variant="ghost"
                  aria-pressed={on}
                  onClick={event => onValueChange(toggleLogLevel(levels, value, level, event.metaKey || event.ctrlKey))}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      on ? logLevelDotClass[level] : 'border border-muted-foreground',
                    )}
                  />
                  <span className={on ? undefined : 'text-muted-foreground'}>{LEVEL_LABEL[level]}</span>
                </Button>
              );
            })}
          </ButtonsGroup>
        }
      />
      <TooltipContent side="bottom">
        <p className="max-w-60 text-pretty">
          Click a level to hide or show it. Hold <Kbd size="xs">{modifier}</Kbd> and click to show only that level.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
