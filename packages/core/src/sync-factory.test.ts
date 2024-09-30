import { z } from 'zod';
import { getResponseDataKey, allowedKey, getEntityKey } from './sync-factory';

/**
 * Prices define the unit cost, currency, and (optional) billing cycle for both recurring and one-time purchases of products.
 * [Products](https://stripe.com/docs/api#products) help you track inventory or provisioning, and prices help you track payment terms. Different physical goods or levels of service should be represented by products, and pricing options should be represented by prices. This approach lets you change prices without having to change your provisioning scheme.
 *
 * For example, you might have a single "gold" product that has prices for $10/month, $100/year, and €9 once.
 *
 * Related guides: [Set up a subscription](https://stripe.com/docs/billing/subscriptions/set-up-subscription), [create an invoice](https://stripe.com/docs/billing/invoices/create), and more about [products and prices](https://stripe.com/docs/products-prices/overview).
 */
export type price = {
    /**
     * Whether the price can be used for new purchases.
     */
    active: boolean;
    /**
     * Describes how to compute the price per period. Either `per_unit` or `tiered`. `per_unit` indicates that the fixed amount (specified in `unit_amount` or `unit_amount_decimal`) will be charged per unit in `quantity` (for prices with `usage_type=licensed`), or per unit of total usage (for prices with `usage_type=metered`). `tiered` indicates that the unit pricing will be computed using a tiering strategy as defined using the `tiers` and `tiers_mode` attributes.
     */
    billing_scheme: 'per_unit' | 'tiered';
    /**
     * Time at which the object was created. Measured in seconds since the Unix epoch.
     */
    created: number;
    /**
     * Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).
     */
    currency: string;
    /**
     * Unique identifier for the object.
     */
    id: string;
    /**
     * Has the value `true` if the object exists in live mode or the value `false` if the object exists in test mode.
     */
    livemode: boolean;
    /**
     * A lookup key used to retrieve prices dynamically from a static string. This may be up to 200 characters.
     */
    lookup_key?: (string) | null;
    /**
     * Set of [key-value pairs](https://stripe.com/docs/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.
     */
    metadata: {
        [key: string]: (string);
    };
    /**
     * A brief description of the price, hidden from customers.
     */
    nickname?: (string) | null;
    /**
     * Only required if a [default tax behavior](https://stripe.com/docs/tax/products-prices-tax-categories-tax-behavior#setting-a-default-tax-behavior-(recommended)) was not provided in the Stripe Tax settings. Specifies whether the price is considered inclusive of taxes or exclusive of taxes. One of `inclusive`, `exclusive`, or `unspecified`. Once specified as either `inclusive` or `exclusive`, it cannot be changed.
     */
    tax_behavior?: ('exclusive' | 'inclusive' | 'unspecified') | null;
    /**
     * Defines if the tiering price should be `graduated` or `volume` based. In `volume`-based tiering, the maximum quantity within a period determines the per unit price. In `graduated` tiering, pricing can change as the quantity grows.
     */
    tiers_mode?: ('graduated' | 'volume') | null;
    /**
     * One of `one_time` or `recurring` depending on whether the price is for a one-time purchase or a recurring (subscription) purchase.
     */
    type: 'one_time' | 'recurring';
    /**
     * The unit amount in cents (or local equivalent) to be charged, represented as a whole integer if possible. Only set if `billing_scheme=per_unit`.
     */
    unit_amount?: (number) | null;
    /**
     * The unit amount in cents (or local equivalent) to be charged, represented as a decimal string with at most 12 decimal places. Only set if `billing_scheme=per_unit`.
     */
    unit_amount_decimal?: (string) | null;
};

export const priceSchema: z.ZodSchema<price> = z.lazy(() =>
    z.object({
      active: z.boolean(),
      billing_scheme: z.union([z.literal('per_unit'), z.literal('tiered')]),
      created: z.number(),
      currency: z.string(),
      id: z.string(),
      livemode: z.boolean(),
      lookup_key: z.string().optional().nullable(),
      metadata: z.record(z.string()),
      nickname: z.string().optional().nullable(),
      object: z.literal('price'),
      tax_behavior: z
        .union([z.literal('exclusive'), z.literal('inclusive'), z.literal('unspecified')])
        .optional()
        .nullable(),
      tiers_mode: z
        .union([z.literal('graduated'), z.literal('volume')])
        .optional()
        .nullable(),
      type: z.union([z.literal('one_time'), z.literal('recurring')]),
      unit_amount: z.number().optional().nullable(),
      unit_amount_decimal: z.string().optional().nullable(),
    }),
  );

type GetPricesPriceResponse = (price);

type GetPricesResponse = ({
    /**
     * Details about each object.
     */
    data: Array<price>;
    /**
     * True if this list has another page of items after this one that can be fetched.
     */
    has_more: boolean;
    /**
     * String representing the object's type. Objects of the same type share the same value. Always has the value `list`.
     */
    object: 'list';
    /**
     * The URL where this list can be accessed.
     */
    url: string;
});


const getPricesPriceResponseSchema: z.ZodSchema<GetPricesPriceResponse> = z.lazy(() => priceSchema);

const getPricesResponseSchema: z.ZodSchema<GetPricesResponse> = z.lazy(() =>
    z.object({
      data: z.array(priceSchema),
      has_more: z.boolean(),
      object: z.literal('list'),
      url: z.string(),
    }),
  );

describe('Factory', () => {
    // it('should fields for list data', () => {
    //     const key = 'getPrices'
    //     const responseSchemaKey = `${key}ResponseSchema` as keyof typeof schema;
    //     const responseSchema = (schema?.[responseSchemaKey] ?? z.object({}))
    //     getResponseDataKey({ listDataKey: `data`, responseSchema })
    // })

    it('should fields for multi data', () => {
        getResponseDataKey({ listDataKey: `data`, responseSchema: getPricesResponseSchema })
    })

    it('should fields for single data', () => {
        getResponseDataKey({ listDataKey: `data`, responseSchema: getPricesPriceResponseSchema })
    })

    it('allowedKey', () => {
        expect(allowedKey('getPrices')).toBe(true)
        expect(allowedKey('reposListForOrg')).toBe(true)
        expect(allowedKey('reposGet')).toBe(true)
        expect(allowedKey('reposUpdate')).toBe(false)
    })

    it.only('entityKey', () => {
        expect(getEntityKey('getPrices')).toBe('prices')
        expect(getEntityKey('getPricesPrice')).toBe('prices')
        expect(getEntityKey('getProducts')).toBe('products')
        expect(getEntityKey('getProductsProduct')).toBe('products')
        expect(getEntityKey('reposList')).toBe('repos')
        expect(getEntityKey('reposGet')).toBe('repos')
    })
})