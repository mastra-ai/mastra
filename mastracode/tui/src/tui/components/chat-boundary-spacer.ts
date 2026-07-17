import { Spacer } from '@earendil-works/pi-tui';

/**
 * Static spacer placed above a chat component.
 *
 * Height is set once during reconciliation via `setLines()` and stays
 * fixed until the next reconciliation pass — no per-frame recomputation.
 */
export class ChatBoundarySpacer extends Spacer {
  readonly isChatBoundarySpacer = true;

  constructor(lines = 1) {
    super(lines);
  }
}

export function isChatBoundarySpacer(component: unknown): component is ChatBoundarySpacer {
  return !!component && (component as { isChatBoundarySpacer?: boolean }).isChatBoundarySpacer === true;
}
