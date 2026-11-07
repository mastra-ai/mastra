import { z } from 'zod';

/**
 * What sessions may do in Slack: set for the deployment, and per Factory from
 * Settings › Slack. Sessions always act as the Slack app, so Slack's own
 * membership rules apply on top: the app can't read a channel nobody added it to.
 */
export const slackToolSettingsSchema = z.object({
  /**
   * `session`: only the channel the session's thread is in.
   * `selected`: that channel plus `channelIds`.
   * `all`: any channel the app is in.
   */
  channels: z.enum(['session', 'selected', 'all']),
  /** Slack channel ids, e.g. `C0123456`, used when `channels` is `selected`. */
  channelIds: z.array(z.string().regex(/^[CG][A-Z0-9]+$/)),
  /** `read`: other channels are read only; posting stays in the session's own channel. */
  channelAccess: z.enum(['read', 'post']),
  /** `none`: no DMs. `linked`: only people linked to an account in the Factory's org. `anyone`: anyone in the workspace. */
  directMessages: z.enum(['none', 'linked', 'anyone']),
});

export type SlackToolSettings = z.infer<typeof slackToolSettingsSchema>;

/** Only the session's own channel, and no DMs, unless a deployment or Factory grants more. */
export const DEFAULT_SLACK_TOOL_SETTINGS: SlackToolSettings = {
  channels: 'session',
  channelIds: [],
  channelAccess: 'post',
  directMessages: 'none',
};

/** Settings saved on a Factory over the deployment's, which fill anything unset or unreadable. */
export function readSlackToolSettings(
  saved: Record<string, unknown> | null | undefined,
  defaults: SlackToolSettings = DEFAULT_SLACK_TOOL_SETTINGS,
): SlackToolSettings {
  const parsed = slackToolSettingsSchema.partial().safeParse(saved ?? {});
  return { ...defaults, ...(parsed.success ? parsed.data : {}) };
}
