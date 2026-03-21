/**
 * Slack events route for the coding agent.
 * Routes Slack messages to a Harness instance per thread.
 */
import { registerApiRoute } from '@mastra/core/server';
import { WebClient } from '@slack/web-api';

import {
  getOrCreateHarness,
  destroySession,
  getSession,
  listSessions,
} from '../coding/harness-factory.js';
import type { CodingSessionConfig } from '../coding/harness-factory.js';
import { streamHarnessToSlack } from './harness-streaming.js';
import { verifySlackRequest } from './verify.js';

// ---------------------------------------------------------------------------
// Pending interactive prompts (ask_user / submit_plan)
// ---------------------------------------------------------------------------

interface PendingQuestion {
  questionId: string;
  question: string;
  options?: Array<{ label: string; description?: string }>;
}

interface PendingPlan {
  planId: string;
  title?: string;
  plan: string;
}

const pendingQuestions = new Map<string, PendingQuestion>();
const pendingPlans = new Map<string, PendingPlan>();

// ---------------------------------------------------------------------------
// GitHub Gist helper
// ---------------------------------------------------------------------------

const SLACK_MAX_LENGTH = 3900;

async function createGist(
  title: string,
  content: string,
): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  try {
    const filename = `${title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').slice(0, 60) || 'plan'}.md`;
    const res = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        description: title,
        public: false,
        files: { [filename]: { content } },
      }),
    });

    if (!res.ok) {
      console.error('Failed to create gist:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return data.html_url as string;
  } catch (err) {
    console.error('Failed to create gist:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Config from environment
// ---------------------------------------------------------------------------

function getSessionConfig(overrides?: { repoUrl?: string; branch?: string }): CodingSessionConfig {
  return {
    repoUrl: overrides?.repoUrl ?? process.env.DEFAULT_REPO_URL,
    branch: overrides?.branch ?? process.env.DEFAULT_REPO_BRANCH,
    githubToken: process.env.GITHUB_TOKEN!,
    gitUserName: process.env.GIT_USER_NAME!,
    gitUserEmail: process.env.GIT_USER_EMAIL!,
  };
}

// ---------------------------------------------------------------------------
// Session context — injected into the first message of every new session
// ---------------------------------------------------------------------------

const SESSION_CONTEXT = `
<environment_context>
You are running inside an E2B cloud sandbox (Debian Linux). Your working directory is /home/user/project.
All shell commands run inside the sandbox via execute_command.

## CLI tools available in the sandbox
The following are available via execute_command — use them directly:
- **gh** (GitHub CLI) — pre-installed and authenticated via GH_TOKEN. Use for ALL GitHub operations.
- **git** — pre-configured with credentials. You can push, pull, and commit directly.
- **jq** — JSON processing
- **rg** (ripgrep) — fast code search
- **tree** — directory visualization
- **pnpm** — Node.js package management

## CRITICAL: GitHub operations
- To view an issue: \`execute_command\` with \`gh issue view <number>\`
- To list issues: \`execute_command\` with \`gh issue list\`
- To create a PR: \`execute_command\` with \`gh pr create --title "..." --body "..."\`
- To view a PR: \`execute_command\` with \`gh pr view <number>\`
- Do NOT use web_search to look up GitHub issues or PRs — use \`gh\` via execute_command instead.
- Do NOT use raw GitHub API calls — use the \`gh\` CLI.

## Slack formatting
Keep responses concise. Use *bold*, \`code\`, and bullet points for readability.
</environment_context>
`.trim();

// ---------------------------------------------------------------------------
// Thread history
// ---------------------------------------------------------------------------

/**
 * Fetch prior messages in a Slack thread to give the agent context
 * when joining an existing conversation.
 */
async function fetchThreadHistory(
  slackClient: WebClient,
  channel: string,
  threadTs: string,
  currentMessageTs: string,
): Promise<string | null> {
  try {
    const result = await slackClient.conversations.replies({
      channel,
      ts: threadTs,
      limit: 50,
    });

    const messages = result.messages ?? [];

    // Filter out the current message and bot messages
    const prior = messages.filter(
      m => m.ts !== currentMessageTs && !m.bot_id,
    );

    if (prior.length === 0) return null;

    const formatted = prior
      .map(m => {
        const user = m.user ? `<@${m.user}>` : 'unknown';
        const text = (m.text ?? '').replace(/<@[A-Z0-9]+>/g, '@user').trim();
        return `${user}: ${text}`;
      })
      .join('\n');

    return formatted;
  } catch (err) {
    console.error('Failed to fetch thread history:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Slack command parsing
// ---------------------------------------------------------------------------

interface ParsedCommand {
  type: 'command';
  command: string;
  args: string[];
}

interface ParsedMessage {
  type: 'message';
  text: string;
}

function parseSlackMessage(text: string): ParsedCommand | ParsedMessage {
  const trimmed = text.trim();

  // Check for slash-style commands (without the slash, since Slack strips mentions)
  const commands = ['clone', 'status', 'summary', 'commit', 'pr', 'destroy'];
  for (const cmd of commands) {
    if (trimmed.toLowerCase().startsWith(cmd + ' ') || trimmed.toLowerCase() === cmd) {
      const rest = trimmed.slice(cmd.length).trim();
      return {
        type: 'command',
        command: cmd,
        args: rest ? rest.split(/\s+/) : [],
      };
    }
  }

  return { type: 'message', text: trimmed };
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function handleCommand(
  parsed: ParsedCommand,
  slackClient: WebClient,
  channel: string,
  threadTs: string,
  threadKey: string,
): Promise<void> {
  switch (parsed.command) {
    case 'clone': {
      const repoUrl = parsed.args[0];
      const branch = parsed.args[1];
      if (!repoUrl) {
        await slackClient.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: '⚠️ Usage: `clone <repo-url> [branch]`',
        });
        return;
      }

      // Destroy existing session if any
      await destroySession(threadKey);

      await slackClient.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text: `🚀 Setting up sandbox with \`${repoUrl}\`${branch ? ` (branch: ${branch})` : ''}...`,
      });

      try {
        const config = getSessionConfig({ repoUrl, branch });
        await getOrCreateHarness(threadKey, config);
        await slackClient.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: '✅ Sandbox ready! The repo is cloned and ready for work. Send me a coding task.',
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await slackClient.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: `❌ Failed to set up sandbox: ${errorMsg}`,
        });
      }
      return;
    }

    case 'status': {
      const session = getSession(threadKey);
      if (!session) {
        await slackClient.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: '💤 No active session for this thread. Send a message or use `clone <repo-url>` to start.',
        });
        return;
      }
      const elapsed = Math.round((Date.now() - session.lastActivity) / 1000);
      const allSessions = listSessions();
      await slackClient.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text: [
          `📊 *Session Status*`,
          `• Thread: ${threadKey}`,
          `• Last activity: ${elapsed}s ago`,
          `• Active sessions: ${allSessions.length}`,
        ].join('\n'),
      });
      return;
    }

    case 'summary': {
      const session = getSession(threadKey);
      if (!session) {
        await slackClient.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: '💤 No active session to summarize.',
        });
        return;
      }
      // Start streaming before sending message to catch all events
      const summaryStreamPromise = streamHarnessToSlack({
        slackClient,
        channel,
        threadTs,
        harness: session.harness,
      });
      await session.harness.sendMessage({
        content:
          'Please provide a brief summary of all the work done in this session so far. ' +
          'Include: files changed, what was accomplished, and any pending items.',
      });
      await summaryStreamPromise;
      return;
    }

    case 'commit': {
      const message = parsed.args.join(' ') || 'Update from Slack coding session';
      const session = getSession(threadKey);
      if (!session) {
        await slackClient.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: '💤 No active session. Start one first.',
        });
        return;
      }
      const commitStreamPromise = streamHarnessToSlack({
        slackClient,
        channel,
        threadTs,
        harness: session.harness,
      });
      await session.harness.sendMessage({
        content: `Please commit all changes with message: "${message}", then push to the remote.`,
      });
      await commitStreamPromise;
      return;
    }

    case 'pr': {
      const title = parsed.args.join(' ') || 'Changes from Slack coding session';
      const session = getSession(threadKey);
      if (!session) {
        await slackClient.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: '💤 No active session. Start one first.',
        });
        return;
      }
      const prStreamPromise = streamHarnessToSlack({
        slackClient,
        channel,
        threadTs,
        harness: session.harness,
      });
      await session.harness.sendMessage({
        content:
          `Please commit all changes, push, and create a PR with title: "${title}". ` +
          'Include a description of all changes made in the PR body.',
      });
      await prStreamPromise;
      return;
    }

    case 'destroy': {
      const destroyed = await destroySession(threadKey);
      await slackClient.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text: destroyed
          ? '🗑️ Session and sandbox destroyed.'
          : '💤 No active session to destroy.',
      });
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Main route
// ---------------------------------------------------------------------------

