/** The bucket fields every Metrics chart reads: axis label, bucket start and tooltip heading. */
export const BUCKET_AXIS = { xKey: 'label', timestampKey: 'ts', tooltipLabelKey: 'time' } as const;

/** For narrow cards, which label only their edges: every label carries its day. */
export const EDGE_BUCKET_AXIS = { ...BUCKET_AXIS, xKey: 'edgeLabel' } as const;
