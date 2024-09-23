// @ts-nocheck
export type TPaths = {
  '/v2/account_stages.json': {
    get: {
      description: 'Fetches multiple account stage records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: "IDs of account stages to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'updated_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at, order. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/AccountStage';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List account stages';
      tags: ['Account Stages'];
    };
  };
  '/v2/account_stages/{id}.json': {
    get: {
      description: 'Fetches an account stage, by ID only.\n';
      parameters: [
        {
          description: 'Account Stage ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/AccountStage';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch an account stage';
      tags: ['Account Stages'];
    };
  };
  '/v2/account_tiers.json': {
    get: {
      description: 'Fetches multiple account tier records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: "IDs of Account Tiers to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters Account Tiers by name. Multiple names can be applied';
          explode: false;
          in: 'query';
          name: 'name';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at, order. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/AccountTier';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List Account Tiers';
      tags: ['Account Tiers'];
    };
  };
  '/v2/account_tiers/{id}.json': {
    get: {
      description: 'Fetches an account tier, by ID only.\n';
      parameters: [
        {
          description: 'Account Tier ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/AccountTier';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch an account tier';
      tags: ['Account Tiers'];
    };
  };
  '/v2/account_upserts.json': {
    post: {
      description: 'Upserts an account record. The upsert_key dictates how the upsert will be performed. The create and update behavior\nis exactly the same as the individual create and update endpoints.\n';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                account_tier_id: {
                  description: 'ID of the Account Tier for this Account';
                  type: 'integer';
                };
                city: {
                  description: 'City';
                  type: 'string';
                };
                company_stage_id: {
                  description: 'ID of the CompanyStage assigned to this Account';
                  type: 'integer';
                };
                company_type: {
                  description: "Type of the Account's company";
                  type: 'string';
                };
                conversational_name: {
                  description: 'Conversational name of the Account';
                  type: 'string';
                };
                country: {
                  description: 'Country';
                  type: 'string';
                };
                crm_id: {
                  description: 'Requires Salesforce.\n\nID of the person in your external CRM. You must provide a crm_id_type if this is included.\n\nValidations will be applied to the crm_id depending on the crm_id_type. A "salesforce" ID must be exactly 18 characters. A "salesforce" ID must be either an Account (001) object. The type will be validated using the 18 character ID.\n\nThis field can only be used if your application or API key has the "account:set_crm_id" scope.\n\n';
                  type: 'string';
                };
                crm_id_type: {
                  description: 'The CRM that the provided crm_id is for. Must be one of: salesforce';
                  type: 'string';
                };
                custom_fields: {
                  description: "Custom fields are defined by the user's team. Only fields with values are presented in the API.";
                  items: {
                    type: 'object';
                  };
                  type: 'array';
                };
                description: {
                  description: 'Description';
                  type: 'string';
                };
                do_not_contact: {
                  description: 'Whether this company can not be contacted. Values are either true or false. Setting this to true will remove all associated people from all active communications';
                  type: 'boolean';
                };
                domain: {
                  description: 'Website domain, not a fully qualified URI';
                  type: 'string';
                };
                founded: {
                  description: 'Date or year of founding';
                  type: 'string';
                };
                id: {
                  description: "ID of the account to update. Used if the upsert_key=id. When id and another upsert_key are provided,\nthe request will fail if the upsert record id and id parameter don't match.\n";
                  type: 'integer';
                };
                industry: {
                  description: 'Industry';
                  type: 'string';
                };
                linkedin_url: {
                  description: 'Full LinkedIn url';
                  type: 'string';
                };
                locale: {
                  description: 'Time locale';
                  type: 'string';
                };
                name: {
                  description: 'Account Full Name';
                  type: 'string';
                };
                owner_id: {
                  description: 'ID of the User that owns this Account';
                  type: 'integer';
                };
                phone: {
                  description: 'Phone number without formatting';
                  type: 'string';
                };
                postal_code: {
                  description: 'Postal code';
                  type: 'string';
                };
                revenue_range: {
                  description: 'Estimated revenue range';
                  type: 'string';
                };
                size: {
                  description: 'Estimated number of people in employment';
                  type: 'string';
                };
                state: {
                  description: 'State';
                  type: 'string';
                };
                street: {
                  description: 'Street name and number';
                  type: 'string';
                };
                tags: {
                  description: 'All tags applied to this Account';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
                twitter_handle: {
                  description: 'Twitter handle, with @';
                  type: 'string';
                };
                upsert_key: {
                  description: 'Name of the parameter to upsert on. The field must be provided in the input parameters, or the request will fail.\nThe request will also fail if there are multiple records matched by the upsert field.\n\nIf upsert_key is not provided, this endpoint will not update an existing record.\n\nValid options are: id, crm_id, domain. If crm_id is provided, then a valid crm_id_type must be provided, as documented\nfor the account create and update endpoints.\n';
                  type: 'string';
                };
                website: {
                  description: 'Website';
                  type: 'string';
                };
              };
              required: ['name', 'domain'];
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/AccountUpsert';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Upsert an account';
      tags: ['Account Upsert'];
    };
  };
  '/v2/accounts.json': {
    get: {
      description: 'Fetches multiple account records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: "IDs of accounts to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters accounts by crm_id. Multiple crm ids can be applied';
          explode: false;
          in: 'query';
          name: 'crm_id';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters accounts by the tags applied to the account. Multiple tags can be applied';
          explode: false;
          in: 'query';
          name: 'tag';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: "Filters accounts by the tag id's applied to the account. Multiple tag id's can be applied";
          explode: false;
          in: 'query';
          name: 'tag_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the created_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'created_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'updated_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Domain of the accounts to fetch. Domains are unique and lowercase';
          in: 'query';
          name: 'domain';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Filters accounts by website. Multiple websites can be applied. An additional value of "_is_null" can be passed to filter accounts that do not have a website.';
          explode: false;
          in: 'query';
          name: 'website';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters accounts by archived_at status. Returns only accounts where archived_at is not null if this field is true. Returns only accounts where archived_at is null if this field is false. Do not pass this parameter to return both archived and unarchived accounts. This filter is not applied if any value other than "true" or "false" is passed.';
          in: 'query';
          name: 'archived';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Names of accounts to fetch. Name matches are exact and case sensitive. Multiple names can be fetched.';
          explode: false;
          in: 'query';
          name: 'name';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters accounts by account_stage_id. Multiple account_stage_ids can be applied. An additional value of "_is_null" can be passed to filter accounts that do not have account_stage_id';
          explode: false;
          in: 'query';
          name: 'account_stage_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters accounts by account_tier_id. Multiple account tier ids can be applied';
          explode: false;
          in: 'query';
          name: 'account_tier_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters accounts by owner_id. Multiple owner_ids can be applied. An additional value of "_is_null" can be passed to filter accounts that are unowned';
          explode: false;
          in: 'query';
          name: 'owner_id';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters accounts by whether the owner is active or not.';
          in: 'query';
          name: 'owner_is_active';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Equality filters that are applied to the last_contacted field. A single filter can be used by itself or combined with other filters to create a range.\nAdditional values of "_is_null" or "_is_not_null" can be passed to filter records that either have no timestamp value or any timestamp value.\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          in: 'query';
          name: 'last_contacted';
          required: false;
          schema: {
            type: 'object';
          };
        },
        {
          description: 'Filters by accounts matching all given custom fields. The custom field names are case-sensitive, but the provided values are case-insensitive. Example: v2/accounts?custom_fields[custom_field_name]=custom_field_value';
          in: 'query';
          name: 'custom_fields';
          required: false;
          schema: {
            type: 'object';
          };
        },
        {
          description: 'Filters accounts by industry by exact match. Supports partial matching';
          explode: false;
          in: 'query';
          name: 'industry';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters accounts by country by exact match. Supports partial matching';
          explode: false;
          in: 'query';
          name: 'country';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters accounts by state by exact match. Supports partial matching';
          explode: false;
          in: 'query';
          name: 'state';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters accounts by city by exact match. Supports partial matching';
          explode: false;
          in: 'query';
          name: 'city';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters accounts by owner_crm_id. Multiple owner_crm_ids can be applied. An additional value of "_is_null" can be passed to filter accounts that are unowned. A "_not_in" modifier can be used to exclude specific owner_crm_ids. Example: v2/accounts?owner_crm_id[_not_in]=id';
          explode: false;
          in: 'query';
          name: 'owner_crm_id';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters accounts by locale. Multiple locales are allowed';
          explode: false;
          in: 'query';
          name: 'locales';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters by accounts matching all given user relationship fields, _is_null or _unmapped can be passed to filter accounts with null or unmapped user relationship values. Example: v2/accounts?user_relationships[name]=value';
          in: 'query';
          name: 'user_relationships';
          required: false;
          schema: {
            type: 'object';
          };
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at, last_contacted_at, account_stage, account_stage_name, account_tier, account_tier_name, name, counts_people. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Account';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List accounts';
      tags: ['Accounts'];
    };
    post: {
      description: 'Creates an account.\n\n"domain" must be unique on the current team.\n';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                account_tier_id: {
                  description: 'ID of the Account Tier for this Account';
                  type: 'integer';
                };
                city: {
                  description: 'City';
                  type: 'string';
                };
                company_stage_id: {
                  description: 'ID of the CompanyStage assigned to this Account';
                  type: 'integer';
                };
                company_type: {
                  description: "Type of the Account's company";
                  type: 'string';
                };
                conversational_name: {
                  description: 'Conversational name of the Account';
                  type: 'string';
                };
                country: {
                  description: 'Country';
                  type: 'string';
                };
                crm_id: {
                  description: 'Requires Salesforce.\n\nID of the person in your external CRM. You must provide a crm_id_type if this is included.\n\nValidations will be applied to the crm_id depending on the crm_id_type. A "salesforce" ID must be exactly 18 characters. A "salesforce" ID must be either an Account (001) object. The type will be validated using the 18 character ID.\n\nThis field can only be used if your application or API key has the "account:set_crm_id" scope.\n\n';
                  type: 'string';
                };
                crm_id_type: {
                  description: 'The CRM that the provided crm_id is for. Must be one of: salesforce';
                  type: 'string';
                };
                custom_fields: {
                  description: "Custom fields are defined by the user's team. Only fields with values are presented in the API.";
                  items: {
                    type: 'object';
                  };
                  type: 'array';
                };
                description: {
                  description: 'Description';
                  type: 'string';
                };
                do_not_contact: {
                  description: 'Whether this company can not be contacted. Values are either true or false. Setting this to true will remove all associated people from all active communications';
                  type: 'boolean';
                };
                domain: {
                  description: 'Website domain, not a fully qualified URI';
                  type: 'string';
                };
                founded: {
                  description: 'Date or year of founding';
                  type: 'string';
                };
                industry: {
                  description: 'Industry';
                  type: 'string';
                };
                linkedin_url: {
                  description: 'Full LinkedIn url';
                  type: 'string';
                };
                locale: {
                  description: 'Time locale';
                  type: 'string';
                };
                name: {
                  description: 'Account Full Name';
                  type: 'string';
                };
                owner_id: {
                  description: 'ID of the User that owns this Account';
                  type: 'integer';
                };
                phone: {
                  description: 'Phone number without formatting';
                  type: 'string';
                };
                postal_code: {
                  description: 'Postal code';
                  type: 'string';
                };
                revenue_range: {
                  description: 'Estimated revenue range';
                  type: 'string';
                };
                size: {
                  description: 'Estimated number of people in employment';
                  type: 'string';
                };
                state: {
                  description: 'State';
                  type: 'string';
                };
                street: {
                  description: 'Street name and number';
                  type: 'string';
                };
                tags: {
                  description: 'All tags applied to this Account';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
                twitter_handle: {
                  description: 'Twitter handle, with @';
                  type: 'string';
                };
                website: {
                  description: 'Website';
                  type: 'string';
                };
              };
              required: ['name', 'domain'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Account';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create an account';
      tags: ['Accounts'];
    };
  };
  '/v2/accounts/{id}.json': {
    delete: {
      description: 'Deletes an account. This operation is not reversible without contacting support.\nThis operation can be called multiple times successfully.\n\nDeleting an account will remove all connected people from that account.\n';
      parameters: [
        {
          description: 'Account ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '204': {
          description: 'The Account has been deleted successfully';
        };
      };
      summary: 'Delete an account';
      tags: ['Accounts'];
    };
    get: {
      description: 'Fetches an account, by ID only.\n';
      parameters: [
        {
          description: 'Account ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Account';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch an account';
      tags: ['Accounts'];
    };
    put: {
      description: 'Updates an account.\n\n"domain" must be unique on the current team.\n';
      parameters: [
        {
          description: 'Account ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                account_tier_id: {
                  description: 'ID of the Account Tier for this Account';
                  type: 'integer';
                };
                archived: {
                  description: "Whether this Account should be archived or not. Setting this to true sets archived_at to the current time if it's not already set. Setting this to false will set archived_at to null";
                  type: 'boolean';
                };
                city: {
                  description: 'City';
                  type: 'string';
                };
                company_stage_id: {
                  description: 'ID of the CompanyStage assigned to this Account';
                  type: 'integer';
                };
                company_type: {
                  description: "Type of the Account's company";
                  type: 'string';
                };
                conversational_name: {
                  description: 'Conversational name of the Account';
                  type: 'string';
                };
                country: {
                  description: 'Country';
                  type: 'string';
                };
                crm_id: {
                  description: 'Requires Salesforce.\n\nID of the person in your external CRM. You must provide a crm_id_type if this is included.\n\nValidations will be applied to the crm_id depending on the crm_id_type. A "salesforce" ID must be exactly 18 characters. A "salesforce" ID must be either an Account (001) object. The type will be validated using the 18 character ID.\n\nThis field can only be used if your application or API key has the "account:set_crm_id" scope.\n\n';
                  type: 'string';
                };
                crm_id_type: {
                  description: 'The CRM that the provided crm_id is for. Must be one of: salesforce';
                  type: 'string';
                };
                custom_fields: {
                  description: "Custom fields are defined by the user's team. Only fields with values are presented in the API.";
                  items: {
                    type: 'object';
                  };
                  type: 'array';
                };
                description: {
                  description: 'Description';
                  type: 'string';
                };
                do_not_contact: {
                  description: 'Whether this company can not be contacted. Values are either true or false. Setting this to true will remove all associated people from all active communications';
                  type: 'boolean';
                };
                domain: {
                  description: 'Website domain, not a fully qualified URI';
                  type: 'string';
                };
                founded: {
                  description: 'Date or year of founding';
                  type: 'string';
                };
                industry: {
                  description: 'Industry';
                  type: 'string';
                };
                linkedin_url: {
                  description: 'Full LinkedIn url';
                  type: 'string';
                };
                locale: {
                  description: 'Time locale';
                  type: 'string';
                };
                name: {
                  description: 'Account Full Name';
                  type: 'string';
                };
                owner_id: {
                  description: 'ID of the User that owns this Account';
                  type: 'integer';
                };
                phone: {
                  description: 'Phone number without formatting';
                  type: 'string';
                };
                postal_code: {
                  description: 'Postal code';
                  type: 'string';
                };
                revenue_range: {
                  description: 'Estimated revenue range';
                  type: 'string';
                };
                size: {
                  description: 'Estimated number of people in employment';
                  type: 'string';
                };
                state: {
                  description: 'State';
                  type: 'string';
                };
                street: {
                  description: 'Street name and number';
                  type: 'string';
                };
                tags: {
                  description: 'All tags applied to this Account';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
                twitter_handle: {
                  description: 'Twitter handle, with @';
                  type: 'string';
                };
                website: {
                  description: 'Website';
                  type: 'string';
                };
              };
              required: ['name', 'domain'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Account';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Update an existing Account';
      tags: ['Accounts'];
    };
  };
  '/v2/action_details/call_instructions.json': {
    get: {
      description: 'Fetches multiple call instruction records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: 'IDs of call instructions to fetch.';
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CallInstruction';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List call instructions';
      tags: ['Action Details - Call Instructions'];
    };
  };
  '/v2/action_details/call_instructions/{id}.json': {
    get: {
      description: 'Fetches a call instruction, by ID only.\n';
      parameters: [
        {
          description: 'Call instructions ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CallInstruction';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a call instructions';
      tags: ['Action Details - Call Instructions'];
    };
  };
  '/v2/actions.json': {
    get: {
      description: 'Fetches multiple action records. The records can be filtered, paged, and sorted according to\nthe respective parameters. Only actions that are currently "in_progess" will be returned by\nthis endpoint.\n\nIf the requester is not an admin, this endpoint will only return actions belonging to the requester.\nIf the request is an admin, this endpoint will return actions for the entire team. Additionaly, an admin\nmay use the user_guid parameter to request actions that belong to specific users on the team.\n';
      parameters: [
        {
          description: 'IDs of actions to fetch.';
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Fetch actions by step ID';
          in: 'query';
          name: 'step_id';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Filter actions by type';
          in: 'query';
          name: 'type';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Equality filters that are applied to the due_on field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'due_on';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: "Filters actions by the user's guid. Multiple user guids can be applied. The user must be a team admin to filter other users' actions";
          explode: false;
          in: 'query';
          name: 'user_guid';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters actions by person_id. Multiple person ids can be applied';
          explode: false;
          in: 'query';
          name: 'person_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters actions by cadence_id. Multiple cadence ids can be applied';
          explode: false;
          in: 'query';
          name: 'cadence_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters actions by multitouch_group_id. Multiple multitouch group ids can be applied';
          explode: false;
          in: 'query';
          name: 'multitouch_group_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'updated_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Action';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List actions';
      tags: ['Actions'];
    };
  };
  '/v2/actions/{id}.json': {
    get: {
      description: 'Fetches an action, by ID only.\nThis endpoint will only return actions that are in_progress or pending_activity.\nOnce an action is complete, the request for that action will return a 404 status code.\n';
      parameters: [
        {
          description: 'Action ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Action';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch an action';
      tags: ['Actions'];
    };
  };
  '/v2/activities.json': {
    post: {
      description: 'Creates an activity. An activity will mark the associated action as completed. Currently,\nonly certain action types can have an activity explicitly created for them.\n';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                action_id: {
                  description: "Action that is being completed. This will validate that the action is still\nvalid before completed it. The same action can never be successfully passed twice to this endpoint.\nThe action must have a type of 'integration'.\n";
                  type: 'integer';
                };
                task_id: {
                  description: "Task that is being completed. This will validate that the task is still\nvalid before completed it. The same action can never be successfully passed twice to this endpoint.\nThe task must have a type of 'integration'.\n";
                  type: 'integer';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Activity';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create an activity';
      tags: ['Activities'];
    };
  };
  '/v2/activities/calls.json': {
    get: {
      description: 'Fetches multiple call records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: "IDs of calls to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the created_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'created_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'updated_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters list to only include guids';
          explode: false;
          in: 'query';
          name: 'user_guid';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters calls by person_id. Multiple person ids can be applied';
          explode: false;
          in: 'query';
          name: 'person_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters calls by sentiment. Sentiment matches are exact and case sensitive. Multiple sentiments are allowed.';
          explode: false;
          in: 'query';
          name: 'sentiment';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters calls by disposition. Disposition matches are exact and case sensitive. Multiple dispositions are allowed.';
          explode: false;
          in: 'query';
          name: 'disposition';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Call';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List calls';
      tags: ['Calls'];
    };
    post: {
      description: 'Creates a call. The parameters of this endpoint can be used to create an action\nand ensure that the CRM Task is mapped correctly.\n';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                action_id: {
                  description: "Action that this call is being logged for. This will validate that the action is still\nvalid before completing it. The same action can never be successfully passed twice to this endpoint. The\naction must have a type of 'phone'.\n";
                  type: 'integer';
                };
                crm_params: {
                  description: 'CRM specific parameters. Some parameters are required on a per-team basis. Consume the\nCrmActivityFields endpoint to receive a list of valid parameters. The "field" property\nis passed as the key of this object, and the value of this object is the value that you\nwould like to set.\n\nIf CrmActivityField has a non-null value, then that value must be submitted, or excluded\nfrom API calls, as these values are automatically applied.\n';
                  type: 'object';
                };
                disposition: {
                  description: 'The disposition of the call. Can be required on a per-team basis. Must be present in the disposition list.';
                  type: 'string';
                };
                duration: {
                  description: 'The length of the call, in seconds';
                  type: 'integer';
                };
                linked_call_data_record_ids: {
                  description: 'CallDataRecord associations that will become linked to the created call. It is possible to pass\nmultiple CallDataRecord ids in this field; this can be used to represent multiple phone calls\nthat made up a single call.\n\nAny call data record that is used must not already be linked to a call. It is not possible\nto link a call data record to multiple calls, and it is not possible to re-assign a call data\nrecord to a different call.\n';
                  items: {
                    type: 'integer';
                  };
                  type: 'array';
                };
                notes: {
                  description: "Notes to log for the call. This is similar to the notes endpoint, but ensures that the notes get synced to the user's CRM";
                  type: 'string';
                };
                person_id: {
                  description: 'The ID of the person whom this call will be logged for';
                  type: 'integer';
                };
                sentiment: {
                  description: 'The sentiment of the call. Can be required on a per-team basis. Must be present in the sentiment list.';
                  type: 'string';
                };
                to: {
                  description: 'The phone number that was called';
                  type: 'string';
                };
                user_guid: {
                  description: "Guid of the user whom this call should be logged for. Defaults to the authenticated user. Only team admins can pass another user's guid";
                  type: 'string';
                };
              };
              required: ['person_id'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Call';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create a call';
      tags: ['Calls'];
    };
  };
  '/v2/activities/calls/{id}.json': {
    get: {
      description: 'Fetches a call, by ID only.\n';
      parameters: [
        {
          description: 'Call ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Call';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a call';
      tags: ['Calls'];
    };
  };
  '/v2/activities/emails.json': {
    get: {
      description: 'Fetches multiple email records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: "IDs of emails to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'updated_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters emails by whether they have bounced or not';
          in: 'query';
          name: 'bounced';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Filters emails by crm_activity_id. Multiple crm activty ids can be applied';
          explode: false;
          in: 'query';
          name: 'crm_activity_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters emails by action_id. Multiple action ids can be applied';
          explode: false;
          in: 'query';
          name: 'action_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters emails by user_id. Multiple User ids can be applied';
          explode: false;
          in: 'query';
          name: 'user_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters emails by status. Multiple status can be applied, possible values are sent, sent_from_gmail, sent_from_external, pending, pending_reply_check, scheduled, sending, delivering, failed, cancelled, pending_through_gmail, pending_through_external';
          explode: false;
          in: 'query';
          name: 'status';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters emails by cadence. Multiple cadence ids can be applied';
          explode: false;
          in: 'query';
          name: 'cadence_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters emails by step. Multiple step ids can be applied';
          explode: false;
          in: 'query';
          name: 'step_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters emails by one-off only';
          in: 'query';
          name: 'one_off';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specify explicit scoped fields desired on the Email Resource.';
          explode: false;
          in: 'query';
          name: 'scoped_fields';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters emails by person_id. Multiple person ids can be applied';
          explode: false;
          in: 'query';
          name: 'person_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters emails by recipient email address. Multiple emails can be applied.';
          explode: false;
          in: 'query';
          name: 'email_addresses';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters emails by personalization score';
          explode: false;
          in: 'query';
          name: 'personalization';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the sent_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'sent_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: updated_at, send_time. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Email';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List emails';
      tags: ['Emails'];
    };
  };
  '/v2/activities/emails/{id}.json': {
    get: {
      description: 'Fetches an email, by ID only.\n';
      parameters: [
        {
          description: 'Email ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Email';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch an email';
      tags: ['Emails'];
    };
  };
  '/v2/activity_histories': {
    get: {
      description: 'Fetches all of the customer\'s past activities for your application. Returns all the Activities that are found on the Salesloft Activity Feed. <a href="/activity-history.html" target="_blank" rel="noopener noreferrer">Visit here for more details</a>.';
      parameters: [
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Key to sort on, must be one of: occurred_at, updated_at. Defaults to occurred_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Filter by the type of activity. Must be one of: added_to_cadence, completed_action, call, requested_email, sent_email, received_email, email_reply, note, success, dnc_event, residency_change, meeting, meeting_held, message_conversation, task, voicemail, opportunity_stage_change, opportunity_amount_change, opportunity_close_date_change. Can be provided as an array, or as an object of type[resource_type][]=type';
          in: 'query';
          name: 'type';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'For internal use only. This field does not comply with our backwards compatibility policies. This filter is for authenticated users of Salesloft only and will not work for OAuth Applications. Filter by the {resource_type, resource_id} of activity. Provide this in the format resource[]=person,1234';
          in: 'query';
          name: '_resource';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Equality filters that are applied to the occurred_at field. A single filter can be used by itself or combined with other filters to create a range.\n---CUSTOM---\n{"keys":[{"description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"gt","type":"iso8601 string"},{"description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"gte","type":"iso8601 string"},{"description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"lt","type":"iso8601 string"},{"description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"lte","type":"iso8601 string"}],"type":"object"}\n';
          in: 'query';
          name: 'occurred_at';
          required: false;
          schema: {
            type: 'object';
          };
        },
        {
          description: "Filter by the pinned status of activity. Must be 'true' or 'false'";
          in: 'query';
          name: 'pinned';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Filter by the resource type. A resource is a Salesloft object that the activity is attributed to. A valid resource types must be one of person, account, crm_opportunity. Can be provided as an array';
          in: 'query';
          name: 'resource_type';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Filter by the resource id. "resource_type" filter is required to use this filter.';
          explode: false;
          in: 'query';
          name: 'resource_id';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n---CUSTOM---\n{"keys":[{"description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"gt","type":"iso8601 string"},{"description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"gte","type":"iso8601 string"},{"description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"lt","type":"iso8601 string"},{"description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"lte","type":"iso8601 string"}],"type":"object"}\n';
          in: 'query';
          name: 'updated_at';
          required: false;
          schema: {
            type: 'object';
          };
        },
        {
          description: "Filter activities by a user's guid.";
          in: 'query';
          name: 'user_guid';
          required: false;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/ActivityHistory';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List Past Activities';
      tags: ['Activity Histories'];
    };
  };
  '/v2/bulk_jobs': {
    get: {
      description: 'Fetches multiple bulk job records. The records can be filtered, paged, and sorted according to the respective parameters.';
      parameters: [
        {
          description: 'The state of the bulk job. Accepts multiple states. Each state must be one of: open, executing, done';
          explode: false;
          in: 'query';
          name: 'state';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filter by id using comparison operators. Only supports greater than (gt) comparison (i.e. id[gt]=123)';
          in: 'query';
          name: 'id';
          required: false;
          schema: {
            type: 'object';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/BulkJob';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List bulk jobs';
      tags: ['Bulk Jobs'];
    };
    post: {
      description: 'Creates a bulk job. The type of the bulk job must be included when created.\n\nFor additional information on creating bulk jobs, the types of supported bulk jobs, and examples of the bulk job flow, visit the <a href="/bulk.html" target="_blank" rel="noopener noreferrer">bulk job details page</a>.\n';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                name: {
                  description: 'Name for your bulk job';
                  type: 'string';
                };
                type: {
                  description: 'Type of bulk job. Must be a valid type. Follow link to the bulk job details page above to view supported types.';
                  type: 'string';
                };
              };
              required: ['type'];
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/BulkJob';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create a bulk job';
      tags: ['Bulk Jobs'];
    };
  };
  '/v2/bulk_jobs/{bulk_jobs_id}/job_data': {
    get: {
      description: 'Fetches multiple job data records for a given bulk job. Pagination is not supported, but cursor based polling is via use of the `id[gt]` filter. Pass the last id seen (i.e. `id[gt]=1234`) in order to get the next batch of records.';
      parameters: [
        {
          description: 'The id for the bulk job to which the job data relates';
          in: 'path';
          name: 'bulk_jobs_id';
          required: true;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Filter by result status. Accepts multiple statuses. Each status must be one of pending, success, error, retrying';
          explode: false;
          in: 'query';
          name: 'status';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filter by id using comparison operators. Only supports greater than (gt) comparison (i.e. id[gt]=123)';
          in: 'query';
          name: 'id';
          required: false;
          schema: {
            type: 'object';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/BulkJobResult';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List job data for a bulk job';
      tags: ['Bulk Jobs - Job Data'];
    };
    post: {
      description: 'Upload job data for the specified bulk job. Upload an array of objects, where element contains the parameters necessary to execute the individual calls. Each call to this endpoint can handle up to 5,000 records at a time. There is no limit to how many times you can create job data for a given bulk job.\n\nFor additional information on creating bulk jobs, the types of supported bulk jobs, and examples of the bulk job flow, visit the <a href="/bulk.html" target="_blank" rel="noopener noreferrer">bulk job details page</a>.\n';
      parameters: [
        {
          description: 'The id for the bulk job to which the job data relates';
          in: 'path';
          name: 'bulk_jobs_id';
          required: true;
          schema: {
            type: 'integer';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                data: {
                  description: 'Array of objects containing parameters to be used to execute an instance of each. Array must be 5,000 records or less.';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
              };
              required: ['data'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/JobDataCreationResult';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create job data for a bulk job';
      tags: ['Bulk Jobs - Job Data'];
    };
  };
  '/v2/bulk_jobs/{bulk_jobs_id}/results': {
    get: {
      description: "Fetches multiple job data records for a completed bulk job. Note that until a bulk job's state is set to `done` the returned `data` will be an empty array. Pagination is not supported, but cursor based polling is via use of the `id[gt]` filter. Pass the last id seen (i.e. `id[gt]=1234`) in order to get the next batch of records.";
      parameters: [
        {
          description: 'The id for the Bulk Job';
          in: 'path';
          name: 'bulk_jobs_id';
          required: true;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Filter by result status. Accepts multiple statuses. Each status must be one of pending, success, error, retrying';
          explode: false;
          in: 'query';
          name: 'status';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filter by id using comparison operators. Only supports greater than (gt) comparison (i.e. id[gt]=123)';
          in: 'query';
          name: 'id';
          required: false;
          schema: {
            type: 'object';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/BulkJobResult';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List job data for a completed bulk job.';
      tags: ['Bulk Jobs - Results'];
    };
  };
  '/v2/bulk_jobs/{id}': {
    get: {
      description: 'Fetches a bulk job, by ID only.';
      parameters: [
        {
          description: 'The id for the Bulk Job';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'integer';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/BulkJob';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a bulk job';
      tags: ['Bulk Jobs'];
    };
    put: {
      description: 'Updates a bulk job\'s name and / or marks a bulk job as \'ready_to_execute\'.  May only be updated if the bulk job is still in an "open" state.\n\nFor additional information on creating bulk jobs, the types of supported bulk jobs, and examples of the bulk job flow, visit the <a href="/bulk.html" target="_blank" rel="noopener noreferrer">bulk job details page</a>.\n';
      parameters: [
        {
          description: 'The id for the bulk job to which the job data relates';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'integer';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                name: {
                  description: 'Name for your bulk job';
                  type: 'string';
                };
                ready_to_execute: {
                  description: 'Whether the job is ready to be executed. Must be true or false.';
                  type: 'boolean';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/BulkJob';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Update a bulk job';
      tags: ['Bulk Jobs'];
    };
  };
  '/v2/cadence_exports/{id}.json': {
    get: {
      description: 'Exports a cadence as JSON.\n';
      parameters: [
        {
          description: 'Cadence ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CadenceExport';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Export a cadence';
      tags: ['Cadence Exports'];
    };
  };
  '/v2/cadence_imports.json': {
    post: {
      description: 'New cadences can be created or steps can be imported onto existing cadences which do not have steps.\n<a href="/cadence-imports.html" target="_blank" rel="noopener noreferrer">Visit here for more details</a>.\n';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                cadence_content: {
                  description: 'Import data for cadence';
                  type: 'object';
                };
                settings: {
                  description: 'Settings for a cadence';
                  type: 'object';
                };
                sharing_settings: {
                  description: 'The shared settings for a cadence';
                  type: 'object';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CadenceImport';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Import cadences from JSON';
      tags: ['Cadence Imports'];
    };
  };
  '/v2/cadence_memberships.json': {
    get: {
      description: 'Fetches multiple cadence membership records. The records can be filtered, paged, and sorted according to\nthe respective parameters. A cadence membership is the association between a person and their current and\nhistorical time on a cadence. Cadence membership records are mutable and change over time. If a person is\nadded to a cadence and re-added to the same cadence in the future, there is a single membership record.\n';
      parameters: [
        {
          description: "IDs of cadence memberships to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'ID of the person to find cadence memberships for';
          in: 'query';
          name: 'person_id';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'ID of the cadence to find cadence memberships for';
          in: 'query';
          name: 'cadence_id';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'updated_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'If true, return only cadence memberships for people currently on cadences.  If false, return cadence memberships for people who have been removed from or have completed a cadence.';
          in: 'query';
          name: 'currently_on_cadence';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Key to sort on, must be one of: added_at, updated_at. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CadenceMembership';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List cadence memberships';
      tags: ['Cadence Memberships'];
    };
    post: {
      description: 'Adds a person to a cadence. person_id and cadence_id are required, and must be visible to the authenticated user. user_id will\ndefault to the authenticated user, but can be set to any visible user on the authenticated team.\n\nA person cannot be added to a cadence on behalf of a teammate unless the cadence is a team cadence, the cadence is owned by\nthe teammate, or the teammate has the Personal Cadence Admin permission.\n';
      parameters: [
        {
          description: 'ID of the person to create a cadence membership for';
          in: 'query';
          name: 'person_id';
          required: true;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'ID of the cadence to create a cadence membership for';
          in: 'query';
          name: 'cadence_id';
          required: true;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'ID of the user to create a cadence membership for. The associated cadence must be owned by the user, or it must be a team cadence';
          in: 'query';
          name: 'user_id';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'ID of the step on which the person should start the cadence. Start on first step is the default behavior without this parameter.';
          in: 'query';
          name: 'step_id';
          required: false;
          schema: {
            type: 'integer';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CadenceMembership';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create a cadence membership';
      tags: ['Cadence Memberships'];
    };
  };
  '/v2/cadence_memberships/{id}.json': {
    delete: {
      description: 'Cadence Membership\n';
      parameters: [
        {
          description: 'CadenceMembership ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '204': {
          description: 'The person has been removed from the cadence successfully';
        };
      };
      summary: 'Delete a cadence membership';
      tags: ['Cadence Memberships'];
    };
    get: {
      description: 'Fetches a cadence membership, by ID only.\n';
      parameters: [
        {
          description: 'CadenceMembership ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CadenceMembership';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a cadence membership';
      tags: ['Cadence Memberships'];
    };
  };
  '/v2/cadences.json': {
    get: {
      description: 'Fetches multiple cadence records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: "IDs of cadences to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'updated_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters cadences by whether they are a team cadence or not';
          in: 'query';
          name: 'team_cadence';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Filters cadences by whether they are shared';
          in: 'query';
          name: 'shared';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: "Filters cadences by the owner's guid. Multiple owner guids can be applied";
          explode: false;
          in: 'query';
          name: 'owned_by_guid';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters cadences by whether they are able to have people added to them';
          in: 'query';
          name: 'people_addable';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Filters cadences by name';
          explode: false;
          in: 'query';
          name: 'name';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters by group ids. Also supports group ids passed in as a JSON array string';
          in: 'query';
          name: 'group_ids';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Filters by whether the Cadences have been archived. Excluding this field will result in both archived and unarchived Cadences to return.';
          in: 'query';
          name: 'archived';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at, name. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Cadence';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List cadences';
      tags: ['Cadences'];
    };
  };
  '/v2/cadences/{id}.json': {
    get: {
      description: 'Fetches a cadence, by ID only.\n';
      parameters: [
        {
          description: 'Cadence ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Cadence';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a cadence';
      tags: ['Cadences'];
    };
  };
  '/v2/calendar/events': {
    get: {
      description: 'Returns all calendar events, paginated and filtered by the date.';
      parameters: [
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Key to sort on, must be one of: start_time. Defaults to start_time';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: "Lower bound (inclusive) for a calendar event's end time to filter by.\nMust be in ISO 8601 format.\n\nExample: `2022-02-14T10:12:59+00:00`.\n";
          in: 'query';
          name: 'start_time';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: "Upper bound (exclusive) for a calendar event's start time to filter by.\nMust be in ISO 8601 format.\n\nExample: `2022-02-14T10:12:59+00:00`.\n";
          in: 'query';
          name: 'end_time';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'user_guid of the user who created or included as a guest to the event.\n';
          in: 'query';
          name: 'user_guid';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'calendar_id of the user who created or included as a guest to the event.\n';
          in: 'query';
          name: 'calendar_id';
          required: false;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CalendarEvent';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List calendar events';
      tags: ['Calendar Events'];
    };
  };
  '/v2/calendar/events/upsert': {
    post: {
      description: '  Upserts a calendar event object.\n  Upsert key is a combination of `id` and `i_cal_uid` scoped to the given `calendar_id`.\n  Bulk operations:\n  This endpoint is used for bulk operations, see https://developers.salesloft.com/bulk.html for integration instructions.\n  Use `calendar/events/upsert` as an event type, and this spec as a data spec.\n  This endpoint should be used directly for the time sensitive calendar event updates.\n';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                all_day: {
                  description: 'Should be set to `true` for all day calendar events.';
                  type: 'boolean';
                };
                attendees: {
                  description: '  List of attendees of the calendar event.\n  Example:\n  ```\n    {\n      ...\n      "attendees": [\n        {\n          "name": "Alice",\n          "email": "alice@example.com",\n          "status": "accepted",\n          "organizer": true\n        },\n        {\n          "name": "Bob",\n          "email": "bob@example.com",\n          "status": "needsAction",\n          "organizer": false\n        }\n      ]\n    }\n  ```\n  `name`: full name of the attendee\n\n  `email`: email address of the attendee\n\n  `status`: one of the following - needsAction, accepted, tentative, declined\n\n  `organizer`: whether the attendee is the organizer of the calendar event\n';
                  type: 'object';
                };
                calendar_id: {
                  description: '  Calendar ID of the calendar event owner.\n  For the External Calendar connection use `external_{salesloft_user_guid}` format.\n  Example: `external_00210d1a-df8a-459f-af75-89b953b618b0`.\n';
                  type: 'string';
                };
                canceled_at: {
                  description: '  Cancellation time of the calendar event, as a combined date-time value in the ISO 8601 format with a time zone offset.\n  Example: `2022-02-14T10:12:59+00:00`.\n';
                  type: 'string';
                };
                description: {
                  description: 'Description of the calendar event';
                  type: 'string';
                };
                end_time: {
                  description: '  End time of the calendar event, as a combined date-time value in the ISO 8601 format with a time zone offset.\n  Example: `2022-02-14T10:12:59+00:00`.\n';
                  format: 'date';
                  type: 'string';
                };
                i_cal_uid: {
                  description: '  icalUID of the calendar event. Unique identifier for a calendar event across calendars.\n\n  Used as an upsert key.\n';
                  type: 'string';
                };
                id: {
                  description: '  Id of the calendar event, different for each occurrence in a recurring series.\n\n  Used as an upsert key.\n';
                  type: 'string';
                };
                location: {
                  description: 'Location of the calendar event as free-form text.';
                  type: 'string';
                };
                organizer: {
                  description: '  Email address of the organizer\n';
                  type: 'string';
                };
                recurring: {
                  description: 'Should be set to `true` if this is one of recurring series calendar event.';
                  type: 'boolean';
                };
                start_time: {
                  description: '  Start time of the calendar event, as a combined date-time value in the ISO 8601 format with a time zone offset.\n  Example: `2022-02-14T10:12:59+00:00`.\n';
                  format: 'date';
                  type: 'string';
                };
                status: {
                  description: "  Status of the calendar event. Depending on the status, the calendar event will or will not impact user's availability.\n  Possible values: `confirmed`, `tentative`, `cancelled`.\n  Example: `confirmed`.\n";
                  type: 'string';
                };
                title: {
                  description: 'Title of the calendar event';
                  type: 'string';
                };
                updated_at: {
                  description: "  Last modification time of the event in the ISO 8601 format with a time zone offset. The event will not be updated if the 'updated_at' timestamp from the payload is earlier than the one in the database.\n  Example: `2022-02-14T10:12:59+00:00`.\n";
                  type: 'string';
                };
              };
              required: ['id', 'i_cal_uid', 'start_time', 'end_time', 'calendar_id'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '201': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CalendarEvent';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Upsert a calendar event';
      tags: ['Calendar Events'];
    };
  };
  '/v2/call_data_records.json': {
    get: {
      description: 'Fetches multiple call data records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n\nCall data records are records of all inbound and outbound calls through Salesloft. A call data record may\nbe associated with a call, but does not have to be.\n';
      parameters: [
        {
          description: "IDs of call data records to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Return only call data records which have or do not have a call logged for them';
          in: 'query';
          name: 'has_call';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Equality filters that are applied to the created_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'created_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'updated_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters list to only include guids';
          explode: false;
          in: 'query';
          name: 'user_guid';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters list by person_id. Multiple person ids can be applied';
          explode: false;
          in: 'query';
          name: 'person_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CallDataRecord';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List call data records';
      tags: ['Call Data Records'];
    };
  };
  '/v2/call_data_records/{id}.json': {
    get: {
      description: 'Fetches a call data record, by ID only.\n';
      parameters: [
        {
          description: 'CallDataRecord ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CallDataRecord';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a call data record';
      tags: ['Call Data Records'];
    };
  };
  '/v2/call_dispositions.json': {
    get: {
      description: 'Fetches multiple call disposition records. The records can be sorted according to\nthe respective parameters. Call dispositions must be configured in application. This will\nchange in the future, but please contact us if you have a pressing use case.\n';
      parameters: [
        {
          description: 'Key to sort on, must be one of: name, updated_at. Defaults to name';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to ASC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CallDisposition';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List call dispositions';
      tags: ['Call Dispositions'];
    };
  };
  '/v2/call_sentiments.json': {
    get: {
      description: 'Fetches multiple call sentiment records. The records can be sorted according to\nthe respective parameters. Call sentiments must be configured in application. This will\nchange in the future, but please contact us if you have a pressing use case.\n';
      parameters: [
        {
          description: 'Filters call sentiments by name';
          in: 'query';
          name: 'name';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Key to sort on, must be one of: name, updated_at. Defaults to name';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to ASC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CallSentiment';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List call sentiments';
      tags: ['Call Sentiments'];
    };
  };
  '/v2/conversations/calls': {
    post: {
      description: 'Enqueue a Conversations Call for processing';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                call_created_at: {
                  description: 'Timestamp for when the call started. If not provided, will default to the time the request was received';
                  type: 'string';
                };
                direction: {
                  description: 'Call direction';
                  type: 'string';
                };
                duration: {
                  description: 'Duration of call in seconds';
                  type: 'number';
                };
                from: {
                  description: 'Phone number that call was made from';
                  type: 'string';
                };
                recording: {
                  description: 'Object containing recording info including the audio file (.mp3, .wav, .ogg, .m4a)';
                  type: 'object';
                };
                to: {
                  description: ' Phone number that was called';
                  type: 'string';
                };
                user_guid: {
                  description: 'Guid of the Salesloft User to assign the call to. If not provided, will default to the user within the authentication token';
                  type: 'string';
                };
              };
              required: ['to', 'from', 'duration', 'recording'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '201': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/ConversationsCall';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create Conversations Call';
      tags: ['Conversations Calls'];
    };
  };
  '/v2/crm_activities.json': {
    get: {
      description: 'Fetches multiple crm activity records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: 'IDs of crm activities to fetch.';
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'updated_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CrmActivity';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List crm activities';
      tags: ['CRM Activities'];
    };
  };
  '/v2/crm_activities/{id}.json': {
    get: {
      description: 'Fetches a crm activity, by ID only.\n';
      parameters: [
        {
          description: 'Crm activity ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CrmActivity';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a crm activity';
      tags: ['CRM Activities'];
    };
  };
  '/v2/crm_activity_fields.json': {
    get: {
      description: 'Fetches multiple crm activity field records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: 'Return only records with this source';
          in: 'query';
          name: 'source';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Key to sort on, must be one of: title, updated_at. Defaults to title';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to ASC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CrmActivityField';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List crm activity fields';
      tags: ['CRM Activity Fields'];
    };
  };
  '/v2/crm_users.json': {
    get: {
      description: 'Crm Users\n';
      parameters: [
        {
          description: "IDs of crm users to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters crm users by crm_ids';
          explode: false;
          in: 'query';
          name: 'crm_id';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters crm users by user_ids';
          explode: false;
          in: 'query';
          name: 'user_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters crm users by user guids';
          explode: false;
          in: 'query';
          name: 'user_guid';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Key to sort on, must be one of: id, updated_at. Defaults to id';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CrmUser';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List crm users';
      tags: ['Crm Users'];
    };
  };
  '/v2/custom_fields.json': {
    get: {
      description: 'Fetches multiple custom field records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: 'IDs of custom fields to fetch.';
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Type of field to fetch. Value must be one of: person, company, opportunity';
          in: 'query';
          name: 'field_type';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at, name. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CustomField';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List custom fields';
      tags: ['Custom Fields'];
    };
    post: {
      description: 'Creates a custom field.\n';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                field_type: {
                  description: 'The field type of the custom field. Value must be one of: person, company, opportunity';
                  type: 'string';
                };
                name: {
                  description: 'The name of the custom field';
                  type: 'string';
                };
              };
              required: ['name'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CustomField';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create a custom field';
      tags: ['Custom Fields'];
    };
  };
  '/v2/custom_fields/{id}.json': {
    delete: {
      description: 'Deletes a custom field.\n';
      parameters: [
        {
          description: 'Custom Field ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '204': {
          description: 'The Custom Field has been deleted successfully';
        };
      };
      summary: 'Delete a custom field';
      tags: ['Custom Fields'];
    };
    get: {
      description: 'Fetches a custom field, by ID only.\n';
      parameters: [
        {
          description: 'Custom Field ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CustomField';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a custom field';
      tags: ['Custom Fields'];
    };
    put: {
      description: 'Update a custom field.\n';
      parameters: [
        {
          description: 'Custom Field ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                field_type: {
                  description: 'The field type of the custom field. Value must be one of: person, company, opportunity';
                  type: 'string';
                };
                name: {
                  description: 'The name of the custom field';
                  type: 'string';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CustomField';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Update a custom field';
      tags: ['Custom Fields'];
    };
  };
  '/v2/custom_roles.json': {
    get: {
      description: 'Fetches multiple custom role records. The records can be filtered, and sorted according to\nthe respective parameters. A custom role is any role that is not Admin or User.\n';
      parameters: [
        {
          description: 'IDs of roles to fetch.';
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: id, name. Defaults to id';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CustomRole';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List custom roles';
      tags: ['Roles'];
    };
  };
  '/v2/custom_roles/{id}.json': {
    get: {
      description: 'Fetches a custom role, by ID only.\n';
      parameters: [
        {
          description: 'Custom Role ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CustomRole';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a custom role';
      tags: ['Roles'];
    };
  };
  '/v2/email_template_attachments.json': {
    get: {
      description: 'Fetches multiple email template attachment records. The records can be filtered and paged according to\nthe respective parameters.\n';
      parameters: [
        {
          description: "IDs of email template attachments to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters email template attachments by email template IDs';
          explode: false;
          in: 'query';
          name: 'email_template_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/EmailTemplateAttachment';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List email template attachments';
      tags: ['Email Template Attachments'];
    };
  };
  '/v2/email_templates.json': {
    get: {
      description: 'Fetches multiple email template records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: "IDs of email templates to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'updated_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters email templates by whether they are linked to a team template or not';
          in: 'query';
          name: 'linked_to_team_template';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Filters email templates by title or subject';
          in: 'query';
          name: 'search';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Filters email templates by tags applied to the template by tag ID, not to exceed 100 IDs';
          explode: false;
          in: 'query';
          name: 'tag_ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters email templates by tags applied to the template, not to exceed 100 tags';
          explode: false;
          in: 'query';
          name: 'tag';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters email templates by current authenticated user';
          in: 'query';
          name: 'filter_by_owner';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Filters email templates by groups applied to the template by group ID. Not to exceed 500 IDs. Returns templates that are assigned to any of the group ids.';
          explode: false;
          in: 'query';
          name: 'group_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters email templates based on whether or not the template has been used on a cadence';
          in: 'query';
          name: 'include_cadence_templates';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Filters email templates to include archived templates or not';
          in: 'query';
          name: 'include_archived_templates';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: "Filters email templates to those belonging to the cadence. Not to exceed 100 IDs. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'cadence_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at, last_used_at. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/EmailTemplate';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List email templates';
      tags: ['Email Templates'];
    };
  };
  '/v2/email_templates/{id}.json': {
    get: {
      description: 'Fetches an email template, by ID only.\n';
      parameters: [
        {
          description: 'EmailTemplate ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: "Optionally will return the templates with the current user's email signature";
          in: 'query';
          name: 'include_signature';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/EmailTemplate';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch an email template';
      tags: ['Email Templates'];
    };
  };
  '/v2/external_emails.json': {
    post: {
      description: 'Creates an external email object.\n';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                mailbox: {
                  description: 'Email address of mailbox email was sent to';
                  type: 'string';
                };
                raw: {
                  description: 'Base64 encoded MIME email content';
                  type: 'string';
                };
              };
              required: ['mailbox', 'raw'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '201': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/ExternalEmail';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create an External Email';
      tags: ['External Emails'];
    };
  };
  '/v2/groups.json': {
    get: {
      description: 'Fetches multiple group records. The records can be filtered, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: 'IDs of groups to fetch.';
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Group';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List groups';
      tags: ['Groups'];
    };
  };
  '/v2/groups/{id}.json': {
    get: {
      description: 'Fetches a group, by ID only.\n';
      parameters: [
        {
          description: 'Group ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Group';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a group';
      tags: ['Groups'];
    };
  };
  '/v2/imports.json': {
    get: {
      description: 'Fetches multiple imports.\n';
      parameters: [
        {
          description: "IDs of imports to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: "ID of users to fetch imports for. Using this filter will return an empty array for non-admin users who request other user's imports";
          explode: false;
          in: 'query';
          name: 'user_ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to created_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Import';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List imports';
      tags: ['Imports'];
    };
    post: {
      description: 'Creates an import.\n';
      requestBody: {
        $ref: '#/components/requestBodies/postV2ImportsJson';
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Import';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create an import';
      tags: ['Imports'];
    };
  };
  '/v2/imports/{id}.json': {
    delete: {
      description: 'Deletes an import, by ID only. The associated people can be deleted as part of the deletion process.\n\nAdmin users can access imports for the entire team, but non-admin users can only access their own imports.\n';
      parameters: [
        {
          description: 'Import ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: "Whether to delete people on this Import. Possible values are: [not present], all, single.\n\n'single' will delete people who are only present in this Import.\n'all' will delete people even if they are present in other Imports.\nNot specifying this parameter will not delete any people\n";
          in: 'query';
          name: 'undo';
          required: false;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '204': {
          description: 'The import has been deleted successfully';
        };
      };
      summary: 'Delete an import';
      tags: ['Imports'];
    };
    get: {
      description: 'Fetches an import, by ID only.\n\nAdmin users can access imports for the entire team, but non-admin users can only access their own imports.\n';
      parameters: [
        {
          description: 'Import ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Import';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch an import';
      tags: ['Imports'];
    };
    put: {
      description: 'Updates an import, by ID only.\n\nAdmin users can access imports for the entire team, but non-admin users can only access their own imports.\n';
      parameters: [
        {
          description: 'Import ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        $ref: '#/components/requestBodies/postV2ImportsJson';
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Import';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Update an import';
      tags: ['Imports'];
    };
  };
  '/v2/live_website_tracking_parameters.json': {
    post: {
      description: 'Creates a Live Website Tracking parameter to identify a person\n';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                person_id: {
                  description: 'The person to create the LiveWebsiteTrackingParameter for';
                  type: 'integer';
                };
              };
              required: ['person_id'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/LiveWebsiteTrackingParameter';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create an Live Website Tracking Parameter';
      tags: ['Live Website Tracking Parameters'];
    };
  };
  '/v2/me.json': {
    get: {
      description: 'Authenticated user information. This endpoint does not accept any parameters as it is\nrepresents your authenticated user. The "Users" resource provides user information\nfor other users on the team.\n';
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/User';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch current user';
      tags: ['Me'];
    };
  };
  '/v2/meetings.json': {
    get: {
      description: 'Fetches multiple meeting records. The records can be filtered, paged, and sorted according to the respective parameters.\nMeetings resource is responsible for events created via the Salesloft platform using calendaring features.\nThese events can relate to cadences, people, and accounts.\n';
      parameters: [
        {
          description: "IDs of meetings to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters meetings by status. Possible values are: pending, booked, failed, retry';
          in: 'query';
          name: 'status';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Filters meetings by person_id. Multiple person ids can be applied';
          in: 'query';
          name: 'person_id';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Filters meetings by account_id. Multiple account ids can be applied';
          in: 'query';
          name: 'account_id';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Filters meetings by person_id. Multiple person ids can be applied';
          explode: false;
          in: 'query';
          name: 'person_ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: "List of event IDs. If both event_ids and i_cal_uids params are passed, this filters will be ORed. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'event_ids';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: "List of UIDs provided by calendar provider. If both event_ids and i_cal_uids params are passed, this filters will be ORed. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'i_cal_uids';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters meetings by task_id. Multiple task ids can be applied';
          explode: false;
          in: 'query';
          name: 'task_ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Flag to indicate whether to include owned_by_meetings_settings and booked_by_meetings_settings objects';
          in: 'query';
          name: 'include_meetings_settings';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Equality filters that are applied to the start_time field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'start_time';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the created_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'created_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters meetings by user_guid. Multiple user guids can be applied';
          explode: false;
          in: 'query';
          name: 'user_guids';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Whether to include deleted events in the result';
          in: 'query';
          name: 'show_deleted';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Key to sort on, must be one of: start_time, created_at, updated_at. Defaults to start_time';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Meeting';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List meetings';
      tags: ['Meetings'];
    };
  };
  '/v2/meetings/settings/searches.json': {
    post: {
      description: 'Fetches multiple meeting setting records. The records can be filtered, paged, and sorted according to the respective parameters.\n';
      parameters: [
        {
          description: 'Filters meeting settings by array of user_guids';
          explode: false;
          in: 'query';
          name: 'user_guids';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'updated_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters meeting settings by calendar type';
          in: 'query';
          name: 'calendar_type';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/MeetingSetting';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
        '403': {
          description: 'This endpoint is not available without the following permissions: manage_team';
        };
      };
      summary: 'List meeting settings';
      tags: ['Meetings Settings - Searches'];
    };
  };
  '/v2/meetings/settings/{id}.json': {
    put: {
      description: 'Updates a meeting setting, by ID only.\n';
      parameters: [
        {
          description: 'MeetingSetting ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                allow_booking_on_behalf: {
                  description: 'Allow other team members to schedule on you behalf.';
                  type: 'boolean';
                };
                allow_booking_overtime: {
                  description: 'Allow team members to insert available time outside your working hours.';
                  type: 'boolean';
                };
                allow_event_overlap: {
                  description: 'Allow team members to double book events on your calendar.';
                  type: 'boolean';
                };
                availability_limit: {
                  description: 'The number of days out the user allows a prospect to schedule a meeting';
                  type: 'integer';
                };
                availability_limit_enabled: {
                  description: 'If Availability Limits have been turned on';
                  type: 'boolean';
                };
                buffer_time_duration: {
                  description: 'Default buffer duration in minutes set by a user';
                  type: 'integer';
                };
                calendar_type: {
                  description: 'Calendar type';
                  type: 'string';
                };
                default_meeting_length: {
                  description: 'Default meeting length in minutes set by the user';
                  type: 'integer';
                };
                description: {
                  description: 'Default description of the meeting';
                  type: 'string';
                };
                enable_calendar_sync: {
                  description: 'Determines if a user enabled Calendar Sync feature';
                  type: 'boolean';
                };
                enable_dynamic_location: {
                  description: 'Determines if location will be filled via third-party service (Zoom, GoToMeeting, etc.)';
                  type: 'boolean';
                };
                location: {
                  description: 'Default location of the meeting';
                  type: 'string';
                };
                primary_calendar_connection_failed: {
                  description: 'Determines if the user lost calendar connection';
                  type: 'boolean';
                };
                primary_calendar_id: {
                  description: 'ID of the primary calendar';
                  type: 'string';
                };
                primary_calendar_name: {
                  description: 'Display name of the primary calendar';
                  type: 'string';
                };
                reschedule_meetings_enabled: {
                  description: 'Determines if a user enabled reschedule meetings feature';
                  type: 'boolean';
                };
                schedule_buffer_enabled: {
                  description: 'Determines if meetings are scheduled with a 15 minute buffer between them';
                  type: 'boolean';
                };
                schedule_delay: {
                  description: 'The number of hours in advance a user requires someone to a book a meeting with them';
                  type: 'integer';
                };
                share_event_detail: {
                  description: 'Allow team members to see the details of events on your calendar.';
                  type: 'boolean';
                };
                time_zone: {
                  description: 'Time zone for current calendar';
                  type: 'string';
                };
                times_available: {
                  description: 'Times available set by a user that can be used to book meetings';
                  type: 'object';
                };
                title: {
                  description: 'Default title of the meeting';
                  type: 'string';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/MeetingSetting';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Update a meeting setting';
      tags: ['Meeting Settings'];
    };
  };
  '/v2/meetings/{id}.json': {
    put: {
      description: 'Updates a meeting, by ID only.\n';
      parameters: [
        {
          description: 'Meeting ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                event_id: {
                  description: 'Meeting ID from the calendar provider';
                  type: 'string';
                };
                i_cal_uid: {
                  description: 'Meeting unique identifier (iCalUID)';
                  type: 'string';
                };
                no_show: {
                  description: 'Whether the meeting is a No Show meeting';
                  type: 'boolean';
                };
                reschedule_status: {
                  description: 'Status of the meeting rescheduling progress. Possible values are: pending, booked, failed, retry';
                  type: 'string';
                };
                status: {
                  description: 'Status of the meeting creation progress. Possible values are: pending, booked, failed, retry';
                  type: 'string';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Meeting';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Update a meeting';
      tags: ['Meetings'];
    };
  };
  '/v2/mime_email_payloads/{id}.json': {
    get: {
      description: 'Fetch the MIME content for email.\n';
      parameters: [
        {
          description: 'ID of Email';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/MimeEmailPayload';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch the MIME content for email';
      tags: ['Mime Email Payloads'];
    };
  };
  '/v2/notes.json': {
    get: {
      description: 'Fetches multiple note records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: 'Case insensitive type of item with which the note is associated.  Value must be one of: person, account';
          in: 'query';
          name: 'associated_with_type';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'ID of the item with which the note is associated.  The associated_with_type must also be present if this parameter is used';
          in: 'query';
          name: 'associated_with_id';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'updated_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: "IDs of notes to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Note';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List notes';
      tags: ['Notes'];
    };
    post: {
      description: 'Creates a note.\n';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                associated_with_id: {
                  description: 'ID of the item with which the note is associated';
                  type: 'integer';
                };
                associated_with_type: {
                  description: 'Case insensitive type of item with which the note is associated.  Value must be one of: person, account';
                  type: 'string';
                };
                call_id: {
                  description: 'ID of the call with which the note is associated. The call cannot already have a note';
                  type: 'integer';
                };
                content: {
                  description: 'The content of the note';
                  type: 'string';
                };
                skip_crm_sync: {
                  description: 'Boolean indicating if the CRM sync should be skipped.  No syncing will occur if true';
                  type: 'boolean';
                };
                subject: {
                  description: "The subject of the note's crm activity, defaults to 'Note'";
                  type: 'string';
                };
                user_guid: {
                  description: 'The user to create the note for. Only team admins may create notes on behalf of other users. Defaults to the requesting user';
                  type: 'string';
                };
              };
              required: ['content', 'associated_with_type', 'associated_with_id'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Note';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create a note';
      tags: ['Notes'];
    };
  };
  '/v2/notes/{id}.json': {
    delete: {
      description: 'Deletes a note owned by authorized account.\nThis operation is not reversible without contacting support.\nThis operation can be called multiple times successfully.\n';
      parameters: [
        {
          description: 'Note ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '204': {
          description: 'The Note has been deleted successfully';
        };
      };
      summary: 'Delete a note';
      tags: ['Notes'];
    };
    get: {
      description: 'Fetches a note, by ID only.\n';
      parameters: [
        {
          description: 'Note ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Note';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a note';
      tags: ['Notes'];
    };
    put: {
      description: 'Updates a note. Any changes to the note or associated records will not reflect in your CRM.\n';
      parameters: [
        {
          description: 'Note ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                call_id: {
                  description: 'ID of the call with which the note is associated. The call cannot already have a note. If the note is associated to a call already, it will become associated to the requested call';
                  type: 'integer';
                };
                content: {
                  description: 'The content of the note';
                  type: 'string';
                };
              };
              required: ['content'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Person';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Update a note';
      tags: ['Notes'];
    };
  };
  '/v2/ongoing_actions.json': {
    post: {
      description: 'Creates an ongoing action. An ongoing action is an action that is not yet completed,\nbut progress has been made towards the completion. The user should not need to do\nanything for an ongoing action to be completed. An ongoing action can be later completed\nby creating an activity.\n\nOngoing actions are marked as status=pending_activity.\n';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                action_id: {
                  description: 'Action that is being marked ongoing. This will validate that the action is still\nvalid before modifying it. Ongoing actions can not be marked ongoing.\n';
                  type: 'integer';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Action';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create an ongoing action';
      tags: ['Ongoing Actions'];
    };
  };
  '/v2/pending_emails.json': {
    get: {
      description: 'Fetches a list of emails ready to be sent by an external email service.\n';
      parameters: [
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/PendingEmail';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetches a list of emails ready to be sent by an external email service. Only emails sent with an External Email Client will appear here.';
      tags: ['Pending Emails'];
    };
  };
  '/v2/pending_emails/{id}.json': {
    put: {
      description: 'Updates the status of an email sent by an External Email Client. Does not affect lofted emails.\n';
      parameters: [
        {
          description: 'Email ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                error_message: {
                  description: 'The error message indicating why the email failed to send';
                  type: 'string';
                };
                message_id: {
                  description: 'The message id of the email that was sent';
                  type: 'string';
                };
                sent_at: {
                  description: 'The time that the email was actually sent in iso8601 format';
                  type: 'string';
                };
                status: {
                  description: "Delivery status of the email.  Valid statuses are 'sent' and 'failed'";
                  type: 'string';
                };
              };
              required: ['message_id', 'status'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/PendingEmail';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Updates the status of an email sent by an External Email Client';
      tags: ['Pending Emails'];
    };
  };
  '/v2/people.json': {
    get: {
      description: 'Fetches multiple person records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: "IDs of people to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'updated_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters people by email address. Multiple emails can be applied. An additional value of "_is_null" can be passed to filter people that do not have an email address.';
          explode: false;
          in: 'query';
          name: 'email_addresses';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: "Filters people by the owner's guid. Multiple owner guids can be applied";
          explode: false;
          in: 'query';
          name: 'owned_by_guid';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Includes people that have a given person_stage. Multiple person stage ids can be applied. An additional value of "_is_null" can be passed to filter people that do not have a stage set.';
          explode: false;
          in: 'query';
          name: 'person_stage_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters people by crm_id. Multiple crm ids can be applied';
          explode: false;
          in: 'query';
          name: 'crm_id';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters people by owner_crm_id. Multiple owner_crm_ids can be applied. An additional value of "_is_null" can be passed to filter people that are unowned. A "_not_in" modifier can be used to exclude specific owner_crm_ids. Example: v2/people?owner_crm_id[_not_in]=id';
          explode: false;
          in: 'query';
          name: 'owner_crm_id';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Includes people that have a given do_not_contact property';
          in: 'query';
          name: 'do_not_contact';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Includes people that can be emailed given do_not_contact and contact_restrictions property';
          in: 'query';
          name: 'can_email';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Includes people that can be called given do_not_contact and contact_restrictions property';
          in: 'query';
          name: 'can_call';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Includes people that can be sent a text message given do_not_contact and contact_restrictions property';
          in: 'query';
          name: 'can_text';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Filters people by the account they are linked to. Multiple account ids can be applied';
          explode: false;
          in: 'query';
          name: 'account_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters by people matching all given custom fields. The custom field names are case-sensitive, but the provided values are case-insensitive. Example: v2/people?custom_fields[custom_field_name]=custom_field_value';
          in: 'query';
          name: 'custom_fields';
          required: false;
          schema: {
            type: 'object';
          };
        },
        {
          description: 'Filters people that were imported by the given import ids. Multiple import ids can be applied. An additional value of "_is_null" can be passed to filter people that were not imported.';
          explode: false;
          in: 'query';
          name: 'import_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters people by job seniorty. Multiple job seniorities can be applied. An additional value of "_is_null" can be passed to filter people do not have a job_seniority.';
          explode: false;
          in: 'query';
          name: 'job_seniority';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters people by the tag ids applied to the person. Multiple tag ids can be applied.';
          explode: false;
          in: 'query';
          name: 'tag_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters people by whether the owner is active or not.';
          in: 'query';
          name: 'owner_is_active';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Filters people by the cadence that they are currently on. Multiple cadence_ids can be applied. An additional value of "_is_null" can be passed to filter people that are not on a cadence.';
          explode: false;
          in: 'query';
          name: 'cadence_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters people who have been starred by the user guids given.';
          explode: false;
          in: 'query';
          name: 'starred_by_guid';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters people by whether or not they have replied to an email or not.';
          in: 'query';
          name: 'replied';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Filters people by whether an email that was sent to them bounced or not.';
          in: 'query';
          name: 'bounced';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Filters people by whether or not they have been marked as a success or not.';
          in: 'query';
          name: 'success';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Filters people by whether or not they are marked as an European Union Resident or not.';
          in: 'query';
          name: 'eu_resident';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Filters people by their title by exact match. Supports partial matching';
          explode: false;
          in: 'query';
          name: 'title';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters people by their country by exact match. Supports partial matching';
          explode: false;
          in: 'query';
          name: 'country';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters people by their state by exact match. Supports partial matching';
          explode: false;
          in: 'query';
          name: 'state';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters people by their city by exact match. Supports partial matching';
          explode: false;
          in: 'query';
          name: 'city';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the last_contacted field. A single filter can be used by itself or combined with other filters to create a range.\nAdditional values of "_is_null" or "_is_not_null" can be passed to filter records that either have no timestamp value or any timestamp value.\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          in: 'query';
          name: 'last_contacted';
          required: false;
          schema: {
            type: 'object';
          };
        },
        {
          description: 'Equality filters that are applied to the last_contacted field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          in: 'query';
          name: 'created_at';
          required: false;
          schema: {
            type: 'object';
          };
        },
        {
          description: 'Filters people by whether or not that person is on a cadence or if they have been contacted in any way.';
          in: 'query';
          name: 'new';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Filter people by whether or not they have a phone number or not';
          in: 'query';
          name: 'phone_number';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Filters people by locales. Multiple locales can be applied. An additional value of "Null" can be passed to filter people that do not have a locale.';
          explode: false;
          in: 'query';
          name: 'locales';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters people by owner_id. Multiple owner_ids can be applied.';
          explode: false;
          in: 'query';
          name: 'owner_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'For internal use only. This field does not comply with our backwards compatibility policies. This filter is for authenticated users of Salesloft only and will not work for OAuth Applications. Filters people by the string provided. Can search and filter by name, title, industry, email_address and linked account name.';
          in: 'query';
          name: '_query';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at, last_contacted_at, name, title, job_seniority, call_count, sent_emails, clicked_emails, replied_emails, viewed_emails, account, cadence_stage_name. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Person';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List people';
      tags: ['People'];
    };
    post: {
      description: 'Creates a person. Either email_address or phone/last_name must be provided as a unique lookup\non the team.\n';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                account_id: {
                  description: 'ID of the Account to link this person to';
                  type: 'integer';
                };
                autotag_date: {
                  description: 'Whether the date should be added to this person as a tag. Default is false. The tag will be Y-m-d format.';
                  type: 'boolean';
                };
                city: {
                  description: 'City';
                  type: 'string';
                };
                contact_restrictions: {
                  description: 'Specific methods of communication to prevent for this person. This will prevent individual execution of these communication types as well as automatically skip cadence steps of this communication type for this person in SalesLoft. Values currently accepted: call, email, message';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
                country: {
                  description: 'Country';
                  type: 'string';
                };
                crm_id: {
                  description: 'Requires Salesforce.\n\nID of the person in your external CRM. You must provide a crm_id_type if this is included.\n\nValidations will be applied to the crm_id depending on the crm_id_type. A "salesforce" ID must be exactly 18 characters. A "salesforce" ID must be either a Lead (00Q) or Contact (003) object. The type will be validated using the 18 character ID.\n\nThis field can only be used if your application or API key has the "person:set_crm_id" scope.\n\n';
                  type: 'string';
                };
                crm_id_type: {
                  description: 'The CRM that the provided crm_id is for. Must be one of: salesforce';
                  type: 'string';
                };
                custom_fields: {
                  description: "Custom fields are defined by the user's team. Only fields with values are presented in the API.";
                  type: 'object';
                };
                do_not_contact: {
                  description: 'Whether or not this person has opted out of all communication. Setting this value to true prevents this person from being called, emailed, or added to a cadence in SalesLoft. If this person is currently in a cadence, they will be removed.';
                  type: 'boolean';
                };
                email_address: {
                  description: 'Email address';
                  type: 'string';
                };
                first_name: {
                  description: 'First name';
                  type: 'string';
                };
                home_phone: {
                  description: 'Home phone without formatting';
                  type: 'string';
                };
                import_id: {
                  description: 'ID of the Import this person is a part of. A person can be part of multiple imports, but this ID will always be the most recent Import';
                  type: 'integer';
                };
                job_seniority: {
                  description: 'The Job Seniority of a Person, must be one of director, executive, individual_contributor, manager, vice_president, unknown';
                  type: 'string';
                };
                last_name: {
                  description: 'Last name';
                  type: 'string';
                };
                linkedin_url: {
                  description: 'Linkedin URL';
                  type: 'string';
                };
                locale: {
                  description: 'Time locale of the person';
                  type: 'string';
                };
                mobile_phone: {
                  description: 'Mobile phone without formatting';
                  type: 'string';
                };
                owner_id: {
                  description: 'ID of the User that owns this person';
                  type: 'integer';
                };
                person_company_industry: {
                  description: 'Company industry. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended';
                  type: 'string';
                };
                person_company_name: {
                  description: 'Company name. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended';
                  type: 'string';
                };
                person_company_website: {
                  description: 'Company website. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended';
                  type: 'string';
                };
                person_stage_id: {
                  description: 'ID of the PersonStage of this person';
                  type: 'integer';
                };
                personal_email_address: {
                  description: 'Personal email address';
                  type: 'string';
                };
                personal_website: {
                  description: 'The website of this person';
                  type: 'string';
                };
                phone: {
                  description: 'Phone without formatting';
                  type: 'string';
                };
                phone_extension: {
                  description: 'Phone extension without formatting';
                  type: 'string';
                };
                secondary_email_address: {
                  description: 'Alternate email address';
                  type: 'string';
                };
                state: {
                  description: 'State';
                  type: 'string';
                };
                tags: {
                  description: 'All tags applied to this person';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
                title: {
                  description: 'Job title';
                  type: 'string';
                };
                twitter_handle: {
                  description: 'The twitter handle of this person';
                  type: 'string';
                };
                work_city: {
                  description: 'Work location - city';
                  type: 'string';
                };
                work_country: {
                  description: 'Work location - country';
                  type: 'string';
                };
                work_state: {
                  description: 'Work location - state';
                  type: 'string';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Person';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create a person';
      tags: ['People'];
    };
  };
  '/v2/people/{id}.json': {
    delete: {
      description: 'Deletes a person. This operation is not reversible without contacting support.\nThis operation can be called multiple times successfully.\n';
      parameters: [
        {
          description: 'Person id';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '204': {
          description: 'The person has been deleted successfully';
        };
      };
      summary: 'Delete a person';
      tags: ['People'];
    };
    get: {
      description: 'Fetches a person, by ID only.\n';
      parameters: [
        {
          description: 'Person ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Person';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a person';
      tags: ['People'];
    };
    put: {
      description: 'Updates a person.\n';
      parameters: [
        {
          description: 'Person id';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                account_id: {
                  description: 'ID of the Account to link this person to';
                  type: 'integer';
                };
                city: {
                  description: 'City';
                  type: 'string';
                };
                contact_restrictions: {
                  description: 'Specific methods of communication to prevent for this person. This will prevent individual execution of these communication types as well as automatically skip cadence steps of this communication type for this person in SalesLoft. Values currently accepted: call, email, message';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
                country: {
                  description: 'Country';
                  type: 'string';
                };
                crm_id: {
                  description: 'Requires Salesforce.\n\nID of the person in your external CRM. You must provide a crm_id_type if this is included.\n\nValidations will be applied to the crm_id depending on the crm_id_type. A "salesforce" ID must be exactly 18 characters. A "salesforce" ID must be either a Lead (00Q) or Contact (003) object. The type will be validated using the 18 character ID.\n\nThis field can only be used if your application or API key has the "person:set_crm_id" scope.\n\n';
                  type: 'string';
                };
                crm_id_type: {
                  description: 'The CRM that the provided crm_id is for. Must be one of: salesforce';
                  type: 'string';
                };
                custom_fields: {
                  description: "Custom fields are defined by the user's team. Only fields with values are presented in the API.";
                  type: 'object';
                };
                do_not_contact: {
                  description: 'Whether or not this person has opted out of all communication. Setting this value to true prevents this person from being called, emailed, or added to a cadence in SalesLoft. If this person is currently in a cadence, they will be removed.';
                  type: 'boolean';
                };
                email_address: {
                  description: 'Email address';
                  type: 'string';
                };
                first_name: {
                  description: 'First name';
                  type: 'string';
                };
                home_phone: {
                  description: 'Home phone without formatting';
                  type: 'string';
                };
                import_id: {
                  description: 'ID of the Import this person is a part of. A person can be part of multiple imports, but this ID will always be the most recent Import';
                  type: 'integer';
                };
                job_seniority: {
                  description: 'The Job Seniority of a Person, must be one of director, executive, individual_contributor, manager, vice_president, unknown';
                  type: 'string';
                };
                last_name: {
                  description: 'Last name';
                  type: 'string';
                };
                linkedin_url: {
                  description: 'Linkedin URL';
                  type: 'string';
                };
                locale: {
                  description: 'Time locale of the person';
                  type: 'string';
                };
                mobile_phone: {
                  description: 'Mobile phone without formatting';
                  type: 'string';
                };
                owner_id: {
                  description: 'ID of the User that owns this person';
                  type: 'integer';
                };
                person_company_industry: {
                  description: 'Company industry. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended';
                  type: 'string';
                };
                person_company_name: {
                  description: 'Company name. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended';
                  type: 'string';
                };
                person_company_website: {
                  description: 'Company website. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended';
                  type: 'string';
                };
                person_stage_id: {
                  description: 'ID of the PersonStage of this person';
                  type: 'integer';
                };
                personal_email_address: {
                  description: 'Personal email address';
                  type: 'string';
                };
                personal_website: {
                  description: 'The website of this person';
                  type: 'string';
                };
                phone: {
                  description: 'Phone without formatting';
                  type: 'string';
                };
                phone_extension: {
                  description: 'Phone extension without formatting';
                  type: 'string';
                };
                secondary_email_address: {
                  description: 'Alternate email address';
                  type: 'string';
                };
                state: {
                  description: 'State';
                  type: 'string';
                };
                tags: {
                  description: 'All tags applied to this person';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
                title: {
                  description: 'Job title';
                  type: 'string';
                };
                twitter_handle: {
                  description: 'The twitter handle of this person';
                  type: 'string';
                };
                work_city: {
                  description: 'Work location - city';
                  type: 'string';
                };
                work_country: {
                  description: 'Work location - country';
                  type: 'string';
                };
                work_state: {
                  description: 'Work location - state';
                  type: 'string';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Person';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Update a person';
      tags: ['People'];
    };
  };
  '/v2/person_stages.json': {
    get: {
      description: 'Fetches multiple person stage records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: 'IDs of person stages to fetch.';
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/PersonStage';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List person stages';
      tags: ['Person Stages'];
    };
    post: {
      description: 'Creates a person stage.\n';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                name: {
                  description: 'The name of the new stage';
                  type: 'string';
                };
              };
              required: ['name'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/PersonStage';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create a person stage';
      tags: ['Person Stages'];
    };
  };
  '/v2/person_stages/{id}.json': {
    delete: {
      description: 'Deletes a person stage. This operation is not reversible without contacting support.\nThis operation can be called multiple times successfully.\n';
      parameters: [
        {
          description: 'Stage ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '204': {
          description: 'The Person Stage has been deleted successfully';
        };
      };
      summary: 'Delete an person stage';
      tags: ['Person Stages'];
    };
    get: {
      description: 'Fetches a person stage, by ID only.\n';
      parameters: [
        {
          description: 'Stage ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/PersonStage';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a person stage';
      tags: ['Person Stages'];
    };
    put: {
      description: 'Updates a person stage.\n';
      parameters: [
        {
          description: 'Stage ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                name: {
                  description: 'The name of the stage.';
                  type: 'string';
                };
              };
              required: ['name'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/PersonStage';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Update a person stage';
      tags: ['Person Stages'];
    };
  };
  '/v2/person_upserts.json': {
    post: {
      description: 'Upserts a person record. The upsert_key dictates how the upsert will be performed. The create and update behavior\nis exactly the same as the individual create and update endpoints.\n';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                account_id: {
                  description: 'ID of the Account to link this person to';
                  type: 'integer';
                };
                city: {
                  description: 'City';
                  type: 'string';
                };
                contact_restrictions: {
                  description: 'Specific methods of communication to prevent for this person. This will prevent individual execution of these communication types as well as automatically skip cadence steps of this communication type for this person in SalesLoft. Values currently accepted: call, email, message';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
                country: {
                  description: 'Country';
                  type: 'string';
                };
                crm_id: {
                  description: 'Requires Salesforce.\n\nID of the person in your external CRM. You must provide a crm_id_type if this is included.\n\nValidations will be applied to the crm_id depending on the crm_id_type. A "salesforce" ID must be exactly 18 characters. A "salesforce" ID must be either a Lead (00Q) or Contact (003) object. The type will be validated using the 18 character ID.\n\nThis field can only be used if your application or API key has the "person:set_crm_id" scope.\n\n';
                  type: 'string';
                };
                crm_id_type: {
                  description: 'The CRM that the provided crm_id is for. Must be one of: salesforce';
                  type: 'string';
                };
                custom_fields: {
                  description: "Custom fields are defined by the user's team. Only fields with values are presented in the API.";
                  type: 'object';
                };
                do_not_contact: {
                  description: 'Whether or not this person has opted out of all communication. Setting this value to true prevents this person from being called, emailed, or added to a cadence in SalesLoft. If this person is currently in a cadence, they will be removed.';
                  type: 'boolean';
                };
                email_address: {
                  description: 'Email address';
                  type: 'string';
                };
                first_name: {
                  description: 'First name';
                  type: 'string';
                };
                home_phone: {
                  description: 'Home phone without formatting';
                  type: 'string';
                };
                id: {
                  description: "ID of the person to update. Used if the upsert_key=id. When id and another upsert_key are provided,\nthe request will fail if the upsert record id and id parameter don't match.\n";
                  type: 'integer';
                };
                import_id: {
                  description: 'ID of the Import this person is a part of. A person can be part of multiple imports, but this ID will always be the most recent Import';
                  type: 'integer';
                };
                job_seniority: {
                  description: 'The Job Seniority of a Person, must be one of director, executive, individual_contributor, manager, vice_president, unknown';
                  type: 'string';
                };
                last_name: {
                  description: 'Last name';
                  type: 'string';
                };
                linkedin_url: {
                  description: 'Linkedin URL';
                  type: 'string';
                };
                locale: {
                  description: 'Time locale of the person';
                  type: 'string';
                };
                mobile_phone: {
                  description: 'Mobile phone without formatting';
                  type: 'string';
                };
                owner_id: {
                  description: 'ID of the User that owns this person';
                  type: 'integer';
                };
                person_company_industry: {
                  description: 'Company industry. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended';
                  type: 'string';
                };
                person_company_name: {
                  description: 'Company name. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended';
                  type: 'string';
                };
                person_company_website: {
                  description: 'Company website. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended';
                  type: 'string';
                };
                person_stage_id: {
                  description: 'ID of the PersonStage of this person';
                  type: 'integer';
                };
                personal_email_address: {
                  description: 'Personal email address';
                  type: 'string';
                };
                personal_website: {
                  description: 'The website of this person';
                  type: 'string';
                };
                phone: {
                  description: 'Phone without formatting';
                  type: 'string';
                };
                phone_extension: {
                  description: 'Phone extension without formatting';
                  type: 'string';
                };
                secondary_email_address: {
                  description: 'Alternate email address';
                  type: 'string';
                };
                state: {
                  description: 'State';
                  type: 'string';
                };
                tags: {
                  description: 'All tags applied to this person';
                  items: {
                    type: 'string';
                  };
                  type: 'array';
                };
                title: {
                  description: 'Job title';
                  type: 'string';
                };
                twitter_handle: {
                  description: 'The twitter handle of this person';
                  type: 'string';
                };
                upsert_key: {
                  description: 'Name of the parameter to upsert on. The field must be provided in the input parameters, or the request will fail.\nThe request will also fail if there are multiple records matched by the upsert field. This can occur if intentional duplicates\nby email address is enabled.\n\nIf upsert_key is not provided, this endpoint will not update an existing record.\n\nValid options are: id, crm_id, email_address. If crm_id is provided, then a valid crm_id_type must be provided, as documented\nfor the person create and update endpoints.\n';
                  type: 'string';
                };
                work_city: {
                  description: 'Work location - city';
                  type: 'string';
                };
                work_country: {
                  description: 'Work location - country';
                  type: 'string';
                };
                work_state: {
                  description: 'Work location - state';
                  type: 'string';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/PersonUpsert';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Upsert a person';
      tags: ['Person Upsert'];
    };
  };
  '/v2/phone_number_assignments.json': {
    get: {
      description: 'Fetches multiple phone number assignment records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: 'IDs of phone number assignments to fetch';
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/PhoneNumberAssignment';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List phone number assignments';
      tags: ['Phone Number Assignments'];
    };
  };
  '/v2/phone_number_assignments/{id}.json': {
    get: {
      description: 'Fetches a phone number assignment, by ID only.\n';
      parameters: [
        {
          description: 'PhoneNumberAssignment ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/PhoneNumberAssignment';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a phone number assignment';
      tags: ['Phone Number Assignments'];
    };
  };
  '/v2/phone_numbers/caller_ids.json': {
    get: {
      description: 'Each entry is a possible caller ID match for the number. Multiple\nentries may be returned if the phone number is present on more than one\nperson in the system.  Phone number should be in E.164 format.\n';
      parameters: [
        {
          description: 'E.164 Phone Number';
          in: 'query';
          name: 'phone_number';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CallerId';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List caller ids';
      tags: ['Caller IDs'];
    };
  };
  '/v2/phone_numbers/recording_settings/{id}.json': {
    get: {
      description: 'Fetches the recording status for a given phone number, based on Do Not Record and Recording Governance for your team.\nPhone number should be in E.164 format.\n';
      parameters: [
        {
          description: 'E.164 Phone Number';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/RecordingSetting';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch recording setting';
      tags: ['Recording Settings'];
    };
  };
  '/v2/saved_list_views.json': {
    get: {
      description: 'Fetches multiple saved list view records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: "IDs of saved list views to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Type of saved list views to fetch.';
          in: 'query';
          name: 'view';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Key to sort on, must be one of: name. Defaults to name';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/SavedListView';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List saved list views';
      tags: ['Saved List Views'];
    };
    post: {
      description: 'Creates a saved list view.\n';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                is_default: {
                  description: 'Whether the saved list view is the default';
                  type: 'boolean';
                };
                name: {
                  description: 'The name of the saved list view';
                  type: 'string';
                };
                view: {
                  description: 'The type of objects in the saved list view.  Value must be one of: people, companies, or recordings';
                  type: 'string';
                };
                view_params: {
                  description: 'JSON object of list view parameters';
                  type: 'string';
                };
              };
              required: ['name', 'view'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/SavedListView';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create a saved list view';
      tags: ['Saved List Views'];
    };
  };
  '/v2/saved_list_views/{id}.json': {
    delete: {
      description: 'Deletes a saved list view. This operation is not reversible without contacting support.\nThis operation can be called multiple times successfully.\n';
      parameters: [
        {
          description: 'Saved List View ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '204': {
          description: 'The saved list view has been deleted successfully';
        };
      };
      summary: 'Delete a saved list view';
      tags: ['Saved List Views'];
    };
    get: {
      description: 'Fetches a saved list view, by ID only.\n';
      parameters: [
        {
          description: 'Saved List View ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/SavedListView';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a saved list view';
      tags: ['Saved List Views'];
    };
    put: {
      description: 'Updates a saved list view.\n';
      parameters: [
        {
          description: 'Saved List View ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                is_default: {
                  description: 'Whether the saved list view is the default';
                  type: 'boolean';
                };
                name: {
                  description: 'The name of the saved list view';
                  type: 'string';
                };
                view_params: {
                  description: 'JSON object of list view parameters';
                  type: 'string';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/SavedListView';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Update a saved list view';
      tags: ['Saved List Views'];
    };
  };
  '/v2/steps.json': {
    get: {
      description: 'Fetches multiple step records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: 'IDs of steps to fetch.';
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filter by cadence ID';
          in: 'query';
          name: 'cadence_id';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Filter by step type';
          in: 'query';
          name: 'type';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Filter by whether a step has due actions';
          in: 'query';
          name: 'has_due_actions';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Step';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List steps';
      tags: ['Steps'];
    };
  };
  '/v2/steps/{id}.json': {
    get: {
      description: 'Fetches a step, by ID only.\n';
      parameters: [
        {
          description: 'Step ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Step';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a step';
      tags: ['Steps'];
    };
  };
  '/v2/successes.json': {
    get: {
      description: 'Fetches multiple success records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: "IDs of successes to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters successes by person_id. Multiple person ids can be applied';
          explode: false;
          in: 'query';
          name: 'person_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'updated_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at, succeeded_at. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Success';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List successes';
      tags: ['Successes'];
    };
  };
  '/v2/tags.json': {
    get: {
      description: 'Fetches a list of the tags used for a team. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n\nTags can be applied to mulitple resource types.\n';
      parameters: [
        {
          description: 'Filters tags by name';
          in: 'query';
          name: 'search';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Filters tags by their IDs';
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: name. Defaults to name';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Tag';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List team tags';
      tags: ['Tags'];
    };
  };
  '/v2/tasks.json': {
    get: {
      description: 'Fetches multiple task records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n';
      parameters: [
        {
          description: 'IDs of tasks to fetch.';
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters tasks by the user to which they are assigned.';
          explode: false;
          in: 'query';
          name: 'user_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters tasks by the person to which they are associated.';
          explode: false;
          in: 'query';
          name: 'person_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters tasks by the account to which they are associated.';
          explode: false;
          in: 'query';
          name: 'account_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: "Filters tasks by their current state. Valid current_states include: ['scheduled', 'completed'].";
          explode: false;
          in: 'query';
          name: 'current_state';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: "Filters tasks by their task type. Valid task_types include: ['call', 'email', 'general'].";
          explode: false;
          in: 'query';
          name: 'task_type';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: "Filters tasks by time interval. Valid time_intervals include: ['overdue', 'today', 'tomorrow', 'this_week', 'next_week'].";
          in: 'query';
          name: 'time_interval_filter';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Filters tasks by idempotency key.';
          in: 'query';
          name: 'idempotency_key';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Filters tasks by locale of the person to which they are associated.';
          explode: false;
          in: 'query';
          name: 'locale';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: due_date, due_at. Defaults to due_date';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to ASC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Task';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List tasks';
      tags: ['Tasks'];
    };
    post: {
      description: 'Creates a task.\n';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                current_state: {
                  description: 'Current state of the task, valid options are: scheduled';
                  type: 'string';
                };
                description: {
                  description: 'A description of the task recorded for person at completion time';
                  type: 'string';
                };
                due_date: {
                  description: 'Date of when the Task is due, ISO-8601 date format required';
                  type: 'string';
                };
                idempotency_key: {
                  description: 'Establishes a unique identifier to prevent duplicates from being created';
                  type: 'string';
                };
                person_id: {
                  description: 'ID of the person to be contacted';
                  type: 'string';
                };
                remind_at: {
                  description: 'Datetime of when the user will be reminded of the task, ISO-8601 datetime format required';
                  type: 'string';
                };
                subject: {
                  description: 'Subject line of the task.';
                  type: 'string';
                };
                task_type: {
                  description: 'Task type, valid options are: call, email, general';
                  type: 'string';
                };
                user_id: {
                  description: 'ID of the user linked to the task';
                  type: 'integer';
                };
              };
              required: ['subject', 'person_id', 'user_id', 'task_type', 'due_date', 'current_state'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Task';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create a Task';
      tags: ['Tasks'];
    };
  };
  '/v2/tasks/{id}.json': {
    get: {
      description: 'Fetches a task, by ID only.\n';
      parameters: [
        {
          description: 'Task ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Step';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a task';
      tags: ['Tasks'];
    };
    put: {
      description: 'Updates a task.\n';
      parameters: [
        {
          description: 'Task ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                current_state: {
                  description: 'Current state of the task, valid options are: completed';
                  type: 'string';
                };
                description: {
                  description: 'A description of the task recorded for person at completion time';
                  type: 'string';
                };
                due_date: {
                  description: 'Date of when the Task is due, ISO-8601 date format required';
                  type: 'string';
                };
                is_logged: {
                  description: 'A flag to indicate that the task should only be logged';
                  type: 'boolean';
                };
                remind_at: {
                  description: 'Datetime of when the user will be reminded of the task, ISO-8601 datetime format required';
                  type: 'string';
                };
                subject: {
                  description: 'Subject line of the task';
                  type: 'string';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Task';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Update a Task';
      tags: ['Tasks'];
    };
  };
  '/v2/team.json': {
    get: {
      description: 'Fetches the team of the authenticated user.\n';
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Team';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch current team';
      tags: ['Team'];
    };
  };
  '/v2/team_template_attachments.json': {
    get: {
      description: 'Fetches multiple team template attachment records. The records can be filtered and paged according to\nthe respective parameters.\n';
      parameters: [
        {
          description: "IDs of team template attachments to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters template attachments by team template IDs';
          explode: false;
          in: 'query';
          name: 'team_template_id';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/TeamTemplateAttachment';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List team template attachments';
      tags: ['Team Template Attachments'];
    };
  };
  '/v2/team_templates.json': {
    get: {
      description: 'Fetches multiple team template records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n\nTeam templates are templates that are available team-wide. Admins may use\nteam templates to create original content for the entire team, monitor version control to ensure templates are always up to date,\nand track template performance across the entire organization. All metrics on a team template reflect usage across the team; individual metrics can be found with the email_templates API endpoint.\n';
      parameters: [
        {
          description: "IDs of team templates to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n';
          explode: false;
          in: 'query';
          name: 'updated_at';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters email templates by title or subject';
          in: 'query';
          name: 'search';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Filters email templates by tags applied to the template by tag ID, not to exceed 100 IDs';
          explode: false;
          in: 'query';
          name: 'tag_ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters team templates by tags applied to the template, not to exceed 100 tags';
          explode: false;
          in: 'query';
          name: 'tag';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters email templates to include archived templates or not';
          in: 'query';
          name: 'include_archived_templates';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at, last_used_at. Defaults to updated_at';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch results from. Defaults to 1';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data';
          in: 'query';
          name: 'limit_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/TeamTemplate';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List team templates';
      tags: ['Team Templates'];
    };
  };
  '/v2/team_templates/{id}.json': {
    get: {
      description: 'Fetches a team template, by ID only.\n';
      parameters: [
        {
          description: 'Team Template ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: "Optionally will return the templates with the current user's email signature";
          in: 'query';
          name: 'include_signature';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/TeamTemplate';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a team template';
      tags: ['Team Templates'];
    };
  };
  '/v2/third_party_live_feed_items': {
    post: {
      description: 'Creates a live feed item that can be sent to users. May only be used by whitelisted Frontend Integrations. Reference the Salesloft App Directory and Frontend Integrations sections for additional details.';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                event_occurred_at: {
                  description: 'Equality filters that are applied to the event_occurred_at field. A single filter can be used by itself or combined with other filters to create a range.\n---CUSTOM---\n{"keys":[{"description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"gt","type":"iso8601 string"},{"description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"gte","type":"iso8601 string"},{"description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"lt","type":"iso8601 string"},{"description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"lte","type":"iso8601 string"}],"type":"object"}\n';
                  type: 'string';
                };
                idempotency_key: {
                  description: "Uniquely provided string specific to this event. This should be a value which can't be duplicated between external systems, meaning that an id is not sufficient.";
                  type: 'string';
                };
                message: {
                  description: 'The message that relates to the subject. This message should start with a lower-case past-tense verb and end with a period (e.g. "received a package."). When live feed items are displayed to users, the subject\'s name is concatenated with the message and a joining space. Only <a> HTML tags with an "href" attribute are allowed. Other attributes and tags will be stripped.';
                  type: 'string';
                };
                subject_id: {
                  description: 'The ID of the subject of the live feed item (i.e. the "person" id).';
                  type: 'integer';
                };
                subject_type: {
                  description: 'The type of the subject of the live feed item. Currently only "person" is supported.';
                  type: 'string';
                };
                user_guid: {
                  description: 'The guid for the user that this live feed item should be shown to.';
                  type: 'string';
                };
              };
              required: ['subject_type', 'subject_id', 'event_occurred_at', 'user_guid', 'message', 'idempotency_key'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/LiveFeedItem';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create a live feed item';
      tags: ['Live Feed Items'];
    };
  };
  '/v2/users.json': {
    get: {
      description: 'Non Admin: Lists only your user, or all on team depending on group visibility policy\nTeam Admin: Lists users associated with your team\n';
      parameters: [
        {
          description: "IDs of users to fetch. If a record can't be found, that record won't be returned and your request will be successful";
          explode: false;
          in: 'query';
          name: 'ids';
          required: false;
          schema: {
            items: {
              type: 'integer';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters list to only include guids';
          explode: false;
          in: 'query';
          name: 'guid';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters users by group_id.  An additional value of "_is_null" can be passed to filter users that are not in a group';
          explode: false;
          in: 'query';
          name: 'group_id';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Filters users by role_id';
          explode: false;
          in: 'query';
          name: 'role_id';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Space-separated list of keywords used to find case-insensitive substring matches against First Name, Last Name, or Email';
          in: 'query';
          name: 'search';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Filters users based on active attribute. Defaults to not applied';
          in: 'query';
          name: 'active';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: "Defaults to true.\n\nWhen true, only shows users that are actionable based on the team's privacy settings.\nWhen false, shows all users on the team, even if you can't take action on that user. Deactivated users are also included when false.\n";
          in: 'query';
          name: 'visible_only';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'How many users to show per page in the range [1, 100]. Defaults to 25.  Results are only paginated if the page parameter is defined';
          in: 'query';
          name: 'per_page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'The current page to fetch users from. Defaults to returning all users';
          in: 'query';
          name: 'page';
          required: false;
          schema: {
            type: 'integer';
          };
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false';
          in: 'query';
          name: 'include_paging_counts';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Filters users based on if they have a crm user mapped or not.';
          in: 'query';
          name: 'has_crm_user';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Filters users based on assigned work_country.';
          explode: false;
          in: 'query';
          name: 'work_country';
          required: false;
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Key to sort on, must be one of: id, email, name, group, role. Defaults to id';
          in: 'query';
          name: 'sort_by';
          required: false;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC';
          in: 'query';
          name: 'sort_direction';
          required: false;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/User';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List users';
      tags: ['Users'];
    };
  };
  '/v2/users/{id}.json': {
    get: {
      description: 'Fetches a user, by ID only.\n';
      parameters: [
        {
          description: 'User ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/User';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a user';
      tags: ['Users'];
    };
    put: {
      description: 'Updates a user.\n';
      parameters: [
        {
          description: 'User ID';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                active: {
                  description: "Active status of the user's account";
                  type: 'boolean';
                };
                group_id: {
                  description: 'Group assigned to the user';
                  type: 'integer';
                };
                role_id: {
                  description: 'Role assigned to the user. Must be one of: Admin, User, or a custom role ID';
                  type: 'string';
                };
                work_country: {
                  description: "The user's work country (alpha-2 code)";
                  type: 'string';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/User';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Update a user';
      tags: ['Users'];
    };
  };
  '/v2/webhook_subscriptions': {
    get: {
      description: "Fetches all of the customer's webhook subscriptions for your application.";
      parameters: [
        {
          description: 'Filters webhook subscriptions by whether is enabled or not.';
          in: 'query';
          name: 'enabled';
          required: false;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Subscription';
                };
                type: 'array';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'List webhook subscriptions';
      tags: ['Webhook Subscriptions'];
    };
    post: {
      description: 'Creates a webhook subscription. Visit the <a href="/webhooks.html" target="_blank" rel="noopener noreferrer">webhooks page</a> for additional details and a list of available webhooks.\nRequest must be made with a valid Oauth token or API key.';
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                callback_token: {
                  description: 'Any string to be used as a shared secret when subscription events are published. SalesLoft will send the value of this callback_token in the payload of each event so the receiver may verify it matches the original value. This ensures webhook events are being delivered by SalesLoft.';
                  type: 'string';
                };
                callback_url: {
                  description: 'URL for your callback handler';
                  type: 'string';
                };
                event_type: {
                  description: 'Type of event the subscription is for. Visit the "Event Types" section of the webhooks page to find a list of supported event types.';
                  type: 'string';
                };
              };
              required: ['callback_url', 'callback_token', 'event_type'];
              type: 'object';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Subscription';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Create a webhook subscription';
      tags: ['Webhook Subscriptions'];
    };
  };
  '/v2/webhook_subscriptions/{id}': {
    delete: {
      description: 'Deletes a webhook subscription. This operation is not reversible without contacting support. This operation can be called multiple times successfully.';
      parameters: [
        {
          description: 'The id of the Webhook Subscription to delete';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'integer';
          };
        },
      ];
      responses: {
        '204': {
          description: 'This webhook subscription has been deleted successfully';
        };
      };
      summary: 'Delete a webhook subscription';
      tags: ['Webhook Subscriptions'];
    };
    get: {
      description: 'Fetches a webhook subscription, by ID only.';
      parameters: [
        {
          description: 'The id for the Webhook Subscription';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'integer';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Subscription';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Fetch a webhook subscription';
      tags: ['Webhook Subscriptions'];
    };
    put: {
      description: 'Updates a webhook subscription.\nRequest must be made with a valid Oauth token or API key.';
      parameters: [
        {
          description: 'The Webhook Suscription id to update';
          in: 'path';
          name: 'id';
          required: true;
          schema: {
            type: 'integer';
          };
        },
      ];
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                enabled: {
                  description: 'Enable or disable the webhook subscription';
                  type: 'boolean';
                };
              };
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Subscription';
              };
            };
          };
          description: 'Success';
        };
      };
      summary: 'Update a webhook subscription';
      tags: ['Webhook Subscriptions'];
    };
  };
};
export const paths = {
  '/v2/account_stages.json': {
    get: {
      description:
        'Fetches multiple account stage records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description:
            "IDs of account stages to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'updated_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at, order. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/AccountStage',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List account stages',
      tags: ['Account Stages'],
    },
  },
  '/v2/account_stages/{id}.json': {
    get: {
      description: 'Fetches an account stage, by ID only.\n',
      parameters: [
        {
          description: 'Account Stage ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/AccountStage',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch an account stage',
      tags: ['Account Stages'],
    },
  },
  '/v2/account_tiers.json': {
    get: {
      description:
        'Fetches multiple account tier records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description:
            "IDs of Account Tiers to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters Account Tiers by name. Multiple names can be applied',
          explode: false,
          in: 'query',
          name: 'name',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at, order. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/AccountTier',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List Account Tiers',
      tags: ['Account Tiers'],
    },
  },
  '/v2/account_tiers/{id}.json': {
    get: {
      description: 'Fetches an account tier, by ID only.\n',
      parameters: [
        {
          description: 'Account Tier ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/AccountTier',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch an account tier',
      tags: ['Account Tiers'],
    },
  },
  '/v2/account_upserts.json': {
    post: {
      description:
        'Upserts an account record. The upsert_key dictates how the upsert will be performed. The create and update behavior\nis exactly the same as the individual create and update endpoints.\n',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                account_tier_id: {
                  description: 'ID of the Account Tier for this Account',
                  type: 'integer',
                },
                city: {
                  description: 'City',
                  type: 'string',
                },
                company_stage_id: {
                  description: 'ID of the CompanyStage assigned to this Account',
                  type: 'integer',
                },
                company_type: {
                  description: "Type of the Account's company",
                  type: 'string',
                },
                conversational_name: {
                  description: 'Conversational name of the Account',
                  type: 'string',
                },
                country: {
                  description: 'Country',
                  type: 'string',
                },
                crm_id: {
                  description:
                    'Requires Salesforce.\n\nID of the person in your external CRM. You must provide a crm_id_type if this is included.\n\nValidations will be applied to the crm_id depending on the crm_id_type. A "salesforce" ID must be exactly 18 characters. A "salesforce" ID must be either an Account (001) object. The type will be validated using the 18 character ID.\n\nThis field can only be used if your application or API key has the "account:set_crm_id" scope.\n\n',
                  type: 'string',
                },
                crm_id_type: {
                  description: 'The CRM that the provided crm_id is for. Must be one of: salesforce',
                  type: 'string',
                },
                custom_fields: {
                  description:
                    "Custom fields are defined by the user's team. Only fields with values are presented in the API.",
                  items: {
                    type: 'object',
                  },
                  type: 'array',
                },
                description: {
                  description: 'Description',
                  type: 'string',
                },
                do_not_contact: {
                  description:
                    'Whether this company can not be contacted. Values are either true or false. Setting this to true will remove all associated people from all active communications',
                  type: 'boolean',
                },
                domain: {
                  description: 'Website domain, not a fully qualified URI',
                  type: 'string',
                },
                founded: {
                  description: 'Date or year of founding',
                  type: 'string',
                },
                id: {
                  description:
                    "ID of the account to update. Used if the upsert_key=id. When id and another upsert_key are provided,\nthe request will fail if the upsert record id and id parameter don't match.\n",
                  type: 'integer',
                },
                industry: {
                  description: 'Industry',
                  type: 'string',
                },
                linkedin_url: {
                  description: 'Full LinkedIn url',
                  type: 'string',
                },
                locale: {
                  description: 'Time locale',
                  type: 'string',
                },
                name: {
                  description: 'Account Full Name',
                  type: 'string',
                },
                owner_id: {
                  description: 'ID of the User that owns this Account',
                  type: 'integer',
                },
                phone: {
                  description: 'Phone number without formatting',
                  type: 'string',
                },
                postal_code: {
                  description: 'Postal code',
                  type: 'string',
                },
                revenue_range: {
                  description: 'Estimated revenue range',
                  type: 'string',
                },
                size: {
                  description: 'Estimated number of people in employment',
                  type: 'string',
                },
                state: {
                  description: 'State',
                  type: 'string',
                },
                street: {
                  description: 'Street name and number',
                  type: 'string',
                },
                tags: {
                  description: 'All tags applied to this Account',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
                twitter_handle: {
                  description: 'Twitter handle, with @',
                  type: 'string',
                },
                upsert_key: {
                  description:
                    'Name of the parameter to upsert on. The field must be provided in the input parameters, or the request will fail.\nThe request will also fail if there are multiple records matched by the upsert field.\n\nIf upsert_key is not provided, this endpoint will not update an existing record.\n\nValid options are: id, crm_id, domain. If crm_id is provided, then a valid crm_id_type must be provided, as documented\nfor the account create and update endpoints.\n',
                  type: 'string',
                },
                website: {
                  description: 'Website',
                  type: 'string',
                },
              },
              required: ['name', 'domain'],
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/AccountUpsert',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Upsert an account',
      tags: ['Account Upsert'],
    },
  },
  '/v2/accounts.json': {
    get: {
      description:
        'Fetches multiple account records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description:
            "IDs of accounts to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters accounts by crm_id. Multiple crm ids can be applied',
          explode: false,
          in: 'query',
          name: 'crm_id',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters accounts by the tags applied to the account. Multiple tags can be applied',
          explode: false,
          in: 'query',
          name: 'tag',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: "Filters accounts by the tag id's applied to the account. Multiple tag id's can be applied",
          explode: false,
          in: 'query',
          name: 'tag_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the created_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'created_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'updated_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Domain of the accounts to fetch. Domains are unique and lowercase',
          in: 'query',
          name: 'domain',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Filters accounts by website. Multiple websites can be applied. An additional value of "_is_null" can be passed to filter accounts that do not have a website.',
          explode: false,
          in: 'query',
          name: 'website',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Filters accounts by archived_at status. Returns only accounts where archived_at is not null if this field is true. Returns only accounts where archived_at is null if this field is false. Do not pass this parameter to return both archived and unarchived accounts. This filter is not applied if any value other than "true" or "false" is passed.',
          in: 'query',
          name: 'archived',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Names of accounts to fetch. Name matches are exact and case sensitive. Multiple names can be fetched.',
          explode: false,
          in: 'query',
          name: 'name',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Filters accounts by account_stage_id. Multiple account_stage_ids can be applied. An additional value of "_is_null" can be passed to filter accounts that do not have account_stage_id',
          explode: false,
          in: 'query',
          name: 'account_stage_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters accounts by account_tier_id. Multiple account tier ids can be applied',
          explode: false,
          in: 'query',
          name: 'account_tier_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Filters accounts by owner_id. Multiple owner_ids can be applied. An additional value of "_is_null" can be passed to filter accounts that are unowned',
          explode: false,
          in: 'query',
          name: 'owner_id',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters accounts by whether the owner is active or not.',
          in: 'query',
          name: 'owner_is_active',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Equality filters that are applied to the last_contacted field. A single filter can be used by itself or combined with other filters to create a range.\nAdditional values of "_is_null" or "_is_not_null" can be passed to filter records that either have no timestamp value or any timestamp value.\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          in: 'query',
          name: 'last_contacted',
          required: false,
          schema: {
            type: 'object',
          },
        },
        {
          description:
            'Filters by accounts matching all given custom fields. The custom field names are case-sensitive, but the provided values are case-insensitive. Example: v2/accounts?custom_fields[custom_field_name]=custom_field_value',
          in: 'query',
          name: 'custom_fields',
          required: false,
          schema: {
            type: 'object',
          },
        },
        {
          description: 'Filters accounts by industry by exact match. Supports partial matching',
          explode: false,
          in: 'query',
          name: 'industry',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters accounts by country by exact match. Supports partial matching',
          explode: false,
          in: 'query',
          name: 'country',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters accounts by state by exact match. Supports partial matching',
          explode: false,
          in: 'query',
          name: 'state',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters accounts by city by exact match. Supports partial matching',
          explode: false,
          in: 'query',
          name: 'city',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Filters accounts by owner_crm_id. Multiple owner_crm_ids can be applied. An additional value of "_is_null" can be passed to filter accounts that are unowned. A "_not_in" modifier can be used to exclude specific owner_crm_ids. Example: v2/accounts?owner_crm_id[_not_in]=id',
          explode: false,
          in: 'query',
          name: 'owner_crm_id',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters accounts by locale. Multiple locales are allowed',
          explode: false,
          in: 'query',
          name: 'locales',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Filters by accounts matching all given user relationship fields, _is_null or _unmapped can be passed to filter accounts with null or unmapped user relationship values. Example: v2/accounts?user_relationships[name]=value',
          in: 'query',
          name: 'user_relationships',
          required: false,
          schema: {
            type: 'object',
          },
        },
        {
          description:
            'Key to sort on, must be one of: created_at, updated_at, last_contacted_at, account_stage, account_stage_name, account_tier, account_tier_name, name, counts_people. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Account',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List accounts',
      tags: ['Accounts'],
    },
    post: {
      description: 'Creates an account.\n\n"domain" must be unique on the current team.\n',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                account_tier_id: {
                  description: 'ID of the Account Tier for this Account',
                  type: 'integer',
                },
                city: {
                  description: 'City',
                  type: 'string',
                },
                company_stage_id: {
                  description: 'ID of the CompanyStage assigned to this Account',
                  type: 'integer',
                },
                company_type: {
                  description: "Type of the Account's company",
                  type: 'string',
                },
                conversational_name: {
                  description: 'Conversational name of the Account',
                  type: 'string',
                },
                country: {
                  description: 'Country',
                  type: 'string',
                },
                crm_id: {
                  description:
                    'Requires Salesforce.\n\nID of the person in your external CRM. You must provide a crm_id_type if this is included.\n\nValidations will be applied to the crm_id depending on the crm_id_type. A "salesforce" ID must be exactly 18 characters. A "salesforce" ID must be either an Account (001) object. The type will be validated using the 18 character ID.\n\nThis field can only be used if your application or API key has the "account:set_crm_id" scope.\n\n',
                  type: 'string',
                },
                crm_id_type: {
                  description: 'The CRM that the provided crm_id is for. Must be one of: salesforce',
                  type: 'string',
                },
                custom_fields: {
                  description:
                    "Custom fields are defined by the user's team. Only fields with values are presented in the API.",
                  items: {
                    type: 'object',
                  },
                  type: 'array',
                },
                description: {
                  description: 'Description',
                  type: 'string',
                },
                do_not_contact: {
                  description:
                    'Whether this company can not be contacted. Values are either true or false. Setting this to true will remove all associated people from all active communications',
                  type: 'boolean',
                },
                domain: {
                  description: 'Website domain, not a fully qualified URI',
                  type: 'string',
                },
                founded: {
                  description: 'Date or year of founding',
                  type: 'string',
                },
                industry: {
                  description: 'Industry',
                  type: 'string',
                },
                linkedin_url: {
                  description: 'Full LinkedIn url',
                  type: 'string',
                },
                locale: {
                  description: 'Time locale',
                  type: 'string',
                },
                name: {
                  description: 'Account Full Name',
                  type: 'string',
                },
                owner_id: {
                  description: 'ID of the User that owns this Account',
                  type: 'integer',
                },
                phone: {
                  description: 'Phone number without formatting',
                  type: 'string',
                },
                postal_code: {
                  description: 'Postal code',
                  type: 'string',
                },
                revenue_range: {
                  description: 'Estimated revenue range',
                  type: 'string',
                },
                size: {
                  description: 'Estimated number of people in employment',
                  type: 'string',
                },
                state: {
                  description: 'State',
                  type: 'string',
                },
                street: {
                  description: 'Street name and number',
                  type: 'string',
                },
                tags: {
                  description: 'All tags applied to this Account',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
                twitter_handle: {
                  description: 'Twitter handle, with @',
                  type: 'string',
                },
                website: {
                  description: 'Website',
                  type: 'string',
                },
              },
              required: ['name', 'domain'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Account',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create an account',
      tags: ['Accounts'],
    },
  },
  '/v2/accounts/{id}.json': {
    delete: {
      description:
        'Deletes an account. This operation is not reversible without contacting support.\nThis operation can be called multiple times successfully.\n\nDeleting an account will remove all connected people from that account.\n',
      parameters: [
        {
          description: 'Account ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '204': {
          description: 'The Account has been deleted successfully',
        },
      },
      summary: 'Delete an account',
      tags: ['Accounts'],
    },
    get: {
      description: 'Fetches an account, by ID only.\n',
      parameters: [
        {
          description: 'Account ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Account',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch an account',
      tags: ['Accounts'],
    },
    put: {
      description: 'Updates an account.\n\n"domain" must be unique on the current team.\n',
      parameters: [
        {
          description: 'Account ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                account_tier_id: {
                  description: 'ID of the Account Tier for this Account',
                  type: 'integer',
                },
                archived: {
                  description:
                    "Whether this Account should be archived or not. Setting this to true sets archived_at to the current time if it's not already set. Setting this to false will set archived_at to null",
                  type: 'boolean',
                },
                city: {
                  description: 'City',
                  type: 'string',
                },
                company_stage_id: {
                  description: 'ID of the CompanyStage assigned to this Account',
                  type: 'integer',
                },
                company_type: {
                  description: "Type of the Account's company",
                  type: 'string',
                },
                conversational_name: {
                  description: 'Conversational name of the Account',
                  type: 'string',
                },
                country: {
                  description: 'Country',
                  type: 'string',
                },
                crm_id: {
                  description:
                    'Requires Salesforce.\n\nID of the person in your external CRM. You must provide a crm_id_type if this is included.\n\nValidations will be applied to the crm_id depending on the crm_id_type. A "salesforce" ID must be exactly 18 characters. A "salesforce" ID must be either an Account (001) object. The type will be validated using the 18 character ID.\n\nThis field can only be used if your application or API key has the "account:set_crm_id" scope.\n\n',
                  type: 'string',
                },
                crm_id_type: {
                  description: 'The CRM that the provided crm_id is for. Must be one of: salesforce',
                  type: 'string',
                },
                custom_fields: {
                  description:
                    "Custom fields are defined by the user's team. Only fields with values are presented in the API.",
                  items: {
                    type: 'object',
                  },
                  type: 'array',
                },
                description: {
                  description: 'Description',
                  type: 'string',
                },
                do_not_contact: {
                  description:
                    'Whether this company can not be contacted. Values are either true or false. Setting this to true will remove all associated people from all active communications',
                  type: 'boolean',
                },
                domain: {
                  description: 'Website domain, not a fully qualified URI',
                  type: 'string',
                },
                founded: {
                  description: 'Date or year of founding',
                  type: 'string',
                },
                industry: {
                  description: 'Industry',
                  type: 'string',
                },
                linkedin_url: {
                  description: 'Full LinkedIn url',
                  type: 'string',
                },
                locale: {
                  description: 'Time locale',
                  type: 'string',
                },
                name: {
                  description: 'Account Full Name',
                  type: 'string',
                },
                owner_id: {
                  description: 'ID of the User that owns this Account',
                  type: 'integer',
                },
                phone: {
                  description: 'Phone number without formatting',
                  type: 'string',
                },
                postal_code: {
                  description: 'Postal code',
                  type: 'string',
                },
                revenue_range: {
                  description: 'Estimated revenue range',
                  type: 'string',
                },
                size: {
                  description: 'Estimated number of people in employment',
                  type: 'string',
                },
                state: {
                  description: 'State',
                  type: 'string',
                },
                street: {
                  description: 'Street name and number',
                  type: 'string',
                },
                tags: {
                  description: 'All tags applied to this Account',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
                twitter_handle: {
                  description: 'Twitter handle, with @',
                  type: 'string',
                },
                website: {
                  description: 'Website',
                  type: 'string',
                },
              },
              required: ['name', 'domain'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Account',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Update an existing Account',
      tags: ['Accounts'],
    },
  },
  '/v2/action_details/call_instructions.json': {
    get: {
      description:
        'Fetches multiple call instruction records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description: 'IDs of call instructions to fetch.',
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CallInstruction',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List call instructions',
      tags: ['Action Details - Call Instructions'],
    },
  },
  '/v2/action_details/call_instructions/{id}.json': {
    get: {
      description: 'Fetches a call instruction, by ID only.\n',
      parameters: [
        {
          description: 'Call instructions ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CallInstruction',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a call instructions',
      tags: ['Action Details - Call Instructions'],
    },
  },
  '/v2/actions.json': {
    get: {
      description:
        'Fetches multiple action records. The records can be filtered, paged, and sorted according to\nthe respective parameters. Only actions that are currently "in_progess" will be returned by\nthis endpoint.\n\nIf the requester is not an admin, this endpoint will only return actions belonging to the requester.\nIf the request is an admin, this endpoint will return actions for the entire team. Additionaly, an admin\nmay use the user_guid parameter to request actions that belong to specific users on the team.\n',
      parameters: [
        {
          description: 'IDs of actions to fetch.',
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Fetch actions by step ID',
          in: 'query',
          name: 'step_id',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Filter actions by type',
          in: 'query',
          name: 'type',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Equality filters that are applied to the due_on field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'due_on',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            "Filters actions by the user's guid. Multiple user guids can be applied. The user must be a team admin to filter other users' actions",
          explode: false,
          in: 'query',
          name: 'user_guid',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters actions by person_id. Multiple person ids can be applied',
          explode: false,
          in: 'query',
          name: 'person_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters actions by cadence_id. Multiple cadence ids can be applied',
          explode: false,
          in: 'query',
          name: 'cadence_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters actions by multitouch_group_id. Multiple multitouch group ids can be applied',
          explode: false,
          in: 'query',
          name: 'multitouch_group_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'updated_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Action',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List actions',
      tags: ['Actions'],
    },
  },
  '/v2/actions/{id}.json': {
    get: {
      description:
        'Fetches an action, by ID only.\nThis endpoint will only return actions that are in_progress or pending_activity.\nOnce an action is complete, the request for that action will return a 404 status code.\n',
      parameters: [
        {
          description: 'Action ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Action',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch an action',
      tags: ['Actions'],
    },
  },
  '/v2/activities.json': {
    post: {
      description:
        'Creates an activity. An activity will mark the associated action as completed. Currently,\nonly certain action types can have an activity explicitly created for them.\n',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                action_id: {
                  description:
                    "Action that is being completed. This will validate that the action is still\nvalid before completed it. The same action can never be successfully passed twice to this endpoint.\nThe action must have a type of 'integration'.\n",
                  type: 'integer',
                },
                task_id: {
                  description:
                    "Task that is being completed. This will validate that the task is still\nvalid before completed it. The same action can never be successfully passed twice to this endpoint.\nThe task must have a type of 'integration'.\n",
                  type: 'integer',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Activity',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create an activity',
      tags: ['Activities'],
    },
  },
  '/v2/activities/calls.json': {
    get: {
      description:
        'Fetches multiple call records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description:
            "IDs of calls to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the created_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'created_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'updated_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters list to only include guids',
          explode: false,
          in: 'query',
          name: 'user_guid',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters calls by person_id. Multiple person ids can be applied',
          explode: false,
          in: 'query',
          name: 'person_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Filters calls by sentiment. Sentiment matches are exact and case sensitive. Multiple sentiments are allowed.',
          explode: false,
          in: 'query',
          name: 'sentiment',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Filters calls by disposition. Disposition matches are exact and case sensitive. Multiple dispositions are allowed.',
          explode: false,
          in: 'query',
          name: 'disposition',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Call',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List calls',
      tags: ['Calls'],
    },
    post: {
      description:
        'Creates a call. The parameters of this endpoint can be used to create an action\nand ensure that the CRM Task is mapped correctly.\n',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                action_id: {
                  description:
                    "Action that this call is being logged for. This will validate that the action is still\nvalid before completing it. The same action can never be successfully passed twice to this endpoint. The\naction must have a type of 'phone'.\n",
                  type: 'integer',
                },
                crm_params: {
                  description:
                    'CRM specific parameters. Some parameters are required on a per-team basis. Consume the\nCrmActivityFields endpoint to receive a list of valid parameters. The "field" property\nis passed as the key of this object, and the value of this object is the value that you\nwould like to set.\n\nIf CrmActivityField has a non-null value, then that value must be submitted, or excluded\nfrom API calls, as these values are automatically applied.\n',
                  type: 'object',
                },
                disposition: {
                  description:
                    'The disposition of the call. Can be required on a per-team basis. Must be present in the disposition list.',
                  type: 'string',
                },
                duration: {
                  description: 'The length of the call, in seconds',
                  type: 'integer',
                },
                linked_call_data_record_ids: {
                  description:
                    'CallDataRecord associations that will become linked to the created call. It is possible to pass\nmultiple CallDataRecord ids in this field; this can be used to represent multiple phone calls\nthat made up a single call.\n\nAny call data record that is used must not already be linked to a call. It is not possible\nto link a call data record to multiple calls, and it is not possible to re-assign a call data\nrecord to a different call.\n',
                  items: {
                    type: 'integer',
                  },
                  type: 'array',
                },
                notes: {
                  description:
                    "Notes to log for the call. This is similar to the notes endpoint, but ensures that the notes get synced to the user's CRM",
                  type: 'string',
                },
                person_id: {
                  description: 'The ID of the person whom this call will be logged for',
                  type: 'integer',
                },
                sentiment: {
                  description:
                    'The sentiment of the call. Can be required on a per-team basis. Must be present in the sentiment list.',
                  type: 'string',
                },
                to: {
                  description: 'The phone number that was called',
                  type: 'string',
                },
                user_guid: {
                  description:
                    "Guid of the user whom this call should be logged for. Defaults to the authenticated user. Only team admins can pass another user's guid",
                  type: 'string',
                },
              },
              required: ['person_id'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Call',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create a call',
      tags: ['Calls'],
    },
  },
  '/v2/activities/calls/{id}.json': {
    get: {
      description: 'Fetches a call, by ID only.\n',
      parameters: [
        {
          description: 'Call ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Call',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a call',
      tags: ['Calls'],
    },
  },
  '/v2/activities/emails.json': {
    get: {
      description:
        'Fetches multiple email records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description:
            "IDs of emails to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'updated_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters emails by whether they have bounced or not',
          in: 'query',
          name: 'bounced',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Filters emails by crm_activity_id. Multiple crm activty ids can be applied',
          explode: false,
          in: 'query',
          name: 'crm_activity_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters emails by action_id. Multiple action ids can be applied',
          explode: false,
          in: 'query',
          name: 'action_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters emails by user_id. Multiple User ids can be applied',
          explode: false,
          in: 'query',
          name: 'user_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Filters emails by status. Multiple status can be applied, possible values are sent, sent_from_gmail, sent_from_external, pending, pending_reply_check, scheduled, sending, delivering, failed, cancelled, pending_through_gmail, pending_through_external',
          explode: false,
          in: 'query',
          name: 'status',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters emails by cadence. Multiple cadence ids can be applied',
          explode: false,
          in: 'query',
          name: 'cadence_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters emails by step. Multiple step ids can be applied',
          explode: false,
          in: 'query',
          name: 'step_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters emails by one-off only',
          in: 'query',
          name: 'one_off',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Specify explicit scoped fields desired on the Email Resource.',
          explode: false,
          in: 'query',
          name: 'scoped_fields',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters emails by person_id. Multiple person ids can be applied',
          explode: false,
          in: 'query',
          name: 'person_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters emails by recipient email address. Multiple emails can be applied.',
          explode: false,
          in: 'query',
          name: 'email_addresses',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters emails by personalization score',
          explode: false,
          in: 'query',
          name: 'personalization',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the sent_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'sent_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: updated_at, send_time. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Email',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List emails',
      tags: ['Emails'],
    },
  },
  '/v2/activities/emails/{id}.json': {
    get: {
      description: 'Fetches an email, by ID only.\n',
      parameters: [
        {
          description: 'Email ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Email',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch an email',
      tags: ['Emails'],
    },
  },
  '/v2/activity_histories': {
    get: {
      description:
        'Fetches all of the customer\'s past activities for your application. Returns all the Activities that are found on the Salesloft Activity Feed. <a href="/activity-history.html" target="_blank" rel="noopener noreferrer">Visit here for more details</a>.',
      parameters: [
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Key to sort on, must be one of: occurred_at, updated_at. Defaults to occurred_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Filter by the type of activity. Must be one of: added_to_cadence, completed_action, call, requested_email, sent_email, received_email, email_reply, note, success, dnc_event, residency_change, meeting, meeting_held, message_conversation, task, voicemail, opportunity_stage_change, opportunity_amount_change, opportunity_close_date_change. Can be provided as an array, or as an object of type[resource_type][]=type',
          in: 'query',
          name: 'type',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'For internal use only. This field does not comply with our backwards compatibility policies. This filter is for authenticated users of Salesloft only and will not work for OAuth Applications. Filter by the {resource_type, resource_id} of activity. Provide this in the format resource[]=person,1234',
          in: 'query',
          name: '_resource',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Equality filters that are applied to the occurred_at field. A single filter can be used by itself or combined with other filters to create a range.\n---CUSTOM---\n{"keys":[{"description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"gt","type":"iso8601 string"},{"description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"gte","type":"iso8601 string"},{"description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"lt","type":"iso8601 string"},{"description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"lte","type":"iso8601 string"}],"type":"object"}\n',
          in: 'query',
          name: 'occurred_at',
          required: false,
          schema: {
            type: 'object',
          },
        },
        {
          description: "Filter by the pinned status of activity. Must be 'true' or 'false'",
          in: 'query',
          name: 'pinned',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Filter by the resource type. A resource is a Salesloft object that the activity is attributed to. A valid resource types must be one of person, account, crm_opportunity. Can be provided as an array',
          in: 'query',
          name: 'resource_type',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Filter by the resource id. "resource_type" filter is required to use this filter.',
          explode: false,
          in: 'query',
          name: 'resource_id',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n---CUSTOM---\n{"keys":[{"description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"gt","type":"iso8601 string"},{"description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"gte","type":"iso8601 string"},{"description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"lt","type":"iso8601 string"},{"description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"lte","type":"iso8601 string"}],"type":"object"}\n',
          in: 'query',
          name: 'updated_at',
          required: false,
          schema: {
            type: 'object',
          },
        },
        {
          description: "Filter activities by a user's guid.",
          in: 'query',
          name: 'user_guid',
          required: false,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/ActivityHistory',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List Past Activities',
      tags: ['Activity Histories'],
    },
  },
  '/v2/bulk_jobs': {
    get: {
      description:
        'Fetches multiple bulk job records. The records can be filtered, paged, and sorted according to the respective parameters.',
      parameters: [
        {
          description:
            'The state of the bulk job. Accepts multiple states. Each state must be one of: open, executing, done',
          explode: false,
          in: 'query',
          name: 'state',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Filter by id using comparison operators. Only supports greater than (gt) comparison (i.e. id[gt]=123)',
          in: 'query',
          name: 'id',
          required: false,
          schema: {
            type: 'object',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/BulkJob',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List bulk jobs',
      tags: ['Bulk Jobs'],
    },
    post: {
      description:
        'Creates a bulk job. The type of the bulk job must be included when created.\n\nFor additional information on creating bulk jobs, the types of supported bulk jobs, and examples of the bulk job flow, visit the <a href="/bulk.html" target="_blank" rel="noopener noreferrer">bulk job details page</a>.\n',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                name: {
                  description: 'Name for your bulk job',
                  type: 'string',
                },
                type: {
                  description:
                    'Type of bulk job. Must be a valid type. Follow link to the bulk job details page above to view supported types.',
                  type: 'string',
                },
              },
              required: ['type'],
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/BulkJob',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create a bulk job',
      tags: ['Bulk Jobs'],
    },
  },
  '/v2/bulk_jobs/{bulk_jobs_id}/job_data': {
    get: {
      description:
        'Fetches multiple job data records for a given bulk job. Pagination is not supported, but cursor based polling is via use of the `id[gt]` filter. Pass the last id seen (i.e. `id[gt]=1234`) in order to get the next batch of records.',
      parameters: [
        {
          description: 'The id for the bulk job to which the job data relates',
          in: 'path',
          name: 'bulk_jobs_id',
          required: true,
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'Filter by result status. Accepts multiple statuses. Each status must be one of pending, success, error, retrying',
          explode: false,
          in: 'query',
          name: 'status',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Filter by id using comparison operators. Only supports greater than (gt) comparison (i.e. id[gt]=123)',
          in: 'query',
          name: 'id',
          required: false,
          schema: {
            type: 'object',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/BulkJobResult',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List job data for a bulk job',
      tags: ['Bulk Jobs - Job Data'],
    },
    post: {
      description:
        'Upload job data for the specified bulk job. Upload an array of objects, where element contains the parameters necessary to execute the individual calls. Each call to this endpoint can handle up to 5,000 records at a time. There is no limit to how many times you can create job data for a given bulk job.\n\nFor additional information on creating bulk jobs, the types of supported bulk jobs, and examples of the bulk job flow, visit the <a href="/bulk.html" target="_blank" rel="noopener noreferrer">bulk job details page</a>.\n',
      parameters: [
        {
          description: 'The id for the bulk job to which the job data relates',
          in: 'path',
          name: 'bulk_jobs_id',
          required: true,
          schema: {
            type: 'integer',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                data: {
                  description:
                    'Array of objects containing parameters to be used to execute an instance of each. Array must be 5,000 records or less.',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
              },
              required: ['data'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/JobDataCreationResult',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create job data for a bulk job',
      tags: ['Bulk Jobs - Job Data'],
    },
  },
  '/v2/bulk_jobs/{bulk_jobs_id}/results': {
    get: {
      description:
        "Fetches multiple job data records for a completed bulk job. Note that until a bulk job's state is set to `done` the returned `data` will be an empty array. Pagination is not supported, but cursor based polling is via use of the `id[gt]` filter. Pass the last id seen (i.e. `id[gt]=1234`) in order to get the next batch of records.",
      parameters: [
        {
          description: 'The id for the Bulk Job',
          in: 'path',
          name: 'bulk_jobs_id',
          required: true,
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'Filter by result status. Accepts multiple statuses. Each status must be one of pending, success, error, retrying',
          explode: false,
          in: 'query',
          name: 'status',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Filter by id using comparison operators. Only supports greater than (gt) comparison (i.e. id[gt]=123)',
          in: 'query',
          name: 'id',
          required: false,
          schema: {
            type: 'object',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/BulkJobResult',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List job data for a completed bulk job.',
      tags: ['Bulk Jobs - Results'],
    },
  },
  '/v2/bulk_jobs/{id}': {
    get: {
      description: 'Fetches a bulk job, by ID only.',
      parameters: [
        {
          description: 'The id for the Bulk Job',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/BulkJob',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a bulk job',
      tags: ['Bulk Jobs'],
    },
    put: {
      description:
        'Updates a bulk job\'s name and / or marks a bulk job as \'ready_to_execute\'.  May only be updated if the bulk job is still in an "open" state.\n\nFor additional information on creating bulk jobs, the types of supported bulk jobs, and examples of the bulk job flow, visit the <a href="/bulk.html" target="_blank" rel="noopener noreferrer">bulk job details page</a>.\n',
      parameters: [
        {
          description: 'The id for the bulk job to which the job data relates',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'integer',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                name: {
                  description: 'Name for your bulk job',
                  type: 'string',
                },
                ready_to_execute: {
                  description: 'Whether the job is ready to be executed. Must be true or false.',
                  type: 'boolean',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/BulkJob',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Update a bulk job',
      tags: ['Bulk Jobs'],
    },
  },
  '/v2/cadence_exports/{id}.json': {
    get: {
      description: 'Exports a cadence as JSON.\n',
      parameters: [
        {
          description: 'Cadence ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CadenceExport',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Export a cadence',
      tags: ['Cadence Exports'],
    },
  },
  '/v2/cadence_imports.json': {
    post: {
      description:
        'New cadences can be created or steps can be imported onto existing cadences which do not have steps.\n<a href="/cadence-imports.html" target="_blank" rel="noopener noreferrer">Visit here for more details</a>.\n',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                cadence_content: {
                  description: 'Import data for cadence',
                  type: 'object',
                },
                settings: {
                  description: 'Settings for a cadence',
                  type: 'object',
                },
                sharing_settings: {
                  description: 'The shared settings for a cadence',
                  type: 'object',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CadenceImport',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Import cadences from JSON',
      tags: ['Cadence Imports'],
    },
  },
  '/v2/cadence_memberships.json': {
    get: {
      description:
        'Fetches multiple cadence membership records. The records can be filtered, paged, and sorted according to\nthe respective parameters. A cadence membership is the association between a person and their current and\nhistorical time on a cadence. Cadence membership records are mutable and change over time. If a person is\nadded to a cadence and re-added to the same cadence in the future, there is a single membership record.\n',
      parameters: [
        {
          description:
            "IDs of cadence memberships to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'ID of the person to find cadence memberships for',
          in: 'query',
          name: 'person_id',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'ID of the cadence to find cadence memberships for',
          in: 'query',
          name: 'cadence_id',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'updated_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'If true, return only cadence memberships for people currently on cadences.  If false, return cadence memberships for people who have been removed from or have completed a cadence.',
          in: 'query',
          name: 'currently_on_cadence',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Key to sort on, must be one of: added_at, updated_at. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CadenceMembership',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List cadence memberships',
      tags: ['Cadence Memberships'],
    },
    post: {
      description:
        'Adds a person to a cadence. person_id and cadence_id are required, and must be visible to the authenticated user. user_id will\ndefault to the authenticated user, but can be set to any visible user on the authenticated team.\n\nA person cannot be added to a cadence on behalf of a teammate unless the cadence is a team cadence, the cadence is owned by\nthe teammate, or the teammate has the Personal Cadence Admin permission.\n',
      parameters: [
        {
          description: 'ID of the person to create a cadence membership for',
          in: 'query',
          name: 'person_id',
          required: true,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'ID of the cadence to create a cadence membership for',
          in: 'query',
          name: 'cadence_id',
          required: true,
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'ID of the user to create a cadence membership for. The associated cadence must be owned by the user, or it must be a team cadence',
          in: 'query',
          name: 'user_id',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'ID of the step on which the person should start the cadence. Start on first step is the default behavior without this parameter.',
          in: 'query',
          name: 'step_id',
          required: false,
          schema: {
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CadenceMembership',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create a cadence membership',
      tags: ['Cadence Memberships'],
    },
  },
  '/v2/cadence_memberships/{id}.json': {
    delete: {
      description: 'Cadence Membership\n',
      parameters: [
        {
          description: 'CadenceMembership ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '204': {
          description: 'The person has been removed from the cadence successfully',
        },
      },
      summary: 'Delete a cadence membership',
      tags: ['Cadence Memberships'],
    },
    get: {
      description: 'Fetches a cadence membership, by ID only.\n',
      parameters: [
        {
          description: 'CadenceMembership ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CadenceMembership',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a cadence membership',
      tags: ['Cadence Memberships'],
    },
  },
  '/v2/cadences.json': {
    get: {
      description:
        'Fetches multiple cadence records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description:
            "IDs of cadences to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'updated_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters cadences by whether they are a team cadence or not',
          in: 'query',
          name: 'team_cadence',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Filters cadences by whether they are shared',
          in: 'query',
          name: 'shared',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: "Filters cadences by the owner's guid. Multiple owner guids can be applied",
          explode: false,
          in: 'query',
          name: 'owned_by_guid',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters cadences by whether they are able to have people added to them',
          in: 'query',
          name: 'people_addable',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Filters cadences by name',
          explode: false,
          in: 'query',
          name: 'name',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters by group ids. Also supports group ids passed in as a JSON array string',
          in: 'query',
          name: 'group_ids',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Filters by whether the Cadences have been archived. Excluding this field will result in both archived and unarchived Cadences to return.',
          in: 'query',
          name: 'archived',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at, name. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Cadence',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List cadences',
      tags: ['Cadences'],
    },
  },
  '/v2/cadences/{id}.json': {
    get: {
      description: 'Fetches a cadence, by ID only.\n',
      parameters: [
        {
          description: 'Cadence ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Cadence',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a cadence',
      tags: ['Cadences'],
    },
  },
  '/v2/calendar/events': {
    get: {
      description: 'Returns all calendar events, paginated and filtered by the date.',
      parameters: [
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Key to sort on, must be one of: start_time. Defaults to start_time',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Lower bound (inclusive) for a calendar event's end time to filter by.\nMust be in ISO 8601 format.\n\nExample: `2022-02-14T10:12:59+00:00`.\n",
          in: 'query',
          name: 'start_time',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Upper bound (exclusive) for a calendar event's start time to filter by.\nMust be in ISO 8601 format.\n\nExample: `2022-02-14T10:12:59+00:00`.\n",
          in: 'query',
          name: 'end_time',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'user_guid of the user who created or included as a guest to the event.\n',
          in: 'query',
          name: 'user_guid',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'calendar_id of the user who created or included as a guest to the event.\n',
          in: 'query',
          name: 'calendar_id',
          required: false,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CalendarEvent',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List calendar events',
      tags: ['Calendar Events'],
    },
  },
  '/v2/calendar/events/upsert': {
    post: {
      description:
        '  Upserts a calendar event object.\n  Upsert key is a combination of `id` and `i_cal_uid` scoped to the given `calendar_id`.\n  Bulk operations:\n  This endpoint is used for bulk operations, see https://developers.salesloft.com/bulk.html for integration instructions.\n  Use `calendar/events/upsert` as an event type, and this spec as a data spec.\n  This endpoint should be used directly for the time sensitive calendar event updates.\n',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                all_day: {
                  description: 'Should be set to `true` for all day calendar events.',
                  type: 'boolean',
                },
                attendees: {
                  description:
                    '  List of attendees of the calendar event.\n  Example:\n  ```\n    {\n      ...\n      "attendees": [\n        {\n          "name": "Alice",\n          "email": "alice@example.com",\n          "status": "accepted",\n          "organizer": true\n        },\n        {\n          "name": "Bob",\n          "email": "bob@example.com",\n          "status": "needsAction",\n          "organizer": false\n        }\n      ]\n    }\n  ```\n  `name`: full name of the attendee\n\n  `email`: email address of the attendee\n\n  `status`: one of the following - needsAction, accepted, tentative, declined\n\n  `organizer`: whether the attendee is the organizer of the calendar event\n',
                  type: 'object',
                },
                calendar_id: {
                  description:
                    '  Calendar ID of the calendar event owner.\n  For the External Calendar connection use `external_{salesloft_user_guid}` format.\n  Example: `external_00210d1a-df8a-459f-af75-89b953b618b0`.\n',
                  type: 'string',
                },
                canceled_at: {
                  description:
                    '  Cancellation time of the calendar event, as a combined date-time value in the ISO 8601 format with a time zone offset.\n  Example: `2022-02-14T10:12:59+00:00`.\n',
                  type: 'string',
                },
                description: {
                  description: 'Description of the calendar event',
                  type: 'string',
                },
                end_time: {
                  description:
                    '  End time of the calendar event, as a combined date-time value in the ISO 8601 format with a time zone offset.\n  Example: `2022-02-14T10:12:59+00:00`.\n',
                  format: 'date',
                  type: 'string',
                },
                i_cal_uid: {
                  description:
                    '  icalUID of the calendar event. Unique identifier for a calendar event across calendars.\n\n  Used as an upsert key.\n',
                  type: 'string',
                },
                id: {
                  description:
                    '  Id of the calendar event, different for each occurrence in a recurring series.\n\n  Used as an upsert key.\n',
                  type: 'string',
                },
                location: {
                  description: 'Location of the calendar event as free-form text.',
                  type: 'string',
                },
                organizer: {
                  description: '  Email address of the organizer\n',
                  type: 'string',
                },
                recurring: {
                  description: 'Should be set to `true` if this is one of recurring series calendar event.',
                  type: 'boolean',
                },
                start_time: {
                  description:
                    '  Start time of the calendar event, as a combined date-time value in the ISO 8601 format with a time zone offset.\n  Example: `2022-02-14T10:12:59+00:00`.\n',
                  format: 'date',
                  type: 'string',
                },
                status: {
                  description:
                    "  Status of the calendar event. Depending on the status, the calendar event will or will not impact user's availability.\n  Possible values: `confirmed`, `tentative`, `cancelled`.\n  Example: `confirmed`.\n",
                  type: 'string',
                },
                title: {
                  description: 'Title of the calendar event',
                  type: 'string',
                },
                updated_at: {
                  description:
                    "  Last modification time of the event in the ISO 8601 format with a time zone offset. The event will not be updated if the 'updated_at' timestamp from the payload is earlier than the one in the database.\n  Example: `2022-02-14T10:12:59+00:00`.\n",
                  type: 'string',
                },
              },
              required: ['id', 'i_cal_uid', 'start_time', 'end_time', 'calendar_id'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '201': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CalendarEvent',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Upsert a calendar event',
      tags: ['Calendar Events'],
    },
  },
  '/v2/call_data_records.json': {
    get: {
      description:
        'Fetches multiple call data records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n\nCall data records are records of all inbound and outbound calls through Salesloft. A call data record may\nbe associated with a call, but does not have to be.\n',
      parameters: [
        {
          description:
            "IDs of call data records to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Return only call data records which have or do not have a call logged for them',
          in: 'query',
          name: 'has_call',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Equality filters that are applied to the created_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'created_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'updated_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters list to only include guids',
          explode: false,
          in: 'query',
          name: 'user_guid',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters list by person_id. Multiple person ids can be applied',
          explode: false,
          in: 'query',
          name: 'person_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CallDataRecord',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List call data records',
      tags: ['Call Data Records'],
    },
  },
  '/v2/call_data_records/{id}.json': {
    get: {
      description: 'Fetches a call data record, by ID only.\n',
      parameters: [
        {
          description: 'CallDataRecord ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CallDataRecord',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a call data record',
      tags: ['Call Data Records'],
    },
  },
  '/v2/call_dispositions.json': {
    get: {
      description:
        'Fetches multiple call disposition records. The records can be sorted according to\nthe respective parameters. Call dispositions must be configured in application. This will\nchange in the future, but please contact us if you have a pressing use case.\n',
      parameters: [
        {
          description: 'Key to sort on, must be one of: name, updated_at. Defaults to name',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to ASC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CallDisposition',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List call dispositions',
      tags: ['Call Dispositions'],
    },
  },
  '/v2/call_sentiments.json': {
    get: {
      description:
        'Fetches multiple call sentiment records. The records can be sorted according to\nthe respective parameters. Call sentiments must be configured in application. This will\nchange in the future, but please contact us if you have a pressing use case.\n',
      parameters: [
        {
          description: 'Filters call sentiments by name',
          in: 'query',
          name: 'name',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Key to sort on, must be one of: name, updated_at. Defaults to name',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to ASC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CallSentiment',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List call sentiments',
      tags: ['Call Sentiments'],
    },
  },
  '/v2/conversations/calls': {
    post: {
      description: 'Enqueue a Conversations Call for processing',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                call_created_at: {
                  description:
                    'Timestamp for when the call started. If not provided, will default to the time the request was received',
                  type: 'string',
                },
                direction: {
                  description: 'Call direction',
                  type: 'string',
                },
                duration: {
                  description: 'Duration of call in seconds',
                  type: 'number',
                },
                from: {
                  description: 'Phone number that call was made from',
                  type: 'string',
                },
                recording: {
                  description: 'Object containing recording info including the audio file (.mp3, .wav, .ogg, .m4a)',
                  type: 'object',
                },
                to: {
                  description: ' Phone number that was called',
                  type: 'string',
                },
                user_guid: {
                  description:
                    'Guid of the Salesloft User to assign the call to. If not provided, will default to the user within the authentication token',
                  type: 'string',
                },
              },
              required: ['to', 'from', 'duration', 'recording'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '201': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/ConversationsCall',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create Conversations Call',
      tags: ['Conversations Calls'],
    },
  },
  '/v2/crm_activities.json': {
    get: {
      description:
        'Fetches multiple crm activity records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description: 'IDs of crm activities to fetch.',
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'updated_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CrmActivity',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List crm activities',
      tags: ['CRM Activities'],
    },
  },
  '/v2/crm_activities/{id}.json': {
    get: {
      description: 'Fetches a crm activity, by ID only.\n',
      parameters: [
        {
          description: 'Crm activity ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CrmActivity',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a crm activity',
      tags: ['CRM Activities'],
    },
  },
  '/v2/crm_activity_fields.json': {
    get: {
      description:
        'Fetches multiple crm activity field records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description: 'Return only records with this source',
          in: 'query',
          name: 'source',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Key to sort on, must be one of: title, updated_at. Defaults to title',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to ASC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CrmActivityField',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List crm activity fields',
      tags: ['CRM Activity Fields'],
    },
  },
  '/v2/crm_users.json': {
    get: {
      description: 'Crm Users\n',
      parameters: [
        {
          description:
            "IDs of crm users to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters crm users by crm_ids',
          explode: false,
          in: 'query',
          name: 'crm_id',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters crm users by user_ids',
          explode: false,
          in: 'query',
          name: 'user_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters crm users by user guids',
          explode: false,
          in: 'query',
          name: 'user_guid',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Key to sort on, must be one of: id, updated_at. Defaults to id',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CrmUser',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List crm users',
      tags: ['Crm Users'],
    },
  },
  '/v2/custom_fields.json': {
    get: {
      description:
        'Fetches multiple custom field records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description: 'IDs of custom fields to fetch.',
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Type of field to fetch. Value must be one of: person, company, opportunity',
          in: 'query',
          name: 'field_type',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at, name. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CustomField',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List custom fields',
      tags: ['Custom Fields'],
    },
    post: {
      description: 'Creates a custom field.\n',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                field_type: {
                  description: 'The field type of the custom field. Value must be one of: person, company, opportunity',
                  type: 'string',
                },
                name: {
                  description: 'The name of the custom field',
                  type: 'string',
                },
              },
              required: ['name'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CustomField',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create a custom field',
      tags: ['Custom Fields'],
    },
  },
  '/v2/custom_fields/{id}.json': {
    delete: {
      description: 'Deletes a custom field.\n',
      parameters: [
        {
          description: 'Custom Field ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '204': {
          description: 'The Custom Field has been deleted successfully',
        },
      },
      summary: 'Delete a custom field',
      tags: ['Custom Fields'],
    },
    get: {
      description: 'Fetches a custom field, by ID only.\n',
      parameters: [
        {
          description: 'Custom Field ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CustomField',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a custom field',
      tags: ['Custom Fields'],
    },
    put: {
      description: 'Update a custom field.\n',
      parameters: [
        {
          description: 'Custom Field ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                field_type: {
                  description: 'The field type of the custom field. Value must be one of: person, company, opportunity',
                  type: 'string',
                },
                name: {
                  description: 'The name of the custom field',
                  type: 'string',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CustomField',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Update a custom field',
      tags: ['Custom Fields'],
    },
  },
  '/v2/custom_roles.json': {
    get: {
      description:
        'Fetches multiple custom role records. The records can be filtered, and sorted according to\nthe respective parameters. A custom role is any role that is not Admin or User.\n',
      parameters: [
        {
          description: 'IDs of roles to fetch.',
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: id, name. Defaults to id',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CustomRole',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List custom roles',
      tags: ['Roles'],
    },
  },
  '/v2/custom_roles/{id}.json': {
    get: {
      description: 'Fetches a custom role, by ID only.\n',
      parameters: [
        {
          description: 'Custom Role ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/CustomRole',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a custom role',
      tags: ['Roles'],
    },
  },
  '/v2/email_template_attachments.json': {
    get: {
      description:
        'Fetches multiple email template attachment records. The records can be filtered and paged according to\nthe respective parameters.\n',
      parameters: [
        {
          description:
            "IDs of email template attachments to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters email template attachments by email template IDs',
          explode: false,
          in: 'query',
          name: 'email_template_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/EmailTemplateAttachment',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List email template attachments',
      tags: ['Email Template Attachments'],
    },
  },
  '/v2/email_templates.json': {
    get: {
      description:
        'Fetches multiple email template records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description:
            "IDs of email templates to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'updated_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters email templates by whether they are linked to a team template or not',
          in: 'query',
          name: 'linked_to_team_template',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Filters email templates by title or subject',
          in: 'query',
          name: 'search',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Filters email templates by tags applied to the template by tag ID, not to exceed 100 IDs',
          explode: false,
          in: 'query',
          name: 'tag_ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters email templates by tags applied to the template, not to exceed 100 tags',
          explode: false,
          in: 'query',
          name: 'tag',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters email templates by current authenticated user',
          in: 'query',
          name: 'filter_by_owner',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Filters email templates by groups applied to the template by group ID. Not to exceed 500 IDs. Returns templates that are assigned to any of the group ids.',
          explode: false,
          in: 'query',
          name: 'group_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters email templates based on whether or not the template has been used on a cadence',
          in: 'query',
          name: 'include_cadence_templates',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Filters email templates to include archived templates or not',
          in: 'query',
          name: 'include_archived_templates',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            "Filters email templates to those belonging to the cadence. Not to exceed 100 IDs. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'cadence_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at, last_used_at. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/EmailTemplate',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List email templates',
      tags: ['Email Templates'],
    },
  },
  '/v2/email_templates/{id}.json': {
    get: {
      description: 'Fetches an email template, by ID only.\n',
      parameters: [
        {
          description: 'EmailTemplate ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: "Optionally will return the templates with the current user's email signature",
          in: 'query',
          name: 'include_signature',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/EmailTemplate',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch an email template',
      tags: ['Email Templates'],
    },
  },
  '/v2/external_emails.json': {
    post: {
      description: 'Creates an external email object.\n',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                mailbox: {
                  description: 'Email address of mailbox email was sent to',
                  type: 'string',
                },
                raw: {
                  description: 'Base64 encoded MIME email content',
                  type: 'string',
                },
              },
              required: ['mailbox', 'raw'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '201': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/ExternalEmail',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create an External Email',
      tags: ['External Emails'],
    },
  },
  '/v2/groups.json': {
    get: {
      description:
        'Fetches multiple group records. The records can be filtered, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description: 'IDs of groups to fetch.',
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Group',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List groups',
      tags: ['Groups'],
    },
  },
  '/v2/groups/{id}.json': {
    get: {
      description: 'Fetches a group, by ID only.\n',
      parameters: [
        {
          description: 'Group ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Group',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a group',
      tags: ['Groups'],
    },
  },
  '/v2/imports.json': {
    get: {
      description: 'Fetches multiple imports.\n',
      parameters: [
        {
          description:
            "IDs of imports to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            "ID of users to fetch imports for. Using this filter will return an empty array for non-admin users who request other user's imports",
          explode: false,
          in: 'query',
          name: 'user_ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to created_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Import',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List imports',
      tags: ['Imports'],
    },
    post: {
      description: 'Creates an import.\n',
      requestBody: {
        $ref: '#/components/requestBodies/postV2ImportsJson',
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Import',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create an import',
      tags: ['Imports'],
    },
  },
  '/v2/imports/{id}.json': {
    delete: {
      description:
        'Deletes an import, by ID only. The associated people can be deleted as part of the deletion process.\n\nAdmin users can access imports for the entire team, but non-admin users can only access their own imports.\n',
      parameters: [
        {
          description: 'Import ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Whether to delete people on this Import. Possible values are: [not present], all, single.\n\n'single' will delete people who are only present in this Import.\n'all' will delete people even if they are present in other Imports.\nNot specifying this parameter will not delete any people\n",
          in: 'query',
          name: 'undo',
          required: false,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '204': {
          description: 'The import has been deleted successfully',
        },
      },
      summary: 'Delete an import',
      tags: ['Imports'],
    },
    get: {
      description:
        'Fetches an import, by ID only.\n\nAdmin users can access imports for the entire team, but non-admin users can only access their own imports.\n',
      parameters: [
        {
          description: 'Import ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Import',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch an import',
      tags: ['Imports'],
    },
    put: {
      description:
        'Updates an import, by ID only.\n\nAdmin users can access imports for the entire team, but non-admin users can only access their own imports.\n',
      parameters: [
        {
          description: 'Import ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        $ref: '#/components/requestBodies/postV2ImportsJson',
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Import',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Update an import',
      tags: ['Imports'],
    },
  },
  '/v2/live_website_tracking_parameters.json': {
    post: {
      description: 'Creates a Live Website Tracking parameter to identify a person\n',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                person_id: {
                  description: 'The person to create the LiveWebsiteTrackingParameter for',
                  type: 'integer',
                },
              },
              required: ['person_id'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/LiveWebsiteTrackingParameter',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create an Live Website Tracking Parameter',
      tags: ['Live Website Tracking Parameters'],
    },
  },
  '/v2/me.json': {
    get: {
      description:
        'Authenticated user information. This endpoint does not accept any parameters as it is\nrepresents your authenticated user. The "Users" resource provides user information\nfor other users on the team.\n',
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/User',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch current user',
      tags: ['Me'],
    },
  },
  '/v2/meetings.json': {
    get: {
      description:
        'Fetches multiple meeting records. The records can be filtered, paged, and sorted according to the respective parameters.\nMeetings resource is responsible for events created via the Salesloft platform using calendaring features.\nThese events can relate to cadences, people, and accounts.\n',
      parameters: [
        {
          description:
            "IDs of meetings to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters meetings by status. Possible values are: pending, booked, failed, retry',
          in: 'query',
          name: 'status',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Filters meetings by person_id. Multiple person ids can be applied',
          in: 'query',
          name: 'person_id',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Filters meetings by account_id. Multiple account ids can be applied',
          in: 'query',
          name: 'account_id',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Filters meetings by person_id. Multiple person ids can be applied',
          explode: false,
          in: 'query',
          name: 'person_ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            "List of event IDs. If both event_ids and i_cal_uids params are passed, this filters will be ORed. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'event_ids',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            "List of UIDs provided by calendar provider. If both event_ids and i_cal_uids params are passed, this filters will be ORed. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'i_cal_uids',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters meetings by task_id. Multiple task ids can be applied',
          explode: false,
          in: 'query',
          name: 'task_ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Flag to indicate whether to include owned_by_meetings_settings and booked_by_meetings_settings objects',
          in: 'query',
          name: 'include_meetings_settings',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Equality filters that are applied to the start_time field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'start_time',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the created_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'created_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters meetings by user_guid. Multiple user guids can be applied',
          explode: false,
          in: 'query',
          name: 'user_guids',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Whether to include deleted events in the result',
          in: 'query',
          name: 'show_deleted',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Key to sort on, must be one of: start_time, created_at, updated_at. Defaults to start_time',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Meeting',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List meetings',
      tags: ['Meetings'],
    },
  },
  '/v2/meetings/settings/searches.json': {
    post: {
      description:
        'Fetches multiple meeting setting records. The records can be filtered, paged, and sorted according to the respective parameters.\n',
      parameters: [
        {
          description: 'Filters meeting settings by array of user_guids',
          explode: false,
          in: 'query',
          name: 'user_guids',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'updated_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters meeting settings by calendar type',
          in: 'query',
          name: 'calendar_type',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/MeetingSetting',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
        '403': {
          description: 'This endpoint is not available without the following permissions: manage_team',
        },
      },
      summary: 'List meeting settings',
      tags: ['Meetings Settings - Searches'],
    },
  },
  '/v2/meetings/settings/{id}.json': {
    put: {
      description: 'Updates a meeting setting, by ID only.\n',
      parameters: [
        {
          description: 'MeetingSetting ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                allow_booking_on_behalf: {
                  description: 'Allow other team members to schedule on you behalf.',
                  type: 'boolean',
                },
                allow_booking_overtime: {
                  description: 'Allow team members to insert available time outside your working hours.',
                  type: 'boolean',
                },
                allow_event_overlap: {
                  description: 'Allow team members to double book events on your calendar.',
                  type: 'boolean',
                },
                availability_limit: {
                  description: 'The number of days out the user allows a prospect to schedule a meeting',
                  type: 'integer',
                },
                availability_limit_enabled: {
                  description: 'If Availability Limits have been turned on',
                  type: 'boolean',
                },
                buffer_time_duration: {
                  description: 'Default buffer duration in minutes set by a user',
                  type: 'integer',
                },
                calendar_type: {
                  description: 'Calendar type',
                  type: 'string',
                },
                default_meeting_length: {
                  description: 'Default meeting length in minutes set by the user',
                  type: 'integer',
                },
                description: {
                  description: 'Default description of the meeting',
                  type: 'string',
                },
                enable_calendar_sync: {
                  description: 'Determines if a user enabled Calendar Sync feature',
                  type: 'boolean',
                },
                enable_dynamic_location: {
                  description:
                    'Determines if location will be filled via third-party service (Zoom, GoToMeeting, etc.)',
                  type: 'boolean',
                },
                location: {
                  description: 'Default location of the meeting',
                  type: 'string',
                },
                primary_calendar_connection_failed: {
                  description: 'Determines if the user lost calendar connection',
                  type: 'boolean',
                },
                primary_calendar_id: {
                  description: 'ID of the primary calendar',
                  type: 'string',
                },
                primary_calendar_name: {
                  description: 'Display name of the primary calendar',
                  type: 'string',
                },
                reschedule_meetings_enabled: {
                  description: 'Determines if a user enabled reschedule meetings feature',
                  type: 'boolean',
                },
                schedule_buffer_enabled: {
                  description: 'Determines if meetings are scheduled with a 15 minute buffer between them',
                  type: 'boolean',
                },
                schedule_delay: {
                  description: 'The number of hours in advance a user requires someone to a book a meeting with them',
                  type: 'integer',
                },
                share_event_detail: {
                  description: 'Allow team members to see the details of events on your calendar.',
                  type: 'boolean',
                },
                time_zone: {
                  description: 'Time zone for current calendar',
                  type: 'string',
                },
                times_available: {
                  description: 'Times available set by a user that can be used to book meetings',
                  type: 'object',
                },
                title: {
                  description: 'Default title of the meeting',
                  type: 'string',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/MeetingSetting',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Update a meeting setting',
      tags: ['Meeting Settings'],
    },
  },
  '/v2/meetings/{id}.json': {
    put: {
      description: 'Updates a meeting, by ID only.\n',
      parameters: [
        {
          description: 'Meeting ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                event_id: {
                  description: 'Meeting ID from the calendar provider',
                  type: 'string',
                },
                i_cal_uid: {
                  description: 'Meeting unique identifier (iCalUID)',
                  type: 'string',
                },
                no_show: {
                  description: 'Whether the meeting is a No Show meeting',
                  type: 'boolean',
                },
                reschedule_status: {
                  description:
                    'Status of the meeting rescheduling progress. Possible values are: pending, booked, failed, retry',
                  type: 'string',
                },
                status: {
                  description:
                    'Status of the meeting creation progress. Possible values are: pending, booked, failed, retry',
                  type: 'string',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Meeting',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Update a meeting',
      tags: ['Meetings'],
    },
  },
  '/v2/mime_email_payloads/{id}.json': {
    get: {
      description: 'Fetch the MIME content for email.\n',
      parameters: [
        {
          description: 'ID of Email',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/MimeEmailPayload',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch the MIME content for email',
      tags: ['Mime Email Payloads'],
    },
  },
  '/v2/notes.json': {
    get: {
      description:
        'Fetches multiple note records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description:
            'Case insensitive type of item with which the note is associated.  Value must be one of: person, account',
          in: 'query',
          name: 'associated_with_type',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'ID of the item with which the note is associated.  The associated_with_type must also be present if this parameter is used',
          in: 'query',
          name: 'associated_with_id',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'updated_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            "IDs of notes to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Note',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List notes',
      tags: ['Notes'],
    },
    post: {
      description: 'Creates a note.\n',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                associated_with_id: {
                  description: 'ID of the item with which the note is associated',
                  type: 'integer',
                },
                associated_with_type: {
                  description:
                    'Case insensitive type of item with which the note is associated.  Value must be one of: person, account',
                  type: 'string',
                },
                call_id: {
                  description: 'ID of the call with which the note is associated. The call cannot already have a note',
                  type: 'integer',
                },
                content: {
                  description: 'The content of the note',
                  type: 'string',
                },
                skip_crm_sync: {
                  description: 'Boolean indicating if the CRM sync should be skipped.  No syncing will occur if true',
                  type: 'boolean',
                },
                subject: {
                  description: "The subject of the note's crm activity, defaults to 'Note'",
                  type: 'string',
                },
                user_guid: {
                  description:
                    'The user to create the note for. Only team admins may create notes on behalf of other users. Defaults to the requesting user',
                  type: 'string',
                },
              },
              required: ['content', 'associated_with_type', 'associated_with_id'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Note',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create a note',
      tags: ['Notes'],
    },
  },
  '/v2/notes/{id}.json': {
    delete: {
      description:
        'Deletes a note owned by authorized account.\nThis operation is not reversible without contacting support.\nThis operation can be called multiple times successfully.\n',
      parameters: [
        {
          description: 'Note ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '204': {
          description: 'The Note has been deleted successfully',
        },
      },
      summary: 'Delete a note',
      tags: ['Notes'],
    },
    get: {
      description: 'Fetches a note, by ID only.\n',
      parameters: [
        {
          description: 'Note ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Note',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a note',
      tags: ['Notes'],
    },
    put: {
      description: 'Updates a note. Any changes to the note or associated records will not reflect in your CRM.\n',
      parameters: [
        {
          description: 'Note ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                call_id: {
                  description:
                    'ID of the call with which the note is associated. The call cannot already have a note. If the note is associated to a call already, it will become associated to the requested call',
                  type: 'integer',
                },
                content: {
                  description: 'The content of the note',
                  type: 'string',
                },
              },
              required: ['content'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Person',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Update a note',
      tags: ['Notes'],
    },
  },
  '/v2/ongoing_actions.json': {
    post: {
      description:
        'Creates an ongoing action. An ongoing action is an action that is not yet completed,\nbut progress has been made towards the completion. The user should not need to do\nanything for an ongoing action to be completed. An ongoing action can be later completed\nby creating an activity.\n\nOngoing actions are marked as status=pending_activity.\n',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                action_id: {
                  description:
                    'Action that is being marked ongoing. This will validate that the action is still\nvalid before modifying it. Ongoing actions can not be marked ongoing.\n',
                  type: 'integer',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Action',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create an ongoing action',
      tags: ['Ongoing Actions'],
    },
  },
  '/v2/pending_emails.json': {
    get: {
      description: 'Fetches a list of emails ready to be sent by an external email service.\n',
      parameters: [
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/PendingEmail',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary:
        'Fetches a list of emails ready to be sent by an external email service. Only emails sent with an External Email Client will appear here.',
      tags: ['Pending Emails'],
    },
  },
  '/v2/pending_emails/{id}.json': {
    put: {
      description: 'Updates the status of an email sent by an External Email Client. Does not affect lofted emails.\n',
      parameters: [
        {
          description: 'Email ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                error_message: {
                  description: 'The error message indicating why the email failed to send',
                  type: 'string',
                },
                message_id: {
                  description: 'The message id of the email that was sent',
                  type: 'string',
                },
                sent_at: {
                  description: 'The time that the email was actually sent in iso8601 format',
                  type: 'string',
                },
                status: {
                  description: "Delivery status of the email.  Valid statuses are 'sent' and 'failed'",
                  type: 'string',
                },
              },
              required: ['message_id', 'status'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/PendingEmail',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Updates the status of an email sent by an External Email Client',
      tags: ['Pending Emails'],
    },
  },
  '/v2/people.json': {
    get: {
      description:
        'Fetches multiple person records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description:
            "IDs of people to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'updated_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Filters people by email address. Multiple emails can be applied. An additional value of "_is_null" can be passed to filter people that do not have an email address.',
          explode: false,
          in: 'query',
          name: 'email_addresses',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: "Filters people by the owner's guid. Multiple owner guids can be applied",
          explode: false,
          in: 'query',
          name: 'owned_by_guid',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Includes people that have a given person_stage. Multiple person stage ids can be applied. An additional value of "_is_null" can be passed to filter people that do not have a stage set.',
          explode: false,
          in: 'query',
          name: 'person_stage_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters people by crm_id. Multiple crm ids can be applied',
          explode: false,
          in: 'query',
          name: 'crm_id',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Filters people by owner_crm_id. Multiple owner_crm_ids can be applied. An additional value of "_is_null" can be passed to filter people that are unowned. A "_not_in" modifier can be used to exclude specific owner_crm_ids. Example: v2/people?owner_crm_id[_not_in]=id',
          explode: false,
          in: 'query',
          name: 'owner_crm_id',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Includes people that have a given do_not_contact property',
          in: 'query',
          name: 'do_not_contact',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Includes people that can be emailed given do_not_contact and contact_restrictions property',
          in: 'query',
          name: 'can_email',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Includes people that can be called given do_not_contact and contact_restrictions property',
          in: 'query',
          name: 'can_call',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Includes people that can be sent a text message given do_not_contact and contact_restrictions property',
          in: 'query',
          name: 'can_text',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Filters people by the account they are linked to. Multiple account ids can be applied',
          explode: false,
          in: 'query',
          name: 'account_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Filters by people matching all given custom fields. The custom field names are case-sensitive, but the provided values are case-insensitive. Example: v2/people?custom_fields[custom_field_name]=custom_field_value',
          in: 'query',
          name: 'custom_fields',
          required: false,
          schema: {
            type: 'object',
          },
        },
        {
          description:
            'Filters people that were imported by the given import ids. Multiple import ids can be applied. An additional value of "_is_null" can be passed to filter people that were not imported.',
          explode: false,
          in: 'query',
          name: 'import_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Filters people by job seniorty. Multiple job seniorities can be applied. An additional value of "_is_null" can be passed to filter people do not have a job_seniority.',
          explode: false,
          in: 'query',
          name: 'job_seniority',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters people by the tag ids applied to the person. Multiple tag ids can be applied.',
          explode: false,
          in: 'query',
          name: 'tag_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters people by whether the owner is active or not.',
          in: 'query',
          name: 'owner_is_active',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Filters people by the cadence that they are currently on. Multiple cadence_ids can be applied. An additional value of "_is_null" can be passed to filter people that are not on a cadence.',
          explode: false,
          in: 'query',
          name: 'cadence_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters people who have been starred by the user guids given.',
          explode: false,
          in: 'query',
          name: 'starred_by_guid',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters people by whether or not they have replied to an email or not.',
          in: 'query',
          name: 'replied',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Filters people by whether an email that was sent to them bounced or not.',
          in: 'query',
          name: 'bounced',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Filters people by whether or not they have been marked as a success or not.',
          in: 'query',
          name: 'success',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Filters people by whether or not they are marked as an European Union Resident or not.',
          in: 'query',
          name: 'eu_resident',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Filters people by their title by exact match. Supports partial matching',
          explode: false,
          in: 'query',
          name: 'title',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters people by their country by exact match. Supports partial matching',
          explode: false,
          in: 'query',
          name: 'country',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters people by their state by exact match. Supports partial matching',
          explode: false,
          in: 'query',
          name: 'state',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters people by their city by exact match. Supports partial matching',
          explode: false,
          in: 'query',
          name: 'city',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the last_contacted field. A single filter can be used by itself or combined with other filters to create a range.\nAdditional values of "_is_null" or "_is_not_null" can be passed to filter records that either have no timestamp value or any timestamp value.\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          in: 'query',
          name: 'last_contacted',
          required: false,
          schema: {
            type: 'object',
          },
        },
        {
          description:
            'Equality filters that are applied to the last_contacted field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          in: 'query',
          name: 'created_at',
          required: false,
          schema: {
            type: 'object',
          },
        },
        {
          description:
            'Filters people by whether or not that person is on a cadence or if they have been contacted in any way.',
          in: 'query',
          name: 'new',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Filter people by whether or not they have a phone number or not',
          in: 'query',
          name: 'phone_number',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Filters people by locales. Multiple locales can be applied. An additional value of "Null" can be passed to filter people that do not have a locale.',
          explode: false,
          in: 'query',
          name: 'locales',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters people by owner_id. Multiple owner_ids can be applied.',
          explode: false,
          in: 'query',
          name: 'owner_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'For internal use only. This field does not comply with our backwards compatibility policies. This filter is for authenticated users of Salesloft only and will not work for OAuth Applications. Filters people by the string provided. Can search and filter by name, title, industry, email_address and linked account name.',
          in: 'query',
          name: '_query',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Key to sort on, must be one of: created_at, updated_at, last_contacted_at, name, title, job_seniority, call_count, sent_emails, clicked_emails, replied_emails, viewed_emails, account, cadence_stage_name. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Person',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List people',
      tags: ['People'],
    },
    post: {
      description:
        'Creates a person. Either email_address or phone/last_name must be provided as a unique lookup\non the team.\n',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                account_id: {
                  description: 'ID of the Account to link this person to',
                  type: 'integer',
                },
                autotag_date: {
                  description:
                    'Whether the date should be added to this person as a tag. Default is false. The tag will be Y-m-d format.',
                  type: 'boolean',
                },
                city: {
                  description: 'City',
                  type: 'string',
                },
                contact_restrictions: {
                  description:
                    'Specific methods of communication to prevent for this person. This will prevent individual execution of these communication types as well as automatically skip cadence steps of this communication type for this person in SalesLoft. Values currently accepted: call, email, message',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
                country: {
                  description: 'Country',
                  type: 'string',
                },
                crm_id: {
                  description:
                    'Requires Salesforce.\n\nID of the person in your external CRM. You must provide a crm_id_type if this is included.\n\nValidations will be applied to the crm_id depending on the crm_id_type. A "salesforce" ID must be exactly 18 characters. A "salesforce" ID must be either a Lead (00Q) or Contact (003) object. The type will be validated using the 18 character ID.\n\nThis field can only be used if your application or API key has the "person:set_crm_id" scope.\n\n',
                  type: 'string',
                },
                crm_id_type: {
                  description: 'The CRM that the provided crm_id is for. Must be one of: salesforce',
                  type: 'string',
                },
                custom_fields: {
                  description:
                    "Custom fields are defined by the user's team. Only fields with values are presented in the API.",
                  type: 'object',
                },
                do_not_contact: {
                  description:
                    'Whether or not this person has opted out of all communication. Setting this value to true prevents this person from being called, emailed, or added to a cadence in SalesLoft. If this person is currently in a cadence, they will be removed.',
                  type: 'boolean',
                },
                email_address: {
                  description: 'Email address',
                  type: 'string',
                },
                first_name: {
                  description: 'First name',
                  type: 'string',
                },
                home_phone: {
                  description: 'Home phone without formatting',
                  type: 'string',
                },
                import_id: {
                  description:
                    'ID of the Import this person is a part of. A person can be part of multiple imports, but this ID will always be the most recent Import',
                  type: 'integer',
                },
                job_seniority: {
                  description:
                    'The Job Seniority of a Person, must be one of director, executive, individual_contributor, manager, vice_president, unknown',
                  type: 'string',
                },
                last_name: {
                  description: 'Last name',
                  type: 'string',
                },
                linkedin_url: {
                  description: 'Linkedin URL',
                  type: 'string',
                },
                locale: {
                  description: 'Time locale of the person',
                  type: 'string',
                },
                mobile_phone: {
                  description: 'Mobile phone without formatting',
                  type: 'string',
                },
                owner_id: {
                  description: 'ID of the User that owns this person',
                  type: 'integer',
                },
                person_company_industry: {
                  description:
                    'Company industry. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended',
                  type: 'string',
                },
                person_company_name: {
                  description:
                    'Company name. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended',
                  type: 'string',
                },
                person_company_website: {
                  description:
                    'Company website. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended',
                  type: 'string',
                },
                person_stage_id: {
                  description: 'ID of the PersonStage of this person',
                  type: 'integer',
                },
                personal_email_address: {
                  description: 'Personal email address',
                  type: 'string',
                },
                personal_website: {
                  description: 'The website of this person',
                  type: 'string',
                },
                phone: {
                  description: 'Phone without formatting',
                  type: 'string',
                },
                phone_extension: {
                  description: 'Phone extension without formatting',
                  type: 'string',
                },
                secondary_email_address: {
                  description: 'Alternate email address',
                  type: 'string',
                },
                state: {
                  description: 'State',
                  type: 'string',
                },
                tags: {
                  description: 'All tags applied to this person',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
                title: {
                  description: 'Job title',
                  type: 'string',
                },
                twitter_handle: {
                  description: 'The twitter handle of this person',
                  type: 'string',
                },
                work_city: {
                  description: 'Work location - city',
                  type: 'string',
                },
                work_country: {
                  description: 'Work location - country',
                  type: 'string',
                },
                work_state: {
                  description: 'Work location - state',
                  type: 'string',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Person',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create a person',
      tags: ['People'],
    },
  },
  '/v2/people/{id}.json': {
    delete: {
      description:
        'Deletes a person. This operation is not reversible without contacting support.\nThis operation can be called multiple times successfully.\n',
      parameters: [
        {
          description: 'Person id',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '204': {
          description: 'The person has been deleted successfully',
        },
      },
      summary: 'Delete a person',
      tags: ['People'],
    },
    get: {
      description: 'Fetches a person, by ID only.\n',
      parameters: [
        {
          description: 'Person ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Person',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a person',
      tags: ['People'],
    },
    put: {
      description: 'Updates a person.\n',
      parameters: [
        {
          description: 'Person id',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                account_id: {
                  description: 'ID of the Account to link this person to',
                  type: 'integer',
                },
                city: {
                  description: 'City',
                  type: 'string',
                },
                contact_restrictions: {
                  description:
                    'Specific methods of communication to prevent for this person. This will prevent individual execution of these communication types as well as automatically skip cadence steps of this communication type for this person in SalesLoft. Values currently accepted: call, email, message',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
                country: {
                  description: 'Country',
                  type: 'string',
                },
                crm_id: {
                  description:
                    'Requires Salesforce.\n\nID of the person in your external CRM. You must provide a crm_id_type if this is included.\n\nValidations will be applied to the crm_id depending on the crm_id_type. A "salesforce" ID must be exactly 18 characters. A "salesforce" ID must be either a Lead (00Q) or Contact (003) object. The type will be validated using the 18 character ID.\n\nThis field can only be used if your application or API key has the "person:set_crm_id" scope.\n\n',
                  type: 'string',
                },
                crm_id_type: {
                  description: 'The CRM that the provided crm_id is for. Must be one of: salesforce',
                  type: 'string',
                },
                custom_fields: {
                  description:
                    "Custom fields are defined by the user's team. Only fields with values are presented in the API.",
                  type: 'object',
                },
                do_not_contact: {
                  description:
                    'Whether or not this person has opted out of all communication. Setting this value to true prevents this person from being called, emailed, or added to a cadence in SalesLoft. If this person is currently in a cadence, they will be removed.',
                  type: 'boolean',
                },
                email_address: {
                  description: 'Email address',
                  type: 'string',
                },
                first_name: {
                  description: 'First name',
                  type: 'string',
                },
                home_phone: {
                  description: 'Home phone without formatting',
                  type: 'string',
                },
                import_id: {
                  description:
                    'ID of the Import this person is a part of. A person can be part of multiple imports, but this ID will always be the most recent Import',
                  type: 'integer',
                },
                job_seniority: {
                  description:
                    'The Job Seniority of a Person, must be one of director, executive, individual_contributor, manager, vice_president, unknown',
                  type: 'string',
                },
                last_name: {
                  description: 'Last name',
                  type: 'string',
                },
                linkedin_url: {
                  description: 'Linkedin URL',
                  type: 'string',
                },
                locale: {
                  description: 'Time locale of the person',
                  type: 'string',
                },
                mobile_phone: {
                  description: 'Mobile phone without formatting',
                  type: 'string',
                },
                owner_id: {
                  description: 'ID of the User that owns this person',
                  type: 'integer',
                },
                person_company_industry: {
                  description:
                    'Company industry. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended',
                  type: 'string',
                },
                person_company_name: {
                  description:
                    'Company name. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended',
                  type: 'string',
                },
                person_company_website: {
                  description:
                    'Company website. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended',
                  type: 'string',
                },
                person_stage_id: {
                  description: 'ID of the PersonStage of this person',
                  type: 'integer',
                },
                personal_email_address: {
                  description: 'Personal email address',
                  type: 'string',
                },
                personal_website: {
                  description: 'The website of this person',
                  type: 'string',
                },
                phone: {
                  description: 'Phone without formatting',
                  type: 'string',
                },
                phone_extension: {
                  description: 'Phone extension without formatting',
                  type: 'string',
                },
                secondary_email_address: {
                  description: 'Alternate email address',
                  type: 'string',
                },
                state: {
                  description: 'State',
                  type: 'string',
                },
                tags: {
                  description: 'All tags applied to this person',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
                title: {
                  description: 'Job title',
                  type: 'string',
                },
                twitter_handle: {
                  description: 'The twitter handle of this person',
                  type: 'string',
                },
                work_city: {
                  description: 'Work location - city',
                  type: 'string',
                },
                work_country: {
                  description: 'Work location - country',
                  type: 'string',
                },
                work_state: {
                  description: 'Work location - state',
                  type: 'string',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Person',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Update a person',
      tags: ['People'],
    },
  },
  '/v2/person_stages.json': {
    get: {
      description:
        'Fetches multiple person stage records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description: 'IDs of person stages to fetch.',
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/PersonStage',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List person stages',
      tags: ['Person Stages'],
    },
    post: {
      description: 'Creates a person stage.\n',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                name: {
                  description: 'The name of the new stage',
                  type: 'string',
                },
              },
              required: ['name'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/PersonStage',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create a person stage',
      tags: ['Person Stages'],
    },
  },
  '/v2/person_stages/{id}.json': {
    delete: {
      description:
        'Deletes a person stage. This operation is not reversible without contacting support.\nThis operation can be called multiple times successfully.\n',
      parameters: [
        {
          description: 'Stage ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '204': {
          description: 'The Person Stage has been deleted successfully',
        },
      },
      summary: 'Delete an person stage',
      tags: ['Person Stages'],
    },
    get: {
      description: 'Fetches a person stage, by ID only.\n',
      parameters: [
        {
          description: 'Stage ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/PersonStage',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a person stage',
      tags: ['Person Stages'],
    },
    put: {
      description: 'Updates a person stage.\n',
      parameters: [
        {
          description: 'Stage ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                name: {
                  description: 'The name of the stage.',
                  type: 'string',
                },
              },
              required: ['name'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/PersonStage',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Update a person stage',
      tags: ['Person Stages'],
    },
  },
  '/v2/person_upserts.json': {
    post: {
      description:
        'Upserts a person record. The upsert_key dictates how the upsert will be performed. The create and update behavior\nis exactly the same as the individual create and update endpoints.\n',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                account_id: {
                  description: 'ID of the Account to link this person to',
                  type: 'integer',
                },
                city: {
                  description: 'City',
                  type: 'string',
                },
                contact_restrictions: {
                  description:
                    'Specific methods of communication to prevent for this person. This will prevent individual execution of these communication types as well as automatically skip cadence steps of this communication type for this person in SalesLoft. Values currently accepted: call, email, message',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
                country: {
                  description: 'Country',
                  type: 'string',
                },
                crm_id: {
                  description:
                    'Requires Salesforce.\n\nID of the person in your external CRM. You must provide a crm_id_type if this is included.\n\nValidations will be applied to the crm_id depending on the crm_id_type. A "salesforce" ID must be exactly 18 characters. A "salesforce" ID must be either a Lead (00Q) or Contact (003) object. The type will be validated using the 18 character ID.\n\nThis field can only be used if your application or API key has the "person:set_crm_id" scope.\n\n',
                  type: 'string',
                },
                crm_id_type: {
                  description: 'The CRM that the provided crm_id is for. Must be one of: salesforce',
                  type: 'string',
                },
                custom_fields: {
                  description:
                    "Custom fields are defined by the user's team. Only fields with values are presented in the API.",
                  type: 'object',
                },
                do_not_contact: {
                  description:
                    'Whether or not this person has opted out of all communication. Setting this value to true prevents this person from being called, emailed, or added to a cadence in SalesLoft. If this person is currently in a cadence, they will be removed.',
                  type: 'boolean',
                },
                email_address: {
                  description: 'Email address',
                  type: 'string',
                },
                first_name: {
                  description: 'First name',
                  type: 'string',
                },
                home_phone: {
                  description: 'Home phone without formatting',
                  type: 'string',
                },
                id: {
                  description:
                    "ID of the person to update. Used if the upsert_key=id. When id and another upsert_key are provided,\nthe request will fail if the upsert record id and id parameter don't match.\n",
                  type: 'integer',
                },
                import_id: {
                  description:
                    'ID of the Import this person is a part of. A person can be part of multiple imports, but this ID will always be the most recent Import',
                  type: 'integer',
                },
                job_seniority: {
                  description:
                    'The Job Seniority of a Person, must be one of director, executive, individual_contributor, manager, vice_president, unknown',
                  type: 'string',
                },
                last_name: {
                  description: 'Last name',
                  type: 'string',
                },
                linkedin_url: {
                  description: 'Linkedin URL',
                  type: 'string',
                },
                locale: {
                  description: 'Time locale of the person',
                  type: 'string',
                },
                mobile_phone: {
                  description: 'Mobile phone without formatting',
                  type: 'string',
                },
                owner_id: {
                  description: 'ID of the User that owns this person',
                  type: 'integer',
                },
                person_company_industry: {
                  description:
                    'Company industry. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended',
                  type: 'string',
                },
                person_company_name: {
                  description:
                    'Company name. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended',
                  type: 'string',
                },
                person_company_website: {
                  description:
                    'Company website. This property is specific to this person, unrelated to the company object. Updating the company object associated with this person is recommended',
                  type: 'string',
                },
                person_stage_id: {
                  description: 'ID of the PersonStage of this person',
                  type: 'integer',
                },
                personal_email_address: {
                  description: 'Personal email address',
                  type: 'string',
                },
                personal_website: {
                  description: 'The website of this person',
                  type: 'string',
                },
                phone: {
                  description: 'Phone without formatting',
                  type: 'string',
                },
                phone_extension: {
                  description: 'Phone extension without formatting',
                  type: 'string',
                },
                secondary_email_address: {
                  description: 'Alternate email address',
                  type: 'string',
                },
                state: {
                  description: 'State',
                  type: 'string',
                },
                tags: {
                  description: 'All tags applied to this person',
                  items: {
                    type: 'string',
                  },
                  type: 'array',
                },
                title: {
                  description: 'Job title',
                  type: 'string',
                },
                twitter_handle: {
                  description: 'The twitter handle of this person',
                  type: 'string',
                },
                upsert_key: {
                  description:
                    'Name of the parameter to upsert on. The field must be provided in the input parameters, or the request will fail.\nThe request will also fail if there are multiple records matched by the upsert field. This can occur if intentional duplicates\nby email address is enabled.\n\nIf upsert_key is not provided, this endpoint will not update an existing record.\n\nValid options are: id, crm_id, email_address. If crm_id is provided, then a valid crm_id_type must be provided, as documented\nfor the person create and update endpoints.\n',
                  type: 'string',
                },
                work_city: {
                  description: 'Work location - city',
                  type: 'string',
                },
                work_country: {
                  description: 'Work location - country',
                  type: 'string',
                },
                work_state: {
                  description: 'Work location - state',
                  type: 'string',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/PersonUpsert',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Upsert a person',
      tags: ['Person Upsert'],
    },
  },
  '/v2/phone_number_assignments.json': {
    get: {
      description:
        'Fetches multiple phone number assignment records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description: 'IDs of phone number assignments to fetch',
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/PhoneNumberAssignment',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List phone number assignments',
      tags: ['Phone Number Assignments'],
    },
  },
  '/v2/phone_number_assignments/{id}.json': {
    get: {
      description: 'Fetches a phone number assignment, by ID only.\n',
      parameters: [
        {
          description: 'PhoneNumberAssignment ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/PhoneNumberAssignment',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a phone number assignment',
      tags: ['Phone Number Assignments'],
    },
  },
  '/v2/phone_numbers/caller_ids.json': {
    get: {
      description:
        'Each entry is a possible caller ID match for the number. Multiple\nentries may be returned if the phone number is present on more than one\nperson in the system.  Phone number should be in E.164 format.\n',
      parameters: [
        {
          description: 'E.164 Phone Number',
          in: 'query',
          name: 'phone_number',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/CallerId',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List caller ids',
      tags: ['Caller IDs'],
    },
  },
  '/v2/phone_numbers/recording_settings/{id}.json': {
    get: {
      description:
        'Fetches the recording status for a given phone number, based on Do Not Record and Recording Governance for your team.\nPhone number should be in E.164 format.\n',
      parameters: [
        {
          description: 'E.164 Phone Number',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/RecordingSetting',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch recording setting',
      tags: ['Recording Settings'],
    },
  },
  '/v2/saved_list_views.json': {
    get: {
      description:
        'Fetches multiple saved list view records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description:
            "IDs of saved list views to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Type of saved list views to fetch.',
          in: 'query',
          name: 'view',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Key to sort on, must be one of: name. Defaults to name',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/SavedListView',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List saved list views',
      tags: ['Saved List Views'],
    },
    post: {
      description: 'Creates a saved list view.\n',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                is_default: {
                  description: 'Whether the saved list view is the default',
                  type: 'boolean',
                },
                name: {
                  description: 'The name of the saved list view',
                  type: 'string',
                },
                view: {
                  description:
                    'The type of objects in the saved list view.  Value must be one of: people, companies, or recordings',
                  type: 'string',
                },
                view_params: {
                  description: 'JSON object of list view parameters',
                  type: 'string',
                },
              },
              required: ['name', 'view'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/SavedListView',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create a saved list view',
      tags: ['Saved List Views'],
    },
  },
  '/v2/saved_list_views/{id}.json': {
    delete: {
      description:
        'Deletes a saved list view. This operation is not reversible without contacting support.\nThis operation can be called multiple times successfully.\n',
      parameters: [
        {
          description: 'Saved List View ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '204': {
          description: 'The saved list view has been deleted successfully',
        },
      },
      summary: 'Delete a saved list view',
      tags: ['Saved List Views'],
    },
    get: {
      description: 'Fetches a saved list view, by ID only.\n',
      parameters: [
        {
          description: 'Saved List View ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/SavedListView',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a saved list view',
      tags: ['Saved List Views'],
    },
    put: {
      description: 'Updates a saved list view.\n',
      parameters: [
        {
          description: 'Saved List View ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                is_default: {
                  description: 'Whether the saved list view is the default',
                  type: 'boolean',
                },
                name: {
                  description: 'The name of the saved list view',
                  type: 'string',
                },
                view_params: {
                  description: 'JSON object of list view parameters',
                  type: 'string',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/SavedListView',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Update a saved list view',
      tags: ['Saved List Views'],
    },
  },
  '/v2/steps.json': {
    get: {
      description:
        'Fetches multiple step records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description: 'IDs of steps to fetch.',
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filter by cadence ID',
          in: 'query',
          name: 'cadence_id',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Filter by step type',
          in: 'query',
          name: 'type',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Filter by whether a step has due actions',
          in: 'query',
          name: 'has_due_actions',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Step',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List steps',
      tags: ['Steps'],
    },
  },
  '/v2/steps/{id}.json': {
    get: {
      description: 'Fetches a step, by ID only.\n',
      parameters: [
        {
          description: 'Step ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Step',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a step',
      tags: ['Steps'],
    },
  },
  '/v2/successes.json': {
    get: {
      description:
        'Fetches multiple success records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description:
            "IDs of successes to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters successes by person_id. Multiple person ids can be applied',
          explode: false,
          in: 'query',
          name: 'person_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'updated_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at, succeeded_at. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Success',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List successes',
      tags: ['Successes'],
    },
  },
  '/v2/tags.json': {
    get: {
      description:
        'Fetches a list of the tags used for a team. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n\nTags can be applied to mulitple resource types.\n',
      parameters: [
        {
          description: 'Filters tags by name',
          in: 'query',
          name: 'search',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Filters tags by their IDs',
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: name. Defaults to name',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Tag',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List team tags',
      tags: ['Tags'],
    },
  },
  '/v2/tasks.json': {
    get: {
      description:
        'Fetches multiple task records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n',
      parameters: [
        {
          description: 'IDs of tasks to fetch.',
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters tasks by the user to which they are assigned.',
          explode: false,
          in: 'query',
          name: 'user_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters tasks by the person to which they are associated.',
          explode: false,
          in: 'query',
          name: 'person_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters tasks by the account to which they are associated.',
          explode: false,
          in: 'query',
          name: 'account_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            "Filters tasks by their current state. Valid current_states include: ['scheduled', 'completed'].",
          explode: false,
          in: 'query',
          name: 'current_state',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: "Filters tasks by their task type. Valid task_types include: ['call', 'email', 'general'].",
          explode: false,
          in: 'query',
          name: 'task_type',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            "Filters tasks by time interval. Valid time_intervals include: ['overdue', 'today', 'tomorrow', 'this_week', 'next_week'].",
          in: 'query',
          name: 'time_interval_filter',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Filters tasks by idempotency key.',
          in: 'query',
          name: 'idempotency_key',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Filters tasks by locale of the person to which they are associated.',
          explode: false,
          in: 'query',
          name: 'locale',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: due_date, due_at. Defaults to due_date',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to ASC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Task',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List tasks',
      tags: ['Tasks'],
    },
    post: {
      description: 'Creates a task.\n',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                current_state: {
                  description: 'Current state of the task, valid options are: scheduled',
                  type: 'string',
                },
                description: {
                  description: 'A description of the task recorded for person at completion time',
                  type: 'string',
                },
                due_date: {
                  description: 'Date of when the Task is due, ISO-8601 date format required',
                  type: 'string',
                },
                idempotency_key: {
                  description: 'Establishes a unique identifier to prevent duplicates from being created',
                  type: 'string',
                },
                person_id: {
                  description: 'ID of the person to be contacted',
                  type: 'string',
                },
                remind_at: {
                  description:
                    'Datetime of when the user will be reminded of the task, ISO-8601 datetime format required',
                  type: 'string',
                },
                subject: {
                  description: 'Subject line of the task.',
                  type: 'string',
                },
                task_type: {
                  description: 'Task type, valid options are: call, email, general',
                  type: 'string',
                },
                user_id: {
                  description: 'ID of the user linked to the task',
                  type: 'integer',
                },
              },
              required: ['subject', 'person_id', 'user_id', 'task_type', 'due_date', 'current_state'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Task',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create a Task',
      tags: ['Tasks'],
    },
  },
  '/v2/tasks/{id}.json': {
    get: {
      description: 'Fetches a task, by ID only.\n',
      parameters: [
        {
          description: 'Task ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Step',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a task',
      tags: ['Tasks'],
    },
    put: {
      description: 'Updates a task.\n',
      parameters: [
        {
          description: 'Task ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                current_state: {
                  description: 'Current state of the task, valid options are: completed',
                  type: 'string',
                },
                description: {
                  description: 'A description of the task recorded for person at completion time',
                  type: 'string',
                },
                due_date: {
                  description: 'Date of when the Task is due, ISO-8601 date format required',
                  type: 'string',
                },
                is_logged: {
                  description: 'A flag to indicate that the task should only be logged',
                  type: 'boolean',
                },
                remind_at: {
                  description:
                    'Datetime of when the user will be reminded of the task, ISO-8601 datetime format required',
                  type: 'string',
                },
                subject: {
                  description: 'Subject line of the task',
                  type: 'string',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Task',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Update a Task',
      tags: ['Tasks'],
    },
  },
  '/v2/team.json': {
    get: {
      description: 'Fetches the team of the authenticated user.\n',
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Team',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch current team',
      tags: ['Team'],
    },
  },
  '/v2/team_template_attachments.json': {
    get: {
      description:
        'Fetches multiple team template attachment records. The records can be filtered and paged according to\nthe respective parameters.\n',
      parameters: [
        {
          description:
            "IDs of team template attachments to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters template attachments by team template IDs',
          explode: false,
          in: 'query',
          name: 'team_template_id',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/TeamTemplateAttachment',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List team template attachments',
      tags: ['Team Template Attachments'],
    },
  },
  '/v2/team_templates.json': {
    get: {
      description:
        'Fetches multiple team template records. The records can be filtered, paged, and sorted according to\nthe respective parameters.\n\nTeam templates are templates that are available team-wide. Admins may use\nteam templates to create original content for the entire team, monitor version control to ensure templates are always up to date,\nand track template performance across the entire organization. All metrics on a team template reflect usage across the team; individual metrics can be found with the email_templates API endpoint.\n',
      parameters: [
        {
          description:
            "IDs of team templates to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Equality filters that are applied to the updated_at field. A single filter can be used by itself or combined with other filters to create a range.\n\n---CUSTOM---\n{"type":"object","keys":[{"name":"gt","type":"iso8601 string","description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"gte","type":"iso8601 string","description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lt","type":"iso8601 string","description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision."},{"name":"lte","type":"iso8601 string","description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision."}]}\n',
          explode: false,
          in: 'query',
          name: 'updated_at',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters email templates by title or subject',
          in: 'query',
          name: 'search',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Filters email templates by tags applied to the template by tag ID, not to exceed 100 IDs',
          explode: false,
          in: 'query',
          name: 'tag_ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters team templates by tags applied to the template, not to exceed 100 tags',
          explode: false,
          in: 'query',
          name: 'tag',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters email templates to include archived templates or not',
          in: 'query',
          name: 'include_archived_templates',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Key to sort on, must be one of: created_at, updated_at, last_used_at. Defaults to updated_at',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'How many records to show per page in the range [1, 100]. Defaults to 25',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch results from. Defaults to 1',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Specifies whether the max limit of 10k records should be applied to pagination counts. Affects the total_count and total_pages data',
          in: 'query',
          name: 'limit_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/TeamTemplate',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List team templates',
      tags: ['Team Templates'],
    },
  },
  '/v2/team_templates/{id}.json': {
    get: {
      description: 'Fetches a team template, by ID only.\n',
      parameters: [
        {
          description: 'Team Template ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: "Optionally will return the templates with the current user's email signature",
          in: 'query',
          name: 'include_signature',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/TeamTemplate',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a team template',
      tags: ['Team Templates'],
    },
  },
  '/v2/third_party_live_feed_items': {
    post: {
      description:
        'Creates a live feed item that can be sent to users. May only be used by whitelisted Frontend Integrations. Reference the Salesloft App Directory and Frontend Integrations sections for additional details.',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                event_occurred_at: {
                  description:
                    'Equality filters that are applied to the event_occurred_at field. A single filter can be used by itself or combined with other filters to create a range.\n---CUSTOM---\n{"keys":[{"description":"Returns all matching records that are greater than the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"gt","type":"iso8601 string"},{"description":"Returns all matching records that are greater than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"gte","type":"iso8601 string"},{"description":"Returns all matching records that are less than the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"lt","type":"iso8601 string"},{"description":"Returns all matching records that are less than or equal to the provided iso8601 timestamp. The comparison is done using microsecond precision.","name":"lte","type":"iso8601 string"}],"type":"object"}\n',
                  type: 'string',
                },
                idempotency_key: {
                  description:
                    "Uniquely provided string specific to this event. This should be a value which can't be duplicated between external systems, meaning that an id is not sufficient.",
                  type: 'string',
                },
                message: {
                  description:
                    'The message that relates to the subject. This message should start with a lower-case past-tense verb and end with a period (e.g. "received a package."). When live feed items are displayed to users, the subject\'s name is concatenated with the message and a joining space. Only <a> HTML tags with an "href" attribute are allowed. Other attributes and tags will be stripped.',
                  type: 'string',
                },
                subject_id: {
                  description: 'The ID of the subject of the live feed item (i.e. the "person" id).',
                  type: 'integer',
                },
                subject_type: {
                  description: 'The type of the subject of the live feed item. Currently only "person" is supported.',
                  type: 'string',
                },
                user_guid: {
                  description: 'The guid for the user that this live feed item should be shown to.',
                  type: 'string',
                },
              },
              required: ['subject_type', 'subject_id', 'event_occurred_at', 'user_guid', 'message', 'idempotency_key'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/LiveFeedItem',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create a live feed item',
      tags: ['Live Feed Items'],
    },
  },
  '/v2/users.json': {
    get: {
      description:
        'Non Admin: Lists only your user, or all on team depending on group visibility policy\nTeam Admin: Lists users associated with your team\n',
      parameters: [
        {
          description:
            "IDs of users to fetch. If a record can't be found, that record won't be returned and your request will be successful",
          explode: false,
          in: 'query',
          name: 'ids',
          required: false,
          schema: {
            items: {
              type: 'integer',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters list to only include guids',
          explode: false,
          in: 'query',
          name: 'guid',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Filters users by group_id.  An additional value of "_is_null" can be passed to filter users that are not in a group',
          explode: false,
          in: 'query',
          name: 'group_id',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Filters users by role_id',
          explode: false,
          in: 'query',
          name: 'role_id',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Space-separated list of keywords used to find case-insensitive substring matches against First Name, Last Name, or Email',
          in: 'query',
          name: 'search',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Filters users based on active attribute. Defaults to not applied',
          in: 'query',
          name: 'active',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            "Defaults to true.\n\nWhen true, only shows users that are actionable based on the team's privacy settings.\nWhen false, shows all users on the team, even if you can't take action on that user. Deactivated users are also included when false.\n",
          in: 'query',
          name: 'visible_only',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'How many users to show per page in the range [1, 100]. Defaults to 25.  Results are only paginated if the page parameter is defined',
          in: 'query',
          name: 'per_page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'The current page to fetch users from. Defaults to returning all users',
          in: 'query',
          name: 'page',
          required: false,
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Whether to include total_pages and total_count in the metadata. Defaults to false',
          in: 'query',
          name: 'include_paging_counts',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Filters users based on if they have a crm user mapped or not.',
          in: 'query',
          name: 'has_crm_user',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Filters users based on assigned work_country.',
          explode: false,
          in: 'query',
          name: 'work_country',
          required: false,
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description: 'Key to sort on, must be one of: id, email, name, group, role. Defaults to id',
          in: 'query',
          name: 'sort_by',
          required: false,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Direction to sort in, must be one of: ASC, DESC. Defaults to DESC',
          in: 'query',
          name: 'sort_direction',
          required: false,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/User',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List users',
      tags: ['Users'],
    },
  },
  '/v2/users/{id}.json': {
    get: {
      description: 'Fetches a user, by ID only.\n',
      parameters: [
        {
          description: 'User ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/User',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a user',
      tags: ['Users'],
    },
    put: {
      description: 'Updates a user.\n',
      parameters: [
        {
          description: 'User ID',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                active: {
                  description: "Active status of the user's account",
                  type: 'boolean',
                },
                group_id: {
                  description: 'Group assigned to the user',
                  type: 'integer',
                },
                role_id: {
                  description: 'Role assigned to the user. Must be one of: Admin, User, or a custom role ID',
                  type: 'string',
                },
                work_country: {
                  description: "The user's work country (alpha-2 code)",
                  type: 'string',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/User',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Update a user',
      tags: ['Users'],
    },
  },
  '/v2/webhook_subscriptions': {
    get: {
      description: "Fetches all of the customer's webhook subscriptions for your application.",
      parameters: [
        {
          description: 'Filters webhook subscriptions by whether is enabled or not.',
          in: 'query',
          name: 'enabled',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                items: {
                  $ref: '#/components/schemas/Subscription',
                },
                type: 'array',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'List webhook subscriptions',
      tags: ['Webhook Subscriptions'],
    },
    post: {
      description:
        'Creates a webhook subscription. Visit the <a href="/webhooks.html" target="_blank" rel="noopener noreferrer">webhooks page</a> for additional details and a list of available webhooks.\nRequest must be made with a valid Oauth token or API key.',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                callback_token: {
                  description:
                    'Any string to be used as a shared secret when subscription events are published. SalesLoft will send the value of this callback_token in the payload of each event so the receiver may verify it matches the original value. This ensures webhook events are being delivered by SalesLoft.',
                  type: 'string',
                },
                callback_url: {
                  description: 'URL for your callback handler',
                  type: 'string',
                },
                event_type: {
                  description:
                    'Type of event the subscription is for. Visit the "Event Types" section of the webhooks page to find a list of supported event types.',
                  type: 'string',
                },
              },
              required: ['callback_url', 'callback_token', 'event_type'],
              type: 'object',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Subscription',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Create a webhook subscription',
      tags: ['Webhook Subscriptions'],
    },
  },
  '/v2/webhook_subscriptions/{id}': {
    delete: {
      description:
        'Deletes a webhook subscription. This operation is not reversible without contacting support. This operation can be called multiple times successfully.',
      parameters: [
        {
          description: 'The id of the Webhook Subscription to delete',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'integer',
          },
        },
      ],
      responses: {
        '204': {
          description: 'This webhook subscription has been deleted successfully',
        },
      },
      summary: 'Delete a webhook subscription',
      tags: ['Webhook Subscriptions'],
    },
    get: {
      description: 'Fetches a webhook subscription, by ID only.',
      parameters: [
        {
          description: 'The id for the Webhook Subscription',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Subscription',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Fetch a webhook subscription',
      tags: ['Webhook Subscriptions'],
    },
    put: {
      description: 'Updates a webhook subscription.\nRequest must be made with a valid Oauth token or API key.',
      parameters: [
        {
          description: 'The Webhook Suscription id to update',
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'integer',
          },
        },
      ],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                enabled: {
                  description: 'Enable or disable the webhook subscription',
                  type: 'boolean',
                },
              },
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            '*/*': {
              schema: {
                $ref: '#/components/schemas/Subscription',
              },
            },
          },
          description: 'Success',
        },
      },
      summary: 'Update a webhook subscription',
      tags: ['Webhook Subscriptions'],
    },
  },
} as TPaths;
