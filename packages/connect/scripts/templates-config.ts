/**
 * Pinned template source for the maintainer-only provider generator.
 *
 * NangoHQ/integration-templates is Elastic License 2.0. We read schemas and
 * proxy-call metadata from it at generation time and emit our own tool
 * descriptors under `packages/connect/src/providers/`; nothing from the
 * templates repo ships at runtime.
 *
 * Bump `templateSha` deliberately when we want to pick up upstream updates.
 * The generator embeds this SHA in each provider's manifest for provenance.
 */
// Temporary contribution fork while the Neon, Resend, and incident.io templates are reviewed upstream.
// Return this pin to NangoHQ after all three contributions land.
export const TEMPLATE_REPO = 'rhysbalevicius/integration-templates';
export const TEMPLATE_SHA = '15123cf72c6770906112a2131ccb0ee38dc4d064';
