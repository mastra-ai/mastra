import { AudioPlayer } from './lib/play/AudioPlayer.js';
import { ChatHistoryManager } from "./lib/util/ChatHistoryManager.js";

// DOM elements
const startButton = document.getElementById('start');
const stopButton = document.getElementById('stop');
const statusElement = document.getElementById('status');
const chatContainer = document.getElementById('chat-container');

// Chat history management
let chat = { history: [] };
const chatRef = { current: chat };
const chatHistoryManager = ChatHistoryManager.getInstance(
    chatRef,
    (newChat) => {
        chat = { ...newChat };
        chatRef.current = chat;
        updateChatUI();
    }
);

// Audio processing variables
let audioContext;
let audioStream;
let isStreaming = false;
let processor;
let sourceNode;
let waitingForAssistantResponse = false;
let waitingForUserTranscription = false;
let userThinkingIndicator = null;
let assistantThinkingIndicator = null;
let transcriptionReceived = false;
let displayAssistantText = false;
let role;
const audioPlayer = new AudioPlayer();
let sessionInitialized = false;
let manualDisconnect = false;
let eventSource = null;

let samplingRatio = 1;
const TARGET_SAMPLE_RATE = 16000; 
const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');

// Silence detection variables
let silenceStartTime = null;
let hasSentContentEnd = false;
let isWaitingForResponse = false; // Track if we're waiting for assistant response
let hasSentAudioChunks = false; // Track if we've sent any audio chunks in the current turn
const SILENCE_THRESHOLD = 0.01; // Amplitude threshold for silence
const SILENCE_DURATION_MS = 1500; // 1.5 seconds of silence to trigger end

// Custom system prompt - you can modify this
let SYSTEM_PROMPT = "You are a friend. The user and you will engage in a spoken " +
    "dialog exchanging the transcripts of a natural real-time conversation. Keep your responses short, " +
    "generally two or three sentences for chatty scenarios.";

// Initialize WebSocket audio
async function initAudio() {
    try {
        statusElement.textContent = "Requesting microphone access...";
        statusElement.className = "connecting";

        // Request microphone access
        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        if (isFirefox) {
            //firefox doesn't allow audio context have differnt sample rate than what the user media device offers
            audioContext = new AudioContext();
        } else {
            audioContext = new AudioContext({
                sampleRate: TARGET_SAMPLE_RATE
            });
        }

        //samplingRatio - is only relevant for firefox, for Chromium based browsers, it's always 1
        samplingRatio = audioContext.sampleRate / TARGET_SAMPLE_RATE;
        console.log(`Debug AudioContext- sampleRate: ${audioContext.sampleRate} samplingRatio: ${samplingRatio}`)
        

        await audioPlayer.start();

        statusElement.textContent = "Microphone ready. Click Start to begin.";
        statusElement.className = "ready";
        startButton.disabled = false;
    } catch (error) {
        console.error("Error accessing microphone:", error);
        statusElement.textContent = "Error: " + error.message;
        statusElement.className = "error";
    }
}

// Initialize the session with Bedrock
async function initializeSession() {
    if (sessionInitialized) return;

    statusElement.textContent = "Initializing session...";

    try {
        // Connect to voice service
        const response = await fetch('/api/voice/connect', {
            method: 'POST',
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || 'Connection failed');
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Connection failed');
        }

        // Set up SSE connection for events
        setupEventSource();

        // Mark session as initialized
        sessionInitialized = true;
        statusElement.textContent = "Session initialized successfully";
    } catch (error) {
        console.error("Failed to initialize session:", error);
        statusElement.textContent = "Error initializing session";
        statusElement.className = "error";
        throw error;
    }
}

// Set up Server-Sent Events connection
function setupEventSource() {
    // Close existing connection if any
    if (eventSource) {
        eventSource.close();
    }

    eventSource = new EventSource('/api/voice/events');

    eventSource.onopen = () => {
        console.log('SSE connection opened');
        statusElement.textContent = "Connected to server";
        statusElement.className = "connected";
    };

    eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        if (eventSource.readyState === EventSource.CLOSED) {
            statusElement.textContent = "Disconnected from server";
            statusElement.className = "disconnected";
            if (!manualDisconnect) {
                startButton.disabled = true;
                stopButton.disabled = true;
            }
        }
    };

    // Handle incoming events
    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('[SSE] Received event:', data.type, data);
            handleServerEvent(data);
        } catch (error) {
            console.error('Error parsing SSE event:', error);
        }
    };
}

