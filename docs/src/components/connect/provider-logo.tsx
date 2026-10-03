const THESVG_ICONS = 'https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons'

/**
 * Inline provider logo for the @mastra/connect provider tables.
 *
 * Logos are sourced from theSVG (same source as the platform dashboard).
 * `mono` normalizes single-color marks (near-black or near-white) with
 * `brightness-0` and inverts them in dark mode, matching the card-grid
 * logo treatment. `src` overrides the theSVG URL for providers it lacks.
 */
export const ProviderLogo = ({ slug, mono = false, src }: { slug?: string; mono?: boolean; src?: string }) => (
  <img
    src={src ?? `${THESVG_ICONS}/${slug}/default.svg`}
    alt=""
    loading="lazy"
    className={`mr-1.5 inline-block h-4 w-4 object-contain align-text-bottom ${mono ? 'brightness-0 dark:invert' : ''}`}
  />
)
