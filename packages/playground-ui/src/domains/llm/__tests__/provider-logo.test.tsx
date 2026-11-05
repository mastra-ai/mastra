// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { modelsDevLogoSlugs } from '../models-dev-logo-slugs';
import { ProviderLogo } from '../provider-logo';

const bundledVendors = [
  'amazon',
  'anthropic',
  'bytedance',
  'bytedance-seed',
  'cohere',
  'deepseek',
  'fireworks',
  'google',
  'meituan',
  'meta',
  'meta-llama',
  'microsoft',
  'minimax',
  'mistralai',
  'moonshotai',
  'morph',
  'nousresearch',
  'nvidia',
  'openai',
  'openrouter',
  'perplexity',
  'qwen',
  'sakana',
  'stepfun',
  'tencent',
  'typesafe',
  'upstage',
  'x-ai',
  'z-ai',
];

const modelsDevVendors = ['inception', 'liquid', 'reflection', 'thinkingmachines', 'xiaomi'];

const monogramVendors = [
  'aion-labs',
  'anthracite-org',
  'cognitivecomputations',
  'dots-studio',
  'elorian',
  'gryphe',
  'ibm-granite',
  'inclusionai',
  'inference-net',
  'mancer',
  'moondream',
  'nex-agi',
  'particle-ai',
  'perceptron',
  'prism-ml',
  'recursive',
  'rekaai',
  'relace',
  'ricursiveai',
  'sao10k',
  'scaledown',
  'stealth',
  'thedrummer',
  'unbiased',
  'undi95',
  'writer',
  'xingchen-agi',
];

const modelsDevPlaceholderSlugs = ['inflection', 'nous', 'github-models', 'zzz-not-a-real-provider-123'];

