import { describe, expect, it } from 'vitest';

import { getRouteHeaderHeading } from '../route-heading';
import type { CrumbDef } from '../types';

/**
 * The layout uses this for the accessible page heading, so it must resolve the
 * *deepest* meaningful crumb and never surface blank text.
 */
describe('getRouteHeaderHeading', () => {
  describe('when the deepest crumb carries a label', () => {
    it('uses that label', () => {
      const crumbs: CrumbDef[] = [
        { id: 'agents', label: 'Agents' },
        { id: 'agent', label: 'Weather agent' },
      ];

      expect(getRouteHeaderHeading(crumbs)).toBe('Weather agent');
    });
  });

  describe('when the deepest crumb declares an explicit heading', () => {
    it('prefers the heading over the label', () => {
      const crumbs: CrumbDef[] = [{ id: 'agent', label: 'Weather agent', heading: 'Agent settings' }];

      expect(getRouteHeaderHeading(crumbs)).toBe('Agent settings');
    });
  });

  describe('when the deepest crumb has no usable text', () => {
    it('falls back to the next crumb up', () => {
      const crumbs: CrumbDef[] = [
        { id: 'agents', label: 'Agents' },
        { id: 'agent', label: '' },
      ];

      expect(getRouteHeaderHeading(crumbs)).toBe('Agents');
    });

    it('treats a whitespace-only label as unusable', () => {
      const crumbs: CrumbDef[] = [
        { id: 'agents', label: 'Agents' },
        { id: 'agent', label: '   ' },
      ];

      expect(getRouteHeaderHeading(crumbs)).toBe('Agents');
    });

    it('walks past several empty crumbs', () => {
      const crumbs: CrumbDef[] = [
        { id: 'root', label: 'Studio' },
        { id: 'agents', label: '' },
        { id: 'agent', label: '  ' },
      ];

      expect(getRouteHeaderHeading(crumbs)).toBe('Studio');
    });
  });

  describe('when a crumb renders a custom node', () => {
    it('uses the node when it is plain text', () => {
      const crumbs: CrumbDef[] = [{ id: 'agent', node: 'Weather agent' }];

      expect(getRouteHeaderHeading(crumbs)).toBe('Weather agent');
    });

    it('trims a padded node', () => {
      const crumbs: CrumbDef[] = [{ id: 'agent', node: '  Weather agent  ' }];

      expect(getRouteHeaderHeading(crumbs)).toBe('Weather agent');
    });

    it('ignores a node that is not plain text', () => {
      const crumbs: CrumbDef[] = [
        { id: 'agents', label: 'Agents' },
        { id: 'agent', node: { type: 'span', props: {}, key: null } as never },
      ];

      expect(getRouteHeaderHeading(crumbs)).toBe('Agents');
    });
  });

  describe('when a crumb renders a Component instead of text', () => {
    it('skips it in favour of a crumb with text', () => {
      const crumbs: CrumbDef[] = [
        { id: 'agents', label: 'Agents' },
        { id: 'agent', Component: () => null },
      ];

      expect(getRouteHeaderHeading(crumbs)).toBe('Agents');
    });

    it('uses the Component crumb heading when it declares one', () => {
      const crumbs: CrumbDef[] = [
        { id: 'agents', label: 'Agents' },
        { id: 'agent', Component: () => null, heading: 'Weather agent' },
      ];

      expect(getRouteHeaderHeading(crumbs)).toBe('Weather agent');
    });
  });

  describe('when no crumb has usable text', () => {
    it('reports no heading', () => {
      expect(getRouteHeaderHeading([{ id: 'agent', Component: () => null }])).toBeUndefined();
    });

    it('reports no heading for an empty crumb list', () => {
      expect(getRouteHeaderHeading([])).toBeUndefined();
    });
  });
});
