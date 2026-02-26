/**
 * Enhanced error display component with collapsible stack traces,
 * syntax highlighting, and smart summarization.
 */

import { Container, Text, Spacer } from '@mariozechner/pi-tui';
import type { TUI } from '@mariozechner/pi-tui';
import { theme } from '../theme.js';
import { CollapsibleComponent } from './collapsible.js';

export interface ErrorInfo {
  message: string;
  name?: string;
  stack?: string;
  code?: string;
  file?: string;
  line?: number;
  column?: number;
  context?: {
    before?: string[];
    line?: string;
    after?: string[];
  };
}

/**
 * Parse error information from various error formats
 */
function parseErrorInfo(error: Error | string): ErrorInfo {
  if (typeof error === 'string') {
    // Try to parse error-like string
    const lines = error.split('\n').filter(line => line.trim());
    const firstLine = lines[0] || '';

    // Check for shell command errors
    if (firstLine.includes('command not found')) {
      const cmdMatch = firstLine.match(/(\w+):\s*command not found/);
      return {
        name: 'CommandNotFoundError',
        message: cmdMatch ? `'${cmdMatch[1]}' is not a recognized command` : firstLine,
      };
    }

    // Check for "Output:" prefix (from tool execution)
    const cleanedError = error.replace(/^Output:\s*/m, '');
    const cleanedLines = cleanedError.split('\n').filter(line => line.trim());

    // Match Node.js error patterns
    const nodeErrorMatch = cleanedError.match(/^([A-Z][a-zA-Z]*Error):\s*(.+)$/m);
    if (nodeErrorMatch) {
      // Extract stack trace
      const stackLines = cleanedLines.filter(line => line.match(/^\s*at\s+/));
      return {
        name: nodeErrorMatch[1]!,
        message: nodeErrorMatch[2]!,
        stack: stackLines.length > 0 ? stackLines.join('\n') : undefined,
      };
    }

    // Match common error patterns
    const errorMatch = firstLine.match(/^([A-Z][a-zA-Z]*Error):\s*(.+)$/);
    if (errorMatch) {
      return {
        name: errorMatch[1]!,
        message: errorMatch[2]!,
        stack: lines.slice(1).join('\n'),
      };
    }

    // Extract file location if present
    const fileMatch = error.match(/at\s+(.+?):(\d+):?(\d+)?/);

    return {
      message: cleanedLines[0] || firstLine,
      stack: cleanedLines.length > 1 ? cleanedLines.slice(1).join('\n') : undefined,
      file: fileMatch?.[1],
      line: fileMatch?.[2] ? parseInt(fileMatch[2]) : undefined,
      column: fileMatch?.[3] ? parseInt(fileMatch[3]) : undefined,
    };
  }

  // Error object
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: (error as any).code,
  };
}

/**
 * Format stack trace lines with syntax highlighting
 */
function formatStackTrace(stack: string): string[] {
  const lines = stack.split('\n');
  return lines.map(line => {
    // Highlight file paths
    if (line.match(/^\s*at\s+/)) {
      return line.replace(
        /(\s+at\s+)([^(]+)(\s*\()([^)]+)(\))/,
        (match, at, fn, open, loc, close) =>
          `${theme.fg('muted', at)}${theme.fg('function', fn)}${theme.fg('muted', open)}${theme.fg('path', loc)}${theme.fg('muted', close)}`,
      );
    }

    // Mute empty lines and framework traces
    if (!line.trim() || line.includes('node_modules')) {
      return theme.fg('muted', line);
    }

    return line;
  });
}

/**
 * Collapsible stack trace component
 */
class CollapsibleStackTrace extends CollapsibleComponent {
  constructor(stack: string, options: { expanded?: boolean } = {}, ui: TUI) {
    super(
      {
        header: 'Stack Trace',
        expanded: options.expanded ?? false,
        collapsedLines: 5,
        expandedLines: 100,
        showLineCount: true,
      },
      ui,
    );

    // Format and set the content
    const formattedLines = formatStackTrace(stack);
    this.setContent(formattedLines.join('\n'));
  }
}

/**
 * Enhanced error display component
 */
export class ErrorDisplayComponent extends Container {
  constructor(
    private error: Error | string,
    private options: {
      showStack?: boolean;
      showContext?: boolean;
      expanded?: boolean;
    } = {},
    private ui: TUI,
  ) {
    super();
    this.build();
  }

  private build(): void {
    const info = parseErrorInfo(this.error);

    // Add a visible border around the entire error display
    const borderTop = new Text(theme.fg('error', '┌─ Error ─' + '─'.repeat(50) + '┐'), 0, 0);
    this.addChild(borderTop);

    // Error header container with background
    const errorContainer = new Container();

    // Add a colored background to the error message
    const errorBg = (text: string) => theme.bg('errorBg', text);

    // Error type and message with proper formatting
    if (info.name && info.name !== 'Error') {
      const typeLine = new Container();
      typeLine.addChild(new Text('│ ', 0, 0));
      typeLine.addChild(new Text(errorBg(` ${theme.bold(theme.fg('error', info.name))} `), 0, 0));
      errorContainer.addChild(typeLine);
    }

    // Error message
    const msgLine = new Container();
    msgLine.addChild(new Text('│ ', 0, 0));
    msgLine.addChild(new Text(theme.bold(info.message), 0, 0));
    errorContainer.addChild(msgLine);

    // File location if available
    if (info.file && info.line) {
      const location = `${info.file}:${info.line}${info.column ? `:${info.column}` : ''}`;
      errorContainer.addChild(new Text(theme.fg('muted', `  at ${location}`), 0, 0));
    }

    this.addChild(errorContainer);

    // Code context if available
    if (this.options.showContext && info.context) {
      this.addChild(new Spacer(1));
      this.addChild(this.createCodeContext(info.context, info.line));
    }

    // Stack trace (collapsible)
    if (this.options.showStack && info.stack) {
      this.addChild(new Spacer(1));
      this.addChild(new CollapsibleStackTrace(info.stack, { expanded: this.options.expanded }, this.ui));
    }

    // Add bottom border
    const borderBottom = new Text(theme.fg('error', '└' + '─'.repeat(60) + '┘'), 0, 0);
    this.addChild(borderBottom);
  }

  private createCodeContext(context: NonNullable<ErrorInfo['context']>, errorLine?: number): Container {
    const container = new Container();
    const codeBlock = new Container();

    // Add a header
    codeBlock.addChild(new Text(theme.fg('muted', 'Code context:'), 0, 0));

    // Before lines
    if (context.before) {
      context.before.forEach((line, i) => {
        const lineNum = errorLine ? errorLine - context.before!.length + i : i + 1;
        codeBlock.addChild(new Text(theme.fg('muted', `${lineNum.toString().padStart(4)} │ ${line}`), 0, 0));
      });
    }

    // Error line (highlighted)
    if (context.line && errorLine) {
      codeBlock.addChild(new Text(theme.fg('error', `${errorLine.toString().padStart(4)} │ ${context.line}`), 0, 0));
    }

    // After lines
    if (context.after) {
      context.after.forEach((line, i) => {
        const lineNum = errorLine ? errorLine + i + 1 : i + 1;
        codeBlock.addChild(new Text(theme.fg('muted', `${lineNum.toString().padStart(4)} │ ${line}`), 0, 0));
      });
    }

    container.addChild(codeBlock);
    return container;
  }
}
