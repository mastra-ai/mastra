import { GithubIntegration } from '@mastra/github'
import { FirecrawlIntegration } from '@mastra/firecrawl'
import { SlackIntegration } from '@mastra/slack'
import { z } from 'zod'
// @ts-ignore
import { Config } from '@mastra/core'
import {
  callAgent,
  getAthletesForTeam,
  getScores,
  getSportsNews,
  reportAnswers,
  sendSlackMessage,
  siteCrawlSync,
  syncTeams
} from './lib/mastra/system-apis'

export const config: Config = {
  name: 'agent-chatbot',
  integrations: [
    new GithubIntegration(),

    new FirecrawlIntegration({
      config: {
        API_KEY: process.env.FIRECRAWL_API_KEY!
      }
    }),

    // @ts-ignore
    new SlackIntegration({
      config: {
        CLIENT_ID: process.env.SLACK_CLIENT_ID!,
        CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET!,
        REDIRECT_URI: `https://redirectmeto.com/${new URL(
          '/api/mastra/connect/callback',
          process.env.APP_URL
        ).toString()}`,
        SCOPES: ['channels:manage', 'users:read', 'chat:write']
      }
    })
  ],
  db: {
    provider: 'postgres',
    uri: process.env.DB_URL!
  },
  agents: {
    agentDirPath: '/agents',
    vectorProvider: [
      {
        name: 'pinecone',
        provider: 'pinecone',
        apiKey: process.env.PINECONE_API_KEY!
      }
    ]
  },
  workflows: {
    blueprintDirPath: '/mastra-blueprints',
    systemEvents: {
      REPORT_ANSWERS: {
        label: 'Report answers for NFL Analyst bot',
        description: 'Report answers for NFL Analyst bot',
        schema: z.object({
          message: z.string()
        })
      },
      CRAWL_SITE_SYNC: {
        label: 'Start crawl for a site',
        description: 'Start crawl for a site',
        schema: z.object({
          url: z.string(),
          entityType: z.string()
        })
      },
      SYNC_TEAMS: {
        label: 'Sync teams',
        description: 'Sync teams',
        schema: z.object({}),
        handler: syncTeams,
        entityType: 'teams',
        fields: [
          {
            name: 'id',
            displayName: 'Team ID',
            type: 'SINGLE_LINE_TEXT',
            order: 1
          },
          {
            name: 'name',
            displayName: 'Name',
            type: 'SINGLE_LINE_TEXT',
            order: 2
          }
        ]
      },
      REPORT_GAME_RESULTS: {
        label: 'Report Game Results',
        description: 'Sync teams',
        schema: z.object({
          week: z.string(),
          day: z.enum(['monday', 'thursday', 'sunday'])
        })
      }
    },
    systemApis: [
      {
        type: 'execute_site_crawl_sync',
        label: 'Crawls and syncs data for data',
        description: 'Crawls and syncs data for data',
        schema: z.object({
          url: z.string(),
          entityType: z.string()
        }),
        executor: siteCrawlSync
      },
      {
        type: 'get_scores_for_nfl_matchups',
        label: 'Provides scores for different NFL matchups by week',
        description: 'Provides scores for different NFL matchups by week',
        schema: z.object({
          week: z.string(),
          day: z.enum(['monday', 'thursday', 'sunday'])
        }),
        executor: async ({ data }: { data: any }) => {
          const scores = await getScores(data)
          return scores
        }
      },
      {
        type: 'get_athletes_for_nfl_team',
        label: 'Provides athlete information for NFL team',
        description: 'Provides athlete information for NFL team',
        schema: z.object({
          teamId: z.number(),
          position: z.enum(['PK', 'WR', 'QB', 'P'])
        }),
        executor: async ({ data }: any) => {
          const athlete = await getAthletesForTeam(data)
          return athlete
        }
      },
      {
        type: 'get_sports_news',
        label: 'Get sports news',
        description: 'Get sports news',
        schema: z.object({}),
        executor: async () => {
          return await getSportsNews()
        }
      },
      {
        type: 'send_slack_message',
        label: 'Send message to slack',
        description: 'Send message to slack',
        schema: z.object({
          message: z.string(),
          channelId: z.string()
        }),
        executor: sendSlackMessage
      },
      {
        type: 'report_answers_to_slack',
        label: 'Triggers a workflow for questions asked to the bot',
        description: 'Triggers a workflow for questions asked to the bot',
        schema: z.object({
          message: z.string()
        }),
        executor: reportAnswers
      },
      {
        type: 'trigger_agent_call',
        label: 'Trigger Agent Call',
        description: 'Calls an Agent',
        schema: z.object({
          message: z.string()
        }),
        outputSchema: z.object({
          message: z.string()
        }),
        executor: callAgent
      }
    ]
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/mastra'
}

// {
//   "name": "athletes",
//   "fields": ["id", "name", "age", "jersey", "position", "experience", "college"],
//   "index": "athletes"
// },
// {
//   "name": "scores",
//   "fields": ["homeTeam", "winner", "score", "team", "id", "name", "shortName", "season", "week"],
//   "index": "scores"
// }
// {
//   "name": " news",
//   "fields": ["homeTeam", "winner", "score", "team", "id", "name", "shortName", "season", "week"],
//   "index": "news"
// }
