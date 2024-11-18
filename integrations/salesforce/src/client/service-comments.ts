export const comments = {
  "getApiUsagePlansV2": {
    "comment": "Get API Isage",
    "doc": "Get API Isage\n  Returns prediction usage on a monthly basis for the current calendar month and future months. Each apiusage object in the response corresponds to a calendar month in your plan."
  },
  "listDatasets": {
    "comment": "Get All Datasets",
    "doc": "Get All Datasets\n  Returns a list of datasets and their labels that were created by the current user. The response is sorted by dataset ID."
  },
  "uploadDatasetAsync": {
    "comment": "Create a Dataset From a File Asynchronously",
    "doc": "Create a Dataset From a File Asynchronously\n  Creates a dataset, labels, and examples from the specified .csv, .tsv, or .json file. The call returns immediately and continues to upload data in the background."
  },
  "uploadDatasetSync": {
    "comment": "Create a Dataset From a File Synchronously",
    "doc": "Create a Dataset From a File Synchronously\n  Creates a dataset, labels, and examples from the specified .csv, .tsv, or .json file. The call returns after the dataset is created and all of the data is uploaded."
  },
  "deleteDataset": {
    "comment": "Delete a Dataset",
    "doc": "Delete a Dataset\n  Deletes the specified dataset and associated labels and examples."
  },
  "getDataset": {
    "comment": "Get a Dataset",
    "doc": "Get a Dataset\n  Returns a single dataset."
  },
  "getExamples": {
    "comment": "Get All Examples",
    "doc": "Get All Examples\n  Returns all the examples for the specified dataset,"
  },
  "getTrainedModels": {
    "comment": "Get All Models",
    "doc": "Get All Models\n  Returns all models for the specified dataset."
  },
  "updateDatasetAsync": {
    "comment": "Create Examples From a File",
    "doc": "Create Examples From a File\n  Adds examples from a .csv, .tsv, or .json file to a dataset."
  },
  "get": {
    "comment": "Get Deletion Status",
    "doc": "Get Deletion Status\n  Returns the status of a language dataset or model deletion. When you delete a dataset or model, the deletion may not occur immediately. Use this call to find out when the deletion is complete."
  },
  "getExamplesByLabel": {
    "comment": "Get All Examples for Label",
    "doc": "Get All Examples for Label\n  Returns all the examples for the specified label. Returns both uploaded examples and feedback examples."
  },
  "provideFeedback": {
    "comment": "Create a Feedback Example",
    "doc": "Create a Feedback Example\n  Adds a feedback example to the dataset associated with the specified model."
  },
  "intentMultipart": {
    "comment": "Prediction for Intent",
    "doc": "Prediction for Intent\n  Returns an intent prediction for the given string."
  },
  "deleteModel": {
    "comment": "Delete a Model",
    "doc": "Delete a Model\n  Deletes the specified model."
  },
  "getTrainedModelMetrics": {
    "comment": "Get Model Metrics",
    "doc": "Get Model Metrics\n  Returns the metrics for a model"
  },
  "getTrainedModelLearningCurve": {
    "comment": "Get Model Learning Curve",
    "doc": "Get Model Learning Curve\n  Returns the metrics for each epoch in a model."
  },
  "retrain": {
    "comment": "Retrain a Dataset",
    "doc": "Retrain a Dataset\n  Retrains a dataset and updates a model. Use this API call when you want to update a model and keep the model ID instead of creating a new model."
  },
  "sentimentMultipart": {
    "comment": "Prediction for Sentiment",
    "doc": "Prediction for Sentiment\n  Returns a sentiment prediction for the given string."
  },
  "train": {
    "comment": "Train a Dataset",
    "doc": "Train a Dataset\n  Trains a dataset and creates a model."
  },
  "getTrainStatusAndProgress": {
    "comment": "Get Training Status",
    "doc": "Get Training Status\n  Returns the status of a model's training process. Use the progress field to determine how far the training has progressed. When training completes successfully, the status is SUCCEEDED and the progress is 1."
  },
  "generateTokenV2": {
    "comment": "Generate an OAuth Token",
    "doc": "Generate an OAuth Token\n  Returns an OAuth access token or a refresh token. You must pass a valid access token in the header of each API call."
  },
  "revokeRefreshTokenV2": {
    "comment": "Delete a Refresh Token",
    "doc": "Delete a Refresh Token"
  },
  "updateDatasetAsync1": {
    "comment": "Create Feedback Examples From a Zip File",
    "doc": "Create Feedback Examples From a Zip File\n  Adds feedback examples to the dataset associated with the specified object detection model."
  },
  "listDatasets1": {
    "comment": "Get All Datasets",
    "doc": "Get All Datasets\n  Returns a list of datasets and their labels that were created by the current user. The response is sorted by dataset ID."
  },
  "createDataset": {
    "comment": "Create a Dataset",
    "doc": "Create a Dataset\n  Creates a dataset and labels, if they're specified."
  },
  "uploadDatasetAsync1": {
    "comment": "Create a Dataset From a Zip File Asynchronously",
    "doc": "Create a Dataset From a Zip File Asynchronously\n  Creates a dataset, labels, and examples from the specified .zip file. The call returns immediately and continues to upload the images in the background."
  },
  "uploadDatasetSync1": {
    "comment": "Create a Dataset From a Zip File Synchronously",
    "doc": "Create a Dataset From a Zip File Synchronously\n  Creates a dataset, labels, and examples from the specified .zip file. The call returns after the dataset is created and all of the images are uploaded."
  },
  "deleteDataset1": {
    "comment": "Delete a Dataset",
    "doc": "Delete a Dataset\n  Deletes the specified dataset and associated labels and examples."
  },
  "getDataset1": {
    "comment": "Get a Dataset",
    "doc": "Get a Dataset\n  Returns a single dataset."
  },
  "getExamples1": {
    "comment": "Get All Examples",
    "doc": "Get All Examples\n  Returns all the examples for the specified dataset. By default, returns examples created by uploading them from a .zip file."
  },
  "addExample": {
    "comment": "Create an Example",
    "doc": "Create an Example\n  Adds an example with the specified label to a dataset."
  },
  "getTrainedModels1": {
    "comment": "Get All Models",
    "doc": "Get All Models\n  Returns all models for the specified dataset."
  },
  "updateDatasetAsync2": {
    "comment": "Create Examples From a Zip File",
    "doc": "Create Examples From a Zip File\n  Adds examples from a .zip file to a dataset. You can use this call only with a dataset that was created from a .zip file."
  },
  "get1": {
    "comment": "Get Deletion Status",
    "doc": "Get Deletion Status\n  Returns the status of an image dataset or model deletion. When you delete a dataset or model, the deletion may not occur immediately. Use this call to find out when the deletion is complete."
  },
  "detectMultipart": {
    "comment": "Detection with Image File",
    "doc": "Detection with Image File\n  Returns labels, probabilities, and bounding box coordinates for items detected in the specified local image file."
  },
  "getExamplesByLabel1": {
    "comment": "Get All Examples for Label",
    "doc": "Get All Examples for Label\n  Returns all the examples for the specified label. Returns both uploaded examples and feedback examples."
  },
  "provideFeedback1": {
    "comment": "Create a Feedback Example",
    "doc": "Create a Feedback Example\n  Adds a feedback example to the dataset associated with the specified model."
  },
  "deleteModel1": {
    "comment": "Delete a Model",
    "doc": "Delete a Model\n  Deletes the specified model."
  },
  "getTrainedModelMetrics1": {
    "comment": "Get Model Metrics",
    "doc": "Get Model Metrics\n  Returns the metrics for a model"
  },
  "getTrainedModelLearningCurve1": {
    "comment": "Get Model Learning Curve",
    "doc": "Get Model Learning Curve\n  Returns the metrics for each epoch in a model."
  },
  "ocrMultipart": {
    "comment": "Detect Text",
    "doc": "Detect Text\n  Returns a prediction from an OCR model for the specified image URL or local image file."
  },
  "predictMultipart": {
    "comment": "Make Prediction",
    "doc": "Make Prediction\n  Returns a prediction from an image or multi-label model for the specified image."
  },
  "retrain1": {
    "comment": "Retrain a Dataset",
    "doc": "Retrain a Dataset\n  Retrains a dataset and updates a model. Use this API call when you want to update a model and keep the model ID instead of creating a new model."
  },
  "train1": {
    "comment": "Train a Dataset",
    "doc": "Train a Dataset\n  Trains a dataset and creates a model."
  },
  "getTrainStatusAndProgress1": {
    "comment": "Get Training Status",
    "doc": "Get Training Status\n  Returns the status of a model's training process. Use the progress field to determine how far the training has progressed. When training completes successfully, the status is SUCCEEDED and the progress is 1."
  }
}