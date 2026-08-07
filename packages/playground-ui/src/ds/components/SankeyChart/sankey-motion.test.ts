import { describe, expect, it } from 'vitest';

import type { FixedSankeyGeometry } from './sankey-chart-utils';
import { interpolateSankeyGeometry } from './use-sankey-geometry-transition';

function geometry({
  nodeX,
  linkSourceX,
  linkTargetX,
}: {
  nodeX: number;
  linkSourceX: number;
  linkTargetX: number;
}): FixedSankeyGeometry {
  return {
    nodes: new Map([['theme', { x: nodeX, y: 10, centerY: 20, height: 20 }]]),
    links: new Map([
      [
        `link-${linkSourceX}`,
        {
          sourceX: linkSourceX,
          targetX: linkTargetX,
          sourceY: 20,
          targetY: 30,
          sourceWidth: 8,
          targetWidth: 10,
        },
      ],
    ]),
  };
}

describe('Sankey geometry motion', () => {
  describe('when a reordered perspective replaces its adjacent links', () => {
    it('continuously morphs current nodes and ribbons from the previous geometry', () => {
      const previous = geometry({ nodeX: 20, linkSourceX: 20, linkTargetX: 120 });
      const current = geometry({ nodeX: 220, linkSourceX: 220, linkTargetX: 320 });

      const halfway = interpolateSankeyGeometry(previous, current, 0.5);

      expect(halfway.nodes.get('theme')).toMatchObject({ x: 120, y: 10, height: 20 });
      expect(halfway.links.get('link-220')).toMatchObject({ sourceX: 120, targetX: 220 });
    });
  });
});
