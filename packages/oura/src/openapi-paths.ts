// @ts-nocheck
export type TPaths = {
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
export const paths = {
  '/v2/usercollection/personal_info': {
    get: {
      tags: ['Personal Info Routes'],
      summary: 'Single Personal Info Document',
      operationId: 'Single_Personal_Info_Document_v2_usercollection_personal_info_get',
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PersonalInfoResponse',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/personal_info' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/personal_info' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/personal_info', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/personal_info") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/tag': {
    get: {
      tags: ['Tag Routes'],
      summary: 'Multiple Tag Documents',
      operationId: 'Multiple_tag_Documents_v2_usercollection_tag_get',
      deprecated: true,
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_TagModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/tag?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/tag' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/tag?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/tag?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/tag': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Multiple Tag Documents',
      operationId: 'Sandbox___Multiple_tag_Documents_v2_sandbox_usercollection_tag_get',
      deprecated: true,
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_TagModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/tag?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/tag' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/tag?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/tag?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/enhanced_tag': {
    get: {
      tags: ['Enhanced Tag Routes'],
      summary: 'Multiple Enhanced Tag Documents',
      operationId: 'Multiple_enhanced_tag_Documents_v2_usercollection_enhanced_tag_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_EnhancedTagModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/enhanced_tag?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/enhanced_tag' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/enhanced_tag?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/enhanced_tag?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/enhanced_tag': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Multiple Enhanced Tag Documents',
      operationId: 'Sandbox___Multiple_enhanced_tag_Documents_v2_sandbox_usercollection_enhanced_tag_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_EnhancedTagModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/enhanced_tag?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/enhanced_tag' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/enhanced_tag?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/enhanced_tag?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/workout': {
    get: {
      tags: ['Workout Routes'],
      summary: 'Multiple Workout Documents',
      operationId: 'Multiple_workout_Documents_v2_usercollection_workout_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_WorkoutModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/workout?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/workout' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/workout?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/workout?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/workout': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Multiple Workout Documents',
      operationId: 'Sandbox___Multiple_workout_Documents_v2_sandbox_usercollection_workout_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_WorkoutModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/workout?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/workout' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/workout?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/workout?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/session': {
    get: {
      tags: ['Session Routes'],
      summary: 'Multiple Session Documents',
      operationId: 'Multiple_session_Documents_v2_usercollection_session_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_SessionModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/session?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/session' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/session?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/session?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/session': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Multiple Session Documents',
      operationId: 'Sandbox___Multiple_session_Documents_v2_sandbox_usercollection_session_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_SessionModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/session?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/session' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/session?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/session?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/daily_activity': {
    get: {
      tags: ['Daily Activity Routes'],
      summary: 'Multiple Daily Activity Documents',
      operationId: 'Multiple_daily_activity_Documents_v2_usercollection_daily_activity_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_DailyActivityModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_activity?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_activity' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_activity?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_activity?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/daily_activity': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Multiple Daily Activity Documents',
      operationId: 'Sandbox___Multiple_daily_activity_Documents_v2_sandbox_usercollection_daily_activity_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_DailyActivityModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_activity?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_activity' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_activity?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_activity?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/daily_sleep': {
    get: {
      tags: ['Daily Sleep Routes'],
      summary: 'Multiple Daily Sleep Documents',
      operationId: 'Multiple_daily_sleep_Documents_v2_usercollection_daily_sleep_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_DailySleepModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_sleep' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/daily_sleep': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Multiple Daily Sleep Documents',
      operationId: 'Sandbox___Multiple_daily_sleep_Documents_v2_sandbox_usercollection_daily_sleep_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_DailySleepModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_sleep?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_sleep' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_sleep?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_sleep?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/daily_spo2': {
    get: {
      tags: ['Daily Spo2 Routes'],
      summary: 'Multiple Daily Spo2 Documents',
      operationId: 'Multiple_daily_spo2_Documents_v2_usercollection_daily_spo2_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_DailySpO2Model_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_spo2?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_spo2' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_spo2?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_spo2?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/daily_spo2': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Multiple Daily Spo2 Documents',
      operationId: 'Sandbox___Multiple_daily_spo2_Documents_v2_sandbox_usercollection_daily_spo2_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_DailySpO2Model_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_spo2?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_spo2' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_spo2?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_spo2?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/daily_readiness': {
    get: {
      tags: ['Daily Readiness Routes'],
      summary: 'Multiple Daily Readiness Documents',
      operationId: 'Multiple_daily_readiness_Documents_v2_usercollection_daily_readiness_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_DailyReadinessModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_readiness' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/daily_readiness': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Multiple Daily Readiness Documents',
      operationId: 'Sandbox___Multiple_daily_readiness_Documents_v2_sandbox_usercollection_daily_readiness_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_DailyReadinessModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_readiness?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_readiness' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_readiness?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_readiness?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/sleep': {
    get: {
      tags: ['Sleep Routes'],
      summary: 'Multiple Sleep Documents',
      operationId: 'Multiple_sleep_Documents_v2_usercollection_sleep_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_SleepModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/sleep?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/sleep' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/sleep?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/sleep?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/sleep': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Multiple Sleep Documents',
      operationId: 'Sandbox___Multiple_sleep_Documents_v2_sandbox_usercollection_sleep_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_SleepModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/sleep?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/sleep' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/sleep?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/sleep?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/sleep_time': {
    get: {
      tags: ['Sleep Time Routes'],
      summary: 'Multiple Sleep Time Documents',
      operationId: 'Multiple_sleep_time_Documents_v2_usercollection_sleep_time_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_SleepTimeModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/sleep_time?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/sleep_time' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/sleep_time?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/sleep_time?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/sleep_time': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Multiple Sleep Time Documents',
      operationId: 'Sandbox___Multiple_sleep_time_Documents_v2_sandbox_usercollection_sleep_time_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_SleepTimeModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/sleep_time?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/sleep_time' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/sleep_time?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/sleep_time?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/rest_mode_period': {
    get: {
      tags: ['Rest Mode Period Routes'],
      summary: 'Multiple Rest Mode Period Documents',
      operationId: 'Multiple_rest_mode_period_Documents_v2_usercollection_rest_mode_period_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_RestModePeriodModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/rest_mode_period?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/rest_mode_period' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/rest_mode_period?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/rest_mode_period?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/rest_mode_period': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Multiple Rest Mode Period Documents',
      operationId: 'Sandbox___Multiple_rest_mode_period_Documents_v2_sandbox_usercollection_rest_mode_period_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_RestModePeriodModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/rest_mode_period?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/rest_mode_period' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/rest_mode_period?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/rest_mode_period?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/ring_configuration': {
    get: {
      tags: ['Ring Configuration Routes'],
      summary: 'Multiple Ring Configuration Documents',
      operationId: 'Multiple_ring_configuration_Documents_v2_usercollection_ring_configuration_get',
      parameters: [
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_RingConfigurationModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/ring_configuration?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/ring_configuration' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/ring_configuration?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/ring_configuration?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/ring_configuration': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Multiple Ring Configuration Documents',
      operationId: 'Sandbox___Multiple_ring_configuration_Documents_v2_sandbox_usercollection_ring_configuration_get',
      parameters: [
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_RingConfigurationModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/ring_configuration?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/ring_configuration' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/ring_configuration?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/ring_configuration?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/daily_stress': {
    get: {
      tags: ['Daily Stress Routes'],
      summary: 'Multiple Daily Stress Documents',
      operationId: 'Multiple_daily_stress_Documents_v2_usercollection_daily_stress_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_DailyStressModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_stress?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_stress' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_stress?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_stress?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/daily_stress': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Multiple Daily Stress Documents',
      operationId: 'Sandbox___Multiple_daily_stress_Documents_v2_sandbox_usercollection_daily_stress_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_DailyStressModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_stress?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_stress' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_stress?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_stress?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/daily_resilience': {
    get: {
      tags: ['Daily Resilience Routes'],
      summary: 'Multiple Daily Resilience Documents',
      operationId: 'Multiple_daily_resilience_Documents_v2_usercollection_daily_resilience_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_DailyResilienceModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_resilience?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_resilience' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_resilience?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_resilience?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/daily_resilience': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Multiple Daily Resilience Documents',
      operationId: 'Sandbox___Multiple_daily_resilience_Documents_v2_sandbox_usercollection_daily_resilience_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_DailyResilienceModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_resilience?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_resilience' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_resilience?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_resilience?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/daily_cardiovascular_age': {
    get: {
      tags: ['Daily Cardiovascular Age Routes'],
      summary: 'Multiple Daily Cardiovascular Age Documents',
      operationId: 'Multiple_daily_cardiovascular_age_Documents_v2_usercollection_daily_cardiovascular_age_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_DailyCardiovascularAgeModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_cardiovascular_age?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_cardiovascular_age' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_cardiovascular_age?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_cardiovascular_age?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/daily_cardiovascular_age': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Multiple Daily Cardiovascular Age Documents',
      operationId:
        'Sandbox___Multiple_daily_cardiovascular_age_Documents_v2_sandbox_usercollection_daily_cardiovascular_age_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_DailyCardiovascularAgeModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_cardiovascular_age?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_cardiovascular_age' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_cardiovascular_age?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_cardiovascular_age?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/vO2_max': {
    get: {
      tags: ['VO2 Max Routes'],
      summary: 'Multiple Vo2 Max Documents',
      operationId: 'Multiple_vO2_max_Documents_v2_usercollection_vO2_max_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_VO2MaxModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/vO2_max?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/vO2_max' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/vO2_max?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/vO2_max?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/vO2_max': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Multiple Vo2 Max Documents',
      operationId: 'Sandbox___Multiple_vO2_max_Documents_v2_sandbox_usercollection_vO2_max_get',
      parameters: [
        {
          name: 'start_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Date',
          },
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'string',
                format: 'date',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Date',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MultiDocumentResponse_VO2MaxModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/vO2_max?start_date=2021-11-01&end_date=2021-12-01' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/vO2_max' \nparams={ \n    'start_date': '2021-11-01', \n    'end_date': '2021-12-01' \n}\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/vO2_max?start_date=2021-11-01&end_date=2021-12-01', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/vO2_max?start_date=2021-11-01&end_date=2021-12-01") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/tag/{document_id}': {
    get: {
      tags: ['Tag Routes'],
      summary: 'Single Tag Document',
      operationId: 'Single_tag_Document_v2_usercollection_tag__document_id__get',
      deprecated: true,
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TagModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/tag/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/tag/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/tag/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/tag/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/tag/{document_id}': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Single Tag Document',
      operationId: 'Sandbox___Single_tag_Document_v2_sandbox_usercollection_tag__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TagModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/tag/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/tag/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/tag/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/tag/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/enhanced_tag/{document_id}': {
    get: {
      tags: ['Enhanced Tag Routes'],
      summary: 'Single Enhanced Tag Document',
      operationId: 'Single_enhanced_tag_Document_v2_usercollection_enhanced_tag__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/EnhancedTagModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/enhanced_tag/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/enhanced_tag/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/enhanced_tag/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/enhanced_tag/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/enhanced_tag/{document_id}': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Single Enhanced Tag Document',
      operationId: 'Sandbox___Single_enhanced_tag_Document_v2_sandbox_usercollection_enhanced_tag__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/EnhancedTagModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/enhanced_tag/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/enhanced_tag/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/enhanced_tag/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/enhanced_tag/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/workout/{document_id}': {
    get: {
      tags: ['Workout Routes'],
      summary: 'Single Workout Document',
      operationId: 'Single_workout_Document_v2_usercollection_workout__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WorkoutModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/workout/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/workout/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/workout/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/workout/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/workout/{document_id}': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Single Workout Document',
      operationId: 'Sandbox___Single_workout_Document_v2_sandbox_usercollection_workout__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WorkoutModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/workout/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/workout/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/workout/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/workout/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/session/{document_id}': {
    get: {
      tags: ['Session Routes'],
      summary: 'Single Session Document',
      operationId: 'Single_session_Document_v2_usercollection_session__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SessionModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/session/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/session/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/session/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/session/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/session/{document_id}': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Single Session Document',
      operationId: 'Sandbox___Single_session_Document_v2_sandbox_usercollection_session__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SessionModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/session/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/session/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/session/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/session/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/daily_activity/{document_id}': {
    get: {
      tags: ['Daily Activity Routes'],
      summary: 'Single Daily Activity Document',
      operationId: 'Single_daily_activity_Document_v2_usercollection_daily_activity__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DailyActivityModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_activity/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_activity/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_activity/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_activity/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/daily_activity/{document_id}': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Single Daily Activity Document',
      operationId:
        'Sandbox___Single_daily_activity_Document_v2_sandbox_usercollection_daily_activity__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DailyActivityModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_activity/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_activity/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_activity/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_activity/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/daily_sleep/{document_id}': {
    get: {
      tags: ['Daily Sleep Routes'],
      summary: 'Single Daily Sleep Document',
      operationId: 'Single_daily_sleep_Document_v2_usercollection_daily_sleep__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DailySleepModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_sleep/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_sleep/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_sleep/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_sleep/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/daily_sleep/{document_id}': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Single Daily Sleep Document',
      operationId: 'Sandbox___Single_daily_sleep_Document_v2_sandbox_usercollection_daily_sleep__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DailySleepModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_sleep/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_sleep/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_sleep/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_sleep/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/daily_spo2/{document_id}': {
    get: {
      tags: ['Daily Spo2 Routes'],
      summary: 'Single Daily Spo2 Document',
      operationId: 'Single_daily_spo2_Document_v2_usercollection_daily_spo2__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DailySpO2Model',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_spo2/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_spo2/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_spo2/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_spo2/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/daily_spo2/{document_id}': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Single Daily Spo2 Document',
      operationId: 'Sandbox___Single_daily_spo2_Document_v2_sandbox_usercollection_daily_spo2__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DailySpO2Model',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_spo2/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_spo2/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_spo2/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_spo2/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/daily_readiness/{document_id}': {
    get: {
      tags: ['Daily Readiness Routes'],
      summary: 'Single Daily Readiness Document',
      operationId: 'Single_daily_readiness_Document_v2_usercollection_daily_readiness__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DailyReadinessModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_readiness/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_readiness/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_readiness/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_readiness/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/daily_readiness/{document_id}': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Single Daily Readiness Document',
      operationId:
        'Sandbox___Single_daily_readiness_Document_v2_sandbox_usercollection_daily_readiness__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DailyReadinessModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_readiness/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_readiness/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_readiness/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_readiness/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/sleep/{document_id}': {
    get: {
      tags: ['Sleep Routes'],
      summary: 'Single Sleep Document',
      operationId: 'Single_sleep_Document_v2_usercollection_sleep__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SleepModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/sleep/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/sleep/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/sleep/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/sleep/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/sleep/{document_id}': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Single Sleep Document',
      operationId: 'Sandbox___Single_sleep_Document_v2_sandbox_usercollection_sleep__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SleepModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/sleep/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/sleep/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/sleep/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/sleep/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/sleep_time/{document_id}': {
    get: {
      tags: ['Sleep Time Routes'],
      summary: 'Single Sleep Time Document',
      operationId: 'Single_sleep_time_Document_v2_usercollection_sleep_time__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SleepTimeModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/sleep_time/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/sleep_time/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/sleep_time/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/sleep_time/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/sleep_time/{document_id}': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Single Sleep Time Document',
      operationId: 'Sandbox___Single_sleep_time_Document_v2_sandbox_usercollection_sleep_time__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SleepTimeModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/sleep_time/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/sleep_time/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/sleep_time/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/sleep_time/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/rest_mode_period/{document_id}': {
    get: {
      tags: ['Rest Mode Period Routes'],
      summary: 'Single Rest Mode Period Document',
      operationId: 'Single_rest_mode_period_Document_v2_usercollection_rest_mode_period__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RestModePeriodModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/rest_mode_period/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/rest_mode_period/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/rest_mode_period/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/rest_mode_period/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/rest_mode_period/{document_id}': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Single Rest Mode Period Document',
      operationId:
        'Sandbox___Single_rest_mode_period_Document_v2_sandbox_usercollection_rest_mode_period__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RestModePeriodModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/rest_mode_period/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/rest_mode_period/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/rest_mode_period/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/rest_mode_period/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/ring_configuration/{document_id}': {
    get: {
      tags: ['Ring Configuration Routes'],
      summary: 'Single Ring Configuration Document',
      operationId: 'Single_ring_configuration_Document_v2_usercollection_ring_configuration__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RingConfigurationModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/ring_configuration/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/ring_configuration/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/ring_configuration/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/ring_configuration/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/ring_configuration/{document_id}': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Single Ring Configuration Document',
      operationId:
        'Sandbox___Single_ring_configuration_Document_v2_sandbox_usercollection_ring_configuration__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RingConfigurationModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/ring_configuration/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/ring_configuration/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/ring_configuration/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/ring_configuration/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/daily_stress/{document_id}': {
    get: {
      tags: ['Daily Stress Routes'],
      summary: 'Single Daily Stress Document',
      operationId: 'Single_daily_stress_Document_v2_usercollection_daily_stress__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DailyStressModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_stress/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_stress/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_stress/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_stress/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/daily_stress/{document_id}': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Single Daily Stress Document',
      operationId: 'Sandbox___Single_daily_stress_Document_v2_sandbox_usercollection_daily_stress__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DailyStressModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_stress/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_stress/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_stress/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_stress/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/daily_resilience/{document_id}': {
    get: {
      tags: ['Daily Resilience Routes'],
      summary: 'Single Daily Resilience Document',
      operationId: 'Single_daily_resilience_Document_v2_usercollection_daily_resilience__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DailyResilienceModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_resilience/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_resilience/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_resilience/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_resilience/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/daily_resilience/{document_id}': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Single Daily Resilience Document',
      operationId:
        'Sandbox___Single_daily_resilience_Document_v2_sandbox_usercollection_daily_resilience__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DailyResilienceModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_resilience/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_resilience/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_resilience/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_resilience/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/daily_cardiovascular_age/{document_id}': {
    get: {
      tags: ['Daily Cardiovascular Age Routes'],
      summary: 'Single Daily Cardiovascular Age Document',
      operationId:
        'Single_daily_cardiovascular_age_Document_v2_usercollection_daily_cardiovascular_age__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DailyCardiovascularAgeModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/daily_cardiovascular_age/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/daily_cardiovascular_age/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/daily_cardiovascular_age/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/daily_cardiovascular_age/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/daily_cardiovascular_age/{document_id}': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Single Daily Cardiovascular Age Document',
      operationId:
        'Sandbox___Single_daily_cardiovascular_age_Document_v2_sandbox_usercollection_daily_cardiovascular_age__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DailyCardiovascularAgeModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/daily_cardiovascular_age/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/daily_cardiovascular_age/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/daily_cardiovascular_age/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/daily_cardiovascular_age/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/usercollection/vO2_max/{document_id}': {
    get: {
      tags: ['VO2 Max Routes'],
      summary: 'Single Vo2 Max Document',
      operationId: 'Single_vO2_max_Document_v2_usercollection_vO2_max__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/VO2MaxModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/usercollection/vO2_max/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/vO2_max/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/vO2_max/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/vO2_max/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/vO2_max/{document_id}': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Single Vo2 Max Document',
      operationId: 'Sandbox___Single_vO2_max_Document_v2_sandbox_usercollection_vO2_max__document_id__get',
      parameters: [
        {
          name: 'document_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Document Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/VO2MaxModel',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '404': {
          description: 'Not Found',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/vO2_max/2-5daccc095220cc5493a4e9c2b681ca941e' \\\n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/vO2_max/2-5daccc095220cc5493a4e9c2b681ca941e\nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/vO2_max/2-5daccc095220cc5493a4e9c2b681ca941e', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/vO2_max/2-5daccc095220cc5493a4e9c2b681ca941e") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/webhook/subscription': {
    get: {
      tags: ['Webhook Subscription Routes'],
      summary: 'List Webhook Subscriptions',
      operationId: 'list_webhook_subscriptions_v2_webhook_subscription_get',
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                items: {
                  $ref: '#/components/schemas/WebhookSubscriptionModel',
                },
                type: 'array',
                title: 'Response List Webhook Subscriptions V2 Webhook Subscription Get',
              },
            },
          },
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/webhook/subscription' --header 'x-client-id: client-id' --header 'x-client-secret: client-secret'",
        },
      ],
    },
    post: {
      tags: ['Webhook Subscription Routes'],
      summary: 'Create Webhook Subscription',
      operationId: 'create_webhook_subscription_v2_webhook_subscription_post',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateWebhookSubscriptionRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '201': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WebhookSubscriptionModel',
              },
            },
          },
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            'curl --location --request POST \'https://api.ouraring.com/v2/webhook/subscription\' --header \'x-client-id: client-id\' --header \'x-client-secret: client-secret\' --header \'Content-Type: application/json\' --data-raw \'{\n    "callback_url": "https://my-api/oura/tag/delete",\n    "verification_token": "123",\n    "event_type": "delete",\n    "data_type": "tag"\n}\'',
        },
      ],
    },
  },
  '/v2/webhook/subscription/{id}': {
    get: {
      tags: ['Webhook Subscription Routes'],
      summary: 'Get Webhook Subscription',
      operationId: 'get_webhook_subscription_v2_webhook_subscription__id__get',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WebhookSubscriptionModel',
              },
            },
          },
        },
        '403': {
          description: 'Webhook with specified id does not exist.',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request GET 'https://api.ouraring.com/v2/webhook/subscription/5d3fe17b-f880-4d93-b9b6-afbfb76c1e78' --header 'x-client-id: client-id' --header 'x-client-secret: client-secret'",
        },
      ],
    },
    put: {
      tags: ['Webhook Subscription Routes'],
      summary: 'Update Webhook Subscription',
      operationId: 'update_webhook_subscription_v2_webhook_subscription__id__put',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Id',
          },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdateWebhookSubscriptionRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WebhookSubscriptionModel',
              },
            },
          },
        },
        '403': {
          description: 'Webhook with specified id does not exist.',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            'curl --location --request PUT \'https://api.ouraring.com/v2/webhook/subscription/5d3fe17b-f880-4d93-b9b6-afbfb76c1e78\' --header \'x-client-id: client-id\' --header \'x-client-secret: client-secret\' --header \'Content-Type: application/json\' --data-raw \'{\n    "callback_url": "https://my-api/oura/tag/delete",\n    "verification_token": "123",\n    "event_type": "delete",\n    "data_type": "tag"\n}\'',
        },
      ],
    },
    delete: {
      tags: ['Webhook Subscription Routes'],
      summary: 'Delete Webhook Subscription',
      operationId: 'delete_webhook_subscription_v2_webhook_subscription__id__delete',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Id',
          },
        },
      ],
      responses: {
        '204': {
          description: 'Successful Response',
        },
        '403': {
          description: 'Webhook with specified id does not exist.',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request DELETE 'https://api.ouraring.com/v2/webhook/subscription/5d3fe17b-f880-4d93-b9b6-afbfb76c1e78' --header 'x-client-id: client-id' --header 'x-client-secret: client-secret'",
        },
      ],
    },
  },
  '/v2/webhook/subscription/renew/{id}': {
    put: {
      tags: ['Webhook Subscription Routes'],
      summary: 'Renew Webhook Subscription',
      operationId: 'renew_webhook_subscription_v2_webhook_subscription_renew__id__put',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            title: 'Id',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WebhookSubscriptionModel',
              },
            },
          },
        },
        '403': {
          description: 'Webhook with specified id does not exist.',
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "curl --location --request PUT 'https://api.ouraring.com/v2/webhook/subscription/renew/5d3fe17b-f880-4d93-b9b6-afbfb76c1e78' --header 'x-client-id: client-id' --header 'x-client-secret: client-secret' --header 'Content-Type: application/json'",
        },
      ],
    },
  },
  '/v2/usercollection/heartrate': {
    get: {
      tags: ['Heart Rate Routes'],
      summary: 'Multiple Multiple Heart Rate Documents Documents',
      operationId: 'Multiple_Multiple_Heart_Rate_Documents_Documents_v2_usercollection_heartrate_get',
      parameters: [
        {
          name: 'start_datetime',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Datetime',
          },
        },
        {
          name: 'end_datetime',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Datetime',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TimeSeriesResponse_HeartRateModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "# The '+' symbol in the timezone must be escaped to `%2B` if included. \ncurl --location --request GET 'https://api.ouraring.com/v2/usercollection/heartrate?start_datetime=2021-11-01T00:00:00-08:00&end_datetime=2021-12-01T00:00:00-08:00' \\ \n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/usercollection/heartrate' \nparams={ \n    'start_datetime': '2021-11-01T00:00:00-08:00', \n    'end_datetime': '2021-12-01T00:00:00-08:00' \n} \nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/usercollection/heartrate?start_datetime=2021-11-01T00:00:00-08:00&end_datetime=2021-12-01T00:00:00-08:00', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/usercollection/heartrate?start_datetime=2021-11-01T00:00:00-08:00&end_datetime=2021-12-01T00:00:00-08:00") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
  '/v2/sandbox/usercollection/heartrate': {
    get: {
      tags: ['Sandbox Routes'],
      summary: 'Sandbox - Multiple Heartrate Documents',
      operationId: 'Sandbox___Multiple_heartrate_Documents_v2_sandbox_usercollection_heartrate_get',
      parameters: [
        {
          name: 'start_datetime',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'null',
              },
            ],
            title: 'Start Datetime',
          },
        },
        {
          name: 'end_datetime',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
                format: 'date-time',
              },
              {
                type: 'null',
              },
            ],
            title: 'End Datetime',
          },
        },
        {
          name: 'next_token',
          in: 'query',
          required: false,
          schema: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
            title: 'Next Token',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TimeSeriesResponse_HeartRateModel_',
              },
            },
          },
        },
        '400': {
          description: 'Client Exception',
        },
        '401': {
          description:
            'Unauthorized access exception. Usually means the access token is expired, malformed or revoked.',
        },
        '403': {
          description:
            "Access forbidden. Usually means the user's subscription to Oura has expired and their data is not available via the API.",
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError',
              },
            },
          },
        },
        '429': {
          description: 'Request Rate Limit Exceeded.',
        },
      },
      'x-codeSamples': [
        {
          lang: 'cURL',
          label: 'cURL',
          source:
            "# The '+' symbol in the timezone must be escaped to `%2B` if included. \ncurl --location --request GET 'https://api.ouraring.com/v2/sandbox/usercollection/heartrate?start_datetime=2021-11-01T00:00:00-08:00&end_datetime=2021-12-01T00:00:00-08:00' \\ \n--header 'Authorization: Bearer <token>'",
        },
        {
          lang: 'Python',
          source:
            "import requests \nurl = 'https://api.ouraring.com/v2/sandbox/usercollection/heartrate' \nparams={ \n    'start_datetime': '2021-11-01T00:00:00-08:00', \n    'end_datetime': '2021-12-01T00:00:00-08:00' \n} \nheaders = { \n  'Authorization': 'Bearer <token>' \n}\nresponse = requests.request('GET', url, headers=headers, params=params) \nprint(response.text)",
          label: 'Python',
        },
        {
          lang: 'JavaScript',
          source:
            "var myHeaders = new Headers(); \nmyHeaders.append('Authorization', 'Bearer <token>'); \nvar requestOptions = { \n  method: 'GET', \n  headers: myHeaders, \nfetch('https://api.ouraring.com/v2/sandbox/usercollection/heartrate?start_datetime=2021-11-01T00:00:00-08:00&end_datetime=2021-12-01T00:00:00-08:00', requestOptions) \n  .then(response => response.text()) \n  .then(result => console.log(result)) \n  .catch(error => console.log('error', error));",
          label: 'JavaScript',
        },
        {
          lang: 'Java',
          source:
            'OkHttpClient client = new OkHttpClient().newBuilder() \n  .build(); \nRequest request = new Request.Builder() \n  .url("https://api.ouraring.com/v2/sandbox/usercollection/heartrate?start_datetime=2021-11-01T00:00:00-08:00&end_datetime=2021-12-01T00:00:00-08:00") \n  .method("GET", null) \n  .addHeader("Authorization", "Bearer <token>") \n  .build(); \nResponse response = client.newCall(request).execute();',
          label: 'Java',
        },
      ],
    },
  },
} as TPaths;
