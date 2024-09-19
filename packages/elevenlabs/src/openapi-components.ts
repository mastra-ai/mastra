// @ts-nocheck
export type TComponents = {
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
export const components = {
  schemas: {
    AddVoiceResponseModel: {
      title: 'AddVoiceResponseModel',
      required: ['voice_id'],
      type: 'object',
      properties: {
        voice_id: {
          title: 'Voice Id',
          type: 'string',
        },
      },
    },
    Body_Add_professional_voice_v1_voices_add_professional_post: {
      title: 'Body_Add_professional_voice_v1_voices_add_professional_post',
      required: ['name', 'files'],
      type: 'object',
      properties: {
        name: {
          title: 'Name',
          type: 'string',
          description: 'The name that identifies this voice. This will be displayed in the dropdown of the website.',
        },
        files: {
          title: 'Files',
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Sufficient amount of audio files to fine tune the voice from',
        },
        labels: {
          title: 'Labels',
          type: 'string',
          description: 'Serialized labels dictionary for the voice.',
        },
      },
    },
    Body_Add_voice_v1_voices_add_post: {
      title: 'Body_Add_voice_v1_voices_add_post',
      required: ['name', 'files'],
      type: 'object',
      properties: {
        name: {
          title: 'Name',
          type: 'string',
          description: 'The name that identifies this voice. This will be displayed in the dropdown of the website.',
        },
        files: {
          title: 'Files',
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'One or more audio files to clone the voice from',
        },
        labels: {
          title: 'Labels',
          type: 'string',
          description: 'Serialized labels dictionary for the voice.',
        },
      },
    },
    Body_Delete_history_items_v1_history_delete_post: {
      title: 'Body_Delete_history_items_v1_history_delete_post',
      required: ['history_item_ids'],
      type: 'object',
      properties: {
        history_item_ids: {
          title: 'History Item Ids',
          type: 'array',
          items: {
            type: 'string',
          },
          description:
            'A list of history items to remove, you can get IDs of history items and other metadata using the GET https://api.elevenlabs.io/v1/history endpoint.',
          name: 'History item IDs',
        },
      },
    },
    Body_Download_history_items_v1_history_download_post: {
      title: 'Body_Download_history_items_v1_history_download_post',
      required: ['history_item_ids'],
      type: 'object',
      properties: {
        history_item_ids: {
          title: 'History Item Ids',
          type: 'array',
          items: {
            type: 'string',
          },
          description:
            'A list of history items to download, you can get IDs of history items and other metadata using the GET https://api.elevenlabs.io/v1/history endpoint.',
          name: 'History item IDs',
        },
      },
    },
    Body_Edit_voice_v1_voices__voice_id__edit_post: {
      title: 'Body_Edit_voice_v1_voices__voice_id__edit_post',
      required: ['name'],
      type: 'object',
      properties: {
        name: {
          title: 'Name',
          type: 'string',
          description: 'The name that identifies this voice. This will be displayed in the dropdown of the website.',
        },
        files: {
          title: 'Files',
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Audio files to add to the voice',
        },
        labels: {
          title: 'Labels',
          type: 'string',
          description: 'Serialized labels dictionary for the voice.',
        },
      },
    },
    Body_Text_to_speech_v1_text_to_speech__voice_id__post: {
      title: 'Body_Text_to_speech_v1_text_to_speech__voice_id__post',
      required: ['text'],
      type: 'object',
      properties: {
        text: {
          title: 'Text',
          type: 'string',
          description: 'The text that will get converted into speech. Currently only English text is supported.',
          name: 'Text to convert',
        },
        voice_settings: {
          title: 'Voice Settings',
          allOf: [
            {
              $ref: '#/components/schemas/VoiceSettingsResponseModel',
            },
          ],
          description:
            'Voice settings overriding stored setttings for the given voice. They are applied only on the given TTS request.',
        },
      },
    },
    Body_Text_to_speech_v1_text_to_speech__voice_id__stream_post: {
      title: 'Body_Text_to_speech_v1_text_to_speech__voice_id__stream_post',
      required: ['text'],
      type: 'object',
      properties: {
        text: {
          title: 'Text',
          type: 'string',
          description: 'The text that will get converted into speech. Currently only English text is supported.',
          name: 'Text to convert',
        },
        voice_settings: {
          title: 'Voice Settings',
          allOf: [
            {
              $ref: '#/components/schemas/VoiceSettingsResponseModel',
            },
          ],
          description:
            'Voice settings overriding stored setttings for the given voice. They are applied only on the given TTS request.',
        },
      },
    },
    ExtendedSubscriptionResponseModel: {
      title: 'ExtendedSubscriptionResponseModel',
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
      ],
      type: 'object',
      properties: {
        tier: {
          title: 'Tier',
          type: 'string',
        },
        character_count: {
          title: 'Character Count',
          type: 'integer',
        },
        character_limit: {
          title: 'Character Limit',
          type: 'integer',
        },
        can_extend_character_limit: {
          title: 'Can Extend Character Limit',
          type: 'boolean',
        },
        allowed_to_extend_character_limit: {
          title: 'Allowed To Extend Character Limit',
          type: 'boolean',
        },
        next_character_count_reset_unix: {
          title: 'Next Character Count Reset Unix',
          type: 'integer',
        },
        voice_limit: {
          title: 'Voice Limit',
          type: 'integer',
        },
        can_extend_voice_limit: {
          title: 'Can Extend Voice Limit',
          type: 'boolean',
        },
        can_use_instant_voice_cloning: {
          title: 'Can Use Instant Voice Cloning',
          type: 'boolean',
        },
        available_models: {
          title: 'Available Models',
          type: 'array',
          items: {
            $ref: '#/components/schemas/TTSModelResponseModel',
          },
        },
        status: {
          title: 'Status',
          enum: ['trialing', 'active', 'incomplete', 'incomplete_expired', 'past_due', 'canceled', 'unpaid', 'free'],
          type: 'string',
        },
        next_invoice: {
          $ref: '#/components/schemas/InvoiceResponseModel',
        },
      },
    },
    FineTuningResponseModel: {
      title: 'FineTuningResponseModel',
      required: [
        'is_allowed_to_fine_tune',
        'fine_tuning_requested',
        'finetuning_state',
        'verification_attempts',
        'verification_attempts_count',
      ],
      type: 'object',
      properties: {
        is_allowed_to_fine_tune: {
          title: 'Is Allowed To Fine Tune',
          type: 'boolean',
        },
        fine_tuning_requested: {
          title: 'Fine Tuning Requested',
          type: 'boolean',
        },
        finetuning_state: {
          title: 'Finetuning State',
          enum: ['not_started', 'is_fine_tuning', 'fine_tuned'],
          type: 'string',
        },
        verification_attempts: {
          title: 'Verification Attempts',
          type: 'array',
          items: {
            $ref: '#/components/schemas/VerificationAttemptResponseModel',
          },
        },
        verification_attempts_count: {
          title: 'Verification Attempts Count',
          type: 'integer',
        },
      },
    },
    GetHistoryResponseModel: {
      title: 'GetHistoryResponseModel',
      required: ['history'],
      type: 'object',
      properties: {
        history: {
          title: 'History',
          type: 'array',
          items: {
            $ref: '#/components/schemas/HistoryItemResponseModel',
          },
        },
      },
    },
    GetVoicesResponseModel: {
      title: 'GetVoicesResponseModel',
      required: ['voices'],
      type: 'object',
      properties: {
        voices: {
          title: 'Voices',
          type: 'array',
          items: {
            $ref: '#/components/schemas/VoiceResponseModel',
          },
        },
      },
    },
    HTTPValidationError: {
      title: 'HTTPValidationError',
      type: 'object',
      properties: {
        detail: {
          title: 'Detail',
          type: 'array',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
        },
      },
    },
    HistoryItemResponseModel: {
      title: 'HistoryItemResponseModel',
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
      ],
      type: 'object',
      properties: {
        history_item_id: {
          title: 'History Item Id',
          type: 'string',
        },
        voice_id: {
          title: 'Voice Id',
          type: 'string',
        },
        voice_name: {
          title: 'Voice Name',
          type: 'string',
        },
        text: {
          title: 'Text',
          type: 'string',
        },
        date_unix: {
          title: 'Date Unix',
          type: 'integer',
        },
        character_count_change_from: {
          title: 'Character Count Change From',
          type: 'integer',
        },
        character_count_change_to: {
          title: 'Character Count Change To',
          type: 'integer',
        },
        content_type: {
          title: 'Content Type',
          type: 'string',
        },
        state: {
          title: 'State',
          enum: ['created', 'deleted', 'processing'],
          type: 'string',
        },
        settings: {
          title: 'Settings',
          type: 'object',
        },
      },
    },
    InvoiceResponseModel: {
      title: 'InvoiceResponseModel',
      required: ['amount_due_cents', 'next_payment_attempt_unix'],
      type: 'object',
      properties: {
        amount_due_cents: {
          title: 'Amount Due Cents',
          type: 'integer',
        },
        next_payment_attempt_unix: {
          title: 'Next Payment Attempt Unix',
          type: 'integer',
        },
      },
    },
    LanguageResponseModel: {
      title: 'LanguageResponseModel',
      required: ['iso_code', 'display_name'],
      type: 'object',
      properties: {
        iso_code: {
          title: 'Iso Code',
          type: 'string',
        },
        display_name: {
          title: 'Display Name',
          type: 'string',
        },
      },
    },
    RecordingResponseModel: {
      title: 'RecordingResponseModel',
      required: ['recording_id', 'mime_type', 'size_bytes', 'upload_date_unix', 'transcription'],
      type: 'object',
      properties: {
        recording_id: {
          title: 'Recording Id',
          type: 'string',
        },
        mime_type: {
          title: 'Mime Type',
          type: 'string',
        },
        size_bytes: {
          title: 'Size Bytes',
          type: 'integer',
        },
        upload_date_unix: {
          title: 'Upload Date Unix',
          type: 'integer',
        },
        transcription: {
          title: 'Transcription',
          type: 'string',
        },
      },
    },
    SampleResponseModel: {
      title: 'SampleResponseModel',
      required: ['sample_id', 'file_name', 'mime_type', 'size_bytes', 'hash'],
      type: 'object',
      properties: {
        sample_id: {
          title: 'Sample Id',
          type: 'string',
        },
        file_name: {
          title: 'File Name',
          type: 'string',
        },
        mime_type: {
          title: 'Mime Type',
          type: 'string',
        },
        size_bytes: {
          title: 'Size Bytes',
          type: 'integer',
        },
        hash: {
          title: 'Hash',
          type: 'string',
        },
      },
    },
    SubscriptionResponseModel: {
      title: 'SubscriptionResponseModel',
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
      ],
      type: 'object',
      properties: {
        tier: {
          title: 'Tier',
          type: 'string',
        },
        character_count: {
          title: 'Character Count',
          type: 'integer',
        },
        character_limit: {
          title: 'Character Limit',
          type: 'integer',
        },
        can_extend_character_limit: {
          title: 'Can Extend Character Limit',
          type: 'boolean',
        },
        allowed_to_extend_character_limit: {
          title: 'Allowed To Extend Character Limit',
          type: 'boolean',
        },
        next_character_count_reset_unix: {
          title: 'Next Character Count Reset Unix',
          type: 'integer',
        },
        voice_limit: {
          title: 'Voice Limit',
          type: 'integer',
        },
        can_extend_voice_limit: {
          title: 'Can Extend Voice Limit',
          type: 'boolean',
        },
        can_use_instant_voice_cloning: {
          title: 'Can Use Instant Voice Cloning',
          type: 'boolean',
        },
        available_models: {
          title: 'Available Models',
          type: 'array',
          items: {
            $ref: '#/components/schemas/TTSModelResponseModel',
          },
        },
        status: {
          title: 'Status',
          enum: ['trialing', 'active', 'incomplete', 'incomplete_expired', 'past_due', 'canceled', 'unpaid', 'free'],
          type: 'string',
        },
      },
    },
    TTSModelResponseModel: {
      title: 'TTSModelResponseModel',
      required: ['model_id', 'display_name', 'supported_languages'],
      type: 'object',
      properties: {
        model_id: {
          title: 'Model Id',
          type: 'string',
        },
        display_name: {
          title: 'Display Name',
          type: 'string',
        },
        supported_languages: {
          title: 'Supported Languages',
          type: 'array',
          items: {
            $ref: '#/components/schemas/LanguageResponseModel',
          },
        },
      },
    },
    UserResponseModel: {
      title: 'UserResponseModel',
      required: ['subscription', 'is_new_user', 'xi_api_key'],
      type: 'object',
      properties: {
        subscription: {
          $ref: '#/components/schemas/SubscriptionResponseModel',
        },
        is_new_user: {
          title: 'Is New User',
          type: 'boolean',
        },
        xi_api_key: {
          title: 'Xi Api Key',
          type: 'string',
        },
      },
    },
    ValidationError: {
      title: 'ValidationError',
      required: ['loc', 'msg', 'type'],
      type: 'object',
      properties: {
        loc: {
          title: 'Location',
          type: 'array',
          items: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'integer',
              },
            ],
          },
        },
        msg: {
          title: 'Message',
          type: 'string',
        },
        type: {
          title: 'Error Type',
          type: 'string',
        },
      },
    },
    VerificationAttemptResponseModel: {
      title: 'VerificationAttemptResponseModel',
      required: ['text', 'date_unix', 'accepted', 'similarity', 'recording'],
      type: 'object',
      properties: {
        text: {
          title: 'Text',
          type: 'string',
        },
        date_unix: {
          title: 'Date Unix',
          type: 'integer',
        },
        accepted: {
          title: 'Accepted',
          type: 'boolean',
        },
        similarity: {
          title: 'Similarity',
          type: 'number',
        },
        recording: {
          $ref: '#/components/schemas/RecordingResponseModel',
        },
      },
    },
    VoiceResponseModel: {
      title: 'VoiceResponseModel',
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
      ],
      type: 'object',
      properties: {
        voice_id: {
          title: 'Voice Id',
          type: 'string',
        },
        name: {
          title: 'Name',
          type: 'string',
        },
        samples: {
          title: 'Samples',
          type: 'array',
          items: {
            $ref: '#/components/schemas/SampleResponseModel',
          },
        },
        category: {
          title: 'Category',
          type: 'string',
        },
        fine_tuning: {
          $ref: '#/components/schemas/FineTuningResponseModel',
        },
        labels: {
          title: 'Labels',
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },
        preview_url: {
          title: 'Preview Url',
          type: 'string',
        },
        available_for_tiers: {
          title: 'Available For Tiers',
          type: 'array',
          items: {
            type: 'string',
          },
        },
        settings: {
          $ref: '#/components/schemas/VoiceSettingsResponseModel',
        },
      },
    },
    VoiceSettingsResponseModel: {
      title: 'VoiceSettingsResponseModel',
      required: ['stability', 'similarity_boost'],
      type: 'object',
      properties: {
        stability: {
          title: 'Stability',
          type: 'number',
        },
        similarity_boost: {
          title: 'Similarity Boost',
          type: 'number',
        },
      },
    },
  },
} as TComponents;
