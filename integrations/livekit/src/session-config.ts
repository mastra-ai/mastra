import type { voice } from '@livekit/agents';
import { z } from 'zod';

type SessionOptions = voice.AgentSessionOptions;
type TurnHandling = NonNullable<SessionOptions['turnHandling']>;

/** JSON-compatible LiveKit options supported by version 1 of the dispatch contract. */
export type LiveKitSessionOptions = Pick<SessionOptions, 'userAwayTimeout'> & {
  stt?: Extract<SessionOptions['stt'], string>;
  tts?: Extract<SessionOptions['tts'], string>;
  turnHandling?: {
    endpointing?: Pick<NonNullable<TurnHandling['endpointing']>, 'mode' | 'minDelay' | 'maxDelay'>;
    interruption?: Pick<
      NonNullable<TurnHandling['interruption']>,
      | 'enabled'
      | 'mode'
      | 'minDuration'
      | 'minWords'
      | 'discardAudioIfUninterruptible'
      | 'falseInterruptionTimeout'
      | 'resumeFalseInterruption'
    >;
  };
};

/** Optional per-session settings carried in LiveKit job metadata. */
export interface LiveKitSessionConfig {
  version: 1;
  options: LiveKitSessionOptions;
}

const delay = z.number().finite().nonnegative();
const modelString = z.string().refine(value => value.trim().length > 0, 'Expected a LiveKit model string');

/**
 * Validates the supported JSON subset, without importing the LiveKit agents runtime.
 * LiveKit constructs the speech plugins and implements all session behavior.
 * Unknown settings are rejected so a newer sender cannot silently configure an older worker.
 */
export const LiveKitSessionConfigSchema = z
  .object({
    version: z.literal(1),
    options: z
      .object({
        stt: modelString.optional(),
        tts: modelString.optional(),
        userAwayTimeout: delay.nullable().optional(),
        turnHandling: z
          .object({
            endpointing: z
              .object({
                mode: z.enum(['fixed', 'dynamic']).optional(),
                minDelay: delay.optional(),
                maxDelay: delay.optional(),
              })
              .strict()
              .refine(
                value => value.minDelay === undefined || value.maxDelay === undefined || value.minDelay <= value.maxDelay,
                { message: 'maxDelay must be greater than or equal to minDelay', path: ['maxDelay'] },
              )
              .optional(),
            interruption: z
              .object({
                enabled: z.boolean().optional(),
                mode: z.enum(['adaptive', 'vad']).optional(),
                minDuration: delay.optional(),
                minWords: z.number().int().nonnegative().optional(),
                discardAudioIfUninterruptible: z.boolean().optional(),
                falseInterruptionTimeout: delay.optional(),
                resumeFalseInterruption: z.boolean().optional(),
              })
              .strict()
              .optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict() satisfies z.ZodType<LiveKitSessionConfig>;
