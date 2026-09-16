/**
 * Process composition for concrete provider adapters. The registry itself is
 * intentionally only a binding-to-port map, so runtime workers and adapters
 * can use it without creating an ESM initialization cycle.
 */
import { defaultLocalBinding, localRuntime } from "../runtime/local-provider";
import { intercomDevelopmentConfig, intercomBinding } from "./intercom/config";
import { IntercomProviderRegistry } from "./intercom/registry";
import { registerProviderRegistry } from "./registry";
import { stripeBinding, stripeSandboxConfig } from "./stripe/config";
import { StripeProviderRegistry } from "./stripe/registry";
import {
  applyModeToEnvironment,
  hasExplicitExternalMode,
  isLocalMode,
} from "../../../config/app-mode.mjs";

export function composeConfiguredProviders() {
  if (!process.env.APP_MODE?.trim()) {
    const support = process.env.SUPPORT_SOURCE?.trim().toLowerCase() ?? "mock";
    const commerce =
      process.env.COMMERCE_SOURCE?.trim().toLowerCase() ?? "mock";
    if (!["mock", "intercom"].includes(support))
      throw new Error('SUPPORT_SOURCE must be either "mock" or "intercom".');
    if (!["mock", "stripe"].includes(commerce))
      throw new Error('COMMERCE_SOURCE must be either "mock" or "stripe".');
  }
  registerProviderRegistry(localRuntime, [defaultLocalBinding()]);

  applyModeToEnvironment();
  if (isLocalMode()) return;

  const intercom = intercomDevelopmentConfig();
  if (intercom)
    registerProviderRegistry(new IntercomProviderRegistry(intercom), [
      intercomBinding(intercom, "configured"),
    ]);

  const stripe = stripeSandboxConfig();
  if (hasExplicitExternalMode() && (!intercom || !stripe))
    throw new Error(
      "External APP_MODE requires complete Intercom and Stripe configuration.",
    );
  if (stripe)
    registerProviderRegistry(new StripeProviderRegistry(stripe), [
      stripeBinding(stripe, "configured"),
    ]);
}
