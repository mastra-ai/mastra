// @ts-nocheck
export type openapi = {
  openapi: '3.1.0';
  servers: [
    {
      url: 'https://api.lever.co/v1';
      description: 'production';
    },
    {
      url: 'https://api.sandbox.lever.co/v1';
      description: 'sandbox';
    },
  ];
  paths: {
    '/postings/{id}': {
      get: {
        operationId: 'getPosting';
        parameters: [
          {
            in: 'path';
            name: 'id';
            description: 'The ID of the posting to retrieve';
            schema: {
              type: 'string';
              description: 'The ID of the posting to retrieve';
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
                    data: {
                      $ref: '#/components/schemas/posting';
                    };
                  };
                  required: ['data'];
                };
              };
            };
          };
        };
      };
    };
    '/postings': {
      get: {
        operationId: 'getPostings';
        parameters: [
          {
            in: 'query';
            name: 'limit';
            description: 'A limit on the number of objects to be returned. The limit can range between 1 and 100 items. If no limit is specified, the default for that endpoint is used.';
            schema: {
              type: 'number';
              description: 'A limit on the number of objects to be returned. The limit can range between 1 and 100 items. If no limit is specified, the default for that endpoint is used.';
            };
          },
          {
            in: 'query';
            name: 'offset';
            description: 'An offset token specifying the next page of results to return. A paginated list response will include a next attribute that includes an offset token, which can be used as an input parameter to the next request. If an offset is not passed in, the API will fetch the first page of results. You can only pass in an offset that was returned to you via a previously paginated request.';
            schema: {
              type: 'string';
              description: 'An offset token specifying the next page of results to return. A paginated list response will include a next attribute that includes an offset token, which can be used as an input parameter to the next request. If an offset is not passed in, the API will fetch the first page of results. You can only pass in an offset that was returned to you via a previously paginated request.';
            };
          },
          {
            in: 'query';
            name: 'include';
            description: 'Include posting content or followers in list results';
            schema: {
              type: 'string';
              enum: ['content', 'followers'];
              description: 'Include posting content or followers in list results';
            };
          },
          {
            in: 'query';
            name: 'expand';
            description: 'Expand user IDs into full objects in response';
            schema: {
              type: 'string';
              enum: ['user', 'owner', 'hiringManager', 'followers'];
              description: 'Expand user IDs into full objects in response';
            };
          },
          {
            in: 'query';
            name: 'state';
            description: 'Filter postings by state. Valid states are published, internal, closed, draft, pending and rejected.';
            schema: {
              type: 'string';
              description: 'Filter postings by state. Valid states are published, internal, closed, draft, pending and rejected.';
            };
          },
          {
            in: 'query';
            name: 'distributionChannel';
            description: 'Filter published postings by whether they appear on the public job site, internal job site, or both. To retrieve all published postings, you must specify both public and internal';
            schema: {
              type: 'string';
              description: 'Filter published postings by whether they appear on the public job site, internal job site, or both. To retrieve all published postings, you must specify both public and internal';
            };
          },
          {
            in: 'query';
            name: 'confidentiality';
            description: 'Filter postings by confidentiality. If unspecified, defaults to non-confidential. To get both confidential and non-confidential postings you must specify all. Learn more about confidential data in the API.';
            schema: {
              type: 'string';
              description: 'Filter postings by confidentiality. If unspecified, defaults to non-confidential. To get both confidential and non-confidential postings you must specify all. Learn more about confidential data in the API.';
            };
          },
          {
            in: 'query';
            name: 'group';
            description: 'Posting results can be grouped by one of four categories: location, team, department, and commitment.';
            schema: {
              type: 'string';
              description: 'Posting results can be grouped by one of four categories: location, team, department, and commitment.';
            };
          },
          {
            in: 'query';
            name: 'team';
            description: 'Filter postings by team name (e.g. Engineering, Sales, Marketing). Since tags are case-sensitive, Sales will not match sales. Multiple teams can be specified and results will include a union of result sets (i.e. postings for either team). If your company uses departments, the same team name may occur across multiple departments.';
            schema: {
              type: 'string';
              description: 'Filter postings by team name (e.g. Engineering, Sales, Marketing). Since tags are case-sensitive, Sales will not match sales. Multiple teams can be specified and results will include a union of result sets (i.e. postings for either team). If your company uses departments, the same team name may occur across multiple departments.';
            };
          },
          {
            in: 'query';
            name: 'department';
            description: 'Filter postings by department name. Since tags are case-sensitive, Legal will not match legal. Multiple departments can be specified and results will include a union of result sets (i.e. postings for either department).';
            schema: {
              type: 'string';
              description: 'Filter postings by department name. Since tags are case-sensitive, Legal will not match legal. Multiple departments can be specified and results will include a union of result sets (i.e. postings for either department).';
            };
          },
          {
            in: 'query';
            name: 'location';
            description: 'Filter postings by location. Tags are case-sensitive, San Francisco will not match san francisco. Multiple locations can be specified and results will include a union of result sets (i.e. postings for either location).';
            schema: {
              type: 'string';
              description: 'Filter postings by location. Tags are case-sensitive, San Francisco will not match san francisco. Multiple locations can be specified and results will include a union of result sets (i.e. postings for either location).';
            };
          },
          {
            in: 'query';
            name: 'committment';
            description: 'Filter postings by work type (e.g. full-time, internship). Since tags are case-sensitive, Full-time will not match full-time. Multiple work types can be specified and results will include a union of result sets (i.e. postings of either work type).';
            schema: {
              type: 'string';
              description: 'Filter postings by work type (e.g. full-time, internship). Since tags are case-sensitive, Full-time will not match full-time. Multiple work types can be specified and results will include a union of result sets (i.e. postings of either work type).';
            };
          },
          {
            in: 'query';
            name: 'level';
            description: 'Deprecated but currently maintained for backward compatibility. Filter postings by level (e.g. junior, senior, manager). Since tags are case-sensitive, Manager will not match manager. Multiple levels can be specified and results will include a union of result sets (i.e. postings of either level).';
            schema: {
              type: 'string';
              description: 'Deprecated but currently maintained for backward compatibility. Filter postings by level (e.g. junior, senior, manager). Since tags are case-sensitive, Manager will not match manager. Multiple levels can be specified and results will include a union of result sets (i.e. postings of either level).';
            };
          },
          {
            in: 'query';
            name: 'tag';
            description: 'Filter postings by tag. Tags are case-sensitive, so Engineering will not match engineering. Multiple tags can be specified and results will include a union of result sets (i.e. postings that have either tag). To specify multiple tags, include the tag parameter multiple times (e.g ?tag=engineering&tag=product)';
            schema: {
              type: 'string';
              description: 'Filter postings by tag. Tags are case-sensitive, so Engineering will not match engineering. Multiple tags can be specified and results will include a union of result sets (i.e. postings that have either tag). To specify multiple tags, include the tag parameter multiple times (e.g ?tag=engineering&tag=product)';
            };
          },
          {
            in: 'query';
            name: 'updated_at_start';
            description: 'Filter postings by the timestamp they were last updated. If only updated_at_start is specified, all postings updated from that timestamp (inclusive) to the present will be included. If only updated_at_end is specified, all postings updated before that timestamp (inclusive) are included. Both the updated_at_start and updated_at_end can be specified simultaneously, and results will be all postings updated within the provided timestamps (inclusive) will be returned.';
            schema: {
              type: 'number';
              description: 'Filter postings by the timestamp they were last updated. If only updated_at_start is specified, all postings updated from that timestamp (inclusive) to the present will be included. If only updated_at_end is specified, all postings updated before that timestamp (inclusive) are included. Both the updated_at_start and updated_at_end can be specified simultaneously, and results will be all postings updated within the provided timestamps (inclusive) will be returned.';
            };
          },
          {
            in: 'query';
            name: 'updated_at_end';
            description: 'Filter postings by the timestamp they were last updated. If only updated_at_start is specified, all postings updated from that timestamp (inclusive) to the present will be included. If only updated_at_end is specified, all postings updated before that timestamp (inclusive) are included. Both the updated_at_start and updated_at_end can be specified simultaneously, and results will be all postings updated within the provided timestamps (inclusive) will be returned.';
            schema: {
              type: 'number';
              description: 'Filter postings by the timestamp they were last updated. If only updated_at_start is specified, all postings updated from that timestamp (inclusive) to the present will be included. If only updated_at_end is specified, all postings updated before that timestamp (inclusive) are included. Both the updated_at_start and updated_at_end can be specified simultaneously, and results will be all postings updated within the provided timestamps (inclusive) will be returned.';
            };
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
                    data: {
                      type: 'array';
                      items: {
                        $ref: '#/components/schemas/posting';
                      };
                    };
                    hasNext: {
                      type: 'boolean';
                    };
                    next: {
                      type: 'string';
                    };
                  };
                  required: ['data'];
                };
              };
            };
          };
        };
      };
    };
    '/opportunities/{id}': {
      get: {
        operationId: 'getOpportunity';
        parameters: [
          {
            in: 'path';
            name: 'id';
            description: 'The ID of the opportunity to retrieve';
            schema: {
              type: 'string';
              description: 'The ID of the opportunity to retrieve';
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
                    data: {
                      $ref: '#/components/schemas/opportunity';
                    };
                  };
                  required: ['data'];
                };
              };
            };
          };
        };
      };
    };
    '/opportunities/{id}/offers': {
      get: {
        operationId: 'getOffers';
        parameters: [
          {
            in: 'path';
            name: 'id';
            description: 'The ID of the opportunity to retrieve offers for';
            schema: {
              type: 'string';
              description: 'The ID of the opportunity to retrieve offers for';
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
                    data: {
                      $ref: '#/components/schemas/offer';
                    };
                  };
                  required: ['data'];
                };
              };
            };
          };
        };
      };
    };
    '/opportunities': {
      get: {
        operationId: 'getOpportunities';
        parameters: [
          {
            in: 'query';
            name: 'limit';
            description: 'A limit on the number of objects to be returned. The limit can range between 1 and 100 items. If no limit is specified, the default for that endpoint is used.';
            schema: {
              type: 'number';
              description: 'A limit on the number of objects to be returned. The limit can range between 1 and 100 items. If no limit is specified, the default for that endpoint is used.';
            };
          },
          {
            in: 'query';
            name: 'offset';
            description: 'An offset token specifying the next page of results to return. A paginated list response will include a next attribute that includes an offset token, which can be used as an input parameter to the next request. If an offset is not passed in, the API will fetch the first page of results. You can only pass in an offset that was returned to you via a previously paginated request.';
            schema: {
              type: 'string';
              description: 'An offset token specifying the next page of results to return. A paginated list response will include a next attribute that includes an offset token, which can be used as an input parameter to the next request. If an offset is not passed in, the API will fetch the first page of results. You can only pass in an offset that was returned to you via a previously paginated request.';
            };
          },
          {
            in: 'query';
            name: 'include';
            description: 'Include Opportunity followers in list results';
            schema: {
              type: 'string';
              enum: ['followers'];
              description: 'Include Opportunity followers in list results';
            };
          },
          {
            in: 'query';
            name: 'expand';
            description: 'Expand application, stage, contact, or user IDs into full objects in response';
            schema: {
              type: 'string';
              enum: ['applications', 'stage', 'owner', 'followers', 'sourcedBy', 'contact'];
              description: 'Expand application, stage, contact, or user IDs into full objects in response';
            };
          },
          {
            in: 'query';
            name: 'tag';
            description: 'Filter Opportunities by tag (case sensitive). Results will include Opportunities that contain the specified tag. Multiple tags can be specified and results will include a union of result sets (i.e. Opportunities that have either tag).';
            schema: {
              type: 'string';
              description: 'Filter Opportunities by tag (case sensitive). Results will include Opportunities that contain the specified tag. Multiple tags can be specified and results will include a union of result sets (i.e. Opportunities that have either tag).';
            };
          },
          {
            in: 'query';
            name: 'email';
            description: 'Filter Opportunities by an email address. Results will include Opportunities for Contacts that contain the canonicalized email address.';
            schema: {
              type: 'string';
              description: 'Filter Opportunities by an email address. Results will include Opportunities for Contacts that contain the canonicalized email address.';
            };
          },
          {
            in: 'query';
            name: 'origin';
            description: 'Filter Opportunities by origin. Results will include Opportunities that contain the specified origin. Multiple origins can be specified and results will include a union of result sets (i.e. Opportunities from either origin).';
            schema: {
              type: 'string';
              description: 'Filter Opportunities by origin. Results will include Opportunities that contain the specified origin. Multiple origins can be specified and results will include a union of result sets (i.e. Opportunities from either origin).';
            };
          },
          {
            in: 'query';
            name: 'source';
            description: 'Filter Opportunities by source. Results will include Opportunities that contain the specified source tag. Multiple sources can be specified and results will include a union of result sets (i.e. Opportunities from either source).';
            schema: {
              type: 'string';
              description: 'Filter Opportunities by source. Results will include Opportunities that contain the specified source tag. Multiple sources can be specified and results will include a union of result sets (i.e. Opportunities from either source).';
            };
          },
          {
            in: 'query';
            name: 'confidentiality';
            description: 'Filter opportunities by confidentiality. If unspecified, defaults to non-confidential. To get both confidential and non-confidential opportunities you must specify all. Learn more about confidential data in the API.';
            schema: {
              type: 'string';
              description: 'Filter opportunities by confidentiality. If unspecified, defaults to non-confidential. To get both confidential and non-confidential opportunities you must specify all. Learn more about confidential data in the API.';
            };
          },
          {
            in: 'query';
            name: 'stage_id';
            description: 'Filter Opportunities by current stage. Results will include Opportunities that are currently in the specified stage. Multiple stages can be specified and results will include a union of result sets (i.e. Opportunities that are in either stage).';
            schema: {
              type: 'string';
              description: 'Filter Opportunities by current stage. Results will include Opportunities that are currently in the specified stage. Multiple stages can be specified and results will include a union of result sets (i.e. Opportunities that are in either stage).';
            };
          },
          {
            in: 'query';
            name: 'posting_id';
            description: 'Filter Opportunities by posting. Results will include Opportunities that are applied to the specified posting. Multiple postings can be specified and results will include a union of result sets (i.e. Opportunities that are applied to either posting).';
            schema: {
              type: 'string';
              description: 'Filter Opportunities by posting. Results will include Opportunities that are applied to the specified posting. Multiple postings can be specified and results will include a union of result sets (i.e. Opportunities that are applied to either posting).';
            };
          },
          {
            in: 'query';
            name: 'archived_posting_id';
            description: 'Filter Opportunities by postings for which they have been archived. Results will include opportunities for candidates that applied to the specified posting and then the application was archived. Multiple postings can be specified and results will include a union of result sets (i.e. Opportunities that were applied to either posting).';
            schema: {
              type: 'string';
              description: 'Filter Opportunities by postings for which they have been archived. Results will include opportunities for candidates that applied to the specified posting and then the application was archived. Multiple postings can be specified and results will include a union of result sets (i.e. Opportunities that were applied to either posting).';
            };
          },
          {
            in: 'query';
            name: 'created_at_start';
            description: 'Filter Opportunities by the timestamp they were created. If only created_at_start is specified, all Opportunities created from that timestamp (inclusive) to the present will be included. If only created_at_end is specified, all Opportunities created before that timestamp (inclusive) are included.';
            schema: {
              type: 'number';
              description: 'Filter Opportunities by the timestamp they were created. If only created_at_start is specified, all Opportunities created from that timestamp (inclusive) to the present will be included. If only created_at_end is specified, all Opportunities created before that timestamp (inclusive) are included.';
            };
          },
          {
            in: 'query';
            name: 'created_at_end';
            description: 'Filter Opportunities by the timestamp they were created. If only created_at_start is specified, all Opportunities created from that timestamp (inclusive) to the present will be included. If only created_at_end is specified, all Opportunities created before that timestamp (inclusive) are included.';
            schema: {
              type: 'number';
              description: 'Filter Opportunities by the timestamp they were created. If only created_at_start is specified, all Opportunities created from that timestamp (inclusive) to the present will be included. If only created_at_end is specified, all Opportunities created before that timestamp (inclusive) are included.';
            };
          },
          {
            in: 'query';
            name: 'updated_at_start';
            description: 'Filter Opportunities by the timestamp they were last updated. If only updated_at_start is specified, all Opportunities updated from that timestamp (inclusive) to the present will be included. If only updated_at_end is specified, all Opportunities updated before that timestamp (inclusive) are included.';
            schema: {
              type: 'number';
              description: 'Filter Opportunities by the timestamp they were last updated. If only updated_at_start is specified, all Opportunities updated from that timestamp (inclusive) to the present will be included. If only updated_at_end is specified, all Opportunities updated before that timestamp (inclusive) are included.';
            };
          },
          {
            in: 'query';
            name: 'updated_at_end';
            description: 'Filter Opportunities by the timestamp they were last updated. If only updated_at_start is specified, all Opportunities updated from that timestamp (inclusive) to the present will be included. If only updated_at_end is specified, all Opportunities updated before that timestamp (inclusive) are included.';
            schema: {
              type: 'number';
              description: 'Filter Opportunities by the timestamp they were last updated. If only updated_at_start is specified, all Opportunities updated from that timestamp (inclusive) to the present will be included. If only updated_at_end is specified, all Opportunities updated before that timestamp (inclusive) are included.';
            };
          },
          {
            in: 'query';
            name: 'advanced_at_start';
            description: 'Filter Opportunities by the timestamp they were advanced to their current stage. If only advanced_at_start is specified, all Opportunities advanced from that timestamp (inclusive) to the present will be included. If only advanced_at_end is specified, all Opportunities advanced before that timestamp (inclusive) are included.';
            schema: {
              type: 'number';
              description: 'Filter Opportunities by the timestamp they were advanced to their current stage. If only advanced_at_start is specified, all Opportunities advanced from that timestamp (inclusive) to the present will be included. If only advanced_at_end is specified, all Opportunities advanced before that timestamp (inclusive) are included.';
            };
          },
          {
            in: 'query';
            name: 'advanced_at_end';
            description: 'Filter Opportunities by the timestamp they were advanced to their current stage. If only advanced_at_start is specified, all Opportunities advanced from that timestamp (inclusive) to the present will be included. If only advanced_at_end is specified, all Opportunities advanced before that timestamp (inclusive) are included.';
            schema: {
              type: 'number';
              description: 'Filter Opportunities by the timestamp they were advanced to their current stage. If only advanced_at_start is specified, all Opportunities advanced from that timestamp (inclusive) to the present will be included. If only advanced_at_end is specified, all Opportunities advanced before that timestamp (inclusive) are included.';
            };
          },
          {
            in: 'query';
            name: 'archived_at_start';
            description: 'Filter Opportunities by the timestamp they were archived. If only archived_at_start is specified, all Opportunities archived from that timestamp (inclusive) to the present will be included. If only archived_at_end is specified, all Opportunities archived before that timestamp (inclusive) are included.';
            schema: {
              type: 'number';
              description: 'Filter Opportunities by the timestamp they were archived. If only archived_at_start is specified, all Opportunities archived from that timestamp (inclusive) to the present will be included. If only archived_at_end is specified, all Opportunities archived before that timestamp (inclusive) are included.';
            };
          },
          {
            in: 'query';
            name: 'archived_at_end';
            description: 'Filter Opportunities by the timestamp they were archived. If only archived_at_start is specified, all Opportunities archived from that timestamp (inclusive) to the present will be included. If only archived_at_end is specified, all Opportunities archived before that timestamp (inclusive) are included.';
            schema: {
              type: 'number';
              description: 'Filter Opportunities by the timestamp they were archived. If only archived_at_start is specified, all Opportunities archived from that timestamp (inclusive) to the present will be included. If only archived_at_end is specified, all Opportunities archived before that timestamp (inclusive) are included.';
            };
          },
          {
            in: 'query';
            name: 'archived';
            description: 'Filter Opportunities by archive status. If unspecified, results include both archived and unarchived Opportunities. If true, results only include archived Opportunities. If false, results only include active Opportunities.';
            schema: {
              type: 'boolean';
              description: 'Filter Opportunities by archive status. If unspecified, results include both archived and unarchived Opportunities. If true, results only include archived Opportunities. If false, results only include active Opportunities.';
            };
          },
          {
            in: 'query';
            name: 'archive_reason_id';
            description: 'Filter Opportunities by archive reason. Results will include Opportunities that have been archived with the specified reason. Multiple archive reasons can be specified and results will include a union of result sets (i.e. Opportunities that have been archived for either reason).';
            schema: {
              type: 'string';
              description: 'Filter Opportunities by archive reason. Results will include Opportunities that have been archived with the specified reason. Multiple archive reasons can be specified and results will include a union of result sets (i.e. Opportunities that have been archived for either reason).';
            };
          },
          {
            in: 'query';
            name: 'snoozed';
            description: 'Filter Opportunities by snoozed status. If unspecified, results include both snoozed and unsnoozed Opportunities. If true, results only include snoozed Opportunities. If false, results only include unsnoozed Opportunities.';
            schema: {
              type: 'boolean';
              description: 'Filter Opportunities by snoozed status. If unspecified, results include both snoozed and unsnoozed Opportunities. If true, results only include snoozed Opportunities. If false, results only include unsnoozed Opportunities.';
            };
          },
          {
            in: 'query';
            name: 'contact_id';
            description: 'Filter Opportunities by contact. Results will include the Opportunities that match the specified contact. Multiple contacts can be specified and results will include a union of result sets (i.e. Opportunities that match each of the contacts).';
            schema: {
              type: 'string';
              description: 'Filter Opportunities by contact. Results will include the Opportunities that match the specified contact. Multiple contacts can be specified and results will include a union of result sets (i.e. Opportunities that match each of the contacts).';
            };
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
                    data: {
                      type: 'array';
                      items: {
                        $ref: '#/components/schemas/opportunity';
                      };
                    };
                    hasNext: {
                      type: 'boolean';
                    };
                    next: {
                      type: 'string';
                    };
                  };
                  required: ['data'];
                };
              };
            };
          };
        };
      };
    };
    '/contacts/{id}': {
      get: {
        operationId: 'getContacts';
        parameters: [
          {
            in: 'path';
            name: 'id';
            description: 'The ID of the contact to retrieve';
            schema: {
              type: 'string';
              description: 'The ID of the contact to retrieve';
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
                    data: {
                      $ref: '#/components/schemas/contact';
                    };
                  };
                  required: ['data'];
                };
              };
            };
          };
        };
      };
    };
    '/tags': {
      get: {
        operationId: 'getTags';
        parameters: [
          {
            in: 'query';
            name: 'limit';
            description: 'A limit on the number of objects to be returned. The limit can range between 1 and 100 items. If no limit is specified, the default for that endpoint is used.';
            schema: {
              type: 'number';
              description: 'A limit on the number of objects to be returned. The limit can range between 1 and 100 items. If no limit is specified, the default for that endpoint is used.';
            };
          },
          {
            in: 'query';
            name: 'offset';
            description: 'An offset token specifying the next page of results to return. A paginated list response will include a next attribute that includes an offset token, which can be used as an input parameter to the next request. If an offset is not passed in, the API will fetch the first page of results. You can only pass in an offset that was returned to you via a previously paginated request.';
            schema: {
              type: 'string';
              description: 'An offset token specifying the next page of results to return. A paginated list response will include a next attribute that includes an offset token, which can be used as an input parameter to the next request. If an offset is not passed in, the API will fetch the first page of results. You can only pass in an offset that was returned to you via a previously paginated request.';
            };
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
                    data: {
                      type: 'array';
                      items: {
                        $ref: '#/components/schemas/tag';
                      };
                    };
                    hasNext: {
                      type: 'boolean';
                    };
                    next: {
                      type: 'string';
                    };
                  };
                  required: ['data'];
                };
              };
            };
          };
        };
      };
    };
    '/stages': {
      get: {
        operationId: 'listStages';
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
                    data: {
                      type: 'array';
                      items: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            examples: [
                              'lead-new',
                              'lead-reached-out',
                              'lead-responded',
                              'applicant-new',
                              'offer',
                              '<string>',
                            ];
                          };
                          text: {
                            type: 'string';
                          };
                        };
                        required: ['id', 'text'];
                      };
                    };
                    hasNext: {
                      type: 'boolean';
                    };
                    next: {
                      type: 'string';
                    };
                  };
                  required: ['data'];
                };
              };
            };
          };
        };
      };
    };
    '/archive_reasons': {
      get: {
        operationId: 'listArchiveReasons';
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
                    data: {
                      type: 'array';
                      items: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                          };
                          text: {
                            type: 'string';
                          };
                          status: {
                            type: 'string';
                            enum: ['active', 'inactive'];
                          };
                          type: {
                            type: 'string';
                            enum: ['non-hired', 'hired'];
                          };
                        };
                        required: ['id', 'text', 'status', 'type'];
                      };
                    };
                    hasNext: {
                      type: 'boolean';
                    };
                    next: {
                      type: 'string';
                    };
                  };
                  required: ['data'];
                };
              };
            };
          };
        };
      };
    };
  };
  components: {
    schemas: {
      posting: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
          };
          text: {
            type: 'string';
          };
          createdAt: {
            type: 'number';
          };
          updatedAt: {
            type: 'number';
          };
          user: {
            type: 'string';
          };
          owner: {
            type: 'string';
          };
          hiringManager: {
            type: 'string';
          };
          confidentiality: {
            type: 'string';
            enum: ['non-confidential', 'confidential'];
          };
          categories: {
            type: 'object';
            properties: {
              team: {
                type: 'string';
              };
              department: {
                type: 'string';
              };
              location: {
                type: 'string';
              };
              allLocations: {
                type: 'array';
                items: {
                  type: 'string';
                };
              };
              commitment: {
                type: 'string';
              };
              level: {
                type: 'string';
              };
            };
            required: ['team', 'department', 'location', 'allLocations', 'commitment', 'level'];
          };
          content: {
            type: 'object';
            properties: {
              description: {
                type: 'string';
              };
              descriptionHtml: {
                type: 'string';
              };
              lists: {
                type: 'array';
                items: {
                  type: 'object';
                  properties: {
                    text: {
                      type: 'string';
                    };
                    content: {
                      type: 'string';
                    };
                  };
                  required: ['text', 'content'];
                };
              };
              closing: {
                type: 'string';
              };
              closingHtml: {
                type: 'string';
              };
            };
            required: ['description', 'descriptionHtml', 'lists', 'closing', 'closingHtml'];
          };
          country: {
            type: 'string';
          };
          tags: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
          state: {
            type: 'string';
            enum: ['published'];
          };
          distributionChannels: {
            type: 'array';
            items: {
              type: 'string';
              enum: ['internal', 'public'];
            };
          };
          reqCode: {
            type: 'string';
          };
          requisitionCodes: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
          salaryDescription: {
            type: 'string';
          };
          salaryDescriptionHtml: {
            type: 'string';
          };
          salaryRange: {
            type: 'object';
            properties: {
              max: {
                type: 'number';
              };
              min: {
                type: 'number';
              };
              currency: {
                type: 'string';
              };
              interval: {
                type: 'string';
                enum: ['per-year-salary'];
              };
            };
            required: ['max', 'min', 'currency', 'interval'];
          };
          urls: {
            type: 'object';
            properties: {
              list: {
                type: 'string';
                format: 'uri';
              };
              show: {
                type: 'string';
                format: 'uri';
              };
              apply: {
                type: 'string';
                format: 'uri';
              };
            };
            required: ['list', 'show', 'apply'];
          };
          workplaceType: {
            type: 'string';
            enum: ['remote'];
          };
        };
        required: [
          'id',
          'text',
          'createdAt',
          'updatedAt',
          'user',
          'owner',
          'hiringManager',
          'confidentiality',
          'categories',
          'content',
          'country',
          'tags',
          'state',
          'distributionChannels',
          'reqCode',
          'requisitionCodes',
          'salaryDescription',
          'salaryDescriptionHtml',
          'salaryRange',
          'urls',
          'workplaceType',
        ];
        additionalProperties: {};
      };
      opportunity: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
          };
          name: {
            type: 'string';
          };
          headline: {
            type: 'string';
          };
          contact: {
            type: 'string';
          };
          emails: {
            type: 'array';
            items: {
              type: 'string';
              format: 'email';
            };
          };
          phones: {
            type: 'array';
            items: {
              type: 'object';
              properties: {
                value: {
                  type: 'string';
                };
              };
              required: ['value'];
            };
          };
          confidentiality: {
            type: 'string';
          };
          location: {
            type: 'string';
          };
          links: {
            type: 'array';
            items: {
              type: 'string';
              format: 'uri';
            };
          };
          createdAt: {
            type: 'number';
          };
          updatedAt: {
            type: 'number';
          };
          lastInteractionAt: {
            type: 'number';
          };
          lastAdvancedAt: {
            type: 'number';
          };
          snoozedUntil: {
            type: ['number', 'null'];
          };
          archivedAt: {
            type: ['number', 'null'];
          };
          archiveReason: {
            type: ['string', 'null'];
          };
          stage: {
            type: 'string';
          };
          stageChanges: {
            type: 'array';
            items: {
              type: 'object';
              properties: {
                toStageId: {
                  type: 'string';
                };
                toStageIndex: {
                  type: 'number';
                };
                userId: {
                  type: 'string';
                };
                updatedAt: {
                  type: 'number';
                };
              };
              required: ['toStageId', 'toStageIndex', 'userId', 'updatedAt'];
            };
          };
          owner: {
            type: 'string';
          };
          tags: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
          sources: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
          origin: {
            type: 'string';
          };
          sourcedBy: {
            type: 'string';
          };
          applications: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
          resume: {
            type: 'null';
          };
          followers: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
          urls: {
            type: 'object';
            properties: {
              list: {
                type: 'string';
                format: 'uri';
              };
              show: {
                type: 'string';
                format: 'uri';
              };
            };
            required: ['list', 'show'];
          };
          dataProtection: {
            type: 'object';
            properties: {
              store: {
                type: 'object';
                properties: {
                  allowed: {
                    type: 'boolean';
                  };
                  expiresAt: {
                    type: ['number', 'null'];
                  };
                };
                required: ['allowed', 'expiresAt'];
              };
              contact: {
                type: 'object';
                properties: {
                  allowed: {
                    type: 'boolean';
                  };
                  expiresAt: {
                    type: ['number', 'null'];
                  };
                };
                required: ['allowed', 'expiresAt'];
              };
            };
            required: ['store', 'contact'];
          };
          isAnonymized: {
            type: 'boolean';
          };
        };
        required: [
          'id',
          'name',
          'headline',
          'contact',
          'emails',
          'phones',
          'confidentiality',
          'location',
          'links',
          'createdAt',
          'updatedAt',
          'lastInteractionAt',
          'lastAdvancedAt',
          'snoozedUntil',
          'archivedAt',
          'archiveReason',
          'stage',
          'stageChanges',
          'owner',
          'tags',
          'sources',
          'origin',
          'sourcedBy',
          'applications',
          'followers',
          'urls',
          'dataProtection',
          'isAnonymized',
        ];
        description: '\n"Candidates" are individuals who have been added to your Lever account as potential fits for your open job positions. "Opportunities" represent each of an individual’s unique candidacies or journeys through your pipeline for a given job position, meaning a single Candidate can be associated with multiple Opportunities. A “Contact” is a unique individual who may or may not have multiple candidacies or Opportunities.\n\nCandidates enter your pipeline for a new Opportunity by:\n\nApplying to a posting on your jobs site,\nBeing added by an external recruiting agency,\nBeing referred by an employee,\nBeing manually added by a Lever user, or\nBeing sourced from an online profile.\nEach Opportunity can have their own notes, feedback, interview schedules, and additional forms. An opportunity may be “confidential” if it is moving through your pipeline for a job posting that has been created as confidential. Opportunities exit your pipeline by being archived for one of two reasons: (1) The candidate was rejected for the opportunity, or (2) The candidate was hired for the opportunity.\n\nA "Contact" is an object that our application uses internally to identify an individual person and their personal or contact information, even though they may have multiple opportunities. From this API, the "Contact" is exposed via the contact field, which returns the unique ID for a Contact across your account. Contact information will be shared and consistent across an individual person\'s opportunities, and will continue to be aggregated onto individual opportunities in the responses to all GET and POST requests to /opportunities.\n\n@see https://hire.sandbox.lever.co/developer/documentation#opportunities\n\n\nWARNING: The Candidates (/candidates) endpoints were deprecated as of 2020. Though they are maintained for backwards compatibility, going forward please see Opportunities endpoints to find the contacts for each job opportunity.\n    ';
      };
      offer: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
            format: 'uuid';
          };
          createdAt: {
            type: 'number';
          };
          status: {
            type: 'string';
            enum: ['draft', 'approval-sent', 'approved', 'sent', 'sent-manually', 'opened', 'denied', 'signed'];
          };
          creator: {
            type: 'string';
            format: 'uuid';
          };
          fields: {
            type: 'array';
            items: {
              type: 'object';
              properties: {
                text: {
                  type: 'string';
                };
                identifier: {
                  type: 'string';
                };
                value: {
                  anyOf: [
                    {
                      type: 'string';
                    },
                    {
                      type: 'number';
                    },
                  ];
                };
              };
              required: ['text', 'identifier', 'value'];
            };
          };
          sentDocument: {
            type: ['object', 'null'];
            properties: {
              fileName: {
                type: 'string';
              };
              uploadedAt: {
                type: 'number';
              };
              downloadUrl: {
                type: 'string';
                format: 'uri';
              };
            };
            required: ['fileName', 'uploadedAt', 'downloadUrl'];
          };
          signedDocument: {
            type: ['object', 'null'];
            properties: {
              fileName: {
                type: 'string';
              };
              uploadedAt: {
                type: 'number';
              };
              downloadUrl: {
                type: 'string';
                format: 'uri';
              };
            };
            required: ['fileName', 'uploadedAt', 'downloadUrl'];
          };
        };
        required: ['id', 'createdAt', 'status', 'creator', 'fields', 'sentDocument', 'signedDocument'];
        additionalProperties: {};
      };
      contact: {
        type: 'object';
        properties: {
          id: {
            type: 'string';
          };
          name: {
            type: 'string';
          };
          headline: {
            type: 'string';
          };
          isAnonymized: {
            type: 'boolean';
          };
          location: {
            type: 'object';
            properties: {
              name: {
                type: 'string';
              };
            };
            required: ['name'];
          };
          emails: {
            type: 'array';
            items: {
              type: 'string';
              format: 'email';
            };
          };
          phones: {
            type: 'array';
            items: {
              type: 'object';
              properties: {
                value: {
                  type: 'string';
                };
              };
              required: ['value'];
            };
          };
        };
        required: ['id', 'name', 'headline', 'isAnonymized', 'location', 'emails', 'phones'];
      };
      tag: {
        type: 'object';
        properties: {
          text: {
            type: 'string';
          };
          count: {
            type: 'number';
          };
        };
        required: ['text', 'count'];
      };
    };
  };
};
