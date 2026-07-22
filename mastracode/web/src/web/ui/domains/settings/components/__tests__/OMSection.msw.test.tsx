import type { AgentControllerAvailableModel } from '@mastra/client-js';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { OMConfigInfo } from '../../../../../../shared/api/types';
import { OMSection } from '../OMSection';

const OM_URL = `${TEST_BASE_URL}/web/config/om`;
const RESOURCE_ID = 'res-1';

const models: AgentControllerAvailableModel[] = [
  { id: 'openai/observer-x', provider: 'openai' } as AgentControllerAvailableModel,
  { id: 'openai/reflector-x', provider: 'openai' } as AgentControllerAvailableModel,
];

/** Open a searchable combobox and pick an option (Base UI selects on pointer events). */
async function pickOption(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, name: RegExp) {
  await user.click(trigger);
  const option = await screen.findByRole('option', { name });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
  // Wait for the popup to close so the next interaction targets a settled DOM.
  await waitFor(() => expect(screen.queryByRole('option', { name })).not.toBeInTheDocument());
}

const baseConfig: OMConfigInfo = {
  observerModelId: 'openai/observer-x',
  reflectorModelId: 'openai/reflector-x',
  observationThreshold: 1000,
  reflectionThreshold: 2000,
  observeAttachments: 'auto',
};

describe('OMSection', () => {
  describe('when there is no resourceId', () => {
    it('shows the open-project hint and never calls the OM endpoint', async () => {
      let hit = false;
      server.use(
        http.get(OM_URL, () => {
          hit = true;
          return HttpResponse.json({ config: baseConfig });
        }),
      );

      renderWithProviders(<OMSection models={models} />);

      expect(await screen.findByText(/Open a factory to view/)).toBeInTheDocument();
      expect(hit).toBe(false);
    });
  });

  describe('while the OM config is loading', () => {
    it('renders a skeleton placeholder instead of loading text', async () => {
      server.use(
        http.get(OM_URL, async () => {
          await delay(150);
          return HttpResponse.json({ config: baseConfig });
        }),
      );

      renderWithProviders(<OMSection resourceId={RESOURCE_ID} models={models} />);

      expect(await screen.findByRole('status', { name: 'Loading OM settings' })).toBeInTheDocument();
      expect(screen.queryByText(/Loading OM settings/)).not.toBeInTheDocument();

      expect(await screen.findByDisplayValue('1000')).toBeInTheDocument();
      expect(screen.queryByRole('status', { name: 'Loading OM settings' })).not.toBeInTheDocument();
    });
  });

  describe('when a project is open', () => {
    it('loads and renders the OM config', async () => {
      server.use(http.get(OM_URL, () => HttpResponse.json({ config: baseConfig })));

      renderWithProviders(<OMSection resourceId={RESOURCE_ID} models={models} />);

      const obs = (await screen.findByDisplayValue('1000')) as HTMLInputElement;
      expect(obs).toBeInTheDocument();
      expect(screen.getByDisplayValue('2000')).toBeInTheDocument();
      expect(screen.getByText('Messages before observation')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Message tokens before the Observer runs. More means a larger message window per observation.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('Observations before reflection')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Accumulated observation tokens before the Reflector compresses them. More means less frequent compression.',
        ),
      ).toBeInTheDocument();
    });
  });

  describe('when the threshold is changed', () => {
    it('PUTs the rounded value and reflects the server response', async () => {
      let putBody: unknown;
      server.use(
        http.get(OM_URL, () => HttpResponse.json({ config: baseConfig })),
        http.put(`${OM_URL}/thresholds`, async ({ request }) => {
          putBody = await request.json();
          return HttpResponse.json({ ok: true, config: { ...baseConfig, observationThreshold: 5000 } });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<OMSection resourceId={RESOURCE_ID} models={models} />);

      const obs = (await screen.findByDisplayValue('1000')) as HTMLInputElement;
      await user.clear(obs);
      await user.type(obs, '5000');
      await user.tab();

      await waitFor(() => expect(putBody).toEqual({ resourceId: RESOURCE_ID, observationThreshold: 5000 }));
      await waitFor(() => expect(screen.getByDisplayValue('5000')).toBeInTheDocument());
    });
  });

  describe('when the observer model is switched', () => {
    it('PUTs the new model id', async () => {
      let putBody: unknown;
      server.use(
        http.get(OM_URL, () => HttpResponse.json({ config: baseConfig })),
        http.put(`${OM_URL}/observer/model`, async ({ request }) => {
          putBody = await request.json();
          return HttpResponse.json({ ok: true, config: { ...baseConfig, observerModelId: 'openai/reflector-x' } });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<OMSection resourceId={RESOURCE_ID} models={models} />);

      await screen.findByDisplayValue('1000');
      const observerTrigger = screen.getAllByRole('combobox')[0]!;
      await pickOption(user, observerTrigger, /openai\/reflector-x/);

      await waitFor(() => expect(putBody).toEqual({ resourceId: RESOURCE_ID, modelId: 'openai/reflector-x' }));
    });
  });

  describe('when observe-attachments is toggled', () => {
    it('PUTs the chosen value', async () => {
      let putBody: unknown;
      server.use(
        http.get(OM_URL, () => HttpResponse.json({ config: baseConfig })),
        http.put(`${OM_URL}/observe-attachments`, async ({ request }) => {
          putBody = await request.json();
          return HttpResponse.json({ ok: true, config: { ...baseConfig, observeAttachments: true } });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<OMSection resourceId={RESOURCE_ID} models={models} />);

      await screen.findByDisplayValue('1000');
      await user.click(screen.getByRole('button', { name: 'On' }));

      await waitFor(() => expect(putBody).toEqual({ resourceId: RESOURCE_ID, value: true }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'On' })).toHaveAttribute('aria-pressed', 'true'));
    });
  });
});
