import { GetObjectCommand, HeadObjectCommand, S3Client, S3ServiceException } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { LiveKitRecordingResolverArgs } from '@mastra/livekit';
import { getRecordingStorage } from './livekit';

/** Called only after the server has resolved an authorized trace to its LiveKit room. */
export async function resolveCallRecording({ roomName }: LiveKitRecordingResolverArgs) {
  const storage = getRecordingStorage();
  const client = new S3Client({
    region: storage.RECORDINGS_S3_REGION,
    endpoint: storage.RECORDINGS_S3_ENDPOINT,
    forcePathStyle: Boolean(storage.RECORDINGS_S3_ENDPOINT),
    credentials: {
      accessKeyId: storage.RECORDINGS_S3_ACCESS_KEY,
      secretAccessKey: storage.RECORDINGS_S3_SECRET,
    },
  });
  const object = { Bucket: storage.RECORDINGS_S3_BUCKET, Key: `voice-agent/${roomName}.ogg` };
  try {
    // A missing object may mean the upload is still finishing, or this call was not recorded.
    await client.send(new HeadObjectCommand(object));
    const expiresIn = 15 * 60;
    const url = await getSignedUrl(client, new GetObjectCommand({ ...object, ResponseContentType: 'audio/ogg' }), {
      expiresIn,
    });
    return { url, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() };
  } catch (error) {
    if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) return undefined;
    throw error;
  } finally {
    client.destroy();
  }
}
