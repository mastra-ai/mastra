// @ts-nocheck
export type openapi = {
  openapi: '3.0.0';
  servers: [
    {
      url: 'https://api.dropbox.com';
    },
  ];
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http';
        scheme: 'bearer';
      };
    };
  };
  security: [
    {
      bearerAuth: [];
    },
  ];
  paths: {
    '/2/account/set_profile_photo': {
      post: {
        tags: ['account'];
        summary: 'set_profile_photo';
        description: "[set_profile_photo](https://www.dropbox.com/developers/documentation/http/documentation#account-set_profile_photo)\n\nscope: `account_info.write`\n\nSets a user's profile photo.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"photo\\": {\\n        \\".tag\\": \\"base64_data\\", \\n        \\"base64_data\\": \\"SW1hZ2UgZGF0YSBpbiBiYXNlNjQtZW5jb2RlZCBieXRlcy4gTm90IGEgdmFsaWQgZXhhbXBsZS4=\\"\\n    }\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                };
              };
            };
          };
        };
      };
    };
    '/2/auth/token/from_oauth1': {
      post: {
        tags: ['auth'];
        summary: 'token/from_oauth1';
        description: '[token/from_oauth1](https://www.dropbox.com/developers/documentation/http/documentation#auth-token-from_oauth1)\n\nscope: `None`\n\nCreates an OAuth 2.0 access token from the supplied OAuth 1.0 access token.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"oauth1_token\\": \\"qievr8hamyg6ndck\\", \\n    \\"oauth1_token_secret\\": \\"qomoftv0472git7\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  oauth2_token: '9mCrkS7BIdAAAAAAAAAAHHS0TsSnpYvKQVtKdBnN5IuzhYOGblSgTcHgBFKFMmFn';
                };
              };
            };
          };
        };
      };
    };
    '/2/auth/token/revoke': {
      post: {
        tags: ['auth'];
        summary: 'token/revoke';
        description: '[token/revoke](https://www.dropbox.com/developers/documentation/http/documentation#auth-token-revoke)\n\nscope: `None`\n\nDisables the access token used to authenticate the call.      ';
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/check/app': {
      post: {
        tags: ['check'];
        summary: 'app';
        description: '[app](https://www.dropbox.com/developers/documentation/http/documentation#check-app)\n\nscope: `None`\n\nThis endpoint performs App Authentication, validating the supplied app key and secret, and returns the supplied string, to allow you to test your code and connection to the Dropbox API. It has no other effect. If you receive an HTTP 200 response with the supplied query, it indicates at least part of the Dropbox API infrastructure is working and that the app key and secret valid.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"query\\": \\"foo\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  result: 'foo';
                };
              };
            };
          };
        };
      };
    };
    '/2/check/user': {
      post: {
        tags: ['check'];
        summary: 'user';
        description: '[user](https://www.dropbox.com/developers/documentation/http/documentation#check-user)\n\nscope: `None`\n\nThis endpoint performs User Authentication, validating the supplied access token, and returns the supplied string, to allow you to test your code and connection to the Dropbox API. It has no other effect. If you receive an HTTP 200 response with the supplied query, it indicates at least part of the Dropbox API infrastructure is working and that the access token is valid.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"query\\": \\"foo\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  result: 'foo';
                };
              };
            };
          };
        };
      };
    };
    '/2/contacts/delete_manual_contacts': {
      post: {
        tags: ['contacts'];
        summary: 'delete_manual_contacts';
        description: "[delete_manual_contacts](https://www.dropbox.com/developers/documentation/http/documentation#contacts-delete_manual_contacts)\n\nscope: `contacts.write`\n\nRemoves all manually added contacts. You'll still keep contacts who are on your team or who you imported. New contacts will be added when you share.      ";
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/contacts/delete_manual_contacts_batch': {
      post: {
        tags: ['contacts'];
        summary: 'delete_manual_contacts_batch';
        description: '[delete_manual_contacts_batch](https://www.dropbox.com/developers/documentation/http/documentation#contacts-delete_manual_contacts_batch)\n\nscope: `contacts.write`\n\nRemoves manually added contacts from the given list.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"email_addresses\\": [\\n        \\"contactemailaddress1@domain.com\\", \\n        \\"contactemailaddress2@domain.com\\"\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/file_properties/properties/add': {
      post: {
        tags: ['file_properties'];
        summary: 'properties/add';
        description: '[properties/add](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-properties-add)\n\nscope: `files.metadata.write`\n\nAdd property groups to a Dropbox file. See `templates/add_for_user` or `templates/add_for_team` to create new templates.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"path\\": \\"/my_awesome/word.docx\\", \\n    \\"property_groups\\": [\\n        {\\n            \\"template_id\\": \\"ptid:1a5n2i6d3OYEAAAAAAAAAYa\\", \\n            \\"fields\\": [\\n                {\\n                    \\"name\\": \\"Security Policy\\", \\n                    \\"value\\": \\"Confidential\\"\\n                }\\n            ]\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/file_properties/properties/overwrite': {
      post: {
        tags: ['file_properties'];
        summary: 'properties/overwrite';
        description: '[properties/overwrite](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-properties-overwrite)\n\nscope: `files.metadata.write`\n\nOverwrite property groups associated with a file. This endpoint should be used instead of `properties/update` when property groups are being updated via a "snapshot" instead of via a "delta". In other words, this endpoint will delete all omitted fields from a property group, whereas `properties/update` will only delete fields that are explicitly marked for deletion.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"path\\": \\"/my_awesome/word.docx\\", \\n    \\"property_groups\\": [\\n        {\\n            \\"template_id\\": \\"ptid:1a5n2i6d3OYEAAAAAAAAAYa\\", \\n            \\"fields\\": [\\n                {\\n                    \\"name\\": \\"Security Policy\\", \\n                    \\"value\\": \\"Confidential\\"\\n                }\\n            ]\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/file_properties/properties/remove': {
      post: {
        tags: ['file_properties'];
        summary: 'properties/remove';
        description: '[properties/remove](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-properties-remove)\n\nscope: `files.metadata.write`\n\nPermanently removes the specified property group from the file. To remove specific property field key value pairs, see `properties/update`. To update a template, see `templates/update_for_user` or `templates/update_for_team`. To remove a template, see `templates/remove_for_user` or `templates/remove_for_team`.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"path\\": \\"/my_awesome/word.docx\\", \\n    \\"property_template_ids\\": [\\n        \\"ptid:1a5n2i6d3OYEAAAAAAAAAYa\\"\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/file_properties/properties/search': {
      post: {
        tags: ['file_properties'];
        summary: 'properties/search';
        description: '[properties/search](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-properties-search)\n\nscope: `files.metadata.read`\n\nSearch across property templates for particular property field values.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"queries\\": [\\n        {\\n            \\"query\\": \\"Compliance Bot - Beta\\", \\n            \\"mode\\": {\\n                \\".tag\\": \\"field_name\\", \\n                \\"field_name\\": \\"Security\\"\\n            }, \\n            \\"logical_operator\\": \\"or_operator\\"\\n        }\\n    ], \\n    \\"template_filter\\": \\"filter_none\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
          {
            name: 'Authorization';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: ' Bearer IU571Pc9cGAAAAAAAAAAAQh57r-VTd7qBjZBUsVHLR6NRVTcd0FOThotVQmF9q9F';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  matches: [
                    {
                      id: 'id:a4ayc_80_OEAAAAAAAAAXz';
                      path: '/my_awesome/word.docx';
                      is_deleted: false;
                      property_groups: [
                        {
                          template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                          fields: [
                            {
                              name: 'Security Policy';
                              value: 'Confidential';
                            },
                          ];
                        },
                      ];
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/file_properties/properties/search/continue': {
      post: {
        tags: ['file_properties'];
        summary: 'properties/search/continue';
        description: '[properties/search/continue](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-properties-search-continue)\n\nscope: `files.metadata.read`\n\nOnce a cursor has been retrieved from `properties/search`, use this to paginate through all search results.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  matches: [
                    {
                      id: 'id:a4ayc_80_OEAAAAAAAAAXz';
                      path: '/my_awesome/word.docx';
                      is_deleted: false;
                      property_groups: [
                        {
                          template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                          fields: [
                            {
                              name: 'Security Policy';
                              value: 'Confidential';
                            },
                          ];
                        },
                      ];
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/file_properties/properties/update': {
      post: {
        tags: ['file_properties'];
        summary: 'properties/update';
        description: '[properties/update](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-properties-update)\n\nscope: `files.metadata.write`\n\nAdd, update or remove properties associated with the supplied file and templates. This endpoint should be used instead of `properties/overwrite` when property groups are being updated via a "delta" instead of via a "snapshot" . In other words, this endpoint will not delete any omitted fields from a property group, whereas `properties/overwrite` will delete any fields that are omitted from a property group.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"path\\": \\"/my_awesome/word.docx\\", \\n    \\"update_property_groups\\": [\\n        {\\n            \\"template_id\\": \\"ptid:1a5n2i6d3OYEAAAAAAAAAYa\\", \\n            \\"add_or_update_fields\\": [\\n                {\\n                    \\"name\\": \\"Security Policy\\", \\n                    \\"value\\": \\"Confidential\\"\\n                }\\n            ], \\n            \\"remove_fields\\": []\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/file_properties/templates/add_for_team': {
      post: {
        tags: ['file_properties'];
        summary: 'templates/add_for_team';
        description: '[templates/add_for_team](https://www.dropbox.com/developers/documentation/http/teams#file_properties-templates-add_for_team)\n\nscope: `files.team_metadata.write`\n\nAdd a template associated with a team. See `properties/add` to add properties to a file or folder.\nNote: this endpoint will create team-owned templates.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"name\\": \\"Security\\", \\n    \\"description\\": \\"These properties describe how confidential this file or folder is.\\", \\n    \\"fields\\": [\\n        {\\n            \\"name\\": \\"Security Policy\\", \\n            \\"description\\": \\"This is the security policy of the file or folder described.\\\\nPolicies can be Confidential, Public or Internal.\\", \\n            \\"type\\": \\"string\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        security: [
          {
            bearerAuth: [];
          },
        ];
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                };
              };
            };
          };
        };
      };
    };
    '/2/file_properties/templates/add_for_user': {
      post: {
        tags: ['file_properties'];
        summary: 'templates/add_for_user';
        description: "[templates/add_for_user](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-templates-add_for_user)\n\nscope: `files.metadata.write`\n\nAdd a template associated with a user. See `properties/add` to add properties to a file. This endpoint can't be called on a team member or admin's behalf.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"name\\": \\"Security\\", \\n    \\"description\\": \\"These properties describe how confidential this file or folder is.\\", \\n    \\"fields\\": [\\n        {\\n            \\"name\\": \\"Security Policy\\", \\n            \\"description\\": \\"This is the security policy of the file or folder described.\\\\nPolicies can be Confidential, Public or Internal.\\", \\n            \\"type\\": \\"string\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                };
              };
            };
          };
        };
      };
    };
    '/2/file_properties/templates/get_for_team': {
      post: {
        tags: ['file_properties'];
        summary: 'templates/get_for_team';
        description: '[templates/get_for_team](https://www.dropbox.com/developers/documentation/http/teams#file_properties-templates-get_for_team)\n\nscope: `files.team_metadata.write`\n\nGet the schema for a specified template.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"template_id\\": \\"ptid:1a5n2i6d3OYEAAAAAAAAAYa\\"\\n}"';
              };
            };
          };
        };
        security: [
          {
            bearerAuth: [];
          },
        ];
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  name: 'Security';
                  description: 'These properties describe how confidential this file or folder is.';
                  fields: [
                    {
                      name: 'Security Policy';
                      description: 'This is the security policy of the file or folder described.\nPolicies can be Confidential, Public or Internal.';
                      type: {
                        '.tag': 'string';
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/file_properties/templates/get_for_user': {
      post: {
        tags: ['file_properties'];
        summary: 'templates/get_for_user';
        description: "[templates/get_for_user](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-templates-get_for_user)\n\nscope: `files.metadata.read`\n\nGet the schema for a specified template. This endpoint can't be called on a team member or admin's behalf.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"template_id\\": \\"ptid:1a5n2i6d3OYEAAAAAAAAAYa\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  name: 'Security';
                  description: 'These properties describe how confidential this file or folder is.';
                  fields: [
                    {
                      name: 'Security Policy';
                      description: 'This is the security policy of the file or folder described.\nPolicies can be Confidential, Public or Internal.';
                      type: {
                        '.tag': 'string';
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/file_properties/templates/list_for_team': {
      post: {
        tags: ['file_properties'];
        summary: 'templates/list_for_team';
        description: '[templates/list_for_team](https://www.dropbox.com/developers/documentation/http/teams#file_properties-templates-list_for_team)\n\nscope: `files.team_metadata.write`\n\nGet the template identifiers for a team. To get the schema of each template use `templates/get_for_team`.      ';
        security: [
          {
            bearerAuth: [];
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  template_ids: ['ptid:1a5n2i6d3OYEAAAAAAAAAYa'];
                };
              };
            };
          };
        };
      };
    };
    '/2/file_properties/templates/list_for_user': {
      post: {
        tags: ['file_properties'];
        summary: 'templates/list_for_user';
        description: "[templates/list_for_user](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-templates-list_for_user)\n\nscope: `files.metadata.read`\n\nGet the template identifiers for a team. To get the schema of each template use `templates/get_for_user`. This endpoint can't be called on a team member or admin's behalf.      ";
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  template_ids: ['ptid:1a5n2i6d3OYEAAAAAAAAAYa'];
                };
              };
            };
          };
        };
      };
    };
    '/2/file_properties/templates/remove_for_team': {
      post: {
        tags: ['file_properties'];
        summary: 'templates/remove_for_team';
        description: '[templates/remove_for_team](https://www.dropbox.com/developers/documentation/http/teams#file_properties-templates-remove_for_team)\n\nscope: `files.team_metadata.write`\n\nPermanently removes the specified template created from `templates/add_for_user`. All properties associated with the template will also be removed. This action cannot be undone.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"template_id\\": \\"ptid:1a5n2i6d3OYEAAAAAAAAAYa\\"\\n}"';
              };
            };
          };
        };
        security: [
          {
            bearerAuth: [];
          },
        ];
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/file_properties/templates/remove_for_user': {
      post: {
        tags: ['file_properties'];
        summary: 'templates/remove_for_user';
        description: '[templates/remove_for_user](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-templates-remove_for_user)\n\nscope: `files.metadata.write`\n\nPermanently removes the specified template created from `templates/add_for_user`. All properties associated with the template will also be removed. This action cannot be undone.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"template_id\\": \\"ptid:1a5n2i6d3OYEAAAAAAAAAYa\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/file_properties/templates/update_for_team': {
      post: {
        tags: ['file_properties'];
        summary: 'templates/update_for_team';
        description: '[templates/update_for_team](https://www.dropbox.com/developers/documentation/http/teams#file_properties-templates-update_for_team)\n\nscope: `files.team_metadata.write`\n\nUpdate a template associated with a team. This route can update the template name, the template description and add optional properties to templates.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"template_id\\": \\"ptid:1a5n2i6d3OYEAAAAAAAAAYa\\", \\n    \\"name\\": \\"New Security Template Name\\", \\n    \\"description\\": \\"These properties will describe how confidential this file or folder is.\\", \\n    \\"add_fields\\": [\\n        {\\n            \\"name\\": \\"Security Policy\\", \\n            \\"description\\": \\"This is the security policy of the file or folder described.\\\\nPolicies can be Confidential, Public or Internal.\\", \\n            \\"type\\": \\"string\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        security: [
          {
            bearerAuth: [];
          },
        ];
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                };
              };
            };
          };
        };
      };
    };
    '/2/file_properties/templates/update_for_user': {
      post: {
        tags: ['file_properties'];
        summary: 'templates/update_for_user';
        description: "[templates/update_for_user](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-templates-update_for_user)\n\nscope: `files.metadata.write`\n\nUpdate a template associated with a user. This route can update the template name, the template description and add optional properties to templates. This endpoint can't be called on a team member or admin's behalf.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"template_id\\": \\"ptid:1a5n2i6d3OYEAAAAAAAAAYa\\", \\n    \\"name\\": \\"New Security Template Name\\", \\n    \\"description\\": \\"These properties will describe how confidential this file or folder is.\\", \\n    \\"add_fields\\": [\\n        {\\n            \\"name\\": \\"Security Policy\\", \\n            \\"description\\": \\"This is the security policy of the file or folder described.\\\\nPolicies can be Confidential, Public or Internal.\\", \\n            \\"type\\": \\"string\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                };
              };
            };
          };
        };
      };
    };
    '/2/file_requests/count': {
      post: {
        tags: ['file_requests'];
        summary: 'count';
        description: '[count](https://www.dropbox.com/developers/documentation/http/documentation#file_requests-count)\n\nscope: `file_requests.read`\n\nReturns the total number of file requests owned by this user. Includes both open and closed file requests.      ';
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  file_request_count: 15;
                };
              };
            };
          };
        };
      };
    };
    '/2/file_requests/create': {
      post: {
        tags: ['file_requests'];
        summary: 'create';
        description: '[create](https://www.dropbox.com/developers/documentation/http/documentation#file_requests-create)\n\nscope: `file_requests.write`\n\nCreates a file request for this user.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"title\\": \\"Homework submission\\", \\n    \\"destination\\": \\"/File Requests/Homework\\", \\n    \\"deadline\\": {\\n        \\"deadline\\": \\"2020-10-12T17:00:00Z\\", \\n        \\"allow_late_uploads\\": \\"seven_days\\"\\n    }, \\n    \\"open\\": true\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  id: 'oaCAVmEyrqYnkZX9955Y';
                  url: 'https://www.dropbox.com/request/oaCAVmEyrqYnkZX9955Y';
                  title: 'Homework submission';
                  created: '2015-10-05T17:00:00Z';
                  is_open: true;
                  file_count: 3;
                  destination: '/File Requests/Homework';
                  deadline: {
                    deadline: '2020-10-12T17:00:00Z';
                    allow_late_uploads: {
                      '.tag': 'seven_days';
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/file_requests/delete': {
      post: {
        tags: ['file_requests'];
        summary: 'delete';
        description: '[delete](https://www.dropbox.com/developers/documentation/http/documentation#file_requests-delete)\n\nscope: `file_requests.write`\n\nDelete a batch of closed file requests.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"ids\\": [\\n        \\"oaCAVmEyrqYnkZX9955Y\\", \\n        \\"BaZmehYoXMPtaRmfTbSG\\"\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  file_requests: [
                    {
                      id: 'oaCAVmEyrqYnkZX9955Y';
                      url: 'https://www.dropbox.com/request/oaCAVmEyrqYnkZX9955Y';
                      title: 'Homework submission';
                      created: '2015-10-05T17:00:00Z';
                      is_open: true;
                      file_count: 3;
                      destination: '/File Requests/Homework';
                      deadline: {
                        deadline: '2020-10-12T17:00:00Z';
                        allow_late_uploads: {
                          '.tag': 'seven_days';
                        };
                      };
                    },
                    {
                      id: 'BAJ7IrRGicQKGToykQdB';
                      url: 'https://www.dropbox.com/request/BAJ7IrRGjcQKGToykQdB';
                      title: 'Photo contest submission';
                      created: '2015-11-02T04:00:00Z';
                      is_open: true;
                      file_count: 105;
                      destination: '/Photo contest entries';
                      deadline: {
                        deadline: '2020-10-12T17:00:00Z';
                      };
                    },
                    {
                      id: 'rxwMPvK3ATTa0VxOJu5T';
                      url: 'https://www.dropbox.com/request/rxwMPvK3ATTa0VxOJu5T';
                      title: 'Wedding photo submission';
                      created: '2015-12-15T13:02:00Z';
                      is_open: true;
                      file_count: 37;
                      destination: '/Wedding photos';
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/file_requests/delete_all_closed': {
      post: {
        tags: ['file_requests'];
        summary: 'delete_all_closed';
        description: '[delete_all_closed](https://www.dropbox.com/developers/documentation/http/documentation#file_requests-delete_all_closed)\n\nscope: `file_requests.write`\n\nDelete all closed file requests owned by this user.      ';
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  file_requests: [
                    {
                      id: 'oaCAVmEyrqYnkZX9955Y';
                      url: 'https://www.dropbox.com/request/oaCAVmEyrqYnkZX9955Y';
                      title: 'Homework submission';
                      created: '2015-10-05T17:00:00Z';
                      is_open: true;
                      file_count: 3;
                      destination: '/File Requests/Homework';
                      deadline: {
                        deadline: '2020-10-12T17:00:00Z';
                        allow_late_uploads: {
                          '.tag': 'seven_days';
                        };
                      };
                    },
                    {
                      id: 'BAJ7IrRGicQKGToykQdB';
                      url: 'https://www.dropbox.com/request/BAJ7IrRGjcQKGToykQdB';
                      title: 'Photo contest submission';
                      created: '2015-11-02T04:00:00Z';
                      is_open: true;
                      file_count: 105;
                      destination: '/Photo contest entries';
                      deadline: {
                        deadline: '2020-10-12T17:00:00Z';
                      };
                    },
                    {
                      id: 'rxwMPvK3ATTa0VxOJu5T';
                      url: 'https://www.dropbox.com/request/rxwMPvK3ATTa0VxOJu5T';
                      title: 'Wedding photo submission';
                      created: '2015-12-15T13:02:00Z';
                      is_open: true;
                      file_count: 37;
                      destination: '/Wedding photos';
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/file_requests/get': {
      post: {
        tags: ['file_requests'];
        summary: 'get';
        description: '[get](https://www.dropbox.com/developers/documentation/http/documentation#file_requests-get)\n\nscope: `file_requests.read`\n\nReturns the specified file request.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"id\\": \\"oaCAVmEyrqYnkZX9955Y\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  id: 'oaCAVmEyrqYnkZX9955Y';
                  url: 'https://www.dropbox.com/request/oaCAVmEyrqYnkZX9955Y';
                  title: 'Homework submission';
                  created: '2015-10-05T17:00:00Z';
                  is_open: true;
                  file_count: 3;
                  destination: '/File Requests/Homework';
                  deadline: {
                    deadline: '2020-10-12T17:00:00Z';
                    allow_late_uploads: {
                      '.tag': 'seven_days';
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/file_requests/list_v2': {
      post: {
        tags: ['file_requests'];
        summary: 'list';
        description: '[list](https://www.dropbox.com/developers/documentation/http/documentation#file_requests-list)\n\nscope: `file_requests.read`\n\nReturns a list of file requests owned by this user. For apps with the app folder permission, this will only return file requests with destinations in the app folder.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"limit\\": 1000\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  file_requests: [
                    {
                      id: 'oaCAVmEyrqYnkZX9955Y';
                      url: 'https://www.dropbox.com/request/oaCAVmEyrqYnkZX9955Y';
                      title: 'Homework submission';
                      created: '2015-10-05T17:00:00Z';
                      is_open: true;
                      file_count: 3;
                      destination: '/File Requests/Homework';
                      deadline: {
                        deadline: '2020-10-12T17:00:00Z';
                        allow_late_uploads: {
                          '.tag': 'seven_days';
                        };
                      };
                    },
                    {
                      id: 'BAJ7IrRGicQKGToykQdB';
                      url: 'https://www.dropbox.com/request/BAJ7IrRGjcQKGToykQdB';
                      title: 'Photo contest submission';
                      created: '2015-11-02T04:00:00Z';
                      is_open: true;
                      file_count: 105;
                      destination: '/Photo contest entries';
                      deadline: {
                        deadline: '2020-10-12T17:00:00Z';
                      };
                    },
                    {
                      id: 'rxwMPvK3ATTa0VxOJu5T';
                      url: 'https://www.dropbox.com/request/rxwMPvK3ATTa0VxOJu5T';
                      title: 'Wedding photo submission';
                      created: '2015-12-15T13:02:00Z';
                      is_open: true;
                      file_count: 37;
                      destination: '/Wedding photos';
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                  has_more: true;
                };
              };
            };
          };
        };
      };
    };
    '/2/file_requests/list/continue': {
      post: {
        tags: ['file_requests'];
        summary: 'list/continue';
        description: '[list/continue](https://www.dropbox.com/developers/documentation/http/documentation#file_requests-list-continue)\n\nscope: `file_requests.read`\n\nOnce a cursor has been retrieved from `list:2`, use this to paginate through all file requests. The cursor must come from a previous call to `list:2` or `list/continue`.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  file_requests: [
                    {
                      id: 'oaCAVmEyrqYnkZX9955Y';
                      url: 'https://www.dropbox.com/request/oaCAVmEyrqYnkZX9955Y';
                      title: 'Homework submission';
                      created: '2015-10-05T17:00:00Z';
                      is_open: true;
                      file_count: 3;
                      destination: '/File Requests/Homework';
                      deadline: {
                        deadline: '2020-10-12T17:00:00Z';
                        allow_late_uploads: {
                          '.tag': 'seven_days';
                        };
                      };
                    },
                    {
                      id: 'BAJ7IrRGicQKGToykQdB';
                      url: 'https://www.dropbox.com/request/BAJ7IrRGjcQKGToykQdB';
                      title: 'Photo contest submission';
                      created: '2015-11-02T04:00:00Z';
                      is_open: true;
                      file_count: 105;
                      destination: '/Photo contest entries';
                      deadline: {
                        deadline: '2020-10-12T17:00:00Z';
                      };
                    },
                    {
                      id: 'rxwMPvK3ATTa0VxOJu5T';
                      url: 'https://www.dropbox.com/request/rxwMPvK3ATTa0VxOJu5T';
                      title: 'Wedding photo submission';
                      created: '2015-12-15T13:02:00Z';
                      is_open: true;
                      file_count: 37;
                      destination: '/Wedding photos';
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                  has_more: true;
                };
              };
            };
          };
        };
      };
    };
    '/2/file_requests/update': {
      post: {
        tags: ['file_requests'];
        summary: 'update';
        description: '[update](https://www.dropbox.com/developers/documentation/http/documentation#file_requests-update)\n\nscope: `file_requests.write`\n\nUpdate a file request.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"id\\": \\"oaCAVmEyrqYnkZX9955Y\\", \\n    \\"title\\": \\"Homework submission\\", \\n    \\"destination\\": \\"/File Requests/Homework\\", \\n    \\"deadline\\": {\\n        \\".tag\\": \\"update\\", \\n        \\"deadline\\": \\"2020-10-12T17:00:00Z\\", \\n        \\"allow_late_uploads\\": \\"seven_days\\"\\n    }, \\n    \\"open\\": true\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  id: 'oaCAVmEyrqYnkZX9955Y';
                  url: 'https://www.dropbox.com/request/oaCAVmEyrqYnkZX9955Y';
                  title: 'Homework submission';
                  created: '2015-10-05T17:00:00Z';
                  is_open: true;
                  file_count: 3;
                  destination: '/File Requests/Homework';
                  deadline: {
                    deadline: '2020-10-12T17:00:00Z';
                    allow_late_uploads: {
                      '.tag': 'seven_days';
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/files/copy_v2': {
      post: {
        tags: ['files'];
        summary: 'copy';
        description: "[copy](https://www.dropbox.com/developers/documentation/http/documentation#files-copy)\n\nscope: `files.content.write`\n\nCopy a file or folder to a different location in the user's Dropbox.\nIf the source path is a folder all its contents will be copied.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"from_path\\": \\"/Homework/math\\", \\n    \\"to_path\\": \\"/Homework/algebra\\", \\n    \\"allow_shared_folder\\": false, \\n    \\"autorename\\": false, \\n    \\"allow_ownership_transfer\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  metadata: {
                    '.tag': 'file';
                    name: 'Prime_Numbers.txt';
                    id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                    client_modified: '2015-05-12T15:50:38Z';
                    server_modified: '2015-05-12T15:50:38Z';
                    rev: 'a1c10ce0dd78';
                    size: 7212;
                    path_lower: '/homework/math/prime_numbers.txt';
                    path_display: '/Homework/math/Prime_Numbers.txt';
                    sharing_info: {
                      read_only: true;
                      parent_shared_folder_id: '84528192421';
                      modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                    };
                    is_downloadable: true;
                    property_groups: [
                      {
                        template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                        fields: [
                          {
                            name: 'Security Policy';
                            value: 'Confidential';
                          },
                        ];
                      },
                    ];
                    has_explicit_shared_members: false;
                    content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                    file_lock_info: {
                      is_lockholder: true;
                      lockholder_name: 'Imaginary User';
                      created: '2015-05-12T15:50:38Z';
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/files/copy_batch_v2': {
      post: {
        tags: ['files'];
        summary: 'copy_batch';
        description: "[copy_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-copy_batch)\n\nscope: `files.content.write`\n\nCopy multiple files or folders to different locations at once in the user's Dropbox.\nThis route will replace `copy_batch:1`. The main difference is this route will return status for each entry, while `copy_batch:1` raises failure if any entry fails.\nThis route will either finish synchronously, or return a job ID and do the async copy job in background. Please use `copy_batch/check:2` to check the job status.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"entries\\": [\\n        {\\n            \\"from_path\\": \\"/Homework/math\\", \\n            \\"to_path\\": \\"/Homework/algebra\\"\\n        }\\n    ], \\n    \\"autorename\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  entries: [
                    {
                      '.tag': 'success';
                      success: {
                        '.tag': 'file';
                        name: 'Prime_Numbers.txt';
                        id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                        client_modified: '2015-05-12T15:50:38Z';
                        server_modified: '2015-05-12T15:50:38Z';
                        rev: 'a1c10ce0dd78';
                        size: 7212;
                        path_lower: '/homework/math/prime_numbers.txt';
                        path_display: '/Homework/math/Prime_Numbers.txt';
                        sharing_info: {
                          read_only: true;
                          parent_shared_folder_id: '84528192421';
                          modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        };
                        is_downloadable: true;
                        property_groups: [
                          {
                            template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                            fields: [
                              {
                                name: 'Security Policy';
                                value: 'Confidential';
                              },
                            ];
                          },
                        ];
                        has_explicit_shared_members: false;
                        content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                        file_lock_info: {
                          is_lockholder: true;
                          lockholder_name: 'Imaginary User';
                          created: '2015-05-12T15:50:38Z';
                        };
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/files/copy_batch/check_v2': {
      post: {
        tags: ['files'];
        summary: 'copy_batch/check';
        description: '[copy_batch/check](https://www.dropbox.com/developers/documentation/http/documentation#files-copy_batch-check)\n\nscope: `files.content.write`\n\nReturns the status of an asynchronous job for `copy_batch:2`. It returns list of results for each entry.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"async_job_id\\": \\"34g93hh34h04y384084\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  entries: [
                    {
                      '.tag': 'success';
                      success: {
                        '.tag': 'file';
                        name: 'Prime_Numbers.txt';
                        id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                        client_modified: '2015-05-12T15:50:38Z';
                        server_modified: '2015-05-12T15:50:38Z';
                        rev: 'a1c10ce0dd78';
                        size: 7212;
                        path_lower: '/homework/math/prime_numbers.txt';
                        path_display: '/Homework/math/Prime_Numbers.txt';
                        sharing_info: {
                          read_only: true;
                          parent_shared_folder_id: '84528192421';
                          modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        };
                        is_downloadable: true;
                        property_groups: [
                          {
                            template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                            fields: [
                              {
                                name: 'Security Policy';
                                value: 'Confidential';
                              },
                            ];
                          },
                        ];
                        has_explicit_shared_members: false;
                        content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                        file_lock_info: {
                          is_lockholder: true;
                          lockholder_name: 'Imaginary User';
                          created: '2015-05-12T15:50:38Z';
                        };
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/files/copy_reference/get': {
      post: {
        tags: ['files'];
        summary: 'copy_reference/get';
        description: "[copy_reference/get](https://www.dropbox.com/developers/documentation/http/documentation#files-copy_reference-get)\n\nscope: `files.content.write`\n\nGet a copy reference to a file or folder. This reference string can be used to save that file or folder to another user's Dropbox by passing it to `copy_reference/save`.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"path\\": \\"/video.mp4\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  metadata: {
                    '.tag': 'file';
                    name: 'Prime_Numbers.txt';
                    id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                    client_modified: '2015-05-12T15:50:38Z';
                    server_modified: '2015-05-12T15:50:38Z';
                    rev: 'a1c10ce0dd78';
                    size: 7212;
                    path_lower: '/homework/math/prime_numbers.txt';
                    path_display: '/Homework/math/Prime_Numbers.txt';
                    sharing_info: {
                      read_only: true;
                      parent_shared_folder_id: '84528192421';
                      modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                    };
                    is_downloadable: true;
                    property_groups: [
                      {
                        template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                        fields: [
                          {
                            name: 'Security Policy';
                            value: 'Confidential';
                          },
                        ];
                      },
                    ];
                    has_explicit_shared_members: false;
                    content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                    file_lock_info: {
                      is_lockholder: true;
                      lockholder_name: 'Imaginary User';
                      created: '2015-05-12T15:50:38Z';
                    };
                  };
                  copy_reference: 'z1X6ATl6aWtzOGq0c3g5Ng';
                  expires: '2045-05-12T15:50:38Z';
                };
              };
            };
          };
        };
      };
    };
    '/2/files/copy_reference/save': {
      post: {
        tags: ['files'];
        summary: 'copy_reference/save';
        description: "[copy_reference/save](https://www.dropbox.com/developers/documentation/http/documentation#files-copy_reference-save)\n\nscope: `files.content.write`\n\nSave a copy reference returned by `copy_reference/get` to the user's Dropbox.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"copy_reference\\": \\"z1X6ATl6aWtzOGq0c3g5Ng\\", \\n    \\"path\\": \\"/video.mp4\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  metadata: {
                    '.tag': 'file';
                    name: 'Prime_Numbers.txt';
                    id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                    client_modified: '2015-05-12T15:50:38Z';
                    server_modified: '2015-05-12T15:50:38Z';
                    rev: 'a1c10ce0dd78';
                    size: 7212;
                    path_lower: '/homework/math/prime_numbers.txt';
                    path_display: '/Homework/math/Prime_Numbers.txt';
                    sharing_info: {
                      read_only: true;
                      parent_shared_folder_id: '84528192421';
                      modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                    };
                    is_downloadable: true;
                    property_groups: [
                      {
                        template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                        fields: [
                          {
                            name: 'Security Policy';
                            value: 'Confidential';
                          },
                        ];
                      },
                    ];
                    has_explicit_shared_members: false;
                    content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                    file_lock_info: {
                      is_lockholder: true;
                      lockholder_name: 'Imaginary User';
                      created: '2015-05-12T15:50:38Z';
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/files/create_folder_v2': {
      post: {
        tags: ['files'];
        summary: 'create_folder';
        description: '[create_folder](https://www.dropbox.com/developers/documentation/http/documentation#files-create_folder)\n\nscope: `files.content.write`\n\nCreate a folder at a given path.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"path\\": \\"/Homework/math\\", \\n    \\"autorename\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  metadata: {
                    name: 'math';
                    id: 'id:a4ayc_80_OEAAAAAAAAAXz';
                    path_lower: '/homework/math';
                    path_display: '/Homework/math';
                    sharing_info: {
                      read_only: false;
                      parent_shared_folder_id: '84528192421';
                      traverse_only: false;
                      no_access: false;
                    };
                    property_groups: [
                      {
                        template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                        fields: [
                          {
                            name: 'Security Policy';
                            value: 'Confidential';
                          },
                        ];
                      },
                    ];
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/files/create_folder_batch': {
      post: {
        tags: ['files'];
        summary: 'create_folder_batch';
        description: '[create_folder_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-create_folder_batch)\n\nscope: `files.content.write`\n\nCreate multiple folders at once.\nThis route is asynchronous for large batches, which returns a job ID immediately and runs the create folder batch asynchronously. Otherwise, creates the folders and returns the result synchronously for smaller inputs. You can force asynchronous behaviour by using the `CreateFolderBatchArg.force_async` flag.  Use `create_folder_batch/check` to check the job status.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"paths\\": [\\n        \\"/Homework/math\\"\\n    ], \\n    \\"autorename\\": false, \\n    \\"force_async\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  entries: [
                    {
                      '.tag': 'success';
                      metadata: {
                        name: 'math';
                        id: 'id:a4ayc_80_OEAAAAAAAAAXz';
                        path_lower: '/homework/math';
                        path_display: '/Homework/math';
                        sharing_info: {
                          read_only: false;
                          parent_shared_folder_id: '84528192421';
                          traverse_only: false;
                          no_access: false;
                        };
                        property_groups: [
                          {
                            template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                            fields: [
                              {
                                name: 'Security Policy';
                                value: 'Confidential';
                              },
                            ];
                          },
                        ];
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/files/create_folder_batch/check': {
      post: {
        tags: ['files'];
        summary: 'create_folder_batch/check';
        description: '[create_folder_batch/check](https://www.dropbox.com/developers/documentation/http/documentation#files-create_folder_batch-check)\n\nscope: `files.content.write`\n\nReturns the status of an asynchronous job for `create_folder_batch`. If success, it returns list of result for each entry.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"async_job_id\\": \\"34g93hh34h04y384084\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  entries: [
                    {
                      '.tag': 'success';
                      metadata: {
                        name: 'math';
                        id: 'id:a4ayc_80_OEAAAAAAAAAXz';
                        path_lower: '/homework/math';
                        path_display: '/Homework/math';
                        sharing_info: {
                          read_only: false;
                          parent_shared_folder_id: '84528192421';
                          traverse_only: false;
                          no_access: false;
                        };
                        property_groups: [
                          {
                            template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                            fields: [
                              {
                                name: 'Security Policy';
                                value: 'Confidential';
                              },
                            ];
                          },
                        ];
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/files/delete_v2': {
      post: {
        tags: ['files'];
        summary: 'delete';
        description: '[delete](https://www.dropbox.com/developers/documentation/http/documentation#files-delete)\n\nscope: `files.content.write`\n\nDelete the file or folder at a given path.\nIf the path is a folder, all its contents will be deleted too.\nA successful response indicates that the file or folder was deleted. The returned metadata will be the corresponding `FileMetadata` or `FolderMetadata` for the item at time of deletion, and not a `DeletedMetadata` object.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"path\\": \\"/Homework/math/Prime_Numbers.txt\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  metadata: {
                    '.tag': 'file';
                    name: 'Prime_Numbers.txt';
                    id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                    client_modified: '2015-05-12T15:50:38Z';
                    server_modified: '2015-05-12T15:50:38Z';
                    rev: 'a1c10ce0dd78';
                    size: 7212;
                    path_lower: '/homework/math/prime_numbers.txt';
                    path_display: '/Homework/math/Prime_Numbers.txt';
                    sharing_info: {
                      read_only: true;
                      parent_shared_folder_id: '84528192421';
                      modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                    };
                    is_downloadable: true;
                    property_groups: [
                      {
                        template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                        fields: [
                          {
                            name: 'Security Policy';
                            value: 'Confidential';
                          },
                        ];
                      },
                    ];
                    has_explicit_shared_members: false;
                    content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                    file_lock_info: {
                      is_lockholder: true;
                      lockholder_name: 'Imaginary User';
                      created: '2015-05-12T15:50:38Z';
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/files/delete_batch': {
      post: {
        tags: ['files'];
        summary: 'delete_batch';
        description: '[delete_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-delete_batch)\n\nscope: `files.content.write`\n\nDelete multiple files/folders at once.\nThis route is asynchronous, which returns a job ID immediately and runs the delete batch asynchronously. Use `delete_batch/check` to check the job status.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"entries\\": [\\n        {\\n            \\"path\\": \\"/Homework/math/Prime_Numbers.txt\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  entries: [
                    {
                      '.tag': 'success';
                      metadata: {
                        '.tag': 'file';
                        name: 'Prime_Numbers.txt';
                        id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                        client_modified: '2015-05-12T15:50:38Z';
                        server_modified: '2015-05-12T15:50:38Z';
                        rev: 'a1c10ce0dd78';
                        size: 7212;
                        path_lower: '/homework/math/prime_numbers.txt';
                        path_display: '/Homework/math/Prime_Numbers.txt';
                        sharing_info: {
                          read_only: true;
                          parent_shared_folder_id: '84528192421';
                          modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        };
                        is_downloadable: true;
                        property_groups: [
                          {
                            template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                            fields: [
                              {
                                name: 'Security Policy';
                                value: 'Confidential';
                              },
                            ];
                          },
                        ];
                        has_explicit_shared_members: false;
                        content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                        file_lock_info: {
                          is_lockholder: true;
                          lockholder_name: 'Imaginary User';
                          created: '2015-05-12T15:50:38Z';
                        };
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/files/delete_batch/check': {
      post: {
        tags: ['files'];
        summary: 'delete_batch/check';
        description: '[delete_batch/check](https://www.dropbox.com/developers/documentation/http/documentation#files-delete_batch-check)\n\nscope: `files.content.write`\n\nReturns the status of an asynchronous job for `delete_batch`. If success, it returns list of result for each entry.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"async_job_id\\": \\"34g93hh34h04y384084\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  entries: [
                    {
                      '.tag': 'success';
                      metadata: {
                        '.tag': 'file';
                        name: 'Prime_Numbers.txt';
                        id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                        client_modified: '2015-05-12T15:50:38Z';
                        server_modified: '2015-05-12T15:50:38Z';
                        rev: 'a1c10ce0dd78';
                        size: 7212;
                        path_lower: '/homework/math/prime_numbers.txt';
                        path_display: '/Homework/math/Prime_Numbers.txt';
                        sharing_info: {
                          read_only: true;
                          parent_shared_folder_id: '84528192421';
                          modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        };
                        is_downloadable: true;
                        property_groups: [
                          {
                            template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                            fields: [
                              {
                                name: 'Security Policy';
                                value: 'Confidential';
                              },
                            ];
                          },
                        ];
                        has_explicit_shared_members: false;
                        content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                        file_lock_info: {
                          is_lockholder: true;
                          lockholder_name: 'Imaginary User';
                          created: '2015-05-12T15:50:38Z';
                        };
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/files/download': {
      post: {
        tags: ['files'];
        summary: 'download';
        description: "[download](https://www.dropbox.com/developers/documentation/http/documentation#files-download)\n\nscope: `files.content.read`\n\nDownload a file from a user's Dropbox.      ";
        parameters: [
          {
            name: 'Dropbox-API-Arg';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: '{\n    "path": "/Homework/math/Prime_Numbers.txt"\n}';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  name: 'Prime_Numbers.txt';
                  id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                  client_modified: '2015-05-12T15:50:38Z';
                  server_modified: '2015-05-12T15:50:38Z';
                  rev: 'a1c10ce0dd78';
                  size: 7212;
                  path_lower: '/homework/math/prime_numbers.txt';
                  path_display: '/Homework/math/Prime_Numbers.txt';
                  sharing_info: {
                    read_only: true;
                    parent_shared_folder_id: '84528192421';
                    modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                  };
                  is_downloadable: true;
                  property_groups: [
                    {
                      template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                      fields: [
                        {
                          name: 'Security Policy';
                          value: 'Confidential';
                        },
                      ];
                    },
                  ];
                  has_explicit_shared_members: false;
                  content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                  file_lock_info: {
                    is_lockholder: true;
                    lockholder_name: 'Imaginary User';
                    created: '2015-05-12T15:50:38Z';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/files/download_zip': {
      post: {
        tags: ['files'];
        summary: 'download_zip';
        description: "[download_zip](https://www.dropbox.com/developers/documentation/http/documentation#files-download_zip)\n\nscope: `files.content.read`\n\nDownload a folder from the user's Dropbox, as a zip file. The folder must be less than 20 GB in size and have fewer than 10,000 total files. The input cannot be a single file. Any single file must be less than 4GB in size.      ";
        parameters: [
          {
            name: 'Dropbox-API-Arg';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: '{\n    "path": "/Homework/math"\n}';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  metadata: {
                    name: 'math';
                    id: 'id:a4ayc_80_OEAAAAAAAAAXz';
                    path_lower: '/homework/math';
                    path_display: '/Homework/math';
                    sharing_info: {
                      read_only: false;
                      parent_shared_folder_id: '84528192421';
                      traverse_only: false;
                      no_access: false;
                    };
                    property_groups: [
                      {
                        template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                        fields: [
                          {
                            name: 'Security Policy';
                            value: 'Confidential';
                          },
                        ];
                      },
                    ];
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/files/export': {
      post: {
        tags: ['files'];
        summary: 'export';
        description: "[export](https://www.dropbox.com/developers/documentation/http/documentation#files-export)\n\nscope: `files.content.read`\n\nExport a file from a user's Dropbox. This route only supports exporting files that cannot be downloaded directly  and whose `ExportResult.file_metadata` has `ExportInfo.export_as` populated.      ";
        parameters: [
          {
            name: 'Dropbox-API-Arg';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: '{\n    "path": "/Homework/math/Prime_Numbers.gsheet"\n}';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  export_metadata: {
                    name: 'Prime_Numbers.xlsx';
                    size: 7189;
                    export_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                  };
                  file_metadata: {
                    name: 'Prime_Numbers.txt';
                    id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                    client_modified: '2015-05-12T15:50:38Z';
                    server_modified: '2015-05-12T15:50:38Z';
                    rev: 'a1c10ce0dd78';
                    size: 7212;
                    path_lower: '/homework/math/prime_numbers.txt';
                    path_display: '/Homework/math/Prime_Numbers.txt';
                    sharing_info: {
                      read_only: true;
                      parent_shared_folder_id: '84528192421';
                      modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                    };
                    is_downloadable: true;
                    property_groups: [
                      {
                        template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                        fields: [
                          {
                            name: 'Security Policy';
                            value: 'Confidential';
                          },
                        ];
                      },
                    ];
                    has_explicit_shared_members: false;
                    content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                    file_lock_info: {
                      is_lockholder: true;
                      lockholder_name: 'Imaginary User';
                      created: '2015-05-12T15:50:38Z';
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/files/get_file_lock_batch': {
      post: {
        tags: ['files'];
        summary: 'get_file_lock_batch';
        description: '[get_file_lock_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-get_file_lock_batch)\n\nscope: `files.content.read`\n\nReturn the lock metadata for the given list of paths.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"entries\\": [\\n        {\\n            \\"path\\": \\"/John Doe/sample/test.pdf\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  entries: [
                    {
                      '.tag': 'success';
                      metadata: {
                        '.tag': 'file';
                        name: 'Prime_Numbers.txt';
                        id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                        client_modified: '2015-05-12T15:50:38Z';
                        server_modified: '2015-05-12T15:50:38Z';
                        rev: 'a1c10ce0dd78';
                        size: 7212;
                        path_lower: '/homework/math/prime_numbers.txt';
                        path_display: '/Homework/math/Prime_Numbers.txt';
                        sharing_info: {
                          read_only: true;
                          parent_shared_folder_id: '84528192421';
                          modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        };
                        is_downloadable: true;
                        property_groups: [
                          {
                            template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                            fields: [
                              {
                                name: 'Security Policy';
                                value: 'Confidential';
                              },
                            ];
                          },
                        ];
                        has_explicit_shared_members: false;
                        content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                        file_lock_info: {
                          is_lockholder: true;
                          lockholder_name: 'Imaginary User';
                          created: '2015-05-12T15:50:38Z';
                        };
                      };
                      lock: {
                        content: {
                          '.tag': 'single_user';
                          created: '2015-05-12T15:50:38Z';
                          lock_holder_account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                          lock_holder_team_id: 'dbtid:1234abcd';
                        };
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/files/get_metadata': {
      post: {
        tags: ['files'];
        summary: 'get_metadata';
        description: '[get_metadata](https://www.dropbox.com/developers/documentation/http/documentation#files-get_metadata)\n\nscope: `files.metadata.read`\n\nReturns the metadata for a file or folder.\nNote: Metadata for the root folder is unsupported.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"path\\": \\"/Homework/math\\", \\n    \\"include_media_info\\": false, \\n    \\"include_deleted\\": false, \\n    \\"include_has_explicit_shared_members\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'file';
                  name: 'Prime_Numbers.txt';
                  id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                  client_modified: '2015-05-12T15:50:38Z';
                  server_modified: '2015-05-12T15:50:38Z';
                  rev: 'a1c10ce0dd78';
                  size: 7212;
                  path_lower: '/homework/math/prime_numbers.txt';
                  path_display: '/Homework/math/Prime_Numbers.txt';
                  sharing_info: {
                    read_only: true;
                    parent_shared_folder_id: '84528192421';
                    modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                  };
                  is_downloadable: true;
                  property_groups: [
                    {
                      template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                      fields: [
                        {
                          name: 'Security Policy';
                          value: 'Confidential';
                        },
                      ];
                    },
                  ];
                  has_explicit_shared_members: false;
                  content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                  file_lock_info: {
                    is_lockholder: true;
                    lockholder_name: 'Imaginary User';
                    created: '2015-05-12T15:50:38Z';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/files/get_preview': {
      post: {
        tags: ['files'];
        summary: 'get_preview';
        description: '[get_preview](https://www.dropbox.com/developers/documentation/http/documentation#files-get_preview)\n\nscope: `files.content.read`\n\nGet a preview for a file.\nCurrently, PDF previews are generated for files with the following extensions: .ai, .doc, .docm, .docx, .eps, .gdoc, .gslides, .odp, .odt, .pps, .ppsm, .ppsx, .ppt, .pptm, .pptx, .rtf.\nHTML previews are generated for files with the following extensions: .csv, .ods, .xls, .xlsm, .gsheet, .xlsx.\nOther formats will return an unsupported extension error.      ';
        parameters: [
          {
            name: 'Dropbox-API-Arg';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: '{\n    "path": "/word.docx"\n}';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  name: 'Prime_Numbers.txt';
                  id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                  client_modified: '2015-05-12T15:50:38Z';
                  server_modified: '2015-05-12T15:50:38Z';
                  rev: 'a1c10ce0dd78';
                  size: 7212;
                  path_lower: '/homework/math/prime_numbers.txt';
                  path_display: '/Homework/math/Prime_Numbers.txt';
                  sharing_info: {
                    read_only: true;
                    parent_shared_folder_id: '84528192421';
                    modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                  };
                  is_downloadable: true;
                  property_groups: [
                    {
                      template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                      fields: [
                        {
                          name: 'Security Policy';
                          value: 'Confidential';
                        },
                      ];
                    },
                  ];
                  has_explicit_shared_members: false;
                  content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                  file_lock_info: {
                    is_lockholder: true;
                    lockholder_name: 'Imaginary User';
                    created: '2015-05-12T15:50:38Z';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/files/get_temporary_link': {
      post: {
        tags: ['files'];
        summary: 'get_temporary_link';
        description: "[get_temporary_link](https://www.dropbox.com/developers/documentation/http/documentation#files-get_temporary_link)\n\nscope: `files.content.read`\n\nGet a temporary link to stream content of a file. This link will expire in four hours and afterwards you will get 410 Gone. This URL should not be used to display content directly in the browser. The Content-Type of the link is determined automatically by the file's mime type.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"path\\": \\"/video.mp4\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  metadata: {
                    name: 'Prime_Numbers.txt';
                    id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                    client_modified: '2015-05-12T15:50:38Z';
                    server_modified: '2015-05-12T15:50:38Z';
                    rev: 'a1c10ce0dd78';
                    size: 7212;
                    path_lower: '/homework/math/prime_numbers.txt';
                    path_display: '/Homework/math/Prime_Numbers.txt';
                    sharing_info: {
                      read_only: true;
                      parent_shared_folder_id: '84528192421';
                      modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                    };
                    is_downloadable: true;
                    property_groups: [
                      {
                        template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                        fields: [
                          {
                            name: 'Security Policy';
                            value: 'Confidential';
                          },
                        ];
                      },
                    ];
                    has_explicit_shared_members: false;
                    content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                    file_lock_info: {
                      is_lockholder: true;
                      lockholder_name: 'Imaginary User';
                      created: '2015-05-12T15:50:38Z';
                    };
                  };
                  link: 'https://dl.dropboxusercontent.com/apitl/1/YXNkZmFzZGcyMzQyMzI0NjU2NDU2NDU2';
                };
              };
            };
          };
        };
      };
    };
    '/2/files/get_temporary_upload_link': {
      post: {
        tags: ['files'];
        summary: 'get_temporary_upload_link';
        description: '[get_temporary_upload_link](https://www.dropbox.com/developers/documentation/http/documentation#files-get_temporary_upload_link)\n\nscope: `files.content.write`\n\nGet a one-time use temporary upload link to upload a file to a Dropbox location.\n\nThis endpoint acts as a delayed `upload`. The returned temporary upload link may be used to make a POST request with the data to be uploaded. The upload will then be perfomed with the `CommitInfo` previously provided to `get_temporary_upload_link` but evaluated only upon consumption. Hence, errors stemming from invalid `CommitInfo` with respect to the state of the user\'s Dropbox will only be communicated at consumption time. Additionally, these errors are surfaced as generic HTTP 409 Conflict responses, potentially hiding issue details. The maximum temporary upload link duration is 4 hours. Upon consumption or expiration, a new link will have to be generated. Multiple links may exist for a specific upload path at any given time.\n\nThe POST request on the temporary upload link must have its Content-Type set to "application/octet-stream".\n\nExample temporary upload link consumption request:\n\ncurl -X POST https://content.dropboxapi.com/apitul/1/bNi2uIYF51cVBND\n--header "Content-Type: application/octet-stream"\n--data-binary @local_file.txt\n\nA successful temporary upload link consumption request returns the content hash of the uploaded data in JSON format.\n\nExample succesful temporary upload link consumption response:\n{"content-hash": "599d71033d700ac892a0e48fa61b125d2f5994"}\n\nAn unsuccessful temporary upload link consumption request returns any of the following status codes:\n\nHTTP 400 Bad Request: Content-Type is not one of application/octet-stream and text/plain or request is invalid.\nHTTP 409 Conflict: The temporary upload link does not exist or is currently unavailable, the upload failed, or another error happened.\nHTTP 410 Gone: The temporary upload link is expired or consumed.\n\nExample unsuccessful temporary upload link consumption response:\nTemporary upload link has been recently consumed.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"commit_info\\": {\\n        \\"path\\": \\"/Homework/math/Matrices.txt\\", \\n        \\"mode\\": \\"add\\", \\n        \\"autorename\\": true, \\n        \\"mute\\": false, \\n        \\"strict_conflict\\": false\\n    }, \\n    \\"duration\\": 3600\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  link: 'https://content.dropboxapi.com/apitul/1/bNi2uIYF51cVBND';
                };
              };
            };
          };
        };
      };
    };
    '/2/files/get_thumbnail_v2': {
      post: {
        tags: ['files'];
        summary: 'get_thumbnail';
        description: '[get_thumbnail](https://www.dropbox.com/developers/documentation/http/documentation#files-get_thumbnail)\n\nscope: `files.content.read`\n\nGet a thumbnail for a file.';
        parameters: [
          {
            name: 'Dropbox-API-Arg';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: '{\n    "resource": {\n        ".tag": "path", \n        "path": "/a.docx"\n    }, \n    "format": "jpeg", \n    "size": "w64h64", \n    "mode": "strict"\n}';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  file_metadata: {
                    name: 'Prime_Numbers.txt';
                    id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                    client_modified: '2015-05-12T15:50:38Z';
                    server_modified: '2015-05-12T15:50:38Z';
                    rev: 'a1c10ce0dd78';
                    size: 7212;
                    path_lower: '/homework/math/prime_numbers.txt';
                    path_display: '/Homework/math/Prime_Numbers.txt';
                    sharing_info: {
                      read_only: true;
                      parent_shared_folder_id: '84528192421';
                      modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                    };
                    is_downloadable: true;
                    property_groups: [
                      {
                        template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                        fields: [
                          {
                            name: 'Security Policy';
                            value: 'Confidential';
                          },
                        ];
                      },
                    ];
                    has_explicit_shared_members: false;
                    content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                    file_lock_info: {
                      is_lockholder: true;
                      lockholder_name: 'Imaginary User';
                      created: '2015-05-12T15:50:38Z';
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/files/get_thumbnail_batch': {
      post: {
        tags: ['files'];
        summary: 'get_thumbnail_batch';
        description: "[get_thumbnail_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-get_thumbnail_batch)\n\nscope: `files.content.read`\n\nGet thumbnails for a list of images. We allow up to 25 thumbnails in a single batch.\nThis method currently supports files with the following file extensions: jpg, jpeg, png, tiff, tif, gif and bmp. Photos that are larger than 20MB in size won't be converted to a thumbnail.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"entries\\": [\\n        {\\n            \\"path\\": \\"/image.jpg\\", \\n            \\"format\\": \\"jpeg\\", \\n            \\"size\\": \\"w64h64\\", \\n            \\"mode\\": \\"strict\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  entries: [
                    {
                      '.tag': 'success';
                      metadata: {
                        name: 'Prime_Numbers.txt';
                        id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                        client_modified: '2015-05-12T15:50:38Z';
                        server_modified: '2015-05-12T15:50:38Z';
                        rev: 'a1c10ce0dd78';
                        size: 7212;
                        path_lower: '/homework/math/prime_numbers.txt';
                        path_display: '/Homework/math/Prime_Numbers.txt';
                        sharing_info: {
                          read_only: true;
                          parent_shared_folder_id: '84528192421';
                          modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        };
                        is_downloadable: true;
                        property_groups: [
                          {
                            template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                            fields: [
                              {
                                name: 'Security Policy';
                                value: 'Confidential';
                              },
                            ];
                          },
                        ];
                        has_explicit_shared_members: false;
                        content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                        file_lock_info: {
                          is_lockholder: true;
                          lockholder_name: 'Imaginary User';
                          created: '2015-05-12T15:50:38Z';
                        };
                      };
                      thumbnail: 'iVBORw0KGgoAAAANSUhEUgAAAdcAAABrCAMAAAI=';
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/files/list_folder': {
      post: {
        tags: ['files'];
        summary: 'list_folder';
        description: "[list_folder](https://www.dropbox.com/developers/documentation/http/documentation#files-list_folder)\n\nscope: `files.metadata.read`\n\nStarts returning the contents of a folder. If the result's `ListFolderResult.has_more` field is `true`, call `list_folder/continue` with the returned `ListFolderResult.cursor` to retrieve more entries.\nIf you're using `ListFolderArg.recursive` set to `true` to keep a local cache of the contents of a Dropbox account, iterate through each entry in order and process them as follows to keep your local state in sync:\nFor each `FileMetadata`, store the new entry at the given path in your local state. If the required parent folders don't exist yet, create them. If there's already something else at the given path, replace it and remove all its children.\nFor each `FolderMetadata`, store the new entry at the given path in your local state. If the required parent folders don't exist yet, create them. If there's already something else at the given path, replace it but leave the children as they are. Check the new entry's `FolderSharingInfo.read_only` and set all its children's read-only statuses to match.\nFor each `DeletedMetadata`, if your local state has something at the given path, remove it and all its children. If there's nothing at the given path, ignore this entry.\nNote: `auth.RateLimitError` may be returned if multiple `list_folder` or `list_folder/continue` calls with same parameters are made simultaneously by same API app for same user. If your app implements retry logic, please hold off the retry until the previous request finishes.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"path\\": \\"/Homework/math\\", \\n    \\"recursive\\": false, \\n    \\"include_media_info\\": false, \\n    \\"include_deleted\\": false, \\n    \\"include_has_explicit_shared_members\\": false, \\n    \\"include_mounted_folders\\": true, \\n    \\"include_non_downloadable_files\\": true\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  entries: [
                    {
                      '.tag': 'file';
                      name: 'Prime_Numbers.txt';
                      id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                      client_modified: '2015-05-12T15:50:38Z';
                      server_modified: '2015-05-12T15:50:38Z';
                      rev: 'a1c10ce0dd78';
                      size: 7212;
                      path_lower: '/homework/math/prime_numbers.txt';
                      path_display: '/Homework/math/Prime_Numbers.txt';
                      sharing_info: {
                        read_only: true;
                        parent_shared_folder_id: '84528192421';
                        modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                      };
                      is_downloadable: true;
                      property_groups: [
                        {
                          template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                          fields: [
                            {
                              name: 'Security Policy';
                              value: 'Confidential';
                            },
                          ];
                        },
                      ];
                      has_explicit_shared_members: false;
                      content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                      file_lock_info: {
                        is_lockholder: true;
                        lockholder_name: 'Imaginary User';
                        created: '2015-05-12T15:50:38Z';
                      };
                    },
                    {
                      '.tag': 'folder';
                      name: 'math';
                      id: 'id:a4ayc_80_OEAAAAAAAAAXz';
                      path_lower: '/homework/math';
                      path_display: '/Homework/math';
                      sharing_info: {
                        read_only: false;
                        parent_shared_folder_id: '84528192421';
                        traverse_only: false;
                        no_access: false;
                      };
                      property_groups: [
                        {
                          template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                          fields: [
                            {
                              name: 'Security Policy';
                              value: 'Confidential';
                            },
                          ];
                        },
                      ];
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                  has_more: false;
                };
              };
            };
          };
        };
      };
    };
    '/2/files/list_folder/continue': {
      post: {
        tags: ['files'];
        summary: 'list_folder/continue';
        description: '[list_folder/continue](https://www.dropbox.com/developers/documentation/http/documentation#files-list_folder-continue)\n\nscope: `files.metadata.read`\n\nOnce a cursor has been retrieved from `list_folder`, use this to paginate through all files and retrieve updates to the folder, following the same rules as documented for `list_folder`.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  entries: [
                    {
                      '.tag': 'file';
                      name: 'Prime_Numbers.txt';
                      id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                      client_modified: '2015-05-12T15:50:38Z';
                      server_modified: '2015-05-12T15:50:38Z';
                      rev: 'a1c10ce0dd78';
                      size: 7212;
                      path_lower: '/homework/math/prime_numbers.txt';
                      path_display: '/Homework/math/Prime_Numbers.txt';
                      sharing_info: {
                        read_only: true;
                        parent_shared_folder_id: '84528192421';
                        modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                      };
                      is_downloadable: true;
                      property_groups: [
                        {
                          template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                          fields: [
                            {
                              name: 'Security Policy';
                              value: 'Confidential';
                            },
                          ];
                        },
                      ];
                      has_explicit_shared_members: false;
                      content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                      file_lock_info: {
                        is_lockholder: true;
                        lockholder_name: 'Imaginary User';
                        created: '2015-05-12T15:50:38Z';
                      };
                    },
                    {
                      '.tag': 'folder';
                      name: 'math';
                      id: 'id:a4ayc_80_OEAAAAAAAAAXz';
                      path_lower: '/homework/math';
                      path_display: '/Homework/math';
                      sharing_info: {
                        read_only: false;
                        parent_shared_folder_id: '84528192421';
                        traverse_only: false;
                        no_access: false;
                      };
                      property_groups: [
                        {
                          template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                          fields: [
                            {
                              name: 'Security Policy';
                              value: 'Confidential';
                            },
                          ];
                        },
                      ];
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                  has_more: false;
                };
              };
            };
          };
        };
      };
    };
    '/2/files/list_folder/get_latest_cursor': {
      post: {
        tags: ['files'];
        summary: 'list_folder/get_latest_cursor';
        description: "[list_folder/get_latest_cursor](https://www.dropbox.com/developers/documentation/http/documentation#files-list_folder-get_latest_cursor)\n\nscope: `files.metadata.read`\n\nA way to quickly get a cursor for the folder's state. Unlike `list_folder`, `list_folder/get_latest_cursor` doesn't return any entries. This endpoint is for app which only needs to know about new files and modifications and doesn't need to know about files that already exist in Dropbox.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"path\\": \\"/Homework/math\\", \\n    \\"recursive\\": false, \\n    \\"include_media_info\\": false, \\n    \\"include_deleted\\": false, \\n    \\"include_has_explicit_shared_members\\": false, \\n    \\"include_mounted_folders\\": true, \\n    \\"include_non_downloadable_files\\": true\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                };
              };
            };
          };
        };
      };
    };
    '/2/files/list_folder/longpoll': {
      post: {
        tags: ['files'];
        summary: 'list_folder/longpoll';
        description: "[list_folder/longpoll](https://www.dropbox.com/developers/documentation/http/documentation#files-list_folder-longpoll)\n\nscope: `files.metadata.read`\n\nA longpoll endpoint to wait for changes on an account. In conjunction with `list_folder/continue`, this call gives you a low-latency way to monitor an account for file changes. The connection will block until there are changes available or a timeout occurs. This endpoint is useful mostly for client-side apps. If you're looking for server-side notifications, check out our [webhooks documentation](https://www.dropbox.com/developers/reference/webhooks).";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu\\", \\n    \\"timeout\\": 30\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  changes: true;
                };
              };
            };
          };
        };
      };
    };
    '/2/files/list_revisions': {
      post: {
        tags: ['files'];
        summary: 'list_revisions';
        description: '[list_revisions](https://www.dropbox.com/developers/documentation/http/documentation#files-list_revisions)\n\nscope: `files.metadata.read`\n\nReturns revisions for files based on a file path or a file id. The file path or file id is identified from the latest file entry at the given file path or id. This end point allows your app to query either by file path or file id by setting the mode parameter appropriately.\nIn the `ListRevisionsMode.path` (default) mode, all revisions at the same file path as the latest file entry are returned. If revisions with the same file id are desired, then mode must be set to `ListRevisionsMode.id`. The `ListRevisionsMode.id` mode is useful to retrieve revisions for a given file across moves or renames.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"path\\": \\"/root/word.docx\\", \\n    \\"mode\\": \\"path\\", \\n    \\"limit\\": 10\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  is_deleted: false;
                  entries: [
                    {
                      name: 'Prime_Numbers.txt';
                      id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                      client_modified: '2015-05-12T15:50:38Z';
                      server_modified: '2015-05-12T15:50:38Z';
                      rev: 'a1c10ce0dd78';
                      size: 7212;
                      path_lower: '/homework/math/prime_numbers.txt';
                      path_display: '/Homework/math/Prime_Numbers.txt';
                      sharing_info: {
                        read_only: true;
                        parent_shared_folder_id: '84528192421';
                        modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                      };
                      is_downloadable: true;
                      property_groups: [
                        {
                          template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                          fields: [
                            {
                              name: 'Security Policy';
                              value: 'Confidential';
                            },
                          ];
                        },
                      ];
                      has_explicit_shared_members: false;
                      content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                      file_lock_info: {
                        is_lockholder: true;
                        lockholder_name: 'Imaginary User';
                        created: '2015-05-12T15:50:38Z';
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/files/lock_file_batch': {
      post: {
        tags: ['files'];
        summary: 'lock_file_batch';
        description: '[lock_file_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-lock_file_batch)\n\nscope: `files.content.write`\n\nLock the files at the given paths. A locked file will be writable only by the lock holder. A successful response indicates that the file has been locked. Returns a list of the locked file paths and their metadata after this operation.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"entries\\": [\\n        {\\n            \\"path\\": \\"/John Doe/sample/test.pdf\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  entries: [
                    {
                      '.tag': 'success';
                      metadata: {
                        '.tag': 'file';
                        name: 'Prime_Numbers.txt';
                        id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                        client_modified: '2015-05-12T15:50:38Z';
                        server_modified: '2015-05-12T15:50:38Z';
                        rev: 'a1c10ce0dd78';
                        size: 7212;
                        path_lower: '/homework/math/prime_numbers.txt';
                        path_display: '/Homework/math/Prime_Numbers.txt';
                        sharing_info: {
                          read_only: true;
                          parent_shared_folder_id: '84528192421';
                          modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        };
                        is_downloadable: true;
                        property_groups: [
                          {
                            template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                            fields: [
                              {
                                name: 'Security Policy';
                                value: 'Confidential';
                              },
                            ];
                          },
                        ];
                        has_explicit_shared_members: false;
                        content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                        file_lock_info: {
                          is_lockholder: true;
                          lockholder_name: 'Imaginary User';
                          created: '2015-05-12T15:50:38Z';
                        };
                      };
                      lock: {
                        content: {
                          '.tag': 'single_user';
                          created: '2015-05-12T15:50:38Z';
                          lock_holder_account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                          lock_holder_team_id: 'dbtid:1234abcd';
                        };
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/files/move_v2': {
      post: {
        tags: ['files'];
        summary: 'move';
        description: "[move](https://www.dropbox.com/developers/documentation/http/documentation#files-move)\n\nscope: `files.content.write`\n\nMove a file or folder to a different location in the user's Dropbox.\nIf the source path is a folder all its contents will be moved.\nNote that we do not currently support case-only renaming.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"from_path\\": \\"/Homework/math\\", \\n    \\"to_path\\": \\"/Homework/algebra\\", \\n    \\"allow_shared_folder\\": false, \\n    \\"autorename\\": false, \\n    \\"allow_ownership_transfer\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  metadata: {
                    '.tag': 'file';
                    name: 'Prime_Numbers.txt';
                    id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                    client_modified: '2015-05-12T15:50:38Z';
                    server_modified: '2015-05-12T15:50:38Z';
                    rev: 'a1c10ce0dd78';
                    size: 7212;
                    path_lower: '/homework/math/prime_numbers.txt';
                    path_display: '/Homework/math/Prime_Numbers.txt';
                    sharing_info: {
                      read_only: true;
                      parent_shared_folder_id: '84528192421';
                      modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                    };
                    is_downloadable: true;
                    property_groups: [
                      {
                        template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                        fields: [
                          {
                            name: 'Security Policy';
                            value: 'Confidential';
                          },
                        ];
                      },
                    ];
                    has_explicit_shared_members: false;
                    content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                    file_lock_info: {
                      is_lockholder: true;
                      lockholder_name: 'Imaginary User';
                      created: '2015-05-12T15:50:38Z';
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/files/move_batch_v2': {
      post: {
        tags: ['files'];
        summary: 'move_batch';
        description: "[move_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-move_batch)\n\nscope: `files.content.write`\n\nMove multiple files or folders to different locations at once in the user's Dropbox. Note that we do not currently support case-only renaming.\nThis route will replace `move_batch:1`. The main difference is this route will return status for each entry, while `move_batch:1` raises failure if any entry fails.\nThis route will either finish synchronously, or return a job ID and do the async move job in background. Please use `move_batch/check:2` to check the job status.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"entries\\": [\\n        {\\n            \\"from_path\\": \\"/Homework/math\\", \\n            \\"to_path\\": \\"/Homework/algebra\\"\\n        }\\n    ], \\n    \\"autorename\\": false, \\n    \\"allow_ownership_transfer\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  entries: [
                    {
                      '.tag': 'success';
                      success: {
                        '.tag': 'file';
                        name: 'Prime_Numbers.txt';
                        id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                        client_modified: '2015-05-12T15:50:38Z';
                        server_modified: '2015-05-12T15:50:38Z';
                        rev: 'a1c10ce0dd78';
                        size: 7212;
                        path_lower: '/homework/math/prime_numbers.txt';
                        path_display: '/Homework/math/Prime_Numbers.txt';
                        sharing_info: {
                          read_only: true;
                          parent_shared_folder_id: '84528192421';
                          modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        };
                        is_downloadable: true;
                        property_groups: [
                          {
                            template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                            fields: [
                              {
                                name: 'Security Policy';
                                value: 'Confidential';
                              },
                            ];
                          },
                        ];
                        has_explicit_shared_members: false;
                        content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                        file_lock_info: {
                          is_lockholder: true;
                          lockholder_name: 'Imaginary User';
                          created: '2015-05-12T15:50:38Z';
                        };
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/files/move_batch/check_v2': {
      post: {
        tags: ['files'];
        summary: 'move_batch/check';
        description: '[move_batch/check](https://www.dropbox.com/developers/documentation/http/documentation#files-move_batch-check)\n\nscope: `files.content.write`\n\nReturns the status of an asynchronous job for `move_batch:2`. It returns list of results for each entry.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"async_job_id\\": \\"34g93hh34h04y384084\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  entries: [
                    {
                      '.tag': 'success';
                      success: {
                        '.tag': 'file';
                        name: 'Prime_Numbers.txt';
                        id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                        client_modified: '2015-05-12T15:50:38Z';
                        server_modified: '2015-05-12T15:50:38Z';
                        rev: 'a1c10ce0dd78';
                        size: 7212;
                        path_lower: '/homework/math/prime_numbers.txt';
                        path_display: '/Homework/math/Prime_Numbers.txt';
                        sharing_info: {
                          read_only: true;
                          parent_shared_folder_id: '84528192421';
                          modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        };
                        is_downloadable: true;
                        property_groups: [
                          {
                            template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                            fields: [
                              {
                                name: 'Security Policy';
                                value: 'Confidential';
                              },
                            ];
                          },
                        ];
                        has_explicit_shared_members: false;
                        content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                        file_lock_info: {
                          is_lockholder: true;
                          lockholder_name: 'Imaginary User';
                          created: '2015-05-12T15:50:38Z';
                        };
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/files/permanently_delete': {
      post: {
        tags: ['files'];
        summary: 'permanently_delete';
        description: '[permanently_delete](https://www.dropbox.com/developers/documentation/http/documentation#files-permanently_delete)\n\nscope: `files.permanent_delete`\n\nPermanently delete the file or folder at a given path (see https://www.dropbox.com/en/help/40).\nNote: This endpoint is only available for Dropbox Business apps.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"path\\": \\"/Homework/math/Prime_Numbers.txt\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/files/restore': {
      post: {
        tags: ['files'];
        summary: 'restore';
        description: '[restore](https://www.dropbox.com/developers/documentation/http/documentation#files-restore)\n\nscope: `files.content.write`\n\nRestore a specific revision of a file to the given path.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"path\\": \\"/root/word.docx\\", \\n    \\"rev\\": \\"a1c10ce0dd78\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  name: 'Prime_Numbers.txt';
                  id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                  client_modified: '2015-05-12T15:50:38Z';
                  server_modified: '2015-05-12T15:50:38Z';
                  rev: 'a1c10ce0dd78';
                  size: 7212;
                  path_lower: '/homework/math/prime_numbers.txt';
                  path_display: '/Homework/math/Prime_Numbers.txt';
                  sharing_info: {
                    read_only: true;
                    parent_shared_folder_id: '84528192421';
                    modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                  };
                  is_downloadable: true;
                  property_groups: [
                    {
                      template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                      fields: [
                        {
                          name: 'Security Policy';
                          value: 'Confidential';
                        },
                      ];
                    },
                  ];
                  has_explicit_shared_members: false;
                  content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                  file_lock_info: {
                    is_lockholder: true;
                    lockholder_name: 'Imaginary User';
                    created: '2015-05-12T15:50:38Z';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/files/save_url': {
      post: {
        tags: ['files'];
        summary: 'save_url';
        description: "[save_url](https://www.dropbox.com/developers/documentation/http/documentation#files-save_url)\n\nscope: `files.content.write`\n\nSave the data from a specified URL into a file in user's Dropbox.\nNote that the transfer from the URL must complete within 5 minutes, or the operation will time out and the job will fail.\nIf the given path already exists, the file will be renamed to avoid the conflict (e.g. myfile (1).txt).";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"path\\": \\"/a.txt\\", \\n    \\"url\\": \\"http://example.com/a.txt\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  name: 'Prime_Numbers.txt';
                  id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                  client_modified: '2015-05-12T15:50:38Z';
                  server_modified: '2015-05-12T15:50:38Z';
                  rev: 'a1c10ce0dd78';
                  size: 7212;
                  path_lower: '/homework/math/prime_numbers.txt';
                  path_display: '/Homework/math/Prime_Numbers.txt';
                  sharing_info: {
                    read_only: true;
                    parent_shared_folder_id: '84528192421';
                    modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                  };
                  is_downloadable: true;
                  property_groups: [
                    {
                      template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                      fields: [
                        {
                          name: 'Security Policy';
                          value: 'Confidential';
                        },
                      ];
                    },
                  ];
                  has_explicit_shared_members: false;
                  content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                  file_lock_info: {
                    is_lockholder: true;
                    lockholder_name: 'Imaginary User';
                    created: '2015-05-12T15:50:38Z';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/files/save_url/check_job_status': {
      post: {
        tags: ['files'];
        summary: 'save_url/check_job_status';
        description: '[save_url/check_job_status](https://www.dropbox.com/developers/documentation/http/documentation#files-save_url-check_job_status)\n\nscope: `files.content.write`\n\nCheck the status of a `save_url` job.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"async_job_id\\": \\"34g93hh34h04y384084\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'in_progress';
                };
              };
            };
          };
        };
      };
    };
    '/2/files/search_v2': {
      post: {
        tags: ['files'];
        summary: 'search';
        description: '[search](https://www.dropbox.com/developers/documentation/http/documentation#files-search)\n\nscope: `files.metadata.read`\n\nSearches for files and folders.\nNote: `search:2` along with `search/continue:2` can only be used to retrieve a maximum of 10,000 matches.\nRecent changes may not immediately be reflected in search results due to a short delay in indexing. Duplicate results may be returned across pages. Some results may not be returned.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"query\\": \\"cat\\", \\n    \\"include_highlights\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  matches: [
                    {
                      metadata: {
                        '.tag': 'metadata';
                        metadata: {
                          '.tag': 'file';
                          name: 'Prime_Numbers.txt';
                          id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                          client_modified: '2015-05-12T15:50:38Z';
                          server_modified: '2015-05-12T15:50:38Z';
                          rev: 'a1c10ce0dd78';
                          size: 7212;
                          path_lower: '/homework/math/prime_numbers.txt';
                          path_display: '/Homework/math/Prime_Numbers.txt';
                          sharing_info: {
                            read_only: true;
                            parent_shared_folder_id: '84528192421';
                            modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                          };
                          is_downloadable: true;
                          property_groups: [
                            {
                              template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                              fields: [
                                {
                                  name: 'Security Policy';
                                  value: 'Confidential';
                                },
                              ];
                            },
                          ];
                          has_explicit_shared_members: false;
                          content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                          file_lock_info: {
                            is_lockholder: true;
                            lockholder_name: 'Imaginary User';
                            created: '2015-05-12T15:50:38Z';
                          };
                        };
                      };
                    },
                  ];
                  has_more: false;
                };
              };
            };
          };
        };
      };
    };
    '/2/files/search/continue_v2': {
      post: {
        tags: ['files'];
        summary: 'search/continue';
        description: '[search/continue](https://www.dropbox.com/developers/documentation/http/documentation#files-search-continue)\n\nscope: `files.metadata.read`\n\nFetches the next page of search results returned from `search:2`.\nNote: `search:2` along with `search/continue:2` can only be used to retrieve a maximum of 10,000 matches.\nRecent changes may not immediately be reflected in search results due to a short delay in indexing. Duplicate results may be returned across pages. Some results may not be returned.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  matches: [
                    {
                      metadata: {
                        '.tag': 'metadata';
                        metadata: {
                          '.tag': 'file';
                          name: 'Prime_Numbers.txt';
                          id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                          client_modified: '2015-05-12T15:50:38Z';
                          server_modified: '2015-05-12T15:50:38Z';
                          rev: 'a1c10ce0dd78';
                          size: 7212;
                          path_lower: '/homework/math/prime_numbers.txt';
                          path_display: '/Homework/math/Prime_Numbers.txt';
                          sharing_info: {
                            read_only: true;
                            parent_shared_folder_id: '84528192421';
                            modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                          };
                          is_downloadable: true;
                          property_groups: [
                            {
                              template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                              fields: [
                                {
                                  name: 'Security Policy';
                                  value: 'Confidential';
                                },
                              ];
                            },
                          ];
                          has_explicit_shared_members: false;
                          content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                          file_lock_info: {
                            is_lockholder: true;
                            lockholder_name: 'Imaginary User';
                            created: '2015-05-12T15:50:38Z';
                          };
                        };
                      };
                    },
                  ];
                  has_more: false;
                };
              };
            };
          };
        };
      };
    };
    '/2/files/unlock_file_batch': {
      post: {
        tags: ['files'];
        summary: 'unlock_file_batch';
        description: '[unlock_file_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-unlock_file_batch)\n\nscope: `files.content.write`\n\nUnlock the files at the given paths. A locked file can only be unlocked by the lock holder or, if a business account, a team admin. A successful response indicates that the file has been unlocked. Returns a list of the unlocked file paths and their metadata after this operation.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"entries\\": [\\n        {\\n            \\"path\\": \\"/John Doe/sample/test.pdf\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  entries: [
                    {
                      '.tag': 'success';
                      metadata: {
                        '.tag': 'file';
                        name: 'Prime_Numbers.txt';
                        id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                        client_modified: '2015-05-12T15:50:38Z';
                        server_modified: '2015-05-12T15:50:38Z';
                        rev: 'a1c10ce0dd78';
                        size: 7212;
                        path_lower: '/homework/math/prime_numbers.txt';
                        path_display: '/Homework/math/Prime_Numbers.txt';
                        sharing_info: {
                          read_only: true;
                          parent_shared_folder_id: '84528192421';
                          modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        };
                        is_downloadable: true;
                        property_groups: [
                          {
                            template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                            fields: [
                              {
                                name: 'Security Policy';
                                value: 'Confidential';
                              },
                            ];
                          },
                        ];
                        has_explicit_shared_members: false;
                        content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                        file_lock_info: {
                          is_lockholder: true;
                          lockholder_name: 'Imaginary User';
                          created: '2015-05-12T15:50:38Z';
                        };
                      };
                      lock: {
                        content: {
                          '.tag': 'single_user';
                          created: '2015-05-12T15:50:38Z';
                          lock_holder_account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                          lock_holder_team_id: 'dbtid:1234abcd';
                        };
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/files/upload': {
      post: {
        tags: ['files'];
        summary: 'upload';
        description: '[upload](https://www.dropbox.com/developers/documentation/http/documentation#files-upload)\n\nscope: `files.content.write`\n\nCreate a new file with the contents provided in the request.\nDo not use this to upload a file larger than 150 MB. Instead, create an upload session with `upload_session/start`.\nCalls to this endpoint will count as data transport calls for any Dropbox Business teams with a limit on the number of data transport calls allowed per month. For more information, see the [Data transport limit page](https://www.dropbox.com/developers/reference/data-transport-limit).      ';
        parameters: [
          {
            name: 'Dropbox-API-Arg';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: '{\n    "path": "/Homework/math/Matrices.txt", \n    "mode": "add", \n    "autorename": true, \n    "mute": false, \n    "strict_conflict": false\n}';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  name: 'Prime_Numbers.txt';
                  id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                  client_modified: '2015-05-12T15:50:38Z';
                  server_modified: '2015-05-12T15:50:38Z';
                  rev: 'a1c10ce0dd78';
                  size: 7212;
                  path_lower: '/homework/math/prime_numbers.txt';
                  path_display: '/Homework/math/Prime_Numbers.txt';
                  sharing_info: {
                    read_only: true;
                    parent_shared_folder_id: '84528192421';
                    modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                  };
                  is_downloadable: true;
                  property_groups: [
                    {
                      template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                      fields: [
                        {
                          name: 'Security Policy';
                          value: 'Confidential';
                        },
                      ];
                    },
                  ];
                  has_explicit_shared_members: false;
                  content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                  file_lock_info: {
                    is_lockholder: true;
                    lockholder_name: 'Imaginary User';
                    created: '2015-05-12T15:50:38Z';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/files/upload_session/append_v2': {
      post: {
        tags: ['files'];
        summary: 'upload_session/append';
        description: '[upload_session/append](https://www.dropbox.com/developers/documentation/http/documentation#files-upload_session-append)\n\nscope: `files.content.write`\n\nAppend more data to an upload session.\nWhen the parameter close is set, this call will close the session.\nA single request should not upload more than 150 MB. The maximum size of a file one can upload to an upload session is 350 GB.\nCalls to this endpoint will count as data transport calls for any Dropbox Business teams with a limit on the number of data transport calls allowed per month. For more information, see the [Data transport limit page](https://www.dropbox.com/developers/reference/data-transport-limit).      ';
        parameters: [
          {
            name: 'Dropbox-API-Arg';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: '{\n    "cursor": {\n        "session_id": "1234faaf0678bcde", \n        "offset": 0\n    }, \n    "close": false\n}';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/files/upload_session/finish': {
      post: {
        tags: ['files'];
        summary: 'upload_session/finish';
        description: '[upload_session/finish](https://www.dropbox.com/developers/documentation/http/documentation#files-upload_session-finish)\n\nscope: `files.content.write`\n\nFinish an upload session and save the uploaded data to the given file path.\nA single request should not upload more than 150 MB. The maximum size of a file one can upload to an upload session is 350 GB.\nCalls to this endpoint will count as data transport calls for any Dropbox Business teams with a limit on the number of data transport calls allowed per month. For more information, see the [Data transport limit page](https://www.dropbox.com/developers/reference/data-transport-limit).      ';
        parameters: [
          {
            name: 'Dropbox-API-Arg';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: '{\n    "cursor": {\n        "session_id": "1234faaf0678bcde", \n        "offset": 0\n    }, \n    "commit": {\n        "path": "/Homework/math/Matrices.txt", \n        "mode": "add", \n        "autorename": true, \n        "mute": false, \n        "strict_conflict": false\n    }\n}';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  name: 'Prime_Numbers.txt';
                  id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                  client_modified: '2015-05-12T15:50:38Z';
                  server_modified: '2015-05-12T15:50:38Z';
                  rev: 'a1c10ce0dd78';
                  size: 7212;
                  path_lower: '/homework/math/prime_numbers.txt';
                  path_display: '/Homework/math/Prime_Numbers.txt';
                  sharing_info: {
                    read_only: true;
                    parent_shared_folder_id: '84528192421';
                    modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                  };
                  is_downloadable: true;
                  property_groups: [
                    {
                      template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                      fields: [
                        {
                          name: 'Security Policy';
                          value: 'Confidential';
                        },
                      ];
                    },
                  ];
                  has_explicit_shared_members: false;
                  content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                  file_lock_info: {
                    is_lockholder: true;
                    lockholder_name: 'Imaginary User';
                    created: '2015-05-12T15:50:38Z';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/files/upload_session/finish_batch': {
      post: {
        tags: ['files'];
        summary: 'upload_session/finish_batch';
        description: "[upload_session/finish_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-upload_session-finish_batch)\n\nscope: `files.content.write`\n\nThis route helps you commit many files at once into a user's Dropbox. Use `upload_session/start` and `upload_session/append:2` to upload file contents. We recommend uploading many files in parallel to increase throughput. Once the file contents have been uploaded, rather than calling `upload_session/finish`, use this route to finish all your upload sessions in a single request.\n`UploadSessionStartArg.close` or `UploadSessionAppendArg.close` needs to be true for the last `upload_session/start` or `upload_session/append:2` call. The maximum size of a file one can upload to an upload session is 350 GB.\nThis route will return a job_id immediately and do the async commit job in background. Use `upload_session/finish_batch/check` to check the job status.\nFor the same account, this route should be executed serially. That means you should not start the next job before current job finishes. We allow up to 1000 entries in a single request.\nCalls to this endpoint will count as data transport calls for any Dropbox Business teams with a limit on the number of data transport calls allowed per month. For more information, see the [Data transport limit page](https://www.dropbox.com/developers/reference/data-transport-limit).";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"entries\\": [\\n        {\\n            \\"cursor\\": {\\n                \\"session_id\\": \\"1234faaf0678bcde\\", \\n                \\"offset\\": 0\\n            }, \\n            \\"commit\\": {\\n                \\"path\\": \\"/Homework/math/Matrices.txt\\", \\n                \\"mode\\": \\"add\\", \\n                \\"autorename\\": true, \\n                \\"mute\\": false, \\n                \\"strict_conflict\\": false\\n            }\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  entries: [
                    {
                      '.tag': 'success';
                      name: 'Prime_Numbers.txt';
                      id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                      client_modified: '2015-05-12T15:50:38Z';
                      server_modified: '2015-05-12T15:50:38Z';
                      rev: 'a1c10ce0dd78';
                      size: 7212;
                      path_lower: '/homework/math/prime_numbers.txt';
                      path_display: '/Homework/math/Prime_Numbers.txt';
                      sharing_info: {
                        read_only: true;
                        parent_shared_folder_id: '84528192421';
                        modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                      };
                      is_downloadable: true;
                      property_groups: [
                        {
                          template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                          fields: [
                            {
                              name: 'Security Policy';
                              value: 'Confidential';
                            },
                          ];
                        },
                      ];
                      has_explicit_shared_members: false;
                      content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                      file_lock_info: {
                        is_lockholder: true;
                        lockholder_name: 'Imaginary User';
                        created: '2015-05-12T15:50:38Z';
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/files/upload_session/finish_batch/check': {
      post: {
        tags: ['files'];
        summary: 'upload_session/finish_batch/check';
        description: '[upload_session/finish_batch/check](https://www.dropbox.com/developers/documentation/http/documentation#files-upload_session-finish_batch-check)\n\nscope: `files.content.write`\n\nReturns the status of an asynchronous job for `upload_session/finish_batch`. If success, it returns list of result for each entry.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"async_job_id\\": \\"34g93hh34h04y384084\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  entries: [
                    {
                      '.tag': 'success';
                      name: 'Prime_Numbers.txt';
                      id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                      client_modified: '2015-05-12T15:50:38Z';
                      server_modified: '2015-05-12T15:50:38Z';
                      rev: 'a1c10ce0dd78';
                      size: 7212;
                      path_lower: '/homework/math/prime_numbers.txt';
                      path_display: '/Homework/math/Prime_Numbers.txt';
                      sharing_info: {
                        read_only: true;
                        parent_shared_folder_id: '84528192421';
                        modified_by: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                      };
                      is_downloadable: true;
                      property_groups: [
                        {
                          template_id: 'ptid:1a5n2i6d3OYEAAAAAAAAAYa';
                          fields: [
                            {
                              name: 'Security Policy';
                              value: 'Confidential';
                            },
                          ];
                        },
                      ];
                      has_explicit_shared_members: false;
                      content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                      file_lock_info: {
                        is_lockholder: true;
                        lockholder_name: 'Imaginary User';
                        created: '2015-05-12T15:50:38Z';
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/files/upload_session/start': {
      post: {
        tags: ['files'];
        summary: 'upload_session/start';
        description: '[upload_session/start](https://www.dropbox.com/developers/documentation/http/documentation#files-upload_session-start)\n\nscope: `files.content.write`\n\nUpload sessions allow you to upload a single file in one or more requests, for example where the size of the file is greater than 150 MB.  This call starts a new upload session with the given data. You can then use `upload_session/append:2` to add more data and `upload_session/finish` to save all the data to a file in Dropbox.\nA single request should not upload more than 150 MB. The maximum size of a file one can upload to an upload session is 350 GB.\nAn upload session can be used for a maximum of 48 hours. Attempting to use an `UploadSessionStartResult.session_id` with `upload_session/append:2` or `upload_session/finish` more than 48 hours after its creation will return a `UploadSessionLookupError.not_found`.\nCalls to this endpoint will count as data transport calls for any Dropbox Business teams with a limit on the number of data transport calls allowed per month. For more information, see the [Data transport limit page](https://www.dropbox.com/developers/reference/data-transport-limit)      ';
        parameters: [
          {
            name: 'Dropbox-API-Arg';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: '{\n    "close": false\n}';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  session_id: '1234faaf0678bcde';
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/add_file_member': {
      post: {
        tags: ['sharing'];
        summary: 'add_file_member';
        description: '[add_file_member](https://www.dropbox.com/developers/documentation/http/documentation#sharing-add_file_member)\n\nscope: `sharing.write`\n\nAdds specified members to a file.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"file\\": \\"id:3kmLmQFnf1AAAAAAAAAAAw\\", \\n    \\"members\\": [\\n        {\\n            \\".tag\\": \\"email\\", \\n            \\"email\\": \\"justin@example.com\\"\\n        }\\n    ], \\n    \\"custom_message\\": \\"This is a custom message about ACME.doc\\", \\n    \\"quiet\\": false, \\n    \\"access_level\\": \\"viewer\\", \\n    \\"add_message_as_comment\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: [
                  {
                    member: {
                      '.tag': 'email';
                      email: 'justin@example.com';
                    };
                    result: {
                      '.tag': 'success';
                    };
                  },
                ];
              };
            };
          };
        };
      };
    };
    '/2/sharing/add_folder_member': {
      post: {
        tags: ['sharing'];
        summary: 'add_folder_member';
        description: '[add_folder_member](https://www.dropbox.com/developers/documentation/http/documentation#sharing-add_folder_member)\n\nscope: `sharing.write`\n\nAllows an owner or editor (if the ACL update policy allows) of a shared folder to add another member.\nFor the new member to get access to all the functionality for this folder, you will need to call `mount_folder` on their behalf.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"shared_folder_id\\": \\"84528192421\\", \\n    \\"members\\": [\\n        {\\n            \\"member\\": {\\n                \\".tag\\": \\"email\\", \\n                \\"email\\": \\"justin@example.com\\"\\n            }, \\n            \\"access_level\\": \\"editor\\"\\n        }, \\n        {\\n            \\"member\\": {\\n                \\".tag\\": \\"dropbox_id\\", \\n                \\"dropbox_id\\": \\"dbid:AAEufNrMPSPe0dMQijRP0N_aZtBJRm26W4Q\\"\\n            }, \\n            \\"access_level\\": \\"viewer\\"\\n        }\\n    ], \\n    \\"quiet\\": false, \\n    \\"custom_message\\": \\"Documentation for launch day\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/sharing/check_job_status': {
      post: {
        tags: ['sharing'];
        summary: 'check_job_status';
        description: '[check_job_status](https://www.dropbox.com/developers/documentation/http/documentation#sharing-check_job_status)\n\nscope: `sharing.write`\n\nReturns the status of an asynchronous job.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"async_job_id\\": \\"34g93hh34h04y384084\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'in_progress';
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/check_remove_member_job_status': {
      post: {
        tags: ['sharing'];
        summary: 'check_remove_member_job_status';
        description: '[check_remove_member_job_status](https://www.dropbox.com/developers/documentation/http/documentation#sharing-check_remove_member_job_status)\n\nscope: `sharing.write`\n\nReturns the status of an asynchronous job for sharing a folder.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"async_job_id\\": \\"34g93hh34h04y384084\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/check_share_job_status': {
      post: {
        tags: ['sharing'];
        summary: 'check_share_job_status';
        description: '[check_share_job_status](https://www.dropbox.com/developers/documentation/http/documentation#sharing-check_share_job_status)\n\nscope: `sharing.write`\n\nReturns the status of an asynchronous job for sharing a folder.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"async_job_id\\": \\"34g93hh34h04y384084\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  access_type: {
                    '.tag': 'owner';
                  };
                  is_inside_team_folder: false;
                  is_team_folder: false;
                  name: 'dir';
                  policy: {
                    acl_update_policy: {
                      '.tag': 'owner';
                    };
                    shared_link_policy: {
                      '.tag': 'anyone';
                    };
                    member_policy: {
                      '.tag': 'anyone';
                    };
                    resolved_member_policy: {
                      '.tag': 'team';
                    };
                  };
                  preview_url: 'https://www.dropbox.com/scl/fo/fir9vjelf';
                  shared_folder_id: '84528192421';
                  time_invited: '2016-01-20T00:00:00Z';
                  path_lower: '/dir';
                  link_metadata: {
                    audience_options: [
                      {
                        '.tag': 'public';
                      },
                      {
                        '.tag': 'team';
                      },
                      {
                        '.tag': 'members';
                      },
                    ];
                    current_audience: {
                      '.tag': 'public';
                    };
                    link_permissions: [
                      {
                        action: {
                          '.tag': 'change_audience';
                        };
                        allow: true;
                      },
                    ];
                    password_protected: false;
                    url: '';
                  };
                  permissions: [];
                  access_inheritance: {
                    '.tag': 'inherit';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/get_file_metadata': {
      post: {
        tags: ['sharing'];
        summary: 'get_file_metadata';
        description: '[get_file_metadata](https://www.dropbox.com/developers/documentation/http/documentation#sharing-get_file_metadata)\n\nscope: `sharing.read`\n\nReturns shared file metadata.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"file\\": \\"id:3kmLmQFnf1AAAAAAAAAAAw\\", \\n    \\"actions\\": []\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  id: 'id:3kmLmQFnf1AAAAAAAAAAAw';
                  name: 'file.txt';
                  policy: {
                    acl_update_policy: {
                      '.tag': 'owner';
                    };
                    shared_link_policy: {
                      '.tag': 'anyone';
                    };
                    member_policy: {
                      '.tag': 'anyone';
                    };
                    resolved_member_policy: {
                      '.tag': 'team';
                    };
                  };
                  preview_url: 'https://www.dropbox.com/scl/fi/fir9vjelf';
                  access_type: {
                    '.tag': 'viewer';
                  };
                  owner_display_names: ['Jane Doe'];
                  owner_team: {
                    id: 'dbtid:AAFdgehTzw7WlXhZJsbGCLePe8RvQGYDr-I';
                    name: 'Acme, Inc.';
                  };
                  path_display: '/dir/file.txt';
                  path_lower: '/dir/file.txt';
                  permissions: [];
                  time_invited: '2016-01-20T00:00:00Z';
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/get_file_metadata/batch': {
      post: {
        tags: ['sharing'];
        summary: 'get_file_metadata/batch';
        description: '[get_file_metadata/batch](https://www.dropbox.com/developers/documentation/http/documentation#sharing-get_file_metadata-batch)\n\nscope: `sharing.read`\n\nReturns shared file metadata.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"files\\": [\\n        \\"id:3kmLmQFnf1AAAAAAAAAAAw\\", \\n        \\"id:VvTaJu2VZzAAAAAAAAAADQ\\"\\n    ], \\n    \\"actions\\": []\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: [
                  {
                    file: 'id:3kmLmQFnf1AAAAAAAAAAAw';
                    result: {
                      '.tag': 'metadata';
                      id: 'id:3kmLmQFnf1AAAAAAAAAAAw';
                      name: 'file.txt';
                      policy: {
                        acl_update_policy: {
                          '.tag': 'owner';
                        };
                        shared_link_policy: {
                          '.tag': 'anyone';
                        };
                        member_policy: {
                          '.tag': 'anyone';
                        };
                        resolved_member_policy: {
                          '.tag': 'team';
                        };
                      };
                      preview_url: 'https://www.dropbox.com/scl/fi/fir9vjelf';
                      access_type: {
                        '.tag': 'viewer';
                      };
                      owner_display_names: ['Jane Doe'];
                      owner_team: {
                        id: 'dbtid:AAFdgehTzw7WlXhZJsbGCLePe8RvQGYDr-I';
                        name: 'Acme, Inc.';
                      };
                      path_display: '/dir/file.txt';
                      path_lower: '/dir/file.txt';
                      permissions: [];
                      time_invited: '2016-01-20T00:00:00Z';
                    };
                  },
                ];
              };
            };
          };
        };
      };
    };
    '/2/sharing/get_folder_metadata': {
      post: {
        tags: ['sharing'];
        summary: 'get_folder_metadata';
        description: '[get_folder_metadata](https://www.dropbox.com/developers/documentation/http/documentation#sharing-get_folder_metadata)\n\nscope: `sharing.read`\n\nReturns shared folder metadata by its folder ID.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"shared_folder_id\\": \\"84528192421\\", \\n    \\"actions\\": []\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  access_type: {
                    '.tag': 'owner';
                  };
                  is_inside_team_folder: false;
                  is_team_folder: false;
                  name: 'dir';
                  policy: {
                    acl_update_policy: {
                      '.tag': 'owner';
                    };
                    shared_link_policy: {
                      '.tag': 'anyone';
                    };
                    member_policy: {
                      '.tag': 'anyone';
                    };
                    resolved_member_policy: {
                      '.tag': 'team';
                    };
                  };
                  preview_url: 'https://www.dropbox.com/scl/fo/fir9vjelf';
                  shared_folder_id: '84528192421';
                  time_invited: '2016-01-20T00:00:00Z';
                  path_lower: '/dir';
                  link_metadata: {
                    audience_options: [
                      {
                        '.tag': 'public';
                      },
                      {
                        '.tag': 'team';
                      },
                      {
                        '.tag': 'members';
                      },
                    ];
                    current_audience: {
                      '.tag': 'public';
                    };
                    link_permissions: [
                      {
                        action: {
                          '.tag': 'change_audience';
                        };
                        allow: true;
                      },
                    ];
                    password_protected: false;
                    url: '';
                  };
                  permissions: [];
                  access_inheritance: {
                    '.tag': 'inherit';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/get_shared_link_file': {
      post: {
        tags: ['sharing'];
        summary: 'get_shared_link_file';
        description: "[get_shared_link_file](https://www.dropbox.com/developers/documentation/http/documentation#sharing-get_shared_link_file)\n\nscope: `sharing.read`\n\nDownload the shared link's file from a user's Dropbox.      ";
        parameters: [
          {
            name: 'Dropbox-API-Arg';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: '{\n    "url": "https://www.dropbox.com/s/2sn712vy1ovegw8/Prime_Numbers.txt?dl=0", \n    "path": "/Prime_Numbers.txt"\n}';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'file';
                  url: 'https://www.dropbox.com/s/2sn712vy1ovegw8/Prime_Numbers.txt?dl=0';
                  name: 'Prime_Numbers.txt';
                  link_permissions: {
                    can_revoke: false;
                    resolved_visibility: {
                      '.tag': 'public';
                    };
                    revoke_failure_reason: {
                      '.tag': 'owner_only';
                    };
                  };
                  client_modified: '2015-05-12T15:50:38Z';
                  server_modified: '2015-05-12T15:50:38Z';
                  rev: 'a1c10ce0dd78';
                  size: 7212;
                  id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                  path_lower: '/homework/math/prime_numbers.txt';
                  team_member_info: {
                    team_info: {
                      id: 'dbtid:AAFdgehTzw7WlXhZJsbGCLePe8RvQGYDr-I';
                      name: 'Acme, Inc.';
                    };
                    display_name: 'Roger Rabbit';
                    member_id: 'dbmid:abcd1234';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/get_shared_link_metadata': {
      post: {
        tags: ['sharing'];
        summary: 'get_shared_link_metadata';
        description: "[get_shared_link_metadata](https://www.dropbox.com/developers/documentation/http/documentation#sharing-get_shared_link_metadata)\n\nscope: `sharing.read`\n\nGet the shared link's metadata.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"url\\": \\"https://www.dropbox.com/s/2sn712vy1ovegw8/Prime_Numbers.txt?dl=0\\", \\n    \\"path\\": \\"/Prime_Numbers.txt\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'file';
                  url: 'https://www.dropbox.com/s/2sn712vy1ovegw8/Prime_Numbers.txt?dl=0';
                  name: 'Prime_Numbers.txt';
                  link_permissions: {
                    can_revoke: false;
                    resolved_visibility: {
                      '.tag': 'public';
                    };
                    revoke_failure_reason: {
                      '.tag': 'owner_only';
                    };
                  };
                  client_modified: '2015-05-12T15:50:38Z';
                  server_modified: '2015-05-12T15:50:38Z';
                  rev: 'a1c10ce0dd78';
                  size: 7212;
                  id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                  path_lower: '/homework/math/prime_numbers.txt';
                  team_member_info: {
                    team_info: {
                      id: 'dbtid:AAFdgehTzw7WlXhZJsbGCLePe8RvQGYDr-I';
                      name: 'Acme, Inc.';
                    };
                    display_name: 'Roger Rabbit';
                    member_id: 'dbmid:abcd1234';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/list_file_members': {
      post: {
        tags: ['sharing'];
        summary: 'list_file_members';
        description: '[list_file_members](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_file_members)\n\nscope: `sharing.read`\n\nUse to obtain the members who have been invited to a file, both inherited and uninherited members.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"file\\": \\"id:3kmLmQFnf1AAAAAAAAAAAw\\", \\n    \\"include_inherited\\": true, \\n    \\"limit\\": 100\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  users: [
                    {
                      access_type: {
                        '.tag': 'owner';
                      };
                      user: {
                        account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        email: 'bob@example.com';
                        display_name: 'Robert Smith';
                        same_team: true;
                        team_member_id: 'dbmid:abcd1234';
                      };
                      permissions: [];
                      is_inherited: false;
                      time_last_seen: '2016-01-20T00:00:00Z';
                      platform_type: {
                        '.tag': 'unknown';
                      };
                    },
                  ];
                  groups: [
                    {
                      access_type: {
                        '.tag': 'editor';
                      };
                      group: {
                        group_name: 'Test group';
                        group_id: 'g:e2db7665347abcd600000000001a2b3c';
                        group_management_type: {
                          '.tag': 'user_managed';
                        };
                        group_type: {
                          '.tag': 'user_managed';
                        };
                        is_member: false;
                        is_owner: false;
                        same_team: true;
                        member_count: 10;
                      };
                      permissions: [];
                      is_inherited: false;
                    },
                  ];
                  invitees: [
                    {
                      access_type: {
                        '.tag': 'viewer';
                      };
                      invitee: {
                        '.tag': 'email';
                        email: 'jessica@example.com';
                      };
                      permissions: [];
                      is_inherited: false;
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/list_file_members/batch': {
      post: {
        tags: ['sharing'];
        summary: 'list_file_members/batch';
        description: '[list_file_members/batch](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_file_members-batch)\n\nscope: `sharing.read`\n\nGet members of multiple files at once. The arguments to this route are more limited, and the limit on query result size per file is more strict. To customize the results more, use the individual file endpoint.\nInherited users and groups are not included in the result, and permissions are not returned for this endpoint.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"files\\": [\\n        \\"id:3kmLmQFnf1AAAAAAAAAAAw\\", \\n        \\"id:VvTaJu2VZzAAAAAAAAAADQ\\"\\n    ], \\n    \\"limit\\": 10\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: [
                  {
                    file: 'id:3kmLmQFnf1AAAAAAAAAAAw';
                    result: {
                      '.tag': 'result';
                      members: {
                        users: [
                          {
                            access_type: {
                              '.tag': 'owner';
                            };
                            user: {
                              account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                              email: 'bob@example.com';
                              display_name: 'Robert Smith';
                              same_team: true;
                              team_member_id: 'dbmid:abcd1234';
                            };
                            permissions: [];
                            is_inherited: false;
                            time_last_seen: '2016-01-20T00:00:00Z';
                            platform_type: {
                              '.tag': 'unknown';
                            };
                          },
                        ];
                        groups: [
                          {
                            access_type: {
                              '.tag': 'editor';
                            };
                            group: {
                              group_name: 'Test group';
                              group_id: 'g:e2db7665347abcd600000000001a2b3c';
                              group_management_type: {
                                '.tag': 'user_managed';
                              };
                              group_type: {
                                '.tag': 'user_managed';
                              };
                              is_member: false;
                              is_owner: false;
                              same_team: true;
                              member_count: 10;
                            };
                            permissions: [];
                            is_inherited: false;
                          },
                        ];
                        invitees: [
                          {
                            access_type: {
                              '.tag': 'viewer';
                            };
                            invitee: {
                              '.tag': 'email';
                              email: 'jessica@example.com';
                            };
                            permissions: [];
                            is_inherited: false;
                          },
                        ];
                      };
                      member_count: 3;
                    };
                  },
                ];
              };
            };
          };
        };
      };
    };
    '/2/sharing/list_file_members/continue': {
      post: {
        tags: ['sharing'];
        summary: 'list_file_members/continue';
        description: '[list_file_members/continue](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_file_members-continue)\n\nscope: `sharing.read`\n\nOnce a cursor has been retrieved from `list_file_members` or `list_file_members/batch`, use this to paginate through all shared file members.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  users: [
                    {
                      access_type: {
                        '.tag': 'owner';
                      };
                      user: {
                        account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        email: 'bob@example.com';
                        display_name: 'Robert Smith';
                        same_team: true;
                        team_member_id: 'dbmid:abcd1234';
                      };
                      permissions: [];
                      is_inherited: false;
                      time_last_seen: '2016-01-20T00:00:00Z';
                      platform_type: {
                        '.tag': 'unknown';
                      };
                    },
                  ];
                  groups: [
                    {
                      access_type: {
                        '.tag': 'editor';
                      };
                      group: {
                        group_name: 'Test group';
                        group_id: 'g:e2db7665347abcd600000000001a2b3c';
                        group_management_type: {
                          '.tag': 'user_managed';
                        };
                        group_type: {
                          '.tag': 'user_managed';
                        };
                        is_member: false;
                        is_owner: false;
                        same_team: true;
                        member_count: 10;
                      };
                      permissions: [];
                      is_inherited: false;
                    },
                  ];
                  invitees: [
                    {
                      access_type: {
                        '.tag': 'viewer';
                      };
                      invitee: {
                        '.tag': 'email';
                        email: 'jessica@example.com';
                      };
                      permissions: [];
                      is_inherited: false;
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/list_folder_members/continue': {
      post: {
        tags: ['sharing'];
        summary: 'list_folder_members/continue';
        description: '[list_folder_members/continue](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_folder_members-continue)\n\nscope: `sharing.read`\n\nOnce a cursor has been retrieved from `list_folder_members`, use this to paginate through all shared folder members.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  users: [
                    {
                      access_type: {
                        '.tag': 'owner';
                      };
                      user: {
                        account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        email: 'bob@example.com';
                        display_name: 'Robert Smith';
                        same_team: true;
                        team_member_id: 'dbmid:abcd1234';
                      };
                      permissions: [];
                      is_inherited: false;
                    },
                  ];
                  groups: [
                    {
                      access_type: {
                        '.tag': 'editor';
                      };
                      group: {
                        group_name: 'Test group';
                        group_id: 'g:e2db7665347abcd600000000001a2b3c';
                        group_management_type: {
                          '.tag': 'user_managed';
                        };
                        group_type: {
                          '.tag': 'user_managed';
                        };
                        is_member: false;
                        is_owner: false;
                        same_team: true;
                        member_count: 10;
                      };
                      permissions: [];
                      is_inherited: false;
                    },
                  ];
                  invitees: [
                    {
                      access_type: {
                        '.tag': 'viewer';
                      };
                      invitee: {
                        '.tag': 'email';
                        email: 'jessica@example.com';
                      };
                      permissions: [];
                      is_inherited: false;
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/list_folders': {
      post: {
        tags: ['sharing'];
        summary: 'list_folders';
        description: '[list_folders](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_folders)\n\nscope: `sharing.read`\n\nReturn the list of all shared folders the current user has access to.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"limit\\": 100, \\n    \\"actions\\": []\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  entries: [
                    {
                      access_type: {
                        '.tag': 'owner';
                      };
                      is_inside_team_folder: false;
                      is_team_folder: false;
                      name: 'dir';
                      policy: {
                        acl_update_policy: {
                          '.tag': 'owner';
                        };
                        shared_link_policy: {
                          '.tag': 'anyone';
                        };
                        member_policy: {
                          '.tag': 'anyone';
                        };
                        resolved_member_policy: {
                          '.tag': 'team';
                        };
                      };
                      preview_url: 'https://www.dropbox.com/scl/fo/fir9vjelf';
                      shared_folder_id: '84528192421';
                      time_invited: '2016-01-20T00:00:00Z';
                      path_lower: '/dir';
                      link_metadata: {
                        audience_options: [
                          {
                            '.tag': 'public';
                          },
                          {
                            '.tag': 'team';
                          },
                          {
                            '.tag': 'members';
                          },
                        ];
                        current_audience: {
                          '.tag': 'public';
                        };
                        link_permissions: [
                          {
                            action: {
                              '.tag': 'change_audience';
                            };
                            allow: true;
                          },
                        ];
                        password_protected: false;
                        url: '';
                      };
                      permissions: [];
                      access_inheritance: {
                        '.tag': 'inherit';
                      };
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/list_folders/continue': {
      post: {
        tags: ['sharing'];
        summary: 'list_folders/continue';
        description: '[list_folders/continue](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_folders-continue)\n\nscope: `sharing.read`\n\nOnce a cursor has been retrieved from `list_folders`, use this to paginate through all shared folders. The cursor must come from a previous call to `list_folders` or `list_folders/continue`.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  entries: [
                    {
                      access_type: {
                        '.tag': 'owner';
                      };
                      is_inside_team_folder: false;
                      is_team_folder: false;
                      name: 'dir';
                      policy: {
                        acl_update_policy: {
                          '.tag': 'owner';
                        };
                        shared_link_policy: {
                          '.tag': 'anyone';
                        };
                        member_policy: {
                          '.tag': 'anyone';
                        };
                        resolved_member_policy: {
                          '.tag': 'team';
                        };
                      };
                      preview_url: 'https://www.dropbox.com/scl/fo/fir9vjelf';
                      shared_folder_id: '84528192421';
                      time_invited: '2016-01-20T00:00:00Z';
                      path_lower: '/dir';
                      link_metadata: {
                        audience_options: [
                          {
                            '.tag': 'public';
                          },
                          {
                            '.tag': 'team';
                          },
                          {
                            '.tag': 'members';
                          },
                        ];
                        current_audience: {
                          '.tag': 'public';
                        };
                        link_permissions: [
                          {
                            action: {
                              '.tag': 'change_audience';
                            };
                            allow: true;
                          },
                        ];
                        password_protected: false;
                        url: '';
                      };
                      permissions: [];
                      access_inheritance: {
                        '.tag': 'inherit';
                      };
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/list_mountable_folders': {
      post: {
        tags: ['sharing'];
        summary: 'list_mountable_folders';
        description: '[list_mountable_folders](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_mountable_folders)\n\nscope: `sharing.read`\n\nReturn the list of all shared folders the current user can mount or unmount.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"limit\\": 100, \\n    \\"actions\\": []\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  entries: [
                    {
                      access_type: {
                        '.tag': 'owner';
                      };
                      is_inside_team_folder: false;
                      is_team_folder: false;
                      name: 'dir';
                      policy: {
                        acl_update_policy: {
                          '.tag': 'owner';
                        };
                        shared_link_policy: {
                          '.tag': 'anyone';
                        };
                        member_policy: {
                          '.tag': 'anyone';
                        };
                        resolved_member_policy: {
                          '.tag': 'team';
                        };
                      };
                      preview_url: 'https://www.dropbox.com/scl/fo/fir9vjelf';
                      shared_folder_id: '84528192421';
                      time_invited: '2016-01-20T00:00:00Z';
                      path_lower: '/dir';
                      link_metadata: {
                        audience_options: [
                          {
                            '.tag': 'public';
                          },
                          {
                            '.tag': 'team';
                          },
                          {
                            '.tag': 'members';
                          },
                        ];
                        current_audience: {
                          '.tag': 'public';
                        };
                        link_permissions: [
                          {
                            action: {
                              '.tag': 'change_audience';
                            };
                            allow: true;
                          },
                        ];
                        password_protected: false;
                        url: '';
                      };
                      permissions: [];
                      access_inheritance: {
                        '.tag': 'inherit';
                      };
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/list_mountable_folders/continue': {
      post: {
        tags: ['sharing'];
        summary: 'list_mountable_folders/continue';
        description: '[list_mountable_folders/continue](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_mountable_folders-continue)\n\nscope: `sharing.read`\n\nOnce a cursor has been retrieved from `list_mountable_folders`, use this to paginate through all mountable shared folders. The cursor must come from a previous call to `list_mountable_folders` or `list_mountable_folders/continue`.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  entries: [
                    {
                      access_type: {
                        '.tag': 'owner';
                      };
                      is_inside_team_folder: false;
                      is_team_folder: false;
                      name: 'dir';
                      policy: {
                        acl_update_policy: {
                          '.tag': 'owner';
                        };
                        shared_link_policy: {
                          '.tag': 'anyone';
                        };
                        member_policy: {
                          '.tag': 'anyone';
                        };
                        resolved_member_policy: {
                          '.tag': 'team';
                        };
                      };
                      preview_url: 'https://www.dropbox.com/scl/fo/fir9vjelf';
                      shared_folder_id: '84528192421';
                      time_invited: '2016-01-20T00:00:00Z';
                      path_lower: '/dir';
                      link_metadata: {
                        audience_options: [
                          {
                            '.tag': 'public';
                          },
                          {
                            '.tag': 'team';
                          },
                          {
                            '.tag': 'members';
                          },
                        ];
                        current_audience: {
                          '.tag': 'public';
                        };
                        link_permissions: [
                          {
                            action: {
                              '.tag': 'change_audience';
                            };
                            allow: true;
                          },
                        ];
                        password_protected: false;
                        url: '';
                      };
                      permissions: [];
                      access_inheritance: {
                        '.tag': 'inherit';
                      };
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/list_received_files': {
      post: {
        tags: ['sharing'];
        summary: 'list_received_files';
        description: '[list_received_files](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_received_files)\n\nscope: `sharing.read`\n\nReturns a list of all files shared with current user.\n Does not include files the user has received via shared folders, and does  not include unclaimed invitations.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"limit\\": 100, \\n    \\"actions\\": []\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  entries: [
                    {
                      id: 'id:3kmLmQFnf1AAAAAAAAAAAw';
                      name: 'file.txt';
                      policy: {
                        acl_update_policy: {
                          '.tag': 'owner';
                        };
                        shared_link_policy: {
                          '.tag': 'anyone';
                        };
                        member_policy: {
                          '.tag': 'anyone';
                        };
                        resolved_member_policy: {
                          '.tag': 'team';
                        };
                      };
                      preview_url: 'https://www.dropbox.com/scl/fi/fir9vjelf';
                      access_type: {
                        '.tag': 'viewer';
                      };
                      owner_display_names: ['Jane Doe'];
                      owner_team: {
                        id: 'dbtid:AAFdgehTzw7WlXhZJsbGCLePe8RvQGYDr-I';
                        name: 'Acme, Inc.';
                      };
                      path_display: '/dir/file.txt';
                      path_lower: '/dir/file.txt';
                      permissions: [];
                      time_invited: '2016-01-20T00:00:00Z';
                    },
                  ];
                  cursor: 'AzJJbGlzdF90eXBdofe9c3RPbGlzdGFyZ3NfYnlfZ2lkMRhcbric7Rdog9cmV2aXNpb24H3Qf6o1fkHxQ';
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/list_received_files/continue': {
      post: {
        tags: ['sharing'];
        summary: 'list_received_files/continue';
        description: '[list_received_files/continue](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_received_files-continue)\n\nscope: `sharing.read`\n\nGet more results with a cursor from `list_received_files`.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"AzJJbGlzdF90eXBdofe9c3RPbGlzdGFyZ3NfYnlfZ2lkMRhcbric7Rdog9emfGRlc2MCRWxpbWl0BGRId\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  entries: [
                    {
                      id: 'id:3kmLmQFnf1AAAAAAAAAAAw';
                      name: 'file.txt';
                      policy: {
                        acl_update_policy: {
                          '.tag': 'owner';
                        };
                        shared_link_policy: {
                          '.tag': 'anyone';
                        };
                        member_policy: {
                          '.tag': 'anyone';
                        };
                        resolved_member_policy: {
                          '.tag': 'team';
                        };
                      };
                      preview_url: 'https://www.dropbox.com/scl/fi/fir9vjelf';
                      access_type: {
                        '.tag': 'viewer';
                      };
                      owner_display_names: ['Jane Doe'];
                      owner_team: {
                        id: 'dbtid:AAFdgehTzw7WlXhZJsbGCLePe8RvQGYDr-I';
                        name: 'Acme, Inc.';
                      };
                      path_display: '/dir/file.txt';
                      path_lower: '/dir/file.txt';
                      permissions: [];
                      time_invited: '2016-01-20T00:00:00Z';
                    },
                  ];
                  cursor: 'AzJJbGlzdF90eXBdofe9c3RPbGlzdGFyZ3NfYnlfZ2lkMRhcbric7Rdog9cmV2aXNpb24H3Qf6o1fkHxQ';
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/list_shared_links': {
      post: {
        tags: ['sharing'];
        summary: 'list_shared_links';
        description: '[list_shared_links](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_shared_links)\n\nscope: `sharing.read`\n\nList shared links of this user.\nIf no path is given, returns a list of all shared links for the current user.\nIf a non-empty path is given, returns a list of all shared links that allow access to the given path - direct links to the given path and links to parent folders of the given path. Links to parent folders can be suppressed by setting direct_only to true.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  links: [
                    {
                      '.tag': 'file';
                      url: 'https://www.dropbox.com/s/2sn712vy1ovegw8/Prime_Numbers.txt?dl=0';
                      name: 'Prime_Numbers.txt';
                      link_permissions: {
                        can_revoke: false;
                        resolved_visibility: {
                          '.tag': 'public';
                        };
                        revoke_failure_reason: {
                          '.tag': 'owner_only';
                        };
                      };
                      client_modified: '2015-05-12T15:50:38Z';
                      server_modified: '2015-05-12T15:50:38Z';
                      rev: 'a1c10ce0dd78';
                      size: 7212;
                      id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                      path_lower: '/homework/math/prime_numbers.txt';
                      team_member_info: {
                        team_info: {
                          id: 'dbtid:AAFdgehTzw7WlXhZJsbGCLePe8RvQGYDr-I';
                          name: 'Acme, Inc.';
                        };
                        display_name: 'Roger Rabbit';
                        member_id: 'dbmid:abcd1234';
                      };
                    },
                  ];
                  has_more: true;
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/modify_shared_link_settings': {
      post: {
        tags: ['sharing'];
        summary: 'modify_shared_link_settings';
        description: "[modify_shared_link_settings](https://www.dropbox.com/developers/documentation/http/documentation#sharing-modify_shared_link_settings)\n\nscope: `sharing.write`\n\nModify the shared link's settings.\nIf the requested visibility conflict with the shared links policy of the team or the shared folder (in case the linked file is part of a shared folder) then the `LinkPermissions.resolved_visibility` of the returned `SharedLinkMetadata` will reflect the actual visibility of the shared link and the `LinkPermissions.requested_visibility` will reflect the requested visibility.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"url\\": \\"https://www.dropbox.com/s/2sn712vy1ovegw8/Prime_Numbers.txt?dl=0\\", \\n    \\"settings\\": {\\n        \\"requested_visibility\\": \\"public\\", \\n        \\"audience\\": \\"public\\", \\n        \\"access\\": \\"viewer\\"\\n    }, \\n    \\"remove_expiration\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'file';
                  url: 'https://www.dropbox.com/s/2sn712vy1ovegw8/Prime_Numbers.txt?dl=0';
                  name: 'Prime_Numbers.txt';
                  link_permissions: {
                    can_revoke: false;
                    resolved_visibility: {
                      '.tag': 'public';
                    };
                    revoke_failure_reason: {
                      '.tag': 'owner_only';
                    };
                  };
                  client_modified: '2015-05-12T15:50:38Z';
                  server_modified: '2015-05-12T15:50:38Z';
                  rev: 'a1c10ce0dd78';
                  size: 7212;
                  id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                  path_lower: '/homework/math/prime_numbers.txt';
                  team_member_info: {
                    team_info: {
                      id: 'dbtid:AAFdgehTzw7WlXhZJsbGCLePe8RvQGYDr-I';
                      name: 'Acme, Inc.';
                    };
                    display_name: 'Roger Rabbit';
                    member_id: 'dbmid:abcd1234';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/mount_folder': {
      post: {
        tags: ['sharing'];
        summary: 'mount_folder';
        description: '[mount_folder](https://www.dropbox.com/developers/documentation/http/documentation#sharing-mount_folder)\n\nscope: `sharing.write`\n\nThe current user mounts the designated folder.\nMount a shared folder for a user after they have been added as a member. Once mounted, the shared folder will appear in their Dropbox.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"shared_folder_id\\": \\"84528192421\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  access_type: {
                    '.tag': 'owner';
                  };
                  is_inside_team_folder: false;
                  is_team_folder: false;
                  name: 'dir';
                  policy: {
                    acl_update_policy: {
                      '.tag': 'owner';
                    };
                    shared_link_policy: {
                      '.tag': 'anyone';
                    };
                    member_policy: {
                      '.tag': 'anyone';
                    };
                    resolved_member_policy: {
                      '.tag': 'team';
                    };
                  };
                  preview_url: 'https://www.dropbox.com/scl/fo/fir9vjelf';
                  shared_folder_id: '84528192421';
                  time_invited: '2016-01-20T00:00:00Z';
                  path_lower: '/dir';
                  link_metadata: {
                    audience_options: [
                      {
                        '.tag': 'public';
                      },
                      {
                        '.tag': 'team';
                      },
                      {
                        '.tag': 'members';
                      },
                    ];
                    current_audience: {
                      '.tag': 'public';
                    };
                    link_permissions: [
                      {
                        action: {
                          '.tag': 'change_audience';
                        };
                        allow: true;
                      },
                    ];
                    password_protected: false;
                    url: '';
                  };
                  permissions: [];
                  access_inheritance: {
                    '.tag': 'inherit';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/relinquish_file_membership': {
      post: {
        tags: ['sharing'];
        summary: 'relinquish_file_membership';
        description: '[relinquish_file_membership](https://www.dropbox.com/developers/documentation/http/documentation#sharing-relinquish_file_membership)\n\nscope: `sharing.write`\n\nThe current user relinquishes their membership in the designated file. Note that the current user may still have inherited access to this file through the parent folder.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"file\\": \\"id:3kmLmQFnf1AAAAAAAAAAAw\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/sharing/relinquish_folder_membership': {
      post: {
        tags: ['sharing'];
        summary: 'relinquish_folder_membership';
        description: '[relinquish_folder_membership](https://www.dropbox.com/developers/documentation/http/documentation#sharing-relinquish_folder_membership)\n\nscope: `sharing.write`\n\nThe current user relinquishes their membership in the designated shared folder and will no longer have access to the folder.  A folder owner cannot relinquish membership in their own folder.\nThis will run synchronously if leave_a_copy is false, and asynchronously if leave_a_copy is true.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"shared_folder_id\\": \\"84528192421\\", \\n    \\"leave_a_copy\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/remove_file_member_2': {
      post: {
        tags: ['sharing'];
        summary: 'remove_file_member_2';
        description: '[remove_file_member_2](https://www.dropbox.com/developers/documentation/http/documentation#sharing-remove_file_member_2)\n\nscope: `sharing.write`\n\nRemoves a specified member from the file.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"file\\": \\"id:3kmLmQFnf1AAAAAAAAAAAw\\", \\n    \\"member\\": {\\n        \\".tag\\": \\"email\\", \\n        \\"email\\": \\"justin@example.com\\"\\n    }\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'other';
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/remove_folder_member': {
      post: {
        tags: ['sharing'];
        summary: 'remove_folder_member';
        description: '[remove_folder_member](https://www.dropbox.com/developers/documentation/http/documentation#sharing-remove_folder_member)\n\nscope: `sharing.write`\n\nAllows an owner or editor (if the ACL update policy allows) of a shared folder to remove another member.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"shared_folder_id\\": \\"84528192421\\", \\n    \\"member\\": {\\n        \\".tag\\": \\"email\\", \\n        \\"email\\": \\"justin@example.com\\"\\n    }, \\n    \\"leave_a_copy\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'async_job_id';
                  async_job_id: '34g93hh34h04y384084';
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/revoke_shared_link': {
      post: {
        tags: ['sharing'];
        summary: 'revoke_shared_link';
        description: '[revoke_shared_link](https://www.dropbox.com/developers/documentation/http/documentation#sharing-revoke_shared_link)\n\nscope: `sharing.write`\n\nRevoke a shared link.\nNote that even after revoking a shared link to a file, the file may be accessible if there are shared links leading to any of the file parent folders. To list all shared links that enable access to a specific file, you can use the `list_shared_links` with the file as the `ListSharedLinksArg.path` argument.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"url\\": \\"https://www.dropbox.com/s/2sn712vy1ovegw8/Prime_Numbers.txt?dl=0\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/sharing/set_access_inheritance': {
      post: {
        tags: ['sharing'];
        summary: 'set_access_inheritance';
        description: "[set_access_inheritance](https://www.dropbox.com/developers/documentation/http/documentation#sharing-set_access_inheritance)\n\nscope: `sharing.write`\n\nChange the inheritance policy of an existing Shared Folder. Only permitted for shared folders in a shared team root.\nIf a `ShareFolderLaunch.async_job_id` is returned, you'll need to call `check_share_job_status` until the action completes to get the metadata for the folder.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"shared_folder_id\\": \\"84528192421\\", \\n    \\"access_inheritance\\": \\"inherit\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  access_type: {
                    '.tag': 'owner';
                  };
                  is_inside_team_folder: false;
                  is_team_folder: false;
                  name: 'dir';
                  policy: {
                    acl_update_policy: {
                      '.tag': 'owner';
                    };
                    shared_link_policy: {
                      '.tag': 'anyone';
                    };
                    member_policy: {
                      '.tag': 'anyone';
                    };
                    resolved_member_policy: {
                      '.tag': 'team';
                    };
                  };
                  preview_url: 'https://www.dropbox.com/scl/fo/fir9vjelf';
                  shared_folder_id: '84528192421';
                  time_invited: '2016-01-20T00:00:00Z';
                  path_lower: '/dir';
                  link_metadata: {
                    audience_options: [
                      {
                        '.tag': 'public';
                      },
                      {
                        '.tag': 'team';
                      },
                      {
                        '.tag': 'members';
                      },
                    ];
                    current_audience: {
                      '.tag': 'public';
                    };
                    link_permissions: [
                      {
                        action: {
                          '.tag': 'change_audience';
                        };
                        allow: true;
                      },
                    ];
                    password_protected: false;
                    url: '';
                  };
                  permissions: [];
                  access_inheritance: {
                    '.tag': 'inherit';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/share_folder': {
      post: {
        tags: ['sharing'];
        summary: 'share_folder';
        description: "[share_folder](https://www.dropbox.com/developers/documentation/http/documentation#sharing-share_folder)\n\nscope: `sharing.write`\n\nShare a folder with collaborators.\nMost sharing will be completed synchronously. Large folders will be completed asynchronously. To make testing the async case repeatable, set `ShareFolderArg.force_async`.\nIf a `ShareFolderLaunch.async_job_id` is returned, you'll need to call `check_share_job_status` until the action completes to get the metadata for the folder.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"path\\": \\"/example/workspace\\", \\n    \\"acl_update_policy\\": \\"editors\\", \\n    \\"force_async\\": false, \\n    \\"member_policy\\": \\"team\\", \\n    \\"shared_link_policy\\": \\"members\\", \\n    \\"access_inheritance\\": \\"inherit\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  access_type: {
                    '.tag': 'owner';
                  };
                  is_inside_team_folder: false;
                  is_team_folder: false;
                  name: 'dir';
                  policy: {
                    acl_update_policy: {
                      '.tag': 'owner';
                    };
                    shared_link_policy: {
                      '.tag': 'anyone';
                    };
                    member_policy: {
                      '.tag': 'anyone';
                    };
                    resolved_member_policy: {
                      '.tag': 'team';
                    };
                  };
                  preview_url: 'https://www.dropbox.com/scl/fo/fir9vjelf';
                  shared_folder_id: '84528192421';
                  time_invited: '2016-01-20T00:00:00Z';
                  path_lower: '/dir';
                  link_metadata: {
                    audience_options: [
                      {
                        '.tag': 'public';
                      },
                      {
                        '.tag': 'team';
                      },
                      {
                        '.tag': 'members';
                      },
                    ];
                    current_audience: {
                      '.tag': 'public';
                    };
                    link_permissions: [
                      {
                        action: {
                          '.tag': 'change_audience';
                        };
                        allow: true;
                      },
                    ];
                    password_protected: false;
                    url: '';
                  };
                  permissions: [];
                  access_inheritance: {
                    '.tag': 'inherit';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/transfer_folder': {
      post: {
        tags: ['sharing'];
        summary: 'transfer_folder';
        description: '[transfer_folder](https://www.dropbox.com/developers/documentation/http/documentation#sharing-transfer_folder)\n\nscope: `sharing.write`\n\nTransfer ownership of a shared folder to a member of the shared folder.\nUser must have `AccessLevel.owner` access to the shared folder to perform a transfer.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"shared_folder_id\\": \\"84528192421\\", \\n    \\"to_dropbox_id\\": \\"dbid:AAEufNrMPSPe0dMQijRP0N_aZtBJRm26W4Q\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/sharing/unmount_folder': {
      post: {
        tags: ['sharing'];
        summary: 'unmount_folder';
        description: '[unmount_folder](https://www.dropbox.com/developers/documentation/http/documentation#sharing-unmount_folder)\n\nscope: `sharing.write`\n\nThe current user unmounts the designated folder. They can re-mount the folder at a later time using `mount_folder`.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"shared_folder_id\\": \\"84528192421\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/sharing/unshare_file': {
      post: {
        tags: ['sharing'];
        summary: 'unshare_file';
        description: '[unshare_file](https://www.dropbox.com/developers/documentation/http/documentation#sharing-unshare_file)\n\nscope: `sharing.write`\n\nRemove all members from this file. Does not remove inherited members.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"file\\": \\"id:3kmLmQFnf1AAAAAAAAAAAw\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/sharing/unshare_folder': {
      post: {
        tags: ['sharing'];
        summary: 'unshare_folder';
        description: "[unshare_folder](https://www.dropbox.com/developers/documentation/http/documentation#sharing-unshare_folder)\n\nscope: `sharing.write`\n\nAllows a shared folder owner to unshare the folder.\nYou'll need to call `check_job_status` to determine if the action has completed successfully.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"shared_folder_id\\": \\"84528192421\\", \\n    \\"leave_a_copy\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                };
              };
            };
          };
        };
      };
    };
    '/2/sharing/update_file_member': {
      post: {
        tags: ['sharing'];
        summary: 'update_file_member';
        description: "[update_file_member](https://www.dropbox.com/developers/documentation/http/documentation#sharing-update_file_member)\n\nscope: `sharing.write`\n\nChanges a member's access on a shared file.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"file\\": \\"id:3kmLmQFnf1AAAAAAAAAAAw\\", \\n    \\"member\\": {\\n        \\".tag\\": \\"email\\", \\n        \\"email\\": \\"justin@example.com\\"\\n    }, \\n    \\"access_level\\": \\"viewer\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {};
              };
            };
          };
        };
      };
    };
    '/2/sharing/update_folder_member': {
      post: {
        tags: ['sharing'];
        summary: 'update_folder_member';
        description: "[update_folder_member](https://www.dropbox.com/developers/documentation/http/documentation#sharing-update_folder_member)\n\nscope: `sharing.write`\n\nAllows an owner or editor of a shared folder to update another member's permissions.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"shared_folder_id\\": \\"84528192421\\", \\n    \\"member\\": {\\n        \\".tag\\": \\"email\\", \\n        \\"email\\": \\"justin@example.com\\"\\n    }, \\n    \\"access_level\\": \\"editor\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {};
              };
            };
          };
        };
      };
    };
    '/2/sharing/update_folder_policy': {
      post: {
        tags: ['sharing'];
        summary: 'update_folder_policy';
        description: '[update_folder_policy](https://www.dropbox.com/developers/documentation/http/documentation#sharing-update_folder_policy)\n\nscope: `sharing.write`\n\nUpdate the sharing policies for a shared folder.\nUser must have `AccessLevel.owner` access to the shared folder to update its policies.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"shared_folder_id\\": \\"84528192421\\", \\n    \\"member_policy\\": \\"team\\", \\n    \\"acl_update_policy\\": \\"owner\\", \\n    \\"shared_link_policy\\": \\"members\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  access_type: {
                    '.tag': 'owner';
                  };
                  is_inside_team_folder: false;
                  is_team_folder: false;
                  name: 'dir';
                  policy: {
                    acl_update_policy: {
                      '.tag': 'owner';
                    };
                    shared_link_policy: {
                      '.tag': 'anyone';
                    };
                    member_policy: {
                      '.tag': 'anyone';
                    };
                    resolved_member_policy: {
                      '.tag': 'team';
                    };
                  };
                  preview_url: 'https://www.dropbox.com/scl/fo/fir9vjelf';
                  shared_folder_id: '84528192421';
                  time_invited: '2016-01-20T00:00:00Z';
                  path_lower: '/dir';
                  link_metadata: {
                    audience_options: [
                      {
                        '.tag': 'public';
                      },
                      {
                        '.tag': 'team';
                      },
                      {
                        '.tag': 'members';
                      },
                    ];
                    current_audience: {
                      '.tag': 'public';
                    };
                    link_permissions: [
                      {
                        action: {
                          '.tag': 'change_audience';
                        };
                        allow: true;
                      },
                    ];
                    password_protected: false;
                    url: '';
                  };
                  permissions: [];
                  access_inheritance: {
                    '.tag': 'inherit';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/team/devices/list_member_devices': {
      post: {
        tags: ['team > devices'];
        summary: 'devices/list_member_devices';
        description: "[devices/list_member_devices](https://www.dropbox.com/developers/documentation/http/teams#team-devices-list_member_devices)\n\nscope: `sessions.list`\n\nList all device sessions of a team's member.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"team_member_id\\": \\"dbmid:AAFdgehTzw7WlXhZJsbGCLePe8RvQGYDr-I\\", \\n    \\"include_web_sessions\\": true, \\n    \\"include_desktop_clients\\": true, \\n    \\"include_mobile_clients\\": true\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/devices/list_members_devices': {
      post: {
        tags: ['team > devices'];
        summary: 'devices/list_members_devices';
        description: '[devices/list_members_devices](https://www.dropbox.com/developers/documentation/http/teams#team-devices-list_members_devices)\n\nscope: `sessions.list`\n\nList all device sessions of a team.\nPermission : Team member file access.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '""';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/devices/revoke_device_session': {
      post: {
        tags: ['team > devices'];
        summary: 'devices/revoke_device_session';
        description: "[devices/revoke_device_session](https://www.dropbox.com/developers/documentation/http/teams#team-devices-revoke_device_session)\n\nscope: `sessions.modify`\n\nRevoke a device session of a team's member.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\".tag\\": \\"web_session\\", \\n    \\"session_id\\": \\"1234faaf0678bcde\\", \\n    \\"team_member_id\\": \\"dbmid:AAHhy7WsR0x-u4ZCqiDl5Fz5zvuL3kmspwU\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/devices/revoke_device_session_batch': {
      post: {
        tags: ['team > devices'];
        summary: 'devices/revoke_device_session_batch';
        description: '[devices/revoke_device_session_batch](https://www.dropbox.com/developers/documentation/http/teams#team-devices-revoke_device_session_batch)\n\nscope: `sessions.modify`\n\nRevoke a list of device sessions of team members.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"revoke_devices\\": [\\n        {\\n            \\".tag\\": \\"web_session\\", \\n            \\"session_id\\": \\"1234faaf0678bcde\\", \\n            \\"team_member_id\\": \\"dbmid:AAHhy7WsR0x-u4ZCqiDl5Fz5zvuL3kmspwU\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/groups/create': {
      post: {
        tags: ['team > groups'];
        summary: 'groups/create';
        description: '[groups/create](https://www.dropbox.com/developers/documentation/http/teams#team-groups-create)\n\nscope: `groups.write`\n\nCreates a new, empty group, with a requested name.\nPermission : Team member management.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"group_name\\": \\"Europe sales\\", \\n    \\"add_creator_as_owner\\": false, \\n    \\"group_external_id\\": \\"group-134\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  group_name: 'project launch';
                  group_id: 'g:e2db7665347abcd600000000001a2b3c';
                  group_management_type: {
                    '.tag': 'user_managed';
                  };
                  created: 1447255518000;
                  member_count: 5;
                  members: [
                    {
                      profile: {
                        team_member_id: 'dbmid:1234567';
                        email: 'mary@lamb.com';
                        email_verified: true;
                        status: {
                          '.tag': 'active';
                        };
                        name: {
                          given_name: 'Franz';
                          surname: 'Ferdinand';
                          familiar_name: 'Franz';
                          display_name: 'Franz Ferdinand (Personal)';
                          abbreviated_name: 'FF';
                        };
                        membership_type: {
                          '.tag': 'full';
                        };
                        account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        secondary_emails: [
                          {
                            email: 'apple@orange.com';
                            is_verified: true;
                          },
                          {
                            email: 'banana@honeydew.com';
                            is_verified: true;
                          },
                          {
                            email: 'grape@strawberry.com';
                            is_verified: false;
                          },
                        ];
                        joined_on: '2015-05-12T15:50:38Z';
                        profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                      };
                      access_type: {
                        '.tag': 'member';
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/team/groups/delete': {
      post: {
        tags: ['team > groups'];
        summary: 'groups/delete';
        description: '[groups/delete](https://www.dropbox.com/developers/documentation/http/teams#team-groups-delete)\n\nscope: `groups.write`\n\nDeletes a group.\nThe group is deleted immediately. However the revoking of group-owned resources may take additional time. Use the `groups/job_status/get` to determine whether this process has completed.\nPermission : Team member management.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\".tag\\": \\"group_id\\", \\n    \\"group_id\\": \\"g:e2db7665347abcd600000000001a2b3c\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                };
              };
            };
          };
        };
      };
    };
    '/2/team/groups/get_info': {
      post: {
        tags: ['team > groups'];
        summary: 'groups/get_info';
        description: '[groups/get_info](https://www.dropbox.com/developers/documentation/http/teams#team-groups-get_info)\n\nscope: `groups.read`\n\nRetrieves information about one or more groups. Note that the optional field  `GroupFullInfo.members` is not returned for system-managed groups.\nPermission : Team Information.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\".tag\\": \\"group_ids\\", \\n    \\"group_ids\\": [\\n        \\"g:e2db7665347abcd600000000001a2b3c\\", \\n        \\"g:111111147abcd6000000000222222c\\"\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: [
                  {
                    '.tag': 'group_info';
                    group_name: 'project launch';
                    group_id: 'g:e2db7665347abcd600000000001a2b3c';
                    group_management_type: {
                      '.tag': 'user_managed';
                    };
                    created: 1447255518000;
                    member_count: 5;
                    members: [
                      {
                        profile: {
                          team_member_id: 'dbmid:1234567';
                          email: 'mary@lamb.com';
                          email_verified: true;
                          status: {
                            '.tag': 'active';
                          };
                          name: {
                            given_name: 'Franz';
                            surname: 'Ferdinand';
                            familiar_name: 'Franz';
                            display_name: 'Franz Ferdinand (Personal)';
                            abbreviated_name: 'FF';
                          };
                          membership_type: {
                            '.tag': 'full';
                          };
                          account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                          secondary_emails: [
                            {
                              email: 'apple@orange.com';
                              is_verified: true;
                            },
                            {
                              email: 'banana@honeydew.com';
                              is_verified: true;
                            },
                            {
                              email: 'grape@strawberry.com';
                              is_verified: false;
                            },
                          ];
                          joined_on: '2015-05-12T15:50:38Z';
                          profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                        };
                        access_type: {
                          '.tag': 'member';
                        };
                      },
                    ];
                  },
                ];
              };
            };
          };
        };
      };
    };
    '/2/team/groups/job_status/get': {
      post: {
        tags: ['team > groups'];
        summary: 'groups/job_status/get';
        description: "[groups/job_status/get](https://www.dropbox.com/developers/documentation/http/teams#team-groups-job_status-get)\n\nscope: `groups.write`\n\nOnce an async_job_id is returned from `groups/delete`, `groups/members/add` , or `groups/members/remove` use this method to poll the status of granting/revoking group members' access to group-owned resources.\nPermission : Team member management.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"async_job_id\\": \\"34g93hh34h04y384084\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                };
              };
            };
          };
        };
      };
    };
    '/2/team/groups/list': {
      post: {
        tags: ['team > groups'];
        summary: 'groups/list';
        description: '[groups/list](https://www.dropbox.com/developers/documentation/http/teams#team-groups-list)\n\nscope: `groups.read`\n\nLists groups on a team.\nPermission : Team Information.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"limit\\": 100\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  groups: [
                    {
                      group_name: 'Test group';
                      group_id: 'g:e2db7665347abcd600000000001a2b3c';
                      group_management_type: {
                        '.tag': 'user_managed';
                      };
                      member_count: 10;
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                  has_more: false;
                };
              };
            };
          };
        };
      };
    };
    '/2/team/groups/list/continue': {
      post: {
        tags: ['team > groups'];
        summary: 'groups/list/continue';
        description: '[groups/list/continue](https://www.dropbox.com/developers/documentation/http/teams#team-groups-list-continue)\n\nscope: `groups.read`\n\nOnce a cursor has been retrieved from `groups/list`, use this to paginate through all groups.\nPermission : Team Information.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  groups: [
                    {
                      group_name: 'Test group';
                      group_id: 'g:e2db7665347abcd600000000001a2b3c';
                      group_management_type: {
                        '.tag': 'user_managed';
                      };
                      member_count: 10;
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                  has_more: false;
                };
              };
            };
          };
        };
      };
    };
    '/2/team/groups/members/add': {
      post: {
        tags: ['team > groups'];
        summary: 'groups/members/add';
        description: '[groups/members/add](https://www.dropbox.com/developers/documentation/http/teams#team-groups-members-add)\n\nscope: `groups.write`\n\nAdds members to a group.\nThe members are added immediately. However the granting of group-owned resources may take additional time. Use the `groups/job_status/get` to determine whether this process has completed.\nPermission : Team member management.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"group\\": {\\n        \\".tag\\": \\"group_id\\", \\n        \\"group_id\\": \\"g:e2db7665347abcd600000000001a2b3c\\"\\n    }, \\n    \\"members\\": [\\n        {\\n            \\"user\\": {\\n                \\".tag\\": \\"team_member_id\\", \\n                \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n            }, \\n            \\"access_type\\": \\"member\\"\\n        }\\n    ], \\n    \\"return_members\\": true\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  group_info: {
                    group_name: 'project launch';
                    group_id: 'g:e2db7665347abcd600000000001a2b3c';
                    group_management_type: {
                      '.tag': 'user_managed';
                    };
                    created: 1447255518000;
                    member_count: 5;
                    members: [
                      {
                        profile: {
                          team_member_id: 'dbmid:1234567';
                          email: 'mary@lamb.com';
                          email_verified: true;
                          status: {
                            '.tag': 'active';
                          };
                          name: {
                            given_name: 'Franz';
                            surname: 'Ferdinand';
                            familiar_name: 'Franz';
                            display_name: 'Franz Ferdinand (Personal)';
                            abbreviated_name: 'FF';
                          };
                          membership_type: {
                            '.tag': 'full';
                          };
                          account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                          secondary_emails: [
                            {
                              email: 'apple@orange.com';
                              is_verified: true;
                            },
                            {
                              email: 'banana@honeydew.com';
                              is_verified: true;
                            },
                            {
                              email: 'grape@strawberry.com';
                              is_verified: false;
                            },
                          ];
                          joined_on: '2015-05-12T15:50:38Z';
                          profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                        };
                        access_type: {
                          '.tag': 'member';
                        };
                      },
                    ];
                  };
                  async_job_id: '99988877733388';
                };
              };
            };
          };
        };
      };
    };
    '/2/team/groups/members/list': {
      post: {
        tags: ['team > groups'];
        summary: 'groups/members/list';
        description: '[groups/members/list](https://www.dropbox.com/developers/documentation/http/teams#team-groups-members-list)\n\nscope: `groups.read`\n\nLists members of a group.\nPermission : Team Information.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"group\\": {\\n        \\".tag\\": \\"group_id\\", \\n        \\"group_id\\": \\"g:e2db7665347abcd600000000001a2b3c\\"\\n    }, \\n    \\"limit\\": 100\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  members: [];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                  has_more: false;
                };
              };
            };
          };
        };
      };
    };
    '/2/team/groups/members/list/continue': {
      post: {
        tags: ['team > groups'];
        summary: 'groups/members/list/continue';
        description: '[groups/members/list/continue](https://www.dropbox.com/developers/documentation/http/teams#team-groups-members-list-continue)\n\nscope: `groups.read`\n\nOnce a cursor has been retrieved from `groups/members/list`, use this to paginate through all members of the group.\nPermission : Team information.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  members: [];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                  has_more: false;
                };
              };
            };
          };
        };
      };
    };
    '/2/team/groups/members/remove': {
      post: {
        tags: ['team > groups'];
        summary: 'groups/members/remove';
        description: '[groups/members/remove](https://www.dropbox.com/developers/documentation/http/teams#team-groups-members-remove)\n\nscope: `groups.write`\n\nRemoves members from a group.\nThe members are removed immediately. However the revoking of group-owned resources may take additional time. Use the `groups/job_status/get` to determine whether this process has completed.\nThis method permits removing the only owner of a group, even in cases where this is not possible via the web client.\nPermission : Team member management.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"group\\": {\\n        \\".tag\\": \\"group_id\\", \\n        \\"group_id\\": \\"g:e2db7665347abcd600000000001a2b3c\\"\\n    }, \\n    \\"users\\": [\\n        {\\n            \\".tag\\": \\"team_member_id\\", \\n            \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n        }\\n    ], \\n    \\"return_members\\": true\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  group_info: {
                    group_name: 'project launch';
                    group_id: 'g:e2db7665347abcd600000000001a2b3c';
                    group_management_type: {
                      '.tag': 'user_managed';
                    };
                    created: 1447255518000;
                    member_count: 5;
                    members: [
                      {
                        profile: {
                          team_member_id: 'dbmid:1234567';
                          email: 'mary@lamb.com';
                          email_verified: true;
                          status: {
                            '.tag': 'active';
                          };
                          name: {
                            given_name: 'Franz';
                            surname: 'Ferdinand';
                            familiar_name: 'Franz';
                            display_name: 'Franz Ferdinand (Personal)';
                            abbreviated_name: 'FF';
                          };
                          membership_type: {
                            '.tag': 'full';
                          };
                          account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                          secondary_emails: [
                            {
                              email: 'apple@orange.com';
                              is_verified: true;
                            },
                            {
                              email: 'banana@honeydew.com';
                              is_verified: true;
                            },
                            {
                              email: 'grape@strawberry.com';
                              is_verified: false;
                            },
                          ];
                          joined_on: '2015-05-12T15:50:38Z';
                          profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                        };
                        access_type: {
                          '.tag': 'member';
                        };
                      },
                    ];
                  };
                  async_job_id: '99988877733388';
                };
              };
            };
          };
        };
      };
    };
    '/2/team/groups/members/set_access_type': {
      post: {
        tags: ['team > groups'];
        summary: 'groups/members/set_access_type';
        description: "[groups/members/set_access_type](https://www.dropbox.com/developers/documentation/http/teams#team-groups-members-set_access_type)\n\nscope: `groups.write`\n\nSets a member's access type in a group.\nPermission : Team member management.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"group\\": {\\n        \\".tag\\": \\"group_id\\", \\n        \\"group_id\\": \\"g:e2db7665347abcd600000000001a2b3c\\"\\n    }, \\n    \\"user\\": {\\n        \\".tag\\": \\"team_member_id\\", \\n        \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n    }, \\n    \\"access_type\\": \\"member\\", \\n    \\"return_members\\": true\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: [
                  {
                    '.tag': 'group_info';
                    group_name: 'project launch';
                    group_id: 'g:e2db7665347abcd600000000001a2b3c';
                    group_management_type: {
                      '.tag': 'user_managed';
                    };
                    created: 1447255518000;
                    member_count: 5;
                    members: [
                      {
                        profile: {
                          team_member_id: 'dbmid:1234567';
                          email: 'mary@lamb.com';
                          email_verified: true;
                          status: {
                            '.tag': 'active';
                          };
                          name: {
                            given_name: 'Franz';
                            surname: 'Ferdinand';
                            familiar_name: 'Franz';
                            display_name: 'Franz Ferdinand (Personal)';
                            abbreviated_name: 'FF';
                          };
                          membership_type: {
                            '.tag': 'full';
                          };
                          account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                          secondary_emails: [
                            {
                              email: 'apple@orange.com';
                              is_verified: true;
                            },
                            {
                              email: 'banana@honeydew.com';
                              is_verified: true;
                            },
                            {
                              email: 'grape@strawberry.com';
                              is_verified: false;
                            },
                          ];
                          joined_on: '2015-05-12T15:50:38Z';
                          profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                        };
                        access_type: {
                          '.tag': 'member';
                        };
                      },
                    ];
                  },
                ];
              };
            };
          };
        };
      };
    };
    '/2/team/groups/update': {
      post: {
        tags: ['team > groups'];
        summary: 'groups/update';
        description: "[groups/update](https://www.dropbox.com/developers/documentation/http/teams#team-groups-update)\n\nscope: `groups.write`\n\nUpdates a group's name and/or external ID.\nPermission : Team member management.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"group\\": {\\n        \\".tag\\": \\"group_id\\", \\n        \\"group_id\\": \\"g:e2db7665347abcd600000000001a2b3c\\"\\n    }, \\n    \\"return_members\\": true, \\n    \\"new_group_name\\": \\"Europe west sales\\", \\n    \\"new_group_external_id\\": \\"sales-234\\", \\n    \\"new_group_management_type\\": \\"company_managed\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  group_name: 'project launch';
                  group_id: 'g:e2db7665347abcd600000000001a2b3c';
                  group_management_type: {
                    '.tag': 'user_managed';
                  };
                  created: 1447255518000;
                  member_count: 5;
                  members: [
                    {
                      profile: {
                        team_member_id: 'dbmid:1234567';
                        email: 'mary@lamb.com';
                        email_verified: true;
                        status: {
                          '.tag': 'active';
                        };
                        name: {
                          given_name: 'Franz';
                          surname: 'Ferdinand';
                          familiar_name: 'Franz';
                          display_name: 'Franz Ferdinand (Personal)';
                          abbreviated_name: 'FF';
                        };
                        membership_type: {
                          '.tag': 'full';
                        };
                        account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        secondary_emails: [
                          {
                            email: 'apple@orange.com';
                            is_verified: true;
                          },
                          {
                            email: 'banana@honeydew.com';
                            is_verified: true;
                          },
                          {
                            email: 'grape@strawberry.com';
                            is_verified: false;
                          },
                        ];
                        joined_on: '2015-05-12T15:50:38Z';
                        profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                      };
                      access_type: {
                        '.tag': 'member';
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/team/legal_holds/create_policy': {
      post: {
        tags: ['team > legal_holds'];
        summary: 'legal_holds/create_policy';
        description: '[legal_holds/create_policy](https://www.dropbox.com/developers/documentation/http/teams#team-legal_holds-create_policy)\n\nscope: `team_data.member`\n\nCreates new legal hold policy. Note: Legal Holds is a paid add-on. Not all teams have the feature.\nPermission : Team member file access.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"name\\": \\"acme cfo policy\\", \\n    \\"members\\": [\\n        \\"dbmid:FDFSVF-DFSDF\\"\\n    ], \\n    \\"start_date\\": \\"2016-01-01T00:00:00Z\\", \\n    \\"end_date\\": \\"2017-12-31T00:00:00Z\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  id: 'pid_dbhid:abcd1234';
                  name: 'acme cfo policy';
                  members: {
                    team_member_ids: ['dbmid:efgh5678'];
                    permanently_deleted_users: 2;
                  };
                  status: {
                    '.tag': 'active';
                  };
                  start_date: '2016-01-01T00:00:00Z';
                  activation_time: '2016-01-20T00:00:10Z';
                  end_date: '2017-12-31T00:00:00Z';
                };
              };
            };
          };
        };
      };
    };
    '/2/team/legal_holds/get_policy': {
      post: {
        tags: ['team > legal_holds'];
        summary: 'legal_holds/get_policy';
        description: '[legal_holds/get_policy](https://www.dropbox.com/developers/documentation/http/teams#team-legal_holds-get_policy)\n\nscope: `team_data.member`\n\nGets a legal hold by Id. Note: Legal Holds is a paid add-on. Not all teams have the feature.\nPermission : Team member file access.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"id\\": \\"pid_dbhid:abcd1234\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  id: 'pid_dbhid:abcd1234';
                  name: 'acme cfo policy';
                  members: {
                    team_member_ids: ['dbmid:efgh5678'];
                    permanently_deleted_users: 2;
                  };
                  status: {
                    '.tag': 'active';
                  };
                  start_date: '2016-01-01T00:00:00Z';
                  activation_time: '2016-01-20T00:00:10Z';
                  end_date: '2017-12-31T00:00:00Z';
                };
              };
            };
          };
        };
      };
    };
    '/2/team/legal_holds/list_held_revisions': {
      post: {
        tags: ['team > legal_holds'];
        summary: 'legal_holds/list_held_revisions';
        description: "[legal_holds/list_held_revisions](https://www.dropbox.com/developers/documentation/http/teams#team-legal_holds-list_held_revisions)\n\nscope: `team_data.member`\n\nList the file metadata that's under the hold. Note: Legal Holds is a paid add-on. Not all teams have the feature.\nPermission : Team member file access.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"id\\": \\"pid_dbhid:abcd1234\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  entries: [
                    {
                      new_filename: '111_222.pdf';
                      original_revision_id: 'ab2rij4i5ojgfd';
                      original_file_path: '/a.pdf';
                      server_modified: '2019-08-12T12:08:52Z';
                      author_member_id: 'dbmid:abcd1234abcd1234abcd1234abcd1234a23';
                      author_member_status: {
                        '.tag': 'active';
                      };
                      author_email: 'a@a.com';
                      file_type: 'Document';
                      size: 3;
                      content_hash: 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234';
                    },
                  ];
                  has_more: false;
                };
              };
            };
          };
        };
      };
    };
    '/2/team/legal_holds/list_held_revisions_continue': {
      post: {
        tags: ['team > legal_holds'];
        summary: 'legal_holds/list_held_revisions_continue';
        description: "[legal_holds/list_held_revisions_continue](https://www.dropbox.com/developers/documentation/http/teams#team-legal_holds-list_held_revisions_continue)\n\nscope: `team_data.member`\n\nContinue listing the file metadata that's under the hold. Note: Legal Holds is a paid add-on. Not all teams have the feature.\nPermission : Team member file access.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"id\\": \\"pid_dbhid:abcd1234\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  entries: [
                    {
                      new_filename: '111_222.pdf';
                      original_revision_id: 'ab2rij4i5ojgfd';
                      original_file_path: '/a.pdf';
                      server_modified: '2019-08-12T12:08:52Z';
                      author_member_id: 'dbmid:abcd1234abcd1234abcd1234abcd1234a23';
                      author_member_status: {
                        '.tag': 'active';
                      };
                      author_email: 'a@a.com';
                      file_type: 'Document';
                      size: 3;
                      content_hash: 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234';
                    },
                  ];
                  has_more: false;
                };
              };
            };
          };
        };
      };
    };
    '/2/team/legal_holds/list_policies': {
      post: {
        tags: ['team > legal_holds'];
        summary: 'legal_holds/list_policies';
        description: '[legal_holds/list_policies](https://www.dropbox.com/developers/documentation/http/teams#team-legal_holds-list_policies)\n\nscope: `team_data.member`\n\nLists legal holds on a team. Note: Legal Holds is a paid add-on. Not all teams have the feature.\nPermission : Team member file access.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"include_released\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  policies: [
                    {
                      id: 'pid_dbhid:abcd1234';
                      name: 'acme cfo policy';
                      members: {
                        team_member_ids: ['dbmid:efgh5678'];
                        permanently_deleted_users: 2;
                      };
                      status: {
                        '.tag': 'active';
                      };
                      start_date: '2016-01-01T00:00:00Z';
                      activation_time: '2016-01-20T00:00:10Z';
                      end_date: '2017-12-31T00:00:00Z';
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/team/legal_holds/release_policy': {
      post: {
        tags: ['team > legal_holds'];
        summary: 'legal_holds/release_policy';
        description: '[legal_holds/release_policy](https://www.dropbox.com/developers/documentation/http/teams#team-legal_holds-release_policy)\n\nscope: `team_data.member`\n\nReleases a legal hold by Id. Note: Legal Holds is a paid add-on. Not all teams have the feature.\nPermission : Team member file access.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"id\\": \\"pid_dbhid:abcd1234\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/legal_holds/update_policy': {
      post: {
        tags: ['team > legal_holds'];
        summary: 'legal_holds/update_policy';
        description: '[legal_holds/update_policy](https://www.dropbox.com/developers/documentation/http/teams#team-legal_holds-update_policy)\n\nscope: `team_data.member`\n\nUpdates a legal hold. Note: Legal Holds is a paid add-on. Not all teams have the feature.\nPermission : Team member file access.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"id\\": \\"pid_dbhid:abcd1234\\", \\n    \\"members\\": [\\n        \\"dbmid:FDFSVF-DFSDF\\"\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  id: 'pid_dbhid:abcd1234';
                  name: 'acme cfo policy';
                  members: {
                    team_member_ids: ['dbmid:efgh5678'];
                    permanently_deleted_users: 2;
                  };
                  status: {
                    '.tag': 'active';
                  };
                  start_date: '2016-01-01T00:00:00Z';
                  activation_time: '2016-01-20T00:00:10Z';
                  end_date: '2017-12-31T00:00:00Z';
                };
              };
            };
          };
        };
      };
    };
    '/2/team/linked_apps/list_member_linked_apps': {
      post: {
        tags: ['team > linked_apps'];
        summary: 'linked_apps/list_member_linked_apps';
        description: '[linked_apps/list_member_linked_apps](https://www.dropbox.com/developers/documentation/http/teams#team-linked_apps-list_member_linked_apps)\n\nscope: `sessions.list`\n\nList all linked applications of the team member.\nNote, this endpoint does not list any team-linked applications.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"team_member_id\\": \\"dbmid:AAFdgehTzw7WlXhZJsbGCLePe8RvQGYDr-I\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/linked_apps/list_members_linked_apps': {
      post: {
        tags: ['team > linked_apps'];
        summary: 'linked_apps/list_members_linked_apps';
        description: "[linked_apps/list_members_linked_apps](https://www.dropbox.com/developers/documentation/http/teams#team-linked_apps-list_members_linked_apps)\n\nscope: `sessions.list`\n\nList all applications linked to the team members' accounts.\nNote, this endpoint does not list any team-linked applications.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '""';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/linked_apps/revoke_linked_app': {
      post: {
        tags: ['team > linked_apps'];
        summary: 'linked_apps/revoke_linked_app';
        description: '[linked_apps/revoke_linked_app](https://www.dropbox.com/developers/documentation/http/teams#team-linked_apps-revoke_linked_app)\n\nscope: `sessions.modify`\n\nRevoke a linked application of the team member.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '""';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/linked_apps/revoke_linked_app_batch': {
      post: {
        tags: ['team > linked_apps'];
        summary: 'linked_apps/revoke_linked_app_batch';
        description: '[linked_apps/revoke_linked_app_batch](https://www.dropbox.com/developers/documentation/http/teams#team-linked_apps-revoke_linked_app_batch)\n\nscope: `sessions.modify`\n\nRevoke a list of linked applications of the team members.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '""';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/member_space_limits/excluded_users/add': {
      post: {
        tags: ['team > member_space_limits'];
        summary: 'member_space_limits/excluded_users/add';
        description: '[member_space_limits/excluded_users/add](https://www.dropbox.com/developers/documentation/http/teams#team-member_space_limits-excluded_users-add)\n\nscope: `members.write`\n\nAdd users to member space limits excluded users list.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"users\\": [\\n        {\\n            \\".tag\\": \\"team_member_id\\", \\n            \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  status: {
                    '.tag': 'success';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/team/member_space_limits/excluded_users/list': {
      post: {
        tags: ['team > member_space_limits'];
        summary: 'member_space_limits/excluded_users/list';
        description: '[member_space_limits/excluded_users/list](https://www.dropbox.com/developers/documentation/http/teams#team-member_space_limits-excluded_users-list)\n\nscope: `members.read`\n\nList member space limits excluded users.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"limit\\": 100\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  users: [];
                  has_more: false;
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                };
              };
            };
          };
        };
      };
    };
    '/2/team/member_space_limits/excluded_users/list/continue': {
      post: {
        tags: ['team > member_space_limits'];
        summary: 'member_space_limits/excluded_users/list/continue';
        description: '[member_space_limits/excluded_users/list/continue](https://www.dropbox.com/developers/documentation/http/teams#team-member_space_limits-excluded_users-list-continue)\n\nscope: `members.read`\n\nContinue listing member space limits excluded users.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  users: [];
                  has_more: false;
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                };
              };
            };
          };
        };
      };
    };
    '/2/team/member_space_limits/excluded_users/remove': {
      post: {
        tags: ['team > member_space_limits'];
        summary: 'member_space_limits/excluded_users/remove';
        description: '[member_space_limits/excluded_users/remove](https://www.dropbox.com/developers/documentation/http/teams#team-member_space_limits-excluded_users-remove)\n\nscope: `members.write`\n\nRemove users from member space limits excluded users list.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"users\\": [\\n        {\\n            \\".tag\\": \\"team_member_id\\", \\n            \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  status: {
                    '.tag': 'success';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/team/member_space_limits/get_custom_quota': {
      post: {
        tags: ['team > member_space_limits'];
        summary: 'member_space_limits/get_custom_quota';
        description: '[member_space_limits/get_custom_quota](https://www.dropbox.com/developers/documentation/http/teams#team-member_space_limits-get_custom_quota)\n\nscope: `members.read`\n\nGet users custom quota. Returns none as the custom quota if none was set. A maximum of 1000 members can be specified in a single call.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"users\\": [\\n        {\\n            \\".tag\\": \\"team_member_id\\", \\n            \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: [
                  {
                    '.tag': 'other';
                  },
                ];
              };
            };
          };
        };
      };
    };
    '/2/team/member_space_limits/remove_custom_quota': {
      post: {
        tags: ['team > member_space_limits'];
        summary: 'member_space_limits/remove_custom_quota';
        description: '[member_space_limits/remove_custom_quota](https://www.dropbox.com/developers/documentation/http/teams#team-member_space_limits-remove_custom_quota)\n\nscope: `members.write`\n\nRemove users custom quota. A maximum of 1000 members can be specified in a single call.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"users\\": [\\n        {\\n            \\".tag\\": \\"team_member_id\\", \\n            \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: [
                  {
                    '.tag': 'other';
                  },
                ];
              };
            };
          };
        };
      };
    };
    '/2/team/member_space_limits/set_custom_quota': {
      post: {
        tags: ['team > member_space_limits'];
        summary: 'member_space_limits/set_custom_quota';
        description: '[member_space_limits/set_custom_quota](https://www.dropbox.com/developers/documentation/http/teams#team-member_space_limits-set_custom_quota)\n\nscope: `members.read`\n\nSet users custom quota. Custom quota has to be at least 15GB. A maximum of 1000 members can be specified in a single call.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"users_and_quotas\\": [\\n        {\\n            \\"user\\": {\\n                \\".tag\\": \\"team_member_id\\", \\n                \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n            }, \\n            \\"quota_gb\\": 30\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: [
                  {
                    '.tag': 'other';
                  },
                ];
              };
            };
          };
        };
      };
    };
    '/2/team/members/add': {
      post: {
        tags: ['team > members'];
        summary: 'members/add';
        description: "[members/add](https://www.dropbox.com/developers/documentation/http/teams#team-members-add)\n\nscope: `members.write`\n\nAdds members to a team.\nPermission : Team member management\nA maximum of 20 members can be specified in a single call.\nIf no Dropbox account exists with the email address specified, a new Dropbox account will be created with the given email address, and that account will be invited to the team.\nIf a personal Dropbox account exists with the email address specified in the call, this call will create a placeholder Dropbox account for the user on the team and send an email inviting the user to migrate their existing personal account onto the team.\nTeam member management apps are required to set an initial given_name and surname for a user to use in the team invitation and for 'Perform as team member' actions taken on the user before they become 'active'.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"new_members\\": [\\n        {\\n            \\"member_email\\": \\"tom.s@company.com\\", \\n            \\"member_given_name\\": \\"Tom\\", \\n            \\"member_surname\\": \\"Silverstone\\", \\n            \\"member_external_id\\": \\"company_id:342432\\", \\n            \\"send_welcome_email\\": true, \\n            \\"role\\": \\"member_only\\"\\n        }\\n    ], \\n    \\"force_async\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  complete: [
                    {
                      '.tag': 'success';
                      profile: {
                        team_member_id: 'dbmid:FDFSVF-DFSDF';
                        email: 'tami@seagull.com';
                        email_verified: false;
                        status: {
                          '.tag': 'active';
                        };
                        name: {
                          given_name: 'Franz';
                          surname: 'Ferdinand';
                          familiar_name: 'Franz';
                          display_name: 'Franz Ferdinand (Personal)';
                          abbreviated_name: 'FF';
                        };
                        membership_type: {
                          '.tag': 'full';
                        };
                        groups: ['g:e2db7665347abcd600000000001a2b3c'];
                        member_folder_id: '20';
                        external_id: '244423';
                        account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        secondary_emails: [
                          {
                            email: 'grape@strawberry.com';
                            is_verified: false;
                          },
                          {
                            email: 'apple@orange.com';
                            is_verified: true;
                          },
                        ];
                        joined_on: '2015-05-12T15:50:38Z';
                        profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                      };
                      role: {
                        '.tag': 'member_only';
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/team/members/add/job_status/get': {
      post: {
        tags: ['team > members'];
        summary: 'members/add/job_status/get';
        description: '[members/add/job_status/get](https://www.dropbox.com/developers/documentation/http/teams#team-members-add-job_status-get)\n\nscope: `members.write`\n\nOnce an async_job_id is returned from `members/add` , use this to poll the status of the asynchronous request.\nPermission : Team member management.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"async_job_id\\": \\"34g93hh34h04y384084\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  complete: [
                    {
                      '.tag': 'success';
                      profile: {
                        team_member_id: 'dbmid:FDFSVF-DFSDF';
                        email: 'tami@seagull.com';
                        email_verified: false;
                        status: {
                          '.tag': 'active';
                        };
                        name: {
                          given_name: 'Franz';
                          surname: 'Ferdinand';
                          familiar_name: 'Franz';
                          display_name: 'Franz Ferdinand (Personal)';
                          abbreviated_name: 'FF';
                        };
                        membership_type: {
                          '.tag': 'full';
                        };
                        groups: ['g:e2db7665347abcd600000000001a2b3c'];
                        member_folder_id: '20';
                        external_id: '244423';
                        account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        secondary_emails: [
                          {
                            email: 'grape@strawberry.com';
                            is_verified: false;
                          },
                          {
                            email: 'apple@orange.com';
                            is_verified: true;
                          },
                        ];
                        joined_on: '2015-05-12T15:50:38Z';
                        profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                      };
                      role: {
                        '.tag': 'member_only';
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/team/members/delete_profile_photo': {
      post: {
        tags: ['team > members'];
        summary: 'members/delete_profile_photo';
        description: "[members/delete_profile_photo](https://www.dropbox.com/developers/documentation/http/teams#team-members-delete_profile_photo)\n\nscope: `members.write`\n\nDeletes a team member's profile photo.\nPermission : Team member management.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"user\\": {\\n        \\".tag\\": \\"team_member_id\\", \\n        \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n    }\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  profile: {
                    team_member_id: 'dbmid:FDFSVF-DFSDF';
                    email: 'tami@seagull.com';
                    email_verified: false;
                    status: {
                      '.tag': 'active';
                    };
                    name: {
                      given_name: 'Franz';
                      surname: 'Ferdinand';
                      familiar_name: 'Franz';
                      display_name: 'Franz Ferdinand (Personal)';
                      abbreviated_name: 'FF';
                    };
                    membership_type: {
                      '.tag': 'full';
                    };
                    groups: ['g:e2db7665347abcd600000000001a2b3c'];
                    member_folder_id: '20';
                    external_id: '244423';
                    account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                    secondary_emails: [
                      {
                        email: 'grape@strawberry.com';
                        is_verified: false;
                      },
                      {
                        email: 'apple@orange.com';
                        is_verified: true;
                      },
                    ];
                    joined_on: '2015-05-12T15:50:38Z';
                    profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                  };
                  role: {
                    '.tag': 'member_only';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/team/members/get_info': {
      post: {
        tags: ['team > members'];
        summary: 'members/get_info';
        description: '[members/get_info](https://www.dropbox.com/developers/documentation/http/teams#team-members-get_info)\n\nscope: `members.read`\n\nReturns information about multiple team members.\nPermission : Team information\nThis endpoint will return `MembersGetInfoItem.id_not_found`, for IDs (or emails) that cannot be matched to a valid team member.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"members\\": [\\n        {\\n            \\".tag\\": \\"team_member_id\\", \\n            \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: [
                  {
                    '.tag': 'member_info';
                    profile: {
                      team_member_id: 'dbmid:FDFSVF-DFSDF';
                      email: 'tami@seagull.com';
                      email_verified: false;
                      status: {
                        '.tag': 'active';
                      };
                      name: {
                        given_name: 'Franz';
                        surname: 'Ferdinand';
                        familiar_name: 'Franz';
                        display_name: 'Franz Ferdinand (Personal)';
                        abbreviated_name: 'FF';
                      };
                      membership_type: {
                        '.tag': 'full';
                      };
                      groups: ['g:e2db7665347abcd600000000001a2b3c'];
                      member_folder_id: '20';
                      external_id: '244423';
                      account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                      secondary_emails: [
                        {
                          email: 'grape@strawberry.com';
                          is_verified: false;
                        },
                        {
                          email: 'apple@orange.com';
                          is_verified: true;
                        },
                      ];
                      joined_on: '2015-05-12T15:50:38Z';
                      profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                    };
                    role: {
                      '.tag': 'member_only';
                    };
                  },
                ];
              };
            };
          };
        };
      };
    };
    '/2/team/members/list': {
      post: {
        tags: ['team > members'];
        summary: 'members/list';
        description: '[members/list](https://www.dropbox.com/developers/documentation/http/teams#team-members-list)\n\nscope: `members.read`\n\nLists members of a team.\nPermission : Team information.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"limit\\": 100, \\n    \\"include_removed\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  members: [
                    {
                      profile: {
                        team_member_id: 'dbmid:FDFSVF-DFSDF';
                        email: 'tami@seagull.com';
                        email_verified: false;
                        status: {
                          '.tag': 'active';
                        };
                        name: {
                          given_name: 'Franz';
                          surname: 'Ferdinand';
                          familiar_name: 'Franz';
                          display_name: 'Franz Ferdinand (Personal)';
                          abbreviated_name: 'FF';
                        };
                        membership_type: {
                          '.tag': 'full';
                        };
                        groups: ['g:e2db7665347abcd600000000001a2b3c'];
                        member_folder_id: '20';
                        external_id: '244423';
                        account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        secondary_emails: [
                          {
                            email: 'grape@strawberry.com';
                            is_verified: false;
                          },
                          {
                            email: 'apple@orange.com';
                            is_verified: true;
                          },
                        ];
                        joined_on: '2015-05-12T15:50:38Z';
                        profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                      };
                      role: {
                        '.tag': 'member_only';
                      };
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                  has_more: true;
                };
              };
            };
          };
        };
      };
    };
    '/2/team/members/list/continue': {
      post: {
        tags: ['team > members'];
        summary: 'members/list/continue';
        description: '[members/list/continue](https://www.dropbox.com/developers/documentation/http/teams#team-members-list-continue)\n\nscope: `members.read`\n\nOnce a cursor has been retrieved from `members/list`, use this to paginate through all team members.\nPermission : Team information.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  members: [
                    {
                      profile: {
                        team_member_id: 'dbmid:FDFSVF-DFSDF';
                        email: 'tami@seagull.com';
                        email_verified: false;
                        status: {
                          '.tag': 'active';
                        };
                        name: {
                          given_name: 'Franz';
                          surname: 'Ferdinand';
                          familiar_name: 'Franz';
                          display_name: 'Franz Ferdinand (Personal)';
                          abbreviated_name: 'FF';
                        };
                        membership_type: {
                          '.tag': 'full';
                        };
                        groups: ['g:e2db7665347abcd600000000001a2b3c'];
                        member_folder_id: '20';
                        external_id: '244423';
                        account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                        secondary_emails: [
                          {
                            email: 'grape@strawberry.com';
                            is_verified: false;
                          },
                          {
                            email: 'apple@orange.com';
                            is_verified: true;
                          },
                        ];
                        joined_on: '2015-05-12T15:50:38Z';
                        profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                      };
                      role: {
                        '.tag': 'member_only';
                      };
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                  has_more: true;
                };
              };
            };
          };
        };
      };
    };
    '/2/team/members/move_former_member_files': {
      post: {
        tags: ['team > members'];
        summary: 'members/move_former_member_files';
        description: "[members/move_former_member_files](https://www.dropbox.com/developers/documentation/http/teams#team-members-move_former_member_files)\n\nscope: `members.write`\n\nMoves removed member's files to a different member. This endpoint initiates an asynchronous job. To obtain the final result of the job, the client should periodically poll `members/move_former_member_files/job_status/check`.\nPermission : Team member management.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"user\\": {\\n        \\".tag\\": \\"team_member_id\\", \\n        \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n    }, \\n    \\"transfer_dest_id\\": {\\n        \\".tag\\": \\"team_member_id\\", \\n        \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n    }, \\n    \\"transfer_admin_id\\": {\\n        \\".tag\\": \\"team_member_id\\", \\n        \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n    }\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                };
              };
            };
          };
        };
      };
    };
    '/2/team/members/move_former_member_files/job_status/check': {
      post: {
        tags: ['team > members'];
        summary: 'members/move_former_member_files/job_status/check';
        description: '[members/move_former_member_files/job_status/check](https://www.dropbox.com/developers/documentation/http/teams#team-members-move_former_member_files-job_status-check)\n\nscope: `members.write`\n\nOnce an async_job_id is returned from `members/move_former_member_files` , use this to poll the status of the asynchronous request.\nPermission : Team member management.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"async_job_id\\": \\"34g93hh34h04y384084\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                };
              };
            };
          };
        };
      };
    };
    '/2/team/members/recover': {
      post: {
        tags: ['team > members'];
        summary: 'members/recover';
        description: '[members/recover](https://www.dropbox.com/developers/documentation/http/teams#team-members-recover)\n\nscope: `members.delete`\n\nRecover a deleted member.\nPermission : Team member management\nExactly one of team_member_id, email, or external_id must be provided to identify the user account.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"user\\": {\\n        \\".tag\\": \\"team_member_id\\", \\n        \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n    }\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/members/remove': {
      post: {
        tags: ['team > members'];
        summary: 'members/remove';
        description: '[members/remove](https://www.dropbox.com/developers/documentation/http/teams#team-members-remove)\n\nscope: `members.delete`\n\nRemoves a member from a team.\nPermission : Team member management\nExactly one of team_member_id, email, or external_id must be provided to identify the user account.\nAccounts can be recovered via `members/recover` for a 7 day period or until the account has been permanently deleted or transferred to another account (whichever comes first). Calling `members/add` while a user is still recoverable on your team will return with `MemberAddResult.user_already_on_team`.\nAccounts can have their files transferred via the admin console for a limited time, based on the version history length associated with the team (180 days for most teams).\nThis endpoint may initiate an asynchronous job. To obtain the final result of the job, the client should periodically poll `members/remove/job_status/get`.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"user\\": {\\n        \\".tag\\": \\"team_member_id\\", \\n        \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n    }, \\n    \\"wipe_data\\": true, \\n    \\"transfer_dest_id\\": {\\n        \\".tag\\": \\"team_member_id\\", \\n        \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n    }, \\n    \\"transfer_admin_id\\": {\\n        \\".tag\\": \\"team_member_id\\", \\n        \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n    }, \\n    \\"keep_account\\": false, \\n    \\"retain_team_shares\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                };
              };
            };
          };
        };
      };
    };
    '/2/team/members/remove/job_status/get': {
      post: {
        tags: ['team > members'];
        summary: 'members/remove/job_status/get';
        description: '[members/remove/job_status/get](https://www.dropbox.com/developers/documentation/http/teams#team-members-remove-job_status-get)\n\nscope: `members.delete`\n\nOnce an async_job_id is returned from `members/remove` , use this to poll the status of the asynchronous request.\nPermission : Team member management.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"async_job_id\\": \\"34g93hh34h04y384084\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                };
              };
            };
          };
        };
      };
    };
    '/2/team/members/secondary_emails/add': {
      post: {
        tags: ['team > members'];
        summary: 'members/secondary_emails/add';
        description: '[members/secondary_emails/add](https://www.dropbox.com/developers/documentation/http/teams#team-members-secondary_emails-add)\n\nscope: `members.write`\n\nAdd secondary emails to users.\nPermission : Team member management.\nEmails that are on verified domains will be verified automatically. For each email address not on a verified domain a verification email will be sent.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"new_secondary_emails\\": [\\n        {\\n            \\"user\\": {\\n                \\".tag\\": \\"team_member_id\\", \\n                \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n            }, \\n            \\"secondary_emails\\": [\\n                \\"bob2@hotmail.com\\", \\n                \\"bob@inst.gov\\"\\n            ]\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  results: [
                    {
                      '.tag': 'success';
                      user: {
                        '.tag': 'team_member_id';
                        team_member_id: 'dbmid:efgh5678';
                      };
                      results: [
                        {
                          '.tag': 'success';
                          success: {
                            email: 'apple@orange.com';
                            is_verified: true;
                          };
                        },
                        {
                          '.tag': 'unavailable';
                          unavailable: 'alice@example.com';
                        },
                      ];
                    },
                    {
                      '.tag': 'invalid_user';
                      invalid_user: {
                        '.tag': 'team_member_id';
                        team_member_id: 'dbmid:efgh5678';
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/team/members/secondary_emails/delete': {
      post: {
        tags: ['team > members'];
        summary: 'members/secondary_emails/delete';
        description: '[members/secondary_emails/delete](https://www.dropbox.com/developers/documentation/http/teams#team-members-secondary_emails-delete)\n\nscope: `members.write`\n\nDelete secondary emails from users\nPermission : Team member management.\nUsers will be notified of deletions of verified secondary emails at both the secondary email and their primary email.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"emails_to_delete\\": [\\n        {\\n            \\"user\\": {\\n                \\".tag\\": \\"team_member_id\\", \\n                \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n            }, \\n            \\"secondary_emails\\": [\\n                \\"bob2@hotmail.com\\", \\n                \\"bob@inst.gov\\"\\n            ]\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  results: [
                    {
                      '.tag': 'success';
                      user: {
                        '.tag': 'team_member_id';
                        team_member_id: 'dbmid:efgh5678';
                      };
                      results: [
                        {
                          '.tag': 'success';
                          success: 'alice@example.com';
                        },
                        {
                          '.tag': 'not_found';
                          not_found: 'alic@example.com';
                        },
                      ];
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/team/members/secondary_emails/resend_verification_emails': {
      post: {
        tags: ['team > members'];
        summary: 'members/secondary_emails/resend_verification_emails';
        description: '[members/secondary_emails/resend_verification_emails](https://www.dropbox.com/developers/documentation/http/teams#team-members-secondary_emails-resend_verification_emails)\n\nscope: `members.write`\n\nResend secondary email verification emails.\nPermission : Team member management.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"emails_to_resend\\": [\\n        {\\n            \\"user\\": {\\n                \\".tag\\": \\"team_member_id\\", \\n                \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n            }, \\n            \\"secondary_emails\\": [\\n                \\"bob2@hotmail.com\\", \\n                \\"bob@inst.gov\\"\\n            ]\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  results: [
                    {
                      '.tag': 'success';
                      user: {
                        '.tag': 'team_member_id';
                        team_member_id: 'dbmid:efgh5678';
                      };
                      results: [
                        {
                          '.tag': 'success';
                          success: 'alice@example.com';
                        },
                      ];
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/team/members/send_welcome_email': {
      post: {
        tags: ['team > members'];
        summary: 'members/send_welcome_email';
        description: '[members/send_welcome_email](https://www.dropbox.com/developers/documentation/http/teams#team-members-send_welcome_email)\n\nscope: `members.write`\n\nSends welcome email to pending team member.\nPermission : Team member management\nExactly one of team_member_id, email, or external_id must be provided to identify the user account.\nNo-op if team member is not pending.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\".tag\\": \\"team_member_id\\", \\n    \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/members/set_admin_permissions': {
      post: {
        tags: ['team > members'];
        summary: 'members/set_admin_permissions';
        description: "[members/set_admin_permissions](https://www.dropbox.com/developers/documentation/http/teams#team-members-set_admin_permissions)\n\nscope: `members.write`\n\nUpdates a team member's permissions.\nPermission : Team member management.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"user\\": {\\n        \\".tag\\": \\"team_member_id\\", \\n        \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n    }, \\n    \\"new_role\\": \\"member_only\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  team_member_id: 'dbmid:9978889';
                  role: {
                    '.tag': 'member_only';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/team/members/set_profile': {
      post: {
        tags: ['team > members'];
        summary: 'members/set_profile';
        description: "[members/set_profile](https://www.dropbox.com/developers/documentation/http/teams#team-members-set_profile)\n\nscope: `members.write`\n\nUpdates a team member's profile.\nPermission : Team member management.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"user\\": {\\n        \\".tag\\": \\"team_member_id\\", \\n        \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n    }, \\n    \\"new_email\\": \\"t.smith@domain.com\\", \\n    \\"new_surname\\": \\"Smith\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  profile: {
                    team_member_id: 'dbmid:FDFSVF-DFSDF';
                    email: 'tami@seagull.com';
                    email_verified: false;
                    status: {
                      '.tag': 'active';
                    };
                    name: {
                      given_name: 'Franz';
                      surname: 'Ferdinand';
                      familiar_name: 'Franz';
                      display_name: 'Franz Ferdinand (Personal)';
                      abbreviated_name: 'FF';
                    };
                    membership_type: {
                      '.tag': 'full';
                    };
                    groups: ['g:e2db7665347abcd600000000001a2b3c'];
                    member_folder_id: '20';
                    external_id: '244423';
                    account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                    secondary_emails: [
                      {
                        email: 'grape@strawberry.com';
                        is_verified: false;
                      },
                      {
                        email: 'apple@orange.com';
                        is_verified: true;
                      },
                    ];
                    joined_on: '2015-05-12T15:50:38Z';
                    profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                  };
                  role: {
                    '.tag': 'member_only';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/team/members/set_profile_photo': {
      post: {
        tags: ['team > members'];
        summary: 'members/set_profile_photo';
        description: "[members/set_profile_photo](https://www.dropbox.com/developers/documentation/http/teams#team-members-set_profile_photo)\n\nscope: `members.write`\n\nUpdates a team member's profile photo.\nPermission : Team member management.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"user\\": {\\n        \\".tag\\": \\"team_member_id\\", \\n        \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n    }, \\n    \\"photo\\": {\\n        \\".tag\\": \\"base64_data\\", \\n        \\"base64_data\\": \\"SW1hZ2UgZGF0YSBpbiBiYXNlNjQtZW5jb2RlZCBieXRlcy4gTm90IGEgdmFsaWQgZXhhbXBsZS4=\\"\\n    }\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  profile: {
                    team_member_id: 'dbmid:FDFSVF-DFSDF';
                    email: 'tami@seagull.com';
                    email_verified: false;
                    status: {
                      '.tag': 'active';
                    };
                    name: {
                      given_name: 'Franz';
                      surname: 'Ferdinand';
                      familiar_name: 'Franz';
                      display_name: 'Franz Ferdinand (Personal)';
                      abbreviated_name: 'FF';
                    };
                    membership_type: {
                      '.tag': 'full';
                    };
                    groups: ['g:e2db7665347abcd600000000001a2b3c'];
                    member_folder_id: '20';
                    external_id: '244423';
                    account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                    secondary_emails: [
                      {
                        email: 'grape@strawberry.com';
                        is_verified: false;
                      },
                      {
                        email: 'apple@orange.com';
                        is_verified: true;
                      },
                    ];
                    joined_on: '2015-05-12T15:50:38Z';
                    profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                  };
                  role: {
                    '.tag': 'member_only';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/team/members/suspend': {
      post: {
        tags: ['team > members'];
        summary: 'members/suspend';
        description: '[members/suspend](https://www.dropbox.com/developers/documentation/http/teams#team-members-suspend)\n\nscope: `members.write`\n\nSuspend a member from a team.\nPermission : Team member management\nExactly one of team_member_id, email, or external_id must be provided to identify the user account.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"user\\": {\\n        \\".tag\\": \\"team_member_id\\", \\n        \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n    }, \\n    \\"wipe_data\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/members/unsuspend': {
      post: {
        tags: ['team > members'];
        summary: 'members/unsuspend';
        description: '[members/unsuspend](https://www.dropbox.com/developers/documentation/http/teams#team-members-unsuspend)\n\nscope: `members.write`\n\nUnsuspend a member from a team.\nPermission : Team member management\nExactly one of team_member_id, email, or external_id must be provided to identify the user account.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"user\\": {\\n        \\".tag\\": \\"team_member_id\\", \\n        \\"team_member_id\\": \\"dbmid:efgh5678\\"\\n    }\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/namespaces/list': {
      post: {
        tags: ['team > namespaces'];
        summary: 'namespaces/list';
        description: "[namespaces/list](https://www.dropbox.com/developers/documentation/http/teams#team-namespaces-list)\n\nscope: `team_data.member`\n\nReturns a list of all team-accessible namespaces. This list includes team folders, shared folders containing team members, team members' home namespaces, and team members' app folders. Home namespaces and app folders are always owned by this team or members of the team, but shared folders may be owned by other users or other teams. Duplicates may occur in the list.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"limit\\": 1\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  namespaces: [
                    {
                      name: 'Marketing';
                      namespace_id: '123456789';
                      namespace_type: {
                        '.tag': 'shared_folder';
                      };
                    },
                    {
                      name: 'Franz Ferdinand';
                      namespace_id: '123456789';
                      namespace_type: {
                        '.tag': 'team_member_folder';
                      };
                      team_member_id: 'dbmid:1234567';
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                  has_more: false;
                };
              };
            };
          };
        };
      };
    };
    '/2/team/namespaces/list/continue': {
      post: {
        tags: ['team > namespaces'];
        summary: 'namespaces/list/continue';
        description: '[namespaces/list/continue](https://www.dropbox.com/developers/documentation/http/teams#team-namespaces-list-continue)\n\nscope: `team_data.member`\n\nOnce a cursor has been retrieved from `namespaces/list`, use this to paginate through all team-accessible namespaces. Duplicates may occur in the list.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  namespaces: [
                    {
                      name: 'Marketing';
                      namespace_id: '123456789';
                      namespace_type: {
                        '.tag': 'shared_folder';
                      };
                    },
                    {
                      name: 'Franz Ferdinand';
                      namespace_id: '123456789';
                      namespace_type: {
                        '.tag': 'team_member_folder';
                      };
                      team_member_id: 'dbmid:1234567';
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                  has_more: false;
                };
              };
            };
          };
        };
      };
    };
    '/2/team/reports/get_activity': {
      post: {
        tags: ['team > reports'];
        summary: 'reports/get_activity';
        description: "[reports/get_activity](https://www.dropbox.com/developers/documentation/http/teams#team-reports-get_activity)\n\nscope: `team_info.read`\n\nRetrieves reporting data about a team's user activity.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '""';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/reports/get_devices': {
      post: {
        tags: ['team > reports'];
        summary: 'reports/get_devices';
        description: "[reports/get_devices](https://www.dropbox.com/developers/documentation/http/teams#team-reports-get_devices)\n\nscope: `team_info.read`\n\nRetrieves reporting data about a team's linked devices.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '""';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/reports/get_membership': {
      post: {
        tags: ['team > reports'];
        summary: 'reports/get_membership';
        description: "[reports/get_membership](https://www.dropbox.com/developers/documentation/http/teams#team-reports-get_membership)\n\nscope: `team_info.read`\n\nRetrieves reporting data about a team's membership.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '""';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/reports/get_storage': {
      post: {
        tags: ['team > reports'];
        summary: 'reports/get_storage';
        description: "[reports/get_storage](https://www.dropbox.com/developers/documentation/http/teams#team-reports-get_storage)\n\nscope: `team_info.read`\n\nRetrieves reporting data about a team's storage usage.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '""';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/team_folder/activate': {
      post: {
        tags: ['team > team_folder'];
        summary: 'team_folder/activate';
        description: "[team_folder/activate](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-activate)\n\nscope: `team_data.team_space`\n\nSets an archived team folder's status to active.\nPermission : Team member file access.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"team_folder_id\\": \\"123456789\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  team_folder_id: '123456789';
                  name: 'Marketing';
                  status: {
                    '.tag': 'active';
                  };
                  is_team_shared_dropbox: false;
                  sync_setting: {
                    '.tag': 'default';
                  };
                  content_sync_settings: [
                    {
                      id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                      sync_setting: {
                        '.tag': 'default';
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/team/team_folder/archive': {
      post: {
        tags: ['team > team_folder'];
        summary: 'team_folder/archive';
        description: "[team_folder/archive](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-archive)\n\nscope: `team_data.team_space`\n\nSets an active team folder's status to archived and removes all folder and file members.\nPermission : Team member file access.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"team_folder_id\\": \\"123456789\\", \\n    \\"force_async_off\\": false\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  team_folder_id: '123456789';
                  name: 'Marketing';
                  status: {
                    '.tag': 'active';
                  };
                  is_team_shared_dropbox: false;
                  sync_setting: {
                    '.tag': 'default';
                  };
                  content_sync_settings: [
                    {
                      id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                      sync_setting: {
                        '.tag': 'default';
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/team/team_folder/archive/check': {
      post: {
        tags: ['team > team_folder'];
        summary: 'team_folder/archive/check';
        description: '[team_folder/archive/check](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-archive-check)\n\nscope: `team_data.team_space`\n\nReturns the status of an asynchronous job for archiving a team folder.\nPermission : Team member file access.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"async_job_id\\": \\"34g93hh34h04y384084\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  '.tag': 'complete';
                  team_folder_id: '123456789';
                  name: 'Marketing';
                  status: {
                    '.tag': 'active';
                  };
                  is_team_shared_dropbox: false;
                  sync_setting: {
                    '.tag': 'default';
                  };
                  content_sync_settings: [
                    {
                      id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                      sync_setting: {
                        '.tag': 'default';
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/team/team_folder/create': {
      post: {
        tags: ['team > team_folder'];
        summary: 'team_folder/create';
        description: '[team_folder/create](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-create)\n\nscope: `team_data.team_space`\n\nCreates a new, active, team folder with no members.\nPermission : Team member file access.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"name\\": \\"Marketing\\", \\n    \\"sync_setting\\": \\"not_synced\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  team_folder_id: '123456789';
                  name: 'Marketing';
                  status: {
                    '.tag': 'active';
                  };
                  is_team_shared_dropbox: false;
                  sync_setting: {
                    '.tag': 'default';
                  };
                  content_sync_settings: [
                    {
                      id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                      sync_setting: {
                        '.tag': 'default';
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/team/team_folder/get_info': {
      post: {
        tags: ['team > team_folder'];
        summary: 'team_folder/get_info';
        description: '[team_folder/get_info](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-get_info)\n\nscope: `team_data.team_space`\n\nRetrieves metadata for team folders.\nPermission : Team member file access.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"team_folder_ids\\": [\\n        \\"947182\\", \\n        \\"5819424\\", \\n        \\"852307532\\"\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/team_folder/list': {
      post: {
        tags: ['team > team_folder'];
        summary: 'team_folder/list';
        description: '[team_folder/list](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-list)\n\nscope: `team_data.team_space`\n\nLists all team folders.\nPermission : Team member file access.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"limit\\": 100\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  team_folders: [
                    {
                      team_folder_id: '123456789';
                      name: 'Marketing';
                      status: {
                        '.tag': 'active';
                      };
                      is_team_shared_dropbox: false;
                      sync_setting: {
                        '.tag': 'default';
                      };
                      content_sync_settings: [
                        {
                          id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                          sync_setting: {
                            '.tag': 'default';
                          };
                        },
                      ];
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                  has_more: false;
                };
              };
            };
          };
        };
      };
    };
    '/2/team/team_folder/list/continue': {
      post: {
        tags: ['team > team_folder'];
        summary: 'team_folder/list/continue';
        description: '[team_folder/list/continue](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-list-continue)\n\nscope: `team_data.team_space`\n\nOnce a cursor has been retrieved from `team_folder/list`, use this to paginate through all team folders.\nPermission : Team member file access.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  team_folders: [
                    {
                      team_folder_id: '123456789';
                      name: 'Marketing';
                      status: {
                        '.tag': 'active';
                      };
                      is_team_shared_dropbox: false;
                      sync_setting: {
                        '.tag': 'default';
                      };
                      content_sync_settings: [
                        {
                          id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                          sync_setting: {
                            '.tag': 'default';
                          };
                        },
                      ];
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                  has_more: false;
                };
              };
            };
          };
        };
      };
    };
    '/2/team/team_folder/permanently_delete': {
      post: {
        tags: ['team > team_folder'];
        summary: 'team_folder/permanently_delete';
        description: '[team_folder/permanently_delete](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-permanently_delete)\n\nscope: `team_data.team_space`\n\nPermanently deletes an archived team folder.\nPermission : Team member file access.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"team_folder_id\\": \\"123456789\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'Successful response';
            content: {
              'application/json': {};
            };
          };
        };
      };
    };
    '/2/team/team_folder/rename': {
      post: {
        tags: ['team > team_folder'];
        summary: 'team_folder/rename';
        description: "[team_folder/rename](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-rename)\n\nscope: `team_data.team_space`\n\nChanges an active team folder's name.\nPermission : Team member file access.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"team_folder_id\\": \\"123456789\\", \\n    \\"name\\": \\"Sales\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  team_folder_id: '123456789';
                  name: 'Marketing';
                  status: {
                    '.tag': 'active';
                  };
                  is_team_shared_dropbox: false;
                  sync_setting: {
                    '.tag': 'default';
                  };
                  content_sync_settings: [
                    {
                      id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                      sync_setting: {
                        '.tag': 'default';
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/team/team_folder/update_sync_settings': {
      post: {
        tags: ['team > team_folder'];
        summary: 'team_folder/update_sync_settings';
        description: '[team_folder/update_sync_settings](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-update_sync_settings)\n\nscope: `team_data.team_space`\n\nUpdates the sync settings on a team folder or its contents.  Use of this endpoint requires that the team has team selective sync enabled.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"team_folder_id\\": \\"123456789\\", \\n    \\"sync_setting\\": \\"not_synced\\", \\n    \\"content_sync_settings\\": [\\n        {\\n            \\"id\\": \\"id:a4ayc_80_OEAAAAAAAAAXw\\", \\n            \\"sync_setting\\": \\"not_synced\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  team_folder_id: '123456789';
                  name: 'Marketing';
                  status: {
                    '.tag': 'active';
                  };
                  is_team_shared_dropbox: false;
                  sync_setting: {
                    '.tag': 'default';
                  };
                  content_sync_settings: [
                    {
                      id: 'id:a4ayc_80_OEAAAAAAAAAXw';
                      sync_setting: {
                        '.tag': 'default';
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/team/features/get_values': {
      post: {
        tags: ['team'];
        summary: 'features/get_values';
        description: "[features/get_values](https://www.dropbox.com/developers/documentation/http/teams#team-features-get_values)\n\nscope: `team_info.read`\n\nGet the values for one or more featues. This route allows you to check your account's capability for what feature you can access or what value you have for certain features.\nPermission : Team information.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"features\\": [\\n        {\\n            \\".tag\\": \\"upload_api_rate_limit\\"\\n        }, \\n        {\\n            \\".tag\\": \\"has_team_shared_dropbox\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  values: [
                    {
                      '.tag': 'upload_api_rate_limit';
                      upload_api_rate_limit: {
                        '.tag': 'limit';
                        limit: 25000;
                      };
                    },
                    {
                      '.tag': 'has_team_shared_dropbox';
                      has_team_shared_dropbox: {
                        '.tag': 'has_team_shared_dropbox';
                        has_team_shared_dropbox: false;
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/team/get_info': {
      post: {
        tags: ['team'];
        summary: 'get_info';
        description: '[get_info](https://www.dropbox.com/developers/documentation/http/teams#team-get_info)\n\nscope: `team_info.read`\n\nRetrieves information about a team.      ';
        security: [
          {
            bearerAuth: [];
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  name: 'Dropbox Inc.';
                  team_id: 'dbtid:1234abcd';
                  num_licensed_users: 5;
                  num_provisioned_users: 2;
                  policies: {
                    sharing: {
                      shared_folder_member_policy: {
                        '.tag': 'team';
                      };
                      shared_folder_join_policy: {
                        '.tag': 'from_anyone';
                      };
                      shared_link_create_policy: {
                        '.tag': 'team_only';
                      };
                    };
                    emm_state: {
                      '.tag': 'disabled';
                    };
                    office_addin: {
                      '.tag': 'disabled';
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/team/token/get_authenticated_admin': {
      post: {
        tags: ['team'];
        summary: 'token/get_authenticated_admin';
        description: '[token/get_authenticated_admin](https://www.dropbox.com/developers/documentation/http/teams#team-token-get_authenticated_admin)\n\nscope: `team_info.read`\n\nReturns the member profile of the admin who generated the team access token used to make the call.      ';
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  admin_profile: {
                    team_member_id: 'dbmid:FDFSVF-DFSDF';
                    email: 'tami@seagull.com';
                    email_verified: false;
                    status: {
                      '.tag': 'active';
                    };
                    name: {
                      given_name: 'Franz';
                      surname: 'Ferdinand';
                      familiar_name: 'Franz';
                      display_name: 'Franz Ferdinand (Personal)';
                      abbreviated_name: 'FF';
                    };
                    membership_type: {
                      '.tag': 'full';
                    };
                    groups: ['g:e2db7665347abcd600000000001a2b3c'];
                    member_folder_id: '20';
                    external_id: '244423';
                    account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                    secondary_emails: [
                      {
                        email: 'grape@strawberry.com';
                        is_verified: false;
                      },
                      {
                        email: 'apple@orange.com';
                        is_verified: true;
                      },
                    ];
                    joined_on: '2015-05-12T15:50:38Z';
                    profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                  };
                };
              };
            };
          };
        };
      };
    };
    '/2/team_log/get_events': {
      post: {
        tags: ['team_log'];
        summary: 'get_events';
        description: "[get_events](https://www.dropbox.com/developers/documentation/http/teams#team_log-get_events)\n\nscope: `events.read`\n\nRetrieves team events. If the result's `GetTeamEventsResult.has_more` field is `true`, call `get_events/continue` with the returned cursor to retrieve more entries. If end_time is not specified in your request, you may use the returned cursor to poll `get_events/continue` for new events.\nMany attributes note 'may be missing due to historical data gap'.\nNote that the file_operations category and & analogous paper events are not available on all Dropbox Business [plans](http://www.dropbox.com/business/plans-comparison). Use [features/get_values](http://www.dropbox.com/developers/documentation/http/teams#team-features-get_values) to check for this feature.\nPermission : Team Auditing.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"limit\\": 50, \\n    \\"category\\": \\"groups\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  events: [
                    {
                      timestamp: '2017-01-25T15:51:30Z';
                      event_category: {
                        '.tag': 'tfa';
                      };
                      event_type: {
                        '.tag': 'shared_content_download';
                        description: '(sharing) Downloaded shared file/folder';
                      };
                      details: {
                        '.tag': 'shared_content_download_details';
                        shared_content_link: 'abc';
                        shared_content_access_level: {
                          '.tag': 'viewer_no_comment';
                        };
                        shared_content_owner: {
                          '.tag': 'team_member';
                          account_id: 'dbid:AAHgR8xsQP48a5DQUGPo-Vxsrjd0OByVmho';
                          display_name: 'John Smith';
                          email: 'john_smith@acmecorp.com';
                          team_member_id: 'dbmid:AAFoi-tmvRuQR0jU-3fN4B-9nZo6nHcDO9Q';
                          member_external_id: 'ADSYNC S-1-5-21-1004296348-1135238915-682003432-1224';
                          team: {
                            display_name: 'A Team';
                          };
                        };
                      };
                      actor: {
                        '.tag': 'user';
                        user: {
                          '.tag': 'team_member';
                          account_id: 'dbid:AAHgR8xsQP48a5DQUGPo-Vxsrjd0OByVmho';
                          display_name: 'John Smith';
                          email: 'john_smith@acmecorp.com';
                          team_member_id: 'dbmid:AAFoi-tmvRuQR0jU-3fN4B-9nZo6nHcDO9Q';
                          member_external_id: 'ADSYNC S-1-5-21-1004296348-1135238915-682003432-1224';
                          team: {
                            display_name: 'A Team';
                          };
                        };
                      };
                      origin: {
                        access_method: {
                          '.tag': 'end_user';
                          end_user: {
                            '.tag': 'web';
                            session_id: 'dbwsid:123456789012345678901234567890123456789';
                          };
                        };
                        geo_location: {
                          ip_address: '45.56.78.100';
                          city: 'San Francisco';
                          region: 'California';
                          country: 'US';
                        };
                      };
                      involve_non_team_member: true;
                      context: {
                        '.tag': 'team_member';
                        account_id: 'dbid:AAHgR8xsQP48a5DQUGPo-Vxsrjd0OByVmho';
                        display_name: 'John Smith';
                        email: 'john_smith@acmecorp.com';
                        team_member_id: 'dbmid:AAFoi-tmvRuQR0jU-3fN4B-9nZo6nHcDO9Q';
                        member_external_id: 'ADSYNC S-1-5-21-1004296348-1135238915-682003432-1224';
                        team: {
                          display_name: 'A Team';
                        };
                      };
                      participants: [
                        {
                          '.tag': 'user';
                          user: {
                            '.tag': 'team_member';
                            account_id: 'dbid:AAGx4oiLtHdvRdNxUpvvJBXYgR4BS19c9kw';
                            display_name: 'Jane Smith';
                            email: 'jane_smith@acmecorp.com';
                            team_member_id: 'dbmid:AAFoi-tmvRuQR0jU-3fN4B-9nZo6nHcDO9Q';
                            member_external_id: 'ADSYNC S-1-5-21-1004296348-1135238915-682003432-1225';
                            team: {
                              display_name: 'A Team';
                            };
                          };
                        },
                      ];
                      assets: [
                        {
                          '.tag': 'file';
                          path: {
                            namespace_relative: {
                              ns_id: '1234';
                              relative_path: '/Contract Work/Draft';
                              is_shared_namespace: false;
                            };
                            contextual: '/Contract Work/Draft';
                          };
                          display_name: 'reports.xls';
                          file_id: 'id:jQKLsZFQImAAAAAAEZAAQt';
                          file_size: 4;
                        },
                      ];
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                  has_more: false;
                };
              };
            };
          };
        };
      };
    };
    '/2/team_log/get_events/continue': {
      post: {
        tags: ['team_log'];
        summary: 'get_events/continue';
        description: '[get_events/continue](https://www.dropbox.com/developers/documentation/http/teams#team_log-get_events-continue)\n\nscope: `events.read`\n\nOnce a cursor has been retrieved from `get_events`, use this to paginate through all events.\nPermission : Team Auditing.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"cursor\\": \\"ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  events: [
                    {
                      timestamp: '2017-01-25T15:51:30Z';
                      event_category: {
                        '.tag': 'tfa';
                      };
                      event_type: {
                        '.tag': 'shared_content_download';
                        description: '(sharing) Downloaded shared file/folder';
                      };
                      details: {
                        '.tag': 'shared_content_download_details';
                        shared_content_link: 'abc';
                        shared_content_access_level: {
                          '.tag': 'viewer_no_comment';
                        };
                        shared_content_owner: {
                          '.tag': 'team_member';
                          account_id: 'dbid:AAHgR8xsQP48a5DQUGPo-Vxsrjd0OByVmho';
                          display_name: 'John Smith';
                          email: 'john_smith@acmecorp.com';
                          team_member_id: 'dbmid:AAFoi-tmvRuQR0jU-3fN4B-9nZo6nHcDO9Q';
                          member_external_id: 'ADSYNC S-1-5-21-1004296348-1135238915-682003432-1224';
                          team: {
                            display_name: 'A Team';
                          };
                        };
                      };
                      actor: {
                        '.tag': 'user';
                        user: {
                          '.tag': 'team_member';
                          account_id: 'dbid:AAHgR8xsQP48a5DQUGPo-Vxsrjd0OByVmho';
                          display_name: 'John Smith';
                          email: 'john_smith@acmecorp.com';
                          team_member_id: 'dbmid:AAFoi-tmvRuQR0jU-3fN4B-9nZo6nHcDO9Q';
                          member_external_id: 'ADSYNC S-1-5-21-1004296348-1135238915-682003432-1224';
                          team: {
                            display_name: 'A Team';
                          };
                        };
                      };
                      origin: {
                        access_method: {
                          '.tag': 'end_user';
                          end_user: {
                            '.tag': 'web';
                            session_id: 'dbwsid:123456789012345678901234567890123456789';
                          };
                        };
                        geo_location: {
                          ip_address: '45.56.78.100';
                          city: 'San Francisco';
                          region: 'California';
                          country: 'US';
                        };
                      };
                      involve_non_team_member: true;
                      context: {
                        '.tag': 'team_member';
                        account_id: 'dbid:AAHgR8xsQP48a5DQUGPo-Vxsrjd0OByVmho';
                        display_name: 'John Smith';
                        email: 'john_smith@acmecorp.com';
                        team_member_id: 'dbmid:AAFoi-tmvRuQR0jU-3fN4B-9nZo6nHcDO9Q';
                        member_external_id: 'ADSYNC S-1-5-21-1004296348-1135238915-682003432-1224';
                        team: {
                          display_name: 'A Team';
                        };
                      };
                      participants: [
                        {
                          '.tag': 'user';
                          user: {
                            '.tag': 'team_member';
                            account_id: 'dbid:AAGx4oiLtHdvRdNxUpvvJBXYgR4BS19c9kw';
                            display_name: 'Jane Smith';
                            email: 'jane_smith@acmecorp.com';
                            team_member_id: 'dbmid:AAFoi-tmvRuQR0jU-3fN4B-9nZo6nHcDO9Q';
                            member_external_id: 'ADSYNC S-1-5-21-1004296348-1135238915-682003432-1225';
                            team: {
                              display_name: 'A Team';
                            };
                          };
                        },
                      ];
                      assets: [
                        {
                          '.tag': 'file';
                          path: {
                            namespace_relative: {
                              ns_id: '1234';
                              relative_path: '/Contract Work/Draft';
                              is_shared_namespace: false;
                            };
                            contextual: '/Contract Work/Draft';
                          };
                          display_name: 'reports.xls';
                          file_id: 'id:jQKLsZFQImAAAAAAEZAAQt';
                          file_size: 4;
                        },
                      ];
                    },
                  ];
                  cursor: 'ZtkX9_EHj3x7PMkVuFIhwKYXEpwpLwyxp9vMKomUhllil9q7eWiAu';
                  has_more: false;
                };
              };
            };
          };
        };
      };
    };
    '/2/users/features/get_values': {
      post: {
        tags: ['users'];
        summary: 'features/get_values';
        description: '[features/get_values](https://www.dropbox.com/developers/documentation/http/documentation#users-features-get_values)\n\nscope: `account_info.read`\n\nGet a list of feature values that may be configured for the current account.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"features\\": [\\n        {\\n            \\".tag\\": \\"paper_as_files\\"\\n        }, \\n        {\\n            \\".tag\\": \\"file_locking\\"\\n        }\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  values: [
                    {
                      '.tag': 'paper_as_files';
                      paper_as_files: {
                        '.tag': 'enabled';
                        enabled: true;
                      };
                    },
                  ];
                };
              };
            };
          };
        };
      };
    };
    '/2/users/get_account': {
      post: {
        tags: ['users'];
        summary: 'get_account';
        description: "[get_account](https://www.dropbox.com/developers/documentation/http/documentation#users-get_account)\n\nscope: `sharing.read`\n\nGet information about a user's account.";
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"account_id\\": \\"dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc\\"\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                  name: {
                    given_name: 'Franz';
                    surname: 'Ferdinand';
                    familiar_name: 'Franz';
                    display_name: 'Franz Ferdinand (Personal)';
                    abbreviated_name: 'FF';
                  };
                  email: 'franz@dropbox.com';
                  email_verified: true;
                  disabled: false;
                  is_teammate: false;
                  profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                };
              };
            };
          };
        };
      };
    };
    '/2/users/get_account_batch': {
      post: {
        tags: ['users'];
        summary: 'get_account_batch';
        description: '[get_account_batch](https://www.dropbox.com/developers/documentation/http/documentation#users-get_account_batch)\n\nscope: `sharing.read`\n\nGet information about multiple user accounts.  At most 300 accounts may be queried per request.';
        requestBody: {
          content: {
            '*/*': {
              schema: {
                type: 'string';
                example: '"{\\n    \\"account_ids\\": [\\n        \\"dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc\\", \\n        \\"dbid:AAH1Vcz-DVoRDeixtr_OA8oUGgiqhs4XPOQ\\"\\n    ]\\n}"';
              };
            };
          };
        };
        parameters: [
          {
            name: 'Content-Type';
            in: 'header';
            schema: {
              type: 'string';
            };
            example: 'application/json';
          },
        ];
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: [
                  {
                    account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                    name: {
                      given_name: 'Franz';
                      surname: 'Ferdinand';
                      familiar_name: 'Franz';
                      display_name: 'Franz Ferdinand (Personal)';
                      abbreviated_name: 'FF';
                    };
                    email: 'franz@dropbox.com';
                    email_verified: true;
                    disabled: false;
                    is_teammate: false;
                    profile_photo_url: 'https://dl-web.dropbox.com/account_photo/get/dbaphid%3AAAHWGmIXV3sUuOmBfTz0wPsiqHUpBWvv3ZA?vers=1556069330102&size=128x128';
                  },
                ];
              };
            };
          };
        };
      };
    };
    '/2/users/get_current_account': {
      post: {
        tags: ['users'];
        summary: 'get_current_account';
        description: "[get_current_account](https://www.dropbox.com/developers/documentation/http/documentation#users-get_current_account)\n\nscope: `account_info.read`\n\nGet information about the current user's account.      ";
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  account_id: 'dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc';
                  name: {
                    given_name: 'Franz';
                    surname: 'Ferdinand';
                    familiar_name: 'Franz';
                    display_name: 'Franz Ferdinand (Personal)';
                    abbreviated_name: 'FF';
                  };
                  email: 'franz@dropbox.com';
                  email_verified: true;
                  disabled: false;
                  locale: 'en';
                  referral_link: 'https://db.tt/ZITNuhtI';
                  is_paired: true;
                  account_type: {
                    '.tag': 'business';
                  };
                  root_info: {
                    '.tag': 'user';
                    root_namespace_id: '3235641';
                    home_namespace_id: '3235641';
                  };
                  country: 'US';
                  team: {
                    id: 'dbtid:AAFdgehTzw7WlXhZJsbGCLePe8RvQGYDr-I';
                    name: 'Acme, Inc.';
                    sharing_policies: {
                      shared_folder_member_policy: {
                        '.tag': 'team';
                      };
                      shared_folder_join_policy: {
                        '.tag': 'from_anyone';
                      };
                      shared_link_create_policy: {
                        '.tag': 'team_only';
                      };
                    };
                    office_addin_policy: {
                      '.tag': 'disabled';
                    };
                  };
                  team_member_id: 'dbmid:AAHhy7WsR0x-u4ZCqiDl5Fz5zvuL3kmspwU';
                };
              };
            };
          };
        };
      };
    };
    '/2/users/get_space_usage': {
      post: {
        tags: ['users'];
        summary: 'get_space_usage';
        description: "[get_space_usage](https://www.dropbox.com/developers/documentation/http/documentation#users-get_space_usage)\n\nscope: `account_info.read`\n\nGet the space usage information for the current user's account.      ";
        responses: {
          '200': {
            description: 'OK';
            headers: {
              'X-Dropbox-Request-Id': {
                schema: {
                  type: 'integer';
                  example: '1234';
                };
              };
              'Content-Type': {
                schema: {
                  type: 'string';
                  example: 'application/json';
                };
              };
            };
            content: {
              'application/json': {
                schema: {
                  type: 'object';
                };
                example: {
                  used: 314159265;
                  allocation: {
                    '.tag': 'individual';
                    allocated: 10000000000;
                  };
                };
              };
            };
          };
        };
      };
    };
  };
};
