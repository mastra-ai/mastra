import { ZendeskIntegration } from ".";

export async function main() {
    const zendesk = new ZendeskIntegration({
        config: {
            ZENDESK_SUBDOMAIN: process.env.ZENDESK_SUBDOMAIN || '',
            CLIENT_ID: process.env.CLIENT_ID || '',
            CLIENT_SECRET: process.env.CLIENT_SECRET || ''
        }
    })


    const client = await zendesk.getApiClient({ referenceId: '1' })

    const ticketsRes = await client['/api/v2/groups'].get({
        params: {
            user_id: 123
        },
        headers: {
            Authorization: `Basic ${process.env.ZENDESK_API_TOKEN}`
        }
    })

    const tickets = await ticketsRes.json()

    console.log(tickets)
}

main()
