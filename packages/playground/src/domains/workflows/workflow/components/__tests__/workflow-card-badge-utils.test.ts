import { describe, expect, it } from 'vitest';

import {
  BADGE_COLORS,
  BADGE_ICONS,
  getConditionIconAndColor,
  getConditionIndicator,
  getNodeBadgeInfo,
  getNodeIndicators,
  getWorkflowCardAccentColor,
} from '../workflow-card-badge-utils';

describe('the badge palette', () => {
  it('gives every badge kind its own colour, so two badges are never confusable', () => {
    const colors = Object.values(BADGE_COLORS);

    expect(colors.length).toBeGreaterThan(0);
    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('registers an icon for every kind that has a colour', () => {
    for (const kind of Object.keys(BADGE_COLORS)) {
      expect(BADGE_ICONS[kind as keyof typeof BADGE_ICONS]).toBeDefined();
    }
  });

  it('has a dedicated icon for a sleep-until step, distinct from a plain sleep', () => {
    expect(BADGE_ICONS.sleepUntil).toBeDefined();
    expect(BADGE_ICONS.sleepUntil).not.toBe(BADGE_ICONS.sleep);
  });
});

describe('getConditionIconAndColor', () => {
  describe('when the type is a control-flow condition', () => {
    it.each(['when', 'dountil', 'dowhile', 'until', 'while', 'if', 'else'] as const)(
      'resolves %s to its own icon and colour',
      type => {
        const { icon, color } = getConditionIconAndColor(type);

        expect(icon).toBe(BADGE_ICONS[type]);
        expect(color).toBe(BADGE_COLORS[type]);
      },
    );

    it('keeps if and else visually apart', () => {
      expect(getConditionIconAndColor('if').icon).not.toBe(getConditionIconAndColor('else').icon);
      expect(getConditionIconAndColor('if').color).not.toBe(getConditionIconAndColor('else').color);
    });
  });

  describe('when the type is a boolean combinator', () => {
    it.each(['and', 'or', 'not'] as const)('renders %s with the generic condition badge', type => {
      expect(getConditionIconAndColor(type)).toEqual({ icon: BADGE_ICONS.when, color: BADGE_COLORS.when });
    });
  });

  describe('when the type is unknown or missing', () => {
    it('resolves nothing for an unrecognised type', () => {
      expect(getConditionIconAndColor('nope')).toEqual({ icon: undefined, color: undefined });
    });

    it('resolves nothing when no type is given', () => {
      expect(getConditionIconAndColor()).toEqual({ icon: undefined, color: undefined });
    });
  });
});

describe('getConditionIndicator', () => {
  it('labels a known condition in prose', () => {
    expect(getConditionIndicator('dowhile')).toEqual({
      id: 'condition-dowhile',
      label: 'Do while condition',
      icon: BADGE_ICONS.dowhile,
      color: BADGE_COLORS.dowhile,
    });
  });

  it.each([
    ['when', 'When condition'],
    ['dountil', 'Do until condition'],
    ['until', 'Until condition'],
    ['while', 'While condition'],
    ['if', 'If condition'],
    ['else', 'Else condition'],
    ['and', 'And condition'],
    ['or', 'Or condition'],
    ['not', 'Not condition'],
  ])('spells out %s as "%s"', (type, label) => {
    expect(getConditionIndicator(type)?.label).toBe(label);
  });

  it('namespaces the id by condition so two badges never collide', () => {
    expect(getConditionIndicator('or')?.id).toBe('condition-or');
    expect(getConditionIndicator('and')?.id).not.toBe(getConditionIndicator('or')?.id);
  });

  describe('when the condition cannot be rendered', () => {
    it('returns nothing for an unknown type', () => {
      expect(getConditionIndicator('mystery')).toBeUndefined();
    });

    it('returns nothing when no type is given', () => {
      expect(getConditionIndicator()).toBeUndefined();
    });

    it('returns nothing for an empty type', () => {
      expect(getConditionIndicator('')).toBeUndefined();
    });
  });
});

describe('getNodeBadgeInfo', () => {
  it('reports a bare step as carrying no special badge', () => {
    expect(getNodeBadgeInfo({})).toEqual({
      isSleepNode: false,
      isForEachNode: false,
      isMapNode: false,
      isNestedWorkflow: false,
      hasSpecialBadge: false,
    });
  });

  describe('when the step sleeps', () => {
    it('counts a duration as a sleep', () => {
      expect(getNodeBadgeInfo({ duration: 500 })).toMatchObject({ isSleepNode: true, hasSpecialBadge: true });
    });

    it('counts a wake-up date as a sleep', () => {
      expect(getNodeBadgeInfo({ date: new Date('2024-01-01') })).toMatchObject({
        isSleepNode: true,
        hasSpecialBadge: true,
      });
    });

    it('does not count a zero duration as a sleep', () => {
      expect(getNodeBadgeInfo({ duration: 0 })).toMatchObject({ isSleepNode: false, hasSpecialBadge: false });
    });
  });

  describe('when the step maps or iterates', () => {
    it('treats a foreach step as an iteration', () => {
      expect(getNodeBadgeInfo({ isForEach: true })).toMatchObject({ isForEachNode: true, isMapNode: false });
    });

    it('treats a map config on its own as a map', () => {
      expect(getNodeBadgeInfo({ mapConfig: '{}' })).toMatchObject({ isMapNode: true, isForEachNode: false });
    });

    it('lets foreach win when a step is both, so the badge is not doubled', () => {
      expect(getNodeBadgeInfo({ mapConfig: '{}', isForEach: true })).toMatchObject({
        isForEachNode: true,
        isMapNode: false,
      });
    });

    it('ignores an empty map config', () => {
      expect(getNodeBadgeInfo({ mapConfig: '' })).toMatchObject({ isMapNode: false, hasSpecialBadge: false });
    });
  });

  it('treats a step that carries a step graph as a nested workflow', () => {
    expect(getNodeBadgeInfo({ stepGraph: { steps: [] } })).toMatchObject({
      isNestedWorkflow: true,
      hasSpecialBadge: true,
    });
  });

  it.each([
    ['a suspendable step', { canSuspend: true }],
    ['a parallel step', { isParallel: true }],
  ])('flags %s as special even though it gets no boolean of its own', (_label, props) => {
    expect(getNodeBadgeInfo(props)).toMatchObject({
      isSleepNode: false,
      isForEachNode: false,
      isMapNode: false,
      isNestedWorkflow: false,
      hasSpecialBadge: true,
    });
  });
});

describe('getNodeIndicators', () => {
  it('lists nothing for a bare step', () => {
    expect(getNodeIndicators({})).toEqual([]);
  });

  describe('when the step sleeps', () => {
    it('shows a plain sleep badge for a duration', () => {
      expect(getNodeIndicators({ duration: 100 })).toEqual([
        { id: 'sleep', label: 'Sleep step', icon: BADGE_ICONS.sleep, color: BADGE_COLORS.sleep },
      ]);
    });

    it('shows a sleep-until badge when a wake-up date is set', () => {
      expect(getNodeIndicators({ date: new Date('2024-01-01') })).toEqual([
        { id: 'sleep-until', label: 'Sleep until step', icon: BADGE_ICONS.sleepUntil, color: BADGE_COLORS.sleep },
      ]);
    });

    it('prefers the date badge when a step carries both', () => {
      expect(getNodeIndicators({ duration: 100, date: new Date('2024-01-01') })[0]?.id).toBe('sleep-until');
    });
  });

  it.each([
    ['suspend', { canSuspend: true }, 'Suspend/resume step', BADGE_ICONS.suspend, BADGE_COLORS.suspend],
    ['parallel', { isParallel: true }, 'Parallel step', BADGE_ICONS.parallel, BADGE_COLORS.parallel],
    ['workflow', { stepGraph: {} }, 'Nested workflow step', BADGE_ICONS.workflow, BADGE_COLORS.workflow],
    ['foreach', { isForEach: true }, 'Foreach step', BADGE_ICONS.forEach, BADGE_COLORS.forEach],
    ['map', { mapConfig: '{}' }, 'Map step', BADGE_ICONS.map, BADGE_COLORS.map],
  ])('describes a %s step', (id, props, label, icon, color) => {
    expect(getNodeIndicators(props)).toEqual([{ id, label, icon, color }]);
  });

  it('orders every badge a single step can carry from sleep down to map', () => {
    const indicators = getNodeIndicators({
      duration: 100,
      canSuspend: true,
      isParallel: true,
      stepGraph: {},
      mapConfig: '{}',
    });

    expect(indicators.map(indicator => indicator.id)).toEqual(['sleep', 'suspend', 'parallel', 'workflow', 'map']);
  });

  it('drops the map badge when the same step also iterates', () => {
    const indicators = getNodeIndicators({ mapConfig: '{}', isForEach: true });

    expect(indicators.map(indicator => indicator.id)).toEqual(['foreach']);
  });
});

describe('getWorkflowCardAccentColor', () => {
  it('takes the accent from the first badge on the card', () => {
    const indicators = getNodeIndicators({ duration: 100, canSuspend: true });

    expect(getWorkflowCardAccentColor(indicators)).toBe(BADGE_COLORS.sleep);
  });

  it('leaves a card with no badges unaccented', () => {
    expect(getWorkflowCardAccentColor([])).toBeUndefined();
  });
});
