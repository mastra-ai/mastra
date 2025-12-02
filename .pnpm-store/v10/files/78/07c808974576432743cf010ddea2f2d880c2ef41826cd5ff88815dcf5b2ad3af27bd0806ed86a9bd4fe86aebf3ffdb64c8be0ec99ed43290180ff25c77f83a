import { Unsubscribe } from "../../../types";

/**
 * Types and interfaces for speech synthesis (text-to-speech) functionality.
 */
export namespace SpeechSynthesisAdapter {
  /**
   * Status of a speech synthesis operation.
   */
  export type Status =
    | {
        /** Speech is starting or currently running */
        type: "starting" | "running";
      }
    | {
        /** Speech has ended */
        type: "ended";
        /** Reason why speech ended */
        reason: "finished" | "cancelled" | "error";
        /** Error details if speech ended due to error */
        error?: unknown;
      };

  /**
   * Represents a single speech utterance with control and status tracking.
   */
  export type Utterance = {
    /** Current status of the utterance */
    status: Status;
    /** Cancel the current speech */
    cancel: () => void;
    /** Subscribe to status changes */
    subscribe: (callback: () => void) => Unsubscribe;
  };
}

/**
 * Interface for text-to-speech functionality.
 *
 * SpeechSynthesisAdapter provides the ability to convert text content
 * into spoken audio, with status tracking and cancellation support.
 *
 * @example
 * ```tsx
 * const speechAdapter: SpeechSynthesisAdapter = {
 *   speak: (text) => {
 *     const utterance = new SpeechSynthesisUtterance(text);
 *     speechSynthesis.speak(utterance);
 *
 *     return {
 *       status: { type: "starting" },
 *       cancel: () => speechSynthesis.cancel(),
 *       subscribe: (callback) => {
 *         utterance.addEventListener('end', callback);
 *         return () => utterance.removeEventListener('end', callback);
 *       }
 *     };
 *   }
 * };
 * ```
 */
export type SpeechSynthesisAdapter = {
  /**
   * Converts text to speech and returns an utterance object for control.
   *
   * @param text - The text content to speak
   * @returns An utterance object with status and control methods
   */
  speak: (text: string) => SpeechSynthesisAdapter.Utterance;
};

export namespace SpeechRecognitionAdapter {
  export type Status =
    | {
        type: "starting" | "running";
      }
    | {
        type: "ended";
        reason: "stopped" | "cancelled" | "error";
      };

  export type Result = {
    transcript: string;
  };

  export type Session = {
    status: Status;
    stop: () => Promise<void>;
    cancel: () => void;
    onSpeechStart: (callback: () => void) => Unsubscribe;
    onSpeechEnd: (callback: (result: Result) => void) => Unsubscribe;
    onSpeech: (callback: (result: Result) => void) => Unsubscribe;
  };
}

export type SpeechRecognitionAdapter = {
  listen: () => SpeechRecognitionAdapter.Session;
};
