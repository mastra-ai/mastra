// @ts-nocheck
export type TComponents = {
  schemas: {
    PublicActionFunction: {
      required: ['functionSource', 'functionType'];
      type: 'object';
      properties: {
        functionSource: {
          type: 'string';
        };
        functionType: {
          type: 'string';
          enum: ['PRE_ACTION_EXECUTION', 'PRE_FETCH_OPTIONS', 'POST_FETCH_OPTIONS', 'POST_ACTION_EXECUTION'];
        };
        id: {
          type: 'string';
        };
      };
    };
    PublicActionDefinition: {
      required: ['actionUrl', 'functions', 'id', 'inputFields', 'labels', 'objectTypes', 'published', 'revisionId'];
      type: 'object';
      properties: {
        functions: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PublicActionFunctionIdentifier';
          };
        };
        actionUrl: {
          type: 'string';
        };
        published: {
          type: 'boolean';
        };
        labels: {
          type: 'object';
          additionalProperties: {
            $ref: '#/components/schemas/PublicActionLabels';
          };
        };
        inputFields: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/InputFieldDefinition';
          };
        };
        outputFields: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/OutputFieldDefinition';
          };
        };
        revisionId: {
          type: 'string';
        };
        archivedAt: {
          type: 'integer';
          format: 'int64';
        };
        inputFieldDependencies: {
          type: 'array';
          items: {
            oneOf: [
              {
                $ref: '#/components/schemas/PublicSingleFieldDependency';
              },
              {
                $ref: '#/components/schemas/PublicConditionalSingleFieldDependency';
              },
            ];
          };
        };
        executionRules: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PublicExecutionTranslationRule';
          };
        };
        id: {
          type: 'string';
        };
        objectTypes: {
          type: 'array';
          items: {
            type: 'string';
          };
        };
        objectRequestOptions: {
          $ref: '#/components/schemas/PublicObjectRequestOptions';
        };
      };
    };
    PublicConditionalSingleFieldDependency: {
      title: 'CONDITIONAL_SINGLE_FIELD';
      required: ['controllingFieldName', 'controllingFieldValue', 'dependencyType', 'dependentFieldNames'];
      type: 'object';
      properties: {
        dependencyType: {
          type: 'string';
          default: 'CONDITIONAL_SINGLE_FIELD';
          enum: ['CONDITIONAL_SINGLE_FIELD'];
        };
        controllingFieldName: {
          type: 'string';
        };
        controllingFieldValue: {
          type: 'string';
        };
        dependentFieldNames: {
          type: 'array';
          items: {
            type: 'string';
          };
        };
      };
    };
    PublicObjectRequestOptions: {
      required: ['properties'];
      type: 'object';
      properties: {
        properties: {
          type: 'array';
          items: {
            type: 'string';
          };
        };
      };
    };
    ErrorDetail: {
      required: ['message'];
      type: 'object';
      properties: {
        subCategory: {
          type: 'string';
          description: 'A specific category that contains more specific detail about the error';
        };
        code: {
          type: 'string';
          description: 'The status code associated with the error detail';
        };
        in: {
          type: 'string';
          description: 'The name of the field or parameter in which the error was found.';
        };
        context: {
          type: 'object';
          additionalProperties: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
          description: 'Context about the error condition';
          example: {
            missingScopes: ['scope1', 'scope2'];
          };
        };
        message: {
          type: 'string';
          description: 'A human readable message describing the error along with remediation steps where appropriate';
        };
      };
    };
    PublicActionLabels: {
      required: ['actionName'];
      type: 'object';
      properties: {
        inputFieldDescriptions: {
          type: 'object';
          additionalProperties: {
            type: 'string';
          };
        };
        appDisplayName: {
          type: 'string';
        };
        outputFieldLabels: {
          type: 'object';
          additionalProperties: {
            type: 'string';
          };
        };
        inputFieldOptionLabels: {
          type: 'object';
          additionalProperties: {
            type: 'object';
            additionalProperties: {
              type: 'string';
            };
          };
        };
        actionDescription: {
          type: 'string';
        };
        executionRules: {
          type: 'object';
          additionalProperties: {
            type: 'string';
          };
        };
        inputFieldLabels: {
          type: 'object';
          additionalProperties: {
            type: 'string';
          };
        };
        actionName: {
          type: 'string';
        };
        actionCardContent: {
          type: 'string';
        };
      };
    };
    PublicSingleFieldDependency: {
      title: 'SINGLE_FIELD';
      required: ['controllingFieldName', 'dependencyType', 'dependentFieldNames'];
      type: 'object';
      properties: {
        dependencyType: {
          type: 'string';
          default: 'SINGLE_FIELD';
          enum: ['SINGLE_FIELD'];
        };
        controllingFieldName: {
          type: 'string';
        };
        dependentFieldNames: {
          type: 'array';
          items: {
            type: 'string';
          };
        };
      };
    };
    ForwardPaging: {
      type: 'object';
      properties: {
        next: {
          $ref: '#/components/schemas/NextPage';
        };
      };
    };
    FieldTypeDefinition: {
      required: ['externalOptions', 'name', 'options', 'type'];
      type: 'object';
      properties: {
        helpText: {
          type: 'string';
        };
        referencedObjectType: {
          type: 'string';
          enum: [
            'CONTACT',
            'COMPANY',
            'DEAL',
            'ENGAGEMENT',
            'TICKET',
            'OWNER',
            'PRODUCT',
            'LINE_ITEM',
            'BET_DELIVERABLE_SERVICE',
            'CONTENT',
            'CONVERSATION',
            'BET_ALERT',
            'PORTAL',
            'QUOTE',
            'FORM_SUBMISSION_INBOUNDDB',
            'QUOTA',
            'UNSUBSCRIBE',
            'COMMUNICATION',
            'FEEDBACK_SUBMISSION',
            'ATTRIBUTION',
            'SALESFORCE_SYNC_ERROR',
            'RESTORABLE_CRM_OBJECT',
            'HUB',
            'LANDING_PAGE',
            'PRODUCT_OR_FOLDER',
            'TASK',
            'FORM',
            'MARKETING_EMAIL',
            'AD_ACCOUNT',
            'AD_CAMPAIGN',
            'AD_GROUP',
            'AD',
            'KEYWORD',
            'CAMPAIGN',
            'SOCIAL_CHANNEL',
            'SOCIAL_POST',
            'SITE_PAGE',
            'BLOG_POST',
            'IMPORT',
            'EXPORT',
            'CTA',
            'TASK_TEMPLATE',
            'AUTOMATION_PLATFORM_FLOW',
            'OBJECT_LIST',
            'NOTE',
            'MEETING_EVENT',
            'CALL',
            'EMAIL',
            'PUBLISHING_TASK',
            'CONVERSATION_SESSION',
            'CONTACT_CREATE_ATTRIBUTION',
            'INVOICE',
            'MARKETING_EVENT',
            'CONVERSATION_INBOX',
            'CHATFLOW',
            'MEDIA_BRIDGE',
            'SEQUENCE',
            'SEQUENCE_STEP',
            'FORECAST',
            'SNIPPET',
            'TEMPLATE',
            'DEAL_CREATE_ATTRIBUTION',
            'QUOTE_TEMPLATE',
            'QUOTE_MODULE',
            'QUOTE_MODULE_FIELD',
            'QUOTE_FIELD',
            'SEQUENCE_ENROLLMENT',
            'SUBSCRIPTION',
            'ACCEPTANCE_TEST',
            'SOCIAL_BROADCAST',
            'DEAL_SPLIT',
            'DEAL_REGISTRATION',
            'GOAL_TARGET',
            'GOAL_TARGET_GROUP',
            'PORTAL_OBJECT_SYNC_MESSAGE',
            'FILE_MANAGER_FILE',
            'FILE_MANAGER_FOLDER',
            'SEQUENCE_STEP_ENROLLMENT',
            'APPROVAL',
            'APPROVAL_STEP',
            'CTA_VARIANT',
            'SALES_DOCUMENT',
            'DISCOUNT',
            'FEE',
            'TAX',
            'MARKETING_CALENDAR',
            'PERMISSIONS_TESTING',
            'PRIVACY_SCANNER_COOKIE',
            'DATA_SYNC_STATE',
            'WEB_INTERACTIVE',
            'PLAYBOOK',
            'FOLDER',
            'PLAYBOOK_QUESTION',
            'PLAYBOOK_SUBMISSION',
            'PLAYBOOK_SUBMISSION_ANSWER',
            'COMMERCE_PAYMENT',
            'GSC_PROPERTY',
            'SOX_PROTECTED_DUMMY_TYPE',
            'BLOG_LISTING_PAGE',
            'QUARANTINED_SUBMISSION',
            'PAYMENT_SCHEDULE',
            'PAYMENT_SCHEDULE_INSTALLMENT',
            'MARKETING_CAMPAIGN_UTM',
            'DISCOUNT_TEMPLATE',
            'DISCOUNT_CODE',
            'FEEDBACK_SURVEY',
            'CMS_URL',
            'SALES_TASK',
            'SALES_WORKLOAD',
            'USER',
            'POSTAL_MAIL',
            'SCHEMAS_BACKEND_TEST',
            'PAYMENT_LINK',
            'SUBMISSION_TAG',
            'CAMPAIGN_STEP',
            'SCHEDULING_PAGE',
            'SOX_PROTECTED_TEST_TYPE',
            'ORDER',
            'MARKETING_SMS',
            'PARTNER_ACCOUNT',
            'CAMPAIGN_TEMPLATE',
            'CAMPAIGN_TEMPLATE_STEP',
            'PLAYLIST',
            'CLIP',
            'CAMPAIGN_BUDGET_ITEM',
            'CAMPAIGN_SPEND_ITEM',
            'MIC',
            'CONTENT_AUDIT',
            'CONTENT_AUDIT_PAGE',
            'PLAYLIST_FOLDER',
            'LEAD',
            'ABANDONED_CART',
            'EXTERNAL_WEB_URL',
            'VIEW',
            'VIEW_BLOCK',
            'ROSTER',
            'CART',
            'AUTOMATION_PLATFORM_FLOW_ACTION',
            'SOCIAL_PROFILE',
            'PARTNER_CLIENT',
            'ROSTER_MEMBER',
            'MARKETING_EVENT_ATTENDANCE',
            'ALL_PAGES',
            'AI_FORECAST',
            'CRM_PIPELINES_DUMMY_TYPE',
            'KNOWLEDGE_ARTICLE',
            'PROPERTY_INFO',
            'DATA_PRIVACY_CONSENT',
            'GOAL_TEMPLATE',
            'SCORE_CONFIGURATION',
            'AUDIENCE',
            'PARTNER_CLIENT_REVENUE',
            'AUTOMATION_JOURNEY',
            'UNKNOWN',
          ];
        };
        name: {
          type: 'string';
        };
        options: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/Option';
          };
        };
        description: {
          type: 'string';
        };
        externalOptionsReferenceType: {
          type: 'string';
        };
        label: {
          type: 'string';
        };
        type: {
          type: 'string';
          enum: [
            'string',
            'number',
            'bool',
            'datetime',
            'enumeration',
            'date',
            'phone_number',
            'currency_number',
            'json',
            'object_coordinates',
          ];
        };
        fieldType: {
          type: 'string';
          enum: [
            'booleancheckbox',
            'checkbox',
            'date',
            'file',
            'number',
            'phonenumber',
            'radio',
            'select',
            'text',
            'textarea',
            'calculation_equation',
            'calculation_rollup',
            'calculation_score',
            'calculation_read_time',
            'unknown',
            'html',
          ];
        };
        optionsUrl: {
          type: 'string';
        };
        externalOptions: {
          type: 'boolean';
        };
      };
    };
    CollectionResponsePublicActionFunctionIdentifierNoPaging: {
      required: ['results'];
      type: 'object';
      properties: {
        results: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PublicActionFunctionIdentifier';
          };
        };
      };
    };
    InputFieldDefinition: {
      required: ['isRequired', 'typeDefinition'];
      type: 'object';
      properties: {
        isRequired: {
          type: 'boolean';
        };
        automationFieldType: {
          type: 'string';
        };
        typeDefinition: {
          $ref: '#/components/schemas/FieldTypeDefinition';
        };
        supportedValueTypes: {
          type: 'array';
          items: {
            type: 'string';
            enum: [
              'STATIC_VALUE',
              'OBJECT_PROPERTY',
              'FIELD_DATA',
              'FETCHED_OBJECT_PROPERTY',
              'ENROLLMENT_EVENT_PROPERTY',
            ];
          };
        };
      };
    };
    PublicExecutionTranslationRule: {
      required: ['conditions', 'labelName'];
      type: 'object';
      properties: {
        labelName: {
          type: 'string';
        };
        conditions: {
          type: 'object';
          additionalProperties: {
            type: 'object';
            properties: {};
          };
        };
      };
    };
    PublicActionFunctionIdentifier: {
      required: ['functionType'];
      type: 'object';
      properties: {
        functionType: {
          type: 'string';
          enum: ['PRE_ACTION_EXECUTION', 'PRE_FETCH_OPTIONS', 'POST_FETCH_OPTIONS', 'POST_ACTION_EXECUTION'];
        };
        id: {
          type: 'string';
        };
      };
    };
    PublicActionRevision: {
      required: ['createdAt', 'definition', 'id', 'revisionId'];
      type: 'object';
      properties: {
        revisionId: {
          type: 'string';
        };
        createdAt: {
          type: 'string';
          format: 'date-time';
        };
        definition: {
          $ref: '#/components/schemas/PublicActionDefinition';
        };
        id: {
          type: 'string';
        };
      };
    };
    CallbackCompletionRequest: {
      required: ['outputFields'];
      type: 'object';
      properties: {
        outputFields: {
          type: 'object';
          additionalProperties: {
            type: 'string';
          };
        };
      };
    };
    CollectionResponsePublicActionDefinitionForwardPaging: {
      required: ['results'];
      type: 'object';
      properties: {
        paging: {
          $ref: '#/components/schemas/ForwardPaging';
        };
        results: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PublicActionDefinition';
          };
        };
      };
    };
    Error: {
      required: ['category', 'correlationId', 'message'];
      type: 'object';
      properties: {
        subCategory: {
          type: 'string';
          description: 'A specific category that contains more specific detail about the error';
        };
        context: {
          type: 'object';
          additionalProperties: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
          description: 'Context about the error condition';
          example: {
            missingScopes: ['scope1', 'scope2'];
            invalidPropertyName: ['propertyValue'];
          };
        };
        correlationId: {
          type: 'string';
          description: 'A unique identifier for the request. Include this value with any error reports or support tickets';
          format: 'uuid';
          example: 'aeb5f871-7f07-4993-9211-075dc63e7cbf';
        };
        links: {
          type: 'object';
          additionalProperties: {
            type: 'string';
          };
          description: 'A map of link names to associated URIs containing documentation about the error or recommended remediation steps';
          example: {
            'knowledge-base': 'https://www.hubspot.com/products/service/knowledge-base';
          };
        };
        message: {
          type: 'string';
          description: 'A human readable message describing the error along with remediation steps where appropriate';
          example: 'Invalid input (details will vary based on the error)';
        };
        category: {
          type: 'string';
          description: 'The error category';
          example: 'VALIDATION_ERROR';
        };
        errors: {
          type: 'array';
          description: 'further information about the error';
          items: {
            $ref: '#/components/schemas/ErrorDetail';
          };
        };
      };
      example: {
        message: 'Invalid input (details will vary based on the error)';
        correlationId: 'aeb5f871-7f07-4993-9211-075dc63e7cbf';
        category: 'VALIDATION_ERROR';
        links: {
          'knowledge-base': 'https://www.hubspot.com/products/service/knowledge-base';
        };
      };
    };
    CollectionResponsePublicActionRevisionForwardPaging: {
      required: ['results'];
      type: 'object';
      properties: {
        paging: {
          $ref: '#/components/schemas/ForwardPaging';
        };
        results: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PublicActionRevision';
          };
        };
      };
    };
    CallbackCompletionBatchRequest: {
      required: ['callbackId', 'outputFields'];
      type: 'object';
      properties: {
        outputFields: {
          type: 'object';
          additionalProperties: {
            type: 'string';
          };
        };
        callbackId: {
          type: 'string';
        };
      };
    };
    PublicActionDefinitionEgg: {
      required: ['actionUrl', 'functions', 'inputFields', 'labels', 'objectTypes', 'published'];
      type: 'object';
      properties: {
        inputFields: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/InputFieldDefinition';
          };
        };
        outputFields: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/OutputFieldDefinition';
          };
        };
        archivedAt: {
          type: 'integer';
          format: 'int64';
        };
        functions: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PublicActionFunction';
          };
        };
        actionUrl: {
          type: 'string';
        };
        inputFieldDependencies: {
          type: 'array';
          items: {
            oneOf: [
              {
                $ref: '#/components/schemas/PublicSingleFieldDependency';
              },
              {
                $ref: '#/components/schemas/PublicConditionalSingleFieldDependency';
              },
            ];
          };
        };
        published: {
          type: 'boolean';
        };
        executionRules: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PublicExecutionTranslationRule';
          };
        };
        objectTypes: {
          type: 'array';
          items: {
            type: 'string';
          };
        };
        objectRequestOptions: {
          $ref: '#/components/schemas/PublicObjectRequestOptions';
        };
        labels: {
          type: 'object';
          additionalProperties: {
            $ref: '#/components/schemas/PublicActionLabels';
          };
        };
      };
    };
    PublicActionDefinitionPatch: {
      type: 'object';
      properties: {
        inputFields: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/InputFieldDefinition';
          };
        };
        outputFields: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/OutputFieldDefinition';
          };
        };
        actionUrl: {
          type: 'string';
        };
        inputFieldDependencies: {
          type: 'array';
          items: {
            oneOf: [
              {
                $ref: '#/components/schemas/PublicSingleFieldDependency';
              },
              {
                $ref: '#/components/schemas/PublicConditionalSingleFieldDependency';
              },
            ];
          };
        };
        published: {
          type: 'boolean';
        };
        executionRules: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PublicExecutionTranslationRule';
          };
        };
        objectTypes: {
          type: 'array';
          items: {
            type: 'string';
          };
        };
        objectRequestOptions: {
          $ref: '#/components/schemas/PublicObjectRequestOptions';
        };
        labels: {
          type: 'object';
          additionalProperties: {
            $ref: '#/components/schemas/PublicActionLabels';
          };
        };
      };
    };
    BatchInputCallbackCompletionBatchRequest: {
      required: ['inputs'];
      type: 'object';
      properties: {
        inputs: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/CallbackCompletionBatchRequest';
          };
        };
      };
    };
    Option: {
      required: ['description', 'displayOrder', 'doubleData', 'hidden', 'label', 'readOnly', 'value'];
      type: 'object';
      properties: {
        hidden: {
          type: 'boolean';
        };
        displayOrder: {
          type: 'integer';
          format: 'int32';
        };
        doubleData: {
          type: 'number';
        };
        description: {
          type: 'string';
        };
        readOnly: {
          type: 'boolean';
        };
        label: {
          type: 'string';
        };
        value: {
          type: 'string';
        };
      };
    };
    OutputFieldDefinition: {
      required: ['typeDefinition'];
      type: 'object';
      properties: {
        typeDefinition: {
          $ref: '#/components/schemas/FieldTypeDefinition';
        };
      };
    };
    NextPage: {
      required: ['after'];
      type: 'object';
      properties: {
        link: {
          type: 'string';
        };
        after: {
          type: 'string';
        };
      };
    };
  };
  responses: {
    Error: {
      description: 'An error occurred.';
      content: {
        '*/*': {
          schema: {
            $ref: '#/components/schemas/Error';
          };
        };
      };
    };
  };
  securitySchemes: {
    oauth2_legacy: {
      type: 'oauth2';
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://app.hubspot.com/oauth/authorize';
          tokenUrl: 'https://api.hubapi.com/oauth/v1/token';
          scopes: {
            automation: 'Read from and write to my Workflows';
          };
        };
      };
    };
    developer_hapikey: {
      type: 'apiKey';
      name: 'hapikey';
      in: 'query';
    };
    private_apps_legacy: {
      type: 'apiKey';
      name: 'private-app-legacy';
      in: 'header';
    };
  };
};
export const components = {
  schemas: {
    PublicActionFunction: {
      required: ['functionSource', 'functionType'],
      type: 'object',
      properties: {
        functionSource: {
          type: 'string',
        },
        functionType: {
          type: 'string',
          enum: ['PRE_ACTION_EXECUTION', 'PRE_FETCH_OPTIONS', 'POST_FETCH_OPTIONS', 'POST_ACTION_EXECUTION'],
        },
        id: {
          type: 'string',
        },
      },
    },
    PublicActionDefinition: {
      required: ['actionUrl', 'functions', 'id', 'inputFields', 'labels', 'objectTypes', 'published', 'revisionId'],
      type: 'object',
      properties: {
        functions: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PublicActionFunctionIdentifier',
          },
        },
        actionUrl: {
          type: 'string',
        },
        published: {
          type: 'boolean',
        },
        labels: {
          type: 'object',
          additionalProperties: {
            $ref: '#/components/schemas/PublicActionLabels',
          },
        },
        inputFields: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/InputFieldDefinition',
          },
        },
        outputFields: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/OutputFieldDefinition',
          },
        },
        revisionId: {
          type: 'string',
        },
        archivedAt: {
          type: 'integer',
          format: 'int64',
        },
        inputFieldDependencies: {
          type: 'array',
          items: {
            oneOf: [
              {
                $ref: '#/components/schemas/PublicSingleFieldDependency',
              },
              {
                $ref: '#/components/schemas/PublicConditionalSingleFieldDependency',
              },
            ],
          },
        },
        executionRules: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PublicExecutionTranslationRule',
          },
        },
        id: {
          type: 'string',
        },
        objectTypes: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        objectRequestOptions: {
          $ref: '#/components/schemas/PublicObjectRequestOptions',
        },
      },
    },
    PublicConditionalSingleFieldDependency: {
      title: 'CONDITIONAL_SINGLE_FIELD',
      required: ['controllingFieldName', 'controllingFieldValue', 'dependencyType', 'dependentFieldNames'],
      type: 'object',
      properties: {
        dependencyType: {
          type: 'string',
          default: 'CONDITIONAL_SINGLE_FIELD',
          enum: ['CONDITIONAL_SINGLE_FIELD'],
        },
        controllingFieldName: {
          type: 'string',
        },
        controllingFieldValue: {
          type: 'string',
        },
        dependentFieldNames: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
    PublicObjectRequestOptions: {
      required: ['properties'],
      type: 'object',
      properties: {
        properties: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
    ErrorDetail: {
      required: ['message'],
      type: 'object',
      properties: {
        subCategory: {
          type: 'string',
          description: 'A specific category that contains more specific detail about the error',
        },
        code: {
          type: 'string',
          description: 'The status code associated with the error detail',
        },
        in: {
          type: 'string',
          description: 'The name of the field or parameter in which the error was found.',
        },
        context: {
          type: 'object',
          additionalProperties: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          description: 'Context about the error condition',
          example: {
            missingScopes: ['scope1', 'scope2'],
          },
        },
        message: {
          type: 'string',
          description: 'A human readable message describing the error along with remediation steps where appropriate',
        },
      },
    },
    PublicActionLabels: {
      required: ['actionName'],
      type: 'object',
      properties: {
        inputFieldDescriptions: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },
        appDisplayName: {
          type: 'string',
        },
        outputFieldLabels: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },
        inputFieldOptionLabels: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            additionalProperties: {
              type: 'string',
            },
          },
        },
        actionDescription: {
          type: 'string',
        },
        executionRules: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },
        inputFieldLabels: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },
        actionName: {
          type: 'string',
        },
        actionCardContent: {
          type: 'string',
        },
      },
    },
    PublicSingleFieldDependency: {
      title: 'SINGLE_FIELD',
      required: ['controllingFieldName', 'dependencyType', 'dependentFieldNames'],
      type: 'object',
      properties: {
        dependencyType: {
          type: 'string',
          default: 'SINGLE_FIELD',
          enum: ['SINGLE_FIELD'],
        },
        controllingFieldName: {
          type: 'string',
        },
        dependentFieldNames: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
    ForwardPaging: {
      type: 'object',
      properties: {
        next: {
          $ref: '#/components/schemas/NextPage',
        },
      },
    },
    FieldTypeDefinition: {
      required: ['externalOptions', 'name', 'options', 'type'],
      type: 'object',
      properties: {
        helpText: {
          type: 'string',
        },
        referencedObjectType: {
          type: 'string',
          enum: [
            'CONTACT',
            'COMPANY',
            'DEAL',
            'ENGAGEMENT',
            'TICKET',
            'OWNER',
            'PRODUCT',
            'LINE_ITEM',
            'BET_DELIVERABLE_SERVICE',
            'CONTENT',
            'CONVERSATION',
            'BET_ALERT',
            'PORTAL',
            'QUOTE',
            'FORM_SUBMISSION_INBOUNDDB',
            'QUOTA',
            'UNSUBSCRIBE',
            'COMMUNICATION',
            'FEEDBACK_SUBMISSION',
            'ATTRIBUTION',
            'SALESFORCE_SYNC_ERROR',
            'RESTORABLE_CRM_OBJECT',
            'HUB',
            'LANDING_PAGE',
            'PRODUCT_OR_FOLDER',
            'TASK',
            'FORM',
            'MARKETING_EMAIL',
            'AD_ACCOUNT',
            'AD_CAMPAIGN',
            'AD_GROUP',
            'AD',
            'KEYWORD',
            'CAMPAIGN',
            'SOCIAL_CHANNEL',
            'SOCIAL_POST',
            'SITE_PAGE',
            'BLOG_POST',
            'IMPORT',
            'EXPORT',
            'CTA',
            'TASK_TEMPLATE',
            'AUTOMATION_PLATFORM_FLOW',
            'OBJECT_LIST',
            'NOTE',
            'MEETING_EVENT',
            'CALL',
            'EMAIL',
            'PUBLISHING_TASK',
            'CONVERSATION_SESSION',
            'CONTACT_CREATE_ATTRIBUTION',
            'INVOICE',
            'MARKETING_EVENT',
            'CONVERSATION_INBOX',
            'CHATFLOW',
            'MEDIA_BRIDGE',
            'SEQUENCE',
            'SEQUENCE_STEP',
            'FORECAST',
            'SNIPPET',
            'TEMPLATE',
            'DEAL_CREATE_ATTRIBUTION',
            'QUOTE_TEMPLATE',
            'QUOTE_MODULE',
            'QUOTE_MODULE_FIELD',
            'QUOTE_FIELD',
            'SEQUENCE_ENROLLMENT',
            'SUBSCRIPTION',
            'ACCEPTANCE_TEST',
            'SOCIAL_BROADCAST',
            'DEAL_SPLIT',
            'DEAL_REGISTRATION',
            'GOAL_TARGET',
            'GOAL_TARGET_GROUP',
            'PORTAL_OBJECT_SYNC_MESSAGE',
            'FILE_MANAGER_FILE',
            'FILE_MANAGER_FOLDER',
            'SEQUENCE_STEP_ENROLLMENT',
            'APPROVAL',
            'APPROVAL_STEP',
            'CTA_VARIANT',
            'SALES_DOCUMENT',
            'DISCOUNT',
            'FEE',
            'TAX',
            'MARKETING_CALENDAR',
            'PERMISSIONS_TESTING',
            'PRIVACY_SCANNER_COOKIE',
            'DATA_SYNC_STATE',
            'WEB_INTERACTIVE',
            'PLAYBOOK',
            'FOLDER',
            'PLAYBOOK_QUESTION',
            'PLAYBOOK_SUBMISSION',
            'PLAYBOOK_SUBMISSION_ANSWER',
            'COMMERCE_PAYMENT',
            'GSC_PROPERTY',
            'SOX_PROTECTED_DUMMY_TYPE',
            'BLOG_LISTING_PAGE',
            'QUARANTINED_SUBMISSION',
            'PAYMENT_SCHEDULE',
            'PAYMENT_SCHEDULE_INSTALLMENT',
            'MARKETING_CAMPAIGN_UTM',
            'DISCOUNT_TEMPLATE',
            'DISCOUNT_CODE',
            'FEEDBACK_SURVEY',
            'CMS_URL',
            'SALES_TASK',
            'SALES_WORKLOAD',
            'USER',
            'POSTAL_MAIL',
            'SCHEMAS_BACKEND_TEST',
            'PAYMENT_LINK',
            'SUBMISSION_TAG',
            'CAMPAIGN_STEP',
            'SCHEDULING_PAGE',
            'SOX_PROTECTED_TEST_TYPE',
            'ORDER',
            'MARKETING_SMS',
            'PARTNER_ACCOUNT',
            'CAMPAIGN_TEMPLATE',
            'CAMPAIGN_TEMPLATE_STEP',
            'PLAYLIST',
            'CLIP',
            'CAMPAIGN_BUDGET_ITEM',
            'CAMPAIGN_SPEND_ITEM',
            'MIC',
            'CONTENT_AUDIT',
            'CONTENT_AUDIT_PAGE',
            'PLAYLIST_FOLDER',
            'LEAD',
            'ABANDONED_CART',
            'EXTERNAL_WEB_URL',
            'VIEW',
            'VIEW_BLOCK',
            'ROSTER',
            'CART',
            'AUTOMATION_PLATFORM_FLOW_ACTION',
            'SOCIAL_PROFILE',
            'PARTNER_CLIENT',
            'ROSTER_MEMBER',
            'MARKETING_EVENT_ATTENDANCE',
            'ALL_PAGES',
            'AI_FORECAST',
            'CRM_PIPELINES_DUMMY_TYPE',
            'KNOWLEDGE_ARTICLE',
            'PROPERTY_INFO',
            'DATA_PRIVACY_CONSENT',
            'GOAL_TEMPLATE',
            'SCORE_CONFIGURATION',
            'AUDIENCE',
            'PARTNER_CLIENT_REVENUE',
            'AUTOMATION_JOURNEY',
            'UNKNOWN',
          ],
        },
        name: {
          type: 'string',
        },
        options: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/Option',
          },
        },
        description: {
          type: 'string',
        },
        externalOptionsReferenceType: {
          type: 'string',
        },
        label: {
          type: 'string',
        },
        type: {
          type: 'string',
          enum: [
            'string',
            'number',
            'bool',
            'datetime',
            'enumeration',
            'date',
            'phone_number',
            'currency_number',
            'json',
            'object_coordinates',
          ],
        },
        fieldType: {
          type: 'string',
          enum: [
            'booleancheckbox',
            'checkbox',
            'date',
            'file',
            'number',
            'phonenumber',
            'radio',
            'select',
            'text',
            'textarea',
            'calculation_equation',
            'calculation_rollup',
            'calculation_score',
            'calculation_read_time',
            'unknown',
            'html',
          ],
        },
        optionsUrl: {
          type: 'string',
        },
        externalOptions: {
          type: 'boolean',
        },
      },
    },
    CollectionResponsePublicActionFunctionIdentifierNoPaging: {
      required: ['results'],
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PublicActionFunctionIdentifier',
          },
        },
      },
    },
    InputFieldDefinition: {
      required: ['isRequired', 'typeDefinition'],
      type: 'object',
      properties: {
        isRequired: {
          type: 'boolean',
        },
        automationFieldType: {
          type: 'string',
        },
        typeDefinition: {
          $ref: '#/components/schemas/FieldTypeDefinition',
        },
        supportedValueTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'STATIC_VALUE',
              'OBJECT_PROPERTY',
              'FIELD_DATA',
              'FETCHED_OBJECT_PROPERTY',
              'ENROLLMENT_EVENT_PROPERTY',
            ],
          },
        },
      },
    },
    PublicExecutionTranslationRule: {
      required: ['conditions', 'labelName'],
      type: 'object',
      properties: {
        labelName: {
          type: 'string',
        },
        conditions: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {},
          },
        },
      },
    },
    PublicActionFunctionIdentifier: {
      required: ['functionType'],
      type: 'object',
      properties: {
        functionType: {
          type: 'string',
          enum: ['PRE_ACTION_EXECUTION', 'PRE_FETCH_OPTIONS', 'POST_FETCH_OPTIONS', 'POST_ACTION_EXECUTION'],
        },
        id: {
          type: 'string',
        },
      },
    },
    PublicActionRevision: {
      required: ['createdAt', 'definition', 'id', 'revisionId'],
      type: 'object',
      properties: {
        revisionId: {
          type: 'string',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
        definition: {
          $ref: '#/components/schemas/PublicActionDefinition',
        },
        id: {
          type: 'string',
        },
      },
    },
    CallbackCompletionRequest: {
      required: ['outputFields'],
      type: 'object',
      properties: {
        outputFields: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },
      },
    },
    CollectionResponsePublicActionDefinitionForwardPaging: {
      required: ['results'],
      type: 'object',
      properties: {
        paging: {
          $ref: '#/components/schemas/ForwardPaging',
        },
        results: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PublicActionDefinition',
          },
        },
      },
    },
    Error: {
      required: ['category', 'correlationId', 'message'],
      type: 'object',
      properties: {
        subCategory: {
          type: 'string',
          description: 'A specific category that contains more specific detail about the error',
        },
        context: {
          type: 'object',
          additionalProperties: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          description: 'Context about the error condition',
          example: {
            missingScopes: ['scope1', 'scope2'],
            invalidPropertyName: ['propertyValue'],
          },
        },
        correlationId: {
          type: 'string',
          description:
            'A unique identifier for the request. Include this value with any error reports or support tickets',
          format: 'uuid',
          example: 'aeb5f871-7f07-4993-9211-075dc63e7cbf',
        },
        links: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
          description:
            'A map of link names to associated URIs containing documentation about the error or recommended remediation steps',
          example: {
            'knowledge-base': 'https://www.hubspot.com/products/service/knowledge-base',
          },
        },
        message: {
          type: 'string',
          description: 'A human readable message describing the error along with remediation steps where appropriate',
          example: 'Invalid input (details will vary based on the error)',
        },
        category: {
          type: 'string',
          description: 'The error category',
          example: 'VALIDATION_ERROR',
        },
        errors: {
          type: 'array',
          description: 'further information about the error',
          items: {
            $ref: '#/components/schemas/ErrorDetail',
          },
        },
      },
      example: {
        message: 'Invalid input (details will vary based on the error)',
        correlationId: 'aeb5f871-7f07-4993-9211-075dc63e7cbf',
        category: 'VALIDATION_ERROR',
        links: {
          'knowledge-base': 'https://www.hubspot.com/products/service/knowledge-base',
        },
      },
    },
    CollectionResponsePublicActionRevisionForwardPaging: {
      required: ['results'],
      type: 'object',
      properties: {
        paging: {
          $ref: '#/components/schemas/ForwardPaging',
        },
        results: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PublicActionRevision',
          },
        },
      },
    },
    CallbackCompletionBatchRequest: {
      required: ['callbackId', 'outputFields'],
      type: 'object',
      properties: {
        outputFields: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },
        callbackId: {
          type: 'string',
        },
      },
    },
    PublicActionDefinitionEgg: {
      required: ['actionUrl', 'functions', 'inputFields', 'labels', 'objectTypes', 'published'],
      type: 'object',
      properties: {
        inputFields: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/InputFieldDefinition',
          },
        },
        outputFields: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/OutputFieldDefinition',
          },
        },
        archivedAt: {
          type: 'integer',
          format: 'int64',
        },
        functions: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PublicActionFunction',
          },
        },
        actionUrl: {
          type: 'string',
        },
        inputFieldDependencies: {
          type: 'array',
          items: {
            oneOf: [
              {
                $ref: '#/components/schemas/PublicSingleFieldDependency',
              },
              {
                $ref: '#/components/schemas/PublicConditionalSingleFieldDependency',
              },
            ],
          },
        },
        published: {
          type: 'boolean',
        },
        executionRules: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PublicExecutionTranslationRule',
          },
        },
        objectTypes: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        objectRequestOptions: {
          $ref: '#/components/schemas/PublicObjectRequestOptions',
        },
        labels: {
          type: 'object',
          additionalProperties: {
            $ref: '#/components/schemas/PublicActionLabels',
          },
        },
      },
    },
    PublicActionDefinitionPatch: {
      type: 'object',
      properties: {
        inputFields: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/InputFieldDefinition',
          },
        },
        outputFields: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/OutputFieldDefinition',
          },
        },
        actionUrl: {
          type: 'string',
        },
        inputFieldDependencies: {
          type: 'array',
          items: {
            oneOf: [
              {
                $ref: '#/components/schemas/PublicSingleFieldDependency',
              },
              {
                $ref: '#/components/schemas/PublicConditionalSingleFieldDependency',
              },
            ],
          },
        },
        published: {
          type: 'boolean',
        },
        executionRules: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PublicExecutionTranslationRule',
          },
        },
        objectTypes: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        objectRequestOptions: {
          $ref: '#/components/schemas/PublicObjectRequestOptions',
        },
        labels: {
          type: 'object',
          additionalProperties: {
            $ref: '#/components/schemas/PublicActionLabels',
          },
        },
      },
    },
    BatchInputCallbackCompletionBatchRequest: {
      required: ['inputs'],
      type: 'object',
      properties: {
        inputs: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/CallbackCompletionBatchRequest',
          },
        },
      },
    },
    Option: {
      required: ['description', 'displayOrder', 'doubleData', 'hidden', 'label', 'readOnly', 'value'],
      type: 'object',
      properties: {
        hidden: {
          type: 'boolean',
        },
        displayOrder: {
          type: 'integer',
          format: 'int32',
        },
        doubleData: {
          type: 'number',
        },
        description: {
          type: 'string',
        },
        readOnly: {
          type: 'boolean',
        },
        label: {
          type: 'string',
        },
        value: {
          type: 'string',
        },
      },
    },
    OutputFieldDefinition: {
      required: ['typeDefinition'],
      type: 'object',
      properties: {
        typeDefinition: {
          $ref: '#/components/schemas/FieldTypeDefinition',
        },
      },
    },
    NextPage: {
      required: ['after'],
      type: 'object',
      properties: {
        link: {
          type: 'string',
        },
        after: {
          type: 'string',
        },
      },
    },
  },
  responses: {
    Error: {
      description: 'An error occurred.',
      content: {
        '*/*': {
          schema: {
            $ref: '#/components/schemas/Error',
          },
        },
      },
    },
  },
  securitySchemes: {
    oauth2_legacy: {
      type: 'oauth2',
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://app.hubspot.com/oauth/authorize',
          tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
          scopes: {
            automation: 'Read from and write to my Workflows',
          },
        },
      },
    },
    developer_hapikey: {
      type: 'apiKey',
      name: 'hapikey',
      in: 'query',
    },
    private_apps_legacy: {
      type: 'apiKey',
      name: 'private-app-legacy',
      in: 'header',
    },
  },
} as TComponents;
