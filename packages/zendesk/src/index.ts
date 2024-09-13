
    import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@kpl/core';
    import { createClient, type OASClient, type NormalizeOAS } from 'fets'
    import { openapi } from './openapi'
    import { paths, components } from './openapi-def'

    // @ts-ignore
    import ZendeskLogo from './assets/zendesk.svg';


    type ZendeskConfig = {
      CLIENT_ID: string;
      CLIENT_SECRET: string;
      ZENDESK_SUBDOMAIN: string
      [key: string]: any;
    };


    export class ZendeskIntegration extends Integration {



      constructor({ config }: { config: ZendeskConfig }) {
        super({
          ...config,
          authType: IntegrationCredentialType.OAUTH,
          name: 'ZENDESK',
          logoUrl: ZendeskLogo,
        });
      }

      getOpenApiSpec() {
        return { paths, components } as unknown as OpenAPI;
      }


    getApiClient = async ({ referenceId }: { referenceId: string }): Promise<OASClient<NormalizeOAS<openapi>>> => {
      const connection = await this.dataLayer?.getConnectionByReferenceId({ name: this.name, referenceId })

      if (!connection) {
        throw new Error(`Connection not found for referenceId: ${referenceId}`)
      }

       const credential = await this.dataLayer?.getCredentialsByConnectionId(connection.id)
       const value = credential?.value as Record<string, string>

      const client = createClient<NormalizeOAS<openapi>>({
        endpoint: "https://{subdomain}.{domain}.com",
        globalParams: {
          headers: {
            Authorization: `Bearer ${value}`
          },
          params: {
            subdomain: this.config.ZENDESK_SUBDOMAIN,
            domain: 'zendesk'
          }
        }
      })

      return client as any
    }


      registerEvents() {
        this.events = {

        }
        return this.events;
      }


    getAuthenticator() {
      return new IntegrationAuth({
        dataAccess: this.dataLayer!,
        // @ts-ignore
        onConnectionCreated: () => {
          // TODO
        },
        config: {
          INTEGRATION_NAME: this.name,
          AUTH_TYPE: this.config.authType,
          CLIENT_ID: this.config.CLIENT_ID,
          CLIENT_SECRET: this.config.CLIENT_SECRET,
          REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
          SERVER: `https://${this.config.ZENDESK_SUBDOMAIN}.zendesk.com`,
          AUTHORIZATION_ENDPOINT: `https://${this.config.ZENDESK_SUBDOMAIN}.zendesk.com/oauth/authorizations/new`,
          TOKEN_ENDPOINT: `https://${this.config.ZENDESK_SUBDOMAIN}.zendesk.com/oauth/tokens`,
          SCOPES: ["impersonate", "write"],
        },
      });
    }

    }
