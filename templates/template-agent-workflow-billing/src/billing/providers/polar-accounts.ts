import { z } from 'zod';
import { BillingError, parseInput, organizationProfileSchema } from '../contracts.js';
import type { ExternalAccount } from '../driver.js';
import { billingContactSchema, customerSchema } from './polar-contract.js';
import type { BillingContactResolver, PolarBindings } from './polar-contract.js';
import { PolarTransport, WireError } from './polar-transport.js';

export class PolarAccounts {
  constructor(
    private readonly configuration: PolarBindings,
    private readonly transport: PolarTransport,
    private readonly contact: BillingContactResolver,
  ) {}
  customer<T extends z.infer<typeof customerSchema>>(value: T, workspaceId: string) {
    if (
      value.external_id !== `workspace:${workspaceId}` ||
      value.organization_id !== this.configuration.organizationId ||
      value.deleted_at !== null
    )
      throw new BillingError('conflict');
    return value;
  }
  async ensureAccount(input: { workspaceId: string }): Promise<ExternalAccount> {
    const profile = parseInput(organizationProfileSchema, input);
    const path = `/customers/external/${encodeURIComponent(`workspace:${profile.workspaceId}`)}`;
    try {
      let customer;
      try {
        customer = await this.transport.request(path, customerSchema);
      } catch (error) {
        if (!(error instanceof WireError) || error.status !== 404) throw error;
        const contact = parseInput(billingContactSchema, await this.contact(profile.workspaceId));
        try {
          customer = await this.transport.request('/customers/', customerSchema, {
            ...contact,
            external_id: `workspace:${profile.workspaceId}`,
            type: 'individual',
          });
        } catch {
          // Creation has no assumed write-idempotency. Resolve the immutable
          // external ID after conflicts or lost responses, never blindly retry.
          customer = await this.transport.request(path, customerSchema);
        }
      }
      this.customer(customer, profile.workspaceId);
      return {
        customerId: customer.id,
        organizationId: customer.organization_id,
        externalReference: customer.external_id!,
      };
    } catch (error) {
      if (error instanceof BillingError && ['conflict', 'invalid_input'].includes(error.code)) throw error;
      throw new BillingError('state_unavailable');
    }
  }
}
