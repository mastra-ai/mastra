import type {
  ErrorRendererProps,
  MessageStatusRenderers,
  TripwireRendererProps,
  WarningRendererProps,
} from '@mastra/react';
import { Notice } from '@mastra/playground-ui';

import { TripwireNotice } from '../tripwire-notice';

export const ErrorStatusRenderer = ({ text }: ErrorRendererProps) => (
  <Notice variant="destructive" title="Error">
    <Notice.Message>{text}</Notice.Message>
  </Notice>
);

export const WarningStatusRenderer = ({ text }: WarningRendererProps) => (
  <Notice variant="warning" title="Warning">
    <Notice.Message>{text}</Notice.Message>
  </Notice>
);

export const TripwireStatusRenderer = ({ text, tripwire }: TripwireRendererProps) => (
  <TripwireNotice reason={text} tripwire={tripwire} />
);

export const messageStatusRenderers: MessageStatusRenderers = {
  Error: ErrorStatusRenderer,
  Warning: WarningStatusRenderer,
  Tripwire: TripwireStatusRenderer,
};
