/**
 * Pinned template source for the maintainer-only provider generator.
 *
 * NangoHQ/integration-templates is Elastic License 2.0. We read schemas and
 * proxy-call metadata from it at generation time and emit our own tool
 * descriptors under `packages/connect/src/providers/`; nothing from the
 * templates repo ships at runtime.
 *
 * Bump `TEMPLATE_SHA` deliberately when we want to pick up upstream updates.
 * The generator embeds the pin it used in each provider's manifest for
 * provenance, so a manifest always names the exact repository and commit its
 * tools were generated from.
 */
export interface TemplatePin {
  /** GitHub `owner/name` of the templates repository. */
  repo: string;
  /** Commit to generate from, or `main` to resolve the branch head at sync time. */
  sha: string;
}

export const TEMPLATE_REPO = 'NangoHQ/integration-templates';
export const TEMPLATE_SHA = 'bb789a55bfcf744b3c83aa9132e4ffa562106aa3';

/**
 * Providers whose templates are still under review upstream are generated
 * from the contribution branch that carries them, one pin per provider.
 * Remove an entry once its templates land in NangoHQ/integration-templates
 * and regenerate the provider from the upstream pin.
 */
export const TEMPLATE_PIN_OVERRIDES: Readonly<Record<string, TemplatePin>> = {
  // NangoHQ/integration-templates#667
  resend: {
    repo: 'rhysbalevicius/integration-templates',
    sha: '06fb7396c6b29e2126ef1ed1db7f7fe33789a39c',
  },
  // NangoHQ/integration-templates#668
  'incident-io': {
    repo: 'rhysbalevicius/integration-templates',
    sha: '0a9bc570eb7663204885b9e4f3e8dee6284ad5bd',
  },
};

/** Resolves the template pin for a provider, falling back to the shared upstream pin. */
export function templatePinFor(providerId?: string): TemplatePin {
  if (providerId !== undefined) {
    const override = Object.prototype.hasOwnProperty.call(TEMPLATE_PIN_OVERRIDES, providerId)
      ? TEMPLATE_PIN_OVERRIDES[providerId]
      : undefined;
    if (override) return override;
  }
  return { repo: TEMPLATE_REPO, sha: TEMPLATE_SHA };
}