// Handle server events from SSE
function handleServerEvent(data) {
    switch (data.type) {
        case 'text':
            if (data.data.role === 'user') {
                handleTextOutput({ role: 'USER', content: data.data.text });
                showAssistantThinkingIndicator();
            } else if (data.data.role === 'assistant') {
                handleTextOutput({ role: 'ASSISTANT', content: data.data.text });
            }
            break;
        case 'audio':
            if (data.data.audio && data.data.audio.length > 0) {
                // Assistant is responding - we're no longer waiting, but don't reset flags yet
                // (they'll be reset on turnComplete)
                // IMPORTANT: Set isWaitingForResponse to false to allow barge-in (user interruption)
                // But keep hasSentContentEnd true to prevent sending contentEnd again
                if (isWaitingForResponse) {
                    console.log('[Event] Audio received - setting isWaitingForResponse=false to allow barge-in');
                }
                isWaitingForResponse = false; // Allow audio processing to continue (for barge-in)
                
                // Convert array back to base64 or use directly
                let audioBase64;
                if (data.data.isBase64) {
                    audioBase64 = data.data.audio;
                } else {
                    // Convert array to base64
                    const bytes = new Uint8Array(data.data.audio);
                    const binary = String.fromCharCode.apply(null, bytes);
                    audioBase64 = btoa(binary);
                }
                const audioData = base64ToFloat32Array(audioBase64);
                audioPlayer.playAudio(audioData);
            }
            break;
        case 'contentEnd':
            // Handle contentEnd events like AWS sample does
            console.log('[Event] contentEnd received:', data.data);
            const contentEndData = data.data;
            
            if (contentEndData.type === 'TEXT') {
                // Handle stop reasons
                if (contentEndData.stopReason && contentEndData.stopReason.toUpperCase() === 'END_TURN') {
                    console.log('[Event] contentEnd (TEXT) with END_TURN - ending turn');
                    chatHistoryManager.endTurn();
                    // Reset silence detection for next turn
                    silenceStartTime = null;
                    hasSentContentEnd = false;
                    isWaitingForResponse = false; // Ready for next user input
                    console.log('[Event] Turn complete, ready for next user input. Flags reset');
                } else if (contentEndData.stopReason && contentEndData.stopReason.toUpperCase() === 'INTERRUPTED') {
                    console.log("Interrupted by user");
                    audioPlayer.bargeIn();
                    // Reset flags on interruption - user can speak again
                    silenceStartTime = null;
                    hasSentContentEnd = false;
                    isWaitingForResponse = false;
                    hasSentAudioChunks = false; // Reset - user can speak again
                }
                // Note: PARTIAL_TURN doesn't signal turn completion - wait for completionEnd/turnComplete
            } else if (contentEndData.type === 'AUDIO') {
                // When audio content ends, check if it's END_TURN
                if (contentEndData.stopReason && contentEndData.stopReason.toUpperCase() === 'END_TURN') {
                    console.log('[Event] contentEnd (AUDIO) with END_TURN - ending turn');
                    chatHistoryManager.endTurn();
                    // Reset silence detection for next turn
                    silenceStartTime = null;
                    hasSentContentEnd = false; // Reset to allow new turn
                    isWaitingForResponse = false; // Ready for next user input
                    console.log('[Event] Turn complete, ready for next user input. Flags reset');
                    console.log('[Event] IMPORTANT: After turn completion, audio chunks should now be sent when user speaks');
                } else {
                    // For PARTIAL_TURN or other stopReasons, this is user input ending
                    // Reset hasSentContentEnd to allow sending contentEnd for the next turn
                    hasSentContentEnd = false;
                    isWaitingForResponse = false;
                    console.log('[Event] contentEnd (AUDIO) - user input ended, stopReason:', contentEndData.stopReason);
                }
            }
            break;
        case 'turnComplete':
            console.log('[Event] turnComplete received - resetting flags for next turn');
            chatHistoryManager.endTurn();
            // Reset silence detection for next turn
            // CRITICAL: Reset silenceStartTime to null so silence detection doesn't immediately trigger
            // This allows the user to take their time before speaking
            silenceStartTime = null;
            hasSentContentEnd = false;
            isWaitingForResponse = false; // Ready for next user input
            hasSentAudioChunks = false; // Reset audio chunks flag - user hasn't spoken yet in new turn
            console.log('[Event] Turn complete, ready for next user input. Flags reset:', {
                silenceStartTime: null,
                hasSentContentEnd: false,
                isWaitingForResponse: false,
                hasSentAudioChunks: false
            });
            break;
        case 'interrupt':
            console.log("Interrupted by user");
            audioPlayer.bargeIn();
            // Reset flags on interruption - user can speak again
            silenceStartTime = null;
            hasSentContentEnd = false;
            isWaitingForResponse = false;
            break;
    }
}

