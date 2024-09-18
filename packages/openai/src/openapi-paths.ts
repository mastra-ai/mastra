// @ts-nocheck
export type TPaths = {
  '/answers': {
    post: {
      deprecated: true;
      operationId: 'createAnswer';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateAnswerRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateAnswerResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Answers the specified question using the provided documents and examples.\n\nThe endpoint first [searches](/docs/api-reference/searches) over provided documents or files to find relevant context. The relevant context is combined with the provided examples and question to create the prompt for [completion](/docs/api-reference/completions).\n';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/answers \\\n  -X POST \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{\n    "documents": ["Puppy A is happy.", "Puppy B is sad."],\n    "question": "which puppy is happy?",\n    "search_model": "ada",\n    "model": "curie",\n    "examples_context": "In 2017, U.S. life expectancy was 78.6 years.",\n    "examples": [["What is human life expectancy in the United States?","78 years."]],\n    "max_tokens": 5,\n    "stop": ["\\n", "<|endoftext|>"]\n  }\'\n';
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createAnswer({\n  search_model: "ada",\n  model: "curie",\n  question: "which puppy is happy?",\n  documents: ["Puppy A is happy.", "Puppy B is sad."],\n  examples_context: "In 2017, U.S. life expectancy was 78.6 years.",\n  examples: [["What is human life expectancy in the United States?","78 years."]],\n  max_tokens: 5,\n  stop: ["\\n", "<|endoftext|>"],\n});\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Answer.create(\n  search_model="ada",\n  model="curie",\n  question="which puppy is happy?",\n  documents=["Puppy A is happy.", "Puppy B is sad."],\n  examples_context="In 2017, U.S. life expectancy was 78.6 years.",\n  examples=[["What is human life expectancy in the United States?","78 years."]],\n  max_tokens=5,\n  stop=["\\n", "<|endoftext|>"],\n)\n';
        };
        group: 'answers';
        name: 'Create answer';
        parameters: '{\n  "documents": ["Puppy A is happy.", "Puppy B is sad."],\n  "question": "which puppy is happy?",\n  "search_model": "ada",\n  "model": "curie",\n  "examples_context": "In 2017, U.S. life expectancy was 78.6 years.",\n  "examples": [["What is human life expectancy in the United States?","78 years."]],\n  "max_tokens": 5,\n  "stop": ["\\n", "<|endoftext|>"]\n}\n';
        path: 'create';
        response: '{\n  "answers": [\n    "puppy A."\n  ],\n  "completion": "cmpl-2euVa1kmKUuLpSX600M41125Mo9NI",\n  "model": "curie:2020-05-03",\n  "object": "answer",\n  "search_model": "ada",\n  "selected_documents": [\n    {\n      "document": 0,\n      "text": "Puppy A is happy. "\n    },\n    {\n      "document": 1,\n      "text": "Puppy B is sad. "\n    }\n  ]\n}\n';
      };
    };
  };
  '/audio/transcriptions': {
    post: {
      operationId: 'createTranscription';
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/CreateTranscriptionRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateTranscriptionResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Transcribes audio into the input language.';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        beta: true;
        examples: {
          curl: "curl https://api.openai.com/v1/audio/transcriptions \\\n  -X POST \\\n  -H 'Authorization: Bearer TOKEN' \\\n  -H 'Content-Type: multipart/form-data' \\\n  -F file=@/path/to/file/audio.mp3 \\\n  -F model=whisper-1\n";
          node: 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst resp = await openai.createTranscription(\n  fs.createReadStream("audio.mp3"),\n  "whisper-1"\n);\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\naudio_file = open("audio.mp3", "rb")\ntranscript = openai.Audio.transcribe("whisper-1", audio_file)\n';
        };
        group: 'audio';
        name: 'Create transcription';
        parameters: '{\n  "file": "audio.mp3",\n  "model": "whisper-1"\n}\n';
        path: 'create';
        response: '{\n  "text": "Imagine the wildest idea that you\'ve ever had, and you\'re curious about how it might scale to something that\'s a 100, a 1,000 times bigger. This is a place where you can get to do that."\n}\n';
      };
    };
  };
  '/audio/translations': {
    post: {
      operationId: 'createTranslation';
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/CreateTranslationRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateTranslationResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Translates audio into into English.';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        beta: true;
        examples: {
          curl: "curl https://api.openai.com/v1/audio/translations \\\n    -X POST \\\n    -H 'Authorization: Bearer TOKEN' \\\n    -H 'Content-Type: multipart/form-data' \\\n    -F file=@/path/to/file/german.m4a \\\n    -F model=whisper-1\n";
          node: 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst resp = await openai.createTranslation(\n  fs.createReadStream("audio.mp3"),\n  "whisper-1"\n);\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\naudio_file = open("german.m4a", "rb")\ntranscript = openai.Audio.translate("whisper-1", audio_file)\n';
        };
        group: 'audio';
        name: 'Create translation';
        parameters: '{\n  "file": "german.m4a",\n  "model": "whisper-1"\n}\n';
        path: 'create';
        response: '{\n  "text": "Hello, my name is Wolfgang and I come from Germany. Where are you heading today?"\n}\n';
      };
    };
  };
  '/chat/completions': {
    post: {
      operationId: 'createChatCompletion';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateChatCompletionRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateChatCompletionResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Creates a completion for the chat message';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        beta: true;
        examples: {
          curl: 'curl https://api.openai.com/v1/chat/completions \\\n  -H \'Content-Type: application/json\' \\\n  -H \'Authorization: Bearer YOUR_API_KEY\' \\\n  -d \'{\n  "model": "gpt-3.5-turbo",\n  "messages": [{"role": "user", "content": "Hello!"}]\n}\'\n';
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\n\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\n\nconst completion = await openai.createChatCompletion({\n  model: "gpt-3.5-turbo",\n  messages: [{role: "user", content: "Hello world"}],\n});\nconsole.log(completion.data.choices[0].message);\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\n\ncompletion = openai.ChatCompletion.create(\n  model="gpt-3.5-turbo",\n  messages=[\n    {"role": "user", "content": "Hello!"}\n  ]\n)\n\nprint(completion.choices[0].message)\n';
        };
        group: 'chat';
        name: 'Create chat completion';
        parameters: '{\n  "model": "gpt-3.5-turbo",\n  "messages": [{"role": "user", "content": "Hello!"}]\n}\n';
        path: 'create';
        response: '{\n  "id": "chatcmpl-123",\n  "object": "chat.completion",\n  "created": 1677652288,\n  "choices": [{\n    "index": 0,\n    "message": {\n      "role": "assistant",\n      "content": "\\n\\nHello there, how may I assist you today?",\n    },\n    "finish_reason": "stop"\n  }],\n  "usage": {\n    "prompt_tokens": 9,\n    "completion_tokens": 12,\n    "total_tokens": 21\n  }\n}\n';
      };
    };
  };
  '/classifications': {
    post: {
      deprecated: true;
      operationId: 'createClassification';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateClassificationRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateClassificationResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Classifies the specified `query` using provided examples.\n\nThe endpoint first [searches](/docs/api-reference/searches) over the labeled examples\nto select the ones most relevant for the particular query. Then, the relevant examples\nare combined with the query to construct a prompt to produce the final label via the\n[completions](/docs/api-reference/completions) endpoint.\n\nLabeled examples can be provided via an uploaded `file`, or explicitly listed in the\nrequest using the `examples` parameter for quick tests and small scale use cases.\n';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/classifications \\\n  -X POST \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{\n    "examples": [\n      ["A happy moment", "Positive"],\n      ["I am sad.", "Negative"],\n      ["I am feeling awesome", "Positive"]],\n    "query": "It is a raining day :(",\n    "search_model": "ada",\n    "model": "curie",\n    "labels":["Positive", "Negative", "Neutral"]\n  }\'\n';
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createClassification({\n  search_model: "ada",\n  model: "curie",\n  examples: [\n    ["A happy moment", "Positive"],\n    ["I am sad.", "Negative"],\n    ["I am feeling awesome", "Positive"]\n  ],\n  query:"It is a raining day :(",\n  labels: ["Positive", "Negative", "Neutral"],\n});\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Classification.create(\n  search_model="ada",\n  model="curie",\n  examples=[\n    ["A happy moment", "Positive"],\n    ["I am sad.", "Negative"],\n    ["I am feeling awesome", "Positive"]\n  ],\n  query="It is a raining day :(",\n  labels=["Positive", "Negative", "Neutral"],\n)\n';
        };
        group: 'classifications';
        name: 'Create classification';
        parameters: '{\n  "examples": [\n    ["A happy moment", "Positive"],\n    ["I am sad.", "Negative"],\n    ["I am feeling awesome", "Positive"]\n  ],\n  "labels": ["Positive", "Negative", "Neutral"],\n  "query": "It is a raining day :(",\n  "search_model": "ada",\n  "model": "curie"\n}\n';
        path: 'create';
        response: '{\n  "completion": "cmpl-2euN7lUVZ0d4RKbQqRV79IiiE6M1f",\n  "label": "Negative",\n  "model": "curie:2020-05-03",\n  "object": "classification",\n  "search_model": "ada",\n  "selected_examples": [\n    {\n      "document": 1,\n      "label": "Negative",\n      "text": "I am sad."\n    },\n    {\n      "document": 0,\n      "label": "Positive",\n      "text": "A happy moment"\n    },\n    {\n      "document": 2,\n      "label": "Positive",\n      "text": "I am feeling awesome"\n    }\n  ]\n}\n';
      };
    };
  };
  '/completions': {
    post: {
      operationId: 'createCompletion';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateCompletionRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateCompletionResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Creates a completion for the provided prompt and parameters';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/completions \\\n  -H \'Content-Type: application/json\' \\\n  -H \'Authorization: Bearer YOUR_API_KEY\' \\\n  -d \'{\n  "model": "VAR_model_id",\n  "prompt": "Say this is a test",\n  "max_tokens": 7,\n  "temperature": 0\n}\'\n';
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createCompletion({\n  model: "VAR_model_id",\n  prompt: "Say this is a test",\n  max_tokens: 7,\n  temperature: 0,\n});\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Completion.create(\n  model="VAR_model_id",\n  prompt="Say this is a test",\n  max_tokens=7,\n  temperature=0\n)\n';
        };
        group: 'completions';
        name: 'Create completion';
        parameters: '{\n  "model": "VAR_model_id",\n  "prompt": "Say this is a test",\n  "max_tokens": 7,\n  "temperature": 0,\n  "top_p": 1,\n  "n": 1,\n  "stream": false,\n  "logprobs": null,\n  "stop": "\\n"\n}\n';
        path: 'create';
        response: '{\n  "id": "cmpl-uqkvlQyYK7bGYrRHQ0eXlWi7",\n  "object": "text_completion",\n  "created": 1589478378,\n  "model": "VAR_model_id",\n  "choices": [\n    {\n      "text": "\\n\\nThis is indeed a test",\n      "index": 0,\n      "logprobs": null,\n      "finish_reason": "length"\n    }\n  ],\n  "usage": {\n    "prompt_tokens": 5,\n    "completion_tokens": 7,\n    "total_tokens": 12\n  }\n}\n';
      };
    };
  };
  '/edits': {
    post: {
      operationId: 'createEdit';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateEditRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateEditResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Creates a new edit for the provided input, instruction, and parameters.';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/edits \\\n  -H \'Content-Type: application/json\' \\\n  -H \'Authorization: Bearer YOUR_API_KEY\' \\\n  -d \'{\n  "model": "VAR_model_id",\n  "input": "What day of the wek is it?",\n  "instruction": "Fix the spelling mistakes"\n}\'\n';
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createEdit({\n  model: "VAR_model_id",\n  input: "What day of the wek is it?",\n  instruction: "Fix the spelling mistakes",\n});\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Edit.create(\n  model="VAR_model_id",\n  input="What day of the wek is it?",\n  instruction="Fix the spelling mistakes"\n)\n';
        };
        group: 'edits';
        name: 'Create edit';
        parameters: '{\n  "model": "VAR_model_id",\n  "input": "What day of the wek is it?",\n  "instruction": "Fix the spelling mistakes",\n}\n';
        path: 'create';
        response: '{\n  "object": "edit",\n  "created": 1589478378,\n  "choices": [\n    {\n      "text": "What day of the week is it?",\n      "index": 0,\n    }\n  ],\n  "usage": {\n    "prompt_tokens": 25,\n    "completion_tokens": 32,\n    "total_tokens": 57\n  }\n}\n';
      };
    };
  };
  '/embeddings': {
    post: {
      operationId: 'createEmbedding';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateEmbeddingRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateEmbeddingResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Creates an embedding vector representing the input text.';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/embeddings \\\n  -X POST \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"input": "The food was delicious and the waiter...",\n       "model": "text-embedding-ada-002"}\'\n';
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createEmbedding({\n  model: "text-embedding-ada-002",\n  input: "The food was delicious and the waiter...",\n});\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Embedding.create(\n  model="text-embedding-ada-002",\n  input="The food was delicious and the waiter..."\n)\n';
        };
        group: 'embeddings';
        name: 'Create embeddings';
        parameters: '{\n  "model": "text-embedding-ada-002",\n  "input": "The food was delicious and the waiter..."\n}\n';
        path: 'create';
        response: '{\n  "object": "list",\n  "data": [\n    {\n      "object": "embedding",\n      "embedding": [\n        0.0023064255,\n        -0.009327292,\n        .... (1536 floats total for ada-002)\n        -0.0028842222,\n      ],\n      "index": 0\n    }\n  ],\n  "model": "text-embedding-ada-002",\n  "usage": {\n    "prompt_tokens": 8,\n    "total_tokens": 8\n  }\n}\n';
      };
    };
  };
  '/engines': {
    get: {
      deprecated: true;
      operationId: 'listEngines';
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListEnginesResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Lists the currently available (non-finetuned) models, and provides basic information about each one such as the owner and availability.';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/engines \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\n";
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.listEngines();\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Engine.list()\n';
        };
        group: 'engines';
        name: 'List engines';
        path: 'list';
        response: '{\n  "data": [\n    {\n      "id": "engine-id-0",\n      "object": "engine",\n      "owner": "organization-owner",\n      "ready": true\n    },\n    {\n      "id": "engine-id-2",\n      "object": "engine",\n      "owner": "organization-owner",\n      "ready": true\n    },\n    {\n      "id": "engine-id-3",\n      "object": "engine",\n      "owner": "openai",\n      "ready": false\n    },\n  ],\n  "object": "list"\n}\n';
      };
    };
  };
  '/engines/{engine_id}': {
    get: {
      deprecated: true;
      operationId: 'retrieveEngine';
      parameters: [
        {
          description: 'The ID of the engine to use for this request\n';
          in: 'path';
          name: 'engine_id';
          required: true;
          schema: {
            example: 'davinci';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Engine';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Retrieves a model instance, providing basic information about it such as the owner and availability.';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/engines/VAR_model_id \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\n";
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.retrieveEngine("VAR_model_id");\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Engine.retrieve("VAR_model_id")\n';
        };
        group: 'engines';
        name: 'Retrieve engine';
        path: 'retrieve';
        response: '{\n  "id": "VAR_model_id",\n  "object": "engine",\n  "owner": "openai",\n  "ready": true\n}\n';
      };
    };
  };
  '/engines/{engine_id}/search': {
    post: {
      deprecated: true;
      operationId: 'createSearch';
      parameters: [
        {
          description: 'The ID of the engine to use for this request.  You can select one of `ada`, `babbage`, `curie`, or `davinci`.';
          in: 'path';
          name: 'engine_id';
          required: true;
          schema: {
            example: 'davinci';
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateSearchRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateSearchResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'The search endpoint computes similarity scores between provided query and documents. Documents can be passed directly to the API if there are no more than 200 of them.\n\nTo go beyond the 200 document limit, documents can be processed offline and then used for efficient retrieval at query time. When `file` is set, the search endpoint searches over all the documents in the given file and returns up to the `max_rerank` number of documents. These documents will be returned along with their search scores.\n\nThe similarity score is a positive score that usually ranges from 0 to 300 (but can sometimes go higher), where a score above 200 usually means the document is semantically similar to the query.\n';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/engines/davinci/search \\\n  -H "Content-Type: application/json" \\\n  -H \'Authorization: Bearer YOUR_API_KEY\' \\\n  -d \'{\n  "documents": ["White House", "hospital", "school"],\n  "query": "the president"\n}\'\n';
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createSearch("davinci", {\n  documents: ["White House", "hospital", "school"],\n  query: "the president",\n});\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Engine("davinci").search(\n  documents=["White House", "hospital", "school"],\n  query="the president"\n)\n';
        };
        group: 'searches';
        name: 'Create search';
        parameters: '{\n  "documents": [\n    "White House",\n    "hospital",\n    "school"\n  ],\n  "query": "the president"\n}\n';
        path: 'create';
        response: '{\n  "data": [\n    {\n      "document": 0,\n      "object": "search_result",\n      "score": 215.412\n    },\n    {\n      "document": 1,\n      "object": "search_result",\n      "score": 40.316\n    },\n    {\n      "document": 2,\n      "object": "search_result",\n      "score":  55.226\n    }\n  ],\n  "object": "list"\n}\n';
      };
    };
  };
  '/files': {
    get: {
      operationId: 'listFiles';
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListFilesResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: "Returns a list of files that belong to the user's organization.";
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/files \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\n";
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.listFiles();\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.File.list()\n';
        };
        group: 'files';
        name: 'List files';
        path: 'list';
        response: '{\n  "data": [\n    {\n      "id": "file-ccdDZrC3iZVNiQVeEA6Z66wf",\n      "object": "file",\n      "bytes": 175,\n      "created_at": 1613677385,\n      "filename": "train.jsonl",\n      "purpose": "search"\n    },\n    {\n      "id": "file-XjGxS3KTG0uNmNOK362iJua3",\n      "object": "file",\n      "bytes": 140,\n      "created_at": 1613779121,\n      "filename": "puppy.jsonl",\n      "purpose": "search"\n    }\n  ],\n  "object": "list"\n}\n';
      };
    };
    post: {
      operationId: 'createFile';
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/CreateFileRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/OpenAIFile';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Upload a file that contains document(s) to be used across various endpoints/features. Currently, the size of all the files uploaded by one organization can be up to 1 GB. Please contact us if you need to increase the storage limit.\n';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/files \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -F purpose="fine-tune" \\\n  -F file=\'@mydata.jsonl\'\n';
          'node.js': 'const fs = require("fs");\nconst { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createFile(\n  fs.createReadStream("mydata.jsonl"),\n  "fine-tune"\n);\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.File.create(\n  file=open("mydata.jsonl", "rb"),\n  purpose=\'fine-tune\'\n)\n';
        };
        group: 'files';
        name: 'Upload file';
        path: 'upload';
        response: '{\n  "id": "file-XjGxS3KTG0uNmNOK362iJua3",\n  "object": "file",\n  "bytes": 140,\n  "created_at": 1613779121,\n  "filename": "mydata.jsonl",\n  "purpose": "fine-tune"\n}\n';
      };
    };
  };
  '/files/{file_id}': {
    delete: {
      operationId: 'deleteFile';
      parameters: [
        {
          description: 'The ID of the file to use for this request';
          in: 'path';
          name: 'file_id';
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
                $ref: '#/components/schemas/DeleteFileResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Delete a file.';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/files/file-XjGxS3KTG0uNmNOK362iJua3 \\\n  -X DELETE \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\n";
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.deleteFile("file-XjGxS3KTG0uNmNOK362iJua3");\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.File.delete("file-XjGxS3KTG0uNmNOK362iJua3")\n';
        };
        group: 'files';
        name: 'Delete file';
        path: 'delete';
        response: '{\n  "id": "file-XjGxS3KTG0uNmNOK362iJua3",\n  "object": "file",\n  "deleted": true\n}\n';
      };
    };
    get: {
      operationId: 'retrieveFile';
      parameters: [
        {
          description: 'The ID of the file to use for this request';
          in: 'path';
          name: 'file_id';
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
                $ref: '#/components/schemas/OpenAIFile';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Returns information about a specific file.';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/files/file-XjGxS3KTG0uNmNOK362iJua3 \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\n";
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.retrieveFile("file-XjGxS3KTG0uNmNOK362iJua3");\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.File.retrieve("file-XjGxS3KTG0uNmNOK362iJua3")\n';
        };
        group: 'files';
        name: 'Retrieve file';
        path: 'retrieve';
        response: '{\n  "id": "file-XjGxS3KTG0uNmNOK362iJua3",\n  "object": "file",\n  "bytes": 140,\n  "created_at": 1613779657,\n  "filename": "mydata.jsonl",\n  "purpose": "fine-tune"\n}\n';
      };
    };
  };
  '/files/{file_id}/content': {
    get: {
      operationId: 'downloadFile';
      parameters: [
        {
          description: 'The ID of the file to use for this request';
          in: 'path';
          name: 'file_id';
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
                type: 'string';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Returns the contents of the specified file';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/files/file-XjGxS3KTG0uNmNOK362iJua3/content \\\n  -H 'Authorization: Bearer YOUR_API_KEY' > file.jsonl\n";
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.downloadFile("file-XjGxS3KTG0uNmNOK362iJua3");\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\ncontent = openai.File.download("file-XjGxS3KTG0uNmNOK362iJua3")\n';
        };
        group: 'files';
        name: 'Retrieve file content';
        path: 'retrieve-content';
      };
    };
  };
  '/fine-tunes': {
    get: {
      operationId: 'listFineTunes';
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListFineTunesResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: "List your organization's fine-tuning jobs\n";
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/fine-tunes \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\n";
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.listFineTunes();\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.FineTune.list()\n';
        };
        group: 'fine-tunes';
        name: 'List fine-tunes';
        path: 'list';
        response: '{\n  "object": "list",\n  "data": [\n    {\n      "id": "ft-AF1WoRqd3aJAHsqc9NY7iL8F",\n      "object": "fine-tune",\n      "model": "curie",\n      "created_at": 1614807352,\n      "fine_tuned_model": null,\n      "hyperparams": { ... },\n      "organization_id": "org-...",\n      "result_files": [],\n      "status": "pending",\n      "validation_files": [],\n      "training_files": [ { ... } ],\n      "updated_at": 1614807352,\n    },\n    { ... },\n    { ... }\n  ]\n}\n';
      };
    };
    post: {
      operationId: 'createFineTune';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateFineTuneRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/FineTune';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Creates a job that fine-tunes a specified model from a given dataset.\n\nResponse includes details of the enqueued job including job status and the name of the fine-tuned models once complete.\n\n[Learn more about Fine-tuning](/docs/guides/fine-tuning)\n';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/fine-tunes \\\n  -X POST \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -d \'{\n  "training_file": "file-XGinujblHPwGLSztz8cPS8XY"\n}\'\n';
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createFineTune({\n  training_file: "file-XGinujblHPwGLSztz8cPS8XY",\n});\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.FineTune.create(training_file="file-XGinujblHPwGLSztz8cPS8XY")\n';
        };
        group: 'fine-tunes';
        name: 'Create fine-tune';
        path: 'create';
        response: '{\n  "id": "ft-AF1WoRqd3aJAHsqc9NY7iL8F",\n  "object": "fine-tune",\n  "model": "curie",\n  "created_at": 1614807352,\n  "events": [\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807352,\n      "level": "info",\n      "message": "Job enqueued. Waiting for jobs ahead to complete. Queue number: 0."\n    }\n  ],\n  "fine_tuned_model": null,\n  "hyperparams": {\n    "batch_size": 4,\n    "learning_rate_multiplier": 0.1,\n    "n_epochs": 4,\n    "prompt_loss_weight": 0.1,\n  },\n  "organization_id": "org-...",\n  "result_files": [],\n  "status": "pending",\n  "validation_files": [],\n  "training_files": [\n    {\n      "id": "file-XGinujblHPwGLSztz8cPS8XY",\n      "object": "file",\n      "bytes": 1547276,\n      "created_at": 1610062281,\n      "filename": "my-data-train.jsonl",\n      "purpose": "fine-tune-train"\n    }\n  ],\n  "updated_at": 1614807352,\n}\n';
      };
    };
  };
  '/fine-tunes/{fine_tune_id}': {
    get: {
      operationId: 'retrieveFineTune';
      parameters: [
        {
          description: 'The ID of the fine-tune job\n';
          in: 'path';
          name: 'fine_tune_id';
          required: true;
          schema: {
            example: 'ft-AF1WoRqd3aJAHsqc9NY7iL8F';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/FineTune';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Gets info about the fine-tune job.\n\n[Learn more about Fine-tuning](/docs/guides/fine-tuning)\n';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/fine-tunes/ft-AF1WoRqd3aJAHsqc9NY7iL8F \\\n  -H "Authorization: Bearer YOUR_API_KEY"\n';
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.retrieveFineTune("ft-AF1WoRqd3aJAHsqc9NY7iL8F");\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.FineTune.retrieve(id="ft-AF1WoRqd3aJAHsqc9NY7iL8F")\n';
        };
        group: 'fine-tunes';
        name: 'Retrieve fine-tune';
        path: 'retrieve';
        response: '{\n  "id": "ft-AF1WoRqd3aJAHsqc9NY7iL8F",\n  "object": "fine-tune",\n  "model": "curie",\n  "created_at": 1614807352,\n  "events": [\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807352,\n      "level": "info",\n      "message": "Job enqueued. Waiting for jobs ahead to complete. Queue number: 0."\n    },\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807356,\n      "level": "info",\n      "message": "Job started."\n    },\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807861,\n      "level": "info",\n      "message": "Uploaded snapshot: curie:ft-acmeco-2021-03-03-21-44-20."\n    },\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807864,\n      "level": "info",\n      "message": "Uploaded result files: file-QQm6ZpqdNwAaVC3aSz5sWwLT."\n    },\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807864,\n      "level": "info",\n      "message": "Job succeeded."\n    }\n  ],\n  "fine_tuned_model": "curie:ft-acmeco-2021-03-03-21-44-20",\n  "hyperparams": {\n    "batch_size": 4,\n    "learning_rate_multiplier": 0.1,\n    "n_epochs": 4,\n    "prompt_loss_weight": 0.1,\n  },\n  "organization_id": "org-...",\n  "result_files": [\n    {\n      "id": "file-QQm6ZpqdNwAaVC3aSz5sWwLT",\n      "object": "file",\n      "bytes": 81509,\n      "created_at": 1614807863,\n      "filename": "compiled_results.csv",\n      "purpose": "fine-tune-results"\n    }\n  ],\n  "status": "succeeded",\n  "validation_files": [],\n  "training_files": [\n    {\n      "id": "file-XGinujblHPwGLSztz8cPS8XY",\n      "object": "file",\n      "bytes": 1547276,\n      "created_at": 1610062281,\n      "filename": "my-data-train.jsonl",\n      "purpose": "fine-tune-train"\n    }\n  ],\n  "updated_at": 1614807865,\n}\n';
      };
    };
  };
  '/fine-tunes/{fine_tune_id}/cancel': {
    post: {
      operationId: 'cancelFineTune';
      parameters: [
        {
          description: 'The ID of the fine-tune job to cancel\n';
          in: 'path';
          name: 'fine_tune_id';
          required: true;
          schema: {
            example: 'ft-AF1WoRqd3aJAHsqc9NY7iL8F';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/FineTune';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Immediately cancel a fine-tune job.\n';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/fine-tunes/ft-AF1WoRqd3aJAHsqc9NY7iL8F/cancel \\\n  -X POST \\\n  -H "Authorization: Bearer YOUR_API_KEY"\n';
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.cancelFineTune("ft-AF1WoRqd3aJAHsqc9NY7iL8F");\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.FineTune.cancel(id="ft-AF1WoRqd3aJAHsqc9NY7iL8F")\n';
        };
        group: 'fine-tunes';
        name: 'Cancel fine-tune';
        path: 'cancel';
        response: '{\n  "id": "ft-xhrpBbvVUzYGo8oUO1FY4nI7",\n  "object": "fine-tune",\n  "model": "curie",\n  "created_at": 1614807770,\n  "events": [ { ... } ],\n  "fine_tuned_model": null,\n  "hyperparams": { ... },\n  "organization_id": "org-...",\n  "result_files": [],\n  "status": "cancelled",\n  "validation_files": [],\n  "training_files": [\n    {\n      "id": "file-XGinujblHPwGLSztz8cPS8XY",\n      "object": "file",\n      "bytes": 1547276,\n      "created_at": 1610062281,\n      "filename": "my-data-train.jsonl",\n      "purpose": "fine-tune-train"\n    }\n  ],\n  "updated_at": 1614807789,\n}\n';
      };
    };
  };
  '/fine-tunes/{fine_tune_id}/events': {
    get: {
      operationId: 'listFineTuneEvents';
      parameters: [
        {
          description: 'The ID of the fine-tune job to get events for.\n';
          in: 'path';
          name: 'fine_tune_id';
          required: true;
          schema: {
            example: 'ft-AF1WoRqd3aJAHsqc9NY7iL8F';
            type: 'string';
          };
        },
        {
          description: 'Whether to stream events for the fine-tune job. If set to true,\nevents will be sent as data-only\n[server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format)\nas they become available. The stream will terminate with a\n`data: [DONE]` message when the job is finished (succeeded, cancelled,\nor failed).\n\nIf set to false, only events generated so far will be returned.\n';
          in: 'query';
          name: 'stream';
          required: false;
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
                $ref: '#/components/schemas/ListFineTuneEventsResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Get fine-grained status updates for a fine-tune job.\n';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/fine-tunes/ft-AF1WoRqd3aJAHsqc9NY7iL8F/events \\\n  -H "Authorization: Bearer YOUR_API_KEY"\n';
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.listFineTuneEvents("ft-AF1WoRqd3aJAHsqc9NY7iL8F");\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.FineTune.list_events(id="ft-AF1WoRqd3aJAHsqc9NY7iL8F")\n';
        };
        group: 'fine-tunes';
        name: 'List fine-tune events';
        path: 'events';
        response: '{\n  "object": "list",\n  "data": [\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807352,\n      "level": "info",\n      "message": "Job enqueued. Waiting for jobs ahead to complete. Queue number: 0."\n    },\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807356,\n      "level": "info",\n      "message": "Job started."\n    },\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807861,\n      "level": "info",\n      "message": "Uploaded snapshot: curie:ft-acmeco-2021-03-03-21-44-20."\n    },\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807864,\n      "level": "info",\n      "message": "Uploaded result files: file-QQm6ZpqdNwAaVC3aSz5sWwLT."\n    },\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807864,\n      "level": "info",\n      "message": "Job succeeded."\n    }\n  ]\n}\n';
      };
    };
  };
  '/images/edits': {
    post: {
      operationId: 'createImageEdit';
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/CreateImageEditRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ImagesResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Creates an edited or extended image given an original image and a prompt.';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        beta: true;
        examples: {
          curl: "curl https://api.openai.com/v1/images/edits \\\n  -H 'Authorization: Bearer YOUR_API_KEY' \\\n  -F image='@otter.png' \\\n  -F mask='@mask.png' \\\n  -F prompt=\"A cute baby sea otter wearing a beret\" \\\n  -F n=2 \\\n  -F size=\"1024x1024\"\n";
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createImageEdit(\n  fs.createReadStream("otter.png"),\n  fs.createReadStream("mask.png"),\n  "A cute baby sea otter wearing a beret",\n  2,\n  "1024x1024"\n);\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Image.create_edit(\n  image=open("otter.png", "rb"),\n  mask=open("mask.png", "rb"),\n  prompt="A cute baby sea otter wearing a beret",\n  n=2,\n  size="1024x1024"\n)\n';
        };
        group: 'images';
        name: 'Create image edit';
        path: 'create-edit';
        response: '{\n  "created": 1589478378,\n  "data": [\n    {\n      "url": "https://..."\n    },\n    {\n      "url": "https://..."\n    }\n  ]\n}\n';
      };
    };
  };
  '/images/generations': {
    post: {
      operationId: 'createImage';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateImageRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ImagesResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Creates an image given a prompt.';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        beta: true;
        examples: {
          curl: 'curl https://api.openai.com/v1/images/generations \\\n  -H \'Content-Type: application/json\' \\\n  -H \'Authorization: Bearer YOUR_API_KEY\' \\\n  -d \'{\n  "prompt": "A cute baby sea otter",\n  "n": 2,\n  "size": "1024x1024"\n}\'\n';
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createImage({\n  prompt: "A cute baby sea otter",\n  n: 2,\n  size: "1024x1024",\n});\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Image.create(\n  prompt="A cute baby sea otter",\n  n=2,\n  size="1024x1024"\n)\n';
        };
        group: 'images';
        name: 'Create image';
        parameters: '{\n  "prompt": "A cute baby sea otter",\n  "n": 2,\n  "size": "1024x1024"\n}\n';
        path: 'create';
        response: '{\n  "created": 1589478378,\n  "data": [\n    {\n      "url": "https://..."\n    },\n    {\n      "url": "https://..."\n    }\n  ]\n}\n';
      };
    };
  };
  '/images/variations': {
    post: {
      operationId: 'createImageVariation';
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/CreateImageVariationRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ImagesResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Creates a variation of a given image.';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        beta: true;
        examples: {
          curl: "curl https://api.openai.com/v1/images/variations \\\n  -H 'Authorization: Bearer YOUR_API_KEY' \\\n  -F image='@otter.png' \\\n  -F n=2 \\\n  -F size=\"1024x1024\"\n";
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createImageVariation(\n  fs.createReadStream("otter.png"),\n  2,\n  "1024x1024"\n);\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Image.create_variation(\n  image=open("otter.png", "rb"),\n  n=2,\n  size="1024x1024"\n)\n';
        };
        group: 'images';
        name: 'Create image variation';
        path: 'create-variation';
        response: '{\n  "created": 1589478378,\n  "data": [\n    {\n      "url": "https://..."\n    },\n    {\n      "url": "https://..."\n    }\n  ]\n}\n';
      };
    };
  };
  '/models': {
    get: {
      operationId: 'listModels';
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListModelsResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Lists the currently available models, and provides basic information about each one such as the owner and availability.';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/models \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\n";
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.listModels();\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Model.list()\n';
        };
        group: 'models';
        name: 'List models';
        path: 'list';
        response: '{\n  "data": [\n    {\n      "id": "model-id-0",\n      "object": "model",\n      "owned_by": "organization-owner",\n      "permission": [...]\n    },\n    {\n      "id": "model-id-1",\n      "object": "model",\n      "owned_by": "organization-owner",\n      "permission": [...]\n    },\n    {\n      "id": "model-id-2",\n      "object": "model",\n      "owned_by": "openai",\n      "permission": [...]\n    },\n  ],\n  "object": "list"\n}\n';
      };
    };
  };
  '/models/{model}': {
    delete: {
      operationId: 'deleteModel';
      parameters: [
        {
          description: 'The model to delete';
          in: 'path';
          name: 'model';
          required: true;
          schema: {
            example: 'curie:ft-acmeco-2021-03-03-21-44-20';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeleteModelResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Delete a fine-tuned model. You must have the Owner role in your organization.';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/models/curie:ft-acmeco-2021-03-03-21-44-20 \\\n  -X DELETE \\\n  -H "Authorization: Bearer YOUR_API_KEY"\n';
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.deleteModel(\'curie:ft-acmeco-2021-03-03-21-44-20\');\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Model.delete("curie:ft-acmeco-2021-03-03-21-44-20")\n';
        };
        group: 'fine-tunes';
        name: 'Delete fine-tune model';
        path: 'delete-model';
        response: '{\n  "id": "curie:ft-acmeco-2021-03-03-21-44-20",\n  "object": "model",\n  "deleted": true\n}\n';
      };
    };
    get: {
      operationId: 'retrieveModel';
      parameters: [
        {
          description: 'The ID of the model to use for this request';
          in: 'path';
          name: 'model';
          required: true;
          schema: {
            example: 'text-davinci-001';
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Model';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: 'Retrieves a model instance, providing basic information about the model such as the owner and permissioning.';
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/models/VAR_model_id \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\n";
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.retrieveModel("VAR_model_id");\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Model.retrieve("VAR_model_id")\n';
        };
        group: 'models';
        name: 'Retrieve model';
        path: 'retrieve';
        response: '{\n  "id": "VAR_model_id",\n  "object": "model",\n  "owned_by": "openai",\n  "permission": [...]\n}\n';
      };
    };
  };
  '/moderations': {
    post: {
      operationId: 'createModeration';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateModerationRequest';
            };
          };
        };
        required: true;
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateModerationResponse';
              };
            };
          };
          description: 'OK';
        };
      };
      summary: "Classifies if text violates OpenAI's Content Policy";
      tags: ['OpenAI'];
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/moderations \\\n  -H 'Content-Type: application/json' \\\n  -H 'Authorization: Bearer YOUR_API_KEY' \\\n  -d '{\n  \"input\": \"I want to kill them.\"\n}'\n";
          'node.js': 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createModeration({\n  input: "I want to kill them.",\n});\n';
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Moderation.create(\n  input="I want to kill them.",\n)\n';
        };
        group: 'moderations';
        name: 'Create moderation';
        parameters: '{\n  "input": "I want to kill them."\n}\n';
        path: 'create';
        response: '{\n  "id": "modr-5MWoLO",\n  "model": "text-moderation-001",\n  "results": [\n    {\n      "categories": {\n        "hate": false,\n        "hate/threatening": true,\n        "self-harm": false,\n        "sexual": false,\n        "sexual/minors": false,\n        "violence": true,\n        "violence/graphic": false\n      },\n      "category_scores": {\n        "hate": 0.22714105248451233,\n        "hate/threatening": 0.4132447838783264,\n        "self-harm": 0.005232391878962517,\n        "sexual": 0.01407341007143259,\n        "sexual/minors": 0.0038522258400917053,\n        "violence": 0.9223177433013916,\n        "violence/graphic": 0.036865197122097015\n      },\n      "flagged": true\n    }\n  ]\n}\n';
      };
    };
  };
};
export const paths = {
  '/answers': {
    post: {
      deprecated: true,
      operationId: 'createAnswer',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateAnswerRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateAnswerResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary:
        'Answers the specified question using the provided documents and examples.\n\nThe endpoint first [searches](/docs/api-reference/searches) over provided documents or files to find relevant context. The relevant context is combined with the provided examples and question to create the prompt for [completion](/docs/api-reference/completions).\n',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/answers \\\n  -X POST \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{\n    "documents": ["Puppy A is happy.", "Puppy B is sad."],\n    "question": "which puppy is happy?",\n    "search_model": "ada",\n    "model": "curie",\n    "examples_context": "In 2017, U.S. life expectancy was 78.6 years.",\n    "examples": [["What is human life expectancy in the United States?","78 years."]],\n    "max_tokens": 5,\n    "stop": ["\\n", "<|endoftext|>"]\n  }\'\n',
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createAnswer({\n  search_model: "ada",\n  model: "curie",\n  question: "which puppy is happy?",\n  documents: ["Puppy A is happy.", "Puppy B is sad."],\n  examples_context: "In 2017, U.S. life expectancy was 78.6 years.",\n  examples: [["What is human life expectancy in the United States?","78 years."]],\n  max_tokens: 5,\n  stop: ["\\n", "<|endoftext|>"],\n});\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Answer.create(\n  search_model="ada",\n  model="curie",\n  question="which puppy is happy?",\n  documents=["Puppy A is happy.", "Puppy B is sad."],\n  examples_context="In 2017, U.S. life expectancy was 78.6 years.",\n  examples=[["What is human life expectancy in the United States?","78 years."]],\n  max_tokens=5,\n  stop=["\\n", "<|endoftext|>"],\n)\n',
        },
        group: 'answers',
        name: 'Create answer',
        parameters:
          '{\n  "documents": ["Puppy A is happy.", "Puppy B is sad."],\n  "question": "which puppy is happy?",\n  "search_model": "ada",\n  "model": "curie",\n  "examples_context": "In 2017, U.S. life expectancy was 78.6 years.",\n  "examples": [["What is human life expectancy in the United States?","78 years."]],\n  "max_tokens": 5,\n  "stop": ["\\n", "<|endoftext|>"]\n}\n',
        path: 'create',
        response:
          '{\n  "answers": [\n    "puppy A."\n  ],\n  "completion": "cmpl-2euVa1kmKUuLpSX600M41125Mo9NI",\n  "model": "curie:2020-05-03",\n  "object": "answer",\n  "search_model": "ada",\n  "selected_documents": [\n    {\n      "document": 0,\n      "text": "Puppy A is happy. "\n    },\n    {\n      "document": 1,\n      "text": "Puppy B is sad. "\n    }\n  ]\n}\n',
      },
    },
  },
  '/audio/transcriptions': {
    post: {
      operationId: 'createTranscription',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/CreateTranscriptionRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateTranscriptionResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: 'Transcribes audio into the input language.',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        beta: true,
        examples: {
          curl: "curl https://api.openai.com/v1/audio/transcriptions \\\n  -X POST \\\n  -H 'Authorization: Bearer TOKEN' \\\n  -H 'Content-Type: multipart/form-data' \\\n  -F file=@/path/to/file/audio.mp3 \\\n  -F model=whisper-1\n",
          node: 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst resp = await openai.createTranscription(\n  fs.createReadStream("audio.mp3"),\n  "whisper-1"\n);\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\naudio_file = open("audio.mp3", "rb")\ntranscript = openai.Audio.transcribe("whisper-1", audio_file)\n',
        },
        group: 'audio',
        name: 'Create transcription',
        parameters: '{\n  "file": "audio.mp3",\n  "model": "whisper-1"\n}\n',
        path: 'create',
        response:
          '{\n  "text": "Imagine the wildest idea that you\'ve ever had, and you\'re curious about how it might scale to something that\'s a 100, a 1,000 times bigger. This is a place where you can get to do that."\n}\n',
      },
    },
  },
  '/audio/translations': {
    post: {
      operationId: 'createTranslation',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/CreateTranslationRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateTranslationResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: 'Translates audio into into English.',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        beta: true,
        examples: {
          curl: "curl https://api.openai.com/v1/audio/translations \\\n    -X POST \\\n    -H 'Authorization: Bearer TOKEN' \\\n    -H 'Content-Type: multipart/form-data' \\\n    -F file=@/path/to/file/german.m4a \\\n    -F model=whisper-1\n",
          node: 'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst resp = await openai.createTranslation(\n  fs.createReadStream("audio.mp3"),\n  "whisper-1"\n);\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\naudio_file = open("german.m4a", "rb")\ntranscript = openai.Audio.translate("whisper-1", audio_file)\n',
        },
        group: 'audio',
        name: 'Create translation',
        parameters: '{\n  "file": "german.m4a",\n  "model": "whisper-1"\n}\n',
        path: 'create',
        response:
          '{\n  "text": "Hello, my name is Wolfgang and I come from Germany. Where are you heading today?"\n}\n',
      },
    },
  },
  '/chat/completions': {
    post: {
      operationId: 'createChatCompletion',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateChatCompletionRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateChatCompletionResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: 'Creates a completion for the chat message',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        beta: true,
        examples: {
          curl: 'curl https://api.openai.com/v1/chat/completions \\\n  -H \'Content-Type: application/json\' \\\n  -H \'Authorization: Bearer YOUR_API_KEY\' \\\n  -d \'{\n  "model": "gpt-3.5-turbo",\n  "messages": [{"role": "user", "content": "Hello!"}]\n}\'\n',
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\n\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\n\nconst completion = await openai.createChatCompletion({\n  model: "gpt-3.5-turbo",\n  messages: [{role: "user", content: "Hello world"}],\n});\nconsole.log(completion.data.choices[0].message);\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\n\ncompletion = openai.ChatCompletion.create(\n  model="gpt-3.5-turbo",\n  messages=[\n    {"role": "user", "content": "Hello!"}\n  ]\n)\n\nprint(completion.choices[0].message)\n',
        },
        group: 'chat',
        name: 'Create chat completion',
        parameters: '{\n  "model": "gpt-3.5-turbo",\n  "messages": [{"role": "user", "content": "Hello!"}]\n}\n',
        path: 'create',
        response:
          '{\n  "id": "chatcmpl-123",\n  "object": "chat.completion",\n  "created": 1677652288,\n  "choices": [{\n    "index": 0,\n    "message": {\n      "role": "assistant",\n      "content": "\\n\\nHello there, how may I assist you today?",\n    },\n    "finish_reason": "stop"\n  }],\n  "usage": {\n    "prompt_tokens": 9,\n    "completion_tokens": 12,\n    "total_tokens": 21\n  }\n}\n',
      },
    },
  },
  '/classifications': {
    post: {
      deprecated: true,
      operationId: 'createClassification',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateClassificationRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateClassificationResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary:
        'Classifies the specified `query` using provided examples.\n\nThe endpoint first [searches](/docs/api-reference/searches) over the labeled examples\nto select the ones most relevant for the particular query. Then, the relevant examples\nare combined with the query to construct a prompt to produce the final label via the\n[completions](/docs/api-reference/completions) endpoint.\n\nLabeled examples can be provided via an uploaded `file`, or explicitly listed in the\nrequest using the `examples` parameter for quick tests and small scale use cases.\n',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/classifications \\\n  -X POST \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{\n    "examples": [\n      ["A happy moment", "Positive"],\n      ["I am sad.", "Negative"],\n      ["I am feeling awesome", "Positive"]],\n    "query": "It is a raining day :(",\n    "search_model": "ada",\n    "model": "curie",\n    "labels":["Positive", "Negative", "Neutral"]\n  }\'\n',
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createClassification({\n  search_model: "ada",\n  model: "curie",\n  examples: [\n    ["A happy moment", "Positive"],\n    ["I am sad.", "Negative"],\n    ["I am feeling awesome", "Positive"]\n  ],\n  query:"It is a raining day :(",\n  labels: ["Positive", "Negative", "Neutral"],\n});\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Classification.create(\n  search_model="ada",\n  model="curie",\n  examples=[\n    ["A happy moment", "Positive"],\n    ["I am sad.", "Negative"],\n    ["I am feeling awesome", "Positive"]\n  ],\n  query="It is a raining day :(",\n  labels=["Positive", "Negative", "Neutral"],\n)\n',
        },
        group: 'classifications',
        name: 'Create classification',
        parameters:
          '{\n  "examples": [\n    ["A happy moment", "Positive"],\n    ["I am sad.", "Negative"],\n    ["I am feeling awesome", "Positive"]\n  ],\n  "labels": ["Positive", "Negative", "Neutral"],\n  "query": "It is a raining day :(",\n  "search_model": "ada",\n  "model": "curie"\n}\n',
        path: 'create',
        response:
          '{\n  "completion": "cmpl-2euN7lUVZ0d4RKbQqRV79IiiE6M1f",\n  "label": "Negative",\n  "model": "curie:2020-05-03",\n  "object": "classification",\n  "search_model": "ada",\n  "selected_examples": [\n    {\n      "document": 1,\n      "label": "Negative",\n      "text": "I am sad."\n    },\n    {\n      "document": 0,\n      "label": "Positive",\n      "text": "A happy moment"\n    },\n    {\n      "document": 2,\n      "label": "Positive",\n      "text": "I am feeling awesome"\n    }\n  ]\n}\n',
      },
    },
  },
  '/completions': {
    post: {
      operationId: 'createCompletion',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateCompletionRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateCompletionResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: 'Creates a completion for the provided prompt and parameters',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/completions \\\n  -H \'Content-Type: application/json\' \\\n  -H \'Authorization: Bearer YOUR_API_KEY\' \\\n  -d \'{\n  "model": "VAR_model_id",\n  "prompt": "Say this is a test",\n  "max_tokens": 7,\n  "temperature": 0\n}\'\n',
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createCompletion({\n  model: "VAR_model_id",\n  prompt: "Say this is a test",\n  max_tokens: 7,\n  temperature: 0,\n});\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Completion.create(\n  model="VAR_model_id",\n  prompt="Say this is a test",\n  max_tokens=7,\n  temperature=0\n)\n',
        },
        group: 'completions',
        name: 'Create completion',
        parameters:
          '{\n  "model": "VAR_model_id",\n  "prompt": "Say this is a test",\n  "max_tokens": 7,\n  "temperature": 0,\n  "top_p": 1,\n  "n": 1,\n  "stream": false,\n  "logprobs": null,\n  "stop": "\\n"\n}\n',
        path: 'create',
        response:
          '{\n  "id": "cmpl-uqkvlQyYK7bGYrRHQ0eXlWi7",\n  "object": "text_completion",\n  "created": 1589478378,\n  "model": "VAR_model_id",\n  "choices": [\n    {\n      "text": "\\n\\nThis is indeed a test",\n      "index": 0,\n      "logprobs": null,\n      "finish_reason": "length"\n    }\n  ],\n  "usage": {\n    "prompt_tokens": 5,\n    "completion_tokens": 7,\n    "total_tokens": 12\n  }\n}\n',
      },
    },
  },
  '/edits': {
    post: {
      operationId: 'createEdit',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateEditRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateEditResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: 'Creates a new edit for the provided input, instruction, and parameters.',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/edits \\\n  -H \'Content-Type: application/json\' \\\n  -H \'Authorization: Bearer YOUR_API_KEY\' \\\n  -d \'{\n  "model": "VAR_model_id",\n  "input": "What day of the wek is it?",\n  "instruction": "Fix the spelling mistakes"\n}\'\n',
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createEdit({\n  model: "VAR_model_id",\n  input: "What day of the wek is it?",\n  instruction: "Fix the spelling mistakes",\n});\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Edit.create(\n  model="VAR_model_id",\n  input="What day of the wek is it?",\n  instruction="Fix the spelling mistakes"\n)\n',
        },
        group: 'edits',
        name: 'Create edit',
        parameters:
          '{\n  "model": "VAR_model_id",\n  "input": "What day of the wek is it?",\n  "instruction": "Fix the spelling mistakes",\n}\n',
        path: 'create',
        response:
          '{\n  "object": "edit",\n  "created": 1589478378,\n  "choices": [\n    {\n      "text": "What day of the week is it?",\n      "index": 0,\n    }\n  ],\n  "usage": {\n    "prompt_tokens": 25,\n    "completion_tokens": 32,\n    "total_tokens": 57\n  }\n}\n',
      },
    },
  },
  '/embeddings': {
    post: {
      operationId: 'createEmbedding',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateEmbeddingRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateEmbeddingResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: 'Creates an embedding vector representing the input text.',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/embeddings \\\n  -X POST \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"input": "The food was delicious and the waiter...",\n       "model": "text-embedding-ada-002"}\'\n',
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createEmbedding({\n  model: "text-embedding-ada-002",\n  input: "The food was delicious and the waiter...",\n});\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Embedding.create(\n  model="text-embedding-ada-002",\n  input="The food was delicious and the waiter..."\n)\n',
        },
        group: 'embeddings',
        name: 'Create embeddings',
        parameters:
          '{\n  "model": "text-embedding-ada-002",\n  "input": "The food was delicious and the waiter..."\n}\n',
        path: 'create',
        response:
          '{\n  "object": "list",\n  "data": [\n    {\n      "object": "embedding",\n      "embedding": [\n        0.0023064255,\n        -0.009327292,\n        .... (1536 floats total for ada-002)\n        -0.0028842222,\n      ],\n      "index": 0\n    }\n  ],\n  "model": "text-embedding-ada-002",\n  "usage": {\n    "prompt_tokens": 8,\n    "total_tokens": 8\n  }\n}\n',
      },
    },
  },
  '/engines': {
    get: {
      deprecated: true,
      operationId: 'listEngines',
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListEnginesResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary:
        'Lists the currently available (non-finetuned) models, and provides basic information about each one such as the owner and availability.',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/engines \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\n",
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.listEngines();\n',
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Engine.list()\n',
        },
        group: 'engines',
        name: 'List engines',
        path: 'list',
        response:
          '{\n  "data": [\n    {\n      "id": "engine-id-0",\n      "object": "engine",\n      "owner": "organization-owner",\n      "ready": true\n    },\n    {\n      "id": "engine-id-2",\n      "object": "engine",\n      "owner": "organization-owner",\n      "ready": true\n    },\n    {\n      "id": "engine-id-3",\n      "object": "engine",\n      "owner": "openai",\n      "ready": false\n    },\n  ],\n  "object": "list"\n}\n',
      },
    },
  },
  '/engines/{engine_id}': {
    get: {
      deprecated: true,
      operationId: 'retrieveEngine',
      parameters: [
        {
          description: 'The ID of the engine to use for this request\n',
          in: 'path',
          name: 'engine_id',
          required: true,
          schema: {
            example: 'davinci',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Engine',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: 'Retrieves a model instance, providing basic information about it such as the owner and availability.',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/engines/VAR_model_id \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\n",
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.retrieveEngine("VAR_model_id");\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Engine.retrieve("VAR_model_id")\n',
        },
        group: 'engines',
        name: 'Retrieve engine',
        path: 'retrieve',
        response: '{\n  "id": "VAR_model_id",\n  "object": "engine",\n  "owner": "openai",\n  "ready": true\n}\n',
      },
    },
  },
  '/engines/{engine_id}/search': {
    post: {
      deprecated: true,
      operationId: 'createSearch',
      parameters: [
        {
          description:
            'The ID of the engine to use for this request.  You can select one of `ada`, `babbage`, `curie`, or `davinci`.',
          in: 'path',
          name: 'engine_id',
          required: true,
          schema: {
            example: 'davinci',
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateSearchRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateSearchResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary:
        'The search endpoint computes similarity scores between provided query and documents. Documents can be passed directly to the API if there are no more than 200 of them.\n\nTo go beyond the 200 document limit, documents can be processed offline and then used for efficient retrieval at query time. When `file` is set, the search endpoint searches over all the documents in the given file and returns up to the `max_rerank` number of documents. These documents will be returned along with their search scores.\n\nThe similarity score is a positive score that usually ranges from 0 to 300 (but can sometimes go higher), where a score above 200 usually means the document is semantically similar to the query.\n',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/engines/davinci/search \\\n  -H "Content-Type: application/json" \\\n  -H \'Authorization: Bearer YOUR_API_KEY\' \\\n  -d \'{\n  "documents": ["White House", "hospital", "school"],\n  "query": "the president"\n}\'\n',
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createSearch("davinci", {\n  documents: ["White House", "hospital", "school"],\n  query: "the president",\n});\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Engine("davinci").search(\n  documents=["White House", "hospital", "school"],\n  query="the president"\n)\n',
        },
        group: 'searches',
        name: 'Create search',
        parameters:
          '{\n  "documents": [\n    "White House",\n    "hospital",\n    "school"\n  ],\n  "query": "the president"\n}\n',
        path: 'create',
        response:
          '{\n  "data": [\n    {\n      "document": 0,\n      "object": "search_result",\n      "score": 215.412\n    },\n    {\n      "document": 1,\n      "object": "search_result",\n      "score": 40.316\n    },\n    {\n      "document": 2,\n      "object": "search_result",\n      "score":  55.226\n    }\n  ],\n  "object": "list"\n}\n',
      },
    },
  },
  '/files': {
    get: {
      operationId: 'listFiles',
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListFilesResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: "Returns a list of files that belong to the user's organization.",
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/files \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\n",
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.listFiles();\n',
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.File.list()\n',
        },
        group: 'files',
        name: 'List files',
        path: 'list',
        response:
          '{\n  "data": [\n    {\n      "id": "file-ccdDZrC3iZVNiQVeEA6Z66wf",\n      "object": "file",\n      "bytes": 175,\n      "created_at": 1613677385,\n      "filename": "train.jsonl",\n      "purpose": "search"\n    },\n    {\n      "id": "file-XjGxS3KTG0uNmNOK362iJua3",\n      "object": "file",\n      "bytes": 140,\n      "created_at": 1613779121,\n      "filename": "puppy.jsonl",\n      "purpose": "search"\n    }\n  ],\n  "object": "list"\n}\n',
      },
    },
    post: {
      operationId: 'createFile',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/CreateFileRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/OpenAIFile',
              },
            },
          },
          description: 'OK',
        },
      },
      summary:
        'Upload a file that contains document(s) to be used across various endpoints/features. Currently, the size of all the files uploaded by one organization can be up to 1 GB. Please contact us if you need to increase the storage limit.\n',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/files \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -F purpose="fine-tune" \\\n  -F file=\'@mydata.jsonl\'\n',
          'node.js':
            'const fs = require("fs");\nconst { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createFile(\n  fs.createReadStream("mydata.jsonl"),\n  "fine-tune"\n);\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.File.create(\n  file=open("mydata.jsonl", "rb"),\n  purpose=\'fine-tune\'\n)\n',
        },
        group: 'files',
        name: 'Upload file',
        path: 'upload',
        response:
          '{\n  "id": "file-XjGxS3KTG0uNmNOK362iJua3",\n  "object": "file",\n  "bytes": 140,\n  "created_at": 1613779121,\n  "filename": "mydata.jsonl",\n  "purpose": "fine-tune"\n}\n',
      },
    },
  },
  '/files/{file_id}': {
    delete: {
      operationId: 'deleteFile',
      parameters: [
        {
          description: 'The ID of the file to use for this request',
          in: 'path',
          name: 'file_id',
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
                $ref: '#/components/schemas/DeleteFileResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: 'Delete a file.',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/files/file-XjGxS3KTG0uNmNOK362iJua3 \\\n  -X DELETE \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\n",
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.deleteFile("file-XjGxS3KTG0uNmNOK362iJua3");\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.File.delete("file-XjGxS3KTG0uNmNOK362iJua3")\n',
        },
        group: 'files',
        name: 'Delete file',
        path: 'delete',
        response: '{\n  "id": "file-XjGxS3KTG0uNmNOK362iJua3",\n  "object": "file",\n  "deleted": true\n}\n',
      },
    },
    get: {
      operationId: 'retrieveFile',
      parameters: [
        {
          description: 'The ID of the file to use for this request',
          in: 'path',
          name: 'file_id',
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
                $ref: '#/components/schemas/OpenAIFile',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: 'Returns information about a specific file.',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/files/file-XjGxS3KTG0uNmNOK362iJua3 \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\n",
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.retrieveFile("file-XjGxS3KTG0uNmNOK362iJua3");\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.File.retrieve("file-XjGxS3KTG0uNmNOK362iJua3")\n',
        },
        group: 'files',
        name: 'Retrieve file',
        path: 'retrieve',
        response:
          '{\n  "id": "file-XjGxS3KTG0uNmNOK362iJua3",\n  "object": "file",\n  "bytes": 140,\n  "created_at": 1613779657,\n  "filename": "mydata.jsonl",\n  "purpose": "fine-tune"\n}\n',
      },
    },
  },
  '/files/{file_id}/content': {
    get: {
      operationId: 'downloadFile',
      parameters: [
        {
          description: 'The ID of the file to use for this request',
          in: 'path',
          name: 'file_id',
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
                type: 'string',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: 'Returns the contents of the specified file',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/files/file-XjGxS3KTG0uNmNOK362iJua3/content \\\n  -H 'Authorization: Bearer YOUR_API_KEY' > file.jsonl\n",
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.downloadFile("file-XjGxS3KTG0uNmNOK362iJua3");\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\ncontent = openai.File.download("file-XjGxS3KTG0uNmNOK362iJua3")\n',
        },
        group: 'files',
        name: 'Retrieve file content',
        path: 'retrieve-content',
      },
    },
  },
  '/fine-tunes': {
    get: {
      operationId: 'listFineTunes',
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListFineTunesResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: "List your organization's fine-tuning jobs\n",
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/fine-tunes \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\n",
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.listFineTunes();\n',
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.FineTune.list()\n',
        },
        group: 'fine-tunes',
        name: 'List fine-tunes',
        path: 'list',
        response:
          '{\n  "object": "list",\n  "data": [\n    {\n      "id": "ft-AF1WoRqd3aJAHsqc9NY7iL8F",\n      "object": "fine-tune",\n      "model": "curie",\n      "created_at": 1614807352,\n      "fine_tuned_model": null,\n      "hyperparams": { ... },\n      "organization_id": "org-...",\n      "result_files": [],\n      "status": "pending",\n      "validation_files": [],\n      "training_files": [ { ... } ],\n      "updated_at": 1614807352,\n    },\n    { ... },\n    { ... }\n  ]\n}\n',
      },
    },
    post: {
      operationId: 'createFineTune',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateFineTuneRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/FineTune',
              },
            },
          },
          description: 'OK',
        },
      },
      summary:
        'Creates a job that fine-tunes a specified model from a given dataset.\n\nResponse includes details of the enqueued job including job status and the name of the fine-tuned models once complete.\n\n[Learn more about Fine-tuning](/docs/guides/fine-tuning)\n',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/fine-tunes \\\n  -X POST \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -d \'{\n  "training_file": "file-XGinujblHPwGLSztz8cPS8XY"\n}\'\n',
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createFineTune({\n  training_file: "file-XGinujblHPwGLSztz8cPS8XY",\n});\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.FineTune.create(training_file="file-XGinujblHPwGLSztz8cPS8XY")\n',
        },
        group: 'fine-tunes',
        name: 'Create fine-tune',
        path: 'create',
        response:
          '{\n  "id": "ft-AF1WoRqd3aJAHsqc9NY7iL8F",\n  "object": "fine-tune",\n  "model": "curie",\n  "created_at": 1614807352,\n  "events": [\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807352,\n      "level": "info",\n      "message": "Job enqueued. Waiting for jobs ahead to complete. Queue number: 0."\n    }\n  ],\n  "fine_tuned_model": null,\n  "hyperparams": {\n    "batch_size": 4,\n    "learning_rate_multiplier": 0.1,\n    "n_epochs": 4,\n    "prompt_loss_weight": 0.1,\n  },\n  "organization_id": "org-...",\n  "result_files": [],\n  "status": "pending",\n  "validation_files": [],\n  "training_files": [\n    {\n      "id": "file-XGinujblHPwGLSztz8cPS8XY",\n      "object": "file",\n      "bytes": 1547276,\n      "created_at": 1610062281,\n      "filename": "my-data-train.jsonl",\n      "purpose": "fine-tune-train"\n    }\n  ],\n  "updated_at": 1614807352,\n}\n',
      },
    },
  },
  '/fine-tunes/{fine_tune_id}': {
    get: {
      operationId: 'retrieveFineTune',
      parameters: [
        {
          description: 'The ID of the fine-tune job\n',
          in: 'path',
          name: 'fine_tune_id',
          required: true,
          schema: {
            example: 'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/FineTune',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: 'Gets info about the fine-tune job.\n\n[Learn more about Fine-tuning](/docs/guides/fine-tuning)\n',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/fine-tunes/ft-AF1WoRqd3aJAHsqc9NY7iL8F \\\n  -H "Authorization: Bearer YOUR_API_KEY"\n',
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.retrieveFineTune("ft-AF1WoRqd3aJAHsqc9NY7iL8F");\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.FineTune.retrieve(id="ft-AF1WoRqd3aJAHsqc9NY7iL8F")\n',
        },
        group: 'fine-tunes',
        name: 'Retrieve fine-tune',
        path: 'retrieve',
        response:
          '{\n  "id": "ft-AF1WoRqd3aJAHsqc9NY7iL8F",\n  "object": "fine-tune",\n  "model": "curie",\n  "created_at": 1614807352,\n  "events": [\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807352,\n      "level": "info",\n      "message": "Job enqueued. Waiting for jobs ahead to complete. Queue number: 0."\n    },\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807356,\n      "level": "info",\n      "message": "Job started."\n    },\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807861,\n      "level": "info",\n      "message": "Uploaded snapshot: curie:ft-acmeco-2021-03-03-21-44-20."\n    },\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807864,\n      "level": "info",\n      "message": "Uploaded result files: file-QQm6ZpqdNwAaVC3aSz5sWwLT."\n    },\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807864,\n      "level": "info",\n      "message": "Job succeeded."\n    }\n  ],\n  "fine_tuned_model": "curie:ft-acmeco-2021-03-03-21-44-20",\n  "hyperparams": {\n    "batch_size": 4,\n    "learning_rate_multiplier": 0.1,\n    "n_epochs": 4,\n    "prompt_loss_weight": 0.1,\n  },\n  "organization_id": "org-...",\n  "result_files": [\n    {\n      "id": "file-QQm6ZpqdNwAaVC3aSz5sWwLT",\n      "object": "file",\n      "bytes": 81509,\n      "created_at": 1614807863,\n      "filename": "compiled_results.csv",\n      "purpose": "fine-tune-results"\n    }\n  ],\n  "status": "succeeded",\n  "validation_files": [],\n  "training_files": [\n    {\n      "id": "file-XGinujblHPwGLSztz8cPS8XY",\n      "object": "file",\n      "bytes": 1547276,\n      "created_at": 1610062281,\n      "filename": "my-data-train.jsonl",\n      "purpose": "fine-tune-train"\n    }\n  ],\n  "updated_at": 1614807865,\n}\n',
      },
    },
  },
  '/fine-tunes/{fine_tune_id}/cancel': {
    post: {
      operationId: 'cancelFineTune',
      parameters: [
        {
          description: 'The ID of the fine-tune job to cancel\n',
          in: 'path',
          name: 'fine_tune_id',
          required: true,
          schema: {
            example: 'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/FineTune',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: 'Immediately cancel a fine-tune job.\n',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/fine-tunes/ft-AF1WoRqd3aJAHsqc9NY7iL8F/cancel \\\n  -X POST \\\n  -H "Authorization: Bearer YOUR_API_KEY"\n',
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.cancelFineTune("ft-AF1WoRqd3aJAHsqc9NY7iL8F");\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.FineTune.cancel(id="ft-AF1WoRqd3aJAHsqc9NY7iL8F")\n',
        },
        group: 'fine-tunes',
        name: 'Cancel fine-tune',
        path: 'cancel',
        response:
          '{\n  "id": "ft-xhrpBbvVUzYGo8oUO1FY4nI7",\n  "object": "fine-tune",\n  "model": "curie",\n  "created_at": 1614807770,\n  "events": [ { ... } ],\n  "fine_tuned_model": null,\n  "hyperparams": { ... },\n  "organization_id": "org-...",\n  "result_files": [],\n  "status": "cancelled",\n  "validation_files": [],\n  "training_files": [\n    {\n      "id": "file-XGinujblHPwGLSztz8cPS8XY",\n      "object": "file",\n      "bytes": 1547276,\n      "created_at": 1610062281,\n      "filename": "my-data-train.jsonl",\n      "purpose": "fine-tune-train"\n    }\n  ],\n  "updated_at": 1614807789,\n}\n',
      },
    },
  },
  '/fine-tunes/{fine_tune_id}/events': {
    get: {
      operationId: 'listFineTuneEvents',
      parameters: [
        {
          description: 'The ID of the fine-tune job to get events for.\n',
          in: 'path',
          name: 'fine_tune_id',
          required: true,
          schema: {
            example: 'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
            type: 'string',
          },
        },
        {
          description:
            'Whether to stream events for the fine-tune job. If set to true,\nevents will be sent as data-only\n[server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format)\nas they become available. The stream will terminate with a\n`data: [DONE]` message when the job is finished (succeeded, cancelled,\nor failed).\n\nIf set to false, only events generated so far will be returned.\n',
          in: 'query',
          name: 'stream',
          required: false,
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
                $ref: '#/components/schemas/ListFineTuneEventsResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: 'Get fine-grained status updates for a fine-tune job.\n',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/fine-tunes/ft-AF1WoRqd3aJAHsqc9NY7iL8F/events \\\n  -H "Authorization: Bearer YOUR_API_KEY"\n',
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.listFineTuneEvents("ft-AF1WoRqd3aJAHsqc9NY7iL8F");\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.FineTune.list_events(id="ft-AF1WoRqd3aJAHsqc9NY7iL8F")\n',
        },
        group: 'fine-tunes',
        name: 'List fine-tune events',
        path: 'events',
        response:
          '{\n  "object": "list",\n  "data": [\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807352,\n      "level": "info",\n      "message": "Job enqueued. Waiting for jobs ahead to complete. Queue number: 0."\n    },\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807356,\n      "level": "info",\n      "message": "Job started."\n    },\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807861,\n      "level": "info",\n      "message": "Uploaded snapshot: curie:ft-acmeco-2021-03-03-21-44-20."\n    },\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807864,\n      "level": "info",\n      "message": "Uploaded result files: file-QQm6ZpqdNwAaVC3aSz5sWwLT."\n    },\n    {\n      "object": "fine-tune-event",\n      "created_at": 1614807864,\n      "level": "info",\n      "message": "Job succeeded."\n    }\n  ]\n}\n',
      },
    },
  },
  '/images/edits': {
    post: {
      operationId: 'createImageEdit',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/CreateImageEditRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ImagesResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: 'Creates an edited or extended image given an original image and a prompt.',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        beta: true,
        examples: {
          curl: "curl https://api.openai.com/v1/images/edits \\\n  -H 'Authorization: Bearer YOUR_API_KEY' \\\n  -F image='@otter.png' \\\n  -F mask='@mask.png' \\\n  -F prompt=\"A cute baby sea otter wearing a beret\" \\\n  -F n=2 \\\n  -F size=\"1024x1024\"\n",
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createImageEdit(\n  fs.createReadStream("otter.png"),\n  fs.createReadStream("mask.png"),\n  "A cute baby sea otter wearing a beret",\n  2,\n  "1024x1024"\n);\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Image.create_edit(\n  image=open("otter.png", "rb"),\n  mask=open("mask.png", "rb"),\n  prompt="A cute baby sea otter wearing a beret",\n  n=2,\n  size="1024x1024"\n)\n',
        },
        group: 'images',
        name: 'Create image edit',
        path: 'create-edit',
        response:
          '{\n  "created": 1589478378,\n  "data": [\n    {\n      "url": "https://..."\n    },\n    {\n      "url": "https://..."\n    }\n  ]\n}\n',
      },
    },
  },
  '/images/generations': {
    post: {
      operationId: 'createImage',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateImageRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ImagesResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: 'Creates an image given a prompt.',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        beta: true,
        examples: {
          curl: 'curl https://api.openai.com/v1/images/generations \\\n  -H \'Content-Type: application/json\' \\\n  -H \'Authorization: Bearer YOUR_API_KEY\' \\\n  -d \'{\n  "prompt": "A cute baby sea otter",\n  "n": 2,\n  "size": "1024x1024"\n}\'\n',
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createImage({\n  prompt: "A cute baby sea otter",\n  n: 2,\n  size: "1024x1024",\n});\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Image.create(\n  prompt="A cute baby sea otter",\n  n=2,\n  size="1024x1024"\n)\n',
        },
        group: 'images',
        name: 'Create image',
        parameters: '{\n  "prompt": "A cute baby sea otter",\n  "n": 2,\n  "size": "1024x1024"\n}\n',
        path: 'create',
        response:
          '{\n  "created": 1589478378,\n  "data": [\n    {\n      "url": "https://..."\n    },\n    {\n      "url": "https://..."\n    }\n  ]\n}\n',
      },
    },
  },
  '/images/variations': {
    post: {
      operationId: 'createImageVariation',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/CreateImageVariationRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ImagesResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: 'Creates a variation of a given image.',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        beta: true,
        examples: {
          curl: "curl https://api.openai.com/v1/images/variations \\\n  -H 'Authorization: Bearer YOUR_API_KEY' \\\n  -F image='@otter.png' \\\n  -F n=2 \\\n  -F size=\"1024x1024\"\n",
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createImageVariation(\n  fs.createReadStream("otter.png"),\n  2,\n  "1024x1024"\n);\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Image.create_variation(\n  image=open("otter.png", "rb"),\n  n=2,\n  size="1024x1024"\n)\n',
        },
        group: 'images',
        name: 'Create image variation',
        path: 'create-variation',
        response:
          '{\n  "created": 1589478378,\n  "data": [\n    {\n      "url": "https://..."\n    },\n    {\n      "url": "https://..."\n    }\n  ]\n}\n',
      },
    },
  },
  '/models': {
    get: {
      operationId: 'listModels',
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListModelsResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary:
        'Lists the currently available models, and provides basic information about each one such as the owner and availability.',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/models \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\n",
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.listModels();\n',
          python: 'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Model.list()\n',
        },
        group: 'models',
        name: 'List models',
        path: 'list',
        response:
          '{\n  "data": [\n    {\n      "id": "model-id-0",\n      "object": "model",\n      "owned_by": "organization-owner",\n      "permission": [...]\n    },\n    {\n      "id": "model-id-1",\n      "object": "model",\n      "owned_by": "organization-owner",\n      "permission": [...]\n    },\n    {\n      "id": "model-id-2",\n      "object": "model",\n      "owned_by": "openai",\n      "permission": [...]\n    },\n  ],\n  "object": "list"\n}\n',
      },
    },
  },
  '/models/{model}': {
    delete: {
      operationId: 'deleteModel',
      parameters: [
        {
          description: 'The model to delete',
          in: 'path',
          name: 'model',
          required: true,
          schema: {
            example: 'curie:ft-acmeco-2021-03-03-21-44-20',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeleteModelResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: 'Delete a fine-tuned model. You must have the Owner role in your organization.',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: 'curl https://api.openai.com/v1/models/curie:ft-acmeco-2021-03-03-21-44-20 \\\n  -X DELETE \\\n  -H "Authorization: Bearer YOUR_API_KEY"\n',
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.deleteModel(\'curie:ft-acmeco-2021-03-03-21-44-20\');\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Model.delete("curie:ft-acmeco-2021-03-03-21-44-20")\n',
        },
        group: 'fine-tunes',
        name: 'Delete fine-tune model',
        path: 'delete-model',
        response: '{\n  "id": "curie:ft-acmeco-2021-03-03-21-44-20",\n  "object": "model",\n  "deleted": true\n}\n',
      },
    },
    get: {
      operationId: 'retrieveModel',
      parameters: [
        {
          description: 'The ID of the model to use for this request',
          in: 'path',
          name: 'model',
          required: true,
          schema: {
            example: 'text-davinci-001',
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Model',
              },
            },
          },
          description: 'OK',
        },
      },
      summary:
        'Retrieves a model instance, providing basic information about the model such as the owner and permissioning.',
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/models/VAR_model_id \\\n  -H 'Authorization: Bearer YOUR_API_KEY'\n",
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.retrieveModel("VAR_model_id");\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Model.retrieve("VAR_model_id")\n',
        },
        group: 'models',
        name: 'Retrieve model',
        path: 'retrieve',
        response:
          '{\n  "id": "VAR_model_id",\n  "object": "model",\n  "owned_by": "openai",\n  "permission": [...]\n}\n',
      },
    },
  },
  '/moderations': {
    post: {
      operationId: 'createModeration',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateModerationRequest',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateModerationResponse',
              },
            },
          },
          description: 'OK',
        },
      },
      summary: "Classifies if text violates OpenAI's Content Policy",
      tags: ['OpenAI'],
      'x-oaiMeta': {
        examples: {
          curl: "curl https://api.openai.com/v1/moderations \\\n  -H 'Content-Type: application/json' \\\n  -H 'Authorization: Bearer YOUR_API_KEY' \\\n  -d '{\n  \"input\": \"I want to kill them.\"\n}'\n",
          'node.js':
            'const { Configuration, OpenAIApi } = require("openai");\nconst configuration = new Configuration({\n  apiKey: process.env.OPENAI_API_KEY,\n});\nconst openai = new OpenAIApi(configuration);\nconst response = await openai.createModeration({\n  input: "I want to kill them.",\n});\n',
          python:
            'import os\nimport openai\nopenai.api_key = os.getenv("OPENAI_API_KEY")\nopenai.Moderation.create(\n  input="I want to kill them.",\n)\n',
        },
        group: 'moderations',
        name: 'Create moderation',
        parameters: '{\n  "input": "I want to kill them."\n}\n',
        path: 'create',
        response:
          '{\n  "id": "modr-5MWoLO",\n  "model": "text-moderation-001",\n  "results": [\n    {\n      "categories": {\n        "hate": false,\n        "hate/threatening": true,\n        "self-harm": false,\n        "sexual": false,\n        "sexual/minors": false,\n        "violence": true,\n        "violence/graphic": false\n      },\n      "category_scores": {\n        "hate": 0.22714105248451233,\n        "hate/threatening": 0.4132447838783264,\n        "self-harm": 0.005232391878962517,\n        "sexual": 0.01407341007143259,\n        "sexual/minors": 0.0038522258400917053,\n        "violence": 0.9223177433013916,\n        "violence/graphic": 0.036865197122097015\n      },\n      "flagged": true\n    }\n  ]\n}\n',
      },
    },
  },
} as TPaths;
