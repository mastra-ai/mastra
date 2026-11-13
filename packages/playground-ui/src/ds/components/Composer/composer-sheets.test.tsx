// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelPicker } from '../../../domains/llm/model-picker';
import type { ModelPickerProvider } from '../../../domains/llm/model-picker-types';
import { ComposerAttachMenu } from './composer-attach-menu';

const PHONE_QUERY = '(max-width: 639px)';

const providers: ModelPickerProvider[] = [
  { id: 'anthropic', name: 'Anthropic', models: [{ id: 'claude-sonnet-4-6' }] },
  { id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5' }] },
];

describe('composer sheets on phones', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView ??= () => {};
    // cmdk measures its list.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.spyOn(window, 'matchMedia').mockImplementation(
      query =>
        ({
          matches: query === PHONE_QUERY,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) satisfies MediaQueryList,
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens the model picker as a drawer and closes it once a model is picked', async () => {
    const onValueChange = vi.fn();
    render(
      <ModelPicker
        providers={providers}
        value={{ provider: 'anthropic', model: 'claude-sonnet-4-6' }}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Model:.*Claude Sonnet 4\.6/ }));
    const drawer = await screen.findByRole('dialog', { name: 'Choose a model' });
    expect(drawer.closest('[data-slot="drawer-popup"]')).not.toBeNull();

    fireEvent.click(screen.getByRole('option', { name: 'GPT-5' }));

    expect(onValueChange).toHaveBeenCalledWith({ provider: 'openai', model: 'gpt-5' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Choose a model' })).toBeNull());
  });

  it('opens the attach menu as a drawer with the sources and extra actions', async () => {
    const onUrl = vi.fn();
    render(
      <ComposerAttachMenu onFiles={() => {}} actions={[{ label: 'From a URL…', icon: <Link />, onSelect: onUrl }]} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
    const drawer = await screen.findByRole('dialog', { name: 'Add attachment' });
    expect(drawer.closest('[data-slot="drawer-popup"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Photos' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Files' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'From a URL…' }));

    expect(onUrl).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add attachment' })).toBeNull());
  });

  it('hands files picked from the drawer to onFiles', async () => {
    const onFiles = vi.fn();
    render(<ComposerAttachMenu onFiles={onFiles} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Photos' }));
    const photo = new File(['png'], 'shot.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Photos'), { target: { files: [photo] } });

    expect(onFiles).toHaveBeenCalledWith([photo]);
  });
});
