import { defaultProvider } from '@aws-sdk/credential-provider-node';
import type { AwsCredentialIdentity } from '@smithy/types';
import { NovaSonicErrorCode } from '../types';
import { NovaSonicError } from './errors';

/**
 * Get AWS credentials from various sources
 */
export async function getAwsCredentials(
  explicitCredentials?: AwsCredentialIdentity,
  debug?: boolean,
): Promise<AwsCredentialIdentity> {
  if (explicitCredentials) {
    if (debug) {
      console.info('[getAwsCredentials] Using explicit credentials provided in config');
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
      console.info('[getAwsCredentials] Using default credential provider chain');
    }

    const credentials = await defaultProvider()();

    if (debug) {
      console.info('[getAwsCredentials] Credentials retrieved successfully');
    }

    return credentials;
  } catch (error) {
    if (error instanceof NovaSonicError) {
      throw error;
    }
    throw new NovaSonicError(
      NovaSonicErrorCode.AUTHENTICATION_FAILED,
      `Failed to load AWS credentials: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error,
    );
  }
}
