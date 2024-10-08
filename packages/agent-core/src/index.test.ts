import { z } from 'zod'
import { orderBy } from 'lodash'
import { SlackIntegration } from '@mastra/slack'
import { createAgent } from "."




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

async function sportsNews() {
    const URI = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=10000`
    const response = await fetch(URI)
    const data = await response.json()
    return data
}

//@ts-ignore
const slack = new SlackIntegration({
    config: {
        CLIENT_ID: "6419146185927.7282047357651",
        CLIENT_SECRET: "44276d86844a2bc028605b2f7db404f7"
    }
})

describe('Agent core', () => {

  


    it.only('tool test', async () => {
        // const score = await getScores({ week: '5' })
        console.log(await slack._convertApiClientToSystemApis())

        console.log(slack.apis.chatPostMessage)
    })

    it.skip('Does shit', async () => {
        const AGENT_TOOLS = {
            'send_message_to_slack': {
                description: slack.apis.chatPostMessage.label,
                parameters: slack.apis.chatPostMessage.schema,
                execute: async (props) => {
                    return await slack.apis.chatPostMessage.executor(props)
                }
            },
            'get_scores_from_matchups': {
                description: 'Provides scores for different NFL matchups by week',
                parameters: z.object({
                    week: z.string(),
                    day: z.enum(['monday', 'thursday', 'sunday']),
                }),
                execute: async ({ week, day }: { week: string, day: string }) => {
                    const scores = await getScores({ week: week, day })
                    return scores
                },
            },
            'get_teams_for_nfl': {
                description: 'Provides information about teams in the NFL',
                parameters: z.object({}),
                execute: async () => {
                    return await getTeams()
                },
            },
            'get_athletes_for_team': {
                description: 'Provides a list of athlete information for a NFL team',
                parameters: z.object({ teamId: z.number(), position: z.enum(['PK', 'WR', 'QB', 'P']) }),
                execute: async (props) => {
                    console.log(props)
                    return await getAthletesForTeam({ teamId: props.teamId, position: props.position })
                }
            },
            // 'get_sports_news': {
            //     description: 'Provides news on teams in the NFL',
            //     parameters: z.object({}),
            //     execute: async () => {
            //         return await sportsNews()
            //     }
            // },
        }

        const agent = createAgent({
            systemPrompt: `You are a sports analyst. You cover the NFL. When asked questions only leverage the tools given to you. If you do not have the information from a tool call, respond with "I do not have that information"`,
            tools: AGENT_TOOLS,
            resultTool: {
                description: 'Formatted result: returns information in structured format',
                parameters: z.object({
                    week: z.string(),
                    outcomes: z.array(z.object({
                        home_team: z.string(),
                        away_team: z.string(),
                        score: z.string(),
                        analysis: z.string(),
                        athlete: z.string(),
                    }))
                }),
                // parameters: z.object({ message: z.string() }),
            },
        })

        let responseMessages

        let res = await agent({ prompt: `Who won the thursday night game in Week 5 and who were the wide receivers for that winning team?` })

        responseMessages = res.responseMessages

        console.log(JSON.stringify(responseMessages, null, 2))

        // res = await agent({ prompt: `Who played in Week 4 and give me the scores and analysis?` })

        // responseMessages = res.responseMessages

        // console.log(JSON.stringify(responseMessages, null, 2))

        // res = await agent({ prompt: `Given the results from Week 4 and 5, who do you think will win the Super Bowl?` })

        // responseMessages = res.responseMessages

        // console.log(JSON.stringify(responseMessages, null, 2))
    }, 10000000)
})