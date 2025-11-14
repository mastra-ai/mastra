import path from 'node:path';
import pc from 'picocolors';
import { version } from '..';
interface DevLoggerOptions {
  timestamp?: boolean;
  colors?: boolean;
}

interface HTTPSOptions {
  key: Buffer;
  cert: Buffer;
}

export class DevLogger {
  private options: DevLoggerOptions;

  constructor(options: DevLoggerOptions = {}) {
    this.options = {
      timestamp: false,
      colors: true,
      ...options,
    };
  }

  private formatTime(): string {
    if (!this.options.timestamp) return '';
    return pc.dim(new Date().toLocaleTimeString());
  }

  private formatPrefix(text: string, color: (str: string) => string): string {
    const time = this.formatTime();
    const prefix = pc.bold(color(text));
    return time ? `${time} ${prefix}` : prefix;
  }

  info(message: string): void {
    const prefix = this.formatPrefix('◐', pc.cyan);
    console.info(`${prefix} ${message}`);
  }

  success(message: string): void {
    const prefix = this.formatPrefix('✓', pc.green);
    console.info(`${prefix} ${pc.green(message)}`);
  }

  warn(message: string): void {
    const prefix = this.formatPrefix('⚠', pc.yellow);
    console.info(`${prefix} ${pc.yellow(message)}`);
  }

  error(message: string): void {
    const prefix = this.formatPrefix('✗', pc.red);
    console.info(`${prefix} ${pc.red(message)}`);
  }

  starting(): void {
    const prefix = this.formatPrefix('◇', pc.blue);
    console.info(`${prefix} ${pc.blue('Starting Mastra dev server...')}`);
  }

  ready(host: string, port: number, startTime?: number, https?: HTTPSOptions): void {
    let protocol = 'http';
    if (https && https.key && https.cert) {
      protocol = 'https';
    }

    console.info('');
    const timing = startTime ? `${Date.now() - startTime} ms` : 'XXX ms';
    console.info(pc.inverse(pc.green(' mastra ')) + ` ${pc.green(version)} ${pc.gray('ready in')} ${timing}`);
    console.info('');
    console.info(`${pc.dim('│')} ${pc.bold('Playground:')} ${pc.cyan(`${protocol}://${host}:${port}/`)}`);
    console.info(`${pc.dim('│')} ${pc.bold('API:')}        ${`${protocol}://${host}:${port}/api`}`);
    console.info('');
  }

  bundling(): void {
    const prefix = this.formatPrefix('◐', pc.magenta);
    console.info(`${prefix} ${pc.magenta('Bundling...')}`);
  }

  bundleComplete(): void {
    const prefix = this.formatPrefix('✓', pc.green);
    console.info(`${prefix} ${pc.green('Bundle complete')}`);
  }

  watching(): void {
    const time = this.formatTime();
    const icon = pc.dim('◯');
    const message = pc.dim('watching for file changes...');
    const fullMessage = `${icon} ${message}`;
    console.info(time ? `${time} ${fullMessage}` : fullMessage);
  }

  restarting(): void {
    const prefix = this.formatPrefix('↻', pc.blue);
    console.info(`${prefix} ${pc.blue('Restarting server...')}`);
  }

  fileChange(file: string): void {
    const prefix = this.formatPrefix('⚡', pc.cyan);
    const fileName = path.basename(file);
    console.info(`${prefix} ${pc.cyan('File changed:')} ${pc.dim(fileName)}`);
  }

  // Enhanced error reporting
  serverError(error: string): void {
    console.info('');
    console.info(pc.red('  ✗ ') + pc.bold(pc.red('Server Error')));
    console.info('');
    console.info(`  ${pc.red('│')} ${error}`);
    console.info('');
  }

  shutdown(): void {
    console.info('');
    const prefix = this.formatPrefix('✓', pc.green);
    console.info(`${prefix} ${pc.green('Dev server stopped')}`);
  }

  envInfo(info: { port: number; env?: string; root: string }): void {
    console.info('');
    console.info(`  ${pc.dim('│')} ${pc.bold('Environment:')} ${pc.cyan(info.env || 'development')}`);
    console.info(`  ${pc.dim('│')} ${pc.bold('Root:')} ${pc.dim(info.root)}`);
    console.info(`  ${pc.dim('│')} ${pc.bold('Port:')} ${pc.cyan(info.port.toString())}`);
  }

  raw(message: string): void {
    console.info(message);
  }

  debug(message: string): void {
    if (process.env.DEBUG || process.env.MASTRA_DEBUG) {
      const prefix = this.formatPrefix('◦', pc.gray);
      console.info(`${prefix} ${pc.gray(message)}`);
    }
  }

  private spinnerChars = ['◐', '◓', '◑', '◒'];
  private spinnerIndex = 0;

  getSpinnerChar(): string {
    const char = this.spinnerChars[this.spinnerIndex];
    this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerChars.length;
    return char || '◐'; // fallback to default char
  }

  clearLine(): void {
    process.stdout.write('\r\x1b[K');
  }

  update(message: string): void {
    this.clearLine();
    const prefix = this.formatPrefix(this.getSpinnerChar(), pc.cyan);
    process.stdout.write(`${prefix} ${message}`);
  }
}

export const devLogger = new DevLogger();
