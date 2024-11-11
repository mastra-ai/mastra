// @ts-nocheck
export type TPaths = {
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
export const paths = {
  '/v2/apiusage': {
    get: {
      description:
        'Returns prediction usage on a monthly basis for the current calendar month and future months. Each apiusage object in the response corresponds to a calendar month in your plan.',
      operationId: 'getApiUsagePlansV2',
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiUsageList',
              },
            },
          },
          description: 'api usage',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get API Isage',
      tags: ['Check API Usage'],
    },
  },
  '/v2/language/datasets': {
    get: {
      description:
        'Returns a list of datasets and their labels that were created by the current user. The response is sorted by dataset ID.',
      operationId: 'listDatasets',
      parameters: [
        {
          description: 'Index of the dataset from which you want to start paging',
          in: 'query',
          name: 'offset',
          schema: {
            default: '0',
            type: 'string',
          },
        },
        {
          description:
            'Number of datsets to return. Maximum valid value is 25. If you specify a number greater than 25, the call returns 25 datasets.',
          in: 'query',
          name: 'count',
          schema: {
            default: '25',
            type: 'string',
          },
        },
        {
          description:
            'If true, returns all global datasets. Global datasets are public datasets that Salesforce provides.',
          in: 'query',
          name: 'global',
          schema: {
            default: false,
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DatasetList',
              },
            },
          },
          description: 'Success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get All Datasets',
      tags: ['Language Datasets'],
    },
  },
  '/v2/language/datasets/upload': {
    post: {
      description:
        'Creates a dataset, labels, and examples from the specified .csv, .tsv, or .json file. The call returns immediately and continues to upload data in the background.',
      operationId: 'uploadDatasetAsync',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              properties: {
                data: {
                  description: 'Path to the .csv, .tsv, or .json file on the local drive (FilePart).',
                  type: 'string',
                },
                name: {
                  description:
                    'Name of the dataset. Optional. If this parameter is omitted, the dataset name is derived from the file name.',
                  example: 'weather',
                  type: 'string',
                },
                path: {
                  description: 'URL of the .csv, .tsv, or .json file.',
                  type: 'string',
                },
                type: {
                  description: 'Type of dataset data.',
                  enum: ['text-intent', 'text-sentiment'],
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Dataset',
              },
            },
          },
          description: 'Upload initiated',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Create a Dataset From a File Asynchronously',
      tags: ['Language Datasets'],
    },
  },
  '/v2/language/datasets/upload/sync': {
    post: {
      description:
        'Creates a dataset, labels, and examples from the specified .csv, .tsv, or .json file. The call returns after the dataset is created and all of the data is uploaded.',
      operationId: 'uploadDatasetSync',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              properties: {
                data: {
                  description: 'Path to the .csv, .tsv, or .json file on the local drive (FilePart).',
                  type: 'string',
                },
                name: {
                  description:
                    'Name of the dataset. Optional. If this parameter is omitted, the dataset name is derived from the file name.',
                  example: 'weather',
                  type: 'string',
                },
                path: {
                  description: 'URL of the .csv, .tsv, or .json file.',
                  type: 'string',
                },
                type: {
                  description: 'Type of dataset data.',
                  enum: ['text-intent', 'text-sentiment'],
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Dataset',
              },
            },
          },
          description: 'Upload success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Create a Dataset From a File Synchronously',
      tags: ['Language Datasets'],
    },
  },
  '/v2/language/datasets/{datasetId}': {
    delete: {
      description: 'Deletes the specified dataset and associated labels and examples.',
      operationId: 'deleteDataset',
      parameters: [
        {
          description: 'Dataset Id',
          example: 'SomeDatasetId',
          in: 'path',
          name: 'datasetId',
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
                $ref: '#/components/schemas/DeletionResponse',
              },
            },
          },
          description: 'Success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Delete a Dataset',
      tags: ['Language Datasets'],
    },
    get: {
      description: 'Returns a single dataset.',
      operationId: 'getDataset',
      parameters: [
        {
          description: 'Dataset Id',
          example: 'SomeDatasetId',
          in: 'path',
          name: 'datasetId',
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
                $ref: '#/components/schemas/Dataset',
              },
            },
          },
          description: 'Success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get a Dataset',
      tags: ['Language Datasets'],
    },
  },
  '/v2/language/datasets/{datasetId}/examples': {
    get: {
      description: 'Returns all the examples for the specified dataset,',
      operationId: 'getExamples',
      parameters: [
        {
          description: 'Dataset Id',
          example: 'SomeDatasetId',
          in: 'path',
          name: 'datasetId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Index of the example from which you want to start paging.',
          in: 'query',
          name: 'offset',
          schema: {
            default: '0',
            type: 'string',
          },
        },
        {
          description: 'Number of examples to return.',
          in: 'query',
          name: 'count',
          schema: {
            default: '100',
            type: 'string',
          },
        },
        {
          description: 'return examples that were created in the dataset as feedback',
          in: 'query',
          name: 'source',
          schema: {
            enum: ['all', 'feedback', 'upload'],
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ExampleList',
              },
            },
          },
          description: 'Success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get All Examples',
      tags: ['Language Examples'],
    },
  },
  '/v2/language/datasets/{datasetId}/models': {
    get: {
      description: 'Returns all models for the specified dataset.',
      operationId: 'getTrainedModels',
      parameters: [
        {
          description: 'Index of the model from which you want to start paging.',
          in: 'query',
          name: 'offset',
          schema: {
            default: '0',
            type: 'string',
          },
        },
        {
          description: 'Number of models to return.',
          in: 'query',
          name: 'count',
          schema: {
            default: '100',
            type: 'string',
          },
        },
        {
          description: 'Dataset Id',
          example: 'SomeDatasetId',
          in: 'path',
          name: 'datasetId',
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
                $ref: '#/components/schemas/ModelList',
              },
            },
          },
          description: 'Success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get All Models',
      tags: ['Language Models'],
    },
  },
  '/v2/language/datasets/{datasetId}/upload': {
    put: {
      description: 'Adds examples from a .csv, .tsv, or .json file to a dataset.',
      operationId: 'updateDatasetAsync',
      parameters: [
        {
          description: 'Dataset Id',
          example: 'SomeDatasetId',
          in: 'path',
          name: 'datasetId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              properties: {
                data: {
                  description: 'Path to the .csv, .tsv, or .json file on a local drive. ',
                  type: 'string',
                },
                type: {
                  description: 'URL of the .csv, .tsv, or .json file.',
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Dataset',
              },
            },
          },
          description: 'Upload success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Create Examples From a File',
      tags: ['Language Examples'],
    },
  },
  '/v2/language/deletion/{id}': {
    get: {
      description:
        'Returns the status of a language dataset or model deletion. When you delete a dataset or model, the deletion may not occur immediately. Use this call to find out when the deletion is complete.',
      operationId: 'get',
      parameters: [
        {
          description: 'Deletion Id',
          example: 'Z2JTFBF3A7XKIJC5QEJXMO4HSY',
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeletionResponse',
              },
            },
          },
          description: 'deletion status',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get Deletion Status',
      tags: ['Language Datasets'],
    },
  },
  '/v2/language/examples': {
    get: {
      description:
        'Returns all the examples for the specified label. Returns both uploaded examples and feedback examples.',
      operationId: 'getExamplesByLabel',
      parameters: [
        {
          description: 'Label Id',
          example: 'SomeLabelId',
          in: 'query',
          name: 'labelId',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Index of the example from which you want to start paging.',
          in: 'query',
          name: 'offset',
          schema: {
            default: '0',
            type: 'string',
          },
        },
        {
          description: 'Number of examples to return.',
          in: 'query',
          name: 'count',
          schema: {
            default: '100',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ExampleList',
              },
            },
          },
          description: 'Success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get All Examples for Label',
      tags: ['Language Examples'],
    },
  },
  '/v2/language/feedback': {
    post: {
      description: 'Adds a feedback example to the dataset associated with the specified model.',
      operationId: 'provideFeedback',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              properties: {
                document: {
                  description: 'Intent or sentiment string to add to the dataset.',
                  type: 'string',
                },
                expectedLabel: {
                  description: 'Correct label for the example. Must be a label that exists in the dataset.',
                  type: 'string',
                },
                modelId: {
                  description:
                    'ID of the model that misclassified the image. The feedback example is added to the dataset associated with this model.',
                  type: 'string',
                },
                name: {
                  description: 'Name of the example. Optional. Maximum length is 180 characters.',
                  example: 'feedback-2',
                  maxLength: 180,
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Example',
              },
            },
          },
          description: 'Upload success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Create a Feedback Example',
      tags: ['Language Examples'],
    },
  },
  '/v2/language/intent': {
    post: {
      description: 'Returns an intent prediction for the given string.',
      operationId: 'intentMultipart',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/IntentPredictRequest',
            },
          },
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/IntentPredictRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/IntentPredictResponse',
              },
            },
          },
          description: 'Prediction Result',
        },
        '429': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PredictionErrorResponse',
              },
            },
          },
          description: 'Exceed usage limitation',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Prediction for Intent',
      tags: ['Language Prediction'],
    },
  },
  '/v2/language/models/{modelId}': {
    delete: {
      description: 'Deletes the specified model.',
      operationId: 'deleteModel',
      parameters: [
        {
          description: 'Model Id',
          example: 'SomeModelId',
          in: 'path',
          name: 'modelId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '201': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeletionResponse',
              },
            },
          },
          description: 'Deletion submitted',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Delete a Model',
      tags: ['Language Models'],
    },
    get: {
      description: 'Returns the metrics for a model',
      operationId: 'getTrainedModelMetrics',
      parameters: [
        {
          description: 'Model Id',
          example: 'SomeModelId',
          in: 'path',
          name: 'modelId',
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
                $ref: '#/components/schemas/Metrics',
              },
            },
          },
          description: 'Model Metrics',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get Model Metrics',
      tags: ['Language Models'],
    },
  },
  '/v2/language/models/{modelId}/lc': {
    get: {
      description: 'Returns the metrics for each epoch in a model.',
      operationId: 'getTrainedModelLearningCurve',
      parameters: [
        {
          description: 'Model Id',
          example: 'SomeModelId',
          in: 'path',
          name: 'modelId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Index of the epoch from which you want to start paging',
          in: 'query',
          name: 'offset',
          schema: {
            default: '0',
            type: 'string',
          },
        },
        {
          description: 'Number of epoch to return. Maximum valid value is 25.',
          in: 'query',
          name: 'count',
          schema: {
            default: '25',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LearningCurveList',
              },
            },
          },
          description: 'Learning Curve',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get Model Learning Curve',
      tags: ['Language Models'],
    },
  },
  '/v2/language/retrain': {
    post: {
      description:
        'Retrains a dataset and updates a model. Use this API call when you want to update a model and keep the model ID instead of creating a new model.',
      operationId: 'retrain',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              properties: {
                algorithm: {
                  description: 'Algorithm used for train',
                  example: 'intent',
                  type: 'string',
                },
                epochs: {
                  description: 'Number of training iterations for the neural network. Optional.',
                  example: 20,
                  format: 'int32',
                  maximum: 1000,
                  minimum: 1,
                  type: 'integer',
                },
                learningRate: {
                  description: 'N/A for intent or sentiment models.',
                  example: 0.0001,
                  format: 'float',
                  type: 'number',
                },
                modelId: {
                  description: 'ID of the model to be updated from the training.',
                  example: '7JXCXTRXTMNLJCEF2DR5CJ46QU',
                  type: 'string',
                },
                trainParams: {
                  $ref: '#/components/schemas/V2LanguageTrainParams',
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TrainResponse',
              },
            },
          },
          description: 'Training Status',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Retrain a Dataset',
      tags: ['Language Training'],
    },
  },
  '/v2/language/sentiment': {
    post: {
      description: 'Returns a sentiment prediction for the given string.',
      operationId: 'sentimentMultipart',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/SentimentPredictRequest',
            },
          },
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/SentimentPredictRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SentimentPredictResponse',
              },
            },
          },
          description: 'Prediction Result',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Prediction for Sentiment',
      tags: ['Language Prediction'],
    },
  },
  '/v2/language/train': {
    post: {
      description: 'Trains a dataset and creates a model.',
      operationId: 'train',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              properties: {
                algorithm: {
                  description: 'Algorithm used for train',
                  example: 'intent',
                  type: 'string',
                },
                datasetId: {
                  description: 'ID of the dataset to train.',
                  example: 57,
                  format: 'int64',
                  type: 'integer',
                },
                epochs: {
                  description: 'Number of training iterations for the neural network. Optional.',
                  example: 20,
                  format: 'int32',
                  maximum: 1000,
                  minimum: 1,
                  type: 'integer',
                },
                learningRate: {
                  description: 'N/A for intent or sentiment models.',
                  format: 'double',
                  type: 'number',
                },
                name: {
                  description: 'Name of the model. Maximum length is 180 characters.',
                  maxLength: 180,
                  type: 'string',
                },
                trainParams: {
                  $ref: '#/components/schemas/V2LanguageTrainParams',
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TrainResponse',
              },
            },
          },
          description: 'Training Status',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Train a Dataset',
      tags: ['Language Training'],
    },
  },
  '/v2/language/train/{modelId}': {
    get: {
      description:
        "Returns the status of a model's training process. Use the progress field to determine how far the training has progressed. When training completes successfully, the status is SUCCEEDED and the progress is 1.",
      operationId: 'getTrainStatusAndProgress',
      parameters: [
        {
          description: 'Model Id',
          example: 'SomeModelId',
          in: 'path',
          name: 'modelId',
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
                $ref: '#/components/schemas/TrainResponse',
              },
            },
          },
          description: 'Training Status',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get Training Status',
      tags: ['Language Training'],
    },
  },
  '/v2/oauth2/token': {
    post: {
      description:
        'Returns an OAuth access token or a refresh token. You must pass a valid access token in the header of each API call.',
      externalDocs: {
        description: 'authentication guid',
        url: 'https://metamind.readme.io/docs/generate-an-oauth-access-token',
      },
      operationId: 'generateTokenV2',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              properties: {
                assertion: {
                  description: 'encrypted payload to identify yourself',
                  example: 'SOME_ASSERTION_STRING',
                  type: 'string',
                },
                grant_type: {
                  description: 'specify the authentication method desired',
                  enum: ['urn:ietf:params:oauth:grant-type:jwt-bearer', 'refresh_token'],
                  example: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                  type: 'string',
                },
                refresh_token: {
                  description: 'The refresh token you created previously.',
                  example: 'SomeRefreshToken',
                  type: 'string',
                },
                scope: {
                  description: 'set to `offline` to generate a refresh token',
                  example: 'offline',
                  type: 'string',
                },
                valid_for: {
                  default: 60,
                  description:
                    'Number of seconds until the access token expires. Default is 60 seconds. Maximum value is 30 days',
                  example: 120,
                  format: 'int32',
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GenerateAccessTokenResponse',
              },
            },
          },
          description: 'access token result',
        },
      },
      summary: 'Generate an OAuth Token',
      tags: ['Authorization'],
    },
  },
  '/v2/oauth2/tokens/{token}': {
    delete: {
      operationId: 'revokeRefreshTokenV2',
      parameters: [
        {
          description: 'the token to revoke',
          example: 'SOME_REFRESH_TOKEN',
          in: 'path',
          name: 'token',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '204': {
          description: 'deleted, with no content returned',
        },
        '400': {
          description: 'token cannot be removed',
        },
        '404': {
          description: 'token not found',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Delete a Refresh Token',
      tags: ['Authorization'],
    },
  },
  '/v2/vision/bulkfeedback': {
    put: {
      description: 'Adds feedback examples to the dataset associated with the specified object detection model.',
      operationId: 'updateDatasetAsync_1',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              properties: {
                data: {
                  description:
                    'Local .zip file to upload. The maximum .zip file size you can upload from a local drive is 50 MB.',
                  type: 'string',
                },
                modelId: {
                  description:
                    'ID of the model that misclassified the images. The feedback examples are added to the dataset associated with this model.',
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Dataset',
              },
            },
          },
          description: 'Update success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Create Feedback Examples From a Zip File',
      tags: ['Vision Examples'],
    },
  },
  '/v2/vision/datasets': {
    get: {
      description:
        'Returns a list of datasets and their labels that were created by the current user. The response is sorted by dataset ID.',
      operationId: 'listDatasets_1',
      parameters: [
        {
          description: 'Index of the dataset from which you want to start paging',
          in: 'query',
          name: 'offset',
          schema: {
            default: '0',
            type: 'string',
          },
        },
        {
          description:
            'Number of datsets to return. Maximum valid value is 25. If you specify a number greater than 25, the call returns 25 datasets.',
          in: 'query',
          name: 'count',
          schema: {
            default: '25',
            type: 'string',
          },
        },
        {
          description:
            'If true, returns all global datasets. Global datasets are public datasets that Salesforce provides.',
          in: 'query',
          name: 'global',
          schema: {
            default: false,
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DatasetList',
              },
            },
          },
          description: 'Success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get All Datasets',
      tags: ['Vision Datasets'],
    },
    post: {
      description: "Creates a dataset and labels, if they're specified.",
      operationId: 'createDataset',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              properties: {
                labels: {
                  description:
                    'Optional comma-separated list of labels. If specified, creates the labels in the dataset. Maximum number of labels per dataset is 250.',
                  example: 'beach,mountain',
                  type: 'string',
                },
                name: {
                  description: 'Name of the dataset. Maximum length is 180 characters.',
                  example: 'Beach and Mountain',
                  maxLength: 180,
                  type: 'string',
                },
                type: {
                  description: 'Type of dataset data',
                  enum: ['image', 'image-multi-label'],
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Dataset',
              },
            },
          },
          description: 'Creation success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Create a Dataset',
      tags: ['Vision Datasets'],
    },
  },
  '/v2/vision/datasets/upload': {
    post: {
      description:
        'Creates a dataset, labels, and examples from the specified .zip file. The call returns immediately and continues to upload the images in the background.',
      operationId: 'uploadDatasetAsync_1',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              properties: {
                data: {
                  description: 'Path to the .zip file on the local drive (FilePart).',
                  type: 'string',
                },
                name: {
                  description:
                    'Name of the dataset. Optional. If this parameter is omitted, the dataset name is derived from the .zip file name.',
                  example: 'mountainvsbeach',
                  type: 'string',
                },
                path: {
                  description: 'URL of the .zip file.',
                  type: 'string',
                },
                type: {
                  description: 'Type of dataset data.',
                  enum: ['image', 'image-detection', 'image-multi-label'],
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Dataset',
              },
            },
          },
          description: 'Upload initiated',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Create a Dataset From a Zip File Asynchronously',
      tags: ['Vision Datasets'],
    },
  },
  '/v2/vision/datasets/upload/sync': {
    post: {
      description:
        'Creates a dataset, labels, and examples from the specified .zip file. The call returns after the dataset is created and all of the images are uploaded.',
      operationId: 'uploadDatasetSync_1',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              properties: {
                data: {
                  description: 'Path to the .zip file on the local drive (FilePart).',
                  type: 'string',
                },
                name: {
                  description:
                    'Name of the dataset. Optional. If this parameter is omitted, the dataset name is derived from the .zip file name.',
                  example: 'mountainvsbeach',
                  type: 'string',
                },
                path: {
                  description: 'URL of the .zip file.',
                  type: 'string',
                },
                type: {
                  description: 'Type of dataset data.',
                  enum: ['image', 'image-detection', 'image-multi-label'],
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Dataset',
              },
            },
          },
          description: 'Upload success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Create a Dataset From a Zip File Synchronously',
      tags: ['Vision Datasets'],
    },
  },
  '/v2/vision/datasets/{datasetId}': {
    delete: {
      description: 'Deletes the specified dataset and associated labels and examples.',
      operationId: 'deleteDataset_1',
      parameters: [
        {
          description: 'Dataset Id',
          example: 'SomeDatasetId',
          in: 'path',
          name: 'datasetId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '201': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeletionResponse',
              },
            },
          },
          description: 'Success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Delete a Dataset',
      tags: ['Vision Datasets'],
    },
    get: {
      description: 'Returns a single dataset.',
      operationId: 'getDataset_1',
      parameters: [
        {
          description: 'Dataset Id',
          example: 'SomeDatasetId',
          in: 'path',
          name: 'datasetId',
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
                $ref: '#/components/schemas/Dataset',
              },
            },
          },
          description: 'Success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get a Dataset',
      tags: ['Vision Datasets'],
    },
  },
  '/v2/vision/datasets/{datasetId}/examples': {
    get: {
      description:
        'Returns all the examples for the specified dataset. By default, returns examples created by uploading them from a .zip file.',
      operationId: 'getExamples_1',
      parameters: [
        {
          description: 'Dataset Id',
          example: 'SomeDatasetId',
          in: 'path',
          name: 'datasetId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Index of the example from which you want to start paging.',
          in: 'query',
          name: 'offset',
          schema: {
            default: '0',
            type: 'string',
          },
        },
        {
          description: 'Number of examples to return.',
          in: 'query',
          name: 'count',
          schema: {
            default: '100',
            type: 'string',
          },
        },
        {
          description: 'return examples that were created in the dataset as feedback',
          in: 'query',
          name: 'source',
          schema: {
            enum: ['all', 'feedback', 'upload'],
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ExampleList',
              },
            },
          },
          description: 'Success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get All Examples',
      tags: ['Vision Examples'],
    },
    post: {
      description: 'Adds an example with the specified label to a dataset.',
      operationId: 'addExample',
      parameters: [
        {
          description: 'Dataset Id',
          example: 'SomeDatasetId',
          in: 'path',
          name: 'datasetId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              properties: {
                data: {
                  description: 'Location of the local image file to upload.',
                  type: 'string',
                },
                labelId: {
                  description: 'ID of the label to add to the example.',
                  example: 42,
                  format: 'int64',
                  type: 'integer',
                },
                name: {
                  description: 'Name of the example. Maximum length is 180 characters.',
                  maxLength: 180,
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Example',
              },
            },
          },
          description: 'Example created',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Create an Example',
      tags: ['Vision Examples'],
    },
  },
  '/v2/vision/datasets/{datasetId}/models': {
    get: {
      description: 'Returns all models for the specified dataset.',
      operationId: 'getTrainedModels_1',
      parameters: [
        {
          description: 'Index of the model from which you want to start paging.',
          in: 'query',
          name: 'offset',
          schema: {
            default: '0',
            type: 'string',
          },
        },
        {
          description: 'Number of models to return.',
          in: 'query',
          name: 'count',
          schema: {
            default: '100',
            type: 'string',
          },
        },
        {
          description: 'Dataset Id',
          example: 'SomeDatasetId',
          in: 'path',
          name: 'datasetId',
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
                $ref: '#/components/schemas/ModelList',
              },
            },
          },
          description: 'Success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get All Models',
      tags: ['Vision Models'],
    },
  },
  '/v2/vision/datasets/{datasetId}/upload': {
    put: {
      description:
        'Adds examples from a .zip file to a dataset. You can use this call only with a dataset that was created from a .zip file.',
      operationId: 'updateDatasetAsync_2',
      parameters: [
        {
          description: 'Dataset Id',
          example: 'SomeDatasetId',
          in: 'path',
          name: 'datasetId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              properties: {
                data: {
                  description: 'Location of the local image file to upload.',
                  type: 'string',
                },
                path: {
                  description: 'URL of the .zip file.',
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Dataset',
              },
            },
          },
          description: 'Upload success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Create Examples From a Zip File',
      tags: ['Vision Examples'],
    },
  },
  '/v2/vision/deletion/{id}': {
    get: {
      description:
        'Returns the status of an image dataset or model deletion. When you delete a dataset or model, the deletion may not occur immediately. Use this call to find out when the deletion is complete.',
      operationId: 'get_1',
      parameters: [
        {
          description: 'Deletion Id',
          example: 'Z2JTFBF3A7XKIJC5QEJXMO4HSY',
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeletionResponse',
              },
            },
          },
          description: 'deletion status',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get Deletion Status',
      tags: ['Vision Datasets'],
    },
  },
  '/v2/vision/detect': {
    post: {
      description:
        'Returns labels, probabilities, and bounding box coordinates for items detected in the specified local image file.',
      operationId: 'detectMultipart',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ObjectDetectionRequest',
            },
          },
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/ObjectDetectionRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ObjectDetectionResponse',
              },
            },
          },
          description: 'Detection Result',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Detection with Image File',
      tags: ['Vision Prediction'],
    },
  },
  '/v2/vision/examples': {
    get: {
      description:
        'Returns all the examples for the specified label. Returns both uploaded examples and feedback examples.',
      operationId: 'getExamplesByLabel_1',
      parameters: [
        {
          description: 'Label Id',
          example: 'SomeLabelId',
          in: 'query',
          name: 'labelId',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Index of the example from which you want to start paging.',
          in: 'query',
          name: 'offset',
          schema: {
            default: '0',
            type: 'string',
          },
        },
        {
          description: 'Number of examples to return.',
          in: 'query',
          name: 'count',
          schema: {
            default: '100',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ExampleList',
              },
            },
          },
          description: 'Success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get All Examples for Label',
      tags: ['Vision Examples'],
    },
  },
  '/v2/vision/feedback': {
    post: {
      description: 'Adds a feedback example to the dataset associated with the specified model.',
      operationId: 'provideFeedback_1',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              properties: {
                data: {
                  description: 'Local image file to upload.',
                  type: 'string',
                },
                expectedLabel: {
                  description: 'Correct label for the example. Must be a label that exists in the dataset.',
                  type: 'string',
                },
                modelId: {
                  description:
                    'ID of the model that misclassified the image. The feedback example is added to the dataset associated with this model.',
                  type: 'string',
                },
                name: {
                  description: 'Name of the example. Optional. Maximum length is 180 characters.',
                  example: 'feedback-1',
                  maxLength: 180,
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Example',
              },
            },
          },
          description: 'Upload success',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Create a Feedback Example',
      tags: ['Vision Examples'],
    },
  },
  '/v2/vision/models/{modelId}': {
    delete: {
      description: 'Deletes the specified model.',
      operationId: 'deleteModel_1',
      parameters: [
        {
          in: 'path',
          name: 'modelId',
          required: true,
          schema: {
            description: 'Model Id',
            example: 'SomeModelId',
            type: 'string',
          },
        },
      ],
      responses: {
        '201': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeletionResponse',
              },
            },
          },
          description: 'Deletion submitted',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Delete a Model',
      tags: ['Vision Models'],
    },
    get: {
      description: 'Returns the metrics for a model',
      operationId: 'getTrainedModelMetrics_1',
      parameters: [
        {
          in: 'path',
          name: 'modelId',
          required: true,
          schema: {
            description: 'Model Id',
            example: 'SomeModelId',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Metrics',
              },
            },
          },
          description: 'Model Metrics',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get Model Metrics',
      tags: ['Vision Models'],
    },
  },
  '/v2/vision/models/{modelId}/lc': {
    get: {
      description: 'Returns the metrics for each epoch in a model.',
      operationId: 'getTrainedModelLearningCurve_1',
      parameters: [
        {
          in: 'path',
          name: 'modelId',
          required: true,
          schema: {
            description: 'Model Id',
            example: 'SomeModelId',
            type: 'string',
          },
        },
        {
          description: 'Index of the epoch from which you want to start paging',
          in: 'query',
          name: 'offset',
          schema: {
            default: '0',
            type: 'string',
          },
        },
        {
          description: 'Number of epoch to return. Maximum valid value is 25.',
          in: 'query',
          name: 'count',
          schema: {
            default: '25',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LearningCurveList',
              },
            },
          },
          description: 'Learning Curve',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get Model Learning Curve',
      tags: ['Vision Models'],
    },
  },
  '/v2/vision/ocr': {
    post: {
      description: 'Returns a prediction from an OCR model for the specified image URL or local image file.',
      operationId: 'ocrMultipart',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              properties: {
                modelId: {
                  description: 'ID of the model that makes the prediction. Valid values are OCRModel and tabulatev2.',
                  example: 'WJH4YCA7YX4PCWVNCYNWYHBMY4',
                  type: 'string',
                },
                sampleContent: {
                  description: 'Binary content of image file uploaded as multipart/form-data. Optional.',
                  format: 'binary',
                  type: 'string',
                },
                sampleId: {
                  description:
                    'String that you can pass in to tag the prediction. Optional. Can be any value, and is returned in the response.',
                  type: 'string',
                },
                sampleLocation: {
                  description:
                    'URL of the image file. Use this parameter when sending in a file from a web location. Optional.',
                  type: 'string',
                },
                task: {
                  default: 'text',
                  description:
                    'Optional. Designates the type of data in the image. Default is text. Valid values: contact, table, and text.',
                  example: 'table',
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/OCRPredictResponse',
              },
            },
          },
          description: 'OCR Result',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Detect Text',
      tags: ['Vision Prediction'],
    },
  },
  '/v2/vision/predict': {
    post: {
      description: 'Returns a prediction from an image or multi-label model for the specified image.',
      operationId: 'predictMultipart',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ImageClassificationRequest',
            },
          },
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/ImageClassificationRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ImageClassificationResponse',
              },
            },
          },
          description: 'Prediction Result',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Make Prediction',
      tags: ['Vision Prediction'],
    },
  },
  '/v2/vision/retrain': {
    post: {
      description:
        'Retrains a dataset and updates a model. Use this API call when you want to update a model and keep the model ID instead of creating a new model.',
      operationId: 'retrain_1',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              properties: {
                algorithm: {
                  description:
                    'Specifies the algorithm used to train the dataset. Optional. Use this parameter only when training a dataset with a type of image-detection. Valid values are object-detection-v1 and retail-execution.',
                  example: 'object-detection',
                  type: 'string',
                },
                epochs: {
                  description: 'Number of training iterations for the neural network. Optional.',
                  example: 20,
                  format: 'int32',
                  maximum: 1000,
                  minimum: 1,
                  type: 'integer',
                },
                learningRate: {
                  description:
                    'Specifies how much the gradient affects the optimization of the model at each time step. Optional.',
                  example: 0.0001,
                  format: 'float',
                  type: 'number',
                },
                modelId: {
                  description: 'ID of the model to be updated from the training.',
                  example: '7JXCXTRXTMNLJCEF2DR5CJ46QU',
                  type: 'string',
                },
                trainParams: {
                  $ref: '#/components/schemas/V2VisionTrainParams',
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TrainResponse',
              },
            },
          },
          description: 'Training Status',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Retrain a Dataset',
      tags: ['Vision Training'],
    },
  },
  '/v2/vision/train': {
    post: {
      description: 'Trains a dataset and creates a model.',
      operationId: 'train_1',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              properties: {
                algorithm: {
                  description:
                    'Specifies the algorithm used to train the dataset. Optional. Use this parameter only when training a dataset with a type of image-detection. Valid values are object-detection-v1 and retail-execution.',
                  example: 'object-detection',
                  type: 'string',
                },
                datasetId: {
                  description: 'ID of the dataset to train.',
                  example: 57,
                  format: 'int64',
                  type: 'integer',
                },
                epochs: {
                  description: 'Number of training iterations for the neural network. Optional.',
                  example: 20,
                  format: 'int32',
                  maximum: 1000,
                  minimum: 1,
                  type: 'integer',
                },
                learningRate: {
                  description:
                    'Specifies how much the gradient affects the optimization of the model at each time step. Optional.',
                  example: 0.0001,
                  format: 'double',
                  type: 'number',
                },
                name: {
                  description: 'Name of the model. Maximum length is 180 characters.',
                  maxLength: 180,
                  type: 'string',
                },
                trainParams: {
                  $ref: '#/components/schemas/V2VisionTrainParams',
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
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TrainResponse',
              },
            },
          },
          description: 'Training Status',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Train a Dataset',
      tags: ['Vision Training'],
    },
  },
  '/v2/vision/train/{modelId}': {
    get: {
      description:
        "Returns the status of a model's training process. Use the progress field to determine how far the training has progressed. When training completes successfully, the status is SUCCEEDED and the progress is 1.",
      operationId: 'getTrainStatusAndProgress_1',
      parameters: [
        {
          in: 'path',
          name: 'modelId',
          required: true,
          schema: {
            description: 'Model Id',
            example: 'SomeModelId',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TrainResponse',
              },
            },
          },
          description: 'Training Status',
        },
      },
      security: [
        {
          bearer_token: [],
        },
      ],
      summary: 'Get Training Status',
      tags: ['Vision Training'],
    },
  },
} as TPaths;
