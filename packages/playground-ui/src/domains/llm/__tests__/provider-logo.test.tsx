// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProviderLogo } from '../provider-logo';

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

  it.each(['openai', 'openrouter', 'z-ai', 'moonshotai', 'x-ai', 'typesafe'])(
    'draws the %s mark in the text color',
    providerId => {
      render(<ProviderLogo providerId={providerId} />);
      const markup = screen.getByRole('img').outerHTML;
      expect(markup).toContain('currentColor');
      expect(markup).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    },
  );

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
});
