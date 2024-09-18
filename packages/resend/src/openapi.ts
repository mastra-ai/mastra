// @ts-nocheck
export type openapi = {
  openapi: '3.0.3';
  servers: [
    {
      url: 'https://api.resend.com';
    },
  ];
  security: [
    {
      bearerAuth: [];
    },
  ];
  paths: {
    '/emails': {
      post: {
        tags: ['Emails'];
        summary: 'Send an email';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SendEmailRequest';
              };
            };
          };
        };
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SendEmailResponse';
                };
              };
            };
          };
        };
      };
    };
    '/emails/{email_id}': {
      get: {
        tags: ['Emails'];
        summary: 'Retrieve a single email';
        parameters: [
          {
            name: 'email_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The ID of the email.';
            };
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Email';
                };
              };
            };
          };
        };
      };
      patch: {
        tags: ['Emails'];
        summary: 'Update a single email';
        parameters: [
          {
            name: 'email_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The ID of the email.';
            };
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UpdateEmailOptions';
                };
              };
            };
          };
        };
      };
    };
    '/emails/{email_id}/cancel': {
      post: {
        tags: ['Emails'];
        summary: 'Cancel the schedule of the e-mail.';
        parameters: [
          {
            name: 'email_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The ID of the email.';
            };
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Email';
                };
              };
            };
          };
        };
      };
    };
    '/emails/batch': {
      post: {
        tags: ['Emails'];
        summary: 'Trigger up to 100 batch emails at once.';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/SendEmailRequest';
                };
              };
            };
          };
        };
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateBatchEmailsResponse';
                };
              };
            };
          };
        };
      };
    };
    '/domains': {
      post: {
        tags: ['Domains'];
        summary: 'Create a new domain';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateDomainRequest';
              };
            };
          };
        };
        responses: {
          '201': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateDomainResponse';
                };
              };
            };
          };
        };
      };
      get: {
        tags: ['Domains'];
        summary: 'Retrieve a list of domains';
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ListDomainsResponse';
                };
              };
            };
          };
        };
      };
    };
    '/domains/{domain_id}': {
      get: {
        tags: ['Domains'];
        summary: 'Retrieve a single domain';
        parameters: [
          {
            name: 'domain_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The ID of the domain.';
            };
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Domain';
                };
              };
            };
          };
        };
      };
      patch: {
        tags: ['Domains'];
        summary: 'Update an existing domain';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateDomainOptions';
              };
            };
          };
        };
        parameters: [
          {
            name: 'domain_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The ID of the domain.';
            };
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UpdateDomainResponseSuccess';
                };
              };
            };
          };
        };
      };
      delete: {
        tags: ['Domains'];
        summary: 'Remove an existing domain';
        parameters: [
          {
            name: 'domain_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The ID of the domain.';
            };
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DeleteDomainResponse';
                };
              };
            };
          };
        };
      };
    };
    '/domains/{domain_id}/verify': {
      post: {
        tags: ['Domains'];
        summary: 'Verify an existing domain';
        parameters: [
          {
            name: 'domain_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The ID of the domain.';
            };
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/VerifyDomainResponse';
                };
              };
            };
          };
        };
      };
    };
    '/api-keys': {
      post: {
        tags: ['API Keys'];
        summary: 'Create a new API key';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateApiKeyRequest';
              };
            };
          };
        };
        responses: {
          '201': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateApiKeyResponse';
                };
              };
            };
          };
        };
      };
      get: {
        tags: ['API Keys'];
        summary: 'Retrieve a list of API keys';
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ListApiKeysResponse';
                };
              };
            };
          };
        };
      };
    };
    '/api-keys/{api_key_id}': {
      delete: {
        tags: ['API Keys'];
        summary: 'Remove an existing API key';
        parameters: [
          {
            name: 'api_key_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The API key ID.';
            };
          },
        ];
        responses: {
          '200': {
            description: 'OK';
          };
        };
      };
    };
    '/audiences': {
      post: {
        tags: ['Audiences'];
        summary: 'Create a list of contacts';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateAudienceOptions';
              };
            };
          };
        };
        responses: {
          '201': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateAudienceResponseSuccess';
                };
              };
            };
          };
        };
      };
      get: {
        tags: ['Audiences'];
        summary: 'Retrieve a list of audiences';
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ListAudiencesResponseSuccess';
                };
              };
            };
          };
        };
      };
    };
    '/audiences/{id}': {
      delete: {
        tags: ['Audiences'];
        summary: 'Remove an existing audience';
        parameters: [
          {
            name: 'id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The Audience ID.';
            };
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RemoveAudienceResponseSuccess';
                };
              };
            };
          };
        };
      };
      get: {
        tags: ['Audiences'];
        summary: 'Retrieve a single audience';
        parameters: [
          {
            name: 'id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The Audience ID.';
            };
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GetAudienceResponseSuccess';
                };
              };
            };
          };
        };
      };
    };
    '/audiences/{audience_id}/contacts': {
      post: {
        tags: ['Contacts'];
        summary: 'Create a new contact';
        parameters: [
          {
            name: 'audience_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The Audience ID.';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateContactOptions';
              };
            };
          };
        };
        responses: {
          '201': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateContactResponseSuccess';
                };
              };
            };
          };
        };
      };
      get: {
        tags: ['Contacts'];
        summary: 'Retrieve a list of contacts';
        parameters: [
          {
            name: 'audience_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The Audience ID.';
            };
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ListContactsResponseSuccess';
                };
              };
            };
          };
        };
      };
    };
    '/audiences/{audience_id}/contacts/{email}': {
      delete: {
        tags: ['Contacts'];
        summary: 'Remove an existing contact by email';
        parameters: [
          {
            name: 'email';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The Contact ID.';
            };
          },
          {
            name: 'audience_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The Audience ID.';
            };
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RemoveContactResponseSuccess';
                };
              };
            };
          };
        };
      };
    };
    '/audiences/{audience_id}/contacts/{id}': {
      delete: {
        tags: ['Contacts'];
        summary: 'Remove an existing contact by id';
        parameters: [
          {
            name: 'id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The Contact ID.';
            };
          },
          {
            name: 'audience_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The Audience ID.';
            };
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RemoveContactResponseSuccess';
                };
              };
            };
          };
        };
      };
      get: {
        tags: ['Contacts'];
        summary: 'Retrieve a single contact';
        parameters: [
          {
            name: 'id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The Contact ID.';
            };
          },
          {
            name: 'audience_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The Audience ID.';
            };
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GetContactResponseSuccess';
                };
              };
            };
          };
        };
      };
      patch: {
        tags: ['Contacts'];
        summary: 'Update a single contact';
        parameters: [
          {
            name: 'id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The Contact ID.';
            };
          },
          {
            name: 'audience_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              description: 'The Audience ID.';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateContactOptions';
              };
            };
          };
        };
        responses: {
          '200': {
            description: 'OK';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UpdateContactResponseSuccess';
                };
              };
            };
          };
        };
      };
    };
  };
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http';
        scheme: 'bearer';
      };
    };
    schemas: {
      SendEmailRequest: {
        type: 'object';
        required: ['from', 'to', 'subject'];
        properties: {
          from: {
            type: 'string';
            description: 'Sender email address. To include a friendly name, use the format "Your Name <sender@domain.com>".';
          };
          to: {
            type: 'array';
            items: {
              type: 'string';
              description: 'Recipient email address. For multiple addresses, send as an array of strings. Max 50.';
            };
          };
          subject: {
            type: 'string';
            description: 'Email subject.';
          };
          bcc: {
            type: 'string';
            description: 'Bcc recipient email address. For multiple addresses, send as an array of strings.';
          };
          cc: {
            type: 'string';
            description: 'Cc recipient email address. For multiple addresses, send as an array of strings.';
          };
          reply_to: {
            type: 'string';
            description: 'Reply-to email address. For multiple addresses, send as an array of strings.';
          };
          html: {
            type: 'string';
            description: 'The HTML version of the message.';
          };
          text: {
            type: 'string';
            description: 'The plain text version of the message.';
          };
          headers: {
            type: 'object';
            description: 'Custom headers to add to the email.';
          };
          scheduled_at: {
            type: 'string';
            description: 'Schedule email to be sent later. The date should be in ISO 8601 format.';
          };
          attachments: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/Attachment';
            };
          };
          tags: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/Tag';
            };
          };
        };
      };
      Attachment: {
        type: 'object';
        properties: {
          content: {
            type: 'string';
            format: 'binary';
            description: 'Content of an attached file.';
          };
          filename: {
            type: 'string';
            description: 'Name of attached file.';
          };
          path: {
            type: 'string';
            description: 'Path where the attachment file is hosted';
          };
          content_type: {
            type: 'string';
            description: 'Optional content type for the attachment, if not set it will be derived from the filename property';
          };
        };
      };
      Tag: {
        type: 'object';
        properties: {
          name: {
            type: 'string';
            description: 'The name of the email tag. It can only contain ASCII letters (a–z, A–Z), numbers (0–9), underscores (_), or dashes (-). It can contain no more than 256 characters.';
          };
          value: {
            type: 'string';
            description: 'The value of the email tag.It can only contain ASCII letters (a–z, A–Z), numbers (0–9), underscores (_), or dashes (-). It can contain no more than 256 characters.';
          };
        };
      };
      SendEmailResponse: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
            description: 'The ID of the sent email.';
          };
        };
      };
      UpdateEmailOptions: {
        type: 'object';
        properties: {
          scheduled_at: {
            type: 'string';
            description: 'Schedule email to be sent later. The date should be in ISO 8601 format.';
          };
        };
      };
      Email: {
        type: 'object';
        properties: {
          object: {
            type: 'string';
            description: 'The type of object.';
            example: 'email';
          };
          id: {
            type: 'string';
            description: 'The ID of the email.';
            example: '4ef9a417-02e9-4d39-ad75-9611e0fcc33c';
          };
          to: {
            type: 'array';
            items: {
              type: 'string';
              description: 'The email addresses of the recipients.';
            };
            example: ['delivered@resend.dev'];
          };
          from: {
            type: 'string';
            description: 'The email address of the sender.';
            example: 'Acme <onboarding@resend.dev>';
          };
          created_at: {
            type: 'string';
            format: 'date-time';
            description: 'The date and time the email was created.';
            example: '2023-04-03T22:13:42.674981+00:00';
          };
          subject: {
            type: 'string';
            description: 'The subject line of the email.';
            example: 'Hello World';
          };
          html: {
            type: 'string';
            description: 'The HTML body of the email.';
            example: 'Congrats on sending your <strong>first email</strong>!';
          };
          text: {
            type: 'string';
            description: 'The plain text body of the email.';
          };
          bcc: {
            type: 'array';
            items: {
              type: 'string';
            };
            description: 'The email addresses of the blind carbon copy recipients.';
          };
          cc: {
            type: 'array';
            items: {
              type: 'string';
            };
            description: 'The email addresses of the carbon copy recipients.';
          };
          reply_to: {
            type: 'array';
            items: {
              type: 'string';
            };
            description: 'The email addresses to which replies should be sent.';
          };
          last_event: {
            type: 'string';
            description: 'The status of the email.';
            example: 'delivered';
          };
        };
      };
      CreateBatchEmailsResponse: {
        type: 'object';
        properties: {
          data: {
            type: 'array';
            items: {
              type: 'object';
              properties: {
                id: {
                  type: 'string';
                  description: 'The ID of the sent email.';
                };
              };
            };
          };
        };
      };
      CreateDomainRequest: {
        type: 'object';
        required: ['name'];
        properties: {
          name: {
            type: 'string';
            description: 'The name of the domain you want to create.';
          };
          region: {
            type: 'string';
            enum: ['us-east-1', 'eu-west-1', 'sa-east-1'];
            default: 'us-east-1';
            description: "The region where emails will be sent from. Possible values are us-east-1' | 'eu-west-1' | 'sa-east-1";
          };
        };
      };
      CreateDomainResponse: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
            description: 'The ID of the domain.';
          };
          name: {
            type: 'string';
            description: 'The name of the domain.';
          };
          created_at: {
            type: 'string';
            format: 'date-time';
            description: 'The date and time the domain was created.';
          };
          status: {
            type: 'string';
            description: 'The status of the domain.';
          };
          records: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/DomainRecord';
            };
          };
          region: {
            type: 'string';
            description: 'The region where the domain is hosted.';
          };
        };
      };
      UpdateDomainOptions: {
        type: 'object';
        properties: {
          open_tracking: {
            type: 'boolean';
            description: 'Track the open rate of each email.';
          };
          click_tracking: {
            type: 'boolean';
            description: 'Track clicks within the body of each HTML email.';
          };
          tls: {
            type: 'string';
            description: 'enforced | opportunistic.';
            default: 'opportunistic';
          };
        };
      };
      DomainRecord: {
        type: 'object';
        properties: {
          record: {
            type: 'string';
            description: 'The type of record.';
          };
          name: {
            type: 'string';
            description: 'The name of the record.';
          };
          type: {
            type: 'string';
            description: 'The type of record.';
          };
          ttl: {
            type: 'string';
            description: 'The time to live for the record.';
          };
          status: {
            type: 'string';
            description: 'The status of the record.';
          };
          value: {
            type: 'string';
            description: 'The value of the record.';
          };
          priority: {
            type: 'integer';
            description: 'The priority of the record.';
          };
        };
      };
      Domain: {
        type: 'object';
        properties: {
          object: {
            type: 'string';
            description: 'The type of object.';
            example: 'domain';
          };
          id: {
            type: 'string';
            description: 'The ID of the domain.';
            example: 'd91cd9bd-1176-453e-8fc1-35364d380206';
          };
          name: {
            type: 'string';
            description: 'The name of the domain.';
            example: 'example.com';
          };
          status: {
            type: 'string';
            description: 'The status of the domain.';
            example: 'not_started';
          };
          created_at: {
            type: 'string';
            format: 'date-time';
            description: 'The date and time the domain was created.';
            example: '2023-04-26T20:21:26.347412+00:00';
          };
          region: {
            type: 'string';
            description: 'The region where the domain is hosted.';
            example: 'us-east-1';
          };
          records: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/DomainRecord';
            };
          };
        };
      };
      VerifyDomainResponse: {
        type: 'object';
        properties: {
          object: {
            type: 'string';
            description: 'The type of object.';
            example: 'domain';
          };
          id: {
            type: 'string';
            description: 'The ID of the domain.';
            example: 'd91cd9bd-1176-453e-8fc1-35364d380206';
          };
        };
      };
      ListDomainsResponse: {
        type: 'object';
        properties: {
          data: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/ListDomainsItem';
            };
          };
        };
      };
      ListDomainsItem: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
            description: 'The ID of the domain.';
            example: 'd91cd9bd-1176-453e-8fc1-35364d380206';
          };
          name: {
            type: 'string';
            description: 'The name of the domain.';
            example: 'example.com';
          };
          status: {
            type: 'string';
            description: 'The status of the domain.';
            example: 'not_started';
          };
          created_at: {
            type: 'string';
            format: 'date-time';
            description: 'The date and time the domain was created.';
            example: '2023-04-26T20:21:26.347412+00:00';
          };
          region: {
            type: 'string';
            description: 'The region where the domain is hosted.';
            example: 'us-east-1';
          };
        };
      };
      UpdateDomainResponseSuccess: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
            description: 'The ID of the updated domain.';
            example: 'd91cd9bd-1176-453e-8fc1-35364d380206';
          };
          object: {
            type: 'string';
            description: 'The object type representing the updated domain.';
            example: 'domain';
          };
        };
      };
      DeleteDomainResponse: {
        type: 'object';
        properties: {
          object: {
            type: 'string';
            description: 'The type of object.';
            example: 'domain';
          };
          id: {
            type: 'string';
            description: 'The ID of the domain.';
            example: 'd91cd9bd-1176-453e-8fc1-35364d380206';
          };
          deleted: {
            type: 'boolean';
            description: 'Indicates whether the domain was deleted successfully.';
            example: true;
          };
        };
      };
      CreateApiKeyRequest: {
        type: 'object';
        required: ['name'];
        properties: {
          name: {
            type: 'string';
            description: 'The API key name.';
          };
          permission: {
            type: 'string';
            enum: ['full_access', 'sending_access'];
            description: 'The API key can have full access to Resend’s API or be only restricted to send emails. * full_access - Can create, delete, get, and update any resource. * sending_access - Can only send emails.';
          };
          domain_id: {
            type: 'string';
            description: 'Restrict an API key to send emails only from a specific domain. Only used when the permission is sending_acces.';
          };
        };
      };
      CreateApiKeyResponse: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
            description: 'The ID of the API key.';
          };
          token: {
            type: 'string';
            description: 'The token of the API key.';
          };
        };
      };
      ListApiKeysResponse: {
        type: 'object';
        properties: {
          data: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/ApiKey';
            };
          };
        };
      };
      ApiKey: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
            description: 'The ID of the API key.';
          };
          name: {
            type: 'string';
            description: 'The name of the API key.';
          };
          created_at: {
            type: 'string';
            format: 'date-time';
            description: 'The date and time the API key was created.';
          };
        };
      };
      CreateAudienceOptions: {
        type: 'object';
        required: ['name'];
        properties: {
          name: {
            type: 'string';
            description: 'The name of the audience you want to create.';
          };
        };
      };
      CreateAudienceResponseSuccess: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
            description: 'The ID of the audience.';
            example: '78261eea-8f8b-4381-83c6-79fa7120f1cf';
          };
          object: {
            type: 'string';
            description: 'The object of the audience.';
            example: 'audience';
          };
          name: {
            type: 'string';
            description: 'The name of the audience.';
            example: 'Registered Users';
          };
        };
      };
      GetAudienceResponseSuccess: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
            description: 'The ID of the audience.';
            example: '78261eea-8f8b-4381-83c6-79fa7120f1cf';
          };
          object: {
            type: 'string';
            description: 'The object of the audience.';
            example: 'audience';
          };
          name: {
            type: 'string';
            description: 'The name of the audience.';
            example: 'Registered Users';
          };
          created_at: {
            type: 'string';
            description: 'The date that the object was created.';
            example: '2023-10-06T22:59:55.977Z';
          };
        };
      };
      RemoveAudienceResponseSuccess: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
            description: 'The ID of the audience.';
            example: '78261eea-8f8b-4381-83c6-79fa7120f1cf';
          };
          object: {
            type: 'string';
            description: 'The object of the audience.';
            example: 'audience';
          };
          deleted: {
            type: 'boolean';
            description: 'The deleted attribute indicates that the corresponding audience has been deleted.';
            example: true;
          };
        };
      };
      ListAudiencesResponseSuccess: {
        type: 'object';
        properties: {
          object: {
            type: 'string';
            description: 'Type of the response object.';
            example: 'list';
          };
          data: {
            type: 'array';
            description: 'Array containing audience information.';
            items: {
              type: 'object';
              properties: {
                id: {
                  type: 'string';
                  description: 'Unique identifier for the audience.';
                  example: '78261eea-8f8b-4381-83c6-79fa7120f1cf';
                };
                name: {
                  type: 'string';
                  description: 'Name of the audience.';
                  example: 'Registered Users';
                };
                created_at: {
                  type: 'string';
                  format: 'date-time';
                  description: 'Timestamp indicating when the audience was created.';
                  example: '2023-10-06T22:59:55.977Z';
                };
              };
            };
          };
        };
      };
      CreateContactOptions: {
        type: 'object';
        required: ['email'];
        properties: {
          email: {
            type: 'string';
            description: 'Email address of the contact.';
            example: 'steve.wozniak@gmail.com';
          };
          first_name: {
            type: 'string';
            description: 'First name of the contact.';
            example: 'Steve';
          };
          last_name: {
            type: 'string';
            description: 'Last name of the contact.';
            example: 'Wozniak';
          };
          unsubscribed: {
            type: 'boolean';
            description: 'Indicates if the contact is unsubscribed.';
            example: false;
          };
          audience_id: {
            type: 'string';
            description: 'Unique identifier of the audience to which the contact belongs.';
            example: '78261eea-8f8b-4381-83c6-79fa7120f1cf';
          };
        };
      };
      CreateContactResponseSuccess: {
        type: 'object';
        properties: {
          object: {
            type: 'string';
            description: 'Type of the response object.';
            example: 'contact';
          };
          id: {
            type: 'string';
            description: 'Unique identifier for the created contact.';
            example: '479e3145-dd38-476b-932c-529ceb705947';
          };
        };
      };
      GetContactResponseSuccess: {
        type: 'object';
        properties: {
          object: {
            type: 'string';
            description: 'Type of the response object.';
            example: 'contact';
          };
          id: {
            type: 'string';
            description: 'Unique identifier for the contact.';
            example: 'e169aa45-1ecf-4183-9955-b1499d5701d3';
          };
          email: {
            type: 'string';
            description: 'Email address of the contact.';
            example: 'steve.wozniak@gmail.com';
          };
          first_name: {
            type: 'string';
            description: 'First name of the contact.';
            example: 'Steve';
          };
          last_name: {
            type: 'string';
            description: 'Last name of the contact.';
            example: 'Wozniak';
          };
          created_at: {
            type: 'string';
            format: 'date-time';
            description: 'Timestamp indicating when the contact was created.';
            example: '2023-10-06T23:47:56.678Z';
          };
          unsubscribed: {
            type: 'boolean';
            description: 'Indicates if the contact is unsubscribed.';
            example: false;
          };
        };
      };
      UpdateContactOptions: {
        type: 'object';
        properties: {
          email: {
            type: 'string';
            description: 'Email address of the contact.';
            example: 'steve.wozniak@gmail.com';
          };
          first_name: {
            type: 'string';
            description: 'First name of the contact.';
            example: 'Steve';
          };
          last_name: {
            type: 'string';
            description: 'Last name of the contact.';
            example: 'Wozniak';
          };
          unsubscribed: {
            type: 'boolean';
            description: 'Indicates the subscription status of the contact.';
            example: false;
          };
        };
      };
      UpdateContactResponseSuccess: {
        type: 'object';
        properties: {
          object: {
            type: 'string';
            description: 'Type of the response object.';
            example: 'contact';
          };
          id: {
            type: 'string';
            description: 'Unique identifier for the updated contact.';
            example: '479e3145-dd38-476b-932c-529ceb705947';
          };
        };
      };
      RemoveContactResponseSuccess: {
        type: 'object';
        properties: {
          object: {
            type: 'string';
            description: 'Type of the response object.';
            example: 'contact';
          };
          id: {
            type: 'string';
            description: 'Unique identifier for the removed contact.';
            example: '520784e2-887d-4c25-b53c-4ad46ad38100';
          };
          deleted: {
            type: 'boolean';
            description: 'Indicates whether the contact was successfully deleted.';
            example: true;
          };
        };
      };
      ListContactsResponseSuccess: {
        type: 'object';
        properties: {
          object: {
            type: 'string';
            description: 'Type of the response object.';
            example: 'list';
          };
          data: {
            type: 'array';
            description: 'Array containing contact information.';
            items: {
              type: 'object';
              properties: {
                id: {
                  type: 'string';
                  description: 'Unique identifier for the contact.';
                  example: 'e169aa45-1ecf-4183-9955-b1499d5701d3';
                };
                email: {
                  type: 'string';
                  description: 'Email address of the contact.';
                  example: 'steve.wozniak@gmail.com';
                };
                first_name: {
                  type: 'string';
                  description: 'First name of the contact.';
                  example: 'Steve';
                };
                last_name: {
                  type: 'string';
                  description: 'Last name of the contact.';
                  example: 'Wozniak';
                };
                created_at: {
                  type: 'string';
                  format: 'date-time';
                  description: 'Timestamp indicating when the contact was created.';
                  example: '2023-10-06T23:47:56.678Z';
                };
                unsubscribed: {
                  type: 'boolean';
                  description: 'Indicates if the contact is unsubscribed.';
                  example: false;
                };
              };
            };
          };
        };
      };
    };
  };
};
