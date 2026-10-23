import { useId } from 'react';

/** A DOM-safe id prefix for SVG defs (gradients, filters) owned by one chart instance. */
export function useChartDefsId() {
  return `chart${useId().replace(/:/g, '')}`;
}
