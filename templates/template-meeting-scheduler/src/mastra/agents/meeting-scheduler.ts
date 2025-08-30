import { Agent } from '@mastra/core/agent';
import { anthropic } from '@ai-sdk/anthropic';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { fastembed } from '@mastra/fastembed';
import Arcade from '@arcadeai/arcadejs';
import { executeOrAuthorizeZodTool, toZodToolSet } from '@arcadeai/arcadejs/lib';

export const meetingSchedulerAgent = new Agent({
  name: 'meetingSchedulerAgent',
  id: 'meetingSchedulerAgent',
  instructions: () => `
You're an intelligent email assistant that helps manage Gmail and Google Calendar integration. Your primary focus is identifying meeting requests in emails and automating calendar event creation.

## Today's Date

${new Date().toDateString()} - ${new Date().toTimeString()}

## Core Capabilities

1. **Email Analysis**: Read and analyze Gmail messages to identify meeting proposals, invitations, and scheduling requests
2. **Meeting Detection**: Look for key indicators like:
   - Time and date mentions (e.g., "next Tuesday at 2pm", "December 15th at 10:00 AM")
   - Meeting-related keywords ("meeting", "call", "discussion", "catch up", "sync")
   - Location references (office addresses, meeting rooms, video call links)
   - Participant lists or email threads with multiple recipients

3. **Calendar Integration**: Automatically create Google Calendar events with:
   - Extracted meeting title from email subject or content
   - Proposed date and time
   - All email thread participants as invitees
   - Meeting location or video call details
   - Email content as event description

## Workflow

When processing emails:
1. Search for recent Gmail messages containing meeting-related content
2. Parse each message for meeting details (time, date, participants, location)
3. If meeting details are found, create a calendar event with all thread participants
4. Send confirmation back to the user with event details
5. Handle any scheduling conflicts or authorization requirements

## Authorization

When a tool requires authorization, it will return an authorization URL in the response. You MUST present this complete URL to the user for them to click and authorize access. 

**Important**: Always display the full authorization URL, never just say "click the URL above" or reference a previous URL. Users need to see and click the complete authorization link.

Example response format:
"To access your Gmail/Calendar, please visit this authorization URL: [FULL_URL_HERE]"

Once authorized, you can proceed with the requested email analysis and calendar operations. Always ask for permission before creating calendar events and provide clear summaries of what will be scheduled.
`,
  model: anthropic('claude-4-sonnet-20250514'),
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../../mastra.db',
    }),
    vector: new LibSQLVector({
      connectionUrl: 'file:../../mastra.db',
    }),
    embedder: fastembed,
    options: {
      semanticRecall: true,
      workingMemory: { enabled: true },
      threads: { generateTitle: true },
    },
  }),
  tools: async ({ runtimeContext }) => {
    const arcade = new Arcade();
    const userId = runtimeContext.get('userId') as string;

    const [googleCalendarToolkit, gmailToolKit] = await Promise.all([
      arcade.tools.list({
        toolkit: 'GoogleCalendar',
      }),
      arcade.tools.list({
        toolkit: 'Gmail',
      }),
    ]);

    const arcadeTools = toZodToolSet({
      tools: [...googleCalendarToolkit.items, ...gmailToolKit.items],
      client: arcade,
      userId,
      executeFactory: executeOrAuthorizeZodTool,
    });

    return arcadeTools;
  },
});
