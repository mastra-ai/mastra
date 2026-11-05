import type { Logger } from 'chat';

import { getErrorFromUnknown } from '../error/utils';
import type { LogLevel } from '../logger/constants';
import type { IMastraLogger } from '../logger/logger';

const LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const satisfies readonly LogLevel[];

export interface ToChatLoggerOptions {
  /** Lowest level to forward. `silent` forwards nothing. Defaults to `debug`, so the Mastra logger decides. */
  minLevel?: LogLevel;
  /** Written as the `component` field on each record. Defaults to `chat-sdk`. */
  component?: string;
}

// `getErrorFromUnknown` and pino both write to the error, so a frozen one needs a writable stand-in.
function toLoggableError(error: Error) {
  return getErrorFromUnknown(Object.isExtensible(error) ? error : Object.create(error));
}

function toFields(args: unknown[]): Record<string, unknown> {
  if (args.length === 0) return {};
  const [first] = args;
  if (args.length === 1 && first instanceof Error) return { error: toLoggableError(first) };
  if (args.length === 1 && first && typeof first === 'object' && !Array.isArray(first)) {
    const fields = first as Record<string, unknown>;
    return fields.error instanceof Error ? { ...fields, error: toLoggableError(fields.error) } : fields;
  }
  return { args };
}

/**
 * Reads the logger on each call, so a Chat instance that already exists follows
 * `Mastra.setLogger`.
 * @internal
 */
export function createChatLogger(getLogger: () => IMastraLogger, options: ToChatLoggerOptions = {}): Logger {
  const { minLevel = 'debug', component = 'chat-sdk' } = options;
  const floor = LEVELS.indexOf(minLevel);

  const forward =
    (level: Exclude<LogLevel, 'silent'>) =>
    (message: string, ...args: unknown[]): void => {
      if (LEVELS.indexOf(level) < floor) return;
      const logger = getLogger();
      try {
        logger[level](message, { ...toFields(args), component });
      } catch {
        // A value the logger can't serialize must not break the Chat SDK code that logged it.
        try {
          logger[level](message, { component });
        } catch {
          // The logger itself failed, and Chat SDK code can't recover from that.
        }
      }
    };

  return {
    child: prefix => createChatLogger(getLogger, { minLevel, component: `${component}:${prefix}` }),
    debug: forward('debug'),
    info: forward('info'),
    warn: forward('warn'),
    error: forward('error'),
  };
}

/**
 * Adapts a Mastra logger to the Chat SDK `Logger` interface. Pass the result to
 * a Chat SDK adapter or to `chatOptions.logger`. `child(prefix)` extends the
 * `component` field as `component:prefix`.
 */
export function toChatLogger(logger: IMastraLogger, options?: ToChatLoggerOptions): Logger {
  return createChatLogger(() => logger, options);
}
