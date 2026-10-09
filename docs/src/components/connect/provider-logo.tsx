const SIMPLE_ICONS = 'https://cdn.simpleicons.org'

/**
 * Inline provider logo for the @mastra/connect provider tables.
 *
 * Logos come from the same sources as the integrations sidebar
 * (docs/src/content/en/integrations/sidebars.js): Simple Icons by `slug`,
 * with `src` overriding the URL for marks Simple Icons lacks (svgl.app,
 * or the platform catalog for providers missing from both). `mono`
 * normalizes single-color marks with `brightness-0` and inverts them in
 * dark mode, matching the sidebar's black/white icon treatment.
 */
export const ProviderLogo = ({ slug, mono = false, src }: { slug?: string; mono?: boolean; src?: string }) => (
  <img
    src={src ?? `${SIMPLE_ICONS}/${slug}?viewbox=auto&size=28`}
    alt=""
    loading="lazy"
    className={`mr-1.5 inline-block h-4 w-4 object-contain align-text-bottom ${mono ? 'brightness-0 dark:invert' : ''}`}
  />
)
