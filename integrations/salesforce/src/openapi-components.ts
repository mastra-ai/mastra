// @ts-nocheck
export type TComponents = {
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
          enum: ['QUEUED', 'RUNNING', 'SUCCEEDED_WAITING_FOR_CACHE_REMOVAL', 'SUCCEEDED', 'KILLED', 'FAILED', 'RETRY'];
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
export const components = {
  schemas: {
    ApiUsage: {
      properties: {
        endsAt: {
          format: 'date-time',
          title:
            'Date and time that the plan calendar month ends. Always 12 am on the first day of the following month.',
          type: 'string',
        },
        id: {
          example: '489',
          title: 'Unique ID for the API usage plan month',
          type: 'string',
        },
        licenseId: {
          example: 'kJCHtYDCSf',
          title: 'Unique ID of the API plan.',
          type: 'string',
        },
        object: {
          example: 'apiusage',
          title: 'Object returned; in this case, apiusage.',
          type: 'string',
        },
        organizationId: {
          example: '108',
          title: 'Unique ID for the user making the API call',
          type: 'string',
        },
        planData: {
          items: {
            $ref: '#/components/schemas/PlanData',
          },
          title: 'Plan data details',
          type: 'array',
        },
        predictionsMax: {
          example: 1997,
          format: 'int64',
          title: 'Number of predictions left for the calendar month.',
          type: 'integer',
        },
        predictionsUsed: {
          example: 3,
          format: 'int64',
          title: 'Number of predictions used in the calendar month.',
          type: 'integer',
        },
        startsAt: {
          format: 'date-time',
          title: 'Date and time that the plan calendar month begins. Always the first of the month.',
          type: 'string',
        },
      },
      title: 'Api Usage',
      type: 'object',
    },
    ApiUsageList: {
      properties: {
        data: {
          items: {
            $ref: '#/components/schemas/ApiUsage',
          },
          type: 'array',
        },
        object: {
          example: 'list',
          title: 'Object returned; in this case, list.',
          type: 'string',
        },
      },
      title: 'Api Usage List',
      type: 'object',
    },
    Attributes: {
      description:
        'Contains additional attributes related to the task parameter. If the task parameter is table, the row and column IDs for the detected text are returned. If the task parameter is contact, the detected entity tags will be returned.',
      properties: {
        cellLocation: {
          $ref: '#/components/schemas/CellLocation',
        },
        language: {
          type: 'string',
        },
        pageNumber: {
          type: 'string',
        },
        tag: {
          type: 'string',
        },
        value: {
          $ref: '#/components/schemas/EntityObject',
        },
      },
      type: 'object',
    },
    BoundingBox: {
      properties: {
        maxX: {
          description:
            'X-coordinate of the left side of the bounding box. The origin of the coordinate system is the top-left of the image. Number of pixels from the left edge of the image.',
          format: 'int32',
          type: 'integer',
        },
        maxY: {
          description: 'Y-coordinate of the top of the bounding box. Number of pixels from the top edge of the image.',
          format: 'int32',
          type: 'integer',
        },
        minX: {
          description:
            'X-coordinate of the right side of the bounding box. Number of pixels from the left edge of the image.',
          format: 'int32',
          type: 'integer',
        },
        minY: {
          description:
            'Y-coordinate of the bottom of the bounding box. Number of pixels from the top edge of the image.',
          format: 'int32',
          type: 'integer',
        },
      },
      type: 'object',
    },
    CellLocation: {
      properties: {
        colIndex: {
          description: 'Index of the column that contains the detected text.',
          format: 'int32',
          type: 'integer',
        },
        rowIndex: {
          description: 'Index of the row that contains the detected text.',
          format: 'int32',
          type: 'integer',
        },
      },
      type: 'object',
    },
    Dataset: {
      properties: {
        available: {
          title: 'Specifies whether the dataset is ready to be trained.',
          type: 'boolean',
        },
        createdAt: {
          description: 'Date and time that the dataset was created.',
          format: 'date-time',
          type: 'string',
        },
        id: {
          example: 1000014,
          format: 'int64',
          title: 'Dataset ID.',
          type: 'integer',
        },
        labelSummary: {
          $ref: '#/components/schemas/LabelSummary',
        },
        language: {
          description: 'Dataset language.',
          example: 'N/A',
          type: 'string',
        },
        name: {
          example: 'weather report',
          title: 'Name of the dataset.',
          type: 'string',
        },
        numOfDuplicates: {
          description:
            'Number of duplicate images. This number includes duplicates in the .zip file from which the dataset was created plus the number of duplicate images from subsequent PUT calls to add images to the dataset.',
          format: 'int32',
          type: 'integer',
        },
        object: {
          description: 'Object returned; in this case, dataset.',
          example: 'dataset',
          type: 'string',
        },
        statusMsg: {
          example: 'SUCCEEDED',
          title: 'Status of the dataset creation and data upload.',
          type: 'string',
        },
        totalExamples: {
          description: 'Total number of examples in the dataset.',
          example: 20,
          format: 'int32',
          type: 'integer',
        },
        totalLabels: {
          description: 'Total number of labels in the dataset.',
          example: 2,
          format: 'int32',
          type: 'integer',
        },
        type: {
          title: 'Type of dataset data.',
          type: 'string',
        },
        updatedAt: {
          format: 'date-time',
          title: 'Date and time that the dataset was last updated.',
          type: 'string',
        },
      },
      required: ['id', 'name'],
      type: 'object',
    },
    DatasetList: {
      properties: {
        data: {
          items: {
            $ref: '#/components/schemas/Dataset',
          },
          type: 'array',
        },
        object: {
          example: 'list',
          title: 'Object returned; in this case, list.',
          type: 'string',
        },
      },
      type: 'object',
    },
    DeletionResponse: {
      properties: {
        deletedObjectId: {
          example: '1003360',
          title:
            'ID of the object deleted. Depending on the object you delete, this contains the dataset ID or the model ID.',
          type: 'string',
        },
        id: {
          example: 'Z2JTFBF3A7XKIJC5QEJXMO4HSY',
          title: 'ID of the deletion',
          type: 'string',
        },
        message: {
          title: 'Additional information about the deletion. For example, a message is returned if the deletion fails.',
          type: 'string',
        },
        object: {
          example: 'deletion',
          title: 'Object returned; in this case, deletion.',
          type: 'string',
        },
        organizationId: {
          example: '2',
          title: 'ID of the org to which the dataset or model being deleted belongs.',
          type: 'string',
        },
        progress: {
          example: 1,
          format: 'double',
          title: 'How far the deletion has progressed. Values are between 0�1.',
          type: 'number',
        },
        status: {
          enum: ['QUEUED', 'RUNNING', 'SUCCEEDED_WAITING_FOR_CACHE_REMOVAL', 'SUCCEEDED', 'KILLED', 'FAILED', 'RETRY'],
          title: 'Status of the deletion.',
          type: 'string',
        },
        type: {
          enum: ['DATASET', 'MODEL'],
          title: "Object that's being deleted",
          type: 'string',
        },
      },
      type: 'object',
    },
    DetectionResult: {
      description: 'label',
      properties: {
        boundingBox: {
          $ref: '#/components/schemas/BoundingBox',
        },
        label: {
          description: 'Probability lable for the input. ',
          type: 'string',
        },
        probability: {
          description: 'Probability value for the input. Values are between 0�1.',
          format: 'float',
          type: 'number',
        },
      },
      type: 'object',
    },
    EntityObject: {
      properties: {
        boundingBox: {
          $ref: '#/components/schemas/BoundingBox',
        },
        entity: {
          type: 'string',
        },
        text: {
          type: 'string',
        },
      },
      type: 'object',
    },
    Example: {
      properties: {
        createdAt: {
          description: 'Date and time that the example was created.',
          format: 'date-time',
          type: 'string',
        },
        id: {
          description: 'ID of the example.',
          example: 546,
          format: 'int64',
          type: 'integer',
        },
        label: {
          $ref: '#/components/schemas/Label',
        },
        location: {
          description:
            'URL of the image in the dataset. This is a temporary URL that expires in 30 minutes. This URL can be used to display images that were uploaded to a dataset in a UI.',
          example: 'https://K3A04Q79O5TBySIZSeMIj%2BC3zqi7rOmeK...',
          type: 'string',
        },
        name: {
          description: 'Name of the example.',
          example: '659803277.jpg',
          type: 'string',
        },
        object: {
          description: 'Object returned; in this case, example.',
          example: 'example',
          type: 'string',
        },
      },
      required: ['id', 'name'],
      type: 'object',
    },
    ExampleList: {
      properties: {
        data: {
          items: {
            $ref: '#/components/schemas/Example',
          },
          type: 'array',
        },
        object: {
          example: 'list',
          title: 'Object returned; in this case, list.',
          type: 'string',
        },
      },
      type: 'object',
    },
    GenerateAccessTokenResponse: {
      properties: {
        access_token: {
          example:
            'SPFPQ5IBLB6DPE6FKPWHMIWW4MCRICX4M4KQXFQMI6THZXIEZ6QGNWNOERD6S7655LJAFWTRIKC4KGYO5G3XROMEOTBSS53CFSB6GIA',
          title: 'Access token for authorization.',
          type: 'string',
        },
        expires_in: {
          example: '120',
          title: 'Number of seconds that the token will expire from the time it was generated.',
          type: 'string',
        },
        refresh_token: {
          example:
            'FL4GSVQS4W5CKSFRVZBLPIVZZJ2K4VIFPLGZ45SJGUQK4SS56IWPWACZ7V2B7OVLVKZCNK5JZSSW7CIHCNQJAO3TOUE3375108HHTLY',
          title:
            'Refresh token that can be used to generate an access token. Only returned when you pass the scope=offline parameter to the endpoint.',
          type: 'string',
        },
        token_type: {
          example: 'Bearer',
          title: 'Type of token returned. Always Bearer.',
          type: 'string',
        },
      },
      type: 'object',
    },
    ImageClassificationRequest: {
      properties: {
        modelId: {
          description: 'ID of the model that makes the prediction.',
          example: 'WJH4YCA7YX4PCWVNCYNWYHBMY4',
          type: 'string',
        },
        numResults: {
          description: 'Number of probabilities to return.',
          example: 3,
          format: 'int32',
          minimum: 1,
          type: 'integer',
        },
        sampleBase64Content: {
          description: 'The image contained in a base64 string.',
          example: 'SomeBase64EncodedImage',
          type: 'string',
        },
        sampleId: {
          description:
            'String that you can pass in to tag the prediction. Optional. Can be any value, and is returned in the response.',
          type: 'string',
        },
        sampleLocation: {
          description: 'URL of the image file.',
          type: 'string',
        },
      },
      required: ['modelId'],
      type: 'object',
    },
    ImageClassificationResponse: {
      properties: {
        object: {
          example: 'predictresponse',
          title: 'Object returned; in this case, predictresponse.',
          type: 'string',
        },
        probabilities: {
          items: {
            $ref: '#/components/schemas/LabelResult',
          },
          type: 'array',
        },
        sampleId: {
          description:
            'Value passed in when the prediction call was made. Returned only if the sampleId request parameter is provided.',
          example: 'Sample1',
          type: 'string',
        },
      },
      type: 'object',
    },
    IntentPredictRequest: {
      properties: {
        document: {
          description: 'Text for which you want to return an intent prediction.',
          example: "I can't tell you how much fun it was",
          type: 'string',
        },
        modelId: {
          description:
            'ID of the model that makes the prediction. The model must have been created from a dataset with a type of text-sentiment.',
          example: 'WJH4YCA7YX4PCWVNCYNWYHBMY4',
          type: 'string',
        },
        numResults: {
          description: 'Number of probabilities to return. ',
          example: 3,
          format: 'int32',
          minimum: 1,
          type: 'integer',
        },
        sampleId: {
          description:
            'String that you can pass in to tag the prediction. Optional. Can be any value, and is returned in the response.',
          type: 'string',
        },
      },
      required: ['document', 'modelId'],
      type: 'object',
    },
    IntentPredictResponse: {
      properties: {
        object: {
          example: 'predictresponse',
          title: 'Object returned; in this case, predictresponse.',
          type: 'string',
        },
        probabilities: {
          items: {
            $ref: '#/components/schemas/LabelResult',
          },
          type: 'array',
        },
        sampleId: {
          description:
            'Value passed in when the prediction call was made. Returned only if the sampleId request parameter is provided.',
          example: 'Sample1',
          type: 'string',
        },
      },
      type: 'object',
    },
    Label: {
      description: 'Contains information about the label with which the example is associated.',
      properties: {
        datasetId: {
          description: 'ID of the dataset that the label belongs to.',
          example: 57,
          format: 'int64',
          type: 'integer',
        },
        id: {
          description: 'ID of the label.',
          example: 621,
          format: 'int64',
          type: 'integer',
        },
        name: {
          description: 'Name of the label.',
          example: 'Mountain',
          type: 'string',
        },
        numExamples: {
          description: 'Number of examples that have the label.',
          example: 40,
          format: 'int64',
          type: 'integer',
        },
      },
      required: ['datasetId', 'name'],
      type: 'object',
    },
    LabelResult: {
      description: 'label',
      properties: {
        label: {
          description: 'Probability lable for the input. ',
          type: 'string',
        },
        probability: {
          description: 'Probability value for the input. Values are between 0�1.',
          format: 'float',
          type: 'number',
        },
      },
      type: 'object',
    },
    LabelSummary: {
      description: 'Contains the labels array that contains all the labels for the dataset.',
      properties: {
        labels: {
          items: {
            $ref: '#/components/schemas/Label',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    LearningCurve: {
      properties: {
        epoch: {
          description: 'Epoch to which the metrics correspond.',
          example: 1,
          type: 'object',
        },
        epochResults: {
          description: 'Prediction results for the set of data used to test the model during training.',
          type: 'object',
        },
        metricsData: {
          description: 'Model metrics values.',
          type: 'object',
        },
        object: {
          description: 'Object returned; in this case, learningcurve.',
          example: 'learningcurve',
          type: 'string',
        },
      },
      type: 'object',
    },
    LearningCurveList: {
      properties: {
        data: {
          items: {
            $ref: '#/components/schemas/LearningCurve',
          },
          type: 'array',
        },
        object: {
          example: 'list',
          title: 'Object returned; in this case, list.',
          type: 'string',
        },
      },
      type: 'object',
    },
    Metrics: {
      properties: {
        algorithm: {
          type: 'string',
        },
        createdAt: {
          description: 'Date and time that the model was created.',
          format: 'date-time',
          type: 'string',
        },
        id: {
          description: 'Model Id',
          type: 'string',
        },
        language: {
          type: 'string',
        },
        metricsData: {
          description: 'Model metrics values.',
          type: 'object',
        },
        object: {
          type: 'string',
        },
      },
      type: 'object',
    },
    Model: {
      properties: {
        algorithm: {
          description: 'Algorithm used to create the model. Returned only when the modelType is image-detection.',
          example: 'object-detection',
          type: 'string',
        },
        createdAt: {
          description: 'Date and time that the model was created.',
          format: 'date-time',
          type: 'string',
        },
        datasetId: {
          description: 'ID of the dataset trained to create the model.',
          example: 57,
          format: 'int64',
          type: 'integer',
        },
        datasetVersionId: {
          description: 'Not available yet',
          example: 0,
          format: 'int64',
          type: 'integer',
        },
        failureMsg: {
          description: 'Reason the dataset training failed. Returned only if the training status is FAILED.',
          example:
            'To train a dataset and create a model, the dataset must contain at least 100 examples per label for test set',
          type: 'string',
        },
        language: {
          description:
            'Model language inherited from the dataset language. For image datasets, default is N/A. For text datasets, default is en_US.',
          example: 'en_US',
          type: 'string',
        },
        modelId: {
          description: 'ID of the model. Contains letters and numbers.',
          example: '2KXJEOM3N562JBT4P7OX7VID2Q',
          type: 'string',
        },
        modelType: {
          description: 'Type of data from which the model was created.',
          type: 'string',
        },
        name: {
          description: 'Name of the model.',
          example: 'My Model - Version1',
          type: 'string',
        },
        object: {
          description: 'Object returned; in this case, model.',
          example: 'model',
          type: 'string',
        },
        progress: {
          description: 'How far the dataset training has progressed. Values are between 0�1.',
          type: 'number',
        },
        status: {
          description: 'Status of the model.',
          enum: ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'KILLED', 'FAILED_WITH_RETRIES'],
          type: 'string',
        },
        updatedAt: {
          description: 'Date and time that the model was last updated.',
          format: 'date-time',
          type: 'string',
        },
      },
      required: ['datasetId', 'datasetVersionId', 'modelId', 'name', 'progress', 'status'],
      type: 'object',
    },
    ModelList: {
      properties: {
        data: {
          items: {
            $ref: '#/components/schemas/Model',
          },
          type: 'array',
        },
        object: {
          example: 'list',
          title: 'Object returned; in this case, list.',
          type: 'string',
        },
      },
      type: 'object',
    },
    OCRPredictResponse: {
      properties: {
        object: {
          example: 'predictresponse',
          title: 'Object returned; in this case, predictresponse.',
          type: 'string',
        },
        probabilities: {
          items: {
            $ref: '#/components/schemas/OCRResult',
          },
          type: 'array',
        },
        sampleId: {
          description: 'Same value as request parameter. Returned only if the sampleId request parameter is provided.',
          example: 'Sample1',
          type: 'string',
        },
        task: {
          description: "Same value as request parameter. Returns text if the request parameter isn't supplied.",
          example: 'Task1',
          type: 'string',
        },
      },
      type: 'object',
    },
    OCRResult: {
      description: 'Array of probabilities for the prediction.',
      properties: {
        attributes: {
          $ref: '#/components/schemas/Attributes',
        },
        boundingBox: {
          $ref: '#/components/schemas/BoundingBox',
        },
        label: {
          description: 'Content of the detected text.',
          type: 'string',
        },
        probability: {
          description: 'Probability value for the input. Values are between 0�1.',
          format: 'float',
          type: 'number',
        },
      },
      type: 'object',
    },
    ObjectDetectionRequest: {
      properties: {
        modelId: {
          description: 'ID of the model that makes the detection.',
          example: 'YCQ4ZACEPJFGXZNRA6ERF3GL5E',
          type: 'string',
        },
        sampleBase64Content: {
          description: 'The image contained in a base64 string.',
          example: 'SomeBase64EncodedImage',
          type: 'string',
        },
        sampleId: {
          description:
            'String that you can pass in to tag the prediction. Optional. Can be any value, and is returned in the response.',
          type: 'string',
        },
        sampleLocation: {
          description: 'URL of the image file.',
          type: 'string',
        },
      },
      required: ['modelId'],
      type: 'object',
    },
    ObjectDetectionResponse: {
      properties: {
        object: {
          example: 'predictresponse',
          title: 'Object returned; in this case, predictresponse.',
          type: 'string',
        },
        probabilities: {
          items: {
            $ref: '#/components/schemas/DetectionResult',
          },
          type: 'array',
        },
        sampleId: {
          description:
            'Value passed in when the prediction call was made. Returned only if the sampleId request parameter is provided.',
          example: 'Sample1',
          type: 'string',
        },
      },
      type: 'object',
    },
    PlanData: {
      properties: {
        amount: {
          example: 1,
          format: 'int32',
          title: 'Number of plans of the specified type.',
          type: 'integer',
        },
        plan: {
          enum: ['STARTER', 'SFDC_1M_EDITION', 'BRONZE', 'SILVER', 'GOLD', 'DATASET_DOWNLOAD'],
          title: 'Type of plan based on the source.',
          type: 'string',
        },
        source: {
          enum: ['SALESFORCE', 'HEROKU', 'SF_AUTO_PROVISION', 'SF_AUTO_PROVISION_BOUND'],
          title: 'Service that provisioned the plan.',
          type: 'string',
        },
      },
      title: 'Plan Data',
      type: 'object',
    },
    PredictionErrorResponse: {
      properties: {
        message: {
          type: 'string',
        },
        object: {
          type: 'string',
        },
      },
      type: 'object',
    },
    SentimentPredictRequest: {
      properties: {
        document: {
          description: 'Text for which you want to return a sentiment prediction.',
          example: "I can't tell you how much fun it was",
          type: 'string',
        },
        modelId: {
          description:
            'ID of the model that makes the prediction. The model must have been created from a dataset with a type of text-sentiment.',
          example: 'WJH4YCA7YX4PCWVNCYNWYHBMY4',
          type: 'string',
        },
        numResults: {
          description: 'Number of probabilities to return. ',
          example: 3,
          format: 'int32',
          minimum: 1,
          type: 'integer',
        },
        sampleId: {
          description:
            'String that you can pass in to tag the prediction. Optional. Can be any value, and is returned in the response.',
          type: 'string',
        },
      },
      required: ['document', 'modelId'],
      type: 'object',
    },
    SentimentPredictResponse: {
      properties: {
        object: {
          example: 'predictresponse',
          title: 'Object returned; in this case, predictresponse.',
          type: 'string',
        },
        probabilities: {
          items: {
            $ref: '#/components/schemas/LabelResult',
          },
          type: 'array',
        },
        sampleId: {
          description:
            'Value passed in when the prediction call was made. Returned only if the sampleId request parameter is provided.',
          example: 'Sample1',
          type: 'string',
        },
      },
      type: 'object',
    },
    TrainResponse: {
      properties: {
        algorithm: {
          description: 'Algorithm used to create the model. Returned only when the modelType is image-detection.',
          example: 'object-detection',
          type: 'string',
        },
        createdAt: {
          description: 'Date and time that the model was created.',
          format: 'date-time',
          type: 'string',
        },
        datasetId: {
          description: 'ID of the dataset trained to create the model.',
          example: 57,
          format: 'int64',
          type: 'integer',
        },
        datasetVersionId: {
          description: 'Not available yet',
          example: 0,
          format: 'int64',
          type: 'integer',
        },
        epochs: {
          description: 'Number of epochs used during training.',
          example: 20,
          format: 'int32',
          type: 'integer',
        },
        failureMsg: {
          description: 'Reason the dataset training failed. Returned only if the training status is FAILED.',
          example:
            'To train a dataset and create a model, the dataset must contain at least 100 examples per label for test set',
          type: 'string',
        },
        language: {
          description:
            'Model language inherited from the dataset language. For image datasets, default is N/A. For text datasets, default is en_US.',
          example: 'en_US',
          type: 'string',
        },
        learningRate: {
          description: 'Learning rate used during training.',
          example: 0.0001,
          format: 'double',
          type: 'number',
        },
        modelId: {
          description: 'ID of the model. Contains letters and numbers.',
          example: '2KXJEOM3N562JBT4P7OX7VID2Q',
          type: 'string',
        },
        modelType: {
          description: 'Type of data from which the model was created.',
          type: 'string',
        },
        name: {
          description: 'Name of the model.',
          example: 'My Model - Version1',
          type: 'string',
        },
        object: {
          description: 'Object returned; in this case, training.',
          example: 'training',
          type: 'string',
        },
        progress: {
          description: 'How far the dataset training has progressed. Values are between 0�1.',
          example: 0.7,
          type: 'number',
        },
        queuePosition: {
          description:
            'Where the training job is in the queue. This field appears in the response only if the status is QUEUED.',
          example: 1,
          format: 'int32',
          type: 'integer',
        },
        status: {
          description: 'Status of the model.',
          enum: ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'KILLED', 'FAILED_WITH_RETRIES'],
          type: 'string',
        },
        trainParams: {
          description: 'Training parameters passed into the request.',
          example: '{"trainSplitRatio":0.7}',
          type: 'string',
        },
        trainStats: {
          description:
            'Returns null when you train a dataset. Training statistics are returned when the status is SUCCEEDED or FAILED.',
          type: 'string',
        },
        updatedAt: {
          description: 'Date and time that the model was last updated.',
          format: 'date-time',
          type: 'string',
        },
      },
      required: ['datasetId', 'datasetVersionId', 'language', 'modelId', 'name', 'progress', 'status'],
      type: 'object',
    },
    V2LanguageTrainParams: {
      description: 'JSON that contains parameters that specify how the model is created',
      properties: {
        trainSplitRatio: {
          description:
            'Lets you specify the ratio of data used to train the dataset and the data used to test the model.',
          example: 0.9,
          format: 'float',
          type: 'number',
        },
        withFeedback: {
          description:
            'Lets you specify that feedback examples are included in the data to be trained to create the model.',
          type: 'boolean',
        },
        withGlobalDatasetId: {
          description:
            'Lets you specify that a global dataset is used in addition to the specified dataset to create the model.',
          format: 'int64',
          type: 'integer',
        },
      },
      type: 'object',
    },
    V2VisionTrainParams: {
      description: 'JSON that contains parameters that specify how the model is created',
      properties: {
        trainSplitRatio: {
          description:
            'Lets you specify the ratio of data used to train the dataset and the data used to test the model.',
          example: 0.9,
          format: 'float',
          type: 'number',
        },
        withFeedback: {
          description:
            'Lets you specify that feedback examples are included in the data to be trained to create the model.',
          type: 'boolean',
        },
        withGlobalDatasetId: {
          description:
            'Lets you specify that a global dataset is used in addition to the specified dataset to create the model.',
          format: 'int64',
          type: 'integer',
        },
      },
      type: 'object',
    },
  },
  securitySchemes: {
    bearer_token: {
      scheme: 'bearer',
      type: 'http',
    },
  },
} as TComponents;
