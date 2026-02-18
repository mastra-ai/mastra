import type { AwsCredentialIdentity } from '@smithy/types';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { NovaSonicError } from './errors';
import { NovaSonicErrorCode } from '../types';

/**
 * Get AWS credentials from various sources
 */
export async function getAwsCredentials(
  explicitCredentials?: AwsCredentialIdentity,
): Promise<AwsCredentialIdentity> {
  if (explicitCredentials) {
    console.log('[getAwsCredentials] Using explicit credentials provided in config');
    console.log('[getAwsCredentials] Credentials structure:', {
      hasAccessKeyId: !!explicitCredentials.accessKeyId,
      hasSecretAccessKey: !!explicitCredentials.secretAccessKey,
      hasSessionToken: !!explicitCredentials.sessionToken,
      accessKeyIdPrefix: explicitCredentials.accessKeyId ? `${explicitCredentials.accessKeyId.substring(0, 4)}...` : 'missing',
      secretAccessKeyPrefix: explicitCredentials.secretAccessKey ? `${explicitCredentials.secretAccessKey.substring(0, 4)}...` : 'missing',
    });
    return explicitCredentials;
  }

  // Use default credential provider chain
  // This will check:
  // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
  // 2. Shared credentials file (~/.aws/credentials)
  // 3. IAM roles (for EC2/Lambda)
  // 4. ECS task roles
  // 5. Other credential sources
  try {
    console.log('[getAwsCredentials] Using default credential provider chain');
    console.log('[getAwsCredentials] Checking environment variables...');
    const envAccessKey = process.env.AWS_ACCESS_KEY_ID;
    const envSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
    const envSessionToken = process.env.AWS_SESSION_TOKEN;
    console.log('[getAwsCredentials] Environment variables:', {
      hasAWS_ACCESS_KEY_ID: !!envAccessKey,
      hasAWS_SECRET_ACCESS_KEY: !!envSecretKey,
      hasAWS_SESSION_TOKEN: !!envSessionToken,
      accessKeyIdPrefix: envAccessKey ? `${envAccessKey.substring(0, 4)}...` : 'missing',
      secretAccessKeyPrefix: envSecretKey ? `${envSecretKey.substring(0, 4)}...` : 'missing',
    });
    
    const credentials = await defaultProvider()();
    if (!credentials) {
      throw new NovaSonicError(
        NovaSonicErrorCode.CREDENTIALS_MISSING,
        'AWS credentials not found. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables, or configure AWS credentials.',
      );
    }
    
    console.log('[getAwsCredentials] Credentials retrieved successfully:', {
      hasAccessKeyId: !!credentials.accessKeyId,
      hasSecretAccessKey: !!credentials.secretAccessKey,
      hasSessionToken: !!credentials.sessionToken,
      accessKeyIdPrefix: credentials.accessKeyId ? `${credentials.accessKeyId.substring(0, 4)}...` : 'missing',
      secretAccessKeyPrefix: credentials.secretAccessKey ? `${credentials.secretAccessKey.substring(0, 4)}...` : 'missing',
      expiration: credentials.expiration ? credentials.expiration.toISOString() : 'no expiration',
    });
    
    return credentials;
  } catch (error) {
    console.error('[getAwsCredentials] Error loading credentials:', error);
    throw new NovaSonicError(
      NovaSonicErrorCode.AUTHENTICATION_FAILED,
      `Failed to load AWS credentials: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error,
    );
  }
}

