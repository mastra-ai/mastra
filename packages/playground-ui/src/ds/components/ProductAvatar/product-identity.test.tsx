import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProductBadge } from '../ProductBadge/ProductBadge';
import type { Product } from './product-identity';
import { ProductAvatar } from './ProductAvatar';

const products: [Product, string][] = [
  ['studio', 'Studio'],
  ['server', 'Server'],
  ['observability', 'Observability'],
  ['factory', 'Factory'],
  ['workers', 'Workers'],
  ['persistent-server', 'Persistent Server'],
];

describe('product identity', () => {
  it.each(products)('gives the %s avatar an accessible name and a decorative icon', (product, label) => {
    const html = renderToStaticMarkup(<ProductAvatar product={product} />);
    expect(html).toContain('role="img"');
    expect(html).toContain(`aria-label="${label}"`);
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html).toContain('<path');
  });

  it.each(products)('labels the %s badge without repeating the icon name', (product, label) => {
    const html = renderToStaticMarkup(<ProductBadge product={product} />);
    expect(html).toContain(`${label}</span>`);
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html).not.toContain('aria-label=');
  });
});
