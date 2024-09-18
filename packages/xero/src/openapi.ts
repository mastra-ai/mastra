// @ts-nocheck
export type openapi = {
  openapi: '3.0.0';
  servers: [
    {
      description: 'The Xero Accounting API exposes accounting and related functions of the main Xero application and can be used for a variety of purposes such as creating transactions like invoices and credit notes, right through to extracting accounting data via our reports endpoint.';
      url: 'https://api.xero.com/api.xro/2.0';
    },
  ];
  'x-hasEquivalentPaths': true;
  paths: {
    '/Accounts': {
      get: {
        operationId: 'getAccounts';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter by an any element';
            example: 'Status==&quot;ACTIVE&quot; AND Type==&quot;BANK&quot;';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-java': 'Status==&quot;&apos; + Account.StatusEnum.ACTIVE+ &apos;&quot;';
            'x-example-php': 'Status==&quot;&apos; . \\XeroAPI\\XeroPHP\\Models\\Accounting\\Account::STATUS_ACTIVE . &apos;&quot;';
            'x-ruby-param': 'Status==#{XeroRuby::Accounting::Account::ACTIVE}';
          },
          {
            description: 'Order by an any element';
            example: 'Name ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Accounts": [{ "AccountID": "ebd06280-af70-4bed-97c6-7451a454ad85", "Code": "091", "Name": "Business Savings Account", "Type": "BANK", "TaxType": "NONE", "EnablePaymentsToAccount": false, "BankAccountNumber": "0209087654321050", "BankAccountType": "BANK", "CurrencyCode": "NZD" },{ "AccountID": "7d05a53d-613d-4eb2-a2fc-dcb6adb80b80", "Code": "200", "Name": "Sales", "Type": "REVENUE", "TaxType": "OUTPUT2", "Description": "Income from any normal business activity", "EnablePaymentsToAccount": false }] }';
                schema: {
                  $ref: '#/components/schemas/Accounts';
                };
              };
            };
            description: 'Success - return response of type Accounts array with 0 to n Account';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Retrieves the full chart of accounts';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
          type: 'string';
        },
      ];
      put: {
        operationId: 'createAccount';
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Code":"123456", "Name":"Foobar", "Type":"EXPENSE", "Description":"Hello World" }';
              schema: {
                $ref: '#/components/schemas/Account';
              };
            };
          };
          description: 'Account object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "11814c9d-3b5e-492e-93b0-fad16bf3244f", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550793549392)\\/", "Accounts": [ { "AccountID": "66b262e2-561e-423e-8937-47d558f13442", "Code": "123456", "Name": "Foobar", "Status": "ACTIVE", "Type": "EXPENSE", "TaxType": "INPUT", "Description": "Hello World", "Class": "EXPENSE", "EnablePaymentsToAccount": false, "ShowInExpenseClaims": false, "ReportingCode": "EXP", "ReportingCodeName": "Expense", "UpdatedDateUTC": "\\/Date(1550793549320+0000)\\/" } ] }';
                schema: {
                  $ref: '#/components/schemas/Accounts';
                };
              };
            };
            description: 'Success - created new Account and return response of type Accounts array with new Account';
          };
          '400': {
            content: {
              'application/json': {
                example: '{ "ErrorNumber": 10, "Type": "ValidationException", "Message": "A validation exception occurred", "Elements": [ { "AccountID": "00000000-0000-0000-0000-000000000000", "Code": "123456", "Name": "Foobar", "Type": "EXPENSE", "Description": "Hello World", "ValidationErrors": [ { "Message": "Please enter a unique Name." } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Error';
                };
              };
            };
            description: 'Validation Error - some data was incorrect returns response of type Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Creates a new chart of accounts';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            key: 'account';
            keyPascal: 'Account';
            object: null;
          },
          {
            code: null;
            default: 123456;
            key: 'code';
            keyPascal: 'Code';
            object: 'account';
          },
          {
            default: 'FooBar';
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'account';
          },
          {
            csharp: 'Account.ClassEnum.EXPENSE';
            default: 'EXPENSE';
            java: 'com.xero.models.accounting.AccountType.EXPENSE';
            key: 'type';
            keyPascal: 'Type';
            node: 'AccountType.EXPENSE';
            nonString: true;
            object: 'account';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\AccountType::EXPENSE';
            python: 'AccountType.EXPENSE';
            ruby: 'XeroRuby::Accounting::AccountType::EXPENSE';
            type: null;
          },
          {
            default: 'Hello World';
            description: null;
            is_last: true;
            key: 'description';
            keyPascal: 'Description';
            object: 'account';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ code: "123456", name: "Foobar", type: AccountType.EXPENSE, description: "Hello World" }';
        'x-ruby-requestBody': 'account = { code: "123456", name: "Foobar", type: XeroRuby::Accounting::AccountType::EXPENSE, description: "Hello World" }';
      };
    };
    '/Accounts/{AccountID}': {
      delete: {
        operationId: 'deleteAccount';
        parameters: [
          {
            description: 'Unique identifier for retrieving single object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AccountID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "76bb0543-8efe-4acc-b7f6-67dfcdec37b4", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550798217216)\\/", "Accounts": [ { "AccountID": "7f3c0bec-f3e7-4073-b4d6-cc56dd027ef1", "Code": "123456", "Name": "FooBar", "Status": "DELETED", "Type": "EXPENSE", "TaxType": "INPUT", "Description": "Hello World", "Class": "EXPENSE", "EnablePaymentsToAccount": false, "ShowInExpenseClaims": false, "ReportingCode": "EXP", "ReportingCodeName": "Expense", "UpdatedDateUTC": "\\/Date(1550798217210+0000)\\/" } ] }';
                schema: {
                  $ref: '#/components/schemas/Accounts';
                };
              };
            };
            description: 'Success - delete existing Account and return response of type Accounts array with deleted Account';
          };
          '400': {
            content: {
              'application/json': {
                example: '{ "ErrorNumber": 10, "Type": "ValidationException", "Message": "A validation exception occurred", "Elements": [ { "AccountID": "00000000-0000-0000-0000-000000000000", "Code": "123456", "Name": "Foobar", "Type": "EXPENSE", "Description": "Hello World", "ValidationErrors": [ { "Message": "Please enter a unique Name." } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Error';
                };
              };
            };
            description: 'Validation Error - some data was incorrect returns response of type Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Deletes a chart of accounts';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
      get: {
        operationId: 'getAccount';
        parameters: [
          {
            description: 'Unique identifier for retrieving single object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AccountID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "323455cc-9511-4451-a873-248d2983f38e", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550797359081)\\/", "Accounts": [ { "AccountID": "99ce6032-0678-4aa0-8148-240c75fee33a", "Code": "123456", "Name": "FooBar", "Status": "ACTIVE", "Type": "EXPENSE", "TaxType": "INPUT", "Description": "Hello World", "Class": "EXPENSE", "EnablePaymentsToAccount": false, "ShowInExpenseClaims": false, "ReportingCode": "EXP", "ReportingCodeName": "Expense", "UpdatedDateUTC": "\\/Date(1550797359120+0000)\\/" } ] }';
                schema: {
                  $ref: '#/components/schemas/Accounts';
                };
              };
            };
            description: 'Success - return response of type Accounts array with one Account';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Retrieves a single chart of accounts by using a unique account Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateAccount';
        parameters: [
          {
            description: 'Unique identifier for retrieving single object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AccountID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{   "Accounts":[   {   "Code":"123456", "Name":"BarFoo", "AccountID":"99ce6032-0678-4aa0-8148-240c75fee33a", "Type":"EXPENSE", "Description":"GoodBye World", "TaxType":"INPUT", "EnablePaymentsToAccount":false, "ShowInExpenseClaims":false, "Class":"EXPENSE", "ReportingCode":"EXP", "ReportingCodeName":"Expense", "UpdatedDateUTC":"2019-02-21T16:29:47.96-08:00" } ] }';
              schema: {
                $ref: '#/components/schemas/Accounts';
              };
            };
          };
          description: 'Request of type Accounts array with one Account';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "9012e75c-ec08-40a9-ae15-153fc1f35c4d", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550795389340)\\/", "Accounts": [ { "AccountID": "99ce6032-0678-4aa0-8148-240c75fee33a", "Code": "654321", "Name": "BarFoo", "Status": "ACTIVE", "Type": "EXPENSE", "TaxType": "INPUT", "Description": "Good Bye World", "Class": "EXPENSE", "EnablePaymentsToAccount": false, "ShowInExpenseClaims": false, "ReportingCode": "EXP", "ReportingCodeName": "Expense", "UpdatedDateUTC": "\\/Date(1550795389333+0000)\\/" } ] }';
                schema: {
                  $ref: '#/components/schemas/Accounts';
                };
              };
            };
            description: 'Success - update existing Account and return response of type Accounts array with updated Account';
          };
          '400': {
            content: {
              'application/json': {
                example: '{ "ErrorNumber": 10, "Type": "ValidationException", "Message": "A validation exception occurred", "Elements": [ { "AccountID": "00000000-0000-0000-0000-000000000000", "Code": "123456", "Name": "Foobar", "Type": "EXPENSE", "Description": "Hello World", "ValidationErrors": [ { "Message": "Please enter a unique Name." } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Error';
                };
              };
            };
            description: 'Validation Error - some data was incorrect returns response of type Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Updates a chart of accounts';
        tags: ['Accounting'];
        'x-example': [
          {
            account: null;
            is_object: true;
            key: 'account';
            keyPascal: 'Account';
          },
          {
            code: null;
            default: 123456;
            key: 'code';
            keyPascal: 'Code';
            object: 'account';
          },
          {
            default: 'BarFoo';
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'account';
          },
          {
            csharp: 'Account.ClassEnum.EXPENSE';
            default: 'EXPENSE';
            java: 'com.xero.models.accounting.AccountType.EXPENSE';
            key: 'type';
            keyPascal: 'Type';
            node: 'AccountType.EXPENSE';
            nonString: true;
            object: 'account';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\AccountType::EXPENSE';
            python: 'AccountType.EXPENSE';
            ruby: 'XeroRuby::Accounting::AccountType::EXPENSE';
            type: null;
          },
          {
            default: 'Hello World';
            description: null;
            key: 'description';
            keyPascal: 'Description';
            object: 'account';
          },
          {
            default: 'NONE';
            is_last: true;
            key: 'taxType';
            keyPascal: 'TaxType';
            keySnake: 'tax_type';
            object: 'account';
            taxType: null;
          },
          {
            accounts: null;
            is_object: true;
            key: 'accounts';
            keyPascal: 'Accounts';
          },
          {
            accounts: null;
            is_array_add: true;
            is_last: true;
            java: 'Accounts';
            key: 'accounts';
            keyPascal: 'Accounts';
            object: 'account';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ accounts: [{ code: "123456", name: "BarFoo", accountID: "00000000-0000-0000-0000-000000000000", type: AccountType.EXPENSE, description: "GoodBye World", taxType: TaxType.INPUT }]}';
        'x-ruby-requestBody': '{ accounts: [{ code: "123456", name: "BarFoo", account_id: "00000000-0000-0000-0000-000000000000", type: XeroRuby::Accounting::Account::EXPENSE, description: "GoodBye World", tax_type: XeroRuby::Accounting::TaxType::NONE }]}';
      };
    };
    '/Accounts/{AccountID}/Attachments': {
      get: {
        operationId: 'getAccountAttachments';
        parameters: [
          {
            description: 'Unique identifier for Account object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AccountID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "439c1573-3cd8-4697-a9f6-81fa651ee8f3", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550852630329)\\/", "Attachments": [ { "AttachmentID": "52a643be-cd5c-489f-9778-53a9fd337756", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/Accounts/da962997-a8bd-4dff-9616-01cdc199283f/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array of Attachment';
            'x-isAttachment': true;
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves attachments for a specific accounts by using a unique account Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Accounts/{AccountID}/Attachments/{AttachmentID}': {
      get: {
        operationId: 'getAccountAttachmentById';
        parameters: [
          {
            description: 'Unique identifier for Account object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AccountID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Unique identifier for Attachment object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AttachmentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Account as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves a specific attachment from a specific account using a unique attachment Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Accounts/{AccountID}/Attachments/{FileName}': {
      get: {
        operationId: 'getAccountAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for Account object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AccountID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name of the attachment';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Account as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves an attachment for a specific account by filename';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateAccountAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for Account object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AccountID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name of the attachment';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "c8d6413a-1da2-4faa-9848-21f60443e906", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550859714477)\\/", "Attachments": [ { "AttachmentID": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/Accounts/da962997-a8bd-4dff-9616-01cdc199283f/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array of Attachment';
            'x-isAttachment': true;
          };
          '400': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error';
                };
              };
            };
            description: 'Validation Error - some data was incorrect returns response of type Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Updates attachment on a specific account by filename';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
      put: {
        operationId: 'createAccountAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for Account object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AccountID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name of the attachment';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "724cdff5-bcd1-4c5c-977e-e864c24258e0", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550856817769)\\/", "Attachments": [ { "AttachmentID": "ab95b276-9dce-4925-9077-439818ba270f", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/Accounts/da962997-a8bd-4dff-9616-01cdc199283f/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array of Attachment';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Creates an attachment on a specific account';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
    };
    '/BankTransactions': {
      get: {
        operationId: 'getBankTransactions';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter by an any element';
            example: 'Status=="AUTHORISED"';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-java': 'Status==&quot;&apos; + BankTransaction.StatusEnum.AUTHORISED + &apos;&quot;';
            'x-example-php': 'Status==&quot;&apos; . XeroAPI\\XeroPHP\\Models\\Accounting\\BankTransaction::STATUS_AUTHORISED . &apos;&quot;';
            'x-ruby-param': 'Status==#{XeroRuby::Accounting::BankTransaction::AUTHORISED}';
          },
          {
            description: 'Order by an any element';
            example: 'Type ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Up to 100 bank transactions will be returned in a single API call with line items details';
            example: 1;
            in: 'query';
            name: 'page';
            schema: {
              type: 'integer';
            };
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "18e7e80c-5dca-4a57-974e-8b572cc5efe8", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "/Date(1551212901659)/", "BankTransactions": [ { "BankTransactionID": "db54aab0-ad40-4ced-bcff-0940ba20db2c", "BankAccount": { "AccountID": "6f7594f2-f059-4d56-9e67-47ac9733bfe9", "Code": "088", "Name": "Business Wells Fargo" }, "BatchPayment": { "Account": { "AccountID": "6f7594f2-f059-4d56-9e67-47ac9733bfe9" }, "BatchPaymentID": "b54aa50c-794c-461b-89d1-846e1b84d9c0", "Date": "/Date(1476316800000+0000)/", "Type": "RECBATCH", "Status": "AUTHORISED", "TotalAmount": "12.00", "UpdatedDateUTC": "/Date(1476392487037+0000)/", "IsReconciled": "false" }, "Type": "RECEIVE", "IsReconciled": false, "PrepaymentID": "cb62750f-b49c-464b-a45b-e2e2c514c8a9", "HasAttachments": true, "Contact": { "ContactID": "9c2c64de-12c9-4167-b503-e2c0e1aa1f49", "Name": "sam", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2016-10-13T00:00:00", "Date": "/Date(1476316800000+0000)/", "Status": "AUTHORISED", "LineAmountTypes": "Exclusive", "LineItems": [], "SubTotal": 10, "TotalTax": 0, "Total": 10, "UpdatedDateUTC": "/Date(1476389616437+0000)/", "CurrencyCode": "USD" }, { "BankTransactionID": "29a69c45-64ca-4805-a1cc-34990de837b3", "BankAccount": { "AccountID": "6f7594f2-f059-4d56-9e67-47ac9733bfe9", "Code": "088", "Name": "Business Wells Fargo" }, "Type": "SPEND-OVERPAYMENT", "IsReconciled": false, "OverpaymentID": "7d457db3-3b0a-47e9-8b79-81252a7bcdcb", "HasAttachments": false, "Contact": { "ContactID": "9c2c64de-12c9-4167-b503-e2c0e1aa1f49", "Name": "sam", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2016-10-13T00:00:00", "Date": "/Date(1476316800000+0000)/", "Status": "AUTHORISED", "LineAmountTypes": "NoTax", "LineItems": [], "SubTotal": 9, "TotalTax": 0, "Total": 9, "UpdatedDateUTC": "/Date(1476389930500+0000)/", "CurrencyCode": "USD" }, { "BankTransactionID": "0b89bf5c-d40b-4514-96be-36a739fb0188", "BankAccount": { "AccountID": "6f7594f2-f059-4d56-9e67-47ac9733bfe9", "Code": "088", "Name": "Business Wells Fargo" }, "Type": "SPEND-OVERPAYMENT", "IsReconciled": false, "OverpaymentID": "bf9b5f33-c0d6-4182-84a2-40848023e5a1", "HasAttachments": false, "Contact": { "ContactID": "9c2c64de-12c9-4167-b503-e2c0e1aa1f49", "Name": "sam", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2016-10-13T00:00:00", "Date": "/Date(1476316800000+0000)/", "Status": "AUTHORISED", "LineAmountTypes": "NoTax", "LineItems": [], "SubTotal": 8, "TotalTax": 0, "Total": 8, "UpdatedDateUTC": "/Date(1476392487037+0000)/", "CurrencyCode": "USD" } ] }';
                schema: {
                  $ref: '#/components/schemas/BankTransactions';
                };
              };
            };
            description: 'Success - return response of type BankTransactions array with 0 to n BankTransaction';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves any spent or received money transactions';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateOrCreateBankTransactions';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "BankTransactions": [ { "Type": "SPEND", "Contact": { "ContactID": "00000000-0000-0000-0000-000000000000" }, "Lineitems": [ { "Description": "Foobar", "Quantity": 1, "UnitAmount": 20, "AccountCode": "400" } ], "BankAccount": { "Code": "088" } } ] }';
              schema: {
                $ref: '#/components/schemas/BankTransactions';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "5bc1d776-3c7f-4fe8-9b2d-09e747077a88", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551213568047)\\/", "BankTransactions": [ { "BankTransactionID": "1289c190-e46d-434b-9628-463ffdb52f00", "BankAccount": { "AccountID": "6f7594f2-f059-4d56-9e67-47ac9733bfe9", "Code": "088", "Name": "Business Wells Fargo" }, "Type": "SPEND", "Reference": "", "IsReconciled": false, "CurrencyRate": 1.000000, "Contact": { "ContactID": "5cc8cf28-567e-4d43-b287-687cfcaec47c", "ContactStatus": "ACTIVE", "Name": "Katherine Warren", "FirstName": "Katherine", "LastName": "Warren", "EmailAddress": "kat.warren@clampett.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "" }, { "AddressType": "POBOX", "AddressLine1": "", "AddressLine2": "", "AddressLine3": "", "AddressLine4": "", "City": "Palo Alto", "Region": "CA", "PostalCode": "94020", "Country": "United States" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "847-1294", "PhoneAreaCode": "(626)", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1503348544227+0000)\\/", "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-02-26T00:00:00", "Date": "\\/Date(1551139200000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "Inclusive", "LineItems": [ { "Description": "Foobar", "UnitAmount": 20.00, "TaxType": "TAX001", "TaxAmount": 1.74, "LineAmount": 20.00, "AccountCode": "400", "Tracking": [], "Quantity": 1.0000, "LineItemID": "d2a06879-da49-4d6c-83b5-72a93a523ec6", "ValidationErrors": [] } ], "SubTotal": 18.26, "TotalTax": 1.74, "Total": 20.00, "UpdatedDateUTC": "\\/Date(1551213567813+0000)\\/", "CurrencyCode": "USD", "StatusAttributeString": "ERROR", "ValidationErrors": [ { "Message": "The Contact must contain at least 1 of the following elements to identify the contact: Name, ContactID, ContactNumber" } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/BankTransactions';
                };
              };
            };
            description: 'Success - return response of type BankTransactions array with new BankTransaction';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Updates or creates one or more spent or received money transaction';
        tags: ['Accounting'];
        'x-example': [
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            contactID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'contactId';
            keyPascal: 'ContactID';
            keySnake: 'contact_id';
            object: 'contact';
          },
          {
            is_object: true;
            key: 'lineItem';
            keyPascal: 'LineItem';
            keySnake: 'line_item';
            lineItem: null;
          },
          {
            default: 'Foobar';
            description: null;
            key: 'description';
            keyPascal: 'Description';
            object: 'lineItem';
          },
          {
            default: 1;
            key: 'quantity';
            keyPascal: 'Quantity';
            nonString: true;
            object: 'lineItem';
            quantity: null;
          },
          {
            default: 20;
            key: 'unitAmount';
            keyPascal: 'UnitAmount';
            keySnake: 'unit_amount';
            nonString: true;
            object: 'lineItem';
            unitAmount: null;
          },
          {
            accountCode: null;
            default: '000';
            is_last: true;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'lineItem';
          },
          {
            bankAccount: null;
            is_object: true;
            key: 'bankAccount';
            keyPascal: 'Account';
            keySnake: 'bank_account';
          },
          {
            accountID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'accountID';
            keyPascal: 'AccountID';
            keySnake: 'account_id';
            object: 'bankAccount';
          },
          {
            bankTransaction: null;
            is_object: true;
            key: 'bankTransaction';
            keyPascal: 'BankTransaction';
            keySnake: 'bank_transaction';
          },
          {
            csharp: 'BankTransaction.TypeEnum.RECEIVE';
            default: 'RECEIVE';
            java: 'com.xero.models.accounting.BankTransaction.TypeEnum.RECEIVE';
            key: 'type';
            keyPascal: 'Type';
            node: 'BankTransaction.TypeEnum.RECEIVE';
            nonString: true;
            object: 'bankTransaction';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\BankTransaction::TYPE_RECEIVE';
            python_string: 'RECEIVE';
            ruby: 'XeroRuby::Accounting::BankTransaction::RECEIVE';
            type: null;
          },
          {
            default: 'contact';
            is_variable: true;
            key: 'contact';
            keyPascal: 'Contact';
            nonString: true;
            object: 'bankTransaction';
            set_contact: null;
          },
          {
            add_lineitems: null;
            is_array_add: true;
            java: 'LineItems';
            key: 'bankTransaction';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            object: 'lineItem';
            python: 'line_item';
          },
          {
            default: 'bankAccount';
            is_last: true;
            is_variable: true;
            key: 'bankAccount';
            keyPascal: 'BankAccount';
            keySnake: 'bank_account';
            nonString: true;
            object: 'bankTransaction';
            python: 'bank_account';
            set_bankaccount: null;
          },
          {
            bankTransactions: null;
            is_object: true;
            key: 'bankTransactions';
            keyPascal: 'BankTransactions';
          },
          {
            add_bankTransaction: null;
            is_array_add: true;
            is_last: true;
            java: 'BankTransactions';
            key: 'bankTransactions';
            keyPascal: 'BankTransactions';
            keySnake: 'bank_transactions';
            object: 'bankTransaction';
            python: 'bank_transaction';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ bankTransactions: [{ type: BankTransaction.TypeEnum.SPEND, contact: { contactId: "00000000-0000-0000-0000-000000000000" }, lineItems: [{ description: "Foobar", quantity: 1.0, unitAmount: 20.0, accountCode: "000" }], bankAccount: { code: "000" }}]}';
        'x-ruby-requestBody': 'bank_transactions = { bank_transactions: [{ type: XeroRuby::Accounting::BankTransaction::SPEND, contact: { contact_id: "00000000-0000-0000-0000-000000000000" }, line_items: [{ description: "Foobar", quantity: 1.0, unit_amount: 20.0, account_code: "000" }], bank_account: { code: "000" }}]}';
      };
      put: {
        operationId: 'createBankTransactions';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ bankTransactions: [{ type: BankTransaction.TypeEnum.SPEND, contact: { contactID: "00000000-0000-0000-0000-000000000000" }, lineItems: [{ description: "Foobar", quantity: 1.0, unitAmount: 20.0, accountCode: "000" } ], bankAccount: { code: "000" }}]}';
              schema: {
                $ref: '#/components/schemas/BankTransactions';
              };
            };
          };
          description: 'BankTransactions with an array of BankTransaction objects in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "5bc1d776-3c7f-4fe8-9b2d-09e747077a88", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551213568047)\\/", "BankTransactions": [ { "BankTransactionID": "1289c190-e46d-434b-9628-463ffdb52f00", "BankAccount": { "AccountID": "6f7594f2-f059-4d56-9e67-47ac9733bfe9", "Code": "088", "Name": "Business Wells Fargo" }, "Type": "SPEND", "Reference": "", "IsReconciled": false, "CurrencyRate": 1.000000, "Contact": { "ContactID": "5cc8cf28-567e-4d43-b287-687cfcaec47c", "ContactStatus": "ACTIVE", "Name": "Katherine Warren", "FirstName": "Katherine", "LastName": "Warren", "EmailAddress": "kat.warren@clampett.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "" }, { "AddressType": "POBOX", "AddressLine1": "", "AddressLine2": "", "AddressLine3": "", "AddressLine4": "", "City": "Palo Alto", "Region": "CA", "PostalCode": "94020", "Country": "United States" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "847-1294", "PhoneAreaCode": "(626)", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1503348544227+0000)\\/", "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-02-26T00:00:00", "Date": "\\/Date(1551139200000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "Inclusive", "LineItems": [ { "Description": "Foobar", "UnitAmount": 20.00, "TaxType": "TAX001", "TaxAmount": 1.74, "LineAmount": 20.00, "AccountCode": "400", "Tracking": [], "Quantity": 1.0000, "LineItemID": "d2a06879-da49-4d6c-83b5-72a93a523ec6", "ValidationErrors": [] } ], "SubTotal": 18.26, "TotalTax": 1.74, "Total": 20.00, "UpdatedDateUTC": "\\/Date(1551213567813+0000)\\/", "CurrencyCode": "USD", "StatusAttributeString": "ERROR", "ValidationErrors": [ { "Message": "The Contact must contain at least 1 of the following elements to identify the contact: Name, ContactID, ContactNumber" } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/BankTransactions';
                };
              };
            };
            description: 'Success - return response of type BankTransactions array with new BankTransaction';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates one or more spent or received money transaction';
        tags: ['Accounting'];
        'x-example': [
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            contactID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'contactId';
            keyPascal: 'ContactID';
            keySnake: 'contact_id';
            object: 'contact';
          },
          {
            is_object: true;
            key: 'lineItem';
            keyPascal: 'LineItem';
            keySnake: 'line_item';
            lineItem: null;
          },
          {
            default: 'Foobar';
            description: null;
            key: 'description';
            keyPascal: 'Description';
            object: 'lineItem';
          },
          {
            default: 1;
            key: 'quantity';
            keyPascal: 'Quantity';
            nonString: true;
            object: 'lineItem';
            quantity: null;
          },
          {
            default: 20;
            key: 'unitAmount';
            keyPascal: 'UnitAmount';
            keySnake: 'unit_amount';
            nonString: true;
            object: 'lineItem';
            unitAmount: null;
          },
          {
            accountCode: null;
            default: '000';
            is_last: true;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'lineItem';
          },
          {
            bankAccount: null;
            is_object: true;
            key: 'bankAccount';
            keyPascal: 'Account';
            keySnake: 'bank_account';
          },
          {
            accountID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'accountID';
            keyPascal: 'AccountID';
            keySnake: 'account_id';
            object: 'bankAccount';
          },
          {
            bankTransaction: null;
            is_object: true;
            key: 'bankTransaction';
            keyPascal: 'BankTransaction';
            keySnake: 'bank_transaction';
          },
          {
            csharp: 'BankTransaction.TypeEnum.RECEIVE';
            default: 'RECEIVE';
            java: 'com.xero.models.accounting.BankTransaction.TypeEnum.RECEIVE';
            key: 'type';
            keyPascal: 'Type';
            node: 'BankTransaction.TypeEnum.RECEIVE';
            nonString: true;
            object: 'bankTransaction';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\BankTransaction::TYPE_RECEIVE';
            python_string: 'RECEIVE';
            ruby: 'XeroRuby::Accounting::BankTransaction::RECEIVE';
            type: null;
          },
          {
            default: 'contact';
            is_variable: true;
            key: 'contact';
            keyPascal: 'Contact';
            nonString: true;
            object: 'bankTransaction';
            set_contact: null;
          },
          {
            add_lineitems: null;
            is_array_add: true;
            java: 'LineItems';
            key: 'bankTransaction';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            object: 'lineItem';
            python: 'line_item';
          },
          {
            default: 'bankAccount';
            is_last: true;
            is_variable: true;
            key: 'bankAccount';
            keyPascal: 'BankAccount';
            keySnake: 'bank_account';
            nonString: true;
            object: 'bankTransaction';
            python: 'bank_account';
            set_bankaccount: null;
          },
          {
            bankTransactions: null;
            is_object: true;
            key: 'bankTransactions';
            keyPascal: 'BankTransactions';
          },
          {
            add_bankTransaction: null;
            is_array_add: true;
            is_last: true;
            java: 'BankTransactions';
            key: 'bankTransactions';
            keyPascal: 'BankTransactions';
            keySnake: 'bank_transactions';
            object: 'bankTransaction';
            python: 'bank_transaction';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ bankTransactions: [{ type: BankTransaction.TypeEnum.SPEND, contact: { contactID: "00000000-0000-0000-0000-000000000000" }, lineItems: [{ description: "Foobar", quantity: 1.0, unitAmount: 20.0, accountCode: "000" } ], bankAccount: { code: "000" }}]}';
        'x-ruby-requestBody': 'bank_transactions = { bank_transactions: [{ type: XeroRuby::Accounting::BankTransaction::SPEND, contact: { contact_id: "00000000-0000-0000-0000-000000000000" }, line_items: [{ description: "Foobar", quantity: 1.0, unit_amount: 20.0, account_code: "000" } ], bank_account: { code: "000" }}]}';
      };
    };
    '/BankTransactions/{BankTransactionID}': {
      get: {
        operationId: 'getBankTransaction';
        parameters: [
          {
            description: 'Xero generated unique identifier for a bank transaction';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BankTransactionID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "612e204d-21ab-469b-ac84-afe0697b4461", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551212902962)\\/", "BankTransactions": [ { "BankTransactionID": "db54aab0-ad40-4ced-bcff-0940ba20db2c", "BankAccount": { "AccountID": "6f7594f2-f059-4d56-9e67-47ac9733bfe9", "Code": "088", "Name": "Business Wells Fargo" }, "BatchPayment": { "Account": { "AccountID": "6f7594f2-f059-4d56-9e67-47ac9733bfe9" }, "BatchPaymentID": "b54aa50c-794c-461b-89d1-846e1b84d9c0", "Date": "\\/Date(1476316800000+0000)\\/", "Type": "RECBATCH", "Status": "AUTHORISED", "TotalAmount": "12.00", "UpdatedDateUTC": "\\/Date(1476392487037+0000)\\/", "IsReconciled": "false" }, "Type": "RECEIVE", "IsReconciled": false, "CurrencyRate": 1.000000, "PrepaymentID": "cb62750f-b49c-464b-a45b-e2e2c514c8a9", "HasAttachments": true, "Attachments": [ { "AttachmentID": "45dd3143-9856-42d2-9a6c-53814f67a33e", "FileName": "sample2.jpg", "Url": "https://api.xero.com/api.xro/2.0/banktransaction/db54aab0-ad40-4ced-bcff-0940ba20db2c/Attachments/sample2.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ], "Contact": { "ContactID": "9c2c64de-12c9-4167-b503-e2c0e1aa1f49", "ContactStatus": "ACTIVE", "Name": "sam", "EmailAddress": "", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "" }, { "AddressType": "POBOX", "City": "", "Region": "", "PostalCode": "", "Country": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1518821703467+0000)\\/", "ContactGroups": [], "DefaultCurrency": "USD", "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2016-10-13T00:00:00", "Date": "\\/Date(1476316800000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "hello", "UnitAmount": 10.00, "TaxType": "OUTPUT", "TaxAmount": 0.00, "LineAmount": 10.00, "AccountCode": "400", "Tracking": [], "Quantity": 1.0000, "LineItemID": "40bec527-a744-4149-96c5-0ab643b51158", "ValidationErrors": [] } ], "SubTotal": 10.00, "TotalTax": 0.00, "Total": 10.00, "UpdatedDateUTC": "\\/Date(1476389616437+0000)\\/", "CurrencyCode": "USD" } ] }';
                schema: {
                  $ref: '#/components/schemas/BankTransactions';
                };
              };
            };
            description: 'Success - return response of type BankTransactions array with a specific BankTransaction';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves a single spent or received money transaction by using a unique bank transaction Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateBankTransaction';
        parameters: [
          {
            description: 'Xero generated unique identifier for a bank transaction';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BankTransactionID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "BankTransactions": [ { "Type": "SPEND", "Contact": { "ContactID": "00000000-0000-0000-0000-000000000000", "ContactStatus": "ACTIVE", "Name": "Buzz Lightyear", "FirstName": "Buzz", "LastName": "Lightyear", "EmailAddress": "buzz.Lightyear@email.com", "ContactPersons": [], "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "" }, { "AddressType": "POBOX", "AddressLine1": "", "AddressLine2": "", "AddressLine3": "", "AddressLine4": "", "City": "Palo Alto", "Region": "CA", "PostalCode": "94020", "Country": "United States" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "847-1294", "PhoneAreaCode": "(626)", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "2017-08-21T13:49:04.227-07:00", "ContactGroups": [] }, "Lineitems": [], "BankAccount": { "Code": "088", "Name": "Business Wells Fargo", "AccountID": "00000000-0000-0000-0000-000000000000" }, "IsReconciled": false, "Date": "2019-02-25", "Reference": "You just updated", "CurrencyCode": "USD", "CurrencyRate": 1, "Status": "AUTHORISED", "LineAmountTypes": "Inclusive", "TotalTax": 1.74, "BankTransactionID": "00000000-0000-0000-0000-000000000000", "UpdatedDateUTC": "2019-02-26T12:39:27.813-08:00" } ] }';
              schema: {
                $ref: '#/components/schemas/BankTransactions';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "f2c7f037-96fc-49bd-8f59-d3c7bfdd4746", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551213568875)\\/", "BankTransactions": [ { "BankTransactionID": "1289c190-e46d-434b-9628-463ffdb52f00", "BankAccount": { "AccountID": "6f7594f2-f059-4d56-9e67-47ac9733bfe9", "Code": "088", "Name": "Business Wells Fargo" }, "Type": "SPEND", "Reference": "You just updated", "IsReconciled": false, "CurrencyRate": 1.000000, "HasAttachments": false, "Attachments": [], "Contact": { "ContactID": "5cc8cf28-567e-4d43-b287-687cfcaec47c", "ContactStatus": "ACTIVE", "Name": "Katherine Warren", "FirstName": "Katherine", "LastName": "Warren", "EmailAddress": "kat.warren@clampett.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "" }, { "AddressType": "POBOX", "AddressLine1": "", "AddressLine2": "", "AddressLine3": "", "AddressLine4": "", "City": "Palo Alto", "Region": "CA", "PostalCode": "94020", "Country": "United States" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "847-1294", "PhoneAreaCode": "(626)", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1503348544227+0000)\\/", "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-02-25T00:00:00", "Date": "\\/Date(1551052800000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "Inclusive", "LineItems": [ { "Description": "Foobar", "UnitAmount": 20.00, "TaxType": "TAX001", "TaxAmount": 1.74, "LineAmount": 20.00, "AccountCode": "400", "Tracking": [], "Quantity": 1.0000, "LineItemID": "d2a06879-da49-4d6c-83b5-72a93a523ec6", "ValidationErrors": [] } ], "SubTotal": 18.26, "TotalTax": 1.74, "Total": 20.00, "UpdatedDateUTC": "\\/Date(1551213568733+0000)\\/", "CurrencyCode": "USD" } ] }';
                schema: {
                  $ref: '#/components/schemas/BankTransactions';
                };
              };
            };
            description: 'Success - return response of type BankTransactions array with updated BankTransaction';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Updates a single spent or received money transaction';
        tags: ['Accounting'];
        'x-example': [
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            contactID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'contactId';
            keyPascal: 'ContactID';
            keySnake: 'contact_id';
            object: 'contact';
          },
          {
            is_object: true;
            key: 'lineItem';
            keyPascal: 'LineItem';
            keySnake: 'line_item';
            lineItem: null;
          },
          {
            default: 'Foobar';
            description: null;
            key: 'description';
            keyPascal: 'Description';
            object: 'lineItem';
          },
          {
            default: 1;
            key: 'quantity';
            keyPascal: 'Quantity';
            nonString: true;
            object: 'lineItem';
            quantity: null;
          },
          {
            default: 20;
            key: 'unitAmount';
            keyPascal: 'UnitAmount';
            keySnake: 'unit_amount';
            nonString: true;
            object: 'lineItem';
            unitAmount: null;
          },
          {
            accountCode: null;
            default: '000';
            is_last: true;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'lineItem';
          },
          {
            bankAccount: null;
            is_object: true;
            key: 'bankAccount';
            keyPascal: 'Account';
            keySnake: 'bank_account';
          },
          {
            accountID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'accountID';
            keyPascal: 'AccountID';
            keySnake: 'account_id';
            object: 'bankAccount';
          },
          {
            bankTransaction: null;
            is_object: true;
            key: 'bankTransaction';
            keyPascal: 'BankTransaction';
            keySnake: 'bank_transaction';
          },
          {
            default: 'You just updated';
            key: 'reference';
            keyPascal: 'Reference';
            object: 'bankTransaction';
            reference: null;
          },
          {
            csharp: 'BankTransaction.TypeEnum.RECEIVE';
            default: 'RECEIVE';
            java: 'com.xero.models.accounting.BankTransaction.TypeEnum.RECEIVE';
            key: 'type';
            keyPascal: 'Type';
            node: 'BankTransaction.TypeEnum.RECEIVE';
            nonString: true;
            object: 'bankTransaction';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\BankTransaction::TYPE_RECEIVE';
            python_string: 'RECEIVE';
            ruby: 'XeroRuby::Accounting::BankTransaction::RECEIVE';
            type: null;
          },
          {
            default: 'contact';
            is_variable: true;
            key: 'contact';
            keyPascal: 'Contact';
            nonString: true;
            object: 'bankTransaction';
            set_contact: null;
          },
          {
            add_lineitems: null;
            is_array_add: true;
            java: 'LineItems';
            key: 'bankTransaction';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            object: 'lineItem';
            python: 'line_item';
          },
          {
            default: 'bankAccount';
            is_last: true;
            is_variable: true;
            key: 'bankAccount';
            keyPascal: 'BankAccount';
            keySnake: 'bank_account';
            nonString: true;
            object: 'bankTransaction';
            python: 'bank_account';
            set_bankaccount: null;
          },
          {
            bankTransactions: null;
            is_object: true;
            key: 'bankTransactions';
            keyPascal: 'BankTransactions';
          },
          {
            add_bankTransaction: null;
            is_array_add: true;
            is_last: true;
            java: 'BankTransactions';
            key: 'bankTransactions';
            keyPascal: 'BankTransactions';
            keySnake: 'bank_transactions';
            object: 'bankTransaction';
            python: 'bank_transaction';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ bankTransactions: [{ type: BankTransaction.TypeEnum.SPEND, date: "2019-02-25", reference: "You just updated", status: BankTransaction.StatusEnum.AUTHORISED, bankTransactionID: "00000000-0000-0000-0000-000000000000", lineItems: [], contact: {}, bankAccount: { accountID: "00000000-0000-0000-0000-000000000000" }}]}';
        'x-ruby-requestBody': '{ bank_transactions: [{ type: XeroRuby::Accounting::BankTransaction::SPEND, date: "2019-02-25", reference: "You just updated", status: XeroRuby::Accounting::BankTransaction::AUTHORISED, bank_transaction_id: "00000000-0000-0000-0000-000000000000", line_items: [], contact: {}, bank_account: { account_id: "00000000-0000-0000-0000-000000000000" }}]}';
      };
    };
    '/BankTransactions/{BankTransactionID}/Attachments': {
      get: {
        operationId: 'getBankTransactionAttachments';
        parameters: [
          {
            description: 'Xero generated unique identifier for a bank transaction';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BankTransactionID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "c50798e1-29e9-4a30-a452-bb6e42e400c8", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551303999577)\\/", "Attachments": [ { "AttachmentID": "4508a692-e52c-4ad8-a138-2f13e22bf57b", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/BankTransactions/db54aab0-ad40-4ced-bcff-0940ba20db2c/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 }, { "AttachmentID": "45dd3143-9856-42d2-9a6c-53814f67a33e", "FileName": "sample2.jpg", "Url": "https://api.xero.com/api.xro/2.0/BankTransactions/db54aab0-ad40-4ced-bcff-0940ba20db2c/Attachments/sample2.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array with 0 to n Attachment';
            'x-isAttachment': true;
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves any attachments from a specific bank transactions';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/BankTransactions/{BankTransactionID}/Attachments/{AttachmentID}': {
      get: {
        operationId: 'getBankTransactionAttachmentById';
        parameters: [
          {
            description: 'Xero generated unique identifier for a bank transaction';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BankTransactionID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Xero generated unique identifier for an attachment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AttachmentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for BankTransaction as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves specific attachments from a specific BankTransaction using a unique attachment Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/BankTransactions/{BankTransactionID}/Attachments/{FileName}': {
      get: {
        operationId: 'getBankTransactionAttachmentByFileName';
        parameters: [
          {
            description: 'Xero generated unique identifier for a bank transaction';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BankTransactionID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The name of the file being attached';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for BankTransaction as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves a specific attachment from a specific bank transaction by filename';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateBankTransactionAttachmentByFileName';
        parameters: [
          {
            description: 'Xero generated unique identifier for a bank transaction';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BankTransactionID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The name of the file being attached';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "572ad2fe-8c23-45aa-82f9-864485327685", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551286166630)\\/", "Attachments": [ { "AttachmentID": "4508a692-e52c-4ad8-a138-2f13e22bf57b", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/BankTransactions/db54aab0-ad40-4ced-bcff-0940ba20db2c/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of Attachments array of Attachment';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Updates a specific attachment from a specific bank transaction by filename';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
      put: {
        operationId: 'createBankTransactionAttachmentByFileName';
        parameters: [
          {
            description: 'Xero generated unique identifier for a bank transaction';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BankTransactionID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The name of the file being attached';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "572ad2fe-8c23-45aa-82f9-864485327685", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551286166630)\\/", "Attachments": [ { "AttachmentID": "4508a692-e52c-4ad8-a138-2f13e22bf57b", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/BankTransactions/db54aab0-ad40-4ced-bcff-0940ba20db2c/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of Attachments array of Attachment';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Creates an attachment for a specific bank transaction by filename';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
    };
    '/BankTransactions/{BankTransactionID}/History': {
      get: {
        operationId: 'getBankTransactionsHistory';
        parameters: [
          {
            description: 'Xero generated unique identifier for a bank transaction';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BankTransactionID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRetrieved';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves history from a specific bank transaction using a unique bank transaction Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createBankTransactionHistoryRecord';
        parameters: [
          {
            description: 'Xero generated unique identifier for a bank transaction';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BankTransactionID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          $ref: '#/components/requestBodies/historyRecords';
        };
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRecordCreated';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates a history record for a specific bank transactions';
        tags: ['Accounting'];
        'x-example': [
          {
            historyRecord: null;
            is_object: true;
            key: 'historyRecord';
            keyPascal: 'HistoryRecord';
            keySnake: 'history_record';
          },
          {
            Details: null;
            default: 'Hello World';
            is_last: true;
            key: 'details';
            keyPascal: 'Details';
            object: 'historyRecord';
          },
          {
            historyRecords: null;
            is_object: true;
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
          },
          {
            add_historyRecord: null;
            is_array_add: true;
            is_last: true;
            java: 'HistoryRecords';
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
            object: 'historyRecord';
            python: 'history_record';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/BankTransfers': {
      get: {
        operationId: 'getBankTransfers';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter by an any element';
            example: 'HasAttachments==true';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Order by an any element';
            example: 'Amount ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "dfc0d130-9007-4a98-a5ef-6f01700f18e2", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551311318988)\\/", "BankTransfers": [ { "BankTransferID": "6221458a-ef7a-4d5f-9b1c-1b96ce03833c", "CreatedDateUTCString": "2016-10-17T20:46:01", "CreatedDateUTC": "\\/Date(1476737161140+0000)\\/", "DateString": "2016-11-12T21:10:00", "Date": "\\/Date(1478985000000+0000)\\/", "FromBankAccount": { "AccountID": "6f7594f2-f059-4d56-9e67-47ac9733bfe9", "Name": "Business Wells Fargo" }, "ToBankAccount": { "AccountID": "7e5e243b-9fcd-4aef-8e3a-c70be1e39bfa", "Name": "My Savings" }, "Amount": 20.00, "FromBankTransactionID": "a3eca480-bc04-4292-9bbd-5c57b8ba12b4", "ToBankTransactionID": "4ca13f40-f3a0-4530-a442-a600f5696118", "HasAttachments": true }, { "BankTransferID": "9f0153d5-617c-4903-887b-3875807aa27a", "CreatedDateUTCString": "2016-10-21T23:28:42", "CreatedDateUTC": "\\/Date(1477092522333+0000)\\/", "DateString": "2016-10-19T20:10:00", "Date": "\\/Date(1476907800000+0000)\\/", "FromBankAccount": { "AccountID": "6f7594f2-f059-4d56-9e67-47ac9733bfe9", "Name": "Business Wells Fargo" }, "ToBankAccount": { "AccountID": "7e5e243b-9fcd-4aef-8e3a-c70be1e39bfa", "Name": "My Savings" }, "Amount": 20.00, "FromBankTransactionID": "cb74287e-5682-4973-b354-93e2c7a836d3", "ToBankTransactionID": "4c48ba6c-f318-4405-aee6-b5efa2c70f55", "HasAttachments": false } ] }';
                schema: {
                  $ref: '#/components/schemas/BankTransfers';
                };
              };
            };
            description: 'Success - return response of BankTransfers array of 0 to N BankTransfer';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves all bank transfers';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createBankTransfer';
        requestBody: {
          content: {
            'application/json': {
              example: '{ "BankTransfers": [ { "FromBankAccount": { "Code": "090", "Name": "My Savings", "AccountID": "00000000-0000-0000-0000-000000000000", "Type": "BANK", "BankAccountNumber": "123455", "Status": "ACTIVE", "BankAccountType": "BANK", "CurrencyCode": "USD", "TaxType": "NONE", "EnablePaymentsToAccount": false, "ShowInExpenseClaims": false, "Class": "ASSET", "ReportingCode": "ASS", "ReportingCodeName": "Assets", "HasAttachments": false, "UpdatedDateUTC": "2016-10-17T13:45:33.993-07:00" }, "ToBankAccount": { "Code": "088", "Name": "Business Wells Fargo", "AccountID": "00000000-0000-0000-0000-000000000000", "Type": "BANK", "BankAccountNumber": "123455", "Status": "ACTIVE", "BankAccountType": "BANK", "CurrencyCode": "USD", "TaxType": "NONE", "EnablePaymentsToAccount": false, "ShowInExpenseClaims": false, "Class": "ASSET", "ReportingCode": "ASS", "ReportingCodeName": "Assets", "HasAttachments": false, "UpdatedDateUTC": "2016-06-03T08:31:14.517-07:00" }, "Amount": "50.00" } ] }';
              schema: {
                $ref: '#/components/schemas/BankTransfers';
              };
            };
          };
          description: 'BankTransfers with array of BankTransfer objects in request body';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "ae767b68-affd-4e17-bac0-83eaf1854dcd", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551311317475)\\/", "BankTransfers": [ { "BankTransferID": "76eea4b6-f026-464c-b6f3-5fb39a196145", "DateString": "2019-02-27T00:00:00", "Date": "\\/Date(1551225600000+0000)\\/", "FromBankAccount": { "AccountID": "7e5e243b-9fcd-4aef-8e3a-c70be1e39bfa", "Code": "090", "Name": "My Savings" }, "ToBankAccount": { "AccountID": "6f7594f2-f059-4d56-9e67-47ac9733bfe9", "Code": "088", "Name": "Business Wells Fargo" }, "Amount": 50.00, "FromBankTransactionID": "e4059952-5acb-4a56-b076-53fad85f2930", "ToBankTransactionID": "88e4ac17-293b-4e5a-8d8b-3ce3a0b1ee17", "CurrencyRate": 1.000000, "ValidationErrors": [] } ] }';
                schema: {
                  $ref: '#/components/schemas/BankTransfers';
                };
              };
            };
            description: 'Success - return response of BankTransfers array of one BankTransfer';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates a bank transfer';
        tags: ['Accounting'];
        'x-example': [
          {
            fromBankAccount: null;
            is_object: true;
            key: 'fromBankAccount';
            keyPascal: 'Account';
          },
          {
            accountID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'accountID';
            keyPascal: 'AccountID';
            keySnake: 'account_id';
            object: 'fromBankAccount';
          },
          {
            is_object: true;
            key: 'toBankAccount';
            keyPascal: 'Account';
            toBankAccount: null;
          },
          {
            accountID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'accountID';
            keyPascal: 'AccountID';
            keySnake: 'account_id';
            object: 'toBankAccount';
          },
          {
            bankTransfer: null;
            is_object: true;
            key: 'bankTransfer';
            keyPascal: 'BankTransfer';
            keySnake: 'bank_transfer';
          },
          {
            default: 'fromBankAccount';
            is_variable: true;
            key: 'fromBankAccount';
            keyPascal: 'FromBankAccount';
            keySnake: 'from_bank_account';
            nonString: true;
            object: 'bankTransfer';
            set_fromBankAccount: null;
          },
          {
            default: 'toBankAccount';
            is_variable: true;
            key: 'toBankAccount';
            keyPascal: 'ToBankAccount';
            keySnake: 'to_bank_account';
            nonString: true;
            object: 'bankTransfer';
            set_toBankAccount: null;
          },
          {
            amount: null;
            default: 1;
            is_last: true;
            key: 'amount';
            keyPascal: 'Amount';
            nonString: true;
            object: 'bankTransfer';
          },
          {
            bankTransfers: null;
            is_object: true;
            key: 'bankTransfers';
            keyPascal: 'BankTransfers';
          },
          {
            add_bankTransfer: null;
            is_array_add: true;
            is_last: true;
            java: 'BankTransfers';
            key: 'bankTransfers';
            keyPascal: 'BankTransfers';
            keySnake: 'bank_transfers';
            object: 'bankTransfer';
            python: 'bank_transfer';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ bankTransfers: [{ fromBankAccount: { code: "000", accountID: "00000000-0000-0000-0000-000000000000" }, toBankAccount: { code: "001", accountID: "00000000-0000-0000-0000-000000000000" }, amount: "50.00" }]}';
        'x-ruby-requestBody': 'bank_transfers = { bank_transfers: [{ from_bank_account: { code: "000", account_id: "00000000-0000-0000-0000-000000000000" }, to_bank_account: { code: "001", account_id: "00000000-0000-0000-0000-000000000000" }, amount: "50.00" }]}';
      };
    };
    '/BankTransfers/{BankTransferID}': {
      get: {
        operationId: 'getBankTransfer';
        parameters: [
          {
            description: 'Xero generated unique identifier for a bank transfer';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BankTransferID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "1a5fa46d-5ece-4ef2-89b1-77c293b5d833", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551311320368)\\/", "BankTransfers": [ { "BankTransferID": "6221458a-ef7a-4d5f-9b1c-1b96ce03833c", "CreatedDateUTCString": "2016-10-17T20:46:01", "CreatedDateUTC": "\\/Date(1476737161140+0000)\\/", "DateString": "2016-11-12T21:10:00", "Date": "\\/Date(1478985000000+0000)\\/", "FromBankAccount": { "AccountID": "6f7594f2-f059-4d56-9e67-47ac9733bfe9", "Code": "088", "Name": "Business Wells Fargo" }, "ToBankAccount": { "AccountID": "7e5e243b-9fcd-4aef-8e3a-c70be1e39bfa", "Code": "090", "Name": "My Savings" }, "Amount": 20.00, "FromBankTransactionID": "a3eca480-bc04-4292-9bbd-5c57b8ba12b4", "ToBankTransactionID": "4ca13f40-f3a0-4530-a442-a600f5696118", "CurrencyRate": 1.000000, "HasAttachments": true, "Attachments": [ { "AttachmentID": "e05a6fd8-0e47-47a9-9799-b809c8267260", "FileName": "HelloWorld.jpg", "Url": "https://api.xero.com/api.xro/2.0/banktransfer/6221458a-ef7a-4d5f-9b1c-1b96ce03833c/Attachments/HelloWorld.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/BankTransfers';
                };
              };
            };
            description: 'Success - return response of BankTransfers array with one BankTransfer';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves specific bank transfers by using a unique bank transfer Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/BankTransfers/{BankTransferID}/Attachments': {
      get: {
        operationId: 'getBankTransferAttachments';
        parameters: [
          {
            description: 'Xero generated unique identifier for a bank transfer';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BankTransferID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "5cb6b587-7b02-46b6-97fe-d8ad8f20321b", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551397557272)\\/", "Attachments": [ { "AttachmentID": "e05a6fd8-0e47-47a9-9799-b809c8267260", "FileName": "HelloWorld.jpg", "Url": "https://api.xero.com/api.xro/2.0/BankTransfers/6221458a-ef7a-4d5f-9b1c-1b96ce03833c/Attachments/HelloWorld.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of Attachments array of 0 to N Attachment for a Bank Transfer';
            'x-isAttachment': true;
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves attachments from a specific bank transfer';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/BankTransfers/{BankTransferID}/Attachments/{AttachmentID}': {
      get: {
        operationId: 'getBankTransferAttachmentById';
        parameters: [
          {
            description: 'Xero generated unique identifier for a bank transfer';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BankTransferID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Xero generated unique identifier for an Attachment to a bank transfer';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AttachmentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of binary data from the Attachment to a Bank Transfer';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves a specific attachment from a specific bank transfer using a unique attachment ID';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/BankTransfers/{BankTransferID}/Attachments/{FileName}': {
      get: {
        operationId: 'getBankTransferAttachmentByFileName';
        parameters: [
          {
            description: 'Xero generated unique identifier for a bank transfer';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BankTransferID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The name of the file being attached to a Bank Transfer';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of binary data from the Attachment to a Bank Transfer';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves a specific attachment on a specific bank transfer by file name';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateBankTransferAttachmentByFileName';
        parameters: [
          {
            description: 'Xero generated unique identifier for a bank transfer';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BankTransferID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The name of the file being attached to a Bank Transfer';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "c7810140-19c2-4ff7-b3ec-b7e95ce7becf", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551398138226)\\/", "Attachments": [ { "AttachmentID": "0851935c-c4c5-4de8-9247-ce22efde6f82", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/BankTransfers/6221458a-ef7a-4d5f-9b1c-1b96ce03833c/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of Attachments array of 0 to N Attachment for a Bank Transfer';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
      put: {
        operationId: 'createBankTransferAttachmentByFileName';
        parameters: [
          {
            description: 'Xero generated unique identifier for a bank transfer';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BankTransferID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The name of the file being attached to a Bank Transfer';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "b73ba149-76a9-4e7c-a5c6-b9230022f416", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551397998372)\\/", "Attachments": [ { "AttachmentID": "9478be4c-c707-48c1-b4a7-83d8eaf442b5", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/BankTransfers/6221458a-ef7a-4d5f-9b1c-1b96ce03833c/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of Attachments array of 0 to N Attachment for a Bank Transfer';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
    };
    '/BankTransfers/{BankTransferID}/History': {
      get: {
        operationId: 'getBankTransferHistory';
        parameters: [
          {
            description: 'Xero generated unique identifier for a bank transfer';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BankTransferID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRetrieved';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves history from a specific bank transfer using a unique bank transfer Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createBankTransferHistoryRecord';
        parameters: [
          {
            description: 'Xero generated unique identifier for a bank transfer';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BankTransferID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          $ref: '#/components/requestBodies/historyRecords';
        };
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRecordCreated';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates a history record for a specific bank transfer';
        tags: ['Accounting'];
        'x-example': [
          {
            historyRecord: null;
            is_object: true;
            key: 'historyRecord';
            keyPascal: 'HistoryRecord';
            keySnake: 'history_record';
          },
          {
            Details: null;
            default: 'Hello World';
            is_last: true;
            key: 'details';
            keyPascal: 'Details';
            object: 'historyRecord';
          },
          {
            historyRecords: null;
            is_object: true;
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
          },
          {
            add_historyRecord: null;
            is_array_add: true;
            is_last: true;
            java: 'HistoryRecords';
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
            object: 'historyRecord';
            python: 'history_record';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/BatchPayments': {
      description: 'Batch payments allow you to bundle multiple bills or invoices into one payment transaction. This means a single payment in Xero can be reconciled with a single transaction on the bank statement making for a much simpler bank reconciliation experience.';
      get: {
        operationId: 'getBatchPayments';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter by an any element';
            example: 'Status=="AUTHORISED"';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-java': 'Status==&quot;&apos; + BatchPayment.StatusEnum.AUTHORISED + &apos;&quot;';
            'x-example-php': 'Status==&quot;&apos; . XeroAPI\\XeroPHP\\Models\\Accounting\\BatchPayment::STATUS_AUTHORISED . &apos;&quot;';
            'x-ruby-param': 'Status==#{XeroRuby::Accounting::BatchPayment::AUTHORISED}';
          },
          {
            description: 'Order by an any element';
            example: 'Date ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "6ab84949-4fe5-4788-a135-4d8f690d24d7", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550866184006)\\/", "BatchPayments": [ { "Account": { "AccountID": "6f7594f2-f059-4d56-9e67-47ac9733bfe9" }, "Reference": "Hello World", "BatchPaymentID": "d0e9bbbf-5b8a-48b6-906a-035591fcb061", "DateString": "2017-11-28T00:00:00", "Date": "\\/Date(1511827200000+0000)\\/", "Payments": [ { "Invoice": { "InvoiceID": "0975dec2-0cf6-498d-9c9f-c6775b45c61d", "Payments": [], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "HasErrors": false, "IsDiscounted": false, "LineItems": [] }, "PaymentID": "97ec2ef8-f4d6-4de5-9f2a-385d41cdc2fc", "Amount": 200.00 }, { "Invoice": { "InvoiceID": "600982d9-6605-4e11-afa1-d8dec2be7b52", "Payments": [], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "HasErrors": false, "IsDiscounted": false, "LineItems": [] }, "PaymentID": "e232795f-b919-4865-a754-12f6ae8402c0", "Amount": 200.00 }, { "Invoice": { "InvoiceID": "99a2bd54-4ab1-413c-90bb-57f6464fe5d6", "Payments": [], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "HasErrors": false, "IsDiscounted": false, "LineItems": [] }, "PaymentID": "c2d571a5-38ff-4d37-9d43-dfadb4ad53ff", "Amount": 200.00 }, { "Invoice": { "InvoiceID": "c81942c8-bfc5-4c88-a21a-b892a4a8c1c5", "Payments": [], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "HasErrors": false, "IsDiscounted": false, "LineItems": [] }, "PaymentID": "0f3c18dc-49bd-47a4-a875-03c84a29978f", "Amount": 200.00 }, { "Invoice": { "InvoiceID": "6c9a1d89-8319-42f6-87d6-7690e748af85", "Payments": [], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "HasErrors": false, "IsDiscounted": false, "LineItems": [] }, "PaymentID": "43541eed-f3ac-44ac-88cb-9fe1cb7ed8b8", "Amount": 200.00 } ], "Type": "RECBATCH", "Status": "AUTHORISED", "TotalAmount": 1000.00, "UpdatedDateUTC": "\\/Date(1511893792820+0000)\\/", "IsReconciled": false } ] }';
                schema: {
                  $ref: '#/components/schemas/BatchPayments';
                };
              };
            };
            description: 'Success - return response of type BatchPayments array of BatchPayment objects';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves either one or many batch payments for invoices';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createBatchPayment';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "BatchPayments": [ { "Account": { "AccountID": "00000000-0000-0000-0000-000000000000" }, "Reference": "ref", "Date": "2018-08-01", "Payments": [ { "Account": { "Code": "001" }, "Date": "2019-12-31", "Amount": 500, "Invoice": { "InvoiceID": "00000000-0000-0000-0000-000000000000", "LineItems": [], "Contact": {}, "Type": "ACCPAY" } } ] } ] }';
              schema: {
                $ref: '#/components/schemas/BatchPayments';
              };
            };
          };
          description: 'BatchPayments with an array of Payments in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "424745ed-6356-46ad-87d4-3585f9062fb4", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550865988111)\\/", "BatchPayments": [ { "Account": { "AccountID": "5ec2f302-cd60-4f8b-a915-9229dd45e6fa" }, "Reference": "Foobar123", "BatchPaymentID": "d318c343-208e-49fe-b04a-45642349bcf1", "DateString": "2019-02-22T00:00:00", "Date": "\\/Date(1550793600000+0000)\\/", "Payments": [ { "Invoice": { "InvoiceID": "3323652c-155e-433b-8a73-4dde7cfbf410", "Payments": [], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "HasErrors": false, "IsDiscounted": false, "LineItems": [] }, "PaymentID": "c05098fa-ae3c-4f00-80ec-0a9df07dedff", "Amount": 1.00 }, { "Invoice": { "InvoiceID": "e4abafb4-1f5b-4d9f-80b3-9a7b815bc302", "Payments": [], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "HasErrors": false, "IsDiscounted": false, "LineItems": [] }, "PaymentID": "96409489-2f7d-4804-9a6d-6b939b0e038a", "Amount": 1.00 }, { "Invoice": { "InvoiceID": "e6039672-b161-40cd-b07b-a0178e7186ad", "Payments": [], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "HasErrors": false, "IsDiscounted": false, "LineItems": [] }, "PaymentID": "d2796067-bf71-4f06-b386-81f1454fa866", "Amount": 1.00 } ], "Type": "RECBATCH", "Status": "AUTHORISED", "TotalAmount": 3.00, "UpdatedDateUTC": "\\/Date(1550865987783+0000)\\/", "IsReconciled": false } ] }';
                schema: {
                  $ref: '#/components/schemas/BatchPayments';
                };
              };
            };
            description: 'Success - return response of type BatchPayments array of BatchPayment objects';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates one or many batch payments for invoices';
        tags: ['Accounting'];
        'x-example': [
          {
            currDate: null;
            default: 'LocalDate.now()';
            is_date: true;
            java: 'LocalDate.now()';
            java_datatype: 'LocalDate';
            key: 'currDate';
            keyPascal: 'Date';
            keySnake: 'curr_date';
            php: "new DateTime('2019-12-10')";
            python: "dateutil.parser.parse('2020-12-03T00:00:00Z')";
          },
          {
            is_object: true;
            key: 'paymentAccount';
            keyPascal: 'Account';
            keySnake: 'payment_account';
            paymentAccount: null;
          },
          {
            accountID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'accountId';
            keyPascal: 'AccountID';
            keySnake: 'account_id';
            object: 'paymentAccount';
          },
          {
            bankAccount: null;
            is_object: true;
            key: 'bankAccount';
            keyPascal: 'Account';
            keySnake: 'bank_account';
          },
          {
            accountID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'accountID';
            keyPascal: 'AccountID';
            keySnake: 'account_id';
            object: 'bankAccount';
          },
          {
            invoice: null;
            is_object: true;
            key: 'invoice';
            keyPascal: 'Invoice';
          },
          {
            default: '00000000-0000-0000-0000-000000000000';
            invoiceID: null;
            is_last: true;
            is_uuid: true;
            key: 'invoiceID';
            keyPascal: 'InvoiceID';
            keySnake: 'invoice_id';
            object: 'invoice';
          },
          {
            is_object: true;
            key: 'payment';
            keyPascal: 'Payment';
            payment: null;
          },
          {
            default: 'bankAccount';
            is_variable: true;
            key: 'account';
            keyPascal: 'Account';
            nonString: true;
            object: 'payment';
            python: 'bank_account';
            set_bankaccount: null;
          },
          {
            date: null;
            default: 'currDate';
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'payment';
            python: 'curr_date';
          },
          {
            amount: null;
            default: 1;
            key: 'amount';
            keyPascal: 'Amount';
            nonString: true;
            object: 'payment';
          },
          {
            default: 'invoice';
            is_last: true;
            is_variable: true;
            key: 'invoice';
            keyPascal: 'Invoice';
            nonString: true;
            object: 'payment';
            set_invoice: null;
          },
          {
            is_list: true;
            key: 'payments';
            keyPascal: 'Payment';
            payments: null;
          },
          {
            add_payments: null;
            is_last: true;
            is_list_add: true;
            key: 'payments';
            keyPascal: 'Payments';
            object: 'payment';
          },
          {
            batchPayment: null;
            is_object: true;
            key: 'batchPayment';
            keyPascal: 'BatchPayment';
            keySnake: 'batch_payment';
          },
          {
            default: 'paymentAccount';
            is_variable: true;
            key: 'account';
            keyPascal: 'Account';
            nonString: true;
            object: 'batchPayment';
            python: 'payment_account';
            set_paymentaccount: null;
          },
          {
            date: null;
            default: 'currDate';
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'batchPayment';
            python: 'curr_date';
          },
          {
            default: 'payments';
            is_last: true;
            is_variable: true;
            key: 'payments';
            keyPascal: 'Payments';
            nonString: true;
            object: 'batchPayment';
            set_payments: null;
          },
          {
            batchPayments: null;
            is_object: true;
            key: 'batchPayments';
            keyPascal: 'BatchPayments';
          },
          {
            add_batchPayments: null;
            is_array_add: true;
            is_last: true;
            java: 'BatchPayments';
            key: 'batchPayments';
            keyPascal: 'BatchPayments';
            keySnake: 'batch_payments';
            object: 'batchPayment';
            python: 'batch_payment';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ batchPayments: [{ account: { accountId: "00000000-0000-0000-0000-000000000000" }, reference: "ref", date: "2018-08-01", payments: [{  account: { code: "001" }, date: "2019-12-31", amount: 500, invoice: { invoiceId: "00000000-0000-0000-0000-000000000000", lineItems: [], contact: {}, type: Invoice.TypeEnum.ACCPAY }}]}]}';
        'x-ruby-requestBody': 'batch_payments = { batch_payments: [{ account: { account_id: "00000000-0000-0000-0000-000000000000" }, reference: "ref", date: "2018-08-01", payments: [{  account: { code: "001" }, date: "2019-12-31", amount: 500, invoice: { invoice_id: "00000000-0000-0000-0000-000000000000", line_items: [], contact: {}, type: XeroRuby::Accounting::Invoice::ACCPAY }}]}]}';
      };
    };
    '/BatchPayments/{BatchPaymentID}/History': {
      get: {
        operationId: 'getBatchPaymentHistory';
        parameters: [
          {
            description: 'Unique identifier for BatchPayment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BatchPaymentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "c58e2f9c-baad-42a4-8bb7-f32b6f88fa04", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550898452503)\\/", "HistoryRecords": [ { "Changes": "Approved", "DateUTCString": "2017-11-28T18:29:52", "DateUTC": "\\/Date(1511893792813+0000)\\/", "User": "Buzz Lightyear", "Details": "" } ] }';
                schema: {
                  $ref: '#/components/schemas/HistoryRecords';
                };
              };
            };
            description: 'Success - return response of HistoryRecords array of 0 to N HistoryRecord';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves history from a specific batch payment';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createBatchPaymentHistoryRecord';
        parameters: [
          {
            description: 'Unique identifier for BatchPayment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BatchPaymentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          $ref: '#/components/requestBodies/historyRecords';
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "d7525479-3392-44c0-bb37-ff4a0b5df5bd", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550899400362)\\/", "HistoryRecords": [ { "DateUTCString": "2019-02-23T05:23:20", "DateUTC": "\\/Date(1550899400362)\\/", "Details": "Hello World", "ValidationErrors": [] } ] }';
                schema: {
                  $ref: '#/components/schemas/HistoryRecords';
                };
              };
            };
            description: 'Success - return response of type HistoryRecords array of HistoryRecord objects';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates a history record for a specific batch payment';
        tags: ['Accounting'];
        'x-example': [
          {
            historyRecord: null;
            is_object: true;
            key: 'historyRecord';
            keyPascal: 'HistoryRecord';
            keySnake: 'history_record';
          },
          {
            Details: null;
            default: 'Hello World';
            is_last: true;
            key: 'details';
            keyPascal: 'Details';
            object: 'historyRecord';
          },
          {
            historyRecords: null;
            is_object: true;
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
          },
          {
            add_historyRecord: null;
            is_array_add: true;
            is_last: true;
            java: 'HistoryRecords';
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
            object: 'historyRecord';
            python: 'history_record';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/BrandingThemes': {
      get: {
        operationId: 'getBrandingThemes';
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "d1a1beea-bdfe-4ee4-9dbc-27226a26cd68", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550881711906)\\/", "BrandingThemes": [ { "BrandingThemeID": "dabc7637-62c1-4941-8a6e-ee44fa5090e7", "Name": "Standard", "SortOrder": 0, "CreatedDateUTC": "\\/Date(1464967643813+0000)\\/" } ] }';
                schema: {
                  $ref: '#/components/schemas/BrandingThemes';
                };
              };
            };
            description: 'Success - return response of type BrandingThemes';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings.read'];
          },
        ];
        summary: 'Retrieves all the branding themes';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/BrandingThemes/{BrandingThemeID}': {
      get: {
        operationId: 'getBrandingTheme';
        parameters: [
          {
            description: 'Unique identifier for a Branding Theme';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BrandingThemeID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "df671650-cf14-4a7f-b609-4166933719bc", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550881713071)\\/", "BrandingThemes": [ { "BrandingThemeID": "dabc7637-62c1-4941-8a6e-ee44fa5090e7", "Name": "Standard", "SortOrder": 0, "CreatedDateUTC": "\\/Date(1464967643813+0000)\\/" } ] }';
                schema: {
                  $ref: '#/components/schemas/BrandingThemes';
                };
              };
            };
            description: 'Success - return response of type BrandingThemes with one BrandingTheme';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings.read'];
          },
        ];
        summary: 'Retrieves a specific branding theme using a unique branding theme Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/BrandingThemes/{BrandingThemeID}/PaymentServices': {
      get: {
        operationId: 'getBrandingThemePaymentServices';
        parameters: [
          {
            description: 'Unique identifier for a Branding Theme';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BrandingThemeID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "bfd5adbe-0e92-48f0-8c5a-39072f6c4ed3", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551139339419)\\/", "PaymentServices": [ { "PaymentServiceID": "8cc53aa4-ae01-45b9-b06c-69c42eeae61f", "PaymentServiceName": "Buzz Lightyear", "PaymentServiceType": "PayPal" }, { "PaymentServiceID": "dede7858-14e3-4a46-bf95-4d4cc491e645", "PaymentServiceName": "ACME Payment", "PaymentServiceUrl": "https://www.payupnow.com/", "PaymentServiceType": "Custom", "PayNowText": "Pay Now" } ] }';
                schema: {
                  $ref: '#/components/schemas/PaymentServices';
                };
              };
            };
            description: 'Success - return response of type PaymentServices array with 0 to N PaymentService';
          };
        };
        security: [
          {
            OAuth2: ['paymentservices'];
          },
        ];
        summary: 'Retrieves the payment services for a specific branding theme';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'createBrandingThemePaymentServices';
        parameters: [
          {
            description: 'Unique identifier for a Branding Theme';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'BrandingThemeID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{   "PaymentServiceID": "00000000-0000-0000-0000-000000000000", "PaymentServiceName": "ACME Payments", "PaymentServiceUrl": "https://www.payupnow.com/", "PayNowText": "Pay Now" }';
              schema: {
                $ref: '#/components/schemas/PaymentService';
              };
            };
          };
          description: 'PaymentService object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{   "Id": "918feecb-067a-4ed9-841b-571c04eaada3", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551139338915)\\/", "PaymentServices": [   {   "PaymentServiceID": "00000000-0000-0000-0000-000000000000", "PaymentServiceName": "ACME Payments", "PaymentServiceUrl": "https://www.payupnow.com/", "PaymentServiceType": "Custom", "PayNowText": "Pay Now" } ] }';
                schema: {
                  $ref: '#/components/schemas/PaymentServices';
                };
              };
            };
            description: 'Success - return response of type PaymentServices array with newly created PaymentService';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['paymentservices'];
          },
        ];
        summary: 'Creates a new custom payment service for a specific branding theme';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            key: 'paymentService';
            keyPascal: 'PaymentService';
            object: null;
          },
          {
            default: '00000000-0000-0000-0000-000000000000';
            is_uuid: true;
            key: 'paymentServiceID';
            keyPascal: 'PaymentServiceID';
            object: 'paymentService';
            paymentServiceID: null;
          },
          {
            default: 'ACME Payments';
            key: 'paymentServiceName';
            keyPascal: 'PaymentServiceName';
            object: 'paymentService';
            paymentServiceName: null;
          },
          {
            default: 'https://www.payupnow.com/';
            key: 'paymentServiceUrl';
            keyPascal: 'PaymentServiceUrl';
            object: 'paymentService';
            paymentServiceUrl: null;
          },
          {
            default: 'Pay Now';
            key: 'payNowText';
            keyPascal: 'PayNowText';
            object: 'paymentService';
            payNowText: null;
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ paymentServiceID: "00000000-0000-0000-0000-000000000000", paymentServiceName: "ACME Payments", paymentServiceUrl: "https://www.payupnow.com/", payNowText: "Pay Now" }';
        'x-ruby-requestBody': 'payment_service = { payment_service_id: "00000000-0000-0000-0000-000000000000", payment_service_name: "ACME Payments", payment_service_url: "https://www.payupnow.com/", pay_now_text: "Pay Now" }';
      };
    };
    '/ContactGroups': {
      get: {
        operationId: 'getContactGroups';
        parameters: [
          {
            description: 'Filter by an any element';
            example: 'Status=="ACTIVE"';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-java': 'Status==&quot;&apos; + ContactGroup.StatusEnum.ACTIVE + &apos;&quot;';
            'x-example-php': 'Status==&quot;&apos; . \\XeroAPI\\XeroPHP\\Models\\Accounting\\ContactGroup::STATUS_ACTIVE . &apos;&quot;';
            'x-ruby-param': 'Status==#{XeroRuby::Accounting::ContactGroup::ACTIVE}';
          },
          {
            description: 'Order by an any element';
            example: 'Name ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "b825df86-1a72-49c9-97dd-36afc7d04bd5", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1551746015603)\\/", "ContactGroups": [ { "ContactGroupID": "d7a86b80-8dac-4d89-a334-9dcf5753676c", "Name": "Suppliers", "Status": "ACTIVE", "Contacts": [], "HasValidationErrors": false }, { "ContactGroupID": "ab089fd4-012f-4043-a6e4-e7be01e87e50", "Name": "Old Group84262", "Status": "ACTIVE", "Contacts": [], "HasValidationErrors": false } ] }';
                schema: {
                  $ref: '#/components/schemas/ContactGroups';
                };
              };
            };
            description: 'Success - return response of type Contact Groups array of Contact Group';
          };
        };
        security: [
          {
            OAuth2: ['accounting.contacts.read'];
          },
        ];
        summary: 'Retrieves the contact Id and name of all the contacts in a contact group';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createContactGroup';
        requestBody: {
          content: {
            'application/json': {
              example: '{ "ContactGroups": [{ "Name": "VIPs" }]}';
              schema: {
                $ref: '#/components/schemas/ContactGroups';
              };
            };
          };
          description: 'ContactGroups with an array of names in request body';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "5afe53f9-2271-45b8-9767-88d023b71d34", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1551745740920)\\/", "ContactGroups": [ { "ContactGroupID": "d7a86b80-8dac-4d89-a334-9dcf5753676c", "Name": "Suppliers", "Status": "ACTIVE", "Contacts": [], "HasValidationErrors": false } ] }';
                schema: {
                  $ref: '#/components/schemas/ContactGroups';
                };
              };
            };
            description: 'Success - return response of type Contact Groups array of newly created Contact Group';
          };
          '400': {
            content: {
              'application/json': {
                example: '{ "ErrorNumber": 10, "Type": "ValidationException", "Message": "A validation exception occurred", "Elements": [ { "ContactGroupID": "00000000-0000-0000-0000-000000000000", "Name": "Suppliers", "Contacts": [], "HasValidationErrors": true, "ValidationErrors": [ { "Message": "You’ve reached the limit of 100 contact groups." } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Error';
                };
              };
            };
            description: 'Validation Error - some data was incorrect returns response of type Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.contacts'];
          },
        ];
        summary: 'Creates a contact group';
        tags: ['Accounting'];
        'x-example': [
          {
            contact: null;
            is_object: true;
            key: 'contactGroup';
            keyPascal: 'ContactGroup';
            keySnake: 'contact_group';
          },
          {
            default: 'VIPs';
            is_last: true;
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'contactGroup';
          },
          {
            contactGroups: null;
            is_object: true;
            key: 'contactGroups';
            keyPascal: 'ContactGroups';
          },
          {
            add_ContactGroup: null;
            is_array_add: true;
            is_last: true;
            java: 'ContactGroups';
            key: 'contactGroups';
            keyPascal: 'ContactGroups';
            keySnake: 'contact_groups';
            object: 'contactGroup';
            python: 'contact_group';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ contactGroups: [{ name: "VIPs" }]}';
        'x-ruby-requestBody': 'contact_groups = { contact_groups: [{ name: "VIPs" }]}';
      };
    };
    '/ContactGroups/{ContactGroupID}': {
      get: {
        operationId: 'getContactGroup';
        parameters: [
          {
            description: 'Unique identifier for a Contact Group';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ContactGroupID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "079c14f6-2c2d-464e-a2c7-0edf7e465723", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1551746772976)\\/", "ContactGroups": [ { "ContactGroupID": "17b44ed7-4389-4162-91cb-3dd5766e4e22", "Name": "Oasis", "Status": "ACTIVE", "Contacts": [ { "ContactID": "4e1753b9-018a-4775-b6aa-1bc7871cfee3", "Name": "Noel Gallagher", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "Name": "Liam Gallagher", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false } ], "HasValidationErrors": false } ] }';
                schema: {
                  $ref: '#/components/schemas/ContactGroups';
                };
              };
            };
            description: 'Success - return response of type Contact Groups array with a specific Contact Group';
          };
        };
        security: [
          {
            OAuth2: ['accounting.contacts.read'];
          },
        ];
        summary: 'Retrieves a specific contact group by using a unique contact group Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateContactGroup';
        parameters: [
          {
            description: 'Unique identifier for a Contact Group';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ContactGroupID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{   "ContactGroups":[   {   "Name":"Suppliers" } ] }';
              schema: {
                $ref: '#/components/schemas/ContactGroups';
              };
            };
          };
          description: 'an array of Contact groups with Name of specific group to update';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "b1ba6cdb-1637-4209-bb92-bd0c593f3243", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1551746288544)\\/", "ContactGroups": [ { "ContactGroupID": "13f47537-7c1d-4e62-966e-617d76558fc5", "Name": "Supplier Vendor", "Status": "ACTIVE", "Contacts": [], "HasValidationErrors": false } ] }';
                schema: {
                  $ref: '#/components/schemas/ContactGroups';
                };
              };
            };
            description: 'Success - return response of type Contact Groups array of updated Contact Group';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.contacts'];
          },
        ];
        summary: 'Updates a specific contact group';
        tags: ['Accounting'];
        'x-example': [
          {
            contact: null;
            is_object: true;
            key: 'contactGroup';
            keyPascal: 'ContactGroup';
            keySnake: 'contact_group';
          },
          {
            default: 'Vendor';
            is_last: true;
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'contactGroup';
          },
          {
            contactGroups: null;
            is_object: true;
            key: 'contactGroups';
            keyPascal: 'ContactGroups';
          },
          {
            add_ContactGroup: null;
            is_array_add: true;
            is_last: true;
            java: 'ContactGroups';
            key: 'contactGroups';
            keyPascal: 'ContactGroups';
            keySnake: 'contact_groups';
            object: 'contactGroup';
            python: 'contact_group';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ contactGroups: [{ name: "Vendor" }]}';
        'x-ruby-requestBody': 'contact_groups = { contact_groups: [{ name: "Vendor" }]}';
      };
    };
    '/ContactGroups/{ContactGroupID}/Contacts': {
      delete: {
        operationId: 'deleteContactGroupContacts';
        parameters: [
          {
            description: 'Unique identifier for a Contact Group';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ContactGroupID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '204': {
            description: 'Success - return response 204 no content';
            'x-isEmpty': true;
          };
        };
        security: [
          {
            OAuth2: ['accounting.contacts'];
          },
        ];
        summary: 'Deletes all contacts from a specific contact group';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createContactGroupContacts';
        parameters: [
          {
            description: 'Unique identifier for a Contact Group';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ContactGroupID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Contacts": [ { "ContactID": "a3675fc4-f8dd-4f03-ba5b-f1870566bcd7" }, { "ContactID": "4e1753b9-018a-4775-b6aa-1bc7871cfee3" } ] }';
              schema: {
                $ref: '#/components/schemas/Contacts';
              };
            };
          };
          description: 'Contacts with array of contacts specifying the ContactID to be added to ContactGroup in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "99db8024-6895-45c8-a1b5-54805aa8689c", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1551747495785)\\/", "Contacts": [ { "ContactID": "a3675fc4-f8dd-4f03-ba5b-f1870566bcd7", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false, "ValidationErrors": [] }, { "ContactID": "4e1753b9-018a-4775-b6aa-1bc7871cfee3", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false, "ValidationErrors": [] } ] }';
                schema: {
                  $ref: '#/components/schemas/Contacts';
                };
              };
            };
            description: 'Success - return response of type Contacts array of added Contacts';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.contacts'];
          },
        ];
        summary: 'Creates contacts to a specific contact group';
        tags: ['Accounting'];
        'x-example': [
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            contactID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'contactID';
            keyPascal: 'ContactID';
            keySnake: 'contact_id';
            object: 'contact';
          },
          {
            contacts: null;
            is_object: true;
            key: 'contacts';
            keyPascal: 'Contacts';
          },
          {
            add_contact: null;
            is_array_add: true;
            is_last: true;
            java: 'Contacts';
            key: 'contacts';
            keyPascal: 'Contacts';
            object: 'contact';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ contacts: [{ contactID: "a3675fc4-f8dd-4f03-ba5b-f1870566bcd7" }, { contactID: "4e1753b9-018a-4775-b6aa-1bc7871cfee3" }]}';
        'x-ruby-requestBody': 'contacts = { contacts: [{ contact_id: "a3675fc4-f8dd-4f03-ba5b-f1870566bcd7" }, { contact_id: "4e1753b9-018a-4775-b6aa-1bc7871cfee3" }]}';
      };
    };
    '/ContactGroups/{ContactGroupID}/Contacts/{ContactID}': {
      delete: {
        operationId: 'deleteContactGroupContact';
        parameters: [
          {
            description: 'Unique identifier for a Contact Group';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ContactGroupID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Unique identifier for a Contact';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ContactID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '204': {
            description: 'Success - return response 204 no content';
            'x-isEmpty': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.contacts'];
          },
        ];
        summary: 'Deletes a specific contact from a contact group using a unique contact Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Contacts': {
      get: {
        operationId: 'getContacts';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter by an any element';
            example: 'ContactStatus==&quot;ACTIVE&quot;';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-java': 'ContactStatus==&quot;&apos; + Contact.ContactStatusEnum.ACTIVE + &apos;&quot;';
            'x-example-php': 'ContactStatus==&quot;&apos; . \\XeroAPI\\XeroPHP\\Models\\Accounting\\Contact::CONTACT_STATUS_ACTIVE . &apos;&quot;';
            'x-ruby-param': 'ContactStatus==#{XeroRuby::Accounting::Contact::ACTIVE}';
          },
          {
            description: 'Order by an any element';
            example: 'Name ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Filter by a comma separated list of ContactIDs. Allows you to retrieve a specific set of contacts in a single call.';
            example: '&quot;00000000-0000-0000-0000-000000000000&quot;';
            explode: false;
            in: 'query';
            name: 'IDs';
            schema: {
              items: {
                format: 'uuid';
                type: 'string';
              };
              type: 'array';
            };
            style: 'form';
            'x-example-java': 'Arrays.asList(UUID.fromString("00000000-0000-0000-0000-000000000000"))';
            'x-example-php': '&quot;00000000-0000-0000-0000-000000000000&quot;';
          },
          {
            description: 'e.g. page=1 - Up to 100 contacts will be returned in a single API call.';
            example: 1;
            in: 'query';
            name: 'page';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'e.g. includeArchived=true - Contacts with a status of ARCHIVED will be included in the response';
            in: 'query';
            name: 'includeArchived';
            schema: {
              type: 'boolean';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "04e93d48-e72f-4775-b7dd-15a041fab972", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551399323399)\\/", "Contacts": [ { "ContactID": "5cc8cf28-567e-4d43-b287-687cfcaec47c", "ContactStatus": "ACTIVE", "Name": "Katherine Warren", "FirstName": "Katherine", "LastName": "Warren", "EmailAddress": "kat.warren@clampett.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "" }, { "AddressType": "POBOX", "AddressLine1": "", "AddressLine2": "", "AddressLine3": "", "AddressLine4": "", "City": "Palo Alto", "Region": "CA", "PostalCode": "94020", "Country": "United States" } ], "Phones": [ { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "DEFAULT", "PhoneNumber": "847-1294", "PhoneAreaCode": "(626)", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1503348544227+0000)\\/", "ContactGroups": [], "IsSupplier": true, "IsCustomer": true, "Balances": { "AccountsReceivable": { "Outstanding": 760.00, "Overdue": 920.00 }, "AccountsPayable": { "Outstanding": 231.60, "Overdue": 360.00 } }, "ContactPersons": [], "HasAttachments": false, "HasValidationErrors": false }, { "ContactID": "3ec601ad-eddc-4ccb-a8ac-736e88293b1b", "ContactStatus": "ACTIVE", "Name": "Lisa Parker", "FirstName": "Lisa", "LastName": "Parker", "EmailAddress": "lparker@parkerandco.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "" }, { "AddressType": "POBOX", "AddressLine1": "", "AddressLine2": "", "AddressLine3": "", "AddressLine4": "", "City": "Anchorage", "Region": "AK", "PostalCode": "99501", "Country": "United States" } ], "Phones": [ { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "DEFAULT", "PhoneNumber": "266-3583", "PhoneAreaCode": "(510)", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1503348546760+0000)\\/", "ContactGroups": [], "IsSupplier": false, "IsCustomer": false, "ContactPersons": [], "HasAttachments": false, "HasValidationErrors": false } ] }';
                schema: {
                  $ref: '#/components/schemas/Contacts';
                };
              };
            };
            description: 'Success - return response of type Contacts array with 0 to N Contact';
          };
        };
        security: [
          {
            OAuth2: ['accounting.contacts.read'];
          },
        ];
        summary: 'Retrieves all contacts in a Xero organisation';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateOrCreateContacts';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Contacts": [ { "Name": "Bruce Banner", "EmailAddress": "hulk@avengers.com", "Phones": [ { "PhoneType": "MOBILE", "PhoneNumber": "555-1212", "PhoneAreaCode": "415" } ], "PaymentTerms": { "Bills": { "Day": 15, "Type": "OFCURRENTMONTH" }, "Sales": { "Day": 10, "Type": "DAYSAFTERBILLMONTH" } } } ] }';
              schema: {
                $ref: '#/components/schemas/Contacts';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "e997d6d7-6dad-4458-beb8-d9c1bf7f2edf", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551399321121)\\/", "Contacts": [ { "ContactID": "00000000-0000-0000-0000-000000000000", "ContactStatus": "ACTIVE", "Name": "Bruce Banner", "EmailAddress": "bruce@banner.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "" }, { "AddressType": "POBOX", "City": "", "Region": "", "PostalCode": "", "Country": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "555-1212", "PhoneAreaCode": "415", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551399321043+0000)\\/", "ContactGroups": [], "IsSupplier": false, "IsCustomer": false, "SalesTrackingCategories": [], "PurchasesTrackingCategories": [], "PaymentTerms": { "Bills": { "Day": 15, "Type": "OFCURRENTMONTH" }, "Sales": { "Day": 10, "Type": "DAYSAFTERBILLMONTH" } }, "ContactPersons": [], "HasValidationErrors": false } ] }';
                schema: {
                  $ref: '#/components/schemas/Contacts';
                };
              };
            };
            description: 'Success - return response of type Contacts array with newly created Contact';
          };
          '400': {
            content: {
              'application/json': {
                example: '{ "ErrorNumber": 10, "Type": "ValidationException", "Message": "A validation exception occurred", "Elements": [ { "ContactID": "00000000-0000-0000-0000-000000000000", "AccountNumber": "12345-ABCD", "Name": "Buzz Lightyear", "EmailAddress": "buzzlightyear@email.com", "AccountsReceivableTaxType": "NONE", "AccountsPayableTaxType": "INPUT", "Addresses": [ { "AddressType": "STREET", "AddressLine1": "101 Green St", "AddressLine2": "5th floor", "City": "San Francisco", "Region": "CA", "PostalCode": "94041", "Country": "US", "AttentionTo": "Rod Drury", "ValidationErrors": [] } ], "Phones": [ { "PhoneType": "MOBILE", "PhoneNumber": "555-1212", "PhoneAreaCode": "415", "ValidationErrors": [] } ], "ContactGroups": [], "PaymentTerms": { "Bills": { "Day": 15, "Type": "OFCURRENTMONTH", "ValidationErrors": [] }, "Sales": { "Day": 10, "Type": "DAYSAFTERBILLMONTH", "ValidationErrors": [] } }, "ContactPersons": [], "HasValidationErrors": true, "ValidationErrors": [ { "Message": "The contact name Buzz Lightyear is already assigned to another contact. The contact name must be unique across all active contacts." } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Error';
                };
              };
            };
            description: 'Validation Error - some data was incorrect returns response of type Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.contacts'];
          },
        ];
        summary: 'Updates or creates one or more contacts in a Xero organisation';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            key: 'phone';
            keyPascal: 'Phone';
            phone: null;
          },
          {
            default: '555-1212';
            key: 'phoneNumber';
            keyPascal: 'PhoneNumber';
            keySnake: 'phone_number';
            object: 'phone';
            phoneNumber: null;
          },
          {
            csharp: 'Phone.TypeEnum.MOBILE';
            default: 'MOBILE';
            is_last: true;
            java: 'com.xero.models.accounting.Phone.PhoneTypeEnum.MOBILE';
            key: 'phoneType';
            keyPascal: 'PhoneType';
            keySnake: 'phone_type';
            node: 'PhoneType.MOBILE';
            nonString: true;
            object: 'phone';
            phoneType: null;
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\Phone::PHONE_TYPE_MOBILE';
            python_string: 'MOBILE';
            ruby: 'XeroRuby::Accounting::PhoneType::MOBILE';
          },
          {
            is_list: true;
            key: 'phones';
            keyPascal: 'Phone';
            phones: null;
          },
          {
            add_phone: null;
            is_last: true;
            is_list_add: true;
            key: 'phones';
            keyPascal: 'Phones';
            object: 'phone';
          },
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            default: 'Bruce Banner';
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'contact';
          },
          {
            default: 'hulk@avengers.com';
            emailAddress: null;
            key: 'emailAddress';
            keyPascal: 'EmailAddress';
            keySnake: 'email_address';
            object: 'contact';
          },
          {
            default: 'phones';
            is_last: true;
            is_variable: true;
            key: 'phones';
            keyPascal: 'Phones';
            nonString: true;
            object: 'contact';
            set_phones: null;
          },
          {
            contacts: null;
            is_object: true;
            key: 'contacts';
            keyPascal: 'Contacts';
          },
          {
            add_contact: null;
            is_array_add: true;
            is_last: true;
            java: 'Contacts';
            key: 'contacts';
            keyPascal: 'Contacts';
            object: 'contact';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ contacts: [{ name: "Bruce Banner", emailAddress: "hulk@avengers.com", phones: [{ phoneType: Phone.PhoneTypeEnum.MOBILE, phoneNumber: "555-1212", phoneAreaCode: "415" }], paymentTerms: { bills: { day: 15, type: PaymentTermType.OFCURRENTMONTH }, sales: { day: 10, type: PaymentTermType.DAYSAFTERBILLMONTH }}}]}';
        'x-ruby-requestBody': '{ contacts: [{ name: "Bruce Banner", email_address: "hulk@avengers.com", phones: [{ phone_type: XeroRuby::Accounting::Phone::MOBILE, phone_number: "555-1212", phone_area_code: "415" }], payment_terms: { bills: { day: 15, type: XeroRuby::Accounting::PaymentTermType::OFCURRENTMONTH }, sales: { day: 10, type: XeroRuby::Accounting::PaymentTermType::OFCURRENTMONTHDAYSAFTERBILLMONTH }}}]}';
      };
      put: {
        operationId: 'createContacts';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Id": "e997d6d7-6dad-4458-beb8-d9c1bf7f2edf", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "/Date(1551399321121)/", "Contacts": [ { "ContactID": "3ff6d40c-af9a-40a3-89ce-3c1556a25591", "ContactStatus": "ACTIVE", "Name": "Foo9987", "EmailAddress": "sid32476@blah.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "" }, { "AddressType": "POBOX", "City": "", "Region": "", "PostalCode": "", "Country": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "555-1212", "PhoneAreaCode": "415", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "/Date(1551399321043+0000)/", "ContactGroups": [], "IsSupplier": false, "IsCustomer": false, "SalesTrackingCategories": [], "PurchasesTrackingCategories": [], "PaymentTerms": { "Bills": { "Day": 15, "Type": "OFCURRENTMONTH" }, "Sales": { "Day": 10, "Type": "DAYSAFTERBILLMONTH" } }, "ContactPersons": [], "HasValidationErrors": false } ] }';
              schema: {
                $ref: '#/components/schemas/Contacts';
              };
            };
          };
          description: 'Contacts with an array of Contact objects to create in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "e997d6d7-6dad-4458-beb8-d9c1bf7f2edf", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551399321121)\\/", "Contacts": [ { "ContactID": "3ff6d40c-af9a-40a3-89ce-3c1556a25591", "ContactStatus": "ACTIVE", "Name": "Foo9987", "EmailAddress": "sid32476@blah.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "" }, { "AddressType": "POBOX", "City": "", "Region": "", "PostalCode": "", "Country": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "555-1212", "PhoneAreaCode": "415", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551399321043+0000)\\/", "ContactGroups": [], "IsSupplier": false, "IsCustomer": false, "SalesTrackingCategories": [], "PurchasesTrackingCategories": [], "PaymentTerms": { "Bills": { "Day": 15, "Type": "OFCURRENTMONTH" }, "Sales": { "Day": 10, "Type": "DAYSAFTERBILLMONTH" } }, "ContactPersons": [], "HasValidationErrors": false } ] }';
                schema: {
                  $ref: '#/components/schemas/Contacts';
                };
              };
            };
            description: 'Success - return response of type Contacts array with newly created Contact';
          };
          '400': {
            content: {
              'application/json': {
                example: '{ "ErrorNumber": 10, "Type": "ValidationException", "Message": "A validation exception occurred", "Elements": [ { "ContactID": "00000000-0000-0000-0000-000000000000", "AccountNumber": "12345-ABCD", "Name": "Buzz Lightyear", "EmailAddress": "buzzlightyear@email.com", "AccountsReceivableTaxType": "NONE", "AccountsPayableTaxType": "INPUT", "Addresses": [ { "AddressType": "STREET", "AddressLine1": "101 Green St", "AddressLine2": "5th floor", "City": "San Francisco", "Region": "CA", "PostalCode": "94041", "Country": "US", "AttentionTo": "Rod Drury", "ValidationErrors": [] } ], "Phones": [ { "PhoneType": "MOBILE", "PhoneNumber": "555-1212", "PhoneAreaCode": "415", "ValidationErrors": [] } ], "ContactGroups": [], "PaymentTerms": { "Bills": { "Day": 15, "Type": "OFCURRENTMONTH", "ValidationErrors": [] }, "Sales": { "Day": 10, "Type": "DAYSAFTERBILLMONTH", "ValidationErrors": [] } }, "ContactPersons": [], "HasValidationErrors": true, "ValidationErrors": [ { "Message": "The contact name Buzz Lightyear is already assigned to another contact. The contact name must be unique across all active contacts." } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Error';
                };
              };
            };
            description: 'Validation Error - some data was incorrect returns response of type Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.contacts'];
          },
        ];
        summary: 'Creates multiple contacts (bulk) in a Xero organisation';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            key: 'phone';
            keyPascal: 'Phone';
            phone: null;
          },
          {
            default: '555-1212';
            key: 'phoneNumber';
            keyPascal: 'PhoneNumber';
            keySnake: 'phone_number';
            object: 'phone';
            phoneNumber: null;
          },
          {
            csharp: 'Phone.TypeEnum.MOBILE';
            default: 'MOBILE';
            is_last: true;
            java: 'com.xero.models.accounting.Phone.PhoneTypeEnum.MOBILE';
            key: 'phoneType';
            keyPascal: 'PhoneType';
            keySnake: 'phone_type';
            node: 'PhoneType.MOBILE';
            nonString: true;
            object: 'phone';
            phoneType: null;
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\Phone::PHONE_TYPE_MOBILE';
            python_string: 'MOBILE';
            ruby: 'XeroRuby::Accounting::PhoneType::MOBILE';
          },
          {
            is_list: true;
            key: 'phones';
            keyPascal: 'Phone';
            phones: null;
          },
          {
            add_phone: null;
            is_last: true;
            is_list_add: true;
            key: 'phones';
            keyPascal: 'Phones';
            object: 'phone';
          },
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            default: 'Bruce Banner';
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'contact';
          },
          {
            default: 'hulk@avengers.com';
            emailAddress: null;
            key: 'emailAddress';
            keyPascal: 'EmailAddress';
            keySnake: 'email_address';
            object: 'contact';
          },
          {
            default: 'phones';
            is_last: true;
            is_variable: true;
            key: 'phones';
            keyPascal: 'Phones';
            nonString: true;
            object: 'contact';
            set_phones: null;
          },
          {
            contacts: null;
            is_object: true;
            key: 'contacts';
            keyPascal: 'Contacts';
          },
          {
            add_contact: null;
            is_array_add: true;
            is_last: true;
            java: 'Contacts';
            key: 'contacts';
            keyPascal: 'Contacts';
            object: 'contact';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ contacts: [{ name: "Bruce Banner", emailAddress: "hulk@avengers.com", phones: [{ phoneType: Phone.PhoneTypeEnum.MOBILE, phoneNumber: "555-1212", phoneAreaCode: "415" }], paymentTerms: { bills: { day: 15, type: PaymentTermType.OFCURRENTMONTH }, sales: { day: 10, type: PaymentTermType.DAYSAFTERBILLMONTH }}}]}';
        'x-ruby-requestBody': 'contacts = { contacts: [{ name: "Bruce Banner", email_address: "hulk@avengers.com", phones: [{ phone_type: XeroRuby::Accounting::Phone::MOBILE, phone_number: "555-1212", phone_area_code: "415" }], payment_terms: { bills: { day: 15, type: XeroRuby::Accounting::PaymentTermType::OFCURRENTMONTH }, sales: { day: 10, type: XeroRuby::Accounting::PaymentTermType::DAYSAFTERBILLMONTH }}}]}';
      };
    };
    '/Contacts/{ContactID}': {
      get: {
        operationId: 'getContact';
        parameters: [
          {
            description: 'Unique identifier for a Contact';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ContactID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "5c83b115-a6e8-4f2a-877f-ba63d009235b", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551462703288)\\/", "Contacts": [ { "ContactID": "8138a266-fb42-49b2-a104-014b7045753d", "ContactNumber": "SB2", "AccountNumber": "1234567", "ContactStatus": "ACTIVE", "Name": "Acme Parts Co.", "FirstName": "Blake", "LastName": "Kohler", "EmailAddress": "bk@krave.co", "SkypeUserName": "blake", "BankAccountDetails": "12334567", "TaxNumber": "123-22-3456", "AccountsReceivableTaxType": "TAX003", "AccountsPayableTaxType": "TAX022", "Addresses": [ { "AddressType": "STREET", "AddressLine1": "123 Fake Street", "City": "Vancouver", "Region": "British Columbia", "PostalCode": "V6B 2T4", "Country": "", "AttentionTo": "" }, { "AddressType": "POBOX", "AddressLine1": "1234 Fake Street", "City": "Vancouver", "Region": "British Columbia", "PostalCode": "V6B 2T4", "Country": "", "AttentionTo": "Blake" } ], "Phones": [ { "PhoneType": "DDI", "PhoneNumber": "489-44493", "PhoneAreaCode": "345", "PhoneCountryCode": "4" }, { "PhoneType": "DEFAULT", "PhoneNumber": "408-0914", "PhoneAreaCode": "604", "PhoneCountryCode": "1" }, { "PhoneType": "FAX", "PhoneNumber": "123-9933", "PhoneAreaCode": "123", "PhoneCountryCode": "2" }, { "PhoneType": "MOBILE", "PhoneNumber": "999-44", "PhoneAreaCode": "234", "PhoneCountryCode": "3" } ], "UpdatedDateUTC": "\\/Date(1551459777193+0000)\\/", "ContactGroups": [], "IsSupplier": true, "IsCustomer": true, "DefaultCurrency": "USD", "Discount": 13.00, "Website": "http://www.google.com", "BrandingTheme": { "BrandingThemeID": "dabc7637-62c1-4941-8a6e-ee44fa5090e7", "Name": "Standard" }, "PurchasesDefaultAccountCode": "660", "SalesDefaultAccountCode": "002", "BatchPayments": { "BankAccountNumber": "12334567", "BankAccountName": "Citi Bank", "Details": "biz checking", "Code": "", "Reference": "" }, "Balances": { "AccountsReceivable": { "Outstanding": 118.90, "Overdue": 136.90 }, "AccountsPayable": { "Outstanding": -43.60, "Overdue": 40.00 } }, "PaymentTerms": { "Bills": { "Day": 12, "Type": "OFFOLLOWINGMONTH" }, "Sales": { "Day": 14, "Type": "OFCURRENTMONTH" } }, "ContactPersons": [ { "FirstName": "Sue", "LastName": "Johnson", "EmailAddress": "sue.johnson@krave.com", "IncludeInEmails": true } ], "HasAttachments": true, "Attachments": [ { "AttachmentID": "04e0a3e3-b116-456a-9f32-9706f0d33afa", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/contact/8138a266-fb42-49b2-a104-014b7045753d/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ], "HasValidationErrors": false } ] }';
                schema: {
                  $ref: '#/components/schemas/Contacts';
                };
              };
            };
            description: 'Success - return response of type Contacts array with a unique Contact';
          };
        };
        security: [
          {
            OAuth2: ['accounting.contacts.read'];
          },
        ];
        summary: 'Retrieves a specific contacts in a Xero organisation using a unique contact Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateContact';
        parameters: [
          {
            description: 'Unique identifier for a Contact';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ContactID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Contacts": [{ "ContactID": "00000000-0000-0000-0000-000000000000", "Name": "Thanos" }]}';
              schema: {
                $ref: '#/components/schemas/Contacts';
              };
            };
          };
          description: 'an array of Contacts containing single Contact object with properties to update';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "4166b727-c3f0-4881-acd0-d4f7c0e8fcda", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551400031795)\\/", "Contacts": [ { "ContactID": "d5be01fb-b09f-4c3a-9c67-e10c2a03412c", "ContactStatus": "ACTIVE", "Name": "FooBar", "EmailAddress": "sid30680@blah.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "" }, { "AddressType": "POBOX", "City": "", "Region": "", "PostalCode": "", "Country": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "555-1212", "PhoneAreaCode": "415", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551400031763+0000)\\/", "ContactGroups": [], "IsSupplier": false, "IsCustomer": false, "SalesTrackingCategories": [], "PurchasesTrackingCategories": [], "PaymentTerms": { "Bills": { "Day": 15, "Type": "OFCURRENTMONTH" }, "Sales": { "Day": 10, "Type": "DAYSAFTERBILLMONTH" } }, "ContactPersons": [], "HasValidationErrors": false } ] }';
                schema: {
                  $ref: '#/components/schemas/Contacts';
                };
              };
            };
            description: 'Success - return response of type Contacts array with an updated Contact';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.contacts'];
          },
        ];
        summary: 'Updates a specific contact in a Xero organisation';
        tags: ['Accounting'];
        'x-example': [
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            default: 'Thanos';
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'contact';
          },
          {
            contactID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'contactID';
            keyPascal: 'ContactID';
            object: 'contact';
          },
          {
            contacts: null;
            is_object: true;
            key: 'contacts';
            keyPascal: 'Contacts';
          },
          {
            add_contact: null;
            is_array_add: true;
            is_last: true;
            java: 'Contacts';
            key: 'contacts';
            keyPascal: 'Contacts';
            object: 'contact';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ contacts: [{ contactID: "00000000-0000-0000-0000-000000000000", name: "Thanos" }]}';
        'x-ruby-requestBody': 'contacts = { contacts: [{ contact_id: "00000000-0000-0000-0000-000000000000", name: "Thanos" }]}';
      };
    };
    '/Contacts/{ContactID}/Attachments': {
      get: {
        operationId: 'getContactAttachments';
        parameters: [
          {
            description: 'Unique identifier for a Contact';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ContactID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "0f63b631-a205-496d-b1d2-e6b13a9b497b", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551483890413)\\/", "Attachments": [ { "AttachmentID": "04e0a3e3-b116-456a-9f32-9706f0d33afa", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/Contacts/8138a266-fb42-49b2-a104-014b7045753d/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array with 0 to N Attachment';
            'x-isAttachment': true;
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves attachments for a specific contact in a Xero organisation';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Contacts/{ContactID}/Attachments/{AttachmentID}': {
      get: {
        operationId: 'getContactAttachmentById';
        parameters: [
          {
            description: 'Unique identifier for a Contact';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ContactID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Unique identifier for a Attachment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AttachmentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Contact as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves a specific attachment from a specific contact using a unique attachment Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Contacts/{ContactID}/Attachments/{FileName}': {
      get: {
        operationId: 'getContactAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for a Contact';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ContactID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name for the file you are attaching';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Contact as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves a specific attachment from a specific contact by file name';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateContactAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for a Contact';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ContactID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name for the file you are attaching';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "8543ae1a-297c-49b8-bf91-47decac452d5", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1551485146555)\\/", "Attachments": [ { "AttachmentID": "8b537c1b-bbb5-47fd-857e-370c369dda7c", "FileName": "HelloWorld.jpg", "Url": "https://api.xero.com/api.xro/2.0/Contacts/8138a266-fb42-49b2-a104-014b7045753d/Attachments/HelloWorld.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array with an updated Attachment';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
      put: {
        operationId: 'createContactAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for a Contact';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ContactID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name for the file you are attaching';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "a5eddf71-86aa-42f5-99e2-0aaf9caf96b6", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1551484292734)\\/", "Attachments": [ { "AttachmentID": "27e37b01-6996-4ebe-836c-95fd472ad674", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/Contacts/8138a266-fb42-49b2-a104-014b7045753d/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array with an newly created Attachment';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
    };
    '/Contacts/{ContactID}/CISSettings': {
      get: {
        operationId: 'getContactCISSettings';
        parameters: [
          {
            description: 'Unique identifier for a Contact';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ContactID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CISSettings';
                };
              };
            };
            description: 'Success - return response of type CISSettings for a specific Contact';
          };
        };
        security: [
          {
            OAuth2: ['accounting.contacts.read'];
          },
        ];
        summary: 'Retrieves CIS settings for a specific contact in a Xero organisation';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Contacts/{ContactID}/History': {
      get: {
        operationId: 'getContactHistory';
        parameters: [
          {
            description: 'Unique identifier for a Contact';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ContactID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRetrieved';
          };
        };
        security: [
          {
            OAuth2: ['accounting.contacts.read'];
          },
        ];
        summary: 'Retrieves history records for a specific contact';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createContactHistory';
        parameters: [
          {
            description: 'Unique identifier for a Contact';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ContactID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          $ref: '#/components/requestBodies/historyRecords';
        };
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRecordCreated';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.contacts'];
          },
        ];
        summary: 'Creates a new history record for a specific contact';
        tags: ['Accounting'];
        'x-example': [
          {
            historyRecord: null;
            is_object: true;
            key: 'historyRecord';
            keyPascal: 'HistoryRecord';
            keySnake: 'history_record';
          },
          {
            Details: null;
            default: 'Hello World';
            is_last: true;
            key: 'details';
            keyPascal: 'Details';
            object: 'historyRecord';
          },
          {
            historyRecords: null;
            is_object: true;
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
          },
          {
            add_historyRecord: null;
            is_array_add: true;
            is_last: true;
            java: 'HistoryRecords';
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
            object: 'historyRecord';
            python: 'history_record';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/Contacts/{ContactNumber}': {
      get: {
        operationId: 'getContactByContactNumber';
        parameters: [
          {
            description: 'This field is read only on the Xero contact screen, used to identify contacts in external systems (max length = 50).';
            example: 'SB2';
            in: 'path';
            name: 'ContactNumber';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "5c83b115-a6e8-4f2a-877f-ba63d009235b", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551462703288)\\/", "Contacts": [ { "ContactID": "8138a266-fb42-49b2-a104-014b7045753d", "ContactNumber": "SB2", "AccountNumber": "1234567", "ContactStatus": "ACTIVE", "Name": "Acme Parts Co.", "FirstName": "Blake", "LastName": "Kohler", "EmailAddress": "bk@krave.co", "SkypeUserName": "blake", "BankAccountDetails": "12334567", "TaxNumber": "123-22-3456", "AccountsReceivableTaxType": "TAX003", "AccountsPayableTaxType": "TAX022", "Addresses": [ { "AddressType": "STREET", "AddressLine1": "123 Fake Street", "City": "Vancouver", "Region": "British Columbia", "PostalCode": "V6B 2T4", "Country": "", "AttentionTo": "" }, { "AddressType": "POBOX", "AddressLine1": "1234 Fake Street", "City": "Vancouver", "Region": "British Columbia", "PostalCode": "V6B 2T4", "Country": "", "AttentionTo": "Blake" } ], "Phones": [ { "PhoneType": "DDI", "PhoneNumber": "489-44493", "PhoneAreaCode": "345", "PhoneCountryCode": "4" }, { "PhoneType": "DEFAULT", "PhoneNumber": "408-0914", "PhoneAreaCode": "604", "PhoneCountryCode": "1" }, { "PhoneType": "FAX", "PhoneNumber": "123-9933", "PhoneAreaCode": "123", "PhoneCountryCode": "2" }, { "PhoneType": "MOBILE", "PhoneNumber": "999-44", "PhoneAreaCode": "234", "PhoneCountryCode": "3" } ], "UpdatedDateUTC": "\\/Date(1551459777193+0000)\\/", "ContactGroups": [], "IsSupplier": true, "IsCustomer": true, "DefaultCurrency": "USD", "Discount": 13.00, "Website": "http://www.google.com", "BrandingTheme": { "BrandingThemeID": "dabc7637-62c1-4941-8a6e-ee44fa5090e7", "Name": "Standard" }, "PurchasesDefaultAccountCode": "660", "SalesDefaultAccountCode": "002", "BatchPayments": { "BankAccountNumber": "12334567", "BankAccountName": "Citi Bank", "Details": "biz checking", "Code": "", "Reference": "" }, "Balances": { "AccountsReceivable": { "Outstanding": 118.90, "Overdue": 136.90 }, "AccountsPayable": { "Outstanding": -43.60, "Overdue": 40.00 } }, "PaymentTerms": { "Bills": { "Day": 12, "Type": "OFFOLLOWINGMONTH" }, "Sales": { "Day": 14, "Type": "OFCURRENTMONTH" } }, "ContactPersons": [ { "FirstName": "Sue", "LastName": "Johnson", "EmailAddress": "sue.johnson@krave.com", "IncludeInEmails": true } ], "HasAttachments": true, "Attachments": [ { "AttachmentID": "04e0a3e3-b116-456a-9f32-9706f0d33afa", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/contact/8138a266-fb42-49b2-a104-014b7045753d/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ], "HasValidationErrors": false } ] }';
                schema: {
                  $ref: '#/components/schemas/Contacts';
                };
              };
            };
            description: 'Success - return response of type Contacts array with a unique Contact';
          };
        };
        security: [
          {
            OAuth2: ['accounting.contacts.read'];
          },
        ];
        summary: 'Retrieves a specific contact by contact number in a Xero organisation';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/CreditNotes': {
      get: {
        operationId: 'getCreditNotes';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter by an any element';
            example: 'Status=="DRAFT"';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-java': 'Status==&quot;&apos; + CreditNote.StatusEnum.DRAFT + &apos;&quot;';
            'x-example-php': 'Status==&quot;&apos; . \\XeroAPI\\XeroPHP\\Models\\Accounting\\CreditNote::STATUS_DRAFT . &apos;&quot;';
            'x-ruby-param': 'Status==#{XeroRuby::Accounting::CreditNote::DRAFT}';
          },
          {
            description: 'Order by an any element';
            example: 'CreditNoteNumber ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'e.g. page=1 – Up to 100 credit notes will be returned in a single API call with line items shown for each credit note';
            example: 1;
            in: 'query';
            name: 'page';
            schema: {
              type: 'integer';
            };
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "306379b0-3d75-4c77-953a-be08fa0efae8", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1551812506620)\\/", "CreditNotes": [ { "CreditNoteID": "249f15fa-f2a7-4acc-8769-0984103f2225", "CreditNoteNumber": "CN-0005", "Payments": [ { "PaymentID": "6b037c9b-2e5d-4905-84d3-eabfb3438242", "Date": "\\/Date(1552521600000+0000)\\/", "Amount": 2.00, "Reference": "Too much", "CurrencyRate": 1.000000, "HasAccount": false, "HasValidationErrors": false } ], "ID": "249f15fa-f2a7-4acc-8769-0984103f2225", "CurrencyRate": 1.000000, "Type": "ACCRECCREDIT", "Reference": "US Tour", "RemainingCredit": 32.50, "Allocations": [], "HasAttachments": true, "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "Name": "Liam Gallagher", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-03-05T00:00:00", "Date": "\\/Date(1551744000000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "Exclusive", "LineItems": [], "SubTotal": 30.00, "TotalTax": 4.50, "Total": 34.50, "UpdatedDateUTC": "\\/Date(1551812346157+0000)\\/", "CurrencyCode": "NZD" }, { "CreditNoteID": "f8021bd2-9a6a-4c19-8477-163da0b9290f", "CreditNoteNumber": "", "Payments": [], "ID": "f8021bd2-9a6a-4c19-8477-163da0b9290f", "CurrencyRate": 1.000000, "Type": "ACCPAYCREDIT", "Reference": "", "RemainingCredit": 46.00, "Allocations": [], "HasAttachments": false, "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "Name": "Liam Gallagher", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-01-05T00:00:00", "Date": "\\/Date(1546646400000+0000)\\/", "Status": "DRAFT", "LineAmountTypes": "Exclusive", "LineItems": [], "SubTotal": 40.00, "TotalTax": 6.00, "Total": 46.00, "UpdatedDateUTC": "\\/Date(1551812506153+0000)\\/", "CurrencyCode": "NZD" } ] }';
                schema: {
                  $ref: '#/components/schemas/CreditNotes';
                };
              };
            };
            description: 'Success - return response of type Credit Notes array of CreditNote';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves any credit notes';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateOrCreateCreditNotes';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{   "CreditNotes":[   {   "Type":"ACCPAYCREDIT", "Contact":{   "ContactID":"430fa14a-f945-44d3-9f97-5df5e28441b8" }, "Date":"2019-01-05", "Status":"AUTHORISED", "Reference": "HelloWorld", "LineItems":[   {   "Description":"Foobar", "Quantity":2.0, "UnitAmount":20.0, "AccountCode":"400" } ] } ] }';
              schema: {
                $ref: '#/components/schemas/CreditNotes';
              };
            };
          };
          description: 'an array of Credit Notes with a single CreditNote object.';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "5e57a661-42da-4a19-96a0-00405a0e946d", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1551812702713)\\/", "CreditNotes": [ { "CreditNoteID": "f9256f04-5a99-4680-acb9-6b4639cc439a", "CreditNoteNumber": "", "Payments": [], "ID": "f9256f04-5a99-4680-acb9-6b4639cc439a", "CurrencyRate": 1.000000, "Type": "ACCPAYCREDIT", "Reference": "", "RemainingCredit": 46.00, "Allocations": [], "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "EmailAddress": "liam@rockstar.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "", "AttentionTo": "" }, { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551747281053+0000)\\/", "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-01-05T00:00:00", "Date": "\\/Date(1546646400000+0000)\\/", "Status": "DRAFT", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "Foobar", "UnitAmount": 20.00, "TaxType": "INPUT2", "TaxAmount": 6.00, "LineAmount": 40.00, "AccountCode": "400", "Tracking": [], "Quantity": 2.0000, "ValidationErrors": [] } ], "SubTotal": 40.00, "TotalTax": 6.00, "Total": 46.00, "UpdatedDateUTC": "\\/Date(1551812702650+0000)\\/", "CurrencyCode": "NZD", "StatusAttributeString": "OK", "ValidationErrors": [ { "Message": "An existing Credit Note with the specified CreditNoteID could not be found" } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/CreditNotes';
                };
              };
            };
            description: 'Success - return response of type Credit Notes array of newly created CreditNote';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Updates or creates one or more credit notes';
        tags: ['Accounting'];
        'x-example': [
          {
            currDate: null;
            default: 'LocalDate.now()';
            is_date: true;
            java: 'LocalDate.now()';
            java_datatype: 'LocalDate';
            key: 'currDate';
            keyPascal: 'Date';
            keySnake: 'curr_date';
            php: "new DateTime('2019-12-10')";
            python: "dateutil.parser.parse('2020-12-03T00:00:00Z')";
          },
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            contactID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'contactId';
            keyPascal: 'ContactID';
            keySnake: 'contact_id';
            object: 'contact';
          },
          {
            is_object: true;
            key: 'lineItem';
            keyPascal: 'LineItem';
            keySnake: 'line_item';
            lineItem: null;
          },
          {
            default: 'Foobar';
            description: null;
            key: 'description';
            keyPascal: 'Description';
            object: 'lineItem';
          },
          {
            default: 1;
            key: 'quantity';
            keyPascal: 'Quantity';
            nonString: true;
            object: 'lineItem';
            quantity: null;
          },
          {
            default: 20;
            key: 'unitAmount';
            keyPascal: 'UnitAmount';
            keySnake: 'unit_amount';
            nonString: true;
            object: 'lineItem';
            unitAmount: null;
          },
          {
            accountCode: null;
            default: '000';
            is_last: true;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'lineItem';
          },
          {
            is_list: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            lineItems: null;
          },
          {
            add_lineitems: null;
            is_last: true;
            is_list_add: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            object: 'lineItem';
            python: 'line_item';
          },
          {
            creditNote: null;
            is_object: true;
            key: 'creditNote';
            keyPascal: 'CreditNote';
            keySnake: 'credit_note';
          },
          {
            csharp: 'CreditNote.xxx';
            default: 'ACCPAYCREDIT';
            java: 'com.xero.models.accounting.CreditNote.TypeEnum.ACCPAYCREDIT';
            key: 'type';
            keyPascal: 'Type';
            node: 'CreditNote.TypeEnum.ACCPAYCREDIT';
            nonString: true;
            object: 'creditNote';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\CreditNote::TYPE_ACCPAYCREDIT';
            python_string: 'ACCPAYCREDIT';
            ruby: 'XeroRuby::Accounting::CreditNote::ACCPAYCREDIT';
            type: null;
          },
          {
            default: 'contact';
            is_variable: true;
            key: 'contact';
            keyPascal: 'Contact';
            nonString: true;
            object: 'creditNote';
            set_contact: null;
          },
          {
            date: null;
            default: 'currDate';
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'creditNote';
            python: 'curr_date';
          },
          {
            default: 'lineItems';
            is_last: true;
            is_variable: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            nonString: true;
            object: 'creditNote';
            python: 'line_items';
            set_lineitem: null;
          },
          {
            creditNotes: null;
            is_object: true;
            key: 'creditNotes';
            keyPascal: 'CreditNotes';
          },
          {
            add_creditNote: null;
            is_array_add: true;
            is_last: true;
            java: 'CreditNotes';
            key: 'creditNotes';
            keyPascal: 'CreditNotes';
            keySnake: 'credit_notes';
            object: 'creditNote';
            python: 'credit_note';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ creditNotes: [{ type: CreditNote.TypeEnum.ACCPAYCREDIT, contact: { contactID: "00000000-0000-0000-0000-000000000000" }, date: "2019-01-05", lineItems: [{ description: "Foobar", quantity: 2.0, unitAmount: 20.0, accountCode: "400" }]}]}';
        'x-ruby-requestBody': 'credit_notes = { credit_notes: [{ type: XeroRuby::Accounting::CreditNote::ACCPAYCREDIT, contact: { contact_id: "00000000-0000-0000-0000-000000000000" }, date: "2019-01-05", line_items: [{ description: "Foobar", quantity: 2.0, unit_amount: 20.0, account_code: "400" }]}]}';
      };
      put: {
        operationId: 'createCreditNotes';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{   "CreditNotes":[   {   "Type":"ACCPAYCREDIT", "Contact":{   "ContactID":"430fa14a-f945-44d3-9f97-5df5e28441b8" }, "Date":"2019-01-05", "LineItems":[   {   "Description":"Foobar", "Quantity":2.0, "UnitAmount":20.0, "AccountCode":"400" } ] } ] }';
              schema: {
                $ref: '#/components/schemas/CreditNotes';
              };
            };
          };
          description: 'Credit Notes with array of CreditNote object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "5e57a661-42da-4a19-96a0-00405a0e946d", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1551812702713)\\/", "CreditNotes": [ { "CreditNoteID": "f9256f04-5a99-4680-acb9-6b4639cc439a", "CreditNoteNumber": "", "Payments": [], "ID": "f9256f04-5a99-4680-acb9-6b4639cc439a", "CurrencyRate": 1.000000, "Type": "ACCPAYCREDIT", "Reference": "", "RemainingCredit": 46.00, "Allocations": [], "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "EmailAddress": "liam@rockstar.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "", "AttentionTo": "" }, { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551747281053+0000)\\/", "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-01-05T00:00:00", "Date": "\\/Date(1546646400000+0000)\\/", "Status": "DRAFT", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "Foobar", "UnitAmount": 20.00, "TaxType": "INPUT2", "TaxAmount": 6.00, "LineAmount": 40.00, "AccountCode": "400", "Tracking": [], "Quantity": 2.0000, "ValidationErrors": [] } ], "SubTotal": 40.00, "TotalTax": 6.00, "Total": 46.00, "UpdatedDateUTC": "\\/Date(1551812702650+0000)\\/", "CurrencyCode": "NZD", "StatusAttributeString": "OK", "ValidationErrors": [ { "Message": "An existing Credit Note with the specified CreditNoteID could not be found" } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/CreditNotes';
                };
              };
            };
            description: 'Success - return response of type Credit Notes array of newly created CreditNote';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates a new credit note';
        tags: ['Accounting'];
        'x-example': [
          {
            currDate: null;
            default: 'LocalDate.now()';
            is_date: true;
            java: 'LocalDate.now()';
            java_datatype: 'LocalDate';
            key: 'currDate';
            keyPascal: 'Date';
            keySnake: 'curr_date';
            php: "new DateTime('2019-12-10')";
            python: "dateutil.parser.parse('2020-12-03T00:00:00Z')";
          },
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            contactID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'contactId';
            keyPascal: 'ContactID';
            keySnake: 'contact_id';
            object: 'contact';
          },
          {
            is_object: true;
            key: 'lineItem';
            keyPascal: 'LineItem';
            keySnake: 'line_item';
            lineItem: null;
          },
          {
            default: 'Foobar';
            description: null;
            key: 'description';
            keyPascal: 'Description';
            object: 'lineItem';
          },
          {
            default: 1;
            key: 'quantity';
            keyPascal: 'Quantity';
            nonString: true;
            object: 'lineItem';
            quantity: null;
          },
          {
            default: 20;
            key: 'unitAmount';
            keyPascal: 'UnitAmount';
            keySnake: 'unit_amount';
            nonString: true;
            object: 'lineItem';
            unitAmount: null;
          },
          {
            accountCode: null;
            default: '000';
            is_last: true;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'lineItem';
          },
          {
            is_list: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            lineItems: null;
          },
          {
            add_lineitems: null;
            is_last: true;
            is_list_add: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            object: 'lineItem';
            python: 'line_item';
          },
          {
            creditNote: null;
            is_object: true;
            key: 'creditNote';
            keyPascal: 'CreditNote';
            keySnake: 'credit_note';
          },
          {
            csharp: 'CreditNote.xxx';
            default: 'ACCPAYCREDIT';
            java: 'com.xero.models.accounting.CreditNote.TypeEnum.ACCPAYCREDIT';
            key: 'type';
            keyPascal: 'Type';
            node: 'CreditNote.TypeEnum.ACCPAYCREDIT';
            nonString: true;
            object: 'creditNote';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\CreditNote::TYPE_ACCPAYCREDIT';
            python_string: 'ACCPAYCREDIT';
            ruby: 'XeroRuby::Accounting::CreditNote::ACCPAYCREDIT';
            type: null;
          },
          {
            default: 'contact';
            is_variable: true;
            key: 'contact';
            keyPascal: 'Contact';
            nonString: true;
            object: 'creditNote';
            set_contact: null;
          },
          {
            date: null;
            default: 'currDate';
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'creditNote';
            python: 'curr_date';
          },
          {
            default: 'lineItems';
            is_last: true;
            is_variable: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            nonString: true;
            object: 'creditNote';
            python: 'line_items';
            set_lineitem: null;
          },
          {
            creditNotes: null;
            is_object: true;
            key: 'creditNotes';
            keyPascal: 'CreditNotes';
          },
          {
            add_creditNote: null;
            is_array_add: true;
            is_last: true;
            java: 'CreditNotes';
            key: 'creditNotes';
            keyPascal: 'CreditNotes';
            keySnake: 'credit_notes';
            object: 'creditNote';
            python: 'credit_note';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ creditNotes: [{ type: CreditNote.TypeEnum.ACCPAYCREDIT, contact: { contactID: "430fa14a-f945-44d3-9f97-5df5e28441b8" }, date: "2019-01-05", lineItems: [{ description: "Foobar", quantity: 2.0, unitAmount: 20.0, accountCode: "400" }]}]}';
        'x-ruby-requestBody': 'credit_notes = { credit_notes: [{ type: XeroRuby::Accounting::CreditNote::ACCPAYCREDIT, contact: { contact_id: "430fa14a-f945-44d3-9f97-5df5e28441b8" }, date: "2019-01-05", line_items: [{ description: "Foobar", quantity: 2.0, unit_amount: 20.0, account_code: "400" }]}]}';
      };
    };
    '/CreditNotes/{CreditNoteID}': {
      get: {
        operationId: 'getCreditNote';
        parameters: [
          {
            description: 'Unique identifier for a Credit Note';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'CreditNoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "dd5c5da7-08ab-486a-ac34-aea295f1614b", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1551812703811)\\/", "CreditNotes": [ { "CreditNoteID": "249f15fa-f2a7-4acc-8769-0984103f2225", "CreditNoteNumber": "CN-0005", "Payments": [ { "PaymentID": "6b037c9b-2e5d-4905-84d3-eabfb3438242", "Date": "\\/Date(1552521600000+0000)\\/", "Amount": 2.00, "Reference": "Too much", "CurrencyRate": 1.000000, "HasAccount": false, "HasValidationErrors": false } ], "ID": "249f15fa-f2a7-4acc-8769-0984103f2225", "CurrencyRate": 1.000000, "Type": "ACCRECCREDIT", "Reference": "US Tour", "RemainingCredit": 32.50, "Allocations": [], "HasAttachments": true, "Attachments": [ { "AttachmentID": "9b9c9b62-069e-4f5a-a172-183195f084bb", "FileName": "Screen Shot 2019-03-04 at 9.00.06 AM.png", "Url": "https://api.xero.com/api.xro/2.0/creditnotes/249f15fa-f2a7-4acc-8769-0984103f2225/Attachments/Screen%20Shot%202019-03-04%20at%209.00.06%20AM.png", "MimeType": "image/png", "ContentLength": 82334 } ], "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "EmailAddress": "liam@rockstar.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "", "AttentionTo": "" }, { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551747281053+0000)\\/", "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-03-05T00:00:00", "Date": "\\/Date(1551744000000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "Mic Stand", "UnitAmount": 30.00, "TaxType": "OUTPUT2", "TaxAmount": 4.50, "LineAmount": 30.00, "AccountCode": "200", "Tracking": [], "Quantity": 1.0000, "ValidationErrors": [] } ], "SubTotal": 30.00, "TotalTax": 4.50, "Total": 34.50, "UpdatedDateUTC": "\\/Date(1551812346157+0000)\\/", "CurrencyCode": "NZD" } ] }';
                schema: {
                  $ref: '#/components/schemas/CreditNotes';
                };
              };
            };
            description: 'Success - return response of type Credit Notes array with a unique CreditNote';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves a specific credit note using a unique credit note Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateCreditNote';
        parameters: [
          {
            description: 'Unique identifier for a Credit Note';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'CreditNoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "CreditNotes": [ { "Type": "ACCPAYCREDIT", "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8" }, "Date": "2019-01-05", "Status": "AUTHORISED", "Reference": "HelloWorld", "LineItems": [ { "Description": "Foobar", "Quantity": 2, "UnitAmount": 20, "AccountCode": "400" } ] } ] }';
              schema: {
                $ref: '#/components/schemas/CreditNotes';
              };
            };
          };
          description: 'an array of Credit Notes containing credit note details to update';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "db2f7659-6044-418d-a4c6-d4b93eba4e1e", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1551812704253)\\/", "CreditNotes": [ { "CreditNoteID": "f9256f04-5a99-4680-acb9-6b4639cc439a", "CreditNoteNumber": "", "Payments": [], "ID": "f9256f04-5a99-4680-acb9-6b4639cc439a", "CurrencyRate": 1.000000, "Type": "ACCPAYCREDIT", "Reference": "HelloWorld", "RemainingCredit": 46.00, "Allocations": [], "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "EmailAddress": "liam@rockstar.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "", "AttentionTo": "" }, { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551747281053+0000)\\/", "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-01-05T00:00:00", "Date": "\\/Date(1546646400000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "Foobar", "UnitAmount": 20.00, "TaxType": "INPUT2", "TaxAmount": 6.00, "LineAmount": 40.00, "AccountCode": "400", "Tracking": [], "Quantity": 2.0000, "ValidationErrors": [] } ], "SubTotal": 40.00, "TotalTax": 6.00, "Total": 46.00, "UpdatedDateUTC": "\\/Date(1551812704223+0000)\\/", "CurrencyCode": "NZD" } ] }';
                schema: {
                  $ref: '#/components/schemas/CreditNotes';
                };
              };
            };
            description: 'Success - return response of type Credit Notes array with updated CreditNote';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Updates a specific credit note';
        tags: ['Accounting'];
        'x-example': [
          {
            currDate: null;
            default: 'LocalDate.now()';
            is_date: true;
            java: 'LocalDate.now()';
            java_datatype: 'LocalDate';
            key: 'currDate';
            keyPascal: 'Date';
            keySnake: 'curr_date';
            php: "new DateTime('2019-12-10')";
            python: "dateutil.parser.parse('2020-12-03T00:00:00Z')";
          },
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            contactID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'contactId';
            keyPascal: 'ContactID';
            keySnake: 'contact_id';
            object: 'contact';
          },
          {
            is_object: true;
            key: 'lineItem';
            keyPascal: 'LineItem';
            keySnake: 'line_item';
            lineItem: null;
          },
          {
            default: 'Foobar';
            description: null;
            key: 'description';
            keyPascal: 'Description';
            object: 'lineItem';
          },
          {
            default: 1;
            key: 'quantity';
            keyPascal: 'Quantity';
            nonString: true;
            object: 'lineItem';
            quantity: null;
          },
          {
            default: 20;
            key: 'unitAmount';
            keyPascal: 'UnitAmount';
            keySnake: 'unit_amount';
            nonString: true;
            object: 'lineItem';
            unitAmount: null;
          },
          {
            accountCode: null;
            default: '000';
            is_last: true;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'lineItem';
          },
          {
            is_list: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            lineItems: null;
          },
          {
            add_lineitems: null;
            is_last: true;
            is_list_add: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            object: 'lineItem';
            python: 'line_item';
          },
          {
            creditNote: null;
            is_object: true;
            key: 'creditNote';
            keyPascal: 'CreditNote';
            keySnake: 'credit_note';
          },
          {
            csharp: 'CreditNote.xxx';
            default: 'ACCPAYCREDIT';
            java: 'com.xero.models.accounting.CreditNote.TypeEnum.ACCPAYCREDIT';
            key: 'type';
            keyPascal: 'Type';
            node: 'CreditNote.TypeEnum.ACCPAYCREDIT';
            nonString: true;
            object: 'creditNote';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\CreditNote::TYPE_ACCPAYCREDIT';
            python_string: 'ACCPAYCREDIT';
            ruby: 'XeroRuby::Accounting::CreditNote::ACCPAYCREDIT';
            type: null;
          },
          {
            csharp: 'CreditNote.xxx';
            default: 'AUTHORISED';
            java: 'com.xero.models.accounting.CreditNote.StatusEnum.AUTHORISED';
            key: 'status';
            keyPascal: 'Status';
            node: 'CreditNote.StatusEnum.AUTHORISED';
            nonString: true;
            object: 'creditNote';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\CreditNote::STATUS_AUTHORISED';
            python_string: 'AUTHORISED';
            ruby: 'XeroRuby::Accounting::CreditNote::AUTHORISED';
            status: null;
          },
          {
            default: 'My ref.';
            key: 'reference';
            keyPascal: 'Reference';
            object: 'creditNote';
            reference: null;
          },
          {
            default: 'contact';
            is_variable: true;
            key: 'contact';
            keyPascal: 'Contact';
            nonString: true;
            object: 'creditNote';
            set_contact: null;
          },
          {
            date: null;
            default: 'currDate';
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'creditNote';
            python: 'curr_date';
          },
          {
            default: 'lineItems';
            is_last: true;
            is_variable: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            nonString: true;
            object: 'creditNote';
            python: 'line_items';
            set_lineitem: null;
          },
          {
            creditNotes: null;
            is_object: true;
            key: 'creditNotes';
            keyPascal: 'CreditNotes';
          },
          {
            add_creditNote: null;
            is_array_add: true;
            is_last: true;
            java: 'CreditNotes';
            key: 'creditNotes';
            keyPascal: 'CreditNotes';
            keySnake: 'credit_notes';
            object: 'creditNote';
            python: 'credit_note';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ creditNotes: [{ type: CreditNote.TypeEnum.ACCPAYCREDIT, contact: { contactID: "00000000-0000-0000-0000-000000000000" }, date: "2019-01-05", status: CreditNote.StatusEnum.AUTHORISED, reference: "Mind stone", lineItems: [{ description: "Infinity Stones", quantity: 1.0, unitAmount: 100.0, accountCode: "400" } ]}]}';
        'x-ruby-requestBody': 'credit_notes = { credit_notes: [{ type: XeroRuby::Accounting::CreditNote::ACCPAYCREDIT, contact: { contact_id: "00000000-0000-0000-0000-000000000000" }, date: "2019-01-05", status: XeroRuby::Accounting::CreditNote::AUTHORISED, reference: "Mind stone", line_items: [{ description: "Infinity Stones", quantity: 1.0, unit_amount: 100.0, account_code: "400" } ]}]}';
      };
    };
    '/CreditNotes/{CreditNoteID}/Allocations': {
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createCreditNoteAllocation';
        parameters: [
          {
            description: 'Unique identifier for a Credit Note';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'CreditNoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Allocations": [ { "Invoice": { "LineItems": [], "InvoiceID": "c45720a1-ade3-4a38-a064-d15489be6841" }, "Amount": 1, "Date": "2019-03-05" } ] }';
              schema: {
                $ref: '#/components/schemas/Allocations';
              };
            };
          };
          description: 'Allocations with array of Allocation object in body of request.';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "73452751-6eaa-4bcb-86f5-4c013316f4cf", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1551828543255)\\/", "Allocations": [ { "Amount": 1.00, "Date": "\\/Date(1551744000000+0000)\\/", "Invoice": { "InvoiceID": "c45720a1-ade3-4a38-a064-d15489be6841", "Payments": [], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "HasErrors": false, "IsDiscounted": false, "LineItems": [], "ValidationErrors": [] }, "CreditNote": { "CreditNoteID": "7be578f5-63af-45c8-9b00-dcc4732baf0b", "ID": "7be578f5-63af-45c8-9b00-dcc4732baf0b", "LineItems": [] }, "ValidationErrors": [] } ] }';
                schema: {
                  $ref: '#/components/schemas/Allocations';
                };
              };
            };
            description: 'Success - return response of type Allocations array with newly created Allocation for specific Credit Note';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates allocation for a specific credit note';
        tags: ['Accounting'];
        'x-example': [
          {
            currDate: null;
            default: 'LocalDate.now()';
            is_date: true;
            java: 'LocalDate.now()';
            java_datatype: 'LocalDate';
            key: 'currDate';
            keyPascal: 'Date';
            keySnake: 'curr_date';
            php: "new DateTime('2019-12-10')";
            python: "dateutil.parser.parse('2020-12-03T00:00:00Z')";
          },
          {
            invoice: null;
            is_object: true;
            key: 'invoice';
            keyPascal: 'Invoice';
          },
          {
            default: '00000000-0000-0000-0000-000000000000';
            invoiceID: null;
            is_last: true;
            is_uuid: true;
            key: 'invoiceID';
            keyPascal: 'InvoiceID';
            object: 'invoice';
          },
          {
            allocation: null;
            is_object: true;
            key: 'allocation';
            keyPascal: 'Allocation';
          },
          {
            amount: null;
            default: 1;
            key: 'amount';
            keyPascal: 'Amount';
            nonString: true;
            object: 'allocation';
          },
          {
            date: null;
            default: 'currDate';
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'allocation';
            python: 'curr_date';
          },
          {
            default: 'invoice';
            is_last: true;
            is_variable: true;
            key: 'invoice';
            keyPascal: 'Invoice';
            nonString: true;
            object: 'allocation';
            set_invoice: null;
          },
          {
            allocations: null;
            is_object: true;
            key: 'allocations';
            keyPascal: 'Allocations';
          },
          {
            add_allocation: null;
            is_array_add: true;
            is_last: true;
            java: 'Allocations';
            key: 'allocations';
            keyPascal: 'Allocations';
            object: 'allocation';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ allocations: [{ amount: 1.0, date: "2019-03-05", invoice: { invoiceID: "c45720a1-ade3-4a38-a064-d15489be6841", lineItems: [], type: Invoice.TypeEnum.ACCPAY, contact: {} }}]}';
        'x-ruby-requestBody': 'allocations = { allocations: [{ amount: 1.0, date: "2019-03-05", invoice: { invoice_id: "c45720a1-ade3-4a38-a064-d15489be6841", line_items: [], type: XeroRuby::Accounting::Invoice::ACCPAY, contact: {} }}]}';
      };
    };
    '/CreditNotes/{CreditNoteID}/Attachments': {
      get: {
        operationId: 'getCreditNoteAttachments';
        parameters: [
          {
            description: 'Unique identifier for a Credit Note';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'CreditNoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "2bb15054-3868-4f85-a9c6-0402ec8c1201", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1551822670731)\\/", "Attachments": [ { "AttachmentID": "b7eb1fc9-a0f9-4e8e-9373-6689f5350832", "FileName": "HelloWorld.png", "Url": "https://api.xero.com/api.xro/2.0/CreditNotes/249f15fa-f2a7-4acc-8769-0984103f2225/Attachments/HelloWorld.png", "MimeType": "image/png", "ContentLength": 76091 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array with all Attachment for specific Credit Note';
            'x-isAttachment': true;
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves attachments for a specific credit notes';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/CreditNotes/{CreditNoteID}/Attachments/{AttachmentID}': {
      get: {
        operationId: 'getCreditNoteAttachmentById';
        parameters: [
          {
            description: 'Unique identifier for a Credit Note';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'CreditNoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Unique identifier for a Attachment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AttachmentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Credit Note as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves a specific attachment from a specific credit note using a unique attachment Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/CreditNotes/{CreditNoteID}/Attachments/{FileName}': {
      get: {
        operationId: 'getCreditNoteAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for a Credit Note';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'CreditNoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name of the file you are attaching to Credit Note';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Credit Note as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves a specific attachment on a specific credit note by file name';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateCreditNoteAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for a Credit Note';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'CreditNoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name of the file you are attaching to Credit Note';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "27253066-8c4d-4e34-a251-7a749b72de40", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1551828247939)\\/", "Attachments": [ { "AttachmentID": "103e49f1-e47c-4b4d-b5e8-77d9d00fa70a", "FileName": "HelloWorld.jpg", "Url": "https://api.xero.com/api.xro/2.0/CreditNotes/249f15fa-f2a7-4acc-8769-0984103f2225/Attachments/HelloWorld.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array with updated Attachment for specific Credit Note';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Updates attachments on a specific credit note by file name';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
      put: {
        operationId: 'createCreditNoteAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for a Credit Note';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'CreditNoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name of the file you are attaching to Credit Note';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            $ref: '#/components/parameters/includeOnline';
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "22a8d402-5dea-40ed-9d01-26896429f649", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1551822953320)\\/", "Attachments": [ { "AttachmentID": "91bbae3f-5de5-4e3d-875f-8662f25897bd", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/CreditNotes/249f15fa-f2a7-4acc-8769-0984103f2225/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array with newly created Attachment for specific Credit Note';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Creates an attachment for a specific credit note';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
    };
    '/CreditNotes/{CreditNoteID}/History': {
      get: {
        operationId: 'getCreditNoteHistory';
        parameters: [
          {
            description: 'Unique identifier for a Credit Note';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'CreditNoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRetrieved';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves history records of a specific credit note';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createCreditNoteHistory';
        parameters: [
          {
            description: 'Unique identifier for a Credit Note';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'CreditNoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          $ref: '#/components/requestBodies/historyRecords';
        };
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRecordCreated';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Retrieves history records of a specific credit note';
        tags: ['Accounting'];
        'x-example': [
          {
            historyRecord: null;
            is_object: true;
            key: 'historyRecord';
            keyPascal: 'HistoryRecord';
            keySnake: 'history_record';
          },
          {
            Details: null;
            default: 'Hello World';
            is_last: true;
            key: 'details';
            keyPascal: 'Details';
            object: 'historyRecord';
          },
          {
            historyRecords: null;
            is_object: true;
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
          },
          {
            add_historyRecord: null;
            is_array_add: true;
            is_last: true;
            java: 'HistoryRecords';
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
            object: 'historyRecord';
            python: 'history_record';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/CreditNotes/{CreditNoteID}/pdf': {
      get: {
        operationId: 'getCreditNoteAsPdf';
        parameters: [
          {
            description: 'Unique identifier for a Credit Note';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'CreditNoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/pdf': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of binary data from the Attachment to a Credit Note';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Retrieves credit notes as PDF files';
        tags: ['Accounting'];
        'x-path': '/CreditNotes/{CreditNoteID}';
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Currencies': {
      get: {
        operationId: 'getCurrencies';
        parameters: [
          {
            description: 'Filter by an any element';
            example: 'Code=="USD"';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-php': 'Code==&quot;&apos; . \\XeroAPI\\XeroPHP\\Models\\Accounting\\CurrencyCode::USD . &apos;&quot;';
            'x-ruby-param': 'Code==#{XeroRuby::Accounting::CurrencyCode::USD}';
          },
          {
            description: 'Order by an any element';
            example: 'Code ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "e6803fc8-8035-4251-b3e4-39d6b2de0f4a", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552322853043)\\/", "Currencies": [ { "Code": "NZD", "Description": "New Zealand Dollar" } ] }';
                schema: {
                  $ref: '#/components/schemas/Currencies';
                };
              };
            };
            description: 'Success - return response of type Currencies array with all Currencies';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings.read'];
          },
        ];
        summary: 'Retrieves currencies for your Xero organisation';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createCurrency';
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Code": "USD", "Description": "United States Dollar" }';
              schema: {
                $ref: '#/components/schemas/Currency';
              };
            };
          };
          description: 'Currency object in the body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Currencies';
                };
              };
            };
            description: 'Unsupported - return response incorrect exception, API is not able to create new Currency';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Create a new currency for a Xero organisation';
        tags: ['Accounting'];
        'x-example': [
          {
            currency: null;
            is_object: true;
            key: 'currency';
            keyPascal: 'Currency';
          },
          {
            code: null;
            csharp: 'CurrencyCode.xxx';
            default: 'USD';
            java: 'com.xero.models.accounting.CurrencyCode.USD';
            key: 'code';
            keyPascal: 'Code';
            node: 'CurrencyCode.USD';
            nonString: true;
            object: 'currency';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\CurrencyCode::USD';
            python: 'CurrencyCode.USD';
            ruby: 'XeroRuby::Accounting::CurrencyCode::USD';
          },
          {
            default: 'United States Dollar';
            description: null;
            is_last: true;
            key: 'description';
            keyPascal: 'Description';
            object: 'currency';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ code: CurrencyCode.USD, description: "United States Dollar" }';
        'x-ruby-requestBody': 'currency = { code: XeroRuby::Accounting::CurrencyCode::USD, description: "United States Dollar" }';
      };
    };
    '/Employees': {
      get: {
        operationId: 'getEmployees';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter by an any element';
            example: 'Status=="ACTIVE"';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-java': 'Status==&quot;&apos; + Employee.StatusEnum.ACTIVE + &apos;&quot;';
            'x-example-php': 'Status==&quot;&apos; . \\XeroAPI\\XeroPHP\\Models\\Accounting\\Employee::STATUS_ACTIVE . &apos;&quot;';
            'x-ruby-param': 'Status==#{XeroRuby::Accounting::Employee::ACTIVE}';
          },
          {
            description: 'Order by an any element';
            example: 'LastName ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: ' { "Id": "593cbccc-5cd2-4cd2-be5e-150f0843709e", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552325082775)\\/", "Employees": [ { "EmployeeID": "972615c5-ad3d-47a0-b579-20370d374578", "Status": "ACTIVE", "FirstName": "Tony", "LastName": "Stark", "ExternalLink": { "Url": "http://twitter.com/#!/search/Stark+Industries", "Description": "Go to external link" }, "UpdatedDateUTC": "\\/Date(1552324681593+0000)\\/" }, { "EmployeeID": "ad3db144-6362-459c-8c36-5d31d196e629", "Status": "ACTIVE", "FirstName": "Bruce", "LastName": "Banner", "ExternalLink": { "Url": "http://twitter.com/#!/search/Nick+Fury", "Description": "Go to external link" }, "UpdatedDateUTC": "\\/Date(1552325081303+0000)\\/" }, { "EmployeeID": "e1ada26b-a10e-4065-a941-af34b53740e3", "Status": "ACTIVE", "FirstName": "Nick", "LastName": "Fury", "ExternalLink": { "Url": "http://twitter.com/#!/search/Nick+Fury", "Description": "Go to external link" }, "UpdatedDateUTC": "\\/Date(1552324737990+0000)\\/" } ] }';
                schema: {
                  $ref: '#/components/schemas/Employees';
                };
              };
            };
            description: 'Success - return response of type Employees array with all Employee';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings.read'];
          },
        ];
        summary: 'Retrieves employees used in Xero payrun';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateOrCreateEmployees';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Employees": [ { "FirstName": "Nick", "LastName": "Fury", "ExternalLink": { "Url": "http://twitter.com/#!/search/Nick+Fury" } } ] }';
              schema: {
                $ref: '#/components/schemas/Employees';
              };
            };
          };
          description: 'Employees with array of Employee object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "0d6a08e7-6936-4828-a1bc-e4595e0ef778", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552324736508)\\/", "Employees": [ { "EmployeeID": "e1ada26b-a10e-4065-a941-af34b53740e3", "Status": "ACTIVE", "FirstName": "Nick", "LastName": "Fury", "ExternalLink": { "Url": "http://twitter.com/#!/search/Nick+Fury", "Description": "Go to external link" }, "UpdatedDateUTC": "\\/Date(1552324736463+0000)\\/" } ] }';
                schema: {
                  $ref: '#/components/schemas/Employees';
                };
              };
            };
            description: 'Success - return response of type Employees array with new Employee';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Creates a single new employees used in Xero payrun';
        tags: ['Accounting'];
        'x-example': [
          {
            employee: null;
            is_object: true;
            key: 'employee';
            keyPascal: 'Employee';
          },
          {
            default: 'Nick';
            firstName: null;
            key: 'firstName';
            keyPascal: 'FirstName';
            keySnake: 'first_name';
            object: 'employee';
          },
          {
            default: 'Fury';
            is_last: true;
            key: 'lastName';
            keyPascal: 'LastName';
            keySnake: 'last_name';
            lastName: null;
            object: 'employee';
          },
          {
            employees: null;
            is_object: true;
            key: 'employees';
            keyPascal: 'Employees';
          },
          {
            add_employee: null;
            is_array_add: true;
            is_last: true;
            java: 'Employees';
            key: 'employees';
            keyPascal: 'Employees';
            object: 'employee';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ employees: [{ firstName: "Nick", lastName: "Fury", externalLink: { url: "http://twitter.com/#!/search/Nick+Fury" }}]}';
        'x-ruby-requestBody': 'employees = { employees: [{ first_name: "Nick", last_name: "Fury", external_link: { url: "http://twitter.com/#!/search/Nick+Fury" }}]}';
      };
      put: {
        operationId: 'createEmployees';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Employees": [ { "FirstName": "Nick", "LastName": "Fury", "ExternalLink": { "Url": "http://twitter.com/#!/search/Nick+Fury" } } ] }';
              schema: {
                $ref: '#/components/schemas/Employees';
              };
            };
          };
          description: 'Employees with array of Employee object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "0d6a08e7-6936-4828-a1bc-e4595e0ef778", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552324736508)\\/", "Employees": [ { "EmployeeID": "e1ada26b-a10e-4065-a941-af34b53740e3", "Status": "ACTIVE", "FirstName": "Nick", "LastName": "Fury", "ExternalLink": { "Url": "http://twitter.com/#!/search/Nick+Fury", "Description": "Go to external link" }, "UpdatedDateUTC": "\\/Date(1552324736463+0000)\\/" } ] }';
                schema: {
                  $ref: '#/components/schemas/Employees';
                };
              };
            };
            description: 'Success - return response of type Employees array with new Employee';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Creates new employees used in Xero payrun';
        tags: ['Accounting'];
        'x-example': [
          {
            employee: null;
            is_object: true;
            key: 'employee';
            keyPascal: 'Employee';
          },
          {
            default: 'Nick';
            firstName: null;
            key: 'firstName';
            keyPascal: 'FirstName';
            keySnake: 'first_name';
            object: 'employee';
          },
          {
            default: 'Fury';
            is_last: true;
            key: 'lastName';
            keyPascal: 'LastName';
            keySnake: 'last_name';
            lastName: null;
            object: 'employee';
          },
          {
            employees: null;
            is_object: true;
            key: 'employees';
            keyPascal: 'Employees';
          },
          {
            add_employee: null;
            is_array_add: true;
            is_last: true;
            java: 'Employees';
            key: 'employees';
            keyPascal: 'Employees';
            object: 'employee';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ employees: [{ firstName: "Nick", lastName: "Fury", externalLink: { url: "http://twitter.com/#!/search/Nick+Fury" }}]}';
        'x-ruby-requestBody': 'employees = { employees: [{ first_name: "Nick", last_name: "Fury", externallink: { url: "http://twitter.com/#!/search/Nick+Fury" }}]}';
      };
    };
    '/Employees/{EmployeeID}': {
      get: {
        operationId: 'getEmployee';
        parameters: [
          {
            description: 'Unique identifier for a Employee';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'EmployeeID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "417a529e-4f8d-4b1a-8816-7100245cf8b2", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552325084085)\\/", "Employees": [ { "EmployeeID": "972615c5-ad3d-47a0-b579-20370d374578", "Status": "ACTIVE", "FirstName": "Tony", "LastName": "Stark", "ExternalLink": { "Url": "http://twitter.com/#!/search/Stark+Industries", "Description": "Go to external link" }, "UpdatedDateUTC": "\\/Date(1552324681593+0000)\\/" } ] }';
                schema: {
                  $ref: '#/components/schemas/Employees';
                };
              };
            };
            description: 'Success - return response of type Employees array with specified Employee';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings.read'];
          },
        ];
        summary: 'Retrieves a specific employee used in Xero payrun using a unique employee Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/ExpenseClaims': {
      get: {
        operationId: 'getExpenseClaims';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter by an any element';
            example: 'Status=="SUBMITTED"';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-java': 'Status==&quot;&apos; + ExpenseClaim.StatusEnum.SUBMITTED + &apos;&quot;';
            'x-example-php': 'Status==&quot;&apos; . \\XeroAPI\\XeroPHP\\Models\\Accounting\\ExpenseClaim::STATUS_SUBMITTED . &apos;&quot;';
            'x-ruby-param': 'Status==#{XeroRuby::Accounting::ExpenseClaim::SUBMITTED}';
          },
          {
            description: 'Order by an any element';
            example: 'Status ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "f6a8867e-af29-41ee-8f77-855f5ff214fe", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552325853538)\\/", "ExpenseClaims": [ { "ExpenseClaimID": "646b15ab-b874-4e13-82ae-f4385b2ac4b6", "Status": "AUTHORISED", "UpdatedDateUTC": "\\/Date(1552325851767+0000)\\/", "User": { "UserID": "d1164823-0ac1-41ad-987b-b4e30fe0b273", "EmailAddress": "api@xero.com", "FirstName": "API ", "LastName": "Team", "UpdatedDateUTC": "\\/Date(1511957179217+0000)\\/", "IsSubscriber": true, "OrganisationRole": "FINANCIALADVISER" }, "Receipts": [], "Payments": [], "Total": 40.00, "AmountDue": 40.00, "AmountPaid": 0.00, "ReportingDate": "\\/Date(1552262400000+0000)\\/" } ] }';
                schema: {
                  $ref: '#/components/schemas/ExpenseClaims';
                };
              };
            };
            description: 'Success - return response of type ExpenseClaims array with all ExpenseClaims';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves expense claims';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createExpenseClaims';
        requestBody: {
          content: {
            'application/json': {
              example: '{ "ExpenseClaims": [ { "Status": "SUBMITTED", "User": { "UserID": "d1164823-0ac1-41ad-987b-b4e30fe0b273" }, "Receipts": [ { "Lineitems": [], "ReceiptID": "dc1c7f6d-0a4c-402f-acac-551d62ce5816" } ] } ] }';
              schema: {
                $ref: '#/components/schemas/ExpenseClaims';
              };
            };
          };
          description: 'ExpenseClaims with array of ExpenseClaim object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "4a0879a6-3860-4b73-adc6-f6a0e0f68fc8", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552325850201)\\/", "ExpenseClaims": [ { "ExpenseClaimID": "646b15ab-b874-4e13-82ae-f4385b2ac4b6", "Status": "SUBMITTED", "UpdatedDateUTC": "\\/Date(1552325850107+0000)\\/", "User": { "UserID": "d1164823-0ac1-41ad-987b-b4e30fe0b273", "EmailAddress": "api@xero.com", "FirstName": "API ", "LastName": "Team", "UpdatedDateUTC": "\\/Date(1511957179217+0000)\\/", "IsSubscriber": true, "OrganisationRole": "FINANCIALADVISER" }, "Receipts": [ { "ReceiptID": "dc1c7f6d-0a4c-402f-acac-551d62ce5816", "ReceiptNumber": 1, "Status": "SUBMITTED", "User": { "UserID": "d1164823-0ac1-41ad-987b-b4e30fe0b273", "EmailAddress": "api@xero.com", "FirstName": "API ", "LastName": "Team", "UpdatedDateUTC": "\\/Date(1511957179217+0000)\\/", "IsSubscriber": true, "OrganisationRole": "FINANCIALADVISER" }, "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "Name": "Liam Gallagher", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "Date": "\\/Date(1552348800000+0000)\\/", "UpdatedDateUTC": "\\/Date(1552325848457+0000)\\/", "Reference": "", "LineAmountTypes": "NoTax", "LineItems": [ { "Description": "Foobar", "UnitAmount": 20.00, "TaxType": "NONE", "TaxAmount": 0.00, "LineAmount": 40.00, "Tracking": [], "Quantity": 2.0000 } ], "SubTotal": 40.00, "TotalTax": 0.00, "Total": 40.00, "ID": "dc1c7f6d-0a4c-402f-acac-551d62ce5816", "HasAttachments": false } ], "Payments": [], "Total": 40.00, "AmountDue": 40.00, "AmountPaid": 0.00, "StatusAttributeString": "OK" } ] }';
                schema: {
                  $ref: '#/components/schemas/ExpenseClaims';
                };
              };
            };
            description: 'Success - return response of type ExpenseClaims array with newly created ExpenseClaim';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates expense claims';
        tags: ['Accounting'];
        'x-example': [
          {
            currDate: null;
            default: 'LocalDate.now()';
            is_date: true;
            java: 'LocalDate.now()';
            java_datatype: 'LocalDate';
            key: 'currDate';
            keyPascal: 'Date';
            keySnake: 'curr_date';
            php: "new DateTime('2019-12-10')";
            python: "dateutil.parser.parse('2020-12-03T00:00:00Z')";
          },
          {
            is_object: true;
            key: 'user';
            keyPascal: 'User';
            user: null;
          },
          {
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'userID';
            keyPascal: 'UserID';
            keySnake: 'user_id';
            object: 'user';
            userID: null;
          },
          {
            is_object: true;
            key: 'receipt';
            keyPascal: 'Receipt';
            receipt: null;
          },
          {
            default: '00000000-0000-0000-0000-000000000000';
            is_uuid: true;
            key: 'receiptID';
            keyPascal: 'ReceiptID';
            keySnake: 'receipt_id';
            object: 'receipt';
            receiptID: null;
          },
          {
            date: null;
            default: 'currDate';
            is_last: true;
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'receipt';
            python: 'curr_date';
          },
          {
            is_list: true;
            key: 'receipts';
            keyPascal: 'Receipt';
            receipts: null;
          },
          {
            add_receipts: null;
            is_last: true;
            is_list_add: true;
            key: 'receipts';
            keyPascal: 'Receipts';
            object: 'receipt';
          },
          {
            expenseClaim: null;
            is_object: true;
            key: 'expenseClaim';
            keyPascal: 'ExpenseClaim';
            keySnake: 'expense_claim';
          },
          {
            csharp: 'ExpenseClaim.xxx';
            default: 'SUBMITTED';
            java: 'com.xero.models.accounting.ExpenseClaim.StatusEnum.SUBMITTED';
            key: 'status';
            keyPascal: 'Status';
            node: 'ExpenseClaim.StatusEnum.SUBMITTED';
            nonString: true;
            object: 'expenseClaim';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\ExpenseClaim::STATUS_SUBMITTED';
            python_string: 'SUBMITTED';
            ruby: 'XeroRuby::Accounting::ExpenseClaim::SUBMITTED';
            status: null;
          },
          {
            default: 'user';
            is_variable: true;
            key: 'user';
            keyPascal: 'User';
            nonString: true;
            object: 'expenseClaim';
            set_user: null;
          },
          {
            default: 'receipts';
            is_last: true;
            is_variable: true;
            key: 'receipts';
            keyPascal: 'Receipts';
            nonString: true;
            object: 'expenseClaim';
            set_receipt: null;
          },
          {
            expenseClaims: null;
            is_object: true;
            key: 'expenseClaims';
            keyPascal: 'ExpenseClaims';
          },
          {
            add_expenseClaim: null;
            is_array_add: true;
            is_last: true;
            java: 'ExpenseClaims';
            key: 'expenseClaims';
            keyPascal: 'ExpenseClaims';
            keySnake: 'expense_claims';
            object: 'expenseClaim';
            python: 'expense_claim';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ expenseClaims: [{ status: ExpenseClaim.StatusEnum.SUBMITTED, user: { userID: "d1164823-0ac1-41ad-987b-b4e30fe0b273" }, receipts: [{ receiptID: "dc1c7f6d-0a4c-402f-acac-551d62ce5816", lineItems: [], contact: {}, user: {}, date: "2018-01-01" }]}]}';
        'x-ruby-requestBody': 'expense_claims = { expense_claims: [{ status: XeroRuby::Accounting::ExpenseClaim::SUBMITTED, user: { user_id: "d1164823-0ac1-41ad-987b-b4e30fe0b273" }, receipts: [{ receipt_id: "dc1c7f6d-0a4c-402f-acac-551d62ce5816", line_items: [], contact: {}, user: {}, date: "2018-01-01" }]}]}';
      };
    };
    '/ExpenseClaims/{ExpenseClaimID}': {
      get: {
        operationId: 'getExpenseClaim';
        parameters: [
          {
            description: 'Unique identifier for a ExpenseClaim';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ExpenseClaimID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "b54bb45d-37da-4f53-9f1d-536302d6bad7", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552325854864)\\/", "ExpenseClaims": [ { "ExpenseClaimID": "646b15ab-b874-4e13-82ae-f4385b2ac4b6", "Status": "AUTHORISED", "UpdatedDateUTC": "\\/Date(1552325851767+0000)\\/", "User": { "UserID": "d1164823-0ac1-41ad-987b-b4e30fe0b273", "EmailAddress": "api@xero.com", "FirstName": "API ", "LastName": "Team", "UpdatedDateUTC": "\\/Date(1511957179217+0000)\\/", "IsSubscriber": true, "OrganisationRole": "FINANCIALADVISER" }, "Receipts": [ { "ReceiptID": "dc1c7f6d-0a4c-402f-acac-551d62ce5816", "ReceiptNumber": 1, "Status": "AUTHORISED", "User": { "UserID": "d1164823-0ac1-41ad-987b-b4e30fe0b273", "EmailAddress": "api@xero.com", "FirstName": "API ", "LastName": "Team", "UpdatedDateUTC": "\\/Date(1511957179217+0000)\\/", "IsSubscriber": true, "OrganisationRole": "FINANCIALADVISER" }, "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "Name": "Liam Gallagher", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "Date": "\\/Date(1552348800000+0000)\\/", "UpdatedDateUTC": "\\/Date(1552325848457+0000)\\/", "Reference": "", "LineAmountTypes": "NoTax", "LineItems": [ { "Description": "Foobar", "UnitAmount": 20.00, "TaxType": "NONE", "TaxAmount": 0.00, "LineAmount": 40.00, "AccountCode": "400", "Tracking": [], "Quantity": 2.0000 } ], "SubTotal": 40.00, "TotalTax": 0.00, "Total": 40.00, "ID": "dc1c7f6d-0a4c-402f-acac-551d62ce5816", "HasAttachments": false } ], "Payments": [], "Total": 40.00, "AmountDue": 40.00, "AmountPaid": 0.00, "ReportingDate": "\\/Date(1552262400000+0000)\\/" } ] }';
                schema: {
                  $ref: '#/components/schemas/ExpenseClaims';
                };
              };
            };
            description: 'Success - return response of type ExpenseClaims array with specified ExpenseClaim';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves a specific expense claim using a unique expense claim Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateExpenseClaim';
        parameters: [
          {
            description: 'Unique identifier for a ExpenseClaim';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ExpenseClaimID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "ExpenseClaims": [ { "Status": "SUBMITTED", "User": { "UserID": "d1164823-0ac1-41ad-987b-b4e30fe0b273" }, "Receipts": [ { "Lineitems": [], "ReceiptID": "dc1c7f6d-0a4c-402f-acac-551d62ce5816" } ] } ] }';
              schema: {
                $ref: '#/components/schemas/ExpenseClaims';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "8ee87f9c-058b-4f1b-b5b2-29569bf055d7", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552325851907)\\/", "ExpenseClaims": [ { "ExpenseClaimID": "646b15ab-b874-4e13-82ae-f4385b2ac4b6", "Status": "AUTHORISED", "UpdatedDateUTC": "\\/Date(1552325851767+0000)\\/", "User": { "UserID": "d1164823-0ac1-41ad-987b-b4e30fe0b273", "EmailAddress": "api@xero.com", "FirstName": "API ", "LastName": "Team", "UpdatedDateUTC": "\\/Date(1511957179217+0000)\\/", "IsSubscriber": true, "OrganisationRole": "FINANCIALADVISER" }, "Receipts": [ { "ReceiptID": "dc1c7f6d-0a4c-402f-acac-551d62ce5816", "ReceiptNumber": 1, "Status": "AUTHORISED", "User": { "UserID": "d1164823-0ac1-41ad-987b-b4e30fe0b273", "EmailAddress": "api@xero.com", "FirstName": "API ", "LastName": "Team", "UpdatedDateUTC": "\\/Date(1511957179217+0000)\\/", "IsSubscriber": true, "OrganisationRole": "FINANCIALADVISER" }, "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "Name": "Liam Gallagher", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "Date": "\\/Date(1552348800000+0000)\\/", "UpdatedDateUTC": "\\/Date(1552325848457+0000)\\/", "Reference": "", "LineAmountTypes": "NoTax", "LineItems": [ { "Description": "Foobar", "UnitAmount": 20.00, "TaxType": "NONE", "TaxAmount": 0.00, "LineAmount": 40.00, "AccountCode": "400", "Tracking": [], "Quantity": 2.0000 } ], "SubTotal": 40.00, "TotalTax": 0.00, "Total": 40.00, "ID": "dc1c7f6d-0a4c-402f-acac-551d62ce5816", "HasAttachments": false } ], "Payments": [], "Total": 40.00, "AmountDue": 40.00, "AmountPaid": 0.00, "ReportingDate": "\\/Date(1552262400000+0000)\\/" } ] }';
                schema: {
                  $ref: '#/components/schemas/ExpenseClaims';
                };
              };
            };
            description: 'Success - return response of type ExpenseClaims array with updated ExpenseClaim';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Updates a specific expense claims';
        tags: ['Accounting'];
        'x-example': [
          {
            currDate: null;
            default: 'LocalDate.now()';
            is_date: true;
            java: 'LocalDate.now()';
            java_datatype: 'LocalDate';
            key: 'currDate';
            keyPascal: 'Date';
            keySnake: 'curr_date';
            php: "new DateTime('2019-12-10')";
            python: "dateutil.parser.parse('2020-12-03T00:00:00Z')";
          },
          {
            is_object: true;
            key: 'user';
            keyPascal: 'User';
            user: null;
          },
          {
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'userID';
            keyPascal: 'UserID';
            keySnake: 'user_id';
            object: 'user';
            userID: null;
          },
          {
            is_object: true;
            key: 'receipt';
            keyPascal: 'Receipt';
            receipt: null;
          },
          {
            default: '00000000-0000-0000-0000-000000000000';
            is_uuid: true;
            key: 'receiptID';
            keyPascal: 'ReceiptID';
            keySnake: 'receipt_id';
            object: 'receipt';
            receiptID: null;
          },
          {
            date: null;
            default: 'currDate';
            is_last: true;
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'receipt';
            python: 'curr_date';
          },
          {
            is_list: true;
            key: 'receipts';
            keyPascal: 'Receipt';
            receipts: null;
          },
          {
            add_receipts: null;
            is_last: true;
            is_list_add: true;
            key: 'receipts';
            keyPascal: 'Receipts';
            object: 'receipt';
          },
          {
            expenseClaim: null;
            is_object: true;
            key: 'expenseClaim';
            keyPascal: 'ExpenseClaim';
            keySnake: 'expense_claim';
          },
          {
            csharp: 'ExpenseClaim.xxx';
            default: 'SUBMITTED';
            java: 'com.xero.models.accounting.ExpenseClaim.StatusEnum.SUBMITTED';
            key: 'status';
            keyPascal: 'Status';
            node: 'ExpenseClaim.StatusEnum.SUBMITTED';
            nonString: true;
            object: 'expenseClaim';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\ExpenseClaim::STATUS_SUBMITTED';
            python_string: 'SUBMITTED';
            ruby: 'XeroRuby::Accounting::ExpenseClaim::SUBMITTED';
            status: null;
          },
          {
            default: 'user';
            is_variable: true;
            key: 'user';
            keyPascal: 'User';
            nonString: true;
            object: 'expenseClaim';
            set_user: null;
          },
          {
            default: 'receipts';
            is_last: true;
            is_variable: true;
            key: 'receipts';
            keyPascal: 'Receipts';
            nonString: true;
            object: 'expenseClaim';
            set_receipt: null;
          },
          {
            expenseClaims: null;
            is_object: true;
            key: 'expenseClaims';
            keyPascal: 'ExpenseClaims';
          },
          {
            add_expenseClaim: null;
            is_array_add: true;
            is_last: true;
            java: 'ExpenseClaims';
            key: 'expenseClaims';
            keyPascal: 'ExpenseClaims';
            keySnake: 'expense_claims';
            object: 'expenseClaim';
            python: 'expense_claim';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ expenseClaims: [{ status: ExpenseClaim.StatusEnum.AUTHORISED, user: { userID: "00000000-0000-0000-0000-000000000000" }, receipts: [{ receiptID: "00000000-0000-0000-0000-000000000000", lineItems: [], contact: {}, date: "2020-01-01", user: {} }]}]}';
        'x-ruby-requestBody': 'expense_claims = { expense_claims: [{ status: XeroRuby::Accounting::ExpenseClaim::AUTHORISED, user: { user_id: "00000000-0000-0000-0000-000000000000" }, receipts: [{ receipt_id: "00000000-0000-0000-0000-000000000000", line_items: [], contact: {}, date: "2020-01-01", user: {} }]}]}';
      };
    };
    '/ExpenseClaims/{ExpenseClaimID}/History': {
      get: {
        operationId: 'getExpenseClaimHistory';
        parameters: [
          {
            description: 'Unique identifier for a ExpenseClaim';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ExpenseClaimID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRetrieved';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves history records of a specific expense claim';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createExpenseClaimHistory';
        parameters: [
          {
            description: 'Unique identifier for a ExpenseClaim';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ExpenseClaimID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          $ref: '#/components/requestBodies/historyRecords';
        };
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRecordCreated';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates a history record for a specific expense claim';
        tags: ['Accounting'];
        'x-example': [
          {
            historyRecord: null;
            is_object: true;
            key: 'historyRecord';
            keyPascal: 'HistoryRecord';
            keySnake: 'history_record';
          },
          {
            Details: null;
            default: 'Hello World';
            is_last: true;
            key: 'details';
            keyPascal: 'Details';
            object: 'historyRecord';
          },
          {
            historyRecords: null;
            is_object: true;
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
          },
          {
            add_historyRecord: null;
            is_array_add: true;
            is_last: true;
            java: 'HistoryRecords';
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
            object: 'historyRecord';
            python: 'history_record';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/InvoiceReminders/Settings': {
      get: {
        operationId: 'getInvoiceReminders';
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "c7cd0953-c012-4be8-b618-63ce4c2c3494", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552331430618)\\/", "InvoiceReminders": [ { "Enabled": false } ] }';
                schema: {
                  $ref: '#/components/schemas/InvoiceReminders';
                };
              };
            };
            description: 'Success - return response of Invoice Reminders';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves invoice reminder settings';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Invoices': {
      get: {
        operationId: 'getInvoices';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter by an any element';
            example: 'Status=="DRAFT"';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-java': 'Status==&quot;&apos; + Invoice.StatusEnum.DRAFT + &apos;&quot;';
            'x-example-php': 'Status==&quot;&apos; . \\XeroAPI\\XeroPHP\\Models\\Accounting\\Invoice::STATUS_DRAFT . &apos;&quot;';
            'x-ruby-param': 'Status==#{XeroRuby::Accounting::Invoice::DRAFT}';
          },
          {
            description: 'Order by an any element';
            example: 'InvoiceNumber ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Filter by a comma-separated list of InvoicesIDs.';
            example: '&quot;00000000-0000-0000-0000-000000000000&quot;';
            explode: false;
            in: 'query';
            name: 'IDs';
            schema: {
              items: {
                format: 'uuid';
                type: 'string';
              };
              type: 'array';
            };
            style: 'form';
            'x-example-java': 'Arrays.asList(UUID.fromString("00000000-0000-0000-0000-000000000000"))';
            'x-example-php': '&quot;00000000-0000-0000-0000-000000000000&quot;';
          },
          {
            description: 'Filter by a comma-separated list of InvoiceNumbers.';
            example: '&quot;INV-001&quot;, &quot;INV-002&quot;';
            explode: false;
            in: 'query';
            name: 'InvoiceNumbers';
            schema: {
              items: {
                type: 'string';
              };
              type: 'array';
            };
            style: 'form';
            'x-example-java': 'Arrays.asList("INV-001","INV-002")';
            'x-example-php': '&quot;INV-001&quot;, &quot;INV-002&quot;';
          },
          {
            description: 'Filter by a comma-separated list of ContactIDs.';
            example: '&quot;00000000-0000-0000-0000-000000000000&quot;';
            explode: false;
            in: 'query';
            name: 'ContactIDs';
            schema: {
              items: {
                format: 'uuid';
                type: 'string';
              };
              type: 'array';
            };
            style: 'form';
            'x-example-java': 'Arrays.asList(UUID.fromString("00000000-0000-0000-0000-000000000000"))';
            'x-example-php': '&quot;00000000-0000-0000-0000-000000000000&quot;';
          },
          {
            description: 'Filter by a comma-separated list Statuses. For faster response times we recommend using these explicit parameters instead of passing OR conditions into the Where filter.';
            example: '&quot;DRAFT&quot;, &quot;SUBMITTED&quot;';
            explode: false;
            in: 'query';
            name: 'Statuses';
            schema: {
              items: {
                type: 'string';
              };
              type: 'array';
            };
            'x-example-java': 'Arrays.asList("DRAFT","SUBMITTED")';
            'x-example-php': '&quot;DRAFT&quot;, &quot;SUBMITTED&quot;';
          },
          {
            description: 'e.g. page=1 – Up to 100 invoices will be returned in a single API call with line items shown for each invoice';
            example: 1;
            in: 'query';
            name: 'page';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'e.g. includeArchived=true - Contacts with a status of ARCHIVED will be included in the response';
            in: 'query';
            name: 'includeArchived';
            schema: {
              type: 'boolean';
            };
          },
          {
            description: "When set to true you'll only retrieve Invoices created by your app";
            example: false;
            in: 'query';
            name: 'createdByMyApp';
            schema: {
              type: 'boolean';
            };
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "900c500b-e83c-4ce2-902a-b8ba04751748", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552326816230)\\/", "Invoices": [ { "Type": "ACCREC", "InvoiceID": "d4956132-ed94-4dd7-9eaa-aa22dfdf06f2", "InvoiceNumber": "INV-0001", "Reference": "Red Fish, Blue Fish", "Payments": [], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "AmountDue": 0.00, "AmountPaid": 0.00, "AmountCredited": 0.00, "SentToContact": true, "CurrencyRate": 1.000000, "HasErrors": false, "IsDiscounted": false, "HasAttachments": false, "RepeatingInvoiceID": "428c0d75-909f-4b04-8403-a48dc27283b0", "Contact": { "ContactID": "a3675fc4-f8dd-4f03-ba5b-f1870566bcd7", "Name": "Barney Rubble-83203", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2018-10-20T00:00:00", "Date": "\\/Date(1539993600000+0000)\\/", "DueDateString": "2018-12-30T00:00:00", "DueDate": "\\/Date(1546128000000+0000)\\/", "Status": "VOIDED", "LineAmountTypes": "Exclusive", "LineItems": [], "SubTotal": 40.00, "TotalTax": 0.00, "Total": 40.00, "UpdatedDateUTC": "\\/Date(1541176290160+0000)\\/", "CurrencyCode": "NZD" }, { "Type": "ACCREC", "InvoiceID": "046d8a6d-1ae1-4b4d-9340-5601bdf41b87", "InvoiceNumber": "INV-0002", "Reference": "Red Fish, Blue Fish", "Payments": [ { "PaymentID": "99ea7f6b-c513-4066-bc27-b7c65dcd76c2", "Date": "\\/Date(1543449600000+0000)\\/", "Amount": 46.00, "CurrencyRate": 1.000000, "HasAccount": false, "HasValidationErrors": false } ], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "AmountDue": 0.00, "AmountPaid": 46.00, "AmountCredited": 0.00, "SentToContact": true, "CurrencyRate": 1.000000, "HasErrors": false, "IsDiscounted": false, "HasAttachments": false, "Contact": { "ContactID": "a3675fc4-f8dd-4f03-ba5b-f1870566bcd7", "Name": "Barney Rubble-83203", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2018-10-20T00:00:00", "Date": "\\/Date(1539993600000+0000)\\/", "DueDateString": "2018-12-30T00:00:00", "DueDate": "\\/Date(1546128000000+0000)\\/", "Status": "PAID", "LineAmountTypes": "Exclusive", "LineItems": [], "SubTotal": 40.00, "TotalTax": 6.00, "Total": 46.00, "UpdatedDateUTC": "\\/Date(1541176592690+0000)\\/", "CurrencyCode": "NZD", "FullyPaidOnDate": "\\/Date(1543449600000+0000)\\/" }, { "Type": "ACCREC", "InvoiceID": "7ef31b20-de17-4312-8382-412f869b1510", "InvoiceNumber": "INV-0003", "Reference": "", "Payments": [], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "AmountDue": 115.00, "AmountPaid": 0.00, "AmountCredited": 0.00, "CurrencyRate": 1.000000, "HasErrors": false, "IsDiscounted": false, "HasAttachments": false, "Contact": { "ContactID": "a3675fc4-f8dd-4f03-ba5b-f1870566bcd7", "Name": "Barney Rubble-83203", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2018-11-02T00:00:00", "Date": "\\/Date(1541116800000+0000)\\/", "DueDateString": "2018-11-07T00:00:00", "DueDate": "\\/Date(1541548800000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "Exclusive", "LineItems": [], "SubTotal": 100.00, "TotalTax": 15.00, "Total": 115.00, "UpdatedDateUTC": "\\/Date(1541176648927+0000)\\/", "CurrencyCode": "NZD" } ] }';
                schema: {
                  $ref: '#/components/schemas/Invoices';
                };
              };
            };
            description: 'Success - return response of type Invoices array with all Invoices';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves sales invoices or purchase bills';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateOrCreateInvoices';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Invoices": [ { "Type": "ACCREC", "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8" }, "LineItems": [ { "Description": "Acme Tires", "Quantity": 2, "UnitAmount": 20, "AccountCode": "200", "TaxType": "NONE", "LineAmount": 40 } ], "Date": "2019-03-11", "DueDate": "2018-12-10", "Reference": "Website Design", "Status": "AUTHORISED" } ] }';
              schema: {
                $ref: '#/components/schemas/Invoices';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "ccece84a-075c-4fcd-9073-149d4f7a91cf", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552327126164)\\/", "Invoices": [ { "Type": "ACCREC", "InvoiceID": "ed255415-e141-4150-aab7-89c3bbbb851c", "InvoiceNumber": "INV-0007", "Reference": "Website Design", "Prepayments": [], "Overpayments": [], "AmountDue": 40.00, "AmountPaid": 0.00, "SentToContact": false, "CurrencyRate": 1.000000, "HasErrors": false, "IsDiscounted": false, "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "EmailAddress": "liam@rockstar.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "", "AttentionTo": "" }, { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551747281053+0000)\\/", "ContactGroups": [ { "ContactGroupID": "17b44ed7-4389-4162-91cb-3dd5766e4e22", "Name": "Oasis", "Status": "ACTIVE", "Contacts": [], "HasValidationErrors": false } ], "IsSupplier": true, "IsCustomer": true, "SalesTrackingCategories": [], "PurchasesTrackingCategories": [], "ContactPersons": [ { "FirstName": "Debbie", "LastName": "Gwyther", "EmailAddress": "debbie@rockstar.com", "IncludeInEmails": false } ], "HasValidationErrors": false }, "DateString": "2019-03-11T00:00:00", "Date": "\\/Date(1552262400000+0000)\\/", "DueDateString": "2018-12-10T00:00:00", "DueDate": "\\/Date(1544400000000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "Acme Tires", "UnitAmount": 20.00, "TaxType": "NONE", "TaxAmount": 0.00, "LineAmount": 40.00, "AccountCode": "200", "Tracking": [], "Quantity": 2.0000, "LineItemID": "5f7a612b-fdcc-4d33-90fa-a9f6bc6db32f", "ValidationErrors": [] } ], "SubTotal": 40.00, "TotalTax": 0.00, "Total": 40.00, "UpdatedDateUTC": "\\/Date(1552327126117+0000)\\/", "CurrencyCode": "NZD", "StatusAttributeString": "OK" } ] }';
                schema: {
                  $ref: '#/components/schemas/Invoices';
                };
              };
            };
            description: 'Success - return response of type Invoices array with newly created Invoice';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Updates or creates one or more sales invoices or purchase bills';
        tags: ['Accounting'];
        'x-example': [
          {
            dateValue: null;
            default: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            is_date: true;
            java: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            java_datatype: 'LocalDate';
            key: 'dateValue';
            keyPascal: 'Date';
            keySnake: 'date_value';
            php: "new DateTime('2020-10-10')";
            python: "dateutil.parser.parse('2020-10-10T00:00:00Z')";
          },
          {
            default: 'LocalDate.of(2020, Month.OCTOBER, 28)';
            dueDateValue: null;
            is_date: true;
            java: 'LocalDate.of(2020, Month.OCTOBER, 28)';
            java_datatype: 'LocalDate';
            key: 'dueDateValue';
            keyPascal: 'Date';
            keySnake: 'due_date_value';
            php: "new DateTime('2020-10-28')";
            python: "dateutil.parser.parse('2020-10-28T00:00:00Z')";
          },
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            contactID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'contactId';
            keyPascal: 'ContactID';
            keySnake: 'contact_id';
            object: 'contact';
          },
          {
            is_object: true;
            key: 'lineItem';
            keyPascal: 'LineItem';
            keySnake: 'line_item';
            lineItem: null;
          },
          {
            default: 'Foobar';
            description: null;
            key: 'description';
            keyPascal: 'Description';
            object: 'lineItem';
          },
          {
            default: 1;
            key: 'quantity';
            keyPascal: 'Quantity';
            nonString: true;
            object: 'lineItem';
            quantity: null;
          },
          {
            default: 20;
            key: 'unitAmount';
            keyPascal: 'UnitAmount';
            keySnake: 'unit_amount';
            nonString: true;
            object: 'lineItem';
            unitAmount: null;
          },
          {
            accountCode: null;
            default: '000';
            is_last: true;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'lineItem';
          },
          {
            is_list: true;
            key: 'lineItems';
            keyPascal: 'LineItem';
            keySnake: 'line_items';
            lineItems: null;
          },
          {
            add_lineitems: null;
            is_last: true;
            is_list_add: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            object: 'lineItem';
            python: 'line_item';
          },
          {
            invoice: null;
            is_object: true;
            key: 'invoice';
            keyPascal: 'Invoice';
          },
          {
            csharp: 'Invoice.xxx';
            default: 'ACCREC';
            java: 'com.xero.models.accounting.Invoice.TypeEnum.ACCREC';
            key: 'type';
            keyPascal: 'Type';
            node: 'Invoice.TypeEnum.ACCREC';
            nonString: true;
            object: 'invoice';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\Invoice::TYPE_ACCREC';
            python_string: 'ACCREC';
            ruby: 'XeroRuby::Accounting::Invoice::ACCREC';
            type: null;
          },
          {
            default: 'contact';
            is_variable: true;
            key: 'contact';
            keyPascal: 'Contact';
            nonString: true;
            object: 'invoice';
            set_contact: null;
          },
          {
            date: null;
            default: 'dateValue';
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'invoice';
            python: 'date_value';
          },
          {
            default: 'dueDateValue';
            dueDate: null;
            is_variable: true;
            key: 'dueDate';
            keyPascal: 'Date';
            keySnake: 'due_date';
            nonString: true;
            object: 'invoice';
            python: 'due_date_value';
          },
          {
            default: 'lineItems';
            is_variable: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            nonString: true;
            object: 'invoice';
            python: 'line_items';
            set_lineitem: null;
          },
          {
            default: 'Website Design';
            key: 'reference';
            keyPascal: 'Reference';
            object: 'invoice';
            reference: null;
          },
          {
            csharp: 'Invoice.xxx';
            default: 'DRAFT';
            is_last: true;
            java: 'com.xero.models.accounting.Invoice.StatusEnum.DRAFT';
            key: 'status';
            keyPascal: 'Status';
            node: 'Invoice.StatusEnum.DRAFT';
            nonString: true;
            object: 'invoice';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\Invoice::STATUS_DRAFT';
            python_string: 'DRAFT';
            ruby: 'XeroRuby::Accounting::Invoice::DRAFT';
            status: null;
          },
          {
            invoices: null;
            is_object: true;
            key: 'invoices';
            keyPascal: 'Invoices';
          },
          {
            add_invoice: null;
            is_array_add: true;
            is_last: true;
            java: 'Invoices';
            key: 'invoices';
            keyPascal: 'Invoices';
            object: 'invoice';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ invoices: [{ type: Invoice.TypeEnum.ACCREC, contact: { contactID:"00000000-0000-0000-0000-000000000000" }, lineItems:[ { description:"Acme Tires", quantity:2.0, unitAmount:20.0, accountCode:"200", taxType:"NONE", lineAmount:40.0 } ], date: "2019-03-11", dueDate:"2018-12-10", reference:"Website Design", status: Invoice.StatusEnum.AUTHORISED } ] }';
        'x-ruby-requestBody': 'invoices = { invoices: [{ type: XeroRuby::Accounting::Invoice::ACCREC, contact: { contact_id: "00000000-0000-0000-0000-000000000000" }, line_items: [{ description: "Acme Tires", quantity: 2.0, unit_amount: 20.0, account_code: "000", tax_type: XeroRuby::Accounting::TaxType::NONE, line_amount: 40.0 }], date: "2019-03-11", due_date: "2018-12-10", reference: "Website Design", status: XeroRuby::Accounting::Invoice::DRAFT }]}';
      };
      put: {
        operationId: 'createInvoices';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Invoices": [ { "Type": "ACCREC", "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8" }, "LineItems": [ { "Description": "Acme Tires", "Quantity": 2, "UnitAmount": 20, "AccountCode": "200", "TaxType": "NONE", "LineAmount": 40 } ], "Date": "2019-03-11", "DueDate": "2018-12-10", "Reference": "Website Design", "Status": "AUTHORISED" } ] }';
              schema: {
                $ref: '#/components/schemas/Invoices';
              };
            };
          };
          description: 'Invoices with an array of invoice objects in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "ccece84a-075c-4fcd-9073-149d4f7a91cf", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552327126164)\\/", "Invoices": [ { "Type": "ACCREC", "InvoiceID": "ed255415-e141-4150-aab7-89c3bbbb851c", "InvoiceNumber": "INV-0007", "Reference": "Website Design", "Prepayments": [], "Overpayments": [], "AmountDue": 40.00, "AmountPaid": 0.00, "SentToContact": false, "CurrencyRate": 1.000000, "HasErrors": false, "IsDiscounted": false, "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "EmailAddress": "liam@rockstar.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "", "AttentionTo": "" }, { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551747281053+0000)\\/", "ContactGroups": [ { "ContactGroupID": "17b44ed7-4389-4162-91cb-3dd5766e4e22", "Name": "Oasis", "Status": "ACTIVE", "Contacts": [], "HasValidationErrors": false } ], "IsSupplier": true, "IsCustomer": true, "SalesTrackingCategories": [], "PurchasesTrackingCategories": [], "ContactPersons": [ { "FirstName": "Debbie", "LastName": "Gwyther", "EmailAddress": "debbie@rockstar.com", "IncludeInEmails": false } ], "HasValidationErrors": false }, "DateString": "2019-03-11T00:00:00", "Date": "\\/Date(1552262400000+0000)\\/", "DueDateString": "2018-12-10T00:00:00", "DueDate": "\\/Date(1544400000000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "Acme Tires", "UnitAmount": 20.00, "TaxType": "NONE", "TaxAmount": 0.00, "LineAmount": 40.00, "AccountCode": "200", "Tracking": [], "Quantity": 2.0000, "LineItemID": "5f7a612b-fdcc-4d33-90fa-a9f6bc6db32f", "ValidationErrors": [] } ], "SubTotal": 40.00, "TotalTax": 0.00, "Total": 40.00, "UpdatedDateUTC": "\\/Date(1552327126117+0000)\\/", "CurrencyCode": "NZD", "StatusAttributeString": "OK" } ] }';
                schema: {
                  $ref: '#/components/schemas/Invoices';
                };
              };
            };
            description: 'Success - return response of type Invoices array with newly created Invoice';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates one or more sales invoices or purchase bills';
        tags: ['Accounting'];
        'x-example': [
          {
            dateValue: null;
            default: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            is_date: true;
            java: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            java_datatype: 'LocalDate';
            key: 'dateValue';
            keyPascal: 'Date';
            keySnake: 'date_value';
            php: "new DateTime('2020-10-10')";
            python: "dateutil.parser.parse('2020-10-10T00:00:00Z')";
          },
          {
            default: 'LocalDate.of(2020, Month.OCTOBER, 28)';
            dueDateValue: null;
            is_date: true;
            java: 'LocalDate.of(2020, Month.OCTOBER, 28)';
            java_datatype: 'LocalDate';
            key: 'dueDateValue';
            keyPascal: 'Date';
            keySnake: 'due_date_value';
            php: "new DateTime('2020-10-28')";
            python: "dateutil.parser.parse('2020-10-28T00:00:00Z')";
          },
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            contactID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'contactId';
            keyPascal: 'ContactID';
            keySnake: 'contact_id';
            object: 'contact';
          },
          {
            is_object: true;
            key: 'lineItem';
            keyPascal: 'LineItem';
            keySnake: 'line_item';
            lineItem: null;
          },
          {
            default: 'Foobar';
            description: null;
            key: 'description';
            keyPascal: 'Description';
            object: 'lineItem';
          },
          {
            default: 1;
            key: 'quantity';
            keyPascal: 'Quantity';
            nonString: true;
            object: 'lineItem';
            quantity: null;
          },
          {
            default: 20;
            key: 'unitAmount';
            keyPascal: 'UnitAmount';
            keySnake: 'unit_amount';
            nonString: true;
            object: 'lineItem';
            unitAmount: null;
          },
          {
            accountCode: null;
            default: '000';
            is_last: true;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'lineItem';
          },
          {
            is_list: true;
            key: 'lineItems';
            keyPascal: 'LineItem';
            keySnake: 'line_items';
            lineItems: null;
          },
          {
            add_lineitems: null;
            is_last: true;
            is_list_add: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            object: 'lineItem';
            python: 'line_item';
          },
          {
            invoice: null;
            is_object: true;
            key: 'invoice';
            keyPascal: 'Invoice';
          },
          {
            csharp: 'Invoice.xxx';
            default: 'ACCREC';
            java: 'com.xero.models.accounting.Invoice.TypeEnum.ACCREC';
            key: 'type';
            keyPascal: 'Type';
            node: 'Invoice.TypeEnum.ACCREC';
            nonString: true;
            object: 'invoice';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\Invoice::TYPE_ACCREC';
            python_string: 'ACCREC';
            ruby: 'XeroRuby::Accounting::Invoice::ACCREC';
            type: null;
          },
          {
            default: 'contact';
            is_variable: true;
            key: 'contact';
            keyPascal: 'Contact';
            nonString: true;
            object: 'invoice';
            set_contact: null;
          },
          {
            date: null;
            default: 'dateValue';
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'invoice';
            python: 'date_value';
          },
          {
            default: 'dueDateValue';
            dueDate: null;
            is_variable: true;
            key: 'dueDate';
            keyPascal: 'Date';
            keySnake: 'due_date';
            nonString: true;
            object: 'invoice';
            python: 'due_date_value';
          },
          {
            default: 'lineItems';
            is_variable: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            nonString: true;
            object: 'invoice';
            python: 'line_items';
            set_lineitem: null;
          },
          {
            default: 'Website Design';
            key: 'reference';
            keyPascal: 'Reference';
            object: 'invoice';
            reference: null;
          },
          {
            csharp: 'Invoice.xxx';
            default: 'DRAFT';
            is_last: true;
            java: 'com.xero.models.accounting.Invoice.StatusEnum.DRAFT';
            key: 'status';
            keyPascal: 'Status';
            node: 'Invoice.StatusEnum.DRAFT';
            nonString: true;
            object: 'invoice';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\Invoice::STATUS_DRAFT';
            python_string: 'DRAFT';
            ruby: 'XeroRuby::Accounting::Invoice::DRAFT';
            status: null;
          },
          {
            invoices: null;
            is_object: true;
            key: 'invoices';
            keyPascal: 'Invoices';
          },
          {
            add_invoice: null;
            is_array_add: true;
            is_last: true;
            java: 'Invoices';
            key: 'invoices';
            keyPascal: 'Invoices';
            object: 'invoice';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ invoices: [{ type: Invoice.TypeEnum.ACCREC, contact: { contactID: "00000000-0000-0000-0000-000000000000" }, lineItems: [{ description: "Acme Tires", quantity: 2.0, unitAmount: 20.0, accountCode: "000", taxType: TaxType.NONE, lineAmount: 40.0 }], date: "2019-03-11", dueDate: "2018-12-10", reference: "Website Design", status: Invoice.StatusEnum.DRAFT }]}';
        'x-ruby-requestBody': 'invoices = { invoices: [{ type: XeroRuby::Accounting::Invoice::ACCREC, contact: { contact_id: "00000000-0000-0000-0000-000000000000" }, line_items: [{ description: "Acme Tires", quantity: 2.0, unit_amount: 20.0, account_code: "000", tax_type: XeroRuby::Accounting::TaxType::NONE, line_amount: 40.0 }], date: "2019-03-11", due_date: "2018-12-10", reference: "Website Design", status: XeroRuby::Accounting::Invoice::DRAFT }]}';
      };
    };
    '/Invoices/{InvoiceID}': {
      get: {
        operationId: 'getInvoice';
        parameters: [
          {
            description: 'Unique identifier for an Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'InvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "516f400a-b764-4c88-831b-12d2b210fa24", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1551981658323)\\/", "Invoices": [ { "Type": "ACCREC", "InvoiceID": "a03ffcd2-5d91-4c7e-b483-318584e9e439", "InvoiceNumber": "INV-0006", "Reference": "Tour", "Payments": [ { "PaymentID": "38928000-e9a0-420c-8884-f624bab2a351", "Date": "\\/Date(1552953600000+0000)\\/", "Amount": 148062.76, "Reference": "Yahoo", "CurrencyRate": 1.000000, "HasAccount": false, "HasValidationErrors": false } ], "Prepayments": [], "Overpayments": [], "AmountDue": 0.00, "AmountPaid": 148062.76, "SentToContact": false, "CurrencyRate": 1.000000, "HasErrors": false, "IsDiscounted": false, "HasAttachments": true, "Attachments": [ { "AttachmentID": "3a2fe7e0-fac7-4ea2-afb2-31cedaabd294", "FileName": "helo-heros.jpg", "Url": "https://api.xero.com/api.xro/2.0/Invoices/a03ffcd2-5d91-4c7e-b483-318584e9e439/Attachments/helo-heros.jpg", "MimeType": "image/jpeg", "ContentLength": 2878711 } ], "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "EmailAddress": "liam@rockstar.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "", "AttentionTo": "" }, { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551747281053+0000)\\/", "ContactGroups": [ { "ContactGroupID": "17b44ed7-4389-4162-91cb-3dd5766e4e22", "Name": "Oasis", "Status": "ACTIVE", "Contacts": [], "HasValidationErrors": false } ], "IsSupplier": true, "IsCustomer": true, "SalesTrackingCategories": [], "PurchasesTrackingCategories": [], "ContactPersons": [ { "FirstName": "Debbie", "LastName": "Gwyther", "EmailAddress": "debbie@rockstar.com", "IncludeInEmails": false } ], "HasValidationErrors": false }, "DateString": "2019-03-07T00:00:00", "Date": "\\/Date(1551916800000+0000)\\/", "DueDateString": "2019-03-13T00:00:00", "DueDate": "\\/Date(1552435200000+0000)\\/", "Status": "PAID", "LineAmountTypes": "Exclusive", "LineItems": [ { "ItemCode": "123", "Description": "Guitars Fender Strat", "UnitAmount": 148062.76, "TaxType": "NONE", "TaxAmount": 0.00, "LineAmount": 148062.76, "AccountCode": "200", "Tracking": [], "Quantity": 1.0000, "LineItemID": "b18f39d9-7739-4246-9288-72afe939d2d5", "ValidationErrors": [] } ], "SubTotal": 148062.76, "TotalTax": 0.00, "Total": 148062.76, "UpdatedDateUTC": "\\/Date(1551981568133+0000)\\/", "CurrencyCode": "NZD", "FullyPaidOnDate": "\\/Date(1552953600000+0000)\\/", "StatusAttributeString": "ERROR", "ValidationErrors": [ { "Message": "Invoice # must be unique." } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Invoices';
                };
              };
            };
            description: 'Success - return response of type Invoices array with specified Invoices';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves a specific sales invoice or purchase bill using a unique invoice Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateInvoice';
        parameters: [
          {
            description: 'Unique identifier for an Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'InvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Invoices": [{ Reference: "May the force be with you", "InvoiceID": "00000000-0000-0000-0000-000000000000", "LineItems": [], "Contact": {}, "Type": "ACCPAY" }]}';
              schema: {
                $ref: '#/components/schemas/Invoices';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "bd83b60e-9d16-4a3b-9f59-0a2d0ccd35f2", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552329729002)\\/", "Invoices": [ { "Type": "ACCREC", "InvoiceID": "4074292c-09b3-456d-84e7-add864c6c39b", "InvoiceNumber": "INV-0008", "Reference": "My the Force be With You", "Prepayments": [], "Overpayments": [], "AmountDue": 575.00, "AmountPaid": 0.00, "SentToContact": false, "CurrencyRate": 1.000000, "HasErrors": false, "IsDiscounted": false, "Contact": { "ContactID": "be392c72-c121-4f83-9512-03ac71e54c20", "ContactStatus": "ACTIVE", "Name": "Luke Skywalker", "EmailAddress": "", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "" }, { "AddressType": "POBOX", "City": "", "Region": "", "PostalCode": "", "Country": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1552329691573+0000)\\/", "ContactGroups": [], "IsSupplier": false, "IsCustomer": true, "DefaultCurrency": "NZD", "SalesTrackingCategories": [], "PurchasesTrackingCategories": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-03-11T00:00:00", "Date": "\\/Date(1552262400000+0000)\\/", "DueDateString": "2019-03-12T00:00:00", "DueDate": "\\/Date(1552348800000+0000)\\/", "Status": "SUBMITTED", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "Light Saber", "UnitAmount": 500.00, "TaxType": "OUTPUT2", "TaxAmount": 75.00, "LineAmount": 500.00, "AccountCode": "200", "Tracking": [], "Quantity": 1.0000, "LineItemID": "6de1bf9f-de95-4c47-9287-37305db758c9", "ValidationErrors": [] } ], "SubTotal": 500.00, "TotalTax": 75.00, "Total": 575.00, "UpdatedDateUTC": "\\/Date(1552329728987+0000)\\/", "CurrencyCode": "NZD" } ] }';
                schema: {
                  $ref: '#/components/schemas/Invoices';
                };
              };
            };
            description: 'Success - return response of type Invoices array with updated Invoice';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Updates a specific sales invoices or purchase bills';
        tags: ['Accounting'];
        'x-example': [
          {
            invoice: null;
            is_object: true;
            key: 'invoice';
            keyPascal: 'Invoice';
          },
          {
            default: 'I am Iron man';
            is_last: true;
            key: 'reference';
            keyPascal: 'Reference';
            object: 'invoice';
            reference: null;
          },
          {
            invoices: null;
            is_object: true;
            key: 'invoices';
            keyPascal: 'Invoices';
          },
          {
            add_invoice: null;
            is_array_add: true;
            is_last: true;
            java: 'Invoices';
            key: 'invoices';
            keyPascal: 'Invoices';
            object: 'invoice';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ invoices: [{ reference: "I am Iron Man", invoiceID: "00000000-0000-0000-0000-000000000000", lineItems: [], contact: {}, type: Invoice.TypeEnum.ACCPAY }]}';
        'x-ruby-requestBody': 'invoices = { invoices: [{ reference: "I am Iron Man", invoice_id: "00000000-0000-0000-0000-000000000000", line_items: [], contact: {}, type: XeroRuby::Accounting::Invoice::ACCPAY }]}';
      };
    };
    '/Invoices/{InvoiceID}/Attachments': {
      get: {
        operationId: 'getInvoiceAttachments';
        parameters: [
          {
            description: 'Unique identifier for an Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'InvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: ' { "Id": "7e357a45-69f5-4e8f-8d7b-15da8ef50aab", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552330258523)\\/", "Attachments": [ { "AttachmentID": "9808ad7f-c8d4-41cf-995e-bc29cb76fd2c", "FileName": "foobar.jpg", "Url": "https://api.xero.com/api.xro/2.0/Invoices/4074292c-09b3-456d-84e7-add864c6c39b/Attachments/foobar.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 }, { "AttachmentID": "5a500c1a-5a02-48de-939e-1d234fd170d4", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/Invoices/4074292c-09b3-456d-84e7-add864c6c39b/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array of Attachments for specified Invoices';
            'x-isAttachment': true;
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves attachments for a specific invoice or purchase bill';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Invoices/{InvoiceID}/Attachments/{AttachmentID}': {
      get: {
        operationId: 'getInvoiceAttachmentById';
        parameters: [
          {
            description: 'Unique identifier for an Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'InvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Unique identifier for an Attachment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AttachmentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Invoice as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves a specific attachment from a specific invoices or purchase bills by using a unique attachment Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Invoices/{InvoiceID}/Attachments/{FileName}': {
      get: {
        operationId: 'getInvoiceAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for an Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'InvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name of the file you are attaching';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Invoice as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves an attachment from a specific invoice or purchase bill by filename';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateInvoiceAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for an Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'InvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name of the file you are attaching';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "acd7d618-5fef-4d45-849c-a339ea31a973", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552330524005)\\/", "Attachments": [ { "AttachmentID": "08085449-fda3-45f4-a685-ff44c8a29ee3", "FileName": "HelloWorld.jpg", "Url": "https://api.xero.com/api.xro/2.0/Invoices/4074292c-09b3-456d-84e7-add864c6c39b/Attachments/HelloWorld.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array with updated Attachment';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Updates an attachment from a specific invoices or purchase bill by filename';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
      put: {
        operationId: 'createInvoiceAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for an Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'InvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name of the file you are attaching';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            $ref: '#/components/parameters/includeOnline';
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "971fbd18-c850-453a-825f-63f2fee096ee", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552330001318)\\/", "Attachments": [ { "AttachmentID": "5a500c1a-5a02-48de-939e-1d234fd170d4", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/Invoices/4074292c-09b3-456d-84e7-add864c6c39b/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array with newly created Attachment';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Creates an attachment for a specific invoice or purchase bill by filename';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
    };
    '/Invoices/{InvoiceID}/Email': {
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'emailInvoice';
        parameters: [
          {
            description: 'Unique identifier for an Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'InvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{}';
              schema: {
                $ref: '#/components/schemas/RequestEmpty';
              };
            };
          };
          required: true;
        };
        responses: {
          '204': {
            description: 'Success - return response 204 no content';
            'x-isEmpty': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Sends a copy of a specific invoice to related contact via email';
        tags: ['Accounting'];
        'x-example': [
          {
            is_last: true;
            is_object: true;
            key: 'requestEmpty';
            keyPascal: 'RequestEmpty';
            requestEmpty: null;
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/Invoices/{InvoiceID}/History': {
      get: {
        operationId: 'getInvoiceHistory';
        parameters: [
          {
            description: 'Unique identifier for an Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'InvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRetrieved';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves history records for a specific invoice';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createInvoiceHistory';
        parameters: [
          {
            description: 'Unique identifier for an Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'InvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          $ref: '#/components/requestBodies/historyRecords';
        };
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRecordCreated';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates a history record for a specific invoice';
        tags: ['Accounting'];
        'x-example': [
          {
            historyRecord: null;
            is_object: true;
            key: 'historyRecord';
            keyPascal: 'HistoryRecord';
            keySnake: 'history_record';
          },
          {
            Details: null;
            default: 'Hello World';
            is_last: true;
            key: 'details';
            keyPascal: 'Details';
            object: 'historyRecord';
          },
          {
            historyRecords: null;
            is_object: true;
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
          },
          {
            add_historyRecord: null;
            is_array_add: true;
            is_last: true;
            java: 'HistoryRecords';
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
            object: 'historyRecord';
            python: 'history_record';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/Invoices/{InvoiceID}/OnlineInvoice': {
      get: {
        operationId: 'getOnlineInvoice';
        parameters: [
          {
            description: 'Unique identifier for an Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'InvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "d20705fb-fe1c-4366-835b-98de7474da3c", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552331100745)\\/", "OnlineInvoices": [ { "OnlineInvoiceUrl": "https://in.xero.com/bCWCCfytGdTXoJam9HENWlQt07G6zcDaj4gQojHu" } ] }';
                schema: {
                  $ref: '#/components/schemas/OnlineInvoices';
                };
              };
            };
            description: 'Success - return response of type OnlineInvoice array with one OnlineInvoice';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves a URL to an online invoice';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Invoices/{InvoiceID}/pdf': {
      get: {
        operationId: 'getInvoiceAsPdf';
        parameters: [
          {
            description: 'Unique identifier for an Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'InvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/pdf': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of byte array pdf version of specified Invoices';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves invoices or purchase bills as PDF files';
        tags: ['Accounting'];
        'x-path': '/Invoices/{InvoiceID}';
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Items': {
      get: {
        operationId: 'getItems';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter by an any element';
            example: 'IsSold==true';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Order by an any element';
            example: 'Code ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "8487e8d7-5fb3-4f02-b949-dec8f1e38182", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552331874897)\\/", "Items": [ { "ItemID": "c8c54d65-f3f2-452d-926e-bf450b12fb07", "Code": "123", "Description": "Guitars Fender Strat", "UpdatedDateUTC": "\\/Date(1551981476267+0000)\\/", "PurchaseDetails": {}, "SalesDetails": { "UnitPrice": 5000.0000, "AccountCode": "200", "TaxType": "OUTPUT2" }, "Name": "Guitars", "IsTrackedAsInventory": false, "IsSold": true, "IsPurchased": false }, { "ItemID": "a4544d51-48f6-441f-a623-99ecbced6ab7", "Code": "abc65591", "Description": "Barfoo", "UpdatedDateUTC": "\\/Date(1552331873580+0000)\\/", "PurchaseDetails": {}, "SalesDetails": {}, "Name": "Hello11350", "IsTrackedAsInventory": false, "IsSold": true, "IsPurchased": true } ] }';
                schema: {
                  $ref: '#/components/schemas/Items';
                };
              };
            };
            description: 'Success - return response of type Items array with all Item';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings.read'];
          },
        ];
        summary: 'Retrieves items';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateOrCreateItems';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Items": [ { "Code": "ItemCode123", "Name": "ItemName XYZ", "Description": "Item Description ABC" } ] }';
              schema: {
                $ref: '#/components/schemas/Items';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "ae7ef7c8-9024-4d42-8d59-5f26ed3f508b", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552331871904)\\/", "Items": [ { "ItemID": "a4544d51-48f6-441f-a623-99ecbced6ab7", "Code": "abc65591", "Description": "foobar", "UpdatedDateUTC": "\\/Date(1552331871707)\\/", "PurchaseDetails": {}, "SalesDetails": {}, "Name": "Hello11350", "IsTrackedAsInventory": false, "IsSold": true, "IsPurchased": true, "ValidationErrors": [ { "Message": "Price List Item with Code \'abc\' already exists" } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Items';
                };
              };
            };
            description: 'Success - return response of type Items array with newly created Item';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Updates or creates one or more items';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            item: null;
            key: 'item';
            keyPascal: 'Item';
          },
          {
            code: null;
            default: 'abcXYZ123';
            key: 'code';
            keyPascal: 'Code';
            object: 'item';
          },
          {
            default: 'HelloWorld';
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'item';
          },
          {
            default: 'Foobar';
            description: null;
            is_last: true;
            key: 'description';
            keyPascal: 'Description';
            object: 'item';
          },
          {
            is_object: true;
            items: null;
            key: 'items';
            keyPascal: 'Items';
          },
          {
            add_item: null;
            is_array_add: true;
            is_last: true;
            java: 'Items';
            key: 'items';
            keyPascal: 'Items';
            object: 'item';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ items: [{ code: "ItemCode123", name: "ItemName XYZ", description: "Item Description ABC" }]}';
        'x-ruby-requestBody': 'items = { items: [{ code: "ItemCode123", name: "ItemName XYZ", description: "Item Description ABC" }]}';
      };
      put: {
        operationId: 'createItems';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Items": [ { "Code": "code123", "Name": "Item Name XYZ", "Description": "Foobar", "InventoryAssetAccountCode": "140", "PurchaseDetails": { "COGSAccountCode": "500" } } ] }';
              schema: {
                $ref: '#/components/schemas/Items';
              };
            };
          };
          description: 'Items with an array of Item objects in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "ae7ef7c8-9024-4d42-8d59-5f26ed3f508b", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552331871904)\\/", "Items": [ { "ItemID": "a4544d51-48f6-441f-a623-99ecbced6ab7", "Code": "abc65591", "Description": "foobar", "UpdatedDateUTC": "\\/Date(1552331871707)\\/", "PurchaseDetails": {}, "SalesDetails": {}, "Name": "Hello11350", "IsTrackedAsInventory": false, "IsSold": true, "IsPurchased": true, "ValidationErrors": [ { "Message": "Price List Item with Code \'abc\' already exists" } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Items';
                };
              };
            };
            description: 'Success - return response of type Items array with newly created Item';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Creates one or more items';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            key: 'purchaseDetails';
            keyPascal: 'Purchase';
            keySnake: 'purchase_details';
            purchaseDetails: null;
          },
          {
            cOGSAccountCode: null;
            default: 500;
            is_last: true;
            key: 'cOGSAccountCode';
            keyPascal: 'CoGSAccountCode';
            keySnake: 'cogs_account_code';
            object: 'purchaseDetails';
          },
          {
            is_object: true;
            item: null;
            key: 'item';
            keyPascal: 'Item';
          },
          {
            code: null;
            default: 'abcXYZ123';
            key: 'code';
            keyPascal: 'Code';
            object: 'item';
          },
          {
            default: 'HelloWorld';
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'item';
          },
          {
            default: 'Foobar';
            description: null;
            key: 'description';
            keyPascal: 'Description';
            object: 'item';
          },
          {
            default: 140;
            inventoryAssetAccountCode: null;
            key: 'inventoryAssetAccountCode';
            keyPascal: 'InventoryAssetAccountCode';
            keySnake: 'inventory_asset_account_code';
            object: 'item';
          },
          {
            default: 'purchaseDetails';
            is_last: true;
            is_variable: true;
            key: 'purchaseDetails';
            keyPascal: 'PurchaseDetails';
            keySnake: 'purchase_details';
            nonString: true;
            object: 'item';
            python: 'purchase_details';
            set_purchaseDetails: null;
          },
          {
            is_object: true;
            items: null;
            key: 'items';
            keyPascal: 'Items';
          },
          {
            add_item: null;
            is_array_add: true;
            is_last: true;
            java: 'Items';
            key: 'items';
            keyPascal: 'Items';
            object: 'item';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ items: [{ code: "abcXYZ123", name: "HelloWorld11", description: "Foobar", inventoryAssetAccountCode: "140", purchaseDetails: { cOGSAccountCode: "500" }}]}';
        'x-ruby-requestBody': 'items = { items: [{ code: "abcXYZ123", name: "HelloWorld11", description: "Foobar", inventory_asset_account_code: "140", purchase_details: { cogs_account_code: "500" }}]}';
      };
    };
    '/Items/{ItemID}': {
      delete: {
        operationId: 'deleteItem';
        parameters: [
          {
            description: 'Unique identifier for an Item';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ItemID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '204': {
            description: 'Success - return response 204 no content';
            'x-isEmpty': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Deletes a specific item';
        tags: ['Accounting'];
      };
      get: {
        operationId: 'getItem';
        parameters: [
          {
            description: 'Unique identifier for an Item';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ItemID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "0bbd8a92-9ba7-4711-8040-8d6a609ca7e8", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552333420160)\\/", "Items": [ { "ItemID": "c8c54d65-f3f2-452d-926e-bf450b12fb07", "Code": "123", "Description": "Guitars Fender Strat", "PurchaseDescription": "Brand new Fender Strats", "UpdatedDateUTC": "\\/Date(1552333309387+0000)\\/", "PurchaseDetails": { "UnitPrice": 2500.0000, "COGSAccountCode": "310", "TaxType": "INPUT2" }, "SalesDetails": { "UnitPrice": 5000.0000, "AccountCode": "200", "TaxType": "OUTPUT2" }, "Name": "Guitars", "IsTrackedAsInventory": true, "InventoryAssetAccountCode": "630", "TotalCostPool": 25000.00, "QuantityOnHand": 10.0000, "IsSold": true, "IsPurchased": true, "ValidationErrors": [] } ] }';
                schema: {
                  $ref: '#/components/schemas/Items';
                };
              };
            };
            description: 'Success - return response of type Items array with specified Item';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings.read'];
          },
        ];
        summary: 'Retrieves a specific item using a unique item Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateItem';
        parameters: [
          {
            description: 'Unique identifier for an Item';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ItemID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Items": [ { "Code": "ItemCode123", "Description": "Description 123" } ] }';
              schema: {
                $ref: '#/components/schemas/Items';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "24feb629-6b14-499e-9aa1-fc2c596c0280", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552332558975)\\/", "Items": [ { "ItemID": "a7e87086-e0ae-4df2-83d7-e26e9a6b7786", "Code": "abc38306", "Description": "Hello Xero", "UpdatedDateUTC": "\\/Date(1552332558924)\\/", "PurchaseDetails": {}, "SalesDetails": {}, "Name": "Hello8746", "IsTrackedAsInventory": false, "IsSold": true, "IsPurchased": true, "ValidationErrors": [] } ] }';
                schema: {
                  $ref: '#/components/schemas/Items';
                };
              };
            };
            description: 'Success - return response of type Items array with updated Item';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Updates a specific item';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            item: null;
            key: 'item';
            keyPascal: 'Item';
          },
          {
            code: null;
            default: 'ItemCode123';
            key: 'code';
            keyPascal: 'Code';
            object: 'item';
          },
          {
            default: 'Goodbye';
            description: null;
            is_last: true;
            key: 'description';
            keyPascal: 'Description';
            object: 'item';
          },
          {
            is_object: true;
            items: null;
            key: 'items';
            keyPascal: 'Items';
          },
          {
            add_item: null;
            is_array_add: true;
            is_last: true;
            java: 'Items';
            key: 'items';
            keyPascal: 'Items';
            object: 'item';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ items: [{ code: "ItemCode123", description: "Description 123" }]}';
        'x-ruby-requestBody': 'items = { items: [{ code: "ItemCode123", description: "Description 123" }]}';
      };
    };
    '/Items/{ItemID}/History': {
      get: {
        operationId: 'getItemHistory';
        parameters: [
          {
            description: 'Unique identifier for an Item';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ItemID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRetrieved';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings.read'];
          },
        ];
        summary: 'Retrieves history for a specific item';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createItemHistory';
        parameters: [
          {
            description: 'Unique identifier for an Item';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ItemID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          $ref: '#/components/requestBodies/historyRecords';
        };
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRecordCreated';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Creates a history record for a specific item';
        tags: ['Accounting'];
        'x-example': [
          {
            historyRecord: null;
            is_object: true;
            key: 'historyRecord';
            keyPascal: 'HistoryRecord';
            keySnake: 'history_record';
          },
          {
            Details: null;
            default: 'Hello World';
            is_last: true;
            key: 'details';
            keyPascal: 'Details';
            object: 'historyRecord';
          },
          {
            historyRecords: null;
            is_object: true;
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
          },
          {
            add_historyRecord: null;
            is_array_add: true;
            is_last: true;
            java: 'HistoryRecords';
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
            object: 'historyRecord';
            python: 'history_record';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/Journals': {
      get: {
        operationId: 'getJournals';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Offset by a specified journal number. e.g. journals with a JournalNumber greater than the offset will be returned';
            example: 10;
            in: 'query';
            name: 'offset';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Filter to retrieve journals on a cash basis. Journals are returned on an accrual basis by default.';
            in: 'query';
            name: 'paymentsOnly';
            schema: {
              type: 'boolean';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "49a09a97-df50-4679-8043-02c86e0dcf5f", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552335214210)\\/", "Journals": [ { "JournalID": "1b31feeb-aa23-404c-8c19-24c827c53661", "JournalDate": "\\/Date(1539993600000+0000)\\/", "JournalNumber": 1, "CreatedDateUTC": "\\/Date(1541176243467+0000)\\/", "Reference": "Red Fish, Blue Fish", "SourceID": "d4956132-ed94-4dd7-9eaa-aa22dfdf06f2", "SourceType": "ACCREC", "JournalLines": [ { "JournalLineID": "81e6b1bf-d812-4f87-8dc4-698558ae043e", "AccountID": "b94495d0-44ab-4199-a1d0-427a4877e100", "AccountCode": "610", "AccountType": "CURRENT", "AccountName": "Accounts Receivable", "Description": "", "NetAmount": 40.00, "GrossAmount": 40.00, "TaxAmount": 0.00, "TrackingCategories": [] }, { "JournalLineID": "ad221a8c-ebee-4c1b-88ed-d574e27e8803", "AccountID": "e0a5d892-9f9f-44f0-a153-5cb7db125170", "AccountCode": "200", "AccountType": "REVENUE", "AccountName": "Sales", "Description": "Acme Tires", "NetAmount": -40.00, "GrossAmount": -40.00, "TaxAmount": 0.00, "TaxType": "NONE", "TaxName": "No GST", "TrackingCategories": [] } ] }, { "JournalID": "2be66e45-805b-46de-921d-c67e1d3dad2a", "JournalDate": "\\/Date(1539993600000+0000)\\/", "JournalNumber": 9, "CreatedDateUTC": "\\/Date(1541176504083+0000)\\/", "Reference": "Red Fish, Blue Fish", "SourceID": "046d8a6d-1ae1-4b4d-9340-5601bdf41b87", "SourceType": "ACCREC", "JournalLines": [ { "JournalLineID": "ba8a5680-a753-4a35-b3dd-0bc72e5c26a1", "AccountID": "b94495d0-44ab-4199-a1d0-427a4877e100", "AccountCode": "610", "AccountType": "CURRENT", "AccountName": "Accounts Receivable", "Description": "", "NetAmount": 40.00, "GrossAmount": 40.00, "TaxAmount": 0.00, "TrackingCategories": [] }, { "JournalLineID": "09a0b9b9-0222-4e24-8c31-efef472e22f1", "AccountID": "e0a5d892-9f9f-44f0-a153-5cb7db125170", "AccountCode": "200", "AccountType": "REVENUE", "AccountName": "Sales", "Description": "Acme Tires", "NetAmount": -40.00, "GrossAmount": -40.00, "TaxAmount": 0.00, "TaxType": "NONE", "TaxName": "No GST", "TrackingCategories": [] } ] }, { "JournalID": "d0ed2957-ebba-4d3a-8367-ae9ccd574885", "JournalDate": "\\/Date(1543449600000+0000)\\/", "JournalNumber": 14, "CreatedDateUTC": "\\/Date(1541176592673+0000)\\/", "SourceID": "99ea7f6b-c513-4066-bc27-b7c65dcd76c2", "SourceType": "ACCRECPAYMENT", "JournalLines": [ { "JournalLineID": "1bdae2b7-3035-40ec-b344-b12b1c23adc4", "AccountID": "b94495d0-44ab-4199-a1d0-427a4877e100", "AccountCode": "610", "AccountType": "CURRENT", "AccountName": "Accounts Receivable", "Description": "", "NetAmount": -46.00, "GrossAmount": -46.00, "TaxAmount": 0.00, "TrackingCategories": [] }, { "JournalLineID": "353be85e-ae79-4bb3-9483-5ea7682fc0a3", "AccountID": "5690f1e8-1d02-4893-90c2-ee1a69eff942", "AccountCode": "970", "AccountType": "EQUITY", "AccountName": "Owner A Funds Introduced", "Description": "", "NetAmount": 46.00, "GrossAmount": 46.00, "TaxAmount": 0.00, "TrackingCategories": [] } ] }, { "JournalID": "772e8133-7f12-4edc-ab98-aa6dceb16c9d", "JournalDate": "\\/Date(1552262400000+0000)\\/", "JournalNumber": 30, "CreatedDateUTC": "\\/Date(1552333389227+0000)\\/", "Reference": "", "SourceID": "5376633d-0456-43a3-8234-e457a3f50a12", "SourceType": "ACCPAY", "JournalLines": [ { "JournalLineID": "33469836-642f-4973-a708-0e99339dff4a", "AccountID": "a2a4795b-a01f-40eb-afa6-a34b4514875d", "AccountCode": "800", "AccountType": "CURRLIAB", "AccountName": "Accounts Payable", "Description": "", "NetAmount": -28750.00, "GrossAmount": -28750.00, "TaxAmount": 0.00, "TrackingCategories": [] }, { "JournalLineID": "4f3b6462-5cf6-4b55-a2ae-de4039878215", "AccountID": "53a12a15-7e9b-4a31-85f4-a7cee6d04215", "AccountCode": "630", "AccountType": "CURRENT", "AccountName": "Inventory", "Description": "Brand new Fender Strats", "NetAmount": 25000.00, "GrossAmount": 28750.00, "TaxAmount": 3750.00, "TaxType": "INPUT2", "TaxName": "15% GST on Expenses", "TrackingCategories": [] }, { "JournalLineID": "534e822e-d441-48a7-8e57-5ad54729e83e", "AccountID": "17d9a4a0-3181-4803-a96b-f0dbe589091b", "AccountCode": "820", "AccountType": "CURRLIAB", "AccountName": "GST", "Description": "", "NetAmount": 3750.00, "GrossAmount": 3750.00, "TaxAmount": 0.00, "TrackingCategories": [] } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Journals';
                };
              };
            };
            description: 'Success - return response of type Journals array with all Journals';
          };
        };
        security: [
          {
            OAuth2: ['accounting.journals.read'];
          },
        ];
        summary: 'Retrieves journals';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Journals/{JournalID}': {
      get: {
        operationId: 'getJournal';
        parameters: [
          {
            description: 'Unique identifier for a Journal';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'JournalID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "39ab8367-eb14-420d-83a9-e01ddddd21f8", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552335613002)\\/", "Journals": [ { "JournalID": "1b31feeb-aa23-404c-8c19-24c827c53661", "JournalDate": "\\/Date(1539993600000+0000)\\/", "JournalNumber": 1, "CreatedDateUTC": "\\/Date(1541176243467+0000)\\/", "Reference": "Red Fish, Blue Fish", "JournalLines": [ { "JournalLineID": "81e6b1bf-d812-4f87-8dc4-698558ae043e", "AccountID": "b94495d0-44ab-4199-a1d0-427a4877e100", "AccountCode": "610", "AccountType": "CURRENT", "AccountName": "Accounts Receivable", "Description": "", "NetAmount": 40.00, "GrossAmount": 40.00, "TaxAmount": 0.00, "TaxType": "", "TaxName": "", "TrackingCategories": [] }, { "JournalLineID": "ad221a8c-ebee-4c1b-88ed-d574e27e8803", "AccountID": "e0a5d892-9f9f-44f0-a153-5cb7db125170", "AccountCode": "200", "AccountType": "REVENUE", "AccountName": "Sales", "Description": "Acme Tires", "NetAmount": -40.00, "GrossAmount": -40.00, "TaxAmount": 0.00, "TaxType": "NONE", "TaxName": "No GST", "TrackingCategories": [] } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Journals';
                };
              };
            };
            description: 'Success - return response of type Journals array with specified Journal';
          };
        };
        security: [
          {
            OAuth2: ['accounting.journals.read'];
          },
        ];
        summary: 'Retrieves a specific journal using a unique journal Id.';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/LinkedTransactions': {
      get: {
        operationId: 'getLinkedTransactions';
        parameters: [
          {
            description: 'Up to 100 linked transactions will be returned in a single API call. Use the page parameter to specify the page to be returned e.g. page=1.';
            example: 1;
            in: 'query';
            name: 'page';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'The Xero identifier for an Linked Transaction';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'query';
            name: 'LinkedTransactionID';
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Filter by the SourceTransactionID. Get the linked transactions created from a particular ACCPAY invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'query';
            name: 'SourceTransactionID';
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Filter by the ContactID. Get all the linked transactions that have been assigned to a particular customer.';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'query';
            name: 'ContactID';
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Filter by the combination of ContactID and Status. Get  the linked transactions associated to a  customer and with a status';
            example: 'APPROVED';
            in: 'query';
            name: 'Status';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Filter by the TargetTransactionID. Get all the linked transactions allocated to a particular ACCREC invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'query';
            name: 'TargetTransactionID';
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "516aabd0-e670-48d5-b0eb-10dce4494dd8", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552348338096)\\/", "LinkedTransactions": [ { "LinkedTransactionID": "5cf7d9c0-b9a7-4433-a2dc-ae3c11bba39b", "SourceTransactionID": "aec416dd-38ea-40dc-9f0b-813c8c71f87f", "SourceLineItemID": "77e0b23b-5b79-4f4b-ae20-c9031d41442f", "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "TargetTransactionID": "83693fc1-5b05-4807-b190-109d4a85dd5f", "TargetLineItemID": "d5128ff1-0f39-4d2a-a6d5-46dfaf5f075c", "Status": "ONDRAFT", "Type": "BILLABLEEXPENSE", "UpdatedDateUTC": "\\/Date(1552347991000+0000)\\/", "SourceTransactionTypeCode": "ACCPAY" } ] }';
                schema: {
                  $ref: '#/components/schemas/LinkedTransactions';
                };
              };
            };
            description: 'Success - return response of type LinkedTransactions array with all LinkedTransaction';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves linked transactions (billable expenses)';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createLinkedTransaction';
        requestBody: {
          content: {
            'application/json': {
              example: '{ "LinkedTransactions": [ { "SourceTransactionID": "a848644a-f20f-4630-98c3-386bd7505631", "SourceLineItemID": "b0df260d-3cc8-4ced-9bd6-41924f624ed3" } ] }';
              schema: {
                $ref: '#/components/schemas/LinkedTransaction';
              };
            };
          };
          description: 'LinkedTransaction object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "f32b30e5-32d1-42a8-bcc9-5b22828f725c", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552351054646)\\/", "LinkedTransactions": [ { "LinkedTransactionID": "e9684b6c-4df9-45a0-917b-85cc29857008", "SourceTransactionID": "a848644a-f20f-4630-98c3-386bd7505631", "SourceLineItemID": "b0df260d-3cc8-4ced-9bd6-41924f624ed3", "Status": "DRAFT", "Type": "BILLABLEEXPENSE", "UpdatedDateUTC": "\\/Date(1552351055000+0000)\\/", "SourceTransactionTypeCode": "ACCPAY", "ValidationErrors": [ { "Message": "The SourceLineItemID and SourceTransactionID do not match" } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/LinkedTransactions';
                };
              };
            };
            description: 'Success - return response of type LinkedTransactions array with newly created LinkedTransaction';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates linked transactions (billable expenses)';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            key: 'linkedTransaction';
            keyPascal: 'LinkedTransaction';
            keySnake: 'linked_transaction';
            linkedTransaction: null;
          },
          {
            default: '00000000-0000-0000-0000-000000000000';
            is_uuid: true;
            key: 'sourceTransactionID';
            keyPascal: 'SourceTransactionID';
            keySnake: 'source_transaction_id';
            object: 'linkedTransaction';
            sourceTransactionID: null;
          },
          {
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'sourceLineItemID';
            keyPascal: 'SourceLineItemID';
            keySnake: 'source_line_item_id';
            object: 'linkedTransaction';
            sourceLineItemID: null;
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ sourceTransactionID: "00000000-0000-0000-0000-000000000000", sourceLineItemID: "00000000-0000-0000-0000-000000000000" }';
        'x-ruby-requestBody': 'linked_transaction = { source_transaction_id: "00000000-0000-0000-0000-000000000000", source_line_item_id: "00000000-0000-0000-0000-000000000000" }';
      };
    };
    '/LinkedTransactions/{LinkedTransactionID}': {
      delete: {
        operationId: 'deleteLinkedTransaction';
        parameters: [
          {
            description: 'Unique identifier for a LinkedTransaction';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'LinkedTransactionID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '204': {
            description: 'Success - return response 204 no content';
            'x-isEmpty': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Deletes a specific linked transactions (billable expenses)';
        tags: ['Accounting'];
      };
      get: {
        operationId: 'getLinkedTransaction';
        parameters: [
          {
            description: 'Unique identifier for a LinkedTransaction';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'LinkedTransactionID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "171ca542-874d-44e2-8930-db9bccd7d88b", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552348339875)\\/", "LinkedTransactions": [ { "LinkedTransactionID": "5cf7d9c0-b9a7-4433-a2dc-ae3c11bba39b", "SourceTransactionID": "aec416dd-38ea-40dc-9f0b-813c8c71f87f", "SourceLineItemID": "77e0b23b-5b79-4f4b-ae20-c9031d41442f", "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "TargetTransactionID": "83693fc1-5b05-4807-b190-109d4a85dd5f", "TargetLineItemID": "d5128ff1-0f39-4d2a-a6d5-46dfaf5f075c", "Status": "ONDRAFT", "Type": "BILLABLEEXPENSE", "UpdatedDateUTC": "\\/Date(1552347991000+0000)\\/", "SourceTransactionTypeCode": "ACCPAY" } ] }';
                schema: {
                  $ref: '#/components/schemas/LinkedTransactions';
                };
              };
            };
            description: 'Success - return response of type LinkedTransactions array with a specified LinkedTransaction';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves a specific linked transaction (billable expenses) using a unique linked transaction Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateLinkedTransaction';
        parameters: [
          {
            description: 'Unique identifier for a LinkedTransaction';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'LinkedTransactionID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "LinkedTransactions": [ { "SourceTransactionID": "00000000-0000-0000-0000-000000000000", "SourceLineItemID": "00000000-0000-0000-0000-000000000000" } ] }';
              schema: {
                $ref: '#/components/schemas/LinkedTransactions';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "bd364af7-08f0-432b-81db-c1e5ba05f3dd", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552351488159)\\/", "LinkedTransactions": [ { "LinkedTransactionID": "e9684b6c-4df9-45a0-917b-85cc29857008", "SourceTransactionID": "a848644a-f20f-4630-98c3-386bd7505631", "SourceLineItemID": "b0df260d-3cc8-4ced-9bd6-41924f624ed3", "ContactID": "4e1753b9-018a-4775-b6aa-1bc7871cfee3", "Status": "DRAFT", "Type": "BILLABLEEXPENSE", "UpdatedDateUTC": "\\/Date(1552351055000+0000)\\/", "SourceTransactionTypeCode": "ACCPAY" } ] }';
                schema: {
                  $ref: '#/components/schemas/LinkedTransactions';
                };
              };
            };
            description: 'Success - return response of type LinkedTransactions array with updated LinkedTransaction';
          };
          '400': {
            content: {
              'application/json': {
                example: '{ "ErrorNumber": 10, "Type": "ValidationException", "Message": "A validation exception occurred", "Elements": [ { "LinkedTransactionID": "5a68b5b4-8cf0-4af5-8c3c-513cc19e1c73", "SourceTransactionID": "aec416dd-38ea-40dc-9f0b-813c8c71f87f", "SourceLineItemID": "77e0b23b-5b79-4f4b-ae20-c9031d41442f", "ContactID": "4e1753b9-018a-4775-b6aa-1bc7871cfee3", "TargetTransactionID": "83693fc1-5b05-4807-b190-109d4a85dd5f", "TargetLineItemID": "d5128ff1-0f39-4d2a-a6d5-46dfaf5f075c", "Status": "ONDRAFT", "Type": "BILLABLEEXPENSE", "UpdatedDateUTC": "\\/Date(1552349706000+0000)\\/", "SourceTransactionTypeCode": "ACCPAY", "ValidationErrors": [ { "Message": "The ContactID and the TargetTransaction ContactID do not match" } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Error';
                };
              };
            };
            description: 'Success - return response of type LinkedTransactions array with updated LinkedTransaction';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Updates a specific linked transactions (billable expenses)';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            key: 'linkedTransaction';
            keyPascal: 'LinkedTransaction';
            keySnake: 'linked_transaction';
            linkedTransaction: null;
          },
          {
            default: '00000000-0000-0000-0000-000000000000';
            is_uuid: true;
            key: 'sourceLineItemID';
            keyPascal: 'SourceLineItemID';
            keySnake: 'source_line_item_id';
            object: 'linkedTransaction';
            sourceLineItemID: null;
          },
          {
            contactID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'contactID';
            keyPascal: 'ContactID';
            object: 'linkedTransaction';
          },
          {
            is_object: true;
            key: 'linkedTransactions';
            keyPascal: 'LinkedTransactions';
            linkedTransactions: null;
          },
          {
            add_linkedTransaction: null;
            is_array_add: true;
            is_last: true;
            java: 'LinkedTransactions';
            key: 'linkedTransactions';
            keyPascal: 'LinkedTransactions';
            keySnake: 'linked_transactions';
            object: 'linkedTransaction';
            python: 'linked_transaction';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ linkedTransactions: [{ sourceLineItemID: "00000000-0000-0000-0000-000000000000", contactID: "00000000-0000-0000-0000-000000000000" }]}';
        'x-ruby-requestBody': 'linked_transactions = { linked_transactions: [{ source_line_item_id: "00000000-0000-0000-0000-000000000000", contact_id: "00000000-0000-0000-0000-000000000000" }]}';
      };
    };
    '/ManualJournals': {
      get: {
        operationId: 'getManualJournals';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter by an any element';
            example: 'Status=="DRAFT"';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-java': 'Status==&quot;&apos; + ManualJournal.StatusEnum.DRAFT + &apos;&quot;';
            'x-example-php': 'Status==&quot;&apos; . \\XeroAPI\\XeroPHP\\Models\\Accounting\\ManualJournal::STATUS_DRAFT . &apos;&quot;';
            'x-ruby-param': 'Status==#{XeroRuby::Accounting::ManualJournal::DRAFT}';
          },
          {
            description: 'Order by an any element';
            example: 'Date ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'e.g. page=1 – Up to 100 manual journals will be returned in a single API call with line items shown for each overpayment';
            example: 1;
            in: 'query';
            name: 'page';
            schema: {
              type: 'integer';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "8a508ec1-b578-48bf-97df-020c918fbf7d", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552357217359)\\/", "ManualJournals": [ { "Date": "\\/Date(1553126400000+0000)\\/", "Status": "POSTED", "LineAmountTypes": "NoTax", "UpdatedDateUTC": "\\/Date(1552357188083+0000)\\/", "ManualJournalID": "0b159335-606b-485f-b51b-97b3b32bad32", "Narration": "Reversal: These aren\'t the droids you are looking for", "JournalLines": [], "ShowOnCashBasisReports": true, "HasAttachments": false }, { "Date": "\\/Date(1552348800000+0000)\\/", "Status": "POSTED", "LineAmountTypes": "NoTax", "UpdatedDateUTC": "\\/Date(1552357188147+0000)\\/", "ManualJournalID": "99cb8353-ce73-4a5d-8e0d-8b0edf86cfc4", "Narration": "These aren\'t the droids you are looking for", "JournalLines": [], "ShowOnCashBasisReports": true, "HasAttachments": true }, { "Date": "\\/Date(1552262400000+0000)\\/", "Status": "DRAFT", "LineAmountTypes": "NoTax", "UpdatedDateUTC": "\\/Date(1552357216843+0000)\\/", "ManualJournalID": "ecb6b362-c78f-462a-a229-a66abf115e92", "Narration": "Foo bar", "JournalLines": [], "ShowOnCashBasisReports": true, "HasAttachments": false } ] }';
                schema: {
                  $ref: '#/components/schemas/ManualJournals';
                };
              };
            };
            description: 'Success - return response of type ManualJournals array with a all ManualJournals';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves manual journals';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateOrCreateManualJournals';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "ManualJournals": [ { "Narration": "Journal Desc", "JournalLines": [ { "LineAmount": 100, "AccountCode": "400", "Description": "Money Movement" }, { "LineAmount": -100, "AccountCode": "400", "Description": "Prepayment of things", "Tracking": [ { "Name": "North", "Option": "Region" } ] } ], "Date": "2019-03-14" } ] }';
              schema: {
                $ref: '#/components/schemas/ManualJournals';
              };
            };
          };
          description: 'ManualJournals array with ManualJournal object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "45dfa608-0fcb-4f30-a377-c82cd348569c", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552595972952)\\/", "ManualJournals": [ { "Date": "\\/Date(1552521600000+0000)\\/", "Status": "DRAFT", "LineAmountTypes": "NoTax", "UpdatedDateUTC": "\\/Date(1552595972920+0000)\\/", "ManualJournalID": "d312dd5e-a53e-46d1-9d51-c569ef4570b7", "Narration": "Foo bar", "JournalLines": [ { "Description": "Hello there", "TaxType": "NONE", "LineAmount": 100.00, "AccountCode": "400", "Tracking": [], "AccountID": "c4f29c22-28c2-4a13-9eab-ecbbd641ffdf", "IsBlank": false }, { "Description": "Goodbye", "TaxType": "NONE", "LineAmount": -100.00, "AccountCode": "400", "Tracking": [ { "Name": "Simpsons", "Option": "Bart", "TrackingCategoryID": "6a68adde-f210-4465-b0a9-0d8cc6f50762", "TrackingOptionID": "dc54c220-0140-495a-b925-3246adc0075f" } ], "AccountID": "c4f29c22-28c2-4a13-9eab-ecbbd641ffdf", "IsBlank": false } ], "ShowOnCashBasisReports": true, "Warnings": [ { "Message": "Account code \'476\' has been removed as it does not match a recognised account." } ], "ValidationErrors": [ { "Message": "The total debits (100.00) must equal total credits (-10.00)" } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/ManualJournals';
                };
              };
            };
            description: 'Success - return response of type ManualJournals array with newly created ManualJournal';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Updates or creates a single manual journal';
        tags: ['Accounting'];
        'x-example': [
          {
            dateValue: null;
            default: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            is_date: true;
            java: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            java_datatype: 'LocalDate';
            key: 'dateValue';
            keyPascal: 'Date';
            keySnake: 'date_value';
            php: "new DateTime('2019-10-10')";
            python: "dateutil.parser.parse('2020-12-03T00:00:00Z')";
          },
          {
            is_list: true;
            key: 'manualJournalLines';
            keyPascal: 'ManualJournalLine';
            keySnake: 'manual_journal_lines';
            manualJournalLines: null;
          },
          {
            credit: null;
            is_object: true;
            key: 'credit';
            keyPascal: 'ManualJournalLine';
          },
          {
            default: 100;
            key: 'lineAmount';
            keyPascal: 'LineAmount';
            keySnake: 'line_amount';
            lineAmount: null;
            nonString: true;
            object: 'credit';
          },
          {
            accountCode: null;
            default: 400;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'credit';
          },
          {
            default: 'Hello there';
            description: null;
            is_last: true;
            key: 'description';
            keyPascal: 'Description';
            object: 'credit';
          },
          {
            add_credit: null;
            is_last: true;
            is_list_add: true;
            key: 'manualJournalLines';
            keyPascal: 'ManualJournalLine';
            keySnake: 'manual_journal_lines';
            object: 'credit';
          },
          {
            debit: null;
            is_object: true;
            key: 'debit';
            keyPascal: 'ManualJournalLine';
          },
          {
            default: -100;
            key: 'lineAmount';
            keyPascal: 'LineAmount';
            keySnake: 'line_amount';
            lineAmount: null;
            nonString: true;
            object: 'debit';
          },
          {
            accountCode: null;
            default: 120;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'debit';
          },
          {
            default: 'Hello there';
            description: null;
            is_last: true;
            key: 'description';
            keyPascal: 'Description';
            object: 'debit';
          },
          {
            add_debit: null;
            is_last: true;
            is_list_add: true;
            key: 'manualJournalLines';
            keyPascal: 'ManualJournalLine';
            keySnake: 'manual_journal_lines';
            object: 'debit';
          },
          {
            is_object: true;
            key: 'manualJournal';
            keyPascal: 'ManualJournal';
            keySnake: 'manual_journal';
            manualJournal: null;
          },
          {
            default: 'Foobar';
            key: 'narration';
            keyPascal: 'Narration';
            narration: null;
            object: 'manualJournal';
          },
          {
            date: null;
            default: 'dateValue';
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'manualJournal';
            python: 'date_value';
          },
          {
            default: 'manualJournalLines';
            is_last: true;
            is_variable: true;
            key: 'manualJournalLines';
            keyPascal: 'JournalLines';
            keySnake: 'journal_lines';
            nonString: true;
            object: 'manualJournal';
            python: 'manual_journal_lines';
            set_manualJournalLines: null;
          },
          {
            is_object: true;
            key: 'manualJournals';
            keyPascal: 'ManualJournals';
            manualJournals: null;
          },
          {
            add_manualJournal: null;
            is_array_add: true;
            is_last: true;
            java: 'ManualJournals';
            key: 'manualJournals';
            keyPascal: 'ManualJournals';
            keySnake: 'manual_journals';
            object: 'manualJournal';
            php: 'manualJournals';
            python: 'manual_journal';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ manualJournals: [{ narration: "Foo bar", journalLines: [{ lineAmount: 100.0, accountCode: "400", description: "Hello there" },{ lineAmount: -100.0, accountCode: "400", description: "Goodbye", tracking: [{ name: "Simpsons", option: "Bart" }]}], date: "2019-03-14" }]}';
        'x-ruby-requestBody': 'manual_journals = { manual_journals: [{ narration: "Foo bar", date: "2019-03-14", journal_lines: [{ line_amount: 100.0, account_code: "400", description: "Hello there" },{ line_amount: -100.0, account_code: "400", description: "Goodbye", tracking: [{ name: "Simpsons", option: "Bart" }]}] }]}';
      };
      put: {
        operationId: 'createManualJournals';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "ManualJournals": [ { "Narration": "Journal Desc", "JournalLines": [ { "LineAmount": 100, "AccountCode": "400", "Description": "Money Movement" }, { "LineAmount": -100, "AccountCode": "400", "Description": "Prepayment of things", "Tracking": [ { "Name": "North", "Option": "Region" } ] } ], "Date": "2019-03-14" } ] }';
              schema: {
                $ref: '#/components/schemas/ManualJournals';
              };
            };
          };
          description: 'ManualJournals array with ManualJournal object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "45dfa608-0fcb-4f30-a377-c82cd348569c", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552595972952)\\/", "ManualJournals": [ { "Date": "\\/Date(1552521600000+0000)\\/", "Status": "DRAFT", "LineAmountTypes": "NoTax", "UpdatedDateUTC": "\\/Date(1552595972920+0000)\\/", "ManualJournalID": "d312dd5e-a53e-46d1-9d51-c569ef4570b7", "Narration": "Foo bar", "JournalLines": [ { "Description": "Hello there", "TaxType": "NONE", "LineAmount": 100.00, "AccountCode": "400", "Tracking": [], "AccountID": "c4f29c22-28c2-4a13-9eab-ecbbd641ffdf", "IsBlank": false }, { "Description": "Goodbye", "TaxType": "NONE", "LineAmount": -100.00, "AccountCode": "400", "Tracking": [ { "Name": "Simpsons", "Option": "Bart", "TrackingCategoryID": "6a68adde-f210-4465-b0a9-0d8cc6f50762", "TrackingOptionID": "dc54c220-0140-495a-b925-3246adc0075f" } ], "AccountID": "c4f29c22-28c2-4a13-9eab-ecbbd641ffdf", "IsBlank": false } ], "ShowOnCashBasisReports": true, "Warnings": [ { "Message": "Account code \'476\' has been removed as it does not match a recognised account." } ], "ValidationErrors": [ { "Message": "The total debits (100.00) must equal total credits (-10.00)" } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/ManualJournals';
                };
              };
            };
            description: 'Success - return response of type ManualJournals array with newly created ManualJournal';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates one or more manual journals';
        tags: ['Accounting'];
        'x-example': [
          {
            dateValue: null;
            default: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            is_date: true;
            java: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            java_datatype: 'LocalDate';
            key: 'dateValue';
            keyPascal: 'Date';
            keySnake: 'date_value';
            php: "new DateTime('2019-10-10')";
            python: "dateutil.parser.parse('2020-12-03T00:00:00Z')";
          },
          {
            is_list: true;
            key: 'manualJournalLines';
            keyPascal: 'ManualJournalLine';
            keySnake: 'manual_journal_lines';
            manualJournalLines: null;
          },
          {
            credit: null;
            is_object: true;
            key: 'credit';
            keyPascal: 'ManualJournalLine';
          },
          {
            default: 100;
            key: 'lineAmount';
            keyPascal: 'LineAmount';
            keySnake: 'line_amount';
            lineAmount: null;
            nonString: true;
            object: 'credit';
          },
          {
            accountCode: null;
            default: 400;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'credit';
          },
          {
            default: 'Hello there';
            description: null;
            is_last: true;
            key: 'description';
            keyPascal: 'Description';
            object: 'credit';
          },
          {
            add_credit: null;
            is_last: true;
            is_list_add: true;
            key: 'manualJournalLines';
            keyPascal: 'ManualJournalLine';
            keySnake: 'manual_journal_lines';
            object: 'credit';
          },
          {
            debit: null;
            is_object: true;
            key: 'debit';
            keyPascal: 'ManualJournalLine';
          },
          {
            default: -100;
            key: 'lineAmount';
            keyPascal: 'LineAmount';
            keySnake: 'line_amount';
            lineAmount: null;
            nonString: true;
            object: 'debit';
          },
          {
            accountCode: null;
            default: 120;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'debit';
          },
          {
            default: 'Hello there';
            description: null;
            is_last: true;
            key: 'description';
            keyPascal: 'Description';
            object: 'debit';
          },
          {
            add_debit: null;
            is_last: true;
            is_list_add: true;
            key: 'manualJournalLines';
            keyPascal: 'ManualJournalLine';
            keySnake: 'manual_journal_lines';
            object: 'debit';
          },
          {
            is_object: true;
            key: 'manualJournal';
            keyPascal: 'ManualJournal';
            keySnake: 'manual_journal';
            manualJournal: null;
          },
          {
            default: 'Foobar';
            key: 'narration';
            keyPascal: 'Narration';
            narration: null;
            object: 'manualJournal';
          },
          {
            date: null;
            default: 'dateValue';
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'manualJournal';
            python: 'date_value';
          },
          {
            default: 'manualJournalLines';
            is_last: true;
            is_variable: true;
            key: 'manualJournalLines';
            keyPascal: 'JournalLines';
            keySnake: 'journal_lines';
            nonString: true;
            object: 'manualJournal';
            python: 'manual_journal_lines';
            set_manualJournalLines: null;
          },
          {
            is_object: true;
            key: 'manualJournals';
            keyPascal: 'ManualJournals';
            manualJournals: null;
          },
          {
            add_manualJournal: null;
            is_array_add: true;
            is_last: true;
            java: 'ManualJournals';
            key: 'manualJournals';
            keyPascal: 'ManualJournals';
            keySnake: 'manual_journals';
            object: 'manualJournal';
            php: 'manualJournals';
            python: 'manual_journal';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ manualJournals: [{ narration: "Foo bar", date: "2019-03-14", journalLines: [{ lineAmount: 100.0, accountCode: "400", description: "Hello there" }, { lineAmount: -100.0, accountCode: "400", description: "Goodbye", tracking: [{ name: "Simpson", option: "Bart" }] }]}]}';
        'x-ruby-requestBody': 'manual_journals = { manual_journals: [{ narration: "Foo bar", date: "2019-03-14", journal_lines: [{ line_amount: 100.0, account_code: "400", description: "Hello there" }, { line_amount: -100.0, account_code: "400", description: "Goodbye", tracking: [{ name: "Simpson", option: "Bart" }] }]}]}';
      };
    };
    '/ManualJournals/{ManualJournalID}': {
      get: {
        operationId: 'getManualJournal';
        parameters: [
          {
            description: 'Unique identifier for a ManualJournal';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ManualJournalID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "7321fc21-1a13-4f40-ae47-df59cff5676d", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552399859139)\\/", "ManualJournals": [ { "Date": "\\/Date(1552348800000+0000)\\/", "Status": "POSTED", "LineAmountTypes": "NoTax", "UpdatedDateUTC": "\\/Date(1552357188147+0000)\\/", "ManualJournalID": "99cb8353-ce73-4a5d-8e0d-8b0edf86cfc4", "Narration": "These aren\'t the droids you are looking for", "JournalLines": [ { "Description": "These aren\'t the droids you are looking for", "TaxType": "NONE", "TaxAmount": 0.00, "LineAmount": 100.00, "AccountCode": "429", "Tracking": [], "AccountID": "160bad11-c1b7-4c7e-8903-dca925d78721", "IsBlank": false }, { "Description": "Yes the are", "TaxType": "NONE", "TaxAmount": 0.00, "LineAmount": -100.00, "AccountCode": "200", "Tracking": [], "AccountID": "e0a5d892-9f9f-44f0-a153-5cb7db125170", "IsBlank": false } ], "ShowOnCashBasisReports": true, "HasAttachments": true, "Attachments": [ { "AttachmentID": "166ca8f8-8bc6-4780-8466-a0e474d586ea", "FileName": "giphy.gif", "Url": "https://api.xero.com/api.xro/2.0/manualjournal/99cb8353-ce73-4a5d-8e0d-8b0edf86cfc4/Attachments/giphy.gif", "MimeType": "image/gif", "ContentLength": 495727 }, { "AttachmentID": "5e5036f9-b1e0-4c5d-a93f-61900137e40b", "FileName": "ridehistory.pdf", "Url": "https://api.xero.com/api.xro/2.0/manualjournal/99cb8353-ce73-4a5d-8e0d-8b0edf86cfc4/Attachments/ridehistory.pdf", "MimeType": "application/pdf", "ContentLength": 4423 } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/ManualJournals';
                };
              };
            };
            description: 'Success - return response of type ManualJournals array with a specified ManualJournals';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves a specific manual journal';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateManualJournal';
        parameters: [
          {
            description: 'Unique identifier for a ManualJournal';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ManualJournalID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "ManualJournals": [ { "Narration": "Hello Xero", "ManualJournalID": "00000000-0000-0000-0000-000000000000", "JournalLines": [] } ] }';
              schema: {
                $ref: '#/components/schemas/ManualJournals';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "b694559c-686c-4047-b657-661ba6c0dd1f", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552357736850)\\/", "ManualJournals": [ { "Date": "\\/Date(1552262400000+0000)\\/", "Status": "DRAFT", "LineAmountTypes": "NoTax", "UpdatedDateUTC": "\\/Date(1552357736820+0000)\\/", "ManualJournalID": "07eac261-78ef-47a0-a0eb-a57b74137877", "Narration": "Hello Xero", "JournalLines": [ { "Description": "Hello there", "TaxType": "NONE", "TaxAmount": 0.00, "LineAmount": 100.00, "AccountCode": "400", "Tracking": [], "AccountID": "c4f29c22-28c2-4a13-9eab-ecbbd641ffdf", "IsBlank": false }, { "Description": "Goodbye", "TaxType": "NONE", "TaxAmount": 0.00, "LineAmount": -100.00, "AccountCode": "400", "Tracking": [], "AccountID": "c4f29c22-28c2-4a13-9eab-ecbbd641ffdf", "IsBlank": false } ], "ShowOnCashBasisReports": true, "HasAttachments": false, "Attachments": [] } ] }';
                schema: {
                  $ref: '#/components/schemas/ManualJournals';
                };
              };
            };
            description: 'Success - return response of type ManualJournals array with an updated ManualJournal';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Updates a specific manual journal';
        tags: ['Accounting'];
        'x-example': [
          {
            dateValue: null;
            default: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            is_date: true;
            java: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            java_datatype: 'LocalDate';
            key: 'dateValue';
            keyPascal: 'Date';
            keySnake: 'date_value';
            php: "new DateTime('2019-10-10')";
            python: "dateutil.parser.parse('2020-12-03T00:00:00Z')";
          },
          {
            is_list: true;
            key: 'manualJournalLines';
            keyPascal: 'ManualJournalLine';
            keySnake: 'manual_journal_lines';
            manualJournalLines: null;
          },
          {
            credit: null;
            is_object: true;
            key: 'credit';
            keyPascal: 'ManualJournalLine';
          },
          {
            default: 100;
            key: 'lineAmount';
            keyPascal: 'LineAmount';
            keySnake: 'line_amount';
            lineAmount: null;
            nonString: true;
            object: 'credit';
          },
          {
            accountCode: null;
            default: 400;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'credit';
          },
          {
            default: 'Hello there';
            description: null;
            is_last: true;
            key: 'description';
            keyPascal: 'Description';
            object: 'credit';
          },
          {
            add_credit: null;
            is_last: true;
            is_list_add: true;
            key: 'manualJournalLines';
            keyPascal: 'ManualJournalLine';
            keySnake: 'manual_journal_lines';
            object: 'credit';
          },
          {
            debit: null;
            is_object: true;
            key: 'debit';
            keyPascal: 'ManualJournalLine';
          },
          {
            default: -100;
            key: 'lineAmount';
            keyPascal: 'LineAmount';
            keySnake: 'line_amount';
            lineAmount: null;
            nonString: true;
            object: 'debit';
          },
          {
            accountCode: null;
            default: 120;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'debit';
          },
          {
            default: 'Hello there';
            description: null;
            is_last: true;
            key: 'description';
            keyPascal: 'Description';
            object: 'debit';
          },
          {
            add_debit: null;
            is_last: true;
            is_list_add: true;
            key: 'manualJournalLines';
            keyPascal: 'ManualJournalLine';
            keySnake: 'manual_journal_lines';
            object: 'debit';
          },
          {
            is_object: true;
            key: 'manualJournal';
            keyPascal: 'ManualJournal';
            keySnake: 'manual_journal';
            manualJournal: null;
          },
          {
            default: 'Foobar';
            key: 'narration';
            keyPascal: 'Narration';
            narration: null;
            object: 'manualJournal';
          },
          {
            date: null;
            default: 'dateValue';
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'manualJournal';
            python: 'date_value';
          },
          {
            default: 'manualJournalLines';
            is_last: true;
            is_variable: true;
            key: 'manualJournalLines';
            keyPascal: 'JournalLines';
            keySnake: 'journal_lines';
            nonString: true;
            object: 'manualJournal';
            python: 'manual_journal_lines';
            set_manualJournalLines: null;
          },
          {
            is_object: true;
            key: 'manualJournals';
            keyPascal: 'ManualJournals';
            manualJournals: null;
          },
          {
            add_manualJournal: null;
            is_array_add: true;
            is_last: true;
            java: 'ManualJournals';
            key: 'manualJournals';
            keyPascal: 'ManualJournals';
            keySnake: 'manual_journals';
            object: 'manualJournal';
            php: 'manualJournals';
            python: 'manual_journal';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ manualJournals: [{ narration: "Hello Xero", manualJournalId: "00000000-0000-0000-0000-000000000000", journalLines: [] }]}';
        'x-ruby-requestBody': 'manual_journals = { manual_journals: [{ narration: "Hello Xero", manual_journal_id: "00000000-0000-0000-0000-000000000000", journal_lines: [] }]}';
      };
    };
    '/ManualJournals/{ManualJournalID}/Attachments': {
      get: {
        operationId: 'getManualJournalAttachments';
        parameters: [
          {
            description: 'Unique identifier for a ManualJournal';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ManualJournalID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "5fa4b3ef-7945-45a7-9bab-10e830673dfb", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552404121471)\\/", "Attachments": [ { "AttachmentID": "16e86f32-3e25-4209-8662-c0dfd91b654c", "FileName": "HelloWorld.jpg", "Url": "https://api.xero.com/api.xro/2.0/ManualJournals/0b159335-606b-485f-b51b-97b3b32bad32/Attachments/HelloWorld.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 }, { "AttachmentID": "ff7c439e-a057-4807-ac2c-b558d7df7511", "FileName": "foobar.jpg", "Url": "https://api.xero.com/api.xro/2.0/ManualJournals/0b159335-606b-485f-b51b-97b3b32bad32/Attachments/foobar.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array with all Attachments for a ManualJournals';
            'x-isAttachment': true;
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves attachment for a specific manual journal';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/ManualJournals/{ManualJournalID}/Attachments/{AttachmentID}': {
      get: {
        operationId: 'getManualJournalAttachmentById';
        parameters: [
          {
            description: 'Unique identifier for a ManualJournal';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ManualJournalID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Unique identifier for a Attachment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AttachmentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Manual Journal as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Allows you to retrieve a specific attachment from a specific manual journal using a unique attachment Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/ManualJournals/{ManualJournalID}/Attachments/{FileName}': {
      get: {
        operationId: 'getManualJournalAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for a ManualJournal';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ManualJournalID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The name of the file being attached to a ManualJournal';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Manual Journal as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves a specific attachment from a specific manual journal by file name';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateManualJournalAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for a ManualJournal';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ManualJournalID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The name of the file being attached to a ManualJournal';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "e1cb9deb-a8f0-477f-b4d1-cf0c6c39e080", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552401039306)\\/", "Attachments": [ { "AttachmentID": "16e86f32-3e25-4209-8662-c0dfd91b654c", "FileName": "HelloWorld.jpg", "Url": "https://api.xero.com/api.xro/2.0/ManualJournals/0b159335-606b-485f-b51b-97b3b32bad32/Attachments/HelloWorld.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array with an update Attachment for a ManualJournals';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Updates a specific attachment from a specific manual journal by file name';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
      put: {
        operationId: 'createManualJournalAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for a ManualJournal';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ManualJournalID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The name of the file being attached to a ManualJournal';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "a864994c-e7d7-4dee-b5ca-0a729fde2f39", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552400898428)\\/", "Attachments": [ { "AttachmentID": "47ac97ff-d4f9-48a0-8a8e-49fae29129e7", "FileName": "foobar.jpg", "Url": "https://api.xero.com/api.xro/2.0/ManualJournals/0b159335-606b-485f-b51b-97b3b32bad32/Attachments/foobar.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array with a newly created Attachment for a ManualJournals';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Creates a specific attachment for a specific manual journal by file name';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
    };
    '/ManualJournals/{ManualJournalID}/History': {
      get: {
        operationId: 'getManualJournalsHistory';
        parameters: [
          {
            description: 'Xero generated unique identifier for a manual journal';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ManualJournalID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRetrieved';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves history for a specific manual journal';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createManualJournalHistoryRecord';
        parameters: [
          {
            description: 'Xero generated unique identifier for a manual journal';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ManualJournalID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          $ref: '#/components/requestBodies/historyRecords';
        };
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRecordCreated';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates a history record for a specific manual journal';
        tags: ['Accounting'];
        'x-example': [
          {
            historyRecord: null;
            is_object: true;
            key: 'historyRecord';
            keyPascal: 'HistoryRecord';
            keySnake: 'history_record';
          },
          {
            Details: null;
            default: 'Hello World';
            is_last: true;
            key: 'details';
            keyPascal: 'Details';
            object: 'historyRecord';
          },
          {
            historyRecords: null;
            is_object: true;
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
          },
          {
            add_historyRecord: null;
            is_array_add: true;
            is_last: true;
            java: 'HistoryRecords';
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
            object: 'historyRecord';
            python: 'history_record';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/Organisation': {
      get: {
        operationId: 'getOrganisations';
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "27b7a645-a3ee-43c8-b2c6-a2fa7b84c8c5", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552404447003)\\/", "Organisations": [ { "APIKey": "CTJ60UH519MXQIXEJSDPDALS3EOZ5Y", "Name": "Dev Evangelist - Sid Test 3 (NZ-2016-02)", "LegalName": "Dev Evangelist - Sid Test 3 (NZ-2016-02)", "PaysTax": true, "Version": "NZ", "OrganisationType": "COMPANY", "BaseCurrency": "NZD", "CountryCode": "NZ", "IsDemoCompany": false, "OrganisationStatus": "ACTIVE", "TaxNumber": "071-138-054", "FinancialYearEndDay": 31, "FinancialYearEndMonth": 3, "SalesTaxBasis": "PAYMENTS", "SalesTaxPeriod": "TWOMONTHS", "DefaultSalesTax": "Tax Exclusive", "DefaultPurchasesTax": "Tax Exclusive", "PeriodLockDate": "\\/Date(1546214400000+0000)\\/", "EndOfYearLockDate": "\\/Date(1546214400000+0000)\\/", "CreatedDateUTC": "\\/Date(1455827393000)\\/", "OrganisationEntityType": "COMPANY", "Timezone": "NEWZEALANDSTANDARDTIME", "ShortCode": "!mBdtL", "OrganisationID": "b2c885a9-4bb9-4a00-9b6e-6c2bf60b1a2b", "Edition": "BUSINESS", "Class": "PREMIUM", "Addresses": [], "Phones": [], "ExternalLinks": [], "PaymentTerms": {} } ] }';
                schema: {
                  $ref: '#/components/schemas/Organisations';
                };
              };
            };
            description: 'Success - return response of type Organisation array with all Organisation';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings.read'];
          },
        ];
        summary: 'Retrieves Xero organisation details';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Organisation/Actions': {
      get: {
        operationId: 'getOrganisationActions';
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "f02c0dd1-1917-4d57-9853-997f6bcaf2bc", "Status": "OK", "ProviderName": "Java OA2 dev 01", "DateTimeUTC": "/Date(1602883301013)/", "Actions": [ { "Name": "CreateApprovedInvoice", "Status": "ALLOWED" }, { "Name": "CreateDraftPurchaseOrder", "Status": "ALLOWED" }, { "Name": "CreateApprovedBill", "Status": "ALLOWED" }, { "Name": "AttachFilesIntoInvoice", "Status": "ALLOWED" }, { "Name": "UseMulticurrency", "Status": "ALLOWED" }, { "Name": "CreateDraftInvoice", "Status": "ALLOWED" }, { "Name": "CreateRepeatingInvoice", "Status": "ALLOWED" }, { "Name": "CreateRepeatingBill", "Status": "ALLOWED" }, { "Name": "CreateSentQuote", "Status": "ALLOWED" }, { "Name": "CreateInvoicePayment", "Status": "ALLOWED" }, { "Name": "CreateApprovedPurchaseOrder", "Status": "ALLOWED" }, { "Name": "CreateDraftQuote", "Status": "ALLOWED" }, { "Name": "CreateDraftBill", "Status": "ALLOWED" } ] }';
                schema: {
                  $ref: '#/components/schemas/Actions';
                };
              };
            };
            description: 'Success - return response of type Actions array with all key actions';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings.read'];
          },
        ];
        summary: 'Retrieves a list of the key actions your app has permission to perform in the connected Xero organisation.';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Organisation/{OrganisationID}/CISSettings': {
      get: {
        operationId: 'getOrganisationCISSettings';
        parameters: [
          {
            description: 'The unique Xero identifier for an organisation';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'OrganisationID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CISOrgSettings';
                };
              };
            };
            description: 'Success - return response of type Organisation array with specified Organisation';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings.read'];
          },
        ];
        summary: 'Retrieves the CIS settings for the Xero organistaion.';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Overpayments': {
      get: {
        operationId: 'getOverpayments';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter by an any element';
            example: 'Status=="AUTHORISED"';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-java': 'Status==&quot;&apos; + Overpayment.StatusEnum.AUTHORISED + &apos;&quot;';
            'x-example-php': 'Status==&quot;&apos; . \\XeroAPI\\XeroPHP\\Models\\Accounting\\Overpayment::STATUS_AUTHORISED . &apos;&quot;';
            'x-ruby-param': 'Status==#{XeroRuby::Accounting::Overpayment::AUTHORISED}';
          },
          {
            description: 'Order by an any element';
            example: 'Status ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'e.g. page=1 – Up to 100 overpayments will be returned in a single API call with line items shown for each overpayment';
            example: 1;
            in: 'query';
            name: 'page';
            schema: {
              type: 'integer';
            };
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "c0ce675e-e5bc-4b2a-a20e-76a9eaedf89d", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552428951416)\\/", "Overpayments": [ { "OverpaymentID": "098b4dcb-5622-4699-87f8-9d40c4ccceb3", "ID": "098b4dcb-5622-4699-87f8-9d40c4ccceb3", "Type": "SPEND-OVERPAYMENT", "RemainingCredit": 500.00, "Allocations": [], "Payments": [], "HasAttachments": false, "Contact": { "ContactID": "af3ffcc1-c578-4658-82f3-5d8d458cc7af", "Name": "Daddy Warbucks", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-03-12T00:00:00", "Date": "\\/Date(1552348800000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "NoTax", "LineItems": [], "SubTotal": 500.00, "TotalTax": 0.00, "Total": 500.00, "UpdatedDateUTC": "\\/Date(1552428535123+0000)\\/", "CurrencyCode": "NZD" }, { "OverpaymentID": "2a8bda49-8908-473b-8bcf-1f90990460eb", "ID": "2a8bda49-8908-473b-8bcf-1f90990460eb", "Type": "RECEIVE-OVERPAYMENT", "RemainingCredit": 20.00, "Allocations": [], "Payments": [], "HasAttachments": false, "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "Name": "Liam Gallagher", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-03-13T00:00:00", "Date": "\\/Date(1552435200000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "NoTax", "LineItems": [], "SubTotal": 20.00, "TotalTax": 0.00, "Total": 20.00, "UpdatedDateUTC": "\\/Date(1552428568250+0000)\\/", "CurrencyCode": "NZD" }, { "OverpaymentID": "ed7f6041-c915-4667-bd1d-54c48e92161e", "ID": "ed7f6041-c915-4667-bd1d-54c48e92161e", "Type": "SPEND-OVERPAYMENT", "RemainingCredit": 3000.00, "Allocations": [], "Payments": [], "HasAttachments": false, "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "Name": "Liam Gallagher", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-03-12T00:00:00", "Date": "\\/Date(1552348800000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "NoTax", "LineItems": [], "SubTotal": 3000.00, "TotalTax": 0.00, "Total": 3000.00, "UpdatedDateUTC": "\\/Date(1552428781527+0000)\\/", "CurrencyCode": "NZD" }, { "OverpaymentID": "0859adbc-ea00-40cd-a877-258cf8644975", "ID": "0859adbc-ea00-40cd-a877-258cf8644975", "Type": "RECEIVE-OVERPAYMENT", "RemainingCredit": 20.00, "Allocations": [], "Payments": [], "HasAttachments": false, "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "Name": "Liam Gallagher", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-03-13T00:00:00", "Date": "\\/Date(1552435200000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "NoTax", "LineItems": [], "SubTotal": 20.00, "TotalTax": 0.00, "Total": 20.00, "UpdatedDateUTC": "\\/Date(1552428842190+0000)\\/", "CurrencyCode": "NZD" }, { "OverpaymentID": "687b877f-634a-415d-92b2-74e62977de30", "ID": "687b877f-634a-415d-92b2-74e62977de30", "Type": "RECEIVE-OVERPAYMENT", "RemainingCredit": 20.00, "Allocations": [], "Payments": [], "HasAttachments": false, "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "Name": "Liam Gallagher", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-03-13T00:00:00", "Date": "\\/Date(1552435200000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "NoTax", "LineItems": [], "SubTotal": 20.00, "TotalTax": 0.00, "Total": 20.00, "UpdatedDateUTC": "\\/Date(1552428950730+0000)\\/", "CurrencyCode": "NZD" } ] }';
                schema: {
                  $ref: '#/components/schemas/Overpayments';
                };
              };
            };
            description: 'Success - return response of type Overpayments array with all Overpayments';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves overpayments';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Overpayments/{OverpaymentID}': {
      get: {
        operationId: 'getOverpayment';
        parameters: [
          {
            description: 'Unique identifier for a Overpayment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'OverpaymentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: ' { "Id": "46c9e8e2-9410-4e75-9297-f0ca8fa76c32", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1553278835158)\\/", "Overpayments": [ { "OverpaymentID": "ed7f6041-c915-4667-bd1d-54c48e92161e", "ID": "ed7f6041-c915-4667-bd1d-54c48e92161e", "CurrencyRate": 1.000000, "Type": "SPEND-OVERPAYMENT", "RemainingCredit": 2999.00, "Allocations": [ { "Amount": 1.00, "Date": "\\/Date(1552348800000+0000)\\/", "Invoice": { "InvoiceID": "c45720a1-ade3-4a38-a064-d15489be6841", "InvoiceNumber": "", "Payments": [], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "HasErrors": false, "IsDiscounted": false, "LineItems": [] } } ], "Payments": [], "HasAttachments": true, "Attachments": [ { "AttachmentID": "247dd942-5245-47a7-adb1-4d9ea075b431", "FileName": "giphy.gif", "Url": "https://api.xero.com/api.xro/2.0/banktransaction/ed7f6041-c915-4667-bd1d-54c48e92161e/Attachments/giphy.gif", "MimeType": "image/gif", "ContentLength": 495727 } ], "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "EmailAddress": "liam@rockstar.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "", "AttentionTo": "" }, { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551747281053+0000)\\/", "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-03-12T00:00:00", "Date": "\\/Date(1552348800000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "NoTax", "LineItems": [ { "Description": "Broken TV deposit", "UnitAmount": 3000.00, "TaxType": "NONE", "TaxAmount": 0.00, "LineAmount": 3000.00, "AccountCode": "800", "Tracking": [], "Quantity": 1.0000, "DiscountEnteredAsPercent": true, "ValidationErrors": [] } ], "SubTotal": 3000.00, "TotalTax": 0.00, "Total": 3000.00, "UpdatedDateUTC": "\\/Date(1552428952890+0000)\\/", "CurrencyCode": "NZD" } ] }';
                schema: {
                  $ref: '#/components/schemas/Overpayments';
                };
              };
            };
            description: 'Success - return response of type Overpayments array with specified Overpayments';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves a specific overpayment using a unique overpayment Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Overpayments/{OverpaymentID}/Allocations': {
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createOverpaymentAllocations';
        parameters: [
          {
            description: 'Unique identifier for a Overpayment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'OverpaymentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Allocations": [ { "Invoice": { "InvoiceID": "00000000-0000-0000-0000-000000000000", "LineItems": [], "Contact": {}, "Type": "ACCPAY" }, "Amount": 10.00, "Date": "2019-03-12" } ] }';
              schema: {
                $ref: '#/components/schemas/Allocations';
              };
            };
          };
          description: 'Allocations array with Allocation object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "3b7f7be2-384a-4703-bcfb-c56e9116c914", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552428952968)\\/", "Allocations": [ { "Amount": 1.00, "Date": "\\/Date(1552348800000+0000)\\/", "Invoice": { "InvoiceID": "c45720a1-ade3-4a38-a064-d15489be6841", "Payments": [], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "HasErrors": false, "IsDiscounted": false, "LineItems": [], "ValidationErrors": [] }, "Overpayment": { "OverpaymentID": "ed7f6041-c915-4667-bd1d-54c48e92161e", "ID": "ed7f6041-c915-4667-bd1d-54c48e92161e", "LineItems": [] }, "ValidationErrors": [] } ] }';
                schema: {
                  $ref: '#/components/schemas/Allocations';
                };
              };
            };
            description: 'Success - return response of type Allocations array with all Allocation for Overpayments';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates a single allocation for a specific overpayment';
        tags: ['Accounting'];
        'x-example': [
          {
            currDate: null;
            default: 'LocalDate.now()';
            is_date: true;
            java: 'LocalDate.now()';
            java_datatype: 'LocalDate';
            key: 'currDate';
            keyPascal: 'Date';
            keySnake: 'curr_date';
            php: "new DateTime('2019-12-10')";
            python: "dateutil.parser.parse('2020-12-03T00:00:00Z')";
          },
          {
            invoice: null;
            is_object: true;
            key: 'invoice';
            keyPascal: 'Invoice';
          },
          {
            default: '00000000-0000-0000-0000-000000000000';
            invoiceID: null;
            is_last: true;
            is_uuid: true;
            key: 'invoiceID';
            keyPascal: 'InvoiceID';
            keySnake: 'invoice_id';
            object: 'invoice';
          },
          {
            allocation: null;
            is_object: true;
            key: 'allocation';
            keyPascal: 'Allocation';
          },
          {
            amount: null;
            default: 1;
            key: 'amount';
            keyPascal: 'Amount';
            nonString: true;
            object: 'allocation';
          },
          {
            date: null;
            default: 'currDate';
            is_last: true;
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'allocation';
            python: 'curr_date';
          },
          {
            default: 'invoice';
            is_last: true;
            is_variable: true;
            key: 'invoice';
            keyPascal: 'Invoice';
            nonString: true;
            object: 'allocation';
            set_invoice: null;
          },
          {
            allocations: null;
            is_object: true;
            key: 'allocations';
            keyPascal: 'Allocations';
          },
          {
            add_allocation: null;
            is_array_add: true;
            is_last: true;
            java: 'Allocations';
            key: 'allocations';
            keyPascal: 'Allocations';
            object: 'allocation';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ allocations: [{ invoice: { invoiceID: "00000000-0000-0000-0000-000000000000", lineItems: [], contact: {}, type: Invoice.TypeEnum.ACCPAY }, amount: 10.0, date: "2019-03-12" }]}';
        'x-ruby-requestBody': 'allocations = { allocations: [{ invoice: { invoice_id: "00000000-0000-0000-0000-000000000000", line_items: [], contact: {}, type: XeroRuby::Accounting::Invoice::ACCPAY }, amount: 10.0, date: "2019-03-12" }]}';
      };
    };
    '/Overpayments/{OverpaymentID}/History': {
      get: {
        operationId: 'getOverpaymentHistory';
        parameters: [
          {
            description: 'Unique identifier for a Overpayment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'OverpaymentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRetrieved';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves history records of a specific overpayment';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createOverpaymentHistory';
        parameters: [
          {
            description: 'Unique identifier for a Overpayment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'OverpaymentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          $ref: '#/components/requestBodies/historyRecords';
        };
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRecordCreated';
          };
          '400': {
            content: {
              'application/json': {
                example: '{ "ErrorNumber": 10, "Type": "ValidationException", "Message": "A validation exception occurred", "Elements": [ { "DateUTCString": "2019-03-12T22:30:13", "DateUTC": "\\/Date(1552429813667)\\/", "Details": "Hello World", "ValidationErrors": [ { "Message": "The document with the supplied id was not found for this endpoint." } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Error';
                };
              };
            };
            description: 'A failed request due to validation error - API is not able to create HistoryRecord for Overpayments';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates a history record for a specific overpayment';
        tags: ['Accounting'];
        'x-example': [
          {
            historyRecord: null;
            is_object: true;
            key: 'historyRecord';
            keyPascal: 'HistoryRecord';
            keySnake: 'history_record';
          },
          {
            Details: null;
            default: 'Hello World';
            is_last: true;
            key: 'details';
            keyPascal: 'Details';
            object: 'historyRecord';
          },
          {
            historyRecords: null;
            is_object: true;
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
          },
          {
            add_historyRecord: null;
            is_array_add: true;
            is_last: true;
            java: 'HistoryRecords';
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
            object: 'historyRecord';
            python: 'history_record';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/PaymentServices': {
      get: {
        operationId: 'getPaymentServices';
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "ab82a7dd-5070-4e82-b841-0af52909fe04", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552488713171)\\/", "PaymentServices": [ { "PaymentServiceID": "54b3b4f6-0443-4fba-bcd1-61ec0c35ca55", "PaymentServiceName": "PayUpNow", "PaymentServiceUrl": "https://www.payupnow.com/", "PaymentServiceType": "Custom", "PayNowText": "Time To Pay" } ] }';
                schema: {
                  $ref: '#/components/schemas/PaymentServices';
                };
              };
            };
            description: 'Success - return response of type PaymentServices array for all PaymentService';
          };
        };
        security: [
          {
            OAuth2: ['paymentservices'];
          },
        ];
        summary: 'Retrieves payment services';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createPaymentService';
        requestBody: {
          content: {
            'application/json': {
              example: '{ "PaymentServices": [ { "PaymentServiceName": "PayUpNow", "PaymentServiceUrl": "https://www.payupnow.com/", "PayNowText": "Time To Pay" } ] }';
              schema: {
                $ref: '#/components/schemas/PaymentServices';
              };
            };
          };
          description: 'PaymentServices array with PaymentService object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "7ed8b3c0-2155-49ee-a583-f2dce6607dfb", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552488712813)\\/", "PaymentServices": [ { "PaymentServiceID": "54b3b4f6-0443-4fba-bcd1-61ec0c35ca55", "PaymentServiceName": "PayUpNow", "PaymentServiceUrl": "https://www.payupnow.com/", "PaymentServiceType": "Custom", "PayNowText": "Time To Pay", "ValidationErrors": [ { "Message": "Payment service could not be found" } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/PaymentServices';
                };
              };
            };
            description: 'Success - return response of type PaymentServices array for newly created PaymentService';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['paymentservices'];
          },
        ];
        summary: 'Creates a payment service';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            key: 'paymentService';
            keyPascal: 'PaymentService';
            keySnake: 'payment_service';
            object: null;
          },
          {
            default: 'ACME Payments';
            key: 'paymentServiceName';
            keyPascal: 'PaymentServiceName';
            keySnake: 'payment_service_name';
            object: 'paymentService';
            paymentServiceName: null;
          },
          {
            default: 'https://www.payupnow.com/';
            key: 'paymentServiceUrl';
            keyPascal: 'PaymentServiceUrl';
            keySnake: 'payment_service_url';
            object: 'paymentService';
            paymentServiceUrl: null;
          },
          {
            default: 'Pay Now';
            is_last: true;
            key: 'payNowText';
            keyPascal: 'PayNowText';
            keySnake: 'pay_now_text';
            object: 'paymentService';
            payNowText: null;
          },
          {
            is_object: true;
            key: 'paymentServices';
            keyPascal: 'PaymentServices';
            paymentServices: null;
          },
          {
            add_paymentService: null;
            is_array_add: true;
            is_last: true;
            java: 'PaymentServices';
            key: 'paymentServices';
            keyPascal: 'PaymentServices';
            object: 'paymentService';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ paymentServices: [{ paymentServiceName: "PayUpNow", paymentServiceUrl: "https://www.payupnow.com/", payNowText: "Time To Pay" }]}';
        'x-ruby-requestBody': 'payment_services = { payment_services: [{ payment_service_name: "PayUpNow", payment_service_url: "https://www.payupnow.com/", pay_now_text: "Time To Pay" }]}';
      };
    };
    '/Payments': {
      get: {
        operationId: 'getPayments';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter by an any element';
            example: 'Status=="AUTHORISED"';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-java': 'Status==&quot;&apos; + Payment.StatusEnum.AUTHORISED + &apos;&quot;';
            'x-example-php': 'Status==&quot;&apos; . \\XeroAPI\\XeroPHP\\Models\\Accounting\\Payment::STATUS_AUTHORISED . &apos;&quot;';
            'x-ruby-param': 'Status==#{XeroRuby::Accounting::Payment::AUTHORISED}';
          },
          {
            description: 'Order by an any element';
            example: 'Amount ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Up to 100 payments will be returned in a single API call';
            example: 1;
            in: 'query';
            name: 'page';
            schema: {
              type: 'integer';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "9f310473-e1b5-4704-a25c-eec653deb596", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552431874205)\\/", "Payments": [ { "PaymentID": "99ea7f6b-c513-4066-bc27-b7c65dcd76c2", "BatchPaymentID": "b54aa50c-794c-461b-89d1-846e1b84d9c0", "BatchPayment": { "Account": { "AccountID": "5690f1e8-1d02-4893-90c2-ee1a69eff942" }, "BatchPaymentID": "b54aa50c-794c-461b-89d1-846e1b84d9c0", "Date": "\\/Date(1552521600000+0000)\\/", "Type": "RECBATCH", "Status": "AUTHORISED", "TotalAmount": "50.00", "UpdatedDateUTC": "\\/Date(1541176592690+0000)\\/", "IsReconciled": "false" }, "Date": "\\/Date(1543449600000+0000)\\/", "BankAmount": 46.00, "Amount": 46.00, "Reference": "", "CurrencyRate": 1.000000, "PaymentType": "ACCRECPAYMENT", "Status": "AUTHORISED", "UpdatedDateUTC": "\\/Date(1541176592690+0000)\\/", "HasAccount": true, "IsReconciled": false, "Account": { "AccountID": "5690f1e8-1d02-4893-90c2-ee1a69eff942", "Code": "970" }, "Invoice": { "Type": "ACCREC", "InvoiceID": "046d8a6d-1ae1-4b4d-9340-5601bdf41b87", "InvoiceNumber": "INV-0002", "Payments": [], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "HasErrors": false, "IsDiscounted": false, "Contact": { "ContactID": "a3675fc4-f8dd-4f03-ba5b-f1870566bcd7", "ContactNumber": "", "Name": "Barney Rubble-83203", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "LineItems": [], "CurrencyCode": "NZD" }, "HasValidationErrors": false }, { "PaymentID": "6b037c9b-2e5d-4905-84d3-eabfb3438242", "Date": "\\/Date(1552521600000+0000)\\/", "BankAmount": 2.00, "Amount": 2.00, "Reference": "Too much", "CurrencyRate": 1.000000, "PaymentType": "ARCREDITPAYMENT", "Status": "AUTHORISED", "UpdatedDateUTC": "\\/Date(1551812346173+0000)\\/", "HasAccount": true, "IsReconciled": false, "Account": { "AccountID": "136ebd08-60ea-4592-8982-be92c153b53a", "Code": "980" }, "Invoice": { "Type": "ACCRECCREDIT", "InvoiceID": "249f15fa-f2a7-4acc-8769-0984103f2225", "InvoiceNumber": "CN-0005", "Payments": [], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "HasErrors": false, "IsDiscounted": false, "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactNumber": "", "Name": "Liam Gallagher", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "LineItems": [], "CurrencyCode": "NZD" }, "HasValidationErrors": false } ] }';
                schema: {
                  $ref: '#/components/schemas/Payments';
                };
              };
            };
            description: 'Success - return response of type Payments array for all Payments';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves payments for invoices and credit notes';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'createPayment';
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Payments": [ { "Invoice": { "LineItems": [], "InvoiceID": "00000000-0000-0000-0000-000000000000" }, "Account": { "Code": "970" }, "Date": "2019-03-12", "Amount": 1 } ] }';
              schema: {
                $ref: '#/components/schemas/Payment';
              };
            };
          };
          description: 'Request body with a single Payment object';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "83b5715a-6a77-4c16-b5b8-2da08b5fde44", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552432238716)\\/", "Payments": [ { "PaymentID": "61ed71fc-01bf-4eb8-8419-8a18789ff45f", "Date": "\\/Date(1552348800000+0000)\\/", "BankAmount": 1.00, "Amount": 1.00, "CurrencyRate": 1.000000, "PaymentType": "ACCRECPAYMENT", "Status": "AUTHORISED", "UpdatedDateUTC": "\\/Date(1552432238623+0000)\\/", "HasAccount": true, "IsReconciled": false, "Account": { "AccountID": "5690f1e8-1d02-4893-90c2-ee1a69eff942", "Code": "970", "Name": "Owner A Funds Introduced" }, "Invoice": { "Type": "ACCREC", "InvoiceID": "c7c37b83-ac95-45ea-88ba-8ad83a5f22fe", "InvoiceNumber": "INV-0004", "Reference": "", "Prepayments": [], "Overpayments": [], "AmountDue": 229.00, "AmountPaid": 1.00, "SentToContact": false, "CurrencyRate": 1.000000, "HasErrors": false, "IsDiscounted": false, "Contact": { "ContactID": "a3675fc4-f8dd-4f03-ba5b-f1870566bcd7", "Name": "Barney Rubble-83203", "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2018-10-10T00:00:00", "Date": "\\/Date(1539129600000+0000)\\/", "DueDateString": "2018-10-18T00:00:00", "DueDate": "\\/Date(1539820800000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "boo", "UnitAmount": 200.00, "TaxType": "OUTPUT2", "TaxAmount": 30.00, "LineAmount": 200.00, "AccountCode": "200", "Tracking": [], "Quantity": 1.0000, "LineItemID": "173dfdb9-43b5-4bd2-ae25-9419e662a3a7", "ValidationErrors": [] } ], "SubTotal": 200.00, "TotalTax": 30.00, "Total": 230.00, "UpdatedDateUTC": "\\/Date(1552432238623+0000)\\/", "CurrencyCode": "NZD" }, "HasValidationErrors": true, "ValidationErrors": [ { "Message": "Payment amount exceeds the amount outstanding on this document" } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Payments';
                };
              };
            };
            description: 'Success - return response of type Payments array for newly created Payment';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates a single payment for invoice or credit notes';
        tags: ['Accounting'];
        'x-example': [
          {
            dateValue: null;
            default: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            is_date: true;
            java: 'LocalDate.now()';
            java_datatype: 'LocalDate';
            key: 'dateValue';
            keyPascal: 'Date';
            keySnake: 'date_value';
            php: "new DateTime('2020-10-10')";
            python: "dateutil.parser.parse('2020-10-10T00:00:00Z')";
          },
          {
            invoice: null;
            is_object: true;
            key: 'invoice';
            keyPascal: 'Invoice';
          },
          {
            default: '00000000-0000-0000-0000-000000000000';
            invoiceID: null;
            is_last: true;
            is_uuid: true;
            key: 'invoiceID';
            keyPascal: 'InvoiceID';
            keySnake: 'invoice_id';
            object: 'invoice';
          },
          {
            account: null;
            is_object: true;
            key: 'account';
            keyPascal: 'Account';
          },
          {
            accountID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            key: 'accountID';
            keyPascal: 'AccountID';
            keySnake: 'account_id';
            object: 'account';
          },
          {
            is_object: true;
            key: 'payment';
            keyPascal: 'Payment';
            payment: null;
          },
          {
            default: 'invoice';
            is_variable: true;
            key: 'invoice';
            keyPascal: 'Invoice';
            nonString: true;
            object: 'payment';
            set_invoice: null;
          },
          {
            default: 'account';
            is_variable: true;
            key: 'account';
            keyPascal: 'Account';
            nonString: true;
            object: 'payment';
            set_account: null;
          },
          {
            amount: null;
            default: 1;
            key: 'amount';
            keyPascal: 'Amount';
            nonString: true;
            object: 'payment';
          },
          {
            date: null;
            default: 'dateValue';
            is_last: true;
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'payment';
            python: 'date_value';
          },
          {
            is_object: true;
            key: 'payments';
            keyPascal: 'Payments';
            payments: null;
          },
          {
            add_payment: null;
            is_array_add: true;
            is_last: true;
            java: 'Payments';
            key: 'payments';
            keyPascal: 'Payments';
            object: 'payment';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ invoice: { invoiceID: "00000000-0000-0000-0000-000000000000", lineItems: [], contact: {}, type: Invoice.TypeEnum.ACCPAY }, account: { code: "970" }, date: "2019-03-12", amount: 1.0 }';
        'x-ruby-requestBody': 'invoice = { invoice: { invoice_id: "00000000-0000-0000-0000-000000000000", line_items: [], contact: {}, type: XeroRuby::Accounting::Invoice::ACCPAY }, account: { code: "970" }, date: "2019-03-12", amount: 1.0 }';
      };
      put: {
        operationId: 'createPayments';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Payments": [ { "Invoice": { "LineItems": [], "InvoiceID": "00000000-0000-0000-0000-000000000000" }, "Account": { "Code": "970" }, "Date": "2019-03-12", "Amount": 1 } ] }';
              schema: {
                $ref: '#/components/schemas/Payments';
              };
            };
          };
          description: 'Payments array with Payment object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "83b5715a-6a77-4c16-b5b8-2da08b5fde44", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552432238716)\\/", "Payments": [ { "PaymentID": "61ed71fc-01bf-4eb8-8419-8a18789ff45f", "Date": "\\/Date(1552348800000+0000)\\/", "BankAmount": 1.00, "Amount": 1.00, "CurrencyRate": 1.000000, "PaymentType": "ACCRECPAYMENT", "Status": "AUTHORISED", "UpdatedDateUTC": "\\/Date(1552432238623+0000)\\/", "HasAccount": true, "IsReconciled": false, "Account": { "AccountID": "5690f1e8-1d02-4893-90c2-ee1a69eff942", "Code": "970", "Name": "Owner A Funds Introduced" }, "Invoice": { "Type": "ACCREC", "InvoiceID": "c7c37b83-ac95-45ea-88ba-8ad83a5f22fe", "InvoiceNumber": "INV-0004", "Reference": "", "Prepayments": [], "Overpayments": [], "AmountDue": 229.00, "AmountPaid": 1.00, "SentToContact": false, "CurrencyRate": 1.000000, "HasErrors": false, "IsDiscounted": false, "Contact": { "ContactID": "a3675fc4-f8dd-4f03-ba5b-f1870566bcd7", "Name": "Barney Rubble-83203", "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2018-10-10T00:00:00", "Date": "\\/Date(1539129600000+0000)\\/", "DueDateString": "2018-10-18T00:00:00", "DueDate": "\\/Date(1539820800000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "boo", "UnitAmount": 200.00, "TaxType": "OUTPUT2", "TaxAmount": 30.00, "LineAmount": 200.00, "AccountCode": "200", "Tracking": [], "Quantity": 1.0000, "LineItemID": "173dfdb9-43b5-4bd2-ae25-9419e662a3a7", "ValidationErrors": [] } ], "SubTotal": 200.00, "TotalTax": 30.00, "Total": 230.00, "UpdatedDateUTC": "\\/Date(1552432238623+0000)\\/", "CurrencyCode": "NZD" }, "HasValidationErrors": true, "ValidationErrors": [ { "Message": "Payment amount exceeds the amount outstanding on this document" } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Payments';
                };
              };
            };
            description: 'Success - return response of type Payments array for newly created Payment';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates multiple payments for invoices or credit notes';
        tags: ['Accounting'];
        'x-example': [
          {
            dateValue: null;
            default: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            is_date: true;
            java: 'LocalDate.now()';
            java_datatype: 'LocalDate';
            key: 'dateValue';
            keyPascal: 'Date';
            keySnake: 'date_value';
            php: "new DateTime('2020-10-10')";
            python: "dateutil.parser.parse('2020-10-10T00:00:00Z')";
          },
          {
            invoice: null;
            is_object: true;
            key: 'invoice';
            keyPascal: 'Invoice';
          },
          {
            default: '00000000-0000-0000-0000-000000000000';
            invoiceID: null;
            is_last: true;
            is_uuid: true;
            key: 'invoiceID';
            keyPascal: 'InvoiceID';
            keySnake: 'invoice_id';
            object: 'invoice';
          },
          {
            account: null;
            is_object: true;
            key: 'account';
            keyPascal: 'Account';
          },
          {
            accountID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            key: 'accountID';
            keyPascal: 'AccountID';
            keySnake: 'account_id';
            object: 'account';
          },
          {
            is_object: true;
            key: 'payment';
            keyPascal: 'Payment';
            payment: null;
          },
          {
            default: 'invoice';
            is_variable: true;
            key: 'invoice';
            keyPascal: 'Invoice';
            nonString: true;
            object: 'payment';
            set_invoice: null;
          },
          {
            default: 'account';
            is_variable: true;
            key: 'account';
            keyPascal: 'Account';
            nonString: true;
            object: 'payment';
            set_account: null;
          },
          {
            amount: null;
            default: 1;
            key: 'amount';
            keyPascal: 'Amount';
            nonString: true;
            object: 'payment';
          },
          {
            date: null;
            default: 'dateValue';
            is_last: true;
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'payment';
            python: 'date_value';
          },
          {
            is_object: true;
            key: 'payments';
            keyPascal: 'Payments';
            payments: null;
          },
          {
            add_payment: null;
            is_array_add: true;
            is_last: true;
            java: 'Payments';
            key: 'payments';
            keyPascal: 'Payments';
            object: 'payment';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ payments: [{ invoice: { invoiceID: "00000000-0000-0000-0000-000000000000", lineItems: [], contact: {}, type: Invoice.TypeEnum.ACCPAY }, account: { code: "970" }, date: "2019-03-12", amount: 1.0 }]}';
        'x-ruby-requestBody': 'payments = { payments: [{ invoice: { invoice_id: "00000000-0000-0000-0000-000000000000", line_items: [], contact: {}, type: XeroRuby::Accounting::Invoice::ACCPAY }, account: { code: "970" }, date: "2019-03-12", amount: 1.0 }]}';
      };
    };
    '/Payments/{PaymentID}': {
      get: {
        operationId: 'getPayment';
        parameters: [
          {
            description: 'Unique identifier for a Payment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PaymentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "4876f9ee-3a17-47d8-8c1b-84377c8f2998", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552431874852)\\/", "Payments": [ { "PaymentID": "99ea7f6b-c513-4066-bc27-b7c65dcd76c2", "BatchPaymentID": "b54aa50c-794c-461b-89d1-846e1b84d9c0", "BatchPayment": { "Account": { "AccountID": "5690f1e8-1d02-4893-90c2-ee1a69eff942" }, "BatchPaymentID": "b54aa50c-794c-461b-89d1-846e1b84d9c0", "Date": "\\/Date(1543449600000+0000)\\/", "Type": "RECBATCH", "Status": "AUTHORISED", "TotalAmount": "50.00", "UpdatedDateUTC": "\\/Date(1541176592690+0000)\\/", "IsReconciled": "false" }, "Date": "\\/Date(1543449600000+0000)\\/", "BankAmount": 46.00, "Amount": 46.00, "CurrencyRate": 1.000000, "PaymentType": "ACCRECPAYMENT", "Status": "AUTHORISED", "UpdatedDateUTC": "\\/Date(1541176592690+0000)\\/", "HasAccount": true, "IsReconciled": false, "Account": { "AccountID": "5690f1e8-1d02-4893-90c2-ee1a69eff942", "Code": "970", "Name": "Owner A Funds Introduced" }, "Invoice": { "Type": "ACCREC", "InvoiceID": "046d8a6d-1ae1-4b4d-9340-5601bdf41b87", "InvoiceNumber": "INV-0002", "Reference": "Red Fish, Blue Fish", "Payments": [ { "PaymentID": "99ea7f6b-c513-4066-bc27-b7c65dcd76c2", "Date": "\\/Date(1543449600000+0000)\\/", "Amount": 46.00, "CurrencyRate": 1.000000, "HasAccount": false, "HasValidationErrors": false } ], "Prepayments": [], "Overpayments": [], "AmountDue": 0.00, "AmountPaid": 46.00, "SentToContact": true, "CurrencyRate": 1.000000, "HasErrors": false, "IsDiscounted": false, "Contact": { "ContactID": "a3675fc4-f8dd-4f03-ba5b-f1870566bcd7", "Name": "Barney Rubble-83203", "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2018-10-20T00:00:00", "Date": "\\/Date(1539993600000+0000)\\/", "DueDateString": "2018-12-30T00:00:00", "DueDate": "\\/Date(1546128000000+0000)\\/", "Status": "PAID", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "Acme Tires", "UnitAmount": 20.00, "TaxType": "OUTPUT2", "TaxAmount": 6.00, "LineAmount": 40.00, "AccountCode": "200", "Tracking": [], "Quantity": 2.0000, "LineItemID": "878d1688-a905-4866-ae91-5a772c2540c7", "ValidationErrors": [] } ], "SubTotal": 40.00, "TotalTax": 6.00, "Total": 46.00, "UpdatedDateUTC": "\\/Date(1541176592690+0000)\\/", "CurrencyCode": "NZD", "FullyPaidOnDate": "\\/Date(1543449600000+0000)\\/" }, "HasValidationErrors": false } ] }';
                schema: {
                  $ref: '#/components/schemas/Payments';
                };
              };
            };
            description: 'Success - return response of type Payments array for specified Payment';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves a specific payment for invoices and credit notes using a unique payment Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'deletePayment';
        parameters: [
          {
            description: 'Unique identifier for a Payment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PaymentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{   "Payments":[   {   "Status":"DELETED" } ] }';
              schema: {
                $ref: '#/components/schemas/PaymentDelete';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "ee23328c-4a8b-4ee7-8fb6-9796ffab9cb0", "Status": "OK", "ProviderName": "provider-name", "DateTimeUTC": "\\/Date(1583945852489)\\/", "Payments": [ { "PaymentID": "c94c996b-1ab3-4ff3-ad19-1cdc77f30817", "Date": "\\/Date(1567382400000+0000)\\/", "BankAmount": 2.00, "Amount": 2.00, "Reference": "foobar", "CurrencyRate": 1.000000, "PaymentType": "APCREDITPAYMENT", "Status": "DELETED", "UpdatedDateUTC": "\\/Date(1583945852373+0000)\\/", "HasAccount": true, "IsReconciled": false, "Account": { "AccountID": "57f261f0-e32d-4a7f-be82-22cd992c6367", "Code": "033", "Name": "Checking account" }, "Invoice": { "Type": "ACCPAYCREDIT", "InvoiceID": "dba68ebc-c05a-4e2d-b97d-964349e5b8d6", "InvoiceNumber": "", "Reference": "", "Prepayments": [], "Overpayments": [], "AmountDue": 22.00, "AmountPaid": 0.00, "SentToContact": false, "CurrencyRate": 1.000000, "IsDiscounted": false, "HasErrors": false, "Contact": { "ContactID": "216830cb-9a68-487e-928b-c1a7ccc4fc81", "Name": "FooBar73005", "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2017-01-02T00:00:00", "Date": "\\/Date(1483315200000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "Sample Item72716", "UnitAmount": 20.00, "TaxType": "INPUT", "TaxAmount": 2.00, "LineAmount": 20.00, "AccountCode": "400", "Tracking": [], "Quantity": 1.0000, "ValidationErrors": [] } ], "SubTotal": 20.00, "TotalTax": 2.00, "Total": 22.00, "UpdatedDateUTC": "\\/Date(1583945852363+0000)\\/", "CurrencyCode": "AUD" }, "HasValidationErrors": false } ] }';
                schema: {
                  $ref: '#/components/schemas/Payments';
                };
              };
            };
            description: 'Success - return response of type Payments array for updated Payment';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Updates a specific payment for invoices and credit notes';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            key: 'paymentDelete';
            keyPascal: 'PaymentDelete';
            paymentDelete: null;
          },
          {
            default: 'DELETED';
            is_last: true;
            key: 'status';
            keyPascal: 'Status';
            object: 'paymentDelete';
            status: null;
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ status: "DELETED" }';
        'x-ruby-requestBody': 'payments = { status: "DELETED" }';
      };
    };
    '/Payments/{PaymentID}/History': {
      get: {
        operationId: 'getPaymentHistory';
        parameters: [
          {
            description: 'Unique identifier for a Payment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PaymentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRetrieved';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves history records of a specific payment';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createPaymentHistory';
        parameters: [
          {
            description: 'Unique identifier for a Payment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PaymentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          $ref: '#/components/requestBodies/historyRecords';
        };
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRecordCreated';
          };
          '400': {
            content: {
              'application/json': {
                example: '{ "ErrorNumber": 10, "Type": "ValidationException", "Message": "A validation exception occurred", "Elements": [ { "DateUTCString": "2019-03-12T22:30:13", "DateUTC": "\\/Date(1552429813667)\\/", "Details": "Hello World", "ValidationErrors": [ { "Message": "The document with the supplied id was not found for this endpoint." } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Error';
                };
              };
            };
            description: 'A failed request due to validation error - API is not able to create HistoryRecord for Payments';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates a history record for a specific payment';
        tags: ['Accounting'];
        'x-example': [
          {
            historyRecord: null;
            is_object: true;
            key: 'historyRecord';
            keyPascal: 'HistoryRecord';
            keySnake: 'history_record';
          },
          {
            Details: null;
            default: 'Hello World';
            is_last: true;
            key: 'details';
            keyPascal: 'Details';
            object: 'historyRecord';
          },
          {
            historyRecords: null;
            is_object: true;
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
          },
          {
            add_historyRecord: null;
            is_array_add: true;
            is_last: true;
            java: 'HistoryRecords';
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
            object: 'historyRecord';
            python: 'history_record';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/Prepayments': {
      get: {
        operationId: 'getPrepayments';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter by an any element';
            example: 'Status=="AUTHORISED"';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-java': 'Status==&quot;&apos; + Prepayment.StatusEnum.AUTHORISED + &apos;&quot;';
            'x-example-php': 'Status==&quot;&apos; . \\XeroAPI\\XeroPHP\\Models\\Accounting\\Prepayment::STATUS_AUTHORISED . &apos;&quot;';
            'x-ruby-param': 'Status==#{XeroRuby::Accounting::Prepayment::AUTHORISED}';
          },
          {
            description: 'Order by an any element';
            example: 'Reference ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'e.g. page=1 – Up to 100 prepayments will be returned in a single API call with line items shown for each overpayment';
            example: 1;
            in: 'query';
            name: 'page';
            schema: {
              type: 'integer';
            };
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "d7a9ca0c-6159-4c26-ad2e-715440c50b7d", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552489227595)\\/", "Prepayments": [ { "PrepaymentID": "ce0cddef-cf5a-4e59-b638-f225679115a7", "ID": "ce0cddef-cf5a-4e59-b638-f225679115a7", "Type": "RECEIVE-PREPAYMENT", "Reference": "INV-0011", "RemainingCredit": 3450.00, "Allocations": [], "Payments": [], "HasAttachments": true, "Contact": { "ContactID": "be392c72-c121-4f83-9512-03ac71e54c20", "Name": "Luke Skywalker", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-03-13T00:00:00", "Date": "\\/Date(1552435200000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "Exclusive", "LineItems": [], "SubTotal": 3000.00, "TotalTax": 450.00, "Total": 3450.00, "UpdatedDateUTC": "\\/Date(1552489187730+0000)\\/", "CurrencyCode": "NZD" } ] }';
                schema: {
                  $ref: '#/components/schemas/Prepayments';
                };
              };
            };
            description: 'Success - return response of type Prepayments array for all Prepayment';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves prepayments';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Prepayments/{PrepaymentID}': {
      get: {
        operationId: 'getPrepayment';
        parameters: [
          {
            description: 'Unique identifier for a PrePayment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PrepaymentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "18e5f578-ef28-4096-a7aa-d06d65574b99", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1553540376847)\\/", "Prepayments": [ { "PrepaymentID": "ce0cddef-cf5a-4e59-b638-f225679115a7", "ID": "ce0cddef-cf5a-4e59-b638-f225679115a7", "CurrencyRate": 1.000000, "Type": "RECEIVE-PREPAYMENT", "Reference": "INV-0011", "RemainingCredit": 3449.00, "Allocations": [ { "Amount": 1.00, "Date": "\\/Date(1552435200000+0000)\\/", "Invoice": { "InvoiceID": "c7c37b83-ac95-45ea-88ba-8ad83a5f22fe", "InvoiceNumber": "INV-0004", "Payments": [], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "HasErrors": false, "IsDiscounted": false, "LineItems": [] } } ], "Payments": [], "HasAttachments": true, "Attachments": [ { "AttachmentID": "2ca06aa0-3629-474a-9401-553d4b7fa9b0", "FileName": "giphy.gif", "Url": "https://api.xero.com/api.xro/2.0/banktransaction/ce0cddef-cf5a-4e59-b638-f225679115a7/Attachments/giphy.gif", "MimeType": "image/gif", "ContentLength": 495727 } ], "Contact": { "ContactID": "be392c72-c121-4f83-9512-03ac71e54c20", "ContactStatus": "ACTIVE", "Name": "Luke Skywalker", "EmailAddress": "", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "" }, { "AddressType": "POBOX", "City": "", "Region": "", "PostalCode": "", "Country": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1552329691573+0000)\\/", "ContactGroups": [], "DefaultCurrency": "NZD", "ContactPersons": [], "HasValidationErrors": false }, "DateString": "2019-03-13T00:00:00", "Date": "\\/Date(1552435200000+0000)\\/", "Status": "AUTHORISED", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "Light Speeder", "UnitAmount": 3000.00, "TaxType": "OUTPUT2", "TaxAmount": 450.00, "LineAmount": 3000.00, "AccountCode": "200", "Tracking": [], "Quantity": 1.0000, "DiscountEnteredAsPercent": true, "ValidationErrors": [] } ], "SubTotal": 3000.00, "TotalTax": 450.00, "Total": 3450.00, "UpdatedDateUTC": "\\/Date(1552522424850+0000)\\/", "CurrencyCode": "NZD" } ] }';
                schema: {
                  $ref: '#/components/schemas/Prepayments';
                };
              };
            };
            description: 'Success - return response of type Prepayments array for a specified Prepayment';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Allows you to retrieve a specified prepayments';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Prepayments/{PrepaymentID}/Allocations': {
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createPrepaymentAllocations';
        parameters: [
          {
            description: 'Unique identifier for Prepayment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PrepaymentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Allocations": [ { "Invoice": { "LineItems": [], "InvoiceID": "00000000-0000-0000-0000-000000000000" }, "Amount": 1, "Date": "2019-01-10" } ] }';
              schema: {
                $ref: '#/components/schemas/Allocations';
              };
            };
          };
          description: 'Allocations with an array of Allocation object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "d4758808-d14d-45d5-851a-52787ae5739a", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552522424927)\\/", "Allocations": [ { "Amount": 1.00, "Date": "\\/Date(1552435200000+0000)\\/", "Invoice": { "InvoiceID": "c7c37b83-ac95-45ea-88ba-8ad83a5f22fe", "Payments": [], "CreditNotes": [], "Prepayments": [], "Overpayments": [], "HasErrors": false, "IsDiscounted": false, "LineItems": [], "ValidationErrors": [] }, "Prepayment": { "PrepaymentID": "ce0cddef-cf5a-4e59-b638-f225679115a7", "ID": "ce0cddef-cf5a-4e59-b638-f225679115a7", "LineItems": [] }, "ValidationErrors": [] } ] }';
                schema: {
                  $ref: '#/components/schemas/Allocations';
                };
              };
            };
            description: 'Success - return response of type Allocations array of Allocation for all Prepayment';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Allows you to create an Allocation for prepayments';
        tags: ['Accounting'];
        'x-example': [
          {
            currDate: null;
            default: 'LocalDate.now()';
            is_date: true;
            java: 'LocalDate.now()';
            java_datatype: 'LocalDate';
            key: 'currDate';
            keyPascal: 'Date';
            keySnake: 'curr_date';
            php: "new DateTime('2019-12-10')";
            python: "dateutil.parser.parse('2020-12-03T00:00:00Z')";
          },
          {
            invoice: null;
            is_object: true;
            key: 'invoice';
            keyPascal: 'Invoice';
          },
          {
            default: '00000000-0000-0000-0000-000000000000';
            invoiceID: null;
            is_last: true;
            is_uuid: true;
            key: 'invoiceID';
            keyPascal: 'InvoiceID';
            keySnake: 'invoice_id';
            object: 'invoice';
          },
          {
            allocation: null;
            is_object: true;
            key: 'allocation';
            keyPascal: 'Allocation';
          },
          {
            default: 'invoice';
            is_variable: true;
            key: 'invoice';
            keyPascal: 'Invoice';
            nonString: true;
            object: 'allocation';
            set_invoice: null;
          },
          {
            amount: null;
            default: 1;
            key: 'amount';
            keyPascal: 'Amount';
            nonString: true;
            object: 'allocation';
          },
          {
            date: null;
            default: 'currDate';
            is_last: true;
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'allocation';
            python: 'curr_date';
          },
          {
            allocations: null;
            is_object: true;
            key: 'allocations';
            keyPascal: 'Allocations';
          },
          {
            add_allocation: null;
            is_array_add: true;
            is_last: true;
            java: 'Allocations';
            key: 'allocations';
            keyPascal: 'Allocations';
            object: 'allocation';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ allocations: [{ invoice: { invoiceID: "00000000-0000-0000-0000-000000000000", lineItems: [], contact: {}, type: null }, amount: 1.0, date: "2019-03-13" }]}';
        'x-ruby-requestBody': 'allocations = { allocations: [{ invoice: { invoice_id: "00000000-0000-0000-0000-000000000000", line_items: [], contact: {}, type: null }, amount: 1.0, date: "2019-03-13" }]}';
      };
    };
    '/Prepayments/{PrepaymentID}/History': {
      get: {
        operationId: 'getPrepaymentHistory';
        parameters: [
          {
            description: 'Unique identifier for a PrePayment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PrepaymentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRetrieved';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves history record for a specific prepayment';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createPrepaymentHistory';
        parameters: [
          {
            description: 'Unique identifier for a PrePayment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PrepaymentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          $ref: '#/components/requestBodies/historyRecords';
        };
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRecordCreated';
          };
          '400': {
            content: {
              'application/json': {
                example: ' { "ErrorNumber": 10, "Type": "ValidationException", "Message": "A validation exception occurred", "Elements": [ { "DateUTCString": "2019-03-14T00:15:35", "DateUTC": "\\/Date(1552522535440)\\/", "Details": "Hello World", "ValidationErrors": [ { "Message": "The document with the supplied id was not found for this endpoint." } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Error';
                };
              };
            };
            description: 'Unsupported - return response incorrect exception, API is not able to create HistoryRecord for Expense Claims';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates a history record for a specific prepayment';
        tags: ['Accounting'];
        'x-example': [
          {
            historyRecord: null;
            is_object: true;
            key: 'historyRecord';
            keyPascal: 'HistoryRecord';
            keySnake: 'history_record';
          },
          {
            Details: null;
            default: 'Hello World';
            is_last: true;
            key: 'details';
            keyPascal: 'Details';
            object: 'historyRecord';
          },
          {
            historyRecords: null;
            is_object: true;
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
          },
          {
            add_historyRecord: null;
            is_array_add: true;
            is_last: true;
            java: 'HistoryRecords';
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
            object: 'historyRecord';
            python: 'history_record';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/PurchaseOrders': {
      get: {
        operationId: 'getPurchaseOrders';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter by purchase order status';
            example: 'SUBMITTED';
            in: 'query';
            name: 'Status';
            schema: {
              enum: ['DRAFT', 'SUBMITTED', 'AUTHORISED', 'BILLED', 'DELETED'];
              type: 'string';
            };
          },
          {
            description: 'Filter by purchase order date (e.g. GET https://.../PurchaseOrders?DateFrom=2015-12-01&DateTo=2015-12-31';
            example: '2019-12-01';
            in: 'query';
            name: 'DateFrom';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Filter by purchase order date (e.g. GET https://.../PurchaseOrders?DateFrom=2015-12-01&DateTo=2015-12-31';
            example: '2019-12-31';
            in: 'query';
            name: 'DateTo';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Order by an any element';
            example: 'PurchaseOrderNumber ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'To specify a page, append the page parameter to the URL e.g. ?page=1. If there are 100 records in the response you will need to check if there is any more data by fetching the next page e.g ?page=2 and continuing this process until no more results are returned.';
            example: 1;
            in: 'query';
            name: 'page';
            schema: {
              type: 'integer';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "66910bfc-15cc-4692-bd4c-cc8f671e653c", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552523977238)\\/", "PurchaseOrders": [ { "PurchaseOrderID": "f9627f0d-b715-4039-bb6a-96dc3eae5ec5", "PurchaseOrderNumber": "PO-0001", "DateString": "2019-03-12T00:00:00", "Date": "\\/Date(1552348800000+0000)\\/", "AttentionTo": "Jimmy", "HasErrors": false, "IsDiscounted": false, "Type": "PURCHASEORDER", "CurrencyRate": 1.000000, "CurrencyCode": "NZD", "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "Addresses": [ { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551747281053+0000)\\/", "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "Status": "DELETED", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "Foobar", "UnitAmount": 20.0000, "TaxAmount": 0.00, "LineAmount": 20.00, "Tracking": [], "Quantity": 1.0000, "LineItemID": "0f7b54b8-bfa4-4c5d-9c22-73dbd5796e54" } ], "SubTotal": 20.00, "TotalTax": 0.00, "Total": 20.00, "UpdatedDateUTC": "\\/Date(1552522703443+0000)\\/", "HasAttachments": false }, { "PurchaseOrderID": "6afa2e02-c514-4964-ab89-b5c0179b8c50", "PurchaseOrderNumber": "PO-0002", "DateString": "2019-03-12T00:00:00", "Date": "\\/Date(1552348800000+0000)\\/", "AttentionTo": "Jimmy", "HasErrors": false, "IsDiscounted": false, "Type": "PURCHASEORDER", "CurrencyRate": 1.000000, "CurrencyCode": "NZD", "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "Addresses": [ { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551747281053+0000)\\/", "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "Status": "DELETED", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "Foobar", "UnitAmount": 20.0000, "TaxAmount": 0.00, "LineAmount": 20.00, "Tracking": [], "Quantity": 1.0000, "LineItemID": "3e4ec232-32b9-491b-84dd-48fb9aa8916f" } ], "SubTotal": 20.00, "TotalTax": 0.00, "Total": 20.00, "UpdatedDateUTC": "\\/Date(1552522834733+0000)\\/", "HasAttachments": false } ] }';
                schema: {
                  $ref: '#/components/schemas/PurchaseOrders';
                };
              };
            };
            description: 'Success - return response of type PurchaseOrder array of all PurchaseOrder';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves purchase orders';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateOrCreatePurchaseOrders';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "PurchaseOrders": [ { "Contact": { "ContactID": "00000000-0000-0000-0000-000000000000" }, "LineItems": [ { "Description": "Foobar", "Quantity": 1, "UnitAmount": 20, "AccountCode": "710" } ], "Date": "2019-03-13" } ] }';
              schema: {
                $ref: '#/components/schemas/PurchaseOrders';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: ' { "Id": "aa2f9d23-fd76-4bee-9600-30c0f0f34036", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552522946173)\\/", "PurchaseOrders": [ { "PurchaseOrderID": "56204648-8fbe-46f8-b09c-2125f7939533", "PurchaseOrderNumber": "PO-0004", "DateString": "2019-03-13T00:00:00", "Date": "\\/Date(1552435200000+0000)\\/", "HasErrors": false, "IsDiscounted": false, "TotalDiscount": 0.00, "SentToContact": false, "Type": "PURCHASEORDER", "CurrencyRate": 1.000000, "CurrencyCode": "NZD", "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "EmailAddress": "liam@rockstar.com", "BankAccountDetails": "", "Addresses": [ null, { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, null, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551747281053+0000)\\/", "ContactGroups": [ { "ContactGroupID": "17b44ed7-4389-4162-91cb-3dd5766e4e22", "Name": "Oasis", "Status": "ACTIVE", "Contacts": [], "HasValidationErrors": false } ], "IsSupplier": true, "IsCustomer": true, "SalesTrackingCategories": [], "PurchasesTrackingCategories": [], "ContactPersons": [], "HasValidationErrors": false }, "Status": "DRAFT", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "Foobar", "UnitAmount": 20.0000, "TaxType": "INPUT2", "TaxAmount": 3.00, "LineAmount": 20.00, "AccountCode": "710", "Tracking": [], "Quantity": 1.0000, "LineItemID": "792b7e40-b9f2-47f0-8624-b09f4b0166dd" } ], "SubTotal": 20.00, "TotalTax": 3.00, "Total": 23.00, "UpdatedDateUTC": "\\/Date(1552522946077+0000)\\/", "StatusAttributeString": "ERROR", "Warnings": [ { "Message": "Only AUTHORISED and BILLED purchase orders may have SentToContact updated." } ], "ValidationErrors": [ { "Message": "Order number must be unique" } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/PurchaseOrders';
                };
              };
            };
            description: 'Success - return response of type PurchaseOrder array for specified PurchaseOrder';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Updates or creates one or more purchase orders';
        tags: ['Accounting'];
        'x-example': [
          {
            dateValue: null;
            default: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            is_date: true;
            java: 'LocalDate.now()';
            java_datatype: 'LocalDate';
            key: 'dateValue';
            keyPascal: 'Date';
            keySnake: 'date_value';
            php: "new DateTime('2019-12-10')";
            python: "dateutil.parser.parse('2020-12-03T00:00:00Z')";
          },
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            contactID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'contactId';
            keyPascal: 'ContactID';
            keySnake: 'contact_id';
            object: 'contact';
          },
          {
            is_object: true;
            key: 'lineItem';
            keyPascal: 'LineItem';
            keySnake: 'line_item';
            lineItem: null;
          },
          {
            default: 'Foobar';
            description: null;
            key: 'description';
            keyPascal: 'Description';
            object: 'lineItem';
          },
          {
            default: 1;
            key: 'quantity';
            keyPascal: 'Quantity';
            nonString: true;
            object: 'lineItem';
            quantity: null;
          },
          {
            default: 20;
            key: 'unitAmount';
            keyPascal: 'UnitAmount';
            keySnake: 'unit_amount';
            nonString: true;
            object: 'lineItem';
            unitAmount: null;
          },
          {
            accountCode: null;
            default: '000';
            is_last: true;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'lineItem';
          },
          {
            is_list: true;
            key: 'lineItems';
            keyPascal: 'LineItem';
            keySnake: 'line_items';
            lineItems: null;
          },
          {
            add_lineitems: null;
            is_last: true;
            is_list_add: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            object: 'lineItem';
            python: 'line_item';
          },
          {
            is_object: true;
            key: 'purchaseOrder';
            keyPascal: 'PurchaseOrder';
            keySnake: 'purchase_order';
            purchaseOrder: null;
          },
          {
            default: 'contact';
            is_variable: true;
            key: 'contact';
            keyPascal: 'Contact';
            nonString: true;
            object: 'purchaseOrder';
            set_contact: null;
          },
          {
            default: 'lineItems';
            is_variable: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            nonString: true;
            object: 'purchaseOrder';
            python: 'line_items';
            set_lineitem: null;
          },
          {
            date: null;
            default: 'dateValue';
            is_last: true;
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'purchaseOrder';
            python: 'date_value';
          },
          {
            is_object: true;
            key: 'purchaseOrders';
            keyPascal: 'PurchaseOrders';
            purchaseOrders: null;
          },
          {
            add_purchaseOrder: null;
            is_array_add: true;
            is_last: true;
            java: 'PurchaseOrders';
            key: 'purchaseOrders';
            keyPascal: 'PurchaseOrders';
            keySnake: 'purchase_orders';
            object: 'purchaseOrder';
            python: 'purchase_order';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ purchaseOrders: [ { contact: { contactID: "00000000-0000-0000-0000-000000000000" }, lineItems: [{ description: "Foobar", quantity: 1.0, unitAmount: 20.0, accountCode: "710" }], date: "2019-03-13" }]}';
        'x-ruby-requestBody': 'purchase_orders = { purchase_orders: [{ contact: { contact_id: "00000000-0000-0000-0000-000000000000" }, line_items: [{ description: "Foobar", quantity: 1.0, unitAmount: 20.0, accountCode: "710" }], date: "2019-03-13" }]}';
      };
      put: {
        operationId: 'createPurchaseOrders';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "PurchaseOrders": [ { "Contact": { "ContactID": "00000000-0000-0000-0000-000000000000" }, "LineItems": [ { "Description": "Foobar", "Quantity": 1, "UnitAmount": 20, "AccountCode": "710" } ], "Date": "2019-03-13" } ] }';
              schema: {
                $ref: '#/components/schemas/PurchaseOrders';
              };
            };
          };
          description: 'PurchaseOrders with an array of PurchaseOrder object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: ' { "Id": "aa2f9d23-fd76-4bee-9600-30c0f0f34036", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552522946173)\\/", "PurchaseOrders": [ { "PurchaseOrderID": "56204648-8fbe-46f8-b09c-2125f7939533", "PurchaseOrderNumber": "PO-0004", "DateString": "2019-03-13T00:00:00", "Date": "\\/Date(1552435200000+0000)\\/", "HasErrors": false, "IsDiscounted": false, "TotalDiscount": 0.00, "SentToContact": false, "Type": "PURCHASEORDER", "CurrencyRate": 1.000000, "CurrencyCode": "NZD", "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "EmailAddress": "liam@rockstar.com", "BankAccountDetails": "", "Addresses": [ null, { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, null, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551747281053+0000)\\/", "ContactGroups": [ { "ContactGroupID": "17b44ed7-4389-4162-91cb-3dd5766e4e22", "Name": "Oasis", "Status": "ACTIVE", "Contacts": [], "HasValidationErrors": false } ], "IsSupplier": true, "IsCustomer": true, "SalesTrackingCategories": [], "PurchasesTrackingCategories": [], "ContactPersons": [], "HasValidationErrors": false }, "Status": "DRAFT", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "Foobar", "UnitAmount": 20.0000, "TaxType": "INPUT2", "TaxAmount": 3.00, "LineAmount": 20.00, "AccountCode": "710", "Tracking": [], "Quantity": 1.0000, "LineItemID": "792b7e40-b9f2-47f0-8624-b09f4b0166dd" } ], "SubTotal": 20.00, "TotalTax": 3.00, "Total": 23.00, "UpdatedDateUTC": "\\/Date(1552522946077+0000)\\/", "StatusAttributeString": "ERROR", "Warnings": [ { "Message": "Only AUTHORISED and BILLED purchase orders may have SentToContact updated." } ], "ValidationErrors": [ { "Message": "Order number must be unique" } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/PurchaseOrders';
                };
              };
            };
            description: 'Success - return response of type PurchaseOrder array for specified PurchaseOrder';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates one or more purchase orders';
        tags: ['Accounting'];
        'x-example': [
          {
            dateValue: null;
            default: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            is_date: true;
            java: 'LocalDate.now()';
            java_datatype: 'LocalDate';
            key: 'dateValue';
            keyPascal: 'Date';
            keySnake: 'date_value';
            php: "new DateTime('2019-12-10')";
            python: "dateutil.parser.parse('2020-12-03T00:00:00Z')";
          },
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            contactID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'contactId';
            keyPascal: 'ContactID';
            keySnake: 'contact_id';
            object: 'contact';
          },
          {
            is_object: true;
            key: 'lineItem';
            keyPascal: 'LineItem';
            keySnake: 'line_item';
            lineItem: null;
          },
          {
            default: 'Foobar';
            description: null;
            key: 'description';
            keyPascal: 'Description';
            object: 'lineItem';
          },
          {
            default: 1;
            key: 'quantity';
            keyPascal: 'Quantity';
            nonString: true;
            object: 'lineItem';
            quantity: null;
          },
          {
            default: 20;
            key: 'unitAmount';
            keyPascal: 'UnitAmount';
            keySnake: 'unit_amount';
            nonString: true;
            object: 'lineItem';
            unitAmount: null;
          },
          {
            accountCode: null;
            default: '000';
            is_last: true;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'lineItem';
          },
          {
            is_list: true;
            key: 'lineItems';
            keyPascal: 'LineItem';
            keySnake: 'line_items';
            lineItems: null;
          },
          {
            add_lineitems: null;
            is_last: true;
            is_list_add: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            object: 'lineItem';
            python: 'line_item';
          },
          {
            is_object: true;
            key: 'purchaseOrder';
            keyPascal: 'PurchaseOrder';
            keySnake: 'purchase_order';
            purchaseOrder: null;
          },
          {
            default: 'contact';
            is_variable: true;
            key: 'contact';
            keyPascal: 'Contact';
            nonString: true;
            object: 'purchaseOrder';
            set_contact: null;
          },
          {
            default: 'lineItems';
            is_variable: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            nonString: true;
            object: 'purchaseOrder';
            python: 'line_items';
            set_lineitem: null;
          },
          {
            date: null;
            default: 'dateValue';
            is_last: true;
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'purchaseOrder';
            python: 'date_value';
          },
          {
            is_object: true;
            key: 'purchaseOrders';
            keyPascal: 'PurchaseOrders';
            purchaseOrders: null;
          },
          {
            add_purchaseOrder: null;
            is_array_add: true;
            is_last: true;
            java: 'PurchaseOrders';
            key: 'purchaseOrders';
            keyPascal: 'PurchaseOrders';
            keySnake: 'purchase_orders';
            object: 'purchaseOrder';
            python: 'purchase_order';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ purchaseOrders: [{ contact: { contactID: "00000000-0000-0000-0000-000000000000" }, lineItems: [{ description: "Foobar", quantity: 1.0, unitAmount: 20.0, accountCode: "710" }], date: "2019-03-13" }]}';
        'x-ruby-requestBody': 'purchase_orders = { purchase_orders: [{ contact: { contact_id: "00000000-0000-0000-0000-000000000000" }, line_items: [{ description: "Foobar", quantity: 1.0, unitAmount: 20.0, account_code: "710" }], date: "2019-03-13" }]}';
      };
    };
    '/PurchaseOrders/{PurchaseOrderID}': {
      get: {
        operationId: 'getPurchaseOrder';
        parameters: [
          {
            description: 'Unique identifier for a PurchaseOrder';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PurchaseOrderID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "53a8c7a5-92e8-475b-a037-acf7c55c3afd", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1553626110950)\\/", "PurchaseOrders": [ { "PurchaseOrderID": "15369a9f-17b6-4235-83c4-0029256d1c37", "PurchaseOrderNumber": "PO-0006", "DateString": "2019-03-26T00:00:00", "Date": "\\/Date(1553558400000+0000)\\/", "DeliveryDateString": "2019-03-28T00:00:00", "DeliveryDate": "\\/Date(1553731200000+0000)\\/", "DeliveryAddress": "101 Grafton Road\\nRoseneath\\nWellington\\n6011\\nNew Zealand", "AttentionTo": "CEO", "Telephone": "64 123-2222", "DeliveryInstructions": "Drop off at front  door", "HasErrors": false, "IsDiscounted": true, "TotalDiscount": 250.00, "SentToContact": false, "Reference": "foobar", "Type": "PURCHASEORDER", "CurrencyRate": 1.000000, "CurrencyCode": "NZD", "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "EmailAddress": "liam@rockstar.com", "BankAccountDetails": "", "Addresses": [ null, { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, null, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1553672800957+0000)\\/", "ContactGroups": [ { "ContactGroupID": "17b44ed7-4389-4162-91cb-3dd5766e4e22", "Name": "Oasis", "Status": "ACTIVE", "Contacts": [], "HasValidationErrors": false } ], "IsSupplier": true, "IsCustomer": true, "DefaultCurrency": "NZD", "SalesTrackingCategories": [], "PurchasesTrackingCategories": [], "ContactPersons": [], "HasValidationErrors": false }, "BrandingThemeID": "414d4a87-46d6-4cfc-ab42-4e29d22e5076", "Status": "DRAFT", "LineAmountTypes": "Exclusive", "LineItems": [ { "ItemCode": "123", "Description": "Brand new Fender Strats", "UnitAmount": 2500.0000, "TaxType": "INPUT2", "TaxAmount": 337.50, "LineAmount": 2250.00, "AccountCode": "630", "Tracking": [ { "Name": "Simpsons", "Option": "Homer", "TrackingCategoryID": "6a68adde-f210-4465-b0a9-0d8cc6f50762", "TrackingOptionID": "94faf12f-f65c-4331-8004-b0b7c5a2da23" } ], "Quantity": 1.0000, "DiscountRate": 10.00, "LineItemID": "8a9d3eca-e052-43bc-9b87-221d0648c045" } ], "SubTotal": 2250.00, "TotalTax": 337.50, "Total": 2587.50, "UpdatedDateUTC": "\\/Date(1553626029823+0000)\\/", "HasAttachments": true, "Attachments": [ { "AttachmentID": "7d94ccdc-ef7b-4806-87ac-8442f25e593b", "FileName": "HelloWorld.png", "Url": "https://api.xero.com/api.xro/2.0/PurchaseOrders/15369a9f-17b6-4235-83c4-0029256d1c37/Attachments/HelloWorld.png", "MimeType": "image/png", "ContentLength": 76091 } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/PurchaseOrders';
                };
              };
            };
            description: 'Success - return response of type PurchaseOrder array for specified PurchaseOrder';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves a specific purchase order using a unique purchase order Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updatePurchaseOrder';
        parameters: [
          {
            description: 'Unique identifier for a PurchaseOrder';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PurchaseOrderID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "PurchaseOrders": [ { "AttentionTo": "Peter Parker", "LineItems": [], "Contact": {} } ] }';
              schema: {
                $ref: '#/components/schemas/PurchaseOrders';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "0e9bb3f8-d68b-4bb2-a54d-7da240a4f51a", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552523976885)\\/", "PurchaseOrders": [ { "PurchaseOrderID": "f9fc1120-c937-489e-84bc-e822190cfe9c", "PurchaseOrderNumber": "PO-0005", "DateString": "2019-03-13T00:00:00", "Date": "\\/Date(1552435200000+0000)\\/", "AttentionTo": "Jimmy", "HasErrors": false, "IsDiscounted": false, "TotalDiscount": 0.00, "SentToContact": false, "Type": "PURCHASEORDER", "CurrencyRate": 1.000000, "CurrencyCode": "NZD", "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "EmailAddress": "liam@rockstar.com", "BankAccountDetails": "", "Addresses": [ null, { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, null, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551747281053+0000)\\/", "ContactGroups": [ { "ContactGroupID": "17b44ed7-4389-4162-91cb-3dd5766e4e22", "Name": "Oasis", "Status": "ACTIVE", "Contacts": [], "HasValidationErrors": false } ], "IsSupplier": true, "IsCustomer": true, "SalesTrackingCategories": [], "PurchasesTrackingCategories": [], "ContactPersons": [], "HasValidationErrors": false }, "Status": "DRAFT", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "Foobar", "UnitAmount": 20.0000, "TaxType": "INPUT2", "TaxAmount": 3.00, "LineAmount": 20.00, "AccountCode": "710", "Tracking": [], "Quantity": 1.0000, "LineItemID": "d1d9b2cd-c9f2-4445-8d98-0b8096cf4dae" } ], "SubTotal": 20.00, "TotalTax": 3.00, "Total": 23.00, "UpdatedDateUTC": "\\/Date(1552523976853+0000)\\/" } ] }';
                schema: {
                  $ref: '#/components/schemas/PurchaseOrders';
                };
              };
            };
            description: 'Success - return response of type PurchaseOrder array for updated PurchaseOrder';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Updates a specific purchase order';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            key: 'purchaseOrder';
            keyPascal: 'PurchaseOrder';
            keySnake: 'purchase_order';
            purchaseOrder: null;
          },
          {
            attentionTo: null;
            default: 'Peter Parker';
            is_last: true;
            key: 'attentionTo';
            keyPascal: 'AttentionTo';
            object: 'purchaseOrder';
          },
          {
            is_object: true;
            key: 'purchaseOrders';
            keyPascal: 'PurchaseOrders';
            purchaseOrders: null;
          },
          {
            add_purchaseOrder: null;
            is_array_add: true;
            is_last: true;
            java: 'PurchaseOrders';
            key: 'purchaseOrders';
            keyPascal: 'PurchaseOrders';
            keySnake: 'purchase_orders';
            object: 'purchaseOrder';
            python: 'purchase_order';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ purchaseOrders:[ { attentionTo: "Peter Parker", lineItems: [], contact: {} }]}';
        'x-ruby-requestBody': 'purchase_orders = { purchase_orders: [ { attention_to: "Peter Parker", line_items: [], contact: {} }]}';
      };
    };
    '/PurchaseOrders/{PurchaseOrderID}/Attachments': {
      get: {
        operationId: 'getPurchaseOrderAttachments';
        parameters: [
          {
            description: 'Unique identifier for Purchase Orders object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PurchaseOrderID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "dfc29f55-8ddd-4921-a82c-bcc0798d207f", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "/Date(1602100184437)/", "Attachments": [ { "AttachmentID": "dce4eaa7-c8a9-4867-9434-95832b427d3b", "FileName": "xero-dev1.png", "Url": "https://api.xero.com/api.xro/2.0/PurchaseOrders/93369c9b-c481-4e21-aaab-bb19e9a26efe/Attachments/2D_2.png", "MimeType": "image/png", "ContentLength": 98715 }, { "AttachmentID": "e58bd37b-e47f-451a-a42c-f946ef229c3e", "FileName": "xero-dev2.png", "Url": "https://api.xero.com/api.xro/2.0/PurchaseOrders/93369c9b-c481-4e21-aaab-bb19e9a26efe/Attachments/2D.png", "MimeType": "image/png", "ContentLength": 82529 }, { "AttachmentID": "c8faa564-223f-45e4-a5a1-94430a5b52c1", "FileName": "xero-dev3.png", "Url": "https://api.xero.com/api.xro/2.0/PurchaseOrders/93369c9b-c481-4e21-aaab-bb19e9a26efe/Attachments/Screen%20Shot%202020-09-12%20at%204.31.14%20pm.png", "MimeType": "image/png", "ContentLength": 146384 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array of Purchase Orders';
            'x-isAttachment': true;
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves attachments for a specific purchase order';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/PurchaseOrders/{PurchaseOrderID}/Attachments/{AttachmentID}': {
      get: {
        operationId: 'getPurchaseOrderAttachmentById';
        parameters: [
          {
            description: 'Unique identifier for Purchase Order object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PurchaseOrderID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Unique identifier for Attachment object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AttachmentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Account as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves specific attachment for a specific purchase order using a unique attachment Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/PurchaseOrders/{PurchaseOrderID}/Attachments/{FileName}': {
      get: {
        operationId: 'getPurchaseOrder≠AttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for Purchase Order object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PurchaseOrderID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name of the attachment';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Purchase Order as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves a specific attachment for a specific purchase order by filename';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updatePurchaseOrderAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for Purchase Order object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PurchaseOrderID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name of the attachment';
            example: 'xero-dev.png';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "aeff9be0-54c2-45dd-8e3d-aa4f8af0fbd7", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "/Date(1602100086197)/", "Attachments": [ { "AttachmentID": "dce4eaa7-c8a9-4867-9434-95832b427d3b", "FileName": "xero-dev.png", "Url": "https://api.xero.com/api.xro/2.0/PurchaseOrders/93369c9b-c481-4e21-aaab-bb19e9a26efe/Attachments/2D_2.png", "MimeType": "image/png", "ContentLength": 98715 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array of Attachment';
            'x-isAttachment': true;
          };
          '400': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error';
                };
              };
            };
            description: 'Validation Error - some data was incorrect returns response of type Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Updates a specific attachment for a specific purchase order by filename';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
      put: {
        operationId: 'createPurchaseOrderAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for Purchase Order object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PurchaseOrderID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name of the attachment';
            example: 'xero-dev.png';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "c728a4a4-179e-4bbd-a2d5-63e7f9ceba92", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "/Date(1602099934723)/", "Attachments": [ { "AttachmentID": "e58bd37b-e47f-451a-a42c-f946ef229c3e", "FileName": "xero-dev.png", "Url": "https://api.xero.com/api.xro/2.0/PurchaseOrders/93369c9b-c481-4e21-aaab-bb19e9a26efe/Attachments/2D.png", "MimeType": "image/png", "ContentLength": 82529 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array of Attachment';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Creates attachment for a specific purchase order';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
    };
    '/PurchaseOrders/{PurchaseOrderID}/History': {
      get: {
        operationId: 'getPurchaseOrderHistory';
        parameters: [
          {
            description: 'Unique identifier for a PurchaseOrder';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PurchaseOrderID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRetrieved';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves history for a specific purchase order';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createPurchaseOrderHistory';
        parameters: [
          {
            description: 'Unique identifier for a PurchaseOrder';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PurchaseOrderID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          $ref: '#/components/requestBodies/historyRecords';
        };
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRecordCreated';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates a history record for a specific purchase orders';
        tags: ['Accounting'];
        'x-example': [
          {
            historyRecord: null;
            is_object: true;
            key: 'historyRecord';
            keyPascal: 'HistoryRecord';
            keySnake: 'history_record';
          },
          {
            Details: null;
            default: 'Hello World';
            is_last: true;
            key: 'details';
            keyPascal: 'Details';
            object: 'historyRecord';
          },
          {
            historyRecords: null;
            is_object: true;
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
          },
          {
            add_historyRecord: null;
            is_array_add: true;
            is_last: true;
            java: 'HistoryRecords';
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
            object: 'historyRecord';
            python: 'history_record';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/PurchaseOrders/{PurchaseOrderID}/pdf': {
      get: {
        operationId: 'getPurchaseOrderAsPdf';
        parameters: [
          {
            description: 'Unique identifier for an Purchase Order';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'PurchaseOrderID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/pdf': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of byte array pdf version of specified Purchase Orders';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves specific purchase order as PDF files using a unique purchase order Id';
        tags: ['Accounting'];
        'x-path': '/PurchaseOrders/{PurchaseOrderID}';
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/PurchaseOrders/{PurchaseOrderNumber}': {
      get: {
        operationId: 'getPurchaseOrderByNumber';
        parameters: [
          {
            description: 'Unique identifier for a PurchaseOrder';
            example: 'PO1234';
            in: 'path';
            name: 'PurchaseOrderNumber';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "53a8c7a5-92e8-475b-a037-acf7c55c3afd", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1553626110950)\\/", "PurchaseOrders": [ { "PurchaseOrderID": "15369a9f-17b6-4235-83c4-0029256d1c37", "PurchaseOrderNumber": "PO-0006", "DateString": "2019-03-26T00:00:00", "Date": "\\/Date(1553558400000+0000)\\/", "DeliveryDateString": "2019-03-28T00:00:00", "DeliveryDate": "\\/Date(1553731200000+0000)\\/", "DeliveryAddress": "101 Grafton Road\\nRoseneath\\nWellington\\n6011\\nNew Zealand", "AttentionTo": "CEO", "Telephone": "64 123-2222", "DeliveryInstructions": "Drop off at front  door", "HasErrors": false, "IsDiscounted": true, "TotalDiscount": 250.00, "SentToContact": false, "Reference": "foobar", "Type": "PURCHASEORDER", "CurrencyRate": 1.000000, "CurrencyCode": "NZD", "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "EmailAddress": "liam@rockstar.com", "BankAccountDetails": "", "Addresses": [ null, { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, null, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1553672800957+0000)\\/", "ContactGroups": [ { "ContactGroupID": "17b44ed7-4389-4162-91cb-3dd5766e4e22", "Name": "Oasis", "Status": "ACTIVE", "Contacts": [], "HasValidationErrors": false } ], "IsSupplier": true, "IsCustomer": true, "DefaultCurrency": "NZD", "SalesTrackingCategories": [], "PurchasesTrackingCategories": [], "ContactPersons": [], "HasValidationErrors": false }, "BrandingThemeID": "414d4a87-46d6-4cfc-ab42-4e29d22e5076", "Status": "DRAFT", "LineAmountTypes": "Exclusive", "LineItems": [ { "ItemCode": "123", "Description": "Brand new Fender Strats", "UnitAmount": 2500.0000, "TaxType": "INPUT2", "TaxAmount": 337.50, "LineAmount": 2250.00, "AccountCode": "630", "Tracking": [ { "Name": "Simpsons", "Option": "Homer", "TrackingCategoryID": "6a68adde-f210-4465-b0a9-0d8cc6f50762", "TrackingOptionID": "94faf12f-f65c-4331-8004-b0b7c5a2da23" } ], "Quantity": 1.0000, "DiscountRate": 10.00, "LineItemID": "8a9d3eca-e052-43bc-9b87-221d0648c045" } ], "SubTotal": 2250.00, "TotalTax": 337.50, "Total": 2587.50, "UpdatedDateUTC": "\\/Date(1553626029823+0000)\\/", "HasAttachments": true, "Attachments": [ { "AttachmentID": "7d94ccdc-ef7b-4806-87ac-8442f25e593b", "FileName": "HelloWorld.png", "Url": "https://api.xero.com/api.xro/2.0/PurchaseOrders/15369a9f-17b6-4235-83c4-0029256d1c37/Attachments/HelloWorld.png", "MimeType": "image/png", "ContentLength": 76091 } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/PurchaseOrders';
                };
              };
            };
            description: 'Success - return response of type PurchaseOrder array for specified PurchaseOrder';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves a specific purchase order using purchase order number';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Quotes': {
      get: {
        operationId: 'getQuotes';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter for quotes after a particular date';
            in: 'query';
            name: 'DateFrom';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
          {
            description: 'Filter for quotes before a particular date';
            in: 'query';
            name: 'DateTo';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
          {
            description: 'Filter for quotes expiring after a particular date';
            in: 'query';
            name: 'ExpiryDateFrom';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
          {
            description: 'Filter for quotes before a particular date';
            in: 'query';
            name: 'ExpiryDateTo';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
          {
            description: 'Filter for quotes belonging to a particular contact';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'query';
            name: 'ContactID';
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Filter for quotes of a particular Status';
            example: 'DRAFT';
            in: 'query';
            name: 'Status';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'e.g. page=1 – Up to 100 Quotes will be returned in a single API call with line items shown for each quote';
            example: 1;
            in: 'query';
            name: 'page';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Order by an any element';
            example: 'Status ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Filter by quote number (e.g. GET https://.../Quotes?QuoteNumber=QU-0001)';
            example: 'QU-0001';
            in: 'query';
            name: 'QuoteNumber';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "bb583e7e-9b6b-471e-88da-4cbfcfad7a57", "Status": "OK", "ProviderName": "Adams OAuth2 App", "DateTimeUTC": "/Date(1571876635477)/", "Quotes": [ { "QuoteID": "be59294f-2a9c-4cee-8c64-0f0ddbc1883a", "QuoteNumber": "QU-0001", "Reference": "REF-123", "Terms": "Not valid after the expiry date", "Contact": { "ContactID": "060816db-0ed7-44de-ab58-8fee9316fcd5", "Name": "Adam" }, "LineItems": [ { "LineItemID": "ccf5e45c-73b6-4659-83e8-520f4c6126fd", "AccountCode": "200", "Description": "Fish out of Water", "UnitAmount": 19.9500, "DiscountRate": 10.00, "LineAmount": 17.96, "ItemCode": "BOOK", "Quantity": 1.0000, "TaxAmount": 2.69, "TaxType": "OUTPUT2", "Tracking": [ { "TrackingCategoryID": "351953c4-8127-4009-88c3-f9cd8c9cbe9f", "TrackingOptionID": "ce205173-7387-4651-9726-2cf4c5405ba2", "Name": "Region", "Option": "Eastside" } ] } ], "Date": "/Date(1571875200000)/", "DateString": "2019-10-24T00:00:00", "ExpiryDate": "/Date(1571961600000)/", "ExpiryDateString": "2019-10-25T00:00:00", "Status": "ACCEPTED", "CurrencyRate": 0.937053, "CurrencyCode": "AUD", "SubTotal": 17.96, "TotalTax": 2.69, "Total": 20.65, "TotalDiscount": 1.99, "Title": "Your Quote", "Summary": "Please buy this", "BrandingThemeID": "4c82c365-35cb-467f-bb11-dce1f2f2f67c", "UpdatedDateUTC": "/Date(1571869373890)/", "LineAmountTypes": "EXCLUSIVE" } ] }';
                schema: {
                  $ref: '#/components/schemas/Quotes';
                };
              };
            };
            description: 'Success - return response of type quotes array with all quotes';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves sales quotes';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateOrCreateQuotes';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Quotes": [ { "Contact": { "ContactID": "00000000-0000-0000-0000-000000000000" }, "LineItems": [ { "Description": "Foobar", "Quantity": 1, "UnitAmount": 20, "AccountCode": "12775" } ], "Date": "2020-02-01" } ] }';
              schema: {
                $ref: '#/components/schemas/Quotes';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{  "SummarizeErrors":false, "Id":"b425754f-0512-481d-827b-c8958db7667e", "Status":"OK", "ProviderName":"provider-name", "DateTimeUTC":"\\/Date(1580607783833)\\/", "Quotes":[  {  "QuoteID":"fd53e0b7-4d24-4c20-be85-043a62ea5847", "QuoteNumber":"QU-0009", "Terms":"", "Contact":{  "ContactID":"6a65f055-b0e0-471a-a933-d1ffdd89393f", "Name":"John Smith-82160", "EmailAddress":"" }, "LineItems":[  {  "LineItemID":"898c7fd6-0d94-4ac0-ace8-87e350a042de", "AccountCode":"12775", "Description":"Foobar", "UnitAmount":20.0000, "LineAmount":20.00, "ItemCode":"", "Quantity":1.0000, "TaxAmount":0.00, "Tracking":[ \n] } ], "Date":"\\/Date(1580515200000)\\/", "DateString":"2020-02-01T00:00:00", "Status":"DRAFT", "CurrencyRate":1.000000, "CurrencyCode":"USD", "SubTotal":20.00, "TotalTax":0.00, "Total":20.00, "UpdatedDateUTC":"\\/Date(1580607783467)\\/", "LineAmountTypes":"EXCLUSIVE", "StatusAttributeString":"OK" } ] }';
                schema: {
                  $ref: '#/components/schemas/Quotes';
                };
              };
            };
            description: 'Success - return response of type Quotes array with updated or created Quote';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Updates or creates one or more quotes';
        tags: ['Accounting'];
        'x-example': [
          {
            dateValue: null;
            default: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            is_date: true;
            java: 'LocalDate.now()';
            java_datatype: 'LocalDate';
            key: 'dateValue';
            keyPascal: 'Date';
            keySnake: 'date_value';
            php: "new DateTime('2019-12-10')";
            python: "dateutil.parser.parse('2020-12-03T00:00:00Z')";
          },
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            contactID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'contactId';
            keyPascal: 'ContactID';
            keySnake: 'contact_id';
            object: 'contact';
          },
          {
            is_object: true;
            key: 'lineItem';
            keyPascal: 'LineItem';
            keySnake: 'line_item';
            lineItem: null;
          },
          {
            default: 'Foobar';
            description: null;
            key: 'description';
            keyPascal: 'Description';
            object: 'lineItem';
          },
          {
            default: 1;
            key: 'quantity';
            keyPascal: 'Quantity';
            nonString: true;
            object: 'lineItem';
            quantity: null;
          },
          {
            default: 20;
            key: 'unitAmount';
            keyPascal: 'UnitAmount';
            keySnake: 'unit_amount';
            nonString: true;
            object: 'lineItem';
            unitAmount: null;
          },
          {
            accountCode: null;
            default: '000';
            is_last: true;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'lineItem';
          },
          {
            is_list: true;
            key: 'lineItems';
            keyPascal: 'LineItem';
            keySnake: 'line_items';
            lineItems: null;
          },
          {
            add_lineitems: null;
            is_last: true;
            is_list_add: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            object: 'lineItem';
            python: 'line_item';
          },
          {
            is_object: true;
            key: 'quote';
            keyPascal: 'Quote';
            quote: null;
          },
          {
            default: 'contact';
            is_variable: true;
            key: 'contact';
            keyPascal: 'Contact';
            nonString: true;
            object: 'quote';
            set_contact: null;
          },
          {
            default: 'lineItems';
            is_variable: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            nonString: true;
            object: 'quote';
            python: 'line_items';
            set_lineitem: null;
          },
          {
            date: null;
            default: 'dateValue';
            is_last: true;
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'quote';
            python: 'date_value';
          },
          {
            is_object: true;
            key: 'quotes';
            keyPascal: 'Quotes';
            quotes: null;
          },
          {
            add_quote: null;
            is_array_add: true;
            is_last: true;
            java: 'Quotes';
            key: 'quotes';
            keyPascal: 'Quotes';
            object: 'quote';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ quotes: [{ contact: { contactID: "00000000-0000-0000-0000-000000000000" }, lineItems: [{ description: "Foobar", quantity: 1.0, unitAmount: 20.0, accountCode: "12775" }], date: "2020-02-01" }]}';
        'x-ruby-requestBody': 'quotes = { quotes: [{ contact: { contact_id: "00000000-0000-0000-0000-000000000000" }, line_items: [{ description: "Foobar", quantity: 1.0, unit_amount: 20.0, account_code: "12775" }], date: "2020-02-01" }]}';
      };
      put: {
        operationId: 'createQuotes';
        parameters: [
          {
            $ref: '#/components/parameters/summarizeErrors';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Quotes": [ { "Contact": { "ContactID": "00000000-0000-0000-0000-000000000000" }, "LineItems": [ { "Description": "Foobar", "Quantity": 1, "UnitAmount": 20, "AccountCode": "12775" } ], "Date": "2020-02-01" } ] }';
              schema: {
                $ref: '#/components/schemas/Quotes';
              };
            };
          };
          description: 'Quotes with an array of Quote object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{  "SummarizeErrors":false, "Id":"29571f5a-bf73-4bb6-9de5-86be44e6bf2e", "Status":"OK", "ProviderName":"provider-name", "DateTimeUTC":"\\/Date(1580607782916)\\/", "Quotes":[  {  "QuoteID":"60031d53-6488-4321-9cbd-c1db6dbf9ba4", "QuoteNumber":"QU-0008", "Terms":"", "Contact":{  "ContactID":"6a65f055-b0e0-471a-a933-d1ffdd89393f", "Name":"John Smith-82160", "EmailAddress":"" }, "LineItems":[  {  "LineItemID":"26995857-0eea-45fb-b46c-f8ea896ec46e", "AccountCode":"12775", "Description":"Foobar", "UnitAmount":20.0000, "LineAmount":20.00, "ItemCode":"", "Quantity":1.0000, "TaxAmount":0.00, "Tracking":[ \n] } ], "Date":"\\/Date(1580515200000)\\/", "DateString":"2020-02-01T00:00:00", "Status":"DRAFT", "CurrencyRate":1.000000, "CurrencyCode":"USD", "SubTotal":20.00, "TotalTax":0.00, "Total":20.00, "UpdatedDateUTC":"\\/Date(1580607782913)\\/", "LineAmountTypes":"EXCLUSIVE", "StatusAttributeString":"OK" } ] }';
                schema: {
                  $ref: '#/components/schemas/Quotes';
                };
              };
            };
            description: 'Success - return response of type Quotes with array with newly created Quote';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Create one or more quotes';
        tags: ['Accounting'];
        'x-example': [
          {
            dateValue: null;
            default: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            is_date: true;
            java: 'LocalDate.now()';
            java_datatype: 'LocalDate';
            key: 'dateValue';
            keyPascal: 'Date';
            keySnake: 'date_value';
            php: "new DateTime('2019-12-10')";
            python: "dateutil.parser.parse('2020-12-03T00:00:00Z')";
          },
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            contactID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'contactId';
            keyPascal: 'ContactID';
            keySnake: 'contact_id';
            object: 'contact';
          },
          {
            is_object: true;
            key: 'lineItem';
            keyPascal: 'LineItem';
            keySnake: 'line_item';
            lineItem: null;
          },
          {
            default: 'Foobar';
            description: null;
            key: 'description';
            keyPascal: 'Description';
            object: 'lineItem';
          },
          {
            default: 1;
            key: 'quantity';
            keyPascal: 'Quantity';
            nonString: true;
            object: 'lineItem';
            quantity: null;
          },
          {
            default: 20;
            key: 'unitAmount';
            keyPascal: 'UnitAmount';
            keySnake: 'unit_amount';
            nonString: true;
            object: 'lineItem';
            unitAmount: null;
          },
          {
            accountCode: null;
            default: '000';
            is_last: true;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'lineItem';
          },
          {
            is_list: true;
            key: 'lineItems';
            keyPascal: 'LineItem';
            keySnake: 'line_items';
            lineItems: null;
          },
          {
            add_lineitems: null;
            is_last: true;
            is_list_add: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            object: 'lineItem';
            python: 'line_item';
          },
          {
            is_object: true;
            key: 'quote';
            keyPascal: 'Quote';
            quote: null;
          },
          {
            default: 'contact';
            is_variable: true;
            key: 'contact';
            keyPascal: 'Contact';
            nonString: true;
            object: 'quote';
            set_contact: null;
          },
          {
            default: 'lineItems';
            is_variable: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            nonString: true;
            object: 'quote';
            python: 'line_items';
            set_lineitem: null;
          },
          {
            date: null;
            default: 'dateValue';
            is_last: true;
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'quote';
            python: 'date_value';
          },
          {
            is_object: true;
            key: 'quotes';
            keyPascal: 'Quotes';
            quotes: null;
          },
          {
            add_quote: null;
            is_array_add: true;
            is_last: true;
            java: 'Quotes';
            key: 'quotes';
            keyPascal: 'Quotes';
            object: 'quote';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ quotes: [{ contact: { contactID: "00000000-0000-0000-0000-000000000000" }, lineItems: [{ description: "Foobar", quantity: 1.0, unitAmount: 20.0, accountCode: "12775" }], date: "2020-02-01" }]}';
        'x-ruby-requestBody': 'quotes = { quotes: [{ contact: { contact_id: "00000000-0000-0000-0000-000000000000" }, line_items: [{ description: "Foobar", quantity: 1.0, unit_amount: 20.0, account_code: "12775" }], date: "2020-02-01" }]}';
      };
    };
    '/Quotes/{QuoteID}': {
      get: {
        operationId: 'getQuote';
        parameters: [
          {
            description: 'Unique identifier for an Quote';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'QuoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{  "SummarizeErrors":true, "Id":"e3626c45-77f1-4ab0-ba9b-3593c7bcd25c", "Status":"OK", "ProviderName":"provider-name", "DateTimeUTC":"\\/Date(1580607864786)\\/", "Quotes":[  {  "QuoteID":"1f90e77a-7b88-4462-874f-1aa675be8fef", "QuoteNumber":"QU-0007", "Reference":"MyQuote", "Terms":"These are my terms", "Contact":{  "ContactID":"4bc3ecb2-8e2a-4267-a171-0e0ce7e5ac2a", "Name":"ABC Limited", "EmailAddress":"john.smith@gmail.com", "FirstName":"John", "LastName":"Smith" }, "LineItems":[  {  "LineItemID":"09b47d9f-f78d-4bab-b226-957f55bfb1b5", "AccountCode":"400", "Description":"Half day training - Microsoft Office", "UnitAmount":500.0000, "LineAmount":500.00, "ItemCode":"Train-MS", "Quantity":1.0000, "TaxAmount":0.00, "TaxType":"NONE", "Tracking":[  {  "TrackingCategoryID":"9bd3f506-6d91-4625-81f0-0f9147f099f4", "TrackingOptionID":"d30e2a0d-ae6f-4806-88ca-d8ebdba2af73", "Name":"Avengers", "Option":"IronMan" } ] } ], "Date":"\\/Date(1580515200000)\\/", "DateString":"2020-02-01T00:00:00", "ExpiryDate":"\\/Date(1581724800000)\\/", "ExpiryDateString":"2020-02-15T00:00:00", "Status":"DRAFT", "CurrencyRate":1.547150, "CurrencyCode":"NZD", "SubTotal":500.00, "TotalTax":0.00, "Total":500.00, "TotalDiscount":0.00, "Title":"", "Summary":"", "BrandingThemeID":"324587a9-7eed-46c0-ad64-fa941a1b5b3e", "UpdatedDateUTC":"\\/Date(1580607757040)\\/", "LineAmountTypes":"EXCLUSIVE" } ] }';
                schema: {
                  $ref: '#/components/schemas/Quotes';
                };
              };
            };
            description: 'Success - return response of type Quotes array with specified Quote';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves a specific quote using a unique quote Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateQuote';
        parameters: [
          {
            description: 'Unique identifier for an Quote';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'QuoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Quotes": [ { "Reference": "I am an update", "Contact": { "ContactID": "00000000-0000-0000-0000-000000000000" }, "Date": "2020-02-01" } ] }';
              schema: {
                $ref: '#/components/schemas/Quotes';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{  "SummarizeErrors":true, "Id":"be4f43a7-ef02-497a-96c2-fc0bc047a82a", "Status":"OK", "ProviderName":"provider-name", "DateTimeUTC":"\\/Date(1580605644385)\\/", "Quotes":[  {  "QuoteID":"8ce6b14c-ef87-4f45-93f0-853137c6d0e1", "QuoteNumber":"QU-0008", "Reference":"I am an update", "Terms":"", "Contact":{  "ContactID":"8ed7dd03-4e6a-4078-a807-c5309abfec52", "Name":"Orlena Greenville 35", "EmailAddress":"" }, "LineItems":[  {  "LineItemID":"be69f44e-9c72-4fcd-9152-0174867cce49", "AccountCode":"12775", "Description":"Foobar", "UnitAmount":20.0000, "LineAmount":20.00, "ItemCode":"", "Quantity":1.0000, "TaxAmount":0.00, "Tracking":[] } ], "Date":"\\/Date(1580515200000)\\/", "DateString":"2020-02-01T00:00:00", "Status":"DRAFT", "CurrencyRate":1.000000, "CurrencyCode":"USD", "SubTotal":20.00, "TotalTax":0.00, "Total":20.00, "UpdatedDateUTC":"\\/Date(1580605644360)\\/", "LineAmountTypes":"EXCLUSIVE" } ] }';
                schema: {
                  $ref: '#/components/schemas/Quotes';
                };
              };
            };
            description: 'Success - return response of type Quotes array with updated Quote';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Updates a specific quote';
        tags: ['Accounting'];
        'x-example': [
          {
            dateValue: null;
            default: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            is_date: true;
            java: 'LocalDate.now()';
            java_datatype: 'LocalDate';
            key: 'dateValue';
            keyPascal: 'Date';
            keySnake: 'date_value';
            php: "new DateTime('2019-12-10')";
            python: "dateutil.parser.parse('2020-12-03T00:00:00Z')";
          },
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            contactID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'contactId';
            keyPascal: 'ContactID';
            keySnake: 'contact_id';
            object: 'contact';
          },
          {
            is_object: true;
            key: 'quote';
            keyPascal: 'Quote';
            quote: null;
          },
          {
            default: 'I am an update';
            key: 'reference';
            keyPascal: 'Reference';
            object: 'quote';
            reference: null;
          },
          {
            default: 'contact';
            is_variable: true;
            key: 'contact';
            keyPascal: 'Contact';
            nonString: true;
            object: 'quote';
            set_contact: null;
          },
          {
            date: null;
            default: 'dateValue';
            is_last: true;
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'quote';
            python: 'date_value';
          },
          {
            is_object: true;
            key: 'quotes';
            keyPascal: 'Quotes';
            quotes: null;
          },
          {
            add_quote: null;
            is_array_add: true;
            is_last: true;
            java: 'Quotes';
            key: 'quotes';
            keyPascal: 'Quotes';
            object: 'quote';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ quotes: [{ reference: "I am an update", contact: { contactID: "00000000-0000-0000-0000-000000000000" }, date: "2020-02-01" }]}';
        'x-ruby-requestBody': 'quotes = { quotes: [{ reference: "I am an update", contact: { contact_id: "00000000-0000-0000-0000-000000000000" }, date: "2020-02-01" }]}';
      };
    };
    '/Quotes/{QuoteID}/Attachments': {
      get: {
        operationId: 'getQuoteAttachments';
        parameters: [
          {
            description: 'Unique identifier for Quote object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'QuoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "439c1573-3cd8-4697-a9f6-81fa651ee8f3", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550852630329)\\/", "Attachments": [ { "AttachmentID": "52a643be-cd5c-489f-9778-53a9fd337756", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/Quotes/da962997-a8bd-4dff-9616-01cdc199283f/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array of Attachment';
            'x-isAttachment': true;
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves attachments for a specific quote';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Quotes/{QuoteID}/Attachments/{AttachmentID}': {
      get: {
        operationId: 'getQuoteAttachmentById';
        parameters: [
          {
            description: 'Unique identifier for Quote object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'QuoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Unique identifier for Attachment object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AttachmentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Quote as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves a specific attachment from a specific quote using a unique attachment Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Quotes/{QuoteID}/Attachments/{FileName}': {
      get: {
        operationId: 'getQuoteAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for Quote object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'QuoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name of the attachment';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Quote as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves a specific attachment from a specific quote by filename';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateQuoteAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for Quote object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'QuoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name of the attachment';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "c8d6413a-1da2-4faa-9848-21f60443e906", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550859714477)\\/", "Attachments": [ { "AttachmentID": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/Quotes/da962997-a8bd-4dff-9616-01cdc199283f/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array of Attachment';
            'x-isAttachment': true;
          };
          '400': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error';
                };
              };
            };
            description: 'Validation Error - some data was incorrect returns response of type Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Updates a specific attachment from a specific quote by filename';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
      put: {
        operationId: 'createQuoteAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for Quote object';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'QuoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Name of the attachment';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "724cdff5-bcd1-4c5c-977e-e864c24258e0", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550856817769)\\/", "Attachments": [ { "AttachmentID": "ab95b276-9dce-4925-9077-439818ba270f", "FileName": "sample5.jpg", "Url": "https://api.xero.com/api.xro/2.0/Quotes/da962997-a8bd-4dff-9616-01cdc199283f/Attachments/sample5.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array of Attachment';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Creates attachment for a specific quote';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
    };
    '/Quotes/{QuoteID}/History': {
      get: {
        operationId: 'getQuoteHistory';
        parameters: [
          {
            description: 'Unique identifier for an Quote';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'QuoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRetrieved';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves history records of a specific quote';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createQuoteHistory';
        parameters: [
          {
            description: 'Unique identifier for an Quote';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'QuoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          $ref: '#/components/requestBodies/historyRecords';
        };
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRecordCreated';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates a history record for a specific quote';
        tags: ['Accounting'];
        'x-example': [
          {
            historyRecord: null;
            is_object: true;
            key: 'historyRecord';
            keyPascal: 'HistoryRecord';
            keySnake: 'history_record';
          },
          {
            Details: null;
            default: 'Hello World';
            is_last: true;
            key: 'details';
            keyPascal: 'Details';
            object: 'historyRecord';
          },
          {
            historyRecords: null;
            is_object: true;
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
          },
          {
            add_historyRecord: null;
            is_array_add: true;
            is_last: true;
            java: 'HistoryRecords';
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
            object: 'historyRecord';
            python: 'history_record';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/Quotes/{QuoteID}/pdf': {
      get: {
        operationId: 'getQuoteAsPdf';
        parameters: [
          {
            description: 'Unique identifier for an Quote';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'QuoteID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/pdf': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of byte array pdf version of specified Quotes';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves a specific quote as a PDF file using a unique quote Id';
        tags: ['Accounting'];
        'x-path': '/Quotes/{QuoteID}';
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Receipts': {
      get: {
        operationId: 'getReceipts';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter by an any element';
            example: 'Status=="DRAFT"';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-java': 'Status==&quot;&apos; + Receipt.StatusEnum.DRAFT + &apos;&quot;';
            'x-example-php': 'Status==&quot;&apos; . \\XeroAPI\\XeroPHP\\Models\\Accounting\\Receipt::STATUS_DRAFT . &apos;&quot;';
            'x-ruby-param': 'Status==#{XeroRuby::Accounting::Receipt::DRAFT}';
          },
          {
            description: 'Order by an any element';
            example: 'ReceiptNumber ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "078b2a2c-902f-4154-8739-357ece5982e5", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552524584695)\\/", "Receipts": [ { "ReceiptID": "a44fd147-af4e-4fe8-a09a-55332df74162", "ReceiptNumber": 1, "Status": "DRAFT", "User": { "UserID": "d1164823-0ac1-41ad-987b-b4e30fe0b273", "FirstName": "API ", "LastName": "Team", "ValidationErrors": [], "Warnings": [] }, "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "Name": "Liam Gallagher", "Addresses": [], "Phones": [], "ContactGroups": [], "SalesTrackingCategories": [], "PurchasesTrackingCategories": [], "ContactPersons": [], "Attachments": [], "HasValidationErrors": false, "ValidationErrors": [], "Warnings": [] }, "Date": "\\/Date(1552435200000+0000)\\/", "UpdatedDateUTC": "\\/Date(1552524583983+0000)\\/", "Reference": "", "LineAmountTypes": "NoTax", "LineItems": [], "SubTotal": 40.00, "TotalTax": 0.00, "Total": 40.00, "ID": "a44fd147-af4e-4fe8-a09a-55332df74162", "HasAttachments": false, "Attachments": [], "ValidationErrors": [], "Warnings": [] } ] }';
                schema: {
                  $ref: '#/components/schemas/Receipts';
                };
              };
            };
            description: 'Success - return response of type Receipts array for all Receipt';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves draft expense claim receipts for any user';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createReceipt';
        parameters: [
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Receipts": [ { "Contact": { "ContactID": "00000000-0000-0000-0000-000000000000" }, "Lineitems": [ { "Description": "Foobar", "Quantity": 2, "UnitAmount": 20, "AccountCode": "400", "TaxType": "NONE", "LineAmount": 40 } ], "User": { "UserID": "00000000-0000-0000-0000-000000000000" }, "LineAmountTypes": "NoTax", "Status": "DRAFT" } ] }';
              schema: {
                $ref: '#/components/schemas/Receipts';
              };
            };
          };
          description: 'Receipts with an array of Receipt object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "35898898-5361-4b42-b6ca-9d2c584fc53d", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552524583429)\\/", "Receipts": [ { "ReceiptID": "a44fd147-af4e-4fe8-a09a-55332df74162", "ReceiptNumber": 1, "Status": "DRAFT", "User": { "UserID": "d1164823-0ac1-41ad-987b-b4e30fe0b273", "EmailAddress": "api@xero.com", "FirstName": "API ", "LastName": "Team", "UpdatedDateUTC": "\\/Date(1511957179217+0000)\\/", "IsSubscriber": true, "OrganisationRole": "FINANCIALADVISER" }, "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "EmailAddress": "liam@rockstar.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "", "AttentionTo": "" }, { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551747281053+0000)\\/", "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "Date": "\\/Date(1552521600000+0000)\\/", "UpdatedDateUTC": "\\/Date(1552524583367+0000)\\/", "Reference": "", "LineAmountTypes": "NoTax", "LineItems": [ { "Description": "Foobar", "UnitAmount": 20.00, "TaxType": "NONE", "TaxAmount": 0.00, "LineAmount": 40.00, "AccountCode": "400", "Tracking": [], "Quantity": 2.0000 } ], "SubTotal": 40.00, "TotalTax": 0.00, "Total": 40.00, "ID": "a44fd147-af4e-4fe8-a09a-55332df74162", "HasAttachments": false, "ValidationErrors": [ { "Message": "A valid user should be identified using the UserID." } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Receipts';
                };
              };
            };
            description: 'Success - return response of type Receipts array for newly created Receipt';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates draft expense claim receipts for any user';
        tags: ['Accounting'];
        'x-example': [
          {
            contact: null;
            is_object: true;
            key: 'contact';
            keyPascal: 'Contact';
          },
          {
            contactID: null;
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'contactId';
            keyPascal: 'ContactID';
            keySnake: 'contact_id';
            object: 'contact';
          },
          {
            is_object: true;
            key: 'user';
            keyPascal: 'User';
            user: null;
          },
          {
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'userID';
            keyPascal: 'UserID';
            keySnake: 'user_id';
            object: 'user';
            userID: null;
          },
          {
            is_object: true;
            key: 'lineItem';
            keyPascal: 'LineItem';
            keySnake: 'line_item';
            lineItem: null;
          },
          {
            default: 'Foobar';
            description: null;
            key: 'description';
            keyPascal: 'Description';
            object: 'lineItem';
          },
          {
            default: 1;
            key: 'quantity';
            keyPascal: 'Quantity';
            nonString: true;
            object: 'lineItem';
            quantity: null;
          },
          {
            default: 20;
            key: 'unitAmount';
            keyPascal: 'UnitAmount';
            keySnake: 'unit_amount';
            nonString: true;
            object: 'lineItem';
            unitAmount: null;
          },
          {
            accountCode: null;
            default: '000';
            is_last: true;
            key: 'accountCode';
            keyPascal: 'AccountCode';
            keySnake: 'account_code';
            object: 'lineItem';
          },
          {
            is_list: true;
            key: 'lineItems';
            keyPascal: 'LineItem';
            keySnake: 'line_items';
            lineItems: null;
          },
          {
            add_lineitems: null;
            is_last: true;
            is_list_add: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            object: 'lineItem';
            python: 'line_item';
          },
          {
            is_object: true;
            key: 'receipt';
            keyPascal: 'Receipt';
            receipt: null;
          },
          {
            default: 'contact';
            is_variable: true;
            key: 'contact';
            keyPascal: 'Contact';
            nonString: true;
            object: 'receipt';
            set_contact: null;
          },
          {
            default: 'user';
            is_variable: true;
            key: 'user';
            keyPascal: 'User';
            nonString: true;
            object: 'receipt';
            set_user: null;
          },
          {
            default: 'lineItems';
            is_variable: true;
            key: 'lineItems';
            keyPascal: 'LineItems';
            keySnake: 'line_items';
            nonString: true;
            object: 'receipt';
            python: 'line_items';
            set_lineitem: null;
          },
          {
            csharp: 'LineAmountTypes.xxx';
            default: 'INCLUSIVE';
            java: 'com.xero.models.accounting.LineAmountTypes.INCLUSIVE';
            key: 'lineAmountTypes';
            keyPascal: 'LineAmountTypes';
            keySnake: 'line_amount_types';
            lineAmountTypes: null;
            node: 'LineAmountTypes.Inclusive';
            nonString: true;
            object: 'receipt';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\LineAmountTypes::INCLUSIVE';
            python: 'LineAmountTypes.INCLUSIVE';
            ruby: 'XeroRuby::Accounting::INCLUSIVE';
          },
          {
            csharp: 'Receipt.xxx';
            default: 'DRAFT';
            is_last: true;
            java: 'com.xero.models.accounting.Receipt.StatusEnum.DRAFT';
            key: 'status';
            keyPascal: 'Status';
            node: 'Receipt.StatusEnum.DRAFT';
            nonString: true;
            object: 'receipt';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\Receipt::STATUS_DRAFT';
            python_string: 'DRAFT';
            ruby: 'XeroRuby::Accounting::Receipt::DRAFT';
            status: null;
          },
          {
            is_object: true;
            key: 'receipts';
            keyPascal: 'Receipts';
            receipts: null;
          },
          {
            add_receipt: null;
            is_array_add: true;
            is_last: true;
            java: 'Receipts';
            key: 'receipts';
            keyPascal: 'Receipts';
            object: 'receipt';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ receipts: [{ contact: { contactID: "00000000-0000-0000-0000-000000000000" }, lineItems: [{ description: "Foobar", quantity: 2.0, unitAmount: 20.0, accountCode: "400", taxType: TaxType.NONE, lineAmount: 40.0 }], user: { userID: "00000000-0000-0000-0000-000000000000" }, lineAmountTypes: LineAmountTypes.Inclusive, status: Receipt.StatusEnum.DRAFT, date: null} ] }';
        'x-ruby-requestBody': 'receipts = { receipts: [ { contact: { contact_id: "00000000-0000-0000-0000-000000000000" }, line_items: [{ description: "Foobar", quantity: 2.0, unit_amount: 20.0, account_code: "400", tax_type: XeroRuby::Accounting::TaxType::NONE, line_amount: 40.0 }], user: { user_id: "00000000-0000-0000-0000-000000000000" }, line_amount_types: XeroRuby::Accounting::INCLUSIVE, status: XeroRuby::Accounting::Receipt::DRAFT, date: nil }]}';
      };
    };
    '/Receipts/{ReceiptID}': {
      get: {
        operationId: 'getReceipt';
        parameters: [
          {
            description: 'Unique identifier for a Receipt';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ReceiptID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "2c99af06-d278-4580-8c8c-463c806af5b6", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1553800357225)\\/", "Receipts": [ { "ReceiptID": "a44fd147-af4e-4fe8-a09a-55332df74162", "ReceiptNumber": 1, "Status": "DRAFT", "User": { "UserID": "d1164823-0ac1-41ad-987b-b4e30fe0b273", "EmailAddress": "api@xero.com", "FirstName": "API ", "LastName": "Team", "UpdatedDateUTC": "\\/Date(1511957179217+0000)\\/", "IsSubscriber": true, "OrganisationRole": "FINANCIALADVISER" }, "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "EmailAddress": "liam@rockstar.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "", "AttentionTo": "" }, { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1553672800957+0000)\\/", "ContactGroups": [], "DefaultCurrency": "NZD", "ContactPersons": [], "HasValidationErrors": false }, "Date": "\\/Date(1552435200000+0000)\\/", "UpdatedDateUTC": "\\/Date(1552524583983+0000)\\/", "Reference": "Foobar", "LineAmountTypes": "NoTax", "LineItems": [ { "Description": "Foobar", "UnitAmount": 20.00, "TaxType": "NONE", "TaxAmount": 0.00, "LineAmount": 40.00, "AccountCode": "400", "Tracking": [], "Quantity": 2.0000, "DiscountEnteredAsPercent": true } ], "SubTotal": 40.00, "TotalTax": 0.00, "Total": 40.00, "ID": "a44fd147-af4e-4fe8-a09a-55332df74162", "HasAttachments": true, "Attachments": [ { "AttachmentID": "e02a84f6-b83a-4983-b3b9-35cd8880c7bc", "FileName": "HelloWorld.jpg", "Url": "https://api.xero.com/api.xro/2.0/receipts/a44fd147-af4e-4fe8-a09a-55332df74162/Attachments/HelloWorld.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 }, { "AttachmentID": "3451e34c-66a6-42b0-91e2-88618bdc169b", "FileName": "foobar.jpg", "Url": "https://api.xero.com/api.xro/2.0/receipts/a44fd147-af4e-4fe8-a09a-55332df74162/Attachments/foobar.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Receipts';
                };
              };
            };
            description: 'Success - return response of type Receipts array for a specified Receipt';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves a specific draft expense claim receipt by using a unique receipt Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateReceipt';
        parameters: [
          {
            description: 'Unique identifier for a Receipt';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ReceiptID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            $ref: '#/components/parameters/unitdp';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Receipts": [ { "Lineitems": [], "User": { "UserID": "00000000-0000-0000-0000-000000000000" }, "Reference": "Foobar" } ] }';
              schema: {
                $ref: '#/components/schemas/Receipts';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "05b76bf7-4734-4633-a399-7d569a6a25c6", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552675557052)\\/", "Receipts": [ { "ReceiptID": "e3686fdc-c661-4581-b9df-cbb20782ea66", "ReceiptNumber": 2, "Status": "DRAFT", "User": { "UserID": "d1164823-0ac1-41ad-987b-b4e30fe0b273", "EmailAddress": "api@xero.com", "FirstName": "API ", "LastName": "Team", "UpdatedDateUTC": "\\/Date(1511957179217+0000)\\/", "IsSubscriber": true, "OrganisationRole": "FINANCIALADVISER" }, "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "ContactStatus": "ACTIVE", "Name": "Liam Gallagher", "FirstName": "Liam", "LastName": "Gallagher", "EmailAddress": "liam@rockstar.com", "BankAccountDetails": "", "Addresses": [ { "AddressType": "STREET", "City": "", "Region": "", "PostalCode": "", "Country": "", "AttentionTo": "" }, { "AddressType": "POBOX", "City": "Anytown", "Region": "NY", "PostalCode": "10101", "Country": "USA", "AttentionTo": "" } ], "Phones": [ { "PhoneType": "DEFAULT", "PhoneNumber": "222-2222", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "DDI", "PhoneNumber": "", "PhoneAreaCode": "", "PhoneCountryCode": "" }, { "PhoneType": "FAX", "PhoneNumber": "333-2233", "PhoneAreaCode": "212", "PhoneCountryCode": "" }, { "PhoneType": "MOBILE", "PhoneNumber": "444-3433", "PhoneAreaCode": "212", "PhoneCountryCode": "" } ], "UpdatedDateUTC": "\\/Date(1551747281053+0000)\\/", "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "Date": "\\/Date(1552694400000+0000)\\/", "UpdatedDateUTC": "\\/Date(1552675556927+0000)\\/", "Reference": "Foobar", "LineAmountTypes": "NoTax", "LineItems": [ { "Description": "Foobar", "UnitAmount": 20.00, "TaxType": "NONE", "TaxAmount": 0.00, "LineAmount": 40.00, "AccountCode": "400", "Tracking": [], "Quantity": 2.0000 } ], "SubTotal": 40.00, "TotalTax": 0.00, "Total": 40.00, "ID": "e3686fdc-c661-4581-b9df-cbb20782ea66", "HasAttachments": false, "ValidationErrors": [] } ] }';
                schema: {
                  $ref: '#/components/schemas/Receipts';
                };
              };
            };
            description: 'Success - return response of type Receipts array for updated Receipt';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Updates a specific draft expense claim receipts';
        tags: ['Accounting'];
        'x-example': [
          {
            dateValue: null;
            default: 'LocalDate.of(2020, Month.OCTOBER, 10)';
            is_date: true;
            java: 'LocalDate.now()';
            java_datatype: 'LocalDate';
            key: 'dateValue';
            keyPascal: 'Date';
            php: "new DateTime('2019-12-10')";
            python: "dateutil.parser.parse('2020-10-10T00:00:00Z')";
          },
          {
            is_object: true;
            key: 'user';
            keyPascal: 'User';
            user: null;
          },
          {
            default: '00000000-0000-0000-0000-000000000000';
            is_last: true;
            is_uuid: true;
            key: 'userID';
            keyPascal: 'UserID';
            keySnake: 'user_id';
            object: 'user';
            userID: null;
          },
          {
            is_object: true;
            key: 'receipt';
            keyPascal: 'Receipt';
            receipt: null;
          },
          {
            default: 'user';
            is_variable: true;
            key: 'user';
            keyPascal: 'User';
            nonString: true;
            object: 'receipt';
            set_user: null;
          },
          {
            default: 'Foobar';
            key: 'reference';
            keyPascal: 'Reference';
            object: 'receipt';
            reference: null;
          },
          {
            date: null;
            default: 'dateValue';
            is_last: true;
            is_variable: true;
            key: 'date';
            keyPascal: 'Date';
            nonString: true;
            object: 'receipt';
          },
          {
            is_object: true;
            key: 'receipts';
            keyPascal: 'Receipts';
            receipts: null;
          },
          {
            add_receipt: null;
            is_array_add: true;
            is_last: true;
            java: 'Receipts';
            key: 'receipts';
            keyPascal: 'Receipts';
            object: 'receipt';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ receipts: [{ user: { userID: "00000000-0000-0000-0000-000000000000" }, reference: "Foobar", date: "2020-01-01", contact: {}, lineItems: [] }]}';
        'x-ruby-requestBody': 'receipts = { receipts: [{ user: { user_id: "00000000-0000-0000-0000-000000000000" }, reference: "Foobar", date: "2020-01-01", contact: {}, line_items: [] }]}';
      };
    };
    '/Receipts/{ReceiptID}/Attachments': {
      get: {
        operationId: 'getReceiptAttachments';
        parameters: [
          {
            description: 'Unique identifier for a Receipt';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ReceiptID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "d379c04d-d3aa-4034-95b8-af69a449bd78", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552686430436)\\/", "Attachments": [ { "AttachmentID": "11e5ca6b-d38c-42ab-a29f-c1710d171aa1", "FileName": "giphy.gif", "Url": "https://api.xero.com/api.xro/2.0/Receipts/7923c00d-163d-404c-a608-af3de333db29/Attachments/giphy.gif", "MimeType": "image/gif", "ContentLength": 495727 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array of Attachments for a specified Receipt';
            'x-isAttachment': true;
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves attachments for a specific expense claim receipt';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Receipts/{ReceiptID}/Attachments/{AttachmentID}': {
      get: {
        operationId: 'getReceiptAttachmentById';
        parameters: [
          {
            description: 'Unique identifier for a Receipt';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ReceiptID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Unique identifier for a Attachment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AttachmentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Receipt as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves a specific attachments from a specific expense claim receipts by using a unique attachment Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Receipts/{ReceiptID}/Attachments/{FileName}': {
      get: {
        operationId: 'getReceiptAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for a Receipt';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ReceiptID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The name of the file being attached to the Receipt';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Receipt as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves a specific attachment from a specific expense claim receipts by file name';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateReceiptAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for a Receipt';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ReceiptID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The name of the file being attached to the Receipt';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "aeca1ea8-8fd9-4757-96a6-397dc4957a69", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552686602761)\\/", "Attachments": [ { "AttachmentID": "e02a84f6-b83a-4983-b3b9-35cd8880c7bc", "FileName": "HelloWorld.jpg", "Url": "https://api.xero.com/api.xro/2.0/Receipts/a44fd147-af4e-4fe8-a09a-55332df74162/Attachments/HelloWorld.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array with updated Attachment for a specified Receipt';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Updates a specific attachment on a specific expense claim receipts by file name';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
      put: {
        operationId: 'createReceiptAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for a Receipt';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ReceiptID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The name of the file being attached to the Receipt';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "01c9a720-b1f1-4477-8de8-ff46d945fd1d", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1552686599884)\\/", "Attachments": [ { "AttachmentID": "3451e34c-66a6-42b0-91e2-88618bdc169b", "FileName": "foobar.jpg", "Url": "https://api.xero.com/api.xro/2.0/Receipts/a44fd147-af4e-4fe8-a09a-55332df74162/Attachments/foobar.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array with newly created Attachment for a specified Receipt';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Creates an attachment on a specific expense claim receipts by file name';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
    };
    '/Receipts/{ReceiptID}/History': {
      get: {
        operationId: 'getReceiptHistory';
        parameters: [
          {
            description: 'Unique identifier for a Receipt';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ReceiptID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRetrieved';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves a history record for a specific receipt';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createReceiptHistory';
        parameters: [
          {
            description: 'Unique identifier for a Receipt';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ReceiptID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          $ref: '#/components/requestBodies/historyRecords';
        };
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRecordCreated';
          };
          '400': {
            content: {
              'application/json': {
                example: '{ "ErrorNumber": 10, "Type": "ValidationException", "Message": "A validation exception occurred", "Elements": [ { "DateUTCString": "2019-03-15T21:51:50", "DateUTC": "\\/Date(1552686710791)\\/", "Details": "Hello World", "ValidationErrors": [ { "Message": "The document with the supplied id was not found for this endpoint." } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Error';
                };
              };
            };
            description: 'Unsupported - return response incorrect exception, API is not able to create HistoryRecord for Receipts';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates a history record for a specific receipt';
        tags: ['Accounting'];
        'x-example': [
          {
            historyRecord: null;
            is_object: true;
            key: 'historyRecord';
            keyPascal: 'HistoryRecord';
            keySnake: 'history_record';
          },
          {
            Details: null;
            default: 'Hello World';
            is_last: true;
            key: 'details';
            keyPascal: 'Details';
            object: 'historyRecord';
          },
          {
            historyRecords: null;
            is_object: true;
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
          },
          {
            add_historyRecord: null;
            is_array_add: true;
            is_last: true;
            java: 'HistoryRecords';
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
            object: 'historyRecord';
            python: 'history_record';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/RepeatingInvoices': {
      get: {
        operationId: 'getRepeatingInvoices';
        parameters: [
          {
            description: 'Filter by an any element';
            example: 'Status=="DRAFT"';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-java': 'Status==&quot;&apos; + RepeatingInvoice.StatusEnum.DRAFT + &apos;&quot;';
            'x-example-php': 'Status==&quot;&apos; . \\XeroAPI\\XeroPHP\\Models\\Accounting\\RepeatingInvoice::STATUS_DRAFT . &apos;&quot;';
            'x-ruby-param': 'Status==#{XeroRuby::Accounting::RepeatingInvoice::DRAFT}';
          },
          {
            description: 'Order by an any element';
            example: 'Total ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "b336833d-a3a8-4a67-ab4c-6280b3ad87b0", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1553805183228)\\/", "RepeatingInvoices": [ { "Schedule": { "Period": 1, "Unit": "MONTHLY", "DueDate": 10, "DueDateType": "OFFOLLOWINGMONTH", "StartDate": "\\/Date(1555286400000+0000)\\/", "EndDate": "\\/Date(1569801600000+0000)\\/", "NextScheduledDate": "\\/Date(1555286400000+0000)\\/" }, "RepeatingInvoiceID": "428c0d75-909f-4b04-8403-a48dc27283b0", "Type": "ACCREC", "Reference": "[Week]", "HasAttachments": true, "ID": "428c0d75-909f-4b04-8403-a48dc27283b0", "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "Name": "Liam Gallagher", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "Status": "AUTHORISED", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "Guitars Fender Strat", "UnitAmount": 5000.00, "TaxType": "OUTPUT2", "TaxAmount": 750.00, "LineAmount": 5000.00, "AccountCode": "200", "Tracking": [], "Quantity": 1.0000, "LineItemID": "13a8353c-d2af-4d5b-920c-438449f08900", "DiscountEnteredAsPercent": true } ], "SubTotal": 5000.00, "TotalTax": 750.00, "Total": 5750.00, "CurrencyCode": "NZD" } ] }';
                schema: {
                  $ref: '#/components/schemas/RepeatingInvoices';
                };
              };
            };
            description: 'Success - return response of type Repeating Invoices array for all Repeating Invoice';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves repeating invoices';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/RepeatingInvoices/{RepeatingInvoiceID}': {
      get: {
        operationId: 'getRepeatingInvoice';
        parameters: [
          {
            description: 'Unique identifier for a Repeating Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'RepeatingInvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "d9ac3755-7b81-4e3a-bef0-fa8a4f171442", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1553805184820)\\/", "RepeatingInvoices": [ { "Schedule": { "Period": 1, "Unit": "MONTHLY", "DueDate": 10, "DueDateType": "OFFOLLOWINGMONTH", "StartDate": "\\/Date(1555286400000+0000)\\/", "EndDate": "\\/Date(1569801600000+0000)\\/", "NextScheduledDate": "\\/Date(1555286400000+0000)\\/" }, "RepeatingInvoiceID": "428c0d75-909f-4b04-8403-a48dc27283b0", "Type": "ACCREC", "Reference": "[Week]", "HasAttachments": true, "Attachments": [ { "AttachmentID": "2a488b0f-3966-4b6e-a7e1-b6d3286351f2", "FileName": "HelloWorld.jpg", "Url": "https://api.xero.com/api.xro/2.0/Invoices/428c0d75-909f-4b04-8403-a48dc27283b0/Attachments/HelloWorld.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 }, { "AttachmentID": "48294e40-bfd2-4027-a365-f034383cb7aa", "FileName": "foobar.jpg", "Url": "https://api.xero.com/api.xro/2.0/Invoices/428c0d75-909f-4b04-8403-a48dc27283b0/Attachments/foobar.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 }, { "AttachmentID": "528e978a-87b8-44c4-9465-9456ec2f7ee6", "FileName": "helo-heros.jpg", "Url": "https://api.xero.com/api.xro/2.0/Invoices/428c0d75-909f-4b04-8403-a48dc27283b0/Attachments/helo-heros.jpg", "MimeType": "image/jpeg", "ContentLength": 2878711 } ], "ID": "428c0d75-909f-4b04-8403-a48dc27283b0", "Contact": { "ContactID": "430fa14a-f945-44d3-9f97-5df5e28441b8", "Name": "Liam Gallagher", "Addresses": [], "Phones": [], "ContactGroups": [], "ContactPersons": [], "HasValidationErrors": false }, "Status": "AUTHORISED", "LineAmountTypes": "Exclusive", "LineItems": [ { "Description": "Guitars Fender Strat", "UnitAmount": 5000.00, "TaxType": "OUTPUT2", "TaxAmount": 750.00, "LineAmount": 5000.00, "AccountCode": "200", "Tracking": [], "Quantity": 1.0000, "LineItemID": "13a8353c-d2af-4d5b-920c-438449f08900", "DiscountEnteredAsPercent": true } ], "SubTotal": 5000.00, "TotalTax": 750.00, "Total": 5750.00, "CurrencyCode": "NZD" } ] }';
                schema: {
                  $ref: '#/components/schemas/RepeatingInvoices';
                };
              };
            };
            description: 'Success - return response of type Repeating Invoices array with a specified Repeating Invoice';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves a specific repeating invoice by using a unique repeating invoice Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/RepeatingInvoices/{RepeatingInvoiceID}/Attachments': {
      get: {
        operationId: 'getRepeatingInvoiceAttachments';
        parameters: [
          {
            description: 'Unique identifier for a Repeating Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'RepeatingInvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "b88b807b-3087-474b-a4f9-d8f1b4f5a899", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1553805762049)\\/", "Attachments": [ { "AttachmentID": "2a488b0f-3966-4b6e-a7e1-b6d3286351f2", "FileName": "HelloWorld.jpg", "Url": "https://api.xero.com/api.xro/2.0/RepeatingInvoices/428c0d75-909f-4b04-8403-a48dc27283b0/Attachments/HelloWorld.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 }, { "AttachmentID": "48294e40-bfd2-4027-a365-f034383cb7aa", "FileName": "foobar.jpg", "Url": "https://api.xero.com/api.xro/2.0/RepeatingInvoices/428c0d75-909f-4b04-8403-a48dc27283b0/Attachments/foobar.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 }, { "AttachmentID": "528e978a-87b8-44c4-9465-9456ec2f7ee6", "FileName": "helo-heros.jpg", "Url": "https://api.xero.com/api.xro/2.0/RepeatingInvoices/428c0d75-909f-4b04-8403-a48dc27283b0/Attachments/helo-heros.jpg", "MimeType": "image/jpeg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array with all Attachments for a specified Repeating Invoice';
            'x-isAttachment': true;
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves attachments from a specific repeating invoice';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/RepeatingInvoices/{RepeatingInvoiceID}/Attachments/{AttachmentID}': {
      get: {
        operationId: 'getRepeatingInvoiceAttachmentById';
        parameters: [
          {
            description: 'Unique identifier for a Repeating Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'RepeatingInvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Unique identifier for a Attachment';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'AttachmentID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Repeating Invoice as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves a specific attachment from a specific repeating invoice';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/RepeatingInvoices/{RepeatingInvoiceID}/Attachments/{FileName}': {
      get: {
        operationId: 'getRepeatingInvoiceAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for a Repeating Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'RepeatingInvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The name of the file being attached to a Repeating Invoice';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf';
            example: 'image/jpg';
            in: 'header';
            name: 'contentType';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/octet-stream': {
                schema: {
                  format: 'binary';
                  type: 'string';
                };
              };
            };
            description: 'Success - return response of attachment for Repeating Invoice as binary data';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments.read'];
          },
        ];
        summary: 'Retrieves a specific attachment from a specific repeating invoices by file name';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateRepeatingInvoiceAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for a Repeating Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'RepeatingInvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The name of the file being attached to a Repeating Invoice';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "61b24d5c-4d6e-468f-9de1-abbc234b239a", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1553805873362)\\/", "Attachments": [ { "AttachmentID": "d086d5f4-9c3d-4edc-a87e-906248eeb652", "FileName": "HelloWorld.jpg", "Url": "https://api.xero.com/api.xro/2.0/RepeatingInvoices/428c0d75-909f-4b04-8403-a48dc27283b0/Attachments/HelloWorld.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array with specified Attachment for a specified Repeating Invoice';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Updates a specific attachment from a specific repeating invoices by file name';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
      put: {
        operationId: 'createRepeatingInvoiceAttachmentByFileName';
        parameters: [
          {
            description: 'Unique identifier for a Repeating Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'RepeatingInvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The name of the file being attached to a Repeating Invoice';
            example: 'xero-dev.jpg';
            in: 'path';
            name: 'FileName';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: {
                format: 'byte';
                type: 'string';
              };
            };
          };
          description: 'Byte array of file in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "219de8c0-ee70-48af-a000-594eba14b417", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1553805866696)\\/", "Attachments": [ { "AttachmentID": "e078e56c-9a2b-4f6c-a1fa-5d19b0dab611", "FileName": "foobar.jpg", "Url": "https://api.xero.com/api.xro/2.0/RepeatingInvoices/428c0d75-909f-4b04-8403-a48dc27283b0/Attachments/foobar.jpg", "MimeType": "image/jpg", "ContentLength": 2878711 } ] }';
                schema: {
                  $ref: '#/components/schemas/Attachments';
                };
              };
            };
            description: 'Success - return response of type Attachments array with updated Attachment for a specified Repeating Invoice';
            'x-isAttachment': true;
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.attachments'];
          },
        ];
        summary: 'Creates an attachment from a specific repeating invoices by file name';
        tags: ['Accounting'];
        'x-hasAccountingValidationError': true;
      };
    };
    '/RepeatingInvoices/{RepeatingInvoiceID}/History': {
      get: {
        operationId: 'getRepeatingInvoiceHistory';
        parameters: [
          {
            description: 'Unique identifier for a Repeating Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'RepeatingInvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRetrieved';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions.read'];
          },
        ];
        summary: 'Retrieves history record for a specific repeating invoice';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createRepeatingInvoiceHistory';
        parameters: [
          {
            description: 'Unique identifier for a Repeating Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'RepeatingInvoiceID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          $ref: '#/components/requestBodies/historyRecords';
        };
        responses: {
          '200': {
            $ref: '#/components/responses/HistoryRecordCreated';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.transactions'];
          },
        ];
        summary: 'Creates a  history record for a specific repeating invoice';
        tags: ['Accounting'];
        'x-example': [
          {
            historyRecord: null;
            is_object: true;
            key: 'historyRecord';
            keyPascal: 'HistoryRecord';
            keySnake: 'history_record';
          },
          {
            Details: null;
            default: 'Hello World';
            is_last: true;
            key: 'details';
            keyPascal: 'Details';
            object: 'historyRecord';
          },
          {
            historyRecords: null;
            is_object: true;
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
          },
          {
            add_historyRecord: null;
            is_array_add: true;
            is_last: true;
            java: 'HistoryRecords';
            key: 'historyRecords';
            keyPascal: 'HistoryRecords';
            keySnake: 'history_records';
            object: 'historyRecord';
            python: 'history_record';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/Reports': {
      get: {
        operationId: 'getReportBASorGSTList';
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ReportWithRows';
                };
              };
            };
            description: 'Success - return response of type ReportWithRows';
          };
        };
        security: [
          {
            OAuth2: ['accounting.reports.read'];
          },
        ];
        summary: 'Retrieves report for BAS (only valid for AU orgs)';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Reports/AgedPayablesByContact': {
      get: {
        operationId: 'getReportAgedPayablesByContact';
        parameters: [
          {
            description: 'Unique identifier for a Contact';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'query';
            name: 'contactId';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The date of the Aged Payables By Contact report';
            in: 'query';
            name: 'date';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
          {
            description: 'The from date of the Aged Payables By Contact report';
            in: 'query';
            name: 'fromDate';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
          {
            description: 'The to date of the Aged Payables By Contact report';
            in: 'query';
            name: 'toDate';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "5a33f9d4-44a6-4467-a812-4f025506ee35", "Status": "OK", "ProviderName": "Java Public Example", "DateTimeUTC": "\\/Date(1555971088085)\\/", "Reports": [ { "ReportID": "AgedPayablesByContact", "ReportName": "Aged Payables By Contact", "ReportType": "AgedPayablesByContact", "ReportTitles": [ "Invoices", "ABC", "From 10 October 2017 to 22 April 2019", "Showing payments to 22 April 2019" ], "ReportDate": "22 April 2019", "UpdatedDateUTC": "\\/Date(1555971088085)\\/", "Fields": [], "Rows": [ { "RowType": "Header", "Cells": [ { "Value": "Date" }, { "Value": "Reference" }, { "Value": "Due Date" }, { "Value": "" }, { "Value": "Total" }, { "Value": "Paid" }, { "Value": "Credited" }, { "Value": "Due" } ] }, { "RowType": "Section", "Title": "", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "2017-10-10T00:00:00" }, { "Value": "Opening Balance" }, { "Value": "" }, { "Value": "" }, { "Value": "" }, { "Value": "" }, { "Value": "" }, { "Value": "0.00" } ] } ] }, { "RowType": "Section", "Title": "", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "2018-10-09T00:00:00", "Attributes": [ { "Value": "1f3960ae-0537-4438-a4dd-76d785e6d7d8", "Id": "invoiceID" } ] }, { "Value": "", "Attributes": [ { "Value": "1f3960ae-0537-4438-a4dd-76d785e6d7d8", "Id": "invoiceID" } ] }, { "Value": "2018-10-23T00:00:00", "Attributes": [ { "Value": "1f3960ae-0537-4438-a4dd-76d785e6d7d8", "Id": "invoiceID" } ] }, { "Value": "181 days overdue", "Attributes": [ { "Value": "1f3960ae-0537-4438-a4dd-76d785e6d7d8", "Id": "invoiceID" } ] }, { "Value": "250.00", "Attributes": [ { "Value": "1f3960ae-0537-4438-a4dd-76d785e6d7d8", "Id": "invoiceID" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "1f3960ae-0537-4438-a4dd-76d785e6d7d8", "Id": "invoiceID" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "1f3960ae-0537-4438-a4dd-76d785e6d7d8", "Id": "invoiceID" } ] }, { "Value": "250.00", "Attributes": [ { "Value": "1f3960ae-0537-4438-a4dd-76d785e6d7d8", "Id": "invoiceID" } ] } ] }, { "RowType": "SummaryRow", "Cells": [ { "Value": "Total" }, { "Value": "" }, { "Value": "" }, { "Value": "" }, { "Value": "250.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "250.00" } ] } ] }, { "RowType": "Section", "Title": "", "Rows": [ { "RowType": "SummaryRow", "Cells": [ { "Value": "Closing Balance" }, { "Value": "" }, { "Value": "" }, { "Value": "" }, { "Value": "250.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "250.00" } ] } ] } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/ReportWithRows';
                };
              };
            };
            description: 'Success - return response of type ReportWithRows';
          };
        };
        security: [
          {
            OAuth2: ['accounting.reports.read'];
          },
        ];
        summary: 'Retrieves report for aged payables by contact';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Reports/AgedReceivablesByContact': {
      get: {
        operationId: 'getReportAgedReceivablesByContact';
        parameters: [
          {
            description: 'Unique identifier for a Contact';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'query';
            name: 'contactId';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'The date of the Aged Receivables By Contact report';
            in: 'query';
            name: 'date';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
          {
            description: 'The from date of the Aged Receivables By Contact report';
            in: 'query';
            name: 'fromDate';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
          {
            description: 'The to date of the Aged Receivables By Contact report';
            in: 'query';
            name: 'toDate';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "b977b607-955d-47cb-92fd-7c29b3dd755c", "Status": "OK", "ProviderName": "Java Public Example", "DateTimeUTC": "\\/Date(1556032862815)\\/", "Reports": [ { "ReportID": "AgedReceivablesByContact", "ReportName": "Aged Receivables By Contact", "ReportType": "AgedReceivablesByContact", "ReportTitles": [ "Invoices", "ABC", "From 10 October 2017 to 23 April 2019", "Showing payments to 23 April 2019" ], "ReportDate": "23 April 2019", "UpdatedDateUTC": "\\/Date(1556032862815)\\/", "Fields": [], "Rows": [ { "RowType": "Header", "Cells": [ { "Value": "Date" }, { "Value": "Number" }, { "Value": "Due Date" }, { "Value": "" }, { "Value": "Total" }, { "Value": "Paid" }, { "Value": "Credited" }, { "Value": "Due" } ] }, { "RowType": "Section", "Title": "", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "2017-10-10T00:00:00" }, { "Value": "Opening Balance" }, { "Value": "" }, { "Value": "" }, { "Value": "" }, { "Value": "" }, { "Value": "" }, { "Value": "0.00" } ] } ] }, { "RowType": "Section", "Title": "", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "2018-05-13T00:00:00", "Attributes": [ { "Value": "40ebad47-24e2-4dc9-a5f5-579df427671b", "Id": "invoiceID" } ] }, { "Value": "IV1242016", "Attributes": [ { "Value": "40ebad47-24e2-4dc9-a5f5-579df427671b", "Id": "invoiceID" } ] }, { "Value": "2018-06-22T00:00:00", "Attributes": [ { "Value": "40ebad47-24e2-4dc9-a5f5-579df427671b", "Id": "invoiceID" } ] }, { "Value": "305 days overdue", "Attributes": [ { "Value": "40ebad47-24e2-4dc9-a5f5-579df427671b", "Id": "invoiceID" } ] }, { "Value": "100.00", "Attributes": [ { "Value": "40ebad47-24e2-4dc9-a5f5-579df427671b", "Id": "invoiceID" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "40ebad47-24e2-4dc9-a5f5-579df427671b", "Id": "invoiceID" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "40ebad47-24e2-4dc9-a5f5-579df427671b", "Id": "invoiceID" } ] }, { "Value": "100.00", "Attributes": [ { "Value": "40ebad47-24e2-4dc9-a5f5-579df427671b", "Id": "invoiceID" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "2019-04-23T00:00:00", "Attributes": [ { "Value": "ca0483ce-fa43-4335-8512-751e655337b8", "Id": "invoiceID" } ] }, { "Value": "INV-0086", "Attributes": [ { "Value": "ca0483ce-fa43-4335-8512-751e655337b8", "Id": "invoiceID" } ] }, { "Value": "2019-05-07T00:00:00", "Attributes": [ { "Value": "ca0483ce-fa43-4335-8512-751e655337b8", "Id": "invoiceID" } ] }, { "Value": "", "Attributes": [ { "Value": "ca0483ce-fa43-4335-8512-751e655337b8", "Id": "invoiceID" } ] }, { "Value": "50.00", "Attributes": [ { "Value": "ca0483ce-fa43-4335-8512-751e655337b8", "Id": "invoiceID" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "ca0483ce-fa43-4335-8512-751e655337b8", "Id": "invoiceID" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "ca0483ce-fa43-4335-8512-751e655337b8", "Id": "invoiceID" } ] }, { "Value": "50.00", "Attributes": [ { "Value": "ca0483ce-fa43-4335-8512-751e655337b8", "Id": "invoiceID" } ] } ] }, { "RowType": "SummaryRow", "Cells": [ { "Value": "Total" }, { "Value": "" }, { "Value": "" }, { "Value": "" }, { "Value": "150.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "150.00" } ] } ] }, { "RowType": "Section", "Title": "", "Rows": [ { "RowType": "SummaryRow", "Cells": [ { "Value": "Closing Balance" }, { "Value": "" }, { "Value": "" }, { "Value": "" }, { "Value": "150.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "150.00" } ] } ] } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/ReportWithRows';
                };
              };
            };
            description: 'Success - return response of type ReportWithRows';
          };
        };
        security: [
          {
            OAuth2: ['accounting.reports.read'];
          },
        ];
        summary: 'Retrieves report for aged receivables by contact';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Reports/BalanceSheet': {
      get: {
        operationId: 'getReportBalanceSheet';
        parameters: [
          {
            description: 'The date of the Balance Sheet report';
            example: '2019-11-01';
            in: 'query';
            name: 'date';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
          {
            description: 'The number of periods for the Balance Sheet report';
            example: 3;
            in: 'query';
            name: 'periods';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'The period size to compare to (MONTH, QUARTER, YEAR)';
            example: 'MONTH';
            in: 'query';
            name: 'timeframe';
            schema: {
              enum: ['MONTH', 'QUARTER', 'YEAR'];
              type: 'string';
            };
          },
          {
            description: 'The tracking option 1 for the Balance Sheet report';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'query';
            name: 'trackingOptionID1';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The tracking option 2 for the Balance Sheet report';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'query';
            name: 'trackingOptionID2';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The standard layout boolean for the Balance Sheet report';
            example: true;
            in: 'query';
            name: 'standardLayout';
            schema: {
              type: 'boolean';
            };
          },
          {
            description: 'return a cash basis for the Balance Sheet report';
            example: false;
            in: 'query';
            name: 'paymentsOnly';
            schema: {
              type: 'boolean';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "2ddba304-6ed3-4da4-b185-3b6289699653", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1555099412778)\\/", "Reports": [ { "ReportID": "BalanceSheet", "ReportName": "Balance Sheet", "ReportType": "BalanceSheet", "ReportTitles": [ "Balance Sheet", "Dev Evangelist - Sid Test 3 (NZ-2016-02)", "As at 30 April 2019" ], "ReportDate": "12 April 2019", "UpdatedDateUTC": "\\/Date(1555099412778)\\/", "Fields": [], "Rows": [ { "RowType": "Header", "Cells": [ { "Value": "" }, { "Value": "30 Apr 2019" }, { "Value": "31 Mar 2019" }, { "Value": "28 Feb 2019" } ] }, { "RowType": "Section", "Title": "Assets", "Rows": [] }, { "RowType": "Section", "Title": "Bank", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Country Savings", "Attributes": [ { "Value": "041207d2-3d61-4e5d-8c1a-b9236955a71c", "Id": "account" } ] }, { "Value": "-1850.00", "Attributes": [ { "Value": "041207d2-3d61-4e5d-8c1a-b9236955a71c", "Id": "account" } ] }, { "Value": "-1850.00", "Attributes": [ { "Value": "041207d2-3d61-4e5d-8c1a-b9236955a71c", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "041207d2-3d61-4e5d-8c1a-b9236955a71c", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "My Big Bank", "Attributes": [ { "Value": "300f3bde-3a5c-4035-9ec5-45b09777679a", "Id": "account" } ] }, { "Value": "2146.37", "Attributes": [ { "Value": "300f3bde-3a5c-4035-9ec5-45b09777679a", "Id": "account" } ] }, { "Value": "2020.00", "Attributes": [ { "Value": "300f3bde-3a5c-4035-9ec5-45b09777679a", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "300f3bde-3a5c-4035-9ec5-45b09777679a", "Id": "account" } ] } ] }, { "RowType": "SummaryRow", "Cells": [ { "Value": "Total Bank" }, { "Value": "296.37" }, { "Value": "170.00" }, { "Value": "0.00" } ] } ] }, { "RowType": "Section", "Title": "Current Assets", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Accounts Receivable", "Attributes": [ { "Value": "b94495d0-44ab-4199-a1d0-427a4877e100", "Id": "account" } ] }, { "Value": "154355.72", "Attributes": [ { "Value": "b94495d0-44ab-4199-a1d0-427a4877e100", "Id": "account" } ] }, { "Value": "154351.78", "Attributes": [ { "Value": "b94495d0-44ab-4199-a1d0-427a4877e100", "Id": "account" } ] }, { "Value": "356.50", "Attributes": [ { "Value": "b94495d0-44ab-4199-a1d0-427a4877e100", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "Inventory", "Attributes": [ { "Value": "53a12a15-7e9b-4a31-85f4-a7cee6d04215", "Id": "account" } ] }, { "Value": "25000.00", "Attributes": [ { "Value": "53a12a15-7e9b-4a31-85f4-a7cee6d04215", "Id": "account" } ] }, { "Value": "25000.00", "Attributes": [ { "Value": "53a12a15-7e9b-4a31-85f4-a7cee6d04215", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "53a12a15-7e9b-4a31-85f4-a7cee6d04215", "Id": "account" } ] } ] }, { "RowType": "SummaryRow", "Cells": [ { "Value": "Total Current Assets" }, { "Value": "179355.72" }, { "Value": "179351.78" }, { "Value": "356.50" } ] } ] }, { "RowType": "Section", "Title": "Fixed Assets", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Office Equipment", "Attributes": [ { "Value": "7132cab3-ce56-4389-8e47-8f60d4c137f8", "Id": "account" } ] }, { "Value": "-119.00", "Attributes": [ { "Value": "7132cab3-ce56-4389-8e47-8f60d4c137f8", "Id": "account" } ] }, { "Value": "-119.00", "Attributes": [ { "Value": "7132cab3-ce56-4389-8e47-8f60d4c137f8", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "7132cab3-ce56-4389-8e47-8f60d4c137f8", "Id": "account" } ] } ] }, { "RowType": "SummaryRow", "Cells": [ { "Value": "Total Fixed Assets" }, { "Value": "-119.00" }, { "Value": "-119.00" }, { "Value": "0.00" } ] } ] }, { "RowType": "Section", "Title": "", "Rows": [ { "RowType": "SummaryRow", "Cells": [ { "Value": "Total Assets" }, { "Value": "179533.09" }, { "Value": "179402.78" }, { "Value": "356.50" } ] } ] }, { "RowType": "Section", "Title": "Liabilities", "Rows": [] }, { "RowType": "Section", "Title": "Current Liabilities", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Accounts Payable", "Attributes": [ { "Value": "a2a4795b-a01f-40eb-afa6-a34b4514875d", "Id": "account" } ] }, { "Value": "-3469.00", "Attributes": [ { "Value": "a2a4795b-a01f-40eb-afa6-a34b4514875d", "Id": "account" } ] }, { "Value": "-3469.00", "Attributes": [ { "Value": "a2a4795b-a01f-40eb-afa6-a34b4514875d", "Id": "account" } ] }, { "Value": "-184.00", "Attributes": [ { "Value": "a2a4795b-a01f-40eb-afa6-a34b4514875d", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "GST", "Attributes": [ { "Value": "17d9a4a0-3181-4803-a96b-f0dbe589091b", "Id": "account" } ] }, { "Value": "-2446.21", "Attributes": [ { "Value": "17d9a4a0-3181-4803-a96b-f0dbe589091b", "Id": "account" } ] }, { "Value": "-2461.89", "Attributes": [ { "Value": "17d9a4a0-3181-4803-a96b-f0dbe589091b", "Id": "account" } ] }, { "Value": "76.50", "Attributes": [ { "Value": "17d9a4a0-3181-4803-a96b-f0dbe589091b", "Id": "account" } ] } ] }, { "RowType": "SummaryRow", "Cells": [ { "Value": "Total Current Liabilities" }, { "Value": "-5915.21" }, { "Value": "-5930.89" }, { "Value": "-107.50" } ] } ] }, { "RowType": "Section", "Title": "", "Rows": [ { "RowType": "SummaryRow", "Cells": [ { "Value": "Total Liabilities" }, { "Value": "-5915.21" }, { "Value": "-5930.89" }, { "Value": "-107.50" } ] } ] }, { "RowType": "Section", "Title": "", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Net Assets" }, { "Value": "185448.30" }, { "Value": "185333.67" }, { "Value": "464.00" } ] } ] }, { "RowType": "Section", "Title": "Equity", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Current Year Earnings", "Attributes": [ { "Value": "00000000-0000-0000-0000-000000000000", "Id": "account" } ] }, { "Value": "114.62", "Attributes": [ { "Value": "00000000-0000-0000-0000-000000000000", "Id": "account" }, { "Value": "4/1/2019", "Id": "fromDate" }, { "Value": "4/30/2019", "Id": "toDate" } ] }, { "Value": "156621.67", "Attributes": [ { "Value": "00000000-0000-0000-0000-000000000000", "Id": "account" }, { "Value": "4/1/2018", "Id": "fromDate" }, { "Value": "3/31/2019", "Id": "toDate" } ] }, { "Value": "500.00", "Attributes": [ { "Value": "00000000-0000-0000-0000-000000000000", "Id": "account" }, { "Value": "4/1/2018", "Id": "fromDate" }, { "Value": "2/28/2019", "Id": "toDate" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "Owner A Drawings", "Attributes": [ { "Value": "136ebd08-60ea-4592-8982-be92c153b53a", "Id": "account" } ] }, { "Value": "28752.00", "Attributes": [ { "Value": "136ebd08-60ea-4592-8982-be92c153b53a", "Id": "account" } ] }, { "Value": "28752.00", "Attributes": [ { "Value": "136ebd08-60ea-4592-8982-be92c153b53a", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "136ebd08-60ea-4592-8982-be92c153b53a", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "Owner A Funds Introduced", "Attributes": [ { "Value": "5690f1e8-1d02-4893-90c2-ee1a69eff942", "Id": "account" } ] }, { "Value": "-50.00", "Attributes": [ { "Value": "5690f1e8-1d02-4893-90c2-ee1a69eff942", "Id": "account" } ] }, { "Value": "-50.00", "Attributes": [ { "Value": "5690f1e8-1d02-4893-90c2-ee1a69eff942", "Id": "account" } ] }, { "Value": "-46.00", "Attributes": [ { "Value": "5690f1e8-1d02-4893-90c2-ee1a69eff942", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "Retained Earnings", "Attributes": [ { "Value": "7fc16c06-c342-4f32-995f-889b5f9996fd", "Id": "account" } ] }, { "Value": "156631.67", "Attributes": [ { "Value": "7fc16c06-c342-4f32-995f-889b5f9996fd", "Id": "account" }, { "Value": "", "Id": "fromDate" }, { "Value": "4/30/2019", "Id": "toDate" } ] }, { "Value": "10.00", "Attributes": [ { "Value": "7fc16c06-c342-4f32-995f-889b5f9996fd", "Id": "account" }, { "Value": "", "Id": "fromDate" }, { "Value": "3/31/2019", "Id": "toDate" } ] }, { "Value": "10.00", "Attributes": [ { "Value": "7fc16c06-c342-4f32-995f-889b5f9996fd", "Id": "account" }, { "Value": "", "Id": "fromDate" }, { "Value": "2/28/2019", "Id": "toDate" } ] } ] }, { "RowType": "SummaryRow", "Cells": [ { "Value": "Total Equity" }, { "Value": "185448.29" }, { "Value": "185333.67" }, { "Value": "464.00" } ] } ] } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/ReportWithRows';
                };
              };
            };
            description: 'Success - return response of type ReportWithRows';
          };
        };
        security: [
          {
            OAuth2: ['accounting.reports.read'];
          },
        ];
        summary: 'Retrieves report for balancesheet';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Reports/BankSummary': {
      get: {
        operationId: 'getReportBankSummary';
        parameters: [
          {
            description: 'The from date for the Bank Summary report e.g. 2018-03-31';
            example: '2019-11-01';
            in: 'query';
            name: 'fromDate';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
          {
            description: 'The to date for the Bank Summary report e.g. 2018-03-31';
            example: '2019-11-30';
            in: 'query';
            name: 'toDate';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "ae58d0ec-9c5c-455f-b96e-690107579257", "Status": "OK", "ProviderName": "Java Public Example", "DateTimeUTC": "\\/Date(1556035526223)\\/", "Reports": [ { "ReportID": "BankSummary", "ReportName": "Bank Summary", "ReportType": "BankSummary", "ReportTitles": [ "Bank Summary", "MindBody Test 10 (AU-2016-02)", "From 1 April 2019 to 30 April 2019" ], "ReportDate": "23 April 2019", "UpdatedDateUTC": "\\/Date(1556035526223)\\/", "Fields": [], "Rows": [ { "RowType": "Header", "Cells": [ { "Value": "Bank Accounts" }, { "Value": "Opening Balance" }, { "Value": "Cash Received" }, { "Value": "Cash Spent" }, { "Value": "Closing Balance" } ] }, { "RowType": "Section", "Title": "", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Big City Bank", "Attributes": [ { "Value": "03f9cf1e-2deb-4bf1-b0a8-b57f08672eb8", "Id": "accountID" } ] }, { "Value": "0.00" }, { "Value": "110.00", "Attributes": [ { "Value": "03f9cf1e-2deb-4bf1-b0a8-b57f08672eb8", "Id": "account" } ] }, { "Value": "100.00", "Attributes": [ { "Value": "03f9cf1e-2deb-4bf1-b0a8-b57f08672eb8", "Id": "account" } ] }, { "Value": "10.00" } ] }, { "RowType": "SummaryRow", "Cells": [ { "Value": "Total" }, { "Value": "0.00" }, { "Value": "110.00" }, { "Value": "100.00" }, { "Value": "10.00" } ] } ] } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/ReportWithRows';
                };
              };
            };
            description: 'Success - return response of type ReportWithRows';
          };
        };
        security: [
          {
            OAuth2: ['accounting.reports.read'];
          },
        ];
        summary: 'Retrieves report for bank summary';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Reports/BudgetSummary': {
      get: {
        operationId: 'getReportBudgetSummary';
        parameters: [
          {
            description: 'The date for the Bank Summary report e.g. 2018-03-31';
            example: '2019-03-31';
            in: 'query';
            name: 'date';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
          {
            description: 'The number of periods to compare (integer between 1 and 12)';
            example: 2;
            in: 'query';
            name: 'period';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'The period size to compare to (1=month, 3=quarter, 12=year)';
            example: 3;
            in: 'query';
            name: 'timeframe';
            schema: {
              type: 'integer';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "9f1e2722-0d98-4669-890f-f8f4217c968b", "Status": "OK", "ProviderName": "provider-name", "DateTimeUTC": "\\/Date(1573755037865)\\/", "Reports": [ { "ReportID": "BudgetSummary", "ReportName": "Budget Summary", "ReportType": "BudgetSummary", "ReportTitles": [ "Overall Budget", "Budget Summary", "Online Test 11", "November 2019 to October 2022" ], "ReportDate": "14 November 2019", "UpdatedDateUTC": "\\/Date(1573755037865)\\/", "Fields": [], "Rows": [ { "RowType": "Header", "Cells": [ { "Value": "Account" }, { "Value": "Jan-20" }, { "Value": "Apr-20" }, { "Value": "Jul-20" }, { "Value": "Oct-20" }, { "Value": "Jan-21" }, { "Value": "Apr-21" }, { "Value": "Jul-21" }, { "Value": "Oct-21" }, { "Value": "Jan-22" }, { "Value": "Apr-22" }, { "Value": "Jul-22" }, { "Value": "Oct-22" } ] }, { "RowType": "Section", "Title": "", "Rows": [ { "RowType": "SummaryRow", "Cells": [ { "Value": "Gross Profit" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" } ] } ] }, { "RowType": "Section", "Title": "", "Rows": [ { "RowType": "SummaryRow", "Cells": [ { "Value": "Total Expenses" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" } ] } ] }, { "RowType": "Section", "Title": "", "Rows": [ { "RowType": "SummaryRow", "Cells": [ { "Value": "Net Profit" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.00" } ] } ] } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/ReportWithRows';
                };
              };
            };
            description: 'success- return a Report with Rows object';
          };
        };
        security: [
          {
            OAuth2: ['accounting.reports.read'];
          },
        ];
        summary: 'Retrieves report for budget summary';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Reports/ExecutiveSummary': {
      get: {
        operationId: 'getReportExecutiveSummary';
        parameters: [
          {
            description: 'The date for the Bank Summary report e.g. 2018-03-31';
            example: '2019-03-31';
            in: 'query';
            name: 'date';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "068d3505-ac37-43f3-8135-f912a5963d8a", "Status": "OK", "ProviderName": "provider-name", "DateTimeUTC": "/Date(1573755038314)/", "Reports": [ { "ReportID": "ExecutiveSummary", "ReportName": "Executive Summary", "ReportType": "ExecutiveSummary", "ReportTitles": [ "Executive Summary", "Online Test 11", "For the month of November 2019" ], "ReportDate": "14 November 2019", "UpdatedDateUTC": "/Date(1573755038314)/", "Fields": [], "Rows": [ { "RowType": "Header", "Cells": [ { "Value": "" }, { "Value": "Nov 2019" }, { "Value": "Oct 2019" }, { "Value": "Variance" } ] }, { "RowType": "Section", "Title": "Cash", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Cash received" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.0%" } ] }, { "RowType": "Row", "Cells": [ { "Value": "Cash spent" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.0%" } ] }, { "RowType": "Row", "Cells": [ { "Value": "Cash surplus (deficit)" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.0%" } ] }, { "RowType": "Row", "Cells": [ { "Value": "Closing bank balance" }, { "Value": "79.01" }, { "Value": "79.01" }, { "Value": "0.0%" } ] } ] }, { "RowType": "Section", "Title": "Profitability", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Income" }, { "Value": "40.00" }, { "Value": "0.00" }, { "Value": "0.0%" } ] }, { "RowType": "Row", "Cells": [ { "Value": "Direct costs" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.0%" } ] }, { "RowType": "Row", "Cells": [ { "Value": "Gross profit (loss)" }, { "Value": "40.00" }, { "Value": "0.00" }, { "Value": "0.0%" } ] }, { "RowType": "Row", "Cells": [ { "Value": "Other Income" }, { "Value": "0.00" }, { "Value": "0.00" }, { "Value": "0.0%" } ] }, { "RowType": "Row", "Cells": [ { "Value": "Expenses" }, { "Value": "205.40" }, { "Value": "0.00" }, { "Value": "0.0%" } ] }, { "RowType": "Row", "Cells": [ { "Value": "Profit (loss)" }, { "Value": "-165.40" }, { "Value": "0.00" }, { "Value": "0.0%" } ] } ] }, { "RowType": "Section", "Title": "Balance Sheet", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Debtors" }, { "Value": "590.00" }, { "Value": "550.00" }, { "Value": "7.3%" } ] }, { "RowType": "Row", "Cells": [ { "Value": "Creditors" }, { "Value": "-44.00" }, { "Value": "-44.00" }, { "Value": "0.0%" } ] }, { "RowType": "Row", "Cells": [ { "Value": "Net assets" }, { "Value": "594.16" }, { "Value": "759.56" }, { "Value": "-21.8%" } ] } ] }, { "RowType": "Section", "Title": "Income", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Number of invoices issued" }, { "Value": "1" }, { "Value": "0" }, { "Value": "0.0%" } ] }, { "RowType": "Row", "Cells": [ { "Value": "Average value of invoices" }, { "Value": "40.00" }, { "Value": "0.00" }, { "Value": "0.0%" } ] } ] }, { "RowType": "Section", "Title": "Performance", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Gross profit margin" }, { "Value": "100.0%" }, { "Value": "" }, { "Value": "0.0%" } ] }, { "RowType": "Row", "Cells": [ { "Value": "Net profit margin" }, { "Value": "-413.5%" }, { "Value": "" }, { "Value": "0.0%" } ] }, { "RowType": "Row", "Cells": [ { "Value": "Return on investment (p.a.)" }, { "Value": "-334.1%" }, { "Value": "0.0%" }, { "Value": "0.0%" } ] } ] }, { "RowType": "Section", "Title": "Position", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Average debtors days" }, { "Value": "442.50" }, { "Value": "0" }, { "Value": "0.0%" } ] }, { "RowType": "Row", "Cells": [ { "Value": "Average creditors days" }, { "Value": "-6.426484907497565725413826680" }, { "Value": "0" }, { "Value": "0.0%" } ] }, { "RowType": "Row", "Cells": [ { "Value": "Short term cash forecast" }, { "Value": "634.00" }, { "Value": "594.00" }, { "Value": "6.7%" } ] }, { "RowType": "Row", "Cells": [ { "Value": "Current assets to liabilities" }, { "Value": "4.0729764675459012154124644427" }, { "Value": "-62.034024896265560165975103734" }, { "Value": "106.6%" } ] }, { "RowType": "Row", "Cells": [ { "Value": "Term assets to liabilities" }, { "Value": "" }, { "Value": "" }, { "Value": "0.0%" } ] } ] } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/ReportWithRows';
                };
              };
            };
            description: 'Success - return response of type ReportWithRows';
          };
        };
        security: [
          {
            OAuth2: ['accounting.reports.read'];
          },
        ];
        summary: 'Retrieves report for executive summary';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Reports/ProfitAndLoss': {
      get: {
        operationId: 'getReportProfitAndLoss';
        parameters: [
          {
            description: 'The from date for the ProfitAndLoss report e.g. 2018-03-31';
            example: '2019-03-01';
            in: 'query';
            name: 'fromDate';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
          {
            description: 'The to date for the ProfitAndLoss report e.g. 2018-03-31';
            example: '2019-03-31';
            in: 'query';
            name: 'toDate';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
          {
            description: 'The number of periods to compare (integer between 1 and 12)';
            example: 3;
            in: 'query';
            name: 'periods';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'The period size to compare to (MONTH, QUARTER, YEAR)';
            example: 'MONTH';
            in: 'query';
            name: 'timeframe';
            schema: {
              enum: ['MONTH', 'QUARTER', 'YEAR'];
              type: 'string';
            };
          },
          {
            description: 'The trackingCategory 1 for the ProfitAndLoss report';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'query';
            name: 'trackingCategoryID';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The trackingCategory 2 for the ProfitAndLoss report';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'query';
            name: 'trackingCategoryID2';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The tracking option 1 for the ProfitAndLoss report';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'query';
            name: 'trackingOptionID';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The tracking option 2 for the ProfitAndLoss report';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'query';
            name: 'trackingOptionID2';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Return the standard layout for the ProfitAndLoss report';
            example: 'true';
            in: 'query';
            name: 'standardLayout';
            schema: {
              type: 'boolean';
            };
          },
          {
            description: 'Return cash only basis for the ProfitAndLoss report';
            example: 'false';
            in: 'query';
            name: 'paymentsOnly';
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
                  $ref: '#/components/schemas/ReportWithRows';
                };
              };
            };
            description: 'Success - return response of type ReportWithRows';
          };
        };
        security: [
          {
            OAuth2: ['accounting.reports.read'];
          },
        ];
        summary: 'Retrieves report for profit and loss';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Reports/TenNinetyNine': {
      get: {
        operationId: 'getReportTenNinetyNine';
        parameters: [
          {
            description: 'The year of the 1099 report';
            example: '2019';
            in: 'query';
            name: 'reportYear';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "8b474ddb-9ef4-457c-8640-1c0e3670ea0e", "Status": "OK", "ProviderName": "Java Public Example", "DateTimeUTC": "\\/Date(1555968100978)\\/", "Reports": [ { "ReportName": "1099 report", "ReportDate": "1 Jan 2016 to 31 Dec 2016", "Fields": [], "Contacts": [ { "Box1": 0.00, "Box2": 0.00, "Box3": 1000.00, "Box4": 0.00, "Box5": 0.00, "Box6": 0.00, "Box7": 0.00, "Box8": 0.00, "Box9": 0.00, "Box10": 0.00, "Box11": 0.00, "Box13": 0.00, "Box14": 0.00, "Name": "Bank West", "FederalTaxIDType": "SSN", "City": "Pinehaven", "Zip": "12345", "State": "CA", "Email": "jack@bowest.com", "StreetAddress": "Procurement Services\\r\\nGPO 1234\\r\\n\\r\\n\\r\\n", "TaxID": "234-22-2223", "ContactId": "81d5706a-8057-4338-8511-747cd85f4c68" }, { "Box1": 0.00, "Box2": 0.00, "Box3": 1000.00, "Box4": 0.00, "Box5": 0.00, "Box6": 0.00, "Box7": 0.00, "Box8": 0.00, "Box9": 0.00, "Box10": 0.00, "Box11": 0.00, "Box13": 0.00, "Box14": 0.00, "Name": "Hoyt Productions", "FederalTaxIDType": "SSN", "City": "Oaktown", "Zip": "45123", "State": "NY", "Email": "accounts@hoytmadeupdemo.com", "StreetAddress": "100 Rusty Ridge Road\\r\\nSuite 100\\r\\n\\r\\n\\r\\n", "TaxID": "123-45-6780", "ContactId": "19732b6a-9a5c-4651-b33c-3f8f682e2a2b" }, { "Box1": 5543.75, "Box2": 0.00, "Box3": 0.00, "Box4": 0.00, "Box5": 0.00, "Box6": 0.00, "Box7": 0.00, "Box8": 0.00, "Box9": 0.00, "Box10": 0.00, "Box11": 0.00, "Box13": 0.00, "Box14": 0.00, "Name": "Truxton Property Management", "FederalTaxIDType": "EIN", "City": "Coppertown", "Zip": "21321", "State": "FL", "Email": "accounts@truxtonmadeupdemo.com", "StreetAddress": "1000 Copper Avenue\\r\\nSuite 1000\\r\\n\\r\\n\\r\\n", "TaxID": "33-3332233", "ContactId": "018355fc-c67e-4352-b443-ef3873031983" } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/Reports';
                };
              };
            };
            description: 'Success - return response of type Reports';
          };
        };
        security: [
          {
            OAuth2: ['accounting.reports.tenninetynine.read'];
          },
        ];
        summary: 'Retrieve reports for 1099';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Reports/TrialBalance': {
      get: {
        operationId: 'getReportTrialBalance';
        parameters: [
          {
            description: 'The date for the Trial Balance report e.g. 2018-03-31';
            example: '2019-10-31';
            in: 'query';
            name: 'date';
            schema: {
              format: 'date';
              type: 'string';
            };
          },
          {
            description: 'Return cash only basis for the Trial Balance report';
            example: 'true';
            in: 'query';
            name: 'paymentsOnly';
            schema: {
              type: 'boolean';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "0b3ee35e-b97c-4b3c-b7e2-9a465233e329", "Status": "OK", "ProviderName": "Java Public Example", "DateTimeUTC": "\\/Date(1556129558740)\\/", "Reports": [ { "ReportID": "TrialBalance", "ReportName": "Trial Balance", "ReportType": "TrialBalance", "ReportTitles": [ "Trial Balance", "Dev Evangelist - Sid Test 1 (US-2016-06)", "As at 24 April 2019" ], "ReportDate": "24 April 2019", "UpdatedDateUTC": "\\/Date(1556129558724)\\/", "Fields": [], "Rows": [ { "RowType": "Header", "Cells": [ { "Value": "Account" }, { "Value": "Debit" }, { "Value": "Credit" }, { "Value": "YTD Debit" }, { "Value": "YTD Credit" } ] }, { "RowType": "Section", "Title": "Revenue", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Big Expense (002)", "Attributes": [ { "Value": "da962997-a8bd-4dff-9616-01cdc199283f", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "da962997-a8bd-4dff-9616-01cdc199283f", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "da962997-a8bd-4dff-9616-01cdc199283f", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "da962997-a8bd-4dff-9616-01cdc199283f", "Id": "account" } ] }, { "Value": "80.00", "Attributes": [ { "Value": "da962997-a8bd-4dff-9616-01cdc199283f", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "Sales (400)", "Attributes": [ { "Value": "02439bca-5fdc-4b62-b281-0bdf9f16fd5b", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "02439bca-5fdc-4b62-b281-0bdf9f16fd5b", "Id": "account" } ] }, { "Value": "200.00", "Attributes": [ { "Value": "02439bca-5fdc-4b62-b281-0bdf9f16fd5b", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "02439bca-5fdc-4b62-b281-0bdf9f16fd5b", "Id": "account" } ] }, { "Value": "1020.22", "Attributes": [ { "Value": "02439bca-5fdc-4b62-b281-0bdf9f16fd5b", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "Sales-35325 (1302)", "Attributes": [ { "Value": "3f50db14-1fe6-450b-bfe8-b2d894f18c62", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "3f50db14-1fe6-450b-bfe8-b2d894f18c62", "Id": "account" } ] }, { "Value": "1000.00", "Attributes": [ { "Value": "3f50db14-1fe6-450b-bfe8-b2d894f18c62", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "3f50db14-1fe6-450b-bfe8-b2d894f18c62", "Id": "account" } ] }, { "Value": "1000.00", "Attributes": [ { "Value": "3f50db14-1fe6-450b-bfe8-b2d894f18c62", "Id": "account" } ] } ] } ] }, { "RowType": "Section", "Title": "Expenses", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Foobar14043 (123)", "Attributes": [ { "Value": "d1602f69-f900-4616-8d34-90af393fa368", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "d1602f69-f900-4616-8d34-90af393fa368", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "d1602f69-f900-4616-8d34-90af393fa368", "Id": "account" } ] }, { "Value": "40.00", "Attributes": [ { "Value": "d1602f69-f900-4616-8d34-90af393fa368", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "d1602f69-f900-4616-8d34-90af393fa368", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "MyExp51937 (1231239)", "Attributes": [ { "Value": "90f10e0a-a043-46fe-b87e-630e9a951dae", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "90f10e0a-a043-46fe-b87e-630e9a951dae", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "90f10e0a-a043-46fe-b87e-630e9a951dae", "Id": "account" } ] }, { "Value": "80.00", "Attributes": [ { "Value": "90f10e0a-a043-46fe-b87e-630e9a951dae", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "90f10e0a-a043-46fe-b87e-630e9a951dae", "Id": "account" } ] } ] } ] }, { "RowType": "Section", "Title": "Assets", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Accounts Receivable (120)", "Attributes": [ { "Value": "31ae5bb4-611c-4f89-a369-86e4d56e90b6", "Id": "account" } ] }, { "Value": "1190.00", "Attributes": [ { "Value": "31ae5bb4-611c-4f89-a369-86e4d56e90b6", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "31ae5bb4-611c-4f89-a369-86e4d56e90b6", "Id": "account" } ] }, { "Value": "36555.04", "Attributes": [ { "Value": "31ae5bb4-611c-4f89-a369-86e4d56e90b6", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "31ae5bb4-611c-4f89-a369-86e4d56e90b6", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "Business Wells Fargo (088)", "Attributes": [ { "Value": "6f7594f2-f059-4d56-9e67-47ac9733bfe9", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "6f7594f2-f059-4d56-9e67-47ac9733bfe9", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "6f7594f2-f059-4d56-9e67-47ac9733bfe9", "Id": "account" } ] }, { "Value": "7639.04", "Attributes": [ { "Value": "6f7594f2-f059-4d56-9e67-47ac9733bfe9", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "6f7594f2-f059-4d56-9e67-47ac9733bfe9", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "Generic Cash Clearing (8003)", "Attributes": [ { "Value": "f4be973a-25fc-48d0-a7df-7f719f239729", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "f4be973a-25fc-48d0-a7df-7f719f239729", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "f4be973a-25fc-48d0-a7df-7f719f239729", "Id": "account" } ] }, { "Value": "1443.00", "Attributes": [ { "Value": "f4be973a-25fc-48d0-a7df-7f719f239729", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "f4be973a-25fc-48d0-a7df-7f719f239729", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "Generic Credit Card Clearing (8002)", "Attributes": [ { "Value": "a10867ac-0bc4-4aa5-af00-b9e5b207c6c3", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "a10867ac-0bc4-4aa5-af00-b9e5b207c6c3", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "a10867ac-0bc4-4aa5-af00-b9e5b207c6c3", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "a10867ac-0bc4-4aa5-af00-b9e5b207c6c3", "Id": "account" } ] }, { "Value": "96.49", "Attributes": [ { "Value": "a10867ac-0bc4-4aa5-af00-b9e5b207c6c3", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "Generic Inventory (1400)", "Attributes": [ { "Value": "7422f1b6-619f-488c-89e1-91bdde20216c", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "7422f1b6-619f-488c-89e1-91bdde20216c", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "7422f1b6-619f-488c-89e1-91bdde20216c", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "7422f1b6-619f-488c-89e1-91bdde20216c", "Id": "account" } ] }, { "Value": "160.00", "Attributes": [ { "Value": "7422f1b6-619f-488c-89e1-91bdde20216c", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "My Savings (090)", "Attributes": [ { "Value": "7e5e243b-9fcd-4aef-8e3a-c70be1e39bfa", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "7e5e243b-9fcd-4aef-8e3a-c70be1e39bfa", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "7e5e243b-9fcd-4aef-8e3a-c70be1e39bfa", "Id": "account" } ] }, { "Value": "219.92", "Attributes": [ { "Value": "7e5e243b-9fcd-4aef-8e3a-c70be1e39bfa", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "7e5e243b-9fcd-4aef-8e3a-c70be1e39bfa", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "Payment Wall Clearing Account (8001)", "Attributes": [ { "Value": "bc06840c-12c5-4e22-bb57-fef4d64bac10", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "bc06840c-12c5-4e22-bb57-fef4d64bac10", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "bc06840c-12c5-4e22-bb57-fef4d64bac10", "Id": "account" } ] }, { "Value": "1.00", "Attributes": [ { "Value": "bc06840c-12c5-4e22-bb57-fef4d64bac10", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "bc06840c-12c5-4e22-bb57-fef4d64bac10", "Id": "account" } ] } ] } ] }, { "RowType": "Section", "Title": "Liabilities", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Accounts Payable (200)", "Attributes": [ { "Value": "e9132ee7-4dcf-4fad-b76c-86e212af645a", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "e9132ee7-4dcf-4fad-b76c-86e212af645a", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "e9132ee7-4dcf-4fad-b76c-86e212af645a", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "e9132ee7-4dcf-4fad-b76c-86e212af645a", "Id": "account" } ] }, { "Value": "9223.00", "Attributes": [ { "Value": "e9132ee7-4dcf-4fad-b76c-86e212af645a", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "Deferred Revenue (2300)", "Attributes": [ { "Value": "f22cd74e-f59d-4f38-a08d-07e14df28c24", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "f22cd74e-f59d-4f38-a08d-07e14df28c24", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "f22cd74e-f59d-4f38-a08d-07e14df28c24", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "f22cd74e-f59d-4f38-a08d-07e14df28c24", "Id": "account" } ] }, { "Value": "1854.24", "Attributes": [ { "Value": "f22cd74e-f59d-4f38-a08d-07e14df28c24", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "Rounding (260)", "Attributes": [ { "Value": "f0072999-8f7c-4b01-bce9-bd9352f98e02", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "f0072999-8f7c-4b01-bce9-bd9352f98e02", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "f0072999-8f7c-4b01-bce9-bd9352f98e02", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "f0072999-8f7c-4b01-bce9-bd9352f98e02", "Id": "account" } ] }, { "Value": "0.01", "Attributes": [ { "Value": "f0072999-8f7c-4b01-bce9-bd9352f98e02", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "Sales Tax (220)", "Attributes": [ { "Value": "af0be362-45fe-4730-a8af-634c2fb93f4d", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "af0be362-45fe-4730-a8af-634c2fb93f4d", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "af0be362-45fe-4730-a8af-634c2fb93f4d", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "af0be362-45fe-4730-a8af-634c2fb93f4d", "Id": "account" } ] }, { "Value": "1578.35", "Attributes": [ { "Value": "af0be362-45fe-4730-a8af-634c2fb93f4d", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "Suspense (250)", "Attributes": [ { "Value": "5ec2f302-cd60-4f8b-a915-9229dd45e6fa", "Id": "account" } ] }, { "Value": "10.00", "Attributes": [ { "Value": "5ec2f302-cd60-4f8b-a915-9229dd45e6fa", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "5ec2f302-cd60-4f8b-a915-9229dd45e6fa", "Id": "account" } ] }, { "Value": "41.00", "Attributes": [ { "Value": "5ec2f302-cd60-4f8b-a915-9229dd45e6fa", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "5ec2f302-cd60-4f8b-a915-9229dd45e6fa", "Id": "account" } ] } ] }, { "RowType": "Row", "Cells": [ { "Value": "Unpaid Expense Claims (210)", "Attributes": [ { "Value": "38e6967d-4da1-4a93-85f1-ea3c93b61041", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "38e6967d-4da1-4a93-85f1-ea3c93b61041", "Id": "account" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "38e6967d-4da1-4a93-85f1-ea3c93b61041", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "38e6967d-4da1-4a93-85f1-ea3c93b61041", "Id": "account" } ] }, { "Value": "135.00", "Attributes": [ { "Value": "38e6967d-4da1-4a93-85f1-ea3c93b61041", "Id": "account" } ] } ] } ] }, { "RowType": "Section", "Title": "Equity", "Rows": [ { "RowType": "Row", "Cells": [ { "Value": "Retained Earnings (320)", "Attributes": [ { "Value": "6ef53919-b47d-4341-b11a-735a3f8a6515", "Id": "account" } ] }, { "Value": "", "Attributes": [ { "Value": "6ef53919-b47d-4341-b11a-735a3f8a6515", "Id": "account" }, { "Value": "", "Id": "fromDate" }, { "Value": "12/31/2018", "Id": "toDate" } ] }, { "Value": "0.00", "Attributes": [ { "Value": "6ef53919-b47d-4341-b11a-735a3f8a6515", "Id": "account" }, { "Value": "", "Id": "fromDate" }, { "Value": "12/31/2018", "Id": "toDate" } ] }, { "Value": "", "Attributes": [ { "Value": "6ef53919-b47d-4341-b11a-735a3f8a6515", "Id": "account" }, { "Value": "", "Id": "fromDate" }, { "Value": "12/31/2018", "Id": "toDate" } ] }, { "Value": "30871.69", "Attributes": [ { "Value": "6ef53919-b47d-4341-b11a-735a3f8a6515", "Id": "account" }, { "Value": "", "Id": "fromDate" }, { "Value": "12/31/2018", "Id": "toDate" } ] } ] } ] }, { "RowType": "Section", "Title": "", "Rows": [ { "RowType": "SummaryRow", "Cells": [ { "Value": "Total" }, { "Value": "1200.00" }, { "Value": "1200.00" }, { "Value": "46019.00" }, { "Value": "46019.00" } ] } ] } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/ReportWithRows';
                };
              };
            };
            description: 'Success - return response of type ReportWithRows';
          };
        };
        security: [
          {
            OAuth2: ['accounting.reports.read'];
          },
        ];
        summary: 'Retrieves report for trial balance';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Reports/{ReportID}': {
      get: {
        operationId: 'getReportBASorGST';
        parameters: [
          {
            description: 'Unique identifier for a Report';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'ReportID';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ReportWithRows';
                };
              };
            };
            description: 'Success - return response of type ReportWithRows';
          };
        };
        security: [
          {
            OAuth2: ['accounting.reports.read'];
          },
        ];
        summary: 'Retrieves a specific report for BAS using a unique report Id (only valid for AU orgs)';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Setup': {
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'postSetup';
        requestBody: {
          content: {
            'application/json': {
              example: '{ "ConversionDate": {}, "ConversionBalances": [], "Accounts": [ { "Code": "200", "Name": "Sales", "Type": "SALES", "ReportingCode": "REV.TRA.GOO" }, { "Code": "400", "Name": "Advertising", "Type": "OVERHEADS", "ReportingCode": "EXP" }, { "Code": "610", "Name": "Accounts Receivable", "Type": "CURRENT", "SystemAccount": "DEBTORS", "ReportingCode": "ASS.CUR.REC.TRA" }, { "Code": "800", "Name": "Accounts Payable", "Type": "CURRLIAB", "SystemAccount": "CREDITORS", "ReportingCode": "LIA.CUR.PAY" } ] }';
              schema: {
                $ref: '#/components/schemas/Setup';
              };
            };
          };
          description: 'Object including an accounts array, a conversion balances array and a conversion date object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "80dcb65b-4d14-4350-84e6-1438a809244a", "Status": "OK", "ProviderName": "Java Public Example", "DateTimeUTC": "/Date(1604457589645)/", "ImportSummary": { "Accounts": { "Total": 17, "New": 0, "Updated": 8, "Deleted": 0, "Locked": 0, "System": 9, "Errored": 0, "Present": true, "NewOrUpdated": 8 }, "Organisation": { "Present": false } } }';
                schema: {
                  $ref: '#/components/schemas/ImportSummaryObject';
                };
              };
            };
            description: 'Success - returns a summary of the chart of accounts updates';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Sets the chart of accounts, the conversion date and conversion balances';
        tags: ['Accounting'];
        'x-example': [
          {
            account: null;
            is_object: true;
            key: 'account';
            keyPascal: 'Account';
          },
          {
            code: null;
            default: 123;
            key: 'code';
            keyPascal: 'Code';
            object: 'account';
          },
          {
            default: 'Business supplies';
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'account';
          },
          {
            csharp: 'Account.ClassEnum.EXPENSE';
            default: 'EXPENSE';
            is_last: true;
            java: 'com.xero.models.accounting.AccountType.EXPENSE';
            key: 'type';
            keyPascal: 'Type';
            node: 'AccountType.EXPENSE';
            nonString: true;
            object: 'account';
            php: 'XeroAPI\\XeroPHP\\Models\\Accounting\\AccountType::EXPENSE';
            python: 'AccountType.EXPENSE';
            ruby: 'XeroRuby::Accounting::AccountType::EXPENSE';
            type: null;
          },
          {
            accounts: null;
            is_list: true;
            key: 'accounts';
            keyPascal: 'Account';
          },
          {
            add_accounts: null;
            is_last: true;
            is_list_add: true;
            key: 'accounts';
            keyPascal: 'Accounts';
            object: 'account';
          },
          {
            conversionDate: null;
            is_object: true;
            key: 'conversionDate';
            keyPascal: 'ConversionDate';
            keySnake: 'conversion_date';
          },
          {
            default: 10;
            key: 'month';
            keyPascal: 'Month';
            month: null;
            nonString: true;
            object: 'conversionDate';
          },
          {
            default: 2020;
            is_last: true;
            key: 'year';
            keyPascal: 'Year';
            nonString: true;
            object: 'conversionDate';
            year: null;
          },
          {
            conversionBalances: null;
            is_list: true;
            key: 'conversionBalances';
            keyPascal: 'ConversionBalances';
            keySnake: 'conversion_balances';
          },
          {
            Setup: null;
            is_object: true;
            key: 'setup';
            keyPascal: 'Setup';
          },
          {
            default: 'accounts';
            is_variable: true;
            key: 'accounts';
            keyPascal: 'Accounts';
            nonString: true;
            object: 'setup';
            set_accounts: null;
          },
          {
            default: 'conversionDate';
            is_variable: true;
            key: 'conversionDate';
            keyPascal: 'ConversionDate';
            keySnake: 'conversion_date';
            nonString: true;
            object: 'setup';
            python: 'conversion_date';
            set_conversionDate: null;
          },
          {
            default: 'conversionBalances';
            is_last: true;
            is_variable: true;
            key: 'conversionBalances';
            keyPascal: 'ConversionBalances';
            keySnake: 'conversion_balances';
            nonString: true;
            object: 'setup';
            python: 'conversion_balances';
            set_conversionBalances: null;
          },
        ];
      };
    };
    '/TaxRates': {
      get: {
        operationId: 'getTaxRates';
        parameters: [
          {
            description: 'Filter by an any element';
            example: 'Status=="ACTIVE"';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-java': 'Status==&quot;&apos; + TaxRate.StatusEnum.ACTIVE + &apos;&quot;';
            'x-example-php': 'Status==&quot;&apos; . \\XeroAPI\\XeroPHP\\Models\\Accounting\\TaxRate::STATUS_ACTIVE . &apos;&quot;';
            'x-ruby-param': 'Status==#{XeroRuby::Accounting::TaxRate::ACTIVE}';
          },
          {
            description: 'Order by an any element';
            example: 'Name ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Filter by tax type';
            example: 'INPUT';
            in: 'query';
            name: 'TaxType';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "455d494d-9706-465b-b584-7086ca406b27", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1555086839841)\\/", "TaxRates": [ { "Name": "15% GST on Expenses", "TaxType": "INPUT2", "ReportTaxType": "INPUT", "CanApplyToAssets": true, "CanApplyToEquity": true, "CanApplyToExpenses": true, "CanApplyToLiabilities": true, "CanApplyToRevenue": false, "DisplayTaxRate": 15.0000, "EffectiveRate": 15.0000, "Status": "ACTIVE", "TaxComponents": [ { "Name": "GST", "Rate": 15.0000, "IsCompound": false, "IsNonRecoverable": false } ] }, { "Name": "15% GST on Income", "TaxType": "OUTPUT2", "ReportTaxType": "OUTPUT", "CanApplyToAssets": true, "CanApplyToEquity": true, "CanApplyToExpenses": false, "CanApplyToLiabilities": true, "CanApplyToRevenue": true, "DisplayTaxRate": 15.0000, "EffectiveRate": 15.0000, "Status": "ACTIVE", "TaxComponents": [ { "Name": "GST", "Rate": 15.0000, "IsCompound": false, "IsNonRecoverable": false } ] }, { "Name": "GST on Imports", "TaxType": "GSTONIMPORTS", "ReportTaxType": "GSTONIMPORTS", "CanApplyToAssets": false, "CanApplyToEquity": false, "CanApplyToExpenses": false, "CanApplyToLiabilities": true, "CanApplyToRevenue": false, "DisplayTaxRate": 0.0000, "EffectiveRate": 0.0000, "Status": "ACTIVE", "TaxComponents": [ { "Name": "GST", "Rate": 0.0000, "IsCompound": false, "IsNonRecoverable": false } ] }, { "Name": "No GST", "TaxType": "NONE", "ReportTaxType": "NONE", "CanApplyToAssets": true, "CanApplyToEquity": true, "CanApplyToExpenses": true, "CanApplyToLiabilities": true, "CanApplyToRevenue": true, "DisplayTaxRate": 0.0000, "EffectiveRate": 0.0000, "Status": "ACTIVE", "TaxComponents": [ { "Name": "GST", "Rate": 0.0000, "IsCompound": false, "IsNonRecoverable": false } ] }, { "Name": "Zero Rated", "TaxType": "ZERORATED", "ReportTaxType": "OUTPUT", "CanApplyToAssets": false, "CanApplyToEquity": false, "CanApplyToExpenses": false, "CanApplyToLiabilities": true, "CanApplyToRevenue": true, "DisplayTaxRate": 0.0000, "EffectiveRate": 0.0000, "Status": "ACTIVE", "TaxComponents": [ { "Name": "GST", "Rate": 0.0000, "IsCompound": false, "IsNonRecoverable": false } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/TaxRates';
                };
              };
            };
            description: 'Success - return response of type TaxRates array with TaxRates';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings.read'];
          },
        ];
        summary: 'Retrieves tax rates';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateTaxRate';
        requestBody: {
          content: {
            'application/json': {
              example: '{ "TaxRates": [ { "Name": "State Tax NY", "TaxComponents": [ { "Name": "State Tax", "Rate": 2.25 } ], "Status": "DELETED", "ReportTaxType": "INPUT" } ] }';
              schema: {
                $ref: '#/components/schemas/TaxRates';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "12f4c453-2e25-41aa-a52f-6faaf6c05832", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1555086839658)\\/", "TaxRates": [ { "Name": "SDKTax29067", "TaxType": "TAX002", "ReportTaxType": "INPUT", "CanApplyToAssets": true, "CanApplyToEquity": true, "CanApplyToExpenses": true, "CanApplyToLiabilities": true, "CanApplyToRevenue": false, "DisplayTaxRate": 2.2500, "EffectiveRate": 2.2500, "Status": "DELETED", "TaxComponents": [ { "Name": "State Tax", "Rate": 2.2500, "IsCompound": false, "IsNonRecoverable": false } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/TaxRates';
                };
              };
            };
            description: 'Success - return response of type TaxRates array updated TaxRate';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Updates tax rates';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            key: 'taxComponent';
            keyPascal: 'TaxComponent';
            keySnake: 'tax_component';
            taxComponent: null;
          },
          {
            default: 'State Tax';
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'taxComponent';
          },
          {
            default: 2.25;
            is_last: true;
            key: 'rate';
            keyPascal: 'Rate';
            nonString: true;
            object: 'taxComponent';
            rate: null;
          },
          {
            is_object: true;
            key: 'taxRate';
            keyPascal: 'TaxRate';
            keySnake: 'tax_rate';
            taxRate: null;
          },
          {
            default: 'CA State Tax';
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'taxRate';
          },
          {
            add_taxComponent: null;
            is_array_add: true;
            is_last: true;
            java: 'TaxComponents';
            key: 'taxRate';
            keyPascal: 'TaxComponents';
            keySnake: 'tax_components';
            object: 'taxComponent';
            python: 'tax_component';
          },
          {
            is_object: true;
            key: 'taxRates';
            keyPascal: 'TaxRates';
            taxRates: null;
          },
          {
            add_taxRate: null;
            is_array_add: true;
            is_last: true;
            java: 'TaxRates';
            key: 'taxRates';
            keyPascal: 'TaxRates';
            keySnake: 'tax_rates';
            object: 'taxRate';
            python: 'tax_rate';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ taxRates: [{ name: "State Tax NY", taxComponents: [{ name: "State Tax", rate: 2.25 }], status: TaxRate.StatusEnum.DELETED, reportTaxType: TaxRate.ReportTaxTypeEnum.INPUT }]}';
        'x-ruby-requestBody': 'tax_rates = { tax_rates: [{ name: "State Tax NY", tax_components: [{ name: "State Tax", rate: 2.25 }], status: XeroRuby::Accounting::TaxRate::Deleted, report_tax_type: XeroRuby::Accounting::TaxRate::INPUT }]}';
      };
      put: {
        operationId: 'createTaxRates';
        requestBody: {
          content: {
            'application/json': {
              example: '{ "TaxRates": [ { "Name": "CA State Tax", "TaxComponents": [ { "Name": "State Tax", "Rate": 2.25 } ] } ] }';
              schema: {
                $ref: '#/components/schemas/TaxRates';
              };
            };
          };
          description: 'TaxRates array with TaxRate object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "9d2c5e56-fab4-450b-a5ff-d47409508eab", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1555086839080)\\/", "TaxRates": [ { "Name": "SDKTax29067", "TaxType": "TAX002", "ReportTaxType": "INPUT", "CanApplyToAssets": true, "CanApplyToEquity": true, "CanApplyToExpenses": true, "CanApplyToLiabilities": true, "CanApplyToRevenue": false, "DisplayTaxRate": 2.2500, "EffectiveRate": 2.2500, "Status": "ACTIVE", "TaxComponents": [ { "Name": "State Tax", "Rate": 2.2500, "IsCompound": false, "IsNonRecoverable": false } ] } ] }';
                schema: {
                  $ref: '#/components/schemas/TaxRates';
                };
              };
            };
            description: 'Success - return response of type TaxRates array newly created TaxRate';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Creates one or more tax rates';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            key: 'taxComponent';
            keyPascal: 'TaxComponent';
            keySnake: 'tax_component';
            taxComponent: null;
          },
          {
            default: 'State Tax';
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'taxComponent';
          },
          {
            default: 2.25;
            is_last: true;
            key: 'rate';
            keyPascal: 'Rate';
            nonString: true;
            object: 'taxComponent';
            rate: null;
          },
          {
            is_object: true;
            key: 'taxRate';
            keyPascal: 'TaxRate';
            keySnake: 'tax_rate';
            taxRate: null;
          },
          {
            default: 'CA State Tax';
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'taxRate';
          },
          {
            add_taxComponent: null;
            is_array_add: true;
            is_last: true;
            java: 'TaxComponents';
            key: 'taxRate';
            keyPascal: 'TaxComponents';
            keySnake: 'tax_components';
            object: 'taxComponent';
            python: 'tax_component';
          },
          {
            is_object: true;
            key: 'taxRates';
            keyPascal: 'TaxRates';
            taxRates: null;
          },
          {
            add_taxRate: null;
            is_array_add: true;
            is_last: true;
            java: 'TaxRates';
            key: 'taxRates';
            keyPascal: 'TaxRates';
            keySnake: 'tax_rates';
            object: 'taxRate';
            python: 'tax_rate';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ taxRates: [{ name: "CA State Tax", taxComponents: [{ name: "State Tax", rate: 2.25 }]}]}';
        'x-ruby-requestBody': 'tax_rates = { tax_rates: [{ name: "CA State Tax", tax_components: [{ name: "State Tax", rate: 2.25 }]}]}';
      };
    };
    '/TrackingCategories': {
      get: {
        operationId: 'getTrackingCategories';
        parameters: [
          {
            description: 'Filter by an any element';
            example: 'Status=="ACTIVE"';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
            'x-example-java': 'Status==&quot;&apos; + TrackingCategory.StatusEnum.ACTIVE + &apos;&quot;';
            'x-example-php': 'Status==&quot;&apos; . \\XeroAPI\\XeroPHP\\Models\\Accounting\\TrackingCategory::STATUS_ACTIVE . &apos;&quot;';
            'x-ruby-param': 'Status==#{XeroRuby::Accounting::TrackingCategory::ACTIVE}';
          },
          {
            description: 'Order by an any element';
            example: 'Name ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'e.g. includeArchived=true - Categories and options with a status of ARCHIVED will be included in the response';
            in: 'query';
            name: 'includeArchived';
            schema: {
              type: 'boolean';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "cec55068-8061-48e5-ac83-c77e7c54cf3d", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1555085855047)\\/", "TrackingCategories": [ { "Name": "BarFoo", "Status": "ACTIVE", "TrackingCategoryID": "22f10184-0deb-44ae-a312-b1f6ea70e51f", "Options": [] }, { "Name": "HelloWorld", "Status": "ACTIVE", "TrackingCategoryID": "0c9fce3e-a111-4d99-803a-62cf3f40e633", "Options": [] } ] }';
                schema: {
                  $ref: '#/components/schemas/TrackingCategories';
                };
              };
            };
            description: 'Success - return response of type TrackingCategories array of TrackingCategory';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings.read'];
          },
        ];
        summary: 'Retrieves tracking categories and options';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createTrackingCategory';
        requestBody: {
          content: {
            'application/json': {
              example: '{ name: "FooBar" }';
              schema: {
                $ref: '#/components/schemas/TrackingCategory';
              };
            };
          };
          description: 'TrackingCategory object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "1a9f8e03-9916-4a42-93a9-e8fa4902d49c", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1555085855988)\\/", "TrackingCategories": [ { "Name": "FooBar", "Status": "ACTIVE", "TrackingCategoryID": "b1df776b-b093-4730-b6ea-590cca40e723", "Options": [] } ] }';
                schema: {
                  $ref: '#/components/schemas/TrackingCategories';
                };
              };
            };
            description: 'Success - return response of type TrackingCategories array of newly created TrackingCategory';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Create tracking categories';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            key: 'trackingCategory';
            keyPascal: 'TrackingCategory';
            trackingCategory: null;
          },
          {
            default: 'Foobar';
            is_last: true;
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'trackingCategory';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/TrackingCategories/{TrackingCategoryID}': {
      delete: {
        operationId: 'deleteTrackingCategory';
        parameters: [
          {
            description: 'Unique identifier for a TrackingCategory';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'TrackingCategoryID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "ca7f8145-c8a5-4366-a2fb-784edc0cfbb7", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1555086457922)\\/", "TrackingCategories": [ { "Name": "Foo46189", "Status": "DELETED", "TrackingCategoryID": "0390bdfd-94f2-49d6-b7a0-4a38c46ebf03", "Options": [] } ] }';
                schema: {
                  $ref: '#/components/schemas/TrackingCategories';
                };
              };
            };
            description: 'Success - return response of type TrackingCategories array of deleted TrackingCategory';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Deletes a specific tracking category';
        tags: ['Accounting'];
      };
      get: {
        operationId: 'getTrackingCategory';
        parameters: [
          {
            description: 'Unique identifier for a TrackingCategory';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'TrackingCategoryID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "b75b8862-39c0-45a8-82b8-30ab4831996b", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1555085855442)\\/", "TrackingCategories": [ { "Name": "Foo41157", "Status": "DELETED", "TrackingCategoryID": "22f10184-0deb-44ae-a312-b1f6ea70e51f", "Options": [] } ] }';
                schema: {
                  $ref: '#/components/schemas/TrackingCategories';
                };
              };
            };
            description: 'Success - return response of type TrackingCategories array of specified TrackingCategory';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings.read'];
          },
        ];
        summary: 'Retrieves specific tracking categories and options using a unique tracking category Id';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateTrackingCategory';
        parameters: [
          {
            description: 'Unique identifier for a TrackingCategory';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'TrackingCategoryID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ "Name": "Avengers" }';
              schema: {
                $ref: '#/components/schemas/TrackingCategory';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "55438774-f87d-4731-b586-799cf0f914ed", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1555085856275)\\/", "TrackingCategories": [ { "Name": "BarFoo", "Status": "ACTIVE", "TrackingCategoryID": "b1df776b-b093-4730-b6ea-590cca40e723", "Options": [] } ] }';
                schema: {
                  $ref: '#/components/schemas/TrackingCategories';
                };
              };
            };
            description: 'Success - return response of type TrackingCategories array of updated TrackingCategory';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Updates a specific tracking category';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            key: 'trackingCategory';
            keyPascal: 'TrackingCategory';
            trackingCategory: null;
          },
          {
            default: 'Foobar';
            is_last: true;
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'trackingCategory';
          },
        ];
        'x-hasAccountingValidationError': true;
        'x-node-requestBody': '{ name: "Avengers" }';
        'x-ruby-requestBody': 'tracking_categories = { name: "Avengers" }';
      };
    };
    '/TrackingCategories/{TrackingCategoryID}/Options': {
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      put: {
        operationId: 'createTrackingOptions';
        parameters: [
          {
            description: 'Unique identifier for a TrackingCategory';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'TrackingCategoryID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ name: " Bar" }';
              schema: {
                $ref: '#/components/schemas/TrackingOption';
              };
            };
          };
          description: 'TrackingOption object in body of request';
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "923be702-d124-4f5c-a568-760906538d8e", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1555085857061)\\/", "Options": [ { "TrackingOptionID": "34669548-b989-487a-979f-0787d04568a2", "Name": "Bar40423", "Status": "ACTIVE", "HasValidationErrors": false, "IsDeleted": false, "IsArchived": false, "IsActive": true } ] }';
                schema: {
                  $ref: '#/components/schemas/TrackingOptions';
                };
              };
            };
            description: 'Success - return response of type TrackingOptions array of options for a specified category';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Creates options for a specific tracking category';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            key: 'trackingOption';
            keyPascal: 'TrackingOption';
            trackingOption: null;
          },
          {
            default: 'Foobar';
            is_last: true;
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'trackingOption';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/TrackingCategories/{TrackingCategoryID}/Options/{TrackingOptionID}': {
      delete: {
        operationId: 'deleteTrackingOptions';
        parameters: [
          {
            description: 'Unique identifier for a TrackingCategory';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'TrackingCategoryID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Unique identifier for a Tracking Option';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'TrackingOptionID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "d985866e-0831-418f-a07c-4d843ff66d25", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1555085857338)\\/", "Options": [ { "TrackingOptionID": "34669548-b989-487a-979f-0787d04568a2", "Name": "Bar40423", "Status": "DELETED", "HasValidationErrors": false, "IsDeleted": true, "IsArchived": false, "IsActive": false } ] }';
                schema: {
                  $ref: '#/components/schemas/TrackingOptions';
                };
              };
            };
            description: 'Success - return response of type TrackingOptions array of remaining options for a specified category';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Deletes a specific option for a specific tracking category';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
      post: {
        operationId: 'updateTrackingOptions';
        parameters: [
          {
            description: 'Unique identifier for a TrackingCategory';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'TrackingCategoryID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
          {
            description: 'Unique identifier for a Tracking Option';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'TrackingOptionID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              example: '{ name: "Vision" }';
              schema: {
                $ref: '#/components/schemas/TrackingOption';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "923be702-d124-4f5c-a568-760906538d8e", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1555085857061)\\/", "Options": [ { "TrackingOptionID": "34669548-b989-487a-979f-0787d04568a2", "Name": "Bar40423", "Status": "ACTIVE", "HasValidationErrors": false, "IsDeleted": false, "IsArchived": false, "IsActive": true } ] }';
                schema: {
                  $ref: '#/components/schemas/TrackingOptions';
                };
              };
            };
            description: 'Success - return response of type TrackingOptions array of options for a specified category';
          };
          '400': {
            $ref: '#/components/responses/400Error';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings'];
          },
        ];
        summary: 'Updates a specific option for a specific tracking category';
        tags: ['Accounting'];
        'x-example': [
          {
            is_object: true;
            key: 'trackingOption';
            keyPascal: 'TrackingOption';
            trackingOption: null;
          },
          {
            default: 'Foobar';
            is_last: true;
            key: 'name';
            keyPascal: 'Name';
            name: null;
            object: 'trackingOption';
          },
        ];
        'x-hasAccountingValidationError': true;
      };
    };
    '/Users': {
      get: {
        operationId: 'getUsers';
        parameters: [
          {
            $ref: '#/components/parameters/ifModifiedSince';
          },
          {
            description: 'Filter by an any element';
            example: 'IsSubscriber==true';
            in: 'query';
            name: 'where';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Order by an any element';
            example: 'LastName ASC';
            in: 'query';
            name: 'order';
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "17932a4e-4948-4d50-8672-4ef0e1dd90c5", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1553880796393)\\/", "Users": [ { "UserID": "3c37ef1d-cd49-4589-9787-3c418ed8b6ac", "EmailAddress": "test@email.com", "FirstName": "Test", "LastName": "Xero", "UpdatedDateUTC": "\\/Date(1508523261613+0000)\\/", "IsSubscriber": false, "OrganisationRole": "FINANCIALADVISER" }, { "UserID": "d1164823-0ac1-41ad-987b-b4e30fe0b273", "EmailAddress": "api@xero.com", "FirstName": "API ", "LastName": "Team", "UpdatedDateUTC": "\\/Date(1511957179217+0000)\\/", "IsSubscriber": true, "OrganisationRole": "FINANCIALADVISER" } ] }';
                schema: {
                  $ref: '#/components/schemas/Users';
                };
              };
            };
            description: 'Success - return response of type Users array of all User';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings.read'];
          },
        ];
        summary: 'Retrieves users';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
    '/Users/{UserID}': {
      get: {
        operationId: 'getUser';
        parameters: [
          {
            description: 'Unique identifier for a User';
            example: '00000000-0000-0000-0000-000000000000';
            in: 'path';
            name: 'UserID';
            required: true;
            schema: {
              format: 'uuid';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                example: '{ "Id": "51250ce8-1b35-4ba4-b404-dc94ff75bd87", "Status": "OK", "ProviderName": "Provider Name Example", "DateTimeUTC": "\\/Date(1553880796732)\\/", "Users": [ { "UserID": "3c37ef1d-cd49-4589-9787-3c418ed8b6ac", "EmailAddress": "test@email.com", "FirstName": "Test", "LastName": "Xero", "UpdatedDateUTC": "\\/Date(1508523261613+0000)\\/", "IsSubscriber": false, "OrganisationRole": "FINANCIALADVISER" } ] }';
                schema: {
                  $ref: '#/components/schemas/Users';
                };
              };
            };
            description: 'Success - return response of type Users array of specified User';
          };
        };
        security: [
          {
            OAuth2: ['accounting.settings.read'];
          },
        ];
        summary: 'Retrieves a specific user';
        tags: ['Accounting'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/requiredHeader';
        },
      ];
    };
  };
  components: {
    parameters: {
      ifModifiedSince: {
        description: 'Only records created or modified since this timestamp will be returned';
        example: '2020-02-06T12:17:43.202-08:00';
        in: 'header';
        name: 'If-Modified-Since';
        schema: {
          format: 'date-time';
          type: 'string';
        };
      };
      includeOnline: {
        description: 'Allows an attachment to be seen by the end customer within their online invoice';
        example: true;
        in: 'query';
        name: 'IncludeOnline';
        schema: {
          default: false;
          type: 'boolean';
        };
      };
      requiredHeader: {
        description: 'Xero identifier for Tenant';
        example: 'YOUR_XERO_TENANT_ID';
        in: 'header';
        name: 'xero-tenant-id';
        required: true;
        schema: {
          type: 'string';
        };
      };
      summarizeErrors: {
        description: 'If false return 200 OK and mix of successfully created objects and any with validation errors';
        example: true;
        in: 'query';
        name: 'summarizeErrors';
        schema: {
          default: false;
          type: 'boolean';
        };
        'x-example-python': 'True';
      };
      unitdp: {
        description: 'e.g. unitdp=4 – (Unit Decimal Places) You can opt in to use four decimal places for unit amounts';
        example: 4;
        in: 'query';
        name: 'unitdp';
        schema: {
          type: 'integer';
        };
      };
    };
    requestBodies: {
      historyRecords: {
        content: {
          'application/json': {
            example: '{   "HistoryRecords": [   {   "Details": "Hello World" } ] }';
            schema: {
              $ref: '#/components/schemas/HistoryRecords';
            };
          };
        };
        description: 'HistoryRecords containing an array of HistoryRecord objects in body of request';
        required: true;
      };
    };
    responses: {
      '400Error': {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error';
            };
          };
        };
        description: 'A failed request due to validation error';
      };
      HistoryRecordCreated: {
        content: {
          'application/json': {
            example: '{ "Id": "d7525479-3392-44c0-bb37-ff4a0b5df5bd", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550899400362)\\/", "HistoryRecords": [ { "DateUTCString": "2019-02-23T05:23:20", "DateUTC": "\\/Date(1550899400362)\\/", "Details": "Hello World", "ValidationErrors": [] } ] }';
            schema: {
              $ref: '#/components/schemas/HistoryRecords';
            };
          };
        };
        description: 'Success - return response of type HistoryRecords array of HistoryRecord objects';
      };
      HistoryRetrieved: {
        content: {
          'application/json': {
            example: '{ "Id": "cd54cc7b-b721-4207-b11d-7d13c7902f91", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551311321819)\\/", "HistoryRecords": [ { "Changes": "Attached a file", "DateUTCString": "2018-11-08T15:01:21", "DateUTC": "\\/Date(1541689281470+0000)\\/", "User": "System Generated", "Details": "Attached the file sample2.jpg through the Xero API using Xero API Partner" }, { "Changes": "Credit Applied", "DateUTCString": "2016-10-17T20:46:01", "DateUTC": "\\/Date(1476737161173+0000)\\/", "User": "System Generated", "Details": "Bank transfer from Business Wells Fargo to My Savings on November 12, 2016 for 20.00." } ] }';
            schema: {
              $ref: '#/components/schemas/HistoryRecords';
            };
          };
        };
        description: 'Success - return response of HistoryRecords array of 0 to N HistoryRecord';
      };
    };
    schemas: {
      Account: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/accounts/';
        };
        properties: {
          AccountID: {
            description: 'The Xero identifier for an account – specified as a string following  the endpoint name   e.g. /297c2dc5-cc47-4afd-8ec8-74990b8761e9';
            example: '00000000-0000-0000-0000-000000000000';
            format: 'uuid';
            type: 'string';
          };
          AddToWatchlist: {
            description: 'Boolean – describes whether the account is shown in the watchlist widget on the dashboard';
            type: 'boolean';
          };
          BankAccountNumber: {
            description: 'For bank accounts only (Account Type BANK)';
            type: 'string';
          };
          BankAccountType: {
            description: 'For bank accounts only. See Bank Account types';
            enum: ['BANK', 'CREDITCARD', 'PAYPAL', 'NONE', ''];
            type: 'string';
          };
          Class: {
            description: 'See Account Class Types';
            enum: ['ASSET', 'EQUITY', 'EXPENSE', 'LIABILITY', 'REVENUE'];
            readOnly: true;
            type: 'string';
          };
          Code: {
            description: 'Customer defined alpha numeric account code e.g 200 or SALES (max length = 10)';
            example: 4400;
            type: 'string';
          };
          CurrencyCode: {
            $ref: '#/components/schemas/CurrencyCode';
            type: 'string';
          };
          Description: {
            description: 'Description of the Account. Valid for all types of accounts except bank accounts (max length = 4000)';
            type: 'string';
          };
          EnablePaymentsToAccount: {
            description: 'Boolean – describes whether account can have payments applied to it';
            type: 'boolean';
          };
          HasAttachments: {
            default: 'false';
            description: 'boolean to indicate if an account has an attachment (read only)';
            example: 'false';
            readOnly: true;
            type: 'boolean';
          };
          Name: {
            description: 'Name of account (max length = 150)';
            example: 'Food Sales';
            maxLength: 150;
            type: 'string';
          };
          ReportingCode: {
            description: 'Shown if set';
            type: 'string';
          };
          ReportingCodeName: {
            description: 'Shown if set';
            readOnly: true;
            type: 'string';
          };
          ShowInExpenseClaims: {
            description: 'Boolean – describes whether account code is available for use with expense claims';
            type: 'boolean';
          };
          Status: {
            description: 'Accounts with a status of ACTIVE can be updated to ARCHIVED. See Account Status Codes';
            enum: ['ACTIVE', 'ARCHIVED', 'DELETED'];
            type: 'string';
          };
          SystemAccount: {
            description: 'If this is a system account then this element is returned. See System Account types. Note that non-system accounts may have this element set as either “” or null.';
            enum: [
              'DEBTORS',
              'CREDITORS',
              'BANKCURRENCYGAIN',
              'GST',
              'GSTONIMPORTS',
              'HISTORICAL',
              'REALISEDCURRENCYGAIN',
              'RETAINEDEARNINGS',
              'ROUNDING',
              'TRACKINGTRANSFERS',
              'UNPAIDEXPCLM',
              'UNREALISEDCURRENCYGAIN',
              'WAGEPAYABLES',
              'CISASSETS',
              'CISASSET',
              'CISLABOUR',
              'CISLABOUREXPENSE',
              'CISLABOURINCOME',
              'CISLIABILITY',
              'CISMATERIALS',
              '',
            ];
            readOnly: true;
            type: 'string';
          };
          TaxType: {
            description: 'The tax type from TaxRates';
            type: 'string';
          };
          Type: {
            $ref: '#/components/schemas/AccountType';
            type: 'string';
          };
          UpdatedDateUTC: {
            description: 'Last modified date UTC format';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          ValidationErrors: {
            description: 'Displays array of validation error messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      AccountType: {
        description: 'See Account Types';
        enum: [
          'BANK',
          'CURRENT',
          'CURRLIAB',
          'DEPRECIATN',
          'DIRECTCOSTS',
          'EQUITY',
          'EXPENSE',
          'FIXED',
          'INVENTORY',
          'LIABILITY',
          'NONCURRENT',
          'OTHERINCOME',
          'OVERHEADS',
          'PREPAYMENT',
          'REVENUE',
          'SALES',
          'TERMLIAB',
          'PAYGLIABILITY',
          'PAYG',
          'SUPERANNUATIONEXPENSE',
          'SUPERANNUATIONLIABILITY',
          'WAGESEXPENSE',
        ];
        type: 'string';
      };
      Accounts: {
        properties: {
          Accounts: {
            items: {
              $ref: '#/components/schemas/Account';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      AccountsPayable: {
        properties: {
          Outstanding: {
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Overdue: {
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
        };
        type: 'object';
      };
      AccountsReceivable: {
        properties: {
          Outstanding: {
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Overdue: {
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
        };
        type: 'object';
      };
      Action: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/organisation/';
        };
        properties: {
          Name: {
            description: 'Name of the actions for this organisation';
            example: 'UseMulticurrency';
            type: 'string';
          };
          Status: {
            description: 'Status of the action for this organisation';
            enum: ['ALLOWED', 'NOT-ALLOWED'];
            type: 'string';
          };
        };
      };
      Actions: {
        properties: {
          Actions: {
            items: {
              $ref: '#/components/schemas/Action';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Address: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/types';
        };
        properties: {
          AddressLine1: {
            description: 'max length = 500';
            maxLength: 500;
            type: 'string';
          };
          AddressLine2: {
            description: 'max length = 500';
            maxLength: 500;
            type: 'string';
          };
          AddressLine3: {
            description: 'max length = 500';
            maxLength: 500;
            type: 'string';
          };
          AddressLine4: {
            description: 'max length = 500';
            maxLength: 500;
            type: 'string';
          };
          AddressType: {
            description: 'define the type of address';
            enum: ['POBOX', 'STREET'];
            type: 'string';
          };
          AttentionTo: {
            description: 'max length = 255';
            maxLength: 255;
            type: 'string';
          };
          City: {
            description: 'max length = 255';
            maxLength: 255;
            type: 'string';
          };
          Country: {
            description: 'max length = 50, [A-Z], [a-z] only';
            maxLength: 50;
            type: 'string';
          };
          PostalCode: {
            description: 'max length = 50';
            maxLength: 50;
            type: 'string';
          };
          Region: {
            description: 'max length = 255';
            maxLength: 255;
            type: 'string';
          };
        };
        type: 'object';
      };
      AddressForOrganisation: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/types';
        };
        properties: {
          AddressLine1: {
            description: 'max length = 500';
            maxLength: 500;
            type: 'string';
          };
          AddressLine2: {
            description: 'max length = 500';
            maxLength: 500;
            type: 'string';
          };
          AddressLine3: {
            description: 'max length = 500';
            maxLength: 500;
            type: 'string';
          };
          AddressLine4: {
            description: 'max length = 500';
            maxLength: 500;
            type: 'string';
          };
          AddressType: {
            description: 'define the type of address';
            enum: ['POBOX', 'STREET', 'DELIVERY'];
            type: 'string';
          };
          AttentionTo: {
            description: 'max length = 255';
            maxLength: 255;
            type: 'string';
          };
          City: {
            description: 'max length = 255';
            maxLength: 255;
            type: 'string';
          };
          Country: {
            description: 'max length = 50, [A-Z], [a-z] only';
            maxLength: 50;
            type: 'string';
          };
          PostalCode: {
            description: 'max length = 50';
            maxLength: 50;
            type: 'string';
          };
          Region: {
            description: 'max length = 255';
            maxLength: 255;
            type: 'string';
          };
        };
        type: 'object';
      };
      Allocation: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/prepayments/';
        };
        properties: {
          Amount: {
            description: 'the amount being applied to the invoice';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          CreditNote: {
            $ref: '#/components/schemas/CreditNote';
          };
          Date: {
            description: 'the date the allocation is applied YYYY-MM-DD.';
            type: 'string';
            'x-is-msdate': true;
          };
          Invoice: {
            $ref: '#/components/schemas/Invoice';
          };
          Overpayment: {
            $ref: '#/components/schemas/Overpayment';
          };
          Prepayment: {
            $ref: '#/components/schemas/Prepayment';
          };
          StatusAttributeString: {
            description: 'A string to indicate if a invoice status';
            type: 'string';
          };
          ValidationErrors: {
            description: 'Displays array of validation error messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
        };
        required: ['Amount', 'Invoice', 'Date'];
        type: 'object';
      };
      Allocations: {
        properties: {
          Allocations: {
            items: {
              $ref: '#/components/schemas/Allocation';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Attachment: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/attachments/';
        };
        properties: {
          AttachmentID: {
            description: 'Unique ID for the file';
            example: '00000000-0000-0000-0000-000000000000';
            format: 'uuid';
            type: 'string';
          };
          ContentLength: {
            description: 'Length of the file content';
            type: 'integer';
          };
          FileName: {
            description: 'Name of the file';
            example: 'xero-dev.jpg';
            type: 'string';
          };
          IncludeOnline: {
            description: 'Include the file with the online invoice';
            type: 'boolean';
          };
          MimeType: {
            description: 'Type of file';
            example: 'image/jpg';
            type: 'string';
          };
          Url: {
            description: 'URL to the file on xero.com';
            example: 'https://api.xero.com/api.xro/2.0/Accounts/da962997-a8bd-4dff-9616-01cdc199283f/Attachments/sample5.jpg';
            type: 'string';
          };
        };
        type: 'object';
      };
      Attachments: {
        properties: {
          Attachments: {
            items: {
              $ref: '#/components/schemas/Attachment';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      BalanceDetails: {
        description: 'An array to specify multiple currency balances of an account';
        properties: {
          Balance: {
            description: 'The opening balances of the account. Debits are positive, credits are negative values';
            format: 'double';
            type: 'number';
          };
          CurrencyCode: {
            description: 'The currency of the balance (Not required for base currency)';
            type: 'string';
          };
          CurrencyRate: {
            description: '(Optional) Exchange rate to base currency when money is spent or received. If not specified, XE rate for the day is applied';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
        };
        type: 'object';
      };
      Balances: {
        description: 'The raw AccountsReceivable(sales invoices) and AccountsPayable(bills) outstanding and overdue amounts, not converted to base currency (read only)';
        properties: {
          AccountsPayable: {
            $ref: '#/components/schemas/AccountsPayable';
          };
          AccountsReceivable: {
            $ref: '#/components/schemas/AccountsReceivable';
          };
        };
        type: 'object';
      };
      BankTransaction: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/banktransactions/';
        };
        properties: {
          BankAccount: {
            $ref: '#/components/schemas/Account';
          };
          BankTransactionID: {
            description: 'Xero generated unique identifier for bank transaction';
            example: '00000000-0000-0000-0000-000000000000';
            format: 'uuid';
            type: 'string';
          };
          Contact: {
            $ref: '#/components/schemas/Contact';
          };
          CurrencyCode: {
            $ref: '#/components/schemas/CurrencyCode';
            type: 'string';
          };
          CurrencyRate: {
            description: 'Exchange rate to base currency when money is spent or received. e.g.0.7500 Only used for bank transactions in non base currency. If this isn’t specified for non base currency accounts then either the user-defined rate (preference) or the XE.com day rate will be used. Setting currency is only supported on overpayments.';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Date: {
            description: 'Date of transaction – YYYY-MM-DD';
            type: 'string';
            'x-is-msdate': true;
          };
          HasAttachments: {
            default: 'false';
            description: 'Boolean to indicate if a bank transaction has an attachment';
            example: 'false';
            readOnly: true;
            type: 'boolean';
          };
          IsReconciled: {
            description: 'Boolean to show if transaction is reconciled';
            type: 'boolean';
          };
          LineAmountTypes: {
            $ref: '#/components/schemas/LineAmountTypes';
            type: 'string';
          };
          LineItems: {
            description: 'See LineItems';
            items: {
              $ref: '#/components/schemas/LineItem';
            };
            type: 'array';
          };
          OverpaymentID: {
            description: 'Xero generated unique identifier for an Overpayment. This will be returned on BankTransactions with a Type of SPEND-OVERPAYMENT or RECEIVE-OVERPAYMENT';
            example: '00000000-0000-0000-0000-000000000000';
            format: 'uuid';
            readOnly: true;
            type: 'string';
          };
          PrepaymentID: {
            description: 'Xero generated unique identifier for a Prepayment. This will be returned on BankTransactions with a Type of SPEND-PREPAYMENT or RECEIVE-PREPAYMENT';
            example: '00000000-0000-0000-0000-000000000000';
            format: 'uuid';
            readOnly: true;
            type: 'string';
          };
          Reference: {
            description: 'Reference for the transaction. Only supported for SPEND and RECEIVE transactions.';
            type: 'string';
          };
          Status: {
            description: 'See Bank Transaction Status Codes';
            enum: ['AUTHORISED', 'DELETED', 'VOIDED'];
            type: 'string';
          };
          StatusAttributeString: {
            description: 'A string to indicate if a invoice status';
            type: 'string';
          };
          SubTotal: {
            description: 'Total of bank transaction excluding taxes';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Total: {
            description: 'Total of bank transaction tax inclusive';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          TotalTax: {
            description: 'Total tax on bank transaction';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Type: {
            description: 'See Bank Transaction Types';
            enum: [
              'RECEIVE',
              'RECEIVE-OVERPAYMENT',
              'RECEIVE-PREPAYMENT',
              'SPEND',
              'SPEND-OVERPAYMENT',
              'SPEND-PREPAYMENT',
              'RECEIVE-TRANSFER',
              'SPEND-TRANSFER',
            ];
            type: 'string';
          };
          UpdatedDateUTC: {
            description: 'Last modified date UTC format';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          Url: {
            description: 'URL link to a source document – shown as “Go to App Name”';
            type: 'string';
          };
          ValidationErrors: {
            description: 'Displays array of validation error messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
        };
        required: ['Type', 'LineItems', 'BankAccount'];
        type: 'object';
      };
      BankTransactions: {
        properties: {
          BankTransactions: {
            items: {
              $ref: '#/components/schemas/BankTransaction';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      BankTransfer: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/bank-transfers/';
        };
        properties: {
          Amount: {
            description: 'amount of the transaction';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          BankTransferID: {
            description: 'The identifier of the Bank Transfer';
            format: 'uuid';
            readOnly: true;
            type: 'string';
          };
          CreatedDateUTC: {
            description: 'UTC timestamp of creation date of bank transfer';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          CurrencyRate: {
            description: 'The currency rate';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          Date: {
            description: 'The date of the Transfer YYYY-MM-DD';
            type: 'string';
            'x-is-msdate': true;
          };
          FromBankAccount: {
            $ref: '#/components/schemas/Account';
          };
          FromBankTransactionID: {
            description: 'The Bank Transaction ID for the source account';
            format: 'uuid';
            readOnly: true;
            type: 'string';
          };
          HasAttachments: {
            default: 'false';
            description: 'Boolean to indicate if a Bank Transfer has an attachment';
            example: 'false';
            readOnly: true;
            type: 'boolean';
          };
          ToBankAccount: {
            $ref: '#/components/schemas/Account';
          };
          ToBankTransactionID: {
            description: 'The Bank Transaction ID for the destination account';
            format: 'uuid';
            readOnly: true;
            type: 'string';
          };
          ValidationErrors: {
            description: 'Displays array of validation error messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
        };
        required: ['FromBankAccount', 'ToBankAccount', 'Amount'];
        type: 'object';
      };
      BankTransfers: {
        properties: {
          BankTransfers: {
            items: {
              $ref: '#/components/schemas/BankTransfer';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      BatchPayment: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/BatchPayments/';
        };
        properties: {
          Account: {
            $ref: '#/components/schemas/Account';
          };
          Amount: {
            description: 'The amount of the payment. Must be less than or equal to the outstanding amount owing on the invoice e.g. 200.00';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          BatchPaymentID: {
            description: 'The Xero generated unique identifier for the bank transaction (read-only)';
            format: 'uuid';
            readOnly: true;
            type: 'string';
          };
          Code: {
            description: '(NZ Only) Optional references for the batch payment transaction. It will also show with the batch payment transaction in the bank reconciliation Find & Match screen. Depending on your individual bank, the detail may also show on the bank statement you import into Xero.';
            maxLength: 12;
            type: 'string';
          };
          Date: {
            description: 'Date the payment is being made (YYYY-MM-DD) e.g. 2009-09-06';
            type: 'string';
            'x-is-msdate': true;
          };
          DateString: {
            description: 'Date the payment is being made (YYYY-MM-DD) e.g. 2009-09-06';
            type: 'string';
          };
          Details: {
            description: '(Non-NZ Only) These details are sent to the org’s bank as a reference for the batch payment transaction. They will also show with the batch payment transaction in the bank reconciliation Find & Match screen. Depending on your individual bank, the detail may also show on the bank statement imported into Xero. Maximum field length = 18';
            type: 'string';
          };
          IsReconciled: {
            description: 'Booelan that tells you if the batch payment has been reconciled (read-only)';
            readOnly: true;
            type: 'string';
          };
          Narrative: {
            description: '(UK Only) Only shows on the statement line in Xero. Max length =18';
            maxLength: 18;
            type: 'string';
          };
          Particulars: {
            description: '(NZ Only) Optional references for the batch payment transaction. It will also show with the batch payment transaction in the bank reconciliation Find & Match screen. Depending on your individual bank, the detail may also show on the bank statement you import into Xero.';
            maxLength: 12;
            type: 'string';
          };
          Payments: {
            description: 'An array of payments';
            items: {
              $ref: '#/components/schemas/Payment';
            };
            type: 'array';
          };
          Reference: {
            description: '(NZ Only) Optional references for the batch payment transaction. It will also show with the batch payment transaction in the bank reconciliation Find & Match screen. Depending on your individual bank, the detail may also show on the bank statement you import into Xero.';
            maxLength: 255;
            type: 'string';
          };
          Status: {
            description: 'AUTHORISED or DELETED (read-only). New batch payments will have a status of AUTHORISED. It is not possible to delete batch payments via the API.';
            enum: ['AUTHORISED', 'DELETED'];
            readOnly: true;
            type: 'string';
          };
          TotalAmount: {
            description: 'The total of the payments that make up the batch (read-only)';
            readOnly: true;
            type: 'string';
          };
          Type: {
            description: 'PAYBATCH for bill payments or RECBATCH for sales invoice payments (read-only)';
            enum: ['PAYBATCH', 'RECBATCH'];
            readOnly: true;
            type: 'string';
          };
          UpdatedDateUTC: {
            description: 'UTC timestamp of last update to the payment';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
        };
        type: 'object';
      };
      BatchPaymentDetails: {
        description: 'Bank details for use on a batch payment stored with each contact';
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/Contact/';
        };
        properties: {
          BankAccountName: {
            description: 'Name of bank for use with Batch Payments';
            example: 'ACME Bank';
            type: 'string';
          };
          BankAccountNumber: {
            description: 'Bank account number for use with Batch Payments';
            example: '123-456-1111111';
            type: 'string';
          };
          Code: {
            description: '(NZ Only) Optional references for the batch payment transaction. It will also show with the batch payment transaction in the bank reconciliation Find & Match screen. Depending on your individual bank, the detail may also show on the bank statement you import into Xero.';
            example: 'ABC';
            maxLength: 12;
            type: 'string';
          };
          Details: {
            description: '(Non-NZ Only) These details are sent to the org’s bank as a reference for the batch payment transaction. They will also show with the batch payment transaction in the bank reconciliation Find & Match screen. Depending on your individual bank, the detail may also show on the bank statement imported into Xero. Maximum field length = 18';
            example: 'Hello World';
            type: 'string';
          };
          Reference: {
            description: '(NZ Only) Optional references for the batch payment transaction. It will also show with the batch payment transaction in the bank reconciliation Find & Match screen. Depending on your individual bank, the detail may also show on the bank statement you import into Xero.';
            example: 'Foobar';
            maxLength: 12;
            type: 'string';
          };
        };
      };
      BatchPayments: {
        properties: {
          BatchPayments: {
            items: {
              $ref: '#/components/schemas/BatchPayment';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Bill: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/organisation/';
        };
        properties: {
          Day: {
            description: 'Day of Month (0-31)';
            type: 'integer';
          };
          Type: {
            $ref: '#/components/schemas/PaymentTermType';
          };
        };
        type: 'object';
      };
      BrandingTheme: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/branding-themes/';
        };
        properties: {
          BrandingThemeID: {
            description: 'Xero identifier';
            format: 'uuid';
            type: 'string';
          };
          CreatedDateUTC: {
            description: 'UTC timestamp of creation date of branding theme';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          LogoUrl: {
            description: 'The location of the image file used as the logo on this branding theme';
            type: 'string';
          };
          Name: {
            description: 'Name of branding theme';
            type: 'string';
          };
          SortOrder: {
            description: 'Integer – ranked order of branding theme. The default branding theme has a value of 0';
            type: 'integer';
          };
          Type: {
            description: 'Always INVOICE';
            enum: ['INVOICE'];
            type: 'string';
          };
        };
        type: 'object';
      };
      BrandingThemes: {
        properties: {
          BrandingThemes: {
            items: {
              $ref: '#/components/schemas/BrandingTheme';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      CISOrgSetting: {
        externalDocs: {
          url: 'https://developer.xero.com/documentation/api/organisation';
        };
        properties: {
          CISContractorEnabled: {
            description: 'true or false - Boolean that describes if the organisation is a CIS Contractor';
            type: 'boolean';
          };
          CISSubContractorEnabled: {
            description: 'true or false - Boolean that describes if the organisation is a CIS SubContractor';
            type: 'boolean';
          };
          Rate: {
            description: 'CIS Deduction rate for the organisation';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
        };
      };
      CISOrgSettings: {
        properties: {
          CISSettings: {
            items: {
              $ref: '#/components/schemas/CISOrgSetting';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      CISSetting: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/contacts/';
        };
        properties: {
          CISEnabled: {
            description: 'Boolean that describes if the contact is a CIS Subcontractor';
            type: 'boolean';
          };
          Rate: {
            description: 'CIS Deduction rate for the contact if he is a subcontractor. If the contact is not CISEnabled, then the rate is not returned';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
        };
      };
      CISSettings: {
        properties: {
          CISSettings: {
            items: {
              $ref: '#/components/schemas/CISSetting';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Contact: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/contacts/';
        };
        properties: {
          AccountNumber: {
            description: 'A user defined account number. This can be updated via the API and the Xero UI (max length = 50)';
            maxLength: 50;
            type: 'string';
          };
          AccountsPayableTaxType: {
            description: 'The tax type from TaxRates';
            type: 'string';
          };
          AccountsReceivableTaxType: {
            description: 'The tax type from TaxRates';
            type: 'string';
          };
          Addresses: {
            description: 'Store certain address types for a contact – see address types';
            items: {
              $ref: '#/components/schemas/Address';
            };
            type: 'array';
          };
          Attachments: {
            description: 'Displays array of attachments from the API';
            items: {
              $ref: '#/components/schemas/Attachment';
            };
            type: 'array';
          };
          Balances: {
            $ref: '#/components/schemas/Balances';
          };
          BankAccountDetails: {
            description: 'Bank account number of contact';
            type: 'string';
          };
          BatchPayments: {
            $ref: '#/components/schemas/BatchPaymentDetails';
          };
          BrandingTheme: {
            $ref: '#/components/schemas/BrandingTheme';
          };
          ContactGroups: {
            description: 'Displays which contact groups a contact is included in';
            items: {
              $ref: '#/components/schemas/ContactGroup';
            };
            type: 'array';
          };
          ContactID: {
            description: 'Xero identifier';
            format: 'uuid';
            type: 'string';
          };
          ContactNumber: {
            description: 'This can be updated via the API only i.e. This field is read only on the Xero contact screen, used to identify contacts in external systems (max length = 50). If the Contact Number is used, this is displayed as Contact Code in the Contacts UI in Xero.';
            maxLength: 50;
            type: 'string';
          };
          ContactPersons: {
            description: 'See contact persons';
            items: {
              $ref: '#/components/schemas/ContactPerson';
            };
            type: 'array';
          };
          ContactStatus: {
            description: 'Current status of a contact – see contact status types';
            enum: ['ACTIVE', 'ARCHIVED', 'GDPRREQUEST'];
            type: 'string';
          };
          DefaultCurrency: {
            $ref: '#/components/schemas/CurrencyCode';
            type: 'string';
          };
          Discount: {
            description: 'The default discount rate for the contact (read only)';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          EmailAddress: {
            description: 'Email address of contact person (umlauts not supported) (max length  = 255)';
            maxLength: 255;
            type: 'string';
          };
          FirstName: {
            description: 'First name of contact person (max length = 255)';
            maxLength: 255;
            type: 'string';
          };
          HasAttachments: {
            default: 'false';
            description: 'A boolean to indicate if a contact has an attachment';
            example: 'false';
            type: 'boolean';
          };
          HasValidationErrors: {
            default: 'false';
            description: 'A boolean to indicate if a contact has an validation errors';
            example: 'false';
            type: 'boolean';
          };
          IsCustomer: {
            description: 'true or false – Boolean that describes if a contact has any AR invoices entered against them. Cannot be set via PUT or POST – it is automatically set when an accounts receivable invoice is generated against this contact.';
            type: 'boolean';
          };
          IsSupplier: {
            description: 'true or false – Boolean that describes if a contact that has any AP  invoices entered against them. Cannot be set via PUT or POST – it is automatically set when an accounts payable invoice is generated against this contact.';
            type: 'boolean';
          };
          LastName: {
            description: 'Last name of contact person (max length = 255)';
            maxLength: 255;
            type: 'string';
          };
          Name: {
            description: 'Full name of contact/organisation (max length = 255)';
            maxLength: 255;
            type: 'string';
          };
          PaymentTerms: {
            $ref: '#/components/schemas/PaymentTerm';
          };
          Phones: {
            description: 'Store certain phone types for a contact – see phone types';
            items: {
              $ref: '#/components/schemas/Phone';
            };
            type: 'array';
          };
          PurchasesDefaultAccountCode: {
            description: 'The default purchases account code for contacts';
            type: 'string';
          };
          PurchasesTrackingCategories: {
            description: 'The default purchases tracking categories for contacts';
            items: {
              $ref: '#/components/schemas/SalesTrackingCategory';
            };
            type: 'array';
          };
          SalesDefaultAccountCode: {
            description: 'The default sales account code for contacts';
            type: 'string';
          };
          SalesTrackingCategories: {
            description: 'The default sales tracking categories for contacts';
            items: {
              $ref: '#/components/schemas/SalesTrackingCategory';
            };
            type: 'array';
          };
          SkypeUserName: {
            description: 'Skype user name of contact';
            type: 'string';
          };
          StatusAttributeString: {
            description: 'Status of object';
            type: 'string';
          };
          TaxNumber: {
            description: 'Tax number of contact – this is also known as the ABN (Australia), GST Number (New Zealand), VAT Number (UK) or Tax ID Number (US and global) in the Xero UI depending on which regionalized version of Xero you are using (max length = 50)';
            maxLength: 50;
            type: 'string';
          };
          TrackingCategoryName: {
            description: 'The name of the Tracking Category assigned to the contact under SalesTrackingCategories and PurchasesTrackingCategories';
            type: 'string';
          };
          TrackingCategoryOption: {
            description: 'The name of the Tracking Option assigned to the contact under SalesTrackingCategories and PurchasesTrackingCategories';
            type: 'string';
          };
          UpdatedDateUTC: {
            description: 'UTC timestamp of last update to contact';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          ValidationErrors: {
            description: 'Displays validation errors returned from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
          Website: {
            description: 'Website address for contact (read only)';
            readOnly: true;
            type: 'string';
          };
          XeroNetworkKey: {
            description: 'Store XeroNetworkKey for contacts.';
            type: 'string';
          };
        };
        type: 'object';
      };
      ContactGroup: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/contactgroups/';
        };
        properties: {
          ContactGroupID: {
            description: 'The Xero identifier for an contact group – specified as a string following the endpoint name. e.g. /297c2dc5-cc47-4afd-8ec8-74990b8761e9';
            format: 'uuid';
            type: 'string';
          };
          Contacts: {
            description: 'The ContactID and Name of Contacts in a contact group. Returned on GETs when the ContactGroupID is supplied in the URL.';
            items: {
              $ref: '#/components/schemas/Contact';
            };
            type: 'array';
          };
          Name: {
            description: 'The Name of the contact group. Required when creating a new contact  group';
            type: 'string';
          };
          Status: {
            description: 'The Status of a contact group. To delete a contact group update the status to DELETED. Only contact groups with a status of ACTIVE are returned on GETs.';
            enum: ['ACTIVE', 'DELETED'];
            type: 'string';
          };
        };
        type: 'object';
      };
      ContactGroups: {
        properties: {
          ContactGroups: {
            items: {
              $ref: '#/components/schemas/ContactGroup';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      ContactPerson: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/contacts/';
        };
        properties: {
          EmailAddress: {
            description: 'Email address of person';
            type: 'string';
          };
          FirstName: {
            description: 'First name of person';
            type: 'string';
          };
          IncludeInEmails: {
            description: 'boolean to indicate whether contact should be included on emails with invoices etc.';
            type: 'boolean';
          };
          LastName: {
            description: 'Last name of person';
            type: 'string';
          };
        };
        type: 'object';
      };
      Contacts: {
        properties: {
          Contacts: {
            items: {
              $ref: '#/components/schemas/Contact';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      ConversionBalances: {
        description: 'Balance supplied for each account that has a value as at the conversion date.';
        properties: {
          AccountCode: {
            description: 'The account code for a account';
            type: 'string';
          };
          Balance: {
            description: 'The opening balances of the account. Debits are positive, credits are negative values';
            format: 'double';
            type: 'number';
          };
          BalanceDetails: {
            items: {
              $ref: '#/components/schemas/BalanceDetails';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      ConversionDate: {
        description: 'The date when the organisation starts using Xero';
        properties: {
          Month: {
            description: 'The month the organisation starts using Xero. Value is an integer between 1 and 12';
            example: 1;
            type: 'integer';
          };
          Year: {
            description: 'The year the organisation starts using Xero. Value is an integer greater than 2006';
            example: 2020;
            type: 'integer';
          };
        };
        type: 'object';
      };
      CountryCode: {
        enum: [
          'AD',
          'AE',
          'AF',
          'AG',
          'AI',
          'AL',
          'AM',
          'AN',
          'AO',
          'AQ',
          'AR',
          'AS',
          'AT',
          'AU',
          'AW',
          'AZ',
          'BA',
          'BB',
          'BD',
          'BE',
          'BF',
          'BG',
          'BH',
          'BI',
          'BJ',
          'BL',
          'BM',
          'BN',
          'BO',
          'BR',
          'BS',
          'BT',
          'BW',
          'BY',
          'BZ',
          'CA',
          'CC',
          'CD',
          'CF',
          'CG',
          'CH',
          'CI',
          'CK',
          'CL',
          'CM',
          'CN',
          'CO',
          'CR',
          'CU',
          'CV',
          'CW',
          'CX',
          'CY',
          'CZ',
          'DE',
          'DJ',
          'DK',
          'DM',
          'DO',
          'DZ',
          'EC',
          'EE',
          'EG',
          'EH',
          'ER',
          'ES',
          'ET',
          'FI',
          'FJ',
          'FK',
          'FM',
          'FO',
          'FR',
          'GA',
          'GB',
          'GD',
          'GE',
          'GG',
          'GH',
          'GI',
          'GL',
          'GM',
          'GN',
          'GQ',
          'GR',
          'GT',
          'GU',
          'GW',
          'GY',
          'HK',
          'HN',
          'HR',
          'HT',
          'HU',
          'ID',
          'IE',
          'IL',
          'IM',
          'IN',
          'IO',
          'IQ',
          'IR',
          'IS',
          'IT',
          'JE',
          'JM',
          'JO',
          'JP',
          'KE',
          'KG',
          'KH',
          'KI',
          'KM',
          'KN',
          'KP',
          'KR',
          'KW',
          'KY',
          'KZ',
          'LA',
          'LB',
          'LC',
          'LI',
          'LK',
          'LR',
          'LS',
          'LT',
          'LU',
          'LV',
          'LY',
          'MA',
          'MC',
          'MD',
          'ME',
          'MF',
          'MG',
          'MH',
          'MK',
          'ML',
          'MM',
          'MN',
          'MO',
          'MP',
          'MR',
          'MS',
          'MT',
          'MU',
          'MV',
          'MW',
          'MX',
          'MY',
          'MZ',
          'NA',
          'NC',
          'NE',
          'NG',
          'NI',
          'NL',
          'NO',
          'NP',
          'NR',
          'NU',
          'NZ',
          'OM',
          'PA',
          'PE',
          'PF',
          'PG',
          'PH',
          'PK',
          'PL',
          'PM',
          'PN',
          'PR',
          'PS',
          'PT',
          'PW',
          'PY',
          'QA',
          'RE',
          'RO',
          'RS',
          'RU',
          'RW',
          'SA',
          'SB',
          'SC',
          'SD',
          'SE',
          'SG',
          'SH',
          'SI',
          'SJ',
          'SK',
          'SL',
          'SM',
          'SN',
          'SO',
          'SR',
          'SS',
          'ST',
          'SV',
          'SX',
          'SY',
          'SZ',
          'TC',
          'TD',
          'TG',
          'TH',
          'TJ',
          'TK',
          'TL',
          'TM',
          'TN',
          'TO',
          'TR',
          'TT',
          'TV',
          'TW',
          'TZ',
          'UA',
          'UG',
          'US',
          'UY',
          'UZ',
          'VA',
          'VC',
          'VE',
          'VG',
          'VI',
          'VN',
          'VU',
          'WF',
          'WS',
          'XK',
          'YE',
          'YT',
          'ZA',
          'ZM',
          'ZW',
        ];
        type: 'string';
      };
      CreditNote: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/credit-notes/';
        };
        properties: {
          Allocations: {
            description: 'See Allocations';
            items: {
              $ref: '#/components/schemas/Allocation';
            };
            type: 'array';
          };
          AppliedAmount: {
            description: 'The amount of applied to an invoice';
            example: 2;
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          BrandingThemeID: {
            description: 'See BrandingThemes';
            format: 'uuid';
            type: 'string';
          };
          CISDeduction: {
            description: 'CIS deduction for UK contractors';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          CISRate: {
            description: 'CIS Deduction rate for the organisation';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          Contact: {
            $ref: '#/components/schemas/Contact';
          };
          CreditNoteID: {
            description: 'Xero generated unique identifier';
            format: 'uuid';
            type: 'string';
          };
          CreditNoteNumber: {
            description: 'ACCRECCREDIT – Unique alpha numeric code identifying credit note (when missing will auto-generate from your Organisation Invoice Settings)';
            type: 'string';
          };
          CurrencyCode: {
            $ref: '#/components/schemas/CurrencyCode';
            description: 'The specified currency code';
            type: 'string';
          };
          CurrencyRate: {
            description: 'The currency rate for a multicurrency invoice. If no rate is specified, the XE.com day rate is used';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Date: {
            description: 'The date the credit note is issued YYYY-MM-DD. If the Date element is not specified then it will default to the current date based on the timezone setting of the organisation';
            type: 'string';
            'x-is-msdate': true;
          };
          DueDate: {
            description: 'Date invoice is due – YYYY-MM-DD';
            type: 'string';
            'x-is-msdate': true;
          };
          FullyPaidOnDate: {
            description: 'Date when credit note was fully paid(UTC format)';
            type: 'string';
            'x-is-msdate': true;
          };
          HasAttachments: {
            default: 'false';
            description: 'boolean to indicate if a credit note has an attachment';
            example: 'false';
            type: 'boolean';
          };
          HasErrors: {
            default: 'false';
            description: 'A boolean to indicate if a credit note has an validation errors';
            example: 'false';
            type: 'boolean';
          };
          LineAmountTypes: {
            $ref: '#/components/schemas/LineAmountTypes';
            type: 'string';
          };
          LineItems: {
            description: 'See Invoice Line Items';
            items: {
              $ref: '#/components/schemas/LineItem';
            };
            type: 'array';
          };
          Payments: {
            description: 'See Payments';
            items: {
              $ref: '#/components/schemas/Payment';
            };
            type: 'array';
          };
          Reference: {
            description: 'ACCRECCREDIT only – additional reference number';
            type: 'string';
          };
          RemainingCredit: {
            description: 'The remaining credit balance on the Credit Note';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          SentToContact: {
            description: 'boolean to indicate if a credit note has been sent to a contact via  the Xero app (currently read only)';
            readOnly: true;
            type: 'boolean';
          };
          Status: {
            description: 'See Credit Note Status Codes';
            enum: ['DRAFT', 'SUBMITTED', 'DELETED', 'AUTHORISED', 'PAID', 'VOIDED'];
            type: 'string';
          };
          StatusAttributeString: {
            description: 'A string to indicate if a invoice status';
            type: 'string';
          };
          SubTotal: {
            description: 'The subtotal of the credit note excluding taxes';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Total: {
            description: 'The total of the Credit Note(subtotal + total tax)';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          TotalTax: {
            description: 'The total tax on the credit note';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Type: {
            description: 'See Credit Note Types';
            enum: ['ACCPAYCREDIT', 'ACCRECCREDIT'];
            type: 'string';
          };
          UpdatedDateUTC: {
            description: 'UTC timestamp of last update to the credit note';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          ValidationErrors: {
            description: 'Displays array of validation error messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
          Warnings: {
            description: 'Displays array of warning messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      CreditNotes: {
        properties: {
          CreditNotes: {
            items: {
              $ref: '#/components/schemas/CreditNote';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Currencies: {
        properties: {
          Currencies: {
            items: {
              $ref: '#/components/schemas/Currency';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Currency: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/currencies/';
        };
        properties: {
          Code: {
            $ref: '#/components/schemas/CurrencyCode';
            type: 'string';
          };
          Description: {
            description: 'Name of Currency';
            type: 'string';
          };
        };
        type: 'object';
      };
      CurrencyCode: {
        description: '3 letter alpha code for the currency – see list of currency codes';
        enum: [
          'AED',
          'AFN',
          'ALL',
          'AMD',
          'ANG',
          'AOA',
          'ARS',
          'AUD',
          'AWG',
          'AZN',
          'BAM',
          'BBD',
          'BDT',
          'BGN',
          'BHD',
          'BIF',
          'BMD',
          'BND',
          'BOB',
          'BRL',
          'BSD',
          'BTN',
          'BWP',
          'BYN',
          'BYR',
          'BZD',
          'CAD',
          'CDF',
          'CHF',
          'CLP',
          'CNY',
          'COP',
          'CRC',
          'CUC',
          'CUP',
          'CVE',
          'CZK',
          'DJF',
          'DKK',
          'DOP',
          'DZD',
          'EGP',
          'ERN',
          'ETB',
          'EUR',
          'FJD',
          'FKP',
          'GBP',
          'GEL',
          'GGP',
          'GHS',
          'GIP',
          'GMD',
          'GNF',
          'GTQ',
          'GYD',
          'HKD',
          'HNL',
          'HRK',
          'HTG',
          'HUF',
          'IDR',
          'ILS',
          'IMP',
          'INR',
          'IQD',
          'IRR',
          'ISK',
          'JEP',
          'JMD',
          'JOD',
          'JPY',
          'KES',
          'KGS',
          'KHR',
          'KMF',
          'KPW',
          'KRW',
          'KWD',
          'KYD',
          'KZT',
          'LAK',
          'LBP',
          'LKR',
          'LRD',
          'LSL',
          'LTL',
          'LYD',
          'MAD',
          'MDL',
          'MGA',
          'MKD',
          'MMK',
          'MNT',
          'MOP',
          'MRU',
          'MUR',
          'MVR',
          'MWK',
          'MXN',
          'MYR',
          'MZN',
          'NAD',
          'NGN',
          'NIO',
          'NOK',
          'NPR',
          'NZD',
          'OMR',
          'PAB',
          'PEN',
          'PGK',
          'PHP',
          'PKR',
          'PLN',
          'PYG',
          'QAR',
          'RON',
          'RSD',
          'RUB',
          'RWF',
          'SAR',
          'SBD',
          'SCR',
          'SDG',
          'SEK',
          'SGD',
          'SHP',
          'SLL',
          'SOS',
          'SPL',
          'SRD',
          'STN',
          'SVC',
          'SYP',
          'SZL',
          'THB',
          'TJS',
          'TMT',
          'TND',
          'TOP',
          'TRY',
          'TTD',
          'TVD',
          'TWD',
          'TZS',
          'UAH',
          'UGX',
          'USD',
          'UYU',
          'UZS',
          'VEF',
          'VND',
          'VUV',
          'WST',
          'XAF',
          'XCD',
          'XDR',
          'XOF',
          'XPF',
          'YER',
          'ZAR',
          'ZMW',
          'ZMK',
          'ZWD',
          '',
        ];
        type: 'string';
        'x-enum-varnames': [
          'AED',
          'AFN',
          'ALL',
          'AMD',
          'ANG',
          'AOA',
          'ARS',
          'AUD',
          'AWG',
          'AZN',
          'BAM',
          'BBD',
          'BDT',
          'BGN',
          'BHD',
          'BIF',
          'BMD',
          'BND',
          'BOB',
          'BRL',
          'BSD',
          'BTN',
          'BWP',
          'BYN',
          'BYR',
          'BZD',
          'CAD',
          'CDF',
          'CHF',
          'CLP',
          'CNY',
          'COP',
          'CRC',
          'CUC',
          'CUP',
          'CVE',
          'CZK',
          'DJF',
          'DKK',
          'DOP',
          'DZD',
          'EGP',
          'ERN',
          'ETB',
          'EUR',
          'FJD',
          'FKP',
          'GBP',
          'GEL',
          'GGP',
          'GHS',
          'GIP',
          'GMD',
          'GNF',
          'GTQ',
          'GYD',
          'HKD',
          'HNL',
          'HRK',
          'HTG',
          'HUF',
          'IDR',
          'ILS',
          'IMP',
          'INR',
          'IQD',
          'IRR',
          'ISK',
          'JEP',
          'JMD',
          'JOD',
          'JPY',
          'KES',
          'KGS',
          'KHR',
          'KMF',
          'KPW',
          'KRW',
          'KWD',
          'KYD',
          'KZT',
          'LAK',
          'LBP',
          'LKR',
          'LRD',
          'LSL',
          'LTL',
          'LYD',
          'MAD',
          'MDL',
          'MGA',
          'MKD',
          'MMK',
          'MNT',
          'MOP',
          'MRU',
          'MUR',
          'MVR',
          'MWK',
          'MXN',
          'MYR',
          'MZN',
          'NAD',
          'NGN',
          'NIO',
          'NOK',
          'NPR',
          'NZD',
          'OMR',
          'PAB',
          'PEN',
          'PGK',
          'PHP',
          'PKR',
          'PLN',
          'PYG',
          'QAR',
          'RON',
          'RSD',
          'RUB',
          'RWF',
          'SAR',
          'SBD',
          'SCR',
          'SDG',
          'SEK',
          'SGD',
          'SHP',
          'SLL',
          'SOS',
          'SPL',
          'SRD',
          'STN',
          'SVC',
          'SYP',
          'SZL',
          'THB',
          'TJS',
          'TMT',
          'TND',
          'TOP',
          'TRY_LIRA',
          'TTD',
          'TVD',
          'TWD',
          'TZS',
          'UAH',
          'UGX',
          'USD',
          'UYU',
          'UZS',
          'VEF',
          'VND',
          'VUV',
          'WST',
          'XAF',
          'XCD',
          'XDR',
          'XOF',
          'XPF',
          'YER',
          'ZAR',
          'ZMW',
          'ZMK',
          'ZWD',
          'EMPTY_CURRENCY',
        ];
      };
      Element: {
        externalDocs: {
          url: 'https://developer.xero.com/documentation/api/http-response-codes';
        };
        properties: {
          BankTransactionID: {
            format: 'uuid';
            type: 'string';
          };
          BatchPaymentID: {
            description: 'Unique ID for batch payment object with validation error';
            format: 'uuid';
            type: 'string';
          };
          ContactID: {
            format: 'uuid';
            type: 'string';
          };
          CreditNoteID: {
            format: 'uuid';
            type: 'string';
          };
          InvoiceID: {
            format: 'uuid';
            type: 'string';
          };
          ItemID: {
            format: 'uuid';
            type: 'string';
          };
          PurchaseOrderID: {
            format: 'uuid';
            type: 'string';
          };
          ValidationErrors: {
            description: 'Array of Validation Error message';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      Employee: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/employees/';
        };
        properties: {
          EmployeeID: {
            description: 'The Xero identifier for an employee e.g. 297c2dc5-cc47-4afd-8ec8-74990b8761e9';
            format: 'uuid';
            type: 'string';
          };
          ExternalLink: {
            $ref: '#/components/schemas/ExternalLink';
          };
          FirstName: {
            description: 'First name of an employee (max length = 255)';
            maxLength: 255;
            type: 'string';
          };
          LastName: {
            description: 'Last name of an employee (max length = 255)';
            maxLength: 255;
            type: 'string';
          };
          Status: {
            description: 'Current status of an employee – see contact status types';
            enum: ['ACTIVE', 'ARCHIVED', 'GDPRREQUEST', 'DELETED'];
            type: 'string';
          };
          StatusAttributeString: {
            description: 'A string to indicate if a invoice status';
            example: 'ERROR';
            type: 'string';
          };
          UpdatedDateUTC: {
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          ValidationErrors: {
            description: 'Displays array of validation error messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      Employees: {
        properties: {
          Employees: {
            items: {
              $ref: '#/components/schemas/Employee';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Error: {
        externalDocs: {
          url: 'https://developer.xero.com/documentation/api/http-response-codes';
        };
        properties: {
          Elements: {
            description: 'Array of Elements of validation Errors';
            items: {
              $ref: '#/components/schemas/Element';
            };
            type: 'array';
          };
          ErrorNumber: {
            description: 'Exception number';
            type: 'integer';
          };
          Message: {
            description: 'Exception message';
            type: 'string';
          };
          Type: {
            description: 'Exception type';
            type: 'string';
          };
        };
        type: 'object';
      };
      ExpenseClaim: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/expense-claims/';
        };
        properties: {
          AmountDue: {
            description: 'The amount due to be paid for an expense claim';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          AmountPaid: {
            description: 'The amount still to pay for an expense claim';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          ExpenseClaimID: {
            description: 'Xero generated unique identifier for an expense claim';
            format: 'uuid';
            type: 'string';
          };
          PaymentDueDate: {
            description: 'The date when the expense claim is due to be paid YYYY-MM-DD';
            readOnly: true;
            type: 'string';
            'x-is-msdate': true;
          };
          Payments: {
            description: 'See Payments';
            items: {
              $ref: '#/components/schemas/Payment';
            };
            type: 'array';
          };
          ReceiptID: {
            description: 'The Xero identifier for the Receipt e.g. e59a2c7f-1306-4078-a0f3-73537afcbba9';
            format: 'uuid';
            type: 'string';
          };
          Receipts: {
            items: {
              $ref: '#/components/schemas/Receipt';
            };
            type: 'array';
          };
          ReportingDate: {
            description: 'The date the expense claim will be reported in Xero YYYY-MM-DD';
            readOnly: true;
            type: 'string';
            'x-is-msdate': true;
          };
          Status: {
            description: 'Current status of an expense claim – see status types';
            enum: ['SUBMITTED', 'AUTHORISED', 'PAID', 'VOIDED', 'DELETED'];
            type: 'string';
          };
          Total: {
            description: 'The total of an expense claim being paid';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          UpdatedDateUTC: {
            description: 'Last modified date UTC format';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          User: {
            $ref: '#/components/schemas/User';
          };
        };
        type: 'object';
      };
      ExpenseClaims: {
        properties: {
          ExpenseClaims: {
            items: {
              $ref: '#/components/schemas/ExpenseClaim';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      ExternalLink: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/organisation/';
        };
        properties: {
          Description: {
            type: 'string';
          };
          LinkType: {
            description: 'See External link types';
            enum: ['Facebook', 'GooglePlus', 'LinkedIn', 'Twitter', 'Website'];
            type: 'string';
          };
          Url: {
            description: 'URL for service e.g. http://twitter.com/xeroapi';
            type: 'string';
          };
        };
        type: 'object';
      };
      HistoryRecord: {
        externalDocs: {
          url: 'https://developer.xero.com/documentation/api/history-and-notes';
        };
        properties: {
          Changes: {
            description: 'Name of branding theme';
            type: 'string';
          };
          DateUTC: {
            description: 'UTC timestamp of creation date of branding theme';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          Details: {
            description: 'details';
            type: 'string';
          };
          User: {
            description: 'has a value of 0';
            type: 'string';
          };
        };
        type: 'object';
      };
      HistoryRecords: {
        properties: {
          HistoryRecords: {
            items: {
              $ref: '#/components/schemas/HistoryRecord';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      ImportSummary: {
        description: 'A summary of the import from setup endpoint';
        externalDocs: {
          url: 'https://developer.xero.com/documentation/api-guides/conversions';
        };
        properties: {
          Accounts: {
            $ref: '#/components/schemas/ImportSummaryAccounts';
          };
          Organisation: {
            $ref: '#/components/schemas/ImportSummaryOrganisation';
          };
        };
        type: 'object';
      };
      ImportSummaryAccounts: {
        description: 'A summary of the accounts changes';
        properties: {
          Deleted: {
            description: 'The number of accounts deleted';
            format: 'integer';
            type: 'number';
          };
          Errored: {
            description: 'The number of accounts that had an error';
            format: 'integer';
            type: 'number';
          };
          Locked: {
            description: 'The number of locked accounts';
            format: 'integer';
            type: 'number';
          };
          New: {
            description: 'The number of new accounts created';
            format: 'integer';
            type: 'number';
          };
          NewOrUpdated: {
            description: 'The number of new or updated accounts';
            format: 'integer';
            type: 'number';
          };
          Present: {
            type: 'boolean';
          };
          System: {
            description: 'The number of system accounts';
            format: 'integer';
            type: 'number';
          };
          Total: {
            description: 'The total number of accounts in the org';
            format: 'integer';
            type: 'number';
          };
          Updated: {
            description: 'The number of accounts updated';
            format: 'integer';
            type: 'number';
          };
        };
        type: 'object';
      };
      ImportSummaryObject: {
        externalDocs: {
          url: 'https://developer.xero.com/documentation/api-guides/conversions';
        };
        properties: {
          ImportSummary: {
            $ref: '#/components/schemas/ImportSummary';
          };
        };
      };
      ImportSummaryOrganisation: {
        properties: {
          Present: {
            type: 'boolean';
          };
        };
        type: 'object';
      };
      Invoice: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/invoices/';
        };
        properties: {
          AmountCredited: {
            description: 'Sum of all credit notes, over-payments and pre-payments applied to invoice';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          AmountDue: {
            description: 'Amount remaining to be paid on invoice';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          AmountPaid: {
            description: 'Sum of payments received for invoice';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          Attachments: {
            description: 'Displays array of attachments from the API';
            items: {
              $ref: '#/components/schemas/Attachment';
            };
            type: 'array';
          };
          BrandingThemeID: {
            description: 'See BrandingThemes';
            format: 'uuid';
            type: 'string';
          };
          CISDeduction: {
            description: 'CIS deduction for UK contractors';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          CISRate: {
            description: 'CIS Deduction rate for the organisation';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          Contact: {
            $ref: '#/components/schemas/Contact';
          };
          CreditNotes: {
            description: 'Details of credit notes that have been applied to an invoice';
            items: {
              $ref: '#/components/schemas/CreditNote';
            };
            readOnly: true;
            type: 'array';
          };
          CurrencyCode: {
            $ref: '#/components/schemas/CurrencyCode';
            type: 'string';
          };
          CurrencyRate: {
            description: 'The currency rate for a multicurrency invoice. If no rate is specified, the XE.com day rate is used. (max length = [18].[6])';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Date: {
            description: 'Date invoice was issued – YYYY-MM-DD. If the Date element is not specified it will default to the current date based on the timezone setting of the organisation';
            type: 'string';
            'x-is-msdate': true;
          };
          DueDate: {
            description: 'Date invoice is due – YYYY-MM-DD';
            type: 'string';
            'x-is-msdate': true;
          };
          ExpectedPaymentDate: {
            description: 'Shown on sales invoices (Accounts Receivable) when this has been set';
            type: 'string';
            'x-is-msdate': true;
          };
          FullyPaidOnDate: {
            description: 'The date the invoice was fully paid. Only returned on fully paid invoices';
            readOnly: true;
            type: 'string';
            'x-is-msdate': true;
          };
          HasAttachments: {
            default: 'false';
            description: 'boolean to indicate if an invoice has an attachment';
            example: 'false';
            readOnly: true;
            type: 'boolean';
          };
          HasErrors: {
            default: 'false';
            description: 'A boolean to indicate if a invoice has an validation errors';
            example: 'false';
            type: 'boolean';
          };
          InvoiceID: {
            description: 'Xero generated unique identifier for invoice';
            format: 'uuid';
            type: 'string';
          };
          InvoiceNumber: {
            description: 'ACCREC – Unique alpha numeric code identifying invoice (when missing will auto-generate from your Organisation Invoice Settings) (max length = 255)';
            maxLength: 255;
            type: 'string';
          };
          IsDiscounted: {
            description: 'boolean to indicate if an invoice has a discount';
            readOnly: true;
            type: 'boolean';
          };
          LineAmountTypes: {
            $ref: '#/components/schemas/LineAmountTypes';
            type: 'string';
          };
          LineItems: {
            description: 'See LineItems';
            items: {
              $ref: '#/components/schemas/LineItem';
            };
            type: 'array';
          };
          Overpayments: {
            description: 'See Overpayments';
            items: {
              $ref: '#/components/schemas/Overpayment';
            };
            readOnly: true;
            type: 'array';
          };
          Payments: {
            description: 'See Payments';
            items: {
              $ref: '#/components/schemas/Payment';
            };
            readOnly: true;
            type: 'array';
          };
          PlannedPaymentDate: {
            description: 'Shown on bills (Accounts Payable) when this has been set';
            type: 'string';
            'x-is-msdate': true;
          };
          Prepayments: {
            description: 'See Prepayments';
            items: {
              $ref: '#/components/schemas/Prepayment';
            };
            readOnly: true;
            type: 'array';
          };
          Reference: {
            description: 'ACCREC only – additional reference number';
            type: 'string';
          };
          RepeatingInvoiceID: {
            description: 'Xero generated unique identifier for repeating invoices';
            format: 'uuid';
            type: 'string';
          };
          SentToContact: {
            description: 'Boolean to set whether the invoice in the Xero app should be marked as “sent”. This can be set only on invoices that have been approved';
            type: 'boolean';
          };
          Status: {
            description: 'See Invoice Status Codes';
            enum: ['DRAFT', 'SUBMITTED', 'DELETED', 'AUTHORISED', 'PAID', 'VOIDED'];
            type: 'string';
          };
          StatusAttributeString: {
            description: 'A string to indicate if a invoice status';
            type: 'string';
          };
          SubTotal: {
            description: 'Total of invoice excluding taxes';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          Total: {
            description: 'Total of Invoice tax inclusive (i.e. SubTotal + TotalTax). This will be ignored if it doesn’t equal the sum of the LineAmounts';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          TotalDiscount: {
            description: 'Total of discounts applied on the invoice line items';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          TotalTax: {
            description: 'Total tax on invoice';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          Type: {
            description: 'See Invoice Types';
            enum: [
              'ACCPAY',
              'ACCPAYCREDIT',
              'APOVERPAYMENT',
              'APPREPAYMENT',
              'ACCREC',
              'ACCRECCREDIT',
              'AROVERPAYMENT',
              'ARPREPAYMENT',
            ];
            type: 'string';
          };
          UpdatedDateUTC: {
            description: 'Last modified date UTC format';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          Url: {
            description: 'URL link to a source document – shown as “Go to [appName]” in the Xero app';
            type: 'string';
          };
          ValidationErrors: {
            description: 'Displays array of validation error messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
          Warnings: {
            description: 'Displays array of warning messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      InvoiceReminder: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/invoice-reminders/';
        };
        properties: {
          Enabled: {
            description: 'setting for on or off';
            type: 'boolean';
          };
        };
        type: 'object';
      };
      InvoiceReminders: {
        properties: {
          InvoiceReminders: {
            items: {
              $ref: '#/components/schemas/InvoiceReminder';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Invoices: {
        properties: {
          Invoices: {
            items: {
              $ref: '#/components/schemas/Invoice';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Item: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/items/';
        };
        properties: {
          Code: {
            description: 'User defined item code (max length = 30)';
            maxLength: 30;
            type: 'string';
          };
          Description: {
            description: 'The sales description of the item (max length = 4000)';
            maxLength: 4000;
            type: 'string';
          };
          InventoryAssetAccountCode: {
            description: 'The inventory asset account for the item. The account must be of type INVENTORY. The  COGSAccountCode in PurchaseDetails is also required to create a tracked item';
            type: 'string';
          };
          IsPurchased: {
            description: 'Boolean value, defaults to true. When IsPurchased is true the item is available for purchase transactions in the Xero UI. If IsPurchased is updated to false then PurchaseDescription and PurchaseDetails values will be nulled.';
            type: 'boolean';
          };
          IsSold: {
            description: 'Boolean value, defaults to true. When IsSold is true the item will be available on sales transactions in the Xero UI. If IsSold is updated to false then Description and SalesDetails values will be nulled.';
            type: 'boolean';
          };
          IsTrackedAsInventory: {
            description: 'True for items that are tracked as inventory. An item will be tracked as inventory if the InventoryAssetAccountCode and COGSAccountCode are set.';
            type: 'boolean';
          };
          ItemID: {
            description: 'The Xero identifier for an Item';
            format: 'uuid';
            type: 'string';
          };
          Name: {
            description: 'The name of the item (max length = 50)';
            maxLength: 50;
            type: 'string';
          };
          PurchaseDescription: {
            description: 'The purchase description of the item (max length = 4000)';
            maxLength: 4000;
            type: 'string';
          };
          PurchaseDetails: {
            $ref: '#/components/schemas/Purchase';
          };
          QuantityOnHand: {
            description: 'The quantity of the item on hand';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          SalesDetails: {
            $ref: '#/components/schemas/Purchase';
          };
          StatusAttributeString: {
            description: 'Status of object';
            type: 'string';
          };
          TotalCostPool: {
            description: 'The value of the item on hand. Calculated using average cost accounting.';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          UpdatedDateUTC: {
            description: 'Last modified date in UTC format';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          ValidationErrors: {
            description: 'Displays array of validation error messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
        };
        required: ['Code'];
        type: 'object';
      };
      Items: {
        properties: {
          Items: {
            items: {
              $ref: '#/components/schemas/Item';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Journal: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/journals/';
        };
        properties: {
          CreatedDateUTC: {
            description: 'Created date UTC format';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          JournalDate: {
            description: 'Date the journal was posted';
            type: 'string';
            'x-is-msdate': true;
          };
          JournalID: {
            description: 'Xero identifier';
            format: 'uuid';
            type: 'string';
          };
          JournalLines: {
            description: 'See JournalLines';
            items: {
              $ref: '#/components/schemas/JournalLine';
            };
            type: 'array';
          };
          JournalNumber: {
            description: 'Xero generated journal number';
            type: 'integer';
          };
          Reference: {
            description: 'reference field for additional indetifying information';
            type: 'string';
          };
          SourceID: {
            description: 'The identifier for the source transaction (e.g. InvoiceID)';
            format: 'uuid';
            type: 'string';
          };
          SourceType: {
            description: 'The journal source type. The type of transaction that created the journal';
            enum: [
              'ACCREC',
              'ACCPAY',
              'ACCRECCREDIT',
              'ACCPAYCREDIT',
              'ACCRECPAYMENT',
              'ACCPAYPAYMENT',
              'ARCREDITPAYMENT',
              'APCREDITPAYMENT',
              'CASHREC',
              'CASHPAID',
              'TRANSFER',
              'ARPREPAYMENT',
              'APPREPAYMENT',
              'AROVERPAYMENT',
              'APOVERPAYMENT',
              'EXPCLAIM',
              'EXPPAYMENT',
              'MANJOURNAL',
              'PAYSLIP',
              'WAGEPAYABLE',
              'INTEGRATEDPAYROLLPE',
              'INTEGRATEDPAYROLLPT',
              'EXTERNALSPENDMONEY',
              'INTEGRATEDPAYROLLPTPAYMENT',
              'INTEGRATEDPAYROLLCN',
            ];
            type: 'string';
          };
        };
        type: 'object';
      };
      JournalLine: {
        externalDocs: {
          url: 'https://developer.xero.com/documentation/api/journals#JournalLines';
        };
        properties: {
          AccountCode: {
            description: 'See Accounts';
            example: 90;
            type: 'string';
          };
          AccountID: {
            description: 'See Accounts';
            example: 'ceef66a5-a545-413b-9312-78a53caadbc4';
            format: 'uuid';
            type: 'string';
          };
          AccountName: {
            description: 'See AccountCodes';
            example: 'Checking Account';
            type: 'string';
          };
          AccountType: {
            $ref: '#/components/schemas/AccountType';
            type: 'string';
          };
          Description: {
            description: 'The description from the source transaction line item. Only returned if populated.';
            example: 'My business checking account';
            type: 'string';
          };
          GrossAmount: {
            description: 'Gross amount of journal line (NetAmount + TaxAmount).';
            example: 4130.98;
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          JournalLineID: {
            description: 'Xero identifier for Journal';
            example: '7be9db36-3598-4755-ba5c-c2dbc8c4a7a2';
            format: 'uuid';
            type: 'string';
          };
          NetAmount: {
            description: 'Net amount of journal line. This will be a positive value for a debit and negative for a credit';
            example: 4130.98;
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          TaxAmount: {
            description: 'Total tax on a journal line';
            example: 0;
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          TaxName: {
            description: 'see TaxRates';
            example: 'Tax Exempt';
            type: 'string';
          };
          TaxType: {
            description: 'The tax type from TaxRates';
            type: 'string';
          };
          TrackingCategories: {
            description: 'Optional Tracking Category – see Tracking. Any JournalLine can have a maximum of 2 <TrackingCategory> elements.';
            items: {
              $ref: '#/components/schemas/TrackingCategory';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      Journals: {
        properties: {
          Journals: {
            items: {
              $ref: '#/components/schemas/Journal';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      LineAmountTypes: {
        description: 'Line amounts are exclusive of tax by default if you don’t specify this element. See Line Amount Types';
        enum: ['Exclusive', 'Inclusive', 'NoTax'];
        type: 'string';
      };
      LineItem: {
        externalDocs: {
          url: 'https://developer.xero.com/documentation/api/invoices#post';
        };
        properties: {
          AccountCode: {
            description: 'See Accounts';
            type: 'string';
          };
          Description: {
            description: 'Description needs to be at least 1 char long. A line item with just a description (i.e no unit amount or quantity) can be created by specifying just a <Description> element that contains at least 1 character';
            type: 'string';
          };
          DiscountAmount: {
            description: 'Discount amount being applied to a line item. Only supported on ACCREC invoices - ACCPAY invoices and credit notes in Xero do not support discounts.';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          DiscountRate: {
            description: 'Percentage discount being applied to a line item (only supported on  ACCREC invoices – ACC PAY invoices and credit notes in Xero do not support discounts';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          ItemCode: {
            description: 'See Items';
            type: 'string';
          };
          LineAmount: {
            description: 'If you wish to omit either of the <Quantity> or <UnitAmount> you can provide a LineAmount and Xero will calculate the missing amount for you. The line amount reflects the discounted price if a DiscountRate has been used . i.e LineAmount = Quantity * Unit Amount * ((100 – DiscountRate)/100)';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          LineItemID: {
            description: 'LineItem unique ID';
            example: '00000000-0000-0000-0000-000000000000';
            format: 'uuid';
            type: 'string';
          };
          Quantity: {
            description: 'LineItem Quantity';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          RepeatingInvoiceID: {
            description: 'The Xero identifier for a Repeating Invoice';
            example: '00000000-0000-0000-0000-000000000000';
            format: 'uuid';
            type: 'string';
          };
          TaxAmount: {
            description: 'The tax amount is auto calculated as a percentage of the line amount (see below) based on the tax rate. This value can be overriden if the calculated <TaxAmount> is not correct.';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          TaxType: {
            description: 'The tax type from TaxRates';
            type: 'string';
          };
          Tracking: {
            description: 'Optional Tracking Category – see Tracking.  Any LineItem can have a  maximum of 2 <TrackingCategory> elements.';
            items: {
              $ref: '#/components/schemas/LineItemTracking';
            };
            type: 'array';
          };
          UnitAmount: {
            description: 'LineItem Unit Amount';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
        };
        type: 'object';
      };
      LineItemTracking: {
        externalDocs: {
          url: 'https://developer.xero.com/documentation/api/invoices#post';
        };
        properties: {
          Name: {
            description: 'The name of the tracking category';
            example: 'Region';
            maxLength: 100;
            type: 'string';
          };
          Option: {
            description: 'See Tracking Options';
            example: 'North';
            type: 'string';
          };
          TrackingCategoryID: {
            description: 'The Xero identifier for a tracking category';
            example: '00000000-0000-0000-0000-000000000000';
            format: 'uuid';
            type: 'string';
          };
          TrackingOptionID: {
            description: 'The Xero identifier for a tracking category option';
            example: '00000000-0000-0000-0000-000000000000';
            format: 'uuid';
            type: 'string';
          };
        };
        type: 'object';
      };
      LinkedTransaction: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/linked-transactions/';
        };
        properties: {
          ContactID: {
            description: 'Filter by the combination of ContactID and Status. Get all the linked transactions that have been assigned to a particular customer and have a particular status e.g. GET /LinkedTransactions?ContactID=4bb34b03-3378-4bb2-a0ed-6345abf3224e&Status=APPROVED.';
            format: 'uuid';
            type: 'string';
          };
          LinkedTransactionID: {
            description: 'The Xero identifier for an Linked Transaction e.g./LinkedTransactions/297c2dc5-cc47-4afd-8ec8-74990b8761e9';
            format: 'uuid';
            type: 'string';
          };
          SourceLineItemID: {
            description: 'The line item identifier from the source transaction.';
            format: 'uuid';
            type: 'string';
          };
          SourceTransactionID: {
            description: 'Filter by the SourceTransactionID. Get all the linked transactions created from a particular ACCPAY invoice';
            format: 'uuid';
            type: 'string';
          };
          SourceTransactionTypeCode: {
            description: 'The Type of the source tranasction. This will be ACCPAY if the linked transaction was created from an invoice and SPEND if it was created from a bank transaction.';
            enum: ['ACCPAY', 'SPEND'];
            type: 'string';
          };
          Status: {
            description: 'Filter by the combination of ContactID and Status. Get all the linked transactions that have been assigned to a particular customer and have a particular status e.g. GET /LinkedTransactions?ContactID=4bb34b03-3378-4bb2-a0ed-6345abf3224e&Status=APPROVED.';
            enum: ['APPROVED', 'DRAFT', 'ONDRAFT', 'BILLED', 'VOIDED'];
            type: 'string';
          };
          TargetLineItemID: {
            description: 'The line item identifier from the target transaction. It is possible  to link multiple billable expenses to the same TargetLineItemID.';
            format: 'uuid';
            type: 'string';
          };
          TargetTransactionID: {
            description: 'Filter by the TargetTransactionID. Get all the linked transactions  allocated to a particular ACCREC invoice';
            format: 'uuid';
            type: 'string';
          };
          Type: {
            description: 'This will always be BILLABLEEXPENSE. More types may be added in future.';
            enum: ['BILLABLEEXPENSE'];
            type: 'string';
          };
          UpdatedDateUTC: {
            description: 'The last modified date in UTC format';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          ValidationErrors: {
            description: 'Displays array of validation error messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      LinkedTransactions: {
        properties: {
          LinkedTransactions: {
            items: {
              $ref: '#/components/schemas/LinkedTransaction';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      ManualJournal: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/manual-journals/';
        };
        properties: {
          Attachments: {
            description: 'Displays array of attachments from the API';
            items: {
              $ref: '#/components/schemas/Attachment';
            };
            type: 'array';
          };
          Date: {
            description: 'Date journal was posted – YYYY-MM-DD';
            type: 'string';
            'x-is-msdate': true;
          };
          HasAttachments: {
            default: 'false';
            description: 'Boolean to indicate if a manual journal has an attachment';
            example: 'false';
            readOnly: true;
            type: 'boolean';
          };
          JournalLines: {
            description: 'See JournalLines';
            items: {
              $ref: '#/components/schemas/ManualJournalLine';
            };
            type: 'array';
          };
          LineAmountTypes: {
            $ref: '#/components/schemas/LineAmountTypes';
            type: 'string';
          };
          ManualJournalID: {
            description: 'The Xero identifier for a Manual Journal';
            format: 'uuid';
            type: 'string';
          };
          Narration: {
            description: 'Description of journal being posted';
            type: 'string';
          };
          ShowOnCashBasisReports: {
            description: 'Boolean – default is true if not specified';
            type: 'boolean';
          };
          Status: {
            description: 'See Manual Journal Status Codes';
            enum: ['DRAFT', 'POSTED', 'DELETED', 'VOIDED', 'ARCHIVED'];
            type: 'string';
          };
          StatusAttributeString: {
            description: 'A string to indicate if a invoice status';
            example: 'ERROR';
            type: 'string';
          };
          UpdatedDateUTC: {
            description: 'Last modified date UTC format';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          Url: {
            description: 'Url link to a source document – shown as “Go to [appName]” in the Xero app';
            type: 'string';
          };
          ValidationErrors: {
            description: 'Displays array of validation error messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
          Warnings: {
            description: 'Displays array of warning messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
        };
        required: ['Narration'];
        type: 'object';
      };
      ManualJournalLine: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/manual-journals/';
        };
        properties: {
          AccountCode: {
            description: 'See Accounts';
            example: 720;
            type: 'string';
          };
          AccountID: {
            description: 'See Accounts';
            format: 'uuid';
            type: 'string';
          };
          Description: {
            description: 'Description for journal line';
            example: 'Coded incorrectly Office Equipment should be Computer Equipment';
            type: 'string';
          };
          IsBlank: {
            description: 'is the line blank';
            example: false;
            type: 'boolean';
          };
          LineAmount: {
            description: 'total for line. Debits are positive, credits are negative value';
            example: -2569;
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          TaxAmount: {
            description: 'The calculated tax amount based on the TaxType and LineAmount';
            example: 0;
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          TaxType: {
            description: 'The tax type from TaxRates';
            type: 'string';
          };
          Tracking: {
            description: 'Optional Tracking Category – see Tracking. Any JournalLine can have a maximum of 2 <TrackingCategory> elements.';
            items: {
              $ref: '#/components/schemas/TrackingCategory';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      ManualJournals: {
        properties: {
          ManualJournals: {
            items: {
              $ref: '#/components/schemas/ManualJournal';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      OnlineInvoice: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/invoices/';
        };
        properties: {
          OnlineInvoiceUrl: {
            description: 'the URL to an online invoice';
            type: 'string';
          };
        };
        type: 'object';
      };
      OnlineInvoices: {
        properties: {
          OnlineInvoices: {
            items: {
              $ref: '#/components/schemas/OnlineInvoice';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Organisation: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/organisation/';
        };
        properties: {
          APIKey: {
            description: 'Display a unique key used for Xero-to-Xero transactions';
            type: 'string';
          };
          Addresses: {
            description: 'Address details for organisation – see Addresses';
            items: {
              $ref: '#/components/schemas/AddressForOrganisation';
            };
            type: 'array';
          };
          BaseCurrency: {
            $ref: '#/components/schemas/CurrencyCode';
            type: 'string';
          };
          Class: {
            description: 'Organisation Classes describe which plan the Xero organisation is on (e.g. DEMO, TRIAL, PREMIUM)';
            enum: [
              'DEMO',
              'TRIAL',
              'STARTER',
              'STANDARD',
              'PREMIUM',
              'PREMIUM_20',
              'PREMIUM_50',
              'PREMIUM_100',
              'LEDGER',
              'GST_CASHBOOK',
              'NON_GST_CASHBOOK',
            ];
            type: 'string';
          };
          CountryCode: {
            $ref: '#/components/schemas/CountryCode';
            type: 'string';
          };
          CreatedDateUTC: {
            description: 'Timestamp when the organisation was created in Xero';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          DefaultPurchasesTax: {
            description: 'The default for LineAmountTypes on purchase transactions';
            type: 'string';
          };
          DefaultSalesTax: {
            description: 'The default for LineAmountTypes on sales transactions';
            type: 'string';
          };
          Edition: {
            description: 'BUSINESS or PARTNER. Partner edition organisations are sold exclusively through accounting partners and have restricted functionality (e.g. no access to invoicing)';
            enum: ['BUSINESS', 'PARTNER'];
            type: 'string';
          };
          EmployerIdentificationNumber: {
            description: 'Shown if set. US Only.';
            type: 'string';
          };
          EndOfYearLockDate: {
            description: 'Shown if set. See lock dates';
            type: 'string';
            'x-is-msdate': true;
          };
          ExternalLinks: {
            description: 'Organisation profile links for popular services such as Facebook,Twitter, GooglePlus and LinkedIn. You can also add link to your website here. Shown if Organisation settings  is updated in Xero. See ExternalLinks below';
            items: {
              $ref: '#/components/schemas/ExternalLink';
            };
            type: 'array';
          };
          FinancialYearEndDay: {
            description: 'Calendar day e.g. 0-31';
            type: 'integer';
          };
          FinancialYearEndMonth: {
            description: 'Calendar Month e.g. 1-12';
            type: 'integer';
          };
          IsDemoCompany: {
            description: 'Boolean to describe if organisation is a demo company.';
            type: 'boolean';
          };
          LegalName: {
            description: 'Organisation name shown on Reports';
            type: 'string';
          };
          LineOfBusiness: {
            description: 'Description of business type as defined in Organisation settings';
            type: 'string';
          };
          Name: {
            description: 'Display name of organisation shown in Xero';
            type: 'string';
          };
          OrganisationEntityType: {
            description: 'Organisation Entity Type';
            enum: [
              'ACCOUNTING_PRACTICE',
              'COMPANY',
              'CHARITY',
              'CLUB_OR_SOCIETY',
              'LOOK_THROUGH_COMPANY',
              'NOT_FOR_PROFIT',
              'PARTNERSHIP',
              'S_CORPORATION',
              'SELF_MANAGED_SUPERANNUATION_FUND',
              'SOLE_TRADER',
              'SUPERANNUATION_FUND',
              'TRUST',
            ];
            type: 'string';
          };
          OrganisationID: {
            description: 'Unique Xero identifier';
            example: '8be9db36-3598-4755-ba5c-c2dbc8c4a7a2';
            format: 'uuid';
            type: 'string';
          };
          OrganisationStatus: {
            description: 'Will be set to ACTIVE if you can connect to organisation via the Xero API';
            type: 'string';
          };
          OrganisationType: {
            description: 'Organisation Type';
            enum: [
              'ACCOUNTING_PRACTICE',
              'COMPANY',
              'CHARITY',
              'CLUB_OR_SOCIETY',
              'LOOK_THROUGH_COMPANY',
              'NOT_FOR_PROFIT',
              'PARTNERSHIP',
              'S_CORPORATION',
              'SELF_MANAGED_SUPERANNUATION_FUND',
              'SOLE_TRADER',
              'SUPERANNUATION_FUND',
              'TRUST',
            ];
            type: 'string';
          };
          PaymentTerms: {
            $ref: '#/components/schemas/PaymentTerm';
          };
          PaysTax: {
            description: 'Boolean to describe if organisation is registered with a local tax authority i.e. true, false';
            type: 'boolean';
          };
          PeriodLockDate: {
            description: 'Shown if set. See lock dates';
            type: 'string';
            'x-is-msdate': true;
          };
          Phones: {
            description: 'Phones details for organisation – see Phones';
            items: {
              $ref: '#/components/schemas/Phone';
            };
            type: 'array';
          };
          RegistrationNumber: {
            description: 'Shows for New Zealand, Australian and UK organisations';
            type: 'string';
          };
          SalesTaxBasis: {
            description: 'The accounting basis used for tax returns. See Sales Tax Basis';
            enum: ['PAYMENTS', 'INVOICE', 'NONE', 'CASH', 'ACCRUAL', 'FLATRATECASH', 'FLATRATEACCRUAL', 'ACCRUALS'];
            type: 'string';
          };
          SalesTaxPeriod: {
            description: 'The frequency with which tax returns are processed. See Sales Tax Period';
            enum: [
              'MONTHLY',
              'QUARTERLY1',
              'QUARTERLY2',
              'QUARTERLY3',
              'ANNUALLY',
              'ONEMONTHS',
              'TWOMONTHS',
              'SIXMONTHS',
              '1MONTHLY',
              '2MONTHLY',
              '3MONTHLY',
              '6MONTHLY',
              'QUARTERLY',
              'YEARLY',
              'NONE',
            ];
            type: 'string';
          };
          ShortCode: {
            description: 'A unique identifier for the organisation. Potential uses.';
            type: 'string';
          };
          TaxNumber: {
            description: 'Shown if set. Displays in the Xero UI as Tax File Number (AU), GST Number (NZ), VAT Number (UK) and Tax ID Number (US & Global).';
            type: 'string';
          };
          Timezone: {
            $ref: '#/components/schemas/TimeZone';
            type: 'string';
          };
          Version: {
            description: 'See Version Types';
            enum: ['AU', 'NZ', 'GLOBAL', 'UK', 'US', 'AUONRAMP', 'NZONRAMP', 'GLOBALONRAMP', 'UKONRAMP', 'USONRAMP'];
            type: 'string';
          };
        };
        type: 'object';
      };
      Organisations: {
        properties: {
          Organisations: {
            items: {
              $ref: '#/components/schemas/Organisation';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Overpayment: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/overpayments/';
        };
        properties: {
          Allocations: {
            description: 'See Allocations';
            items: {
              $ref: '#/components/schemas/Allocation';
            };
            type: 'array';
          };
          AppliedAmount: {
            description: 'The amount of applied to an invoice';
            example: 2;
            format: 'double';
            type: 'number';
          };
          Attachments: {
            description: 'See Attachments';
            items: {
              $ref: '#/components/schemas/Attachment';
            };
            type: 'array';
          };
          Contact: {
            $ref: '#/components/schemas/Contact';
          };
          CurrencyCode: {
            $ref: '#/components/schemas/CurrencyCode';
            type: 'string';
          };
          CurrencyRate: {
            description: 'The currency rate for a multicurrency overpayment. If no rate is specified, the XE.com day rate is used';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Date: {
            description: 'The date the overpayment is created YYYY-MM-DD';
            type: 'string';
            'x-is-msdate': true;
          };
          HasAttachments: {
            default: 'false';
            description: 'boolean to indicate if a overpayment has an attachment';
            example: 'false';
            readOnly: true;
            type: 'boolean';
          };
          LineAmountTypes: {
            $ref: '#/components/schemas/LineAmountTypes';
            type: 'string';
          };
          LineItems: {
            description: 'See Overpayment Line Items';
            items: {
              $ref: '#/components/schemas/LineItem';
            };
            type: 'array';
          };
          OverpaymentID: {
            description: 'Xero generated unique identifier';
            format: 'uuid';
            type: 'string';
          };
          Payments: {
            description: 'See Payments';
            items: {
              $ref: '#/components/schemas/Payment';
            };
            type: 'array';
          };
          RemainingCredit: {
            description: 'The remaining credit balance on the overpayment';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Status: {
            description: 'See Overpayment Status Codes';
            enum: ['AUTHORISED', 'PAID', 'VOIDED'];
            type: 'string';
          };
          SubTotal: {
            description: 'The subtotal of the overpayment excluding taxes';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Total: {
            description: 'The total of the overpayment (subtotal + total tax)';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          TotalTax: {
            description: 'The total tax on the overpayment';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Type: {
            description: 'See Overpayment Types';
            enum: ['RECEIVE-OVERPAYMENT', 'SPEND-OVERPAYMENT', 'AROVERPAYMENT'];
            type: 'string';
          };
          UpdatedDateUTC: {
            description: 'UTC timestamp of last update to the overpayment';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
        };
        type: 'object';
      };
      Overpayments: {
        properties: {
          Overpayments: {
            items: {
              $ref: '#/components/schemas/Overpayment';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Payment: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/payments/';
        };
        properties: {
          Account: {
            $ref: '#/components/schemas/Account';
          };
          Amount: {
            description: 'The amount of the payment. Must be less than or equal to the outstanding amount owing on the invoice e.g. 200.00';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          BankAccountNumber: {
            description: 'The suppliers bank account number the payment is being made to';
            type: 'string';
          };
          BatchPaymentID: {
            description: 'Present if the payment was created as part of a batch.';
            example: '00000000-0000-0000-0000-000000000000';
            format: 'uuid';
            type: 'string';
          };
          Code: {
            description: 'Code of account you are using to make the payment e.g. 001 (note- not all accounts have a code value)';
            type: 'string';
          };
          CreditNote: {
            $ref: '#/components/schemas/CreditNote';
          };
          CreditNoteNumber: {
            description: 'Number of invoice or credit note you are applying payment to e.g. INV-4003';
            type: 'string';
          };
          CurrencyRate: {
            description: 'Exchange rate when payment is received. Only used for non base currency invoices and credit notes e.g. 0.7500';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Date: {
            description: 'Date the payment is being made (YYYY-MM-DD) e.g. 2009-09-06';
            type: 'string';
            'x-is-msdate': true;
          };
          Details: {
            description: "The information to appear on the supplier's bank account";
            type: 'string';
          };
          HasAccount: {
            default: 'false';
            description: 'A boolean to indicate if a contact has an validation errors';
            example: 'false';
            type: 'boolean';
          };
          HasValidationErrors: {
            default: 'false';
            description: 'A boolean to indicate if a contact has an validation errors';
            example: 'false';
            type: 'boolean';
          };
          Invoice: {
            $ref: '#/components/schemas/Invoice';
          };
          InvoiceNumber: {
            description: 'Number of invoice or credit note you are applying payment to e.g.INV-4003';
            type: 'string';
          };
          IsReconciled: {
            description: 'An optional parameter for the payment. A boolean indicating whether you would like the payment to be created as reconciled when using PUT, or whether a payment has been reconciled when using GET';
            type: 'boolean';
          };
          Overpayment: {
            $ref: '#/components/schemas/Overpayment';
          };
          Particulars: {
            description: 'The suppliers bank account number the payment is being made to';
            type: 'string';
          };
          PaymentID: {
            description: 'The Xero identifier for an Payment e.g. 297c2dc5-cc47-4afd-8ec8-74990b8761e9';
            example: '00000000-0000-0000-0000-000000000000';
            format: 'uuid';
            type: 'string';
          };
          PaymentType: {
            description: 'See Payment Types.';
            enum: [
              'ACCRECPAYMENT',
              'ACCPAYPAYMENT',
              'ARCREDITPAYMENT',
              'APCREDITPAYMENT',
              'AROVERPAYMENTPAYMENT',
              'ARPREPAYMENTPAYMENT',
              'APPREPAYMENTPAYMENT',
              'APOVERPAYMENTPAYMENT',
            ];
            readOnly: true;
            type: 'string';
          };
          Prepayment: {
            $ref: '#/components/schemas/Prepayment';
          };
          Reference: {
            description: 'An optional description for the payment e.g. Direct Debit';
            type: 'string';
          };
          Status: {
            description: 'The status of the payment.';
            enum: ['AUTHORISED', 'DELETED'];
            type: 'string';
          };
          StatusAttributeString: {
            description: 'A string to indicate if a invoice status';
            type: 'string';
          };
          UpdatedDateUTC: {
            description: 'UTC timestamp of last update to the payment';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          ValidationErrors: {
            description: 'Displays array of validation error messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      PaymentDelete: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/payments/';
        };
        properties: {
          Status: {
            default: 'DELETED';
            description: 'The status of the payment.';
            type: 'string';
          };
        };
        required: ['Status'];
        type: 'object';
      };
      PaymentService: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/branding-themes/';
        };
        properties: {
          PayNowText: {
            description: 'The text displayed on the Pay Now button in Xero Online Invoicing. If this is not set it will default to Pay by credit card';
            type: 'string';
          };
          PaymentServiceID: {
            description: 'Xero identifier';
            format: 'uuid';
            type: 'string';
          };
          PaymentServiceName: {
            description: 'Name of payment service';
            type: 'string';
          };
          PaymentServiceType: {
            description: 'This will always be CUSTOM for payment services created via the API.';
            type: 'string';
          };
          PaymentServiceUrl: {
            description: 'The custom payment URL';
            type: 'string';
          };
          ValidationErrors: {
            description: 'Displays array of validation error messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
        };
      };
      PaymentServices: {
        properties: {
          PaymentServices: {
            items: {
              $ref: '#/components/schemas/PaymentService';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      PaymentTerm: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/organisation/';
        };
        properties: {
          Bills: {
            $ref: '#/components/schemas/Bill';
          };
          Sales: {
            $ref: '#/components/schemas/Bill';
          };
        };
        type: 'object';
      };
      PaymentTermType: {
        enum: ['DAYSAFTERBILLDATE', 'DAYSAFTERBILLMONTH', 'OFCURRENTMONTH', 'OFFOLLOWINGMONTH'];
        type: 'string';
      };
      Payments: {
        properties: {
          Payments: {
            items: {
              $ref: '#/components/schemas/Payment';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Phone: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/types';
        };
        properties: {
          PhoneAreaCode: {
            description: 'max length = 10';
            maxLength: 10;
            type: 'string';
          };
          PhoneCountryCode: {
            description: 'max length = 20';
            maxLength: 20;
            type: 'string';
          };
          PhoneNumber: {
            description: 'max length = 50';
            maxLength: 50;
            type: 'string';
          };
          PhoneType: {
            enum: ['DEFAULT', 'DDI', 'MOBILE', 'FAX', 'OFFICE'];
            type: 'string';
          };
        };
        type: 'object';
      };
      Prepayment: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/prepayments/';
        };
        properties: {
          Allocations: {
            description: 'See Allocations';
            items: {
              $ref: '#/components/schemas/Allocation';
            };
            type: 'array';
          };
          AppliedAmount: {
            description: 'The amount of applied to an invoice';
            example: 2;
            format: 'double';
            type: 'number';
          };
          Attachments: {
            description: 'See Attachments';
            items: {
              $ref: '#/components/schemas/Attachment';
            };
            type: 'array';
          };
          Contact: {
            $ref: '#/components/schemas/Contact';
          };
          CurrencyCode: {
            $ref: '#/components/schemas/CurrencyCode';
            type: 'string';
          };
          CurrencyRate: {
            description: 'The currency rate for a multicurrency prepayment. If no rate is specified, the XE.com day rate is used';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Date: {
            description: 'The date the prepayment is created YYYY-MM-DD';
            type: 'string';
            'x-is-msdate': true;
          };
          HasAttachments: {
            default: 'false';
            description: 'boolean to indicate if a prepayment has an attachment';
            example: 'false';
            readOnly: true;
            type: 'boolean';
          };
          LineAmountTypes: {
            $ref: '#/components/schemas/LineAmountTypes';
            type: 'string';
          };
          LineItems: {
            description: 'See Prepayment Line Items';
            items: {
              $ref: '#/components/schemas/LineItem';
            };
            type: 'array';
          };
          PrepaymentID: {
            description: 'Xero generated unique identifier';
            format: 'uuid';
            type: 'string';
          };
          Reference: {
            description: "Returns Invoice number field. Reference field isn't available.";
            readOnly: true;
            type: 'string';
          };
          RemainingCredit: {
            description: 'The remaining credit balance on the prepayment';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Status: {
            description: 'See Prepayment Status Codes';
            enum: ['AUTHORISED', 'PAID', 'VOIDED'];
            type: 'string';
          };
          SubTotal: {
            description: 'The subtotal of the prepayment excluding taxes';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Total: {
            description: 'The total of the prepayment(subtotal + total tax)';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          TotalTax: {
            description: 'The total tax on the prepayment';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Type: {
            description: 'See Prepayment Types';
            enum: ['RECEIVE-PREPAYMENT', 'SPEND-PREPAYMENT', 'ARPREPAYMENT', 'APPREPAYMENT'];
            type: 'string';
          };
          UpdatedDateUTC: {
            description: 'UTC timestamp of last update to the prepayment';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
        };
        type: 'object';
      };
      Prepayments: {
        properties: {
          Prepayments: {
            items: {
              $ref: '#/components/schemas/Prepayment';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Purchase: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/items/';
        };
        properties: {
          AccountCode: {
            description: 'Default account code to be used for purchased/sale. Not applicable to the purchase details of tracked items';
            type: 'string';
          };
          COGSAccountCode: {
            description: 'Cost of goods sold account. Only applicable to the purchase details of tracked items.';
            type: 'string';
          };
          TaxType: {
            description: 'The tax type from TaxRates';
            type: 'string';
          };
          UnitPrice: {
            description: 'Unit Price of the item. By default UnitPrice is rounded to two decimal places. You can use 4 decimal places by adding the unitdp=4 querystring parameter to your request.';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
        };
        type: 'object';
      };
      PurchaseOrder: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/purchase-orders/';
        };
        properties: {
          Attachments: {
            description: 'Displays array of attachments from the API';
            items: {
              $ref: '#/components/schemas/Attachment';
            };
            type: 'array';
          };
          AttentionTo: {
            description: 'The person that the delivery is going to';
            type: 'string';
          };
          BrandingThemeID: {
            description: 'See BrandingThemes';
            format: 'uuid';
            type: 'string';
          };
          Contact: {
            $ref: '#/components/schemas/Contact';
          };
          CurrencyCode: {
            $ref: '#/components/schemas/CurrencyCode';
            type: 'string';
          };
          CurrencyRate: {
            description: 'The currency rate for a multicurrency purchase order. If no rate is specified, the XE.com day rate is used.';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Date: {
            description: 'Date purchase order was issued – YYYY-MM-DD. If the Date element is not specified then it will default to the current date based on the timezone setting of the organisation';
            type: 'string';
            'x-is-msdate': true;
          };
          DeliveryAddress: {
            description: 'The address the goods are to be delivered to';
            type: 'string';
          };
          DeliveryDate: {
            description: 'Date the goods are to be delivered – YYYY-MM-DD';
            type: 'string';
            'x-is-msdate': true;
          };
          DeliveryInstructions: {
            description: 'A free text feild for instructions (500 characters max)';
            type: 'string';
          };
          ExpectedArrivalDate: {
            description: 'The date the goods are expected to arrive.';
            type: 'string';
            'x-is-msdate': true;
          };
          HasAttachments: {
            default: 'false';
            description: 'boolean to indicate if a purchase order has an attachment';
            example: 'false';
            readOnly: true;
            type: 'boolean';
          };
          LineAmountTypes: {
            $ref: '#/components/schemas/LineAmountTypes';
            type: 'string';
          };
          LineItems: {
            description: 'See LineItems';
            items: {
              $ref: '#/components/schemas/LineItem';
            };
            type: 'array';
          };
          PurchaseOrderID: {
            description: 'Xero generated unique identifier for purchase order';
            format: 'uuid';
            type: 'string';
          };
          PurchaseOrderNumber: {
            description: 'Unique alpha numeric code identifying purchase order (when missing will auto-generate from your Organisation Invoice Settings)';
            type: 'string';
          };
          Reference: {
            description: 'Additional reference number';
            type: 'string';
          };
          SentToContact: {
            description: 'Boolean to set whether the purchase order should be marked as “sent”. This can be set only on purchase orders that have been approved or billed';
            type: 'boolean';
          };
          Status: {
            description: 'See Purchase Order Status Codes';
            enum: ['DRAFT', 'SUBMITTED', 'AUTHORISED', 'BILLED', 'DELETED'];
            type: 'string';
          };
          StatusAttributeString: {
            description: 'A string to indicate if a invoice status';
            type: 'string';
          };
          SubTotal: {
            description: 'Total of purchase order excluding taxes';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          Telephone: {
            description: 'The phone number for the person accepting the delivery';
            type: 'string';
          };
          Total: {
            description: 'Total of Purchase Order tax inclusive (i.e. SubTotal + TotalTax)';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          TotalDiscount: {
            description: 'Total of discounts applied on the purchase order line items';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          TotalTax: {
            description: 'Total tax on purchase order';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          UpdatedDateUTC: {
            description: 'Last modified date UTC format';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          ValidationErrors: {
            description: 'Displays array of validation error messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
          Warnings: {
            description: 'Displays array of warning messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      PurchaseOrders: {
        properties: {
          PurchaseOrders: {
            items: {
              $ref: '#/components/schemas/PurchaseOrder';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Quote: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/Quotes/';
        };
        properties: {
          BrandingThemeID: {
            description: 'See BrandingThemes';
            format: 'uuid';
            type: 'string';
          };
          Contact: {
            $ref: '#/components/schemas/Contact';
            type: 'string';
          };
          CurrencyCode: {
            $ref: '#/components/schemas/CurrencyCode';
            type: 'string';
          };
          CurrencyRate: {
            description: 'The currency rate for a multicurrency quote';
            format: 'double';
            type: 'number';
          };
          Date: {
            description: 'Date quote was issued – YYYY-MM-DD. If the Date element is not specified it will default to the current date based on the timezone setting of the organisation';
            type: 'string';
            'x-is-msdate': true;
          };
          DateString: {
            description: 'Date the quote was issued (YYYY-MM-DD)';
            type: 'string';
          };
          ExpiryDate: {
            description: 'Date the quote expires – YYYY-MM-DD.';
            type: 'string';
            'x-is-msdate': true;
          };
          ExpiryDateString: {
            description: 'Date the quote expires – YYYY-MM-DD.';
            type: 'string';
          };
          LineAmountTypes: {
            $ref: '#/components/schemas/QuoteLineAmountTypes';
            description: 'See Quote Line Amount Types';
            type: 'string';
          };
          LineItems: {
            description: 'See LineItems';
            items: {
              $ref: '#/components/schemas/LineItem';
            };
            type: 'array';
          };
          QuoteID: {
            description: 'QuoteID GUID is automatically generated and is returned after create or GET.';
            format: 'uuid';
            type: 'string';
          };
          QuoteNumber: {
            description: 'Unique alpha numeric code identifying a quote (Max Length = 255)';
            maxLength: 255;
            type: 'string';
          };
          Reference: {
            description: 'Additional reference number';
            maxLength: 4000;
            type: 'string';
          };
          Status: {
            $ref: '#/components/schemas/QuoteStatusCodes';
            type: 'string';
          };
          StatusAttributeString: {
            description: 'A string to indicate if a invoice status';
            type: 'string';
          };
          SubTotal: {
            description: 'Total of quote excluding taxes.';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          Summary: {
            description: 'Summary text for the quote';
            maxLength: 3000;
            type: 'string';
          };
          Terms: {
            description: 'Terms of the quote';
            maxLength: 4000;
            type: 'string';
          };
          Title: {
            description: 'Title text for the quote';
            maxLength: 100;
            type: 'string';
          };
          Total: {
            description: 'Total of Quote tax inclusive (i.e. SubTotal + TotalTax). This will be ignored if it doesn’t equal the sum of the LineAmounts';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          TotalDiscount: {
            description: 'Total of discounts applied on the quote line items';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          TotalTax: {
            description: 'Total tax on quote';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          UpdatedDateUTC: {
            description: 'Last modified date UTC format';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          ValidationErrors: {
            description: 'Displays array of validation error messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      QuoteLineAmountTypes: {
        description: 'Line amounts are exclusive of tax by default if you don’t specify this element. See Line Amount Types';
        enum: ['EXCLUSIVE', 'INCLUSIVE', 'NOTAX'];
        type: 'string';
      };
      QuoteStatusCodes: {
        description: 'The status of the quote.';
        enum: ['DRAFT', 'SENT', 'DECLINED', 'ACCEPTED', 'INVOICED', 'DELETED'];
        type: 'string';
      };
      Quotes: {
        properties: {
          Quotes: {
            items: {
              $ref: '#/components/schemas/Quote';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Receipt: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/receipts/';
        };
        properties: {
          Attachments: {
            description: 'Displays array of attachments from the API';
            items: {
              $ref: '#/components/schemas/Attachment';
            };
            type: 'array';
          };
          Contact: {
            $ref: '#/components/schemas/Contact';
          };
          Date: {
            description: 'Date of receipt – YYYY-MM-DD';
            type: 'string';
            'x-is-msdate': true;
          };
          HasAttachments: {
            default: 'false';
            description: 'boolean to indicate if a receipt has an attachment';
            example: 'false';
            readOnly: true;
            type: 'boolean';
          };
          LineAmountTypes: {
            $ref: '#/components/schemas/LineAmountTypes';
            type: 'string';
          };
          LineItems: {
            items: {
              $ref: '#/components/schemas/LineItem';
            };
            type: 'array';
          };
          ReceiptID: {
            description: 'Xero generated unique identifier for receipt';
            format: 'uuid';
            type: 'string';
          };
          ReceiptNumber: {
            description: 'Xero generated sequence number for receipt in current claim for a given user';
            readOnly: true;
            type: 'string';
          };
          Reference: {
            description: 'Additional reference number';
            type: 'string';
          };
          Status: {
            description: 'Current status of receipt – see status types';
            enum: ['DRAFT', 'SUBMITTED', 'AUTHORISED', 'DECLINED', 'VOIDED'];
            type: 'string';
          };
          SubTotal: {
            description: 'Total of receipt excluding taxes';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Total: {
            description: 'Total of receipt tax inclusive (i.e. SubTotal + TotalTax)';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          TotalTax: {
            description: 'Total tax on receipt';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          UpdatedDateUTC: {
            description: 'Last modified date UTC format';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          Url: {
            description: 'URL link to a source document – shown as “Go to [appName]” in the Xero app';
            readOnly: true;
            type: 'string';
          };
          User: {
            $ref: '#/components/schemas/User';
          };
          ValidationErrors: {
            description: 'Displays array of validation error messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
          Warnings: {
            description: 'Displays array of warning messages from the API';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      Receipts: {
        properties: {
          Receipts: {
            items: {
              $ref: '#/components/schemas/Receipt';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      RepeatingInvoice: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/repeating-invoices/';
        };
        properties: {
          Attachments: {
            description: 'Displays array of attachments from the API';
            items: {
              $ref: '#/components/schemas/Attachment';
            };
            type: 'array';
          };
          BrandingThemeID: {
            description: 'See BrandingThemes';
            format: 'uuid';
            type: 'string';
          };
          Contact: {
            $ref: '#/components/schemas/Contact';
          };
          CurrencyCode: {
            $ref: '#/components/schemas/CurrencyCode';
            type: 'string';
          };
          HasAttachments: {
            default: 'false';
            description: 'boolean to indicate if an invoice has an attachment';
            example: 'false';
            readOnly: true;
            type: 'boolean';
          };
          ID: {
            description: 'Xero generated unique identifier for repeating invoice template';
            format: 'uuid';
            type: 'string';
          };
          LineAmountTypes: {
            $ref: '#/components/schemas/LineAmountTypes';
            type: 'string';
          };
          LineItems: {
            description: 'See LineItems';
            items: {
              $ref: '#/components/schemas/LineItem';
            };
            type: 'array';
          };
          Reference: {
            description: 'ACCREC only – additional reference number';
            type: 'string';
          };
          RepeatingInvoiceID: {
            description: 'Xero generated unique identifier for repeating invoice template';
            format: 'uuid';
            type: 'string';
          };
          Schedule: {
            $ref: '#/components/schemas/Schedule';
          };
          Status: {
            description: 'One of the following - DRAFT or AUTHORISED – See Invoice Status Codes';
            enum: ['DRAFT', 'AUTHORISED', 'DELETED'];
            type: 'string';
          };
          SubTotal: {
            description: 'Total of invoice excluding taxes';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Total: {
            description: 'Total of Invoice tax inclusive (i.e. SubTotal + TotalTax)';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          TotalTax: {
            description: 'Total tax on invoice';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Type: {
            description: 'See Invoice Types';
            enum: ['ACCPAY', 'ACCREC'];
            type: 'string';
          };
        };
        type: 'object';
      };
      RepeatingInvoices: {
        properties: {
          RepeatingInvoices: {
            items: {
              $ref: '#/components/schemas/RepeatingInvoice';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      Report: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/reports/';
        };
        properties: {
          Contacts: {
            items: {
              $ref: '#/components/schemas/TenNinetyNineContact';
            };
            type: 'array';
          };
          ReportDate: {
            description: 'Date of report';
            type: 'string';
          };
          ReportID: {
            description: 'See Prepayment Types';
            type: 'string';
          };
          ReportName: {
            description: 'See Prepayment Types';
            type: 'string';
          };
          ReportTitle: {
            description: 'See Prepayment Types';
            type: 'string';
          };
          ReportType: {
            description: 'See Prepayment Types';
            enum: ['AgedPayablesByContact'];
            type: 'string';
          };
          UpdatedDateUTC: {
            description: 'Updated Date';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
        };
      };
      ReportAttribute: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/reports/';
        };
        properties: {
          Id: {
            type: 'string';
          };
          Value: {
            type: 'string';
          };
        };
      };
      ReportCell: {
        properties: {
          Attributes: {
            items: {
              $ref: '#/components/schemas/ReportAttribute';
            };
            type: 'array';
          };
          Value: {
            type: 'string';
          };
        };
        type: 'object';
      };
      ReportFields: {
        properties: {
          Description: {
            type: 'string';
          };
          FieldID: {
            type: 'string';
          };
          Value: {
            type: 'string';
          };
        };
        type: 'object';
      };
      ReportRow: {
        properties: {
          Cells: {
            items: {
              $ref: '#/components/schemas/ReportCell';
            };
            type: 'array';
          };
          RowType: {
            $ref: '#/components/schemas/RowType';
          };
          Title: {
            type: 'string';
          };
        };
        type: 'object';
      };
      ReportRows: {
        properties: {
          Cells: {
            items: {
              $ref: '#/components/schemas/ReportCell';
            };
            type: 'array';
          };
          RowType: {
            $ref: '#/components/schemas/RowType';
          };
          Rows: {
            items: {
              $ref: '#/components/schemas/ReportRow';
            };
            type: 'array';
          };
          Title: {
            type: 'string';
          };
        };
        type: 'object';
      };
      ReportWithRow: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/reports/';
        };
        properties: {
          Fields: {
            items: {
              $ref: '#/components/schemas/ReportFields';
            };
            type: 'array';
          };
          ReportDate: {
            description: 'Date of report';
            type: 'string';
          };
          ReportID: {
            description: 'Report id';
            type: 'string';
          };
          ReportName: {
            description: 'Name of the report';
            type: 'string';
          };
          ReportTitle: {
            description: 'Title of the report';
            type: 'string';
          };
          ReportTitles: {
            description: 'Report titles array (3 to 4 strings with the report name, orgnisation name and time frame of report)';
            items: {
              type: 'string';
            };
            type: 'array';
          };
          ReportType: {
            description: 'The type of report (BalanceSheet,ProfitLoss, etc)';
            type: 'string';
          };
          Rows: {
            items: {
              $ref: '#/components/schemas/ReportRows';
            };
            type: 'array';
          };
          UpdatedDateUTC: {
            description: 'Updated Date';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
        };
      };
      ReportWithRows: {
        properties: {
          Reports: {
            items: {
              $ref: '#/components/schemas/ReportWithRow';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      Reports: {
        properties: {
          Reports: {
            items: {
              $ref: '#/components/schemas/Report';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      RequestEmpty: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/invoice/';
        };
        properties: {
          Status: {
            description: 'Need at least one field to create an empty JSON payload';
            type: 'string';
          };
        };
        type: 'object';
      };
      RowType: {
        enum: ['Header', 'Section', 'Row', 'SummaryRow'];
        type: 'string';
      };
      SalesTrackingCategory: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/tracking-categories/';
        };
        properties: {
          TrackingCategoryName: {
            description: 'The default sales tracking category name for contacts';
            type: 'string';
          };
          TrackingOptionName: {
            description: 'The default purchase tracking category name for contacts';
            type: 'string';
          };
        };
        type: 'object';
      };
      Schedule: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/repeating-invoices/';
        };
        properties: {
          DueDate: {
            description: 'Integer used with due date type e.g 20 (of following month), 31 (of current month)';
            type: 'integer';
          };
          DueDateType: {
            description: 'the payment terms';
            enum: [
              'DAYSAFTERBILLDATE',
              'DAYSAFTERBILLMONTH',
              'DAYSAFTERINVOICEDATE',
              'DAYSAFTERINVOICEMONTH',
              'OFCURRENTMONTH',
              'OFFOLLOWINGMONTH',
            ];
            type: 'string';
          };
          EndDate: {
            description: 'Invoice end date – only returned if the template has an end date set';
            type: 'string';
            'x-is-msdate': true;
          };
          NextScheduledDate: {
            description: 'The calendar date of the next invoice in the schedule to be generated';
            type: 'string';
            'x-is-msdate': true;
          };
          Period: {
            description: 'Integer used with the unit e.g. 1 (every 1 week), 2 (every 2 months)';
            type: 'integer';
          };
          StartDate: {
            description: 'Date the first invoice of the current version of the repeating schedule was generated (changes when repeating invoice is edited)';
            type: 'string';
            'x-is-msdate': true;
          };
          Unit: {
            description: 'One of the following - WEEKLY or MONTHLY';
            enum: ['WEEKLY', 'MONTHLY'];
            type: 'string';
          };
        };
        type: 'object';
      };
      Setup: {
        externalDocs: {
          url: 'https://developer.xero.com/documentation/api-guides/conversions';
        };
        properties: {
          Accounts: {
            items: {
              $ref: '#/components/schemas/Account';
            };
            type: 'array';
          };
          ConversionBalances: {
            description: 'Balance supplied for each account that has a value as at the conversion date.';
            items: {
              $ref: '#/components/schemas/ConversionBalances';
            };
            type: 'array';
          };
          ConversionDate: {
            $ref: '#/components/schemas/ConversionDate';
          };
        };
      };
      TaxComponent: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/tax-rates/';
        };
        properties: {
          IsCompound: {
            description: 'Boolean to describe if Tax rate is compounded.';
            type: 'boolean';
          };
          IsNonRecoverable: {
            description: 'Boolean to describe if tax rate is non-recoverable. Non-recoverable rates are only applicable to Canadian organisations';
            type: 'boolean';
          };
          Name: {
            description: 'Name of Tax Component';
            type: 'string';
          };
          Rate: {
            description: 'Tax Rate (up to 4dp)';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
        };
        type: 'object';
      };
      TaxRate: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/tax-rates/';
        };
        properties: {
          CanApplyToAssets: {
            description: 'Boolean to describe if tax rate can be used for asset accounts i.e.  true,false';
            readOnly: true;
            type: 'boolean';
          };
          CanApplyToEquity: {
            description: 'Boolean to describe if tax rate can be used for equity accounts i.e true,false';
            readOnly: true;
            type: 'boolean';
          };
          CanApplyToExpenses: {
            description: 'Boolean to describe if tax rate can be used for expense accounts  i.e. true,false';
            readOnly: true;
            type: 'boolean';
          };
          CanApplyToLiabilities: {
            description: 'Boolean to describe if tax rate can be used for liability accounts  i.e. true,false';
            readOnly: true;
            type: 'boolean';
          };
          CanApplyToRevenue: {
            description: 'Boolean to describe if tax rate can be used for revenue accounts i.e. true,false';
            readOnly: true;
            type: 'boolean';
          };
          DisplayTaxRate: {
            description: 'Tax Rate (decimal to 4dp) e.g 12.5000';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          EffectiveRate: {
            description: 'Effective Tax Rate (decimal to 4dp) e.g 12.5000';
            format: 'double';
            readOnly: true;
            type: 'number';
            'x-is-money': true;
          };
          Name: {
            description: 'Name of tax rate';
            type: 'string';
          };
          ReportTaxType: {
            description: 'See ReportTaxTypes';
            enum: [
              'AVALARA',
              'BASEXCLUDED',
              'CAPITALSALESOUTPUT',
              'CAPITALEXPENSESINPUT',
              'ECOUTPUT',
              'ECOUTPUTSERVICES',
              'ECINPUT',
              'ECACQUISITIONS',
              'EXEMPTEXPENSES',
              'EXEMPTINPUT',
              'EXEMPTOUTPUT',
              'GSTONIMPORTS',
              'INPUT',
              'INPUTTAXED',
              'MOSSSALES',
              'NONE',
              'NONEOUTPUT',
              'OUTPUT',
              'PURCHASESINPUT',
              'SALESOUTPUT',
              'EXEMPTCAPITAL',
              'EXEMPTEXPORT',
              'CAPITALEXINPUT',
              'GSTONCAPIMPORTS',
              'GSTONCAPITALIMPORTS',
              'REVERSECHARGES',
              'PAYMENTS',
              'INVOICE',
              'CASH',
              'ACCRUAL',
              'FLATRATECASH',
              'FLATRATEACCRUAL',
              'ACCRUALS',
              'TXCA',
              'SRCAS',
              'DSOUTPUT',
              'BLINPUT2',
              'EPINPUT',
              'IMINPUT2',
              'MEINPUT',
              'IGDSINPUT2',
              'ESN33OUTPUT',
              'OPINPUT',
              'OSOUTPUT',
              'TXN33INPUT',
              'TXESSINPUT',
              'TXREINPUT',
              'TXPETINPUT',
              'NRINPUT',
              'ES33OUTPUT',
              'ZERORATEDINPUT',
              'ZERORATEDOUTPUT',
              'DRCHARGESUPPLY',
              'DRCHARGE',
              'CAPINPUT',
              'CAPIMPORTS',
              'IMINPUT',
              'INPUT2',
              'CIUINPUT',
              'SRINPUT',
              'OUTPUT2',
              'SROUTPUT',
              'CAPOUTPUT',
              'SROUTPUT2',
              'CIUOUTPUT',
              'ZROUTPUT',
              'ZREXPORT',
              'ACC28PLUS',
              'ACCUPTO28',
              'OTHEROUTPUT',
              'SHOUTPUT',
              'ZRINPUT',
              'BADDEBT',
              'OTHERINPUT',
            ];
            type: 'string';
          };
          Status: {
            description: 'See Status Codes';
            enum: ['ACTIVE', 'DELETED', 'ARCHIVED', 'PENDING'];
            type: 'string';
          };
          TaxComponents: {
            description: 'See TaxComponents';
            items: {
              $ref: '#/components/schemas/TaxComponent';
            };
            type: 'array';
          };
          TaxType: {
            description: 'The tax type';
            type: 'string';
          };
        };
        type: 'object';
      };
      TaxRates: {
        properties: {
          TaxRates: {
            items: {
              $ref: '#/components/schemas/TaxRate';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      TaxType: {
        description: 'See Tax Types – can only be used on update calls';
        enum: [
          'OUTPUT',
          'INPUT',
          'CAPEXINPUT',
          'EXEMPTEXPORT',
          'EXEMPTEXPENSES',
          'EXEMPTCAPITAL',
          'EXEMPTOUTPUT',
          'INPUTTAXED',
          'BASEXCLUDED',
          'GSTONCAPIMPORTS',
          'GSTONIMPORTS',
          'NONE',
          'INPUT2',
          'ZERORATED',
          'OUTPUT2',
          'CAPEXINPUT2',
          'CAPEXOUTPUT',
          'CAPEXOUTPUT2',
          'CAPEXSRINPUT',
          'CAPEXSROUTPUT',
          'ECACQUISITIONS',
          'ECZRINPUT',
          'ECZROUTPUT',
          'ECZROUTPUTSERVICES',
          'EXEMPTINPUT',
          'REVERSECHARGES',
          'RRINPUT',
          'RROUTPUT',
          'SRINPUT',
          'SROUTPUT',
          'ZERORATEDINPUT',
          'ZERORATEDOUTPUT',
          'BLINPUT',
          'DSOUTPUT',
          'EPINPUT',
          'ES33OUTPUT',
          'ESN33OUTPUT',
          'IGDSINPUT2',
          'IMINPUT2',
          'MEINPUT',
          'NRINPUT',
          'OPINPUT',
          'OSOUTPUT',
          'TXESSINPUT',
          'TXN33INPUT',
          'TXPETINPUT',
          'TXREINPUT',
          'INPUT3',
          'INPUT4',
          'OUTPUT3',
          'OUTPUT4',
          'SROUTPUT2',
          'TXCA',
          'SRCAS',
          'BLINPUT2',
          'DRCHARGESUPPLY20',
          'DRCHARGE20',
          'DRCHARGESUPPLY5',
          'DRCHARGE5',
        ];
        type: 'string';
      };
      TenNinetyNineContact: {
        properties: {
          Box1: {
            description: 'Box 1 on 1099 Form';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Box10: {
            description: 'Box 10 on 1099 Form';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Box11: {
            description: 'Box 11 on 1099 Form';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Box13: {
            description: 'Box 13 on 1099 Form';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Box14: {
            description: 'Box 14 on 1099 Form';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Box2: {
            description: 'Box 2 on 1099 Form';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Box3: {
            description: 'Box 3 on 1099 Form';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Box4: {
            description: 'Box 4 on 1099 Form';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Box5: {
            description: 'Box 5 on 1099 Form';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Box6: {
            description: 'Box 6 on 1099 Form';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Box7: {
            description: 'Box 7 on 1099 Form';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Box8: {
            description: 'Box 8 on 1099 Form';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          Box9: {
            description: 'Box 9 on 1099 Form';
            format: 'double';
            type: 'number';
            'x-is-money': true;
          };
          City: {
            description: 'Contact city on 1099 Form';
            type: 'string';
          };
          ContactId: {
            description: 'Contact contact id';
            format: 'uuid';
            type: 'string';
          };
          Email: {
            description: 'Contact email on 1099 Form';
            type: 'string';
          };
          FederalTaxIDType: {
            description: 'Contact Fed Tax ID type';
            type: 'string';
          };
          Name: {
            description: 'Contact name on 1099 Form';
            type: 'string';
          };
          State: {
            description: 'Contact State on 1099 Form';
            type: 'string';
          };
          StreetAddress: {
            description: 'Contact address on 1099 Form';
            type: 'string';
          };
          TaxID: {
            description: 'Contact tax id on 1099 Form';
            type: 'string';
          };
          Zip: {
            description: 'Contact zip on 1099 Form';
            type: 'string';
          };
        };
      };
      TimeZone: {
        description: 'Timezone specifications';
        enum: [
          'MOROCCOSTANDARDTIME',
          'UTC',
          'GMTSTANDARDTIME',
          'GREENWICHSTANDARDTIME',
          'WEUROPESTANDARDTIME',
          'CENTRALEUROPESTANDARDTIME',
          'ROMANCESTANDARDTIME',
          'CENTRALEUROPEANSTANDARDTIME',
          'WCENTRALAFRICASTANDARDTIME',
          'NAMIBIASTANDARDTIME',
          'JORDANSTANDARDTIME',
          'GTBSTANDARDTIME',
          'MIDDLEEASTSTANDARDTIME',
          'EGYPTSTANDARDTIME',
          'SYRIASTANDARDTIME',
          'EEUROPESTANDARDTIME',
          'SOUTHAFRICASTANDARDTIME',
          'FLESTANDARDTIME',
          'TURKEYSTANDARDTIME',
          'ISRAELSTANDARDTIME',
          'KALININGRADSTANDARDTIME',
          'LIBYASTANDARDTIME',
          'ARABICSTANDARDTIME',
          'ARABSTANDARDTIME',
          'BELARUSSTANDARDTIME',
          'RUSSIANSTANDARDTIME',
          'EAFRICASTANDARDTIME',
          'IRANSTANDARDTIME',
          'ARABIANSTANDARDTIME',
          'AZERBAIJANSTANDARDTIME',
          'RUSSIATIMEZONE3',
          'MAURITIUSSTANDARDTIME',
          'GEORGIANSTANDARDTIME',
          'CAUCASUSSTANDARDTIME',
          'AFGHANISTANSTANDARDTIME',
          'WESTASIASTANDARDTIME',
          'EKATERINBURGSTANDARDTIME',
          'PAKISTANSTANDARDTIME',
          'INDIASTANDARDTIME',
          'SRILANKASTANDARDTIME',
          'NEPALSTANDARDTIME',
          'CENTRALASIASTANDARDTIME',
          'BANGLADESHSTANDARDTIME',
          'NCENTRALASIASTANDARDTIME',
          'MYANMARSTANDARDTIME',
          'SEASIASTANDARDTIME',
          'NORTHASIASTANDARDTIME',
          'CHINASTANDARDTIME',
          'NORTHASIAEASTSTANDARDTIME',
          'SINGAPORESTANDARDTIME',
          'WAUSTRALIASTANDARDTIME',
          'TAIPEISTANDARDTIME',
          'ULAANBAATARSTANDARDTIME',
          'TOKYOSTANDARDTIME',
          'KOREASTANDARDTIME',
          'YAKUTSKSTANDARDTIME',
          'CENAUSTRALIASTANDARDTIME',
          'AUSCENTRALSTANDARDTIME',
          'EAUSTRALIASTANDARDTIME',
          'AUSEASTERNSTANDARDTIME',
          'WESTPACIFICSTANDARDTIME',
          'TASMANIASTANDARDTIME',
          'MAGADANSTANDARDTIME',
          'VLADIVOSTOKSTANDARDTIME',
          'RUSSIATIMEZONE10',
          'CENTRALPACIFICSTANDARDTIME',
          'RUSSIATIMEZONE11',
          'NEWZEALANDSTANDARDTIME',
          'UTC+12',
          'UTC+13',
          'FIJISTANDARDTIME',
          'KAMCHATKASTANDARDTIME',
          'TONGASTANDARDTIME',
          'SAMOASTANDARDTIME',
          'LINEISLANDSSTANDARDTIME',
          'AZORESSTANDARDTIME',
          'CAPEVERDESTANDARDTIME',
          'UTC02',
          'MIDATLANTICSTANDARDTIME',
          'ESOUTHAMERICASTANDARDTIME',
          'ARGENTINASTANDARDTIME',
          'SAEASTERNSTANDARDTIME',
          'GREENLANDSTANDARDTIME',
          'MONTEVIDEOSTANDARDTIME',
          'BAHIASTANDARDTIME',
          'NEWFOUNDLANDSTANDARDTIME',
          'PARAGUAYSTANDARDTIME',
          'ATLANTICSTANDARDTIME',
          'CENTRALBRAZILIANSTANDARDTIME',
          'SAWESTERNSTANDARDTIME',
          'PACIFICSASTANDARDTIME',
          'VENEZUELASTANDARDTIME',
          'SAPACIFICSTANDARDTIME',
          'EASTERNSTANDARDTIME',
          'USEASTERNSTANDARDTIME',
          'CENTRALAMERICASTANDARDTIME',
          'CENTRALSTANDARDTIME',
          'CENTRALSTANDARDTIME(MEXICO)',
          'CANADACENTRALSTANDARDTIME',
          'USMOUNTAINSTANDARDTIME',
          'MOUNTAINSTANDARDTIME(MEXICO)',
          'MOUNTAINSTANDARDTIME',
          'PACIFICSTANDARDTIME(MEXICO)',
          'PACIFICSTANDARDTIME',
          'ALASKANSTANDARDTIME',
          'HAWAIIANSTANDARDTIME',
          'UTC11',
          'DATELINESTANDARDTIME',
        ];
        type: 'string';
      };
      TrackingCategories: {
        properties: {
          TrackingCategories: {
            items: {
              $ref: '#/components/schemas/TrackingCategory';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      TrackingCategory: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/tracking-categories/';
        };
        properties: {
          Name: {
            description: 'The name of the tracking category e.g. Department, Region (max length = 100)';
            maxLength: 100;
            type: 'string';
          };
          Option: {
            description: 'The option name of the tracking option e.g. East, West (max length = 100)';
            maxLength: 100;
            type: 'string';
          };
          Options: {
            description: 'See Tracking Options';
            items: {
              $ref: '#/components/schemas/TrackingOption';
            };
            type: 'array';
          };
          Status: {
            description: 'The status of a tracking category';
            enum: ['ACTIVE', 'ARCHIVED', 'DELETED'];
            type: 'string';
          };
          TrackingCategoryID: {
            description: 'The Xero identifier for a tracking category e.g. 297c2dc5-cc47-4afd-8ec8-74990b8761e9';
            format: 'uuid';
            type: 'string';
          };
          TrackingOptionID: {
            description: 'The Xero identifier for a tracking option e.g. dc54c220-0140-495a-b925-3246adc0075f';
            format: 'uuid';
            type: 'string';
          };
        };
        type: 'object';
      };
      TrackingOption: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/tracking-categories/';
        };
        properties: {
          Name: {
            description: 'The name of the tracking option e.g. Marketing, East (max length = 100)';
            maxLength: 100;
            type: 'string';
          };
          Status: {
            description: 'The status of a tracking option';
            enum: ['ACTIVE', 'ARCHIVED', 'DELETED'];
            type: 'string';
          };
          TrackingCategoryID: {
            description: 'Filter by a tracking category e.g. 297c2dc5-cc47-4afd-8ec8-74990b8761e9';
            format: 'uuid';
            type: 'string';
          };
          TrackingOptionID: {
            description: 'The Xero identifier for a tracking option e.g. ae777a87-5ef3-4fa0-a4f0-d10e1f13073a';
            format: 'uuid';
            type: 'string';
          };
        };
        type: 'object';
      };
      TrackingOptions: {
        properties: {
          Options: {
            items: {
              $ref: '#/components/schemas/TrackingOption';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      User: {
        externalDocs: {
          url: 'http://developer.xero.com/documentation/api/users/';
        };
        properties: {
          EmailAddress: {
            description: 'Email address of user';
            type: 'string';
          };
          FirstName: {
            description: 'First name of user';
            type: 'string';
          };
          IsSubscriber: {
            description: 'Boolean to indicate if user is the subscriber';
            type: 'boolean';
          };
          LastName: {
            description: 'Last name of user';
            type: 'string';
          };
          OrganisationRole: {
            description: 'User role that defines permissions in Xero and via API (READONLY, INVOICEONLY, STANDARD, FINANCIALADVISER, etc)';
            enum: [
              'READONLY',
              'INVOICEONLY',
              'STANDARD',
              'FINANCIALADVISER',
              'MANAGEDCLIENT',
              'CASHBOOKCLIENT',
              'UNKNOWN',
            ];
            type: 'string';
          };
          UpdatedDateUTC: {
            description: 'Timestamp of last change to user';
            example: '/Date(1573755038314)/';
            readOnly: true;
            type: 'string';
            'x-is-msdate-time': true;
          };
          UserID: {
            description: 'Xero identifier';
            format: 'uuid';
            type: 'string';
          };
        };
        type: 'object';
      };
      Users: {
        properties: {
          Users: {
            items: {
              $ref: '#/components/schemas/User';
            };
            type: 'array';
          };
        };
        type: 'object';
        'x-isObjectArray': true;
      };
      ValidationError: {
        externalDocs: {
          url: 'https://developer.xero.com/documentation/api/http-response-codes';
        };
        properties: {
          Message: {
            description: 'Validation error message';
            type: 'string';
          };
        };
        type: 'object';
      };
    };
    securitySchemes: {
      OAuth2: {
        description: 'For more information';
        flows: {
          authorizationCode: {
            authorizationUrl: 'https://login.xero.com/identity/connect/authorize';
            scopes: {
              'accounting.attachments': 'Grant read-write access to attachments';
              'accounting.attachments.read': 'Grant read-only access to attachments';
              'accounting.contacts': 'Grant read-write access to contacts and contact groups';
              'accounting.contacts.read': 'Grant read-only access to contacts and contact groups';
              'accounting.journals.read': 'Grant read-only access to journals';
              'accounting.reports.read': 'Grant read-only access to accounting reports';
              'accounting.reports.tenninetynine.read': 'Grant read-only access to 1099 reports';
              'accounting.settings': 'Grant read-write access to organisation and account settings';
              'accounting.settings.read': 'Grant read-only access to organisation and account settings';
              'accounting.transactions': 'Grant read-write access to bank transactions, credit notes, invoices, repeating invoices';
              'accounting.transactions.read': 'Grant read-only access to invoices';
              assets: 'Grant read-write access to assets';
              'assets.read': 'Grant read-only access to fixed assets';
              bankfeeds: 'Grant read-write access to bankfeeds';
              email: 'Grant read-only access to your email';
              files: 'Grant read-write access to files and folders';
              'files.read': 'Grant read-only access to files and folders';
              openid: 'Grant read-only access to your open id';
              paymentservices: 'Grant read-write access to payment services';
              payroll: 'Grant read-write access to payroll';
              'payroll.employees': 'Grant read-write access to payroll employees';
              'payroll.employees.read': 'Grant read-only access to payroll employees';
              'payroll.leaveapplications': 'Grant read-write access to payroll leaveapplications';
              'payroll.leaveapplications.read': 'Grant read-only access to payroll leaveapplications';
              'payroll.payitems': 'Grant read-write access to payroll payitems';
              'payroll.payitems.read': 'Grant read-only access to payroll payitems';
              'payroll.payrollcalendars': 'Grant read-write access to payroll calendars';
              'payroll.payrollcalendars.read': 'Grant read-only access to payroll calendars';
              'payroll.payruns': 'Grant read-write access to payroll payruns';
              'payroll.payruns.read': 'Grant read-only access to payroll payruns';
              'payroll.payslip': 'Grant read-write access to payroll payslips';
              'payroll.payslip.read': 'Grant read-only access to payroll payslips';
              'payroll.read': 'Grant read-only access to payroll';
              'payroll.settings.read': 'Grant read-only access to payroll settings';
              'payroll.superfundproducts.read': 'Grant read-only access to payroll superfundproducts';
              'payroll.superfunds': 'Grant read-write access to payroll superfunds';
              'payroll.superfunds.read': 'Grant read-only access to payroll superfunds';
              'payroll.timesheets': 'Grant read-write access to payroll timesheets';
              'payroll.timesheets.read': 'Grant read-only access to payroll timesheets';
              profile: 'your profile information';
              projects: 'Grant read-write access to projects';
              'projects.read': 'Grant read-only access to projects';
            };
            tokenUrl: 'https://identity.xero.com/connect/token';
          };
        };
        type: 'oauth2';
      };
    };
  };
};
