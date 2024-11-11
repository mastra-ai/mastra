// @ts-nocheck
export type openapi = {
  openapi: '3.1.0';
  paths: {
    '/v2/usercollection/personal_info': {
      get: {
        tags: ['Personal Info Routes'];
        summary: 'Single Personal Info Document';
        operationId: 'Single_Personal_Info_Document_v2_usercollection_personal_info_get';
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PersonalInfoResponse';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/personal_info' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/personal_info' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/personal_info', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/personal_info") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/tag': {
      get: {
        tags: ['Tag Routes'];
        summary: 'Multiple Tag Documents';
        operationId: 'Multiple_tag_Documents_v2_usercollection_tag_get';
        deprecated: true;
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_TagModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/tag?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/tag' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/tag?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/tag?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/tag': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Multiple Tag Documents';
        operationId: 'Sandbox___Multiple_tag_Documents_v2_sandbox_usercollection_tag_get';
        deprecated: true;
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_TagModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/tag?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/tag' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/tag?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/tag?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/enhanced_tag': {
      get: {
        tags: ['Enhanced Tag Routes'];
        summary: 'Multiple Enhanced Tag Documents';
        operationId: 'Multiple_enhanced_tag_Documents_v2_usercollection_enhanced_tag_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_EnhancedTagModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/enhanced_tag?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/enhanced_tag' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/enhanced_tag?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/enhanced_tag?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/enhanced_tag': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Multiple Enhanced Tag Documents';
        operationId: 'Sandbox___Multiple_enhanced_tag_Documents_v2_sandbox_usercollection_enhanced_tag_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_EnhancedTagModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/enhanced_tag?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/enhanced_tag' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/enhanced_tag?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/enhanced_tag?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/workout': {
      get: {
        tags: ['Workout Routes'];
        summary: 'Multiple Workout Documents';
        operationId: 'Multiple_workout_Documents_v2_usercollection_workout_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_WorkoutModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/workout?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/workout' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/workout?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/workout?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/workout': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Multiple Workout Documents';
        operationId: 'Sandbox___Multiple_workout_Documents_v2_sandbox_usercollection_workout_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_WorkoutModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/workout?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/workout' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/workout?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/workout?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/session': {
      get: {
        tags: ['Session Routes'];
        summary: 'Multiple Session Documents';
        operationId: 'Multiple_session_Documents_v2_usercollection_session_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_SessionModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/session?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/session' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/session?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/session?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/session': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Multiple Session Documents';
        operationId: 'Sandbox___Multiple_session_Documents_v2_sandbox_usercollection_session_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_SessionModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/session?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/session' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/session?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/session?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/daily_activity': {
      get: {
        tags: ['Daily Activity Routes'];
        summary: 'Multiple Daily Activity Documents';
        operationId: 'Multiple_daily_activity_Documents_v2_usercollection_daily_activity_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_DailyActivityModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_activity?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_activity' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_activity?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_activity?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/daily_activity': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Multiple Daily Activity Documents';
        operationId: 'Sandbox___Multiple_daily_activity_Documents_v2_sandbox_usercollection_daily_activity_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_DailyActivityModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_activity?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_activity' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_activity?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_activity?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/daily_sleep': {
      get: {
        tags: ['Daily Sleep Routes'];
        summary: 'Multiple Daily Sleep Documents';
        operationId: 'Multiple_daily_sleep_Documents_v2_usercollection_daily_sleep_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_DailySleepModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_sleep' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/daily_sleep': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Multiple Daily Sleep Documents';
        operationId: 'Sandbox___Multiple_daily_sleep_Documents_v2_sandbox_usercollection_daily_sleep_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_DailySleepModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_sleep?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_sleep' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_sleep?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_sleep?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/daily_spo2': {
      get: {
        tags: ['Daily Spo2 Routes'];
        summary: 'Multiple Daily Spo2 Documents';
        operationId: 'Multiple_daily_spo2_Documents_v2_usercollection_daily_spo2_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_DailySpO2Model_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_spo2?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_spo2' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_spo2?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_spo2?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/daily_spo2': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Multiple Daily Spo2 Documents';
        operationId: 'Sandbox___Multiple_daily_spo2_Documents_v2_sandbox_usercollection_daily_spo2_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_DailySpO2Model_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_spo2?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_spo2' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_spo2?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_spo2?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/daily_readiness': {
      get: {
        tags: ['Daily Readiness Routes'];
        summary: 'Multiple Daily Readiness Documents';
        operationId: 'Multiple_daily_readiness_Documents_v2_usercollection_daily_readiness_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_DailyReadinessModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_readiness' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/daily_readiness': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Multiple Daily Readiness Documents';
        operationId: 'Sandbox___Multiple_daily_readiness_Documents_v2_sandbox_usercollection_daily_readiness_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_DailyReadinessModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_readiness?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_readiness' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_readiness?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_readiness?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/sleep': {
      get: {
        tags: ['Sleep Routes'];
        summary: 'Multiple Sleep Documents';
        operationId: 'Multiple_sleep_Documents_v2_usercollection_sleep_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_SleepModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/sleep?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/sleep' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/sleep?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/sleep?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/sleep': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Multiple Sleep Documents';
        operationId: 'Sandbox___Multiple_sleep_Documents_v2_sandbox_usercollection_sleep_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_SleepModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/sleep?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/sleep' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/sleep?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/sleep?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/sleep_time': {
      get: {
        tags: ['Sleep Time Routes'];
        summary: 'Multiple Sleep Time Documents';
        operationId: 'Multiple_sleep_time_Documents_v2_usercollection_sleep_time_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_SleepTimeModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/sleep_time?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/sleep_time' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/sleep_time?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/sleep_time?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/sleep_time': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Multiple Sleep Time Documents';
        operationId: 'Sandbox___Multiple_sleep_time_Documents_v2_sandbox_usercollection_sleep_time_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_SleepTimeModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/sleep_time?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/sleep_time' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/sleep_time?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/sleep_time?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/rest_mode_period': {
      get: {
        tags: ['Rest Mode Period Routes'];
        summary: 'Multiple Rest Mode Period Documents';
        operationId: 'Multiple_rest_mode_period_Documents_v2_usercollection_rest_mode_period_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_RestModePeriodModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/rest_mode_period?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/rest_mode_period' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/rest_mode_period?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/rest_mode_period?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/rest_mode_period': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Multiple Rest Mode Period Documents';
        operationId: 'Sandbox___Multiple_rest_mode_period_Documents_v2_sandbox_usercollection_rest_mode_period_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_RestModePeriodModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/rest_mode_period?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/rest_mode_period' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/rest_mode_period?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/rest_mode_period?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/ring_configuration': {
      get: {
        tags: ['Ring Configuration Routes'];
        summary: 'Multiple Ring Configuration Documents';
        operationId: 'Multiple_ring_configuration_Documents_v2_usercollection_ring_configuration_get';
        parameters: [
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_RingConfigurationModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/ring_configuration?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/ring_configuration' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/ring_configuration?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/ring_configuration?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/ring_configuration': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Multiple Ring Configuration Documents';
        operationId: 'Sandbox___Multiple_ring_configuration_Documents_v2_sandbox_usercollection_ring_configuration_get';
        parameters: [
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_RingConfigurationModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/ring_configuration?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/ring_configuration' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/ring_configuration?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/ring_configuration?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/daily_stress': {
      get: {
        tags: ['Daily Stress Routes'];
        summary: 'Multiple Daily Stress Documents';
        operationId: 'Multiple_daily_stress_Documents_v2_usercollection_daily_stress_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_DailyStressModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_stress?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_stress' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_stress?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_stress?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/daily_stress': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Multiple Daily Stress Documents';
        operationId: 'Sandbox___Multiple_daily_stress_Documents_v2_sandbox_usercollection_daily_stress_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_DailyStressModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_stress?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_stress' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_stress?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_stress?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/daily_resilience': {
      get: {
        tags: ['Daily Resilience Routes'];
        summary: 'Multiple Daily Resilience Documents';
        operationId: 'Multiple_daily_resilience_Documents_v2_usercollection_daily_resilience_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_DailyResilienceModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_resilience?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_resilience' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_resilience?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_resilience?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/daily_resilience': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Multiple Daily Resilience Documents';
        operationId: 'Sandbox___Multiple_daily_resilience_Documents_v2_sandbox_usercollection_daily_resilience_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_DailyResilienceModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_resilience?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_resilience' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_resilience?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_resilience?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/daily_cardiovascular_age': {
      get: {
        tags: ['Daily Cardiovascular Age Routes'];
        summary: 'Multiple Daily Cardiovascular Age Documents';
        operationId: 'Multiple_daily_cardiovascular_age_Documents_v2_usercollection_daily_cardiovascular_age_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_DailyCardiovascularAgeModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_cardiovascular_age?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_cardiovascular_age' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_cardiovascular_age?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_cardiovascular_age?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/daily_cardiovascular_age': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Multiple Daily Cardiovascular Age Documents';
        operationId: 'Sandbox___Multiple_daily_cardiovascular_age_Documents_v2_sandbox_usercollection_daily_cardiovascular_age_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_DailyCardiovascularAgeModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_cardiovascular_age?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_cardiovascular_age' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_cardiovascular_age?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_cardiovascular_age?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/vO2_max': {
      get: {
        tags: ['VO2 Max Routes'];
        summary: 'Multiple Vo2 Max Documents';
        operationId: 'Multiple_vO2_max_Documents_v2_usercollection_vO2_max_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_VO2MaxModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/vO2_max?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/vO2_max' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/vO2_max?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/vO2_max?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/vO2_max': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Multiple Vo2 Max Documents';
        operationId: 'Sandbox___Multiple_vO2_max_Documents_v2_sandbox_usercollection_vO2_max_get';
        parameters: [
          {
            name: 'start_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Date';
            };
          },
          {
            name: 'end_date';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'string';
                  format: 'date';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Date';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MultiDocumentResponse_VO2MaxModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/vO2_max?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/vO2_max' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/vO2_max?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/vO2_max?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/tag/{document_id}': {
      get: {
        tags: ['Tag Routes'];
        summary: 'Single Tag Document';
        operationId: 'Single_tag_Document_v2_usercollection_tag__document_id__get';
        deprecated: true;
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TagModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/tag/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/tag/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/tag/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/tag/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/tag/{document_id}': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Single Tag Document';
        operationId: 'Sandbox___Single_tag_Document_v2_sandbox_usercollection_tag__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TagModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/tag/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/tag/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/tag/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/tag/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/enhanced_tag/{document_id}': {
      get: {
        tags: ['Enhanced Tag Routes'];
        summary: 'Single Enhanced Tag Document';
        operationId: 'Single_enhanced_tag_Document_v2_usercollection_enhanced_tag__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/EnhancedTagModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/enhanced_tag/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/enhanced_tag/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/enhanced_tag/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/enhanced_tag/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/enhanced_tag/{document_id}': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Single Enhanced Tag Document';
        operationId: 'Sandbox___Single_enhanced_tag_Document_v2_sandbox_usercollection_enhanced_tag__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/EnhancedTagModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/enhanced_tag/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/enhanced_tag/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/enhanced_tag/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/enhanced_tag/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/workout/{document_id}': {
      get: {
        tags: ['Workout Routes'];
        summary: 'Single Workout Document';
        operationId: 'Single_workout_Document_v2_usercollection_workout__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WorkoutModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/workout/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/workout/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/workout/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/workout/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/workout/{document_id}': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Single Workout Document';
        operationId: 'Sandbox___Single_workout_Document_v2_sandbox_usercollection_workout__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WorkoutModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/workout/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/workout/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/workout/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/workout/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/session/{document_id}': {
      get: {
        tags: ['Session Routes'];
        summary: 'Single Session Document';
        operationId: 'Single_session_Document_v2_usercollection_session__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SessionModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/session/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/session/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/session/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/session/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/session/{document_id}': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Single Session Document';
        operationId: 'Sandbox___Single_session_Document_v2_sandbox_usercollection_session__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SessionModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/session/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/session/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/session/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/session/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/daily_activity/{document_id}': {
      get: {
        tags: ['Daily Activity Routes'];
        summary: 'Single Daily Activity Document';
        operationId: 'Single_daily_activity_Document_v2_usercollection_daily_activity__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DailyActivityModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_activity/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_activity/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_activity/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_activity/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/daily_activity/{document_id}': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Single Daily Activity Document';
        operationId: 'Sandbox___Single_daily_activity_Document_v2_sandbox_usercollection_daily_activity__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DailyActivityModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_activity/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_activity/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_activity/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_activity/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/daily_sleep/{document_id}': {
      get: {
        tags: ['Daily Sleep Routes'];
        summary: 'Single Daily Sleep Document';
        operationId: 'Single_daily_sleep_Document_v2_usercollection_daily_sleep__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DailySleepModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_sleep/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_sleep/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_sleep/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_sleep/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/daily_sleep/{document_id}': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Single Daily Sleep Document';
        operationId: 'Sandbox___Single_daily_sleep_Document_v2_sandbox_usercollection_daily_sleep__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DailySleepModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_sleep/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_sleep/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_sleep/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_sleep/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/daily_spo2/{document_id}': {
      get: {
        tags: ['Daily Spo2 Routes'];
        summary: 'Single Daily Spo2 Document';
        operationId: 'Single_daily_spo2_Document_v2_usercollection_daily_spo2__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DailySpO2Model';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_spo2/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_spo2/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_spo2/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_spo2/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/daily_spo2/{document_id}': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Single Daily Spo2 Document';
        operationId: 'Sandbox___Single_daily_spo2_Document_v2_sandbox_usercollection_daily_spo2__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DailySpO2Model';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_spo2/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_spo2/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_spo2/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_spo2/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/daily_readiness/{document_id}': {
      get: {
        tags: ['Daily Readiness Routes'];
        summary: 'Single Daily Readiness Document';
        operationId: 'Single_daily_readiness_Document_v2_usercollection_daily_readiness__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DailyReadinessModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_readiness/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_readiness/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_readiness/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_readiness/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/daily_readiness/{document_id}': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Single Daily Readiness Document';
        operationId: 'Sandbox___Single_daily_readiness_Document_v2_sandbox_usercollection_daily_readiness__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DailyReadinessModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_readiness/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_readiness/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_readiness/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_readiness/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/sleep/{document_id}': {
      get: {
        tags: ['Sleep Routes'];
        summary: 'Single Sleep Document';
        operationId: 'Single_sleep_Document_v2_usercollection_sleep__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SleepModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/sleep/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/sleep/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/sleep/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/sleep/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/sleep/{document_id}': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Single Sleep Document';
        operationId: 'Sandbox___Single_sleep_Document_v2_sandbox_usercollection_sleep__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SleepModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/sleep/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/sleep/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/sleep/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/sleep/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/sleep_time/{document_id}': {
      get: {
        tags: ['Sleep Time Routes'];
        summary: 'Single Sleep Time Document';
        operationId: 'Single_sleep_time_Document_v2_usercollection_sleep_time__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SleepTimeModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/sleep_time/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/sleep_time/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/sleep_time/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/sleep_time/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/sleep_time/{document_id}': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Single Sleep Time Document';
        operationId: 'Sandbox___Single_sleep_time_Document_v2_sandbox_usercollection_sleep_time__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SleepTimeModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/sleep_time/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/sleep_time/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/sleep_time/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/sleep_time/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/rest_mode_period/{document_id}': {
      get: {
        tags: ['Rest Mode Period Routes'];
        summary: 'Single Rest Mode Period Document';
        operationId: 'Single_rest_mode_period_Document_v2_usercollection_rest_mode_period__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RestModePeriodModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/rest_mode_period/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/rest_mode_period/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/rest_mode_period/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/rest_mode_period/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/rest_mode_period/{document_id}': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Single Rest Mode Period Document';
        operationId: 'Sandbox___Single_rest_mode_period_Document_v2_sandbox_usercollection_rest_mode_period__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RestModePeriodModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/rest_mode_period/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/rest_mode_period/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/rest_mode_period/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/rest_mode_period/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/ring_configuration/{document_id}': {
      get: {
        tags: ['Ring Configuration Routes'];
        summary: 'Single Ring Configuration Document';
        operationId: 'Single_ring_configuration_Document_v2_usercollection_ring_configuration__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RingConfigurationModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/ring_configuration/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/ring_configuration/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/ring_configuration/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/ring_configuration/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/ring_configuration/{document_id}': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Single Ring Configuration Document';
        operationId: 'Sandbox___Single_ring_configuration_Document_v2_sandbox_usercollection_ring_configuration__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RingConfigurationModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/ring_configuration/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/ring_configuration/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/ring_configuration/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/ring_configuration/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/daily_stress/{document_id}': {
      get: {
        tags: ['Daily Stress Routes'];
        summary: 'Single Daily Stress Document';
        operationId: 'Single_daily_stress_Document_v2_usercollection_daily_stress__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DailyStressModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_stress/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_stress/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_stress/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_stress/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/daily_stress/{document_id}': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Single Daily Stress Document';
        operationId: 'Sandbox___Single_daily_stress_Document_v2_sandbox_usercollection_daily_stress__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DailyStressModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_stress/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_stress/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_stress/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_stress/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/daily_resilience/{document_id}': {
      get: {
        tags: ['Daily Resilience Routes'];
        summary: 'Single Daily Resilience Document';
        operationId: 'Single_daily_resilience_Document_v2_usercollection_daily_resilience__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DailyResilienceModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_resilience/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_resilience/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_resilience/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_resilience/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/daily_resilience/{document_id}': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Single Daily Resilience Document';
        operationId: 'Sandbox___Single_daily_resilience_Document_v2_sandbox_usercollection_daily_resilience__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DailyResilienceModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_resilience/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_resilience/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_resilience/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_resilience/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/daily_cardiovascular_age/{document_id}': {
      get: {
        tags: ['Daily Cardiovascular Age Routes'];
        summary: 'Single Daily Cardiovascular Age Document';
        operationId: 'Single_daily_cardiovascular_age_Document_v2_usercollection_daily_cardiovascular_age__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DailyCardiovascularAgeModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_cardiovascular_age/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_cardiovascular_age/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_cardiovascular_age/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_cardiovascular_age/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/daily_cardiovascular_age/{document_id}': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Single Daily Cardiovascular Age Document';
        operationId: 'Sandbox___Single_daily_cardiovascular_age_Document_v2_sandbox_usercollection_daily_cardiovascular_age__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DailyCardiovascularAgeModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_cardiovascular_age/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_cardiovascular_age/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_cardiovascular_age/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_cardiovascular_age/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/usercollection/vO2_max/{document_id}': {
      get: {
        tags: ['VO2 Max Routes'];
        summary: 'Single Vo2 Max Document';
        operationId: 'Single_vO2_max_Document_v2_usercollection_vO2_max__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/VO2MaxModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/vO2_max/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/vO2_max/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/vO2_max/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/vO2_max/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/vO2_max/{document_id}': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Single Vo2 Max Document';
        operationId: 'Sandbox___Single_vO2_max_Document_v2_sandbox_usercollection_vO2_max__document_id__get';
        parameters: [
          {
            name: 'document_id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Document Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/VO2MaxModel';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '404': {
            description: 'Not Found';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/vO2_max/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/vO2_max/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/vO2_max/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/vO2_max/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/webhook/subscription': {
      get: {
        tags: ['Webhook Subscription Routes'];
        summary: 'List Webhook Subscriptions';
        operationId: 'list_webhook_subscriptions_v2_webhook_subscription_get';
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  items: {
                    $ref: '#/components/schemas/WebhookSubscriptionModel';
                  };
                  type: 'array';
                  title: 'Response List Webhook Subscriptions V2 Webhook Subscription Get';
                };
              };
            };
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/webhook/subscription' --header 'x-client-id: client-id' --header 'x-client-secret: client-secret'";
          },
        ];
      };
      post: {
        tags: ['Webhook Subscription Routes'];
        summary: 'Create Webhook Subscription';
        operationId: 'create_webhook_subscription_v2_webhook_subscription_post';
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateWebhookSubscriptionRequest';
              };
            };
          };
          required: true;
        };
        responses: {
          '201': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WebhookSubscriptionModel';
                };
              };
            };
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: 'curl --location --request POST \'https://api.ouraring.com/v2/webhook/subscription\' --header \'x-client-id: client-id\' --header \'x-client-secret: client-secret\' --header \'Content-Type: application/json\' --data-raw \'{\n    "callback_url": "https://my-api/oura/tag/delete",\n    "verification_token": "123",\n    "event_type": "delete",\n    "data_type": "tag"\n}\'';
          },
        ];
      };
    };
    '/v2/webhook/subscription/{id}': {
      get: {
        tags: ['Webhook Subscription Routes'];
        summary: 'Get Webhook Subscription';
        operationId: 'get_webhook_subscription_v2_webhook_subscription__id__get';
        parameters: [
          {
            name: 'id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WebhookSubscriptionModel';
                };
              };
            };
          };
          '403': {
            description: 'Webhook with specified id does not exist.';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request GET 'https://api.ouraring.com/v2/webhook/subscription/5d3fe17b-f880-4d93-b9b6-afbfb76c1e78' --header 'x-client-id: client-id' --header 'x-client-secret: client-secret'";
          },
        ];
      };
      put: {
        tags: ['Webhook Subscription Routes'];
        summary: 'Update Webhook Subscription';
        operationId: 'update_webhook_subscription_v2_webhook_subscription__id__put';
        parameters: [
          {
            name: 'id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Id';
            };
          },
        ];
        requestBody: {
          required: true;
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateWebhookSubscriptionRequest';
              };
            };
          };
        };
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WebhookSubscriptionModel';
                };
              };
            };
          };
          '403': {
            description: 'Webhook with specified id does not exist.';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: 'curl --location --request PUT \'https://api.ouraring.com/v2/webhook/subscription/5d3fe17b-f880-4d93-b9b6-afbfb76c1e78\' --header \'x-client-id: client-id\' --header \'x-client-secret: client-secret\' --header \'Content-Type: application/json\' --data-raw \'{\n    "callback_url": "https://my-api/oura/tag/delete",\n    "verification_token": "123",\n    "event_type": "delete",\n    "data_type": "tag"\n}\'';
          },
        ];
      };
      delete: {
        tags: ['Webhook Subscription Routes'];
        summary: 'Delete Webhook Subscription';
        operationId: 'delete_webhook_subscription_v2_webhook_subscription__id__delete';
        parameters: [
          {
            name: 'id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Id';
            };
          },
        ];
        responses: {
          '204': {
            description: 'Successful Response';
          };
          '403': {
            description: 'Webhook with specified id does not exist.';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request DELETE 'https://api.ouraring.com/v2/webhook/subscription/5d3fe17b-f880-4d93-b9b6-afbfb76c1e78' --header 'x-client-id: client-id' --header 'x-client-secret: client-secret'";
          },
        ];
      };
    };
    '/v2/webhook/subscription/renew/{id}': {
      put: {
        tags: ['Webhook Subscription Routes'];
        summary: 'Renew Webhook Subscription';
        operationId: 'renew_webhook_subscription_v2_webhook_subscription_renew__id__put';
        parameters: [
          {
            name: 'id';
            in: 'path';
            required: true;
            schema: {
              type: 'string';
              title: 'Id';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WebhookSubscriptionModel';
                };
              };
            };
          };
          '403': {
            description: 'Webhook with specified id does not exist.';
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "curl --location --request PUT 'https://api.ouraring.com/v2/webhook/subscription/renew/5d3fe17b-f880-4d93-b9b6-afbfb76c1e78' --header 'x-client-id: client-id' --header 'x-client-secret: client-secret' --header 'Content-Type: application/json'";
          },
        ];
      };
    };
    '/v2/usercollection/heartrate': {
      get: {
        tags: ['Heart Rate Routes'];
        summary: 'Multiple Multiple Heart Rate Documents Documents';
        operationId: 'Multiple_Multiple_Heart_Rate_Documents_Documents_v2_usercollection_heartrate_get';
        parameters: [
          {
            name: 'start_datetime';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Datetime';
            };
          },
          {
            name: 'end_datetime';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Datetime';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TimeSeriesResponse_HeartRateModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "# The '+' symbol in the timezone must be escaped to `%2B` if included. \ncurl --location --request GET 'https://api.ouraring.com/v2/usercollection/heartrate?start_datetime=2021-11-01T00:00:00-08:00&end_datetime=2021-12-01T00:00:00-08:00' \\ \n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/heartrate' \nparams={ \n    'start_datetime': '2021-11-01T00:00:00-08:00', \n    'end_datetime': '2021-12-01T00:00:00-08:00' \n} \nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/heartrate?start_datetime=2021-11-01T00:00:00-08:00&end_datetime=2021-12-01T00:00:00-08:00', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/heartrate?start_datetime=2021-11-01T00:00:00-08:00&end_datetime=2021-12-01T00:00:00-08:00") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
    '/v2/sandbox/usercollection/heartrate': {
      get: {
        tags: ['Sandbox Routes'];
        summary: 'Sandbox - Multiple Heartrate Documents';
        operationId: 'Sandbox___Multiple_heartrate_Documents_v2_sandbox_usercollection_heartrate_get';
        parameters: [
          {
            name: 'start_datetime';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Start Datetime';
            };
          },
          {
            name: 'end_datetime';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                  format: 'date-time';
                },
                {
                  type: 'null';
                },
              ];
              title: 'End Datetime';
            };
          },
          {
            name: 'next_token';
            in: 'query';
            required: false;
            schema: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'null';
                },
              ];
              title: 'Next Token';
            };
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TimeSeriesResponse_HeartRateModel_';
                };
              };
            };
          };
          '400': {
            description: 'Client Exception';
          };
          '401': {
            description: 'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.';
          };
          '403': {
            description: "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.";
          };
          '422': {
            description: 'Validation Error';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HTTPValidationError';
                };
              };
            };
          };
          '429': {
            description: 'Request Rate Limit Exceeded.';
          };
        };
        'x-codeSamples': [
          {
            lang: 'cURL';
            label: 'cURL';
            source: "# The '+' symbol in the timezone must be escaped to `%2B` if included. \ncurl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/heartrate?start_datetime=2021-11-01T00:00:00-08:00&end_datetime=2021-12-01T00:00:00-08:00' \\ \n--header 'Authorization: Bearer <token>'";
          },
          {
            lang: 'Python';
            source: "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/heartrate' \nparams={ \n    'start_datetime': '2021-11-01T00:00:00-08:00', \n    'end_datetime': '2021-12-01T00:00:00-08:00' \n} \nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)";
            label: 'Python';
          },
          {
            lang: 'JavaScript';
            source: "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/heartrate?start_datetime=2021-11-01T00:00:00-08:00&end_datetime=2021-12-01T00:00:00-08:00', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));";
            label: 'JavaScript';
          },
          {
            lang: 'Java';
            source: 'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/heartrate?start_datetime=2021-11-01T00:00:00-08:00&end_datetime=2021-12-01T00:00:00-08:00") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();';
            label: 'Java';
          },
        ];
      };
    };
  };
  components: {
    schemas: {
      ActivityContributors: {
        properties: {
          meet_daily_targets: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: '';
            description: 'Contribution of meeting previous 7-day daily activity targets in range [1, 100].';
          };
          move_every_hour: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: '';
            description: 'Contribution of previous 24-hour inactivity alerts in range [1, 100].';
          };
          recovery_time: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: '';
            description: 'Contribution of previous 7-day recovery time in range [1, 100].';
          };
          stay_active: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: '';
            description: 'Contribution of previous 24-hour activity in range [1, 100].';
          };
          training_frequency: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: '';
            description: 'Contribution of previous 7-day exercise frequency in range [1, 100].';
          };
          training_volume: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: '';
            description: 'Contribution of previous 7-day exercise volume in range [1, 100].';
          };
        };
        type: 'object';
        title: 'ActivityContributors';
        description: 'Object defining activity score contributors.';
      };
      CreateWebhookSubscriptionRequest: {
        properties: {
          callback_url: {
            type: 'string';
            title: 'Callback Url';
          };
          verification_token: {
            type: 'string';
            title: 'Verification Token';
          };
          event_type: {
            $ref: '#/components/schemas/WebhookOperation';
          };
          data_type: {
            $ref: '#/components/schemas/ExtApiV2DataType';
          };
        };
        type: 'object';
        required: ['callback_url', 'verification_token', 'event_type', 'data_type'];
        title: 'CreateWebhookSubscriptionRequest';
      };
      DailyActivityModel: {
        properties: {
          id: {
            type: 'string';
            title: 'Id';
          };
          class_5_min: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Class 5 Min';
            description: '5-minute activity classification for the activity period:\n* ```0```\tnon wear\n* ```1``` rest\n* ```2``` inactive\n* ```3``` low activity\n* ```4``` medium activity\n* ```5``` high activity';
          };
          score: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Score';
            description: 'Activity score in range ```[1, 100]```';
          };
          active_calories: {
            type: 'integer';
            title: 'Active Calories';
            description: 'Active calories expended (in kilocalories)';
          };
          average_met_minutes: {
            type: 'number';
            title: 'Average Met Minutes';
            description: 'Average metabolic equivalent (MET) in minutes';
          };
          contributors: {
            $ref: '#/components/schemas/ActivityContributors';
          };
          equivalent_walking_distance: {
            type: 'integer';
            title: 'Equivalent Walking Distance';
            description: 'Equivalent walking distance (in meters) of energy expenditure';
          };
          high_activity_met_minutes: {
            type: 'integer';
            title: 'High Activity Met Minutes';
            description: 'High activity metabolic equivalent (MET) in minutes';
          };
          high_activity_time: {
            type: 'integer';
            title: 'High Activity Time';
            description: 'High activity metabolic equivalent (MET) in seconds';
          };
          inactivity_alerts: {
            type: 'integer';
            title: 'Inactivity Alerts';
            description: 'Number of inactivity alerts received';
          };
          low_activity_met_minutes: {
            type: 'integer';
            title: 'Low Activity Met Minutes';
            description: 'Low activity metabolic equivalent (MET) in minutes';
          };
          low_activity_time: {
            type: 'integer';
            title: 'Low Activity Time';
            description: 'Low activity metabolic equivalent (MET) in seconds';
          };
          medium_activity_met_minutes: {
            type: 'integer';
            title: 'Medium Activity Met Minutes';
            description: 'Medium activity metabolic equivalent (MET) in minutes';
          };
          medium_activity_time: {
            type: 'integer';
            title: 'Medium Activity Time';
            description: 'Medium activity metabolic equivalent (MET) in seconds';
          };
          met: {
            $ref: '#/components/schemas/SampleModel';
          };
          meters_to_target: {
            type: 'integer';
            title: 'Meters To Target';
            description: 'Remaining meters to target (from ```target_meters```';
          };
          non_wear_time: {
            type: 'integer';
            title: 'Non Wear Time';
            description: 'The time (in seconds) in which the ring was not worn';
          };
          resting_time: {
            type: 'integer';
            title: 'Resting Time';
            description: 'Resting time (in seconds)';
          };
          sedentary_met_minutes: {
            type: 'integer';
            title: 'Sedentary Met Minutes';
            description: 'Sedentary metabolic equivalent (MET) in minutes';
          };
          sedentary_time: {
            type: 'integer';
            title: 'Sedentary Time';
            description: 'Sedentary metabolic equivalent (MET) in seconds';
          };
          steps: {
            type: 'integer';
            title: 'Steps';
            description: 'Total number of steps taken';
          };
          target_calories: {
            type: 'integer';
            title: 'Target Calories';
            description: 'Daily activity target (in kilocalories)';
          };
          target_meters: {
            type: 'integer';
            title: 'Target Meters';
            description: 'Daily activity target (in meters)';
          };
          total_calories: {
            type: 'integer';
            title: 'Total Calories';
            description: 'Total calories expended (in kilocalories)';
          };
          day: {
            type: 'string';
            format: 'date';
            title: 'Day';
            description: 'The ```YYYY-MM-DD``` formatted local date indicating when the daily activity occurred';
          };
          timestamp: {
            allOf: [
              {
                $ref: '#/components/schemas/LocalDateTime';
              },
            ];
            description: 'ISO 8601 formatted local timestamp indicating the start datetime of when the daily activity occurred';
          };
        };
        type: 'object';
        required: [
          'id',
          'class_5_min',
          'score',
          'active_calories',
          'average_met_minutes',
          'contributors',
          'equivalent_walking_distance',
          'high_activity_met_minutes',
          'high_activity_time',
          'inactivity_alerts',
          'low_activity_met_minutes',
          'low_activity_time',
          'medium_activity_met_minutes',
          'medium_activity_time',
          'met',
          'meters_to_target',
          'non_wear_time',
          'resting_time',
          'sedentary_met_minutes',
          'sedentary_time',
          'steps',
          'target_calories',
          'target_meters',
          'total_calories',
          'day',
          'timestamp',
        ];
        title: 'DailyActivityModel';
      };
      DailyCardiovascularAgeModel: {
        properties: {
          day: {
            type: 'string';
            format: 'date';
            title: 'Day';
          };
          vascular_age: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Vascular Age';
            description: "'Predicted vascular age in range [18, 100].";
          };
        };
        type: 'object';
        required: ['day', 'vascular_age'];
        title: 'DailyCardiovascularAgeModel';
      };
      DailyReadinessModel: {
        properties: {
          id: {
            type: 'string';
            title: 'Id';
          };
          contributors: {
            allOf: [
              {
                $ref: '#/components/schemas/ReadinessContributors';
              },
            ];
            description: 'Contributors of the daily readiness score.';
          };
          day: {
            type: 'string';
            format: 'date';
            title: 'Day';
            description: 'Day that the daily readiness belongs to.';
          };
          score: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Score';
            description: 'Daily readiness score.';
          };
          temperature_deviation: {
            anyOf: [
              {
                type: 'number';
              },
              {
                type: 'null';
              },
            ];
            title: 'Temperature Deviation';
            description: 'Temperature deviation in degrees Celsius.';
          };
          temperature_trend_deviation: {
            anyOf: [
              {
                type: 'number';
              },
              {
                type: 'null';
              },
            ];
            title: 'Temperature Trend Deviation';
            description: 'Temperature trend deviation in degrees Celsius.';
          };
          timestamp: {
            allOf: [
              {
                $ref: '#/components/schemas/LocalDateTime';
              },
            ];
            description: 'Timestamp of the daily readiness.';
          };
        };
        type: 'object';
        required: [
          'id',
          'contributors',
          'day',
          'score',
          'temperature_deviation',
          'temperature_trend_deviation',
          'timestamp',
        ];
        title: 'DailyReadinessModel';
      };
      DailyResilienceModel: {
        properties: {
          id: {
            type: 'string';
            title: 'Id';
          };
          day: {
            type: 'string';
            format: 'date';
            title: 'Day';
            description: 'Day when the resilience record was recorded.';
          };
          contributors: {
            allOf: [
              {
                $ref: '#/components/schemas/ResilienceContributors';
              },
            ];
            description: 'Contributors to the resilience score.';
          };
          level: {
            allOf: [
              {
                $ref: '#/components/schemas/LongTermResilienceLevel';
              },
            ];
            description: 'Resilience level.';
          };
        };
        type: 'object';
        required: ['id', 'day', 'contributors', 'level'];
        title: 'DailyResilienceModel';
      };
      DailySleepModel: {
        properties: {
          id: {
            type: 'string';
            title: 'Id';
          };
          contributors: {
            allOf: [
              {
                $ref: '#/components/schemas/SleepContributors';
              },
            ];
            description: 'Contributors for the daily sleep score.';
          };
          day: {
            type: 'string';
            format: 'date';
            title: 'Day';
            description: 'Day that the daily sleep belongs to.';
          };
          score: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Score';
            description: 'Daily sleep score.';
          };
          timestamp: {
            allOf: [
              {
                $ref: '#/components/schemas/LocalDateTime';
              },
            ];
            description: 'Timestamp of the daily sleep.';
          };
        };
        type: 'object';
        required: ['id', 'contributors', 'day', 'score', 'timestamp'];
        title: 'DailySleepModel';
        description: 'Object defining daily sleep.';
      };
      DailySpO2AggregatedValuesModel: {
        properties: {
          average: {
            type: 'number';
            title: 'Average';
            description: 'Average oxygen saturation (SpO2) throughout the night.';
          };
        };
        type: 'object';
        required: ['average'];
        title: 'DailySpO2AggregatedValuesModel';
      };
      DailySpO2Model: {
        properties: {
          id: {
            type: 'string';
            title: 'Id';
          };
          day: {
            type: 'string';
            format: 'date';
            title: 'Day';
          };
          spo2_percentage: {
            anyOf: [
              {
                $ref: '#/components/schemas/DailySpO2AggregatedValuesModel';
              },
              {
                type: 'null';
              },
            ];
            description: 'The SpO2 percentage value aggregated over a single day.';
          };
        };
        type: 'object';
        required: ['id', 'day', 'spo2_percentage'];
        title: 'DailySpO2Model';
      };
      DailyStressModel: {
        properties: {
          id: {
            type: 'string';
            title: 'Id';
          };
          day: {
            type: 'string';
            format: 'date';
            title: 'Day';
            description: 'Day that the daily stress belongs to.';
          };
          stress_high: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Stress High';
            description: 'Time spent in a high stress zone (top quartile of data)';
          };
          recovery_high: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Recovery High';
            description: 'Time spend in a high recovery zone (bottom quartile data)';
          };
          day_summary: {
            anyOf: [
              {
                $ref: '#/components/schemas/DailyStressSummary';
              },
              {
                type: 'null';
              },
            ];
            description: 'Stress summary of full day.';
          };
        };
        type: 'object';
        required: ['id', 'day', 'stress_high', 'recovery_high'];
        title: 'DailyStressModel';
        description: 'Object defining daily stress.';
      };
      DailyStressSummary: {
        type: 'string';
        enum: ['restored', 'normal', 'stressful'];
        title: 'DailyStressSummary';
        description: 'Possible daily stress summary types.';
      };
      EnhancedTagModel: {
        properties: {
          id: {
            type: 'string';
            title: 'Id';
          };
          tag_type_code: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Tag Type Code';
            description: 'The unique code of the selected tag type, `NULL` for text-only tags, or `custom` for custom tag types.';
          };
          start_time: {
            allOf: [
              {
                $ref: '#/components/schemas/LocalDateTime';
              },
            ];
            description: 'Timestamp of the tag (if no duration) or the start time of the tag (with duration).';
          };
          end_time: {
            anyOf: [
              {
                $ref: '#/components/schemas/LocalDateTime';
              },
              {
                type: 'null';
              },
            ];
            description: "Timestamp of the tag's end for events with duration or `NULL` if there is no duration.";
          };
          start_day: {
            type: 'string';
            format: 'date';
            title: 'Start Day';
            description: 'Day of the tag (if no duration) or the start day of the tag (with duration).';
          };
          end_day: {
            anyOf: [
              {
                type: 'string';
                format: 'date';
              },
              {
                type: 'null';
              },
            ];
            title: 'End Day';
            description: "Day of the tag's end for events with duration or `NULL` if there is no duration.";
          };
          comment: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Comment';
            description: 'Additional freeform text on the tag.';
          };
          custom_name: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Custom Name';
            description: 'The name of the tag if the tag_type_code is `custom`.';
          };
        };
        type: 'object';
        required: ['id', 'start_time', 'start_day'];
        title: 'EnhancedTagModel';
        description: 'An EnhancedTagModel maps an ASSATag. An ASSATag in ExtAPIV2 is called a EnhancedTag\nAn EnhancedTagModel will be populated by data from an ASSATag\nThe fields in the EnhancedTagModel map to fields in an ASSATag';
      };
      ExtApiV2DataType: {
        type: 'string';
        enum: [
          'tag',
          'enhanced_tag',
          'workout',
          'session',
          'sleep',
          'daily_sleep',
          'daily_readiness',
          'daily_activity',
          'daily_spo2',
          'sleep_time',
          'rest_mode_period',
          'ring_configuration',
          'daily_stress',
          'daily_cycle_phases',
        ];
        title: 'ExtApiV2DataType';
      };
      HTTPValidationError: {
        properties: {
          detail: {
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
            type: 'array';
            title: 'Detail';
          };
        };
        type: 'object';
        title: 'HTTPValidationError';
      };
      HeartRateModel: {
        properties: {
          bpm: {
            type: 'integer';
            title: 'Bpm';
          };
          source: {
            $ref: '#/components/schemas/HeartRateSource';
          };
          timestamp: {
            $ref: '#/components/schemas/LocalDateTime';
          };
        };
        type: 'object';
        required: ['bpm', 'source', 'timestamp'];
        title: 'HeartRateModel';
      };
      HeartRateSource: {
        type: 'string';
        enum: ['awake', 'rest', 'sleep', 'session', 'live', 'workout'];
        title: 'HeartRateSource';
      };
      LocalDateTime: {
        type: 'string';
        title: 'LocalDateTime';
      };
      LocalDateTimeWithMilliseconds: {
        type: 'string';
        title: 'LocalDateTimeWithMilliseconds';
      };
      LocalizedDateTime: {
        type: 'string';
        title: 'LocalizedDateTime';
        description: 'ISO 8601 date-time that requires timezone and milliseconds';
      };
      LongTermResilienceLevel: {
        type: 'string';
        enum: ['limited', 'adequate', 'solid', 'strong', 'exceptional'];
        title: 'LongTermResilienceLevel';
        description: 'Possible long term resilience level values.';
      };
      MomentMood: {
        type: 'string';
        enum: ['bad', 'worse', 'same', 'good', 'great'];
        title: 'MomentMood';
        description: 'Possible Moment moods.';
      };
      MomentType: {
        type: 'string';
        enum: ['breathing', 'meditation', 'nap', 'relaxation', 'rest', 'body_status'];
        title: 'MomentType';
        description: 'Possible Moment types.';
      };
      MultiDocumentResponse_DailyActivityModel_: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/DailyActivityModel';
            };
            type: 'array';
            title: 'Data';
          };
          next_token: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Token';
          };
        };
        type: 'object';
        required: ['data', 'next_token'];
        title: 'MultiDocumentResponse[DailyActivityModel]';
      };
      MultiDocumentResponse_DailyCardiovascularAgeModel_: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/DailyCardiovascularAgeModel';
            };
            type: 'array';
            title: 'Data';
          };
          next_token: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Token';
          };
        };
        type: 'object';
        required: ['data', 'next_token'];
        title: 'MultiDocumentResponse[DailyCardiovascularAgeModel]';
      };
      MultiDocumentResponse_DailyReadinessModel_: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/DailyReadinessModel';
            };
            type: 'array';
            title: 'Data';
          };
          next_token: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Token';
          };
        };
        type: 'object';
        required: ['data', 'next_token'];
        title: 'MultiDocumentResponse[DailyReadinessModel]';
      };
      MultiDocumentResponse_DailyResilienceModel_: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/DailyResilienceModel';
            };
            type: 'array';
            title: 'Data';
          };
          next_token: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Token';
          };
        };
        type: 'object';
        required: ['data', 'next_token'];
        title: 'MultiDocumentResponse[DailyResilienceModel]';
      };
      MultiDocumentResponse_DailySleepModel_: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/DailySleepModel';
            };
            type: 'array';
            title: 'Data';
          };
          next_token: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Token';
          };
        };
        type: 'object';
        required: ['data', 'next_token'];
        title: 'MultiDocumentResponse[DailySleepModel]';
      };
      MultiDocumentResponse_DailySpO2Model_: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/DailySpO2Model';
            };
            type: 'array';
            title: 'Data';
          };
          next_token: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Token';
          };
        };
        type: 'object';
        required: ['data', 'next_token'];
        title: 'MultiDocumentResponse[DailySpO2Model]';
      };
      MultiDocumentResponse_DailyStressModel_: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/DailyStressModel';
            };
            type: 'array';
            title: 'Data';
          };
          next_token: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Token';
          };
        };
        type: 'object';
        required: ['data', 'next_token'];
        title: 'MultiDocumentResponse[DailyStressModel]';
      };
      MultiDocumentResponse_EnhancedTagModel_: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/EnhancedTagModel';
            };
            type: 'array';
            title: 'Data';
          };
          next_token: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Token';
          };
        };
        type: 'object';
        required: ['data', 'next_token'];
        title: 'MultiDocumentResponse[EnhancedTagModel]';
      };
      MultiDocumentResponse_RestModePeriodModel_: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/RestModePeriodModel';
            };
            type: 'array';
            title: 'Data';
          };
          next_token: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Token';
          };
        };
        type: 'object';
        required: ['data', 'next_token'];
        title: 'MultiDocumentResponse[RestModePeriodModel]';
      };
      MultiDocumentResponse_RingConfigurationModel_: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/RingConfigurationModel';
            };
            type: 'array';
            title: 'Data';
          };
          next_token: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Token';
          };
        };
        type: 'object';
        required: ['data', 'next_token'];
        title: 'MultiDocumentResponse[RingConfigurationModel]';
      };
      MultiDocumentResponse_SessionModel_: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/SessionModel';
            };
            type: 'array';
            title: 'Data';
          };
          next_token: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Token';
          };
        };
        type: 'object';
        required: ['data', 'next_token'];
        title: 'MultiDocumentResponse[SessionModel]';
      };
      MultiDocumentResponse_SleepModel_: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/SleepModel';
            };
            type: 'array';
            title: 'Data';
          };
          next_token: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Token';
          };
        };
        type: 'object';
        required: ['data', 'next_token'];
        title: 'MultiDocumentResponse[SleepModel]';
      };
      MultiDocumentResponse_SleepTimeModel_: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/SleepTimeModel';
            };
            type: 'array';
            title: 'Data';
          };
          next_token: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Token';
          };
        };
        type: 'object';
        required: ['data', 'next_token'];
        title: 'MultiDocumentResponse[SleepTimeModel]';
      };
      MultiDocumentResponse_TagModel_: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/TagModel';
            };
            type: 'array';
            title: 'Data';
          };
          next_token: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Token';
          };
        };
        type: 'object';
        required: ['data', 'next_token'];
        title: 'MultiDocumentResponse[TagModel]';
      };
      MultiDocumentResponse_VO2MaxModel_: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/VO2MaxModel';
            };
            type: 'array';
            title: 'Data';
          };
          next_token: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Token';
          };
        };
        type: 'object';
        required: ['data', 'next_token'];
        title: 'MultiDocumentResponse[VO2MaxModel]';
      };
      MultiDocumentResponse_WorkoutModel_: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/WorkoutModel';
            };
            type: 'array';
            title: 'Data';
          };
          next_token: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Token';
          };
        };
        type: 'object';
        required: ['data', 'next_token'];
        title: 'MultiDocumentResponse[WorkoutModel]';
      };
      PersonalInfoResponse: {
        properties: {
          id: {
            type: 'string';
            title: 'Id';
          };
          age: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Age';
          };
          weight: {
            anyOf: [
              {
                type: 'number';
              },
              {
                type: 'null';
              },
            ];
            title: 'Weight';
          };
          height: {
            anyOf: [
              {
                type: 'number';
              },
              {
                type: 'null';
              },
            ];
            title: 'Height';
          };
          biological_sex: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Biological Sex';
          };
          email: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Email';
          };
        };
        type: 'object';
        required: ['id'];
        title: 'PersonalInfoResponse';
      };
      ReadinessContributors: {
        properties: {
          activity_balance: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Activity Balance';
            description: 'Contribution of cumulative activity balance in range [1, 100].';
          };
          body_temperature: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Body Temperature';
            description: 'Contribution of body temperature in range [1, 100].';
          };
          hrv_balance: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Hrv Balance';
            description: 'Contribution of heart rate variability balance in range [1, 100].';
          };
          previous_day_activity: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Previous Day Activity';
            description: "Contribution of previous day's activity in range [1, 100].";
          };
          previous_night: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Previous Night';
            description: "Contribution of previous night's sleep in range [1, 100].";
          };
          recovery_index: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Recovery Index';
            description: 'Contribution of recovery index in range [1, 100].';
          };
          resting_heart_rate: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Resting Heart Rate';
            description: 'Contribution of resting heart rate in range [1, 100].';
          };
          sleep_balance: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Sleep Balance';
            description: 'Contribution of sleep balance in range [1, 100].';
          };
        };
        type: 'object';
        required: [
          'activity_balance',
          'body_temperature',
          'hrv_balance',
          'previous_day_activity',
          'previous_night',
          'recovery_index',
          'resting_heart_rate',
          'sleep_balance',
        ];
        title: 'ReadinessContributors';
        description: 'Object defining readiness score contributors.';
      };
      ReadinessSummary: {
        properties: {
          contributors: {
            $ref: '#/components/schemas/ReadinessContributors';
          };
          score: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Score';
          };
          temperature_deviation: {
            anyOf: [
              {
                type: 'number';
              },
              {
                type: 'null';
              },
            ];
            title: 'Temperature Deviation';
          };
          temperature_trend_deviation: {
            anyOf: [
              {
                type: 'number';
              },
              {
                type: 'null';
              },
            ];
            title: 'Temperature Trend Deviation';
          };
        };
        type: 'object';
        required: ['contributors'];
        title: 'ReadinessSummary';
      };
      ResilienceContributors: {
        properties: {
          sleep_recovery: {
            type: 'number';
            title: 'Sleep Recovery';
            description: 'Sleep recovery contributor to the resilience score. Range: [0, 100]';
          };
          daytime_recovery: {
            type: 'number';
            title: 'Daytime Recovery';
            description: 'Daytime recovery contributor to the resilience score. Range: [0, 100]';
          };
          stress: {
            type: 'number';
            title: 'Stress';
            description: 'Stress contributor to the resilience score. Range: [0, 100]';
          };
        };
        type: 'object';
        required: ['sleep_recovery', 'daytime_recovery', 'stress'];
        title: 'ResilienceContributors';
      };
      RestModeEpisode: {
        properties: {
          tags: {
            items: {
              type: 'string';
            };
            type: 'array';
            title: '';
            description: 'Tags selected for the episode.';
          };
          timestamp: {
            allOf: [
              {
                $ref: '#/components/schemas/LocalizedDateTime';
              },
            ];
            title: '';
            description: 'Timestamp indicating when the episode occurred.';
          };
        };
        type: 'object';
        required: ['tags', 'timestamp'];
        title: 'RestModeEpisode';
        description: 'Object defining a Rest Mode episode.';
      };
      RestModePeriodModel: {
        properties: {
          id: {
            type: 'string';
            title: 'Id';
          };
          end_day: {
            anyOf: [
              {
                type: 'string';
                format: 'date';
              },
              {
                type: 'null';
              },
            ];
            title: 'End Day';
            description: 'End date of rest mode.';
          };
          end_time: {
            anyOf: [
              {
                $ref: '#/components/schemas/LocalDateTime';
              },
              {
                type: 'null';
              },
            ];
            description: 'Timestamp when rest mode ended.';
          };
          episodes: {
            items: {
              $ref: '#/components/schemas/RestModeEpisode';
            };
            type: 'array';
            title: 'Episodes';
            description: 'Collection of episodes during rest mode, consisting of tags.';
          };
          start_day: {
            type: 'string';
            format: 'date';
            title: 'Start Day';
            description: 'Start date of rest mode.';
          };
          start_time: {
            anyOf: [
              {
                $ref: '#/components/schemas/LocalDateTime';
              },
              {
                type: 'null';
              },
            ];
            description: 'Timestamp when rest mode started.';
          };
        };
        type: 'object';
        required: ['id', 'episodes', 'start_day', 'start_time'];
        title: 'RestModePeriodModel';
        description: 'Object contains information about rest mode episode.';
      };
      RingColor: {
        type: 'string';
        enum: [
          'brushed_silver',
          'glossy_black',
          'glossy_gold',
          'glossy_white',
          'gucci',
          'matt_gold',
          'rose',
          'silver',
          'stealth_black',
          'titanium',
          'titanium_and_gold',
        ];
        title: 'RingColor';
      };
      RingConfigurationModel: {
        properties: {
          id: {
            type: 'string';
            title: 'Id';
          };
          color: {
            anyOf: [
              {
                $ref: '#/components/schemas/RingColor';
              },
              {
                type: 'null';
              },
            ];
            description: 'Color of the ring.';
          };
          design: {
            anyOf: [
              {
                $ref: '#/components/schemas/RingDesign';
              },
              {
                type: 'null';
              },
            ];
            description: 'Design of the ring.';
          };
          firmware_version: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Firmware Version';
            description: 'Firmware version of the ring.';
          };
          hardware_type: {
            anyOf: [
              {
                $ref: '#/components/schemas/RingHardwareType';
              },
              {
                type: 'null';
              },
            ];
            description: 'Hardware type of the ring.';
          };
          set_up_at: {
            anyOf: [
              {
                $ref: '#/components/schemas/LocalDateTime';
              },
              {
                type: 'null';
              },
            ];
            description: 'UTC timestamp indicating when the ring was set up.';
          };
          size: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Size';
            description: 'US size of the ring.';
          };
        };
        type: 'object';
        required: ['id'];
        title: 'RingConfigurationModel';
      };
      RingDesign: {
        type: 'string';
        enum: ['balance', 'balance_diamond', 'heritage', 'horizon'];
        title: 'RingDesign';
      };
      RingHardwareType: {
        type: 'string';
        enum: ['gen1', 'gen2', 'gen2m', 'gen3'];
        title: 'RingHardwareType';
      };
      SampleModel: {
        properties: {
          interval: {
            type: 'number';
            title: 'Interval';
            description: 'Interval in seconds between the sampled items.';
          };
          items: {
            items: {
              anyOf: [
                {
                  type: 'number';
                },
                {
                  type: 'null';
                },
              ];
            };
            type: 'array';
            title: 'Items';
            description: 'Recorded sample items.';
          };
          timestamp: {
            allOf: [
              {
                $ref: '#/components/schemas/LocalDateTimeWithMilliseconds';
              },
            ];
            description: 'Timestamp when the sample recording started.';
          };
        };
        type: 'object';
        required: ['interval', 'items', 'timestamp'];
        title: 'SampleModel';
      };
      SessionModel: {
        properties: {
          id: {
            type: 'string';
            title: 'Id';
          };
          day: {
            type: 'string';
            format: 'date';
            title: 'Day';
            description: 'The date when the session occurred.';
          };
          start_datetime: {
            allOf: [
              {
                $ref: '#/components/schemas/LocalDateTime';
              },
            ];
            description: 'Timestamp indicating when the Moment ended.';
          };
          end_datetime: {
            allOf: [
              {
                $ref: '#/components/schemas/LocalDateTime';
              },
            ];
            description: 'Timestamp indicating when the Moment ended.';
          };
          type: {
            $ref: '#/components/schemas/MomentType';
          };
          heart_rate: {
            anyOf: [
              {
                $ref: '#/components/schemas/SampleModel';
              },
              {
                type: 'null';
              },
            ];
          };
          heart_rate_variability: {
            anyOf: [
              {
                $ref: '#/components/schemas/SampleModel';
              },
              {
                type: 'null';
              },
            ];
          };
          mood: {
            anyOf: [
              {
                $ref: '#/components/schemas/MomentMood';
              },
              {
                type: 'null';
              },
            ];
          };
          motion_count: {
            anyOf: [
              {
                $ref: '#/components/schemas/SampleModel';
              },
              {
                type: 'null';
              },
            ];
          };
        };
        type: 'object';
        required: ['id', 'day', 'start_datetime', 'end_datetime', 'type'];
        title: 'SessionModel';
      };
      SleepAlgorithmVersion: {
        type: 'string';
        enum: ['v1', 'v2'];
        title: 'SleepAlgorithmVersion';
      };
      SleepContributors: {
        properties: {
          deep_sleep: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: '';
            description: 'Contribution of deep sleep in range [1, 100].';
          };
          efficiency: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: '';
            description: 'Contribution of sleep efficiency in range [1, 100].';
          };
          latency: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: '';
            description: 'Contribution of sleep latency in range [1, 100].';
          };
          rem_sleep: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: '';
            description: 'Contribution of REM sleep in range [1, 100].';
          };
          restfulness: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: '';
            description: 'Contribution of sleep restfulness in range [1, 100].';
          };
          timing: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: '';
            description: 'Contribution of sleep timing in range [1, 100].';
          };
          total_sleep: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: '';
            description: 'Contribution of total sleep in range [1, 100].';
          };
        };
        type: 'object';
        title: 'SleepContributors';
        description: 'Object defining sleep score contributors.';
      };
      SleepModel: {
        properties: {
          id: {
            type: 'string';
            title: 'Id';
          };
          average_breath: {
            anyOf: [
              {
                type: 'number';
              },
              {
                type: 'null';
              },
            ];
            title: 'Average Breath';
            description: 'Average breathing rate during sleep as breaths/second.';
          };
          average_heart_rate: {
            anyOf: [
              {
                type: 'number';
              },
              {
                type: 'null';
              },
            ];
            title: 'Average Heart Rate';
            description: 'Average heart rate during sleep as beats/minute.';
          };
          average_hrv: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Average Hrv';
            description: 'Average heart rate variability during sleep.';
          };
          awake_time: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Awake Time';
            description: 'Duration spent awake in seconds.';
          };
          bedtime_end: {
            allOf: [
              {
                $ref: '#/components/schemas/LocalDateTime';
              },
            ];
            description: 'Bedtime end of the sleep.';
          };
          bedtime_start: {
            allOf: [
              {
                $ref: '#/components/schemas/LocalDateTime';
              },
            ];
            description: 'Bedtime start of the sleep.';
          };
          day: {
            type: 'string';
            format: 'date';
            title: 'Day';
            description: 'Day that the sleep belongs to.';
          };
          deep_sleep_duration: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Deep Sleep Duration';
            description: 'Duration spent in deep sleep in seconds.';
          };
          efficiency: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Efficiency';
            description: 'Sleep efficiency rating in range [1, 100].';
          };
          heart_rate: {
            anyOf: [
              {
                $ref: '#/components/schemas/SampleModel';
              },
              {
                type: 'null';
              },
            ];
            description: 'Object containing heart rate samples.';
          };
          hrv: {
            anyOf: [
              {
                $ref: '#/components/schemas/SampleModel';
              },
              {
                type: 'null';
              },
            ];
          };
          latency: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Latency';
            description: 'Sleep latency in seconds. This is the time it took for the user to fall asleep after going to bed.';
          };
          light_sleep_duration: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Light Sleep Duration';
            description: 'Duration spent in light sleep in seconds.';
          };
          low_battery_alert: {
            type: 'boolean';
            title: 'Low Battery Alert';
            description: 'Flag indicating if a low battery alert occurred.';
          };
          lowest_heart_rate: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Lowest Heart Rate';
            description: 'Lowest heart rate during sleep.';
          };
          movement_30_sec: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Movement 30 Sec';
            description: "\n        30-second movement classification for the period where every character corresponds to:\n        '1' = no motion,\n        '2' = restless,\n        '3' = tossing and turning\n        '4' = active\n        ";
            examples: ['1143222134'];
          };
          period: {
            type: 'integer';
            title: 'Period';
            description: 'ECore sleep period identifier.';
          };
          readiness: {
            anyOf: [
              {
                $ref: '#/components/schemas/ReadinessSummary';
              },
              {
                type: 'null';
              },
            ];
            description: 'Object containing the readiness details for this sleep. As opposed to the daily readiness object which represents the readiness for the entire day.';
          };
          readiness_score_delta: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Readiness Score Delta';
            description: 'Effect on readiness score caused by this sleep period.';
          };
          rem_sleep_duration: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Rem Sleep Duration';
            description: 'Duration spent in REM sleep in seconds.';
          };
          restless_periods: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Restless Periods';
            description: 'Number of restless periods during sleep.';
          };
          sleep_phase_5_min: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Sleep Phase 5 Min';
            description: "\n        5-minute sleep phase classification for the period where every character corresponds to:\n        '1' = deep sleep,\n        '2' = light sleep,\n        '3' = REM sleep\n        '4' = awake.\n        ";
            examples: ['444423323441114'];
          };
          sleep_score_delta: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Sleep Score Delta';
            description: 'Effect on sleep score caused by this sleep period.';
          };
          sleep_algorithm_version: {
            anyOf: [
              {
                $ref: '#/components/schemas/SleepAlgorithmVersion';
              },
              {
                type: 'null';
              },
            ];
            description: 'Version of the sleep algorithm used to calculate the sleep data.';
          };
          time_in_bed: {
            type: 'integer';
            title: 'Time In Bed';
            description: 'Duration spent in bed in seconds.';
          };
          total_sleep_duration: {
            anyOf: [
              {
                type: 'integer';
              },
              {
                type: 'null';
              },
            ];
            title: 'Total Sleep Duration';
            description: 'Total sleep duration in seconds.';
          };
          type: {
            $ref: '#/components/schemas/SleepType';
          };
        };
        type: 'object';
        required: [
          'id',
          'average_breath',
          'average_heart_rate',
          'average_hrv',
          'awake_time',
          'bedtime_end',
          'bedtime_start',
          'day',
          'deep_sleep_duration',
          'efficiency',
          'heart_rate',
          'hrv',
          'latency',
          'light_sleep_duration',
          'low_battery_alert',
          'lowest_heart_rate',
          'movement_30_sec',
          'period',
          'readiness',
          'readiness_score_delta',
          'rem_sleep_duration',
          'restless_periods',
          'sleep_phase_5_min',
          'sleep_score_delta',
          'sleep_algorithm_version',
          'time_in_bed',
          'total_sleep_duration',
          'type',
        ];
        title: 'SleepModel';
      };
      SleepTimeModel: {
        properties: {
          id: {
            type: 'string';
            title: 'Id';
          };
          day: {
            type: 'string';
            format: 'date';
            title: 'Day';
            description: 'Corresponding day for the sleep time.';
          };
          optimal_bedtime: {
            anyOf: [
              {
                $ref: '#/components/schemas/SleepTimeWindow';
              },
              {
                type: 'null';
              },
            ];
            description: 'Optimal bedtime.';
          };
          recommendation: {
            anyOf: [
              {
                $ref: '#/components/schemas/SleepTimeRecommendation';
              },
              {
                type: 'null';
              },
            ];
            description: 'Recommended action for bedtime.';
          };
          status: {
            anyOf: [
              {
                $ref: '#/components/schemas/SleepTimeStatus';
              },
              {
                type: 'null';
              },
            ];
            description: 'Sleep time status; used to inform sleep time recommendation.';
          };
        };
        type: 'object';
        required: ['id', 'day'];
        title: 'SleepTimeModel';
        description: 'Object contains suggested bedtime for the user.';
      };
      SleepTimeRecommendation: {
        type: 'string';
        enum: [
          'improve_efficiency',
          'earlier_bedtime',
          'later_bedtime',
          'earlier_wake_up_time',
          'later_wake_up_time',
          'follow_optimal_bedtime',
        ];
        title: 'SleepTimeRecommendation';
        description: 'Possible SleepTime recommendation.';
      };
      SleepTimeStatus: {
        type: 'string';
        enum: [
          'not_enough_nights',
          'not_enough_recent_nights',
          'bad_sleep_quality',
          'only_recommended_found',
          'optimal_found',
        ];
        title: 'SleepTimeStatus';
        description: 'Possible SleepTime status.';
      };
      SleepTimeWindow: {
        properties: {
          day_tz: {
            type: 'integer';
            title: '';
            description: 'Timezone offset in second from GMT of the day';
          };
          end_offset: {
            type: 'integer';
            title: '';
            description: 'End offset from midnight in second';
          };
          start_offset: {
            type: 'integer';
            title: '';
            description: 'Start offset from midnight in second';
          };
        };
        type: 'object';
        required: ['day_tz', 'end_offset', 'start_offset'];
        title: 'SleepTimeWindow';
        description: 'Object defining sleep time window';
      };
      SleepType: {
        type: 'string';
        enum: ['deleted', 'sleep', 'long_sleep', 'late_nap', 'rest'];
        title: 'SleepType';
        description: "Possible sleep period types.\n'deleted' = deleted sleep by user.\n'sleep' = user confirmed sleep / nap, min 15 minutes, max 3 hours, contributes to daily scores\n'late_nap' = user confirmed sleep / nap, min 15 minutes, ended after sleep day change (6 pm), contributes to next days daily scores\n'long_sleep' = sleep that is long enough (>3h) to automatically contribute to daily scores\n'rest' = Falsely detected sleep / nap, rejected in confirm prompt by user";
      };
      TagModel: {
        properties: {
          id: {
            type: 'string';
            title: 'Id';
          };
          day: {
            type: 'string';
            format: 'date';
            title: 'Day';
            description: 'Day that the note belongs to.';
          };
          text: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Text';
            description: 'Textual contents of the note.';
          };
          timestamp: {
            type: 'string';
            format: 'date-time';
            title: 'Timestamp';
            description: 'Timestamp of the note.';
          };
          tags: {
            items: {
              type: 'string';
            };
            type: 'array';
            title: 'Tags';
            description: 'Selected tags for the tag.';
          };
        };
        type: 'object';
        required: ['id', 'day', 'text', 'timestamp', 'tags'];
        title: 'TagModel';
        description: 'A TagModel maps to an ASSANote. An ASSANote in ExtAPIV2 is called a Tag\nA TagModel will be populated by data from an ASSANote\nThe fields in the TagModel map to fields in an ASSANote';
      };
      TimeSeriesResponse_HeartRateModel_: {
        properties: {
          data: {
            items: {
              $ref: '#/components/schemas/HeartRateModel';
            };
            type: 'array';
            title: 'Data';
          };
          next_token: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Next Token';
          };
        };
        type: 'object';
        required: ['data'];
        title: 'TimeSeriesResponse[HeartRateModel]';
      };
      UpdateWebhookSubscriptionRequest: {
        properties: {
          verification_token: {
            type: 'string';
            title: 'Verification Token';
          };
          callback_url: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Callback Url';
          };
          event_type: {
            anyOf: [
              {
                $ref: '#/components/schemas/WebhookOperation';
              },
              {
                type: 'null';
              },
            ];
          };
          data_type: {
            anyOf: [
              {
                $ref: '#/components/schemas/ExtApiV2DataType';
              },
              {
                type: 'null';
              },
            ];
          };
        };
        type: 'object';
        required: ['verification_token'];
        title: 'UpdateWebhookSubscriptionRequest';
      };
      VO2MaxModel: {
        properties: {
          id: {
            type: 'string';
            title: 'Id';
          };
          day: {
            type: 'string';
            format: 'date';
            title: 'Day';
            description: 'Day that the estimate belongs to.';
          };
          timestamp: {
            allOf: [
              {
                $ref: '#/components/schemas/LocalDateTime';
              },
            ];
            description: 'Timestamp indicating when the estimate was created.';
          };
          vo2_max: {
            anyOf: [
              {
                type: 'number';
              },
              {
                type: 'null';
              },
            ];
            title: 'Vo2 Max';
            description: 'VO2 max value.';
          };
        };
        type: 'object';
        required: ['id', 'day', 'timestamp', 'vo2_max'];
        title: 'VO2MaxModel';
      };
      ValidationError: {
        properties: {
          loc: {
            items: {
              anyOf: [
                {
                  type: 'string';
                },
                {
                  type: 'integer';
                },
              ];
            };
            type: 'array';
            title: 'Location';
          };
          msg: {
            type: 'string';
            title: 'Message';
          };
          type: {
            type: 'string';
            title: 'Error Type';
          };
        };
        type: 'object';
        required: ['loc', 'msg', 'type'];
        title: 'ValidationError';
      };
      WebhookOperation: {
        type: 'string';
        enum: ['create', 'update', 'delete'];
        title: 'WebhookOperation';
      };
      WebhookSubscriptionModel: {
        properties: {
          id: {
            type: 'string';
            format: 'uuid4';
            title: 'Id';
          };
          callback_url: {
            type: 'string';
            title: 'Callback Url';
          };
          event_type: {
            $ref: '#/components/schemas/WebhookOperation';
          };
          data_type: {
            $ref: '#/components/schemas/ExtApiV2DataType';
          };
          expiration_time: {
            type: 'string';
            format: 'date-time';
            title: 'Expiration Time';
          };
        };
        type: 'object';
        required: ['id', 'callback_url', 'event_type', 'data_type', 'expiration_time'];
        title: 'WebhookSubscriptionModel';
      };
      WorkoutIntensity: {
        type: 'string';
        enum: ['easy', 'moderate', 'hard'];
        title: 'WorkoutIntensity';
        description: 'Possible workout intensities.';
      };
      WorkoutModel: {
        properties: {
          id: {
            type: 'string';
            title: 'Id';
          };
          activity: {
            type: 'string';
            title: 'Activity';
            description: 'Type of the workout activity.';
          };
          calories: {
            anyOf: [
              {
                type: 'number';
              },
              {
                type: 'null';
              },
            ];
            title: 'Calories';
            description: 'Energy burned in kilocalories during the workout.';
          };
          day: {
            type: 'string';
            format: 'date';
            title: 'Day';
            description: 'Day when the workout occurred.';
          };
          distance: {
            anyOf: [
              {
                type: 'number';
              },
              {
                type: 'null';
              },
            ];
            title: 'Distance';
            description: 'Distance traveled in meters during the workout.';
          };
          end_datetime: {
            allOf: [
              {
                $ref: '#/components/schemas/LocalDateTime';
              },
            ];
            description: 'Timestamp indicating when the workout ended.';
          };
          intensity: {
            $ref: '#/components/schemas/WorkoutIntensity';
          };
          label: {
            anyOf: [
              {
                type: 'string';
              },
              {
                type: 'null';
              },
            ];
            title: 'Label';
            description: 'User-defined label for the workout.';
          };
          source: {
            allOf: [
              {
                $ref: '#/components/schemas/WorkoutSource';
              },
            ];
            description: 'Possible workout sources.';
          };
          start_datetime: {
            allOf: [
              {
                $ref: '#/components/schemas/LocalDateTime';
              },
            ];
            description: 'Timestamp indicating when the workout started.';
          };
        };
        type: 'object';
        required: [
          'id',
          'activity',
          'calories',
          'day',
          'distance',
          'end_datetime',
          'intensity',
          'label',
          'source',
          'start_datetime',
        ];
        title: 'WorkoutModel';
      };
      WorkoutSource: {
        type: 'string';
        enum: ['autodetected', 'confirmed', 'manual', 'workout_heart_rate'];
        title: 'WorkoutSource';
      };
    };
  };
};
