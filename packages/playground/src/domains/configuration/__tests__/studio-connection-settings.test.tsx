import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioConnectionSettings } from '../components/studio-connection-settings';
import { StudioConfigContext } from '../context/studio-config-state';
import type { StudioConfigContextType } from '../context/studio-config-state';
import type { StudioConfig } from '../types';

const config: StudioConfig = {
  baseUrl: 'http://localhost:4111',
  headers: { Authorization: 'Bearer test' },
  apiPrefix: '/mastra',
};

function renderSettings(setConfig = vi.fn<StudioConfigContextType['setConfig']>()) {
  render(
    <StudioConfigContext.Provider value={{ ...config, isLoading: false, setConfig }}>
      <TooltipProvider>
        <StudioConnectionSettings />
      </TooltipProvider>
    </StudioConfigContext.Provider>,
  );
  return setConfig;
}

const saveButton = () => screen.queryByRole('button', { name: 'Save changes' });
const type = (name: string, value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });

afterEach(cleanup);

describe('StudioConnectionSettings', () => {
  it('shows the saved connection without a save button', () => {
    renderSettings();

    expect(screen.getByRole('textbox', { name: 'Mastra instance URL' })).toHaveProperty('value', config.baseUrl);
    expect(screen.getByRole('textbox', { name: 'API prefix' })).toHaveProperty('value', '/mastra');
    expect(screen.getByRole('textbox', { name: 'Header name' })).toHaveProperty('value', 'Authorization');
    expect(saveButton()).toBeNull();
  });

  it('saves the URL, prefix and headers together', () => {
    const setConfig = renderSettings();

    type('Mastra instance URL', ' http://localhost:5000 ');
    type('API prefix', '/v2');
    fireEvent.click(screen.getByRole('button', { name: 'Add header' }));
    const [, newName] = screen.getAllByRole('textbox', { name: 'Header name' });
    fireEvent.change(newName, { target: { value: 'X-Team' } });
    type('Value of X-Team', 'design');

    expect(setConfig).not.toHaveBeenCalled();
    fireEvent.click(saveButton()!);

    expect(setConfig).toHaveBeenCalledOnce();
    expect(setConfig).toHaveBeenCalledWith({
      baseUrl: 'http://localhost:5000',
      apiPrefix: '/v2',
      headers: { Authorization: 'Bearer test', 'X-Team': 'design' },
    });
    expect(saveButton()).toBeNull();
  });

  it('saves an empty prefix as the default and drops headers without a name', () => {
    const setConfig = renderSettings();

    type('API prefix', '  ');
    fireEvent.click(screen.getByRole('button', { name: 'Add header' }));
    fireEvent.click(saveButton()!);

    expect(setConfig).toHaveBeenCalledWith({ ...config, apiPrefix: undefined });
  });

  it('removes a header on save', () => {
    const setConfig = renderSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Authorization' }));
    fireEvent.click(saveButton()!);

    expect(setConfig).toHaveBeenCalledWith({ ...config, headers: {} });
  });

  it('discards edits', () => {
    const setConfig = renderSettings();

    type('Mastra instance URL', 'http://elsewhere');
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(screen.getByRole('textbox', { name: 'Mastra instance URL' })).toHaveProperty('value', config.baseUrl);
    expect(saveButton()).toBeNull();
    expect(setConfig).not.toHaveBeenCalled();
  });

  it('asks for a URL instead of saving an empty one', () => {
    const setConfig = renderSettings();

    type('Mastra instance URL', '');
    fireEvent.click(saveButton()!);

    expect(screen.getByText('Enter the server URL')).toBeTruthy();
    expect(setConfig).not.toHaveBeenCalled();
  });
});
