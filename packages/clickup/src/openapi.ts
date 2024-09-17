
    // @ts-nocheck
    export type openapi = {
  "openapi": "3.0.0",
  "servers": [
    {
      "url": "https://polls.apiblueprint.org"
    }
  ],
  "paths": {
    "/questions": {
      "get": {
        "description": "",
        "operationId": "List All Questions",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "examples": {
                  "response": {
                    "value": [
                      {
                        "choices": [
                          {
                            "choice": "Swift",
                            "votes": 2048
                          },
                          {
                            "choice": "Python",
                            "votes": 1024
                          },
                          {
                            "choice": "Objective-C",
                            "votes": 512
                          },
                          {
                            "choice": "Ruby",
                            "votes": 256
                          }
                        ],
                        "published_at": "2015-08-05T08:40:51.620Z",
                        "question": "Favourite programming language?"
                      }
                    ]
                  }
                }
              }
            },
            "description": "OK",
            "headers": {}
          }
        },
        "summary": "List All Questions",
        "tags": []
      },
      "post": {
        "description": "You may create your own question using this action. It takes a JSON\nobject containing a question and a collection of answers in the\nform of choices.",
        "operationId": "Create a New Question",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "example": {
                  "choices": [
                    "Swift",
                    "Python",
                    "Objective-C",
                    "Ruby"
                  ],
                  "question": "Favourite programming language?"
                },
                "properties": {
                  "choices": {
                    "items": {
                      "type": "string"
                    },
                    "type": "array"
                  },
                  "question": {
                    "type": "string"
                  }
                },
                "type": "object"
              }
            }
          }
        },
        "responses": {
          "201": {
            "content": {
              "application/json": {
                "examples": {
                  "response": {
                    "value": {
                      "choices": [
                        {
                          "choice": "Swift",
                          "votes": 0
                        },
                        {
                          "choice": "Python",
                          "votes": 0
                        },
                        {
                          "choice": "Objective-C",
                          "votes": 0
                        },
                        {
                          "choice": "Ruby",
                          "votes": 0
                        }
                      ],
                      "published_at": "2015-08-05T08:40:51.620Z",
                      "question": "Favourite programming language?"
                    }
                  }
                }
              }
            },
            "description": "Created",
            "headers": {
              "Location": {
                "schema": {
                  "type": "string"
                }
              }
            }
          }
        },
        "summary": "Create a New Question",
        "tags": []
      }
    }
  },
  "components": {
    "schemas": {
      "Questions_Collection": {}
    }
  }
}