async function startStreaming() {
    if (isStreaming) return;

    try {
        // First, make sure the session is initialized
        if (!sessionInitialized) {
            await initializeSession();
        }

        // Restart audioPlayer if needed
        if (!audioPlayer.initialized) {
            await audioPlayer.start();
        }

        // Create audio processor
        sourceNode = audioContext.createMediaStreamSource(audioStream);

        // Use ScriptProcessorNode for audio processing
        if (audioContext.createScriptProcessor) {
            processor = audioContext.createScriptProcessor(512, 1, 1);

            processor.onaudioprocess = async (e) => {
                if (!isStreaming) return;
                
                // Don't process audio or check silence if we're waiting for a response
                // This prevents sending contentEnd multiple times
                if (isWaitingForResponse) {
                    return;
                }

                const inputData = e.inputBuffer.getChannelData(0);
                const numSamples = Math.round(inputData.length / samplingRatio)
                const pcmData = isFirefox ? (new Int16Array(numSamples)) : (new Int16Array(inputData.length));
                
                // Convert to 16-bit PCM
                if (isFirefox) {                    
                    for (let i = 0; i < inputData.length; i++) {
                        //NOTE: for firefox the samplingRatio is not 1, 
                        // so it will downsample by skipping some input samples
                        // A better approach is to compute the mean of the samplingRatio samples.
                        // or pass through a low-pass filter first 
                        // But skipping is a preferable low-latency operation
                        pcmData[i] = Math.max(-1, Math.min(1, inputData[i * samplingRatio])) * 0x7FFF;
                    }
                } else {
                    for (let i = 0; i < inputData.length; i++) {
                        pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
                    }
                }
                
                // Calculate RMS (Root Mean Square) amplitude for silence detection
                let sumSquares = 0;
                for (let i = 0; i < inputData.length; i++) {
                    sumSquares += inputData[i] * inputData[i];
                }
                const rms = Math.sqrt(sumSquares / inputData.length);
                const isSilent = rms < SILENCE_THRESHOLD;

                // Convert to base64 (browser-safe way)
                const base64Data = arrayBufferToBase64(pcmData.buffer);

                // Send to server (fire and forget for chunks)
                // Only send if not waiting for response (to avoid sending during assistant response)
                if (!isWaitingForResponse) {
                    // Log occasionally to verify chunks are being sent after first turn
                    // Increase logging frequency to 10% to better debug the issue
                    if (Math.random() < 0.1) { // Log 10% of chunks to better debug
                        console.log('[Audio] Sending audio chunk to server, hasSentContentEnd:', hasSentContentEnd, 'isWaitingForResponse:', isWaitingForResponse);
                    }
                    fetch('/api/voice/send', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            audio: base64Data,
                            chunk: true
                        })
                    }).catch(error => {
                        console.error('Error sending audio chunk:', error);
                    });
                } else {
                    // Log when audio chunks are being blocked - increase frequency to 10%
                    if (Math.random() < 0.1) { // Log 10% of blocked chunks to better debug
                        console.log('[Audio] Audio chunk blocked - waiting for response, isWaitingForResponse:', isWaitingForResponse, 'hasSentContentEnd:', hasSentContentEnd);
                    }
                }

                // Silence detection: if silent for SILENCE_DURATION_MS, send contentEnd
                // CRITICAL: Only check silence if we've actually sent audio chunks in this turn
                // This prevents sending contentEnd if the user hasn't started speaking yet
                if (!hasSentContentEnd && hasSentAudioChunks) {
                    if (isSilent) {
                        if (silenceStartTime === null) {
                            silenceStartTime = Date.now();
                        } else {
                            const silenceDuration = Date.now() - silenceStartTime;
                            if (silenceDuration >= SILENCE_DURATION_MS) {
                                // User has been silent for long enough - end audio input
                                console.log(`[Silence] Detected ${silenceDuration}ms of silence, ending audio input`);
                                console.log(`[Silence] Current flags: hasSentContentEnd=${hasSentContentEnd}, isWaitingForResponse=${isWaitingForResponse}, hasSentAudioChunks=${hasSentAudioChunks}`);
                                hasSentContentEnd = true; // Prevent multiple sends
                                isWaitingForResponse = true; // Stop processing audio until response
                                
                                // Send contentEnd to server (fire and forget)
                                fetch('/api/voice/end-audio', {
                                    method: 'POST',
                                }).then((response) => {
                                    console.log('[Silence] contentEnd sent successfully, response status:', response.status);
                                    return response.json();
                                }).then((data) => {
                                    console.log('[Silence] contentEnd response:', data);
                                }).catch(error => {
                                    console.error('Error ending audio:', error);
                                    // Reset flags on error so we can retry
                                    hasSentContentEnd = false;
                                    isWaitingForResponse = false;
                                });
                                
                                // Stop processing - don't check silence anymore
                                return;
                            }
                        }
                    } else {
                        // User is speaking - reset silence timer
                        silenceStartTime = null;
                    }
                }
            };

            sourceNode.connect(processor);
            processor.connect(audioContext.destination);
        }

        isStreaming = true;
        startButton.disabled = true;
        stopButton.disabled = false;
        statusElement.textContent = "Streaming... Speak now";
        statusElement.className = "recording";

        // Show user thinking indicator when starting to record
        transcriptionReceived = false;
        showUserThinkingIndicator();

    } catch (error) {
        console.error("Error starting recording:", error);
        statusElement.textContent = "Error: " + error.message;
        statusElement.className = "error";
    }
}

