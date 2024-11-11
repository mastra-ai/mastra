// @ts-nocheck
export type TPaths = {
  '/apiKey.info': {
    post: {
      summary: 'apiKey.info';
      description: 'Retrieve information about the API key being used to make the request.\n\n**Requires the [`apiKeysRead`](authentication#permissions-apikeyinfo) permission.**\n';
      operationId: 'apiKeyInfo';
      tags: ['API Key'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the apiKey.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              title: {
                                type: 'string';
                                description: 'The name of the API key.';
                                example: 'Custom Job Board API key';
                              };
                              createdAt: {
                                $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                              };
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
      security: [
        {
          BasicAuth: [];
        },
      ];
    };
  };
  '/application.change_source': {
    post: {
      summary: 'application.changeSource';
      operationId: 'applicationChangeSource';
      description: 'Change the source of an application.\n\n**Requires the [`candidatesWrite`](authentication#permissions-applicationchangesource) permission.**\n';
      tags: ['Application'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                applicationId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the application to update the source of';
                    },
                  ];
                };
                sourceId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: "The source to set on the application. Pass null to unset an application's source.";
                    },
                  ];
                };
              };
              required: ['applicationId', 'sourceId'];
              example: {
                applicationId: '3ae2b801-19f6-41ef-ad28-214bd731948f';
                sourceId: '2c6991c5-c9e2-4af8-879e-29c5a9d26509';
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the application.changeSource endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/application.change_stage': {
    post: {
      summary: 'application.changeStage';
      operationId: 'applicationChangeStage';
      description: 'Change the stage of an application\n\n**Requires the [`candidatesWrite`](authentication#permissions-applicationchangestage) permission.**\n';
      tags: ['Application'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                applicationId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the application to update the stage of';
                    },
                  ];
                };
                interviewStageId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The interview stage to move the application to.';
                    },
                  ];
                };
                archiveReasonId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'Archive Reason to set when moving to an Interview Stage with type: `Archived`. \nNote: You must pass this parameter when moving to an Interview Stage with type: `Archived`\n';
                    },
                  ];
                };
              };
              required: ['applicationId', 'interviewStageId'];
              example: {
                applicationId: '3ae2b801-19f6-41ef-ad28-214bd731948f';
                interviewStageId: '2c6991c5-c9e2-4af8-879e-29c5a9d26509';
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the application.changeStage endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/application.create': {
    post: {
      summary: 'application.create';
      operationId: 'applicationCreate';
      description: 'Consider a candidate for a job\n\n**Requires the [`candidatesWrite`](authentication#permissions-applicationcreate) permission.**\n';
      tags: ['Application'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                candidateId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the candidate to consider for a job';
                    },
                  ];
                };
                jobId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the job to consider the candidate for';
                    },
                  ];
                };
                interviewPlanId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the interview plan to place the application in. If none is provided, the default interview plan is used.\n';
                    },
                  ];
                };
                interviewStageId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The interview stage of the interview plan (either default or provided) to place the application in. \nIf none is provided, the application is placed in the first "Lead" stage. \nYou can also supply the special string "FirstPreInterviewScreen", which will choose the first pre-interview-screen stage on the specified job\'s interview plan.\n';
                    },
                  ];
                };
                sourceId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The source to set on the application being created.';
                    },
                  ];
                };
                creditedToUserId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the user the application will be credited to.';
                    },
                  ];
                };
                createdAt: {
                  allOf: [
                    {
                      description: "An ISO date string to set the application's `createdAt` timestamp. When this value isn't provided, the `createdAt` timestamp defaults to the time the the call was made.\n";
                    },
                    {
                      $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                    },
                  ];
                };
                applicationHistory: {
                  allOf: [
                    {
                      type: 'array';
                      description: 'An array of objects representing the application history.';
                      items: {
                        type: 'object';
                        properties: {
                          stageId: {
                            allOf: [
                              {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                              },
                              {
                                description: 'The ID of the interview stage for this history event. This stage must belong to the interview plan associated with the application.';
                              },
                            ];
                          };
                          stageNumber: {
                            allOf: [
                              {
                                type: 'integer';
                              },
                              {
                                description: 'The sort order of this event. 0 is the first, the highest number will be the current stage.';
                              },
                            ];
                          };
                          enteredStageAt: {
                            allOf: [
                              {
                                type: 'string';
                                format: 'date-time';
                                example: '2022-07-21T17:32:28Z';
                              },
                              {
                                description: 'An ISO date string representing the time the application entered this stage.';
                              },
                            ];
                          };
                          archiveReasonId: {
                            allOf: [
                              {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                              },
                              {
                                description: 'The ID of the archive reason. If the interview stage is an `Archived` stage type, this field is required.';
                              },
                            ];
                          };
                        };
                        required: ['stageId', 'stageNumber', 'enteredStageAt'];
                      };
                    },
                    {
                      description: 'An array of objects representing the application history.\n';
                    },
                  ];
                };
              };
              required: ['candidateId', 'jobId'];
              example: {
                candidateId: '3ae2b801-19f6-41ef-ad28-214bd731948f';
                jobId: '2c6991c5-c9e2-4af8-879e-29c5a9d26509';
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the application.create endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/application.info': {
    post: {
      summary: 'application.info';
      operationId: 'applicationInfo';
      description: 'Fetch application details by application id or by submitted form instance id (which is return by the `applicationForm.submit` endpoint). If both applicationId and submittedFormInstanceId are provided, we will lookup by applicationId.\n\n**Requires the [`candidatesRead`](authentication#permissions-applicationinfo) permission.**\n';
      tags: ['Application'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  type: 'object';
                  properties: {
                    applicationId: {
                      allOf: [
                        {
                          description: 'The id of the application to fetch.';
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                      ];
                    };
                    expand: {
                      type: 'array';
                      description: 'Choose to expand the result and include additional data for related objects. \n';
                      items: {
                        type: 'string';
                        enum: ['openings', 'applicationFormSubmissions', 'referrals'];
                      };
                    };
                  };
                  required: ['applicationId'];
                },
                {
                  type: 'object';
                  properties: {
                    submittedFormInstanceId: {
                      allOf: [
                        {
                          description: "The id of the application's submitted form instance to fetch.";
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                      ];
                    };
                    expand: {
                      type: 'array';
                      description: 'Choose to expand the result and include additional data for related objects. \n';
                      items: {
                        type: 'string';
                        enum: ['openings', 'applicationFormSubmissions'];
                      };
                    };
                  };
                  required: ['submittedFormInstanceId'];
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the application.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            allOf: [
                              {
                                $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application';
                              },
                              {
                                type: 'object';
                                properties: {
                                  openings: {
                                    description: 'The openings array will only be included if the `openings` expand parameter is included when the request is made.';
                                    type: 'array';
                                    items: {
                                      $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening';
                                    };
                                  };
                                };
                              },
                              {
                                type: 'object';
                                properties: {
                                  applicationHistory: {
                                    type: 'array';
                                    items: {
                                      type: 'object';
                                      properties: {
                                        id: {
                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                        };
                                        stageId: {
                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                        };
                                        title: {
                                          type: 'string';
                                          title: 'Title';
                                          example: 'Offer';
                                        };
                                        enteredStageAt: {
                                          $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                                        };
                                        leftStageAt: {
                                          $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                                        };
                                        stageNumber: {
                                          type: 'integer';
                                          title: 'Stage Number';
                                          description: "The order of the history event in the application's history. 0 is the first event.";
                                        };
                                        allowedActions: {
                                          type: 'array';
                                          items: {
                                            type: 'enum';
                                            enum: ['none', 'delete', 'set_entered_at'];
                                          };
                                          title: 'Allowed Actions';
                                          description: 'Actions that can be performed on the application via `application.updateHistory`.';
                                          example: ['delete', 'set_entered_at'];
                                        };
                                      };
                                      required: [
                                        'id',
                                        'stageId',
                                        'title',
                                        'enteredStageAt',
                                        'allowedActions',
                                        'stageNumber',
                                      ];
                                    };
                                  };
                                  applicationFormSubmissions: {
                                    type: 'array';
                                    description: 'Application form submissions. These match the response from the `applicationForm.submit` endpoint. Use of the expand parameter is required to fetch.';
                                    items: {
                                      $ref: '#/paths/~1applicationForm.submit/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/submittedFormInstance';
                                    };
                                  };
                                  referrals: {
                                    type: 'array';
                                    items: {
                                      type: 'object';
                                      properties: {
                                        user: {
                                          $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results';
                                        };
                                        referredAt: {
                                          $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                                        };
                                      };
                                    };
                                  };
                                };
                              },
                            ];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/application.list': {
    post: {
      summary: 'application.list';
      operationId: 'applicationList';
      description: 'Gets all applications in the organization.\n\n**Requires the [`candidatesRead`](authentication#permissions-applicationlist) permission.**\n';
      tags: ['Application'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  type: 'object';
                  properties: {
                    createdAfter: {
                      type: 'integer';
                      format: 'int64';
                      description: 'The API will return data after this date, which is the time since the unix epoch in milliseconds';
                    };
                    cursor: {
                      $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema/properties/cursor';
                    };
                    syncToken: {
                      $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema/properties/syncToken';
                    };
                    limit: {
                      $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema/properties/limit';
                    };
                  };
                  example: {
                    createdAfter: 1659979196538;
                    cursor: 'qA';
                    syncToken: '6W05prn4d';
                    limit: 25;
                  };
                },
                {
                  properties: {
                    expand: {
                      type: 'array';
                      description: 'Choose to expand the result and include additional data for related objects. \n';
                      items: {
                        type: 'string';
                        enum: ['openings'];
                      };
                    };
                    status: {
                      type: 'string';
                      enum: ['Hired', 'Archived', 'Active', 'Lead'];
                    };
                    jobId: {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    };
                  };
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the application.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              allOf: [
                                {
                                  $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application';
                                },
                                {
                                  $ref: '#/paths/~1application.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/allOf/1';
                                },
                              ];
                            };
                          };
                        };
                      },
                    ];
                    required: ['results'];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/application.transfer': {
    post: {
      summary: 'application.transfer';
      operationId: 'applicationTransfer';
      description: 'Transfer an application to a different job.\n\n**Requires the [`candidatesWrite`](authentication#permissions-applicationtransfer) permission.**\n';
      tags: ['Application'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                applicationId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the application to transfer.';
                    },
                  ];
                };
                jobId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the job to transfer the application to.';
                    },
                  ];
                };
                interviewPlanId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the interview plan to transfer the application to. \n';
                    },
                  ];
                };
                interviewStageId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The interview stage of the interview plan to transfer the application to. \n';
                    },
                  ];
                };
                startAutomaticActivities: {
                  allOf: [
                    {
                      type: 'boolean';
                    },
                    {
                      description: 'Whether to start any automatic activities set on the target interview stage. \nIf not provided, the default value is `true`.\n';
                    },
                    {
                      default: true;
                    },
                  ];
                };
              };
              required: ['applicationId', 'jobId', 'interviewPlanId', 'interviewStageId'];
              example: {
                applicationId: '3ae2b801-19f6-41ef-ad28-214bd731948f';
                jobId: '2c6991c5-c9e2-4af8-879e-29c5a9d26509';
                interviewPlanId: 'af94aedd-b743-462c-ab22-9e7e356c11b4';
                interviewStageId: '5eb15197-8664-48fd-99cf-fbdc9d25149d';
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the application.transfer endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/application.update': {
    post: {
      summary: 'application.update';
      operationId: 'applicationUpdate';
      description: 'Update an application\n\n**Requires the [`candidatesWrite`](authentication#permissions-applicationupdate) permission.**\n';
      tags: ['Application'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                applicationId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the application to update';
                    },
                  ];
                };
                sourceId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The source to set on the application being created.';
                    },
                  ];
                };
                creditedToUserId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the user the application will be credited to.';
                    },
                  ];
                };
                createdAt: {
                  allOf: [
                    {
                      description: "An ISO date string to set the application's `createdAt` timestamp. When this value isn't provided, the `createdAt` timestamp defaults to the time the the call was made.\n";
                    },
                    {
                      $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                    },
                  ];
                };
                sendNotifications: {
                  type: 'boolean';
                  default: true;
                  description: 'Whether or not users who are subscribed to the application should be notified that application was updated. Default is true.';
                };
              };
              required: ['applicationId'];
              example: {
                applicationId: '3ae2b801-19f6-41ef-ad28-214bd731948f';
                createdAt: '2021-01-01T00:00:00Z';
                creditedToUserId: '3ae2b801-19f6-41ef-ad28-214bd731948f';
                sourceId: '3ae2b801-19f6-41ef-ad28-214bd731948f';
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the application.update endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/application.updateHistory': {
    post: {
      summary: 'application.updateHistory';
      operationId: 'applicationUpdateHistory';
      description: 'Update the history of an application. This endpoint is used to update the history of an application, such as setting the entered stage time or deleting a history event.\n\n**Requires the [`candidatesWrite`](authentication#permissions-applicationupdatehistory) permission and the `Allow updating application history?` setting found in your admin API key permissions configuration.**\n';
      tags: ['Application'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  type: 'object';
                  properties: {
                    applicationId: {
                      allOf: [
                        {
                          description: 'The id of the application to fetch.';
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                      ];
                    };
                    applicationHistory: {
                      type: 'array';
                      description: 'The updated array of application history events. This array should contain all history events for the application, not just the events being updated.';
                      items: {
                        type: 'object';
                        properties: {
                          stageId: {
                            $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                          };
                          stageNumber: {
                            type: 'integer';
                            title: 'Stage Number';
                            description: "The order of the history event in the application's history. 0 is the first event.";
                          };
                          enteredStageAt: {
                            description: 'The time the application entered the stage.';
                            $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                          };
                          applicationHistoryId: {
                            $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                            title: 'Application History ID';
                            description: 'The id of the application history event to update if you are updating an existing event.';
                          };
                          archiveReasonId: {
                            $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                            title: 'Archive Reason ID';
                            description: 'The id of the archive reason to associate with the history event if the stage type is `archived`.';
                          };
                        };
                        required: ['stageId', 'stageNumber', 'enteredStageAt'];
                      };
                    };
                  };
                  required: ['applicationId', 'applicationHistory'];
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the application.updateHistory endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            allOf: [
                              {
                                $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application';
                              },
                              {
                                $ref: '#/paths/~1application.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/allOf/1';
                              },
                              {
                                type: 'object';
                                properties: {
                                  applicationHistory: {
                                    type: 'array';
                                    items: {
                                      $ref: '#/paths/~1application.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/allOf/2/properties/applicationHistory/items';
                                    };
                                  };
                                  applicationFormSubmissions: {
                                    type: 'array';
                                    description: 'Application form submissions. These match the response from the `applicationForm.submit` endpoint. Use of the expand parameter is required to fetch.';
                                    items: {
                                      $ref: '#/paths/~1applicationForm.submit/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/submittedFormInstance';
                                    };
                                  };
                                  referrals: {
                                    type: 'array';
                                    items: {
                                      type: 'object';
                                      properties: {
                                        user: {
                                          $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results';
                                        };
                                        referredAt: {
                                          $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                                        };
                                      };
                                    };
                                  };
                                };
                              },
                            ];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/applicationFeedback.list': {
    post: {
      summary: 'applicationFeedback.list';
      operationId: 'applicationFeedbackList';
      description: 'List all feedback associated with an application.\n\n**Requires the [`candidatesRead`](authentication#permissions-applicationfeedbacklist) permission.**\n\nThe `submittedValues` field in the response contains the submitted feedback in an object where the key is the path of the field and the value is the value submitted for that field.\n';
      tags: ['Application Feedback'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  $ref: '#/paths/~1application.list/post/requestBody/content/application~1json/schema/allOf/0';
                },
                {
                  type: 'object';
                  properties: {
                    applicationId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                        {
                          description: "The id of the application you'd like to fetch feedback for";
                        },
                      ];
                    };
                  };
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the applicationFeedback.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              allOf: [
                                {
                                  type: 'object';
                                  allOf: [
                                    {
                                      $ref: '#/paths/~1applicationForm.submit/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/submittedFormInstance';
                                    },
                                    {
                                      type: 'object';
                                      properties: {
                                        submittedByUser: {
                                          $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results';
                                        };
                                        interviewId: {
                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                        };
                                        feedbackFormDefinitionId: {
                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                        };
                                        applicationHistoryId: {
                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                        };
                                        applicationId: {
                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                        };
                                        submittedAt: {
                                          $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                                        };
                                      };
                                    },
                                  ];
                                  required: ['submittedByUser', 'applicationId'];
                                },
                              ];
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/application.addHiringTeamMember': {
    post: {
      summary: 'application.addHiringTeamMember';
      description: 'Adds an Ashby user to the hiring team at the application level. \n\n**Requires the [`candidateWrite`](authentication#permissions-applicationaddhiringteammember) permission.**\n';
      operationId: 'applicationaddhiringteammember';
      tags: ['Application'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              required: ['applicationId', 'teamMemberId', 'roleId'];
              properties: {
                applicationId: {
                  allOf: [
                    {
                      description: 'The application to assign the user a role on.';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                teamMemberId: {
                  allOf: [
                    {
                      description: 'The id of the user to assign the role to.';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                roleId: {
                  allOf: [
                    {
                      description: 'The id of the hiring team role to assign.';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the application.addHiringTeamMember endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1hiringTeam.addMember/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/applicationHiringTeamRole.list': {
    post: {
      summary: 'applicationHiringTeamRole.list';
      operationId: 'applicationHiringTeamRoleList';
      description: 'Gets all available hiring team roles for applications in the organization.\n\n**Requires the [`candidatesRead`](authentication#permissions-applicationHiringTeamRoleList) permission.**\n';
      tags: ['Application Hiring Team Role'];
      responses: {
        '200': {
          description: 'Responses from the applicationHiringTeamRole.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              allOf: [
                                {
                                  type: 'object';
                                  properties: {
                                    id: {
                                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                    };
                                    title: {
                                      type: 'string';
                                    };
                                  };
                                  required: ['id', 'title'];
                                },
                              ];
                            };
                          };
                        };
                      },
                    ];
                    required: ['results'];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/applicationFeedback.submit': {
    post: {
      summary: 'applicationFeedback.submit';
      description: 'Application feedback forms support a variety of field types. \n\n**Requires the [`candidatesWrite`](authentication#permissions-applicationfeedbacksubmit) permission.**\n\nThe values accepted for each field depend on the type of field that\'s being filled out:                                                                                                                                                                                                                 |\n- `Boolean` - A boolean value\n- `Date` - A date string in the format YYYY-MM-DD\n- `Email` - A valid email address\n- `Number` - An integer\n- `RichText` - We do not support submitting rich text documents via the API but we do support submitting plain text values for these fields. Plain text values must be submitted in the format `{ type: "PlainText", value: "A plain text string" }`\n- `Score` - An integer between 1 and 4 submitted in the format `{ score: 4 }`\n- `Phone`, `String` A string\n- `ValueSelect` - A string that matches the value of one of the ValueSelect field\'s selectable options\n- `MultiValueSelect` - An array of strings that exist in the MultiValueSelect field\'s selectable options\n\nThe `submittedValues` field in the response contains the submitted feedback in an object where the key is the path of the field and the value is the value submitted for that field.\n';
      operationId: 'applicationfeedbacksubmit';
      tags: ['Application Feedback'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  type: 'object';
                  required: ['feedbackForm', 'formDefinitionId', 'applicationId'];
                  properties: {
                    feedbackForm: {
                      $ref: '#/paths/~1offer.create/post/requestBody/content/application~1json/schema/properties/offerForm';
                    };
                    formDefinitionId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                        {
                          description: 'The id of the feedback form definition associated with the form submission';
                        },
                      ];
                    };
                    applicationId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                        {
                          description: "The id of the application you're submitting feedback for";
                        },
                      ];
                    };
                    userId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                        {
                          description: 'The id of the user the feedback will be credited to.\nIf a userId is not provided, the feedback will be credited to the API key user.\n';
                        },
                      ];
                    };
                  };
                },
                {
                  type: 'object';
                  required: ['feedbackForm', 'formDefinitionId', 'applicationId', 'userId', 'interviewEventId'];
                  properties: {
                    feedbackForm: {
                      $ref: '#/paths/~1offer.create/post/requestBody/content/application~1json/schema/properties/offerForm';
                    };
                    formDefinitionId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                        {
                          description: 'The id of the feedback form definition associated with the form submission';
                        },
                      ];
                    };
                    applicationId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                        {
                          description: "The id of the application you're submitting feedback for";
                        },
                      ];
                    };
                    userId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                        {
                          description: 'The id of the user the feedback will be credited to. \nThe user must be an interviewer on the interview event that feedback is being submitted for.\n';
                        },
                      ];
                    };
                    interviewEventId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                        {
                          description: "The id of the interview event you're submitting feedback for.\n";
                        },
                      ];
                    };
                  };
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the applicationFeedback.submit endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              submittedFormInstance: {
                                $ref: '#/paths/~1applicationForm.submit/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/submittedFormInstance';
                              };
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/applicationForm.submit': {
    post: {
      summary: 'applicationForm.submit';
      description: 'Submit an application for a job posting.\n\n**Requires the [`candidatesWrite`](authentication#permissions-applicationformsubmit) permission.**\n\nThe Content-Type of this request must be `multipart/form-data`.\n\n**Note: The requests generated from this documentation will not work for this endpoint.**\n\nThe values accepted for each field depend on the type of field that\'s being filled out:                                                                                                                                                                                                                 |\n- `Boolean` - A boolean value\n- `Date` - A date string in the format YYYY-MM-DD\n- `Email` - A valid email address\n- `Number` - An integer\n- `RichText` - We do not support submitting rich text documents via the API but we do support submitting plain text values for these fields. Plain text values must be submitted in the format `{ type: "PlainText", value: "A plain text string" }`\n- `Score` - An integer between 1 and 4 submitted in the format `{ score: 4 }`\n- `Phone`, `String` A string\n- `ValueSelect` - A string that matches the value of one of the ValueSelect field\'s selectable options\n- `MultiValueSelect` - An array of strings that exist in the MultiValueSelect field\'s selectable options\n- `Location` - An object with the following properties: `{ country: "USA", city: "San Francisco", region: "California" }`. You may provide any combination of these properties and we will attempt to geocode the location. For best results, provide all three properties.\n';
      operationId: 'applicationformsubmit';
      tags: ['Application Form'];
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object';
              required: ['jobPostingId', 'applicationForm'];
              properties: {
                jobPostingId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the job posting to submit an application for';
                    },
                  ];
                };
                applicationForm: {
                  $ref: '#/paths/~1offer.create/post/requestBody/content/application~1json/schema/properties/offerForm';
                };
                utmData: {
                  type: 'object';
                  properties: {
                    utm_source: {
                      type: 'string';
                    };
                    utm_campaign: {
                      type: 'string';
                    };
                    utm_medium: {
                      type: 'string';
                    };
                    utm_term: {
                      type: 'string';
                    };
                    utm_content: {
                      type: 'string';
                    };
                  };
                };
                '<file  key>': {
                  type: 'string';
                  description: 'Any file referenced  in the `applicationForm`.   The name of this field must exactly match the `value` on the `fieldSubmission` that references this file.';
                  format: 'binary';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the applicationFeedback.submit endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              submittedFormInstance: {
                                type: 'object';
                                properties: {
                                  id: {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  };
                                  formDefinition: {
                                    $ref: '#/paths/~1offer.start/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/formDefinition';
                                  };
                                  submittedValues: {
                                    type: 'object';
                                    example: {
                                      _systemfield_name: 'Joe Smith';
                                    };
                                  };
                                };
                                required: ['id', 'formDefinition', 'submittedValues'];
                              };
                              formMessages: {
                                type: 'object';
                                properties: {
                                  blockMessageForCandidateHtml: {
                                    type: 'string';
                                    description: 'A message to display to the candidate if they been blocked from applying due to application limits';
                                    example: '<div><p>In order to give as many candidates as possible an opportunity to apply we have limiting the number of applications a single candidate may submit. Unfortunately we cannot, accept your application at this time.</p></div>\n';
                                  };
                                };
                              };
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/approvalDefinition.update': {
    post: {
      summary: 'approvalDefinition.update';
      operationId: 'approvalDefinitionUpdate';
      description: 'Create or update an approval definition for a specific entity that requires approval. The entity requiring approval must be within scope of an approval in Ashby that is marked as being managed by the API.\n\nIf the provided approval step definitions is an empty list, then approval will be skipped and the entity will proceed to the next stage.\n\n**Requires the [`approvalsWrite`](authentication#permissions-approvaldefinitionupdate) permission.**\n';
      tags: ['Approval Definition'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                entityType: {
                  type: 'string';
                  enum: ['offer'];
                };
                entityId: {
                  allOf: [
                    {
                      description: 'The id of the approval entity being updated (e.g. the id of the offer version).';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                approvalStepDefinitions: {
                  type: 'array';
                  description: 'An ordered list of approval steps that describes the number of required approvers at each step, as well as who is an approver at each step.';
                  items: {
                    type: 'object';
                    properties: {
                      approvalsRequired: {
                        type: 'integer';
                        description: 'The number of approvers required to approve this step, before the approval moves on to the next step. The number of approvers must be non-zero and no more than the number of approvers in this step.';
                      };
                      approvers: {
                        type: 'array';
                        description: 'An unordered list of who can approve this step.';
                        items: {
                          type: 'object';
                          properties: {
                            userId: {
                              allOf: [
                                {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                },
                                {
                                  description: 'The id of a user who is an approver for this step.';
                                },
                              ];
                            };
                            type: {
                              type: 'string';
                              enum: ['user'];
                            };
                          };
                          required: ['userId', 'type'];
                        };
                      };
                    };
                    required: ['approvalsRequired', 'approvers'];
                  };
                };
                submitApprovalRequest: {
                  type: 'boolean';
                  description: 'Control whether an approval request created through this API should be immediately submitted.\nIf false, then the approval will need to be manually submitted in the Ashby app.\nDefault: false\n';
                };
              };
              required: ['entityType', 'entityId', 'approvalStepDefinitions'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the approvalDefinition.update endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              id: {
                                allOf: [
                                  {
                                    description: 'The id of the approval definition.';
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                              entityType: {
                                type: 'string';
                                enum: ['Offer'];
                              };
                              entityId: {
                                allOf: [
                                  {
                                    description: 'The id of the approval entity (e.g. the id of the offer version).';
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                              approvalStepDefinitions: {
                                $ref: '#/paths/~1approvalDefinition.update/post/requestBody/content/application~1json/schema/properties/approvalStepDefinitions';
                              };
                            };
                            required: ['entityType', 'entityId', 'approvalStepDefinitions'];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/archiveReason.list': {
    post: {
      summary: 'archiveReason.list';
      description: 'Lists archive reasons\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-archivereasonlist) permission.**\n';
      operationId: 'archivereasonlist';
      tags: ['Archive Reason'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                includeArchived: {
                  type: 'boolean';
                  description: 'When true, includes archived interview plans';
                  default: false;
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the archiveReason.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success Response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              type: 'object';
                              properties: {
                                id: {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                };
                                text: {
                                  type: 'string';
                                  example: 'Too inexperienced';
                                };
                                reasonType: {
                                  enum: ['RejectedByCandidate', 'RejectedByOrg', 'Other'];
                                  example: 'RejectedByOrg';
                                };
                                isArchived: {
                                  $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived';
                                };
                              };
                              required: ['id', 'text', 'reasonType', 'isArchived'];
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/assessment.addCompletedToCandidate': {
    post: {
      summary: 'assessment.addCompletedToCandidate';
      operationId: 'assessmentAddCompletedToCandidate';
      description: 'Add a completed assessment to a candidate\n\n**Requires the [`candidatesWrite`](authentication#permissions-assessmentaddcompletedtocandidate) permission.**\n';
      tags: ['Assessment'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                candidateId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the candidate, to whom to add the completed assessment';
                    },
                  ];
                };
                partnerId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the partner adding the assessment';
                    },
                  ];
                };
                assessment: {
                  type: 'object';
                  description: 'The completed assessment';
                  required: ['assessmentTypeId', 'assessmentId', 'assessmentName', 'result', 'metadata'];
                  properties: {
                    assessmentTypeId: {
                      allOf: [
                        {
                          description: 'An identifier that uniquely identifies the assessment type';
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                      ];
                    };
                    assessmentId: {
                      allOf: [
                        {
                          description: 'An identifier that uniquely identifies the completed assessment';
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                      ];
                    };
                    assessmentName: {
                      type: 'string';
                      example: 'Node Assessment';
                      description: 'The name of the assessment that was taken that will be displayed in the UI';
                    };
                    result: {
                      allOf: [
                        {
                          description: "The assessment's result";
                        },
                        {
                          $ref: '#/paths/~1assessment.addCompletedToCandidate/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/result';
                        },
                      ];
                    };
                    metadata: {
                      type: 'array';
                      description: 'An array of metadata associated with this completed assessment';
                      items: {
                        $ref: '#/paths/~1assessment.addCompletedToCandidate/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/result';
                      };
                    };
                  };
                };
                timestamp: {
                  allOf: [
                    {
                      description: 'The timestamp in milliseconds since the unix epoch, when the assessment was completed';
                    },
                    {
                      type: 'integer';
                      description: 'The timestamp in milliseconds since the unix epoch, when the update occurred';
                      format: 'int64';
                      example: 1665680638489;
                    },
                  ];
                };
              };
              required: ['candidateId', 'partnerId', 'assessment', 'timestamp'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the assessment.addCompletedToCandidate endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success Response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            required: ['assessmentTypeId', 'assessmentId', 'assessmentName', 'candidateId', 'metadata'];
                            properties: {
                              applicationId: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                              assessmentId: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                              assessmentName: {
                                type: 'string';
                                example: 'test-assessment-name';
                              };
                              assessmentTypeId: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                              candidateId: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                              metadata: {
                                type: 'array';
                                items: {
                                  $ref: '#/paths/~1assessment.addCompletedToCandidate/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/result';
                                };
                              };
                              result: {
                                type: 'object';
                                properties: {
                                  identifier: {
                                    type: 'string';
                                    description: 'Uniquely identifies this field, for this partner';
                                    example: 'result-max';
                                  };
                                  label: {
                                    type: 'string';
                                    description: 'Label for the assessment metadata to be displayed in the UI';
                                    example: 'Max Score';
                                  };
                                  description: {
                                    type: 'string';
                                    description: 'Description of the assessment metadata, which may be displayed in the UI';
                                    example: 'The maximum possible score for the assessment';
                                  };
                                  type: {
                                    type: 'string';
                                    description: "The type of the value. Please reach out if you'd like us to support a new type!";
                                    enum: [
                                      'numeric_score',
                                      'numeric_duration_minutes',
                                      'url',
                                      'string',
                                      'boolean_success',
                                    ];
                                  };
                                  value: {
                                    allOf: [
                                      {
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
                                        ];
                                        description: 'The raw value — one of string, number, or boolean\n';
                                      },
                                      {
                                        example: 10;
                                      },
                                    ];
                                  };
                                };
                                required: ['identifier', 'label', 'type', 'value'];
                              };
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/assessment.start': {
    post: {
      summary: 'assessment.start (Implemented by Partner)';
      operationId: 'assessmentStart';
      description: 'The API for starting an assessment. Implemented by the partner, called by Ashby.\n';
      tags: ['Assessment'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['assessment_type_id', 'candidate', 'application', 'job'];
              properties: {
                assessment_type_id: {
                  allOf: [
                    {
                      description: 'The id of the type of assessment to start (retrieved from calling /assessment.list)';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                candidate: {
                  allOf: [
                    {
                      description: 'Identifier of the assessment being started';
                    },
                    {
                      type: 'object';
                      description: 'A description of the candidate';
                      required: ['ashby_id', 'first_name', 'last_name', 'email', 'ashby_profile_url'];
                      properties: {
                        ashby_id: {
                          allOf: [
                            {
                              type: 'string';
                            },
                            {
                              description: 'The identifier of the candidate in Ashby';
                            },
                          ];
                        };
                        first_name: {
                          allOf: [
                            {
                              type: 'string';
                            },
                            {
                              description: 'The first name of the candidate being assessed';
                            },
                          ];
                        };
                        last_name: {
                          allOf: [
                            {
                              type: 'string';
                            },
                            {
                              description: 'The last name of the candidate being assessed';
                            },
                          ];
                        };
                        email: {
                          allOf: [
                            {
                              type: 'string';
                            },
                            {
                              description: 'The email of the candidate being assessed';
                            },
                          ];
                        };
                        ashby_profile_url: {
                          allOf: [
                            {
                              type: 'string';
                            },
                            {
                              description: 'The url back into Ashby of the candidate being assessed';
                            },
                          ];
                        };
                      };
                    },
                  ];
                };
                application: {
                  allOf: [
                    {
                      description: 'The application for which the candidate is being assessed';
                    },
                    {
                      type: 'object';
                      description: 'The application for which the candidate is being assessed';
                      required: ['ashby_id', 'status'];
                      properties: {
                        ashby_id: {
                          allOf: [
                            {
                              type: 'string';
                            },
                            {
                              description: 'The id of the application in Ashby';
                            },
                          ];
                        };
                        status: {
                          allOf: [
                            {
                              $ref: '#/paths/~1application.list/post/requestBody/content/application~1json/schema/allOf/1/properties/status';
                            },
                            {
                              description: 'The status of the application in Ashby';
                            },
                          ];
                        };
                      };
                    },
                  ];
                };
                job: {
                  allOf: [
                    {
                      description: 'The job for which the candidate is being assessed';
                    },
                    {
                      type: 'object';
                      description: 'The job for which the candidate is being assessed';
                      required: ['ashby_id', 'name', 'ashby_job_url'];
                      properties: {
                        ashby_id: {
                          allOf: [
                            {
                              type: 'string';
                            },
                            {
                              description: 'The id of the job in Ashby';
                            },
                          ];
                        };
                        name: {
                          allOf: [
                            {
                              type: 'string';
                            },
                            {
                              description: 'The name of the job in Ashby';
                            },
                          ];
                        };
                        req_id: {
                          allOf: [
                            {
                              type: 'string';
                            },
                            {
                              description: 'The customer-defined requisition id for the job';
                            },
                          ];
                        };
                        ashby_job_url: {
                          allOf: [
                            {
                              type: 'string';
                            },
                            {
                              description: 'The url of the job, internal to Ashby';
                            },
                          ];
                        };
                        hiringTeam: {
                          type: 'array';
                          items: {
                            $ref: '#/paths/~1hiringTeam.addMember/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the assessment.start endpoint';
          content: {
            'application/json': {
              schema: {
                title: 'Success Response';
                type: 'object';
                required: ['success', 'results'];
                properties: {
                  success: {
                    type: 'boolean';
                  };
                  results: {
                    required: ['assessment_id'];
                    properties: {
                      assessment_id: {
                        type: 'string';
                      };
                      update_request: {
                        $ref: '#/paths/~1assessment.update/post/requestBody/content/application~1json/schema';
                      };
                    };
                  };
                };
              };
            };
          };
        };
        '409': {
          description: 'The assessment could not be started because the candidate is already being assessed.\n';
        };
        '422': {
          description: 'A custom error message that will be shown to the user in Ashby.\n';
          content: {
            'application/json': {
              schema: {
                title: 'Custom Error Response';
                type: 'object';
                required: ['message'];
                properties: {
                  message: {
                    type: 'string';
                    description: 'The message to be shown to the user in Ashby.';
                  };
                };
              };
            };
          };
        };
      };
    };
  };
  '/assessment.list': {
    post: {
      summary: 'assessment.list (Implemented by Partner)';
      operationId: 'assessmentList';
      description: 'The API for listing assessments that the partner supports — implemented by the partner, but called by Ashby\n';
      tags: ['Assessment'];
      responses: {
        '200': {
          description: 'Responses for the assessment.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              allOf: [
                                {
                                  type: 'object';
                                  description: 'List of available assessments';
                                  properties: {
                                    assessment_type_id: {
                                      allOf: [
                                        {
                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                        },
                                      ];
                                    };
                                    name: {
                                      type: 'string';
                                    };
                                    description: {
                                      type: 'string';
                                    };
                                  };
                                },
                              ];
                            };
                          };
                        };
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/assessment.update': {
    post: {
      summary: 'assessment.update';
      operationId: 'assessmentUpdate';
      description: 'Update Ashby about the status of a started assessment.\n\n**Requires the [`candidatesWrite`](authentication#permissions-assessmentupdate) permission.**\n';
      tags: ['Assessment'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['assessment_id', 'timestamp'];
              properties: {
                assessment_id: {
                  allOf: [
                    {
                      description: 'Identifier of the assessment being updated';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                timestamp: {
                  $ref: '#/paths/~1assessment.addCompletedToCandidate/post/requestBody/content/application~1json/schema/properties/timestamp/allOf/1';
                };
                assessment_status: {
                  allOf: [
                    {
                      description: 'The current status of the assessment. Setting this with a value of "Started" will signal Ashby to store the timestamp the assessment started.';
                    },
                    {
                      $ref: '#/paths/~1assessment.addCompletedToCandidate/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/result';
                    },
                  ];
                };
                assessment_profile_url: {
                  allOf: [
                    {
                      description: "The url back to the assessment/candidate on the partner's website. This value should always be of type url. (required when assessment_result is set)";
                    },
                    {
                      $ref: '#/paths/~1assessment.addCompletedToCandidate/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/result';
                    },
                  ];
                };
                assessment_result: {
                  allOf: [
                    {
                      description: 'The result of the assessment. Sending an update with this field will signal to Ashby that the assessment is complete.';
                    },
                    {
                      $ref: '#/paths/~1assessment.addCompletedToCandidate/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/result';
                    },
                  ];
                };
                cancelled_reason: {
                  allOf: [
                    {
                      description: 'The reason the assessment was cancelled. This field will signal to Ashby that the assessment is cancelled.';
                    },
                    {
                      $ref: '#/paths/~1assessment.addCompletedToCandidate/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/result';
                    },
                  ];
                };
                metadata: {
                  type: 'array';
                  description: 'Any other metadata about the assessment (e.g. ETA until complete). All assessment data should have unique identifiers.';
                  items: {
                    $ref: '#/paths/~1assessment.addCompletedToCandidate/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/result';
                  };
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the assessment.start endpoint';
        };
      };
    };
  };
  '/assessment.cancel': {
    post: {
      summary: 'assessment.cancel (Implemented by Partner)';
      operationId: 'assessmentCancel';
      description: '(Optional) Cancels an assessment. Implemented by the partner, called by Ashby.\n';
      tags: ['Assessment'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['assessment_id'];
              properties: {
                assessment_id: {
                  allOf: [
                    {
                      description: 'The id of the started assessment to cancel';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the assessment.cancel endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success Response';
                    type: 'object';
                    $ref: '#/paths/~1assessment.start/post/responses/200/content/application~1json/schema';
                  },
                  {
                    title: 'Error Response';
                    type: 'object';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/candidate.addProject': {
    post: {
      summary: 'candidate.addProject';
      operationId: 'candidateaddproject';
      description: 'Adds the candidate to a project.\n\n**Requires the [`candidatesWrite`](authentication#permissions-candidateaddproject) permission.**\n';
      tags: ['Candidate', 'Project'];
      requestBody: {
        required: true;
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                candidateId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the candidate';
                    },
                  ];
                };
                projectId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the project';
                    },
                  ];
                };
              };
              required: ['candidateId', 'projectId'];
              example: {
                candidateId: 'f9e52a51-a075-4116-a7b8-484deba69004';
                projectId: 'bcffca12-5b09-4a76-acf2-00a8e267b222';
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the candidate.addProject endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/candidate.addTag': {
    post: {
      summary: 'candidate.addTag';
      description: 'Adds a tag to a candidate\n\n**Requires the [`candidatesWrite`](authentication#permissions-candidateaddtag) permission.**\n';
      operationId: 'candidateAddTag';
      tags: ['Candidate'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['candidateId', 'tagId'];
              properties: {
                candidateId: {
                  type: 'string';
                  description: 'The unique id of the candidate to add the tag to.';
                  example: '5b591aed-88e3-4395-b9c6-7d529f93354a';
                };
                tagId: {
                  type: 'string';
                  description: 'The unique id of the tag to add to the candidate.';
                  example: '38430ede-5bd2-41fc-b474-87591cb98cbc';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the candidate.addTag endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/canidate.anonymize': {
    post: {
      summary: 'candidate.anonymize';
      description: "Anonymizes a candidate.\n\n**Requires the [`candidatesWrite`](authentication#permissions-candidateanonymize) permission.**\n\n**Note**: this action cannot be reversed and requires all of a candidate's applications to be in the archived or hired state.\n";
      operationId: 'candidateAnonymize';
      tags: ['Candidate'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['candidateId'];
              properties: {
                candidateId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the candidate to anonymize.';
                    },
                  ];
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the candidate.anonymize endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        description: 'The anonymized candidate';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/candidate.create': {
    post: {
      summary: 'candidate.create';
      operationId: 'candidateCreate';
      description: 'Creates a new candidate\n\n**Requires the [`candidatesWrite`](authentication#permissions-candidatecreate) permission.**\n';
      tags: ['Candidate'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                name: {
                  type: 'string';
                  example: 'Adam Hart';
                  description: 'The first and last name of the candidate to be created.';
                };
                email: {
                  allOf: [
                    {
                      type: 'string';
                      example: 'test@ashbyhq.com';
                    },
                    {
                      description: 'Primary, personal email of the candidate to be created.';
                    },
                  ];
                };
                phoneNumber: {
                  allOf: [
                    {
                      type: 'string';
                      example: '555-555-5555';
                    },
                    {
                      description: 'Primary, personal phone number of the candidate to be created.';
                    },
                  ];
                };
                linkedInUrl: {
                  type: 'string';
                  example: 'https://linkedin.com/in/user';
                  description: "Url to the candidate's LinkedIn profile. Must be a valid Url.";
                };
                githubUrl: {
                  type: 'string';
                  example: 'https://github.com/user';
                  description: "Url to the candidate's Github profile. Must be a valid Url.";
                };
                website: {
                  type: 'string';
                  example: 'https://twitter.com/user';
                  description: "Url of the candidate's website. Must be a valid Url.";
                };
                alternateEmailAddresses: {
                  type: 'array';
                  items: {
                    type: 'string';
                  };
                  example: ['test.email@ashbyhq.com'];
                  description: "Array of alternate email address to add to the candidate's profile.";
                };
                sourceId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The source to set on the candidate being created.';
                    },
                  ];
                };
                creditedToUserId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the user the candidate will be credited to.';
                    },
                  ];
                };
                location: {
                  type: 'object';
                  description: 'The location of the candidate.';
                  properties: {
                    city: {
                      type: 'string';
                      example: 'San Francisco';
                      description: "The city of the candidate's location.";
                    };
                    region: {
                      type: 'string';
                      example: 'California';
                      description: "The region (state, province, etc.) of the candidate's location.";
                    };
                    country: {
                      type: 'string';
                      example: 'United States';
                      description: "The country of the candidate's location.";
                    };
                  };
                };
                createdAt: {
                  allOf: [
                    {
                      description: "An ISO date string to set the candidate's `createdAt` timestamp. When this value isn't provided, the `createdAt` timestamp defaults to the time the the call was made.\n";
                    },
                    {
                      $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                    },
                  ];
                };
              };
              required: ['name'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the candidate.create endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/candidate.createNote': {
    post: {
      summary: 'candidate.createNote';
      description: "Creates a note on a candidate.\n\n**Requires the [`candidatesWrite`](authentication#permissions-candidatecreatenote) permission.**\n\nFor notes submitted with a type of `text/html`, we support the elements listed below. Any unsupported elements will be stripped out of the note's content before posting.\n  - Bold `<b>`\n  - Italic `<i>`\n  - Underline `<u>`\n  - Links `<a>`\n  - Bulleted Lists - `<ul>`, `<li>`\n  - Ordered Lists - `<ol>`, `<li>`\n  - Code - `<code>`\n  - Code Block - `<pre>`\n";
      operationId: 'candidateCreateNote';
      tags: ['Candidate'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                candidateId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                };
                note: {
                  oneOf: [
                    {
                      type: 'string';
                      description: 'The note to add to the candidate';
                      example: 'Strong candidate, very interested in the company';
                    },
                    {
                      type: 'object';
                      description: 'Note content';
                      properties: {
                        type: {
                          type: 'string';
                          enum: ['text/plain', 'text/html'];
                          description: "The content type of the note. For notes submitted with a type of text/html we support the elements listed below. Any unsupported elements will be stripped out of the note's content before posting.\n- Bold `<b>`\n- Italic `<i>`\n- Underline `<u>`\n- Links `<a>`\n- Bulleted Lists - `<ul>`, `<li>`\n- Ordered Lists - `<ol>`, `<li>`\n- Code - `<code>`\n- Code Block - `<pre>`\n";
                        };
                        value: {
                          type: 'string';
                        };
                      };
                      required: ['type', 'value'];
                    },
                  ];
                };
                sendNotifications: {
                  type: 'boolean';
                  description: 'Whether or not users who are subscribed to the candidate should be notified that the note was posted. Default is false.';
                  default: false;
                };
                createdAt: {
                  type: 'string';
                  example: '2022-08-12T20:29:56.964Z';
                  format: 'date';
                };
              };
              required: ['candidateId', 'note'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the candidate.createNote endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                              };
                              createdAt: {
                                $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                              };
                              content: {
                                type: 'string';
                                example: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
                              };
                              author: {
                                type: 'object';
                                properties: {
                                  id: {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  };
                                  firstName: {
                                    type: 'string';
                                    example: 'Joey';
                                  };
                                  lastName: {
                                    type: 'string';
                                    example: 'Joe';
                                  };
                                  email: {
                                    $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/email/allOf/0';
                                  };
                                };
                                required: ['id', 'firstName', 'lastName'];
                              };
                            };
                            required: ['id', 'createdAt', 'author'];
                          };
                        };
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/candidate.info': {
    post: {
      summary: 'candidate.info';
      operationId: 'candidateInfo';
      description: 'Gets a single candidate by id.\n\n**Requires the [`candidatesRead`](authentication#permissions-candidateinfo) permission.**\n';
      tags: ['Candidate'];
      requestBody: {
        required: true;
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  type: 'object';
                  properties: {
                    id: {
                      type: 'string';
                      format: 'uuid';
                      description: 'The id of the candidate to fetch';
                    };
                  };
                  required: ['id'];
                  example: {
                    id: 'f9e52a51-a075-4116-a7b8-484deba69004';
                  };
                },
                {
                  type: 'object';
                  properties: {
                    externalMappingId: {
                      type: 'string';
                      description: 'An id assigned to a candidate outside of Ashby. \nUsed to associate Ashby candidates with their profiles in external systems (BambooHR, Rippling, Gusto, etc.)\n';
                    };
                  };
                  required: ['externalMappingId'];
                  example: {
                    externalMappingId: 'f9e52a51-a075-4116-a7b8-484deba69004';
                  };
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the candidate.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                description: 'The unique id of the candidate';
                              };
                              createdAt: {
                                $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                              };
                              updatedAt: {
                                $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                              };
                              name: {
                                type: 'string';
                                example: 'Adam Hart';
                                description: "The candidate's name";
                              };
                              primaryEmailAddress: {
                                $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application/properties/candidate/properties/primaryEmailAddress';
                              };
                              emailAddresses: {
                                type: 'array';
                                items: {
                                  $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application/properties/candidate/properties/primaryEmailAddress';
                                };
                              };
                              primaryPhoneNumber: {
                                $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application/properties/candidate/properties/primaryEmailAddress';
                              };
                              phoneNumbers: {
                                type: 'array';
                                items: {
                                  $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application/properties/candidate/properties/primaryEmailAddress';
                                };
                              };
                              socialLinks: {
                                type: 'array';
                                items: {
                                  $ref: '#/paths/~1candidate.update/post/requestBody/content/application~1json/schema/properties/socialLinks/items';
                                };
                              };
                              tags: {
                                type: 'array';
                                items: {
                                  $ref: '#/paths/~1candidateTag.create/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                                };
                              };
                              position: {
                                type: 'string';
                                example: 'Software Engineer';
                              };
                              company: {
                                type: 'string';
                                example: 'Auction.com';
                              };
                              school: {
                                type: 'string';
                                example: 'Princeton University';
                              };
                              applicationIds: {
                                type: 'array';
                                description: 'The unique ids of all applications associated with the candidate';
                                items: {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                };
                              };
                              resumeFileHandle: {
                                description: "The id, name and handle for the candidate's resume";
                                $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/fileHandles/items';
                              };
                              fileHandles: {
                                description: 'The id, name and handle for each file associated with the candidate';
                                type: 'array';
                                items: {
                                  type: 'object';
                                  properties: {
                                    id: {
                                      type: 'string';
                                    };
                                    name: {
                                      type: 'string';
                                    };
                                    handle: {
                                      type: 'string';
                                      description: "You can use the file handle to retrieve the file's URL by using the file.info endpoint.";
                                    };
                                  };
                                  required: ['id', 'name', 'handle'];
                                  example: {
                                    id: '15d2624d-0a81-4f94-a2ed-94980f430b3f';
                                    name: 'resume.pdf';
                                    handle: 'eyJoYW5kbGUiOnsidHlwZSI6IkNhbmRpZGF0ZUZpbGUiLCJm';
                                  };
                                };
                              };
                              customFields: {
                                type: 'array';
                                description: 'All custom field values associated with the candidate';
                                items: {
                                  $ref: '#/paths/~1customField.setValue/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                                };
                              };
                              profileUrl: {
                                type: 'string';
                                description: "The url of the candidate's profile in Ashby";
                              };
                              source: {
                                description: 'The source that created this candidate';
                                $ref: '#/paths/~1source.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items';
                              };
                              creditedToUser: {
                                description: 'The user who receives credit for this user';
                                $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results';
                              };
                              timezone: {
                                description: 'The timezone of the candidate';
                                type: 'string';
                              };
                              primaryLocation: {
                                description: 'The primary location of the candidate';
                                type: 'object';
                                properties: {
                                  id: {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                    description: "The location's unique id.";
                                  };
                                  locationSummary: {
                                    type: 'string';
                                    description: 'A human-readable summary of the location.';
                                    example: 'United States, California, San Francisco';
                                  };
                                  locationComponents: {
                                    type: 'array';
                                    description: 'The individual components of the location.';
                                    items: {
                                      type: 'object';
                                      required: ['type', 'name'];
                                      properties: {
                                        type: {
                                          type: 'enum';
                                          enum: ['Country', 'Region', 'City'];
                                          description: 'The type of the location component.';
                                        };
                                        name: {
                                          type: 'string';
                                          description: 'The name of the location component.';
                                        };
                                      };
                                    };
                                    example: [
                                      {
                                        type: 'Country';
                                        name: 'United States';
                                      },
                                      {
                                        type: 'Region';
                                        name: 'California';
                                      },
                                      {
                                        type: 'City';
                                        name: 'San Francisco';
                                      },
                                    ];
                                  };
                                };
                                required: ['id', 'locationSummary', 'locationComponents'];
                              };
                            };
                            required: [
                              'id',
                              'name',
                              'emailAddresses',
                              'phoneNumbers',
                              'socialLinks',
                              'tags',
                              'applicationIds',
                              'fileHandles',
                              'profileUrl',
                            ];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/candidate.list': {
    post: {
      summary: 'candidate.list';
      operationId: 'candidateList';
      description: 'Lists all candidates in an organization\n\n**Requires the [`candidatesRead`](authentication#permissions-candidatelist) permission.**\n';
      tags: ['Candidate'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the candidate.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                            };
                          };
                        };
                      },
                    ];
                    required: ['results'];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/candidate.listNotes': {
    post: {
      summary: 'candidate.listNotes';
      operationId: 'candidateListNotes';
      description: 'Lists all notes on a candidate\n\n**Requires the [`candidatesRead`](authentication#permissions-candidatelistnotes) permission.**\n';
      tags: ['Candidate'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  type: 'object';
                  properties: {
                    candidateId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                        {
                          description: 'The id of the candidate to fetch notes for';
                        },
                      ];
                    };
                  };
                },
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema';
                },
              ];
              required: ['candidateId'];
              example: {
                candidateId: 'f9e52a51-a075-4116-a7b8-484deba69004';
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the candidate.listNotes endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/paths/~1candidate.createNote/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                            };
                          };
                        };
                      },
                    ];
                    required: ['results'];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/candidate.search': {
    post: {
      summary: 'candidate.search';
      operationId: 'candidateSearch';
      description: 'Search for candidates by email and / or name. \n\n**Requires the [`candidatesRead`](authentication#permissions-candidatesearch) permission.**\n\nResponses are limited to 100 results. Consider refining your search or using /candidate.list to paginate through all candidates, if you approach this limit. This API is for use cases where you intend operate on a final small set of candidates, like building a candidate autocomplete.\n\nNote: When multiple search parameters are provided, the parameters are combined with the `AND` operator.\n';
      tags: ['Candidate'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                email: {
                  type: 'string';
                  description: "The candidate's email";
                };
                name: {
                  type: 'string';
                  description: "The candidate's name";
                };
              };
              example: {
                email: 'test@ashbyhq.com';
                name: 'Adam Hart';
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the candidate.search endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/candidate.update': {
    post: {
      summary: 'candidate.update';
      operationId: 'candidateUpdate';
      description: 'Updates an existing candidate\n\n**Requires the [`candidatesWrite`](authentication#permissions-candidateupdate) permission.**\n';
      tags: ['Candidate'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                candidateId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The unique id of the candidate to update.';
                    },
                  ];
                };
                name: {
                  type: 'string';
                  example: 'Adam Hart';
                  description: 'The first and last name of the candidate to update.';
                };
                email: {
                  allOf: [
                    {
                      $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/email/allOf/0';
                    },
                    {
                      description: 'Primary, personal email of the candidate to update.';
                    },
                  ];
                };
                phoneNumber: {
                  allOf: [
                    {
                      $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/phoneNumber/allOf/0';
                    },
                    {
                      description: 'Primary, personal phone number of the candidate to update.';
                    },
                  ];
                };
                linkedInUrl: {
                  $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/linkedInUrl';
                };
                githubUrl: {
                  $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/githubUrl';
                };
                websiteUrl: {
                  $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/website';
                };
                alternateEmail: {
                  type: 'string';
                  example: 'test.email@ashbyhq.com';
                  description: "An alternate email address to add to the candidate's profile.";
                };
                socialLinks: {
                  description: 'An array of social links to set on the candidate. This value replaces existing socialLinks that have been set on the candidate. \nIf this value is submitted along with linkedInUrl, gitHubUrl or websiteUrl fields, those values will be ignored.\n';
                  type: 'array';
                  items: {
                    type: 'object';
                    properties: {
                      type: {
                        enum: ['LinkedIn', 'GitHub', 'Twitter', 'Medium', 'StackOverflow', 'Website'];
                      };
                      url: {
                        type: 'string';
                      };
                    };
                    required: ['type', 'url'];
                    example: {
                      url: 'https://linkedin.com/in/user';
                      type: 'LinkedIn';
                    };
                  };
                };
                sourceId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of source for this candidate.';
                    },
                  ];
                };
                creditedToUserId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the user the candidate will be credited to.';
                    },
                  ];
                };
                location: {
                  type: 'object';
                  description: 'The location of the candidate.';
                  properties: {
                    $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/location/properties';
                  };
                };
                createdAt: {
                  allOf: [
                    {
                      description: "An ISO date string to set the candidate's `createdAt` timestamp.\n";
                    },
                    {
                      $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                    },
                  ];
                };
                sendNotifications: {
                  type: 'boolean';
                  default: true;
                  description: 'Whether or not users who are subscribed to the candidate should be notified that candidate was updated. Default is true.';
                };
              };
              required: ['candidateId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the candidate.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/candidate.uploadFile': {
    post: {
      summary: 'candidate.uploadFile';
      operationId: 'candidateUploadFile';
      description: "Uploads a file to attach to the candidate's profile. \n\n**Requires the [`candidatesWrite`](authentication#permissions-candidateuploadfile) permission.**\n\nThe `Content-Type` of this request must be `multipart/form-data`.\n";
      tags: ['Candidate'];
      requestBody: {
        required: true;
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object';
              properties: {
                candidateId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the candidate';
                    },
                  ];
                };
                file: {
                  type: 'string';
                  format: 'binary';
                  description: "The file to upload to the candidate's profile";
                };
              };
              required: ['candidateId', 'file'];
              example: {
                id: 'f9e52a51-a075-4116-a7b8-484deba69004';
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the candidate.uploadFile endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/candidate.uploadResume': {
    post: {
      summary: 'candidate.uploadResume';
      operationId: 'candidateUploadResume';
      description: "Uploads a candidate's resume, parses it, and updates their information.\n\n**Requires the [`candidatesWrite`](authentication#permissions-candidateuploadresume) permission.**\n\nThe `Content-Type` of this request must be `multipart/form-data`.\n\nNote: Existing candidate data always takes precedence over data found by parsing the resume. Resume data only populates candidate data, if it's data that was missing in the candidate model.    \n";
      tags: ['Candidate'];
      requestBody: {
        required: true;
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object';
              properties: {
                candidateId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the candidate';
                    },
                  ];
                };
                resume: {
                  type: 'string';
                  format: 'binary';
                  description: "The resume to upload to the candidate's profile";
                };
              };
              required: ['candidateId', 'resume'];
              example: {
                id: 'f9e52a51-a075-4116-a7b8-484deba69004';
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the candidate.uploadResume endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/candidateTag.create': {
    post: {
      summary: 'candidateTag.create';
      description: 'Creates a candidate tag.\n\n**Requires the [`hiringProcessMetadataWrite`](authentication#permissions-candidatetagcreate) permission.**\n';
      operationId: 'candidatetagcreate';
      tags: ['Candidate Tag'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['title'];
              properties: {
                title: {
                  type: 'string';
                  description: "The tag's title. If a tag already exists with that title, the existing tag will be returned.";
                  example: 'Strong candidate';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the location.create endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            description: 'A tag applied to a candidate';
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                description: "The tag's unique id";
                              };
                              title: {
                                type: 'string';
                                example: 'Senior Candidate';
                              };
                              isArchived: {
                                $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived';
                              };
                            };
                            required: ['id', 'title', 'isArchived'];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/candidateTag.list': {
    post: {
      summary: 'candidateTag.list';
      operationId: 'candidateTagList';
      description: 'Lists all candidate tags\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-candidatetaglist) permission.**\n';
      tags: ['Candidate Tag'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  type: 'object';
                  properties: {
                    includeArchived: {
                      type: 'boolean';
                      default: false;
                      description: 'Whether archived candidate tags should be included in the response';
                    };
                  };
                },
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema';
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the candidateTag.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success Response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/paths/~1candidateTag.create/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/customField.create': {
    post: {
      summary: 'customField.create';
      operationId: 'customFieldCreate';
      description: 'Create a new custom field\n\n**Requires the [`hiringProcessMetadataWrite`](authentication#permissions-customfieldcreate) permission.**\n';
      tags: ['Custom Field'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['fieldType', 'objectType', 'title'];
              properties: {
                fieldType: {
                  type: 'string';
                  description: 'The type of field being created. This value is case-sensitive.';
                  enum: [
                    'Boolean',
                    'CompensationRange',
                    'Date',
                    'LongText',
                    'MultiValueSelect',
                    'Number',
                    'NumberRange',
                    'String',
                    'ValueSelect',
                  ];
                };
                objectType: {
                  type: 'string';
                  description: 'The type of object the field can be associated with.';
                  enum: [
                    'Application',
                    'Candidate',
                    'Job',
                    'Employee',
                    'Talent_Project',
                    'Opening_Version',
                    'Offer_Version',
                  ];
                };
                title: {
                  type: 'string';
                  description: 'The name of the field';
                };
                description: {
                  type: 'string';
                  description: 'A description for the field';
                };
                selectableValues: {
                  type: 'array';
                  description: 'Required when the field type is ValueSelect or MultiValueSelect. An array of selectable values for the field.';
                  items: {
                    properties: {
                      label: {
                        type: 'string';
                      };
                      value: {
                        type: 'string';
                      };
                    };
                    required: ['label', 'value'];
                    type: 'object';
                  };
                };
                isDateOnlyField: {
                  type: 'boolean';
                  description: 'Only applies to fields with an objectType of Date. Whether or not the field includes content other than a date';
                };
                isExposableToCandidate: {
                  type: 'boolean';
                  description: 'Determines whether the field can be exposed to a candidate in certain contexts. In order for a custom field to be available in an email template this value must be true.';
                  default: false;
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the customField.create endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1customField.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/customField.info': {
    post: {
      summary: 'customField.info';
      operationId: 'customFieldInfo';
      description: 'Get information about a custom field\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-customfieldinfo) permission.**\n';
      tags: ['Custom Field'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  type: 'object';
                  properties: {
                    customFieldId: {
                      type: 'string';
                      format: 'uuid';
                      description: 'The id of the custom field to fetch';
                    };
                  };
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the customField.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success Response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                              };
                              title: {
                                type: 'string';
                                example: 'Preferred Teams';
                              };
                              objectType: {
                                type: 'string';
                                description: 'The type of object in Ashby the custom field is associated with';
                                enum: [
                                  'Application',
                                  'Candidate',
                                  'Employee',
                                  'Job',
                                  'Offer',
                                  'Opening',
                                  'Talent_Project',
                                ];
                              };
                              isArchived: {
                                $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived';
                              };
                              fieldType: {
                                type: 'string';
                                description: 'The type of data stored in the custom field';
                                enum: [
                                  'MultiValueSelect',
                                  'NumberRange',
                                  'String',
                                  'Date',
                                  'ValueSelect',
                                  'Number',
                                  'Currency',
                                  'Boolean',
                                  'LongText',
                                  'CompensationRange',
                                  'NumberRange',
                                ];
                              };
                              selectableValues: {
                                description: 'An array of values that can be selected for custom fields with a fieldType of MultiValueSelect.\nIf the fieldType is not MultiValueSelect, `selectableValues` will not be present in the response\n';
                                type: 'array';
                                items: {
                                  type: 'object';
                                  properties: {
                                    label: {
                                      type: 'string';
                                      example: 'Backend Engineering';
                                    };
                                    value: {
                                      type: 'string';
                                      example: 'Backend Engineering';
                                    };
                                    isArchived: {
                                      $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived';
                                    };
                                  };
                                };
                              };
                            };
                            required: ['id', 'title', 'objectType', 'isArchived', 'fieldType'];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/customField.list': {
    post: {
      summary: 'customField.list';
      operationId: 'customFieldList';
      description: 'Lists all custom fields\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-customfieldlist) permission.**\n';
      tags: ['Custom Field'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  type: 'object';
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema';
                  properties: {
                    includeArchived: {
                      type: 'boolean';
                      description: 'If true, archived custom fields will be included in the response';
                      default: false;
                    };
                  };
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the customField.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success Response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/paths/~1customField.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results';
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/customField.setValue': {
    post: {
      summary: 'customField.setValue';
      operationId: 'customFieldSetValue';
      description: 'Set the value of a custom field\n\n**Requires the [`candidatesWrite`](authentication#permissions-customfieldsetvalue) permission.**\n\nThe values accepted in the `fieldValue` param depend on the type of field that\'s being updated. See below for more details:\n  - Boolean - A boolean value\n  - Date - An ISO Date string\n  - Email, LongText, Phone, String - String\n  - ValueSelect - A string that matches the value of one of the ValueSelect field\'s options\n  - MultiValueSelect - An array of strings that exist in the MultiValueSelect field\'s options\n  - Number - A number\n  - NumberRange - An object with the following properties:\n    - type: "number-range"\n    - minValue: A number\n    - maxValue: A number\n  - CompensationRange - An object with the following properties:\n    - type: "compensation-range"\n    - minValue: A number\n    - maxValue: A number\n    - currencyCode: A string\n    - interval: A valid interval string\n';
      tags: ['Custom Field'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['objectId', 'objectType', 'fieldId', 'fieldValue'];
              properties: {
                objectId: {
                  allOf: [
                    {
                      description: 'The id of the object the field value is being set on.';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                objectType: {
                  type: 'string';
                  description: 'The type of object the field is associated with.';
                  enum: ['Application', 'Candidate', 'Job', 'Opening'];
                };
                fieldId: {
                  allOf: [
                    {
                      description: 'The unique id of the Custom Field definition for the field';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                fieldValue: {
                  description: 'The value to store in the field';
                  oneOf: [
                    {
                      type: 'boolean';
                      title: 'Boolean';
                      description: 'A boolean value';
                    },
                    {
                      type: 'string';
                      title: 'Date';
                      format: 'date-time';
                      description: 'An ISO Date string';
                    },
                    {
                      type: 'string';
                      title: 'String, Email, LongText, Phone';
                      description: 'A string';
                    },
                    {
                      type: 'array';
                      title: 'MultiValueSelect';
                      items: {
                        type: 'string';
                        description: "An array of strings that exist in the MultiValueSelect field's options";
                      };
                    },
                    {
                      type: 'number';
                      title: 'Number';
                      description: 'A number';
                    },
                    {
                      type: 'string';
                      title: 'ValueSelect';
                      description: "A string that matches the value of one of the ValueSelect field's options";
                    },
                    {
                      type: 'object';
                      title: 'NumberRange';
                      required: ['type', 'minValue', 'maxValue'];
                      properties: {
                        type: {
                          type: 'string';
                          example: 'number-range';
                        };
                        minValue: {
                          type: 'number';
                          example: 10000;
                        };
                        maxValue: {
                          type: 'number';
                          example: 100000;
                        };
                      };
                      description: 'An object describing the number range';
                    },
                    {
                      type: 'object';
                      title: 'CompensationRange';
                      required: ['type', 'minValue', 'maxValue', 'currencyCode', 'interval'];
                      properties: {
                        type: {
                          type: 'string';
                          example: 'compensation-range';
                        };
                        minValue: {
                          type: 'number';
                          example: 10000;
                        };
                        maxValue: {
                          type: 'number';
                          example: 100000;
                        };
                        currencyCode: {
                          type: 'string';
                          example: 'USD';
                        };
                        interval: {
                          type: 'string';
                          enum: [
                            'NONE',
                            '1 TIME',
                            '1 HOUR',
                            '1 DAY',
                            '1 WEEK',
                            '2 WEEK',
                            '1 MONTH',
                            '2 MONTH',
                            '1 YEAR',
                            '6 MONTH',
                            '0.5 MONTH',
                            '3 MONTH',
                          ];
                          example: '1 YEAR';
                        };
                      };
                      description: 'An object describing the compensation range';
                    },
                  ];
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the customField.create endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                              };
                              title: {
                                type: 'string';
                              };
                              value: {
                                oneOf: [
                                  {
                                    type: 'boolean';
                                    title: 'Boolean';
                                  },
                                  {
                                    type: 'object';
                                    title: 'Currency';
                                    properties: {
                                      value: {
                                        type: 'number';
                                        example: 1000000;
                                        format: 'currency';
                                      };
                                      currencyCode: {
                                        type: 'string';
                                        example: 'USD';
                                      };
                                    };
                                  },
                                  {
                                    type: 'string';
                                    title: 'Date';
                                    format: 'date-time';
                                  },
                                  {
                                    type: 'string';
                                    title: 'String';
                                  },
                                  {
                                    type: 'string';
                                    title: 'LongText';
                                  },
                                  {
                                    type: 'array';
                                    title: 'MultiValueSelect';
                                    items: {
                                      type: 'string';
                                    };
                                  },
                                  {
                                    type: 'number';
                                    title: 'Number';
                                  },
                                  {
                                    type: 'object';
                                    title: 'NumberRange';
                                    properties: {
                                      required: ['type', 'minValue', 'maxValue'];
                                      type: {
                                        type: 'string';
                                        example: 'number-range';
                                      };
                                      minValue: {
                                        type: 'number';
                                        example: 10000;
                                      };
                                      maxValue: {
                                        type: 'number';
                                        example: 100000;
                                      };
                                    };
                                  },
                                  {
                                    type: 'object';
                                    title: 'CompensationRange';
                                    properties: {
                                      required: ['type', 'minValue', 'maxValue', 'currencyCode', 'interval'];
                                      type: {
                                        type: 'string';
                                        example: 'compensation-range';
                                      };
                                      minValue: {
                                        type: 'number';
                                        example: 40000;
                                      };
                                      maxValue: {
                                        type: 'number';
                                        example: 50000;
                                      };
                                      currencyCode: {
                                        type: 'string';
                                        example: 'USD';
                                      };
                                      interval: {
                                        type: 'string';
                                        enum: [
                                          'NONE',
                                          '1 TIME',
                                          '1 HOUR',
                                          '1 DAY',
                                          '1 WEEK',
                                          '2 WEEK',
                                          '1 MONTH',
                                          '2 MONTH',
                                          '1 YEAR',
                                          '6 MONTH',
                                          '0.5 MONTH',
                                          '3 MONTH',
                                        ];
                                        example: '1 YEAR';
                                      };
                                    };
                                  },
                                  {
                                    type: 'string';
                                    title: 'ValueSelect';
                                  },
                                ];
                              };
                            };
                            required: ['id', 'title', 'value'];
                            example: {
                              id: '650e5f74-32db-4a0a-b61b-b9afece05023';
                              title: 'Expected start date';
                              value: '2022-11-10T19:47:56.795Z';
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/department.create': {
    post: {
      summary: 'department.create';
      description: 'Creates a department\n\n**Requires the [`organizationWrite`](authentication#permissions-departmentcreate) permission.**\n';
      operationId: 'departmentcreate';
      tags: ['Department & Team'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['name'];
              properties: {
                name: {
                  type: 'string';
                  description: 'The name of the department';
                  example: 'Engineering';
                };
                parentId: {
                  type: 'string';
                  format: 'uuid';
                  description: "The id of the department's parent department";
                  example: '1be42b8e-cafd-4beb-8121-f4981eb20f42';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the department.create endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1department.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/department.info': {
    post: {
      summary: 'department.info';
      operationId: 'departmentInfo';
      description: 'Fetch department details by id\n\n**Requires the [`organizationRead`](authentication#permissions-departmentinfo) permission.**\n';
      tags: ['Department'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                departmentId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The unique id of the department whose details will be fetched';
                    },
                  ];
                };
              };
              required: ['departmentId'];
              example: {
                departmentId: '3ae2b801-19f6-41ef-ad28-214bd731948f';
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the department.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                              };
                              name: {
                                type: 'string';
                                example: 'Engineering';
                              };
                              isArchived: {
                                $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived';
                              };
                              parentId: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                              };
                            };
                            required: ['id', 'name', 'isArchived'];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/department.list': {
    post: {
      summary: 'department.list';
      operationId: 'departmentList';
      description: 'Lists all departments\n\n**Requires the [`organizationRead`](authentication#permissions-departmentlist) permission.**\n';
      tags: ['Department'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  type: 'object';
                  properties: {
                    includeArchived: {
                      type: 'boolean';
                      default: false;
                      description: 'Whether archived departments should be included in the response';
                    };
                  };
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the department.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success Response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/paths/~1department.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/file.info': {
    post: {
      summary: 'file.info';
      description: 'Retrieve the url of a file associated with a candidate\n\n**Requires the [`candidatesRead`](authentication#permissions-fileinfo) permission.**\n';
      operationId: 'fileInfo';
      tags: ['File'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                fileHandle: {
                  type: 'string';
                  description: 'A file handle retrieved from the public API';
                  example: 'eyJoYW5kbGUiOnsidHlwZSI6IkNhbmRpZGF0ZUZpbGUiLCJmaWxlSWQiOiIxNTk1ZTRmYy04MTQwLTQ1NGUtYTI1ZC04NTNiOTQ3ZWNmYzgiLCJvd25lcklkIjoiYmY5NGZlNmMtMjU3MS00NzQ1LWE1OWEtNTA5MjE3ODI3MDVlIn0sInNpZ25hdHVyZSI6IkFqclpjT0VlTXUwdWxLZlRCS05iMWRkbDdHcjVIWFVmZzNrS0NPL1dWWjg9IiwidmVyc2lvbiI6IjEilQ\n';
                };
              };
              required: ['fileHandle'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the file.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              url: {
                                type: 'string';
                                description: 'The url of the file';
                                example: 'https://s3.amazonaws.com/...';
                              };
                            };
                            required: ['url'];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/feedbackFormDefinition.info': {
    post: {
      summary: 'feedbackFormDefinition.info';
      operationId: 'feedbackFormDefinitionInfo';
      description: 'Returns a single feedback form by id\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-feedbackformdefinitioninfo) permission.**\n';
      tags: ['Feedback Form Definition'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['feedbackFormDefinitionId'];
              properties: {
                feedbackFormDefinitionId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: "The unique id of the feedback form you'd like to fetch.";
                    },
                    {
                      example: '9b17887e-5add-49e8-9a03-ffffa669aa2f';
                    },
                  ];
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the feedbackFormDefinition.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success Response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        properties: {
                          results: {
                            allOf: [
                              {
                                $ref: '#/paths/~1referralForm.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/allOf/0';
                              },
                              {
                                type: 'object';
                                properties: {
                                  organizationId: {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  };
                                  isDefaultForm: {
                                    type: 'boolean';
                                    example: true;
                                  };
                                  interviewId: {
                                    allOf: [
                                      {
                                        $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                      },
                                      {
                                        description: 'The id of the interview associated with the feedback form.';
                                      },
                                    ];
                                  };
                                };
                              },
                            ];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/feedbackFormDefinition.list': {
    post: {
      summary: 'feedbackFormDefinition.list';
      operationId: 'feedbackFormDefinitionList';
      description: 'Lists all feedback forms\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-feedbackformdefinitionlist) permission.**\n';
      tags: ['Feedback Form Definition'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                includeArchived: {
                  $ref: '#/paths/~1source.list/post/requestBody/content/application~1json/schema/properties/includeArchived';
                };
                cursor: {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema/properties/cursor';
                };
                syncToken: {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema/properties/syncToken';
                };
                limit: {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema/properties/limit';
                };
              };
              example: {
                includeArchived: false;
                cursor: 'qA';
                syncToken: '6W05prn4d';
                limit: 25;
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the feedbackFormDefinition.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/paths/~1feedbackFormDefinition.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results';
                            };
                          };
                        };
                      },
                    ];
                    required: ['results'];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/hiringTeam.addMember': {
    post: {
      summary: 'hiringTeam.addMember';
      description: 'Adds an Ashby user to the hiring team at the application or job-level. \n\n**Requires the [`organizationWrite`](authentication#permissions-hiringteamaddmember) permission.**\n\nHiring team members can be added to a hiring team at the application, job, or opening level. \n';
      operationId: 'hiringteamaddmember';
      tags: ['Hiring Team'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  type: 'object';
                  title: 'Application-level';
                  required: ['applicationId', 'teamMemberId', 'roleId'];
                  properties: {
                    applicationId: {
                      allOf: [
                        {
                          description: 'The application to assign the user a role on.';
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                      ];
                    };
                    teamMemberId: {
                      allOf: [
                        {
                          description: 'The id of the user to assign the role to.';
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                      ];
                    };
                    roleId: {
                      allOf: [
                        {
                          description: 'The id of the hiring team role to assign.';
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                      ];
                    };
                  };
                },
                {
                  type: 'object';
                  title: 'Job-level';
                  required: ['jobId', 'teamMemberId', 'roleId'];
                  properties: {
                    jobId: {
                      allOf: [
                        {
                          description: 'The job to assign the user a role on.';
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                      ];
                    };
                    teamMemberId: {
                      allOf: [
                        {
                          description: 'The id of the user to assign the role to.';
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                      ];
                    };
                    roleId: {
                      allOf: [
                        {
                          description: 'The id of the hiring team role to assign.';
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                      ];
                    };
                  };
                },
                {
                  type: 'object';
                  title: 'Opening-level';
                  required: ['openingId', 'teamMemberId', 'roleId'];
                  properties: {
                    openingId: {
                      allOf: [
                        {
                          description: 'The opening to assign the user a role on.';
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                      ];
                    };
                    teamMemberId: {
                      allOf: [
                        {
                          description: 'The id of the user to assign the role to.';
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                      ];
                    };
                    roleId: {
                      allOf: [
                        {
                          description: 'The id of the hiring team role to assign.';
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                      ];
                    };
                  };
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the hiringTeam.addMember endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              email: {
                                $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/email/allOf/0';
                              };
                              firstName: {
                                type: 'string';
                                example: 'Joey';
                              };
                              lastName: {
                                type: 'string';
                                example: 'Joe';
                              };
                              role: {
                                type: 'string';
                                example: 'Hiring Manager';
                              };
                              userId: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                              };
                            };
                            required: ['userId', 'firstName', 'lastName', 'email', 'role'];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/hiringTeamRole.list': {
    post: {
      summary: 'hiringTeamRole.list';
      description: 'Lists the possible hiring team roles in an organization\n\n**Requires the [`organizationRead`](authentication#permissions-hiringteamrolelist) permission.**\n';
      operationId: 'hiringteamrolelist';
      tags: ['Hiring Team Role'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                namesOnly: {
                  type: 'boolean';
                  description: 'When set to true (the default), an array of role titles is returned. When set to false, an array of objects that include the id and title of the role is returned.';
                  default: true;
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the hiringTeamRole.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'namesOnly: true';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              type: 'string';
                            };
                            example: ['Recruiter'];
                          };
                        };
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'namesOnly: false';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              type: 'object';
                              properties: {
                                id: {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                };
                                title: {
                                  type: 'string';
                                  example: 'Recruiter';
                                };
                              };
                            };
                          };
                        };
                      },
                    ];
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interview.info': {
    post: {
      summary: 'interview.info';
      operationId: 'interviewInfo';
      description: 'Fetch interview details by id\n\n**Requires the [`interviewsRead`](authentication#permissions-interviewinfo) permission.**\n';
      tags: ['Interview'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                id: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The unique id of the interview whose details will be fetched';
                    },
                  ];
                };
              };
              required: ['id'];
              example: {
                id: '3ae2b801-19f6-41ef-ad28-214bd731948f';
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the interview.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              id: {
                                allOf: [
                                  {
                                    description: "The interview's id";
                                  },
                                  {
                                    example: '3ae2b801-19f6-41ef-ad28-214bd731948f';
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                              title: {
                                type: 'string';
                                example: 'Technical Phone Interview';
                                description: "The interview's title";
                              };
                              isArchived: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived';
                                  },
                                  {
                                    description: 'Whether or not the interview is archived';
                                  },
                                ];
                              };
                              isDebrief: {
                                type: 'boolean';
                                example: false;
                                description: 'Whether the interview is a debrief';
                              };
                              instructionsHtml: {
                                type: 'string';
                                description: "An HTML version of the interview's description";
                                example: '<p>The technical phone interview consists of a 60-minute series of techincal questions</p>\n';
                              };
                              instructionsPlain: {
                                type: 'string';
                                description: "A plaintext version of the interview's description";
                                example: 'The technical phone interview consists of a 60-minute series of techincal questions';
                              };
                              jobId: {
                                allOf: [
                                  {
                                    description: 'The id of the job the interview is associated with. If null, the interview is not associated with a specific job\nand is a shared interview. Interviews that are associated with particular jobs can only be scheduled for applications\nto those jobs.\n';
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                              feedbackFormDefinitionId: {
                                allOf: [
                                  {
                                    description: 'The id of the feedback form definition associated with the interview. \n';
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                            };
                            required: ['id', 'title', 'isArchived', 'feedbackFormDefinitionId'];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interview.list': {
    post: {
      summary: 'interview.list';
      operationId: 'interviewList';
      description: 'List all interviews\n\n**Requires the [`interviewsRead`](authentication#permissions-interviewlist) permission.**\n';
      tags: ['Interview'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema';
                },
                {
                  type: 'object';
                  properties: {
                    includeArchived: {
                      $ref: '#/paths/~1source.list/post/requestBody/content/application~1json/schema/properties/includeArchived';
                    };
                    includeNonSharedInterviews: {
                      type: 'boolean';
                      default: false;
                      description: 'If true, interviews that are associated with specific jobs will be included in the response. \nShared interviews that are not associated with a specific job can be scheduled for applications to any job.\nInterviews that are not shared can only be scheduled for applications to the job they are associated with. \n';
                    };
                  };
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the interview.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/paths/~1interview.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interviewEvent.list': {
    post: {
      summary: 'interviewEvent.list';
      operationId: 'interviewEventList';
      description: 'Lists interview events associated with an interview schedule\n\n**Requires the [`interviewsRead`](authentication#permissions-intervieweventlist) permission.**\n';
      tags: ['Interview Event'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                interviewScheduleId: {
                  allOf: [
                    {
                      description: 'The unique ID of the interview schedule, for which to list interview events';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                expand: {
                  type: 'array';
                  description: 'Choose to expand the result and include additional data for related objects. \n';
                  items: {
                    enum: ['interview'];
                  };
                };
              };
              required: ['interviewScheduleId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the interviewEvent.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              type: 'object';
                              properties: {
                                id: {
                                  allOf: [
                                    {
                                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                    },
                                    {
                                      description: "The interview event's id";
                                    },
                                    {
                                      example: '3ae2b801-19f6-41ef-ad28-214bd731948f';
                                    },
                                  ];
                                };
                                interviewId: {
                                  allOf: [
                                    {
                                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                    },
                                    {
                                      description: "The interview's id";
                                    },
                                    {
                                      example: 'ff6c7d9d-71e3-4c9c-88b1-28824980c276';
                                    },
                                  ];
                                };
                                interviewScheduleId: {
                                  allOf: [
                                    {
                                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                    },
                                    {
                                      description: "The interview schedule's id";
                                    },
                                    {
                                      example: '9d34f544-c150-4d70-91c4-e8b0b4a72846';
                                    },
                                  ];
                                };
                                interviewerUserIds: {
                                  type: 'array';
                                  items: {
                                    allOf: [
                                      {
                                        $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                      },
                                      {
                                        description: 'An array of the ids of all interviewers';
                                      },
                                      {
                                        example: 'caea4d97-331d-46b1-a8e3-6b821c2214ef';
                                      },
                                    ];
                                  };
                                };
                                createdAt: {
                                  allOf: [
                                    {
                                      description: 'The time the interview event was created';
                                    },
                                    {
                                      $ref: '#/paths/~1application.create/post/requestBody/content/application~1json/schema/properties/applicationHistory/allOf/0/items/properties/enteredStageAt/allOf/0';
                                    },
                                  ];
                                  type: 'string';
                                };
                                startTime: {
                                  allOf: [
                                    {
                                      description: 'The time the interview event is scheduled to start';
                                    },
                                    {
                                      $ref: '#/paths/~1application.create/post/requestBody/content/application~1json/schema/properties/applicationHistory/allOf/0/items/properties/enteredStageAt/allOf/0';
                                    },
                                  ];
                                  type: 'string';
                                };
                                endTime: {
                                  allOf: [
                                    {
                                      description: 'The time the interview event is scheduled to end';
                                    },
                                    {
                                      $ref: '#/paths/~1application.create/post/requestBody/content/application~1json/schema/properties/applicationHistory/allOf/0/items/properties/enteredStageAt/allOf/0';
                                    },
                                  ];
                                  type: 'string';
                                };
                                feedbackLink: {
                                  type: 'string';
                                  format: 'uri';
                                  example: 'https://app.ashbyhq.com/interview-briefings/4736b6d2-5c97-43a6-a7c6-0228bf079411/feedback';
                                  description: 'The link to submit feedback for the interview event';
                                };
                                location: {
                                  type: 'string';
                                  description: 'The location of the interview';
                                  example: 'Google Meet';
                                };
                                meetingLink: {
                                  type: 'string';
                                  format: 'uri';
                                  description: 'A link to the virtual meeting (if the interview is being hosted virtually)';
                                };
                                hasSubmittedFeedback: {
                                  type: 'boolean';
                                  description: 'Whether or not this interview has any feedback submitted';
                                };
                                interview: {
                                  description: 'The interview associated with this event (only included if the expand parameter includes "interview")';
                                  $ref: '#/paths/~1interview.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                                };
                              };
                              required: [
                                'id',
                                'interviewId',
                                'interviewScheduleId',
                                'interviewerUserIds',
                                'createdAt',
                                'startTime',
                                'endTime',
                                'feedbackLink',
                                'hasSubmittedFeedback',
                              ];
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interviewPlan.list': {
    post: {
      summary: 'interviewPlan.list';
      operationId: 'interviewPlanList';
      description: 'List all interview plans.\n\n**Requires the [`interviewsRead`](authentication#permissions-interviewplanlist) permission.**\n';
      tags: ['Interview Plan'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                includeArchived: {
                  $ref: '#/paths/~1source.list/post/requestBody/content/application~1json/schema/properties/includeArchived';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the interviewPlan.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          moreDataAvailable: {
                            $ref: '#/paths/~1source.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/moreDataAvailable';
                          };
                          results: {
                            type: 'array';
                            items: {
                              type: 'object';
                              properties: {
                                id: {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                };
                                title: {
                                  type: 'string';
                                  example: 'Engineering Interview Plan';
                                };
                                isArchived: {
                                  type: 'boolean';
                                  example: false;
                                };
                              };
                              required: ['id', 'title', 'isArchived'];
                            };
                          };
                        };
                      },
                      {
                        required: ['results', 'moreDataAvailable'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interviewSchedule.cancel': {
    post: {
      summary: 'interviewSchedule.cancel';
      operationId: 'interviewScheduleCancel';
      description: 'Cancel an interview schedule by id\n\n**Requires the [`interviewsWrite`](authentication#permissions-interviewschedulecancel) permission.**\n';
      tags: ['Interview Schedule'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                id: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the interview schedule to cancel';
                    },
                  ];
                };
                allowReschedule: {
                  type: 'boolean';
                  description: 'Whether or not this interview schedule can be rescheduled.';
                  default: false;
                };
              };
              required: ['id'];
              example: {
                id: '3ae2b801-19f6-41ef-ad28-214bd731948f';
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the interviewSchedule.cancel endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/interviewScheduleCreate/post/requestBody/content/application~1json/schema/properties/data/properties/interviewSchedule';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interviewSchedule.create': {
    post: {
      summary: 'interviewSchedule.create';
      operationId: 'interviewScheduleCreate';
      description: 'Create a scheduled interview in Ashby\n\n**Requires the [`interviewsWrite`](authentication#permissions-interviewschedulecreate) permission.**\n';
      tags: ['Interview Schedule'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                applicationId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the application for this interview schedule';
                    },
                  ];
                };
                interviewEvents: {
                  type: 'array';
                  description: 'The list of events that make up this interview schedule';
                  items: {
                    type: 'object';
                    required: ['startTime', 'endTime', 'interviewers'];
                    properties: {
                      startTime: {
                        type: 'string';
                        description: 'The start time of this event';
                        example: '2023-01-30T15:00:00.000Z';
                      };
                      endTime: {
                        type: 'string';
                        description: 'The end time of this event';
                        example: '2023-01-30T16:00:00.000Z';
                      };
                      interviewers: {
                        type: 'array';
                        description: 'The interviewers for this event';
                        items: {
                          type: 'object';
                          required: ['email'];
                          properties: {
                            email: {
                              type: 'string';
                              description: 'The email address of the user in Ashby';
                              example: 'test@ashbyhq.com';
                            };
                            feedbackRequired: {
                              type: 'boolean';
                              description: 'Whether this interviewer is required to provide feedback';
                            };
                          };
                        };
                      };
                      interviewId: {
                        allOf: [
                          {
                            $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                          },
                          {
                            description: "The id of the interview used in this event. If no value is provided, the organization's default interview will be used.";
                          },
                          {
                            example: '46648e83-f28f-43c4-a2a0-58e0599cff41';
                          },
                        ];
                      };
                    };
                  };
                };
              };
              required: ['applicationId', 'interviewEvents'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the interviewSchedule.create endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/interviewScheduleCreate/post/requestBody/content/application~1json/schema/properties/data/properties/interviewSchedule';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interviewSchedule.list': {
    post: {
      summary: 'interviewSchedule.list';
      operationId: 'interviewScheduleList';
      description: 'Gets all interview schedules in the organization.\n\n**Requires the [`interviewsRead`](authentication#permissions-interviewschedulelist) permission.**\n';
      tags: ['Interview Schedule'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  $ref: '#/paths/~1application.list/post/requestBody/content/application~1json/schema/allOf/0';
                },
                {
                  type: 'object';
                  properties: {
                    applicationId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                        {
                          description: 'The id of the application, for which to fetch interview schedules';
                        },
                      ];
                    };
                    interviewStageId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                        {
                          description: 'The id of the interview stage, for which to fetch interview schedules';
                        },
                      ];
                    };
                  };
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the interviewSchedule.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/webhooks/interviewScheduleCreate/post/requestBody/content/application~1json/schema/properties/data/properties/interviewSchedule';
                            };
                          };
                        };
                      },
                    ];
                    required: ['results'];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interviewSchedule.update': {
    post: {
      summary: 'interviewSchedule.update';
      operationId: 'interviewScheduleUpdate';
      description: "Update an interview schedule. This endpoint allows you to add, cancel, or update interview events associated with an interview schedule.\n\n**Requires the [`interviewsWrite`](authentication#permissions-interviewscheduleupdate) permission.**\n\nIn order to update an interview event on a schedule, the event's `interviewEventId` must be included when sending your request. \n`interviewEventId`s are included in the response of the `interviewSchedule.create` endpoint.\n";
      tags: ['Interview Schedule'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  type: 'object';
                  properties: {
                    interviewScheduleId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                        {
                          description: 'The id of the interview schedule to update. \nOnly interview schedules created using the API key making the request can be updated.\n';
                        },
                      ];
                    };
                    interviewEvent: {
                      allOf: [
                        {
                          description: "An event on the interview schedule to create or update.\nTo update an event, the event's `interviewEventId` must be included in the request.\n";
                        },
                        {
                          $ref: '#/paths/~1interviewSchedule.create/post/requestBody/content/application~1json/schema/properties/interviewEvents/items';
                        },
                        {
                          type: 'object';
                          properties: {
                            interviewEventId: {
                              allOf: [
                                {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                },
                                {
                                  description: 'The id of an interview event to update. \n';
                                },
                              ];
                            };
                          };
                        },
                      ];
                    };
                  };
                  required: ['interviewScheduleId', 'interviewEvent'];
                },
                {
                  type: 'object';
                  properties: {
                    interviewScheduleId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                        {
                          description: 'The id of the interview schedule to update. \nOnly interview schedules created using the API key making the request can be updated.\n';
                        },
                      ];
                    };
                    interviewEventIdToCancel: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                        {
                          description: 'The id of an interview event to cancel.\n';
                        },
                      ];
                    };
                    allowFeedbackDeletion: {
                      type: 'boolean';
                      default: false;
                      description: 'By default, we do not allow interview events with submitted feedback to be canceled because canceling an event causes its associated feedback to be deleted. If you want to allow events with submitted feedback to be canceled, this flag can be passed in and set to `true`. In this case, events with feedback will be canceled, and any associated feedback will be deleted.';
                    };
                  };
                  required: ['interviewScheduleId', 'interviewEventIdToCancel'];
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the interviewSchedule.update endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/interviewScheduleCreate/post/requestBody/content/application~1json/schema/properties/data/properties/interviewSchedule';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interviewStage.list': {
    post: {
      summary: 'interviewStage.list';
      description: 'List all interview stages for an interview plan in order.\n\n**Requires the [`interviewsRead`](authentication#permissions-interviewstagelist) permission.**\n';
      operationId: 'interviewStageList';
      tags: ['Interview Stage'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                interviewPlanId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the interview plan to list stages for';
                    },
                  ];
                };
              };
              required: ['interviewPlanId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the interviewStage.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/paths/~1interviewStage.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                            };
                          };
                          moreDataAvailable: {
                            $ref: '#/paths/~1source.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/moreDataAvailable';
                          };
                        };
                      },
                      {
                        required: ['results', 'moreDataAvailable'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interviewStage.info': {
    post: {
      summary: 'interviewStage.info';
      operationId: 'interviewStageInfo';
      description: 'Fetch interview stage details by id\n\n**Requires the [`interviewsRead`](authentication#permissions-interviewstageinfo) permission.**\n';
      tags: ['Interview Stage'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                interviewStageId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The unique id of the interview stage whose details will be fetched';
                    },
                  ];
                };
              };
              required: ['interviewStageId'];
              example: {
                interviewStageId: '3ae2b801-19f6-41ef-ad28-214bd731948f';
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the interviewStage.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            allOf: [
                              {
                                type: 'object';
                                properties: {
                                  id: {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  };
                                  title: {
                                    type: 'string';
                                    example: 'Offer';
                                  };
                                  type: {
                                    type: 'string';
                                    example: 'Offer';
                                  };
                                  orderInInterviewPlan: {
                                    type: 'integer';
                                    example: 1006;
                                    default: 0;
                                  };
                                  interviewStageGroupId: {
                                    type: 'string';
                                    example: '5f7b3b3b-7b1b-4b1b-8b3b-7b1b4b1b8b3b';
                                  };
                                };
                                required: ['id', 'title', 'type', 'orderInInterviewPlan'];
                              },
                              {
                                type: 'object';
                                properties: {
                                  interviewPlanId: {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  };
                                };
                                required: ['interviewPlanId'];
                              },
                            ];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interviewStageGroup.list': {
    post: {
      summary: 'interviewStageGroup.list';
      description: 'List all interview group stages for an interview plan in order.\n\n**Requires the [`interviewsRead`](authentication#permissions-interviewstagelist) permission.**\n';
      operationId: 'interviewStageGroupList';
      tags: ['Interview Stage Group'];
      responses: {
        '200': {
          description: 'Responses for the interviewStageGroup.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              allOf: [
                                {
                                  type: 'object';
                                  properties: {
                                    id: {
                                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                    };
                                    title: {
                                      type: 'string';
                                      example: 'Technical Screening';
                                    };
                                    order: {
                                      type: 'integer';
                                      example: 1;
                                    };
                                    stageType: {
                                      type: 'string';
                                      enum: ['Lead', 'PreInterviewScreen', 'Active', 'Offer', 'Hired', 'Archived'];
                                      example: 'Active';
                                    };
                                  };
                                  required: ['id', 'title', 'order', 'stageType'];
                                },
                              ];
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interviewerPool.list': {
    post: {
      summary: 'interviewerPool.list';
      operationId: 'interviewerPoolList';
      description: 'List all interviewer pools\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-interviewerpoollist) permission.**\n';
      tags: ['Interviewer Pool'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema';
                },
                {
                  type: 'object';
                  properties: {
                    includeArchivedPools: {
                      type: 'boolean';
                      description: 'When true, includes archived pools';
                      default: false;
                    };
                    includeArchivedTrainingStages: {
                      type: 'boolean';
                      description: 'When true, includes archived training stages';
                      default: false;
                    };
                  };
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the interviewerPool.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              type: 'object';
                              properties: {
                                id: {
                                  allOf: [
                                    {
                                      description: "The pool's id";
                                    },
                                    {
                                      example: '3ae2b801-19f6-41ef-ad28-214bd731948f';
                                    },
                                    {
                                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                    },
                                  ];
                                };
                                title: {
                                  type: 'string';
                                  example: 'Backend Technical Screeners';
                                  description: "The pool's title";
                                };
                                isArchived: {
                                  allOf: [
                                    {
                                      $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived';
                                    },
                                    {
                                      description: 'Whether or not the pool is archived';
                                    },
                                  ];
                                };
                                trainingPath: {
                                  type: 'object';
                                  properties: {
                                    id: {
                                      allOf: [
                                        {
                                          description: "The training path's id";
                                        },
                                        {
                                          example: '3ae2b801-19f6-41ef-ad28-214bd731948f';
                                        },
                                        {
                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                        },
                                      ];
                                    };
                                    enabled: {
                                      type: 'boolean';
                                      description: 'Whether or not the training path is enabled';
                                      example: true;
                                    };
                                    trainingStages: {
                                      type: 'array';
                                      items: {
                                        type: 'object';
                                        properties: {
                                          id: {
                                            allOf: [
                                              {
                                                description: "The training stage's id";
                                              },
                                              {
                                                example: '3ae2b801-19f6-41ef-ad28-214bd731948f';
                                              },
                                              {
                                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                              },
                                            ];
                                          };
                                          interviewerRole: {
                                            type: 'string';
                                            enum: ['Shadow', 'ReverseShadow'];
                                            description: 'The role of the interviewer for this stage';
                                            example: 'Shadow';
                                          };
                                          interviewsRequired: {
                                            type: 'integer';
                                            description: 'The number of interviews required for this stage';
                                            example: 2;
                                          };
                                          approvalRequired: {
                                            type: 'boolean';
                                            description: 'Whether or not approval is required for this stage';
                                            example: true;
                                          };
                                          approvers: {
                                            type: 'array';
                                            items: {
                                              $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results';
                                            };
                                          };
                                        };
                                        required: ['id', 'interviewerRole', 'interviewsRequired', 'approvalRequired'];
                                      };
                                    };
                                  };
                                  required: ['id', 'enabled', 'trainingStages'];
                                };
                              };
                              required: ['id', 'title', 'isArchived'];
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interviewerPool.info': {
    post: {
      summary: 'interviewerPool.info';
      operationId: 'interviewerPoolInfo';
      description: 'Get information about an interviewer pool.\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-interviewerpoolinfo) permission.**\n';
      tags: ['Interviewer Pool'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                interviewerPoolId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                };
              };
              required: ['id'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the interviewerPool.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            allOf: [
                              {
                                $ref: '#/paths/~1interviewerPool.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items';
                              },
                              {
                                type: 'object';
                                properties: {
                                  qualifiedMembers: {
                                    type: 'array';
                                    items: {
                                      $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results';
                                    };
                                  };
                                  trainees: {
                                    type: 'array';
                                    items: {
                                      allOf: [
                                        {
                                          $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results';
                                        },
                                        {
                                          properties: {
                                            currentProgress: {
                                              type: 'object';
                                              properties: {
                                                trainingPathId: {
                                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                                  description: 'The id of the training path the user is currently on';
                                                };
                                                trainingStageId: {
                                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                                  description: 'The id of the training stage the user is currently in';
                                                };
                                                interviewsCompleted: {
                                                  type: 'integer';
                                                  description: 'The number of interviews the user has completed in the current stage';
                                                  example: 1;
                                                };
                                              };
                                              required: ['trainingPathId', 'trainingStageId', 'interviewsCompleted'];
                                            };
                                          };
                                        },
                                      ];
                                      required: ['currentProgress'];
                                    };
                                  };
                                };
                              },
                            ];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interviewerPool.create': {
    post: {
      summary: 'interviewerPool.create';
      operationId: 'interviewerPoolCreate';
      description: 'Create an interviewer pool.\n\n**Requires the [`hiringProcessMetadataWrite`](authentication#permissions-interviewerpoolcreate) permission.**\n';
      tags: ['Interviewer Pool'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                title: {
                  type: 'string';
                  description: 'The title of the interviewer pool';
                  example: 'Engineering';
                };
                requiresTraining: {
                  type: 'boolean';
                  description: 'Whether the interviewer pool requires training';
                  example: true;
                };
              };
              required: ['title'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the interviewerPool.create endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1interviewerPool.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interviewerPool.update': {
    post: {
      summary: 'interviewerPool.update';
      operationId: 'interviewerPoolUpdate';
      description: 'Update an interviewer pool.\n\n**Requires the [`hiringProcessMetadataWrite`](authentication#permissions-interviewerpoolupdate) permission.**\n';
      tags: ['Interviewer Pool'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                interviewerPoolId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                };
                title: {
                  type: 'string';
                  description: 'The title of the interviewer pool';
                  example: 'Engineering';
                };
                requiresTraining: {
                  type: 'boolean';
                  description: 'Whether the interviewer pool requires training';
                  example: true;
                };
              };
              required: ['interviewerPoolId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the interviewerPool.update endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1interviewerPool.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interviewerPool.archive': {
    post: {
      summary: 'interviewerPool.archive';
      operationId: 'interviewerPoolArchive';
      description: 'Archives an interviewer pool.\n\n**Requires the [`hiringProcessMetadataWrite`](authentication#permissions-interviewerpoolarchive) permission.**\n';
      tags: ['Interviewer Pool'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                interviewerPoolId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                };
              };
              required: ['id'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the interviewerPool.archive endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1interviewerPool.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interviewerPool.restore': {
    post: {
      summary: 'interviewerPool.restore';
      operationId: 'interviewerPool.restore';
      description: 'Restores an archived interviewer pool.\n\n**Requires the [`hiringProcessMetadataWrite`](authentication#permissions-interviewerpoolrestore) permission.**\n';
      tags: ['Interviewer Pool'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                interviewerPoolId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                };
              };
              required: ['id'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the interviewerPool.restore endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1interviewerPool.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interviewerPool.addUser': {
    post: {
      summary: 'interviewerPool.addUser';
      operationId: 'interviewerPoolAddUser';
      description: 'Add a user to an interviewer pool.\n\n**Requires the [`hiringProcessMetadataWrite`](authentication#permissions-interviewerpooladduser) permission.**\n';
      tags: ['Interviewer Pool'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                interviewerPoolId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                };
                userId: {
                  type: 'string';
                  format: 'uuid';
                  example: 'e9ed20fd-d45f-4aad-8a00-a19bfba0083e';
                };
                interviewerPoolTrainingPathStageId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                  description: 'The ID of the training path stage to add the user to. If this is not provided, the user will be added as a fully qualified member of the pool.';
                };
              };
              required: ['interviewerPoolId', 'userId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the interviewerPool.removeUser endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1interviewerPool.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/interviewerPool.removeUser': {
    post: {
      summary: 'interviewerPool.removeUser';
      operationId: 'interviewerPoolRemoveUser';
      description: 'Remove a user from an interviewer pool.\n\n**Requires the [`hiringProcessMetadataWrite`](authentication#permissions-interviewerpoolremoveuser) permission.**\n';
      tags: ['Interviewer Pool'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                interviewerPoolId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                };
                userId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                };
              };
              required: ['interviewerPoolId', 'userId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the interviewerPool.removeUser endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1interviewerPool.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/job.create': {
    post: {
      summary: 'job.create';
      operationId: 'jobCreate';
      description: 'Creates a new job\n\n**Requires the [`jobsWrite`](authentication#permissions-jobcreate) permission.**\n';
      tags: ['Job'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                title: {
                  type: 'string';
                  example: 'Software Engineer';
                  description: 'The title of the job.';
                };
                teamId: {
                  allOf: [
                    {
                      description: 'The id of the department or team associated with the job';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                locationId: {
                  allOf: [
                    {
                      description: 'The id of the location of the job';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                defaultInterviewPlanId: {
                  allOf: [
                    {
                      description: 'The id of the default interview plan for this job posting. \nA job cannot be opened without a default interview plan.\n';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                jobTemplateId: {
                  allOf: [
                    {
                      description: 'The id of the job template to use for this job posting.';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
              };
              required: ['title', 'teamId', 'locationId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the job.create endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/jobCreate/post/requestBody/content/application~1json/schema/properties/data/properties/job';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/job.info': {
    post: {
      summary: 'job.info';
      operationId: 'jobInfo';
      description: 'Returns details about a single job by id\n\n**Requires the [`jobsRead`](authentication#permissions-jobinfo) permission.**\n';
      tags: ['Job'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                id: {
                  allOf: [
                    {
                      description: 'The id of the job to fetch';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                includeUnpublishedJobPostingsIds: {
                  type: 'boolean';
                  description: 'Include unpublished job posting ids';
                };
                expand: {
                  type: 'array';
                  description: 'Choose to expand the result and include additional data for related objects. \n';
                  items: {
                    type: 'string';
                    enum: ['location', 'openings'];
                  };
                };
              };
              required: ['id'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the job.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        type: 'object';
                        required: ['success'];
                        properties: {
                          success: {
                            type: 'boolean';
                            description: 'Whether the response is considered successful.';
                          };
                        };
                      },
                      {
                        type: 'object';
                        properties: {
                          results: {
                            allOf: [
                              {
                                $ref: '#/webhooks/jobCreate/post/requestBody/content/application~1json/schema/properties/data/properties/job';
                              },
                              {
                                type: 'object';
                                properties: {
                                  location: {
                                    allOf: [
                                      {
                                        $ref: '#/paths/~1location.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                                      },
                                      {
                                        description: 'The location will only be included if the `location` expand parameter is included when the request is made.';
                                      },
                                    ];
                                  };
                                  openings: {
                                    description: 'The openings array will only be included if the `openings` expand parameter is included when the request is made.';
                                    type: 'array';
                                    items: {
                                      $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening';
                                    };
                                  };
                                };
                              },
                            ];
                          };
                        };
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        title: 'Error response';
                      },
                      {
                        type: 'object';
                        required: ['errors'];
                        properties: {
                          errors: {
                            type: 'array';
                            items: {
                              type: 'string';
                            };
                            description: 'A list of error message strings.';
                          };
                        };
                      },
                    ];
                    example: {
                      success: false;
                      errors: ['invalid_input'];
                    };
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/job.list': {
    post: {
      summary: 'job.list';
      description: 'List all open, closed, and archived jobs.\n\n**Requires the [`jobsRead`](authentication#permissions-joblist) permission.**\n\nTo include draft jobs, `Draft` must be specified in the `status` param.\n';
      operationId: 'jobList';
      tags: ['Job'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema';
                },
                {
                  type: 'object';
                  properties: {
                    status: {
                      type: 'array';
                      description: 'When supplied, only jobs with the provided status(es) will be returned.';
                      items: {
                        $ref: '#/paths/~1job.setStatus/post/requestBody/content/application~1json/schema/properties/status/allOf/1';
                      };
                    };
                    openedAfter: {
                      type: 'integer';
                      format: 'int64';
                      description: 'Return jobs opened after this date, which is the time since the unix epoch in milliseconds';
                    };
                    openedBefore: {
                      type: 'integer';
                      format: 'int64';
                      description: 'Return jobs opened before this date, which is the time since the unix epoch in milliseconds';
                    };
                    closedAfter: {
                      type: 'integer';
                      format: 'int64';
                      description: 'Return jobs closed after this date, which is the time since the unix epoch in milliseconds';
                    };
                    closedBefore: {
                      type: 'integer';
                      format: 'int64';
                      description: 'Return jobs closed before this date, which is the time since the unix epoch in milliseconds';
                    };
                    includeUnpublishedJobPostingsIds: {
                      type: 'boolean';
                      description: 'Include unpublished job posting ids';
                    };
                    expand: {
                      $ref: '#/paths/~1job.info/post/requestBody/content/application~1json/schema/properties/expand';
                    };
                  };
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the jobPosting.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        allOf: [
                          {
                            $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                          },
                          {
                            title: 'Success response';
                          },
                          {
                            type: 'object';
                            properties: {
                              moreDataAvailable: {
                                type: 'boolean';
                                description: 'Whether the cursor can be used to fetch a subsequent page of data.';
                              };
                              nextCursor: {
                                $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema/properties/cursor';
                              };
                              syncToken: {
                                $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema/properties/syncToken';
                              };
                            };
                          },
                        ];
                      },
                      {
                        type: 'object';
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              allOf: [
                                {
                                  $ref: '#/webhooks/jobCreate/post/requestBody/content/application~1json/schema/properties/data/properties/job';
                                },
                                {
                                  $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/allOf/1';
                                },
                              ];
                            };
                          };
                        };
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/job.setStatus': {
    post: {
      summary: 'job.setStatus';
      operationId: 'jobSetStatus';
      description: "Sets the status on a job by id.\n\n**Requires the [`jobsWrite`](authentication#permissions-jobsetstatus) permission.**\n\nAll jobs are drafts when they're first created. There are a few validations around the stages a job can be transitioned to:\n- Drafts can be changed to Open or Archived\n- Open jobs can be changed to Closed\n- Closed jobs can be changed to Draft or Archived\n- Archived jobs can be changed to a Draft \n";
      tags: ['Job'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                jobId: {
                  allOf: [
                    {
                      description: 'The unique id of the job to set the status of.';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                status: {
                  allOf: [
                    {
                      description: 'The status to apply to the job.';
                    },
                    {
                      type: 'string';
                      enum: ['Draft', 'Open', 'Closed', 'Archived'];
                    },
                  ];
                };
              };
              required: ['jobId', 'status'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the job.setStatus endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/jobCreate/post/requestBody/content/application~1json/schema/properties/data/properties/job';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/job.update': {
    post: {
      summary: 'job.update';
      operationId: 'jobUpdate';
      description: 'Updates an existing job\n\n**Requires the [`jobsWrite`](authentication#permissions-jobupdate) permission.**\n';
      tags: ['Job'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                jobId: {
                  allOf: [
                    {
                      description: 'The unique id of the job to update.';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                title: {
                  type: 'string';
                  example: 'Software Engineer';
                  description: 'A new title for the job.';
                };
                teamId: {
                  allOf: [
                    {
                      description: 'The new team to associate with the job.';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                locationId: {
                  allOf: [
                    {
                      description: 'The new location to associate with the job.';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                defaultInterviewPlanId: {
                  allOf: [
                    {
                      description: 'The new default interview plan to associate with the job.';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                customRequisitionId: {
                  allOf: [
                    {
                      description: 'The new default custom requisition id for the job.';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
              };
              required: ['jobId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the job.update endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/jobCreate/post/requestBody/content/application~1json/schema/properties/data/properties/job';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/job.search': {
    post: {
      summary: 'job.search';
      operationId: 'jobSearch';
      description: 'Searches for jobs by title\n\n**Requires the [`jobsRead`](authentication#permissions-jobsearch) permission.**\n';
      tags: ['Job'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                title: {
                  type: 'string';
                  example: 'Software Engineer';
                  description: 'The title of the job to search for';
                };
              };
              required: ['title'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the job.search endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/webhooks/jobCreate/post/requestBody/content/application~1json/schema/properties/data/properties/job';
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/jobBoard.list': {
    post: {
      summary: 'jobBoard.list';
      description: 'List all enabled job boards.\n\n**Requires the [`jobsRead`](authentication#permissions-jobboardlist) permission.**\n';
      operationId: 'jobBoardList';
      tags: ['Job Board'];
      responses: {
        '200': {
          description: 'Responses for the jobBoard.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              allOf: [
                                {
                                  type: 'object';
                                  properties: {
                                    id: {
                                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                    };
                                    title: {
                                      type: 'string';
                                    };
                                    isInternal: {
                                      type: 'boolean';
                                      description: 'Whether the job board is an internal board.';
                                    };
                                  };
                                  required: ['id', 'title', 'isInternal'];
                                },
                              ];
                            };
                          };
                        };
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/jobInterviewPlan.info': {
    post: {
      summary: 'jobInterviewPlan.info';
      operationId: 'jobInterviewPlanInfo';
      description: "Returns a job's interview plan, including activities and interviews that need to be scheduled at each stage\n\n**Requires the [`jobsRead`](authentication#permissions-jobinterviewplaninfo) permission.**\n";
      tags: ['Job Interview Plan'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                jobId: {
                  allOf: [
                    {
                      description: 'The id of the job to fetch an interview plan for';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
              };
              required: ['jobId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the jobInterviewPlan.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              jobId: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                              interviewPlanId: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                              stages: {
                                type: 'array';
                                items: {
                                  allOf: [
                                    {
                                      $ref: '#/paths/~1interviewStage.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/allOf/0';
                                    },
                                    {
                                      type: 'object';
                                      properties: {
                                        activities: {
                                          type: 'array';
                                          items: {
                                            type: 'object';
                                            properties: {
                                              id: {
                                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                              };
                                              title: {
                                                type: 'string';
                                                example: 'Onsite Schedule';
                                              };
                                              interviews: {
                                                type: 'array';
                                                items: {
                                                  type: 'object';
                                                  properties: {
                                                    id: {
                                                      allOf: [
                                                        {
                                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                                        },
                                                      ];
                                                    };
                                                    title: {
                                                      type: 'string';
                                                      example: 'System Architecture';
                                                    };
                                                    interviewId: {
                                                      allOf: [
                                                        {
                                                          description: 'The id of the interview to be scheduled';
                                                        },
                                                        {
                                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                                        },
                                                      ];
                                                    };
                                                    interviewDurationMinutes: {
                                                      type: 'number';
                                                      example: 30;
                                                    };
                                                    isSchedulable: {
                                                      type: 'boolean';
                                                      example: true;
                                                    };
                                                  };
                                                };
                                              };
                                            };
                                            required: ['id', 'interviews'];
                                          };
                                        };
                                      };
                                      required: ['activities'];
                                    },
                                  ];
                                };
                              };
                            };
                            description: 'A plan for conducting job interviews.';
                            required: ['jobId', 'interviewPlanId', 'stages'];
                          };
                        };
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/jobPosting.info': {
    post: {
      summary: 'jobPosting.info';
      description: 'Retrieve an individual job posting\n\n**Requires the [`jobsRead`](authentication#permissions-jobpostinginfo) permission.**\n\nResult fields:\n- `linkedData` - Object that can be used to populate "rich results" in search engines. [See more info here](https://developers.google.com/search/docs/data-types/job-posting).\n- `applicationFormDefinition` -\tSee the guide on [Creating a custom careers page](https://developers.ashbyhq.com/docs/creating-a-custom-careers-page).\n';
      operationId: 'jobPostingInfo';
      tags: ['Job Posting'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                jobPostingId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the job posting to return';
                    },
                  ];
                };
                expand: {
                  type: 'array';
                  description: 'Choose to expand the result and include additional data for related objects. \n';
                  items: {
                    type: 'string';
                    enum: ['job'];
                  };
                };
              };
              required: ['jobPostingId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the jobPosting.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            properties: {
                              id: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                  {
                                    description: "The job posting's id";
                                  },
                                ];
                              };
                              title: {
                                type: 'string';
                                description: "The job posting's title";
                                example: 'Posting Title';
                              };
                              descriptionPlain: {
                                type: 'string';
                                description: "A plaintext version of the job posting's description";
                                example: 'This example role will be part of an example team and will report to the example manager. The new hire plays a critical role in various example workflows.\n\n\n\nREQUIREMENTS\n\n - Experience writing good example job descriptions\n\n - Other exemplary skills\n\n - 3-5 years prior experience in this role\n\n - Motivation\n\n - Great english language skills\n   \n\n\nABOUT THE TEAM\n\n\nExample org is a leading software company. Example org allows real-time collaboration on important example workflows. Founded in 2012 we have over 10,000 customers worldwide and are backed by fantastic investors such as Sequoia Capital.\n\n';
                              };
                              descriptionHtml: {
                                type: 'string';
                                description: "An HTML version of the job posting's description";
                                example: '<p style="min-height:1.5em">This example role will be part of an example team and will report to the example manager. The new hire plays a critical role in various example workflows.</p><h1><br />Requirements</h1><ul style="min-height:1.5em"><li><p style="min-height:1.5em">Experience writing good example job descriptions</p></li><li><p style="min-height:1.5em">Other exemplary skills</p></li><li><p style="min-height:1.5em">3-5 years prior experience in this role</p></li><li><p style="min-height:1.5em">Motivation</p></li><li><p style="min-height:1.5em">Great english language skills<br /></p></li></ul><h1>About the Team</h1><p style="min-height:1.5em"><br />Example org is a leading software company. Example org allows real-time collaboration on important example workflows. Founded in 2012 we have over 10,000 customers worldwide and are backed by fantastic investors such as Sequoia Capital.</p><p style="min-height:1.5em"></p>';
                              };
                              descriptionSocial: {
                                type: 'string';
                                description: 'A shortened job posting description displayed when shared on social media, limited to 200 characters.';
                                example: 'Example org allows real-time collaboration on important example workflows. When you join as an example role, part of the example team, you will perform a critical role in various example workflows.';
                              };
                              descriptionParts: {
                                type: 'object';
                                description: "The above description broken down into the actual description on the job, and the Job Post Description Opening and Closing that is set by the admin in Ashby's Job Boards → Theme → Messaging settings.";
                                properties: {
                                  descriptionOpening: {
                                    allOf: [
                                      {
                                        $ref: '#/paths/~1jobPosting.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/descriptionParts/properties/descriptionBody/allOf/0';
                                      },
                                      {
                                        description: 'The content set in the Job Post Description Opening theme settings';
                                      },
                                      {
                                        properties: {
                                          html: {
                                            description: 'An HTML version of the Job Post Description Opening theme settings';
                                            example: null;
                                          };
                                          plain: {
                                            description: 'A plaintext version of the Job Post Description Opening theme settings';
                                            example: null;
                                          };
                                        };
                                      },
                                    ];
                                  };
                                  descriptionBody: {
                                    allOf: [
                                      {
                                        type: 'object';
                                        properties: {
                                          html: {
                                            type: 'string';
                                          };
                                          plain: {
                                            type: 'string';
                                          };
                                        };
                                        required: ['html', 'plain'];
                                      },
                                      {
                                        description: 'The description set on the job posting';
                                      },
                                      {
                                        properties: {
                                          html: {
                                            description: 'An HTML version of the description set on the job posting';
                                            example: '<p style="min-height:1.5em">This example role will be part of an example team and will report to the example manager. The new hire plays a critical role in various example workflows.</p><h1><br />Requirements</h1><ul style="min-height:1.5em"><li><p style="min-height:1.5em">Experience writing good example job descriptions</p></li><li><p style="min-height:1.5em">Other exemplary skills</p></li><li><p style="min-height:1.5em">3-5 years prior experience in this role</p></li><li><p style="min-height:1.5em">Motivation</p></li><li><p style="min-height:1.5em">Great english language skills<br /></p></li></ul></p>';
                                          };
                                          plain: {
                                            description: 'An plaintext version of the description set on the job posting';
                                            example: 'This example role will be part of an example team and will report to the example manager. The new hire plays a critical role in various example workflows.\\n\\n\\n\\nREQUIREMENTS\\n\\n - Experience writing good example job descriptions\\n\\n - Other exemplary skills\\n\\n - 3-5 years prior experience in this role\\n\\n - Motivation\\n\\n - Great english language skills\\n';
                                          };
                                        };
                                      },
                                    ];
                                  };
                                  descriptionClosing: {
                                    allOf: [
                                      {
                                        $ref: '#/paths/~1jobPosting.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/descriptionParts/properties/descriptionBody/allOf/0';
                                      },
                                      {
                                        description: 'The content set in the Job Post Description Closing theme settings';
                                      },
                                      {
                                        properties: {
                                          html: {
                                            description: 'An HTML version of the Job Post Description Closing theme settings';
                                            example: '<h1>About the Team</h1><p style="min-height:1.5em"><br />Example org is a leading software company. Example org allows real-time collaboration on important example workflows. Founded in 2012 we have over 10,000 customers worldwide and are backed by fantastic investors such as Sequoia Capital.</p>';
                                          };
                                          plain: {
                                            description: 'A plaintext version of the Job Post Description Closing theme settings';
                                            example: 'ABOUT THE TEAM\\n\\n\\nExample org is a leading software company. Example org allows real-time collaboration on important example workflows. Founded in 2012 we have over 10,000 customers worldwide and are backed by fantastic investors such as Sequoia Capital.\\n\\n';
                                          };
                                        };
                                      },
                                    ];
                                  };
                                };
                                required: ['description'];
                              };
                              departmentName: {
                                type: 'string';
                                example: 'People';
                                description: 'The name of the department associated with the job posting';
                              };
                              teamName: {
                                type: 'string';
                                example: 'Recruiting Operations';
                                description: 'The name of the team associated with the job posting';
                              };
                              teamNameHierarchy: {
                                type: 'array';
                                items: {
                                  type: 'string';
                                };
                                example: ['People', 'Recruiting', 'Recruiting Operations'];
                                description: 'The hierarchy of team names associated with the job posting.';
                              };
                              jobId: {
                                allOf: [
                                  {
                                    description: 'The id of the job associated with the job posting';
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                              locationName: {
                                type: 'string';
                                example: 'Springfield';
                                description: 'The name of the primary location associated with the job posting';
                              };
                              locationIds: {
                                $ref: '#/webhooks/jobPostingUpdate/post/requestBody/content/application~1json/schema/properties/data/properties/jobPosting/properties/locationIds';
                              };
                              linkedData: {
                                type: 'object';
                                description: 'An object that can be used to populate "rich results" in search engines. (https://developers.google.com/search/docs/data-types/job-posting)';
                                properties: {
                                  '@context': {
                                    type: 'string';
                                    example: 'https://schema.org/';
                                  };
                                  '@type': {
                                    type: 'string';
                                    example: 'JobPosting';
                                  };
                                  title: {
                                    type: 'string';
                                    example: 'Posting Title';
                                  };
                                  description: {
                                    type: 'string';
                                    example: '<p style="min-height:1.5em">This example role will be part of an example team and will report to the example manager. The new hire plays a critical role in various example workflows.</p><h1><br />Requirements</h1><ul style="min-height:1.5em"><li><p style="min-height:1.5em">Experience writing good example job descriptions</p></li><li><p style="min-height:1.5em">Other exemplary skills</p></li><li><p style="min-height:1.5em">3-5 years prior experience in this role</p></li><li><p style="min-height:1.5em">Motivation</p></li><li><p style="min-height:1.5em">Great english language skills<br /></p></li></ul><h1>About the Team</h1><p style="min-height:1.5em"><br />Example org is a leading software company. Example org allows real-time collaboration on important example workflows. Founded in 2012 we have over 10,000 customers worldwide and are backed by fantastic investors such as Sequoia Capital.</p><p style="min-height:1.5em"></p>';
                                  };
                                  identifier: {
                                    type: 'object';
                                    properties: {
                                      '@type': {
                                        type: 'string';
                                        example: 'PropertyValue';
                                      };
                                      name: {
                                        type: 'string';
                                        example: 'Posting Title';
                                      };
                                      value: {
                                        type: 'string';
                                        example: '4be0e8c0-9323-43a0-ab48-506789ab9c16';
                                      };
                                    };
                                  };
                                  datePosted: {
                                    type: 'string';
                                    example: '2022-07-22';
                                  };
                                  hiringOrganization: {
                                    type: 'object';
                                    properties: {
                                      '@type': {
                                        type: 'string';
                                        example: 'Organization';
                                      };
                                      name: {
                                        type: 'string';
                                        example: 'Example org';
                                      };
                                      sameAs: {
                                        type: 'string';
                                        example: '34d7c77d-e9b2-5a09-a882-cb23a225f2ec.com';
                                      };
                                    };
                                  };
                                  jobLocation: {
                                    type: 'object';
                                    properties: {
                                      '@type': {
                                        type: 'string';
                                        example: 'Place';
                                      };
                                      address: {
                                        type: 'object';
                                        properties: {
                                          '@type': {
                                            type: 'string';
                                            example: 'PostalAddress';
                                          };
                                        };
                                      };
                                    };
                                  };
                                  employmentType: {
                                    type: 'string';
                                    example: 'FULL_TIME';
                                  };
                                };
                              };
                              publishedDate: {
                                type: 'string';
                                example: '2022-07-22';
                                description: 'The date the job posting was published';
                              };
                              applicationDeadline: {
                                type: 'string';
                                example: '2024-08-12T20:00:00.000Z';
                                format: 'date';
                                description: 'The date and time when applications will no longer be accepted';
                              };
                              address: {
                                allOf: [
                                  {
                                    description: 'The address of the job posting';
                                  },
                                  {
                                    $ref: '#/paths/~1location.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/address';
                                  },
                                ];
                              };
                              isRemote: {
                                type: 'boolean';
                              };
                              employmentType: {
                                $ref: '#/webhooks/jobPostingUpdate/post/requestBody/content/application~1json/schema/properties/data/properties/jobPosting/properties/employmentType';
                              };
                              applicationFormDefinition: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1offer.start/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/formDefinition';
                                  },
                                  {
                                    description: 'See the guide on Creating a custom careers page (https://developers.ashbyhq.com/docs/creating-a-custom-careers-page)';
                                  },
                                ];
                              };
                              isListed: {
                                type: 'boolean';
                                example: true;
                                description: 'Whether or not the job posting is listed';
                              };
                              externalLink: {
                                type: 'string';
                                example: 'https://jobs.ashbyhq.com/70b51cc4-7f34-5567-92bd-96f354f7439a/4be0e8c0-9323-43a0-ab48-506789ab9c16';
                                description: 'The external link to the job posting. Will be null if the job posting is on an internal job board.';
                              };
                              applyLink: {
                                type: 'string';
                                example: 'https://jobs.ashbyhq.com/6eec82ac-9713-512d-ac2e-405618935375/d5a6bc97-4259-4bc5-b3fe-6d3edfd538e3';
                                description: 'The link to apply to the job posting. Will be to the public job board if the job posting is on an external job board, or to the internal job board if the job posting is on an internal job board.';
                              };
                              compensation: {
                                type: 'object';
                                description: 'Compensation ranges associated with the job posting and related settings';
                                required: ['compensationTiers', 'shouldDisplayCompensationOnJobBoard'];
                                properties: {
                                  compensationTierSummary: {
                                    type: 'string';
                                    example: '$72K – $270K • 1% – 2.25% • Offers Bonus • Multiple Ranges';
                                    description: "A summary of *all* the job posting's valid `compensationTiers` in the same format shown on\nAshby-hosted Job Boards\n";
                                  };
                                  summaryComponents: {
                                    type: 'array';
                                    items: {
                                      type: 'object';
                                      description: 'A part of a compensation tier that represents one specific type of compensation, e.g. the "Salary"\nor the "Bonus."\n';
                                      properties: {
                                        summary: {
                                          type: 'string';
                                          example: '€72K – €100K';
                                          description: 'The summary of this component in the same format shown on Ashby-hosted Job Boards';
                                        };
                                        compensationType: {
                                          type: 'string';
                                          enum: [
                                            'Salary',
                                            'EquityPercentage',
                                            'EquityCashValue',
                                            'Commission',
                                            'Bonus',
                                          ];
                                          example: 'Salary';
                                          description: 'The type of compensation this component represents\n';
                                        };
                                        interval: {
                                          type: 'string';
                                          enum: [
                                            'NONE',
                                            '1 TIME',
                                            '1 HOUR',
                                            '1 DAY',
                                            '1 WEEK',
                                            '2 WEEK',
                                            '1 MONTH',
                                            '1 YEAR',
                                            '6 MONTH',
                                            '0.5 MONTH',
                                            '3 MONTH',
                                          ];
                                          example: '1 YEAR';
                                          description: 'The frequency at which this compensation is given';
                                        };
                                        currencyCode: {
                                          type: 'string';
                                          example: 'EUR';
                                          description: 'For non `EquityPercentage` components, the [ISO 4217](https://en.wikipedia.org/wiki/ISO_4217)\ncurrency code of the compensation range\n';
                                        };
                                        label: {
                                          type: 'string';
                                          example: 'Estimated Salary';
                                          description: 'An optional label that describes this compensation range to applicants';
                                        };
                                        minValue: {
                                          type: 'number';
                                          example: 72000.1;
                                          description: 'The lower end of the compensation range';
                                        };
                                        maxValue: {
                                          type: 'number';
                                          example: 100000;
                                          description: 'The higher end of the compensation range';
                                        };
                                      };
                                      required: ['compensationType', 'interval', 'summary'];
                                    };
                                    description: "The maximum and minimum compensation ranges across *all* the posting's `compensationTiers`\nthat make up `compensationTierSummary`\n";
                                    example: [
                                      {
                                        summary: '€72K – €270K';
                                        componentType: 'Salary';
                                        interval: '1 YEAR';
                                        currencyCode: 'EUR';
                                        minValue: 72023.45;
                                        maxValue: 270450;
                                      },
                                      {
                                        summary: '1% – 2.25%';
                                        componentType: 'EquityPercentage';
                                        interval: 'NONE';
                                        minValue: 1;
                                        maxValue: 2.25;
                                      },
                                      {
                                        summary: 'Offers Bonus';
                                        componentType: 'Bonus';
                                        interval: '1 YEAR';
                                        minValue: null;
                                        maxValue: null;
                                      },
                                    ];
                                  };
                                  compensationTiers: {
                                    type: 'array';
                                    items: {
                                      type: 'object';
                                      description: 'A compensation range that can be offered to candidates';
                                      properties: {
                                        id: {
                                          allOf: [
                                            {
                                              $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                            },
                                            {
                                              description: "The compensation tier's unique id";
                                            },
                                          ];
                                        };
                                        title: {
                                          type: 'string';
                                          example: 'Zone A';
                                          description: 'A label that describes the entire range to applicants';
                                        };
                                        additionalInformation: {
                                          type: 'string';
                                          example: 'Signing bonus available';
                                          description: 'Supplementary information about the compensation';
                                        };
                                        components: {
                                          type: 'array';
                                          items: {
                                            type: 'object';
                                            description: 'A part of a compensation tier that represents one specific type of compensation, e.g. the "Salary"\nor the "Bonus."\n';
                                            properties: {
                                              id: {
                                                allOf: [
                                                  {
                                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                                  },
                                                  {
                                                    description: "The component's unique id";
                                                  },
                                                ];
                                              };
                                            };
                                            allOf: [
                                              {
                                                $ref: '#/paths/~1jobPosting.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/compensation/properties/summaryComponents/items';
                                              },
                                            ];
                                            required: ['id'];
                                          };
                                          description: 'The individual components that make up this compensation range';
                                          example: [
                                            {
                                              id: 'fb8efeaa-bea1-4713-9012-cbd25fc3dc89';
                                              summary: '€72K – €100K';
                                              componentType: 'Salary';
                                              interval: '1 YEAR';
                                              currencyCode: 'EUR';
                                              minValue: 72023.45;
                                              maxValue: 100000;
                                            },
                                            {
                                              id: '93c62578-ed5d-42dd-8186-64ad5ba5603d';
                                              summary: '1% – 2.511%';
                                              componentType: 'EquityPercentage';
                                              interval: 'NONE';
                                              minValue: 1;
                                              maxValue: 2.511;
                                            },
                                            {
                                              id: null;
                                              summary: 'Offers Bonus';
                                              componentType: 'Bonus';
                                              interval: '1 YEAR';
                                              minValue: null;
                                              maxValue: null;
                                            },
                                          ];
                                        };
                                        tierSummary: {
                                          type: 'string';
                                          example: '€72K – €100K • 1% – 2.511% • Offers Bonus';
                                          description: "A summary of the tiers's components in the same format shown on Ashby-hosted Job Boards\n";
                                        };
                                      };
                                      required: ['id', 'components', 'tierSummary'];
                                    };
                                    description: 'The compensation ranges that can be offered to applicants for this posting';
                                    example: [
                                      {
                                        id: 'da53719f-a115-400b-9d30-9b875428f1e7';
                                        title: 'Zone A';
                                        additionalInformation: null;
                                        components: [
                                          {
                                            id: 'fb8efeaa-bea1-4713-9012-cbd25fc3dc89';
                                            summary: '€72K – €100K';
                                            componentType: 'Salary';
                                            interval: '1 YEAR';
                                            currencyCode: 'EUR';
                                            minValue: 72023.45;
                                            maxValue: 100000;
                                          },
                                          {
                                            id: '93c62578-ed5d-42dd-8186-64ad5ba5603d';
                                            summary: '1% – 1.4%';
                                            componentType: 'EquityPercentage';
                                            interval: 'NONE';
                                            minValue: 1;
                                            maxValue: 1.4;
                                          },
                                        ];
                                        tierSummary: '€72K – €100K • 1% – 1.4%';
                                      },
                                      {
                                        id: '81362ab1-739e-44f5-88d9-dbc5c731624c';
                                        title: 'Zone B';
                                        additionalInformation: 'Commuter Benefits';
                                        components: [
                                          {
                                            id: 'fb8efeaa-bea1-4713-9012-cbd25fc3dc89';
                                            summary: '€72K – €100K';
                                            componentType: 'Salary';
                                            interval: '1 YEAR';
                                            currencyCode: 'EUR';
                                            minValue: 95010.12;
                                            maxValue: 270450;
                                          },
                                          {
                                            id: '93c62578-ed5d-42dd-8186-64ad5ba5603d';
                                            summary: '1.8% – 2.511%';
                                            componentType: 'EquityPercentage';
                                            interval: 'NONE';
                                            minValue: 1.8;
                                            maxValue: 2.511;
                                          },
                                          {
                                            id: null;
                                            summary: 'Offers Bonus';
                                            componentType: 'Bonus';
                                            interval: '1 YEAR';
                                            minValue: null;
                                            maxValue: null;
                                          },
                                        ];
                                        tierSummary: '€95K – €270K • 1.8% – 2.511% • Offers Bonus • Commuter Benefits';
                                      },
                                    ];
                                  };
                                  shouldDisplayCompensationOnJobBoard: {
                                    type: 'boolean';
                                    example: true;
                                    description: "Whether the job posting's settings specify that compensation should be shown to applicants\n";
                                  };
                                };
                              };
                              updatedAt: {
                                $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                              };
                              applicationLimitCalloutHtml: {
                                type: 'string';
                                description: 'An HTML version of any communication you would like to show to applicants about the application limit for this job posting';
                                example: '<div>\n  <p>Please Note: we have set up limits for applications for this role. It is in the <strong>Product Limit </strong> group. The following limits apply to applications for all jobs within this group:</p>\n  <ul>\n    <li>\n      <p>Candidates may not apply more than 1 time in any 60 day span for any job in the <strong>Product Limit </strong> Group.</p>\n    </li>\n  </ul>\n</div>\n';
                              };
                            };
                            required: [
                              'id',
                              'title',
                              'descriptionPlain',
                              'descriptionHtml',
                              'descriptionParts',
                              'departmentName',
                              'teamName',
                              'jobId',
                              'locationName',
                              'locationIds',
                              'linkedData',
                              'publishedDate',
                              'employmentType',
                              'applicationFormDefiniton',
                              'isListed',
                              'applyLink',
                              'compensation',
                              'updatedAt',
                            ];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/jobPosting.list': {
    post: {
      summary: 'jobPosting.list';
      description: 'Lists all published job postings\n\n**Requires the [`jobsRead`](authentication#permissions-jobpostinglist) permission.**\n\n**Important**: By default, this endpoint includes all listed and unlisted job postings. Unlisted job postings should not be displayed publicly. \nIf you are using the API to publicly expose job postings, set the `listedOnly` parameter to `true` when calling this API so that you only fetch listed job postings that can be displayed publicly.\n';
      operationId: 'jobPostingList';
      tags: ['Job Posting'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                location: {
                  type: 'string';
                  description: 'filter by location name (case sensitive)';
                };
                department: {
                  type: 'string';
                  description: 'filter by department name (case sensitive)';
                };
                listedOnly: {
                  type: 'boolean';
                  description: 'If true, filter out unlisted job postings.';
                  default: false;
                };
                jobBoardId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'If provided, only returns the job postings on the specified job board.  If omitted, this API will return the job postings on the primary external job board.';
                    },
                  ];
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the jobPosting.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/webhooks/jobPostingUpdate/post/requestBody/content/application~1json/schema/properties/data/properties/jobPosting';
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/jobPosting.update': {
    post: {
      summary: 'jobPosting.update';
      operationId: 'jobPostingUpdate';
      description: 'Updates an existing job posting.\n\n**Requires the [`jobsWrite`](authentication#permissions-jobpostingupdate) permission.**\n\n**Note on updating the description**: The `descriptionHtml` field returned in `jobPosting.info` may contain content that is not modifiable through the API. Only the content of the `descriptionParts.descriptionBody` field of the `jobPosting.info` endpoint is modifiable through this call.\n';
      tags: ['Job Posting'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                jobPostingId: {
                  allOf: [
                    {
                      description: 'The unique id of the job posting to update.';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                title: {
                  type: 'string';
                  example: 'Software Engineer';
                  description: 'A new title for the job posting.';
                };
                description: {
                  type: 'object';
                  description: 'An HTML block of the job posting description. Please see below for supported tags.\n\n**Note**: The `descriptionHtml` field returned in `jobPosting.info` may contain content that is not modifiable through the API. Only the content of the `descriptionParts.descriptionBody` field of the `jobPosting.info` endpoint is modifiable through this call.\n';
                  properties: {
                    type: {
                      type: 'string';
                      enum: ['text/html'];
                    };
                    content: {
                      type: 'string';
                      description: 'The HTML content of the Job Posting. The following tags will accept updates. Updates to any other tags will be stripped out or not applied. \n- Headings - `<h[1-6]>`\n- Bold - `<b>`\n- Italic - `<i>`\n- Underline - `<u>`\n- Links - `<a>`\n- Bulleted Lists - `<ul>`, `<li>`\n- Ordered Lists - `<ol>`, `<li>`\n- Code - `<code>`\n- Code blocks - `<pre>`\n';
                    };
                  };
                  required: ['type', 'content'];
                };
              };
              required: ['jobPostingId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the jobPosting.update endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1jobPosting.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/location.create': {
    post: {
      summary: 'location.create';
      description: 'Creates a location or location hierarchy.\n\n**Requires the [`organizationWrite`](authentication#permissions-locationcreate) permission.**\n';
      operationId: 'locationcreate';
      tags: ['Location'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['name', 'type'];
              properties: {
                name: {
                  type: 'string';
                  description: 'The name of the location';
                };
                type: {
                  type: 'string';
                  description: 'A Location represents an actual location that jobs and employees can be associated with. A Location Hierarchy is a grouping of locations or other location hierarchies.';
                  enum: ['Location', 'LocationHierarchy'];
                };
                address: {
                  type: 'object';
                  description: 'The address of the location';
                  properties: {
                    postalAddress: {
                      type: 'object';
                      properties: {
                        addressCountry: {
                          type: 'string';
                          description: 'The country the location is in. Must be a valid country name or two-letter country code.';
                        };
                        addressRegion: {
                          type: 'string';
                          description: 'The region the location is in (for instance, a state or province)';
                        };
                        addressLocality: {
                          type: 'string';
                          description: 'The city or town of the location';
                        };
                      };
                    };
                  };
                };
                parentLocationId: {
                  type: 'string';
                  description: "The id of the location's parent";
                };
                isRemote: {
                  type: 'boolean';
                  description: 'Whether the location should be labeled as remote. LocationHierarchies cannot be labeled as remote.';
                  default: false;
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the location.create endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1location.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/location.info': {
    post: {
      summary: 'location.info';
      description: 'Gets details for a single location by id.\n\n**Requires the [`organizationRead`](authentication#permissions-locationinfo) permission.**\n';
      operationId: 'locationInfo';
      tags: ['Location'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                locationId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the location to fetch';
                    },
                  ];
                };
              };
              required: ['locationId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the location.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                              };
                              name: {
                                type: 'string';
                                example: 'Bay Area Office';
                              };
                              isArchived: {
                                $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived';
                              };
                              address: {
                                type: 'object';
                                properties: {
                                  postalAddress: {
                                    type: 'object';
                                    properties: {
                                      addressCountry: {
                                        type: 'string';
                                        example: 'United States';
                                      };
                                      addressRegion: {
                                        type: 'string';
                                        example: 'California';
                                      };
                                      addressLocality: {
                                        type: 'string';
                                        example: 'San Francisco';
                                      };
                                    };
                                  };
                                };
                              };
                              isRemote: {
                                type: 'boolean';
                                example: false;
                              };
                              parentLocationId: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                              };
                              type: {
                                type: 'enum';
                                enum: ['Location', 'LocationHierarchy'];
                                description: 'The type of the location component.';
                                example: 'Location';
                              };
                            };
                            required: ['id', 'name', 'isArchived'];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/location.list': {
    post: {
      summary: 'location.list';
      description: 'List all locations. Regions are not returned.\n\n**Requires the [`organizationRead`](authentication#permissions-locationlist) permission.**\n';
      operationId: 'locationlist';
      tags: ['Location'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                includeArchived: {
                  $ref: '#/paths/~1source.list/post/requestBody/content/application~1json/schema/properties/includeArchived';
                };
                includeLocationHierarchy: {
                  type: 'boolean';
                  description: 'If true, the response will include the location hierarchy (regions).\n';
                  default: false;
                  example: false;
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the location.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/paths/~1location.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                            };
                          };
                          moreDataAvailable: {
                            $ref: '#/paths/~1source.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/moreDataAvailable';
                          };
                        };
                      },
                      {
                        required: ['results', 'moreDataAvailable'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/offer.create': {
    post: {
      summary: 'offer.create';
      operationId: 'offerCreate';
      description: "Creates a new Offer\n\n**Requires the [`offersWrite`](authentication#permissions-offercreate) permission.**\n\nOffer forms support a variety of field types. The values accepted for each field depend on the type of field that's being filled out:\n- `Boolean` - A boolean value.\n- `Currency` - An object in the format `{ currencyCode: \"USD\", value: 100000 }` where currencyCode is a valid ISO 4217 currency code and value is an integer.\n- `Date` - A valid ISO Date string.\n- `Number` - An integer.\n- `String` - A string.\n- `ValueSelect` - A string that matches the value of one of the ValueSelect field's selectable options.\n- `MultiValueSelect` - An array of strings that exist in the MultiValueSelect field's selectable options.\n";
      tags: ['Offer'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                offerProcessId: {
                  allOf: [
                    {
                      description: "The id of the offer process associated with the offer you're creating. \nThis value is the id included in the response of the `offerProcess.start` API.\n";
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                offerFormId: {
                  allOf: [
                    {
                      description: 'The id of the form associated with the offer.\nThis value is the id included in the response of the `offer.start` API.\n';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                offerForm: {
                  type: 'object';
                  properties: {
                    fieldSubmissions: {
                      type: 'array';
                      items: {
                        properties: {
                          path: {
                            type: 'string';
                            description: 'The form field\'s "path" value';
                          };
                          value: {
                            type: 'string';
                            description: 'This is often a primitive but the value depends on the type of field being submitted. See the description above for details on the values accepted in this field.';
                          };
                        };
                        required: ['path', 'value'];
                      };
                    };
                  };
                  required: ['fieldSubmissions'];
                };
              };
              required: ['offerProcessId', 'offerFormId', 'offerForm'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the offer.create endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/offerCreate/post/requestBody/content/application~1json/schema/properties/data/properties/offer';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/offer.info': {
    post: {
      summary: 'offer.info';
      operationId: 'offerInfo';
      description: 'Returns details about a single offer by id\n\n**Requires the [`offersRead`](authentication#permissions-offerinfo) permission.**\n';
      tags: ['Offer'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                offerId: {
                  allOf: [
                    {
                      description: 'The id of the offer to fetch';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
              };
              required: ['offerId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the offer.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                        properties: {
                          results: {
                            $ref: '#/webhooks/offerCreate/post/requestBody/content/application~1json/schema/properties/data/properties/offer';
                          };
                        };
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/offer.list': {
    post: {
      summary: 'offer.list';
      description: 'Get a list of all offers with their latest version\n\n**Requires the [`offersRead`](authentication#permissions-offerlist) permission.**\n';
      operationId: 'offerList';
      tags: ['Offer'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema';
                },
                {
                  type: 'object';
                  properties: {
                    applicationId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                        {
                          description: 'If provided, only returns the offers for the application with the supplied id';
                        },
                      ];
                    };
                  };
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the offer.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/webhooks/offerCreate/post/requestBody/content/application~1json/schema/properties/data/properties/offer';
                            };
                          };
                        };
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/offer.start': {
    post: {
      summary: 'offer.start';
      operationId: 'offerStart';
      description: 'The offer.start endpoint creates and returns an offer version instance that can be filled out and submitted\nusing the `offer.create` endpoint. \n\n**Requires the [`offersWrite`](authentication#permissions-offerstart) permission.**\n\nIn order to create a new offer version for a candidate with an in-progress \noffer process, you can call the `offer.start` endpoint and then call the `offer.create` endpoint to fill out the\nnewly created offer version form.  \n';
      tags: ['Offer'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                offerProcessId: {
                  allOf: [
                    {
                      description: 'The ID of the offer process to start. This value is the id included in the response of the `offerProcess.start` API.';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
              };
              required: ['offerProcessId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the offer.start endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                              };
                              formDefinition: {
                                type: 'object';
                                properties: {
                                  sections: {
                                    type: 'array';
                                    items: {
                                      type: 'object';
                                      properties: {
                                        title: {
                                          type: 'string';
                                        };
                                        descriptionHtml: {
                                          type: 'string';
                                        };
                                        descriptionPlain: {
                                          type: 'string';
                                        };
                                        fields: {
                                          type: 'array';
                                          items: {
                                            type: 'object';
                                            properties: {
                                              isRequired: {
                                                type: 'boolean';
                                                example: true;
                                                default: true;
                                              };
                                              descriptionHtml: {
                                                type: 'string';
                                              };
                                              descriptionPlain: {
                                                type: 'string';
                                              };
                                              field: {
                                                type: 'object';
                                                properties: {
                                                  id: {
                                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                                  };
                                                  type: {
                                                    type: 'string';
                                                    example: 'String';
                                                    description: 'The type of the form definition field.';
                                                  };
                                                  path: {
                                                    type: 'string';
                                                    example: '_systemfield_name';
                                                  };
                                                  humanReadablePath: {
                                                    type: 'string';
                                                    example: 'Name';
                                                  };
                                                  title: {
                                                    type: 'string';
                                                    example: 'Name';
                                                  };
                                                  isNullable: {
                                                    type: 'boolean';
                                                    example: false;
                                                    default: true;
                                                  };
                                                  selectableValues: {
                                                    type: 'object';
                                                    properties: {
                                                      label: {
                                                        type: 'string';
                                                      };
                                                      value: {
                                                        type: 'string';
                                                      };
                                                    };
                                                    required: ['label', 'value'];
                                                  };
                                                };
                                              };
                                            };
                                          };
                                        };
                                      };
                                    };
                                  };
                                };
                              };
                            };
                          };
                        };
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/offerProcess.start': {
    post: {
      summary: 'offerProcess.start';
      operationId: 'offerProcess.start';
      description: 'Starts an offer process for a candidate.\n\n**Requires the [`offersWrite`](authentication#permissions-offerprocessstart) permission.**\n';
      tags: ['Offer Process'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                applicationId: {
                  allOf: [
                    {
                      description: 'The id of the application to start an offer process for';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
              };
              required: ['applicationId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the offerProcess.start endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              id: {
                                allOf: [
                                  {
                                    description: 'The id of the started offer process';
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                              applicationId: {
                                allOf: [
                                  {
                                    description: 'The id of the application the offer process was started for';
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                              status: {
                                description: 'The status of the offer process';
                                type: 'string';
                                enum: [
                                  'WaitingOnOfferCreation',
                                  'WaitingOnApprovalStart',
                                  'WaitingOnOfferApproval',
                                  'WaitingOnCandidateResponse',
                                  'CandidateAccepted',
                                  'CandidateRejected',
                                  'OfferCancelled',
                                ];
                              };
                            };
                            required: ['id', 'applicationId', 'status'];
                          };
                        };
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/opening.info': {
    post: {
      summary: 'opening.info';
      description: 'Retrieves an opening by its UUID.\n      \n**Requires the [`jobsRead`](authentication#permissions-openinginfo) permission.**';
      operationId: 'openinginfo';
      tags: ['Openings'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['openingId'];
              properties: {
                openingId: {
                  type: 'string';
                  description: 'The id of the opening';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the opening.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/opening.list': {
    post: {
      summary: 'opening.list';
      description: 'Lists openings.\n      \n**Requires the [`jobsRead`](authentication#permissions-openinglist) permission.**';
      operationId: 'openinglist';
      tags: ['Openings'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                cursor: {
                  type: 'string';
                  description: 'Opaque cursor indicating which page of results to fetch';
                };
                syncToken: {
                  type: 'string';
                  description: 'Opaque token representing the last time a full set of results was fetched.';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the opening.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening';
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/opening.search': {
    post: {
      summary: 'opening.search';
      description: 'Searches for openings by identifier.\n      \n**Requires the [`jobsRead`](authentication#permissions-openingsearch) permission.**';
      operationId: 'openingsearch';
      tags: ['Openings'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['identifier'];
              properties: {
                identifier: {
                  type: 'string';
                  description: 'The identifier of the opening you want to search for';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the opening.search endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening';
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/opening.create': {
    post: {
      summary: 'opening.create';
      description: 'Creates an opening.\n      \n**Requires the [`jobsWrite`](authentication#permissions-openingcreate) permission.**';
      operationId: 'openingcreate';
      tags: ['Openings'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                identifier: {
                  type: 'string';
                  description: 'jobIds,     targetHireDate,     targetStartDate,     isBackfill,     employmentType,';
                };
                description: {
                  type: 'string';
                };
                teamId: {
                  type: 'string';
                  description: 'The id of the department or team associated with the opening.';
                };
                locationIds: {
                  type: 'array';
                  description: 'The ids of the locations associated with the opening.';
                  items: {
                    type: 'string';
                  };
                };
                jobIds: {
                  type: 'array';
                  description: 'The ids of the jobs associated with the opening';
                  items: {
                    type: 'string';
                  };
                };
                targetHireDate: {
                  type: 'string';
                  description: 'The date (in YYYY-MM-DD format) by which you intend to hire against this opening.';
                };
                targetStartDate: {
                  type: 'string';
                  description: 'The date (in YYYY-MM-DD format) by which you intend someone hired against this opening will start employment.';
                };
                isBackfill: {
                  type: 'boolean';
                  description: 'Whether this opening is intended to backfill a previous employee';
                  default: false;
                };
                employmentType: {
                  type: 'string';
                  description: 'The employment type for this opening';
                  default: 'FullTime';
                  enum: ['FullTime', 'PartTime', 'Intern', 'Contract', 'Temporary', ''];
                };
                openingState: {
                  type: 'string';
                  description: 'The state the opening should be created in.';
                  enum: ['Draft', 'Approved', 'Open', 'Closed'];
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the opening.create endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/opening.addJob': {
    post: {
      summary: 'opening.addJob';
      description: 'Adds a job to an opening.\n      \n**Requires the [`jobsWrite`](authentication#permissions-openingaddjob) permission.**';
      operationId: 'openingaddjob';
      tags: ['Openings'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['openingId', 'jobId'];
              properties: {
                openingId: {
                  type: 'string';
                  description: 'The id of the opening';
                };
                jobId: {
                  type: 'string';
                  description: 'The id of the job to add';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the opening.addJob endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/opening.removeJob': {
    post: {
      summary: 'opening.removeJob';
      description: 'Removes a job from an opening.\n      \n**Requires the [`jobsWrite`](authentication#permissions-openingremovejob) permission.**';
      operationId: 'openingremovejob';
      tags: ['Openings'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['openingId', 'jobId'];
              properties: {
                openingId: {
                  type: 'string';
                  description: 'The id of the opening';
                };
                jobId: {
                  type: 'string';
                  description: 'The id of the job to remove from the opening.';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the opening.removeJob endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/opening.setOpeningState': {
    post: {
      summary: 'opening.setOpeningState';
      description: 'Sets the state of an opening.\n      \n**Requires the [`jobsWrite`](authentication#permissions-openingsetopeningstate) permission.**';
      operationId: 'openingsetopeningstate';
      tags: ['Openings'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                openingId: {
                  type: 'string';
                  description: 'The id of the opening you want to update';
                };
                openingState: {
                  type: 'string';
                  description: 'The new state you want to update the opening to';
                  enum: ['Draft', 'Approved', 'Open', 'Closed'];
                };
                closeReasonId: {
                  type: 'string';
                  description: 'The id of the close reason if you are setting the state to closed';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the opening.setOpeningState endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/opening.setArchived': {
    post: {
      summary: 'opening.setArchived';
      description: 'Sets the archived state of an opening.\n      \n**Requires the [`jobsWrite`](authentication#permissions-openingsetarchived) permission.**';
      operationId: 'openingsetarchived';
      tags: ['Openings'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                openingId: {
                  type: 'string';
                  description: 'The id of the opening you want to archive';
                };
                archive: {
                  type: 'boolean';
                  description: 'The new archived state you want to update the opening to';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the opening.setArchived endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/opening.update': {
    post: {
      summary: 'opening.update';
      description: 'Updates an opening.\n      \n**Requires the [`jobsWrite`](authentication#permissions-openingupdate) permission.**';
      operationId: 'openingupdate';
      tags: ['Openings'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                openingId: {
                  type: 'string';
                  description: 'The openingId of the opening you want to update.';
                };
                identifier: {
                  type: 'string';
                  description: 'jobIds,     targetHireDate,     targetStartDate,     isBackfill,     employmentType,';
                };
                description: {
                  type: 'string';
                };
                teamId: {
                  type: 'string';
                  description: 'The id of the department or team associated with the opening.';
                };
                targetHireDate: {
                  type: 'string';
                  description: 'The date (in YYYY-MM-DD format) by which you intend to hire against this opening.';
                };
                targetStartDate: {
                  type: 'string';
                  description: 'The date (in YYYY-MM-DD format) by which you intend someone hired against this opening will start employment.';
                };
                isBackfill: {
                  type: 'boolean';
                  description: 'Whether this opening is intended to backfill a previous employee';
                  default: false;
                };
                employmentType: {
                  type: 'string';
                  description: 'The employment type for this opening';
                  default: 'FullTime';
                  enum: ['FullTime', 'PartTime', 'Intern', 'Contract', 'Temporary', ''];
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the opening.update endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/project.info': {
    post: {
      summary: 'project.info';
      description: 'Retrieves an project by its UUID.\n      \n**Requires the [`jobsRead`](authentication#permissions-projectinfo) permission.**';
      operationId: 'projectinfo';
      tags: ['Projects'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['projectId'];
              properties: {
                projectId: {
                  type: 'string';
                  description: 'The id of the project';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the project.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                              };
                              title: {
                                type: 'string';
                                example: 'Office Event';
                              };
                              description: {
                                type: 'string';
                                example: 'Folks invited to office for an event';
                              };
                              isArchived: {
                                $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived';
                              };
                              confidential: {
                                type: 'boolean';
                                example: false;
                              };
                              authorId: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                              };
                              createdAt: {
                                $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                              };
                              customFieldEntries: {
                                type: 'array';
                                description: 'All custom field values associated with the project';
                                items: {
                                  $ref: '#/paths/~1customField.setValue/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                                };
                              };
                            };
                            required: ['id', 'title'];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/project.list': {
    post: {
      summary: 'project.list';
      description: 'Lists projects.\n      \n**Requires the [`candidatesRead`](authentication#permissions-projectlist) permission.**';
      operationId: 'projectlist';
      tags: ['Projects'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                cursor: {
                  type: 'string';
                  description: 'Opaque cursor indicating which page of results to fetch';
                  example: 'G8';
                };
                syncToken: {
                  type: 'string';
                  description: 'An opaque token representing the last time the data was successfully synced from the API. A new, updated one is returned after successfully fetching the last page of data.\n';
                  example: 'jYnEBmjzR';
                };
                limit: {
                  type: 'number';
                  description: 'The maximum number of items to return. The maximum and default value is 100.';
                  example: 25;
                };
              };
              example: {
                syncToken: '6W05prn4d';
                cursor: 'qA';
                limit: 25;
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the project.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/paths/~1project.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/project.search': {
    post: {
      summary: 'project.search';
      operationId: 'projectSearch';
      description: 'Search for projects by title. \n\n**Requires the [`candidatesRead`](authentication#permissions-projectsearch) permission.**\n\nResponses are limited to 100 results. Consider refining your search or using /project.list to paginate through all projects, if you approach this limit. This API is for use cases where you intend operate on a final small set of projects, like building a project autocomplete.\n';
      tags: ['Project'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                title: {
                  type: 'string';
                  description: "The project's title";
                };
              };
              example: {
                title: 'My Project';
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the project.search endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/paths/~1project.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/referral.create': {
    post: {
      summary: 'referral.create';
      operationId: 'referralCreate';
      description: 'Creates a referral\n\n**Requires the [`candidatesWrite`](authentication#permissions-referralcreate) permission.**\n';
      tags: ['Referral'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                id: {
                  allOf: [
                    {
                      description: 'The id of the referral form, from /referralForm.info';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                creditedToUserId: {
                  allOf: [
                    {
                      description: 'The id of the user submitting the referral';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                fieldSubmissions: {
                  type: 'array';
                  items: {
                    properties: {
                      path: {
                        type: 'string';
                        description: 'The form field\'s "path" value';
                      };
                      value: {
                        type: 'string';
                        description: 'This is often a primitive but for a referral job, it should be { title: job.title, value: job.id }\n';
                      };
                    };
                    required: ['path', 'value'];
                  };
                };
                createdAt: {
                  allOf: [
                    {
                      description: "An ISO date string to set the referral's createdAt timestamp to. When this value isn't provided, the createdAt timestamp defaults to the time the referral was created.\n";
                    },
                    {
                      $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                    },
                  ];
                };
              };
              required: ['id', 'creditedToUserId', 'fieldSubmissions'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the referral.create endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                        properties: {
                          results: {
                            $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application';
                          };
                        };
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/referralForm.info': {
    post: {
      summary: 'referralForm.info';
      operationId: 'referralFormInfo';
      description: 'Fetches the default referral form or creates a default referral form if none exists.\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-referralforminfo) permission.**\n';
      tags: ['Referral Form'];
      responses: {
        '200': {
          description: 'Responses for the referral.create endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                        properties: {
                          results: {
                            allOf: [
                              {
                                type: 'object';
                                properties: {
                                  id: {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  };
                                  title: {
                                    type: 'string';
                                    description: 'The title of the form';
                                  };
                                  isArchived: {
                                    $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived';
                                  };
                                  formDefinition: {
                                    $ref: '#/paths/~1offer.start/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/formDefinition';
                                  };
                                };
                                required: [
                                  'id',
                                  'organizationId',
                                  'title',
                                  'isArchived',
                                  'isDefaultForm',
                                  'formDefinition',
                                ];
                              },
                              {
                                type: 'object';
                                properties: {
                                  organizationId: {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  };
                                  isDefaultForm: {
                                    type: 'boolean';
                                    example: true;
                                  };
                                };
                              },
                            ];
                          };
                        };
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/source.list': {
    post: {
      summary: 'source.list';
      description: 'List all sources\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-sourcelist) permission.**\n';
      operationId: 'sourcelist';
      tags: ['Source'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                includeArchived: {
                  type: 'boolean';
                  description: 'When true, includes archived items';
                  default: false;
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the source.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              type: 'object';
                              properties: {
                                id: {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                };
                                title: {
                                  type: 'string';
                                  example: 'Applied';
                                };
                                isArchived: {
                                  $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived';
                                };
                                sourceType: {
                                  type: 'object';
                                  properties: {
                                    id: {
                                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                    };
                                    title: {
                                      type: 'string';
                                      example: 'Inbound';
                                    };
                                    isArchived: {
                                      $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived';
                                    };
                                  };
                                  required: ['id', 'title', 'isArchived'];
                                };
                              };
                              required: ['id', 'title', 'isArchived'];
                            };
                          };
                          moreDataAvailable: {
                            type: 'boolean';
                            example: false;
                          };
                        };
                      },
                      {
                        required: ['results', 'moreDataAvailable'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/sourceTrackingLink.list': {
    post: {
      summary: 'sourceTrackingLink.list';
      description: 'List all source custom tracking links\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-sourcetrackinglinklist) permission.**\n';
      operationId: 'sourcetrackinglinklist';
      tags: ['Source Tracking Links'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                includeDisabled: {
                  type: 'boolean';
                  description: 'When true, includes disabled tracking links';
                  default: false;
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the sourceTrackingLink.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              type: 'object';
                              properties: {
                                id: {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                };
                                code: {
                                  type: 'string';
                                  example: 'fx9iL4QtWr';
                                };
                                enabled: {
                                  type: 'boolean';
                                  example: true;
                                };
                                sourceId: {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                };
                                link: {
                                  type: 'string';
                                  example: 'https://jobs.ashbyhq.com/example?utm_source=fx9iL4QtWr';
                                };
                              };
                              required: ['id', 'code', 'enabled', 'sourceId', 'link'];
                            };
                          };
                        };
                      },
                    ];
                    required: ['results'];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/surveyFormDefinition.info': {
    post: {
      summary: 'surveyFormDefinition.info';
      operationId: 'surveyFormDefinitionInfo';
      description: 'Returns details about a single survey form definition by id\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-surveyformdefinitioninfo) permission.**\n';
      tags: ['Survey Form Definition'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                surveyFormDefinitionId: {
                  allOf: [
                    {
                      description: 'The id of the survey form to fetch';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
              };
              required: ['surveyFormDefinitionId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the surveyFormDefinition.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                        properties: {
                          results: {
                            allOf: [
                              {
                                $ref: '#/paths/~1referralForm.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/allOf/0';
                              },
                              {
                                type: 'object';
                                properties: {
                                  surveyType: {
                                    $ref: '#/paths/~1surveySubmission.list/post/requestBody/content/application~1json/schema/allOf/0/properties/surveyType';
                                  };
                                };
                              },
                            ];
                            required: ['id', 'title', 'isArchived', 'formDefinition', 'surveyType'];
                          };
                        };
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/surveyFormDefinition.list': {
    post: {
      summary: 'surveyFormDefinition.list';
      operationId: 'surveyFormDefinitionList';
      description: 'Lists all survey form definitions.\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-surveyformdefinitionlist) permission.**\n';
      tags: ['Survey Form Definition'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the surveyFormDefinition.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/paths/~1surveyFormDefinition.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results';
                            };
                          };
                        };
                      },
                    ];
                    required: ['results'];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/surveyRequest.create': {
    post: {
      summary: 'surveyRequest.create';
      description: 'This endpoint generates a survey request and returns a survey URL. You can send this URL to a candidate to allow them to complete a survey. \n\n**Requires the [`candidatesWrite`](authentication#permissions-surveyrequestcreate) permission.**\n\n**Note that calling this endpoint will not automatically email the survey to the candidate.** It simply creates the request and gives you a URL to share with a candidate.\n';
      operationId: 'surveyRequestCreate';
      tags: ['Survey Request'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['candidateId', 'applicationId', 'surveyFormDefinitionId'];
              properties: {
                candidateId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the candidate to create a survey request for.';
                    },
                  ];
                };
                applicationId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id of the application to associate with the survey request.';
                    },
                  ];
                };
                surveyFormDefinitionId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The ID of the survey form that the candidate will see when they visit the URL returned in the `surveyURL` property of the API response. \nSurvey forms IDs can be obtained using the `surveyFormDefinition.list` endpoint. \n';
                    },
                  ];
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the surveyRequest.create endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              id: {
                                allOf: [
                                  {
                                    description: 'The id of the survey request\n';
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                              candidateId: {
                                allOf: [
                                  {
                                    description: 'The id of the candidate the survey request is for\n';
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                              applicationId: {
                                allOf: [
                                  {
                                    description: 'The id of the application associated with the survey request\n';
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                              surveyFormDefinitionId: {
                                allOf: [
                                  {
                                    description: 'The id of the survey form the candidate will fill out when they take the survey\n';
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                              surveyUrl: {
                                type: 'string';
                                example: 'https://you.ashbyhq.com/ashby/survey/3f20b73e-abec-4d62-ba6f-04f2f985f7dd';
                                description: 'The URL that the candidate can visit to take the survey.\n';
                              };
                            };
                            required: ['id', 'candidateId', 'applicationId', 'surveyFormDefinitionId', 'surveyUrl'];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/surveyRequest.list': {
    post: {
      summary: 'surveyRequest.list';
      description: 'Lists all survey requests\n\n**Requires the [`candidatesRead`](authentication#permissions-surveyRequestList) permission.**\n';
      operationId: 'surveyRequestList';
      tags: ['Survey Request'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema';
                },
                {
                  type: 'object';
                  properties: {
                    surveyType: {
                      allOf: [
                        {
                          description: 'Returns only the survey requests of the given type. Currently, only `CandidateExperience` is supported.';
                        },
                        {
                          type: 'string';
                        },
                        {
                          enum: ['CandidateExperience'];
                        },
                      ];
                    };
                    applicationId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                        {
                          description: 'If provided, only returns the offers for the application with the supplied id';
                        },
                      ];
                    };
                    candidateId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                        },
                        {
                          description: 'If provided, only returns the offers for the candidate with the supplied id';
                        },
                      ];
                    };
                  };
                  required: ['surveyType'];
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the surveyRequest.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/paths/~1surveyRequest.create/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                            };
                          };
                        };
                      },
                    ];
                    required: ['results'];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/surveySubmission.list': {
    post: {
      summary: 'surveySubmission.list';
      operationId: 'surveySubmissionList';
      description: 'Lists all survey submissions of a given `surveyType`.\n\n**Requires the [`candidatesRead`](authentication#permissions-surveySubmissionList) permission.**\n';
      tags: ['Survey Submission'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  type: 'object';
                  description: 'The type of survey submissions to fetch. \n';
                  properties: {
                    surveyType: {
                      type: 'string';
                      enum: ['CandidateDataConsent', 'CandidateExperience', 'Diversity', 'EEOC', 'Questionnaire'];
                    };
                  };
                  required: ['surveyType'];
                },
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema';
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the surveySubmission.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/webhooks/surveySubmit/post/requestBody/content/application~1json/schema/properties/data/properties/surveySubmission';
                            };
                          };
                        };
                      },
                    ];
                    required: ['results'];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/user.info': {
    post: {
      summary: 'user.info';
      description: 'Get an Ashby user by id\n\n**Requires the [`organizationRead`](authentication#permissions-userinfo) permission.**\n';
      operationId: 'userInfo';
      tags: ['User'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                userId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                    {
                      description: 'The id to lookup the user';
                    },
                  ];
                };
              };
              required: ['userId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the user.info endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                              };
                              firstName: {
                                type: 'string';
                                example: 'Test';
                              };
                              lastName: {
                                type: 'string';
                                example: 'User';
                              };
                              email: {
                                $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/email/allOf/0';
                              };
                              globalRole: {
                                type: 'string';
                                enum: ['Organization Admin', 'Elevated Access', 'Limited Access', 'External Recruiter'];
                              };
                              isEnabled: {
                                type: 'boolean';
                              };
                              updatedAt: {
                                $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt';
                              };
                            };
                            required: ['id', 'firstName', 'lastName', 'globalRole', 'isEnabled', 'updatedAt'];
                          };
                        };
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/user.list': {
    post: {
      summary: 'user.list';
      description: "Get a list of all Ashby users\n\n**Requires the [`organizationRead`](authentication#permissions-userlist) permission.**\n\nThe `globalRole` property in the response specifies the user's access level in Ashby.\nFor more details on the permissions granted with each role, see our [documentation here](https://ashbyhq.notion.site/Ashby-Permissions-a48eda7c07ad46f0bcd2b3f39301a9de#c64a4db5e7f4432bbe6691b91d3f0c62).\n";
      operationId: 'userList';
      tags: ['User'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema';
                },
                {
                  type: 'object';
                  properties: {
                    includeDeactivated: {
                      type: 'boolean';
                      default: false;
                      description: 'If set to true, deactivated users are included in the response. \nBy default, deactivated users are not included.\n';
                    };
                  };
                },
              ];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the user.list endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results';
                            };
                          };
                        };
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/user.search': {
    post: {
      summary: 'user.search';
      description: 'Search for an Ashby user by email address\n\n**Requires the [`organizationRead`](authentication#permissions-usersearch) permission.**\n';
      operationId: 'userSearch';
      tags: ['User'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                email: {
                  type: 'string';
                  description: 'The email to use to search for the user';
                  example: 'test@ashbyhq.com';
                };
              };
              required: ['email'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses for the user.search endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                        properties: {
                          results: {
                            type: 'array';
                            items: {
                              $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results';
                            };
                          };
                        };
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    title: 'Error response';
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/webhook.create': {
    post: {
      summary: 'webhook.create';
      description: 'Creates a webhook setting.\n\n**Requires the [`apiKeysWrite`](authentication#permissions-webhookcreate) scope.**\n';
      operationId: 'webhookcreate';
      tags: ['Webhook'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                webhookType: {
                  type: 'string';
                  enum: [
                    'applicationSubmit',
                    'applicationUpdate',
                    'candidateHire',
                    'candidateStageChange',
                    'candidateDelete',
                    'candidateMerge',
                    'interviewPlanTransition',
                    'interviewScheduleCreate',
                    'interviewScheduleUpdate',
                    'jobPostingUpdate',
                    'jobPostingPublish',
                    'jobPostingUnpublish',
                    'offerCreate',
                    'offerUpdate',
                    'offerDelete',
                    'pushToHRIS',
                    'surveySubmit',
                  ];
                };
                requestUrl: {
                  type: 'string';
                  description: 'The URL the webhook will send requests to.';
                };
                secretToken: {
                  type: 'string';
                  description: 'The secret token used to sign the webhook request. See our documentation [here](https://developers.ashbyhq.com/docs/authenticating-webhooks) for more information.\n';
                };
              };
              required: ['webhookType', 'requestUrl', 'secretToken'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the webhook.create endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                              };
                              enabled: {
                                type: 'boolean';
                                description: 'Whether or not the webhook setting is enabled.';
                              };
                              requestUrl: {
                                type: 'string';
                                description: 'The URL the webhook will send requests to.';
                                example: 'https://example.com/webhook';
                              };
                              secretToken: {
                                type: 'string';
                                description: 'The secret token used to sign the webhook request. See our documentation [here](https://developers.ashbyhq.com/docs/authenticating-webhooks) for more information.\n';
                                example: '0c2f9463f87641919f8106a2c49d7a57';
                              };
                              webhookType: {
                                type: 'string';
                                description: 'The type of webhook.';
                                $ref: '#/paths/~1webhook.create/post/requestBody/content/application~1json/schema/properties/webhookType';
                              };
                            };
                            required: ['id', 'enabled', 'requestUrl', 'secretToken', 'webhookType'];
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/webhook.update': {
    post: {
      summary: 'webhook.update';
      description: 'Updates a webhook setting. One of `enabled`, `requestUrl`, or `secretToken` must be provided.\n\n**Requires the [`apiKeysWrite`](authentication#permissions-webhookcreate) permission.**\n';
      operationId: 'webhookupdate';
      tags: ['Webhook'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                webhookId: {
                  allOf: [
                    {
                      description: 'The id of the webhook setting to update.';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
                enabled: {
                  type: 'boolean';
                  description: 'Whether or not the webhook is enabled.';
                };
                requestUrl: {
                  type: 'string';
                  description: 'The URL the webhook will send requests to.';
                };
                secretToken: {
                  type: 'string';
                  description: 'The secret token used to sign the webhook request. See our documentation [here](https://developers.ashbyhq.com/docs/authenticating-webhooks) for more information.\n';
                };
              };
              required: ['webhookId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the webhook.update endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1webhook.create/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results';
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
  '/webhook.delete': {
    post: {
      summary: 'webhook.delete';
      description: 'Deletes a webhook setting.\n\n**Requires the [`apiKeysWrite`](authentication#permissions-webhookcreate) permission.**\n';
      operationId: 'webhookdelete';
      tags: ['Webhook'];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                webhookId: {
                  allOf: [
                    {
                      description: 'The id of the webhook setting to delete.';
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                    },
                  ];
                };
              };
              required: ['webhookId'];
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Responses from the webhook.delete endpoint';
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response';
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0';
                      },
                      {
                        type: 'object';
                      },
                      {
                        properties: {
                          results: {
                            type: 'object';
                            properties: {
                              webhookId: {
                                allOf: [
                                  {
                                    description: 'The id of the webhook setting that was deleted.';
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId';
                                  },
                                ];
                              };
                            };
                          };
                        };
                      },
                      {
                        required: ['results'];
                      },
                    ];
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1';
                  },
                ];
              };
            };
          };
        };
      };
    };
  };
};
export const paths = {
  '/apiKey.info': {
    post: {
      summary: 'apiKey.info',
      description:
        'Retrieve information about the API key being used to make the request.\n\n**Requires the [`apiKeysRead`](authentication#permissions-apikeyinfo) permission.**\n',
      operationId: 'apiKeyInfo',
      tags: ['API Key'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the apiKey.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              title: {
                                type: 'string',
                                description: 'The name of the API key.',
                                example: 'Custom Job Board API key',
                              },
                              createdAt: {
                                $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                              },
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
      security: [
        {
          BasicAuth: [],
        },
      ],
    },
  },
  '/application.change_source': {
    post: {
      summary: 'application.changeSource',
      operationId: 'applicationChangeSource',
      description:
        'Change the source of an application.\n\n**Requires the [`candidatesWrite`](authentication#permissions-applicationchangesource) permission.**\n',
      tags: ['Application'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                applicationId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the application to update the source of',
                    },
                  ],
                },
                sourceId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: "The source to set on the application. Pass null to unset an application's source.",
                    },
                  ],
                },
              },
              required: ['applicationId', 'sourceId'],
              example: {
                applicationId: '3ae2b801-19f6-41ef-ad28-214bd731948f',
                sourceId: '2c6991c5-c9e2-4af8-879e-29c5a9d26509',
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the application.changeSource endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/application.change_stage': {
    post: {
      summary: 'application.changeStage',
      operationId: 'applicationChangeStage',
      description:
        'Change the stage of an application\n\n**Requires the [`candidatesWrite`](authentication#permissions-applicationchangestage) permission.**\n',
      tags: ['Application'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                applicationId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the application to update the stage of',
                    },
                  ],
                },
                interviewStageId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The interview stage to move the application to.',
                    },
                  ],
                },
                archiveReasonId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description:
                        'Archive Reason to set when moving to an Interview Stage with type: `Archived`. \nNote: You must pass this parameter when moving to an Interview Stage with type: `Archived`\n',
                    },
                  ],
                },
              },
              required: ['applicationId', 'interviewStageId'],
              example: {
                applicationId: '3ae2b801-19f6-41ef-ad28-214bd731948f',
                interviewStageId: '2c6991c5-c9e2-4af8-879e-29c5a9d26509',
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the application.changeStage endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/application.create': {
    post: {
      summary: 'application.create',
      operationId: 'applicationCreate',
      description:
        'Consider a candidate for a job\n\n**Requires the [`candidatesWrite`](authentication#permissions-applicationcreate) permission.**\n',
      tags: ['Application'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                candidateId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the candidate to consider for a job',
                    },
                  ],
                },
                jobId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the job to consider the candidate for',
                    },
                  ],
                },
                interviewPlanId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description:
                        'The id of the interview plan to place the application in. If none is provided, the default interview plan is used.\n',
                    },
                  ],
                },
                interviewStageId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description:
                        'The interview stage of the interview plan (either default or provided) to place the application in. \nIf none is provided, the application is placed in the first "Lead" stage. \nYou can also supply the special string "FirstPreInterviewScreen", which will choose the first pre-interview-screen stage on the specified job\'s interview plan.\n',
                    },
                  ],
                },
                sourceId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The source to set on the application being created.',
                    },
                  ],
                },
                creditedToUserId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the user the application will be credited to.',
                    },
                  ],
                },
                createdAt: {
                  allOf: [
                    {
                      description:
                        "An ISO date string to set the application's `createdAt` timestamp. When this value isn't provided, the `createdAt` timestamp defaults to the time the the call was made.\n",
                    },
                    {
                      $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                    },
                  ],
                },
                applicationHistory: {
                  allOf: [
                    {
                      type: 'array',
                      description: 'An array of objects representing the application history.',
                      items: {
                        type: 'object',
                        properties: {
                          stageId: {
                            allOf: [
                              {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                              },
                              {
                                description:
                                  'The ID of the interview stage for this history event. This stage must belong to the interview plan associated with the application.',
                              },
                            ],
                          },
                          stageNumber: {
                            allOf: [
                              {
                                type: 'integer',
                              },
                              {
                                description:
                                  'The sort order of this event. 0 is the first, the highest number will be the current stage.',
                              },
                            ],
                          },
                          enteredStageAt: {
                            allOf: [
                              {
                                type: 'string',
                                format: 'date-time',
                                example: '2022-07-21T17:32:28Z',
                              },
                              {
                                description:
                                  'An ISO date string representing the time the application entered this stage.',
                              },
                            ],
                          },
                          archiveReasonId: {
                            allOf: [
                              {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                              },
                              {
                                description:
                                  'The ID of the archive reason. If the interview stage is an `Archived` stage type, this field is required.',
                              },
                            ],
                          },
                        },
                        required: ['stageId', 'stageNumber', 'enteredStageAt'],
                      },
                    },
                    {
                      description: 'An array of objects representing the application history.\n',
                    },
                  ],
                },
              },
              required: ['candidateId', 'jobId'],
              example: {
                candidateId: '3ae2b801-19f6-41ef-ad28-214bd731948f',
                jobId: '2c6991c5-c9e2-4af8-879e-29c5a9d26509',
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the application.create endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/application.info': {
    post: {
      summary: 'application.info',
      operationId: 'applicationInfo',
      description:
        'Fetch application details by application id or by submitted form instance id (which is return by the `applicationForm.submit` endpoint). If both applicationId and submittedFormInstanceId are provided, we will lookup by applicationId.\n\n**Requires the [`candidatesRead`](authentication#permissions-applicationinfo) permission.**\n',
      tags: ['Application'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    applicationId: {
                      allOf: [
                        {
                          description: 'The id of the application to fetch.',
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                      ],
                    },
                    expand: {
                      type: 'array',
                      description: 'Choose to expand the result and include additional data for related objects. \n',
                      items: {
                        type: 'string',
                        enum: ['openings', 'applicationFormSubmissions', 'referrals'],
                      },
                    },
                  },
                  required: ['applicationId'],
                },
                {
                  type: 'object',
                  properties: {
                    submittedFormInstanceId: {
                      allOf: [
                        {
                          description: "The id of the application's submitted form instance to fetch.",
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                      ],
                    },
                    expand: {
                      type: 'array',
                      description: 'Choose to expand the result and include additional data for related objects. \n',
                      items: {
                        type: 'string',
                        enum: ['openings', 'applicationFormSubmissions'],
                      },
                    },
                  },
                  required: ['submittedFormInstanceId'],
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the application.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            allOf: [
                              {
                                $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application',
                              },
                              {
                                type: 'object',
                                properties: {
                                  openings: {
                                    description:
                                      'The openings array will only be included if the `openings` expand parameter is included when the request is made.',
                                    type: 'array',
                                    items: {
                                      $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening',
                                    },
                                  },
                                },
                              },
                              {
                                type: 'object',
                                properties: {
                                  applicationHistory: {
                                    type: 'array',
                                    items: {
                                      type: 'object',
                                      properties: {
                                        id: {
                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                        },
                                        stageId: {
                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                        },
                                        title: {
                                          type: 'string',
                                          title: 'Title',
                                          example: 'Offer',
                                        },
                                        enteredStageAt: {
                                          $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                                        },
                                        leftStageAt: {
                                          $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                                        },
                                        stageNumber: {
                                          type: 'integer',
                                          title: 'Stage Number',
                                          description:
                                            "The order of the history event in the application's history. 0 is the first event.",
                                        },
                                        allowedActions: {
                                          type: 'array',
                                          items: {
                                            type: 'enum',
                                            enum: ['none', 'delete', 'set_entered_at'],
                                          },
                                          title: 'Allowed Actions',
                                          description:
                                            'Actions that can be performed on the application via `application.updateHistory`.',
                                          example: ['delete', 'set_entered_at'],
                                        },
                                      },
                                      required: [
                                        'id',
                                        'stageId',
                                        'title',
                                        'enteredStageAt',
                                        'allowedActions',
                                        'stageNumber',
                                      ],
                                    },
                                  },
                                  applicationFormSubmissions: {
                                    type: 'array',
                                    description:
                                      'Application form submissions. These match the response from the `applicationForm.submit` endpoint. Use of the expand parameter is required to fetch.',
                                    items: {
                                      $ref: '#/paths/~1applicationForm.submit/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/submittedFormInstance',
                                    },
                                  },
                                  referrals: {
                                    type: 'array',
                                    items: {
                                      type: 'object',
                                      properties: {
                                        user: {
                                          $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results',
                                        },
                                        referredAt: {
                                          $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/application.list': {
    post: {
      summary: 'application.list',
      operationId: 'applicationList',
      description:
        'Gets all applications in the organization.\n\n**Requires the [`candidatesRead`](authentication#permissions-applicationlist) permission.**\n',
      tags: ['Application'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  type: 'object',
                  properties: {
                    createdAfter: {
                      type: 'integer',
                      format: 'int64',
                      description:
                        'The API will return data after this date, which is the time since the unix epoch in milliseconds',
                    },
                    cursor: {
                      $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema/properties/cursor',
                    },
                    syncToken: {
                      $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema/properties/syncToken',
                    },
                    limit: {
                      $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema/properties/limit',
                    },
                  },
                  example: {
                    createdAfter: 1659979196538,
                    cursor: 'qA',
                    syncToken: '6W05prn4d',
                    limit: 25,
                  },
                },
                {
                  properties: {
                    expand: {
                      type: 'array',
                      description: 'Choose to expand the result and include additional data for related objects. \n',
                      items: {
                        type: 'string',
                        enum: ['openings'],
                      },
                    },
                    status: {
                      type: 'string',
                      enum: ['Hired', 'Archived', 'Active', 'Lead'],
                    },
                    jobId: {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  },
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the application.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              allOf: [
                                {
                                  $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application',
                                },
                                {
                                  $ref: '#/paths/~1application.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/allOf/1',
                                },
                              ],
                            },
                          },
                        },
                      },
                    ],
                    required: ['results'],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/application.transfer': {
    post: {
      summary: 'application.transfer',
      operationId: 'applicationTransfer',
      description:
        'Transfer an application to a different job.\n\n**Requires the [`candidatesWrite`](authentication#permissions-applicationtransfer) permission.**\n',
      tags: ['Application'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                applicationId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the application to transfer.',
                    },
                  ],
                },
                jobId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the job to transfer the application to.',
                    },
                  ],
                },
                interviewPlanId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the interview plan to transfer the application to. \n',
                    },
                  ],
                },
                interviewStageId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The interview stage of the interview plan to transfer the application to. \n',
                    },
                  ],
                },
                startAutomaticActivities: {
                  allOf: [
                    {
                      type: 'boolean',
                    },
                    {
                      description:
                        'Whether to start any automatic activities set on the target interview stage. \nIf not provided, the default value is `true`.\n',
                    },
                    {
                      default: true,
                    },
                  ],
                },
              },
              required: ['applicationId', 'jobId', 'interviewPlanId', 'interviewStageId'],
              example: {
                applicationId: '3ae2b801-19f6-41ef-ad28-214bd731948f',
                jobId: '2c6991c5-c9e2-4af8-879e-29c5a9d26509',
                interviewPlanId: 'af94aedd-b743-462c-ab22-9e7e356c11b4',
                interviewStageId: '5eb15197-8664-48fd-99cf-fbdc9d25149d',
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the application.transfer endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/application.update': {
    post: {
      summary: 'application.update',
      operationId: 'applicationUpdate',
      description:
        'Update an application\n\n**Requires the [`candidatesWrite`](authentication#permissions-applicationupdate) permission.**\n',
      tags: ['Application'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                applicationId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the application to update',
                    },
                  ],
                },
                sourceId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The source to set on the application being created.',
                    },
                  ],
                },
                creditedToUserId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the user the application will be credited to.',
                    },
                  ],
                },
                createdAt: {
                  allOf: [
                    {
                      description:
                        "An ISO date string to set the application's `createdAt` timestamp. When this value isn't provided, the `createdAt` timestamp defaults to the time the the call was made.\n",
                    },
                    {
                      $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                    },
                  ],
                },
                sendNotifications: {
                  type: 'boolean',
                  default: true,
                  description:
                    'Whether or not users who are subscribed to the application should be notified that application was updated. Default is true.',
                },
              },
              required: ['applicationId'],
              example: {
                applicationId: '3ae2b801-19f6-41ef-ad28-214bd731948f',
                createdAt: '2021-01-01T00:00:00Z',
                creditedToUserId: '3ae2b801-19f6-41ef-ad28-214bd731948f',
                sourceId: '3ae2b801-19f6-41ef-ad28-214bd731948f',
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the application.update endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/application.updateHistory': {
    post: {
      summary: 'application.updateHistory',
      operationId: 'applicationUpdateHistory',
      description:
        'Update the history of an application. This endpoint is used to update the history of an application, such as setting the entered stage time or deleting a history event.\n\n**Requires the [`candidatesWrite`](authentication#permissions-applicationupdatehistory) permission and the `Allow updating application history?` setting found in your admin API key permissions configuration.**\n',
      tags: ['Application'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    applicationId: {
                      allOf: [
                        {
                          description: 'The id of the application to fetch.',
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                      ],
                    },
                    applicationHistory: {
                      type: 'array',
                      description:
                        'The updated array of application history events. This array should contain all history events for the application, not just the events being updated.',
                      items: {
                        type: 'object',
                        properties: {
                          stageId: {
                            $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                          },
                          stageNumber: {
                            type: 'integer',
                            title: 'Stage Number',
                            description:
                              "The order of the history event in the application's history. 0 is the first event.",
                          },
                          enteredStageAt: {
                            description: 'The time the application entered the stage.',
                            $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                          },
                          applicationHistoryId: {
                            $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                            title: 'Application History ID',
                            description:
                              'The id of the application history event to update if you are updating an existing event.',
                          },
                          archiveReasonId: {
                            $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                            title: 'Archive Reason ID',
                            description:
                              'The id of the archive reason to associate with the history event if the stage type is `archived`.',
                          },
                        },
                        required: ['stageId', 'stageNumber', 'enteredStageAt'],
                      },
                    },
                  },
                  required: ['applicationId', 'applicationHistory'],
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the application.updateHistory endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            allOf: [
                              {
                                $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application',
                              },
                              {
                                $ref: '#/paths/~1application.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/allOf/1',
                              },
                              {
                                type: 'object',
                                properties: {
                                  applicationHistory: {
                                    type: 'array',
                                    items: {
                                      $ref: '#/paths/~1application.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/allOf/2/properties/applicationHistory/items',
                                    },
                                  },
                                  applicationFormSubmissions: {
                                    type: 'array',
                                    description:
                                      'Application form submissions. These match the response from the `applicationForm.submit` endpoint. Use of the expand parameter is required to fetch.',
                                    items: {
                                      $ref: '#/paths/~1applicationForm.submit/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/submittedFormInstance',
                                    },
                                  },
                                  referrals: {
                                    type: 'array',
                                    items: {
                                      type: 'object',
                                      properties: {
                                        user: {
                                          $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results',
                                        },
                                        referredAt: {
                                          $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/applicationFeedback.list': {
    post: {
      summary: 'applicationFeedback.list',
      operationId: 'applicationFeedbackList',
      description:
        'List all feedback associated with an application.\n\n**Requires the [`candidatesRead`](authentication#permissions-applicationfeedbacklist) permission.**\n\nThe `submittedValues` field in the response contains the submitted feedback in an object where the key is the path of the field and the value is the value submitted for that field.\n',
      tags: ['Application Feedback'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  $ref: '#/paths/~1application.list/post/requestBody/content/application~1json/schema/allOf/0',
                },
                {
                  type: 'object',
                  properties: {
                    applicationId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                        {
                          description: "The id of the application you'd like to fetch feedback for",
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the applicationFeedback.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              allOf: [
                                {
                                  type: 'object',
                                  allOf: [
                                    {
                                      $ref: '#/paths/~1applicationForm.submit/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/submittedFormInstance',
                                    },
                                    {
                                      type: 'object',
                                      properties: {
                                        submittedByUser: {
                                          $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results',
                                        },
                                        interviewId: {
                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                        },
                                        feedbackFormDefinitionId: {
                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                        },
                                        applicationHistoryId: {
                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                        },
                                        applicationId: {
                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                        },
                                        submittedAt: {
                                          $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                                        },
                                      },
                                    },
                                  ],
                                  required: ['submittedByUser', 'applicationId'],
                                },
                              ],
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/application.addHiringTeamMember': {
    post: {
      summary: 'application.addHiringTeamMember',
      description:
        'Adds an Ashby user to the hiring team at the application level. \n\n**Requires the [`candidateWrite`](authentication#permissions-applicationaddhiringteammember) permission.**\n',
      operationId: 'applicationaddhiringteammember',
      tags: ['Application'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              required: ['applicationId', 'teamMemberId', 'roleId'],
              properties: {
                applicationId: {
                  allOf: [
                    {
                      description: 'The application to assign the user a role on.',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                teamMemberId: {
                  allOf: [
                    {
                      description: 'The id of the user to assign the role to.',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                roleId: {
                  allOf: [
                    {
                      description: 'The id of the hiring team role to assign.',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the application.addHiringTeamMember endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1hiringTeam.addMember/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/applicationHiringTeamRole.list': {
    post: {
      summary: 'applicationHiringTeamRole.list',
      operationId: 'applicationHiringTeamRoleList',
      description:
        'Gets all available hiring team roles for applications in the organization.\n\n**Requires the [`candidatesRead`](authentication#permissions-applicationHiringTeamRoleList) permission.**\n',
      tags: ['Application Hiring Team Role'],
      responses: {
        '200': {
          description: 'Responses from the applicationHiringTeamRole.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              allOf: [
                                {
                                  type: 'object',
                                  properties: {
                                    id: {
                                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                    },
                                    title: {
                                      type: 'string',
                                    },
                                  },
                                  required: ['id', 'title'],
                                },
                              ],
                            },
                          },
                        },
                      },
                    ],
                    required: ['results'],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/applicationFeedback.submit': {
    post: {
      summary: 'applicationFeedback.submit',
      description:
        'Application feedback forms support a variety of field types. \n\n**Requires the [`candidatesWrite`](authentication#permissions-applicationfeedbacksubmit) permission.**\n\nThe values accepted for each field depend on the type of field that\'s being filled out:                                                                                                                                                                                                                 |\n- `Boolean` - A boolean value\n- `Date` - A date string in the format YYYY-MM-DD\n- `Email` - A valid email address\n- `Number` - An integer\n- `RichText` - We do not support submitting rich text documents via the API but we do support submitting plain text values for these fields. Plain text values must be submitted in the format `{ type: "PlainText", value: "A plain text string" }`\n- `Score` - An integer between 1 and 4 submitted in the format `{ score: 4 }`\n- `Phone`, `String` A string\n- `ValueSelect` - A string that matches the value of one of the ValueSelect field\'s selectable options\n- `MultiValueSelect` - An array of strings that exist in the MultiValueSelect field\'s selectable options\n\nThe `submittedValues` field in the response contains the submitted feedback in an object where the key is the path of the field and the value is the value submitted for that field.\n',
      operationId: 'applicationfeedbacksubmit',
      tags: ['Application Feedback'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  type: 'object',
                  required: ['feedbackForm', 'formDefinitionId', 'applicationId'],
                  properties: {
                    feedbackForm: {
                      $ref: '#/paths/~1offer.create/post/requestBody/content/application~1json/schema/properties/offerForm',
                    },
                    formDefinitionId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                        {
                          description: 'The id of the feedback form definition associated with the form submission',
                        },
                      ],
                    },
                    applicationId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                        {
                          description: "The id of the application you're submitting feedback for",
                        },
                      ],
                    },
                    userId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                        {
                          description:
                            'The id of the user the feedback will be credited to.\nIf a userId is not provided, the feedback will be credited to the API key user.\n',
                        },
                      ],
                    },
                  },
                },
                {
                  type: 'object',
                  required: ['feedbackForm', 'formDefinitionId', 'applicationId', 'userId', 'interviewEventId'],
                  properties: {
                    feedbackForm: {
                      $ref: '#/paths/~1offer.create/post/requestBody/content/application~1json/schema/properties/offerForm',
                    },
                    formDefinitionId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                        {
                          description: 'The id of the feedback form definition associated with the form submission',
                        },
                      ],
                    },
                    applicationId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                        {
                          description: "The id of the application you're submitting feedback for",
                        },
                      ],
                    },
                    userId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                        {
                          description:
                            'The id of the user the feedback will be credited to. \nThe user must be an interviewer on the interview event that feedback is being submitted for.\n',
                        },
                      ],
                    },
                    interviewEventId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                        {
                          description: "The id of the interview event you're submitting feedback for.\n",
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the applicationFeedback.submit endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              submittedFormInstance: {
                                $ref: '#/paths/~1applicationForm.submit/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/submittedFormInstance',
                              },
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/applicationForm.submit': {
    post: {
      summary: 'applicationForm.submit',
      description:
        'Submit an application for a job posting.\n\n**Requires the [`candidatesWrite`](authentication#permissions-applicationformsubmit) permission.**\n\nThe Content-Type of this request must be `multipart/form-data`.\n\n**Note: The requests generated from this documentation will not work for this endpoint.**\n\nThe values accepted for each field depend on the type of field that\'s being filled out:                                                                                                                                                                                                                 |\n- `Boolean` - A boolean value\n- `Date` - A date string in the format YYYY-MM-DD\n- `Email` - A valid email address\n- `Number` - An integer\n- `RichText` - We do not support submitting rich text documents via the API but we do support submitting plain text values for these fields. Plain text values must be submitted in the format `{ type: "PlainText", value: "A plain text string" }`\n- `Score` - An integer between 1 and 4 submitted in the format `{ score: 4 }`\n- `Phone`, `String` A string\n- `ValueSelect` - A string that matches the value of one of the ValueSelect field\'s selectable options\n- `MultiValueSelect` - An array of strings that exist in the MultiValueSelect field\'s selectable options\n- `Location` - An object with the following properties: `{ country: "USA", city: "San Francisco", region: "California" }`. You may provide any combination of these properties and we will attempt to geocode the location. For best results, provide all three properties.\n',
      operationId: 'applicationformsubmit',
      tags: ['Application Form'],
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['jobPostingId', 'applicationForm'],
              properties: {
                jobPostingId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the job posting to submit an application for',
                    },
                  ],
                },
                applicationForm: {
                  $ref: '#/paths/~1offer.create/post/requestBody/content/application~1json/schema/properties/offerForm',
                },
                utmData: {
                  type: 'object',
                  properties: {
                    utm_source: {
                      type: 'string',
                    },
                    utm_campaign: {
                      type: 'string',
                    },
                    utm_medium: {
                      type: 'string',
                    },
                    utm_term: {
                      type: 'string',
                    },
                    utm_content: {
                      type: 'string',
                    },
                  },
                },
                '<file  key>': {
                  type: 'string',
                  description:
                    'Any file referenced  in the `applicationForm`.   The name of this field must exactly match the `value` on the `fieldSubmission` that references this file.',
                  format: 'binary',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the applicationFeedback.submit endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              submittedFormInstance: {
                                type: 'object',
                                properties: {
                                  id: {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                  formDefinition: {
                                    $ref: '#/paths/~1offer.start/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/formDefinition',
                                  },
                                  submittedValues: {
                                    type: 'object',
                                    example: {
                                      _systemfield_name: 'Joe Smith',
                                    },
                                  },
                                },
                                required: ['id', 'formDefinition', 'submittedValues'],
                              },
                              formMessages: {
                                type: 'object',
                                properties: {
                                  blockMessageForCandidateHtml: {
                                    type: 'string',
                                    description:
                                      'A message to display to the candidate if they been blocked from applying due to application limits',
                                    example:
                                      '<div><p>In order to give as many candidates as possible an opportunity to apply we have limiting the number of applications a single candidate may submit. Unfortunately we cannot, accept your application at this time.</p></div>\n',
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/approvalDefinition.update': {
    post: {
      summary: 'approvalDefinition.update',
      operationId: 'approvalDefinitionUpdate',
      description:
        'Create or update an approval definition for a specific entity that requires approval. The entity requiring approval must be within scope of an approval in Ashby that is marked as being managed by the API.\n\nIf the provided approval step definitions is an empty list, then approval will be skipped and the entity will proceed to the next stage.\n\n**Requires the [`approvalsWrite`](authentication#permissions-approvaldefinitionupdate) permission.**\n',
      tags: ['Approval Definition'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                entityType: {
                  type: 'string',
                  enum: ['offer'],
                },
                entityId: {
                  allOf: [
                    {
                      description: 'The id of the approval entity being updated (e.g. the id of the offer version).',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                approvalStepDefinitions: {
                  type: 'array',
                  description:
                    'An ordered list of approval steps that describes the number of required approvers at each step, as well as who is an approver at each step.',
                  items: {
                    type: 'object',
                    properties: {
                      approvalsRequired: {
                        type: 'integer',
                        description:
                          'The number of approvers required to approve this step, before the approval moves on to the next step. The number of approvers must be non-zero and no more than the number of approvers in this step.',
                      },
                      approvers: {
                        type: 'array',
                        description: 'An unordered list of who can approve this step.',
                        items: {
                          type: 'object',
                          properties: {
                            userId: {
                              allOf: [
                                {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                },
                                {
                                  description: 'The id of a user who is an approver for this step.',
                                },
                              ],
                            },
                            type: {
                              type: 'string',
                              enum: ['user'],
                            },
                          },
                          required: ['userId', 'type'],
                        },
                      },
                    },
                    required: ['approvalsRequired', 'approvers'],
                  },
                },
                submitApprovalRequest: {
                  type: 'boolean',
                  description:
                    'Control whether an approval request created through this API should be immediately submitted.\nIf false, then the approval will need to be manually submitted in the Ashby app.\nDefault: false\n',
                },
              },
              required: ['entityType', 'entityId', 'approvalStepDefinitions'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the approvalDefinition.update endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              id: {
                                allOf: [
                                  {
                                    description: 'The id of the approval definition.',
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                              entityType: {
                                type: 'string',
                                enum: ['Offer'],
                              },
                              entityId: {
                                allOf: [
                                  {
                                    description: 'The id of the approval entity (e.g. the id of the offer version).',
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                              approvalStepDefinitions: {
                                $ref: '#/paths/~1approvalDefinition.update/post/requestBody/content/application~1json/schema/properties/approvalStepDefinitions',
                              },
                            },
                            required: ['entityType', 'entityId', 'approvalStepDefinitions'],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/archiveReason.list': {
    post: {
      summary: 'archiveReason.list',
      description:
        'Lists archive reasons\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-archivereasonlist) permission.**\n',
      operationId: 'archivereasonlist',
      tags: ['Archive Reason'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                includeArchived: {
                  type: 'boolean',
                  description: 'When true, includes archived interview plans',
                  default: false,
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the archiveReason.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success Response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                },
                                text: {
                                  type: 'string',
                                  example: 'Too inexperienced',
                                },
                                reasonType: {
                                  enum: ['RejectedByCandidate', 'RejectedByOrg', 'Other'],
                                  example: 'RejectedByOrg',
                                },
                                isArchived: {
                                  $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived',
                                },
                              },
                              required: ['id', 'text', 'reasonType', 'isArchived'],
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/assessment.addCompletedToCandidate': {
    post: {
      summary: 'assessment.addCompletedToCandidate',
      operationId: 'assessmentAddCompletedToCandidate',
      description:
        'Add a completed assessment to a candidate\n\n**Requires the [`candidatesWrite`](authentication#permissions-assessmentaddcompletedtocandidate) permission.**\n',
      tags: ['Assessment'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                candidateId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the candidate, to whom to add the completed assessment',
                    },
                  ],
                },
                partnerId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the partner adding the assessment',
                    },
                  ],
                },
                assessment: {
                  type: 'object',
                  description: 'The completed assessment',
                  required: ['assessmentTypeId', 'assessmentId', 'assessmentName', 'result', 'metadata'],
                  properties: {
                    assessmentTypeId: {
                      allOf: [
                        {
                          description: 'An identifier that uniquely identifies the assessment type',
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                      ],
                    },
                    assessmentId: {
                      allOf: [
                        {
                          description: 'An identifier that uniquely identifies the completed assessment',
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                      ],
                    },
                    assessmentName: {
                      type: 'string',
                      example: 'Node Assessment',
                      description: 'The name of the assessment that was taken that will be displayed in the UI',
                    },
                    result: {
                      allOf: [
                        {
                          description: "The assessment's result",
                        },
                        {
                          $ref: '#/paths/~1assessment.addCompletedToCandidate/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/result',
                        },
                      ],
                    },
                    metadata: {
                      type: 'array',
                      description: 'An array of metadata associated with this completed assessment',
                      items: {
                        $ref: '#/paths/~1assessment.addCompletedToCandidate/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/result',
                      },
                    },
                  },
                },
                timestamp: {
                  allOf: [
                    {
                      description:
                        'The timestamp in milliseconds since the unix epoch, when the assessment was completed',
                    },
                    {
                      type: 'integer',
                      description: 'The timestamp in milliseconds since the unix epoch, when the update occurred',
                      format: 'int64',
                      example: 1665680638489,
                    },
                  ],
                },
              },
              required: ['candidateId', 'partnerId', 'assessment', 'timestamp'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the assessment.addCompletedToCandidate endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success Response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            required: ['assessmentTypeId', 'assessmentId', 'assessmentName', 'candidateId', 'metadata'],
                            properties: {
                              applicationId: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                              assessmentId: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                              assessmentName: {
                                type: 'string',
                                example: 'test-assessment-name',
                              },
                              assessmentTypeId: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                              candidateId: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                              metadata: {
                                type: 'array',
                                items: {
                                  $ref: '#/paths/~1assessment.addCompletedToCandidate/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/result',
                                },
                              },
                              result: {
                                type: 'object',
                                properties: {
                                  identifier: {
                                    type: 'string',
                                    description: 'Uniquely identifies this field, for this partner',
                                    example: 'result-max',
                                  },
                                  label: {
                                    type: 'string',
                                    description: 'Label for the assessment metadata to be displayed in the UI',
                                    example: 'Max Score',
                                  },
                                  description: {
                                    type: 'string',
                                    description:
                                      'Description of the assessment metadata, which may be displayed in the UI',
                                    example: 'The maximum possible score for the assessment',
                                  },
                                  type: {
                                    type: 'string',
                                    description:
                                      "The type of the value. Please reach out if you'd like us to support a new type!",
                                    enum: [
                                      'numeric_score',
                                      'numeric_duration_minutes',
                                      'url',
                                      'string',
                                      'boolean_success',
                                    ],
                                  },
                                  value: {
                                    allOf: [
                                      {
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
                                        ],
                                        description: 'The raw value — one of string, number, or boolean\n',
                                      },
                                      {
                                        example: 10,
                                      },
                                    ],
                                  },
                                },
                                required: ['identifier', 'label', 'type', 'value'],
                              },
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/assessment.start': {
    post: {
      summary: 'assessment.start (Implemented by Partner)',
      operationId: 'assessmentStart',
      description: 'The API for starting an assessment. Implemented by the partner, called by Ashby.\n',
      tags: ['Assessment'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['assessment_type_id', 'candidate', 'application', 'job'],
              properties: {
                assessment_type_id: {
                  allOf: [
                    {
                      description:
                        'The id of the type of assessment to start (retrieved from calling /assessment.list)',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                candidate: {
                  allOf: [
                    {
                      description: 'Identifier of the assessment being started',
                    },
                    {
                      type: 'object',
                      description: 'A description of the candidate',
                      required: ['ashby_id', 'first_name', 'last_name', 'email', 'ashby_profile_url'],
                      properties: {
                        ashby_id: {
                          allOf: [
                            {
                              type: 'string',
                            },
                            {
                              description: 'The identifier of the candidate in Ashby',
                            },
                          ],
                        },
                        first_name: {
                          allOf: [
                            {
                              type: 'string',
                            },
                            {
                              description: 'The first name of the candidate being assessed',
                            },
                          ],
                        },
                        last_name: {
                          allOf: [
                            {
                              type: 'string',
                            },
                            {
                              description: 'The last name of the candidate being assessed',
                            },
                          ],
                        },
                        email: {
                          allOf: [
                            {
                              type: 'string',
                            },
                            {
                              description: 'The email of the candidate being assessed',
                            },
                          ],
                        },
                        ashby_profile_url: {
                          allOf: [
                            {
                              type: 'string',
                            },
                            {
                              description: 'The url back into Ashby of the candidate being assessed',
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
                application: {
                  allOf: [
                    {
                      description: 'The application for which the candidate is being assessed',
                    },
                    {
                      type: 'object',
                      description: 'The application for which the candidate is being assessed',
                      required: ['ashby_id', 'status'],
                      properties: {
                        ashby_id: {
                          allOf: [
                            {
                              type: 'string',
                            },
                            {
                              description: 'The id of the application in Ashby',
                            },
                          ],
                        },
                        status: {
                          allOf: [
                            {
                              $ref: '#/paths/~1application.list/post/requestBody/content/application~1json/schema/allOf/1/properties/status',
                            },
                            {
                              description: 'The status of the application in Ashby',
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
                job: {
                  allOf: [
                    {
                      description: 'The job for which the candidate is being assessed',
                    },
                    {
                      type: 'object',
                      description: 'The job for which the candidate is being assessed',
                      required: ['ashby_id', 'name', 'ashby_job_url'],
                      properties: {
                        ashby_id: {
                          allOf: [
                            {
                              type: 'string',
                            },
                            {
                              description: 'The id of the job in Ashby',
                            },
                          ],
                        },
                        name: {
                          allOf: [
                            {
                              type: 'string',
                            },
                            {
                              description: 'The name of the job in Ashby',
                            },
                          ],
                        },
                        req_id: {
                          allOf: [
                            {
                              type: 'string',
                            },
                            {
                              description: 'The customer-defined requisition id for the job',
                            },
                          ],
                        },
                        ashby_job_url: {
                          allOf: [
                            {
                              type: 'string',
                            },
                            {
                              description: 'The url of the job, internal to Ashby',
                            },
                          ],
                        },
                        hiringTeam: {
                          type: 'array',
                          items: {
                            $ref: '#/paths/~1hiringTeam.addMember/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the assessment.start endpoint',
          content: {
            'application/json': {
              schema: {
                title: 'Success Response',
                type: 'object',
                required: ['success', 'results'],
                properties: {
                  success: {
                    type: 'boolean',
                  },
                  results: {
                    required: ['assessment_id'],
                    properties: {
                      assessment_id: {
                        type: 'string',
                      },
                      update_request: {
                        $ref: '#/paths/~1assessment.update/post/requestBody/content/application~1json/schema',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '409': {
          description: 'The assessment could not be started because the candidate is already being assessed.\n',
        },
        '422': {
          description: 'A custom error message that will be shown to the user in Ashby.\n',
          content: {
            'application/json': {
              schema: {
                title: 'Custom Error Response',
                type: 'object',
                required: ['message'],
                properties: {
                  message: {
                    type: 'string',
                    description: 'The message to be shown to the user in Ashby.',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/assessment.list': {
    post: {
      summary: 'assessment.list (Implemented by Partner)',
      operationId: 'assessmentList',
      description:
        'The API for listing assessments that the partner supports — implemented by the partner, but called by Ashby\n',
      tags: ['Assessment'],
      responses: {
        '200': {
          description: 'Responses for the assessment.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              allOf: [
                                {
                                  type: 'object',
                                  description: 'List of available assessments',
                                  properties: {
                                    assessment_type_id: {
                                      allOf: [
                                        {
                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                        },
                                      ],
                                    },
                                    name: {
                                      type: 'string',
                                    },
                                    description: {
                                      type: 'string',
                                    },
                                  },
                                },
                              ],
                            },
                          },
                        },
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/assessment.update': {
    post: {
      summary: 'assessment.update',
      operationId: 'assessmentUpdate',
      description:
        'Update Ashby about the status of a started assessment.\n\n**Requires the [`candidatesWrite`](authentication#permissions-assessmentupdate) permission.**\n',
      tags: ['Assessment'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['assessment_id', 'timestamp'],
              properties: {
                assessment_id: {
                  allOf: [
                    {
                      description: 'Identifier of the assessment being updated',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                timestamp: {
                  $ref: '#/paths/~1assessment.addCompletedToCandidate/post/requestBody/content/application~1json/schema/properties/timestamp/allOf/1',
                },
                assessment_status: {
                  allOf: [
                    {
                      description:
                        'The current status of the assessment. Setting this with a value of "Started" will signal Ashby to store the timestamp the assessment started.',
                    },
                    {
                      $ref: '#/paths/~1assessment.addCompletedToCandidate/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/result',
                    },
                  ],
                },
                assessment_profile_url: {
                  allOf: [
                    {
                      description:
                        "The url back to the assessment/candidate on the partner's website. This value should always be of type url. (required when assessment_result is set)",
                    },
                    {
                      $ref: '#/paths/~1assessment.addCompletedToCandidate/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/result',
                    },
                  ],
                },
                assessment_result: {
                  allOf: [
                    {
                      description:
                        'The result of the assessment. Sending an update with this field will signal to Ashby that the assessment is complete.',
                    },
                    {
                      $ref: '#/paths/~1assessment.addCompletedToCandidate/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/result',
                    },
                  ],
                },
                cancelled_reason: {
                  allOf: [
                    {
                      description:
                        'The reason the assessment was cancelled. This field will signal to Ashby that the assessment is cancelled.',
                    },
                    {
                      $ref: '#/paths/~1assessment.addCompletedToCandidate/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/result',
                    },
                  ],
                },
                metadata: {
                  type: 'array',
                  description:
                    'Any other metadata about the assessment (e.g. ETA until complete). All assessment data should have unique identifiers.',
                  items: {
                    $ref: '#/paths/~1assessment.addCompletedToCandidate/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/result',
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the assessment.start endpoint',
        },
      },
    },
  },
  '/assessment.cancel': {
    post: {
      summary: 'assessment.cancel (Implemented by Partner)',
      operationId: 'assessmentCancel',
      description: '(Optional) Cancels an assessment. Implemented by the partner, called by Ashby.\n',
      tags: ['Assessment'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['assessment_id'],
              properties: {
                assessment_id: {
                  allOf: [
                    {
                      description: 'The id of the started assessment to cancel',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the assessment.cancel endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success Response',
                    type: 'object',
                    $ref: '#/paths/~1assessment.start/post/responses/200/content/application~1json/schema',
                  },
                  {
                    title: 'Error Response',
                    type: 'object',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/candidate.addProject': {
    post: {
      summary: 'candidate.addProject',
      operationId: 'candidateaddproject',
      description:
        'Adds the candidate to a project.\n\n**Requires the [`candidatesWrite`](authentication#permissions-candidateaddproject) permission.**\n',
      tags: ['Candidate', 'Project'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                candidateId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the candidate',
                    },
                  ],
                },
                projectId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the project',
                    },
                  ],
                },
              },
              required: ['candidateId', 'projectId'],
              example: {
                candidateId: 'f9e52a51-a075-4116-a7b8-484deba69004',
                projectId: 'bcffca12-5b09-4a76-acf2-00a8e267b222',
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the candidate.addProject endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/candidate.addTag': {
    post: {
      summary: 'candidate.addTag',
      description:
        'Adds a tag to a candidate\n\n**Requires the [`candidatesWrite`](authentication#permissions-candidateaddtag) permission.**\n',
      operationId: 'candidateAddTag',
      tags: ['Candidate'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['candidateId', 'tagId'],
              properties: {
                candidateId: {
                  type: 'string',
                  description: 'The unique id of the candidate to add the tag to.',
                  example: '5b591aed-88e3-4395-b9c6-7d529f93354a',
                },
                tagId: {
                  type: 'string',
                  description: 'The unique id of the tag to add to the candidate.',
                  example: '38430ede-5bd2-41fc-b474-87591cb98cbc',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the candidate.addTag endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/canidate.anonymize': {
    post: {
      summary: 'candidate.anonymize',
      description:
        "Anonymizes a candidate.\n\n**Requires the [`candidatesWrite`](authentication#permissions-candidateanonymize) permission.**\n\n**Note**: this action cannot be reversed and requires all of a candidate's applications to be in the archived or hired state.\n",
      operationId: 'candidateAnonymize',
      tags: ['Candidate'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['candidateId'],
              properties: {
                candidateId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the candidate to anonymize.',
                    },
                  ],
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the candidate.anonymize endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        description: 'The anonymized candidate',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/candidate.create': {
    post: {
      summary: 'candidate.create',
      operationId: 'candidateCreate',
      description:
        'Creates a new candidate\n\n**Requires the [`candidatesWrite`](authentication#permissions-candidatecreate) permission.**\n',
      tags: ['Candidate'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  example: 'Adam Hart',
                  description: 'The first and last name of the candidate to be created.',
                },
                email: {
                  allOf: [
                    {
                      type: 'string',
                      example: 'test@ashbyhq.com',
                    },
                    {
                      description: 'Primary, personal email of the candidate to be created.',
                    },
                  ],
                },
                phoneNumber: {
                  allOf: [
                    {
                      type: 'string',
                      example: '555-555-5555',
                    },
                    {
                      description: 'Primary, personal phone number of the candidate to be created.',
                    },
                  ],
                },
                linkedInUrl: {
                  type: 'string',
                  example: 'https://linkedin.com/in/user',
                  description: "Url to the candidate's LinkedIn profile. Must be a valid Url.",
                },
                githubUrl: {
                  type: 'string',
                  example: 'https://github.com/user',
                  description: "Url to the candidate's Github profile. Must be a valid Url.",
                },
                website: {
                  type: 'string',
                  example: 'https://twitter.com/user',
                  description: "Url of the candidate's website. Must be a valid Url.",
                },
                alternateEmailAddresses: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                  example: ['test.email@ashbyhq.com'],
                  description: "Array of alternate email address to add to the candidate's profile.",
                },
                sourceId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The source to set on the candidate being created.',
                    },
                  ],
                },
                creditedToUserId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the user the candidate will be credited to.',
                    },
                  ],
                },
                location: {
                  type: 'object',
                  description: 'The location of the candidate.',
                  properties: {
                    city: {
                      type: 'string',
                      example: 'San Francisco',
                      description: "The city of the candidate's location.",
                    },
                    region: {
                      type: 'string',
                      example: 'California',
                      description: "The region (state, province, etc.) of the candidate's location.",
                    },
                    country: {
                      type: 'string',
                      example: 'United States',
                      description: "The country of the candidate's location.",
                    },
                  },
                },
                createdAt: {
                  allOf: [
                    {
                      description:
                        "An ISO date string to set the candidate's `createdAt` timestamp. When this value isn't provided, the `createdAt` timestamp defaults to the time the the call was made.\n",
                    },
                    {
                      $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                    },
                  ],
                },
              },
              required: ['name'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the candidate.create endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/candidate.createNote': {
    post: {
      summary: 'candidate.createNote',
      description:
        "Creates a note on a candidate.\n\n**Requires the [`candidatesWrite`](authentication#permissions-candidatecreatenote) permission.**\n\nFor notes submitted with a type of `text/html`, we support the elements listed below. Any unsupported elements will be stripped out of the note's content before posting.\n  - Bold `<b>`\n  - Italic `<i>`\n  - Underline `<u>`\n  - Links `<a>`\n  - Bulleted Lists - `<ul>`, `<li>`\n  - Ordered Lists - `<ol>`, `<li>`\n  - Code - `<code>`\n  - Code Block - `<pre>`\n",
      operationId: 'candidateCreateNote',
      tags: ['Candidate'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                candidateId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                },
                note: {
                  oneOf: [
                    {
                      type: 'string',
                      description: 'The note to add to the candidate',
                      example: 'Strong candidate, very interested in the company',
                    },
                    {
                      type: 'object',
                      description: 'Note content',
                      properties: {
                        type: {
                          type: 'string',
                          enum: ['text/plain', 'text/html'],
                          description:
                            "The content type of the note. For notes submitted with a type of text/html we support the elements listed below. Any unsupported elements will be stripped out of the note's content before posting.\n- Bold `<b>`\n- Italic `<i>`\n- Underline `<u>`\n- Links `<a>`\n- Bulleted Lists - `<ul>`, `<li>`\n- Ordered Lists - `<ol>`, `<li>`\n- Code - `<code>`\n- Code Block - `<pre>`\n",
                        },
                        value: {
                          type: 'string',
                        },
                      },
                      required: ['type', 'value'],
                    },
                  ],
                },
                sendNotifications: {
                  type: 'boolean',
                  description:
                    'Whether or not users who are subscribed to the candidate should be notified that the note was posted. Default is false.',
                  default: false,
                },
                createdAt: {
                  type: 'string',
                  example: '2022-08-12T20:29:56.964Z',
                  format: 'date',
                },
              },
              required: ['candidateId', 'note'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the candidate.createNote endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                              },
                              createdAt: {
                                $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                              },
                              content: {
                                type: 'string',
                                example:
                                  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
                              },
                              author: {
                                type: 'object',
                                properties: {
                                  id: {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                  firstName: {
                                    type: 'string',
                                    example: 'Joey',
                                  },
                                  lastName: {
                                    type: 'string',
                                    example: 'Joe',
                                  },
                                  email: {
                                    $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/email/allOf/0',
                                  },
                                },
                                required: ['id', 'firstName', 'lastName'],
                              },
                            },
                            required: ['id', 'createdAt', 'author'],
                          },
                        },
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/candidate.info': {
    post: {
      summary: 'candidate.info',
      operationId: 'candidateInfo',
      description:
        'Gets a single candidate by id.\n\n**Requires the [`candidatesRead`](authentication#permissions-candidateinfo) permission.**\n',
      tags: ['Candidate'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'string',
                      format: 'uuid',
                      description: 'The id of the candidate to fetch',
                    },
                  },
                  required: ['id'],
                  example: {
                    id: 'f9e52a51-a075-4116-a7b8-484deba69004',
                  },
                },
                {
                  type: 'object',
                  properties: {
                    externalMappingId: {
                      type: 'string',
                      description:
                        'An id assigned to a candidate outside of Ashby. \nUsed to associate Ashby candidates with their profiles in external systems (BambooHR, Rippling, Gusto, etc.)\n',
                    },
                  },
                  required: ['externalMappingId'],
                  example: {
                    externalMappingId: 'f9e52a51-a075-4116-a7b8-484deba69004',
                  },
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the candidate.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                description: 'The unique id of the candidate',
                              },
                              createdAt: {
                                $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                              },
                              updatedAt: {
                                $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                              },
                              name: {
                                type: 'string',
                                example: 'Adam Hart',
                                description: "The candidate's name",
                              },
                              primaryEmailAddress: {
                                $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application/properties/candidate/properties/primaryEmailAddress',
                              },
                              emailAddresses: {
                                type: 'array',
                                items: {
                                  $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application/properties/candidate/properties/primaryEmailAddress',
                                },
                              },
                              primaryPhoneNumber: {
                                $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application/properties/candidate/properties/primaryEmailAddress',
                              },
                              phoneNumbers: {
                                type: 'array',
                                items: {
                                  $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application/properties/candidate/properties/primaryEmailAddress',
                                },
                              },
                              socialLinks: {
                                type: 'array',
                                items: {
                                  $ref: '#/paths/~1candidate.update/post/requestBody/content/application~1json/schema/properties/socialLinks/items',
                                },
                              },
                              tags: {
                                type: 'array',
                                items: {
                                  $ref: '#/paths/~1candidateTag.create/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                                },
                              },
                              position: {
                                type: 'string',
                                example: 'Software Engineer',
                              },
                              company: {
                                type: 'string',
                                example: 'Auction.com',
                              },
                              school: {
                                type: 'string',
                                example: 'Princeton University',
                              },
                              applicationIds: {
                                type: 'array',
                                description: 'The unique ids of all applications associated with the candidate',
                                items: {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                },
                              },
                              resumeFileHandle: {
                                description: "The id, name and handle for the candidate's resume",
                                $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/fileHandles/items',
                              },
                              fileHandles: {
                                description: 'The id, name and handle for each file associated with the candidate',
                                type: 'array',
                                items: {
                                  type: 'object',
                                  properties: {
                                    id: {
                                      type: 'string',
                                    },
                                    name: {
                                      type: 'string',
                                    },
                                    handle: {
                                      type: 'string',
                                      description:
                                        "You can use the file handle to retrieve the file's URL by using the file.info endpoint.",
                                    },
                                  },
                                  required: ['id', 'name', 'handle'],
                                  example: {
                                    id: '15d2624d-0a81-4f94-a2ed-94980f430b3f',
                                    name: 'resume.pdf',
                                    handle: 'eyJoYW5kbGUiOnsidHlwZSI6IkNhbmRpZGF0ZUZpbGUiLCJm',
                                  },
                                },
                              },
                              customFields: {
                                type: 'array',
                                description: 'All custom field values associated with the candidate',
                                items: {
                                  $ref: '#/paths/~1customField.setValue/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                                },
                              },
                              profileUrl: {
                                type: 'string',
                                description: "The url of the candidate's profile in Ashby",
                              },
                              source: {
                                description: 'The source that created this candidate',
                                $ref: '#/paths/~1source.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items',
                              },
                              creditedToUser: {
                                description: 'The user who receives credit for this user',
                                $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results',
                              },
                              timezone: {
                                description: 'The timezone of the candidate',
                                type: 'string',
                              },
                              primaryLocation: {
                                description: 'The primary location of the candidate',
                                type: 'object',
                                properties: {
                                  id: {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                    description: "The location's unique id.",
                                  },
                                  locationSummary: {
                                    type: 'string',
                                    description: 'A human-readable summary of the location.',
                                    example: 'United States, California, San Francisco',
                                  },
                                  locationComponents: {
                                    type: 'array',
                                    description: 'The individual components of the location.',
                                    items: {
                                      type: 'object',
                                      required: ['type', 'name'],
                                      properties: {
                                        type: {
                                          type: 'enum',
                                          enum: ['Country', 'Region', 'City'],
                                          description: 'The type of the location component.',
                                        },
                                        name: {
                                          type: 'string',
                                          description: 'The name of the location component.',
                                        },
                                      },
                                    },
                                    example: [
                                      {
                                        type: 'Country',
                                        name: 'United States',
                                      },
                                      {
                                        type: 'Region',
                                        name: 'California',
                                      },
                                      {
                                        type: 'City',
                                        name: 'San Francisco',
                                      },
                                    ],
                                  },
                                },
                                required: ['id', 'locationSummary', 'locationComponents'],
                              },
                            },
                            required: [
                              'id',
                              'name',
                              'emailAddresses',
                              'phoneNumbers',
                              'socialLinks',
                              'tags',
                              'applicationIds',
                              'fileHandles',
                              'profileUrl',
                            ],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/candidate.list': {
    post: {
      summary: 'candidate.list',
      operationId: 'candidateList',
      description:
        'Lists all candidates in an organization\n\n**Requires the [`candidatesRead`](authentication#permissions-candidatelist) permission.**\n',
      tags: ['Candidate'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the candidate.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                            },
                          },
                        },
                      },
                    ],
                    required: ['results'],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/candidate.listNotes': {
    post: {
      summary: 'candidate.listNotes',
      operationId: 'candidateListNotes',
      description:
        'Lists all notes on a candidate\n\n**Requires the [`candidatesRead`](authentication#permissions-candidatelistnotes) permission.**\n',
      tags: ['Candidate'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  type: 'object',
                  properties: {
                    candidateId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                        {
                          description: 'The id of the candidate to fetch notes for',
                        },
                      ],
                    },
                  },
                },
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema',
                },
              ],
              required: ['candidateId'],
              example: {
                candidateId: 'f9e52a51-a075-4116-a7b8-484deba69004',
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the candidate.listNotes endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/paths/~1candidate.createNote/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                            },
                          },
                        },
                      },
                    ],
                    required: ['results'],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/candidate.search': {
    post: {
      summary: 'candidate.search',
      operationId: 'candidateSearch',
      description:
        'Search for candidates by email and / or name. \n\n**Requires the [`candidatesRead`](authentication#permissions-candidatesearch) permission.**\n\nResponses are limited to 100 results. Consider refining your search or using /candidate.list to paginate through all candidates, if you approach this limit. This API is for use cases where you intend operate on a final small set of candidates, like building a candidate autocomplete.\n\nNote: When multiple search parameters are provided, the parameters are combined with the `AND` operator.\n',
      tags: ['Candidate'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  description: "The candidate's email",
                },
                name: {
                  type: 'string',
                  description: "The candidate's name",
                },
              },
              example: {
                email: 'test@ashbyhq.com',
                name: 'Adam Hart',
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the candidate.search endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/candidate.update': {
    post: {
      summary: 'candidate.update',
      operationId: 'candidateUpdate',
      description:
        'Updates an existing candidate\n\n**Requires the [`candidatesWrite`](authentication#permissions-candidateupdate) permission.**\n',
      tags: ['Candidate'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                candidateId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The unique id of the candidate to update.',
                    },
                  ],
                },
                name: {
                  type: 'string',
                  example: 'Adam Hart',
                  description: 'The first and last name of the candidate to update.',
                },
                email: {
                  allOf: [
                    {
                      $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/email/allOf/0',
                    },
                    {
                      description: 'Primary, personal email of the candidate to update.',
                    },
                  ],
                },
                phoneNumber: {
                  allOf: [
                    {
                      $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/phoneNumber/allOf/0',
                    },
                    {
                      description: 'Primary, personal phone number of the candidate to update.',
                    },
                  ],
                },
                linkedInUrl: {
                  $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/linkedInUrl',
                },
                githubUrl: {
                  $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/githubUrl',
                },
                websiteUrl: {
                  $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/website',
                },
                alternateEmail: {
                  type: 'string',
                  example: 'test.email@ashbyhq.com',
                  description: "An alternate email address to add to the candidate's profile.",
                },
                socialLinks: {
                  description:
                    'An array of social links to set on the candidate. This value replaces existing socialLinks that have been set on the candidate. \nIf this value is submitted along with linkedInUrl, gitHubUrl or websiteUrl fields, those values will be ignored.\n',
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        enum: ['LinkedIn', 'GitHub', 'Twitter', 'Medium', 'StackOverflow', 'Website'],
                      },
                      url: {
                        type: 'string',
                      },
                    },
                    required: ['type', 'url'],
                    example: {
                      url: 'https://linkedin.com/in/user',
                      type: 'LinkedIn',
                    },
                  },
                },
                sourceId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of source for this candidate.',
                    },
                  ],
                },
                creditedToUserId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the user the candidate will be credited to.',
                    },
                  ],
                },
                location: {
                  type: 'object',
                  description: 'The location of the candidate.',
                  properties: {
                    $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/location/properties',
                  },
                },
                createdAt: {
                  allOf: [
                    {
                      description: "An ISO date string to set the candidate's `createdAt` timestamp.\n",
                    },
                    {
                      $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                    },
                  ],
                },
                sendNotifications: {
                  type: 'boolean',
                  default: true,
                  description:
                    'Whether or not users who are subscribed to the candidate should be notified that candidate was updated. Default is true.',
                },
              },
              required: ['candidateId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the candidate.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/candidate.uploadFile': {
    post: {
      summary: 'candidate.uploadFile',
      operationId: 'candidateUploadFile',
      description:
        "Uploads a file to attach to the candidate's profile. \n\n**Requires the [`candidatesWrite`](authentication#permissions-candidateuploadfile) permission.**\n\nThe `Content-Type` of this request must be `multipart/form-data`.\n",
      tags: ['Candidate'],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                candidateId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the candidate',
                    },
                  ],
                },
                file: {
                  type: 'string',
                  format: 'binary',
                  description: "The file to upload to the candidate's profile",
                },
              },
              required: ['candidateId', 'file'],
              example: {
                id: 'f9e52a51-a075-4116-a7b8-484deba69004',
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the candidate.uploadFile endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/candidate.uploadResume': {
    post: {
      summary: 'candidate.uploadResume',
      operationId: 'candidateUploadResume',
      description:
        "Uploads a candidate's resume, parses it, and updates their information.\n\n**Requires the [`candidatesWrite`](authentication#permissions-candidateuploadresume) permission.**\n\nThe `Content-Type` of this request must be `multipart/form-data`.\n\nNote: Existing candidate data always takes precedence over data found by parsing the resume. Resume data only populates candidate data, if it's data that was missing in the candidate model.    \n",
      tags: ['Candidate'],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                candidateId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the candidate',
                    },
                  ],
                },
                resume: {
                  type: 'string',
                  format: 'binary',
                  description: "The resume to upload to the candidate's profile",
                },
              },
              required: ['candidateId', 'resume'],
              example: {
                id: 'f9e52a51-a075-4116-a7b8-484deba69004',
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the candidate.uploadResume endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1candidate.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/candidateTag.create': {
    post: {
      summary: 'candidateTag.create',
      description:
        'Creates a candidate tag.\n\n**Requires the [`hiringProcessMetadataWrite`](authentication#permissions-candidatetagcreate) permission.**\n',
      operationId: 'candidatetagcreate',
      tags: ['Candidate Tag'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['title'],
              properties: {
                title: {
                  type: 'string',
                  description:
                    "The tag's title. If a tag already exists with that title, the existing tag will be returned.",
                  example: 'Strong candidate',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the location.create endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            description: 'A tag applied to a candidate',
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                description: "The tag's unique id",
                              },
                              title: {
                                type: 'string',
                                example: 'Senior Candidate',
                              },
                              isArchived: {
                                $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived',
                              },
                            },
                            required: ['id', 'title', 'isArchived'],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/candidateTag.list': {
    post: {
      summary: 'candidateTag.list',
      operationId: 'candidateTagList',
      description:
        'Lists all candidate tags\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-candidatetaglist) permission.**\n',
      tags: ['Candidate Tag'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  type: 'object',
                  properties: {
                    includeArchived: {
                      type: 'boolean',
                      default: false,
                      description: 'Whether archived candidate tags should be included in the response',
                    },
                  },
                },
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema',
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the candidateTag.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success Response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/paths/~1candidateTag.create/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/customField.create': {
    post: {
      summary: 'customField.create',
      operationId: 'customFieldCreate',
      description:
        'Create a new custom field\n\n**Requires the [`hiringProcessMetadataWrite`](authentication#permissions-customfieldcreate) permission.**\n',
      tags: ['Custom Field'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['fieldType', 'objectType', 'title'],
              properties: {
                fieldType: {
                  type: 'string',
                  description: 'The type of field being created. This value is case-sensitive.',
                  enum: [
                    'Boolean',
                    'CompensationRange',
                    'Date',
                    'LongText',
                    'MultiValueSelect',
                    'Number',
                    'NumberRange',
                    'String',
                    'ValueSelect',
                  ],
                },
                objectType: {
                  type: 'string',
                  description: 'The type of object the field can be associated with.',
                  enum: [
                    'Application',
                    'Candidate',
                    'Job',
                    'Employee',
                    'Talent_Project',
                    'Opening_Version',
                    'Offer_Version',
                  ],
                },
                title: {
                  type: 'string',
                  description: 'The name of the field',
                },
                description: {
                  type: 'string',
                  description: 'A description for the field',
                },
                selectableValues: {
                  type: 'array',
                  description:
                    'Required when the field type is ValueSelect or MultiValueSelect. An array of selectable values for the field.',
                  items: {
                    properties: {
                      label: {
                        type: 'string',
                      },
                      value: {
                        type: 'string',
                      },
                    },
                    required: ['label', 'value'],
                    type: 'object',
                  },
                },
                isDateOnlyField: {
                  type: 'boolean',
                  description:
                    'Only applies to fields with an objectType of Date. Whether or not the field includes content other than a date',
                },
                isExposableToCandidate: {
                  type: 'boolean',
                  description:
                    'Determines whether the field can be exposed to a candidate in certain contexts. In order for a custom field to be available in an email template this value must be true.',
                  default: false,
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the customField.create endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1customField.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/customField.info': {
    post: {
      summary: 'customField.info',
      operationId: 'customFieldInfo',
      description:
        'Get information about a custom field\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-customfieldinfo) permission.**\n',
      tags: ['Custom Field'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  type: 'object',
                  properties: {
                    customFieldId: {
                      type: 'string',
                      format: 'uuid',
                      description: 'The id of the custom field to fetch',
                    },
                  },
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the customField.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success Response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                              },
                              title: {
                                type: 'string',
                                example: 'Preferred Teams',
                              },
                              objectType: {
                                type: 'string',
                                description: 'The type of object in Ashby the custom field is associated with',
                                enum: [
                                  'Application',
                                  'Candidate',
                                  'Employee',
                                  'Job',
                                  'Offer',
                                  'Opening',
                                  'Talent_Project',
                                ],
                              },
                              isArchived: {
                                $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived',
                              },
                              fieldType: {
                                type: 'string',
                                description: 'The type of data stored in the custom field',
                                enum: [
                                  'MultiValueSelect',
                                  'NumberRange',
                                  'String',
                                  'Date',
                                  'ValueSelect',
                                  'Number',
                                  'Currency',
                                  'Boolean',
                                  'LongText',
                                  'CompensationRange',
                                  'NumberRange',
                                ],
                              },
                              selectableValues: {
                                description:
                                  'An array of values that can be selected for custom fields with a fieldType of MultiValueSelect.\nIf the fieldType is not MultiValueSelect, `selectableValues` will not be present in the response\n',
                                type: 'array',
                                items: {
                                  type: 'object',
                                  properties: {
                                    label: {
                                      type: 'string',
                                      example: 'Backend Engineering',
                                    },
                                    value: {
                                      type: 'string',
                                      example: 'Backend Engineering',
                                    },
                                    isArchived: {
                                      $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived',
                                    },
                                  },
                                },
                              },
                            },
                            required: ['id', 'title', 'objectType', 'isArchived', 'fieldType'],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/customField.list': {
    post: {
      summary: 'customField.list',
      operationId: 'customFieldList',
      description:
        'Lists all custom fields\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-customfieldlist) permission.**\n',
      tags: ['Custom Field'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  type: 'object',
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema',
                  properties: {
                    includeArchived: {
                      type: 'boolean',
                      description: 'If true, archived custom fields will be included in the response',
                      default: false,
                    },
                  },
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the customField.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success Response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/paths/~1customField.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results',
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/customField.setValue': {
    post: {
      summary: 'customField.setValue',
      operationId: 'customFieldSetValue',
      description:
        'Set the value of a custom field\n\n**Requires the [`candidatesWrite`](authentication#permissions-customfieldsetvalue) permission.**\n\nThe values accepted in the `fieldValue` param depend on the type of field that\'s being updated. See below for more details:\n  - Boolean - A boolean value\n  - Date - An ISO Date string\n  - Email, LongText, Phone, String - String\n  - ValueSelect - A string that matches the value of one of the ValueSelect field\'s options\n  - MultiValueSelect - An array of strings that exist in the MultiValueSelect field\'s options\n  - Number - A number\n  - NumberRange - An object with the following properties:\n    - type: "number-range"\n    - minValue: A number\n    - maxValue: A number\n  - CompensationRange - An object with the following properties:\n    - type: "compensation-range"\n    - minValue: A number\n    - maxValue: A number\n    - currencyCode: A string\n    - interval: A valid interval string\n',
      tags: ['Custom Field'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['objectId', 'objectType', 'fieldId', 'fieldValue'],
              properties: {
                objectId: {
                  allOf: [
                    {
                      description: 'The id of the object the field value is being set on.',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                objectType: {
                  type: 'string',
                  description: 'The type of object the field is associated with.',
                  enum: ['Application', 'Candidate', 'Job', 'Opening'],
                },
                fieldId: {
                  allOf: [
                    {
                      description: 'The unique id of the Custom Field definition for the field',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                fieldValue: {
                  description: 'The value to store in the field',
                  oneOf: [
                    {
                      type: 'boolean',
                      title: 'Boolean',
                      description: 'A boolean value',
                    },
                    {
                      type: 'string',
                      title: 'Date',
                      format: 'date-time',
                      description: 'An ISO Date string',
                    },
                    {
                      type: 'string',
                      title: 'String, Email, LongText, Phone',
                      description: 'A string',
                    },
                    {
                      type: 'array',
                      title: 'MultiValueSelect',
                      items: {
                        type: 'string',
                        description: "An array of strings that exist in the MultiValueSelect field's options",
                      },
                    },
                    {
                      type: 'number',
                      title: 'Number',
                      description: 'A number',
                    },
                    {
                      type: 'string',
                      title: 'ValueSelect',
                      description: "A string that matches the value of one of the ValueSelect field's options",
                    },
                    {
                      type: 'object',
                      title: 'NumberRange',
                      required: ['type', 'minValue', 'maxValue'],
                      properties: {
                        type: {
                          type: 'string',
                          example: 'number-range',
                        },
                        minValue: {
                          type: 'number',
                          example: 10000,
                        },
                        maxValue: {
                          type: 'number',
                          example: 100000,
                        },
                      },
                      description: 'An object describing the number range',
                    },
                    {
                      type: 'object',
                      title: 'CompensationRange',
                      required: ['type', 'minValue', 'maxValue', 'currencyCode', 'interval'],
                      properties: {
                        type: {
                          type: 'string',
                          example: 'compensation-range',
                        },
                        minValue: {
                          type: 'number',
                          example: 10000,
                        },
                        maxValue: {
                          type: 'number',
                          example: 100000,
                        },
                        currencyCode: {
                          type: 'string',
                          example: 'USD',
                        },
                        interval: {
                          type: 'string',
                          enum: [
                            'NONE',
                            '1 TIME',
                            '1 HOUR',
                            '1 DAY',
                            '1 WEEK',
                            '2 WEEK',
                            '1 MONTH',
                            '2 MONTH',
                            '1 YEAR',
                            '6 MONTH',
                            '0.5 MONTH',
                            '3 MONTH',
                          ],
                          example: '1 YEAR',
                        },
                      },
                      description: 'An object describing the compensation range',
                    },
                  ],
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the customField.create endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                              },
                              title: {
                                type: 'string',
                              },
                              value: {
                                oneOf: [
                                  {
                                    type: 'boolean',
                                    title: 'Boolean',
                                  },
                                  {
                                    type: 'object',
                                    title: 'Currency',
                                    properties: {
                                      value: {
                                        type: 'number',
                                        example: 1000000,
                                        format: 'currency',
                                      },
                                      currencyCode: {
                                        type: 'string',
                                        example: 'USD',
                                      },
                                    },
                                  },
                                  {
                                    type: 'string',
                                    title: 'Date',
                                    format: 'date-time',
                                  },
                                  {
                                    type: 'string',
                                    title: 'String',
                                  },
                                  {
                                    type: 'string',
                                    title: 'LongText',
                                  },
                                  {
                                    type: 'array',
                                    title: 'MultiValueSelect',
                                    items: {
                                      type: 'string',
                                    },
                                  },
                                  {
                                    type: 'number',
                                    title: 'Number',
                                  },
                                  {
                                    type: 'object',
                                    title: 'NumberRange',
                                    properties: {
                                      required: ['type', 'minValue', 'maxValue'],
                                      type: {
                                        type: 'string',
                                        example: 'number-range',
                                      },
                                      minValue: {
                                        type: 'number',
                                        example: 10000,
                                      },
                                      maxValue: {
                                        type: 'number',
                                        example: 100000,
                                      },
                                    },
                                  },
                                  {
                                    type: 'object',
                                    title: 'CompensationRange',
                                    properties: {
                                      required: ['type', 'minValue', 'maxValue', 'currencyCode', 'interval'],
                                      type: {
                                        type: 'string',
                                        example: 'compensation-range',
                                      },
                                      minValue: {
                                        type: 'number',
                                        example: 40000,
                                      },
                                      maxValue: {
                                        type: 'number',
                                        example: 50000,
                                      },
                                      currencyCode: {
                                        type: 'string',
                                        example: 'USD',
                                      },
                                      interval: {
                                        type: 'string',
                                        enum: [
                                          'NONE',
                                          '1 TIME',
                                          '1 HOUR',
                                          '1 DAY',
                                          '1 WEEK',
                                          '2 WEEK',
                                          '1 MONTH',
                                          '2 MONTH',
                                          '1 YEAR',
                                          '6 MONTH',
                                          '0.5 MONTH',
                                          '3 MONTH',
                                        ],
                                        example: '1 YEAR',
                                      },
                                    },
                                  },
                                  {
                                    type: 'string',
                                    title: 'ValueSelect',
                                  },
                                ],
                              },
                            },
                            required: ['id', 'title', 'value'],
                            example: {
                              id: '650e5f74-32db-4a0a-b61b-b9afece05023',
                              title: 'Expected start date',
                              value: '2022-11-10T19:47:56.795Z',
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/department.create': {
    post: {
      summary: 'department.create',
      description:
        'Creates a department\n\n**Requires the [`organizationWrite`](authentication#permissions-departmentcreate) permission.**\n',
      operationId: 'departmentcreate',
      tags: ['Department & Team'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: {
                name: {
                  type: 'string',
                  description: 'The name of the department',
                  example: 'Engineering',
                },
                parentId: {
                  type: 'string',
                  format: 'uuid',
                  description: "The id of the department's parent department",
                  example: '1be42b8e-cafd-4beb-8121-f4981eb20f42',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the department.create endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1department.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/department.info': {
    post: {
      summary: 'department.info',
      operationId: 'departmentInfo',
      description:
        'Fetch department details by id\n\n**Requires the [`organizationRead`](authentication#permissions-departmentinfo) permission.**\n',
      tags: ['Department'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                departmentId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The unique id of the department whose details will be fetched',
                    },
                  ],
                },
              },
              required: ['departmentId'],
              example: {
                departmentId: '3ae2b801-19f6-41ef-ad28-214bd731948f',
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the department.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                              },
                              name: {
                                type: 'string',
                                example: 'Engineering',
                              },
                              isArchived: {
                                $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived',
                              },
                              parentId: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                              },
                            },
                            required: ['id', 'name', 'isArchived'],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/department.list': {
    post: {
      summary: 'department.list',
      operationId: 'departmentList',
      description:
        'Lists all departments\n\n**Requires the [`organizationRead`](authentication#permissions-departmentlist) permission.**\n',
      tags: ['Department'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  type: 'object',
                  properties: {
                    includeArchived: {
                      type: 'boolean',
                      default: false,
                      description: 'Whether archived departments should be included in the response',
                    },
                  },
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the department.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success Response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/paths/~1department.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/file.info': {
    post: {
      summary: 'file.info',
      description:
        'Retrieve the url of a file associated with a candidate\n\n**Requires the [`candidatesRead`](authentication#permissions-fileinfo) permission.**\n',
      operationId: 'fileInfo',
      tags: ['File'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                fileHandle: {
                  type: 'string',
                  description: 'A file handle retrieved from the public API',
                  example:
                    'eyJoYW5kbGUiOnsidHlwZSI6IkNhbmRpZGF0ZUZpbGUiLCJmaWxlSWQiOiIxNTk1ZTRmYy04MTQwLTQ1NGUtYTI1ZC04NTNiOTQ3ZWNmYzgiLCJvd25lcklkIjoiYmY5NGZlNmMtMjU3MS00NzQ1LWE1OWEtNTA5MjE3ODI3MDVlIn0sInNpZ25hdHVyZSI6IkFqclpjT0VlTXUwdWxLZlRCS05iMWRkbDdHcjVIWFVmZzNrS0NPL1dWWjg9IiwidmVyc2lvbiI6IjEilQ\n',
                },
              },
              required: ['fileHandle'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the file.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              url: {
                                type: 'string',
                                description: 'The url of the file',
                                example: 'https://s3.amazonaws.com/...',
                              },
                            },
                            required: ['url'],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/feedbackFormDefinition.info': {
    post: {
      summary: 'feedbackFormDefinition.info',
      operationId: 'feedbackFormDefinitionInfo',
      description:
        'Returns a single feedback form by id\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-feedbackformdefinitioninfo) permission.**\n',
      tags: ['Feedback Form Definition'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['feedbackFormDefinitionId'],
              properties: {
                feedbackFormDefinitionId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: "The unique id of the feedback form you'd like to fetch.",
                    },
                    {
                      example: '9b17887e-5add-49e8-9a03-ffffa669aa2f',
                    },
                  ],
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the feedbackFormDefinition.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success Response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        properties: {
                          results: {
                            allOf: [
                              {
                                $ref: '#/paths/~1referralForm.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/allOf/0',
                              },
                              {
                                type: 'object',
                                properties: {
                                  organizationId: {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                  isDefaultForm: {
                                    type: 'boolean',
                                    example: true,
                                  },
                                  interviewId: {
                                    allOf: [
                                      {
                                        $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                      },
                                      {
                                        description: 'The id of the interview associated with the feedback form.',
                                      },
                                    ],
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/feedbackFormDefinition.list': {
    post: {
      summary: 'feedbackFormDefinition.list',
      operationId: 'feedbackFormDefinitionList',
      description:
        'Lists all feedback forms\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-feedbackformdefinitionlist) permission.**\n',
      tags: ['Feedback Form Definition'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                includeArchived: {
                  $ref: '#/paths/~1source.list/post/requestBody/content/application~1json/schema/properties/includeArchived',
                },
                cursor: {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema/properties/cursor',
                },
                syncToken: {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema/properties/syncToken',
                },
                limit: {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema/properties/limit',
                },
              },
              example: {
                includeArchived: false,
                cursor: 'qA',
                syncToken: '6W05prn4d',
                limit: 25,
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the feedbackFormDefinition.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/paths/~1feedbackFormDefinition.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results',
                            },
                          },
                        },
                      },
                    ],
                    required: ['results'],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/hiringTeam.addMember': {
    post: {
      summary: 'hiringTeam.addMember',
      description:
        'Adds an Ashby user to the hiring team at the application or job-level. \n\n**Requires the [`organizationWrite`](authentication#permissions-hiringteamaddmember) permission.**\n\nHiring team members can be added to a hiring team at the application, job, or opening level. \n',
      operationId: 'hiringteamaddmember',
      tags: ['Hiring Team'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  type: 'object',
                  title: 'Application-level',
                  required: ['applicationId', 'teamMemberId', 'roleId'],
                  properties: {
                    applicationId: {
                      allOf: [
                        {
                          description: 'The application to assign the user a role on.',
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                      ],
                    },
                    teamMemberId: {
                      allOf: [
                        {
                          description: 'The id of the user to assign the role to.',
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                      ],
                    },
                    roleId: {
                      allOf: [
                        {
                          description: 'The id of the hiring team role to assign.',
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                      ],
                    },
                  },
                },
                {
                  type: 'object',
                  title: 'Job-level',
                  required: ['jobId', 'teamMemberId', 'roleId'],
                  properties: {
                    jobId: {
                      allOf: [
                        {
                          description: 'The job to assign the user a role on.',
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                      ],
                    },
                    teamMemberId: {
                      allOf: [
                        {
                          description: 'The id of the user to assign the role to.',
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                      ],
                    },
                    roleId: {
                      allOf: [
                        {
                          description: 'The id of the hiring team role to assign.',
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                      ],
                    },
                  },
                },
                {
                  type: 'object',
                  title: 'Opening-level',
                  required: ['openingId', 'teamMemberId', 'roleId'],
                  properties: {
                    openingId: {
                      allOf: [
                        {
                          description: 'The opening to assign the user a role on.',
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                      ],
                    },
                    teamMemberId: {
                      allOf: [
                        {
                          description: 'The id of the user to assign the role to.',
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                      ],
                    },
                    roleId: {
                      allOf: [
                        {
                          description: 'The id of the hiring team role to assign.',
                        },
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the hiringTeam.addMember endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              email: {
                                $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/email/allOf/0',
                              },
                              firstName: {
                                type: 'string',
                                example: 'Joey',
                              },
                              lastName: {
                                type: 'string',
                                example: 'Joe',
                              },
                              role: {
                                type: 'string',
                                example: 'Hiring Manager',
                              },
                              userId: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                              },
                            },
                            required: ['userId', 'firstName', 'lastName', 'email', 'role'],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/hiringTeamRole.list': {
    post: {
      summary: 'hiringTeamRole.list',
      description:
        'Lists the possible hiring team roles in an organization\n\n**Requires the [`organizationRead`](authentication#permissions-hiringteamrolelist) permission.**\n',
      operationId: 'hiringteamrolelist',
      tags: ['Hiring Team Role'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                namesOnly: {
                  type: 'boolean',
                  description:
                    'When set to true (the default), an array of role titles is returned. When set to false, an array of objects that include the id and title of the role is returned.',
                  default: true,
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the hiringTeamRole.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'namesOnly: true',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              type: 'string',
                            },
                            example: ['Recruiter'],
                          },
                        },
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'namesOnly: false',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                },
                                title: {
                                  type: 'string',
                                  example: 'Recruiter',
                                },
                              },
                            },
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interview.info': {
    post: {
      summary: 'interview.info',
      operationId: 'interviewInfo',
      description:
        'Fetch interview details by id\n\n**Requires the [`interviewsRead`](authentication#permissions-interviewinfo) permission.**\n',
      tags: ['Interview'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                id: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The unique id of the interview whose details will be fetched',
                    },
                  ],
                },
              },
              required: ['id'],
              example: {
                id: '3ae2b801-19f6-41ef-ad28-214bd731948f',
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the interview.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              id: {
                                allOf: [
                                  {
                                    description: "The interview's id",
                                  },
                                  {
                                    example: '3ae2b801-19f6-41ef-ad28-214bd731948f',
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                              title: {
                                type: 'string',
                                example: 'Technical Phone Interview',
                                description: "The interview's title",
                              },
                              isArchived: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived',
                                  },
                                  {
                                    description: 'Whether or not the interview is archived',
                                  },
                                ],
                              },
                              isDebrief: {
                                type: 'boolean',
                                example: false,
                                description: 'Whether the interview is a debrief',
                              },
                              instructionsHtml: {
                                type: 'string',
                                description: "An HTML version of the interview's description",
                                example:
                                  '<p>The technical phone interview consists of a 60-minute series of techincal questions</p>\n',
                              },
                              instructionsPlain: {
                                type: 'string',
                                description: "A plaintext version of the interview's description",
                                example:
                                  'The technical phone interview consists of a 60-minute series of techincal questions',
                              },
                              jobId: {
                                allOf: [
                                  {
                                    description:
                                      'The id of the job the interview is associated with. If null, the interview is not associated with a specific job\nand is a shared interview. Interviews that are associated with particular jobs can only be scheduled for applications\nto those jobs.\n',
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                              feedbackFormDefinitionId: {
                                allOf: [
                                  {
                                    description:
                                      'The id of the feedback form definition associated with the interview. \n',
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                            },
                            required: ['id', 'title', 'isArchived', 'feedbackFormDefinitionId'],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interview.list': {
    post: {
      summary: 'interview.list',
      operationId: 'interviewList',
      description:
        'List all interviews\n\n**Requires the [`interviewsRead`](authentication#permissions-interviewlist) permission.**\n',
      tags: ['Interview'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema',
                },
                {
                  type: 'object',
                  properties: {
                    includeArchived: {
                      $ref: '#/paths/~1source.list/post/requestBody/content/application~1json/schema/properties/includeArchived',
                    },
                    includeNonSharedInterviews: {
                      type: 'boolean',
                      default: false,
                      description:
                        'If true, interviews that are associated with specific jobs will be included in the response. \nShared interviews that are not associated with a specific job can be scheduled for applications to any job.\nInterviews that are not shared can only be scheduled for applications to the job they are associated with. \n',
                    },
                  },
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the interview.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/paths/~1interview.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interviewEvent.list': {
    post: {
      summary: 'interviewEvent.list',
      operationId: 'interviewEventList',
      description:
        'Lists interview events associated with an interview schedule\n\n**Requires the [`interviewsRead`](authentication#permissions-intervieweventlist) permission.**\n',
      tags: ['Interview Event'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                interviewScheduleId: {
                  allOf: [
                    {
                      description: 'The unique ID of the interview schedule, for which to list interview events',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                expand: {
                  type: 'array',
                  description: 'Choose to expand the result and include additional data for related objects. \n',
                  items: {
                    enum: ['interview'],
                  },
                },
              },
              required: ['interviewScheduleId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the interviewEvent.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: {
                                  allOf: [
                                    {
                                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                    },
                                    {
                                      description: "The interview event's id",
                                    },
                                    {
                                      example: '3ae2b801-19f6-41ef-ad28-214bd731948f',
                                    },
                                  ],
                                },
                                interviewId: {
                                  allOf: [
                                    {
                                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                    },
                                    {
                                      description: "The interview's id",
                                    },
                                    {
                                      example: 'ff6c7d9d-71e3-4c9c-88b1-28824980c276',
                                    },
                                  ],
                                },
                                interviewScheduleId: {
                                  allOf: [
                                    {
                                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                    },
                                    {
                                      description: "The interview schedule's id",
                                    },
                                    {
                                      example: '9d34f544-c150-4d70-91c4-e8b0b4a72846',
                                    },
                                  ],
                                },
                                interviewerUserIds: {
                                  type: 'array',
                                  items: {
                                    allOf: [
                                      {
                                        $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                      },
                                      {
                                        description: 'An array of the ids of all interviewers',
                                      },
                                      {
                                        example: 'caea4d97-331d-46b1-a8e3-6b821c2214ef',
                                      },
                                    ],
                                  },
                                },
                                createdAt: {
                                  allOf: [
                                    {
                                      description: 'The time the interview event was created',
                                    },
                                    {
                                      $ref: '#/paths/~1application.create/post/requestBody/content/application~1json/schema/properties/applicationHistory/allOf/0/items/properties/enteredStageAt/allOf/0',
                                    },
                                  ],
                                  type: 'string',
                                },
                                startTime: {
                                  allOf: [
                                    {
                                      description: 'The time the interview event is scheduled to start',
                                    },
                                    {
                                      $ref: '#/paths/~1application.create/post/requestBody/content/application~1json/schema/properties/applicationHistory/allOf/0/items/properties/enteredStageAt/allOf/0',
                                    },
                                  ],
                                  type: 'string',
                                },
                                endTime: {
                                  allOf: [
                                    {
                                      description: 'The time the interview event is scheduled to end',
                                    },
                                    {
                                      $ref: '#/paths/~1application.create/post/requestBody/content/application~1json/schema/properties/applicationHistory/allOf/0/items/properties/enteredStageAt/allOf/0',
                                    },
                                  ],
                                  type: 'string',
                                },
                                feedbackLink: {
                                  type: 'string',
                                  format: 'uri',
                                  example:
                                    'https://app.ashbyhq.com/interview-briefings/4736b6d2-5c97-43a6-a7c6-0228bf079411/feedback',
                                  description: 'The link to submit feedback for the interview event',
                                },
                                location: {
                                  type: 'string',
                                  description: 'The location of the interview',
                                  example: 'Google Meet',
                                },
                                meetingLink: {
                                  type: 'string',
                                  format: 'uri',
                                  description:
                                    'A link to the virtual meeting (if the interview is being hosted virtually)',
                                },
                                hasSubmittedFeedback: {
                                  type: 'boolean',
                                  description: 'Whether or not this interview has any feedback submitted',
                                },
                                interview: {
                                  description:
                                    'The interview associated with this event (only included if the expand parameter includes "interview")',
                                  $ref: '#/paths/~1interview.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                                },
                              },
                              required: [
                                'id',
                                'interviewId',
                                'interviewScheduleId',
                                'interviewerUserIds',
                                'createdAt',
                                'startTime',
                                'endTime',
                                'feedbackLink',
                                'hasSubmittedFeedback',
                              ],
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interviewPlan.list': {
    post: {
      summary: 'interviewPlan.list',
      operationId: 'interviewPlanList',
      description:
        'List all interview plans.\n\n**Requires the [`interviewsRead`](authentication#permissions-interviewplanlist) permission.**\n',
      tags: ['Interview Plan'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                includeArchived: {
                  $ref: '#/paths/~1source.list/post/requestBody/content/application~1json/schema/properties/includeArchived',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the interviewPlan.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          moreDataAvailable: {
                            $ref: '#/paths/~1source.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/moreDataAvailable',
                          },
                          results: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                },
                                title: {
                                  type: 'string',
                                  example: 'Engineering Interview Plan',
                                },
                                isArchived: {
                                  type: 'boolean',
                                  example: false,
                                },
                              },
                              required: ['id', 'title', 'isArchived'],
                            },
                          },
                        },
                      },
                      {
                        required: ['results', 'moreDataAvailable'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interviewSchedule.cancel': {
    post: {
      summary: 'interviewSchedule.cancel',
      operationId: 'interviewScheduleCancel',
      description:
        'Cancel an interview schedule by id\n\n**Requires the [`interviewsWrite`](authentication#permissions-interviewschedulecancel) permission.**\n',
      tags: ['Interview Schedule'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                id: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the interview schedule to cancel',
                    },
                  ],
                },
                allowReschedule: {
                  type: 'boolean',
                  description: 'Whether or not this interview schedule can be rescheduled.',
                  default: false,
                },
              },
              required: ['id'],
              example: {
                id: '3ae2b801-19f6-41ef-ad28-214bd731948f',
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the interviewSchedule.cancel endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/interviewScheduleCreate/post/requestBody/content/application~1json/schema/properties/data/properties/interviewSchedule',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interviewSchedule.create': {
    post: {
      summary: 'interviewSchedule.create',
      operationId: 'interviewScheduleCreate',
      description:
        'Create a scheduled interview in Ashby\n\n**Requires the [`interviewsWrite`](authentication#permissions-interviewschedulecreate) permission.**\n',
      tags: ['Interview Schedule'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                applicationId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the application for this interview schedule',
                    },
                  ],
                },
                interviewEvents: {
                  type: 'array',
                  description: 'The list of events that make up this interview schedule',
                  items: {
                    type: 'object',
                    required: ['startTime', 'endTime', 'interviewers'],
                    properties: {
                      startTime: {
                        type: 'string',
                        description: 'The start time of this event',
                        example: '2023-01-30T15:00:00.000Z',
                      },
                      endTime: {
                        type: 'string',
                        description: 'The end time of this event',
                        example: '2023-01-30T16:00:00.000Z',
                      },
                      interviewers: {
                        type: 'array',
                        description: 'The interviewers for this event',
                        items: {
                          type: 'object',
                          required: ['email'],
                          properties: {
                            email: {
                              type: 'string',
                              description: 'The email address of the user in Ashby',
                              example: 'test@ashbyhq.com',
                            },
                            feedbackRequired: {
                              type: 'boolean',
                              description: 'Whether this interviewer is required to provide feedback',
                            },
                          },
                        },
                      },
                      interviewId: {
                        allOf: [
                          {
                            $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                          },
                          {
                            description:
                              "The id of the interview used in this event. If no value is provided, the organization's default interview will be used.",
                          },
                          {
                            example: '46648e83-f28f-43c4-a2a0-58e0599cff41',
                          },
                        ],
                      },
                    },
                  },
                },
              },
              required: ['applicationId', 'interviewEvents'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the interviewSchedule.create endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/interviewScheduleCreate/post/requestBody/content/application~1json/schema/properties/data/properties/interviewSchedule',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interviewSchedule.list': {
    post: {
      summary: 'interviewSchedule.list',
      operationId: 'interviewScheduleList',
      description:
        'Gets all interview schedules in the organization.\n\n**Requires the [`interviewsRead`](authentication#permissions-interviewschedulelist) permission.**\n',
      tags: ['Interview Schedule'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  $ref: '#/paths/~1application.list/post/requestBody/content/application~1json/schema/allOf/0',
                },
                {
                  type: 'object',
                  properties: {
                    applicationId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                        {
                          description: 'The id of the application, for which to fetch interview schedules',
                        },
                      ],
                    },
                    interviewStageId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                        {
                          description: 'The id of the interview stage, for which to fetch interview schedules',
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the interviewSchedule.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/webhooks/interviewScheduleCreate/post/requestBody/content/application~1json/schema/properties/data/properties/interviewSchedule',
                            },
                          },
                        },
                      },
                    ],
                    required: ['results'],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interviewSchedule.update': {
    post: {
      summary: 'interviewSchedule.update',
      operationId: 'interviewScheduleUpdate',
      description:
        "Update an interview schedule. This endpoint allows you to add, cancel, or update interview events associated with an interview schedule.\n\n**Requires the [`interviewsWrite`](authentication#permissions-interviewscheduleupdate) permission.**\n\nIn order to update an interview event on a schedule, the event's `interviewEventId` must be included when sending your request. \n`interviewEventId`s are included in the response of the `interviewSchedule.create` endpoint.\n",
      tags: ['Interview Schedule'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    interviewScheduleId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                        {
                          description:
                            'The id of the interview schedule to update. \nOnly interview schedules created using the API key making the request can be updated.\n',
                        },
                      ],
                    },
                    interviewEvent: {
                      allOf: [
                        {
                          description:
                            "An event on the interview schedule to create or update.\nTo update an event, the event's `interviewEventId` must be included in the request.\n",
                        },
                        {
                          $ref: '#/paths/~1interviewSchedule.create/post/requestBody/content/application~1json/schema/properties/interviewEvents/items',
                        },
                        {
                          type: 'object',
                          properties: {
                            interviewEventId: {
                              allOf: [
                                {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                },
                                {
                                  description: 'The id of an interview event to update. \n',
                                },
                              ],
                            },
                          },
                        },
                      ],
                    },
                  },
                  required: ['interviewScheduleId', 'interviewEvent'],
                },
                {
                  type: 'object',
                  properties: {
                    interviewScheduleId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                        {
                          description:
                            'The id of the interview schedule to update. \nOnly interview schedules created using the API key making the request can be updated.\n',
                        },
                      ],
                    },
                    interviewEventIdToCancel: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                        {
                          description: 'The id of an interview event to cancel.\n',
                        },
                      ],
                    },
                    allowFeedbackDeletion: {
                      type: 'boolean',
                      default: false,
                      description:
                        'By default, we do not allow interview events with submitted feedback to be canceled because canceling an event causes its associated feedback to be deleted. If you want to allow events with submitted feedback to be canceled, this flag can be passed in and set to `true`. In this case, events with feedback will be canceled, and any associated feedback will be deleted.',
                    },
                  },
                  required: ['interviewScheduleId', 'interviewEventIdToCancel'],
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the interviewSchedule.update endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/interviewScheduleCreate/post/requestBody/content/application~1json/schema/properties/data/properties/interviewSchedule',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interviewStage.list': {
    post: {
      summary: 'interviewStage.list',
      description:
        'List all interview stages for an interview plan in order.\n\n**Requires the [`interviewsRead`](authentication#permissions-interviewstagelist) permission.**\n',
      operationId: 'interviewStageList',
      tags: ['Interview Stage'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                interviewPlanId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the interview plan to list stages for',
                    },
                  ],
                },
              },
              required: ['interviewPlanId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the interviewStage.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/paths/~1interviewStage.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                            },
                          },
                          moreDataAvailable: {
                            $ref: '#/paths/~1source.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/moreDataAvailable',
                          },
                        },
                      },
                      {
                        required: ['results', 'moreDataAvailable'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interviewStage.info': {
    post: {
      summary: 'interviewStage.info',
      operationId: 'interviewStageInfo',
      description:
        'Fetch interview stage details by id\n\n**Requires the [`interviewsRead`](authentication#permissions-interviewstageinfo) permission.**\n',
      tags: ['Interview Stage'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                interviewStageId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The unique id of the interview stage whose details will be fetched',
                    },
                  ],
                },
              },
              required: ['interviewStageId'],
              example: {
                interviewStageId: '3ae2b801-19f6-41ef-ad28-214bd731948f',
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the interviewStage.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            allOf: [
                              {
                                type: 'object',
                                properties: {
                                  id: {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                  title: {
                                    type: 'string',
                                    example: 'Offer',
                                  },
                                  type: {
                                    type: 'string',
                                    example: 'Offer',
                                  },
                                  orderInInterviewPlan: {
                                    type: 'integer',
                                    example: 1006,
                                    default: 0,
                                  },
                                  interviewStageGroupId: {
                                    type: 'string',
                                    example: '5f7b3b3b-7b1b-4b1b-8b3b-7b1b4b1b8b3b',
                                  },
                                },
                                required: ['id', 'title', 'type', 'orderInInterviewPlan'],
                              },
                              {
                                type: 'object',
                                properties: {
                                  interviewPlanId: {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                },
                                required: ['interviewPlanId'],
                              },
                            ],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interviewStageGroup.list': {
    post: {
      summary: 'interviewStageGroup.list',
      description:
        'List all interview group stages for an interview plan in order.\n\n**Requires the [`interviewsRead`](authentication#permissions-interviewstagelist) permission.**\n',
      operationId: 'interviewStageGroupList',
      tags: ['Interview Stage Group'],
      responses: {
        '200': {
          description: 'Responses for the interviewStageGroup.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              allOf: [
                                {
                                  type: 'object',
                                  properties: {
                                    id: {
                                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                    },
                                    title: {
                                      type: 'string',
                                      example: 'Technical Screening',
                                    },
                                    order: {
                                      type: 'integer',
                                      example: 1,
                                    },
                                    stageType: {
                                      type: 'string',
                                      enum: ['Lead', 'PreInterviewScreen', 'Active', 'Offer', 'Hired', 'Archived'],
                                      example: 'Active',
                                    },
                                  },
                                  required: ['id', 'title', 'order', 'stageType'],
                                },
                              ],
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interviewerPool.list': {
    post: {
      summary: 'interviewerPool.list',
      operationId: 'interviewerPoolList',
      description:
        'List all interviewer pools\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-interviewerpoollist) permission.**\n',
      tags: ['Interviewer Pool'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema',
                },
                {
                  type: 'object',
                  properties: {
                    includeArchivedPools: {
                      type: 'boolean',
                      description: 'When true, includes archived pools',
                      default: false,
                    },
                    includeArchivedTrainingStages: {
                      type: 'boolean',
                      description: 'When true, includes archived training stages',
                      default: false,
                    },
                  },
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the interviewerPool.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: {
                                  allOf: [
                                    {
                                      description: "The pool's id",
                                    },
                                    {
                                      example: '3ae2b801-19f6-41ef-ad28-214bd731948f',
                                    },
                                    {
                                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                    },
                                  ],
                                },
                                title: {
                                  type: 'string',
                                  example: 'Backend Technical Screeners',
                                  description: "The pool's title",
                                },
                                isArchived: {
                                  allOf: [
                                    {
                                      $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived',
                                    },
                                    {
                                      description: 'Whether or not the pool is archived',
                                    },
                                  ],
                                },
                                trainingPath: {
                                  type: 'object',
                                  properties: {
                                    id: {
                                      allOf: [
                                        {
                                          description: "The training path's id",
                                        },
                                        {
                                          example: '3ae2b801-19f6-41ef-ad28-214bd731948f',
                                        },
                                        {
                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                        },
                                      ],
                                    },
                                    enabled: {
                                      type: 'boolean',
                                      description: 'Whether or not the training path is enabled',
                                      example: true,
                                    },
                                    trainingStages: {
                                      type: 'array',
                                      items: {
                                        type: 'object',
                                        properties: {
                                          id: {
                                            allOf: [
                                              {
                                                description: "The training stage's id",
                                              },
                                              {
                                                example: '3ae2b801-19f6-41ef-ad28-214bd731948f',
                                              },
                                              {
                                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                              },
                                            ],
                                          },
                                          interviewerRole: {
                                            type: 'string',
                                            enum: ['Shadow', 'ReverseShadow'],
                                            description: 'The role of the interviewer for this stage',
                                            example: 'Shadow',
                                          },
                                          interviewsRequired: {
                                            type: 'integer',
                                            description: 'The number of interviews required for this stage',
                                            example: 2,
                                          },
                                          approvalRequired: {
                                            type: 'boolean',
                                            description: 'Whether or not approval is required for this stage',
                                            example: true,
                                          },
                                          approvers: {
                                            type: 'array',
                                            items: {
                                              $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results',
                                            },
                                          },
                                        },
                                        required: ['id', 'interviewerRole', 'interviewsRequired', 'approvalRequired'],
                                      },
                                    },
                                  },
                                  required: ['id', 'enabled', 'trainingStages'],
                                },
                              },
                              required: ['id', 'title', 'isArchived'],
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interviewerPool.info': {
    post: {
      summary: 'interviewerPool.info',
      operationId: 'interviewerPoolInfo',
      description:
        'Get information about an interviewer pool.\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-interviewerpoolinfo) permission.**\n',
      tags: ['Interviewer Pool'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                interviewerPoolId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                },
              },
              required: ['id'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the interviewerPool.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            allOf: [
                              {
                                $ref: '#/paths/~1interviewerPool.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items',
                              },
                              {
                                type: 'object',
                                properties: {
                                  qualifiedMembers: {
                                    type: 'array',
                                    items: {
                                      $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results',
                                    },
                                  },
                                  trainees: {
                                    type: 'array',
                                    items: {
                                      allOf: [
                                        {
                                          $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results',
                                        },
                                        {
                                          properties: {
                                            currentProgress: {
                                              type: 'object',
                                              properties: {
                                                trainingPathId: {
                                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                                  description: 'The id of the training path the user is currently on',
                                                },
                                                trainingStageId: {
                                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                                  description: 'The id of the training stage the user is currently in',
                                                },
                                                interviewsCompleted: {
                                                  type: 'integer',
                                                  description:
                                                    'The number of interviews the user has completed in the current stage',
                                                  example: 1,
                                                },
                                              },
                                              required: ['trainingPathId', 'trainingStageId', 'interviewsCompleted'],
                                            },
                                          },
                                        },
                                      ],
                                      required: ['currentProgress'],
                                    },
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interviewerPool.create': {
    post: {
      summary: 'interviewerPool.create',
      operationId: 'interviewerPoolCreate',
      description:
        'Create an interviewer pool.\n\n**Requires the [`hiringProcessMetadataWrite`](authentication#permissions-interviewerpoolcreate) permission.**\n',
      tags: ['Interviewer Pool'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'The title of the interviewer pool',
                  example: 'Engineering',
                },
                requiresTraining: {
                  type: 'boolean',
                  description: 'Whether the interviewer pool requires training',
                  example: true,
                },
              },
              required: ['title'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the interviewerPool.create endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1interviewerPool.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interviewerPool.update': {
    post: {
      summary: 'interviewerPool.update',
      operationId: 'interviewerPoolUpdate',
      description:
        'Update an interviewer pool.\n\n**Requires the [`hiringProcessMetadataWrite`](authentication#permissions-interviewerpoolupdate) permission.**\n',
      tags: ['Interviewer Pool'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                interviewerPoolId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                },
                title: {
                  type: 'string',
                  description: 'The title of the interviewer pool',
                  example: 'Engineering',
                },
                requiresTraining: {
                  type: 'boolean',
                  description: 'Whether the interviewer pool requires training',
                  example: true,
                },
              },
              required: ['interviewerPoolId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the interviewerPool.update endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1interviewerPool.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interviewerPool.archive': {
    post: {
      summary: 'interviewerPool.archive',
      operationId: 'interviewerPoolArchive',
      description:
        'Archives an interviewer pool.\n\n**Requires the [`hiringProcessMetadataWrite`](authentication#permissions-interviewerpoolarchive) permission.**\n',
      tags: ['Interviewer Pool'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                interviewerPoolId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                },
              },
              required: ['id'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the interviewerPool.archive endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1interviewerPool.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interviewerPool.restore': {
    post: {
      summary: 'interviewerPool.restore',
      operationId: 'interviewerPool.restore',
      description:
        'Restores an archived interviewer pool.\n\n**Requires the [`hiringProcessMetadataWrite`](authentication#permissions-interviewerpoolrestore) permission.**\n',
      tags: ['Interviewer Pool'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                interviewerPoolId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                },
              },
              required: ['id'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the interviewerPool.restore endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1interviewerPool.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interviewerPool.addUser': {
    post: {
      summary: 'interviewerPool.addUser',
      operationId: 'interviewerPoolAddUser',
      description:
        'Add a user to an interviewer pool.\n\n**Requires the [`hiringProcessMetadataWrite`](authentication#permissions-interviewerpooladduser) permission.**\n',
      tags: ['Interviewer Pool'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                interviewerPoolId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                },
                userId: {
                  type: 'string',
                  format: 'uuid',
                  example: 'e9ed20fd-d45f-4aad-8a00-a19bfba0083e',
                },
                interviewerPoolTrainingPathStageId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                  description:
                    'The ID of the training path stage to add the user to. If this is not provided, the user will be added as a fully qualified member of the pool.',
                },
              },
              required: ['interviewerPoolId', 'userId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the interviewerPool.removeUser endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1interviewerPool.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/interviewerPool.removeUser': {
    post: {
      summary: 'interviewerPool.removeUser',
      operationId: 'interviewerPoolRemoveUser',
      description:
        'Remove a user from an interviewer pool.\n\n**Requires the [`hiringProcessMetadataWrite`](authentication#permissions-interviewerpoolremoveuser) permission.**\n',
      tags: ['Interviewer Pool'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                interviewerPoolId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                },
                userId: {
                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                },
              },
              required: ['interviewerPoolId', 'userId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the interviewerPool.removeUser endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1interviewerPool.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/job.create': {
    post: {
      summary: 'job.create',
      operationId: 'jobCreate',
      description:
        'Creates a new job\n\n**Requires the [`jobsWrite`](authentication#permissions-jobcreate) permission.**\n',
      tags: ['Job'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  example: 'Software Engineer',
                  description: 'The title of the job.',
                },
                teamId: {
                  allOf: [
                    {
                      description: 'The id of the department or team associated with the job',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                locationId: {
                  allOf: [
                    {
                      description: 'The id of the location of the job',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                defaultInterviewPlanId: {
                  allOf: [
                    {
                      description:
                        'The id of the default interview plan for this job posting. \nA job cannot be opened without a default interview plan.\n',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                jobTemplateId: {
                  allOf: [
                    {
                      description: 'The id of the job template to use for this job posting.',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
              },
              required: ['title', 'teamId', 'locationId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the job.create endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/jobCreate/post/requestBody/content/application~1json/schema/properties/data/properties/job',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/job.info': {
    post: {
      summary: 'job.info',
      operationId: 'jobInfo',
      description:
        'Returns details about a single job by id\n\n**Requires the [`jobsRead`](authentication#permissions-jobinfo) permission.**\n',
      tags: ['Job'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: {
                  allOf: [
                    {
                      description: 'The id of the job to fetch',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                includeUnpublishedJobPostingsIds: {
                  type: 'boolean',
                  description: 'Include unpublished job posting ids',
                },
                expand: {
                  type: 'array',
                  description: 'Choose to expand the result and include additional data for related objects. \n',
                  items: {
                    type: 'string',
                    enum: ['location', 'openings'],
                  },
                },
              },
              required: ['id'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the job.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        type: 'object',
                        required: ['success'],
                        properties: {
                          success: {
                            type: 'boolean',
                            description: 'Whether the response is considered successful.',
                          },
                        },
                      },
                      {
                        type: 'object',
                        properties: {
                          results: {
                            allOf: [
                              {
                                $ref: '#/webhooks/jobCreate/post/requestBody/content/application~1json/schema/properties/data/properties/job',
                              },
                              {
                                type: 'object',
                                properties: {
                                  location: {
                                    allOf: [
                                      {
                                        $ref: '#/paths/~1location.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                                      },
                                      {
                                        description:
                                          'The location will only be included if the `location` expand parameter is included when the request is made.',
                                      },
                                    ],
                                  },
                                  openings: {
                                    description:
                                      'The openings array will only be included if the `openings` expand parameter is included when the request is made.',
                                    type: 'array',
                                    items: {
                                      $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening',
                                    },
                                  },
                                },
                              },
                            ],
                          },
                        },
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        title: 'Error response',
                      },
                      {
                        type: 'object',
                        required: ['errors'],
                        properties: {
                          errors: {
                            type: 'array',
                            items: {
                              type: 'string',
                            },
                            description: 'A list of error message strings.',
                          },
                        },
                      },
                    ],
                    example: {
                      success: false,
                      errors: ['invalid_input'],
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/job.list': {
    post: {
      summary: 'job.list',
      description:
        'List all open, closed, and archived jobs.\n\n**Requires the [`jobsRead`](authentication#permissions-joblist) permission.**\n\nTo include draft jobs, `Draft` must be specified in the `status` param.\n',
      operationId: 'jobList',
      tags: ['Job'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema',
                },
                {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'array',
                      description: 'When supplied, only jobs with the provided status(es) will be returned.',
                      items: {
                        $ref: '#/paths/~1job.setStatus/post/requestBody/content/application~1json/schema/properties/status/allOf/1',
                      },
                    },
                    openedAfter: {
                      type: 'integer',
                      format: 'int64',
                      description:
                        'Return jobs opened after this date, which is the time since the unix epoch in milliseconds',
                    },
                    openedBefore: {
                      type: 'integer',
                      format: 'int64',
                      description:
                        'Return jobs opened before this date, which is the time since the unix epoch in milliseconds',
                    },
                    closedAfter: {
                      type: 'integer',
                      format: 'int64',
                      description:
                        'Return jobs closed after this date, which is the time since the unix epoch in milliseconds',
                    },
                    closedBefore: {
                      type: 'integer',
                      format: 'int64',
                      description:
                        'Return jobs closed before this date, which is the time since the unix epoch in milliseconds',
                    },
                    includeUnpublishedJobPostingsIds: {
                      type: 'boolean',
                      description: 'Include unpublished job posting ids',
                    },
                    expand: {
                      $ref: '#/paths/~1job.info/post/requestBody/content/application~1json/schema/properties/expand',
                    },
                  },
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the jobPosting.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        allOf: [
                          {
                            $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                          },
                          {
                            title: 'Success response',
                          },
                          {
                            type: 'object',
                            properties: {
                              moreDataAvailable: {
                                type: 'boolean',
                                description: 'Whether the cursor can be used to fetch a subsequent page of data.',
                              },
                              nextCursor: {
                                $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema/properties/cursor',
                              },
                              syncToken: {
                                $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema/properties/syncToken',
                              },
                            },
                          },
                        ],
                      },
                      {
                        type: 'object',
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              allOf: [
                                {
                                  $ref: '#/webhooks/jobCreate/post/requestBody/content/application~1json/schema/properties/data/properties/job',
                                },
                                {
                                  $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/allOf/1',
                                },
                              ],
                            },
                          },
                        },
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/job.setStatus': {
    post: {
      summary: 'job.setStatus',
      operationId: 'jobSetStatus',
      description:
        "Sets the status on a job by id.\n\n**Requires the [`jobsWrite`](authentication#permissions-jobsetstatus) permission.**\n\nAll jobs are drafts when they're first created. There are a few validations around the stages a job can be transitioned to:\n- Drafts can be changed to Open or Archived\n- Open jobs can be changed to Closed\n- Closed jobs can be changed to Draft or Archived\n- Archived jobs can be changed to a Draft \n",
      tags: ['Job'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                jobId: {
                  allOf: [
                    {
                      description: 'The unique id of the job to set the status of.',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                status: {
                  allOf: [
                    {
                      description: 'The status to apply to the job.',
                    },
                    {
                      type: 'string',
                      enum: ['Draft', 'Open', 'Closed', 'Archived'],
                    },
                  ],
                },
              },
              required: ['jobId', 'status'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the job.setStatus endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/jobCreate/post/requestBody/content/application~1json/schema/properties/data/properties/job',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/job.update': {
    post: {
      summary: 'job.update',
      operationId: 'jobUpdate',
      description:
        'Updates an existing job\n\n**Requires the [`jobsWrite`](authentication#permissions-jobupdate) permission.**\n',
      tags: ['Job'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                jobId: {
                  allOf: [
                    {
                      description: 'The unique id of the job to update.',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                title: {
                  type: 'string',
                  example: 'Software Engineer',
                  description: 'A new title for the job.',
                },
                teamId: {
                  allOf: [
                    {
                      description: 'The new team to associate with the job.',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                locationId: {
                  allOf: [
                    {
                      description: 'The new location to associate with the job.',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                defaultInterviewPlanId: {
                  allOf: [
                    {
                      description: 'The new default interview plan to associate with the job.',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                customRequisitionId: {
                  allOf: [
                    {
                      description: 'The new default custom requisition id for the job.',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
              },
              required: ['jobId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the job.update endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/jobCreate/post/requestBody/content/application~1json/schema/properties/data/properties/job',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/job.search': {
    post: {
      summary: 'job.search',
      operationId: 'jobSearch',
      description:
        'Searches for jobs by title\n\n**Requires the [`jobsRead`](authentication#permissions-jobsearch) permission.**\n',
      tags: ['Job'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  example: 'Software Engineer',
                  description: 'The title of the job to search for',
                },
              },
              required: ['title'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the job.search endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/webhooks/jobCreate/post/requestBody/content/application~1json/schema/properties/data/properties/job',
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/jobBoard.list': {
    post: {
      summary: 'jobBoard.list',
      description:
        'List all enabled job boards.\n\n**Requires the [`jobsRead`](authentication#permissions-jobboardlist) permission.**\n',
      operationId: 'jobBoardList',
      tags: ['Job Board'],
      responses: {
        '200': {
          description: 'Responses for the jobBoard.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              allOf: [
                                {
                                  type: 'object',
                                  properties: {
                                    id: {
                                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                    },
                                    title: {
                                      type: 'string',
                                    },
                                    isInternal: {
                                      type: 'boolean',
                                      description: 'Whether the job board is an internal board.',
                                    },
                                  },
                                  required: ['id', 'title', 'isInternal'],
                                },
                              ],
                            },
                          },
                        },
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/jobInterviewPlan.info': {
    post: {
      summary: 'jobInterviewPlan.info',
      operationId: 'jobInterviewPlanInfo',
      description:
        "Returns a job's interview plan, including activities and interviews that need to be scheduled at each stage\n\n**Requires the [`jobsRead`](authentication#permissions-jobinterviewplaninfo) permission.**\n",
      tags: ['Job Interview Plan'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                jobId: {
                  allOf: [
                    {
                      description: 'The id of the job to fetch an interview plan for',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
              },
              required: ['jobId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the jobInterviewPlan.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              jobId: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                              interviewPlanId: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                              stages: {
                                type: 'array',
                                items: {
                                  allOf: [
                                    {
                                      $ref: '#/paths/~1interviewStage.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/allOf/0',
                                    },
                                    {
                                      type: 'object',
                                      properties: {
                                        activities: {
                                          type: 'array',
                                          items: {
                                            type: 'object',
                                            properties: {
                                              id: {
                                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                              },
                                              title: {
                                                type: 'string',
                                                example: 'Onsite Schedule',
                                              },
                                              interviews: {
                                                type: 'array',
                                                items: {
                                                  type: 'object',
                                                  properties: {
                                                    id: {
                                                      allOf: [
                                                        {
                                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                                        },
                                                      ],
                                                    },
                                                    title: {
                                                      type: 'string',
                                                      example: 'System Architecture',
                                                    },
                                                    interviewId: {
                                                      allOf: [
                                                        {
                                                          description: 'The id of the interview to be scheduled',
                                                        },
                                                        {
                                                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                                        },
                                                      ],
                                                    },
                                                    interviewDurationMinutes: {
                                                      type: 'number',
                                                      example: 30,
                                                    },
                                                    isSchedulable: {
                                                      type: 'boolean',
                                                      example: true,
                                                    },
                                                  },
                                                },
                                              },
                                            },
                                            required: ['id', 'interviews'],
                                          },
                                        },
                                      },
                                      required: ['activities'],
                                    },
                                  ],
                                },
                              },
                            },
                            description: 'A plan for conducting job interviews.',
                            required: ['jobId', 'interviewPlanId', 'stages'],
                          },
                        },
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/jobPosting.info': {
    post: {
      summary: 'jobPosting.info',
      description:
        'Retrieve an individual job posting\n\n**Requires the [`jobsRead`](authentication#permissions-jobpostinginfo) permission.**\n\nResult fields:\n- `linkedData` - Object that can be used to populate "rich results" in search engines. [See more info here](https://developers.google.com/search/docs/data-types/job-posting).\n- `applicationFormDefinition` -\tSee the guide on [Creating a custom careers page](https://developers.ashbyhq.com/docs/creating-a-custom-careers-page).\n',
      operationId: 'jobPostingInfo',
      tags: ['Job Posting'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                jobPostingId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the job posting to return',
                    },
                  ],
                },
                expand: {
                  type: 'array',
                  description: 'Choose to expand the result and include additional data for related objects. \n',
                  items: {
                    type: 'string',
                    enum: ['job'],
                  },
                },
              },
              required: ['jobPostingId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the jobPosting.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            properties: {
                              id: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                  {
                                    description: "The job posting's id",
                                  },
                                ],
                              },
                              title: {
                                type: 'string',
                                description: "The job posting's title",
                                example: 'Posting Title',
                              },
                              descriptionPlain: {
                                type: 'string',
                                description: "A plaintext version of the job posting's description",
                                example:
                                  'This example role will be part of an example team and will report to the example manager. The new hire plays a critical role in various example workflows.\n\n\n\nREQUIREMENTS\n\n - Experience writing good example job descriptions\n\n - Other exemplary skills\n\n - 3-5 years prior experience in this role\n\n - Motivation\n\n - Great english language skills\n   \n\n\nABOUT THE TEAM\n\n\nExample org is a leading software company. Example org allows real-time collaboration on important example workflows. Founded in 2012 we have over 10,000 customers worldwide and are backed by fantastic investors such as Sequoia Capital.\n\n',
                              },
                              descriptionHtml: {
                                type: 'string',
                                description: "An HTML version of the job posting's description",
                                example:
                                  '<p style="min-height:1.5em">This example role will be part of an example team and will report to the example manager. The new hire plays a critical role in various example workflows.</p><h1><br />Requirements</h1><ul style="min-height:1.5em"><li><p style="min-height:1.5em">Experience writing good example job descriptions</p></li><li><p style="min-height:1.5em">Other exemplary skills</p></li><li><p style="min-height:1.5em">3-5 years prior experience in this role</p></li><li><p style="min-height:1.5em">Motivation</p></li><li><p style="min-height:1.5em">Great english language skills<br /></p></li></ul><h1>About the Team</h1><p style="min-height:1.5em"><br />Example org is a leading software company. Example org allows real-time collaboration on important example workflows. Founded in 2012 we have over 10,000 customers worldwide and are backed by fantastic investors such as Sequoia Capital.</p><p style="min-height:1.5em"></p>',
                              },
                              descriptionSocial: {
                                type: 'string',
                                description:
                                  'A shortened job posting description displayed when shared on social media, limited to 200 characters.',
                                example:
                                  'Example org allows real-time collaboration on important example workflows. When you join as an example role, part of the example team, you will perform a critical role in various example workflows.',
                              },
                              descriptionParts: {
                                type: 'object',
                                description:
                                  "The above description broken down into the actual description on the job, and the Job Post Description Opening and Closing that is set by the admin in Ashby's Job Boards → Theme → Messaging settings.",
                                properties: {
                                  descriptionOpening: {
                                    allOf: [
                                      {
                                        $ref: '#/paths/~1jobPosting.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/descriptionParts/properties/descriptionBody/allOf/0',
                                      },
                                      {
                                        description:
                                          'The content set in the Job Post Description Opening theme settings',
                                      },
                                      {
                                        properties: {
                                          html: {
                                            description:
                                              'An HTML version of the Job Post Description Opening theme settings',
                                            example: null,
                                          },
                                          plain: {
                                            description:
                                              'A plaintext version of the Job Post Description Opening theme settings',
                                            example: null,
                                          },
                                        },
                                      },
                                    ],
                                  },
                                  descriptionBody: {
                                    allOf: [
                                      {
                                        type: 'object',
                                        properties: {
                                          html: {
                                            type: 'string',
                                          },
                                          plain: {
                                            type: 'string',
                                          },
                                        },
                                        required: ['html', 'plain'],
                                      },
                                      {
                                        description: 'The description set on the job posting',
                                      },
                                      {
                                        properties: {
                                          html: {
                                            description: 'An HTML version of the description set on the job posting',
                                            example:
                                              '<p style="min-height:1.5em">This example role will be part of an example team and will report to the example manager. The new hire plays a critical role in various example workflows.</p><h1><br />Requirements</h1><ul style="min-height:1.5em"><li><p style="min-height:1.5em">Experience writing good example job descriptions</p></li><li><p style="min-height:1.5em">Other exemplary skills</p></li><li><p style="min-height:1.5em">3-5 years prior experience in this role</p></li><li><p style="min-height:1.5em">Motivation</p></li><li><p style="min-height:1.5em">Great english language skills<br /></p></li></ul></p>',
                                          },
                                          plain: {
                                            description:
                                              'An plaintext version of the description set on the job posting',
                                            example:
                                              'This example role will be part of an example team and will report to the example manager. The new hire plays a critical role in various example workflows.\\n\\n\\n\\nREQUIREMENTS\\n\\n - Experience writing good example job descriptions\\n\\n - Other exemplary skills\\n\\n - 3-5 years prior experience in this role\\n\\n - Motivation\\n\\n - Great english language skills\\n',
                                          },
                                        },
                                      },
                                    ],
                                  },
                                  descriptionClosing: {
                                    allOf: [
                                      {
                                        $ref: '#/paths/~1jobPosting.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/descriptionParts/properties/descriptionBody/allOf/0',
                                      },
                                      {
                                        description:
                                          'The content set in the Job Post Description Closing theme settings',
                                      },
                                      {
                                        properties: {
                                          html: {
                                            description:
                                              'An HTML version of the Job Post Description Closing theme settings',
                                            example:
                                              '<h1>About the Team</h1><p style="min-height:1.5em"><br />Example org is a leading software company. Example org allows real-time collaboration on important example workflows. Founded in 2012 we have over 10,000 customers worldwide and are backed by fantastic investors such as Sequoia Capital.</p>',
                                          },
                                          plain: {
                                            description:
                                              'A plaintext version of the Job Post Description Closing theme settings',
                                            example:
                                              'ABOUT THE TEAM\\n\\n\\nExample org is a leading software company. Example org allows real-time collaboration on important example workflows. Founded in 2012 we have over 10,000 customers worldwide and are backed by fantastic investors such as Sequoia Capital.\\n\\n',
                                          },
                                        },
                                      },
                                    ],
                                  },
                                },
                                required: ['description'],
                              },
                              departmentName: {
                                type: 'string',
                                example: 'People',
                                description: 'The name of the department associated with the job posting',
                              },
                              teamName: {
                                type: 'string',
                                example: 'Recruiting Operations',
                                description: 'The name of the team associated with the job posting',
                              },
                              teamNameHierarchy: {
                                type: 'array',
                                items: {
                                  type: 'string',
                                },
                                example: ['People', 'Recruiting', 'Recruiting Operations'],
                                description: 'The hierarchy of team names associated with the job posting.',
                              },
                              jobId: {
                                allOf: [
                                  {
                                    description: 'The id of the job associated with the job posting',
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                              locationName: {
                                type: 'string',
                                example: 'Springfield',
                                description: 'The name of the primary location associated with the job posting',
                              },
                              locationIds: {
                                $ref: '#/webhooks/jobPostingUpdate/post/requestBody/content/application~1json/schema/properties/data/properties/jobPosting/properties/locationIds',
                              },
                              linkedData: {
                                type: 'object',
                                description:
                                  'An object that can be used to populate "rich results" in search engines. (https://developers.google.com/search/docs/data-types/job-posting)',
                                properties: {
                                  '@context': {
                                    type: 'string',
                                    example: 'https://schema.org/',
                                  },
                                  '@type': {
                                    type: 'string',
                                    example: 'JobPosting',
                                  },
                                  title: {
                                    type: 'string',
                                    example: 'Posting Title',
                                  },
                                  description: {
                                    type: 'string',
                                    example:
                                      '<p style="min-height:1.5em">This example role will be part of an example team and will report to the example manager. The new hire plays a critical role in various example workflows.</p><h1><br />Requirements</h1><ul style="min-height:1.5em"><li><p style="min-height:1.5em">Experience writing good example job descriptions</p></li><li><p style="min-height:1.5em">Other exemplary skills</p></li><li><p style="min-height:1.5em">3-5 years prior experience in this role</p></li><li><p style="min-height:1.5em">Motivation</p></li><li><p style="min-height:1.5em">Great english language skills<br /></p></li></ul><h1>About the Team</h1><p style="min-height:1.5em"><br />Example org is a leading software company. Example org allows real-time collaboration on important example workflows. Founded in 2012 we have over 10,000 customers worldwide and are backed by fantastic investors such as Sequoia Capital.</p><p style="min-height:1.5em"></p>',
                                  },
                                  identifier: {
                                    type: 'object',
                                    properties: {
                                      '@type': {
                                        type: 'string',
                                        example: 'PropertyValue',
                                      },
                                      name: {
                                        type: 'string',
                                        example: 'Posting Title',
                                      },
                                      value: {
                                        type: 'string',
                                        example: '4be0e8c0-9323-43a0-ab48-506789ab9c16',
                                      },
                                    },
                                  },
                                  datePosted: {
                                    type: 'string',
                                    example: '2022-07-22',
                                  },
                                  hiringOrganization: {
                                    type: 'object',
                                    properties: {
                                      '@type': {
                                        type: 'string',
                                        example: 'Organization',
                                      },
                                      name: {
                                        type: 'string',
                                        example: 'Example org',
                                      },
                                      sameAs: {
                                        type: 'string',
                                        example: '34d7c77d-e9b2-5a09-a882-cb23a225f2ec.com',
                                      },
                                    },
                                  },
                                  jobLocation: {
                                    type: 'object',
                                    properties: {
                                      '@type': {
                                        type: 'string',
                                        example: 'Place',
                                      },
                                      address: {
                                        type: 'object',
                                        properties: {
                                          '@type': {
                                            type: 'string',
                                            example: 'PostalAddress',
                                          },
                                        },
                                      },
                                    },
                                  },
                                  employmentType: {
                                    type: 'string',
                                    example: 'FULL_TIME',
                                  },
                                },
                              },
                              publishedDate: {
                                type: 'string',
                                example: '2022-07-22',
                                description: 'The date the job posting was published',
                              },
                              applicationDeadline: {
                                type: 'string',
                                example: '2024-08-12T20:00:00.000Z',
                                format: 'date',
                                description: 'The date and time when applications will no longer be accepted',
                              },
                              address: {
                                allOf: [
                                  {
                                    description: 'The address of the job posting',
                                  },
                                  {
                                    $ref: '#/paths/~1location.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/address',
                                  },
                                ],
                              },
                              isRemote: {
                                type: 'boolean',
                              },
                              employmentType: {
                                $ref: '#/webhooks/jobPostingUpdate/post/requestBody/content/application~1json/schema/properties/data/properties/jobPosting/properties/employmentType',
                              },
                              applicationFormDefinition: {
                                allOf: [
                                  {
                                    $ref: '#/paths/~1offer.start/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/formDefinition',
                                  },
                                  {
                                    description:
                                      'See the guide on Creating a custom careers page (https://developers.ashbyhq.com/docs/creating-a-custom-careers-page)',
                                  },
                                ],
                              },
                              isListed: {
                                type: 'boolean',
                                example: true,
                                description: 'Whether or not the job posting is listed',
                              },
                              externalLink: {
                                type: 'string',
                                example:
                                  'https://jobs.ashbyhq.com/70b51cc4-7f34-5567-92bd-96f354f7439a/4be0e8c0-9323-43a0-ab48-506789ab9c16',
                                description:
                                  'The external link to the job posting. Will be null if the job posting is on an internal job board.',
                              },
                              applyLink: {
                                type: 'string',
                                example:
                                  'https://jobs.ashbyhq.com/6eec82ac-9713-512d-ac2e-405618935375/d5a6bc97-4259-4bc5-b3fe-6d3edfd538e3',
                                description:
                                  'The link to apply to the job posting. Will be to the public job board if the job posting is on an external job board, or to the internal job board if the job posting is on an internal job board.',
                              },
                              compensation: {
                                type: 'object',
                                description: 'Compensation ranges associated with the job posting and related settings',
                                required: ['compensationTiers', 'shouldDisplayCompensationOnJobBoard'],
                                properties: {
                                  compensationTierSummary: {
                                    type: 'string',
                                    example: '$72K – $270K • 1% – 2.25% • Offers Bonus • Multiple Ranges',
                                    description:
                                      "A summary of *all* the job posting's valid `compensationTiers` in the same format shown on\nAshby-hosted Job Boards\n",
                                  },
                                  summaryComponents: {
                                    type: 'array',
                                    items: {
                                      type: 'object',
                                      description:
                                        'A part of a compensation tier that represents one specific type of compensation, e.g. the "Salary"\nor the "Bonus."\n',
                                      properties: {
                                        summary: {
                                          type: 'string',
                                          example: '€72K – €100K',
                                          description:
                                            'The summary of this component in the same format shown on Ashby-hosted Job Boards',
                                        },
                                        compensationType: {
                                          type: 'string',
                                          enum: [
                                            'Salary',
                                            'EquityPercentage',
                                            'EquityCashValue',
                                            'Commission',
                                            'Bonus',
                                          ],
                                          example: 'Salary',
                                          description: 'The type of compensation this component represents\n',
                                        },
                                        interval: {
                                          type: 'string',
                                          enum: [
                                            'NONE',
                                            '1 TIME',
                                            '1 HOUR',
                                            '1 DAY',
                                            '1 WEEK',
                                            '2 WEEK',
                                            '1 MONTH',
                                            '1 YEAR',
                                            '6 MONTH',
                                            '0.5 MONTH',
                                            '3 MONTH',
                                          ],
                                          example: '1 YEAR',
                                          description: 'The frequency at which this compensation is given',
                                        },
                                        currencyCode: {
                                          type: 'string',
                                          example: 'EUR',
                                          description:
                                            'For non `EquityPercentage` components, the [ISO 4217](https://en.wikipedia.org/wiki/ISO_4217)\ncurrency code of the compensation range\n',
                                        },
                                        label: {
                                          type: 'string',
                                          example: 'Estimated Salary',
                                          description:
                                            'An optional label that describes this compensation range to applicants',
                                        },
                                        minValue: {
                                          type: 'number',
                                          example: 72000.1,
                                          description: 'The lower end of the compensation range',
                                        },
                                        maxValue: {
                                          type: 'number',
                                          example: 100000,
                                          description: 'The higher end of the compensation range',
                                        },
                                      },
                                      required: ['compensationType', 'interval', 'summary'],
                                    },
                                    description:
                                      "The maximum and minimum compensation ranges across *all* the posting's `compensationTiers`\nthat make up `compensationTierSummary`\n",
                                    example: [
                                      {
                                        summary: '€72K – €270K',
                                        componentType: 'Salary',
                                        interval: '1 YEAR',
                                        currencyCode: 'EUR',
                                        minValue: 72023.45,
                                        maxValue: 270450,
                                      },
                                      {
                                        summary: '1% – 2.25%',
                                        componentType: 'EquityPercentage',
                                        interval: 'NONE',
                                        minValue: 1,
                                        maxValue: 2.25,
                                      },
                                      {
                                        summary: 'Offers Bonus',
                                        componentType: 'Bonus',
                                        interval: '1 YEAR',
                                        minValue: null,
                                        maxValue: null,
                                      },
                                    ],
                                  },
                                  compensationTiers: {
                                    type: 'array',
                                    items: {
                                      type: 'object',
                                      description: 'A compensation range that can be offered to candidates',
                                      properties: {
                                        id: {
                                          allOf: [
                                            {
                                              $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                            },
                                            {
                                              description: "The compensation tier's unique id",
                                            },
                                          ],
                                        },
                                        title: {
                                          type: 'string',
                                          example: 'Zone A',
                                          description: 'A label that describes the entire range to applicants',
                                        },
                                        additionalInformation: {
                                          type: 'string',
                                          example: 'Signing bonus available',
                                          description: 'Supplementary information about the compensation',
                                        },
                                        components: {
                                          type: 'array',
                                          items: {
                                            type: 'object',
                                            description:
                                              'A part of a compensation tier that represents one specific type of compensation, e.g. the "Salary"\nor the "Bonus."\n',
                                            properties: {
                                              id: {
                                                allOf: [
                                                  {
                                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                                  },
                                                  {
                                                    description: "The component's unique id",
                                                  },
                                                ],
                                              },
                                            },
                                            allOf: [
                                              {
                                                $ref: '#/paths/~1jobPosting.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/properties/compensation/properties/summaryComponents/items',
                                              },
                                            ],
                                            required: ['id'],
                                          },
                                          description: 'The individual components that make up this compensation range',
                                          example: [
                                            {
                                              id: 'fb8efeaa-bea1-4713-9012-cbd25fc3dc89',
                                              summary: '€72K – €100K',
                                              componentType: 'Salary',
                                              interval: '1 YEAR',
                                              currencyCode: 'EUR',
                                              minValue: 72023.45,
                                              maxValue: 100000,
                                            },
                                            {
                                              id: '93c62578-ed5d-42dd-8186-64ad5ba5603d',
                                              summary: '1% – 2.511%',
                                              componentType: 'EquityPercentage',
                                              interval: 'NONE',
                                              minValue: 1,
                                              maxValue: 2.511,
                                            },
                                            {
                                              id: null,
                                              summary: 'Offers Bonus',
                                              componentType: 'Bonus',
                                              interval: '1 YEAR',
                                              minValue: null,
                                              maxValue: null,
                                            },
                                          ],
                                        },
                                        tierSummary: {
                                          type: 'string',
                                          example: '€72K – €100K • 1% – 2.511% • Offers Bonus',
                                          description:
                                            "A summary of the tiers's components in the same format shown on Ashby-hosted Job Boards\n",
                                        },
                                      },
                                      required: ['id', 'components', 'tierSummary'],
                                    },
                                    description:
                                      'The compensation ranges that can be offered to applicants for this posting',
                                    example: [
                                      {
                                        id: 'da53719f-a115-400b-9d30-9b875428f1e7',
                                        title: 'Zone A',
                                        additionalInformation: null,
                                        components: [
                                          {
                                            id: 'fb8efeaa-bea1-4713-9012-cbd25fc3dc89',
                                            summary: '€72K – €100K',
                                            componentType: 'Salary',
                                            interval: '1 YEAR',
                                            currencyCode: 'EUR',
                                            minValue: 72023.45,
                                            maxValue: 100000,
                                          },
                                          {
                                            id: '93c62578-ed5d-42dd-8186-64ad5ba5603d',
                                            summary: '1% – 1.4%',
                                            componentType: 'EquityPercentage',
                                            interval: 'NONE',
                                            minValue: 1,
                                            maxValue: 1.4,
                                          },
                                        ],
                                        tierSummary: '€72K – €100K • 1% – 1.4%',
                                      },
                                      {
                                        id: '81362ab1-739e-44f5-88d9-dbc5c731624c',
                                        title: 'Zone B',
                                        additionalInformation: 'Commuter Benefits',
                                        components: [
                                          {
                                            id: 'fb8efeaa-bea1-4713-9012-cbd25fc3dc89',
                                            summary: '€72K – €100K',
                                            componentType: 'Salary',
                                            interval: '1 YEAR',
                                            currencyCode: 'EUR',
                                            minValue: 95010.12,
                                            maxValue: 270450,
                                          },
                                          {
                                            id: '93c62578-ed5d-42dd-8186-64ad5ba5603d',
                                            summary: '1.8% – 2.511%',
                                            componentType: 'EquityPercentage',
                                            interval: 'NONE',
                                            minValue: 1.8,
                                            maxValue: 2.511,
                                          },
                                          {
                                            id: null,
                                            summary: 'Offers Bonus',
                                            componentType: 'Bonus',
                                            interval: '1 YEAR',
                                            minValue: null,
                                            maxValue: null,
                                          },
                                        ],
                                        tierSummary: '€95K – €270K • 1.8% – 2.511% • Offers Bonus • Commuter Benefits',
                                      },
                                    ],
                                  },
                                  shouldDisplayCompensationOnJobBoard: {
                                    type: 'boolean',
                                    example: true,
                                    description:
                                      "Whether the job posting's settings specify that compensation should be shown to applicants\n",
                                  },
                                },
                              },
                              updatedAt: {
                                $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                              },
                              applicationLimitCalloutHtml: {
                                type: 'string',
                                description:
                                  'An HTML version of any communication you would like to show to applicants about the application limit for this job posting',
                                example:
                                  '<div>\n  <p>Please Note: we have set up limits for applications for this role. It is in the <strong>Product Limit </strong> group. The following limits apply to applications for all jobs within this group:</p>\n  <ul>\n    <li>\n      <p>Candidates may not apply more than 1 time in any 60 day span for any job in the <strong>Product Limit </strong> Group.</p>\n    </li>\n  </ul>\n</div>\n',
                              },
                            },
                            required: [
                              'id',
                              'title',
                              'descriptionPlain',
                              'descriptionHtml',
                              'descriptionParts',
                              'departmentName',
                              'teamName',
                              'jobId',
                              'locationName',
                              'locationIds',
                              'linkedData',
                              'publishedDate',
                              'employmentType',
                              'applicationFormDefiniton',
                              'isListed',
                              'applyLink',
                              'compensation',
                              'updatedAt',
                            ],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/jobPosting.list': {
    post: {
      summary: 'jobPosting.list',
      description:
        'Lists all published job postings\n\n**Requires the [`jobsRead`](authentication#permissions-jobpostinglist) permission.**\n\n**Important**: By default, this endpoint includes all listed and unlisted job postings. Unlisted job postings should not be displayed publicly. \nIf you are using the API to publicly expose job postings, set the `listedOnly` parameter to `true` when calling this API so that you only fetch listed job postings that can be displayed publicly.\n',
      operationId: 'jobPostingList',
      tags: ['Job Posting'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'filter by location name (case sensitive)',
                },
                department: {
                  type: 'string',
                  description: 'filter by department name (case sensitive)',
                },
                listedOnly: {
                  type: 'boolean',
                  description: 'If true, filter out unlisted job postings.',
                  default: false,
                },
                jobBoardId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description:
                        'If provided, only returns the job postings on the specified job board.  If omitted, this API will return the job postings on the primary external job board.',
                    },
                  ],
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the jobPosting.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/webhooks/jobPostingUpdate/post/requestBody/content/application~1json/schema/properties/data/properties/jobPosting',
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/jobPosting.update': {
    post: {
      summary: 'jobPosting.update',
      operationId: 'jobPostingUpdate',
      description:
        'Updates an existing job posting.\n\n**Requires the [`jobsWrite`](authentication#permissions-jobpostingupdate) permission.**\n\n**Note on updating the description**: The `descriptionHtml` field returned in `jobPosting.info` may contain content that is not modifiable through the API. Only the content of the `descriptionParts.descriptionBody` field of the `jobPosting.info` endpoint is modifiable through this call.\n',
      tags: ['Job Posting'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                jobPostingId: {
                  allOf: [
                    {
                      description: 'The unique id of the job posting to update.',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                title: {
                  type: 'string',
                  example: 'Software Engineer',
                  description: 'A new title for the job posting.',
                },
                description: {
                  type: 'object',
                  description:
                    'An HTML block of the job posting description. Please see below for supported tags.\n\n**Note**: The `descriptionHtml` field returned in `jobPosting.info` may contain content that is not modifiable through the API. Only the content of the `descriptionParts.descriptionBody` field of the `jobPosting.info` endpoint is modifiable through this call.\n',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['text/html'],
                    },
                    content: {
                      type: 'string',
                      description:
                        'The HTML content of the Job Posting. The following tags will accept updates. Updates to any other tags will be stripped out or not applied. \n- Headings - `<h[1-6]>`\n- Bold - `<b>`\n- Italic - `<i>`\n- Underline - `<u>`\n- Links - `<a>`\n- Bulleted Lists - `<ul>`, `<li>`\n- Ordered Lists - `<ol>`, `<li>`\n- Code - `<code>`\n- Code blocks - `<pre>`\n',
                    },
                  },
                  required: ['type', 'content'],
                },
              },
              required: ['jobPostingId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the jobPosting.update endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1jobPosting.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/location.create': {
    post: {
      summary: 'location.create',
      description:
        'Creates a location or location hierarchy.\n\n**Requires the [`organizationWrite`](authentication#permissions-locationcreate) permission.**\n',
      operationId: 'locationcreate',
      tags: ['Location'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'type'],
              properties: {
                name: {
                  type: 'string',
                  description: 'The name of the location',
                },
                type: {
                  type: 'string',
                  description:
                    'A Location represents an actual location that jobs and employees can be associated with. A Location Hierarchy is a grouping of locations or other location hierarchies.',
                  enum: ['Location', 'LocationHierarchy'],
                },
                address: {
                  type: 'object',
                  description: 'The address of the location',
                  properties: {
                    postalAddress: {
                      type: 'object',
                      properties: {
                        addressCountry: {
                          type: 'string',
                          description:
                            'The country the location is in. Must be a valid country name or two-letter country code.',
                        },
                        addressRegion: {
                          type: 'string',
                          description: 'The region the location is in (for instance, a state or province)',
                        },
                        addressLocality: {
                          type: 'string',
                          description: 'The city or town of the location',
                        },
                      },
                    },
                  },
                },
                parentLocationId: {
                  type: 'string',
                  description: "The id of the location's parent",
                },
                isRemote: {
                  type: 'boolean',
                  description:
                    'Whether the location should be labeled as remote. LocationHierarchies cannot be labeled as remote.',
                  default: false,
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the location.create endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1location.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/location.info': {
    post: {
      summary: 'location.info',
      description:
        'Gets details for a single location by id.\n\n**Requires the [`organizationRead`](authentication#permissions-locationinfo) permission.**\n',
      operationId: 'locationInfo',
      tags: ['Location'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                locationId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the location to fetch',
                    },
                  ],
                },
              },
              required: ['locationId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the location.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                              },
                              name: {
                                type: 'string',
                                example: 'Bay Area Office',
                              },
                              isArchived: {
                                $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived',
                              },
                              address: {
                                type: 'object',
                                properties: {
                                  postalAddress: {
                                    type: 'object',
                                    properties: {
                                      addressCountry: {
                                        type: 'string',
                                        example: 'United States',
                                      },
                                      addressRegion: {
                                        type: 'string',
                                        example: 'California',
                                      },
                                      addressLocality: {
                                        type: 'string',
                                        example: 'San Francisco',
                                      },
                                    },
                                  },
                                },
                              },
                              isRemote: {
                                type: 'boolean',
                                example: false,
                              },
                              parentLocationId: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                              },
                              type: {
                                type: 'enum',
                                enum: ['Location', 'LocationHierarchy'],
                                description: 'The type of the location component.',
                                example: 'Location',
                              },
                            },
                            required: ['id', 'name', 'isArchived'],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/location.list': {
    post: {
      summary: 'location.list',
      description:
        'List all locations. Regions are not returned.\n\n**Requires the [`organizationRead`](authentication#permissions-locationlist) permission.**\n',
      operationId: 'locationlist',
      tags: ['Location'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                includeArchived: {
                  $ref: '#/paths/~1source.list/post/requestBody/content/application~1json/schema/properties/includeArchived',
                },
                includeLocationHierarchy: {
                  type: 'boolean',
                  description: 'If true, the response will include the location hierarchy (regions).\n',
                  default: false,
                  example: false,
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the location.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/paths/~1location.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                            },
                          },
                          moreDataAvailable: {
                            $ref: '#/paths/~1source.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/moreDataAvailable',
                          },
                        },
                      },
                      {
                        required: ['results', 'moreDataAvailable'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/offer.create': {
    post: {
      summary: 'offer.create',
      operationId: 'offerCreate',
      description:
        "Creates a new Offer\n\n**Requires the [`offersWrite`](authentication#permissions-offercreate) permission.**\n\nOffer forms support a variety of field types. The values accepted for each field depend on the type of field that's being filled out:\n- `Boolean` - A boolean value.\n- `Currency` - An object in the format `{ currencyCode: \"USD\", value: 100000 }` where currencyCode is a valid ISO 4217 currency code and value is an integer.\n- `Date` - A valid ISO Date string.\n- `Number` - An integer.\n- `String` - A string.\n- `ValueSelect` - A string that matches the value of one of the ValueSelect field's selectable options.\n- `MultiValueSelect` - An array of strings that exist in the MultiValueSelect field's selectable options.\n",
      tags: ['Offer'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                offerProcessId: {
                  allOf: [
                    {
                      description:
                        "The id of the offer process associated with the offer you're creating. \nThis value is the id included in the response of the `offerProcess.start` API.\n",
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                offerFormId: {
                  allOf: [
                    {
                      description:
                        'The id of the form associated with the offer.\nThis value is the id included in the response of the `offer.start` API.\n',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                offerForm: {
                  type: 'object',
                  properties: {
                    fieldSubmissions: {
                      type: 'array',
                      items: {
                        properties: {
                          path: {
                            type: 'string',
                            description: 'The form field\'s "path" value',
                          },
                          value: {
                            type: 'string',
                            description:
                              'This is often a primitive but the value depends on the type of field being submitted. See the description above for details on the values accepted in this field.',
                          },
                        },
                        required: ['path', 'value'],
                      },
                    },
                  },
                  required: ['fieldSubmissions'],
                },
              },
              required: ['offerProcessId', 'offerFormId', 'offerForm'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the offer.create endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/offerCreate/post/requestBody/content/application~1json/schema/properties/data/properties/offer',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/offer.info': {
    post: {
      summary: 'offer.info',
      operationId: 'offerInfo',
      description:
        'Returns details about a single offer by id\n\n**Requires the [`offersRead`](authentication#permissions-offerinfo) permission.**\n',
      tags: ['Offer'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                offerId: {
                  allOf: [
                    {
                      description: 'The id of the offer to fetch',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
              },
              required: ['offerId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the offer.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                        properties: {
                          results: {
                            $ref: '#/webhooks/offerCreate/post/requestBody/content/application~1json/schema/properties/data/properties/offer',
                          },
                        },
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/offer.list': {
    post: {
      summary: 'offer.list',
      description:
        'Get a list of all offers with their latest version\n\n**Requires the [`offersRead`](authentication#permissions-offerlist) permission.**\n',
      operationId: 'offerList',
      tags: ['Offer'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema',
                },
                {
                  type: 'object',
                  properties: {
                    applicationId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                        {
                          description: 'If provided, only returns the offers for the application with the supplied id',
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the offer.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/webhooks/offerCreate/post/requestBody/content/application~1json/schema/properties/data/properties/offer',
                            },
                          },
                        },
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/offer.start': {
    post: {
      summary: 'offer.start',
      operationId: 'offerStart',
      description:
        'The offer.start endpoint creates and returns an offer version instance that can be filled out and submitted\nusing the `offer.create` endpoint. \n\n**Requires the [`offersWrite`](authentication#permissions-offerstart) permission.**\n\nIn order to create a new offer version for a candidate with an in-progress \noffer process, you can call the `offer.start` endpoint and then call the `offer.create` endpoint to fill out the\nnewly created offer version form.  \n',
      tags: ['Offer'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                offerProcessId: {
                  allOf: [
                    {
                      description:
                        'The ID of the offer process to start. This value is the id included in the response of the `offerProcess.start` API.',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
              },
              required: ['offerProcessId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the offer.start endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                              },
                              formDefinition: {
                                type: 'object',
                                properties: {
                                  sections: {
                                    type: 'array',
                                    items: {
                                      type: 'object',
                                      properties: {
                                        title: {
                                          type: 'string',
                                        },
                                        descriptionHtml: {
                                          type: 'string',
                                        },
                                        descriptionPlain: {
                                          type: 'string',
                                        },
                                        fields: {
                                          type: 'array',
                                          items: {
                                            type: 'object',
                                            properties: {
                                              isRequired: {
                                                type: 'boolean',
                                                example: true,
                                                default: true,
                                              },
                                              descriptionHtml: {
                                                type: 'string',
                                              },
                                              descriptionPlain: {
                                                type: 'string',
                                              },
                                              field: {
                                                type: 'object',
                                                properties: {
                                                  id: {
                                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                                  },
                                                  type: {
                                                    type: 'string',
                                                    example: 'String',
                                                    description: 'The type of the form definition field.',
                                                  },
                                                  path: {
                                                    type: 'string',
                                                    example: '_systemfield_name',
                                                  },
                                                  humanReadablePath: {
                                                    type: 'string',
                                                    example: 'Name',
                                                  },
                                                  title: {
                                                    type: 'string',
                                                    example: 'Name',
                                                  },
                                                  isNullable: {
                                                    type: 'boolean',
                                                    example: false,
                                                    default: true,
                                                  },
                                                  selectableValues: {
                                                    type: 'object',
                                                    properties: {
                                                      label: {
                                                        type: 'string',
                                                      },
                                                      value: {
                                                        type: 'string',
                                                      },
                                                    },
                                                    required: ['label', 'value'],
                                                  },
                                                },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/offerProcess.start': {
    post: {
      summary: 'offerProcess.start',
      operationId: 'offerProcess.start',
      description:
        'Starts an offer process for a candidate.\n\n**Requires the [`offersWrite`](authentication#permissions-offerprocessstart) permission.**\n',
      tags: ['Offer Process'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                applicationId: {
                  allOf: [
                    {
                      description: 'The id of the application to start an offer process for',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
              },
              required: ['applicationId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the offerProcess.start endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              id: {
                                allOf: [
                                  {
                                    description: 'The id of the started offer process',
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                              applicationId: {
                                allOf: [
                                  {
                                    description: 'The id of the application the offer process was started for',
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                              status: {
                                description: 'The status of the offer process',
                                type: 'string',
                                enum: [
                                  'WaitingOnOfferCreation',
                                  'WaitingOnApprovalStart',
                                  'WaitingOnOfferApproval',
                                  'WaitingOnCandidateResponse',
                                  'CandidateAccepted',
                                  'CandidateRejected',
                                  'OfferCancelled',
                                ],
                              },
                            },
                            required: ['id', 'applicationId', 'status'],
                          },
                        },
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/opening.info': {
    post: {
      summary: 'opening.info',
      description:
        'Retrieves an opening by its UUID.\n      \n**Requires the [`jobsRead`](authentication#permissions-openinginfo) permission.**',
      operationId: 'openinginfo',
      tags: ['Openings'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['openingId'],
              properties: {
                openingId: {
                  type: 'string',
                  description: 'The id of the opening',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the opening.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/opening.list': {
    post: {
      summary: 'opening.list',
      description:
        'Lists openings.\n      \n**Requires the [`jobsRead`](authentication#permissions-openinglist) permission.**',
      operationId: 'openinglist',
      tags: ['Openings'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                cursor: {
                  type: 'string',
                  description: 'Opaque cursor indicating which page of results to fetch',
                },
                syncToken: {
                  type: 'string',
                  description: 'Opaque token representing the last time a full set of results was fetched.',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the opening.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening',
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/opening.search': {
    post: {
      summary: 'opening.search',
      description:
        'Searches for openings by identifier.\n      \n**Requires the [`jobsRead`](authentication#permissions-openingsearch) permission.**',
      operationId: 'openingsearch',
      tags: ['Openings'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['identifier'],
              properties: {
                identifier: {
                  type: 'string',
                  description: 'The identifier of the opening you want to search for',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the opening.search endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening',
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/opening.create': {
    post: {
      summary: 'opening.create',
      description:
        'Creates an opening.\n      \n**Requires the [`jobsWrite`](authentication#permissions-openingcreate) permission.**',
      operationId: 'openingcreate',
      tags: ['Openings'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                identifier: {
                  type: 'string',
                  description: 'jobIds,     targetHireDate,     targetStartDate,     isBackfill,     employmentType,',
                },
                description: {
                  type: 'string',
                },
                teamId: {
                  type: 'string',
                  description: 'The id of the department or team associated with the opening.',
                },
                locationIds: {
                  type: 'array',
                  description: 'The ids of the locations associated with the opening.',
                  items: {
                    type: 'string',
                  },
                },
                jobIds: {
                  type: 'array',
                  description: 'The ids of the jobs associated with the opening',
                  items: {
                    type: 'string',
                  },
                },
                targetHireDate: {
                  type: 'string',
                  description: 'The date (in YYYY-MM-DD format) by which you intend to hire against this opening.',
                },
                targetStartDate: {
                  type: 'string',
                  description:
                    'The date (in YYYY-MM-DD format) by which you intend someone hired against this opening will start employment.',
                },
                isBackfill: {
                  type: 'boolean',
                  description: 'Whether this opening is intended to backfill a previous employee',
                  default: false,
                },
                employmentType: {
                  type: 'string',
                  description: 'The employment type for this opening',
                  default: 'FullTime',
                  enum: ['FullTime', 'PartTime', 'Intern', 'Contract', 'Temporary', ''],
                },
                openingState: {
                  type: 'string',
                  description: 'The state the opening should be created in.',
                  enum: ['Draft', 'Approved', 'Open', 'Closed'],
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the opening.create endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/opening.addJob': {
    post: {
      summary: 'opening.addJob',
      description:
        'Adds a job to an opening.\n      \n**Requires the [`jobsWrite`](authentication#permissions-openingaddjob) permission.**',
      operationId: 'openingaddjob',
      tags: ['Openings'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['openingId', 'jobId'],
              properties: {
                openingId: {
                  type: 'string',
                  description: 'The id of the opening',
                },
                jobId: {
                  type: 'string',
                  description: 'The id of the job to add',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the opening.addJob endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/opening.removeJob': {
    post: {
      summary: 'opening.removeJob',
      description:
        'Removes a job from an opening.\n      \n**Requires the [`jobsWrite`](authentication#permissions-openingremovejob) permission.**',
      operationId: 'openingremovejob',
      tags: ['Openings'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['openingId', 'jobId'],
              properties: {
                openingId: {
                  type: 'string',
                  description: 'The id of the opening',
                },
                jobId: {
                  type: 'string',
                  description: 'The id of the job to remove from the opening.',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the opening.removeJob endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/opening.setOpeningState': {
    post: {
      summary: 'opening.setOpeningState',
      description:
        'Sets the state of an opening.\n      \n**Requires the [`jobsWrite`](authentication#permissions-openingsetopeningstate) permission.**',
      operationId: 'openingsetopeningstate',
      tags: ['Openings'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                openingId: {
                  type: 'string',
                  description: 'The id of the opening you want to update',
                },
                openingState: {
                  type: 'string',
                  description: 'The new state you want to update the opening to',
                  enum: ['Draft', 'Approved', 'Open', 'Closed'],
                },
                closeReasonId: {
                  type: 'string',
                  description: 'The id of the close reason if you are setting the state to closed',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the opening.setOpeningState endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/opening.setArchived': {
    post: {
      summary: 'opening.setArchived',
      description:
        'Sets the archived state of an opening.\n      \n**Requires the [`jobsWrite`](authentication#permissions-openingsetarchived) permission.**',
      operationId: 'openingsetarchived',
      tags: ['Openings'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                openingId: {
                  type: 'string',
                  description: 'The id of the opening you want to archive',
                },
                archive: {
                  type: 'boolean',
                  description: 'The new archived state you want to update the opening to',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the opening.setArchived endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/opening.update': {
    post: {
      summary: 'opening.update',
      description:
        'Updates an opening.\n      \n**Requires the [`jobsWrite`](authentication#permissions-openingupdate) permission.**',
      operationId: 'openingupdate',
      tags: ['Openings'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                openingId: {
                  type: 'string',
                  description: 'The openingId of the opening you want to update.',
                },
                identifier: {
                  type: 'string',
                  description: 'jobIds,     targetHireDate,     targetStartDate,     isBackfill,     employmentType,',
                },
                description: {
                  type: 'string',
                },
                teamId: {
                  type: 'string',
                  description: 'The id of the department or team associated with the opening.',
                },
                targetHireDate: {
                  type: 'string',
                  description: 'The date (in YYYY-MM-DD format) by which you intend to hire against this opening.',
                },
                targetStartDate: {
                  type: 'string',
                  description:
                    'The date (in YYYY-MM-DD format) by which you intend someone hired against this opening will start employment.',
                },
                isBackfill: {
                  type: 'boolean',
                  description: 'Whether this opening is intended to backfill a previous employee',
                  default: false,
                },
                employmentType: {
                  type: 'string',
                  description: 'The employment type for this opening',
                  default: 'FullTime',
                  enum: ['FullTime', 'PartTime', 'Intern', 'Contract', 'Temporary', ''],
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the opening.update endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/webhooks/openingCreate/post/requestBody/content/application~1json/schema/properties/data/properties/opening',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/project.info': {
    post: {
      summary: 'project.info',
      description:
        'Retrieves an project by its UUID.\n      \n**Requires the [`jobsRead`](authentication#permissions-projectinfo) permission.**',
      operationId: 'projectinfo',
      tags: ['Projects'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['projectId'],
              properties: {
                projectId: {
                  type: 'string',
                  description: 'The id of the project',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the project.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                              },
                              title: {
                                type: 'string',
                                example: 'Office Event',
                              },
                              description: {
                                type: 'string',
                                example: 'Folks invited to office for an event',
                              },
                              isArchived: {
                                $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived',
                              },
                              confidential: {
                                type: 'boolean',
                                example: false,
                              },
                              authorId: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                              },
                              createdAt: {
                                $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                              },
                              customFieldEntries: {
                                type: 'array',
                                description: 'All custom field values associated with the project',
                                items: {
                                  $ref: '#/paths/~1customField.setValue/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                                },
                              },
                            },
                            required: ['id', 'title'],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/project.list': {
    post: {
      summary: 'project.list',
      description:
        'Lists projects.\n      \n**Requires the [`candidatesRead`](authentication#permissions-projectlist) permission.**',
      operationId: 'projectlist',
      tags: ['Projects'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                cursor: {
                  type: 'string',
                  description: 'Opaque cursor indicating which page of results to fetch',
                  example: 'G8',
                },
                syncToken: {
                  type: 'string',
                  description:
                    'An opaque token representing the last time the data was successfully synced from the API. A new, updated one is returned after successfully fetching the last page of data.\n',
                  example: 'jYnEBmjzR',
                },
                limit: {
                  type: 'number',
                  description: 'The maximum number of items to return. The maximum and default value is 100.',
                  example: 25,
                },
              },
              example: {
                syncToken: '6W05prn4d',
                cursor: 'qA',
                limit: 25,
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the project.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/paths/~1project.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/project.search': {
    post: {
      summary: 'project.search',
      operationId: 'projectSearch',
      description:
        'Search for projects by title. \n\n**Requires the [`candidatesRead`](authentication#permissions-projectsearch) permission.**\n\nResponses are limited to 100 results. Consider refining your search or using /project.list to paginate through all projects, if you approach this limit. This API is for use cases where you intend operate on a final small set of projects, like building a project autocomplete.\n',
      tags: ['Project'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: "The project's title",
                },
              },
              example: {
                title: 'My Project',
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the project.search endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/paths/~1project.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/referral.create': {
    post: {
      summary: 'referral.create',
      operationId: 'referralCreate',
      description:
        'Creates a referral\n\n**Requires the [`candidatesWrite`](authentication#permissions-referralcreate) permission.**\n',
      tags: ['Referral'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: {
                  allOf: [
                    {
                      description: 'The id of the referral form, from /referralForm.info',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                creditedToUserId: {
                  allOf: [
                    {
                      description: 'The id of the user submitting the referral',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                fieldSubmissions: {
                  type: 'array',
                  items: {
                    properties: {
                      path: {
                        type: 'string',
                        description: 'The form field\'s "path" value',
                      },
                      value: {
                        type: 'string',
                        description:
                          'This is often a primitive but for a referral job, it should be { title: job.title, value: job.id }\n',
                      },
                    },
                    required: ['path', 'value'],
                  },
                },
                createdAt: {
                  allOf: [
                    {
                      description:
                        "An ISO date string to set the referral's createdAt timestamp to. When this value isn't provided, the createdAt timestamp defaults to the time the referral was created.\n",
                    },
                    {
                      $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                    },
                  ],
                },
              },
              required: ['id', 'creditedToUserId', 'fieldSubmissions'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the referral.create endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                        properties: {
                          results: {
                            $ref: '#/webhooks/pushToHRIS/post/requestBody/content/application~1json/schema/properties/data/properties/application',
                          },
                        },
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/referralForm.info': {
    post: {
      summary: 'referralForm.info',
      operationId: 'referralFormInfo',
      description:
        'Fetches the default referral form or creates a default referral form if none exists.\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-referralforminfo) permission.**\n',
      tags: ['Referral Form'],
      responses: {
        '200': {
          description: 'Responses for the referral.create endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                        properties: {
                          results: {
                            allOf: [
                              {
                                type: 'object',
                                properties: {
                                  id: {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                  title: {
                                    type: 'string',
                                    description: 'The title of the form',
                                  },
                                  isArchived: {
                                    $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived',
                                  },
                                  formDefinition: {
                                    $ref: '#/paths/~1offer.start/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/properties/formDefinition',
                                  },
                                },
                                required: [
                                  'id',
                                  'organizationId',
                                  'title',
                                  'isArchived',
                                  'isDefaultForm',
                                  'formDefinition',
                                ],
                              },
                              {
                                type: 'object',
                                properties: {
                                  organizationId: {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                  isDefaultForm: {
                                    type: 'boolean',
                                    example: true,
                                  },
                                },
                              },
                            ],
                          },
                        },
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/source.list': {
    post: {
      summary: 'source.list',
      description:
        'List all sources\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-sourcelist) permission.**\n',
      operationId: 'sourcelist',
      tags: ['Source'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                includeArchived: {
                  type: 'boolean',
                  description: 'When true, includes archived items',
                  default: false,
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the source.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                },
                                title: {
                                  type: 'string',
                                  example: 'Applied',
                                },
                                isArchived: {
                                  $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived',
                                },
                                sourceType: {
                                  type: 'object',
                                  properties: {
                                    id: {
                                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                    },
                                    title: {
                                      type: 'string',
                                      example: 'Inbound',
                                    },
                                    isArchived: {
                                      $ref: '#/paths/~1interviewPlan.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results/items/properties/isArchived',
                                    },
                                  },
                                  required: ['id', 'title', 'isArchived'],
                                },
                              },
                              required: ['id', 'title', 'isArchived'],
                            },
                          },
                          moreDataAvailable: {
                            type: 'boolean',
                            example: false,
                          },
                        },
                      },
                      {
                        required: ['results', 'moreDataAvailable'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/sourceTrackingLink.list': {
    post: {
      summary: 'sourceTrackingLink.list',
      description:
        'List all source custom tracking links\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-sourcetrackinglinklist) permission.**\n',
      operationId: 'sourcetrackinglinklist',
      tags: ['Source Tracking Links'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                includeDisabled: {
                  type: 'boolean',
                  description: 'When true, includes disabled tracking links',
                  default: false,
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the sourceTrackingLink.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                },
                                code: {
                                  type: 'string',
                                  example: 'fx9iL4QtWr',
                                },
                                enabled: {
                                  type: 'boolean',
                                  example: true,
                                },
                                sourceId: {
                                  $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                },
                                link: {
                                  type: 'string',
                                  example: 'https://jobs.ashbyhq.com/example?utm_source=fx9iL4QtWr',
                                },
                              },
                              required: ['id', 'code', 'enabled', 'sourceId', 'link'],
                            },
                          },
                        },
                      },
                    ],
                    required: ['results'],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/surveyFormDefinition.info': {
    post: {
      summary: 'surveyFormDefinition.info',
      operationId: 'surveyFormDefinitionInfo',
      description:
        'Returns details about a single survey form definition by id\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-surveyformdefinitioninfo) permission.**\n',
      tags: ['Survey Form Definition'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                surveyFormDefinitionId: {
                  allOf: [
                    {
                      description: 'The id of the survey form to fetch',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
              },
              required: ['surveyFormDefinitionId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the surveyFormDefinition.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                        properties: {
                          results: {
                            allOf: [
                              {
                                $ref: '#/paths/~1referralForm.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results/allOf/0',
                              },
                              {
                                type: 'object',
                                properties: {
                                  surveyType: {
                                    $ref: '#/paths/~1surveySubmission.list/post/requestBody/content/application~1json/schema/allOf/0/properties/surveyType',
                                  },
                                },
                              },
                            ],
                            required: ['id', 'title', 'isArchived', 'formDefinition', 'surveyType'],
                          },
                        },
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/surveyFormDefinition.list': {
    post: {
      summary: 'surveyFormDefinition.list',
      operationId: 'surveyFormDefinitionList',
      description:
        'Lists all survey form definitions.\n\n**Requires the [`hiringProcessMetadataRead`](authentication#permissions-surveyformdefinitionlist) permission.**\n',
      tags: ['Survey Form Definition'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the surveyFormDefinition.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/paths/~1surveyFormDefinition.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results',
                            },
                          },
                        },
                      },
                    ],
                    required: ['results'],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/surveyRequest.create': {
    post: {
      summary: 'surveyRequest.create',
      description:
        'This endpoint generates a survey request and returns a survey URL. You can send this URL to a candidate to allow them to complete a survey. \n\n**Requires the [`candidatesWrite`](authentication#permissions-surveyrequestcreate) permission.**\n\n**Note that calling this endpoint will not automatically email the survey to the candidate.** It simply creates the request and gives you a URL to share with a candidate.\n',
      operationId: 'surveyRequestCreate',
      tags: ['Survey Request'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['candidateId', 'applicationId', 'surveyFormDefinitionId'],
              properties: {
                candidateId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the candidate to create a survey request for.',
                    },
                  ],
                },
                applicationId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id of the application to associate with the survey request.',
                    },
                  ],
                },
                surveyFormDefinitionId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description:
                        'The ID of the survey form that the candidate will see when they visit the URL returned in the `surveyURL` property of the API response. \nSurvey forms IDs can be obtained using the `surveyFormDefinition.list` endpoint. \n',
                    },
                  ],
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the surveyRequest.create endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              id: {
                                allOf: [
                                  {
                                    description: 'The id of the survey request\n',
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                              candidateId: {
                                allOf: [
                                  {
                                    description: 'The id of the candidate the survey request is for\n',
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                              applicationId: {
                                allOf: [
                                  {
                                    description: 'The id of the application associated with the survey request\n',
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                              surveyFormDefinitionId: {
                                allOf: [
                                  {
                                    description:
                                      'The id of the survey form the candidate will fill out when they take the survey\n',
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                              surveyUrl: {
                                type: 'string',
                                example: 'https://you.ashbyhq.com/ashby/survey/3f20b73e-abec-4d62-ba6f-04f2f985f7dd',
                                description: 'The URL that the candidate can visit to take the survey.\n',
                              },
                            },
                            required: ['id', 'candidateId', 'applicationId', 'surveyFormDefinitionId', 'surveyUrl'],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/surveyRequest.list': {
    post: {
      summary: 'surveyRequest.list',
      description:
        'Lists all survey requests\n\n**Requires the [`candidatesRead`](authentication#permissions-surveyRequestList) permission.**\n',
      operationId: 'surveyRequestList',
      tags: ['Survey Request'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema',
                },
                {
                  type: 'object',
                  properties: {
                    surveyType: {
                      allOf: [
                        {
                          description:
                            'Returns only the survey requests of the given type. Currently, only `CandidateExperience` is supported.',
                        },
                        {
                          type: 'string',
                        },
                        {
                          enum: ['CandidateExperience'],
                        },
                      ],
                    },
                    applicationId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                        {
                          description: 'If provided, only returns the offers for the application with the supplied id',
                        },
                      ],
                    },
                    candidateId: {
                      allOf: [
                        {
                          $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                        },
                        {
                          description: 'If provided, only returns the offers for the candidate with the supplied id',
                        },
                      ],
                    },
                  },
                  required: ['surveyType'],
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the surveyRequest.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/paths/~1surveyRequest.create/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                            },
                          },
                        },
                      },
                    ],
                    required: ['results'],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/surveySubmission.list': {
    post: {
      summary: 'surveySubmission.list',
      operationId: 'surveySubmissionList',
      description:
        'Lists all survey submissions of a given `surveyType`.\n\n**Requires the [`candidatesRead`](authentication#permissions-surveySubmissionList) permission.**\n',
      tags: ['Survey Submission'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  type: 'object',
                  description: 'The type of survey submissions to fetch. \n',
                  properties: {
                    surveyType: {
                      type: 'string',
                      enum: ['CandidateDataConsent', 'CandidateExperience', 'Diversity', 'EEOC', 'Questionnaire'],
                    },
                  },
                  required: ['surveyType'],
                },
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema',
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the surveySubmission.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/webhooks/surveySubmit/post/requestBody/content/application~1json/schema/properties/data/properties/surveySubmission',
                            },
                          },
                        },
                      },
                    ],
                    required: ['results'],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/user.info': {
    post: {
      summary: 'user.info',
      description:
        'Get an Ashby user by id\n\n**Requires the [`organizationRead`](authentication#permissions-userinfo) permission.**\n',
      operationId: 'userInfo',
      tags: ['User'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                userId: {
                  allOf: [
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                    {
                      description: 'The id to lookup the user',
                    },
                  ],
                },
              },
              required: ['userId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the user.info endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                              },
                              firstName: {
                                type: 'string',
                                example: 'Test',
                              },
                              lastName: {
                                type: 'string',
                                example: 'User',
                              },
                              email: {
                                $ref: '#/paths/~1candidate.create/post/requestBody/content/application~1json/schema/properties/email/allOf/0',
                              },
                              globalRole: {
                                type: 'string',
                                enum: ['Organization Admin', 'Elevated Access', 'Limited Access', 'External Recruiter'],
                              },
                              isEnabled: {
                                type: 'boolean',
                              },
                              updatedAt: {
                                $ref: '#/paths/~1candidate.createNote/post/requestBody/content/application~1json/schema/properties/createdAt',
                              },
                            },
                            required: ['id', 'firstName', 'lastName', 'globalRole', 'isEnabled', 'updatedAt'],
                          },
                        },
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/user.list': {
    post: {
      summary: 'user.list',
      description:
        "Get a list of all Ashby users\n\n**Requires the [`organizationRead`](authentication#permissions-userlist) permission.**\n\nThe `globalRole` property in the response specifies the user's access level in Ashby.\nFor more details on the permissions granted with each role, see our [documentation here](https://ashbyhq.notion.site/Ashby-Permissions-a48eda7c07ad46f0bcd2b3f39301a9de#c64a4db5e7f4432bbe6691b91d3f0c62).\n",
      operationId: 'userList',
      tags: ['User'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                {
                  $ref: '#/paths/~1project.list/post/requestBody/content/application~1json/schema',
                },
                {
                  type: 'object',
                  properties: {
                    includeDeactivated: {
                      type: 'boolean',
                      default: false,
                      description:
                        'If set to true, deactivated users are included in the response. \nBy default, deactivated users are not included.\n',
                    },
                  },
                },
              ],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the user.list endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.list/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results',
                            },
                          },
                        },
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/user.search': {
    post: {
      summary: 'user.search',
      description:
        'Search for an Ashby user by email address\n\n**Requires the [`organizationRead`](authentication#permissions-usersearch) permission.**\n',
      operationId: 'userSearch',
      tags: ['User'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  description: 'The email to use to search for the user',
                  example: 'test@ashbyhq.com',
                },
              },
              required: ['email'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses for the user.search endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                        properties: {
                          results: {
                            type: 'array',
                            items: {
                              $ref: '#/paths/~1user.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/1/properties/results',
                            },
                          },
                        },
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    title: 'Error response',
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/webhook.create': {
    post: {
      summary: 'webhook.create',
      description:
        'Creates a webhook setting.\n\n**Requires the [`apiKeysWrite`](authentication#permissions-webhookcreate) scope.**\n',
      operationId: 'webhookcreate',
      tags: ['Webhook'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                webhookType: {
                  type: 'string',
                  enum: [
                    'applicationSubmit',
                    'applicationUpdate',
                    'candidateHire',
                    'candidateStageChange',
                    'candidateDelete',
                    'candidateMerge',
                    'interviewPlanTransition',
                    'interviewScheduleCreate',
                    'interviewScheduleUpdate',
                    'jobPostingUpdate',
                    'jobPostingPublish',
                    'jobPostingUnpublish',
                    'offerCreate',
                    'offerUpdate',
                    'offerDelete',
                    'pushToHRIS',
                    'surveySubmit',
                  ],
                },
                requestUrl: {
                  type: 'string',
                  description: 'The URL the webhook will send requests to.',
                },
                secretToken: {
                  type: 'string',
                  description:
                    'The secret token used to sign the webhook request. See our documentation [here](https://developers.ashbyhq.com/docs/authenticating-webhooks) for more information.\n',
                },
              },
              required: ['webhookType', 'requestUrl', 'secretToken'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the webhook.create endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              id: {
                                $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                              },
                              enabled: {
                                type: 'boolean',
                                description: 'Whether or not the webhook setting is enabled.',
                              },
                              requestUrl: {
                                type: 'string',
                                description: 'The URL the webhook will send requests to.',
                                example: 'https://example.com/webhook',
                              },
                              secretToken: {
                                type: 'string',
                                description:
                                  'The secret token used to sign the webhook request. See our documentation [here](https://developers.ashbyhq.com/docs/authenticating-webhooks) for more information.\n',
                                example: '0c2f9463f87641919f8106a2c49d7a57',
                              },
                              webhookType: {
                                type: 'string',
                                description: 'The type of webhook.',
                                $ref: '#/paths/~1webhook.create/post/requestBody/content/application~1json/schema/properties/webhookType',
                              },
                            },
                            required: ['id', 'enabled', 'requestUrl', 'secretToken', 'webhookType'],
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/webhook.update': {
    post: {
      summary: 'webhook.update',
      description:
        'Updates a webhook setting. One of `enabled`, `requestUrl`, or `secretToken` must be provided.\n\n**Requires the [`apiKeysWrite`](authentication#permissions-webhookcreate) permission.**\n',
      operationId: 'webhookupdate',
      tags: ['Webhook'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                webhookId: {
                  allOf: [
                    {
                      description: 'The id of the webhook setting to update.',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
                enabled: {
                  type: 'boolean',
                  description: 'Whether or not the webhook is enabled.',
                },
                requestUrl: {
                  type: 'string',
                  description: 'The URL the webhook will send requests to.',
                },
                secretToken: {
                  type: 'string',
                  description:
                    'The secret token used to sign the webhook request. See our documentation [here](https://developers.ashbyhq.com/docs/authenticating-webhooks) for more information.\n',
                },
              },
              required: ['webhookId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the webhook.update endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            $ref: '#/paths/~1webhook.create/post/responses/200/content/application~1json/schema/oneOf/0/allOf/2/properties/results',
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  '/webhook.delete': {
    post: {
      summary: 'webhook.delete',
      description:
        'Deletes a webhook setting.\n\n**Requires the [`apiKeysWrite`](authentication#permissions-webhookcreate) permission.**\n',
      operationId: 'webhookdelete',
      tags: ['Webhook'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                webhookId: {
                  allOf: [
                    {
                      description: 'The id of the webhook setting to delete.',
                    },
                    {
                      $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                    },
                  ],
                },
              },
              required: ['webhookId'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Responses from the webhook.delete endpoint',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Success response',
                    allOf: [
                      {
                        $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/0/allOf/0',
                      },
                      {
                        type: 'object',
                      },
                      {
                        properties: {
                          results: {
                            type: 'object',
                            properties: {
                              webhookId: {
                                allOf: [
                                  {
                                    description: 'The id of the webhook setting that was deleted.',
                                  },
                                  {
                                    $ref: '#/paths/~1interviewerPool.addUser/post/requestBody/content/application~1json/schema/properties/userId',
                                  },
                                ],
                              },
                            },
                          },
                        },
                      },
                      {
                        required: ['results'],
                      },
                    ],
                  },
                  {
                    $ref: '#/paths/~1job.info/post/responses/200/content/application~1json/schema/oneOf/1',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
} as TPaths;
