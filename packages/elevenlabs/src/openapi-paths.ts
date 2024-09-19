// @ts-nocheck
export type TPaths = {
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
export const paths = {
  '/v1/history': {
    get: {
      tags: ['history'],
      summary: 'Get Generated Items',
      description: 'Returns metadata about all your generated audio.',
      operationId: 'Get_generated_items_v1_history_get',
      parameters: [
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GetHistoryResponseModel',
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
    },
  },
  '/v1/history/{history_item_id}/audio': {
    get: {
      tags: ['history'],
      summary: 'Get Audio From History Item',
      description: 'Returns the audio of an history item.',
      operationId: 'Get_audio_from_history_item_v1_history__history_item_id__audio_get',
      parameters: [
        {
          description:
            'History item ID to be used, you can use GET https://api.elevenlabs.io/v1/history to receive a list of history items and their IDs.',
          required: true,
          schema: {
            title: 'History Item Id',
            type: 'string',
            description:
              'History item ID to be used, you can use GET https://api.elevenlabs.io/v1/history to receive a list of history items and their IDs.',
          },
          example: 'VW7YKqPnjY4h39yTbx2L',
          name: 'history_item_id',
          in: 'path',
        },
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'audio/mpeg': {},
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
    },
  },
  '/v1/history/delete': {
    post: {
      tags: ['history'],
      summary: 'Delete History Items',
      description: 'Delete a number of history items by their IDs.',
      operationId: 'Delete_history_items_v1_history_delete_post',
      parameters: [
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Body_Delete_history_items_v1_history_delete_post',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {},
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
      deprecated: true,
    },
  },
  '/v1/history/{history_item_id}': {
    delete: {
      tags: ['history'],
      summary: 'Delete History Item',
      description: 'Delete a history item by its ID',
      operationId: 'Delete_history_item_v1_history__history_item_id__delete',
      parameters: [
        {
          description:
            'History item ID to be used, you can use GET https://api.elevenlabs.io/v1/history to receive a list of history items and their IDs.',
          required: true,
          schema: {
            title: 'History Item Id',
            type: 'string',
            description:
              'History item ID to be used, you can use GET https://api.elevenlabs.io/v1/history to receive a list of history items and their IDs.',
          },
          example: 'VW7YKqPnjY4h39yTbx2L',
          name: 'history_item_id',
          in: 'path',
        },
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {},
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
    },
  },
  '/v1/history/download': {
    post: {
      tags: ['history'],
      summary: 'Download History Items',
      description:
        'Download one or more history items. If one history item ID is provided, we will return a single audio file. If more than one history item IDs are provided, we will provide the history items packed into a .zip file.',
      operationId: 'Download_history_items_v1_history_download_post',
      parameters: [
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Body_Download_history_items_v1_history_download_post',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: 'Successful Response',
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
    },
  },
  '/v1/voices/{voice_id}/samples/{sample_id}': {
    delete: {
      tags: ['samples'],
      summary: 'Delete Sample',
      description: 'Removes a sample by its ID.',
      operationId: 'Delete_sample_v1_voices__voice_id__samples__sample_id__delete',
      parameters: [
        {
          description:
            'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          required: true,
          schema: {
            title: 'Voice Id',
            type: 'string',
            description:
              'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          },
          example: '21m00Tcm4TlvDq8ikWAM',
          name: 'voice_id',
          in: 'path',
        },
        {
          description:
            'Sample ID to be used, you can use GET https://api.elevenlabs.io/v1/voices/{voice_id} to list all the available samples for a voice.',
          required: true,
          schema: {
            title: 'Sample Id',
            type: 'string',
            description:
              'Sample ID to be used, you can use GET https://api.elevenlabs.io/v1/voices/{voice_id} to list all the available samples for a voice.',
          },
          example: 'VW7YKqPnjY4h39yTbx2L',
          name: 'sample_id',
          in: 'path',
        },
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {},
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
    },
  },
  '/v1/voices/{voice_id}/samples/{sample_id}/audio': {
    get: {
      tags: ['samples'],
      summary: 'Get Audio From Sample',
      description: 'Returns the audio corresponding to a sample attached to a voice.',
      operationId: 'Get_audio_from_sample_v1_voices__voice_id__samples__sample_id__audio_get',
      parameters: [
        {
          description:
            'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          required: true,
          schema: {
            title: 'Voice Id',
            type: 'string',
            description:
              'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          },
          example: '21m00Tcm4TlvDq8ikWAM',
          name: 'voice_id',
          in: 'path',
        },
        {
          description:
            'Sample ID to be used, you can use GET https://api.elevenlabs.io/v1/voices/{voice_id} to list all the available samples for a voice.',
          required: true,
          schema: {
            title: 'Sample Id',
            type: 'string',
            description:
              'Sample ID to be used, you can use GET https://api.elevenlabs.io/v1/voices/{voice_id} to list all the available samples for a voice.',
          },
          example: 'VW7YKqPnjY4h39yTbx2L',
          name: 'sample_id',
          in: 'path',
        },
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'audio/*': {},
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
    },
  },
  '/v1/voices/{voice_id}/professional-samples/{sample_id}/audio': {
    get: {
      tags: ['samples'],
      summary: 'Get Audio From Sample',
      description: 'Returns the audio corresponding to a professional sample attached to a voice.',
      operationId: 'Get_audio_from_sample_v1_voices__voice_id__professional_samples__sample_id__audio_get',
      parameters: [
        {
          description:
            'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          required: true,
          schema: {
            title: 'Voice Id',
            type: 'string',
            description:
              'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          },
          example: '21m00Tcm4TlvDq8ikWAM',
          name: 'voice_id',
          in: 'path',
        },
        {
          description:
            'Sample ID to be used, you can use GET https://api.elevenlabs.io/v1/voices/{voice_id} to list all the available samples for a voice.',
          required: true,
          schema: {
            title: 'Sample Id',
            type: 'string',
            description:
              'Sample ID to be used, you can use GET https://api.elevenlabs.io/v1/voices/{voice_id} to list all the available samples for a voice.',
          },
          example: 'VW7YKqPnjY4h39yTbx2L',
          name: 'sample_id',
          in: 'path',
        },
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'audio/*': {},
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
    },
  },
  '/v1/text-to-speech/{voice_id}': {
    post: {
      tags: ['text-to-speech'],
      summary: 'Text To Speech',
      description: 'Converts text into speech using a voice of your choice and returns audio.',
      operationId: 'Text_to_speech_v1_text_to_speech__voice_id__post',
      parameters: [
        {
          description:
            'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          required: true,
          schema: {
            title: 'Voice Id',
            type: 'string',
            description:
              'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          },
          example: '21m00Tcm4TlvDq8ikWAM',
          name: 'voice_id',
          in: 'path',
        },
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Body_Text_to_speech_v1_text_to_speech__voice_id__post',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'audio/mpeg': {},
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
    },
  },
  '/v1/text-to-speech/{voice_id}/stream': {
    post: {
      tags: ['text-to-speech'],
      summary: 'Text To Speech',
      description: 'Converts text into speech using a voice of your choice and returns audio as an audio stream.',
      operationId: 'Text_to_speech_v1_text_to_speech__voice_id__stream_post',
      parameters: [
        {
          description:
            'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          required: true,
          schema: {
            title: 'Voice Id',
            type: 'string',
            description:
              'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          },
          example: '21m00Tcm4TlvDq8ikWAM',
          name: 'voice_id',
          in: 'path',
        },
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Body_Text_to_speech_v1_text_to_speech__voice_id__stream_post',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: 'Successful Response',
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
    },
  },
  '/v1/user/subscription': {
    get: {
      tags: ['user'],
      summary: 'Get User Subscription Info',
      description: 'Gets extended information about the users subscription',
      operationId: 'Get_user_subscription_info_v1_user_subscription_get',
      parameters: [
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ExtendedSubscriptionResponseModel',
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
    },
  },
  '/v1/user': {
    get: {
      tags: ['user'],
      summary: 'Get User Info',
      description: 'Gets information about the user',
      operationId: 'Get_user_info_v1_user_get',
      parameters: [
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UserResponseModel',
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
    },
  },
  '/v1/voices': {
    get: {
      tags: ['voices'],
      summary: 'Get Voices',
      description: 'Gets a list of all available voices for a user.',
      operationId: 'Get_voices_v1_voices_get',
      parameters: [
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GetVoicesResponseModel',
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
    },
  },
  '/v1/voices/settings/default': {
    get: {
      tags: ['voices'],
      summary: 'Get Default Voice Settings',
      description: 'Gets the default settings for voices.',
      operationId: 'Get_default_voice_settings_v1_voices_settings_default_get',
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/VoiceSettingsResponseModel',
              },
            },
          },
        },
      },
    },
  },
  '/v1/voices/{voice_id}/settings': {
    get: {
      tags: ['voices'],
      summary: 'Get Voice Settings',
      description: 'Returns the settings for a specific voice.',
      operationId: 'Get_voice_settings_v1_voices__voice_id__settings_get',
      parameters: [
        {
          description:
            'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          required: true,
          schema: {
            title: 'Voice Id',
            type: 'string',
            description:
              'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          },
          example: '21m00Tcm4TlvDq8ikWAM',
          name: 'voice_id',
          in: 'path',
        },
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/VoiceSettingsResponseModel',
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
    },
  },
  '/v1/voices/{voice_id}': {
    get: {
      tags: ['voices'],
      summary: 'Get Voice',
      description: 'Returns metadata about a specific voice.',
      operationId: 'Get_voice_v1_voices__voice_id__get',
      parameters: [
        {
          description:
            'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          required: true,
          schema: {
            title: 'Voice Id',
            type: 'string',
            description:
              'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          },
          example: '21m00Tcm4TlvDq8ikWAM',
          name: 'voice_id',
          in: 'path',
        },
        {
          description: 'If set will return settings information corresponding to the voice, requires authorization.',
          required: false,
          schema: {
            title: 'With Settings',
            type: 'boolean',
            description: 'If set will return settings information corresponding to the voice, requires authorization.',
            default: false,
          },
          name: 'with_settings',
          in: 'query',
        },
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/VoiceResponseModel',
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
    },
    delete: {
      tags: ['voices'],
      summary: 'Delete Voice',
      description: 'Deletes a voice by its ID.',
      operationId: 'Delete_voice_v1_voices__voice_id__delete',
      parameters: [
        {
          description:
            'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          required: true,
          schema: {
            title: 'Voice Id',
            type: 'string',
            description:
              'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          },
          example: '21m00Tcm4TlvDq8ikWAM',
          name: 'voice_id',
          in: 'path',
        },
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {},
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
    },
  },
  '/v1/voices/{voice_id}/settings/edit': {
    post: {
      tags: ['voices'],
      summary: 'Edit Voice Settings',
      description: 'Edit your settings for a specific voice.',
      operationId: 'Edit_voice_settings_v1_voices__voice_id__settings_edit_post',
      parameters: [
        {
          description:
            'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          required: true,
          schema: {
            title: 'Voice Id',
            type: 'string',
            description:
              'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          },
          example: '21m00Tcm4TlvDq8ikWAM',
          name: 'voice_id',
          in: 'path',
        },
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              title: 'Settings',
              allOf: [
                {
                  $ref: '#/components/schemas/VoiceSettingsResponseModel',
                },
              ],
              description: 'The settings for a specific voice.',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {},
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
    },
  },
  '/v1/voices/add': {
    post: {
      tags: ['voices'],
      summary: 'Add Voice',
      description: 'Add a new voice to your collection of voices in VoiceLab.',
      operationId: 'Add_voice_v1_voices_add_post',
      parameters: [
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/Body_Add_voice_v1_voices_add_post',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AddVoiceResponseModel',
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
    },
  },
  '/v1/voices/{voice_id}/edit': {
    post: {
      tags: ['voices'],
      summary: 'Edit Voice',
      description: 'Edit a voice created by you.',
      operationId: 'Edit_voice_v1_voices__voice_id__edit_post',
      parameters: [
        {
          description:
            'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          required: true,
          schema: {
            title: 'Voice Id',
            type: 'string',
            description:
              'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          },
          example: '21m00Tcm4TlvDq8ikWAM',
          name: 'voice_id',
          in: 'path',
        },
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/Body_Edit_voice_v1_voices__voice_id__edit_post',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {},
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
    },
  },
  '/v1/voices/add-professional': {
    post: {
      tags: ['voices'],
      summary: 'Add Professional Voice',
      description: 'Adds a new professional voice to your VoiceLab.',
      operationId: 'Add_professional_voice_v1_voices_add_professional_post',
      parameters: [
        {
          description:
            "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          required: false,
          schema: {
            title: 'Xi-Api-Key',
            type: 'string',
            description:
              "Your API key. This is required by most endpoints to access our API programatically. You can view your xi-api-key using the 'Profile' tab on the website.",
          },
          name: 'xi-api-key',
          in: 'header',
        },
      ],
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/Body_Add_professional_voice_v1_voices_add_professional_post',
            },
          },
        },
        required: true,
      },
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AddVoiceResponseModel',
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
    },
  },
  '/v1/voices/{voice_id}/start-fine-tuning': {
    post: {
      tags: ['voices'],
      summary: 'Start Fine Tuning',
      description: 'Kicks fine tuning process for the voice off.',
      operationId: 'Start_fine_tuning_v1_voices__voice_id__start_fine_tuning_post',
      parameters: [
        {
          description:
            'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          required: true,
          schema: {
            title: 'Voice Id',
            type: 'string',
            description:
              'Voice ID to be used, you can use https://api.elevenlabs.io/v1/voices to list all the available voices.',
          },
          example: '21m00Tcm4TlvDq8ikWAM',
          name: 'voice_id',
          in: 'path',
        },
      ],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {},
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
    },
  },
} as TPaths;
