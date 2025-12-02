import { MeetingTranscriptionEventArgs, SessionEventArgs } from "../Exports.js";
import { MeetingTranscriptionCanceledEventArgs } from "./Exports.js";
import { Callback, IMeeting } from "./IMeeting.js";
export interface MeetingHandler {
    /**
     * Defines event handler for session started events.
     */
    sessionStarted: (sender: MeetingHandler, event: SessionEventArgs) => void;
    /**
     * Defines event handler for session stopped events.
     */
    sessionStopped: (sender: MeetingHandler, event: SessionEventArgs) => void;
    /**
     * Event that signals an error with the meeting transcription, or the end of the audio stream has been reached.
     */
    canceled: (sender: MeetingHandler, event: MeetingTranscriptionCanceledEventArgs) => void;
    /**
     * Leave the current meeting. After this is called, you will no longer receive any events.
     */
    leaveMeetingAsync(cb?: Callback, err?: Callback): void;
    /**
     * Starts sending audio to the transcription service for speech recognition and translation. You
     * should subscribe to the Transcribing, and Transcribed events to receive results.
     */
    startTranscribingAsync(cb?: Callback, err?: Callback): void;
    /**
     * Stops sending audio to the transcription service. You will still receive Transcribing, and
     * and Transcribed events for other participants in the meeting.
     */
    stopTranscribingAsync(cb?: Callback, err?: Callback): void;
}
/**
 * A meeting transcriber that enables a connected experience where meetings can be
 * transcribed with each participant recognized.
 */
export interface MeetingTranscriptionHandler extends MeetingHandler {
    /**
     * The event recognized signals that a final meeting transcription result is received.
     */
    transcribed: (sender: MeetingTranscriptionHandler, event: MeetingTranscriptionEventArgs) => void;
    /**
     * The event recognizing signals that an intermediate meeting transcription result is received.
     */
    transcribing: (sender: MeetingTranscriptionHandler, event: MeetingTranscriptionEventArgs) => void;
    /**
     * Joins an existing meeting.
     * @param meeting The meeting to join.
     */
    joinMeetingAsync(meeting: IMeeting, cb?: Callback, err?: Callback): void;
}
