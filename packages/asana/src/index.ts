
    import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@arkw/core';
    import { createClient, type OASClient, type NormalizeOAS } from 'fets'
    import openapi from './openapi'
    
    // @ts-ignore
    import AsanaLogo from './assets/asana.svg';

    
    type AsanaConfig = {
      CLIENT_ID: string;
      CLIENT_SECRET: string;
      [key: string]: any;
    };
  

    export class AsanaIntegration extends Integration {
      


      constructor({ config }: { config: AsanaConfig }) {
        super({
          ...config,
          authType: IntegrationCredentialType.OAUTH,
          name: 'ASANA',
          logoUrl: AsanaLogo,
        });
      }

      getOpenApiSpec() {
        return openapi as unknown as OpenAPI;
      }

      
    getApiClient = async ({ referenceId }: { referenceId: string }): Promise<OASClient<NormalizeOAS<typeof openapi>>> => {
      const connection = await this.dataLayer?.getConnectionByReferenceId({ name: this.name, referenceId })
  
      if (!connection) {
        throw new Error(`Connection not found for referenceId: ${referenceId}`)
      }
  
       const credential = await this.dataLayer?.getCredentialsByConnectionId(connection.id)
       const value = credential?.value as Record<string, string>
  
      const client = createClient<NormalizeOAS<typeof openapi>>({
        endpoint: "https://app.asana.com/api/1.0",
        globalParams: {
          headers: {
            Authorization: `Bearer ${value}`
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
          SERVER: `https://app.asana.com`,
          AUTHORIZATION_ENDPOINT: '/-/oauth_authorize',
          TOKEN_ENDPOINT: '/-/oauth_token',
          SCOPES: [],
        },
      });
    }
    
    }
  