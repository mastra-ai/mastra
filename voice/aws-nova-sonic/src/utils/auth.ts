import type { AwsCredentialIdentity } from '@smithy/types';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { NovaSonicError } from './errors';
import { NovaSonicErrorCode } from '../types';

/**
 * Get AWS credentials from various sources
 */
export async function getAwsCredentials(
  explicitCredentials?: AwsCredentialIdentity,
  debug?: boolean,
): Promise<AwsCredentialIdentity> {
  if (explicitCredentials) {
    if (debug) {
      console.log('[getAwsCredentials] Using explicit credentials provided in config');
    }
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
    if (debug) {
      console.log('[getAwsCredentials] Using default credential provider chain');
    }

    const credentials = await defaultProvider()();
    if (!credentials) {
      throw new NovaSonicError(
        NovaSonicErrorCode.CREDENTIALS_MISSING,
        'AWS credentials not found. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables, or configure AWS credentials.',
      );
    }

    if (debug) {
      console.log('[getAwsCredentials] Credentials retrieved successfully');
    }

    return credentials;
  } catch (error) {
    throw new NovaSonicError(
      NovaSonicErrorCode.AUTHENTICATION_FAILED,
      `Failed to load AWS credentials: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error,
    );
  }
}

