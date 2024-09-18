// @ts-nocheck
export type openapi = {
  openapi: '3.0.1';
  servers: [
    {
      url: 'http://salesforce.local';
    },
  ];
  externalDocs: {
    description: 'For more information, see the Einstein Platform Services Developer Guide';
    url: 'https://metamind.readme.io';
  };
  paths: {
    '/v2/apiusage': {
      get: {
        description: 'Returns prediction usage on a monthly basis for the current calendar month and future months. Each apiusage object in the response corresponds to a calendar month in your plan.';
        operationId: 'getApiUsagePlansV2';
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiUsageList';
                };
              };
            };
            description: 'api usage';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get API Isage';
        tags: ['Check API Usage'];
      };
    };
    '/v2/language/datasets': {
      get: {
        description: 'Returns a list of datasets and their labels that were created by the current user. The response is sorted by dataset ID.';
        operationId: 'listDatasets';
        parameters: [
          {
            description: 'Index of the dataset from which you want to start paging';
            in: 'query';
            name: 'offset';
            schema: {
              default: '0';
              type: 'string';
            };
          },
          {
            description: 'Number of datsets to return. Maximum valid value is 25. If you specify a number greater than 25, the call returns 25 datasets.';
            in: 'query';
            name: 'count';
            schema: {
              default: '25';
              type: 'string';
            };
          },
          {
            description: 'If true, returns all global datasets. Global datasets are public datasets that Salesforce provides.';
            in: 'query';
            name: 'global';
            schema: {
              default: false;
              type: 'boolean';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DatasetList';
                };
              };
            };
            description: 'Success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get All Datasets';
        tags: ['Language Datasets'];
      };
    };
    '/v2/language/datasets/upload': {
      post: {
        description: 'Creates a dataset, labels, and examples from the specified .csv, .tsv, or .json file. The call returns immediately and continues to upload data in the background.';
        operationId: 'uploadDatasetAsync';
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                properties: {
                  data: {
                    description: 'Path to the .csv, .tsv, or .json file on the local drive (FilePart).';
                    type: 'string';
                  };
                  name: {
                    description: 'Name of the dataset. Optional. If this parameter is omitted, the dataset name is derived from the file name.';
                    example: 'weather';
                    type: 'string';
                  };
                  path: {
                    description: 'URL of the .csv, .tsv, or .json file.';
                    type: 'string';
                  };
                  type: {
                    description: 'Type of dataset data.';
                    enum: ['text-intent', 'text-sentiment'];
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Dataset';
                };
              };
            };
            description: 'Upload initiated';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Create a Dataset From a File Asynchronously';
        tags: ['Language Datasets'];
      };
    };
    '/v2/language/datasets/upload/sync': {
      post: {
        description: 'Creates a dataset, labels, and examples from the specified .csv, .tsv, or .json file. The call returns after the dataset is created and all of the data is uploaded.';
        operationId: 'uploadDatasetSync';
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                properties: {
                  data: {
                    description: 'Path to the .csv, .tsv, or .json file on the local drive (FilePart).';
                    type: 'string';
                  };
                  name: {
                    description: 'Name of the dataset. Optional. If this parameter is omitted, the dataset name is derived from the file name.';
                    example: 'weather';
                    type: 'string';
                  };
                  path: {
                    description: 'URL of the .csv, .tsv, or .json file.';
                    type: 'string';
                  };
                  type: {
                    description: 'Type of dataset data.';
                    enum: ['text-intent', 'text-sentiment'];
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Dataset';
                };
              };
            };
            description: 'Upload success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Create a Dataset From a File Synchronously';
        tags: ['Language Datasets'];
      };
    };
    '/v2/language/datasets/{datasetId}': {
      delete: {
        description: 'Deletes the specified dataset and associated labels and examples.';
        operationId: 'deleteDataset';
        parameters: [
          {
            description: 'Dataset Id';
            example: 'SomeDatasetId';
            in: 'path';
            name: 'datasetId';
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
                  $ref: '#/components/schemas/DeletionResponse';
                };
              };
            };
            description: 'Success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Delete a Dataset';
        tags: ['Language Datasets'];
      };
      get: {
        description: 'Returns a single dataset.';
        operationId: 'getDataset';
        parameters: [
          {
            description: 'Dataset Id';
            example: 'SomeDatasetId';
            in: 'path';
            name: 'datasetId';
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
                  $ref: '#/components/schemas/Dataset';
                };
              };
            };
            description: 'Success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get a Dataset';
        tags: ['Language Datasets'];
      };
    };
    '/v2/language/datasets/{datasetId}/examples': {
      get: {
        description: 'Returns all the examples for the specified dataset,';
        operationId: 'getExamples';
        parameters: [
          {
            description: 'Dataset Id';
            example: 'SomeDatasetId';
            in: 'path';
            name: 'datasetId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Index of the example from which you want to start paging.';
            in: 'query';
            name: 'offset';
            schema: {
              default: '0';
              type: 'string';
            };
          },
          {
            description: 'Number of examples to return.';
            in: 'query';
            name: 'count';
            schema: {
              default: '100';
              type: 'string';
            };
          },
          {
            description: 'return examples that were created in the dataset as feedback';
            in: 'query';
            name: 'source';
            schema: {
              enum: ['all', 'feedback', 'upload'];
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ExampleList';
                };
              };
            };
            description: 'Success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get All Examples';
        tags: ['Language Examples'];
      };
    };
    '/v2/language/datasets/{datasetId}/models': {
      get: {
        description: 'Returns all models for the specified dataset.';
        operationId: 'getTrainedModels';
        parameters: [
          {
            description: 'Index of the model from which you want to start paging.';
            in: 'query';
            name: 'offset';
            schema: {
              default: '0';
              type: 'string';
            };
          },
          {
            description: 'Number of models to return.';
            in: 'query';
            name: 'count';
            schema: {
              default: '100';
              type: 'string';
            };
          },
          {
            description: 'Dataset Id';
            example: 'SomeDatasetId';
            in: 'path';
            name: 'datasetId';
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
                  $ref: '#/components/schemas/ModelList';
                };
              };
            };
            description: 'Success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get All Models';
        tags: ['Language Models'];
      };
    };
    '/v2/language/datasets/{datasetId}/upload': {
      put: {
        description: 'Adds examples from a .csv, .tsv, or .json file to a dataset.';
        operationId: 'updateDatasetAsync';
        parameters: [
          {
            description: 'Dataset Id';
            example: 'SomeDatasetId';
            in: 'path';
            name: 'datasetId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                properties: {
                  data: {
                    description: 'Path to the .csv, .tsv, or .json file on a local drive. ';
                    type: 'string';
                  };
                  type: {
                    description: 'URL of the .csv, .tsv, or .json file.';
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Dataset';
                };
              };
            };
            description: 'Upload success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Create Examples From a File';
        tags: ['Language Examples'];
      };
    };
    '/v2/language/deletion/{id}': {
      get: {
        description: 'Returns the status of a language dataset or model deletion. When you delete a dataset or model, the deletion may not occur immediately. Use this call to find out when the deletion is complete.';
        operationId: 'get';
        parameters: [
          {
            description: 'Deletion Id';
            example: 'Z2JTFBF3A7XKIJC5QEJXMO4HSY';
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DeletionResponse';
                };
              };
            };
            description: 'deletion status';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get Deletion Status';
        tags: ['Language Datasets'];
      };
    };
    '/v2/language/examples': {
      get: {
        description: 'Returns all the examples for the specified label. Returns both uploaded examples and feedback examples.';
        operationId: 'getExamplesByLabel';
        parameters: [
          {
            description: 'Label Id';
            example: 'SomeLabelId';
            in: 'query';
            name: 'labelId';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Index of the example from which you want to start paging.';
            in: 'query';
            name: 'offset';
            schema: {
              default: '0';
              type: 'string';
            };
          },
          {
            description: 'Number of examples to return.';
            in: 'query';
            name: 'count';
            schema: {
              default: '100';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ExampleList';
                };
              };
            };
            description: 'Success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get All Examples for Label';
        tags: ['Language Examples'];
      };
    };
    '/v2/language/feedback': {
      post: {
        description: 'Adds a feedback example to the dataset associated with the specified model.';
        operationId: 'provideFeedback';
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                properties: {
                  document: {
                    description: 'Intent or sentiment string to add to the dataset.';
                    type: 'string';
                  };
                  expectedLabel: {
                    description: 'Correct label for the example. Must be a label that exists in the dataset.';
                    type: 'string';
                  };
                  modelId: {
                    description: 'ID of the model that misclassified the image. The feedback example is added to the dataset associated with this model.';
                    type: 'string';
                  };
                  name: {
                    description: 'Name of the example. Optional. Maximum length is 180 characters.';
                    example: 'feedback-2';
                    maxLength: 180;
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Example';
                };
              };
            };
            description: 'Upload success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Create a Feedback Example';
        tags: ['Language Examples'];
      };
    };
    '/v2/language/intent': {
      post: {
        description: 'Returns an intent prediction for the given string.';
        operationId: 'intentMultipart';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/IntentPredictRequest';
              };
            };
            'multipart/form-data': {
              schema: {
                $ref: '#/components/schemas/IntentPredictRequest';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/IntentPredictResponse';
                };
              };
            };
            description: 'Prediction Result';
          };
          '429': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PredictionErrorResponse';
                };
              };
            };
            description: 'Exceed usage limitation';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Prediction for Intent';
        tags: ['Language Prediction'];
      };
    };
    '/v2/language/models/{modelId}': {
      delete: {
        description: 'Deletes the specified model.';
        operationId: 'deleteModel';
        parameters: [
          {
            description: 'Model Id';
            example: 'SomeModelId';
            in: 'path';
            name: 'modelId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '201': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DeletionResponse';
                };
              };
            };
            description: 'Deletion submitted';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Delete a Model';
        tags: ['Language Models'];
      };
      get: {
        description: 'Returns the metrics for a model';
        operationId: 'getTrainedModelMetrics';
        parameters: [
          {
            description: 'Model Id';
            example: 'SomeModelId';
            in: 'path';
            name: 'modelId';
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
                  $ref: '#/components/schemas/Metrics';
                };
              };
            };
            description: 'Model Metrics';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get Model Metrics';
        tags: ['Language Models'];
      };
    };
    '/v2/language/models/{modelId}/lc': {
      get: {
        description: 'Returns the metrics for each epoch in a model.';
        operationId: 'getTrainedModelLearningCurve';
        parameters: [
          {
            description: 'Model Id';
            example: 'SomeModelId';
            in: 'path';
            name: 'modelId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Index of the epoch from which you want to start paging';
            in: 'query';
            name: 'offset';
            schema: {
              default: '0';
              type: 'string';
            };
          },
          {
            description: 'Number of epoch to return. Maximum valid value is 25.';
            in: 'query';
            name: 'count';
            schema: {
              default: '25';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LearningCurveList';
                };
              };
            };
            description: 'Learning Curve';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get Model Learning Curve';
        tags: ['Language Models'];
      };
    };
    '/v2/language/retrain': {
      post: {
        description: 'Retrains a dataset and updates a model. Use this API call when you want to update a model and keep the model ID instead of creating a new model.';
        operationId: 'retrain';
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                properties: {
                  algorithm: {
                    description: 'Algorithm used for train';
                    example: 'intent';
                    type: 'string';
                  };
                  epochs: {
                    description: 'Number of training iterations for the neural network. Optional.';
                    example: 20;
                    format: 'int32';
                    maximum: 1000;
                    minimum: 1;
                    type: 'integer';
                  };
                  learningRate: {
                    description: 'N/A for intent or sentiment models.';
                    example: 0.0001;
                    format: 'float';
                    type: 'number';
                  };
                  modelId: {
                    description: 'ID of the model to be updated from the training.';
                    example: '7JXCXTRXTMNLJCEF2DR5CJ46QU';
                    type: 'string';
                  };
                  trainParams: {
                    $ref: '#/components/schemas/V2LanguageTrainParams';
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TrainResponse';
                };
              };
            };
            description: 'Training Status';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Retrain a Dataset';
        tags: ['Language Training'];
      };
    };
    '/v2/language/sentiment': {
      post: {
        description: 'Returns a sentiment prediction for the given string.';
        operationId: 'sentimentMultipart';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SentimentPredictRequest';
              };
            };
            'multipart/form-data': {
              schema: {
                $ref: '#/components/schemas/SentimentPredictRequest';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SentimentPredictResponse';
                };
              };
            };
            description: 'Prediction Result';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Prediction for Sentiment';
        tags: ['Language Prediction'];
      };
    };
    '/v2/language/train': {
      post: {
        description: 'Trains a dataset and creates a model.';
        operationId: 'train';
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                properties: {
                  algorithm: {
                    description: 'Algorithm used for train';
                    example: 'intent';
                    type: 'string';
                  };
                  datasetId: {
                    description: 'ID of the dataset to train.';
                    example: 57;
                    format: 'int64';
                    type: 'integer';
                  };
                  epochs: {
                    description: 'Number of training iterations for the neural network. Optional.';
                    example: 20;
                    format: 'int32';
                    maximum: 1000;
                    minimum: 1;
                    type: 'integer';
                  };
                  learningRate: {
                    description: 'N/A for intent or sentiment models.';
                    format: 'double';
                    type: 'number';
                  };
                  name: {
                    description: 'Name of the model. Maximum length is 180 characters.';
                    maxLength: 180;
                    type: 'string';
                  };
                  trainParams: {
                    $ref: '#/components/schemas/V2LanguageTrainParams';
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TrainResponse';
                };
              };
            };
            description: 'Training Status';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Train a Dataset';
        tags: ['Language Training'];
      };
    };
    '/v2/language/train/{modelId}': {
      get: {
        description: "Returns the status of a model's training process. Use the progress field to determine how far the training has progressed. When training completes successfully, the status is SUCCEEDED and the progress is 1.";
        operationId: 'getTrainStatusAndProgress';
        parameters: [
          {
            description: 'Model Id';
            example: 'SomeModelId';
            in: 'path';
            name: 'modelId';
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
                  $ref: '#/components/schemas/TrainResponse';
                };
              };
            };
            description: 'Training Status';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get Training Status';
        tags: ['Language Training'];
      };
    };
    '/v2/oauth2/token': {
      post: {
        description: 'Returns an OAuth access token or a refresh token. You must pass a valid access token in the header of each API call.';
        externalDocs: {
          description: 'authentication guid';
          url: 'https://metamind.readme.io/docs/generate-an-oauth-access-token';
        };
        operationId: 'generateTokenV2';
        requestBody: {
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                properties: {
                  assertion: {
                    description: 'encrypted payload to identify yourself';
                    example: 'SOME_ASSERTION_STRING';
                    type: 'string';
                  };
                  grant_type: {
                    description: 'specify the authentication method desired';
                    enum: ['urn:ietf:params:oauth:grant-type:jwt-bearer', 'refresh_token'];
                    example: 'urn:ietf:params:oauth:grant-type:jwt-bearer';
                    type: 'string';
                  };
                  refresh_token: {
                    description: 'The refresh token you created previously.';
                    example: 'SomeRefreshToken';
                    type: 'string';
                  };
                  scope: {
                    description: 'set to `offline` to generate a refresh token';
                    example: 'offline';
                    type: 'string';
                  };
                  valid_for: {
                    default: 60;
                    description: 'Number of seconds until the access token expires. Default is 60 seconds. Maximum value is 30 days';
                    example: 120;
                    format: 'int32';
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GenerateAccessTokenResponse';
                };
              };
            };
            description: 'access token result';
          };
        };
        summary: 'Generate an OAuth Token';
        tags: ['Authorization'];
      };
    };
    '/v2/oauth2/tokens/{token}': {
      delete: {
        operationId: 'revokeRefreshTokenV2';
        parameters: [
          {
            description: 'the token to revoke';
            example: 'SOME_REFRESH_TOKEN';
            in: 'path';
            name: 'token';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '204': {
            description: 'deleted, with no content returned';
          };
          '400': {
            description: 'token cannot be removed';
          };
          '404': {
            description: 'token not found';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Delete a Refresh Token';
        tags: ['Authorization'];
      };
    };
    '/v2/vision/bulkfeedback': {
      put: {
        description: 'Adds feedback examples to the dataset associated with the specified object detection model.';
        operationId: 'updateDatasetAsync_1';
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                properties: {
                  data: {
                    description: 'Local .zip file to upload. The maximum .zip file size you can upload from a local drive is 50 MB.';
                    type: 'string';
                  };
                  modelId: {
                    description: 'ID of the model that misclassified the images. The feedback examples are added to the dataset associated with this model.';
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Dataset';
                };
              };
            };
            description: 'Update success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Create Feedback Examples From a Zip File';
        tags: ['Vision Examples'];
      };
    };
    '/v2/vision/datasets': {
      get: {
        description: 'Returns a list of datasets and their labels that were created by the current user. The response is sorted by dataset ID.';
        operationId: 'listDatasets_1';
        parameters: [
          {
            description: 'Index of the dataset from which you want to start paging';
            in: 'query';
            name: 'offset';
            schema: {
              default: '0';
              type: 'string';
            };
          },
          {
            description: 'Number of datsets to return. Maximum valid value is 25. If you specify a number greater than 25, the call returns 25 datasets.';
            in: 'query';
            name: 'count';
            schema: {
              default: '25';
              type: 'string';
            };
          },
          {
            description: 'If true, returns all global datasets. Global datasets are public datasets that Salesforce provides.';
            in: 'query';
            name: 'global';
            schema: {
              default: false;
              type: 'boolean';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DatasetList';
                };
              };
            };
            description: 'Success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get All Datasets';
        tags: ['Vision Datasets'];
      };
      post: {
        description: "Creates a dataset and labels, if they're specified.";
        operationId: 'createDataset';
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                properties: {
                  labels: {
                    description: 'Optional comma-separated list of labels. If specified, creates the labels in the dataset. Maximum number of labels per dataset is 250.';
                    example: 'beach,mountain';
                    type: 'string';
                  };
                  name: {
                    description: 'Name of the dataset. Maximum length is 180 characters.';
                    example: 'Beach and Mountain';
                    maxLength: 180;
                    type: 'string';
                  };
                  type: {
                    description: 'Type of dataset data';
                    enum: ['image', 'image-multi-label'];
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Dataset';
                };
              };
            };
            description: 'Creation success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Create a Dataset';
        tags: ['Vision Datasets'];
      };
    };
    '/v2/vision/datasets/upload': {
      post: {
        description: 'Creates a dataset, labels, and examples from the specified .zip file. The call returns immediately and continues to upload the images in the background.';
        operationId: 'uploadDatasetAsync_1';
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                properties: {
                  data: {
                    description: 'Path to the .zip file on the local drive (FilePart).';
                    type: 'string';
                  };
                  name: {
                    description: 'Name of the dataset. Optional. If this parameter is omitted, the dataset name is derived from the .zip file name.';
                    example: 'mountainvsbeach';
                    type: 'string';
                  };
                  path: {
                    description: 'URL of the .zip file.';
                    type: 'string';
                  };
                  type: {
                    description: 'Type of dataset data.';
                    enum: ['image', 'image-detection', 'image-multi-label'];
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Dataset';
                };
              };
            };
            description: 'Upload initiated';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Create a Dataset From a Zip File Asynchronously';
        tags: ['Vision Datasets'];
      };
    };
    '/v2/vision/datasets/upload/sync': {
      post: {
        description: 'Creates a dataset, labels, and examples from the specified .zip file. The call returns after the dataset is created and all of the images are uploaded.';
        operationId: 'uploadDatasetSync_1';
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                properties: {
                  data: {
                    description: 'Path to the .zip file on the local drive (FilePart).';
                    type: 'string';
                  };
                  name: {
                    description: 'Name of the dataset. Optional. If this parameter is omitted, the dataset name is derived from the .zip file name.';
                    example: 'mountainvsbeach';
                    type: 'string';
                  };
                  path: {
                    description: 'URL of the .zip file.';
                    type: 'string';
                  };
                  type: {
                    description: 'Type of dataset data.';
                    enum: ['image', 'image-detection', 'image-multi-label'];
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Dataset';
                };
              };
            };
            description: 'Upload success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Create a Dataset From a Zip File Synchronously';
        tags: ['Vision Datasets'];
      };
    };
    '/v2/vision/datasets/{datasetId}': {
      delete: {
        description: 'Deletes the specified dataset and associated labels and examples.';
        operationId: 'deleteDataset_1';
        parameters: [
          {
            description: 'Dataset Id';
            example: 'SomeDatasetId';
            in: 'path';
            name: 'datasetId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        responses: {
          '201': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DeletionResponse';
                };
              };
            };
            description: 'Success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Delete a Dataset';
        tags: ['Vision Datasets'];
      };
      get: {
        description: 'Returns a single dataset.';
        operationId: 'getDataset_1';
        parameters: [
          {
            description: 'Dataset Id';
            example: 'SomeDatasetId';
            in: 'path';
            name: 'datasetId';
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
                  $ref: '#/components/schemas/Dataset';
                };
              };
            };
            description: 'Success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get a Dataset';
        tags: ['Vision Datasets'];
      };
    };
    '/v2/vision/datasets/{datasetId}/examples': {
      get: {
        description: 'Returns all the examples for the specified dataset. By default, returns examples created by uploading them from a .zip file.';
        operationId: 'getExamples_1';
        parameters: [
          {
            description: 'Dataset Id';
            example: 'SomeDatasetId';
            in: 'path';
            name: 'datasetId';
            required: true;
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Index of the example from which you want to start paging.';
            in: 'query';
            name: 'offset';
            schema: {
              default: '0';
              type: 'string';
            };
          },
          {
            description: 'Number of examples to return.';
            in: 'query';
            name: 'count';
            schema: {
              default: '100';
              type: 'string';
            };
          },
          {
            description: 'return examples that were created in the dataset as feedback';
            in: 'query';
            name: 'source';
            schema: {
              enum: ['all', 'feedback', 'upload'];
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ExampleList';
                };
              };
            };
            description: 'Success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get All Examples';
        tags: ['Vision Examples'];
      };
      post: {
        description: 'Adds an example with the specified label to a dataset.';
        operationId: 'addExample';
        parameters: [
          {
            description: 'Dataset Id';
            example: 'SomeDatasetId';
            in: 'path';
            name: 'datasetId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                properties: {
                  data: {
                    description: 'Location of the local image file to upload.';
                    type: 'string';
                  };
                  labelId: {
                    description: 'ID of the label to add to the example.';
                    example: 42;
                    format: 'int64';
                    type: 'integer';
                  };
                  name: {
                    description: 'Name of the example. Maximum length is 180 characters.';
                    maxLength: 180;
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Example';
                };
              };
            };
            description: 'Example created';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Create an Example';
        tags: ['Vision Examples'];
      };
    };
    '/v2/vision/datasets/{datasetId}/models': {
      get: {
        description: 'Returns all models for the specified dataset.';
        operationId: 'getTrainedModels_1';
        parameters: [
          {
            description: 'Index of the model from which you want to start paging.';
            in: 'query';
            name: 'offset';
            schema: {
              default: '0';
              type: 'string';
            };
          },
          {
            description: 'Number of models to return.';
            in: 'query';
            name: 'count';
            schema: {
              default: '100';
              type: 'string';
            };
          },
          {
            description: 'Dataset Id';
            example: 'SomeDatasetId';
            in: 'path';
            name: 'datasetId';
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
                  $ref: '#/components/schemas/ModelList';
                };
              };
            };
            description: 'Success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get All Models';
        tags: ['Vision Models'];
      };
    };
    '/v2/vision/datasets/{datasetId}/upload': {
      put: {
        description: 'Adds examples from a .zip file to a dataset. You can use this call only with a dataset that was created from a .zip file.';
        operationId: 'updateDatasetAsync_2';
        parameters: [
          {
            description: 'Dataset Id';
            example: 'SomeDatasetId';
            in: 'path';
            name: 'datasetId';
            required: true;
            schema: {
              type: 'string';
            };
          },
        ];
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                properties: {
                  data: {
                    description: 'Location of the local image file to upload.';
                    type: 'string';
                  };
                  path: {
                    description: 'URL of the .zip file.';
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Dataset';
                };
              };
            };
            description: 'Upload success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Create Examples From a Zip File';
        tags: ['Vision Examples'];
      };
    };
    '/v2/vision/deletion/{id}': {
      get: {
        description: 'Returns the status of an image dataset or model deletion. When you delete a dataset or model, the deletion may not occur immediately. Use this call to find out when the deletion is complete.';
        operationId: 'get_1';
        parameters: [
          {
            description: 'Deletion Id';
            example: 'Z2JTFBF3A7XKIJC5QEJXMO4HSY';
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DeletionResponse';
                };
              };
            };
            description: 'deletion status';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get Deletion Status';
        tags: ['Vision Datasets'];
      };
    };
    '/v2/vision/detect': {
      post: {
        description: 'Returns labels, probabilities, and bounding box coordinates for items detected in the specified local image file.';
        operationId: 'detectMultipart';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ObjectDetectionRequest';
              };
            };
            'multipart/form-data': {
              schema: {
                $ref: '#/components/schemas/ObjectDetectionRequest';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ObjectDetectionResponse';
                };
              };
            };
            description: 'Detection Result';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Detection with Image File';
        tags: ['Vision Prediction'];
      };
    };
    '/v2/vision/examples': {
      get: {
        description: 'Returns all the examples for the specified label. Returns both uploaded examples and feedback examples.';
        operationId: 'getExamplesByLabel_1';
        parameters: [
          {
            description: 'Label Id';
            example: 'SomeLabelId';
            in: 'query';
            name: 'labelId';
            schema: {
              type: 'string';
            };
          },
          {
            description: 'Index of the example from which you want to start paging.';
            in: 'query';
            name: 'offset';
            schema: {
              default: '0';
              type: 'string';
            };
          },
          {
            description: 'Number of examples to return.';
            in: 'query';
            name: 'count';
            schema: {
              default: '100';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ExampleList';
                };
              };
            };
            description: 'Success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get All Examples for Label';
        tags: ['Vision Examples'];
      };
    };
    '/v2/vision/feedback': {
      post: {
        description: 'Adds a feedback example to the dataset associated with the specified model.';
        operationId: 'provideFeedback_1';
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                properties: {
                  data: {
                    description: 'Local image file to upload.';
                    type: 'string';
                  };
                  expectedLabel: {
                    description: 'Correct label for the example. Must be a label that exists in the dataset.';
                    type: 'string';
                  };
                  modelId: {
                    description: 'ID of the model that misclassified the image. The feedback example is added to the dataset associated with this model.';
                    type: 'string';
                  };
                  name: {
                    description: 'Name of the example. Optional. Maximum length is 180 characters.';
                    example: 'feedback-1';
                    maxLength: 180;
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Example';
                };
              };
            };
            description: 'Upload success';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Create a Feedback Example';
        tags: ['Vision Examples'];
      };
    };
    '/v2/vision/models/{modelId}': {
      delete: {
        description: 'Deletes the specified model.';
        operationId: 'deleteModel_1';
        parameters: [
          {
            in: 'path';
            name: 'modelId';
            required: true;
            schema: {
              description: 'Model Id';
              example: 'SomeModelId';
              type: 'string';
            };
          },
        ];
        responses: {
          '201': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DeletionResponse';
                };
              };
            };
            description: 'Deletion submitted';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Delete a Model';
        tags: ['Vision Models'];
      };
      get: {
        description: 'Returns the metrics for a model';
        operationId: 'getTrainedModelMetrics_1';
        parameters: [
          {
            in: 'path';
            name: 'modelId';
            required: true;
            schema: {
              description: 'Model Id';
              example: 'SomeModelId';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Metrics';
                };
              };
            };
            description: 'Model Metrics';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get Model Metrics';
        tags: ['Vision Models'];
      };
    };
    '/v2/vision/models/{modelId}/lc': {
      get: {
        description: 'Returns the metrics for each epoch in a model.';
        operationId: 'getTrainedModelLearningCurve_1';
        parameters: [
          {
            in: 'path';
            name: 'modelId';
            required: true;
            schema: {
              description: 'Model Id';
              example: 'SomeModelId';
              type: 'string';
            };
          },
          {
            description: 'Index of the epoch from which you want to start paging';
            in: 'query';
            name: 'offset';
            schema: {
              default: '0';
              type: 'string';
            };
          },
          {
            description: 'Number of epoch to return. Maximum valid value is 25.';
            in: 'query';
            name: 'count';
            schema: {
              default: '25';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LearningCurveList';
                };
              };
            };
            description: 'Learning Curve';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get Model Learning Curve';
        tags: ['Vision Models'];
      };
    };
    '/v2/vision/ocr': {
      post: {
        description: 'Returns a prediction from an OCR model for the specified image URL or local image file.';
        operationId: 'ocrMultipart';
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                properties: {
                  modelId: {
                    description: 'ID of the model that makes the prediction. Valid values are OCRModel and tabulatev2.';
                    example: 'WJH4YCA7YX4PCWVNCYNWYHBMY4';
                    type: 'string';
                  };
                  sampleContent: {
                    description: 'Binary content of image file uploaded as multipart/form-data. Optional.';
                    format: 'binary';
                    type: 'string';
                  };
                  sampleId: {
                    description: 'String that you can pass in to tag the prediction. Optional. Can be any value, and is returned in the response.';
                    type: 'string';
                  };
                  sampleLocation: {
                    description: 'URL of the image file. Use this parameter when sending in a file from a web location. Optional.';
                    type: 'string';
                  };
                  task: {
                    default: 'text';
                    description: 'Optional. Designates the type of data in the image. Default is text. Valid values: contact, table, and text.';
                    example: 'table';
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/OCRPredictResponse';
                };
              };
            };
            description: 'OCR Result';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Detect Text';
        tags: ['Vision Prediction'];
      };
    };
    '/v2/vision/predict': {
      post: {
        description: 'Returns a prediction from an image or multi-label model for the specified image.';
        operationId: 'predictMultipart';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ImageClassificationRequest';
              };
            };
            'multipart/form-data': {
              schema: {
                $ref: '#/components/schemas/ImageClassificationRequest';
              };
            };
          };
        };
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ImageClassificationResponse';
                };
              };
            };
            description: 'Prediction Result';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Make Prediction';
        tags: ['Vision Prediction'];
      };
    };
    '/v2/vision/retrain': {
      post: {
        description: 'Retrains a dataset and updates a model. Use this API call when you want to update a model and keep the model ID instead of creating a new model.';
        operationId: 'retrain_1';
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                properties: {
                  algorithm: {
                    description: 'Specifies the algorithm used to train the dataset. Optional. Use this parameter only when training a dataset with a type of image-detection. Valid values are object-detection-v1 and retail-execution.';
                    example: 'object-detection';
                    type: 'string';
                  };
                  epochs: {
                    description: 'Number of training iterations for the neural network. Optional.';
                    example: 20;
                    format: 'int32';
                    maximum: 1000;
                    minimum: 1;
                    type: 'integer';
                  };
                  learningRate: {
                    description: 'Specifies how much the gradient affects the optimization of the model at each time step. Optional.';
                    example: 0.0001;
                    format: 'float';
                    type: 'number';
                  };
                  modelId: {
                    description: 'ID of the model to be updated from the training.';
                    example: '7JXCXTRXTMNLJCEF2DR5CJ46QU';
                    type: 'string';
                  };
                  trainParams: {
                    $ref: '#/components/schemas/V2VisionTrainParams';
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TrainResponse';
                };
              };
            };
            description: 'Training Status';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Retrain a Dataset';
        tags: ['Vision Training'];
      };
    };
    '/v2/vision/train': {
      post: {
        description: 'Trains a dataset and creates a model.';
        operationId: 'train_1';
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                properties: {
                  algorithm: {
                    description: 'Specifies the algorithm used to train the dataset. Optional. Use this parameter only when training a dataset with a type of image-detection. Valid values are object-detection-v1 and retail-execution.';
                    example: 'object-detection';
                    type: 'string';
                  };
                  datasetId: {
                    description: 'ID of the dataset to train.';
                    example: 57;
                    format: 'int64';
                    type: 'integer';
                  };
                  epochs: {
                    description: 'Number of training iterations for the neural network. Optional.';
                    example: 20;
                    format: 'int32';
                    maximum: 1000;
                    minimum: 1;
                    type: 'integer';
                  };
                  learningRate: {
                    description: 'Specifies how much the gradient affects the optimization of the model at each time step. Optional.';
                    example: 0.0001;
                    format: 'double';
                    type: 'number';
                  };
                  name: {
                    description: 'Name of the model. Maximum length is 180 characters.';
                    maxLength: 180;
                    type: 'string';
                  };
                  trainParams: {
                    $ref: '#/components/schemas/V2VisionTrainParams';
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
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TrainResponse';
                };
              };
            };
            description: 'Training Status';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Train a Dataset';
        tags: ['Vision Training'];
      };
    };
    '/v2/vision/train/{modelId}': {
      get: {
        description: "Returns the status of a model's training process. Use the progress field to determine how far the training has progressed. When training completes successfully, the status is SUCCEEDED and the progress is 1.";
        operationId: 'getTrainStatusAndProgress_1';
        parameters: [
          {
            in: 'path';
            name: 'modelId';
            required: true;
            schema: {
              description: 'Model Id';
              example: 'SomeModelId';
              type: 'string';
            };
          },
        ];
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TrainResponse';
                };
              };
            };
            description: 'Training Status';
          };
        };
        security: [
          {
            bearer_token: [];
          },
        ];
        summary: 'Get Training Status';
        tags: ['Vision Training'];
      };
    };
  };
  components: {
    schemas: {
      ApiUsage: {
        properties: {
          endsAt: {
            format: 'date-time';
            title: 'Date and time that the plan calendar month ends. Always 12 am on the first day of the following month.';
            type: 'string';
          };
          id: {
            example: '489';
            title: 'Unique ID for the API usage plan month';
            type: 'string';
          };
          licenseId: {
            example: 'kJCHtYDCSf';
            title: 'Unique ID of the API plan.';
            type: 'string';
          };
          object: {
            example: 'apiusage';
            title: 'Object returned; in this case, apiusage.';
            type: 'string';
          };
          organizationId: {
            example: '108';
            title: 'Unique ID for the user making the API call';
            type: 'string';
          };
          planData: {
            items: {
              $ref: '#/components/schemas/PlanData';
            };
            title: 'Plan data details';
            type: 'array';
          };
          predictionsMax: {
            example: 1997;
            format: 'int64';
            title: 'Number of predictions left for the calendar month.';
            type: 'integer';
          };
          predictionsUsed: {
            example: 3;
            format: 'int64';
            title: 'Number of predictions used in the calendar month.';
            type: 'integer';
          };
          startsAt: {
            format: 'date-time';
            title: 'Date and time that the plan calendar month begins. Always the first of the month.';
            type: 'string';
          };
        };
        title: 'Api Usage';
        type: 'object';
      };
      ApiUsageList: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/ApiUsage';
            };
            type: 'array';
          };
          object: {
            example: 'list';
            title: 'Object returned; in this case, list.';
            type: 'string';
          };
        };
        title: 'Api Usage List';
        type: 'object';
      };
      Attributes: {
        description: 'Contains additional attributes related to the task parameter. If the task parameter is table, the row and column IDs for the detected text are returned. If the task parameter is contact, the detected entity tags will be returned.';
        properties: {
          cellLocation: {
            $ref: '#/components/schemas/CellLocation';
          };
          language: {
            type: 'string';
          };
          pageNumber: {
            type: 'string';
          };
          tag: {
            type: 'string';
          };
          value: {
            $ref: '#/components/schemas/EntityObject';
          };
        };
        type: 'object';
      };
      BoundingBox: {
        properties: {
          maxX: {
            description: 'X-coordinate of the left side of the bounding box. The origin of the coordinate system is the top-left of the image. Number of pixels from the left edge of the image.';
            format: 'int32';
            type: 'integer';
          };
          maxY: {
            description: 'Y-coordinate of the top of the bounding box. Number of pixels from the top edge of the image.';
            format: 'int32';
            type: 'integer';
          };
          minX: {
            description: 'X-coordinate of the right side of the bounding box. Number of pixels from the left edge of the image.';
            format: 'int32';
            type: 'integer';
          };
          minY: {
            description: 'Y-coordinate of the bottom of the bounding box. Number of pixels from the top edge of the image.';
            format: 'int32';
            type: 'integer';
          };
        };
        type: 'object';
      };
      CellLocation: {
        properties: {
          colIndex: {
            description: 'Index of the column that contains the detected text.';
            format: 'int32';
            type: 'integer';
          };
          rowIndex: {
            description: 'Index of the row that contains the detected text.';
            format: 'int32';
            type: 'integer';
          };
        };
        type: 'object';
      };
      Dataset: {
        properties: {
          available: {
            title: 'Specifies whether the dataset is ready to be trained.';
            type: 'boolean';
          };
          createdAt: {
            description: 'Date and time that the dataset was created.';
            format: 'date-time';
            type: 'string';
          };
          id: {
            example: 1000014;
            format: 'int64';
            title: 'Dataset ID.';
            type: 'integer';
          };
          labelSummary: {
            $ref: '#/components/schemas/LabelSummary';
          };
          language: {
            description: 'Dataset language.';
            example: 'N/A';
            type: 'string';
          };
          name: {
            example: 'weather report';
            title: 'Name of the dataset.';
            type: 'string';
          };
          numOfDuplicates: {
            description: 'Number of duplicate images. This number includes duplicates in the .zip file from which the dataset was created plus the number of duplicate images from subsequent PUT calls to add images to the dataset.';
            format: 'int32';
            type: 'integer';
          };
          object: {
            description: 'Object returned; in this case, dataset.';
            example: 'dataset';
            type: 'string';
          };
          statusMsg: {
            example: 'SUCCEEDED';
            title: 'Status of the dataset creation and data upload.';
            type: 'string';
          };
          totalExamples: {
            description: 'Total number of examples in the dataset.';
            example: 20;
            format: 'int32';
            type: 'integer';
          };
          totalLabels: {
            description: 'Total number of labels in the dataset.';
            example: 2;
            format: 'int32';
            type: 'integer';
          };
          type: {
            title: 'Type of dataset data.';
            type: 'string';
          };
          updatedAt: {
            format: 'date-time';
            title: 'Date and time that the dataset was last updated.';
            type: 'string';
          };
        };
        required: ['id', 'name'];
        type: 'object';
      };
      DatasetList: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/Dataset';
            };
            type: 'array';
          };
          object: {
            example: 'list';
            title: 'Object returned; in this case, list.';
            type: 'string';
          };
        };
        type: 'object';
      };
      DeletionResponse: {
        properties: {
          deletedObjectId: {
            example: '1003360';
            title: 'ID of the object deleted. Depending on the object you delete, this contains the dataset ID or the model ID.';
            type: 'string';
          };
          id: {
            example: 'Z2JTFBF3A7XKIJC5QEJXMO4HSY';
            title: 'ID of the deletion';
            type: 'string';
          };
          message: {
            title: 'Additional information about the deletion. For example, a message is returned if the deletion fails.';
            type: 'string';
          };
          object: {
            example: 'deletion';
            title: 'Object returned; in this case, deletion.';
            type: 'string';
          };
          organizationId: {
            example: '2';
            title: 'ID of the org to which the dataset or model being deleted belongs.';
            type: 'string';
          };
          progress: {
            example: 1;
            format: 'double';
            title: 'How far the deletion has progressed. Values are between 0�1.';
            type: 'number';
          };
          status: {
            enum: [
              'QUEUED',
              'RUNNING',
              'SUCCEEDED_WAITING_FOR_CACHE_REMOVAL',
              'SUCCEEDED',
              'KILLED',
              'FAILED',
              'RETRY',
            ];
            title: 'Status of the deletion.';
            type: 'string';
          };
          type: {
            enum: ['DATASET', 'MODEL'];
            title: "Object that's being deleted";
            type: 'string';
          };
        };
        type: 'object';
      };
      DetectionResult: {
        description: 'label';
        properties: {
          boundingBox: {
            $ref: '#/components/schemas/BoundingBox';
          };
          label: {
            description: 'Probability lable for the input. ';
            type: 'string';
          };
          probability: {
            description: 'Probability value for the input. Values are between 0�1.';
            format: 'float';
            type: 'number';
          };
        };
        type: 'object';
      };
      EntityObject: {
        properties: {
          boundingBox: {
            $ref: '#/components/schemas/BoundingBox';
          };
          entity: {
            type: 'string';
          };
          text: {
            type: 'string';
          };
        };
        type: 'object';
      };
      Example: {
        properties: {
          createdAt: {
            description: 'Date and time that the example was created.';
            format: 'date-time';
            type: 'string';
          };
          id: {
            description: 'ID of the example.';
            example: 546;
            format: 'int64';
            type: 'integer';
          };
          label: {
            $ref: '#/components/schemas/Label';
          };
          location: {
            description: 'URL of the image in the dataset. This is a temporary URL that expires in 30 minutes. This URL can be used to display images that were uploaded to a dataset in a UI.';
            example: 'https://K3A04Q79O5TBySIZSeMIj%2BC3zqi7rOmeK...';
            type: 'string';
          };
          name: {
            description: 'Name of the example.';
            example: '659803277.jpg';
            type: 'string';
          };
          object: {
            description: 'Object returned; in this case, example.';
            example: 'example';
            type: 'string';
          };
        };
        required: ['id', 'name'];
        type: 'object';
      };
      ExampleList: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/Example';
            };
            type: 'array';
          };
          object: {
            example: 'list';
            title: 'Object returned; in this case, list.';
            type: 'string';
          };
        };
        type: 'object';
      };
      GenerateAccessTokenResponse: {
        properties: {
          access_token: {
            example: 'SPFPQ5IBLB6DPE6FKPWHMIWW4MCRICX4M4KQXFQMI6THZXIEZ6QGNWNOERD6S7655LJAFWTRIKC4KGYO5G3XROMEOTBSS53CFSB6GIA';
            title: 'Access token for authorization.';
            type: 'string';
          };
          expires_in: {
            example: '120';
            title: 'Number of seconds that the token will expire from the time it was generated.';
            type: 'string';
          };
          refresh_token: {
            example: 'FL4GSVQS4W5CKSFRVZBLPIVZZJ2K4VIFPLGZ45SJGUQK4SS56IWPWACZ7V2B7OVLVKZCNK5JZSSW7CIHCNQJAO3TOUE3375108HHTLY';
            title: 'Refresh token that can be used to generate an access token. Only returned when you pass the scope=offline parameter to the endpoint.';
            type: 'string';
          };
          token_type: {
            example: 'Bearer';
            title: 'Type of token returned. Always Bearer.';
            type: 'string';
          };
        };
        type: 'object';
      };
      ImageClassificationRequest: {
        properties: {
          modelId: {
            description: 'ID of the model that makes the prediction.';
            example: 'WJH4YCA7YX4PCWVNCYNWYHBMY4';
            type: 'string';
          };
          numResults: {
            description: 'Number of probabilities to return.';
            example: 3;
            format: 'int32';
            minimum: 1;
            type: 'integer';
          };
          sampleBase64Content: {
            description: 'The image contained in a base64 string.';
            example: 'SomeBase64EncodedImage';
            type: 'string';
          };
          sampleId: {
            description: 'String that you can pass in to tag the prediction. Optional. Can be any value, and is returned in the response.';
            type: 'string';
          };
          sampleLocation: {
            description: 'URL of the image file.';
            type: 'string';
          };
        };
        required: ['modelId'];
        type: 'object';
      };
      ImageClassificationResponse: {
        properties: {
          object: {
            example: 'predictresponse';
            title: 'Object returned; in this case, predictresponse.';
            type: 'string';
          };
          probabilities: {
            items: {
              $ref: '#/components/schemas/LabelResult';
            };
            type: 'array';
          };
          sampleId: {
            description: 'Value passed in when the prediction call was made. Returned only if the sampleId request parameter is provided.';
            example: 'Sample1';
            type: 'string';
          };
        };
        type: 'object';
      };
      IntentPredictRequest: {
        properties: {
          document: {
            description: 'Text for which you want to return an intent prediction.';
            example: "I can't tell you how much fun it was";
            type: 'string';
          };
          modelId: {
            description: 'ID of the model that makes the prediction. The model must have been created from a dataset with a type of text-sentiment.';
            example: 'WJH4YCA7YX4PCWVNCYNWYHBMY4';
            type: 'string';
          };
          numResults: {
            description: 'Number of probabilities to return. ';
            example: 3;
            format: 'int32';
            minimum: 1;
            type: 'integer';
          };
          sampleId: {
            description: 'String that you can pass in to tag the prediction. Optional. Can be any value, and is returned in the response.';
            type: 'string';
          };
        };
        required: ['document', 'modelId'];
        type: 'object';
      };
      IntentPredictResponse: {
        properties: {
          object: {
            example: 'predictresponse';
            title: 'Object returned; in this case, predictresponse.';
            type: 'string';
          };
          probabilities: {
            items: {
              $ref: '#/components/schemas/LabelResult';
            };
            type: 'array';
          };
          sampleId: {
            description: 'Value passed in when the prediction call was made. Returned only if the sampleId request parameter is provided.';
            example: 'Sample1';
            type: 'string';
          };
        };
        type: 'object';
      };
      Label: {
        description: 'Contains information about the label with which the example is associated.';
        properties: {
          datasetId: {
            description: 'ID of the dataset that the label belongs to.';
            example: 57;
            format: 'int64';
            type: 'integer';
          };
          id: {
            description: 'ID of the label.';
            example: 621;
            format: 'int64';
            type: 'integer';
          };
          name: {
            description: 'Name of the label.';
            example: 'Mountain';
            type: 'string';
          };
          numExamples: {
            description: 'Number of examples that have the label.';
            example: 40;
            format: 'int64';
            type: 'integer';
          };
        };
        required: ['datasetId', 'name'];
        type: 'object';
      };
      LabelResult: {
        description: 'label';
        properties: {
          label: {
            description: 'Probability lable for the input. ';
            type: 'string';
          };
          probability: {
            description: 'Probability value for the input. Values are between 0�1.';
            format: 'float';
            type: 'number';
          };
        };
        type: 'object';
      };
      LabelSummary: {
        description: 'Contains the labels array that contains all the labels for the dataset.';
        properties: {
          labels: {
            items: {
              $ref: '#/components/schemas/Label';
            };
            type: 'array';
          };
        };
        type: 'object';
      };
      LearningCurve: {
        properties: {
          epoch: {
            description: 'Epoch to which the metrics correspond.';
            example: 1;
            type: 'object';
          };
          epochResults: {
            description: 'Prediction results for the set of data used to test the model during training.';
            type: 'object';
          };
          metricsData: {
            description: 'Model metrics values.';
            type: 'object';
          };
          object: {
            description: 'Object returned; in this case, learningcurve.';
            example: 'learningcurve';
            type: 'string';
          };
        };
        type: 'object';
      };
      LearningCurveList: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/LearningCurve';
            };
            type: 'array';
          };
          object: {
            example: 'list';
            title: 'Object returned; in this case, list.';
            type: 'string';
          };
        };
        type: 'object';
      };
      Metrics: {
        properties: {
          algorithm: {
            type: 'string';
          };
          createdAt: {
            description: 'Date and time that the model was created.';
            format: 'date-time';
            type: 'string';
          };
          id: {
            description: 'Model Id';
            type: 'string';
          };
          language: {
            type: 'string';
          };
          metricsData: {
            description: 'Model metrics values.';
            type: 'object';
          };
          object: {
            type: 'string';
          };
        };
        type: 'object';
      };
      Model: {
        properties: {
          algorithm: {
            description: 'Algorithm used to create the model. Returned only when the modelType is image-detection.';
            example: 'object-detection';
            type: 'string';
          };
          createdAt: {
            description: 'Date and time that the model was created.';
            format: 'date-time';
            type: 'string';
          };
          datasetId: {
            description: 'ID of the dataset trained to create the model.';
            example: 57;
            format: 'int64';
            type: 'integer';
          };
          datasetVersionId: {
            description: 'Not available yet';
            example: 0;
            format: 'int64';
            type: 'integer';
          };
          failureMsg: {
            description: 'Reason the dataset training failed. Returned only if the training status is FAILED.';
            example: 'To train a dataset and create a model, the dataset must contain at least 100 examples per label for test set';
            type: 'string';
          };
          language: {
            description: 'Model language inherited from the dataset language. For image datasets, default is N/A. For text datasets, default is en_US.';
            example: 'en_US';
            type: 'string';
          };
          modelId: {
            description: 'ID of the model. Contains letters and numbers.';
            example: '2KXJEOM3N562JBT4P7OX7VID2Q';
            type: 'string';
          };
          modelType: {
            description: 'Type of data from which the model was created.';
            type: 'string';
          };
          name: {
            description: 'Name of the model.';
            example: 'My Model - Version1';
            type: 'string';
          };
          object: {
            description: 'Object returned; in this case, model.';
            example: 'model';
            type: 'string';
          };
          progress: {
            description: 'How far the dataset training has progressed. Values are between 0�1.';
            type: 'number';
          };
          status: {
            description: 'Status of the model.';
            enum: ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'KILLED', 'FAILED_WITH_RETRIES'];
            type: 'string';
          };
          updatedAt: {
            description: 'Date and time that the model was last updated.';
            format: 'date-time';
            type: 'string';
          };
        };
        required: ['datasetId', 'datasetVersionId', 'modelId', 'name', 'progress', 'status'];
        type: 'object';
      };
      ModelList: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/Model';
            };
            type: 'array';
          };
          object: {
            example: 'list';
            title: 'Object returned; in this case, list.';
            type: 'string';
          };
        };
        type: 'object';
      };
      OCRPredictResponse: {
        properties: {
          object: {
            example: 'predictresponse';
            title: 'Object returned; in this case, predictresponse.';
            type: 'string';
          };
          probabilities: {
            items: {
              $ref: '#/components/schemas/OCRResult';
            };
            type: 'array';
          };
          sampleId: {
            description: 'Same value as request parameter. Returned only if the sampleId request parameter is provided.';
            example: 'Sample1';
            type: 'string';
          };
          task: {
            description: "Same value as request parameter. Returns text if the request parameter isn't supplied.";
            example: 'Task1';
            type: 'string';
          };
        };
        type: 'object';
      };
      OCRResult: {
        description: 'Array of probabilities for the prediction.';
        properties: {
          attributes: {
            $ref: '#/components/schemas/Attributes';
          };
          boundingBox: {
            $ref: '#/components/schemas/BoundingBox';
          };
          label: {
            description: 'Content of the detected text.';
            type: 'string';
          };
          probability: {
            description: 'Probability value for the input. Values are between 0�1.';
            format: 'float';
            type: 'number';
          };
        };
        type: 'object';
      };
      ObjectDetectionRequest: {
        properties: {
          modelId: {
            description: 'ID of the model that makes the detection.';
            example: 'YCQ4ZACEPJFGXZNRA6ERF3GL5E';
            type: 'string';
          };
          sampleBase64Content: {
            description: 'The image contained in a base64 string.';
            example: 'SomeBase64EncodedImage';
            type: 'string';
          };
          sampleId: {
            description: 'String that you can pass in to tag the prediction. Optional. Can be any value, and is returned in the response.';
            type: 'string';
          };
          sampleLocation: {
            description: 'URL of the image file.';
            type: 'string';
          };
        };
        required: ['modelId'];
        type: 'object';
      };
      ObjectDetectionResponse: {
        properties: {
          object: {
            example: 'predictresponse';
            title: 'Object returned; in this case, predictresponse.';
            type: 'string';
          };
          probabilities: {
            items: {
              $ref: '#/components/schemas/DetectionResult';
            };
            type: 'array';
          };
          sampleId: {
            description: 'Value passed in when the prediction call was made. Returned only if the sampleId request parameter is provided.';
            example: 'Sample1';
            type: 'string';
          };
        };
        type: 'object';
      };
      PlanData: {
        properties: {
          amount: {
            example: 1;
            format: 'int32';
            title: 'Number of plans of the specified type.';
            type: 'integer';
          };
          plan: {
            enum: ['STARTER', 'SFDC_1M_EDITION', 'BRONZE', 'SILVER', 'GOLD', 'DATASET_DOWNLOAD'];
            title: 'Type of plan based on the source.';
            type: 'string';
          };
          source: {
            enum: ['SALESFORCE', 'HEROKU', 'SF_AUTO_PROVISION', 'SF_AUTO_PROVISION_BOUND'];
            title: 'Service that provisioned the plan.';
            type: 'string';
          };
        };
        title: 'Plan Data';
        type: 'object';
      };
      PredictionErrorResponse: {
        properties: {
          message: {
            type: 'string';
          };
          object: {
            type: 'string';
          };
        };
        type: 'object';
      };
      SentimentPredictRequest: {
        properties: {
          document: {
            description: 'Text for which you want to return a sentiment prediction.';
            example: "I can't tell you how much fun it was";
            type: 'string';
          };
          modelId: {
            description: 'ID of the model that makes the prediction. The model must have been created from a dataset with a type of text-sentiment.';
            example: 'WJH4YCA7YX4PCWVNCYNWYHBMY4';
            type: 'string';
          };
          numResults: {
            description: 'Number of probabilities to return. ';
            example: 3;
            format: 'int32';
            minimum: 1;
            type: 'integer';
          };
          sampleId: {
            description: 'String that you can pass in to tag the prediction. Optional. Can be any value, and is returned in the response.';
            type: 'string';
          };
        };
        required: ['document', 'modelId'];
        type: 'object';
      };
      SentimentPredictResponse: {
        properties: {
          object: {
            example: 'predictresponse';
            title: 'Object returned; in this case, predictresponse.';
            type: 'string';
          };
          probabilities: {
            items: {
              $ref: '#/components/schemas/LabelResult';
            };
            type: 'array';
          };
          sampleId: {
            description: 'Value passed in when the prediction call was made. Returned only if the sampleId request parameter is provided.';
            example: 'Sample1';
            type: 'string';
          };
        };
        type: 'object';
      };
      TrainResponse: {
        properties: {
          algorithm: {
            description: 'Algorithm used to create the model. Returned only when the modelType is image-detection.';
            example: 'object-detection';
            type: 'string';
          };
          createdAt: {
            description: 'Date and time that the model was created.';
            format: 'date-time';
            type: 'string';
          };
          datasetId: {
            description: 'ID of the dataset trained to create the model.';
            example: 57;
            format: 'int64';
            type: 'integer';
          };
          datasetVersionId: {
            description: 'Not available yet';
            example: 0;
            format: 'int64';
            type: 'integer';
          };
          epochs: {
            description: 'Number of epochs used during training.';
            example: 20;
            format: 'int32';
            type: 'integer';
          };
          failureMsg: {
            description: 'Reason the dataset training failed. Returned only if the training status is FAILED.';
            example: 'To train a dataset and create a model, the dataset must contain at least 100 examples per label for test set';
            type: 'string';
          };
          language: {
            description: 'Model language inherited from the dataset language. For image datasets, default is N/A. For text datasets, default is en_US.';
            example: 'en_US';
            type: 'string';
          };
          learningRate: {
            description: 'Learning rate used during training.';
            example: 0.0001;
            format: 'double';
            type: 'number';
          };
          modelId: {
            description: 'ID of the model. Contains letters and numbers.';
            example: '2KXJEOM3N562JBT4P7OX7VID2Q';
            type: 'string';
          };
          modelType: {
            description: 'Type of data from which the model was created.';
            type: 'string';
          };
          name: {
            description: 'Name of the model.';
            example: 'My Model - Version1';
            type: 'string';
          };
          object: {
            description: 'Object returned; in this case, training.';
            example: 'training';
            type: 'string';
          };
          progress: {
            description: 'How far the dataset training has progressed. Values are between 0�1.';
            example: 0.7;
            type: 'number';
          };
          queuePosition: {
            description: 'Where the training job is in the queue. This field appears in the response only if the status is QUEUED.';
            example: 1;
            format: 'int32';
            type: 'integer';
          };
          status: {
            description: 'Status of the model.';
            enum: ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'KILLED', 'FAILED_WITH_RETRIES'];
            type: 'string';
          };
          trainParams: {
            description: 'Training parameters passed into the request.';
            example: '{"trainSplitRatio":0.7}';
            type: 'string';
          };
          trainStats: {
            description: 'Returns null when you train a dataset. Training statistics are returned when the status is SUCCEEDED or FAILED.';
            type: 'string';
          };
          updatedAt: {
            description: 'Date and time that the model was last updated.';
            format: 'date-time';
            type: 'string';
          };
        };
        required: ['datasetId', 'datasetVersionId', 'language', 'modelId', 'name', 'progress', 'status'];
        type: 'object';
      };
      V2LanguageTrainParams: {
        description: 'JSON that contains parameters that specify how the model is created';
        properties: {
          trainSplitRatio: {
            description: 'Lets you specify the ratio of data used to train the dataset and the data used to test the model.';
            example: 0.9;
            format: 'float';
            type: 'number';
          };
          withFeedback: {
            description: 'Lets you specify that feedback examples are included in the data to be trained to create the model.';
            type: 'boolean';
          };
          withGlobalDatasetId: {
            description: 'Lets you specify that a global dataset is used in addition to the specified dataset to create the model.';
            format: 'int64';
            type: 'integer';
          };
        };
        type: 'object';
      };
      V2VisionTrainParams: {
        description: 'JSON that contains parameters that specify how the model is created';
        properties: {
          trainSplitRatio: {
            description: 'Lets you specify the ratio of data used to train the dataset and the data used to test the model.';
            example: 0.9;
            format: 'float';
            type: 'number';
          };
          withFeedback: {
            description: 'Lets you specify that feedback examples are included in the data to be trained to create the model.';
            type: 'boolean';
          };
          withGlobalDatasetId: {
            description: 'Lets you specify that a global dataset is used in addition to the specified dataset to create the model.';
            format: 'int64';
            type: 'integer';
          };
        };
        type: 'object';
      };
    };
    securitySchemes: {
      bearer_token: {
        scheme: 'bearer';
        type: 'http';
      };
    };
  };
};
