// @ts-nocheck
export type TComponents = {
  schemas: {
    ACLAction: {
      description: 'Enum containing the actions that can be performed against a resource. Group operations are included.';
      enum: ['create', 'delete', 'read', 'update', 'list', 'count'];
      type: 'string';
    };
    AuthToken: {
      description: 'Authentication token metadata.';
      properties: {
        activeAt: {
          description: 'Timestamp (in milliseconds) of when the token was most recently used.';
          examples: [1632816536002];
          type: 'number';
        };
        createdAt: {
          description: 'Timestamp (in milliseconds) of when the token was created.';
          examples: [1632816536002];
          type: 'number';
        };
        expiresAt: {
          description: 'Timestamp (in milliseconds) of when the token expires.';
          examples: [1632816536002];
          type: 'number';
        };
        id: {
          description: 'The unique identifier of the token.';
          examples: ['5d9f2ebd38ddca62e5d51e9c1704c72530bdc8bfdd41e782a6687c48399e8391'];
          type: 'string';
        };
        name: {
          description: 'The human-readable name of the token.';
          type: 'string';
        };
        origin: {
          description: 'The origin of how the token was created.';
          examples: ['github'];
          type: 'string';
        };
        scopes: {
          description: 'The access scopes granted to the token.';
          items: {
            oneOf: [
              {
                description: 'The access scopes granted to the token.';
                properties: {
                  createdAt: {
                    type: 'number';
                  };
                  expiresAt: {
                    type: 'number';
                  };
                  origin: {
                    enum: ['saml', 'github', 'gitlab', 'bitbucket', 'email', 'manual'];
                    type: 'string';
                  };
                  type: {
                    enum: ['user'];
                    type: 'string';
                  };
                };
                required: ['type', 'origin', 'createdAt'];
                type: 'object';
              },
              {
                description: 'The access scopes granted to the token.';
                properties: {
                  createdAt: {
                    type: 'number';
                  };
                  expiresAt: {
                    type: 'number';
                  };
                  origin: {
                    enum: ['saml', 'github', 'gitlab', 'bitbucket', 'email', 'manual'];
                    type: 'string';
                  };
                  teamId: {
                    type: 'string';
                  };
                  type: {
                    enum: ['team'];
                    type: 'string';
                  };
                };
                required: ['type', 'teamId', 'origin', 'createdAt'];
                type: 'object';
              },
            ];
          };
          type: 'array';
        };
        type: {
          description: 'The type of the token.';
          examples: ['oauth2-token'];
          type: 'string';
        };
      };
      required: ['id', 'name', 'type', 'activeAt', 'createdAt'];
      type: 'object';
    };
    AuthUser: {
      description: 'Data for the currently authenticated User.';
      properties: {
        activeDashboardViews: {
          description: 'set of dashboard view preferences (cards or list) per scopeId';
          items: {
            description: 'set of dashboard view preferences (cards or list) per scopeId';
            properties: {
              scopeId: {
                type: 'string';
              };
              viewPreference: {
                enum: ['cards', 'list'];
                type: 'string';
              };
            };
            required: ['scopeId', 'viewPreference'];
            type: 'object';
          };
          type: 'array';
        };
        avatar: {
          description: 'SHA1 hash of the avatar for the User account. Can be used in conjuction with the ... endpoint to retrieve the avatar image.';
          examples: ['22cb30c85ff45ac4c72de8981500006b28114aa1'];
          type: ['string', 'null'];
        };
        billing: {
          description: 'An object containing billing infomation associated with the User account.';
          properties: {
            addons: {
              items: {
                enum: ['custom-deployment-suffix', 'live-support'];
                type: 'string';
              };
              type: ['array', 'null'];
            };
            address: {
              properties: {
                city: {
                  type: 'string';
                };
                country: {
                  type: 'string';
                };
                line1: {
                  type: 'string';
                };
                line2: {
                  type: 'string';
                };
                postalCode: {
                  type: 'string';
                };
                state: {
                  type: 'string';
                };
              };
              required: ['line1'];
              type: ['object', 'null'];
            };
            cancelation: {
              type: ['number', 'null'];
            };
            contract: {
              properties: {
                end: {
                  type: 'number';
                };
                start: {
                  type: 'number';
                };
              };
              required: ['start', 'end'];
              type: ['object', 'null'];
            };
            controls: {
              properties: {
                analyticsSampleRateInPercent: {
                  type: ['number', 'null'];
                };
                analyticsSpendLimitInDollars: {
                  type: ['number', 'null'];
                };
              };
              type: ['object', 'null'];
            };
            currency: {
              enum: ['usd', 'eur'];
              type: 'string';
            };
            email: {
              type: ['string', 'null'];
            };
            invoiceItems: {
              properties: {
                analytics: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.';
                  properties: {
                    createdAt: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'];
                          type: 'string';
                        };
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12];
                          type: 'number';
                        };
                      };
                      required: ['interval', 'intervalCount'];
                      type: 'object';
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    maxQuantity: {
                      type: 'number';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    quantity: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'quantity', 'hidden'];
                  type: 'object';
                };
                analyticsUsage: {
                  properties: {
                    batch: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    threshold: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'batch', 'threshold', 'hidden'];
                  type: 'object';
                };
                artifacts: {
                  properties: {
                    batch: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    threshold: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'batch', 'threshold', 'hidden'];
                  type: 'object';
                };
                bandwidth: {
                  properties: {
                    batch: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    threshold: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'batch', 'threshold', 'hidden'];
                  type: 'object';
                };
                builds: {
                  properties: {
                    batch: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    threshold: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'batch', 'threshold', 'hidden'];
                  type: 'object';
                };
                concurrentBuilds: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.';
                  properties: {
                    createdAt: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'];
                          type: 'string';
                        };
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12];
                          type: 'number';
                        };
                      };
                      required: ['interval', 'intervalCount'];
                      type: 'object';
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    maxQuantity: {
                      type: 'number';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    quantity: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'quantity', 'hidden'];
                  type: 'object';
                };
                cronJobInvocation: {
                  properties: {
                    batch: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    threshold: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'batch', 'threshold', 'hidden'];
                  type: 'object';
                };
                customCerts: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.';
                  properties: {
                    createdAt: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'];
                          type: 'string';
                        };
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12];
                          type: 'number';
                        };
                      };
                      required: ['interval', 'intervalCount'];
                      type: 'object';
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    maxQuantity: {
                      type: 'number';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    quantity: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'quantity', 'hidden'];
                  type: 'object';
                };
                edgeConfigRead: {
                  properties: {
                    batch: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    threshold: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'batch', 'threshold', 'hidden'];
                  type: 'object';
                };
                edgeConfigWrite: {
                  properties: {
                    batch: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    threshold: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'batch', 'threshold', 'hidden'];
                  type: 'object';
                };
                edgeFunctionExecutionUnits: {
                  properties: {
                    batch: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    threshold: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'batch', 'threshold', 'hidden'];
                  type: 'object';
                };
                edgeMiddlewareInvocations: {
                  properties: {
                    batch: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    threshold: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'batch', 'threshold', 'hidden'];
                  type: 'object';
                };
                enterprise: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.';
                  properties: {
                    createdAt: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'];
                          type: 'string';
                        };
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12];
                          type: 'number';
                        };
                      };
                      required: ['interval', 'intervalCount'];
                      type: 'object';
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    maxQuantity: {
                      type: 'number';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    quantity: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'quantity', 'hidden'];
                  type: 'object';
                };
                monitoring: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.';
                  properties: {
                    createdAt: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'];
                          type: 'string';
                        };
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12];
                          type: 'number';
                        };
                      };
                      required: ['interval', 'intervalCount'];
                      type: 'object';
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    maxQuantity: {
                      type: 'number';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    quantity: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'quantity', 'hidden'];
                  type: 'object';
                };
                monitoringMetric: {
                  properties: {
                    batch: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    threshold: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'batch', 'threshold', 'hidden'];
                  type: 'object';
                };
                passwordProtection: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.';
                  properties: {
                    createdAt: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'];
                          type: 'string';
                        };
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12];
                          type: 'number';
                        };
                      };
                      required: ['interval', 'intervalCount'];
                      type: 'object';
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    maxQuantity: {
                      type: 'number';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    quantity: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'quantity', 'hidden'];
                  type: 'object';
                };
                previewDeploymentSuffix: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.';
                  properties: {
                    createdAt: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'];
                          type: 'string';
                        };
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12];
                          type: 'number';
                        };
                      };
                      required: ['interval', 'intervalCount'];
                      type: 'object';
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    maxQuantity: {
                      type: 'number';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    quantity: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'quantity', 'hidden'];
                  type: 'object';
                };
                pro: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.';
                  properties: {
                    createdAt: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'];
                          type: 'string';
                        };
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12];
                          type: 'number';
                        };
                      };
                      required: ['interval', 'intervalCount'];
                      type: 'object';
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    maxQuantity: {
                      type: 'number';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    quantity: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'quantity', 'hidden'];
                  type: 'object';
                };
                saml: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.';
                  properties: {
                    createdAt: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'];
                          type: 'string';
                        };
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12];
                          type: 'number';
                        };
                      };
                      required: ['interval', 'intervalCount'];
                      type: 'object';
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    maxQuantity: {
                      type: 'number';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    quantity: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'quantity', 'hidden'];
                  type: 'object';
                };
                serverlessFunctionExecution: {
                  properties: {
                    batch: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    threshold: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'batch', 'threshold', 'hidden'];
                  type: 'object';
                };
                sourceImages: {
                  properties: {
                    batch: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    threshold: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'batch', 'threshold', 'hidden'];
                  type: 'object';
                };
                ssoProtection: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.';
                  properties: {
                    createdAt: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'];
                          type: 'string';
                        };
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12];
                          type: 'number';
                        };
                      };
                      required: ['interval', 'intervalCount'];
                      type: 'object';
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    maxQuantity: {
                      type: 'number';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    quantity: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'quantity', 'hidden'];
                  type: 'object';
                };
                teamSeats: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.';
                  properties: {
                    createdAt: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'];
                          type: 'string';
                        };
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12];
                          type: 'number';
                        };
                      };
                      required: ['interval', 'intervalCount'];
                      type: 'object';
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    maxQuantity: {
                      type: 'number';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    quantity: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'quantity', 'hidden'];
                  type: 'object';
                };
                webAnalytics: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.';
                  properties: {
                    createdAt: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'];
                          type: 'string';
                        };
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12];
                          type: 'number';
                        };
                      };
                      required: ['interval', 'intervalCount'];
                      type: 'object';
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    maxQuantity: {
                      type: 'number';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    quantity: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'quantity', 'hidden'];
                  type: 'object';
                };
                webAnalyticsEvent: {
                  properties: {
                    batch: {
                      type: 'number';
                    };
                    disabledAt: {
                      type: ['number', 'null'];
                    };
                    hidden: {
                      type: 'boolean';
                    };
                    name: {
                      type: 'string';
                    };
                    price: {
                      type: 'number';
                    };
                    threshold: {
                      type: 'number';
                    };
                    tier: {
                      type: 'number';
                    };
                  };
                  required: ['price', 'batch', 'threshold', 'hidden'];
                  type: 'object';
                };
              };
              type: ['object', 'null'];
            };
            invoiceSettings: {
              properties: {
                footer: {
                  type: 'string';
                };
              };
              type: 'object';
            };
            language: {
              type: ['string', 'null'];
            };
            name: {
              type: ['string', 'null'];
            };
            orbCustomerId: {
              type: 'string';
            };
            overdue: {
              type: ['boolean', 'null'];
            };
            period: {
              properties: {
                end: {
                  type: 'number';
                };
                start: {
                  type: 'number';
                };
              };
              required: ['start', 'end'];
              type: ['object', 'null'];
            };
            plan: {
              enum: ['hobby', 'enterprise', 'pro'];
              type: 'string';
            };
            platform: {
              enum: ['stripe', 'stripeTestMode'];
              type: 'string';
            };
            pricingExperiment: {
              enum: ['august-2022'];
              type: 'string';
            };
            programType: {
              enum: ['startup', 'agency'];
              type: 'string';
            };
            purchaseOrder: {
              type: ['string', 'null'];
            };
            status: {
              enum: ['active', 'canceled', 'trialing', 'overdue', 'expired'];
              type: 'string';
            };
            subscriptions: {
              items: {
                properties: {
                  discount: {
                    properties: {
                      coupon: {
                        properties: {
                          amountOff: {
                            type: ['number', 'null'];
                          };
                          duration: {
                            enum: ['forever', 'repeating', 'once'];
                            type: 'string';
                          };
                          durationInMonths: {
                            type: ['number', 'null'];
                          };
                          id: {
                            type: 'string';
                          };
                          name: {
                            type: ['string', 'null'];
                          };
                          percentageOff: {
                            type: ['number', 'null'];
                          };
                        };
                        required: ['id', 'name', 'amountOff', 'percentageOff', 'durationInMonths', 'duration'];
                        type: 'object';
                      };
                      id: {
                        type: 'string';
                      };
                    };
                    required: ['id', 'coupon'];
                    type: ['object', 'null'];
                  };
                  frequency: {
                    properties: {
                      interval: {
                        enum: ['month', 'day', 'week', 'year'];
                        type: 'string';
                      };
                      intervalCount: {
                        type: 'number';
                      };
                    };
                    required: ['interval', 'intervalCount'];
                    type: 'object';
                  };
                  id: {
                    type: 'string';
                  };
                  items: {
                    items: {
                      properties: {
                        amount: {
                          type: 'number';
                        };
                        id: {
                          type: 'string';
                        };
                        priceId: {
                          type: 'string';
                        };
                        productId: {
                          type: 'string';
                        };
                        quantity: {
                          type: 'number';
                        };
                      };
                      required: ['id', 'priceId', 'productId', 'amount', 'quantity'];
                      type: 'object';
                    };
                    type: 'array';
                  };
                  period: {
                    properties: {
                      end: {
                        type: 'number';
                      };
                      start: {
                        type: 'number';
                      };
                    };
                    required: ['start', 'end'];
                    type: 'object';
                  };
                  trial: {
                    properties: {
                      end: {
                        type: 'number';
                      };
                      start: {
                        type: 'number';
                      };
                    };
                    required: ['start', 'end'];
                    type: ['object', 'null'];
                  };
                };
                required: ['id', 'trial', 'period', 'frequency', 'discount', 'items'];
                type: 'object';
              };
              type: ['array', 'null'];
            };
            tax: {
              properties: {
                id: {
                  type: 'string';
                };
                type: {
                  type: 'string';
                };
              };
              required: ['type', 'id'];
              type: ['object', 'null'];
            };
            trial: {
              properties: {
                end: {
                  type: 'number';
                };
                start: {
                  type: 'number';
                };
              };
              required: ['start', 'end'];
              type: ['object', 'null'];
            };
          };
          required: ['period', 'plan'];
          type: ['object', 'null'];
        };
        createdAt: {
          description: 'UNIX timestamp (in milliseconds) when the User account was created.';
          examples: [1630748523395];
          type: 'number';
        };
        dismissedToasts: {
          description: 'A record of when, under a certain scopeId, a toast was dismissed';
          items: {
            description: 'A record of when, under a certain scopeId, a toast was dismissed';
            properties: {
              dismissals: {
                items: {
                  properties: {
                    createdAt: {
                      type: 'number';
                    };
                    scopeId: {
                      type: 'string';
                    };
                  };
                  required: ['scopeId', 'createdAt'];
                  type: 'object';
                };
                type: 'array';
              };
              name: {
                type: 'string';
              };
            };
            required: ['name', 'dismissals'];
            type: 'object';
          };
          type: 'array';
        };
        email: {
          description: 'Email address associated with the User account.';
          examples: ['me@example.com'];
          type: 'string';
        };
        favoriteProjects: {
          description: 'A list of projects across teams that a user has marked as a favorite.';
          items: {
            description: 'A list of projects across teams that a user has marked as a favorite.';
            properties: {
              projectId: {
                type: 'string';
              };
              scopeId: {
                type: 'string';
              };
              scopeSlug: {
                type: 'string';
              };
            };
            required: ['projectId', 'scopeId', 'scopeSlug'];
            type: 'object';
          };
          type: 'array';
        };
        hasTrialAvailable: {
          description: 'Whether the user has a trial available for a paid plan subscription.';
          type: 'boolean';
        };
        id: {
          description: "The User's unique identifier.";
          examples: ['AEIIDYVk59zbFF2Sxfyxxmua'];
          type: 'string';
        };
        importFlowGitNamespace: {
          oneOf: [
            {
              type: 'string';
            },
            {
              type: 'number';
            },
          ];
          type: 'null';
        };
        importFlowGitNamespaceId: {
          oneOf: [
            {
              type: 'string';
            },
            {
              type: 'number';
            },
          ];
          type: 'null';
        };
        importFlowGitProvider: {
          enum: ['github', 'gitlab', 'bitbucket'];
          type: 'string';
        };
        name: {
          description: 'Name associated with the User account, or `null` if none has been provided.';
          examples: ['John Doe'];
          type: ['string', 'null'];
        };
        preferredScopesAndGitNamespaces: {
          items: {
            properties: {
              gitNamespaceId: {
                oneOf: [
                  {
                    type: 'string';
                  },
                  {
                    type: 'number';
                  },
                ];
                type: 'null';
              };
              scopeId: {
                type: 'string';
              };
            };
            required: ['scopeId', 'gitNamespaceId'];
            type: 'object';
          };
          type: 'array';
        };
        remoteCaching: {
          description: 'remote caching settings';
          properties: {
            enabled: {
              type: 'boolean';
            };
          };
          type: 'object';
        };
        resourceConfig: {
          description: 'An object containing infomation related to the amount of platform resources may be allocated to the User account.';
          properties: {
            awsAccountIds: {
              items: {
                type: 'string';
              };
              type: 'array';
            };
            awsAccountType: {
              type: 'string';
            };
            cfZoneName: {
              type: 'string';
            };
            concurrentBuilds: {
              type: 'number';
            };
            edgeConfigSize: {
              description: 'To overwrite the maximum size of an Edge Config per account. Size is in kilobytes, eg 64 leads to 64kB or 64_000 bytes worth of storage';
              type: 'number';
            };
            edgeConfigs: {
              description: 'To overwrite the number of Edge Configs an account can create.';
              type: 'number';
            };
            nodeType: {
              type: 'string';
            };
          };
          type: 'object';
        };
        softBlock: {
          description: 'When the User account has been "soft blocked", this property will contain the date when the restriction was enacted, and the identifier for why.';
          properties: {
            blockedAt: {
              type: 'number';
            };
            reason: {
              enum: [
                'FAIR_USE_LIMITS_EXCEEDED',
                'ENTERPRISE_TRIAL_ENDED',
                'BLOCKED_FOR_PLATFORM_ABUSE',
                'UNPAID_INVOICE',
                'SUBSCRIPTION_EXPIRED',
                'SUBSCRIPTION_CANCELED',
              ];
              type: 'string';
            };
          };
          required: ['blockedAt', 'reason'];
          type: ['object', 'null'];
        };
        stagingPrefix: {
          description: 'Prefix that will be used in the URL of "Preview" deployments created by the User account.';
          type: 'string';
        };
        username: {
          description: 'Unique username associated with the User account.';
          examples: ['jdoe'];
          type: 'string';
        };
      };
      required: [
        'createdAt',
        'softBlock',
        'billing',
        'resourceConfig',
        'stagingPrefix',
        'hasTrialAvailable',
        'id',
        'email',
        'name',
        'username',
        'avatar',
      ];
      type: 'object';
    };
    AuthUserLimited: {
      description: 'A limited form of data for the currently authenticated User, due to the authentication token missing privileges to read the full User data.';
      properties: {
        avatar: {
          description: 'SHA1 hash of the avatar for the User account. Can be used in conjuction with the ... endpoint to retrieve the avatar image.';
          examples: ['22cb30c85ff45ac4c72de8981500006b28114aa1'];
          type: ['string', 'null'];
        };
        email: {
          description: 'Email address associated with the User account.';
          examples: ['me@example.com'];
          type: 'string';
        };
        id: {
          description: "The User's unique identifier.";
          examples: ['AEIIDYVk59zbFF2Sxfyxxmua'];
          type: 'string';
        };
        limited: {
          description: 'Property indicating that this User data contains only limited information, due to the authentication token missing privileges to read the full User data. Re-login with email, GitHub, GitLab or Bitbucket in order to upgrade the authentication token with the necessary privileges.';
          type: 'boolean';
        };
        name: {
          description: 'Name associated with the User account, or `null` if none has been provided.';
          examples: ['John Doe'];
          type: ['string', 'null'];
        };
        username: {
          description: 'Unique username associated with the User account.';
          examples: ['jdoe'];
          type: 'string';
        };
      };
      required: ['limited', 'id', 'email', 'name', 'username', 'avatar'];
      type: 'object';
    };
    EdgeConfigItem: {
      description: 'The EdgeConfig.';
      properties: {
        createdAt: {
          type: 'number';
        };
        edgeConfigId: {
          type: 'string';
        };
        key: {
          type: 'string';
        };
        updatedAt: {
          type: 'number';
        };
        value: {
          $ref: '#/components/schemas/EdgeConfigItemValue';
        };
      };
      required: ['key', 'value', 'edgeConfigId', 'createdAt', 'updatedAt'];
      type: 'object';
    };
    EdgeConfigItemValue: {
      oneOf: [
        {
          type: 'string';
        },
        {
          type: 'number';
        },
        {
          type: 'boolean';
        },
        {
          type: 'object';
        },
        {
          items: {
            $ref: '#/components/schemas/EdgeConfigItemValue';
          };
          type: 'array';
        },
      ];
      type: 'null';
    };
    EdgeConfigToken: {
      description: 'The EdgeConfig.';
      properties: {
        createdAt: {
          type: 'number';
        };
        edgeConfigId: {
          type: 'string';
        };
        id: {
          description: 'This is not the token itself, but rather an id to identify the token by';
          type: 'string';
        };
        label: {
          type: 'string';
        };
        token: {
          type: 'string';
        };
      };
      required: ['token', 'label', 'id', 'edgeConfigId', 'createdAt'];
      type: 'object';
    };
    FileTree: {
      description: 'A deployment file tree entry';
      properties: {
        children: {
          description: 'The list of children files of the directory (only valid for the `directory` type)';
          items: {
            $ref: '#/components/schemas/FileTree';
          };
          type: 'array';
        };
        contentType: {
          description: 'The content-type of the file (only valid for the `file` type)';
          examples: ['application/json'];
          type: 'string';
        };
        mode: {
          description: 'The file "mode" indicating file type and permissions.';
          type: 'number';
        };
        name: {
          description: 'The name of the file tree entry';
          examples: ['my-file.json'];
          type: 'string';
        };
        symlink: {
          description: 'Not currently used. See `file-list-to-tree.ts`.';
          type: 'string';
        };
        type: {
          description: 'String indicating the type of file tree entry.';
          enum: ['directory', 'file', 'symlink', 'lambda', 'middleware', 'invalid'];
          examples: ['file'];
          type: 'string';
        };
        uid: {
          description: 'The unique identifier of the file (only valid for the `file` type)';
          examples: ['2d4aad419917f15b1146e9e03ddc9bb31747e4d0'];
          type: 'string';
        };
      };
      required: ['name', 'type', 'mode'];
      type: 'object';
    };
    Pagination: {
      description: 'This object contains information related to the pagination of the current request, including the necessary parameters to get the next or previous page of data.';
      properties: {
        count: {
          description: 'Amount of items in the current page.';
          examples: [20];
          type: 'number';
        };
        next: {
          description: 'Timestamp that must be used to request the next page.';
          examples: [1540095775951];
          type: ['number', 'null'];
        };
        prev: {
          description: 'Timestamp that must be used to request the previous page.';
          examples: [1540095775951];
          type: ['number', 'null'];
        };
      };
      required: ['count', 'next', 'prev'];
      type: 'object';
    };
    Team: {
      description: 'Data representing a Team.';
      type: 'object';
    };
    TeamLimited: {
      description: 'A limited form of data representing a Team, due to the authentication token missing privileges to read the full Team data.';
      properties: {
        avatar: {
          description: 'The ID of the file used as avatar for this Team.';
          examples: ['6eb07268bcfadd309905ffb1579354084c24655c'];
          type: ['string', 'null'];
        };
        created: {
          description: 'Will remain undocumented. Remove in v3 API.';
          type: 'string';
        };
        createdAt: {
          description: 'UNIX timestamp (in milliseconds) when the Team was created.';
          examples: [1630748523395];
          type: 'number';
        };
        id: {
          description: "The Team's unique identifier.";
          examples: ['team_nllPyCtREAqxxdyFKbbMDlxd'];
          type: 'string';
        };
        limited: {
          description: "Property indicating that this Team data contains only limited information, due to the authentication token missing privileges to read the full Team data. Re-login with the Team's configured SAML Single Sign-On provider in order to upgrade the authentication token with the necessary privileges.";
          type: 'boolean';
        };
        membership: {
          oneOf: [
            {
              description: 'The membership of the authenticated User in relation to the Team.';
              properties: {
                accessRequestedAt: {
                  type: 'number';
                };
                confirmed: {
                  type: 'boolean';
                };
                confirmedAt: {
                  type: 'number';
                };
                created: {
                  type: 'number';
                };
                createdAt: {
                  type: 'number';
                };
                joinedFrom: {
                  properties: {
                    commitId: {
                      type: 'string';
                    };
                    dsyncConnectedAt: {
                      type: 'number';
                    };
                    dsyncUserId: {
                      type: 'string';
                    };
                    gitUserId: {
                      oneOf: [
                        {
                          type: 'string';
                        },
                        {
                          type: 'number';
                        },
                      ];
                    };
                    gitUserLogin: {
                      type: 'string';
                    };
                    idpUserId: {
                      type: 'string';
                    };
                    origin: {
                      enum: [
                        'import',
                        'saml',
                        'mail',
                        'link',
                        'teams',
                        'github',
                        'gitlab',
                        'bitbucket',
                        'dsync',
                        'feedback',
                        'organization-teams',
                      ];
                      type: 'string';
                    };
                    repoId: {
                      type: 'string';
                    };
                    repoPath: {
                      type: 'string';
                    };
                    ssoConnectedAt: {
                      type: 'number';
                    };
                    ssoUserId: {
                      type: 'string';
                    };
                  };
                  required: ['origin'];
                  type: 'object';
                };
                role: {
                  enum: ['MEMBER', 'OWNER', 'VIEWER', 'DEVELOPER', 'BILLING'];
                  type: 'string';
                };
                teamId: {
                  type: 'string';
                };
                uid: {
                  type: 'string';
                };
              };
              required: ['confirmed', 'confirmedAt', 'role', 'uid', 'createdAt', 'created'];
              type: 'object';
            },
            {
              description: 'The membership of the authenticated User in relation to the Team.';
              properties: {
                accessRequestedAt: {
                  type: 'number';
                };
                confirmed: {
                  type: 'boolean';
                };
                confirmedAt: {
                  type: 'number';
                };
                created: {
                  type: 'number';
                };
                createdAt: {
                  type: 'number';
                };
                joinedFrom: {
                  properties: {
                    commitId: {
                      type: 'string';
                    };
                    dsyncConnectedAt: {
                      type: 'number';
                    };
                    dsyncUserId: {
                      type: 'string';
                    };
                    gitUserId: {
                      oneOf: [
                        {
                          type: 'string';
                        },
                        {
                          type: 'number';
                        },
                      ];
                    };
                    gitUserLogin: {
                      type: 'string';
                    };
                    idpUserId: {
                      type: 'string';
                    };
                    origin: {
                      enum: [
                        'import',
                        'saml',
                        'mail',
                        'link',
                        'teams',
                        'github',
                        'gitlab',
                        'bitbucket',
                        'dsync',
                        'feedback',
                        'organization-teams',
                      ];
                      type: 'string';
                    };
                    repoId: {
                      type: 'string';
                    };
                    repoPath: {
                      type: 'string';
                    };
                    ssoConnectedAt: {
                      type: 'number';
                    };
                    ssoUserId: {
                      type: 'string';
                    };
                  };
                  required: ['origin'];
                  type: 'object';
                };
                role: {
                  enum: ['MEMBER', 'OWNER', 'VIEWER', 'DEVELOPER', 'BILLING'];
                  type: 'string';
                };
                teamId: {
                  type: 'string';
                };
                uid: {
                  type: 'string';
                };
              };
              required: ['confirmed', 'accessRequestedAt', 'role', 'uid', 'createdAt', 'created'];
              type: 'object';
            },
          ];
        };
        name: {
          description: 'Name associated with the Team account, or `null` if none has been provided.';
          examples: ['My Team'];
          type: ['string', 'null'];
        };
        saml: {
          description: 'When "Single Sign-On (SAML)" is configured, this object contains information that allows the client-side to identify whether or not this Team has SAML enforced.';
          properties: {
            connection: {
              description: 'From T, pick a set of properties whose keys are in the union K';
              properties: {
                createdAt: {
                  type: ['number', 'null'];
                };
                creator: {
                  type: 'string';
                };
                domain: {
                  type: 'string';
                };
                id: {
                  type: 'string';
                };
                name: {
                  type: 'string';
                };
                recordType: {
                  enum: ['A', 'AAAA', 'ALIAS', 'CAA', 'CNAME', 'MX', 'SRV', 'TXT', 'NS'];
                  type: 'string';
                };
                ttl: {
                  type: 'number';
                };
                type: {
                  enum: ['record', 'record-sys'];
                  type: 'string';
                };
                value: {
                  type: 'string';
                };
              };
              required: ['creator', 'domain', 'id', 'name', 'recordType', 'type', 'value'];
              type: 'object';
            };
            directory: {
              description: 'From T, pick a set of properties whose keys are in the union K';
              properties: {
                createdAt: {
                  type: ['number', 'null'];
                };
                creator: {
                  type: 'string';
                };
                domain: {
                  type: 'string';
                };
                id: {
                  type: 'string';
                };
                name: {
                  type: 'string';
                };
                recordType: {
                  enum: ['A', 'AAAA', 'ALIAS', 'CAA', 'CNAME', 'MX', 'SRV', 'TXT', 'NS'];
                  type: 'string';
                };
                ttl: {
                  type: 'number';
                };
                type: {
                  enum: ['record', 'record-sys'];
                  type: 'string';
                };
                value: {
                  type: 'string';
                };
              };
              required: ['creator', 'domain', 'id', 'name', 'recordType', 'type', 'value'];
              type: 'object';
            };
            enforced: {
              description: "When `true`, interactions with the Team **must** be done with an authentication token that has been authenticated with the Team's SAML Single Sign-On provider.";
              type: 'boolean';
            };
          };
          required: ['enforced'];
          type: 'object';
        };
        slug: {
          description: "The Team's slug, which is unique across the Vercel platform.";
          examples: ['my-team'];
          type: 'string';
        };
      };
      required: ['limited', 'id', 'slug', 'name', 'avatar', 'membership', 'created', 'createdAt'];
      type: 'object';
    };
    UserEvent: {
      description: 'Array of events generated by the User.';
      properties: {
        createdAt: {
          description: 'Timestamp (in milliseconds) of when the event was generated.';
          examples: [1632859321020];
          type: 'number';
        };
        entities: {
          description: 'A list of "entities" within the event `text`. Useful for enhancing the displayed text with additional styling and links.';
          items: {
            description: 'A list of "entities" within the event `text`. Useful for enhancing the displayed text with additional styling and links.';
            properties: {
              end: {
                description: 'The index of where the entity ends within the `text` (non-inclusive).';
                examples: [3];
                type: 'number';
              };
              start: {
                description: 'The index of where the entity begins within the `text` (inclusive).';
                examples: [0];
                type: 'number';
              };
              type: {
                description: 'The type of entity.';
                enum: [
                  'target',
                  'author',
                  'bitbucket_login',
                  'bold',
                  'deployment_host',
                  'dns_record',
                  'git_link',
                  'github_login',
                  'gitlab_login',
                  'hook_name',
                  'integration',
                  'edge-config',
                  'link',
                  'project_name',
                  'scaling_rules',
                  'env_var_name',
                  'system',
                ];
                examples: ['author'];
                type: 'string';
              };
            };
            required: ['type', 'start', 'end'];
            type: 'object';
          };
          type: 'array';
        };
        id: {
          description: 'The unique identifier of the Event.';
          examples: ['uev_bfmMjiMnXfnPbT97dGdpJbCN'];
          type: 'string';
        };
        text: {
          description: 'The human-readable text of the Event.';
          examples: ['You logged in via GitHub'];
          type: 'string';
        };
        user: {
          description: 'Metadata for the User who generated the event.';
          properties: {
            avatar: {
              type: 'string';
            };
            email: {
              type: 'string';
            };
            slug: {
              type: 'string';
            };
            uid: {
              type: 'string';
            };
            username: {
              type: 'string';
            };
          };
          required: ['avatar', 'email', 'uid', 'username'];
          type: 'object';
        };
        userId: {
          description: 'The unique identifier of the User who generated the event.';
          examples: ['zTuNVUXEAvvnNN3IaqinkyMw'];
          type: 'string';
        };
      };
      required: ['id', 'text', 'entities', 'createdAt', 'userId'];
      type: 'object';
    };
  };
  securitySchemes: {
    bearerToken: {
      description: 'Default authentication mechanism';
      scheme: 'bearer';
      type: 'http';
    };
    oauth2: {
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://api.vercel.com/oauth/authorize';
          scopes: {};
          tokenUrl: 'https://api.vercel.com/oauth/access_token';
        };
      };
      type: 'oauth2';
    };
  };
};
export const components = {
  schemas: {
    ACLAction: {
      description:
        'Enum containing the actions that can be performed against a resource. Group operations are included.',
      enum: ['create', 'delete', 'read', 'update', 'list', 'count'],
      type: 'string',
    },
    AuthToken: {
      description: 'Authentication token metadata.',
      properties: {
        activeAt: {
          description: 'Timestamp (in milliseconds) of when the token was most recently used.',
          examples: [1632816536002],
          type: 'number',
        },
        createdAt: {
          description: 'Timestamp (in milliseconds) of when the token was created.',
          examples: [1632816536002],
          type: 'number',
        },
        expiresAt: {
          description: 'Timestamp (in milliseconds) of when the token expires.',
          examples: [1632816536002],
          type: 'number',
        },
        id: {
          description: 'The unique identifier of the token.',
          examples: ['5d9f2ebd38ddca62e5d51e9c1704c72530bdc8bfdd41e782a6687c48399e8391'],
          type: 'string',
        },
        name: {
          description: 'The human-readable name of the token.',
          type: 'string',
        },
        origin: {
          description: 'The origin of how the token was created.',
          examples: ['github'],
          type: 'string',
        },
        scopes: {
          description: 'The access scopes granted to the token.',
          items: {
            oneOf: [
              {
                description: 'The access scopes granted to the token.',
                properties: {
                  createdAt: {
                    type: 'number',
                  },
                  expiresAt: {
                    type: 'number',
                  },
                  origin: {
                    enum: ['saml', 'github', 'gitlab', 'bitbucket', 'email', 'manual'],
                    type: 'string',
                  },
                  type: {
                    enum: ['user'],
                    type: 'string',
                  },
                },
                required: ['type', 'origin', 'createdAt'],
                type: 'object',
              },
              {
                description: 'The access scopes granted to the token.',
                properties: {
                  createdAt: {
                    type: 'number',
                  },
                  expiresAt: {
                    type: 'number',
                  },
                  origin: {
                    enum: ['saml', 'github', 'gitlab', 'bitbucket', 'email', 'manual'],
                    type: 'string',
                  },
                  teamId: {
                    type: 'string',
                  },
                  type: {
                    enum: ['team'],
                    type: 'string',
                  },
                },
                required: ['type', 'teamId', 'origin', 'createdAt'],
                type: 'object',
              },
            ],
          },
          type: 'array',
        },
        type: {
          description: 'The type of the token.',
          examples: ['oauth2-token'],
          type: 'string',
        },
      },
      required: ['id', 'name', 'type', 'activeAt', 'createdAt'],
      type: 'object',
    },
    AuthUser: {
      description: 'Data for the currently authenticated User.',
      properties: {
        activeDashboardViews: {
          description: 'set of dashboard view preferences (cards or list) per scopeId',
          items: {
            description: 'set of dashboard view preferences (cards or list) per scopeId',
            properties: {
              scopeId: {
                type: 'string',
              },
              viewPreference: {
                enum: ['cards', 'list'],
                type: 'string',
              },
            },
            required: ['scopeId', 'viewPreference'],
            type: 'object',
          },
          type: 'array',
        },
        avatar: {
          description:
            'SHA1 hash of the avatar for the User account. Can be used in conjuction with the ... endpoint to retrieve the avatar image.',
          examples: ['22cb30c85ff45ac4c72de8981500006b28114aa1'],
          type: ['string', 'null'],
        },
        billing: {
          description: 'An object containing billing infomation associated with the User account.',
          properties: {
            addons: {
              items: {
                enum: ['custom-deployment-suffix', 'live-support'],
                type: 'string',
              },
              type: ['array', 'null'],
            },
            address: {
              properties: {
                city: {
                  type: 'string',
                },
                country: {
                  type: 'string',
                },
                line1: {
                  type: 'string',
                },
                line2: {
                  type: 'string',
                },
                postalCode: {
                  type: 'string',
                },
                state: {
                  type: 'string',
                },
              },
              required: ['line1'],
              type: ['object', 'null'],
            },
            cancelation: {
              type: ['number', 'null'],
            },
            contract: {
              properties: {
                end: {
                  type: 'number',
                },
                start: {
                  type: 'number',
                },
              },
              required: ['start', 'end'],
              type: ['object', 'null'],
            },
            controls: {
              properties: {
                analyticsSampleRateInPercent: {
                  type: ['number', 'null'],
                },
                analyticsSpendLimitInDollars: {
                  type: ['number', 'null'],
                },
              },
              type: ['object', 'null'],
            },
            currency: {
              enum: ['usd', 'eur'],
              type: 'string',
            },
            email: {
              type: ['string', 'null'],
            },
            invoiceItems: {
              properties: {
                analytics: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.',
                  properties: {
                    createdAt: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'],
                          type: 'string',
                        },
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12],
                          type: 'number',
                        },
                      },
                      required: ['interval', 'intervalCount'],
                      type: 'object',
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    maxQuantity: {
                      type: 'number',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    quantity: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'quantity', 'hidden'],
                  type: 'object',
                },
                analyticsUsage: {
                  properties: {
                    batch: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    threshold: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'batch', 'threshold', 'hidden'],
                  type: 'object',
                },
                artifacts: {
                  properties: {
                    batch: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    threshold: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'batch', 'threshold', 'hidden'],
                  type: 'object',
                },
                bandwidth: {
                  properties: {
                    batch: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    threshold: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'batch', 'threshold', 'hidden'],
                  type: 'object',
                },
                builds: {
                  properties: {
                    batch: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    threshold: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'batch', 'threshold', 'hidden'],
                  type: 'object',
                },
                concurrentBuilds: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.',
                  properties: {
                    createdAt: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'],
                          type: 'string',
                        },
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12],
                          type: 'number',
                        },
                      },
                      required: ['interval', 'intervalCount'],
                      type: 'object',
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    maxQuantity: {
                      type: 'number',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    quantity: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'quantity', 'hidden'],
                  type: 'object',
                },
                cronJobInvocation: {
                  properties: {
                    batch: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    threshold: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'batch', 'threshold', 'hidden'],
                  type: 'object',
                },
                customCerts: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.',
                  properties: {
                    createdAt: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'],
                          type: 'string',
                        },
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12],
                          type: 'number',
                        },
                      },
                      required: ['interval', 'intervalCount'],
                      type: 'object',
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    maxQuantity: {
                      type: 'number',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    quantity: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'quantity', 'hidden'],
                  type: 'object',
                },
                edgeConfigRead: {
                  properties: {
                    batch: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    threshold: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'batch', 'threshold', 'hidden'],
                  type: 'object',
                },
                edgeConfigWrite: {
                  properties: {
                    batch: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    threshold: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'batch', 'threshold', 'hidden'],
                  type: 'object',
                },
                edgeFunctionExecutionUnits: {
                  properties: {
                    batch: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    threshold: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'batch', 'threshold', 'hidden'],
                  type: 'object',
                },
                edgeMiddlewareInvocations: {
                  properties: {
                    batch: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    threshold: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'batch', 'threshold', 'hidden'],
                  type: 'object',
                },
                enterprise: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.',
                  properties: {
                    createdAt: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'],
                          type: 'string',
                        },
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12],
                          type: 'number',
                        },
                      },
                      required: ['interval', 'intervalCount'],
                      type: 'object',
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    maxQuantity: {
                      type: 'number',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    quantity: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'quantity', 'hidden'],
                  type: 'object',
                },
                monitoring: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.',
                  properties: {
                    createdAt: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'],
                          type: 'string',
                        },
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12],
                          type: 'number',
                        },
                      },
                      required: ['interval', 'intervalCount'],
                      type: 'object',
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    maxQuantity: {
                      type: 'number',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    quantity: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'quantity', 'hidden'],
                  type: 'object',
                },
                monitoringMetric: {
                  properties: {
                    batch: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    threshold: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'batch', 'threshold', 'hidden'],
                  type: 'object',
                },
                passwordProtection: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.',
                  properties: {
                    createdAt: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'],
                          type: 'string',
                        },
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12],
                          type: 'number',
                        },
                      },
                      required: ['interval', 'intervalCount'],
                      type: 'object',
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    maxQuantity: {
                      type: 'number',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    quantity: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'quantity', 'hidden'],
                  type: 'object',
                },
                previewDeploymentSuffix: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.',
                  properties: {
                    createdAt: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'],
                          type: 'string',
                        },
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12],
                          type: 'number',
                        },
                      },
                      required: ['interval', 'intervalCount'],
                      type: 'object',
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    maxQuantity: {
                      type: 'number',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    quantity: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'quantity', 'hidden'],
                  type: 'object',
                },
                pro: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.',
                  properties: {
                    createdAt: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'],
                          type: 'string',
                        },
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12],
                          type: 'number',
                        },
                      },
                      required: ['interval', 'intervalCount'],
                      type: 'object',
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    maxQuantity: {
                      type: 'number',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    quantity: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'quantity', 'hidden'],
                  type: 'object',
                },
                saml: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.',
                  properties: {
                    createdAt: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'],
                          type: 'string',
                        },
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12],
                          type: 'number',
                        },
                      },
                      required: ['interval', 'intervalCount'],
                      type: 'object',
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    maxQuantity: {
                      type: 'number',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    quantity: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'quantity', 'hidden'],
                  type: 'object',
                },
                serverlessFunctionExecution: {
                  properties: {
                    batch: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    threshold: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'batch', 'threshold', 'hidden'],
                  type: 'object',
                },
                sourceImages: {
                  properties: {
                    batch: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    threshold: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'batch', 'threshold', 'hidden'],
                  type: 'object',
                },
                ssoProtection: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.',
                  properties: {
                    createdAt: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'],
                          type: 'string',
                        },
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12],
                          type: 'number',
                        },
                      },
                      required: ['interval', 'intervalCount'],
                      type: 'object',
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    maxQuantity: {
                      type: 'number',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    quantity: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'quantity', 'hidden'],
                  type: 'object',
                },
                teamSeats: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.',
                  properties: {
                    createdAt: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'],
                          type: 'string',
                        },
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12],
                          type: 'number',
                        },
                      },
                      required: ['interval', 'intervalCount'],
                      type: 'object',
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    maxQuantity: {
                      type: 'number',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    quantity: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'quantity', 'hidden'],
                  type: 'object',
                },
                webAnalytics: {
                  description: 'Will be used to create an invoice item. The price must be in cents: 2000 for $20.',
                  properties: {
                    createdAt: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    frequency: {
                      properties: {
                        interval: {
                          enum: ['month'],
                          type: 'string',
                        },
                        intervalCount: {
                          enum: [1, 3, 2, 6, 12],
                          type: 'number',
                        },
                      },
                      required: ['interval', 'intervalCount'],
                      type: 'object',
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    maxQuantity: {
                      type: 'number',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    quantity: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'quantity', 'hidden'],
                  type: 'object',
                },
                webAnalyticsEvent: {
                  properties: {
                    batch: {
                      type: 'number',
                    },
                    disabledAt: {
                      type: ['number', 'null'],
                    },
                    hidden: {
                      type: 'boolean',
                    },
                    name: {
                      type: 'string',
                    },
                    price: {
                      type: 'number',
                    },
                    threshold: {
                      type: 'number',
                    },
                    tier: {
                      type: 'number',
                    },
                  },
                  required: ['price', 'batch', 'threshold', 'hidden'],
                  type: 'object',
                },
              },
              type: ['object', 'null'],
            },
            invoiceSettings: {
              properties: {
                footer: {
                  type: 'string',
                },
              },
              type: 'object',
            },
            language: {
              type: ['string', 'null'],
            },
            name: {
              type: ['string', 'null'],
            },
            orbCustomerId: {
              type: 'string',
            },
            overdue: {
              type: ['boolean', 'null'],
            },
            period: {
              properties: {
                end: {
                  type: 'number',
                },
                start: {
                  type: 'number',
                },
              },
              required: ['start', 'end'],
              type: ['object', 'null'],
            },
            plan: {
              enum: ['hobby', 'enterprise', 'pro'],
              type: 'string',
            },
            platform: {
              enum: ['stripe', 'stripeTestMode'],
              type: 'string',
            },
            pricingExperiment: {
              enum: ['august-2022'],
              type: 'string',
            },
            programType: {
              enum: ['startup', 'agency'],
              type: 'string',
            },
            purchaseOrder: {
              type: ['string', 'null'],
            },
            status: {
              enum: ['active', 'canceled', 'trialing', 'overdue', 'expired'],
              type: 'string',
            },
            subscriptions: {
              items: {
                properties: {
                  discount: {
                    properties: {
                      coupon: {
                        properties: {
                          amountOff: {
                            type: ['number', 'null'],
                          },
                          duration: {
                            enum: ['forever', 'repeating', 'once'],
                            type: 'string',
                          },
                          durationInMonths: {
                            type: ['number', 'null'],
                          },
                          id: {
                            type: 'string',
                          },
                          name: {
                            type: ['string', 'null'],
                          },
                          percentageOff: {
                            type: ['number', 'null'],
                          },
                        },
                        required: ['id', 'name', 'amountOff', 'percentageOff', 'durationInMonths', 'duration'],
                        type: 'object',
                      },
                      id: {
                        type: 'string',
                      },
                    },
                    required: ['id', 'coupon'],
                    type: ['object', 'null'],
                  },
                  frequency: {
                    properties: {
                      interval: {
                        enum: ['month', 'day', 'week', 'year'],
                        type: 'string',
                      },
                      intervalCount: {
                        type: 'number',
                      },
                    },
                    required: ['interval', 'intervalCount'],
                    type: 'object',
                  },
                  id: {
                    type: 'string',
                  },
                  items: {
                    items: {
                      properties: {
                        amount: {
                          type: 'number',
                        },
                        id: {
                          type: 'string',
                        },
                        priceId: {
                          type: 'string',
                        },
                        productId: {
                          type: 'string',
                        },
                        quantity: {
                          type: 'number',
                        },
                      },
                      required: ['id', 'priceId', 'productId', 'amount', 'quantity'],
                      type: 'object',
                    },
                    type: 'array',
                  },
                  period: {
                    properties: {
                      end: {
                        type: 'number',
                      },
                      start: {
                        type: 'number',
                      },
                    },
                    required: ['start', 'end'],
                    type: 'object',
                  },
                  trial: {
                    properties: {
                      end: {
                        type: 'number',
                      },
                      start: {
                        type: 'number',
                      },
                    },
                    required: ['start', 'end'],
                    type: ['object', 'null'],
                  },
                },
                required: ['id', 'trial', 'period', 'frequency', 'discount', 'items'],
                type: 'object',
              },
              type: ['array', 'null'],
            },
            tax: {
              properties: {
                id: {
                  type: 'string',
                },
                type: {
                  type: 'string',
                },
              },
              required: ['type', 'id'],
              type: ['object', 'null'],
            },
            trial: {
              properties: {
                end: {
                  type: 'number',
                },
                start: {
                  type: 'number',
                },
              },
              required: ['start', 'end'],
              type: ['object', 'null'],
            },
          },
          required: ['period', 'plan'],
          type: ['object', 'null'],
        },
        createdAt: {
          description: 'UNIX timestamp (in milliseconds) when the User account was created.',
          examples: [1630748523395],
          type: 'number',
        },
        dismissedToasts: {
          description: 'A record of when, under a certain scopeId, a toast was dismissed',
          items: {
            description: 'A record of when, under a certain scopeId, a toast was dismissed',
            properties: {
              dismissals: {
                items: {
                  properties: {
                    createdAt: {
                      type: 'number',
                    },
                    scopeId: {
                      type: 'string',
                    },
                  },
                  required: ['scopeId', 'createdAt'],
                  type: 'object',
                },
                type: 'array',
              },
              name: {
                type: 'string',
              },
            },
            required: ['name', 'dismissals'],
            type: 'object',
          },
          type: 'array',
        },
        email: {
          description: 'Email address associated with the User account.',
          examples: ['me@example.com'],
          type: 'string',
        },
        favoriteProjects: {
          description: 'A list of projects across teams that a user has marked as a favorite.',
          items: {
            description: 'A list of projects across teams that a user has marked as a favorite.',
            properties: {
              projectId: {
                type: 'string',
              },
              scopeId: {
                type: 'string',
              },
              scopeSlug: {
                type: 'string',
              },
            },
            required: ['projectId', 'scopeId', 'scopeSlug'],
            type: 'object',
          },
          type: 'array',
        },
        hasTrialAvailable: {
          description: 'Whether the user has a trial available for a paid plan subscription.',
          type: 'boolean',
        },
        id: {
          description: "The User's unique identifier.",
          examples: ['AEIIDYVk59zbFF2Sxfyxxmua'],
          type: 'string',
        },
        importFlowGitNamespace: {
          oneOf: [
            {
              type: 'string',
            },
            {
              type: 'number',
            },
          ],
          type: 'null',
        },
        importFlowGitNamespaceId: {
          oneOf: [
            {
              type: 'string',
            },
            {
              type: 'number',
            },
          ],
          type: 'null',
        },
        importFlowGitProvider: {
          enum: ['github', 'gitlab', 'bitbucket'],
          type: 'string',
        },
        name: {
          description: 'Name associated with the User account, or `null` if none has been provided.',
          examples: ['John Doe'],
          type: ['string', 'null'],
        },
        preferredScopesAndGitNamespaces: {
          items: {
            properties: {
              gitNamespaceId: {
                oneOf: [
                  {
                    type: 'string',
                  },
                  {
                    type: 'number',
                  },
                ],
                type: 'null',
              },
              scopeId: {
                type: 'string',
              },
            },
            required: ['scopeId', 'gitNamespaceId'],
            type: 'object',
          },
          type: 'array',
        },
        remoteCaching: {
          description: 'remote caching settings',
          properties: {
            enabled: {
              type: 'boolean',
            },
          },
          type: 'object',
        },
        resourceConfig: {
          description:
            'An object containing infomation related to the amount of platform resources may be allocated to the User account.',
          properties: {
            awsAccountIds: {
              items: {
                type: 'string',
              },
              type: 'array',
            },
            awsAccountType: {
              type: 'string',
            },
            cfZoneName: {
              type: 'string',
            },
            concurrentBuilds: {
              type: 'number',
            },
            edgeConfigSize: {
              description:
                'To overwrite the maximum size of an Edge Config per account. Size is in kilobytes, eg 64 leads to 64kB or 64_000 bytes worth of storage',
              type: 'number',
            },
            edgeConfigs: {
              description: 'To overwrite the number of Edge Configs an account can create.',
              type: 'number',
            },
            nodeType: {
              type: 'string',
            },
          },
          type: 'object',
        },
        softBlock: {
          description:
            'When the User account has been "soft blocked", this property will contain the date when the restriction was enacted, and the identifier for why.',
          properties: {
            blockedAt: {
              type: 'number',
            },
            reason: {
              enum: [
                'FAIR_USE_LIMITS_EXCEEDED',
                'ENTERPRISE_TRIAL_ENDED',
                'BLOCKED_FOR_PLATFORM_ABUSE',
                'UNPAID_INVOICE',
                'SUBSCRIPTION_EXPIRED',
                'SUBSCRIPTION_CANCELED',
              ],
              type: 'string',
            },
          },
          required: ['blockedAt', 'reason'],
          type: ['object', 'null'],
        },
        stagingPrefix: {
          description: 'Prefix that will be used in the URL of "Preview" deployments created by the User account.',
          type: 'string',
        },
        username: {
          description: 'Unique username associated with the User account.',
          examples: ['jdoe'],
          type: 'string',
        },
      },
      required: [
        'createdAt',
        'softBlock',
        'billing',
        'resourceConfig',
        'stagingPrefix',
        'hasTrialAvailable',
        'id',
        'email',
        'name',
        'username',
        'avatar',
      ],
      type: 'object',
    },
    AuthUserLimited: {
      description:
        'A limited form of data for the currently authenticated User, due to the authentication token missing privileges to read the full User data.',
      properties: {
        avatar: {
          description:
            'SHA1 hash of the avatar for the User account. Can be used in conjuction with the ... endpoint to retrieve the avatar image.',
          examples: ['22cb30c85ff45ac4c72de8981500006b28114aa1'],
          type: ['string', 'null'],
        },
        email: {
          description: 'Email address associated with the User account.',
          examples: ['me@example.com'],
          type: 'string',
        },
        id: {
          description: "The User's unique identifier.",
          examples: ['AEIIDYVk59zbFF2Sxfyxxmua'],
          type: 'string',
        },
        limited: {
          description:
            'Property indicating that this User data contains only limited information, due to the authentication token missing privileges to read the full User data. Re-login with email, GitHub, GitLab or Bitbucket in order to upgrade the authentication token with the necessary privileges.',
          type: 'boolean',
        },
        name: {
          description: 'Name associated with the User account, or `null` if none has been provided.',
          examples: ['John Doe'],
          type: ['string', 'null'],
        },
        username: {
          description: 'Unique username associated with the User account.',
          examples: ['jdoe'],
          type: 'string',
        },
      },
      required: ['limited', 'id', 'email', 'name', 'username', 'avatar'],
      type: 'object',
    },
    EdgeConfigItem: {
      description: 'The EdgeConfig.',
      properties: {
        createdAt: {
          type: 'number',
        },
        edgeConfigId: {
          type: 'string',
        },
        key: {
          type: 'string',
        },
        updatedAt: {
          type: 'number',
        },
        value: {
          $ref: '#/components/schemas/EdgeConfigItemValue',
        },
      },
      required: ['key', 'value', 'edgeConfigId', 'createdAt', 'updatedAt'],
      type: 'object',
    },
    EdgeConfigItemValue: {
      oneOf: [
        {
          type: 'string',
        },
        {
          type: 'number',
        },
        {
          type: 'boolean',
        },
        {
          type: 'object',
        },
        {
          items: {
            $ref: '#/components/schemas/EdgeConfigItemValue',
          },
          type: 'array',
        },
      ],
      type: 'null',
    },
    EdgeConfigToken: {
      description: 'The EdgeConfig.',
      properties: {
        createdAt: {
          type: 'number',
        },
        edgeConfigId: {
          type: 'string',
        },
        id: {
          description: 'This is not the token itself, but rather an id to identify the token by',
          type: 'string',
        },
        label: {
          type: 'string',
        },
        token: {
          type: 'string',
        },
      },
      required: ['token', 'label', 'id', 'edgeConfigId', 'createdAt'],
      type: 'object',
    },
    FileTree: {
      description: 'A deployment file tree entry',
      properties: {
        children: {
          description: 'The list of children files of the directory (only valid for the `directory` type)',
          items: {
            $ref: '#/components/schemas/FileTree',
          },
          type: 'array',
        },
        contentType: {
          description: 'The content-type of the file (only valid for the `file` type)',
          examples: ['application/json'],
          type: 'string',
        },
        mode: {
          description: 'The file "mode" indicating file type and permissions.',
          type: 'number',
        },
        name: {
          description: 'The name of the file tree entry',
          examples: ['my-file.json'],
          type: 'string',
        },
        symlink: {
          description: 'Not currently used. See `file-list-to-tree.ts`.',
          type: 'string',
        },
        type: {
          description: 'String indicating the type of file tree entry.',
          enum: ['directory', 'file', 'symlink', 'lambda', 'middleware', 'invalid'],
          examples: ['file'],
          type: 'string',
        },
        uid: {
          description: 'The unique identifier of the file (only valid for the `file` type)',
          examples: ['2d4aad419917f15b1146e9e03ddc9bb31747e4d0'],
          type: 'string',
        },
      },
      required: ['name', 'type', 'mode'],
      type: 'object',
    },
    Pagination: {
      description:
        'This object contains information related to the pagination of the current request, including the necessary parameters to get the next or previous page of data.',
      properties: {
        count: {
          description: 'Amount of items in the current page.',
          examples: [20],
          type: 'number',
        },
        next: {
          description: 'Timestamp that must be used to request the next page.',
          examples: [1540095775951],
          type: ['number', 'null'],
        },
        prev: {
          description: 'Timestamp that must be used to request the previous page.',
          examples: [1540095775951],
          type: ['number', 'null'],
        },
      },
      required: ['count', 'next', 'prev'],
      type: 'object',
    },
    Team: {
      description: 'Data representing a Team.',
      type: 'object',
    },
    TeamLimited: {
      description:
        'A limited form of data representing a Team, due to the authentication token missing privileges to read the full Team data.',
      properties: {
        avatar: {
          description: 'The ID of the file used as avatar for this Team.',
          examples: ['6eb07268bcfadd309905ffb1579354084c24655c'],
          type: ['string', 'null'],
        },
        created: {
          description: 'Will remain undocumented. Remove in v3 API.',
          type: 'string',
        },
        createdAt: {
          description: 'UNIX timestamp (in milliseconds) when the Team was created.',
          examples: [1630748523395],
          type: 'number',
        },
        id: {
          description: "The Team's unique identifier.",
          examples: ['team_nllPyCtREAqxxdyFKbbMDlxd'],
          type: 'string',
        },
        limited: {
          description:
            "Property indicating that this Team data contains only limited information, due to the authentication token missing privileges to read the full Team data. Re-login with the Team's configured SAML Single Sign-On provider in order to upgrade the authentication token with the necessary privileges.",
          type: 'boolean',
        },
        membership: {
          oneOf: [
            {
              description: 'The membership of the authenticated User in relation to the Team.',
              properties: {
                accessRequestedAt: {
                  type: 'number',
                },
                confirmed: {
                  type: 'boolean',
                },
                confirmedAt: {
                  type: 'number',
                },
                created: {
                  type: 'number',
                },
                createdAt: {
                  type: 'number',
                },
                joinedFrom: {
                  properties: {
                    commitId: {
                      type: 'string',
                    },
                    dsyncConnectedAt: {
                      type: 'number',
                    },
                    dsyncUserId: {
                      type: 'string',
                    },
                    gitUserId: {
                      oneOf: [
                        {
                          type: 'string',
                        },
                        {
                          type: 'number',
                        },
                      ],
                    },
                    gitUserLogin: {
                      type: 'string',
                    },
                    idpUserId: {
                      type: 'string',
                    },
                    origin: {
                      enum: [
                        'import',
                        'saml',
                        'mail',
                        'link',
                        'teams',
                        'github',
                        'gitlab',
                        'bitbucket',
                        'dsync',
                        'feedback',
                        'organization-teams',
                      ],
                      type: 'string',
                    },
                    repoId: {
                      type: 'string',
                    },
                    repoPath: {
                      type: 'string',
                    },
                    ssoConnectedAt: {
                      type: 'number',
                    },
                    ssoUserId: {
                      type: 'string',
                    },
                  },
                  required: ['origin'],
                  type: 'object',
                },
                role: {
                  enum: ['MEMBER', 'OWNER', 'VIEWER', 'DEVELOPER', 'BILLING'],
                  type: 'string',
                },
                teamId: {
                  type: 'string',
                },
                uid: {
                  type: 'string',
                },
              },
              required: ['confirmed', 'confirmedAt', 'role', 'uid', 'createdAt', 'created'],
              type: 'object',
            },
            {
              description: 'The membership of the authenticated User in relation to the Team.',
              properties: {
                accessRequestedAt: {
                  type: 'number',
                },
                confirmed: {
                  type: 'boolean',
                },
                confirmedAt: {
                  type: 'number',
                },
                created: {
                  type: 'number',
                },
                createdAt: {
                  type: 'number',
                },
                joinedFrom: {
                  properties: {
                    commitId: {
                      type: 'string',
                    },
                    dsyncConnectedAt: {
                      type: 'number',
                    },
                    dsyncUserId: {
                      type: 'string',
                    },
                    gitUserId: {
                      oneOf: [
                        {
                          type: 'string',
                        },
                        {
                          type: 'number',
                        },
                      ],
                    },
                    gitUserLogin: {
                      type: 'string',
                    },
                    idpUserId: {
                      type: 'string',
                    },
                    origin: {
                      enum: [
                        'import',
                        'saml',
                        'mail',
                        'link',
                        'teams',
                        'github',
                        'gitlab',
                        'bitbucket',
                        'dsync',
                        'feedback',
                        'organization-teams',
                      ],
                      type: 'string',
                    },
                    repoId: {
                      type: 'string',
                    },
                    repoPath: {
                      type: 'string',
                    },
                    ssoConnectedAt: {
                      type: 'number',
                    },
                    ssoUserId: {
                      type: 'string',
                    },
                  },
                  required: ['origin'],
                  type: 'object',
                },
                role: {
                  enum: ['MEMBER', 'OWNER', 'VIEWER', 'DEVELOPER', 'BILLING'],
                  type: 'string',
                },
                teamId: {
                  type: 'string',
                },
                uid: {
                  type: 'string',
                },
              },
              required: ['confirmed', 'accessRequestedAt', 'role', 'uid', 'createdAt', 'created'],
              type: 'object',
            },
          ],
        },
        name: {
          description: 'Name associated with the Team account, or `null` if none has been provided.',
          examples: ['My Team'],
          type: ['string', 'null'],
        },
        saml: {
          description:
            'When "Single Sign-On (SAML)" is configured, this object contains information that allows the client-side to identify whether or not this Team has SAML enforced.',
          properties: {
            connection: {
              description: 'From T, pick a set of properties whose keys are in the union K',
              properties: {
                createdAt: {
                  type: ['number', 'null'],
                },
                creator: {
                  type: 'string',
                },
                domain: {
                  type: 'string',
                },
                id: {
                  type: 'string',
                },
                name: {
                  type: 'string',
                },
                recordType: {
                  enum: ['A', 'AAAA', 'ALIAS', 'CAA', 'CNAME', 'MX', 'SRV', 'TXT', 'NS'],
                  type: 'string',
                },
                ttl: {
                  type: 'number',
                },
                type: {
                  enum: ['record', 'record-sys'],
                  type: 'string',
                },
                value: {
                  type: 'string',
                },
              },
              required: ['creator', 'domain', 'id', 'name', 'recordType', 'type', 'value'],
              type: 'object',
            },
            directory: {
              description: 'From T, pick a set of properties whose keys are in the union K',
              properties: {
                createdAt: {
                  type: ['number', 'null'],
                },
                creator: {
                  type: 'string',
                },
                domain: {
                  type: 'string',
                },
                id: {
                  type: 'string',
                },
                name: {
                  type: 'string',
                },
                recordType: {
                  enum: ['A', 'AAAA', 'ALIAS', 'CAA', 'CNAME', 'MX', 'SRV', 'TXT', 'NS'],
                  type: 'string',
                },
                ttl: {
                  type: 'number',
                },
                type: {
                  enum: ['record', 'record-sys'],
                  type: 'string',
                },
                value: {
                  type: 'string',
                },
              },
              required: ['creator', 'domain', 'id', 'name', 'recordType', 'type', 'value'],
              type: 'object',
            },
            enforced: {
              description:
                "When `true`, interactions with the Team **must** be done with an authentication token that has been authenticated with the Team's SAML Single Sign-On provider.",
              type: 'boolean',
            },
          },
          required: ['enforced'],
          type: 'object',
        },
        slug: {
          description: "The Team's slug, which is unique across the Vercel platform.",
          examples: ['my-team'],
          type: 'string',
        },
      },
      required: ['limited', 'id', 'slug', 'name', 'avatar', 'membership', 'created', 'createdAt'],
      type: 'object',
    },
    UserEvent: {
      description: 'Array of events generated by the User.',
      properties: {
        createdAt: {
          description: 'Timestamp (in milliseconds) of when the event was generated.',
          examples: [1632859321020],
          type: 'number',
        },
        entities: {
          description:
            'A list of "entities" within the event `text`. Useful for enhancing the displayed text with additional styling and links.',
          items: {
            description:
              'A list of "entities" within the event `text`. Useful for enhancing the displayed text with additional styling and links.',
            properties: {
              end: {
                description: 'The index of where the entity ends within the `text` (non-inclusive).',
                examples: [3],
                type: 'number',
              },
              start: {
                description: 'The index of where the entity begins within the `text` (inclusive).',
                examples: [0],
                type: 'number',
              },
              type: {
                description: 'The type of entity.',
                enum: [
                  'target',
                  'author',
                  'bitbucket_login',
                  'bold',
                  'deployment_host',
                  'dns_record',
                  'git_link',
                  'github_login',
                  'gitlab_login',
                  'hook_name',
                  'integration',
                  'edge-config',
                  'link',
                  'project_name',
                  'scaling_rules',
                  'env_var_name',
                  'system',
                ],
                examples: ['author'],
                type: 'string',
              },
            },
            required: ['type', 'start', 'end'],
            type: 'object',
          },
          type: 'array',
        },
        id: {
          description: 'The unique identifier of the Event.',
          examples: ['uev_bfmMjiMnXfnPbT97dGdpJbCN'],
          type: 'string',
        },
        text: {
          description: 'The human-readable text of the Event.',
          examples: ['You logged in via GitHub'],
          type: 'string',
        },
        user: {
          description: 'Metadata for the User who generated the event.',
          properties: {
            avatar: {
              type: 'string',
            },
            email: {
              type: 'string',
            },
            slug: {
              type: 'string',
            },
            uid: {
              type: 'string',
            },
            username: {
              type: 'string',
            },
          },
          required: ['avatar', 'email', 'uid', 'username'],
          type: 'object',
        },
        userId: {
          description: 'The unique identifier of the User who generated the event.',
          examples: ['zTuNVUXEAvvnNN3IaqinkyMw'],
          type: 'string',
        },
      },
      required: ['id', 'text', 'entities', 'createdAt', 'userId'],
      type: 'object',
    },
  },
  securitySchemes: {
    bearerToken: {
      description: 'Default authentication mechanism',
      scheme: 'bearer',
      type: 'http',
    },
    oauth2: {
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://api.vercel.com/oauth/authorize',
          scopes: {},
          tokenUrl: 'https://api.vercel.com/oauth/access_token',
        },
      },
      type: 'oauth2',
    },
  },
} as TComponents;
