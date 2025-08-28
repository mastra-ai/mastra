import { exec } from 'child_process';
import { devLogger } from './dev-logger.js';

export interface HotkeyActions {
  restart?: () => Promise<void>;
  openBrowser?: (url?: string) => Promise<void>;
  quit?: () => void;
}

export class HotkeyHandler {
  private actions: HotkeyActions;
  private isListening = false;

  constructor(actions: HotkeyActions) {
    this.actions = actions;
  }

  start(): void {
    if (this.isListening) return;

    this.isListening = true;

    // Enable raw mode to capture key presses
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      process.stdin.on('data', this.handleKeyPress.bind(this));
    }
  }

  stop(): void {
    if (!this.isListening) return;

    this.isListening = false;

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
  }

  private async handleKeyPress(key: string): Promise<void> {
    // Handle Ctrl+C
    if (key === '\u0003') {
      this.actions.quit?.();
      return;
    }

    switch (key.toLowerCase()) {
      case 'r':
        devLogger.info('Restarting server...');
        try {
          await this.actions.restart?.();
          devLogger.success('Server restarted');
        } catch (error) {
          devLogger.error(`Failed to restart server: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;

      case 'o':
        devLogger.info('Opening in browser...');
        try {
          await this.actions.openBrowser?.();
          devLogger.success('Opened in browser');
        } catch (error) {
          devLogger.error(`Failed to open browser: ${error instanceof Error ? error.message : String(error)}`);
        }
        break;

      case 'q':
        devLogger.info('Shutting down...');
        this.actions.quit?.();
        break;
    }
  }
}

// Utility function to open URL in browser
export async function openInBrowser(url: string): Promise<void> {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';

  return new Promise((resolve, reject) => {
    exec(`${command} ${url}`, error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
