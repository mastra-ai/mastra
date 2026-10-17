import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { storedAgentToFormValues } from '../../services/stored-agent-to-form-values';
import { useSaveAgent } from '../use-save-agent';
import { authDisabledCapabilities } from './fixtures/auth';
import {
  agentWithAdvancedConfiguration,
  agentWithConditionalTools,
  cmsAgentWithConditionalTool,
  cmsAgentWithInstructionBlocks,
} from './fixtures/stored-agent-edit';
import { server } from '@/test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

describe('CMS agent migration to Builder', () => {
  describe('when renaming an agent created with CMS instruction blocks', () => {
    it('leaves the existing instruction blocks untouched', async () => {
      const capturedRequests: unknown[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabledCapabilities)),
        http.patch(`${TEST_BASE_URL}/api/stored/agents/${cmsAgentWithInstructionBlocks.id}`, async ({ request }) => {
          capturedRequests.push(await request.json());
          return HttpResponse.json(cmsAgentWithInstructionBlocks);
        }),
      );
      const { result, queryClient } = renderHookWithProviders(() =>
        useSaveAgent({ storedAgent: cmsAgentWithInstructionBlocks, silent: true }),
      );

      await act(async () => {
        await result.current.save({ ...storedAgentToFormValues(cmsAgentWithInstructionBlocks), name: 'Renamed' });
      });
      await waitForMutationsIdle(queryClient);

      expect(capturedRequests[0]).toMatchObject({ name: 'Renamed', autoPublish: true });
      expect(capturedRequests[0]).not.toHaveProperty('instructions');
    });
  });

  describe('when renaming an agent with a tool restricted by request-context rules', () => {
    it('leaves the tool configuration untouched', async () => {
      const capturedRequests: unknown[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabledCapabilities)),
        http.patch(`${TEST_BASE_URL}/api/stored/agents/${cmsAgentWithConditionalTool.id}`, async ({ request }) => {
          capturedRequests.push(await request.json());
          return HttpResponse.json(cmsAgentWithConditionalTool);
        }),
      );
      const { result, queryClient } = renderHookWithProviders(() =>
        useSaveAgent({
          storedAgent: cmsAgentWithConditionalTool,
          silent: true,
          availableAgentTools: [
            {
              id: 'refund',
              name: 'Refund',
              description: 'Refund an approved order',
              isChecked: true,
              type: 'tool',
            },
          ],
        }),
      );

      await act(async () => {
        await result.current.save({ ...storedAgentToFormValues(cmsAgentWithConditionalTool), name: 'Renamed' });
      });
      await waitForMutationsIdle(queryClient);

      expect(capturedRequests[0]).not.toHaveProperty('tools');
    });
  });
  describe('when selecting another tool alongside a restricted tool', () => {
    it('retains the selected tool restriction and adds the new tool', async () => {
      const capturedRequests: unknown[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabledCapabilities)),
        http.patch(`${TEST_BASE_URL}/api/stored/agents/${cmsAgentWithConditionalTool.id}`, async ({ request }) => {
          capturedRequests.push(await request.json());
          return HttpResponse.json(cmsAgentWithConditionalTool);
        }),
      );
      const { result } = renderHookWithProviders(() =>
        useSaveAgent({ storedAgent: cmsAgentWithConditionalTool, silent: true }),
      );

      await act(async () => {
        await result.current.save({
          ...storedAgentToFormValues(cmsAgentWithConditionalTool),
          tools: { refund: true, search: true },
        });
      });

      expect(capturedRequests[0]).toMatchObject({ tools: { ...cmsAgentWithConditionalTool.tools, search: {} } });
    });
  });

  describe('when deselecting a tool from conditional tool variants', () => {
    it('preserves the remaining variants and their request-context rules', async () => {
      const storedAgent = agentWithConditionalTools;
      const capturedRequests: unknown[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabledCapabilities)),
        http.patch(`${TEST_BASE_URL}/api/stored/agents/${storedAgent.id}`, async ({ request }) => {
          capturedRequests.push(await request.json());
          return HttpResponse.json(storedAgent);
        }),
      );
      const { result } = renderHookWithProviders(() => useSaveAgent({ storedAgent, silent: true }));

      await act(async () => {
        await result.current.save({ ...storedAgentToFormValues(storedAgent), tools: { refund: false, search: true } });
      });

      expect(capturedRequests[0]).toMatchObject({
        tools: [
          {
            value: { search: {} },
            rules: { operator: 'AND', conditions: [{ field: 'role', operator: 'equals', value: 'manager' }] },
          },
        ],
      });
    });
  });

  describe('when restoring the original name after a successful rename', () => {
    it('sends the restored name while leaving instruction blocks untouched on both saves', async () => {
      const capturedRequests: unknown[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabledCapabilities)),
        http.patch(`${TEST_BASE_URL}/api/stored/agents/${cmsAgentWithInstructionBlocks.id}`, async ({ request }) => {
          capturedRequests.push(await request.json());
          return HttpResponse.json({ ...cmsAgentWithInstructionBlocks, name: 'Renamed' });
        }),
      );
      const { result } = renderHookWithProviders(() =>
        useSaveAgent({ storedAgent: cmsAgentWithInstructionBlocks, silent: true }),
      );
      const originalValues = storedAgentToFormValues(cmsAgentWithInstructionBlocks);

      await act(async () => {
        await result.current.save({ ...originalValues, name: 'Renamed' });
        await result.current.save(originalValues);
      });

      expect(capturedRequests).toHaveLength(2);
      expect(capturedRequests[1]).toMatchObject({ name: cmsAgentWithInstructionBlocks.name });
      for (const request of capturedRequests) expect(request).not.toHaveProperty('instructions');
    });
  });
  describe('when renaming an agent with advanced configuration', () => {
    it('updates only the name and preserves all other settings', async () => {
      const capturedRequests: unknown[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabledCapabilities)),
        http.patch(`${TEST_BASE_URL}/api/stored/agents/${agentWithAdvancedConfiguration.id}`, async ({ request }) => {
          capturedRequests.push(await request.json());
          return HttpResponse.json(agentWithAdvancedConfiguration);
        }),
      );
      const { result } = renderHookWithProviders(() =>
        useSaveAgent({ storedAgent: agentWithAdvancedConfiguration, silent: true }),
      );

      await act(async () => {
        await result.current.save({ ...storedAgentToFormValues(agentWithAdvancedConfiguration), name: 'Renamed' });
      });

      expect(capturedRequests).toEqual([{ name: 'Renamed', autoPublish: true }]);
    });
  });

  describe('when restoring a name while the previous save is still pending', () => {
    it('persists the two edits in order', async () => {
      const capturedRequests: unknown[] = [];
      let releaseFirstRequest = () => {};
      const firstRequest = new Promise<void>(resolve => {
        releaseFirstRequest = resolve;
      });
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabledCapabilities)),
        http.patch(`${TEST_BASE_URL}/api/stored/agents/${cmsAgentWithInstructionBlocks.id}`, async ({ request }) => {
          capturedRequests.push(await request.json());
          if (capturedRequests.length === 1) await firstRequest;
          return HttpResponse.json({ ...cmsAgentWithInstructionBlocks, name: 'Renamed' });
        }),
      );
      const { result } = renderHookWithProviders(() =>
        useSaveAgent({ storedAgent: cmsAgentWithInstructionBlocks, silent: true }),
      );
      const originalValues = storedAgentToFormValues(cmsAgentWithInstructionBlocks);

      await act(async () => {
        const rename = result.current.save({ ...originalValues, name: 'Renamed' });
        const restore = result.current.save(originalValues);
        await waitFor(() => expect(capturedRequests).toHaveLength(1));
        releaseFirstRequest();
        await Promise.all([rename, restore]);
      });

      expect(capturedRequests[1]).toMatchObject({ name: cmsAgentWithInstructionBlocks.name });
    });
  });
});
