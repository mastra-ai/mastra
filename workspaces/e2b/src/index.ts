/**
 * @mastra/e2b - E2B Sandbox and Filesystem Providers
 *
 * Provides E2B cloud sandbox integration for Mastra workspaces.
 *
 * @example Basic E2B sandbox
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { E2BSandbox } from '@mastra/e2b';
 *
 * const workspace = new Workspace({
 *   sandbox: new E2BSandbox({ timeout: 60000 }),
 * });
 *
 * await workspace.init();
 * const result = await workspace.executeCode('print("Hello!")');
 * ```
 *
 * @example E2B with S3 filesystem mounting
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { E2BSandbox } from '@mastra/e2b';
 * import { S3Filesystem } from '@mastra/s3';
 *
 * const workspace = new Workspace({
 *   filesystem: new S3Filesystem({
 *     bucket: 'my-bucket',
 *     region: 'us-east-1',
 *     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
 *     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
 *   }),
 *   sandbox: new E2BSandbox({ timeout: 60000 }),
 * });
 *
 * await workspace.init();
 * // S3 filesystem is mounted at /workspace in the sandbox
 * ```
 *
 * @example E2B filesystem (sandbox's internal FS)
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { E2BSandbox, E2BFilesystem } from '@mastra/e2b';
 *
 * const sandbox = new E2BSandbox({ timeout: 60000 });
 * const workspace = new Workspace({
 *   filesystem: new E2BFilesystem({ sandbox }),
 *   sandbox,
 * });
 *
 * await workspace.init();
 * await workspace.writeFile('/data/hello.txt', 'Hello!');
 * ```
 */

export {
  E2BSandbox,
  type E2BSandboxOptions,
  type S3MountConfig,
  type GCSMountConfig,
  type R2MountConfig,
  type E2BMountConfig,
} from './e2b-sandbox';

export { E2BFilesystem, type E2BFilesystemOptions } from './e2b-filesystem';
