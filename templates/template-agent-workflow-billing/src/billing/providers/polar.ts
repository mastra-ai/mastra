import { BillingService } from '../service.js';
import { BillingError } from '../contracts.js';
import { commercialCatalogSchema } from '../catalog.js';
import { normalizeLegacyCatalog } from './polar-catalog.js';
import { polarConfigurationSchema, polarBindingsSchema, polarCatalogConfigurationSchema } from './polar-contract.js';
import type { BillingContactResolver, PolarBindings } from './polar-contract.js';
import { PolarBillingDriver } from './polar-driver.js';
export { PolarBillingDriver, polarCapabilities } from './polar-driver.js';

// Backward-compatible application service entry point; the external Polar driver
// has no database dependencies or financial persistence responsibilities.
export class PolarBillingProvider extends BillingService {
  readonly configuration: PolarBindings;
  private constructor(service: Awaited<ReturnType<typeof BillingService.resources>>, driver: PolarBillingDriver) {
    super(service, driver.id, [driver]);
    this.configuration = driver.configuration;
  }
  static async open(options: {
    url: string;
    configuration: unknown;
    catalog?: unknown;
    token: string;
    contact: BillingContactResolver;
    webhookSecret?: string;
  }) {
    const legacy = options.catalog === undefined ? polarConfigurationSchema.safeParse(options.configuration) : null;
    const normalized = legacy?.success
      ? normalizeLegacyCatalog(legacy.data)
      : { polar: options.configuration, catalog: options.catalog };
    const parsed = polarBindingsSchema.safeParse(normalized.polar);
    const catalog = commercialCatalogSchema.safeParse(normalized.catalog);
    if (
      !parsed.success ||
      !catalog.success ||
      !polarCatalogConfigurationSchema.safeParse({ polar: parsed.data, catalog: catalog.data }).success
    )
      throw new BillingError('invalid_configuration');
    const driver = new PolarBillingDriver(
      parsed.data,
      catalog.data,
      options.token,
      options.contact,
      options.webhookSecret,
    );
    return new PolarBillingProvider(
      await BillingService.resources({ url: options.url, catalog: catalog.data, drivers: [driver] }),
      driver,
    );
  }
}
