export type DataListSpacerProps = {
  /** Pixel height of the spacer. Pass 0 to render nothing. */
  height: number;
};

/**
 * Pads top/bottom of the visible window when virtualizing — preserves the
 * grid's total scroll height for the rows that aren't currently rendered.
 * Spans the full grid width so it doesn't disturb column layout.
 */
export function DataListSpacer({ height }: DataListSpacerProps) {
  if (height <= 0) return null;
  return <div className="col-span-full" style={{ height }} />;
}
