/**
 * Brand-logo tile for a third-party integration.
 *
 * The logo is loaded from a remote source ladder — no SVG assets ship in the
 * bundle. This mirrors the platform frontend's `IntegrationLogo`, which is
 * the source of truth for how Mastra sources integration brand marks:
 *
 *   1. `thesvg.org/icons/<slug>/mono.svg`     — clean single-color mark
 *   2. `thesvg.org/icons/<slug>/default.svg`  — brand-color mark
 *   3. Nango's `logoUrl`                       — vendor-supplied fallback
 *   4. Generic `Blocks` glyph                  — final fallback
 *
 * The `<img>` element's `onError` walks the ladder step by step whenever a
 * source 404s or fails to decode. Since URLs are remote, a runtime network
 * outage means the browser will render the platform's own generic fallback,
 * not a broken image icon.
 *
 * Color-preferred and tinted slugs come straight from the platform pattern —
 * these brands look wrong in the mono variant, so we skip straight to the
 * color asset (and optionally tint it with `brightness-0 dark:invert` for
 * brands that ship a flat single-color mark).
 */

import { useState } from 'react';
import { Blocks } from 'lucide-react';

import { cn } from '@mastra/playground-ui/utils/cn';

type LogoSource = 'thesvg-mono' | 'thesvg-default' | 'nango' | 'fallback';

/**
 * Slug remaps for providers whose Platform id differs from their brand slug.
 * Keeps the mapping local — the settings section's provider slug is the SPA
 * connect slug (`incident-io`), which needs to remap to `incident` for the
 * thesvg.org lookup.
 */
const PROVIDER_SLUG_ALIASES: Record<string, string> = {
  'incident-io': 'incident',
};

/** Slugs whose brand marks are only readable in the color variant. */
const COLOR_PREFERRED_SLUGS = new Set(['jira', 'confluence', 'fireflies']);

/** Slugs whose color mark is a flat single color — we tint it for contrast. */
const TINTED_DEFAULT_SLUGS = new Set<string>([]);

/**
 * Fallback Nango template-logo URLs for brands that thesvg.org lacks _and_
 * whose Platform catalog entry doesn't ship a `logoUrl`. Populated per-slug
 * — the runtime chain prefers a catalog-supplied `logoUrl` before falling
 * back to this map, so entries here are effectively "last-resort" URLs kept
 * in the SPA until Nango publishes a matching template through the catalog.
 */
const NANGO_LOGO_URLS: Record<string, string> = {
  fireflies: 'https://app.nango.dev/images/template-logos/fireflies.svg',
};

export interface IntegrationLogoProps {
  /**
   * Provider slug — the SPA-facing connect slug (e.g. `notion`, `jira`,
   * `incident-io`). We normalize it internally and follow the ladder from
   * thesvg.org before falling back to Nango.
   */
  provider: string;
  /**
   * Optional Nango-supplied logo URL. Populated when the server surfaces the
   * Nango catalog entry alongside a connection; today this is only wired for
   * brands in `NANGO_LOGO_URLS` above, but the component is ready to
   * consume real per-connection data when the platform route is extended.
   */
  logoUrl?: string;
  /**
   * Accessible label. Passed on the wrapping element (the `<img>` alt is
   * empty on purpose — the wrapper carries the semantics).
   */
  displayName: string;
  /**
   * Optional additional classes on the wrapping `<span>`. Defaults to a
   * `size-9` tile with subtle background — matches the settings-card badge.
   */
  className?: string;
}

/**
 * Renders a logo tile that walks the fallback ladder described above.
 * Remounts (via `key={slug}`) when the provider slug changes so the source
 * state resets from the top of the ladder.
 */
export function IntegrationLogo({ provider, logoUrl, displayName, className }: IntegrationLogoProps) {
  const normalized = provider.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const slug = PROVIDER_SLUG_ALIASES[normalized] ?? normalized;
  const nangoUrl = logoUrl ?? NANGO_LOGO_URLS[slug];
  // Reset ladder state when the Nango URL arrives late — otherwise a provider
  // whose thesvg.org URLs 404 before the catalog query resolves would lock at
  // the generic-glyph fallback and never surface the real brand logo when the
  // catalog eventually resolves with a real `logoUrl`. Keying on both slug
  // and the presence of a Nango URL restarts the ladder for the transition.
  return (
    <RemoteLogo
      key={`${slug}:${nangoUrl ?? ''}`}
      slug={slug}
      logoUrl={nangoUrl}
      displayName={displayName}
      className={className}
    />
  );
}

function RemoteLogo({
  slug,
  logoUrl,
  displayName,
  className,
}: {
  slug: string;
  logoUrl?: string;
  displayName: string;
  className?: string;
}) {
  const [source, setSource] = useState<LogoSource>(
    COLOR_PREFERRED_SLUGS.has(slug) || TINTED_DEFAULT_SLUGS.has(slug) ? 'thesvg-default' : 'thesvg-mono',
  );

  const sourceUrl =
    source === 'thesvg-mono'
      ? `https://thesvg.org/icons/${slug}/mono.svg`
      : source === 'thesvg-default'
        ? `https://thesvg.org/icons/${slug}/default.svg`
        : source === 'nango'
          ? logoUrl
          : undefined;

  function handleError() {
    if (source === 'thesvg-mono') {
      setSource('thesvg-default');
      return;
    }
    setSource(source === 'thesvg-default' && logoUrl ? 'nango' : 'fallback');
  }

  const wrapperClass = cn('grid size-9 shrink-0 place-items-center rounded-md bg-surface3 p-1.5', className);

  if (!sourceUrl) {
    return (
      <span aria-label={displayName} className={wrapperClass}>
        <Blocks aria-hidden="true" className="size-4 text-icon3" />
      </span>
    );
  }

  return (
    <span aria-label={displayName} className={wrapperClass}>
      <img
        src={sourceUrl}
        alt=""
        className={cn(
          'size-full object-contain',
          (source === 'thesvg-mono' || (source === 'thesvg-default' && TINTED_DEFAULT_SLUGS.has(slug))) &&
            'brightness-0 dark:invert',
        )}
        onError={handleError}
      />
    </span>
  );
}
