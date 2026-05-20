/**
 * Lightweight inline indicator for temporal gaps between messages.
 */

import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import { BOX_INDENT, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';

export interface TemporalGapOptions {
  message?: string;
  gapText?: string;
}

export class TemporalGapComponent extends Container {
  constructor(options: TemporalGapOptions) {
    super();

    this.addChild(new Text(theme.fg('dim', `  ⏳ ${resolveGapText(options)}`), BOX_INDENT, 0));
    this.addChild(new Spacer(1));
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'system';
  }

  setExpanded(_expanded: boolean): void {}
}

function resolveGapText(options: TemporalGapOptions): string {
  const gapText = options.gapText?.trim();
  if (gapText) {
    return gapText;
  }

  const message = options.message?.trim();
  if (!message) {
    return 'Time passed';
  }

  const separatorIndex = message.indexOf(' — ');
  return separatorIndex >= 0 ? message.slice(0, separatorIndex).trim() : message;
}