// Convert ArrayBuffer to base64 string
function arrayBufferToBase64(buffer) {
    const binary = [];
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary.push(String.fromCharCode(bytes[i]));
    }
    return btoa(binary.join(''));
}

async function stopStreaming() {
    if (!isStreaming) return;

    isStreaming = false;

    // Clean up audio processing
    if (processor) {
        processor.disconnect();
        sourceNode.disconnect();
    }

    startButton.disabled = false;
    stopButton.disabled = true;
    statusElement.textContent = "Processing...";
    statusElement.className = "processing";

    audioPlayer.bargeIn();
    
    // Tell server to finalize processing
    try {
        await fetch('/api/voice/end-audio', {
            method: 'POST',
        });
    } catch (error) {
        console.error('Error ending audio:', error);
    }

    // End the current turn in chat history
    chatHistoryManager.endTurn();

    // Reset session for new connection
    sessionInitialized = false;
    
    // Mark as manual disconnect
    manualDisconnect = true;
    
    // Close SSE connection
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    
    statusElement.textContent = "Stopped. Click Start to begin new session.";
    statusElement.className = "ready";
    manualDisconnect = false;
}

// Base64 to Float32Array conversion
function base64ToFloat32Array(base64String) {
    try {
        const binaryString = window.atob(base64String);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const int16Array = new Int16Array(bytes.buffer);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768.0;
        }

        return float32Array;
    } catch (error) {
        console.error('Error in base64ToFloat32Array:', error);
        throw error;
    }
}

