'use client';

import { useState, useRef, useEffect } from 'react';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'requesting_mic';
type Message = {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  isFinal?: boolean; // true once the first FINAL text has been applied (to distinguish replace vs append)
};

export default function VoiceInterface() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('tiffany');
  const [endpointingSensitivity, setEndpointingSensitivity] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('LOW');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<string[]>([]); // Store base64-encoded audio strings
  const isPlayingAudioRef = useRef(false);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isRecordingRef = useRef(false);
  const audioChunkQueueRef = useRef<string[]>([]);
  const isSendingAudioRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  // Scheduling-based playback: schedule chunks at precise times for gapless audio
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // When server-sent interrupt fires, suppress incoming audio until the current turn ends
  const suppressAudioRef = useRef(false);
  const TARGET_SAMPLE_RATE = 16000;

  const connect = async () => {
    setStatus('connecting');
    setError(null);
    try {
      const response = await fetch('/api/voice/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speaker: selectedSpeaker,
          endpointingSensitivity: endpointingSensitivity,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Connection failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Connect] Response data:', data);
      if (data.success) {
        console.log('[Connect] Connection successful, requesting microphone access...');
        setStatus('connected');
        // After connection, request microphone access
        await requestMicrophoneAccess();
      } else {
        throw new Error(data.error || 'Connection failed');
      }
    } catch (err) {
      console.error('Connection error:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
      setStatus('disconnected');
    }
  };

  const requestMicrophoneAccess = async () => {
    setStatus('requesting_mic');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      mediaStreamRef.current = stream;
      setMicPermissionGranted(true);
      setStatus('connected');
      
      // Set up Server-Sent Events to receive responses
      // IMPORTANT: Set up event stream BEFORE starting recording to ensure we catch all events
      console.log('[Connect] Setting up event stream...');
      setupEventStream();
      
      // Small delay to ensure event stream is ready
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify event stream is connected
      if (eventSourceRef.current?.readyState === EventSource.OPEN) {
        console.log('[Connect] Event stream is OPEN and ready');
      } else {
        console.warn('[Connect] Event stream state:', eventSourceRef.current?.readyState, '(0=CONNECTING, 1=OPEN, 2=CLOSED)');
      }
      
      // Automatically start recording after mic access is granted
      // Start recording immediately (async)
      console.log('[Connect] Starting audio recording...');
      await startRecording(stream);
    } catch (err) {
      console.error('Microphone access error:', err);
      setError(err instanceof Error ? err.message : 'Failed to access microphone');
      setStatus('connected'); // Still connected, just no mic access
    }
  };

  const setupEventStream = () => {
    // Close existing event source if any
    if (eventSourceRef.current) {
      console.log('[EventStream] Closing existing event source');
      eventSourceRef.current.close();
    }
    
    console.log('[EventStream] Setting up Server-Sent Events connection to /api/voice/events...');
    // Create new EventSource for Server-Sent Events
    const eventSource = new EventSource('/api/voice/events');
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      console.log('[EventStream] ✓ Connection opened successfully, readyState:', eventSource.readyState);
      console.log('[EventStream] EventSource readyState: 0=CONNECTING, 1=OPEN, 2=CLOSED');
      console.log('[EventStream] EventSource URL:', eventSource.url);
      console.log('[EventStream] EventSource withCredentials:', eventSource.withCredentials);
    };
    
    eventSource.onmessage = (event) => {
      try {
        console.log('[EventStream] Raw event received, data length:', event.data?.length, 'data preview:', event.data?.substring(0, 100));
        
        // Handle keepalive messages (they start with ':')
        if (event.data.trim().startsWith(':')) {
          console.log('[EventStream] Keepalive received');
          return;
        }
        
        const data = JSON.parse(event.data);
        console.log('[EventStream] ✓ Parsed event:', { type: data.type, hasData: !!data.data, timestamp: data.timestamp });
        
        if (data.type === 'text') {
          const { text, role, generationStage } = data.data;
          console.log('[EventStream] Text event received:', {
            text: text?.substring(0, 100),
            role,
            generationStage,
            textLength: text?.length,
          });

          if (!text || typeof text !== 'string' || text.trim().length === 0) {
            console.warn('[EventStream] Empty or invalid text received, skipping:', { text, role });
            return;
          }

          // Nova Sonic sends multiple text events per assistant turn:
          //   1. USER FINAL — ASR transcription of what the user said
          //   2. One or more ASSISTANT SPECULATIVE — preview of planned speech segments
          //      (Nova Sonic splits long responses into multiple content blocks, each
          //       with its own SPECULATIVE text. These should all go into ONE bubble.)
          //   3. One or more ASSISTANT FINAL — transcript of what was actually spoken
          //      (one per content block, arrives after all audio)
          //
          // To avoid duplicate bubbles:
          // - ASSISTANT SPECULATIVE → create new on role change, APPEND on same role
          //   (but if previous assistant msg is already finalized, start new — it's a new turn)
          // - ASSISTANT FINAL → first FINAL replaces speculative text (sets isFinal),
          //   subsequent FINALs append to build the full transcript
          // - USER text → create on role change, replace on same role

          // New assistant content means a new response is starting — clear barge-in suppression
          if (role === 'assistant' && generationStage === 'SPECULATIVE') {
            suppressAudioRef.current = false;
          }

          setMessages(prev => {
            const lastMessage = prev[prev.length - 1];

            // ASSISTANT FINAL: first FINAL replaces speculative text, subsequent FINALs append
            if (role === 'assistant' && generationStage === 'FINAL') {
              const lastAssistantIdx = prev.findLastIndex(m => m.role === 'assistant');
              if (lastAssistantIdx >= 0) {
                const lastAssistant = prev[lastAssistantIdx];
                if (lastAssistant.isFinal) {
                  // Already finalized — append (another FINAL block in same turn)
                  return prev.map((msg, idx) =>
                    idx === lastAssistantIdx ? { ...msg, text: msg.text + text } : msg
                  );
                }
                // First FINAL — replace speculative text and mark as finalized
                return prev.map((msg, idx) =>
                  idx === lastAssistantIdx ? { ...msg, text, isFinal: true } : msg
                );
              }
              // No existing assistant message — create one
              return [...prev, { role: 'assistant' as const, text, timestamp: new Date(), isFinal: true }];
            }

            // ASSISTANT SPECULATIVE: create on role change or new turn, append within same turn
            if (role === 'assistant' && generationStage === 'SPECULATIVE') {
              if (lastMessage && lastMessage.role === 'assistant' && !lastMessage.isFinal) {
                // Same turn, still speculative — append
                return prev.map((msg, idx) =>
                  idx === prev.length - 1 ? { ...msg, text: msg.text + text } : msg
                );
              }
              // Role change OR previous assistant message was finalized (new turn) — create new
              return [...prev, { role: 'assistant' as const, text, timestamp: new Date() }];
            }

            // USER text (SPECULATIVE or FINAL): create on role change, replace on same role
            if (role === 'user') {
              if (!lastMessage || lastMessage.role !== 'user') {
                return [...prev, { role: 'user' as const, text, timestamp: new Date() }];
              }
              // Same role user → replace (speculative → final transcription)
              return prev.map((msg, idx) =>
                idx === prev.length - 1 ? { ...msg, text } : msg
              );
            }

            // Fallback for unknown generationStage: role change → new, same → replace
            if (!lastMessage || lastMessage.role !== role) {
              return [...prev, { role: role as 'user' | 'assistant', text, timestamp: new Date() }];
            }
            return prev.map((msg, idx) =>
              idx === prev.length - 1 ? { ...msg, text } : msg
            );
          });
        } else if (data.type === 'audio') {
          // After barge-in, suppress remaining audio from the interrupted turn
          if (suppressAudioRef.current) return;

          const { audio, isBase64 } = data.data;
          if (audio) {
            if ((isBase64 || typeof audio === 'string') && typeof audio === 'string') {
              if (audio.length > 0) {
                audioQueueRef.current.push(audio);
                schedulePlayback();
              }
            } else if (Array.isArray(audio)) {
              const audioBuffer = new Uint8Array(audio);
              if (audioBuffer.length > 0) {
                const binaryString = String.fromCharCode(...audioBuffer);
                const base64Audio = btoa(binaryString);
                audioQueueRef.current.push(base64Audio);
                schedulePlayback();
              }
            }
          }
        } else if (data.type === 'turnComplete') {
          console.log('[EventStream] ✓ Turn complete - ready for next user input');
          // Clear interrupt suppression — new turn can produce audio again
          suppressAudioRef.current = false;
        } else if (data.type === 'interrupt') {
          console.log('[EventStream] Interrupt detected - stopping all playback');
          stopPlayback();
          suppressAudioRef.current = true;
        }
      } catch (err) {
        console.error('[EventStream] Error parsing event:', err);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('[EventStream] ✗ Error:', error);
      console.error('[EventStream] EventSource readyState:', eventSource.readyState);
      console.error('[EventStream] EventSource URL:', eventSource.url);
      // EventSource.readyState: 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
      if (eventSource.readyState === EventSource.CLOSED) {
        console.error('[EventStream] EventSource is CLOSED, attempting to reconnect...');
        // Try to reconnect after a delay
        setTimeout(() => {
          if (status === 'connected') {
            console.log('[EventStream] Reconnecting event stream...');
            setupEventStream();
          }
        }, 1000);
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        console.warn('[EventStream] EventSource is still CONNECTING, may be a network issue');
      }
    };
  };

  const clearChat = () => {
    console.log('[UI] Clearing chat, current message count:', messages.length);
    setMessages([]);
  };
  
  const handleSpeakerChange = async (newSpeaker: string) => {
    setSelectedSpeaker(newSpeaker);
    // If connected, user needs to reconnect for changes to take effect
    if (status === 'connected') {
      setError('Speaker changed. Please disconnect and reconnect for changes to take effect.');
    }
  };

  const handleSensitivityChange = async (newSensitivity: 'HIGH' | 'MEDIUM' | 'LOW') => {
    setEndpointingSensitivity(newSensitivity);
    // If connected, user needs to reconnect for changes to take effect
    if (status === 'connected') {
      setError('Sensitivity changed. Please disconnect and reconnect for changes to take effect.');
    }
  };

  const disconnect = async () => {
    try {
      await fetch('/api/voice/disconnect', { method: 'POST' });
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
    
    // Close event stream
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setStatus('disconnected');
    setIsRecording(false);
    setMicPermissionGranted(false);
    
    // Stop audio processor
    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }
    
    // Stop source node
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    
    // Stop media stream tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // Stop audio playback (clears timer, active sources, queue, and scheduling state)
    stopPlayback();
    suppressAudioRef.current = false;

    // Close playback AudioContext
    if (playbackContextRef.current) {
      try { playbackContextRef.current.close(); } catch {}
      playbackContextRef.current = null;
    }
  };

  const startRecording = async (stream?: MediaStream) => {
    // Check status using a function to get the latest state
    // Also allow if we have a stream (which means we're ready to record)
    const audioStream = stream || mediaStreamRef.current;
    if (!audioStream) {
      setError('No microphone access available');
      return;
    }
    
    // If status check is needed, use a callback to get latest state
    // But since we have the stream, we can proceed
    setError(null); // Clear any previous errors

    try {
      // Initialize AudioContext for PCM conversion
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        // Try to create with target sample rate (may not work in all browsers)
        try {
          audioContextRef.current = new AudioContextClass({
            sampleRate: TARGET_SAMPLE_RATE,
          });
        } catch {
          // Fallback to default sample rate
          audioContextRef.current = new AudioContextClass();
        }
      }

      const audioContext = audioContextRef.current;
      
      // CRITICAL: Resume audio context if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        console.log('[Audio] AudioContext is suspended, resuming...');
        await audioContext.resume();
        console.log('[Audio] AudioContext resumed, state:', audioContext.state);
      }
      
      // Verify audio stream is active
      const audioTracks = audioStream.getAudioTracks();
      console.log('[Audio] Audio tracks:', audioTracks.length);
      audioTracks.forEach((track, index) => {
        console.log(`[Audio] Track ${index}: enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}, label=${track.label}`);
      });
      
      if (audioTracks.length === 0 || !audioTracks[0].enabled) {
        throw new Error('No active audio tracks in stream');
      }
      
      // Create source node from media stream
      const sourceNode = audioContext.createMediaStreamSource(audioStream);
      sourceNodeRef.current = sourceNode;
      console.log('[Audio] Created MediaStreamSource from stream');

      // Create script processor for PCM conversion
      // Note: ScriptProcessorNode is deprecated but widely supported
      // For production, consider using AudioWorkletNode
      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      audioProcessorRef.current = processor;
      console.log('[Audio] Created ScriptProcessorNode, bufferSize:', bufferSize);

      let chunkCount = 0;
      processor.onaudioprocess = async (e) => {
        chunkCount++;
        if (chunkCount === 1 || chunkCount % 10 === 0) {
          console.log(`[Audio] onaudioprocess called ${chunkCount} times`);
        }
        
        if (!isRecordingRef.current) {
          if (chunkCount === 1) {
            console.log('[Audio] Not recording, skipping audio processing');
          }
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        const numSamples = inputData.length;

        // IMPORTANT: Send ALL audio chunks continuously, including during assistant playback.
        // Nova Sonic's server-side VAD needs continuous audio to detect barge-in (user
        // interrupting the assistant). The model is designed to handle echo/background noise.
        // AWS docs: "audio samples should be streamed in real-time as they're captured,
        // maintaining the natural microphone sampling cadence throughout the conversation."
        if (chunkCount === 1 || chunkCount % 50 === 0) {
          console.log(`[Audio] Chunk ${chunkCount}: ${numSamples} samples`);
        }

        // Convert float32 (-1 to 1) to int16 (-32768 to 32767)
        const pcmData = new Int16Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }

        // Convert to base64
        const base64Audio = arrayBufferToBase64(pcmData.buffer);

        if (chunkCount === 1 || chunkCount % 10 === 0) {
          console.log(`[Audio] Queuing chunk ${chunkCount}, base64 length: ${base64Audio.length}`);
        }

        // Queue audio chunk instead of sending immediately
        audioChunkQueueRef.current.push(base64Audio);

        // Process queue if not already processing
        if (!isSendingAudioRef.current) {
          processAudioChunkQueue();
        }
      };

      // Create a gain node to control output (we'll mute it)
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0; // Mute output to prevent feedback
      
      // Connect nodes: source -> processor -> gain -> destination
      // The processor MUST be connected to a destination to work
      sourceNode.connect(processor);
      processor.connect(gainNode);
      gainNode.connect(audioContext.destination);
      console.log('[Audio] Nodes connected: sourceNode -> processor -> gainNode -> destination');

      // Force the processor to start by ensuring the context is running
      if (audioContext.state !== 'running') {
        console.log('[Audio] AudioContext not running, attempting to resume...');
        await audioContext.resume();
      }
      
      console.log('[Audio] Recording started, sample rate:', audioContext.sampleRate, 'state:', audioContext.state);
      
      // CRITICAL: Monitor AudioContext state changes
      const stateChangeHandler = () => {
        console.warn('[Audio] AudioContext state changed to:', audioContext.state);
        if (audioContext.state === 'closed') {
          console.error('[Audio] ERROR: AudioContext was closed! This will stop audio processing.');
          // Try to recreate if closed unexpectedly
          if (isRecordingRef.current) {
            console.log('[Audio] Attempting to recreate AudioContext...');
            // Don't recreate here - let user reconnect
          }
        } else if (audioContext.state === 'suspended') {
          console.warn('[Audio] AudioContext suspended, attempting to resume...');
          audioContext.resume().catch(err => {
            console.error('[Audio] Failed to resume AudioContext:', err);
          });
        }
      };
      audioContext.addEventListener('statechange', stateChangeHandler);
      
      // Monitor track state changes
      audioTracks.forEach((track, index) => {
        const endedHandler = () => {
          console.error(`[Audio] ERROR: Audio track ${index} ended! This will stop audio processing.`);
          // Track ended - this shouldn't happen while recording
          if (isRecordingRef.current) {
            console.error('[Audio] Track ended while recording - this is a problem!');
          }
        };
        track.addEventListener('ended', endedHandler);
        
        track.addEventListener('mute', () => {
          console.warn(`[Audio] Audio track ${index} was muted`);
        });
        track.addEventListener('unmute', () => {
          console.log(`[Audio] Audio track ${index} was unmuted`);
        });
      });
      
      // Store the stream reference to prevent garbage collection
      // This is critical - if the stream is GC'd, the track will end
      (window as any).__audioStreamRef = audioStream;
      
      // Test if processor is working by checking after a short delay
      setTimeout(() => {
        if (chunkCount === 0) {
          console.warn('[Audio] WARNING: onaudioprocess has not been called after 1 second. This may indicate an issue.');
          console.warn('[Audio] AudioContext state:', audioContext.state);
          const currentTracks = audioStream.getAudioTracks();
          console.warn('[Audio] Audio tracks:', currentTracks.map(t => ({
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState
          })));
          
          // Try to resume if suspended
          if (audioContext.state === 'suspended') {
            console.log('[Audio] Attempting to resume suspended AudioContext...');
            audioContext.resume().then(() => {
              console.log('[Audio] AudioContext resumed, new state:', audioContext.state);
            }).catch(err => {
              console.error('[Audio] Failed to resume AudioContext:', err);
            });
          }
        }
      }, 1000);
      
      isRecordingRef.current = true;
      setIsRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsRecording(false);
    }
  };

  // Helper function to convert ArrayBuffer to base64 (browser-safe)
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Process audio chunk queue with throttling
  const processAudioChunkQueue = async () => {
    if (isSendingAudioRef.current || audioChunkQueueRef.current.length === 0) {
      return;
    }

    isSendingAudioRef.current = true;

    try {
      // Process chunks quickly without delays for lower latency
      // Send chunks sequentially but without waiting for responses
      while (audioChunkQueueRef.current.length > 0) {
        const chunk = audioChunkQueueRef.current.shift();
        if (chunk) {
          sendAudioChunk(chunk); // Fire and forget - don't await
        }
        // Small yield to prevent blocking, but process quickly
        if (audioChunkQueueRef.current.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 0)); // Yield to event loop
        }
      }
    } catch (err) {
      console.error('[Audio] Error processing audio chunk queue:', err);
    } finally {
      isSendingAudioRef.current = false;
      
      // If more chunks arrived while processing, process them
      if (audioChunkQueueRef.current.length > 0) {
        setTimeout(() => processAudioChunkQueue(), 0);
      }
    }
  };

  const sendAudioChunk = async (base64Audio: string) => {
    // Fire and forget - don't await to reduce latency
    // Transcriptions come via SSE events in real-time
    const audioLength = base64Audio.length;
    if (audioLength === 0) {
      console.warn('[Audio] Attempted to send empty audio chunk, skipping');
      return;
    }
    
    fetch('/api/voice/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: base64Audio, // Base64-encoded PCM audio
        chunk: true, // Indicate this is a chunk, not a complete turn
      }),
    })
    .then(response => {
      if (!response.ok) {
        console.error(`[Audio] Failed to send audio chunk: ${response.status} ${response.statusText}`);
        return response.json().then(data => {
          console.error('[Audio] Error details:', data);
        });
      }
      return response.json();
    })
    .then(data => {
      if (data && !data.success && data.error) {
        console.error('[Audio] Server error sending chunk:', data.error);
      } else {
        // Only log occasionally to avoid spam
        const shouldLog = Math.random() < 0.1; // Log ~10% of chunks
        if (shouldLog) {
          console.log(`[Audio] ✓ Audio chunk sent successfully (${audioLength} bytes)`);
        }
      }
    })
    .catch(err => {
      console.error('[Audio] Failed to send audio chunk:', err);
    });
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    setIsRecording(false);
  };

  // Convert base64 PCM audio to Float32Array for playback
  const base64ToFloat32Array = (base64String: string): Float32Array => {
    try {
      // Decode base64 to binary string
      const binaryString = window.atob(base64String);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Convert Uint8Array to Int16Array (PCM 16-bit signed integers)
      const int16Array = new Int16Array(bytes.buffer);
      
      // Convert Int16Array to Float32Array (normalized to -1.0 to 1.0)
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        // Normalize 16-bit integer (-32768 to 32767) to float (-1.0 to 1.0)
        float32Array[i] = int16Array[i] / 32768.0;
      }
      
      return float32Array;
    } catch (error) {
      console.error('[Audio] Error converting base64 to Float32Array:', error);
      throw error;
    }
  };

  // Stop all scheduled audio playback (used for interrupt and disconnect)
  const stopPlayback = () => {
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    for (const src of activeSourcesRef.current) {
      try { src.stop(); src.disconnect(); } catch {}
    }
    activeSourcesRef.current = [];
    audioQueueRef.current = [];
    nextPlayTimeRef.current = 0;
    isPlayingAudioRef.current = false;
  };

  // Flush all queued audio chunks into a single scheduled AudioBuffer.
  // Uses Web Audio API precise scheduling (source.start(time)) for gapless playback.
  const flushAudioQueue = () => {
    if (audioQueueRef.current.length === 0) return;

    // Ensure playback context exists
    if (!playbackContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      playbackContextRef.current = new AudioContextClass();
    }
    const ctx = playbackContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Take ALL available chunks and concatenate into one buffer
    const chunks = audioQueueRef.current.splice(0);
    let totalLength = 0;
    const decoded: Float32Array[] = [];
    for (const chunk of chunks) {
      try {
        const samples = base64ToFloat32Array(chunk);
        decoded.push(samples);
        totalLength += samples.length;
      } catch {
        // Skip invalid chunks
      }
    }
    if (totalLength === 0) return;

    const concatenated = new Float32Array(totalLength);
    let offset = 0;
    for (const d of decoded) {
      concatenated.set(d, offset);
      offset += d.length;
    }

    // Create a single AudioBuffer for all concatenated samples
    const audioBuffer = ctx.createBuffer(1, concatenated.length, 24000);
    audioBuffer.getChannelData(0).set(concatenated);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    // Schedule at the precise time the previous buffer ends (gapless)
    const now = ctx.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + audioBuffer.duration;

    // Track active sources for barge-in support
    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
      if (activeSourcesRef.current.length === 0 && audioQueueRef.current.length === 0) {
        isPlayingAudioRef.current = false;
      }
    };

    isPlayingAudioRef.current = true;
  };

  // Schedule playback of queued audio chunks with jitter buffering.
  // Uses an initial delay to accumulate a starting buffer, then adapts
  // based on how much audio "runway" is already scheduled ahead.
  const schedulePlayback = () => {
    // If a flush is already scheduled, chunks will be picked up when it fires
    if (playbackTimerRef.current) return;

    if (nextPlayTimeRef.current === 0) {
      // Starting fresh — accumulate an initial buffer before playing
      // to absorb network jitter and prevent choppy start
      playbackTimerRef.current = setTimeout(() => {
        playbackTimerRef.current = null;
        flushAudioQueue();
      }, 150);
      return;
    }

    const ctx = playbackContextRef.current;
    if (!ctx) {
      flushAudioQueue();
      return;
    }

    // Check how much audio is already scheduled ahead of current playback position
    const runway = nextPlayTimeRef.current - ctx.currentTime;
    if (runway < 0.1) {
      // Low runway (< 100ms) — flush immediately to prevent underrun/gaps
      flushAudioQueue();
    } else {
      // Plenty of runway — batch nearby chunks for efficiency
      playbackTimerRef.current = setTimeout(() => {
        playbackTimerRef.current = null;
        flushAudioQueue();
      }, 40);
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      console.log(`[Messages] ${messages.length} messages, last: ${last.role} "${last.text.substring(0, 80)}${last.text.length > 80 ? '...' : ''}"`);
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Debug: Log when event stream connection changes
  useEffect(() => {
    console.log('[EventStream] Status changed:', status, 'micPermissionGranted:', micPermissionGranted);
  }, [status, micPermissionGranted]);

  useEffect(() => {
    // Only cleanup on unmount or when explicitly disconnecting
    // Don't cleanup on every status change - this was causing AudioContext to close
    return () => {
      // This cleanup only runs on component unmount
      // For normal disconnect, use the disconnect() function
      console.log('[Cleanup] Component unmounting, cleaning up audio resources');
      if (audioProcessorRef.current) {
        audioProcessorRef.current.disconnect();
        audioProcessorRef.current = null;
      }
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      // Clean up playback scheduling resources
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      for (const src of activeSourcesRef.current) {
        try { src.stop(); src.disconnect(); } catch {}
      }
      activeSourcesRef.current = [];
      // Don't close AudioContext on unmount - let browser handle it
      // Closing and recreating causes issues
    };
  }, []); // Empty deps - only run on mount/unmount

  return (
    <div className="flex flex-col items-center justify-center min-h-screen max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">AWS Nova 2 Sonic Voice Test</h1>

      {/* Status and Controls */}
      <div className="w-full mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                status === 'connected'
                  ? 'bg-green-500'
                  : status === 'connecting' || status === 'requesting_mic'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
            />
            <span className="font-semibold">
              {status === 'connected'
                ? micPermissionGranted && isRecording
                  ? 'Recording...'
                  : 'Connected'
                : status === 'connecting'
                  ? 'Connecting...'
                  : status === 'requesting_mic'
                    ? 'Requesting microphone access...'
                    : 'Disconnected'}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={clearChat}
              disabled={messages.length === 0}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded"
              title="Clear chat history"
            >
              Clear Chat
            </button>
            {status === 'connected' ? (
              <button
                onClick={disconnect}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={connect}
                disabled={status === 'connecting' || status === 'requesting_mic'}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded"
              >
                Connect
              </button>
            )}
          </div>
        </div>

        {/* Configuration Controls */}
        <div className="w-full mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Voice Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Speaker Selection */}
            <div>
              <label htmlFor="speaker-select" className="block text-sm font-medium mb-2">
                Voice Speaker
              </label>
              <select
                id="speaker-select"
                value={selectedSpeaker}
                onChange={(e) => handleSpeakerChange(e.target.value)}
                disabled={status === 'connected'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <optgroup label="Polyglot Voices (All Languages)">
                  <option value="tiffany">Tiffany (English US, Feminine, Polyglot)</option>
                  <option value="matthew">Matthew (English US, Masculine, Polyglot)</option>
                </optgroup>
                <optgroup label="English Variants">
                  <option value="amy">Amy (English UK, Feminine)</option>
                  <option value="olivia">Olivia (English Australia, Feminine)</option>
                  <option value="kiara">Kiara (English Indian / Hindi, Feminine)</option>
                  <option value="arjun">Arjun (English Indian / Hindi, Masculine)</option>
                </optgroup>
                <optgroup label="Other Languages">
                  <option value="ambre">Ambre (French, Feminine)</option>
                  <option value="florian">Florian (French, Masculine)</option>
                  <option value="beatrice">Beatrice (Italian, Feminine)</option>
                  <option value="lorenzo">Lorenzo (Italian, Masculine)</option>
                  <option value="tina">Tina (German, Feminine)</option>
                  <option value="lennart">Lennart (German, Masculine)</option>
                  <option value="lupe">Lupe (Spanish US, Feminine)</option>
                  <option value="carlos">Carlos (Spanish US, Masculine)</option>
                  <option value="carolina">Carolina (Portuguese, Feminine)</option>
                  <option value="leo">Leo (Portuguese, Masculine)</option>
                </optgroup>
              </select>
              {status === 'connected' && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  Disconnect to change speaker
                </p>
              )}
            </div>

            {/* Sensitivity Control */}
            <div>
              <label htmlFor="sensitivity-select" className="block text-sm font-medium mb-2">
                Endpointing Sensitivity
              </label>
              <select
                id="sensitivity-select"
                value={endpointingSensitivity}
                onChange={(e) => handleSensitivityChange(e.target.value as 'HIGH' | 'MEDIUM' | 'LOW')}
                disabled={status === 'connected'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="HIGH">HIGH - Fastest (1.5s pause) - Quick Q&A, command-and-control</option>
                <option value="MEDIUM">MEDIUM - Balanced (1.75s pause) - General conversations, customer service</option>
                <option value="LOW">LOW - Slowest (2s pause) - Thoughtful conversations, complex problem-solving</option>
              </select>
              {status === 'connected' && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  Disconnect to change sensitivity
                </p>
              )}
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                Controls how quickly the AI detects the end of your speech and begins responding.
                Higher sensitivity = faster responses but may interrupt pauses. Lower sensitivity = more patient but slower responses.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded">
            {error}
          </div>
        )}

        {/* Microphone Status */}
        {status === 'connected' && (
          <div className="mb-4">
            {micPermissionGranted ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
                <span>Microphone active - Speak naturally</span>
                {isRecording && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Recording
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                </svg>
                <span>Waiting for microphone access...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages Container with Scrollbar */}
      <div className="w-full mb-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900" style={{ height: '500px' }}>
        <div className="h-full overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              {status === 'connected'
                ? micPermissionGranted
                  ? isRecording
                    ? 'Microphone is active. Start speaking to begin the conversation.'
                    : 'Microphone ready. Waiting for audio input...'
                  : 'Requesting microphone access...'
                : 'Click "Connect" to start'}
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`p-4 rounded ${
                  message.role === 'user'
                    ? 'bg-blue-100 dark:bg-blue-900 ml-auto max-w-[80%]'
                    : 'bg-gray-100 dark:bg-gray-800 mr-auto max-w-[80%]'
                }`}
              >
                <div className="font-semibold mb-1">
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </div>
                <div className="whitespace-pre-wrap break-words">{message.text}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}

