import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveKitRecordingReview } from '../components/livekit-recording-review';
import { recordedTrace, recordingEnabledPackages, readyRecording, unavailableRecording } from './fixtures/recording';
import { defaultSystemPackages, server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const renderReview = (traceId = recordedTrace.traceId, spans = recordedTrace.spans) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <MastraReactProvider baseUrl={BASE_URL} headers={{ Authorization: 'Bearer studio-session' }}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LiveKitRecordingReview key={traceId} traceId={traceId} spans={spans} />
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
  return { ...view, queryClient };
};
afterEach(cleanup);

describe('LiveKitRecordingReview', () => {
  describe('when the recording route is configured for a voice call trace', () => {
    it('loads the recording only after Review Audio is clicked, using the trace ID and Studio authentication', async () => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(recordingEnabledPackages)));
      const requested = vi.fn();
      server.use(
        http.get(`${BASE_URL}/voice/livekit/recordings/:traceId`, ({ params, request }) => {
          requested(params.traceId, request.headers.get('Authorization'));
          return HttpResponse.json(readyRecording);
        }),
      );
      renderReview();
      const button = await screen.findByRole('button', { name: 'Review Audio' });
      expect(requested).not.toHaveBeenCalled();
      fireEvent.click(button);
      const player = await screen.findByLabelText<HTMLAudioElement>('Call recording');
      expect(player.src).toBe(readyRecording.url);
      expect(player.controls).toBe(true);
      expect(player.autoplay).toBe(false);
      expect(requested).toHaveBeenCalledExactlyOnceWith('call-trace', 'Bearer studio-session');
    });

    it('removes the player when the review dialog closes', async () => {
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(recordingEnabledPackages)),
        http.get(`${BASE_URL}/voice/livekit/recordings/:traceId`, () => HttpResponse.json(readyRecording)),
      );
      renderReview();
      fireEvent.click(await screen.findByRole('button', { name: 'Review Audio' }));
      await screen.findByLabelText('Call recording');
      fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
      await waitFor(() => expect(screen.queryByLabelText('Call recording')).toBeNull());
    });

    it('requests a fresh link when the same recording is reopened', async () => {
      const requested = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(recordingEnabledPackages)),
        http.get(`${BASE_URL}/voice/livekit/recordings/:traceId`, () => {
          requested();
          return HttpResponse.json(readyRecording);
        }),
      );
      renderReview();
      fireEvent.click(await screen.findByRole('button', { name: 'Review Audio' }));
      await screen.findByLabelText('Call recording');
      fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
      await waitFor(() => expect(screen.queryByLabelText('Call recording')).toBeNull());
      fireEvent.click(screen.getByRole('button', { name: 'Review Audio' }));
      await screen.findByLabelText('Call recording');
      expect(requested).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the server does not advertise recording review', () => {
    it('does not offer playback', async () => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(defaultSystemPackages)));
      const { queryClient } = renderReview();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.queryByRole('button', { name: 'Review Audio' })).toBeNull();
    });
  });

  describe('when the trace is not a voice call', () => {
    it('does not offer playback', async () => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(recordingEnabledPackages)));
      const { queryClient } = renderReview('text-trace', [{ ...recordedTrace.spans[0]!, name: 'agent run' }]);
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.queryByRole('button', { name: 'Review Audio' })).toBeNull();
    });
  });

  describe('when the recording has not been uploaded', () => {
    it('explains the unavailable recording and can retry for a completed file', async () => {
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(recordingEnabledPackages)),
        http.get(`${BASE_URL}/voice/livekit/recordings/:traceId`, () => HttpResponse.json(unavailableRecording)),
      );
      renderReview();
      fireEvent.click(await screen.findByRole('button', { name: 'Review Audio' }));
      expect(await screen.findByText(/No recording is available yet/)).not.toBeNull();
      server.use(http.get(`${BASE_URL}/voice/livekit/recordings/:traceId`, () => HttpResponse.json(readyRecording)));
      fireEvent.click(screen.getByRole('button', { name: 'Refresh recording' }));
      expect(await screen.findByLabelText('Call recording')).not.toBeNull();
    });
  });

  describe('when access to the recording is denied', () => {
    it('shows an error without creating a player', async () => {
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(recordingEnabledPackages)),
        http.get(`${BASE_URL}/voice/livekit/recordings/:traceId`, () =>
          HttpResponse.json({ error: 'Denied' }, { status: 403 }),
        ),
      );
      renderReview();
      fireEvent.click(await screen.findByRole('button', { name: 'Review Audio' }));
      expect(await screen.findByText('Unable to load the call recording.')).not.toBeNull();
      expect(screen.queryByLabelText('Call recording')).toBeNull();
    });
  });

  describe('when a playback URL expires or the file cannot be played', () => {
    it('offers a fresh playback link', async () => {
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(recordingEnabledPackages)),
        http.get(`${BASE_URL}/voice/livekit/recordings/:traceId`, () => HttpResponse.json(readyRecording)),
      );
      renderReview();
      fireEvent.click(await screen.findByRole('button', { name: 'Review Audio' }));
      fireEvent.error(await screen.findByLabelText('Call recording'));
      expect(await screen.findByText(/The audio could not be played/)).not.toBeNull();
      const freshUrl = 'https://audio.example/call-room.ogg?signature=fresh';
      server.use(
        http.get(`${BASE_URL}/voice/livekit/recordings/:traceId`, () =>
          HttpResponse.json({ ...readyRecording, url: freshUrl }),
        ),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Refresh recording' }));
      await waitFor(() => expect(screen.getByLabelText<HTMLAudioElement>('Call recording').src).toBe(freshUrl));
    });
  });
});
