// @ts-nocheck
export type TComponents = {
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
export const components = {
  parameters: {
    ifModifiedSince: {
      description: 'Only records created or modified since this timestamp will be returned',
      example: '2020-02-06T12:17:43.202-08:00',
      in: 'header',
      name: 'If-Modified-Since',
      schema: {
        format: 'date-time',
        type: 'string',
      },
    },
    includeOnline: {
      description: 'Allows an attachment to be seen by the end customer within their online invoice',
      example: true,
      in: 'query',
      name: 'IncludeOnline',
      schema: {
        default: false,
        type: 'boolean',
      },
    },
    requiredHeader: {
      description: 'Xero identifier for Tenant',
      example: 'YOUR_XERO_TENANT_ID',
      in: 'header',
      name: 'xero-tenant-id',
      required: true,
      schema: {
        type: 'string',
      },
    },
    summarizeErrors: {
      description: 'If false return 200 OK and mix of successfully created objects and any with validation errors',
      example: true,
      in: 'query',
      name: 'summarizeErrors',
      schema: {
        default: false,
        type: 'boolean',
      },
      'x-example-python': 'True',
    },
    unitdp: {
      description: 'e.g. unitdp=4 – (Unit Decimal Places) You can opt in to use four decimal places for unit amounts',
      example: 4,
      in: 'query',
      name: 'unitdp',
      schema: {
        type: 'integer',
      },
    },
  },
  requestBodies: {
    historyRecords: {
      content: {
        'application/json': {
          example: '{   "HistoryRecords": [   {   "Details": "Hello World" } ] }',
          schema: {
            $ref: '#/components/schemas/HistoryRecords',
          },
        },
      },
      description: 'HistoryRecords containing an array of HistoryRecord objects in body of request',
      required: true,
    },
  },
  responses: {
    '400Error': {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/Error',
          },
        },
      },
      description: 'A failed request due to validation error',
    },
    HistoryRecordCreated: {
      content: {
        'application/json': {
          example:
            '{ "Id": "d7525479-3392-44c0-bb37-ff4a0b5df5bd", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1550899400362)\\/", "HistoryRecords": [ { "DateUTCString": "2019-02-23T05:23:20", "DateUTC": "\\/Date(1550899400362)\\/", "Details": "Hello World", "ValidationErrors": [] } ] }',
          schema: {
            $ref: '#/components/schemas/HistoryRecords',
          },
        },
      },
      description: 'Success - return response of type HistoryRecords array of HistoryRecord objects',
    },
    HistoryRetrieved: {
      content: {
        'application/json': {
          example:
            '{ "Id": "cd54cc7b-b721-4207-b11d-7d13c7902f91", "Status": "OK", "ProviderName": "Xero API Partner", "DateTimeUTC": "\\/Date(1551311321819)\\/", "HistoryRecords": [ { "Changes": "Attached a file", "DateUTCString": "2018-11-08T15:01:21", "DateUTC": "\\/Date(1541689281470+0000)\\/", "User": "System Generated", "Details": "Attached the file sample2.jpg through the Xero API using Xero API Partner" }, { "Changes": "Credit Applied", "DateUTCString": "2016-10-17T20:46:01", "DateUTC": "\\/Date(1476737161173+0000)\\/", "User": "System Generated", "Details": "Bank transfer from Business Wells Fargo to My Savings on November 12, 2016 for 20.00." } ] }',
          schema: {
            $ref: '#/components/schemas/HistoryRecords',
          },
        },
      },
      description: 'Success - return response of HistoryRecords array of 0 to N HistoryRecord',
    },
  },
  schemas: {
    Account: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/accounts/',
      },
      properties: {
        AccountID: {
          description:
            'The Xero identifier for an account – specified as a string following  the endpoint name   e.g. /297c2dc5-cc47-4afd-8ec8-74990b8761e9',
          example: '00000000-0000-0000-0000-000000000000',
          format: 'uuid',
          type: 'string',
        },
        AddToWatchlist: {
          description: 'Boolean – describes whether the account is shown in the watchlist widget on the dashboard',
          type: 'boolean',
        },
        BankAccountNumber: {
          description: 'For bank accounts only (Account Type BANK)',
          type: 'string',
        },
        BankAccountType: {
          description: 'For bank accounts only. See Bank Account types',
          enum: ['BANK', 'CREDITCARD', 'PAYPAL', 'NONE', ''],
          type: 'string',
        },
        Class: {
          description: 'See Account Class Types',
          enum: ['ASSET', 'EQUITY', 'EXPENSE', 'LIABILITY', 'REVENUE'],
          readOnly: true,
          type: 'string',
        },
        Code: {
          description: 'Customer defined alpha numeric account code e.g 200 or SALES (max length = 10)',
          example: 4400,
          type: 'string',
        },
        CurrencyCode: {
          $ref: '#/components/schemas/CurrencyCode',
          type: 'string',
        },
        Description: {
          description:
            'Description of the Account. Valid for all types of accounts except bank accounts (max length = 4000)',
          type: 'string',
        },
        EnablePaymentsToAccount: {
          description: 'Boolean – describes whether account can have payments applied to it',
          type: 'boolean',
        },
        HasAttachments: {
          default: 'false',
          description: 'boolean to indicate if an account has an attachment (read only)',
          example: 'false',
          readOnly: true,
          type: 'boolean',
        },
        Name: {
          description: 'Name of account (max length = 150)',
          example: 'Food Sales',
          maxLength: 150,
          type: 'string',
        },
        ReportingCode: {
          description: 'Shown if set',
          type: 'string',
        },
        ReportingCodeName: {
          description: 'Shown if set',
          readOnly: true,
          type: 'string',
        },
        ShowInExpenseClaims: {
          description: 'Boolean – describes whether account code is available for use with expense claims',
          type: 'boolean',
        },
        Status: {
          description: 'Accounts with a status of ACTIVE can be updated to ARCHIVED. See Account Status Codes',
          enum: ['ACTIVE', 'ARCHIVED', 'DELETED'],
          type: 'string',
        },
        SystemAccount: {
          description:
            'If this is a system account then this element is returned. See System Account types. Note that non-system accounts may have this element set as either “” or null.',
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
          ],
          readOnly: true,
          type: 'string',
        },
        TaxType: {
          description: 'The tax type from TaxRates',
          type: 'string',
        },
        Type: {
          $ref: '#/components/schemas/AccountType',
          type: 'string',
        },
        UpdatedDateUTC: {
          description: 'Last modified date UTC format',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        ValidationErrors: {
          description: 'Displays array of validation error messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    AccountType: {
      description: 'See Account Types',
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
      ],
      type: 'string',
    },
    Accounts: {
      properties: {
        Accounts: {
          items: {
            $ref: '#/components/schemas/Account',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    AccountsPayable: {
      properties: {
        Outstanding: {
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Overdue: {
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
      },
      type: 'object',
    },
    AccountsReceivable: {
      properties: {
        Outstanding: {
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Overdue: {
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
      },
      type: 'object',
    },
    Action: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/organisation/',
      },
      properties: {
        Name: {
          description: 'Name of the actions for this organisation',
          example: 'UseMulticurrency',
          type: 'string',
        },
        Status: {
          description: 'Status of the action for this organisation',
          enum: ['ALLOWED', 'NOT-ALLOWED'],
          type: 'string',
        },
      },
    },
    Actions: {
      properties: {
        Actions: {
          items: {
            $ref: '#/components/schemas/Action',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Address: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/types',
      },
      properties: {
        AddressLine1: {
          description: 'max length = 500',
          maxLength: 500,
          type: 'string',
        },
        AddressLine2: {
          description: 'max length = 500',
          maxLength: 500,
          type: 'string',
        },
        AddressLine3: {
          description: 'max length = 500',
          maxLength: 500,
          type: 'string',
        },
        AddressLine4: {
          description: 'max length = 500',
          maxLength: 500,
          type: 'string',
        },
        AddressType: {
          description: 'define the type of address',
          enum: ['POBOX', 'STREET'],
          type: 'string',
        },
        AttentionTo: {
          description: 'max length = 255',
          maxLength: 255,
          type: 'string',
        },
        City: {
          description: 'max length = 255',
          maxLength: 255,
          type: 'string',
        },
        Country: {
          description: 'max length = 50, [A-Z], [a-z] only',
          maxLength: 50,
          type: 'string',
        },
        PostalCode: {
          description: 'max length = 50',
          maxLength: 50,
          type: 'string',
        },
        Region: {
          description: 'max length = 255',
          maxLength: 255,
          type: 'string',
        },
      },
      type: 'object',
    },
    AddressForOrganisation: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/types',
      },
      properties: {
        AddressLine1: {
          description: 'max length = 500',
          maxLength: 500,
          type: 'string',
        },
        AddressLine2: {
          description: 'max length = 500',
          maxLength: 500,
          type: 'string',
        },
        AddressLine3: {
          description: 'max length = 500',
          maxLength: 500,
          type: 'string',
        },
        AddressLine4: {
          description: 'max length = 500',
          maxLength: 500,
          type: 'string',
        },
        AddressType: {
          description: 'define the type of address',
          enum: ['POBOX', 'STREET', 'DELIVERY'],
          type: 'string',
        },
        AttentionTo: {
          description: 'max length = 255',
          maxLength: 255,
          type: 'string',
        },
        City: {
          description: 'max length = 255',
          maxLength: 255,
          type: 'string',
        },
        Country: {
          description: 'max length = 50, [A-Z], [a-z] only',
          maxLength: 50,
          type: 'string',
        },
        PostalCode: {
          description: 'max length = 50',
          maxLength: 50,
          type: 'string',
        },
        Region: {
          description: 'max length = 255',
          maxLength: 255,
          type: 'string',
        },
      },
      type: 'object',
    },
    Allocation: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/prepayments/',
      },
      properties: {
        Amount: {
          description: 'the amount being applied to the invoice',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        CreditNote: {
          $ref: '#/components/schemas/CreditNote',
        },
        Date: {
          description: 'the date the allocation is applied YYYY-MM-DD.',
          type: 'string',
          'x-is-msdate': true,
        },
        Invoice: {
          $ref: '#/components/schemas/Invoice',
        },
        Overpayment: {
          $ref: '#/components/schemas/Overpayment',
        },
        Prepayment: {
          $ref: '#/components/schemas/Prepayment',
        },
        StatusAttributeString: {
          description: 'A string to indicate if a invoice status',
          type: 'string',
        },
        ValidationErrors: {
          description: 'Displays array of validation error messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
      },
      required: ['Amount', 'Invoice', 'Date'],
      type: 'object',
    },
    Allocations: {
      properties: {
        Allocations: {
          items: {
            $ref: '#/components/schemas/Allocation',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Attachment: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/attachments/',
      },
      properties: {
        AttachmentID: {
          description: 'Unique ID for the file',
          example: '00000000-0000-0000-0000-000000000000',
          format: 'uuid',
          type: 'string',
        },
        ContentLength: {
          description: 'Length of the file content',
          type: 'integer',
        },
        FileName: {
          description: 'Name of the file',
          example: 'xero-dev.jpg',
          type: 'string',
        },
        IncludeOnline: {
          description: 'Include the file with the online invoice',
          type: 'boolean',
        },
        MimeType: {
          description: 'Type of file',
          example: 'image/jpg',
          type: 'string',
        },
        Url: {
          description: 'URL to the file on xero.com',
          example:
            'https://api.xero.com/api.xro/2.0/Accounts/da962997-a8bd-4dff-9616-01cdc199283f/Attachments/sample5.jpg',
          type: 'string',
        },
      },
      type: 'object',
    },
    Attachments: {
      properties: {
        Attachments: {
          items: {
            $ref: '#/components/schemas/Attachment',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    BalanceDetails: {
      description: 'An array to specify multiple currency balances of an account',
      properties: {
        Balance: {
          description: 'The opening balances of the account. Debits are positive, credits are negative values',
          format: 'double',
          type: 'number',
        },
        CurrencyCode: {
          description: 'The currency of the balance (Not required for base currency)',
          type: 'string',
        },
        CurrencyRate: {
          description:
            '(Optional) Exchange rate to base currency when money is spent or received. If not specified, XE rate for the day is applied',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
      },
      type: 'object',
    },
    Balances: {
      description:
        'The raw AccountsReceivable(sales invoices) and AccountsPayable(bills) outstanding and overdue amounts, not converted to base currency (read only)',
      properties: {
        AccountsPayable: {
          $ref: '#/components/schemas/AccountsPayable',
        },
        AccountsReceivable: {
          $ref: '#/components/schemas/AccountsReceivable',
        },
      },
      type: 'object',
    },
    BankTransaction: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/banktransactions/',
      },
      properties: {
        BankAccount: {
          $ref: '#/components/schemas/Account',
        },
        BankTransactionID: {
          description: 'Xero generated unique identifier for bank transaction',
          example: '00000000-0000-0000-0000-000000000000',
          format: 'uuid',
          type: 'string',
        },
        Contact: {
          $ref: '#/components/schemas/Contact',
        },
        CurrencyCode: {
          $ref: '#/components/schemas/CurrencyCode',
          type: 'string',
        },
        CurrencyRate: {
          description:
            'Exchange rate to base currency when money is spent or received. e.g.0.7500 Only used for bank transactions in non base currency. If this isn’t specified for non base currency accounts then either the user-defined rate (preference) or the XE.com day rate will be used. Setting currency is only supported on overpayments.',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Date: {
          description: 'Date of transaction – YYYY-MM-DD',
          type: 'string',
          'x-is-msdate': true,
        },
        HasAttachments: {
          default: 'false',
          description: 'Boolean to indicate if a bank transaction has an attachment',
          example: 'false',
          readOnly: true,
          type: 'boolean',
        },
        IsReconciled: {
          description: 'Boolean to show if transaction is reconciled',
          type: 'boolean',
        },
        LineAmountTypes: {
          $ref: '#/components/schemas/LineAmountTypes',
          type: 'string',
        },
        LineItems: {
          description: 'See LineItems',
          items: {
            $ref: '#/components/schemas/LineItem',
          },
          type: 'array',
        },
        OverpaymentID: {
          description:
            'Xero generated unique identifier for an Overpayment. This will be returned on BankTransactions with a Type of SPEND-OVERPAYMENT or RECEIVE-OVERPAYMENT',
          example: '00000000-0000-0000-0000-000000000000',
          format: 'uuid',
          readOnly: true,
          type: 'string',
        },
        PrepaymentID: {
          description:
            'Xero generated unique identifier for a Prepayment. This will be returned on BankTransactions with a Type of SPEND-PREPAYMENT or RECEIVE-PREPAYMENT',
          example: '00000000-0000-0000-0000-000000000000',
          format: 'uuid',
          readOnly: true,
          type: 'string',
        },
        Reference: {
          description: 'Reference for the transaction. Only supported for SPEND and RECEIVE transactions.',
          type: 'string',
        },
        Status: {
          description: 'See Bank Transaction Status Codes',
          enum: ['AUTHORISED', 'DELETED', 'VOIDED'],
          type: 'string',
        },
        StatusAttributeString: {
          description: 'A string to indicate if a invoice status',
          type: 'string',
        },
        SubTotal: {
          description: 'Total of bank transaction excluding taxes',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Total: {
          description: 'Total of bank transaction tax inclusive',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        TotalTax: {
          description: 'Total tax on bank transaction',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Type: {
          description: 'See Bank Transaction Types',
          enum: [
            'RECEIVE',
            'RECEIVE-OVERPAYMENT',
            'RECEIVE-PREPAYMENT',
            'SPEND',
            'SPEND-OVERPAYMENT',
            'SPEND-PREPAYMENT',
            'RECEIVE-TRANSFER',
            'SPEND-TRANSFER',
          ],
          type: 'string',
        },
        UpdatedDateUTC: {
          description: 'Last modified date UTC format',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        Url: {
          description: 'URL link to a source document – shown as “Go to App Name”',
          type: 'string',
        },
        ValidationErrors: {
          description: 'Displays array of validation error messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
      },
      required: ['Type', 'LineItems', 'BankAccount'],
      type: 'object',
    },
    BankTransactions: {
      properties: {
        BankTransactions: {
          items: {
            $ref: '#/components/schemas/BankTransaction',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    BankTransfer: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/bank-transfers/',
      },
      properties: {
        Amount: {
          description: 'amount of the transaction',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        BankTransferID: {
          description: 'The identifier of the Bank Transfer',
          format: 'uuid',
          readOnly: true,
          type: 'string',
        },
        CreatedDateUTC: {
          description: 'UTC timestamp of creation date of bank transfer',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        CurrencyRate: {
          description: 'The currency rate',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        Date: {
          description: 'The date of the Transfer YYYY-MM-DD',
          type: 'string',
          'x-is-msdate': true,
        },
        FromBankAccount: {
          $ref: '#/components/schemas/Account',
        },
        FromBankTransactionID: {
          description: 'The Bank Transaction ID for the source account',
          format: 'uuid',
          readOnly: true,
          type: 'string',
        },
        HasAttachments: {
          default: 'false',
          description: 'Boolean to indicate if a Bank Transfer has an attachment',
          example: 'false',
          readOnly: true,
          type: 'boolean',
        },
        ToBankAccount: {
          $ref: '#/components/schemas/Account',
        },
        ToBankTransactionID: {
          description: 'The Bank Transaction ID for the destination account',
          format: 'uuid',
          readOnly: true,
          type: 'string',
        },
        ValidationErrors: {
          description: 'Displays array of validation error messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
      },
      required: ['FromBankAccount', 'ToBankAccount', 'Amount'],
      type: 'object',
    },
    BankTransfers: {
      properties: {
        BankTransfers: {
          items: {
            $ref: '#/components/schemas/BankTransfer',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    BatchPayment: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/BatchPayments/',
      },
      properties: {
        Account: {
          $ref: '#/components/schemas/Account',
        },
        Amount: {
          description:
            'The amount of the payment. Must be less than or equal to the outstanding amount owing on the invoice e.g. 200.00',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        BatchPaymentID: {
          description: 'The Xero generated unique identifier for the bank transaction (read-only)',
          format: 'uuid',
          readOnly: true,
          type: 'string',
        },
        Code: {
          description:
            '(NZ Only) Optional references for the batch payment transaction. It will also show with the batch payment transaction in the bank reconciliation Find & Match screen. Depending on your individual bank, the detail may also show on the bank statement you import into Xero.',
          maxLength: 12,
          type: 'string',
        },
        Date: {
          description: 'Date the payment is being made (YYYY-MM-DD) e.g. 2009-09-06',
          type: 'string',
          'x-is-msdate': true,
        },
        DateString: {
          description: 'Date the payment is being made (YYYY-MM-DD) e.g. 2009-09-06',
          type: 'string',
        },
        Details: {
          description:
            '(Non-NZ Only) These details are sent to the org’s bank as a reference for the batch payment transaction. They will also show with the batch payment transaction in the bank reconciliation Find & Match screen. Depending on your individual bank, the detail may also show on the bank statement imported into Xero. Maximum field length = 18',
          type: 'string',
        },
        IsReconciled: {
          description: 'Booelan that tells you if the batch payment has been reconciled (read-only)',
          readOnly: true,
          type: 'string',
        },
        Narrative: {
          description: '(UK Only) Only shows on the statement line in Xero. Max length =18',
          maxLength: 18,
          type: 'string',
        },
        Particulars: {
          description:
            '(NZ Only) Optional references for the batch payment transaction. It will also show with the batch payment transaction in the bank reconciliation Find & Match screen. Depending on your individual bank, the detail may also show on the bank statement you import into Xero.',
          maxLength: 12,
          type: 'string',
        },
        Payments: {
          description: 'An array of payments',
          items: {
            $ref: '#/components/schemas/Payment',
          },
          type: 'array',
        },
        Reference: {
          description:
            '(NZ Only) Optional references for the batch payment transaction. It will also show with the batch payment transaction in the bank reconciliation Find & Match screen. Depending on your individual bank, the detail may also show on the bank statement you import into Xero.',
          maxLength: 255,
          type: 'string',
        },
        Status: {
          description:
            'AUTHORISED or DELETED (read-only). New batch payments will have a status of AUTHORISED. It is not possible to delete batch payments via the API.',
          enum: ['AUTHORISED', 'DELETED'],
          readOnly: true,
          type: 'string',
        },
        TotalAmount: {
          description: 'The total of the payments that make up the batch (read-only)',
          readOnly: true,
          type: 'string',
        },
        Type: {
          description: 'PAYBATCH for bill payments or RECBATCH for sales invoice payments (read-only)',
          enum: ['PAYBATCH', 'RECBATCH'],
          readOnly: true,
          type: 'string',
        },
        UpdatedDateUTC: {
          description: 'UTC timestamp of last update to the payment',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
      },
      type: 'object',
    },
    BatchPaymentDetails: {
      description: 'Bank details for use on a batch payment stored with each contact',
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/Contact/',
      },
      properties: {
        BankAccountName: {
          description: 'Name of bank for use with Batch Payments',
          example: 'ACME Bank',
          type: 'string',
        },
        BankAccountNumber: {
          description: 'Bank account number for use with Batch Payments',
          example: '123-456-1111111',
          type: 'string',
        },
        Code: {
          description:
            '(NZ Only) Optional references for the batch payment transaction. It will also show with the batch payment transaction in the bank reconciliation Find & Match screen. Depending on your individual bank, the detail may also show on the bank statement you import into Xero.',
          example: 'ABC',
          maxLength: 12,
          type: 'string',
        },
        Details: {
          description:
            '(Non-NZ Only) These details are sent to the org’s bank as a reference for the batch payment transaction. They will also show with the batch payment transaction in the bank reconciliation Find & Match screen. Depending on your individual bank, the detail may also show on the bank statement imported into Xero. Maximum field length = 18',
          example: 'Hello World',
          type: 'string',
        },
        Reference: {
          description:
            '(NZ Only) Optional references for the batch payment transaction. It will also show with the batch payment transaction in the bank reconciliation Find & Match screen. Depending on your individual bank, the detail may also show on the bank statement you import into Xero.',
          example: 'Foobar',
          maxLength: 12,
          type: 'string',
        },
      },
    },
    BatchPayments: {
      properties: {
        BatchPayments: {
          items: {
            $ref: '#/components/schemas/BatchPayment',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Bill: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/organisation/',
      },
      properties: {
        Day: {
          description: 'Day of Month (0-31)',
          type: 'integer',
        },
        Type: {
          $ref: '#/components/schemas/PaymentTermType',
        },
      },
      type: 'object',
    },
    BrandingTheme: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/branding-themes/',
      },
      properties: {
        BrandingThemeID: {
          description: 'Xero identifier',
          format: 'uuid',
          type: 'string',
        },
        CreatedDateUTC: {
          description: 'UTC timestamp of creation date of branding theme',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        LogoUrl: {
          description: 'The location of the image file used as the logo on this branding theme',
          type: 'string',
        },
        Name: {
          description: 'Name of branding theme',
          type: 'string',
        },
        SortOrder: {
          description: 'Integer – ranked order of branding theme. The default branding theme has a value of 0',
          type: 'integer',
        },
        Type: {
          description: 'Always INVOICE',
          enum: ['INVOICE'],
          type: 'string',
        },
      },
      type: 'object',
    },
    BrandingThemes: {
      properties: {
        BrandingThemes: {
          items: {
            $ref: '#/components/schemas/BrandingTheme',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    CISOrgSetting: {
      externalDocs: {
        url: 'https://developer.xero.com/documentation/api/organisation',
      },
      properties: {
        CISContractorEnabled: {
          description: 'true or false - Boolean that describes if the organisation is a CIS Contractor',
          type: 'boolean',
        },
        CISSubContractorEnabled: {
          description: 'true or false - Boolean that describes if the organisation is a CIS SubContractor',
          type: 'boolean',
        },
        Rate: {
          description: 'CIS Deduction rate for the organisation',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
      },
    },
    CISOrgSettings: {
      properties: {
        CISSettings: {
          items: {
            $ref: '#/components/schemas/CISOrgSetting',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    CISSetting: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/contacts/',
      },
      properties: {
        CISEnabled: {
          description: 'Boolean that describes if the contact is a CIS Subcontractor',
          type: 'boolean',
        },
        Rate: {
          description:
            'CIS Deduction rate for the contact if he is a subcontractor. If the contact is not CISEnabled, then the rate is not returned',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
      },
    },
    CISSettings: {
      properties: {
        CISSettings: {
          items: {
            $ref: '#/components/schemas/CISSetting',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Contact: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/contacts/',
      },
      properties: {
        AccountNumber: {
          description:
            'A user defined account number. This can be updated via the API and the Xero UI (max length = 50)',
          maxLength: 50,
          type: 'string',
        },
        AccountsPayableTaxType: {
          description: 'The tax type from TaxRates',
          type: 'string',
        },
        AccountsReceivableTaxType: {
          description: 'The tax type from TaxRates',
          type: 'string',
        },
        Addresses: {
          description: 'Store certain address types for a contact – see address types',
          items: {
            $ref: '#/components/schemas/Address',
          },
          type: 'array',
        },
        Attachments: {
          description: 'Displays array of attachments from the API',
          items: {
            $ref: '#/components/schemas/Attachment',
          },
          type: 'array',
        },
        Balances: {
          $ref: '#/components/schemas/Balances',
        },
        BankAccountDetails: {
          description: 'Bank account number of contact',
          type: 'string',
        },
        BatchPayments: {
          $ref: '#/components/schemas/BatchPaymentDetails',
        },
        BrandingTheme: {
          $ref: '#/components/schemas/BrandingTheme',
        },
        ContactGroups: {
          description: 'Displays which contact groups a contact is included in',
          items: {
            $ref: '#/components/schemas/ContactGroup',
          },
          type: 'array',
        },
        ContactID: {
          description: 'Xero identifier',
          format: 'uuid',
          type: 'string',
        },
        ContactNumber: {
          description:
            'This can be updated via the API only i.e. This field is read only on the Xero contact screen, used to identify contacts in external systems (max length = 50). If the Contact Number is used, this is displayed as Contact Code in the Contacts UI in Xero.',
          maxLength: 50,
          type: 'string',
        },
        ContactPersons: {
          description: 'See contact persons',
          items: {
            $ref: '#/components/schemas/ContactPerson',
          },
          type: 'array',
        },
        ContactStatus: {
          description: 'Current status of a contact – see contact status types',
          enum: ['ACTIVE', 'ARCHIVED', 'GDPRREQUEST'],
          type: 'string',
        },
        DefaultCurrency: {
          $ref: '#/components/schemas/CurrencyCode',
          type: 'string',
        },
        Discount: {
          description: 'The default discount rate for the contact (read only)',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        EmailAddress: {
          description: 'Email address of contact person (umlauts not supported) (max length  = 255)',
          maxLength: 255,
          type: 'string',
        },
        FirstName: {
          description: 'First name of contact person (max length = 255)',
          maxLength: 255,
          type: 'string',
        },
        HasAttachments: {
          default: 'false',
          description: 'A boolean to indicate if a contact has an attachment',
          example: 'false',
          type: 'boolean',
        },
        HasValidationErrors: {
          default: 'false',
          description: 'A boolean to indicate if a contact has an validation errors',
          example: 'false',
          type: 'boolean',
        },
        IsCustomer: {
          description:
            'true or false – Boolean that describes if a contact has any AR invoices entered against them. Cannot be set via PUT or POST – it is automatically set when an accounts receivable invoice is generated against this contact.',
          type: 'boolean',
        },
        IsSupplier: {
          description:
            'true or false – Boolean that describes if a contact that has any AP  invoices entered against them. Cannot be set via PUT or POST – it is automatically set when an accounts payable invoice is generated against this contact.',
          type: 'boolean',
        },
        LastName: {
          description: 'Last name of contact person (max length = 255)',
          maxLength: 255,
          type: 'string',
        },
        Name: {
          description: 'Full name of contact/organisation (max length = 255)',
          maxLength: 255,
          type: 'string',
        },
        PaymentTerms: {
          $ref: '#/components/schemas/PaymentTerm',
        },
        Phones: {
          description: 'Store certain phone types for a contact – see phone types',
          items: {
            $ref: '#/components/schemas/Phone',
          },
          type: 'array',
        },
        PurchasesDefaultAccountCode: {
          description: 'The default purchases account code for contacts',
          type: 'string',
        },
        PurchasesTrackingCategories: {
          description: 'The default purchases tracking categories for contacts',
          items: {
            $ref: '#/components/schemas/SalesTrackingCategory',
          },
          type: 'array',
        },
        SalesDefaultAccountCode: {
          description: 'The default sales account code for contacts',
          type: 'string',
        },
        SalesTrackingCategories: {
          description: 'The default sales tracking categories for contacts',
          items: {
            $ref: '#/components/schemas/SalesTrackingCategory',
          },
          type: 'array',
        },
        SkypeUserName: {
          description: 'Skype user name of contact',
          type: 'string',
        },
        StatusAttributeString: {
          description: 'Status of object',
          type: 'string',
        },
        TaxNumber: {
          description:
            'Tax number of contact – this is also known as the ABN (Australia), GST Number (New Zealand), VAT Number (UK) or Tax ID Number (US and global) in the Xero UI depending on which regionalized version of Xero you are using (max length = 50)',
          maxLength: 50,
          type: 'string',
        },
        TrackingCategoryName: {
          description:
            'The name of the Tracking Category assigned to the contact under SalesTrackingCategories and PurchasesTrackingCategories',
          type: 'string',
        },
        TrackingCategoryOption: {
          description:
            'The name of the Tracking Option assigned to the contact under SalesTrackingCategories and PurchasesTrackingCategories',
          type: 'string',
        },
        UpdatedDateUTC: {
          description: 'UTC timestamp of last update to contact',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        ValidationErrors: {
          description: 'Displays validation errors returned from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
        Website: {
          description: 'Website address for contact (read only)',
          readOnly: true,
          type: 'string',
        },
        XeroNetworkKey: {
          description: 'Store XeroNetworkKey for contacts.',
          type: 'string',
        },
      },
      type: 'object',
    },
    ContactGroup: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/contactgroups/',
      },
      properties: {
        ContactGroupID: {
          description:
            'The Xero identifier for an contact group – specified as a string following the endpoint name. e.g. /297c2dc5-cc47-4afd-8ec8-74990b8761e9',
          format: 'uuid',
          type: 'string',
        },
        Contacts: {
          description:
            'The ContactID and Name of Contacts in a contact group. Returned on GETs when the ContactGroupID is supplied in the URL.',
          items: {
            $ref: '#/components/schemas/Contact',
          },
          type: 'array',
        },
        Name: {
          description: 'The Name of the contact group. Required when creating a new contact  group',
          type: 'string',
        },
        Status: {
          description:
            'The Status of a contact group. To delete a contact group update the status to DELETED. Only contact groups with a status of ACTIVE are returned on GETs.',
          enum: ['ACTIVE', 'DELETED'],
          type: 'string',
        },
      },
      type: 'object',
    },
    ContactGroups: {
      properties: {
        ContactGroups: {
          items: {
            $ref: '#/components/schemas/ContactGroup',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    ContactPerson: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/contacts/',
      },
      properties: {
        EmailAddress: {
          description: 'Email address of person',
          type: 'string',
        },
        FirstName: {
          description: 'First name of person',
          type: 'string',
        },
        IncludeInEmails: {
          description: 'boolean to indicate whether contact should be included on emails with invoices etc.',
          type: 'boolean',
        },
        LastName: {
          description: 'Last name of person',
          type: 'string',
        },
      },
      type: 'object',
    },
    Contacts: {
      properties: {
        Contacts: {
          items: {
            $ref: '#/components/schemas/Contact',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    ConversionBalances: {
      description: 'Balance supplied for each account that has a value as at the conversion date.',
      properties: {
        AccountCode: {
          description: 'The account code for a account',
          type: 'string',
        },
        Balance: {
          description: 'The opening balances of the account. Debits are positive, credits are negative values',
          format: 'double',
          type: 'number',
        },
        BalanceDetails: {
          items: {
            $ref: '#/components/schemas/BalanceDetails',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    ConversionDate: {
      description: 'The date when the organisation starts using Xero',
      properties: {
        Month: {
          description: 'The month the organisation starts using Xero. Value is an integer between 1 and 12',
          example: 1,
          type: 'integer',
        },
        Year: {
          description: 'The year the organisation starts using Xero. Value is an integer greater than 2006',
          example: 2020,
          type: 'integer',
        },
      },
      type: 'object',
    },
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
      ],
      type: 'string',
    },
    CreditNote: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/credit-notes/',
      },
      properties: {
        Allocations: {
          description: 'See Allocations',
          items: {
            $ref: '#/components/schemas/Allocation',
          },
          type: 'array',
        },
        AppliedAmount: {
          description: 'The amount of applied to an invoice',
          example: 2,
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        BrandingThemeID: {
          description: 'See BrandingThemes',
          format: 'uuid',
          type: 'string',
        },
        CISDeduction: {
          description: 'CIS deduction for UK contractors',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        CISRate: {
          description: 'CIS Deduction rate for the organisation',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        Contact: {
          $ref: '#/components/schemas/Contact',
        },
        CreditNoteID: {
          description: 'Xero generated unique identifier',
          format: 'uuid',
          type: 'string',
        },
        CreditNoteNumber: {
          description:
            'ACCRECCREDIT – Unique alpha numeric code identifying credit note (when missing will auto-generate from your Organisation Invoice Settings)',
          type: 'string',
        },
        CurrencyCode: {
          $ref: '#/components/schemas/CurrencyCode',
          description: 'The specified currency code',
          type: 'string',
        },
        CurrencyRate: {
          description:
            'The currency rate for a multicurrency invoice. If no rate is specified, the XE.com day rate is used',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Date: {
          description:
            'The date the credit note is issued YYYY-MM-DD. If the Date element is not specified then it will default to the current date based on the timezone setting of the organisation',
          type: 'string',
          'x-is-msdate': true,
        },
        DueDate: {
          description: 'Date invoice is due – YYYY-MM-DD',
          type: 'string',
          'x-is-msdate': true,
        },
        FullyPaidOnDate: {
          description: 'Date when credit note was fully paid(UTC format)',
          type: 'string',
          'x-is-msdate': true,
        },
        HasAttachments: {
          default: 'false',
          description: 'boolean to indicate if a credit note has an attachment',
          example: 'false',
          type: 'boolean',
        },
        HasErrors: {
          default: 'false',
          description: 'A boolean to indicate if a credit note has an validation errors',
          example: 'false',
          type: 'boolean',
        },
        LineAmountTypes: {
          $ref: '#/components/schemas/LineAmountTypes',
          type: 'string',
        },
        LineItems: {
          description: 'See Invoice Line Items',
          items: {
            $ref: '#/components/schemas/LineItem',
          },
          type: 'array',
        },
        Payments: {
          description: 'See Payments',
          items: {
            $ref: '#/components/schemas/Payment',
          },
          type: 'array',
        },
        Reference: {
          description: 'ACCRECCREDIT only – additional reference number',
          type: 'string',
        },
        RemainingCredit: {
          description: 'The remaining credit balance on the Credit Note',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        SentToContact: {
          description:
            'boolean to indicate if a credit note has been sent to a contact via  the Xero app (currently read only)',
          readOnly: true,
          type: 'boolean',
        },
        Status: {
          description: 'See Credit Note Status Codes',
          enum: ['DRAFT', 'SUBMITTED', 'DELETED', 'AUTHORISED', 'PAID', 'VOIDED'],
          type: 'string',
        },
        StatusAttributeString: {
          description: 'A string to indicate if a invoice status',
          type: 'string',
        },
        SubTotal: {
          description: 'The subtotal of the credit note excluding taxes',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Total: {
          description: 'The total of the Credit Note(subtotal + total tax)',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        TotalTax: {
          description: 'The total tax on the credit note',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Type: {
          description: 'See Credit Note Types',
          enum: ['ACCPAYCREDIT', 'ACCRECCREDIT'],
          type: 'string',
        },
        UpdatedDateUTC: {
          description: 'UTC timestamp of last update to the credit note',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        ValidationErrors: {
          description: 'Displays array of validation error messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
        Warnings: {
          description: 'Displays array of warning messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    CreditNotes: {
      properties: {
        CreditNotes: {
          items: {
            $ref: '#/components/schemas/CreditNote',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Currencies: {
      properties: {
        Currencies: {
          items: {
            $ref: '#/components/schemas/Currency',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Currency: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/currencies/',
      },
      properties: {
        Code: {
          $ref: '#/components/schemas/CurrencyCode',
          type: 'string',
        },
        Description: {
          description: 'Name of Currency',
          type: 'string',
        },
      },
      type: 'object',
    },
    CurrencyCode: {
      description: '3 letter alpha code for the currency – see list of currency codes',
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
      ],
      type: 'string',
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
      ],
    },
    Element: {
      externalDocs: {
        url: 'https://developer.xero.com/documentation/api/http-response-codes',
      },
      properties: {
        BankTransactionID: {
          format: 'uuid',
          type: 'string',
        },
        BatchPaymentID: {
          description: 'Unique ID for batch payment object with validation error',
          format: 'uuid',
          type: 'string',
        },
        ContactID: {
          format: 'uuid',
          type: 'string',
        },
        CreditNoteID: {
          format: 'uuid',
          type: 'string',
        },
        InvoiceID: {
          format: 'uuid',
          type: 'string',
        },
        ItemID: {
          format: 'uuid',
          type: 'string',
        },
        PurchaseOrderID: {
          format: 'uuid',
          type: 'string',
        },
        ValidationErrors: {
          description: 'Array of Validation Error message',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    Employee: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/employees/',
      },
      properties: {
        EmployeeID: {
          description: 'The Xero identifier for an employee e.g. 297c2dc5-cc47-4afd-8ec8-74990b8761e9',
          format: 'uuid',
          type: 'string',
        },
        ExternalLink: {
          $ref: '#/components/schemas/ExternalLink',
        },
        FirstName: {
          description: 'First name of an employee (max length = 255)',
          maxLength: 255,
          type: 'string',
        },
        LastName: {
          description: 'Last name of an employee (max length = 255)',
          maxLength: 255,
          type: 'string',
        },
        Status: {
          description: 'Current status of an employee – see contact status types',
          enum: ['ACTIVE', 'ARCHIVED', 'GDPRREQUEST', 'DELETED'],
          type: 'string',
        },
        StatusAttributeString: {
          description: 'A string to indicate if a invoice status',
          example: 'ERROR',
          type: 'string',
        },
        UpdatedDateUTC: {
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        ValidationErrors: {
          description: 'Displays array of validation error messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    Employees: {
      properties: {
        Employees: {
          items: {
            $ref: '#/components/schemas/Employee',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Error: {
      externalDocs: {
        url: 'https://developer.xero.com/documentation/api/http-response-codes',
      },
      properties: {
        Elements: {
          description: 'Array of Elements of validation Errors',
          items: {
            $ref: '#/components/schemas/Element',
          },
          type: 'array',
        },
        ErrorNumber: {
          description: 'Exception number',
          type: 'integer',
        },
        Message: {
          description: 'Exception message',
          type: 'string',
        },
        Type: {
          description: 'Exception type',
          type: 'string',
        },
      },
      type: 'object',
    },
    ExpenseClaim: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/expense-claims/',
      },
      properties: {
        AmountDue: {
          description: 'The amount due to be paid for an expense claim',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        AmountPaid: {
          description: 'The amount still to pay for an expense claim',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        ExpenseClaimID: {
          description: 'Xero generated unique identifier for an expense claim',
          format: 'uuid',
          type: 'string',
        },
        PaymentDueDate: {
          description: 'The date when the expense claim is due to be paid YYYY-MM-DD',
          readOnly: true,
          type: 'string',
          'x-is-msdate': true,
        },
        Payments: {
          description: 'See Payments',
          items: {
            $ref: '#/components/schemas/Payment',
          },
          type: 'array',
        },
        ReceiptID: {
          description: 'The Xero identifier for the Receipt e.g. e59a2c7f-1306-4078-a0f3-73537afcbba9',
          format: 'uuid',
          type: 'string',
        },
        Receipts: {
          items: {
            $ref: '#/components/schemas/Receipt',
          },
          type: 'array',
        },
        ReportingDate: {
          description: 'The date the expense claim will be reported in Xero YYYY-MM-DD',
          readOnly: true,
          type: 'string',
          'x-is-msdate': true,
        },
        Status: {
          description: 'Current status of an expense claim – see status types',
          enum: ['SUBMITTED', 'AUTHORISED', 'PAID', 'VOIDED', 'DELETED'],
          type: 'string',
        },
        Total: {
          description: 'The total of an expense claim being paid',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        UpdatedDateUTC: {
          description: 'Last modified date UTC format',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        User: {
          $ref: '#/components/schemas/User',
        },
      },
      type: 'object',
    },
    ExpenseClaims: {
      properties: {
        ExpenseClaims: {
          items: {
            $ref: '#/components/schemas/ExpenseClaim',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    ExternalLink: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/organisation/',
      },
      properties: {
        Description: {
          type: 'string',
        },
        LinkType: {
          description: 'See External link types',
          enum: ['Facebook', 'GooglePlus', 'LinkedIn', 'Twitter', 'Website'],
          type: 'string',
        },
        Url: {
          description: 'URL for service e.g. http://twitter.com/xeroapi',
          type: 'string',
        },
      },
      type: 'object',
    },
    HistoryRecord: {
      externalDocs: {
        url: 'https://developer.xero.com/documentation/api/history-and-notes',
      },
      properties: {
        Changes: {
          description: 'Name of branding theme',
          type: 'string',
        },
        DateUTC: {
          description: 'UTC timestamp of creation date of branding theme',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        Details: {
          description: 'details',
          type: 'string',
        },
        User: {
          description: 'has a value of 0',
          type: 'string',
        },
      },
      type: 'object',
    },
    HistoryRecords: {
      properties: {
        HistoryRecords: {
          items: {
            $ref: '#/components/schemas/HistoryRecord',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    ImportSummary: {
      description: 'A summary of the import from setup endpoint',
      externalDocs: {
        url: 'https://developer.xero.com/documentation/api-guides/conversions',
      },
      properties: {
        Accounts: {
          $ref: '#/components/schemas/ImportSummaryAccounts',
        },
        Organisation: {
          $ref: '#/components/schemas/ImportSummaryOrganisation',
        },
      },
      type: 'object',
    },
    ImportSummaryAccounts: {
      description: 'A summary of the accounts changes',
      properties: {
        Deleted: {
          description: 'The number of accounts deleted',
          format: 'integer',
          type: 'number',
        },
        Errored: {
          description: 'The number of accounts that had an error',
          format: 'integer',
          type: 'number',
        },
        Locked: {
          description: 'The number of locked accounts',
          format: 'integer',
          type: 'number',
        },
        New: {
          description: 'The number of new accounts created',
          format: 'integer',
          type: 'number',
        },
        NewOrUpdated: {
          description: 'The number of new or updated accounts',
          format: 'integer',
          type: 'number',
        },
        Present: {
          type: 'boolean',
        },
        System: {
          description: 'The number of system accounts',
          format: 'integer',
          type: 'number',
        },
        Total: {
          description: 'The total number of accounts in the org',
          format: 'integer',
          type: 'number',
        },
        Updated: {
          description: 'The number of accounts updated',
          format: 'integer',
          type: 'number',
        },
      },
      type: 'object',
    },
    ImportSummaryObject: {
      externalDocs: {
        url: 'https://developer.xero.com/documentation/api-guides/conversions',
      },
      properties: {
        ImportSummary: {
          $ref: '#/components/schemas/ImportSummary',
        },
      },
    },
    ImportSummaryOrganisation: {
      properties: {
        Present: {
          type: 'boolean',
        },
      },
      type: 'object',
    },
    Invoice: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/invoices/',
      },
      properties: {
        AmountCredited: {
          description: 'Sum of all credit notes, over-payments and pre-payments applied to invoice',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        AmountDue: {
          description: 'Amount remaining to be paid on invoice',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        AmountPaid: {
          description: 'Sum of payments received for invoice',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        Attachments: {
          description: 'Displays array of attachments from the API',
          items: {
            $ref: '#/components/schemas/Attachment',
          },
          type: 'array',
        },
        BrandingThemeID: {
          description: 'See BrandingThemes',
          format: 'uuid',
          type: 'string',
        },
        CISDeduction: {
          description: 'CIS deduction for UK contractors',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        CISRate: {
          description: 'CIS Deduction rate for the organisation',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        Contact: {
          $ref: '#/components/schemas/Contact',
        },
        CreditNotes: {
          description: 'Details of credit notes that have been applied to an invoice',
          items: {
            $ref: '#/components/schemas/CreditNote',
          },
          readOnly: true,
          type: 'array',
        },
        CurrencyCode: {
          $ref: '#/components/schemas/CurrencyCode',
          type: 'string',
        },
        CurrencyRate: {
          description:
            'The currency rate for a multicurrency invoice. If no rate is specified, the XE.com day rate is used. (max length = [18].[6])',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Date: {
          description:
            'Date invoice was issued – YYYY-MM-DD. If the Date element is not specified it will default to the current date based on the timezone setting of the organisation',
          type: 'string',
          'x-is-msdate': true,
        },
        DueDate: {
          description: 'Date invoice is due – YYYY-MM-DD',
          type: 'string',
          'x-is-msdate': true,
        },
        ExpectedPaymentDate: {
          description: 'Shown on sales invoices (Accounts Receivable) when this has been set',
          type: 'string',
          'x-is-msdate': true,
        },
        FullyPaidOnDate: {
          description: 'The date the invoice was fully paid. Only returned on fully paid invoices',
          readOnly: true,
          type: 'string',
          'x-is-msdate': true,
        },
        HasAttachments: {
          default: 'false',
          description: 'boolean to indicate if an invoice has an attachment',
          example: 'false',
          readOnly: true,
          type: 'boolean',
        },
        HasErrors: {
          default: 'false',
          description: 'A boolean to indicate if a invoice has an validation errors',
          example: 'false',
          type: 'boolean',
        },
        InvoiceID: {
          description: 'Xero generated unique identifier for invoice',
          format: 'uuid',
          type: 'string',
        },
        InvoiceNumber: {
          description:
            'ACCREC – Unique alpha numeric code identifying invoice (when missing will auto-generate from your Organisation Invoice Settings) (max length = 255)',
          maxLength: 255,
          type: 'string',
        },
        IsDiscounted: {
          description: 'boolean to indicate if an invoice has a discount',
          readOnly: true,
          type: 'boolean',
        },
        LineAmountTypes: {
          $ref: '#/components/schemas/LineAmountTypes',
          type: 'string',
        },
        LineItems: {
          description: 'See LineItems',
          items: {
            $ref: '#/components/schemas/LineItem',
          },
          type: 'array',
        },
        Overpayments: {
          description: 'See Overpayments',
          items: {
            $ref: '#/components/schemas/Overpayment',
          },
          readOnly: true,
          type: 'array',
        },
        Payments: {
          description: 'See Payments',
          items: {
            $ref: '#/components/schemas/Payment',
          },
          readOnly: true,
          type: 'array',
        },
        PlannedPaymentDate: {
          description: 'Shown on bills (Accounts Payable) when this has been set',
          type: 'string',
          'x-is-msdate': true,
        },
        Prepayments: {
          description: 'See Prepayments',
          items: {
            $ref: '#/components/schemas/Prepayment',
          },
          readOnly: true,
          type: 'array',
        },
        Reference: {
          description: 'ACCREC only – additional reference number',
          type: 'string',
        },
        RepeatingInvoiceID: {
          description: 'Xero generated unique identifier for repeating invoices',
          format: 'uuid',
          type: 'string',
        },
        SentToContact: {
          description:
            'Boolean to set whether the invoice in the Xero app should be marked as “sent”. This can be set only on invoices that have been approved',
          type: 'boolean',
        },
        Status: {
          description: 'See Invoice Status Codes',
          enum: ['DRAFT', 'SUBMITTED', 'DELETED', 'AUTHORISED', 'PAID', 'VOIDED'],
          type: 'string',
        },
        StatusAttributeString: {
          description: 'A string to indicate if a invoice status',
          type: 'string',
        },
        SubTotal: {
          description: 'Total of invoice excluding taxes',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        Total: {
          description:
            'Total of Invoice tax inclusive (i.e. SubTotal + TotalTax). This will be ignored if it doesn’t equal the sum of the LineAmounts',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        TotalDiscount: {
          description: 'Total of discounts applied on the invoice line items',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        TotalTax: {
          description: 'Total tax on invoice',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        Type: {
          description: 'See Invoice Types',
          enum: [
            'ACCPAY',
            'ACCPAYCREDIT',
            'APOVERPAYMENT',
            'APPREPAYMENT',
            'ACCREC',
            'ACCRECCREDIT',
            'AROVERPAYMENT',
            'ARPREPAYMENT',
          ],
          type: 'string',
        },
        UpdatedDateUTC: {
          description: 'Last modified date UTC format',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        Url: {
          description: 'URL link to a source document – shown as “Go to [appName]” in the Xero app',
          type: 'string',
        },
        ValidationErrors: {
          description: 'Displays array of validation error messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
        Warnings: {
          description: 'Displays array of warning messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    InvoiceReminder: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/invoice-reminders/',
      },
      properties: {
        Enabled: {
          description: 'setting for on or off',
          type: 'boolean',
        },
      },
      type: 'object',
    },
    InvoiceReminders: {
      properties: {
        InvoiceReminders: {
          items: {
            $ref: '#/components/schemas/InvoiceReminder',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Invoices: {
      properties: {
        Invoices: {
          items: {
            $ref: '#/components/schemas/Invoice',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Item: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/items/',
      },
      properties: {
        Code: {
          description: 'User defined item code (max length = 30)',
          maxLength: 30,
          type: 'string',
        },
        Description: {
          description: 'The sales description of the item (max length = 4000)',
          maxLength: 4000,
          type: 'string',
        },
        InventoryAssetAccountCode: {
          description:
            'The inventory asset account for the item. The account must be of type INVENTORY. The  COGSAccountCode in PurchaseDetails is also required to create a tracked item',
          type: 'string',
        },
        IsPurchased: {
          description:
            'Boolean value, defaults to true. When IsPurchased is true the item is available for purchase transactions in the Xero UI. If IsPurchased is updated to false then PurchaseDescription and PurchaseDetails values will be nulled.',
          type: 'boolean',
        },
        IsSold: {
          description:
            'Boolean value, defaults to true. When IsSold is true the item will be available on sales transactions in the Xero UI. If IsSold is updated to false then Description and SalesDetails values will be nulled.',
          type: 'boolean',
        },
        IsTrackedAsInventory: {
          description:
            'True for items that are tracked as inventory. An item will be tracked as inventory if the InventoryAssetAccountCode and COGSAccountCode are set.',
          type: 'boolean',
        },
        ItemID: {
          description: 'The Xero identifier for an Item',
          format: 'uuid',
          type: 'string',
        },
        Name: {
          description: 'The name of the item (max length = 50)',
          maxLength: 50,
          type: 'string',
        },
        PurchaseDescription: {
          description: 'The purchase description of the item (max length = 4000)',
          maxLength: 4000,
          type: 'string',
        },
        PurchaseDetails: {
          $ref: '#/components/schemas/Purchase',
        },
        QuantityOnHand: {
          description: 'The quantity of the item on hand',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        SalesDetails: {
          $ref: '#/components/schemas/Purchase',
        },
        StatusAttributeString: {
          description: 'Status of object',
          type: 'string',
        },
        TotalCostPool: {
          description: 'The value of the item on hand. Calculated using average cost accounting.',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        UpdatedDateUTC: {
          description: 'Last modified date in UTC format',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        ValidationErrors: {
          description: 'Displays array of validation error messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
      },
      required: ['Code'],
      type: 'object',
    },
    Items: {
      properties: {
        Items: {
          items: {
            $ref: '#/components/schemas/Item',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Journal: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/journals/',
      },
      properties: {
        CreatedDateUTC: {
          description: 'Created date UTC format',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        JournalDate: {
          description: 'Date the journal was posted',
          type: 'string',
          'x-is-msdate': true,
        },
        JournalID: {
          description: 'Xero identifier',
          format: 'uuid',
          type: 'string',
        },
        JournalLines: {
          description: 'See JournalLines',
          items: {
            $ref: '#/components/schemas/JournalLine',
          },
          type: 'array',
        },
        JournalNumber: {
          description: 'Xero generated journal number',
          type: 'integer',
        },
        Reference: {
          description: 'reference field for additional indetifying information',
          type: 'string',
        },
        SourceID: {
          description: 'The identifier for the source transaction (e.g. InvoiceID)',
          format: 'uuid',
          type: 'string',
        },
        SourceType: {
          description: 'The journal source type. The type of transaction that created the journal',
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
          ],
          type: 'string',
        },
      },
      type: 'object',
    },
    JournalLine: {
      externalDocs: {
        url: 'https://developer.xero.com/documentation/api/journals#JournalLines',
      },
      properties: {
        AccountCode: {
          description: 'See Accounts',
          example: 90,
          type: 'string',
        },
        AccountID: {
          description: 'See Accounts',
          example: 'ceef66a5-a545-413b-9312-78a53caadbc4',
          format: 'uuid',
          type: 'string',
        },
        AccountName: {
          description: 'See AccountCodes',
          example: 'Checking Account',
          type: 'string',
        },
        AccountType: {
          $ref: '#/components/schemas/AccountType',
          type: 'string',
        },
        Description: {
          description: 'The description from the source transaction line item. Only returned if populated.',
          example: 'My business checking account',
          type: 'string',
        },
        GrossAmount: {
          description: 'Gross amount of journal line (NetAmount + TaxAmount).',
          example: 4130.98,
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        JournalLineID: {
          description: 'Xero identifier for Journal',
          example: '7be9db36-3598-4755-ba5c-c2dbc8c4a7a2',
          format: 'uuid',
          type: 'string',
        },
        NetAmount: {
          description:
            'Net amount of journal line. This will be a positive value for a debit and negative for a credit',
          example: 4130.98,
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        TaxAmount: {
          description: 'Total tax on a journal line',
          example: 0,
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        TaxName: {
          description: 'see TaxRates',
          example: 'Tax Exempt',
          type: 'string',
        },
        TaxType: {
          description: 'The tax type from TaxRates',
          type: 'string',
        },
        TrackingCategories: {
          description:
            'Optional Tracking Category – see Tracking. Any JournalLine can have a maximum of 2 <TrackingCategory> elements.',
          items: {
            $ref: '#/components/schemas/TrackingCategory',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    Journals: {
      properties: {
        Journals: {
          items: {
            $ref: '#/components/schemas/Journal',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    LineAmountTypes: {
      description:
        'Line amounts are exclusive of tax by default if you don’t specify this element. See Line Amount Types',
      enum: ['Exclusive', 'Inclusive', 'NoTax'],
      type: 'string',
    },
    LineItem: {
      externalDocs: {
        url: 'https://developer.xero.com/documentation/api/invoices#post',
      },
      properties: {
        AccountCode: {
          description: 'See Accounts',
          type: 'string',
        },
        Description: {
          description:
            'Description needs to be at least 1 char long. A line item with just a description (i.e no unit amount or quantity) can be created by specifying just a <Description> element that contains at least 1 character',
          type: 'string',
        },
        DiscountAmount: {
          description:
            'Discount amount being applied to a line item. Only supported on ACCREC invoices - ACCPAY invoices and credit notes in Xero do not support discounts.',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        DiscountRate: {
          description:
            'Percentage discount being applied to a line item (only supported on  ACCREC invoices – ACC PAY invoices and credit notes in Xero do not support discounts',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        ItemCode: {
          description: 'See Items',
          type: 'string',
        },
        LineAmount: {
          description:
            'If you wish to omit either of the <Quantity> or <UnitAmount> you can provide a LineAmount and Xero will calculate the missing amount for you. The line amount reflects the discounted price if a DiscountRate has been used . i.e LineAmount = Quantity * Unit Amount * ((100 – DiscountRate)/100)',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        LineItemID: {
          description: 'LineItem unique ID',
          example: '00000000-0000-0000-0000-000000000000',
          format: 'uuid',
          type: 'string',
        },
        Quantity: {
          description: 'LineItem Quantity',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        RepeatingInvoiceID: {
          description: 'The Xero identifier for a Repeating Invoice',
          example: '00000000-0000-0000-0000-000000000000',
          format: 'uuid',
          type: 'string',
        },
        TaxAmount: {
          description:
            'The tax amount is auto calculated as a percentage of the line amount (see below) based on the tax rate. This value can be overriden if the calculated <TaxAmount> is not correct.',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        TaxType: {
          description: 'The tax type from TaxRates',
          type: 'string',
        },
        Tracking: {
          description:
            'Optional Tracking Category – see Tracking.  Any LineItem can have a  maximum of 2 <TrackingCategory> elements.',
          items: {
            $ref: '#/components/schemas/LineItemTracking',
          },
          type: 'array',
        },
        UnitAmount: {
          description: 'LineItem Unit Amount',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
      },
      type: 'object',
    },
    LineItemTracking: {
      externalDocs: {
        url: 'https://developer.xero.com/documentation/api/invoices#post',
      },
      properties: {
        Name: {
          description: 'The name of the tracking category',
          example: 'Region',
          maxLength: 100,
          type: 'string',
        },
        Option: {
          description: 'See Tracking Options',
          example: 'North',
          type: 'string',
        },
        TrackingCategoryID: {
          description: 'The Xero identifier for a tracking category',
          example: '00000000-0000-0000-0000-000000000000',
          format: 'uuid',
          type: 'string',
        },
        TrackingOptionID: {
          description: 'The Xero identifier for a tracking category option',
          example: '00000000-0000-0000-0000-000000000000',
          format: 'uuid',
          type: 'string',
        },
      },
      type: 'object',
    },
    LinkedTransaction: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/linked-transactions/',
      },
      properties: {
        ContactID: {
          description:
            'Filter by the combination of ContactID and Status. Get all the linked transactions that have been assigned to a particular customer and have a particular status e.g. GET /LinkedTransactions?ContactID=4bb34b03-3378-4bb2-a0ed-6345abf3224e&Status=APPROVED.',
          format: 'uuid',
          type: 'string',
        },
        LinkedTransactionID: {
          description:
            'The Xero identifier for an Linked Transaction e.g./LinkedTransactions/297c2dc5-cc47-4afd-8ec8-74990b8761e9',
          format: 'uuid',
          type: 'string',
        },
        SourceLineItemID: {
          description: 'The line item identifier from the source transaction.',
          format: 'uuid',
          type: 'string',
        },
        SourceTransactionID: {
          description:
            'Filter by the SourceTransactionID. Get all the linked transactions created from a particular ACCPAY invoice',
          format: 'uuid',
          type: 'string',
        },
        SourceTransactionTypeCode: {
          description:
            'The Type of the source tranasction. This will be ACCPAY if the linked transaction was created from an invoice and SPEND if it was created from a bank transaction.',
          enum: ['ACCPAY', 'SPEND'],
          type: 'string',
        },
        Status: {
          description:
            'Filter by the combination of ContactID and Status. Get all the linked transactions that have been assigned to a particular customer and have a particular status e.g. GET /LinkedTransactions?ContactID=4bb34b03-3378-4bb2-a0ed-6345abf3224e&Status=APPROVED.',
          enum: ['APPROVED', 'DRAFT', 'ONDRAFT', 'BILLED', 'VOIDED'],
          type: 'string',
        },
        TargetLineItemID: {
          description:
            'The line item identifier from the target transaction. It is possible  to link multiple billable expenses to the same TargetLineItemID.',
          format: 'uuid',
          type: 'string',
        },
        TargetTransactionID: {
          description:
            'Filter by the TargetTransactionID. Get all the linked transactions  allocated to a particular ACCREC invoice',
          format: 'uuid',
          type: 'string',
        },
        Type: {
          description: 'This will always be BILLABLEEXPENSE. More types may be added in future.',
          enum: ['BILLABLEEXPENSE'],
          type: 'string',
        },
        UpdatedDateUTC: {
          description: 'The last modified date in UTC format',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        ValidationErrors: {
          description: 'Displays array of validation error messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    LinkedTransactions: {
      properties: {
        LinkedTransactions: {
          items: {
            $ref: '#/components/schemas/LinkedTransaction',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    ManualJournal: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/manual-journals/',
      },
      properties: {
        Attachments: {
          description: 'Displays array of attachments from the API',
          items: {
            $ref: '#/components/schemas/Attachment',
          },
          type: 'array',
        },
        Date: {
          description: 'Date journal was posted – YYYY-MM-DD',
          type: 'string',
          'x-is-msdate': true,
        },
        HasAttachments: {
          default: 'false',
          description: 'Boolean to indicate if a manual journal has an attachment',
          example: 'false',
          readOnly: true,
          type: 'boolean',
        },
        JournalLines: {
          description: 'See JournalLines',
          items: {
            $ref: '#/components/schemas/ManualJournalLine',
          },
          type: 'array',
        },
        LineAmountTypes: {
          $ref: '#/components/schemas/LineAmountTypes',
          type: 'string',
        },
        ManualJournalID: {
          description: 'The Xero identifier for a Manual Journal',
          format: 'uuid',
          type: 'string',
        },
        Narration: {
          description: 'Description of journal being posted',
          type: 'string',
        },
        ShowOnCashBasisReports: {
          description: 'Boolean – default is true if not specified',
          type: 'boolean',
        },
        Status: {
          description: 'See Manual Journal Status Codes',
          enum: ['DRAFT', 'POSTED', 'DELETED', 'VOIDED', 'ARCHIVED'],
          type: 'string',
        },
        StatusAttributeString: {
          description: 'A string to indicate if a invoice status',
          example: 'ERROR',
          type: 'string',
        },
        UpdatedDateUTC: {
          description: 'Last modified date UTC format',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        Url: {
          description: 'Url link to a source document – shown as “Go to [appName]” in the Xero app',
          type: 'string',
        },
        ValidationErrors: {
          description: 'Displays array of validation error messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
        Warnings: {
          description: 'Displays array of warning messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
      },
      required: ['Narration'],
      type: 'object',
    },
    ManualJournalLine: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/manual-journals/',
      },
      properties: {
        AccountCode: {
          description: 'See Accounts',
          example: 720,
          type: 'string',
        },
        AccountID: {
          description: 'See Accounts',
          format: 'uuid',
          type: 'string',
        },
        Description: {
          description: 'Description for journal line',
          example: 'Coded incorrectly Office Equipment should be Computer Equipment',
          type: 'string',
        },
        IsBlank: {
          description: 'is the line blank',
          example: false,
          type: 'boolean',
        },
        LineAmount: {
          description: 'total for line. Debits are positive, credits are negative value',
          example: -2569,
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        TaxAmount: {
          description: 'The calculated tax amount based on the TaxType and LineAmount',
          example: 0,
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        TaxType: {
          description: 'The tax type from TaxRates',
          type: 'string',
        },
        Tracking: {
          description:
            'Optional Tracking Category – see Tracking. Any JournalLine can have a maximum of 2 <TrackingCategory> elements.',
          items: {
            $ref: '#/components/schemas/TrackingCategory',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    ManualJournals: {
      properties: {
        ManualJournals: {
          items: {
            $ref: '#/components/schemas/ManualJournal',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    OnlineInvoice: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/invoices/',
      },
      properties: {
        OnlineInvoiceUrl: {
          description: 'the URL to an online invoice',
          type: 'string',
        },
      },
      type: 'object',
    },
    OnlineInvoices: {
      properties: {
        OnlineInvoices: {
          items: {
            $ref: '#/components/schemas/OnlineInvoice',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Organisation: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/organisation/',
      },
      properties: {
        APIKey: {
          description: 'Display a unique key used for Xero-to-Xero transactions',
          type: 'string',
        },
        Addresses: {
          description: 'Address details for organisation – see Addresses',
          items: {
            $ref: '#/components/schemas/AddressForOrganisation',
          },
          type: 'array',
        },
        BaseCurrency: {
          $ref: '#/components/schemas/CurrencyCode',
          type: 'string',
        },
        Class: {
          description:
            'Organisation Classes describe which plan the Xero organisation is on (e.g. DEMO, TRIAL, PREMIUM)',
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
          ],
          type: 'string',
        },
        CountryCode: {
          $ref: '#/components/schemas/CountryCode',
          type: 'string',
        },
        CreatedDateUTC: {
          description: 'Timestamp when the organisation was created in Xero',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        DefaultPurchasesTax: {
          description: 'The default for LineAmountTypes on purchase transactions',
          type: 'string',
        },
        DefaultSalesTax: {
          description: 'The default for LineAmountTypes on sales transactions',
          type: 'string',
        },
        Edition: {
          description:
            'BUSINESS or PARTNER. Partner edition organisations are sold exclusively through accounting partners and have restricted functionality (e.g. no access to invoicing)',
          enum: ['BUSINESS', 'PARTNER'],
          type: 'string',
        },
        EmployerIdentificationNumber: {
          description: 'Shown if set. US Only.',
          type: 'string',
        },
        EndOfYearLockDate: {
          description: 'Shown if set. See lock dates',
          type: 'string',
          'x-is-msdate': true,
        },
        ExternalLinks: {
          description:
            'Organisation profile links for popular services such as Facebook,Twitter, GooglePlus and LinkedIn. You can also add link to your website here. Shown if Organisation settings  is updated in Xero. See ExternalLinks below',
          items: {
            $ref: '#/components/schemas/ExternalLink',
          },
          type: 'array',
        },
        FinancialYearEndDay: {
          description: 'Calendar day e.g. 0-31',
          type: 'integer',
        },
        FinancialYearEndMonth: {
          description: 'Calendar Month e.g. 1-12',
          type: 'integer',
        },
        IsDemoCompany: {
          description: 'Boolean to describe if organisation is a demo company.',
          type: 'boolean',
        },
        LegalName: {
          description: 'Organisation name shown on Reports',
          type: 'string',
        },
        LineOfBusiness: {
          description: 'Description of business type as defined in Organisation settings',
          type: 'string',
        },
        Name: {
          description: 'Display name of organisation shown in Xero',
          type: 'string',
        },
        OrganisationEntityType: {
          description: 'Organisation Entity Type',
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
          ],
          type: 'string',
        },
        OrganisationID: {
          description: 'Unique Xero identifier',
          example: '8be9db36-3598-4755-ba5c-c2dbc8c4a7a2',
          format: 'uuid',
          type: 'string',
        },
        OrganisationStatus: {
          description: 'Will be set to ACTIVE if you can connect to organisation via the Xero API',
          type: 'string',
        },
        OrganisationType: {
          description: 'Organisation Type',
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
          ],
          type: 'string',
        },
        PaymentTerms: {
          $ref: '#/components/schemas/PaymentTerm',
        },
        PaysTax: {
          description: 'Boolean to describe if organisation is registered with a local tax authority i.e. true, false',
          type: 'boolean',
        },
        PeriodLockDate: {
          description: 'Shown if set. See lock dates',
          type: 'string',
          'x-is-msdate': true,
        },
        Phones: {
          description: 'Phones details for organisation – see Phones',
          items: {
            $ref: '#/components/schemas/Phone',
          },
          type: 'array',
        },
        RegistrationNumber: {
          description: 'Shows for New Zealand, Australian and UK organisations',
          type: 'string',
        },
        SalesTaxBasis: {
          description: 'The accounting basis used for tax returns. See Sales Tax Basis',
          enum: ['PAYMENTS', 'INVOICE', 'NONE', 'CASH', 'ACCRUAL', 'FLATRATECASH', 'FLATRATEACCRUAL', 'ACCRUALS'],
          type: 'string',
        },
        SalesTaxPeriod: {
          description: 'The frequency with which tax returns are processed. See Sales Tax Period',
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
          ],
          type: 'string',
        },
        ShortCode: {
          description: 'A unique identifier for the organisation. Potential uses.',
          type: 'string',
        },
        TaxNumber: {
          description:
            'Shown if set. Displays in the Xero UI as Tax File Number (AU), GST Number (NZ), VAT Number (UK) and Tax ID Number (US & Global).',
          type: 'string',
        },
        Timezone: {
          $ref: '#/components/schemas/TimeZone',
          type: 'string',
        },
        Version: {
          description: 'See Version Types',
          enum: ['AU', 'NZ', 'GLOBAL', 'UK', 'US', 'AUONRAMP', 'NZONRAMP', 'GLOBALONRAMP', 'UKONRAMP', 'USONRAMP'],
          type: 'string',
        },
      },
      type: 'object',
    },
    Organisations: {
      properties: {
        Organisations: {
          items: {
            $ref: '#/components/schemas/Organisation',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Overpayment: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/overpayments/',
      },
      properties: {
        Allocations: {
          description: 'See Allocations',
          items: {
            $ref: '#/components/schemas/Allocation',
          },
          type: 'array',
        },
        AppliedAmount: {
          description: 'The amount of applied to an invoice',
          example: 2,
          format: 'double',
          type: 'number',
        },
        Attachments: {
          description: 'See Attachments',
          items: {
            $ref: '#/components/schemas/Attachment',
          },
          type: 'array',
        },
        Contact: {
          $ref: '#/components/schemas/Contact',
        },
        CurrencyCode: {
          $ref: '#/components/schemas/CurrencyCode',
          type: 'string',
        },
        CurrencyRate: {
          description:
            'The currency rate for a multicurrency overpayment. If no rate is specified, the XE.com day rate is used',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Date: {
          description: 'The date the overpayment is created YYYY-MM-DD',
          type: 'string',
          'x-is-msdate': true,
        },
        HasAttachments: {
          default: 'false',
          description: 'boolean to indicate if a overpayment has an attachment',
          example: 'false',
          readOnly: true,
          type: 'boolean',
        },
        LineAmountTypes: {
          $ref: '#/components/schemas/LineAmountTypes',
          type: 'string',
        },
        LineItems: {
          description: 'See Overpayment Line Items',
          items: {
            $ref: '#/components/schemas/LineItem',
          },
          type: 'array',
        },
        OverpaymentID: {
          description: 'Xero generated unique identifier',
          format: 'uuid',
          type: 'string',
        },
        Payments: {
          description: 'See Payments',
          items: {
            $ref: '#/components/schemas/Payment',
          },
          type: 'array',
        },
        RemainingCredit: {
          description: 'The remaining credit balance on the overpayment',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Status: {
          description: 'See Overpayment Status Codes',
          enum: ['AUTHORISED', 'PAID', 'VOIDED'],
          type: 'string',
        },
        SubTotal: {
          description: 'The subtotal of the overpayment excluding taxes',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Total: {
          description: 'The total of the overpayment (subtotal + total tax)',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        TotalTax: {
          description: 'The total tax on the overpayment',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Type: {
          description: 'See Overpayment Types',
          enum: ['RECEIVE-OVERPAYMENT', 'SPEND-OVERPAYMENT', 'AROVERPAYMENT'],
          type: 'string',
        },
        UpdatedDateUTC: {
          description: 'UTC timestamp of last update to the overpayment',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
      },
      type: 'object',
    },
    Overpayments: {
      properties: {
        Overpayments: {
          items: {
            $ref: '#/components/schemas/Overpayment',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Payment: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/payments/',
      },
      properties: {
        Account: {
          $ref: '#/components/schemas/Account',
        },
        Amount: {
          description:
            'The amount of the payment. Must be less than or equal to the outstanding amount owing on the invoice e.g. 200.00',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        BankAccountNumber: {
          description: 'The suppliers bank account number the payment is being made to',
          type: 'string',
        },
        BatchPaymentID: {
          description: 'Present if the payment was created as part of a batch.',
          example: '00000000-0000-0000-0000-000000000000',
          format: 'uuid',
          type: 'string',
        },
        Code: {
          description:
            'Code of account you are using to make the payment e.g. 001 (note- not all accounts have a code value)',
          type: 'string',
        },
        CreditNote: {
          $ref: '#/components/schemas/CreditNote',
        },
        CreditNoteNumber: {
          description: 'Number of invoice or credit note you are applying payment to e.g. INV-4003',
          type: 'string',
        },
        CurrencyRate: {
          description:
            'Exchange rate when payment is received. Only used for non base currency invoices and credit notes e.g. 0.7500',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Date: {
          description: 'Date the payment is being made (YYYY-MM-DD) e.g. 2009-09-06',
          type: 'string',
          'x-is-msdate': true,
        },
        Details: {
          description: "The information to appear on the supplier's bank account",
          type: 'string',
        },
        HasAccount: {
          default: 'false',
          description: 'A boolean to indicate if a contact has an validation errors',
          example: 'false',
          type: 'boolean',
        },
        HasValidationErrors: {
          default: 'false',
          description: 'A boolean to indicate if a contact has an validation errors',
          example: 'false',
          type: 'boolean',
        },
        Invoice: {
          $ref: '#/components/schemas/Invoice',
        },
        InvoiceNumber: {
          description: 'Number of invoice or credit note you are applying payment to e.g.INV-4003',
          type: 'string',
        },
        IsReconciled: {
          description:
            'An optional parameter for the payment. A boolean indicating whether you would like the payment to be created as reconciled when using PUT, or whether a payment has been reconciled when using GET',
          type: 'boolean',
        },
        Overpayment: {
          $ref: '#/components/schemas/Overpayment',
        },
        Particulars: {
          description: 'The suppliers bank account number the payment is being made to',
          type: 'string',
        },
        PaymentID: {
          description: 'The Xero identifier for an Payment e.g. 297c2dc5-cc47-4afd-8ec8-74990b8761e9',
          example: '00000000-0000-0000-0000-000000000000',
          format: 'uuid',
          type: 'string',
        },
        PaymentType: {
          description: 'See Payment Types.',
          enum: [
            'ACCRECPAYMENT',
            'ACCPAYPAYMENT',
            'ARCREDITPAYMENT',
            'APCREDITPAYMENT',
            'AROVERPAYMENTPAYMENT',
            'ARPREPAYMENTPAYMENT',
            'APPREPAYMENTPAYMENT',
            'APOVERPAYMENTPAYMENT',
          ],
          readOnly: true,
          type: 'string',
        },
        Prepayment: {
          $ref: '#/components/schemas/Prepayment',
        },
        Reference: {
          description: 'An optional description for the payment e.g. Direct Debit',
          type: 'string',
        },
        Status: {
          description: 'The status of the payment.',
          enum: ['AUTHORISED', 'DELETED'],
          type: 'string',
        },
        StatusAttributeString: {
          description: 'A string to indicate if a invoice status',
          type: 'string',
        },
        UpdatedDateUTC: {
          description: 'UTC timestamp of last update to the payment',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        ValidationErrors: {
          description: 'Displays array of validation error messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    PaymentDelete: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/payments/',
      },
      properties: {
        Status: {
          default: 'DELETED',
          description: 'The status of the payment.',
          type: 'string',
        },
      },
      required: ['Status'],
      type: 'object',
    },
    PaymentService: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/branding-themes/',
      },
      properties: {
        PayNowText: {
          description:
            'The text displayed on the Pay Now button in Xero Online Invoicing. If this is not set it will default to Pay by credit card',
          type: 'string',
        },
        PaymentServiceID: {
          description: 'Xero identifier',
          format: 'uuid',
          type: 'string',
        },
        PaymentServiceName: {
          description: 'Name of payment service',
          type: 'string',
        },
        PaymentServiceType: {
          description: 'This will always be CUSTOM for payment services created via the API.',
          type: 'string',
        },
        PaymentServiceUrl: {
          description: 'The custom payment URL',
          type: 'string',
        },
        ValidationErrors: {
          description: 'Displays array of validation error messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
      },
    },
    PaymentServices: {
      properties: {
        PaymentServices: {
          items: {
            $ref: '#/components/schemas/PaymentService',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    PaymentTerm: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/organisation/',
      },
      properties: {
        Bills: {
          $ref: '#/components/schemas/Bill',
        },
        Sales: {
          $ref: '#/components/schemas/Bill',
        },
      },
      type: 'object',
    },
    PaymentTermType: {
      enum: ['DAYSAFTERBILLDATE', 'DAYSAFTERBILLMONTH', 'OFCURRENTMONTH', 'OFFOLLOWINGMONTH'],
      type: 'string',
    },
    Payments: {
      properties: {
        Payments: {
          items: {
            $ref: '#/components/schemas/Payment',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Phone: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/types',
      },
      properties: {
        PhoneAreaCode: {
          description: 'max length = 10',
          maxLength: 10,
          type: 'string',
        },
        PhoneCountryCode: {
          description: 'max length = 20',
          maxLength: 20,
          type: 'string',
        },
        PhoneNumber: {
          description: 'max length = 50',
          maxLength: 50,
          type: 'string',
        },
        PhoneType: {
          enum: ['DEFAULT', 'DDI', 'MOBILE', 'FAX', 'OFFICE'],
          type: 'string',
        },
      },
      type: 'object',
    },
    Prepayment: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/prepayments/',
      },
      properties: {
        Allocations: {
          description: 'See Allocations',
          items: {
            $ref: '#/components/schemas/Allocation',
          },
          type: 'array',
        },
        AppliedAmount: {
          description: 'The amount of applied to an invoice',
          example: 2,
          format: 'double',
          type: 'number',
        },
        Attachments: {
          description: 'See Attachments',
          items: {
            $ref: '#/components/schemas/Attachment',
          },
          type: 'array',
        },
        Contact: {
          $ref: '#/components/schemas/Contact',
        },
        CurrencyCode: {
          $ref: '#/components/schemas/CurrencyCode',
          type: 'string',
        },
        CurrencyRate: {
          description:
            'The currency rate for a multicurrency prepayment. If no rate is specified, the XE.com day rate is used',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Date: {
          description: 'The date the prepayment is created YYYY-MM-DD',
          type: 'string',
          'x-is-msdate': true,
        },
        HasAttachments: {
          default: 'false',
          description: 'boolean to indicate if a prepayment has an attachment',
          example: 'false',
          readOnly: true,
          type: 'boolean',
        },
        LineAmountTypes: {
          $ref: '#/components/schemas/LineAmountTypes',
          type: 'string',
        },
        LineItems: {
          description: 'See Prepayment Line Items',
          items: {
            $ref: '#/components/schemas/LineItem',
          },
          type: 'array',
        },
        PrepaymentID: {
          description: 'Xero generated unique identifier',
          format: 'uuid',
          type: 'string',
        },
        Reference: {
          description: "Returns Invoice number field. Reference field isn't available.",
          readOnly: true,
          type: 'string',
        },
        RemainingCredit: {
          description: 'The remaining credit balance on the prepayment',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Status: {
          description: 'See Prepayment Status Codes',
          enum: ['AUTHORISED', 'PAID', 'VOIDED'],
          type: 'string',
        },
        SubTotal: {
          description: 'The subtotal of the prepayment excluding taxes',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Total: {
          description: 'The total of the prepayment(subtotal + total tax)',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        TotalTax: {
          description: 'The total tax on the prepayment',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Type: {
          description: 'See Prepayment Types',
          enum: ['RECEIVE-PREPAYMENT', 'SPEND-PREPAYMENT', 'ARPREPAYMENT', 'APPREPAYMENT'],
          type: 'string',
        },
        UpdatedDateUTC: {
          description: 'UTC timestamp of last update to the prepayment',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
      },
      type: 'object',
    },
    Prepayments: {
      properties: {
        Prepayments: {
          items: {
            $ref: '#/components/schemas/Prepayment',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Purchase: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/items/',
      },
      properties: {
        AccountCode: {
          description:
            'Default account code to be used for purchased/sale. Not applicable to the purchase details of tracked items',
          type: 'string',
        },
        COGSAccountCode: {
          description: 'Cost of goods sold account. Only applicable to the purchase details of tracked items.',
          type: 'string',
        },
        TaxType: {
          description: 'The tax type from TaxRates',
          type: 'string',
        },
        UnitPrice: {
          description:
            'Unit Price of the item. By default UnitPrice is rounded to two decimal places. You can use 4 decimal places by adding the unitdp=4 querystring parameter to your request.',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
      },
      type: 'object',
    },
    PurchaseOrder: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/purchase-orders/',
      },
      properties: {
        Attachments: {
          description: 'Displays array of attachments from the API',
          items: {
            $ref: '#/components/schemas/Attachment',
          },
          type: 'array',
        },
        AttentionTo: {
          description: 'The person that the delivery is going to',
          type: 'string',
        },
        BrandingThemeID: {
          description: 'See BrandingThemes',
          format: 'uuid',
          type: 'string',
        },
        Contact: {
          $ref: '#/components/schemas/Contact',
        },
        CurrencyCode: {
          $ref: '#/components/schemas/CurrencyCode',
          type: 'string',
        },
        CurrencyRate: {
          description:
            'The currency rate for a multicurrency purchase order. If no rate is specified, the XE.com day rate is used.',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Date: {
          description:
            'Date purchase order was issued – YYYY-MM-DD. If the Date element is not specified then it will default to the current date based on the timezone setting of the organisation',
          type: 'string',
          'x-is-msdate': true,
        },
        DeliveryAddress: {
          description: 'The address the goods are to be delivered to',
          type: 'string',
        },
        DeliveryDate: {
          description: 'Date the goods are to be delivered – YYYY-MM-DD',
          type: 'string',
          'x-is-msdate': true,
        },
        DeliveryInstructions: {
          description: 'A free text feild for instructions (500 characters max)',
          type: 'string',
        },
        ExpectedArrivalDate: {
          description: 'The date the goods are expected to arrive.',
          type: 'string',
          'x-is-msdate': true,
        },
        HasAttachments: {
          default: 'false',
          description: 'boolean to indicate if a purchase order has an attachment',
          example: 'false',
          readOnly: true,
          type: 'boolean',
        },
        LineAmountTypes: {
          $ref: '#/components/schemas/LineAmountTypes',
          type: 'string',
        },
        LineItems: {
          description: 'See LineItems',
          items: {
            $ref: '#/components/schemas/LineItem',
          },
          type: 'array',
        },
        PurchaseOrderID: {
          description: 'Xero generated unique identifier for purchase order',
          format: 'uuid',
          type: 'string',
        },
        PurchaseOrderNumber: {
          description:
            'Unique alpha numeric code identifying purchase order (when missing will auto-generate from your Organisation Invoice Settings)',
          type: 'string',
        },
        Reference: {
          description: 'Additional reference number',
          type: 'string',
        },
        SentToContact: {
          description:
            'Boolean to set whether the purchase order should be marked as “sent”. This can be set only on purchase orders that have been approved or billed',
          type: 'boolean',
        },
        Status: {
          description: 'See Purchase Order Status Codes',
          enum: ['DRAFT', 'SUBMITTED', 'AUTHORISED', 'BILLED', 'DELETED'],
          type: 'string',
        },
        StatusAttributeString: {
          description: 'A string to indicate if a invoice status',
          type: 'string',
        },
        SubTotal: {
          description: 'Total of purchase order excluding taxes',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        Telephone: {
          description: 'The phone number for the person accepting the delivery',
          type: 'string',
        },
        Total: {
          description: 'Total of Purchase Order tax inclusive (i.e. SubTotal + TotalTax)',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        TotalDiscount: {
          description: 'Total of discounts applied on the purchase order line items',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        TotalTax: {
          description: 'Total tax on purchase order',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        UpdatedDateUTC: {
          description: 'Last modified date UTC format',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        ValidationErrors: {
          description: 'Displays array of validation error messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
        Warnings: {
          description: 'Displays array of warning messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    PurchaseOrders: {
      properties: {
        PurchaseOrders: {
          items: {
            $ref: '#/components/schemas/PurchaseOrder',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Quote: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/Quotes/',
      },
      properties: {
        BrandingThemeID: {
          description: 'See BrandingThemes',
          format: 'uuid',
          type: 'string',
        },
        Contact: {
          $ref: '#/components/schemas/Contact',
          type: 'string',
        },
        CurrencyCode: {
          $ref: '#/components/schemas/CurrencyCode',
          type: 'string',
        },
        CurrencyRate: {
          description: 'The currency rate for a multicurrency quote',
          format: 'double',
          type: 'number',
        },
        Date: {
          description:
            'Date quote was issued – YYYY-MM-DD. If the Date element is not specified it will default to the current date based on the timezone setting of the organisation',
          type: 'string',
          'x-is-msdate': true,
        },
        DateString: {
          description: 'Date the quote was issued (YYYY-MM-DD)',
          type: 'string',
        },
        ExpiryDate: {
          description: 'Date the quote expires – YYYY-MM-DD.',
          type: 'string',
          'x-is-msdate': true,
        },
        ExpiryDateString: {
          description: 'Date the quote expires – YYYY-MM-DD.',
          type: 'string',
        },
        LineAmountTypes: {
          $ref: '#/components/schemas/QuoteLineAmountTypes',
          description: 'See Quote Line Amount Types',
          type: 'string',
        },
        LineItems: {
          description: 'See LineItems',
          items: {
            $ref: '#/components/schemas/LineItem',
          },
          type: 'array',
        },
        QuoteID: {
          description: 'QuoteID GUID is automatically generated and is returned after create or GET.',
          format: 'uuid',
          type: 'string',
        },
        QuoteNumber: {
          description: 'Unique alpha numeric code identifying a quote (Max Length = 255)',
          maxLength: 255,
          type: 'string',
        },
        Reference: {
          description: 'Additional reference number',
          maxLength: 4000,
          type: 'string',
        },
        Status: {
          $ref: '#/components/schemas/QuoteStatusCodes',
          type: 'string',
        },
        StatusAttributeString: {
          description: 'A string to indicate if a invoice status',
          type: 'string',
        },
        SubTotal: {
          description: 'Total of quote excluding taxes.',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        Summary: {
          description: 'Summary text for the quote',
          maxLength: 3000,
          type: 'string',
        },
        Terms: {
          description: 'Terms of the quote',
          maxLength: 4000,
          type: 'string',
        },
        Title: {
          description: 'Title text for the quote',
          maxLength: 100,
          type: 'string',
        },
        Total: {
          description:
            'Total of Quote tax inclusive (i.e. SubTotal + TotalTax). This will be ignored if it doesn’t equal the sum of the LineAmounts',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        TotalDiscount: {
          description: 'Total of discounts applied on the quote line items',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        TotalTax: {
          description: 'Total tax on quote',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        UpdatedDateUTC: {
          description: 'Last modified date UTC format',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        ValidationErrors: {
          description: 'Displays array of validation error messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    QuoteLineAmountTypes: {
      description:
        'Line amounts are exclusive of tax by default if you don’t specify this element. See Line Amount Types',
      enum: ['EXCLUSIVE', 'INCLUSIVE', 'NOTAX'],
      type: 'string',
    },
    QuoteStatusCodes: {
      description: 'The status of the quote.',
      enum: ['DRAFT', 'SENT', 'DECLINED', 'ACCEPTED', 'INVOICED', 'DELETED'],
      type: 'string',
    },
    Quotes: {
      properties: {
        Quotes: {
          items: {
            $ref: '#/components/schemas/Quote',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Receipt: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/receipts/',
      },
      properties: {
        Attachments: {
          description: 'Displays array of attachments from the API',
          items: {
            $ref: '#/components/schemas/Attachment',
          },
          type: 'array',
        },
        Contact: {
          $ref: '#/components/schemas/Contact',
        },
        Date: {
          description: 'Date of receipt – YYYY-MM-DD',
          type: 'string',
          'x-is-msdate': true,
        },
        HasAttachments: {
          default: 'false',
          description: 'boolean to indicate if a receipt has an attachment',
          example: 'false',
          readOnly: true,
          type: 'boolean',
        },
        LineAmountTypes: {
          $ref: '#/components/schemas/LineAmountTypes',
          type: 'string',
        },
        LineItems: {
          items: {
            $ref: '#/components/schemas/LineItem',
          },
          type: 'array',
        },
        ReceiptID: {
          description: 'Xero generated unique identifier for receipt',
          format: 'uuid',
          type: 'string',
        },
        ReceiptNumber: {
          description: 'Xero generated sequence number for receipt in current claim for a given user',
          readOnly: true,
          type: 'string',
        },
        Reference: {
          description: 'Additional reference number',
          type: 'string',
        },
        Status: {
          description: 'Current status of receipt – see status types',
          enum: ['DRAFT', 'SUBMITTED', 'AUTHORISED', 'DECLINED', 'VOIDED'],
          type: 'string',
        },
        SubTotal: {
          description: 'Total of receipt excluding taxes',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Total: {
          description: 'Total of receipt tax inclusive (i.e. SubTotal + TotalTax)',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        TotalTax: {
          description: 'Total tax on receipt',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        UpdatedDateUTC: {
          description: 'Last modified date UTC format',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        Url: {
          description: 'URL link to a source document – shown as “Go to [appName]” in the Xero app',
          readOnly: true,
          type: 'string',
        },
        User: {
          $ref: '#/components/schemas/User',
        },
        ValidationErrors: {
          description: 'Displays array of validation error messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
        Warnings: {
          description: 'Displays array of warning messages from the API',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    Receipts: {
      properties: {
        Receipts: {
          items: {
            $ref: '#/components/schemas/Receipt',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    RepeatingInvoice: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/repeating-invoices/',
      },
      properties: {
        Attachments: {
          description: 'Displays array of attachments from the API',
          items: {
            $ref: '#/components/schemas/Attachment',
          },
          type: 'array',
        },
        BrandingThemeID: {
          description: 'See BrandingThemes',
          format: 'uuid',
          type: 'string',
        },
        Contact: {
          $ref: '#/components/schemas/Contact',
        },
        CurrencyCode: {
          $ref: '#/components/schemas/CurrencyCode',
          type: 'string',
        },
        HasAttachments: {
          default: 'false',
          description: 'boolean to indicate if an invoice has an attachment',
          example: 'false',
          readOnly: true,
          type: 'boolean',
        },
        ID: {
          description: 'Xero generated unique identifier for repeating invoice template',
          format: 'uuid',
          type: 'string',
        },
        LineAmountTypes: {
          $ref: '#/components/schemas/LineAmountTypes',
          type: 'string',
        },
        LineItems: {
          description: 'See LineItems',
          items: {
            $ref: '#/components/schemas/LineItem',
          },
          type: 'array',
        },
        Reference: {
          description: 'ACCREC only – additional reference number',
          type: 'string',
        },
        RepeatingInvoiceID: {
          description: 'Xero generated unique identifier for repeating invoice template',
          format: 'uuid',
          type: 'string',
        },
        Schedule: {
          $ref: '#/components/schemas/Schedule',
        },
        Status: {
          description: 'One of the following - DRAFT or AUTHORISED – See Invoice Status Codes',
          enum: ['DRAFT', 'AUTHORISED', 'DELETED'],
          type: 'string',
        },
        SubTotal: {
          description: 'Total of invoice excluding taxes',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Total: {
          description: 'Total of Invoice tax inclusive (i.e. SubTotal + TotalTax)',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        TotalTax: {
          description: 'Total tax on invoice',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Type: {
          description: 'See Invoice Types',
          enum: ['ACCPAY', 'ACCREC'],
          type: 'string',
        },
      },
      type: 'object',
    },
    RepeatingInvoices: {
      properties: {
        RepeatingInvoices: {
          items: {
            $ref: '#/components/schemas/RepeatingInvoice',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    Report: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/reports/',
      },
      properties: {
        Contacts: {
          items: {
            $ref: '#/components/schemas/TenNinetyNineContact',
          },
          type: 'array',
        },
        ReportDate: {
          description: 'Date of report',
          type: 'string',
        },
        ReportID: {
          description: 'See Prepayment Types',
          type: 'string',
        },
        ReportName: {
          description: 'See Prepayment Types',
          type: 'string',
        },
        ReportTitle: {
          description: 'See Prepayment Types',
          type: 'string',
        },
        ReportType: {
          description: 'See Prepayment Types',
          enum: ['AgedPayablesByContact'],
          type: 'string',
        },
        UpdatedDateUTC: {
          description: 'Updated Date',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
      },
    },
    ReportAttribute: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/reports/',
      },
      properties: {
        Id: {
          type: 'string',
        },
        Value: {
          type: 'string',
        },
      },
    },
    ReportCell: {
      properties: {
        Attributes: {
          items: {
            $ref: '#/components/schemas/ReportAttribute',
          },
          type: 'array',
        },
        Value: {
          type: 'string',
        },
      },
      type: 'object',
    },
    ReportFields: {
      properties: {
        Description: {
          type: 'string',
        },
        FieldID: {
          type: 'string',
        },
        Value: {
          type: 'string',
        },
      },
      type: 'object',
    },
    ReportRow: {
      properties: {
        Cells: {
          items: {
            $ref: '#/components/schemas/ReportCell',
          },
          type: 'array',
        },
        RowType: {
          $ref: '#/components/schemas/RowType',
        },
        Title: {
          type: 'string',
        },
      },
      type: 'object',
    },
    ReportRows: {
      properties: {
        Cells: {
          items: {
            $ref: '#/components/schemas/ReportCell',
          },
          type: 'array',
        },
        RowType: {
          $ref: '#/components/schemas/RowType',
        },
        Rows: {
          items: {
            $ref: '#/components/schemas/ReportRow',
          },
          type: 'array',
        },
        Title: {
          type: 'string',
        },
      },
      type: 'object',
    },
    ReportWithRow: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/reports/',
      },
      properties: {
        Fields: {
          items: {
            $ref: '#/components/schemas/ReportFields',
          },
          type: 'array',
        },
        ReportDate: {
          description: 'Date of report',
          type: 'string',
        },
        ReportID: {
          description: 'Report id',
          type: 'string',
        },
        ReportName: {
          description: 'Name of the report',
          type: 'string',
        },
        ReportTitle: {
          description: 'Title of the report',
          type: 'string',
        },
        ReportTitles: {
          description:
            'Report titles array (3 to 4 strings with the report name, orgnisation name and time frame of report)',
          items: {
            type: 'string',
          },
          type: 'array',
        },
        ReportType: {
          description: 'The type of report (BalanceSheet,ProfitLoss, etc)',
          type: 'string',
        },
        Rows: {
          items: {
            $ref: '#/components/schemas/ReportRows',
          },
          type: 'array',
        },
        UpdatedDateUTC: {
          description: 'Updated Date',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
      },
    },
    ReportWithRows: {
      properties: {
        Reports: {
          items: {
            $ref: '#/components/schemas/ReportWithRow',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    Reports: {
      properties: {
        Reports: {
          items: {
            $ref: '#/components/schemas/Report',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    RequestEmpty: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/invoice/',
      },
      properties: {
        Status: {
          description: 'Need at least one field to create an empty JSON payload',
          type: 'string',
        },
      },
      type: 'object',
    },
    RowType: {
      enum: ['Header', 'Section', 'Row', 'SummaryRow'],
      type: 'string',
    },
    SalesTrackingCategory: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/tracking-categories/',
      },
      properties: {
        TrackingCategoryName: {
          description: 'The default sales tracking category name for contacts',
          type: 'string',
        },
        TrackingOptionName: {
          description: 'The default purchase tracking category name for contacts',
          type: 'string',
        },
      },
      type: 'object',
    },
    Schedule: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/repeating-invoices/',
      },
      properties: {
        DueDate: {
          description: 'Integer used with due date type e.g 20 (of following month), 31 (of current month)',
          type: 'integer',
        },
        DueDateType: {
          description: 'the payment terms',
          enum: [
            'DAYSAFTERBILLDATE',
            'DAYSAFTERBILLMONTH',
            'DAYSAFTERINVOICEDATE',
            'DAYSAFTERINVOICEMONTH',
            'OFCURRENTMONTH',
            'OFFOLLOWINGMONTH',
          ],
          type: 'string',
        },
        EndDate: {
          description: 'Invoice end date – only returned if the template has an end date set',
          type: 'string',
          'x-is-msdate': true,
        },
        NextScheduledDate: {
          description: 'The calendar date of the next invoice in the schedule to be generated',
          type: 'string',
          'x-is-msdate': true,
        },
        Period: {
          description: 'Integer used with the unit e.g. 1 (every 1 week), 2 (every 2 months)',
          type: 'integer',
        },
        StartDate: {
          description:
            'Date the first invoice of the current version of the repeating schedule was generated (changes when repeating invoice is edited)',
          type: 'string',
          'x-is-msdate': true,
        },
        Unit: {
          description: 'One of the following - WEEKLY or MONTHLY',
          enum: ['WEEKLY', 'MONTHLY'],
          type: 'string',
        },
      },
      type: 'object',
    },
    Setup: {
      externalDocs: {
        url: 'https://developer.xero.com/documentation/api-guides/conversions',
      },
      properties: {
        Accounts: {
          items: {
            $ref: '#/components/schemas/Account',
          },
          type: 'array',
        },
        ConversionBalances: {
          description: 'Balance supplied for each account that has a value as at the conversion date.',
          items: {
            $ref: '#/components/schemas/ConversionBalances',
          },
          type: 'array',
        },
        ConversionDate: {
          $ref: '#/components/schemas/ConversionDate',
        },
      },
    },
    TaxComponent: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/tax-rates/',
      },
      properties: {
        IsCompound: {
          description: 'Boolean to describe if Tax rate is compounded.',
          type: 'boolean',
        },
        IsNonRecoverable: {
          description:
            'Boolean to describe if tax rate is non-recoverable. Non-recoverable rates are only applicable to Canadian organisations',
          type: 'boolean',
        },
        Name: {
          description: 'Name of Tax Component',
          type: 'string',
        },
        Rate: {
          description: 'Tax Rate (up to 4dp)',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
      },
      type: 'object',
    },
    TaxRate: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/tax-rates/',
      },
      properties: {
        CanApplyToAssets: {
          description: 'Boolean to describe if tax rate can be used for asset accounts i.e.  true,false',
          readOnly: true,
          type: 'boolean',
        },
        CanApplyToEquity: {
          description: 'Boolean to describe if tax rate can be used for equity accounts i.e true,false',
          readOnly: true,
          type: 'boolean',
        },
        CanApplyToExpenses: {
          description: 'Boolean to describe if tax rate can be used for expense accounts  i.e. true,false',
          readOnly: true,
          type: 'boolean',
        },
        CanApplyToLiabilities: {
          description: 'Boolean to describe if tax rate can be used for liability accounts  i.e. true,false',
          readOnly: true,
          type: 'boolean',
        },
        CanApplyToRevenue: {
          description: 'Boolean to describe if tax rate can be used for revenue accounts i.e. true,false',
          readOnly: true,
          type: 'boolean',
        },
        DisplayTaxRate: {
          description: 'Tax Rate (decimal to 4dp) e.g 12.5000',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        EffectiveRate: {
          description: 'Effective Tax Rate (decimal to 4dp) e.g 12.5000',
          format: 'double',
          readOnly: true,
          type: 'number',
          'x-is-money': true,
        },
        Name: {
          description: 'Name of tax rate',
          type: 'string',
        },
        ReportTaxType: {
          description: 'See ReportTaxTypes',
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
          ],
          type: 'string',
        },
        Status: {
          description: 'See Status Codes',
          enum: ['ACTIVE', 'DELETED', 'ARCHIVED', 'PENDING'],
          type: 'string',
        },
        TaxComponents: {
          description: 'See TaxComponents',
          items: {
            $ref: '#/components/schemas/TaxComponent',
          },
          type: 'array',
        },
        TaxType: {
          description: 'The tax type',
          type: 'string',
        },
      },
      type: 'object',
    },
    TaxRates: {
      properties: {
        TaxRates: {
          items: {
            $ref: '#/components/schemas/TaxRate',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    TaxType: {
      description: 'See Tax Types – can only be used on update calls',
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
      ],
      type: 'string',
    },
    TenNinetyNineContact: {
      properties: {
        Box1: {
          description: 'Box 1 on 1099 Form',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Box10: {
          description: 'Box 10 on 1099 Form',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Box11: {
          description: 'Box 11 on 1099 Form',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Box13: {
          description: 'Box 13 on 1099 Form',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Box14: {
          description: 'Box 14 on 1099 Form',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Box2: {
          description: 'Box 2 on 1099 Form',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Box3: {
          description: 'Box 3 on 1099 Form',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Box4: {
          description: 'Box 4 on 1099 Form',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Box5: {
          description: 'Box 5 on 1099 Form',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Box6: {
          description: 'Box 6 on 1099 Form',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Box7: {
          description: 'Box 7 on 1099 Form',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Box8: {
          description: 'Box 8 on 1099 Form',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        Box9: {
          description: 'Box 9 on 1099 Form',
          format: 'double',
          type: 'number',
          'x-is-money': true,
        },
        City: {
          description: 'Contact city on 1099 Form',
          type: 'string',
        },
        ContactId: {
          description: 'Contact contact id',
          format: 'uuid',
          type: 'string',
        },
        Email: {
          description: 'Contact email on 1099 Form',
          type: 'string',
        },
        FederalTaxIDType: {
          description: 'Contact Fed Tax ID type',
          type: 'string',
        },
        Name: {
          description: 'Contact name on 1099 Form',
          type: 'string',
        },
        State: {
          description: 'Contact State on 1099 Form',
          type: 'string',
        },
        StreetAddress: {
          description: 'Contact address on 1099 Form',
          type: 'string',
        },
        TaxID: {
          description: 'Contact tax id on 1099 Form',
          type: 'string',
        },
        Zip: {
          description: 'Contact zip on 1099 Form',
          type: 'string',
        },
      },
    },
    TimeZone: {
      description: 'Timezone specifications',
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
      ],
      type: 'string',
    },
    TrackingCategories: {
      properties: {
        TrackingCategories: {
          items: {
            $ref: '#/components/schemas/TrackingCategory',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    TrackingCategory: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/tracking-categories/',
      },
      properties: {
        Name: {
          description: 'The name of the tracking category e.g. Department, Region (max length = 100)',
          maxLength: 100,
          type: 'string',
        },
        Option: {
          description: 'The option name of the tracking option e.g. East, West (max length = 100)',
          maxLength: 100,
          type: 'string',
        },
        Options: {
          description: 'See Tracking Options',
          items: {
            $ref: '#/components/schemas/TrackingOption',
          },
          type: 'array',
        },
        Status: {
          description: 'The status of a tracking category',
          enum: ['ACTIVE', 'ARCHIVED', 'DELETED'],
          type: 'string',
        },
        TrackingCategoryID: {
          description: 'The Xero identifier for a tracking category e.g. 297c2dc5-cc47-4afd-8ec8-74990b8761e9',
          format: 'uuid',
          type: 'string',
        },
        TrackingOptionID: {
          description: 'The Xero identifier for a tracking option e.g. dc54c220-0140-495a-b925-3246adc0075f',
          format: 'uuid',
          type: 'string',
        },
      },
      type: 'object',
    },
    TrackingOption: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/tracking-categories/',
      },
      properties: {
        Name: {
          description: 'The name of the tracking option e.g. Marketing, East (max length = 100)',
          maxLength: 100,
          type: 'string',
        },
        Status: {
          description: 'The status of a tracking option',
          enum: ['ACTIVE', 'ARCHIVED', 'DELETED'],
          type: 'string',
        },
        TrackingCategoryID: {
          description: 'Filter by a tracking category e.g. 297c2dc5-cc47-4afd-8ec8-74990b8761e9',
          format: 'uuid',
          type: 'string',
        },
        TrackingOptionID: {
          description: 'The Xero identifier for a tracking option e.g. ae777a87-5ef3-4fa0-a4f0-d10e1f13073a',
          format: 'uuid',
          type: 'string',
        },
      },
      type: 'object',
    },
    TrackingOptions: {
      properties: {
        Options: {
          items: {
            $ref: '#/components/schemas/TrackingOption',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    User: {
      externalDocs: {
        url: 'http://developer.xero.com/documentation/api/users/',
      },
      properties: {
        EmailAddress: {
          description: 'Email address of user',
          type: 'string',
        },
        FirstName: {
          description: 'First name of user',
          type: 'string',
        },
        IsSubscriber: {
          description: 'Boolean to indicate if user is the subscriber',
          type: 'boolean',
        },
        LastName: {
          description: 'Last name of user',
          type: 'string',
        },
        OrganisationRole: {
          description:
            'User role that defines permissions in Xero and via API (READONLY, INVOICEONLY, STANDARD, FINANCIALADVISER, etc)',
          enum: [
            'READONLY',
            'INVOICEONLY',
            'STANDARD',
            'FINANCIALADVISER',
            'MANAGEDCLIENT',
            'CASHBOOKCLIENT',
            'UNKNOWN',
          ],
          type: 'string',
        },
        UpdatedDateUTC: {
          description: 'Timestamp of last change to user',
          example: '/Date(1573755038314)/',
          readOnly: true,
          type: 'string',
          'x-is-msdate-time': true,
        },
        UserID: {
          description: 'Xero identifier',
          format: 'uuid',
          type: 'string',
        },
      },
      type: 'object',
    },
    Users: {
      properties: {
        Users: {
          items: {
            $ref: '#/components/schemas/User',
          },
          type: 'array',
        },
      },
      type: 'object',
      'x-isObjectArray': true,
    },
    ValidationError: {
      externalDocs: {
        url: 'https://developer.xero.com/documentation/api/http-response-codes',
      },
      properties: {
        Message: {
          description: 'Validation error message',
          type: 'string',
        },
      },
      type: 'object',
    },
  },
  securitySchemes: {
    OAuth2: {
      description: 'For more information',
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://login.xero.com/identity/connect/authorize',
          scopes: {
            'accounting.attachments': 'Grant read-write access to attachments',
            'accounting.attachments.read': 'Grant read-only access to attachments',
            'accounting.contacts': 'Grant read-write access to contacts and contact groups',
            'accounting.contacts.read': 'Grant read-only access to contacts and contact groups',
            'accounting.journals.read': 'Grant read-only access to journals',
            'accounting.reports.read': 'Grant read-only access to accounting reports',
            'accounting.reports.tenninetynine.read': 'Grant read-only access to 1099 reports',
            'accounting.settings': 'Grant read-write access to organisation and account settings',
            'accounting.settings.read': 'Grant read-only access to organisation and account settings',
            'accounting.transactions':
              'Grant read-write access to bank transactions, credit notes, invoices, repeating invoices',
            'accounting.transactions.read': 'Grant read-only access to invoices',
            assets: 'Grant read-write access to assets',
            'assets.read': 'Grant read-only access to fixed assets',
            bankfeeds: 'Grant read-write access to bankfeeds',
            email: 'Grant read-only access to your email',
            files: 'Grant read-write access to files and folders',
            'files.read': 'Grant read-only access to files and folders',
            openid: 'Grant read-only access to your open id',
            paymentservices: 'Grant read-write access to payment services',
            payroll: 'Grant read-write access to payroll',
            'payroll.employees': 'Grant read-write access to payroll employees',
            'payroll.employees.read': 'Grant read-only access to payroll employees',
            'payroll.leaveapplications': 'Grant read-write access to payroll leaveapplications',
            'payroll.leaveapplications.read': 'Grant read-only access to payroll leaveapplications',
            'payroll.payitems': 'Grant read-write access to payroll payitems',
            'payroll.payitems.read': 'Grant read-only access to payroll payitems',
            'payroll.payrollcalendars': 'Grant read-write access to payroll calendars',
            'payroll.payrollcalendars.read': 'Grant read-only access to payroll calendars',
            'payroll.payruns': 'Grant read-write access to payroll payruns',
            'payroll.payruns.read': 'Grant read-only access to payroll payruns',
            'payroll.payslip': 'Grant read-write access to payroll payslips',
            'payroll.payslip.read': 'Grant read-only access to payroll payslips',
            'payroll.read': 'Grant read-only access to payroll',
            'payroll.settings.read': 'Grant read-only access to payroll settings',
            'payroll.superfundproducts.read': 'Grant read-only access to payroll superfundproducts',
            'payroll.superfunds': 'Grant read-write access to payroll superfunds',
            'payroll.superfunds.read': 'Grant read-only access to payroll superfunds',
            'payroll.timesheets': 'Grant read-write access to payroll timesheets',
            'payroll.timesheets.read': 'Grant read-only access to payroll timesheets',
            profile: 'your profile information',
            projects: 'Grant read-write access to projects',
            'projects.read': 'Grant read-only access to projects',
          },
          tokenUrl: 'https://identity.xero.com/connect/token',
        },
      },
      type: 'oauth2',
    },
  },
} as TComponents;
