import { z } from 'zod';
import { BillingError, identifierSchema, parseInput } from './contracts.js';
import type { BillingProvider, HostedSession } from './contracts.js';
import type { BillingContext, OrganizationService } from './organizations.js';
import { fingerprint } from './accounting.js';
import type { BillingConfiguration } from './configuration.js';
import { CommercialStorage } from './storage/commercial.js';

const checkoutSchema = z.strictObject({ product: identifierSchema, returnUrl: z.url().max(2083) });
const portalSchema = checkoutSchema.omit({ product: true });
export class CommercialService {
  constructor(
    private readonly organizations: OrganizationService,
    private readonly storage: CommercialStorage,
    private readonly provider: BillingProvider,
    private readonly configuration: BillingConfiguration,
  ) {
    if (provider.id !== 'local' && organizations.identity.kind !== 'jwt')
      throw new BillingError('invalid_configuration');
  }
  async usage(context: BillingContext) {
    await this.organizations.authorize(context, 'manage-billing');
    const identity = await this.organizations.accountingIdentity(context);
    const account = await this.provider.ensureAccount({ workspaceId: identity.workspaceId });
    const snapshot = await this.provider.getState(account);
    await this.organizations.authorize(context, 'manage-billing');
    const allowance =
      snapshot.prepaidAuthority === 'application-ledger'
        ? await this.storage.allowance(await this.organizations.accountingIdentity(context))
        : null;
    return {
      allowance,
      mode: this.provider.id,
      authority: snapshot.prepaidAuthority ?? 'provider-reflection',
      observedAt: snapshot.observedAt,
      revision: snapshot.evidence?.version ?? null,
      meters: snapshot.meters,
    };
  }
  checkout(context: BillingContext, key: string, input: unknown) {
    return this.hosted(context, key, 'checkout', input);
  }
  portal(context: BillingContext, key: string, input: unknown) {
    return this.hosted(context, key, 'portal', input);
  }
  private async hosted(
    context: BillingContext,
    key: string,
    operation: 'checkout' | 'portal',
    input: unknown,
  ): Promise<HostedSession> {
    const parsed = operation === 'checkout' ? parseInput(checkoutSchema, input) : parseInput(portalSchema, input);
    parseInput(identifierSchema, key);
    await this.organizations.authorize(context, 'manage-billing');
    if (!this.provider.capabilities[operation]) return { status: 'unsupported', reason: 'local_mode' };
    if (
      !this.configuration.hosted.returnUrls.includes(parsed.returnUrl) ||
      ('product' in parsed && !this.configuration.catalog.offers.some(value => value.key === parsed.product))
    )
      throw new BillingError('invalid_input');
    const identity = await this.organizations.accountingIdentity(context);
    const account = await this.provider.ensureAccount({ workspaceId: identity.workspaceId });
    const current = await this.organizations.accountingIdentity(context);
    const claim = await this.storage.claim(current, operation, key, fingerprint(parsed));
    if (!claim.claimed) return { status: 'created', url: claim.url! };
    const prepared =
      operation === 'checkout'
        ? await this.provider.prepareCheckout({
            account,
            product: (parsed as z.infer<typeof checkoutSchema>).product,
            returnUrl: parsed.returnUrl,
          })
        : await this.provider.preparePortalSession({ account, returnUrl: parsed.returnUrl });
    if (prepared.status !== 'prepared') throw new BillingError('state_unavailable');
    const dispatch = await this.storage.dispatch(
      await this.organizations.accountingIdentity(context),
      operation,
      key,
      fingerprint(parsed),
    );
    if (!dispatch.claimed) return { status: 'created', url: dispatch.url! };
    const result = await prepared.dispatch();
    if (result.status !== 'created') throw new BillingError('state_unavailable');
    await this.storage.complete(current, operation, key, result.url);
    // Session URLs contain credentials. Revalidate before releasing them and
    // never include them in financial logs or execution receipts.
    await this.organizations.authorize(context, 'manage-billing');
    return result;
  }
}
