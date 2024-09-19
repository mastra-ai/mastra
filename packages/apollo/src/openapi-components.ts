// @ts-nocheck
export type TComponents = {
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
export const components = {
  securitySchemes: {
    api_key: {
      type: 'apiKey',
      name: 'api_key',
      in: 'query',
    },
  },
  schemas: {
    emailer_campaign: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
        },
        name: {
          type: ['string', 'null'],
        },
        created_at: {
          type: 'string',
          format: 'date-time',
        },
        permissions: {
          type: 'string',
          enum: ['team_can_use', 'team_can_view', 'private'],
        },
        active: {
          type: 'boolean',
        },
        archived: {
          type: 'boolean',
        },
        label_ids: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        num_steps: {
          type: ['number', 'null'],
        },
        user_id: {
          type: ['string', 'null'],
        },
        unique_scheduled: {
          $ref: '#/components/schemas/metric',
        },
        unique_delivered: {
          $ref: '#/components/schemas/metric',
        },
        unique_bounced: {
          $ref: '#/components/schemas/metric',
        },
        unique_opened: {
          $ref: '#/components/schemas/metric',
        },
        unique_replied: {
          $ref: '#/components/schemas/metric',
        },
        unique_demoed: {
          $ref: '#/components/schemas/metric',
        },
        unique_clicked: {
          $ref: '#/components/schemas/metric',
        },
        unique_unsubscribed: {
          $ref: '#/components/schemas/metric',
        },
        bounce_rate: {
          $ref: '#/components/schemas/metric',
        },
        open_rate: {
          $ref: '#/components/schemas/metric',
        },
        click_rate: {
          $ref: '#/components/schemas/metric',
        },
        reply_rate: {
          $ref: '#/components/schemas/metric',
        },
        spam_blocked_rate: {
          $ref: '#/components/schemas/metric',
        },
        opt_out_rate: {
          $ref: '#/components/schemas/metric',
        },
        demo_rate: {
          $ref: '#/components/schemas/metric',
        },
      },
      required: ['id', 'created_at', 'active', 'archived', 'label_ids'],
    },
    metric: {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'string',
          enum: ['loading'],
        },
        {
          type: 'null',
        },
      ],
    },
    emailer_step: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
        },
        emailer_campaign_id: {
          type: 'string',
        },
        position: {
          type: ['number', 'null'],
        },
        wait_time: {
          type: ['number', 'null'],
        },
        type: {
          $ref: '#/components/schemas/emailer_step_type',
        },
        wait_mode: {
          $ref: '#/components/schemas/emailer_step_wait_mode',
        },
        note: {
          type: ['string', 'null'],
        },
        max_emails_per_day: {
          type: ['number', 'null'],
        },
        exact_datetime: {
          type: ['string', 'null'],
        },
        priority: {
          type: ['string', 'null'],
        },
        auto_skip_in_x_days: {
          type: ['number', 'null'],
        },
        counts: {
          type: ['object', 'null'],
          properties: {
            active: {
              type: ['number', 'null'],
            },
            paused: {
              type: ['number', 'null'],
            },
            finished: {
              type: ['number', 'null'],
            },
            bounced: {
              type: ['number', 'null'],
            },
            spam_blocked: {
              type: ['number', 'null'],
            },
            hard_bounced: {
              type: ['number', 'null'],
            },
            not_sent: {
              type: ['number', 'null'],
            },
          },
        },
      },
      required: ['id', 'emailer_campaign_id', 'type', 'wait_mode'],
    },
    emailer_step_type: {
      type: 'string',
      enum: [
        'auto_email',
        'manual_email',
        'call',
        'action_item',
        'linkedin_step_message',
        'linkedin_step_connect',
        'linkedin_step_view_profile',
        'linkedin_step_interact_post',
      ],
    },
    emailer_step_wait_mode: {
      type: 'string',
      enum: ['second', 'minute', 'hour', 'day'],
    },
    emailer_touch: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
        },
        emailer_step_id: {
          type: ['string', 'null'],
        },
        emailer_template_id: {
          type: ['string', 'null'],
        },
        emailer_template: {
          oneOf: [
            {
              $ref: '#/components/schemas/emailer_template',
            },
            {
              type: 'null',
            },
          ],
        },
        status: {
          type: ['string', 'null'],
        },
        type: {
          type: ['string', 'null'],
          enum: ['reply_to_thread', 'new_thread'],
        },
        include_signature: {
          type: ['boolean', 'null'],
        },
        has_personalized_opener: {
          type: ['boolean', 'null'],
        },
        personalized_opener_fallback_option: {
          type: ['string', 'null'],
        },
        generic_personalized_opener: {
          type: ['string', 'null'],
        },
        unique_scheduled: {
          $ref: '#/components/schemas/metric',
        },
        unique_delivered: {
          $ref: '#/components/schemas/metric',
        },
        unique_bounced: {
          $ref: '#/components/schemas/metric',
        },
        unique_opened: {
          $ref: '#/components/schemas/metric',
        },
        unique_replied: {
          $ref: '#/components/schemas/metric',
        },
        bounce_rate: {
          $ref: '#/components/schemas/metric',
        },
        open_rate: {
          $ref: '#/components/schemas/metric',
        },
        reply_rate: {
          $ref: '#/components/schemas/metric',
        },
        demo_rate: {
          $ref: '#/components/schemas/metric',
        },
        unique_demoed: {
          $ref: '#/components/schemas/metric',
        },
        unique_clicked: {
          $ref: '#/components/schemas/metric',
        },
        click_rate: {
          $ref: '#/components/schemas/metric',
        },
        unique_unsubscribed: {
          $ref: '#/components/schemas/metric',
        },
        opt_out_rate: {
          $ref: '#/components/schemas/metric',
        },
        unique_hard_bounced: {
          $ref: '#/components/schemas/metric',
        },
        unique_spam_blocked: {
          $ref: '#/components/schemas/metric',
        },
        hard_bounce_rate: {
          $ref: '#/components/schemas/metric',
        },
        spam_block_rate: {
          $ref: '#/components/schemas/metric',
        },
      },
      required: ['id'],
    },
    emailer_template: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
        },
        name: {
          type: ['string', 'null'],
        },
        user_id: {
          type: ['string', 'null'],
        },
        subject: {
          type: ['string', 'null'],
        },
        archived: {
          type: ['boolean', 'null'],
        },
        created_at: {
          type: ['string', 'null'],
          format: 'date-time',
        },
        global: {
          type: ['boolean', 'null'],
        },
        body_text: {
          type: ['string', 'null'],
        },
        folder_id: {
          type: ['string', 'null'],
        },
        body_html: {
          type: ['string', 'null'],
        },
        creation_type: {
          type: ['string', 'null'],
        },
        label_ids: {
          type: ['array', 'null'],
          items: {
            type: 'string',
          },
        },
        prompt_id: {
          type: ['string', 'null'],
        },
      },
      required: ['id'],
    },
    contact: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
        },
        first_name: {
          type: 'string',
        },
        last_name: {
          type: 'string',
        },
        name: {
          type: 'string',
        },
        linkedin_url: {
          type: 'string',
          format: 'uri',
        },
        title: {
          type: 'string',
        },
        organization_name: {
          type: 'string',
        },
        organization_id: {
          type: 'string',
        },
        headline: {
          type: 'string',
        },
        photo_url: {
          type: 'string',
          format: 'uri',
        },
        updated_at: {
          type: 'string',
          format: 'date-time',
        },
        label_ids: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        email: {
          type: 'string',
          format: 'email',
        },
        phone_numbers: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Need to test this out...',
        },
        emailer_campaign_ids: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        contact_campaign_statuses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
              },
              send_email_from_email_account_id: {
                type: 'string',
              },
              emailer_campaign_id: {
                type: 'string',
              },
            },
            required: ['id', 'send_email_from_email_account_id', 'emailer_campaign_id'],
            additionalProperties: {},
          },
        },
      },
      required: ['id', 'contact_campaign_statuses'],
      additionalProperties: {},
    },
    email_account: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
        },
        userId: {},
        email: {},
        createdAt: {},
        updatedAt: {},
        lastModifiedAt: {},
        isDeleted: {},
        rawData: {},
        isDisabled: {},
      },
      required: ['id'],
      additionalProperties: {},
    },
  },
} as TComponents;
