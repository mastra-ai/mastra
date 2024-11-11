// @ts-nocheck
export type TPaths = {
  '/api/v1/company/announcement/{id}': {
    get: {
      description: 'Request full announcement data identified by announcement id';
      operationId: 'CompanyAnnouncement';
      parameters: [
        {
          description: 'announcement hex ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    countryCode: {
                      type: 'string';
                    };
                    id: {
                      type: 'string';
                    };
                    registrationNumber: {
                      type: 'string';
                    };
                    structured: {
                      type: 'string';
                    };
                    text: {
                      type: 'string';
                    };
                    time: {
                      format: 'date';
                      type: 'string';
                    };
                    type: {
                      type: 'string';
                    };
                  };
                };
                type: 'array';
              };
            };
          };
          description: 'List of announcements';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves announcement data';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/deepsearch/isin': {
    post: {
      description: 'Lookup stock exchange listings identified by an ISIN (International Securities Identification Number) number. Search is forwarded to a provider.';
      operationId: 'CompanyDeepsearchISIN';
      parameters: [];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                isin: {
                  description: 'A list of ISIN numbers seperated by comma (maximum) is 100';
                  type: 'string';
                };
              };
              type: 'object';
            };
          };
        };
        description: 'ISIN bulk deepsearch parameters';
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    isin: {
                      type: 'string';
                    };
                    listings: {
                      items: {
                        properties: {
                          additionalSecurityType: {
                            type: 'string';
                          };
                          exchCode: {
                            type: 'string';
                          };
                          identifier: {
                            type: 'string';
                          };
                          marketSector: {
                            type: 'string';
                          };
                          name: {
                            type: 'string';
                          };
                          securityDescription: {
                            type: 'string';
                          };
                          securityType: {
                            type: 'string';
                          };
                          shareClassId: {
                            type: 'string';
                          };
                          stockId: {
                            type: 'string';
                          };
                          symbol: {
                            type: 'string';
                          };
                        };
                      };
                      type: 'array';
                    };
                    validIsin: {
                      type: 'boolean';
                    };
                  };
                };
                type: 'array';
              };
            };
          };
          description: 'Result of a lookup by ISIN number';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves a list of stock exchange listings';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/deepsearch/lei/{number}': {
    get: {
      description: 'Lookup companies identified by a LEI (Legal Entity Identifier) number. Search is forwarded to a provider.';
      operationId: 'CompanyDeepsearchLEI';
      parameters: [
        {
          description: 'lei number';
          in: 'path';
          name: 'number';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'Pagination for the ISIN number results (1000 numbers per page)';
          example: 1;
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            format: 'int32';
            type: 'integer';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  company: {
                    properties: {
                      address: {
                        items: {
                          type: 'string';
                        };
                        type: 'array';
                      };
                      country: {
                        type: 'string';
                      };
                      dateOfIncorporation: {
                        type: 'string';
                      };
                      extraData: {
                        type: 'object';
                      };
                      formattedAddress: {
                        items: {
                          type: 'string';
                        };
                        type: 'array';
                      };
                      id: {
                        type: 'string';
                      };
                      legalForm: {
                        type: 'string';
                      };
                      managingDirectors: {
                        items: {
                          type: 'string';
                        };
                        type: 'array';
                      };
                      name: {
                        type: 'string';
                      };
                      registrationNumber: {
                        type: 'string';
                      };
                      requestTime: {
                        type: 'integer';
                      };
                      secretaries: {
                        items: {
                          type: 'string';
                        };
                        type: 'array';
                      };
                      sicNaceCodes: {
                        items: {
                          type: 'string';
                        };
                        type: 'array';
                      };
                      status: {
                        type: 'string';
                      };
                    };
                    required: ['country', 'id', 'name', 'registrationNumber'];
                  };
                  current_page: {
                    format: 'int32';
                    type: 'integer';
                  };
                  isins: {
                    items: {
                      type: 'string';
                    };
                    type: 'array';
                  };
                  last_page: {
                    format: 'int32';
                    type: 'integer';
                  };
                  lei: {
                    type: 'string';
                  };
                  next_page: {
                    type: 'string';
                  };
                  total_num_isins: {
                    format: 'int32';
                    type: 'integer';
                  };
                  validLei: {
                    type: 'boolean';
                  };
                };
              };
            };
          };
          description: 'Result of a lookup by LEI number';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves a list of companies';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/deepsearch/name/{country}/{name}': {
    get: {
      description: 'Search for companies with a certain name. Search is forwarded to the respective business register of the country.';
      operationId: 'CompanyDeepsearchName';
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars';
          in: 'path';
          name: 'country';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'company name';
          in: 'path';
          name: 'name';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1search~1name~1%7Bcountry%7D~1%7Bname%7D/get/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves a list of companies from the official business register';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/deepsearch/number/{country}/{number}': {
    get: {
      description: 'Search for companies with a certain register number. Search is forwarded to the respective business register of the country.';
      operationId: 'CompanyDeepsearchNumber';
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars';
          in: 'path';
          name: 'country';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'company registration number';
          in: 'path';
          name: 'number';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1search~1name~1%7Bcountry%7D~1%7Bname%7D/get/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves a list of companies from the official business register';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/monitoring/changeTypes': {
    get: {
      description: 'Get current list of available ChangeTypes to subscribe to';
      operationId: 'CompanyMonitorChangeTypesList';
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  type: 'string';
                };
                type: 'array';
              };
            };
          };
          description: 'List of ChangeTypes';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Get available ChangeTypes';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/monitoring/list': {
    get: {
      description: 'Query list of all registered monitors for logged in user';
      operationId: 'CompanyMonitorList';
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1notification~1list~1%7Bid%7D/get/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves a list of registered monitors';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/monitoring/list/{id}': {
    get: {
      description: 'Query status of registered monitors for a specific company identified by a company id';
      operationId: 'CompanyMonitorId';
      parameters: [
        {
          description: 'Company Hex ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1notification~1list~1%7Bid%7D/get/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Get monitor status for specific company id';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/monitoring/register/{id}': {
    post: {
      description: 'Add a company to your perpetual monitoring list and register a callback URL to get monitoring alerts.';
      operationId: 'CompanyMonitorRegister';
      parameters: [
        {
          description: 'Company Hex ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                callbackUrl: {
                  description: 'Callback URL';
                  type: 'string';
                };
                changeType: {
                  description: 'ChangeType to monitor';
                  type: 'string';
                };
              };
              required: ['callbackUrl', 'changeType'];
              type: 'object';
            };
          };
        };
        description: 'Callback URL where the notifications will be sent to';
      };
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1notification~1register~1%7Bid%7D/post/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Register a Company for monitoring';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/monitoring/unregister/{id}': {
    post: {
      description: 'Deactivate a previously registered company monitor identified by the notifier id';
      operationId: 'CompanyMonitorUnregister';
      parameters: [
        {
          description: 'Registration id of monitoring request record';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          description: 'Empty response body';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Deactivates an active notification';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/notification/list': {
    get: {
      description: 'Query list of registered callback URLs for logged in user';
      operationId: 'CompanyNotificationList';
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1notification~1list~1%7Bid%7D/get/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves a list of registered notifications';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/notification/list/{id}': {
    get: {
      description: 'Query list of registered notifications for a specific company identified by a company id';
      operationId: 'CompanyNotificationId';
      parameters: [
        {
          description: 'Company Hex ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    callbackCount: {
                      format: 'int32';
                      type: 'integer';
                    };
                    callbackUrl: {
                      type: 'string';
                    };
                    created: {
                      $ref: '#/paths/~1api~1v1~1company~1announcement~1%7Bid%7D/get/responses/200/content/application~1json/schema/items/properties/time';
                    };
                    monitorStatus: {
                      type: 'string';
                    };
                    notificationId: {
                      type: 'string';
                    };
                    subjectId: {
                      type: 'string';
                    };
                  };
                };
                type: 'array';
              };
            };
          };
          description: 'List of monitor webhooks';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves a list of registered notifications';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/notification/register/{id}': {
    post: {
      description: 'Register a new callback URL to get notifications about companies.';
      operationId: 'CompanyNotificationRegister';
      parameters: [
        {
          description: 'Company Hex ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                callbackUrl: {
                  description: 'Callback URL';
                  type: 'string';
                };
              };
              required: ['callbackUrl'];
              type: 'object';
            };
          };
        };
        description: 'Callback URL where the notifications will be sent to';
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  monitorStatus: {
                    type: 'string';
                  };
                  notificationId: {
                    type: 'string';
                  };
                };
                required: ['notificationId', 'monitorStatus'];
              };
            };
          };
          description: 'Successful webhook registration response';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Creates a new notification';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/notification/unregister/{id}': {
    post: {
      description: 'Deactivate a previously registered company monitor identified by the notifier id';
      operationId: 'CompanyNotificationUnregister';
      parameters: [
        {
          description: 'Registration id of monitoring request record';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          description: 'Empty response body';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Unregister a company from Monitoring';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/search/name/{country}/{name}': {
    get: {
      description: 'KYC API company index lookup for companies with a certain name in a country.';
      operationId: 'CompanySearchName';
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars';
          in: 'path';
          name: 'country';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'company name';
          in: 'path';
          name: 'name';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'number of search results';
          in: 'query';
          name: 'limit';
          required: false;
          schema: {
            format: 'int64';
            type: 'integer';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    address: {
                      items: {
                        type: 'string';
                      };
                      type: 'array';
                    };
                    country: {
                      type: 'string';
                    };
                    dateOfIncorporation: {
                      type: 'string';
                    };
                    extraData: {
                      type: 'object';
                    };
                    formattedAddress: {
                      items: {
                        type: 'string';
                      };
                      type: 'array';
                    };
                    id: {
                      type: 'string';
                    };
                    legalForm: {
                      type: 'string';
                    };
                    managingDirectors: {
                      items: {
                        type: 'string';
                      };
                      type: 'array';
                    };
                    name: {
                      type: 'string';
                    };
                    registrationNumber: {
                      type: 'string';
                    };
                    requestTime: {
                      type: 'integer';
                    };
                    secretaries: {
                      items: {
                        type: 'string';
                      };
                      type: 'array';
                    };
                    sicNaceCodes: {
                      items: {
                        type: 'string';
                      };
                      type: 'array';
                    };
                    status: {
                      type: 'string';
                    };
                  };
                };
                type: 'array';
              };
            };
          };
          description: 'List of companies';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves a list of companies from the KYC API company index';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/search/number/{country}/{number}': {
    get: {
      description: 'KYC API company index lookup for companies with a certain register number in a country.';
      operationId: 'CompanySearchNumber';
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars';
          in: 'path';
          name: 'country';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'company registration number';
          in: 'path';
          name: 'number';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'number of search results';
          in: 'query';
          name: 'limit';
          required: false;
          schema: {
            format: 'int64';
            type: 'integer';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1search~1name~1%7Bcountry%7D~1%7Bname%7D/get/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves a list of companies from the KYC API company index';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/search/{country}': {
    post: {
      description: 'KYC API company index lookup by country and mixed parameters. This function requires a country code then a mixture of name';
      operationId: 'CompanyAlternativeSearch';
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars';
          in: 'path';
          name: 'country';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                address: {
                  description: 'Company address (or address partial)';
                  type: 'string';
                };
                name: {
                  description: 'Company name';
                  type: 'string';
                };
                number: {
                  description: 'Company registration number';
                  type: 'string';
                };
                phone: {
                  description: 'Company contact phone number';
                  type: 'string';
                };
                url: {
                  description: 'Company url';
                  type: 'string';
                };
                vat: {
                  description: 'Company VAT number';
                  type: 'string';
                };
              };
              type: 'object';
            };
          };
        };
        description: 'VAT number and the company details';
      };
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1search~1name~1%7Bcountry%7D~1%7Bname%7D/get/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves a list of companies from the KYC API company index';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/{id}/announcements': {
    get: {
      description: 'Search announcements filed to the business register from a company identified by an id';
      operationId: 'CompanyIdAnnouncements';
      parameters: [
        {
          description: 'company hex ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'limit of announcements in response (default 10)';
          in: 'query';
          name: 'limit';
          required: false;
          schema: {
            format: 'int32';
            type: 'integer';
          };
        },
        {
          description: 'to paginate through results (default 0)';
          in: 'query';
          name: 'offset';
          required: false;
          schema: {
            format: 'int32';
            type: 'integer';
          };
        },
        {
          description: 'If this parameter is set to false, you will only receive ids, and no additional data about announcements and no hits to the metric will be counted. (and potentially minimizing your costs)';
          in: 'query';
          name: 'data';
          required: false;
          schema: {
            format: '';
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1announcement~1%7Bid%7D/get/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves company announcements';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/{id}/super/{country}': {
    get: {
      description: 'Request company superdata identified by company id';
      operationId: 'CompanyIdSuper';
      parameters: [
        {
          description: 'company superdata by id';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars';
          in: 'path';
          name: 'country';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'Optional data translation (only available in limited jurisdictions)';
          in: 'query';
          name: 'lang';
          required: false;
          schema: {
            enum: ['', 'OG', 'EN'];
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1search~1name~1%7Bcountry%7D~1%7Bname%7D/get/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves structured data extracted from a company document';
      tags: ['v1-company'];
    };
  };
  '/api/v1/company/{id}/{dataset}': {
    get: {
      description: 'Get company details by id. The level of details is defined by the dataset parameter';
      operationId: 'CompanyIdDataset';
      parameters: [
        {
          description: 'company master data by id';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'Try to retrieve additional stock information for this company. (Only available on refresh)';
          in: 'query';
          name: 'check_stock_listing';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'company master data by id';
          in: 'path';
          name: 'dataset';
          required: true;
          schema: {
            enum: ['', 'mini', 'master', 'full', 'refresh'];
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'Optional data translation (only available in limited jurisdictions)';
          in: 'query';
          name: 'lang';
          required: false;
          schema: {
            enum: ['', 'EN', 'ES', 'FR'];
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/paths/~1api~1v1~1company~1deepsearch~1lei~1%7Bnumber%7D/get/responses/200/content/application~1json/schema/properties/company';
              };
            };
          };
          description: '';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves company details';
      tags: ['v1-company'];
    };
  };
  '/api/v1/ein-verification/basic-check': {
    get: {
      description: 'Performs a basic verification check of a given EIN tax number.';
      operationId: 'EinVerificationBasic';
      parameters: [
        {
          description: 'Nine letter EIN number with or without hyphens';
          in: 'query';
          name: 'ein';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  confidence_score: {
                    type: 'string';
                  };
                  confidence_score_explanation: {
                    type: 'string';
                  };
                  dba_score: {
                    type: 'string';
                  };
                  dba_score_explanation: {
                    type: 'string';
                  };
                  ein: {
                    type: 'string';
                  };
                  irs_score: {
                    type: 'string';
                  };
                  irs_score_explanation: {
                    type: 'string';
                  };
                  timestamp: {
                    type: 'number';
                  };
                  validationStatus: {
                    type: 'boolean';
                  };
                };
                required: [
                  'ein',
                  'validationStatus',
                  'irs_score',
                  'irs_score_explanation',
                  'dba_score',
                  'dba_score_explanation',
                  'confidence_score',
                  'confidence_score_explanation',
                  'timestamp',
                ];
              };
            };
          };
          description: 'Result of a basic EIN number verification';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Verifies an EIN number';
      tags: ['v1-ein-verification'];
    };
  };
  '/api/v1/ein-verification/comprehensive-check': {
    get: {
      description: 'Comprehensive verification of a given EIN number. Additionally to the basic verification it will lookup company details';
      operationId: 'EinVerificationComprehensive';
      parameters: [
        {
          description: 'Nine letter EIN number with or without hyphens';
          in: 'query';
          name: 'ein';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  ein: {
                    type: 'string';
                  };
                  matched_ein_companies: {
                    $ref: '#/paths/~1api~1v1~1ein-verification~1lookup/get/responses/200/content/application~1json/schema/properties/matched_ein_companies';
                  };
                  timestamp: {
                    type: 'number';
                  };
                  validationStatus: {
                    type: 'boolean';
                  };
                };
                required: ['ein', 'validationStatus', 'matched_ein_companies', 'timestamp'];
              };
            };
          };
          description: 'Result of a comprehensive EIN number verification';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Verifies EIN number and retrieves company data';
      tags: ['v1-ein-verification'];
    };
  };
  '/api/v1/ein-verification/lookup': {
    get: {
      description: 'Lookup EIN number for a company by its company name';
      operationId: 'EinVerificationLookup';
      parameters: [
        {
          description: 'Business name of the company';
          in: 'query';
          name: 'name';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'Optional state parameter to improve results. (Two letter code for example CA or US-CA for California)';
          in: 'query';
          name: 'state';
          required: false;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'Optional zip code parameter to improve results. (Zip is preferred over state)';
          in: 'query';
          name: 'zip';
          required: false;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'Optional parameter to do tight matching. (Only the best match will be returned rather then the top 5)';
          in: 'query';
          name: 'tight';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  matched_ein_companies: {
                    items: {
                      properties: {
                        address: {
                          items: {
                            type: 'string';
                          };
                          type: 'array';
                        };
                        company_score: {
                          type: 'number';
                        };
                        company_score_explanation: {
                          type: 'string';
                        };
                        confidence_score: {
                          type: 'number';
                        };
                        confidence_score_explanation: {
                          type: 'string';
                        };
                        dba_score: {
                          type: 'string';
                        };
                        dba_score_explanation: {
                          type: 'string';
                        };
                        ein: {
                          type: 'string';
                        };
                        formattedAddress: {
                          items: {
                            type: 'string';
                          };
                          type: 'array';
                        };
                        irs_score: {
                          type: 'string';
                        };
                        irs_score_explanation: {
                          type: 'string';
                        };
                        name: {
                          type: 'string';
                        };
                        provided_status: {
                          type: 'string';
                        };
                        provided_status_explanation: {
                          type: 'string';
                        };
                      };
                    };
                    type: 'array';
                  };
                  searchterm_name: {
                    type: 'string';
                  };
                  searchterm_state: {
                    type: 'string';
                  };
                  searchterm_zip: {
                    type: 'string';
                  };
                  tight_search: {
                    type: 'boolean';
                  };
                  timestamp: {
                    type: 'number';
                  };
                };
                required: ['searchterm_name', 'searchterm_state', 'searchterm_zip', 'tight_search', 'timestamp'];
              };
            };
          };
          description: 'Result of a EIN reverse lookup';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves a list of EIN numbers';
      tags: ['v1-ein-verification'];
    };
  };
  '/api/v1/iban-verification/check-iban': {
    post: {
      description: 'Basic verification of an IBAN number validating its structure';
      operationId: 'IbanBasic';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                ibanNumber: {
                  description: 'IBAN number to validate';
                  example: 'AT483200000012345864';
                  type: 'string';
                };
              };
              required: ['ibanNumber'];
              type: 'object';
            };
          };
        };
        description: 'IBAN number';
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  valid: {
                    type: 'boolean';
                  };
                };
                required: ['valid'];
              };
            };
          };
          description: 'Denotes validity of checked IBAN';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Checks validity of an IBAN number';
      tags: ['v1-iban-verification'];
    };
  };
  '/api/v1/iban-verification/comprehensive-check-iban': {
    post: {
      description: 'Comprehensive verification of IBAN number using a service provider for verification';
      operationId: 'IbanComprehensive';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                ibanNumber: {
                  description: 'IBAN number to validate';
                  example: 'AT483200000012345864';
                  type: 'string';
                };
              };
              required: ['ibanNumber'];
              type: 'object';
            };
          };
        };
        description: 'IBAN number';
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/paths/~1api~1v1~1iban-verification~1check-iban/post/responses/200/content/application~1json/schema';
              };
            };
          };
          description: 'Denotes validity of checked IBAN and provides comprehensive information';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Checks validity of an IBAN number';
      tags: ['v1-iban-verification'];
    };
  };
  '/api/v1/nif-verification/basic-check/{country}': {
    post: {
      description: 'Performs a basic verification check of a given NIF tax number against NIF.com. Optional parameters may be added to improve calculation of confidence score.';
      operationId: 'NifBasic';
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars';
          in: 'path';
          name: 'country';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                companyAddress: {
                  description: 'company address lines';
                  type: 'string';
                };
                companyName: {
                  description: 'Company name';
                  type: 'string';
                };
                nifNumber: {
                  description: 'NIF number to validate';
                  type: 'string';
                };
              };
              required: ['nifNumber'];
              type: 'object';
            };
          };
        };
        description: 'Company details';
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  companyName: {
                    type: 'string';
                  };
                  confidenceScore: {
                    type: 'number';
                  };
                  nifNumber: {
                    type: 'number';
                  };
                  validationStatus: {
                    type: 'boolean';
                  };
                };
                required: ['nifNumber', 'confidenceScore', 'validationStatus'];
              };
            };
          };
          description: 'Result of a basic NIF verification';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Verifies a NIF number';
      tags: ['v1-nif-verification'];
    };
  };
  '/api/v1/nif-verification/comprehensive-check/{country}': {
    post: {
      description: 'Comprehensive verification of given portuguese NIF number against NIF.com. Optional parameters may help to build a better confidence score. Additional company data will be provided.';
      operationId: 'NifComprehensive';
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars';
          in: 'path';
          name: 'country';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                companyAddress: {
                  description: 'company address lines';
                  type: 'string';
                };
                companyName: {
                  description: 'Company name';
                  type: 'string';
                };
                nifNumber: {
                  description: 'NIF number to validate';
                  type: 'string';
                };
              };
              required: ['nifNumber'];
              type: 'object';
            };
          };
        };
        description: 'Company details';
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  activity: {
                    type: 'object';
                  };
                  address: {
                    type: 'string';
                  };
                  capital: {
                    type: 'number';
                  };
                  companyName: {
                    type: 'string';
                  };
                  confidenceScore: {
                    type: 'number';
                  };
                  currency: {
                    type: 'string';
                  };
                  email: {
                    type: 'string';
                  };
                  fax: {
                    type: 'string';
                  };
                  geo: {
                    type: 'string';
                  };
                  legalType: {
                    type: 'string';
                  };
                  nifNumber: {
                    type: 'number';
                  };
                  phone: {
                    type: 'string';
                  };
                  status: {
                    type: 'object';
                  };
                  validationStatus: {
                    type: 'boolean';
                  };
                  website: {
                    type: 'string';
                  };
                };
                required: ['nifNumber', 'confidenceScore', 'validationStatus'];
              };
            };
          };
          description: 'Result of a comprehensive NIF verification';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Verifies a NIF number and retrieves company data';
      tags: ['v1-nif-verification'];
    };
  };
  '/api/v1/pepsanction/monitor/list': {
    get: {
      description: 'Retrieve a list of all active Pep Sanction Report monitors for this account';
      operationId: 'PepMonitorList';
      parameters: [];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    active: {
                      type: 'boolean';
                    };
                    caseId: {
                      type: 'string';
                    };
                    created: {
                      $ref: '#/paths/~1api~1v1~1company~1announcement~1%7Bid%7D/get/responses/200/content/application~1json/schema/items/properties/time';
                    };
                    identifier: {
                      type: 'string';
                    };
                    structured: {
                      type: 'string';
                    };
                    updated: {
                      type: 'string';
                    };
                    webhook: {
                      type: 'string';
                    };
                  };
                };
                type: 'array';
              };
            };
          };
          description: 'View Pep Sanction Report monitors';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves a list of monitor entries';
      tags: ['v1-pepsanction'];
    };
  };
  '/api/v1/pepsanction/monitor/unregister/{id}': {
    post: {
      description: 'Unregister a previously created Pep Sanction Report Monitor';
      operationId: 'PepMonitorUnregister';
      parameters: [
        {
          description: 'The identifier of the Monitor';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1pepsanction~1monitor~1update~1%7Bid%7D/post/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Deactive a pep sanction monitor';
      tags: ['v1-pepsanction'];
    };
  };
  '/api/v1/pepsanction/monitor/update/{id}': {
    post: {
      description: 'Update the webhook URL of an active Pep Sanction Report Monitor';
      operationId: 'PepMonitorUpdate';
      parameters: [
        {
          description: 'The identifier of the Monitor';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                Webhook: {
                  description: 'If Monitoring is enabled this parameter is required. This is where updates will be sent to';
                  example: 'null';
                  type: 'string';
                };
              };
              type: 'object';
            };
          };
        };
        description: 'Pass new Webhook as post parameter';
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  active: {
                    type: 'boolean';
                  };
                  caseId: {
                    type: 'string';
                  };
                  created: {
                    $ref: '#/paths/~1api~1v1~1company~1announcement~1%7Bid%7D/get/responses/200/content/application~1json/schema/items/properties/time';
                  };
                  identifier: {
                    type: 'string';
                  };
                  structured: {
                    type: 'string';
                  };
                  updated: {
                    type: 'string';
                  };
                  webhook: {
                    type: 'string';
                  };
                };
              };
            };
          };
          description: 'View a monitor for a Pep Sanction Report';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Update details of active Pep Sanction monitor';
      tags: ['v1-pepsanction'];
    };
  };
  '/api/v1/pepsanction/order/{type}/{search}': {
    post: {
      description: 'Order a new Pep Sanction Check by providing either a business or person name with some additional optional parameters.';
      operationId: 'PepOrder';
      parameters: [
        {
          description: 'Type (Business or Person) of the requested Pep Sanction Check';
          in: 'path';
          name: 'type';
          required: true;
          schema: {
            enum: ['', 'B', 'P'];
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'Search string for the Pep Sanction Check';
          in: 'path';
          name: 'search';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                Aliases: {
                  description: 'Optional parameter for declaring alias names when doing a person search (seperated by commas)';
                  example: 'null';
                  type: 'string';
                };
                Country: {
                  description: 'Optional name of Country to assist in identifying matches based upon location/geography.';
                  example: 'null';
                  type: 'string';
                };
                DOB: {
                  description: 'Optional parameter for date of birth name when doing a person search';
                  example: 'null';
                  type: 'string';
                };
                FamilyName: {
                  description: 'Optional parameter for last name when doing a person search';
                  example: 'null';
                  type: 'string';
                };
                Filters: {
                  description: 'Optional parameter for restricting search when doing a person search (seperated by commas)';
                  example: 'null';
                  type: 'string';
                };
                GivenName: {
                  description: 'Optional parameter for first name when doing a person search';
                  example: 'null';
                  type: 'string';
                };
                LEI: {
                  description: 'Optional Legal Entity Identifier for additional business identifier verification.';
                  example: 'null';
                  type: 'string';
                };
                Locale: {
                  description: 'Optional name of City or Locale to assist in identifying matches based upon location/geography.';
                  example: 'null';
                  type: 'string';
                };
                Medialists: {
                  description: 'Optional parameter for selecting only specific media lists. By default all lists are queried';
                  example: 'NMEDIA';
                  type: 'string';
                };
                MiddleName: {
                  description: 'Optional parameter for middle name when doing a person search';
                  example: 'null';
                  type: 'string';
                };
                Monitoring: {
                  description: 'If this Pep Sanction Check should be continuesly monitored.';
                  example: false;
                  type: 'boolean';
                };
                Peplists: {
                  description: 'Optional parameter for selecting only specific pep lists. By default all lists are queried';
                  example: 'GOV,PEPD,SOE';
                  type: 'string';
                };
                Region: {
                  description: 'Optional name of Region or State to assist in identifying matches based upon location/geography.';
                  example: 'null';
                  type: 'string';
                };
                SmartMatch: {
                  description: 'Optional parameter for enabling SmartMatch to retrieve more results';
                  example: false;
                  type: 'boolean';
                };
                Watchlists: {
                  description: 'Optional parameter for selecting only specific watch lists. By default all lists are queried';
                  example: 'SANCTIONS,FINANCE,TERRORISM,CRIME,SMAGOV,OFAC,MEDICAL';
                  type: 'string';
                };
                Webhook: {
                  description: 'If Monitoring is enabled this parameter is required. This is where updates will be sent to';
                  example: 'null';
                  type: 'string';
                };
              };
              type: 'object';
            };
          };
        };
        description: 'Optional parameters to enhance search';
      };
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1product~1availability~1%7Bsku%7D~1%7BsubjectId%7D/get/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Orders a new Pep Sanction Check Report';
      tags: ['v1-pepsanction'];
    };
  };
  '/api/v1/pepsanction/retrieve/{id}': {
    get: {
      description: 'Retrieve a completed Pep Sanction check structured or in pdf depending on given accept header';
      operationId: 'PepRetrieve';
      parameters: [
        {
          description: 'The type (pdf or json) in which the check should be returned';
          in: 'header';
          name: 'accept';
          required: false;
          schema: {
            default: 'application/json';
            enum: ['application/json', 'application/pdf'];
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'The id of the ordered Pep Sanction Check (id as returned by orderPepSanction call)';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  listsChecked: {
                    type: 'string';
                  };
                  results: {
                    properties: {
                      Excerpts: {
                        type: 'string';
                      };
                      ResultsURL: {
                        type: 'string';
                      };
                      SearchType: {
                        type: 'string';
                      };
                      SourceAgency: {
                        type: 'string';
                      };
                      SourceEntity: {
                        type: 'string';
                      };
                      SourceID: {
                        format: 'int64';
                        type: 'integer';
                      };
                      SourceName: {
                        type: 'string';
                      };
                      SourceType: {
                        type: 'string';
                      };
                    };
                  };
                  search: {
                    type: 'string';
                  };
                  status: {
                    type: 'string';
                  };
                  timestamp: {
                    $ref: '#/paths/~1api~1v1~1company~1announcement~1%7Bid%7D/get/responses/200/content/application~1json/schema/items/properties/time';
                  };
                  type: {
                    type: 'string';
                  };
                };
                required: ['listsChecked', 'search', 'status', 'timestamp', 'type'];
              };
            };
          };
          description: 'Result of a PEP and sanctions list check';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Returns a json or pdf report';
      tags: ['v1-pepsanction'];
    };
  };
  '/api/v1/product/availability/{sku}/{subjectId}': {
    get: {
      description: 'Check availability and valid options for a particular product for a particular company identfied by its id';
      operationId: 'ProductAvailability';
      parameters: [
        {
          description: 'SKU - 9 character value from a Product object';
          in: 'path';
          name: 'sku';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'Subject (e.g. Company) ID - 32 character hex value';
          in: 'path';
          name: 'subjectId';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  availability: {
                    type: 'string';
                  };
                  category: {
                    type: 'string';
                  };
                  countryCode: {
                    type: 'string';
                  };
                  description: {
                    type: 'string';
                  };
                  hasOptions: {
                    type: 'boolean';
                  };
                  options: {
                    items: {
                      type: 'string';
                    };
                    type: 'array';
                  };
                  price: {
                    format: 'float';
                    type: 'number';
                  };
                  provider: {
                    type: 'string';
                  };
                  sku: {
                    type: 'string';
                  };
                  type: {
                    type: 'string';
                  };
                };
                required: [
                  'availability',
                  'category',
                  'countryCode',
                  'description',
                  'hasOptions',
                  'options',
                  'price',
                  'provider',
                  'sku',
                  'type',
                ];
              };
            };
          };
          description: 'Product details';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves a document availability result';
      tags: ['v1-product'];
    };
  };
  '/api/v1/product/catalog/{country}': {
    get: {
      description: 'Returns a catalog of purchasable products available with some metadata for a particular country';
      operationId: 'ProductCatalog';
      parameters: [
        {
          description: 'two letter country code in upper case';
          in: 'path';
          name: 'country';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  countryCode: {
                    type: 'string';
                  };
                  description: {
                    type: 'string';
                  };
                  form: {
                    type: 'string';
                  };
                  method: {
                    type: 'string';
                  };
                  name: {
                    type: 'string';
                  };
                  price: {
                    format: 'float';
                    type: 'number';
                  };
                  sku: {
                    type: 'string';
                  };
                  url: {
                    type: 'string';
                  };
                };
                required: ['url'];
              };
            };
          };
          description: 'Product with details like URI to purchase it';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Returns a catalog of products';
      tags: ['v1-product'];
    };
  };
  '/api/v1/product/notifier/{notifierId}': {
    get: {
      description: 'Queries and returns all metadata associated with a notifier identified by its notifer id';
      operationId: 'ProductNotifier';
      parameters: [
        {
          description: 'ID of the ProductOrderNotifier as returned from a /notifier POST call - 32 character hex value';
          in: 'path';
          name: 'notifierId';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1product~1notifier~1%7BorderId%7D~1%7Btype%7D~1%7Buri%7D/post/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Returns metadata for a notifier';
      tags: ['v1-product'];
    };
  };
  '/api/v1/product/notifier/{orderId}/{type}/{uri}': {
    post: {
      description: 'Create a notifier for a particular order. Parameters can be supplied in the path';
      operationId: 'ProductNotifierCreate';
      parameters: [
        {
          description: 'ID of the ProductOrder as returned from a /product/buy call - 32 character hex value';
          in: 'path';
          name: 'orderId';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'Type of the notifier - indicates the action the notifier will perform. Currently GET and POST are supported which performs an http(s) GET/POST to the supplied uri with appended notifierId= and orderId= parameters when the order processing is completed. Upon the POST request the order object is sent as a JSON body';
          in: 'path';
          name: 'type';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: "URI of the notifier for the 'complete' action. Currently only a GET method HTTP(s) URL is supported. 1 to 250 characters long. Every slash in the URI must be replaced by a ~";
          in: 'path';
          name: 'uri';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  callback: {
                    type: 'string';
                  };
                  identity: {
                    type: 'string';
                  };
                  lastCallTime: {
                    $ref: '#/paths/~1api~1v1~1company~1announcement~1%7Bid%7D/get/responses/200/content/application~1json/schema/items/properties/time';
                  };
                  lastResponseCode: {
                    type: 'integer';
                  };
                  notifierType: {
                    type: 'string';
                  };
                  productOrderIdentity: {
                    type: 'string';
                  };
                };
                required: ['callback', 'lastCallTime', 'lastResponseCode', 'notifierType', 'productOrderIdentity'];
              };
            };
          };
          description: 'Details of configured product order notification';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Creates a notifier for an order';
      tags: ['v1-product'];
    };
  };
  '/api/v1/product/order/concierge': {
    post: {
      description: 'Place an order for a concierge product';
      operationId: 'ProductOrderConcierge';
      parameters: [];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                companyName: {
                  description: 'Name of the company for which a document should be ordered. (Not required if subjectId is given)';
                  example: 'null';
                  type: 'string';
                };
                contactEmail: {
                  description: 'Contact E-Mail, will be contacted if concierge costs are exceeding the threshhold configured on your plan';
                  example: 'null';
                  type: 'string';
                };
                contactPhone: {
                  description: 'Contact phone, will be contacted if concierge costs are exceeding the threshhold configured on your plan';
                  example: 'null';
                  type: 'string';
                };
                costConfirmation: {
                  description: 'If the concierge cost should require additional confirmation if a threshold is reached (configured on your plan)';
                  example: false;
                  type: 'boolean';
                };
                country: {
                  description: 'Two letter ISO code of the country of the company';
                  example: 'null';
                  type: 'string';
                };
                financialData: {
                  description: 'If you want financial data of the company to be retrieved';
                  example: false;
                  type: 'boolean';
                };
                historicInformation: {
                  description: 'If you want historical data of the company to be retrieved';
                  example: false;
                  type: 'boolean';
                };
                informationRequirements: {
                  description: 'Requirements on what document or information should be provided. Please be very precise';
                  example: 'null';
                  type: 'string';
                };
                locationInvestigation: {
                  description: 'If the companies residency should be investigated';
                  example: false;
                  type: 'boolean';
                };
                priority: {
                  description: 'Priority of order: standard/express are allowed';
                  example: 'standard';
                  type: 'string';
                };
                registerData: {
                  description: 'If you want register data of the company to be retrieved';
                  example: false;
                  type: 'boolean';
                };
                registerNumber: {
                  description: 'Registration number of the company for which a document should be ordered. (Not required if subjectId is given)';
                  example: 'null';
                  type: 'string';
                };
                subjectId: {
                  description: 'Kompanyid of the company you want to place the order for';
                  example: 'null';
                  type: 'string';
                };
              };
              type: 'object';
            };
          };
        };
        description: 'Parameters for the concierge order';
      };
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1product~1order~1%7Bsku%7D~1%7BsubjectId%7D/post/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Places a concierge order';
      tags: ['v1-product'];
    };
  };
  '/api/v1/product/order/ubo': {
    post: {
      description: 'Place an order for a UBO (ultimate beneficial owner) discovery report';
      operationId: 'ProductOrderUbo';
      parameters: [];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                callbackUrl: {
                  description: 'An optional callback URL to which updates about the order will be sent (for instance if credits are exceeded)';
                  example: 'null';
                  type: 'string';
                };
                credits: {
                  description: 'Specify a maximum amount of credits which should be used. To disable use -1';
                  example: -1;
                  type: 'number';
                };
                includeDocs: {
                  description: 'Include purchase of register document to ubo report';
                  example: false;
                  type: 'boolean';
                };
                levels: {
                  description: 'Define a threshold for different levels of crawling';
                  example: '25,50';
                  type: 'string';
                };
                strategy: {
                  description: 'Choose a matching strategy. Available options (FULL,LEVELS)';
                  example: 'FULL';
                  type: 'string';
                };
                subjectId: {
                  description: 'KYC API Id (32 byte hexid) of the company you want to place the order for';
                  example: 'null';
                  type: 'string';
                };
              };
              required: ['subjectId'];
              type: 'object';
            };
          };
        };
        description: 'Parameters for the UBO order';
      };
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1product~1order~1%7Bsku%7D~1%7BsubjectId%7D/post/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Places a UBO order';
      tags: ['v1-product'];
    };
  };
  '/api/v1/product/order/{sku}/{option}/{subjectId}': {
    post: {
      description: 'Place an order for a particular product identified by its SKU with a particular option for a particular company identified by its id';
      operationId: 'ProductOrderWithOption';
      parameters: [
        {
          description: 'SKU - 9 character value from a Product object';
          in: 'path';
          name: 'sku';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'Product option (e.g. Accounts year) from a previous Availability call';
          in: 'path';
          name: 'option';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'Subject (e.g. Company) ID - 32 character hex value';
          in: 'path';
          name: 'subjectId';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1product~1order~1%7Bsku%7D~1%7BsubjectId%7D/post/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Places a product order';
      tags: ['v1-product'];
    };
  };
  '/api/v1/product/order/{sku}/{subjectId}': {
    post: {
      description: 'Place an order for a particular product identified by its SKU for a particular company identified by its id';
      operationId: 'ProductOrder';
      parameters: [
        {
          description: 'SKU - 9 character value from a Product object';
          in: 'path';
          name: 'sku';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'Subject (e.g. Company) ID - 32 character hex value';
          in: 'path';
          name: 'subjectId';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  identity: {
                    type: 'string';
                  };
                  option: {
                    type: 'string';
                  };
                  ordered: {
                    $ref: '#/paths/~1api~1v1~1company~1announcement~1%7Bid%7D/get/responses/200/content/application~1json/schema/items/properties/time';
                  };
                  owner: {
                    type: 'string';
                  };
                  price: {
                    format: 'float';
                    type: 'number';
                  };
                  sku: {
                    type: 'string';
                  };
                  status: {
                    type: 'string';
                  };
                  subjectId: {
                    type: 'string';
                  };
                  subjectValue: {
                    type: 'string';
                  };
                };
                required: [
                  'identity',
                  'option',
                  'ordered',
                  'owner',
                  'price',
                  'sku',
                  'status',
                  'subjectId',
                  'subjectValue',
                ];
              };
            };
          };
          description: 'Product order details';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Places a product order';
      tags: ['v1-product'];
    };
  };
  '/api/v1/product/search/{subjectId}': {
    get: {
      description: 'Search for possible products for a particular company identified by its id';
      operationId: 'ProductSearch';
      parameters: [
        {
          description: 'Subject (e.g. Company) ID - 32 character hex value';
          in: 'path';
          name: 'subjectId';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    availability: {
                      type: 'string';
                    };
                    category: {
                      type: 'string';
                    };
                    countryCode: {
                      type: 'string';
                    };
                    description: {
                      type: 'string';
                    };
                    hasOptions: {
                      type: 'boolean';
                    };
                    options: {
                      items: {
                        type: 'string';
                      };
                      type: 'array';
                    };
                    price: {
                      format: 'float';
                      type: 'number';
                    };
                    provider: {
                      type: 'string';
                    };
                    sku: {
                      type: 'string';
                    };
                    type: {
                      type: 'string';
                    };
                  };
                };
                type: 'array';
              };
            };
          };
          description: 'List of products';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Returns a list of products';
      tags: ['v1-product'];
    };
  };
  '/api/v1/product/status/{orderId}': {
    get: {
      description: 'Retrieve the current status of an order identified by its order id';
      operationId: 'ProductStatus';
      parameters: [
        {
          description: 'ID of the ProductOrder as returned from a /product/buy call - 32 character hex value';
          in: 'path';
          name: 'orderId';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1product~1order~1%7Bsku%7D~1%7BsubjectId%7D/post/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Returns metadata for a order';
      tags: ['v1-product'];
    };
  };
  '/api/v1/product/update/{action}/{orderId}': {
    post: {
      description: 'Update an existing order identified by its order id';
      operationId: 'ProductUpdateAction';
      parameters: [
        {
          description: 'The action you want to perform for the order';
          in: 'path';
          name: 'action';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'ID of the ProductOrder as returned from a /product/buy call - 32 character hex value';
          in: 'path';
          name: 'orderId';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                credits: {
                  description: 'Specify an amount of credits which should be added to the order';
                  example: 100;
                  type: 'number';
                };
              };
              type: 'object';
            };
          };
        };
        description: 'Parameters for the update order endpoint';
      };
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1product~1order~1%7Bsku%7D~1%7BsubjectId%7D/post/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Updates metadata of an order';
      tags: ['v1-product'];
    };
  };
  '/api/v1/product/{orderId}': {
    get: {
      description: 'Retrieves the document or structured data associated with a completed order identified with its order id';
      operationId: 'ProductRetrieve';
      parameters: [
        {
          description: 'ID of the ProductOrder as returned from a /product/buy call - 32 character hex value';
          in: 'path';
          name: 'orderId';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    properties: {
                      childOrders: {
                        items: {
                          type: 'string';
                        };
                        type: 'array';
                      };
                      data: {
                        type: 'string';
                      };
                      mimeType: {
                        type: 'string';
                      };
                      productOrderId: {
                        type: 'string';
                      };
                      uri: {
                        type: 'string';
                      };
                    };
                    required: ['mimeType', 'productOrderId', 'uri'];
                  },
                  {
                    properties: {
                      data: {
                        type: 'object';
                      };
                      mimeType: {
                        type: 'string';
                      };
                      productOrderId: {
                        type: 'string';
                      };
                      uri: {
                        type: 'string';
                      };
                    };
                    required: ['mimeType', 'productOrderId', 'uri', 'data'];
                  },
                ];
              };
            };
          };
          description: 'Details for retrieval of a delivered product';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Retrieves the result of an order';
      tags: ['v1-product'];
    };
  };
  '/api/v1/system/countries': {
    get: {
      description: 'Retrieve the list of all currently enabled countries';
      operationId: 'SystemCountries';
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    country_code: {
                      type: 'string';
                    };
                    country_name: {
                      type: 'string';
                    };
                  };
                };
                type: 'array';
              };
            };
          };
          description: 'List of countries';
        };
        default: {
          content: {
            'application/json': {
              schema: {
                properties: {
                  code: {
                    format: 'int32';
                    type: 'integer';
                  };
                  fault: {
                    type: 'string';
                  };
                  message: {
                    type: 'string';
                  };
                  tag: {
                    type: 'string';
                  };
                };
                required: ['code', 'message', 'tag'];
              };
            };
          };
          description: 'Detailed information about the error';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Returns a list of countries';
      tags: ['v1-system'];
    };
  };
  '/api/v1/system/health': {
    get: {
      description: 'Returns the health information for the official business registers based on usage.';
      operationId: 'HealthCheck';
      parameters: [];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    name: {
                      type: 'string';
                    };
                    status: {
                      type: 'string';
                    };
                  };
                };
                type: 'array';
              };
            };
          };
          description: 'List of the commercial registers and their health data';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Returns the health information for the official business registers based on usage.';
      tags: ['v1-system'];
    };
  };
  '/api/v1/system/pricelist': {
    get: {
      description: 'Retrieve pricing rules for your subscription plan';
      operationId: 'SystemPricelist';
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    cost_per_unit: {
                      type: 'string';
                    };
                    max: {
                      type: 'string';
                    };
                    metric_id: {
                      type: 'string';
                    };
                    min: {
                      type: 'string';
                    };
                    sku: {
                      type: 'string';
                    };
                  };
                };
                type: 'array';
              };
            };
          };
          description: 'List of pricing rules';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Returns a list of products with prices';
      tags: ['v1-system'];
    };
  };
  '/api/v1/tin-verification/basic-check': {
    get: {
      description: 'Performs a basic verification check of a given TIN number and name.';
      operationId: 'TinVerificationBasicCheck';
      parameters: [
        {
          description: 'Nine letter TIN number with or without hyphens';
          in: 'query';
          name: 'tin';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'Company Name';
          in: 'query';
          name: 'name';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  matchStatus: {
                    type: 'string';
                  };
                  name: {
                    type: 'string';
                  };
                  possibleMatch: {
                    type: 'string';
                  };
                  tin: {
                    type: 'string';
                  };
                  validationStatus: {
                    type: 'string';
                  };
                };
                required: ['tin', 'name', 'validationStatus', 'matchStatus', 'possibleMatch'];
              };
            };
          };
          description: 'Result of a basic TIN number check with company name';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Verifies a TIN number';
      tags: ['v1-tin-verification'];
    };
  };
  '/api/v1/tin-verification/comprehensive-check': {
    get: {
      description: 'Performs an EIN name match using provided TIN Number. Additionally to the name lookup it will lookup company details';
      operationId: 'TinVerificationComprehensiveCheck';
      parameters: [
        {
          description: 'Nine letter TIN number with or without hyphens';
          in: 'query';
          name: 'tin';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'Company Name';
          in: 'query';
          name: 'name';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
        {
          description: 'The percentage of minimum similarity threshold for company matching (optional, default: 70%)';
          in: 'query';
          name: 'threshold';
          required: false;
          schema: {
            format: 'int64';
            type: 'integer';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  einResult: {
                    type: 'string';
                  };
                  matchedCompanies: {
                    $ref: '#/paths/~1api~1v1~1company~1search~1name~1%7Bcountry%7D~1%7Bname%7D/get/responses/200/content/application~1json/schema';
                  };
                  tinResult: {
                    type: 'string';
                  };
                };
                required: ['tinResult', 'einResult', 'matchedCompanies'];
              };
            };
          };
          description: 'Result of a basic TIN number check with company name and the list of matched companies';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'EIN Name Lookup with TIN number and retrieves company data';
      tags: ['v1-tin-verification'];
    };
  };
  '/api/v1/tin-verification/name-lookup': {
    get: {
      description: 'Performs an EIN name match using provided TIN Number';
      operationId: 'TinVerificationNameLookup';
      parameters: [
        {
          description: 'Nine letter TIN number with or without hyphens';
          in: 'query';
          name: 'tin';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  matchStatus: {
                    type: 'string';
                  };
                  possibleMatch: {
                    type: 'string';
                  };
                  tin: {
                    type: 'string';
                  };
                };
                required: ['tin', 'matchStatus', 'possibleMatch'];
              };
            };
          };
          description: 'Result of a EIN name lookup with TIN number';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'EIN Name Lookup with TIN number';
      tags: ['v1-tin-verification'];
    };
  };
  '/api/v1/vat-verification/basic-check/{country}': {
    post: {
      description: 'Basic verification of given VAT number against VIES. Optional parameters may help to build a better confidence score.';
      operationId: 'VatBasic';
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars';
          in: 'path';
          name: 'country';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                companyAddress: {
                  description: 'company address lines';
                  type: 'string';
                };
                companyName: {
                  description: 'Company name';
                  type: 'string';
                };
                companyNumber: {
                  description: 'official company number';
                  type: 'string';
                };
                vatNumber: {
                  description: 'VAT number to validate';
                  type: 'string';
                };
              };
              required: ['vatNumber'];
              type: 'object';
            };
          };
        };
        description: 'VAT number and the company details';
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  candidate: {
                    items: {
                      $ref: '#/paths/~1api~1v1~1company~1deepsearch~1lei~1%7Bnumber%7D/get/responses/200/content/application~1json/schema/properties/company';
                    };
                    type: 'array';
                  };
                  company: {
                    $ref: '#/paths/~1api~1v1~1company~1deepsearch~1lei~1%7Bnumber%7D/get/responses/200/content/application~1json/schema/properties/company';
                  };
                  confidenceScore: {
                    type: 'number';
                  };
                  validationStatus: {
                    type: 'boolean';
                  };
                };
                required: ['confidenceScore', 'validationStatus'];
              };
            };
          };
          description: 'Denotes validity of checked VAT';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Returns a verification result';
      tags: ['v1-vat-verification'];
    };
  };
  '/api/v1/vat-verification/comprehensive-check/{country}': {
    post: {
      description: 'Extended verification of given VAT number against VIES. Optional parameters may help to build a better confidence score.';
      operationId: 'VatComprehensive';
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars';
          in: 'path';
          name: 'country';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                companyAddress: {
                  description: 'company address lines';
                  type: 'string';
                };
                companyName: {
                  description: 'Company name';
                  type: 'string';
                };
                companyNumber: {
                  description: 'official company number';
                  type: 'string';
                };
                vatNumber: {
                  description: 'VAT number to validate';
                  type: 'string';
                };
              };
              required: ['vatNumber'];
              type: 'object';
            };
          };
        };
        description: 'VAT number and the company details';
        required: true;
      };
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1vat-verification~1basic-check~1%7Bcountry%7D/post/responses/200';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Returns a verification result and company data';
      tags: ['v1-vat-verification'];
    };
  };
  '/api/v1/vat-verification/leveltwo-check/{country}': {
    post: {
      description: 'Second Level Verification of VAT number against BMF Austria. Optional confirmation parameter can be provided to order a Confirmation Report.';
      operationId: 'VatLevelTwo';
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars';
          in: 'path';
          name: 'country';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                confirmation: {
                  description: 'If a confirmation document should be ordered';
                  type: 'boolean';
                };
                vatNumber: {
                  description: 'VAT number to validate';
                  type: 'string';
                };
              };
              required: ['vatNumber'];
              type: 'object';
            };
          };
        };
        description: 'VAT number and confirmation request';
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  address: {
                    type: 'string';
                  };
                  confirmation: {
                    type: 'string';
                  };
                  level: {
                    type: 'string';
                  };
                  name: {
                    type: 'string';
                  };
                  validationStatus: {
                    type: 'boolean';
                  };
                };
                required: ['validationStatus', 'level'];
              };
            };
          };
          description: 'Denotes second level validity result of checked VAT';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Returns a level two verification result';
      tags: ['v1-vat-verification'];
    };
  };
  '/api/v1/vat-verification/lookup/{country}': {
    post: {
      description: 'Reverse VAT Lookup: Search for companies and their VAT numbers by company name. Search is forwarded to a provider.';
      operationId: 'VatLookup';
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars';
          in: 'path';
          name: 'country';
          required: true;
          schema: {
            format: 'string';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                address: {
                  description: 'Company address';
                  example: 'null';
                  type: 'string';
                };
                name: {
                  description: 'Company name';
                  example: 'null';
                  type: 'string';
                };
              };
              required: ['name'];
              type: 'object';
            };
          };
        };
        description: 'Company name';
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  matches: {
                    items: {
                      properties: {
                        company: {
                          $ref: '#/paths/~1api~1v1~1company~1deepsearch~1lei~1%7Bnumber%7D/get/responses/200/content/application~1json/schema/properties/company';
                        };
                        vat: {
                          type: 'string';
                        };
                      };
                    };
                    type: 'array';
                  };
                  searchterm_address: {
                    type: 'string';
                  };
                  searchterm_country: {
                    type: 'string';
                  };
                  searchterm_name: {
                    type: 'string';
                  };
                  timestamp: {
                    format: 'int32';
                    type: 'integer';
                  };
                };
                required: ['validationStatus', 'level'];
              };
            };
          };
          description: 'Result of a VAT number reverse Lookup';
        };
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default';
        };
      };
      security: [
        {
          user_key: [];
        },
      ];
      summary: 'Returns a list of vat numbers with additional data';
      tags: ['v1-vat-verification'];
    };
  };
};
export const paths = {
  '/api/v1/company/announcement/{id}': {
    get: {
      description: 'Request full announcement data identified by announcement id',
      operationId: 'CompanyAnnouncement',
      parameters: [
        {
          description: 'announcement hex ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    countryCode: {
                      type: 'string',
                    },
                    id: {
                      type: 'string',
                    },
                    registrationNumber: {
                      type: 'string',
                    },
                    structured: {
                      type: 'string',
                    },
                    text: {
                      type: 'string',
                    },
                    time: {
                      format: 'date',
                      type: 'string',
                    },
                    type: {
                      type: 'string',
                    },
                  },
                },
                type: 'array',
              },
            },
          },
          description: 'List of announcements',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves announcement data',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/deepsearch/isin': {
    post: {
      description:
        'Lookup stock exchange listings identified by an ISIN (International Securities Identification Number) number. Search is forwarded to a provider.',
      operationId: 'CompanyDeepsearchISIN',
      parameters: [],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                isin: {
                  description: 'A list of ISIN numbers seperated by comma (maximum) is 100',
                  type: 'string',
                },
              },
              type: 'object',
            },
          },
        },
        description: 'ISIN bulk deepsearch parameters',
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    isin: {
                      type: 'string',
                    },
                    listings: {
                      items: {
                        properties: {
                          additionalSecurityType: {
                            type: 'string',
                          },
                          exchCode: {
                            type: 'string',
                          },
                          identifier: {
                            type: 'string',
                          },
                          marketSector: {
                            type: 'string',
                          },
                          name: {
                            type: 'string',
                          },
                          securityDescription: {
                            type: 'string',
                          },
                          securityType: {
                            type: 'string',
                          },
                          shareClassId: {
                            type: 'string',
                          },
                          stockId: {
                            type: 'string',
                          },
                          symbol: {
                            type: 'string',
                          },
                        },
                      },
                      type: 'array',
                    },
                    validIsin: {
                      type: 'boolean',
                    },
                  },
                },
                type: 'array',
              },
            },
          },
          description: 'Result of a lookup by ISIN number',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves a list of stock exchange listings',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/deepsearch/lei/{number}': {
    get: {
      description:
        'Lookup companies identified by a LEI (Legal Entity Identifier) number. Search is forwarded to a provider.',
      operationId: 'CompanyDeepsearchLEI',
      parameters: [
        {
          description: 'lei number',
          in: 'path',
          name: 'number',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'Pagination for the ISIN number results (1000 numbers per page)',
          example: 1,
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            format: 'int32',
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  company: {
                    properties: {
                      address: {
                        items: {
                          type: 'string',
                        },
                        type: 'array',
                      },
                      country: {
                        type: 'string',
                      },
                      dateOfIncorporation: {
                        type: 'string',
                      },
                      extraData: {
                        type: 'object',
                      },
                      formattedAddress: {
                        items: {
                          type: 'string',
                        },
                        type: 'array',
                      },
                      id: {
                        type: 'string',
                      },
                      legalForm: {
                        type: 'string',
                      },
                      managingDirectors: {
                        items: {
                          type: 'string',
                        },
                        type: 'array',
                      },
                      name: {
                        type: 'string',
                      },
                      registrationNumber: {
                        type: 'string',
                      },
                      requestTime: {
                        type: 'integer',
                      },
                      secretaries: {
                        items: {
                          type: 'string',
                        },
                        type: 'array',
                      },
                      sicNaceCodes: {
                        items: {
                          type: 'string',
                        },
                        type: 'array',
                      },
                      status: {
                        type: 'string',
                      },
                    },
                    required: ['country', 'id', 'name', 'registrationNumber'],
                  },
                  current_page: {
                    format: 'int32',
                    type: 'integer',
                  },
                  isins: {
                    items: {
                      type: 'string',
                    },
                    type: 'array',
                  },
                  last_page: {
                    format: 'int32',
                    type: 'integer',
                  },
                  lei: {
                    type: 'string',
                  },
                  next_page: {
                    type: 'string',
                  },
                  total_num_isins: {
                    format: 'int32',
                    type: 'integer',
                  },
                  validLei: {
                    type: 'boolean',
                  },
                },
              },
            },
          },
          description: 'Result of a lookup by LEI number',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves a list of companies',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/deepsearch/name/{country}/{name}': {
    get: {
      description:
        'Search for companies with a certain name. Search is forwarded to the respective business register of the country.',
      operationId: 'CompanyDeepsearchName',
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars',
          in: 'path',
          name: 'country',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'company name',
          in: 'path',
          name: 'name',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1search~1name~1%7Bcountry%7D~1%7Bname%7D/get/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves a list of companies from the official business register',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/deepsearch/number/{country}/{number}': {
    get: {
      description:
        'Search for companies with a certain register number. Search is forwarded to the respective business register of the country.',
      operationId: 'CompanyDeepsearchNumber',
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars',
          in: 'path',
          name: 'country',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'company registration number',
          in: 'path',
          name: 'number',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1search~1name~1%7Bcountry%7D~1%7Bname%7D/get/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves a list of companies from the official business register',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/monitoring/changeTypes': {
    get: {
      description: 'Get current list of available ChangeTypes to subscribe to',
      operationId: 'CompanyMonitorChangeTypesList',
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  type: 'string',
                },
                type: 'array',
              },
            },
          },
          description: 'List of ChangeTypes',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Get available ChangeTypes',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/monitoring/list': {
    get: {
      description: 'Query list of all registered monitors for logged in user',
      operationId: 'CompanyMonitorList',
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1notification~1list~1%7Bid%7D/get/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves a list of registered monitors',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/monitoring/list/{id}': {
    get: {
      description: 'Query status of registered monitors for a specific company identified by a company id',
      operationId: 'CompanyMonitorId',
      parameters: [
        {
          description: 'Company Hex ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1notification~1list~1%7Bid%7D/get/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Get monitor status for specific company id',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/monitoring/register/{id}': {
    post: {
      description:
        'Add a company to your perpetual monitoring list and register a callback URL to get monitoring alerts.',
      operationId: 'CompanyMonitorRegister',
      parameters: [
        {
          description: 'Company Hex ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                callbackUrl: {
                  description: 'Callback URL',
                  type: 'string',
                },
                changeType: {
                  description: 'ChangeType to monitor',
                  type: 'string',
                },
              },
              required: ['callbackUrl', 'changeType'],
              type: 'object',
            },
          },
        },
        description: 'Callback URL where the notifications will be sent to',
      },
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1notification~1register~1%7Bid%7D/post/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Register a Company for monitoring',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/monitoring/unregister/{id}': {
    post: {
      description: 'Deactivate a previously registered company monitor identified by the notifier id',
      operationId: 'CompanyMonitorUnregister',
      parameters: [
        {
          description: 'Registration id of monitoring request record',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Empty response body',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Deactivates an active notification',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/notification/list': {
    get: {
      description: 'Query list of registered callback URLs for logged in user',
      operationId: 'CompanyNotificationList',
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1notification~1list~1%7Bid%7D/get/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves a list of registered notifications',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/notification/list/{id}': {
    get: {
      description: 'Query list of registered notifications for a specific company identified by a company id',
      operationId: 'CompanyNotificationId',
      parameters: [
        {
          description: 'Company Hex ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    callbackCount: {
                      format: 'int32',
                      type: 'integer',
                    },
                    callbackUrl: {
                      type: 'string',
                    },
                    created: {
                      $ref: '#/paths/~1api~1v1~1company~1announcement~1%7Bid%7D/get/responses/200/content/application~1json/schema/items/properties/time',
                    },
                    monitorStatus: {
                      type: 'string',
                    },
                    notificationId: {
                      type: 'string',
                    },
                    subjectId: {
                      type: 'string',
                    },
                  },
                },
                type: 'array',
              },
            },
          },
          description: 'List of monitor webhooks',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves a list of registered notifications',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/notification/register/{id}': {
    post: {
      description: 'Register a new callback URL to get notifications about companies.',
      operationId: 'CompanyNotificationRegister',
      parameters: [
        {
          description: 'Company Hex ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                callbackUrl: {
                  description: 'Callback URL',
                  type: 'string',
                },
              },
              required: ['callbackUrl'],
              type: 'object',
            },
          },
        },
        description: 'Callback URL where the notifications will be sent to',
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  monitorStatus: {
                    type: 'string',
                  },
                  notificationId: {
                    type: 'string',
                  },
                },
                required: ['notificationId', 'monitorStatus'],
              },
            },
          },
          description: 'Successful webhook registration response',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Creates a new notification',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/notification/unregister/{id}': {
    post: {
      description: 'Deactivate a previously registered company monitor identified by the notifier id',
      operationId: 'CompanyNotificationUnregister',
      parameters: [
        {
          description: 'Registration id of monitoring request record',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Empty response body',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Unregister a company from Monitoring',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/search/name/{country}/{name}': {
    get: {
      description: 'KYC API company index lookup for companies with a certain name in a country.',
      operationId: 'CompanySearchName',
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars',
          in: 'path',
          name: 'country',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'company name',
          in: 'path',
          name: 'name',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'number of search results',
          in: 'query',
          name: 'limit',
          required: false,
          schema: {
            format: 'int64',
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    address: {
                      items: {
                        type: 'string',
                      },
                      type: 'array',
                    },
                    country: {
                      type: 'string',
                    },
                    dateOfIncorporation: {
                      type: 'string',
                    },
                    extraData: {
                      type: 'object',
                    },
                    formattedAddress: {
                      items: {
                        type: 'string',
                      },
                      type: 'array',
                    },
                    id: {
                      type: 'string',
                    },
                    legalForm: {
                      type: 'string',
                    },
                    managingDirectors: {
                      items: {
                        type: 'string',
                      },
                      type: 'array',
                    },
                    name: {
                      type: 'string',
                    },
                    registrationNumber: {
                      type: 'string',
                    },
                    requestTime: {
                      type: 'integer',
                    },
                    secretaries: {
                      items: {
                        type: 'string',
                      },
                      type: 'array',
                    },
                    sicNaceCodes: {
                      items: {
                        type: 'string',
                      },
                      type: 'array',
                    },
                    status: {
                      type: 'string',
                    },
                  },
                },
                type: 'array',
              },
            },
          },
          description: 'List of companies',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves a list of companies from the KYC API company index',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/search/number/{country}/{number}': {
    get: {
      description: 'KYC API company index lookup for companies with a certain register number in a country.',
      operationId: 'CompanySearchNumber',
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars',
          in: 'path',
          name: 'country',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'company registration number',
          in: 'path',
          name: 'number',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'number of search results',
          in: 'query',
          name: 'limit',
          required: false,
          schema: {
            format: 'int64',
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1search~1name~1%7Bcountry%7D~1%7Bname%7D/get/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves a list of companies from the KYC API company index',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/search/{country}': {
    post: {
      description:
        'KYC API company index lookup by country and mixed parameters. This function requires a country code then a mixture of name',
      operationId: 'CompanyAlternativeSearch',
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars',
          in: 'path',
          name: 'country',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                address: {
                  description: 'Company address (or address partial)',
                  type: 'string',
                },
                name: {
                  description: 'Company name',
                  type: 'string',
                },
                number: {
                  description: 'Company registration number',
                  type: 'string',
                },
                phone: {
                  description: 'Company contact phone number',
                  type: 'string',
                },
                url: {
                  description: 'Company url',
                  type: 'string',
                },
                vat: {
                  description: 'Company VAT number',
                  type: 'string',
                },
              },
              type: 'object',
            },
          },
        },
        description: 'VAT number and the company details',
      },
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1search~1name~1%7Bcountry%7D~1%7Bname%7D/get/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves a list of companies from the KYC API company index',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/{id}/announcements': {
    get: {
      description: 'Search announcements filed to the business register from a company identified by an id',
      operationId: 'CompanyIdAnnouncements',
      parameters: [
        {
          description: 'company hex ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'limit of announcements in response (default 10)',
          in: 'query',
          name: 'limit',
          required: false,
          schema: {
            format: 'int32',
            type: 'integer',
          },
        },
        {
          description: 'to paginate through results (default 0)',
          in: 'query',
          name: 'offset',
          required: false,
          schema: {
            format: 'int32',
            type: 'integer',
          },
        },
        {
          description:
            'If this parameter is set to false, you will only receive ids, and no additional data about announcements and no hits to the metric will be counted. (and potentially minimizing your costs)',
          in: 'query',
          name: 'data',
          required: false,
          schema: {
            format: '',
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1announcement~1%7Bid%7D/get/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves company announcements',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/{id}/super/{country}': {
    get: {
      description: 'Request company superdata identified by company id',
      operationId: 'CompanyIdSuper',
      parameters: [
        {
          description: 'company superdata by id',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars',
          in: 'path',
          name: 'country',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'Optional data translation (only available in limited jurisdictions)',
          in: 'query',
          name: 'lang',
          required: false,
          schema: {
            enum: ['', 'OG', 'EN'],
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1company~1search~1name~1%7Bcountry%7D~1%7Bname%7D/get/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves structured data extracted from a company document',
      tags: ['v1-company'],
    },
  },
  '/api/v1/company/{id}/{dataset}': {
    get: {
      description: 'Get company details by id. The level of details is defined by the dataset parameter',
      operationId: 'CompanyIdDataset',
      parameters: [
        {
          description: 'company master data by id',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'Try to retrieve additional stock information for this company. (Only available on refresh)',
          in: 'query',
          name: 'check_stock_listing',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'company master data by id',
          in: 'path',
          name: 'dataset',
          required: true,
          schema: {
            enum: ['', 'mini', 'master', 'full', 'refresh'],
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'Optional data translation (only available in limited jurisdictions)',
          in: 'query',
          name: 'lang',
          required: false,
          schema: {
            enum: ['', 'EN', 'ES', 'FR'],
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/paths/~1api~1v1~1company~1deepsearch~1lei~1%7Bnumber%7D/get/responses/200/content/application~1json/schema/properties/company',
              },
            },
          },
          description: '',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves company details',
      tags: ['v1-company'],
    },
  },
  '/api/v1/ein-verification/basic-check': {
    get: {
      description: 'Performs a basic verification check of a given EIN tax number.',
      operationId: 'EinVerificationBasic',
      parameters: [
        {
          description: 'Nine letter EIN number with or without hyphens',
          in: 'query',
          name: 'ein',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  confidence_score: {
                    type: 'string',
                  },
                  confidence_score_explanation: {
                    type: 'string',
                  },
                  dba_score: {
                    type: 'string',
                  },
                  dba_score_explanation: {
                    type: 'string',
                  },
                  ein: {
                    type: 'string',
                  },
                  irs_score: {
                    type: 'string',
                  },
                  irs_score_explanation: {
                    type: 'string',
                  },
                  timestamp: {
                    type: 'number',
                  },
                  validationStatus: {
                    type: 'boolean',
                  },
                },
                required: [
                  'ein',
                  'validationStatus',
                  'irs_score',
                  'irs_score_explanation',
                  'dba_score',
                  'dba_score_explanation',
                  'confidence_score',
                  'confidence_score_explanation',
                  'timestamp',
                ],
              },
            },
          },
          description: 'Result of a basic EIN number verification',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Verifies an EIN number',
      tags: ['v1-ein-verification'],
    },
  },
  '/api/v1/ein-verification/comprehensive-check': {
    get: {
      description:
        'Comprehensive verification of a given EIN number. Additionally to the basic verification it will lookup company details',
      operationId: 'EinVerificationComprehensive',
      parameters: [
        {
          description: 'Nine letter EIN number with or without hyphens',
          in: 'query',
          name: 'ein',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  ein: {
                    type: 'string',
                  },
                  matched_ein_companies: {
                    $ref: '#/paths/~1api~1v1~1ein-verification~1lookup/get/responses/200/content/application~1json/schema/properties/matched_ein_companies',
                  },
                  timestamp: {
                    type: 'number',
                  },
                  validationStatus: {
                    type: 'boolean',
                  },
                },
                required: ['ein', 'validationStatus', 'matched_ein_companies', 'timestamp'],
              },
            },
          },
          description: 'Result of a comprehensive EIN number verification',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Verifies EIN number and retrieves company data',
      tags: ['v1-ein-verification'],
    },
  },
  '/api/v1/ein-verification/lookup': {
    get: {
      description: 'Lookup EIN number for a company by its company name',
      operationId: 'EinVerificationLookup',
      parameters: [
        {
          description: 'Business name of the company',
          in: 'query',
          name: 'name',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description:
            'Optional state parameter to improve results. (Two letter code for example CA or US-CA for California)',
          in: 'query',
          name: 'state',
          required: false,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'Optional zip code parameter to improve results. (Zip is preferred over state)',
          in: 'query',
          name: 'zip',
          required: false,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description:
            'Optional parameter to do tight matching. (Only the best match will be returned rather then the top 5)',
          in: 'query',
          name: 'tight',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  matched_ein_companies: {
                    items: {
                      properties: {
                        address: {
                          items: {
                            type: 'string',
                          },
                          type: 'array',
                        },
                        company_score: {
                          type: 'number',
                        },
                        company_score_explanation: {
                          type: 'string',
                        },
                        confidence_score: {
                          type: 'number',
                        },
                        confidence_score_explanation: {
                          type: 'string',
                        },
                        dba_score: {
                          type: 'string',
                        },
                        dba_score_explanation: {
                          type: 'string',
                        },
                        ein: {
                          type: 'string',
                        },
                        formattedAddress: {
                          items: {
                            type: 'string',
                          },
                          type: 'array',
                        },
                        irs_score: {
                          type: 'string',
                        },
                        irs_score_explanation: {
                          type: 'string',
                        },
                        name: {
                          type: 'string',
                        },
                        provided_status: {
                          type: 'string',
                        },
                        provided_status_explanation: {
                          type: 'string',
                        },
                      },
                    },
                    type: 'array',
                  },
                  searchterm_name: {
                    type: 'string',
                  },
                  searchterm_state: {
                    type: 'string',
                  },
                  searchterm_zip: {
                    type: 'string',
                  },
                  tight_search: {
                    type: 'boolean',
                  },
                  timestamp: {
                    type: 'number',
                  },
                },
                required: ['searchterm_name', 'searchterm_state', 'searchterm_zip', 'tight_search', 'timestamp'],
              },
            },
          },
          description: 'Result of a EIN reverse lookup',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves a list of EIN numbers',
      tags: ['v1-ein-verification'],
    },
  },
  '/api/v1/iban-verification/check-iban': {
    post: {
      description: 'Basic verification of an IBAN number validating its structure',
      operationId: 'IbanBasic',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                ibanNumber: {
                  description: 'IBAN number to validate',
                  example: 'AT483200000012345864',
                  type: 'string',
                },
              },
              required: ['ibanNumber'],
              type: 'object',
            },
          },
        },
        description: 'IBAN number',
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  valid: {
                    type: 'boolean',
                  },
                },
                required: ['valid'],
              },
            },
          },
          description: 'Denotes validity of checked IBAN',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Checks validity of an IBAN number',
      tags: ['v1-iban-verification'],
    },
  },
  '/api/v1/iban-verification/comprehensive-check-iban': {
    post: {
      description: 'Comprehensive verification of IBAN number using a service provider for verification',
      operationId: 'IbanComprehensive',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                ibanNumber: {
                  description: 'IBAN number to validate',
                  example: 'AT483200000012345864',
                  type: 'string',
                },
              },
              required: ['ibanNumber'],
              type: 'object',
            },
          },
        },
        description: 'IBAN number',
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/paths/~1api~1v1~1iban-verification~1check-iban/post/responses/200/content/application~1json/schema',
              },
            },
          },
          description: 'Denotes validity of checked IBAN and provides comprehensive information',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Checks validity of an IBAN number',
      tags: ['v1-iban-verification'],
    },
  },
  '/api/v1/nif-verification/basic-check/{country}': {
    post: {
      description:
        'Performs a basic verification check of a given NIF tax number against NIF.com. Optional parameters may be added to improve calculation of confidence score.',
      operationId: 'NifBasic',
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars',
          in: 'path',
          name: 'country',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                companyAddress: {
                  description: 'company address lines',
                  type: 'string',
                },
                companyName: {
                  description: 'Company name',
                  type: 'string',
                },
                nifNumber: {
                  description: 'NIF number to validate',
                  type: 'string',
                },
              },
              required: ['nifNumber'],
              type: 'object',
            },
          },
        },
        description: 'Company details',
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  companyName: {
                    type: 'string',
                  },
                  confidenceScore: {
                    type: 'number',
                  },
                  nifNumber: {
                    type: 'number',
                  },
                  validationStatus: {
                    type: 'boolean',
                  },
                },
                required: ['nifNumber', 'confidenceScore', 'validationStatus'],
              },
            },
          },
          description: 'Result of a basic NIF verification',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Verifies a NIF number',
      tags: ['v1-nif-verification'],
    },
  },
  '/api/v1/nif-verification/comprehensive-check/{country}': {
    post: {
      description:
        'Comprehensive verification of given portuguese NIF number against NIF.com. Optional parameters may help to build a better confidence score. Additional company data will be provided.',
      operationId: 'NifComprehensive',
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars',
          in: 'path',
          name: 'country',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                companyAddress: {
                  description: 'company address lines',
                  type: 'string',
                },
                companyName: {
                  description: 'Company name',
                  type: 'string',
                },
                nifNumber: {
                  description: 'NIF number to validate',
                  type: 'string',
                },
              },
              required: ['nifNumber'],
              type: 'object',
            },
          },
        },
        description: 'Company details',
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  activity: {
                    type: 'object',
                  },
                  address: {
                    type: 'string',
                  },
                  capital: {
                    type: 'number',
                  },
                  companyName: {
                    type: 'string',
                  },
                  confidenceScore: {
                    type: 'number',
                  },
                  currency: {
                    type: 'string',
                  },
                  email: {
                    type: 'string',
                  },
                  fax: {
                    type: 'string',
                  },
                  geo: {
                    type: 'string',
                  },
                  legalType: {
                    type: 'string',
                  },
                  nifNumber: {
                    type: 'number',
                  },
                  phone: {
                    type: 'string',
                  },
                  status: {
                    type: 'object',
                  },
                  validationStatus: {
                    type: 'boolean',
                  },
                  website: {
                    type: 'string',
                  },
                },
                required: ['nifNumber', 'confidenceScore', 'validationStatus'],
              },
            },
          },
          description: 'Result of a comprehensive NIF verification',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Verifies a NIF number and retrieves company data',
      tags: ['v1-nif-verification'],
    },
  },
  '/api/v1/pepsanction/monitor/list': {
    get: {
      description: 'Retrieve a list of all active Pep Sanction Report monitors for this account',
      operationId: 'PepMonitorList',
      parameters: [],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    active: {
                      type: 'boolean',
                    },
                    caseId: {
                      type: 'string',
                    },
                    created: {
                      $ref: '#/paths/~1api~1v1~1company~1announcement~1%7Bid%7D/get/responses/200/content/application~1json/schema/items/properties/time',
                    },
                    identifier: {
                      type: 'string',
                    },
                    structured: {
                      type: 'string',
                    },
                    updated: {
                      type: 'string',
                    },
                    webhook: {
                      type: 'string',
                    },
                  },
                },
                type: 'array',
              },
            },
          },
          description: 'View Pep Sanction Report monitors',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves a list of monitor entries',
      tags: ['v1-pepsanction'],
    },
  },
  '/api/v1/pepsanction/monitor/unregister/{id}': {
    post: {
      description: 'Unregister a previously created Pep Sanction Report Monitor',
      operationId: 'PepMonitorUnregister',
      parameters: [
        {
          description: 'The identifier of the Monitor',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1pepsanction~1monitor~1update~1%7Bid%7D/post/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Deactive a pep sanction monitor',
      tags: ['v1-pepsanction'],
    },
  },
  '/api/v1/pepsanction/monitor/update/{id}': {
    post: {
      description: 'Update the webhook URL of an active Pep Sanction Report Monitor',
      operationId: 'PepMonitorUpdate',
      parameters: [
        {
          description: 'The identifier of the Monitor',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                Webhook: {
                  description:
                    'If Monitoring is enabled this parameter is required. This is where updates will be sent to',
                  example: 'null',
                  type: 'string',
                },
              },
              type: 'object',
            },
          },
        },
        description: 'Pass new Webhook as post parameter',
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  active: {
                    type: 'boolean',
                  },
                  caseId: {
                    type: 'string',
                  },
                  created: {
                    $ref: '#/paths/~1api~1v1~1company~1announcement~1%7Bid%7D/get/responses/200/content/application~1json/schema/items/properties/time',
                  },
                  identifier: {
                    type: 'string',
                  },
                  structured: {
                    type: 'string',
                  },
                  updated: {
                    type: 'string',
                  },
                  webhook: {
                    type: 'string',
                  },
                },
              },
            },
          },
          description: 'View a monitor for a Pep Sanction Report',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Update details of active Pep Sanction monitor',
      tags: ['v1-pepsanction'],
    },
  },
  '/api/v1/pepsanction/order/{type}/{search}': {
    post: {
      description:
        'Order a new Pep Sanction Check by providing either a business or person name with some additional optional parameters.',
      operationId: 'PepOrder',
      parameters: [
        {
          description: 'Type (Business or Person) of the requested Pep Sanction Check',
          in: 'path',
          name: 'type',
          required: true,
          schema: {
            enum: ['', 'B', 'P'],
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'Search string for the Pep Sanction Check',
          in: 'path',
          name: 'search',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                Aliases: {
                  description:
                    'Optional parameter for declaring alias names when doing a person search (seperated by commas)',
                  example: 'null',
                  type: 'string',
                },
                Country: {
                  description:
                    'Optional name of Country to assist in identifying matches based upon location/geography.',
                  example: 'null',
                  type: 'string',
                },
                DOB: {
                  description: 'Optional parameter for date of birth name when doing a person search',
                  example: 'null',
                  type: 'string',
                },
                FamilyName: {
                  description: 'Optional parameter for last name when doing a person search',
                  example: 'null',
                  type: 'string',
                },
                Filters: {
                  description:
                    'Optional parameter for restricting search when doing a person search (seperated by commas)',
                  example: 'null',
                  type: 'string',
                },
                GivenName: {
                  description: 'Optional parameter for first name when doing a person search',
                  example: 'null',
                  type: 'string',
                },
                LEI: {
                  description: 'Optional Legal Entity Identifier for additional business identifier verification.',
                  example: 'null',
                  type: 'string',
                },
                Locale: {
                  description:
                    'Optional name of City or Locale to assist in identifying matches based upon location/geography.',
                  example: 'null',
                  type: 'string',
                },
                Medialists: {
                  description:
                    'Optional parameter for selecting only specific media lists. By default all lists are queried',
                  example: 'NMEDIA',
                  type: 'string',
                },
                MiddleName: {
                  description: 'Optional parameter for middle name when doing a person search',
                  example: 'null',
                  type: 'string',
                },
                Monitoring: {
                  description: 'If this Pep Sanction Check should be continuesly monitored.',
                  example: false,
                  type: 'boolean',
                },
                Peplists: {
                  description:
                    'Optional parameter for selecting only specific pep lists. By default all lists are queried',
                  example: 'GOV,PEPD,SOE',
                  type: 'string',
                },
                Region: {
                  description:
                    'Optional name of Region or State to assist in identifying matches based upon location/geography.',
                  example: 'null',
                  type: 'string',
                },
                SmartMatch: {
                  description: 'Optional parameter for enabling SmartMatch to retrieve more results',
                  example: false,
                  type: 'boolean',
                },
                Watchlists: {
                  description:
                    'Optional parameter for selecting only specific watch lists. By default all lists are queried',
                  example: 'SANCTIONS,FINANCE,TERRORISM,CRIME,SMAGOV,OFAC,MEDICAL',
                  type: 'string',
                },
                Webhook: {
                  description:
                    'If Monitoring is enabled this parameter is required. This is where updates will be sent to',
                  example: 'null',
                  type: 'string',
                },
              },
              type: 'object',
            },
          },
        },
        description: 'Optional parameters to enhance search',
      },
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1product~1availability~1%7Bsku%7D~1%7BsubjectId%7D/get/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Orders a new Pep Sanction Check Report',
      tags: ['v1-pepsanction'],
    },
  },
  '/api/v1/pepsanction/retrieve/{id}': {
    get: {
      description: 'Retrieve a completed Pep Sanction check structured or in pdf depending on given accept header',
      operationId: 'PepRetrieve',
      parameters: [
        {
          description: 'The type (pdf or json) in which the check should be returned',
          in: 'header',
          name: 'accept',
          required: false,
          schema: {
            default: 'application/json',
            enum: ['application/json', 'application/pdf'],
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'The id of the ordered Pep Sanction Check (id as returned by orderPepSanction call)',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  listsChecked: {
                    type: 'string',
                  },
                  results: {
                    properties: {
                      Excerpts: {
                        type: 'string',
                      },
                      ResultsURL: {
                        type: 'string',
                      },
                      SearchType: {
                        type: 'string',
                      },
                      SourceAgency: {
                        type: 'string',
                      },
                      SourceEntity: {
                        type: 'string',
                      },
                      SourceID: {
                        format: 'int64',
                        type: 'integer',
                      },
                      SourceName: {
                        type: 'string',
                      },
                      SourceType: {
                        type: 'string',
                      },
                    },
                  },
                  search: {
                    type: 'string',
                  },
                  status: {
                    type: 'string',
                  },
                  timestamp: {
                    $ref: '#/paths/~1api~1v1~1company~1announcement~1%7Bid%7D/get/responses/200/content/application~1json/schema/items/properties/time',
                  },
                  type: {
                    type: 'string',
                  },
                },
                required: ['listsChecked', 'search', 'status', 'timestamp', 'type'],
              },
            },
          },
          description: 'Result of a PEP and sanctions list check',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Returns a json or pdf report',
      tags: ['v1-pepsanction'],
    },
  },
  '/api/v1/product/availability/{sku}/{subjectId}': {
    get: {
      description:
        'Check availability and valid options for a particular product for a particular company identfied by its id',
      operationId: 'ProductAvailability',
      parameters: [
        {
          description: 'SKU - 9 character value from a Product object',
          in: 'path',
          name: 'sku',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'Subject (e.g. Company) ID - 32 character hex value',
          in: 'path',
          name: 'subjectId',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  availability: {
                    type: 'string',
                  },
                  category: {
                    type: 'string',
                  },
                  countryCode: {
                    type: 'string',
                  },
                  description: {
                    type: 'string',
                  },
                  hasOptions: {
                    type: 'boolean',
                  },
                  options: {
                    items: {
                      type: 'string',
                    },
                    type: 'array',
                  },
                  price: {
                    format: 'float',
                    type: 'number',
                  },
                  provider: {
                    type: 'string',
                  },
                  sku: {
                    type: 'string',
                  },
                  type: {
                    type: 'string',
                  },
                },
                required: [
                  'availability',
                  'category',
                  'countryCode',
                  'description',
                  'hasOptions',
                  'options',
                  'price',
                  'provider',
                  'sku',
                  'type',
                ],
              },
            },
          },
          description: 'Product details',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves a document availability result',
      tags: ['v1-product'],
    },
  },
  '/api/v1/product/catalog/{country}': {
    get: {
      description: 'Returns a catalog of purchasable products available with some metadata for a particular country',
      operationId: 'ProductCatalog',
      parameters: [
        {
          description: 'two letter country code in upper case',
          in: 'path',
          name: 'country',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  countryCode: {
                    type: 'string',
                  },
                  description: {
                    type: 'string',
                  },
                  form: {
                    type: 'string',
                  },
                  method: {
                    type: 'string',
                  },
                  name: {
                    type: 'string',
                  },
                  price: {
                    format: 'float',
                    type: 'number',
                  },
                  sku: {
                    type: 'string',
                  },
                  url: {
                    type: 'string',
                  },
                },
                required: ['url'],
              },
            },
          },
          description: 'Product with details like URI to purchase it',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Returns a catalog of products',
      tags: ['v1-product'],
    },
  },
  '/api/v1/product/notifier/{notifierId}': {
    get: {
      description: 'Queries and returns all metadata associated with a notifier identified by its notifer id',
      operationId: 'ProductNotifier',
      parameters: [
        {
          description: 'ID of the ProductOrderNotifier as returned from a /notifier POST call - 32 character hex value',
          in: 'path',
          name: 'notifierId',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1product~1notifier~1%7BorderId%7D~1%7Btype%7D~1%7Buri%7D/post/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Returns metadata for a notifier',
      tags: ['v1-product'],
    },
  },
  '/api/v1/product/notifier/{orderId}/{type}/{uri}': {
    post: {
      description: 'Create a notifier for a particular order. Parameters can be supplied in the path',
      operationId: 'ProductNotifierCreate',
      parameters: [
        {
          description: 'ID of the ProductOrder as returned from a /product/buy call - 32 character hex value',
          in: 'path',
          name: 'orderId',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description:
            'Type of the notifier - indicates the action the notifier will perform. Currently GET and POST are supported which performs an http(s) GET/POST to the supplied uri with appended notifierId= and orderId= parameters when the order processing is completed. Upon the POST request the order object is sent as a JSON body',
          in: 'path',
          name: 'type',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description:
            "URI of the notifier for the 'complete' action. Currently only a GET method HTTP(s) URL is supported. 1 to 250 characters long. Every slash in the URI must be replaced by a ~",
          in: 'path',
          name: 'uri',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  callback: {
                    type: 'string',
                  },
                  identity: {
                    type: 'string',
                  },
                  lastCallTime: {
                    $ref: '#/paths/~1api~1v1~1company~1announcement~1%7Bid%7D/get/responses/200/content/application~1json/schema/items/properties/time',
                  },
                  lastResponseCode: {
                    type: 'integer',
                  },
                  notifierType: {
                    type: 'string',
                  },
                  productOrderIdentity: {
                    type: 'string',
                  },
                },
                required: ['callback', 'lastCallTime', 'lastResponseCode', 'notifierType', 'productOrderIdentity'],
              },
            },
          },
          description: 'Details of configured product order notification',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Creates a notifier for an order',
      tags: ['v1-product'],
    },
  },
  '/api/v1/product/order/concierge': {
    post: {
      description: 'Place an order for a concierge product',
      operationId: 'ProductOrderConcierge',
      parameters: [],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                companyName: {
                  description:
                    'Name of the company for which a document should be ordered. (Not required if subjectId is given)',
                  example: 'null',
                  type: 'string',
                },
                contactEmail: {
                  description:
                    'Contact E-Mail, will be contacted if concierge costs are exceeding the threshhold configured on your plan',
                  example: 'null',
                  type: 'string',
                },
                contactPhone: {
                  description:
                    'Contact phone, will be contacted if concierge costs are exceeding the threshhold configured on your plan',
                  example: 'null',
                  type: 'string',
                },
                costConfirmation: {
                  description:
                    'If the concierge cost should require additional confirmation if a threshold is reached (configured on your plan)',
                  example: false,
                  type: 'boolean',
                },
                country: {
                  description: 'Two letter ISO code of the country of the company',
                  example: 'null',
                  type: 'string',
                },
                financialData: {
                  description: 'If you want financial data of the company to be retrieved',
                  example: false,
                  type: 'boolean',
                },
                historicInformation: {
                  description: 'If you want historical data of the company to be retrieved',
                  example: false,
                  type: 'boolean',
                },
                informationRequirements: {
                  description:
                    'Requirements on what document or information should be provided. Please be very precise',
                  example: 'null',
                  type: 'string',
                },
                locationInvestigation: {
                  description: 'If the companies residency should be investigated',
                  example: false,
                  type: 'boolean',
                },
                priority: {
                  description: 'Priority of order: standard/express are allowed',
                  example: 'standard',
                  type: 'string',
                },
                registerData: {
                  description: 'If you want register data of the company to be retrieved',
                  example: false,
                  type: 'boolean',
                },
                registerNumber: {
                  description:
                    'Registration number of the company for which a document should be ordered. (Not required if subjectId is given)',
                  example: 'null',
                  type: 'string',
                },
                subjectId: {
                  description: 'Kompanyid of the company you want to place the order for',
                  example: 'null',
                  type: 'string',
                },
              },
              type: 'object',
            },
          },
        },
        description: 'Parameters for the concierge order',
      },
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1product~1order~1%7Bsku%7D~1%7BsubjectId%7D/post/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Places a concierge order',
      tags: ['v1-product'],
    },
  },
  '/api/v1/product/order/ubo': {
    post: {
      description: 'Place an order for a UBO (ultimate beneficial owner) discovery report',
      operationId: 'ProductOrderUbo',
      parameters: [],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                callbackUrl: {
                  description:
                    'An optional callback URL to which updates about the order will be sent (for instance if credits are exceeded)',
                  example: 'null',
                  type: 'string',
                },
                credits: {
                  description: 'Specify a maximum amount of credits which should be used. To disable use -1',
                  example: -1,
                  type: 'number',
                },
                includeDocs: {
                  description: 'Include purchase of register document to ubo report',
                  example: false,
                  type: 'boolean',
                },
                levels: {
                  description: 'Define a threshold for different levels of crawling',
                  example: '25,50',
                  type: 'string',
                },
                strategy: {
                  description: 'Choose a matching strategy. Available options (FULL,LEVELS)',
                  example: 'FULL',
                  type: 'string',
                },
                subjectId: {
                  description: 'KYC API Id (32 byte hexid) of the company you want to place the order for',
                  example: 'null',
                  type: 'string',
                },
              },
              required: ['subjectId'],
              type: 'object',
            },
          },
        },
        description: 'Parameters for the UBO order',
      },
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1product~1order~1%7Bsku%7D~1%7BsubjectId%7D/post/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Places a UBO order',
      tags: ['v1-product'],
    },
  },
  '/api/v1/product/order/{sku}/{option}/{subjectId}': {
    post: {
      description:
        'Place an order for a particular product identified by its SKU with a particular option for a particular company identified by its id',
      operationId: 'ProductOrderWithOption',
      parameters: [
        {
          description: 'SKU - 9 character value from a Product object',
          in: 'path',
          name: 'sku',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'Product option (e.g. Accounts year) from a previous Availability call',
          in: 'path',
          name: 'option',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'Subject (e.g. Company) ID - 32 character hex value',
          in: 'path',
          name: 'subjectId',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1product~1order~1%7Bsku%7D~1%7BsubjectId%7D/post/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Places a product order',
      tags: ['v1-product'],
    },
  },
  '/api/v1/product/order/{sku}/{subjectId}': {
    post: {
      description:
        'Place an order for a particular product identified by its SKU for a particular company identified by its id',
      operationId: 'ProductOrder',
      parameters: [
        {
          description: 'SKU - 9 character value from a Product object',
          in: 'path',
          name: 'sku',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'Subject (e.g. Company) ID - 32 character hex value',
          in: 'path',
          name: 'subjectId',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  identity: {
                    type: 'string',
                  },
                  option: {
                    type: 'string',
                  },
                  ordered: {
                    $ref: '#/paths/~1api~1v1~1company~1announcement~1%7Bid%7D/get/responses/200/content/application~1json/schema/items/properties/time',
                  },
                  owner: {
                    type: 'string',
                  },
                  price: {
                    format: 'float',
                    type: 'number',
                  },
                  sku: {
                    type: 'string',
                  },
                  status: {
                    type: 'string',
                  },
                  subjectId: {
                    type: 'string',
                  },
                  subjectValue: {
                    type: 'string',
                  },
                },
                required: [
                  'identity',
                  'option',
                  'ordered',
                  'owner',
                  'price',
                  'sku',
                  'status',
                  'subjectId',
                  'subjectValue',
                ],
              },
            },
          },
          description: 'Product order details',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Places a product order',
      tags: ['v1-product'],
    },
  },
  '/api/v1/product/search/{subjectId}': {
    get: {
      description: 'Search for possible products for a particular company identified by its id',
      operationId: 'ProductSearch',
      parameters: [
        {
          description: 'Subject (e.g. Company) ID - 32 character hex value',
          in: 'path',
          name: 'subjectId',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    availability: {
                      type: 'string',
                    },
                    category: {
                      type: 'string',
                    },
                    countryCode: {
                      type: 'string',
                    },
                    description: {
                      type: 'string',
                    },
                    hasOptions: {
                      type: 'boolean',
                    },
                    options: {
                      items: {
                        type: 'string',
                      },
                      type: 'array',
                    },
                    price: {
                      format: 'float',
                      type: 'number',
                    },
                    provider: {
                      type: 'string',
                    },
                    sku: {
                      type: 'string',
                    },
                    type: {
                      type: 'string',
                    },
                  },
                },
                type: 'array',
              },
            },
          },
          description: 'List of products',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Returns a list of products',
      tags: ['v1-product'],
    },
  },
  '/api/v1/product/status/{orderId}': {
    get: {
      description: 'Retrieve the current status of an order identified by its order id',
      operationId: 'ProductStatus',
      parameters: [
        {
          description: 'ID of the ProductOrder as returned from a /product/buy call - 32 character hex value',
          in: 'path',
          name: 'orderId',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1product~1order~1%7Bsku%7D~1%7BsubjectId%7D/post/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Returns metadata for a order',
      tags: ['v1-product'],
    },
  },
  '/api/v1/product/update/{action}/{orderId}': {
    post: {
      description: 'Update an existing order identified by its order id',
      operationId: 'ProductUpdateAction',
      parameters: [
        {
          description: 'The action you want to perform for the order',
          in: 'path',
          name: 'action',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'ID of the ProductOrder as returned from a /product/buy call - 32 character hex value',
          in: 'path',
          name: 'orderId',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                credits: {
                  description: 'Specify an amount of credits which should be added to the order',
                  example: 100,
                  type: 'number',
                },
              },
              type: 'object',
            },
          },
        },
        description: 'Parameters for the update order endpoint',
      },
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1product~1order~1%7Bsku%7D~1%7BsubjectId%7D/post/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Updates metadata of an order',
      tags: ['v1-product'],
    },
  },
  '/api/v1/product/{orderId}': {
    get: {
      description:
        'Retrieves the document or structured data associated with a completed order identified with its order id',
      operationId: 'ProductRetrieve',
      parameters: [
        {
          description: 'ID of the ProductOrder as returned from a /product/buy call - 32 character hex value',
          in: 'path',
          name: 'orderId',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    properties: {
                      childOrders: {
                        items: {
                          type: 'string',
                        },
                        type: 'array',
                      },
                      data: {
                        type: 'string',
                      },
                      mimeType: {
                        type: 'string',
                      },
                      productOrderId: {
                        type: 'string',
                      },
                      uri: {
                        type: 'string',
                      },
                    },
                    required: ['mimeType', 'productOrderId', 'uri'],
                  },
                  {
                    properties: {
                      data: {
                        type: 'object',
                      },
                      mimeType: {
                        type: 'string',
                      },
                      productOrderId: {
                        type: 'string',
                      },
                      uri: {
                        type: 'string',
                      },
                    },
                    required: ['mimeType', 'productOrderId', 'uri', 'data'],
                  },
                ],
              },
            },
          },
          description: 'Details for retrieval of a delivered product',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Retrieves the result of an order',
      tags: ['v1-product'],
    },
  },
  '/api/v1/system/countries': {
    get: {
      description: 'Retrieve the list of all currently enabled countries',
      operationId: 'SystemCountries',
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    country_code: {
                      type: 'string',
                    },
                    country_name: {
                      type: 'string',
                    },
                  },
                },
                type: 'array',
              },
            },
          },
          description: 'List of countries',
        },
        default: {
          content: {
            'application/json': {
              schema: {
                properties: {
                  code: {
                    format: 'int32',
                    type: 'integer',
                  },
                  fault: {
                    type: 'string',
                  },
                  message: {
                    type: 'string',
                  },
                  tag: {
                    type: 'string',
                  },
                },
                required: ['code', 'message', 'tag'],
              },
            },
          },
          description: 'Detailed information about the error',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Returns a list of countries',
      tags: ['v1-system'],
    },
  },
  '/api/v1/system/health': {
    get: {
      description: 'Returns the health information for the official business registers based on usage.',
      operationId: 'HealthCheck',
      parameters: [],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    name: {
                      type: 'string',
                    },
                    status: {
                      type: 'string',
                    },
                  },
                },
                type: 'array',
              },
            },
          },
          description: 'List of the commercial registers and their health data',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Returns the health information for the official business registers based on usage.',
      tags: ['v1-system'],
    },
  },
  '/api/v1/system/pricelist': {
    get: {
      description: 'Retrieve pricing rules for your subscription plan',
      operationId: 'SystemPricelist',
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                items: {
                  properties: {
                    cost_per_unit: {
                      type: 'string',
                    },
                    max: {
                      type: 'string',
                    },
                    metric_id: {
                      type: 'string',
                    },
                    min: {
                      type: 'string',
                    },
                    sku: {
                      type: 'string',
                    },
                  },
                },
                type: 'array',
              },
            },
          },
          description: 'List of pricing rules',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Returns a list of products with prices',
      tags: ['v1-system'],
    },
  },
  '/api/v1/tin-verification/basic-check': {
    get: {
      description: 'Performs a basic verification check of a given TIN number and name.',
      operationId: 'TinVerificationBasicCheck',
      parameters: [
        {
          description: 'Nine letter TIN number with or without hyphens',
          in: 'query',
          name: 'tin',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'Company Name',
          in: 'query',
          name: 'name',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  matchStatus: {
                    type: 'string',
                  },
                  name: {
                    type: 'string',
                  },
                  possibleMatch: {
                    type: 'string',
                  },
                  tin: {
                    type: 'string',
                  },
                  validationStatus: {
                    type: 'string',
                  },
                },
                required: ['tin', 'name', 'validationStatus', 'matchStatus', 'possibleMatch'],
              },
            },
          },
          description: 'Result of a basic TIN number check with company name',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Verifies a TIN number',
      tags: ['v1-tin-verification'],
    },
  },
  '/api/v1/tin-verification/comprehensive-check': {
    get: {
      description:
        'Performs an EIN name match using provided TIN Number. Additionally to the name lookup it will lookup company details',
      operationId: 'TinVerificationComprehensiveCheck',
      parameters: [
        {
          description: 'Nine letter TIN number with or without hyphens',
          in: 'query',
          name: 'tin',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'Company Name',
          in: 'query',
          name: 'name',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
        {
          description: 'The percentage of minimum similarity threshold for company matching (optional, default: 70%)',
          in: 'query',
          name: 'threshold',
          required: false,
          schema: {
            format: 'int64',
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  einResult: {
                    type: 'string',
                  },
                  matchedCompanies: {
                    $ref: '#/paths/~1api~1v1~1company~1search~1name~1%7Bcountry%7D~1%7Bname%7D/get/responses/200/content/application~1json/schema',
                  },
                  tinResult: {
                    type: 'string',
                  },
                },
                required: ['tinResult', 'einResult', 'matchedCompanies'],
              },
            },
          },
          description: 'Result of a basic TIN number check with company name and the list of matched companies',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'EIN Name Lookup with TIN number and retrieves company data',
      tags: ['v1-tin-verification'],
    },
  },
  '/api/v1/tin-verification/name-lookup': {
    get: {
      description: 'Performs an EIN name match using provided TIN Number',
      operationId: 'TinVerificationNameLookup',
      parameters: [
        {
          description: 'Nine letter TIN number with or without hyphens',
          in: 'query',
          name: 'tin',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  matchStatus: {
                    type: 'string',
                  },
                  possibleMatch: {
                    type: 'string',
                  },
                  tin: {
                    type: 'string',
                  },
                },
                required: ['tin', 'matchStatus', 'possibleMatch'],
              },
            },
          },
          description: 'Result of a EIN name lookup with TIN number',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'EIN Name Lookup with TIN number',
      tags: ['v1-tin-verification'],
    },
  },
  '/api/v1/vat-verification/basic-check/{country}': {
    post: {
      description:
        'Basic verification of given VAT number against VIES. Optional parameters may help to build a better confidence score.',
      operationId: 'VatBasic',
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars',
          in: 'path',
          name: 'country',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                companyAddress: {
                  description: 'company address lines',
                  type: 'string',
                },
                companyName: {
                  description: 'Company name',
                  type: 'string',
                },
                companyNumber: {
                  description: 'official company number',
                  type: 'string',
                },
                vatNumber: {
                  description: 'VAT number to validate',
                  type: 'string',
                },
              },
              required: ['vatNumber'],
              type: 'object',
            },
          },
        },
        description: 'VAT number and the company details',
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  candidate: {
                    items: {
                      $ref: '#/paths/~1api~1v1~1company~1deepsearch~1lei~1%7Bnumber%7D/get/responses/200/content/application~1json/schema/properties/company',
                    },
                    type: 'array',
                  },
                  company: {
                    $ref: '#/paths/~1api~1v1~1company~1deepsearch~1lei~1%7Bnumber%7D/get/responses/200/content/application~1json/schema/properties/company',
                  },
                  confidenceScore: {
                    type: 'number',
                  },
                  validationStatus: {
                    type: 'boolean',
                  },
                },
                required: ['confidenceScore', 'validationStatus'],
              },
            },
          },
          description: 'Denotes validity of checked VAT',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Returns a verification result',
      tags: ['v1-vat-verification'],
    },
  },
  '/api/v1/vat-verification/comprehensive-check/{country}': {
    post: {
      description:
        'Extended verification of given VAT number against VIES. Optional parameters may help to build a better confidence score.',
      operationId: 'VatComprehensive',
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars',
          in: 'path',
          name: 'country',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                companyAddress: {
                  description: 'company address lines',
                  type: 'string',
                },
                companyName: {
                  description: 'Company name',
                  type: 'string',
                },
                companyNumber: {
                  description: 'official company number',
                  type: 'string',
                },
                vatNumber: {
                  description: 'VAT number to validate',
                  type: 'string',
                },
              },
              required: ['vatNumber'],
              type: 'object',
            },
          },
        },
        description: 'VAT number and the company details',
        required: true,
      },
      responses: {
        '200': {
          $ref: '#/paths/~1api~1v1~1vat-verification~1basic-check~1%7Bcountry%7D/post/responses/200',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Returns a verification result and company data',
      tags: ['v1-vat-verification'],
    },
  },
  '/api/v1/vat-verification/leveltwo-check/{country}': {
    post: {
      description:
        'Second Level Verification of VAT number against BMF Austria. Optional confirmation parameter can be provided to order a Confirmation Report.',
      operationId: 'VatLevelTwo',
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars',
          in: 'path',
          name: 'country',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                confirmation: {
                  description: 'If a confirmation document should be ordered',
                  type: 'boolean',
                },
                vatNumber: {
                  description: 'VAT number to validate',
                  type: 'string',
                },
              },
              required: ['vatNumber'],
              type: 'object',
            },
          },
        },
        description: 'VAT number and confirmation request',
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  address: {
                    type: 'string',
                  },
                  confirmation: {
                    type: 'string',
                  },
                  level: {
                    type: 'string',
                  },
                  name: {
                    type: 'string',
                  },
                  validationStatus: {
                    type: 'boolean',
                  },
                },
                required: ['validationStatus', 'level'],
              },
            },
          },
          description: 'Denotes second level validity result of checked VAT',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Returns a level two verification result',
      tags: ['v1-vat-verification'],
    },
  },
  '/api/v1/vat-verification/lookup/{country}': {
    post: {
      description:
        'Reverse VAT Lookup: Search for companies and their VAT numbers by company name. Search is forwarded to a provider.',
      operationId: 'VatLookup',
      parameters: [
        {
          description: 'ISO_3166-1_alpha-2 representation of a country name - 2 chars',
          in: 'path',
          name: 'country',
          required: true,
          schema: {
            format: 'string',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                address: {
                  description: 'Company address',
                  example: 'null',
                  type: 'string',
                },
                name: {
                  description: 'Company name',
                  example: 'null',
                  type: 'string',
                },
              },
              required: ['name'],
              type: 'object',
            },
          },
        },
        description: 'Company name',
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                properties: {
                  matches: {
                    items: {
                      properties: {
                        company: {
                          $ref: '#/paths/~1api~1v1~1company~1deepsearch~1lei~1%7Bnumber%7D/get/responses/200/content/application~1json/schema/properties/company',
                        },
                        vat: {
                          type: 'string',
                        },
                      },
                    },
                    type: 'array',
                  },
                  searchterm_address: {
                    type: 'string',
                  },
                  searchterm_country: {
                    type: 'string',
                  },
                  searchterm_name: {
                    type: 'string',
                  },
                  timestamp: {
                    format: 'int32',
                    type: 'integer',
                  },
                },
                required: ['validationStatus', 'level'],
              },
            },
          },
          description: 'Result of a VAT number reverse Lookup',
        },
        default: {
          $ref: '#/paths/~1api~1v1~1system~1countries/get/responses/default',
        },
      },
      security: [
        {
          user_key: [],
        },
      ],
      summary: 'Returns a list of vat numbers with additional data',
      tags: ['v1-vat-verification'],
    },
  },
} as TPaths;
