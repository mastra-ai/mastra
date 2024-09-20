// @ts-nocheck
export type TComponents = {
  schemas: {
    posting: {
      type: 'object';
      properties: {
        id: {
          type: 'string';
        };
        text: {
          type: 'string';
        };
        createdAt: {
          type: 'number';
        };
        updatedAt: {
          type: 'number';
        };
        user: {
          type: 'string';
        };
        owner: {
          type: 'string';
        };
        hiringManager: {
          type: 'string';
        };
        confidentiality: {
          type: 'string';
          enum: ['non-confidential', 'confidential'];
        };
        categories: {
          type: 'object';
          properties: {
            team: {
              type: 'string';
            };
            department: {
              type: 'string';
            };
            location: {
              type: 'string';
            };
            allLocations: {
              type: 'array';
              items: {
                type: 'string';
              };
            };
            commitment: {
              type: 'string';
            };
            level: {
              type: 'string';
            };
          };
          required: ['team', 'department', 'location', 'allLocations', 'commitment', 'level'];
        };
        content: {
          type: 'object';
          properties: {
            description: {
              type: 'string';
            };
            descriptionHtml: {
              type: 'string';
            };
            lists: {
              type: 'array';
              items: {
                type: 'object';
                properties: {
                  text: {
                    type: 'string';
                  };
                  content: {
                    type: 'string';
                  };
                };
                required: ['text', 'content'];
              };
            };
            closing: {
              type: 'string';
            };
            closingHtml: {
              type: 'string';
            };
          };
          required: ['description', 'descriptionHtml', 'lists', 'closing', 'closingHtml'];
        };
        country: {
          type: 'string';
        };
        tags: {
          type: 'array';
          items: {
            type: 'string';
          };
        };
        state: {
          type: 'string';
          enum: ['published'];
        };
        distributionChannels: {
          type: 'array';
          items: {
            type: 'string';
            enum: ['internal', 'public'];
          };
        };
        reqCode: {
          type: 'string';
        };
        requisitionCodes: {
          type: 'array';
          items: {
            type: 'string';
          };
        };
        salaryDescription: {
          type: 'string';
        };
        salaryDescriptionHtml: {
          type: 'string';
        };
        salaryRange: {
          type: 'object';
          properties: {
            max: {
              type: 'number';
            };
            min: {
              type: 'number';
            };
            currency: {
              type: 'string';
            };
            interval: {
              type: 'string';
              enum: ['per-year-salary'];
            };
          };
          required: ['max', 'min', 'currency', 'interval'];
        };
        urls: {
          type: 'object';
          properties: {
            list: {
              type: 'string';
              format: 'uri';
            };
            show: {
              type: 'string';
              format: 'uri';
            };
            apply: {
              type: 'string';
              format: 'uri';
            };
          };
          required: ['list', 'show', 'apply'];
        };
        workplaceType: {
          type: 'string';
          enum: ['remote'];
        };
      };
      required: [
        'id',
        'text',
        'createdAt',
        'updatedAt',
        'user',
        'owner',
        'hiringManager',
        'confidentiality',
        'categories',
        'content',
        'country',
        'tags',
        'state',
        'distributionChannels',
        'reqCode',
        'requisitionCodes',
        'salaryDescription',
        'salaryDescriptionHtml',
        'salaryRange',
        'urls',
        'workplaceType',
      ];
      additionalProperties: {};
    };
    opportunity: {
      type: 'object';
      properties: {
        id: {
          type: 'string';
        };
        name: {
          type: 'string';
        };
        headline: {
          type: 'string';
        };
        contact: {
          type: 'string';
        };
        emails: {
          type: 'array';
          items: {
            type: 'string';
            format: 'email';
          };
        };
        phones: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              value: {
                type: 'string';
              };
            };
            required: ['value'];
          };
        };
        confidentiality: {
          type: 'string';
        };
        location: {
          type: 'string';
        };
        links: {
          type: 'array';
          items: {
            type: 'string';
            format: 'uri';
          };
        };
        createdAt: {
          type: 'number';
        };
        updatedAt: {
          type: 'number';
        };
        lastInteractionAt: {
          type: 'number';
        };
        lastAdvancedAt: {
          type: 'number';
        };
        snoozedUntil: {
          type: ['number', 'null'];
        };
        archivedAt: {
          type: ['number', 'null'];
        };
        archiveReason: {
          type: ['string', 'null'];
        };
        stage: {
          type: 'string';
        };
        stageChanges: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              toStageId: {
                type: 'string';
              };
              toStageIndex: {
                type: 'number';
              };
              userId: {
                type: 'string';
              };
              updatedAt: {
                type: 'number';
              };
            };
            required: ['toStageId', 'toStageIndex', 'userId', 'updatedAt'];
          };
        };
        owner: {
          type: 'string';
        };
        tags: {
          type: 'array';
          items: {
            type: 'string';
          };
        };
        sources: {
          type: 'array';
          items: {
            type: 'string';
          };
        };
        origin: {
          type: 'string';
        };
        sourcedBy: {
          type: 'string';
        };
        applications: {
          type: 'array';
          items: {
            type: 'string';
          };
        };
        resume: {
          type: 'null';
        };
        followers: {
          type: 'array';
          items: {
            type: 'string';
          };
        };
        urls: {
          type: 'object';
          properties: {
            list: {
              type: 'string';
              format: 'uri';
            };
            show: {
              type: 'string';
              format: 'uri';
            };
          };
          required: ['list', 'show'];
        };
        dataProtection: {
          type: 'object';
          properties: {
            store: {
              type: 'object';
              properties: {
                allowed: {
                  type: 'boolean';
                };
                expiresAt: {
                  type: ['number', 'null'];
                };
              };
              required: ['allowed', 'expiresAt'];
            };
            contact: {
              type: 'object';
              properties: {
                allowed: {
                  type: 'boolean';
                };
                expiresAt: {
                  type: ['number', 'null'];
                };
              };
              required: ['allowed', 'expiresAt'];
            };
          };
          required: ['store', 'contact'];
        };
        isAnonymized: {
          type: 'boolean';
        };
      };
      required: [
        'id',
        'name',
        'headline',
        'contact',
        'emails',
        'phones',
        'confidentiality',
        'location',
        'links',
        'createdAt',
        'updatedAt',
        'lastInteractionAt',
        'lastAdvancedAt',
        'snoozedUntil',
        'archivedAt',
        'archiveReason',
        'stage',
        'stageChanges',
        'owner',
        'tags',
        'sources',
        'origin',
        'sourcedBy',
        'applications',
        'followers',
        'urls',
        'dataProtection',
        'isAnonymized',
      ];
      description: '\n"Candidates" are individuals who have been added to your Lever account as potential fits for your open job positions. "Opportunities" represent each of an individual’s unique candidacies or journeys through your pipeline for a given job position, meaning a single Candidate can be associated with multiple Opportunities. A “Contact” is a unique individual who may or may not have multiple candidacies or Opportunities.\n\nCandidates enter your pipeline for a new Opportunity by:\n\nApplying to a posting on your jobs site,\nBeing added by an external recruiting agency,\nBeing referred by an employee,\nBeing manually added by a Lever user, or\nBeing sourced from an online profile.\nEach Opportunity can have their own notes, feedback, interview schedules, and additional forms. An opportunity may be “confidential” if it is moving through your pipeline for a job posting that has been created as confidential. Opportunities exit your pipeline by being archived for one of two reasons: (1) The candidate was rejected for the opportunity, or (2) The candidate was hired for the opportunity.\n\nA "Contact" is an object that our application uses internally to identify an individual person and their personal or contact information, even though they may have multiple opportunities. From this API, the "Contact" is exposed via the contact field, which returns the unique ID for a Contact across your account. Contact information will be shared and consistent across an individual person\'s opportunities, and will continue to be aggregated onto individual opportunities in the responses to all GET and POST requests to /opportunities.\n\n@see https://hire.sandbox.lever.co/developer/documentation#opportunities\n\n\nWARNING: The Candidates (/candidates) endpoints were deprecated as of 2020. Though they are maintained for backwards compatibility, going forward please see Opportunities endpoints to find the contacts for each job opportunity.\n    ';
    };
    offer: {
      type: 'object';
      properties: {
        id: {
          type: 'string';
          format: 'uuid';
        };
        createdAt: {
          type: 'number';
        };
        status: {
          type: 'string';
          enum: ['draft', 'approval-sent', 'approved', 'sent', 'sent-manually', 'opened', 'denied', 'signed'];
        };
        creator: {
          type: 'string';
          format: 'uuid';
        };
        fields: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              text: {
                type: 'string';
              };
              identifier: {
                type: 'string';
              };
              value: {
                anyOf: [
                  {
                    type: 'string';
                  },
                  {
                    type: 'number';
                  },
                ];
              };
            };
            required: ['text', 'identifier', 'value'];
          };
        };
        sentDocument: {
          type: ['object', 'null'];
          properties: {
            fileName: {
              type: 'string';
            };
            uploadedAt: {
              type: 'number';
            };
            downloadUrl: {
              type: 'string';
              format: 'uri';
            };
          };
          required: ['fileName', 'uploadedAt', 'downloadUrl'];
        };
        signedDocument: {
          type: ['object', 'null'];
          properties: {
            fileName: {
              type: 'string';
            };
            uploadedAt: {
              type: 'number';
            };
            downloadUrl: {
              type: 'string';
              format: 'uri';
            };
          };
          required: ['fileName', 'uploadedAt', 'downloadUrl'];
        };
      };
      required: ['id', 'createdAt', 'status', 'creator', 'fields', 'sentDocument', 'signedDocument'];
      additionalProperties: {};
    };
    contact: {
      type: 'object';
      properties: {
        id: {
          type: 'string';
        };
        name: {
          type: 'string';
        };
        headline: {
          type: 'string';
        };
        isAnonymized: {
          type: 'boolean';
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
        emails: {
          type: 'array';
          items: {
            type: 'string';
            format: 'email';
          };
        };
        phones: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              value: {
                type: 'string';
              };
            };
            required: ['value'];
          };
        };
      };
      required: ['id', 'name', 'headline', 'isAnonymized', 'location', 'emails', 'phones'];
    };
    tag: {
      type: 'object';
      properties: {
        text: {
          type: 'string';
        };
        count: {
          type: 'number';
        };
      };
      required: ['text', 'count'];
    };
  };
};
export const components = {
  schemas: {
    posting: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
        },
        text: {
          type: 'string',
        },
        createdAt: {
          type: 'number',
        },
        updatedAt: {
          type: 'number',
        },
        user: {
          type: 'string',
        },
        owner: {
          type: 'string',
        },
        hiringManager: {
          type: 'string',
        },
        confidentiality: {
          type: 'string',
          enum: ['non-confidential', 'confidential'],
        },
        categories: {
          type: 'object',
          properties: {
            team: {
              type: 'string',
            },
            department: {
              type: 'string',
            },
            location: {
              type: 'string',
            },
            allLocations: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            commitment: {
              type: 'string',
            },
            level: {
              type: 'string',
            },
          },
          required: ['team', 'department', 'location', 'allLocations', 'commitment', 'level'],
        },
        content: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
            },
            descriptionHtml: {
              type: 'string',
            },
            lists: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: {
                    type: 'string',
                  },
                  content: {
                    type: 'string',
                  },
                },
                required: ['text', 'content'],
              },
            },
            closing: {
              type: 'string',
            },
            closingHtml: {
              type: 'string',
            },
          },
          required: ['description', 'descriptionHtml', 'lists', 'closing', 'closingHtml'],
        },
        country: {
          type: 'string',
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        state: {
          type: 'string',
          enum: ['published'],
        },
        distributionChannels: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['internal', 'public'],
          },
        },
        reqCode: {
          type: 'string',
        },
        requisitionCodes: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        salaryDescription: {
          type: 'string',
        },
        salaryDescriptionHtml: {
          type: 'string',
        },
        salaryRange: {
          type: 'object',
          properties: {
            max: {
              type: 'number',
            },
            min: {
              type: 'number',
            },
            currency: {
              type: 'string',
            },
            interval: {
              type: 'string',
              enum: ['per-year-salary'],
            },
          },
          required: ['max', 'min', 'currency', 'interval'],
        },
        urls: {
          type: 'object',
          properties: {
            list: {
              type: 'string',
              format: 'uri',
            },
            show: {
              type: 'string',
              format: 'uri',
            },
            apply: {
              type: 'string',
              format: 'uri',
            },
          },
          required: ['list', 'show', 'apply'],
        },
        workplaceType: {
          type: 'string',
          enum: ['remote'],
        },
      },
      required: [
        'id',
        'text',
        'createdAt',
        'updatedAt',
        'user',
        'owner',
        'hiringManager',
        'confidentiality',
        'categories',
        'content',
        'country',
        'tags',
        'state',
        'distributionChannels',
        'reqCode',
        'requisitionCodes',
        'salaryDescription',
        'salaryDescriptionHtml',
        'salaryRange',
        'urls',
        'workplaceType',
      ],
      additionalProperties: {},
    },
    opportunity: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
        },
        name: {
          type: 'string',
        },
        headline: {
          type: 'string',
        },
        contact: {
          type: 'string',
        },
        emails: {
          type: 'array',
          items: {
            type: 'string',
            format: 'email',
          },
        },
        phones: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: {
                type: 'string',
              },
            },
            required: ['value'],
          },
        },
        confidentiality: {
          type: 'string',
        },
        location: {
          type: 'string',
        },
        links: {
          type: 'array',
          items: {
            type: 'string',
            format: 'uri',
          },
        },
        createdAt: {
          type: 'number',
        },
        updatedAt: {
          type: 'number',
        },
        lastInteractionAt: {
          type: 'number',
        },
        lastAdvancedAt: {
          type: 'number',
        },
        snoozedUntil: {
          type: ['number', 'null'],
        },
        archivedAt: {
          type: ['number', 'null'],
        },
        archiveReason: {
          type: ['string', 'null'],
        },
        stage: {
          type: 'string',
        },
        stageChanges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              toStageId: {
                type: 'string',
              },
              toStageIndex: {
                type: 'number',
              },
              userId: {
                type: 'string',
              },
              updatedAt: {
                type: 'number',
              },
            },
            required: ['toStageId', 'toStageIndex', 'userId', 'updatedAt'],
          },
        },
        owner: {
          type: 'string',
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        sources: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        origin: {
          type: 'string',
        },
        sourcedBy: {
          type: 'string',
        },
        applications: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        resume: {
          type: 'null',
        },
        followers: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        urls: {
          type: 'object',
          properties: {
            list: {
              type: 'string',
              format: 'uri',
            },
            show: {
              type: 'string',
              format: 'uri',
            },
          },
          required: ['list', 'show'],
        },
        dataProtection: {
          type: 'object',
          properties: {
            store: {
              type: 'object',
              properties: {
                allowed: {
                  type: 'boolean',
                },
                expiresAt: {
                  type: ['number', 'null'],
                },
              },
              required: ['allowed', 'expiresAt'],
            },
            contact: {
              type: 'object',
              properties: {
                allowed: {
                  type: 'boolean',
                },
                expiresAt: {
                  type: ['number', 'null'],
                },
              },
              required: ['allowed', 'expiresAt'],
            },
          },
          required: ['store', 'contact'],
        },
        isAnonymized: {
          type: 'boolean',
        },
      },
      required: [
        'id',
        'name',
        'headline',
        'contact',
        'emails',
        'phones',
        'confidentiality',
        'location',
        'links',
        'createdAt',
        'updatedAt',
        'lastInteractionAt',
        'lastAdvancedAt',
        'snoozedUntil',
        'archivedAt',
        'archiveReason',
        'stage',
        'stageChanges',
        'owner',
        'tags',
        'sources',
        'origin',
        'sourcedBy',
        'applications',
        'followers',
        'urls',
        'dataProtection',
        'isAnonymized',
      ],
      description:
        '\n"Candidates" are individuals who have been added to your Lever account as potential fits for your open job positions. "Opportunities" represent each of an individual’s unique candidacies or journeys through your pipeline for a given job position, meaning a single Candidate can be associated with multiple Opportunities. A “Contact” is a unique individual who may or may not have multiple candidacies or Opportunities.\n\nCandidates enter your pipeline for a new Opportunity by:\n\nApplying to a posting on your jobs site,\nBeing added by an external recruiting agency,\nBeing referred by an employee,\nBeing manually added by a Lever user, or\nBeing sourced from an online profile.\nEach Opportunity can have their own notes, feedback, interview schedules, and additional forms. An opportunity may be “confidential” if it is moving through your pipeline for a job posting that has been created as confidential. Opportunities exit your pipeline by being archived for one of two reasons: (1) The candidate was rejected for the opportunity, or (2) The candidate was hired for the opportunity.\n\nA "Contact" is an object that our application uses internally to identify an individual person and their personal or contact information, even though they may have multiple opportunities. From this API, the "Contact" is exposed via the contact field, which returns the unique ID for a Contact across your account. Contact information will be shared and consistent across an individual person\'s opportunities, and will continue to be aggregated onto individual opportunities in the responses to all GET and POST requests to /opportunities.\n\n@see https://hire.sandbox.lever.co/developer/documentation#opportunities\n\n\nWARNING: The Candidates (/candidates) endpoints were deprecated as of 2020. Though they are maintained for backwards compatibility, going forward please see Opportunities endpoints to find the contacts for each job opportunity.\n    ',
    },
    offer: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
        },
        createdAt: {
          type: 'number',
        },
        status: {
          type: 'string',
          enum: ['draft', 'approval-sent', 'approved', 'sent', 'sent-manually', 'opened', 'denied', 'signed'],
        },
        creator: {
          type: 'string',
          format: 'uuid',
        },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
              },
              identifier: {
                type: 'string',
              },
              value: {
                anyOf: [
                  {
                    type: 'string',
                  },
                  {
                    type: 'number',
                  },
                ],
              },
            },
            required: ['text', 'identifier', 'value'],
          },
        },
        sentDocument: {
          type: ['object', 'null'],
          properties: {
            fileName: {
              type: 'string',
            },
            uploadedAt: {
              type: 'number',
            },
            downloadUrl: {
              type: 'string',
              format: 'uri',
            },
          },
          required: ['fileName', 'uploadedAt', 'downloadUrl'],
        },
        signedDocument: {
          type: ['object', 'null'],
          properties: {
            fileName: {
              type: 'string',
            },
            uploadedAt: {
              type: 'number',
            },
            downloadUrl: {
              type: 'string',
              format: 'uri',
            },
          },
          required: ['fileName', 'uploadedAt', 'downloadUrl'],
        },
      },
      required: ['id', 'createdAt', 'status', 'creator', 'fields', 'sentDocument', 'signedDocument'],
      additionalProperties: {},
    },
    contact: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
        },
        name: {
          type: 'string',
        },
        headline: {
          type: 'string',
        },
        isAnonymized: {
          type: 'boolean',
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
        emails: {
          type: 'array',
          items: {
            type: 'string',
            format: 'email',
          },
        },
        phones: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: {
                type: 'string',
              },
            },
            required: ['value'],
          },
        },
      },
      required: ['id', 'name', 'headline', 'isAnonymized', 'location', 'emails', 'phones'],
    },
    tag: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
        },
        count: {
          type: 'number',
        },
      },
      required: ['text', 'count'],
    },
  },
} as TComponents;
