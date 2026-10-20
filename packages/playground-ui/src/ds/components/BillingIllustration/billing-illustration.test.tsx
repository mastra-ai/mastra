import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BillingIllustration } from './billing-illustration';
import type { BillingIllustrationName } from './billing-illustration';

const projectSizes: BillingIllustrationName[] = ['serverless', 'small', 'medium', 'large'];

const draw = (name: BillingIllustrationName) => renderToStaticMarkup(<BillingIllustration name={name} />);

describe('BillingIllustration', () => {
  it.each(projectSizes)('draws %s hidden from assistive technology', name => {
    const markup = draw(name);

    expect(markup).toMatch(/^<svg[^>]* aria-hidden="true"/);
    expect(markup).toContain(`data-illustration="${name}"`);
    expect(markup).toMatch(/<mask[^>]*><g[^>]*><path /);
  });

  it('shows a project size through the number of server units on the plate', () => {
    const solids = (name: BillingIllustrationName) => draw(name).match(/fill="black"/g)?.length;

    expect(projectSizes.map(solids)).toEqual([2, 2, 3, 5]);
  });

  it('dashes only the serverless outlines and keeps its light solid', () => {
    const dashedNames = projectSizes.filter(name => draw(name).includes('stroke-dasharray'));
    const serverlessLight = draw('serverless').match(/<path [^>]*fill="white"[^>]*>/)?.[0];

    expect(dashedNames).toEqual(['serverless']);
    expect(serverlessLight).not.toContain('stroke-dasharray');
  });

  it('keeps one light on at rest and leaves the other units idle until hover', () => {
    const lights = (name: BillingIllustrationName) => ({
      units: draw(name).match(/transition-\[translate\]/g)?.length,
      idle: draw(name).match(/\[fill-opacity:0\]/g)?.length ?? 0,
    });

    expect(projectSizes.map(lights)).toEqual([
      { units: 1, idle: 0 },
      { units: 1, idle: 0 },
      { units: 2, idle: 1 },
      { units: 4, idle: 3 },
    ]);
  });

  it('turns idle lights on one after another, in drawing order', () => {
    const delays = [...draw('large').matchAll(/\[fill-opacity:0\][^>]*style="transition-delay:(\d+)ms"/g)].map(
      ([, ms]) => ms,
    );

    expect(delays).toEqual(['0', '50', '100']);
  });

  it('powers on for keyboard focus inside the hover group, as it does for hover', () => {
    const markup = draw('serverless') + draw('large');

    expect(markup).toContain('group-focus-within/billing-illustration:[fill-opacity:1]');
    expect(markup).toContain('group-focus-within/billing-illustration:[stroke-dasharray:1.5_0]');
    expect(markup).toContain('group-focus-within/billing-illustration:[translate:0_-3px]');
  });

  it('draws the credits coin stacks with one coin that drops in on hover or focus', () => {
    const markup = draw('credits');
    const [, classes = '', coin = ''] =
      markup.match(/<g class="([^"]*opacity-0[^"]*)"[^>]*>((?:(?!<\/g>).)*)<\/g>/) ?? [];
    const translates = classes.split(' ').filter(name => name.includes('translate'));

    expect(markup).toMatch(/^<svg[^>]* aria-hidden="true"/);
    expect(markup).toContain('data-illustration="credits"');
    expect(coin.match(/<path /g)).toHaveLength(2);
    expect(classes).toContain('group-hover/billing-illustration:opacity-100');
    expect(classes).toContain('group-focus-within/billing-illustration:opacity-100');
    expect(translates.length).toBeGreaterThan(0);
    expect(translates.every(name => name.startsWith('motion-safe:'))).toBe(true);
  });

  it('gives every instance its own mask so a table of projects draws each thumbnail', () => {
    const markup = renderToStaticMarkup(
      <>
        <BillingIllustration name="small" />
        <BillingIllustration name="small" />
      </>,
    );
    const maskIds = [...markup.matchAll(/<mask id="([^"]+)"/g)].map(([, id]) => id);
    const maskRefs = [...markup.matchAll(/<rect [^>]*mask="([^"]+)"/g)].map(([, ref]) => ref);

    expect(new Set(maskIds).size).toBe(2);
    expect(maskRefs).toEqual(maskIds.map(id => `url(#${id})`));
  });
});
