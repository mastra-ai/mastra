/**
 * @mastra/s3 - S3-Compatible Filesystem Provider
 *
 * A filesystem implementation backed by Amazon S3 or S3-compatible storage.
 * Works with AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, etc.
 *
 * @example AWS S3
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { S3Filesystem } from '@mastra/s3';
 *
 * const workspace = new Workspace({
 *   filesystem: new S3Filesystem({
 *     bucket: 'my-bucket',
 *     region: 'us-east-1',
 *     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
 *     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
 *   }),
 * });
 *
 * await workspace.init();
 * await workspace.writeFile('/data/hello.txt', 'Hello from S3!');
 * ```
 *
 * @example Cloudflare R2
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { S3Filesystem } from '@mastra/s3';
 *
 * const workspace = new Workspace({
 *   filesystem: new S3Filesystem({
 *     bucket: 'my-bucket',
 *     region: 'auto',
 *     accessKeyId: process.env.R2_ACCESS_KEY_ID!,
 *     secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
 *     endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
 *   }),
 * });
 * ```
 *
 * @example With E2B sandbox (mounting)
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { E2BSandbox } from '@mastra/e2b';
 * import { S3Filesystem } from '@mastra/s3';
 *
 * // S3 filesystem can be mounted into E2B sandbox via s3fs-fuse
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
 * // Filesystem is mounted, so writes are visible in both the API and sandbox
 * await workspace.writeFile('/data.json', '{"key": "value"}');
 * const result = await workspace.executeCode('cat /workspace/data.json', { runtime: 'bash' });
 * ```
 */

export { S3Filesystem, type S3FilesystemOptions, type S3MountConfig } from './s3-filesystem';
