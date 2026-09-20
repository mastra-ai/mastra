/**
 * BDD coverage for `IntegrationLogo`, the runtime-loaded provider brand tile.
 *
 * The invariants specs rely on:
 *  - initial paint uses thesvg.org's mono variant for most providers, or the
 *    color variant for slugs the platform aliases as color-preferred (jira,
 *    confluence, fireflies today);
 *  - `img.onerror` walks the ladder in one direction, never loops back;
 *  - when a Nango `logoUrl` arrives late (catalog resolves after the ladder
 *    has already fallen through), the component restarts and eventually
 *    surfaces the Nango-supplied brand mark — this is the reviewer-flagged
 *    race-condition fix from adversarial round.
 */

import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IntegrationLogo } from '../IntegrationLogo';

function getImg(container: HTMLElement): HTMLImageElement | null {
  return container.querySelector('img');
}

describe('IntegrationLogo', () => {
  it('starts with thesvg.org mono for a standard provider', () => {
    const { container } = render(<IntegrationLogo provider="notion" displayName="Notion" />);
    expect(getImg(container)?.src).toBe('https://thesvg.org/icons/notion/mono.svg');
  });

  it('starts with thesvg.org color for a color-preferred provider', () => {
    const { container } = render(<IntegrationLogo provider="jira" displayName="Jira" />);
    expect(getImg(container)?.src).toBe('https://thesvg.org/icons/jira/default.svg');
  });

  it('walks mono → default → fallback when no Nango URL is available', () => {
    const { container } = render(<IntegrationLogo provider="notion" displayName="Notion" />);
    const mono = getImg(container);
    if (!mono) throw new Error('expected mono image');
    fireEvent.error(mono);
    expect(getImg(container)?.src).toBe('https://thesvg.org/icons/notion/default.svg');

    const defaultImg = getImg(container);
    if (!defaultImg) throw new Error('expected default image');
    fireEvent.error(defaultImg);
    // With no logoUrl, we skip 'nango' and drop to the generic Blocks glyph.
    expect(getImg(container)).toBeNull();
  });

  it('walks mono → default → nango when a logoUrl is provided', () => {
    const { container } = render(
      <IntegrationLogo provider="notion" displayName="Notion" logoUrl="https://cdn.example/notion.svg" />,
    );
    const mono = getImg(container);
    if (!mono) throw new Error('expected mono image');
    fireEvent.error(mono);
    fireEvent.error(getImg(container)!);
    expect(getImg(container)?.src).toBe('https://cdn.example/notion.svg');
  });

  it('remaps incident-io to the incident thesvg slug', () => {
    const { container } = render(<IntegrationLogo provider="incident-io" displayName="incident.io" />);
    expect(getImg(container)?.src).toBe('https://thesvg.org/icons/incident/mono.svg');
  });

  it('surfaces the built-in Nango fallback for fireflies', () => {
    // Color-preferred → starts at default; on error, no user logoUrl passed
    // but NANGO_LOGO_URLS map supplies one, so ladder advances to nango.
    const { container } = render(<IntegrationLogo provider="fireflies" displayName="Fireflies" />);
    fireEvent.error(getImg(container)!);
    expect(getImg(container)?.src).toBe('https://app.nango.dev/images/template-logos/fireflies.svg');
  });

  it('restarts the ladder when a logoUrl arrives after the fallback has been reached', () => {
    // Simulate the "catalog resolves late" race — mount without a logoUrl,
    // walk the ladder into 'fallback', then rerender with a logoUrl. The
    // key-on-logoUrl reset must remount the ladder.
    const { container, rerender } = render(<IntegrationLogo provider="notion" displayName="Notion" />);
    fireEvent.error(getImg(container)!); // mono → default
    fireEvent.error(getImg(container)!); // default → fallback (no logoUrl)
    expect(getImg(container)).toBeNull();

    rerender(<IntegrationLogo provider="notion" displayName="Notion" logoUrl="https://cdn.example/notion.svg" />);
    // The reset places us back at the top of the ladder.
    expect(getImg(container)?.src).toBe('https://thesvg.org/icons/notion/mono.svg');
    // And the ladder can now reach the Nango URL if thesvg.org fails.
    fireEvent.error(getImg(container)!);
    fireEvent.error(getImg(container)!);
    expect(getImg(container)?.src).toBe('https://cdn.example/notion.svg');
  });
});
