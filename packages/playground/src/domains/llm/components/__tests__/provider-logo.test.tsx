import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ProviderLogo } from '../provider-logo';

afterEach(() => cleanup());

describe('ProviderLogo', () => {
  describe('when the provider is served through models.dev', () => {
    it('loads the remote logo for the cleaned provider id', () => {
      render(<ProviderLogo providerId="openai.chat" />);

      const logo = screen.getByAltText('openai.chat logo') as HTMLImageElement;
      expect(logo.getAttribute('src')).toBe('https://models.dev/logos/openai.svg');
    });

    it('flattens gateway separators in the remote logo url', () => {
      render(<ProviderLogo providerId="ACME/Custom" />);

      const logo = screen.getByAltText('ACME/Custom logo') as HTMLImageElement;
      expect(logo.getAttribute('src')).toBe('https://models.dev/logos/acme-custom.svg');
    });

    it('renders the logo at the requested size', () => {
      render(<ProviderLogo providerId="openai" size={32} />);

      const logo = screen.getByAltText('openai logo') as HTMLImageElement;
      expect(logo.getAttribute('width')).toBe('32');
      expect(logo.getAttribute('height')).toBe('32');
    });

    it('defers loading until the logo is near the viewport', () => {
      render(<ProviderLogo providerId="openai" />);

      expect(screen.getByAltText('openai logo').getAttribute('loading')).toBe('lazy');
    });
  });

  describe('when the remote logo fails to load', () => {
    it('falls back to the bundled provider icon', () => {
      const { container } = render(<ProviderLogo providerId="anthropic" />);

      fireEvent.error(screen.getByAltText('anthropic logo'));

      expect(screen.queryByAltText('anthropic logo')).toBeNull();
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });

  describe('when the provider is a gateway', () => {
    it('renders the bundled Netlify icon instead of a remote logo', () => {
      const { container } = render(<ProviderLogo providerId="netlify" />);

      expect(screen.queryByAltText('netlify logo')).toBeNull();
      expect(container.querySelector('svg')).not.toBeNull();
    });

    it('renders the bundled Mastra icon instead of a remote logo', () => {
      const { container } = render(<ProviderLogo providerId="mastra" />);

      expect(screen.queryByAltText('mastra logo')).toBeNull();
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });

  describe('when the provider has no bundled icon', () => {
    it('reserves the icon footprint with a neutral placeholder', () => {
      const { container } = render(<ProviderLogo providerId="" size={24} />);

      const placeholder = container.firstElementChild as HTMLElement;
      expect(placeholder.tagName).toBe('DIV');
      expect(container.querySelector('svg')).toBeNull();
      expect(placeholder.style.width).toBe('24px');
      expect(placeholder.style.height).toBe('24px');
      expect(placeholder.style.minWidth).toBe('24px');
      expect(placeholder.style.minHeight).toBe('24px');
    });
  });
});
