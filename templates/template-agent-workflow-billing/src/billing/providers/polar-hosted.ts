import { z } from 'zod';
import { BillingError } from '../contracts.js';
import type { CheckoutRequest, PortalRequest, PreparedHostedSession } from '../contracts.js';
import type { ExternalAccount } from '../driver.js';
import type { CommercialCatalog } from '../catalog.js';
import { productSchema, sessionUrlSchema } from './polar-contract.js';
import type { PolarBindings } from './polar-contract.js';
import type { PolarTransport } from './polar-transport.js';

export class PolarHosted {
  constructor(
    private readonly configuration: PolarBindings,
    private readonly catalog: CommercialCatalog,
    private readonly transport: PolarTransport,
  ) {}
  async prepareCheckout(request: CheckoutRequest, link: ExternalAccount): Promise<PreparedHostedSession> {
    const product = this.configuration.products.find(value => value.key === request.product);
    const offer = product
      ? this.catalog.offers.find(value => value.key === product.key && value.version === product.version)
      : undefined;
    if (!product || !offer || !this.configuration.returnUrls.includes(request.returnUrl))
      throw new BillingError('invalid_input');
    const returnUrl = request.returnUrl;
    const productId = product.productId;
    const { customerId } = link;
    try {
      const verifiedProduct = await this.transport.request(`/products/${productId}`, productSchema);
      if (
        verifiedProduct.id !== productId ||
        verifiedProduct.organization_id !== this.configuration.organizationId ||
        verifiedProduct.is_archived ||
        offer.entitlements.some(
          key =>
            !verifiedProduct.benefits.some(
              benefit =>
                benefit.id === this.configuration.entitlements.find(value => value.key === key)?.benefitId &&
                !benefit.is_deleted,
            ),
        )
      )
        throw new BillingError('state_unavailable');
    } catch {
      throw new BillingError('state_unavailable');
    }
    return {
      status: 'prepared',
      dispatch: async () => {
        try {
          const result = await this.transport.request(
            '/checkouts/',
            z.object({
              url: sessionUrlSchema,
              customer_id: z.uuid(),
              product_id: z.uuid(),
              return_url: z.url(),
              success_url: z.url(),
            }),
            {
              products: [productId],
              customer_id: customerId,
              success_url: returnUrl,
              return_url: returnUrl,
            },
          );
          if (
            result.customer_id !== customerId ||
            result.product_id !== productId ||
            result.return_url !== returnUrl ||
            result.success_url !== returnUrl
          )
            throw new BillingError('state_unavailable');
          return { status: 'created', url: result.url };
        } catch {
          throw new BillingError('state_unavailable');
        }
      },
    };
  }
  async preparePortalSession(request: PortalRequest, link: ExternalAccount): Promise<PreparedHostedSession> {
    if (!this.configuration.returnUrls.includes(request.returnUrl)) throw new BillingError('invalid_input');
    const returnUrl = request.returnUrl;
    const { customerId } = link;
    return {
      status: 'prepared',
      dispatch: async () => {
        try {
          const result = await this.transport.request(
            '/customer-sessions/',
            z.object({ customer_id: z.uuid(), customer_portal_url: sessionUrlSchema }),
            { customer_id: customerId, return_url: returnUrl },
          );
          if (result.customer_id !== customerId) throw new BillingError('state_unavailable');
          return { status: 'created', url: result.customer_portal_url };
        } catch {
          throw new BillingError('state_unavailable');
        }
      },
    };
  }
}
