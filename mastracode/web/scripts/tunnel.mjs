#!/usr/bin/env node
/**
 * Cloudflare tunnel helper for local Slack/channels development.
 *
 * Slack only talks to public HTTPS origins, so reaching a local dev server
 * needs a tunnel. Everything here drives `cloudflared` with flags — no
 * `~/.cloudflared/*.yml` to write or keep in sync, since the local port is
 * already known from `pnpm dev` (5873).
 *
 * Modes:
 *   (default)  ephemeral trycloudflare.com URL, no Cloudflare account needed
 *   --named    persistent tunnel + stable hostname (needs `setup` once)
 *   setup      create the named tunnel and its DNS record
 *
 * A quick tunnel gets a new hostname every run, which would normally mean
 * re-editing the Slack app by hand each time. With app configuration tokens
 * set, the script pushes the new URLs into the app's manifest itself, so the
 * throwaway hostname stops being a chore. Without them it just prints the
 * values to paste, since those drifting apart is the usual failure.
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PORT = process.env.PORT ?? '5873';
const ORIGIN = `http://127.0.0.1:${PORT}`;
const TUNNEL_NAME = process.env.TUNNEL_NAME ?? 'mc-web';
// The Slack webhook route is mounted per-controller and the path is built from
// `controller.id` (see AgentControllerChannels#getWebhookBasePath), NOT the key
// the controller is registered under in `agentControllers` — those differ here
// ('mastra-code' vs 'code').
const CONTROLLER_ID = 'mastra-code';

const args = process.argv.slice(2);
const has = flag => args.includes(flag);

function run(cmd, cmdArgs, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { stdio: 'inherit', ...opts });
    child.on('error', reject);
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function requireCloudflared() {
  try {
    await run('cloudflared', ['--version'], { stdio: 'ignore' });
  } catch {
    console.error(
      [
        'cloudflared is not installed.',
        '',
        '  macOS:  brew install cloudflared',
        '  other:  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
      ].join('\n'),
    );
    process.exit(1);
  }
}

const webhookUrl = publicUrl => `${publicUrl}/api/agent-controllers/${CONTROLLER_ID}/channels/slack/webhook`;
const oauthRedirectUrl = publicUrl => `${publicUrl}/connect/slack/oidc/callback`;

function printSlackConfig(publicUrl, { synced = false } = {}) {
  console.log(
    [
      '',
      '─'.repeat(72),
      `Tunnel origin: ${publicUrl}  →  ${ORIGIN}`,
      '',
      synced ? 'Slack app manifest updated automatically:' : 'Slack app config (https://api.slack.com/apps):',
      `  Event Subscriptions → Request URL`,
      `    ${webhookUrl(publicUrl)}`,
      `  OAuth & Permissions → Redirect URLs`,
      `    ${oauthRedirectUrl(publicUrl)}`,
      '',
      'mastracode/web/.env:',
      `  MASTRACODE_CHANNELS_PUBLIC_URL=${publicUrl}`,
      '',
      'Restart `pnpm dev` after editing .env — varlock reads it at startup.',
      '─'.repeat(72),
      '',
    ].join('\n'),
  );
}

/**
 * Push the tunnel's URLs into the Slack app manifest.
 *
 * Requires app configuration tokens (https://api.slack.com/apps > "Your App
 * Configuration Tokens") plus the target app id. Access tokens last 12 hours
 * and refresh tokens are single-use, so each rotation writes the new pair back
 * to .env — otherwise the next run would fail with an invalid refresh token.
 */
async function syncManifest(publicUrl) {
  const appId = process.env.SLACK_APP_ID?.trim();
  const token = process.env.SLACK_APP_CONFIG_TOKEN?.trim();
  const refreshToken = process.env.SLACK_APP_CONFIG_REFRESH_TOKEN?.trim();
  if (!appId || !refreshToken) return false;

  const { SlackManifestClient, buildManifest } = await import('@mastra/slack');

  const client = new SlackManifestClient({
    token: token ?? '',
    refreshToken,
    onTokenRotation: async tokens => {
      persistEnv({
        SLACK_APP_CONFIG_TOKEN: tokens.token,
        SLACK_APP_CONFIG_REFRESH_TOKEN: tokens.refreshToken,
      });
    },
  });

  // Access tokens expire after 12h; rotating up front avoids a failed update.
  await client.rotateToken();
  await client.updateApp(
    appId,
    buildManifest({
      name: process.env.SLACK_APP_NAME ?? 'Mastra Code (dev)',
      webhookUrl: webhookUrl(publicUrl),
      oauthRedirectUrl: oauthRedirectUrl(publicUrl),
    }),
  );
  return true;
}

