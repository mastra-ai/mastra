import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const DISCORD_LIMITS = {
  description: 4096,
  title: 256,
};
const MASTRA_GREEN = 0x72ff70;

function truncate(value, limit, suffix = '…') {
  const characters = Array.from(value);
  if (characters.length <= limit) return value;

  return `${characters.slice(0, limit - Array.from(suffix).length).join('')}${suffix}`;
}

function releaseUrl(value, repository, tag) {
  try {
    const url = new URL(value);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && url.href.length <= 2048) {
      return url.href;
    }
  } catch {
    // Use the GitHub release URL fallback below.
  }

  return `https://github.com/${repository}/releases/tag/${encodeURIComponent(tag)}`;
}

export function createPayload({ name, tag, url, notes, repository, timestamp, isTest }) {
  const releaseName = name.trim();
  const displayName = releaseName && releaseName !== tag ? `${tag} — ${releaseName}` : tag;
  const normalizedUrl = releaseUrl(url, repository, tag);
  const fullNotesLink = `\n\n[Read the full release notes](${normalizedUrl})`;
  const defaultNotes = `Release notes are available on [GitHub](${normalizedUrl}).`;
  const description = notes.trim() ? truncate(notes.trim(), DISCORD_LIMITS.description, fullNotesLink) : defaultNotes;

  return {
    username: 'Mastra Releases',
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: truncate(
          `${isTest ? 'Test release announcement: ' : 'New release: '}${displayName}`,
          DISCORD_LIMITS.title,
        ),
        url: normalizedUrl,
        description,
        color: MASTRA_GREEN,
        timestamp,
        footer: {
          text: `${repository}${isTest ? ' • Test notification' : ''}`,
        },
      },
    ],
  };
}

export async function sendPayload(
  webhookUrl,
  payload,
  { fetchImpl = fetch, sleep = delay => new Promise(resolve => setTimeout(resolve, delay)), maxAttempts = 3 } = {},
) {
  if (!webhookUrl) {
    throw new Error('DISCORD_RELEASE_WEBHOOK_URL is required when delivering a notification.');
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response;
    try {
      response = await fetchImpl(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      if (attempt === maxAttempts) throw error;

      const delay = 500 * 2 ** (attempt - 1);
      console.warn(`Discord request failed; retrying in ${delay}ms (${attempt}/${maxAttempts}).`);
      await sleep(delay);
      continue;
    }

    if (response.ok) return;

    const responseBody = await response.text();
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === maxAttempts) {
      throw new Error(`Discord webhook returned ${response.status}: ${responseBody}`);
    }

    let delay = 500 * 2 ** (attempt - 1);
    if (response.status === 429) {
      const retryAfterHeader = Number(response.headers.get('retry-after'));
      try {
        const retryAfterBody = Number(JSON.parse(responseBody).retry_after);
        delay = Math.ceil((retryAfterBody || retryAfterHeader || delay / 1000) * 1000);
      } catch {
        delay = Math.ceil((retryAfterHeader || delay / 1000) * 1000);
      }
    }

    console.warn(`Discord returned ${response.status}; retrying in ${delay}ms (${attempt}/${maxAttempts}).`);
    await sleep(delay);
  }
}

async function main() {
  const repository = process.env.RELEASE_REPOSITORY || 'mastra-ai/mastra';
  const tag = process.env.RELEASE_TAG || 'v0.0.0-test';
  const isTest = process.env.RELEASE_IS_TEST === 'true';
  const payload = createPayload({
    name: process.env.RELEASE_NAME || '',
    tag,
    url: process.env.RELEASE_URL || '',
    notes: process.env.RELEASE_NOTES || '',
    repository,
    timestamp: process.env.RELEASE_TIMESTAMP || new Date().toISOString(),
    isTest,
  });

  if (process.env.RELEASE_PREVIEW === 'true') {
    const preview = JSON.stringify(payload, null, 2);
    console.log(preview);

    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(
        process.env.GITHUB_STEP_SUMMARY,
        `## Discord payload preview\n\n\`\`\`json\n${preview}\n\`\`\`\n`,
      );
    }
    return;
  }

  await sendPayload(process.env.DISCORD_RELEASE_WEBHOOK_URL, payload);
  console.log(`Sent ${isTest ? 'test ' : ''}release announcement for ${tag}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
