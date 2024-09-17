// @ts-nocheck
export type TComponents = {
  schemas: {
    ChatCompletionRequestMessage: {
      properties: {
        content: {
          description: 'The contents of the message';
          type: 'string';
        };
        name: {
          description: 'The name of the user in a multi-user chat';
          type: 'string';
        };
        role: {
          description: 'The role of the author of this message.';
          enum: ['system', 'user', 'assistant'];
          type: 'string';
        };
      };
      required: ['role', 'content'];
      type: 'object';
    };
    ChatCompletionResponseMessage: {
      properties: {
        content: {
          description: 'The contents of the message';
          type: 'string';
        };
        role: {
          description: 'The role of the author of this message.';
          enum: ['system', 'user', 'assistant'];
          type: 'string';
        };
      };
      required: ['role', 'content'];
      type: 'object';
    };
    CreateAnswerRequest: {
      additionalProperties: false;
      properties: {
        documents: {
          description: 'List of documents from which the answer for the input `question` should be derived. If this is an empty list, the question will be answered based on the question-answer examples.\n\nYou should specify either `documents` or a `file`, but not both.\n';
          example: "['Japan is an island country in East Asia, located in the northwest Pacific Ocean.', 'Tokyo is the capital and most populous prefecture of Japan.']";
          items: {
            type: 'string';
          };
          maxItems: 200;
          nullable: true;
          type: 'array';
        };
        examples: {
          description: "List of (question, answer) pairs that will help steer the model towards the tone and answer format you'd like. We recommend adding 2 to 3 examples.";
          example: "[['What is the capital of Canada?', 'Ottawa'], ['Which province is Ottawa in?', 'Ontario']]";
          items: {
            items: {
              minLength: 1;
              type: 'string';
            };
            maxItems: 2;
            minItems: 2;
            type: 'array';
          };
          maxItems: 200;
          minItems: 1;
          type: 'array';
        };
        examples_context: {
          description: 'A text snippet containing the contextual information used to generate the answers for the `examples` you provide.';
          example: "Ottawa, Canada's capital, is located in the east of southern Ontario, near the city of Montréal and the U.S. border.";
          type: 'string';
        };
        expand: {
          default: [];
          description: 'If an object name is in the list, we provide the full information of the object; otherwise, we only provide the object ID. Currently we support `completion` and `file` objects for expansion.';
          items: {};
          nullable: true;
          type: 'array';
        };
        file: {
          description: 'The ID of an uploaded file that contains documents to search over. See [upload file](/docs/api-reference/files/upload) for how to upload a file of the desired format and purpose.\n\nYou should specify either `documents` or a `file`, but not both.\n';
          nullable: true;
          type: 'string';
        };
        logit_bias: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/logit_bias';
        };
        logprobs: {
          default: null;
          description: 'Include the log probabilities on the `logprobs` most likely tokens, as well the chosen tokens. For example, if `logprobs` is 5, the API will return a list of the 5 most likely tokens. The API will always return the `logprob` of the sampled token, so there may be up to `logprobs+1` elements in the response.\n\nThe maximum value for `logprobs` is 5. If you need more than this, please contact us through our [Help center](https://help.openai.com) and describe your use case.\n\nWhen `logprobs` is set, `completion` will be automatically added into `expand` to get the logprobs.\n';
          maximum: 5;
          minimum: 0;
          nullable: true;
          type: 'integer';
        };
        max_rerank: {
          default: 200;
          description: 'The maximum number of documents to be ranked by [Search](/docs/api-reference/searches/create) when using `file`. Setting it to a higher value leads to improved accuracy but with increased latency and cost.';
          nullable: true;
          type: 'integer';
        };
        max_tokens: {
          default: 16;
          description: 'The maximum number of tokens allowed for the generated answer';
          nullable: true;
          type: 'integer';
        };
        model: {
          description: 'ID of the model to use for completion. You can select one of `ada`, `babbage`, `curie`, or `davinci`.';
          type: 'string';
        };
        n: {
          default: 1;
          description: 'How many answers to generate for each question.';
          maximum: 10;
          minimum: 1;
          nullable: true;
          type: 'integer';
        };
        question: {
          description: 'Question to get answered.';
          example: 'What is the capital of Japan?';
          minLength: 1;
          type: 'string';
        };
        return_metadata: {
          $ref: '#/components/schemas/CreateSearchRequest/properties/return_metadata';
        };
        return_prompt: {
          default: false;
          description: 'If set to `true`, the returned JSON will include a "prompt" field containing the final prompt that was used to request a completion. This is mainly useful for debugging purposes.';
          nullable: true;
          type: 'boolean';
        };
        search_model: {
          default: 'ada';
          description: 'ID of the model to use for [Search](/docs/api-reference/searches/create). You can select one of `ada`, `babbage`, `curie`, or `davinci`.';
          nullable: true;
          type: 'string';
        };
        stop: {
          default: null;
          description: 'Up to 4 sequences where the API will stop generating further tokens. The returned text will not contain the stop sequence.\n';
          nullable: true;
          oneOf: [
            {
              default: '<|endoftext|>';
              example: '\n';
              type: 'string';
            },
            {
              items: {
                example: '["\\n"]';
                type: 'string';
              };
              maxItems: 4;
              minItems: 1;
              type: 'array';
            },
          ];
        };
        temperature: {
          default: 0;
          description: 'What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.';
          nullable: true;
          type: 'number';
        };
        user: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/user';
        };
      };
      required: ['model', 'question', 'examples', 'examples_context'];
      type: 'object';
    };
    CreateAnswerResponse: {
      properties: {
        answers: {
          items: {
            type: 'string';
          };
          type: 'array';
        };
        completion: {
          type: 'string';
        };
        model: {
          type: 'string';
        };
        object: {
          type: 'string';
        };
        search_model: {
          type: 'string';
        };
        selected_documents: {
          items: {
            properties: {
              document: {
                type: 'integer';
              };
              text: {
                type: 'string';
              };
            };
            type: 'object';
          };
          type: 'array';
        };
      };
      type: 'object';
    };
    CreateChatCompletionRequest: {
      properties: {
        frequency_penalty: {
          default: 0;
          description: "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.\n\n[See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)\n";
          maximum: 2;
          minimum: -2;
          nullable: true;
          type: 'number';
        };
        logit_bias: {
          default: null;
          description: 'Modify the likelihood of specified tokens appearing in the completion.\n\nAccepts a json object that maps tokens (specified by their token ID in the tokenizer) to an associated bias value from -100 to 100. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token.\n';
          nullable: true;
          type: 'object';
          'x-oaiTypeLabel': 'map';
        };
        max_tokens: {
          default: 'inf';
          description: 'The maximum number of tokens allowed for the generated answer. By default, the number of tokens the model can return will be (4096 - prompt tokens).\n';
          type: 'integer';
        };
        messages: {
          description: 'The messages to generate chat completions for, in the [chat format](/docs/guides/chat/introduction).';
          items: {
            $ref: '#/components/schemas/ChatCompletionRequestMessage';
          };
          minItems: 1;
          type: 'array';
        };
        model: {
          description: 'ID of the model to use. Currently, only `gpt-3.5-turbo` and `gpt-3.5-turbo-0301` are supported.';
          type: 'string';
        };
        n: {
          default: 1;
          description: 'How many chat completion choices to generate for each input message.';
          example: 1;
          maximum: 128;
          minimum: 1;
          nullable: true;
          type: 'integer';
        };
        presence_penalty: {
          default: 0;
          description: "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.\n\n[See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)\n";
          maximum: 2;
          minimum: -2;
          nullable: true;
          type: 'number';
        };
        stop: {
          default: null;
          description: 'Up to 4 sequences where the API will stop generating further tokens.\n';
          oneOf: [
            {
              nullable: true;
              type: 'string';
            },
            {
              items: {
                type: 'string';
              };
              maxItems: 4;
              minItems: 1;
              type: 'array';
            },
          ];
        };
        stream: {
          default: false;
          description: 'If set, partial message deltas will be sent, like in ChatGPT. Tokens will be sent as data-only [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format) as they become available, with the stream terminated by a `data: [DONE]` message.\n';
          nullable: true;
          type: 'boolean';
        };
        temperature: {
          default: 1;
          description: 'What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.\n\nWe generally recommend altering this or `top_p` but not both.\n';
          example: 1;
          maximum: 2;
          minimum: 0;
          nullable: true;
          type: 'number';
        };
        top_p: {
          default: 1;
          description: 'An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.\n\nWe generally recommend altering this or `temperature` but not both.\n';
          example: 1;
          maximum: 1;
          minimum: 0;
          nullable: true;
          type: 'number';
        };
        user: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/user';
        };
      };
      required: ['model', 'messages'];
      type: 'object';
    };
    CreateChatCompletionResponse: {
      properties: {
        choices: {
          items: {
            properties: {
              finish_reason: {
                type: 'string';
              };
              index: {
                type: 'integer';
              };
              message: {
                $ref: '#/components/schemas/ChatCompletionResponseMessage';
              };
            };
            type: 'object';
          };
          type: 'array';
        };
        created: {
          type: 'integer';
        };
        id: {
          type: 'string';
        };
        model: {
          type: 'string';
        };
        object: {
          type: 'string';
        };
        usage: {
          properties: {
            completion_tokens: {
              type: 'integer';
            };
            prompt_tokens: {
              type: 'integer';
            };
            total_tokens: {
              type: 'integer';
            };
          };
          required: ['prompt_tokens', 'completion_tokens', 'total_tokens'];
          type: 'object';
        };
      };
      required: ['id', 'object', 'created', 'model', 'choices'];
      type: 'object';
    };
    CreateClassificationRequest: {
      additionalProperties: false;
      properties: {
        examples: {
          description: 'A list of examples with labels, in the following format:\n\n`[["The movie is so interesting.", "Positive"], ["It is quite boring.", "Negative"], ...]`\n\nAll the label strings will be normalized to be capitalized.\n\nYou should specify either `examples` or `file`, but not both.\n';
          example: "[['Do not see this film.', 'Negative'], ['Smart, provocative and blisteringly funny.', 'Positive']]";
          items: {
            items: {
              minLength: 1;
              type: 'string';
            };
            maxItems: 2;
            minItems: 2;
            type: 'array';
          };
          maxItems: 200;
          minItems: 2;
          nullable: true;
          type: 'array';
        };
        expand: {
          $ref: '#/components/schemas/CreateAnswerRequest/properties/expand';
        };
        file: {
          description: 'The ID of the uploaded file that contains training examples. See [upload file](/docs/api-reference/files/upload) for how to upload a file of the desired format and purpose.\n\nYou should specify either `examples` or `file`, but not both.\n';
          nullable: true;
          type: 'string';
        };
        labels: {
          default: null;
          description: 'The set of categories being classified. If not specified, candidate labels will be automatically collected from the examples you provide. All the label strings will be normalized to be capitalized.';
          example: ['Positive', 'Negative'];
          items: {
            type: 'string';
          };
          maxItems: 200;
          minItems: 2;
          nullable: true;
          type: 'array';
        };
        logit_bias: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/logit_bias';
        };
        logprobs: {
          $ref: '#/components/schemas/CreateAnswerRequest/properties/logprobs';
        };
        max_examples: {
          default: 200;
          description: 'The maximum number of examples to be ranked by [Search](/docs/api-reference/searches/create) when using `file`. Setting it to a higher value leads to improved accuracy but with increased latency and cost.';
          nullable: true;
          type: 'integer';
        };
        model: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/model';
        };
        query: {
          description: 'Query to be classified.';
          example: 'The plot is not very attractive.';
          minLength: 1;
          type: 'string';
        };
        return_metadata: {
          $ref: '#/components/schemas/CreateSearchRequest/properties/return_metadata';
        };
        return_prompt: {
          $ref: '#/components/schemas/CreateAnswerRequest/properties/return_prompt';
        };
        search_model: {
          $ref: '#/components/schemas/CreateAnswerRequest/properties/search_model';
        };
        temperature: {
          default: 0;
          description: 'What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.';
          example: 0;
          maximum: 2;
          minimum: 0;
          nullable: true;
          type: 'number';
        };
        user: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/user';
        };
      };
      required: ['model', 'query'];
      type: 'object';
    };
    CreateClassificationResponse: {
      properties: {
        completion: {
          type: 'string';
        };
        label: {
          type: 'string';
        };
        model: {
          type: 'string';
        };
        object: {
          type: 'string';
        };
        search_model: {
          type: 'string';
        };
        selected_examples: {
          items: {
            properties: {
              document: {
                type: 'integer';
              };
              label: {
                type: 'string';
              };
              text: {
                type: 'string';
              };
            };
            type: 'object';
          };
          type: 'array';
        };
      };
      type: 'object';
    };
    CreateCompletionRequest: {
      properties: {
        best_of: {
          default: 1;
          description: 'Generates `best_of` completions server-side and returns the "best" (the one with the highest log probability per token). Results cannot be streamed.\n\nWhen used with `n`, `best_of` controls the number of candidate completions and `n` specifies how many to return – `best_of` must be greater than `n`.\n\n**Note:** Because this parameter generates many completions, it can quickly consume your token quota. Use carefully and ensure that you have reasonable settings for `max_tokens` and `stop`.\n';
          maximum: 20;
          minimum: 0;
          nullable: true;
          type: 'integer';
        };
        echo: {
          default: false;
          description: 'Echo back the prompt in addition to the completion\n';
          nullable: true;
          type: 'boolean';
        };
        frequency_penalty: {
          default: 0;
          description: "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.\n\n[See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)\n";
          maximum: 2;
          minimum: -2;
          nullable: true;
          type: 'number';
        };
        logit_bias: {
          default: null;
          description: 'Modify the likelihood of specified tokens appearing in the completion.\n\nAccepts a json object that maps tokens (specified by their token ID in the GPT tokenizer) to an associated bias value from -100 to 100. You can use this [tokenizer tool](/tokenizer?view=bpe) (which works for both GPT-2 and GPT-3) to convert text to token IDs. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token.\n\nAs an example, you can pass `{"50256": -100}` to prevent the <|endoftext|> token from being generated.\n';
          nullable: true;
          type: 'object';
          'x-oaiTypeLabel': 'map';
        };
        logprobs: {
          default: null;
          description: 'Include the log probabilities on the `logprobs` most likely tokens, as well the chosen tokens. For example, if `logprobs` is 5, the API will return a list of the 5 most likely tokens. The API will always return the `logprob` of the sampled token, so there may be up to `logprobs+1` elements in the response.\n\nThe maximum value for `logprobs` is 5. If you need more than this, please contact us through our [Help center](https://help.openai.com) and describe your use case.\n';
          maximum: 5;
          minimum: 0;
          nullable: true;
          type: 'integer';
        };
        max_tokens: {
          default: 16;
          description: "The maximum number of [tokens](/tokenizer) to generate in the completion.\n\nThe token count of your prompt plus `max_tokens` cannot exceed the model's context length. Most models have a context length of 2048 tokens (except for the newest models, which support 4096).\n";
          example: 16;
          minimum: 0;
          nullable: true;
          type: 'integer';
        };
        model: {
          description: 'ID of the model to use. You can use the [List models](/docs/api-reference/models/list) API to see all of your available models, or see our [Model overview](/docs/models/overview) for descriptions of them.';
          type: 'string';
        };
        n: {
          default: 1;
          description: 'How many completions to generate for each prompt.\n\n**Note:** Because this parameter generates many completions, it can quickly consume your token quota. Use carefully and ensure that you have reasonable settings for `max_tokens` and `stop`.\n';
          example: 1;
          maximum: 128;
          minimum: 1;
          nullable: true;
          type: 'integer';
        };
        presence_penalty: {
          default: 0;
          description: "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.\n\n[See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)\n";
          maximum: 2;
          minimum: -2;
          nullable: true;
          type: 'number';
        };
        prompt: {
          default: '<|endoftext|>';
          description: 'The prompt(s) to generate completions for, encoded as a string, array of strings, array of tokens, or array of token arrays.\n\nNote that <|endoftext|> is the document separator that the model sees during training, so if a prompt is not specified the model will generate as if from the beginning of a new document.\n';
          nullable: true;
          oneOf: [
            {
              default: '';
              example: 'This is a test.';
              type: 'string';
            },
            {
              items: {
                default: '';
                example: 'This is a test.';
                type: 'string';
              };
              type: 'array';
            },
            {
              example: '[1212, 318, 257, 1332, 13]';
              items: {
                type: 'integer';
              };
              minItems: 1;
              type: 'array';
            },
            {
              example: '[[1212, 318, 257, 1332, 13]]';
              items: {
                items: {
                  type: 'integer';
                };
                minItems: 1;
                type: 'array';
              };
              minItems: 1;
              type: 'array';
            },
          ];
        };
        stop: {
          default: null;
          description: 'Up to 4 sequences where the API will stop generating further tokens. The returned text will not contain the stop sequence.\n';
          nullable: true;
          oneOf: [
            {
              default: '<|endoftext|>';
              example: '\n';
              nullable: true;
              type: 'string';
            },
            {
              items: {
                example: '["\\n"]';
                type: 'string';
              };
              maxItems: 4;
              minItems: 1;
              type: 'array';
            },
          ];
        };
        stream: {
          default: false;
          description: 'Whether to stream back partial progress. If set, tokens will be sent as data-only [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format) as they become available, with the stream terminated by a `data: [DONE]` message.\n';
          nullable: true;
          type: 'boolean';
        };
        suffix: {
          default: null;
          description: 'The suffix that comes after a completion of inserted text.';
          example: 'test.';
          nullable: true;
          type: 'string';
        };
        temperature: {
          default: 1;
          description: 'What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.\n\nWe generally recommend altering this or `top_p` but not both.\n';
          example: 1;
          maximum: 2;
          minimum: 0;
          nullable: true;
          type: 'number';
        };
        top_p: {
          default: 1;
          description: 'An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.\n\nWe generally recommend altering this or `temperature` but not both.\n';
          example: 1;
          maximum: 1;
          minimum: 0;
          nullable: true;
          type: 'number';
        };
        user: {
          description: 'A unique identifier representing your end-user, which can help OpenAI to monitor and detect abuse. [Learn more](/docs/guides/safety-best-practices/end-user-ids).\n';
          example: 'user-1234';
          type: 'string';
        };
      };
      required: ['model'];
      type: 'object';
    };
    CreateCompletionResponse: {
      properties: {
        choices: {
          items: {
            properties: {
              finish_reason: {
                type: 'string';
              };
              index: {
                type: 'integer';
              };
              logprobs: {
                nullable: true;
                properties: {
                  text_offset: {
                    items: {
                      type: 'integer';
                    };
                    type: 'array';
                  };
                  token_logprobs: {
                    items: {
                      type: 'number';
                    };
                    type: 'array';
                  };
                  tokens: {
                    items: {
                      type: 'string';
                    };
                    type: 'array';
                  };
                  top_logprobs: {
                    items: {
                      type: 'object';
                    };
                    type: 'array';
                  };
                };
                type: 'object';
              };
              text: {
                type: 'string';
              };
            };
            type: 'object';
          };
          type: 'array';
        };
        created: {
          type: 'integer';
        };
        id: {
          type: 'string';
        };
        model: {
          type: 'string';
        };
        object: {
          type: 'string';
        };
        usage: {
          properties: {
            completion_tokens: {
              type: 'integer';
            };
            prompt_tokens: {
              type: 'integer';
            };
            total_tokens: {
              type: 'integer';
            };
          };
          required: ['prompt_tokens', 'completion_tokens', 'total_tokens'];
          type: 'object';
        };
      };
      required: ['id', 'object', 'created', 'model', 'choices'];
      type: 'object';
    };
    CreateEditRequest: {
      properties: {
        input: {
          default: '';
          description: 'The input text to use as a starting point for the edit.';
          example: 'What day of the wek is it?';
          nullable: true;
          type: 'string';
        };
        instruction: {
          description: 'The instruction that tells the model how to edit the prompt.';
          example: 'Fix the spelling mistakes.';
          type: 'string';
        };
        model: {
          description: 'ID of the model to use. You can use the `text-davinci-edit-001` or `code-davinci-edit-001` model with this endpoint.';
          type: 'string';
        };
        n: {
          default: 1;
          description: 'How many edits to generate for the input and instruction.';
          example: 1;
          maximum: 20;
          minimum: 1;
          nullable: true;
          type: 'integer';
        };
        temperature: {
          default: 1;
          description: 'What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.\n\nWe generally recommend altering this or `top_p` but not both.\n';
          example: 1;
          maximum: 2;
          minimum: 0;
          nullable: true;
          type: 'number';
        };
        top_p: {
          default: 1;
          description: 'An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.\n\nWe generally recommend altering this or `temperature` but not both.\n';
          example: 1;
          maximum: 1;
          minimum: 0;
          nullable: true;
          type: 'number';
        };
      };
      required: ['model', 'instruction'];
      type: 'object';
    };
    CreateEditResponse: {
      properties: {
        choices: {
          items: {
            properties: {
              finish_reason: {
                type: 'string';
              };
              index: {
                type: 'integer';
              };
              logprobs: {
                nullable: true;
                properties: {
                  text_offset: {
                    items: {
                      type: 'integer';
                    };
                    type: 'array';
                  };
                  token_logprobs: {
                    items: {
                      type: 'number';
                    };
                    type: 'array';
                  };
                  tokens: {
                    items: {
                      type: 'string';
                    };
                    type: 'array';
                  };
                  top_logprobs: {
                    items: {
                      type: 'object';
                    };
                    type: 'array';
                  };
                };
                type: 'object';
              };
              text: {
                type: 'string';
              };
            };
            type: 'object';
          };
          type: 'array';
        };
        created: {
          type: 'integer';
        };
        object: {
          type: 'string';
        };
        usage: {
          properties: {
            completion_tokens: {
              type: 'integer';
            };
            prompt_tokens: {
              type: 'integer';
            };
            total_tokens: {
              type: 'integer';
            };
          };
          required: ['prompt_tokens', 'completion_tokens', 'total_tokens'];
          type: 'object';
        };
      };
      required: ['object', 'created', 'choices', 'usage'];
      type: 'object';
    };
    CreateEmbeddingRequest: {
      additionalProperties: false;
      properties: {
        input: {
          description: 'Input text to get embeddings for, encoded as a string or array of tokens. To get embeddings for multiple inputs in a single request, pass an array of strings or array of token arrays. Each input must not exceed 8192 tokens in length.\n';
          example: 'The quick brown fox jumped over the lazy dog';
          oneOf: [
            {
              default: '';
              example: 'This is a test.';
              type: 'string';
            },
            {
              items: {
                default: '';
                example: 'This is a test.';
                type: 'string';
              };
              type: 'array';
            },
            {
              example: '[1212, 318, 257, 1332, 13]';
              items: {
                type: 'integer';
              };
              minItems: 1;
              type: 'array';
            },
            {
              example: '[[1212, 318, 257, 1332, 13]]';
              items: {
                items: {
                  type: 'integer';
                };
                minItems: 1;
                type: 'array';
              };
              minItems: 1;
              type: 'array';
            },
          ];
        };
        model: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/model';
        };
        user: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/user';
        };
      };
      required: ['model', 'input'];
      type: 'object';
    };
    CreateEmbeddingResponse: {
      properties: {
        data: {
          items: {
            properties: {
              embedding: {
                items: {
                  type: 'number';
                };
                type: 'array';
              };
              index: {
                type: 'integer';
              };
              object: {
                type: 'string';
              };
            };
            required: ['index', 'object', 'embedding'];
            type: 'object';
          };
          type: 'array';
        };
        model: {
          type: 'string';
        };
        object: {
          type: 'string';
        };
        usage: {
          properties: {
            prompt_tokens: {
              type: 'integer';
            };
            total_tokens: {
              type: 'integer';
            };
          };
          required: ['prompt_tokens', 'total_tokens'];
          type: 'object';
        };
      };
      required: ['object', 'model', 'data', 'usage'];
      type: 'object';
    };
    CreateFileRequest: {
      additionalProperties: false;
      properties: {
        file: {
          description: 'Name of the [JSON Lines](https://jsonlines.readthedocs.io/en/latest/) file to be uploaded.\n\nIf the `purpose` is set to "fine-tune", each line is a JSON record with "prompt" and "completion" fields representing your [training examples](/docs/guides/fine-tuning/prepare-training-data).\n';
          format: 'binary';
          type: 'string';
        };
        purpose: {
          description: 'The intended purpose of the uploaded documents.\n\nUse "fine-tune" for [Fine-tuning](/docs/api-reference/fine-tunes). This allows us to validate the format of the uploaded file.\n';
          type: 'string';
        };
      };
      required: ['file', 'purpose'];
      type: 'object';
    };
    CreateFineTuneRequest: {
      properties: {
        batch_size: {
          default: null;
          description: "The batch size to use for training. The batch size is the number of\ntraining examples used to train a single forward and backward pass.\n\nBy default, the batch size will be dynamically configured to be\n~0.2% of the number of examples in the training set, capped at 256 -\nin general, we've found that larger batch sizes tend to work better\nfor larger datasets.\n";
          nullable: true;
          type: 'integer';
        };
        classification_betas: {
          default: null;
          description: 'If this is provided, we calculate F-beta scores at the specified\nbeta values. The F-beta score is a generalization of F-1 score.\nThis is only used for binary classification.\n\nWith a beta of 1 (i.e. the F-1 score), precision and recall are\ngiven the same weight. A larger beta score puts more weight on\nrecall and less on precision. A smaller beta score puts more weight\non precision and less on recall.\n';
          example: [0.6, 1, 1.5, 2];
          items: {
            type: 'number';
          };
          nullable: true;
          type: 'array';
        };
        classification_n_classes: {
          default: null;
          description: 'The number of classes in a classification task.\n\nThis parameter is required for multiclass classification.\n';
          nullable: true;
          type: 'integer';
        };
        classification_positive_class: {
          default: null;
          description: 'The positive class in binary classification.\n\nThis parameter is needed to generate precision, recall, and F1\nmetrics when doing binary classification.\n';
          nullable: true;
          type: 'string';
        };
        compute_classification_metrics: {
          default: false;
          description: 'If set, we calculate classification-specific metrics such as accuracy\nand F-1 score using the validation set at the end of every epoch.\nThese metrics can be viewed in the [results file](/docs/guides/fine-tuning/analyzing-your-fine-tuned-model).\n\nIn order to compute classification metrics, you must provide a\n`validation_file`. Additionally, you must\nspecify `classification_n_classes` for multiclass classification or\n`classification_positive_class` for binary classification.\n';
          nullable: true;
          type: 'boolean';
        };
        learning_rate_multiplier: {
          default: null;
          description: 'The learning rate multiplier to use for training.\nThe fine-tuning learning rate is the original learning rate used for\npretraining multiplied by this value.\n\nBy default, the learning rate multiplier is the 0.05, 0.1, or 0.2\ndepending on final `batch_size` (larger learning rates tend to\nperform better with larger batch sizes). We recommend experimenting\nwith values in the range 0.02 to 0.2 to see what produces the best\nresults.\n';
          nullable: true;
          type: 'number';
        };
        model: {
          default: 'curie';
          description: 'The name of the base model to fine-tune. You can select one of "ada",\n"babbage", "curie", "davinci", or a fine-tuned model created after 2022-04-21.\nTo learn more about these models, see the\n[Models](https://platform.openai.com/docs/models) documentation.\n';
          nullable: true;
          type: 'string';
        };
        n_epochs: {
          default: 4;
          description: 'The number of epochs to train the model for. An epoch refers to one\nfull cycle through the training dataset.\n';
          nullable: true;
          type: 'integer';
        };
        prompt_loss_weight: {
          default: 0.01;
          description: 'The weight to use for loss on the prompt tokens. This controls how\nmuch the model tries to learn to generate the prompt (as compared\nto the completion which always has a weight of 1.0), and can add\na stabilizing effect to training when completions are short.\n\nIf prompts are extremely long (relative to completions), it may make\nsense to reduce this weight so as to avoid over-prioritizing\nlearning the prompt.\n';
          nullable: true;
          type: 'number';
        };
        suffix: {
          default: null;
          description: 'A string of up to 40 characters that will be added to your fine-tuned model name.\n\nFor example, a `suffix` of "custom-model-name" would produce a model name like `ada:ft-your-org:custom-model-name-2022-02-15-04-21-04`.\n';
          maxLength: 40;
          minLength: 1;
          nullable: true;
          type: 'string';
        };
        training_file: {
          description: 'The ID of an uploaded file that contains training data.\n\nSee [upload file](/docs/api-reference/files/upload) for how to upload a file.\n\nYour dataset must be formatted as a JSONL file, where each training\nexample is a JSON object with the keys "prompt" and "completion".\nAdditionally, you must upload your file with the purpose `fine-tune`.\n\nSee the [fine-tuning guide](/docs/guides/fine-tuning/creating-training-data) for more details.\n';
          example: 'file-ajSREls59WBbvgSzJSVWxMCB';
          type: 'string';
        };
        validation_file: {
          description: 'The ID of an uploaded file that contains validation data.\n\nIf you provide this file, the data is used to generate validation\nmetrics periodically during fine-tuning. These metrics can be viewed in\nthe [fine-tuning results file](/docs/guides/fine-tuning/analyzing-your-fine-tuned-model).\nYour train and validation data should be mutually exclusive.\n\nYour dataset must be formatted as a JSONL file, where each validation\nexample is a JSON object with the keys "prompt" and "completion".\nAdditionally, you must upload your file with the purpose `fine-tune`.\n\nSee the [fine-tuning guide](/docs/guides/fine-tuning/creating-training-data) for more details.\n';
          example: 'file-XjSREls59WBbvgSzJSVWxMCa';
          nullable: true;
          type: 'string';
        };
      };
      required: ['training_file'];
      type: 'object';
    };
    CreateImageEditRequest: {
      properties: {
        image: {
          description: 'The image to edit. Must be a valid PNG file, less than 4MB, and square. If mask is not provided, image must have transparency, which will be used as the mask.';
          format: 'binary';
          type: 'string';
        };
        mask: {
          description: 'An additional image whose fully transparent areas (e.g. where alpha is zero) indicate where `image` should be edited. Must be a valid PNG file, less than 4MB, and have the same dimensions as `image`.';
          format: 'binary';
          type: 'string';
        };
        n: {
          $ref: '#/components/schemas/CreateImageRequest/properties/n';
        };
        prompt: {
          description: 'A text description of the desired image(s). The maximum length is 1000 characters.';
          example: 'A cute baby sea otter wearing a beret';
          type: 'string';
        };
        response_format: {
          $ref: '#/components/schemas/CreateImageRequest/properties/response_format';
        };
        size: {
          $ref: '#/components/schemas/CreateImageRequest/properties/size';
        };
        user: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/user';
        };
      };
      required: ['prompt', 'image'];
      type: 'object';
    };
    CreateImageRequest: {
      properties: {
        n: {
          default: 1;
          description: 'The number of images to generate. Must be between 1 and 10.';
          example: 1;
          maximum: 10;
          minimum: 1;
          nullable: true;
          type: 'integer';
        };
        prompt: {
          description: 'A text description of the desired image(s). The maximum length is 1000 characters.';
          example: 'A cute baby sea otter';
          type: 'string';
        };
        response_format: {
          default: 'url';
          description: 'The format in which the generated images are returned. Must be one of `url` or `b64_json`.';
          enum: ['url', 'b64_json'];
          example: 'url';
          nullable: true;
          type: 'string';
        };
        size: {
          default: '1024x1024';
          description: 'The size of the generated images. Must be one of `256x256`, `512x512`, or `1024x1024`.';
          enum: ['256x256', '512x512', '1024x1024'];
          example: '1024x1024';
          nullable: true;
          type: 'string';
        };
        user: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/user';
        };
      };
      required: ['prompt'];
      type: 'object';
    };
    CreateImageVariationRequest: {
      properties: {
        image: {
          description: 'The image to use as the basis for the variation(s). Must be a valid PNG file, less than 4MB, and square.';
          format: 'binary';
          type: 'string';
        };
        n: {
          $ref: '#/components/schemas/CreateImageRequest/properties/n';
        };
        response_format: {
          $ref: '#/components/schemas/CreateImageRequest/properties/response_format';
        };
        size: {
          $ref: '#/components/schemas/CreateImageRequest/properties/size';
        };
        user: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/user';
        };
      };
      required: ['image'];
      type: 'object';
    };
    CreateModerationRequest: {
      properties: {
        input: {
          description: 'The input text to classify';
          oneOf: [
            {
              default: '';
              example: 'I want to kill them.';
              type: 'string';
            },
            {
              items: {
                default: '';
                example: 'I want to kill them.';
                type: 'string';
              };
              type: 'array';
            },
          ];
        };
        model: {
          default: 'text-moderation-latest';
          description: 'Two content moderations models are available: `text-moderation-stable` and `text-moderation-latest`.\n\nThe default is `text-moderation-latest` which will be automatically upgraded over time. This ensures you are always using our most accurate model. If you use `text-moderation-stable`, we will provide advanced notice before updating the model. Accuracy of `text-moderation-stable` may be slightly lower than for `text-moderation-latest`.\n';
          example: 'text-moderation-stable';
          nullable: false;
          type: 'string';
        };
      };
      required: ['input'];
      type: 'object';
    };
    CreateModerationResponse: {
      properties: {
        id: {
          type: 'string';
        };
        model: {
          type: 'string';
        };
        results: {
          items: {
            properties: {
              categories: {
                properties: {
                  hate: {
                    type: 'boolean';
                  };
                  'hate/threatening': {
                    type: 'boolean';
                  };
                  'self-harm': {
                    type: 'boolean';
                  };
                  sexual: {
                    type: 'boolean';
                  };
                  'sexual/minors': {
                    type: 'boolean';
                  };
                  violence: {
                    type: 'boolean';
                  };
                  'violence/graphic': {
                    type: 'boolean';
                  };
                };
                required: [
                  'hate',
                  'hate/threatening',
                  'self-harm',
                  'sexual',
                  'sexual/minors',
                  'violence',
                  'violence/graphic',
                ];
                type: 'object';
              };
              category_scores: {
                properties: {
                  hate: {
                    type: 'number';
                  };
                  'hate/threatening': {
                    type: 'number';
                  };
                  'self-harm': {
                    type: 'number';
                  };
                  sexual: {
                    type: 'number';
                  };
                  'sexual/minors': {
                    type: 'number';
                  };
                  violence: {
                    type: 'number';
                  };
                  'violence/graphic': {
                    type: 'number';
                  };
                };
                required: [
                  'hate',
                  'hate/threatening',
                  'self-harm',
                  'sexual',
                  'sexual/minors',
                  'violence',
                  'violence/graphic',
                ];
                type: 'object';
              };
              flagged: {
                type: 'boolean';
              };
            };
            required: ['flagged', 'categories', 'category_scores'];
            type: 'object';
          };
          type: 'array';
        };
      };
      required: ['id', 'model', 'results'];
      type: 'object';
    };
    CreateSearchRequest: {
      properties: {
        documents: {
          description: 'Up to 200 documents to search over, provided as a list of strings.\n\nThe maximum document length (in tokens) is 2034 minus the number of tokens in the query.\n\nYou should specify either `documents` or a `file`, but not both.\n';
          example: "['White House', 'hospital', 'school']";
          items: {
            type: 'string';
          };
          maxItems: 200;
          minItems: 1;
          nullable: true;
          type: 'array';
        };
        file: {
          description: 'The ID of an uploaded file that contains documents to search over.\n\nYou should specify either `documents` or a `file`, but not both.\n';
          nullable: true;
          type: 'string';
        };
        max_rerank: {
          default: 200;
          description: 'The maximum number of documents to be re-ranked and returned by search.\n\nThis flag only takes effect when `file` is set.\n';
          minimum: 1;
          nullable: true;
          type: 'integer';
        };
        query: {
          description: 'Query to search against the documents.';
          example: 'the president';
          minLength: 1;
          type: 'string';
        };
        return_metadata: {
          default: false;
          description: 'A special boolean flag for showing metadata. If set to `true`, each document entry in the returned JSON will contain a "metadata" field.\n\nThis flag only takes effect when `file` is set.\n';
          nullable: true;
          type: 'boolean';
        };
        user: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/user';
        };
      };
      required: ['query'];
      type: 'object';
    };
    CreateSearchResponse: {
      properties: {
        data: {
          items: {
            properties: {
              document: {
                type: 'integer';
              };
              object: {
                type: 'string';
              };
              score: {
                type: 'number';
              };
            };
            type: 'object';
          };
          type: 'array';
        };
        model: {
          type: 'string';
        };
        object: {
          type: 'string';
        };
      };
      type: 'object';
    };
    CreateTranscriptionRequest: {
      additionalProperties: false;
      properties: {
        file: {
          description: 'The audio file to transcribe, in one of these formats: mp3, mp4, mpeg, mpga, m4a, wav, or webm.\n';
          format: 'binary';
          type: 'string';
        };
        language: {
          description: 'The language of the input audio. Supplying the input language in [ISO-639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) format will improve accuracy and latency.\n';
          type: 'string';
        };
        model: {
          description: 'ID of the model to use. Only `whisper-1` is currently available.\n';
          type: 'string';
        };
        prompt: {
          description: "An optional text to guide the model's style or continue a previous audio segment. The [prompt](/docs/guides/speech-to-text/prompting) should match the audio language.\n";
          type: 'string';
        };
        response_format: {
          default: 'json';
          description: 'The format of the transcript output, in one of these options: json, text, srt, verbose_json, or vtt.\n';
          type: 'string';
        };
        temperature: {
          default: 0;
          description: 'The sampling temperature, between 0 and 1. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. If set to 0, the model will use [log probability](https://en.wikipedia.org/wiki/Log_probability) to automatically increase the temperature until certain thresholds are hit.\n';
          type: 'number';
        };
      };
      required: ['file', 'model'];
      type: 'object';
    };
    CreateTranscriptionResponse: {
      properties: {
        text: {
          type: 'string';
        };
      };
      required: ['text'];
      type: 'object';
    };
    CreateTranslationRequest: {
      additionalProperties: false;
      properties: {
        file: {
          description: 'The audio file to translate, in one of these formats: mp3, mp4, mpeg, mpga, m4a, wav, or webm.\n';
          format: 'binary';
          type: 'string';
        };
        model: {
          description: 'ID of the model to use. Only `whisper-1` is currently available.\n';
          type: 'string';
        };
        prompt: {
          description: "An optional text to guide the model's style or continue a previous audio segment. The [prompt](/docs/guides/speech-to-text/prompting) should be in English.\n";
          type: 'string';
        };
        response_format: {
          default: 'json';
          description: 'The format of the transcript output, in one of these options: json, text, srt, verbose_json, or vtt.\n';
          type: 'string';
        };
        temperature: {
          default: 0;
          description: 'The sampling temperature, between 0 and 1. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. If set to 0, the model will use [log probability](https://en.wikipedia.org/wiki/Log_probability) to automatically increase the temperature until certain thresholds are hit.\n';
          type: 'number';
        };
      };
      required: ['file', 'model'];
      type: 'object';
    };
    CreateTranslationResponse: {
      properties: {
        text: {
          type: 'string';
        };
      };
      required: ['text'];
      type: 'object';
    };
    DeleteFileResponse: {
      properties: {
        deleted: {
          type: 'boolean';
        };
        id: {
          type: 'string';
        };
        object: {
          type: 'string';
        };
      };
      required: ['id', 'object', 'deleted'];
      type: 'object';
    };
    DeleteModelResponse: {
      properties: {
        deleted: {
          type: 'boolean';
        };
        id: {
          type: 'string';
        };
        object: {
          type: 'string';
        };
      };
      required: ['id', 'object', 'deleted'];
      type: 'object';
    };
    Engine: {
      properties: {
        created: {
          nullable: true;
          type: 'integer';
        };
        id: {
          type: 'string';
        };
        object: {
          type: 'string';
        };
        ready: {
          type: 'boolean';
        };
      };
      required: ['id', 'object', 'created', 'ready'];
      title: 'Engine';
    };
    FineTune: {
      properties: {
        created_at: {
          type: 'integer';
        };
        events: {
          items: {
            $ref: '#/components/schemas/FineTuneEvent';
          };
          type: 'array';
        };
        fine_tuned_model: {
          nullable: true;
          type: 'string';
        };
        hyperparams: {
          type: 'object';
        };
        id: {
          type: 'string';
        };
        model: {
          type: 'string';
        };
        object: {
          type: 'string';
        };
        organization_id: {
          type: 'string';
        };
        result_files: {
          items: {
            $ref: '#/components/schemas/OpenAIFile';
          };
          type: 'array';
        };
        status: {
          type: 'string';
        };
        training_files: {
          items: {
            $ref: '#/components/schemas/OpenAIFile';
          };
          type: 'array';
        };
        updated_at: {
          type: 'integer';
        };
        validation_files: {
          items: {
            $ref: '#/components/schemas/OpenAIFile';
          };
          type: 'array';
        };
      };
      required: [
        'id',
        'object',
        'created_at',
        'updated_at',
        'model',
        'fine_tuned_model',
        'organization_id',
        'status',
        'hyperparams',
        'training_files',
        'validation_files',
        'result_files',
      ];
      title: 'FineTune';
    };
    FineTuneEvent: {
      properties: {
        created_at: {
          type: 'integer';
        };
        level: {
          type: 'string';
        };
        message: {
          type: 'string';
        };
        object: {
          type: 'string';
        };
      };
      required: ['object', 'created_at', 'level', 'message'];
      title: 'FineTuneEvent';
    };
    ImagesResponse: {
      properties: {
        created: {
          type: 'integer';
        };
        data: {
          items: {
            properties: {
              b64_json: {
                type: 'string';
              };
              url: {
                type: 'string';
              };
            };
            type: 'object';
          };
          type: 'array';
        };
      };
      required: ['created', 'data'];
    };
    ListEnginesResponse: {
      properties: {
        data: {
          items: {
            $ref: '#/components/schemas/Engine';
          };
          type: 'array';
        };
        object: {
          type: 'string';
        };
      };
      required: ['object', 'data'];
      type: 'object';
    };
    ListFilesResponse: {
      properties: {
        data: {
          items: {
            $ref: '#/components/schemas/OpenAIFile';
          };
          type: 'array';
        };
        object: {
          type: 'string';
        };
      };
      required: ['object', 'data'];
      type: 'object';
    };
    ListFineTuneEventsResponse: {
      properties: {
        data: {
          items: {
            $ref: '#/components/schemas/FineTuneEvent';
          };
          type: 'array';
        };
        object: {
          type: 'string';
        };
      };
      required: ['object', 'data'];
      type: 'object';
    };
    ListFineTunesResponse: {
      properties: {
        data: {
          items: {
            $ref: '#/components/schemas/FineTune';
          };
          type: 'array';
        };
        object: {
          type: 'string';
        };
      };
      required: ['object', 'data'];
      type: 'object';
    };
    ListModelsResponse: {
      properties: {
        data: {
          items: {
            $ref: '#/components/schemas/Model';
          };
          type: 'array';
        };
        object: {
          type: 'string';
        };
      };
      required: ['object', 'data'];
      type: 'object';
    };
    Model: {
      properties: {
        created: {
          type: 'integer';
        };
        id: {
          type: 'string';
        };
        object: {
          type: 'string';
        };
        owned_by: {
          type: 'string';
        };
      };
      required: ['id', 'object', 'created', 'owned_by'];
      title: 'Model';
    };
    OpenAIFile: {
      properties: {
        bytes: {
          type: 'integer';
        };
        created_at: {
          type: 'integer';
        };
        filename: {
          type: 'string';
        };
        id: {
          type: 'string';
        };
        object: {
          type: 'string';
        };
        purpose: {
          type: 'string';
        };
        status: {
          type: 'string';
        };
        status_details: {
          nullable: true;
          type: 'object';
        };
      };
      required: ['id', 'object', 'bytes', 'created_at', 'filename', 'purpose'];
      title: 'OpenAIFile';
    };
  };
};
export const components = {
  schemas: {
    ChatCompletionRequestMessage: {
      properties: {
        content: {
          description: 'The contents of the message',
          type: 'string',
        },
        name: {
          description: 'The name of the user in a multi-user chat',
          type: 'string',
        },
        role: {
          description: 'The role of the author of this message.',
          enum: ['system', 'user', 'assistant'],
          type: 'string',
        },
      },
      required: ['role', 'content'],
      type: 'object',
    },
    ChatCompletionResponseMessage: {
      properties: {
        content: {
          description: 'The contents of the message',
          type: 'string',
        },
        role: {
          description: 'The role of the author of this message.',
          enum: ['system', 'user', 'assistant'],
          type: 'string',
        },
      },
      required: ['role', 'content'],
      type: 'object',
    },
    CreateAnswerRequest: {
      additionalProperties: false,
      properties: {
        documents: {
          description:
            'List of documents from which the answer for the input `question` should be derived. If this is an empty list, the question will be answered based on the question-answer examples.\n\nYou should specify either `documents` or a `file`, but not both.\n',
          example:
            "['Japan is an island country in East Asia, located in the northwest Pacific Ocean.', 'Tokyo is the capital and most populous prefecture of Japan.']",
          items: {
            type: 'string',
          },
          maxItems: 200,
          nullable: true,
          type: 'array',
        },
        examples: {
          description:
            "List of (question, answer) pairs that will help steer the model towards the tone and answer format you'd like. We recommend adding 2 to 3 examples.",
          example: "[['What is the capital of Canada?', 'Ottawa'], ['Which province is Ottawa in?', 'Ontario']]",
          items: {
            items: {
              minLength: 1,
              type: 'string',
            },
            maxItems: 2,
            minItems: 2,
            type: 'array',
          },
          maxItems: 200,
          minItems: 1,
          type: 'array',
        },
        examples_context: {
          description:
            'A text snippet containing the contextual information used to generate the answers for the `examples` you provide.',
          example:
            "Ottawa, Canada's capital, is located in the east of southern Ontario, near the city of Montréal and the U.S. border.",
          type: 'string',
        },
        expand: {
          default: [],
          description:
            'If an object name is in the list, we provide the full information of the object; otherwise, we only provide the object ID. Currently we support `completion` and `file` objects for expansion.',
          items: {},
          nullable: true,
          type: 'array',
        },
        file: {
          description:
            'The ID of an uploaded file that contains documents to search over. See [upload file](/docs/api-reference/files/upload) for how to upload a file of the desired format and purpose.\n\nYou should specify either `documents` or a `file`, but not both.\n',
          nullable: true,
          type: 'string',
        },
        logit_bias: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/logit_bias',
        },
        logprobs: {
          default: null,
          description:
            'Include the log probabilities on the `logprobs` most likely tokens, as well the chosen tokens. For example, if `logprobs` is 5, the API will return a list of the 5 most likely tokens. The API will always return the `logprob` of the sampled token, so there may be up to `logprobs+1` elements in the response.\n\nThe maximum value for `logprobs` is 5. If you need more than this, please contact us through our [Help center](https://help.openai.com) and describe your use case.\n\nWhen `logprobs` is set, `completion` will be automatically added into `expand` to get the logprobs.\n',
          maximum: 5,
          minimum: 0,
          nullable: true,
          type: 'integer',
        },
        max_rerank: {
          default: 200,
          description:
            'The maximum number of documents to be ranked by [Search](/docs/api-reference/searches/create) when using `file`. Setting it to a higher value leads to improved accuracy but with increased latency and cost.',
          nullable: true,
          type: 'integer',
        },
        max_tokens: {
          default: 16,
          description: 'The maximum number of tokens allowed for the generated answer',
          nullable: true,
          type: 'integer',
        },
        model: {
          description:
            'ID of the model to use for completion. You can select one of `ada`, `babbage`, `curie`, or `davinci`.',
          type: 'string',
        },
        n: {
          default: 1,
          description: 'How many answers to generate for each question.',
          maximum: 10,
          minimum: 1,
          nullable: true,
          type: 'integer',
        },
        question: {
          description: 'Question to get answered.',
          example: 'What is the capital of Japan?',
          minLength: 1,
          type: 'string',
        },
        return_metadata: {
          $ref: '#/components/schemas/CreateSearchRequest/properties/return_metadata',
        },
        return_prompt: {
          default: false,
          description:
            'If set to `true`, the returned JSON will include a "prompt" field containing the final prompt that was used to request a completion. This is mainly useful for debugging purposes.',
          nullable: true,
          type: 'boolean',
        },
        search_model: {
          default: 'ada',
          description:
            'ID of the model to use for [Search](/docs/api-reference/searches/create). You can select one of `ada`, `babbage`, `curie`, or `davinci`.',
          nullable: true,
          type: 'string',
        },
        stop: {
          default: null,
          description:
            'Up to 4 sequences where the API will stop generating further tokens. The returned text will not contain the stop sequence.\n',
          nullable: true,
          oneOf: [
            {
              default: '<|endoftext|>',
              example: '\n',
              type: 'string',
            },
            {
              items: {
                example: '["\\n"]',
                type: 'string',
              },
              maxItems: 4,
              minItems: 1,
              type: 'array',
            },
          ],
        },
        temperature: {
          default: 0,
          description:
            'What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.',
          nullable: true,
          type: 'number',
        },
        user: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/user',
        },
      },
      required: ['model', 'question', 'examples', 'examples_context'],
      type: 'object',
    },
    CreateAnswerResponse: {
      properties: {
        answers: {
          items: {
            type: 'string',
          },
          type: 'array',
        },
        completion: {
          type: 'string',
        },
        model: {
          type: 'string',
        },
        object: {
          type: 'string',
        },
        search_model: {
          type: 'string',
        },
        selected_documents: {
          items: {
            properties: {
              document: {
                type: 'integer',
              },
              text: {
                type: 'string',
              },
            },
            type: 'object',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    CreateChatCompletionRequest: {
      properties: {
        frequency_penalty: {
          default: 0,
          description:
            "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.\n\n[See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)\n",
          maximum: 2,
          minimum: -2,
          nullable: true,
          type: 'number',
        },
        logit_bias: {
          default: null,
          description:
            'Modify the likelihood of specified tokens appearing in the completion.\n\nAccepts a json object that maps tokens (specified by their token ID in the tokenizer) to an associated bias value from -100 to 100. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token.\n',
          nullable: true,
          type: 'object',
          'x-oaiTypeLabel': 'map',
        },
        max_tokens: {
          default: 'inf',
          description:
            'The maximum number of tokens allowed for the generated answer. By default, the number of tokens the model can return will be (4096 - prompt tokens).\n',
          type: 'integer',
        },
        messages: {
          description:
            'The messages to generate chat completions for, in the [chat format](/docs/guides/chat/introduction).',
          items: {
            $ref: '#/components/schemas/ChatCompletionRequestMessage',
          },
          minItems: 1,
          type: 'array',
        },
        model: {
          description:
            'ID of the model to use. Currently, only `gpt-3.5-turbo` and `gpt-3.5-turbo-0301` are supported.',
          type: 'string',
        },
        n: {
          default: 1,
          description: 'How many chat completion choices to generate for each input message.',
          example: 1,
          maximum: 128,
          minimum: 1,
          nullable: true,
          type: 'integer',
        },
        presence_penalty: {
          default: 0,
          description:
            "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.\n\n[See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)\n",
          maximum: 2,
          minimum: -2,
          nullable: true,
          type: 'number',
        },
        stop: {
          default: null,
          description: 'Up to 4 sequences where the API will stop generating further tokens.\n',
          oneOf: [
            {
              nullable: true,
              type: 'string',
            },
            {
              items: {
                type: 'string',
              },
              maxItems: 4,
              minItems: 1,
              type: 'array',
            },
          ],
        },
        stream: {
          default: false,
          description:
            'If set, partial message deltas will be sent, like in ChatGPT. Tokens will be sent as data-only [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format) as they become available, with the stream terminated by a `data: [DONE]` message.\n',
          nullable: true,
          type: 'boolean',
        },
        temperature: {
          default: 1,
          description:
            'What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.\n\nWe generally recommend altering this or `top_p` but not both.\n',
          example: 1,
          maximum: 2,
          minimum: 0,
          nullable: true,
          type: 'number',
        },
        top_p: {
          default: 1,
          description:
            'An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.\n\nWe generally recommend altering this or `temperature` but not both.\n',
          example: 1,
          maximum: 1,
          minimum: 0,
          nullable: true,
          type: 'number',
        },
        user: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/user',
        },
      },
      required: ['model', 'messages'],
      type: 'object',
    },
    CreateChatCompletionResponse: {
      properties: {
        choices: {
          items: {
            properties: {
              finish_reason: {
                type: 'string',
              },
              index: {
                type: 'integer',
              },
              message: {
                $ref: '#/components/schemas/ChatCompletionResponseMessage',
              },
            },
            type: 'object',
          },
          type: 'array',
        },
        created: {
          type: 'integer',
        },
        id: {
          type: 'string',
        },
        model: {
          type: 'string',
        },
        object: {
          type: 'string',
        },
        usage: {
          properties: {
            completion_tokens: {
              type: 'integer',
            },
            prompt_tokens: {
              type: 'integer',
            },
            total_tokens: {
              type: 'integer',
            },
          },
          required: ['prompt_tokens', 'completion_tokens', 'total_tokens'],
          type: 'object',
        },
      },
      required: ['id', 'object', 'created', 'model', 'choices'],
      type: 'object',
    },
    CreateClassificationRequest: {
      additionalProperties: false,
      properties: {
        examples: {
          description:
            'A list of examples with labels, in the following format:\n\n`[["The movie is so interesting.", "Positive"], ["It is quite boring.", "Negative"], ...]`\n\nAll the label strings will be normalized to be capitalized.\n\nYou should specify either `examples` or `file`, but not both.\n',
          example:
            "[['Do not see this film.', 'Negative'], ['Smart, provocative and blisteringly funny.', 'Positive']]",
          items: {
            items: {
              minLength: 1,
              type: 'string',
            },
            maxItems: 2,
            minItems: 2,
            type: 'array',
          },
          maxItems: 200,
          minItems: 2,
          nullable: true,
          type: 'array',
        },
        expand: {
          $ref: '#/components/schemas/CreateAnswerRequest/properties/expand',
        },
        file: {
          description:
            'The ID of the uploaded file that contains training examples. See [upload file](/docs/api-reference/files/upload) for how to upload a file of the desired format and purpose.\n\nYou should specify either `examples` or `file`, but not both.\n',
          nullable: true,
          type: 'string',
        },
        labels: {
          default: null,
          description:
            'The set of categories being classified. If not specified, candidate labels will be automatically collected from the examples you provide. All the label strings will be normalized to be capitalized.',
          example: ['Positive', 'Negative'],
          items: {
            type: 'string',
          },
          maxItems: 200,
          minItems: 2,
          nullable: true,
          type: 'array',
        },
        logit_bias: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/logit_bias',
        },
        logprobs: {
          $ref: '#/components/schemas/CreateAnswerRequest/properties/logprobs',
        },
        max_examples: {
          default: 200,
          description:
            'The maximum number of examples to be ranked by [Search](/docs/api-reference/searches/create) when using `file`. Setting it to a higher value leads to improved accuracy but with increased latency and cost.',
          nullable: true,
          type: 'integer',
        },
        model: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/model',
        },
        query: {
          description: 'Query to be classified.',
          example: 'The plot is not very attractive.',
          minLength: 1,
          type: 'string',
        },
        return_metadata: {
          $ref: '#/components/schemas/CreateSearchRequest/properties/return_metadata',
        },
        return_prompt: {
          $ref: '#/components/schemas/CreateAnswerRequest/properties/return_prompt',
        },
        search_model: {
          $ref: '#/components/schemas/CreateAnswerRequest/properties/search_model',
        },
        temperature: {
          default: 0,
          description:
            'What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.',
          example: 0,
          maximum: 2,
          minimum: 0,
          nullable: true,
          type: 'number',
        },
        user: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/user',
        },
      },
      required: ['model', 'query'],
      type: 'object',
    },
    CreateClassificationResponse: {
      properties: {
        completion: {
          type: 'string',
        },
        label: {
          type: 'string',
        },
        model: {
          type: 'string',
        },
        object: {
          type: 'string',
        },
        search_model: {
          type: 'string',
        },
        selected_examples: {
          items: {
            properties: {
              document: {
                type: 'integer',
              },
              label: {
                type: 'string',
              },
              text: {
                type: 'string',
              },
            },
            type: 'object',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    CreateCompletionRequest: {
      properties: {
        best_of: {
          default: 1,
          description:
            'Generates `best_of` completions server-side and returns the "best" (the one with the highest log probability per token). Results cannot be streamed.\n\nWhen used with `n`, `best_of` controls the number of candidate completions and `n` specifies how many to return – `best_of` must be greater than `n`.\n\n**Note:** Because this parameter generates many completions, it can quickly consume your token quota. Use carefully and ensure that you have reasonable settings for `max_tokens` and `stop`.\n',
          maximum: 20,
          minimum: 0,
          nullable: true,
          type: 'integer',
        },
        echo: {
          default: false,
          description: 'Echo back the prompt in addition to the completion\n',
          nullable: true,
          type: 'boolean',
        },
        frequency_penalty: {
          default: 0,
          description:
            "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.\n\n[See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)\n",
          maximum: 2,
          minimum: -2,
          nullable: true,
          type: 'number',
        },
        logit_bias: {
          default: null,
          description:
            'Modify the likelihood of specified tokens appearing in the completion.\n\nAccepts a json object that maps tokens (specified by their token ID in the GPT tokenizer) to an associated bias value from -100 to 100. You can use this [tokenizer tool](/tokenizer?view=bpe) (which works for both GPT-2 and GPT-3) to convert text to token IDs. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token.\n\nAs an example, you can pass `{"50256": -100}` to prevent the <|endoftext|> token from being generated.\n',
          nullable: true,
          type: 'object',
          'x-oaiTypeLabel': 'map',
        },
        logprobs: {
          default: null,
          description:
            'Include the log probabilities on the `logprobs` most likely tokens, as well the chosen tokens. For example, if `logprobs` is 5, the API will return a list of the 5 most likely tokens. The API will always return the `logprob` of the sampled token, so there may be up to `logprobs+1` elements in the response.\n\nThe maximum value for `logprobs` is 5. If you need more than this, please contact us through our [Help center](https://help.openai.com) and describe your use case.\n',
          maximum: 5,
          minimum: 0,
          nullable: true,
          type: 'integer',
        },
        max_tokens: {
          default: 16,
          description:
            "The maximum number of [tokens](/tokenizer) to generate in the completion.\n\nThe token count of your prompt plus `max_tokens` cannot exceed the model's context length. Most models have a context length of 2048 tokens (except for the newest models, which support 4096).\n",
          example: 16,
          minimum: 0,
          nullable: true,
          type: 'integer',
        },
        model: {
          description:
            'ID of the model to use. You can use the [List models](/docs/api-reference/models/list) API to see all of your available models, or see our [Model overview](/docs/models/overview) for descriptions of them.',
          type: 'string',
        },
        n: {
          default: 1,
          description:
            'How many completions to generate for each prompt.\n\n**Note:** Because this parameter generates many completions, it can quickly consume your token quota. Use carefully and ensure that you have reasonable settings for `max_tokens` and `stop`.\n',
          example: 1,
          maximum: 128,
          minimum: 1,
          nullable: true,
          type: 'integer',
        },
        presence_penalty: {
          default: 0,
          description:
            "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.\n\n[See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)\n",
          maximum: 2,
          minimum: -2,
          nullable: true,
          type: 'number',
        },
        prompt: {
          default: '<|endoftext|>',
          description:
            'The prompt(s) to generate completions for, encoded as a string, array of strings, array of tokens, or array of token arrays.\n\nNote that <|endoftext|> is the document separator that the model sees during training, so if a prompt is not specified the model will generate as if from the beginning of a new document.\n',
          nullable: true,
          oneOf: [
            {
              default: '',
              example: 'This is a test.',
              type: 'string',
            },
            {
              items: {
                default: '',
                example: 'This is a test.',
                type: 'string',
              },
              type: 'array',
            },
            {
              example: '[1212, 318, 257, 1332, 13]',
              items: {
                type: 'integer',
              },
              minItems: 1,
              type: 'array',
            },
            {
              example: '[[1212, 318, 257, 1332, 13]]',
              items: {
                items: {
                  type: 'integer',
                },
                minItems: 1,
                type: 'array',
              },
              minItems: 1,
              type: 'array',
            },
          ],
        },
        stop: {
          default: null,
          description:
            'Up to 4 sequences where the API will stop generating further tokens. The returned text will not contain the stop sequence.\n',
          nullable: true,
          oneOf: [
            {
              default: '<|endoftext|>',
              example: '\n',
              nullable: true,
              type: 'string',
            },
            {
              items: {
                example: '["\\n"]',
                type: 'string',
              },
              maxItems: 4,
              minItems: 1,
              type: 'array',
            },
          ],
        },
        stream: {
          default: false,
          description:
            'Whether to stream back partial progress. If set, tokens will be sent as data-only [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format) as they become available, with the stream terminated by a `data: [DONE]` message.\n',
          nullable: true,
          type: 'boolean',
        },
        suffix: {
          default: null,
          description: 'The suffix that comes after a completion of inserted text.',
          example: 'test.',
          nullable: true,
          type: 'string',
        },
        temperature: {
          default: 1,
          description:
            'What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.\n\nWe generally recommend altering this or `top_p` but not both.\n',
          example: 1,
          maximum: 2,
          minimum: 0,
          nullable: true,
          type: 'number',
        },
        top_p: {
          default: 1,
          description:
            'An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.\n\nWe generally recommend altering this or `temperature` but not both.\n',
          example: 1,
          maximum: 1,
          minimum: 0,
          nullable: true,
          type: 'number',
        },
        user: {
          description:
            'A unique identifier representing your end-user, which can help OpenAI to monitor and detect abuse. [Learn more](/docs/guides/safety-best-practices/end-user-ids).\n',
          example: 'user-1234',
          type: 'string',
        },
      },
      required: ['model'],
      type: 'object',
    },
    CreateCompletionResponse: {
      properties: {
        choices: {
          items: {
            properties: {
              finish_reason: {
                type: 'string',
              },
              index: {
                type: 'integer',
              },
              logprobs: {
                nullable: true,
                properties: {
                  text_offset: {
                    items: {
                      type: 'integer',
                    },
                    type: 'array',
                  },
                  token_logprobs: {
                    items: {
                      type: 'number',
                    },
                    type: 'array',
                  },
                  tokens: {
                    items: {
                      type: 'string',
                    },
                    type: 'array',
                  },
                  top_logprobs: {
                    items: {
                      type: 'object',
                    },
                    type: 'array',
                  },
                },
                type: 'object',
              },
              text: {
                type: 'string',
              },
            },
            type: 'object',
          },
          type: 'array',
        },
        created: {
          type: 'integer',
        },
        id: {
          type: 'string',
        },
        model: {
          type: 'string',
        },
        object: {
          type: 'string',
        },
        usage: {
          properties: {
            completion_tokens: {
              type: 'integer',
            },
            prompt_tokens: {
              type: 'integer',
            },
            total_tokens: {
              type: 'integer',
            },
          },
          required: ['prompt_tokens', 'completion_tokens', 'total_tokens'],
          type: 'object',
        },
      },
      required: ['id', 'object', 'created', 'model', 'choices'],
      type: 'object',
    },
    CreateEditRequest: {
      properties: {
        input: {
          default: '',
          description: 'The input text to use as a starting point for the edit.',
          example: 'What day of the wek is it?',
          nullable: true,
          type: 'string',
        },
        instruction: {
          description: 'The instruction that tells the model how to edit the prompt.',
          example: 'Fix the spelling mistakes.',
          type: 'string',
        },
        model: {
          description:
            'ID of the model to use. You can use the `text-davinci-edit-001` or `code-davinci-edit-001` model with this endpoint.',
          type: 'string',
        },
        n: {
          default: 1,
          description: 'How many edits to generate for the input and instruction.',
          example: 1,
          maximum: 20,
          minimum: 1,
          nullable: true,
          type: 'integer',
        },
        temperature: {
          default: 1,
          description:
            'What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.\n\nWe generally recommend altering this or `top_p` but not both.\n',
          example: 1,
          maximum: 2,
          minimum: 0,
          nullable: true,
          type: 'number',
        },
        top_p: {
          default: 1,
          description:
            'An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.\n\nWe generally recommend altering this or `temperature` but not both.\n',
          example: 1,
          maximum: 1,
          minimum: 0,
          nullable: true,
          type: 'number',
        },
      },
      required: ['model', 'instruction'],
      type: 'object',
    },
    CreateEditResponse: {
      properties: {
        choices: {
          items: {
            properties: {
              finish_reason: {
                type: 'string',
              },
              index: {
                type: 'integer',
              },
              logprobs: {
                nullable: true,
                properties: {
                  text_offset: {
                    items: {
                      type: 'integer',
                    },
                    type: 'array',
                  },
                  token_logprobs: {
                    items: {
                      type: 'number',
                    },
                    type: 'array',
                  },
                  tokens: {
                    items: {
                      type: 'string',
                    },
                    type: 'array',
                  },
                  top_logprobs: {
                    items: {
                      type: 'object',
                    },
                    type: 'array',
                  },
                },
                type: 'object',
              },
              text: {
                type: 'string',
              },
            },
            type: 'object',
          },
          type: 'array',
        },
        created: {
          type: 'integer',
        },
        object: {
          type: 'string',
        },
        usage: {
          properties: {
            completion_tokens: {
              type: 'integer',
            },
            prompt_tokens: {
              type: 'integer',
            },
            total_tokens: {
              type: 'integer',
            },
          },
          required: ['prompt_tokens', 'completion_tokens', 'total_tokens'],
          type: 'object',
        },
      },
      required: ['object', 'created', 'choices', 'usage'],
      type: 'object',
    },
    CreateEmbeddingRequest: {
      additionalProperties: false,
      properties: {
        input: {
          description:
            'Input text to get embeddings for, encoded as a string or array of tokens. To get embeddings for multiple inputs in a single request, pass an array of strings or array of token arrays. Each input must not exceed 8192 tokens in length.\n',
          example: 'The quick brown fox jumped over the lazy dog',
          oneOf: [
            {
              default: '',
              example: 'This is a test.',
              type: 'string',
            },
            {
              items: {
                default: '',
                example: 'This is a test.',
                type: 'string',
              },
              type: 'array',
            },
            {
              example: '[1212, 318, 257, 1332, 13]',
              items: {
                type: 'integer',
              },
              minItems: 1,
              type: 'array',
            },
            {
              example: '[[1212, 318, 257, 1332, 13]]',
              items: {
                items: {
                  type: 'integer',
                },
                minItems: 1,
                type: 'array',
              },
              minItems: 1,
              type: 'array',
            },
          ],
        },
        model: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/model',
        },
        user: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/user',
        },
      },
      required: ['model', 'input'],
      type: 'object',
    },
    CreateEmbeddingResponse: {
      properties: {
        data: {
          items: {
            properties: {
              embedding: {
                items: {
                  type: 'number',
                },
                type: 'array',
              },
              index: {
                type: 'integer',
              },
              object: {
                type: 'string',
              },
            },
            required: ['index', 'object', 'embedding'],
            type: 'object',
          },
          type: 'array',
        },
        model: {
          type: 'string',
        },
        object: {
          type: 'string',
        },
        usage: {
          properties: {
            prompt_tokens: {
              type: 'integer',
            },
            total_tokens: {
              type: 'integer',
            },
          },
          required: ['prompt_tokens', 'total_tokens'],
          type: 'object',
        },
      },
      required: ['object', 'model', 'data', 'usage'],
      type: 'object',
    },
    CreateFileRequest: {
      additionalProperties: false,
      properties: {
        file: {
          description:
            'Name of the [JSON Lines](https://jsonlines.readthedocs.io/en/latest/) file to be uploaded.\n\nIf the `purpose` is set to "fine-tune", each line is a JSON record with "prompt" and "completion" fields representing your [training examples](/docs/guides/fine-tuning/prepare-training-data).\n',
          format: 'binary',
          type: 'string',
        },
        purpose: {
          description:
            'The intended purpose of the uploaded documents.\n\nUse "fine-tune" for [Fine-tuning](/docs/api-reference/fine-tunes). This allows us to validate the format of the uploaded file.\n',
          type: 'string',
        },
      },
      required: ['file', 'purpose'],
      type: 'object',
    },
    CreateFineTuneRequest: {
      properties: {
        batch_size: {
          default: null,
          description:
            "The batch size to use for training. The batch size is the number of\ntraining examples used to train a single forward and backward pass.\n\nBy default, the batch size will be dynamically configured to be\n~0.2% of the number of examples in the training set, capped at 256 -\nin general, we've found that larger batch sizes tend to work better\nfor larger datasets.\n",
          nullable: true,
          type: 'integer',
        },
        classification_betas: {
          default: null,
          description:
            'If this is provided, we calculate F-beta scores at the specified\nbeta values. The F-beta score is a generalization of F-1 score.\nThis is only used for binary classification.\n\nWith a beta of 1 (i.e. the F-1 score), precision and recall are\ngiven the same weight. A larger beta score puts more weight on\nrecall and less on precision. A smaller beta score puts more weight\non precision and less on recall.\n',
          example: [0.6, 1, 1.5, 2],
          items: {
            type: 'number',
          },
          nullable: true,
          type: 'array',
        },
        classification_n_classes: {
          default: null,
          description:
            'The number of classes in a classification task.\n\nThis parameter is required for multiclass classification.\n',
          nullable: true,
          type: 'integer',
        },
        classification_positive_class: {
          default: null,
          description:
            'The positive class in binary classification.\n\nThis parameter is needed to generate precision, recall, and F1\nmetrics when doing binary classification.\n',
          nullable: true,
          type: 'string',
        },
        compute_classification_metrics: {
          default: false,
          description:
            'If set, we calculate classification-specific metrics such as accuracy\nand F-1 score using the validation set at the end of every epoch.\nThese metrics can be viewed in the [results file](/docs/guides/fine-tuning/analyzing-your-fine-tuned-model).\n\nIn order to compute classification metrics, you must provide a\n`validation_file`. Additionally, you must\nspecify `classification_n_classes` for multiclass classification or\n`classification_positive_class` for binary classification.\n',
          nullable: true,
          type: 'boolean',
        },
        learning_rate_multiplier: {
          default: null,
          description:
            'The learning rate multiplier to use for training.\nThe fine-tuning learning rate is the original learning rate used for\npretraining multiplied by this value.\n\nBy default, the learning rate multiplier is the 0.05, 0.1, or 0.2\ndepending on final `batch_size` (larger learning rates tend to\nperform better with larger batch sizes). We recommend experimenting\nwith values in the range 0.02 to 0.2 to see what produces the best\nresults.\n',
          nullable: true,
          type: 'number',
        },
        model: {
          default: 'curie',
          description:
            'The name of the base model to fine-tune. You can select one of "ada",\n"babbage", "curie", "davinci", or a fine-tuned model created after 2022-04-21.\nTo learn more about these models, see the\n[Models](https://platform.openai.com/docs/models) documentation.\n',
          nullable: true,
          type: 'string',
        },
        n_epochs: {
          default: 4,
          description:
            'The number of epochs to train the model for. An epoch refers to one\nfull cycle through the training dataset.\n',
          nullable: true,
          type: 'integer',
        },
        prompt_loss_weight: {
          default: 0.01,
          description:
            'The weight to use for loss on the prompt tokens. This controls how\nmuch the model tries to learn to generate the prompt (as compared\nto the completion which always has a weight of 1.0), and can add\na stabilizing effect to training when completions are short.\n\nIf prompts are extremely long (relative to completions), it may make\nsense to reduce this weight so as to avoid over-prioritizing\nlearning the prompt.\n',
          nullable: true,
          type: 'number',
        },
        suffix: {
          default: null,
          description:
            'A string of up to 40 characters that will be added to your fine-tuned model name.\n\nFor example, a `suffix` of "custom-model-name" would produce a model name like `ada:ft-your-org:custom-model-name-2022-02-15-04-21-04`.\n',
          maxLength: 40,
          minLength: 1,
          nullable: true,
          type: 'string',
        },
        training_file: {
          description:
            'The ID of an uploaded file that contains training data.\n\nSee [upload file](/docs/api-reference/files/upload) for how to upload a file.\n\nYour dataset must be formatted as a JSONL file, where each training\nexample is a JSON object with the keys "prompt" and "completion".\nAdditionally, you must upload your file with the purpose `fine-tune`.\n\nSee the [fine-tuning guide](/docs/guides/fine-tuning/creating-training-data) for more details.\n',
          example: 'file-ajSREls59WBbvgSzJSVWxMCB',
          type: 'string',
        },
        validation_file: {
          description:
            'The ID of an uploaded file that contains validation data.\n\nIf you provide this file, the data is used to generate validation\nmetrics periodically during fine-tuning. These metrics can be viewed in\nthe [fine-tuning results file](/docs/guides/fine-tuning/analyzing-your-fine-tuned-model).\nYour train and validation data should be mutually exclusive.\n\nYour dataset must be formatted as a JSONL file, where each validation\nexample is a JSON object with the keys "prompt" and "completion".\nAdditionally, you must upload your file with the purpose `fine-tune`.\n\nSee the [fine-tuning guide](/docs/guides/fine-tuning/creating-training-data) for more details.\n',
          example: 'file-XjSREls59WBbvgSzJSVWxMCa',
          nullable: true,
          type: 'string',
        },
      },
      required: ['training_file'],
      type: 'object',
    },
    CreateImageEditRequest: {
      properties: {
        image: {
          description:
            'The image to edit. Must be a valid PNG file, less than 4MB, and square. If mask is not provided, image must have transparency, which will be used as the mask.',
          format: 'binary',
          type: 'string',
        },
        mask: {
          description:
            'An additional image whose fully transparent areas (e.g. where alpha is zero) indicate where `image` should be edited. Must be a valid PNG file, less than 4MB, and have the same dimensions as `image`.',
          format: 'binary',
          type: 'string',
        },
        n: {
          $ref: '#/components/schemas/CreateImageRequest/properties/n',
        },
        prompt: {
          description: 'A text description of the desired image(s). The maximum length is 1000 characters.',
          example: 'A cute baby sea otter wearing a beret',
          type: 'string',
        },
        response_format: {
          $ref: '#/components/schemas/CreateImageRequest/properties/response_format',
        },
        size: {
          $ref: '#/components/schemas/CreateImageRequest/properties/size',
        },
        user: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/user',
        },
      },
      required: ['prompt', 'image'],
      type: 'object',
    },
    CreateImageRequest: {
      properties: {
        n: {
          default: 1,
          description: 'The number of images to generate. Must be between 1 and 10.',
          example: 1,
          maximum: 10,
          minimum: 1,
          nullable: true,
          type: 'integer',
        },
        prompt: {
          description: 'A text description of the desired image(s). The maximum length is 1000 characters.',
          example: 'A cute baby sea otter',
          type: 'string',
        },
        response_format: {
          default: 'url',
          description: 'The format in which the generated images are returned. Must be one of `url` or `b64_json`.',
          enum: ['url', 'b64_json'],
          example: 'url',
          nullable: true,
          type: 'string',
        },
        size: {
          default: '1024x1024',
          description: 'The size of the generated images. Must be one of `256x256`, `512x512`, or `1024x1024`.',
          enum: ['256x256', '512x512', '1024x1024'],
          example: '1024x1024',
          nullable: true,
          type: 'string',
        },
        user: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/user',
        },
      },
      required: ['prompt'],
      type: 'object',
    },
    CreateImageVariationRequest: {
      properties: {
        image: {
          description:
            'The image to use as the basis for the variation(s). Must be a valid PNG file, less than 4MB, and square.',
          format: 'binary',
          type: 'string',
        },
        n: {
          $ref: '#/components/schemas/CreateImageRequest/properties/n',
        },
        response_format: {
          $ref: '#/components/schemas/CreateImageRequest/properties/response_format',
        },
        size: {
          $ref: '#/components/schemas/CreateImageRequest/properties/size',
        },
        user: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/user',
        },
      },
      required: ['image'],
      type: 'object',
    },
    CreateModerationRequest: {
      properties: {
        input: {
          description: 'The input text to classify',
          oneOf: [
            {
              default: '',
              example: 'I want to kill them.',
              type: 'string',
            },
            {
              items: {
                default: '',
                example: 'I want to kill them.',
                type: 'string',
              },
              type: 'array',
            },
          ],
        },
        model: {
          default: 'text-moderation-latest',
          description:
            'Two content moderations models are available: `text-moderation-stable` and `text-moderation-latest`.\n\nThe default is `text-moderation-latest` which will be automatically upgraded over time. This ensures you are always using our most accurate model. If you use `text-moderation-stable`, we will provide advanced notice before updating the model. Accuracy of `text-moderation-stable` may be slightly lower than for `text-moderation-latest`.\n',
          example: 'text-moderation-stable',
          nullable: false,
          type: 'string',
        },
      },
      required: ['input'],
      type: 'object',
    },
    CreateModerationResponse: {
      properties: {
        id: {
          type: 'string',
        },
        model: {
          type: 'string',
        },
        results: {
          items: {
            properties: {
              categories: {
                properties: {
                  hate: {
                    type: 'boolean',
                  },
                  'hate/threatening': {
                    type: 'boolean',
                  },
                  'self-harm': {
                    type: 'boolean',
                  },
                  sexual: {
                    type: 'boolean',
                  },
                  'sexual/minors': {
                    type: 'boolean',
                  },
                  violence: {
                    type: 'boolean',
                  },
                  'violence/graphic': {
                    type: 'boolean',
                  },
                },
                required: [
                  'hate',
                  'hate/threatening',
                  'self-harm',
                  'sexual',
                  'sexual/minors',
                  'violence',
                  'violence/graphic',
                ],
                type: 'object',
              },
              category_scores: {
                properties: {
                  hate: {
                    type: 'number',
                  },
                  'hate/threatening': {
                    type: 'number',
                  },
                  'self-harm': {
                    type: 'number',
                  },
                  sexual: {
                    type: 'number',
                  },
                  'sexual/minors': {
                    type: 'number',
                  },
                  violence: {
                    type: 'number',
                  },
                  'violence/graphic': {
                    type: 'number',
                  },
                },
                required: [
                  'hate',
                  'hate/threatening',
                  'self-harm',
                  'sexual',
                  'sexual/minors',
                  'violence',
                  'violence/graphic',
                ],
                type: 'object',
              },
              flagged: {
                type: 'boolean',
              },
            },
            required: ['flagged', 'categories', 'category_scores'],
            type: 'object',
          },
          type: 'array',
        },
      },
      required: ['id', 'model', 'results'],
      type: 'object',
    },
    CreateSearchRequest: {
      properties: {
        documents: {
          description:
            'Up to 200 documents to search over, provided as a list of strings.\n\nThe maximum document length (in tokens) is 2034 minus the number of tokens in the query.\n\nYou should specify either `documents` or a `file`, but not both.\n',
          example: "['White House', 'hospital', 'school']",
          items: {
            type: 'string',
          },
          maxItems: 200,
          minItems: 1,
          nullable: true,
          type: 'array',
        },
        file: {
          description:
            'The ID of an uploaded file that contains documents to search over.\n\nYou should specify either `documents` or a `file`, but not both.\n',
          nullable: true,
          type: 'string',
        },
        max_rerank: {
          default: 200,
          description:
            'The maximum number of documents to be re-ranked and returned by search.\n\nThis flag only takes effect when `file` is set.\n',
          minimum: 1,
          nullable: true,
          type: 'integer',
        },
        query: {
          description: 'Query to search against the documents.',
          example: 'the president',
          minLength: 1,
          type: 'string',
        },
        return_metadata: {
          default: false,
          description:
            'A special boolean flag for showing metadata. If set to `true`, each document entry in the returned JSON will contain a "metadata" field.\n\nThis flag only takes effect when `file` is set.\n',
          nullable: true,
          type: 'boolean',
        },
        user: {
          $ref: '#/components/schemas/CreateCompletionRequest/properties/user',
        },
      },
      required: ['query'],
      type: 'object',
    },
    CreateSearchResponse: {
      properties: {
        data: {
          items: {
            properties: {
              document: {
                type: 'integer',
              },
              object: {
                type: 'string',
              },
              score: {
                type: 'number',
              },
            },
            type: 'object',
          },
          type: 'array',
        },
        model: {
          type: 'string',
        },
        object: {
          type: 'string',
        },
      },
      type: 'object',
    },
    CreateTranscriptionRequest: {
      additionalProperties: false,
      properties: {
        file: {
          description:
            'The audio file to transcribe, in one of these formats: mp3, mp4, mpeg, mpga, m4a, wav, or webm.\n',
          format: 'binary',
          type: 'string',
        },
        language: {
          description:
            'The language of the input audio. Supplying the input language in [ISO-639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) format will improve accuracy and latency.\n',
          type: 'string',
        },
        model: {
          description: 'ID of the model to use. Only `whisper-1` is currently available.\n',
          type: 'string',
        },
        prompt: {
          description:
            "An optional text to guide the model's style or continue a previous audio segment. The [prompt](/docs/guides/speech-to-text/prompting) should match the audio language.\n",
          type: 'string',
        },
        response_format: {
          default: 'json',
          description:
            'The format of the transcript output, in one of these options: json, text, srt, verbose_json, or vtt.\n',
          type: 'string',
        },
        temperature: {
          default: 0,
          description:
            'The sampling temperature, between 0 and 1. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. If set to 0, the model will use [log probability](https://en.wikipedia.org/wiki/Log_probability) to automatically increase the temperature until certain thresholds are hit.\n',
          type: 'number',
        },
      },
      required: ['file', 'model'],
      type: 'object',
    },
    CreateTranscriptionResponse: {
      properties: {
        text: {
          type: 'string',
        },
      },
      required: ['text'],
      type: 'object',
    },
    CreateTranslationRequest: {
      additionalProperties: false,
      properties: {
        file: {
          description:
            'The audio file to translate, in one of these formats: mp3, mp4, mpeg, mpga, m4a, wav, or webm.\n',
          format: 'binary',
          type: 'string',
        },
        model: {
          description: 'ID of the model to use. Only `whisper-1` is currently available.\n',
          type: 'string',
        },
        prompt: {
          description:
            "An optional text to guide the model's style or continue a previous audio segment. The [prompt](/docs/guides/speech-to-text/prompting) should be in English.\n",
          type: 'string',
        },
        response_format: {
          default: 'json',
          description:
            'The format of the transcript output, in one of these options: json, text, srt, verbose_json, or vtt.\n',
          type: 'string',
        },
        temperature: {
          default: 0,
          description:
            'The sampling temperature, between 0 and 1. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. If set to 0, the model will use [log probability](https://en.wikipedia.org/wiki/Log_probability) to automatically increase the temperature until certain thresholds are hit.\n',
          type: 'number',
        },
      },
      required: ['file', 'model'],
      type: 'object',
    },
    CreateTranslationResponse: {
      properties: {
        text: {
          type: 'string',
        },
      },
      required: ['text'],
      type: 'object',
    },
    DeleteFileResponse: {
      properties: {
        deleted: {
          type: 'boolean',
        },
        id: {
          type: 'string',
        },
        object: {
          type: 'string',
        },
      },
      required: ['id', 'object', 'deleted'],
      type: 'object',
    },
    DeleteModelResponse: {
      properties: {
        deleted: {
          type: 'boolean',
        },
        id: {
          type: 'string',
        },
        object: {
          type: 'string',
        },
      },
      required: ['id', 'object', 'deleted'],
      type: 'object',
    },
    Engine: {
      properties: {
        created: {
          nullable: true,
          type: 'integer',
        },
        id: {
          type: 'string',
        },
        object: {
          type: 'string',
        },
        ready: {
          type: 'boolean',
        },
      },
      required: ['id', 'object', 'created', 'ready'],
      title: 'Engine',
    },
    FineTune: {
      properties: {
        created_at: {
          type: 'integer',
        },
        events: {
          items: {
            $ref: '#/components/schemas/FineTuneEvent',
          },
          type: 'array',
        },
        fine_tuned_model: {
          nullable: true,
          type: 'string',
        },
        hyperparams: {
          type: 'object',
        },
        id: {
          type: 'string',
        },
        model: {
          type: 'string',
        },
        object: {
          type: 'string',
        },
        organization_id: {
          type: 'string',
        },
        result_files: {
          items: {
            $ref: '#/components/schemas/OpenAIFile',
          },
          type: 'array',
        },
        status: {
          type: 'string',
        },
        training_files: {
          items: {
            $ref: '#/components/schemas/OpenAIFile',
          },
          type: 'array',
        },
        updated_at: {
          type: 'integer',
        },
        validation_files: {
          items: {
            $ref: '#/components/schemas/OpenAIFile',
          },
          type: 'array',
        },
      },
      required: [
        'id',
        'object',
        'created_at',
        'updated_at',
        'model',
        'fine_tuned_model',
        'organization_id',
        'status',
        'hyperparams',
        'training_files',
        'validation_files',
        'result_files',
      ],
      title: 'FineTune',
    },
    FineTuneEvent: {
      properties: {
        created_at: {
          type: 'integer',
        },
        level: {
          type: 'string',
        },
        message: {
          type: 'string',
        },
        object: {
          type: 'string',
        },
      },
      required: ['object', 'created_at', 'level', 'message'],
      title: 'FineTuneEvent',
    },
    ImagesResponse: {
      properties: {
        created: {
          type: 'integer',
        },
        data: {
          items: {
            properties: {
              b64_json: {
                type: 'string',
              },
              url: {
                type: 'string',
              },
            },
            type: 'object',
          },
          type: 'array',
        },
      },
      required: ['created', 'data'],
    },
    ListEnginesResponse: {
      properties: {
        data: {
          items: {
            $ref: '#/components/schemas/Engine',
          },
          type: 'array',
        },
        object: {
          type: 'string',
        },
      },
      required: ['object', 'data'],
      type: 'object',
    },
    ListFilesResponse: {
      properties: {
        data: {
          items: {
            $ref: '#/components/schemas/OpenAIFile',
          },
          type: 'array',
        },
        object: {
          type: 'string',
        },
      },
      required: ['object', 'data'],
      type: 'object',
    },
    ListFineTuneEventsResponse: {
      properties: {
        data: {
          items: {
            $ref: '#/components/schemas/FineTuneEvent',
          },
          type: 'array',
        },
        object: {
          type: 'string',
        },
      },
      required: ['object', 'data'],
      type: 'object',
    },
    ListFineTunesResponse: {
      properties: {
        data: {
          items: {
            $ref: '#/components/schemas/FineTune',
          },
          type: 'array',
        },
        object: {
          type: 'string',
        },
      },
      required: ['object', 'data'],
      type: 'object',
    },
    ListModelsResponse: {
      properties: {
        data: {
          items: {
            $ref: '#/components/schemas/Model',
          },
          type: 'array',
        },
        object: {
          type: 'string',
        },
      },
      required: ['object', 'data'],
      type: 'object',
    },
    Model: {
      properties: {
        created: {
          type: 'integer',
        },
        id: {
          type: 'string',
        },
        object: {
          type: 'string',
        },
        owned_by: {
          type: 'string',
        },
      },
      required: ['id', 'object', 'created', 'owned_by'],
      title: 'Model',
    },
    OpenAIFile: {
      properties: {
        bytes: {
          type: 'integer',
        },
        created_at: {
          type: 'integer',
        },
        filename: {
          type: 'string',
        },
        id: {
          type: 'string',
        },
        object: {
          type: 'string',
        },
        purpose: {
          type: 'string',
        },
        status: {
          type: 'string',
        },
        status_details: {
          nullable: true,
          type: 'object',
        },
      },
      required: ['id', 'object', 'bytes', 'created_at', 'filename', 'purpose'],
      title: 'OpenAIFile',
    },
  },
} as TComponents;
