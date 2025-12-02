import type { WebhookEvent } from './api/resources/Webhooks';
/**
 * @inline
 */
export type VerifyWebhookOptions = {
    /**
     * The signing secret for the webhook. It's recommended to use the [`CLERK_WEBHOOK_SIGNING_SECRET` environment variable](https://clerk.com/docs/deployments/clerk-environment-variables#webhooks) instead.
     */
    signingSecret?: string;
};
export * from './api/resources/Webhooks';
/**
 * Verifies the authenticity of a webhook request using Svix. Returns a promise that resolves to the verified webhook event data.
 *
 * @param request - The request object.
 * @param options - Optional configuration object.
 *
 * @example
 * See the [guide on syncing data](https://clerk.com/docs/webhooks/sync-data) for more comprehensive and framework-specific examples that you can copy and paste into your app.
 *
 * ```ts
 * try {
 *   const evt = await verifyWebhook(request)
 *
 *   // Access the event data
 *   const { id } = evt.data
 *   const eventType = evt.type
 *
 *   // Handle specific event types
 *   if (evt.type === 'user.created') {
 *     console.log('New user created:', evt.data.id)
 *     // Handle user creation
 *   }
 *
 *   return new Response('Success', { status: 200 })
 * } catch (err) {
 *   console.error('Webhook verification failed:', err)
 *   return new Response('Webhook verification failed', { status: 400 })
 * }
 * ```
 */
export declare function verifyWebhook(request: Request, options?: VerifyWebhookOptions): Promise<WebhookEvent>;
//# sourceMappingURL=webhooks.d.ts.map