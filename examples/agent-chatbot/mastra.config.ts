import { SlackIntegration } from '@mastra/slack'
import { z } from 'zod'
// @ts-ignore
import { Config } from '@mastra/core';

async function getScore(day: string) {
  const response = await fetch(day)
  const data = await response.json()
  return data.events?.flatMap((e) => {
      return {
          id: e.id,
          name: e.name,
          shortName: e.shortName,
          season: e.season,
          week: e.week,
          competitions: e.competitions.map((c) => {
              return {
                  id: c.id,
                  teams: c.competitors.map((t) => {
                      return {
                          homeTeam: t.homeAway !== `away`,
                          winner: t.winner,
                          score: t.score,
                          team: t.team?.displayName,
                      }
                  }),

                  headlines: c.headlines?.map((h) => {
                      return {
                          description: h.description,
                          shortLinkText: h.shortLinkText,
                      }
                  }),
              }
          }),
      }
  })
}

async function getScores({ week, day }: { week: string, day?: string }) {
  const MONDAY = `https://site.api.espn.com/apis/site/v2/mondaynightfootball`
  const THURSDAY = `https://site.api.espn.com/apis/site/v2/thursdaynightfootball`
  const SUNDAY = `https://site.api.espn.com/apis/site/v2/sundaynightfootball`

  const res = {
      monday: await getScore(MONDAY),
      thursday: await getScore(THURSDAY),
      sunday: await getScore(SUNDAY),
  }

  if (day) {
      return res[day].filter((e) => e.week === parseInt(week, 10))
  }

  return orderBy([
      ...res.monday,
      ...res.thursday,
      ...res.sunday,
  ], 'week').filter((e) => e.week === parseInt(week, 10))
}

async function getTeams() {
  const TEAMS = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams`
  const response = await fetch(TEAMS)
  const data = await response.json()
  return data.sports?.[0].leagues?.[0].teams.map(({ team }) => {
      return {
          id: team.id,
          name: team.displayName,
      }
  })
}


async function getAthletesForTeam({ teamId, position }: { teamId: string, position: string }) {
  const URI = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/roster`
  const response = await fetch(URI)
  const data = await response.json()
  return (await Promise.all(data?.athletes?.flatMap(async (res) => {
      return res.items.map((a) => {
          return {
              id: a.id,
              name: a.fullName,
              age: a.age,
              jersey: a.jersey,
              position: a.position.abbreviation,
              experience: a.experience?.years,
              college: a.college?.name,
          }
      })
  }))).flatMap((a) => a).filter((a) => a.position === position)
}

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
          process.env.APP_URL,
        ).toString()}`,
        SCOPES: ['channels:manage', 'users:read', 'chat:write'],
      },
    }),
  ],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:5432/mastra?schema=mastra',
  },
  workflows: {
    blueprintDirPath: '/mastra-blueprints',
    systemEvents: {},
    systemApis: [
      {
        type: 'GET_SCORES_FOR_NFL_MATCHUPS',
        label: 'Provides scores for different NFL matchups by week',
        description: 'Provides scores for different NFL matchups by week',
        schema: z.object({
          week: z.string(),
          day: z.enum(['monday', 'thursday', 'sunday']),
        }),
        executor: async ({ data }: { data: { week: string, day: string } }) => {
          const scores = await getScores(data)
          return scores
        },
      },
      {
        type: 'GET_TEAMS_IN_NFL',
        label: 'Provides information for NFL teams',
        schema: z.object({}),
        executor: async () => {
          const teams = await getTeams()
          return teams
        },
      },
      {
        type: 'GET_ATHLETES_FOR_NFL_TEAM',
        label: 'Provides athlete information for NFL team',
        schema: z.object({ teamId: z.number(), position: z.enum(['PK', 'WR', 'QB', 'P']) }),
        executor: async ({ data }) => {
          const athlete = await getAthletesForTeam(data)
          return athlete
        },
      }
    ],
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/mastra',
};
