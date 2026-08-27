import type { ReactNode } from 'react';

import type { TimelineSpan } from '../../lib/build-thread-timeline';

export type EntryRendererProps = {
  span: TimelineSpan;
  /** Control shown right after the row's label, e.g. the link to the entity in Studio. */
  adornment?: ReactNode;
};
