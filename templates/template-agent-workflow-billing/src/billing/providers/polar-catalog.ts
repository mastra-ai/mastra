import { createHash } from 'node:crypto';
import { offerSchema } from '../catalog.js';
import type { CommercialCatalog } from '../catalog.js';
import type { PolarConfiguration, PolarBindings } from './polar-contract.js';

// The compatibility boundary is the only place provider identifiers name logical
// revisions. Existing callers need no plan rewrite; explicit catalogs can retain
// these keys while replacing all external bindings.
export function normalizeLegacyCatalog(polar: PolarConfiguration): {
  catalog: CommercialCatalog;
  polar: PolarBindings;
} {
  const allowances = polar.grants.map(grant => ({
    key: `legacy-${createHash('sha256')
      .update(JSON.stringify([grant.productId, grant.benefitId]))
      .digest('hex')}`,
    version: grant.version,
    meter: grant.meter,
    kind: grant.kind,
    units: grant.units,
    expiry: grant.expiry,
  }));
  const offers = polar.products.map(product => {
    const offer = offerSchema.parse({
      key: product.key,
      version: 'legacy',
      allowances: polar.grants.flatMap((grant, index) =>
        grant.productId === product.productId
          ? [{ key: allowances[index].key, version: allowances[index].version }]
          : [],
      ),
      entitlements: polar.entitlements
        .filter(value =>
          polar.grants.some(grant => grant.productId === product.productId && grant.benefitId === value.benefitId),
        )
        .map(value => value.key),
      subscriptions: polar.subscriptions.filter(value => value.productId === product.productId).map(value => value.key),
    });
    return { ...offer, version: `legacy-${createHash('sha256').update(JSON.stringify(offer)).digest('hex')}` };
  });
  return {
    catalog: { allowances, offers },
    polar: {
      ...polar,
      grants: polar.grants.map((grant, index) => ({
        allowance: { key: allowances[index].key, version: allowances[index].version },
        productId: grant.productId,
        priceId: grant.priceId,
        benefitId: grant.benefitId,
        meterId: grant.meterId,
      })),
      products: polar.products.map((product, index) => ({ ...product, version: offers[index].version })),
    },
  };
}
