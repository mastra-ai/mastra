// @ts-nocheck
export type openapi = {
  "openapi": "3.0.0",
  "servers": [
    {
      "description": "Main endpoint.",
      "url": "https://app.asana.com/api/1.0"
    }
  ],
  "security": [
    {
      "personalAccessToken": []
    },
    {
      "oauth2": []
    }
  ],
  "paths": {
    "/attachments": {
      "get": {
        "description": "Returns the compact records for all attachments on the object.\n\nThere are three possible `parent` values for this request: `project`, `project_brief`, and `task`. For a project, an attachment refers to a file uploaded to the \"Key resources\" section in the project Overview. For a project brief, an attachment refers to inline files in the project brief itself. For a task, an attachment refers to a file directly associated to that task.",
        "operationId": "getAttachmentsForObject",
        "parameters": [
          {
            "$ref": "#/components/parameters/limit"
          },
          {
            "$ref": "#/components/parameters/offset"
          },
          {
            "description": "Globally unique identifier for object to fetch statuses from. Must be a GID for a `project`, `project_brief`, or `task`.",
            "example": "159874",
            "in": "query",
            "name": "parent",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/AttachmentCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the specified object's attachments."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get attachments from an object",
        "tags": [
          "Attachments"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Upload an attachment.\n\nThis method uploads an attachment on an object and returns the compact\nrecord for the created attachment object. This is possible by either:\n\n- Providing the URL of the external resource being attached, or\n- Downloading the file content first and then uploading it as any other attachment. Note that it is not possible to attach\nfiles from third party services such as Dropbox, Box, Vimeo & Google Drive via the API\n\nThe 100MB size limit on attachments in Asana is enforced on this endpoint.\n\nThis endpoint expects a multipart/form-data encoded request containing the full contents of the file to be uploaded.\n\nRequests made should follow the HTTP/1.1 specification that line\nterminators are of the form `CRLF` or `\\r\\n` outlined\n[here](http://www.w3.org/Protocols/HTTP/1.1/draft-ietf-http-v11-spec-01#Basic-Rules) in order for the server to reliably and properly handle the request.",
        "operationId": "createAttachmentForObject",
        "requestBody": {
          "content": {
            "multipart/form-data": {
              "schema": {
                "$ref": "#/components/schemas/AttachmentRequest"
              }
            }
          },
          "description": "The file you want to upload.\n\n*Note when using curl:*\n\nBe sure to add an `‘@’` before the file path, and use the `--form`\noption instead of the `-d` option.\n\nWhen uploading PDFs with curl, force the content-type to be pdf by\nappending the content type to the file path: `--form\n\"file=@file.pdf;type=application/pdf\"`.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/AttachmentResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully uploaded the attachment to the parent object."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Upload an attachment",
        "tags": [
          "Attachments"
        ]
      }
    },
    "/attachments/{attachment_gid}": {
      "delete": {
        "description": "Deletes a specific, existing attachment.\n\nReturns an empty data record.",
        "operationId": "deleteAttachment",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully deleted the specified attachment."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Delete an attachment",
        "tags": [
          "Attachments"
        ]
      },
      "get": {
        "description": "Get the full record for a single attachment.",
        "operationId": "getAttachment",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/AttachmentResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the record for a single attachment."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "424": {
            "$ref": "#/components/responses/TooManyRequests"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          },
          "501": {
            "$ref": "#/components/responses/BadGateway"
          },
          "503": {
            "$ref": "#/components/responses/ServiceUnavailable"
          },
          "504": {
            "$ref": "#/components/responses/GatewayTimeout"
          }
        },
        "summary": "Get an attachment",
        "tags": [
          "Attachments"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/attachment_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/batch": {
      "parameters": [
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Make multiple requests in parallel to Asana's API.",
        "operationId": "createBatchRequest",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/BatchRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The requests to batch together via the Batch API.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/BatchResponse"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully completed the requested batch API operations."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Submit parallel requests",
        "tags": [
          "Batch API"
        ]
      }
    },
    "/custom_fields": {
      "parameters": [
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ],
      "post": {
        "description": "Creates a new custom field in a workspace. Every custom field is required\nto be created in a specific workspace, and this workspace cannot be\nchanged once set.\n\nA custom field’s name must be unique within a workspace and not conflict\nwith names of existing task properties such as `Due Date` or `Assignee`.\nA custom field’s type must be one of `text`, `enum`, `multi_enum`, `number`,\n`date`, or `people`.\n\nReturns the full record of the newly created custom field.",
        "operationId": "createCustomField",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/CustomFieldRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The custom field object to create."
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/CustomFieldResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Custom field successfully created."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a custom field",
        "tags": [
          "Custom fields"
        ]
      }
    },
    "/custom_fields/{custom_field_gid}": {
      "delete": {
        "description": "A specific, existing custom field can be deleted by making a DELETE request on the URL for that custom field.\nLocked custom fields can only be deleted by the user who locked the field.\nReturns an empty data record.",
        "operationId": "deleteCustomField",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "The custom field was successfully deleted."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Delete a custom field",
        "tags": [
          "Custom fields"
        ]
      },
      "get": {
        "description": "Get the complete definition of a custom field’s metadata.\n\nSince custom fields can be defined for one of a number of types, and\nthese types have different data and behaviors, there are fields that are\nrelevant to a particular type. For instance, as noted above, enum_options\nis only relevant for the enum type and defines the set of choices that\nthe enum could represent. The examples below show some of these\ntype-specific custom field definitions.",
        "operationId": "getCustomField",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/CustomFieldResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the complete definition of a custom field’s metadata."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a custom field",
        "tags": [
          "Custom fields"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/custom_field_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "put": {
        "description": "A specific, existing custom field can be updated by making a PUT request on the URL for that custom field. Only the fields provided in the `data` block will be updated; any unspecified fields will remain unchanged\nWhen using this method, it is best to specify only those fields you wish to change, or else you may overwrite changes made by another user since you last retrieved the custom field.\nA custom field’s `type` cannot be updated.\nAn enum custom field’s `enum_options` cannot be updated with this endpoint. Instead see “Work With Enum Options” for information on how to update `enum_options`.\nLocked custom fields can only be updated by the user who locked the field.\nReturns the complete updated custom field record.",
        "operationId": "updateCustomField",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/CustomFieldRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The custom field object with all updated properties."
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/CustomFieldResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "The custom field was successfully updated."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Update a custom field",
        "tags": [
          "Custom fields"
        ]
      }
    },
    "/custom_fields/{custom_field_gid}/enum_options": {
      "parameters": [
        {
          "$ref": "#/components/parameters/custom_field_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ],
      "post": {
        "description": "Creates an enum option and adds it to this custom field’s list of enum options. A custom field can have at most 500 enum options (including disabled options). By default new enum options are inserted at the end of a custom field’s list.\nLocked custom fields can only have enum options added by the user who locked the field.\nReturns the full record of the newly created enum option.",
        "operationId": "createEnumOptionForCustomField",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/EnumOptionRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The enum option object to create."
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EnumOption"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Custom field enum option successfully created."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create an enum option",
        "tags": [
          "Custom fields"
        ]
      }
    },
    "/custom_fields/{custom_field_gid}/enum_options/insert": {
      "parameters": [
        {
          "$ref": "#/components/parameters/custom_field_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Moves a particular enum option to be either before or after another specified enum option in the custom field.\nLocked custom fields can only be reordered by the user who locked the field.",
        "operationId": "insertEnumOptionForCustomField",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/EnumOptionInsertRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The enum option object to create."
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EnumOption"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Custom field enum option successfully reordered."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Reorder a custom field's enum",
        "tags": [
          "Custom fields"
        ]
      }
    },
    "/enum_options/{enum_option_gid}": {
      "parameters": [
        {
          "description": "Globally unique identifier for the enum option.",
          "example": "124578",
          "in": "path",
          "name": "enum_option_gid",
          "required": true,
          "schema": {
            "type": "string"
          }
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "put": {
        "description": "Updates an existing enum option. Enum custom fields require at least one enabled enum option.\nLocked custom fields can only be updated by the user who locked the field.\nReturns the full record of the updated enum option.",
        "operationId": "updateEnumOption",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/EnumOptionRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The enum option object to update"
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EnumOption"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully updated the specified custom field enum."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Update an enum option",
        "tags": [
          "Custom fields"
        ]
      }
    },
    "/events": {
      "get": {
        "description": "Returns the full record for all events that have occurred since the sync\ntoken was created.\n\nA `GET` request to the endpoint `/[path_to_resource]/events` can be made in\nlieu of including the resource ID in the data for the request.\n\nAsana limits a single sync token to 100 events. If more than 100 events exist\nfor a given resource, `has_more: true` will be returned in the response, indicating\nthat there are more events to pull. \n\n*Note: The resource returned will be the resource that triggered the\nevent. This may be different from the one that the events were requested\nfor. For example, a subscription to a project will contain events for\ntasks contained within the project.*",
        "operationId": "getEvents",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "description": "The full record for all events that have occurred since the sync token was created.",
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/EventResponse"
                      },
                      "type": "array"
                    },
                    "has_more": {
                      "description": "Indicates whether there are more events to pull.",
                      "example": true,
                      "type": "boolean"
                    },
                    "sync": {
                      "description": "A sync token to be used with the next call to the /events endpoint.",
                      "example": "de4774f6915eae04714ca93bb2f5ee81",
                      "type": "string"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved events."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get events on a resource",
        "tags": [
          "Events"
        ]
      },
      "parameters": [
        {
          "description": "A resource ID to subscribe to. The resource can be a task or project.",
          "example": "12345",
          "in": "query",
          "name": "resource",
          "required": true,
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "A sync token received from the last request, or none on first sync. Events will be returned from the point in time that the sync token was generated.\n*Note: On your first request, omit the sync token. The response will be the same as for an expired sync token, and will include a new valid sync token.If the sync token is too old (which may happen from time to time) the API will return a `412 Precondition Failed` error, and include a fresh sync token in the response.*",
          "example": "de4774f6915eae04714ca93bb2f5ee81",
          "in": "query",
          "name": "sync",
          "required": false,
          "schema": {
            "type": "string"
          }
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/goal_relationships": {
      "get": {
        "description": "Returns compact goal relationship records.",
        "operationId": "getGoalRelationships",
        "parameters": [
          {
            "$ref": "#/components/parameters/pretty"
          },
          {
            "$ref": "#/components/parameters/fields"
          },
          {
            "description": "Globally unique identifier for the supported goal in the goal relationship.",
            "example": "12345",
            "in": "query",
            "name": "supported_goal",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "description": "If provided, filter to goal relationships with a given resource_subtype.",
            "example": "subgoal",
            "in": "query",
            "name": "resource_subtype",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/GoalRelationshipCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested goal relationships."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get goal relationships",
        "tags": [
          "Goal relationships"
        ]
      }
    },
    "/goal_relationships/{goal_relationship_gid}": {
      "get": {
        "description": "Returns the complete updated goal relationship record for a single goal relationship.",
        "operationId": "getGoalRelationship",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/GoalRelationshipResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the record for the goal relationship."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a goal relationship",
        "tags": [
          "Goal relationships"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/goal_relationship_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "put": {
        "description": "An existing goal relationship can be updated by making a PUT request on the URL for\nthat goal relationship. Only the fields provided in the `data` block will be updated;\nany unspecified fields will remain unchanged.\n\nReturns the complete updated goal relationship record.",
        "operationId": "updateGoalRelationship",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/GoalRelationshipRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The updated fields for the goal relationship.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/GoalRelationshipResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully updated the goal relationship."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Update a goal relationship",
        "tags": [
          "Goal relationships"
        ]
      }
    },
    "/goals": {
      "get": {
        "description": "Returns compact goal records.",
        "operationId": "getGoals",
        "parameters": [
          {
            "description": "Globally unique identifier for supporting portfolio.",
            "example": "159874",
            "in": "query",
            "name": "portfolio",
            "schema": {
              "type": "string"
            }
          },
          {
            "description": "Globally unique identifier for supporting project.",
            "example": "512241",
            "in": "query",
            "name": "project",
            "schema": {
              "type": "string"
            }
          },
          {
            "description": "Filter to goals with is_workspace_level set to query value. Must be used with the workspace parameter.",
            "example": false,
            "in": "query",
            "name": "is_workspace_level",
            "schema": {
              "type": "boolean"
            }
          },
          {
            "description": "Globally unique identifier for the team.",
            "example": "31326",
            "in": "query",
            "name": "team",
            "schema": {
              "type": "string"
            }
          },
          {
            "description": "Globally unique identifier for the workspace.",
            "example": "31326",
            "in": "query",
            "name": "workspace",
            "schema": {
              "type": "string"
            }
          },
          {
            "description": "Globally unique identifiers for the time periods.",
            "example": "221693,506165",
            "in": "query",
            "name": "time_periods",
            "schema": {
              "items": {
                "type": "string"
              },
              "type": "array"
            }
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/GoalCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested goals."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get goals",
        "tags": [
          "Goals"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ],
      "post": {
        "description": "Creates a new goal in a workspace or team.\n\nReturns the full record of the newly created goal.",
        "operationId": "createGoal",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/GoalRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The goal to create.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/GoalResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created a new goal."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a goal",
        "tags": [
          "Goals"
        ]
      }
    },
    "/goals/{goal_gid}": {
      "delete": {
        "description": "A specific, existing goal can be deleted by making a DELETE request on the URL for that goal.\n\nReturns an empty data record.",
        "operationId": "deleteGoal",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully deleted the specified goal."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Delete a goal",
        "tags": [
          "Goals"
        ]
      },
      "get": {
        "description": "Returns the complete goal record for a single goal.",
        "operationId": "getGoal",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/GoalResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the record for a single goal."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a goal",
        "tags": [
          "Goals"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/goal_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "put": {
        "description": "An existing goal can be updated by making a PUT request on the URL for\nthat goal. Only the fields provided in the `data` block will be updated;\nany unspecified fields will remain unchanged.\n\nReturns the complete updated goal record.",
        "operationId": "updateGoal",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/GoalRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The updated fields for the goal.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/GoalResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully updated the goal."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Update a goal",
        "tags": [
          "Goals"
        ]
      }
    },
    "/goals/{goal_gid}/addFollowers": {
      "parameters": [
        {
          "$ref": "#/components/parameters/goal_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Adds followers to a goal. Returns the goal the followers were added to.\nEach goal can be associated with zero or more followers in the system.\nRequests to add/remove followers, if successful, will return the complete updated goal record, described above.",
        "operationId": "addFollowers",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TaskAddFollowersRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The followers to be added as collaborators",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/GoalResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully added users as collaborators."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Add a collaborator to a goal",
        "tags": [
          "Goals"
        ]
      }
    },
    "/goals/{goal_gid}/addSupportingRelationship": {
      "parameters": [
        {
          "$ref": "#/components/parameters/goal_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Creates a goal relationship by adding a supporting resource to a given goal.\n\nReturns the newly created goal relationship record.",
        "operationId": "addSupportingRelationship",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/GoalAddSupportingRelationshipRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The supporting resource to be added to the goal",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/GoalRelationshipResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created the goal relationship."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Add a supporting goal relationship",
        "tags": [
          "Goal relationships"
        ]
      }
    },
    "/goals/{goal_gid}/parentGoals": {
      "get": {
        "description": "Returns a compact representation of all of the parent goals of a goal.",
        "operationId": "getParentGoalsForGoal",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/GoalCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the specified goal's parent goals."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get parent goals from a goal",
        "tags": [
          "Goals"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/goal_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/goals/{goal_gid}/removeFollowers": {
      "parameters": [
        {
          "$ref": "#/components/parameters/goal_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Removes followers from a goal. Returns the goal the followers were removed from.\nEach goal can be associated with zero or more followers in the system.\nRequests to add/remove followers, if successful, will return the complete updated goal record, described above.",
        "operationId": "removeFollowers",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TaskAddFollowersRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The followers to be removed as collaborators",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/GoalResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully removed users as collaborators."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Remove a collaborator from a goal",
        "tags": [
          "Goals"
        ]
      }
    },
    "/goals/{goal_gid}/removeSupportingRelationship": {
      "parameters": [
        {
          "$ref": "#/components/parameters/goal_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Removes a goal relationship for a given parent goal.",
        "operationId": "removeSupportingRelationship",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/GoalRemoveSupportingRelationshipRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The supporting resource to be removed from the goal",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully removed the goal relationship."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Removes a supporting goal relationship",
        "tags": [
          "Goal relationships"
        ]
      }
    },
    "/goals/{goal_gid}/setMetric": {
      "parameters": [
        {
          "$ref": "#/components/parameters/goal_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Creates and adds a goal metric to a specified goal. Note that this replaces an existing goal metric if one already exists.",
        "operationId": "createGoalMetric",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/GoalMetricRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The goal metric to create.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/GoalResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created a new goal metric."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a goal metric",
        "tags": [
          "Goals"
        ]
      }
    },
    "/goals/{goal_gid}/setMetricCurrentValue": {
      "parameters": [
        {
          "$ref": "#/components/parameters/goal_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Updates a goal's existing metric's `current_number_value` if one exists,\notherwise responds with a 400 status code.\n\nReturns the complete updated goal metric record.",
        "operationId": "updateGoalMetric",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/GoalMetricCurrentValueRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The updated fields for the goal metric.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/GoalResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully updated the goal metric."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Update a goal metric",
        "tags": [
          "Goals"
        ]
      }
    },
    "/jobs/{job_gid}": {
      "get": {
        "description": "Returns the full record for a job.",
        "operationId": "getJob",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/JobResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved Job."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a job by id",
        "tags": [
          "Jobs"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/job_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/organization_exports": {
      "parameters": [
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ],
      "post": {
        "description": "This method creates a request to export an Organization. Asana will complete the export at some point after you create the request.",
        "operationId": "createOrganizationExport",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/OrganizationExportRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The organization to export.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/OrganizationExportResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created organization export request."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create an organization export request",
        "tags": [
          "Organization exports"
        ]
      }
    },
    "/organization_exports/{organization_export_gid}": {
      "get": {
        "description": "Returns details of a previously-requested Organization export.",
        "operationId": "getOrganizationExport",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/OrganizationExportResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved organization export object."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get details on an org export request",
        "tags": [
          "Organization exports"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/organization_export_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/portfolio_memberships": {
      "get": {
        "description": "Returns a list of portfolio memberships in compact representation. You must specify `portfolio`, `portfolio` and `user`, or `workspace` and `user`.",
        "operationId": "getPortfolioMemberships",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/PortfolioMembershipCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved portfolio memberships."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get multiple portfolio memberships",
        "tags": [
          "Portfolio memberships"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/portfolio_query_param"
        },
        {
          "$ref": "#/components/parameters/workspace_query_param"
        },
        {
          "$ref": "#/components/parameters/user_query_param"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/portfolio_memberships/{portfolio_membership_gid}": {
      "get": {
        "description": "Returns the complete portfolio record for a single portfolio membership.",
        "operationId": "getPortfolioMembership",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/PortfolioMembershipResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested portfolio membership."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a portfolio membership",
        "tags": [
          "Portfolio memberships"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/portfolio_membership_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/portfolios": {
      "get": {
        "description": "Returns a list of the portfolios in compact representation that are owned by the current API user.",
        "operationId": "getPortfolios",
        "parameters": [
          {
            "$ref": "#/components/parameters/limit"
          },
          {
            "$ref": "#/components/parameters/offset"
          },
          {
            "description": "The workspace or organization to filter portfolios on.",
            "example": "1331",
            "in": "query",
            "name": "workspace",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "description": "The user who owns the portfolio. Currently, API users can only get a list of portfolios that they themselves own.",
            "example": "14916",
            "in": "query",
            "name": "owner",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/PortfolioCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved portfolios."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get multiple portfolios",
        "tags": [
          "Portfolios"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Creates a new portfolio in the given workspace with the supplied name.\n\nNote that portfolios created in the Asana UI may have some state\n(like the “Priority” custom field) which is automatically added\nto the portfolio when it is created. Portfolios created via our\nAPI will *not* be created with the same initial state to allow\nintegrations to create their own starting state on a portfolio.",
        "operationId": "createPortfolio",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/PortfolioRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The portfolio to create.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/PortfolioResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created portfolio."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a portfolio",
        "tags": [
          "Portfolios"
        ]
      }
    },
    "/portfolios/{portfolio_gid}": {
      "delete": {
        "description": "An existing portfolio can be deleted by making a DELETE request on\nthe URL for that portfolio.\n\nReturns an empty data record.",
        "operationId": "deletePortfolio",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully deleted the specified portfolio."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Delete a portfolio",
        "tags": [
          "Portfolios"
        ]
      },
      "get": {
        "description": "Returns the complete portfolio record for a single portfolio.",
        "operationId": "getPortfolio",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/PortfolioResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested portfolio."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a portfolio",
        "tags": [
          "Portfolios"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/portfolio_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "put": {
        "description": "An existing portfolio can be updated by making a PUT request on the URL for\nthat portfolio. Only the fields provided in the `data` block will be updated;\nany unspecified fields will remain unchanged.\n\nReturns the complete updated portfolio record.",
        "operationId": "updatePortfolio",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/PortfolioRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The updated fields for the portfolio.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/PortfolioResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully updated the portfolio."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Update a portfolio",
        "tags": [
          "Portfolios"
        ]
      }
    },
    "/portfolios/{portfolio_gid}/addCustomFieldSetting": {
      "parameters": [
        {
          "$ref": "#/components/parameters/portfolio_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        }
      ],
      "post": {
        "description": "Custom fields are associated with portfolios by way of custom field settings.  This method creates a setting for the portfolio.",
        "operationId": "addCustomFieldSettingForPortfolio",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/AddCustomFieldSettingRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "Information about the custom field setting.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/CustomFieldSettingResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully added the custom field to the portfolio."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Add a custom field to a portfolio",
        "tags": [
          "Portfolios"
        ]
      }
    },
    "/portfolios/{portfolio_gid}/addItem": {
      "parameters": [
        {
          "$ref": "#/components/parameters/portfolio_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Add an item to a portfolio.\nReturns an empty data block.",
        "operationId": "addItemForPortfolio",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/PortfolioAddItemRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "Information about the item being inserted.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully added the item to the portfolio."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Add a portfolio item",
        "tags": [
          "Portfolios"
        ]
      }
    },
    "/portfolios/{portfolio_gid}/addMembers": {
      "parameters": [
        {
          "$ref": "#/components/parameters/portfolio_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Adds the specified list of users as members of the portfolio.\nReturns the updated portfolio record.",
        "operationId": "addMembersForPortfolio",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/AddMembersRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "Information about the members being added.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/PortfolioResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully added members to the portfolio."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Add users to a portfolio",
        "tags": [
          "Portfolios"
        ]
      }
    },
    "/portfolios/{portfolio_gid}/custom_field_settings": {
      "get": {
        "description": "Returns a list of all of the custom fields settings on a portfolio, in compact form.",
        "operationId": "getCustomFieldSettingsForPortfolio",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/CustomFieldSettingResponse"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved custom field settings objects for a portfolio."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a portfolio's custom fields",
        "tags": [
          "Custom field settings"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/portfolio_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/portfolios/{portfolio_gid}/items": {
      "get": {
        "description": "Get a list of the items in compact form in a portfolio.",
        "operationId": "getItemsForPortfolio",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/ProjectCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested portfolio's items."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get portfolio items",
        "tags": [
          "Portfolios"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/portfolio_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/portfolios/{portfolio_gid}/portfolio_memberships": {
      "get": {
        "description": "Returns the compact portfolio membership records for the portfolio.",
        "operationId": "getPortfolioMembershipsForPortfolio",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/PortfolioMembershipCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested portfolio's memberships."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get memberships from a portfolio",
        "tags": [
          "Portfolio memberships"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/portfolio_path_gid"
        },
        {
          "$ref": "#/components/parameters/user_query_param"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/portfolios/{portfolio_gid}/removeCustomFieldSetting": {
      "parameters": [
        {
          "$ref": "#/components/parameters/portfolio_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        }
      ],
      "post": {
        "description": "Removes a custom field setting from a portfolio.",
        "operationId": "removeCustomFieldSettingForPortfolio",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/RemoveCustomFieldSettingRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "Information about the custom field setting being removed.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully removed the custom field from the portfolio."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Remove a custom field from a portfolio",
        "tags": [
          "Portfolios"
        ]
      }
    },
    "/portfolios/{portfolio_gid}/removeItem": {
      "parameters": [
        {
          "$ref": "#/components/parameters/portfolio_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Remove an item from a portfolio.\nReturns an empty data block.",
        "operationId": "removeItemForPortfolio",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/PortfolioRemoveItemRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "Information about the item being removed.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully removed the item from the portfolio."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Remove a portfolio item",
        "tags": [
          "Portfolios"
        ]
      }
    },
    "/portfolios/{portfolio_gid}/removeMembers": {
      "parameters": [
        {
          "$ref": "#/components/parameters/portfolio_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Removes the specified list of users from members of the portfolio.\nReturns the updated portfolio record.",
        "operationId": "removeMembersForPortfolio",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/RemoveMembersRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "Information about the members being removed.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/PortfolioResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully removed the members from the portfolio."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Remove users from a portfolio",
        "tags": [
          "Portfolios"
        ]
      }
    },
    "/project_briefs/{project_brief_gid}": {
      "delete": {
        "description": "Deletes a specific, existing project brief.\n\nReturns an empty data record.",
        "operationId": "deleteProjectBrief",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully deleted the specified project brief."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Delete a project brief",
        "tags": [
          "Project briefs"
        ]
      },
      "get": {
        "description": "Get the full record for a project brief.",
        "operationId": "getProjectBrief",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/ProjectBriefResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the record for a project brief."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "424": {
            "$ref": "#/components/responses/TooManyRequests"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          },
          "501": {
            "$ref": "#/components/responses/BadGateway"
          },
          "503": {
            "$ref": "#/components/responses/ServiceUnavailable"
          },
          "504": {
            "$ref": "#/components/responses/GatewayTimeout"
          }
        },
        "summary": "Get a project brief",
        "tags": [
          "Project briefs"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/project_brief_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "put": {
        "description": "An existing project brief can be updated by making a PUT request on the URL for\nthat project brief. Only the fields provided in the `data` block will be updated;\nany unspecified fields will remain unchanged.\n\nReturns the complete updated project brief record.",
        "operationId": "updateProjectBrief",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/ProjectBriefRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The updated fields for the project brief.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/ProjectBriefResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully updated the project brief."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Update a project brief",
        "tags": [
          "Project briefs"
        ]
      }
    },
    "/project_memberships/{project_membership_gid}": {
      "get": {
        "description": "Returns the complete project record for a single project membership.",
        "operationId": "getProjectMembership",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/ProjectMembershipResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested project membership."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a project membership",
        "tags": [
          "Project memberships"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/project_membership_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/project_statuses/{project_status_gid}": {
      "delete": {
        "description": "*Deprecated: new integrations should prefer the `/status_updates/{status_gid}` route.*\n\nDeletes a specific, existing project status update.\n\nReturns an empty data record.",
        "operationId": "deleteProjectStatus",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully deleted the specified project status."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Delete a project status",
        "tags": [
          "Project statuses"
        ]
      },
      "get": {
        "description": "*Deprecated: new integrations should prefer the `/status_updates/{status_gid}` route.*\n\nReturns the complete record for a single status update.",
        "operationId": "getProjectStatus",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/ProjectStatusResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the specified project's status updates."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a project status",
        "tags": [
          "Project statuses"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/project_status_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/project_templates": {
      "get": {
        "description": "Returns the compact project template records for all project templates in the given team or workspace.",
        "operationId": "getProjectTemplates",
        "parameters": [
          {
            "$ref": "#/components/parameters/workspace_query_param"
          },
          {
            "$ref": "#/components/parameters/team_query_param"
          },
          {
            "$ref": "#/components/parameters/limit"
          },
          {
            "$ref": "#/components/parameters/offset"
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/ProjectTemplateCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested team's or workspace's project templates."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get multiple project templates",
        "tags": [
          "Project templates"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/project_templates/{project_template_gid}": {
      "get": {
        "description": "Returns the complete project template record for a single project template.",
        "operationId": "getProjectTemplate",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/ProjectTemplateResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested project template."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a project template",
        "tags": [
          "Project templates"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/project_template_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/project_templates/{project_template_gid}/instantiateProject": {
      "parameters": [
        {
          "$ref": "#/components/parameters/project_template_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Creates and returns a job that will asynchronously handle the project instantiation.\n\nTo form this request, it is recommended to first make a request to [get a project template](/docs/get-a-project-template). Then, from the response, copy the `gid` from the object in the `requested_dates` array. This `gid` should be used in `requested_dates` to instantiate a project.\n\n_Note: The body of this request will differ if your workspace is an organization. To determine if your workspace is an organization, use the [is_organization](/docs/workspace) parameter._",
        "operationId": "instantiateProject",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/ProjectTemplateInstantiateProjectRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "Describes the inputs used for instantiating a project, such as the resulting project's name, which team it should be created in, and values for date variables."
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/JobResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created the job to handle project instantiation."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Instantiate a project from a project template",
        "tags": [
          "Project templates"
        ]
      }
    },
    "/projects": {
      "get": {
        "description": "Returns the compact project records for some filtered set of projects. Use one or more of the parameters provided to filter the projects returned.\n*Note: This endpoint may timeout for large domains. Try filtering by team!*",
        "operationId": "getProjects",
        "parameters": [
          {
            "$ref": "#/components/parameters/limit"
          },
          {
            "$ref": "#/components/parameters/offset"
          },
          {
            "description": "The workspace or organization to filter projects on.",
            "example": "1331",
            "in": "query",
            "name": "workspace",
            "schema": {
              "type": "string"
            }
          },
          {
            "description": "The team to filter projects on.",
            "example": "14916",
            "in": "query",
            "name": "team",
            "schema": {
              "type": "string"
            }
          },
          {
            "$ref": "#/components/parameters/archived_query_param"
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/ProjectCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved projects."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get multiple projects",
        "tags": [
          "Projects"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Create a new project in a workspace or team.\n\nEvery project is required to be created in a specific workspace or\norganization, and this cannot be changed once set. Note that you can use\nthe `workspace` parameter regardless of whether or not it is an\norganization.\n\nIf the workspace for your project is an organization, you must also\nsupply a `team` to share the project with.\n\nReturns the full record of the newly created project.",
        "operationId": "createProject",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/ProjectRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The project to create.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/ProjectResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved projects."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a project",
        "tags": [
          "Projects"
        ]
      }
    },
    "/projects/{project_gid}": {
      "delete": {
        "description": "A specific, existing project can be deleted by making a DELETE request on\nthe URL for that project.\n\nReturns an empty data record.",
        "operationId": "deleteProject",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully deleted the specified project."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Delete a project",
        "tags": [
          "Projects"
        ]
      },
      "get": {
        "description": "Returns the complete project record for a single project.",
        "operationId": "getProject",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/ProjectResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested project."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a project",
        "tags": [
          "Projects"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/project_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "put": {
        "description": "A specific, existing project can be updated by making a PUT request on\nthe URL for that project. Only the fields provided in the `data` block\nwill be updated; any unspecified fields will remain unchanged.\n\nWhen using this method, it is best to specify only those fields you wish\nto change, or else you may overwrite changes made by another user since\nyou last retrieved the task.\n\nReturns the complete updated project record.",
        "operationId": "updateProject",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/ProjectRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The updated fields for the project.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/ProjectResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully updated the project."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Update a project",
        "tags": [
          "Projects"
        ]
      }
    },
    "/projects/{project_gid}/addCustomFieldSetting": {
      "parameters": [
        {
          "$ref": "#/components/parameters/project_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        }
      ],
      "post": {
        "description": "Custom fields are associated with projects by way of custom field settings.  This method creates a setting for the project.",
        "operationId": "addCustomFieldSettingForProject",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/AddCustomFieldSettingRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "Information about the custom field setting.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/CustomFieldSettingResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully added the custom field to the project."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Add a custom field to a project",
        "tags": [
          "Projects"
        ]
      }
    },
    "/projects/{project_gid}/addFollowers": {
      "parameters": [
        {
          "$ref": "#/components/parameters/project_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Adds the specified list of users as followers to the project. Followers are a subset of members who have opted in to receive \"tasks added\" notifications for a project. Therefore, if the users are not already members of the project, they will also become members as a result of this operation.\nReturns the updated project record.",
        "operationId": "addFollowersForProject",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/AddFollowersRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "Information about the followers being added.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/ProjectResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully added followers to the project."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Add followers to a project",
        "tags": [
          "Projects"
        ]
      }
    },
    "/projects/{project_gid}/addMembers": {
      "parameters": [
        {
          "$ref": "#/components/parameters/project_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Adds the specified list of users as members of the project. Note that a user being added as a member may also be added as a *follower* as a result of this operation. This is because the user's default notification settings (i.e., in the \"Notifcations\" tab of \"My Profile Settings\") will override this endpoint's default behavior of setting \"Tasks added\" notifications to `false`.\nReturns the updated project record.",
        "operationId": "addMembersForProject",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/AddMembersRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "Information about the members being added.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/ProjectResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully added members to the project."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Add users to a project",
        "tags": [
          "Projects"
        ]
      }
    },
    "/projects/{project_gid}/custom_field_settings": {
      "get": {
        "description": "Returns a list of all of the custom fields settings on a project, in compact form. Note that, as in all queries to collections which return compact representation, `opt_fields` can be used to include more data than is returned in the compact representation. See the [getting started guide on input/output options](https://developers.asana.com/docs/#input-output-options) for more information.",
        "operationId": "getCustomFieldSettingsForProject",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/CustomFieldSettingResponse"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved custom field settings objects for a project."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a project's custom fields",
        "tags": [
          "Custom field settings"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/project_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/projects/{project_gid}/duplicate": {
      "parameters": [
        {
          "$ref": "#/components/parameters/project_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Creates and returns a job that will asynchronously handle the duplication.",
        "operationId": "duplicateProject",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/ProjectDuplicateRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "Describes the duplicate's name and the elements that will be duplicated."
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/JobResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created the job to handle duplication."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Duplicate a project",
        "tags": [
          "Projects"
        ]
      }
    },
    "/projects/{project_gid}/project_briefs": {
      "parameters": [
        {
          "$ref": "#/components/parameters/project_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Creates a new project brief.\n\nReturns the full record of the newly created project brief.",
        "operationId": "createProjectBrief",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/ProjectBriefRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The project brief to create.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/ProjectBriefResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created a new project brief."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a project brief",
        "tags": [
          "Project briefs"
        ]
      }
    },
    "/projects/{project_gid}/project_memberships": {
      "get": {
        "description": "Returns the compact project membership records for the project.",
        "operationId": "getProjectMembershipsForProject",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/ProjectMembershipCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested project's memberships."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get memberships from a project",
        "tags": [
          "Project memberships"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/project_path_gid"
        },
        {
          "$ref": "#/components/parameters/user_query_param"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/projects/{project_gid}/project_statuses": {
      "get": {
        "description": "*Deprecated: new integrations should prefer the `/status_updates` route.*\n\nReturns the compact project status update records for all updates on the project.",
        "operationId": "getProjectStatusesForProject",
        "parameters": [
          {
            "$ref": "#/components/parameters/project_path_gid"
          },
          {
            "$ref": "#/components/parameters/pretty"
          },
          {
            "$ref": "#/components/parameters/fields"
          },
          {
            "$ref": "#/components/parameters/limit"
          },
          {
            "$ref": "#/components/parameters/offset"
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/ProjectStatusCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the specified project's status updates."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get statuses from a project",
        "tags": [
          "Project statuses"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/project_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "*Deprecated: new integrations should prefer the `/status_updates` route.*\n\nCreates a new status update on the project.\n\nReturns the full record of the newly created project status update.",
        "operationId": "createProjectStatusForProject",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/ProjectStatusRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The project status to create.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/ProjectStatusResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created a new story."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a project status",
        "tags": [
          "Project statuses"
        ]
      }
    },
    "/projects/{project_gid}/removeCustomFieldSetting": {
      "parameters": [
        {
          "$ref": "#/components/parameters/project_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        }
      ],
      "post": {
        "description": "Removes a custom field setting from a project.",
        "operationId": "removeCustomFieldSettingForProject",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/RemoveCustomFieldSettingRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "Information about the custom field setting being removed.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully removed the custom field from the project."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Remove a custom field from a project",
        "tags": [
          "Projects"
        ]
      }
    },
    "/projects/{project_gid}/removeFollowers": {
      "parameters": [
        {
          "$ref": "#/components/parameters/project_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Removes the specified list of users from following the project, this will not affect project membership status.\nReturns the updated project record.",
        "operationId": "removeFollowersForProject",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/RemoveFollowersRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "Information about the followers being removed.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/ProjectResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully removed followers from the project."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Remove followers from a project",
        "tags": [
          "Projects"
        ]
      }
    },
    "/projects/{project_gid}/removeMembers": {
      "parameters": [
        {
          "$ref": "#/components/parameters/project_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Removes the specified list of users from members of the project.\nReturns the updated project record.",
        "operationId": "removeMembersForProject",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/RemoveMembersRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "Information about the members being removed.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/ProjectResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully removed the members from the project."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Remove users from a project",
        "tags": [
          "Projects"
        ]
      }
    },
    "/projects/{project_gid}/saveAsTemplate": {
      "parameters": [
        {
          "$ref": "#/components/parameters/project_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Creates and returns a job that will asynchronously handle the project template creation. Note that\nwhile the resulting project template can be accessed with the API, it won't be visible in the Asana\nUI until Project Templates 2.0 is launched in the app. See more in [this forum post](https://forum.asana.com/t/a-new-api-for-project-templates/156432).",
        "operationId": "projectSaveAsTemplate",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/ProjectSaveAsTemplateRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "Describes the inputs used for creating a project template, such as the resulting project template's name, which team it should be created in.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/JobResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created the job to handle project template creation."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a project template from a project",
        "tags": [
          "Projects"
        ]
      }
    },
    "/projects/{project_gid}/sections": {
      "get": {
        "description": "Returns the compact records for all sections in the specified project.",
        "operationId": "getSectionsForProject",
        "parameters": [
          {
            "$ref": "#/components/parameters/limit"
          },
          {
            "$ref": "#/components/parameters/offset"
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/SectionCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved sections in project."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get sections in a project",
        "tags": [
          "Sections"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/project_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Creates a new section in a project.\nReturns the full record of the newly created section.",
        "operationId": "createSectionForProject",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/SectionRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The section to create.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/SectionResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created the specified section."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a section in a project",
        "tags": [
          "Sections"
        ]
      }
    },
    "/projects/{project_gid}/sections/insert": {
      "parameters": [
        {
          "$ref": "#/components/parameters/project_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Move sections relative to each other. One of\n`before_section` or `after_section` is required.\n\nSections cannot be moved between projects.\n\nReturns an empty data block.",
        "operationId": "insertSectionForProject",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/ProjectSectionInsertRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The section's move action.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully moved the specified section."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Move or Insert sections",
        "tags": [
          "Sections"
        ]
      }
    },
    "/projects/{project_gid}/task_counts": {
      "get": {
        "description": "Get an object that holds task count fields. **All fields are excluded by default**. You must [opt in](/docs/input-output-options) using `opt_fields` to get any information from this endpoint.\n\nThis endpoint has an additional [rate limit](/docs/standard-rate-limits) and each field counts especially high against our [cost limits](/docs/cost-limits).\n\nMilestones are just tasks, so they are included in the `num_tasks`, `num_incomplete_tasks`, and `num_completed_tasks` counts.",
        "operationId": "getTaskCountsForProject",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TaskCountResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested project's task counts."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get task count of a project",
        "tags": [
          "Projects"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/project_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/projects/{project_gid}/tasks": {
      "get": {
        "description": "Returns the compact task records for all tasks within the given project, ordered by their priority within the project. Tasks can exist in more than one project at a time.",
        "operationId": "getTasksForProject",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TaskCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested project's tasks."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get tasks from a project",
        "tags": [
          "Tasks"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/completed_since"
        },
        {
          "$ref": "#/components/parameters/project_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/sections/{section_gid}": {
      "delete": {
        "description": "A specific, existing section can be deleted by making a DELETE request on\nthe URL for that section.\n\nNote that sections must be empty to be deleted.\n\nThe last remaining section cannot be deleted.\n\nReturns an empty data block.",
        "operationId": "deleteSection",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully deleted the specified section."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Delete a section",
        "tags": [
          "Sections"
        ]
      },
      "get": {
        "description": "Returns the complete record for a single section.",
        "operationId": "getSection",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/SectionResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved section."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a section",
        "tags": [
          "Sections"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/section_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "put": {
        "description": "A specific, existing section can be updated by making a PUT request on\nthe URL for that project. Only the fields provided in the `data` block\nwill be updated; any unspecified fields will remain unchanged. (note that\nat this time, the only field that can be updated is the `name` field.)\n\nWhen using this method, it is best to specify only those fields you wish\nto change, or else you may overwrite changes made by another user since\nyou last retrieved the task.\n\nReturns the complete updated section record.",
        "operationId": "updateSection",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/SectionRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The section to create.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/SectionResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully updated the specified section."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Update a section",
        "tags": [
          "Sections"
        ]
      }
    },
    "/sections/{section_gid}/addTask": {
      "parameters": [
        {
          "$ref": "#/components/parameters/section_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Add a task to a specific, existing section. This will remove the task from other sections of the project.\n\nThe task will be inserted at the top of a section unless an insert_before or insert_after parameter is declared.\n\nThis does not work for separators (tasks with the resource_subtype of section).",
        "operationId": "addTaskForSection",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/SectionTaskInsertRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The task and optionally the insert location.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully added the task."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Add task to section",
        "tags": [
          "Sections"
        ]
      }
    },
    "/sections/{section_gid}/tasks": {
      "get": {
        "description": "*Board view only*: Returns the compact section records for all tasks within the given section.",
        "operationId": "getTasksForSection",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TaskCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the section's tasks."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get tasks from a section",
        "tags": [
          "Tasks"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/section_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/status_updates": {
      "get": {
        "description": "Returns the compact status update records for all updates on the object.",
        "operationId": "getStatusesForObject",
        "parameters": [
          {
            "description": "Globally unique identifier for object to fetch statuses from. Must be a GID for a project, portfolio, or goal.",
            "example": "159874",
            "in": "query",
            "name": "parent",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "description": "Only return statuses that have been created since the given time.",
            "example": "2012-02-22T02:06:58.158Z",
            "in": "query",
            "name": "created_since",
            "schema": {
              "format": "date-time",
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/StatusUpdateCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the specified object's status updates."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get status updates from an object",
        "tags": [
          "Status updates"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ],
      "post": {
        "description": "Creates a new status update on an object.\nReturns the full record of the newly created status update.",
        "operationId": "createStatusForObject",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/StatusUpdateRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The status update to create.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/StatusUpdateResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created a new status update."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a status update",
        "tags": [
          "Status updates"
        ]
      }
    },
    "/status_updates/{status_gid}": {
      "delete": {
        "description": "Deletes a specific, existing status update.\n\nReturns an empty data record.",
        "operationId": "deleteStatus",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully deleted the specified status."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Delete a status update",
        "tags": [
          "Status updates"
        ]
      },
      "get": {
        "description": "Returns the complete record for a single status update.",
        "operationId": "getStatus",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/StatusUpdateResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the specified object's status updates."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a status update",
        "tags": [
          "Status updates"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/status_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/stories/{story_gid}": {
      "delete": {
        "description": "Deletes a story. A user can only delete stories they have created.\n\nReturns an empty data record.",
        "operationId": "deleteStory",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully deleted the specified story."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Delete a story",
        "tags": [
          "Stories"
        ]
      },
      "get": {
        "description": "Returns the full record for a single story.",
        "operationId": "getStory",
        "parameters": [
          {
            "$ref": "#/components/parameters/limit"
          },
          {
            "$ref": "#/components/parameters/offset"
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/StoryResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the specified story."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a story",
        "tags": [
          "Stories"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/story_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "put": {
        "description": "Updates the story and returns the full record for the updated story. Only comment stories can have their text updated, and only comment stories and attachment stories can be pinned. Only one of `text` and `html_text` can be specified.",
        "operationId": "updateStory",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/StoryRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The comment story to update.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/StoryResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the specified story."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Update a story",
        "tags": [
          "Stories"
        ]
      }
    },
    "/tags": {
      "get": {
        "description": "Returns the compact tag records for some filtered set of tags. Use one or more of the parameters provided to filter the tags returned.",
        "operationId": "getTags",
        "parameters": [
          {
            "$ref": "#/components/parameters/limit"
          },
          {
            "$ref": "#/components/parameters/offset"
          },
          {
            "description": "The workspace to filter tags on.",
            "example": "1331",
            "in": "query",
            "name": "workspace",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TagCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the specified set of tags."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get multiple tags",
        "tags": [
          "Tags"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Creates a new tag in a workspace or organization.\n\nEvery tag is required to be created in a specific workspace or\norganization, and this cannot be changed once set. Note that you can use\nthe workspace parameter regardless of whether or not it is an\norganization.\n\nReturns the full record of the newly created tag.",
        "operationId": "createTag",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TagRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The tag to create.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TagResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created the newly specified tag."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a tag",
        "tags": [
          "Tags"
        ]
      }
    },
    "/tags/{tag_gid}": {
      "delete": {
        "description": "A specific, existing tag can be deleted by making a DELETE request on\nthe URL for that tag.\n\nReturns an empty data record.",
        "operationId": "deleteTag",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully deleted the specified tag."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Delete a tag",
        "tags": [
          "Tags"
        ]
      },
      "get": {
        "description": "Returns the complete tag record for a single tag.",
        "operationId": "getTag",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TagResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the specified tag."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a tag",
        "tags": [
          "Tags"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/tag_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ],
      "put": {
        "description": "Updates the properties of a tag. Only the fields provided in the `data`\nblock will be updated; any unspecified fields will remain unchanged.\n\nWhen using this method, it is best to specify only those fields you wish\nto change, or else you may overwrite changes made by another user since\nyou last retrieved the tag.\n\nReturns the complete updated tag record.",
        "operationId": "updateTag",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TagResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully updated the specified tag."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Update a tag",
        "tags": [
          "Tags"
        ]
      }
    },
    "/tags/{tag_gid}/tasks": {
      "get": {
        "description": "Returns the compact task records for all tasks with the given tag. Tasks can have more than one tag at a time.",
        "operationId": "getTasksForTag",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TaskCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the tasks associated with the specified tag."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get tasks from a tag",
        "tags": [
          "Tasks"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/tag_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/tasks": {
      "get": {
        "description": "Returns the compact task records for some filtered set of tasks. Use one or more of the parameters provided to filter the tasks returned. You must specify a `project` or `tag` if you do not specify `assignee` and `workspace`.\n\nFor more complex task retrieval, use [workspaces/{workspace_gid}/tasks/search](/docs/search-tasks-in-a-workspace).",
        "operationId": "getTasks",
        "parameters": [
          {
            "$ref": "#/components/parameters/limit"
          },
          {
            "$ref": "#/components/parameters/offset"
          },
          {
            "description": "The assignee to filter tasks on. If searching for unassigned tasks, assignee.any = null can be specified.\n*Note: If you specify `assignee`, you must also specify the `workspace` to filter on.*",
            "example": "14641",
            "in": "query",
            "name": "assignee",
            "schema": {
              "type": "string"
            },
            "x-env-variable": "assignee"
          },
          {
            "description": "The project to filter tasks on.",
            "example": "321654",
            "in": "query",
            "name": "project",
            "schema": {
              "type": "string"
            },
            "x-env-variable": "project"
          },
          {
            "description": "The section to filter tasks on.\n*Note: Currently, this is only supported in board views.*",
            "example": "321654",
            "in": "query",
            "name": "section",
            "schema": {
              "type": "string"
            },
            "x-env-variable": "section"
          },
          {
            "description": "The workspace to filter tasks on.\n*Note: If you specify `workspace`, you must also specify the `assignee` to filter on.*",
            "example": "321654",
            "in": "query",
            "name": "workspace",
            "schema": {
              "type": "string"
            },
            "x-env-variable": "workspace"
          },
          {
            "description": "Only return tasks that are either incomplete or that have been completed since this time.",
            "in": "query",
            "name": "completed_since",
            "schema": {
              "example": "2012-02-22T02:06:58.158Z",
              "format": "date-time",
              "type": "string"
            }
          },
          {
            "description": "Only return tasks that have been modified since the given time.\n\n*Note: A task is considered “modified” if any of its properties\nchange, or associations between it and other objects are modified\n(e.g.  a task being added to a project). A task is not considered\nmodified just because another object it is associated with (e.g. a\nsubtask) is modified. Actions that count as modifying the task\ninclude assigning, renaming, completing, and adding stories.*",
            "example": "2012-02-22T02:06:58.158Z",
            "in": "query",
            "name": "modified_since",
            "schema": {
              "format": "date-time",
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TaskCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved requested tasks."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get multiple tasks",
        "tags": [
          "Tasks"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Creating a new task is as easy as POSTing to the `/tasks` endpoint with a\ndata block containing the fields you’d like to set on the task. Any\nunspecified fields will take on default values.\n\nEvery task is required to be created in a specific workspace, and this\nworkspace cannot be changed once set. The workspace need not be set\nexplicitly if you specify `projects` or a `parent` task instead.",
        "operationId": "createTask",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TaskRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The task to create.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TaskResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created a new task."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a task",
        "tags": [
          "Tasks"
        ]
      }
    },
    "/tasks/{task_gid}": {
      "delete": {
        "description": "A specific, existing task can be deleted by making a DELETE request on\nthe URL for that task. Deleted tasks go into the “trash” of the user\nmaking the delete request. Tasks can be recovered from the trash within a\nperiod of 30 days; afterward they are completely removed from the system.\n\nReturns an empty data record.",
        "operationId": "deleteTask",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully deleted the specified task."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Delete a task",
        "tags": [
          "Tasks"
        ]
      },
      "get": {
        "description": "Returns the complete task record for a single task.",
        "operationId": "getTask",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TaskResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the specified task."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a task",
        "tags": [
          "Tasks"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "put": {
        "description": "A specific, existing task can be updated by making a PUT request on the\nURL for that task. Only the fields provided in the `data` block will be\nupdated; any unspecified fields will remain unchanged.\n\nWhen using this method, it is best to specify only those fields you wish\nto change, or else you may overwrite changes made by another user since\nyou last retrieved the task.\n\nReturns the complete updated task record.",
        "operationId": "updateTask",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TaskRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The task to update.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TaskResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully updated the specified task."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Update a task",
        "tags": [
          "Tasks"
        ]
      }
    },
    "/tasks/{task_gid}/addDependencies": {
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Marks a set of tasks as dependencies of this task, if they are not already dependencies. *A task can have at most 30 dependents and dependencies combined*.",
        "operationId": "addDependenciesForTask",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/ModifyDependenciesRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The list of tasks to set as dependencies.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully set the specified dependencies on the task."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Set dependencies for a task",
        "tags": [
          "Tasks"
        ]
      }
    },
    "/tasks/{task_gid}/addDependents": {
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Marks a set of tasks as dependents of this task, if they are not already dependents. *A task can have at most 30 dependents and dependencies combined*.",
        "operationId": "addDependentsForTask",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/ModifyDependentsRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The list of tasks to add as dependents.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully set the specified dependents on the given task."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Set dependents for a task",
        "tags": [
          "Tasks"
        ]
      }
    },
    "/tasks/{task_gid}/addFollowers": {
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Adds followers to a task. Returns an empty data block.\nEach task can be associated with zero or more followers in the system.\nRequests to add/remove followers, if successful, will return the complete updated task record, described above.",
        "operationId": "addFollowersForTask",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TaskAddFollowersRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The followers to add to the task.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TaskResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully added the specified followers to the task."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Add followers to a task",
        "tags": [
          "Tasks"
        ]
      }
    },
    "/tasks/{task_gid}/addProject": {
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Adds the task to the specified project, in the optional location\nspecified. If no location arguments are given, the task will be added to\nthe end of the project.\n\n`addProject` can also be used to reorder a task within a project or\nsection that already contains it.\n\nAt most one of `insert_before`, `insert_after`, or `section` should be\nspecified. Inserting into a section in an non-order-dependent way can be\ndone by specifying section, otherwise, to insert within a section in a\nparticular place, specify `insert_before` or `insert_after` and a task\nwithin the section to anchor the position of this task.\n\nReturns an empty data block.",
        "operationId": "addProjectForTask",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TaskAddProjectRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The project to add the task to.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully added the specified project to the task."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Add a project to a task",
        "tags": [
          "Tasks"
        ]
      }
    },
    "/tasks/{task_gid}/addTag": {
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Adds a tag to a task. Returns an empty data block.",
        "operationId": "addTagForTask",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TaskAddTagRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The tag to add to the task.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully added the specified tag to the task."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Add a tag to a task",
        "tags": [
          "Tasks"
        ]
      }
    },
    "/tasks/{task_gid}/dependencies": {
      "get": {
        "description": "Returns the compact representations of all of the dependencies of a task.",
        "operationId": "getDependenciesForTask",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TaskCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the specified task's dependencies."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get dependencies from a task",
        "tags": [
          "Tasks"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/tasks/{task_gid}/dependents": {
      "get": {
        "description": "Returns the compact representations of all of the dependents of a task.",
        "operationId": "getDependentsForTask",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TaskCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the specified dependents of the task."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get dependents from a task",
        "tags": [
          "Tasks"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/tasks/{task_gid}/duplicate": {
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Creates and returns a job that will asynchronously handle the duplication.",
        "operationId": "duplicateTask",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TaskDuplicateRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "Describes the duplicate's name and the fields that will be duplicated.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/JobResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created the job to handle duplication."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Duplicate a task",
        "tags": [
          "Tasks"
        ]
      }
    },
    "/tasks/{task_gid}/projects": {
      "get": {
        "description": "Returns a compact representation of all of the projects the task is in.",
        "operationId": "getProjectsForTask",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/ProjectCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the projects for the given task."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get projects a task is in",
        "tags": [
          "Projects"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/tasks/{task_gid}/removeDependencies": {
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Unlinks a set of dependencies from this task.",
        "operationId": "removeDependenciesForTask",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/ModifyDependenciesRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The list of tasks to unlink as dependencies.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully unlinked the dependencies from the specified task."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Unlink dependencies from a task",
        "tags": [
          "Tasks"
        ]
      }
    },
    "/tasks/{task_gid}/removeDependents": {
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Unlinks a set of dependents from this task.",
        "operationId": "removeDependentsForTask",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/ModifyDependentsRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The list of tasks to remove as dependents.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully unlinked the specified tasks as dependents."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Unlink dependents from a task",
        "tags": [
          "Tasks"
        ]
      }
    },
    "/tasks/{task_gid}/removeFollowers": {
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Removes each of the specified followers from the task if they are following. Returns the complete, updated record for the affected task.",
        "operationId": "removeFollowerForTask",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TaskRemoveFollowersRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The followers to remove from the task.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TaskResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully removed the specified followers from the task."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Remove followers from a task",
        "tags": [
          "Tasks"
        ]
      }
    },
    "/tasks/{task_gid}/removeProject": {
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Removes the task from the specified project. The task will still exist in\nthe system, but it will not be in the project anymore.\n\nReturns an empty data block.",
        "operationId": "removeProjectForTask",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TaskRemoveProjectRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The project to remove the task from.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully removed the specified project from the task."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Remove a project from a task",
        "tags": [
          "Tasks"
        ]
      }
    },
    "/tasks/{task_gid}/removeTag": {
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Removes a tag from a task. Returns an empty data block.",
        "operationId": "removeTagForTask",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TaskRemoveTagRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The tag to remove from the task.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully removed the specified tag from the task."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Remove a tag from a task",
        "tags": [
          "Tasks"
        ]
      }
    },
    "/tasks/{task_gid}/setParent": {
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "parent, or no parent task at all. Returns an empty data block. When using `insert_before` and `insert_after`, at most one of those two options can be specified, and they must already be subtasks of the parent.",
        "operationId": "setParentForTask",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TaskSetParentRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The new parent of the subtask.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TaskResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully changed the parent of the specified subtask."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Set the parent of a task",
        "tags": [
          "Tasks"
        ]
      }
    },
    "/tasks/{task_gid}/stories": {
      "get": {
        "description": "Returns the compact records for all stories on the task.",
        "operationId": "getStoriesForTask",
        "parameters": [
          {
            "$ref": "#/components/parameters/limit"
          },
          {
            "$ref": "#/components/parameters/offset"
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/StoryCompact"
                      }
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the specified task's stories."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get stories from a task",
        "tags": [
          "Stories"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Adds a story to a task. This endpoint currently only allows for comment\nstories to be created. The comment will be authored by the currently\nauthenticated user, and timestamped when the server receives the request.\n\nReturns the full record for the new story added to the task.",
        "operationId": "createStoryForTask",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/StoryRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The story to create.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/StoryResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created a new story."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a story on a task",
        "tags": [
          "Stories"
        ]
      }
    },
    "/tasks/{task_gid}/subtasks": {
      "get": {
        "description": "Returns a compact representation of all of the subtasks of a task.",
        "operationId": "getSubtasksForTask",
        "parameters": [
          {
            "$ref": "#/components/parameters/limit"
          },
          {
            "$ref": "#/components/parameters/offset"
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TaskCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the specified task's subtasks."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get subtasks from a task",
        "tags": [
          "Tasks"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Creates a new subtask and adds it to the parent task. Returns the full record for the newly created subtask.",
        "operationId": "createSubtaskForTask",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TaskRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The new subtask to create.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TaskResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created the specified subtask."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a subtask",
        "tags": [
          "Tasks"
        ]
      }
    },
    "/tasks/{task_gid}/tags": {
      "get": {
        "description": "Get a compact representation of all of the tags the task has.",
        "operationId": "getTagsForTask",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TagCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the tags for the given task."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a task's tags",
        "tags": [
          "Tags"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/task_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/team_memberships": {
      "get": {
        "description": "Returns compact team membership records.",
        "operationId": "getTeamMemberships",
        "parameters": [
          {
            "description": "Globally unique identifier for the team.",
            "example": "159874",
            "in": "query",
            "name": "team",
            "schema": {
              "type": "string"
            }
          },
          {
            "description": "A string identifying a user. This can either be the string \"me\", an email, or the gid of a user. This parameter must be used with the workspace parameter.",
            "example": "512241",
            "in": "query",
            "name": "user",
            "schema": {
              "type": "string"
            }
          },
          {
            "description": "Globally unique identifier for the workspace. This parameter must be used with the user parameter.",
            "example": "31326",
            "in": "query",
            "name": "workspace",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TeamMembershipCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested team memberships."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get team memberships",
        "tags": [
          "Team memberships"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/team_memberships/{team_membership_gid}": {
      "get": {
        "description": "Returns the complete team membership record for a single team membership.",
        "operationId": "getTeamMembership",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TeamMembershipResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested team membership."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a team membership",
        "tags": [
          "Team memberships"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/team_membership_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/teams": {
      "parameters": [
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ],
      "post": {
        "description": "Creates a team within the current workspace.",
        "operationId": "createTeam",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TeamRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The team to create.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TeamResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created a new team."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a team",
        "tags": [
          "Teams"
        ]
      },
      "put": {
        "description": "Updates a team within the current workspace.",
        "operationId": "updateTeam",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TeamRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The team to update.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TeamResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully updated the team."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Update a team",
        "tags": [
          "Teams"
        ]
      }
    },
    "/teams/{team_gid}": {
      "get": {
        "description": "Returns the full record for a single team.",
        "operationId": "getTeam",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TeamResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the record for a single team."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a team",
        "tags": [
          "Teams"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/team_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/teams/{team_gid}/addUser": {
      "parameters": [
        {
          "$ref": "#/components/parameters/team_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "The user making this call must be a member of the team in order to add others. The user being added must exist in the same organization as the team.\n\nReturns the complete team membership record for the newly added user.",
        "operationId": "addUserForTeam",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TeamAddUserRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The user to add to the team.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TeamMembershipResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully added user to the team."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Add a user to a team",
        "tags": [
          "Teams"
        ]
      }
    },
    "/teams/{team_gid}/project_templates": {
      "get": {
        "description": "Returns the compact project template records for all project templates in the team.",
        "operationId": "getProjectTemplatesForTeam",
        "parameters": [
          {
            "$ref": "#/components/parameters/limit"
          },
          {
            "$ref": "#/components/parameters/offset"
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/ProjectTemplateCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested team's project templates."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a team's project templates",
        "tags": [
          "Project templates"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/team_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/teams/{team_gid}/projects": {
      "get": {
        "description": "Returns the compact project records for all projects in the team.",
        "operationId": "getProjectsForTeam",
        "parameters": [
          {
            "$ref": "#/components/parameters/limit"
          },
          {
            "$ref": "#/components/parameters/offset"
          },
          {
            "$ref": "#/components/parameters/archived_query_param"
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/ProjectCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested team's projects."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a team's projects",
        "tags": [
          "Projects"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/team_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Creates a project shared with the given team.\n\nReturns the full record of the newly created project.",
        "operationId": "createProjectForTeam",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/ProjectRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The new project to create.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/ProjectResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created the specified project."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a project in a team",
        "tags": [
          "Projects"
        ]
      }
    },
    "/teams/{team_gid}/removeUser": {
      "parameters": [
        {
          "$ref": "#/components/parameters/team_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "The user making this call must be a member of the team in order to remove themselves or others.",
        "operationId": "removeUserForTeam",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TeamRemoveUserRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The user to remove from the team.",
          "required": true
        },
        "responses": {
          "204": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Returns an empty data record"
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Remove a user from a team",
        "tags": [
          "Teams"
        ]
      }
    },
    "/teams/{team_gid}/team_memberships": {
      "get": {
        "description": "Returns the compact team memberships for the team.",
        "operationId": "getTeamMembershipsForTeam",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TeamMembershipCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested team's memberships."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get memberships from a team",
        "tags": [
          "Team memberships"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/team_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/teams/{team_gid}/users": {
      "get": {
        "description": "Returns the compact records for all users that are members of the team.\nResults are sorted alphabetically and limited to 2000. For more results use the `/users` endpoint.",
        "operationId": "getUsersForTeam",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/UserCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Returns the user records for all the members of the team, including guests and limited access users"
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get users in a team",
        "tags": [
          "Users"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/team_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/time_periods": {
      "get": {
        "description": "Returns compact time period records.",
        "operationId": "getTimePeriods",
        "parameters": [
          {
            "description": "ISO 8601 date string",
            "example": "2019-09-15",
            "in": "query",
            "name": "start_on",
            "schema": {
              "format": "date",
              "type": "string"
            }
          },
          {
            "description": "ISO 8601 date string",
            "example": "2019-09-15",
            "in": "query",
            "name": "end_on",
            "schema": {
              "format": "date",
              "type": "string"
            }
          },
          {
            "description": "Globally unique identifier for the workspace.",
            "example": "31326",
            "in": "query",
            "name": "workspace",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TimePeriodCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested time periods."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get time periods",
        "tags": [
          "Time periods"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/time_periods/{time_period_gid}": {
      "get": {
        "description": "Returns the full record for a single time period.",
        "operationId": "getTimePeriod",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TimePeriodResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the record for a single time period."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a time period",
        "tags": [
          "Time periods"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/time_period_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/user_task_lists/{user_task_list_gid}": {
      "get": {
        "description": "Returns the full record for a user task list.",
        "operationId": "getUserTaskList",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/UserTaskListResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the user task list."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a user task list",
        "tags": [
          "User task lists"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/user_task_list_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/user_task_lists/{user_task_list_gid}/tasks": {
      "get": {
        "description": "Returns the compact list of tasks in a user’s My Tasks list.\n*Note: Access control is enforced for this endpoint as with all Asana API endpoints, meaning a user’s private tasks will be filtered out if the API-authenticated user does not have access to them.*\n*Note: Both complete and incomplete tasks are returned by default unless they are filtered out (for example, setting `completed_since=now` will return only incomplete tasks, which is the default view for “My Tasks” in Asana.)*",
        "operationId": "getTasksForUserTaskList",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TaskCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the user task list's tasks."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get tasks from a user task list",
        "tags": [
          "Tasks"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/completed_since"
        },
        {
          "$ref": "#/components/parameters/user_task_list_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/users": {
      "get": {
        "description": "Returns the user records for all users in all workspaces and organizations accessible to the authenticated user. Accepts an optional workspace ID parameter.\nResults are sorted by user ID.",
        "operationId": "getUsers",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/UserCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested user records."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get multiple users",
        "tags": [
          "Users"
        ]
      },
      "parameters": [
        {
          "description": "The workspace or organization ID to filter users on.",
          "example": "1331",
          "in": "query",
          "name": "workspace",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "The team ID to filter users on.",
          "example": "15627",
          "in": "query",
          "name": "team",
          "schema": {
            "type": "string"
          }
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/users/{user_gid}": {
      "get": {
        "description": "Returns the full user record for the single user with the provided ID.",
        "operationId": "getUser",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/UserResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Returns the user specified."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a user",
        "tags": [
          "Users"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/user_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/users/{user_gid}/favorites": {
      "get": {
        "description": "Returns all of a user's favorites in the given workspace, of the given type.\nResults are given in order (The same order as Asana's sidebar).",
        "operationId": "getFavoritesForUser",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/AsanaNamedResource"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Returns the specified user's favorites."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a user's favorites",
        "tags": [
          "Users"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/user_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "description": "The resource type of favorites to be returned.",
          "in": "query",
          "name": "resource_type",
          "required": true,
          "schema": {
            "default": "project",
            "enum": [
              "portfolio",
              "project",
              "tag",
              "task",
              "user",
              "project_template"
            ],
            "type": "string"
          }
        },
        {
          "description": "The workspace in which to get favorites.",
          "example": "1234",
          "in": "query",
          "name": "workspace",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ]
    },
    "/users/{user_gid}/team_memberships": {
      "get": {
        "description": "Returns the compact team membership records for the user.",
        "operationId": "getTeamMembershipsForUser",
        "parameters": [
          {
            "description": "Globally unique identifier for the workspace.",
            "example": "31326",
            "in": "query",
            "name": "workspace",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TeamMembershipCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested users's memberships."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get memberships from a user",
        "tags": [
          "Team memberships"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/user_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/users/{user_gid}/teams": {
      "get": {
        "description": "Returns the compact records for all teams to which the given user is assigned.",
        "operationId": "getTeamsForUser",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TeamCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Returns the team records for all teams in the organization or workspace to which the given user is assigned."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get teams for a user",
        "tags": [
          "Teams"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/user_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        },
        {
          "description": "The workspace or organization to filter teams on.",
          "example": "1331",
          "in": "query",
          "name": "organization",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ]
    },
    "/users/{user_gid}/user_task_list": {
      "get": {
        "description": "Returns the full record for a user's task list.",
        "operationId": "getUserTaskListForUser",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/UserTaskListResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the user's task list."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a user's task list",
        "tags": [
          "User task lists"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/user_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "description": "The workspace in which to get the user task list.",
          "example": "1234",
          "in": "query",
          "name": "workspace",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ]
    },
    "/users/{user_gid}/workspace_memberships": {
      "get": {
        "description": "Returns the compact workspace membership records for the user.",
        "operationId": "getWorkspaceMembershipsForUser",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/WorkspaceMembershipCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested user's workspace memberships."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get workspace memberships for a user",
        "tags": [
          "Workspace memberships"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/user_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/webhooks": {
      "get": {
        "description": "Get the compact representation of all webhooks your app has registered for the authenticated user in the given workspace.",
        "operationId": "getWebhooks",
        "parameters": [
          {
            "$ref": "#/components/parameters/limit"
          },
          {
            "$ref": "#/components/parameters/offset"
          },
          {
            "description": "The workspace to query for webhooks in.",
            "example": "1331",
            "in": "query",
            "name": "workspace",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "description": "Only return webhooks for the given resource.",
            "example": "51648",
            "in": "query",
            "name": "resource",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/WebhookResponse"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested webhooks."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get multiple webhooks",
        "tags": [
          "Webhooks"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Establishing a webhook is a two-part process. First, a simple HTTP POST\nrequest initiates the creation similar to creating any other resource.\n\nNext, in the middle of this request comes the confirmation handshake.\nWhen a webhook is created, we will send a test POST to the target with an\n`X-Hook-Secret` header. The target must respond with a `200 OK` or `204\nNo Content` and a matching `X-Hook-Secret` header to confirm that this\nwebhook subscription is indeed expected. We strongly recommend storing\nthis secret to be used to verify future webhook event signatures.\n\nThe POST request to create the webhook will then return with the status\nof the request. If you do not acknowledge the webhook’s confirmation\nhandshake it will fail to setup, and you will receive an error in\nresponse to your attempt to create it. This means you need to be able to\nreceive and complete the webhook *while* the POST request is in-flight\n(in other words, have a server that can handle requests asynchronously).\n\nInvalid hostnames like localhost will recieve a 403 Forbidden status code.\n\n```\n# Request\ncurl -H \"Authorization: Bearer <personal_access_token>\" \\\n-X POST https://app.asana.com/api/1.0/webhooks \\\n-d \"resource=8675309\" \\\n-d \"target=https://example.com/receive-webhook/7654\"\n```\n\n```\n# Handshake sent to https://example.com/\nPOST /receive-webhook/7654\nX-Hook-Secret: b537207f20cbfa02357cf448134da559e8bd39d61597dcd5631b8012eae53e81\n```\n\n```\n# Handshake response sent by example.com\nHTTP/1.1 200\nX-Hook-Secret: b537207f20cbfa02357cf448134da559e8bd39d61597dcd5631b8012eae53e81\n```\n\n```\n# Response\nHTTP/1.1 201\n{\n  \"data\": {\n    \"gid\": \"43214\",\n    \"resource\": {\n      \"gid\": \"8675309\",\n      \"name\": \"Bugs\"\n    },\n    \"target\": \"https://example.com/receive-webhook/7654\",\n    \"active\": false,\n    \"last_success_at\": null,\n    \"last_failure_at\": null,\n    \"last_failure_content\": null\n  }\n}\n```",
        "operationId": "createWebhook",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/WebhookRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The webhook workspace and target.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/WebhookResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created the requested webhook."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Establish a webhook",
        "tags": [
          "Webhooks"
        ]
      }
    },
    "/webhooks/{webhook_gid}": {
      "delete": {
        "description": "This method *permanently* removes a webhook. Note that it may be possible to receive a request that was already in flight after deleting the webhook, but no further requests will be issued.",
        "operationId": "deleteWebhook",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested webhook."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Delete a webhook",
        "tags": [
          "Webhooks"
        ]
      },
      "get": {
        "description": "Returns the full record for the given webhook.",
        "operationId": "getWebhook",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/WebhookResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested webhook."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a webhook",
        "tags": [
          "Webhooks"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/webhook_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "put": {
        "description": "An existing webhook's filters can be updated by making a PUT request on the URL for that webhook. Note that the webhook's previous `filters` array will be completely overwritten by the `filters` sent in the PUT request.",
        "operationId": "updateWebhook",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/WebhookUpdateRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The updated filters for the webhook.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/WebhookResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully updated the webhook."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Update a webhook",
        "tags": [
          "Webhooks"
        ]
      }
    },
    "/workspace_memberships/{workspace_membership_gid}": {
      "get": {
        "description": "Returns the complete workspace record for a single workspace membership.",
        "operationId": "getWorkspaceMembership",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/WorkspaceMembershipResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested workspace membership."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a workspace membership",
        "tags": [
          "Workspace memberships"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/workspace_membership_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/workspaces": {
      "get": {
        "description": "Returns the compact records for all workspaces visible to the authorized user.",
        "operationId": "getWorkspaces",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/WorkspaceCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Return all workspaces visible to the authorized user."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get multiple workspaces",
        "tags": [
          "Workspaces"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/workspaces/{workspace_gid}": {
      "get": {
        "description": "Returns the full workspace record for a single workspace.",
        "operationId": "getWorkspace",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/WorkspaceResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Return the full workspace record."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a workspace",
        "tags": [
          "Workspaces"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/workspace_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "put": {
        "description": "A specific, existing workspace can be updated by making a PUT request on the URL for that workspace. Only the fields provided in the data block will be updated; any unspecified fields will remain unchanged.\nCurrently the only field that can be modified for a workspace is its name.\nReturns the complete, updated workspace record.",
        "operationId": "updateWorkspace",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/WorkspaceRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The workspace object with all updated properties.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/WorkspaceResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Update for the workspace was successful."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Update a workspace",
        "tags": [
          "Workspaces"
        ]
      }
    },
    "/workspaces/{workspace_gid}/addUser": {
      "parameters": [
        {
          "$ref": "#/components/parameters/workspace_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Add a user to a workspace or organization.\nThe user can be referenced by their globally unique user ID or their email address. Returns the full user record for the invited user.",
        "operationId": "addUserForWorkspace",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/WorkspaceAddUserRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The user to add to the workspace.",
          "required": true
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/UserBaseResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "The user was added successfully to the workspace or organization."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Add a user to a workspace or organization",
        "tags": [
          "Workspaces"
        ]
      }
    },
    "/workspaces/{workspace_gid}/audit_log_events": {
      "get": {
        "description": "Retrieve the audit log events that have been captured in your domain.\n\nThis endpoint will return a list of [AuditLogEvent](/docs/audit-log-event) objects, sorted by creation time in ascending order. Note that the Audit Log API captures events from October 8th, 2021 and later. Queries for events before this date will not return results.\n\nThere are a number of query parameters (below) that can be used to filter the set of [AuditLogEvent](/docs/audit-log-event) objects that are returned in the response. Any combination of query parameters is valid. When no filters are provided, all of the events that have been captured in your domain will match.\n\nThe list of events will always be [paginated](/docs/pagination). The default limit is 1000 events. The next set of events can be retrieved using the `offset` from the previous response. If there are no events that match the provided filters in your domain, the endpoint will return `null` for the `next_page` field. Querying again with the same filters may return new events if they were captured after the last request. Once a response includes a `next_page` with an `offset`, subsequent requests can be made with the latest `offset` to poll for new events that match the provided filters.\n\nWhen no `offset` is provided, the response will begin with the oldest events that match the provided filters. It is important to note that [AuditLogEvent](/docs/audit-log-event) objects will be permanently deleted from our systems after 90 days. If you wish to keep a permanent record of these events, we recommend using a SIEM tool to ingest and store these logs.",
        "operationId": "getAuditLogEvents",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/AuditLogEvent"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "AuditLogEvents were successfully retrieved."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get audit log events",
        "tags": [
          "Audit log API"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/workspace_path_gid"
        },
        {
          "$ref": "#/components/parameters/audit_log_start_at"
        },
        {
          "$ref": "#/components/parameters/audit_log_end_at"
        },
        {
          "$ref": "#/components/parameters/audit_log_event_type"
        },
        {
          "$ref": "#/components/parameters/audit_log_actor_type"
        },
        {
          "$ref": "#/components/parameters/audit_log_actor_gid"
        },
        {
          "$ref": "#/components/parameters/audit_log_resource_gid"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/workspaces/{workspace_gid}/custom_fields": {
      "get": {
        "description": "Returns a list of the compact representation of all of the custom fields in a workspace.",
        "operationId": "getCustomFieldsForWorkspace",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/CustomFieldResponse"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved all custom fields for the given workspace."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get a workspace's custom fields",
        "tags": [
          "Custom fields"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/workspace_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/workspaces/{workspace_gid}/projects": {
      "get": {
        "description": "Returns the compact project records for all projects in the workspace.\n*Note: This endpoint may timeout for large domains. Prefer the `/teams/{team_gid}/projects` endpoint.*",
        "operationId": "getProjectsForWorkspace",
        "parameters": [
          {
            "$ref": "#/components/parameters/limit"
          },
          {
            "$ref": "#/components/parameters/offset"
          },
          {
            "$ref": "#/components/parameters/archived_query_param"
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/ProjectCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested workspace's projects."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get all projects in a workspace",
        "tags": [
          "Projects"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/workspace_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Returns the compact project records for all projects in the workspace.\n\nIf the workspace for your project is an organization, you must also\nsupply a team to share the project with.\n\nReturns the full record of the newly created project.",
        "operationId": "createProjectForWorkspace",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/ProjectRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The new project to create.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/ProjectResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created a new project in the specified workspace."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a project in a workspace",
        "tags": [
          "Projects"
        ]
      }
    },
    "/workspaces/{workspace_gid}/removeUser": {
      "parameters": [
        {
          "$ref": "#/components/parameters/workspace_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Remove a user from a workspace or organization.\nThe user making this call must be an admin in the workspace. The user can be referenced by their globally unique user ID or their email address.\nReturns an empty data record.",
        "operationId": "removeUserForWorkspace",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/WorkspaceRemoveUserRequest"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The user to remove from the workspace.",
          "required": true
        },
        "responses": {
          "204": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/EmptyResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "The user was removed successfully to the workspace or organization."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Remove a user from a workspace or organization",
        "tags": [
          "Workspaces"
        ]
      }
    },
    "/workspaces/{workspace_gid}/tags": {
      "get": {
        "description": "Returns the compact tag records for some filtered set of tags. Use one or more of the parameters provided to filter the tags returned.",
        "operationId": "getTagsForWorkspace",
        "parameters": [
          {
            "$ref": "#/components/parameters/limit"
          },
          {
            "$ref": "#/components/parameters/offset"
          }
        ],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TagCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the specified set of tags."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get tags in a workspace",
        "tags": [
          "Tags"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/workspace_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ],
      "post": {
        "description": "Creates a new tag in a workspace or organization.\n\nEvery tag is required to be created in a specific workspace or\norganization, and this cannot be changed once set. Note that you can use\nthe workspace parameter regardless of whether or not it is an\norganization.\n\nReturns the full record of the newly created tag.",
        "operationId": "createTagForWorkspace",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/TagResponse"
                  }
                },
                "type": "object"
              }
            }
          },
          "description": "The tag to create.",
          "required": true
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "$ref": "#/components/schemas/TagResponse"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully created the newly specified tag."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Create a tag in a workspace",
        "tags": [
          "Tags"
        ]
      }
    },
    "/workspaces/{workspace_gid}/tasks/search": {
      "get": {
        "description": "To mirror the functionality of the Asana web app's advanced search feature, the Asana API has a task search endpoint that allows you to build complex filters to find and retrieve the exact data you need.\n#### Premium access\nLike the Asana web product's advance search feature, this search endpoint will only be available to premium Asana users. A user is premium if any of the following is true:\n\n- The workspace in which the search is being performed is a premium workspace - The user is a member of a premium team inside the workspace\n\nEven if a user is only a member of a premium team inside a non-premium workspace, search will allow them to find data anywhere in the workspace, not just inside the premium team. Making a search request using credentials of a non-premium user will result in a `402 Payment Required` error.\n#### Pagination\nSearch results are not stable; repeating the same query multiple times may return the data in a different order, even if the data do not change. Because of this, the traditional [pagination](https://developers.asana.com/docs/#pagination) available elsewhere in the Asana API is not available here. However, you can paginate manually by sorting the search results by their creation time and then modifying each subsequent query to exclude data you have already seen. Page sizes are limited to a maximum of 100 items, and can be specified by the `limit` query parameter.\n#### Eventual consistency\nChanges in Asana (regardless of whether they’re made though the web product or the API) are forwarded to our search infrastructure to be indexed. This process can take between 10 and 60 seconds to complete under normal operation, and longer during some production incidents. Making a change to a task that would alter its presence in a particular search query will not be reflected immediately. This is also true of the advanced search feature in the web product.\n#### Rate limits\nYou may receive a `429 Too Many Requests` response if you hit any of our [rate limits](https://developers.asana.com/docs/#rate-limits).\n#### Custom field parameters\n| Parameter name | Custom field type | Accepted type |\n|---|---|---|\n| custom_fields.{gid}.is_set | All | Boolean |\n| custom_fields.{gid}.value | Text | String |\n| custom_fields.{gid}.value | Number | Number |\n| custom_fields.{gid}.value | Enum | Enum option ID |\n| custom_fields.{gid}.starts_with | Text only | String |\n| custom_fields.{gid}.ends_with | Text only | String |\n| custom_fields.{gid}.contains | Text only | String |\n| custom_fields.{gid}.less_than | Number only | Number |\n| custom_fields.{gid}.greater_than | Number only | Number |\n\n\nFor example, if the gid of the custom field is 12345, these query parameter to find tasks where it is set would be `custom_fields.12345.is_set=true`. To match an exact value for an enum custom field, use the gid of the desired enum option and not the name of the enum option: `custom_fields.12345.value=67890`.\n\n**Not Supported**: searching for multiple exact matches of a custom field, searching for multi-enum custom field\n\n*Note: If you specify `projects.any` and `sections.any`, you will receive tasks for the project **and** tasks for the section. If you're looking for only tasks in a section, omit the `projects.any` from the request.*",
        "operationId": "searchTasksForWorkspace",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TaskCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the section's tasks."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Search tasks in a workspace",
        "tags": [
          "Tasks"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/workspace_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "description": "Performs full-text search on both task name and description",
          "example": "Bug",
          "in": "query",
          "name": "text",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Filters results by the task's resource_subtype",
          "in": "query",
          "name": "resource_subtype",
          "schema": {
            "default": "milestone",
            "enum": [
              "default_task",
              "milestone"
            ],
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of user identifiers",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "assignee.any",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of user identifiers",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "assignee.not",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of portfolio IDs",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "portfolios.any",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of project IDs",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "projects.any",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of project IDs",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "projects.not",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of project IDs",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "projects.all",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of section or column IDs",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "sections.any",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of section or column IDs",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "sections.not",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of section or column IDs",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "sections.all",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of tag IDs",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "tags.any",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of tag IDs",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "tags.not",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of tag IDs",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "tags.all",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of team IDs",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "teams.any",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of user identifiers",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "followers.not",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of user identifiers",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "created_by.any",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of user identifiers",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "created_by.not",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of user identifiers",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "assigned_by.any",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of user identifiers",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "assigned_by.not",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of user identifiers",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "liked_by.not",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "Comma-separated list of user identifiers",
          "example": "12345,23456,34567",
          "in": "query",
          "name": "commented_on_by.not",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 date string",
          "example": "2019-09-15",
          "in": "query",
          "name": "due_on.before",
          "schema": {
            "format": "date",
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 date string",
          "example": "2019-09-15",
          "in": "query",
          "name": "due_on.after",
          "schema": {
            "format": "date",
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 date string or `null`",
          "example": "2019-09-15",
          "in": "query",
          "name": "due_on",
          "schema": {
            "format": "date",
            "nullable": true,
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 datetime string",
          "example": "2019-04-15T01:01:46.055Z",
          "in": "query",
          "name": "due_at.before",
          "schema": {
            "format": "date-time",
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 datetime string",
          "example": "2019-04-15T01:01:46.055Z",
          "in": "query",
          "name": "due_at.after",
          "schema": {
            "format": "date-time",
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 date string",
          "example": "2019-09-15",
          "in": "query",
          "name": "start_on.before",
          "schema": {
            "format": "date",
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 date string",
          "example": "2019-09-15",
          "in": "query",
          "name": "start_on.after",
          "schema": {
            "format": "date",
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 date string or `null`",
          "example": "2019-09-15",
          "in": "query",
          "name": "start_on",
          "schema": {
            "format": "date",
            "nullable": true,
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 date string",
          "example": "2019-09-15",
          "in": "query",
          "name": "created_on.before",
          "schema": {
            "format": "date",
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 date string",
          "example": "2019-09-15",
          "in": "query",
          "name": "created_on.after",
          "schema": {
            "format": "date",
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 date string or `null`",
          "example": "2019-09-15",
          "in": "query",
          "name": "created_on",
          "schema": {
            "format": "date",
            "nullable": true,
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 datetime string",
          "example": "2019-04-15T01:01:46.055Z",
          "in": "query",
          "name": "created_at.before",
          "schema": {
            "format": "date-time",
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 datetime string",
          "example": "2019-04-15T01:01:46.055Z",
          "in": "query",
          "name": "created_at.after",
          "schema": {
            "format": "date-time",
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 date string",
          "example": "2019-09-15",
          "in": "query",
          "name": "completed_on.before",
          "schema": {
            "format": "date",
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 date string",
          "example": "2019-09-15",
          "in": "query",
          "name": "completed_on.after",
          "schema": {
            "format": "date",
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 date string or `null`",
          "example": "2019-09-15",
          "in": "query",
          "name": "completed_on",
          "schema": {
            "format": "date",
            "nullable": true,
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 datetime string",
          "example": "2019-04-15T01:01:46.055Z",
          "in": "query",
          "name": "completed_at.before",
          "schema": {
            "format": "date-time",
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 datetime string",
          "example": "2019-04-15T01:01:46.055Z",
          "in": "query",
          "name": "completed_at.after",
          "schema": {
            "format": "date-time",
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 date string",
          "example": "2019-09-15",
          "in": "query",
          "name": "modified_on.before",
          "schema": {
            "format": "date",
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 date string",
          "example": "2019-09-15",
          "in": "query",
          "name": "modified_on.after",
          "schema": {
            "format": "date",
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 date string or `null`",
          "example": "2019-09-15",
          "in": "query",
          "name": "modified_on",
          "schema": {
            "format": "date",
            "nullable": true,
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 datetime string",
          "example": "2019-04-15T01:01:46.055Z",
          "in": "query",
          "name": "modified_at.before",
          "schema": {
            "format": "date-time",
            "type": "string"
          }
        },
        {
          "description": "ISO 8601 datetime string",
          "example": "2019-04-15T01:01:46.055Z",
          "in": "query",
          "name": "modified_at.after",
          "schema": {
            "format": "date-time",
            "type": "string"
          }
        },
        {
          "description": "Filter to incomplete tasks with dependents",
          "example": false,
          "in": "query",
          "name": "is_blocking",
          "schema": {
            "type": "boolean"
          }
        },
        {
          "description": "Filter to tasks with incomplete dependencies",
          "example": false,
          "in": "query",
          "name": "is_blocked",
          "schema": {
            "type": "boolean"
          }
        },
        {
          "description": "Filter to tasks with attachments",
          "example": false,
          "in": "query",
          "name": "has_attachment",
          "schema": {
            "type": "boolean"
          }
        },
        {
          "description": "Filter to completed tasks",
          "example": false,
          "in": "query",
          "name": "completed",
          "schema": {
            "type": "boolean"
          }
        },
        {
          "description": "Filter to subtasks",
          "example": false,
          "in": "query",
          "name": "is_subtask",
          "schema": {
            "type": "boolean"
          }
        },
        {
          "description": "One of `due_date`, `created_at`, `completed_at`, `likes`, or `modified_at`, defaults to `modified_at`",
          "example": "likes",
          "in": "query",
          "name": "sort_by",
          "schema": {
            "default": "modified_at",
            "enum": [
              "due_date",
              "created_at",
              "completed_at",
              "likes",
              "modified_at"
            ],
            "type": "string"
          }
        },
        {
          "description": "Default `false`",
          "example": true,
          "in": "query",
          "name": "sort_ascending",
          "schema": {
            "default": false,
            "type": "boolean"
          }
        }
      ]
    },
    "/workspaces/{workspace_gid}/teams": {
      "get": {
        "description": "Returns the compact records for all teams in the workspace visible to the authorized user.",
        "operationId": "getTeamsForWorkspace",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/TeamCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Returns the team records for all teams in the organization or workspace accessible to the authenticated user."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get teams in a workspace",
        "tags": [
          "Teams"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/workspace_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/workspaces/{workspace_gid}/typeahead": {
      "get": {
        "description": "Retrieves objects in the workspace based via an auto-completion/typeahead\nsearch algorithm. This feature is meant to provide results quickly, so do\nnot rely on this API to provide extremely accurate search results. The\nresult set is limited to a single page of results with a maximum size, so\nyou won’t be able to fetch large numbers of results.\n\nThe typeahead search API provides search for objects from a single\nworkspace. This endpoint should be used to query for objects when\ncreating an auto-completion/typeahead search feature. This API is meant\nto provide results quickly and should not be relied upon for accurate or\nexhaustive search results. The results sets are limited in size and\ncannot be paginated.\n\nQueries return a compact representation of each object which is typically\nthe gid and name fields. Interested in a specific set of fields or all of\nthe fields?! Of course you are. Use field selectors to manipulate what\ndata is included in a response.\n\nResources with type `user` are returned in order of most contacted to\nleast contacted. This is determined by task assignments, adding the user\nto projects, and adding the user as a follower to tasks, messages,\netc.\n\nResources with type `project` are returned in order of recency. This is\ndetermined when the user visits the project, is added to the project, and\ncompletes tasks in the project.\n\nResources with type `task` are returned with priority placed on tasks\nthe user is following, but no guarantee on the order of those tasks.\n\nResources with type `project_template` are returned with priority\nplaced on favorited project templates.\n\nLeaving the `query` string empty or omitted will give you results, still\nfollowing the resource ordering above. This could be used to list users or\nprojects that are relevant for the requesting user's api token.",
        "operationId": "typeaheadForWorkspace",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "description": "A generic list of objects, such as those returned by the typeahead search endpoint.",
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/AsanaNamedResource"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved objects via a typeahead search algorithm."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get objects via typeahead",
        "tags": [
          "Typeahead"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/workspace_path_gid"
        },
        {
          "description": "The type of values the typeahead should return. You can choose from one of the following: `custom_field`, `project`, `project_template`, `portfolio`, `tag`, `task`, and `user`. Note that unlike in the names of endpoints, the types listed here are in singular form (e.g. `task`). Using multiple types is not yet supported.",
          "in": "query",
          "name": "resource_type",
          "required": true,
          "schema": {
            "default": "user",
            "enum": [
              "custom_field",
              "project",
              "project_template",
              "portfolio",
              "tag",
              "task",
              "user"
            ],
            "type": "string"
          }
        },
        {
          "description": "*Deprecated: new integrations should prefer the resource_type field.*",
          "in": "query",
          "name": "type",
          "required": false,
          "schema": {
            "default": "user",
            "enum": [
              "custom_field",
              "portfolio",
              "project",
              "tag",
              "task",
              "user"
            ],
            "type": "string"
          }
        },
        {
          "description": "The string that will be used to search for relevant objects. If an empty string is passed in, the API will return results.",
          "example": "Greg",
          "in": "query",
          "name": "query",
          "schema": {
            "type": "string"
          }
        },
        {
          "description": "The number of results to return. The default is 20 if this parameter is omitted, with a minimum of 1 and a maximum of 100. If there are fewer results found than requested, all will be returned.",
          "example": 20,
          "in": "query",
          "name": "count",
          "schema": {
            "type": "integer"
          }
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        }
      ]
    },
    "/workspaces/{workspace_gid}/users": {
      "get": {
        "description": "Returns the compact records for all users in the specified workspace or organization.\nResults are sorted alphabetically and limited to 2000. For more results use the `/users` endpoint.",
        "operationId": "getUsersForWorkspace",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/UserCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Return the users in the specified workspace or org."
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "500": {
            "$ref": "#/components/responses/InternalServerError"
          }
        },
        "summary": "Get users in a workspace or organization",
        "tags": [
          "Users"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/workspace_path_gid"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    },
    "/workspaces/{workspace_gid}/workspace_memberships": {
      "get": {
        "description": "Returns the compact workspace membership records for the workspace.",
        "operationId": "getWorkspaceMembershipsForWorkspace",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "properties": {
                    "data": {
                      "items": {
                        "$ref": "#/components/schemas/WorkspaceMembershipCompact"
                      },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              }
            },
            "description": "Successfully retrieved the requested workspace's memberships."
          }
        },
        "summary": "Get the workspace memberships for a workspace",
        "tags": [
          "Workspace memberships"
        ]
      },
      "parameters": [
        {
          "$ref": "#/components/parameters/workspace_path_gid"
        },
        {
          "$ref": "#/components/parameters/user_query_param"
        },
        {
          "$ref": "#/components/parameters/pretty"
        },
        {
          "$ref": "#/components/parameters/fields"
        },
        {
          "$ref": "#/components/parameters/limit"
        },
        {
          "$ref": "#/components/parameters/offset"
        }
      ]
    }
  },
  "components": {
    "parameters": {
      "archived_query_param": {
        "description": "Only return projects whose `archived` field takes on the value of this parameter.",
        "example": false,
        "in": "query",
        "name": "archived",
        "schema": {
          "type": "boolean"
        }
      },
      "attachment_path_gid": {
        "description": "Globally unique identifier for the attachment.",
        "example": "12345",
        "in": "path",
        "name": "attachment_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "attachment"
      },
      "audit_log_actor_gid": {
        "description": "Filter to events triggered by the actor with this ID.",
        "in": "query",
        "name": "actor_gid",
        "required": false,
        "schema": {
          "type": "string"
        }
      },
      "audit_log_actor_type": {
        "description": "Filter to events with an actor of this type.\nThis only needs to be included if querying for actor types without an ID. If `actor_gid` is included, this should be excluded.",
        "in": "query",
        "name": "actor_type",
        "required": false,
        "schema": {
          "enum": [
            "user",
            "asana",
            "asana_support",
            "anonymous",
            "external_administrator"
          ],
          "type": "string"
        }
      },
      "audit_log_end_at": {
        "description": "Filter to events created before this time (exclusive).",
        "in": "query",
        "name": "end_at",
        "required": false,
        "schema": {
          "format": "date-time",
          "type": "string"
        }
      },
      "audit_log_event_type": {
        "description": "Filter to events of this type.\nRefer to the [Supported AuditLogEvents](/docs/supported-auditlogevents) for a full list of values.",
        "in": "query",
        "name": "event_type",
        "required": false,
        "schema": {
          "type": "string"
        }
      },
      "audit_log_resource_gid": {
        "description": "Filter to events with this resource ID.",
        "in": "query",
        "name": "resource_gid",
        "required": false,
        "schema": {
          "type": "string"
        }
      },
      "audit_log_start_at": {
        "description": "Filter to events created after this time (inclusive).",
        "in": "query",
        "name": "start_at",
        "required": false,
        "schema": {
          "format": "date-time",
          "type": "string"
        }
      },
      "completed_since": {
        "description": "Only return tasks that are either incomplete or that have been completed since this time. Accepts a date-time string or the keyword *now*.\n",
        "example": "2012-02-22T02:06:58.158Z",
        "in": "query",
        "name": "completed_since",
        "required": false,
        "schema": {
          "type": "string"
        }
      },
      "custom_field_path_gid": {
        "description": "Globally unique identifier for the custom field.",
        "example": "12345",
        "in": "path",
        "name": "custom_field_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "custom_field"
      },
      "fields": {
        "description": "Defines fields to return.\nSome requests return *compact* representations of objects in order to conserve resources and complete the request more efficiently. Other times requests return more information than you may need. This option allows you to list the exact set of fields that the API should be sure to return for the objects. The field names should be provided as paths, described below.\nThe id of included objects will always be returned, regardless of the field options.",
        "example": [
          "followers",
          "assignee"
        ],
        "explode": false,
        "in": "query",
        "name": "opt_fields",
        "required": false,
        "schema": {
          "items": {
            "type": "string"
          },
          "type": "array"
        },
        "style": "form"
      },
      "goal_path_gid": {
        "description": "Globally unique identifier for the goal.",
        "example": "12345",
        "in": "path",
        "name": "goal_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "goal"
      },
      "goal_relationship_path_gid": {
        "description": "Globally unique identifier for the goal relationship.",
        "example": "12345",
        "in": "path",
        "name": "goal_relationship_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "goal_relationship"
      },
      "job_path_gid": {
        "description": "Globally unique identifier for the job.",
        "example": "12345",
        "in": "path",
        "name": "job_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "job"
      },
      "limit": {
        "description": "Results per page.\nThe number of objects to return per page. The value must be between 1 and 100.",
        "example": 50,
        "in": "query",
        "name": "limit",
        "schema": {
          "type": "integer"
        }
      },
      "member": {
        "description": "Member object gid can be user or team.\n",
        "example": "123",
        "in": "query",
        "name": "member",
        "required": false,
        "schema": {
          "type": "string"
        }
      },
      "message_path_gid": {
        "description": "The message to get.",
        "example": "321654",
        "in": "path",
        "name": "message_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "message"
      },
      "offset": {
        "description": "Offset token.\nAn offset to the next page returned by the API. A pagination request will return an offset token, which can be used as an input parameter to the next request. If an offset is not passed in, the API will return the first page of results.\n'Note: You can only pass in an offset that was returned to you via a previously paginated request.'",
        "example": "eyJ0eXAiOJiKV1iQLCJhbGciOiJIUzI1NiJ9",
        "in": "query",
        "name": "offset",
        "schema": {
          "type": "string"
        }
      },
      "organization_export_path_gid": {
        "description": "Globally unique identifier for the organization export.",
        "example": "12345",
        "in": "path",
        "name": "organization_export_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "organization_export"
      },
      "parent": {
        "description": "Membership parent object gid.\n",
        "example": "123",
        "in": "query",
        "name": "parent",
        "required": true,
        "schema": {
          "type": "string"
        }
      },
      "portfolio_membership_path_gid": {
        "example": "1331",
        "in": "path",
        "name": "portfolio_membership_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "portfolio_membership"
      },
      "portfolio_path_gid": {
        "description": "Globally unique identifier for the portfolio.",
        "example": "12345",
        "in": "path",
        "name": "portfolio_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "portfolio"
      },
      "portfolio_query_param": {
        "description": "The portfolio to filter results on.",
        "example": "12345",
        "in": "query",
        "name": "portfolio",
        "schema": {
          "type": "string"
        },
        "x-env-variable": "portfolio"
      },
      "pretty": {
        "allowEmptyValue": true,
        "description": "Provides “pretty” output.\nProvides the response in a “pretty” format. In the case of JSON this means doing proper line breaking and indentation to make it readable. This will take extra time and increase the response size so it is advisable only to use this during debugging.",
        "example": true,
        "in": "query",
        "name": "opt_pretty",
        "required": false,
        "schema": {
          "type": "boolean"
        },
        "style": "form"
      },
      "project_brief_path_gid": {
        "description": "Globally unique identifier for the project brief.",
        "example": "12345",
        "in": "path",
        "name": "project_brief_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "project_brief"
      },
      "project_membership_path_gid": {
        "example": "1331",
        "in": "path",
        "name": "project_membership_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "project_membership"
      },
      "project_path_gid": {
        "description": "Globally unique identifier for the project.",
        "example": "1331",
        "in": "path",
        "name": "project_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "project"
      },
      "project_status_path_gid": {
        "description": "The project status update to get.",
        "example": "321654",
        "in": "path",
        "name": "project_status_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "project_status"
      },
      "project_template_path_gid": {
        "description": "Globally unique identifier for the project template.",
        "example": "1331",
        "in": "path",
        "name": "project_template_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "project_template"
      },
      "section_path_gid": {
        "description": "The globally unique identifier for the section.",
        "example": "321654",
        "in": "path",
        "name": "section_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "section"
      },
      "status_path_gid": {
        "description": "The status update to get.",
        "example": "321654",
        "in": "path",
        "name": "status_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "status"
      },
      "story_path_gid": {
        "description": "Globally unique identifier for the story.",
        "example": "35678",
        "in": "path",
        "name": "story_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "story"
      },
      "tag_path_gid": {
        "description": "Globally unique identifier for the tag.",
        "example": "11235",
        "in": "path",
        "name": "tag_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "tag"
      },
      "task_path_gid": {
        "description": "The task to operate on.",
        "example": "321654",
        "in": "path",
        "name": "task_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "task"
      },
      "team_membership_path_gid": {
        "example": "724362",
        "in": "path",
        "name": "team_membership_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "team_membership"
      },
      "team_path_gid": {
        "description": "Globally unique identifier for the team.",
        "example": "159874",
        "in": "path",
        "name": "team_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "team"
      },
      "team_query_param": {
        "description": "The team to filter projects on.",
        "example": "14916",
        "in": "query",
        "name": "team",
        "schema": {
          "type": "string"
        },
        "x-env-variable": "team"
      },
      "time_period_path_gid": {
        "description": "Globally unique identifier for the time period.",
        "example": "917392",
        "in": "path",
        "name": "time_period_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "time_period"
      },
      "user_path_gid": {
        "description": "A string identifying a user. This can either be the string \"me\", an email, or the gid of a user.",
        "example": "me",
        "in": "path",
        "name": "user_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "user"
      },
      "user_query_param": {
        "description": "A string identifying a user. This can either be the string \"me\", an email, or the gid of a user.",
        "example": "me",
        "in": "query",
        "name": "user",
        "schema": {
          "type": "string"
        },
        "x-env-variable": "user"
      },
      "user_task_list_path_gid": {
        "description": "Globally unique identifier for the user task list.",
        "example": "12345",
        "in": "path",
        "name": "user_task_list_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "user_task_list"
      },
      "webhook_path_gid": {
        "description": "Globally unique identifier for the webhook.",
        "example": "12345",
        "in": "path",
        "name": "webhook_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "webhook"
      },
      "workspace_membership_path_gid": {
        "example": "12345",
        "in": "path",
        "name": "workspace_membership_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "workspace_membership"
      },
      "workspace_path_gid": {
        "description": "Globally unique identifier for the workspace or organization.",
        "example": "12345",
        "in": "path",
        "name": "workspace_gid",
        "required": true,
        "schema": {
          "type": "string"
        },
        "x-env-variable": "workspace"
      },
      "workspace_query_param": {
        "description": "The workspace to filter results on.",
        "example": "12345",
        "in": "query",
        "name": "workspace",
        "schema": {
          "type": "string"
        },
        "x-env-variable": "workspace"
      }
    },
    "responses": {
      "BadGateway": {
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            }
          }
        },
        "description": "There is an issue between the load balancers and Asana's API."
      },
      "BadRequest": {
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            }
          }
        },
        "description": "This usually occurs because of a missing or malformed parameter. Check the documentation and the syntax of your request and try again."
      },
      "Forbidden": {
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            }
          }
        },
        "description": "The authentication and request syntax was valid but the server is refusing to complete the request. This can happen if you try to read or write to objects or properties that the user does not have access to."
      },
      "GatewayTimeout": {
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            }
          }
        },
        "description": "This request took too long to complete."
      },
      "GenericErrorResponse": {
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            }
          }
        },
        "description": "Sadly, sometimes requests to the API are not successful. Failures can occur for a wide range of reasons. In all cases, the API should return an HTTP Status Code that indicates the nature of the failure, with a response body in JSON format containing additional information. In the event of a server error the response body will contain an error phrase. These phrases are automatically generated using the [node-asana-phrase library](https://github.com/Asana/node-asana-phrase) and can be used by Asana support to quickly look up the incident that caused the server error."
      },
      "InternalServerError": {
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            }
          }
        },
        "description": "There was a problem on Asana’s end. In the event of a server error the response body should contain an error phrase. These phrases can be used by Asana support to quickly look up the incident that caused the server error. Some errors are due to server load, and will not supply an error phrase."
      },
      "NotFound": {
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            }
          }
        },
        "description": "Either the request method and path supplied do not specify a known action in the API, or the object specified by the request does not exist."
      },
      "PaymentRequired": {
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            }
          }
        },
        "description": "The request was valid, but the queried object or object mutation specified in the request is above your current premium level."
      },
      "ServiceUnavailable": {
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            }
          }
        },
        "description": "Either the upstream service is unavailable to the API, or the API has been intentionally shut off."
      },
      "TooManyRequests": {
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            }
          }
        },
        "description": "You have exceeded one of the enforced rate limits in the API. See the [documentation on rate limiting](https://developers.asana.com/docs/#rate-limits) for more information."
      },
      "Unauthorized": {
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            }
          }
        },
        "description": "A valid authentication token was not provided with the request, so the API could not associate a user with the request."
      }
    },
    "schemas": {
      "AddCustomFieldSettingRequest": {
        "properties": {
          "custom_field": {
            "description": "The custom field to associate with this container.",
            "example": "14916",
            "type": "string"
          },
          "insert_after": {
            "description": "A gid of a Custom Field Setting on this container, after which the new Custom Field Setting will be added.  `insert_before` and `insert_after` parameters cannot both be specified.",
            "example": "1331",
            "type": "string"
          },
          "insert_before": {
            "description": "A gid of a Custom Field Setting on this container, before which the new Custom Field Setting will be added.  `insert_before` and `insert_after` parameters cannot both be specified.",
            "example": "1331",
            "type": "string"
          },
          "is_important": {
            "description": "Whether this field should be considered important to this container (for instance, to display in the list view of items in the container).",
            "example": true,
            "type": "boolean"
          }
        },
        "required": [
          "custom_field"
        ],
        "type": "object"
      },
      "AddFollowersRequest": {
        "properties": {
          "followers": {
            "description": "An array of strings identifying users. These can either be the string \"me\", an email, or the gid of a user.",
            "example": "521621,621373",
            "type": "string"
          }
        },
        "required": [
          "followers"
        ],
        "type": "object"
      },
      "AddMembersRequest": {
        "properties": {
          "members": {
            "description": "An array of strings identifying users. These can either be the string \"me\", an email, or the gid of a user.",
            "example": "521621,621373",
            "type": "string"
          }
        },
        "required": [
          "members"
        ],
        "type": "object"
      },
      "AsanaNamedResource": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "properties": {
              "name": {
                "description": "The name of the object.",
                "example": "Bug Task",
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "AsanaResource": {
        "description": "A generic Asana Resource, containing a globally unique identifier.",
        "properties": {
          "gid": {
            "description": "Globally unique identifier of the resource, as a string.",
            "example": "12345",
            "readOnly": true,
            "type": "string",
            "x-insert-after": false
          },
          "resource_type": {
            "description": "The base type of this resource.",
            "example": "task",
            "readOnly": true,
            "type": "string",
            "x-insert-after": "gid"
          }
        },
        "type": "object"
      },
      "AttachmentBase": {
        "$ref": "#/components/schemas/AttachmentCompact"
      },
      "AttachmentCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "An *attachment* object represents any file attached to a task in Asana, whether it’s an uploaded file or one associated via a third-party service such as Dropbox or Google Drive.",
            "properties": {
              "name": {
                "description": "The name of the file.",
                "example": "Screenshot.png",
                "readOnly": true,
                "type": "string"
              },
              "resource_subtype": {
                "description": "The service hosting the attachment. Valid values are `asana`, `dropbox`, `gdrive`, `onedrive`, `box`, `vimeo`, and `external`.",
                "example": "dropbox",
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "attachment"
            }
          }
        ]
      },
      "AttachmentRequest": {
        "properties": {
          "connect_to_app": {
            "description": "*Optional*. Only relevant for external attachments with a parent task. A boolean indicating whether the current app should be connected with the attachment for the purposes of showing an app components widget. Requires the app to have been added to a project the parent task is in.\n",
            "type": "boolean"
          },
          "file": {
            "description": "Required for `asana` attachments.\n",
            "format": "binary",
            "type": "string"
          },
          "name": {
            "description": "The name of the external resource being attached. Required for attachments of type `external`.\n",
            "type": "string"
          },
          "parent": {
            "description": "Required identifier of the parent task, project, or project_brief, as a string.\n",
            "type": "string"
          },
          "resource_subtype": {
            "description": "The type of the attachment. Must be one of the given values. If not specified, a file attachment of type `asana` will be assumed. Note that if the value of `resource_subtype` is `external`, a `parent`, `name`, and `url` must also be provided.\n",
            "enum": [
              "asana",
              "dropbox",
              "gdrive",
              "onedrive",
              "box",
              "vimeo",
              "external"
            ],
            "example": "external",
            "type": "string"
          },
          "url": {
            "description": "The URL of the external resource being attached. Required for attachments of type `external`.\n",
            "type": "string"
          }
        },
        "type": "object"
      },
      "AttachmentResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AttachmentBase"
          },
          {
            "properties": {
              "connected_to_app": {
                "description": "Whether the attachment is connected to the app making the request for the purposes of showing an app components widget. Only present when the `resource_subtype` is `external` or `gdrive`.",
                "readOnly": true,
                "type": "boolean"
              },
              "created_at": {
                "description": "The time at which this resource was created.",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              },
              "download_url": {
                "description": "The URL containing the content of the attachment.\n*Note:* May be null if the attachment is hosted by [Box](https://www.box.com/) and will be null if the attachment is a Video Message hosted by [Vimeo](https://vimeo.com/). If present, this URL may only be valid for two minutes from the time of retrieval. You should avoid persisting this URL somewhere and just refresh it on demand to ensure you do not keep stale URLs.",
                "example": "https://s3.amazonaws.com/assets/123/Screenshot.png",
                "format": "uri",
                "nullable": true,
                "readOnly": true,
                "type": "string"
              },
              "host": {
                "description": "The service hosting the attachment. Valid values are `asana`, `dropbox`, `gdrive`, `box`, and `vimeo`.",
                "example": "dropbox",
                "readOnly": true,
                "type": "string"
              },
              "parent": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/TaskCompact"
                  },
                  {
                    "description": "The task this attachment is attached to.",
                    "properties": {
                      "resource_subtype": {
                        "description": "The resource subtype of the parent resource that the filter applies to.",
                        "example": "default_task",
                        "nullable": true,
                        "type": "string"
                      }
                    },
                    "readOnly": true,
                    "type": "object"
                  }
                ]
              },
              "permanent_url": {
                "description": "",
                "example": "https://s3.amazonaws.com/assets/123/Screenshot.png",
                "format": "uri",
                "nullable": true,
                "readOnly": true,
                "type": "string"
              },
              "size": {
                "description": "The size of the attachment in bytes. Only present when the `resource_subtype` is `asana`.",
                "example": 12345,
                "readOnly": true,
                "type": "integer"
              },
              "view_url": {
                "description": "The URL where the attachment can be viewed, which may be friendlier to users in a browser than just directing them to a raw file. May be null if no view URL exists for the service.",
                "example": "https://www.dropbox.com/s/123/Screenshot.png",
                "format": "uri",
                "nullable": true,
                "readOnly": true,
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "AuditLogEvent": {
        "description": "An object representing a single event within an Asana domain.\n\nEvery audit log event is comprised of an `event_type`, `actor`, `resource`, and `context`. Some events will include additional metadata about the event under `details`. See our [currently supported list of events](/docs/supported-auditlogevents) for more details.",
        "properties": {
          "actor": {
            "allOf": [
              {
                "$ref": "#/components/schemas/AuditLogEventActor"
              }
            ]
          },
          "context": {
            "allOf": [
              {
                "$ref": "#/components/schemas/AuditLogEventContext"
              }
            ]
          },
          "created_at": {
            "description": "The time the event was created.",
            "example": "2021-01-01T00:00:00.000Z",
            "format": "date-time",
            "type": "string"
          },
          "details": {
            "allOf": [
              {
                "$ref": "#/components/schemas/AuditLogEventDetails"
              }
            ]
          },
          "event_category": {
            "description": "The category that this `event_type` belongs to.",
            "example": "deletion",
            "type": "string"
          },
          "event_type": {
            "description": "The type of the event.",
            "example": "task_deleted",
            "type": "string"
          },
          "gid": {
            "description": "Globally unique identifier of the `AuditLogEvent`, as a string.",
            "example": "12345",
            "type": "string",
            "x-insert-after": false
          },
          "resource": {
            "allOf": [
              {
                "$ref": "#/components/schemas/AuditLogEventResource"
              }
            ]
          }
        },
        "type": "object"
      },
      "AuditLogEventActor": {
        "description": "The entity that triggered the event. Will typically be a user.",
        "properties": {
          "actor_type": {
            "description": "The type of actor.\nCan be one of `user`, `asana`, `asana_support`, `anonymous`, or `external_administrator`.",
            "enum": [
              "user",
              "asana",
              "asana_support",
              "anonymous",
              "external_administrator"
            ],
            "example": "user",
            "type": "string"
          },
          "email": {
            "description": "The email of the actor, if it is a user.",
            "example": "gregsanchez@example.com",
            "type": "string"
          },
          "gid": {
            "description": "Globally unique identifier of the actor, if it is a user.",
            "example": "1111",
            "type": "string"
          },
          "name": {
            "description": "The name of the actor, if it is a user.",
            "example": "Greg Sanchez",
            "type": "string"
          }
        },
        "type": "object"
      },
      "AuditLogEventContext": {
        "description": "The context from which this event originated.",
        "properties": {
          "api_authentication_method": {
            "description": "The authentication method used in the context of an API request.\nOnly present if the `context_type` is `api`. Can be one of `cookie`, `oauth`, `personal_access_token`, or `service_account`.",
            "enum": [
              "cookie",
              "oauth",
              "personal_access_token",
              "service_account"
            ],
            "type": "string"
          },
          "client_ip_address": {
            "description": "The IP address of the client that initiated the event, if applicable.",
            "example": "1.1.1.1",
            "type": "string"
          },
          "context_type": {
            "description": "The type of context.\nCan be one of `web`, `desktop`, `mobile`, `asana_support`, `asana`, `email`, or `api`.",
            "enum": [
              "web",
              "desktop",
              "mobile",
              "asana_support",
              "asana",
              "email",
              "api"
            ],
            "example": "web",
            "type": "string"
          },
          "oauth_app_name": {
            "description": "The name of the OAuth App that initiated the event.\nOnly present if the `api_authentication_method` is `oauth`.",
            "type": "string"
          },
          "user_agent": {
            "description": "The user agent of the client that initiated the event, if applicable.",
            "example": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36",
            "type": "string"
          }
        },
        "type": "object"
      },
      "AuditLogEventDetails": {
        "description": "Event specific details. The schema will vary depending on the `event_type`.",
        "type": "object"
      },
      "AuditLogEventResource": {
        "description": "The primary object that was affected by this event.",
        "properties": {
          "email": {
            "description": "The email of the resource, if applicable.",
            "type": "string"
          },
          "gid": {
            "description": "Globally unique identifier of the resource.",
            "example": "1111",
            "type": "string"
          },
          "name": {
            "description": "The name of the resource.",
            "example": "Example Task",
            "type": "string"
          },
          "resource_subtype": {
            "description": "The subtype of resource. Most resources will not have a subtype.",
            "example": "milestone",
            "type": "string"
          },
          "resource_type": {
            "description": "The type of resource.",
            "example": "task",
            "type": "string"
          }
        },
        "type": "object"
      },
      "BatchRequest": {
        "description": "A request object for use in a batch request.",
        "properties": {
          "actions": {
            "items": {
              "$ref": "#/components/schemas/BatchRequestAction"
            },
            "type": "array"
          }
        },
        "type": "object"
      },
      "BatchRequestAction": {
        "description": "An action object for use in a batch request.",
        "properties": {
          "data": {
            "description": "For `GET` requests, this should be a map of query parameters you would have normally passed in the URL. Options and pagination are not accepted here; put them in `options` instead. For `POST`, `PATCH`, and `PUT` methods, this should be the content you would have normally put in the data field of the body.",
            "example": {
              "assignee": "me",
              "workspace": "1337"
            },
            "type": "object"
          },
          "method": {
            "description": "The HTTP method you wish to emulate for the action.",
            "enum": [
              "get",
              "post",
              "put",
              "delete",
              "patch",
              "head"
            ],
            "example": "get",
            "type": "string"
          },
          "options": {
            "description": "Pagination (`limit` and `offset`) and output options (`fields` or `expand`) for the action. “Pretty” JSON output is not an available option on individual actions; if you want pretty output, specify that option on the parent request.",
            "example": {
              "fields": [
                "name",
                "notes",
                "completed"
              ],
              "limit": 3
            },
            "properties": {
              "fields": {
                "description": "The fields to retrieve in the request.",
                "example": [
                  "name",
                  "gid",
                  "notes",
                  "completed"
                ],
                "items": {
                  "type": "string"
                },
                "type": "array"
              },
              "limit": {
                "description": "Pagination limit for the request.",
                "example": 50,
                "type": "integer"
              },
              "offset": {
                "description": "Pagination offset for the request.",
                "example": "eyJ0eXAiOJiKV1iQLCJhbGciOiJIUzI1NiJ9",
                "type": "integer"
              }
            },
            "type": "object"
          },
          "relative_path": {
            "description": "The path of the desired endpoint relative to the API’s base URL. Query parameters are not accepted here; put them in `data` instead.",
            "example": "/tasks/123",
            "type": "string"
          }
        },
        "required": [
          "relative_path",
          "method"
        ],
        "type": "object"
      },
      "BatchResponse": {
        "description": "A response object returned from a batch request.",
        "properties": {
          "body": {
            "description": "The JSON body that the invoked endpoint returned.",
            "example": {
              "data": {
                "completed": false,
                "gid": "1967",
                "name": "Hello, world!",
                "notes": "How are you today?"
              }
            },
            "type": "object"
          },
          "headers": {
            "description": "A map of HTTP headers specific to this result. This is primarily used for returning a `Location` header to accompany a `201 Created` result.  The parent HTTP response will contain all common headers.",
            "example": {
              "location": "/tasks/1234"
            },
            "type": "object"
          },
          "status_code": {
            "description": "The HTTP status code that the invoked endpoint returned.",
            "example": 200,
            "type": "integer"
          }
        },
        "type": "object"
      },
      "CustomFieldBase": {
        "allOf": [
          {
            "$ref": "#/components/schemas/CustomFieldCompact"
          },
          {
            "properties": {
              "asana_created_field": {
                "description": "*Conditional*. A unique identifier to associate this field with the template source of truth.",
                "enum": [
                  "a_v_requirements",
                  "account_name",
                  "actionable",
                  "align_shipping_link",
                  "align_status",
                  "allotted_time",
                  "appointment",
                  "approval_stage",
                  "approved",
                  "article_series",
                  "board_committee",
                  "browser",
                  "campaign_audience",
                  "campaign_project_status",
                  "campaign_regions",
                  "channel_primary",
                  "client_topic_type",
                  "complete_by",
                  "contact",
                  "contact_email_address",
                  "content_channels",
                  "content_channels_needed",
                  "content_stage",
                  "content_type",
                  "contract",
                  "contract_status",
                  "cost",
                  "creation_stage",
                  "creative_channel",
                  "creative_needed",
                  "creative_needs",
                  "data_sensitivity",
                  "deal_size",
                  "delivery_appt",
                  "delivery_appt_date",
                  "department",
                  "department_responsible",
                  "design_request_needed",
                  "design_request_type",
                  "discussion_category",
                  "do_this_task",
                  "editorial_content_status",
                  "editorial_content_tag",
                  "editorial_content_type",
                  "effort",
                  "effort_level",
                  "est_completion_date",
                  "estimated_time",
                  "estimated_value",
                  "expected_cost",
                  "external_steps_needed",
                  "favorite_idea",
                  "feedback_type",
                  "financial",
                  "funding_amount",
                  "grant_application_process",
                  "hiring_candidate_status",
                  "idea_status",
                  "ids_link",
                  "ids_patient_link",
                  "implementation_stage",
                  "insurance",
                  "interview_area",
                  "interview_question_score",
                  "itero_scan_link",
                  "job_s_applied_to",
                  "lab",
                  "launch_status",
                  "lead_status",
                  "localization_language",
                  "localization_market_team",
                  "localization_status",
                  "meeting_minutes",
                  "meeting_needed",
                  "minutes",
                  "mrr",
                  "must_localize",
                  "name_of_foundation",
                  "need_to_follow_up",
                  "next_appointment",
                  "next_steps_sales",
                  "num_people",
                  "number_of_user_reports",
                  "office_location",
                  "onboarding_activity",
                  "owner",
                  "participants_needed",
                  "patient_date_of_birth",
                  "patient_email",
                  "patient_phone",
                  "patient_status",
                  "phone_number",
                  "planning_category",
                  "point_of_contact",
                  "position",
                  "post_format",
                  "prescription",
                  "priority",
                  "priority_level",
                  "product",
                  "product_stage",
                  "progress",
                  "project_size",
                  "project_status",
                  "proposed_budget",
                  "publish_status",
                  "reason_for_scan",
                  "referral",
                  "request_type",
                  "research_status",
                  "responsible_department",
                  "responsible_team",
                  "risk_assessment_status",
                  "room_name",
                  "sales_counterpart",
                  "sentiment",
                  "shipping_link",
                  "social_channels",
                  "stage",
                  "status",
                  "status_design",
                  "status_of_initiative",
                  "system_setup",
                  "task_progress",
                  "team",
                  "team_marketing",
                  "team_responsible",
                  "time_it_takes_to_complete_tasks",
                  "timeframe",
                  "treatment_type",
                  "type_work_requests_it",
                  "use_agency",
                  "user_name",
                  "vendor_category",
                  "vendor_type",
                  "word_count"
                ],
                "example": "priority",
                "nullable": true,
                "readOnly": true,
                "type": "string"
              },
              "currency_code": {
                "description": "ISO 4217 currency code to format this custom field. This will be null if the `format` is not `currency`.",
                "example": "EUR",
                "nullable": true,
                "type": "string"
              },
              "custom_label": {
                "description": "This is the string that appears next to the custom field value. This will be null if the `format` is not `custom`.",
                "example": "gold pieces",
                "nullable": true,
                "type": "string"
              },
              "custom_label_position": {
                "description": "Only relevant for custom fields with `custom` format. This depicts where to place the custom label. This will be null if the `format` is not `custom`.",
                "enum": [
                  "prefix",
                  "suffix"
                ],
                "example": "suffix",
                "type": "string"
              },
              "description": {
                "description": "[Opt In](/docs/input-output-options). The description of the custom field.",
                "example": "Development team priority",
                "type": "string"
              },
              "enum_options": {
                "description": "*Conditional*. Only relevant for custom fields of type `enum`. This array specifies the possible values which an `enum` custom field can adopt. To modify the enum options, refer to [working with enum options](/docs/create-an-enum-option).",
                "items": {
                  "$ref": "#/components/schemas/EnumOption"
                },
                "type": "array"
              },
              "format": {
                "description": "The format of this custom field.",
                "enum": [
                  "currency",
                  "identifier",
                  "percentage",
                  "custom",
                  "none"
                ],
                "example": "custom",
                "type": "string"
              },
              "has_notifications_enabled": {
                "description": "*Conditional*. This flag describes whether a follower of a task with this field should receive inbox notifications from changes to this field.",
                "example": true,
                "type": "boolean"
              },
              "is_global_to_workspace": {
                "description": "This flag describes whether this custom field is available to every container in the workspace. Before project-specific custom fields, this field was always true.",
                "example": true,
                "readOnly": true,
                "type": "boolean"
              },
              "precision": {
                "description": "Only relevant for custom fields of type ‘Number’. This field dictates the number of places after the decimal to round to, i.e. 0 is integer values, 1 rounds to the nearest tenth, and so on. Must be between 0 and 6, inclusive.\nFor percentage format, this may be unintuitive, as a value of 0.25 has a precision of 0, while a value of 0.251 has a precision of 1. This is due to 0.25 being displayed as 25%.\nThe identifier format will always have a precision of 0.",
                "example": 2,
                "type": "integer"
              }
            },
            "type": "object"
          }
        ]
      },
      "CustomFieldCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "Custom Fields store the metadata that is used in order to add user-specified information to tasks in Asana. Be sure to reference the [Custom Fields](/docs/asana-custom-fields) developer documentation for more information about how custom fields relate to various resources in Asana.\n\nUsers in Asana can [lock custom fields](https://asana.com/guide/help/premium/custom-fields#gl-lock-fields), which will make them read-only when accessed by other users. Attempting to edit a locked custom field will return HTTP error code `403 Forbidden`.",
            "properties": {
              "date_value": {
                "description": "*Conditional*. Only relevant for custom fields of type `date`. This object reflects the chosen date (and optionally, time) value of a `date` custom field. If no date is selected, the value of `date_value` will be `null`.",
                "properties": {
                  "date": {
                    "description": "A string representing the date in YYYY-MM-DD format.",
                    "example": "2024-08-23",
                    "type": "string"
                  },
                  "date_time": {
                    "description": "A string representing the date in ISO 8601 format. If no time value is selected, the value of `date-time` will be `null`.",
                    "example": "2024-08-23T22:00:00.000Z",
                    "type": "string"
                  }
                },
                "type": "object"
              },
              "display_value": {
                "description": "A string representation for the value of the custom field. Integrations that don't require the underlying type should use this field to read values. Using this field will future-proof an app against new custom field types.",
                "example": "blue",
                "nullable": true,
                "readOnly": true,
                "type": "string"
              },
              "enabled": {
                "description": "*Conditional*. Determines if the custom field is enabled or not.",
                "example": true,
                "type": "boolean"
              },
              "enum_options": {
                "description": "*Conditional*. Only relevant for custom fields of type `enum`. This array specifies the possible values which an `enum` custom field can adopt. To modify the enum options, refer to [working with enum options](/docs/create-an-enum-option).",
                "items": {
                  "$ref": "#/components/schemas/EnumOption"
                },
                "type": "array"
              },
              "enum_value": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/EnumOption"
                  },
                  {
                    "description": "*Conditional*. Only relevant for custom fields of type `enum`. This object is the chosen value of an `enum` custom field.",
                    "type": "object"
                  }
                ]
              },
              "multi_enum_values": {
                "description": "*Conditional*. Only relevant for custom fields of type `multi_enum`. This object is the chosen values of a `multi_enum` custom field.",
                "items": {
                  "$ref": "#/components/schemas/EnumOption"
                },
                "type": "array"
              },
              "name": {
                "description": "The name of the custom field.",
                "example": "Status",
                "type": "string"
              },
              "number_value": {
                "description": "*Conditional*. This number is the value of a `number` custom field.",
                "example": 5.2,
                "type": "number"
              },
              "resource_subtype": {
                "description": "The type of the custom field. Must be one of the given values.\n",
                "enum": [
                  "text",
                  "enum",
                  "multi_enum",
                  "number",
                  "date",
                  "people"
                ],
                "example": "text",
                "type": "string"
              },
              "text_value": {
                "description": "*Conditional*. This string is the value of a `text` custom field.",
                "example": "Some Value",
                "type": "string"
              },
              "type": {
                "description": "*Deprecated: new integrations should prefer the resource_subtype field.* The type of the custom field. Must be one of the given values.\n",
                "enum": [
                  "text",
                  "enum",
                  "multi_enum",
                  "number"
                ],
                "readOnly": true,
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "custom_field"
            }
          }
        ]
      },
      "CustomFieldRequest": {
        "allOf": [
          {
            "$ref": "#/components/schemas/CustomFieldBase"
          },
          {
            "properties": {
              "people_value": {
                "description": "*Conditional*. Only relevant for custom fields of type `people`. This array of user GIDs reflects the users to be written to a `people` custom field. Note that *write* operations will replace existing users (if any) in the custom field with the users specified in this array.",
                "example": [
                  "12345"
                ],
                "items": {
                  "description": "The GID of a user.",
                  "type": "string"
                },
                "type": "array"
              },
              "workspace": {
                "description": "*Create-Only* The workspace to create a custom field in.",
                "example": "1331",
                "type": "string"
              }
            },
            "required": [
              "workspace"
            ],
            "type": "object"
          }
        ]
      },
      "CustomFieldResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/CustomFieldBase"
          },
          {
            "properties": {
              "created_by": {
                "$ref": "#/components/schemas/UserCompact",
                "nullable": true
              },
              "people_value": {
                "description": "*Conditional*. Only relevant for custom fields of type `people`. This array of [compact user](/docs/user-compact) objects reflects the values of a `people` custom field.",
                "items": {
                  "$ref": "#/components/schemas/UserCompact"
                },
                "type": "array"
              }
            },
            "type": "object"
          }
        ]
      },
      "CustomFieldSettingBase": {
        "$ref": "#/components/schemas/CustomFieldSettingCompact"
      },
      "CustomFieldSettingCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "Custom Fields Settings objects represent the many-to-many join of the Custom Field and Project as well as stores information that is relevant to that particular pairing.",
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "custom_field_setting"
            }
          }
        ]
      },
      "CustomFieldSettingResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/CustomFieldSettingBase"
          },
          {
            "properties": {
              "custom_field": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/CustomFieldResponse"
                  },
                  {
                    "description": "The custom field that is applied to the `parent`.",
                    "readOnly": true,
                    "type": "object"
                  }
                ]
              },
              "is_important": {
                "description": "`is_important` is used in the Asana web application to determine if this custom field is displayed in the list/grid view of a project or portfolio.",
                "example": false,
                "readOnly": true,
                "type": "boolean"
              },
              "parent": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/ProjectCompact"
                  },
                  {
                    "description": "The parent to which the custom field is applied. This can be a project or portfolio and indicates that the tasks or projects that the parent contains may be given custom field values for this custom field.",
                    "readOnly": true,
                    "type": "object"
                  }
                ]
              },
              "project": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/ProjectCompact"
                  },
                  {
                    "description": "*Deprecated: new integrations should prefer the `parent` field.* The id of the project that this custom field settings refers to.",
                    "readOnly": true,
                    "type": "object"
                  }
                ]
              }
            },
            "type": "object"
          }
        ]
      },
      "DateVariableCompact": {
        "properties": {
          "description": {
            "description": "The description of what the date variable is used for when instantiating a project.",
            "example": "Choose a start date for your project.",
            "readOnly": true,
            "type": "string"
          },
          "gid": {
            "description": "Globally unique identifier of the date field in the project template. A value of `1` refers to the project start date, while `2` refers to the project due date.",
            "example": "1",
            "readOnly": true,
            "type": "string"
          },
          "name": {
            "description": "The name of the date variable.",
            "example": "Start Date",
            "readOnly": true,
            "type": "string"
          }
        },
        "type": "object"
      },
      "DateVariableRequest": {
        "properties": {
          "gid": {
            "description": "Globally unique identifier of the date field in the project template. A value of `1` refers to the project start date, while `2` refers to the project due date.",
            "example": "1",
            "type": "string"
          },
          "value": {
            "description": "The date with which the date variable should be replaced when instantiating a project. This takes a date with `YYYY-MM-DD` format.",
            "example": "2022-01-01",
            "format": "date-time",
            "nullable": true,
            "type": "string"
          }
        },
        "type": "object"
      },
      "EmptyResponse": {
        "description": "An empty object. Some endpoints do not return an object on success. The success is conveyed through a 2-- status code and returning an empty object.",
        "type": "object"
      },
      "EnumOption": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "Enum options are the possible values which an enum custom field can adopt. An enum custom field must contain at least 1 enum option but no more than 500.\n\nYou can add enum options to a custom field by using the `POST /custom_fields/custom_field_gid/enum_options` endpoint.\n\n**It is not possible to remove or delete an enum option**. Instead, enum options can be disabled by updating the `enabled` field to false with the `PUT /enum_options/enum_option_gid` endpoint. Other attributes can be updated similarly.\n\nOn creation of an enum option, `enabled` is always set to `true`, meaning the enum option is a selectable value for the custom field. Setting `enabled=false` is equivalent to “trashing” the enum option in the Asana web app within the “Edit Fields” dialog. The enum option will no longer be selectable but, if the enum option value was previously set within a task, the task will retain the value.\n\nEnum options are an ordered list and by default new enum options are inserted at the end. Ordering in relation to existing enum options can be specified on creation by using `insert_before` or `insert_after` to reference an existing enum option. Only one of `insert_before` and `insert_after` can be provided when creating a new enum option.\n\nAn enum options list can be reordered with the `POST /custom_fields/custom_field_gid/enum_options/insert` endpoint.",
            "properties": {
              "color": {
                "description": "The color of the enum option. Defaults to ‘none’.",
                "example": "blue",
                "type": "string"
              },
              "enabled": {
                "description": "Whether or not the enum option is a selectable value for the custom field.",
                "example": true,
                "type": "boolean"
              },
              "name": {
                "description": "The name of the enum option.",
                "example": "Low",
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "enum_option"
            }
          }
        ]
      },
      "EnumOptionBase": {
        "$ref": "#/components/schemas/EnumOption"
      },
      "EnumOptionInsertRequest": {
        "properties": {
          "after_enum_option": {
            "description": "An existing enum option within this custom field after which the new enum option should be inserted. Cannot be provided together with before_enum_option.",
            "example": "12345",
            "type": "string"
          },
          "before_enum_option": {
            "description": "An existing enum option within this custom field before which the new enum option should be inserted. Cannot be provided together with after_enum_option.",
            "example": "12345",
            "type": "string"
          },
          "enum_option": {
            "description": "The gid of the enum option to relocate.",
            "example": "97285",
            "type": "string"
          }
        },
        "required": [
          "enum_option"
        ],
        "type": "object"
      },
      "EnumOptionRequest": {
        "allOf": [
          {
            "$ref": "#/components/schemas/EnumOptionBase"
          },
          {
            "properties": {
              "insert_after": {
                "description": "An existing enum option within this custom field after which the new enum option should be inserted. Cannot be provided together with before_enum_option.",
                "example": "12345",
                "type": "string"
              },
              "insert_before": {
                "description": "An existing enum option within this custom field before which the new enum option should be inserted. Cannot be provided together with after_enum_option.",
                "example": "12345",
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "Error": {
        "properties": {
          "help": {
            "description": "Additional information directing developers to resources on how to address and fix the problem, if available.",
            "example": "For more information on API status codes and how to handle them, read the docs on errors: https://asana.github.io/developer-docs/#errors'",
            "readOnly": true,
            "type": "string"
          },
          "message": {
            "description": "Message providing more detail about the error that occurred, if available.",
            "example": "project: Missing input",
            "readOnly": true,
            "type": "string"
          },
          "phrase": {
            "description": "*500 errors only*. A unique error phrase which can be used when contacting developer support to help identify the exact occurrence of the problem in Asana’s logs.",
            "example": "6 sad squid snuggle softly",
            "readOnly": true,
            "type": "string"
          }
        },
        "type": "object"
      },
      "ErrorResponse": {
        "description": "Sadly, sometimes requests to the API are not successful. Failures can\noccur for a wide range of reasons. In all cases, the API should return\nan HTTP Status Code that indicates the nature of the failure,\nwith a response body in JSON format containing additional information.\n\n\nIn the event of a server error the response body will contain an error\nphrase. These phrases are automatically generated using the\n[node-asana-phrase\nlibrary](https://github.com/Asana/node-asana-phrase) and can be used by\nAsana support to quickly look up the incident that caused the server\nerror.",
        "properties": {
          "errors": {
            "items": {
              "$ref": "#/components/schemas/Error"
            },
            "type": "array"
          }
        },
        "type": "object"
      },
      "EventResponse": {
        "description": "An *event* is an object representing a change to a resource that was\nobserved by an event subscription or delivered asynchronously to\nthe target location of an active webhook.\n\nThe event may be triggered by a different `user` than the\nsubscriber. For example, if user A subscribes to a task and user B\nmodified it, the event’s user will be user B. Note: Some events\nare generated by the system, and will have `null` as the user. API\nconsumers should make sure to handle this case.\n\nThe `resource` that triggered the event may be different from the one\nthat the events were requested for or the webhook is subscribed to. For\nexample, a subscription to a project will contain events for tasks\ncontained within the project.\n\n**Note:** pay close attention to the relationship between the fields\n`Event.action` and `Event.change.action`.\n`Event.action` represents the action taken on the resource\nitself, and `Event.change.action` represents how the information\nwithin the resource's fields have been modified.\n\nFor instance, consider these scenarios:\n\n\n* When at task is added to a project, `Event.action` will be\n`added`, `Event.parent` will be an object with the `id` and\n`type` of the project, and there will be no `change` field.\n\n\n* When an assignee is set on the task, `Event.parent` will be\n`null`, `Event.action` will be `changed`,\n`Event.change.action` will be `changed`, and `new_value` will\nbe an object with the user's `id` and `type`.\n\n\n* When a collaborator is added to the task, `Event.parent` will\nbe `null`, `Event.action` will be `changed`,\n`Event.change.action` will be `added`, and `added_value` will be\nan object with the user's `id` and `type`.",
        "properties": {
          "action": {
            "description": "The type of action taken on the **resource** that triggered the event.  This can be one of `changed`, `added`, `removed`, `deleted`, or `undeleted` depending on the nature of the event.",
            "example": "changed",
            "readOnly": true,
            "type": "string"
          },
          "change": {
            "description": "Information about the type of change that has occurred. This field is only present when the value of the property `action`, describing the action taken on the **resource**, is `changed`.",
            "properties": {
              "action": {
                "description": "The type of action taken on the **field** which has been changed.  This can be one of `changed`, `added`, or `removed` depending on the nature of the change.",
                "example": "changed",
                "readOnly": true,
                "type": "string"
              },
              "added_value": {
                "description": "*Conditional.* This property is only present when the **field's** `action` is `added` _and_ the `added_value` is an Asana resource. This will be only the `gid` and `resource_type` of the resource when the events come from webhooks; this will be the compact representation (and can have fields expanded with [opt_fields](/docs/input-output-options)) when using the [Events](/docs/asana-events) endpoint.",
                "example": {
                  "gid": "12345",
                  "resource_type": "user"
                }
              },
              "field": {
                "description": "The name of the field that has changed in the resource.",
                "example": "assignee",
                "readOnly": true,
                "type": "string"
              },
              "new_value": {
                "description": "*Conditional.* This property is only present when the **field's** `action` is `changed` _and_ the `new_value` is an Asana resource. This will be only the `gid` and `resource_type` of the resource when the events come from webhooks; this will be the compact representation (and can have fields expanded with [opt_fields](/docs/input-output-options)) when using the [Events](/docs/asana-events) endpoint.",
                "example": {
                  "gid": "12345",
                  "resource_type": "user"
                }
              },
              "removed_value": {
                "description": "*Conditional.* This property is only present when the **field's** `action` is `removed` _and_ the `removed_value` is an Asana resource. This will be only the `gid` and `resource_type` of the resource when the events come from webhooks; this will be the compact representation (and can have fields expanded with [opt_fields](/docs/input-output-options)) when using the [Events](/docs/asana-events) endpoint.",
                "example": {
                  "gid": "12345",
                  "resource_type": "user"
                }
              }
            },
            "readOnly": true,
            "type": "object"
          },
          "created_at": {
            "description": "The timestamp when the event occurred.",
            "example": "2012-02-22T02:06:58.147Z",
            "format": "date-time",
            "readOnly": true,
            "type": "string"
          },
          "parent": {
            "allOf": [
              {
                "$ref": "#/components/schemas/AsanaNamedResource"
              },
              {
                "description": "For added/removed events, the parent object that resource was added to or removed from. The parent will be `null` for other event types."
              }
            ]
          },
          "resource": {
            "allOf": [
              {
                "$ref": "#/components/schemas/AsanaNamedResource"
              },
              {
                "description": "The resource which has triggered the event by being modified in some way."
              }
            ]
          },
          "type": {
            "description": "*Deprecated: Refer to the resource_type of the resource.* The type of the resource that generated the event.",
            "example": "task",
            "readOnly": true,
            "type": "string"
          },
          "user": {
            "allOf": [
              {
                "$ref": "#/components/schemas/UserCompact"
              },
              {
                "description": "The user who triggered the event."
              }
            ]
          }
        },
        "type": "object"
      },
      "GoalAddSubgoalRequest": {
        "properties": {
          "insert_after": {
            "description": "An id of a subgoal of this parent goal. The new subgoal will be added after the one specified here. `insert_before` and `insert_after` parameters cannot both be specified.",
            "example": "1331",
            "type": "string"
          },
          "insert_before": {
            "description": "An id of a subgoal of this parent goal. The new subgoal will be added before the one specified here. `insert_before` and `insert_after` parameters cannot both be specified.",
            "example": "1331",
            "type": "string"
          },
          "subgoal": {
            "description": "The goal gid to add as subgoal to a parent goal",
            "example": "1331",
            "type": "string"
          }
        },
        "required": [
          "subgoal"
        ],
        "type": "object"
      },
      "GoalAddSupportingRelationshipRequest": {
        "properties": {
          "contribution_weight": {
            "description": "The weight that the supporting resource's progress will contribute to the supported goal's progress. This can only be 0 or 1.",
            "example": 1,
            "type": "number"
          },
          "insert_after": {
            "description": "An id of a subgoal of this parent goal. The new subgoal will be added after the one specified here. `insert_before` and `insert_after` parameters cannot both be specified. Currently only supported when adding a subgoal.",
            "example": "1331",
            "type": "string"
          },
          "insert_before": {
            "description": "An id of a subgoal of this parent goal. The new subgoal will be added before the one specified here. `insert_before` and `insert_after` parameters cannot both be specified. Currently only supported when adding a subgoal.",
            "example": "1331",
            "type": "string"
          },
          "supporting_resource": {
            "description": "The gid of the supporting resource to add to the parent goal. Must be the gid of a goal, project, or portfolio.",
            "example": "12345",
            "type": "string"
          }
        },
        "required": [
          "supporting_resource"
        ],
        "type": "object"
      },
      "GoalAddSupportingWorkRequest": {
        "properties": {
          "supporting_work": {
            "description": "The project/portfolio gid to add as supporting work for a goal",
            "example": "1331",
            "type": "string"
          }
        },
        "required": [
          "supporting_work"
        ],
        "type": "object"
      },
      "GoalBase": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "properties": {
              "due_on": {
                "description": "The localized day on which this goal is due. This takes a date with format `YYYY-MM-DD`.",
                "example": "2019-09-15",
                "nullable": true,
                "type": "string"
              },
              "html_notes": {
                "description": "The notes of the goal with formatting as HTML.",
                "example": "<body>Start building brand awareness.</body>",
                "type": "string"
              },
              "is_workspace_level": {
                "description": "*Conditional*. This property is only present when the `workspace` provided is an organization. Whether the goal belongs to the `workspace` (and is listed as part of the workspace’s goals) or not. If it isn’t a workspace-level goal, it is a team-level goal, and is associated with the goal’s team.",
                "example": true,
                "type": "boolean"
              },
              "liked": {
                "description": "True if the goal is liked by the authorized user, false if not.",
                "example": false,
                "type": "boolean"
              },
              "name": {
                "description": "The name of the goal.",
                "example": "Grow web traffic by 30%",
                "type": "string"
              },
              "notes": {
                "description": "Free-form textual information associated with the goal (i.e. its description).",
                "example": "Start building brand awareness.",
                "type": "string"
              },
              "start_on": {
                "description": "The day on which work for this goal begins, or null if the goal has no start date. This takes a date with `YYYY-MM-DD` format, and cannot be set unless there is an accompanying due date.",
                "example": "2019-09-14",
                "nullable": true,
                "type": "string"
              },
              "status": {
                "description": "The current status of this goal. When the goal is open, its status can be `green`, `yellow`, and `red` to reflect \"On Track\", \"At Risk\", and \"Off Track\", respectively. When the goal is closed, the value can be `missed`, `achieved`, `partial`, or `dropped`.\n*Note* you can only write to this property if `metric` is set.",
                "example": "green",
                "nullable": true,
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "goal"
            }
          }
        ]
      },
      "GoalCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "properties": {
              "name": {
                "description": "The name of the goal.",
                "example": "Grow web traffic by 30%",
                "type": "string"
              },
              "owner": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/UserCompact"
                  },
                  {
                    "nullable": true,
                    "type": "object"
                  }
                ]
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "goal"
            }
          }
        ]
      },
      "GoalMembershipBase": {
        "$ref": "#/components/schemas/GoalMembershipCompact"
      },
      "GoalMembershipCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "This object represents a user's connection to a goal.",
            "properties": {
              "is_commenter": {
                "description": "Describes if the user is comment only in goal.",
                "example": false,
                "type": "boolean"
              },
              "is_editor": {
                "description": "Describes if the user is editor in goal.",
                "example": false,
                "type": "boolean"
              },
              "member": {
                "$ref": "#/components/schemas/UserCompact"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "goal_membership"
            }
          }
        ]
      },
      "GoalMembershipResponse": {
        "$ref": "#/components/schemas/GoalMembershipBase"
      },
      "GoalMetricBase": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "properties": {
              "currency_code": {
                "description": "ISO 4217 currency code to format this custom field. This will be null if the `unit` is not `currency`.",
                "example": "EUR",
                "nullable": true,
                "type": "string"
              },
              "current_display_value": {
                "description": "This string is the current value of a goal metric of type string.",
                "example": "8.12",
                "readOnly": true,
                "type": "string"
              },
              "current_number_value": {
                "description": "This number is the current value of a goal metric of type number.",
                "example": 8.12,
                "type": "number"
              },
              "initial_number_value": {
                "description": "This number is the start value of a goal metric of type number.",
                "example": 5.2,
                "type": "number"
              },
              "precision": {
                "description": "*Conditional*. Only relevant for goal metrics of type ‘Number’. This field dictates the number of places after the decimal to round to, i.e. 0 is integer values, 1 rounds to the nearest tenth, and so on. Must be between 0 and 6, inclusive.\nFor percentage format, this may be unintuitive, as a value of 0.25 has a precision of 0, while a value of 0.251 has a precision of 1. This is due to 0.25 being displayed as 25%.",
                "example": 2,
                "type": "integer"
              },
              "progress_source": {
                "description": "This field defines how the progress value of a goal metric is being calculated. A goal's progress can be provided manually by the user, calculated automatically from contributing subgoals or projects, or managed by an integration with an external data source, such as Salesforce.",
                "enum": [
                  "manual",
                  "subgoal_progress",
                  "project_task_completion",
                  "project_milestone_completion",
                  "external"
                ],
                "example": "manual",
                "type": "string"
              },
              "resource_subtype": {
                "description": "The subtype of this resource. Different subtypes retain many of the same fields and behavior, but may render differently in Asana or represent resources with different semantic meaning.",
                "enum": [
                  "number"
                ],
                "example": "number",
                "readOnly": true,
                "type": "string"
              },
              "target_number_value": {
                "description": "This number is the end value of a goal metric of type number. This number cannot equal `initial_number_value`.",
                "example": 10.2,
                "type": "number"
              },
              "unit": {
                "description": "A supported unit of measure for the goal metric, or none.",
                "enum": [
                  "none",
                  "currency",
                  "percentage"
                ],
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "GoalMetricCurrentValueRequest": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "properties": {
              "current_number_value": {
                "description": "*Conditional*. This number is the current value of a goal metric of type number.",
                "example": 8.12,
                "type": "number"
              }
            },
            "type": "object"
          }
        ]
      },
      "GoalMetricRequest": {
        "$ref": "#/components/schemas/GoalMetricBase"
      },
      "GoalRelationshipBase": {
        "allOf": [
          {
            "$ref": "#/components/schemas/GoalRelationshipCompact"
          },
          {
            "properties": {
              "supported_goal": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/GoalCompact"
                  },
                  {
                    "description": "The goal that the supporting resource supports.",
                    "readOnly": true,
                    "type": "object"
                  }
                ]
              }
            },
            "type": "object"
          }
        ]
      },
      "GoalRelationshipCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "A *goal relationship* is an object representing the relationship between a goal and another goal, a project, or a portfolio.",
            "properties": {
              "contribution_weight": {
                "description": "The weight that the supporting resource's progress contributes to the supported goal's progress. This can only be 0 or 1.",
                "example": 1,
                "type": "number"
              },
              "resource_subtype": {
                "description": "The subtype of this resource. Different subtypes retain many of the same fields and behavior, but may render differently in Asana or represent resources with different semantic meaning.",
                "enum": [
                  "subgoal",
                  "supporting_work"
                ],
                "example": "subgoal",
                "readOnly": true,
                "type": "string"
              },
              "supporting_resource": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/ProjectCompact"
                  },
                  {
                    "description": "The supporting resource that supports the goal. This can be either a project, portfolio, or goal.",
                    "readOnly": true,
                    "type": "object"
                  }
                ]
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "goal_relationship"
            }
          }
        ]
      },
      "GoalRelationshipRequest": {
        "allOf": [
          {
            "$ref": "#/components/schemas/GoalRelationshipBase"
          },
          {
            "type": "object"
          }
        ]
      },
      "GoalRelationshipResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/GoalRelationshipBase"
          },
          {
            "type": "object"
          }
        ]
      },
      "GoalRemoveSubgoalRequest": {
        "properties": {
          "subgoal": {
            "description": "The goal gid to remove as subgoal from the parent goal",
            "example": "1331",
            "type": "string"
          }
        },
        "required": [
          "subgoal"
        ],
        "type": "object"
      },
      "GoalRemoveSupportingRelationshipRequest": {
        "properties": {
          "supporting_resource": {
            "description": "The gid of the supporting resource to remove from the parent goal. Must be the gid of a goal, project, or portfolio.",
            "example": "12345",
            "type": "string"
          }
        },
        "required": [
          "supporting_resource"
        ],
        "type": "object"
      },
      "GoalRequest": {
        "allOf": [
          {
            "$ref": "#/components/schemas/GoalBase"
          },
          {
            "properties": {
              "followers": {
                "example": [
                  "12345"
                ],
                "items": {
                  "description": "The `gid` of a user.",
                  "type": "string"
                },
                "type": "array"
              },
              "owner": {
                "description": "The `gid` of a user.",
                "example": "12345",
                "nullable": true,
                "type": "string"
              },
              "team": {
                "description": "*Conditional*. This property is only present when the `workspace` provided is an organization.",
                "example": "12345",
                "nullable": true,
                "type": "string"
              },
              "time_period": {
                "description": "The `gid` of a time period.",
                "example": "12345",
                "nullable": true,
                "type": "string"
              },
              "workspace": {
                "description": "The `gid` of a workspace.",
                "example": "12345",
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "GoalResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/GoalBase"
          },
          {
            "properties": {
              "current_status_update": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/StatusUpdateCompact"
                  }
                ],
                "description": "The latest `status_update` posted to this goal.",
                "nullable": true
              },
              "followers": {
                "description": "Array of users who are members of this goal.",
                "items": {
                  "$ref": "#/components/schemas/UserCompact"
                },
                "type": "array"
              },
              "likes": {
                "description": "Array of likes for users who have liked this goal.",
                "items": {
                  "$ref": "#/components/schemas/Like"
                },
                "readOnly": true,
                "type": "array"
              },
              "metric": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/GoalMetricBase"
                  },
                  {
                    "nullable": true,
                    "properties": {
                      "can_manage": {
                        "description": "*Conditional*. Only relevant for `progress_source` of type `external`. This boolean indicates whether the requester has the ability to update the current value of this metric. This returns `true` if the external metric was created by the requester, `false` otherwise.",
                        "example": true,
                        "readOnly": true,
                        "type": "boolean"
                      }
                    },
                    "type": "object"
                  }
                ]
              },
              "num_likes": {
                "description": "The number of users who have liked this goal.",
                "example": 5,
                "readOnly": true,
                "type": "integer"
              },
              "owner": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/UserCompact"
                  },
                  {
                    "nullable": true,
                    "type": "object"
                  }
                ]
              },
              "team": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/TeamCompact"
                  },
                  {
                    "nullable": true,
                    "type": "object"
                  }
                ],
                "description": "*Conditional*. This property is only present when the `workspace` provided is an organization."
              },
              "time_period": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/TimePeriodCompact"
                  },
                  {
                    "nullable": true,
                    "type": "object"
                  }
                ]
              },
              "workspace": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/WorkspaceCompact"
                  },
                  {
                    "type": "object"
                  }
                ]
              }
            },
            "type": "object"
          }
        ]
      },
      "JobBase": {
        "$ref": "#/components/schemas/JobCompact"
      },
      "JobCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "A *job* is an object representing a process that handles asynchronous work.",
            "properties": {
              "new_project": {
                "$ref": "#/components/schemas/ProjectCompact"
              },
              "new_project_template": {
                "$ref": "#/components/schemas/ProjectTemplateCompact"
              },
              "new_task": {
                "$ref": "#/components/schemas/TaskCompact"
              },
              "resource_subtype": {
                "description": "The subtype of this resource. Different subtypes retain many of the same fields and behavior, but may render differently in Asana or represent resources with different semantic meaning.",
                "example": "duplicate_task",
                "readOnly": true,
                "type": "string"
              },
              "status": {
                "description": "The current status of this job. The value is one of: `not_started`, `in_progress`, `succeeded`, or `failed`.",
                "enum": [
                  "not_started",
                  "in_progress",
                  "succeeded",
                  "failed"
                ],
                "example": "in_progress",
                "readOnly": true,
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "job"
            }
          }
        ]
      },
      "JobResponse": {
        "$ref": "#/components/schemas/JobBase"
      },
      "Like": {
        "description": "An object to represent a user's like.",
        "properties": {
          "gid": {
            "description": "Globally unique identifier of the object, as a string.",
            "example": "12345",
            "readOnly": true,
            "type": "string"
          },
          "user": {
            "$ref": "#/components/schemas/UserCompact"
          }
        },
        "type": "object"
      },
      "ModifyDependenciesRequest": {
        "example": {
          "dependencies": [
            "133713",
            "184253"
          ]
        },
        "properties": {
          "dependencies": {
            "description": "An array of task gids that a task depends on.",
            "items": {
              "type": "string"
            },
            "type": "array"
          }
        },
        "type": "object"
      },
      "ModifyDependentsRequest": {
        "description": "A set of dependent tasks.",
        "example": {
          "dependents": [
            "133713",
            "184253"
          ]
        },
        "properties": {
          "dependents": {
            "description": "An array of task gids that are dependents of the given task.",
            "items": {
              "type": "string"
            },
            "type": "array"
          }
        },
        "type": "object"
      },
      "OrganizationExportBase": {
        "$ref": "#/components/schemas/OrganizationExportCompact"
      },
      "OrganizationExportCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "An *organization_export* object represents a request to export the complete data of an Organization in JSON format.",
            "properties": {
              "created_at": {
                "description": "The time at which this resource was created.",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              },
              "download_url": {
                "description": "Download this URL to retreive the full export of the organization\nin JSON format. It will be compressed in a gzip (.gz) container.\n\n*Note: May be null if the export is still in progress or\nfailed.  If present, this URL may only be valid for 1 hour from\nthe time of retrieval. You should avoid persisting this URL\nsomewhere and rather refresh on demand to ensure you do not keep\nstale URLs.*",
                "example": "https://asana-export.s3.amazonaws.com/export-4632784536274-20170127-43246.json.gz?AWSAccessKeyId=xxxxxxxx",
                "format": "uri",
                "nullable": true,
                "readOnly": true,
                "type": "string"
              },
              "organization": {
                "$ref": "#/components/schemas/WorkspaceCompact"
              },
              "state": {
                "description": "The current state of the export.",
                "enum": [
                  "pending",
                  "started",
                  "finished",
                  "error"
                ],
                "example": "started",
                "readOnly": true,
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "organization_export"
            }
          }
        ]
      },
      "OrganizationExportRequest": {
        "description": "An *organization_export* request starts a job to export the complete data of the given Organization.",
        "properties": {
          "organization": {
            "description": "Globally unique identifier for the workspace or organization.",
            "example": "1331",
            "type": "string"
          }
        },
        "type": "object"
      },
      "OrganizationExportResponse": {
        "$ref": "#/components/schemas/OrganizationExportBase"
      },
      "PortfolioAddItemRequest": {
        "properties": {
          "insert_after": {
            "description": "An id of an item in this portfolio. The new item will be added after the one specified here. `insert_before` and `insert_after` parameters cannot both be specified.",
            "example": "1331",
            "type": "string"
          },
          "insert_before": {
            "description": "An id of an item in this portfolio. The new item will be added before the one specified here. `insert_before` and `insert_after` parameters cannot both be specified.",
            "example": "1331",
            "type": "string"
          },
          "item": {
            "description": "The item to add to the portfolio.",
            "example": "1331",
            "type": "string"
          }
        },
        "required": [
          "item"
        ],
        "type": "object"
      },
      "PortfolioBase": {
        "allOf": [
          {
            "$ref": "#/components/schemas/PortfolioCompact"
          },
          {
            "properties": {
              "color": {
                "description": "Color of the portfolio.",
                "enum": [
                  "dark-pink",
                  "dark-green",
                  "dark-blue",
                  "dark-red",
                  "dark-teal",
                  "dark-brown",
                  "dark-orange",
                  "dark-purple",
                  "dark-warm-gray",
                  "light-pink",
                  "light-green",
                  "light-blue",
                  "light-red",
                  "light-teal",
                  "light-brown",
                  "light-orange",
                  "light-purple",
                  "light-warm-gray"
                ],
                "example": "light-green",
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "PortfolioCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "A *portfolio* gives a high-level overview of the status of multiple initiatives in Asana. Portfolios provide a dashboard overview of the state of multiple projects, including a progress report and the most recent [project status](/docs/asana-project-statuses) update.\nPortfolios have some restrictions on size. Each portfolio has a max of 500 items and, like projects, a max of 20 custom fields.",
            "properties": {
              "name": {
                "description": "The name of the portfolio.",
                "example": "Bug Portfolio",
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "portfolio"
            }
          }
        ]
      },
      "PortfolioMembershipBase": {
        "$ref": "#/components/schemas/PortfolioMembershipCompact"
      },
      "PortfolioMembershipCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "This object determines if a user is a member of a portfolio.",
            "properties": {
              "portfolio": {
                "$ref": "#/components/schemas/PortfolioCompact",
                "description": "[Opt In](/docs/input-output-options). The portfolio the user is a member of."
              },
              "user": {
                "$ref": "#/components/schemas/UserCompact"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "portfolio_membership"
            }
          }
        ]
      },
      "PortfolioMembershipResponse": {
        "$ref": "#/components/schemas/PortfolioMembershipBase"
      },
      "PortfolioRemoveItemRequest": {
        "properties": {
          "item": {
            "description": "The item to remove from the portfolio.",
            "example": "1331",
            "type": "string"
          }
        },
        "required": [
          "item"
        ],
        "type": "object"
      },
      "PortfolioRequest": {
        "allOf": [
          {
            "$ref": "#/components/schemas/PortfolioBase"
          },
          {
            "properties": {
              "members": {
                "description": "An array of strings identifying users. These can either be the string \"me\", an email, or the gid of a user.",
                "example": [
                  "52164",
                  "15363"
                ],
                "items": {
                  "description": "Gid of an object.",
                  "type": "string"
                },
                "readOnly": true,
                "type": "array"
              },
              "public": {
                "description": "True if the portfolio is public to its workspace members.",
                "example": false,
                "type": "boolean"
              },
              "workspace": {
                "description": "Gid of an object.",
                "example": "167589",
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "PortfolioResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/PortfolioBase"
          },
          {
            "properties": {
              "created_at": {
                "description": "The time at which this resource was created.",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              },
              "created_by": {
                "$ref": "#/components/schemas/UserCompact"
              },
              "current_status_update": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/StatusUpdateCompact"
                  }
                ],
                "description": "The latest `status_update` posted to this portfolio.",
                "nullable": true
              },
              "custom_field_settings": {
                "description": "Array of custom field settings applied to the portfolio.",
                "items": {
                  "$ref": "#/components/schemas/CustomFieldSettingResponse"
                },
                "type": "array"
              },
              "custom_fields": {
                "description": "Array of Custom Fields.",
                "items": {
                  "$ref": "#/components/schemas/CustomFieldCompact"
                },
                "type": "array"
              },
              "due_on": {
                "description": "The localized day on which this portfolio is due. This takes a date with format YYYY-MM-DD.",
                "example": "2019-09-15",
                "format": "date-time",
                "nullable": true,
                "type": "string"
              },
              "members": {
                "items": {
                  "$ref": "#/components/schemas/UserCompact"
                },
                "readOnly": true,
                "type": "array"
              },
              "owner": {
                "$ref": "#/components/schemas/UserCompact"
              },
              "permalink_url": {
                "description": "A url that points directly to the object within Asana.",
                "example": "https://app.asana.com/0/resource/123456789/list",
                "readOnly": true,
                "type": "string"
              },
              "public": {
                "description": "True if the portfolio is public to its workspace members.",
                "example": false,
                "type": "boolean"
              },
              "start_on": {
                "description": "The day on which work for this portfolio begins, or null if the portfolio has no start date. This takes a date with `YYYY-MM-DD` format. *Note: `due_on` must be present in the request when setting or unsetting the `start_on` parameter. Additionally, `start_on` and `due_on` cannot be the same date.*",
                "example": "2019-09-14",
                "format": "date",
                "nullable": true,
                "type": "string"
              },
              "workspace": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/WorkspaceCompact"
                  },
                  {
                    "description": "*Create-only*. The workspace or organization that the portfolio belongs to.",
                    "type": "object"
                  }
                ]
              }
            },
            "type": "object"
          }
        ]
      },
      "Preview": {
        "description": "A collection of rich text that will be displayed as a preview to another app.\n\nThis is read-only except for a small group of whitelisted apps.",
        "properties": {
          "fallback": {
            "description": "Some fallback text to display if unable to display the full preview.",
            "example": "Greg: Great! I like this idea.\\n\\nhttps//a_company.slack.com/archives/ABCDEFG/12345678",
            "type": "string"
          },
          "footer": {
            "description": "Text to display in the footer.",
            "example": "Mar 17, 2019 1:25 PM",
            "type": "string"
          },
          "header": {
            "description": "Text to display in the header.",
            "example": "Asana for Slack",
            "type": "string"
          },
          "header_link": {
            "description": "Where the header will link to.",
            "example": "https://asana.comn/apps/slack",
            "type": "string"
          },
          "html_text": {
            "description": "HTML formatted text for the body of the preview.",
            "example": "<body>Great! I like this idea.</body>",
            "type": "string"
          },
          "text": {
            "description": "Text for the body of the preview.",
            "example": "Great! I like this idea.",
            "type": "string"
          },
          "title": {
            "description": "Text to display as the title.",
            "example": "Greg",
            "type": "string"
          },
          "title_link": {
            "description": "Where to title will link to.",
            "example": "https://asana.slack.com/archives/ABCDEFG/12345678",
            "type": "string"
          }
        },
        "readOnly": true,
        "type": "object"
      },
      "ProjectBase": {
        "allOf": [
          {
            "$ref": "#/components/schemas/ProjectCompact"
          },
          {
            "properties": {
              "archived": {
                "description": "True if the project is archived, false if not. Archived projects do not show in the UI by default and may be treated differently for queries.",
                "example": false,
                "type": "boolean"
              },
              "color": {
                "description": "Color of the project.",
                "enum": [
                  "dark-pink",
                  "dark-green",
                  "dark-blue",
                  "dark-red",
                  "dark-teal",
                  "dark-brown",
                  "dark-orange",
                  "dark-purple",
                  "dark-warm-gray",
                  "light-pink",
                  "light-green",
                  "light-blue",
                  "light-red",
                  "light-teal",
                  "light-brown",
                  "light-orange",
                  "light-purple",
                  "light-warm-gray"
                ],
                "example": "light-green",
                "nullable": true,
                "type": "string"
              },
              "created_at": {
                "description": "The time at which this resource was created.",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              },
              "current_status": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/ProjectStatusResponse"
                  }
                ],
                "description": "*Deprecated: new integrations should prefer the `current_status_update` resource.*",
                "nullable": true
              },
              "current_status_update": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/StatusUpdateCompact"
                  }
                ],
                "description": "The latest `status_update` posted to this project.",
                "nullable": true
              },
              "custom_field_settings": {
                "description": "Array of Custom Field Settings (in compact form).",
                "items": {
                  "$ref": "#/components/schemas/CustomFieldSettingResponse"
                },
                "readOnly": true,
                "type": "array"
              },
              "default_view": {
                "description": "The default view (list, board, calendar, or timeline) of a project.",
                "enum": [
                  "list",
                  "board",
                  "calendar",
                  "timeline"
                ],
                "example": "calendar",
                "type": "string"
              },
              "due_date": {
                "description": "*Deprecated: new integrations should prefer the `due_on` field.*",
                "example": "2019-09-15",
                "format": "date-time",
                "nullable": true,
                "type": "string"
              },
              "due_on": {
                "description": "The day on which this project is due. This takes a date with format YYYY-MM-DD.",
                "example": "2019-09-15",
                "format": "date-time",
                "nullable": true,
                "type": "string"
              },
              "html_notes": {
                "description": "[Opt In](/docs/input-output-options). The notes of the project with formatting as HTML.",
                "example": "<body>These are things we need to purchase.</body>",
                "type": "string"
              },
              "is_template": {
                "description": "[Opt In](/docs/input-output-options). *Deprecated - please use a project template endpoint instead (more in [this forum post](https://forum.asana.com/t/a-new-api-for-project-templates/156432)).* Determines if the project is a template.",
                "example": false,
                "type": "boolean"
              },
              "members": {
                "description": "Array of users who are members of this project.",
                "items": {
                  "$ref": "#/components/schemas/UserCompact"
                },
                "readOnly": true,
                "type": "array"
              },
              "modified_at": {
                "description": "The time at which this project was last modified.\n*Note: This does not currently reflect any changes in associations such as tasks or comments that may have been added or removed from the project.*",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              },
              "notes": {
                "description": "Free-form textual information associated with the project (ie., its description).",
                "example": "These are things we need to purchase.",
                "type": "string"
              },
              "public": {
                "description": "True if the project is public to its team.",
                "example": false,
                "type": "boolean"
              },
              "start_on": {
                "description": "The day on which work for this project begins, or null if the project has no start date. This takes a date with `YYYY-MM-DD` format. *Note: `due_on` or `due_at` must be present in the request when setting or unsetting the `start_on` parameter. Additionally, `start_on` and `due_on` cannot be the same date.*",
                "example": "2019-09-14",
                "format": "date",
                "nullable": true,
                "type": "string"
              },
              "workspace": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/WorkspaceCompact"
                  },
                  {
                    "description": "*Create-only*. The workspace or organization this project is associated with. Once created, projects cannot be moved to a different workspace. This attribute can only be specified at creation time.",
                    "readOnly": true,
                    "type": "object"
                  }
                ]
              }
            },
            "type": "object"
          }
        ]
      },
      "ProjectBriefBase": {
        "allOf": [
          {
            "$ref": "#/components/schemas/ProjectBriefCompact"
          },
          {
            "properties": {
              "html_text": {
                "description": "HTML formatted text for the project brief.",
                "example": "<body>This is a <strong>project brief</strong>.</body>",
                "type": "string"
              },
              "title": {
                "description": "The title of the project brief.",
                "example": "Stuff to buy — Project Brief",
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "ProjectBriefCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "A *Project Brief* allows you to explain the what and why of the project to your team.",
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "project_brief"
            }
          }
        ]
      },
      "ProjectBriefRequest": {
        "allOf": [
          {
            "$ref": "#/components/schemas/ProjectBriefBase"
          },
          {
            "properties": {
              "text": {
                "description": "The plain text of the project brief. When writing to a project brief, you can specify either `html_text` (preferred) or `text`, but not both.",
                "example": "This is a project brief.",
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "ProjectBriefResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/ProjectBriefBase"
          },
          {
            "properties": {
              "permalink_url": {
                "description": "A url that points directly to the object within Asana.",
                "example": "https://app.asana.com/0/11111111/22222222",
                "readOnly": true,
                "type": "string"
              },
              "project": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/ProjectCompact"
                  },
                  {
                    "description": "The project with which this project brief is associated.",
                    "type": "object"
                  }
                ]
              },
              "text": {
                "description": "[Opt In](/docs/input-output-options). The plain text of the project brief.",
                "example": "This is a project brief.",
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "ProjectCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "A *project* represents a prioritized list of tasks in Asana or a board with columns of tasks represented as cards. It exists in a single workspace or organization and is accessible to a subset of users in that workspace or organization, depending on its permissions.",
            "properties": {
              "name": {
                "description": "Name of the project. This is generally a short sentence fragment that fits on a line in the UI for maximum readability. However, it can be longer.",
                "example": "Stuff to buy",
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "project"
            }
          }
        ]
      },
      "ProjectDuplicateRequest": {
        "properties": {
          "include": {
            "description": "The elements that will be duplicated to the new project. Tasks are always included.",
            "enum": [
              "members",
              "notes",
              "forms",
              "task_notes",
              "task_assignee",
              "task_subtasks",
              "task_attachments",
              "task_dates",
              "task_dependencies",
              "task_followers",
              "task_tags",
              "task_projects"
            ],
            "example": [
              "members",
              "task_notes"
            ],
            "type": "string"
          },
          "name": {
            "description": "The name of the new project.",
            "example": "New Project Name",
            "type": "string"
          },
          "schedule_dates": {
            "description": "A dictionary of options to auto-shift dates. `task_dates` must be included to use this option. Requires either `start_on` or `due_on`, but not both.",
            "properties": {
              "due_on": {
                "description": "Sets the last due date in the duplicated project to the given date. The rest of the due dates will be offset by the same amount as the due dates in the original project.",
                "example": "2019-05-21",
                "type": "string"
              },
              "should_skip_weekends": {
                "description": "Determines if the auto-shifted dates should skip weekends.",
                "example": true,
                "type": "boolean"
              },
              "start_on": {
                "description": "Sets the first start date in the duplicated project to the given date. The rest of the start dates will be offset by the same amount as the start dates in the original project.",
                "example": "2019-05-21",
                "type": "string"
              }
            },
            "required": [
              "should_skip_weekends"
            ],
            "type": "object"
          },
          "team": {
            "description": "Sets the team of the new project. If team is not defined, the new project will be in the same team as the the original project.",
            "example": "12345",
            "type": "string"
          }
        },
        "required": [
          "name"
        ],
        "type": "object"
      },
      "ProjectMembershipBase": {
        "$ref": "#/components/schemas/ProjectMembershipCompact"
      },
      "ProjectMembershipCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "With the introduction of “comment-only” projects in Asana, a user’s membership in a project comes with associated permissions. These permissions (whether a user has full access to the project or comment-only access) are accessible through the project memberships endpoints described here.",
            "properties": {
              "user": {
                "$ref": "#/components/schemas/UserCompact"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "project_membership"
            }
          }
        ]
      },
      "ProjectMembershipResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/ProjectMembershipBase"
          },
          {
            "properties": {
              "project": {
                "$ref": "#/components/schemas/ProjectCompact",
                "description": "[Opt In](/docs/input-output-options). The project the user is a member of."
              },
              "write_access": {
                "description": "Whether the user has full access to the project or has comment-only access.",
                "enum": [
                  "full_write",
                  "comment_only"
                ],
                "example": "full_write",
                "readOnly": true,
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "ProjectRequest": {
        "allOf": [
          {
            "$ref": "#/components/schemas/ProjectBase"
          },
          {
            "properties": {
              "custom_fields": {
                "additionalProperties": {
                  "description": "\"{custom_field_gid}\" => Value (Can be text, number, etc.)",
                  "type": "string"
                },
                "description": "An object where each key is a Custom Field GID and each value is an enum GID, string, number, or object.",
                "example": {
                  "4578152156": "Not Started",
                  "5678904321": "On Hold"
                },
                "type": "object"
              },
              "followers": {
                "description": "*Create-only*. Comma separated string of users. Followers are a subset of members who have opted in to receive \"tasks added\" notifications for a project.",
                "example": "12345,23456",
                "type": "string"
              },
              "owner": {
                "description": "The current owner of the project, may be null.",
                "example": "12345",
                "nullable": true,
                "type": "string"
              },
              "team": {
                "description": "The team that this project is shared with.",
                "example": "12345",
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "ProjectResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/ProjectBase"
          },
          {
            "properties": {
              "completed": {
                "description": "True if the project is currently marked complete, false if not.",
                "example": false,
                "readOnly": true,
                "type": "boolean"
              },
              "completed_at": {
                "description": "The time at which this project was completed, or null if the project is not completed.",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "nullable": true,
                "readOnly": true,
                "type": "string"
              },
              "completed_by": {
                "$ref": "#/components/schemas/UserCompact",
                "description": "The user that marked this project complete, or null if the project is not completed.",
                "nullable": true,
                "readOnly": true
              },
              "created_from_template": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/ProjectTemplateCompact"
                  },
                  {
                    "description": "[Opt In](/docs/input-output-options). The project template from which this project was created. If the project was not created from a template, this field will be null.",
                    "nullable": true,
                    "type": "object"
                  }
                ]
              },
              "custom_fields": {
                "description": "Array of Custom Fields.",
                "items": {
                  "$ref": "#/components/schemas/CustomFieldCompact"
                },
                "readOnly": true,
                "type": "array"
              },
              "followers": {
                "description": "Array of users following this project. Followers are a subset of members who have opted in to receive \"tasks added\" notifications for a project.",
                "items": {
                  "$ref": "#/components/schemas/UserCompact"
                },
                "readOnly": true,
                "type": "array"
              },
              "icon": {
                "description": "The icon for a project.",
                "enum": [
                  "list",
                  "board",
                  "timeline",
                  "calendar",
                  "rocket",
                  "people",
                  "graph",
                  "star",
                  "bug",
                  "light_bulb",
                  "globe",
                  "gear",
                  "notebook",
                  "computer",
                  "check",
                  "target",
                  "html",
                  "megaphone",
                  "chat_bubbles",
                  "briefcase",
                  "page_layout",
                  "mountain_flag",
                  "puzzle",
                  "presentation",
                  "line_and_symbols",
                  "speed_dial",
                  "ribbon",
                  "shoe",
                  "shopping_basket",
                  "map",
                  "ticket",
                  "coins"
                ],
                "example": "chat_bubbles",
                "nullable": true,
                "type": "string"
              },
              "owner": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/UserCompact"
                  }
                ],
                "description": "The current owner of the project, may be null.",
                "nullable": true
              },
              "permalink_url": {
                "description": "A url that points directly to the object within Asana.",
                "example": "https://app.asana.com/0/resource/123456789/list",
                "readOnly": true,
                "type": "string"
              },
              "project_brief": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/ProjectBriefCompact"
                  },
                  {
                    "description": "[Opt In](/docs/input-output-options). The project brief associated with this project.",
                    "nullable": true,
                    "type": "object"
                  }
                ]
              },
              "team": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/TeamCompact"
                  },
                  {
                    "description": "The team that this project is shared with.",
                    "type": "object"
                  }
                ]
              }
            },
            "type": "object"
          }
        ]
      },
      "ProjectSaveAsTemplateRequest": {
        "properties": {
          "name": {
            "description": "The name of the new project template.",
            "example": "New Project Template",
            "type": "string"
          },
          "public": {
            "description": "Sets the project template to public to its team.",
            "example": true,
            "type": "boolean"
          },
          "team": {
            "description": "Sets the team of the new project template. If the project exists in an organization, specify team and not workspace.",
            "example": "12345",
            "type": "string"
          },
          "workspace": {
            "description": "Sets the workspace of the new project template. Only specify workspace if the project exists in a workspace.",
            "example": "12345",
            "type": "string"
          }
        },
        "required": [
          "name",
          "public"
        ],
        "type": "object"
      },
      "ProjectSectionInsertRequest": {
        "properties": {
          "after_section": {
            "description": "Insert the given section immediately after the section specified by this parameter.",
            "example": "987654",
            "type": "string"
          },
          "before_section": {
            "description": "Insert the given section immediately before the section specified by this parameter.",
            "example": "86420",
            "type": "string"
          },
          "project": {
            "description": "The project in which to reorder the given section.",
            "example": "123456",
            "type": "string"
          },
          "section": {
            "description": "The section to reorder.",
            "example": "321654",
            "type": "string"
          }
        },
        "required": [
          "project",
          "section"
        ],
        "type": "object"
      },
      "ProjectStatusBase": {
        "allOf": [
          {
            "$ref": "#/components/schemas/ProjectStatusCompact"
          },
          {
            "properties": {
              "color": {
                "description": "The color associated with the status update.",
                "enum": [
                  "green",
                  "yellow",
                  "red",
                  "blue"
                ],
                "type": "string"
              },
              "html_text": {
                "description": "[Opt In](/docs/input-output-options). The text content of the status update with formatting as HTML.",
                "example": "<body>The project <strong>is</strong> moving forward according to plan...</body>",
                "type": "string"
              },
              "text": {
                "description": "The text content of the status update.",
                "example": "The project is moving forward according to plan...",
                "type": "string"
              }
            },
            "required": [
              "text",
              "color"
            ],
            "type": "object"
          }
        ]
      },
      "ProjectStatusCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "*Deprecated: new integrations should prefer the `status_update` resource.*\nA *project status* is an update on the progress of a particular project, and is sent out to all project followers when created. These updates include both text describing the update and a color code intended to represent the overall state of the project: \"green\" for projects that are on track, \"yellow\" for projects at risk, and \"red\" for projects that are behind.",
            "properties": {
              "title": {
                "description": "The title of the project status update.",
                "example": "Status Update - Jun 15",
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "project_status"
            }
          }
        ]
      },
      "ProjectStatusRequest": {
        "$ref": "#/components/schemas/ProjectStatusBase"
      },
      "ProjectStatusResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/ProjectStatusBase"
          },
          {
            "properties": {
              "author": {
                "$ref": "#/components/schemas/UserCompact"
              },
              "created_at": {
                "description": "The time at which this resource was created.",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              },
              "created_by": {
                "$ref": "#/components/schemas/UserCompact"
              },
              "modified_at": {
                "description": "The time at which this project status was last modified.\n*Note: This does not currently reflect any changes in associations such as comments that may have been added or removed from the project status.*",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "ProjectTemplateBase": {
        "allOf": [
          {
            "$ref": "#/components/schemas/ProjectTemplateCompact"
          },
          {
            "properties": {
              "color": {
                "description": "Color of the project template.",
                "enum": [
                  "dark-pink",
                  "dark-green",
                  "dark-blue",
                  "dark-red",
                  "dark-teal",
                  "dark-brown",
                  "dark-orange",
                  "dark-purple",
                  "dark-warm-gray",
                  "light-pink",
                  "light-green",
                  "light-blue",
                  "light-red",
                  "light-teal",
                  "light-brown",
                  "light-orange",
                  "light-purple",
                  "light-warm-gray"
                ],
                "example": "light-green",
                "nullable": true,
                "type": "string"
              },
              "description": {
                "description": "Free-form textual information associated with the project template",
                "example": "These are things we need to pack for a trip.",
                "type": "string"
              },
              "html_description": {
                "description": "The description of the project template with formatting as HTML.",
                "example": "<body>These are things we need to pack for a trip.</body>",
                "type": "string"
              },
              "owner": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/UserCompact"
                  }
                ],
                "description": "The current owner of the project template, may be null.",
                "nullable": true
              },
              "public": {
                "description": "True if the project template is public to its team.",
                "example": false,
                "type": "boolean"
              },
              "requested_dates": {
                "description": "Array of date variables in this project template. Calendar dates must be provided for these variables when instantiating a project.",
                "items": {
                  "$ref": "#/components/schemas/DateVariableCompact"
                },
                "readOnly": true,
                "type": "array"
              },
              "team": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/TeamCompact"
                  }
                ]
              }
            },
            "type": "object"
          }
        ]
      },
      "ProjectTemplateCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "A *project template* is an object that allows new projects to be created with a predefined setup, which may include tasks, sections, Rules, etc. It simplifies the process of running a workflow that involves a similar set of work every time.",
            "properties": {
              "name": {
                "description": "Name of the project template.",
                "example": "Packing list",
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "project_template"
            }
          }
        ]
      },
      "ProjectTemplateInstantiateProjectRequest": {
        "properties": {
          "is_strict": {
            "description": "*Optional*. If set to `true`, the endpoint returns an \"Unprocessable Entity\" error if you fail to provide a calendar date value for any date variable. If set to `false`, a default date is used for each unfulfilled date variable (e.g., the current date is used as the Start Date of a project).",
            "example": true,
            "type": "boolean"
          },
          "name": {
            "description": "The name of the new project.",
            "example": "New Project Name",
            "type": "string"
          },
          "public": {
            "description": "Sets the project to public to its team.",
            "example": true,
            "type": "boolean"
          },
          "requested_dates": {
            "description": "Array of mappings of date variables to calendar dates.",
            "items": {
              "$ref": "#/components/schemas/DateVariableRequest"
            },
            "type": "array"
          },
          "team": {
            "description": "*Conditional*. Sets the team of the new project. If the project template exists in an _organization_, you must specify a value for `team` and not `workspace`.",
            "example": "12345",
            "type": "string"
          },
          "workspace": {
            "description": "*Conditional*. Sets the workspace of the new project. If the project template exists in a _workspace_, you must specify a value for `workspace` and not `team`.",
            "example": "12345",
            "type": "string"
          }
        },
        "required": [
          "name",
          "public"
        ],
        "type": "object"
      },
      "ProjectTemplateResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/ProjectTemplateBase"
          }
        ]
      },
      "RemoveCustomFieldSettingRequest": {
        "properties": {
          "custom_field": {
            "description": "The custom field to remove from this portfolio.",
            "example": "14916",
            "type": "string"
          }
        },
        "required": [
          "custom_field"
        ],
        "type": "object"
      },
      "RemoveFollowersRequest": {
        "properties": {
          "followers": {
            "description": "An array of strings identifying users. These can either be the string \"me\", an email, or the gid of a user.",
            "example": "521621,621373",
            "type": "string"
          }
        },
        "required": [
          "followers"
        ],
        "type": "object"
      },
      "RemoveMembersRequest": {
        "properties": {
          "members": {
            "description": "An array of strings identifying users. These can either be the string \"me\", an email, or the gid of a user.",
            "example": "521621,621373",
            "type": "string"
          }
        },
        "required": [
          "members"
        ],
        "type": "object"
      },
      "SectionBase": {
        "$ref": "#/components/schemas/SectionCompact"
      },
      "SectionCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "A *section* is a subdivision of a project that groups tasks together. It can either be a header above a list of tasks in a list view or a column in a board view of a project.",
            "properties": {
              "name": {
                "description": "The name of the section (i.e. the text displayed as the section header).",
                "example": "Next Actions",
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "section"
            }
          }
        ]
      },
      "SectionRequest": {
        "properties": {
          "insert_after": {
            "description": "An existing section within this project after which the added section should be inserted. Cannot be provided together with insert_before.",
            "example": "987654",
            "type": "string"
          },
          "insert_before": {
            "description": "An existing section within this project before which the added section should be inserted. Cannot be provided together with insert_after.",
            "example": "86420",
            "type": "string"
          },
          "name": {
            "description": "The text to be displayed as the section name. This cannot be an empty string.",
            "example": "Next Actions",
            "type": "string"
          }
        },
        "required": [
          "project",
          "name"
        ],
        "type": "object"
      },
      "SectionResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/SectionBase"
          },
          {
            "properties": {
              "created_at": {
                "description": "The time at which this resource was created.",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              },
              "project": {
                "$ref": "#/components/schemas/ProjectCompact"
              },
              "projects": {
                "description": "*Deprecated - please use project instead*",
                "items": {
                  "$ref": "#/components/schemas/ProjectCompact"
                },
                "readOnly": true,
                "type": "array"
              }
            },
            "type": "object"
          }
        ]
      },
      "SectionTaskInsertRequest": {
        "properties": {
          "insert_after": {
            "description": "An existing task within this section after which the added task should be inserted. Cannot be provided together with insert_before.",
            "example": "987654",
            "type": "string"
          },
          "insert_before": {
            "description": "An existing task within this section before which the added task should be inserted. Cannot be provided together with insert_after.",
            "example": "86420",
            "type": "string"
          },
          "task": {
            "description": "The task to add to this section.",
            "example": "123456",
            "type": "string"
          }
        },
        "required": [
          "task"
        ],
        "type": "object"
      },
      "StatusUpdateBase": {
        "allOf": [
          {
            "$ref": "#/components/schemas/StatusUpdateCompact"
          },
          {
            "properties": {
              "html_text": {
                "description": "[Opt In](/docs/input-output-options). The text content of the status update with formatting as HTML.",
                "example": "<body>The project <strong>is</strong> moving forward according to plan...</body>",
                "type": "string"
              },
              "status_type": {
                "description": "The type associated with the status update. This represents the current state of the object this object is on.",
                "enum": [
                  "on_track",
                  "at_risk",
                  "off_track",
                  "on_hold",
                  "complete",
                  "achieved",
                  "partial",
                  "missed",
                  "dropped"
                ],
                "type": "string"
              },
              "text": {
                "description": "The text content of the status update.",
                "example": "The project is moving forward according to plan...",
                "type": "string"
              }
            },
            "required": [
              "text",
              "status_type"
            ],
            "type": "object"
          }
        ]
      },
      "StatusUpdateCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "A *status update* is an update on the progress of a particular project, portfolio, or goal, and is sent out to all of its parent's followers when created. These updates include both text describing the update and a `status_type` intended to represent the overall state of the project.",
            "properties": {
              "resource_subtype": {
                "description": "The subtype of this resource. Different subtypes retain many of the same fields and behavior, but may render differently in Asana or represent resources with different semantic meaning.\nThe `resource_subtype`s for `status` objects represent the type of their parent.",
                "enum": [
                  "project_status_update",
                  "portfolio_status_update",
                  "goal_status_update"
                ],
                "example": "project_status_update",
                "readOnly": true,
                "type": "string"
              },
              "title": {
                "description": "The title of the status update.",
                "example": "Status Update - Jun 15",
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "status_update"
            }
          }
        ]
      },
      "StatusUpdateRequest": {
        "allOf": [
          {
            "$ref": "#/components/schemas/StatusUpdateBase"
          },
          {
            "properties": {
              "parent": {
                "allOf": [
                  {
                    "description": "The id of parent to send this status update to. This can be a project, goal or portfolio.",
                    "type": "string"
                  }
                ]
              }
            },
            "required": [
              "parent"
            ],
            "type": "object"
          }
        ]
      },
      "StatusUpdateResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/StatusUpdateBase"
          },
          {
            "properties": {
              "author": {
                "$ref": "#/components/schemas/UserCompact"
              },
              "created_at": {
                "description": "The time at which this resource was created.",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              },
              "created_by": {
                "$ref": "#/components/schemas/UserCompact"
              },
              "hearted": {
                "description": "*Deprecated - please use liked instead* True if the status is hearted by the authorized user, false if not.",
                "example": true,
                "readOnly": true,
                "type": "boolean"
              },
              "hearts": {
                "description": "*Deprecated - please use likes instead* Array of likes for users who have hearted this status.",
                "items": {
                  "$ref": "#/components/schemas/Like"
                },
                "readOnly": true,
                "type": "array"
              },
              "liked": {
                "description": "True if the status is liked by the authorized user, false if not.",
                "example": true,
                "type": "boolean"
              },
              "likes": {
                "description": "Array of likes for users who have liked this status.",
                "items": {
                  "$ref": "#/components/schemas/Like"
                },
                "readOnly": true,
                "type": "array"
              },
              "modified_at": {
                "description": "The time at which this project status was last modified.\n*Note: This does not currently reflect any changes in associations such as comments that may have been added or removed from the status.*",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              },
              "num_hearts": {
                "description": "*Deprecated - please use likes instead* The number of users who have hearted this status.",
                "example": 5,
                "readOnly": true,
                "type": "integer"
              },
              "num_likes": {
                "description": "The number of users who have liked this status.",
                "example": 5,
                "readOnly": true,
                "type": "integer"
              },
              "parent": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/ProjectCompact"
                  },
                  {
                    "description": "The parent of the status update. This can be a project, goal or portfolio, and indicates that this status was sent on that object.",
                    "type": "object"
                  }
                ]
              }
            },
            "type": "object"
          }
        ]
      },
      "StoryBase": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "A story represents an activity associated with an object in the Asana system.",
            "properties": {
              "created_at": {
                "description": "The time at which this resource was created.",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              },
              "html_text": {
                "description": "[Opt In](/docs/input-output-options). HTML formatted text for a comment. This will not include the name of the creator.",
                "example": "<body>This is a comment.</body>",
                "type": "string"
              },
              "is_pinned": {
                "description": "*Conditional*. Whether the story should be pinned on the resource.",
                "example": false,
                "type": "boolean"
              },
              "resource_subtype": {
                "description": "The subtype of this resource. Different subtypes retain many of the same fields and behavior, but may render differently in Asana or represent resources with different semantic meaning.",
                "example": "comment_added",
                "readOnly": true,
                "type": "string"
              },
              "sticker_name": {
                "description": "The name of the sticker in this story. `null` if there is no sticker.",
                "enum": [
                  "green_checkmark",
                  "people_dancing",
                  "dancing_unicorn",
                  "heart",
                  "party_popper",
                  "people_waving_flags",
                  "splashing_narwhal",
                  "trophy",
                  "yeti_riding_unicorn",
                  "celebrating_people",
                  "determined_climbers",
                  "phoenix_spreading_love"
                ],
                "example": "dancing_unicorn",
                "type": "string"
              },
              "text": {
                "description": "The plain text of the comment to add. Cannot be used with html_text.",
                "example": "This is a comment.",
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "story"
            }
          }
        ]
      },
      "StoryCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "A story represents an activity associated with an object in the Asana system.",
            "properties": {
              "created_at": {
                "description": "The time at which this resource was created.",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              },
              "created_by": {
                "$ref": "#/components/schemas/UserCompact"
              },
              "resource_subtype": {
                "description": "The subtype of this resource. Different subtypes retain many of the same fields and behavior, but may render differently in Asana or represent resources with different semantic meaning.",
                "example": "comment_added",
                "readOnly": true,
                "type": "string"
              },
              "text": {
                "description": "*Create-only*. Human-readable text for the story or comment.\nThis will not include the name of the creator.\n*Note: This is not guaranteed to be stable for a given type of story. For example, text for a reassignment may not always say “assigned to …” as the text for a story can both be edited and change based on the language settings of the user making the request.*\nUse the `resource_subtype` property to discover the action that created the story.",
                "example": "marked today",
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "story"
            }
          }
        ]
      },
      "StoryRequest": {
        "$ref": "#/components/schemas/StoryBase"
      },
      "StoryResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/StoryBase"
          },
          {
            "properties": {
              "assignee": {
                "$ref": "#/components/schemas/UserCompact",
                "description": "*Conditional*",
                "readOnly": true
              },
              "created_by": {
                "$ref": "#/components/schemas/UserCompact"
              },
              "custom_field": {
                "$ref": "#/components/schemas/CustomFieldCompact",
                "description": "*Conditional*",
                "readOnly": true
              },
              "dependency": {
                "$ref": "#/components/schemas/TaskCompact",
                "description": "*Conditional*",
                "readOnly": true
              },
              "duplicate_of": {
                "$ref": "#/components/schemas/TaskCompact",
                "description": "*Conditional*",
                "readOnly": true
              },
              "duplicated_from": {
                "$ref": "#/components/schemas/TaskCompact",
                "description": "*Conditional*",
                "readOnly": true
              },
              "follower": {
                "$ref": "#/components/schemas/UserCompact",
                "description": "*Conditional*",
                "readOnly": true
              },
              "hearted": {
                "description": "*Deprecated - please use likes instead*\n*Conditional*. True if the story is hearted by the authorized user, false if not.",
                "example": false,
                "readOnly": true,
                "type": "boolean"
              },
              "hearts": {
                "description": "*Deprecated - please use likes instead*\n\n*Conditional*. Array of likes for users who have hearted this story.",
                "items": {
                  "$ref": "#/components/schemas/Like"
                },
                "readOnly": true,
                "type": "array"
              },
              "is_editable": {
                "description": "*Conditional*. Whether the text of the story can be edited after creation.",
                "example": false,
                "readOnly": true,
                "type": "boolean"
              },
              "is_edited": {
                "description": "*Conditional*. Whether the text of the story has been edited after creation.",
                "example": false,
                "readOnly": true,
                "type": "boolean"
              },
              "liked": {
                "description": "*Conditional*. True if the story is liked by the authorized user, false if not.",
                "example": false,
                "readOnly": true,
                "type": "boolean"
              },
              "likes": {
                "description": "*Conditional*. Array of likes for users who have liked this story.",
                "items": {
                  "$ref": "#/components/schemas/Like"
                },
                "readOnly": true,
                "type": "array"
              },
              "new_approval_status": {
                "description": "*Conditional*. The new value of approval status.",
                "example": "approved",
                "readOnly": true,
                "type": "string"
              },
              "new_date_value": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/StoryResponseDates"
                  },
                  {
                    "description": "*Conditional* The new value of a date custom field story."
                  }
                ],
                "readOnly": true
              },
              "new_dates": {
                "$ref": "#/components/schemas/StoryResponseDates"
              },
              "new_enum_value": {
                "$ref": "#/components/schemas/EnumOption",
                "description": "*Conditional*",
                "readOnly": true
              },
              "new_multi_enum_values": {
                "description": "*Conditional*. The new value of a multi-enum custom field story.",
                "items": {
                  "$ref": "#/components/schemas/EnumOption"
                },
                "readOnly": true,
                "type": "array"
              },
              "new_name": {
                "description": "*Conditional*",
                "example": "This is the New Name",
                "readOnly": true,
                "type": "string"
              },
              "new_number_value": {
                "description": "*Conditional*",
                "example": 2,
                "readOnly": true,
                "type": "integer"
              },
              "new_people_value": {
                "description": "*Conditional*. The new value of a people custom field story.",
                "items": {
                  "$ref": "#/components/schemas/UserCompact"
                },
                "readOnly": true,
                "type": "array"
              },
              "new_resource_subtype": {
                "description": "*Conditional*",
                "example": "milestone",
                "readOnly": true,
                "type": "string"
              },
              "new_section": {
                "$ref": "#/components/schemas/SectionCompact",
                "description": "*Conditional*",
                "readOnly": true
              },
              "new_text_value": {
                "description": "*Conditional*",
                "example": "This is the New Text",
                "readOnly": true,
                "type": "string"
              },
              "num_hearts": {
                "description": "*Deprecated - please use likes instead*\n\n*Conditional*. The number of users who have hearted this story.",
                "example": 5,
                "readOnly": true,
                "type": "integer"
              },
              "num_likes": {
                "description": "*Conditional*. The number of users who have liked this story.",
                "example": 5,
                "readOnly": true,
                "type": "integer"
              },
              "old_approval_status": {
                "description": "*Conditional*. The old value of approval status.",
                "example": "pending",
                "readOnly": true,
                "type": "string"
              },
              "old_date_value": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/StoryResponseDates"
                  },
                  {
                    "description": "*Conditional*. The old value of a date custom field story."
                  }
                ],
                "readOnly": true
              },
              "old_dates": {
                "$ref": "#/components/schemas/StoryResponseDates"
              },
              "old_enum_value": {
                "$ref": "#/components/schemas/EnumOption",
                "description": "*Conditional*",
                "readOnly": true
              },
              "old_multi_enum_values": {
                "description": "*Conditional*. The old value of a multi-enum custom field story.",
                "items": {
                  "$ref": "#/components/schemas/EnumOption"
                },
                "readOnly": true,
                "type": "array"
              },
              "old_name": {
                "description": "*Conditional*'",
                "example": "This was the Old Name",
                "type": "string"
              },
              "old_number_value": {
                "description": "*Conditional*",
                "example": 1,
                "readOnly": true,
                "type": "integer"
              },
              "old_people_value": {
                "description": "*Conditional*. The old value of a people custom field story.",
                "items": {
                  "$ref": "#/components/schemas/UserCompact"
                },
                "readOnly": true,
                "type": "array"
              },
              "old_resource_subtype": {
                "description": "*Conditional*",
                "example": "default_task",
                "readOnly": true,
                "type": "string"
              },
              "old_section": {
                "$ref": "#/components/schemas/SectionCompact",
                "description": "*Conditional*",
                "readOnly": true
              },
              "old_text_value": {
                "description": "*Conditional*",
                "example": "This was the Old Text",
                "readOnly": true,
                "type": "string"
              },
              "previews": {
                "description": "*Conditional*. A collection of previews to be displayed in the story.\n\n*Note: This property only exists for comment stories.*",
                "items": {
                  "$ref": "#/components/schemas/Preview"
                },
                "readOnly": true,
                "type": "array"
              },
              "project": {
                "$ref": "#/components/schemas/ProjectCompact",
                "description": "*Conditional*",
                "readOnly": true
              },
              "source": {
                "description": "The component of the Asana product the user used to trigger the story.",
                "enum": [
                  "web",
                  "email",
                  "mobile",
                  "api",
                  "unknown"
                ],
                "example": "web",
                "readOnly": true,
                "type": "string"
              },
              "story": {
                "$ref": "#/components/schemas/StoryCompact",
                "description": "*Conditional*",
                "readOnly": true
              },
              "tag": {
                "$ref": "#/components/schemas/TagCompact",
                "description": "*Conditional*",
                "readOnly": true
              },
              "target": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/TaskCompact"
                  },
                  {
                    "description": "The object this story is associated with. Currently may only be a task.",
                    "readOnly": true,
                    "type": "object"
                  }
                ]
              },
              "task": {
                "$ref": "#/components/schemas/TaskCompact",
                "description": "*Conditional*",
                "readOnly": true
              },
              "type": {
                "enum": [
                  "comment",
                  "system"
                ],
                "example": "comment",
                "readOnly": true,
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "StoryResponseDates": {
        "description": "*Conditional*",
        "properties": {
          "due_at": {
            "description": "The UTC date and time on which this task is due, or null if the task has no due time. This takes an ISO 8601 date string in UTC and should not be used together with `due_on`.",
            "example": "2019-09-15T02:06:58.158Z",
            "format": "date-time",
            "nullable": true,
            "type": "string"
          },
          "due_on": {
            "description": "The localized day on which this goal is due. This takes a date with format `YYYY-MM-DD`.",
            "example": "2019-09-15",
            "format": "date",
            "type": "string"
          },
          "start_on": {
            "description": "The day on which work for this goal begins, or null if the goal has no start date. This takes a date with `YYYY-MM-DD` format, and cannot be set unless there is an accompanying due date.",
            "example": "2019-09-14",
            "format": "date",
            "nullable": true,
            "type": "string"
          }
        },
        "readOnly": true,
        "type": "object"
      },
      "TagBase": {
        "allOf": [
          {
            "$ref": "#/components/schemas/TagCompact"
          },
          {
            "properties": {
              "color": {
                "description": "Color of the tag.",
                "enum": [
                  "dark-pink",
                  "dark-green",
                  "dark-blue",
                  "dark-red",
                  "dark-teal",
                  "dark-brown",
                  "dark-orange",
                  "dark-purple",
                  "dark-warm-gray",
                  "light-pink",
                  "light-green",
                  "light-blue",
                  "light-red",
                  "light-teal",
                  "light-brown",
                  "light-orange",
                  "light-purple",
                  "light-warm-gray"
                ],
                "example": "light-green",
                "nullable": true,
                "type": "string"
              },
              "notes": {
                "description": "Free-form textual information associated with the tag (i.e. its description).",
                "example": "Mittens really likes the stuff from Humboldt.",
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "TagCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "A *tag* is a label that can be attached to any task in Asana. It exists in a single workspace or organization.",
            "properties": {
              "name": {
                "description": "Name of the tag. This is generally a short sentence fragment that fits on a line in the UI for maximum readability. However, it can be longer.",
                "example": "Stuff to buy",
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "tag"
            }
          }
        ]
      },
      "TagRequest": {
        "allOf": [
          {
            "$ref": "#/components/schemas/TagBase"
          },
          {
            "properties": {
              "followers": {
                "description": "An array of strings identifying users. These can either be the string \"me\", an email, or the gid of a user.",
                "example": [
                  "12345",
                  "42563"
                ],
                "items": {
                  "type": "string"
                },
                "type": "array"
              },
              "workspace": {
                "description": "Gid of an object.",
                "example": "12345",
                "type": "string",
                "x-env-variable": true
              }
            },
            "type": "object"
          }
        ]
      },
      "TagResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/TagBase"
          },
          {
            "properties": {
              "created_at": {
                "description": "The time at which this resource was created.",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              },
              "followers": {
                "description": "Array of users following this tag.",
                "items": {
                  "$ref": "#/components/schemas/UserCompact"
                },
                "readOnly": true,
                "type": "array"
              },
              "permalink_url": {
                "description": "A url that points directly to the object within Asana.",
                "example": "https://app.asana.com/0/resource/123456789/list",
                "readOnly": true,
                "type": "string"
              },
              "workspace": {
                "$ref": "#/components/schemas/WorkspaceCompact"
              }
            },
            "type": "object"
          }
        ]
      },
      "TaskAddFollowersRequest": {
        "properties": {
          "followers": {
            "description": "An array of strings identifying users. These can either be the string \"me\", an email, or the gid of a user.",
            "example": [
              "13579",
              "321654"
            ],
            "items": {
              "type": "string"
            },
            "type": "array"
          }
        },
        "required": [
          "followers"
        ],
        "type": "object"
      },
      "TaskAddProjectRequest": {
        "properties": {
          "insert_after": {
            "description": "A task in the project to insert the task after, or `null` to insert at the beginning of the list.",
            "example": "124816",
            "nullable": true,
            "type": "string"
          },
          "insert_before": {
            "description": "A task in the project to insert the task before, or `null` to insert at the end of the list.",
            "example": "432134",
            "nullable": true,
            "type": "string"
          },
          "project": {
            "description": "The project to add the task to.",
            "example": "13579",
            "type": "string"
          },
          "section": {
            "description": "A section in the project to insert the task into. The task will be inserted at the bottom of the section.",
            "example": "987654",
            "nullable": true,
            "type": "string"
          }
        },
        "required": [
          "project"
        ],
        "type": "object"
      },
      "TaskAddTagRequest": {
        "properties": {
          "tag": {
            "description": "The tag to add to the task.",
            "example": "13579",
            "type": "string"
          }
        },
        "required": [
          "tag"
        ],
        "type": "object"
      },
      "TaskBase": {
        "allOf": [
          {
            "$ref": "#/components/schemas/TaskCompact"
          },
          {
            "properties": {
              "actual_time_minutes": {
                "description": "This value represents the sum of all the Time Tracking entries in the Actual Time field on a given Task. It is represented as a nullable long value.",
                "example": 200,
                "nullable": true,
                "readOnly": true,
                "type": "number"
              },
              "approval_status": {
                "description": "*Conditional* Reflects the approval status of this task. This field is kept in sync with `completed`, meaning `pending` translates to false while `approved`, `rejected`, and `changes_requested` translate to true. If you set completed to true, this field will be set to `approved`.",
                "enum": [
                  "pending",
                  "approved",
                  "rejected",
                  "changes_requested"
                ],
                "example": "pending",
                "type": "string"
              },
              "assignee_status": {
                "description": "*Deprecated* Scheduling status of this task for the user it is assigned to. This field can only be set if the assignee is non-null. Setting this field to \"inbox\" or \"upcoming\" inserts it at the top of the section, while the other options will insert at the bottom.",
                "enum": [
                  "today",
                  "upcoming",
                  "later",
                  "new",
                  "inbox"
                ],
                "example": "upcoming",
                "type": "string"
              },
              "completed": {
                "description": "True if the task is currently marked complete, false if not.",
                "example": false,
                "type": "boolean"
              },
              "completed_at": {
                "description": "The time at which this task was completed, or null if the task is incomplete.",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "nullable": true,
                "readOnly": true,
                "type": "string"
              },
              "completed_by": {
                "$ref": "#/components/schemas/UserCompact",
                "readOnly": true
              },
              "created_at": {
                "description": "The time at which this resource was created.",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              },
              "dependencies": {
                "description": "[Opt In](/docs/input-output-options). Array of resources referencing tasks that this task depends on. The objects contain only the gid of the dependency.",
                "items": {
                  "$ref": "#/components/schemas/AsanaResource"
                },
                "readOnly": true,
                "type": "array"
              },
              "dependents": {
                "description": "[Opt In](/docs/input-output-options). Array of resources referencing tasks that depend on this task. The objects contain only the ID of the dependent.",
                "items": {
                  "$ref": "#/components/schemas/AsanaResource"
                },
                "readOnly": true,
                "type": "array"
              },
              "due_at": {
                "description": "The UTC date and time on which this task is due, or null if the task has no due time. This takes an ISO 8601 date string in UTC and should not be used together with `due_on`.",
                "example": "2019-09-15T02:06:58.147Z",
                "format": "date",
                "nullable": true,
                "type": "string"
              },
              "due_on": {
                "description": "The localized date on which this task is due, or null if the task has no due date. This takes a date with `YYYY-MM-DD` format and should not be used together with `due_at`.",
                "example": "2019-09-15",
                "format": "date",
                "nullable": true,
                "type": "string"
              },
              "external": {
                "description": "*OAuth Required*. *Conditional*. This field is returned only if external values are set or included by using [Opt In] (/docs/input-output-options).\nThe external field allows you to store app-specific metadata on tasks, including a gid that can be used to retrieve tasks and a data blob that can store app-specific character strings. Note that you will need to authenticate with Oauth to access or modify this data. Once an external gid is set, you can use the notation `external:custom_gid` to reference your object anywhere in the API where you may use the original object gid. See the page on Custom External Data for more details.",
                "example": {
                  "data": "A blob of information",
                  "gid": "my_gid"
                },
                "properties": {
                  "data": {
                    "example": "A blob of information.",
                    "type": "string"
                  },
                  "gid": {
                    "example": "1234",
                    "type": "string"
                  }
                },
                "type": "object"
              },
              "hearted": {
                "description": "*Deprecated - please use liked instead* True if the task is hearted by the authorized user, false if not.",
                "example": true,
                "readOnly": true,
                "type": "boolean"
              },
              "hearts": {
                "description": "*Deprecated - please use likes instead* Array of likes for users who have hearted this task.",
                "items": {
                  "$ref": "#/components/schemas/Like"
                },
                "readOnly": true,
                "type": "array"
              },
              "html_notes": {
                "description": "[Opt In](/docs/input-output-options). The notes of the text with formatting as HTML.",
                "example": "<body>Mittens <em>really</em> likes the stuff from Humboldt.</body>",
                "type": "string"
              },
              "is_rendered_as_separator": {
                "description": "[Opt In](/docs/input-output-options). In some contexts tasks can be rendered as a visual separator; for instance, subtasks can appear similar to [sections](/docs/asana-sections) without being true `section` objects. If a `task` object is rendered this way in any context it will have the property `is_rendered_as_separator` set to `true`.",
                "example": false,
                "readOnly": true,
                "type": "boolean"
              },
              "liked": {
                "description": "True if the task is liked by the authorized user, false if not.",
                "example": true,
                "type": "boolean"
              },
              "likes": {
                "description": "Array of likes for users who have liked this task.",
                "items": {
                  "$ref": "#/components/schemas/Like"
                },
                "readOnly": true,
                "type": "array"
              },
              "memberships": {
                "description": "*Create-only*. Array of projects this task is associated with and the section it is in. At task creation time, this array can be used to add the task to specific sections. After task creation, these associations can be modified using the `addProject` and `removeProject` endpoints. Note that over time, more types of memberships may be added to this property.",
                "items": {
                  "properties": {
                    "project": {
                      "$ref": "#/components/schemas/ProjectCompact"
                    },
                    "section": {
                      "$ref": "#/components/schemas/SectionCompact"
                    }
                  },
                  "type": "object"
                },
                "readOnly": true,
                "type": "array"
              },
              "modified_at": {
                "description": "The time at which this task was last modified.\n\n*Note: This does not currently reflect any changes in\nassociations such as projects or comments that may have been\nadded or removed from the task.*",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              },
              "name": {
                "description": "Name of the task. This is generally a short sentence fragment that fits on a line in the UI for maximum readability. However, it can be longer.",
                "example": "Buy catnip",
                "type": "string"
              },
              "notes": {
                "description": "Free-form textual information associated with the task (i.e. its description).",
                "example": "Mittens really likes the stuff from Humboldt.",
                "type": "string"
              },
              "num_hearts": {
                "description": "*Deprecated - please use likes instead* The number of users who have hearted this task.",
                "example": 5,
                "readOnly": true,
                "type": "integer"
              },
              "num_likes": {
                "description": "The number of users who have liked this task.",
                "example": 5,
                "readOnly": true,
                "type": "integer"
              },
              "num_subtasks": {
                "description": "[Opt In](/docs/input-output-options). The number of subtasks on this task.\n",
                "example": 3,
                "readOnly": true,
                "type": "integer"
              },
              "start_at": {
                "description": "Date and time on which work begins for the task, or null if the task has no start time. This takes an ISO 8601 date string in UTC and should not be used together with `start_on`.\n*Note: `due_at` must be present in the request when setting or unsetting the `start_at` parameter.*",
                "example": "2019-09-14T02:06:58.147Z",
                "format": "date",
                "nullable": true,
                "type": "string"
              },
              "start_on": {
                "description": "The day on which work begins for the task , or null if the task has no start date. This takes a date with `YYYY-MM-DD` format and should not be used together with `start_at`.\n*Note: `due_on` or `due_at` must be present in the request when setting or unsetting the `start_on` parameter.*",
                "example": "2019-09-14",
                "format": "date",
                "nullable": true,
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "TaskCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "The *task* is the basic object around which many operations in Asana are centered.",
            "properties": {
              "name": {
                "description": "The name of the task.",
                "example": "Bug Task",
                "type": "string"
              },
              "resource_subtype": {
                "description": "The subtype of this resource. Different subtypes retain many of the same fields and behavior, but may render differently in Asana or represent resources with different semantic meaning.\nThe resource_subtype `milestone` represent a single moment in time. This means tasks with this subtype cannot have a start_date.",
                "enum": [
                  "default_task",
                  "milestone",
                  "section",
                  "approval"
                ],
                "example": "default_task",
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "task"
            }
          }
        ]
      },
      "TaskCountResponse": {
        "description": "A response object returned from the task count endpoint.",
        "properties": {
          "num_completed_milestones": {
            "description": "The number of completed milestones in a project.",
            "example": 3,
            "type": "integer"
          },
          "num_completed_tasks": {
            "description": "The number of completed tasks in a project.",
            "example": 150,
            "type": "integer"
          },
          "num_incomplete_milestones": {
            "description": "The number of incomplete milestones in a project.",
            "example": 7,
            "type": "integer"
          },
          "num_incomplete_tasks": {
            "description": "The number of incomplete tasks in a project.",
            "example": 50,
            "type": "integer"
          },
          "num_milestones": {
            "description": "The number of milestones in a project.",
            "example": 10,
            "type": "integer"
          },
          "num_tasks": {
            "description": "The number of tasks in a project.",
            "example": 200,
            "type": "integer"
          }
        },
        "type": "object"
      },
      "TaskDuplicateRequest": {
        "properties": {
          "include": {
            "description": "The fields that will be duplicated to the new task.",
            "enum": [
              "notes",
              "assignee",
              "subtasks",
              "attachments",
              "tags",
              "followers",
              "projects",
              "dates",
              "dependencies",
              "parent"
            ],
            "example": [
              "notes",
              "assignee"
            ],
            "type": "string"
          },
          "name": {
            "description": "The name of the new task.",
            "example": "New Task Name",
            "type": "string"
          }
        },
        "type": "object"
      },
      "TaskRemoveFollowersRequest": {
        "properties": {
          "followers": {
            "description": "An array of strings identifying users. These can either be the string \"me\", an email, or the gid of a user.",
            "example": [
              "13579",
              "321654"
            ],
            "items": {
              "type": "string"
            },
            "type": "array"
          }
        },
        "required": [
          "followers"
        ],
        "type": "object"
      },
      "TaskRemoveProjectRequest": {
        "properties": {
          "project": {
            "description": "The project to remove the task from.",
            "example": "13579",
            "type": "string"
          }
        },
        "required": [
          "project"
        ],
        "type": "object"
      },
      "TaskRemoveTagRequest": {
        "properties": {
          "tag": {
            "description": "The tag to remove from the task.",
            "example": "13579",
            "type": "string"
          }
        },
        "required": [
          "tag"
        ],
        "type": "object"
      },
      "TaskRequest": {
        "allOf": [
          {
            "$ref": "#/components/schemas/TaskBase"
          },
          {
            "properties": {
              "assignee": {
                "description": "Gid of a user.",
                "example": "12345",
                "nullable": true,
                "readOnly": false,
                "type": "string",
                "x-env-variable": true
              },
              "assignee_section": {
                "description": "The *assignee section* is a subdivision of a project that groups tasks together in the assignee's \"My Tasks\" list. It can either be a header above a list of tasks in a list view or a column in a board view of \"My Tasks.\"\nThe `assignee_section` property will be returned in the response only if the request was sent by the user who is the assignee of the task. Note that you can only write to `assignee_section` with the gid of an existing section visible in the user's \"My Tasks\" list.",
                "example": "12345",
                "nullable": true,
                "type": "string"
              },
              "custom_fields": {
                "additionalProperties": {
                  "description": "\"{custom_field_gid}\" => Value (Can be text, number, etc.)",
                  "type": "string"
                },
                "description": "An object where each key is a Custom Field GID and each value is an enum GID, string, number, object, or array.",
                "example": {
                  "4578152156": "Not Started",
                  "5678904321": "On Hold"
                },
                "type": "object"
              },
              "followers": {
                "description": "*Create-Only* An array of strings identifying users. These can either be the string \"me\", an email, or the gid of a user. In order to change followers on an existing task use `addFollowers` and `removeFollowers`.",
                "example": [
                  "12345"
                ],
                "items": {
                  "description": "Gid of a user.",
                  "type": "string"
                },
                "type": "array"
              },
              "parent": {
                "description": "Gid of a task.",
                "example": "12345",
                "nullable": true,
                "readOnly": false,
                "type": "string",
                "x-env-variable": true
              },
              "projects": {
                "description": "*Create-Only* Array of project gids. In order to change projects on an existing task use `addProject` and `removeProject`.",
                "example": [
                  "12345"
                ],
                "items": {
                  "description": "Gid of a project.",
                  "type": "string"
                },
                "type": "array"
              },
              "tags": {
                "description": "*Create-Only* Array of tag gids. In order to change tags on an existing task use `addTag` and `removeTag`.",
                "example": [
                  "12345"
                ],
                "items": {
                  "description": "Gid of a tag.",
                  "type": "string"
                },
                "type": "array"
              },
              "workspace": {
                "description": "Gid of a workspace.",
                "example": "12345",
                "readOnly": false,
                "type": "string",
                "x-env-variable": true
              }
            },
            "type": "object"
          }
        ]
      },
      "TaskResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/TaskBase"
          },
          {
            "properties": {
              "assignee": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/UserCompact"
                  }
                ],
                "nullable": true
              },
              "assignee_section": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/SectionCompact"
                  },
                  {
                    "description": "The *assignee section* is a subdivision of a project that groups tasks together in the assignee's \"My Tasks\" list. It can either be a header above a list of tasks in a list view or a column in a board view of \"My Tasks.\"\nThe `assignee_section` property will be returned in the response only if the request was sent by the user who is the assignee of the task. Note that you can only write to `assignee_section` with the gid of an existing section visible in the user's \"My Tasks\" list."
                  }
                ],
                "nullable": true
              },
              "custom_fields": {
                "description": "Array of custom field values applied to the task. These represent the custom field values recorded on this project for a particular custom field. For example, these custom field values will contain an `enum_value` property for custom fields of type `enum`, a `text_value` property for custom fields of type `text`, and so on. Please note that the `gid` returned on each custom field value *is identical* to the `gid` of the custom field, which allows referencing the custom field metadata through the `/custom_fields/custom_field-gid` endpoint.",
                "items": {
                  "$ref": "#/components/schemas/CustomFieldResponse"
                },
                "readOnly": true,
                "type": "array"
              },
              "followers": {
                "description": "Array of users following this task.",
                "items": {
                  "$ref": "#/components/schemas/UserCompact"
                },
                "readOnly": true,
                "type": "array"
              },
              "parent": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/TaskCompact"
                  },
                  {
                    "description": "The parent of this task, or `null` if this is not a subtask. This property cannot be modified using a PUT request but you can change it with the `setParent` endpoint. You can create subtasks by using the subtasks endpoint.",
                    "nullable": true,
                    "readOnly": true,
                    "type": "object"
                  }
                ]
              },
              "permalink_url": {
                "description": "A url that points directly to the object within Asana.",
                "example": "https://app.asana.com/0/resource/123456789/list",
                "readOnly": true,
                "type": "string"
              },
              "projects": {
                "description": "*Create-only.* Array of projects this task is associated with. At task creation time, this array can be used to add the task to many projects at once. After task creation, these associations can be modified using the addProject and removeProject endpoints.",
                "items": {
                  "$ref": "#/components/schemas/ProjectCompact"
                },
                "readOnly": true,
                "type": "array"
              },
              "tags": {
                "description": "Array of tags associated with this task. In order to change tags on an existing task use `addTag` and `removeTag`.",
                "example": [
                  {
                    "gid": "59746",
                    "name": "Grade A"
                  }
                ],
                "items": {
                  "$ref": "#/components/schemas/TagCompact"
                },
                "readOnly": true,
                "type": "array"
              },
              "workspace": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/WorkspaceCompact"
                  },
                  {
                    "description": "*Create-only*. The workspace this task is associated with. Once created, task cannot be moved to a different workspace. This attribute can only be specified at creation time.",
                    "readOnly": true,
                    "type": "object"
                  }
                ]
              }
            },
            "type": "object"
          }
        ]
      },
      "TaskSetParentRequest": {
        "properties": {
          "insert_after": {
            "description": "A subtask of the parent to insert the task after, or `null` to insert at the beginning of the list.",
            "example": "null",
            "type": "string"
          },
          "insert_before": {
            "description": "A subtask of the parent to insert the task before, or `null` to insert at the end of the list.",
            "example": "124816",
            "type": "string"
          },
          "parent": {
            "description": "The new parent of the task, or `null` for no parent.",
            "example": "987654",
            "type": "string"
          }
        },
        "required": [
          "parent"
        ],
        "type": "object"
      },
      "TeamAddUserRequest": {
        "description": "A user identification object for specification with the addUser/removeUser endpoints.",
        "properties": {
          "user": {
            "description": "A string identifying a user. This can either be the string \"me\", an email, or the gid of a user.",
            "example": "12345",
            "type": "string"
          }
        },
        "type": "object"
      },
      "TeamBase": {
        "$ref": "#/components/schemas/TeamCompact"
      },
      "TeamCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "A *team* is used to group related projects and people together within an organization. Each project in an organization is associated with a team.",
            "properties": {
              "name": {
                "description": "The name of the team.",
                "example": "Marketing",
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "team"
            }
          }
        ]
      },
      "TeamMembershipBase": {
        "$ref": "#/components/schemas/TeamMembershipCompact"
      },
      "TeamMembershipCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "This object represents a user's connection to a team.",
            "properties": {
              "is_guest": {
                "description": "Describes if the user is a guest in the team.",
                "example": false,
                "type": "boolean"
              },
              "team": {
                "$ref": "#/components/schemas/TeamCompact"
              },
              "user": {
                "$ref": "#/components/schemas/UserCompact"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "team_membership"
            }
          }
        ]
      },
      "TeamMembershipResponse": {
        "$ref": "#/components/schemas/TeamMembershipBase"
      },
      "TeamRemoveUserRequest": {
        "description": "A user identification object for specification with the addUser/removeUser endpoints.",
        "properties": {
          "user": {
            "description": "A string identifying a user. This can either be the string \"me\", an email, or the gid of a user.",
            "example": "12345",
            "type": "string"
          }
        },
        "type": "object"
      },
      "TeamRequest": {
        "allOf": [
          {
            "$ref": "#/components/schemas/TeamBase"
          },
          {
            "properties": {
              "description": {
                "description": "The description of the team.\n",
                "example": "All developers should be members of this team.",
                "type": "string"
              },
              "html_description": {
                "description": "The description of the team with formatting as HTML.\n",
                "example": "<body><em>All</em> developers should be members of this team.</body>",
                "type": "string"
              },
              "organization": {
                "description": "The organization/workspace the team belongs to. This must be the same organization you are in and cannot be changed once set.\n",
                "example": "123456789",
                "type": "string"
              },
              "visibility": {
                "description": "The visibility of the team to users in the same organization\n",
                "enum": [
                  "secret",
                  "request_to_join",
                  "public"
                ],
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "TeamResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/TeamBase"
          },
          {
            "properties": {
              "description": {
                "description": "[Opt In](/docs/input-output-options). The description of the team.\n",
                "example": "All developers should be members of this team.",
                "type": "string"
              },
              "html_description": {
                "description": "[Opt In](/docs/input-output-options). The description of the team with formatting as HTML.\n",
                "example": "<body><em>All</em> developers should be members of this team.</body>",
                "type": "string"
              },
              "organization": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/WorkspaceCompact"
                  },
                  {
                    "description": "The organization/workspace the team belongs to.\n",
                    "type": "object"
                  }
                ]
              },
              "permalink_url": {
                "description": "A url that points directly to the object within Asana.",
                "example": "https://app.asana.com/0/resource/123456789/list",
                "readOnly": true,
                "type": "string"
              },
              "visibility": {
                "description": "The visibility of the team to users in the same organization\n",
                "enum": [
                  "secret",
                  "request_to_join",
                  "public"
                ],
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "TimePeriodBase": {
        "allOf": [
          {
            "$ref": "#/components/schemas/TimePeriodCompact"
          },
          {
            "properties": {
              "parent": {
                "$ref": "#/components/schemas/TimePeriodCompact"
              }
            },
            "type": "object"
          }
        ]
      },
      "TimePeriodCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "properties": {
              "display_name": {
                "description": "A string representing the cadence code and the fiscal year.",
                "example": "Q1 FY22",
                "type": "string"
              },
              "end_on": {
                "description": "The localized end date of the time period in `YYYY-MM-DD` format.",
                "example": "2019-09-14",
                "type": "string"
              },
              "period": {
                "description": "The cadence and index of the time period. The value is one of: `FY`, `H1`, `H2`, `Q1`, `Q2`, `Q3`, or `Q4`.",
                "enum": [
                  "FY",
                  "H1",
                  "H2",
                  "Q1",
                  "Q2",
                  "Q3",
                  "Q4"
                ],
                "example": "Q1",
                "type": "string"
              },
              "start_on": {
                "description": "The localized start date of the time period in `YYYY-MM-DD` format.",
                "example": "2019-09-13",
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "time_period"
            }
          }
        ]
      },
      "TimePeriodResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/TimePeriodBase"
          },
          {
            "type": "object"
          }
        ]
      },
      "UserBase": {
        "$ref": "#/components/schemas/UserCompact"
      },
      "UserBaseResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/UserBase"
          },
          {
            "properties": {
              "email": {
                "description": "The user's email address.",
                "example": "gsanchez@example.com",
                "format": "email",
                "readOnly": true,
                "type": "string"
              },
              "photo": {
                "description": "A map of the user’s profile photo in various sizes, or null if no photo is set. Sizes provided are 21, 27, 36, 60, 128, and 1024. All images are in PNG format, except for 1024 (which is in JPEG format).",
                "example": {
                  "image_1024x1024": "https://...",
                  "image_128x128": "https://...",
                  "image_21x21": "https://...",
                  "image_27x27": "https://...",
                  "image_36x36": "https://...",
                  "image_60x60": "https://..."
                },
                "nullable": true,
                "properties": {
                  "image_1024x1024": {
                    "format": "uri",
                    "type": "string"
                  },
                  "image_128x128": {
                    "format": "uri",
                    "type": "string"
                  },
                  "image_21x21": {
                    "format": "uri",
                    "type": "string"
                  },
                  "image_27x27": {
                    "format": "uri",
                    "type": "string"
                  },
                  "image_36x36": {
                    "format": "uri",
                    "type": "string"
                  },
                  "image_60x60": {
                    "format": "uri",
                    "type": "string"
                  }
                },
                "readOnly": true,
                "type": "object"
              }
            },
            "type": "object"
          }
        ]
      },
      "UserCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "A *user* object represents an account in Asana that can be given access to various workspaces, projects, and tasks.",
            "properties": {
              "name": {
                "description": "*Read-only except when same user as requester*. The user’s name.",
                "example": "Greg Sanchez",
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "user"
            }
          }
        ]
      },
      "UserRequest": {
        "$ref": "#/components/schemas/UserBase"
      },
      "UserResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/UserBaseResponse"
          },
          {
            "properties": {
              "workspaces": {
                "description": "Workspaces and organizations this user may access.\nNote\\: The API will only return workspaces and organizations that also contain the authenticated user.",
                "items": {
                  "$ref": "#/components/schemas/WorkspaceCompact"
                },
                "readOnly": true,
                "type": "array"
              }
            },
            "type": "object"
          }
        ]
      },
      "UserTaskListBase": {
        "$ref": "#/components/schemas/UserTaskListCompact"
      },
      "UserTaskListCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "A user task list represents the tasks assigned to a particular user. It provides API access to a user’s [My Tasks](https://asana.com/guide/help/fundamentals/my-tasks) view in Asana.",
            "properties": {
              "name": {
                "description": "The name of the user task list.",
                "example": "My Tasks in My Workspace",
                "type": "string"
              },
              "owner": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/UserCompact"
                  }
                ],
                "description": "The owner of the user task list, i.e. the person whose My Tasks is represented by this resource.",
                "readOnly": true
              },
              "workspace": {
                "allOf": [
                  {
                    "$ref": "#/components/schemas/WorkspaceCompact"
                  }
                ],
                "description": "The workspace in which the user task list is located.",
                "readOnly": true
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "user_task_list"
            }
          }
        ]
      },
      "UserTaskListRequest": {
        "$ref": "#/components/schemas/UserTaskListBase"
      },
      "UserTaskListResponse": {
        "$ref": "#/components/schemas/UserTaskListBase"
      },
      "WebhookCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "Webhook objects represent the state of an active subscription for a server to be updated with information from Asana. This schema represents the subscription itself, not the objects that are sent to the server. For information on those please refer to the [Event](/docs/tocS_Event) schema.",
            "properties": {
              "active": {
                "description": "If true, the webhook will send events - if false it is considered inactive and will not generate events.",
                "example": false,
                "readOnly": true,
                "type": "boolean"
              },
              "resource": {
                "$ref": "#/components/schemas/AsanaNamedResource"
              },
              "target": {
                "description": "The URL to receive the HTTP POST.",
                "example": "https://example.com/receive-webhook/7654",
                "format": "uri",
                "readOnly": true,
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "webhook"
            }
          }
        ]
      },
      "WebhookFilter": {
        "description": "A WebhookFilter can be passed on creation of a webhook in order to filter the types of actions that trigger delivery of an [Event](/docs/tocS_Event)",
        "properties": {
          "action": {
            "description": "The type of change on the **resource** to pass through the filter. For more information refer to `Event.action` in the [Event](/docs/tocS_Event) schema. This can be one of `changed`, `added`, `removed`, `deleted`, and `undeleted` depending on the nature of what has occurred on the resource.",
            "example": "changed",
            "type": "string"
          },
          "fields": {
            "description": "*Conditional.* A whitelist of fields for events which will pass the filter when the resource is changed. These can be any combination of the fields on the resources themselves. This field is only valid for `action` of type `changed`",
            "example": [
              "due_at",
              "due_on",
              "dependencies"
            ],
            "items": {
              "type": "string"
            },
            "type": "array"
          },
          "resource_subtype": {
            "description": "The resource subtype of the resource that the filter applies to. This should be set to the same value as is returned on the `resource_subtype` field on the resources themselves.",
            "example": "milestone",
            "type": "string"
          },
          "resource_type": {
            "description": "The type of the resource which created the event when modified; for example, to filter to changes on regular tasks this field should be set to `task`.",
            "example": "task",
            "type": "string"
          }
        },
        "type": "object"
      },
      "WebhookRequest": {
        "properties": {
          "filters": {
            "description": "An array of WebhookFilter objects to specify a whitelist of filters to apply to events from this webhook. If a webhook event passes any of the filters the event will be delivered; otherwise no event will be sent to the receiving server.",
            "items": {
              "allOf": [
                {
                  "$ref": "#/components/schemas/WebhookFilter"
                },
                {
                  "description": "A set of filters to specify a whitelist for what types of events will be delivered."
                },
                {
                  "type": "object"
                }
              ]
            },
            "type": "array"
          },
          "resource": {
            "description": "A resource ID to subscribe to. Many Asana resources are valid to create webhooks on, but higher-level resources require filters.",
            "example": "12345",
            "type": "string"
          },
          "target": {
            "description": "The URL to receive the HTTP POST. The full URL will be used to deliver events from this webhook (including parameters) which allows encoding of application-specific state when the webhook is created.",
            "example": "https://example.com/receive-webhook/7654?app_specific_param=app_specific_value",
            "format": "uri",
            "type": "string"
          }
        },
        "required": [
          "resource",
          "target"
        ],
        "type": "object"
      },
      "WebhookResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/WebhookCompact"
          },
          {
            "properties": {
              "created_at": {
                "description": "The time at which this resource was created.",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              },
              "filters": {
                "description": "Whitelist of filters to apply to events from this webhook. If a webhook event passes any of the filters the event will be delivered; otherwise no event will be sent to the receiving server.",
                "items": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/WebhookFilter"
                    },
                    {
                      "description": "A set of filters to specify a whitelist for what types of events will be delivered."
                    },
                    {
                      "type": "object"
                    }
                  ]
                },
                "type": "array"
              },
              "last_failure_at": {
                "description": "The timestamp when the webhook last received an error when sending an event to the target.",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              },
              "last_failure_content": {
                "description": "The contents of the last error response sent to the webhook when attempting to deliver events to the target.",
                "example": "500 Server Error\\n\\nCould not complete the request",
                "readOnly": true,
                "type": "string"
              },
              "last_success_at": {
                "description": "The timestamp when the webhook last successfully sent an event to the target.",
                "example": "2012-02-22T02:06:58.147Z",
                "format": "date-time",
                "readOnly": true,
                "type": "string"
              }
            },
            "type": "object"
          }
        ]
      },
      "WebhookUpdateRequest": {
        "properties": {
          "filters": {
            "description": "An array of WebhookFilter objects to specify a whitelist of filters to apply to events from this webhook. If a webhook event passes any of the filters the event will be delivered; otherwise no event will be sent to the receiving server.",
            "items": {
              "allOf": [
                {
                  "$ref": "#/components/schemas/WebhookFilter"
                },
                {
                  "description": "A set of filters to specify a whitelist for what types of events will be delivered."
                },
                {
                  "type": "object"
                }
              ]
            },
            "type": "array"
          }
        },
        "type": "object"
      },
      "WorkspaceAddUserRequest": {
        "description": "A user identification object for specification with the addUser/removeUser endpoints.",
        "properties": {
          "user": {
            "description": "A string identifying a user. This can either be the string \"me\", an email, or the gid of a user.",
            "example": "12345",
            "type": "string"
          }
        },
        "type": "object"
      },
      "WorkspaceBase": {
        "$ref": "#/components/schemas/WorkspaceCompact"
      },
      "WorkspaceCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "A *workspace* is the highest-level organizational unit in Asana. All projects and tasks have an associated workspace.",
            "properties": {
              "name": {
                "description": "The name of the workspace.",
                "example": "My Company Workspace",
                "type": "string"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "workspace"
            }
          }
        ]
      },
      "WorkspaceMembershipBase": {
        "$ref": "#/components/schemas/WorkspaceMembershipCompact"
      },
      "WorkspaceMembershipCompact": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AsanaResource"
          },
          {
            "description": "This object determines if a user is a member of a workspace.",
            "properties": {
              "user": {
                "$ref": "#/components/schemas/UserCompact"
              },
              "workspace": {
                "$ref": "#/components/schemas/WorkspaceCompact"
              }
            },
            "type": "object",
            "x-docs-overrides": {
              "properties.resource_type.example": "workspace_membership"
            }
          }
        ]
      },
      "WorkspaceMembershipRequest": {
        "$ref": "#/components/schemas/WorkspaceMembershipBase"
      },
      "WorkspaceMembershipResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/WorkspaceMembershipBase"
          },
          {
            "properties": {
              "is_active": {
                "description": "Reflects if this user still a member of the workspace.",
                "readOnly": true,
                "type": "boolean"
              },
              "is_admin": {
                "description": "Reflects if this user is an admin of the workspace.",
                "readOnly": true,
                "type": "boolean"
              },
              "is_guest": {
                "description": "Reflects if this user is a guest of the workspace.",
                "readOnly": true,
                "type": "boolean"
              },
              "user_task_list": {
                "$ref": "#/components/schemas/UserTaskListResponse",
                "description": "The user's \"My Tasks\" in the workspace.",
                "readOnly": true
              },
              "vacation_dates": {
                "description": "Contains keys `start_on` and `end_on` for the vacation dates for the user in this workspace. If `start_on` is null, the entire `vacation_dates` object will be null. If `end_on` is before today, the entire `vacation_dates` object will be null.",
                "nullable": true,
                "properties": {
                  "end_on": {
                    "description": "The day on which the user's vacation in this workspace ends, or null if there is no end date. This is a date with `YYYY-MM-DD` format.",
                    "example": "2022-11-07",
                    "nullable": true,
                    "type": "string"
                  },
                  "start_on": {
                    "description": "The day on which the user's vacation in this workspace starts. This is a date with `YYYY-MM-DD` format.",
                    "example": "2022-11-05",
                    "type": "string"
                  }
                },
                "readOnly": true,
                "type": "object"
              }
            },
            "type": "object"
          }
        ]
      },
      "WorkspaceRemoveUserRequest": {
        "description": "A user identification object for specification with the addUser/removeUser endpoints.",
        "properties": {
          "user": {
            "description": "A string identifying a user. This can either be the string \"me\", an email, or the gid of a user.",
            "example": "12345",
            "type": "string"
          }
        },
        "type": "object"
      },
      "WorkspaceRequest": {
        "$ref": "#/components/schemas/WorkspaceBase"
      },
      "WorkspaceResponse": {
        "allOf": [
          {
            "$ref": "#/components/schemas/WorkspaceBase"
          },
          {
            "properties": {
              "email_domains": {
                "description": "The email domains that are associated with this workspace.",
                "example": [
                  "asana.com"
                ],
                "items": {
                  "format": "uri",
                  "type": "string"
                },
                "type": "array"
              },
              "is_organization": {
                "description": "Whether the workspace is an *organization*.",
                "example": false,
                "type": "boolean"
              }
            },
            "type": "object"
          }
        ]
      }
    },
    "securitySchemes": {
      "oauth2": {
        "description": "We require that applications designed to access the Asana API on behalf of multiple users implement OAuth 2.0.\nAsana supports the Authorization Code Grant flow.",
        "flows": {
          "authorizationCode": {
            "authorizationUrl": "https://app.asana.com/-/oauth_authorize",
            "refreshUrl": "https://app.asana.com/-/oauth_token",
            "scopes": {
              "default": "Provides access to all endpoints documented in our API reference. If no scopes are requested, this scope is assumed by default.",
              "email": "Provides access to the user’s email through the OpenID Connect user info endpoint.",
              "openid": "Provides access to OpenID Connect ID tokens and the OpenID Connect user info endpoint.",
              "profile": "Provides access to the user’s name and profile photo through the OpenID Connect user info endpoint."
            },
            "tokenUrl": "https://app.asana.com/-/oauth_token"
          }
        },
        "type": "oauth2"
      },
      "personalAccessToken": {
        "description": "A personal access token allows access to the api for the user who created it. This should be kept a secret and be treated like a password.",
        "scheme": "bearer",
        "type": "http"
      }
    }
  },
  "x-readme": {
    "proxy-enabled": false
  }
} as const