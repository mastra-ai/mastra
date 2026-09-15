import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioConfigForm } from '../components/studio-config-form';
import { StudioConfigContext } from '../context/studio-config-state';
import type { StudioConfigContextType } from '../context/studio-config-state';
import type { StudioConfig } from '../types';

const customConfig: StudioConfig = {
  baseUrl: 'http://localhost:4111',
  headers: { Authorization: 'Bearer test' },
  apiPrefix: '/mastra',
};

function renderWithConfig(ui: ReactElement, setConfig = vi.fn<StudioConfigContextType['setConfig']>()) {
  return render(
    <StudioConfigContext.Provider value={{ ...customConfig, isLoading: false, setConfig }}>
      {ui}
    </StudioConfigContext.Provider>,
  );
}

afterEach(cleanup);

describe.each(['default', 'factory'] as const)('StudioConfigForm (%s)', variant => {
  describe('when the connection uses a custom API prefix', () => {
    it('displays the saved prefix', () => {
      renderWithConfig(<StudioConfigForm variant={variant} initialConfig={customConfig} />);

      expect(screen.getByRole('textbox', { name: 'API prefix' })).toHaveProperty('value', '/mastra');
    });

    it('preserves the connection URL, API prefix, and headers when saving', () => {
      const setConfig = vi.fn<StudioConfigContextType['setConfig']>();
      renderWithConfig(<StudioConfigForm variant={variant} initialConfig={customConfig} />, setConfig);

      fireEvent.click(screen.getByRole('button', { name: 'Save Configuration' }));

      expect(setConfig).toHaveBeenCalledWith(customConfig);
    });

    it('calls onSave after submitting', () => {
      const onSave = vi.fn();
      renderWithConfig(<StudioConfigForm variant={variant} initialConfig={customConfig} onSave={onSave} />);

      fireEvent.click(screen.getByRole('button', { name: 'Save Configuration' }));

      expect(onSave).toHaveBeenCalledOnce();
    });
  });

  describe('when the API prefix is cleared', () => {
    it('saves an undefined prefix', () => {
      const setConfig = vi.fn<StudioConfigContextType['setConfig']>();
      renderWithConfig(<StudioConfigForm variant={variant} initialConfig={customConfig} />, setConfig);

      fireEvent.change(screen.getByRole('textbox', { name: 'API prefix' }), { target: { value: '  ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Configuration' }));

      expect(setConfig).toHaveBeenCalledWith({ ...customConfig, apiPrefix: undefined });
    });
  });

  describe('when the connection uses the default API prefix', () => {
    it('preserves the default prefix when saving', () => {
      const setConfig = vi.fn<StudioConfigContextType['setConfig']>();
      const defaultConfig = { ...customConfig, apiPrefix: '/api' };
      renderWithConfig(<StudioConfigForm variant={variant} initialConfig={defaultConfig} />, setConfig);

      expect(screen.getByRole('textbox', { name: 'API prefix' })).toHaveProperty('value', '/api');
      fireEvent.click(screen.getByRole('button', { name: 'Save Configuration' }));

      expect(setConfig).toHaveBeenCalledWith(defaultConfig);
    });
  });
});
