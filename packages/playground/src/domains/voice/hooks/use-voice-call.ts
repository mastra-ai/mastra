import { useQueryClient } from '@tanstack/react-query';
import type { Room } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type {
  LiveKitConnectionDetails,
  VoiceAgentState,
  VoiceCallControls,
  VoiceCallStatus,
  VoiceCaptionSegment,
} from '../types';
import { useStudioConfig } from '@/domains/configuration';
import { useMastraPackages } from '@/domains/configuration/hooks/use-mastra-packages';

// Default path of liveKitConnectionRoute() from @mastra/livekit; the server's
// liveKitConnectionRouteEnabled capability reports whether this exact route is registered.
const LIVEKIT_CONNECTION_DETAILS_PATH = '/voice/livekit/connection-details';

const AGENT_STATE_ATTRIBUTE = 'lk.agent.state';
const TRANSCRIPTION_TOPIC = 'lk.transcription';
const TRANSCRIPTION_FINAL_ATTRIBUTE = 'lk.transcription_final';
const MAX_CAPTION_SEGMENTS = 20;

export interface UseVoiceCallArgs {
  agentId?: string;
  threadId?: string;
  /**
   * Called once the call is connected. The agent chat passes its refreshThreadList
   * handler here: on a brand-new chat it navigates from /session/new to the real thread
   * URL, which enables the messages query so per-turn refetches reach the open chat.
   */
  onCallStarted?: () => Promise<void> | void;
}

function upsertSegment(
  segments: VoiceCaptionSegment[],
  id: string,
  role: 'user' | 'agent',
  chunk: string,
  final: boolean,
): VoiceCaptionSegment[] {
  const existing = segments.find(segment => segment.id === id);
  const next = existing
    ? segments.map(segment =>
        segment.id === id ? { ...segment, text: segment.text + chunk, final: segment.final || final } : segment,
      )
    : [...segments, { id, role, text: chunk, final }];
  return next.slice(-MAX_CAPTION_SEGMENTS);
}

/**
 * Manages a LiveKit voice session with the current agent: fetches connection details from
 * the Mastra server, joins the room with the microphone enabled, plays the agent's audio,
 * and exposes live state and captions. The voice session shares the chat's memory thread,
 * so the transcript lands in the same conversation.
 */
