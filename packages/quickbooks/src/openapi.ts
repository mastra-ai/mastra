// @ts-nocheck
export type openapi = {
  openapi: '3.1.0';
  servers: [
    {
      url: 'https://quickbooks.api.intuit.com/v3/company/{realmId}';
      description: 'production';
      variables: {
        realmId: {
          default: '';
        };
      };
    },
    {
      description: 'sandbox';
      url: 'https://sandbox-quickbooks.api.intuit.com/v3/company/{realmId}';
      variables: {
        realmId: {
          default: '';
        };
      };
    },
  ];
  security: [
    {
      oauth2: [];
    },
  ];
  paths: {
    '/account/{id}': {
      get: {
        operationId: 'getAccount';
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
                    Account: {
                      $ref: '#/components/schemas/Account';
                    };
                    time: {
                      type: 'string';
                      format: 'date-time';
                    };
                  };
                  required: ['Account', 'time'];
                };
              };
            };
          };
        };
      };
    };
    '/purchase/{id}': {
      get: {
        operationId: 'getPurchase';
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
                    Purchase: {
                      $ref: '#/components/schemas/Purchase';
                    };
                    time: {
                      type: 'string';
                      format: 'date-time';
                    };
                  };
                  required: ['Purchase', 'time'];
                };
              };
            };
          };
        };
      };
    };
    '/journalentry/{id}': {
      get: {
        operationId: 'getJournalEntry';
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
                    JournalEntry: {
                      $ref: '#/components/schemas/JournalEntry';
                    };
                    time: {
                      type: 'string';
                      format: 'date-time';
                    };
                  };
                  required: ['JournalEntry', 'time'];
                };
              };
            };
          };
        };
      };
    };
    '/invoice/{id}': {
      get: {
        operationId: 'getInvoice';
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
                    Invoice: {
                      $ref: '#/components/schemas/Invoice';
                    };
                    time: {
                      type: 'string';
                      format: 'date-time';
                    };
                  };
                  required: ['Invoice', 'time'];
                };
              };
            };
          };
        };
      };
    };
    '/payment/{id}': {
      get: {
        operationId: 'getPayment';
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
                    Payment: {
                      $ref: '#/components/schemas/Payment';
                    };
                    time: {
                      type: 'string';
                      format: 'date-time';
                    };
                  };
                  required: ['Payment', 'time'];
                };
              };
            };
          };
        };
      };
    };
    '/bill/{id}': {
      get: {
        operationId: 'getBill';
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
                    Bill: {};
                    time: {
                      type: 'string';
                      format: 'date-time';
                    };
                  };
                  required: ['time'];
                };
              };
            };
          };
        };
      };
    };
    '/billpayment/{id}': {
      get: {
        operationId: 'getBillPayment';
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
                    BillPayment: {};
                    time: {
                      type: 'string';
                      format: 'date-time';
                    };
                  };
                  required: ['time'];
                };
              };
            };
          };
        };
      };
    };
    '/creditmemo/{id}': {
      get: {
        operationId: 'getCreditMemo';
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
                    CreditMemo: {};
                    time: {
                      type: 'string';
                      format: 'date-time';
                    };
                  };
                  required: ['time'];
                };
              };
            };
          };
        };
      };
    };
    '/deposit/{id}': {
      get: {
        operationId: 'getDeposit';
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
                    Deposit: {
                      $ref: '#/components/schemas/Deposit';
                    };
                    time: {
                      type: 'string';
                      format: 'date-time';
                    };
                  };
                  required: ['Deposit', 'time'];
                };
              };
            };
          };
        };
      };
    };
    '/transfer/{id}': {
      get: {
        operationId: 'getTransfer';
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
                    Transfer: {};
                    time: {
                      type: 'string';
                      format: 'date-time';
                    };
                  };
                  required: ['time'];
                };
              };
            };
          };
        };
      };
    };
    '/vendor/{id}': {
      get: {
        operationId: 'getVendor';
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
                    Vendor: {
                      $ref: '#/components/schemas/Vendor';
                    };
                    time: {
                      type: 'string';
                      format: 'date-time';
                    };
                  };
                  required: ['Vendor', 'time'];
                };
              };
            };
          };
        };
      };
    };
    '/customer/{id}': {
      get: {
        operationId: 'getCustomer';
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
                    Customer: {};
                    time: {
                      type: 'string';
                      format: 'date-time';
                    };
                  };
                  required: ['time'];
                };
              };
            };
          };
        };
      };
    };
    '/item/{id}': {
      get: {
        operationId: 'getItem';
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
                    Item: {};
                    time: {
                      type: 'string';
                      format: 'date-time';
                    };
                  };
                  required: ['time'];
                };
              };
            };
          };
        };
      };
    };
    '/companyinfo/{id}': {
      get: {
        operationId: 'getCompanyInfo';
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
                    CompanyInfo: {
                      $ref: '#/components/schemas/CompanyInfo';
                    };
                    time: {
                      type: 'string';
                      format: 'date-time';
                    };
                  };
                  required: ['CompanyInfo', 'time'];
                };
              };
            };
          };
        };
      };
    };
    '/query': {
      get: {
        operationId: 'query';
        parameters: [
          {
            in: 'query';
            name: 'query';
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
                    QueryResponse: {
                      $ref: '#/components/schemas/QueryResponse';
                    };
                    time: {
                      type: 'string';
                    };
                  };
                  required: ['QueryResponse', 'time'];
                };
              };
            };
          };
        };
      };
    };
    '/preferences': {
      get: {
        operationId: 'getPreferences';
        requestBody: {
          content: {
            'application/json': {};
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {};
              };
            };
          };
        };
      };
    };
    '/reports/TransactionList': {
      get: {
        operationId: 'getTransactionList';
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
                  $ref: '#/components/schemas/Report';
                };
              };
            };
          };
        };
      };
    };
    '/cdc': {
      get: {
        operationId: 'cdc';
        parameters: [
          {
            in: 'query';
            name: 'changedSince';
            schema: {
              type: 'string';
            };
            required: true;
          },
          {
            in: 'query';
            name: 'entities';
            schema: {
              type: 'string';
              description: 'Comma separated list of entity names';
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
                  $ref: '#/components/schemas/CDCPayload';
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
      oauth2: {
        type: 'oauth2';
        name: 'authorization';
        in: 'header';
      };
    };
    schemas: {
      EntityName: {
        type: 'string';
        enum: [
          'Account',
          'Purchase',
          'JournalEntry',
          'Invoice',
          'Payment',
          'Bill',
          'BillPayment',
          'CreditMemo',
          'Deposit',
          'Transfer',
          'Vendor',
          'Customer',
          'Item',
          'CompanyInfo',
        ];
      };
      Account: {
        type: 'object';
        properties: {
          Id: {
            type: 'string';
          };
          domain: {
            type: 'string';
          };
          status: {
            type: 'string';
            enum: ['deleted'];
          };
          Metadata: {
            type: 'object';
            properties: {
              CreateTime: {
                type: 'string';
              };
              LastUpdatedTime: {
                type: 'string';
              };
            };
            required: ['CreateTime', 'LastUpdatedTime'];
          };
          AccountSubType: {
            type: 'string';
          };
          AccountType: {
            type: 'string';
          };
          Active: {
            type: 'boolean';
          };
          Classification: {
            anyOf: [
              {
                type: 'string';
                enum: ['Asset'];
              },
              {
                type: 'string';
                enum: ['Equity'];
              },
              {
                type: 'string';
                enum: ['Expense'];
              },
              {
                type: 'string';
                enum: ['Liability'];
              },
              {
                type: 'string';
                enum: ['Revenue'];
              },
            ];
          };
          CurrencyRef: {
            type: 'object';
            properties: {
              name: {
                type: 'string';
              };
              value: {
                type: 'string';
              };
            };
            required: ['name', 'value'];
          };
          CurrentBalance: {
            type: 'number';
          };
          CurrentBalanceWithSubAccounts: {
            type: 'number';
          };
          FullyQualifiedName: {
            type: 'string';
          };
          Name: {
            type: 'string';
          };
          SubAccount: {
            type: 'boolean';
          };
          SyncToken: {
            type: 'string';
          };
          sparse: {
            type: 'boolean';
          };
        };
        required: [
          'Id',
          'domain',
          'Metadata',
          'AccountSubType',
          'AccountType',
          'Active',
          'Classification',
          'CurrencyRef',
          'CurrentBalance',
          'CurrentBalanceWithSubAccounts',
          'FullyQualifiedName',
          'Name',
          'SubAccount',
          'SyncToken',
          'sparse',
        ];
      };
      Purchase: {
        type: 'object';
        properties: {
          Id: {
            type: 'string';
          };
          domain: {
            type: 'string';
          };
          status: {
            type: 'string';
            enum: ['deleted'];
          };
          Metadata: {
            type: 'object';
            properties: {
              CreateTime: {
                type: 'string';
              };
              LastUpdatedTime: {
                type: 'string';
              };
            };
            required: ['CreateTime', 'LastUpdatedTime'];
          };
          AccountRef: {
            type: 'object';
            properties: {
              value: {
                type: 'string';
              };
              name: {
                type: 'string';
              };
            };
            required: ['value', 'name'];
          };
          PaymentMethodRef: {
            type: 'object';
            properties: {
              value: {
                type: 'string';
              };
            };
            required: ['value'];
          };
          PaymentType: {
            type: 'string';
          };
          EntityRef: {
            type: 'object';
            properties: {
              value: {
                type: 'string';
              };
              name: {
                type: 'string';
              };
              type: {
                type: 'string';
              };
            };
            required: ['value', 'name'];
          };
          Credit: {
            type: 'boolean';
          };
          TotalAmt: {
            type: 'number';
          };
          PurchaseEx: {
            type: 'object';
            properties: {
              any: {
                type: 'array';
                items: {
                  type: 'object';
                  properties: {
                    name: {
                      type: 'string';
                    };
                    declaredType: {
                      type: 'string';
                    };
                    scope: {
                      type: 'string';
                    };
                    value: {
                      type: 'object';
                      properties: {
                        Name: {
                          type: 'string';
                        };
                        Value: {
                          type: 'string';
                        };
                      };
                      required: ['Name', 'Value'];
                    };
                    nil: {
                      type: 'boolean';
                    };
                    globalScope: {
                      type: 'boolean';
                    };
                    typeSubstituted: {
                      type: 'boolean';
                    };
                  };
                  required: ['name', 'declaredType', 'scope', 'value', 'nil', 'globalScope', 'typeSubstituted'];
                };
              };
            };
            required: ['any'];
          };
          sparse: {
            type: 'boolean';
          };
          SyncToken: {
            type: 'string';
          };
          TxnDate: {
            type: 'string';
          };
          CurrencyRef: {
            type: 'object';
            properties: {
              name: {
                type: 'string';
              };
              value: {
                type: 'string';
              };
            };
            required: ['name', 'value'];
          };
          PrivateNote: {
            type: 'string';
          };
          Line: {
            type: 'array';
            items: {
              type: 'object';
              properties: {
                Id: {
                  type: 'string';
                };
                Description: {
                  type: 'string';
                };
                Amount: {
                  type: 'number';
                };
                DetailType: {
                  type: 'string';
                };
                AccountBasedExpenseLineDetail: {
                  type: 'object';
                  properties: {
                    AccountRef: {
                      type: 'object';
                      properties: {
                        value: {
                          type: 'string';
                        };
                        name: {
                          type: 'string';
                        };
                      };
                      required: ['value', 'name'];
                    };
                    BillableStatus: {
                      type: 'string';
                    };
                    TaxCodeRef: {
                      type: 'object';
                      properties: {
                        value: {
                          type: 'string';
                        };
                      };
                      required: ['value'];
                    };
                    CustomerRef: {
                      type: 'object';
                      properties: {
                        value: {
                          type: 'string';
                        };
                        name: {
                          type: 'string';
                        };
                      };
                      required: ['value', 'name'];
                    };
                  };
                  required: ['AccountRef', 'BillableStatus', 'TaxCodeRef'];
                };
              };
              required: ['Id', 'Description', 'Amount', 'DetailType'];
            };
          };
          DocNumber: {
            type: 'string';
          };
        };
        required: [
          'Id',
          'domain',
          'Metadata',
          'AccountRef',
          'PaymentType',
          'TotalAmt',
          'PurchaseEx',
          'sparse',
          'SyncToken',
          'TxnDate',
          'CurrencyRef',
          'PrivateNote',
          'Line',
        ];
      };
      JournalEntry: {
        type: 'object';
        properties: {
          Id: {
            type: 'string';
          };
          domain: {
            type: 'string';
          };
          status: {
            type: 'string';
            enum: ['deleted'];
          };
          Metadata: {
            type: 'object';
            properties: {
              CreateTime: {
                type: 'string';
              };
              LastUpdatedTime: {
                type: 'string';
              };
            };
            required: ['CreateTime', 'LastUpdatedTime'];
          };
          Adjustment: {
            type: 'boolean';
          };
          sparse: {
            type: 'boolean';
          };
          SyncToken: {
            type: 'string';
          };
          DocNumber: {
            type: 'string';
          };
          TxnDate: {
            type: 'string';
          };
          CurrencyRef: {
            type: 'object';
            properties: {
              name: {
                type: 'string';
              };
              value: {
                type: 'string';
              };
            };
            required: ['name', 'value'];
          };
          PrivateNote: {
            type: 'string';
          };
          Line: {
            type: 'array';
            items: {
              type: 'object';
              properties: {
                Id: {
                  type: 'string';
                };
                Description: {
                  type: 'string';
                };
                Amount: {
                  type: 'number';
                };
                DetailType: {
                  type: 'string';
                };
                JournalEntryLineDetail: {
                  type: 'object';
                  properties: {
                    PostingType: {
                      anyOf: [
                        {
                          type: 'string';
                          enum: ['Debit'];
                        },
                        {
                          type: 'string';
                          enum: ['Credit'];
                        },
                      ];
                    };
                    Entity: {
                      type: 'object';
                      properties: {
                        Type: {
                          type: 'string';
                        };
                        EntityRef: {
                          type: 'object';
                          properties: {
                            value: {
                              type: 'string';
                            };
                            name: {
                              type: 'string';
                            };
                            type: {
                              type: 'string';
                            };
                          };
                          required: ['value', 'name'];
                        };
                      };
                      required: ['Type', 'EntityRef'];
                    };
                    AccountRef: {
                      type: 'object';
                      properties: {
                        value: {
                          type: 'string';
                        };
                        name: {
                          type: 'string';
                        };
                      };
                      required: ['value', 'name'];
                    };
                  };
                  required: ['PostingType', 'AccountRef'];
                };
              };
              required: ['Id', 'Description', 'Amount', 'DetailType', 'JournalEntryLineDetail'];
            };
          };
        };
        required: [
          'Id',
          'domain',
          'Metadata',
          'Adjustment',
          'sparse',
          'SyncToken',
          'DocNumber',
          'TxnDate',
          'CurrencyRef',
          'Line',
        ];
      };
      Invoice: {
        type: 'object';
        properties: {
          Id: {
            type: 'string';
          };
          domain: {
            type: 'string';
          };
          status: {
            type: 'string';
            enum: ['deleted'];
          };
          Metadata: {
            type: 'object';
            properties: {
              CreateTime: {
                type: 'string';
              };
              LastUpdatedTime: {
                type: 'string';
              };
            };
            required: ['CreateTime', 'LastUpdatedTime'];
          };
          AllowIPNPayment: {
            type: 'boolean';
          };
          AllowOnlineACHPayment: {
            type: 'boolean';
          };
          AllowOnlineCreditCardPayment: {
            type: 'boolean';
          };
          AllowOnlinePayment: {
            type: 'boolean';
          };
          ApplyTaxAfterDiscount: {
            type: 'boolean';
          };
          Balance: {
            type: 'number';
          };
          CurrencyRef: {
            type: 'object';
            properties: {
              name: {
                type: 'string';
              };
              value: {
                type: 'string';
              };
            };
            required: ['name', 'value'];
          };
          CustomField: {
            type: 'array';
            items: {};
          };
          CustomerRef: {
            type: 'object';
            properties: {
              value: {
                type: 'string';
              };
              name: {
                type: 'string';
              };
            };
            required: ['value', 'name'];
          };
          Deposit: {
            type: 'number';
          };
          DocNumber: {
            type: 'string';
          };
          DueDate: {
            type: 'string';
          };
          EmailStatus: {
            type: 'string';
          };
          Line: {
            type: 'array';
            items: {
              type: 'object';
              properties: {
                Amount: {
                  type: 'number';
                };
                Description: {
                  type: 'string';
                };
                DetailType: {
                  type: 'string';
                };
                Id: {
                  type: 'string';
                };
                LineNum: {
                  type: 'number';
                };
                SalesItemLineDetail: {
                  type: 'object';
                  properties: {
                    ItemRef: {
                      type: 'object';
                      properties: {
                        name: {
                          type: 'string';
                        };
                        value: {
                          type: 'string';
                        };
                      };
                      required: ['name', 'value'];
                    };
                    Qty: {
                      type: 'number';
                    };
                    TaxCodeRef: {
                      type: 'object';
                      properties: {
                        value: {
                          type: 'string';
                        };
                      };
                      required: ['value'];
                    };
                  };
                  required: ['ItemRef', 'Qty', 'TaxCodeRef'];
                };
                SubTotalLineDetail: {
                  type: 'object';
                  properties: {};
                };
                DiscountLineDetail: {
                  type: 'object';
                  properties: {
                    DiscountAccountRef: {
                      type: 'object';
                      properties: {
                        name: {
                          type: 'string';
                        };
                        value: {
                          type: 'string';
                        };
                      };
                      required: ['name', 'value'];
                    };
                  };
                  required: ['DiscountAccountRef'];
                };
              };
              required: ['Amount', 'DetailType'];
            };
          };
          LinkedTxn: {
            type: 'array';
            items: {
              type: 'object';
              properties: {
                TxnId: {
                  type: 'string';
                };
                TxnType: {
                  type: 'string';
                };
              };
              required: ['TxnId', 'TxnType'];
            };
          };
          PrintStatus: {
            type: 'string';
          };
          PrivateNote: {
            type: 'string';
          };
          SyncToken: {
            type: 'string';
          };
          TotalAmt: {
            type: 'number';
          };
          TxnDate: {
            type: 'string';
          };
          sparse: {
            type: 'boolean';
          };
        };
        required: [
          'Id',
          'domain',
          'Metadata',
          'AllowIPNPayment',
          'AllowOnlineACHPayment',
          'AllowOnlineCreditCardPayment',
          'AllowOnlinePayment',
          'ApplyTaxAfterDiscount',
          'Balance',
          'CurrencyRef',
          'CustomField',
          'CustomerRef',
          'Deposit',
          'DocNumber',
          'DueDate',
          'EmailStatus',
          'Line',
          'LinkedTxn',
          'PrintStatus',
          'PrivateNote',
          'SyncToken',
          'TotalAmt',
          'TxnDate',
          'sparse',
        ];
      };
      Payment: {
        type: 'object';
        properties: {
          Id: {
            type: 'string';
          };
          domain: {
            type: 'string';
          };
          status: {
            type: 'string';
            enum: ['deleted'];
          };
          Metadata: {
            type: 'object';
            properties: {
              CreateTime: {
                type: 'string';
              };
              LastUpdatedTime: {
                type: 'string';
              };
            };
            required: ['CreateTime', 'LastUpdatedTime'];
          };
          CurrencyRef: {
            type: 'object';
            properties: {
              name: {
                type: 'string';
              };
              value: {
                type: 'string';
              };
            };
            required: ['name', 'value'];
          };
          CustomerRef: {
            type: 'object';
            properties: {
              value: {
                type: 'string';
              };
              name: {
                type: 'string';
              };
            };
            required: ['value', 'name'];
          };
          DepositToAccountRef: {
            type: 'object';
            properties: {
              value: {
                type: 'string';
              };
            };
            required: ['value'];
          };
          Line: {
            type: 'array';
            items: {
              type: 'object';
              properties: {
                Amount: {
                  type: 'number';
                };
                LineEx: {
                  type: 'object';
                  properties: {
                    any: {
                      type: 'array';
                      items: {
                        type: 'object';
                        properties: {
                          declaredType: {
                            type: 'string';
                          };
                          globalScope: {
                            type: 'boolean';
                          };
                          name: {
                            type: 'string';
                          };
                          nil: {
                            type: 'boolean';
                          };
                          scope: {
                            type: 'string';
                          };
                          typeSubstituted: {
                            type: 'boolean';
                          };
                          value: {
                            type: 'object';
                            properties: {
                              Name: {
                                type: 'string';
                              };
                              Value: {
                                type: 'string';
                              };
                            };
                            required: ['Name', 'Value'];
                          };
                        };
                        required: ['declaredType', 'globalScope', 'name', 'nil', 'scope', 'typeSubstituted', 'value'];
                      };
                    };
                  };
                  required: ['any'];
                };
                LinkedTxn: {
                  type: 'array';
                  items: {
                    type: 'object';
                    properties: {
                      TxnId: {
                        type: 'string';
                      };
                      TxnType: {
                        type: 'string';
                      };
                    };
                    required: ['TxnId', 'TxnType'];
                  };
                };
              };
              required: ['Amount', 'LineEx', 'LinkedTxn'];
            };
          };
          PrivateNote: {
            type: 'string';
          };
          ProcessPayment: {
            type: 'boolean';
          };
          SyncToken: {
            type: 'string';
          };
          TotalAmt: {
            type: 'number';
          };
          TxnDate: {
            type: 'string';
          };
          UnappliedAmt: {
            type: 'number';
          };
          sparse: {
            type: 'boolean';
          };
        };
        required: [
          'Id',
          'domain',
          'Metadata',
          'CurrencyRef',
          'CustomerRef',
          'Line',
          'PrivateNote',
          'ProcessPayment',
          'SyncToken',
          'TotalAmt',
          'TxnDate',
          'UnappliedAmt',
          'sparse',
        ];
      };
      Deposit: {
        type: 'object';
        properties: {
          Id: {
            type: 'string';
          };
          domain: {
            type: 'string';
          };
          status: {
            type: 'string';
            enum: ['deleted'];
          };
          Metadata: {
            type: 'object';
            properties: {
              CreateTime: {
                type: 'string';
              };
              LastUpdatedTime: {
                type: 'string';
              };
            };
            required: ['CreateTime', 'LastUpdatedTime'];
          };
          CurrencyRef: {
            type: 'object';
            properties: {
              name: {
                type: 'string';
              };
              value: {
                type: 'string';
              };
            };
            required: ['name', 'value'];
          };
          DepositToAccountRef: {
            type: 'object';
            properties: {
              name: {
                type: 'string';
              };
              value: {
                type: 'string';
              };
            };
            required: ['name', 'value'];
          };
          Line: {
            type: 'array';
            items: {
              type: 'object';
              properties: {
                Amount: {
                  type: 'number';
                };
                DepositLineDetail: {
                  type: 'object';
                  properties: {
                    AccountRef: {
                      type: 'object';
                      properties: {
                        value: {
                          type: 'string';
                        };
                        name: {
                          type: 'string';
                        };
                      };
                      required: ['value', 'name'];
                    };
                    Entity: {
                      type: 'object';
                      properties: {
                        Type: {
                          type: 'string';
                        };
                        EntityRef: {
                          type: 'object';
                          properties: {
                            value: {
                              type: 'string';
                            };
                            name: {
                              type: 'string';
                            };
                            type: {
                              type: 'string';
                            };
                          };
                          required: ['value', 'name'];
                        };
                      };
                      required: ['Type', 'EntityRef'];
                    };
                  };
                };
                Description: {
                  type: 'string';
                };
                DetailType: {
                  type: 'string';
                };
                Id: {
                  type: 'string';
                };
                LineNum: {
                  type: 'number';
                };
              };
              required: ['Amount', 'Description', 'DetailType', 'Id', 'LineNum'];
            };
          };
          PrivateNote: {
            type: 'string';
          };
          SyncToken: {
            type: 'string';
          };
          TotalAmt: {
            type: 'number';
          };
          TxnDate: {
            type: 'string';
          };
          sparse: {
            type: 'boolean';
          };
        };
        required: [
          'Id',
          'domain',
          'Metadata',
          'CurrencyRef',
          'DepositToAccountRef',
          'Line',
          'PrivateNote',
          'SyncToken',
          'TotalAmt',
          'TxnDate',
          'sparse',
        ];
      };
      Vendor: {
        type: 'object';
        properties: {
          Id: {
            type: 'string';
          };
          domain: {
            type: 'string';
          };
          status: {
            type: 'string';
            enum: ['deleted'];
          };
          Metadata: {
            type: 'object';
            properties: {
              CreateTime: {
                type: 'string';
              };
              LastUpdatedTime: {
                type: 'string';
              };
            };
            required: ['CreateTime', 'LastUpdatedTime'];
          };
          DisplayName: {
            type: 'string';
          };
          PrintOnCheckName: {
            type: 'string';
          };
        };
        required: ['Id', 'domain', 'Metadata', 'DisplayName'];
      };
      CompanyInfo: {
        type: 'object';
        properties: {
          CompanyName: {
            type: 'string';
          };
          LegalName: {
            type: 'string';
          };
          CompanyAddr: {
            type: 'object';
            properties: {
              Id: {
                type: 'string';
              };
              Line1: {
                type: 'string';
              };
              City: {
                type: 'string';
              };
              Country: {
                type: 'string';
              };
              CountrySubDivisionCode: {
                type: 'string';
              };
              PostalCode: {
                type: 'string';
              };
            };
            required: ['Id', 'Line1', 'City', 'Country', 'CountrySubDivisionCode', 'PostalCode'];
          };
          CustomerCommunicationAddr: {
            type: 'object';
            properties: {
              Id: {
                type: 'string';
              };
              Line1: {
                type: 'string';
              };
              City: {
                type: 'string';
              };
              Country: {
                type: 'string';
              };
              CountrySubDivisionCode: {
                type: 'string';
              };
              PostalCode: {
                type: 'string';
              };
            };
            required: ['Id', 'Line1', 'City', 'Country', 'CountrySubDivisionCode', 'PostalCode'];
          };
          LegalAddr: {
            type: 'object';
            properties: {
              Id: {
                type: 'string';
              };
              Line1: {
                type: 'string';
              };
              City: {
                type: 'string';
              };
              Country: {
                type: 'string';
              };
              CountrySubDivisionCode: {
                type: 'string';
              };
              PostalCode: {
                type: 'string';
              };
            };
            required: ['Id', 'Line1', 'City', 'Country', 'CountrySubDivisionCode', 'PostalCode'];
          };
          PrimaryPhone: {
            type: 'object';
            properties: {
              FreeFormNumber: {
                type: 'string';
              };
            };
            required: ['FreeFormNumber'];
          };
          CompanyStartDate: {
            type: 'string';
          };
          FiscalYearStartMonth: {
            type: 'string';
          };
          Country: {
            type: 'string';
          };
          Email: {
            type: 'object';
            properties: {
              Address: {
                type: 'string';
              };
            };
            required: ['Address'];
          };
          WebAddr: {
            type: 'object';
            properties: {};
          };
          SupportedLanguages: {
            type: 'string';
          };
          NameValue: {
            type: 'array';
            items: {
              type: 'object';
              properties: {
                Name: {
                  type: 'string';
                };
                Value: {
                  type: 'string';
                };
              };
              required: ['Name', 'Value'];
            };
          };
          domain: {
            type: 'string';
          };
          sparse: {
            type: 'boolean';
          };
          Id: {
            type: 'string';
          };
          SyncToken: {
            type: 'string';
          };
          MetaData: {
            type: 'object';
            properties: {
              CreateTime: {
                type: 'string';
              };
              LastUpdatedTime: {
                type: 'string';
              };
            };
            required: ['CreateTime', 'LastUpdatedTime'];
          };
        };
        required: [
          'CompanyName',
          'LegalName',
          'CompanyAddr',
          'CustomerCommunicationAddr',
          'LegalAddr',
          'PrimaryPhone',
          'CompanyStartDate',
          'FiscalYearStartMonth',
          'Country',
          'Email',
          'WebAddr',
          'SupportedLanguages',
          'NameValue',
          'domain',
          'sparse',
          'Id',
          'SyncToken',
          'MetaData',
        ];
      };
      QueryResponse: {
        type: 'object';
        properties: {
          CompanyInfo: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/CompanyInfo';
            };
          };
          Account: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/Account';
            };
          };
          JournalEntry: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/JournalEntry';
            };
          };
          Purchase: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/Purchase';
            };
          };
          Deposit: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/Deposit';
            };
          };
          Payment: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/Payment';
            };
          };
          Invoice: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/Invoice';
            };
          };
          Vendor: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/Vendor';
            };
          };
          Bill: {
            type: 'array';
            items: {};
          };
          BillPayment: {
            type: 'array';
            items: {};
          };
          CreditMemo: {
            type: 'array';
            items: {};
          };
          Transfer: {
            type: 'array';
            items: {};
          };
          Customer: {
            type: 'array';
            items: {};
          };
          Item: {
            type: 'array';
            items: {};
          };
          maxResults: {
            type: 'number';
          };
          startPosition: {
            type: 'number';
          };
          totalCount: {
            type: 'number';
          };
        };
        required: ['maxResults', 'startPosition'];
      };
      Report: {
        type: 'object';
        properties: {
          Header: {
            type: 'object';
            properties: {
              Time: {
                type: 'string';
              };
              ReportName: {
                type: 'string';
              };
              DateMacro: {
                type: 'string';
              };
              StartPeriod: {
                type: 'string';
              };
              EndPeriod: {
                type: 'string';
              };
              Currency: {
                type: 'string';
              };
              Option: {
                type: 'array';
                items: {
                  type: 'object';
                  properties: {
                    Name: {
                      type: 'string';
                    };
                    Value: {
                      type: 'string';
                    };
                  };
                  required: ['Name', 'Value'];
                };
              };
            };
            required: ['Time', 'ReportName', 'DateMacro', 'StartPeriod', 'EndPeriod', 'Currency', 'Option'];
          };
          Columns: {
            type: 'object';
            properties: {
              Column: {
                type: 'array';
                items: {
                  type: 'object';
                  properties: {
                    ColTitle: {
                      type: 'string';
                    };
                    ColType: {
                      type: 'string';
                    };
                  };
                  required: ['ColTitle', 'ColType'];
                };
              };
            };
            required: ['Column'];
          };
          Rows: {
            type: 'array';
            items: {
              type: 'object';
              properties: {
                Row: {
                  type: 'array';
                  items: {
                    type: 'object';
                    properties: {
                      ColData: {
                        type: 'array';
                        items: {
                          type: 'object';
                          properties: {
                            value: {
                              type: 'string';
                            };
                            id: {
                              type: 'string';
                            };
                          };
                          required: ['value'];
                        };
                      };
                      type: {
                        type: 'string';
                      };
                    };
                    required: ['ColData', 'type'];
                  };
                };
              };
              required: ['Row'];
            };
          };
        };
        required: ['Header', 'Columns', 'Rows'];
      };
      CDCPayload: {
        type: 'object';
        properties: {
          CDCResponse: {
            type: 'array';
            items: {
              type: 'object';
              properties: {
                QueryResponse: {
                  type: 'array';
                  items: {
                    $ref: '#/components/schemas/QueryResponse';
                  };
                };
              };
              required: ['QueryResponse'];
            };
          };
          time: {
            type: 'string';
          };
        };
        required: ['CDCResponse', 'time'];
      };
    };
  };
};
