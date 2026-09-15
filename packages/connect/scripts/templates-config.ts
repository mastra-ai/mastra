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
export const TEMPLATE_REPO = 'NangoHQ/integration-templates';
export const TEMPLATE_SHA = 'bb789a55bfcf744b3c83aa9132e4ffa562106aa3';