export const useVoiceCall = ({ agentId, threadId, onCallStarted }: UseVoiceCallArgs): VoiceCallControls => {
  const { baseUrl, headers } = useStudioConfig();
  const { data: systemPackages } = useMastraPackages();
  // Fail open: only a definitive `false` disables calls. Loading, legacy servers without
  // the field, and failed capability requests all keep the call flow usable.
  const liveKitUnavailable = systemPackages?.liveKitConnectionRouteEnabled === false;
  const queryClient = useQueryClient();
  const onCallStartedRef = useRef(onCallStarted);
  useEffect(() => {
    onCallStartedRef.current = onCallStarted;
  }, [onCallStarted]);
  const [status, setStatus] = useState<VoiceCallStatus>('idle');
  const [agentState, setAgentState] = useState<VoiceAgentState>('initializing');
  const [captions, setCaptions] = useState<VoiceCaptionSegment[]>([]);
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // start() runs several awaits; cleanup() bumps this epoch (and aborts the fetch) so a
  // start whose epoch is superseded stops touching state or connecting a room.
  const startEpochRef = useRef(0);
  const startAbortRef = useRef<AbortController | null>(null);

  const refreshThread = useCallback(() => {
    if (threadId) void queryClient.invalidateQueries({ queryKey: ['memory', 'messages', threadId] });
    // The sidebar lists threads for resourceId === agentId; the call's thread lives there.
    if (agentId) void queryClient.invalidateQueries({ queryKey: ['memory', 'threads', agentId, agentId] });
  }, [agentId, queryClient, threadId]);

  // Each finalized agent caption marks a completed turn whose messages are already
  // persisted; debounce so word-synced segments coalesce into one refetch.
  const scheduleThreadRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      refreshThread();
    }, 600);
  }, [refreshThread]);

  const cleanup = useCallback(() => {
    // Supersede any in-flight start() and abort its fetch so a stopped/unmounted call
    // can't finish connecting a room after the fact.
    startEpochRef.current += 1;
    startAbortRef.current?.abort();
    startAbortRef.current = null;
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      // Disconnecting stops the published mic track and the subscribed audio.
      void room.disconnect();
    }
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    audioRef.current = null;
    setStatus('idle');
    setAgentState('initializing');
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    cleanup();
    setCaptions([]);
    // The worker persisted the spoken turns to the same thread; refresh the chat.
    refreshThread();
  }, [cleanup, refreshThread]);

  const start = useCallback(async () => {
    if (status !== 'idle') return;
    // The connection route is not registered; starting would only fire a doomed request.
    if (liveKitUnavailable) return;
    // Claim this run; any later cleanup()/start() supersedes it.
    const epoch = (startEpochRef.current += 1);
    const abortController = new AbortController();
    startAbortRef.current = abortController;
    const superseded = () => startEpochRef.current !== epoch;
    setStatus('connecting');
    setCaptions([]);
    try {
      // Custom API routes mount at the server root, outside the /api prefix.
      const response = await fetch(`${baseUrl}${LIVEKIT_CONNECTION_DETAILS_PATH}`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        // resourceId matches the sidebar's thread listing (resourceId === agentId), so
        // the call's thread and messages land where Studio reads them.
        body: JSON.stringify({ agentId, threadId, resourceId: agentId }),
        signal: abortController.signal,
      });
      if (superseded()) return;
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          body.error ??
            'LiveKit voice is not configured for this server. Add liveKitConnectionRoute() to server.apiRoutes and run a voice worker.',
        );
      }
      const details = (await response.json()) as LiveKitConnectionDetails;
      if (superseded()) return;

      const { Room, RoomEvent, Track } = await import('livekit-client');
      if (superseded()) return;
      const room = new Room();
      roomRef.current = room;

      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;

      room.on(RoomEvent.TrackSubscribed, track => {
        if (track.kind === Track.Kind.Audio && audioRef.current) {
          track.attach(audioRef.current);
        }
      });
      room.on(RoomEvent.ParticipantAttributesChanged, (changed, participant) => {
        const state = changed[AGENT_STATE_ATTRIBUTE] ?? participant.attributes[AGENT_STATE_ATTRIBUTE];
        if (state && participant.identity !== details.participantName) {
          setAgentState(state as VoiceAgentState);
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) {
          cleanup();
        }
      });
      room.registerTextStreamHandler(TRANSCRIPTION_TOPIC, async (reader, participantInfo) => {
        const role = participantInfo.identity === details.participantName ? 'user' : 'agent';
        const final = reader.info.attributes?.[TRANSCRIPTION_FINAL_ATTRIBUTE] === 'true';
        for await (const chunk of reader) {
          setCaptions(prev => upsertSegment(prev, reader.info.id, role, chunk, final));
        }
        // An agent segment finishing means the turn completed and its messages are
        // persisted — pull them into the open chat.
        if (role === 'agent') scheduleThreadRefresh();
      });

      await room.connect(details.serverUrl, details.participantToken);
      if (superseded()) {
        void room.disconnect();
        if (roomRef.current === room) roomRef.current = null;
        return;
      }
      await room.localParticipant.setMicrophoneEnabled(true);
      if (superseded()) {
        void room.disconnect();
        if (roomRef.current === room) roomRef.current = null;
        return;
      }
      setStatus('active');
      // The worker creates the call's thread on session start; show it in the sidebar.
      refreshThread();
      await Promise.resolve(onCallStartedRef.current?.()).catch(() => {});
    } catch (error) {
      // Aborted by cleanup() (stop/unmount) or otherwise superseded — not a real failure.
      if (abortController.signal.aborted || superseded()) return;
      cleanup();
      toast.error(error instanceof Error ? error.message : 'Failed to start the voice call.');
    }
  }, [agentId, baseUrl, cleanup, headers, liveKitUnavailable, refreshThread, scheduleThreadRefresh, status, threadId]);

  return {
    status,
    agentState,
    captions,
    liveKitUnavailable,
    start: () => void start(),
    stop,
  };
};
