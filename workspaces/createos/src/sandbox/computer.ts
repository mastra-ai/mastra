import type { SandboxComputer as MastraSandboxComputer } from '@mastra/core/workspace';
import { CreateosSandboxValidationError } from '@nodeops-createos/sandbox';
import type { Sandbox, SandboxComputer as NativeSandboxComputer } from '@nodeops-createos/sandbox';

import type { CreateOSSandbox } from './index';

const DEFAULT_SCREEN_ID = 'screen-0';
const DEFAULT_READY_TIMEOUT_MS = 120_000;
const READY_POLL_INTERVAL_MS = 2_000;

export interface CreateOSComputerUseOptions {
  /** CreateOS desktop screen controlled through Mastra. */
  screenId?: string;
  /** Maximum time to wait for the desktop stack after the VM starts. */
  readyTimeoutMs?: number;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/** Adapts CreateOS's multi-screen computer API to Mastra's single-desktop capability. */
export class CreateOSComputer implements MastraSandboxComputer {
  private readonly sandbox: CreateOSSandbox;
  private readonly screenId: string;
  private readonly readyTimeoutMs: number;
  private readySandboxId?: string;
  private readyPromise?: Promise<void>;

  constructor(sandbox: CreateOSSandbox, options: CreateOSComputerUseOptions = {}) {
    this.sandbox = sandbox;
    this.screenId = options.screenId ?? DEFAULT_SCREEN_ID;
    this.readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
  }

  async screenshot() {
    const computer = await this.computer();
    const data = await computer.screenshot({ screenId: this.screenId });
    return { data: new Uint8Array(data), mediaType: 'image/png' as const };
  }

  async leftClick(x: number, y: number): Promise<void> {
    const computer = await this.computer();
    await computer.mouse.click({ button: 'left', x, y, count: 1 }, { screenId: this.screenId });
  }

  async rightClick(x: number, y: number): Promise<void> {
    const computer = await this.computer();
    await computer.mouse.click({ button: 'right', x, y, count: 1 }, { screenId: this.screenId });
  }

  async doubleClick(x: number, y: number): Promise<void> {
    const computer = await this.computer();
    await computer.mouse.click({ button: 'left', x, y, count: 2 }, { screenId: this.screenId });
  }

  async moveMouse(x: number, y: number): Promise<void> {
    const computer = await this.computer();
    await computer.mouse.move({ x, y }, { screenId: this.screenId });
  }

  async drag(from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
    const computer = await this.computer();
    await computer.mouse.drag({ from, to }, { screenId: this.screenId });
  }

  async scroll(direction: 'up' | 'down', amount: number): Promise<void> {
    const computer = await this.computer();
    await computer.mouse.scroll({ direction, amount }, { screenId: this.screenId });
  }

  async type(text: string): Promise<void> {
    const computer = await this.computer();
    await computer.keyboard.type(text, { screenId: this.screenId });
  }

  async press(key: string | string[]): Promise<void> {
    const computer = await this.computer();
    await computer.keyboard.press(Array.isArray(key) ? key : [key], { screenId: this.screenId });
  }

  async getScreenSize(): Promise<{ width: number; height: number }> {
    const computer = await this.computer();
    return computer.screen({ screenId: this.screenId });
  }

  async getCursorPosition(): Promise<{ x: number; y: number }> {
    const computer = await this.computer();
    return computer.cursor({ screenId: this.screenId });
  }

  async streamUrl(): Promise<string | null> {
    try {
      const computer = await this.computer();
      const connection = await computer.screens.connect(this.screenId);
      return connection.url ?? null;
    } catch {
      return null;
    }
  }

  private async computer(): Promise<NativeSandboxComputer> {
    await this.sandbox.ensureRunning();
    const sandbox = this.sandbox.createos;
    await this.ensureReady(sandbox);
    return sandbox.computer;
  }

  private async ensureReady(sandbox: Sandbox): Promise<void> {
    if (this.readySandboxId !== sandbox.id) {
      this.readySandboxId = sandbox.id;
      this.readyPromise = undefined;
    }

    if (!this.readyPromise) {
      this.readyPromise = this.waitForDesktop(sandbox).catch(error => {
        this.readyPromise = undefined;
        throw error;
      });
    }
    await this.readyPromise;
  }

  private async waitForDesktop(sandbox: Sandbox): Promise<void> {
    const deadline = Date.now() + this.readyTimeoutMs;
    while (true) {
      try {
        await sandbox.computer.screen({ screenId: this.screenId });
        return;
      } catch (error) {
        const desktopStarting = error instanceof CreateosSandboxValidationError && error.statusCode === 409;
        if (!desktopStarting || Date.now() >= deadline) throw error;
        await sleep(Math.min(READY_POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())));
      }
    }
  }
}
