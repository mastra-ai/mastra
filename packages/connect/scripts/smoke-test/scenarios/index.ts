import type { Scenario } from '../scenario.js';
import { anthropicScenario } from './anthropic.js';
import { clerkScenario } from './clerk.js';
import { discordScenario } from './discord.js';
import { firefliesScenario } from './fireflies.js';
import { githubScenario } from './github.js';
import { googleAnalyticsScenario } from './google-analytics.js';
import { googleCalendarScenario } from './google-calendar.js';
import { googleDocsScenario } from './google-docs.js';
import { googleDriveScenario } from './google-drive.js';
import { googleMailScenario } from './google-mail.js';
import { googleSheetScenario } from './google-sheet.js';
import { hubspotScenario } from './hubspot.js';
import { incidentIoScenario } from './incident-io.js';
import { jiraScenario } from './jira.js';
import { linearScenario } from './linear.js';
import { microsoftTeamsScenario } from './microsoft-teams.js';
import { notionScenario } from './notion.js';
import { openaiScenario } from './openai.js';
import { posthogScenario } from './posthog.js';
import { resendScenario } from './resend.js';
import { slackScenario } from './slack.js';
import { snowflakeScenario } from './snowflake.js';
import { stripeScenario } from './stripe.js';
import { supabaseScenario } from './supabase.js';
import { twitterScenario } from './twitter-v2.js';
import { workosScenario } from './workos.js';

/**
 * Alphabetical scenario registry. Add new deep scenarios here and keep the
 * list sorted so the smoke-run report comes out in a stable order and diffs
 * between runs stay reviewable.
 */
export const scenarios: Scenario[] = [
  anthropicScenario,
  clerkScenario,
  discordScenario,
  firefliesScenario,
  githubScenario,
  googleAnalyticsScenario,
  googleCalendarScenario,
  googleDocsScenario,
  googleDriveScenario,
  googleMailScenario,
  googleSheetScenario,
  hubspotScenario,
  incidentIoScenario,
  jiraScenario,
  linearScenario,
  microsoftTeamsScenario,
  notionScenario,
  openaiScenario,
  posthogScenario,
  resendScenario,
  slackScenario,
  snowflakeScenario,
  stripeScenario,
  supabaseScenario,
  twitterScenario,
  workosScenario,
];
