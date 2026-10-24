import { Container, Text } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { BOX_INDENT, mastra, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';

export interface StateSignalOptions {
  stateId: string;
  mode: 'snapshot' | 'delta';
  version?: number;
  message?: string;
}

/** Readable names for state ids whose wire value would mislead (Knowledge pins keep a legacy id). */
const STATE_LABELS: Record<string, string> = { 'subconscious-pins': 'pinned knowledge' };

export class StateSignalComponent extends Container {
  constructor(options: StateSignalOptions) {
    super();

    const title = chalk
      .hex(mastra.blue)
      .bold(`State ${options.mode}: ${STATE_LABELS[options.stateId] ?? options.stateId}`);
    this.addChild(new Text(title, BOX_INDENT, 0));

    const message = options.message?.trim();
    if (message) {
      const preview = message.length > 180 ? `${message.slice(0, 177)}...` : message;
      this.addChild(new Text(theme.fg('dim', preview), BOX_INDENT + 2, 0));
    }
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'system';
  }
}
