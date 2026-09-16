import type {
  CommerceProvider,
  KnowledgeProvider,
  ProviderBinding,
  ProviderRegistry,
  SupportChannelProvider,
  TransactionalActionProvider,
} from "../contracts";
import { localRuntime } from "../../runtime/local-provider";
import type { IntercomDevelopmentConfig } from "./config";
import { IntercomSupportProvider } from "./support";
import { IntercomKnowledgeProvider } from "./knowledge";

/** Intercom owns only its support/knowledge ports.  The other ports are not
 * inferred from the active support provider and stay independently selected. */
export class IntercomProviderRegistry implements ProviderRegistry {
  private readonly supportProvider: IntercomSupportProvider;
  private readonly knowledgeProvider: IntercomKnowledgeProvider;
  constructor(private readonly config: IntercomDevelopmentConfig) {
    this.supportProvider = new IntercomSupportProvider(config);
    this.knowledgeProvider = new IntercomKnowledgeProvider(config);
  }
  private assert(binding: ProviderBinding) {
    if (
      binding.providerKind !== "intercom" ||
      binding.tenantId !== this.config.tenantId ||
      binding.providerAccountId !== this.config.accountId
    )
      throw new Error(
        "Intercom binding is not registered for this tenant/account.",
      );
  }
  support(binding: ProviderBinding): SupportChannelProvider {
    this.assert(binding);
    return this.supportProvider;
  }
  knowledge(binding: ProviderBinding): KnowledgeProvider {
    this.assert(binding);
    return this.knowledgeProvider;
  }
  commerce(binding: ProviderBinding): CommerceProvider {
    return localRuntime.commerce(binding);
  }
  transactions(binding: ProviderBinding): TransactionalActionProvider {
    return localRuntime.transactions(binding);
  }
}
