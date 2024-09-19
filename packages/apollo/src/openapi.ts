// @ts-nocheck
export type openapi = {
  openapi: '3.1.0';
  servers: [
    {
      url: 'https://app.apollo.io/api';
    },
  ];
  security: [
    {
      api_key: [];
    },
  ];
  paths: {
    '/v1/emailer_campaigns/{id}': {
      get: {
        operationId: 'getEmailerCampaign';
        parameters: [
          {
            in: 'path';
            name: 'id';
            schema: {
              type: 'string';
            };
            required: true;
          },
        ];
        requestBody: {
          content: {
            'application/json': {};
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                  properties: {
                    emailer_campaign: {
                      $ref: '#/components/schemas/emailer_campaign';
                    };
                    emailer_steps: {
                      type: ['array', 'null'];
                      items: {
                        $ref: '#/components/schemas/emailer_step';
                      };
                    };
                    emailer_touches: {
                      type: ['array', 'null'];
                      items: {
                        $ref: '#/components/schemas/emailer_touch';
                      };
                    };
                    emailer_templates: {
                      type: ['array', 'null'];
                      items: {
                        $ref: '#/components/schemas/emailer_template';
                      };
                    };
                  };
                  required: ['emailer_campaign'];
                };
              };
            };
          };
        };
      };
    };
    '/v1/emailer_campaigns': {
      post: {
        operationId: 'createEmailerCampaign';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object';
                properties: {
                  name: {
                    type: ['string', 'null'];
                  };
                  permissions: {
                    type: 'string';
                    enum: ['team_can_use', 'team_can_view', 'private'];
                  };
                  user_id: {
                    type: ['string', 'null'];
                  };
                  label_ids: {
                    type: 'array';
                    items: {
                      type: 'string';
                    };
                  };
                  active: {
                    type: 'boolean';
                  };
                };
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                  properties: {
                    emailer_campaign: {
                      $ref: '#/components/schemas/emailer_campaign';
                    };
                    emailer_steps: {
                      type: ['array', 'null'];
                      items: {
                        $ref: '#/components/schemas/emailer_step';
                      };
                    };
                    emailer_touches: {
                      type: ['array', 'null'];
                      items: {
                        $ref: '#/components/schemas/emailer_touch';
                      };
                    };
                    emailer_templates: {
                      type: ['array', 'null'];
                      items: {
                        $ref: '#/components/schemas/emailer_template';
                      };
                    };
                  };
                  required: ['emailer_campaign'];
                };
              };
            };
          };
        };
      };
    };
    '/v1/emailer_campaigns/{id}/add_contact_ids': {
      post: {
        operationId: 'addContactIdsToEmailerCampaign';
        parameters: [
          {
            in: 'path';
            name: 'id';
            schema: {
              type: 'string';
            };
            required: true;
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object';
                properties: {
                  contact_ids: {
                    type: 'array';
                    items: {
                      type: 'string';
                    };
                  };
                  emailer_campaign_id: {
                    type: 'string';
                  };
                  send_email_from_email_account_id: {
                    type: 'string';
                  };
                  userId: {
                    type: ['string', 'null'];
                  };
                  sequence_active_in_other_campaigns: {
                    type: 'boolean';
                    description: '\n    By default Apollo will not add contact to more than one sequence at a time. However if we pass "true"\n    to this field, it will add the contact to the sequence even if they are already in another sequence.\n  ';
                  };
                };
                required: ['contact_ids', 'emailer_campaign_id', 'send_email_from_email_account_id'];
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                  properties: {
                    contacts: {
                      type: 'array';
                      items: {
                        $ref: '#/components/schemas/contact';
                      };
                    };
                  };
                  required: ['contacts'];
                };
              };
            };
          };
        };
      };
    };
    '/v1/emailer_steps': {
      post: {
        operationId: 'createEmailerStep';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object';
                properties: {
                  emailer_campaign_id: {
                    type: 'string';
                  };
                  priority: {
                    type: ['string', 'null'];
                  };
                  position: {
                    type: ['number', 'null'];
                  };
                  type: {
                    $ref: '#/components/schemas/emailer_step_type';
                  };
                  wait_mode: {
                    $ref: '#/components/schemas/emailer_step_wait_mode';
                  };
                  wait_time: {
                    type: ['number', 'null'];
                  };
                  exact_datetime: {
                    type: ['string', 'null'];
                  };
                  note: {
                    type: ['string', 'null'];
                  };
                };
                required: ['emailer_campaign_id', 'type', 'wait_mode'];
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                  properties: {
                    emailer_step: {
                      $ref: '#/components/schemas/emailer_step';
                    };
                    emailer_touch: {
                      oneOf: [
                        {
                          $ref: '#/components/schemas/emailer_touch';
                        },
                        {
                          type: 'null';
                        },
                      ];
                    };
                    emailer_template: {
                      oneOf: [
                        {
                          $ref: '#/components/schemas/emailer_template';
                        },
                        {
                          type: 'null';
                        },
                      ];
                    };
                  };
                  required: ['emailer_step'];
                };
              };
            };
          };
        };
      };
    };
    '/v1/emailer_steps/{id}': {
      delete: {
        operationId: 'deleteEmailerStep';
        parameters: [
          {
            in: 'path';
            name: 'id';
            schema: {
              type: 'string';
            };
            required: true;
          },
        ];
        requestBody: {
          content: {
            'application/json': {};
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                  properties: {
                    emailer_step: {
                      type: 'object';
                      properties: {
                        id: {
                          type: 'string';
                        };
                        deleted: {
                          type: 'boolean';
                        };
                      };
                      required: ['id', 'deleted'];
                    };
                  };
                  required: ['emailer_step'];
                };
              };
            };
          };
        };
      };
    };
    '/v1/emailer_touches/{id}': {
      put: {
        operationId: 'updateEmailerTouch';
        parameters: [
          {
            in: 'path';
            name: 'id';
            schema: {
              type: 'string';
            };
            required: true;
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object';
                properties: {
                  id: {
                    type: 'string';
                  };
                  emailer_step_id: {
                    type: ['string', 'null'];
                  };
                  emailer_template: {
                    oneOf: [
                      {
                        $ref: '#/components/schemas/emailer_template';
                      },
                      {
                        type: 'null';
                      },
                    ];
                  };
                  type: {
                    type: ['string', 'null'];
                    enum: ['reply_to_thread', 'new_thread'];
                  };
                };
                required: ['id'];
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                  properties: {
                    emailer_touch: {
                      $ref: '#/components/schemas/emailer_touch';
                    };
                  };
                  required: ['emailer_touch'];
                };
              };
            };
          };
        };
      };
    };
    '/v1/contacts/{id}': {
      get: {
        operationId: 'getContact';
        parameters: [
          {
            in: 'path';
            name: 'id';
            schema: {
              type: 'string';
            };
            required: true;
          },
        ];
        requestBody: {
          content: {
            'application/json': {};
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                  properties: {
                    contact: {
                      $ref: '#/components/schemas/contact';
                    };
                  };
                  required: ['contact'];
                };
              };
            };
          };
        };
      };
    };
    '/v1/contacts/search': {
      post: {
        operationId: 'searchContacts';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object';
                properties: {
                  q_keywords: {
                    type: 'string';
                    description: "The contact's name, title, company, or email";
                  };
                  contact_stage_ids: {
                    type: 'array';
                    items: {
                      type: 'string';
                    };
                    description: 'An array of stage ids the contact must belong to. Refer to /contact_stages to get a list of possible stage ids.';
                  };
                  sort_by_field: {
                    type: 'string';
                    enum: [
                      'contact_last_activity_date',
                      'contact_email_last_opened_at',
                      'contact_email_last_clicked_at',
                      'contact_created_at',
                      'contact_updated_at',
                    ];
                    description: '\tPossible values: "contact_last_activity_date", "contact_email_last_opened_at", "contact_email_last_clicked_at", "contact_created_at", or "contact_updated_at"';
                  };
                  sort_ascending: {
                    type: 'boolean';
                    description: 'Possible values: true or false';
                  };
                  page: {
                    type: 'number';
                    description: 'Which page to return. Defaults to 1';
                  };
                };
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                  properties: {
                    contacts: {
                      type: 'array';
                      items: {
                        $ref: '#/components/schemas/contact';
                      };
                    };
                    pagination: {
                      type: 'object';
                      properties: {
                        page: {
                          type: 'number';
                        };
                        per_page: {
                          type: 'number';
                        };
                        total_entries: {
                          type: 'number';
                        };
                        total_pages: {
                          type: 'number';
                        };
                      };
                      required: ['page', 'per_page', 'total_entries', 'total_pages'];
                    };
                  };
                  required: ['contacts', 'pagination'];
                };
              };
            };
          };
        };
      };
    };
    '/v1/email_accounts': {
      get: {
        operationId: 'listEmailAccounts';
        requestBody: {
          content: {
            'application/json': {};
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                  properties: {
                    email_accounts: {
                      type: 'array';
                      items: {
                        $ref: '#/components/schemas/email_account';
                      };
                    };
                  };
                  required: ['email_accounts'];
                };
              };
            };
          };
        };
      };
    };
    '/v1/emailer_campaigns/check_contacts_deployability': {
      post: {
        description: 'Check if contacts are deployable to a sequence, primarily used to check if contacts are already in another sequence.';
        operationId: 'checkContactsDeployability';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object';
                properties: {
                  contact_ids: {
                    type: 'array';
                    items: {
                      type: 'string';
                    };
                  };
                  emailer_campaign_id: {
                    type: 'string';
                  };
                };
                required: ['contact_ids'];
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                  properties: {
                    num_active_in_other_campaigns: {
                      type: 'number';
                    };
                    num_finished_in_other_campaigns: {
                      type: 'number';
                    };
                    num_same_company: {
                      type: 'number';
                    };
                    num_no_email: {
                      type: 'number';
                    };
                    num_unverified_email: {
                      type: 'number';
                    };
                    num_without_ownership_permission: {
                      type: 'number';
                    };
                    num_with_job_change_contacts: {
                      type: 'number';
                    };
                    sample_active_in_other_campaigns_contacts: {
                      type: 'array';
                      items: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                          };
                          name: {
                            type: 'string';
                          };
                        };
                        required: ['id', 'name'];
                      };
                    };
                    sample_finished_in_other_campaigns_contacts: {
                      type: 'array';
                      items: {};
                    };
                    sample_same_company_contacts: {
                      type: 'array';
                      items: {};
                    };
                    sample_no_email_contacts: {
                      type: 'array';
                      items: {};
                    };
                    sample_unverified_email_contacts: {
                      type: 'array';
                      items: {};
                    };
                    sample_without_ownership_permission: {
                      type: 'array';
                      items: {};
                    };
                    sample_with_job_change_contacts: {
                      type: 'array';
                      items: {};
                    };
                    show_warning: {
                      type: 'boolean';
                    };
                    num_total_dangerous_contacts: {
                      type: 'number';
                    };
                  };
                  required: [
                    'num_active_in_other_campaigns',
                    'num_finished_in_other_campaigns',
                    'num_same_company',
                    'num_no_email',
                    'num_unverified_email',
                    'num_without_ownership_permission',
                    'num_with_job_change_contacts',
                    'sample_active_in_other_campaigns_contacts',
                    'sample_finished_in_other_campaigns_contacts',
                    'sample_same_company_contacts',
                    'sample_no_email_contacts',
                    'sample_unverified_email_contacts',
                    'sample_without_ownership_permission',
                    'sample_with_job_change_contacts',
                    'show_warning',
                    'num_total_dangerous_contacts',
                  ];
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
      api_key: {
        type: 'apiKey';
        name: 'api_key';
        in: 'query';
      };
    };
    schemas: {
      emailer_campaign: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
          };
          name: {
            type: ['string', 'null'];
          };
          created_at: {
            type: 'string';
            format: 'date-time';
          };
          permissions: {
            type: 'string';
            enum: ['team_can_use', 'team_can_view', 'private'];
          };
          active: {
            type: 'boolean';
          };
          archived: {
            type: 'boolean';
          };
          label_ids: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
          num_steps: {
            type: ['number', 'null'];
          };
          user_id: {
            type: ['string', 'null'];
          };
          unique_scheduled: {
            $ref: '#/components/schemas/metric';
          };
          unique_delivered: {
            $ref: '#/components/schemas/metric';
          };
          unique_bounced: {
            $ref: '#/components/schemas/metric';
          };
          unique_opened: {
            $ref: '#/components/schemas/metric';
          };
          unique_replied: {
            $ref: '#/components/schemas/metric';
          };
          unique_demoed: {
            $ref: '#/components/schemas/metric';
          };
          unique_clicked: {
            $ref: '#/components/schemas/metric';
          };
          unique_unsubscribed: {
            $ref: '#/components/schemas/metric';
          };
          bounce_rate: {
            $ref: '#/components/schemas/metric';
          };
          open_rate: {
            $ref: '#/components/schemas/metric';
          };
          click_rate: {
            $ref: '#/components/schemas/metric';
          };
          reply_rate: {
            $ref: '#/components/schemas/metric';
          };
          spam_blocked_rate: {
            $ref: '#/components/schemas/metric';
          };
          opt_out_rate: {
            $ref: '#/components/schemas/metric';
          };
          demo_rate: {
            $ref: '#/components/schemas/metric';
          };
        };
        required: ['id', 'created_at', 'active', 'archived', 'label_ids'];
      };
      metric: {
        anyOf: [
          {
            type: 'number';
          },
          {
            type: 'string';
            enum: ['loading'];
          },
          {
            type: 'null';
          },
        ];
      };
      emailer_step: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
          };
          emailer_campaign_id: {
            type: 'string';
          };
          position: {
            type: ['number', 'null'];
          };
          wait_time: {
            type: ['number', 'null'];
          };
          type: {
            $ref: '#/components/schemas/emailer_step_type';
          };
          wait_mode: {
            $ref: '#/components/schemas/emailer_step_wait_mode';
          };
          note: {
            type: ['string', 'null'];
          };
          max_emails_per_day: {
            type: ['number', 'null'];
          };
          exact_datetime: {
            type: ['string', 'null'];
          };
          priority: {
            type: ['string', 'null'];
          };
          auto_skip_in_x_days: {
            type: ['number', 'null'];
          };
          counts: {
            type: ['object', 'null'];
            properties: {
              active: {
                type: ['number', 'null'];
              };
              paused: {
                type: ['number', 'null'];
              };
              finished: {
                type: ['number', 'null'];
              };
              bounced: {
                type: ['number', 'null'];
              };
              spam_blocked: {
                type: ['number', 'null'];
              };
              hard_bounced: {
                type: ['number', 'null'];
              };
              not_sent: {
                type: ['number', 'null'];
              };
            };
          };
        };
        required: ['id', 'emailer_campaign_id', 'type', 'wait_mode'];
      };
      emailer_step_type: {
        type: 'string';
        enum: [
          'auto_email',
          'manual_email',
          'call',
          'action_item',
          'linkedin_step_message',
          'linkedin_step_connect',
          'linkedin_step_view_profile',
          'linkedin_step_interact_post',
        ];
      };
      emailer_step_wait_mode: {
        type: 'string';
        enum: ['second', 'minute', 'hour', 'day'];
      };
      emailer_touch: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
          };
          emailer_step_id: {
            type: ['string', 'null'];
          };
          emailer_template_id: {
            type: ['string', 'null'];
          };
          emailer_template: {
            oneOf: [
              {
                $ref: '#/components/schemas/emailer_template';
              },
              {
                type: 'null';
              },
            ];
          };
          status: {
            type: ['string', 'null'];
          };
          type: {
            type: ['string', 'null'];
            enum: ['reply_to_thread', 'new_thread'];
          };
          include_signature: {
            type: ['boolean', 'null'];
          };
          has_personalized_opener: {
            type: ['boolean', 'null'];
          };
          personalized_opener_fallback_option: {
            type: ['string', 'null'];
          };
          generic_personalized_opener: {
            type: ['string', 'null'];
          };
          unique_scheduled: {
            $ref: '#/components/schemas/metric';
          };
          unique_delivered: {
            $ref: '#/components/schemas/metric';
          };
          unique_bounced: {
            $ref: '#/components/schemas/metric';
          };
          unique_opened: {
            $ref: '#/components/schemas/metric';
          };
          unique_replied: {
            $ref: '#/components/schemas/metric';
          };
          bounce_rate: {
            $ref: '#/components/schemas/metric';
          };
          open_rate: {
            $ref: '#/components/schemas/metric';
          };
          reply_rate: {
            $ref: '#/components/schemas/metric';
          };
          demo_rate: {
            $ref: '#/components/schemas/metric';
          };
          unique_demoed: {
            $ref: '#/components/schemas/metric';
          };
          unique_clicked: {
            $ref: '#/components/schemas/metric';
          };
          click_rate: {
            $ref: '#/components/schemas/metric';
          };
          unique_unsubscribed: {
            $ref: '#/components/schemas/metric';
          };
          opt_out_rate: {
            $ref: '#/components/schemas/metric';
          };
          unique_hard_bounced: {
            $ref: '#/components/schemas/metric';
          };
          unique_spam_blocked: {
            $ref: '#/components/schemas/metric';
          };
          hard_bounce_rate: {
            $ref: '#/components/schemas/metric';
          };
          spam_block_rate: {
            $ref: '#/components/schemas/metric';
          };
        };
        required: ['id'];
      };
      emailer_template: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
          };
          name: {
            type: ['string', 'null'];
          };
          user_id: {
            type: ['string', 'null'];
          };
          subject: {
            type: ['string', 'null'];
          };
          archived: {
            type: ['boolean', 'null'];
          };
          created_at: {
            type: ['string', 'null'];
            format: 'date-time';
          };
          global: {
            type: ['boolean', 'null'];
          };
          body_text: {
            type: ['string', 'null'];
          };
          folder_id: {
            type: ['string', 'null'];
          };
          body_html: {
            type: ['string', 'null'];
          };
          creation_type: {
            type: ['string', 'null'];
          };
          label_ids: {
            type: ['array', 'null'];
            items: {
              type: 'string';
            };
          };
          prompt_id: {
            type: ['string', 'null'];
          };
        };
        required: ['id'];
      };
      contact: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
          };
          first_name: {
            type: 'string';
          };
          last_name: {
            type: 'string';
          };
          name: {
            type: 'string';
          };
          linkedin_url: {
            type: 'string';
            format: 'uri';
          };
          title: {
            type: 'string';
          };
          organization_name: {
            type: 'string';
          };
          organization_id: {
            type: 'string';
          };
          headline: {
            type: 'string';
          };
          photo_url: {
            type: 'string';
            format: 'uri';
          };
          updated_at: {
            type: 'string';
            format: 'date-time';
          };
          label_ids: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
          email: {
            type: 'string';
            format: 'email';
          };
          phone_numbers: {
            type: 'array';
            items: {
              type: 'string';
            };
            description: 'Need to test this out...';
          };
          emailer_campaign_ids: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
          contact_campaign_statuses: {
            type: 'array';
            items: {
              type: 'object';
              properties: {
                id: {
                  type: 'string';
                };
                send_email_from_email_account_id: {
                  type: 'string';
                };
                emailer_campaign_id: {
                  type: 'string';
                };
              };
              required: ['id', 'send_email_from_email_account_id', 'emailer_campaign_id'];
              additionalProperties: {};
            };
          };
        };
        required: ['id', 'contact_campaign_statuses'];
        additionalProperties: {};
      };
      email_account: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
          };
          userId: {};
          email: {};
          createdAt: {};
          updatedAt: {};
          lastModifiedAt: {};
          isDeleted: {};
          rawData: {};
          isDisabled: {};
        };
        required: ['id'];
        additionalProperties: {};
      };
    };
  };
};
