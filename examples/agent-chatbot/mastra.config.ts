import { SlackIntegration } from '@mastra/slack'
import { z } from 'zod'
// @ts-ignore
import { Config } from '@mastra/core'
import { vectorQueryEngine } from '@mastra/agent-core'
import { 
  getAthletesForTeam, 
  getScores, 
  getSportsNews, 
  getTeams, 
  reportAnswers, 
  sendSlackMessage, 
  syncTeams, 
  vectorSync
} from './lib/mastra/system-apis'

export const config: Config = {
  name: 'agent-chatbot',
  integrations: [
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
      VECTOR_SYNC: {
        label: 'Sync vector data',
        description: 'Sync vector data',
        schema: z.object({
          agentId: z.string(),
        }),
        handler: vectorSync
      },
      SYNC_TEAMS: {
        label: 'Sync teams',
        description: 'Sync teams',
        schema: z.object({}),
        handler: syncTeams
      }
    },
    systemApis: [
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
        type: 'get_teams_in_nfl',
        label: 'Provides information for NFL teams',
        description: 'Provides information for NFL teams',
        schema: z.object({
          content: z.string()
        }),
        executor: async ({ data }) => {
          const res = await vectorQueryEngine({ indexName: 'teams', content: data.content, entityType: 'teams' })
          console.log(JSON.stringify({ res }, null, 2))

          return res
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
          channelId: z.string(),
        }),
        executor: sendSlackMessage,
      },
      {
        type: 'report_answers_to_slack',
        label: 'Triggers a workflow for questions asked to the bot',
        description: 'Triggers a workflow for questions asked to the bot',
        schema: z.object({
          message: z.string(),
        }),
        executor: reportAnswers
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