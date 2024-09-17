// @ts-nocheck
export type TComponents = {
  parameters: {
    trait_authorizationHeader_Authorization: {
      in: 'header';
      name: 'Authorization';
      required: true;
      schema: {
        default: 'Bearer <<YOUR_API_KEY_HERE>>';
        type: 'string';
      };
    };
    trait_automationQueryParams_group_by: {
      description: 'Automations can have multiple steps. Including `step_id` as a `group_by` metric allows further granularity of stats.';
      explode: false;
      in: 'query';
      name: 'group_by';
      schema: {
        items: {
          enum: ['step_id'];
          type: 'string';
        };
        type: 'array';
      };
      style: 'form';
    };
    trait_automationQueryParams_step_ids: {
      description: 'Comma-separated list of `step_ids` that you want the link stats for.';
      explode: false;
      in: 'query';
      name: 'step_ids';
      schema: {
        items: {
          format: 'uuid';
          type: 'string';
        };
        type: 'array';
        uniqueItems: true;
      };
      style: 'form';
    };
    trait_baseParams_aggregated_by: {
      description: 'Dictates how the stats are time-sliced. Currently, `"total"` and `"day"` are supported.';
      in: 'query';
      name: 'aggregated_by';
      schema: {
        default: 'total';
        enum: ['day', 'total'];
        type: 'string';
      };
    };
    trait_baseParams_end_date: {
      description: "Format: `YYYY-MM-DD`.If this parameter is included, the stats' end date is included in the search.";
      in: 'query';
      name: 'end_date';
      schema: {
        default: '';
        format: 'date';
        type: 'string';
      };
    };
    trait_baseParams_start_date: {
      description: "Format: `YYYY-MM-DD`. If this parameter is included, the stats' start date is included in the search.";
      in: 'query';
      name: 'start_date';
      schema: {
        default: '';
        format: 'date';
        type: 'string';
      };
    };
    trait_baseParams_timezone: {
      description: '[IANA Area/Region](https://en.wikipedia.org/wiki/Tz_database#Names_of_time_zones) string representing the timezone in which the stats are to be presented, e.g., "America/Chicago".';
      in: 'query';
      name: 'timezone';
      schema: {
        default: 'UTC';
        type: 'string';
      };
    };
    trait_designsQueryStrings_page_size: {
      description: 'number of results to return';
      in: 'query';
      name: 'page_size';
      schema: {
        default: 100;
        minimum: 0;
        type: 'integer';
      };
    };
    trait_designsQueryStrings_page_token: {
      description: 'token corresponding to a specific page of results, as provided by metadata';
      in: 'query';
      name: 'page_token';
      schema: {
        type: 'string';
      };
    };
    trait_designsQueryStrings_summary: {
      description: 'set to false to return all fields';
      in: 'query';
      name: 'summary';
      schema: {
        default: true;
        type: 'boolean';
      };
    };
    'trait_onBehalfOfSubuser_on-behalf-of': {
      in: 'header';
      name: 'on-behalf-of';
      schema: {
        default: "The subuser's username. This header generates the API call as if the subuser account was making the call.";
        type: 'string';
      };
    };
    trait_pagination_page_size: {
      description: 'The number of elements you want returned on each page.';
      in: 'query';
      name: 'page_size';
      schema: {
        default: 50;
        maximum: 100;
        minimum: 1;
        type: 'integer';
      };
    };
    trait_pagination_page_token: {
      description: "The stats endpoints are paginated. To get the next page, call the passed `_metadata.next` URL. If `_metadata.prev` doesn't exist, you're at the first page. Similarly, if `_metadata.next` is not present, you're at the last page.";
      in: 'query';
      name: 'page_token';
      schema: {
        type: 'string';
      };
    };
    trait_singlesendQueryParams2_ab_phase_id: {
      in: 'query';
      name: 'ab_phase_id';
      schema: {
        enum: ['test', 'send'];
        type: 'string';
      };
    };
    trait_singlesendQueryParams2_ab_variation_id: {
      in: 'query';
      name: 'ab_variation_id';
      schema: {
        format: 'uuid';
        type: 'string';
      };
    };
    trait_singlesendQueryParams2_group_by: {
      description: 'A/B Single Sends have multiple variation IDs and phase IDs. Including these additional fields allows further granularity of stats by these fields.';
      explode: false;
      in: 'query';
      name: 'group_by';
      schema: {
        items: {
          enum: ['ab_variation', 'ab_phase'];
          type: 'string';
        };
        type: 'array';
      };
      style: 'form';
    };
    trait_singlesendQueryParams_group_by: {
      description: 'A/B Single Sends have multiple variation IDs and phase IDs. Including these additional fields allows further granularity of stats by these fields.';
      explode: false;
      in: 'query';
      name: 'group_by';
      schema: {
        items: {
          enum: ['ab_variation', 'ab_phase'];
          type: 'string';
        };
        type: 'array';
      };
      style: 'form';
    };
    trait_statsAdvancedQueryStringsLimitOffset_aggregated_by: {
      description: 'How to group the statistics. Must be either "day", "week", or "month".';
      in: 'query';
      name: 'aggregated_by';
      required: false;
      schema: {
        enum: ['day', 'week', 'month'];
        type: 'string';
      };
    };
    trait_statsAdvancedQueryStringsLimitOffset_end_date: {
      description: 'The end date of the statistics to retrieve. Defaults to today. Must follow format YYYY-MM-DD.';
      in: 'query';
      name: 'end_date';
      required: false;
      schema: {
        type: 'string';
      };
    };
    trait_statsAdvancedQueryStringsLimitOffset_limit: {
      description: 'The number of results to return.';
      in: 'query';
      name: 'limit';
      required: false;
      schema: {
        type: 'integer';
      };
    };
    trait_statsAdvancedQueryStringsLimitOffset_offset: {
      description: 'The point in the list to begin retrieving results.';
      in: 'query';
      name: 'offset';
      required: false;
      schema: {
        type: 'integer';
      };
    };
    trait_statsAdvancedQueryStringsLimitOffset_start_date: {
      description: 'The starting date of the statistics to retrieve. Must follow format YYYY-MM-DD.';
      in: 'query';
      name: 'start_date';
      required: true;
      schema: {
        type: 'string';
      };
    };
    trait_statsAdvancedStatsBaseQueryStrings_aggregated_by: {
      description: 'How to group the statistics. Must be either "day", "week", or "month".';
      in: 'query';
      name: 'aggregated_by';
      required: false;
      schema: {
        enum: ['day', 'week', 'month'];
        type: 'string';
      };
    };
    trait_statsAdvancedStatsBaseQueryStrings_end_date: {
      description: 'The end date of the statistics to retrieve. Defaults to today. Must follow format YYYY-MM-DD.';
      in: 'query';
      name: 'end_date';
      required: false;
      schema: {
        type: 'string';
      };
    };
    trait_statsAdvancedStatsBaseQueryStrings_start_date: {
      description: 'The starting date of the statistics to retrieve. Must follow format YYYY-MM-DD.';
      in: 'query';
      name: 'start_date';
      required: true;
      schema: {
        type: 'string';
      };
    };
  };
  requestBodies: {
    'DELETE_contactdb-lists-list_idBody': {
      content: {
        'application/json': {
          schema: {
            nullable: true;
          };
        };
      };
    };
    'create-integration-request': {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/create-integration-request';
          };
        };
      };
    };
    'design-duplicate-input': {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/design-duplicate-input';
          };
        };
      };
    };
    monitor: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/monitor';
          };
        };
      };
    };
    'parse-setting': {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/parse-setting';
          };
        };
      };
    };
    segment_write_v2: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/segment_write_v2';
          };
        };
      };
    };
    singlesend_request: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/singlesend_request';
          };
        };
      };
    };
    'suppressions-request': {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/suppressions-request';
          };
        };
      };
    };
    transactional_template_version_create: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/transactional_template_version_create';
          };
        };
      };
    };
    'verified-sender-request-schema': {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/verified-sender-request-schema';
          };
        };
      };
    };
  };
  responses: {
    trait_apiKeysErrors_400: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema';
          };
        };
      };
      description: '';
    };
    trait_apiKeysErrors_403: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema';
          };
        };
      };
      description: '';
    };
    trait_apiKeysErrors_404: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema';
          };
        };
      };
      description: '';
    };
    trait_cancelScheduledSendsErrors_400: {
      content: {
        'application/json': {
          schema: {
            properties: {
              errors: {
                items: {
                  properties: {
                    field: {
                      type: 'string';
                    };
                    help: {
                      type: 'object';
                    };
                    message: {
                      type: 'string';
                    };
                  };
                  type: 'object';
                };
                type: 'array';
              };
              id: {
                type: 'string';
              };
            };
            type: 'object';
          };
        };
      };
      description: '';
    };
    trait_errorResponse_400: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema';
          };
        };
      };
      description: '';
    };
    trait_errors_400: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/errors-seg-v2';
          };
        };
      };
      description: '';
    };
    trait_errors_404: {
      description: '';
    };
    trait_errors_500: {
      description: '';
    };
    trait_globalErrors_401: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema';
          };
        };
      };
      description: '';
    };
    trait_globalErrors_403: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema';
          };
        };
      };
      description: '';
    };
    trait_globalErrors_404: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema';
          };
        };
      };
      description: '';
    };
    trait_globalErrors_500: {
      content: {
        'application/json': {
          schema: {
            properties: {
              errors: {
                items: {
                  properties: {
                    message: {
                      type: 'string';
                    };
                  };
                  type: 'object';
                };
                type: 'array';
              };
            };
            type: 'object';
          };
        };
      };
      description: '';
    };
    trait_mailSendErrors_400: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema';
          };
        };
      };
      description: '';
    };
    trait_mailSendErrors_413: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema';
          };
        };
      };
      description: '';
    };
    trait_makoErrorResponse_400: {
      content: {
        'application/json': {
          schema: {
            properties: {
              errors: {
                items: {
                  properties: {
                    error_id: {
                      description: 'The ID associated with the error.';
                      type: 'string';
                    };
                    field: {
                      description: 'The field that generated the error.';
                      nullable: true;
                      type: 'string';
                    };
                    message: {
                      description: 'The error message.';
                      type: 'string';
                    };
                    parameter: {
                      type: 'string';
                    };
                  };
                  required: ['message'];
                  type: 'object';
                };
                type: 'array';
              };
            };
            type: 'object';
          };
        };
      };
      description: '';
    };
    trait_makoErrorResponse_401: {
      content: {
        'application/json': {
          schema: {
            properties: {
              errors: {
                items: {
                  properties: {
                    error_id: {
                      description: 'The ID associated with the error.';
                      type: 'string';
                    };
                    field: {
                      description: 'The field that generated the error.';
                      nullable: true;
                      type: 'string';
                    };
                    message: {
                      description: 'The error message.';
                      type: 'string';
                    };
                    parameter: {
                      type: 'string';
                    };
                  };
                  required: ['message'];
                  type: 'object';
                };
                type: 'array';
              };
            };
            type: 'object';
          };
        };
      };
      description: '';
    };
    trait_makoErrorResponse_403: {
      content: {
        'application/json': {
          schema: {
            properties: {
              errors: {
                items: {
                  properties: {
                    error_id: {
                      description: 'The ID associated with the error.';
                      type: 'string';
                    };
                    field: {
                      description: 'The field that generated the error.';
                      nullable: true;
                      type: 'string';
                    };
                    message: {
                      description: 'The error message.';
                      type: 'string';
                    };
                    parameter: {
                      type: 'string';
                    };
                  };
                  required: ['message'];
                  type: 'object';
                };
                type: 'array';
              };
            };
            type: 'object';
          };
        };
      };
      description: '';
    };
    trait_makoErrorResponse_404: {
      content: {
        'application/json': {
          schema: {
            properties: {
              errors: {
                items: {
                  properties: {
                    error_id: {
                      description: 'The ID associated with the error.';
                      type: 'string';
                    };
                    field: {
                      description: 'The field that generated the error.';
                      nullable: true;
                      type: 'string';
                    };
                    message: {
                      description: 'The error message.';
                      type: 'string';
                    };
                    parameter: {
                      type: 'string';
                    };
                  };
                  required: ['message'];
                  type: 'object';
                };
                type: 'array';
              };
            };
            type: 'object';
          };
        };
      };
      description: '';
    };
    trait_makoErrorResponse_500: {
      content: {
        'application/json': {
          schema: {
            properties: {
              errors: {
                items: {
                  properties: {
                    error_id: {
                      description: 'The ID associated with the error.';
                      type: 'string';
                    };
                    field: {
                      description: 'The field that generated the error.';
                      nullable: true;
                      type: 'string';
                    };
                    message: {
                      description: 'The error message.';
                      type: 'string';
                    };
                    parameter: {
                      type: 'string';
                    };
                  };
                  required: ['message'];
                  type: 'object';
                };
                type: 'array';
              };
            };
            type: 'object';
          };
        };
      };
      description: '';
    };
    trait_pagination_200: {
      content: {
        'application/json': {
          schema: {
            properties: {
              _metadata: {
                $ref: '#/components/schemas/metadata';
              };
            };
            type: 'object';
          };
        };
      };
      description: '';
    };
    trait_singleSignOnErrorsTrait_400: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/sso-error-response';
          };
        };
      };
      description: '';
    };
    trait_singleSignOnErrorsTrait_401: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/sso-error-response';
          };
        };
      };
      description: '';
    };
    trait_singleSignOnErrorsTrait_403: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/sso-error-response';
          };
        };
      };
      description: '';
    };
    trait_singleSignOnErrorsTrait_429: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/sso-error-response';
          };
        };
      };
      description: '';
    };
    trait_singleSignOnErrorsTrait_500: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/sso-error-response';
          };
        };
      };
      description: '';
    };
  };
  schemas: {
    'TNE-senderID': {
      allOf: [
        {
          properties: {
            id: {
              description: 'The unique identifier of the sender.';
              type: 'integer';
            };
          };
          type: 'object';
        },
        {
          $ref: '#/components/schemas/senders-id-request-body';
        },
        {
          properties: {
            created_at: {
              description: 'The time the sender identity was created.';
              type: 'integer';
            };
            locked: {
              description: "A sender identity is locked when it is associated with a campaign in the Draft, Scheduled, or In Progress state. You can't update or delete a locked sender identity.";
              type: 'boolean';
            };
            updated_at: {
              description: 'The time the sender identity was last updated.';
              type: 'integer';
            };
            verified: {
              description: 'Only verified sender identities can be used to send email.';
              properties: {
                reason: {
                  description: 'The reason for a verification failure, or null if verification succeeeded or has yet to take place.';
                  nullable: true;
                  type: 'string';
                };
                status: {
                  description: 'Whether the sender identity has been verified. Only verified sender identities can be used to send email.';
                  type: 'boolean';
                };
              };
              type: 'object';
            };
          };
          type: 'object';
        },
      ];
      title: 'Sender ID Response Body';
    };
    _metadata: {
      properties: {
        count: {
          minimum: 0;
          type: 'integer';
        };
        next: {
          format: 'uri';
          type: 'string';
        };
        prev: {
          format: 'uri';
          type: 'string';
        };
        self: {
          format: 'uri';
          type: 'string';
        };
      };
      title: '_metadata';
      type: 'object';
    };
    'abbv-message': {
      example: {
        clicks_count: 2;
        from_email: 'from@test.com';
        last_event_time: '2017-10-13T18:56:21Z';
        msg_id: 'abc123';
        opens_count: 1;
        status: 'processed';
        subject: 'anim Duis sint veniam';
        to_email: 'test@test.com';
      };
      properties: {
        clicks_count: {
          type: 'integer';
        };
        from_email: {
          type: 'string';
        };
        last_event_time: {
          description: 'iso 8601 format';
          type: 'string';
        };
        msg_id: {
          type: 'string';
        };
        opens_count: {
          type: 'integer';
        };
        status: {
          enum: ['processed', 'delivered', 'not_delivered'];
          type: 'string';
        };
        subject: {
          type: 'string';
        };
        to_email: {
          type: 'string';
        };
      };
      required: [
        'from_email',
        'msg_id',
        'subject',
        'to_email',
        'status',
        'opens_count',
        'clicks_count',
        'last_event_time',
      ];
      title: 'Abbv. Message';
      type: 'object';
    };
    abtest_summary: {
      nullable: true;
      properties: {
        duration: {
          description: 'How long the A/B Testing will last';
          type: 'string';
        };
        expiration_date: {
          description: 'Last day to select an A/B Test Winner';
          nullable: true;
          type: 'string';
        };
        test_percentage: {
          description: 'What percentage of your recipient will be included in your A/B testing';
          type: 'integer';
        };
        type: {
          description: 'What differs between the A/B tests';
          enum: ['subject', 'content'];
          type: 'string';
        };
        winner_criteria: {
          description: 'How the winner will be decided';
          enum: ['open', 'click', 'manual'];
          type: 'string';
        };
        winner_selected_at: {
          description: 'When the winner was selected';
          nullable: true;
          type: 'string';
        };
        winning_template_id: {
          description: 'Winner of the A/B Test';
          type: 'string';
        };
      };
      required: [
        'type',
        'winner_criteria',
        'test_percentage',
        'duration',
        'winning_template_id',
        'winner_selected_at',
        'expiration_date',
      ];
      title: 'abTest_summary';
      type: 'object';
    };
    advanced_stats_clicks: {
      description: 'The individual events and their stats.';
      properties: {
        clicks: {
          description: 'The number of links that were clicked in your emails.';
          type: 'integer';
        };
        unique_clicks: {
          description: 'The number of unique recipients who clicked links in your emails.';
          type: 'integer';
        };
      };
      title: 'Stats: Advanced Stats with Clicks';
      type: 'object';
    };
    advanced_stats_clicks_opens: {
      allOf: [
        {
          $ref: '#/components/schemas/advanced_stats_clicks';
        },
        {
          $ref: '#/components/schemas/advanced_stats_opens';
        },
      ];
      description: 'The individual events and their stats.';
      title: 'Stats: Advanced Stats with Clicks and Opens';
    };
    advanced_stats_mailbox_provider: {
      allOf: [
        {
          $ref: '#/components/schemas/advanced_stats_clicks_opens';
        },
        {
          description: 'The individual events and their stats.';
          properties: {
            blocks: {
              description: 'The number of emails that were not allowed to be delivered by ISPs.';
              type: 'integer';
            };
            bounces: {
              description: 'The number of emails that bounced instead of being delivered.';
              type: 'integer';
            };
            deferred: {
              description: 'The number of emails that temporarily could not be delivered.';
              type: 'integer';
            };
            delivered: {
              description: 'The number of emails SendGrid was able to confirm were actually delivered to a recipient.';
              type: 'integer';
            };
            drops: {
              description: 'The number of emails that were not delivered due to the recipient email address being on a suppression list.';
              type: 'integer';
            };
            processed: {
              description: 'Requests from your website, application, or mail client via SMTP Relay or the Web API that SendGrid processed.';
              type: 'integer';
            };
            requests: {
              description: 'The number of emails that were requested to be delivered.';
              type: 'integer';
            };
            spam_reports: {
              description: 'The number of recipients who marked your email as spam.';
              type: 'integer';
            };
          };
          type: 'object';
        },
      ];
      description: 'The individual events and their stats.';
      title: 'Stats: Advanced Stats for Mailbox Provider';
    };
    advanced_stats_opens: {
      description: 'The individual events and their stats.';
      properties: {
        opens: {
          description: 'The total number of times your emails were opened by recipients.';
          type: 'integer';
        };
        unique_opens: {
          description: 'The number of unique recipients who opened your emails.';
          type: 'integer';
        };
      };
      title: 'Stats: Advanced Stats with Opens';
      type: 'object';
    };
    all_segments_response: {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/_metadata';
        };
        contacts_count: {
          description: 'Total number of contacts present in the segment';
          type: 'integer';
        };
        created_at: {
          description: 'ISO8601 timestamp of when the object was created';
          type: 'string';
        };
        id: {
          description: 'ID assigned to the segment when created.';
          format: 'uuid';
          maxLength: 36;
          minLength: 36;
          type: 'string';
        };
        name: {
          description: 'Name of the segment.';
          maxLength: 100;
          minLength: 1;
          type: 'string';
        };
        next_sample_update: {
          description: 'ISO8601 timestamp of when the samples will be next updated';
          type: 'string';
        };
        parent_list_ids: {
          description: 'The array of list ids to filter contacts on when building this segment. It allows only one such list id for now. We will support more in future';
          items: {
            type: 'string';
          };
          type: 'array';
          uniqueItems: true;
        };
        query_version: {
          description: "If not set, segment contains a query for use with Segment v1 APIs. If set to '2', segment contains a SQL query for use in v2.";
          type: 'string';
        };
        sample_updated_at: {
          description: 'ISO8601 timestamp of when the samples were last updated';
          type: 'string';
        };
        status: {
          $ref: '#/components/schemas/segment_status_response';
        };
        updated_at: {
          description: 'ISO8601 timestamp of when the object was last updated';
          type: 'string';
        };
      };
      required: [
        'id',
        'name',
        'contacts_count',
        'created_at',
        'updated_at',
        'sample_updated_at',
        'next_sample_update',
        'parent_list_ids',
        'query_version',
        'status',
      ];
      title: 'all_segments_response';
      type: 'object';
    };
    'api-error': {
      properties: {
        error_id: {
          type: 'string';
        };
        field: {
          type: 'string';
        };
        message: {
          type: 'string';
        };
      };
      required: ['message', 'field', 'error_id'];
      title: 'error';
      type: 'object';
    };
    'api-errors': {
      properties: {
        errors: {
          items: {
            $ref: '#/components/schemas/api-error';
          };
          type: 'array';
        };
      };
      title: 'errors';
      type: 'object';
    };
    api_key_name_id: {
      example: {
        api_key_id: 'qfTQ6KG0QBiwWdJ0-pCLCA';
        name: 'Mail Send';
      };
      properties: {
        api_key_id: {
          description: 'The ID of your API Key. ';
          type: 'string';
        };
        name: {
          description: 'The name of your API Key.';
          type: 'string';
        };
      };
      title: 'API Key Name and ID';
      type: 'object';
    };
    api_key_name_id_scopes: {
      allOf: [
        {
          properties: {
            scopes: {
              description: 'The permissions this API Key has access to.';
              items: {
                type: 'string';
              };
              type: 'array';
            };
          };
          type: 'object';
        },
        {
          $ref: '#/components/schemas/api_key_name_id';
        },
      ];
      example: {
        api_key_id: 'qfTQ6KG0QBiwWdJ0-pCLCA';
        name: 'Mail Send';
        scopes: [
          'mail.send',
          'mail.batch.create',
          'mail.batch.read',
          'mail.batch.update',
          'mail.batch.delete',
          'user.scheduled_sends.create',
          'user.scheduled_sends.read',
          'user.scheduled_sends.update',
          'user.scheduled_sends.delete',
          'sender_verification_eligible',
          'sender_verification_legacy',
          '2fa_required',
        ];
      };
      title: 'API Key Name, ID, and Scopes';
    };
    authentication_domain: {
      example: {
        automatic_security: true;
        custom_spf: false;
        default: true;
        dns: {
          dkim1: {
            data: 's1._domainkey.u7.wl.sendgrid.net';
            host: 's1._domainkey.example.com';
            type: 'cname';
            valid: true;
          };
          dkim2: {
            data: 's2._domainkey.u7.wl.sendgrid.net';
            host: 's2._domainkey.example.com';
            type: 'cname';
            valid: true;
          };
          mail_cname: {
            data: 'u7.wl.sendgrid.net';
            host: 'mail.example.com';
            type: 'cname';
            valid: true;
          };
        };
        domain: 'example.com';
        id: 45373692;
        ips: ['127.0.0.1'];
        legacy: false;
        subdomain: 'sub';
        user_id: 66036447;
        username: 'jdoe';
        valid: true;
      };
      properties: {
        automatic_security: {
          description: 'Indicates if this authenticated domain uses automated security.';
          type: 'boolean';
        };
        custom_spf: {
          description: 'Indicates whether this authenticated domain uses custom SPF.';
          type: 'boolean';
        };
        default: {
          description: 'Indicates if this is the default authenticated domain.';
          type: 'boolean';
        };
        dns: {
          description: 'The DNS records used to authenticate the sending domain.';
          properties: {
            dkim1: {
              description: 'A DNS record.';
              properties: {
                data: {
                  description: 'The DNS record.';
                  type: 'string';
                };
                host: {
                  description: 'The domain that this DNS record was created for.';
                  type: 'string';
                };
                type: {
                  description: 'The type of DNS record.';
                  type: 'string';
                };
                valid: {
                  description: 'Indicates if this is a valid DNS record.';
                  type: 'boolean';
                };
              };
              required: ['valid', 'type', 'host', 'data'];
              type: 'object';
            };
            dkim2: {
              description: 'A DNS record.';
              properties: {
                data: {
                  description: 'The DNS record.';
                  type: 'string';
                };
                host: {
                  description: 'The domain that this DNS record was created for.';
                  type: 'string';
                };
                type: {
                  description: 'The type of DNS record.';
                  type: 'string';
                };
                valid: {
                  description: 'Indicates if this is a valid DNS record.';
                  type: 'boolean';
                };
              };
              required: ['valid', 'type', 'host', 'data'];
              type: 'object';
            };
            mail_cname: {
              description: 'The CNAME for your sending domain that points to sendgrid.net.';
              properties: {
                data: {
                  description: 'The CNAME record.';
                  type: 'string';
                };
                host: {
                  description: 'The domain that this CNAME is created for.';
                  format: 'hostname';
                  type: 'string';
                };
                type: {
                  description: 'The type of DNS record.';
                  type: 'string';
                };
                valid: {
                  description: 'Indicates if this is a valid CNAME.';
                  type: 'boolean';
                };
              };
              required: ['valid', 'type', 'host', 'data'];
              type: 'object';
            };
          };
          required: ['mail_cname', 'dkim1', 'dkim2'];
          type: 'object';
        };
        domain: {
          description: 'The domain to be authenticated.';
          type: 'string';
        };
        id: {
          description: 'The ID of the authenticated domain.';
          type: 'number';
        };
        ips: {
          description: 'The IPs to be included in the custom SPF record for this authenticated domain.';
          items: {
            type: 'string';
          };
          type: 'array';
        };
        legacy: {
          description: "Indicates if this authenticated domain was created using the legacy whitelabel tool. If it is a legacy whitelabel, it will still function, but you'll need to create a new authenticated domain if you need to update it.";
          type: 'boolean';
        };
        subdomain: {
          description: 'The subdomain to use for this authenticated domain.';
          type: 'string';
        };
        user_id: {
          description: 'The ID of the user that this domain is associated with.';
          type: 'number';
        };
        username: {
          description: 'The username that this domain will be associated with.';
          type: 'string';
        };
        valid: {
          description: 'Indicates if this is a valid authenticated domain.';
          type: 'boolean';
        };
      };
      required: [
        'id',
        'user_id',
        'subdomain',
        'domain',
        'username',
        'ips',
        'custom_spf',
        'default',
        'legacy',
        'automatic_security',
        'valid',
        'dns',
      ];
      title: 'Domain Authentication - Mandatory Subdomain';
      type: 'object';
    };
    'automations-link-stats-response': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/link-tracking-metadata';
        };
        results: {
          description: '';
          items: {
            properties: {
              clicks: {
                description: 'The number of clicks on this particular link.';
                minimum: 1;
                type: 'integer';
              };
              step_id: {
                description: 'This is the ID of the step if the stats were requested to be grouped by `step_id`.';
                format: 'uuid';
                type: 'string';
              };
              url: {
                description: 'This is the URL of the link clicked. If `{{custom_fields}}` are part of the URL, they will be included.';
                format: 'uri';
                type: 'string';
              };
              url_location: {
                description: 'This is the location of the link clicked in each Automation step. Links are located according to their position within the message; the topmost link has index `0`.';
                minimum: 0;
                type: 'integer';
              };
            };
            required: ['url', 'step_id', 'clicks'];
            type: 'object';
          };
          type: 'array';
        };
        total_clicks: {
          type: 'integer';
        };
      };
      required: ['results', 'total_clicks', '_metadata'];
      title: 'automations-link-stats-response';
      type: 'object';
    };
    'automations-response': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/metadata';
        };
        results: {
          items: {
            properties: {
              aggregation: {
                default: 'total';
                description: 'This describes the time unit to which the stat is rolled up. It is based on the `aggregated_by` parameter included in the request. It can be "total" or the date (in YYYY-MM-DD format) the stats are for.';
                type: 'string';
              };
              id: {
                description: 'This is the ID of the Automation you are requesting stats for.';
                format: 'uuid';
                type: 'string';
              };
              stats: {
                $ref: '#/components/schemas/metrics';
              };
              step_id: {
                default: 'all';
                description: 'This is the ID of the step if the stats were requested to be grouped by `step_id`.';
                type: 'string';
              };
            };
            required: ['id', 'aggregation', 'step_id'];
            type: 'object';
          };
          type: 'array';
        };
      };
      required: ['results'];
      title: 'automations-response';
      type: 'object';
    };
    'blocks-response': {
      example: [
        {
          created: 1443651154;
          email: 'example@example.com';
          reason: 'error dialing remote address: dial tcp 10.57.152.165:25: no route to host';
          status: '4.0.0';
        },
      ];
      items: {
        properties: {
          created: {
            description: 'A Unix timestamp indicating when the email address was added to the blocks list.';
            type: 'integer';
          };
          email: {
            description: 'The email address that was added to the block list.';
            format: 'email';
            type: 'string';
          };
          reason: {
            description: 'An explanation for the reason of the block.';
            type: 'string';
          };
          status: {
            description: 'The status of the block.';
            type: 'string';
          };
        };
        required: ['created', 'email', 'reason', 'status'];
        type: 'object';
      };
      title: 'Blocks Response';
      type: 'array';
    };
    bounce_response: {
      example: {
        created: 1250337600;
        email: 'example@example.com';
        reason: "550 5.1.1 The email account that you tried to reach does not exist. Please try double-checking the recipient's email address for typos or unnecessary spaces. Learn more at  https://support.google.com/mail/answer/6596 o186si2389584ioe.63 - gsmtp ";
        status: '5.1.1';
      };
      properties: {
        created: {
          description: 'The unix timestamp for when the bounce record was created at SendGrid.';
          type: 'number';
        };
        email: {
          description: 'The email address that was added to the bounce list.';
          format: 'email';
          type: 'string';
        };
        reason: {
          description: 'The reason for the bounce. This typically will be a bounce code, an enhanced code, and a description.';
          type: 'string';
        };
        status: {
          description: 'Enhanced SMTP bounce response';
          type: 'string';
        };
      };
      title: 'Bounce Response';
      type: 'object';
    };
    campaign_request: {
      example: {
        categories: ['summer line'];
        custom_unsubscribe_url: '';
        html_content: '<html><head><title></title></head><body><p>Check out our summer line!</p></body></html>';
        id: 986724;
        ip_pool: 'marketing';
        list_ids: [110, 124];
        plain_content: 'Check out our summer line!';
        segment_ids: [110];
        sender_id: 124451;
        status: 'Draft';
        subject: 'New Products for Summer!';
        suppression_group_id: 42;
        title: 'May Newsletter';
      };
      properties: {
        categories: {
          description: 'The categories you would like associated to this campaign.';
          items: {
            type: 'string';
          };
          nullable: true;
          type: 'array';
        };
        custom_unsubscribe_url: {
          description: 'This is the url of the custom unsubscribe page that you provide for customers to unsubscribe from your suppression groups.';
          nullable: true;
          type: 'string';
        };
        editor: {
          description: 'The editor used in the UI.';
          enum: ['code', 'design'];
          type: 'string';
        };
        html_content: {
          description: 'The HTML of your marketing email.';
          nullable: true;
          type: 'string';
        };
        ip_pool: {
          description: 'The pool of IPs that you would like to send this email from.';
          nullable: true;
          type: 'string';
        };
        list_ids: {
          description: 'The IDs of the lists you are sending this campaign to. You can have both segment IDs and list IDs';
          items: {
            type: 'integer';
          };
          nullable: true;
          type: 'array';
        };
        plain_content: {
          description: 'The plain text content of your emails.';
          nullable: true;
          type: 'string';
        };
        segment_ids: {
          description: 'The segment IDs that you are sending this list to. You can have both segment IDs and list IDs. Segments are limited to 10 segment IDs.';
          items: {
            type: 'integer';
          };
          nullable: true;
          type: 'array';
        };
        sender_id: {
          description: 'The ID of the "sender" identity that you have created. Your recipients will see this as the "from" on your marketing emails.';
          nullable: true;
          type: 'integer';
        };
        subject: {
          description: 'The subject of your campaign that your recipients will see.';
          nullable: true;
          type: 'string';
        };
        suppression_group_id: {
          description: 'The suppression group that this marketing email belongs to, allowing recipients to opt-out of emails of this type.';
          nullable: true;
          type: 'integer';
        };
        title: {
          description: 'The display title of your campaign. This will be viewable by you in the Marketing Campaigns UI.';
          type: 'string';
        };
      };
      required: ['title'];
      title: 'Campaigns Request';
      type: 'object';
    };
    campaign_response: {
      allOf: [
        {
          $ref: '#/components/schemas/campaign_request';
        },
        {
          properties: {
            id: {
              type: 'integer';
            };
            status: {
              description: 'The status of your campaign.';
              type: 'string';
            };
          };
          required: ['status'];
          type: 'object';
        },
      ];
      title: 'Campaigns Response';
    };
    category_stats: {
      example: {
        date: '2015-01-01';
        stats: [
          {
            metrics: {
              blocks: 0;
              bounce_drops: 0;
              bounces: 0;
              clicks: 0;
              deferred: 0;
              delivered: 0;
              invalid_emails: 0;
              opens: 0;
              processed: 0;
              requests: 0;
              spam_report_drops: 0;
              spam_reports: 0;
              unique_clicks: 0;
              unique_opens: 0;
              unsubscribe_drops: 0;
              unsubscribes: 0;
            };
            name: 'cat1';
            type: 'category';
          },
          {
            metrics: {
              blocks: 0;
              bounce_drops: 0;
              bounces: 0;
              clicks: 0;
              deferred: 0;
              delivered: 0;
              invalid_emails: 0;
              opens: 0;
              processed: 0;
              requests: 0;
              spam_report_drops: 0;
              spam_reports: 0;
              unique_clicks: 0;
              unique_opens: 0;
              unsubscribe_drops: 0;
              unsubscribes: 0;
            };
            name: 'cat2';
            type: 'category';
          },
        ];
      };
      properties: {
        date: {
          description: 'The date the statistics were gathered.';
          type: 'string';
        };
        stats: {
          items: {
            properties: {
              metrics: {
                properties: {
                  blocks: {
                    description: 'The number of emails that were not allowed to be delivered by ISPs.';
                    type: 'integer';
                  };
                  bounce_drops: {
                    description: 'The number of emails that were dropped because of a bounce.';
                    type: 'integer';
                  };
                  bounces: {
                    description: 'The number of emails that bounced instead of being delivered.';
                    type: 'integer';
                  };
                  clicks: {
                    description: 'The number of links that were clicked.';
                    type: 'integer';
                  };
                  deferred: {
                    description: 'The number of emails that temporarily could not be delivered.';
                    type: 'integer';
                  };
                  delivered: {
                    description: 'The number of emails SendGrid was able to confirm were actually delivered to a recipient.';
                    type: 'integer';
                  };
                  invalid_emails: {
                    description: 'The number of recipients who had malformed email addresses or whose mail provider reported the address as invalid.';
                    type: 'integer';
                  };
                  opens: {
                    description: 'The total number of times your emails were opened by recipients.';
                    type: 'integer';
                  };
                  processed: {
                    description: 'Requests from your website, application, or mail client via SMTP Relay or the API that SendGrid processed.';
                    type: 'integer';
                  };
                  requests: {
                    description: 'The number of emails that were requested to be delivered.';
                    type: 'integer';
                  };
                  spam_report_drops: {
                    description: 'The number of emails that were dropped due to a recipient previously marking your emails as spam.';
                    type: 'integer';
                  };
                  spam_reports: {
                    description: 'The number of recipients who marked your email as spam.';
                    type: 'integer';
                  };
                  unique_clicks: {
                    description: 'The number of unique recipients who clicked links in your emails.';
                    type: 'integer';
                  };
                  unique_opens: {
                    description: 'The number of unique recipients who opened your emails.';
                    type: 'integer';
                  };
                  unsubscribe_drops: {
                    description: 'The number of emails dropped due to a recipient unsubscribing from your emails.';
                    type: 'integer';
                  };
                  unsubscribes: {
                    description: 'The number of recipients who unsubscribed from your emails.';
                    type: 'integer';
                  };
                };
                required: [
                  'blocks',
                  'bounce_drops',
                  'bounces',
                  'clicks',
                  'deferred',
                  'delivered',
                  'invalid_emails',
                  'opens',
                  'processed',
                  'requests',
                  'spam_report_drops',
                  'spam_reports',
                  'unique_clicks',
                  'unique_opens',
                  'unsubscribe_drops',
                  'unsubscribes',
                ];
                type: 'object';
              };
              name: {
                description: 'The name of the category.';
                type: 'string';
              };
              type: {
                description: 'How you are segmenting your statistics.';
                type: 'string';
              };
            };
            required: ['type'];
            type: 'object';
          };
          type: 'array';
        };
      };
      required: ['date'];
      title: 'Stats: Category Stats';
      type: 'object';
    };
    cc_bcc_email_object: {
      example: {
        email: 'jane_doe@example.com';
        name: 'Jane Doe';
      };
      properties: {
        email: {
          description: "The intended recipient's email address.";
          format: 'email';
          type: 'string';
        };
        name: {
          description: "The intended recipient's name.";
          type: 'string';
        };
      };
      required: ['email'];
      title: 'CC BCC Email Object';
      type: 'object';
    };
    'click-tracking': {
      example: {
        enable_text: false;
        enabled: false;
      };
      properties: {
        enable_text: {
          description: 'Indicates if click tracking is enabled for plain text emails.';
          type: 'boolean';
        };
        enabled: {
          description: 'Indicates if click tracking is enabled or disabled.';
          type: 'boolean';
        };
      };
      required: ['enable_text', 'enabled'];
      title: 'Settings: Click Tracking';
      type: 'object';
    };
    'contact-details': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/selfmetadata';
        };
        address_line_1: {
          type: 'string';
        };
        address_line_2: {
          type: 'string';
        };
        alternate_emails: {
          items: {
            type: 'string';
          };
          type: 'array';
        };
        city: {
          type: 'string';
        };
        country: {
          type: 'string';
        };
        created_at: {
          description: 'The ISO8601 timestamp when the contact was created.';
          type: 'string';
        };
        custom_fields: {
          $ref: '#/components/schemas/custom-fields-by-name';
        };
        email: {
          type: 'string';
        };
        first_name: {
          type: 'string';
        };
        id: {
          type: 'string';
        };
        last_name: {
          type: 'string';
        };
        list_ids: {
          items: {
            type: 'string';
          };
          type: 'array';
        };
        postal_code: {
          type: 'string';
        };
        state_province_region: {
          type: 'string';
        };
        updated_at: {
          description: 'The ISO8601 timestamp when the contact was updated.';
          type: 'string';
        };
      };
      required: ['id', 'list_ids', 'created_at', 'updated_at'];
      title: 'contact-details';
      type: 'object';
    };
    'contact-details2': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/selfmetadata';
        };
        address_line_1: {
          type: 'string';
        };
        address_line_2: {
          type: 'string';
        };
        alternate_emails: {
          items: {
            format: 'email';
            type: 'string';
          };
          nullable: true;
          type: 'array';
        };
        city: {
          type: 'string';
        };
        country: {
          type: 'string';
        };
        created_at: {
          format: 'date-time';
          type: 'string';
        };
        custom_fields: {
          type: 'object';
        };
        email: {
          format: 'email';
          type: 'string';
        };
        facebook: {
          type: 'string';
        };
        first_name: {
          type: 'string';
        };
        id: {
          format: 'uuid';
          maxLength: 36;
          minLength: 36;
          type: 'string';
        };
        last_name: {
          type: 'string';
        };
        line: {
          type: 'string';
        };
        list_ids: {
          items: {
            format: 'uuid';
            type: 'string';
          };
          type: 'array';
        };
        phone_number: {
          type: 'string';
        };
        postal_code: {
          type: 'string';
        };
        segment_ids: {
          items: {
            format: 'uuid';
            type: 'string';
          };
          type: 'array';
        };
        state_province_region: {
          type: 'string';
        };
        unique_name: {
          type: 'string';
        };
        updated_at: {
          format: 'date-time';
          type: 'string';
        };
        whatsapp: {
          type: 'string';
        };
      };
      required: ['id', 'list_ids', 'created_at', 'updated_at'];
      title: 'contact-details2';
      type: 'object';
    };
    'contact-details3': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/selfmetadata';
        };
        address_line_1: {
          type: 'string';
        };
        address_line_2: {
          type: 'string';
        };
        alternate_emails: {
          items: {
            type: 'string';
          };
          type: 'array';
        };
        city: {
          type: 'string';
        };
        country: {
          type: 'string';
        };
        created_at: {
          type: 'string';
        };
        custom_fields: {
          type: 'object';
        };
        email: {
          type: 'string';
        };
        facebook: {
          type: 'string';
        };
        first_name: {
          type: 'string';
        };
        id: {
          type: 'string';
        };
        last_name: {
          type: 'string';
        };
        line: {
          type: 'string';
        };
        list_ids: {
          items: {
            type: 'string';
          };
          type: 'array';
        };
        phone_number: {
          type: 'string';
        };
        postal_code: {
          type: 'string';
        };
        segment_ids: {
          items: {
            type: 'string';
          };
          type: 'array';
        };
        state_province_region: {
          type: 'string';
        };
        unique_name: {
          type: 'string';
        };
        updated_at: {
          type: 'string';
        };
        whatsapp: {
          type: 'string';
        };
      };
      required: ['id', 'list_ids', 'segment_ids', 'created_at', 'updated_at'];
      title: 'contact-details3';
      type: 'object';
    };
    'contact-export': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/metadata';
        };
        completed_at: {
          description: 'The ISO8601 timestamp when the export was completed.';
          type: 'string';
        };
        contact_count: {
          description: 'The total number of exported contacts.';
          type: 'integer';
        };
        created_at: {
          description: 'The ISO8601 timestamp when the export was begun.';
          type: 'string';
        };
        expires_at: {
          description: 'The ISO8601 timestamp when the exported file on S3 will expire.';
          type: 'string';
        };
        id: {
          type: 'string';
        };
        message: {
          description: 'A human readable message if the status is `failure`.';
          type: 'string';
        };
        status: {
          description: "The export job's status. Allowed values: `pending`, `ready`, or `failure`.";
          enum: ['pending', 'ready', 'failure'];
          type: 'string';
        };
        updated_at: {
          description: 'The ISO8601 timestamp when the export was updated.';
          type: 'string';
        };
        urls: {
          description: 'One or more download URLs for the contact file if the status is `ready`.';
          items: {
            type: 'string';
          };
          type: 'array';
        };
      };
      required: ['id', 'status', 'created_at', 'updated_at', 'expires_at'];
      title: 'contact-export';
      type: 'object';
    };
    'contact-import': {
      properties: {
        finished_at: {
          description: 'The ISO8601 timestamp when the job was finished.';
          type: 'string';
        };
        id: {
          description: 'The job ID.';
          type: 'string';
        };
        job_type: {
          description: 'The job type. Allowed values: `upsert`, or `delete`.';
          type: 'string';
        };
        results: {
          description: 'Result map of the import job.';
          properties: {
            created_count: {
              description: 'Created contact count from the import.';
              type: 'number';
            };
            deleted_count: {
              description: 'Count of deleted contacts that resulted in error.';
              type: 'number';
            };
            errored_count: {
              description: 'Count of imported contacts that resulted in error.';
              type: 'number';
            };
            errors_url: {
              description: 'The download URL of the file which provides information about any errors.';
              type: 'string';
            };
            requested_count: {
              description: 'Requested contact count from the import.';
              type: 'number';
            };
            updated_count: {
              description: 'Updated contact count from the import.';
              type: 'number';
            };
          };
          type: 'object';
        };
        started_at: {
          description: 'The ISO8601 timestamp when the job was created.';
          type: 'string';
        };
        status: {
          description: 'The job state. Allowed values: `pending`, `completed`, `errored`, or `failed`.';
          type: 'string';
        };
      };
      title: 'contact-import';
      type: 'object';
    };
    'contact-request': {
      properties: {
        address_line_1: {
          description: 'The first line of the address.';
          maxLength: 100;
          type: 'string';
        };
        address_line_2: {
          description: 'An optional second line for the address.';
          maxLength: 100;
          type: 'string';
        };
        alternate_emails: {
          description: 'Additional emails associated with the contact.';
          items: {
            maxLength: 254;
            type: 'string';
          };
          maxItems: 5;
          minItems: 0;
          type: 'array';
        };
        city: {
          description: "The contact's city.";
          maxLength: 60;
          type: 'string';
        };
        country: {
          description: "The contact's country. Can be a full name or an abbreviation.";
          maxLength: 50;
          type: 'string';
        };
        custom_fields: {
          $ref: '#/components/schemas/custom-fields-by-id';
        };
        email: {
          description: "The contact's primary email. This is required to be a valid email.";
          maxLength: 254;
          type: 'string';
        };
        first_name: {
          description: "The contact's personal name.";
          maxLength: 50;
          type: 'string';
        };
        last_name: {
          description: "The contact's family name.";
          maxLength: 50;
          type: 'string';
        };
        postal_code: {
          description: "The contact's ZIP code or other postal code.";
          type: 'string';
        };
        state_province_region: {
          description: "The contact's state, province, or region.";
          maxLength: 50;
          type: 'string';
        };
      };
      required: ['email'];
      title: 'contact-request';
      type: 'object';
    };
    'contact-summary': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/selfmetadata';
        };
        created_at: {
          description: 'Unix Epoch Timestamp.';
          type: 'number';
        };
        email: {
          description: 'Primary email address.';
          type: 'string';
        };
        first_name: {
          type: 'string';
        };
        id: {
          description: 'Contact UUID.';
          type: 'string';
        };
        last_name: {
          type: 'string';
        };
        list_ids: {
          description: 'List UUID linked with this contact.';
          items: {
            type: 'string';
          };
          type: 'array';
        };
        updated_at: {
          description: 'Unix Epoch Timestamp.';
          type: 'number';
        };
      };
      required: ['id', 'list_ids', 'created_at', 'updated_at'];
      title: 'contact-summary';
      type: 'object';
    };
    contact_response: {
      example: {
        address_line_1: 'street address / P.O. box / CompanyName / c/o';
        address_line_2: 'apartment, suite, unit, building, floor etc';
        alternate_emails: ['abcd@yahoo.com', 'abcd@hotmail.com'];
        city: 'Redwood City';
        country: 'USA';
        custom_fields: {
          custom_field_name1: 'custom_field_value1';
          custom_field_name2: 'custom_field_value2';
        };
        email: 'abcd@gmail.com';
        first_name: 'Ab';
        id: '47d23ab0-d895-4359-a0d1-ffc7a6fc7e70';
        last_name: 'Cd';
        postal_code: 94063;
        state_province_region: 'CA';
      };
      properties: {
        address_line_1: {
          description: 'First line of address of the contact. This is a reserved field.';
          minLength: 0;
          type: 'string';
        };
        address_line_2: {
          description: 'Second line of address of the contact. This is a reserved field.';
          minLength: 0;
          type: 'string';
        };
        alternate_emails: {
          description: 'Alternate emails of the contact. This is a reserved field.';
          items: {
            format: 'email';
            maxLength: 254;
            minLength: 3;
            type: 'string';
          };
          minItems: 0;
          type: 'array';
          uniqueItems: true;
        };
        city: {
          description: 'City associated with the contact. This is a reserved field.';
          minLength: 0;
          pattern: '^[a-zA-Z\\u0080-\\u024F\\s\\/\\-\\)\\(\\`\\.\\"\\\']+$';
          type: 'string';
        };
        country: {
          description: 'Country associated with the address of the contact. This is a reserved field.';
          minLength: 0;
          type: 'string';
        };
        custom_fields: {
          description: 'The user may choose to create up to 120 custom fields or none at all. This is not a reserved field.';
          minProperties: 0;
          properties: {
            '': {
              type: 'string';
            };
            custom_field_name1: {
              minLength: 0;
              type: 'string';
            };
            custom_field_name2: {
              minLength: 0;
              type: 'string';
            };
          };
          type: 'object';
        };
        email: {
          description: 'Email of the contact. This is a reserved field.';
          format: 'email';
          maxLength: 254;
          minLength: 3;
          type: 'string';
        };
        first_name: {
          description: 'First name of the contact. This is a reserved field.';
          minLength: 1;
          type: 'string';
        };
        id: {
          description: 'ID assigned to a contact when added to the system.';
          format: 'uuid';
          maxLength: 36;
          pattern: '[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}';
          type: 'string';
        };
        last_name: {
          description: 'Last name of the contact. This is a reserved field.';
          minLength: 1;
          type: 'string';
        };
        list_ids: {
          description: 'IDs of all lists the contact is part of';
          items: {
            format: 'uuid';
            type: 'string';
          };
          type: 'array';
          uniqueItems: true;
        };
        postal_code: {
          description: 'Zipcode associated with the address of the contact. This is a reserved field.';
          type: 'integer';
        };
        segment_ids: {
          description: 'IDs of all segments the contact is part of';
          items: {
            format: 'uuid';
            type: 'string';
          };
          type: 'array';
          uniqueItems: true;
        };
        state_province_region: {
          description: 'State associated with the contact. This is a reserved field.';
          minLength: 0;
          type: 'string';
        };
      };
      required: [
        'id',
        'email',
        'alternate_emails',
        'first_name',
        'last_name',
        'address_line_1',
        'address_line_2',
        'city',
        'state_province_region',
        'postal_code',
        'country',
        'custom_fields',
      ];
      title: 'contact_response';
      type: 'object';
    };
    contactdb_custom_field: {
      example: {
        name: 'first_name';
        type: 'text';
      };
      properties: {
        name: {
          description: 'The name of the field';
          type: 'string';
        };
        type: {
          description: 'The type of the field.';
          enum: ['date', 'text', 'number'];
          type: 'string';
        };
      };
      title: 'ContactDB Custom field schema.';
      type: 'object';
    };
    contactdb_custom_field_with_id: {
      allOf: [
        {
          $ref: '#/components/schemas/contactdb_custom_field';
        },
        {
          properties: {
            id: {
              description: 'The ID of the custom field.';
              type: 'number';
            };
          };
          type: 'object';
        },
      ];
      title: 'ContactDB Custom field schema with ID.';
    };
    contactdb_custom_field_with_id_value: {
      allOf: [
        {
          $ref: '#/components/schemas/contactdb_custom_field_with_id';
        },
        {
          properties: {
            value: {
              description: "The value of this recipient's custom field";
              nullable: true;
              type: 'string';
            };
          };
          type: 'object';
        },
      ];
      title: 'ContactDB Custom field schema.';
    };
    contactdb_list: {
      example: {
        id: 1;
        name: 'listname';
        recipient_count: 0;
      };
      properties: {
        id: {
          description: 'The reference ID of your list.';
          type: 'integer';
        };
        name: {
          description: 'The name of your list. Must be unique against all other list and segment names.';
          type: 'string';
        };
        recipient_count: {
          description: 'The count of recipients currently in the list.';
          type: 'integer';
        };
      };
      required: ['id', 'name', 'recipient_count'];
      title: 'ContactDB lists';
      type: 'object';
    };
    contactdb_recipient: {
      properties: {
        recipients: {
          items: {
            properties: {
              created_at: {
                description: 'The time this record was created in your contactdb, in unixtime.';
                type: 'number';
              };
              custom_fields: {
                description: 'The custom fields assigned to this recipient and their values.';
                items: {
                  $ref: '#/components/schemas/contactdb_custom_field_with_id_value';
                };
                type: 'array';
              };
              email: {
                description: 'The email address of this recipient. This is a default custom field that SendGrid provides.';
                format: 'email';
                type: 'string';
              };
              first_name: {
                description: 'The first name of this recipient. This is a default custom field that SendGrid provides.';
                nullable: true;
                type: 'string';
              };
              id: {
                description: 'The ID of this recipient.';
                type: 'string';
              };
              last_clicked: {
                description: 'The last time this recipient clicked a link from one of your campaigns, in unixtime.';
                nullable: true;
                type: 'number';
              };
              last_emailed: {
                description: 'The last time this user was emailed by one of your campaigns, in unixtime.';
                nullable: true;
                type: 'number';
              };
              last_name: {
                description: 'The last name of the recipient.';
                nullable: true;
                type: 'string';
              };
              last_opened: {
                description: 'The last time this recipient opened an email from you, in unixtime.';
                nullable: true;
                type: 'number';
              };
              updated_at: {
                description: "The last update date for this recipient's record.";
                type: 'number';
              };
            };
            required: ['email'];
            type: 'object';
          };
          type: 'array';
        };
      };
      title: 'ContactDB: Recipient';
      type: 'object';
    };
    contactdb_recipient_count: {
      example: {
        recipient_count: 1234;
      };
      properties: {
        recipient_count: {
          description: 'The count of recipients.';
          type: 'number';
        };
      };
      required: ['recipient_count'];
      title: 'ContactDB: Recipient Count';
      type: 'object';
    };
    contactdb_recipient_response: {
      example: {
        error_count: 1;
        error_indices: [2];
        errors: [
          {
            error_indices: [2];
            message: 'Invalid email.';
          },
        ];
        new_count: 2;
        persisted_recipients: ['YUBh', 'bWlsbGVyQG1pbGxlci50ZXN0'];
        updated_count: 0;
      };
      properties: {
        error_count: {
          default: 0;
          description: 'The number of errors found while adding recipients.';
          type: 'number';
        };
        error_indices: {
          default: [];
          description: 'The indices of the recipient(s) sent that caused the error. ';
          items: {
            type: 'number';
          };
          type: 'array';
        };
        errors: {
          items: {
            properties: {
              error_indices: {
                items: {
                  type: 'number';
                };
                type: 'array';
              };
              message: {
                type: 'string';
              };
            };
            type: 'object';
          };
          type: 'array';
        };
        new_count: {
          default: 0;
          description: 'The count of new recipients added to the contactdb.';
          type: 'number';
        };
        persisted_recipients: {
          default: [];
          description: 'The recipient IDs of the recipients that already existed from this request.';
          items: {
            type: 'string';
          };
          type: 'array';
        };
        updated_count: {
          default: 0;
          description: 'The recipients who were updated from this request.';
          type: 'number';
        };
      };
      required: ['error_count', 'new_count', 'persisted_recipients', 'updated_count'];
      title: 'ContactDB: Recipient response';
      type: 'object';
    };
    contactdb_segments: {
      example: {
        conditions: [
          {
            and_or: '';
            field: 'last_name';
            operator: 'eq';
            value: 'Miller';
          },
          {
            and_or: 'and';
            field: 'last_clicked';
            operator: 'gt';
            value: '01/02/2015';
          },
          {
            and_or: 'or';
            field: 'clicks.campaign_identifier';
            operator: 'eq';
            value: '513';
          },
        ];
        list_id: 4;
        name: 'Last Name Miller';
        recipient_count: 1234;
      };
      properties: {
        conditions: {
          description: 'The conditions for a recipient to be included in this segment.';
          items: {
            $ref: '#/components/schemas/contactdb_segments_conditions';
          };
          type: 'array';
        };
        list_id: {
          description: 'The list id from which to make this segment. Not including this ID will mean your segment is created from the main contactdb rather than a list.';
          type: 'integer';
        };
        name: {
          description: 'The name of this segment.';
          type: 'string';
        };
        recipient_count: {
          description: 'The count of recipients in this list. This is not included on creation of segments.';
          type: 'number';
        };
      };
      required: ['name', 'conditions'];
      title: 'Create a Segment request';
      type: 'object';
    };
    contactdb_segments_conditions: {
      properties: {
        and_or: {
          enum: ['and', 'or', ''];
          type: 'string';
        };
        field: {
          type: 'string';
        };
        operator: {
          enum: ['eq', 'ne', 'lt', 'gt', 'contains'];
          type: 'string';
        };
        value: {
          type: 'string';
        };
      };
      required: ['field', 'value', 'operator'];
      title: 'ContactDB: Segments: Conditions';
      type: 'object';
    };
    contactdb_segments_with_id: {
      allOf: [
        {
          properties: {
            id: {
              description: 'The ID of the segment.';
              type: 'number';
            };
          };
          required: ['id'];
          type: 'object';
        },
        {
          $ref: '#/components/schemas/contactdb_segments';
        },
      ];
      title: 'ContactDB:: Segments with ID';
    };
    contacts: {
      properties: {
        address: {
          type: 'string';
        };
        address2: {
          type: 'object';
        };
        city: {
          type: 'string';
        };
        company: {
          type: 'string';
        };
        country: {
          type: 'string';
        };
        email: {
          type: 'string';
        };
        first_name: {
          type: 'string';
        };
        last_name: {
          type: 'string';
        };
        phone: {
          type: 'string';
        };
        state: {
          type: 'string';
        };
        zip: {
          type: 'string';
        };
      };
      title: 'Contacts';
      type: 'object';
    };
    'create-integration-request': {
      properties: {
        completed_integration: {
          description: 'Indicates if the integration is complete.';
          type: 'boolean';
        };
        enabled: {
          description: 'Indicates if the integration is enabled.';
          type: 'boolean';
        };
        entity_id: {
          description: 'An identifier provided by your IdP to identify Twilio SendGrid in the SAML interaction. This is called the "SAML Issuer ID" in the Twilio SendGrid UI.';
          type: 'string';
        };
        name: {
          description: 'The name of your integration. This name can be anything that makes sense for your organization (eg. Twilio SendGrid)';
          type: 'string';
        };
        signin_url: {
          description: 'The IdP\'s SAML POST endpoint. This endpoint should receive requests and initiate an SSO login flow. This is called the "Embed Link" in the Twilio SendGrid UI.';
          type: 'string';
        };
        signout_url: {
          description: 'This URL is relevant only for an IdP-initiated authentication flow. If a user authenticates from their IdP, this URL will return them to their IdP when logging out.';
          type: 'string';
        };
      };
      required: ['name', 'enabled', 'signin_url', 'signout_url', 'entity_id'];
      title: 'Create Integration Request';
      type: 'object';
    };
    credentials: {
      example: {
        address: '1234 example street';
        address2: null;
        city: 'Denver';
        company: 'Company name';
        country: 'US';
        email: 'example@example.com';
        first_name: 'Example';
        last_name: 'User';
        phone: '(555) 555-5555';
        state: 'CO';
        zip: '55555';
      };
      properties: {
        permissions: {
          properties: {
            api: {
              type: 'string';
            };
            mail: {
              type: 'string';
            };
            web: {
              type: 'string';
            };
          };
          type: 'object';
        };
        username: {
          type: 'string';
        };
      };
      title: 'Credentials';
      type: 'object';
    };
    'custom-fields-by-id': {
      example: {
        e2: 'Coffee is a beverage that puts one to sleep when not drank.';
        w1: '2002-10-02T15:00:00Z';
        w33: 9.5;
      };
      title: 'custom-fields-by-id';
      type: 'object';
    };
    'custom-fields-by-name': {
      example: {
        birthday: '2002-10-02T15:00:00Z';
        favoriteQuote: 'Coffee is a beverage that puts one to sleep when not drank.';
        shoe_size: 9.5;
      };
      title: 'custom-fields-by-name';
      type: 'object';
    };
    custom_field_definitions_response: {
      example: {
        field_type: 'Date';
        id: 'a1_D';
        name: 'custom_field_name';
      };
      properties: {
        field_type: {
          enum: ['Text', 'Number', 'Date'];
          type: 'string';
        };
        id: {
          type: 'string';
        };
        name: {
          maxLength: 100;
          minLength: 1;
          type: 'string';
        };
      };
      required: ['id', 'name', 'field_type'];
      title: 'custom_field_definitions_response';
      type: 'object';
    };
    'design-common-fields': {
      allOf: [
        {
          $ref: '#/components/schemas/design-duplicate-input';
        },
        {
          properties: {
            categories: {
              description: 'The list of categories applied to the design';
              items: {
                maxLength: 255;
                type: 'string';
              };
              maxItems: 10;
              type: 'array';
              uniqueItems: true;
            };
            generate_plain_content: {
              default: true;
              description: 'If true, plain_content is always generated from html_content. If false, plain_content is not altered.';
              type: 'boolean';
            };
            subject: {
              description: 'Subject of the Design.';
              maxLength: 5000;
              type: 'string';
            };
          };
          type: 'object';
        },
      ];
      title: 'Design Common Fields';
    };
    'design-duplicate-input': {
      example: {
        editor: 'design';
        name: 'Ahoy, Cake or Pie Cafe!';
      };
      properties: {
        editor: {
          description: 'The editor used in the UI.';
          enum: ['code', 'design'];
          type: 'string';
        };
        name: {
          default: 'Duplicate: <original design name>';
          description: 'The name of the new design.';
          type: 'string';
        };
      };
      title: 'Design Duplicate Design Input';
      type: 'object';
    };
    'design-input': {
      allOf: [
        {
          $ref: '#/components/schemas/design-duplicate-input';
        },
        {
          $ref: '#/components/schemas/design-common-fields';
        },
        {
          properties: {
            html_content: {
              description: 'The HTML content of the Design.';
              maxLength: 1048576;
              type: 'string';
            };
            plain_content: {
              default: '<generated from html_content if left empty>';
              description: 'Plain text content of the Design.';
              maxLength: 1048576;
              type: 'string';
            };
          };
          required: ['html_content'];
          type: 'object';
        },
      ];
      example: {
        editor: 'design';
        html_content: '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">\n<html data-editor-version="2" class="sg-campaigns" xmlns="http://www.w3.org/1999/xhtml">\n    <head>\n      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n      <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1">\n      <!--[if !mso]><!-->\n      <meta http-equiv="X-UA-Compatible" content="IE=Edge">\n      <!--<![endif]-->\n      <!--[if (gte mso 9)|(IE)]>\n      <xml>\n        <o:OfficeDocumentSettings>\n          <o:AllowPNG/>\n          <o:PixelsPerInch>96</o:PixelsPerInch>\n        </o:OfficeDocumentSettings>\n      </xml>\n      <![endif]-->\n      <!--[if (gte mso 9)|(IE)]>\n  <style type="text/css">\n    body {width: 600px;margin: 0 auto;}\n    table {border-collapse: collapse;}\n    table, td {mso-table-lspace: 0pt;mso-table-rspace: 0pt;}\n    img {-ms-interpolation-mode: bicubic;}\n  </style>\n<![endif]-->\n      <style type="text/css">\n    body, p, div {\n      font-family: arial,helvetica,sans-serif;\n      font-size: 14px;\n    }\n    body {\n      color: #000000;\n    }\n    body a {\n      color: #1188E6;\n      text-decoration: none;\n    }\n    p { margin: 0; padding: 0; }\n    table.wrapper {\n      width:100% !important;\n      table-layout: fixed;\n      -webkit-font-smoothing: antialiased;\n      -webkit-text-size-adjust: 100%;\n      -moz-text-size-adjust: 100%;\n      -ms-text-size-adjust: 100%;\n    }\n    img.max-width {\n      max-width: 100% !important;\n    }\n    .column.of-2 {\n      width: 50%;\n    }\n    .column.of-3 {\n      width: 33.333%;\n    }\n    .column.of-4 {\n      width: 25%;\n    }\n    ul ul ul ul  {\n      list-style-type: disc !important;\n    }\n    ol ol {\n      list-style-type: lower-roman !important;\n    }\n    ol ol ol {\n      list-style-type: lower-latin !important;\n    }\n    ol ol ol ol {\n      list-style-type: decimal !important;\n    }\n    @media screen and (max-width:480px) {\n      .preheader .rightColumnContent,\n      .footer .rightColumnContent {\n        text-align: left !important;\n      }\n      .preheader .rightColumnContent div,\n      .preheader .rightColumnContent span,\n      .footer .rightColumnContent div,\n      .footer .rightColumnContent span {\n        text-align: left !important;\n      }\n      .preheader .rightColumnContent,\n      .preheader .leftColumnContent {\n        font-size: 80% !important;\n        padding: 5px 0;\n      }\n      table.wrapper-mobile {\n        width: 100% !important;\n        table-layout: fixed;\n      }\n      img.max-width {\n        height: auto !important;\n        max-width: 100% !important;\n      }\n      a.bulletproof-button {\n        display: block !important;\n        width: auto !important;\n        font-size: 80%;\n        padding-left: 0 !important;\n        padding-right: 0 !important;\n      }\n      .columns {\n        width: 100% !important;\n      }\n      .column {\n        display: block !important;\n        width: 100% !important;\n        padding-left: 0 !important;\n        padding-right: 0 !important;\n        margin-left: 0 !important;\n        margin-right: 0 !important;\n      }\n      .social-icon-column {\n        display: inline-block !important;\n      }\n    }\n  </style>\n      <!--user entered Head Start--><!--End Head user entered-->\n    </head>\n    <body>\n      <center class="wrapper" data-link-color="#1188E6" data-body-style="font-size:14px; font-family:arial,helvetica,sans-serif; color:#000000; background-color:#FFFFFF;">\n        <div class="webkit">\n          <table cellpadding="0" cellspacing="0" border="0" width="100%" class="wrapper" bgcolor="#FFFFFF">\n            <tr>\n              <td valign="top" bgcolor="#FFFFFF" width="100%">\n                <table width="100%" role="content-container" class="outer" align="center" cellpadding="0" cellspacing="0" border="0">\n                  <tr>\n                    <td width="100%">\n                      <table width="100%" cellpadding="0" cellspacing="0" border="0">\n                        <tr>\n                          <td>\n                            <!--[if mso]>\n    <center>\n    <table><tr><td width="600">\n  <![endif]-->\n                                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px;" align="center">\n                                      <tr>\n                                        <td role="modules-container" style="padding:0px 0px 0px 0px; color:#000000; text-align:left;" bgcolor="#FFFFFF" width="100%" align="left"><table class="module preheader preheader-hide" role="module" data-type="preheader" border="0" cellpadding="0" cellspacing="0" width="100%" style="display: none !important; mso-hide: all; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0;">\n    <tr>\n      <td role="module-content">\n        <p></p>\n      </td>\n    </tr>\n  </table><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="41f90842-501c-4f08-96c9-17c0f74cb841" data-mc-module-version="2019-10-22">\n    <tbody>\n      <tr>\n        <td style="padding:18px 0px 18px 0px; line-height:22px; text-align:inherit;" height="100%" valign="top" bgcolor="" role="module-content"><div><div style="font-family: inherit; text-align: inherit">Ahoy, World!</div><div></div></div></td>\n      </tr>\n    </tbody>\n  </table><div data-role="module-unsubscribe" class="module" role="module" data-type="unsubscribe" style="color:#444444; font-size:12px; line-height:20px; padding:16px 16px 16px 16px; text-align:Center;" data-muid="4e838cf3-9892-4a6d-94d6-170e474d21e5"><div class="Unsubscribe--addressLine"><p class="Unsubscribe--senderName" style="font-size:12px; line-height:20px;">{{Sender_Name}}</p><p style="font-size:12px; line-height:20px;"><span class="Unsubscribe--senderAddress">{{Sender_Address}}</span>, <span class="Unsubscribe--senderCity">{{Sender_City}}</span>, <span class="Unsubscribe--senderState">{{Sender_State}}</span> <span class="Unsubscribe--senderZip">{{Sender_Zip}}</span></p></div><p style="font-size:12px; line-height:20px;"><a class="Unsubscribe--unsubscribeLink" href="{{{unsubscribe}}}" target="_blank" style="">Unsubscribe</a> - <a href="{{{unsubscribe_preferences}}}" target="_blank" class="Unsubscribe--unsubscribePreferences" style="">Unsubscribe Preferences</a></p></div></td>\n                                      </tr>\n                                    </table>\n                                    <!--[if mso]>\n                                  </td>\n                                </tr>\n                              </table>\n                            </center>\n                            <![endif]-->\n                          </td>\n                        </tr>\n                      </table>\n                    </td>\n                  </tr>\n                </table>\n              </td>\n            </tr>\n          </table>\n        </div>\n      </center>\n    </body>\n  </html>';
        name: 'Ahoy, World!';
        plain_content: 'Ahoy, World!\n\n{{Sender_Name}}\n\n{{Sender_Address}} , {{Sender_City}} , {{Sender_State}} {{Sender_Zip}}\n\nUnsubscribe ( {{{unsubscribe}}} ) - Unsubscribe Preferences ( {{{unsubscribe_preferences}}} )';
        subject: 'Getting Started';
      };
      title: 'Design Input';
    };
    'design-output': {
      allOf: [
        {
          $ref: '#/components/schemas/design-output-summary';
        },
        {
          $ref: '#/components/schemas/design-input';
        },
      ];
      title: 'Design Output';
    };
    'design-output-summary': {
      allOf: [
        {
          properties: {
            created_at: {
              description: 'Datetime that Design was created.';
              format: 'ISO 8601 date-time';
              type: 'string';
            };
            id: {
              description: 'ID of the Design.';
              format: 'uuid';
              type: 'string';
            };
            thumbnail_url: {
              description: "A Thumbnail preview of the template's html content.";
              type: 'string';
            };
            updated_at: {
              description: 'Datetime that Design was last updated.';
              format: 'ISO 8601 date-time';
              type: 'string';
            };
          };
          type: 'object';
        },
        {
          $ref: '#/components/schemas/design-duplicate-input';
        },
        {
          $ref: '#/components/schemas/design-common-fields';
        },
      ];
      example: {
        _metadata: {
          count: 3;
          self: 'https://api.sendgrid.com/v3/designs?page_token=vHdvHCg0w1F-TmWJcPNpTEnFY2aPEmRBHONwOgZ6TgJbX2_I';
        };
        result: [
          {
            categories: ['welcome', 'new customer'];
            created_at: '2021-04-09T17:29:46Z';
            editor: 'code';
            generate_plain_content: true;
            id: '3247eaea-c912-42a3-b0bc-60bdaf210396';
            name: 'Welcome Email';
            subject: 'Welcom to the Cake or Pie Cafe';
            thumbnail_url: '//us-east-2-production-thumbnail-bucket.s3.amazonaws.com/llny8o5b3m636z92p7hbjnmq1jvpka39p370jwtin2s1wxv7x1sgm0y5fk518d0s.png';
            updated_at: '2021-04-09T17:29:55Z';
          },
          {
            categories: ['promo', 'coupon'];
            created_at: '2021-04-09T17:29:21Z';
            editor: 'design';
            generate_plain_content: true;
            id: '02dfd792-f31f-439a-a79e-5c47fbcfdbac';
            name: 'Monthly Promo';
            subject: 'Free Dozen Cupcakes';
            thumbnail_url: '//us-east-2-production-thumbnail-bucket.s3.amazonaws.com/hfyxahd7ues2ajuoeoqq2xe6ibdasl1q89ox0y9ncya2ftpoicssmtf9ddus4c39.png';
            updated_at: '2021-04-09T17:29:42Z';
          },
          {
            categories: [];
            created_at: '2020-10-09T17:33:46Z';
            editor: 'design';
            generate_plain_content: true;
            id: 'e54be823-19ef-4c6f-8b60-efd7514f492d';
            name: 'Duplicate: Ingrid & Anders';
            subject: 'Welcome to Ingrid & Anders!';
            thumbnail_url: '//us-east-2-production-thumbnail-bucket.s3.amazonaws.com/12kni9gjpyb9uxmwr9vk7unycjr70u95zoyhe9sg2zounul2zg7dih1s20k13q2z.png';
            updated_at: '2021-04-07T19:57:52Z';
          },
        ];
      };
      title: 'Design Output - Summary';
    };
    'domain-authentication-200-response': {
      example: [
        {
          automatic_security: true;
          custom_spf: true;
          default: true;
          dns: {
            dkim1: {
              data: 's1._domainkey.u7.wl.sendgrid.net';
              host: 's1._domainkey.example.com';
              type: 'cname';
              valid: true;
            };
            dkim2: {
              data: 's2._domainkey.u7.wl.sendgrid.net';
              host: 's2._domainkey.example.com';
              type: 'cname';
              valid: true;
            };
            mail_cname: {
              data: 'u7.wl.sendgrid.net';
              host: 'mail.example.com';
              type: 'cname';
              valid: true;
            };
          };
          domain: 'example.com';
          id: 1;
          ips: ['192.168.1.1', '192.168.1.2'];
          legacy: false;
          subdomain: 'mail';
          user_id: 7;
          username: 'jane@example.com';
          valid: true;
        },
        {
          automatic_security: true;
          custom_spf: false;
          default: true;
          dns: {
            dkim1: {
              data: 'k=rsa; t=s; p=publicKey';
              host: 'example2.com';
              type: 'txt';
              valid: false;
            };
            dkim2: {
              data: 'k=rsa; t=s p=publicKey';
              host: 'example2.com';
              type: 'txt';
              valid: false;
            };
            mail_cname: {
              data: 'sendgrid.net';
              host: 'news.example2.com';
              type: 'mx';
              valid: false;
            };
          };
          domain: 'example2.com';
          id: 2;
          ips: [];
          legacy: false;
          subdomain: 'new';
          user_id: 8;
          username: 'john@example2.com';
          valid: false;
        },
      ];
      items: {
        allOf: [
          {
            $ref: '#/components/schemas/authentication_domain';
          },
          {
            properties: {
              last_validation_attempt_at: {
                description: 'A Unix epoch timestamp representing the last time of a validation attempt.';
                type: 'integer';
              };
              subusers: {
                items: {
                  properties: {
                    user_id: {
                      description: 'The ID of the subuser that this authenticated domain will be associated with.';
                      type: 'integer';
                    };
                    username: {
                      description: 'The username of the subuser that this authenticated domain is associated with.';
                      type: 'string';
                    };
                  };
                  type: 'object';
                };
                type: 'array';
              };
            };
            type: 'object';
          },
        ];
      };
      title: 'Domain Authentication 200 Response';
      type: 'array';
    };
    domain_authentication_domain_spf: {
      properties: {
        automatic_security: {
          description: 'Indicates if this authenticated domain uses automated security.';
          type: 'boolean';
        };
        custom_spf: {
          description: 'Indicates if this authenticated domain uses custom SPF.';
          type: 'boolean';
        };
        default: {
          description: 'Indicates if this is the default domain.';
          type: 'boolean';
        };
        dns: {
          description: 'The DNS records for this authenticated domain.';
          properties: {
            dkim: {
              description: 'The DKIM record for messages sent using this authenticated domain.';
              properties: {
                data: {
                  description: 'The DKIM record.';
                  type: 'string';
                };
                host: {
                  description: 'The DNS labels for the DKIM signature.';
                  type: 'string';
                };
                type: {
                  description: 'The type of data in the DKIM record.';
                  type: 'string';
                };
                valid: {
                  description: 'Indicates if the DKIM record is valid.';
                  type: 'boolean';
                };
              };
              required: ['host', 'type', 'data', 'valid'];
              type: 'object';
            };
            domain_spf: {
              description: 'The SPF record for the root domain.';
              properties: {
                data: {
                  description: 'The SPF record.';
                  type: 'string';
                };
                host: {
                  description: 'The root domain that this SPF record will be used to authenticate.';
                  type: 'string';
                };
                type: {
                  description: 'The type of data in the SPF record.';
                  type: 'string';
                };
                valid: {
                  description: 'Indicates if the SPF record is valid.';
                  type: 'boolean';
                };
              };
              required: ['host', 'type', 'data', 'valid'];
              type: 'object';
            };
            mail_server: {
              description: 'Designates which mail server is responsible for accepting messages from a domain.';
              properties: {
                data: {
                  description: 'The mail server responsible for accepting messages from the sending domain.';
                  type: 'string';
                };
                host: {
                  description: 'The domain sending the messages.';
                  type: 'string';
                };
                type: {
                  description: 'They type of DNS record.';
                  type: 'string';
                };
                valid: {
                  description: 'Indicates if this is a valid DNS record.';
                  type: 'boolean';
                };
              };
              required: ['host', 'type', 'data', 'valid'];
              type: 'object';
            };
            subdomain_spf: {
              description: 'The SPF record for the subdomain used to create this authenticated domain.';
              properties: {
                data: {
                  description: 'The SPF record.';
                  type: 'string';
                };
                host: {
                  description: 'The domain that this SPF record will be used to authenticate.';
                  type: 'string';
                };
                type: {
                  description: 'The type of data in the SPF record.';
                  type: 'string';
                };
                valid: {
                  description: 'Indicates if this is a valid SPF record.';
                  type: 'boolean';
                };
              };
              required: ['host', 'type', 'data', 'valid'];
              type: 'object';
            };
          };
          required: ['mail_server', 'subdomain_spf', 'domain_spf', 'dkim'];
          type: 'object';
        };
        domain: {
          description: 'The domain authenticated.';
          type: 'string';
        };
        id: {
          description: 'The ID of the authenticated domain.';
          type: 'integer';
        };
        ips: {
          description: 'The IP addresses that are included in the SPF record for this authenticated domain.';
          items: {};
          type: 'array';
        };
        legacy: {
          description: "Indicates if this authenticated domain was created using the legacy whitelabel tool. If it is a legacy whitelabel, it will still function, but you'll need to create a new authenticated domain if you need to update it.";
          type: 'boolean';
        };
        subdomain: {
          description: 'The subdomain that was used to create this authenticated domain.';
          type: 'string';
        };
        user_id: {
          description: 'The user_id of the account that this authenticated domain is associated with.';
          type: 'integer';
        };
        username: {
          description: 'The username of the account that this authenticated domain is associated with.';
          type: 'string';
        };
        valid: {
          description: 'Indicates if this is a valid authenticated domain .';
          type: 'boolean';
        };
      };
      required: [
        'id',
        'domain',
        'username',
        'user_id',
        'ips',
        'custom_spf',
        'default',
        'legacy',
        'automatic_security',
        'valid',
        'dns',
      ];
      title: 'Domain Authentication';
      type: 'object';
    };
    'email-activity-response-common-fields': {
      properties: {
        from_email: {
          default: '';
          description: "The 'From' email address used to deliver the message. This address should be a verified sender in your Twilio SendGrid account.";
          format: 'email';
          type: 'string';
        };
        msg_id: {
          description: 'A unique ID assigned to the message. This ID can be used to retrieve activity data for the specific message.';
          type: 'string';
        };
        status: {
          description: "The message's status.";
          enum: ['processed', 'delivered', 'not delivered'];
          type: 'string';
        };
        subject: {
          description: "The email's subject line.";
          type: 'string';
        };
        to_email: {
          description: "The intended recipient's email address.";
          format: 'email';
          type: 'string';
        };
      };
      title: 'Email Activity Response Common Fields';
      type: 'object';
    };
    'enforced-tls-request-response': {
      example: {
        require_tls: true;
        require_valid_cert: true;
      };
      properties: {
        require_tls: {
          description: 'Indicates if you want to require your recipients to support TLS. ';
          type: 'boolean';
        };
        require_valid_cert: {
          description: 'Indicates if you want to require your recipients to have a valid certificate.';
          type: 'boolean';
        };
      };
      title: 'Enforced TLS Request Response';
      type: 'object';
    };
    error: {
      properties: {
        error_id: {
          type: 'string';
        };
        field: {
          type: 'string';
        };
        message: {
          type: 'string';
        };
        parameter: {
          type: 'string';
        };
      };
      required: ['message'];
      title: 'error';
      type: 'object';
    };
    errors: {
      description: 'If the request is incorrect, an array of errors will be returned.';
      properties: {
        errors: {
          items: {
            properties: {
              field: {
                nullable: true;
                type: 'string';
              };
              message: {
                description: 'A description of what is wrong with the field passed in the request.';
                nullable: true;
                type: 'string';
              };
              parameter: {
                description: 'The parameter in the request body that is incorrect.';
                type: 'string';
              };
            };
            required: ['parameter', 'message'];
            type: 'object';
          };
          type: 'array';
        };
      };
      required: ['errors'];
      title: 'Errors';
      type: 'object';
    };
    'errors-seg-v2': {
      description: 'If the request is incorrect, an array of errors will be returned.';
      properties: {
        errors: {
          items: {
            properties: {
              field: {
                description: 'the field in the request body that is incorrect';
                type: 'string';
              };
              message: {
                description: 'a description of what is specifically wrong with the field passed in the request';
                type: 'string';
              };
            };
            required: ['field', 'message'];
            type: 'object';
          };
          type: 'array';
        };
      };
      required: ['errors'];
      title: 'errors-seg';
      type: 'object';
    };
    'event-webhook-response': {
      properties: {
        bounce: {
          description: 'Receiving server could not or would not accept message.';
          type: 'boolean';
        };
        click: {
          description: 'Recipient clicked on a link within the message. You need to enable Click Tracking for getting this type of event.';
          type: 'boolean';
        };
        deferred: {
          description: "Recipient's email server temporarily rejected message.";
          type: 'boolean';
        };
        delivered: {
          description: 'Message has been successfully delivered to the receiving server.';
          type: 'boolean';
        };
        dropped: {
          description: 'You may see the following drop reasons: Invalid SMTPAPI header, Spam Content (if spam checker app enabled), Unsubscribed Address, Bounced Address, Spam Reporting Address, Invalid, Recipient List over Package Quota';
          type: 'boolean';
        };
        enabled: {
          description: 'Indicates if the event webhook is enabled.';
          type: 'boolean';
        };
        group_resubscribe: {
          description: 'Recipient resubscribes to specific group by updating preferences. You need to enable Subscription Tracking for getting this type of event.';
          type: 'boolean';
        };
        group_unsubscribe: {
          description: 'Recipient unsubscribe from specific group, by either direct link or updating preferences. You need to enable Subscription Tracking for getting this type of event.';
          type: 'boolean';
        };
        oauth_client_id: {
          description: 'The client ID Twilio SendGrid sends to your OAuth server or service provider to generate an OAuth access token.';
          type: 'string';
        };
        oauth_token_url: {
          description: 'The URL where Twilio SendGrid sends the Client ID and Client Secret to generate an access token. This should be your OAuth server or service provider.';
          type: 'string';
        };
        open: {
          description: 'Recipient has opened the HTML message. You need to enable Open Tracking for getting this type of event.';
          type: 'boolean';
        };
        processed: {
          description: 'Message has been received and is ready to be delivered.';
          type: 'boolean';
        };
        spam_report: {
          description: 'Recipient marked a message as spam.';
          type: 'boolean';
        };
        unsubscribe: {
          description: "Recipient clicked on message's subscription management link. You need to enable Subscription Tracking for getting this type of event.";
          type: 'boolean';
        };
        url: {
          description: 'The URL that you want the event webhook to POST to.';
          type: 'string';
        };
      };
      required: [
        'enabled',
        'url',
        'group_resubscribe',
        'delivered',
        'group_unsubscribe',
        'spam_report',
        'bounce',
        'deferred',
        'unsubscribe',
        'processed',
        'open',
        'click',
        'dropped',
      ];
      title: 'Webhooks: Event Webhook Response';
      type: 'object';
    };
    'event-webhook-update-oauth-request': {
      properties: {
        bounce: {
          description: 'Receiving server could not or would not accept message.';
          type: 'boolean';
        };
        click: {
          description: 'Recipient clicked on a link within the message. You need to enable Click Tracking for getting this type of event.';
          type: 'boolean';
        };
        deferred: {
          description: "Recipient's email server temporarily rejected message.";
          type: 'boolean';
        };
        delivered: {
          description: 'Message has been successfully delivered to the receiving server.';
          type: 'boolean';
        };
        dropped: {
          description: 'You may see the following drop reasons: Invalid SMTPAPI header, Spam Content (if spam checker app enabled), Unsubscribed Address, Bounced Address, Spam Reporting Address, Invalid, Recipient List over Package Quota';
          type: 'boolean';
        };
        enabled: {
          description: 'Indicates if the event webhook is enabled.';
          type: 'boolean';
        };
        group_resubscribe: {
          description: 'Recipient resubscribes to specific group by updating preferences. You need to enable Subscription Tracking for getting this type of event.';
          type: 'boolean';
        };
        group_unsubscribe: {
          description: 'Recipient unsubscribe from specific group, by either direct link or updating preferences. You need to enable Subscription Tracking for getting this type of event.';
          type: 'boolean';
        };
        oauth_client_id: {
          description: 'The client ID Twilio SendGrid sends to your OAuth server or service provider to generate an OAuth access token. When passing data in this field, you must also include the oauth_token_url field.';
          type: 'string';
        };
        oauth_client_secret: {
          description: 'This secret is needed only once to create an access token. SendGrid will store this secret, allowing you to update your Client ID and Token URL without passing the secret to SendGrid again.  When passing data in this field, you must also include the oauth_client_id and oauth_token_url fields.';
          type: 'string';
        };
        oauth_token_url: {
          description: 'The URL where Twilio SendGrid sends the Client ID and Client Secret to generate an access token. This should be your OAuth server or service provider. When passing data in this field, you must also include the oauth_client_id field.';
          type: 'string';
        };
        open: {
          description: 'Recipient has opened the HTML message. You need to enable Open Tracking for getting this type of event.';
          type: 'boolean';
        };
        processed: {
          description: 'Message has been received and is ready to be delivered.';
          type: 'boolean';
        };
        spam_report: {
          description: 'Recipient marked a message as spam.';
          type: 'boolean';
        };
        unsubscribe: {
          description: "Recipient clicked on message's subscription management link. You need to enable Subscription Tracking for getting this type of event.";
          type: 'boolean';
        };
        url: {
          description: 'The URL that you want the event webhook to POST to.';
          type: 'string';
        };
      };
      required: [
        'enabled',
        'url',
        'group_resubscribe',
        'delivered',
        'group_unsubscribe',
        'spam_report',
        'bounce',
        'deferred',
        'unsubscribe',
        'processed',
        'open',
        'click',
        'dropped',
      ];
      title: 'Webhooks: Event Webhook Update with OAuth Request';
      type: 'object';
    };
    from_email_object: {
      example: {
        email: 'jane_doe@example.com';
        name: 'Jane Doe';
      };
      properties: {
        email: {
          description: "The 'From' email address used to deliver the message. This address should be a verified sender in your Twilio SendGrid account.";
          format: 'email';
          type: 'string';
        };
        name: {
          description: 'A name or title associated with the sending email address.';
          type: 'string';
        };
      };
      required: ['email'];
      title: 'From Email Object';
      type: 'object';
    };
    'full-segment': {
      allOf: [
        {
          $ref: '#/components/schemas/segment_summary';
        },
        {
          properties: {
            contacts_sample: {
              items: {
                $ref: '#/components/schemas/contact_response';
              };
              type: 'array';
            };
            query_json: {
              description: 'AST representation of the query DSL';
              type: 'object';
            };
          };
          required: ['contacts_sample'];
          type: 'object';
        },
        {
          $ref: '#/components/schemas/segment_write_v2';
        },
      ];
      example: {
        contacts_count: 9266921;
        contacts_sample: [
          {
            address_line_1: 'sunt aliqua';
            address_line_2: 'sit proident Lorem veniam labore';
            alternate_emails: [
              'yKDUP11FDch@QoU.vwy',
              'ZNSN5@czAMqPi.at',
              '7wr51kFVVKlcBSH@DWxOueOZepetzBrku.qosk',
              'iib-ObtO7Fxz5@vLJPRIFKPOqJGCEqcIDab.ypn',
            ];
            city: 'ȎţȸÛ\tč\u000bCŁ';
            contact_id: 'c1183ada-b784-49ac-9b1f-50e73578a6dc';
            country: 'do reprehenderit qui';
            custom_fields: {
              custom_field_name1: 'esse';
              custom_field_name2: 'in consectetur ut aliqua sint';
            };
            first_name: 'est';
            last_name: 'eiusmod in laboris velit cupidatat';
            postal_code: 30296612;
            primary_email: 'ft88@d.izxx';
            state_province_region: 'ut proident';
          },
        ];
        created_at: '2085-08-08T21:07:05.692Z';
        id: '58567a46-305e-48d1-b4f8-a006c906920e';
        name: 'culpa';
        next_sample_update: '';
        parent_list_id: '2357714d-3d82-4c80-826c-b44a4147f81c';
        query_dsl: 'cillum eiusmod';
        sample_updated_at: '3407-09-25T04:25:02.140Z';
        updated_at: '4431-05-07T22:23:22.352Z';
      };
      title: 'full_segment';
    };
    global_empty_request: {
      nullable: true;
      title: 'Global: Request Empty Body';
    };
    global_error_response_schema: {
      example: {
        errors: [
          {
            field: 'field_name';
            message: 'error message';
          },
        ];
      };
      properties: {
        errors: {
          items: {
            properties: {
              field: {
                description: 'the field that generated the error';
                nullable: true;
                type: 'string';
              };
              help: {
                description: 'helper text or docs for troubleshooting';
                type: 'object';
              };
              message: {
                description: 'the error message';
                type: 'string';
              };
            };
            required: ['message'];
            type: 'object';
          };
          type: 'array';
        };
        id: {
          type: 'string';
        };
      };
      title: 'Global Error Response Schema';
      type: 'object';
    };
    global_id: {
      title: 'Global: ID';
      type: 'integer';
    };
    google_analytics_settings: {
      example: {
        enabled: true;
        utm_campaign: 'website';
        utm_content: '';
        utm_medium: 'email';
        utm_source: 'sendgrid.com';
        utm_term: '';
      };
      properties: {
        enabled: {
          description: 'Indicates if Google Analytics is enabled.';
          type: 'boolean';
        };
        utm_campaign: {
          description: 'The name of the campaign.';
          type: 'string';
        };
        utm_content: {
          description: 'Used to differentiate ads';
          type: 'string';
        };
        utm_medium: {
          description: 'Name of the marketing medium (e.g. "Email").';
          type: 'string';
        };
        utm_source: {
          description: 'Name of the referrer source. ';
          type: 'string';
        };
        utm_term: {
          description: 'Any paid keywords.';
          type: 'string';
        };
      };
      title: 'Settings: Google Analytics';
      type: 'object';
    };
    'invalid-email': {
      example: {
        created: 1620141015;
        email: 'invalid@example.com';
        reason: 'Mail domain mentioned in email address is unknown';
      };
      properties: {
        created: {
          description: 'A Unix timestamp indicating when the email address was added to the invalid emails list.';
          type: 'integer';
        };
        email: {
          description: 'The email address that was marked as invalid.';
          format: 'email';
          type: 'string';
        };
        reason: {
          description: 'The reason that the email address was marked as invalid.';
          type: 'string';
        };
      };
      title: 'Invalid Email';
      type: 'object';
    };
    'ip-access-response': {
      example: {
        result: [
          {
            created_at: 1441824715;
            id: 1;
            ip: '192.168.1.1/32';
            updated_at: 1441824715;
          },
          {
            created_at: 1441824715;
            id: 2;
            ip: '192.0.0.0/8';
            updated_at: 1441824715;
          },
          {
            created_at: 1441824715;
            id: 3;
            ip: '192.168.1.3/32';
            updated_at: 1441824715;
          },
        ];
      };
      properties: {
        result: {
          description: 'An array listing all of your allowed IPs.';
          items: {
            properties: {
              created_at: {
                description: 'A Unix timestamp indicating when the IP was added to the allow list.';
                type: 'integer';
              };
              id: {
                description: 'The ID of the allowed IP.';
                type: 'integer';
              };
              ip: {
                description: 'The allowed IP.';
                type: 'string';
              };
              updated_at: {
                description: 'A Unix timestamp indicating when the IPs allow status was most recently updated.';
                type: 'integer';
              };
            };
            type: 'object';
          };
          type: 'array';
        };
      };
      title: 'IP Access Response';
      type: 'object';
    };
    ip_pool: {
      properties: {
        name: {
          description: 'The name of the IP pool.';
          maxLength: 64;
          type: 'string';
        };
      };
      required: ['name'];
      title: 'IP Pools: Pool';
      type: 'object';
    };
    ip_pool_response: {
      example: {
        name: 'sunt sint enim';
      };
      properties: {
        name: {
          description: 'The name of the IP pool.';
          type: 'string';
        };
      };
      title: 'IP Pools: Pool Resp';
      type: 'object';
    };
    ip_warmup_response: {
      example: [
        {
          ip: '0.0.0.0';
          start_date: 1409616000;
        },
      ];
      items: {
        properties: {
          ip: {
            description: 'The IP address.';
            type: 'string';
          };
          start_date: {
            description: 'A Unix timestamp indicating when the IP address entered warmup mode.';
            type: 'integer';
          };
        };
        required: ['ip', 'start_date'];
        type: 'object';
      };
      title: 'IP Warmup: IP';
      type: 'array';
    };
    link: {
      properties: {
        href: {
          type: 'string';
        };
        rel: {
          type: 'string';
        };
      };
      title: 'Link';
      type: 'object';
    };
    'link-tracking-metadata': {
      properties: {
        count: {
          description: 'The number of items in the entire list, i.e., across all pages.';
          type: 'number';
        };
        next: {
          description: "The URL of the next page of results. If this field isn't present, you're at the end of the list.";
          format: 'uri';
          type: 'string';
        };
        prev: {
          description: "The URL of the previous page of results. If this field isn't present, you're at the start of the list.";
          format: 'uri';
          type: 'string';
        };
        self: {
          description: 'The URL of the current page of results.';
          format: 'uri';
          type: 'string';
        };
      };
      title: 'link tracking metadata';
      type: 'object';
    };
    link_branding_200_response: {
      properties: {
        default: {
          description: 'Indicates if this is the default link branding.';
          enum: [true, false];
          type: 'boolean';
        };
        dns: {
          description: 'The DNS records generated for this link branding.';
          properties: {
            domain_cname: {
              description: 'The DNS record generated to point to your link branding subdomain.';
              properties: {
                data: {
                  description: 'The domain that the DNS record points to.';
                  type: 'string';
                };
                host: {
                  description: 'The domain that this link branding will use for the links in your email.';
                  type: 'string';
                };
                type: {
                  description: 'The type of DNS record that was generated.';
                  enum: ['cname', 'txt', 'mx'];
                  type: 'string';
                };
                valid: {
                  description: 'Indicates if the DNS record is valid.';
                  enum: [true, false];
                  type: 'boolean';
                };
              };
              required: ['valid', 'type', 'host', 'data'];
              type: 'object';
            };
            owner_cname: {
              description: 'The DNS record generated to verify who created the link branding.';
              properties: {
                data: {
                  description: 'The domain that the DNS record points to.';
                  type: 'string';
                };
                host: {
                  description: 'Used to verify the link branding. The subdomain of this domain is the ID of the user who created the link branding.';
                  type: 'string';
                };
                type: {
                  description: 'The type of DNS record generated.';
                  enum: ['cname', 'txt', 'mx'];
                  type: 'string';
                };
                valid: {
                  description: 'Indicates if the DNS record is valid.';
                  enum: [true, false];
                  type: 'boolean';
                };
              };
              required: ['valid', 'host', 'data'];
              type: 'object';
            };
          };
          required: ['domain_cname'];
          type: 'object';
        };
        domain: {
          description: 'The root domain of the branded link.';
          type: 'string';
        };
        id: {
          description: 'The ID of the branded link.';
          type: 'integer';
        };
        legacy: {
          description: "Indicates if this link branding was created using the legacy whitelabel tool. If it is a legacy whitelabel, it will still function, but you'll need to create new link branding if you need to update it.";
          enum: [true, false];
          type: 'boolean';
        };
        subdomain: {
          description: 'The subdomain used to generate the DNS records for this link branding. This subdomain must be different from the subdomain used for your authenticated domain.';
          type: 'string';
        };
        user_id: {
          description: 'The ID of the user that this link branding is associated with.';
          type: 'integer';
        };
        username: {
          description: 'The username of the account that this link branding is associated with.';
          type: 'string';
        };
        valid: {
          description: 'Indicates if this link branding is valid.';
          enum: [true, false];
          type: 'boolean';
        };
      };
      required: ['id', 'domain', 'username', 'user_id', 'default', 'valid', 'legacy', 'dns'];
      title: 'Link Branding 200 Response';
      type: 'object';
    };
    list: {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/selfmetadata';
        };
        contact_count: {
          description: 'The number of contacts currently stored on the list.';
          type: 'integer';
        };
        id: {
          description: 'The generated ID for your list.';
          maxLength: 36;
          minLength: 36;
          type: 'string';
        };
        name: {
          description: 'The name you gave your list.';
          type: 'string';
        };
      };
      title: 'list';
      type: 'object';
    };
    mail_batch_id: {
      example: {
        batch_id: 'HkJ5yLYULb7Rj8GKSx7u025ouWVlMgAi';
      };
      properties: {
        batch_id: {
          pattern: '^[a-zA-Z0-9\\-\\_]';
          type: 'string';
        };
      };
      required: ['batch_id'];
      title: 'Mail Batch ID';
      type: 'object';
    };
    mail_settings_address_whitelabel: {
      example: {
        enabled: true;
        list: ['email1@example.com', 'example.com'];
      };
      properties: {
        enabled: {
          description: 'Indicates if you have an email address whitelist enabled. ';
          type: 'boolean';
        };
        list: {
          description: 'All email addresses that are currently on the whitelist.';
          items: {
            type: 'string';
          };
          type: 'array';
        };
      };
      title: 'Mail Settings: Address Whitelabel';
      type: 'object';
    };
    mail_settings_bounce_purge: {
      example: {
        enabled: false;
        hard_bounces: null;
        soft_bounces: 1234;
      };
      properties: {
        enabled: {
          description: 'Indicates if the bounce purge mail setting is enabled.';
          type: 'boolean';
        };
        hard_bounces: {
          description: 'The number of days after which SendGrid will purge all contacts from your hard bounces suppression lists.';
          nullable: true;
          type: 'integer';
        };
        soft_bounces: {
          description: 'The number of days after which SendGrid will purge all contacts from your soft bounces suppression lists.';
          nullable: true;
          type: 'integer';
        };
      };
      title: 'Mail Settings: Bounce Purge';
      type: 'object';
    };
    mail_settings_footer: {
      example: {
        enabled: true;
        html_content: 'Example HTML content';
        plain_content: 'Example plain content';
      };
      properties: {
        enabled: {
          description: 'Indicates if the Footer mail setting is currently enabled.';
          type: 'boolean';
        };
        html_content: {
          description: 'The custom HTML content of your email footer.';
          type: 'string';
        };
        plain_content: {
          description: 'The plain text content of your email footer.';
          type: 'string';
        };
      };
      title: 'Mail Settings: Footer';
      type: 'object';
    };
    mail_settings_forward_bounce: {
      example: {
        email: null;
        enabled: false;
      };
      properties: {
        email: {
          description: 'The email address that you would like your bounce reports forwarded to.';
          nullable: true;
          type: 'string';
        };
        enabled: {
          description: 'Indicates if the bounce forwarding mail setting is enabled.';
          type: 'boolean';
        };
      };
      title: 'Mail Settings: Forward Bounce';
      type: 'object';
    };
    mail_settings_forward_spam: {
      example: {
        email: '';
        enabled: true;
      };
      properties: {
        email: {
          description: 'The email address where you would like the spam reports to be forwarded.';
          type: 'string';
        };
        enabled: {
          description: 'Indicates if the Forward Spam setting is enabled.';
          type: 'boolean';
        };
      };
      title: 'Mail Settings: Forward Spam';
      type: 'object';
    };
    mail_settings_patch: {
      example: {
        email: 'email@example.com';
        enabled: true;
      };
      properties: {
        email: {
          description: 'The email address of the recipient.';
          type: 'string';
        };
        enabled: {
          description: 'Indicates if the mail setting is enabled.';
          type: 'boolean';
        };
      };
      title: 'Mail Settings: Patch';
      type: 'object';
    };
    mail_settings_template: {
      example: {
        enabled: false;
        html_content: '<p><% body %>Example</p>\n';
      };
      properties: {
        enabled: {
          description: 'Indicates if the legacy email template setting is enabled.';
          type: 'boolean';
        };
        html_content: {
          description: 'The HTML content that you want to use for your legacy email template.';
          type: 'string';
        };
      };
      title: 'Mail Settings: Template';
      type: 'object';
    };
    mako_event: {
      example: {
        bounce_type: 'blocked';
        event_name: 'bounced';
        http_user_agent: 'in tempor ex dolore est';
        mx_server: 'quis proident';
        processed: '2017-10-13T18:56:21Z';
        reason: 'some reason';
        url: 'http://3LX,MU}N=B8\'d,K}>bEma{l~!ad%peIF}y>qHfLPWQ$l9b\\!6.1H?$Z9H"il-_gZD>/JPYsGqH4x4_3v090TCtnFalXGFiAdooDxgrDAYNXShUywSxwYr8gKeyc/4sal4VJ3IxEWsG74V5MYQ0mz27jhy7n5DHsUtApQ6zXHS13uO5vYBlJHpJRfuT6/F5nIpkHre2w3eTtN7M6pg9V5stjnnsavKkzQxyTv15CMSDLFwR_BTZwofhWpyBU7B9ypYL79vT97N3LDZyoaM/fNsOLPIqfGBer_Mx9_StergbQYANyOmOSjR6pZof01ky/ZcNDhpu3CkSl4MTtQ3NMCX780pOKQ5SYIPigyvz9IC9WtrCNcOkTxdOPdY0_4MJU4EuTTPmGvO/14KaJCDjIjgrbIqpzuUEL5mET0t2VeVlwvtnOnlHaBE8sic20ze2E0Xt3ETqXyzVJRjLDKh/LWkW8OVp_xkLBCCW7LQngRukKcOiWjMXeCEhYI9HoZ0RsMEWZC8KzRaHc4OI0uXPD4M9pav1LGrI/_0t_RnBnfnqGKsBJr0kdQi/Y6QN_aeawIqX5hDNIU3MF/wWKVWLS0ZFbDfK6KVv5oAid83EpwKoazAMA8MTfEXvHQLO7k7XYWX1Il3eGXL6/wCA96I1SOabzJkZHo2HsFpIC/VBk52Lnpp0xtDH/OCdlQ5e4PpxXQeklp70LPOndr7QKSYEQNUc48n36ixvTjhgpgO8wHsFFYqGcuBMHg9oaCARppQomiQDWYuVPVDynJHdsM1_gWl4/NSs8Y9PL7DrQXOu0UiFRRE0TUsvgqyUgJzlGjUnRziyYeROO75D0K_3aTtbGbCmhaxecos40a1w0PDCNkFp1W/iHwY7922drhsoM6ShwqqwGpAh5HLuU6Q5gqyckeai6YN7HCh9DdHPhhJcatgtMHZDKfQUBVt9ecUlDgiCFF_OnRX/GpzttcsL8E2FoXL9_eAWvSqjodROqx7MZCA/ORdnR/IssPCYP1kTHTIL5mZxv4UGEpyNjUzt4GdSJJTm0nztltWDYX8_Ezl2JvpLVnGVTJxobb4yQIJhe3n64khbOFyFLKHWEniIolm/AxpZQYmseWlVqrIz3YXU59XaSbTTrdCHNhvwF1ogXiiggN6TZ2B3QY_mBEtAp/SD0ONPVqEUkTNAFWTgnnlv6ZIMdMbTw5uZwtFRlB7qDvQouml9kujGmRu6k7zZMTOwWowRNtpboLUcL2NzkVgK6N1Zi2vq/Nt4NJvM5_l1dpIIbwJv_CIcZQZOqPtRWULa2iVxfmJJQaqgLQPwSHQH1zuRJMhraEsPjqVQRC0pZpSt/24VBDN8y31Ye/y_ekWxMdZCvr978C/WrdcTi29kxjJLyT9BII7BsgT5vLuI2l7ntqRAhAUWMs/h9JR0i8RbX5OfB46q41/TfmSdgi97bCR2HfgflyypXwKhRfKYU2MVpu2Dd90WQUlm7hZV8dSfGusuMj/nPMpRVWcbnvlAdsehJCPbLv6n4qdLSPeoMBo32acAGgu1BwBG8JsBgbH43yYi5X7UdGRWKqm_ZbqaDEKH3ncU/uA8EOJb41VfGho4LUeOi1IeYwVAhFEyO6YbteYZecEubrNFZrWWjZUqhzouzY95TeWU8E4StCXVPKlYPiFiwUSX20kG0lVtDbAy/7u4f4x0cYlFOvI1UN1qoOExmNxnxzQQFeM5exWfW2JrRXq5e0UdAJr4q2o9Y_0WaGfhL/nP6Ei06YajDKr11dK5H0LX/9CGTC37HFZeopyopzP_7fvGFkqIRoGTS48pLaIFz3gwpQNlWXUFCsd/PnRlsqJ3SBQSgp_AQe2cP6iBNy2bJI8lkxwY5YVDDdjxusuCcafdjfs2aUa/4tr_iMnNBnd27GxjQI28_JGJlfbOaajVJOxuPMT4ELpYCfPiFjdSbJyE0/gCwtj0rgDKSLWJnOPJ5TAJ935gCqeIsBhOhfcZX413GdilBZRRYEjCVKfOuWzHZ3GW/8yjyk5e_WMNv5F6xggl07w90DBwpx/Q/iWfncqMuSfoeFeqHQkDL9F5W19j1cGuAcyfIYMAXztHXpgTKh9vZcsLYC7LcgKr4FQj3JjEvtnDG2PjcMjGF/MnbCRCz22Ho410_vE9M1Hpq0wdk_i5DbZKNoSwlPgey9URkpuX146TcDdsx_VWDenCepY5HwMr9CPOY9hzUs/c5AWeUMXk/gvsI81Jkv5rHpEnNBUZXYzfqkwQfffhmrc/StLCtzRRlja8dpsEWdkzoKR9Kdxq1qAs5f0sdrGjVRLTT_s1Q2P59zhA/QmS4bubi64cYot3gSIgdNnkjA2GjCp1ETVa548_U9B6boTKDVmaKJlVIDvqL84RC3WI7Er/8opi2lZ48W83Ur47BRh38oOnI0agrCyZz8bp1w_gfVRlSO8PS0i/l_/qxq5xpLbhPkdxVoyZVsNAZchfnmkIHyIk5IK6EUDXdMR21y6OvKW50ZbooAtk9ymynBj4dAYMsd25RV7FE1I1vRTsiDw52/.E5WC0Ymo2zn.qelSbhzr-4laArYiWP.dwJB6qm_6rs0Rm5UXYaYtUNbh76_jJp_X1xQUCDSgbr2KOkDU0"Q/-4dV"Yk3QGg[(O86=Pf"e17K4\'r{)kicofHSXcMmP@>VF^`~4j4F*L/1]tD+Lw!WI!@]*OZm6C`M$u96}*O<U;_cZ84k.|nIqpAaeiroItOenDBL';
      };
      properties: {
        attempt_num: {
          description: 'Used with "deferred" events to indicate the attempt number out of 10. One "deferred" entry will exists under events array for each time a message was deferred with error message from the server. ';
          maximum: 10;
          minimum: 1;
          type: 'integer';
        };
        bounce_type: {
          description: 'Use to distinguish between types of bounces';
          enum: ['bounced', 'blocked', 'expired'];
          type: 'string';
        };
        event_name: {
          description: 'Name of event';
          enum: [
            'bounced',
            'opened',
            'clicked',
            'processed',
            'dropped',
            'delivered',
            'deferred',
            'spam_report',
            'unsubscribe',
            'group_unsubscribe',
            'group_resubscribe',
          ];
          type: 'string';
        };
        http_user_agent: {
          description: 'Client recipient used to click or open message';
          type: 'string';
        };
        mx_server: {
          description: 'For example mx.gmail.com';
          type: 'string';
        };
        processed: {
          description: 'Date of when event occurred';
          type: 'string';
        };
        reason: {
          description: 'Explanation of what caused "bounced", "deferred", or "blocked". Usually contains error message from the server - e.g. message from gmail why mail was deferred';
          maxLength: 1024;
          type: 'string';
        };
        url: {
          description: 'Used with "clicked" event to indicate which url the user clicked.';
          pattern: '^((http[s]?|ftp):\\/)?\\/?([^:\\/\\s]+)((\\/\\w+)*\\/)([\\w\\-\\.]+[^#?\\s]+)(.*)?(#[\\w\\-]+)?$';
          type: 'string';
        };
      };
      required: ['event_name', 'processed', 'url', 'bounce_type', 'http_user_agent', 'mx_server'];
      title: 'Event';
      type: 'object';
    };
    message: {
      example: {
        api_key_id: 'sdfsdfsdf123';
        asm_group_id: 11376349;
        categories: ['hi', 'bye'];
        events: [
          {
            event_name: 'bounced';
            processed: 1492453589;
            server_response: 'some error message';
          },
        ];
        from_email: 'test@test.com';
        msg_id: 'in aliquip id aliqua';
        originating_ip: '2.3.4.5';
        outbound_ip: '1.2.3.4';
        outbound_ip_type: 'dedicated';
        status: 'not delivered';
        subject: 'est incididunt adipisicing pariatur';
        teammate: '';
        template_id: '123e4567-e89b-12d3-a456-426655440000';
        to_email: 'send@test.com';
        unique_args: "{'key': 'value'}";
      };
      properties: {
        api_key_id: {
          maxLength: 50;
          minLength: 3;
          pattern: '^[A-Za-z0-9]+';
          type: 'string';
        };
        asm_group_id: {
          minimum: 1;
          type: 'integer';
        };
        categories: {
          description: 'Categories users associated to the message';
          items: {
            type: 'string';
          };
          type: 'array';
        };
        events: {
          description: 'List of events related to email message';
          items: {
            example: {
              bounce_type: 'blocked';
              event_name: 'bounced';
              http_user_agent: 'in tempor ex dolore est';
              mx_server: 'quis proident';
              processed: '2017-10-13T18:56:21Z';
              reason: 'some reason';
              url: 'http://3LX,MU}N=B8\'d,K}>bEma{l~!ad%peIF}y>qHfLPWQ$l9b\\!6.1H?$Z9H"il-_gZD>/JPYsGqH4x4_3v090TCtnFalXGFiAdooDxgrDAYNXShUywSxwYr8gKeyc/4sal4VJ3IxEWsG74V5MYQ0mz27jhy7n5DHsUtApQ6zXHS13uO5vYBlJHpJRfuT6/F5nIpkHre2w3eTtN7M6pg9V5stjnnsavKkzQxyTv15CMSDLFwR_BTZwofhWpyBU7B9ypYL79vT97N3LDZyoaM/fNsOLPIqfGBer_Mx9_StergbQYANyOmOSjR6pZof01ky/ZcNDhpu3CkSl4MTtQ3NMCX780pOKQ5SYIPigyvz9IC9WtrCNcOkTxdOPdY0_4MJU4EuTTPmGvO/14KaJCDjIjgrbIqpzuUEL5mET0t2VeVlwvtnOnlHaBE8sic20ze2E0Xt3ETqXyzVJRjLDKh/LWkW8OVp_xkLBCCW7LQngRukKcOiWjMXeCEhYI9HoZ0RsMEWZC8KzRaHc4OI0uXPD4M9pav1LGrI/_0t_RnBnfnqGKsBJr0kdQi/Y6QN_aeawIqX5hDNIU3MF/wWKVWLS0ZFbDfK6KVv5oAid83EpwKoazAMA8MTfEXvHQLO7k7XYWX1Il3eGXL6/wCA96I1SOabzJkZHo2HsFpIC/VBk52Lnpp0xtDH/OCdlQ5e4PpxXQeklp70LPOndr7QKSYEQNUc48n36ixvTjhgpgO8wHsFFYqGcuBMHg9oaCARppQomiQDWYuVPVDynJHdsM1_gWl4/NSs8Y9PL7DrQXOu0UiFRRE0TUsvgqyUgJzlGjUnRziyYeROO75D0K_3aTtbGbCmhaxecos40a1w0PDCNkFp1W/iHwY7922drhsoM6ShwqqwGpAh5HLuU6Q5gqyckeai6YN7HCh9DdHPhhJcatgtMHZDKfQUBVt9ecUlDgiCFF_OnRX/GpzttcsL8E2FoXL9_eAWvSqjodROqx7MZCA/ORdnR/IssPCYP1kTHTIL5mZxv4UGEpyNjUzt4GdSJJTm0nztltWDYX8_Ezl2JvpLVnGVTJxobb4yQIJhe3n64khbOFyFLKHWEniIolm/AxpZQYmseWlVqrIz3YXU59XaSbTTrdCHNhvwF1ogXiiggN6TZ2B3QY_mBEtAp/SD0ONPVqEUkTNAFWTgnnlv6ZIMdMbTw5uZwtFRlB7qDvQouml9kujGmRu6k7zZMTOwWowRNtpboLUcL2NzkVgK6N1Zi2vq/Nt4NJvM5_l1dpIIbwJv_CIcZQZOqPtRWULa2iVxfmJJQaqgLQPwSHQH1zuRJMhraEsPjqVQRC0pZpSt/24VBDN8y31Ye/y_ekWxMdZCvr978C/WrdcTi29kxjJLyT9BII7BsgT5vLuI2l7ntqRAhAUWMs/h9JR0i8RbX5OfB46q41/TfmSdgi97bCR2HfgflyypXwKhRfKYU2MVpu2Dd90WQUlm7hZV8dSfGusuMj/nPMpRVWcbnvlAdsehJCPbLv6n4qdLSPeoMBo32acAGgu1BwBG8JsBgbH43yYi5X7UdGRWKqm_ZbqaDEKH3ncU/uA8EOJb41VfGho4LUeOi1IeYwVAhFEyO6YbteYZecEubrNFZrWWjZUqhzouzY95TeWU8E4StCXVPKlYPiFiwUSX20kG0lVtDbAy/7u4f4x0cYlFOvI1UN1qoOExmNxnxzQQFeM5exWfW2JrRXq5e0UdAJr4q2o9Y_0WaGfhL/nP6Ei06YajDKr11dK5H0LX/9CGTC37HFZeopyopzP_7fvGFkqIRoGTS48pLaIFz3gwpQNlWXUFCsd/PnRlsqJ3SBQSgp_AQe2cP6iBNy2bJI8lkxwY5YVDDdjxusuCcafdjfs2aUa/4tr_iMnNBnd27GxjQI28_JGJlfbOaajVJOxuPMT4ELpYCfPiFjdSbJyE0/gCwtj0rgDKSLWJnOPJ5TAJ935gCqeIsBhOhfcZX413GdilBZRRYEjCVKfOuWzHZ3GW/8yjyk5e_WMNv5F6xggl07w90DBwpx/Q/iWfncqMuSfoeFeqHQkDL9F5W19j1cGuAcyfIYMAXztHXpgTKh9vZcsLYC7LcgKr4FQj3JjEvtnDG2PjcMjGF/MnbCRCz22Ho410_vE9M1Hpq0wdk_i5DbZKNoSwlPgey9URkpuX146TcDdsx_VWDenCepY5HwMr9CPOY9hzUs/c5AWeUMXk/gvsI81Jkv5rHpEnNBUZXYzfqkwQfffhmrc/StLCtzRRlja8dpsEWdkzoKR9Kdxq1qAs5f0sdrGjVRLTT_s1Q2P59zhA/QmS4bubi64cYot3gSIgdNnkjA2GjCp1ETVa548_U9B6boTKDVmaKJlVIDvqL84RC3WI7Er/8opi2lZ48W83Ur47BRh38oOnI0agrCyZz8bp1w_gfVRlSO8PS0i/l_/qxq5xpLbhPkdxVoyZVsNAZchfnmkIHyIk5IK6EUDXdMR21y6OvKW50ZbooAtk9ymynBj4dAYMsd25RV7FE1I1vRTsiDw52/.E5WC0Ymo2zn.qelSbhzr-4laArYiWP.dwJB6qm_6rs0Rm5UXYaYtUNbh76_jJp_X1xQUCDSgbr2KOkDU0"Q/-4dV"Yk3QGg[(O86=Pf"e17K4\'r{)kicofHSXcMmP@>VF^`~4j4F*L/1]tD+Lw!WI!@]*OZm6C`M$u96}*O<U;_cZ84k.|nIqpAaeiroItOenDBL';
            };
            properties: {
              attempt_num: {
                description: 'Used with "deferred" events to indicate the attempt number out of 10. One "deferred" entry will exists under events array for each time a message was deferred with error message from the server. ';
                maximum: 10;
                minimum: 1;
                type: 'integer';
              };
              bounce_type: {
                description: 'Use to distinguish between types of bounces';
                enum: ['bounced', 'blocked', 'expired'];
                type: 'string';
              };
              event_name: {
                description: 'Name of event';
                enum: [
                  'bounced',
                  'opened',
                  'clicked',
                  'processed',
                  'dropped',
                  'delivered',
                  'deferred',
                  'spam_report',
                  'unsubscribe',
                  'group_unsubscribe',
                  'group_resubscribe',
                ];
                type: 'string';
              };
              http_user_agent: {
                description: 'Client recipient used to click or open message';
                type: 'string';
              };
              mx_server: {
                description: 'For example mx.gmail.com';
                type: 'string';
              };
              processed: {
                description: 'Date of when event occurred';
                type: 'string';
              };
              reason: {
                description: 'Explanation of what caused "bounced", "deferred", or "blocked". Usually contains error message from the server - e.g. message from gmail why mail was deferred';
                maxLength: 1024;
                type: 'string';
              };
              url: {
                description: 'Used with "clicked" event to indicate which url the user clicked.';
                pattern: '^((http[s]?|ftp):\\/)?\\/?([^:\\/\\s]+)((\\/\\w+)*\\/)([\\w\\-\\.]+[^#?\\s]+)(.*)?(#[\\w\\-]+)?$';
                type: 'string';
              };
            };
            required: ['event_name', 'processed', 'url', 'bounce_type', 'http_user_agent', 'mx_server'];
            title: 'Event';
            type: 'object';
          };
          type: 'array';
        };
        from_email: {
          pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b';
          type: 'string';
        };
        msg_id: {
          maxLength: 50;
          minLength: 5;
          pattern: '^[A-Za-z0-9]+';
          type: 'string';
        };
        originating_ip: {
          description: 'This is the IP of the user who sent the message.';
          format: 'ipv4';
          type: 'string';
        };
        outbound_ip: {
          description: 'IP used to send to the remote MTA. Used by UI to display IP in detailed view';
          format: 'ipv4';
          type: 'string';
        };
        outbound_ip_type: {
          description: 'Whether or not the outbound IP is dedicated vs shared';
          enum: ['dedicated', 'shared'];
          type: 'string';
        };
        status: {
          description: 'Quick summary of the status of a message';
          enum: ['processed', 'not delivered', 'delivered'];
          type: 'string';
        };
        subject: {
          maxLength: 255;
          minLength: 3;
          type: 'string';
        };
        teammate: {
          description: "Teammate's username";
          maxLength: 64;
          minLength: 0;
          pattern: '^$|^[A-Za-z0-9]+';
          type: 'string';
        };
        template_id: {
          format: 'uuid';
          type: 'string';
        };
        to_email: {
          pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b';
          type: 'string';
        };
        unique_args: {
          default: 'Null';
          description: 'JSON hash of arbitrary key-value pairs';
          type: 'string';
        };
      };
      required: [
        'from_email',
        'msg_id',
        'subject',
        'to_email',
        'status',
        'template_id',
        'asm_group_id',
        'teammate',
        'api_key_id',
        'events',
        'originating_ip',
        'categories',
        'unique_args',
        'outbound_ip',
        'outbound_ip_type',
      ];
      title: 'Message';
      type: 'object';
    };
    metadata: {
      properties: {
        count: {
          description: 'The number of items in the entire list, i.e., across all pages.';
          type: 'number';
        };
        next: {
          description: "The URL of the next page of results. If this field isn't present, you're at the end of the list.";
          format: 'uri';
          type: 'string';
        };
        prev: {
          description: "The URL of the previous page of results. If this field isn't present, you're at the start of the list.";
          format: 'uri';
          type: 'string';
        };
        self: {
          description: 'The URL of the current page of results.';
          format: 'uri';
          type: 'string';
        };
      };
      title: 'metadata';
      type: 'object';
    };
    metrics: {
      properties: {
        bounce_drops: {
          type: 'integer';
        };
        bounces: {
          type: 'integer';
        };
        clicks: {
          type: 'integer';
        };
        delivered: {
          type: 'integer';
        };
        invalid_emails: {
          type: 'integer';
        };
        opens: {
          type: 'integer';
        };
        requests: {
          type: 'integer';
        };
        spam_report_drops: {
          type: 'integer';
        };
        spam_reports: {
          type: 'integer';
        };
        unique_clicks: {
          type: 'integer';
        };
        unique_opens: {
          type: 'integer';
        };
        unsubscribes: {
          type: 'integer';
        };
      };
      required: [
        'bounce_drops',
        'bounces',
        'clicks',
        'delivered',
        'invalid_emails',
        'opens',
        'requests',
        'spam_report_drops',
        'spam_reports',
        'unique_clicks',
        'unique_opens',
        'unsubscribes',
      ];
      title: 'metrics';
      type: 'object';
    };
    monitor: {
      example: {
        email: 'example@example.com';
        frequency: 50000;
      };
      properties: {
        email: {
          description: 'The email address to which Sendgrid should send emails for monitoring.';
          format: 'email';
          type: 'string';
        };
        frequency: {
          description: 'The frequency at which to forward monitoring emails. An email will be sent when your subuser sends this many (e.g., 1,000) emails.';
          type: 'number';
        };
      };
      required: ['email', 'frequency'];
      title: 'Create monitor settings request';
      type: 'object';
    };
    'parse-setting': {
      example: {
        hostname: 'myhostname.com';
        send_raw: true;
        spam_check: false;
        url: 'http://email.myhostname.com';
      };
      properties: {
        hostname: {
          description: 'A specific and unique domain or subdomain that you have created to use exclusively to parse your incoming email. For example, `parse.yourdomain.com`.';
          type: 'string';
        };
        send_raw: {
          description: 'Indicates if you would like SendGrid to post the original MIME-type content of your parsed email. When this parameter is set to `true`, SendGrid will send a JSON payload of the content of your email.';
          type: 'boolean';
        };
        spam_check: {
          description: 'Indicates if you would like SendGrid to check the content parsed from your emails for spam before POSTing them to your domain.';
          type: 'boolean';
        };
        url: {
          description: 'The public URL where you would like SendGrid to POST the data parsed from your email. Any emails sent with the given hostname provided (whose MX records have been updated to point to SendGrid) will be parsed and POSTed to this URL.';
          type: 'string';
        };
      };
      title: 'Parse Setting';
      type: 'object';
    };
    partner_settings_new_relic: {
      properties: {
        enable_subuser_statistics: {
          description: 'Indicates if your subuser statistics will be sent to your New Relic Dashboard.';
          type: 'boolean';
        };
        enabled: {
          description: 'Indicates if this setting is enabled. ';
          type: 'boolean';
        };
        license_key: {
          description: 'The license key provided with your New Relic account.';
          type: 'string';
        };
      };
      required: ['enabled', 'license_key'];
      title: 'Partner Settings: New Relic';
      type: 'object';
    };
    reply_to_email_object: {
      example: {
        email: 'jane_doe@example.com';
        name: 'Jane Doe';
      };
      properties: {
        email: {
          description: 'The email address where any replies or bounces will be returned.';
          format: 'email';
          type: 'string';
        };
        name: {
          description: 'A name or title associated with the `reply_to` email address.';
          type: 'string';
        };
      };
      required: ['email'];
      title: 'Reply_to Email Object';
      type: 'object';
    };
    reserved_field_definitions_response: {
      example: [
        {
          field_type: 'Text';
          id: '_rf20_T';
          name: 'automation_id';
          read_only: true;
        },
      ];
      items: {
        properties: {
          field_type: {
            enum: ['Text', 'Number', 'Date'];
            type: 'string';
          };
          name: {
            maxLength: 100;
            minLength: 1;
            type: 'string';
          };
          read_only: {
            default: false;
            description: 'When `true` this means API consumers are unable to set the value of this field on contacts.';
            type: 'boolean';
          };
        };
        type: 'object';
      };
      required: ['name', 'field_type'];
      title: 'reserved_field_definitions_response';
      type: 'array';
    };
    reverse_dns: {
      example: {
        a_record: {
          data: '192.168.1.1';
          host: 'o1.email.example.com';
          type: 'a';
          valid: true;
        };
        domain: 'example.com';
        id: 1;
        ip: '192.168.1.1';
        legacy: false;
        rdns: 'o1.email.example.com';
        subdomain: 'email';
        users: [
          {
            user_id: 7;
            username: 'john@example.com';
          },
          {
            user_id: 8;
            username: 'jane@example.com';
          },
        ];
        valid: true;
      };
      properties: {
        a_record: {
          properties: {
            data: {
              description: 'The IP address being set up with Reverse DNS.';
              type: 'string';
            };
            host: {
              description: 'This is the web address that will be mapped to the IP address.';
              type: 'string';
            };
            type: {
              description: 'The type of DNS record.';
              type: 'string';
            };
            valid: {
              description: 'Indicates if the a_record is valid.';
              type: 'boolean';
            };
          };
          required: ['valid', 'type', 'host', 'data'];
          type: 'object';
        };
        domain: {
          description: 'The root, or sending, domain.';
          type: 'string';
        };
        id: {
          description: 'The ID of the Reverse DNS.';
          type: 'integer';
        };
        ip: {
          description: 'The IP address that this Reverse DNS was created for.';
          type: 'string';
        };
        last_validation_attempt_at: {
          description: 'A Unix epoch timestamp representing the last time of a validation attempt.';
          type: 'integer';
        };
        legacy: {
          description: "Indicates if this Reverse DNS was created using the legacy whitelabel tool. If it is a legacy whitelabel, it will still function, but you'll need to create a new Reverse DNS if you need to update it.";
          type: 'boolean';
        };
        rdns: {
          description: 'The reverse DNS record for the IP address. This points to the Reverse DNS subdomain.';
          type: 'string';
        };
        subdomain: {
          description: 'The subdomain created for this reverse DNS. This is where the rDNS record points.';
          type: 'string';
        };
        users: {
          description: 'The users who are able to send mail from the IP address.';
          items: {
            properties: {
              user_id: {
                description: 'The ID of a user who can send mail from the IP address.';
                type: 'integer';
              };
              username: {
                description: 'The username of a user who can send mail from the IP address.';
                type: 'string';
              };
            };
            required: ['username', 'user_id'];
            type: 'object';
          };
          type: 'array';
        };
        valid: {
          description: 'Indicates if this is a valid Reverse DNS.';
          type: 'boolean';
        };
      };
      required: ['id', 'ip', 'rdns', 'users', 'domain', 'valid', 'legacy', 'a_record'];
      title: 'Reverse DNS';
      type: 'object';
    };
    segment_query_json: {
      properties: {
        contacts: {
          properties: {
            l: {
              properties: {
                l: {
                  properties: {
                    l: {
                      properties: {
                        t: {
                          type: 'string';
                        };
                        v: {
                          type: 'string';
                        };
                      };
                      type: 'object';
                    };
                    op: {
                      type: 'string';
                    };
                    r: {
                      properties: {
                        t: {
                          type: 'string';
                        };
                        v: {
                          type: 'string';
                        };
                      };
                      type: 'object';
                    };
                  };
                  type: 'object';
                };
                op: {
                  type: 'string';
                };
                r: {
                  properties: {
                    l: {
                      properties: {
                        args: {
                          items: {
                            properties: {
                              t: {
                                type: 'string';
                              };
                              v: {
                                type: 'string';
                              };
                            };
                            type: 'object';
                          };
                          type: 'array';
                        };
                        t: {
                          type: 'string';
                        };
                        v: {
                          type: 'string';
                        };
                      };
                      type: 'object';
                    };
                    op: {
                      type: 'string';
                    };
                    r: {
                      properties: {
                        t: {
                          type: 'string';
                        };
                        v: {
                          type: 'string';
                        };
                      };
                      type: 'object';
                    };
                  };
                  type: 'object';
                };
              };
              type: 'object';
            };
            op: {
              type: 'string';
            };
            r: {
              properties: {
                l: {
                  properties: {
                    t: {
                      type: 'string';
                    };
                    v: {
                      type: 'string';
                    };
                  };
                  type: 'object';
                };
                op: {
                  type: 'string';
                };
                r: {
                  properties: {
                    t: {
                      type: 'string';
                    };
                    v: {
                      items: {
                        type: 'string';
                      };
                      type: 'array';
                    };
                  };
                  type: 'object';
                };
              };
              type: 'object';
            };
          };
          type: 'object';
        };
      };
      title: 'segment_query_json';
      type: 'object';
    };
    segment_response: {
      properties: {
        contacts_count: {
          description: 'Total number of contacts present in the segment';
          type: 'integer';
        };
        contacts_sample: {
          description: 'A subset of all contacts that are in this segment';
          items: {
            $ref: '#/components/schemas/contact_response';
          };
          type: 'array';
        };
        created_at: {
          description: 'ISO8601 timestamp of when the object was created';
          type: 'string';
        };
        id: {
          description: 'ID assigned to the segment when created.';
          format: 'uuid';
          maxLength: 36;
          minLength: 36;
          type: 'string';
        };
        name: {
          description: 'Name of the segment.';
          maxLength: 100;
          minLength: 1;
          type: 'string';
        };
        next_sample_update: {
          description: 'ISO8601 timestamp of when the samples will be next updated';
          type: 'string';
        };
        parent_list_ids: {
          description: 'The array of list ids to filter contacts on when building this segment. It allows only one such list id for now. We will support more in future';
          items: {
            type: 'string';
          };
          type: 'array';
          uniqueItems: true;
        };
        query_dsl: {
          description: 'SQL query which will filter contacts based on the conditions provided';
          type: 'string';
        };
        query_version: {
          description: "If not set, segment contains a Query for use with Segment v1 APIs. If set to '2', segment contains a SQL query for use in v2.";
          type: 'string';
        };
        sample_updated_at: {
          description: 'ISO8601 timestamp of when the samples were last updated';
          type: 'string';
        };
        status: {
          $ref: '#/components/schemas/segment_status_response';
        };
        updated_at: {
          description: 'ISO8601 timestamp of when the object was last updated';
          type: 'string';
        };
      };
      required: [
        'id',
        'name',
        'query_dsl',
        'contacts_count',
        'contacts_sample',
        'created_at',
        'updated_at',
        'sample_updated_at',
        'next_sample_update',
        'parent_list_ids',
        'query_version',
        'status',
      ];
      title: 'segment_response';
      type: 'object';
    };
    segment_status_response: {
      description: "Segment status indicates whether the segment's contacts will be updated periodically";
      properties: {
        error_message: {
          description: 'Describes any errors that were encountered during query validation';
          type: 'string';
        };
        query_validation: {
          description: 'Status of query validation. PENDING, VALID, or INVALID';
          type: 'string';
        };
      };
      required: ['query_validation'];
      title: 'segment_status_response';
      type: 'object';
    };
    segment_summary: {
      properties: {
        contacts_count: {
          type: 'integer';
        };
        created_at: {
          description: 'ISO8601 of created timestamp\n';
          format: 'date-time';
          type: 'string';
        };
        id: {
          format: 'uuid';
          maxLength: 36;
          minLength: 36;
          type: 'string';
        };
        name: {
          maxLength: 100;
          minLength: 1;
          type: 'string';
        };
        next_sample_update: {
          description: 'ISO8601 string that is equal to `sample_updated_at` plus an internally calculated offset that depends on how often contacts enter or exit segments as the scheduled pipeline updates the samples.';
          type: 'string';
        };
        parent_list_id: {
          description: 'The id of the list if this segment is a child of a list.  This implies the query `AND CONTAINS(list_ids, ${parent_list_id})`';
          format: 'uuid';
          maxLength: 36;
          minLength: 36;
          type: 'string';
        };
        sample_updated_at: {
          description: 'ISO8601 timestamp the sample was last updated';
          format: 'date-time';
          type: 'string';
        };
        updated_at: {
          description: 'ISO8601 timestamp the object was last updated';
          format: 'date-time';
          type: 'string';
        };
      };
      required: ['id', 'contacts_count', 'created_at', 'sample_updated_at', 'updated_at'];
      title: 'segment_summary';
      type: 'object';
    };
    segment_summary_v2: {
      description: '';
      properties: {
        results: {
          items: {
            $ref: '#/components/schemas/segment_summary';
          };
          type: 'array';
        };
      };
      title: 'segment_summary';
      type: 'object';
    };
    segment_update: {
      properties: {
        name: {
          description: 'Name of the segment.';
          maxLength: 100;
          minLength: 1;
          type: 'string';
        };
        query_dsl: {
          description: 'SQL query which will filter contacts based on the conditions provided';
          type: 'string';
        };
      };
      title: 'segment_update';
      type: 'object';
    };
    segment_write: {
      properties: {
        name: {
          maxLength: 100;
          minLength: 1;
          type: 'string';
        };
        query_dsl: {
          description: 'Use this field for adding your query string.';
          type: 'string';
        };
      };
      required: ['name', 'query_dsl'];
      title: 'segment_write';
      type: 'object';
    };
    segment_write_v2: {
      properties: {
        name: {
          description: 'Name of the segment.';
          maxLength: 100;
          minLength: 1;
          type: 'string';
        };
        parent_list_ids: {
          description: 'The array of list ids to filter contacts on when building this segment. It allows only one such list id for now. We will support more in future';
          items: {
            type: 'string';
          };
          type: 'array';
          uniqueItems: true;
        };
        query_dsl: {
          description: 'SQL query which will filter contacts based on the conditions provided';
          type: 'string';
        };
      };
      required: ['name', 'query_dsl'];
      title: 'segment_write';
      type: 'object';
    };
    selfmetadata: {
      properties: {
        self: {
          description: 'A link to this object.';
          type: 'string';
        };
      };
      title: 'selfMetadata';
      type: 'object';
    };
    'sender-id-request': {
      example: {
        address: '123 Elm St.';
        address_2: 'Apt. 456';
        city: 'Denver';
        country: 'United States';
        from: {
          email: 'from@example.com';
          name: 'Example INC';
        };
        nickname: 'My Sender ID';
        reply_to: {
          email: 'replyto@example.com';
          name: 'Example INC';
        };
        state: 'Colorado';
        zip: '80202';
      };
      properties: {
        address: {
          description: 'The physical address of the sender identity.';
          type: 'string';
        };
        address_2: {
          description: 'Additional sender identity address information.';
          type: 'string';
        };
        city: {
          description: 'The city of the sender identity.';
          type: 'string';
        };
        country: {
          description: 'The country of the sender identity.';
          type: 'string';
        };
        from: {
          properties: {
            email: {
              description: 'The email address from which your recipient will receive emails.';
              type: 'string';
            };
            name: {
              description: 'The name appended to the from email field. Typically your name or company name.';
              type: 'string';
            };
          };
          type: 'object';
        };
        nickname: {
          description: 'A nickname for the sender identity. Not used for sending.';
          type: 'string';
        };
        reply_to: {
          properties: {
            email: {
              description: 'The email address to which your recipient will reply.';
              type: 'string';
            };
            name: {
              description: 'The name appended to the reply to email field. Typically your name or company name.';
              type: 'string';
            };
          };
          type: 'object';
        };
        state: {
          description: 'The state of the sender identity.';
          type: 'string';
        };
        zip: {
          description: 'The zipcode of the sender identity.';
          type: 'string';
        };
      };
      title: 'Sender ID Request';
      type: 'object';
    };
    senderID: {
      allOf: [
        {
          $ref: '#/components/schemas/sender-id-request';
        },
        {
          properties: {
            created_at: {
              description: 'The time the sender identity was created.';
              type: 'integer';
            };
            id: {
              description: 'The unique identifier of the sender identity.';
              type: 'integer';
            };
            locked: {
              description: 'True when the sender id is associated to a campaign in the Draft, Scheduled, or In Progress status. You cannot update or delete a locked sender identity.';
              type: 'boolean';
            };
            updated_at: {
              description: 'The time the sender identity was last updated.';
              type: 'integer';
            };
            verified: {
              description: 'If the sender identity is verified or not. Only verified sender identities can be used to send email.';
              type: 'boolean';
            };
          };
          type: 'object';
        },
        {
          required: ['nickname', 'address', 'city', 'country'];
          type: 'object';
        },
      ];
      example: {
        address: '123 Elm St.';
        address_2: 'Apt. 456';
        city: 'Denver';
        country: 'United States';
        created_at: 1449872165;
        from: {
          email: 'from@example.com';
          name: 'Example INC';
        };
        id: 1;
        locked: false;
        nickname: 'My Sender ID';
        reply_to: {
          email: 'replyto@example.com';
          name: 'Example INC';
        };
        state: 'Colorado';
        updated_at: 1449872165;
        verified: true;
        zip: '80202';
      };
      title: 'Sender ID';
    };
    'senders-id-request-body': {
      properties: {
        address: {
          description: 'The physical address of the sender identity.';
          type: 'string';
        };
        address_2: {
          description: 'Additional sender identity address information.';
          type: 'string';
        };
        city: {
          description: 'The city of the sender identity.';
          type: 'string';
        };
        country: {
          description: 'The country of the sender identity.';
          type: 'string';
        };
        from: {
          properties: {
            email: {
              description: 'This is where the email will appear to originate from for your recipient';
              type: 'string';
            };
            name: {
              description: 'This is the name appended to the from email field. IE - Your name or company name.';
              type: 'string';
            };
          };
          required: ['email', 'name'];
          type: 'object';
        };
        nickname: {
          description: 'A nickname for the sender identity. Not used for sending.';
          type: 'string';
        };
        reply_to: {
          properties: {
            email: {
              description: 'This is the email that your recipient will reply to.';
              type: 'string';
            };
            name: {
              description: 'This is the name appended to the reply to email field. IE - Your name or company name.';
              type: 'string';
            };
          };
          required: ['email'];
          type: 'object';
        };
        state: {
          description: 'The state of the sender identity.';
          type: 'string';
        };
        zip: {
          description: 'The zipcode of the sender identity.';
          type: 'string';
        };
      };
      required: ['nickname', 'from', 'address', 'city', 'country'];
      title: 'Senders ID Request Body';
      type: 'object';
    };
    'single-contact-request': {
      properties: {
        contact: {
          properties: {
            address_line_1: {
              type: 'string';
            };
            address_line_2: {
              type: 'string';
            };
            alternate_emails: {
              type: 'string';
            };
            city: {
              type: 'string';
            };
            country: {
              type: 'string';
            };
            custom_fields: {
              properties: {
                custom_field_name1: {
                  type: 'string';
                };
                custom_field_name2: {
                  type: 'string';
                };
              };
              type: 'object';
            };
            first_name: {
              type: 'string';
            };
            last_name: {
              type: 'string';
            };
            postal_code: {
              type: 'string';
            };
            primary_email: {
              type: 'string';
            };
            state_province_region: {
              type: 'string';
            };
          };
          type: 'object';
        };
        list_ids: {
          description: "The contact's list IDs.";
          items: {
            format: 'uuid';
            type: 'string';
          };
          maxItems: 100;
          minItems: 0;
          type: 'array';
        };
      };
      title: 'single contact request';
      type: 'object';
    };
    singlesend_request: {
      properties: {
        categories: {
          description: 'The categories to associate with this Single Send.';
          items: {
            type: 'string';
          };
          maxItems: 10;
          type: 'array';
          uniqueItems: true;
        };
        email_config: {
          properties: {
            custom_unsubscribe_url: {
              description: 'The URL allowing recipients to unsubscribe — you must provide this or the `suppression_group_id`.';
              format: 'uri';
              nullable: true;
              type: 'string';
            };
            design_id: {
              description: 'A `design_id` can be used in place of `html_content`, `plain_content`, and/or `subject`. You can retrieve a design\'s ID from the ["List Designs" endpoint](https://sendgrid.api-docs.io/v3.0/designs-api/list-designs) or by pulling it from the design\'s detail page URL in the Marketing Campaigns App.';
              type: 'string';
            };
            editor: {
              default: 'code';
              description: 'The editor — `"design"` or `"code"` — used to modify the Single Send\'s design in the Marketing Campaigns App.';
              enum: ['code', 'design'];
              type: 'string';
            };
            generate_plain_content: {
              default: true;
              description: 'If set to `true`, `plain_content` is always generated from `html_content`. If set to false, `plain_content` is not altered.';
              type: 'boolean';
            };
            html_content: {
              description: 'The HTML content of the Single Send. Do not include this field when using a `design_id`.';
              type: 'string';
            };
            ip_pool: {
              description: 'The name of the IP Pool from which the Single Send emails are sent.';
              nullable: true;
              type: 'string';
            };
            plain_content: {
              description: 'The plain text content of the Single Send. Do not include this field when using a `design_id`.';
              type: 'string';
            };
            sender_id: {
              description: 'The ID of the verified Sender. You can retrieve a verified Sender\'s ID from the ["Get Verified Senders" endpoint](https://sendgrid.api-docs.io/v3.0/sender-verification/get-verified-senders) or by pulling it from the Sender\'s detail page URL in the SendGrid App.';
              nullable: true;
              type: 'integer';
            };
            subject: {
              description: 'The subject line of the Single Send. Do not include this field when using a `design_id`.';
              type: 'string';
            };
            suppression_group_id: {
              description: 'The ID of the Suppression Group to allow recipients to unsubscribe — you must provide this or the `custom_unsubscribe_url`.';
              nullable: true;
              type: 'integer';
            };
          };
          type: 'object';
        };
        name: {
          description: 'The name of the Single Send.';
          maxLength: 100;
          minLength: 1;
          type: 'string';
        };
        send_at: {
          description: 'The ISO 8601 time at which to send the Single Send — this must be set for a future time.';
          format: 'date-time';
          type: 'string';
        };
        send_to: {
          properties: {
            all: {
              default: false;
              description: 'Set to `true` to send to All Contacts. If set to `false`, at least one `list_ids` or `segment_ids` value must be provided before the Single Send is scheduled to be sent to recipients.';
              type: 'boolean';
            };
            list_ids: {
              description: 'The recipient List IDs that will receive the Single Send.';
              items: {
                format: 'uuid';
                type: 'string';
              };
              maxItems: 10;
              type: 'array';
            };
            segment_ids: {
              description: 'The recipient Segment IDs that will receive the Single Send.';
              items: {
                format: 'uuid';
                type: 'string';
              };
              maxItems: 10;
              type: 'array';
            };
          };
          type: 'object';
        };
      };
      required: ['name'];
      title: 'singlesend_request';
      type: 'object';
    };
    singlesend_response: {
      allOf: [
        {
          $ref: '#/components/schemas/singlesend_request';
        },
        {
          properties: {
            created_at: {
              description: 'the ISO 8601 time at which the Single Send was created';
              format: 'date-time';
              type: 'string';
            };
            id: {
              format: 'uuid';
              type: 'string';
            };
            status: {
              description: 'current status of the Single Send';
              enum: ['draft', 'scheduled', 'triggered'];
              type: 'string';
            };
            updated_at: {
              description: 'the ISO 8601 time at which the Single Send was last updated';
              format: 'date-time';
              type: 'string';
            };
            warnings: {
              items: {
                properties: {
                  field: {
                    type: 'string';
                  };
                  message: {
                    type: 'string';
                  };
                  warning_id: {
                    type: 'string';
                  };
                };
                type: 'object';
              };
              type: 'array';
            };
          };
          required: ['id', 'status', 'created_at'];
          type: 'object';
        },
      ];
      example: {
        categories: ['unique opens'];
        created_at: '2020-05-18T17:28:27.272Z';
        email_config: {
          custom_unsubscribe_url: null;
          editor: 'code';
          generate_plain_content: true;
          html_content: '';
          ip_pool: null;
          plain_content: '';
          sender_id: null;
          subject: '';
          suppression_group_id: null;
        };
        id: '27c21bbf-a12c-440b-b8bf-c526975328ca';
        name: 'Example API Created Single Send';
        send_at: '2020-06-16T00:19:55.106Z';
        send_to: {
          list_ids: ['f2fe66a1-43f3-4e3a-87b1-c6a600d805f0'];
        };
        status: 'scheduled';
      };
      title: 'singlesend_response';
    };
    singlesend_response_short: {
      properties: {
        abtest: {
          $ref: '#/components/schemas/abtest_summary';
        };
        categories: {
          description: 'categories to associate with this Single Send';
          items: {
            type: 'string';
          };
          maxItems: 10;
          type: 'array';
          uniqueItems: true;
        };
        created_at: {
          description: 'the ISO 8601 time at which the Single Send was created';
          format: 'date-time';
          type: 'string';
        };
        id: {
          format: 'uuid';
          type: 'string';
        };
        is_abtest: {
          description: "true if the Single Send's AB Test functionality has been toggled on";
          type: 'boolean';
        };
        name: {
          description: 'name of the Single Send';
          maxLength: 100;
          minLength: 1;
          type: 'string';
        };
        send_at: {
          description: 'the ISO 8601 time at which to send the Single Send; must be in future';
          format: 'date-time';
          type: 'string';
        };
        status: {
          description: 'current status of the Single Send';
          enum: ['draft', 'scheduled', 'triggered'];
          type: 'string';
        };
        updated_at: {
          description: 'the ISO 8601 time at which the Single Send was last updated';
          format: 'date-time';
          type: 'string';
        };
      };
      required: ['id', 'name', 'abtest', 'status', 'categories', 'is_abtest', 'updated_at', 'created_at'];
      title: 'singlesend_response_short';
      type: 'object';
    };
    singlesend_schedule: {
      properties: {
        send_at: {
          description: 'This is the ISO 8601 time at which to send the Single Send; must be in future, or the string "now"';
          format: 'date-time';
          type: 'string';
        };
        status: {
          enum: ['draft', 'scheduled', 'triggered'];
          type: 'string';
        };
      };
      required: ['send_at'];
      title: 'singlesend-schedule';
      type: 'object';
    };
    singlesend_search: {
      properties: {
        categories: {
          description: 'categories to associate with this Single Send, match any single send that has at least one of the categories';
          items: {
            type: 'string';
          };
          type: 'array';
          uniqueItems: true;
        };
        name: {
          description: 'leading and trailing wildcard search on name of the Single Send';
          maxLength: 100;
          minLength: 1;
          type: 'string';
        };
        status: {
          description: 'current status of the Single Send';
          items: {
            enum: ['draft', 'scheduled', 'triggered'];
            type: 'string';
          };
          type: 'array';
          uniqueItems: true;
        };
      };
      title: 'singlesend_search';
      type: 'object';
    };
    singlesend_warning: {
      properties: {
        warnings: {
          items: {
            properties: {
              field: {
                type: 'string';
              };
              message: {
                type: 'string';
              };
              warning_id: {
                type: 'string';
              };
            };
            type: 'object';
          };
          type: 'array';
        };
      };
      title: 'singlesend_warning';
      type: 'object';
    };
    'singlesends-link-stats-response': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/link-tracking-metadata';
        };
        results: {
          description: "This is the index of the link's location in the email contents.";
          items: {
            properties: {
              ab_phase: {
                description: 'This is the A/B phase of the Single Send stat returned. If the `ab_phase` query parameter was not provided, it will return `"all"`.';
                enum: ['send', 'test', 'all'];
                type: 'string';
              };
              ab_variation: {
                description: 'This is the A/B variation of the Single Send stat returned. It is set to `"all"` if the `ab_variation` query parameter was not set in the request and `group_by` doesn\'t contain `ab_variation`.';
                format: 'uuid';
                type: 'string';
              };
              clicks: {
                description: 'the number of clicks on this particular link';
                minimum: 1;
                type: 'integer';
              };
              url: {
                description: 'This is the URL of the link clicked. If `{{custom_fields}}` are part of the URL, they will be included.';
                format: 'uri';
                type: 'string';
              };
              url_location: {
                description: 'This is the location of the link clicked in each Single Send A/B variation, or in the Single Send itself if there are no variations. Links are numbered from the top down; the topmost link is index `0`.';
                minimum: 0;
                type: 'integer';
              };
            };
            required: ['url', 'ab_variation', 'ab_phase', 'clicks'];
            type: 'object';
          };
          type: 'array';
        };
        total_clicks: {
          type: 'integer';
        };
      };
      required: ['results', '_metadata'];
      title: 'singlesends-link-stats-response';
      type: 'object';
    };
    'singlesends-response': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/metadata';
        };
        results: {
          items: {
            properties: {
              ab_phase: {
                default: 'all';
                description: 'This is the A/B phase of the Single Send stat returned. If the `group_by` parameter doesn\'t include `ab_phase` in the request, then the value is "all".';
                enum: ['send', 'test', 'all'];
                type: 'string';
              };
              ab_variation: {
                default: 'all';
                description: 'This is the A/B variation of the Single Send stat returned. If the `group_by` parameter doesn\'t include `ab_variation` in the request, then the value is "all".';
                format: 'uuid';
                type: 'string';
              };
              aggregation: {
                default: 'total';
                description: 'This describes the time unit to which the stat is rolled up. It is based on the `aggregated_by` parameter included in the request. It can be "total" or the date (in YYYY-MM-DD format) the stats are for.';
                type: 'string';
              };
              id: {
                description: 'This is the ID of the Single Dend you require stats for.';
                format: 'uuid';
                type: 'string';
              };
              stats: {
                $ref: '#/components/schemas/metrics';
              };
            };
            required: ['id', 'ab_variation', 'ab_phase'];
            type: 'object';
          };
          type: 'array';
        };
      };
      required: ['results', '_metadata'];
      title: 'singlesends-response';
      type: 'object';
    };
    'spam-reports-response': {
      example: [
        {
          created: 1443651141;
          email: 'user1@example.com';
          ip: '10.63.202.100';
        },
        {
          created: 1443651154;
          email: 'user2@example.com';
          ip: '10.63.202.100';
        },
      ];
      items: {
        properties: {
          created: {
            description: 'A Unix timestamp that indicates when the recipient marked your message as spam.';
            type: 'integer';
          };
          email: {
            description: 'The email address of the recipient that marked your message as spam.';
            format: 'email';
            type: 'string';
          };
          ip: {
            description: 'The IP address that the message was sent from.';
            type: 'string';
          };
        };
        required: ['created', 'email', 'ip'];
        type: 'object';
      };
      title: 'Spam Reports Response';
      type: 'array';
    };
    'sso-certificate-body': {
      example: {
        id: 66138975;
        intergration_id: 'b0b98502-9408-4b24-9e3d-31ed7cb15312';
        not_after: 1621289880;
        not_before: 1621289880;
        public_certificate: '<your x509 certificate>';
      };
      properties: {
        id: {
          description: 'A unique ID assigned to the certificate by SendGrid.';
          type: 'number';
        };
        intergration_id: {
          description: 'An ID that matches a certificate to a specific IdP integration.';
          type: 'string';
        };
        not_after: {
          description: 'A unix timestamp (e.g., 1603915954) that indicates the time after which the certificate is no longer valid.';
          type: 'number';
        };
        not_before: {
          description: 'A unix timestamp (e.g., 1603915954) that indicates the time before which the certificate is not valid.';
          type: 'number';
        };
        public_certificate: {
          description: 'This certificate is used by Twilio SendGrid to verify that SAML requests are coming from Okta. This is called the X509 certificate in the Twilio SendGrid UI.';
          type: 'string';
        };
      };
      title: 'Single Sign-On Certificate Body';
      type: 'object';
    };
    'sso-error-response': {
      items: {
        properties: {
          error_id: {
            type: 'string';
          };
          field: {
            nullable: true;
            type: 'string';
          };
          message: {
            type: 'string';
          };
        };
        type: 'object';
      };
      title: 'SSO Error Response';
      type: 'array';
    };
    'sso-integration': {
      allOf: [
        {
          $ref: '#/components/schemas/create-integration-request';
        },
        {
          properties: {
            audience_url: {
              description: 'The URL where your IdP should POST its SAML response. This is the Twilio SendGrid URL that is responsible for receiving and parsing a SAML assertion. This is the same URL as the Single Sign-On URL when using SendGrid.';
              type: 'string';
            };
            id: {
              description: 'A unique ID assigned to the configuration by SendGrid.';
              type: 'string';
            };
            last_updated: {
              description: 'A timestamp representing the last time the configuration was modified.';
              type: 'number';
            };
            single_signon_url: {
              description: 'The URL where your IdP should POST its SAML response. This is the Twilio SendGrid URL that is responsible for receiving and parsing a SAML assertion. This is the same URL as the Audience URL when using SendGrid.';
              type: 'string';
            };
          };
          required: ['last_updated'];
          type: 'object';
        },
      ];
      title: 'Single Sign-On Integration';
    };
    'sso-teammate-common-fields': {
      properties: {
        email: {
          description: 'The Teammate’s email address. This email address will also function as the Teammate’s username and must match the address assigned to the user in your IdP. This address cannot be changed after the Teammate is created.';
          format: 'email';
          type: 'string';
        };
        first_name: {
          description: 'The Teammate’s first name.';
          type: 'string';
        };
        is_admin: {
          description: 'Indicates if the Teammate has admin permissions.';
          type: 'boolean';
        };
        is_read_only: {
          description: 'Indicates if the Teammate has read_only permissions.';
          type: 'boolean';
        };
        last_name: {
          description: 'The Teammate’s last name.';
          type: 'string';
        };
      };
      required: ['first_name', 'last_name', 'email'];
      title: 'Single Sing-On Teammate Common Fields';
      type: 'object';
    };
    'sso-teammate-request': {
      allOf: [
        {
          $ref: '#/components/schemas/sso-teammate-common-fields';
        },
        {
          properties: {
            scopes: {
              description: 'The permission scopes assigned to the Teammate.';
              items: {
                type: 'string';
              };
              type: 'array';
            };
          };
          required: ['scopes'];
          type: 'object';
        },
      ];
      title: 'Single Sign-On Teammate Request';
    };
    'sso-teammate-response': {
      allOf: [
        {
          $ref: '#/components/schemas/sso-teammate-common-fields';
        },
        {
          properties: {
            is_sso: {
              description: 'Indicates if the Teammate authenticates with SendGrid using SSO or with a username and password.';
              type: 'boolean';
            };
            username: {
              description: "This should be set to the Teammate's email address.";
              type: 'string';
            };
          };
          type: 'object';
        },
      ];
      title: 'Single Sign-On Teammate Response';
    };
    'sso-teammates-patch-response': {
      allOf: [
        {
          $ref: '#/components/schemas/sso-teammate-response';
        },
        {
          properties: {
            address: {
              description: 'The Teammate’s street address.';
              type: 'string';
            };
            address2: {
              description: 'The Teammate’s apartment number, suite number, or other secondary address information that is not part of the physical street address.';
              type: 'string';
            };
            city: {
              description: "The Teammate's city.";
              type: 'string';
            };
            company: {
              description: 'The Teammate’s company name.';
              type: 'string';
            };
            country: {
              description: 'The Teammate’s country of residence.';
              type: 'string';
            };
            email: {
              format: 'email';
              type: 'string';
            };
            phone: {
              description: 'The Teammate’s stored phone number.';
              type: 'string';
            };
            scopes: {
              description: 'The permission scopes assigned to the Teammate.';
              items: {
                type: 'string';
              };
              type: 'array';
            };
            state: {
              description: 'The Teammate’s state or province.';
              type: 'string';
            };
            user_type: {
              description: 'A Teammate can be an “admin,” “owner,” or “teammate.” Each role is associated with the scope of the Teammate’s permissions.';
              enum: ['admin', 'owner', 'teammate'];
              type: 'string';
            };
            website: {
              description: 'A website associated with the Teammate';
              type: 'string';
            };
            zip: {
              description: 'The Teammate’s zip code.';
              type: 'string';
            };
          };
          type: 'object';
        },
      ];
      title: 'Single Sign-On Teammates PATCH Response';
    };
    'stats-advanced-global-stats': {
      allOf: [
        {
          $ref: '#/components/schemas/advanced_stats_clicks_opens';
        },
        {
          properties: {
            blocks: {
              description: 'The number of emails that were not allowed to be delivered by ISPs.';
              type: 'integer';
            };
            bounce_drops: {
              description: 'The number of emails that were dropped because of a bounce.';
              type: 'integer';
            };
            bounces: {
              description: 'The number of emails that bounced instead of being delivered.';
              type: 'integer';
            };
            deferred: {
              description: 'The number of emails that temporarily could not be delivered. ';
              type: 'integer';
            };
            delivered: {
              description: 'The number of emails SendGrid was able to confirm were actually delivered to a recipient.';
              type: 'integer';
            };
            invalid_emails: {
              description: 'The number of recipients who had malformed email addresses or whose mail provider reported the address as invalid.';
              type: 'integer';
            };
            processed: {
              description: 'Requests from your website, application, or mail client via SMTP Relay or the API that SendGrid processed.';
              type: 'integer';
            };
            requests: {
              description: 'The number of emails that were requested to be delivered.';
              type: 'integer';
            };
            spam_report_drops: {
              description: 'The number of emails that were dropped due to a recipient previously marking your emails as spam.';
              type: 'integer';
            };
            spam_reports: {
              description: 'The number of recipients who marked your email as spam.';
              type: 'integer';
            };
            unsubscribe_drops: {
              description: 'The number of emails dropped due to a recipient unsubscribing from your emails.';
              type: 'integer';
            };
            unsubscribes: {
              description: 'The number of recipients who unsubscribed from your emails.';
              type: 'integer';
            };
          };
          type: 'object';
        },
      ];
      title: 'Stats: Advanced Global Stats';
    };
    'stats-advanced-stats-base-schema': {
      items: {
        properties: {
          date: {
            description: 'The date the stats were gathered.';
            type: 'string';
          };
          stats: {
            description: 'The individual email activity stats.';
            items: {
              properties: {
                metrics: {
                  type: 'object';
                };
              };
              type: 'object';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      title: 'Stats: Advanced Stats Base Schema';
      type: 'array';
    };
    subscription_tracking_settings: {
      properties: {
        enabled: {
          description: 'Indicates if subscription tracking is enabled.';
          type: 'boolean';
        };
        html_content: {
          description: 'The information and HTML for your unsubscribe link. ';
          type: 'string';
        };
        landing: {
          description: 'The HTML that will be displayed on the page that your customers will see after clicking unsubscribe, hosted on SendGrid’s server.';
          type: 'string';
        };
        plain_content: {
          description: 'The information in plain text for your unsubscribe link. You should have the “<% %>” tag in your content, otherwise the user will have no URL for unsubscribing.';
          type: 'string';
        };
        replace: {
          description: 'Your custom defined replacement tag for your templates. Use this tag to place your unsubscribe content anywhere in your emailtemplate.';
          type: 'string';
        };
        url: {
          description: 'The URL where you would like your users sent to unsubscribe.';
          format: 'uri';
          type: 'string';
        };
      };
      title: 'Settings: Subscription Tracking';
      type: 'object';
    };
    subuser: {
      example: {
        disabled: false;
        email: 'example@example.com';
        id: 1234;
        username: 'example_subuser';
      };
      properties: {
        disabled: {
          description: 'Whether or not the user is enabled or disabled.';
          type: 'boolean';
        };
        email: {
          description: 'The email address to contact this subuser.';
          format: 'email';
          type: 'string';
        };
        id: {
          description: 'The ID of this subuser.';
          type: 'number';
        };
        username: {
          description: 'The name by which this subuser will be referred.';
          type: 'string';
        };
      };
      required: ['disabled', 'id', 'username', 'email'];
      title: 'List all Subusers for a parent response';
      type: 'object';
    };
    subuser_post: {
      example: {
        authorization_token: '';
        credit_allocation: {
          type: 'unlimited';
        };
        email: 'example@example.com';
        signup_session_token: '';
        user_id: 1234;
        username: 'example_subuser';
      };
      properties: {
        authorization_token: {
          type: 'string';
        };
        credit_allocation: {
          properties: {
            type: {
              type: 'string';
            };
          };
          type: 'object';
        };
        email: {
          description: 'The email address for this subuser.';
          format: 'email';
          type: 'string';
        };
        signup_session_token: {
          type: 'string';
        };
        user_id: {
          description: 'The user ID for this subuser.';
          type: 'number';
        };
        username: {
          description: 'The username of the subuser.';
          type: 'string';
        };
      };
      required: ['username', 'user_id', 'email'];
      title: 'Subuser::POST';
      type: 'object';
    };
    subuser_stats: {
      example: {
        date: '2016-02-01';
        stats: [
          {
            first_name: 'John';
            last_name: 'Doe';
            metrics: {
              blocks: 0;
              bounce_drops: 0;
              bounces: 0;
              clicks: 5;
              deferred: 0;
              delivered: 0;
              invalid_emails: 0;
              opens: 10;
              processed: 10;
              requests: 10;
              spam_report_drops: 0;
              spam_reports: 0;
              unique_clicks: 0;
              unique_opens: 0;
              unsubscribe_drops: 0;
              unsubscribes: 0;
            };
            name: 'user1';
            type: 'subuser';
          },
        ];
      };
      properties: {
        date: {
          description: 'The date the statistics were gathered.';
          type: 'string';
        };
        stats: {
          description: 'The list of statistics.';
          items: {
            properties: {
              first_name: {
                description: 'The first name of the subuser.';
                type: 'string';
              };
              last_name: {
                description: 'The last name of the subuser.';
                type: 'string';
              };
              metrics: {
                properties: {
                  blocks: {
                    description: 'The number of emails that were not allowed to be delivered by ISPs.';
                    type: 'integer';
                  };
                  bounce_drops: {
                    description: 'The number of emails that were dropped because of a bounce.';
                    type: 'integer';
                  };
                  bounces: {
                    description: 'The number of emails that bounced instead of being delivered.';
                    type: 'integer';
                  };
                  clicks: {
                    description: 'The number of links that were clicked in your emails.';
                    type: 'integer';
                  };
                  deferred: {
                    description: 'The number of emails that temporarily could not be delivered.';
                    type: 'integer';
                  };
                  delivered: {
                    description: 'The number of emails SendGrid was able to confirm were actually delivered to a recipient.';
                    type: 'integer';
                  };
                  invalid_emails: {
                    description: 'The number of recipients who had malformed email addresses or whose mail provider reported the address as invalid.';
                    type: 'integer';
                  };
                  opens: {
                    description: 'The total number of times your emails were opened by recipients.';
                    type: 'integer';
                  };
                  processed: {
                    description: 'Requests from your website, application, or mail client via SMTP Relay or the API that SendGrid processed.';
                    type: 'integer';
                  };
                  requests: {
                    description: 'The number of emails that were requested to be delivered.';
                    type: 'integer';
                  };
                  spam_report_drops: {
                    description: 'The number of emails that were dropped due to a recipient previously marking your emails as spam.';
                    type: 'integer';
                  };
                  spam_reports: {
                    description: 'The number of recipients who marked your email as spam.';
                    type: 'integer';
                  };
                  unique_clicks: {
                    description: 'The number of unique recipients who clicked links in your emails.';
                    type: 'integer';
                  };
                  unique_opens: {
                    description: 'The number of unique recipients who opened your emails.';
                    type: 'integer';
                  };
                  unsubscribe_drops: {
                    description: 'The number of emails dropped due to a recipient unsubscribing from your emails.';
                    type: 'integer';
                  };
                  unsubscribes: {
                    description: 'The number of recipients who unsubscribed from your emails.';
                    type: 'integer';
                  };
                };
                type: 'object';
              };
              name: {
                description: 'The username of the subuser.';
                type: 'string';
              };
              type: {
                description: 'The type of account.';
                type: 'string';
              };
            };
            type: 'object';
          };
          type: 'array';
        };
      };
      title: 'subuser_stats';
      type: 'object';
    };
    'suppression-group-request-base': {
      properties: {
        description: {
          description: 'A brief description of your suppression group. Required when creating a group.';
          maxLength: 100;
          type: 'string';
        };
        is_default: {
          description: 'Indicates if you would like this to be your default suppression group.';
          type: 'boolean';
        };
        name: {
          description: 'The name of your suppression group. Required when creating a group.';
          maxLength: 30;
          type: 'string';
        };
      };
      title: 'Suppression Group Request Base';
      type: 'object';
    };
    suppression_group: {
      properties: {
        description: {
          description: 'A description of the suppression group.';
          maxLength: 100;
          type: 'string';
        };
        id: {
          description: 'The id of the suppression group.';
          type: 'number';
        };
        is_default: {
          default: false;
          description: 'Indicates if this is the default suppression group.';
          type: 'boolean';
        };
        last_email_sent_at: {
          nullable: true;
        };
        name: {
          description: 'The name of the suppression group. Each group created by a user must have a unique name.';
          maxLength: 30;
          type: 'string';
        };
        unsubscribes: {
          description: 'The unsubscribes associated with this group.';
          type: 'integer';
        };
      };
      required: ['id', 'name', 'description'];
      title: 'Suppressions: Suppression Group';
      type: 'object';
    };
    'suppressions-request': {
      example: {
        recipient_emails: ['test1@example.com', 'test2@example.com'];
      };
      properties: {
        recipient_emails: {
          description: 'The array of email addresses to add or find.';
          items: {
            format: 'email';
            type: 'string';
          };
          type: 'array';
        };
      };
      required: ['recipient_emails'];
      title: 'Suppressions Request Body';
      type: 'object';
    };
    to_email_array: {
      example: [
        {
          email: 'john_doe@example.com';
          name: 'John Doe';
        },
      ];
      items: {
        properties: {
          email: {
            description: "The intended recipient's email address.";
            format: 'email';
            type: 'string';
          };
          name: {
            description: "The intended recipient's name.";
            type: 'string';
          };
        };
        required: ['email'];
        type: 'object';
      };
      title: 'To Email Array';
      type: 'array';
    };
    'transactional-template-warning': {
      example: {
        message: 'A sample warning message.';
      };
      properties: {
        message: {
          description: 'Warning message for the user';
          type: 'string';
        };
      };
      title: 'Warning';
      type: 'object';
    };
    'transactional-templates-template-lean': {
      example: {
        generation: 'legacy';
        id: '0c314114-a2b7-4523-8cbc-a293d7d19007';
        name: 'example_name';
        'updated_at ': '2021-04-28 13:12:46';
        versions: [];
      };
      properties: {
        generation: {
          description: 'Defines the generation of the template.';
          enum: ['legacy', 'dynamic'];
          type: 'string';
        };
        id: {
          description: 'The ID of the transactional template.';
          format: 'uuid';
          maxLength: 36;
          minLength: 36;
          type: 'string';
        };
        name: {
          description: 'The name for the transactional template.';
          maxLength: 100;
          type: 'string';
        };
        'updated_at ': {
          description: 'The date and time that this transactional template version was updated.';
          pattern: '^(\\d{4}-\\d{2}-\\d{2}) ((\\d{2}):(\\d{2}):(\\d{2}))$';
          type: 'string';
        };
        versions: {
          description: 'The different versions of this transactional template.';
          items: {
            $ref: '#/components/schemas/transactional-templates-version-output-lean';
          };
          type: 'array';
        };
      };
      required: ['id', 'name', 'generation', 'updated_at '];
      title: 'Transactional Templates: Template Lean';
      type: 'object';
    };
    'transactional-templates-version-output-lean': {
      properties: {
        active: {
          description: 'Set the version as the active version associated with the template. Only one version of a template can be active. The first version created for a template will automatically be set to Active.';
          enum: [0, 1];
          type: 'integer';
        };
        editor: {
          description: 'The editor used in the UI.';
          enum: ['code', 'design'];
          type: 'string';
        };
        generate_plain_content: {
          default: true;
          description: 'If true, plain_content is always generated from html_content. If false, plain_content is not altered.';
          type: 'boolean';
        };
        id: {
          description: 'ID of the transactional template version.';
          format: 'uuid';
          type: 'string';
        };
        name: {
          description: 'Name of the transactional template version.';
          maxLength: 100;
          type: 'string';
        };
        subject: {
          description: 'Subject of the new transactional template version.';
          maxLength: 255;
          type: 'string';
        };
        template_id: {
          description: 'ID of the transactional template.';
          type: 'string';
        };
        thumbnail_url: {
          description: "A Thumbnail preview of the template's html content.";
          type: 'string';
        };
        updated_at: {
          description: 'The date and time that this transactional template version was updated.';
          type: 'string';
        };
      };
      title: 'Transactional Templates: Version Output Lean';
      type: 'object';
    };
    transactional_template: {
      allOf: [
        {
          $ref: '#/components/schemas/transactional-templates-template-lean';
        },
        {
          properties: {
            warning: {
              $ref: '#/components/schemas/transactional-template-warning';
            };
          };
          type: 'object';
        },
      ];
      example: {
        generation: 'legacy';
        id: '33feeff2-5069-43fe-8853-428651e5be79';
        name: 'example_name';
        'updated_at ': '2021-04-28 13:12:46';
        warning: {
          message: 'Sample warning message';
        };
      };
      title: 'Transactional Templates: Template';
    };
    transactional_template_version_create: {
      example: {
        active: 1;
        editor: 'design';
        generate_plain_content: false;
        html_content: 'dolor';
        name: 'pariatur non incididunt commodo';
        plain_content: 'labore dolore';
        subject: 'aliquip nulla Ut';
        template_id: 'Excepteur Ut qui';
      };
      properties: {
        active: {
          description: 'Set the version as the active version associated with the template (0 is inactive, 1 is active). Only one version of a template can be active. The first version created for a template will automatically be set to Active.';
          enum: [0, 1];
          type: 'integer';
        };
        editor: {
          description: 'The editor used in the UI.';
          enum: ['code', 'design'];
          type: 'string';
        };
        generate_plain_content: {
          default: true;
          description: 'If true, plain_content is always generated from html_content. If false, plain_content is not altered.';
          type: 'boolean';
        };
        html_content: {
          description: 'The HTML content of the version. Maximum of 1048576 bytes allowed.';
          maxLength: 1048576;
          type: 'string';
        };
        name: {
          description: 'Name of the transactional template version.';
          maxLength: 100;
          type: 'string';
        };
        plain_content: {
          default: '<generated from html_content if left empty>';
          description: 'Text/plain content of the transactional template version. Maximum of 1048576 bytes allowed.';
          maxLength: 1048576;
          type: 'string';
        };
        subject: {
          description: 'Subject of the new transactional template version.';
          maxLength: 255;
          type: 'string';
        };
        test_data: {
          description: 'For dynamic templates only, the mock json data that will be used for template preview and test sends.';
          type: 'string';
        };
      };
      required: ['name', 'subject'];
      title: 'Transactional Templates: Version Create';
      type: 'object';
    };
    transactional_template_version_output: {
      allOf: [
        {
          properties: {
            warnings: {
              items: {
                $ref: '#/components/schemas/transactional-template-warning';
              };
              type: 'array';
            };
          };
          type: 'object';
        },
        {
          $ref: '#/components/schemas/transactional_template_version_create';
        },
        {
          $ref: '#/components/schemas/transactional-templates-version-output-lean';
        },
      ];
      title: 'Transactional Templates: Version Output';
    };
    user_profile: {
      example: {
        address: '1451 Larimer Street, 3rd floor';
        address2: '';
        city: 'Denver, CO';
        company: 'SendGrid';
        country: 'US';
        first_name: 'Matthew';
        last_name: 'Bernier';
        phone: '7208788003';
        state: 'CO';
        website: 'http://sendgrid.com';
        zip: '80202';
      };
      properties: {
        address: {
          description: 'The street address for this user profile.';
          type: 'string';
        };
        address2: {
          description: 'An optional second line for the street address of this user profile.';
          type: 'string';
        };
        city: {
          description: 'The city for the user profile.';
          type: 'string';
        };
        company: {
          description: 'That company that this user profile is associated with.';
          type: 'string';
        };
        country: {
          description: 'Th country of this user profile.';
          type: 'string';
        };
        first_name: {
          description: 'The first name of the user.';
          type: 'string';
        };
        last_name: {
          description: 'The last name of the user.';
          type: 'string';
        };
        phone: {
          description: 'The phone number for the user.';
          type: 'string';
        };
        state: {
          description: 'The state for this user.';
          type: 'string';
        };
        website: {
          description: 'The website associated with this user.';
          type: 'string';
        };
        zip: {
          description: 'The zip code for this user.';
          type: 'string';
        };
      };
      title: 'User: Profile';
      type: 'object';
    };
    user_scheduled_send_status: {
      allOf: [
        {
          $ref: '#/components/schemas/mail_batch_id';
        },
        {
          description: 'The status of the scheduled send.';
          properties: {
            status: {
              description: 'The status of the scheduled send.';
              enum: ['cancel', 'pause'];
              type: 'string';
            };
          };
          required: ['status'];
          type: 'object';
        },
      ];
      example: {
        batch_id: 'HkJ5yLYULb7Rj8GKSx7u025ouWVlMgAi';
        status: 'pause';
      };
      title: 'User Scheduled Send status';
    };
    'verified-sender-request-schema': {
      example: {
        address: '1234 Fake St';
        address2: 'PO Box 1234';
        city: 'San Francisco';
        country: 'USA';
        from_email: 'orders@example.com';
        from_name: 'Example Orders';
        nickname: 'Orders';
        reply_to: 'orders@example.com';
        reply_to_name: 'Example Orders';
        state: 'CA';
        zip: '94105';
      };
      properties: {
        address: {
          maxLength: 100;
          type: 'string';
        };
        address2: {
          maxLength: 100;
          type: 'string';
        };
        city: {
          maxLength: 150;
          type: 'string';
        };
        country: {
          maxLength: 100;
          type: 'string';
        };
        from_email: {
          format: 'email';
          maxLength: 256;
          type: 'string';
        };
        from_name: {
          maxLength: 256;
          type: 'string';
        };
        nickname: {
          maxLength: 100;
          type: 'string';
        };
        reply_to: {
          format: 'email';
          maxLength: 256;
          type: 'string';
        };
        reply_to_name: {
          maxLength: 256;
          type: 'string';
        };
        state: {
          maxLength: 2;
          type: 'string';
        };
        zip: {
          maxLength: 10;
          type: 'string';
        };
      };
      required: ['nickname', 'from_email', 'reply_to'];
      title: 'Verified Sender Request Schema';
      type: 'object';
    };
    'verified-sender-response-schema': {
      example: {
        address: '1234 Fake St.';
        address2: 'PO Box 1234';
        city: 'San Francisco';
        country: 'USA';
        from_email: 'orders@example.com';
        from_name: 'Example Orders';
        id: 1234;
        locked: false;
        nickname: 'Example Orders';
        reply_to: 'orders@example.com';
        reply_to_name: 'Example Orders';
        state: 'CA';
        verified: true;
        zip: '94105';
      };
      properties: {
        address: {
          type: 'string';
        };
        address2: {
          type: 'string';
        };
        city: {
          type: 'string';
        };
        country: {
          type: 'string';
        };
        from_email: {
          type: 'string';
        };
        from_name: {
          type: 'string';
        };
        id: {
          type: 'integer';
        };
        locked: {
          type: 'boolean';
        };
        nickname: {
          type: 'string';
        };
        reply_to: {
          type: 'string';
        };
        reply_to_name: {
          type: 'string';
        };
        state: {
          type: 'string';
        };
        verified: {
          type: 'boolean';
        };
        zip: {
          type: 'string';
        };
      };
      title: 'Verified Sender Response Schema';
      type: 'object';
    };
    webhook: {
      properties: {
        nonce: {
          description: 'The one time nonce to use when "signature" is "hmac-sha1"';
          maxLength: 32;
          minLength: 8;
          type: 'string';
        };
        url: {
          description: 'The URL to invoke in the webhook';
          type: 'string';
        };
      };
      required: ['url', 'nonce'];
      title: 'webhook';
      type: 'object';
    };
    'webhooks-event-webhook-request': {
      properties: {
        bounce: {
          description: 'Receiving server could not or would not accept message.';
          type: 'boolean';
        };
        click: {
          description: 'Recipient clicked on a link within the message. You need to enable Click Tracking for getting this type of event.';
          type: 'boolean';
        };
        deferred: {
          description: "Recipient's email server temporarily rejected message.";
          type: 'boolean';
        };
        delivered: {
          description: 'Message has been successfully delivered to the receiving server.';
          type: 'boolean';
        };
        dropped: {
          description: 'You may see the following drop reasons: Invalid SMTPAPI header, Spam Content (if spam checker app enabled), Unsubscribed Address, Bounced Address, Spam Reporting Address, Invalid, Recipient List over Package Quota';
          type: 'boolean';
        };
        enabled: {
          description: 'Indicates if the event webhook is enabled.';
          type: 'boolean';
        };
        group_resubscribe: {
          description: 'Recipient resubscribes to specific group by updating preferences. You need to enable Subscription Tracking for getting this type of event.';
          type: 'boolean';
        };
        group_unsubscribe: {
          description: 'Recipient unsubscribe from specific group, by either direct link or updating preferences. You need to enable Subscription Tracking for getting this type of event.';
          type: 'boolean';
        };
        oauth_client_id: {
          description: 'The client ID Twilio SendGrid sends to your OAuth server or service provider to generate an OAuth access token. When passing data in this field, you must also include the oauth_token_url field.';
          type: 'string';
        };
        oauth_token_url: {
          description: 'The URL where Twilio SendGrid sends the Client ID and Client Secret to generate an access token. This should be your OAuth server or service provider. When passing data in this field, you must also include the oauth_client_id field.';
          type: 'string';
        };
        open: {
          description: 'Recipient has opened the HTML message. You need to enable Open Tracking for getting this type of event.';
          type: 'boolean';
        };
        processed: {
          description: 'Message has been received and is ready to be delivered.';
          type: 'boolean';
        };
        spam_report: {
          description: 'Recipient marked a message as spam.';
          type: 'boolean';
        };
        unsubscribe: {
          description: "Recipient clicked on message's subscription management link. You need to enable Subscription Tracking for getting this type of event.";
          type: 'boolean';
        };
        url: {
          description: 'The URL that you want the event webhook to POST to.';
          type: 'string';
        };
      };
      required: [
        'enabled',
        'url',
        'group_resubscribe',
        'delivered',
        'group_unsubscribe',
        'spam_report',
        'bounce',
        'deferred',
        'unsubscribe',
        'processed',
        'open',
        'click',
        'dropped',
      ];
      title: 'Webhooks: Event Webhook Request';
      type: 'object';
    };
  };
  securitySchemes: {
    Authorization: {
      in: 'header';
      name: 'Authorization';
      type: 'apiKey';
    };
  };
};
export const components = {
  parameters: {
    trait_authorizationHeader_Authorization: {
      in: 'header',
      name: 'Authorization',
      required: true,
      schema: {
        default: 'Bearer <<YOUR_API_KEY_HERE>>',
        type: 'string',
      },
    },
    trait_automationQueryParams_group_by: {
      description:
        'Automations can have multiple steps. Including `step_id` as a `group_by` metric allows further granularity of stats.',
      explode: false,
      in: 'query',
      name: 'group_by',
      schema: {
        items: {
          enum: ['step_id'],
          type: 'string',
        },
        type: 'array',
      },
      style: 'form',
    },
    trait_automationQueryParams_step_ids: {
      description: 'Comma-separated list of `step_ids` that you want the link stats for.',
      explode: false,
      in: 'query',
      name: 'step_ids',
      schema: {
        items: {
          format: 'uuid',
          type: 'string',
        },
        type: 'array',
        uniqueItems: true,
      },
      style: 'form',
    },
    trait_baseParams_aggregated_by: {
      description: 'Dictates how the stats are time-sliced. Currently, `"total"` and `"day"` are supported.',
      in: 'query',
      name: 'aggregated_by',
      schema: {
        default: 'total',
        enum: ['day', 'total'],
        type: 'string',
      },
    },
    trait_baseParams_end_date: {
      description: "Format: `YYYY-MM-DD`.If this parameter is included, the stats' end date is included in the search.",
      in: 'query',
      name: 'end_date',
      schema: {
        default: '',
        format: 'date',
        type: 'string',
      },
    },
    trait_baseParams_start_date: {
      description:
        "Format: `YYYY-MM-DD`. If this parameter is included, the stats' start date is included in the search.",
      in: 'query',
      name: 'start_date',
      schema: {
        default: '',
        format: 'date',
        type: 'string',
      },
    },
    trait_baseParams_timezone: {
      description:
        '[IANA Area/Region](https://en.wikipedia.org/wiki/Tz_database#Names_of_time_zones) string representing the timezone in which the stats are to be presented, e.g., "America/Chicago".',
      in: 'query',
      name: 'timezone',
      schema: {
        default: 'UTC',
        type: 'string',
      },
    },
    trait_designsQueryStrings_page_size: {
      description: 'number of results to return',
      in: 'query',
      name: 'page_size',
      schema: {
        default: 100,
        minimum: 0,
        type: 'integer',
      },
    },
    trait_designsQueryStrings_page_token: {
      description: 'token corresponding to a specific page of results, as provided by metadata',
      in: 'query',
      name: 'page_token',
      schema: {
        type: 'string',
      },
    },
    trait_designsQueryStrings_summary: {
      description: 'set to false to return all fields',
      in: 'query',
      name: 'summary',
      schema: {
        default: true,
        type: 'boolean',
      },
    },
    'trait_onBehalfOfSubuser_on-behalf-of': {
      in: 'header',
      name: 'on-behalf-of',
      schema: {
        default:
          "The subuser's username. This header generates the API call as if the subuser account was making the call.",
        type: 'string',
      },
    },
    trait_pagination_page_size: {
      description: 'The number of elements you want returned on each page.',
      in: 'query',
      name: 'page_size',
      schema: {
        default: 50,
        maximum: 100,
        minimum: 1,
        type: 'integer',
      },
    },
    trait_pagination_page_token: {
      description:
        "The stats endpoints are paginated. To get the next page, call the passed `_metadata.next` URL. If `_metadata.prev` doesn't exist, you're at the first page. Similarly, if `_metadata.next` is not present, you're at the last page.",
      in: 'query',
      name: 'page_token',
      schema: {
        type: 'string',
      },
    },
    trait_singlesendQueryParams2_ab_phase_id: {
      in: 'query',
      name: 'ab_phase_id',
      schema: {
        enum: ['test', 'send'],
        type: 'string',
      },
    },
    trait_singlesendQueryParams2_ab_variation_id: {
      in: 'query',
      name: 'ab_variation_id',
      schema: {
        format: 'uuid',
        type: 'string',
      },
    },
    trait_singlesendQueryParams2_group_by: {
      description:
        'A/B Single Sends have multiple variation IDs and phase IDs. Including these additional fields allows further granularity of stats by these fields.',
      explode: false,
      in: 'query',
      name: 'group_by',
      schema: {
        items: {
          enum: ['ab_variation', 'ab_phase'],
          type: 'string',
        },
        type: 'array',
      },
      style: 'form',
    },
    trait_singlesendQueryParams_group_by: {
      description:
        'A/B Single Sends have multiple variation IDs and phase IDs. Including these additional fields allows further granularity of stats by these fields.',
      explode: false,
      in: 'query',
      name: 'group_by',
      schema: {
        items: {
          enum: ['ab_variation', 'ab_phase'],
          type: 'string',
        },
        type: 'array',
      },
      style: 'form',
    },
    trait_statsAdvancedQueryStringsLimitOffset_aggregated_by: {
      description: 'How to group the statistics. Must be either "day", "week", or "month".',
      in: 'query',
      name: 'aggregated_by',
      required: false,
      schema: {
        enum: ['day', 'week', 'month'],
        type: 'string',
      },
    },
    trait_statsAdvancedQueryStringsLimitOffset_end_date: {
      description: 'The end date of the statistics to retrieve. Defaults to today. Must follow format YYYY-MM-DD.',
      in: 'query',
      name: 'end_date',
      required: false,
      schema: {
        type: 'string',
      },
    },
    trait_statsAdvancedQueryStringsLimitOffset_limit: {
      description: 'The number of results to return.',
      in: 'query',
      name: 'limit',
      required: false,
      schema: {
        type: 'integer',
      },
    },
    trait_statsAdvancedQueryStringsLimitOffset_offset: {
      description: 'The point in the list to begin retrieving results.',
      in: 'query',
      name: 'offset',
      required: false,
      schema: {
        type: 'integer',
      },
    },
    trait_statsAdvancedQueryStringsLimitOffset_start_date: {
      description: 'The starting date of the statistics to retrieve. Must follow format YYYY-MM-DD.',
      in: 'query',
      name: 'start_date',
      required: true,
      schema: {
        type: 'string',
      },
    },
    trait_statsAdvancedStatsBaseQueryStrings_aggregated_by: {
      description: 'How to group the statistics. Must be either "day", "week", or "month".',
      in: 'query',
      name: 'aggregated_by',
      required: false,
      schema: {
        enum: ['day', 'week', 'month'],
        type: 'string',
      },
    },
    trait_statsAdvancedStatsBaseQueryStrings_end_date: {
      description: 'The end date of the statistics to retrieve. Defaults to today. Must follow format YYYY-MM-DD.',
      in: 'query',
      name: 'end_date',
      required: false,
      schema: {
        type: 'string',
      },
    },
    trait_statsAdvancedStatsBaseQueryStrings_start_date: {
      description: 'The starting date of the statistics to retrieve. Must follow format YYYY-MM-DD.',
      in: 'query',
      name: 'start_date',
      required: true,
      schema: {
        type: 'string',
      },
    },
  },
  requestBodies: {
    'DELETE_contactdb-lists-list_idBody': {
      content: {
        'application/json': {
          schema: {
            nullable: true,
          },
        },
      },
    },
    'create-integration-request': {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/create-integration-request',
          },
        },
      },
    },
    'design-duplicate-input': {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/design-duplicate-input',
          },
        },
      },
    },
    monitor: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/monitor',
          },
        },
      },
    },
    'parse-setting': {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/parse-setting',
          },
        },
      },
    },
    segment_write_v2: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/segment_write_v2',
          },
        },
      },
    },
    singlesend_request: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/singlesend_request',
          },
        },
      },
    },
    'suppressions-request': {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/suppressions-request',
          },
        },
      },
    },
    transactional_template_version_create: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/transactional_template_version_create',
          },
        },
      },
    },
    'verified-sender-request-schema': {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/verified-sender-request-schema',
          },
        },
      },
    },
  },
  responses: {
    trait_apiKeysErrors_400: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema',
          },
        },
      },
      description: '',
    },
    trait_apiKeysErrors_403: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema',
          },
        },
      },
      description: '',
    },
    trait_apiKeysErrors_404: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema',
          },
        },
      },
      description: '',
    },
    trait_cancelScheduledSendsErrors_400: {
      content: {
        'application/json': {
          schema: {
            properties: {
              errors: {
                items: {
                  properties: {
                    field: {
                      type: 'string',
                    },
                    help: {
                      type: 'object',
                    },
                    message: {
                      type: 'string',
                    },
                  },
                  type: 'object',
                },
                type: 'array',
              },
              id: {
                type: 'string',
              },
            },
            type: 'object',
          },
        },
      },
      description: '',
    },
    trait_errorResponse_400: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema',
          },
        },
      },
      description: '',
    },
    trait_errors_400: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/errors-seg-v2',
          },
        },
      },
      description: '',
    },
    trait_errors_404: {
      description: '',
    },
    trait_errors_500: {
      description: '',
    },
    trait_globalErrors_401: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema',
          },
        },
      },
      description: '',
    },
    trait_globalErrors_403: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema',
          },
        },
      },
      description: '',
    },
    trait_globalErrors_404: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema',
          },
        },
      },
      description: '',
    },
    trait_globalErrors_500: {
      content: {
        'application/json': {
          schema: {
            properties: {
              errors: {
                items: {
                  properties: {
                    message: {
                      type: 'string',
                    },
                  },
                  type: 'object',
                },
                type: 'array',
              },
            },
            type: 'object',
          },
        },
      },
      description: '',
    },
    trait_mailSendErrors_400: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema',
          },
        },
      },
      description: '',
    },
    trait_mailSendErrors_413: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/global_error_response_schema',
          },
        },
      },
      description: '',
    },
    trait_makoErrorResponse_400: {
      content: {
        'application/json': {
          schema: {
            properties: {
              errors: {
                items: {
                  properties: {
                    error_id: {
                      description: 'The ID associated with the error.',
                      type: 'string',
                    },
                    field: {
                      description: 'The field that generated the error.',
                      nullable: true,
                      type: 'string',
                    },
                    message: {
                      description: 'The error message.',
                      type: 'string',
                    },
                    parameter: {
                      type: 'string',
                    },
                  },
                  required: ['message'],
                  type: 'object',
                },
                type: 'array',
              },
            },
            type: 'object',
          },
        },
      },
      description: '',
    },
    trait_makoErrorResponse_401: {
      content: {
        'application/json': {
          schema: {
            properties: {
              errors: {
                items: {
                  properties: {
                    error_id: {
                      description: 'The ID associated with the error.',
                      type: 'string',
                    },
                    field: {
                      description: 'The field that generated the error.',
                      nullable: true,
                      type: 'string',
                    },
                    message: {
                      description: 'The error message.',
                      type: 'string',
                    },
                    parameter: {
                      type: 'string',
                    },
                  },
                  required: ['message'],
                  type: 'object',
                },
                type: 'array',
              },
            },
            type: 'object',
          },
        },
      },
      description: '',
    },
    trait_makoErrorResponse_403: {
      content: {
        'application/json': {
          schema: {
            properties: {
              errors: {
                items: {
                  properties: {
                    error_id: {
                      description: 'The ID associated with the error.',
                      type: 'string',
                    },
                    field: {
                      description: 'The field that generated the error.',
                      nullable: true,
                      type: 'string',
                    },
                    message: {
                      description: 'The error message.',
                      type: 'string',
                    },
                    parameter: {
                      type: 'string',
                    },
                  },
                  required: ['message'],
                  type: 'object',
                },
                type: 'array',
              },
            },
            type: 'object',
          },
        },
      },
      description: '',
    },
    trait_makoErrorResponse_404: {
      content: {
        'application/json': {
          schema: {
            properties: {
              errors: {
                items: {
                  properties: {
                    error_id: {
                      description: 'The ID associated with the error.',
                      type: 'string',
                    },
                    field: {
                      description: 'The field that generated the error.',
                      nullable: true,
                      type: 'string',
                    },
                    message: {
                      description: 'The error message.',
                      type: 'string',
                    },
                    parameter: {
                      type: 'string',
                    },
                  },
                  required: ['message'],
                  type: 'object',
                },
                type: 'array',
              },
            },
            type: 'object',
          },
        },
      },
      description: '',
    },
    trait_makoErrorResponse_500: {
      content: {
        'application/json': {
          schema: {
            properties: {
              errors: {
                items: {
                  properties: {
                    error_id: {
                      description: 'The ID associated with the error.',
                      type: 'string',
                    },
                    field: {
                      description: 'The field that generated the error.',
                      nullable: true,
                      type: 'string',
                    },
                    message: {
                      description: 'The error message.',
                      type: 'string',
                    },
                    parameter: {
                      type: 'string',
                    },
                  },
                  required: ['message'],
                  type: 'object',
                },
                type: 'array',
              },
            },
            type: 'object',
          },
        },
      },
      description: '',
    },
    trait_pagination_200: {
      content: {
        'application/json': {
          schema: {
            properties: {
              _metadata: {
                $ref: '#/components/schemas/metadata',
              },
            },
            type: 'object',
          },
        },
      },
      description: '',
    },
    trait_singleSignOnErrorsTrait_400: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/sso-error-response',
          },
        },
      },
      description: '',
    },
    trait_singleSignOnErrorsTrait_401: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/sso-error-response',
          },
        },
      },
      description: '',
    },
    trait_singleSignOnErrorsTrait_403: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/sso-error-response',
          },
        },
      },
      description: '',
    },
    trait_singleSignOnErrorsTrait_429: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/sso-error-response',
          },
        },
      },
      description: '',
    },
    trait_singleSignOnErrorsTrait_500: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/sso-error-response',
          },
        },
      },
      description: '',
    },
  },
  schemas: {
    'TNE-senderID': {
      allOf: [
        {
          properties: {
            id: {
              description: 'The unique identifier of the sender.',
              type: 'integer',
            },
          },
          type: 'object',
        },
        {
          $ref: '#/components/schemas/senders-id-request-body',
        },
        {
          properties: {
            created_at: {
              description: 'The time the sender identity was created.',
              type: 'integer',
            },
            locked: {
              description:
                "A sender identity is locked when it is associated with a campaign in the Draft, Scheduled, or In Progress state. You can't update or delete a locked sender identity.",
              type: 'boolean',
            },
            updated_at: {
              description: 'The time the sender identity was last updated.',
              type: 'integer',
            },
            verified: {
              description: 'Only verified sender identities can be used to send email.',
              properties: {
                reason: {
                  description:
                    'The reason for a verification failure, or null if verification succeeeded or has yet to take place.',
                  nullable: true,
                  type: 'string',
                },
                status: {
                  description:
                    'Whether the sender identity has been verified. Only verified sender identities can be used to send email.',
                  type: 'boolean',
                },
              },
              type: 'object',
            },
          },
          type: 'object',
        },
      ],
      title: 'Sender ID Response Body',
    },
    _metadata: {
      properties: {
        count: {
          minimum: 0,
          type: 'integer',
        },
        next: {
          format: 'uri',
          type: 'string',
        },
        prev: {
          format: 'uri',
          type: 'string',
        },
        self: {
          format: 'uri',
          type: 'string',
        },
      },
      title: '_metadata',
      type: 'object',
    },
    'abbv-message': {
      example: {
        clicks_count: 2,
        from_email: 'from@test.com',
        last_event_time: '2017-10-13T18:56:21Z',
        msg_id: 'abc123',
        opens_count: 1,
        status: 'processed',
        subject: 'anim Duis sint veniam',
        to_email: 'test@test.com',
      },
      properties: {
        clicks_count: {
          type: 'integer',
        },
        from_email: {
          type: 'string',
        },
        last_event_time: {
          description: 'iso 8601 format',
          type: 'string',
        },
        msg_id: {
          type: 'string',
        },
        opens_count: {
          type: 'integer',
        },
        status: {
          enum: ['processed', 'delivered', 'not_delivered'],
          type: 'string',
        },
        subject: {
          type: 'string',
        },
        to_email: {
          type: 'string',
        },
      },
      required: [
        'from_email',
        'msg_id',
        'subject',
        'to_email',
        'status',
        'opens_count',
        'clicks_count',
        'last_event_time',
      ],
      title: 'Abbv. Message',
      type: 'object',
    },
    abtest_summary: {
      nullable: true,
      properties: {
        duration: {
          description: 'How long the A/B Testing will last',
          type: 'string',
        },
        expiration_date: {
          description: 'Last day to select an A/B Test Winner',
          nullable: true,
          type: 'string',
        },
        test_percentage: {
          description: 'What percentage of your recipient will be included in your A/B testing',
          type: 'integer',
        },
        type: {
          description: 'What differs between the A/B tests',
          enum: ['subject', 'content'],
          type: 'string',
        },
        winner_criteria: {
          description: 'How the winner will be decided',
          enum: ['open', 'click', 'manual'],
          type: 'string',
        },
        winner_selected_at: {
          description: 'When the winner was selected',
          nullable: true,
          type: 'string',
        },
        winning_template_id: {
          description: 'Winner of the A/B Test',
          type: 'string',
        },
      },
      required: [
        'type',
        'winner_criteria',
        'test_percentage',
        'duration',
        'winning_template_id',
        'winner_selected_at',
        'expiration_date',
      ],
      title: 'abTest_summary',
      type: 'object',
    },
    advanced_stats_clicks: {
      description: 'The individual events and their stats.',
      properties: {
        clicks: {
          description: 'The number of links that were clicked in your emails.',
          type: 'integer',
        },
        unique_clicks: {
          description: 'The number of unique recipients who clicked links in your emails.',
          type: 'integer',
        },
      },
      title: 'Stats: Advanced Stats with Clicks',
      type: 'object',
    },
    advanced_stats_clicks_opens: {
      allOf: [
        {
          $ref: '#/components/schemas/advanced_stats_clicks',
        },
        {
          $ref: '#/components/schemas/advanced_stats_opens',
        },
      ],
      description: 'The individual events and their stats.',
      title: 'Stats: Advanced Stats with Clicks and Opens',
    },
    advanced_stats_mailbox_provider: {
      allOf: [
        {
          $ref: '#/components/schemas/advanced_stats_clicks_opens',
        },
        {
          description: 'The individual events and their stats.',
          properties: {
            blocks: {
              description: 'The number of emails that were not allowed to be delivered by ISPs.',
              type: 'integer',
            },
            bounces: {
              description: 'The number of emails that bounced instead of being delivered.',
              type: 'integer',
            },
            deferred: {
              description: 'The number of emails that temporarily could not be delivered.',
              type: 'integer',
            },
            delivered: {
              description: 'The number of emails SendGrid was able to confirm were actually delivered to a recipient.',
              type: 'integer',
            },
            drops: {
              description:
                'The number of emails that were not delivered due to the recipient email address being on a suppression list.',
              type: 'integer',
            },
            processed: {
              description:
                'Requests from your website, application, or mail client via SMTP Relay or the Web API that SendGrid processed.',
              type: 'integer',
            },
            requests: {
              description: 'The number of emails that were requested to be delivered.',
              type: 'integer',
            },
            spam_reports: {
              description: 'The number of recipients who marked your email as spam.',
              type: 'integer',
            },
          },
          type: 'object',
        },
      ],
      description: 'The individual events and their stats.',
      title: 'Stats: Advanced Stats for Mailbox Provider',
    },
    advanced_stats_opens: {
      description: 'The individual events and their stats.',
      properties: {
        opens: {
          description: 'The total number of times your emails were opened by recipients.',
          type: 'integer',
        },
        unique_opens: {
          description: 'The number of unique recipients who opened your emails.',
          type: 'integer',
        },
      },
      title: 'Stats: Advanced Stats with Opens',
      type: 'object',
    },
    all_segments_response: {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/_metadata',
        },
        contacts_count: {
          description: 'Total number of contacts present in the segment',
          type: 'integer',
        },
        created_at: {
          description: 'ISO8601 timestamp of when the object was created',
          type: 'string',
        },
        id: {
          description: 'ID assigned to the segment when created.',
          format: 'uuid',
          maxLength: 36,
          minLength: 36,
          type: 'string',
        },
        name: {
          description: 'Name of the segment.',
          maxLength: 100,
          minLength: 1,
          type: 'string',
        },
        next_sample_update: {
          description: 'ISO8601 timestamp of when the samples will be next updated',
          type: 'string',
        },
        parent_list_ids: {
          description:
            'The array of list ids to filter contacts on when building this segment. It allows only one such list id for now. We will support more in future',
          items: {
            type: 'string',
          },
          type: 'array',
          uniqueItems: true,
        },
        query_version: {
          description:
            "If not set, segment contains a query for use with Segment v1 APIs. If set to '2', segment contains a SQL query for use in v2.",
          type: 'string',
        },
        sample_updated_at: {
          description: 'ISO8601 timestamp of when the samples were last updated',
          type: 'string',
        },
        status: {
          $ref: '#/components/schemas/segment_status_response',
        },
        updated_at: {
          description: 'ISO8601 timestamp of when the object was last updated',
          type: 'string',
        },
      },
      required: [
        'id',
        'name',
        'contacts_count',
        'created_at',
        'updated_at',
        'sample_updated_at',
        'next_sample_update',
        'parent_list_ids',
        'query_version',
        'status',
      ],
      title: 'all_segments_response',
      type: 'object',
    },
    'api-error': {
      properties: {
        error_id: {
          type: 'string',
        },
        field: {
          type: 'string',
        },
        message: {
          type: 'string',
        },
      },
      required: ['message', 'field', 'error_id'],
      title: 'error',
      type: 'object',
    },
    'api-errors': {
      properties: {
        errors: {
          items: {
            $ref: '#/components/schemas/api-error',
          },
          type: 'array',
        },
      },
      title: 'errors',
      type: 'object',
    },
    api_key_name_id: {
      example: {
        api_key_id: 'qfTQ6KG0QBiwWdJ0-pCLCA',
        name: 'Mail Send',
      },
      properties: {
        api_key_id: {
          description: 'The ID of your API Key. ',
          type: 'string',
        },
        name: {
          description: 'The name of your API Key.',
          type: 'string',
        },
      },
      title: 'API Key Name and ID',
      type: 'object',
    },
    api_key_name_id_scopes: {
      allOf: [
        {
          properties: {
            scopes: {
              description: 'The permissions this API Key has access to.',
              items: {
                type: 'string',
              },
              type: 'array',
            },
          },
          type: 'object',
        },
        {
          $ref: '#/components/schemas/api_key_name_id',
        },
      ],
      example: {
        api_key_id: 'qfTQ6KG0QBiwWdJ0-pCLCA',
        name: 'Mail Send',
        scopes: [
          'mail.send',
          'mail.batch.create',
          'mail.batch.read',
          'mail.batch.update',
          'mail.batch.delete',
          'user.scheduled_sends.create',
          'user.scheduled_sends.read',
          'user.scheduled_sends.update',
          'user.scheduled_sends.delete',
          'sender_verification_eligible',
          'sender_verification_legacy',
          '2fa_required',
        ],
      },
      title: 'API Key Name, ID, and Scopes',
    },
    authentication_domain: {
      example: {
        automatic_security: true,
        custom_spf: false,
        default: true,
        dns: {
          dkim1: {
            data: 's1._domainkey.u7.wl.sendgrid.net',
            host: 's1._domainkey.example.com',
            type: 'cname',
            valid: true,
          },
          dkim2: {
            data: 's2._domainkey.u7.wl.sendgrid.net',
            host: 's2._domainkey.example.com',
            type: 'cname',
            valid: true,
          },
          mail_cname: {
            data: 'u7.wl.sendgrid.net',
            host: 'mail.example.com',
            type: 'cname',
            valid: true,
          },
        },
        domain: 'example.com',
        id: 45373692,
        ips: ['127.0.0.1'],
        legacy: false,
        subdomain: 'sub',
        user_id: 66036447,
        username: 'jdoe',
        valid: true,
      },
      properties: {
        automatic_security: {
          description: 'Indicates if this authenticated domain uses automated security.',
          type: 'boolean',
        },
        custom_spf: {
          description: 'Indicates whether this authenticated domain uses custom SPF.',
          type: 'boolean',
        },
        default: {
          description: 'Indicates if this is the default authenticated domain.',
          type: 'boolean',
        },
        dns: {
          description: 'The DNS records used to authenticate the sending domain.',
          properties: {
            dkim1: {
              description: 'A DNS record.',
              properties: {
                data: {
                  description: 'The DNS record.',
                  type: 'string',
                },
                host: {
                  description: 'The domain that this DNS record was created for.',
                  type: 'string',
                },
                type: {
                  description: 'The type of DNS record.',
                  type: 'string',
                },
                valid: {
                  description: 'Indicates if this is a valid DNS record.',
                  type: 'boolean',
                },
              },
              required: ['valid', 'type', 'host', 'data'],
              type: 'object',
            },
            dkim2: {
              description: 'A DNS record.',
              properties: {
                data: {
                  description: 'The DNS record.',
                  type: 'string',
                },
                host: {
                  description: 'The domain that this DNS record was created for.',
                  type: 'string',
                },
                type: {
                  description: 'The type of DNS record.',
                  type: 'string',
                },
                valid: {
                  description: 'Indicates if this is a valid DNS record.',
                  type: 'boolean',
                },
              },
              required: ['valid', 'type', 'host', 'data'],
              type: 'object',
            },
            mail_cname: {
              description: 'The CNAME for your sending domain that points to sendgrid.net.',
              properties: {
                data: {
                  description: 'The CNAME record.',
                  type: 'string',
                },
                host: {
                  description: 'The domain that this CNAME is created for.',
                  format: 'hostname',
                  type: 'string',
                },
                type: {
                  description: 'The type of DNS record.',
                  type: 'string',
                },
                valid: {
                  description: 'Indicates if this is a valid CNAME.',
                  type: 'boolean',
                },
              },
              required: ['valid', 'type', 'host', 'data'],
              type: 'object',
            },
          },
          required: ['mail_cname', 'dkim1', 'dkim2'],
          type: 'object',
        },
        domain: {
          description: 'The domain to be authenticated.',
          type: 'string',
        },
        id: {
          description: 'The ID of the authenticated domain.',
          type: 'number',
        },
        ips: {
          description: 'The IPs to be included in the custom SPF record for this authenticated domain.',
          items: {
            type: 'string',
          },
          type: 'array',
        },
        legacy: {
          description:
            "Indicates if this authenticated domain was created using the legacy whitelabel tool. If it is a legacy whitelabel, it will still function, but you'll need to create a new authenticated domain if you need to update it.",
          type: 'boolean',
        },
        subdomain: {
          description: 'The subdomain to use for this authenticated domain.',
          type: 'string',
        },
        user_id: {
          description: 'The ID of the user that this domain is associated with.',
          type: 'number',
        },
        username: {
          description: 'The username that this domain will be associated with.',
          type: 'string',
        },
        valid: {
          description: 'Indicates if this is a valid authenticated domain.',
          type: 'boolean',
        },
      },
      required: [
        'id',
        'user_id',
        'subdomain',
        'domain',
        'username',
        'ips',
        'custom_spf',
        'default',
        'legacy',
        'automatic_security',
        'valid',
        'dns',
      ],
      title: 'Domain Authentication - Mandatory Subdomain',
      type: 'object',
    },
    'automations-link-stats-response': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/link-tracking-metadata',
        },
        results: {
          description: '',
          items: {
            properties: {
              clicks: {
                description: 'The number of clicks on this particular link.',
                minimum: 1,
                type: 'integer',
              },
              step_id: {
                description: 'This is the ID of the step if the stats were requested to be grouped by `step_id`.',
                format: 'uuid',
                type: 'string',
              },
              url: {
                description:
                  'This is the URL of the link clicked. If `{{custom_fields}}` are part of the URL, they will be included.',
                format: 'uri',
                type: 'string',
              },
              url_location: {
                description:
                  'This is the location of the link clicked in each Automation step. Links are located according to their position within the message; the topmost link has index `0`.',
                minimum: 0,
                type: 'integer',
              },
            },
            required: ['url', 'step_id', 'clicks'],
            type: 'object',
          },
          type: 'array',
        },
        total_clicks: {
          type: 'integer',
        },
      },
      required: ['results', 'total_clicks', '_metadata'],
      title: 'automations-link-stats-response',
      type: 'object',
    },
    'automations-response': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/metadata',
        },
        results: {
          items: {
            properties: {
              aggregation: {
                default: 'total',
                description:
                  'This describes the time unit to which the stat is rolled up. It is based on the `aggregated_by` parameter included in the request. It can be "total" or the date (in YYYY-MM-DD format) the stats are for.',
                type: 'string',
              },
              id: {
                description: 'This is the ID of the Automation you are requesting stats for.',
                format: 'uuid',
                type: 'string',
              },
              stats: {
                $ref: '#/components/schemas/metrics',
              },
              step_id: {
                default: 'all',
                description: 'This is the ID of the step if the stats were requested to be grouped by `step_id`.',
                type: 'string',
              },
            },
            required: ['id', 'aggregation', 'step_id'],
            type: 'object',
          },
          type: 'array',
        },
      },
      required: ['results'],
      title: 'automations-response',
      type: 'object',
    },
    'blocks-response': {
      example: [
        {
          created: 1443651154,
          email: 'example@example.com',
          reason: 'error dialing remote address: dial tcp 10.57.152.165:25: no route to host',
          status: '4.0.0',
        },
      ],
      items: {
        properties: {
          created: {
            description: 'A Unix timestamp indicating when the email address was added to the blocks list.',
            type: 'integer',
          },
          email: {
            description: 'The email address that was added to the block list.',
            format: 'email',
            type: 'string',
          },
          reason: {
            description: 'An explanation for the reason of the block.',
            type: 'string',
          },
          status: {
            description: 'The status of the block.',
            type: 'string',
          },
        },
        required: ['created', 'email', 'reason', 'status'],
        type: 'object',
      },
      title: 'Blocks Response',
      type: 'array',
    },
    bounce_response: {
      example: {
        created: 1250337600,
        email: 'example@example.com',
        reason:
          "550 5.1.1 The email account that you tried to reach does not exist. Please try double-checking the recipient's email address for typos or unnecessary spaces. Learn more at  https://support.google.com/mail/answer/6596 o186si2389584ioe.63 - gsmtp ",
        status: '5.1.1',
      },
      properties: {
        created: {
          description: 'The unix timestamp for when the bounce record was created at SendGrid.',
          type: 'number',
        },
        email: {
          description: 'The email address that was added to the bounce list.',
          format: 'email',
          type: 'string',
        },
        reason: {
          description:
            'The reason for the bounce. This typically will be a bounce code, an enhanced code, and a description.',
          type: 'string',
        },
        status: {
          description: 'Enhanced SMTP bounce response',
          type: 'string',
        },
      },
      title: 'Bounce Response',
      type: 'object',
    },
    campaign_request: {
      example: {
        categories: ['summer line'],
        custom_unsubscribe_url: '',
        html_content: '<html><head><title></title></head><body><p>Check out our summer line!</p></body></html>',
        id: 986724,
        ip_pool: 'marketing',
        list_ids: [110, 124],
        plain_content: 'Check out our summer line!',
        segment_ids: [110],
        sender_id: 124451,
        status: 'Draft',
        subject: 'New Products for Summer!',
        suppression_group_id: 42,
        title: 'May Newsletter',
      },
      properties: {
        categories: {
          description: 'The categories you would like associated to this campaign.',
          items: {
            type: 'string',
          },
          nullable: true,
          type: 'array',
        },
        custom_unsubscribe_url: {
          description:
            'This is the url of the custom unsubscribe page that you provide for customers to unsubscribe from your suppression groups.',
          nullable: true,
          type: 'string',
        },
        editor: {
          description: 'The editor used in the UI.',
          enum: ['code', 'design'],
          type: 'string',
        },
        html_content: {
          description: 'The HTML of your marketing email.',
          nullable: true,
          type: 'string',
        },
        ip_pool: {
          description: 'The pool of IPs that you would like to send this email from.',
          nullable: true,
          type: 'string',
        },
        list_ids: {
          description:
            'The IDs of the lists you are sending this campaign to. You can have both segment IDs and list IDs',
          items: {
            type: 'integer',
          },
          nullable: true,
          type: 'array',
        },
        plain_content: {
          description: 'The plain text content of your emails.',
          nullable: true,
          type: 'string',
        },
        segment_ids: {
          description:
            'The segment IDs that you are sending this list to. You can have both segment IDs and list IDs. Segments are limited to 10 segment IDs.',
          items: {
            type: 'integer',
          },
          nullable: true,
          type: 'array',
        },
        sender_id: {
          description:
            'The ID of the "sender" identity that you have created. Your recipients will see this as the "from" on your marketing emails.',
          nullable: true,
          type: 'integer',
        },
        subject: {
          description: 'The subject of your campaign that your recipients will see.',
          nullable: true,
          type: 'string',
        },
        suppression_group_id: {
          description:
            'The suppression group that this marketing email belongs to, allowing recipients to opt-out of emails of this type.',
          nullable: true,
          type: 'integer',
        },
        title: {
          description:
            'The display title of your campaign. This will be viewable by you in the Marketing Campaigns UI.',
          type: 'string',
        },
      },
      required: ['title'],
      title: 'Campaigns Request',
      type: 'object',
    },
    campaign_response: {
      allOf: [
        {
          $ref: '#/components/schemas/campaign_request',
        },
        {
          properties: {
            id: {
              type: 'integer',
            },
            status: {
              description: 'The status of your campaign.',
              type: 'string',
            },
          },
          required: ['status'],
          type: 'object',
        },
      ],
      title: 'Campaigns Response',
    },
    category_stats: {
      example: {
        date: '2015-01-01',
        stats: [
          {
            metrics: {
              blocks: 0,
              bounce_drops: 0,
              bounces: 0,
              clicks: 0,
              deferred: 0,
              delivered: 0,
              invalid_emails: 0,
              opens: 0,
              processed: 0,
              requests: 0,
              spam_report_drops: 0,
              spam_reports: 0,
              unique_clicks: 0,
              unique_opens: 0,
              unsubscribe_drops: 0,
              unsubscribes: 0,
            },
            name: 'cat1',
            type: 'category',
          },
          {
            metrics: {
              blocks: 0,
              bounce_drops: 0,
              bounces: 0,
              clicks: 0,
              deferred: 0,
              delivered: 0,
              invalid_emails: 0,
              opens: 0,
              processed: 0,
              requests: 0,
              spam_report_drops: 0,
              spam_reports: 0,
              unique_clicks: 0,
              unique_opens: 0,
              unsubscribe_drops: 0,
              unsubscribes: 0,
            },
            name: 'cat2',
            type: 'category',
          },
        ],
      },
      properties: {
        date: {
          description: 'The date the statistics were gathered.',
          type: 'string',
        },
        stats: {
          items: {
            properties: {
              metrics: {
                properties: {
                  blocks: {
                    description: 'The number of emails that were not allowed to be delivered by ISPs.',
                    type: 'integer',
                  },
                  bounce_drops: {
                    description: 'The number of emails that were dropped because of a bounce.',
                    type: 'integer',
                  },
                  bounces: {
                    description: 'The number of emails that bounced instead of being delivered.',
                    type: 'integer',
                  },
                  clicks: {
                    description: 'The number of links that were clicked.',
                    type: 'integer',
                  },
                  deferred: {
                    description: 'The number of emails that temporarily could not be delivered.',
                    type: 'integer',
                  },
                  delivered: {
                    description:
                      'The number of emails SendGrid was able to confirm were actually delivered to a recipient.',
                    type: 'integer',
                  },
                  invalid_emails: {
                    description:
                      'The number of recipients who had malformed email addresses or whose mail provider reported the address as invalid.',
                    type: 'integer',
                  },
                  opens: {
                    description: 'The total number of times your emails were opened by recipients.',
                    type: 'integer',
                  },
                  processed: {
                    description:
                      'Requests from your website, application, or mail client via SMTP Relay or the API that SendGrid processed.',
                    type: 'integer',
                  },
                  requests: {
                    description: 'The number of emails that were requested to be delivered.',
                    type: 'integer',
                  },
                  spam_report_drops: {
                    description:
                      'The number of emails that were dropped due to a recipient previously marking your emails as spam.',
                    type: 'integer',
                  },
                  spam_reports: {
                    description: 'The number of recipients who marked your email as spam.',
                    type: 'integer',
                  },
                  unique_clicks: {
                    description: 'The number of unique recipients who clicked links in your emails.',
                    type: 'integer',
                  },
                  unique_opens: {
                    description: 'The number of unique recipients who opened your emails.',
                    type: 'integer',
                  },
                  unsubscribe_drops: {
                    description: 'The number of emails dropped due to a recipient unsubscribing from your emails.',
                    type: 'integer',
                  },
                  unsubscribes: {
                    description: 'The number of recipients who unsubscribed from your emails.',
                    type: 'integer',
                  },
                },
                required: [
                  'blocks',
                  'bounce_drops',
                  'bounces',
                  'clicks',
                  'deferred',
                  'delivered',
                  'invalid_emails',
                  'opens',
                  'processed',
                  'requests',
                  'spam_report_drops',
                  'spam_reports',
                  'unique_clicks',
                  'unique_opens',
                  'unsubscribe_drops',
                  'unsubscribes',
                ],
                type: 'object',
              },
              name: {
                description: 'The name of the category.',
                type: 'string',
              },
              type: {
                description: 'How you are segmenting your statistics.',
                type: 'string',
              },
            },
            required: ['type'],
            type: 'object',
          },
          type: 'array',
        },
      },
      required: ['date'],
      title: 'Stats: Category Stats',
      type: 'object',
    },
    cc_bcc_email_object: {
      example: {
        email: 'jane_doe@example.com',
        name: 'Jane Doe',
      },
      properties: {
        email: {
          description: "The intended recipient's email address.",
          format: 'email',
          type: 'string',
        },
        name: {
          description: "The intended recipient's name.",
          type: 'string',
        },
      },
      required: ['email'],
      title: 'CC BCC Email Object',
      type: 'object',
    },
    'click-tracking': {
      example: {
        enable_text: false,
        enabled: false,
      },
      properties: {
        enable_text: {
          description: 'Indicates if click tracking is enabled for plain text emails.',
          type: 'boolean',
        },
        enabled: {
          description: 'Indicates if click tracking is enabled or disabled.',
          type: 'boolean',
        },
      },
      required: ['enable_text', 'enabled'],
      title: 'Settings: Click Tracking',
      type: 'object',
    },
    'contact-details': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/selfmetadata',
        },
        address_line_1: {
          type: 'string',
        },
        address_line_2: {
          type: 'string',
        },
        alternate_emails: {
          items: {
            type: 'string',
          },
          type: 'array',
        },
        city: {
          type: 'string',
        },
        country: {
          type: 'string',
        },
        created_at: {
          description: 'The ISO8601 timestamp when the contact was created.',
          type: 'string',
        },
        custom_fields: {
          $ref: '#/components/schemas/custom-fields-by-name',
        },
        email: {
          type: 'string',
        },
        first_name: {
          type: 'string',
        },
        id: {
          type: 'string',
        },
        last_name: {
          type: 'string',
        },
        list_ids: {
          items: {
            type: 'string',
          },
          type: 'array',
        },
        postal_code: {
          type: 'string',
        },
        state_province_region: {
          type: 'string',
        },
        updated_at: {
          description: 'The ISO8601 timestamp when the contact was updated.',
          type: 'string',
        },
      },
      required: ['id', 'list_ids', 'created_at', 'updated_at'],
      title: 'contact-details',
      type: 'object',
    },
    'contact-details2': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/selfmetadata',
        },
        address_line_1: {
          type: 'string',
        },
        address_line_2: {
          type: 'string',
        },
        alternate_emails: {
          items: {
            format: 'email',
            type: 'string',
          },
          nullable: true,
          type: 'array',
        },
        city: {
          type: 'string',
        },
        country: {
          type: 'string',
        },
        created_at: {
          format: 'date-time',
          type: 'string',
        },
        custom_fields: {
          type: 'object',
        },
        email: {
          format: 'email',
          type: 'string',
        },
        facebook: {
          type: 'string',
        },
        first_name: {
          type: 'string',
        },
        id: {
          format: 'uuid',
          maxLength: 36,
          minLength: 36,
          type: 'string',
        },
        last_name: {
          type: 'string',
        },
        line: {
          type: 'string',
        },
        list_ids: {
          items: {
            format: 'uuid',
            type: 'string',
          },
          type: 'array',
        },
        phone_number: {
          type: 'string',
        },
        postal_code: {
          type: 'string',
        },
        segment_ids: {
          items: {
            format: 'uuid',
            type: 'string',
          },
          type: 'array',
        },
        state_province_region: {
          type: 'string',
        },
        unique_name: {
          type: 'string',
        },
        updated_at: {
          format: 'date-time',
          type: 'string',
        },
        whatsapp: {
          type: 'string',
        },
      },
      required: ['id', 'list_ids', 'created_at', 'updated_at'],
      title: 'contact-details2',
      type: 'object',
    },
    'contact-details3': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/selfmetadata',
        },
        address_line_1: {
          type: 'string',
        },
        address_line_2: {
          type: 'string',
        },
        alternate_emails: {
          items: {
            type: 'string',
          },
          type: 'array',
        },
        city: {
          type: 'string',
        },
        country: {
          type: 'string',
        },
        created_at: {
          type: 'string',
        },
        custom_fields: {
          type: 'object',
        },
        email: {
          type: 'string',
        },
        facebook: {
          type: 'string',
        },
        first_name: {
          type: 'string',
        },
        id: {
          type: 'string',
        },
        last_name: {
          type: 'string',
        },
        line: {
          type: 'string',
        },
        list_ids: {
          items: {
            type: 'string',
          },
          type: 'array',
        },
        phone_number: {
          type: 'string',
        },
        postal_code: {
          type: 'string',
        },
        segment_ids: {
          items: {
            type: 'string',
          },
          type: 'array',
        },
        state_province_region: {
          type: 'string',
        },
        unique_name: {
          type: 'string',
        },
        updated_at: {
          type: 'string',
        },
        whatsapp: {
          type: 'string',
        },
      },
      required: ['id', 'list_ids', 'segment_ids', 'created_at', 'updated_at'],
      title: 'contact-details3',
      type: 'object',
    },
    'contact-export': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/metadata',
        },
        completed_at: {
          description: 'The ISO8601 timestamp when the export was completed.',
          type: 'string',
        },
        contact_count: {
          description: 'The total number of exported contacts.',
          type: 'integer',
        },
        created_at: {
          description: 'The ISO8601 timestamp when the export was begun.',
          type: 'string',
        },
        expires_at: {
          description: 'The ISO8601 timestamp when the exported file on S3 will expire.',
          type: 'string',
        },
        id: {
          type: 'string',
        },
        message: {
          description: 'A human readable message if the status is `failure`.',
          type: 'string',
        },
        status: {
          description: "The export job's status. Allowed values: `pending`, `ready`, or `failure`.",
          enum: ['pending', 'ready', 'failure'],
          type: 'string',
        },
        updated_at: {
          description: 'The ISO8601 timestamp when the export was updated.',
          type: 'string',
        },
        urls: {
          description: 'One or more download URLs for the contact file if the status is `ready`.',
          items: {
            type: 'string',
          },
          type: 'array',
        },
      },
      required: ['id', 'status', 'created_at', 'updated_at', 'expires_at'],
      title: 'contact-export',
      type: 'object',
    },
    'contact-import': {
      properties: {
        finished_at: {
          description: 'The ISO8601 timestamp when the job was finished.',
          type: 'string',
        },
        id: {
          description: 'The job ID.',
          type: 'string',
        },
        job_type: {
          description: 'The job type. Allowed values: `upsert`, or `delete`.',
          type: 'string',
        },
        results: {
          description: 'Result map of the import job.',
          properties: {
            created_count: {
              description: 'Created contact count from the import.',
              type: 'number',
            },
            deleted_count: {
              description: 'Count of deleted contacts that resulted in error.',
              type: 'number',
            },
            errored_count: {
              description: 'Count of imported contacts that resulted in error.',
              type: 'number',
            },
            errors_url: {
              description: 'The download URL of the file which provides information about any errors.',
              type: 'string',
            },
            requested_count: {
              description: 'Requested contact count from the import.',
              type: 'number',
            },
            updated_count: {
              description: 'Updated contact count from the import.',
              type: 'number',
            },
          },
          type: 'object',
        },
        started_at: {
          description: 'The ISO8601 timestamp when the job was created.',
          type: 'string',
        },
        status: {
          description: 'The job state. Allowed values: `pending`, `completed`, `errored`, or `failed`.',
          type: 'string',
        },
      },
      title: 'contact-import',
      type: 'object',
    },
    'contact-request': {
      properties: {
        address_line_1: {
          description: 'The first line of the address.',
          maxLength: 100,
          type: 'string',
        },
        address_line_2: {
          description: 'An optional second line for the address.',
          maxLength: 100,
          type: 'string',
        },
        alternate_emails: {
          description: 'Additional emails associated with the contact.',
          items: {
            maxLength: 254,
            type: 'string',
          },
          maxItems: 5,
          minItems: 0,
          type: 'array',
        },
        city: {
          description: "The contact's city.",
          maxLength: 60,
          type: 'string',
        },
        country: {
          description: "The contact's country. Can be a full name or an abbreviation.",
          maxLength: 50,
          type: 'string',
        },
        custom_fields: {
          $ref: '#/components/schemas/custom-fields-by-id',
        },
        email: {
          description: "The contact's primary email. This is required to be a valid email.",
          maxLength: 254,
          type: 'string',
        },
        first_name: {
          description: "The contact's personal name.",
          maxLength: 50,
          type: 'string',
        },
        last_name: {
          description: "The contact's family name.",
          maxLength: 50,
          type: 'string',
        },
        postal_code: {
          description: "The contact's ZIP code or other postal code.",
          type: 'string',
        },
        state_province_region: {
          description: "The contact's state, province, or region.",
          maxLength: 50,
          type: 'string',
        },
      },
      required: ['email'],
      title: 'contact-request',
      type: 'object',
    },
    'contact-summary': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/selfmetadata',
        },
        created_at: {
          description: 'Unix Epoch Timestamp.',
          type: 'number',
        },
        email: {
          description: 'Primary email address.',
          type: 'string',
        },
        first_name: {
          type: 'string',
        },
        id: {
          description: 'Contact UUID.',
          type: 'string',
        },
        last_name: {
          type: 'string',
        },
        list_ids: {
          description: 'List UUID linked with this contact.',
          items: {
            type: 'string',
          },
          type: 'array',
        },
        updated_at: {
          description: 'Unix Epoch Timestamp.',
          type: 'number',
        },
      },
      required: ['id', 'list_ids', 'created_at', 'updated_at'],
      title: 'contact-summary',
      type: 'object',
    },
    contact_response: {
      example: {
        address_line_1: 'street address / P.O. box / CompanyName / c/o',
        address_line_2: 'apartment, suite, unit, building, floor etc',
        alternate_emails: ['abcd@yahoo.com', 'abcd@hotmail.com'],
        city: 'Redwood City',
        country: 'USA',
        custom_fields: {
          custom_field_name1: 'custom_field_value1',
          custom_field_name2: 'custom_field_value2',
        },
        email: 'abcd@gmail.com',
        first_name: 'Ab',
        id: '47d23ab0-d895-4359-a0d1-ffc7a6fc7e70',
        last_name: 'Cd',
        postal_code: 94063,
        state_province_region: 'CA',
      },
      properties: {
        address_line_1: {
          description: 'First line of address of the contact. This is a reserved field.',
          minLength: 0,
          type: 'string',
        },
        address_line_2: {
          description: 'Second line of address of the contact. This is a reserved field.',
          minLength: 0,
          type: 'string',
        },
        alternate_emails: {
          description: 'Alternate emails of the contact. This is a reserved field.',
          items: {
            format: 'email',
            maxLength: 254,
            minLength: 3,
            type: 'string',
          },
          minItems: 0,
          type: 'array',
          uniqueItems: true,
        },
        city: {
          description: 'City associated with the contact. This is a reserved field.',
          minLength: 0,
          pattern: '^[a-zA-Z\\u0080-\\u024F\\s\\/\\-\\)\\(\\`\\.\\"\\\']+$',
          type: 'string',
        },
        country: {
          description: 'Country associated with the address of the contact. This is a reserved field.',
          minLength: 0,
          type: 'string',
        },
        custom_fields: {
          description:
            'The user may choose to create up to 120 custom fields or none at all. This is not a reserved field.',
          minProperties: 0,
          properties: {
            '': {
              type: 'string',
            },
            custom_field_name1: {
              minLength: 0,
              type: 'string',
            },
            custom_field_name2: {
              minLength: 0,
              type: 'string',
            },
          },
          type: 'object',
        },
        email: {
          description: 'Email of the contact. This is a reserved field.',
          format: 'email',
          maxLength: 254,
          minLength: 3,
          type: 'string',
        },
        first_name: {
          description: 'First name of the contact. This is a reserved field.',
          minLength: 1,
          type: 'string',
        },
        id: {
          description: 'ID assigned to a contact when added to the system.',
          format: 'uuid',
          maxLength: 36,
          pattern: '[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}',
          type: 'string',
        },
        last_name: {
          description: 'Last name of the contact. This is a reserved field.',
          minLength: 1,
          type: 'string',
        },
        list_ids: {
          description: 'IDs of all lists the contact is part of',
          items: {
            format: 'uuid',
            type: 'string',
          },
          type: 'array',
          uniqueItems: true,
        },
        postal_code: {
          description: 'Zipcode associated with the address of the contact. This is a reserved field.',
          type: 'integer',
        },
        segment_ids: {
          description: 'IDs of all segments the contact is part of',
          items: {
            format: 'uuid',
            type: 'string',
          },
          type: 'array',
          uniqueItems: true,
        },
        state_province_region: {
          description: 'State associated with the contact. This is a reserved field.',
          minLength: 0,
          type: 'string',
        },
      },
      required: [
        'id',
        'email',
        'alternate_emails',
        'first_name',
        'last_name',
        'address_line_1',
        'address_line_2',
        'city',
        'state_province_region',
        'postal_code',
        'country',
        'custom_fields',
      ],
      title: 'contact_response',
      type: 'object',
    },
    contactdb_custom_field: {
      example: {
        name: 'first_name',
        type: 'text',
      },
      properties: {
        name: {
          description: 'The name of the field',
          type: 'string',
        },
        type: {
          description: 'The type of the field.',
          enum: ['date', 'text', 'number'],
          type: 'string',
        },
      },
      title: 'ContactDB Custom field schema.',
      type: 'object',
    },
    contactdb_custom_field_with_id: {
      allOf: [
        {
          $ref: '#/components/schemas/contactdb_custom_field',
        },
        {
          properties: {
            id: {
              description: 'The ID of the custom field.',
              type: 'number',
            },
          },
          type: 'object',
        },
      ],
      title: 'ContactDB Custom field schema with ID.',
    },
    contactdb_custom_field_with_id_value: {
      allOf: [
        {
          $ref: '#/components/schemas/contactdb_custom_field_with_id',
        },
        {
          properties: {
            value: {
              description: "The value of this recipient's custom field",
              nullable: true,
              type: 'string',
            },
          },
          type: 'object',
        },
      ],
      title: 'ContactDB Custom field schema.',
    },
    contactdb_list: {
      example: {
        id: 1,
        name: 'listname',
        recipient_count: 0,
      },
      properties: {
        id: {
          description: 'The reference ID of your list.',
          type: 'integer',
        },
        name: {
          description: 'The name of your list. Must be unique against all other list and segment names.',
          type: 'string',
        },
        recipient_count: {
          description: 'The count of recipients currently in the list.',
          type: 'integer',
        },
      },
      required: ['id', 'name', 'recipient_count'],
      title: 'ContactDB lists',
      type: 'object',
    },
    contactdb_recipient: {
      properties: {
        recipients: {
          items: {
            properties: {
              created_at: {
                description: 'The time this record was created in your contactdb, in unixtime.',
                type: 'number',
              },
              custom_fields: {
                description: 'The custom fields assigned to this recipient and their values.',
                items: {
                  $ref: '#/components/schemas/contactdb_custom_field_with_id_value',
                },
                type: 'array',
              },
              email: {
                description:
                  'The email address of this recipient. This is a default custom field that SendGrid provides.',
                format: 'email',
                type: 'string',
              },
              first_name: {
                description: 'The first name of this recipient. This is a default custom field that SendGrid provides.',
                nullable: true,
                type: 'string',
              },
              id: {
                description: 'The ID of this recipient.',
                type: 'string',
              },
              last_clicked: {
                description: 'The last time this recipient clicked a link from one of your campaigns, in unixtime.',
                nullable: true,
                type: 'number',
              },
              last_emailed: {
                description: 'The last time this user was emailed by one of your campaigns, in unixtime.',
                nullable: true,
                type: 'number',
              },
              last_name: {
                description: 'The last name of the recipient.',
                nullable: true,
                type: 'string',
              },
              last_opened: {
                description: 'The last time this recipient opened an email from you, in unixtime.',
                nullable: true,
                type: 'number',
              },
              updated_at: {
                description: "The last update date for this recipient's record.",
                type: 'number',
              },
            },
            required: ['email'],
            type: 'object',
          },
          type: 'array',
        },
      },
      title: 'ContactDB: Recipient',
      type: 'object',
    },
    contactdb_recipient_count: {
      example: {
        recipient_count: 1234,
      },
      properties: {
        recipient_count: {
          description: 'The count of recipients.',
          type: 'number',
        },
      },
      required: ['recipient_count'],
      title: 'ContactDB: Recipient Count',
      type: 'object',
    },
    contactdb_recipient_response: {
      example: {
        error_count: 1,
        error_indices: [2],
        errors: [
          {
            error_indices: [2],
            message: 'Invalid email.',
          },
        ],
        new_count: 2,
        persisted_recipients: ['YUBh', 'bWlsbGVyQG1pbGxlci50ZXN0'],
        updated_count: 0,
      },
      properties: {
        error_count: {
          default: 0,
          description: 'The number of errors found while adding recipients.',
          type: 'number',
        },
        error_indices: {
          default: [],
          description: 'The indices of the recipient(s) sent that caused the error. ',
          items: {
            type: 'number',
          },
          type: 'array',
        },
        errors: {
          items: {
            properties: {
              error_indices: {
                items: {
                  type: 'number',
                },
                type: 'array',
              },
              message: {
                type: 'string',
              },
            },
            type: 'object',
          },
          type: 'array',
        },
        new_count: {
          default: 0,
          description: 'The count of new recipients added to the contactdb.',
          type: 'number',
        },
        persisted_recipients: {
          default: [],
          description: 'The recipient IDs of the recipients that already existed from this request.',
          items: {
            type: 'string',
          },
          type: 'array',
        },
        updated_count: {
          default: 0,
          description: 'The recipients who were updated from this request.',
          type: 'number',
        },
      },
      required: ['error_count', 'new_count', 'persisted_recipients', 'updated_count'],
      title: 'ContactDB: Recipient response',
      type: 'object',
    },
    contactdb_segments: {
      example: {
        conditions: [
          {
            and_or: '',
            field: 'last_name',
            operator: 'eq',
            value: 'Miller',
          },
          {
            and_or: 'and',
            field: 'last_clicked',
            operator: 'gt',
            value: '01/02/2015',
          },
          {
            and_or: 'or',
            field: 'clicks.campaign_identifier',
            operator: 'eq',
            value: '513',
          },
        ],
        list_id: 4,
        name: 'Last Name Miller',
        recipient_count: 1234,
      },
      properties: {
        conditions: {
          description: 'The conditions for a recipient to be included in this segment.',
          items: {
            $ref: '#/components/schemas/contactdb_segments_conditions',
          },
          type: 'array',
        },
        list_id: {
          description:
            'The list id from which to make this segment. Not including this ID will mean your segment is created from the main contactdb rather than a list.',
          type: 'integer',
        },
        name: {
          description: 'The name of this segment.',
          type: 'string',
        },
        recipient_count: {
          description: 'The count of recipients in this list. This is not included on creation of segments.',
          type: 'number',
        },
      },
      required: ['name', 'conditions'],
      title: 'Create a Segment request',
      type: 'object',
    },
    contactdb_segments_conditions: {
      properties: {
        and_or: {
          enum: ['and', 'or', ''],
          type: 'string',
        },
        field: {
          type: 'string',
        },
        operator: {
          enum: ['eq', 'ne', 'lt', 'gt', 'contains'],
          type: 'string',
        },
        value: {
          type: 'string',
        },
      },
      required: ['field', 'value', 'operator'],
      title: 'ContactDB: Segments: Conditions',
      type: 'object',
    },
    contactdb_segments_with_id: {
      allOf: [
        {
          properties: {
            id: {
              description: 'The ID of the segment.',
              type: 'number',
            },
          },
          required: ['id'],
          type: 'object',
        },
        {
          $ref: '#/components/schemas/contactdb_segments',
        },
      ],
      title: 'ContactDB:: Segments with ID',
    },
    contacts: {
      properties: {
        address: {
          type: 'string',
        },
        address2: {
          type: 'object',
        },
        city: {
          type: 'string',
        },
        company: {
          type: 'string',
        },
        country: {
          type: 'string',
        },
        email: {
          type: 'string',
        },
        first_name: {
          type: 'string',
        },
        last_name: {
          type: 'string',
        },
        phone: {
          type: 'string',
        },
        state: {
          type: 'string',
        },
        zip: {
          type: 'string',
        },
      },
      title: 'Contacts',
      type: 'object',
    },
    'create-integration-request': {
      properties: {
        completed_integration: {
          description: 'Indicates if the integration is complete.',
          type: 'boolean',
        },
        enabled: {
          description: 'Indicates if the integration is enabled.',
          type: 'boolean',
        },
        entity_id: {
          description:
            'An identifier provided by your IdP to identify Twilio SendGrid in the SAML interaction. This is called the "SAML Issuer ID" in the Twilio SendGrid UI.',
          type: 'string',
        },
        name: {
          description:
            'The name of your integration. This name can be anything that makes sense for your organization (eg. Twilio SendGrid)',
          type: 'string',
        },
        signin_url: {
          description:
            'The IdP\'s SAML POST endpoint. This endpoint should receive requests and initiate an SSO login flow. This is called the "Embed Link" in the Twilio SendGrid UI.',
          type: 'string',
        },
        signout_url: {
          description:
            'This URL is relevant only for an IdP-initiated authentication flow. If a user authenticates from their IdP, this URL will return them to their IdP when logging out.',
          type: 'string',
        },
      },
      required: ['name', 'enabled', 'signin_url', 'signout_url', 'entity_id'],
      title: 'Create Integration Request',
      type: 'object',
    },
    credentials: {
      example: {
        address: '1234 example street',
        address2: null,
        city: 'Denver',
        company: 'Company name',
        country: 'US',
        email: 'example@example.com',
        first_name: 'Example',
        last_name: 'User',
        phone: '(555) 555-5555',
        state: 'CO',
        zip: '55555',
      },
      properties: {
        permissions: {
          properties: {
            api: {
              type: 'string',
            },
            mail: {
              type: 'string',
            },
            web: {
              type: 'string',
            },
          },
          type: 'object',
        },
        username: {
          type: 'string',
        },
      },
      title: 'Credentials',
      type: 'object',
    },
    'custom-fields-by-id': {
      example: {
        e2: 'Coffee is a beverage that puts one to sleep when not drank.',
        w1: '2002-10-02T15:00:00Z',
        w33: 9.5,
      },
      title: 'custom-fields-by-id',
      type: 'object',
    },
    'custom-fields-by-name': {
      example: {
        birthday: '2002-10-02T15:00:00Z',
        favoriteQuote: 'Coffee is a beverage that puts one to sleep when not drank.',
        shoe_size: 9.5,
      },
      title: 'custom-fields-by-name',
      type: 'object',
    },
    custom_field_definitions_response: {
      example: {
        field_type: 'Date',
        id: 'a1_D',
        name: 'custom_field_name',
      },
      properties: {
        field_type: {
          enum: ['Text', 'Number', 'Date'],
          type: 'string',
        },
        id: {
          type: 'string',
        },
        name: {
          maxLength: 100,
          minLength: 1,
          type: 'string',
        },
      },
      required: ['id', 'name', 'field_type'],
      title: 'custom_field_definitions_response',
      type: 'object',
    },
    'design-common-fields': {
      allOf: [
        {
          $ref: '#/components/schemas/design-duplicate-input',
        },
        {
          properties: {
            categories: {
              description: 'The list of categories applied to the design',
              items: {
                maxLength: 255,
                type: 'string',
              },
              maxItems: 10,
              type: 'array',
              uniqueItems: true,
            },
            generate_plain_content: {
              default: true,
              description:
                'If true, plain_content is always generated from html_content. If false, plain_content is not altered.',
              type: 'boolean',
            },
            subject: {
              description: 'Subject of the Design.',
              maxLength: 5000,
              type: 'string',
            },
          },
          type: 'object',
        },
      ],
      title: 'Design Common Fields',
    },
    'design-duplicate-input': {
      example: {
        editor: 'design',
        name: 'Ahoy, Cake or Pie Cafe!',
      },
      properties: {
        editor: {
          description: 'The editor used in the UI.',
          enum: ['code', 'design'],
          type: 'string',
        },
        name: {
          default: 'Duplicate: <original design name>',
          description: 'The name of the new design.',
          type: 'string',
        },
      },
      title: 'Design Duplicate Design Input',
      type: 'object',
    },
    'design-input': {
      allOf: [
        {
          $ref: '#/components/schemas/design-duplicate-input',
        },
        {
          $ref: '#/components/schemas/design-common-fields',
        },
        {
          properties: {
            html_content: {
              description: 'The HTML content of the Design.',
              maxLength: 1048576,
              type: 'string',
            },
            plain_content: {
              default: '<generated from html_content if left empty>',
              description: 'Plain text content of the Design.',
              maxLength: 1048576,
              type: 'string',
            },
          },
          required: ['html_content'],
          type: 'object',
        },
      ],
      example: {
        editor: 'design',
        html_content:
          '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">\n<html data-editor-version="2" class="sg-campaigns" xmlns="http://www.w3.org/1999/xhtml">\n    <head>\n      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n      <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1">\n      <!--[if !mso]><!-->\n      <meta http-equiv="X-UA-Compatible" content="IE=Edge">\n      <!--<![endif]-->\n      <!--[if (gte mso 9)|(IE)]>\n      <xml>\n        <o:OfficeDocumentSettings>\n          <o:AllowPNG/>\n          <o:PixelsPerInch>96</o:PixelsPerInch>\n        </o:OfficeDocumentSettings>\n      </xml>\n      <![endif]-->\n      <!--[if (gte mso 9)|(IE)]>\n  <style type="text/css">\n    body {width: 600px;margin: 0 auto;}\n    table {border-collapse: collapse;}\n    table, td {mso-table-lspace: 0pt;mso-table-rspace: 0pt;}\n    img {-ms-interpolation-mode: bicubic;}\n  </style>\n<![endif]-->\n      <style type="text/css">\n    body, p, div {\n      font-family: arial,helvetica,sans-serif;\n      font-size: 14px;\n    }\n    body {\n      color: #000000;\n    }\n    body a {\n      color: #1188E6;\n      text-decoration: none;\n    }\n    p { margin: 0; padding: 0; }\n    table.wrapper {\n      width:100% !important;\n      table-layout: fixed;\n      -webkit-font-smoothing: antialiased;\n      -webkit-text-size-adjust: 100%;\n      -moz-text-size-adjust: 100%;\n      -ms-text-size-adjust: 100%;\n    }\n    img.max-width {\n      max-width: 100% !important;\n    }\n    .column.of-2 {\n      width: 50%;\n    }\n    .column.of-3 {\n      width: 33.333%;\n    }\n    .column.of-4 {\n      width: 25%;\n    }\n    ul ul ul ul  {\n      list-style-type: disc !important;\n    }\n    ol ol {\n      list-style-type: lower-roman !important;\n    }\n    ol ol ol {\n      list-style-type: lower-latin !important;\n    }\n    ol ol ol ol {\n      list-style-type: decimal !important;\n    }\n    @media screen and (max-width:480px) {\n      .preheader .rightColumnContent,\n      .footer .rightColumnContent {\n        text-align: left !important;\n      }\n      .preheader .rightColumnContent div,\n      .preheader .rightColumnContent span,\n      .footer .rightColumnContent div,\n      .footer .rightColumnContent span {\n        text-align: left !important;\n      }\n      .preheader .rightColumnContent,\n      .preheader .leftColumnContent {\n        font-size: 80% !important;\n        padding: 5px 0;\n      }\n      table.wrapper-mobile {\n        width: 100% !important;\n        table-layout: fixed;\n      }\n      img.max-width {\n        height: auto !important;\n        max-width: 100% !important;\n      }\n      a.bulletproof-button {\n        display: block !important;\n        width: auto !important;\n        font-size: 80%;\n        padding-left: 0 !important;\n        padding-right: 0 !important;\n      }\n      .columns {\n        width: 100% !important;\n      }\n      .column {\n        display: block !important;\n        width: 100% !important;\n        padding-left: 0 !important;\n        padding-right: 0 !important;\n        margin-left: 0 !important;\n        margin-right: 0 !important;\n      }\n      .social-icon-column {\n        display: inline-block !important;\n      }\n    }\n  </style>\n      <!--user entered Head Start--><!--End Head user entered-->\n    </head>\n    <body>\n      <center class="wrapper" data-link-color="#1188E6" data-body-style="font-size:14px; font-family:arial,helvetica,sans-serif; color:#000000; background-color:#FFFFFF;">\n        <div class="webkit">\n          <table cellpadding="0" cellspacing="0" border="0" width="100%" class="wrapper" bgcolor="#FFFFFF">\n            <tr>\n              <td valign="top" bgcolor="#FFFFFF" width="100%">\n                <table width="100%" role="content-container" class="outer" align="center" cellpadding="0" cellspacing="0" border="0">\n                  <tr>\n                    <td width="100%">\n                      <table width="100%" cellpadding="0" cellspacing="0" border="0">\n                        <tr>\n                          <td>\n                            <!--[if mso]>\n    <center>\n    <table><tr><td width="600">\n  <![endif]-->\n                                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px;" align="center">\n                                      <tr>\n                                        <td role="modules-container" style="padding:0px 0px 0px 0px; color:#000000; text-align:left;" bgcolor="#FFFFFF" width="100%" align="left"><table class="module preheader preheader-hide" role="module" data-type="preheader" border="0" cellpadding="0" cellspacing="0" width="100%" style="display: none !important; mso-hide: all; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0;">\n    <tr>\n      <td role="module-content">\n        <p></p>\n      </td>\n    </tr>\n  </table><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="41f90842-501c-4f08-96c9-17c0f74cb841" data-mc-module-version="2019-10-22">\n    <tbody>\n      <tr>\n        <td style="padding:18px 0px 18px 0px; line-height:22px; text-align:inherit;" height="100%" valign="top" bgcolor="" role="module-content"><div><div style="font-family: inherit; text-align: inherit">Ahoy, World!</div><div></div></div></td>\n      </tr>\n    </tbody>\n  </table><div data-role="module-unsubscribe" class="module" role="module" data-type="unsubscribe" style="color:#444444; font-size:12px; line-height:20px; padding:16px 16px 16px 16px; text-align:Center;" data-muid="4e838cf3-9892-4a6d-94d6-170e474d21e5"><div class="Unsubscribe--addressLine"><p class="Unsubscribe--senderName" style="font-size:12px; line-height:20px;">{{Sender_Name}}</p><p style="font-size:12px; line-height:20px;"><span class="Unsubscribe--senderAddress">{{Sender_Address}}</span>, <span class="Unsubscribe--senderCity">{{Sender_City}}</span>, <span class="Unsubscribe--senderState">{{Sender_State}}</span> <span class="Unsubscribe--senderZip">{{Sender_Zip}}</span></p></div><p style="font-size:12px; line-height:20px;"><a class="Unsubscribe--unsubscribeLink" href="{{{unsubscribe}}}" target="_blank" style="">Unsubscribe</a> - <a href="{{{unsubscribe_preferences}}}" target="_blank" class="Unsubscribe--unsubscribePreferences" style="">Unsubscribe Preferences</a></p></div></td>\n                                      </tr>\n                                    </table>\n                                    <!--[if mso]>\n                                  </td>\n                                </tr>\n                              </table>\n                            </center>\n                            <![endif]-->\n                          </td>\n                        </tr>\n                      </table>\n                    </td>\n                  </tr>\n                </table>\n              </td>\n            </tr>\n          </table>\n        </div>\n      </center>\n    </body>\n  </html>',
        name: 'Ahoy, World!',
        plain_content:
          'Ahoy, World!\n\n{{Sender_Name}}\n\n{{Sender_Address}} , {{Sender_City}} , {{Sender_State}} {{Sender_Zip}}\n\nUnsubscribe ( {{{unsubscribe}}} ) - Unsubscribe Preferences ( {{{unsubscribe_preferences}}} )',
        subject: 'Getting Started',
      },
      title: 'Design Input',
    },
    'design-output': {
      allOf: [
        {
          $ref: '#/components/schemas/design-output-summary',
        },
        {
          $ref: '#/components/schemas/design-input',
        },
      ],
      title: 'Design Output',
    },
    'design-output-summary': {
      allOf: [
        {
          properties: {
            created_at: {
              description: 'Datetime that Design was created.',
              format: 'ISO 8601 date-time',
              type: 'string',
            },
            id: {
              description: 'ID of the Design.',
              format: 'uuid',
              type: 'string',
            },
            thumbnail_url: {
              description: "A Thumbnail preview of the template's html content.",
              type: 'string',
            },
            updated_at: {
              description: 'Datetime that Design was last updated.',
              format: 'ISO 8601 date-time',
              type: 'string',
            },
          },
          type: 'object',
        },
        {
          $ref: '#/components/schemas/design-duplicate-input',
        },
        {
          $ref: '#/components/schemas/design-common-fields',
        },
      ],
      example: {
        _metadata: {
          count: 3,
          self: 'https://api.sendgrid.com/v3/designs?page_token=vHdvHCg0w1F-TmWJcPNpTEnFY2aPEmRBHONwOgZ6TgJbX2_I',
        },
        result: [
          {
            categories: ['welcome', 'new customer'],
            created_at: '2021-04-09T17:29:46Z',
            editor: 'code',
            generate_plain_content: true,
            id: '3247eaea-c912-42a3-b0bc-60bdaf210396',
            name: 'Welcome Email',
            subject: 'Welcom to the Cake or Pie Cafe',
            thumbnail_url:
              '//us-east-2-production-thumbnail-bucket.s3.amazonaws.com/llny8o5b3m636z92p7hbjnmq1jvpka39p370jwtin2s1wxv7x1sgm0y5fk518d0s.png',
            updated_at: '2021-04-09T17:29:55Z',
          },
          {
            categories: ['promo', 'coupon'],
            created_at: '2021-04-09T17:29:21Z',
            editor: 'design',
            generate_plain_content: true,
            id: '02dfd792-f31f-439a-a79e-5c47fbcfdbac',
            name: 'Monthly Promo',
            subject: 'Free Dozen Cupcakes',
            thumbnail_url:
              '//us-east-2-production-thumbnail-bucket.s3.amazonaws.com/hfyxahd7ues2ajuoeoqq2xe6ibdasl1q89ox0y9ncya2ftpoicssmtf9ddus4c39.png',
            updated_at: '2021-04-09T17:29:42Z',
          },
          {
            categories: [],
            created_at: '2020-10-09T17:33:46Z',
            editor: 'design',
            generate_plain_content: true,
            id: 'e54be823-19ef-4c6f-8b60-efd7514f492d',
            name: 'Duplicate: Ingrid & Anders',
            subject: 'Welcome to Ingrid & Anders!',
            thumbnail_url:
              '//us-east-2-production-thumbnail-bucket.s3.amazonaws.com/12kni9gjpyb9uxmwr9vk7unycjr70u95zoyhe9sg2zounul2zg7dih1s20k13q2z.png',
            updated_at: '2021-04-07T19:57:52Z',
          },
        ],
      },
      title: 'Design Output - Summary',
    },
    'domain-authentication-200-response': {
      example: [
        {
          automatic_security: true,
          custom_spf: true,
          default: true,
          dns: {
            dkim1: {
              data: 's1._domainkey.u7.wl.sendgrid.net',
              host: 's1._domainkey.example.com',
              type: 'cname',
              valid: true,
            },
            dkim2: {
              data: 's2._domainkey.u7.wl.sendgrid.net',
              host: 's2._domainkey.example.com',
              type: 'cname',
              valid: true,
            },
            mail_cname: {
              data: 'u7.wl.sendgrid.net',
              host: 'mail.example.com',
              type: 'cname',
              valid: true,
            },
          },
          domain: 'example.com',
          id: 1,
          ips: ['192.168.1.1', '192.168.1.2'],
          legacy: false,
          subdomain: 'mail',
          user_id: 7,
          username: 'jane@example.com',
          valid: true,
        },
        {
          automatic_security: true,
          custom_spf: false,
          default: true,
          dns: {
            dkim1: {
              data: 'k=rsa; t=s; p=publicKey',
              host: 'example2.com',
              type: 'txt',
              valid: false,
            },
            dkim2: {
              data: 'k=rsa; t=s p=publicKey',
              host: 'example2.com',
              type: 'txt',
              valid: false,
            },
            mail_cname: {
              data: 'sendgrid.net',
              host: 'news.example2.com',
              type: 'mx',
              valid: false,
            },
          },
          domain: 'example2.com',
          id: 2,
          ips: [],
          legacy: false,
          subdomain: 'new',
          user_id: 8,
          username: 'john@example2.com',
          valid: false,
        },
      ],
      items: {
        allOf: [
          {
            $ref: '#/components/schemas/authentication_domain',
          },
          {
            properties: {
              last_validation_attempt_at: {
                description: 'A Unix epoch timestamp representing the last time of a validation attempt.',
                type: 'integer',
              },
              subusers: {
                items: {
                  properties: {
                    user_id: {
                      description: 'The ID of the subuser that this authenticated domain will be associated with.',
                      type: 'integer',
                    },
                    username: {
                      description: 'The username of the subuser that this authenticated domain is associated with.',
                      type: 'string',
                    },
                  },
                  type: 'object',
                },
                type: 'array',
              },
            },
            type: 'object',
          },
        ],
      },
      title: 'Domain Authentication 200 Response',
      type: 'array',
    },
    domain_authentication_domain_spf: {
      properties: {
        automatic_security: {
          description: 'Indicates if this authenticated domain uses automated security.',
          type: 'boolean',
        },
        custom_spf: {
          description: 'Indicates if this authenticated domain uses custom SPF.',
          type: 'boolean',
        },
        default: {
          description: 'Indicates if this is the default domain.',
          type: 'boolean',
        },
        dns: {
          description: 'The DNS records for this authenticated domain.',
          properties: {
            dkim: {
              description: 'The DKIM record for messages sent using this authenticated domain.',
              properties: {
                data: {
                  description: 'The DKIM record.',
                  type: 'string',
                },
                host: {
                  description: 'The DNS labels for the DKIM signature.',
                  type: 'string',
                },
                type: {
                  description: 'The type of data in the DKIM record.',
                  type: 'string',
                },
                valid: {
                  description: 'Indicates if the DKIM record is valid.',
                  type: 'boolean',
                },
              },
              required: ['host', 'type', 'data', 'valid'],
              type: 'object',
            },
            domain_spf: {
              description: 'The SPF record for the root domain.',
              properties: {
                data: {
                  description: 'The SPF record.',
                  type: 'string',
                },
                host: {
                  description: 'The root domain that this SPF record will be used to authenticate.',
                  type: 'string',
                },
                type: {
                  description: 'The type of data in the SPF record.',
                  type: 'string',
                },
                valid: {
                  description: 'Indicates if the SPF record is valid.',
                  type: 'boolean',
                },
              },
              required: ['host', 'type', 'data', 'valid'],
              type: 'object',
            },
            mail_server: {
              description: 'Designates which mail server is responsible for accepting messages from a domain.',
              properties: {
                data: {
                  description: 'The mail server responsible for accepting messages from the sending domain.',
                  type: 'string',
                },
                host: {
                  description: 'The domain sending the messages.',
                  type: 'string',
                },
                type: {
                  description: 'They type of DNS record.',
                  type: 'string',
                },
                valid: {
                  description: 'Indicates if this is a valid DNS record.',
                  type: 'boolean',
                },
              },
              required: ['host', 'type', 'data', 'valid'],
              type: 'object',
            },
            subdomain_spf: {
              description: 'The SPF record for the subdomain used to create this authenticated domain.',
              properties: {
                data: {
                  description: 'The SPF record.',
                  type: 'string',
                },
                host: {
                  description: 'The domain that this SPF record will be used to authenticate.',
                  type: 'string',
                },
                type: {
                  description: 'The type of data in the SPF record.',
                  type: 'string',
                },
                valid: {
                  description: 'Indicates if this is a valid SPF record.',
                  type: 'boolean',
                },
              },
              required: ['host', 'type', 'data', 'valid'],
              type: 'object',
            },
          },
          required: ['mail_server', 'subdomain_spf', 'domain_spf', 'dkim'],
          type: 'object',
        },
        domain: {
          description: 'The domain authenticated.',
          type: 'string',
        },
        id: {
          description: 'The ID of the authenticated domain.',
          type: 'integer',
        },
        ips: {
          description: 'The IP addresses that are included in the SPF record for this authenticated domain.',
          items: {},
          type: 'array',
        },
        legacy: {
          description:
            "Indicates if this authenticated domain was created using the legacy whitelabel tool. If it is a legacy whitelabel, it will still function, but you'll need to create a new authenticated domain if you need to update it.",
          type: 'boolean',
        },
        subdomain: {
          description: 'The subdomain that was used to create this authenticated domain.',
          type: 'string',
        },
        user_id: {
          description: 'The user_id of the account that this authenticated domain is associated with.',
          type: 'integer',
        },
        username: {
          description: 'The username of the account that this authenticated domain is associated with.',
          type: 'string',
        },
        valid: {
          description: 'Indicates if this is a valid authenticated domain .',
          type: 'boolean',
        },
      },
      required: [
        'id',
        'domain',
        'username',
        'user_id',
        'ips',
        'custom_spf',
        'default',
        'legacy',
        'automatic_security',
        'valid',
        'dns',
      ],
      title: 'Domain Authentication',
      type: 'object',
    },
    'email-activity-response-common-fields': {
      properties: {
        from_email: {
          default: '',
          description:
            "The 'From' email address used to deliver the message. This address should be a verified sender in your Twilio SendGrid account.",
          format: 'email',
          type: 'string',
        },
        msg_id: {
          description:
            'A unique ID assigned to the message. This ID can be used to retrieve activity data for the specific message.',
          type: 'string',
        },
        status: {
          description: "The message's status.",
          enum: ['processed', 'delivered', 'not delivered'],
          type: 'string',
        },
        subject: {
          description: "The email's subject line.",
          type: 'string',
        },
        to_email: {
          description: "The intended recipient's email address.",
          format: 'email',
          type: 'string',
        },
      },
      title: 'Email Activity Response Common Fields',
      type: 'object',
    },
    'enforced-tls-request-response': {
      example: {
        require_tls: true,
        require_valid_cert: true,
      },
      properties: {
        require_tls: {
          description: 'Indicates if you want to require your recipients to support TLS. ',
          type: 'boolean',
        },
        require_valid_cert: {
          description: 'Indicates if you want to require your recipients to have a valid certificate.',
          type: 'boolean',
        },
      },
      title: 'Enforced TLS Request Response',
      type: 'object',
    },
    error: {
      properties: {
        error_id: {
          type: 'string',
        },
        field: {
          type: 'string',
        },
        message: {
          type: 'string',
        },
        parameter: {
          type: 'string',
        },
      },
      required: ['message'],
      title: 'error',
      type: 'object',
    },
    errors: {
      description: 'If the request is incorrect, an array of errors will be returned.',
      properties: {
        errors: {
          items: {
            properties: {
              field: {
                nullable: true,
                type: 'string',
              },
              message: {
                description: 'A description of what is wrong with the field passed in the request.',
                nullable: true,
                type: 'string',
              },
              parameter: {
                description: 'The parameter in the request body that is incorrect.',
                type: 'string',
              },
            },
            required: ['parameter', 'message'],
            type: 'object',
          },
          type: 'array',
        },
      },
      required: ['errors'],
      title: 'Errors',
      type: 'object',
    },
    'errors-seg-v2': {
      description: 'If the request is incorrect, an array of errors will be returned.',
      properties: {
        errors: {
          items: {
            properties: {
              field: {
                description: 'the field in the request body that is incorrect',
                type: 'string',
              },
              message: {
                description: 'a description of what is specifically wrong with the field passed in the request',
                type: 'string',
              },
            },
            required: ['field', 'message'],
            type: 'object',
          },
          type: 'array',
        },
      },
      required: ['errors'],
      title: 'errors-seg',
      type: 'object',
    },
    'event-webhook-response': {
      properties: {
        bounce: {
          description: 'Receiving server could not or would not accept message.',
          type: 'boolean',
        },
        click: {
          description:
            'Recipient clicked on a link within the message. You need to enable Click Tracking for getting this type of event.',
          type: 'boolean',
        },
        deferred: {
          description: "Recipient's email server temporarily rejected message.",
          type: 'boolean',
        },
        delivered: {
          description: 'Message has been successfully delivered to the receiving server.',
          type: 'boolean',
        },
        dropped: {
          description:
            'You may see the following drop reasons: Invalid SMTPAPI header, Spam Content (if spam checker app enabled), Unsubscribed Address, Bounced Address, Spam Reporting Address, Invalid, Recipient List over Package Quota',
          type: 'boolean',
        },
        enabled: {
          description: 'Indicates if the event webhook is enabled.',
          type: 'boolean',
        },
        group_resubscribe: {
          description:
            'Recipient resubscribes to specific group by updating preferences. You need to enable Subscription Tracking for getting this type of event.',
          type: 'boolean',
        },
        group_unsubscribe: {
          description:
            'Recipient unsubscribe from specific group, by either direct link or updating preferences. You need to enable Subscription Tracking for getting this type of event.',
          type: 'boolean',
        },
        oauth_client_id: {
          description:
            'The client ID Twilio SendGrid sends to your OAuth server or service provider to generate an OAuth access token.',
          type: 'string',
        },
        oauth_token_url: {
          description:
            'The URL where Twilio SendGrid sends the Client ID and Client Secret to generate an access token. This should be your OAuth server or service provider.',
          type: 'string',
        },
        open: {
          description:
            'Recipient has opened the HTML message. You need to enable Open Tracking for getting this type of event.',
          type: 'boolean',
        },
        processed: {
          description: 'Message has been received and is ready to be delivered.',
          type: 'boolean',
        },
        spam_report: {
          description: 'Recipient marked a message as spam.',
          type: 'boolean',
        },
        unsubscribe: {
          description:
            "Recipient clicked on message's subscription management link. You need to enable Subscription Tracking for getting this type of event.",
          type: 'boolean',
        },
        url: {
          description: 'The URL that you want the event webhook to POST to.',
          type: 'string',
        },
      },
      required: [
        'enabled',
        'url',
        'group_resubscribe',
        'delivered',
        'group_unsubscribe',
        'spam_report',
        'bounce',
        'deferred',
        'unsubscribe',
        'processed',
        'open',
        'click',
        'dropped',
      ],
      title: 'Webhooks: Event Webhook Response',
      type: 'object',
    },
    'event-webhook-update-oauth-request': {
      properties: {
        bounce: {
          description: 'Receiving server could not or would not accept message.',
          type: 'boolean',
        },
        click: {
          description:
            'Recipient clicked on a link within the message. You need to enable Click Tracking for getting this type of event.',
          type: 'boolean',
        },
        deferred: {
          description: "Recipient's email server temporarily rejected message.",
          type: 'boolean',
        },
        delivered: {
          description: 'Message has been successfully delivered to the receiving server.',
          type: 'boolean',
        },
        dropped: {
          description:
            'You may see the following drop reasons: Invalid SMTPAPI header, Spam Content (if spam checker app enabled), Unsubscribed Address, Bounced Address, Spam Reporting Address, Invalid, Recipient List over Package Quota',
          type: 'boolean',
        },
        enabled: {
          description: 'Indicates if the event webhook is enabled.',
          type: 'boolean',
        },
        group_resubscribe: {
          description:
            'Recipient resubscribes to specific group by updating preferences. You need to enable Subscription Tracking for getting this type of event.',
          type: 'boolean',
        },
        group_unsubscribe: {
          description:
            'Recipient unsubscribe from specific group, by either direct link or updating preferences. You need to enable Subscription Tracking for getting this type of event.',
          type: 'boolean',
        },
        oauth_client_id: {
          description:
            'The client ID Twilio SendGrid sends to your OAuth server or service provider to generate an OAuth access token. When passing data in this field, you must also include the oauth_token_url field.',
          type: 'string',
        },
        oauth_client_secret: {
          description:
            'This secret is needed only once to create an access token. SendGrid will store this secret, allowing you to update your Client ID and Token URL without passing the secret to SendGrid again.  When passing data in this field, you must also include the oauth_client_id and oauth_token_url fields.',
          type: 'string',
        },
        oauth_token_url: {
          description:
            'The URL where Twilio SendGrid sends the Client ID and Client Secret to generate an access token. This should be your OAuth server or service provider. When passing data in this field, you must also include the oauth_client_id field.',
          type: 'string',
        },
        open: {
          description:
            'Recipient has opened the HTML message. You need to enable Open Tracking for getting this type of event.',
          type: 'boolean',
        },
        processed: {
          description: 'Message has been received and is ready to be delivered.',
          type: 'boolean',
        },
        spam_report: {
          description: 'Recipient marked a message as spam.',
          type: 'boolean',
        },
        unsubscribe: {
          description:
            "Recipient clicked on message's subscription management link. You need to enable Subscription Tracking for getting this type of event.",
          type: 'boolean',
        },
        url: {
          description: 'The URL that you want the event webhook to POST to.',
          type: 'string',
        },
      },
      required: [
        'enabled',
        'url',
        'group_resubscribe',
        'delivered',
        'group_unsubscribe',
        'spam_report',
        'bounce',
        'deferred',
        'unsubscribe',
        'processed',
        'open',
        'click',
        'dropped',
      ],
      title: 'Webhooks: Event Webhook Update with OAuth Request',
      type: 'object',
    },
    from_email_object: {
      example: {
        email: 'jane_doe@example.com',
        name: 'Jane Doe',
      },
      properties: {
        email: {
          description:
            "The 'From' email address used to deliver the message. This address should be a verified sender in your Twilio SendGrid account.",
          format: 'email',
          type: 'string',
        },
        name: {
          description: 'A name or title associated with the sending email address.',
          type: 'string',
        },
      },
      required: ['email'],
      title: 'From Email Object',
      type: 'object',
    },
    'full-segment': {
      allOf: [
        {
          $ref: '#/components/schemas/segment_summary',
        },
        {
          properties: {
            contacts_sample: {
              items: {
                $ref: '#/components/schemas/contact_response',
              },
              type: 'array',
            },
            query_json: {
              description: 'AST representation of the query DSL',
              type: 'object',
            },
          },
          required: ['contacts_sample'],
          type: 'object',
        },
        {
          $ref: '#/components/schemas/segment_write_v2',
        },
      ],
      example: {
        contacts_count: 9266921,
        contacts_sample: [
          {
            address_line_1: 'sunt aliqua',
            address_line_2: 'sit proident Lorem veniam labore',
            alternate_emails: [
              'yKDUP11FDch@QoU.vwy',
              'ZNSN5@czAMqPi.at',
              '7wr51kFVVKlcBSH@DWxOueOZepetzBrku.qosk',
              'iib-ObtO7Fxz5@vLJPRIFKPOqJGCEqcIDab.ypn',
            ],
            city: 'ȎţȸÛ\tč\u000bCŁ',
            contact_id: 'c1183ada-b784-49ac-9b1f-50e73578a6dc',
            country: 'do reprehenderit qui',
            custom_fields: {
              custom_field_name1: 'esse',
              custom_field_name2: 'in consectetur ut aliqua sint',
            },
            first_name: 'est',
            last_name: 'eiusmod in laboris velit cupidatat',
            postal_code: 30296612,
            primary_email: 'ft88@d.izxx',
            state_province_region: 'ut proident',
          },
        ],
        created_at: '2085-08-08T21:07:05.692Z',
        id: '58567a46-305e-48d1-b4f8-a006c906920e',
        name: 'culpa',
        next_sample_update: '',
        parent_list_id: '2357714d-3d82-4c80-826c-b44a4147f81c',
        query_dsl: 'cillum eiusmod',
        sample_updated_at: '3407-09-25T04:25:02.140Z',
        updated_at: '4431-05-07T22:23:22.352Z',
      },
      title: 'full_segment',
    },
    global_empty_request: {
      nullable: true,
      title: 'Global: Request Empty Body',
    },
    global_error_response_schema: {
      example: {
        errors: [
          {
            field: 'field_name',
            message: 'error message',
          },
        ],
      },
      properties: {
        errors: {
          items: {
            properties: {
              field: {
                description: 'the field that generated the error',
                nullable: true,
                type: 'string',
              },
              help: {
                description: 'helper text or docs for troubleshooting',
                type: 'object',
              },
              message: {
                description: 'the error message',
                type: 'string',
              },
            },
            required: ['message'],
            type: 'object',
          },
          type: 'array',
        },
        id: {
          type: 'string',
        },
      },
      title: 'Global Error Response Schema',
      type: 'object',
    },
    global_id: {
      title: 'Global: ID',
      type: 'integer',
    },
    google_analytics_settings: {
      example: {
        enabled: true,
        utm_campaign: 'website',
        utm_content: '',
        utm_medium: 'email',
        utm_source: 'sendgrid.com',
        utm_term: '',
      },
      properties: {
        enabled: {
          description: 'Indicates if Google Analytics is enabled.',
          type: 'boolean',
        },
        utm_campaign: {
          description: 'The name of the campaign.',
          type: 'string',
        },
        utm_content: {
          description: 'Used to differentiate ads',
          type: 'string',
        },
        utm_medium: {
          description: 'Name of the marketing medium (e.g. "Email").',
          type: 'string',
        },
        utm_source: {
          description: 'Name of the referrer source. ',
          type: 'string',
        },
        utm_term: {
          description: 'Any paid keywords.',
          type: 'string',
        },
      },
      title: 'Settings: Google Analytics',
      type: 'object',
    },
    'invalid-email': {
      example: {
        created: 1620141015,
        email: 'invalid@example.com',
        reason: 'Mail domain mentioned in email address is unknown',
      },
      properties: {
        created: {
          description: 'A Unix timestamp indicating when the email address was added to the invalid emails list.',
          type: 'integer',
        },
        email: {
          description: 'The email address that was marked as invalid.',
          format: 'email',
          type: 'string',
        },
        reason: {
          description: 'The reason that the email address was marked as invalid.',
          type: 'string',
        },
      },
      title: 'Invalid Email',
      type: 'object',
    },
    'ip-access-response': {
      example: {
        result: [
          {
            created_at: 1441824715,
            id: 1,
            ip: '192.168.1.1/32',
            updated_at: 1441824715,
          },
          {
            created_at: 1441824715,
            id: 2,
            ip: '192.0.0.0/8',
            updated_at: 1441824715,
          },
          {
            created_at: 1441824715,
            id: 3,
            ip: '192.168.1.3/32',
            updated_at: 1441824715,
          },
        ],
      },
      properties: {
        result: {
          description: 'An array listing all of your allowed IPs.',
          items: {
            properties: {
              created_at: {
                description: 'A Unix timestamp indicating when the IP was added to the allow list.',
                type: 'integer',
              },
              id: {
                description: 'The ID of the allowed IP.',
                type: 'integer',
              },
              ip: {
                description: 'The allowed IP.',
                type: 'string',
              },
              updated_at: {
                description: 'A Unix timestamp indicating when the IPs allow status was most recently updated.',
                type: 'integer',
              },
            },
            type: 'object',
          },
          type: 'array',
        },
      },
      title: 'IP Access Response',
      type: 'object',
    },
    ip_pool: {
      properties: {
        name: {
          description: 'The name of the IP pool.',
          maxLength: 64,
          type: 'string',
        },
      },
      required: ['name'],
      title: 'IP Pools: Pool',
      type: 'object',
    },
    ip_pool_response: {
      example: {
        name: 'sunt sint enim',
      },
      properties: {
        name: {
          description: 'The name of the IP pool.',
          type: 'string',
        },
      },
      title: 'IP Pools: Pool Resp',
      type: 'object',
    },
    ip_warmup_response: {
      example: [
        {
          ip: '0.0.0.0',
          start_date: 1409616000,
        },
      ],
      items: {
        properties: {
          ip: {
            description: 'The IP address.',
            type: 'string',
          },
          start_date: {
            description: 'A Unix timestamp indicating when the IP address entered warmup mode.',
            type: 'integer',
          },
        },
        required: ['ip', 'start_date'],
        type: 'object',
      },
      title: 'IP Warmup: IP',
      type: 'array',
    },
    link: {
      properties: {
        href: {
          type: 'string',
        },
        rel: {
          type: 'string',
        },
      },
      title: 'Link',
      type: 'object',
    },
    'link-tracking-metadata': {
      properties: {
        count: {
          description: 'The number of items in the entire list, i.e., across all pages.',
          type: 'number',
        },
        next: {
          description:
            "The URL of the next page of results. If this field isn't present, you're at the end of the list.",
          format: 'uri',
          type: 'string',
        },
        prev: {
          description:
            "The URL of the previous page of results. If this field isn't present, you're at the start of the list.",
          format: 'uri',
          type: 'string',
        },
        self: {
          description: 'The URL of the current page of results.',
          format: 'uri',
          type: 'string',
        },
      },
      title: 'link tracking metadata',
      type: 'object',
    },
    link_branding_200_response: {
      properties: {
        default: {
          description: 'Indicates if this is the default link branding.',
          enum: [true, false],
          type: 'boolean',
        },
        dns: {
          description: 'The DNS records generated for this link branding.',
          properties: {
            domain_cname: {
              description: 'The DNS record generated to point to your link branding subdomain.',
              properties: {
                data: {
                  description: 'The domain that the DNS record points to.',
                  type: 'string',
                },
                host: {
                  description: 'The domain that this link branding will use for the links in your email.',
                  type: 'string',
                },
                type: {
                  description: 'The type of DNS record that was generated.',
                  enum: ['cname', 'txt', 'mx'],
                  type: 'string',
                },
                valid: {
                  description: 'Indicates if the DNS record is valid.',
                  enum: [true, false],
                  type: 'boolean',
                },
              },
              required: ['valid', 'type', 'host', 'data'],
              type: 'object',
            },
            owner_cname: {
              description: 'The DNS record generated to verify who created the link branding.',
              properties: {
                data: {
                  description: 'The domain that the DNS record points to.',
                  type: 'string',
                },
                host: {
                  description:
                    'Used to verify the link branding. The subdomain of this domain is the ID of the user who created the link branding.',
                  type: 'string',
                },
                type: {
                  description: 'The type of DNS record generated.',
                  enum: ['cname', 'txt', 'mx'],
                  type: 'string',
                },
                valid: {
                  description: 'Indicates if the DNS record is valid.',
                  enum: [true, false],
                  type: 'boolean',
                },
              },
              required: ['valid', 'host', 'data'],
              type: 'object',
            },
          },
          required: ['domain_cname'],
          type: 'object',
        },
        domain: {
          description: 'The root domain of the branded link.',
          type: 'string',
        },
        id: {
          description: 'The ID of the branded link.',
          type: 'integer',
        },
        legacy: {
          description:
            "Indicates if this link branding was created using the legacy whitelabel tool. If it is a legacy whitelabel, it will still function, but you'll need to create new link branding if you need to update it.",
          enum: [true, false],
          type: 'boolean',
        },
        subdomain: {
          description:
            'The subdomain used to generate the DNS records for this link branding. This subdomain must be different from the subdomain used for your authenticated domain.',
          type: 'string',
        },
        user_id: {
          description: 'The ID of the user that this link branding is associated with.',
          type: 'integer',
        },
        username: {
          description: 'The username of the account that this link branding is associated with.',
          type: 'string',
        },
        valid: {
          description: 'Indicates if this link branding is valid.',
          enum: [true, false],
          type: 'boolean',
        },
      },
      required: ['id', 'domain', 'username', 'user_id', 'default', 'valid', 'legacy', 'dns'],
      title: 'Link Branding 200 Response',
      type: 'object',
    },
    list: {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/selfmetadata',
        },
        contact_count: {
          description: 'The number of contacts currently stored on the list.',
          type: 'integer',
        },
        id: {
          description: 'The generated ID for your list.',
          maxLength: 36,
          minLength: 36,
          type: 'string',
        },
        name: {
          description: 'The name you gave your list.',
          type: 'string',
        },
      },
      title: 'list',
      type: 'object',
    },
    mail_batch_id: {
      example: {
        batch_id: 'HkJ5yLYULb7Rj8GKSx7u025ouWVlMgAi',
      },
      properties: {
        batch_id: {
          pattern: '^[a-zA-Z0-9\\-\\_]',
          type: 'string',
        },
      },
      required: ['batch_id'],
      title: 'Mail Batch ID',
      type: 'object',
    },
    mail_settings_address_whitelabel: {
      example: {
        enabled: true,
        list: ['email1@example.com', 'example.com'],
      },
      properties: {
        enabled: {
          description: 'Indicates if you have an email address whitelist enabled. ',
          type: 'boolean',
        },
        list: {
          description: 'All email addresses that are currently on the whitelist.',
          items: {
            type: 'string',
          },
          type: 'array',
        },
      },
      title: 'Mail Settings: Address Whitelabel',
      type: 'object',
    },
    mail_settings_bounce_purge: {
      example: {
        enabled: false,
        hard_bounces: null,
        soft_bounces: 1234,
      },
      properties: {
        enabled: {
          description: 'Indicates if the bounce purge mail setting is enabled.',
          type: 'boolean',
        },
        hard_bounces: {
          description:
            'The number of days after which SendGrid will purge all contacts from your hard bounces suppression lists.',
          nullable: true,
          type: 'integer',
        },
        soft_bounces: {
          description:
            'The number of days after which SendGrid will purge all contacts from your soft bounces suppression lists.',
          nullable: true,
          type: 'integer',
        },
      },
      title: 'Mail Settings: Bounce Purge',
      type: 'object',
    },
    mail_settings_footer: {
      example: {
        enabled: true,
        html_content: 'Example HTML content',
        plain_content: 'Example plain content',
      },
      properties: {
        enabled: {
          description: 'Indicates if the Footer mail setting is currently enabled.',
          type: 'boolean',
        },
        html_content: {
          description: 'The custom HTML content of your email footer.',
          type: 'string',
        },
        plain_content: {
          description: 'The plain text content of your email footer.',
          type: 'string',
        },
      },
      title: 'Mail Settings: Footer',
      type: 'object',
    },
    mail_settings_forward_bounce: {
      example: {
        email: null,
        enabled: false,
      },
      properties: {
        email: {
          description: 'The email address that you would like your bounce reports forwarded to.',
          nullable: true,
          type: 'string',
        },
        enabled: {
          description: 'Indicates if the bounce forwarding mail setting is enabled.',
          type: 'boolean',
        },
      },
      title: 'Mail Settings: Forward Bounce',
      type: 'object',
    },
    mail_settings_forward_spam: {
      example: {
        email: '',
        enabled: true,
      },
      properties: {
        email: {
          description: 'The email address where you would like the spam reports to be forwarded.',
          type: 'string',
        },
        enabled: {
          description: 'Indicates if the Forward Spam setting is enabled.',
          type: 'boolean',
        },
      },
      title: 'Mail Settings: Forward Spam',
      type: 'object',
    },
    mail_settings_patch: {
      example: {
        email: 'email@example.com',
        enabled: true,
      },
      properties: {
        email: {
          description: 'The email address of the recipient.',
          type: 'string',
        },
        enabled: {
          description: 'Indicates if the mail setting is enabled.',
          type: 'boolean',
        },
      },
      title: 'Mail Settings: Patch',
      type: 'object',
    },
    mail_settings_template: {
      example: {
        enabled: false,
        html_content: '<p><% body %>Example</p>\n',
      },
      properties: {
        enabled: {
          description: 'Indicates if the legacy email template setting is enabled.',
          type: 'boolean',
        },
        html_content: {
          description: 'The HTML content that you want to use for your legacy email template.',
          type: 'string',
        },
      },
      title: 'Mail Settings: Template',
      type: 'object',
    },
    mako_event: {
      example: {
        bounce_type: 'blocked',
        event_name: 'bounced',
        http_user_agent: 'in tempor ex dolore est',
        mx_server: 'quis proident',
        processed: '2017-10-13T18:56:21Z',
        reason: 'some reason',
        url: 'http://3LX,MU}N=B8\'d,K}>bEma{l~!ad%peIF}y>qHfLPWQ$l9b\\!6.1H?$Z9H"il-_gZD>/JPYsGqH4x4_3v090TCtnFalXGFiAdooDxgrDAYNXShUywSxwYr8gKeyc/4sal4VJ3IxEWsG74V5MYQ0mz27jhy7n5DHsUtApQ6zXHS13uO5vYBlJHpJRfuT6/F5nIpkHre2w3eTtN7M6pg9V5stjnnsavKkzQxyTv15CMSDLFwR_BTZwofhWpyBU7B9ypYL79vT97N3LDZyoaM/fNsOLPIqfGBer_Mx9_StergbQYANyOmOSjR6pZof01ky/ZcNDhpu3CkSl4MTtQ3NMCX780pOKQ5SYIPigyvz9IC9WtrCNcOkTxdOPdY0_4MJU4EuTTPmGvO/14KaJCDjIjgrbIqpzuUEL5mET0t2VeVlwvtnOnlHaBE8sic20ze2E0Xt3ETqXyzVJRjLDKh/LWkW8OVp_xkLBCCW7LQngRukKcOiWjMXeCEhYI9HoZ0RsMEWZC8KzRaHc4OI0uXPD4M9pav1LGrI/_0t_RnBnfnqGKsBJr0kdQi/Y6QN_aeawIqX5hDNIU3MF/wWKVWLS0ZFbDfK6KVv5oAid83EpwKoazAMA8MTfEXvHQLO7k7XYWX1Il3eGXL6/wCA96I1SOabzJkZHo2HsFpIC/VBk52Lnpp0xtDH/OCdlQ5e4PpxXQeklp70LPOndr7QKSYEQNUc48n36ixvTjhgpgO8wHsFFYqGcuBMHg9oaCARppQomiQDWYuVPVDynJHdsM1_gWl4/NSs8Y9PL7DrQXOu0UiFRRE0TUsvgqyUgJzlGjUnRziyYeROO75D0K_3aTtbGbCmhaxecos40a1w0PDCNkFp1W/iHwY7922drhsoM6ShwqqwGpAh5HLuU6Q5gqyckeai6YN7HCh9DdHPhhJcatgtMHZDKfQUBVt9ecUlDgiCFF_OnRX/GpzttcsL8E2FoXL9_eAWvSqjodROqx7MZCA/ORdnR/IssPCYP1kTHTIL5mZxv4UGEpyNjUzt4GdSJJTm0nztltWDYX8_Ezl2JvpLVnGVTJxobb4yQIJhe3n64khbOFyFLKHWEniIolm/AxpZQYmseWlVqrIz3YXU59XaSbTTrdCHNhvwF1ogXiiggN6TZ2B3QY_mBEtAp/SD0ONPVqEUkTNAFWTgnnlv6ZIMdMbTw5uZwtFRlB7qDvQouml9kujGmRu6k7zZMTOwWowRNtpboLUcL2NzkVgK6N1Zi2vq/Nt4NJvM5_l1dpIIbwJv_CIcZQZOqPtRWULa2iVxfmJJQaqgLQPwSHQH1zuRJMhraEsPjqVQRC0pZpSt/24VBDN8y31Ye/y_ekWxMdZCvr978C/WrdcTi29kxjJLyT9BII7BsgT5vLuI2l7ntqRAhAUWMs/h9JR0i8RbX5OfB46q41/TfmSdgi97bCR2HfgflyypXwKhRfKYU2MVpu2Dd90WQUlm7hZV8dSfGusuMj/nPMpRVWcbnvlAdsehJCPbLv6n4qdLSPeoMBo32acAGgu1BwBG8JsBgbH43yYi5X7UdGRWKqm_ZbqaDEKH3ncU/uA8EOJb41VfGho4LUeOi1IeYwVAhFEyO6YbteYZecEubrNFZrWWjZUqhzouzY95TeWU8E4StCXVPKlYPiFiwUSX20kG0lVtDbAy/7u4f4x0cYlFOvI1UN1qoOExmNxnxzQQFeM5exWfW2JrRXq5e0UdAJr4q2o9Y_0WaGfhL/nP6Ei06YajDKr11dK5H0LX/9CGTC37HFZeopyopzP_7fvGFkqIRoGTS48pLaIFz3gwpQNlWXUFCsd/PnRlsqJ3SBQSgp_AQe2cP6iBNy2bJI8lkxwY5YVDDdjxusuCcafdjfs2aUa/4tr_iMnNBnd27GxjQI28_JGJlfbOaajVJOxuPMT4ELpYCfPiFjdSbJyE0/gCwtj0rgDKSLWJnOPJ5TAJ935gCqeIsBhOhfcZX413GdilBZRRYEjCVKfOuWzHZ3GW/8yjyk5e_WMNv5F6xggl07w90DBwpx/Q/iWfncqMuSfoeFeqHQkDL9F5W19j1cGuAcyfIYMAXztHXpgTKh9vZcsLYC7LcgKr4FQj3JjEvtnDG2PjcMjGF/MnbCRCz22Ho410_vE9M1Hpq0wdk_i5DbZKNoSwlPgey9URkpuX146TcDdsx_VWDenCepY5HwMr9CPOY9hzUs/c5AWeUMXk/gvsI81Jkv5rHpEnNBUZXYzfqkwQfffhmrc/StLCtzRRlja8dpsEWdkzoKR9Kdxq1qAs5f0sdrGjVRLTT_s1Q2P59zhA/QmS4bubi64cYot3gSIgdNnkjA2GjCp1ETVa548_U9B6boTKDVmaKJlVIDvqL84RC3WI7Er/8opi2lZ48W83Ur47BRh38oOnI0agrCyZz8bp1w_gfVRlSO8PS0i/l_/qxq5xpLbhPkdxVoyZVsNAZchfnmkIHyIk5IK6EUDXdMR21y6OvKW50ZbooAtk9ymynBj4dAYMsd25RV7FE1I1vRTsiDw52/.E5WC0Ymo2zn.qelSbhzr-4laArYiWP.dwJB6qm_6rs0Rm5UXYaYtUNbh76_jJp_X1xQUCDSgbr2KOkDU0"Q/-4dV"Yk3QGg[(O86=Pf"e17K4\'r{)kicofHSXcMmP@>VF^`~4j4F*L/1]tD+Lw!WI!@]*OZm6C`M$u96}*O<U;_cZ84k.|nIqpAaeiroItOenDBL',
      },
      properties: {
        attempt_num: {
          description:
            'Used with "deferred" events to indicate the attempt number out of 10. One "deferred" entry will exists under events array for each time a message was deferred with error message from the server. ',
          maximum: 10,
          minimum: 1,
          type: 'integer',
        },
        bounce_type: {
          description: 'Use to distinguish between types of bounces',
          enum: ['bounced', 'blocked', 'expired'],
          type: 'string',
        },
        event_name: {
          description: 'Name of event',
          enum: [
            'bounced',
            'opened',
            'clicked',
            'processed',
            'dropped',
            'delivered',
            'deferred',
            'spam_report',
            'unsubscribe',
            'group_unsubscribe',
            'group_resubscribe',
          ],
          type: 'string',
        },
        http_user_agent: {
          description: 'Client recipient used to click or open message',
          type: 'string',
        },
        mx_server: {
          description: 'For example mx.gmail.com',
          type: 'string',
        },
        processed: {
          description: 'Date of when event occurred',
          type: 'string',
        },
        reason: {
          description:
            'Explanation of what caused "bounced", "deferred", or "blocked". Usually contains error message from the server - e.g. message from gmail why mail was deferred',
          maxLength: 1024,
          type: 'string',
        },
        url: {
          description: 'Used with "clicked" event to indicate which url the user clicked.',
          pattern: '^((http[s]?|ftp):\\/)?\\/?([^:\\/\\s]+)((\\/\\w+)*\\/)([\\w\\-\\.]+[^#?\\s]+)(.*)?(#[\\w\\-]+)?$',
          type: 'string',
        },
      },
      required: ['event_name', 'processed', 'url', 'bounce_type', 'http_user_agent', 'mx_server'],
      title: 'Event',
      type: 'object',
    },
    message: {
      example: {
        api_key_id: 'sdfsdfsdf123',
        asm_group_id: 11376349,
        categories: ['hi', 'bye'],
        events: [
          {
            event_name: 'bounced',
            processed: 1492453589,
            server_response: 'some error message',
          },
        ],
        from_email: 'test@test.com',
        msg_id: 'in aliquip id aliqua',
        originating_ip: '2.3.4.5',
        outbound_ip: '1.2.3.4',
        outbound_ip_type: 'dedicated',
        status: 'not delivered',
        subject: 'est incididunt adipisicing pariatur',
        teammate: '',
        template_id: '123e4567-e89b-12d3-a456-426655440000',
        to_email: 'send@test.com',
        unique_args: "{'key': 'value'}",
      },
      properties: {
        api_key_id: {
          maxLength: 50,
          minLength: 3,
          pattern: '^[A-Za-z0-9]+',
          type: 'string',
        },
        asm_group_id: {
          minimum: 1,
          type: 'integer',
        },
        categories: {
          description: 'Categories users associated to the message',
          items: {
            type: 'string',
          },
          type: 'array',
        },
        events: {
          description: 'List of events related to email message',
          items: {
            example: {
              bounce_type: 'blocked',
              event_name: 'bounced',
              http_user_agent: 'in tempor ex dolore est',
              mx_server: 'quis proident',
              processed: '2017-10-13T18:56:21Z',
              reason: 'some reason',
              url: 'http://3LX,MU}N=B8\'d,K}>bEma{l~!ad%peIF}y>qHfLPWQ$l9b\\!6.1H?$Z9H"il-_gZD>/JPYsGqH4x4_3v090TCtnFalXGFiAdooDxgrDAYNXShUywSxwYr8gKeyc/4sal4VJ3IxEWsG74V5MYQ0mz27jhy7n5DHsUtApQ6zXHS13uO5vYBlJHpJRfuT6/F5nIpkHre2w3eTtN7M6pg9V5stjnnsavKkzQxyTv15CMSDLFwR_BTZwofhWpyBU7B9ypYL79vT97N3LDZyoaM/fNsOLPIqfGBer_Mx9_StergbQYANyOmOSjR6pZof01ky/ZcNDhpu3CkSl4MTtQ3NMCX780pOKQ5SYIPigyvz9IC9WtrCNcOkTxdOPdY0_4MJU4EuTTPmGvO/14KaJCDjIjgrbIqpzuUEL5mET0t2VeVlwvtnOnlHaBE8sic20ze2E0Xt3ETqXyzVJRjLDKh/LWkW8OVp_xkLBCCW7LQngRukKcOiWjMXeCEhYI9HoZ0RsMEWZC8KzRaHc4OI0uXPD4M9pav1LGrI/_0t_RnBnfnqGKsBJr0kdQi/Y6QN_aeawIqX5hDNIU3MF/wWKVWLS0ZFbDfK6KVv5oAid83EpwKoazAMA8MTfEXvHQLO7k7XYWX1Il3eGXL6/wCA96I1SOabzJkZHo2HsFpIC/VBk52Lnpp0xtDH/OCdlQ5e4PpxXQeklp70LPOndr7QKSYEQNUc48n36ixvTjhgpgO8wHsFFYqGcuBMHg9oaCARppQomiQDWYuVPVDynJHdsM1_gWl4/NSs8Y9PL7DrQXOu0UiFRRE0TUsvgqyUgJzlGjUnRziyYeROO75D0K_3aTtbGbCmhaxecos40a1w0PDCNkFp1W/iHwY7922drhsoM6ShwqqwGpAh5HLuU6Q5gqyckeai6YN7HCh9DdHPhhJcatgtMHZDKfQUBVt9ecUlDgiCFF_OnRX/GpzttcsL8E2FoXL9_eAWvSqjodROqx7MZCA/ORdnR/IssPCYP1kTHTIL5mZxv4UGEpyNjUzt4GdSJJTm0nztltWDYX8_Ezl2JvpLVnGVTJxobb4yQIJhe3n64khbOFyFLKHWEniIolm/AxpZQYmseWlVqrIz3YXU59XaSbTTrdCHNhvwF1ogXiiggN6TZ2B3QY_mBEtAp/SD0ONPVqEUkTNAFWTgnnlv6ZIMdMbTw5uZwtFRlB7qDvQouml9kujGmRu6k7zZMTOwWowRNtpboLUcL2NzkVgK6N1Zi2vq/Nt4NJvM5_l1dpIIbwJv_CIcZQZOqPtRWULa2iVxfmJJQaqgLQPwSHQH1zuRJMhraEsPjqVQRC0pZpSt/24VBDN8y31Ye/y_ekWxMdZCvr978C/WrdcTi29kxjJLyT9BII7BsgT5vLuI2l7ntqRAhAUWMs/h9JR0i8RbX5OfB46q41/TfmSdgi97bCR2HfgflyypXwKhRfKYU2MVpu2Dd90WQUlm7hZV8dSfGusuMj/nPMpRVWcbnvlAdsehJCPbLv6n4qdLSPeoMBo32acAGgu1BwBG8JsBgbH43yYi5X7UdGRWKqm_ZbqaDEKH3ncU/uA8EOJb41VfGho4LUeOi1IeYwVAhFEyO6YbteYZecEubrNFZrWWjZUqhzouzY95TeWU8E4StCXVPKlYPiFiwUSX20kG0lVtDbAy/7u4f4x0cYlFOvI1UN1qoOExmNxnxzQQFeM5exWfW2JrRXq5e0UdAJr4q2o9Y_0WaGfhL/nP6Ei06YajDKr11dK5H0LX/9CGTC37HFZeopyopzP_7fvGFkqIRoGTS48pLaIFz3gwpQNlWXUFCsd/PnRlsqJ3SBQSgp_AQe2cP6iBNy2bJI8lkxwY5YVDDdjxusuCcafdjfs2aUa/4tr_iMnNBnd27GxjQI28_JGJlfbOaajVJOxuPMT4ELpYCfPiFjdSbJyE0/gCwtj0rgDKSLWJnOPJ5TAJ935gCqeIsBhOhfcZX413GdilBZRRYEjCVKfOuWzHZ3GW/8yjyk5e_WMNv5F6xggl07w90DBwpx/Q/iWfncqMuSfoeFeqHQkDL9F5W19j1cGuAcyfIYMAXztHXpgTKh9vZcsLYC7LcgKr4FQj3JjEvtnDG2PjcMjGF/MnbCRCz22Ho410_vE9M1Hpq0wdk_i5DbZKNoSwlPgey9URkpuX146TcDdsx_VWDenCepY5HwMr9CPOY9hzUs/c5AWeUMXk/gvsI81Jkv5rHpEnNBUZXYzfqkwQfffhmrc/StLCtzRRlja8dpsEWdkzoKR9Kdxq1qAs5f0sdrGjVRLTT_s1Q2P59zhA/QmS4bubi64cYot3gSIgdNnkjA2GjCp1ETVa548_U9B6boTKDVmaKJlVIDvqL84RC3WI7Er/8opi2lZ48W83Ur47BRh38oOnI0agrCyZz8bp1w_gfVRlSO8PS0i/l_/qxq5xpLbhPkdxVoyZVsNAZchfnmkIHyIk5IK6EUDXdMR21y6OvKW50ZbooAtk9ymynBj4dAYMsd25RV7FE1I1vRTsiDw52/.E5WC0Ymo2zn.qelSbhzr-4laArYiWP.dwJB6qm_6rs0Rm5UXYaYtUNbh76_jJp_X1xQUCDSgbr2KOkDU0"Q/-4dV"Yk3QGg[(O86=Pf"e17K4\'r{)kicofHSXcMmP@>VF^`~4j4F*L/1]tD+Lw!WI!@]*OZm6C`M$u96}*O<U;_cZ84k.|nIqpAaeiroItOenDBL',
            },
            properties: {
              attempt_num: {
                description:
                  'Used with "deferred" events to indicate the attempt number out of 10. One "deferred" entry will exists under events array for each time a message was deferred with error message from the server. ',
                maximum: 10,
                minimum: 1,
                type: 'integer',
              },
              bounce_type: {
                description: 'Use to distinguish between types of bounces',
                enum: ['bounced', 'blocked', 'expired'],
                type: 'string',
              },
              event_name: {
                description: 'Name of event',
                enum: [
                  'bounced',
                  'opened',
                  'clicked',
                  'processed',
                  'dropped',
                  'delivered',
                  'deferred',
                  'spam_report',
                  'unsubscribe',
                  'group_unsubscribe',
                  'group_resubscribe',
                ],
                type: 'string',
              },
              http_user_agent: {
                description: 'Client recipient used to click or open message',
                type: 'string',
              },
              mx_server: {
                description: 'For example mx.gmail.com',
                type: 'string',
              },
              processed: {
                description: 'Date of when event occurred',
                type: 'string',
              },
              reason: {
                description:
                  'Explanation of what caused "bounced", "deferred", or "blocked". Usually contains error message from the server - e.g. message from gmail why mail was deferred',
                maxLength: 1024,
                type: 'string',
              },
              url: {
                description: 'Used with "clicked" event to indicate which url the user clicked.',
                pattern:
                  '^((http[s]?|ftp):\\/)?\\/?([^:\\/\\s]+)((\\/\\w+)*\\/)([\\w\\-\\.]+[^#?\\s]+)(.*)?(#[\\w\\-]+)?$',
                type: 'string',
              },
            },
            required: ['event_name', 'processed', 'url', 'bounce_type', 'http_user_agent', 'mx_server'],
            title: 'Event',
            type: 'object',
          },
          type: 'array',
        },
        from_email: {
          pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b',
          type: 'string',
        },
        msg_id: {
          maxLength: 50,
          minLength: 5,
          pattern: '^[A-Za-z0-9]+',
          type: 'string',
        },
        originating_ip: {
          description: 'This is the IP of the user who sent the message.',
          format: 'ipv4',
          type: 'string',
        },
        outbound_ip: {
          description: 'IP used to send to the remote MTA. Used by UI to display IP in detailed view',
          format: 'ipv4',
          type: 'string',
        },
        outbound_ip_type: {
          description: 'Whether or not the outbound IP is dedicated vs shared',
          enum: ['dedicated', 'shared'],
          type: 'string',
        },
        status: {
          description: 'Quick summary of the status of a message',
          enum: ['processed', 'not delivered', 'delivered'],
          type: 'string',
        },
        subject: {
          maxLength: 255,
          minLength: 3,
          type: 'string',
        },
        teammate: {
          description: "Teammate's username",
          maxLength: 64,
          minLength: 0,
          pattern: '^$|^[A-Za-z0-9]+',
          type: 'string',
        },
        template_id: {
          format: 'uuid',
          type: 'string',
        },
        to_email: {
          pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b',
          type: 'string',
        },
        unique_args: {
          default: 'Null',
          description: 'JSON hash of arbitrary key-value pairs',
          type: 'string',
        },
      },
      required: [
        'from_email',
        'msg_id',
        'subject',
        'to_email',
        'status',
        'template_id',
        'asm_group_id',
        'teammate',
        'api_key_id',
        'events',
        'originating_ip',
        'categories',
        'unique_args',
        'outbound_ip',
        'outbound_ip_type',
      ],
      title: 'Message',
      type: 'object',
    },
    metadata: {
      properties: {
        count: {
          description: 'The number of items in the entire list, i.e., across all pages.',
          type: 'number',
        },
        next: {
          description:
            "The URL of the next page of results. If this field isn't present, you're at the end of the list.",
          format: 'uri',
          type: 'string',
        },
        prev: {
          description:
            "The URL of the previous page of results. If this field isn't present, you're at the start of the list.",
          format: 'uri',
          type: 'string',
        },
        self: {
          description: 'The URL of the current page of results.',
          format: 'uri',
          type: 'string',
        },
      },
      title: 'metadata',
      type: 'object',
    },
    metrics: {
      properties: {
        bounce_drops: {
          type: 'integer',
        },
        bounces: {
          type: 'integer',
        },
        clicks: {
          type: 'integer',
        },
        delivered: {
          type: 'integer',
        },
        invalid_emails: {
          type: 'integer',
        },
        opens: {
          type: 'integer',
        },
        requests: {
          type: 'integer',
        },
        spam_report_drops: {
          type: 'integer',
        },
        spam_reports: {
          type: 'integer',
        },
        unique_clicks: {
          type: 'integer',
        },
        unique_opens: {
          type: 'integer',
        },
        unsubscribes: {
          type: 'integer',
        },
      },
      required: [
        'bounce_drops',
        'bounces',
        'clicks',
        'delivered',
        'invalid_emails',
        'opens',
        'requests',
        'spam_report_drops',
        'spam_reports',
        'unique_clicks',
        'unique_opens',
        'unsubscribes',
      ],
      title: 'metrics',
      type: 'object',
    },
    monitor: {
      example: {
        email: 'example@example.com',
        frequency: 50000,
      },
      properties: {
        email: {
          description: 'The email address to which Sendgrid should send emails for monitoring.',
          format: 'email',
          type: 'string',
        },
        frequency: {
          description:
            'The frequency at which to forward monitoring emails. An email will be sent when your subuser sends this many (e.g., 1,000) emails.',
          type: 'number',
        },
      },
      required: ['email', 'frequency'],
      title: 'Create monitor settings request',
      type: 'object',
    },
    'parse-setting': {
      example: {
        hostname: 'myhostname.com',
        send_raw: true,
        spam_check: false,
        url: 'http://email.myhostname.com',
      },
      properties: {
        hostname: {
          description:
            'A specific and unique domain or subdomain that you have created to use exclusively to parse your incoming email. For example, `parse.yourdomain.com`.',
          type: 'string',
        },
        send_raw: {
          description:
            'Indicates if you would like SendGrid to post the original MIME-type content of your parsed email. When this parameter is set to `true`, SendGrid will send a JSON payload of the content of your email.',
          type: 'boolean',
        },
        spam_check: {
          description:
            'Indicates if you would like SendGrid to check the content parsed from your emails for spam before POSTing them to your domain.',
          type: 'boolean',
        },
        url: {
          description:
            'The public URL where you would like SendGrid to POST the data parsed from your email. Any emails sent with the given hostname provided (whose MX records have been updated to point to SendGrid) will be parsed and POSTed to this URL.',
          type: 'string',
        },
      },
      title: 'Parse Setting',
      type: 'object',
    },
    partner_settings_new_relic: {
      properties: {
        enable_subuser_statistics: {
          description: 'Indicates if your subuser statistics will be sent to your New Relic Dashboard.',
          type: 'boolean',
        },
        enabled: {
          description: 'Indicates if this setting is enabled. ',
          type: 'boolean',
        },
        license_key: {
          description: 'The license key provided with your New Relic account.',
          type: 'string',
        },
      },
      required: ['enabled', 'license_key'],
      title: 'Partner Settings: New Relic',
      type: 'object',
    },
    reply_to_email_object: {
      example: {
        email: 'jane_doe@example.com',
        name: 'Jane Doe',
      },
      properties: {
        email: {
          description: 'The email address where any replies or bounces will be returned.',
          format: 'email',
          type: 'string',
        },
        name: {
          description: 'A name or title associated with the `reply_to` email address.',
          type: 'string',
        },
      },
      required: ['email'],
      title: 'Reply_to Email Object',
      type: 'object',
    },
    reserved_field_definitions_response: {
      example: [
        {
          field_type: 'Text',
          id: '_rf20_T',
          name: 'automation_id',
          read_only: true,
        },
      ],
      items: {
        properties: {
          field_type: {
            enum: ['Text', 'Number', 'Date'],
            type: 'string',
          },
          name: {
            maxLength: 100,
            minLength: 1,
            type: 'string',
          },
          read_only: {
            default: false,
            description: 'When `true` this means API consumers are unable to set the value of this field on contacts.',
            type: 'boolean',
          },
        },
        type: 'object',
      },
      required: ['name', 'field_type'],
      title: 'reserved_field_definitions_response',
      type: 'array',
    },
    reverse_dns: {
      example: {
        a_record: {
          data: '192.168.1.1',
          host: 'o1.email.example.com',
          type: 'a',
          valid: true,
        },
        domain: 'example.com',
        id: 1,
        ip: '192.168.1.1',
        legacy: false,
        rdns: 'o1.email.example.com',
        subdomain: 'email',
        users: [
          {
            user_id: 7,
            username: 'john@example.com',
          },
          {
            user_id: 8,
            username: 'jane@example.com',
          },
        ],
        valid: true,
      },
      properties: {
        a_record: {
          properties: {
            data: {
              description: 'The IP address being set up with Reverse DNS.',
              type: 'string',
            },
            host: {
              description: 'This is the web address that will be mapped to the IP address.',
              type: 'string',
            },
            type: {
              description: 'The type of DNS record.',
              type: 'string',
            },
            valid: {
              description: 'Indicates if the a_record is valid.',
              type: 'boolean',
            },
          },
          required: ['valid', 'type', 'host', 'data'],
          type: 'object',
        },
        domain: {
          description: 'The root, or sending, domain.',
          type: 'string',
        },
        id: {
          description: 'The ID of the Reverse DNS.',
          type: 'integer',
        },
        ip: {
          description: 'The IP address that this Reverse DNS was created for.',
          type: 'string',
        },
        last_validation_attempt_at: {
          description: 'A Unix epoch timestamp representing the last time of a validation attempt.',
          type: 'integer',
        },
        legacy: {
          description:
            "Indicates if this Reverse DNS was created using the legacy whitelabel tool. If it is a legacy whitelabel, it will still function, but you'll need to create a new Reverse DNS if you need to update it.",
          type: 'boolean',
        },
        rdns: {
          description: 'The reverse DNS record for the IP address. This points to the Reverse DNS subdomain.',
          type: 'string',
        },
        subdomain: {
          description: 'The subdomain created for this reverse DNS. This is where the rDNS record points.',
          type: 'string',
        },
        users: {
          description: 'The users who are able to send mail from the IP address.',
          items: {
            properties: {
              user_id: {
                description: 'The ID of a user who can send mail from the IP address.',
                type: 'integer',
              },
              username: {
                description: 'The username of a user who can send mail from the IP address.',
                type: 'string',
              },
            },
            required: ['username', 'user_id'],
            type: 'object',
          },
          type: 'array',
        },
        valid: {
          description: 'Indicates if this is a valid Reverse DNS.',
          type: 'boolean',
        },
      },
      required: ['id', 'ip', 'rdns', 'users', 'domain', 'valid', 'legacy', 'a_record'],
      title: 'Reverse DNS',
      type: 'object',
    },
    segment_query_json: {
      properties: {
        contacts: {
          properties: {
            l: {
              properties: {
                l: {
                  properties: {
                    l: {
                      properties: {
                        t: {
                          type: 'string',
                        },
                        v: {
                          type: 'string',
                        },
                      },
                      type: 'object',
                    },
                    op: {
                      type: 'string',
                    },
                    r: {
                      properties: {
                        t: {
                          type: 'string',
                        },
                        v: {
                          type: 'string',
                        },
                      },
                      type: 'object',
                    },
                  },
                  type: 'object',
                },
                op: {
                  type: 'string',
                },
                r: {
                  properties: {
                    l: {
                      properties: {
                        args: {
                          items: {
                            properties: {
                              t: {
                                type: 'string',
                              },
                              v: {
                                type: 'string',
                              },
                            },
                            type: 'object',
                          },
                          type: 'array',
                        },
                        t: {
                          type: 'string',
                        },
                        v: {
                          type: 'string',
                        },
                      },
                      type: 'object',
                    },
                    op: {
                      type: 'string',
                    },
                    r: {
                      properties: {
                        t: {
                          type: 'string',
                        },
                        v: {
                          type: 'string',
                        },
                      },
                      type: 'object',
                    },
                  },
                  type: 'object',
                },
              },
              type: 'object',
            },
            op: {
              type: 'string',
            },
            r: {
              properties: {
                l: {
                  properties: {
                    t: {
                      type: 'string',
                    },
                    v: {
                      type: 'string',
                    },
                  },
                  type: 'object',
                },
                op: {
                  type: 'string',
                },
                r: {
                  properties: {
                    t: {
                      type: 'string',
                    },
                    v: {
                      items: {
                        type: 'string',
                      },
                      type: 'array',
                    },
                  },
                  type: 'object',
                },
              },
              type: 'object',
            },
          },
          type: 'object',
        },
      },
      title: 'segment_query_json',
      type: 'object',
    },
    segment_response: {
      properties: {
        contacts_count: {
          description: 'Total number of contacts present in the segment',
          type: 'integer',
        },
        contacts_sample: {
          description: 'A subset of all contacts that are in this segment',
          items: {
            $ref: '#/components/schemas/contact_response',
          },
          type: 'array',
        },
        created_at: {
          description: 'ISO8601 timestamp of when the object was created',
          type: 'string',
        },
        id: {
          description: 'ID assigned to the segment when created.',
          format: 'uuid',
          maxLength: 36,
          minLength: 36,
          type: 'string',
        },
        name: {
          description: 'Name of the segment.',
          maxLength: 100,
          minLength: 1,
          type: 'string',
        },
        next_sample_update: {
          description: 'ISO8601 timestamp of when the samples will be next updated',
          type: 'string',
        },
        parent_list_ids: {
          description:
            'The array of list ids to filter contacts on when building this segment. It allows only one such list id for now. We will support more in future',
          items: {
            type: 'string',
          },
          type: 'array',
          uniqueItems: true,
        },
        query_dsl: {
          description: 'SQL query which will filter contacts based on the conditions provided',
          type: 'string',
        },
        query_version: {
          description:
            "If not set, segment contains a Query for use with Segment v1 APIs. If set to '2', segment contains a SQL query for use in v2.",
          type: 'string',
        },
        sample_updated_at: {
          description: 'ISO8601 timestamp of when the samples were last updated',
          type: 'string',
        },
        status: {
          $ref: '#/components/schemas/segment_status_response',
        },
        updated_at: {
          description: 'ISO8601 timestamp of when the object was last updated',
          type: 'string',
        },
      },
      required: [
        'id',
        'name',
        'query_dsl',
        'contacts_count',
        'contacts_sample',
        'created_at',
        'updated_at',
        'sample_updated_at',
        'next_sample_update',
        'parent_list_ids',
        'query_version',
        'status',
      ],
      title: 'segment_response',
      type: 'object',
    },
    segment_status_response: {
      description: "Segment status indicates whether the segment's contacts will be updated periodically",
      properties: {
        error_message: {
          description: 'Describes any errors that were encountered during query validation',
          type: 'string',
        },
        query_validation: {
          description: 'Status of query validation. PENDING, VALID, or INVALID',
          type: 'string',
        },
      },
      required: ['query_validation'],
      title: 'segment_status_response',
      type: 'object',
    },
    segment_summary: {
      properties: {
        contacts_count: {
          type: 'integer',
        },
        created_at: {
          description: 'ISO8601 of created timestamp\n',
          format: 'date-time',
          type: 'string',
        },
        id: {
          format: 'uuid',
          maxLength: 36,
          minLength: 36,
          type: 'string',
        },
        name: {
          maxLength: 100,
          minLength: 1,
          type: 'string',
        },
        next_sample_update: {
          description:
            'ISO8601 string that is equal to `sample_updated_at` plus an internally calculated offset that depends on how often contacts enter or exit segments as the scheduled pipeline updates the samples.',
          type: 'string',
        },
        parent_list_id: {
          description:
            'The id of the list if this segment is a child of a list.  This implies the query `AND CONTAINS(list_ids, ${parent_list_id})`',
          format: 'uuid',
          maxLength: 36,
          minLength: 36,
          type: 'string',
        },
        sample_updated_at: {
          description: 'ISO8601 timestamp the sample was last updated',
          format: 'date-time',
          type: 'string',
        },
        updated_at: {
          description: 'ISO8601 timestamp the object was last updated',
          format: 'date-time',
          type: 'string',
        },
      },
      required: ['id', 'contacts_count', 'created_at', 'sample_updated_at', 'updated_at'],
      title: 'segment_summary',
      type: 'object',
    },
    segment_summary_v2: {
      description: '',
      properties: {
        results: {
          items: {
            $ref: '#/components/schemas/segment_summary',
          },
          type: 'array',
        },
      },
      title: 'segment_summary',
      type: 'object',
    },
    segment_update: {
      properties: {
        name: {
          description: 'Name of the segment.',
          maxLength: 100,
          minLength: 1,
          type: 'string',
        },
        query_dsl: {
          description: 'SQL query which will filter contacts based on the conditions provided',
          type: 'string',
        },
      },
      title: 'segment_update',
      type: 'object',
    },
    segment_write: {
      properties: {
        name: {
          maxLength: 100,
          minLength: 1,
          type: 'string',
        },
        query_dsl: {
          description: 'Use this field for adding your query string.',
          type: 'string',
        },
      },
      required: ['name', 'query_dsl'],
      title: 'segment_write',
      type: 'object',
    },
    segment_write_v2: {
      properties: {
        name: {
          description: 'Name of the segment.',
          maxLength: 100,
          minLength: 1,
          type: 'string',
        },
        parent_list_ids: {
          description:
            'The array of list ids to filter contacts on when building this segment. It allows only one such list id for now. We will support more in future',
          items: {
            type: 'string',
          },
          type: 'array',
          uniqueItems: true,
        },
        query_dsl: {
          description: 'SQL query which will filter contacts based on the conditions provided',
          type: 'string',
        },
      },
      required: ['name', 'query_dsl'],
      title: 'segment_write',
      type: 'object',
    },
    selfmetadata: {
      properties: {
        self: {
          description: 'A link to this object.',
          type: 'string',
        },
      },
      title: 'selfMetadata',
      type: 'object',
    },
    'sender-id-request': {
      example: {
        address: '123 Elm St.',
        address_2: 'Apt. 456',
        city: 'Denver',
        country: 'United States',
        from: {
          email: 'from@example.com',
          name: 'Example INC',
        },
        nickname: 'My Sender ID',
        reply_to: {
          email: 'replyto@example.com',
          name: 'Example INC',
        },
        state: 'Colorado',
        zip: '80202',
      },
      properties: {
        address: {
          description: 'The physical address of the sender identity.',
          type: 'string',
        },
        address_2: {
          description: 'Additional sender identity address information.',
          type: 'string',
        },
        city: {
          description: 'The city of the sender identity.',
          type: 'string',
        },
        country: {
          description: 'The country of the sender identity.',
          type: 'string',
        },
        from: {
          properties: {
            email: {
              description: 'The email address from which your recipient will receive emails.',
              type: 'string',
            },
            name: {
              description: 'The name appended to the from email field. Typically your name or company name.',
              type: 'string',
            },
          },
          type: 'object',
        },
        nickname: {
          description: 'A nickname for the sender identity. Not used for sending.',
          type: 'string',
        },
        reply_to: {
          properties: {
            email: {
              description: 'The email address to which your recipient will reply.',
              type: 'string',
            },
            name: {
              description: 'The name appended to the reply to email field. Typically your name or company name.',
              type: 'string',
            },
          },
          type: 'object',
        },
        state: {
          description: 'The state of the sender identity.',
          type: 'string',
        },
        zip: {
          description: 'The zipcode of the sender identity.',
          type: 'string',
        },
      },
      title: 'Sender ID Request',
      type: 'object',
    },
    senderID: {
      allOf: [
        {
          $ref: '#/components/schemas/sender-id-request',
        },
        {
          properties: {
            created_at: {
              description: 'The time the sender identity was created.',
              type: 'integer',
            },
            id: {
              description: 'The unique identifier of the sender identity.',
              type: 'integer',
            },
            locked: {
              description:
                'True when the sender id is associated to a campaign in the Draft, Scheduled, or In Progress status. You cannot update or delete a locked sender identity.',
              type: 'boolean',
            },
            updated_at: {
              description: 'The time the sender identity was last updated.',
              type: 'integer',
            },
            verified: {
              description:
                'If the sender identity is verified or not. Only verified sender identities can be used to send email.',
              type: 'boolean',
            },
          },
          type: 'object',
        },
        {
          required: ['nickname', 'address', 'city', 'country'],
          type: 'object',
        },
      ],
      example: {
        address: '123 Elm St.',
        address_2: 'Apt. 456',
        city: 'Denver',
        country: 'United States',
        created_at: 1449872165,
        from: {
          email: 'from@example.com',
          name: 'Example INC',
        },
        id: 1,
        locked: false,
        nickname: 'My Sender ID',
        reply_to: {
          email: 'replyto@example.com',
          name: 'Example INC',
        },
        state: 'Colorado',
        updated_at: 1449872165,
        verified: true,
        zip: '80202',
      },
      title: 'Sender ID',
    },
    'senders-id-request-body': {
      properties: {
        address: {
          description: 'The physical address of the sender identity.',
          type: 'string',
        },
        address_2: {
          description: 'Additional sender identity address information.',
          type: 'string',
        },
        city: {
          description: 'The city of the sender identity.',
          type: 'string',
        },
        country: {
          description: 'The country of the sender identity.',
          type: 'string',
        },
        from: {
          properties: {
            email: {
              description: 'This is where the email will appear to originate from for your recipient',
              type: 'string',
            },
            name: {
              description: 'This is the name appended to the from email field. IE - Your name or company name.',
              type: 'string',
            },
          },
          required: ['email', 'name'],
          type: 'object',
        },
        nickname: {
          description: 'A nickname for the sender identity. Not used for sending.',
          type: 'string',
        },
        reply_to: {
          properties: {
            email: {
              description: 'This is the email that your recipient will reply to.',
              type: 'string',
            },
            name: {
              description: 'This is the name appended to the reply to email field. IE - Your name or company name.',
              type: 'string',
            },
          },
          required: ['email'],
          type: 'object',
        },
        state: {
          description: 'The state of the sender identity.',
          type: 'string',
        },
        zip: {
          description: 'The zipcode of the sender identity.',
          type: 'string',
        },
      },
      required: ['nickname', 'from', 'address', 'city', 'country'],
      title: 'Senders ID Request Body',
      type: 'object',
    },
    'single-contact-request': {
      properties: {
        contact: {
          properties: {
            address_line_1: {
              type: 'string',
            },
            address_line_2: {
              type: 'string',
            },
            alternate_emails: {
              type: 'string',
            },
            city: {
              type: 'string',
            },
            country: {
              type: 'string',
            },
            custom_fields: {
              properties: {
                custom_field_name1: {
                  type: 'string',
                },
                custom_field_name2: {
                  type: 'string',
                },
              },
              type: 'object',
            },
            first_name: {
              type: 'string',
            },
            last_name: {
              type: 'string',
            },
            postal_code: {
              type: 'string',
            },
            primary_email: {
              type: 'string',
            },
            state_province_region: {
              type: 'string',
            },
          },
          type: 'object',
        },
        list_ids: {
          description: "The contact's list IDs.",
          items: {
            format: 'uuid',
            type: 'string',
          },
          maxItems: 100,
          minItems: 0,
          type: 'array',
        },
      },
      title: 'single contact request',
      type: 'object',
    },
    singlesend_request: {
      properties: {
        categories: {
          description: 'The categories to associate with this Single Send.',
          items: {
            type: 'string',
          },
          maxItems: 10,
          type: 'array',
          uniqueItems: true,
        },
        email_config: {
          properties: {
            custom_unsubscribe_url: {
              description:
                'The URL allowing recipients to unsubscribe — you must provide this or the `suppression_group_id`.',
              format: 'uri',
              nullable: true,
              type: 'string',
            },
            design_id: {
              description:
                'A `design_id` can be used in place of `html_content`, `plain_content`, and/or `subject`. You can retrieve a design\'s ID from the ["List Designs" endpoint](https://sendgrid.api-docs.io/v3.0/designs-api/list-designs) or by pulling it from the design\'s detail page URL in the Marketing Campaigns App.',
              type: 'string',
            },
            editor: {
              default: 'code',
              description:
                'The editor — `"design"` or `"code"` — used to modify the Single Send\'s design in the Marketing Campaigns App.',
              enum: ['code', 'design'],
              type: 'string',
            },
            generate_plain_content: {
              default: true,
              description:
                'If set to `true`, `plain_content` is always generated from `html_content`. If set to false, `plain_content` is not altered.',
              type: 'boolean',
            },
            html_content: {
              description: 'The HTML content of the Single Send. Do not include this field when using a `design_id`.',
              type: 'string',
            },
            ip_pool: {
              description: 'The name of the IP Pool from which the Single Send emails are sent.',
              nullable: true,
              type: 'string',
            },
            plain_content: {
              description:
                'The plain text content of the Single Send. Do not include this field when using a `design_id`.',
              type: 'string',
            },
            sender_id: {
              description:
                'The ID of the verified Sender. You can retrieve a verified Sender\'s ID from the ["Get Verified Senders" endpoint](https://sendgrid.api-docs.io/v3.0/sender-verification/get-verified-senders) or by pulling it from the Sender\'s detail page URL in the SendGrid App.',
              nullable: true,
              type: 'integer',
            },
            subject: {
              description: 'The subject line of the Single Send. Do not include this field when using a `design_id`.',
              type: 'string',
            },
            suppression_group_id: {
              description:
                'The ID of the Suppression Group to allow recipients to unsubscribe — you must provide this or the `custom_unsubscribe_url`.',
              nullable: true,
              type: 'integer',
            },
          },
          type: 'object',
        },
        name: {
          description: 'The name of the Single Send.',
          maxLength: 100,
          minLength: 1,
          type: 'string',
        },
        send_at: {
          description: 'The ISO 8601 time at which to send the Single Send — this must be set for a future time.',
          format: 'date-time',
          type: 'string',
        },
        send_to: {
          properties: {
            all: {
              default: false,
              description:
                'Set to `true` to send to All Contacts. If set to `false`, at least one `list_ids` or `segment_ids` value must be provided before the Single Send is scheduled to be sent to recipients.',
              type: 'boolean',
            },
            list_ids: {
              description: 'The recipient List IDs that will receive the Single Send.',
              items: {
                format: 'uuid',
                type: 'string',
              },
              maxItems: 10,
              type: 'array',
            },
            segment_ids: {
              description: 'The recipient Segment IDs that will receive the Single Send.',
              items: {
                format: 'uuid',
                type: 'string',
              },
              maxItems: 10,
              type: 'array',
            },
          },
          type: 'object',
        },
      },
      required: ['name'],
      title: 'singlesend_request',
      type: 'object',
    },
    singlesend_response: {
      allOf: [
        {
          $ref: '#/components/schemas/singlesend_request',
        },
        {
          properties: {
            created_at: {
              description: 'the ISO 8601 time at which the Single Send was created',
              format: 'date-time',
              type: 'string',
            },
            id: {
              format: 'uuid',
              type: 'string',
            },
            status: {
              description: 'current status of the Single Send',
              enum: ['draft', 'scheduled', 'triggered'],
              type: 'string',
            },
            updated_at: {
              description: 'the ISO 8601 time at which the Single Send was last updated',
              format: 'date-time',
              type: 'string',
            },
            warnings: {
              items: {
                properties: {
                  field: {
                    type: 'string',
                  },
                  message: {
                    type: 'string',
                  },
                  warning_id: {
                    type: 'string',
                  },
                },
                type: 'object',
              },
              type: 'array',
            },
          },
          required: ['id', 'status', 'created_at'],
          type: 'object',
        },
      ],
      example: {
        categories: ['unique opens'],
        created_at: '2020-05-18T17:28:27.272Z',
        email_config: {
          custom_unsubscribe_url: null,
          editor: 'code',
          generate_plain_content: true,
          html_content: '',
          ip_pool: null,
          plain_content: '',
          sender_id: null,
          subject: '',
          suppression_group_id: null,
        },
        id: '27c21bbf-a12c-440b-b8bf-c526975328ca',
        name: 'Example API Created Single Send',
        send_at: '2020-06-16T00:19:55.106Z',
        send_to: {
          list_ids: ['f2fe66a1-43f3-4e3a-87b1-c6a600d805f0'],
        },
        status: 'scheduled',
      },
      title: 'singlesend_response',
    },
    singlesend_response_short: {
      properties: {
        abtest: {
          $ref: '#/components/schemas/abtest_summary',
        },
        categories: {
          description: 'categories to associate with this Single Send',
          items: {
            type: 'string',
          },
          maxItems: 10,
          type: 'array',
          uniqueItems: true,
        },
        created_at: {
          description: 'the ISO 8601 time at which the Single Send was created',
          format: 'date-time',
          type: 'string',
        },
        id: {
          format: 'uuid',
          type: 'string',
        },
        is_abtest: {
          description: "true if the Single Send's AB Test functionality has been toggled on",
          type: 'boolean',
        },
        name: {
          description: 'name of the Single Send',
          maxLength: 100,
          minLength: 1,
          type: 'string',
        },
        send_at: {
          description: 'the ISO 8601 time at which to send the Single Send; must be in future',
          format: 'date-time',
          type: 'string',
        },
        status: {
          description: 'current status of the Single Send',
          enum: ['draft', 'scheduled', 'triggered'],
          type: 'string',
        },
        updated_at: {
          description: 'the ISO 8601 time at which the Single Send was last updated',
          format: 'date-time',
          type: 'string',
        },
      },
      required: ['id', 'name', 'abtest', 'status', 'categories', 'is_abtest', 'updated_at', 'created_at'],
      title: 'singlesend_response_short',
      type: 'object',
    },
    singlesend_schedule: {
      properties: {
        send_at: {
          description:
            'This is the ISO 8601 time at which to send the Single Send; must be in future, or the string "now"',
          format: 'date-time',
          type: 'string',
        },
        status: {
          enum: ['draft', 'scheduled', 'triggered'],
          type: 'string',
        },
      },
      required: ['send_at'],
      title: 'singlesend-schedule',
      type: 'object',
    },
    singlesend_search: {
      properties: {
        categories: {
          description:
            'categories to associate with this Single Send, match any single send that has at least one of the categories',
          items: {
            type: 'string',
          },
          type: 'array',
          uniqueItems: true,
        },
        name: {
          description: 'leading and trailing wildcard search on name of the Single Send',
          maxLength: 100,
          minLength: 1,
          type: 'string',
        },
        status: {
          description: 'current status of the Single Send',
          items: {
            enum: ['draft', 'scheduled', 'triggered'],
            type: 'string',
          },
          type: 'array',
          uniqueItems: true,
        },
      },
      title: 'singlesend_search',
      type: 'object',
    },
    singlesend_warning: {
      properties: {
        warnings: {
          items: {
            properties: {
              field: {
                type: 'string',
              },
              message: {
                type: 'string',
              },
              warning_id: {
                type: 'string',
              },
            },
            type: 'object',
          },
          type: 'array',
        },
      },
      title: 'singlesend_warning',
      type: 'object',
    },
    'singlesends-link-stats-response': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/link-tracking-metadata',
        },
        results: {
          description: "This is the index of the link's location in the email contents.",
          items: {
            properties: {
              ab_phase: {
                description:
                  'This is the A/B phase of the Single Send stat returned. If the `ab_phase` query parameter was not provided, it will return `"all"`.',
                enum: ['send', 'test', 'all'],
                type: 'string',
              },
              ab_variation: {
                description:
                  'This is the A/B variation of the Single Send stat returned. It is set to `"all"` if the `ab_variation` query parameter was not set in the request and `group_by` doesn\'t contain `ab_variation`.',
                format: 'uuid',
                type: 'string',
              },
              clicks: {
                description: 'the number of clicks on this particular link',
                minimum: 1,
                type: 'integer',
              },
              url: {
                description:
                  'This is the URL of the link clicked. If `{{custom_fields}}` are part of the URL, they will be included.',
                format: 'uri',
                type: 'string',
              },
              url_location: {
                description:
                  'This is the location of the link clicked in each Single Send A/B variation, or in the Single Send itself if there are no variations. Links are numbered from the top down; the topmost link is index `0`.',
                minimum: 0,
                type: 'integer',
              },
            },
            required: ['url', 'ab_variation', 'ab_phase', 'clicks'],
            type: 'object',
          },
          type: 'array',
        },
        total_clicks: {
          type: 'integer',
        },
      },
      required: ['results', '_metadata'],
      title: 'singlesends-link-stats-response',
      type: 'object',
    },
    'singlesends-response': {
      properties: {
        _metadata: {
          $ref: '#/components/schemas/metadata',
        },
        results: {
          items: {
            properties: {
              ab_phase: {
                default: 'all',
                description:
                  'This is the A/B phase of the Single Send stat returned. If the `group_by` parameter doesn\'t include `ab_phase` in the request, then the value is "all".',
                enum: ['send', 'test', 'all'],
                type: 'string',
              },
              ab_variation: {
                default: 'all',
                description:
                  'This is the A/B variation of the Single Send stat returned. If the `group_by` parameter doesn\'t include `ab_variation` in the request, then the value is "all".',
                format: 'uuid',
                type: 'string',
              },
              aggregation: {
                default: 'total',
                description:
                  'This describes the time unit to which the stat is rolled up. It is based on the `aggregated_by` parameter included in the request. It can be "total" or the date (in YYYY-MM-DD format) the stats are for.',
                type: 'string',
              },
              id: {
                description: 'This is the ID of the Single Dend you require stats for.',
                format: 'uuid',
                type: 'string',
              },
              stats: {
                $ref: '#/components/schemas/metrics',
              },
            },
            required: ['id', 'ab_variation', 'ab_phase'],
            type: 'object',
          },
          type: 'array',
        },
      },
      required: ['results', '_metadata'],
      title: 'singlesends-response',
      type: 'object',
    },
    'spam-reports-response': {
      example: [
        {
          created: 1443651141,
          email: 'user1@example.com',
          ip: '10.63.202.100',
        },
        {
          created: 1443651154,
          email: 'user2@example.com',
          ip: '10.63.202.100',
        },
      ],
      items: {
        properties: {
          created: {
            description: 'A Unix timestamp that indicates when the recipient marked your message as spam.',
            type: 'integer',
          },
          email: {
            description: 'The email address of the recipient that marked your message as spam.',
            format: 'email',
            type: 'string',
          },
          ip: {
            description: 'The IP address that the message was sent from.',
            type: 'string',
          },
        },
        required: ['created', 'email', 'ip'],
        type: 'object',
      },
      title: 'Spam Reports Response',
      type: 'array',
    },
    'sso-certificate-body': {
      example: {
        id: 66138975,
        intergration_id: 'b0b98502-9408-4b24-9e3d-31ed7cb15312',
        not_after: 1621289880,
        not_before: 1621289880,
        public_certificate: '<your x509 certificate>',
      },
      properties: {
        id: {
          description: 'A unique ID assigned to the certificate by SendGrid.',
          type: 'number',
        },
        intergration_id: {
          description: 'An ID that matches a certificate to a specific IdP integration.',
          type: 'string',
        },
        not_after: {
          description:
            'A unix timestamp (e.g., 1603915954) that indicates the time after which the certificate is no longer valid.',
          type: 'number',
        },
        not_before: {
          description:
            'A unix timestamp (e.g., 1603915954) that indicates the time before which the certificate is not valid.',
          type: 'number',
        },
        public_certificate: {
          description:
            'This certificate is used by Twilio SendGrid to verify that SAML requests are coming from Okta. This is called the X509 certificate in the Twilio SendGrid UI.',
          type: 'string',
        },
      },
      title: 'Single Sign-On Certificate Body',
      type: 'object',
    },
    'sso-error-response': {
      items: {
        properties: {
          error_id: {
            type: 'string',
          },
          field: {
            nullable: true,
            type: 'string',
          },
          message: {
            type: 'string',
          },
        },
        type: 'object',
      },
      title: 'SSO Error Response',
      type: 'array',
    },
    'sso-integration': {
      allOf: [
        {
          $ref: '#/components/schemas/create-integration-request',
        },
        {
          properties: {
            audience_url: {
              description:
                'The URL where your IdP should POST its SAML response. This is the Twilio SendGrid URL that is responsible for receiving and parsing a SAML assertion. This is the same URL as the Single Sign-On URL when using SendGrid.',
              type: 'string',
            },
            id: {
              description: 'A unique ID assigned to the configuration by SendGrid.',
              type: 'string',
            },
            last_updated: {
              description: 'A timestamp representing the last time the configuration was modified.',
              type: 'number',
            },
            single_signon_url: {
              description:
                'The URL where your IdP should POST its SAML response. This is the Twilio SendGrid URL that is responsible for receiving and parsing a SAML assertion. This is the same URL as the Audience URL when using SendGrid.',
              type: 'string',
            },
          },
          required: ['last_updated'],
          type: 'object',
        },
      ],
      title: 'Single Sign-On Integration',
    },
    'sso-teammate-common-fields': {
      properties: {
        email: {
          description:
            'The Teammate’s email address. This email address will also function as the Teammate’s username and must match the address assigned to the user in your IdP. This address cannot be changed after the Teammate is created.',
          format: 'email',
          type: 'string',
        },
        first_name: {
          description: 'The Teammate’s first name.',
          type: 'string',
        },
        is_admin: {
          description: 'Indicates if the Teammate has admin permissions.',
          type: 'boolean',
        },
        is_read_only: {
          description: 'Indicates if the Teammate has read_only permissions.',
          type: 'boolean',
        },
        last_name: {
          description: 'The Teammate’s last name.',
          type: 'string',
        },
      },
      required: ['first_name', 'last_name', 'email'],
      title: 'Single Sing-On Teammate Common Fields',
      type: 'object',
    },
    'sso-teammate-request': {
      allOf: [
        {
          $ref: '#/components/schemas/sso-teammate-common-fields',
        },
        {
          properties: {
            scopes: {
              description: 'The permission scopes assigned to the Teammate.',
              items: {
                type: 'string',
              },
              type: 'array',
            },
          },
          required: ['scopes'],
          type: 'object',
        },
      ],
      title: 'Single Sign-On Teammate Request',
    },
    'sso-teammate-response': {
      allOf: [
        {
          $ref: '#/components/schemas/sso-teammate-common-fields',
        },
        {
          properties: {
            is_sso: {
              description:
                'Indicates if the Teammate authenticates with SendGrid using SSO or with a username and password.',
              type: 'boolean',
            },
            username: {
              description: "This should be set to the Teammate's email address.",
              type: 'string',
            },
          },
          type: 'object',
        },
      ],
      title: 'Single Sign-On Teammate Response',
    },
    'sso-teammates-patch-response': {
      allOf: [
        {
          $ref: '#/components/schemas/sso-teammate-response',
        },
        {
          properties: {
            address: {
              description: 'The Teammate’s street address.',
              type: 'string',
            },
            address2: {
              description:
                'The Teammate’s apartment number, suite number, or other secondary address information that is not part of the physical street address.',
              type: 'string',
            },
            city: {
              description: "The Teammate's city.",
              type: 'string',
            },
            company: {
              description: 'The Teammate’s company name.',
              type: 'string',
            },
            country: {
              description: 'The Teammate’s country of residence.',
              type: 'string',
            },
            email: {
              format: 'email',
              type: 'string',
            },
            phone: {
              description: 'The Teammate’s stored phone number.',
              type: 'string',
            },
            scopes: {
              description: 'The permission scopes assigned to the Teammate.',
              items: {
                type: 'string',
              },
              type: 'array',
            },
            state: {
              description: 'The Teammate’s state or province.',
              type: 'string',
            },
            user_type: {
              description:
                'A Teammate can be an “admin,” “owner,” or “teammate.” Each role is associated with the scope of the Teammate’s permissions.',
              enum: ['admin', 'owner', 'teammate'],
              type: 'string',
            },
            website: {
              description: 'A website associated with the Teammate',
              type: 'string',
            },
            zip: {
              description: 'The Teammate’s zip code.',
              type: 'string',
            },
          },
          type: 'object',
        },
      ],
      title: 'Single Sign-On Teammates PATCH Response',
    },
    'stats-advanced-global-stats': {
      allOf: [
        {
          $ref: '#/components/schemas/advanced_stats_clicks_opens',
        },
        {
          properties: {
            blocks: {
              description: 'The number of emails that were not allowed to be delivered by ISPs.',
              type: 'integer',
            },
            bounce_drops: {
              description: 'The number of emails that were dropped because of a bounce.',
              type: 'integer',
            },
            bounces: {
              description: 'The number of emails that bounced instead of being delivered.',
              type: 'integer',
            },
            deferred: {
              description: 'The number of emails that temporarily could not be delivered. ',
              type: 'integer',
            },
            delivered: {
              description: 'The number of emails SendGrid was able to confirm were actually delivered to a recipient.',
              type: 'integer',
            },
            invalid_emails: {
              description:
                'The number of recipients who had malformed email addresses or whose mail provider reported the address as invalid.',
              type: 'integer',
            },
            processed: {
              description:
                'Requests from your website, application, or mail client via SMTP Relay or the API that SendGrid processed.',
              type: 'integer',
            },
            requests: {
              description: 'The number of emails that were requested to be delivered.',
              type: 'integer',
            },
            spam_report_drops: {
              description:
                'The number of emails that were dropped due to a recipient previously marking your emails as spam.',
              type: 'integer',
            },
            spam_reports: {
              description: 'The number of recipients who marked your email as spam.',
              type: 'integer',
            },
            unsubscribe_drops: {
              description: 'The number of emails dropped due to a recipient unsubscribing from your emails.',
              type: 'integer',
            },
            unsubscribes: {
              description: 'The number of recipients who unsubscribed from your emails.',
              type: 'integer',
            },
          },
          type: 'object',
        },
      ],
      title: 'Stats: Advanced Global Stats',
    },
    'stats-advanced-stats-base-schema': {
      items: {
        properties: {
          date: {
            description: 'The date the stats were gathered.',
            type: 'string',
          },
          stats: {
            description: 'The individual email activity stats.',
            items: {
              properties: {
                metrics: {
                  type: 'object',
                },
              },
              type: 'object',
            },
            type: 'array',
          },
        },
        type: 'object',
      },
      title: 'Stats: Advanced Stats Base Schema',
      type: 'array',
    },
    subscription_tracking_settings: {
      properties: {
        enabled: {
          description: 'Indicates if subscription tracking is enabled.',
          type: 'boolean',
        },
        html_content: {
          description: 'The information and HTML for your unsubscribe link. ',
          type: 'string',
        },
        landing: {
          description:
            'The HTML that will be displayed on the page that your customers will see after clicking unsubscribe, hosted on SendGrid’s server.',
          type: 'string',
        },
        plain_content: {
          description:
            'The information in plain text for your unsubscribe link. You should have the “<% %>” tag in your content, otherwise the user will have no URL for unsubscribing.',
          type: 'string',
        },
        replace: {
          description:
            'Your custom defined replacement tag for your templates. Use this tag to place your unsubscribe content anywhere in your emailtemplate.',
          type: 'string',
        },
        url: {
          description: 'The URL where you would like your users sent to unsubscribe.',
          format: 'uri',
          type: 'string',
        },
      },
      title: 'Settings: Subscription Tracking',
      type: 'object',
    },
    subuser: {
      example: {
        disabled: false,
        email: 'example@example.com',
        id: 1234,
        username: 'example_subuser',
      },
      properties: {
        disabled: {
          description: 'Whether or not the user is enabled or disabled.',
          type: 'boolean',
        },
        email: {
          description: 'The email address to contact this subuser.',
          format: 'email',
          type: 'string',
        },
        id: {
          description: 'The ID of this subuser.',
          type: 'number',
        },
        username: {
          description: 'The name by which this subuser will be referred.',
          type: 'string',
        },
      },
      required: ['disabled', 'id', 'username', 'email'],
      title: 'List all Subusers for a parent response',
      type: 'object',
    },
    subuser_post: {
      example: {
        authorization_token: '',
        credit_allocation: {
          type: 'unlimited',
        },
        email: 'example@example.com',
        signup_session_token: '',
        user_id: 1234,
        username: 'example_subuser',
      },
      properties: {
        authorization_token: {
          type: 'string',
        },
        credit_allocation: {
          properties: {
            type: {
              type: 'string',
            },
          },
          type: 'object',
        },
        email: {
          description: 'The email address for this subuser.',
          format: 'email',
          type: 'string',
        },
        signup_session_token: {
          type: 'string',
        },
        user_id: {
          description: 'The user ID for this subuser.',
          type: 'number',
        },
        username: {
          description: 'The username of the subuser.',
          type: 'string',
        },
      },
      required: ['username', 'user_id', 'email'],
      title: 'Subuser::POST',
      type: 'object',
    },
    subuser_stats: {
      example: {
        date: '2016-02-01',
        stats: [
          {
            first_name: 'John',
            last_name: 'Doe',
            metrics: {
              blocks: 0,
              bounce_drops: 0,
              bounces: 0,
              clicks: 5,
              deferred: 0,
              delivered: 0,
              invalid_emails: 0,
              opens: 10,
              processed: 10,
              requests: 10,
              spam_report_drops: 0,
              spam_reports: 0,
              unique_clicks: 0,
              unique_opens: 0,
              unsubscribe_drops: 0,
              unsubscribes: 0,
            },
            name: 'user1',
            type: 'subuser',
          },
        ],
      },
      properties: {
        date: {
          description: 'The date the statistics were gathered.',
          type: 'string',
        },
        stats: {
          description: 'The list of statistics.',
          items: {
            properties: {
              first_name: {
                description: 'The first name of the subuser.',
                type: 'string',
              },
              last_name: {
                description: 'The last name of the subuser.',
                type: 'string',
              },
              metrics: {
                properties: {
                  blocks: {
                    description: 'The number of emails that were not allowed to be delivered by ISPs.',
                    type: 'integer',
                  },
                  bounce_drops: {
                    description: 'The number of emails that were dropped because of a bounce.',
                    type: 'integer',
                  },
                  bounces: {
                    description: 'The number of emails that bounced instead of being delivered.',
                    type: 'integer',
                  },
                  clicks: {
                    description: 'The number of links that were clicked in your emails.',
                    type: 'integer',
                  },
                  deferred: {
                    description: 'The number of emails that temporarily could not be delivered.',
                    type: 'integer',
                  },
                  delivered: {
                    description:
                      'The number of emails SendGrid was able to confirm were actually delivered to a recipient.',
                    type: 'integer',
                  },
                  invalid_emails: {
                    description:
                      'The number of recipients who had malformed email addresses or whose mail provider reported the address as invalid.',
                    type: 'integer',
                  },
                  opens: {
                    description: 'The total number of times your emails were opened by recipients.',
                    type: 'integer',
                  },
                  processed: {
                    description:
                      'Requests from your website, application, or mail client via SMTP Relay or the API that SendGrid processed.',
                    type: 'integer',
                  },
                  requests: {
                    description: 'The number of emails that were requested to be delivered.',
                    type: 'integer',
                  },
                  spam_report_drops: {
                    description:
                      'The number of emails that were dropped due to a recipient previously marking your emails as spam.',
                    type: 'integer',
                  },
                  spam_reports: {
                    description: 'The number of recipients who marked your email as spam.',
                    type: 'integer',
                  },
                  unique_clicks: {
                    description: 'The number of unique recipients who clicked links in your emails.',
                    type: 'integer',
                  },
                  unique_opens: {
                    description: 'The number of unique recipients who opened your emails.',
                    type: 'integer',
                  },
                  unsubscribe_drops: {
                    description: 'The number of emails dropped due to a recipient unsubscribing from your emails.',
                    type: 'integer',
                  },
                  unsubscribes: {
                    description: 'The number of recipients who unsubscribed from your emails.',
                    type: 'integer',
                  },
                },
                type: 'object',
              },
              name: {
                description: 'The username of the subuser.',
                type: 'string',
              },
              type: {
                description: 'The type of account.',
                type: 'string',
              },
            },
            type: 'object',
          },
          type: 'array',
        },
      },
      title: 'subuser_stats',
      type: 'object',
    },
    'suppression-group-request-base': {
      properties: {
        description: {
          description: 'A brief description of your suppression group. Required when creating a group.',
          maxLength: 100,
          type: 'string',
        },
        is_default: {
          description: 'Indicates if you would like this to be your default suppression group.',
          type: 'boolean',
        },
        name: {
          description: 'The name of your suppression group. Required when creating a group.',
          maxLength: 30,
          type: 'string',
        },
      },
      title: 'Suppression Group Request Base',
      type: 'object',
    },
    suppression_group: {
      properties: {
        description: {
          description: 'A description of the suppression group.',
          maxLength: 100,
          type: 'string',
        },
        id: {
          description: 'The id of the suppression group.',
          type: 'number',
        },
        is_default: {
          default: false,
          description: 'Indicates if this is the default suppression group.',
          type: 'boolean',
        },
        last_email_sent_at: {
          nullable: true,
        },
        name: {
          description: 'The name of the suppression group. Each group created by a user must have a unique name.',
          maxLength: 30,
          type: 'string',
        },
        unsubscribes: {
          description: 'The unsubscribes associated with this group.',
          type: 'integer',
        },
      },
      required: ['id', 'name', 'description'],
      title: 'Suppressions: Suppression Group',
      type: 'object',
    },
    'suppressions-request': {
      example: {
        recipient_emails: ['test1@example.com', 'test2@example.com'],
      },
      properties: {
        recipient_emails: {
          description: 'The array of email addresses to add or find.',
          items: {
            format: 'email',
            type: 'string',
          },
          type: 'array',
        },
      },
      required: ['recipient_emails'],
      title: 'Suppressions Request Body',
      type: 'object',
    },
    to_email_array: {
      example: [
        {
          email: 'john_doe@example.com',
          name: 'John Doe',
        },
      ],
      items: {
        properties: {
          email: {
            description: "The intended recipient's email address.",
            format: 'email',
            type: 'string',
          },
          name: {
            description: "The intended recipient's name.",
            type: 'string',
          },
        },
        required: ['email'],
        type: 'object',
      },
      title: 'To Email Array',
      type: 'array',
    },
    'transactional-template-warning': {
      example: {
        message: 'A sample warning message.',
      },
      properties: {
        message: {
          description: 'Warning message for the user',
          type: 'string',
        },
      },
      title: 'Warning',
      type: 'object',
    },
    'transactional-templates-template-lean': {
      example: {
        generation: 'legacy',
        id: '0c314114-a2b7-4523-8cbc-a293d7d19007',
        name: 'example_name',
        'updated_at ': '2021-04-28 13:12:46',
        versions: [],
      },
      properties: {
        generation: {
          description: 'Defines the generation of the template.',
          enum: ['legacy', 'dynamic'],
          type: 'string',
        },
        id: {
          description: 'The ID of the transactional template.',
          format: 'uuid',
          maxLength: 36,
          minLength: 36,
          type: 'string',
        },
        name: {
          description: 'The name for the transactional template.',
          maxLength: 100,
          type: 'string',
        },
        'updated_at ': {
          description: 'The date and time that this transactional template version was updated.',
          pattern: '^(\\d{4}-\\d{2}-\\d{2}) ((\\d{2}):(\\d{2}):(\\d{2}))$',
          type: 'string',
        },
        versions: {
          description: 'The different versions of this transactional template.',
          items: {
            $ref: '#/components/schemas/transactional-templates-version-output-lean',
          },
          type: 'array',
        },
      },
      required: ['id', 'name', 'generation', 'updated_at '],
      title: 'Transactional Templates: Template Lean',
      type: 'object',
    },
    'transactional-templates-version-output-lean': {
      properties: {
        active: {
          description:
            'Set the version as the active version associated with the template. Only one version of a template can be active. The first version created for a template will automatically be set to Active.',
          enum: [0, 1],
          type: 'integer',
        },
        editor: {
          description: 'The editor used in the UI.',
          enum: ['code', 'design'],
          type: 'string',
        },
        generate_plain_content: {
          default: true,
          description:
            'If true, plain_content is always generated from html_content. If false, plain_content is not altered.',
          type: 'boolean',
        },
        id: {
          description: 'ID of the transactional template version.',
          format: 'uuid',
          type: 'string',
        },
        name: {
          description: 'Name of the transactional template version.',
          maxLength: 100,
          type: 'string',
        },
        subject: {
          description: 'Subject of the new transactional template version.',
          maxLength: 255,
          type: 'string',
        },
        template_id: {
          description: 'ID of the transactional template.',
          type: 'string',
        },
        thumbnail_url: {
          description: "A Thumbnail preview of the template's html content.",
          type: 'string',
        },
        updated_at: {
          description: 'The date and time that this transactional template version was updated.',
          type: 'string',
        },
      },
      title: 'Transactional Templates: Version Output Lean',
      type: 'object',
    },
    transactional_template: {
      allOf: [
        {
          $ref: '#/components/schemas/transactional-templates-template-lean',
        },
        {
          properties: {
            warning: {
              $ref: '#/components/schemas/transactional-template-warning',
            },
          },
          type: 'object',
        },
      ],
      example: {
        generation: 'legacy',
        id: '33feeff2-5069-43fe-8853-428651e5be79',
        name: 'example_name',
        'updated_at ': '2021-04-28 13:12:46',
        warning: {
          message: 'Sample warning message',
        },
      },
      title: 'Transactional Templates: Template',
    },
    transactional_template_version_create: {
      example: {
        active: 1,
        editor: 'design',
        generate_plain_content: false,
        html_content: 'dolor',
        name: 'pariatur non incididunt commodo',
        plain_content: 'labore dolore',
        subject: 'aliquip nulla Ut',
        template_id: 'Excepteur Ut qui',
      },
      properties: {
        active: {
          description:
            'Set the version as the active version associated with the template (0 is inactive, 1 is active). Only one version of a template can be active. The first version created for a template will automatically be set to Active.',
          enum: [0, 1],
          type: 'integer',
        },
        editor: {
          description: 'The editor used in the UI.',
          enum: ['code', 'design'],
          type: 'string',
        },
        generate_plain_content: {
          default: true,
          description:
            'If true, plain_content is always generated from html_content. If false, plain_content is not altered.',
          type: 'boolean',
        },
        html_content: {
          description: 'The HTML content of the version. Maximum of 1048576 bytes allowed.',
          maxLength: 1048576,
          type: 'string',
        },
        name: {
          description: 'Name of the transactional template version.',
          maxLength: 100,
          type: 'string',
        },
        plain_content: {
          default: '<generated from html_content if left empty>',
          description: 'Text/plain content of the transactional template version. Maximum of 1048576 bytes allowed.',
          maxLength: 1048576,
          type: 'string',
        },
        subject: {
          description: 'Subject of the new transactional template version.',
          maxLength: 255,
          type: 'string',
        },
        test_data: {
          description:
            'For dynamic templates only, the mock json data that will be used for template preview and test sends.',
          type: 'string',
        },
      },
      required: ['name', 'subject'],
      title: 'Transactional Templates: Version Create',
      type: 'object',
    },
    transactional_template_version_output: {
      allOf: [
        {
          properties: {
            warnings: {
              items: {
                $ref: '#/components/schemas/transactional-template-warning',
              },
              type: 'array',
            },
          },
          type: 'object',
        },
        {
          $ref: '#/components/schemas/transactional_template_version_create',
        },
        {
          $ref: '#/components/schemas/transactional-templates-version-output-lean',
        },
      ],
      title: 'Transactional Templates: Version Output',
    },
    user_profile: {
      example: {
        address: '1451 Larimer Street, 3rd floor',
        address2: '',
        city: 'Denver, CO',
        company: 'SendGrid',
        country: 'US',
        first_name: 'Matthew',
        last_name: 'Bernier',
        phone: '7208788003',
        state: 'CO',
        website: 'http://sendgrid.com',
        zip: '80202',
      },
      properties: {
        address: {
          description: 'The street address for this user profile.',
          type: 'string',
        },
        address2: {
          description: 'An optional second line for the street address of this user profile.',
          type: 'string',
        },
        city: {
          description: 'The city for the user profile.',
          type: 'string',
        },
        company: {
          description: 'That company that this user profile is associated with.',
          type: 'string',
        },
        country: {
          description: 'Th country of this user profile.',
          type: 'string',
        },
        first_name: {
          description: 'The first name of the user.',
          type: 'string',
        },
        last_name: {
          description: 'The last name of the user.',
          type: 'string',
        },
        phone: {
          description: 'The phone number for the user.',
          type: 'string',
        },
        state: {
          description: 'The state for this user.',
          type: 'string',
        },
        website: {
          description: 'The website associated with this user.',
          type: 'string',
        },
        zip: {
          description: 'The zip code for this user.',
          type: 'string',
        },
      },
      title: 'User: Profile',
      type: 'object',
    },
    user_scheduled_send_status: {
      allOf: [
        {
          $ref: '#/components/schemas/mail_batch_id',
        },
        {
          description: 'The status of the scheduled send.',
          properties: {
            status: {
              description: 'The status of the scheduled send.',
              enum: ['cancel', 'pause'],
              type: 'string',
            },
          },
          required: ['status'],
          type: 'object',
        },
      ],
      example: {
        batch_id: 'HkJ5yLYULb7Rj8GKSx7u025ouWVlMgAi',
        status: 'pause',
      },
      title: 'User Scheduled Send status',
    },
    'verified-sender-request-schema': {
      example: {
        address: '1234 Fake St',
        address2: 'PO Box 1234',
        city: 'San Francisco',
        country: 'USA',
        from_email: 'orders@example.com',
        from_name: 'Example Orders',
        nickname: 'Orders',
        reply_to: 'orders@example.com',
        reply_to_name: 'Example Orders',
        state: 'CA',
        zip: '94105',
      },
      properties: {
        address: {
          maxLength: 100,
          type: 'string',
        },
        address2: {
          maxLength: 100,
          type: 'string',
        },
        city: {
          maxLength: 150,
          type: 'string',
        },
        country: {
          maxLength: 100,
          type: 'string',
        },
        from_email: {
          format: 'email',
          maxLength: 256,
          type: 'string',
        },
        from_name: {
          maxLength: 256,
          type: 'string',
        },
        nickname: {
          maxLength: 100,
          type: 'string',
        },
        reply_to: {
          format: 'email',
          maxLength: 256,
          type: 'string',
        },
        reply_to_name: {
          maxLength: 256,
          type: 'string',
        },
        state: {
          maxLength: 2,
          type: 'string',
        },
        zip: {
          maxLength: 10,
          type: 'string',
        },
      },
      required: ['nickname', 'from_email', 'reply_to'],
      title: 'Verified Sender Request Schema',
      type: 'object',
    },
    'verified-sender-response-schema': {
      example: {
        address: '1234 Fake St.',
        address2: 'PO Box 1234',
        city: 'San Francisco',
        country: 'USA',
        from_email: 'orders@example.com',
        from_name: 'Example Orders',
        id: 1234,
        locked: false,
        nickname: 'Example Orders',
        reply_to: 'orders@example.com',
        reply_to_name: 'Example Orders',
        state: 'CA',
        verified: true,
        zip: '94105',
      },
      properties: {
        address: {
          type: 'string',
        },
        address2: {
          type: 'string',
        },
        city: {
          type: 'string',
        },
        country: {
          type: 'string',
        },
        from_email: {
          type: 'string',
        },
        from_name: {
          type: 'string',
        },
        id: {
          type: 'integer',
        },
        locked: {
          type: 'boolean',
        },
        nickname: {
          type: 'string',
        },
        reply_to: {
          type: 'string',
        },
        reply_to_name: {
          type: 'string',
        },
        state: {
          type: 'string',
        },
        verified: {
          type: 'boolean',
        },
        zip: {
          type: 'string',
        },
      },
      title: 'Verified Sender Response Schema',
      type: 'object',
    },
    webhook: {
      properties: {
        nonce: {
          description: 'The one time nonce to use when "signature" is "hmac-sha1"',
          maxLength: 32,
          minLength: 8,
          type: 'string',
        },
        url: {
          description: 'The URL to invoke in the webhook',
          type: 'string',
        },
      },
      required: ['url', 'nonce'],
      title: 'webhook',
      type: 'object',
    },
    'webhooks-event-webhook-request': {
      properties: {
        bounce: {
          description: 'Receiving server could not or would not accept message.',
          type: 'boolean',
        },
        click: {
          description:
            'Recipient clicked on a link within the message. You need to enable Click Tracking for getting this type of event.',
          type: 'boolean',
        },
        deferred: {
          description: "Recipient's email server temporarily rejected message.",
          type: 'boolean',
        },
        delivered: {
          description: 'Message has been successfully delivered to the receiving server.',
          type: 'boolean',
        },
        dropped: {
          description:
            'You may see the following drop reasons: Invalid SMTPAPI header, Spam Content (if spam checker app enabled), Unsubscribed Address, Bounced Address, Spam Reporting Address, Invalid, Recipient List over Package Quota',
          type: 'boolean',
        },
        enabled: {
          description: 'Indicates if the event webhook is enabled.',
          type: 'boolean',
        },
        group_resubscribe: {
          description:
            'Recipient resubscribes to specific group by updating preferences. You need to enable Subscription Tracking for getting this type of event.',
          type: 'boolean',
        },
        group_unsubscribe: {
          description:
            'Recipient unsubscribe from specific group, by either direct link or updating preferences. You need to enable Subscription Tracking for getting this type of event.',
          type: 'boolean',
        },
        oauth_client_id: {
          description:
            'The client ID Twilio SendGrid sends to your OAuth server or service provider to generate an OAuth access token. When passing data in this field, you must also include the oauth_token_url field.',
          type: 'string',
        },
        oauth_token_url: {
          description:
            'The URL where Twilio SendGrid sends the Client ID and Client Secret to generate an access token. This should be your OAuth server or service provider. When passing data in this field, you must also include the oauth_client_id field.',
          type: 'string',
        },
        open: {
          description:
            'Recipient has opened the HTML message. You need to enable Open Tracking for getting this type of event.',
          type: 'boolean',
        },
        processed: {
          description: 'Message has been received and is ready to be delivered.',
          type: 'boolean',
        },
        spam_report: {
          description: 'Recipient marked a message as spam.',
          type: 'boolean',
        },
        unsubscribe: {
          description:
            "Recipient clicked on message's subscription management link. You need to enable Subscription Tracking for getting this type of event.",
          type: 'boolean',
        },
        url: {
          description: 'The URL that you want the event webhook to POST to.',
          type: 'string',
        },
      },
      required: [
        'enabled',
        'url',
        'group_resubscribe',
        'delivered',
        'group_unsubscribe',
        'spam_report',
        'bounce',
        'deferred',
        'unsubscribe',
        'processed',
        'open',
        'click',
        'dropped',
      ],
      title: 'Webhooks: Event Webhook Request',
      type: 'object',
    },
  },
  securitySchemes: {
    Authorization: {
      in: 'header',
      name: 'Authorization',
      type: 'apiKey',
    },
  },
} as TComponents;
