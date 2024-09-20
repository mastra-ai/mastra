// @ts-nocheck
export type TComponents = {
  schemas: {
    department: {
      type: 'object';
      properties: {
        id: {
          type: 'number';
        };
        name: {
          type: 'string';
        };
        parent_id: {
          type: ['string', 'null'];
        };
        parent_department_external_ids: {
          type: ['string', 'null'];
        };
        child_ids: {
          type: ['array', 'null'];
          items: {
            type: 'number';
          };
        };
        child_department_external_ids: {
          type: ['array', 'null'];
          items: {
            type: 'number';
          };
        };
        external_id: {
          type: 'string';
        };
        children: {
          type: 'array';
          items: {};
        };
      };
      required: ['id', 'name', 'external_id', 'children'];
      additionalProperties: {};
    };
    job: {
      type: 'object';
      properties: {
        id: {
          type: 'number';
          description: 'The job’s unique identifier';
        };
        name: {
          type: 'string';
        };
        requisition_id: {
          type: 'string';
          description: 'An arbitrary ID provided by an external source; does not map to another entity within Greenhouse.';
        };
        notes: {
          type: 'string';
        };
        confidential: {
          type: 'boolean';
          description: 'One of true, false. If the job is confidential or not.';
        };
        status: {
          type: 'string';
          enum: ['open', 'closed', 'draft'];
        };
        created_at: {
          type: 'string';
        };
        opened_at: {
          type: 'string';
        };
        closed_at: {
          type: 'string';
        };
        updated_at: {
          type: 'string';
        };
        is_template: {
          type: ['boolean', 'null'];
          description: 'Is this job designated as a template used to create other jobs. This may be true, false, or null. Null is an indication this job was created before template job feature.';
        };
        copied_from_id: {
          type: 'number';
          description: 'If this job was copied from another job, this field contains the id of the source job.';
        };
        departments: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/department';
          };
        };
        offices: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/office';
          };
        };
        openings: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/opening';
          };
        };
        custom_fields: {
          type: 'object';
          additionalProperties: {};
        };
        keyed_custom_fields: {
          type: 'object';
          additionalProperties: {
            $ref: '#/components/schemas/keyedCustomFields';
          };
        };
        hiring_team: {
          $ref: '#/components/schemas/hiringTeam';
        };
      };
      required: [
        'id',
        'name',
        'requisition_id',
        'notes',
        'confidential',
        'status',
        'created_at',
        'opened_at',
        'closed_at',
        'updated_at',
        'is_template',
        'copied_from_id',
        'departments',
        'offices',
        'openings',
        'custom_fields',
        'keyed_custom_fields',
        'hiring_team',
      ];
      additionalProperties: {};
    };
    office: {
      type: 'object';
      properties: {
        id: {
          type: 'number';
        };
        name: {
          type: 'string';
        };
        location: {
          type: 'object';
          properties: {
            name: {
              type: 'string';
            };
          };
          required: ['name'];
        };
        parent_id: {
          type: 'number';
        };
        child_ids: {
          type: ['array', 'null'];
          items: {
            type: 'number';
          };
        };
        external_id: {
          type: 'string';
        };
      };
      required: ['id', 'name', 'location', 'parent_id', 'external_id'];
    };
    opening: {
      type: 'object';
      properties: {
        id: {
          type: 'number';
        };
        opening_id: {
          type: ['string', 'null'];
        };
        status: {
          type: 'string';
        };
        opened_at: {
          type: 'string';
        };
        closed_at: {
          type: 'string';
        };
        application_id: {
          type: 'number';
        };
        close_reason: {
          type: ['object', 'null'];
          properties: {
            id: {
              type: 'number';
            };
            name: {
              type: 'string';
            };
          };
          required: ['id', 'name'];
        };
      };
      required: ['id', 'opening_id', 'status', 'opened_at', 'closed_at', 'application_id', 'close_reason'];
    };
    keyedCustomFields: {
      type: 'object';
      properties: {
        name: {
          type: 'string';
        };
        type: {
          type: 'string';
        };
        value: {
          type: 'string';
        };
      };
      required: ['name', 'type', 'value'];
    };
    hiringTeam: {
      type: 'object';
      properties: {
        hiring_managers: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              id: {
                type: 'number';
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
              employee_id: {
                type: 'string';
              };
              responsible: {
                type: ['boolean', 'null'];
              };
            };
            required: ['id', 'first_name', 'last_name', 'name', 'employee_id'];
          };
        };
        recruiters: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              id: {
                type: 'number';
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
              employee_id: {
                type: 'string';
              };
              responsible: {
                type: ['boolean', 'null'];
              };
            };
            required: ['id', 'first_name', 'last_name', 'name', 'employee_id'];
          };
        };
        coordinators: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              id: {
                type: 'number';
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
              employee_id: {
                type: 'string';
              };
              responsible: {
                type: ['boolean', 'null'];
              };
            };
            required: ['id', 'first_name', 'last_name', 'name', 'employee_id'];
          };
        };
        sourcers: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              id: {
                type: 'number';
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
              employee_id: {
                type: 'string';
              };
              responsible: {
                type: ['boolean', 'null'];
              };
            };
            required: ['id', 'first_name', 'last_name', 'name', 'employee_id'];
          };
        };
      };
      required: ['hiring_managers', 'recruiters', 'coordinators', 'sourcers'];
    };
    offer: {
      type: 'object';
      properties: {
        id: {
          type: 'number';
        };
        version: {
          type: 'number';
        };
        application_id: {
          type: 'number';
        };
        job_id: {
          type: 'number';
        };
        candidate_id: {
          type: 'number';
        };
        opening: {
          $ref: '#/components/schemas/opening';
        };
        created_at: {
          type: 'string';
        };
        updated_at: {
          type: 'string';
        };
        sent_at: {
          type: 'string';
        };
        resolved_at: {
          type: 'string';
        };
        starts_at: {
          type: 'string';
        };
        status: {
          type: 'string';
        };
        custom_fields: {
          type: 'object';
          additionalProperties: {};
        };
        keyed_custom_fields: {
          type: 'object';
          additionalProperties: {
            $ref: '#/components/schemas/keyedCustomFields';
          };
        };
      };
      required: [
        'id',
        'version',
        'application_id',
        'job_id',
        'candidate_id',
        'opening',
        'created_at',
        'updated_at',
        'sent_at',
        'resolved_at',
        'starts_at',
        'status',
        'custom_fields',
        'keyed_custom_fields',
      ];
    };
    candidate: {
      type: 'object';
      properties: {
        id: {
          type: 'number';
        };
        first_name: {
          type: 'string';
        };
        last_name: {
          type: 'string';
        };
        company: {
          type: 'string';
        };
        title: {
          type: 'string';
        };
        created_at: {
          type: 'string';
        };
        updated_at: {
          type: 'string';
        };
        last_activity: {
          type: 'string';
        };
        is_private: {
          type: 'boolean';
        };
        photo_url: {
          type: ['string', 'null'];
        };
        application_ids: {
          type: 'array';
          items: {
            type: 'number';
          };
        };
        can_email: {
          type: 'boolean';
        };
        tags: {
          type: 'array';
          items: {
            type: 'string';
          };
        };
        attachments: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              filename: {
                type: 'string';
              };
              url: {
                type: 'string';
              };
              type: {
                type: 'string';
              };
              created_at: {
                type: 'string';
              };
            };
            required: ['filename', 'url', 'type', 'created_at'];
          };
        };
        phone_numbers: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              value: {
                type: 'string';
              };
              type: {
                type: ['string', 'null'];
              };
            };
            required: ['value'];
          };
        };
        addresses: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              value: {
                type: 'string';
              };
              type: {
                type: ['string', 'null'];
              };
            };
            required: ['value'];
          };
        };
        email_addresses: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              value: {
                type: 'string';
              };
              type: {
                type: ['string', 'null'];
              };
            };
            required: ['value'];
          };
        };
        website_addresses: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              value: {
                type: 'string';
              };
              type: {
                type: ['string', 'null'];
              };
            };
            required: ['value'];
          };
        };
        social_media_addresses: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              value: {
                type: 'string';
              };
              type: {
                type: ['string', 'null'];
              };
            };
            required: ['value'];
          };
        };
        recruiter: {
          type: 'object';
          properties: {
            id: {
              type: 'number';
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
            employee_id: {
              type: 'string';
            };
            responsible: {
              type: ['boolean', 'null'];
            };
          };
          required: ['id', 'first_name', 'last_name', 'name', 'employee_id'];
        };
        coordinator: {
          type: 'object';
          properties: {
            id: {
              type: 'number';
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
            employee_id: {
              type: 'string';
            };
            responsible: {
              type: ['boolean', 'null'];
            };
          };
          required: ['id', 'first_name', 'last_name', 'name', 'employee_id'];
        };
        applications: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/application';
          };
        };
      };
      required: [
        'id',
        'first_name',
        'last_name',
        'company',
        'title',
        'created_at',
        'updated_at',
        'last_activity',
        'is_private',
        'photo_url',
        'application_ids',
        'can_email',
        'tags',
        'attachments',
        'phone_numbers',
        'addresses',
        'email_addresses',
        'website_addresses',
        'social_media_addresses',
        'recruiter',
        'coordinator',
        'applications',
      ];
      additionalProperties: {};
      description: '\n    In Greenhouse Recruiting, a candidate is someone who applied for the job and is in the hiring pipeline. A prospect is someone who has not applied for a job but who you want to consider for future opportunities.\n    ';
    };
    application: {
      type: 'object';
      properties: {
        id: {
          type: 'number';
        };
        candidate_id: {
          type: 'number';
        };
        prospect: {
          type: 'boolean';
        };
        applied_at: {
          type: 'string';
        };
        rejected_at: {
          anyOf: [
            {
              type: 'null';
            },
            {
              type: 'string';
            },
          ];
        };
        last_activity_at: {
          type: 'string';
        };
        location: {
          type: 'object';
          properties: {
            address: {
              type: 'string';
            };
          };
          required: ['address'];
        };
        source: {
          type: 'object';
          properties: {
            id: {
              type: 'number';
            };
            public_name: {
              type: 'string';
            };
          };
          required: ['id', 'public_name'];
        };
        credited_to: {
          type: 'object';
          properties: {
            id: {
              type: 'number';
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
            employee_id: {
              type: 'string';
            };
          };
          required: ['id', 'first_name', 'last_name', 'name', 'employee_id'];
        };
        rejection_reason: {
          anyOf: [
            {
              type: 'null';
            },
            {
              type: 'string';
            },
          ];
        };
        rejection_details: {
          anyOf: [
            {
              type: 'null';
            },
            {
              type: 'string';
            },
          ];
        };
        jobs: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              id: {
                type: 'number';
              };
              name: {
                type: 'string';
              };
            };
            required: ['id', 'name'];
          };
        };
        job_post_id: {
          type: 'number';
        };
        status: {
          type: 'string';
        };
        current_stage: {
          type: 'object';
          properties: {
            id: {
              type: 'number';
            };
            name: {
              type: 'string';
            };
          };
          required: ['id', 'name'];
        };
        answers: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              question: {
                type: 'string';
              };
              answer: {
                type: 'string';
              };
            };
            required: ['question', 'answer'];
          };
        };
        prospective_office: {
          anyOf: [
            {
              type: 'null';
            },
            {
              type: 'string';
            },
          ];
        };
        prospective_department: {
          anyOf: [
            {
              type: 'null';
            },
            {
              type: 'string';
            },
          ];
        };
        prospect_detail: {
          type: 'object';
          properties: {
            prospect_pool: {
              anyOf: [
                {
                  type: 'null';
                },
                {
                  type: 'string';
                },
              ];
            };
            prospect_stage: {
              anyOf: [
                {
                  type: 'null';
                },
                {
                  type: 'string';
                },
              ];
            };
            prospect_owner: {
              anyOf: [
                {
                  type: 'null';
                },
                {
                  type: 'string';
                },
              ];
            };
          };
          required: ['prospect_pool', 'prospect_stage', 'prospect_owner'];
        };
        custom_fields: {
          type: 'object';
          properties: {
            application_custom_test: {
              anyOf: [
                {
                  type: 'null';
                },
                {
                  type: 'string';
                },
              ];
            };
          };
          required: ['application_custom_test'];
        };
        keyed_custom_fields: {
          type: 'object';
          properties: {
            application_custom_test: {
              type: 'object';
              properties: {
                name: {
                  type: 'string';
                };
                type: {
                  type: 'string';
                };
                value: {
                  type: 'string';
                };
              };
              required: ['name', 'type', 'value'];
            };
          };
          required: ['application_custom_test'];
        };
        attachments: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/attachment';
          };
        };
      };
      required: [
        'id',
        'candidate_id',
        'prospect',
        'applied_at',
        'rejected_at',
        'last_activity_at',
        'location',
        'source',
        'credited_to',
        'rejection_reason',
        'rejection_details',
        'jobs',
        'job_post_id',
        'status',
        'current_stage',
        'answers',
        'prospective_office',
        'prospective_department',
        'prospect_detail',
        'custom_fields',
        'keyed_custom_fields',
        'attachments',
      ];
    };
    attachment: {
      type: 'object';
      properties: {
        filename: {
          type: 'string';
        };
        url: {
          type: 'string';
        };
        type: {
          type: 'string';
        };
        created_at: {
          type: 'string';
        };
      };
      required: ['filename', 'url', 'type', 'created_at'];
    };
  };
};
export const components = {
  schemas: {
    department: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
        },
        name: {
          type: 'string',
        },
        parent_id: {
          type: ['string', 'null'],
        },
        parent_department_external_ids: {
          type: ['string', 'null'],
        },
        child_ids: {
          type: ['array', 'null'],
          items: {
            type: 'number',
          },
        },
        child_department_external_ids: {
          type: ['array', 'null'],
          items: {
            type: 'number',
          },
        },
        external_id: {
          type: 'string',
        },
        children: {
          type: 'array',
          items: {},
        },
      },
      required: ['id', 'name', 'external_id', 'children'],
      additionalProperties: {},
    },
    job: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'The job’s unique identifier',
        },
        name: {
          type: 'string',
        },
        requisition_id: {
          type: 'string',
          description:
            'An arbitrary ID provided by an external source; does not map to another entity within Greenhouse.',
        },
        notes: {
          type: 'string',
        },
        confidential: {
          type: 'boolean',
          description: 'One of true, false. If the job is confidential or not.',
        },
        status: {
          type: 'string',
          enum: ['open', 'closed', 'draft'],
        },
        created_at: {
          type: 'string',
        },
        opened_at: {
          type: 'string',
        },
        closed_at: {
          type: 'string',
        },
        updated_at: {
          type: 'string',
        },
        is_template: {
          type: ['boolean', 'null'],
          description:
            'Is this job designated as a template used to create other jobs. This may be true, false, or null. Null is an indication this job was created before template job feature.',
        },
        copied_from_id: {
          type: 'number',
          description: 'If this job was copied from another job, this field contains the id of the source job.',
        },
        departments: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/department',
          },
        },
        offices: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/office',
          },
        },
        openings: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/opening',
          },
        },
        custom_fields: {
          type: 'object',
          additionalProperties: {},
        },
        keyed_custom_fields: {
          type: 'object',
          additionalProperties: {
            $ref: '#/components/schemas/keyedCustomFields',
          },
        },
        hiring_team: {
          $ref: '#/components/schemas/hiringTeam',
        },
      },
      required: [
        'id',
        'name',
        'requisition_id',
        'notes',
        'confidential',
        'status',
        'created_at',
        'opened_at',
        'closed_at',
        'updated_at',
        'is_template',
        'copied_from_id',
        'departments',
        'offices',
        'openings',
        'custom_fields',
        'keyed_custom_fields',
        'hiring_team',
      ],
      additionalProperties: {},
    },
    office: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
        },
        name: {
          type: 'string',
        },
        location: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
            },
          },
          required: ['name'],
        },
        parent_id: {
          type: 'number',
        },
        child_ids: {
          type: ['array', 'null'],
          items: {
            type: 'number',
          },
        },
        external_id: {
          type: 'string',
        },
      },
      required: ['id', 'name', 'location', 'parent_id', 'external_id'],
    },
    opening: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
        },
        opening_id: {
          type: ['string', 'null'],
        },
        status: {
          type: 'string',
        },
        opened_at: {
          type: 'string',
        },
        closed_at: {
          type: 'string',
        },
        application_id: {
          type: 'number',
        },
        close_reason: {
          type: ['object', 'null'],
          properties: {
            id: {
              type: 'number',
            },
            name: {
              type: 'string',
            },
          },
          required: ['id', 'name'],
        },
      },
      required: ['id', 'opening_id', 'status', 'opened_at', 'closed_at', 'application_id', 'close_reason'],
    },
    keyedCustomFields: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
        },
        type: {
          type: 'string',
        },
        value: {
          type: 'string',
        },
      },
      required: ['name', 'type', 'value'],
    },
    hiringTeam: {
      type: 'object',
      properties: {
        hiring_managers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'number',
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
              employee_id: {
                type: 'string',
              },
              responsible: {
                type: ['boolean', 'null'],
              },
            },
            required: ['id', 'first_name', 'last_name', 'name', 'employee_id'],
          },
        },
        recruiters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'number',
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
              employee_id: {
                type: 'string',
              },
              responsible: {
                type: ['boolean', 'null'],
              },
            },
            required: ['id', 'first_name', 'last_name', 'name', 'employee_id'],
          },
        },
        coordinators: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'number',
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
              employee_id: {
                type: 'string',
              },
              responsible: {
                type: ['boolean', 'null'],
              },
            },
            required: ['id', 'first_name', 'last_name', 'name', 'employee_id'],
          },
        },
        sourcers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'number',
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
              employee_id: {
                type: 'string',
              },
              responsible: {
                type: ['boolean', 'null'],
              },
            },
            required: ['id', 'first_name', 'last_name', 'name', 'employee_id'],
          },
        },
      },
      required: ['hiring_managers', 'recruiters', 'coordinators', 'sourcers'],
    },
    offer: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
        },
        version: {
          type: 'number',
        },
        application_id: {
          type: 'number',
        },
        job_id: {
          type: 'number',
        },
        candidate_id: {
          type: 'number',
        },
        opening: {
          $ref: '#/components/schemas/opening',
        },
        created_at: {
          type: 'string',
        },
        updated_at: {
          type: 'string',
        },
        sent_at: {
          type: 'string',
        },
        resolved_at: {
          type: 'string',
        },
        starts_at: {
          type: 'string',
        },
        status: {
          type: 'string',
        },
        custom_fields: {
          type: 'object',
          additionalProperties: {},
        },
        keyed_custom_fields: {
          type: 'object',
          additionalProperties: {
            $ref: '#/components/schemas/keyedCustomFields',
          },
        },
      },
      required: [
        'id',
        'version',
        'application_id',
        'job_id',
        'candidate_id',
        'opening',
        'created_at',
        'updated_at',
        'sent_at',
        'resolved_at',
        'starts_at',
        'status',
        'custom_fields',
        'keyed_custom_fields',
      ],
    },
    candidate: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
        },
        first_name: {
          type: 'string',
        },
        last_name: {
          type: 'string',
        },
        company: {
          type: 'string',
        },
        title: {
          type: 'string',
        },
        created_at: {
          type: 'string',
        },
        updated_at: {
          type: 'string',
        },
        last_activity: {
          type: 'string',
        },
        is_private: {
          type: 'boolean',
        },
        photo_url: {
          type: ['string', 'null'],
        },
        application_ids: {
          type: 'array',
          items: {
            type: 'number',
          },
        },
        can_email: {
          type: 'boolean',
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        attachments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
              },
              url: {
                type: 'string',
              },
              type: {
                type: 'string',
              },
              created_at: {
                type: 'string',
              },
            },
            required: ['filename', 'url', 'type', 'created_at'],
          },
        },
        phone_numbers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: {
                type: 'string',
              },
              type: {
                type: ['string', 'null'],
              },
            },
            required: ['value'],
          },
        },
        addresses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: {
                type: 'string',
              },
              type: {
                type: ['string', 'null'],
              },
            },
            required: ['value'],
          },
        },
        email_addresses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: {
                type: 'string',
              },
              type: {
                type: ['string', 'null'],
              },
            },
            required: ['value'],
          },
        },
        website_addresses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: {
                type: 'string',
              },
              type: {
                type: ['string', 'null'],
              },
            },
            required: ['value'],
          },
        },
        social_media_addresses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: {
                type: 'string',
              },
              type: {
                type: ['string', 'null'],
              },
            },
            required: ['value'],
          },
        },
        recruiter: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
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
            employee_id: {
              type: 'string',
            },
            responsible: {
              type: ['boolean', 'null'],
            },
          },
          required: ['id', 'first_name', 'last_name', 'name', 'employee_id'],
        },
        coordinator: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
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
            employee_id: {
              type: 'string',
            },
            responsible: {
              type: ['boolean', 'null'],
            },
          },
          required: ['id', 'first_name', 'last_name', 'name', 'employee_id'],
        },
        applications: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/application',
          },
        },
      },
      required: [
        'id',
        'first_name',
        'last_name',
        'company',
        'title',
        'created_at',
        'updated_at',
        'last_activity',
        'is_private',
        'photo_url',
        'application_ids',
        'can_email',
        'tags',
        'attachments',
        'phone_numbers',
        'addresses',
        'email_addresses',
        'website_addresses',
        'social_media_addresses',
        'recruiter',
        'coordinator',
        'applications',
      ],
      additionalProperties: {},
      description:
        '\n    In Greenhouse Recruiting, a candidate is someone who applied for the job and is in the hiring pipeline. A prospect is someone who has not applied for a job but who you want to consider for future opportunities.\n    ',
    },
    application: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
        },
        candidate_id: {
          type: 'number',
        },
        prospect: {
          type: 'boolean',
        },
        applied_at: {
          type: 'string',
        },
        rejected_at: {
          anyOf: [
            {
              type: 'null',
            },
            {
              type: 'string',
            },
          ],
        },
        last_activity_at: {
          type: 'string',
        },
        location: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
            },
          },
          required: ['address'],
        },
        source: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
            },
            public_name: {
              type: 'string',
            },
          },
          required: ['id', 'public_name'],
        },
        credited_to: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
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
            employee_id: {
              type: 'string',
            },
          },
          required: ['id', 'first_name', 'last_name', 'name', 'employee_id'],
        },
        rejection_reason: {
          anyOf: [
            {
              type: 'null',
            },
            {
              type: 'string',
            },
          ],
        },
        rejection_details: {
          anyOf: [
            {
              type: 'null',
            },
            {
              type: 'string',
            },
          ],
        },
        jobs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'number',
              },
              name: {
                type: 'string',
              },
            },
            required: ['id', 'name'],
          },
        },
        job_post_id: {
          type: 'number',
        },
        status: {
          type: 'string',
        },
        current_stage: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
            },
            name: {
              type: 'string',
            },
          },
          required: ['id', 'name'],
        },
        answers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
              },
              answer: {
                type: 'string',
              },
            },
            required: ['question', 'answer'],
          },
        },
        prospective_office: {
          anyOf: [
            {
              type: 'null',
            },
            {
              type: 'string',
            },
          ],
        },
        prospective_department: {
          anyOf: [
            {
              type: 'null',
            },
            {
              type: 'string',
            },
          ],
        },
        prospect_detail: {
          type: 'object',
          properties: {
            prospect_pool: {
              anyOf: [
                {
                  type: 'null',
                },
                {
                  type: 'string',
                },
              ],
            },
            prospect_stage: {
              anyOf: [
                {
                  type: 'null',
                },
                {
                  type: 'string',
                },
              ],
            },
            prospect_owner: {
              anyOf: [
                {
                  type: 'null',
                },
                {
                  type: 'string',
                },
              ],
            },
          },
          required: ['prospect_pool', 'prospect_stage', 'prospect_owner'],
        },
        custom_fields: {
          type: 'object',
          properties: {
            application_custom_test: {
              anyOf: [
                {
                  type: 'null',
                },
                {
                  type: 'string',
                },
              ],
            },
          },
          required: ['application_custom_test'],
        },
        keyed_custom_fields: {
          type: 'object',
          properties: {
            application_custom_test: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                },
                type: {
                  type: 'string',
                },
                value: {
                  type: 'string',
                },
              },
              required: ['name', 'type', 'value'],
            },
          },
          required: ['application_custom_test'],
        },
        attachments: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/attachment',
          },
        },
      },
      required: [
        'id',
        'candidate_id',
        'prospect',
        'applied_at',
        'rejected_at',
        'last_activity_at',
        'location',
        'source',
        'credited_to',
        'rejection_reason',
        'rejection_details',
        'jobs',
        'job_post_id',
        'status',
        'current_stage',
        'answers',
        'prospective_office',
        'prospective_department',
        'prospect_detail',
        'custom_fields',
        'keyed_custom_fields',
        'attachments',
      ],
    },
    attachment: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
        },
        url: {
          type: 'string',
        },
        type: {
          type: 'string',
        },
        created_at: {
          type: 'string',
        },
      },
      required: ['filename', 'url', 'type', 'created_at'],
    },
  },
} as TComponents;
