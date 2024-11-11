// @ts-nocheck
export type TComponents = {
  securitySchemes: {
    oauth2: {
      type: 'oauth2';
      description: 'This API uses OAuth 2.0 with the authorization code grant flow.';
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://app.attio.com/authorize';
          tokenUrl: 'https://app.attio.com/oauth/token';
          scopes: {
            'user_management:read': 'View workspace members.';
            'user_management:read-write': 'View workspace members.';
            'record_permission:read': 'View, and optionally write, records.';
            'record_permission:read-write': 'View, and optionally write, records.';
            'object_configuration:read': 'View, and optionally write, the configuration and attributes of objects.';
            'object_configuration:read-write': 'View, and optionally write, the configuration and attributes of objects.';
            'list_entry:read': 'View, and optionally write, the entries in a list.';
            'list_entry:read-write': 'View, and optionally write, the entries in a list.';
            'list_configuration:read': 'View, and optionally write, the configuration and attributes of lists.';
            'list_configuration:read-write': 'View, and optionally write, the configuration and attributes of lists.';
            'public_collection:read': 'View, and optionally write, both the settings and information within public collections.';
            'public_collection:read-write': 'View, and optionally write, both the settings and information within public collections.';
            'private_collection:read': 'View, and optionally modify, both the settings and information of all collections within the workspace, regardless of their access settings.';
            'private_collection:read-write': 'View, and optionally modify, both the settings and information of all collections within the workspace, regardless of their access settings.';
            'comment:read': 'View comments (and threads), and optionally write comments.';
            'comment:read-write': 'View comments (and threads), and optionally write comments.';
            'task:read': 'View, and optionally write, tasks.';
            'task:read-write': 'View, and optionally write, tasks.';
            'note:read': 'View, and optionally write, notes.';
            'note:read-write': 'View, and optionally write, notes.';
            'webhook:read': 'View, and optionally manage, webhooks.';
            'webhook:read-write': 'View, and optionally manage, webhooks.';
          };
        };
      };
    };
  };
  schemas: {
    status: {
      type: 'object';
      properties: {
        id: {
          type: 'object';
          properties: {
            workspace_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the workspace';
              example: '14beef7a-99f7-4534-a87e-70b564330a4c';
            };
            object_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the object';
              example: '97052eb9-e65e-443f-a297-f2d9a4a7f795';
            };
            attribute_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the attribute';
              example: '41252299-f8c7-4b5e-99c9-4ff8321d2f96';
            };
            status_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the status';
              example: '11f07f01-c10f-4e05-a522-33e050bc52ee';
            };
          };
          required: ['workspace_id', 'object_id', 'attribute_id', 'status_id'];
        };
        title: {
          type: 'string';
          description: 'The title of the status';
          example: 'In Progress';
        };
        is_archived: {
          type: 'boolean';
          description: 'Whether or not to archive the status. See our [archiving guide](/docs/archiving-vs-deleting) for more information on archiving.';
          example: false;
        };
        celebration_enabled: {
          type: 'boolean';
          description: 'Whether arriving at this status triggers a celebration effect in the UI';
          example: false;
        };
        target_time_in_status: {
          type: ['string', 'null'];
          description: 'Target time for a record to spend in given status expressed as a ISO-8601 duration string';
          example: 'P0Y0M1DT0H0M0S';
        };
      };
      required: ['id', 'title', 'is_archived', 'celebration_enabled', 'target_time_in_status'];
    };
    'select-option': {
      type: 'object';
      properties: {
        id: {
          type: 'object';
          properties: {
            workspace_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the workspace';
              example: '14beef7a-99f7-4534-a87e-70b564330a4c';
            };
            object_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the object';
              example: '97052eb9-e65e-443f-a297-f2d9a4a7f795';
            };
            attribute_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the attribute';
              example: '41252299-f8c7-4b5e-99c9-4ff8321d2f96';
            };
            option_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the select option';
              example: '08c2c59a-c18e-40c6-8dc4-95415313b2ea';
            };
          };
          required: ['workspace_id', 'object_id', 'attribute_id', 'option_id'];
        };
        title: {
          type: 'string';
          description: 'The title of the select option';
          example: 'Medium';
        };
        is_archived: {
          type: 'boolean';
          description: 'Whether or not to archive the select option. See our [archiving guide](/docs/archiving-vs-deleting) for more information on archiving.';
          example: false;
        };
      };
      required: ['id', 'title', 'is_archived'];
    };
    'input-value': {
      anyOf: [
        {
          type: 'object';
          properties: {
            referenced_actor_type: {
              type: 'string';
              enum: ['workspace-member'];
              description: 'The type of the referenced actor. Currently, only workspace members can be written into actor reference attributes. [Read more information on actor types here](/docs/actors).';
              example: 'workspace-member';
            };
            referenced_actor_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the referenced Actor.';
              example: '50cf242c-7fa3-4cad-87d0-75b1af71c57b';
            };
          };
          required: ['referenced_actor_type', 'referenced_actor_id'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            workspace_member_email_address: {
              type: 'string';
              description: 'Workspace member actors can be referenced by email address as well as actor ID.';
              example: 'alice@attio.com';
            };
          };
          required: ['workspace_member_email_address'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            value: {
              type: 'boolean';
              description: "A boolean representing whether the checkbox is checked or not. The string values 'true' and 'false' are also accepted.";
              example: true;
            };
          };
          required: ['value'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            currency_value: {
              type: 'number';
              description: 'A numerical representation of the currency value. A decimal with a max of 4 decimal places.';
              example: 99;
            };
          };
          required: ['currency_value'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            value: {
              type: 'string';
              description: 'A date represents a single calendar year, month and day, independent of timezone. If hours, months, seconds or timezones are provided, they will be trimmed. For example, "2023" and "2023-01" will be coerced into "2023-01-01", and "2023-01-02", "2023-01-02T13:00", "2023-01-02T14:00:00", "2023-01-02T15:00:00.000000000", and "2023-01-02T15:00:00.000000000+02:00" will all be coerced to "2023-01-02". If a timezone is provided that would result in a different calendar date in UTC, the date will be coerced to UTC and then the timezone component will be trimmed. For example, the value "2023-01-02T23:00:00-10:00" will be returned as "2023-01-03". The maximum date is "9999-12-31".';
              example: '2023-01-01';
            };
          };
          required: ['value'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            domain: {
              type: 'string';
              description: 'The full domain of the website.';
              example: 'app.attio.com';
            };
          };
        },
        {
          type: 'object';
          properties: {
            email_address: {
              type: 'string';
              description: 'An email address string';
              example: 'alice@app.attio.com';
            };
          };
        },
        {
          type: 'object';
          properties: {
            target_object: {
              type: 'string';
              description: 'A UUID or slug to identify the object that the referenced record belongs to.';
              example: 'people';
            };
            target_record_id: {
              type: 'string';
              format: 'uuid';
              description: 'A UUID to identify the referenced record.';
              example: '891dcbfc-9141-415d-9b2a-2238a6cc012d';
            };
          };
          required: ['target_object', 'target_record_id'];
          additionalProperties: false;
        },
        {
          type: 'object';
          example: {
            target_object: 'people';
            matching_attribute_id_123: [
              {
                value: 'matching_attribute_id_123';
              },
            ];
          };
          properties: {
            target_object: {
              type: 'string';
              example: 'people';
              description: 'A UUID or slug to identify the object that the referenced record belongs to.';
            };
            '[slug_or_id_of_matching_attribute]': {
              type: 'array';
              description: 'In addition to referencing records directly by record ID, you may also reference by a matching attribute of your choice. For example, if you want to add a reference to the person record with email "alice@website.com", you should pass a value with `target_object` set to `"people"` and `email_addresses` set to `[{email_address:"alice@website.com"}]`. The key should be the slug or ID of the matching attribute you would like to use and the value should be an array containing a single value of the appropriate attribute type (as specified below). Matching on multiple values is not currently supported. Matching attributes must be unique. This process is similar to how you use the `matching_attribute` query param in Attio\'s [assert endpoints](/reference/put_v2-objects-object-records).';
              items: {
                anyOf: [
                  {
                    type: 'object';
                    properties: {
                      domain: {
                        type: 'string';
                        example: 'app.attio.com';
                        description: 'The full domain of the website.';
                      };
                    };
                  },
                  {
                    type: 'object';
                    properties: {
                      email_address: {
                        type: 'string';
                        example: 'alice@app.attio.com';
                        description: 'An email address string';
                      };
                    };
                  },
                  {
                    type: 'object';
                    properties: {
                      value: {
                        type: 'number';
                        example: 17224912;
                        description: 'Numbers are persisted as 64 bit floats.';
                      };
                    };
                  },
                  {
                    type: 'object';
                    properties: {
                      original_phone_number: {
                        type: 'string';
                        example: '07234172834';
                        description: 'The raw, original phone number, as inputted.';
                      };
                      country_code: {
                        type: ['string', 'null'];
                        enum: [
                          'AF',
                          'AX',
                          'AL',
                          'DZ',
                          'AS',
                          'AD',
                          'AO',
                          'AI',
                          'AQ',
                          'AG',
                          'AR',
                          'AM',
                          'AW',
                          'AU',
                          'AT',
                          'AZ',
                          'BS',
                          'BH',
                          'BD',
                          'BB',
                          'BY',
                          'BE',
                          'BZ',
                          'BJ',
                          'BM',
                          'BT',
                          'BO',
                          'BA',
                          'BW',
                          'BV',
                          'BR',
                          'IO',
                          'BN',
                          'BG',
                          'BF',
                          'BI',
                          'KH',
                          'CM',
                          'CA',
                          'CV',
                          'KY',
                          'CF',
                          'TD',
                          'CL',
                          'CN',
                          'CX',
                          'CC',
                          'CO',
                          'KM',
                          'CG',
                          'CD',
                          'CK',
                          'CR',
                          'CI',
                          'HR',
                          'CU',
                          'CW',
                          'CY',
                          'CZ',
                          'DK',
                          'DJ',
                          'DM',
                          'DO',
                          'EC',
                          'EG',
                          'SV',
                          'GQ',
                          'ER',
                          'EE',
                          'ET',
                          'FK',
                          'FO',
                          'FJ',
                          'FI',
                          'FR',
                          'GF',
                          'PF',
                          'TF',
                          'GA',
                          'GM',
                          'GE',
                          'DE',
                          'GH',
                          'GI',
                          'GR',
                          'GL',
                          'GD',
                          'GP',
                          'GU',
                          'GT',
                          'GG',
                          'GN',
                          'GW',
                          'GY',
                          'HT',
                          'HM',
                          'VA',
                          'HN',
                          'HK',
                          'HU',
                          'IS',
                          'IN',
                          'ID',
                          'IR',
                          'IQ',
                          'IE',
                          'IM',
                          'IL',
                          'IT',
                          'JM',
                          'JP',
                          'JE',
                          'JO',
                          'KZ',
                          'KE',
                          'KI',
                          'KR',
                          'KW',
                          'KG',
                          'LA',
                          'LV',
                          'LB',
                          'LS',
                          'LR',
                          'LY',
                          'LI',
                          'LT',
                          'LU',
                          'MO',
                          'MK',
                          'MG',
                          'MW',
                          'MY',
                          'MV',
                          'ML',
                          'MT',
                          'MH',
                          'MQ',
                          'MR',
                          'MU',
                          'YT',
                          'MX',
                          'FM',
                          'MD',
                          'MC',
                          'MN',
                          'ME',
                          'MS',
                          'MA',
                          'MZ',
                          'MM',
                          'NA',
                          'NR',
                          'NP',
                          'NL',
                          'AN',
                          'NC',
                          'NZ',
                          'NI',
                          'NE',
                          'NG',
                          'NU',
                          'NF',
                          'MP',
                          'NO',
                          'OM',
                          'PK',
                          'PW',
                          'PS',
                          'PA',
                          'PG',
                          'PY',
                          'PE',
                          'PH',
                          'PN',
                          'PL',
                          'PT',
                          'PR',
                          'QA',
                          'RE',
                          'RO',
                          'RU',
                          'RW',
                          'BL',
                          'SH',
                          'KN',
                          'LC',
                          'MF',
                          'PM',
                          'VC',
                          'WS',
                          'SM',
                          'ST',
                          'SA',
                          'SN',
                          'RS',
                          'SC',
                          'SL',
                          'SG',
                          'SK',
                          'SI',
                          'SB',
                          'SO',
                          'ZA',
                          'GS',
                          'ES',
                          'LK',
                          'SD',
                          'SR',
                          'SJ',
                          'SZ',
                          'SE',
                          'CH',
                          'SY',
                          'TW',
                          'TJ',
                          'TZ',
                          'TH',
                          'TL',
                          'TG',
                          'TK',
                          'TO',
                          'TT',
                          'TN',
                          'TR',
                          'TM',
                          'TC',
                          'TV',
                          'UG',
                          'UA',
                          'AE',
                          'GB',
                          'US',
                          'UM',
                          'UY',
                          'UZ',
                          'VU',
                          'VE',
                          'VN',
                          'VG',
                          'VI',
                          'WF',
                          'EH',
                          'YE',
                          'ZM',
                          'ZW',
                        ];
                        example: 'GB';
                        description: 'The ISO 3166-1 alpha-2 country code representing the country that this phone number belongs to.';
                      };
                    };
                  },
                  {
                    type: 'object';
                    properties: {
                      value: {
                        type: 'string';
                        description: 'A raw text field. Values are limited to 10MB.';
                      };
                    };
                  },
                ];
              };
            };
          };
          required: ['target_object', '[slug_or_id_of_matching_attribute]'];
        },
        {
          type: 'object';
          properties: {
            interaction_type: {
              type: 'string';
              enum: ['calendar-event', 'call', 'chat-thread', 'email', 'in-person-meeting'];
              description: 'The type of interaction e.g. calendar or email.';
              example: 'email';
            };
            interacted_at: {
              type: 'string';
              format: 'date-time';
              description: 'When the interaction occurred.';
              example: '2023-01-01T15:00:00.000000000Z';
            };
            owner_actor: {
              type: 'object';
              description: 'The actor that created this value.';
              properties: {
                id: {
                  type: 'string';
                  description: 'An ID to identify the actor.';
                  nullable: true;
                };
                type: {
                  type: 'string';
                  enum: ['api-token', 'workspace-member', 'system'];
                  nullable: true;
                  description: 'The type of actor. [Read more information on actor types here](/docs/actors).';
                };
              };
              example: {
                type: 'workspace-member';
                id: '50cf242c-7fa3-4cad-87d0-75b1af71c57b';
              };
            };
          };
          required: ['interaction_type', 'interacted_at', 'owner_actor'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            line_1: {
              type: ['string', 'null'];
              description: 'The first line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.';
              example: '1 Infinite Loop';
            };
            line_2: {
              type: ['string', 'null'];
              description: 'The second line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.';
              example: 'Block 1';
            };
            line_3: {
              type: ['string', 'null'];
              description: 'The third line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.';
              example: 'Hilldrop Estate';
            };
            line_4: {
              type: ['string', 'null'];
              description: 'The fourth line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.';
              example: 'Westborough';
            };
            locality: {
              type: ['string', 'null'];
              description: 'The town, neighborhood or area the location is in.';
              example: 'Cupertino';
            };
            region: {
              type: ['string', 'null'];
              description: 'The state, county, province or region that the location is in.';
              example: 'CA';
            };
            postcode: {
              type: ['string', 'null'];
              description: 'The postcode or zip code for the location. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.}';
              example: '95014';
            };
            country_code: {
              type: ['string', 'null'];
              enum: [
                'AF',
                'AX',
                'AL',
                'DZ',
                'AS',
                'AD',
                'AO',
                'AI',
                'AQ',
                'AG',
                'AR',
                'AM',
                'AW',
                'AU',
                'AT',
                'AZ',
                'BS',
                'BH',
                'BD',
                'BB',
                'BY',
                'BE',
                'BZ',
                'BJ',
                'BM',
                'BT',
                'BO',
                'BA',
                'BW',
                'BV',
                'BR',
                'IO',
                'BN',
                'BG',
                'BF',
                'BI',
                'KH',
                'CM',
                'CA',
                'CV',
                'KY',
                'CF',
                'TD',
                'CL',
                'CN',
                'CX',
                'CC',
                'CO',
                'KM',
                'CG',
                'CD',
                'CK',
                'CR',
                'CI',
                'HR',
                'CU',
                'CW',
                'CY',
                'CZ',
                'DK',
                'DJ',
                'DM',
                'DO',
                'EC',
                'EG',
                'SV',
                'GQ',
                'ER',
                'EE',
                'ET',
                'FK',
                'FO',
                'FJ',
                'FI',
                'FR',
                'GF',
                'PF',
                'TF',
                'GA',
                'GM',
                'GE',
                'DE',
                'GH',
                'GI',
                'GR',
                'GL',
                'GD',
                'GP',
                'GU',
                'GT',
                'GG',
                'GN',
                'GW',
                'GY',
                'HT',
                'HM',
                'VA',
                'HN',
                'HK',
                'HU',
                'IS',
                'IN',
                'ID',
                'IR',
                'IQ',
                'IE',
                'IM',
                'IL',
                'IT',
                'JM',
                'JP',
                'JE',
                'JO',
                'KZ',
                'KE',
                'KI',
                'KR',
                'KW',
                'KG',
                'LA',
                'LV',
                'LB',
                'LS',
                'LR',
                'LY',
                'LI',
                'LT',
                'LU',
                'MO',
                'MK',
                'MG',
                'MW',
                'MY',
                'MV',
                'ML',
                'MT',
                'MH',
                'MQ',
                'MR',
                'MU',
                'YT',
                'MX',
                'FM',
                'MD',
                'MC',
                'MN',
                'ME',
                'MS',
                'MA',
                'MZ',
                'MM',
                'NA',
                'NR',
                'NP',
                'NL',
                'AN',
                'NC',
                'NZ',
                'NI',
                'NE',
                'NG',
                'NU',
                'NF',
                'MP',
                'NO',
                'OM',
                'PK',
                'PW',
                'PS',
                'PA',
                'PG',
                'PY',
                'PE',
                'PH',
                'PN',
                'PL',
                'PT',
                'PR',
                'QA',
                'RE',
                'RO',
                'RU',
                'RW',
                'BL',
                'SH',
                'KN',
                'LC',
                'MF',
                'PM',
                'VC',
                'WS',
                'SM',
                'ST',
                'SA',
                'SN',
                'RS',
                'SC',
                'SL',
                'SG',
                'SK',
                'SI',
                'SB',
                'SO',
                'ZA',
                'GS',
                'ES',
                'LK',
                'SD',
                'SR',
                'SJ',
                'SZ',
                'SE',
                'CH',
                'SY',
                'TW',
                'TJ',
                'TZ',
                'TH',
                'TL',
                'TG',
                'TK',
                'TO',
                'TT',
                'TN',
                'TR',
                'TM',
                'TC',
                'TV',
                'UG',
                'UA',
                'AE',
                'GB',
                'US',
                'UM',
                'UY',
                'UZ',
                'VU',
                'VE',
                'VN',
                'VG',
                'VI',
                'WF',
                'EH',
                'YE',
                'ZM',
                'ZW',
              ];
              description: 'The ISO 3166-1 alpha-2 country code for the country this location is in.';
              example: 'US';
            };
            latitude: {
              type: ['string', 'null'];
              pattern: '^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?)$';
              description: 'The latitude of the location. Validated by the regular expression `/^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?)$/`. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.}';
              example: '37.331741';
            };
            longitude: {
              type: ['string', 'null'];
              pattern: '^[-+]?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$';
              description: 'The longitude of the location. Validated by the regular expression `/^[-+]?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$/`';
              example: '-122.030333';
            };
          };
          required: [
            'line_1',
            'line_2',
            'line_3',
            'line_4',
            'locality',
            'region',
            'postcode',
            'country_code',
            'latitude',
            'longitude',
          ];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            value: {
              type: 'number';
              description: 'Numbers are persisted as 64 bit floats.';
              example: 42;
            };
          };
          required: ['value'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            first_name: {
              type: 'string';
              example: 'Ada';
              description: 'The first name.';
            };
            last_name: {
              type: 'string';
              example: 'Lovelace';
              description: 'The last name.';
            };
            full_name: {
              type: 'string';
              example: 'Ada Lovelace';
              description: 'The full name.';
            };
          };
        },
        {
          type: 'object';
          required: ['original_phone_number'];
          properties: {
            original_phone_number: {
              type: 'string';
              example: '+15558675309';
              description: 'A phone number which is either a) prefixed with a country code (e.g. `+44....`) or b) a local number, where `country_code` is specified in addition.';
            };
            country_code: {
              type: ['string', 'null'];
              enum: [
                'AF',
                'AX',
                'AL',
                'DZ',
                'AS',
                'AD',
                'AO',
                'AI',
                'AQ',
                'AG',
                'AR',
                'AM',
                'AW',
                'AU',
                'AT',
                'AZ',
                'BS',
                'BH',
                'BD',
                'BB',
                'BY',
                'BE',
                'BZ',
                'BJ',
                'BM',
                'BT',
                'BO',
                'BA',
                'BW',
                'BV',
                'BR',
                'IO',
                'BN',
                'BG',
                'BF',
                'BI',
                'KH',
                'CM',
                'CA',
                'CV',
                'KY',
                'CF',
                'TD',
                'CL',
                'CN',
                'CX',
                'CC',
                'CO',
                'KM',
                'CG',
                'CD',
                'CK',
                'CR',
                'CI',
                'HR',
                'CU',
                'CW',
                'CY',
                'CZ',
                'DK',
                'DJ',
                'DM',
                'DO',
                'EC',
                'EG',
                'SV',
                'GQ',
                'ER',
                'EE',
                'ET',
                'FK',
                'FO',
                'FJ',
                'FI',
                'FR',
                'GF',
                'PF',
                'TF',
                'GA',
                'GM',
                'GE',
                'DE',
                'GH',
                'GI',
                'GR',
                'GL',
                'GD',
                'GP',
                'GU',
                'GT',
                'GG',
                'GN',
                'GW',
                'GY',
                'HT',
                'HM',
                'VA',
                'HN',
                'HK',
                'HU',
                'IS',
                'IN',
                'ID',
                'IR',
                'IQ',
                'IE',
                'IM',
                'IL',
                'IT',
                'JM',
                'JP',
                'JE',
                'JO',
                'KZ',
                'KE',
                'KI',
                'KR',
                'KW',
                'KG',
                'LA',
                'LV',
                'LB',
                'LS',
                'LR',
                'LY',
                'LI',
                'LT',
                'LU',
                'MO',
                'MK',
                'MG',
                'MW',
                'MY',
                'MV',
                'ML',
                'MT',
                'MH',
                'MQ',
                'MR',
                'MU',
                'YT',
                'MX',
                'FM',
                'MD',
                'MC',
                'MN',
                'ME',
                'MS',
                'MA',
                'MZ',
                'MM',
                'NA',
                'NR',
                'NP',
                'NL',
                'AN',
                'NC',
                'NZ',
                'NI',
                'NE',
                'NG',
                'NU',
                'NF',
                'MP',
                'NO',
                'OM',
                'PK',
                'PW',
                'PS',
                'PA',
                'PG',
                'PY',
                'PE',
                'PH',
                'PN',
                'PL',
                'PT',
                'PR',
                'QA',
                'RE',
                'RO',
                'RU',
                'RW',
                'BL',
                'SH',
                'KN',
                'LC',
                'MF',
                'PM',
                'VC',
                'WS',
                'SM',
                'ST',
                'SA',
                'SN',
                'RS',
                'SC',
                'SL',
                'SG',
                'SK',
                'SI',
                'SB',
                'SO',
                'ZA',
                'GS',
                'ES',
                'LK',
                'SD',
                'SR',
                'SJ',
                'SZ',
                'SE',
                'CH',
                'SY',
                'TW',
                'TJ',
                'TZ',
                'TH',
                'TL',
                'TG',
                'TK',
                'TO',
                'TT',
                'TN',
                'TR',
                'TM',
                'TC',
                'TV',
                'UG',
                'UA',
                'AE',
                'GB',
                'US',
                'UM',
                'UY',
                'UZ',
                'VU',
                'VE',
                'VN',
                'VG',
                'VI',
                'WF',
                'EH',
                'YE',
                'ZM',
                'ZW',
              ];
              example: 'GB';
              description: 'The ISO 3166-1 alpha-2 country code representing the country that this phone number belongs to. Optional if `original_phone_number` includes a country code prefix.';
            };
          };
        },
        {
          type: 'object';
          properties: {
            status: {
              type: 'string';
              minLength: 1;
              description: 'The UUID or status title identifying the selected status.';
              example: 'In Progress';
            };
          };
          required: ['status'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            value: {
              type: 'number';
              description: 'A number between 0 and 5 (inclusive) to represent a star rating.';
              example: 3;
            };
          };
          required: ['value'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            option: {
              type: 'string';
              minLength: 1;
              description: 'The UUID or select option title identifying the selected select option.';
              example: 'Medium';
            };
          };
          required: ['option'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            value: {
              type: 'string';
              description: 'A raw text field. Values are limited to 10MB.';
              example: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
            };
          };
          required: ['value'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            value: {
              type: 'string';
              description: 'A timestamp value represents a single, universal moment in time using an ISO 8601 formatted string. This means that a timestamp consists of a date, a time (with nanosecond precision), and a time zone. Attio will coerce timestamps which do not provide full nanosecond precision and UTC is assumed if no time zone is provided. For example, "2023", "2023-01", "2023-01-02", "2023-01-02T13:00", "2023-01-02T13:00:00", and "2023-01-02T13:00:00.000000000" will all be coerced to "2023-01-02T13:00:00.000000000Z". Timestamps are always returned in UTC. For example, writing a timestamp value using the string "2023-01-02T13:00:00.000000000+02:00" will result in the value "2023-01-02T11:00:00.000000000Z" being returned. The maximum date is "9999-12-31T23:59:59.999999999Z".';
              format: 'date';
              example: '2023-01-01T15:00:00.000000000Z';
            };
          };
          required: ['value'];
          additionalProperties: false;
        },
      ];
      description: 'A union of possible value types, as required in request bodies.';
    };
    'output-value': {
      anyOf: [
        {
          type: 'object';
          properties: {
            referenced_actor_type: {
              type: 'string';
              enum: ['api-token', 'workspace-member', 'system'];
              description: 'The type of the referenced actor. [Read more information on actor types here](/docs/actors).';
              example: 'workspace-member';
            };
            referenced_actor_id: {
              type: ['string', 'null'];
              format: 'uuid';
              description: 'The ID of the referenced actor.';
              example: '50cf242c-7fa3-4cad-87d0-75b1af71c57b';
            };
            attribute_type: {
              type: 'string';
              enum: ['actor-reference'];
              description: 'The attribute type of the value.';
              example: 'actor-reference';
            };
          };
          required: ['referenced_actor_type', 'referenced_actor_id', 'attribute_type'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            value: {
              type: 'boolean';
              description: "A boolean representing whether the checkbox is checked or not. The string values 'true' and 'false' are also accepted.";
              example: true;
            };
            attribute_type: {
              type: 'string';
              enum: ['checkbox'];
              description: 'The attribute type of the value.';
              example: 'checkbox';
            };
          };
          required: ['value', 'attribute_type'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            currency_value: {
              type: 'number';
              description: 'A numerical representation of the currency value. A decimal with a max of 4 decimal places.';
              example: 99;
            };
            currency_code: {
              type: ['string', 'null'];
              enum: [
                'EUR',
                'GBP',
                'USD',
                'CAD',
                'AUD',
                'NZD',
                'AED',
                'INR',
                'CHF',
                'JPY',
                'CNY',
                'PHP',
                'ILS',
                'SGD',
                'HKD',
                'MYR',
                'NTD',
                'NOK',
                'SEK',
                'ISK',
                'BEL',
                'PLN',
                'KRW',
                'DKK',
                'BRL',
              ];
              description: 'The ISO4217 currency code representing the currency that the value is stored in.';
              example: 'USD';
            };
            attribute_type: {
              type: 'string';
              enum: ['currency'];
              description: 'The attribute type of the value.';
              example: 'currency';
            };
          };
          required: ['currency_value', 'attribute_type'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            attribute_type: {
              type: 'string';
              enum: ['date'];
              description: 'The attribute type of the value.';
              example: 'date';
            };
            value: {
              type: 'string';
              description: 'A date represents a single calendar year, month and day, independent of timezone. If hours, months, seconds or timezones are provided, they will be trimmed. For example, "2023" and "2023-01" will be coerced into "2023-01-01", and "2023-01-02", "2023-01-02T13:00", "2023-01-02T14:00:00", "2023-01-02T15:00:00.000000000", and "2023-01-02T15:00:00.000000000+02:00" will all be coerced to "2023-01-02". If a timezone is provided that would result in a different calendar date in UTC, the date will be coerced to UTC and then the timezone component will be trimmed. For example, the value "2023-01-02T23:00:00-10:00" will be returned as "2023-01-03". The maximum date is "9999-12-31".';
              example: '2023-01-01';
            };
          };
          required: ['attribute_type', 'value'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            domain: {
              type: 'string';
              example: 'app.attio.com';
            };
            root_domain: {
              type: 'string';
              example: 'attio.com';
            };
            attribute_type: {
              type: 'string';
              enum: ['domain'];
              description: 'The attribute type of the value.';
              example: 'domain';
            };
          };
          required: ['domain', 'root_domain', 'attribute_type'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            original_email_address: {
              type: 'string';
              example: 'alice@app.attio.com';
            };
            email_address: {
              type: 'string';
              example: 'alice@app.attio.com';
            };
            email_domain: {
              type: 'string';
              example: 'app.attio.com';
            };
            email_root_domain: {
              type: 'string';
              example: 'attio.com';
            };
            email_local_specifier: {
              type: 'string';
              example: 'alice';
            };
            attribute_type: {
              type: 'string';
              enum: ['email-address'];
              description: 'The attribute type of the value.';
              example: 'email-address';
            };
          };
          required: [
            'original_email_address',
            'email_address',
            'email_domain',
            'email_root_domain',
            'email_local_specifier',
            'attribute_type',
          ];
        },
        {
          type: 'object';
          properties: {
            target_object: {
              type: 'string';
              description: 'A slug identifying the object that the referenced record belongs to.';
              example: 'people';
            };
            target_record_id: {
              type: 'string';
              format: 'uuid';
              description: 'A UUID to identify the referenced record.';
              example: '891dcbfc-9141-415d-9b2a-2238a6cc012d';
            };
            attribute_type: {
              type: 'string';
              enum: ['record-reference'];
              description: 'The attribute type of the value.';
              example: 'record-reference';
            };
          };
          required: ['target_object', 'target_record_id', 'attribute_type'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            interaction_type: {
              type: 'string';
              enum: ['calendar-event', 'call', 'chat-thread', 'email', 'in-person-meeting'];
              description: 'The type of interaction e.g. calendar or email.';
              example: 'email';
            };
            interacted_at: {
              type: 'string';
              format: 'date-time';
              description: 'When the interaction occurred.';
              example: '2023-01-01T15:00:00.000000000Z';
            };
            owner_actor: {
              type: 'object';
              description: 'The actor that created this value.';
              properties: {
                id: {
                  type: 'string';
                  description: 'An ID to identify the actor.';
                  nullable: true;
                };
                type: {
                  type: 'string';
                  enum: ['api-token', 'workspace-member', 'system'];
                  nullable: true;
                  description: 'The type of actor. [Read more information on actor types here](/docs/actors).';
                };
              };
              example: {
                type: 'workspace-member';
                id: '50cf242c-7fa3-4cad-87d0-75b1af71c57b';
              };
            };
            attribute_type: {
              type: 'string';
              enum: ['interaction'];
              description: 'The attribute type of the value.';
              example: 'interaction';
            };
          };
          required: ['interaction_type', 'interacted_at', 'owner_actor', 'attribute_type'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            line_1: {
              type: ['string', 'null'];
              description: 'The first line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.';
              example: '1 Infinite Loop';
            };
            line_2: {
              type: ['string', 'null'];
              description: 'The second line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.';
              example: 'Block 1';
            };
            line_3: {
              type: ['string', 'null'];
              description: 'The third line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.';
              example: 'Hilldrop Estate';
            };
            line_4: {
              type: ['string', 'null'];
              description: 'The fourth line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.';
              example: 'Westborough';
            };
            locality: {
              type: ['string', 'null'];
              description: 'The town, neighborhood or area the location is in.';
              example: 'Cupertino';
            };
            region: {
              type: ['string', 'null'];
              description: 'The state, county, province or region that the location is in.';
              example: 'CA';
            };
            postcode: {
              type: ['string', 'null'];
              description: 'The postcode or zip code for the location. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.}';
              example: '95014';
            };
            country_code: {
              type: ['string', 'null'];
              enum: [
                'AF',
                'AX',
                'AL',
                'DZ',
                'AS',
                'AD',
                'AO',
                'AI',
                'AQ',
                'AG',
                'AR',
                'AM',
                'AW',
                'AU',
                'AT',
                'AZ',
                'BS',
                'BH',
                'BD',
                'BB',
                'BY',
                'BE',
                'BZ',
                'BJ',
                'BM',
                'BT',
                'BO',
                'BA',
                'BW',
                'BV',
                'BR',
                'IO',
                'BN',
                'BG',
                'BF',
                'BI',
                'KH',
                'CM',
                'CA',
                'CV',
                'KY',
                'CF',
                'TD',
                'CL',
                'CN',
                'CX',
                'CC',
                'CO',
                'KM',
                'CG',
                'CD',
                'CK',
                'CR',
                'CI',
                'HR',
                'CU',
                'CW',
                'CY',
                'CZ',
                'DK',
                'DJ',
                'DM',
                'DO',
                'EC',
                'EG',
                'SV',
                'GQ',
                'ER',
                'EE',
                'ET',
                'FK',
                'FO',
                'FJ',
                'FI',
                'FR',
                'GF',
                'PF',
                'TF',
                'GA',
                'GM',
                'GE',
                'DE',
                'GH',
                'GI',
                'GR',
                'GL',
                'GD',
                'GP',
                'GU',
                'GT',
                'GG',
                'GN',
                'GW',
                'GY',
                'HT',
                'HM',
                'VA',
                'HN',
                'HK',
                'HU',
                'IS',
                'IN',
                'ID',
                'IR',
                'IQ',
                'IE',
                'IM',
                'IL',
                'IT',
                'JM',
                'JP',
                'JE',
                'JO',
                'KZ',
                'KE',
                'KI',
                'KR',
                'KW',
                'KG',
                'LA',
                'LV',
                'LB',
                'LS',
                'LR',
                'LY',
                'LI',
                'LT',
                'LU',
                'MO',
                'MK',
                'MG',
                'MW',
                'MY',
                'MV',
                'ML',
                'MT',
                'MH',
                'MQ',
                'MR',
                'MU',
                'YT',
                'MX',
                'FM',
                'MD',
                'MC',
                'MN',
                'ME',
                'MS',
                'MA',
                'MZ',
                'MM',
                'NA',
                'NR',
                'NP',
                'NL',
                'AN',
                'NC',
                'NZ',
                'NI',
                'NE',
                'NG',
                'NU',
                'NF',
                'MP',
                'NO',
                'OM',
                'PK',
                'PW',
                'PS',
                'PA',
                'PG',
                'PY',
                'PE',
                'PH',
                'PN',
                'PL',
                'PT',
                'PR',
                'QA',
                'RE',
                'RO',
                'RU',
                'RW',
                'BL',
                'SH',
                'KN',
                'LC',
                'MF',
                'PM',
                'VC',
                'WS',
                'SM',
                'ST',
                'SA',
                'SN',
                'RS',
                'SC',
                'SL',
                'SG',
                'SK',
                'SI',
                'SB',
                'SO',
                'ZA',
                'GS',
                'ES',
                'LK',
                'SD',
                'SR',
                'SJ',
                'SZ',
                'SE',
                'CH',
                'SY',
                'TW',
                'TJ',
                'TZ',
                'TH',
                'TL',
                'TG',
                'TK',
                'TO',
                'TT',
                'TN',
                'TR',
                'TM',
                'TC',
                'TV',
                'UG',
                'UA',
                'AE',
                'GB',
                'US',
                'UM',
                'UY',
                'UZ',
                'VU',
                'VE',
                'VN',
                'VG',
                'VI',
                'WF',
                'EH',
                'YE',
                'ZM',
                'ZW',
              ];
              description: 'The ISO 3166-1 alpha-2 country code for the country this location is in.';
              example: 'US';
            };
            latitude: {
              type: ['string', 'null'];
              pattern: '^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?)$';
              description: 'The latitude of the location. Validated by the regular expression `/^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?)$/`. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.}';
              example: '37.331741';
            };
            longitude: {
              type: ['string', 'null'];
              pattern: '^[-+]?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$';
              description: 'The longitude of the location. Validated by the regular expression `/^[-+]?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$/`';
              example: '-122.030333';
            };
            attribute_type: {
              type: 'string';
              enum: ['location'];
              description: 'The attribute type of the value.';
              example: 'location';
            };
          };
          required: [
            'line_1',
            'line_2',
            'line_3',
            'line_4',
            'locality',
            'region',
            'postcode',
            'country_code',
            'latitude',
            'longitude',
            'attribute_type',
          ];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            value: {
              type: 'number';
              description: 'Numbers are persisted as 64 bit floats.';
              example: 42;
            };
            attribute_type: {
              type: 'string';
              enum: ['number'];
              description: 'The attribute type of the value.';
              example: 'number';
            };
          };
          required: ['value', 'attribute_type'];
        },
        {
          type: 'object';
          properties: {
            first_name: {
              type: 'string';
              description: 'The first name.';
              example: 'Ada';
            };
            last_name: {
              type: 'string';
              description: 'The last name.';
              example: 'Lovelace';
            };
            full_name: {
              type: 'string';
              description: 'The full name.';
              example: 'Ada Lovelace';
            };
            attribute_type: {
              type: 'string';
              enum: ['personal-name'];
              description: 'The attribute type of the value.';
              example: 'personal-name';
            };
          };
          required: ['first_name', 'last_name', 'full_name', 'attribute_type'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            original_phone_number: {
              type: 'string';
              description: 'The raw, original phone number, as inputted.';
              example: '5558675309';
            };
            country_code: {
              type: 'string';
              description: 'The ISO 3166-1 alpha-2 country code representing the country that this phone number belongs to.';
              enum: [
                'AF',
                'AX',
                'AL',
                'DZ',
                'AS',
                'AD',
                'AO',
                'AI',
                'AQ',
                'AG',
                'AR',
                'AM',
                'AW',
                'AU',
                'AT',
                'AZ',
                'BS',
                'BH',
                'BD',
                'BB',
                'BY',
                'BE',
                'BZ',
                'BJ',
                'BM',
                'BT',
                'BO',
                'BA',
                'BW',
                'BV',
                'BR',
                'IO',
                'BN',
                'BG',
                'BF',
                'BI',
                'KH',
                'CM',
                'CA',
                'CV',
                'KY',
                'CF',
                'TD',
                'CL',
                'CN',
                'CX',
                'CC',
                'CO',
                'KM',
                'CG',
                'CD',
                'CK',
                'CR',
                'CI',
                'HR',
                'CU',
                'CW',
                'CY',
                'CZ',
                'DK',
                'DJ',
                'DM',
                'DO',
                'EC',
                'EG',
                'SV',
                'GQ',
                'ER',
                'EE',
                'ET',
                'FK',
                'FO',
                'FJ',
                'FI',
                'FR',
                'GF',
                'PF',
                'TF',
                'GA',
                'GM',
                'GE',
                'DE',
                'GH',
                'GI',
                'GR',
                'GL',
                'GD',
                'GP',
                'GU',
                'GT',
                'GG',
                'GN',
                'GW',
                'GY',
                'HT',
                'HM',
                'VA',
                'HN',
                'HK',
                'HU',
                'IS',
                'IN',
                'ID',
                'IR',
                'IQ',
                'IE',
                'IM',
                'IL',
                'IT',
                'JM',
                'JP',
                'JE',
                'JO',
                'KZ',
                'KE',
                'KI',
                'KR',
                'KW',
                'KG',
                'LA',
                'LV',
                'LB',
                'LS',
                'LR',
                'LY',
                'LI',
                'LT',
                'LU',
                'MO',
                'MK',
                'MG',
                'MW',
                'MY',
                'MV',
                'ML',
                'MT',
                'MH',
                'MQ',
                'MR',
                'MU',
                'YT',
                'MX',
                'FM',
                'MD',
                'MC',
                'MN',
                'ME',
                'MS',
                'MA',
                'MZ',
                'MM',
                'NA',
                'NR',
                'NP',
                'NL',
                'AN',
                'NC',
                'NZ',
                'NI',
                'NE',
                'NG',
                'NU',
                'NF',
                'MP',
                'NO',
                'OM',
                'PK',
                'PW',
                'PS',
                'PA',
                'PG',
                'PY',
                'PE',
                'PH',
                'PN',
                'PL',
                'PT',
                'PR',
                'QA',
                'RE',
                'RO',
                'RU',
                'RW',
                'BL',
                'SH',
                'KN',
                'LC',
                'MF',
                'PM',
                'VC',
                'WS',
                'SM',
                'ST',
                'SA',
                'SN',
                'RS',
                'SC',
                'SL',
                'SG',
                'SK',
                'SI',
                'SB',
                'SO',
                'ZA',
                'GS',
                'ES',
                'LK',
                'SD',
                'SR',
                'SJ',
                'SZ',
                'SE',
                'CH',
                'SY',
                'TW',
                'TJ',
                'TZ',
                'TH',
                'TL',
                'TG',
                'TK',
                'TO',
                'TT',
                'TN',
                'TR',
                'TM',
                'TC',
                'TV',
                'UG',
                'UA',
                'AE',
                'GB',
                'US',
                'UM',
                'UY',
                'UZ',
                'VU',
                'VE',
                'VN',
                'VG',
                'VI',
                'WF',
                'EH',
                'YE',
                'ZM',
                'ZW',
              ];
              example: 'US';
            };
            phone_number: {
              type: 'string';
              example: '+15558675309';
            };
            attribute_type: {
              type: 'string';
              enum: ['phone-number'];
              description: 'The attribute type of the value.';
              example: 'phone-number';
            };
          };
          required: ['original_phone_number', 'country_code', 'phone_number', 'attribute_type'];
        },
        {
          type: 'object';
          properties: {
            status: {
              type: 'string';
              format: 'uuid';
              description: 'The UUID identifying the selected status.';
              example: '11f07f01-c10f-4e05-a522-33e050bc52ee';
            };
            attribute_type: {
              type: 'string';
              enum: ['status'];
              description: 'The attribute type of the value.';
              example: 'status';
            };
          };
          required: ['status', 'attribute_type'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            status: {
              $ref: '#/components/schemas/status';
            };
            attribute_type: {
              type: 'string';
              enum: ['status'];
              description: 'The attribute type of the value.';
              example: 'status';
            };
          };
          required: ['status', 'attribute_type'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            value: {
              type: 'number';
              description: 'A number between 0 and 5 (inclusive) to represent a star rating.';
              example: 3;
            };
            attribute_type: {
              type: 'string';
              enum: ['rating'];
              description: 'The attribute type of the value.';
              example: 'rating';
            };
          };
          required: ['value', 'attribute_type'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            option: {
              type: 'string';
              format: 'uuid';
              description: 'The UUID identifying the selected select option.';
              example: '08c2c59a-c18e-40c6-8dc4-95415313b2ea';
            };
            attribute_type: {
              type: 'string';
              enum: ['select'];
              description: 'The attribute type of the value.';
              example: 'select';
            };
          };
          required: ['option', 'attribute_type'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            option: {
              $ref: '#/components/schemas/select-option';
            };
            attribute_type: {
              type: 'string';
              enum: ['select'];
              description: 'The attribute type of the value.';
              example: 'select';
            };
          };
          required: ['option', 'attribute_type'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            value: {
              type: 'string';
              description: 'A raw text field. Values are limited to 10MB.';
              example: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
            };
            attribute_type: {
              type: 'string';
              enum: ['text'];
              description: 'The attribute type of the value.';
              example: 'text';
            };
          };
          required: ['value', 'attribute_type'];
          additionalProperties: false;
        },
        {
          type: 'object';
          properties: {
            attribute_type: {
              type: 'string';
              enum: ['timestamp'];
              description: 'The attribute type of the value.';
              example: 'timestamp';
            };
            value: {
              type: 'string';
              description: 'A timestamp value represents a single, universal moment in time using an ISO 8601 formatted string. This means that a timestamp consists of a date, a time (with nanosecond precision), and a time zone. Attio will coerce timestamps which do not provide full nanosecond precision and UTC is assumed if no time zone is provided. For example, "2023", "2023-01", "2023-01-02", "2023-01-02T13:00", "2023-01-02T13:00:00", and "2023-01-02T13:00:00.000000000" will all be coerced to "2023-01-02T13:00:00.000000000Z". Timestamps are always returned in UTC. For example, writing a timestamp value using the string "2023-01-02T13:00:00.000000000+02:00" will result in the value "2023-01-02T11:00:00.000000000Z" being returned. The maximum date is "9999-12-31T23:59:59.999999999Z".';
              format: 'date';
              example: '2023-01-01T15:00:00.000000000Z';
            };
          };
          required: ['attribute_type', 'value'];
          additionalProperties: false;
        },
      ];
      description: 'A union of possible value types, as returned in response bodies.';
    };
    attribute: {
      type: 'object';
      properties: {
        id: {
          type: 'object';
          properties: {
            workspace_id: {
              type: 'string';
              format: 'uuid';
              description: 'A UUID representing the workspace this attribute belongs to.';
              example: '14beef7a-99f7-4534-a87e-70b564330a4c';
            };
            object_id: {
              type: 'string';
              format: 'uuid';
              description: 'A UUID to identify the object or list that this attribute belongs to';
              example: '97052eb9-e65e-443f-a297-f2d9a4a7f795';
            };
            attribute_id: {
              type: 'string';
              format: 'uuid';
              description: 'A UUID to identify this attribute.';
              example: '41252299-f8c7-4b5e-99c9-4ff8321d2f96';
            };
          };
          required: ['workspace_id', 'object_id', 'attribute_id'];
        };
        title: {
          type: 'string';
          description: 'A title for the attribute, to be displayed across the app.';
          example: 'Rating';
        };
        description: {
          type: ['string', 'null'];
          description: 'A text description of the attribute.';
          example: 'A rating attribute';
        };
        api_slug: {
          type: 'string';
          description: 'A unique slug for the attribute for use in API responses and URLs. Formatted in snake case.';
          example: 'my-rating';
        };
        type: {
          type: 'string';
          enum: [
            'text',
            'number',
            'checkbox',
            'currency',
            'date',
            'timestamp',
            'rating',
            'status',
            'select',
            'record-reference',
            'actor-reference',
            'location',
            'domain',
            'email-address',
            'phone-number',
            'interaction',
            'personal-name',
          ];
          description: 'The type of the attribute.';
          example: 'text';
        };
        is_system_attribute: {
          type: 'boolean';
          description: '`true` if this is an Attio system-defined attribute, `false` if defined by a user or non-Attio system.';
          example: true;
        };
        is_writable: {
          type: 'boolean';
          description: 'Whether or not this attribute can be written to. Can only be false when `is_system_attribute` is `true` (user-defined attributes are always writeable). If `false`, this usually means the attribute is enriched by Attio.';
          example: true;
        };
        is_required: {
          type: 'boolean';
          description: 'When `is_required` is `true`, new records/entries must have a value for this attribute. If `false`, values may be `null`. This value does not affect existing data and you do not need to backfill `null` values if changing `is_required` from `false` to `true`.';
          example: true;
        };
        is_unique: {
          type: 'boolean';
          description: 'Whether or not new values for this attribute must be unique. Uniqueness restrictions are only applied to new data and do not apply retroactively to previously created data.';
          example: true;
        };
        is_multiselect: {
          type: 'boolean';
          description: 'Whether or not this attribute can have multiple values. Multiselect is only available on some value types.';
          example: true;
        };
        is_default_value_enabled: {
          type: 'boolean';
          description: 'Whether this attribute has a default value enabled. Must be `true` when `is_required` is `true`.';
          example: true;
        };
        is_archived: {
          type: 'boolean';
          description: 'Whether this attribute has been archived. Archived attributes are hidden from most UI, but can be restored either over the API or in workspace settings. See the [guide on archiving and deleting](/docs/archiving-vs-deleting)for more information.';
          example: false;
        };
        default_value: {
          anyOf: [
            {
              type: 'object';
              properties: {
                type: {
                  type: 'string';
                  enum: ['dynamic'];
                  example: 'dynamic';
                };
                template: {
                  anyOf: [
                    {
                      type: 'string';
                      enum: ['current-user'];
                      description: 'For actor reference attributes, you may pass a dynamic value of `"current-user"`. When creating new records or entries, this will cause the actor reference value to be populated with either the workspace member or API token that created the record/entry.';
                      example: 'current-user';
                    },
                    {
                      type: 'string';
                      description: 'Timestamp attributes may use an ISO 8601 duration as a dynamic value. For example, `"P1M"` would set the value to the current time plus one month.';
                      example: 'P1M';
                    },
                    {
                      type: 'string';
                      description: 'Date attributes may use an ISO 8601 duration as a dynamic value. For example, `"P1M"` would set the value to the current time plus one month.';
                      example: 'P1M';
                    },
                  ];
                };
              };
              required: ['type', 'template'];
            },
            {
              type: 'object';
              properties: {
                type: {
                  type: 'string';
                  enum: ['static'];
                  example: 'static';
                };
                template: {
                  type: 'array';
                  items: {
                    $ref: '#/components/schemas/output-value';
                  };
                  example: [
                    {
                      value: 'Some default text';
                      attribute_type: 'text';
                    },
                  ];
                };
              };
              required: ['type', 'template'];
            },
            {
              type: 'null';
            },
          ];
          description: 'The default value for this attribute. Static values are used to directly populate values using their contents. Dynamic values are used to lookup data at the point of creation. For example, you could use a dynamic value to insert a value for the currently logged in user. Which default values are available is dependent on the type of the attribute.';
        };
        relationship: {
          type: ['object', 'null'];
          properties: {
            id: {
              type: 'object';
              properties: {
                workspace_id: {
                  type: 'string';
                  format: 'uuid';
                  description: 'A UUID representing the workspace this attribute belongs to.';
                  example: '14beef7a-99f7-4534-a87e-70b564330a4c';
                };
                object_id: {
                  type: 'string';
                  format: 'uuid';
                  description: 'A UUID to identify the object or list that this attribute belongs to';
                  example: '97052eb9-e65e-443f-a297-f2d9a4a7f795';
                };
                attribute_id: {
                  type: 'string';
                  format: 'uuid';
                  description: 'A UUID to identify this attribute.';
                  example: '41252299-f8c7-4b5e-99c9-4ff8321d2f96';
                };
              };
              required: ['workspace_id', 'object_id', 'attribute_id'];
            };
          };
          required: ['id'];
          description: 'If this attribute is related to another attribute, this is an object that includes an `id` property that identifies the other attribute. `null` means no relationship exists. See [the help center](https://attio.com/help/reference/managing-your-data/attributes#relationship-attributes) for more details about relationship attributes.';
        };
        created_at: {
          type: 'string';
          description: 'When this attribute was created.';
          example: '2022-11-21T13:22:49.061281000Z';
        };
        config: {
          type: 'object';
          properties: {
            currency: {
              type: 'object';
              properties: {
                default_currency_code: {
                  type: ['string', 'null'];
                  enum: [
                    'EUR',
                    'GBP',
                    'USD',
                    'CAD',
                    'AUD',
                    'NZD',
                    'AED',
                    'INR',
                    'CHF',
                    'JPY',
                    'CNY',
                    'PHP',
                    'ILS',
                    'SGD',
                    'HKD',
                    'MYR',
                    'NTD',
                    'NOK',
                    'SEK',
                    'ISK',
                    'BEL',
                    'PLN',
                    'KRW',
                    'DKK',
                    'BRL',
                  ];
                  description: 'The ISO4217 code representing the currency that values for this attribute should be stored in.';
                  example: 'USD';
                };
                display_type: {
                  type: ['string', 'null'];
                  enum: ['code', 'name', 'narrowSymbol', 'symbol'];
                  description: 'How the currency should be displayed across the app. "code" will display the ISO currency code e.g. "USD", "name" will display the localized currency name e.g. "British pound", "narrowSymbol" will display "$1" instead of "US$1" and "symbol" will display a localized currency symbol such as "$".';
                  example: 'code';
                };
              };
              required: ['default_currency_code', 'display_type'];
              description: 'Configuration available for attributes of type "currency".';
            };
            record_reference: {
              type: 'object';
              properties: {
                allowed_object_ids: {
                  type: ['array', 'null'];
                  items: {
                    type: 'string';
                    format: 'uuid';
                    example: '97052eb9-e65e-443f-a297-f2d9a4a7f795';
                  };
                  description: 'A list of UUIDs to indicate which objects records are allowed to belong to. Leave empty to to allow records from all object types.';
                };
              };
              required: ['allowed_object_ids'];
              description: 'Configuration available for attributes of type "record-reference".';
            };
          };
          required: ['currency', 'record_reference'];
          description: 'Additional, type-dependent configuration for the attribute.';
        };
      };
      required: [
        'id',
        'title',
        'description',
        'api_slug',
        'type',
        'is_system_attribute',
        'is_writable',
        'is_required',
        'is_unique',
        'is_multiselect',
        'is_default_value_enabled',
        'is_archived',
        'default_value',
        'relationship',
        'created_at',
        'config',
      ];
      example: {
        id: {
          workspace_id: '14beef7a-99f7-4534-a87e-70b564330a4c';
          object_id: '97052eb9-e65e-443f-a297-f2d9a4a7f795';
          attribute_id: '41252299-f8c7-4b5e-99c9-4ff8321d2f96';
        };
        title: 'Rating';
        description: 'Rating of the record out of 5';
        api_slug: 'Rating';
        type: 'rating';
        is_system_attribute: false;
        is_writable: true;
        is_required: false;
        is_unique: false;
        is_multiselect: false;
        is_default_value_enabled: false;
        is_archived: false;
        default_value: null;
        relationship: null;
        created_at: '2021-11-21T13:22:49.061Z';
        config: {
          currency: {
            default_currency_code: null;
            display_type: null;
          };
          record_reference: {
            allowed_object_ids: null;
          };
        };
      };
    };
    list: {
      type: 'object';
      properties: {
        id: {
          type: 'object';
          properties: {
            workspace_id: {
              type: 'string';
              format: 'uuid';
              description: 'A UUID to identify the workspace this list belongs to.';
              example: '14beef7a-99f7-4534-a87e-70b564330a4c';
            };
            list_id: {
              type: 'string';
              format: 'uuid';
              description: 'A UUID to identify this list.';
              example: '33ebdbe9-e529-47c9-b894-0ba25e9c15c0';
            };
          };
          required: ['workspace_id', 'list_id'];
        };
        api_slug: {
          type: 'string';
          description: 'A human-readable slug for use in URLs and responses.';
          example: 'hiring-engineering';
        };
        name: {
          type: 'string';
          description: 'The name of the list, as viewed in the UI.';
          example: 'Hiring Engineering';
        };
        parent_object: {
          type: 'array';
          items: {
            type: 'string';
          };
          description: 'A UUID or slug to identify the allowed object type for records added to this list. All new Lists are expected to have exactly one parent object. However, some legacy lists may have multiple allowed parents so the return type of this field is an array.';
          example: ['people'];
        };
        workspace_access: {
          type: ['string', 'null'];
          enum: ['full-access', 'read-and-write', 'read-only'];
          description: 'The level of access granted to all members of the workspace for this list. `null` values represent a private list that only grants access to specific workspace members via the `workspace_member_access` property.';
          example: 'read-and-write';
        };
        workspace_member_access: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              workspace_member_id: {
                type: 'string';
                format: 'uuid';
                description: 'A UUID to identify the workspace member to grant access to.';
                example: '50cf242c-7fa3-4cad-87d0-75b1af71c57b';
              };
              level: {
                type: 'string';
                enum: ['full-access', 'read-and-write', 'read-only'];
                description: 'The level of access to the list.';
                example: 'read-and-write';
              };
            };
            required: ['workspace_member_id', 'level'];
          };
          description: 'The level of access granted to specific workspace members for this list. An empty array represents a list that has granted access to no workspace members.';
        };
        created_by_actor: {
          type: 'object';
          description: 'The actor which created this list.';
          properties: {
            id: {
              type: 'string';
              description: 'An ID to identify the actor.';
              nullable: true;
            };
            type: {
              type: 'string';
              enum: ['api-token', 'workspace-member', 'system'];
              nullable: true;
              description: 'The type of actor. [Read more information on actor types here](/docs/actors).';
            };
          };
          example: {
            type: 'workspace-member';
            id: '50cf242c-7fa3-4cad-87d0-75b1af71c57b';
          };
        };
        created_at: {
          type: 'string';
          description: 'When the list was created.';
          example: '2022-11-21T13:22:49.061281000Z';
        };
      };
      required: [
        'id',
        'api_slug',
        'name',
        'parent_object',
        'workspace_access',
        'workspace_member_access',
        'created_by_actor',
        'created_at',
      ];
    };
    object: {
      type: 'object';
      properties: {
        id: {
          type: 'object';
          properties: {
            workspace_id: {
              type: 'string';
              format: 'uuid';
              description: 'A UUID to identify the workspace this object belongs to.';
              example: '14beef7a-99f7-4534-a87e-70b564330a4c';
            };
            object_id: {
              type: 'string';
              format: 'uuid';
              description: 'A UUID to identify the object.';
              example: '97052eb9-e65e-443f-a297-f2d9a4a7f795';
            };
          };
          required: ['workspace_id', 'object_id'];
        };
        api_slug: {
          type: ['string', 'null'];
          description: 'A unique, human-readable slug to access the object through URLs and API calls. Formatted in snake case.';
          example: 'people';
        };
        singular_noun: {
          type: ['string', 'null'];
          description: "The singular form of the object's name.";
          example: 'Person';
        };
        plural_noun: {
          type: ['string', 'null'];
          description: "The plural form of the object's name.";
          example: 'People';
        };
        created_at: {
          type: 'string';
          description: 'When the object was created.';
          example: '2022-11-21T13:22:49.061281000Z';
        };
      };
      required: ['id', 'api_slug', 'singular_noun', 'plural_noun', 'created_at'];
    };
    'workspace-member': {
      type: 'object';
      properties: {
        id: {
          type: 'object';
          properties: {
            workspace_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the workspace the workspace member belongs to.';
              example: '14beef7a-99f7-4534-a87e-70b564330a4c';
            };
            workspace_member_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the workspace member.';
              example: '50cf242c-7fa3-4cad-87d0-75b1af71c57b';
            };
          };
          required: ['workspace_id', 'workspace_member_id'];
        };
        first_name: {
          type: 'string';
          description: 'The first name of the user.';
          example: 'Susan';
        };
        last_name: {
          type: 'string';
          description: 'The last name of the user.';
          example: 'Kare';
        };
        avatar_url: {
          type: ['string', 'null'];
          format: 'uri';
          description: "A URL to the user's avatar image.";
          example: 'https://lh3.googleusercontent.com/a/ABdFTp7z6OgAW9EqZx78wTqPfWClGCJCZXFjQfBG7rd9=s96-c';
        };
        email_address: {
          type: 'string';
          format: 'email';
          description: "The user's email address.";
          example: 'susan.kare@apple.com';
        };
        created_at: {
          type: 'string';
          description: 'When the workspace member was created.';
          example: '2022-11-21T13:22:49.061281000Z';
        };
        access_level: {
          type: 'string';
          enum: ['admin', 'member', 'suspended'];
          description: 'Whether the workspace member is suspended or not and what level of privileges they have inside the workspace. We do not delete workspace members so that you can successfully attribute past actions to suspended workspace members.';
          example: 'member';
        };
      };
      required: ['id', 'first_name', 'last_name', 'avatar_url', 'email_address', 'created_at', 'access_level'];
    };
    comment: {
      type: 'object';
      properties: {
        id: {
          type: 'object';
          properties: {
            workspace_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the workspace the comment belongs to.';
              example: '14beef7a-99f7-4534-a87e-70b564330a4c';
            };
            comment_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the comment.';
              example: 'aa1dc1d9-93ac-4c6c-987e-16b6eea9aab2';
            };
          };
          required: ['workspace_id', 'comment_id'];
        };
        thread_id: {
          type: 'string';
          format: 'uuid';
          description: 'The ID of the thread the comment belongs to.';
          example: 'aa1dc1d9-93ac-4c6c-987e-16b6eea9aab2';
        };
        content_plaintext: {
          type: 'string';
          description: 'A plaintext representation of the content of the comment. References to workspace members are cast into email addresses, all other stylistic elements are removed.';
          example: "Let's go ahead and close this deal, alice@attio.com.";
        };
        entry: {
          type: ['object', 'null'];
          properties: {
            entry_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the entry the comment belongs to.';
              example: '2e6e29ea-c4e0-4f44-842d-78a891f8c156';
            };
            list_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the list the entry belongs to.';
              example: '33ebdbe9-e529-47c9-b894-0ba25e9c15c0';
            };
          };
          required: ['entry_id', 'list_id'];
          description: 'The entry the comment belongs to, `null` for comments on records.';
        };
        record: {
          type: 'object';
          properties: {
            record_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the record the comment belongs to.';
              example: 'bf071e1f-6035-429d-b874-d83ea64ea13b';
            };
            object_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the object the record belongs to.';
              example: '97052eb9-e65e-443f-a297-f2d9a4a7f795';
            };
          };
          required: ['record_id', 'object_id'];
          description: 'The record the comment belongs to.';
        };
        resolved_at: {
          type: ['string', 'null'];
          description: 'Whether the comment is resolved.';
          example: '2023-01-01T15:00:00.000000000Z';
        };
        resolved_by: {
          type: 'object';
          description: 'The actor that resolved this comment.';
          properties: {
            id: {
              type: 'string';
              description: 'An ID to identify the actor.';
              nullable: true;
            };
            type: {
              type: 'string';
              enum: ['api-token', 'workspace-member', 'system'];
              nullable: true;
              description: 'The type of actor. [Read more information on actor types here](/docs/actors).';
            };
          };
          example: {
            type: 'workspace-member';
            id: '50cf242c-7fa3-4cad-87d0-75b1af71c57b';
          };
        };
        created_at: {
          type: 'string';
          description: 'When the note was created.';
          example: '2023-01-01T15:00:00.000000000Z';
        };
        author: {
          type: 'object';
          description: 'Who wrote this comment. Note that the API provides the ability for API tokens to write comments on behalf of other actors.';
          properties: {
            id: {
              type: 'string';
              description: 'An ID to identify the actor.';
              nullable: true;
            };
            type: {
              type: 'string';
              enum: ['api-token', 'workspace-member', 'system'];
              nullable: true;
              description: 'The type of actor. [Read more information on actor types here](/docs/actors).';
            };
          };
          example: {
            type: 'workspace-member';
            id: '50cf242c-7fa3-4cad-87d0-75b1af71c57b';
          };
        };
      };
      required: [
        'id',
        'thread_id',
        'content_plaintext',
        'entry',
        'record',
        'resolved_at',
        'resolved_by',
        'created_at',
        'author',
      ];
    };
    note: {
      type: 'object';
      properties: {
        id: {
          type: 'object';
          properties: {
            workspace_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the workspace the note belongs to.';
              example: '14beef7a-99f7-4534-a87e-70b564330a4c';
            };
            note_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the note.';
              example: 'ff3f3bd4-40f4-4f80-8187-cd02385af424';
            };
          };
          required: ['workspace_id', 'note_id'];
        };
        parent_object: {
          type: 'string';
          description: 'The slug or ID of the parent object the note belongs to.';
          example: 'people';
        };
        parent_record_id: {
          type: 'string';
          format: 'uuid';
          description: 'The ID of the parent record the note belongs to.';
          example: '891dcbfc-9141-415d-9b2a-2238a6cc012d';
        };
        title: {
          type: 'string';
          description: 'The note title. The title is plaintext only and has no formatting.';
          example: 'Initial Prospecting Call Summary';
        };
        content_plaintext: {
          type: 'string';
          description: 'The plaintext representation of the note content. The line feed character `\\n` represents new lines within the note content.';
          example: 'Introduction\nDate and time of the call\nParticipants\nPurpose of the call\nCustomer Background\nCompany overview (industry, size, location)\nKey business challenges\nCurrent software solutions (if any) and pain points';
        };
        created_by_actor: {
          type: 'object';
          description: 'The actor that created this note.';
          properties: {
            id: {
              type: 'string';
              description: 'An ID to identify the actor.';
              nullable: true;
            };
            type: {
              type: 'string';
              enum: ['api-token', 'workspace-member', 'system'];
              nullable: true;
              description: 'The type of actor. [Read more information on actor types here](/docs/actors).';
            };
          };
          example: {
            type: 'workspace-member';
            id: '50cf242c-7fa3-4cad-87d0-75b1af71c57b';
          };
        };
        created_at: {
          type: 'string';
          description: 'When the note was created.';
          example: '2022-11-21T13:22:49.061281000Z';
        };
      };
      required: [
        'id',
        'parent_object',
        'parent_record_id',
        'title',
        'content_plaintext',
        'created_by_actor',
        'created_at',
      ];
    };
    task: {
      type: 'object';
      properties: {
        id: {
          type: 'object';
          properties: {
            workspace_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the workspace the task belongs to.';
              example: '14beef7a-99f7-4534-a87e-70b564330a4c';
            };
            task_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the task.';
              example: '649e34f4-c39a-4f4d-99ef-48a36bef8f04';
            };
          };
          required: ['workspace_id', 'task_id'];
        };
        content_plaintext: {
          type: 'string';
          description: 'The plaintext representation of the task content. Inline linked records will appear as "@record name" and are returned in the `linked_records` property.';
          example: 'Follow up on current software solutions';
        };
        deadline_at: {
          type: ['string', 'null'];
          description: 'The deadline date of the task. Returned as an ISO 8601 timestamp.';
          example: '2023-01-01';
        };
        is_completed: {
          type: 'boolean';
          description: 'Whether the task has been completed.';
          example: false;
        };
        linked_records: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              target_object_id: {
                type: 'string';
                description: 'The ID of the parent object the task refers to. At present, only `people` and `companies` are supported.';
                example: 'people';
              };
              target_record_id: {
                type: 'string';
                format: 'uuid';
                description: 'The ID of the parent record the task refers to.';
                example: '891dcbfc-9141-415d-9b2a-2238a6cc012d';
              };
            };
            required: ['target_object_id', 'target_record_id'];
          };
          description: 'Records linked to the task. Creating record links within task content text is not possible via the API at present.';
        };
        assignees: {
          type: 'array';
          items: {
            type: 'object';
            properties: {
              referenced_actor_type: {
                type: 'string';
                enum: ['api-token', 'workspace-member', 'system'];
                description: 'The type of actor. [Read more information on actor types here](/docs/actors).';
                example: 'workspace-member';
              };
              referenced_actor_id: {
                type: 'string';
                format: 'uuid';
                description: 'The ID of the workspace member actor assigned to this task.';
                example: '50cf242c-7fa3-4cad-87d0-75b1af71c57b';
              };
            };
            required: ['referenced_actor_type', 'referenced_actor_id'];
          };
          description: 'Workspace members assigned to this task.';
        };
        created_by_actor: {
          type: 'object';
          description: 'The actor that created this task.';
          properties: {
            id: {
              type: 'string';
              description: 'An ID to identify the actor.';
              nullable: true;
            };
            type: {
              type: 'string';
              enum: ['api-token', 'workspace-member', 'system'];
              nullable: true;
              description: 'The type of actor. [Read more information on actor types here](/docs/actors).';
            };
          };
          example: {
            type: 'workspace-member';
            id: '50cf242c-7fa3-4cad-87d0-75b1af71c57b';
          };
        };
        created_at: {
          type: 'string';
          description: 'When the task was created.';
          example: '2022-11-21T13:22:49.061281000Z';
        };
      };
      required: [
        'id',
        'content_plaintext',
        'deadline_at',
        'is_completed',
        'linked_records',
        'assignees',
        'created_by_actor',
        'created_at',
      ];
    };
    thread: {
      type: 'object';
      properties: {
        id: {
          type: 'object';
          properties: {
            workspace_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the workspace the thread belongs to.';
              example: '14beef7a-99f7-4534-a87e-70b564330a4c';
            };
            thread_id: {
              type: 'string';
              format: 'uuid';
              description: 'The ID of the thread.';
              example: 'a649e4d9-435c-43fb-83ba-847b4876f27a';
            };
          };
          required: ['workspace_id', 'thread_id'];
        };
        comments: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/comment';
          };
          minItems: 1;
          description: 'An array of comments in the thread, sorted by `created_at`.';
        };
        created_at: {
          type: 'string';
          description: 'When the thread was created.';
          example: '2023-01-01T15:00:00.000000000Z';
        };
      };
      required: ['id', 'comments', 'created_at'];
    };
  };
  parameters: {};
};
export const components = {
  securitySchemes: {
    oauth2: {
      type: 'oauth2',
      description: 'This API uses OAuth 2.0 with the authorization code grant flow.',
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://app.attio.com/authorize',
          tokenUrl: 'https://app.attio.com/oauth/token',
          scopes: {
            'user_management:read': 'View workspace members.',
            'user_management:read-write': 'View workspace members.',
            'record_permission:read': 'View, and optionally write, records.',
            'record_permission:read-write': 'View, and optionally write, records.',
            'object_configuration:read': 'View, and optionally write, the configuration and attributes of objects.',
            'object_configuration:read-write':
              'View, and optionally write, the configuration and attributes of objects.',
            'list_entry:read': 'View, and optionally write, the entries in a list.',
            'list_entry:read-write': 'View, and optionally write, the entries in a list.',
            'list_configuration:read': 'View, and optionally write, the configuration and attributes of lists.',
            'list_configuration:read-write': 'View, and optionally write, the configuration and attributes of lists.',
            'public_collection:read':
              'View, and optionally write, both the settings and information within public collections.',
            'public_collection:read-write':
              'View, and optionally write, both the settings and information within public collections.',
            'private_collection:read':
              'View, and optionally modify, both the settings and information of all collections within the workspace, regardless of their access settings.',
            'private_collection:read-write':
              'View, and optionally modify, both the settings and information of all collections within the workspace, regardless of their access settings.',
            'comment:read': 'View comments (and threads), and optionally write comments.',
            'comment:read-write': 'View comments (and threads), and optionally write comments.',
            'task:read': 'View, and optionally write, tasks.',
            'task:read-write': 'View, and optionally write, tasks.',
            'note:read': 'View, and optionally write, notes.',
            'note:read-write': 'View, and optionally write, notes.',
            'webhook:read': 'View, and optionally manage, webhooks.',
            'webhook:read-write': 'View, and optionally manage, webhooks.',
          },
        },
      },
    },
  },
  schemas: {
    status: {
      type: 'object',
      properties: {
        id: {
          type: 'object',
          properties: {
            workspace_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the workspace',
              example: '14beef7a-99f7-4534-a87e-70b564330a4c',
            },
            object_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the object',
              example: '97052eb9-e65e-443f-a297-f2d9a4a7f795',
            },
            attribute_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the attribute',
              example: '41252299-f8c7-4b5e-99c9-4ff8321d2f96',
            },
            status_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the status',
              example: '11f07f01-c10f-4e05-a522-33e050bc52ee',
            },
          },
          required: ['workspace_id', 'object_id', 'attribute_id', 'status_id'],
        },
        title: {
          type: 'string',
          description: 'The title of the status',
          example: 'In Progress',
        },
        is_archived: {
          type: 'boolean',
          description:
            'Whether or not to archive the status. See our [archiving guide](/docs/archiving-vs-deleting) for more information on archiving.',
          example: false,
        },
        celebration_enabled: {
          type: 'boolean',
          description: 'Whether arriving at this status triggers a celebration effect in the UI',
          example: false,
        },
        target_time_in_status: {
          type: ['string', 'null'],
          description: 'Target time for a record to spend in given status expressed as a ISO-8601 duration string',
          example: 'P0Y0M1DT0H0M0S',
        },
      },
      required: ['id', 'title', 'is_archived', 'celebration_enabled', 'target_time_in_status'],
    },
    'select-option': {
      type: 'object',
      properties: {
        id: {
          type: 'object',
          properties: {
            workspace_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the workspace',
              example: '14beef7a-99f7-4534-a87e-70b564330a4c',
            },
            object_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the object',
              example: '97052eb9-e65e-443f-a297-f2d9a4a7f795',
            },
            attribute_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the attribute',
              example: '41252299-f8c7-4b5e-99c9-4ff8321d2f96',
            },
            option_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the select option',
              example: '08c2c59a-c18e-40c6-8dc4-95415313b2ea',
            },
          },
          required: ['workspace_id', 'object_id', 'attribute_id', 'option_id'],
        },
        title: {
          type: 'string',
          description: 'The title of the select option',
          example: 'Medium',
        },
        is_archived: {
          type: 'boolean',
          description:
            'Whether or not to archive the select option. See our [archiving guide](/docs/archiving-vs-deleting) for more information on archiving.',
          example: false,
        },
      },
      required: ['id', 'title', 'is_archived'],
    },
    'input-value': {
      anyOf: [
        {
          type: 'object',
          properties: {
            referenced_actor_type: {
              type: 'string',
              enum: ['workspace-member'],
              description:
                'The type of the referenced actor. Currently, only workspace members can be written into actor reference attributes. [Read more information on actor types here](/docs/actors).',
              example: 'workspace-member',
            },
            referenced_actor_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the referenced Actor.',
              example: '50cf242c-7fa3-4cad-87d0-75b1af71c57b',
            },
          },
          required: ['referenced_actor_type', 'referenced_actor_id'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            workspace_member_email_address: {
              type: 'string',
              description: 'Workspace member actors can be referenced by email address as well as actor ID.',
              example: 'alice@attio.com',
            },
          },
          required: ['workspace_member_email_address'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            value: {
              type: 'boolean',
              description:
                "A boolean representing whether the checkbox is checked or not. The string values 'true' and 'false' are also accepted.",
              example: true,
            },
          },
          required: ['value'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            currency_value: {
              type: 'number',
              description:
                'A numerical representation of the currency value. A decimal with a max of 4 decimal places.',
              example: 99,
            },
          },
          required: ['currency_value'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            value: {
              type: 'string',
              description:
                'A date represents a single calendar year, month and day, independent of timezone. If hours, months, seconds or timezones are provided, they will be trimmed. For example, "2023" and "2023-01" will be coerced into "2023-01-01", and "2023-01-02", "2023-01-02T13:00", "2023-01-02T14:00:00", "2023-01-02T15:00:00.000000000", and "2023-01-02T15:00:00.000000000+02:00" will all be coerced to "2023-01-02". If a timezone is provided that would result in a different calendar date in UTC, the date will be coerced to UTC and then the timezone component will be trimmed. For example, the value "2023-01-02T23:00:00-10:00" will be returned as "2023-01-03". The maximum date is "9999-12-31".',
              example: '2023-01-01',
            },
          },
          required: ['value'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            domain: {
              type: 'string',
              description: 'The full domain of the website.',
              example: 'app.attio.com',
            },
          },
        },
        {
          type: 'object',
          properties: {
            email_address: {
              type: 'string',
              description: 'An email address string',
              example: 'alice@app.attio.com',
            },
          },
        },
        {
          type: 'object',
          properties: {
            target_object: {
              type: 'string',
              description: 'A UUID or slug to identify the object that the referenced record belongs to.',
              example: 'people',
            },
            target_record_id: {
              type: 'string',
              format: 'uuid',
              description: 'A UUID to identify the referenced record.',
              example: '891dcbfc-9141-415d-9b2a-2238a6cc012d',
            },
          },
          required: ['target_object', 'target_record_id'],
          additionalProperties: false,
        },
        {
          type: 'object',
          example: {
            target_object: 'people',
            matching_attribute_id_123: [
              {
                value: 'matching_attribute_id_123',
              },
            ],
          },
          properties: {
            target_object: {
              type: 'string',
              example: 'people',
              description: 'A UUID or slug to identify the object that the referenced record belongs to.',
            },
            '[slug_or_id_of_matching_attribute]': {
              type: 'array',
              description:
                'In addition to referencing records directly by record ID, you may also reference by a matching attribute of your choice. For example, if you want to add a reference to the person record with email "alice@website.com", you should pass a value with `target_object` set to `"people"` and `email_addresses` set to `[{email_address:"alice@website.com"}]`. The key should be the slug or ID of the matching attribute you would like to use and the value should be an array containing a single value of the appropriate attribute type (as specified below). Matching on multiple values is not currently supported. Matching attributes must be unique. This process is similar to how you use the `matching_attribute` query param in Attio\'s [assert endpoints](/reference/put_v2-objects-object-records).',
              items: {
                anyOf: [
                  {
                    type: 'object',
                    properties: {
                      domain: {
                        type: 'string',
                        example: 'app.attio.com',
                        description: 'The full domain of the website.',
                      },
                    },
                  },
                  {
                    type: 'object',
                    properties: {
                      email_address: {
                        type: 'string',
                        example: 'alice@app.attio.com',
                        description: 'An email address string',
                      },
                    },
                  },
                  {
                    type: 'object',
                    properties: {
                      value: {
                        type: 'number',
                        example: 17224912,
                        description: 'Numbers are persisted as 64 bit floats.',
                      },
                    },
                  },
                  {
                    type: 'object',
                    properties: {
                      original_phone_number: {
                        type: 'string',
                        example: '07234172834',
                        description: 'The raw, original phone number, as inputted.',
                      },
                      country_code: {
                        type: ['string', 'null'],
                        enum: [
                          'AF',
                          'AX',
                          'AL',
                          'DZ',
                          'AS',
                          'AD',
                          'AO',
                          'AI',
                          'AQ',
                          'AG',
                          'AR',
                          'AM',
                          'AW',
                          'AU',
                          'AT',
                          'AZ',
                          'BS',
                          'BH',
                          'BD',
                          'BB',
                          'BY',
                          'BE',
                          'BZ',
                          'BJ',
                          'BM',
                          'BT',
                          'BO',
                          'BA',
                          'BW',
                          'BV',
                          'BR',
                          'IO',
                          'BN',
                          'BG',
                          'BF',
                          'BI',
                          'KH',
                          'CM',
                          'CA',
                          'CV',
                          'KY',
                          'CF',
                          'TD',
                          'CL',
                          'CN',
                          'CX',
                          'CC',
                          'CO',
                          'KM',
                          'CG',
                          'CD',
                          'CK',
                          'CR',
                          'CI',
                          'HR',
                          'CU',
                          'CW',
                          'CY',
                          'CZ',
                          'DK',
                          'DJ',
                          'DM',
                          'DO',
                          'EC',
                          'EG',
                          'SV',
                          'GQ',
                          'ER',
                          'EE',
                          'ET',
                          'FK',
                          'FO',
                          'FJ',
                          'FI',
                          'FR',
                          'GF',
                          'PF',
                          'TF',
                          'GA',
                          'GM',
                          'GE',
                          'DE',
                          'GH',
                          'GI',
                          'GR',
                          'GL',
                          'GD',
                          'GP',
                          'GU',
                          'GT',
                          'GG',
                          'GN',
                          'GW',
                          'GY',
                          'HT',
                          'HM',
                          'VA',
                          'HN',
                          'HK',
                          'HU',
                          'IS',
                          'IN',
                          'ID',
                          'IR',
                          'IQ',
                          'IE',
                          'IM',
                          'IL',
                          'IT',
                          'JM',
                          'JP',
                          'JE',
                          'JO',
                          'KZ',
                          'KE',
                          'KI',
                          'KR',
                          'KW',
                          'KG',
                          'LA',
                          'LV',
                          'LB',
                          'LS',
                          'LR',
                          'LY',
                          'LI',
                          'LT',
                          'LU',
                          'MO',
                          'MK',
                          'MG',
                          'MW',
                          'MY',
                          'MV',
                          'ML',
                          'MT',
                          'MH',
                          'MQ',
                          'MR',
                          'MU',
                          'YT',
                          'MX',
                          'FM',
                          'MD',
                          'MC',
                          'MN',
                          'ME',
                          'MS',
                          'MA',
                          'MZ',
                          'MM',
                          'NA',
                          'NR',
                          'NP',
                          'NL',
                          'AN',
                          'NC',
                          'NZ',
                          'NI',
                          'NE',
                          'NG',
                          'NU',
                          'NF',
                          'MP',
                          'NO',
                          'OM',
                          'PK',
                          'PW',
                          'PS',
                          'PA',
                          'PG',
                          'PY',
                          'PE',
                          'PH',
                          'PN',
                          'PL',
                          'PT',
                          'PR',
                          'QA',
                          'RE',
                          'RO',
                          'RU',
                          'RW',
                          'BL',
                          'SH',
                          'KN',
                          'LC',
                          'MF',
                          'PM',
                          'VC',
                          'WS',
                          'SM',
                          'ST',
                          'SA',
                          'SN',
                          'RS',
                          'SC',
                          'SL',
                          'SG',
                          'SK',
                          'SI',
                          'SB',
                          'SO',
                          'ZA',
                          'GS',
                          'ES',
                          'LK',
                          'SD',
                          'SR',
                          'SJ',
                          'SZ',
                          'SE',
                          'CH',
                          'SY',
                          'TW',
                          'TJ',
                          'TZ',
                          'TH',
                          'TL',
                          'TG',
                          'TK',
                          'TO',
                          'TT',
                          'TN',
                          'TR',
                          'TM',
                          'TC',
                          'TV',
                          'UG',
                          'UA',
                          'AE',
                          'GB',
                          'US',
                          'UM',
                          'UY',
                          'UZ',
                          'VU',
                          'VE',
                          'VN',
                          'VG',
                          'VI',
                          'WF',
                          'EH',
                          'YE',
                          'ZM',
                          'ZW',
                        ],
                        example: 'GB',
                        description:
                          'The ISO 3166-1 alpha-2 country code representing the country that this phone number belongs to.',
                      },
                    },
                  },
                  {
                    type: 'object',
                    properties: {
                      value: {
                        type: 'string',
                        description: 'A raw text field. Values are limited to 10MB.',
                      },
                    },
                  },
                ],
              },
            },
          },
          required: ['target_object', '[slug_or_id_of_matching_attribute]'],
        },
        {
          type: 'object',
          properties: {
            interaction_type: {
              type: 'string',
              enum: ['calendar-event', 'call', 'chat-thread', 'email', 'in-person-meeting'],
              description: 'The type of interaction e.g. calendar or email.',
              example: 'email',
            },
            interacted_at: {
              type: 'string',
              format: 'date-time',
              description: 'When the interaction occurred.',
              example: '2023-01-01T15:00:00.000000000Z',
            },
            owner_actor: {
              type: 'object',
              description: 'The actor that created this value.',
              properties: {
                id: {
                  type: 'string',
                  description: 'An ID to identify the actor.',
                  nullable: true,
                },
                type: {
                  type: 'string',
                  enum: ['api-token', 'workspace-member', 'system'],
                  nullable: true,
                  description: 'The type of actor. [Read more information on actor types here](/docs/actors).',
                },
              },
              example: {
                type: 'workspace-member',
                id: '50cf242c-7fa3-4cad-87d0-75b1af71c57b',
              },
            },
          },
          required: ['interaction_type', 'interacted_at', 'owner_actor'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            line_1: {
              type: ['string', 'null'],
              description:
                'The first line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.',
              example: '1 Infinite Loop',
            },
            line_2: {
              type: ['string', 'null'],
              description:
                'The second line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.',
              example: 'Block 1',
            },
            line_3: {
              type: ['string', 'null'],
              description:
                'The third line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.',
              example: 'Hilldrop Estate',
            },
            line_4: {
              type: ['string', 'null'],
              description:
                'The fourth line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.',
              example: 'Westborough',
            },
            locality: {
              type: ['string', 'null'],
              description: 'The town, neighborhood or area the location is in.',
              example: 'Cupertino',
            },
            region: {
              type: ['string', 'null'],
              description: 'The state, county, province or region that the location is in.',
              example: 'CA',
            },
            postcode: {
              type: ['string', 'null'],
              description:
                'The postcode or zip code for the location. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.}',
              example: '95014',
            },
            country_code: {
              type: ['string', 'null'],
              enum: [
                'AF',
                'AX',
                'AL',
                'DZ',
                'AS',
                'AD',
                'AO',
                'AI',
                'AQ',
                'AG',
                'AR',
                'AM',
                'AW',
                'AU',
                'AT',
                'AZ',
                'BS',
                'BH',
                'BD',
                'BB',
                'BY',
                'BE',
                'BZ',
                'BJ',
                'BM',
                'BT',
                'BO',
                'BA',
                'BW',
                'BV',
                'BR',
                'IO',
                'BN',
                'BG',
                'BF',
                'BI',
                'KH',
                'CM',
                'CA',
                'CV',
                'KY',
                'CF',
                'TD',
                'CL',
                'CN',
                'CX',
                'CC',
                'CO',
                'KM',
                'CG',
                'CD',
                'CK',
                'CR',
                'CI',
                'HR',
                'CU',
                'CW',
                'CY',
                'CZ',
                'DK',
                'DJ',
                'DM',
                'DO',
                'EC',
                'EG',
                'SV',
                'GQ',
                'ER',
                'EE',
                'ET',
                'FK',
                'FO',
                'FJ',
                'FI',
                'FR',
                'GF',
                'PF',
                'TF',
                'GA',
                'GM',
                'GE',
                'DE',
                'GH',
                'GI',
                'GR',
                'GL',
                'GD',
                'GP',
                'GU',
                'GT',
                'GG',
                'GN',
                'GW',
                'GY',
                'HT',
                'HM',
                'VA',
                'HN',
                'HK',
                'HU',
                'IS',
                'IN',
                'ID',
                'IR',
                'IQ',
                'IE',
                'IM',
                'IL',
                'IT',
                'JM',
                'JP',
                'JE',
                'JO',
                'KZ',
                'KE',
                'KI',
                'KR',
                'KW',
                'KG',
                'LA',
                'LV',
                'LB',
                'LS',
                'LR',
                'LY',
                'LI',
                'LT',
                'LU',
                'MO',
                'MK',
                'MG',
                'MW',
                'MY',
                'MV',
                'ML',
                'MT',
                'MH',
                'MQ',
                'MR',
                'MU',
                'YT',
                'MX',
                'FM',
                'MD',
                'MC',
                'MN',
                'ME',
                'MS',
                'MA',
                'MZ',
                'MM',
                'NA',
                'NR',
                'NP',
                'NL',
                'AN',
                'NC',
                'NZ',
                'NI',
                'NE',
                'NG',
                'NU',
                'NF',
                'MP',
                'NO',
                'OM',
                'PK',
                'PW',
                'PS',
                'PA',
                'PG',
                'PY',
                'PE',
                'PH',
                'PN',
                'PL',
                'PT',
                'PR',
                'QA',
                'RE',
                'RO',
                'RU',
                'RW',
                'BL',
                'SH',
                'KN',
                'LC',
                'MF',
                'PM',
                'VC',
                'WS',
                'SM',
                'ST',
                'SA',
                'SN',
                'RS',
                'SC',
                'SL',
                'SG',
                'SK',
                'SI',
                'SB',
                'SO',
                'ZA',
                'GS',
                'ES',
                'LK',
                'SD',
                'SR',
                'SJ',
                'SZ',
                'SE',
                'CH',
                'SY',
                'TW',
                'TJ',
                'TZ',
                'TH',
                'TL',
                'TG',
                'TK',
                'TO',
                'TT',
                'TN',
                'TR',
                'TM',
                'TC',
                'TV',
                'UG',
                'UA',
                'AE',
                'GB',
                'US',
                'UM',
                'UY',
                'UZ',
                'VU',
                'VE',
                'VN',
                'VG',
                'VI',
                'WF',
                'EH',
                'YE',
                'ZM',
                'ZW',
              ],
              description: 'The ISO 3166-1 alpha-2 country code for the country this location is in.',
              example: 'US',
            },
            latitude: {
              type: ['string', 'null'],
              pattern: '^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?)$',
              description:
                'The latitude of the location. Validated by the regular expression `/^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?)$/`. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.}',
              example: '37.331741',
            },
            longitude: {
              type: ['string', 'null'],
              pattern: '^[-+]?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$',
              description:
                'The longitude of the location. Validated by the regular expression `/^[-+]?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$/`',
              example: '-122.030333',
            },
          },
          required: [
            'line_1',
            'line_2',
            'line_3',
            'line_4',
            'locality',
            'region',
            'postcode',
            'country_code',
            'latitude',
            'longitude',
          ],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            value: {
              type: 'number',
              description: 'Numbers are persisted as 64 bit floats.',
              example: 42,
            },
          },
          required: ['value'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            first_name: {
              type: 'string',
              example: 'Ada',
              description: 'The first name.',
            },
            last_name: {
              type: 'string',
              example: 'Lovelace',
              description: 'The last name.',
            },
            full_name: {
              type: 'string',
              example: 'Ada Lovelace',
              description: 'The full name.',
            },
          },
        },
        {
          type: 'object',
          required: ['original_phone_number'],
          properties: {
            original_phone_number: {
              type: 'string',
              example: '+15558675309',
              description:
                'A phone number which is either a) prefixed with a country code (e.g. `+44....`) or b) a local number, where `country_code` is specified in addition.',
            },
            country_code: {
              type: ['string', 'null'],
              enum: [
                'AF',
                'AX',
                'AL',
                'DZ',
                'AS',
                'AD',
                'AO',
                'AI',
                'AQ',
                'AG',
                'AR',
                'AM',
                'AW',
                'AU',
                'AT',
                'AZ',
                'BS',
                'BH',
                'BD',
                'BB',
                'BY',
                'BE',
                'BZ',
                'BJ',
                'BM',
                'BT',
                'BO',
                'BA',
                'BW',
                'BV',
                'BR',
                'IO',
                'BN',
                'BG',
                'BF',
                'BI',
                'KH',
                'CM',
                'CA',
                'CV',
                'KY',
                'CF',
                'TD',
                'CL',
                'CN',
                'CX',
                'CC',
                'CO',
                'KM',
                'CG',
                'CD',
                'CK',
                'CR',
                'CI',
                'HR',
                'CU',
                'CW',
                'CY',
                'CZ',
                'DK',
                'DJ',
                'DM',
                'DO',
                'EC',
                'EG',
                'SV',
                'GQ',
                'ER',
                'EE',
                'ET',
                'FK',
                'FO',
                'FJ',
                'FI',
                'FR',
                'GF',
                'PF',
                'TF',
                'GA',
                'GM',
                'GE',
                'DE',
                'GH',
                'GI',
                'GR',
                'GL',
                'GD',
                'GP',
                'GU',
                'GT',
                'GG',
                'GN',
                'GW',
                'GY',
                'HT',
                'HM',
                'VA',
                'HN',
                'HK',
                'HU',
                'IS',
                'IN',
                'ID',
                'IR',
                'IQ',
                'IE',
                'IM',
                'IL',
                'IT',
                'JM',
                'JP',
                'JE',
                'JO',
                'KZ',
                'KE',
                'KI',
                'KR',
                'KW',
                'KG',
                'LA',
                'LV',
                'LB',
                'LS',
                'LR',
                'LY',
                'LI',
                'LT',
                'LU',
                'MO',
                'MK',
                'MG',
                'MW',
                'MY',
                'MV',
                'ML',
                'MT',
                'MH',
                'MQ',
                'MR',
                'MU',
                'YT',
                'MX',
                'FM',
                'MD',
                'MC',
                'MN',
                'ME',
                'MS',
                'MA',
                'MZ',
                'MM',
                'NA',
                'NR',
                'NP',
                'NL',
                'AN',
                'NC',
                'NZ',
                'NI',
                'NE',
                'NG',
                'NU',
                'NF',
                'MP',
                'NO',
                'OM',
                'PK',
                'PW',
                'PS',
                'PA',
                'PG',
                'PY',
                'PE',
                'PH',
                'PN',
                'PL',
                'PT',
                'PR',
                'QA',
                'RE',
                'RO',
                'RU',
                'RW',
                'BL',
                'SH',
                'KN',
                'LC',
                'MF',
                'PM',
                'VC',
                'WS',
                'SM',
                'ST',
                'SA',
                'SN',
                'RS',
                'SC',
                'SL',
                'SG',
                'SK',
                'SI',
                'SB',
                'SO',
                'ZA',
                'GS',
                'ES',
                'LK',
                'SD',
                'SR',
                'SJ',
                'SZ',
                'SE',
                'CH',
                'SY',
                'TW',
                'TJ',
                'TZ',
                'TH',
                'TL',
                'TG',
                'TK',
                'TO',
                'TT',
                'TN',
                'TR',
                'TM',
                'TC',
                'TV',
                'UG',
                'UA',
                'AE',
                'GB',
                'US',
                'UM',
                'UY',
                'UZ',
                'VU',
                'VE',
                'VN',
                'VG',
                'VI',
                'WF',
                'EH',
                'YE',
                'ZM',
                'ZW',
              ],
              example: 'GB',
              description:
                'The ISO 3166-1 alpha-2 country code representing the country that this phone number belongs to. Optional if `original_phone_number` includes a country code prefix.',
            },
          },
        },
        {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              minLength: 1,
              description: 'The UUID or status title identifying the selected status.',
              example: 'In Progress',
            },
          },
          required: ['status'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            value: {
              type: 'number',
              description: 'A number between 0 and 5 (inclusive) to represent a star rating.',
              example: 3,
            },
          },
          required: ['value'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            option: {
              type: 'string',
              minLength: 1,
              description: 'The UUID or select option title identifying the selected select option.',
              example: 'Medium',
            },
          },
          required: ['option'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            value: {
              type: 'string',
              description: 'A raw text field. Values are limited to 10MB.',
              example:
                'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
            },
          },
          required: ['value'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            value: {
              type: 'string',
              description:
                'A timestamp value represents a single, universal moment in time using an ISO 8601 formatted string. This means that a timestamp consists of a date, a time (with nanosecond precision), and a time zone. Attio will coerce timestamps which do not provide full nanosecond precision and UTC is assumed if no time zone is provided. For example, "2023", "2023-01", "2023-01-02", "2023-01-02T13:00", "2023-01-02T13:00:00", and "2023-01-02T13:00:00.000000000" will all be coerced to "2023-01-02T13:00:00.000000000Z". Timestamps are always returned in UTC. For example, writing a timestamp value using the string "2023-01-02T13:00:00.000000000+02:00" will result in the value "2023-01-02T11:00:00.000000000Z" being returned. The maximum date is "9999-12-31T23:59:59.999999999Z".',
              format: 'date',
              example: '2023-01-01T15:00:00.000000000Z',
            },
          },
          required: ['value'],
          additionalProperties: false,
        },
      ],
      description: 'A union of possible value types, as required in request bodies.',
    },
    'output-value': {
      anyOf: [
        {
          type: 'object',
          properties: {
            referenced_actor_type: {
              type: 'string',
              enum: ['api-token', 'workspace-member', 'system'],
              description:
                'The type of the referenced actor. [Read more information on actor types here](/docs/actors).',
              example: 'workspace-member',
            },
            referenced_actor_id: {
              type: ['string', 'null'],
              format: 'uuid',
              description: 'The ID of the referenced actor.',
              example: '50cf242c-7fa3-4cad-87d0-75b1af71c57b',
            },
            attribute_type: {
              type: 'string',
              enum: ['actor-reference'],
              description: 'The attribute type of the value.',
              example: 'actor-reference',
            },
          },
          required: ['referenced_actor_type', 'referenced_actor_id', 'attribute_type'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            value: {
              type: 'boolean',
              description:
                "A boolean representing whether the checkbox is checked or not. The string values 'true' and 'false' are also accepted.",
              example: true,
            },
            attribute_type: {
              type: 'string',
              enum: ['checkbox'],
              description: 'The attribute type of the value.',
              example: 'checkbox',
            },
          },
          required: ['value', 'attribute_type'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            currency_value: {
              type: 'number',
              description:
                'A numerical representation of the currency value. A decimal with a max of 4 decimal places.',
              example: 99,
            },
            currency_code: {
              type: ['string', 'null'],
              enum: [
                'EUR',
                'GBP',
                'USD',
                'CAD',
                'AUD',
                'NZD',
                'AED',
                'INR',
                'CHF',
                'JPY',
                'CNY',
                'PHP',
                'ILS',
                'SGD',
                'HKD',
                'MYR',
                'NTD',
                'NOK',
                'SEK',
                'ISK',
                'BEL',
                'PLN',
                'KRW',
                'DKK',
                'BRL',
              ],
              description: 'The ISO4217 currency code representing the currency that the value is stored in.',
              example: 'USD',
            },
            attribute_type: {
              type: 'string',
              enum: ['currency'],
              description: 'The attribute type of the value.',
              example: 'currency',
            },
          },
          required: ['currency_value', 'attribute_type'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            attribute_type: {
              type: 'string',
              enum: ['date'],
              description: 'The attribute type of the value.',
              example: 'date',
            },
            value: {
              type: 'string',
              description:
                'A date represents a single calendar year, month and day, independent of timezone. If hours, months, seconds or timezones are provided, they will be trimmed. For example, "2023" and "2023-01" will be coerced into "2023-01-01", and "2023-01-02", "2023-01-02T13:00", "2023-01-02T14:00:00", "2023-01-02T15:00:00.000000000", and "2023-01-02T15:00:00.000000000+02:00" will all be coerced to "2023-01-02". If a timezone is provided that would result in a different calendar date in UTC, the date will be coerced to UTC and then the timezone component will be trimmed. For example, the value "2023-01-02T23:00:00-10:00" will be returned as "2023-01-03". The maximum date is "9999-12-31".',
              example: '2023-01-01',
            },
          },
          required: ['attribute_type', 'value'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            domain: {
              type: 'string',
              example: 'app.attio.com',
            },
            root_domain: {
              type: 'string',
              example: 'attio.com',
            },
            attribute_type: {
              type: 'string',
              enum: ['domain'],
              description: 'The attribute type of the value.',
              example: 'domain',
            },
          },
          required: ['domain', 'root_domain', 'attribute_type'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            original_email_address: {
              type: 'string',
              example: 'alice@app.attio.com',
            },
            email_address: {
              type: 'string',
              example: 'alice@app.attio.com',
            },
            email_domain: {
              type: 'string',
              example: 'app.attio.com',
            },
            email_root_domain: {
              type: 'string',
              example: 'attio.com',
            },
            email_local_specifier: {
              type: 'string',
              example: 'alice',
            },
            attribute_type: {
              type: 'string',
              enum: ['email-address'],
              description: 'The attribute type of the value.',
              example: 'email-address',
            },
          },
          required: [
            'original_email_address',
            'email_address',
            'email_domain',
            'email_root_domain',
            'email_local_specifier',
            'attribute_type',
          ],
        },
        {
          type: 'object',
          properties: {
            target_object: {
              type: 'string',
              description: 'A slug identifying the object that the referenced record belongs to.',
              example: 'people',
            },
            target_record_id: {
              type: 'string',
              format: 'uuid',
              description: 'A UUID to identify the referenced record.',
              example: '891dcbfc-9141-415d-9b2a-2238a6cc012d',
            },
            attribute_type: {
              type: 'string',
              enum: ['record-reference'],
              description: 'The attribute type of the value.',
              example: 'record-reference',
            },
          },
          required: ['target_object', 'target_record_id', 'attribute_type'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            interaction_type: {
              type: 'string',
              enum: ['calendar-event', 'call', 'chat-thread', 'email', 'in-person-meeting'],
              description: 'The type of interaction e.g. calendar or email.',
              example: 'email',
            },
            interacted_at: {
              type: 'string',
              format: 'date-time',
              description: 'When the interaction occurred.',
              example: '2023-01-01T15:00:00.000000000Z',
            },
            owner_actor: {
              type: 'object',
              description: 'The actor that created this value.',
              properties: {
                id: {
                  type: 'string',
                  description: 'An ID to identify the actor.',
                  nullable: true,
                },
                type: {
                  type: 'string',
                  enum: ['api-token', 'workspace-member', 'system'],
                  nullable: true,
                  description: 'The type of actor. [Read more information on actor types here](/docs/actors).',
                },
              },
              example: {
                type: 'workspace-member',
                id: '50cf242c-7fa3-4cad-87d0-75b1af71c57b',
              },
            },
            attribute_type: {
              type: 'string',
              enum: ['interaction'],
              description: 'The attribute type of the value.',
              example: 'interaction',
            },
          },
          required: ['interaction_type', 'interacted_at', 'owner_actor', 'attribute_type'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            line_1: {
              type: ['string', 'null'],
              description:
                'The first line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.',
              example: '1 Infinite Loop',
            },
            line_2: {
              type: ['string', 'null'],
              description:
                'The second line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.',
              example: 'Block 1',
            },
            line_3: {
              type: ['string', 'null'],
              description:
                'The third line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.',
              example: 'Hilldrop Estate',
            },
            line_4: {
              type: ['string', 'null'],
              description:
                'The fourth line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.',
              example: 'Westborough',
            },
            locality: {
              type: ['string', 'null'],
              description: 'The town, neighborhood or area the location is in.',
              example: 'Cupertino',
            },
            region: {
              type: ['string', 'null'],
              description: 'The state, county, province or region that the location is in.',
              example: 'CA',
            },
            postcode: {
              type: ['string', 'null'],
              description:
                'The postcode or zip code for the location. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.}',
              example: '95014',
            },
            country_code: {
              type: ['string', 'null'],
              enum: [
                'AF',
                'AX',
                'AL',
                'DZ',
                'AS',
                'AD',
                'AO',
                'AI',
                'AQ',
                'AG',
                'AR',
                'AM',
                'AW',
                'AU',
                'AT',
                'AZ',
                'BS',
                'BH',
                'BD',
                'BB',
                'BY',
                'BE',
                'BZ',
                'BJ',
                'BM',
                'BT',
                'BO',
                'BA',
                'BW',
                'BV',
                'BR',
                'IO',
                'BN',
                'BG',
                'BF',
                'BI',
                'KH',
                'CM',
                'CA',
                'CV',
                'KY',
                'CF',
                'TD',
                'CL',
                'CN',
                'CX',
                'CC',
                'CO',
                'KM',
                'CG',
                'CD',
                'CK',
                'CR',
                'CI',
                'HR',
                'CU',
                'CW',
                'CY',
                'CZ',
                'DK',
                'DJ',
                'DM',
                'DO',
                'EC',
                'EG',
                'SV',
                'GQ',
                'ER',
                'EE',
                'ET',
                'FK',
                'FO',
                'FJ',
                'FI',
                'FR',
                'GF',
                'PF',
                'TF',
                'GA',
                'GM',
                'GE',
                'DE',
                'GH',
                'GI',
                'GR',
                'GL',
                'GD',
                'GP',
                'GU',
                'GT',
                'GG',
                'GN',
                'GW',
                'GY',
                'HT',
                'HM',
                'VA',
                'HN',
                'HK',
                'HU',
                'IS',
                'IN',
                'ID',
                'IR',
                'IQ',
                'IE',
                'IM',
                'IL',
                'IT',
                'JM',
                'JP',
                'JE',
                'JO',
                'KZ',
                'KE',
                'KI',
                'KR',
                'KW',
                'KG',
                'LA',
                'LV',
                'LB',
                'LS',
                'LR',
                'LY',
                'LI',
                'LT',
                'LU',
                'MO',
                'MK',
                'MG',
                'MW',
                'MY',
                'MV',
                'ML',
                'MT',
                'MH',
                'MQ',
                'MR',
                'MU',
                'YT',
                'MX',
                'FM',
                'MD',
                'MC',
                'MN',
                'ME',
                'MS',
                'MA',
                'MZ',
                'MM',
                'NA',
                'NR',
                'NP',
                'NL',
                'AN',
                'NC',
                'NZ',
                'NI',
                'NE',
                'NG',
                'NU',
                'NF',
                'MP',
                'NO',
                'OM',
                'PK',
                'PW',
                'PS',
                'PA',
                'PG',
                'PY',
                'PE',
                'PH',
                'PN',
                'PL',
                'PT',
                'PR',
                'QA',
                'RE',
                'RO',
                'RU',
                'RW',
                'BL',
                'SH',
                'KN',
                'LC',
                'MF',
                'PM',
                'VC',
                'WS',
                'SM',
                'ST',
                'SA',
                'SN',
                'RS',
                'SC',
                'SL',
                'SG',
                'SK',
                'SI',
                'SB',
                'SO',
                'ZA',
                'GS',
                'ES',
                'LK',
                'SD',
                'SR',
                'SJ',
                'SZ',
                'SE',
                'CH',
                'SY',
                'TW',
                'TJ',
                'TZ',
                'TH',
                'TL',
                'TG',
                'TK',
                'TO',
                'TT',
                'TN',
                'TR',
                'TM',
                'TC',
                'TV',
                'UG',
                'UA',
                'AE',
                'GB',
                'US',
                'UM',
                'UY',
                'UZ',
                'VU',
                'VE',
                'VN',
                'VG',
                'VI',
                'WF',
                'EH',
                'YE',
                'ZM',
                'ZW',
              ],
              description: 'The ISO 3166-1 alpha-2 country code for the country this location is in.',
              example: 'US',
            },
            latitude: {
              type: ['string', 'null'],
              pattern: '^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?)$',
              description:
                'The latitude of the location. Validated by the regular expression `/^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?)$/`. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.}',
              example: '37.331741',
            },
            longitude: {
              type: ['string', 'null'],
              pattern: '^[-+]?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$',
              description:
                'The longitude of the location. Validated by the regular expression `/^[-+]?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$/`',
              example: '-122.030333',
            },
            attribute_type: {
              type: 'string',
              enum: ['location'],
              description: 'The attribute type of the value.',
              example: 'location',
            },
          },
          required: [
            'line_1',
            'line_2',
            'line_3',
            'line_4',
            'locality',
            'region',
            'postcode',
            'country_code',
            'latitude',
            'longitude',
            'attribute_type',
          ],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            value: {
              type: 'number',
              description: 'Numbers are persisted as 64 bit floats.',
              example: 42,
            },
            attribute_type: {
              type: 'string',
              enum: ['number'],
              description: 'The attribute type of the value.',
              example: 'number',
            },
          },
          required: ['value', 'attribute_type'],
        },
        {
          type: 'object',
          properties: {
            first_name: {
              type: 'string',
              description: 'The first name.',
              example: 'Ada',
            },
            last_name: {
              type: 'string',
              description: 'The last name.',
              example: 'Lovelace',
            },
            full_name: {
              type: 'string',
              description: 'The full name.',
              example: 'Ada Lovelace',
            },
            attribute_type: {
              type: 'string',
              enum: ['personal-name'],
              description: 'The attribute type of the value.',
              example: 'personal-name',
            },
          },
          required: ['first_name', 'last_name', 'full_name', 'attribute_type'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            original_phone_number: {
              type: 'string',
              description: 'The raw, original phone number, as inputted.',
              example: '5558675309',
            },
            country_code: {
              type: 'string',
              description:
                'The ISO 3166-1 alpha-2 country code representing the country that this phone number belongs to.',
              enum: [
                'AF',
                'AX',
                'AL',
                'DZ',
                'AS',
                'AD',
                'AO',
                'AI',
                'AQ',
                'AG',
                'AR',
                'AM',
                'AW',
                'AU',
                'AT',
                'AZ',
                'BS',
                'BH',
                'BD',
                'BB',
                'BY',
                'BE',
                'BZ',
                'BJ',
                'BM',
                'BT',
                'BO',
                'BA',
                'BW',
                'BV',
                'BR',
                'IO',
                'BN',
                'BG',
                'BF',
                'BI',
                'KH',
                'CM',
                'CA',
                'CV',
                'KY',
                'CF',
                'TD',
                'CL',
                'CN',
                'CX',
                'CC',
                'CO',
                'KM',
                'CG',
                'CD',
                'CK',
                'CR',
                'CI',
                'HR',
                'CU',
                'CW',
                'CY',
                'CZ',
                'DK',
                'DJ',
                'DM',
                'DO',
                'EC',
                'EG',
                'SV',
                'GQ',
                'ER',
                'EE',
                'ET',
                'FK',
                'FO',
                'FJ',
                'FI',
                'FR',
                'GF',
                'PF',
                'TF',
                'GA',
                'GM',
                'GE',
                'DE',
                'GH',
                'GI',
                'GR',
                'GL',
                'GD',
                'GP',
                'GU',
                'GT',
                'GG',
                'GN',
                'GW',
                'GY',
                'HT',
                'HM',
                'VA',
                'HN',
                'HK',
                'HU',
                'IS',
                'IN',
                'ID',
                'IR',
                'IQ',
                'IE',
                'IM',
                'IL',
                'IT',
                'JM',
                'JP',
                'JE',
                'JO',
                'KZ',
                'KE',
                'KI',
                'KR',
                'KW',
                'KG',
                'LA',
                'LV',
                'LB',
                'LS',
                'LR',
                'LY',
                'LI',
                'LT',
                'LU',
                'MO',
                'MK',
                'MG',
                'MW',
                'MY',
                'MV',
                'ML',
                'MT',
                'MH',
                'MQ',
                'MR',
                'MU',
                'YT',
                'MX',
                'FM',
                'MD',
                'MC',
                'MN',
                'ME',
                'MS',
                'MA',
                'MZ',
                'MM',
                'NA',
                'NR',
                'NP',
                'NL',
                'AN',
                'NC',
                'NZ',
                'NI',
                'NE',
                'NG',
                'NU',
                'NF',
                'MP',
                'NO',
                'OM',
                'PK',
                'PW',
                'PS',
                'PA',
                'PG',
                'PY',
                'PE',
                'PH',
                'PN',
                'PL',
                'PT',
                'PR',
                'QA',
                'RE',
                'RO',
                'RU',
                'RW',
                'BL',
                'SH',
                'KN',
                'LC',
                'MF',
                'PM',
                'VC',
                'WS',
                'SM',
                'ST',
                'SA',
                'SN',
                'RS',
                'SC',
                'SL',
                'SG',
                'SK',
                'SI',
                'SB',
                'SO',
                'ZA',
                'GS',
                'ES',
                'LK',
                'SD',
                'SR',
                'SJ',
                'SZ',
                'SE',
                'CH',
                'SY',
                'TW',
                'TJ',
                'TZ',
                'TH',
                'TL',
                'TG',
                'TK',
                'TO',
                'TT',
                'TN',
                'TR',
                'TM',
                'TC',
                'TV',
                'UG',
                'UA',
                'AE',
                'GB',
                'US',
                'UM',
                'UY',
                'UZ',
                'VU',
                'VE',
                'VN',
                'VG',
                'VI',
                'WF',
                'EH',
                'YE',
                'ZM',
                'ZW',
              ],
              example: 'US',
            },
            phone_number: {
              type: 'string',
              example: '+15558675309',
            },
            attribute_type: {
              type: 'string',
              enum: ['phone-number'],
              description: 'The attribute type of the value.',
              example: 'phone-number',
            },
          },
          required: ['original_phone_number', 'country_code', 'phone_number', 'attribute_type'],
        },
        {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              format: 'uuid',
              description: 'The UUID identifying the selected status.',
              example: '11f07f01-c10f-4e05-a522-33e050bc52ee',
            },
            attribute_type: {
              type: 'string',
              enum: ['status'],
              description: 'The attribute type of the value.',
              example: 'status',
            },
          },
          required: ['status', 'attribute_type'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            status: {
              $ref: '#/components/schemas/status',
            },
            attribute_type: {
              type: 'string',
              enum: ['status'],
              description: 'The attribute type of the value.',
              example: 'status',
            },
          },
          required: ['status', 'attribute_type'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            value: {
              type: 'number',
              description: 'A number between 0 and 5 (inclusive) to represent a star rating.',
              example: 3,
            },
            attribute_type: {
              type: 'string',
              enum: ['rating'],
              description: 'The attribute type of the value.',
              example: 'rating',
            },
          },
          required: ['value', 'attribute_type'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            option: {
              type: 'string',
              format: 'uuid',
              description: 'The UUID identifying the selected select option.',
              example: '08c2c59a-c18e-40c6-8dc4-95415313b2ea',
            },
            attribute_type: {
              type: 'string',
              enum: ['select'],
              description: 'The attribute type of the value.',
              example: 'select',
            },
          },
          required: ['option', 'attribute_type'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            option: {
              $ref: '#/components/schemas/select-option',
            },
            attribute_type: {
              type: 'string',
              enum: ['select'],
              description: 'The attribute type of the value.',
              example: 'select',
            },
          },
          required: ['option', 'attribute_type'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            value: {
              type: 'string',
              description: 'A raw text field. Values are limited to 10MB.',
              example:
                'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
            },
            attribute_type: {
              type: 'string',
              enum: ['text'],
              description: 'The attribute type of the value.',
              example: 'text',
            },
          },
          required: ['value', 'attribute_type'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            attribute_type: {
              type: 'string',
              enum: ['timestamp'],
              description: 'The attribute type of the value.',
              example: 'timestamp',
            },
            value: {
              type: 'string',
              description:
                'A timestamp value represents a single, universal moment in time using an ISO 8601 formatted string. This means that a timestamp consists of a date, a time (with nanosecond precision), and a time zone. Attio will coerce timestamps which do not provide full nanosecond precision and UTC is assumed if no time zone is provided. For example, "2023", "2023-01", "2023-01-02", "2023-01-02T13:00", "2023-01-02T13:00:00", and "2023-01-02T13:00:00.000000000" will all be coerced to "2023-01-02T13:00:00.000000000Z". Timestamps are always returned in UTC. For example, writing a timestamp value using the string "2023-01-02T13:00:00.000000000+02:00" will result in the value "2023-01-02T11:00:00.000000000Z" being returned. The maximum date is "9999-12-31T23:59:59.999999999Z".',
              format: 'date',
              example: '2023-01-01T15:00:00.000000000Z',
            },
          },
          required: ['attribute_type', 'value'],
          additionalProperties: false,
        },
      ],
      description: 'A union of possible value types, as returned in response bodies.',
    },
    attribute: {
      type: 'object',
      properties: {
        id: {
          type: 'object',
          properties: {
            workspace_id: {
              type: 'string',
              format: 'uuid',
              description: 'A UUID representing the workspace this attribute belongs to.',
              example: '14beef7a-99f7-4534-a87e-70b564330a4c',
            },
            object_id: {
              type: 'string',
              format: 'uuid',
              description: 'A UUID to identify the object or list that this attribute belongs to',
              example: '97052eb9-e65e-443f-a297-f2d9a4a7f795',
            },
            attribute_id: {
              type: 'string',
              format: 'uuid',
              description: 'A UUID to identify this attribute.',
              example: '41252299-f8c7-4b5e-99c9-4ff8321d2f96',
            },
          },
          required: ['workspace_id', 'object_id', 'attribute_id'],
        },
        title: {
          type: 'string',
          description: 'A title for the attribute, to be displayed across the app.',
          example: 'Rating',
        },
        description: {
          type: ['string', 'null'],
          description: 'A text description of the attribute.',
          example: 'A rating attribute',
        },
        api_slug: {
          type: 'string',
          description: 'A unique slug for the attribute for use in API responses and URLs. Formatted in snake case.',
          example: 'my-rating',
        },
        type: {
          type: 'string',
          enum: [
            'text',
            'number',
            'checkbox',
            'currency',
            'date',
            'timestamp',
            'rating',
            'status',
            'select',
            'record-reference',
            'actor-reference',
            'location',
            'domain',
            'email-address',
            'phone-number',
            'interaction',
            'personal-name',
          ],
          description: 'The type of the attribute.',
          example: 'text',
        },
        is_system_attribute: {
          type: 'boolean',
          description:
            '`true` if this is an Attio system-defined attribute, `false` if defined by a user or non-Attio system.',
          example: true,
        },
        is_writable: {
          type: 'boolean',
          description:
            'Whether or not this attribute can be written to. Can only be false when `is_system_attribute` is `true` (user-defined attributes are always writeable). If `false`, this usually means the attribute is enriched by Attio.',
          example: true,
        },
        is_required: {
          type: 'boolean',
          description:
            'When `is_required` is `true`, new records/entries must have a value for this attribute. If `false`, values may be `null`. This value does not affect existing data and you do not need to backfill `null` values if changing `is_required` from `false` to `true`.',
          example: true,
        },
        is_unique: {
          type: 'boolean',
          description:
            'Whether or not new values for this attribute must be unique. Uniqueness restrictions are only applied to new data and do not apply retroactively to previously created data.',
          example: true,
        },
        is_multiselect: {
          type: 'boolean',
          description:
            'Whether or not this attribute can have multiple values. Multiselect is only available on some value types.',
          example: true,
        },
        is_default_value_enabled: {
          type: 'boolean',
          description:
            'Whether this attribute has a default value enabled. Must be `true` when `is_required` is `true`.',
          example: true,
        },
        is_archived: {
          type: 'boolean',
          description:
            'Whether this attribute has been archived. Archived attributes are hidden from most UI, but can be restored either over the API or in workspace settings. See the [guide on archiving and deleting](/docs/archiving-vs-deleting)for more information.',
          example: false,
        },
        default_value: {
          anyOf: [
            {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['dynamic'],
                  example: 'dynamic',
                },
                template: {
                  anyOf: [
                    {
                      type: 'string',
                      enum: ['current-user'],
                      description:
                        'For actor reference attributes, you may pass a dynamic value of `"current-user"`. When creating new records or entries, this will cause the actor reference value to be populated with either the workspace member or API token that created the record/entry.',
                      example: 'current-user',
                    },
                    {
                      type: 'string',
                      description:
                        'Timestamp attributes may use an ISO 8601 duration as a dynamic value. For example, `"P1M"` would set the value to the current time plus one month.',
                      example: 'P1M',
                    },
                    {
                      type: 'string',
                      description:
                        'Date attributes may use an ISO 8601 duration as a dynamic value. For example, `"P1M"` would set the value to the current time plus one month.',
                      example: 'P1M',
                    },
                  ],
                },
              },
              required: ['type', 'template'],
            },
            {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['static'],
                  example: 'static',
                },
                template: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/output-value',
                  },
                  example: [
                    {
                      value: 'Some default text',
                      attribute_type: 'text',
                    },
                  ],
                },
              },
              required: ['type', 'template'],
            },
            {
              type: 'null',
            },
          ],
          description:
            'The default value for this attribute. Static values are used to directly populate values using their contents. Dynamic values are used to lookup data at the point of creation. For example, you could use a dynamic value to insert a value for the currently logged in user. Which default values are available is dependent on the type of the attribute.',
        },
        relationship: {
          type: ['object', 'null'],
          properties: {
            id: {
              type: 'object',
              properties: {
                workspace_id: {
                  type: 'string',
                  format: 'uuid',
                  description: 'A UUID representing the workspace this attribute belongs to.',
                  example: '14beef7a-99f7-4534-a87e-70b564330a4c',
                },
                object_id: {
                  type: 'string',
                  format: 'uuid',
                  description: 'A UUID to identify the object or list that this attribute belongs to',
                  example: '97052eb9-e65e-443f-a297-f2d9a4a7f795',
                },
                attribute_id: {
                  type: 'string',
                  format: 'uuid',
                  description: 'A UUID to identify this attribute.',
                  example: '41252299-f8c7-4b5e-99c9-4ff8321d2f96',
                },
              },
              required: ['workspace_id', 'object_id', 'attribute_id'],
            },
          },
          required: ['id'],
          description:
            'If this attribute is related to another attribute, this is an object that includes an `id` property that identifies the other attribute. `null` means no relationship exists. See [the help center](https://attio.com/help/reference/managing-your-data/attributes#relationship-attributes) for more details about relationship attributes.',
        },
        created_at: {
          type: 'string',
          description: 'When this attribute was created.',
          example: '2022-11-21T13:22:49.061281000Z',
        },
        config: {
          type: 'object',
          properties: {
            currency: {
              type: 'object',
              properties: {
                default_currency_code: {
                  type: ['string', 'null'],
                  enum: [
                    'EUR',
                    'GBP',
                    'USD',
                    'CAD',
                    'AUD',
                    'NZD',
                    'AED',
                    'INR',
                    'CHF',
                    'JPY',
                    'CNY',
                    'PHP',
                    'ILS',
                    'SGD',
                    'HKD',
                    'MYR',
                    'NTD',
                    'NOK',
                    'SEK',
                    'ISK',
                    'BEL',
                    'PLN',
                    'KRW',
                    'DKK',
                    'BRL',
                  ],
                  description:
                    'The ISO4217 code representing the currency that values for this attribute should be stored in.',
                  example: 'USD',
                },
                display_type: {
                  type: ['string', 'null'],
                  enum: ['code', 'name', 'narrowSymbol', 'symbol'],
                  description:
                    'How the currency should be displayed across the app. "code" will display the ISO currency code e.g. "USD", "name" will display the localized currency name e.g. "British pound", "narrowSymbol" will display "$1" instead of "US$1" and "symbol" will display a localized currency symbol such as "$".',
                  example: 'code',
                },
              },
              required: ['default_currency_code', 'display_type'],
              description: 'Configuration available for attributes of type "currency".',
            },
            record_reference: {
              type: 'object',
              properties: {
                allowed_object_ids: {
                  type: ['array', 'null'],
                  items: {
                    type: 'string',
                    format: 'uuid',
                    example: '97052eb9-e65e-443f-a297-f2d9a4a7f795',
                  },
                  description:
                    'A list of UUIDs to indicate which objects records are allowed to belong to. Leave empty to to allow records from all object types.',
                },
              },
              required: ['allowed_object_ids'],
              description: 'Configuration available for attributes of type "record-reference".',
            },
          },
          required: ['currency', 'record_reference'],
          description: 'Additional, type-dependent configuration for the attribute.',
        },
      },
      required: [
        'id',
        'title',
        'description',
        'api_slug',
        'type',
        'is_system_attribute',
        'is_writable',
        'is_required',
        'is_unique',
        'is_multiselect',
        'is_default_value_enabled',
        'is_archived',
        'default_value',
        'relationship',
        'created_at',
        'config',
      ],
      example: {
        id: {
          workspace_id: '14beef7a-99f7-4534-a87e-70b564330a4c',
          object_id: '97052eb9-e65e-443f-a297-f2d9a4a7f795',
          attribute_id: '41252299-f8c7-4b5e-99c9-4ff8321d2f96',
        },
        title: 'Rating',
        description: 'Rating of the record out of 5',
        api_slug: 'Rating',
        type: 'rating',
        is_system_attribute: false,
        is_writable: true,
        is_required: false,
        is_unique: false,
        is_multiselect: false,
        is_default_value_enabled: false,
        is_archived: false,
        default_value: null,
        relationship: null,
        created_at: '2021-11-21T13:22:49.061Z',
        config: {
          currency: {
            default_currency_code: null,
            display_type: null,
          },
          record_reference: {
            allowed_object_ids: null,
          },
        },
      },
    },
    list: {
      type: 'object',
      properties: {
        id: {
          type: 'object',
          properties: {
            workspace_id: {
              type: 'string',
              format: 'uuid',
              description: 'A UUID to identify the workspace this list belongs to.',
              example: '14beef7a-99f7-4534-a87e-70b564330a4c',
            },
            list_id: {
              type: 'string',
              format: 'uuid',
              description: 'A UUID to identify this list.',
              example: '33ebdbe9-e529-47c9-b894-0ba25e9c15c0',
            },
          },
          required: ['workspace_id', 'list_id'],
        },
        api_slug: {
          type: 'string',
          description: 'A human-readable slug for use in URLs and responses.',
          example: 'hiring-engineering',
        },
        name: {
          type: 'string',
          description: 'The name of the list, as viewed in the UI.',
          example: 'Hiring Engineering',
        },
        parent_object: {
          type: 'array',
          items: {
            type: 'string',
          },
          description:
            'A UUID or slug to identify the allowed object type for records added to this list. All new Lists are expected to have exactly one parent object. However, some legacy lists may have multiple allowed parents so the return type of this field is an array.',
          example: ['people'],
        },
        workspace_access: {
          type: ['string', 'null'],
          enum: ['full-access', 'read-and-write', 'read-only'],
          description:
            'The level of access granted to all members of the workspace for this list. `null` values represent a private list that only grants access to specific workspace members via the `workspace_member_access` property.',
          example: 'read-and-write',
        },
        workspace_member_access: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              workspace_member_id: {
                type: 'string',
                format: 'uuid',
                description: 'A UUID to identify the workspace member to grant access to.',
                example: '50cf242c-7fa3-4cad-87d0-75b1af71c57b',
              },
              level: {
                type: 'string',
                enum: ['full-access', 'read-and-write', 'read-only'],
                description: 'The level of access to the list.',
                example: 'read-and-write',
              },
            },
            required: ['workspace_member_id', 'level'],
          },
          description:
            'The level of access granted to specific workspace members for this list. An empty array represents a list that has granted access to no workspace members.',
        },
        created_by_actor: {
          type: 'object',
          description: 'The actor which created this list.',
          properties: {
            id: {
              type: 'string',
              description: 'An ID to identify the actor.',
              nullable: true,
            },
            type: {
              type: 'string',
              enum: ['api-token', 'workspace-member', 'system'],
              nullable: true,
              description: 'The type of actor. [Read more information on actor types here](/docs/actors).',
            },
          },
          example: {
            type: 'workspace-member',
            id: '50cf242c-7fa3-4cad-87d0-75b1af71c57b',
          },
        },
        created_at: {
          type: 'string',
          description: 'When the list was created.',
          example: '2022-11-21T13:22:49.061281000Z',
        },
      },
      required: [
        'id',
        'api_slug',
        'name',
        'parent_object',
        'workspace_access',
        'workspace_member_access',
        'created_by_actor',
        'created_at',
      ],
    },
    object: {
      type: 'object',
      properties: {
        id: {
          type: 'object',
          properties: {
            workspace_id: {
              type: 'string',
              format: 'uuid',
              description: 'A UUID to identify the workspace this object belongs to.',
              example: '14beef7a-99f7-4534-a87e-70b564330a4c',
            },
            object_id: {
              type: 'string',
              format: 'uuid',
              description: 'A UUID to identify the object.',
              example: '97052eb9-e65e-443f-a297-f2d9a4a7f795',
            },
          },
          required: ['workspace_id', 'object_id'],
        },
        api_slug: {
          type: ['string', 'null'],
          description:
            'A unique, human-readable slug to access the object through URLs and API calls. Formatted in snake case.',
          example: 'people',
        },
        singular_noun: {
          type: ['string', 'null'],
          description: "The singular form of the object's name.",
          example: 'Person',
        },
        plural_noun: {
          type: ['string', 'null'],
          description: "The plural form of the object's name.",
          example: 'People',
        },
        created_at: {
          type: 'string',
          description: 'When the object was created.',
          example: '2022-11-21T13:22:49.061281000Z',
        },
      },
      required: ['id', 'api_slug', 'singular_noun', 'plural_noun', 'created_at'],
    },
    'workspace-member': {
      type: 'object',
      properties: {
        id: {
          type: 'object',
          properties: {
            workspace_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the workspace the workspace member belongs to.',
              example: '14beef7a-99f7-4534-a87e-70b564330a4c',
            },
            workspace_member_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the workspace member.',
              example: '50cf242c-7fa3-4cad-87d0-75b1af71c57b',
            },
          },
          required: ['workspace_id', 'workspace_member_id'],
        },
        first_name: {
          type: 'string',
          description: 'The first name of the user.',
          example: 'Susan',
        },
        last_name: {
          type: 'string',
          description: 'The last name of the user.',
          example: 'Kare',
        },
        avatar_url: {
          type: ['string', 'null'],
          format: 'uri',
          description: "A URL to the user's avatar image.",
          example: 'https://lh3.googleusercontent.com/a/ABdFTp7z6OgAW9EqZx78wTqPfWClGCJCZXFjQfBG7rd9=s96-c',
        },
        email_address: {
          type: 'string',
          format: 'email',
          description: "The user's email address.",
          example: 'susan.kare@apple.com',
        },
        created_at: {
          type: 'string',
          description: 'When the workspace member was created.',
          example: '2022-11-21T13:22:49.061281000Z',
        },
        access_level: {
          type: 'string',
          enum: ['admin', 'member', 'suspended'],
          description:
            'Whether the workspace member is suspended or not and what level of privileges they have inside the workspace. We do not delete workspace members so that you can successfully attribute past actions to suspended workspace members.',
          example: 'member',
        },
      },
      required: ['id', 'first_name', 'last_name', 'avatar_url', 'email_address', 'created_at', 'access_level'],
    },
    comment: {
      type: 'object',
      properties: {
        id: {
          type: 'object',
          properties: {
            workspace_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the workspace the comment belongs to.',
              example: '14beef7a-99f7-4534-a87e-70b564330a4c',
            },
            comment_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the comment.',
              example: 'aa1dc1d9-93ac-4c6c-987e-16b6eea9aab2',
            },
          },
          required: ['workspace_id', 'comment_id'],
        },
        thread_id: {
          type: 'string',
          format: 'uuid',
          description: 'The ID of the thread the comment belongs to.',
          example: 'aa1dc1d9-93ac-4c6c-987e-16b6eea9aab2',
        },
        content_plaintext: {
          type: 'string',
          description:
            'A plaintext representation of the content of the comment. References to workspace members are cast into email addresses, all other stylistic elements are removed.',
          example: "Let's go ahead and close this deal, alice@attio.com.",
        },
        entry: {
          type: ['object', 'null'],
          properties: {
            entry_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the entry the comment belongs to.',
              example: '2e6e29ea-c4e0-4f44-842d-78a891f8c156',
            },
            list_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the list the entry belongs to.',
              example: '33ebdbe9-e529-47c9-b894-0ba25e9c15c0',
            },
          },
          required: ['entry_id', 'list_id'],
          description: 'The entry the comment belongs to, `null` for comments on records.',
        },
        record: {
          type: 'object',
          properties: {
            record_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the record the comment belongs to.',
              example: 'bf071e1f-6035-429d-b874-d83ea64ea13b',
            },
            object_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the object the record belongs to.',
              example: '97052eb9-e65e-443f-a297-f2d9a4a7f795',
            },
          },
          required: ['record_id', 'object_id'],
          description: 'The record the comment belongs to.',
        },
        resolved_at: {
          type: ['string', 'null'],
          description: 'Whether the comment is resolved.',
          example: '2023-01-01T15:00:00.000000000Z',
        },
        resolved_by: {
          type: 'object',
          description: 'The actor that resolved this comment.',
          properties: {
            id: {
              type: 'string',
              description: 'An ID to identify the actor.',
              nullable: true,
            },
            type: {
              type: 'string',
              enum: ['api-token', 'workspace-member', 'system'],
              nullable: true,
              description: 'The type of actor. [Read more information on actor types here](/docs/actors).',
            },
          },
          example: {
            type: 'workspace-member',
            id: '50cf242c-7fa3-4cad-87d0-75b1af71c57b',
          },
        },
        created_at: {
          type: 'string',
          description: 'When the note was created.',
          example: '2023-01-01T15:00:00.000000000Z',
        },
        author: {
          type: 'object',
          description:
            'Who wrote this comment. Note that the API provides the ability for API tokens to write comments on behalf of other actors.',
          properties: {
            id: {
              type: 'string',
              description: 'An ID to identify the actor.',
              nullable: true,
            },
            type: {
              type: 'string',
              enum: ['api-token', 'workspace-member', 'system'],
              nullable: true,
              description: 'The type of actor. [Read more information on actor types here](/docs/actors).',
            },
          },
          example: {
            type: 'workspace-member',
            id: '50cf242c-7fa3-4cad-87d0-75b1af71c57b',
          },
        },
      },
      required: [
        'id',
        'thread_id',
        'content_plaintext',
        'entry',
        'record',
        'resolved_at',
        'resolved_by',
        'created_at',
        'author',
      ],
    },
    note: {
      type: 'object',
      properties: {
        id: {
          type: 'object',
          properties: {
            workspace_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the workspace the note belongs to.',
              example: '14beef7a-99f7-4534-a87e-70b564330a4c',
            },
            note_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the note.',
              example: 'ff3f3bd4-40f4-4f80-8187-cd02385af424',
            },
          },
          required: ['workspace_id', 'note_id'],
        },
        parent_object: {
          type: 'string',
          description: 'The slug or ID of the parent object the note belongs to.',
          example: 'people',
        },
        parent_record_id: {
          type: 'string',
          format: 'uuid',
          description: 'The ID of the parent record the note belongs to.',
          example: '891dcbfc-9141-415d-9b2a-2238a6cc012d',
        },
        title: {
          type: 'string',
          description: 'The note title. The title is plaintext only and has no formatting.',
          example: 'Initial Prospecting Call Summary',
        },
        content_plaintext: {
          type: 'string',
          description:
            'The plaintext representation of the note content. The line feed character `\\n` represents new lines within the note content.',
          example:
            'Introduction\nDate and time of the call\nParticipants\nPurpose of the call\nCustomer Background\nCompany overview (industry, size, location)\nKey business challenges\nCurrent software solutions (if any) and pain points',
        },
        created_by_actor: {
          type: 'object',
          description: 'The actor that created this note.',
          properties: {
            id: {
              type: 'string',
              description: 'An ID to identify the actor.',
              nullable: true,
            },
            type: {
              type: 'string',
              enum: ['api-token', 'workspace-member', 'system'],
              nullable: true,
              description: 'The type of actor. [Read more information on actor types here](/docs/actors).',
            },
          },
          example: {
            type: 'workspace-member',
            id: '50cf242c-7fa3-4cad-87d0-75b1af71c57b',
          },
        },
        created_at: {
          type: 'string',
          description: 'When the note was created.',
          example: '2022-11-21T13:22:49.061281000Z',
        },
      },
      required: [
        'id',
        'parent_object',
        'parent_record_id',
        'title',
        'content_plaintext',
        'created_by_actor',
        'created_at',
      ],
    },
    task: {
      type: 'object',
      properties: {
        id: {
          type: 'object',
          properties: {
            workspace_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the workspace the task belongs to.',
              example: '14beef7a-99f7-4534-a87e-70b564330a4c',
            },
            task_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the task.',
              example: '649e34f4-c39a-4f4d-99ef-48a36bef8f04',
            },
          },
          required: ['workspace_id', 'task_id'],
        },
        content_plaintext: {
          type: 'string',
          description:
            'The plaintext representation of the task content. Inline linked records will appear as "@record name" and are returned in the `linked_records` property.',
          example: 'Follow up on current software solutions',
        },
        deadline_at: {
          type: ['string', 'null'],
          description: 'The deadline date of the task. Returned as an ISO 8601 timestamp.',
          example: '2023-01-01',
        },
        is_completed: {
          type: 'boolean',
          description: 'Whether the task has been completed.',
          example: false,
        },
        linked_records: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              target_object_id: {
                type: 'string',
                description:
                  'The ID of the parent object the task refers to. At present, only `people` and `companies` are supported.',
                example: 'people',
              },
              target_record_id: {
                type: 'string',
                format: 'uuid',
                description: 'The ID of the parent record the task refers to.',
                example: '891dcbfc-9141-415d-9b2a-2238a6cc012d',
              },
            },
            required: ['target_object_id', 'target_record_id'],
          },
          description:
            'Records linked to the task. Creating record links within task content text is not possible via the API at present.',
        },
        assignees: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              referenced_actor_type: {
                type: 'string',
                enum: ['api-token', 'workspace-member', 'system'],
                description: 'The type of actor. [Read more information on actor types here](/docs/actors).',
                example: 'workspace-member',
              },
              referenced_actor_id: {
                type: 'string',
                format: 'uuid',
                description: 'The ID of the workspace member actor assigned to this task.',
                example: '50cf242c-7fa3-4cad-87d0-75b1af71c57b',
              },
            },
            required: ['referenced_actor_type', 'referenced_actor_id'],
          },
          description: 'Workspace members assigned to this task.',
        },
        created_by_actor: {
          type: 'object',
          description: 'The actor that created this task.',
          properties: {
            id: {
              type: 'string',
              description: 'An ID to identify the actor.',
              nullable: true,
            },
            type: {
              type: 'string',
              enum: ['api-token', 'workspace-member', 'system'],
              nullable: true,
              description: 'The type of actor. [Read more information on actor types here](/docs/actors).',
            },
          },
          example: {
            type: 'workspace-member',
            id: '50cf242c-7fa3-4cad-87d0-75b1af71c57b',
          },
        },
        created_at: {
          type: 'string',
          description: 'When the task was created.',
          example: '2022-11-21T13:22:49.061281000Z',
        },
      },
      required: [
        'id',
        'content_plaintext',
        'deadline_at',
        'is_completed',
        'linked_records',
        'assignees',
        'created_by_actor',
        'created_at',
      ],
    },
    thread: {
      type: 'object',
      properties: {
        id: {
          type: 'object',
          properties: {
            workspace_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the workspace the thread belongs to.',
              example: '14beef7a-99f7-4534-a87e-70b564330a4c',
            },
            thread_id: {
              type: 'string',
              format: 'uuid',
              description: 'The ID of the thread.',
              example: 'a649e4d9-435c-43fb-83ba-847b4876f27a',
            },
          },
          required: ['workspace_id', 'thread_id'],
        },
        comments: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/comment',
          },
          minItems: 1,
          description: 'An array of comments in the thread, sorted by `created_at`.',
        },
        created_at: {
          type: 'string',
          description: 'When the thread was created.',
          example: '2023-01-01T15:00:00.000000000Z',
        },
      },
      required: ['id', 'comments', 'created_at'],
    },
  },
  parameters: {},
} as TComponents;
