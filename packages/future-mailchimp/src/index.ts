import { IntegrationPlugin } from 'core'
import { z } from 'zod'
import { mailchimpSync } from './events/sync';

type MailchimpConfig = {
    CLIENT_ID: string;
    CLIENT_SECRET: string;
    REDIRECT_URI: string;
    [key: string]: any;
  };
  
console.log(IntegrationPlugin)

  export class MailchimpIntegration extends IntegrationPlugin {
    config: MailchimpConfig;

    constructor({ config }: { config: MailchimpConfig }) {
        config.authType = `OAUTH`;
    
        super({
          ...config,
          name: 'MAILCHIMP',
          logoUrl: '/images/integrations/mailchimp.svg',
        });
    
        this.config = config;
      }
    
      defineEvents() {
        this.events = {
          SYNC: {
            key: 'mailchimp/sync.table',
            schema: z.object({
              syncTableId: z.string(),
            }),
          },
        };
    
        return this.events;
      }

      getEventHandlers() {
        return [
          mailchimpSync({
            name: this.name,
            event: this.getEventKey('SYNC'),
            dataLayer: this.dataLayer!,
          }),
        ];
      }
    
  }