/** Rewrite keys in place in .env, appending any that aren't there yet. */
function persistEnv(updates) {
  const path = join(process.cwd(), '.env');
  let contents = '';
  try {
    contents = readFileSync(path, 'utf8');
  } catch {
    // No .env yet — start from empty and let the writes create it.
  }

  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    contents = pattern.test(contents) ? contents.replace(pattern, line) : `${contents.trimEnd()}\n${line}\n`;
  }

  writeFileSync(path, contents);
}

/** Sync the manifest if configured, else fall back to printing the values. */
async function announce(publicUrl) {
  try {
    const synced = await syncManifest(publicUrl);
    printSlackConfig(publicUrl, { synced });
    if (!synced) {
      console.log(
        [
          'Tip: set SLACK_APP_ID + SLACK_APP_CONFIG_REFRESH_TOKEN in .env and this',
          'script will update the Slack app for you on every start.',
          'Tokens: https://api.slack.com/apps > "Your App Configuration Tokens"',
          '',
        ].join('\n'),
      );
    }
  } catch (error) {
    printSlackConfig(publicUrl);
    console.error(`Could not update the Slack app manifest: ${error.message}\n`);
  }
}

/** Ephemeral tunnel: no account, no DNS, throwaway URL that changes each run. */
async function quick() {
  await requireCloudflared();
  console.log(`Starting a quick tunnel to ${ORIGIN} (no Cloudflare account needed)…\n`);

  const child = spawn('cloudflared', ['tunnel', '--url', ORIGIN], { stdio: ['inherit', 'inherit', 'pipe'] });

  let announced = false;
  child.stderr.on('data', chunk => {
    const text = chunk.toString();
    process.stderr.write(text);
    // cloudflared prints the assigned hostname to stderr once connected.
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match && !announced) {
      announced = true;
      void announce(match[0]);
    }
  });

  const stop = () => child.kill('SIGINT');
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  child.on('exit', code => process.exit(code ?? 0));
}

/** Persistent tunnel: stable hostname, survives restarts. Requires `setup`. */
async function named() {
  await requireCloudflared();
  const hostname = process.env.TUNNEL_HOSTNAME;
  console.log(`Starting tunnel "${TUNNEL_NAME}" → ${ORIGIN}\n`);
  if (hostname) await announce(`https://${hostname}`);
  // `--url` supplies the single ingress rule, so no config file is needed.
  await run('cloudflared', ['tunnel', '--url', ORIGIN, 'run', TUNNEL_NAME]);
}

/** One-time: authorize, create the tunnel, point a hostname at it. */
async function setup() {
  await requireCloudflared();
  const hostname = process.env.TUNNEL_HOSTNAME ?? args.find(a => a.includes('.'));

  if (!hostname) {
    console.error(
      [
        'A hostname is required for a persistent tunnel.',
        '',
        '  TUNNEL_HOSTNAME=mc-you.example.com pnpm tunnel:setup',
        '',
        'The domain must be on your Cloudflare account. If you just want to try',
        'things out, skip setup entirely and run `pnpm tunnel` for a throwaway URL.',
      ].join('\n'),
    );
    process.exit(1);
  }

  console.log('1/3  Authorizing cloudflared with Cloudflare (opens a browser)…\n');
  await run('cloudflared', ['tunnel', 'login']);

  console.log(`\n2/3  Creating tunnel "${TUNNEL_NAME}" (skipped if it exists)…\n`);
  try {
    await run('cloudflared', ['tunnel', 'create', TUNNEL_NAME]);
  } catch {
    console.log(`  Tunnel "${TUNNEL_NAME}" already exists — reusing it.`);
  }

  console.log(`\n3/3  Routing ${hostname} → ${TUNNEL_NAME}…\n`);
  await run('cloudflared', ['tunnel', 'route', 'dns', TUNNEL_NAME, hostname]);

  console.log(`\nDone. Start it with:\n\n  TUNNEL_HOSTNAME=${hostname} pnpm tunnel:run\n`);
  await announce(`https://${hostname}`);
}

if (args[0] === 'setup') await setup();
else if (has('--named')) await named();
else await quick();