const slackEventsRoute = registerApiRoute('/slack/coding/events', {
  method: 'POST',
  handler: async c => {
    try {
      const body = await c.req.text();
      const payload = JSON.parse(body);

      // Handle URL verification challenge
      if (payload.type === 'url_verification') {
        console.log('✅ URL verification challenge received');
        return c.json({ challenge: payload.challenge });
      }

      const botToken = process.env.SLACK_BOT_TOKEN;
      const signingSecret = process.env.SLACK_SIGNING_SECRET;

      if (!botToken || !signingSecret) {
        console.error('❌ Missing SLACK_BOT_TOKEN or SLACK_SIGNING_SECRET');
        return c.json({ error: 'Server misconfigured' }, 500);
      }

      // Verify Slack signature
      const slackSignature = c.req.header('x-slack-signature');
      const slackTimestamp = c.req.header('x-slack-request-timestamp');

      if (!slackSignature || !slackTimestamp) {
        return c.json({ error: 'Missing Slack signature headers' }, 401);
      }

      if (!verifySlackRequest(signingSecret, slackSignature, slackTimestamp, body)) {
        console.error('❌ Invalid Slack signature');
        return c.json({ error: 'Invalid signature' }, 401);
      }

      // Handle event
      if (payload.event) {
        const event = payload.event;

        // Ignore bot messages and message edits
        if (event.bot_id || event.subtype) {
          return c.json({ ok: true });
        }

        // Handle app mentions and direct messages
        if (event.type === 'app_mention' || event.type === 'message') {
          let messageText: string = event.text || '';
          const channelId: string = event.channel;
          const threadTs: string = event.thread_ts || event.ts;

          console.log('📨 Message received:', {
            text: messageText,
            user: event.user,
            channel: channelId,
          });

          // Strip bot mentions
          messageText = messageText.replace(/<@[A-Z0-9]+>/g, '').trim();

          if (!messageText) {
            return c.json({ ok: true });
          }

          const slackClient = new WebClient(botToken);
          const threadKey = `${channelId}-${threadTs}`;

          // React immediately so the user knows we received it
          slackClient.reactions.add({
            channel: channelId,
            timestamp: event.ts,
            name: 'eyes',
          }).catch(() => {});

          // Process asynchronously (don't block Slack's 3s timeout)
          (async () => {
            try {
              const parsed = parseSlackMessage(messageText);

              if (parsed.type === 'command') {
                await handleCommand(parsed, slackClient, channelId, threadTs, threadKey);
                return;
              }

              // Check if there's a pending question or plan for this thread.
              // After resolving, start a new streaming session so we get a fresh
              // status message instead of editing the old (stale) one.
              const pendingQ = pendingQuestions.get(threadKey);
              if (pendingQ) {
                pendingQuestions.delete(threadKey);
                const session = getSession(threadKey);
                if (session) {
                  let answer = parsed.text;
                  if (pendingQ.options?.length) {
                    const idx = parseInt(answer, 10);
                    if (!isNaN(idx) && idx >= 1 && idx <= pendingQ.options.length) {
                      answer = pendingQ.options[idx - 1].label;
                    }
                  }

                  // Start fresh streaming BEFORE resolving, so events are captured
                  const resumeStream = streamHarnessToSlack({
                    slackClient,
                    channel: channelId,
                    threadTs,
                    harness: session.harness,
                    onAskQuestion: (evt) => {
                      pendingQuestions.set(threadKey, evt);
                      const optionsText = evt.options?.length
                        ? '\n' + evt.options.map((o, i) => `  ${i + 1}. *${o.label}*${o.description ? ` — ${o.description}` : ''}`).join('\n') + '\n\n_Reply with a number or type your answer._'
                        : '';
                      slackClient.chat.postMessage({
                        channel: channelId,
                        thread_ts: threadTs,
                        text: `❓ *Question from the agent:*\n${evt.question}${optionsText}`,
                      }).catch(err => console.error('Failed to post question to Slack:', err));
                    },
                    onPlanApproval: async (evt) => {
                      pendingPlans.set(threadKey, evt);
                      const header = `📋 *Plan submitted for review${evt.title ? `: ${evt.title}` : ''}*`;
                      const footer = `\n\n_Reply *approve* to proceed or describe changes to reject._`;
                      if (evt.plan.length <= SLACK_MAX_LENGTH - header.length - footer.length - 10) {
                        slackClient.chat.postMessage({ channel: channelId, thread_ts: threadTs, text: `${header}\n\n${evt.plan}${footer}` })
                          .catch(err => console.error('Failed to post plan to Slack:', err));
                      } else {
                        const gistUrl = await createGist(evt.title || 'Implementation Plan', evt.plan);
                        const planPreview = evt.plan.slice(0, 1500) + '\n\n_(truncated)_';
                        const linkText = gistUrl ? `\n\n<${gistUrl}|📄 View full plan on GitHub>` : '';
                        slackClient.chat.postMessage({ channel: channelId, thread_ts: threadTs, text: `${header}${linkText}\n\n${planPreview}${footer}` })
                          .catch(err => console.error('Failed to post plan to Slack:', err));
                      }
                    },
                  });

                  // Now resolve — the agent resumes and events flow to the new stream
                  session.harness.respondToQuestion({ questionId: pendingQ.questionId, answer });
                  console.log(`✅ Resolved pending question ${pendingQ.questionId} with: ${answer}`);
                  await resumeStream;
                }
                return;
              }

              const pendingP = pendingPlans.get(threadKey);
              if (pendingP) {
                pendingPlans.delete(threadKey);
                const session = getSession(threadKey);
                if (session) {
                  const lower = parsed.text.toLowerCase();
                  const approved = lower.startsWith('approve') || lower.startsWith('yes') || lower === 'lgtm' || lower === 'ok' || lower === 'go';

                  // Start fresh streaming before resolving
                  const resumeStream = streamHarnessToSlack({
                    slackClient,
                    channel: channelId,
                    threadTs,
                    harness: session.harness,
                    onAskQuestion: (evt) => {
                      pendingQuestions.set(threadKey, evt);
                      const optionsText = evt.options?.length
                        ? '\n' + evt.options.map((o, i) => `  ${i + 1}. *${o.label}*${o.description ? ` — ${o.description}` : ''}`).join('\n') + '\n\n_Reply with a number or type your answer._'
                        : '';
                      slackClient.chat.postMessage({ channel: channelId, thread_ts: threadTs, text: `❓ *Question from the agent:*\n${evt.question}${optionsText}` })
                        .catch(err => console.error('Failed to post question to Slack:', err));
                    },
                    onPlanApproval: async (evt) => {
                      pendingPlans.set(threadKey, evt);
                      const header = `📋 *Plan submitted for review${evt.title ? `: ${evt.title}` : ''}*`;
                      const footer = `\n\n_Reply *approve* to proceed or describe changes to reject._`;
                      if (evt.plan.length <= SLACK_MAX_LENGTH - header.length - footer.length - 10) {
                        slackClient.chat.postMessage({ channel: channelId, thread_ts: threadTs, text: `${header}\n\n${evt.plan}${footer}` })
                          .catch(err => console.error('Failed to post plan to Slack:', err));
                      } else {
                        const gistUrl = await createGist(evt.title || 'Implementation Plan', evt.plan);
                        const planPreview = evt.plan.slice(0, 1500) + '\n\n_(truncated)_';
                        const linkText = gistUrl ? `\n\n<${gistUrl}|📄 View full plan on GitHub>` : '';
                        slackClient.chat.postMessage({ channel: channelId, thread_ts: threadTs, text: `${header}${linkText}\n\n${planPreview}${footer}` })
                          .catch(err => console.error('Failed to post plan to Slack:', err));
                      }
                    },
                  });

                  await session.harness.respondToPlanApproval({
                    planId: pendingP.planId,
                    response: approved
                      ? { action: 'approved' }
                      : { action: 'rejected', feedback: parsed.text },
                  });
                  console.log(`✅ Resolved pending plan ${pendingP.planId}: ${approved ? 'approved' : 'rejected'}`);
                  await resumeStream;
                }
                return;
              }

              // Regular message — route to Harness
              const config = getSessionConfig();
              const { harness, isNew } = await getOrCreateHarness(threadKey, config);

              // Always include environment context so the agent knows about gh, git, etc.
              let messageContent = `${SESSION_CONTEXT}\n\n`;
              if (isNew) {
                const history = await fetchThreadHistory(slackClient, channelId, threadTs, event.ts);
                if (history) {
                  messageContent +=
                    `Here is the prior conversation in this Slack thread for context:\n\n` +
                    `<thread_history>\n${history}\n</thread_history>\n\n`;
                }
              }
              messageContent += parsed.text;

              // Send message and stream events to Slack
              const streamPromise = streamHarnessToSlack({
                slackClient,
                channel: channelId,
                threadTs,
                harness,
                onAskQuestion: (evt) => {
                  pendingQuestions.set(threadKey, evt);
                  const optionsText = evt.options?.length
                    ? '\n' + evt.options.map((o, i) => `  ${i + 1}. *${o.label}*${o.description ? ` — ${o.description}` : ''}`).join('\n') + '\n\n_Reply with a number or type your answer._'
                    : '';
                  slackClient.chat.postMessage({
                    channel: channelId,
                    thread_ts: threadTs,
                    text: `❓ *Question from the agent:*\n${evt.question}${optionsText}`,
                  }).catch(err => console.error('Failed to post question to Slack:', err));
                },
                onPlanApproval: async (evt) => {
                  pendingPlans.set(threadKey, evt);
                  const header = `📋 *Plan submitted for review${evt.title ? `: ${evt.title}` : ''}*`;
                  const footer = `\n\n_Reply *approve* to proceed or describe changes to reject._`;

                  if (evt.plan.length <= SLACK_MAX_LENGTH - header.length - footer.length - 10) {
                    // Short enough to post inline
                    slackClient.chat.postMessage({
                      channel: channelId,
                      thread_ts: threadTs,
                      text: `${header}\n\n${evt.plan}${footer}`,
                    }).catch(err => console.error('Failed to post plan to Slack:', err));
                  } else {
                    // Too long — create a gist
                    const gistUrl = await createGist(
                      evt.title || 'Implementation Plan',
                      evt.plan,
                    );
                    const planPreview = evt.plan.slice(0, 1500) + '\n\n_(truncated)_';
                    const linkText = gistUrl
                      ? `\n\n<${gistUrl}|📄 View full plan on GitHub>`
                      : '';
                    slackClient.chat.postMessage({
                      channel: channelId,
                      thread_ts: threadTs,
                      text: `${header}${linkText}\n\n${planPreview}${footer}`,
                    }).catch(err => console.error('Failed to post plan to Slack:', err));
                  }
                },
              });

              await harness.sendMessage({ content: messageContent });
              await streamPromise;
            } catch (error) {
              console.error('❌ Error processing message:', error);
              try {
                await slackClient.chat.postMessage({
                  channel: channelId,
                  thread_ts: threadTs,
                  text: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
                });
              } catch {
                // Best-effort error reporting
              }
            }
          })();
        }
      }

      return c.json({ ok: true });
    } catch (error) {
      console.error('Error handling Slack event:', error);
      return c.json({ error: 'Failed to handle event' }, 500);
    }
  },
});

export const slackRoutes = [slackEventsRoute];
