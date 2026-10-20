import type { JobContext } from '@livekit/agents';
import { ParticipantInfo_Kind } from '@livekit/protocol';
import type { CreateSipParticipantOptions, RoomServiceClient, SipClient } from 'livekit-server-sdk';
import { z } from 'zod';
import type { LiveKitSessionMetadata } from './metadata';

type RemoteParticipant = Awaited<ReturnType<JobContext['waitForParticipant']>>;

export interface LiveKitTelephonyContext {
  ctx: JobContext;
  metadata: LiveKitSessionMetadata;
}

interface TelephonyCleanupOptions {
  /**
   * Delete this job's room if setup fails. Supply only for dedicated, single-call rooms.
   * Uses this client's native deleteRoom API; failures are logged without replacing the setup error.
   * Omit to retain the room. The job is shut down on setup failure in either case.
   */
  deleteRoomOnFailure?: Pick<RoomServiceClient, 'deleteRoom'>;
}

export interface LiveKitInboundCallOptions extends TelephonyCleanupOptions {
  direction: 'inbound';
  /** Native participant identity to wait for. Omit only in a room dedicated to one SIP caller. */
  participantIdentity?: string;
  /**
   * Resolve routing and memory from native participant data before selecting the Mastra agent.
   * Returns the complete metadata, not a patch. Throw to reject the call.
   * Caller-ID attributes are not authenticated customer identity.
   */
  resolveMetadata?: (
    args: LiveKitTelephonyContext & { participant: RemoteParticipant },
  ) => LiveKitSessionMetadata | Promise<LiveKitSessionMetadata>;
}

export interface LiveKitOutboundCallOptions extends TelephonyCleanupOptions {
  direction: 'outbound';
  /** Native client for the same LiveKit project as the worker's job. */
  sipClient: Pick<SipClient, 'createSipParticipant'>;
  sipTrunkId: string;
  phoneNumber: string;
  /** Native options, in native units. Answer waiting is always enabled by the adapter. */
  participantOptions?: Omit<CreateSipParticipantOptions, 'waitUntilAnswered'>;
  /** Native inline trunk configuration. Use an empty sipTrunkId and set fromNumber when supplied. */
  outboundTrunkConfig?: Parameters<SipClient['createSipParticipant']>[4];
}

export type LiveKitTelephonyOptions = LiveKitInboundCallOptions | LiveKitOutboundCallOptions;

/** Return undefined for ordinary browser sessions. Called once, before any dialing. */
export type LiveKitTelephonyResolver = (
  args: LiveKitTelephonyContext,
) => LiveKitTelephonyOptions | undefined | Promise<LiveKitTelephonyOptions | undefined>;

const nonempty = z.string().refine(value => value.trim().length > 0, 'Expected a nonempty string');
const seconds = z.number().finite().int().positive();
const cleanup = z
  .custom<RoomServiceClient>(
    value =>
      value !== null && typeof value === 'object' && 'deleteRoom' in value && typeof value.deleteRoom === 'function',
    'Expected a LiveKit RoomServiceClient',
  )
  .optional();

// Validate adapter invariants before dialing or waiting for a caller. The SDK remains responsible for the rest of
// the native options and service limits; passthrough retains options added by compatible SDKs.
const telephonySchema = z.union([
  z
    .object({
      direction: z.literal('inbound'),
      participantIdentity: nonempty.optional(),
      resolveMetadata: z
        .custom<LiveKitInboundCallOptions['resolveMetadata']>(value => typeof value === 'function')
        .optional(),
      deleteRoomOnFailure: cleanup,
    })
    .passthrough(),
  z
    .object({
      direction: z.literal('outbound'),
      sipClient: z.custom<SipClient>(
        value =>
          value !== null &&
          typeof value === 'object' &&
          'createSipParticipant' in value &&
          typeof value.createSipParticipant === 'function',
        'Expected a LiveKit SipClient',
      ),
      sipTrunkId: z.string(),
      phoneNumber: nonempty,
      participantOptions: z
        .object({
          participantIdentity: nonempty.optional(),
          fromNumber: nonempty.optional(),
          ringingTimeout: seconds.optional(),
          maxCallDuration: seconds.optional(),
          timeout: z.number().finite().positive().optional(),
          // Reject a JS caller attempting to disable the ordering guarantee.
          waitUntilAnswered: z.literal(true).optional(),
        })
        .passthrough()
        .optional(),
      outboundTrunkConfig: z.object({ hostname: nonempty }).passthrough().optional(),
      deleteRoomOnFailure: cleanup,
    })
    .passthrough()
    .refine(value => Boolean(value.sipTrunkId.trim()) || Boolean(value.outboundTrunkConfig), {
      message: 'Provide sipTrunkId or native outboundTrunkConfig',
      path: ['sipTrunkId'],
    })
    .refine(value => !value.outboundTrunkConfig || Boolean(value.participantOptions?.fromNumber), {
      message: 'Inline trunk configuration requires participantOptions.fromNumber',
      path: ['participantOptions', 'fromNumber'],
    }),
]);

const setupSchema = z
  .object({
    telephony: telephonySchema,
    inputIdentity: z.string().optional(),
  })
  .refine(
    ({ telephony, inputIdentity }) => {
      const identity =
        telephony.direction === 'inbound'
          ? telephony.participantIdentity
          : (telephony.participantOptions?.participantIdentity ?? 'sip-participant');
      return !inputIdentity || !identity || inputIdentity === identity;
    },
    {
      message: '@mastra/livekit: telephony participant identity conflicts with inputOptions.participantIdentity',
      path: ['inputIdentity'],
    },
  );

export function validateTelephony(options: LiveKitTelephonyOptions, inputIdentity?: string): void {
  setupSchema.parse({ telephony: options, inputIdentity });
}

export async function resolveInboundParticipant(ctx: JobContext, identity?: string): Promise<RemoteParticipant> {
  const participant = await ctx.waitForParticipant(identity);
  if (Number(participant.kind) !== ParticipantInfo_Kind.SIP) {
    throw new Error('@mastra/livekit: inbound telephony requires a SIP participant');
  }
  return participant;
}

export async function dialSipParticipant(options: LiveKitOutboundCallOptions, roomName: string) {
  // LiveKit sizes its request timeout to outlast ringing. Copy because it mutates these options.
  return options.sipClient.createSipParticipant(
    options.sipTrunkId,
    options.phoneNumber,
    roomName,
    {
      ...options.participantOptions,
      waitUntilAnswered: true,
    },
    options.outboundTrunkConfig,
  );
}

export async function cleanupTelephonySetup(
  options: LiveKitTelephonyOptions | undefined,
  ctx: JobContext,
  logger: { warn: (message: string, ...args: unknown[]) => void },
): Promise<void> {
  const roomName = ctx.room.name ?? ctx.job.room?.name;
  if (options?.deleteRoomOnFailure && roomName) {
    try {
      await options.deleteRoomOnFailure.deleteRoom(roomName);
    } catch (error) {
      logger.warn('@mastra/livekit: failed to delete the room after telephony setup failed', error);
    }
  }
  try {
    ctx.shutdown('telephony setup failed');
  } catch (error) {
    logger.warn('@mastra/livekit: failed to shut down the job after telephony setup failed', error);
  }
}
