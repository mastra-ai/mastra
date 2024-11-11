// @ts-nocheck
export type openapi = {
  openapi: '3.0.0';
  servers: [
    {
      url: 'https://adsense.googleapis.com/';
    },
  ];
  externalDocs: {
    url: 'https://developers.google.com/adsense/management/';
  };
  paths: {
    '/v2/accounts': {
      get: {
        description: 'Lists all accounts available to this user.';
        operationId: 'adsense.accounts.list';
        parameters: [
          {
            description: 'The maximum number of accounts to include in the response, used for paging. If unspecified, at most 10000 accounts will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.';
            in: 'query';
            name: 'pageSize';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'A page token, received from a previous `ListAccounts` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListAccounts` must match the call that provided the page token.';
            in: 'query';
            name: 'pageToken';
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
                  $ref: '#/components/schemas/ListAccountsResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/v2/{account}/reports:generate': {
      get: {
        description: 'Generates an ad hoc report.';
        operationId: 'adsense.accounts.reports.generate';
        parameters: [
          {
            description: 'Required. The account which owns the collection of reports. Format: accounts/{account}';
            in: 'path';
            name: 'account';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: "The [ISO-4217 currency code](https://en.wikipedia.org/wiki/ISO_4217) to use when reporting on monetary metrics. Defaults to the account's currency if not set.";
            in: 'query';
            name: 'currencyCode';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Date range of the report, if unset the range will be considered CUSTOM.';
            in: 'query';
            name: 'dateRange';
            schema: {
              enum: [
                'REPORTING_DATE_RANGE_UNSPECIFIED',
                'CUSTOM',
                'TODAY',
                'YESTERDAY',
                'MONTH_TO_DATE',
                'YEAR_TO_DATE',
                'LAST_7_DAYS',
                'LAST_30_DAYS',
              ];
              type: 'string';
            };
          },
          {
            description: 'Dimensions to base the report on.';
            explode: true;
            in: 'query';
            name: 'dimensions';
            schema: {
              items: {
                enum: [
                  'DIMENSION_UNSPECIFIED',
                  'DATE',
                  'WEEK',
                  'MONTH',
                  'ACCOUNT_NAME',
                  'AD_CLIENT_ID',
                  'HOSTED_AD_CLIENT_ID',
                  'PRODUCT_NAME',
                  'PRODUCT_CODE',
                  'AD_UNIT_NAME',
                  'AD_UNIT_ID',
                  'AD_UNIT_SIZE_NAME',
                  'AD_UNIT_SIZE_CODE',
                  'CUSTOM_CHANNEL_NAME',
                  'CUSTOM_CHANNEL_ID',
                  'OWNED_SITE_DOMAIN_NAME',
                  'OWNED_SITE_ID',
                  'PAGE_URL',
                  'URL_CHANNEL_NAME',
                  'URL_CHANNEL_ID',
                  'BUYER_NETWORK_NAME',
                  'BUYER_NETWORK_ID',
                  'BID_TYPE_NAME',
                  'BID_TYPE_CODE',
                  'CREATIVE_SIZE_NAME',
                  'CREATIVE_SIZE_CODE',
                  'DOMAIN_NAME',
                  'DOMAIN_CODE',
                  'COUNTRY_NAME',
                  'COUNTRY_CODE',
                  'PLATFORM_TYPE_NAME',
                  'PLATFORM_TYPE_CODE',
                  'TARGETING_TYPE_NAME',
                  'TARGETING_TYPE_CODE',
                  'CONTENT_PLATFORM_NAME',
                  'CONTENT_PLATFORM_CODE',
                  'AD_PLACEMENT_NAME',
                  'AD_PLACEMENT_CODE',
                  'REQUESTED_AD_TYPE_NAME',
                  'REQUESTED_AD_TYPE_CODE',
                  'SERVED_AD_TYPE_NAME',
                  'SERVED_AD_TYPE_CODE',
                  'AD_FORMAT_NAME',
                  'AD_FORMAT_CODE',
                  'CUSTOM_SEARCH_STYLE_NAME',
                  'CUSTOM_SEARCH_STYLE_ID',
                  'DOMAIN_REGISTRANT',
                  'WEBSEARCH_QUERY_STRING',
                ];
                type: 'string';
              };
              type: 'array';
            };
            style: 'form';
          },
          {
            description: "Day of a month. Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant.";
            in: 'query';
            name: 'endDate.day';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Month of a year. Must be from 1 to 12, or 0 to specify a year without a month and day.';
            in: 'query';
            name: 'endDate.month';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Year of the date. Must be from 1 to 9999, or 0 to specify a date without a year.';
            in: 'query';
            name: 'endDate.year';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'A list of [filters](/adsense/management/reporting/filtering) to apply to the report. All provided filters must match in order for the data to be included in the report.';
            explode: true;
            in: 'query';
            name: 'filters';
            schema: {
              items: {
                type: 'string';
              };
              type: 'array';
            };
            style: 'form';
          },
          {
            description: 'The language to use for translating report output. If unspecified, this defaults to English ("en"). If the given language is not supported, report output will be returned in English. The language is specified as an [IETF BCP-47 language code](https://en.wikipedia.org/wiki/IETF_language_tag).';
            in: 'query';
            name: 'languageCode';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The maximum number of rows of report data to return. Reports producing more rows than the requested limit will be truncated. If unset, this defaults to 100,000 rows for `Reports.GenerateReport` and 1,000,000 rows for `Reports.GenerateCsvReport`, which are also the maximum values permitted here. Report truncation can be identified (for `Reports.GenerateReport` only) by comparing the number of rows returned to the value returned in `total_matched_rows`.';
            in: 'query';
            name: 'limit';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Required. Reporting metrics.';
            explode: true;
            in: 'query';
            name: 'metrics';
            schema: {
              items: {
                enum: [
                  'METRIC_UNSPECIFIED',
                  'PAGE_VIEWS',
                  'AD_REQUESTS',
                  'MATCHED_AD_REQUESTS',
                  'TOTAL_IMPRESSIONS',
                  'IMPRESSIONS',
                  'INDIVIDUAL_AD_IMPRESSIONS',
                  'CLICKS',
                  'PAGE_VIEWS_SPAM_RATIO',
                  'AD_REQUESTS_SPAM_RATIO',
                  'MATCHED_AD_REQUESTS_SPAM_RATIO',
                  'IMPRESSIONS_SPAM_RATIO',
                  'INDIVIDUAL_AD_IMPRESSIONS_SPAM_RATIO',
                  'CLICKS_SPAM_RATIO',
                  'AD_REQUESTS_COVERAGE',
                  'PAGE_VIEWS_CTR',
                  'AD_REQUESTS_CTR',
                  'MATCHED_AD_REQUESTS_CTR',
                  'IMPRESSIONS_CTR',
                  'INDIVIDUAL_AD_IMPRESSIONS_CTR',
                  'ACTIVE_VIEW_MEASURABILITY',
                  'ACTIVE_VIEW_VIEWABILITY',
                  'ACTIVE_VIEW_TIME',
                  'ESTIMATED_EARNINGS',
                  'PAGE_VIEWS_RPM',
                  'AD_REQUESTS_RPM',
                  'MATCHED_AD_REQUESTS_RPM',
                  'IMPRESSIONS_RPM',
                  'INDIVIDUAL_AD_IMPRESSIONS_RPM',
                  'COST_PER_CLICK',
                  'ADS_PER_IMPRESSION',
                  'TOTAL_EARNINGS',
                  'WEBSEARCH_RESULT_PAGES',
                  'FUNNEL_REQUESTS',
                  'FUNNEL_IMPRESSIONS',
                  'FUNNEL_CLICKS',
                  'FUNNEL_RPM',
                ];
                type: 'string';
              };
              type: 'array';
            };
            style: 'form';
          },
          {
            description: 'The name of a dimension or metric to sort the resulting report on, can be prefixed with "+" to sort ascending or "-" to sort descending. If no prefix is specified, the column is sorted ascending.';
            explode: true;
            in: 'query';
            name: 'orderBy';
            schema: {
              items: {
                type: 'string';
              };
              type: 'array';
            };
            style: 'form';
          },
          {
            description: 'Timezone in which to generate the report. If unspecified, this defaults to the account timezone. For more information, see [changing the time zone of your reports](https://support.google.com/adsense/answer/9830725).';
            in: 'query';
            name: 'reportingTimeZone';
            schema: {
              enum: ['REPORTING_TIME_ZONE_UNSPECIFIED', 'ACCOUNT_TIME_ZONE', 'GOOGLE_TIME_ZONE'];
              type: 'string';
            };
          },
          {
            description: "Day of a month. Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant.";
            in: 'query';
            name: 'startDate.day';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Month of a year. Must be from 1 to 12, or 0 to specify a year without a month and day.';
            in: 'query';
            name: 'startDate.month';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Year of the date. Must be from 1 to 9999, or 0 to specify a date without a year.';
            in: 'query';
            name: 'startDate.year';
            schema: {
              type: 'integer';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ReportResult';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/v2/{account}/reports:generateCsv': {
      get: {
        description: 'Generates a csv formatted ad hoc report.';
        operationId: 'adsense.accounts.reports.generateCsv';
        parameters: [
          {
            description: 'Required. The account which owns the collection of reports. Format: accounts/{account}';
            in: 'path';
            name: 'account';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: "The [ISO-4217 currency code](https://en.wikipedia.org/wiki/ISO_4217) to use when reporting on monetary metrics. Defaults to the account's currency if not set.";
            in: 'query';
            name: 'currencyCode';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Date range of the report, if unset the range will be considered CUSTOM.';
            in: 'query';
            name: 'dateRange';
            schema: {
              enum: [
                'REPORTING_DATE_RANGE_UNSPECIFIED',
                'CUSTOM',
                'TODAY',
                'YESTERDAY',
                'MONTH_TO_DATE',
                'YEAR_TO_DATE',
                'LAST_7_DAYS',
                'LAST_30_DAYS',
              ];
              type: 'string';
            };
          },
          {
            description: 'Dimensions to base the report on.';
            explode: true;
            in: 'query';
            name: 'dimensions';
            schema: {
              items: {
                enum: [
                  'DIMENSION_UNSPECIFIED',
                  'DATE',
                  'WEEK',
                  'MONTH',
                  'ACCOUNT_NAME',
                  'AD_CLIENT_ID',
                  'HOSTED_AD_CLIENT_ID',
                  'PRODUCT_NAME',
                  'PRODUCT_CODE',
                  'AD_UNIT_NAME',
                  'AD_UNIT_ID',
                  'AD_UNIT_SIZE_NAME',
                  'AD_UNIT_SIZE_CODE',
                  'CUSTOM_CHANNEL_NAME',
                  'CUSTOM_CHANNEL_ID',
                  'OWNED_SITE_DOMAIN_NAME',
                  'OWNED_SITE_ID',
                  'PAGE_URL',
                  'URL_CHANNEL_NAME',
                  'URL_CHANNEL_ID',
                  'BUYER_NETWORK_NAME',
                  'BUYER_NETWORK_ID',
                  'BID_TYPE_NAME',
                  'BID_TYPE_CODE',
                  'CREATIVE_SIZE_NAME',
                  'CREATIVE_SIZE_CODE',
                  'DOMAIN_NAME',
                  'DOMAIN_CODE',
                  'COUNTRY_NAME',
                  'COUNTRY_CODE',
                  'PLATFORM_TYPE_NAME',
                  'PLATFORM_TYPE_CODE',
                  'TARGETING_TYPE_NAME',
                  'TARGETING_TYPE_CODE',
                  'CONTENT_PLATFORM_NAME',
                  'CONTENT_PLATFORM_CODE',
                  'AD_PLACEMENT_NAME',
                  'AD_PLACEMENT_CODE',
                  'REQUESTED_AD_TYPE_NAME',
                  'REQUESTED_AD_TYPE_CODE',
                  'SERVED_AD_TYPE_NAME',
                  'SERVED_AD_TYPE_CODE',
                  'AD_FORMAT_NAME',
                  'AD_FORMAT_CODE',
                  'CUSTOM_SEARCH_STYLE_NAME',
                  'CUSTOM_SEARCH_STYLE_ID',
                  'DOMAIN_REGISTRANT',
                  'WEBSEARCH_QUERY_STRING',
                ];
                type: 'string';
              };
              type: 'array';
            };
            style: 'form';
          },
          {
            description: "Day of a month. Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant.";
            in: 'query';
            name: 'endDate.day';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Month of a year. Must be from 1 to 12, or 0 to specify a year without a month and day.';
            in: 'query';
            name: 'endDate.month';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Year of the date. Must be from 1 to 9999, or 0 to specify a date without a year.';
            in: 'query';
            name: 'endDate.year';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'A list of [filters](/adsense/management/reporting/filtering) to apply to the report. All provided filters must match in order for the data to be included in the report.';
            explode: true;
            in: 'query';
            name: 'filters';
            schema: {
              items: {
                type: 'string';
              };
              type: 'array';
            };
            style: 'form';
          },
          {
            description: 'The language to use for translating report output. If unspecified, this defaults to English ("en"). If the given language is not supported, report output will be returned in English. The language is specified as an [IETF BCP-47 language code](https://en.wikipedia.org/wiki/IETF_language_tag).';
            in: 'query';
            name: 'languageCode';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The maximum number of rows of report data to return. Reports producing more rows than the requested limit will be truncated. If unset, this defaults to 100,000 rows for `Reports.GenerateReport` and 1,000,000 rows for `Reports.GenerateCsvReport`, which are also the maximum values permitted here. Report truncation can be identified (for `Reports.GenerateReport` only) by comparing the number of rows returned to the value returned in `total_matched_rows`.';
            in: 'query';
            name: 'limit';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Required. Reporting metrics.';
            explode: true;
            in: 'query';
            name: 'metrics';
            schema: {
              items: {
                enum: [
                  'METRIC_UNSPECIFIED',
                  'PAGE_VIEWS',
                  'AD_REQUESTS',
                  'MATCHED_AD_REQUESTS',
                  'TOTAL_IMPRESSIONS',
                  'IMPRESSIONS',
                  'INDIVIDUAL_AD_IMPRESSIONS',
                  'CLICKS',
                  'PAGE_VIEWS_SPAM_RATIO',
                  'AD_REQUESTS_SPAM_RATIO',
                  'MATCHED_AD_REQUESTS_SPAM_RATIO',
                  'IMPRESSIONS_SPAM_RATIO',
                  'INDIVIDUAL_AD_IMPRESSIONS_SPAM_RATIO',
                  'CLICKS_SPAM_RATIO',
                  'AD_REQUESTS_COVERAGE',
                  'PAGE_VIEWS_CTR',
                  'AD_REQUESTS_CTR',
                  'MATCHED_AD_REQUESTS_CTR',
                  'IMPRESSIONS_CTR',
                  'INDIVIDUAL_AD_IMPRESSIONS_CTR',
                  'ACTIVE_VIEW_MEASURABILITY',
                  'ACTIVE_VIEW_VIEWABILITY',
                  'ACTIVE_VIEW_TIME',
                  'ESTIMATED_EARNINGS',
                  'PAGE_VIEWS_RPM',
                  'AD_REQUESTS_RPM',
                  'MATCHED_AD_REQUESTS_RPM',
                  'IMPRESSIONS_RPM',
                  'INDIVIDUAL_AD_IMPRESSIONS_RPM',
                  'COST_PER_CLICK',
                  'ADS_PER_IMPRESSION',
                  'TOTAL_EARNINGS',
                  'WEBSEARCH_RESULT_PAGES',
                  'FUNNEL_REQUESTS',
                  'FUNNEL_IMPRESSIONS',
                  'FUNNEL_CLICKS',
                  'FUNNEL_RPM',
                ];
                type: 'string';
              };
              type: 'array';
            };
            style: 'form';
          },
          {
            description: 'The name of a dimension or metric to sort the resulting report on, can be prefixed with "+" to sort ascending or "-" to sort descending. If no prefix is specified, the column is sorted ascending.';
            explode: true;
            in: 'query';
            name: 'orderBy';
            schema: {
              items: {
                type: 'string';
              };
              type: 'array';
            };
            style: 'form';
          },
          {
            description: 'Timezone in which to generate the report. If unspecified, this defaults to the account timezone. For more information, see [changing the time zone of your reports](https://support.google.com/adsense/answer/9830725).';
            in: 'query';
            name: 'reportingTimeZone';
            schema: {
              enum: ['REPORTING_TIME_ZONE_UNSPECIFIED', 'ACCOUNT_TIME_ZONE', 'GOOGLE_TIME_ZONE'];
              type: 'string';
            };
          },
          {
            description: "Day of a month. Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant.";
            in: 'query';
            name: 'startDate.day';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Month of a year. Must be from 1 to 12, or 0 to specify a year without a month and day.';
            in: 'query';
            name: 'startDate.month';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Year of the date. Must be from 1 to 9999, or 0 to specify a date without a year.';
            in: 'query';
            name: 'startDate.year';
            schema: {
              type: 'integer';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HttpBody';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/v2/{name}': {
      delete: {
        description: 'Deletes a custom channel. This method can only be used by projects enabled for the [AdSense for Platforms](https://developers.google.com/adsense/platforms/) product.';
        operationId: 'adsense.accounts.adclients.customchannels.delete';
        parameters: [
          {
            description: 'Required. Name of the custom channel to delete. Format: accounts/{account}/adclients/{adclient}/customchannels/{customchannel}';
            in: 'path';
            name: 'name';
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
                  $ref: '#/components/schemas/Empty';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
        ];
        tags: ['accounts'];
      };
      get: {
        description: 'Gets information about the selected site.';
        operationId: 'adsense.accounts.sites.get';
        parameters: [
          {
            description: 'Required. Name of the site. Format: accounts/{account}/sites/{site}';
            in: 'path';
            name: 'name';
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
                  $ref: '#/components/schemas/Site';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      patch: {
        description: 'Updates a custom channel. This method can only be used by projects enabled for the [AdSense for Platforms](https://developers.google.com/adsense/platforms/) product.';
        operationId: 'adsense.accounts.adclients.customchannels.patch';
        parameters: [
          {
            description: 'Output only. Resource name of the custom channel. Format: accounts/{account}/adclients/{adclient}/customchannels/{customchannel}';
            in: 'path';
            name: 'name';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The list of fields to update. If empty, a full update is performed.';
            in: 'query';
            name: 'updateMask';
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CustomChannel';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CustomChannel';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
        ];
        tags: ['accounts'];
      };
    };
    '/v2/{name}/adBlockingRecoveryTag': {
      get: {
        description: 'Gets the ad blocking recovery tag of an account.';
        operationId: 'adsense.accounts.getAdBlockingRecoveryTag';
        parameters: [
          {
            description: 'Required. The name of the account to get the tag for. Format: accounts/{account}';
            in: 'path';
            name: 'name';
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
                  $ref: '#/components/schemas/AdBlockingRecoveryTag';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/v2/{name}/adcode': {
      get: {
        description: 'Gets the ad unit code for a given ad unit. For more information, see [About the AdSense code](https://support.google.com/adsense/answer/9274634) and [Where to place the ad code in your HTML](https://support.google.com/adsense/answer/9190028).';
        operationId: 'adsense.accounts.adclients.adunits.getAdcode';
        parameters: [
          {
            description: 'Required. Name of the adunit for which to get the adcode. Format: accounts/{account}/adclients/{adclient}/adunits/{adunit}';
            in: 'path';
            name: 'name';
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
                  $ref: '#/components/schemas/AdUnitAdCode';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/v2/{name}/saved': {
      get: {
        description: 'Gets the saved report from the given resource name.';
        operationId: 'adsense.accounts.reports.getSaved';
        parameters: [
          {
            description: 'Required. The name of the saved report to retrieve. Format: accounts/{account}/reports/{report}';
            in: 'path';
            name: 'name';
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
                  $ref: '#/components/schemas/SavedReport';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/v2/{name}/saved:generate': {
      get: {
        description: 'Generates a saved report.';
        operationId: 'adsense.accounts.reports.saved.generate';
        parameters: [
          {
            description: 'Required. Name of the saved report. Format: accounts/{account}/reports/{report}';
            in: 'path';
            name: 'name';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: "The [ISO-4217 currency code](https://en.wikipedia.org/wiki/ISO_4217) to use when reporting on monetary metrics. Defaults to the account's currency if not set.";
            in: 'query';
            name: 'currencyCode';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Date range of the report, if unset the range will be considered CUSTOM.';
            in: 'query';
            name: 'dateRange';
            schema: {
              enum: [
                'REPORTING_DATE_RANGE_UNSPECIFIED',
                'CUSTOM',
                'TODAY',
                'YESTERDAY',
                'MONTH_TO_DATE',
                'YEAR_TO_DATE',
                'LAST_7_DAYS',
                'LAST_30_DAYS',
              ];
              type: 'string';
            };
          },
          {
            description: "Day of a month. Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant.";
            in: 'query';
            name: 'endDate.day';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Month of a year. Must be from 1 to 12, or 0 to specify a year without a month and day.';
            in: 'query';
            name: 'endDate.month';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Year of the date. Must be from 1 to 9999, or 0 to specify a date without a year.';
            in: 'query';
            name: 'endDate.year';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'The language to use for translating report output. If unspecified, this defaults to English ("en"). If the given language is not supported, report output will be returned in English. The language is specified as an [IETF BCP-47 language code](https://en.wikipedia.org/wiki/IETF_language_tag).';
            in: 'query';
            name: 'languageCode';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Timezone in which to generate the report. If unspecified, this defaults to the account timezone. For more information, see [changing the time zone of your reports](https://support.google.com/adsense/answer/9830725).';
            in: 'query';
            name: 'reportingTimeZone';
            schema: {
              enum: ['REPORTING_TIME_ZONE_UNSPECIFIED', 'ACCOUNT_TIME_ZONE', 'GOOGLE_TIME_ZONE'];
              type: 'string';
            };
          },
          {
            description: "Day of a month. Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant.";
            in: 'query';
            name: 'startDate.day';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Month of a year. Must be from 1 to 12, or 0 to specify a year without a month and day.';
            in: 'query';
            name: 'startDate.month';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Year of the date. Must be from 1 to 9999, or 0 to specify a date without a year.';
            in: 'query';
            name: 'startDate.year';
            schema: {
              type: 'integer';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ReportResult';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/v2/{name}/saved:generateCsv': {
      get: {
        description: 'Generates a csv formatted saved report.';
        operationId: 'adsense.accounts.reports.saved.generateCsv';
        parameters: [
          {
            description: 'Required. Name of the saved report. Format: accounts/{account}/reports/{report}';
            in: 'path';
            name: 'name';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: "The [ISO-4217 currency code](https://en.wikipedia.org/wiki/ISO_4217) to use when reporting on monetary metrics. Defaults to the account's currency if not set.";
            in: 'query';
            name: 'currencyCode';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Date range of the report, if unset the range will be considered CUSTOM.';
            in: 'query';
            name: 'dateRange';
            schema: {
              enum: [
                'REPORTING_DATE_RANGE_UNSPECIFIED',
                'CUSTOM',
                'TODAY',
                'YESTERDAY',
                'MONTH_TO_DATE',
                'YEAR_TO_DATE',
                'LAST_7_DAYS',
                'LAST_30_DAYS',
              ];
              type: 'string';
            };
          },
          {
            description: "Day of a month. Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant.";
            in: 'query';
            name: 'endDate.day';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Month of a year. Must be from 1 to 12, or 0 to specify a year without a month and day.';
            in: 'query';
            name: 'endDate.month';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Year of the date. Must be from 1 to 9999, or 0 to specify a date without a year.';
            in: 'query';
            name: 'endDate.year';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'The language to use for translating report output. If unspecified, this defaults to English ("en"). If the given language is not supported, report output will be returned in English. The language is specified as an [IETF BCP-47 language code](https://en.wikipedia.org/wiki/IETF_language_tag).';
            in: 'query';
            name: 'languageCode';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Timezone in which to generate the report. If unspecified, this defaults to the account timezone. For more information, see [changing the time zone of your reports](https://support.google.com/adsense/answer/9830725).';
            in: 'query';
            name: 'reportingTimeZone';
            schema: {
              enum: ['REPORTING_TIME_ZONE_UNSPECIFIED', 'ACCOUNT_TIME_ZONE', 'GOOGLE_TIME_ZONE'];
              type: 'string';
            };
          },
          {
            description: "Day of a month. Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant.";
            in: 'query';
            name: 'startDate.day';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Month of a year. Must be from 1 to 12, or 0 to specify a year without a month and day.';
            in: 'query';
            name: 'startDate.month';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'Year of the date. Must be from 1 to 9999, or 0 to specify a date without a year.';
            in: 'query';
            name: 'startDate.year';
            schema: {
              type: 'integer';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HttpBody';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/v2/{parent}/adclients': {
      get: {
        description: 'Lists all the ad clients available in an account.';
        operationId: 'adsense.accounts.adclients.list';
        parameters: [
          {
            description: 'Required. The account which owns the collection of ad clients. Format: accounts/{account}';
            in: 'path';
            name: 'parent';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The maximum number of ad clients to include in the response, used for paging. If unspecified, at most 10000 ad clients will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.';
            in: 'query';
            name: 'pageSize';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'A page token, received from a previous `ListAdClients` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListAdClients` must match the call that provided the page token.';
            in: 'query';
            name: 'pageToken';
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
                  $ref: '#/components/schemas/ListAdClientsResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/v2/{parent}/adunits': {
      get: {
        description: 'Lists all ad units under a specified account and ad client.';
        operationId: 'adsense.accounts.adclients.adunits.list';
        parameters: [
          {
            description: 'Required. The ad client which owns the collection of ad units. Format: accounts/{account}/adclients/{adclient}';
            in: 'path';
            name: 'parent';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The maximum number of ad units to include in the response, used for paging. If unspecified, at most 10000 ad units will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.';
            in: 'query';
            name: 'pageSize';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'A page token, received from a previous `ListAdUnits` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListAdUnits` must match the call that provided the page token.';
            in: 'query';
            name: 'pageToken';
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
                  $ref: '#/components/schemas/ListAdUnitsResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Creates an ad unit. This method can only be used by projects enabled for the [AdSense for Platforms](https://developers.google.com/adsense/platforms/) product. Note that ad units can only be created for ad clients with an "AFC" product code. For more info see the [AdClient resource](/adsense/management/reference/rest/v2/accounts.adclients). For now, this method can only be used to create `DISPLAY` ad units. See: https://support.google.com/adsense/answer/9183566';
        operationId: 'adsense.accounts.adclients.adunits.create';
        parameters: [
          {
            description: 'Required. Ad client to create an ad unit under. Format: accounts/{account}/adclients/{adclient}';
            in: 'path';
            name: 'parent';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AdUnit';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AdUnit';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
        ];
        tags: ['accounts'];
      };
    };
    '/v2/{parent}/alerts': {
      get: {
        description: 'Lists all the alerts available in an account.';
        operationId: 'adsense.accounts.alerts.list';
        parameters: [
          {
            description: 'Required. The account which owns the collection of alerts. Format: accounts/{account}';
            in: 'path';
            name: 'parent';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: "The language to use for translating alert messages. If unspecified, this defaults to the user's display language. If the given language is not supported, alerts will be returned in English. The language is specified as an [IETF BCP-47 language code](https://en.wikipedia.org/wiki/IETF_language_tag).";
            in: 'query';
            name: 'languageCode';
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
                  $ref: '#/components/schemas/ListAlertsResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/v2/{parent}/customchannels': {
      get: {
        description: 'Lists all the custom channels available in an ad client.';
        operationId: 'adsense.accounts.adclients.customchannels.list';
        parameters: [
          {
            description: 'Required. The ad client which owns the collection of custom channels. Format: accounts/{account}/adclients/{adclient}';
            in: 'path';
            name: 'parent';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The maximum number of custom channels to include in the response, used for paging. If unspecified, at most 10000 custom channels will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.';
            in: 'query';
            name: 'pageSize';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'A page token, received from a previous `ListCustomChannels` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListCustomChannels` must match the call that provided the page token.';
            in: 'query';
            name: 'pageToken';
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
                  $ref: '#/components/schemas/ListCustomChannelsResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
      post: {
        description: 'Creates a custom channel. This method can only be used by projects enabled for the [AdSense for Platforms](https://developers.google.com/adsense/platforms/) product.';
        operationId: 'adsense.accounts.adclients.customchannels.create';
        parameters: [
          {
            description: 'Required. The ad client to create a custom channel under. Format: accounts/{account}/adclients/{adclient}';
            in: 'path';
            name: 'parent';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CustomChannel';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CustomChannel';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
        ];
        tags: ['accounts'];
      };
    };
    '/v2/{parent}/payments': {
      get: {
        description: 'Lists all the payments available for an account.';
        operationId: 'adsense.accounts.payments.list';
        parameters: [
          {
            description: 'Required. The account which owns the collection of payments. Format: accounts/{account}';
            in: 'path';
            name: 'parent';
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
                  $ref: '#/components/schemas/ListPaymentsResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/v2/{parent}/reports/saved': {
      get: {
        description: 'Lists saved reports.';
        operationId: 'adsense.accounts.reports.saved.list';
        parameters: [
          {
            description: 'Required. The account which owns the collection of reports. Format: accounts/{account}';
            in: 'path';
            name: 'parent';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The maximum number of reports to include in the response, used for paging. If unspecified, at most 10000 reports will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.';
            in: 'query';
            name: 'pageSize';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'A page token, received from a previous `ListSavedReports` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListSavedReports` must match the call that provided the page token.';
            in: 'query';
            name: 'pageToken';
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
                  $ref: '#/components/schemas/ListSavedReportsResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/v2/{parent}/sites': {
      get: {
        description: 'Lists all the sites available in an account.';
        operationId: 'adsense.accounts.sites.list';
        parameters: [
          {
            description: 'Required. The account which owns the collection of sites. Format: accounts/{account}';
            in: 'path';
            name: 'parent';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The maximum number of sites to include in the response, used for paging. If unspecified, at most 10000 sites will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.';
            in: 'query';
            name: 'pageSize';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'A page token, received from a previous `ListSites` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListSites` must match the call that provided the page token.';
            in: 'query';
            name: 'pageToken';
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
                  $ref: '#/components/schemas/ListSitesResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/v2/{parent}/urlchannels': {
      get: {
        description: 'Lists active url channels.';
        operationId: 'adsense.accounts.adclients.urlchannels.list';
        parameters: [
          {
            description: 'Required. The ad client which owns the collection of url channels. Format: accounts/{account}/adclients/{adclient}';
            in: 'path';
            name: 'parent';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The maximum number of url channels to include in the response, used for paging. If unspecified, at most 10000 url channels will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.';
            in: 'query';
            name: 'pageSize';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'A page token, received from a previous `ListUrlChannels` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListUrlChannels` must match the call that provided the page token.';
            in: 'query';
            name: 'pageToken';
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
                  $ref: '#/components/schemas/ListUrlChannelsResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/v2/{parent}:listChildAccounts': {
      get: {
        description: 'Lists all accounts directly managed by the given AdSense account.';
        operationId: 'adsense.accounts.listChildAccounts';
        parameters: [
          {
            description: 'Required. The parent account, which owns the child accounts. Format: accounts/{account}';
            in: 'path';
            name: 'parent';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The maximum number of accounts to include in the response, used for paging. If unspecified, at most 10000 accounts will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.';
            in: 'query';
            name: 'pageSize';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'A page token, received from a previous `ListChildAccounts` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListChildAccounts` must match the call that provided the page token.';
            in: 'query';
            name: 'pageToken';
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
                  $ref: '#/components/schemas/ListChildAccountsResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/v2/{parent}:listLinkedAdUnits': {
      get: {
        description: 'Lists all the ad units available for a custom channel.';
        operationId: 'adsense.accounts.adclients.customchannels.listLinkedAdUnits';
        parameters: [
          {
            description: 'Required. The custom channel which owns the collection of ad units. Format: accounts/{account}/adclients/{adclient}/customchannels/{customchannel}';
            in: 'path';
            name: 'parent';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The maximum number of ad units to include in the response, used for paging. If unspecified, at most 10000 ad units will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.';
            in: 'query';
            name: 'pageSize';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'A page token, received from a previous `ListLinkedAdUnits` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListLinkedAdUnits` must match the call that provided the page token.';
            in: 'query';
            name: 'pageToken';
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
                  $ref: '#/components/schemas/ListLinkedAdUnitsResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
    '/v2/{parent}:listLinkedCustomChannels': {
      get: {
        description: 'Lists all the custom channels available for an ad unit.';
        operationId: 'adsense.accounts.adclients.adunits.listLinkedCustomChannels';
        parameters: [
          {
            description: 'Required. The ad unit which owns the collection of custom channels. Format: accounts/{account}/adclients/{adclient}/adunits/{adunit}';
            in: 'path';
            name: 'parent';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'The maximum number of custom channels to include in the response, used for paging. If unspecified, at most 10000 custom channels will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.';
            in: 'query';
            name: 'pageSize';
            schema: {
              type: 'integer';
            };
          },
          {
            description: 'A page token, received from a previous `ListLinkedCustomChannels` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListLinkedCustomChannels` must match the call that provided the page token.';
            in: 'query';
            name: 'pageToken';
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
                  $ref: '#/components/schemas/ListLinkedCustomChannelsResponse';
                };
              };
            };
            description: 'Successful response';
          };
        };
        security: [
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense'];
          },
          {
            Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'];
            Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'];
          },
        ];
        tags: ['accounts'];
      };
      parameters: [
        {
          $ref: '#/components/parameters/_.xgafv';
        },
        {
          $ref: '#/components/parameters/access_token';
        },
        {
          $ref: '#/components/parameters/alt';
        },
        {
          $ref: '#/components/parameters/callback';
        },
        {
          $ref: '#/components/parameters/fields';
        },
        {
          $ref: '#/components/parameters/key';
        },
        {
          $ref: '#/components/parameters/oauth_token';
        },
        {
          $ref: '#/components/parameters/prettyPrint';
        },
        {
          $ref: '#/components/parameters/quotaUser';
        },
        {
          $ref: '#/components/parameters/upload_protocol';
        },
        {
          $ref: '#/components/parameters/uploadType';
        },
      ];
    };
  };
  components: {
    parameters: {
      '_.xgafv': {
        description: 'V1 error format.';
        in: 'query';
        name: '$.xgafv';
        schema: {
          enum: ['1', '2'];
          type: 'string';
        };
      };
      access_token: {
        description: 'OAuth access token.';
        in: 'query';
        name: 'access_token';
        schema: {
          type: 'string';
        };
      };
      alt: {
        description: 'Data format for response.';
        in: 'query';
        name: 'alt';
        schema: {
          enum: ['json', 'media', 'proto'];
          type: 'string';
        };
      };
      callback: {
        description: 'JSONP';
        in: 'query';
        name: 'callback';
        schema: {
          type: 'string';
        };
      };
      fields: {
        description: 'Selector specifying which fields to include in a partial response.';
        in: 'query';
        name: 'fields';
        schema: {
          type: 'string';
        };
      };
      key: {
        description: 'API key. Your API key identifies your project and provides you with API access, quota, and reports. Required unless you provide an OAuth 2.0 token.';
        in: 'query';
        name: 'key';
        schema: {
          type: 'string';
        };
      };
      oauth_token: {
        description: 'OAuth 2.0 token for the current user.';
        in: 'query';
        name: 'oauth_token';
        schema: {
          type: 'string';
        };
      };
      prettyPrint: {
        description: 'Returns response with indentations and line breaks.';
        in: 'query';
        name: 'prettyPrint';
        schema: {
          type: 'boolean';
        };
      };
      quotaUser: {
        description: 'Available to use for quota purposes for server-side applications. Can be any arbitrary string assigned to a user, but should not exceed 40 characters.';
        in: 'query';
        name: 'quotaUser';
        schema: {
          type: 'string';
        };
      };
      uploadType: {
        description: 'Legacy upload protocol for media (e.g. "media", "multipart").';
        in: 'query';
        name: 'uploadType';
        schema: {
          type: 'string';
        };
      };
      upload_protocol: {
        description: 'Upload protocol for media (e.g. "raw", "multipart").';
        in: 'query';
        name: 'upload_protocol';
        schema: {
          type: 'string';
        };
      };
    };
    schemas: {
      Account: {
        description: 'Representation of an account.';
        properties: {
          createTime: {
            description: 'Output only. Creation time of the account.';
            format: 'google-datetime';
            readOnly: true;
            type: 'string';
          };
          displayName: {
            description: 'Output only. Display name of this account.';
            readOnly: true;
            type: 'string';
          };
          name: {
            description: 'Output only. Resource name of the account. Format: accounts/pub-[0-9]+';
            readOnly: true;
            type: 'string';
          };
          pendingTasks: {
            description: 'Output only. Outstanding tasks that need to be completed as part of the sign-up process for a new account. e.g. "billing-profile-creation", "phone-pin-verification".';
            items: {
              type: 'string';
            };
            readOnly: true;
            type: 'array';
          };
          premium: {
            description: 'Output only. Whether this account is premium.';
            readOnly: true;
            type: 'boolean';
          };
          state: {
            description: 'Output only. State of the account.';
            enum: ['STATE_UNSPECIFIED', 'READY', 'NEEDS_ATTENTION', 'CLOSED'];
            readOnly: true;
            type: 'string';
          };
          timeZone: {
            $ref: '#/components/schemas/TimeZone';
            description: 'The account time zone, as used by reporting. For more information, see [changing the time zone of your reports](https://support.google.com/adsense/answer/9830725).';
          };
        };
        type: 'object';
      };
      AdBlockingRecoveryTag: {
        description: 'Representation of an ad blocking recovery tag. See https://support.google.com/adsense/answer/11575177.';
        properties: {
          errorProtectionCode: {
            description: "Error protection code that can be used in conjunction with the tag. It'll display a message to users if an [ad blocking extension blocks their access to your site](https://support.google.com/adsense/answer/11575480).";
            type: 'string';
          };
          tag: {
            description: "The ad blocking recovery tag. Note that the message generated by the tag can be blocked by an ad blocking extension. If this is not your desired outcome, then you'll need to use it in conjunction with the error protection code.";
            type: 'string';
          };
        };
        type: 'object';
      };
      AdClient: {
        description: "Representation of an ad client. An ad client represents a user's subscription with a specific AdSense product.";
        properties: {
          name: {
            description: 'Output only. Resource name of the ad client. Format: accounts/{account}/adclients/{adclient}';
            readOnly: true;
            type: 'string';
          };
          productCode: {
            description: 'Output only. Reporting product code of the ad client. For example, "AFC" for AdSense for Content. Corresponds to the `PRODUCT_CODE` dimension, and present only if the ad client supports reporting.';
            readOnly: true;
            type: 'string';
          };
          reportingDimensionId: {
            description: 'Output only. Unique ID of the ad client as used in the `AD_CLIENT_ID` reporting dimension. Present only if the ad client supports reporting.';
            readOnly: true;
            type: 'string';
          };
          state: {
            description: 'Output only. State of the ad client.';
            enum: ['STATE_UNSPECIFIED', 'READY', 'GETTING_READY', 'REQUIRES_REVIEW'];
            readOnly: true;
            type: 'string';
          };
        };
        type: 'object';
      };
      AdClientAdCode: {
        description: 'Representation of the AdSense code for a given ad client. For more information, see [About the AdSense code](https://support.google.com/adsense/answer/9274634).';
        properties: {
          adCode: {
            description: 'Output only. The AdSense code snippet to add to the head of an HTML page.';
            readOnly: true;
            type: 'string';
          };
          ampBody: {
            description: 'Output only. The AdSense code snippet to add to the body of an AMP page.';
            readOnly: true;
            type: 'string';
          };
          ampHead: {
            description: 'Output only. The AdSense code snippet to add to the head of an AMP page.';
            readOnly: true;
            type: 'string';
          };
        };
        type: 'object';
      };
      AdUnit: {
        description: 'Representation of an ad unit. An ad unit represents a saved ad unit with a specific set of ad settings that have been customized within an account.';
        properties: {
          contentAdsSettings: {
            $ref: '#/components/schemas/ContentAdsSettings';
            description: 'Required. Settings specific to content ads (AFC).';
          };
          displayName: {
            description: 'Required. Display name of the ad unit, as provided when the ad unit was created.';
            type: 'string';
          };
          name: {
            description: 'Output only. Resource name of the ad unit. Format: accounts/{account}/adclients/{adclient}/adunits/{adunit}';
            readOnly: true;
            type: 'string';
          };
          reportingDimensionId: {
            description: 'Output only. Unique ID of the ad unit as used in the `AD_UNIT_ID` reporting dimension.';
            readOnly: true;
            type: 'string';
          };
          state: {
            description: 'Required. State of the ad unit.';
            enum: ['STATE_UNSPECIFIED', 'ACTIVE', 'ARCHIVED'];
            type: 'string';
          };
        };
        type: 'object';
      };
      AdUnitAdCode: {
        description: 'Representation of the ad unit code for a given ad unit. For more information, see [About the AdSense code](https://support.google.com/adsense/answer/9274634) and [Where to place the ad code in your HTML](https://support.google.com/adsense/answer/9190028).';
        properties: {
          adCode: {
            description: 'Output only. The code snippet to add to the body of an HTML page.';
            readOnly: true;
            type: 'string';
          };
        };
        type: 'object';
      };
      Alert: {
        description: 'Representation of an alert.';
        properties: {
          message: {
            description: 'Output only. The localized alert message. This may contain HTML markup, such as phrase elements or links.';
            readOnly: true;
            type: 'string';
          };
          name: {
            description: 'Output only. Resource name of the alert. Format: accounts/{account}/alerts/{alert}';
            readOnly: true;
            type: 'string';
          };
          severity: {
            description: 'Output only. Severity of this alert.';
            enum: ['SEVERITY_UNSPECIFIED', 'INFO', 'WARNING', 'SEVERE'];
            readOnly: true;
            type: 'string';
          };
          type: {
            description: 'Output only. Type of alert. This identifies the broad type of this alert, and provides a stable machine-readable identifier that will not be translated. For example, "payment-hold".';
            readOnly: true;
            type: 'string';
          };
        };
        type: 'object';
      };
      Cell: {
        description: 'Cell representation.';
        properties: {
          value: {
            description: 'Value in the cell. The dimension cells contain strings, and the metric cells contain numbers.';
            type: 'string';
          };
        };
        type: 'object';
      };
      ContentAdsSettings: {
        description: 'Settings specific to content ads (AFC).';
        properties: {
          size: {
            description: 'Required. Size of the ad unit. e.g. "728x90", "1x3" (for responsive ad units).';
            type: 'string';
          };
          type: {
            description: 'Required. Type of the ad unit.';
            enum: ['TYPE_UNSPECIFIED', 'DISPLAY', 'FEED', 'ARTICLE', 'MATCHED_CONTENT', 'LINK'];
            type: 'string';
            'x-enumDeprecated': [false, false, false, false, false, true];
          };
        };
        type: 'object';
      };
      CustomChannel: {
        description: 'Representation of a custom channel.';
        properties: {
          active: {
            description: 'Whether the custom channel is active and collecting data. See https://support.google.com/adsense/answer/10077192.';
            type: 'boolean';
          };
          displayName: {
            description: 'Required. Display name of the custom channel.';
            type: 'string';
          };
          name: {
            description: 'Output only. Resource name of the custom channel. Format: accounts/{account}/adclients/{adclient}/customchannels/{customchannel}';
            readOnly: true;
            type: 'string';
          };
          reportingDimensionId: {
            description: 'Output only. Unique ID of the custom channel as used in the `CUSTOM_CHANNEL_ID` reporting dimension.';
            readOnly: true;
            type: 'string';
          };
        };
        type: 'object';
      };
      Date: {
        description: 'Represents a whole or partial calendar date, such as a birthday. The time of day and time zone are either specified elsewhere or are insignificant. The date is relative to the Gregorian Calendar. This can represent one of the following: * A full date, with non-zero year, month, and day values. * A month and day, with a zero year (for example, an anniversary). * A year on its own, with a zero month and a zero day. * A year and month, with a zero day (for example, a credit card expiration date). Related types: * google.type.TimeOfDay * google.type.DateTime * google.protobuf.Timestamp';
        properties: {
          day: {
            description: "Day of a month. Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant.";
            format: 'int32';
            type: 'integer';
          };
          month: {
            description: 'Month of a year. Must be from 1 to 12, or 0 to specify a year without a month and day.';
            format: 'int32';
            type: 'integer';
          };
          year: {
            description: 'Year of the date. Must be from 1 to 9999, or 0 to specify a date without a year.';
            format: 'int32';
            type: 'integer';
          };
        };
        type: 'object';
      };
      Empty: {
        description: 'A generic empty message that you can re-use to avoid defining duplicated empty messages in your APIs. A typical example is to use it as the request or the response type of an API method. For instance: service Foo { rpc Bar(google.protobuf.Empty) returns (google.protobuf.Empty); }';
        properties: {};
        type: 'object';
      };
      Header: {
        description: 'The header information of the columns requested in the report.';
        properties: {
          currencyCode: {
            description: 'The [ISO-4217 currency code](https://en.wikipedia.org/wiki/ISO_4217) of this column. Only present if the header type is METRIC_CURRENCY.';
            type: 'string';
          };
          name: {
            description: 'Required. Name of the header.';
            type: 'string';
          };
          type: {
            description: 'Required. Type of the header.';
            enum: [
              'HEADER_TYPE_UNSPECIFIED',
              'DIMENSION',
              'METRIC_TALLY',
              'METRIC_RATIO',
              'METRIC_CURRENCY',
              'METRIC_MILLISECONDS',
              'METRIC_DECIMAL',
            ];
            type: 'string';
          };
        };
        type: 'object';
      };
      HttpBody: {
        description: "Message that represents an arbitrary HTTP body. It should only be used for payload formats that can't be represented as JSON, such as raw binary or an HTML page. This message can be used both in streaming and non-streaming API methods in the request as well as the response. It can be used as a top-level request field, which is convenient if one wants to extract parameters from either the URL or HTTP template into the request fields and also want access to the raw HTTP body. Example: message GetResourceRequest { // A unique request id. string request_id = 1; // The raw HTTP body is bound to this field. google.api.HttpBody http_body = 2; } service ResourceService { rpc GetResource(GetResourceRequest) returns (google.api.HttpBody); rpc UpdateResource(google.api.HttpBody) returns (google.protobuf.Empty); } Example with streaming methods: service CaldavService { rpc GetCalendar(stream google.api.HttpBody) returns (stream google.api.HttpBody); rpc UpdateCalendar(stream google.api.HttpBody) returns (stream google.api.HttpBody); } Use of this type only changes how the request and response bodies are handled, all other features will continue to work unchanged.";
        properties: {
          contentType: {
            description: 'The HTTP Content-Type header value specifying the content type of the body.';
            type: 'string';
          };
          data: {
            description: 'The HTTP request/response body as raw binary.';
            format: 'byte';
            type: 'string';
          };
          extensions: {
            description: 'Application specific response metadata. Must be set in the first response for streaming APIs.';
            items: {
              additionalProperties: {
                description: 'Properties of the object. Contains field @type with type URL.';
              };
              type: 'object';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      ListAccountsResponse: {
        description: 'Response definition for the account list rpc.';
        properties: {
          accounts: {
            description: 'The accounts returned in this list response.';
            items: {
              $ref: '#/components/schemas/Account';
            };
            type: 'array';
          };
          nextPageToken: {
            description: 'Continuation token used to page through accounts. To retrieve the next page of the results, set the next request\'s "page_token" value to this.';
            type: 'string';
          };
        };
        type: 'object';
      };
      ListAdClientsResponse: {
        description: 'Response definition for the ad client list rpc.';
        properties: {
          adClients: {
            description: 'The ad clients returned in this list response.';
            items: {
              $ref: '#/components/schemas/AdClient';
            };
            type: 'array';
          };
          nextPageToken: {
            description: 'Continuation token used to page through ad clients. To retrieve the next page of the results, set the next request\'s "page_token" value to this.';
            type: 'string';
          };
        };
        type: 'object';
      };
      ListAdUnitsResponse: {
        description: 'Response definition for the adunit list rpc.';
        properties: {
          adUnits: {
            description: 'The ad units returned in the list response.';
            items: {
              $ref: '#/components/schemas/AdUnit';
            };
            type: 'array';
          };
          nextPageToken: {
            description: 'Continuation token used to page through ad units. To retrieve the next page of the results, set the next request\'s "page_token" value to this.';
            type: 'string';
          };
        };
        type: 'object';
      };
      ListAlertsResponse: {
        description: 'Response definition for the alerts list rpc.';
        properties: {
          alerts: {
            description: 'The alerts returned in this list response.';
            items: {
              $ref: '#/components/schemas/Alert';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      ListChildAccountsResponse: {
        description: 'Response definition for the child account list rpc.';
        properties: {
          accounts: {
            description: 'The accounts returned in this list response.';
            items: {
              $ref: '#/components/schemas/Account';
            };
            type: 'array';
          };
          nextPageToken: {
            description: 'Continuation token used to page through accounts. To retrieve the next page of the results, set the next request\'s "page_token" value to this.';
            type: 'string';
          };
        };
        type: 'object';
      };
      ListCustomChannelsResponse: {
        description: 'Response definition for the custom channel list rpc.';
        properties: {
          customChannels: {
            description: 'The custom channels returned in this list response.';
            items: {
              $ref: '#/components/schemas/CustomChannel';
            };
            type: 'array';
          };
          nextPageToken: {
            description: 'Continuation token used to page through alerts. To retrieve the next page of the results, set the next request\'s "page_token" value to this.';
            type: 'string';
          };
        };
        type: 'object';
      };
      ListLinkedAdUnitsResponse: {
        description: 'Response definition for the ad units linked to a custom channel list rpc.';
        properties: {
          adUnits: {
            description: 'The ad units returned in the list response.';
            items: {
              $ref: '#/components/schemas/AdUnit';
            };
            type: 'array';
          };
          nextPageToken: {
            description: 'Continuation token used to page through ad units. To retrieve the next page of the results, set the next request\'s "page_token" value to this.';
            type: 'string';
          };
        };
        type: 'object';
      };
      ListLinkedCustomChannelsResponse: {
        description: 'Response definition for the custom channels linked to an adunit list rpc.';
        properties: {
          customChannels: {
            description: 'The custom channels returned in this list response.';
            items: {
              $ref: '#/components/schemas/CustomChannel';
            };
            type: 'array';
          };
          nextPageToken: {
            description: 'Continuation token used to page through alerts. To retrieve the next page of the results, set the next request\'s "page_token" value to this.';
            type: 'string';
          };
        };
        type: 'object';
      };
      ListPaymentsResponse: {
        description: 'Response definition for the payments list rpc.';
        properties: {
          payments: {
            description: 'The payments returned in this list response.';
            items: {
              $ref: '#/components/schemas/Payment';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      ListSavedReportsResponse: {
        description: 'Response definition for the saved reports list rpc.';
        properties: {
          nextPageToken: {
            description: 'Continuation token used to page through reports. To retrieve the next page of the results, set the next request\'s "page_token" value to this.';
            type: 'string';
          };
          savedReports: {
            description: 'The reports returned in this list response.';
            items: {
              $ref: '#/components/schemas/SavedReport';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      ListSitesResponse: {
        description: 'Response definition for the sites list rpc.';
        properties: {
          nextPageToken: {
            description: 'Continuation token used to page through sites. To retrieve the next page of the results, set the next request\'s "page_token" value to this.';
            type: 'string';
          };
          sites: {
            description: 'The sites returned in this list response.';
            items: {
              $ref: '#/components/schemas/Site';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      ListUrlChannelsResponse: {
        description: 'Response definition for the url channels list rpc.';
        properties: {
          nextPageToken: {
            description: 'Continuation token used to page through url channels. To retrieve the next page of the results, set the next request\'s "page_token" value to this.';
            type: 'string';
          };
          urlChannels: {
            description: 'The url channels returned in this list response.';
            items: {
              $ref: '#/components/schemas/UrlChannel';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      Payment: {
        description: 'Representation of an unpaid or paid payment. See [Payment timelines for AdSense](https://support.google.com/adsense/answer/7164703) for more information about payments and the [YouTube homepage and payments account](https://support.google.com/adsense/answer/11622510) article for information about dedicated payments accounts for YouTube.';
        properties: {
          amount: {
            description: 'Output only. The amount of unpaid or paid earnings, as a formatted string, including the currency. E.g. "¥1,235 JPY", "$1,234.57", "£87.65".';
            readOnly: true;
            type: 'string';
          };
          date: {
            $ref: '#/components/schemas/Date';
            description: 'Output only. For paid earnings, the date that the payment was credited. For unpaid earnings, this field is empty. Payment dates are always returned in the billing timezone (America/Los_Angeles).';
            readOnly: true;
          };
          name: {
            description: 'Output only. Resource name of the payment. Format: - accounts/{account}/payments/unpaid for unpaid (current) AdSense earnings. - accounts/{account}/payments/youtube-unpaid for unpaid (current) YouTube earnings. - accounts/{account}/payments/yyyy-MM-dd for paid AdSense earnings. - accounts/{account}/payments/youtube-yyyy-MM-dd for paid YouTube earnings.';
            readOnly: true;
            type: 'string';
          };
        };
        type: 'object';
      };
      ReportResult: {
        description: 'Result of a generated report.';
        properties: {
          averages: {
            $ref: '#/components/schemas/Row';
            description: 'The averages of the report. This is the same length as any other row in the report; cells corresponding to dimension columns are empty.';
          };
          endDate: {
            $ref: '#/components/schemas/Date';
            description: 'Required. End date of the range (inclusive).';
          };
          headers: {
            description: 'The header information; one for each dimension in the request, followed by one for each metric in the request.';
            items: {
              $ref: '#/components/schemas/Header';
            };
            type: 'array';
          };
          rows: {
            description: 'The output rows of the report. Each row is a list of cells; one for each dimension in the request, followed by one for each metric in the request.';
            items: {
              $ref: '#/components/schemas/Row';
            };
            type: 'array';
          };
          startDate: {
            $ref: '#/components/schemas/Date';
            description: 'Required. Start date of the range (inclusive).';
          };
          totalMatchedRows: {
            description: 'The total number of rows matched by the report request.';
            format: 'int64';
            type: 'string';
          };
          totals: {
            $ref: '#/components/schemas/Row';
            description: 'The totals of the report. This is the same length as any other row in the report; cells corresponding to dimension columns are empty.';
          };
          warnings: {
            description: 'Any warnings associated with generation of the report. These warnings are always returned in English.';
            items: {
              type: 'string';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      Row: {
        description: 'Row representation.';
        properties: {
          cells: {
            description: 'Cells in the row.';
            items: {
              $ref: '#/components/schemas/Cell';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      SavedReport: {
        description: 'Representation of a saved report.';
        properties: {
          name: {
            description: 'Output only. Resource name of the report. Format: accounts/{account}/reports/{report}';
            readOnly: true;
            type: 'string';
          };
          title: {
            description: 'Report title as specified by publisher.';
            type: 'string';
          };
        };
        type: 'object';
      };
      Site: {
        description: 'Representation of a Site.';
        properties: {
          autoAdsEnabled: {
            description: 'Whether auto ads is turned on for the site.';
            type: 'boolean';
          };
          domain: {
            description: 'Domain (or subdomain) of the site, e.g. "example.com" or "www.example.com". This is used in the `OWNED_SITE_DOMAIN_NAME` reporting dimension.';
            type: 'string';
          };
          name: {
            description: 'Output only. Resource name of a site. Format: accounts/{account}/sites/{site}';
            readOnly: true;
            type: 'string';
          };
          reportingDimensionId: {
            description: 'Output only. Unique ID of the site as used in the `OWNED_SITE_ID` reporting dimension.';
            readOnly: true;
            type: 'string';
          };
          state: {
            description: 'Output only. State of a site.';
            enum: ['STATE_UNSPECIFIED', 'REQUIRES_REVIEW', 'GETTING_READY', 'READY', 'NEEDS_ATTENTION'];
            readOnly: true;
            type: 'string';
          };
        };
        type: 'object';
      };
      TimeZone: {
        description: 'Represents a time zone from the [IANA Time Zone Database](https://www.iana.org/time-zones).';
        properties: {
          id: {
            description: 'IANA Time Zone Database time zone, e.g. "America/New_York".';
            type: 'string';
          };
          version: {
            description: 'Optional. IANA Time Zone Database version number, e.g. "2019a".';
            type: 'string';
          };
        };
        type: 'object';
      };
      UrlChannel: {
        description: 'Representation of a URL channel. URL channels allow you to track the performance of particular pages in your site; see [URL channels](https://support.google.com/adsense/answer/2923836) for more information.';
        properties: {
          name: {
            description: 'Output only. Resource name of the URL channel. Format: accounts/{account}/adclients/{adclient}/urlchannels/{urlchannel}';
            readOnly: true;
            type: 'string';
          };
          reportingDimensionId: {
            description: 'Output only. Unique ID of the custom channel as used in the `URL_CHANNEL_ID` reporting dimension.';
            readOnly: true;
            type: 'string';
          };
          uriPattern: {
            description: 'URI pattern of the channel. Does not include "http://" or "https://". Example: www.example.com/home';
            type: 'string';
          };
        };
        type: 'object';
      };
    };
    securitySchemes: {
      Oauth2: {
        description: 'Oauth 2.0 implicit authentication';
        flows: {
          implicit: {
            authorizationUrl: 'https://accounts.google.com/o/oauth2/auth';
            scopes: {
              'https://www.googleapis.com/auth/adsense': 'View and manage your AdSense data';
              'https://www.googleapis.com/auth/adsense.readonly': 'View your AdSense data';
            };
          };
        };
        type: 'oauth2';
      };
      Oauth2c: {
        description: 'Oauth 2.0 authorizationCode authentication';
        flows: {
          authorizationCode: {
            authorizationUrl: 'https://accounts.google.com/o/oauth2/auth';
            scopes: {
              'https://www.googleapis.com/auth/adsense': 'View and manage your AdSense data';
              'https://www.googleapis.com/auth/adsense.readonly': 'View your AdSense data';
            };
            tokenUrl: 'https://accounts.google.com/o/oauth2/token';
          };
        };
        type: 'oauth2';
      };
    };
  };
};
