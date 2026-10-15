import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { ThinkingConfigInfo } from '../../../../../api/types';
import { BaseThinkingSection } from '../ThinkingDefaultsSection';

const THINKING_URL = `${TEST_BASE_URL}/web/config/thinking`;

const baseConfig: ThinkingConfigInfo = {
  levels: ['off', 'low', 'medium', 'high', 'xhigh', 'max'],
  globalDefault: 'off',
  editable: true,
};

/** What a drag does: the thumb moves, the value is not saved until the pointer comes up. */
const dragTo = (slider: HTMLElement, level: number) => fireEvent.change(slider, { target: { value: String(level) } });

describe('BaseThinkingSection', () => {
  it('renders the base thinking level from the server', async () => {
    server.use(http.get(THINKING_URL, () => HttpResponse.json(baseConfig)));

    renderWithProviders(<BaseThinkingSection />);

    const base = await screen.findByRole('slider', { name: 'Base thinking level' });
    expect(base).toHaveAttribute('aria-valuetext', 'Off');
  });

  it('saves the level the drag ended on', async () => {
    let requestBody: unknown;
    server.use(
      http.get(THINKING_URL, () => HttpResponse.json(baseConfig)),
      http.put(THINKING_URL, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ ok: true, globalDefault: 'high' });
      }),
    );

    const { client } = renderWithProviders(<BaseThinkingSection />);

    const base = await screen.findByRole('slider', { name: 'Base thinking level' });
    dragTo(base, 5);
    dragTo(base, 3);
    fireEvent.pointerUp(base);

    await waitForMutationsIdle(client);
    expect(requestBody).toEqual({ globalDefault: 'high' });
    await waitFor(() => expect(base).toHaveAttribute('aria-valuetext', 'High'));
  });

  it('writes once when the slider is released and then blurred', async () => {
    let writes = 0;
    server.use(
      http.get(THINKING_URL, () => HttpResponse.json(baseConfig)),
      http.put(THINKING_URL, () => {
        writes += 1;
        return HttpResponse.json({ ok: true, globalDefault: 'high' });
      }),
    );

    const { client } = renderWithProviders(<BaseThinkingSection />);

    const base = await screen.findByRole('slider', { name: 'Base thinking level' });
    dragTo(base, 3);
    fireEvent.pointerUp(base);
    fireEvent.blur(base);

    await waitForMutationsIdle(client);
    expect(writes).toBe(1);
  });

  it('does not resend a level whose write is still in flight', async () => {
    let writes = 0;
    let releaseSecondWrite = () => {};
    const secondWrite = new Promise<void>(resolve => (releaseSecondWrite = resolve));
    server.use(
      http.get(THINKING_URL, () => HttpResponse.json(baseConfig)),
      http.put(THINKING_URL, async () => {
        writes += 1;
        if (writes === 2) await secondWrite;
        return HttpResponse.json({
          ok: true,
          globalDefault: writes === 1 ? 'high' : 'max',
        });
      }),
    );

    const { client } = renderWithProviders(<BaseThinkingSection />);

    const base = await screen.findByRole('slider', { name: 'Base thinking level' });
    dragTo(base, 3);
    fireEvent.pointerUp(base);
    dragTo(base, 5);
    fireEvent.pointerUp(base);

    // The second write is held open, so the blur lands while it is still pending.
    await waitFor(() => expect(writes).toBe(2));
    fireEvent.blur(base);
    releaseSecondWrite();

    await waitForMutationsIdle(client);
    expect(writes).toBe(2);
    await waitFor(() => expect(base).toHaveAttribute('aria-valuetext', 'Max'));
  });

  it('keeps a repeated level on screen until its own write lands', async () => {
    let writes = 0;
    let releaseFirstWrite = () => {};
    let releaseThirdWrite = () => {};
    const firstWrite = new Promise<void>(resolve => (releaseFirstWrite = resolve));
    const thirdWrite = new Promise<void>(resolve => (releaseThirdWrite = resolve));
    server.use(
      http.get(THINKING_URL, () => HttpResponse.json(baseConfig)),
      http.put(THINKING_URL, async () => {
        writes += 1;
        const write = writes;
        if (write === 1) await firstWrite;
        if (write === 3) await thirdWrite;
        return HttpResponse.json({
          ok: true,
          globalDefault: write === 2 ? 'max' : 'high',
        });
      }),
    );

    const { client } = renderWithProviders(<BaseThinkingSection />);

    const base = await screen.findByRole('slider', { name: 'Base thinking level' });
    dragTo(base, 3);
    fireEvent.pointerUp(base);
    dragTo(base, 5);
    fireEvent.pointerUp(base);
    dragTo(base, 3);
    fireEvent.pointerUp(base);

    await waitFor(() => expect(writes).toBe(1));
    releaseFirstWrite();

    // High and Max have landed; the second High is still writing and must stay on screen.
    await waitFor(() => expect(writes).toBe(3));
    expect(base).toHaveAttribute('aria-valuetext', 'High');

    releaseThirdWrite();
    await waitForMutationsIdle(client);
    expect(base).toHaveAttribute('aria-valuetext', 'High');
  });

  it('renders read-only rows when the deployment refuses writes', async () => {
    let writes = 0;
    server.use(
      http.get(THINKING_URL, () => HttpResponse.json({ ...baseConfig, editable: false })),
      http.put(THINKING_URL, () => {
        writes += 1;
        return HttpResponse.json({ ok: true, globalDefault: 'high' });
      }),
    );

    renderWithProviders(<BaseThinkingSection />);

    expect(await screen.findByText(/shared by everyone on this deployment/)).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Base thinking level' })).toBeDisabled();
    expect(writes).toBe(0);
  });

  it('names the level under the thumb without saving it mid-drag', async () => {
    let writes = 0;
    server.use(
      http.get(THINKING_URL, () => HttpResponse.json(baseConfig)),
      http.put(THINKING_URL, () => {
        writes += 1;
        return HttpResponse.json({ ok: true, globalDefault: 'max' });
      }),
    );

    renderWithProviders(<BaseThinkingSection />);

    const base = await screen.findByRole('slider', { name: 'Base thinking level' });
    dragTo(base, 5);

    expect(base).toHaveAttribute('aria-valuetext', 'Max');
    expect(writes).toBe(0);
  });

  it('surfaces a write failure from the server', async () => {
    server.use(
      http.get(THINKING_URL, () => HttpResponse.json(baseConfig)),
      http.put(THINKING_URL, () =>
        HttpResponse.json({ error: 'Only organization admins can change thinking defaults' }, { status: 403 }),
      ),
    );

    const { client } = renderWithProviders(<BaseThinkingSection />);

    const base = await screen.findByRole('slider', { name: 'Base thinking level' });
    dragTo(base, 3);
    fireEvent.pointerUp(base);

    await waitForMutationsIdle(client);
    expect(await screen.findByText(/Only organization admins/)).toBeInTheDocument();
    await waitFor(() => expect(base).toHaveAttribute('aria-valuetext', 'Off'));
  });
});
