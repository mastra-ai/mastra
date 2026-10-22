import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { FactoryThinkingControl } from '../FactoryThinkingControl';

const FACTORY_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1`;
const factory = { id: 'fp-1', name: 'Mastra', defaultThinkingLevel: 'off' };
const saved = (defaultThinkingLevel: string) => HttpResponse.json({ project: { ...factory, defaultThinkingLevel } });

function renderControl() {
  return renderWithProviders(
    <>
      <FactoryThinkingControl factoryId="fp-1" />
      <Toaster position="bottom-right" />
    </>,
  );
}

async function openRamp(user: UserEvent, triggerName: string) {
  await user.click(await screen.findByRole('button', { name: triggerName }));
  return screen.getByRole('slider', { name: 'Thinking' });
}

const dragTo = (slider: HTMLElement, level: number) => fireEvent.change(slider, { target: { value: String(level) } });

describe('FactoryThinkingControl', () => {
  it('renders the Factory thinking level from the server', async () => {
    server.use(http.get(FACTORY_URL, () => HttpResponse.json({ project: factory })));

    renderControl();

    expect(await screen.findByRole('button', { name: 'Thinking: Off' })).toBeEnabled();
  });

  it('shows medium for a Factory without a stored level', async () => {
    server.use(http.get(FACTORY_URL, () => HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra' } })));

    renderControl();

    expect(await screen.findByRole('button', { name: 'Thinking: Medium' })).toBeEnabled();
  });

  it('offers every level and shows the stored one, whatever the default model runs', async () => {
    const patches: unknown[] = [];
    server.use(
      http.get(FACTORY_URL, () =>
        HttpResponse.json({ project: { ...factory, defaultModelId: 'openai/gpt-5', defaultThinkingLevel: 'max' } }),
      ),
      http.patch(FACTORY_URL, async ({ request }) => {
        patches.push(await request.json());
        return saved('max');
      }),
    );
    const user = userEvent.setup();
    const { client } = renderControl();

    const ramp = await openRamp(user, 'Thinking: Max');
    expect(ramp).toHaveAttribute('aria-valuetext', 'Max');
    expect(ramp).toHaveAttribute('max', '5');
    fireEvent.blur(ramp);

    await waitForMutationsIdle(client);
    expect(patches).toEqual([]);
  });

  it('saves once, the level the drag ended on', async () => {
    const requestBodies: unknown[] = [];
    server.use(
      http.get(FACTORY_URL, () => HttpResponse.json({ project: factory })),
      http.patch(FACTORY_URL, async ({ request }) => {
        requestBodies.push(await request.json());
        return saved('high');
      }),
    );
    const user = userEvent.setup();
    const { client } = renderControl();

    const ramp = await openRamp(user, 'Thinking: Off');
    dragTo(ramp, 5);
    dragTo(ramp, 3);
    fireEvent.pointerUp(ramp);
    fireEvent.blur(ramp);

    await waitForMutationsIdle(client);
    expect(requestBodies).toEqual([{ defaultThinkingLevel: 'high' }]);
    await waitFor(() => expect(ramp).toHaveAttribute('aria-valuetext', 'High'));
  });

  it('does not resend a level whose write is still in flight', async () => {
    let writes = 0;
    let releaseSecondWrite = () => {};
    const secondWrite = new Promise<void>(resolve => (releaseSecondWrite = resolve));
    server.use(
      http.get(FACTORY_URL, () => HttpResponse.json({ project: factory })),
      http.patch(FACTORY_URL, async () => {
        writes += 1;
        if (writes === 2) await secondWrite;
        return saved(writes === 1 ? 'high' : 'max');
      }),
    );
    const user = userEvent.setup();
    const { client } = renderControl();

    const ramp = await openRamp(user, 'Thinking: Off');
    dragTo(ramp, 3);
    fireEvent.pointerUp(ramp);
    dragTo(ramp, 5);
    fireEvent.pointerUp(ramp);

    await waitFor(() => expect(writes).toBe(2));
    fireEvent.blur(ramp);
    releaseSecondWrite();

    await waitForMutationsIdle(client);
    expect(writes).toBe(2);
    await waitFor(() => expect(ramp).toHaveAttribute('aria-valuetext', 'Max'));
  });

  it('keeps a repeated level on screen until its own write lands', async () => {
    let writes = 0;
    let releaseFirstWrite = () => {};
    let releaseThirdWrite = () => {};
    const firstWrite = new Promise<void>(resolve => (releaseFirstWrite = resolve));
    const thirdWrite = new Promise<void>(resolve => (releaseThirdWrite = resolve));
    server.use(
      http.get(FACTORY_URL, () => HttpResponse.json({ project: factory })),
      http.patch(FACTORY_URL, async () => {
        writes += 1;
        const write = writes;
        if (write === 1) await firstWrite;
        if (write === 3) await thirdWrite;
        return saved(write === 2 ? 'max' : 'high');
      }),
    );
    const user = userEvent.setup();
    const { client } = renderControl();

    const ramp = await openRamp(user, 'Thinking: Off');
    dragTo(ramp, 3);
    fireEvent.pointerUp(ramp);
    dragTo(ramp, 5);
    fireEvent.pointerUp(ramp);
    dragTo(ramp, 3);
    fireEvent.pointerUp(ramp);

    await waitFor(() => expect(writes).toBe(1));
    releaseFirstWrite();

    await waitFor(() => expect(writes).toBe(3));
    expect(ramp).toHaveAttribute('aria-valuetext', 'High');

    releaseThirdWrite();
    await waitForMutationsIdle(client);
    expect(ramp).toHaveAttribute('aria-valuetext', 'High');
  });

  it('tells a member that only admins can change it', async () => {
    server.use(
      http.get(FACTORY_URL, () => HttpResponse.json({ project: factory })),
      http.patch(FACTORY_URL, () =>
        HttpResponse.json(
          {
            error: 'forbidden',
            message: 'Organization administrator access is required to change the thinking default.',
          },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    const { client } = renderControl();

    const ramp = await openRamp(user, 'Thinking: Off');
    dragTo(ramp, 3);
    fireEvent.pointerUp(ramp);

    await waitForMutationsIdle(client);
    expect(await screen.findByText('Only organization admins can change the thinking level')).toBeInTheDocument();
    await waitFor(() => expect(ramp).toHaveAttribute('aria-valuetext', 'Off'));
  });
});
