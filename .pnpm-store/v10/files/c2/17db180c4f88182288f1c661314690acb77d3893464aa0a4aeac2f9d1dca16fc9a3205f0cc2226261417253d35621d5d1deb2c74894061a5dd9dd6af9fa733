import type { AwsCredentialIdentityProvider } from '@smithy/types';
import type { FromWebTokenInit } from '@aws-sdk/credential-provider-web-identity';
/**
 * The init object for the `awsCredentialsProvider` function.
 *
 * @typedef {Object} AwsCredentialsProviderInit
 * @property {string} roleArn - ARN of the role that the caller is assuming.
 * @property {Object} [clientConfig] - Custom STS client configurations overriding the default ones.
 * @property {Array} [clientPlugins] - Custom STS client middleware plugin to modify the client default behavior.
 * @property {Function} [roleAssumerWithWebIdentity] - A function that assumes a role with web identity and returns a promise fulfilled with credentials for the assumed role.
 * @property {string} [roleSessionName] - An identifier for the assumed role session.
 * @property {string} [providerId] - The fully qualified host component of the domain name of the identity provider.
 * @property {Array} [policyArns] - ARNs of the IAM managed policies that you want to use as managed session policies.
 * @property {string} [policy] - An IAM policy in JSON format that you want to use as an inline session policy.
 * @property {number} [durationSeconds=3600] - The duration, in seconds, of the role session. Defaults to 3600 seconds.
 */
export interface AwsCredentialsProviderInit// eslint-disable-line @typescript-eslint/no-empty-interface
 extends Omit<FromWebTokenInit, 'webIdentityToken'> {
}
/**
 * Obtains the Vercel OIDC token and creates an AWS credential provider function
 * that gets AWS credentials by calling STS AssumeRoleWithWebIdentity API.
 *
 * @param {AwsCredentialsProviderInit} init - The initialization object.
 * @param {string} init.roleArn - ARN of the role that the caller is assuming.
 * @param {Object} [init.clientConfig] - Custom STS client configurations overriding the default ones.
 * @param {Array} [init.clientPlugins] - Custom STS client middleware plugin to modify the client default behavior.
 * @param {Function} [init.roleAssumerWithWebIdentity] - A function that assumes a role with web identity and returns a promise fulfilled with credentials for the assumed role.
 * @param {string} [init.roleSessionName] - An identifier for the assumed role session.
 * @param {string} [init.providerId] - The fully qualified host component of the domain name of the identity provider.
 * @param {Array} [init.policyArns] - ARNs of the IAM managed policies that you want to use as managed session policies.
 * @param {string} [init.policy] - An IAM policy in JSON format that you want to use as an inline session policy.
 * @param {number} [init.durationSeconds=3600] - The duration, in seconds, of the role session. Defaults to 3600 seconds.
 *
 * @returns {AwsCredentialIdentityProvider} A function that provides AWS credentials.
 *
 * @example
 * ```js
 * import * as s3 from '@aws-sdk/client-s3';
 * import { awsCredentialsProvider } from '@vercel/functions/oidc';
 *
 * const s3Client = new s3.S3Client({
 *   credentials: awsCredentialsProvider({
 *     roleArn: "arn:aws:iam::1234567890:role/RoleA",
 *     clientConfig: { region: "us-west-2" },
 *     clientPlugins: [addFooHeadersPlugin],
 *     roleAssumerWithWebIdentity: customRoleAssumer,
 *     roleSessionName: "session_123",
 *     providerId: "graph.facebook.com",
 *     policyArns: [{ arn: "arn:aws:iam::1234567890:policy/SomePolicy" }],
 *     policy: "{\"Statement\": [{\"Effect\": \"Allow\", \"Action\": \"s3:ListBucket\", \"Resource\": \"*\"}]}",
 *     durationSeconds: 7200
 *   }),
 * });
 * ```
 */
export declare function awsCredentialsProvider(init: AwsCredentialsProviderInit): AwsCredentialIdentityProvider;
