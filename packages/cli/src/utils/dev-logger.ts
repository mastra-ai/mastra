import path from 'node:path';
import pc from 'picocolors';
import { version } from '..';
interface DevLoggerOptions {
  timestamp?: boolean;
  colors?: boolean;
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
    console.log(`${prefix} ${message}`);
  }

  success(message: string): void {
    const prefix = this.formatPrefix('✓', pc.green);
    console.log(`${prefix} ${pc.green(message)}`);
  }

  warn(message: string): void {
    const prefix = this.formatPrefix('⚠', pc.yellow);
    console.log(`${prefix} ${pc.yellow(message)}`);
  }

  error(message: string): void {
    const prefix = this.formatPrefix('✗', pc.red);
    console.log(`${prefix} ${pc.red(message)}`);
  }

  starting(): void {
    const prefix = this.formatPrefix('◇', pc.blue);
    console.log(`${prefix} ${pc.blue('Starting Mastra dev server...')}`);
  }

  ready(host: string, port: number, startTime?: number): void {
    console.log('');
    const timing = startTime ? `${Date.now() - startTime} ms` : 'XXX ms';
    console.log(pc.inverse(pc.green(' mastra ')) + ` ${pc.green(version)} ${pc.gray('ready in')} ${timing}`);
    console.log('');
    console.log(`${pc.dim('│')} ${pc.bold('Local:')}   ${pc.cyan(`http://${host}:${port}/`)}`);
    console.log(`${pc.dim('│')} ${pc.bold('API:')}     ${`http://${host}:${port}/api`}`);
    console.log('');
  }

  bundling(): void {
    const prefix = this.formatPrefix('◐', pc.magenta);
    console.log(`${prefix} ${pc.magenta('Bundling...')}`);
  }

  bundleComplete(): void {
    const prefix = this.formatPrefix('✓', pc.green);
    console.log(`${prefix} ${pc.green('Bundle complete')}`);
  }

  watching(): void {
    const time = this.formatTime();
    const icon = pc.dim('◯');
    const message = pc.dim('watching for file changes...');
    const fullMessage = `${icon} ${message}`;
    console.log(time ? `${time} ${fullMessage}` : fullMessage);
  }

  restarting(): void {
    const prefix = this.formatPrefix('↻', pc.blue);
    console.log(`${prefix} ${pc.blue('Restarting server...')}`);
  }

  fileChange(file: string): void {
    const prefix = this.formatPrefix('⚡', pc.cyan);
    const fileName = path.basename(file);
    console.log(`${prefix} ${pc.cyan('File changed:')} ${pc.dim(fileName)}`);
  }

  // Enhanced error reporting
  serverError(error: string): void {
    console.log('');
    console.log(pc.red('  ✗ ') + pc.bold(pc.red('Server Error')));
    console.log('');
    console.log(`  ${pc.red('│')} ${error}`);
    console.log('');
  }

  shutdown(): void {
    console.log('');
    const prefix = this.formatPrefix('✓', pc.green);
    console.log(`${prefix} ${pc.green('Dev server stopped')}`);
  }

  envInfo(info: { port: number; env?: string; root: string }): void {
    console.log('');
    console.log(`  ${pc.dim('│')} ${pc.bold('Environment:')} ${pc.cyan(info.env || 'development')}`);
    console.log(`  ${pc.dim('│')} ${pc.bold('Root:')} ${pc.dim(info.root)}`);
    console.log(`  ${pc.dim('│')} ${pc.bold('Port:')} ${pc.cyan(info.port.toString())}`);
  }

  raw(message: string): void {
    console.log(message);
  }

  debug(message: string): void {
    if (process.env.DEBUG || process.env.MASTRA_DEBUG) {
      const prefix = this.formatPrefix('◦', pc.gray);
      console.log(`${prefix} ${pc.gray(message)}`);
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