describe('ProviderLogo', () => {
  afterEach(cleanup);

  it.each([
    'anthropic',
    'anthropic.messages',
    '~anthropic',
    'google',
    'deepseek',
    'openai.responses',
    'openrouter',
    'qwen',
    'mistral',
    'mistralai',
    'zai',
    'z-ai',
    'nvidia',
    'minimax',
    'meta',
    'meta-llama',
    'moonshotai',
    'xai',
    'x-ai',
    'typesafe',
    'tencent',
    'bytedance',
    'bytedance-seed',
    'sakana',
    'microsoft',
  ])('draws the bundled %s mark without fetching a remote logo', providerId => {
    render(<ProviderLogo providerId={providerId} size="md" />);
    const mark = screen.getByRole('img', { name: `${providerId} logo` });
    expect(mark.tagName.toLowerCase()).toBe('svg');
    expect(document.querySelector('img')).toBeNull();
  });

  it('keeps the Claude spark in its brand color', () => {
    render(<ProviderLogo providerId="anthropic" />);
    const fills = [...screen.getByRole('img').querySelectorAll('path')].map(path => path.getAttribute('fill'));
    expect(fills).toEqual(['#D97757']);
  });

  it.each(['openai', 'openrouter', 'z-ai', 'moonshotai', 'x-ai'])('draws the %s mark in the text color', providerId => {
    render(<ProviderLogo providerId={providerId} />);
    const markup = screen.getByRole('img').outerHTML;
    expect(markup).toContain('currentColor');
    expect(markup).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('draws the Typesafe mark in its brand magenta', () => {
    render(<ProviderLogo providerId="typesafe" />);
    expect(screen.getByRole('img').getAttribute('fill')).toBe('#E551BA');
  });

  it.each(['google', 'qwen', 'minimax', 'meta'])('gives each %s mark its own gradient ids', providerId => {
    render(
      <>
        <ProviderLogo providerId={providerId} />
        <ProviderLogo providerId={providerId} />
      </>,
    );
    const ids = [...document.querySelectorAll('linearGradient')].map(gradient => gradient.id);
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
    for (const element of document.querySelectorAll('[fill^="url("]')) {
      expect(ids).toContain(element.getAttribute('fill')?.match(/url\(#(.+)\)/)?.[1]);
    }
  });

  it('loads other providers from models.dev', () => {
    render(<ProviderLogo providerId="cerebras.chat" />);
    expect(screen.getByRole('img', { name: 'cerebras.chat logo' }).getAttribute('src')).toBe(
      'https://models.dev/logos/cerebras.svg',
    );
  });

  it.each([
    ['anthropic', 'svg'],
    ['cerebras', 'img'],
  ])('sizes the %s logo from an icon size token', (providerId, tag) => {
    render(<ProviderLogo providerId={providerId} size="sm" />);
    const logo = screen.getByRole('img');
    expect(logo.tagName.toLowerCase()).toBe(tag);
    expect(logo.getAttribute('class')).toContain('size-icon-sm');
    expect(logo.style.width).toBe('');
  });

  it.each([
    ['anthropic', 'svg'],
    ['mistral', 'svg'],
    ['cerebras', 'img'],
  ])('sizes the %s logo from a pixel number', (providerId, tag) => {
    render(<ProviderLogo providerId={providerId} size={32} />);
    const logo = screen.getByRole('img');
    expect(logo.tagName.toLowerCase()).toBe(tag);
    expect(logo.style.width).toBe('32px');
    expect(logo.style.height).toBe('32px');
    expect(logo.getAttribute('class')).not.toContain('size-icon');
  });

  it('applies a pixel size to the gateway fallback icon', () => {
    render(<ProviderLogo providerId="mastra" size={32} />);
    const icon = document.querySelector<HTMLElement>('[data-slot="icon"]');
    expect(icon?.style.width).toBe('32px');
    expect(icon?.style.height).toBe('32px');
  });

  it.each([
    'tencent',
    'bytedance',
    'sakana',
    'microsoft',
    'amazon',
    'cohere',
    'perplexity',
    'fireworks',
    'stepfun',
    'meituan',
    'upstage',
    'morph',
  ])('draws the %s mark in its brand colors', providerId => {
    render(<ProviderLogo providerId={providerId} />);
    const markup = screen.getByRole('img').outerHTML;
    expect(markup).toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(markup).not.toContain('currentColor');
  });

  it.each(['amazon', 'stepfun', 'upstage'])('gives each %s mark its own gradient id', providerId => {
    render(
      <>
        <ProviderLogo providerId={providerId} />
        <ProviderLogo providerId={providerId} />
      </>,
    );
    const ids = [...document.querySelectorAll('linearGradient')].map(gradient => gradient.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const element of document.querySelectorAll('[fill^="url("]')) {
      expect(ids).toContain(element.getAttribute('fill')?.match(/url\(#(.+)\)/)?.[1]);
    }
  });

  it.each(bundledVendors)('draws a bundled mark for %s without a monogram or a remote logo', providerId => {
    render(<ProviderLogo providerId={providerId} />);
    const mark = screen.getByRole('img', { name: `${providerId} logo` });
    expect(mark.tagName.toLowerCase()).toBe('svg');
    expect(mark.dataset.slot).not.toBe('provider-monogram');
    expect(document.querySelector('img')).toBeNull();
  });

  it.each(modelsDevVendors)('loads the %s logo from models.dev under its own name', providerId => {
    render(<ProviderLogo providerId={providerId} />);
    expect(screen.getByRole('img', { name: `${providerId} logo` }).getAttribute('src')).toBe(
      `https://models.dev/logos/${providerId}.svg`,
    );
  });

  it.each(monogramVendors)('draws the %s monogram instead of requesting a logo', providerId => {
    render(<ProviderLogo providerId={providerId} />);
    const monogram = screen.getByRole('img', { name: `${providerId} logo` });
    expect(monogram.dataset.slot).toBe('provider-monogram');
    expect(monogram.textContent).toBe(providerId.charAt(0).toUpperCase());
    expect(document.querySelector('img')).toBeNull();
  });

  it.each(modelsDevPlaceholderSlugs)(
    'never requests %s, which models.dev answers with its generic placeholder',
    providerId => {
      render(<ProviderLogo providerId={providerId} />);
      expect(document.querySelector('img')).toBeNull();
      expect(screen.getByRole('img').dataset.slot).toBe('provider-monogram');
    },
  );

  it('keeps placeholder slugs out of the verified models.dev list', () => {
    for (const slug of [...modelsDevPlaceholderSlugs, 'netlify']) {
      expect(modelsDevLogoSlugs.has(slug)).toBe(false);
    }
  });

  it.each(modelsDevVendors)('lists the %s logo as a verified models.dev slug', slug => {
    expect(modelsDevLogoSlugs.has(slug)).toBe(true);
  });

  it('uses the first letter after a leading tilde for the monogram', () => {
    render(<ProviderLogo providerId="~stealth" />);
    expect(screen.getByRole('img', { name: '~stealth logo' }).textContent).toBe('S');
  });

  it('sizes the monogram from an icon size token', () => {
    render(<ProviderLogo providerId="aion-labs" size="xs" />);
    const monogram = screen.getByRole('img');
    expect(monogram.getAttribute('class')).toContain('size-icon-xs');
    expect(monogram.style.width).toBe('');
  });

  it('sizes the monogram from a pixel number', () => {
    render(<ProviderLogo providerId="aion-labs" size={13} />);
    const monogram = screen.getByRole('img');
    expect(monogram.style.width).toBe('13px');
    expect(monogram.style.height).toBe('13px');
    expect(monogram.getAttribute('class')).not.toContain('size-icon');
  });

  it('passes className and style through to the monogram', () => {
    render(<ProviderLogo providerId="aion-labs" className="ml-2" style={{ marginTop: 4 }} />);
    const monogram = screen.getByRole('img');
    expect(monogram.getAttribute('class')).toContain('ml-2');
    expect(monogram.style.marginTop).toBe('4px');
  });

  it('draws an empty, hidden tile when there is no provider', () => {
    render(<ProviderLogo providerId="" />);
    expect(screen.queryByRole('img')).toBeNull();
    const tile = document.querySelector('svg');
    expect(tile?.getAttribute('aria-hidden')).toBe('true');
    expect(tile?.textContent).toBe('');
    expect(document.querySelector('img')).toBeNull();
  });

  it('requests a models.dev logo whose slug contains a dot', () => {
    render(<ProviderLogo providerId="wafer.ai" />);
    expect(screen.getByRole('img', { name: 'wafer.ai logo' }).getAttribute('src')).toBe(
      'https://models.dev/logos/wafer.ai.svg',
    );
  });

  it('still strips an api qualifier from a provider without a dotted logo', () => {
    render(<ProviderLogo providerId="cerebras.chat" />);
    expect(screen.getByRole('img').getAttribute('src')).toBe('https://models.dev/logos/cerebras.svg');
  });

  it('shows the monogram when a models.dev logo fails to load', () => {
    render(<ProviderLogo providerId="cerebras" />);
    fireEvent.error(screen.getByRole('img', { name: 'cerebras logo' }));
    const monogram = screen.getByRole('img', { name: 'cerebras logo' });
    expect(monogram.tagName.toLowerCase()).toBe('svg');
    expect(monogram.textContent).toBe('C');
  });

  it('shows the local Groq icon when its models.dev logo fails to load', () => {
    render(<ProviderLogo providerId="groq" />);
    fireEvent.error(screen.getByRole('img', { name: 'groq logo' }));
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('[data-slot="icon"] svg')).not.toBeNull();
  });

  it('tries the next provider logo after a previous one failed', () => {
    const { rerender } = render(<ProviderLogo providerId="cerebras" />);
    fireEvent.error(screen.getByRole('img'));
    rerender(<ProviderLogo providerId="inception" />);
    expect(screen.getByRole('img').getAttribute('src')).toBe('https://models.dev/logos/inception.svg');
  });

  it.each(['netlify', 'mastra'])('draws the %s gateway icon without requesting a logo', providerId => {
    render(<ProviderLogo providerId={providerId} />);
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('[data-slot="icon"] svg')).not.toBeNull();
  });
});
