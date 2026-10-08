import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { ChatLanding } from '../chat-landing';
import { chatMemory, chatThreads } from './fixtures/chat';
import { writeAllowedCapabilities } from '@/domains/agents/hooks/__tests__/fixtures/auth';
import { agentsList } from '@/pages/agents/__tests__/fixtures/agents';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

function Destination() {
  return <output>{useLocation().pathname}</output>;
}
function renderChat() {
  const router = createMemoryRouter(
    [
      { path: '/chat', element: <ChatLanding /> },
      { path: '/agents/:agentId/threads/:threadId', element: <Destination /> },
    ],
    { initialEntries: ['/chat'] },
  );
  renderWithProviders(<RouterProvider router={router} />);
}
const storageKey = `mastra:studio:chat-history:v1:${JSON.stringify([TEST_BASE_URL, undefined, undefined])}`;
beforeEach(() => {
  localStorage.clear();
  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(agentsList)),
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(writeAllowedCapabilities)),
    http.get(`${TEST_BASE_URL}/api/memory/status`, () => HttpResponse.json(chatMemory)),
    http.get(`${TEST_BASE_URL}/api/memory/threads`, () => HttpResponse.json(chatThreads)),
    http.get(`${TEST_BASE_URL}/api/memory/threads/:threadId`, ({ params }) =>
      params.threadId === 'last-chat'
        ? HttpResponse.json(chatThreads.threads[0])
        : new HttpResponse(undefined, { status: 404 }),
    ),
  );
});
describe('Chat landing', () => {
  describe('when a previous conversation is saved', () => {
    it('reopens the last conversation with its agent', async () => {
      localStorage.setItem(storageKey, JSON.stringify([{ agentId: 'researcher', threadId: 'last-chat' }]));
      renderChat();
      expect(await screen.findByText('/agents/researcher/threads/last-chat')).toBeTruthy();
    });
  });
  describe('when the remembered thread has been deleted', () => {
    it('opens a new conversation with the same agent', async () => {
      localStorage.setItem(storageKey, JSON.stringify([{ agentId: 'researcher', threadId: 'deleted' }]));
      renderChat();
      expect(await screen.findByText('/agents/researcher/threads/new')).toBeTruthy();
    });
  });
  describe('when a saved agent is no longer accessible', () => {
    it('skips it and resumes an accessible agent', async () => {
      localStorage.setItem(
        storageKey,
        JSON.stringify([
          { agentId: 'removed', threadId: 'private' },
          { agentId: 'researcher', threadId: 'last-chat' },
        ]),
      );
      renderChat();
      expect(await screen.findByText('/agents/researcher/threads/last-chat')).toBeTruthy();
    });
  });
  describe('when the saved conversation is outside the first history page', () => {
    it('still resumes that conversation', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/memory/threads`, () => HttpResponse.json({ ...chatThreads, threads: [] })),
      );
      localStorage.setItem(storageKey, JSON.stringify([{ agentId: 'researcher', threadId: 'last-chat' }]));
      renderChat();
      expect(await screen.findByText('/agents/researcher/threads/last-chat')).toBeTruthy();
    });
  });
  describe('when no local history exists', () => {
    it('opens the most recently updated conversation', async () => {
      renderChat();
      expect(await screen.findByText('/agents/researcher/threads/last-chat')).toBeTruthy();
    });
  });
  describe('when no agents exist', () => {
    it('explains how to start without redirecting to an invalid chat', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json({})));
      renderChat();
      expect(await screen.findByText('No agents available')).toBeTruthy();
    });
  });
});