// Process message data and add to chat history
function handleTextOutput(data) {
    console.log("Processing text output:", data);
    if (data.content) {
        const messageData = {
            role: data.role,
            message: data.content
        };
        chatHistoryManager.addTextMessage(messageData);
    }
}

// Update the UI based on the current chat history
function updateChatUI() {
    if (!chatContainer) {
        console.error("Chat container not found");
        return;
    }

    // Clear existing chat messages
    chatContainer.innerHTML = '';

    // Add all messages from history
    chat.history.forEach(item => {
        if (item.endOfConversation) {
            const endDiv = document.createElement('div');
            endDiv.className = 'message system';
            endDiv.textContent = "Conversation ended";
            chatContainer.appendChild(endDiv);
            return;
        }

        if (item.role) {
            const messageDiv = document.createElement('div');
            const roleLowerCase = item.role.toLowerCase();
            messageDiv.className = `message ${roleLowerCase}`;

            const roleLabel = document.createElement('div');
            roleLabel.className = 'role-label';
            roleLabel.textContent = item.role;
            messageDiv.appendChild(roleLabel);

            const content = document.createElement('div');
            content.textContent = item.message || "No content";
            messageDiv.appendChild(content);

            chatContainer.appendChild(messageDiv);
        }
    });

    // Re-add thinking indicators if we're still waiting
    if (waitingForUserTranscription) {
        showUserThinkingIndicator();
    }

    if (waitingForAssistantResponse) {
        showAssistantThinkingIndicator();
    }

    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Show the "Listening" indicator for user
function showUserThinkingIndicator() {
    hideUserThinkingIndicator();

    waitingForUserTranscription = true;
    userThinkingIndicator = document.createElement('div');
    userThinkingIndicator.className = 'message user thinking';

    const roleLabel = document.createElement('div');
    roleLabel.className = 'role-label';
    roleLabel.textContent = 'USER';
    userThinkingIndicator.appendChild(roleLabel);

    const listeningText = document.createElement('div');
    listeningText.className = 'thinking-text';
    listeningText.textContent = 'Listening';
    userThinkingIndicator.appendChild(listeningText);

    const dotContainer = document.createElement('div');
    dotContainer.className = 'thinking-dots';

    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dotContainer.appendChild(dot);
    }

    userThinkingIndicator.appendChild(dotContainer);
    chatContainer.appendChild(userThinkingIndicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Show the "Thinking" indicator for assistant
function showAssistantThinkingIndicator() {
    hideAssistantThinkingIndicator();

    waitingForAssistantResponse = true;
    assistantThinkingIndicator = document.createElement('div');
    assistantThinkingIndicator.className = 'message assistant thinking';

    const roleLabel = document.createElement('div');
    roleLabel.className = 'role-label';
    roleLabel.textContent = 'ASSISTANT';
    assistantThinkingIndicator.appendChild(roleLabel);

    const thinkingText = document.createElement('div');
    thinkingText.className = 'thinking-text';
    thinkingText.textContent = 'Thinking';
    assistantThinkingIndicator.appendChild(thinkingText);

    const dotContainer = document.createElement('div');
    dotContainer.className = 'thinking-dots';

    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dotContainer.appendChild(dot);
    }

    assistantThinkingIndicator.appendChild(dotContainer);
    chatContainer.appendChild(assistantThinkingIndicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Hide the user thinking indicator
function hideUserThinkingIndicator() {
    waitingForUserTranscription = false;
    if (userThinkingIndicator && userThinkingIndicator.parentNode) {
        userThinkingIndicator.parentNode.removeChild(userThinkingIndicator);
    }
    userThinkingIndicator = null;
}

// Hide the assistant thinking indicator
function hideAssistantThinkingIndicator() {
    waitingForAssistantResponse = false;
    if (assistantThinkingIndicator && assistantThinkingIndicator.parentNode) {
        assistantThinkingIndicator.parentNode.removeChild(assistantThinkingIndicator);
    }
    assistantThinkingIndicator = null;
}

// Button event listeners
startButton.addEventListener('click', startStreaming);
stopButton.addEventListener('click', stopStreaming);

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', initAudio);

