/**
 * One-line transcript notice for persisted `data-mastracode-account-switch`
 * parts: account rotations, pool exhaustion, and starting-on-account notices.
 * Modeled on OMMarkerComponent (single themed Text row). The copy comes from
 * the SDK's shared formatter so live `info`-event lines and history-reloaded
 * part lines read identically.
 */

import { Container, Text } from '@earendil-works/pi-tui';
import { accountSwitchNoticeText } from '@mastra/code-sdk/auth/account-rotation-processor';
import type { AccountSwitchPartData } from '@mastra/code-sdk/auth/account-rotation-processor';

import { BOX_INDENT, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';

export type AccountSwitchNoticeData = AccountSwitchPartData;

export function formatAccountSwitchNotice(data: AccountSwitchNoticeData): string {
  return theme.fg('muted', `  ⇄ ${accountSwitchNoticeText(data)}`);
}

export class AccountSwitchNoticeComponent extends Container {
  private textChild: Text;

  constructor(data: AccountSwitchNoticeData) {
    super();
    this.textChild = new Text(formatAccountSwitchNotice(data), BOX_INDENT, 0);
    this.addChild(this.textChild);
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'other';
  }
}
