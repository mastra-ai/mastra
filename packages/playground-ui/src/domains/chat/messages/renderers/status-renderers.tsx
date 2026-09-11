import type {
  ErrorRendererProps,
  MessageStatusRenderers,
  TripwireRendererProps,
  WarningRendererProps,
} from '@mastra/react';

import { TripwireNotice } from '../tripwire-notice';
import { Notice } from '@/ds/components/Notice';

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

// eslint-disable-next-line react-refresh/only-export-components -- renderer map intentionally co-located with its renderers
export const messageStatusRenderers: MessageStatusRenderers = {
  Error: ErrorStatusRenderer,
  Warning: WarningStatusRenderer,
  Tripwire: TripwireStatusRenderer,
};
