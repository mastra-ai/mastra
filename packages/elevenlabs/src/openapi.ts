// @ts-nocheck
export type openapi = {
  openapi: '3.0.2';
  paths: {
    '/v1/history': {
      get: {
        tags: ['history'];
        summary: 'Get Generated Items';
        description: 'Returns metadata about all your generated audio.';
        operationId: 'Get_generated_items_v1_history_get';
        parameters: [
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GetHistoryResponseModel';
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
      };
    };
    '/v1/history/{history_item_id}/audio': {
      get: {
        tags: ['history'];
        summary: 'Get Audio From History Item';
        description: 'Returns the audio of an history item.';
        operationId: 'Get_audio_from_history_item_v1_history__history_item_id__audio_get';
        parameters: [
          {
            description: 'History item ID to be used, you can use GET https://api.elevenlabs.io/v1/history to receive a list of history items and their IDs.';
            required: true;
            schema: {
              title: 'History Item Id';
              type: 'string';
              description: 'History item ID to be used, you can use GET https://api.elevenlabs.io/v1/history to receive a list of history items and their IDs.';
            };
            example: 'VW7YKqPnjY4h39yTbx2L';
            name: 'history_item_id';
            in: 'path';
          },
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'audio/mpeg': {};
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
      };
    };
    '/v1/history/delete': {
      post: {
        tags: ['history'];
        summary: 'Delete History Items';
        description: 'Delete a number of history items by their IDs.';
        operationId: 'Delete_history_items_v1_history_delete_post';
        parameters: [
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Body_Delete_history_items_v1_history_delete_post';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {};
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
        deprecated: true;
      };
    };
    '/v1/history/{history_item_id}': {
      delete: {
        tags: ['history'];
        summary: 'Delete History Item';
        description: 'Delete a history item by its ID';
        operationId: 'Delete_history_item_v1_history__history_item_id__delete';
        parameters: [
          {
            description: 'History item ID to be used, you can use GET https://api.elevenlabs.io/v1/history to receive a list of history items and their IDs.';
            required: true;
            schema: {
              title: 'History Item Id';
              type: 'string';
              description: 'History item ID to be used, you can use GET https://api.elevenlabs.io/v1/history to receive a list of history items and their IDs.';
            };
            example: 'VW7YKqPnjY4h39yTbx2L';
            name: 'history_item_id';
            in: 'path';
          },
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {};
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
      };
    };
    '/v1/history/download': {
      post: {
        tags: ['history'];
        summary: 'Download History Items';
        description: 'Download one or more history items. If one history item ID is provided, we will return a single audio file. If more than one history item IDs are provided, we will provide the history items packed into a .zip file.';
        operationId: 'Download_history_items_v1_history_download_post';
        parameters: [
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Body_Download_history_items_v1_history_download_post';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            description: 'Successful Response';
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
      };
    };
    '/v1/voices/{voice_id}/samples/{sample_id}': {
      delete: {
        tags: ['samples'];
        summary: 'Delete Sample';
        description: 'Removes a sample by its ID.';
        operationId: 'Delete_sample_v1_voices__voice_id__samples__sample_id__delete';
        parameters: [
          {
            description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            required: true;
            schema: {
              title: 'Voice Id';
              type: 'string';
              description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            };
            example: '21m00Tcm4TlvDq8ikWAM';
            name: 'voice_id';
            in: 'path';
          },
          {
            description: 'Sample ID to be used, you can use GET https://api.elevenlabs.io/v1/voices/{voice_id} to list all the available samples for a voice.';
            required: true;
            schema: {
              title: 'Sample Id';
              type: 'string';
              description: 'Sample ID to be used, you can use GET https://api.elevenlabs.io/v1/voices/{voice_id} to list all the available samples for a voice.';
            };
            example: 'VW7YKqPnjY4h39yTbx2L';
            name: 'sample_id';
            in: 'path';
          },
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {};
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
      };
    };
    '/v1/voices/{voice_id}/samples/{sample_id}/audio': {
      get: {
        tags: ['samples'];
        summary: 'Get Audio From Sample';
        description: 'Returns the audio corresponding to a sample attached to a voice.';
        operationId: 'Get_audio_from_sample_v1_voices__voice_id__samples__sample_id__audio_get';
        parameters: [
          {
            description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            required: true;
            schema: {
              title: 'Voice Id';
              type: 'string';
              description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            };
            example: '21m00Tcm4TlvDq8ikWAM';
            name: 'voice_id';
            in: 'path';
          },
          {
            description: 'Sample ID to be used, you can use GET https://api.elevenlabs.io/v1/voices/{voice_id} to list all the available samples for a voice.';
            required: true;
            schema: {
              title: 'Sample Id';
              type: 'string';
              description: 'Sample ID to be used, you can use GET https://api.elevenlabs.io/v1/voices/{voice_id} to list all the available samples for a voice.';
            };
            example: 'VW7YKqPnjY4h39yTbx2L';
            name: 'sample_id';
            in: 'path';
          },
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'audio/*': {};
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
      };
    };
    '/v1/voices/{voice_id}/professional-samples/{sample_id}/audio': {
      get: {
        tags: ['samples'];
        summary: 'Get Audio From Sample';
        description: 'Returns the audio corresponding to a professional sample attached to a voice.';
        operationId: 'Get_audio_from_sample_v1_voices__voice_id__professional_samples__sample_id__audio_get';
        parameters: [
          {
            description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            required: true;
            schema: {
              title: 'Voice Id';
              type: 'string';
              description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            };
            example: '21m00Tcm4TlvDq8ikWAM';
            name: 'voice_id';
            in: 'path';
          },
          {
            description: 'Sample ID to be used, you can use GET https://api.elevenlabs.io/v1/voices/{voice_id} to list all the available samples for a voice.';
            required: true;
            schema: {
              title: 'Sample Id';
              type: 'string';
              description: 'Sample ID to be used, you can use GET https://api.elevenlabs.io/v1/voices/{voice_id} to list all the available samples for a voice.';
            };
            example: 'VW7YKqPnjY4h39yTbx2L';
            name: 'sample_id';
            in: 'path';
          },
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'audio/*': {};
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
      };
    };
    '/v1/text-to-speech/{voice_id}': {
      post: {
        tags: ['text-to-speech'];
        summary: 'Text To Speech';
        description: 'Converts text into speech using a voice of your choice and returns audio.';
        operationId: 'Text_to_speech_v1_text_to_speech__voice_id__post';
        parameters: [
          {
            description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            required: true;
            schema: {
              title: 'Voice Id';
              type: 'string';
              description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            };
            example: '21m00Tcm4TlvDq8ikWAM';
            name: 'voice_id';
            in: 'path';
          },
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Body_Text_to_speech_v1_text_to_speech__voice_id__post';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'audio/mpeg': {};
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
      };
    };
    '/v1/text-to-speech/{voice_id}/stream': {
      post: {
        tags: ['text-to-speech'];
        summary: 'Text To Speech';
        description: 'Converts text into speech using a voice of your choice and returns audio as an audio stream.';
        operationId: 'Text_to_speech_v1_text_to_speech__voice_id__stream_post';
        parameters: [
          {
            description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            required: true;
            schema: {
              title: 'Voice Id';
              type: 'string';
              description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            };
            example: '21m00Tcm4TlvDq8ikWAM';
            name: 'voice_id';
            in: 'path';
          },
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Body_Text_to_speech_v1_text_to_speech__voice_id__stream_post';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            description: 'Successful Response';
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
      };
    };
    '/v1/user/subscription': {
      get: {
        tags: ['user'];
        summary: 'Get User Subscription Info';
        description: 'Gets extended information about the users subscription';
        operationId: 'Get_user_subscription_info_v1_user_subscription_get';
        parameters: [
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ExtendedSubscriptionResponseModel';
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
      };
    };
    '/v1/user': {
      get: {
        tags: ['user'];
        summary: 'Get User Info';
        description: 'Gets information about the user';
        operationId: 'Get_user_info_v1_user_get';
        parameters: [
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserResponseModel';
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
      };
    };
    '/v1/voices': {
      get: {
        tags: ['voices'];
        summary: 'Get Voices';
        description: 'Gets a list of all available voices for a user.';
        operationId: 'Get_voices_v1_voices_get';
        parameters: [
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GetVoicesResponseModel';
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
      };
    };
    '/v1/voices/settings/default': {
      get: {
        tags: ['voices'];
        summary: 'Get Default Voice Settings';
        description: 'Gets the default settings for voices.';
        operationId: 'Get_default_voice_settings_v1_voices_settings_default_get';
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/VoiceSettingsResponseModel';
                };
              };
            };
          };
        };
      };
    };
    '/v1/voices/{voice_id}/settings': {
      get: {
        tags: ['voices'];
        summary: 'Get Voice Settings';
        description: 'Returns the settings for a specific voice.';
        operationId: 'Get_voice_settings_v1_voices__voice_id__settings_get';
        parameters: [
          {
            description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            required: true;
            schema: {
              title: 'Voice Id';
              type: 'string';
              description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            };
            example: '21m00Tcm4TlvDq8ikWAM';
            name: 'voice_id';
            in: 'path';
          },
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/VoiceSettingsResponseModel';
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
      };
    };
    '/v1/voices/{voice_id}': {
      get: {
        tags: ['voices'];
        summary: 'Get Voice';
        description: 'Returns metadata about a specific voice.';
        operationId: 'Get_voice_v1_voices__voice_id__get';
        parameters: [
          {
            description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            required: true;
            schema: {
              title: 'Voice Id';
              type: 'string';
              description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            };
            example: '21m00Tcm4TlvDq8ikWAM';
            name: 'voice_id';
            in: 'path';
          },
          {
            description: 'If set will return settings information corresponding to the voice, requires authorization.';
            required: false;
            schema: {
              title: 'With Settings';
              type: 'boolean';
              description: 'If set will return settings information corresponding to the voice, requires authorization.';
              default: false;
            };
            name: 'with_settings';
            in: 'query';
          },
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/VoiceResponseModel';
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
      };
      delete: {
        tags: ['voices'];
        summary: 'Delete Voice';
        description: 'Deletes a voice by its ID.';
        operationId: 'Delete_voice_v1_voices__voice_id__delete';
        parameters: [
          {
            description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            required: true;
            schema: {
              title: 'Voice Id';
              type: 'string';
              description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            };
            example: '21m00Tcm4TlvDq8ikWAM';
            name: 'voice_id';
            in: 'path';
          },
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {};
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
      };
    };
    '/v1/voices/{voice_id}/settings/edit': {
      post: {
        tags: ['voices'];
        summary: 'Edit Voice Settings';
        description: 'Edit your settings for a specific voice.';
        operationId: 'Edit_voice_settings_v1_voices__voice_id__settings_edit_post';
        parameters: [
          {
            description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            required: true;
            schema: {
              title: 'Voice Id';
              type: 'string';
              description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            };
            example: '21m00Tcm4TlvDq8ikWAM';
            name: 'voice_id';
            in: 'path';
          },
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        requestBody: {
          content: {
            'application/json': {
              schema: {
                title: 'Settings';
                allOf: [
                  {
                    $ref: '#/components/schemas/VoiceSettingsResponseModel';
                  },
                ];
                description: 'The settings for a specific voice.';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {};
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
      };
    };
    '/v1/voices/add': {
      post: {
        tags: ['voices'];
        summary: 'Add Voice';
        description: 'Add a new voice to your collection of voices in VoiceLab.';
        operationId: 'Add_voice_v1_voices_add_post';
        parameters: [
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                $ref: '#/components/schemas/Body_Add_voice_v1_voices_add_post';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AddVoiceResponseModel';
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
      };
    };
    '/v1/voices/{voice_id}/edit': {
      post: {
        tags: ['voices'];
        summary: 'Edit Voice';
        description: 'Edit a voice created by you.';
        operationId: 'Edit_voice_v1_voices__voice_id__edit_post';
        parameters: [
          {
            description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            required: true;
            schema: {
              title: 'Voice Id';
              type: 'string';
              description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            };
            example: '21m00Tcm4TlvDq8ikWAM';
            name: 'voice_id';
            in: 'path';
          },
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                $ref: '#/components/schemas/Body_Edit_voice_v1_voices__voice_id__edit_post';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {};
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
      };
    };
    '/v1/voices/add-professional': {
      post: {
        tags: ['voices'];
        summary: 'Add Professional Voice';
        description: 'Adds a new professional voice to your VoiceLab.';
        operationId: 'Add_professional_voice_v1_voices_add_professional_post';
        parameters: [
          {
            description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            required: false;
            schema: {
              title: 'Xi-Api-Key';
              type: 'string';
              description: "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.";
            };
            name: 'xi-api-key';
            in: 'header';
          },
        ];
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                $ref: '#/components/schemas/Body_Add_professional_voice_v1_voices_add_professional_post';
              };
            };
          };
          required: true;
        };
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AddVoiceResponseModel';
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
      };
    };
    '/v1/voices/{voice_id}/start-fine-tuning': {
      post: {
        tags: ['voices'];
        summary: 'Start Fine Tuning';
        description: 'Kicks fine tuning process for the voice off.';
        operationId: 'Start_fine_tuning_v1_voices__voice_id__start_fine_tuning_post';
        parameters: [
          {
            description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            required: true;
            schema: {
              title: 'Voice Id';
              type: 'string';
              description: 'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.';
            };
            example: '21m00Tcm4TlvDq8ikWAM';
            name: 'voice_id';
            in: 'path';
          },
        ];
        responses: {
          '200': {
            description: 'Successful Response';
            content: {
              'application/json': {
                schema: {};
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
      };
    };
  };
  components: {
    schemas: {
      AddVoiceResponseModel: {
        title: 'AddVoiceResponseModel';
        required: ['voice_id'];
        type: 'object';
        properties: {
          voice_id: {
            title: 'Voice Id';
            type: 'string';
          };
        };
      };
      Body_Add_professional_voice_v1_voices_add_professional_post: {
        title: 'Body_Add_professional_voice_v1_voices_add_professional_post';
        required: ['name', 'files'];
        type: 'object';
        properties: {
          name: {
            title: 'Name';
            type: 'string';
            description: 'The name that identifies this voice. This will be displayed in the dropdown of the website.';
          };
          files: {
            title: 'Files';
            type: 'array';
            items: {
              type: 'string';
              format: 'binary';
            };
            description: 'Sufficient amount of audio files to fine tune the voice from';
          };
          labels: {
            title: 'Labels';
            type: 'string';
            description: 'Serialized labels dictionary for the voice.';
          };
        };
      };
      Body_Add_voice_v1_voices_add_post: {
        title: 'Body_Add_voice_v1_voices_add_post';
        required: ['name', 'files'];
        type: 'object';
        properties: {
          name: {
            title: 'Name';
            type: 'string';
            description: 'The name that identifies this voice. This will be displayed in the dropdown of the website.';
          };
          files: {
            title: 'Files';
            type: 'array';
            items: {
              type: 'string';
              format: 'binary';
            };
            description: 'One or more audio files to clone the voice from';
          };
          labels: {
            title: 'Labels';
            type: 'string';
            description: 'Serialized labels dictionary for the voice.';
          };
        };
      };
      Body_Delete_history_items_v1_history_delete_post: {
        title: 'Body_Delete_history_items_v1_history_delete_post';
        required: ['history_item_ids'];
        type: 'object';
        properties: {
          history_item_ids: {
            title: 'History Item Ids';
            type: 'array';
            items: {
              type: 'string';
            };
            description: 'A list of history items to remove, you can get IDs of history items and other metadata using the GET https://api.elevenlabs.io/v1/history endpoint.';
            name: 'History item IDs';
          };
        };
      };
      Body_Download_history_items_v1_history_download_post: {
        title: 'Body_Download_history_items_v1_history_download_post';
        required: ['history_item_ids'];
        type: 'object';
        properties: {
          history_item_ids: {
            title: 'History Item Ids';
            type: 'array';
            items: {
              type: 'string';
            };
            description: 'A list of history items to download, you can get IDs of history items and other metadata using the GET https://api.elevenlabs.io/v1/history endpoint.';
            name: 'History item IDs';
          };
        };
      };
      Body_Edit_voice_v1_voices__voice_id__edit_post: {
        title: 'Body_Edit_voice_v1_voices__voice_id__edit_post';
        required: ['name'];
        type: 'object';
        properties: {
          name: {
            title: 'Name';
            type: 'string';
            description: 'The name that identifies this voice. This will be displayed in the dropdown of the website.';
          };
          files: {
            title: 'Files';
            type: 'array';
            items: {
              type: 'string';
              format: 'binary';
            };
            description: 'Audio files to add to the voice';
          };
          labels: {
            title: 'Labels';
            type: 'string';
            description: 'Serialized labels dictionary for the voice.';
          };
        };
      };
      Body_Text_to_speech_v1_text_to_speech__voice_id__post: {
        title: 'Body_Text_to_speech_v1_text_to_speech__voice_id__post';
        required: ['text'];
        type: 'object';
        properties: {
          text: {
            title: 'Text';
            type: 'string';
            description: 'The text that will get converted into speech. Currently only English text is supported.';
            name: 'Text to convert';
          };
          voice_settings: {
            title: 'Voice Settings';
            allOf: [
              {
                $ref: '#/components/schemas/VoiceSettingsResponseModel';
              },
            ];
            description: 'Voice settings overriding stored setttings for the given voice. They are applied only on the given TTS request.';
          };
        };
      };
      Body_Text_to_speech_v1_text_to_speech__voice_id__stream_post: {
        title: 'Body_Text_to_speech_v1_text_to_speech__voice_id__stream_post';
        required: ['text'];
        type: 'object';
        properties: {
          text: {
            title: 'Text';
            type: 'string';
            description: 'The text that will get converted into speech. Currently only English text is supported.';
            name: 'Text to convert';
          };
          voice_settings: {
            title: 'Voice Settings';
            allOf: [
              {
                $ref: '#/components/schemas/VoiceSettingsResponseModel';
              },
            ];
            description: 'Voice settings overriding stored setttings for the given voice. They are applied only on the given TTS request.';
          };
        };
      };
      ExtendedSubscriptionResponseModel: {
        title: 'ExtendedSubscriptionResponseModel';
        required: [
          'tier',
          'character_count',
          'character_limit',
          'can_extend_character_limit',
          'allowed_to_extend_character_limit',
          'next_character_count_reset_unix',
          'voice_limit',
          'can_extend_voice_limit',
          'can_use_instant_voice_cloning',
          'available_models',
          'status',
          'next_invoice',
        ];
        type: 'object';
        properties: {
          tier: {
            title: 'Tier';
            type: 'string';
          };
          character_count: {
            title: 'Character Count';
            type: 'integer';
          };
          character_limit: {
            title: 'Character Limit';
            type: 'integer';
          };
          can_extend_character_limit: {
            title: 'Can Extend Character Limit';
            type: 'boolean';
          };
          allowed_to_extend_character_limit: {
            title: 'Allowed To Extend Character Limit';
            type: 'boolean';
          };
          next_character_count_reset_unix: {
            title: 'Next Character Count Reset Unix';
            type: 'integer';
          };
          voice_limit: {
            title: 'Voice Limit';
            type: 'integer';
          };
          can_extend_voice_limit: {
            title: 'Can Extend Voice Limit';
            type: 'boolean';
          };
          can_use_instant_voice_cloning: {
            title: 'Can Use Instant Voice Cloning';
            type: 'boolean';
          };
          available_models: {
            title: 'Available Models';
            type: 'array';
            items: {
              $ref: '#/components/schemas/TTSModelResponseModel';
            };
          };
          status: {
            title: 'Status';
            enum: ['trialing', 'active', 'incomplete', 'incomplete_expired', 'past_due', 'canceled', 'unpaid', 'free'];
            type: 'string';
          };
          next_invoice: {
            $ref: '#/components/schemas/InvoiceResponseModel';
          };
        };
      };
      FineTuningResponseModel: {
        title: 'FineTuningResponseModel';
        required: [
          'is_allowed_to_fine_tune',
          'fine_tuning_requested',
          'finetuning_state',
          'verification_attempts',
          'verification_attempts_count',
        ];
        type: 'object';
        properties: {
          is_allowed_to_fine_tune: {
            title: 'Is Allowed To Fine Tune';
            type: 'boolean';
          };
          fine_tuning_requested: {
            title: 'Fine Tuning Requested';
            type: 'boolean';
          };
          finetuning_state: {
            title: 'Finetuning State';
            enum: ['not_started', 'is_fine_tuning', 'fine_tuned'];
            type: 'string';
          };
          verification_attempts: {
            title: 'Verification Attempts';
            type: 'array';
            items: {
              $ref: '#/components/schemas/VerificationAttemptResponseModel';
            };
          };
          verification_attempts_count: {
            title: 'Verification Attempts Count';
            type: 'integer';
          };
        };
      };
      GetHistoryResponseModel: {
        title: 'GetHistoryResponseModel';
        required: ['history'];
        type: 'object';
        properties: {
          history: {
            title: 'History';
            type: 'array';
            items: {
              $ref: '#/components/schemas/HistoryItemResponseModel';
            };
          };
        };
      };
      GetVoicesResponseModel: {
        title: 'GetVoicesResponseModel';
        required: ['voices'];
        type: 'object';
        properties: {
          voices: {
            title: 'Voices';
            type: 'array';
            items: {
              $ref: '#/components/schemas/VoiceResponseModel';
            };
          };
        };
      };
      HTTPValidationError: {
        title: 'HTTPValidationError';
        type: 'object';
        properties: {
          detail: {
            title: 'Detail';
            type: 'array';
            items: {
              $ref: '#/components/schemas/ValidationError';
            };
          };
        };
      };
      HistoryItemResponseModel: {
        title: 'HistoryItemResponseModel';
        required: [
          'history_item_id',
          'voice_id',
          'voice_name',
          'text',
          'date_unix',
          'character_count_change_from',
          'character_count_change_to',
          'content_type',
          'state',
          'settings',
        ];
        type: 'object';
        properties: {
          history_item_id: {
            title: 'History Item Id';
            type: 'string';
          };
          voice_id: {
            title: 'Voice Id';
            type: 'string';
          };
          voice_name: {
            title: 'Voice Name';
            type: 'string';
          };
          text: {
            title: 'Text';
            type: 'string';
          };
          date_unix: {
            title: 'Date Unix';
            type: 'integer';
          };
          character_count_change_from: {
            title: 'Character Count Change From';
            type: 'integer';
          };
          character_count_change_to: {
            title: 'Character Count Change To';
            type: 'integer';
          };
          content_type: {
            title: 'Content Type';
            type: 'string';
          };
          state: {
            title: 'State';
            enum: ['created', 'deleted', 'processing'];
            type: 'string';
          };
          settings: {
            title: 'Settings';
            type: 'object';
          };
        };
      };
      InvoiceResponseModel: {
        title: 'InvoiceResponseModel';
        required: ['amount_due_cents', 'next_payment_attempt_unix'];
        type: 'object';
        properties: {
          amount_due_cents: {
            title: 'Amount Due Cents';
            type: 'integer';
          };
          next_payment_attempt_unix: {
            title: 'Next Payment Attempt Unix';
            type: 'integer';
          };
        };
      };
      LanguageResponseModel: {
        title: 'LanguageResponseModel';
        required: ['iso_code', 'display_name'];
        type: 'object';
        properties: {
          iso_code: {
            title: 'Iso Code';
            type: 'string';
          };
          display_name: {
            title: 'Display Name';
            type: 'string';
          };
        };
      };
      RecordingResponseModel: {
        title: 'RecordingResponseModel';
        required: ['recording_id', 'mime_type', 'size_bytes', 'upload_date_unix', 'transcription'];
        type: 'object';
        properties: {
          recording_id: {
            title: 'Recording Id';
            type: 'string';
          };
          mime_type: {
            title: 'Mime Type';
            type: 'string';
          };
          size_bytes: {
            title: 'Size Bytes';
            type: 'integer';
          };
          upload_date_unix: {
            title: 'Upload Date Unix';
            type: 'integer';
          };
          transcription: {
            title: 'Transcription';
            type: 'string';
          };
        };
      };
      SampleResponseModel: {
        title: 'SampleResponseModel';
        required: ['sample_id', 'file_name', 'mime_type', 'size_bytes', 'hash'];
        type: 'object';
        properties: {
          sample_id: {
            title: 'Sample Id';
            type: 'string';
          };
          file_name: {
            title: 'File Name';
            type: 'string';
          };
          mime_type: {
            title: 'Mime Type';
            type: 'string';
          };
          size_bytes: {
            title: 'Size Bytes';
            type: 'integer';
          };
          hash: {
            title: 'Hash';
            type: 'string';
          };
        };
      };
      SubscriptionResponseModel: {
        title: 'SubscriptionResponseModel';
        required: [
          'tier',
          'character_count',
          'character_limit',
          'can_extend_character_limit',
          'allowed_to_extend_character_limit',
          'next_character_count_reset_unix',
          'voice_limit',
          'can_extend_voice_limit',
          'can_use_instant_voice_cloning',
          'available_models',
          'status',
        ];
        type: 'object';
        properties: {
          tier: {
            title: 'Tier';
            type: 'string';
          };
          character_count: {
            title: 'Character Count';
            type: 'integer';
          };
          character_limit: {
            title: 'Character Limit';
            type: 'integer';
          };
          can_extend_character_limit: {
            title: 'Can Extend Character Limit';
            type: 'boolean';
          };
          allowed_to_extend_character_limit: {
            title: 'Allowed To Extend Character Limit';
            type: 'boolean';
          };
          next_character_count_reset_unix: {
            title: 'Next Character Count Reset Unix';
            type: 'integer';
          };
          voice_limit: {
            title: 'Voice Limit';
            type: 'integer';
          };
          can_extend_voice_limit: {
            title: 'Can Extend Voice Limit';
            type: 'boolean';
          };
          can_use_instant_voice_cloning: {
            title: 'Can Use Instant Voice Cloning';
            type: 'boolean';
          };
          available_models: {
            title: 'Available Models';
            type: 'array';
            items: {
              $ref: '#/components/schemas/TTSModelResponseModel';
            };
          };
          status: {
            title: 'Status';
            enum: ['trialing', 'active', 'incomplete', 'incomplete_expired', 'past_due', 'canceled', 'unpaid', 'free'];
            type: 'string';
          };
        };
      };
      TTSModelResponseModel: {
        title: 'TTSModelResponseModel';
        required: ['model_id', 'display_name', 'supported_languages'];
        type: 'object';
        properties: {
          model_id: {
            title: 'Model Id';
            type: 'string';
          };
          display_name: {
            title: 'Display Name';
            type: 'string';
          };
          supported_languages: {
            title: 'Supported Languages';
            type: 'array';
            items: {
              $ref: '#/components/schemas/LanguageResponseModel';
            };
          };
        };
      };
      UserResponseModel: {
        title: 'UserResponseModel';
        required: ['subscription', 'is_new_user', 'xi_api_key'];
        type: 'object';
        properties: {
          subscription: {
            $ref: '#/components/schemas/SubscriptionResponseModel';
          };
          is_new_user: {
            title: 'Is New User';
            type: 'boolean';
          };
          xi_api_key: {
            title: 'Xi Api Key';
            type: 'string';
          };
        };
      };
      ValidationError: {
        title: 'ValidationError';
        required: ['loc', 'msg', 'type'];
        type: 'object';
        properties: {
          loc: {
            title: 'Location';
            type: 'array';
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
          };
          msg: {
            title: 'Message';
            type: 'string';
          };
          type: {
            title: 'Error Type';
            type: 'string';
          };
        };
      };
      VerificationAttemptResponseModel: {
        title: 'VerificationAttemptResponseModel';
        required: ['text', 'date_unix', 'accepted', 'similarity', 'recording'];
        type: 'object';
        properties: {
          text: {
            title: 'Text';
            type: 'string';
          };
          date_unix: {
            title: 'Date Unix';
            type: 'integer';
          };
          accepted: {
            title: 'Accepted';
            type: 'boolean';
          };
          similarity: {
            title: 'Similarity';
            type: 'number';
          };
          recording: {
            $ref: '#/components/schemas/RecordingResponseModel';
          };
        };
      };
      VoiceResponseModel: {
        title: 'VoiceResponseModel';
        required: [
          'voice_id',
          'name',
          'samples',
          'category',
          'fine_tuning',
          'labels',
          'preview_url',
          'available_for_tiers',
          'settings',
        ];
        type: 'object';
        properties: {
          voice_id: {
            title: 'Voice Id';
            type: 'string';
          };
          name: {
            title: 'Name';
            type: 'string';
          };
          samples: {
            title: 'Samples';
            type: 'array';
            items: {
              $ref: '#/components/schemas/SampleResponseModel';
            };
          };
          category: {
            title: 'Category';
            type: 'string';
          };
          fine_tuning: {
            $ref: '#/components/schemas/FineTuningResponseModel';
          };
          labels: {
            title: 'Labels';
            type: 'object';
            additionalProperties: {
              type: 'string';
            };
          };
          preview_url: {
            title: 'Preview Url';
            type: 'string';
          };
          available_for_tiers: {
            title: 'Available For Tiers';
            type: 'array';
            items: {
              type: 'string';
            };
          };
          settings: {
            $ref: '#/components/schemas/VoiceSettingsResponseModel';
          };
        };
      };
      VoiceSettingsResponseModel: {
        title: 'VoiceSettingsResponseModel';
        required: ['stability', 'similarity_boost'];
        type: 'object';
        properties: {
          stability: {
            title: 'Stability';
            type: 'number';
          };
          similarity_boost: {
            title: 'Similarity Boost';
            type: 'number';
          };
        };
      };
    };
  };
};
