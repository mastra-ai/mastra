import type { JobContext, voice } from '@livekit/agents';
import { ParticipantInfo_Kind } from '@livekit/protocol';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export interface DtmfToolOptions {
  /** The native room for this call. Create a separate tool instance for each call. */
  room: JobContext['room'];
  /** The session that owns the call. Speculative generation must be disabled. */
  session: voice.AgentSession;
  /** Expected SIP caller. The callback supports workers that dial after constructing the tool. */
  participantIdentity: string | (() => string | undefined);
  id?: string;
  description?: string;
}

const digitsSchema = z
  .string()
  .min(1)
  .regex(/^[0-9*#A-D]+$/, 'Use DTMF digits 0-9, *, #, or A-D');
const configSchema = z.object({
  id: z.string().min(1).optional(),
  participantIdentity: z.union([z.string().min(1), z.custom<() => string | undefined>(v => typeof v === 'function')]),
});

/**
 * A Mastra tool bound to one native LiveKit call. Each character is published with
 * LocalParticipant.publishDtmf, in order. Success confirms publishing, not IVR acceptance.
 * No timers, retries, audio synthesis, or menu state are added.
 */
export function createDtmfTool(options: DtmfToolOptions) {
  configSchema.parse(options);
  let publishing = false;
  return createTool({
    id: options.id ?? 'sendDtmf',
    description:
      options.description ??
      'Press telephone keypad digits to navigate an automated phone menu. Pass digits such as "1" or "123#". ' +
        'Use only after hearing the menu prompt. After publishing, stay silent and listen for the next prompt. ' +
        'Publishing does not confirm that the menu accepted the input. Do not automatically repeat failed or partial sequences.',
    inputSchema: z.object({ digits: digitsSchema }),
    outputSchema: z.object({ published: z.string(), complete: z.boolean(), error: z.string().optional() }),
    execute: async ({ digits }, context) => {
      let published = '';
      if (publishing) return { published, complete: false, error: 'Another DTMF sequence is still publishing' };
      publishing = true;
      try {
        for (const digit of digits) {
          context?.abortSignal?.throwIfAborted();
          const { room, session } = options;
          if (session.sessionOptions.turnHandling.preemptiveGeneration.enabled) {
            throw new Error('Disable preemptive generation before using DTMF');
          }
          if (session.agentState === 'initializing' || !room.isConnected || !room.localParticipant) {
            throw new Error('The voice session is not active');
          }
          const identity =
            typeof options.participantIdentity === 'function'
              ? options.participantIdentity()
              : options.participantIdentity;
          const callers = [...room.remoteParticipants.values()].filter(
            p => Number(p.kind) === ParticipantInfo_Kind.SIP,
          );
          // Native DTMF broadcasts to the room, not a destination identity. Never select one
          // caller in a shared SIP room and imply that only that caller will receive the tones.
          if (callers.length !== 1 || !identity || callers[0]?.identity !== identity) {
            throw new Error('DTMF requires a dedicated room containing only the expected SIP caller');
          }
          await room.localParticipant.publishDtmf('0123456789*#ABCD'.indexOf(digit), digit);
          published += digit;
        }
        return { published, complete: true };
      } catch (error) {
        return { published, complete: false, error: error instanceof Error ? error.message : String(error) };
      } finally {
        publishing = false;
      }
    },
  });
}
