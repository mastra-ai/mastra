import { StartsToggle as SharedStartsToggle } from '@mastra/playground-ui/domains/factory';

import type { CardRule } from '../boardDraft';
import { startsText } from '../phaseSummary';

/**
 * How a phase starts, with a switch to start it on its own when `onChange` is given. Turning it off drops the cards it
 * was limited to, as the phase's settings do.
 */
export function StartsToggle({
  autoStartWhen,
  ...props
}: {
  label: string;
  autoStart: boolean;
  autoStartWhen: CardRule | null | undefined;
  onChange?: (on: boolean) => void;
  pending?: boolean;
  failed?: boolean;
}) {
  return <SharedStartsToggle {...props} starts={startsText({ autoStart: props.autoStart, autoStartWhen })} />;
}
