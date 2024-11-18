// @ts-nocheck
export type TPaths = {
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
export const paths = {
  '/v2/accounts': {
    get: {
      description: 'Lists all accounts available to this user.',
      operationId: 'adsense.accounts.list',
      parameters: [
        {
          description:
            'The maximum number of accounts to include in the response, used for paging. If unspecified, at most 10000 accounts will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.',
          in: 'query',
          name: 'pageSize',
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'A page token, received from a previous `ListAccounts` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListAccounts` must match the call that provided the page token.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListAccountsResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/v2/{account}/reports:generate': {
    get: {
      description: 'Generates an ad hoc report.',
      operationId: 'adsense.accounts.reports.generate',
      parameters: [
        {
          description: 'Required. The account which owns the collection of reports. Format: accounts/{account}',
          in: 'path',
          name: 'account',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "The [ISO-4217 currency code](https://en.wikipedia.org/wiki/ISO_4217) to use when reporting on monetary metrics. Defaults to the account's currency if not set.",
          in: 'query',
          name: 'currencyCode',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Date range of the report, if unset the range will be considered CUSTOM.',
          in: 'query',
          name: 'dateRange',
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
            ],
            type: 'string',
          },
        },
        {
          description: 'Dimensions to base the report on.',
          explode: true,
          in: 'query',
          name: 'dimensions',
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
              ],
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            "Day of a month. Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant.",
          in: 'query',
          name: 'endDate.day',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Month of a year. Must be from 1 to 12, or 0 to specify a year without a month and day.',
          in: 'query',
          name: 'endDate.month',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Year of the date. Must be from 1 to 9999, or 0 to specify a date without a year.',
          in: 'query',
          name: 'endDate.year',
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'A list of [filters](/adsense/management/reporting/filtering) to apply to the report. All provided filters must match in order for the data to be included in the report.',
          explode: true,
          in: 'query',
          name: 'filters',
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
            'The language to use for translating report output. If unspecified, this defaults to English ("en"). If the given language is not supported, report output will be returned in English. The language is specified as an [IETF BCP-47 language code](https://en.wikipedia.org/wiki/IETF_language_tag).',
          in: 'query',
          name: 'languageCode',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The maximum number of rows of report data to return. Reports producing more rows than the requested limit will be truncated. If unset, this defaults to 100,000 rows for `Reports.GenerateReport` and 1,000,000 rows for `Reports.GenerateCsvReport`, which are also the maximum values permitted here. Report truncation can be identified (for `Reports.GenerateReport` only) by comparing the number of rows returned to the value returned in `total_matched_rows`.',
          in: 'query',
          name: 'limit',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Required. Reporting metrics.',
          explode: true,
          in: 'query',
          name: 'metrics',
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
              ],
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'The name of a dimension or metric to sort the resulting report on, can be prefixed with "+" to sort ascending or "-" to sort descending. If no prefix is specified, the column is sorted ascending.',
          explode: true,
          in: 'query',
          name: 'orderBy',
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
            'Timezone in which to generate the report. If unspecified, this defaults to the account timezone. For more information, see [changing the time zone of your reports](https://support.google.com/adsense/answer/9830725).',
          in: 'query',
          name: 'reportingTimeZone',
          schema: {
            enum: ['REPORTING_TIME_ZONE_UNSPECIFIED', 'ACCOUNT_TIME_ZONE', 'GOOGLE_TIME_ZONE'],
            type: 'string',
          },
        },
        {
          description:
            "Day of a month. Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant.",
          in: 'query',
          name: 'startDate.day',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Month of a year. Must be from 1 to 12, or 0 to specify a year without a month and day.',
          in: 'query',
          name: 'startDate.month',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Year of the date. Must be from 1 to 9999, or 0 to specify a date without a year.',
          in: 'query',
          name: 'startDate.year',
          schema: {
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ReportResult',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/v2/{account}/reports:generateCsv': {
    get: {
      description: 'Generates a csv formatted ad hoc report.',
      operationId: 'adsense.accounts.reports.generateCsv',
      parameters: [
        {
          description: 'Required. The account which owns the collection of reports. Format: accounts/{account}',
          in: 'path',
          name: 'account',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "The [ISO-4217 currency code](https://en.wikipedia.org/wiki/ISO_4217) to use when reporting on monetary metrics. Defaults to the account's currency if not set.",
          in: 'query',
          name: 'currencyCode',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Date range of the report, if unset the range will be considered CUSTOM.',
          in: 'query',
          name: 'dateRange',
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
            ],
            type: 'string',
          },
        },
        {
          description: 'Dimensions to base the report on.',
          explode: true,
          in: 'query',
          name: 'dimensions',
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
              ],
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            "Day of a month. Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant.",
          in: 'query',
          name: 'endDate.day',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Month of a year. Must be from 1 to 12, or 0 to specify a year without a month and day.',
          in: 'query',
          name: 'endDate.month',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Year of the date. Must be from 1 to 9999, or 0 to specify a date without a year.',
          in: 'query',
          name: 'endDate.year',
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'A list of [filters](/adsense/management/reporting/filtering) to apply to the report. All provided filters must match in order for the data to be included in the report.',
          explode: true,
          in: 'query',
          name: 'filters',
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
            'The language to use for translating report output. If unspecified, this defaults to English ("en"). If the given language is not supported, report output will be returned in English. The language is specified as an [IETF BCP-47 language code](https://en.wikipedia.org/wiki/IETF_language_tag).',
          in: 'query',
          name: 'languageCode',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The maximum number of rows of report data to return. Reports producing more rows than the requested limit will be truncated. If unset, this defaults to 100,000 rows for `Reports.GenerateReport` and 1,000,000 rows for `Reports.GenerateCsvReport`, which are also the maximum values permitted here. Report truncation can be identified (for `Reports.GenerateReport` only) by comparing the number of rows returned to the value returned in `total_matched_rows`.',
          in: 'query',
          name: 'limit',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Required. Reporting metrics.',
          explode: true,
          in: 'query',
          name: 'metrics',
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
              ],
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'The name of a dimension or metric to sort the resulting report on, can be prefixed with "+" to sort ascending or "-" to sort descending. If no prefix is specified, the column is sorted ascending.',
          explode: true,
          in: 'query',
          name: 'orderBy',
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
            'Timezone in which to generate the report. If unspecified, this defaults to the account timezone. For more information, see [changing the time zone of your reports](https://support.google.com/adsense/answer/9830725).',
          in: 'query',
          name: 'reportingTimeZone',
          schema: {
            enum: ['REPORTING_TIME_ZONE_UNSPECIFIED', 'ACCOUNT_TIME_ZONE', 'GOOGLE_TIME_ZONE'],
            type: 'string',
          },
        },
        {
          description:
            "Day of a month. Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant.",
          in: 'query',
          name: 'startDate.day',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Month of a year. Must be from 1 to 12, or 0 to specify a year without a month and day.',
          in: 'query',
          name: 'startDate.month',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Year of the date. Must be from 1 to 9999, or 0 to specify a date without a year.',
          in: 'query',
          name: 'startDate.year',
          schema: {
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HttpBody',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/v2/{name}': {
    delete: {
      description:
        'Deletes a custom channel. This method can only be used by projects enabled for the [AdSense for Platforms](https://developers.google.com/adsense/platforms/) product.',
      operationId: 'adsense.accounts.adclients.customchannels.delete',
      parameters: [
        {
          description:
            'Required. Name of the custom channel to delete. Format: accounts/{account}/adclients/{adclient}/customchannels/{customchannel}',
          in: 'path',
          name: 'name',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Empty',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
      ],
      tags: ['accounts'],
    },
    get: {
      description: 'Gets information about the selected site.',
      operationId: 'adsense.accounts.sites.get',
      parameters: [
        {
          description: 'Required. Name of the site. Format: accounts/{account}/sites/{site}',
          in: 'path',
          name: 'name',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Site',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    patch: {
      description:
        'Updates a custom channel. This method can only be used by projects enabled for the [AdSense for Platforms](https://developers.google.com/adsense/platforms/) product.',
      operationId: 'adsense.accounts.adclients.customchannels.patch',
      parameters: [
        {
          description:
            'Output only. Resource name of the custom channel. Format: accounts/{account}/adclients/{adclient}/customchannels/{customchannel}',
          in: 'path',
          name: 'name',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The list of fields to update. If empty, a full update is performed.',
          in: 'query',
          name: 'updateMask',
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CustomChannel',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CustomChannel',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
      ],
      tags: ['accounts'],
    },
  },
  '/v2/{name}/adBlockingRecoveryTag': {
    get: {
      description: 'Gets the ad blocking recovery tag of an account.',
      operationId: 'adsense.accounts.getAdBlockingRecoveryTag',
      parameters: [
        {
          description: 'Required. The name of the account to get the tag for. Format: accounts/{account}',
          in: 'path',
          name: 'name',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AdBlockingRecoveryTag',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/v2/{name}/adcode': {
    get: {
      description:
        'Gets the ad unit code for a given ad unit. For more information, see [About the AdSense code](https://support.google.com/adsense/answer/9274634) and [Where to place the ad code in your HTML](https://support.google.com/adsense/answer/9190028).',
      operationId: 'adsense.accounts.adclients.adunits.getAdcode',
      parameters: [
        {
          description:
            'Required. Name of the adunit for which to get the adcode. Format: accounts/{account}/adclients/{adclient}/adunits/{adunit}',
          in: 'path',
          name: 'name',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AdUnitAdCode',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/v2/{name}/saved': {
    get: {
      description: 'Gets the saved report from the given resource name.',
      operationId: 'adsense.accounts.reports.getSaved',
      parameters: [
        {
          description:
            'Required. The name of the saved report to retrieve. Format: accounts/{account}/reports/{report}',
          in: 'path',
          name: 'name',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SavedReport',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/v2/{name}/saved:generate': {
    get: {
      description: 'Generates a saved report.',
      operationId: 'adsense.accounts.reports.saved.generate',
      parameters: [
        {
          description: 'Required. Name of the saved report. Format: accounts/{account}/reports/{report}',
          in: 'path',
          name: 'name',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "The [ISO-4217 currency code](https://en.wikipedia.org/wiki/ISO_4217) to use when reporting on monetary metrics. Defaults to the account's currency if not set.",
          in: 'query',
          name: 'currencyCode',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Date range of the report, if unset the range will be considered CUSTOM.',
          in: 'query',
          name: 'dateRange',
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
            ],
            type: 'string',
          },
        },
        {
          description:
            "Day of a month. Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant.",
          in: 'query',
          name: 'endDate.day',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Month of a year. Must be from 1 to 12, or 0 to specify a year without a month and day.',
          in: 'query',
          name: 'endDate.month',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Year of the date. Must be from 1 to 9999, or 0 to specify a date without a year.',
          in: 'query',
          name: 'endDate.year',
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'The language to use for translating report output. If unspecified, this defaults to English ("en"). If the given language is not supported, report output will be returned in English. The language is specified as an [IETF BCP-47 language code](https://en.wikipedia.org/wiki/IETF_language_tag).',
          in: 'query',
          name: 'languageCode',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Timezone in which to generate the report. If unspecified, this defaults to the account timezone. For more information, see [changing the time zone of your reports](https://support.google.com/adsense/answer/9830725).',
          in: 'query',
          name: 'reportingTimeZone',
          schema: {
            enum: ['REPORTING_TIME_ZONE_UNSPECIFIED', 'ACCOUNT_TIME_ZONE', 'GOOGLE_TIME_ZONE'],
            type: 'string',
          },
        },
        {
          description:
            "Day of a month. Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant.",
          in: 'query',
          name: 'startDate.day',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Month of a year. Must be from 1 to 12, or 0 to specify a year without a month and day.',
          in: 'query',
          name: 'startDate.month',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Year of the date. Must be from 1 to 9999, or 0 to specify a date without a year.',
          in: 'query',
          name: 'startDate.year',
          schema: {
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ReportResult',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/v2/{name}/saved:generateCsv': {
    get: {
      description: 'Generates a csv formatted saved report.',
      operationId: 'adsense.accounts.reports.saved.generateCsv',
      parameters: [
        {
          description: 'Required. Name of the saved report. Format: accounts/{account}/reports/{report}',
          in: 'path',
          name: 'name',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "The [ISO-4217 currency code](https://en.wikipedia.org/wiki/ISO_4217) to use when reporting on monetary metrics. Defaults to the account's currency if not set.",
          in: 'query',
          name: 'currencyCode',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Date range of the report, if unset the range will be considered CUSTOM.',
          in: 'query',
          name: 'dateRange',
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
            ],
            type: 'string',
          },
        },
        {
          description:
            "Day of a month. Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant.",
          in: 'query',
          name: 'endDate.day',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Month of a year. Must be from 1 to 12, or 0 to specify a year without a month and day.',
          in: 'query',
          name: 'endDate.month',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Year of the date. Must be from 1 to 9999, or 0 to specify a date without a year.',
          in: 'query',
          name: 'endDate.year',
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'The language to use for translating report output. If unspecified, this defaults to English ("en"). If the given language is not supported, report output will be returned in English. The language is specified as an [IETF BCP-47 language code](https://en.wikipedia.org/wiki/IETF_language_tag).',
          in: 'query',
          name: 'languageCode',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Timezone in which to generate the report. If unspecified, this defaults to the account timezone. For more information, see [changing the time zone of your reports](https://support.google.com/adsense/answer/9830725).',
          in: 'query',
          name: 'reportingTimeZone',
          schema: {
            enum: ['REPORTING_TIME_ZONE_UNSPECIFIED', 'ACCOUNT_TIME_ZONE', 'GOOGLE_TIME_ZONE'],
            type: 'string',
          },
        },
        {
          description:
            "Day of a month. Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant.",
          in: 'query',
          name: 'startDate.day',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Month of a year. Must be from 1 to 12, or 0 to specify a year without a month and day.',
          in: 'query',
          name: 'startDate.month',
          schema: {
            type: 'integer',
          },
        },
        {
          description: 'Year of the date. Must be from 1 to 9999, or 0 to specify a date without a year.',
          in: 'query',
          name: 'startDate.year',
          schema: {
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HttpBody',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/v2/{parent}/adclients': {
    get: {
      description: 'Lists all the ad clients available in an account.',
      operationId: 'adsense.accounts.adclients.list',
      parameters: [
        {
          description: 'Required. The account which owns the collection of ad clients. Format: accounts/{account}',
          in: 'path',
          name: 'parent',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The maximum number of ad clients to include in the response, used for paging. If unspecified, at most 10000 ad clients will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.',
          in: 'query',
          name: 'pageSize',
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'A page token, received from a previous `ListAdClients` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListAdClients` must match the call that provided the page token.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListAdClientsResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/v2/{parent}/adunits': {
    get: {
      description: 'Lists all ad units under a specified account and ad client.',
      operationId: 'adsense.accounts.adclients.adunits.list',
      parameters: [
        {
          description:
            'Required. The ad client which owns the collection of ad units. Format: accounts/{account}/adclients/{adclient}',
          in: 'path',
          name: 'parent',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The maximum number of ad units to include in the response, used for paging. If unspecified, at most 10000 ad units will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.',
          in: 'query',
          name: 'pageSize',
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'A page token, received from a previous `ListAdUnits` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListAdUnits` must match the call that provided the page token.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListAdUnitsResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        'Creates an ad unit. This method can only be used by projects enabled for the [AdSense for Platforms](https://developers.google.com/adsense/platforms/) product. Note that ad units can only be created for ad clients with an "AFC" product code. For more info see the [AdClient resource](/adsense/management/reference/rest/v2/accounts.adclients). For now, this method can only be used to create `DISPLAY` ad units. See: https://support.google.com/adsense/answer/9183566',
      operationId: 'adsense.accounts.adclients.adunits.create',
      parameters: [
        {
          description:
            'Required. Ad client to create an ad unit under. Format: accounts/{account}/adclients/{adclient}',
          in: 'path',
          name: 'parent',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AdUnit',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AdUnit',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
      ],
      tags: ['accounts'],
    },
  },
  '/v2/{parent}/alerts': {
    get: {
      description: 'Lists all the alerts available in an account.',
      operationId: 'adsense.accounts.alerts.list',
      parameters: [
        {
          description: 'Required. The account which owns the collection of alerts. Format: accounts/{account}',
          in: 'path',
          name: 'parent',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "The language to use for translating alert messages. If unspecified, this defaults to the user's display language. If the given language is not supported, alerts will be returned in English. The language is specified as an [IETF BCP-47 language code](https://en.wikipedia.org/wiki/IETF_language_tag).",
          in: 'query',
          name: 'languageCode',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListAlertsResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/v2/{parent}/customchannels': {
    get: {
      description: 'Lists all the custom channels available in an ad client.',
      operationId: 'adsense.accounts.adclients.customchannels.list',
      parameters: [
        {
          description:
            'Required. The ad client which owns the collection of custom channels. Format: accounts/{account}/adclients/{adclient}',
          in: 'path',
          name: 'parent',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The maximum number of custom channels to include in the response, used for paging. If unspecified, at most 10000 custom channels will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.',
          in: 'query',
          name: 'pageSize',
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'A page token, received from a previous `ListCustomChannels` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListCustomChannels` must match the call that provided the page token.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListCustomChannelsResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        'Creates a custom channel. This method can only be used by projects enabled for the [AdSense for Platforms](https://developers.google.com/adsense/platforms/) product.',
      operationId: 'adsense.accounts.adclients.customchannels.create',
      parameters: [
        {
          description:
            'Required. The ad client to create a custom channel under. Format: accounts/{account}/adclients/{adclient}',
          in: 'path',
          name: 'parent',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CustomChannel',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CustomChannel',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
      ],
      tags: ['accounts'],
    },
  },
  '/v2/{parent}/payments': {
    get: {
      description: 'Lists all the payments available for an account.',
      operationId: 'adsense.accounts.payments.list',
      parameters: [
        {
          description: 'Required. The account which owns the collection of payments. Format: accounts/{account}',
          in: 'path',
          name: 'parent',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListPaymentsResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/v2/{parent}/reports/saved': {
    get: {
      description: 'Lists saved reports.',
      operationId: 'adsense.accounts.reports.saved.list',
      parameters: [
        {
          description: 'Required. The account which owns the collection of reports. Format: accounts/{account}',
          in: 'path',
          name: 'parent',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The maximum number of reports to include in the response, used for paging. If unspecified, at most 10000 reports will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.',
          in: 'query',
          name: 'pageSize',
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'A page token, received from a previous `ListSavedReports` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListSavedReports` must match the call that provided the page token.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListSavedReportsResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/v2/{parent}/sites': {
    get: {
      description: 'Lists all the sites available in an account.',
      operationId: 'adsense.accounts.sites.list',
      parameters: [
        {
          description: 'Required. The account which owns the collection of sites. Format: accounts/{account}',
          in: 'path',
          name: 'parent',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The maximum number of sites to include in the response, used for paging. If unspecified, at most 10000 sites will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.',
          in: 'query',
          name: 'pageSize',
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'A page token, received from a previous `ListSites` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListSites` must match the call that provided the page token.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListSitesResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/v2/{parent}/urlchannels': {
    get: {
      description: 'Lists active url channels.',
      operationId: 'adsense.accounts.adclients.urlchannels.list',
      parameters: [
        {
          description:
            'Required. The ad client which owns the collection of url channels. Format: accounts/{account}/adclients/{adclient}',
          in: 'path',
          name: 'parent',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The maximum number of url channels to include in the response, used for paging. If unspecified, at most 10000 url channels will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.',
          in: 'query',
          name: 'pageSize',
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'A page token, received from a previous `ListUrlChannels` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListUrlChannels` must match the call that provided the page token.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListUrlChannelsResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/v2/{parent}:listChildAccounts': {
    get: {
      description: 'Lists all accounts directly managed by the given AdSense account.',
      operationId: 'adsense.accounts.listChildAccounts',
      parameters: [
        {
          description: 'Required. The parent account, which owns the child accounts. Format: accounts/{account}',
          in: 'path',
          name: 'parent',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The maximum number of accounts to include in the response, used for paging. If unspecified, at most 10000 accounts will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.',
          in: 'query',
          name: 'pageSize',
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'A page token, received from a previous `ListChildAccounts` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListChildAccounts` must match the call that provided the page token.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListChildAccountsResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/v2/{parent}:listLinkedAdUnits': {
    get: {
      description: 'Lists all the ad units available for a custom channel.',
      operationId: 'adsense.accounts.adclients.customchannels.listLinkedAdUnits',
      parameters: [
        {
          description:
            'Required. The custom channel which owns the collection of ad units. Format: accounts/{account}/adclients/{adclient}/customchannels/{customchannel}',
          in: 'path',
          name: 'parent',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The maximum number of ad units to include in the response, used for paging. If unspecified, at most 10000 ad units will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.',
          in: 'query',
          name: 'pageSize',
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'A page token, received from a previous `ListLinkedAdUnits` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListLinkedAdUnits` must match the call that provided the page token.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListLinkedAdUnitsResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/v2/{parent}:listLinkedCustomChannels': {
    get: {
      description: 'Lists all the custom channels available for an ad unit.',
      operationId: 'adsense.accounts.adclients.adunits.listLinkedCustomChannels',
      parameters: [
        {
          description:
            'Required. The ad unit which owns the collection of custom channels. Format: accounts/{account}/adclients/{adclient}/adunits/{adunit}',
          in: 'path',
          name: 'parent',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The maximum number of custom channels to include in the response, used for paging. If unspecified, at most 10000 custom channels will be returned. The maximum value is 10000; values above 10000 will be coerced to 10000.',
          in: 'query',
          name: 'pageSize',
          schema: {
            type: 'integer',
          },
        },
        {
          description:
            'A page token, received from a previous `ListLinkedCustomChannels` call. Provide this to retrieve the subsequent page. When paginating, all other parameters provided to `ListLinkedCustomChannels` must match the call that provided the page token.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListLinkedCustomChannelsResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/adsense.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/adsense.readonly'],
        },
      ],
      tags: ['accounts'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
} as TPaths;
