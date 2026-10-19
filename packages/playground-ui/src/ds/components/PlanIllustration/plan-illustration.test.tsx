import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlanIllustration } from './plan-illustration';
import type { PlanIllustrationPlan } from './plan-illustration';

const plans: PlanIllustrationPlan[] = ['free', 'starter', 'teams', 'enterprise'];

describe('PlanIllustration', () => {
  it.each(plans)('draws the %s plan hidden from assistive technology', plan => {
    const markup = renderToStaticMarkup(<PlanIllustration plan={plan} />);

    expect(markup).toMatch(/^<svg[^>]* aria-hidden="true"/);
    expect(markup).toContain(`data-plan="${plan}"`);
    expect(markup).toMatch(/<mask[^>]*>.*<path /);
  });

  it('gives each instance its own mask', () => {
    const markup = renderToStaticMarkup(
      <>
        <PlanIllustration plan="free" />
        <PlanIllustration plan="free" />
      </>,
    );
    const maskIds = [...markup.matchAll(/<mask id="([^"]+)"/g)].map(([, id]) => id);
    const maskRefs = [...markup.matchAll(/<rect [^>]*mask="([^"]+)"/g)].map(([, ref]) => ref);

    expect(new Set(maskIds).size).toBe(2);
    expect(maskRefs).toEqual(maskIds.map(id => `url(#${id})`));
  });
});
