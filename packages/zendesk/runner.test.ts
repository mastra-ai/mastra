import { ZendeskIntegration } from ".";

export async function main() {
    const zendesk = new ZendeskIntegration({
        config: {
            ZENDESK_SUBDOMAIN: process.env.ZENDESK_SUBDOMAIN || '',
            CLIENT_ID: process.env.CLIENT_ID || '',
            CLIENT_SECRET: process.env.CLIENT_SECRET || ''
        }
    })


    const client = await zendesk.getApiClient({ referenceId: '123' })

    const ticketsRes = await client["/tickets"].get()

    const tickets = await ticketsRes.json()

    console.log(tickets)
}
