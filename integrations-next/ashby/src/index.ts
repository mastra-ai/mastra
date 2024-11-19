
    import { Integration, ToolApi } from '@mastra/core';
    import * as zodSchema from './client/zodSchema';
    import * as integrationClient from './client/services.gen';
    import {comments} from './client/service-comments';
    
    // @ts-ignore
    import AshbyLogo from './assets/ashby.png';

    
    type AshbyConfig = {
      API_KEY: string
      [key: string]: any;
    };
    

    export class AshbyIntegration extends Integration {
      readonly name = 'ASHBY'
      readonly logoUrl = AshbyLogo
      config: AshbyConfig
      readonly tools: Record<Exclude<keyof typeof integrationClient, 'client'>, ToolApi>;
      categories = ["hr","communications"]
      description = 'Ashby is a platform for managing your team’s onboarding, offboarding, and everything in between.'
      

      
    constructor({ config }: { config: AshbyConfig }) {
        super();

        this.config = config;
        this.tools = this._generateIntegrationTools<typeof this.tools>();
      }
    

      protected get toolSchemas() {
        return zodSchema;
      }

      protected get toolDocumentations() {
        return comments;
      }

     protected get baseClient() {
        integrationClient.client.setConfig({
          baseUrl: `https://api.ashbyhq.com`,
        });
        return integrationClient;
      }

      
    getApiClient = async () => {
     
      const value = {
        'API_KEY': this.config?.['API_KEY'],
        
      } as Record<string, any>

      const baseClient = this.baseClient;

      baseClient.client.interceptors.request.use((request, options) => {
        request.headers.set('Authorization', `Basic ${btoa(`${value?.['API_KEY']}`)}`);
        return request;
      });

      return integrationClient;
    }
    

      
    }
  