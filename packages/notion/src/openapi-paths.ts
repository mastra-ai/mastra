// @ts-nocheck
export type TPaths = {
  '/v1/users/{user_id}': {
    get: {
      summary: 'Retrieve a user';
      description: '';
      operationId: 'get-user';
      parameters: [
        {
          name: 'user_id';
          in: 'path';
          description: 'Identifier for a Notion user';
          schema: {
            type: 'string';
          };
          required: true;
        },
        {
          name: 'Notion-Version';
          in: 'header';
          required: true;
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n  "object": "user",\n  "id": "d40e767c-d7af-4b18-a86d-55c61f1e39a4",\n  "type": "person",\n\t"person": {\n\t\t"email": "avo@example.org",\n\t},\n  "name": "Avocado Lovelace",\n  "avatar_url": "https://secure.notion-static.com/e6a352a8-8381-44d0-a1dc-9ed80e62b53d.jpg",\n}';
                };
              };
            };
          };
        };
        '400': {
          description: '400';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}';
                };
              };
              schema: {
                type: 'object';
                properties: {};
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript';
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const userId = 'd40e767c-d7af-4b18-a86d-55c61f1e39a4';\n  const response = await notion.users.retrieve({ user_id: userId });\n  console.log(response);\n})();";
            name: 'Notion SDK for JavaScript';
          },
          {
            language: 'curl';
            code: "curl 'https://api.notion.com/v1/users/d40e767c-d7af-4b18-a86d-55c61f1e39a4' \\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"'' \\\n  -H \"Notion-Version: 2022-06-28\" \\";
          },
        ];
        'samples-languages': ['javascript', 'curl'];
      };
    };
  };
  '/v1/users': {
    get: {
      summary: 'List all users';
      description: '';
      operationId: 'get-users';
      parameters: [
        {
          name: 'start_cursor';
          in: 'query';
          description: 'If supplied, this endpoint will return a page of results starting after the cursor provided. If not supplied, this endpoint will return the first page of results.';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'page_size';
          in: 'query';
          description: 'The number of items from the full list desired in the response. Maximum: 100';
          schema: {
            type: 'integer';
            format: 'int32';
            default: 100;
          };
        },
        {
          name: 'Notion-Version';
          in: 'header';
          required: true;
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n  "results": [\n    {\n      "object": "user",\n      "id": "d40e767c-d7af-4b18-a86d-55c61f1e39a4",\n      "type": "person",\n      "person": {\n        "email": "avo@example.org",\n      },\n      "name": "Avocado Lovelace",\n      "avatar_url": "https://secure.notion-static.com/e6a352a8-8381-44d0-a1dc-9ed80e62b53d.jpg",\n    },\n    {\n      "object": "user",\n      "id": "9a3b5ae0-c6e6-482d-b0e1-ed315ee6dc57",\n      "type": "bot",\n      "bot": {},\n      "name": "Doug Engelbot",\n      "avatar_url": "https://secure.notion-static.com/6720d746-3402-4171-8ebb-28d15144923c.jpg",\n    }\n  ],\n  "next_cursor": "fe2cc560-036c-44cd-90e8-294d5a74cebc",\n  "has_more": true\n}';
                };
              };
            };
          };
        };
        '400': {
          description: '400';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}';
                };
              };
              schema: {
                type: 'object';
                properties: {};
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript';
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const response = await notion.users.list();\n  console.log(response);\n})();";
            name: 'Notion SDK for JavaScript';
          },
          {
            language: 'curl';
            code: "curl 'https://api.notion.com/v1/users' \\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"'' \\\n  -H \"Notion-Version: 2022-06-28\"";
          },
        ];
        'samples-languages': ['javascript', 'curl'];
      };
    };
  };
  '/v1/databases/{database_id}/query': {
    post: {
      summary: 'Query a database';
      description: '';
      operationId: 'post-database-query';
      parameters: [
        {
          name: 'database_id';
          in: 'path';
          description: 'Identifier for a Notion database.';
          schema: {
            type: 'string';
          };
          required: true;
        },
        {
          name: 'filter_properties';
          in: 'query';
          description: 'A list of page property value IDs associated with the database. Use this param to limit the response to a specific page property value or values for pages that meet the `filter` criteria.';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'Notion-Version';
          in: 'header';
          required: true;
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                filter: {
                  type: 'string';
                  description: 'When supplied, limits which pages are returned based on the [filter conditions](ref:post-database-query-filter).';
                  format: 'json';
                };
                sorts: {
                  type: 'array';
                  description: 'When supplied, orders the results based on the provided [sort criteria](ref:post-database-query-sort).';
                };
                start_cursor: {
                  type: 'string';
                  description: 'When supplied, returns a page of results starting after the cursor provided. If not supplied, this endpoint will return the first page of results.';
                };
                page_size: {
                  type: 'integer';
                  description: 'The number of items from the full list desired in the response. Maximum: 100';
                  default: 100;
                  format: 'int32';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n  "object": "list",\n  "results": [\n    {\n      "object": "page",\n      "id": "59833787-2cf9-4fdf-8782-e53db20768a5",\n      "created_time": "2022-03-01T19:05:00.000Z",\n      "last_edited_time": "2022-07-06T20:25:00.000Z",\n      "created_by": {\n        "object": "user",\n        "id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n      },\n      "last_edited_by": {\n        "object": "user",\n        "id": "0c3e9826-b8f7-4f73-927d-2caaf86f1103"\n      },\n      "cover": {\n        "type": "external",\n        "external": {\n          "url": "https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg"\n        }\n      },\n      "icon": {\n        "type": "emoji",\n        "emoji": "🥬"\n      },\n      "parent": {\n        "type": "database_id",\n        "database_id": "d9824bdc-8445-4327-be8b-5b47500af6ce"\n      },\n      "archived": false,\n      "properties": {\n        "Store availability": {\n          "id": "%3AUPp",\n          "type": "multi_select",\n          "multi_select": [\n            {\n              "id": "t|O@",\n              "name": "Gus\'s Community Market",\n              "color": "yellow"\n            },\n            {\n              "id": "{Ml\\\\",\n              "name": "Rainbow Grocery",\n              "color": "gray"\n            }\n          ]\n        },\n        "Food group": {\n          "id": "A%40Hk",\n          "type": "select",\n          "select": {\n            "id": "5e8e7e8f-432e-4d8a-8166-1821e10225fc",\n            "name": "🥬 Vegetable",\n            "color": "pink"\n          }\n        },\n        "Price": {\n          "id": "BJXS",\n          "type": "number",\n          "number": 2.5\n        },\n        "Responsible Person": {\n          "id": "Iowm",\n          "type": "people",\n          "people": [\n            {\n              "object": "user",\n              "id": "cbfe3c6e-71cf-4cd3-b6e7-02f38f371bcc",\n              "name": "Cristina Cordova",\n              "avatar_url": "https://lh6.googleusercontent.com/-rapvfCoTq5A/AAAAAAAAAAI/AAAAAAAAAAA/AKF05nDKmmUpkpFvWNBzvu9rnZEy7cbl8Q/photo.jpg",\n              "type": "person",\n              "person": {\n                "email": "cristina@makenotion.com"\n              }\n            }\n          ]\n        },\n        "Last ordered": {\n          "id": "Jsfb",\n          "type": "date",\n          "date": {\n            "start": "2022-02-22",\n            "end": null,\n            "time_zone": null\n          }\n        },\n        "Cost of next trip": {\n          "id": "WOd%3B",\n          "type": "formula",\n          "formula": {\n            "type": "number",\n            "number": 0\n          }\n        },\n        "Recipes": {\n          "id": "YfIu",\n          "type": "relation",\n          "relation": [\n            {\n              "id": "90eeeed8-2cdd-4af4-9cc1-3d24aff5f63c"\n            },\n            {\n              "id": "a2da43ee-d43c-4285-8ae2-6d811f12629a"\n            }\n          ],\n\t\t\t\t\t"has_more": false\n        },\n        "Description": {\n          "id": "_Tc_",\n          "type": "rich_text",\n          "rich_text": [\n            {\n              "type": "text",\n              "text": {\n                "content": "A dark ",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n              },\n              "plain_text": "A dark ",\n              "href": null\n            },\n            {\n              "type": "text",\n              "text": {\n                "content": "green",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "green"\n              },\n              "plain_text": "green",\n              "href": null\n            },\n            {\n              "type": "text",\n              "text": {\n                "content": " leafy vegetable",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n              },\n              "plain_text": " leafy vegetable",\n              "href": null\n            }\n          ]\n        },\n        "In stock": {\n          "id": "%60%5Bq%3F",\n          "type": "checkbox",\n          "checkbox": true\n        },\n        "Number of meals": {\n          "id": "zag~",\n          "type": "rollup",\n          "rollup": {\n            "type": "number",\n            "number": 2,\n            "function": "count"\n          }\n        },\n        "Photo": {\n          "id": "%7DF_L",\n          "type": "url",\n          "url": "https://i.insider.com/612fb23c9ef1e50018f93198?width=1136&format=jpeg"\n        },\n        "Name": {\n          "id": "title",\n          "type": "title",\n          "title": [\n            {\n              "type": "text",\n              "text": {\n                "content": "Tuscan kale",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n              },\n              "plain_text": "Tuscan kale",\n              "href": null\n            }\n          ]\n        }\n      },\n      "url": "https://www.notion.so/Tuscan-kale-598337872cf94fdf8782e53db20768a5"\n    }\n  ],\n  "next_cursor": null,\n  "has_more": false,\n  "type": "page_or_database",\n\t"page_or_database": {}\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'list';
                  };
                  results: {
                    type: 'array';
                    items: {
                      type: 'object';
                      properties: {
                        object: {
                          type: 'string';
                          example: 'page';
                        };
                        id: {
                          type: 'string';
                          example: '59833787-2cf9-4fdf-8782-e53db20768a5';
                        };
                        created_time: {
                          type: 'string';
                          example: '2022-03-01T19:05:00.000Z';
                        };
                        last_edited_time: {
                          type: 'string';
                          example: '2022-07-06T20:25:00.000Z';
                        };
                        created_by: {
                          type: 'object';
                          properties: {
                            object: {
                              type: 'string';
                              example: 'user';
                            };
                            id: {
                              type: 'string';
                              example: 'ee5f0f84-409a-440f-983a-a5315961c6e4';
                            };
                          };
                        };
                        last_edited_by: {
                          type: 'object';
                          properties: {
                            object: {
                              type: 'string';
                              example: 'user';
                            };
                            id: {
                              type: 'string';
                              example: '0c3e9826-b8f7-4f73-927d-2caaf86f1103';
                            };
                          };
                        };
                        cover: {
                          type: 'object';
                          properties: {
                            type: {
                              type: 'string';
                              example: 'external';
                            };
                            external: {
                              type: 'object';
                              properties: {
                                url: {
                                  type: 'string';
                                  example: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg';
                                };
                              };
                            };
                          };
                        };
                        icon: {
                          type: 'object';
                          properties: {
                            type: {
                              type: 'string';
                              example: 'emoji';
                            };
                            emoji: {
                              type: 'string';
                              example: '🥬';
                            };
                          };
                        };
                        parent: {
                          type: 'object';
                          properties: {
                            type: {
                              type: 'string';
                              example: 'database_id';
                            };
                            database_id: {
                              type: 'string';
                              example: 'd9824bdc-8445-4327-be8b-5b47500af6ce';
                            };
                          };
                        };
                        archived: {
                          type: 'boolean';
                          example: false;
                          default: true;
                        };
                        properties: {
                          type: 'object';
                          properties: {
                            'Store availability': {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: '%3AUPp';
                                };
                                type: {
                                  type: 'string';
                                  example: 'multi_select';
                                };
                                multi_select: {
                                  type: 'array';
                                  items: {
                                    type: 'object';
                                    properties: {
                                      id: {
                                        type: 'string';
                                        example: 't|O@';
                                      };
                                      name: {
                                        type: 'string';
                                        example: "Gus's Community Market";
                                      };
                                      color: {
                                        type: 'string';
                                        example: 'yellow';
                                      };
                                    };
                                  };
                                };
                              };
                            };
                            'Food group': {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: 'A%40Hk';
                                };
                                type: {
                                  type: 'string';
                                  example: 'select';
                                };
                                select: {
                                  type: 'object';
                                  properties: {
                                    id: {
                                      type: 'string';
                                      example: '5e8e7e8f-432e-4d8a-8166-1821e10225fc';
                                    };
                                    name: {
                                      type: 'string';
                                      example: '🥬 Vegetable';
                                    };
                                    color: {
                                      type: 'string';
                                      example: 'pink';
                                    };
                                  };
                                };
                              };
                            };
                            Price: {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: 'BJXS';
                                };
                                type: {
                                  type: 'string';
                                  example: 'number';
                                };
                                number: {
                                  type: 'number';
                                  example: 2.5;
                                  default: 0;
                                };
                              };
                            };
                            'Responsible Person': {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: 'Iowm';
                                };
                                type: {
                                  type: 'string';
                                  example: 'people';
                                };
                                people: {
                                  type: 'array';
                                  items: {
                                    type: 'object';
                                    properties: {
                                      object: {
                                        type: 'string';
                                        example: 'user';
                                      };
                                      id: {
                                        type: 'string';
                                        example: 'cbfe3c6e-71cf-4cd3-b6e7-02f38f371bcc';
                                      };
                                      name: {
                                        type: 'string';
                                        example: 'Cristina Cordova';
                                      };
                                      avatar_url: {
                                        type: 'string';
                                        example: 'https://lh6.googleusercontent.com/-rapvfCoTq5A/AAAAAAAAAAI/AAAAAAAAAAA/AKF05nDKmmUpkpFvWNBzvu9rnZEy7cbl8Q/photo.jpg';
                                      };
                                      type: {
                                        type: 'string';
                                        example: 'person';
                                      };
                                      person: {
                                        type: 'object';
                                        properties: {
                                          email: {
                                            type: 'string';
                                            example: 'cristina@makenotion.com';
                                          };
                                        };
                                      };
                                    };
                                  };
                                };
                              };
                            };
                            'Last ordered': {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: 'Jsfb';
                                };
                                type: {
                                  type: 'string';
                                  example: 'date';
                                };
                                date: {
                                  type: 'object';
                                  properties: {
                                    start: {
                                      type: 'string';
                                      example: '2022-02-22';
                                    };
                                    end: {};
                                    time_zone: {};
                                  };
                                };
                              };
                            };
                            'Cost of next trip': {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: 'WOd%3B';
                                };
                                type: {
                                  type: 'string';
                                  example: 'formula';
                                };
                                formula: {
                                  type: 'object';
                                  properties: {
                                    type: {
                                      type: 'string';
                                      example: 'number';
                                    };
                                    number: {
                                      type: 'integer';
                                      example: 0;
                                      default: 0;
                                    };
                                  };
                                };
                              };
                            };
                            Recipes: {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: 'YfIu';
                                };
                                type: {
                                  type: 'string';
                                  example: 'relation';
                                };
                                relation: {
                                  type: 'array';
                                  items: {
                                    type: 'object';
                                    properties: {
                                      id: {
                                        type: 'string';
                                        example: '90eeeed8-2cdd-4af4-9cc1-3d24aff5f63c';
                                      };
                                    };
                                  };
                                };
                                has_more: {
                                  type: 'boolean';
                                  example: false;
                                  default: true;
                                };
                              };
                            };
                            Description: {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: '_Tc_';
                                };
                                type: {
                                  type: 'string';
                                  example: 'rich_text';
                                };
                                rich_text: {
                                  type: 'array';
                                  items: {
                                    type: 'object';
                                    properties: {
                                      type: {
                                        type: 'string';
                                        example: 'text';
                                      };
                                      text: {
                                        type: 'object';
                                        properties: {
                                          content: {
                                            type: 'string';
                                            example: 'A dark ';
                                          };
                                          link: {};
                                        };
                                      };
                                      annotations: {
                                        type: 'object';
                                        properties: {
                                          bold: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          italic: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          strikethrough: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          underline: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          code: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          color: {
                                            type: 'string';
                                            example: 'default';
                                          };
                                        };
                                      };
                                      plain_text: {
                                        type: 'string';
                                        example: 'A dark ';
                                      };
                                      href: {};
                                    };
                                  };
                                };
                              };
                            };
                            'In stock': {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: '%60%5Bq%3F';
                                };
                                type: {
                                  type: 'string';
                                  example: 'checkbox';
                                };
                                checkbox: {
                                  type: 'boolean';
                                  example: true;
                                  default: true;
                                };
                              };
                            };
                            'Number of meals': {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: 'zag~';
                                };
                                type: {
                                  type: 'string';
                                  example: 'rollup';
                                };
                                rollup: {
                                  type: 'object';
                                  properties: {
                                    type: {
                                      type: 'string';
                                      example: 'number';
                                    };
                                    number: {
                                      type: 'integer';
                                      example: 2;
                                      default: 0;
                                    };
                                    function: {
                                      type: 'string';
                                      example: 'count';
                                    };
                                  };
                                };
                              };
                            };
                            Photo: {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: '%7DF_L';
                                };
                                type: {
                                  type: 'string';
                                  example: 'url';
                                };
                                url: {
                                  type: 'string';
                                  example: 'https://i.insider.com/612fb23c9ef1e50018f93198?width=1136&format=jpeg';
                                };
                              };
                            };
                            Name: {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: 'title';
                                };
                                type: {
                                  type: 'string';
                                  example: 'title';
                                };
                                title: {
                                  type: 'array';
                                  items: {
                                    type: 'object';
                                    properties: {
                                      type: {
                                        type: 'string';
                                        example: 'text';
                                      };
                                      text: {
                                        type: 'object';
                                        properties: {
                                          content: {
                                            type: 'string';
                                            example: 'Tuscan kale';
                                          };
                                          link: {};
                                        };
                                      };
                                      annotations: {
                                        type: 'object';
                                        properties: {
                                          bold: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          italic: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          strikethrough: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          underline: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          code: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          color: {
                                            type: 'string';
                                            example: 'default';
                                          };
                                        };
                                      };
                                      plain_text: {
                                        type: 'string';
                                        example: 'Tuscan kale';
                                      };
                                      href: {};
                                    };
                                  };
                                };
                              };
                            };
                          };
                        };
                        url: {
                          type: 'string';
                          example: 'https://www.notion.so/Tuscan-kale-598337872cf94fdf8782e53db20768a5';
                        };
                      };
                    };
                  };
                  next_cursor: {};
                  has_more: {
                    type: 'boolean';
                    example: false;
                    default: true;
                  };
                  type: {
                    type: 'string';
                    example: 'page_or_database';
                  };
                  page_or_database: {
                    type: 'object';
                    properties: {};
                  };
                };
              };
            };
          };
        };
        '400': {
          description: '400';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}';
                };
              };
              schema: {
                type: 'object';
                properties: {};
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'curl';
            code: 'curl -X POST \'https://api.notion.com/v1/databases/897e5a76ae524b489fdfe71f5945d1af/query\' \\\n  -H \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n  -H \'Notion-Version: 2022-06-28\' \\\n  -H "Content-Type: application/json" \\\n--data \'{\n  "filter": {\n    "or": [\n      {\n        "property": "In stock",\n"checkbox": {\n"equals": true\n}\n      },\n      {\n"property": "Cost of next trip",\n"number": {\n"greater_than_or_equal_to": 2\n}\n}\n]\n},\n  "sorts": [\n    {\n      "property": "Last ordered",\n      "direction": "ascending"\n    }\n  ]\n}\'';
          },
          {
            language: 'javascript';
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const databaseId = 'd9824bdc-8445-4327-be8b-5b47500af6ce';\n  const response = await notion.databases.query({\n    database_id: databaseId,\n    filter: {\n      or: [\n        {\n          property: 'In stock',\n          checkbox: {\n            equals: true,\n          },\n        },\n        {\n          property: 'Cost of next trip',\n          number: {\n            greater_than_or_equal_to: 2,\n          },\n        },\n      ],\n    },\n    sorts: [\n      {\n        property: 'Last ordered',\n        direction: 'ascending',\n      },\n    ],\n  });\n  console.log(response);\n})();";
          },
        ];
        'samples-languages': ['curl', 'javascript'];
      };
    };
  };
  '/v1/search': {
    post: {
      summary: 'Search by title';
      description: '';
      operationId: 'post-search';
      parameters: [
        {
          name: 'Notion-Version';
          in: 'header';
          required: true;
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                query: {
                  type: 'string';
                  description: 'The text that the API compares page and database titles against.';
                };
                sort: {
                  type: 'object';
                  description: 'A set of criteria, `direction` and `timestamp` keys, that orders the results. The **only** supported timestamp value is `"last_edited_time"`. Supported `direction` values are `"ascending"` and `"descending"`. If `sort` is not provided, then the most recently edited results are returned first.';
                  properties: {
                    direction: {
                      type: 'string';
                      description: 'The direction to sort. Possible values include `ascending` and `descending`.';
                    };
                    timestamp: {
                      type: 'string';
                      description: 'The name of the timestamp to sort against. Possible values include `last_edited_time`.';
                    };
                  };
                };
                filter: {
                  type: 'object';
                  description: 'A set of criteria, `value` and `property` keys, that limits the results to either only pages or only databases. Possible `value` values are `"page"` or `"database"`. The only supported `property` value is `"object"`.';
                  properties: {
                    value: {
                      type: 'string';
                      description: 'The value of the property to filter the results by.  Possible values for object type include `page` or `database`.  **Limitation**: Currently the only filter allowed is `object` which will filter by type of object (either `page` or `database`)';
                    };
                    property: {
                      type: 'string';
                      description: 'The name of the property to filter by. Currently the only property you can filter by is the object type.  Possible values include `object`.   Limitation: Currently the only filter allowed is `object` which will filter by type of object (either `page` or `database`)';
                    };
                  };
                };
                start_cursor: {
                  type: 'string';
                  description: 'A `cursor` value returned in a previous response that If supplied, limits the response to results starting after the `cursor`. If not supplied, then the first page of results is returned. Refer to [pagination](https://developers.notion.com/reference/intro#pagination) for more details.';
                };
                page_size: {
                  type: 'integer';
                  description: 'The number of items from the full list to include in the response. Maximum: `100`.';
                  default: 100;
                  format: 'int32';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n  "object": "list",\n  "results": [\n    {\n      "object": "page",\n      "id": "954b67f9-3f87-41db-8874-23b92bbd31ee",\n      "created_time": "2022-07-06T19:30:00.000Z",\n      "last_edited_time": "2022-07-06T19:30:00.000Z",\n      "created_by": {\n        "object": "user",\n        "id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n      },\n      "last_edited_by": {\n        "object": "user",\n        "id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n      },\n      "cover": {\n        "type": "external",\n        "external": {\n          "url": "https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg"\n        }\n      },\n      "icon": {\n        "type": "emoji",\n        "emoji": "🥬"\n      },\n      "parent": {\n        "type": "database_id",\n        "database_id": "d9824bdc-8445-4327-be8b-5b47500af6ce"\n      },\n      "archived": false,\n      "properties": {\n        "Store availability": {\n          "id": "%3AUPp",\n          "type": "multi_select",\n          "multi_select": []\n        },\n        "Food group": {\n          "id": "A%40Hk",\n          "type": "select",\n          "select": {\n            "id": "5e8e7e8f-432e-4d8a-8166-1821e10225fc",\n            "name": "🥬 Vegetable",\n            "color": "pink"\n          }\n        },\n        "Price": {\n          "id": "BJXS",\n          "type": "number",\n          "number": null\n        },\n        "Responsible Person": {\n          "id": "Iowm",\n          "type": "people",\n          "people": []\n        },\n        "Last ordered": {\n          "id": "Jsfb",\n          "type": "date",\n          "date": null\n        },\n        "Cost of next trip": {\n          "id": "WOd%3B",\n          "type": "formula",\n          "formula": {\n            "type": "number",\n            "number": null\n          }\n        },\n        "Recipes": {\n          "id": "YfIu",\n          "type": "relation",\n          "relation": []\n        },\n        "Description": {\n          "id": "_Tc_",\n          "type": "rich_text",\n          "rich_text": [\n            {\n              "type": "text",\n              "text": {\n                "content": "A dark green leafy vegetable",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n              },\n              "plain_text": "A dark green leafy vegetable",\n              "href": null\n            }\n          ]\n        },\n        "In stock": {\n          "id": "%60%5Bq%3F",\n          "type": "checkbox",\n          "checkbox": false\n        },\n        "Number of meals": {\n          "id": "zag~",\n          "type": "rollup",\n          "rollup": {\n            "type": "number",\n            "number": 0,\n            "function": "count"\n          }\n        },\n        "Photo": {\n          "id": "%7DF_L",\n          "type": "url",\n          "url": null\n        },\n        "Name": {\n          "id": "title",\n          "type": "title",\n          "title": [\n            {\n              "type": "text",\n              "text": {\n                "content": "Tuscan kale",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n              },\n              "plain_text": "Tuscan kale",\n              "href": null\n            }\n          ]\n        }\n      },\n      "url": "https://www.notion.so/Tuscan-kale-954b67f93f8741db887423b92bbd31ee"\n    },\n    {\n      "object": "page",\n      "id": "59833787-2cf9-4fdf-8782-e53db20768a5",\n      "created_time": "2022-03-01T19:05:00.000Z",\n      "last_edited_time": "2022-07-06T20:25:00.000Z",\n      "created_by": {\n        "object": "user",\n        "id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n      },\n      "last_edited_by": {\n        "object": "user",\n        "id": "0c3e9826-b8f7-4f73-927d-2caaf86f1103"\n      },\n      "cover": {\n        "type": "external",\n        "external": {\n          "url": "https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg"\n        }\n      },\n      "icon": {\n        "type": "emoji",\n        "emoji": "🥬"\n      },\n      "parent": {\n        "type": "database_id",\n        "database_id": "d9824bdc-8445-4327-be8b-5b47500af6ce"\n      },\n      "archived": false,\n      "properties": {\n        "Store availability": {\n          "id": "%3AUPp",\n          "type": "multi_select",\n          "multi_select": [\n            {\n              "id": "t|O@",\n              "name": "Gus\'s Community Market",\n              "color": "yellow"\n            },\n            {\n              "id": "{Ml\\\\",\n              "name": "Rainbow Grocery",\n              "color": "gray"\n            }\n          ]\n        },\n        "Food group": {\n          "id": "A%40Hk",\n          "type": "select",\n          "select": {\n            "id": "5e8e7e8f-432e-4d8a-8166-1821e10225fc",\n            "name": "🥬 Vegetable",\n            "color": "pink"\n          }\n        },\n        "Price": {\n          "id": "BJXS",\n          "type": "number",\n          "number": 2.5\n        },\n        "Responsible Person": {\n          "id": "Iowm",\n          "type": "people",\n          "people": [\n            {\n              "object": "user",\n              "id": "cbfe3c6e-71cf-4cd3-b6e7-02f38f371bcc",\n              "name": "Cristina Cordova",\n              "avatar_url": "https://lh6.googleusercontent.com/-rapvfCoTq5A/AAAAAAAAAAI/AAAAAAAAAAA/AKF05nDKmmUpkpFvWNBzvu9rnZEy7cbl8Q/photo.jpg",\n              "type": "person",\n              "person": {\n                "email": "cristina@makenotion.com"\n              }\n            }\n          ]\n        },\n        "Last ordered": {\n          "id": "Jsfb",\n          "type": "date",\n          "date": {\n            "start": "2022-02-22",\n            "end": null,\n            "time_zone": null\n          }\n        },\n        "Cost of next trip": {\n          "id": "WOd%3B",\n          "type": "formula",\n          "formula": {\n            "type": "number",\n            "number": 0\n          }\n        },\n        "Recipes": {\n          "id": "YfIu",\n          "type": "relation",\n          "relation": [\n            {\n              "id": "90eeeed8-2cdd-4af4-9cc1-3d24aff5f63c"\n            },\n            {\n              "id": "a2da43ee-d43c-4285-8ae2-6d811f12629a"\n            }\n          ],\n\t\t\t\t\t"has_more": false\n        },\n        "Description": {\n          "id": "_Tc_",\n          "type": "rich_text",\n          "rich_text": [\n            {\n              "type": "text",\n              "text": {\n                "content": "A dark ",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n              },\n              "plain_text": "A dark ",\n              "href": null\n            },\n            {\n              "type": "text",\n              "text": {\n                "content": "green",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "green"\n              },\n              "plain_text": "green",\n              "href": null\n            },\n            {\n              "type": "text",\n              "text": {\n                "content": " leafy vegetable",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n              },\n              "plain_text": " leafy vegetable",\n              "href": null\n            }\n          ]\n        },\n        "In stock": {\n          "id": "%60%5Bq%3F",\n          "type": "checkbox",\n          "checkbox": true\n        },\n        "Number of meals": {\n          "id": "zag~",\n          "type": "rollup",\n          "rollup": {\n            "type": "number",\n            "number": 2,\n            "function": "count"\n          }\n        },\n        "Photo": {\n          "id": "%7DF_L",\n          "type": "url",\n          "url": "https://i.insider.com/612fb23c9ef1e50018f93198?width=1136&format=jpeg"\n        },\n        "Name": {\n          "id": "title",\n          "type": "title",\n          "title": [\n            {\n              "type": "text",\n              "text": {\n                "content": "Tuscan kale",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n              },\n              "plain_text": "Tuscan kale",\n              "href": null\n            }\n          ]\n        }\n      },\n      "url": "https://www.notion.so/Tuscan-kale-598337872cf94fdf8782e53db20768a5"\n    }\n  ],\n  "next_cursor": null,\n  "has_more": false,\n  "type": "page_or_database",\n  "page_or_database": {}\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'list';
                  };
                  results: {
                    type: 'array';
                    items: {
                      type: 'object';
                      properties: {
                        object: {
                          type: 'string';
                          example: 'page';
                        };
                        id: {
                          type: 'string';
                          example: '954b67f9-3f87-41db-8874-23b92bbd31ee';
                        };
                        created_time: {
                          type: 'string';
                          example: '2022-07-06T19:30:00.000Z';
                        };
                        last_edited_time: {
                          type: 'string';
                          example: '2022-07-06T19:30:00.000Z';
                        };
                        created_by: {
                          type: 'object';
                          properties: {
                            object: {
                              type: 'string';
                              example: 'user';
                            };
                            id: {
                              type: 'string';
                              example: 'ee5f0f84-409a-440f-983a-a5315961c6e4';
                            };
                          };
                        };
                        last_edited_by: {
                          type: 'object';
                          properties: {
                            object: {
                              type: 'string';
                              example: 'user';
                            };
                            id: {
                              type: 'string';
                              example: 'ee5f0f84-409a-440f-983a-a5315961c6e4';
                            };
                          };
                        };
                        cover: {
                          type: 'object';
                          properties: {
                            type: {
                              type: 'string';
                              example: 'external';
                            };
                            external: {
                              type: 'object';
                              properties: {
                                url: {
                                  type: 'string';
                                  example: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg';
                                };
                              };
                            };
                          };
                        };
                        icon: {
                          type: 'object';
                          properties: {
                            type: {
                              type: 'string';
                              example: 'emoji';
                            };
                            emoji: {
                              type: 'string';
                              example: '🥬';
                            };
                          };
                        };
                        parent: {
                          type: 'object';
                          properties: {
                            type: {
                              type: 'string';
                              example: 'database_id';
                            };
                            database_id: {
                              type: 'string';
                              example: 'd9824bdc-8445-4327-be8b-5b47500af6ce';
                            };
                          };
                        };
                        archived: {
                          type: 'boolean';
                          example: false;
                          default: true;
                        };
                        properties: {
                          type: 'object';
                          properties: {
                            'Store availability': {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: '%3AUPp';
                                };
                                type: {
                                  type: 'string';
                                  example: 'multi_select';
                                };
                                multi_select: {
                                  type: 'array';
                                };
                              };
                            };
                            'Food group': {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: 'A%40Hk';
                                };
                                type: {
                                  type: 'string';
                                  example: 'select';
                                };
                                select: {
                                  type: 'object';
                                  properties: {
                                    id: {
                                      type: 'string';
                                      example: '5e8e7e8f-432e-4d8a-8166-1821e10225fc';
                                    };
                                    name: {
                                      type: 'string';
                                      example: '🥬 Vegetable';
                                    };
                                    color: {
                                      type: 'string';
                                      example: 'pink';
                                    };
                                  };
                                };
                              };
                            };
                            Price: {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: 'BJXS';
                                };
                                type: {
                                  type: 'string';
                                  example: 'number';
                                };
                                number: {};
                              };
                            };
                            'Responsible Person': {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: 'Iowm';
                                };
                                type: {
                                  type: 'string';
                                  example: 'people';
                                };
                                people: {
                                  type: 'array';
                                };
                              };
                            };
                            'Last ordered': {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: 'Jsfb';
                                };
                                type: {
                                  type: 'string';
                                  example: 'date';
                                };
                                date: {};
                              };
                            };
                            'Cost of next trip': {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: 'WOd%3B';
                                };
                                type: {
                                  type: 'string';
                                  example: 'formula';
                                };
                                formula: {
                                  type: 'object';
                                  properties: {
                                    type: {
                                      type: 'string';
                                      example: 'number';
                                    };
                                    number: {};
                                  };
                                };
                              };
                            };
                            Recipes: {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: 'YfIu';
                                };
                                type: {
                                  type: 'string';
                                  example: 'relation';
                                };
                                relation: {
                                  type: 'array';
                                };
                              };
                            };
                            Description: {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: '_Tc_';
                                };
                                type: {
                                  type: 'string';
                                  example: 'rich_text';
                                };
                                rich_text: {
                                  type: 'array';
                                  items: {
                                    type: 'object';
                                    properties: {
                                      type: {
                                        type: 'string';
                                        example: 'text';
                                      };
                                      text: {
                                        type: 'object';
                                        properties: {
                                          content: {
                                            type: 'string';
                                            example: 'A dark green leafy vegetable';
                                          };
                                          link: {};
                                        };
                                      };
                                      annotations: {
                                        type: 'object';
                                        properties: {
                                          bold: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          italic: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          strikethrough: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          underline: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          code: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          color: {
                                            type: 'string';
                                            example: 'default';
                                          };
                                        };
                                      };
                                      plain_text: {
                                        type: 'string';
                                        example: 'A dark green leafy vegetable';
                                      };
                                      href: {};
                                    };
                                  };
                                };
                              };
                            };
                            'In stock': {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: '%60%5Bq%3F';
                                };
                                type: {
                                  type: 'string';
                                  example: 'checkbox';
                                };
                                checkbox: {
                                  type: 'boolean';
                                  example: false;
                                  default: true;
                                };
                              };
                            };
                            'Number of meals': {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: 'zag~';
                                };
                                type: {
                                  type: 'string';
                                  example: 'rollup';
                                };
                                rollup: {
                                  type: 'object';
                                  properties: {
                                    type: {
                                      type: 'string';
                                      example: 'number';
                                    };
                                    number: {
                                      type: 'integer';
                                      example: 0;
                                      default: 0;
                                    };
                                    function: {
                                      type: 'string';
                                      example: 'count';
                                    };
                                  };
                                };
                              };
                            };
                            Photo: {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: '%7DF_L';
                                };
                                type: {
                                  type: 'string';
                                  example: 'url';
                                };
                                url: {};
                              };
                            };
                            Name: {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: 'title';
                                };
                                type: {
                                  type: 'string';
                                  example: 'title';
                                };
                                title: {
                                  type: 'array';
                                  items: {
                                    type: 'object';
                                    properties: {
                                      type: {
                                        type: 'string';
                                        example: 'text';
                                      };
                                      text: {
                                        type: 'object';
                                        properties: {
                                          content: {
                                            type: 'string';
                                            example: 'Tuscan kale';
                                          };
                                          link: {};
                                        };
                                      };
                                      annotations: {
                                        type: 'object';
                                        properties: {
                                          bold: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          italic: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          strikethrough: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          underline: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          code: {
                                            type: 'boolean';
                                            example: false;
                                            default: true;
                                          };
                                          color: {
                                            type: 'string';
                                            example: 'default';
                                          };
                                        };
                                      };
                                      plain_text: {
                                        type: 'string';
                                        example: 'Tuscan kale';
                                      };
                                      href: {};
                                    };
                                  };
                                };
                              };
                            };
                          };
                        };
                        url: {
                          type: 'string';
                          example: 'https://www.notion.so/Tuscan-kale-954b67f93f8741db887423b92bbd31ee';
                        };
                      };
                    };
                  };
                  next_cursor: {};
                  has_more: {
                    type: 'boolean';
                    example: false;
                    default: true;
                  };
                  type: {
                    type: 'string';
                    example: 'page_or_database';
                  };
                  page_or_database: {
                    type: 'object';
                    properties: {};
                  };
                };
              };
            };
          };
        };
        '400': {
          description: '400';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n    "object": "error",\n    "status": 400,\n    "code": "invalid_json",\n    "message": "Error parsing JSON body."\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'error';
                  };
                  status: {
                    type: 'integer';
                    example: 400;
                    default: 0;
                  };
                  code: {
                    type: 'string';
                    example: 'invalid_json';
                  };
                  message: {
                    type: 'string';
                    example: 'Error parsing JSON body.';
                  };
                };
              };
            };
          };
        };
        '429': {
          description: '429';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n  "object": "error",\n  "status": 429,\n  "code": "rate_limited",\n  "message": "You have been rate limited. Please try again in a few minutes."\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'error';
                  };
                  status: {
                    type: 'integer';
                    example: 429;
                    default: 0;
                  };
                  code: {
                    type: 'string';
                    example: 'rate_limited';
                  };
                  message: {
                    type: 'string';
                    example: 'You have been rate limited. Please try again in a few minutes.';
                  };
                };
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript';
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const response = await notion.search({\n    query: 'External tasks',\n    filter: {\n      value: 'database',\n      property: 'object'\n    },\n    sort: {\n      direction: 'ascending',\n      timestamp: 'last_edited_time'\n    },\n  });\n  console.log(response);\n})();";
            name: 'Notion SDK for JavaScript';
          },
          {
            language: 'curl';
            code: 'curl -X POST \'https://api.notion.com/v1/search\' \\\n  -H \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n  -H \'Content-Type: application/json\' \\\n  -H \'Notion-Version: 2022-06-28\' \\\n  --data \'{\n    "query":"External tasks",\n    "filter": {\n        "value": "database",\n        "property": "object"\n    },\n    "sort":{\n      "direction":"ascending",\n      "timestamp":"last_edited_time"\n    }\n  }\'';
          },
        ];
        'samples-languages': ['javascript', 'curl'];
      };
    };
  };
  '/v1/blocks/{block_id}/children': {
    get: {
      summary: 'Retrieve block children';
      description: '';
      operationId: 'get-block-children';
      parameters: [
        {
          name: 'block_id';
          in: 'path';
          description: 'Identifier for a [block](ref:block)';
          schema: {
            type: 'string';
          };
          required: true;
        },
        {
          name: 'start_cursor';
          in: 'query';
          description: 'If supplied, this endpoint will return a page of results starting after the cursor provided. If not supplied, this endpoint will return the first page of results.';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'page_size';
          in: 'query';
          description: 'The number of items from the full list desired in the response. Maximum: 100';
          schema: {
            type: 'integer';
            format: 'int32';
            default: 100;
          };
        },
        {
          name: 'Notion-Version';
          in: 'header';
          required: true;
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n\t"object": "list",\n\t"results": [\n\t\t{\n\t\t\t"object": "block",\n\t\t\t"id": "c02fc1d3-db8b-45c5-a222-27595b15aea7",\n\t\t\t"parent": {\n\t\t\t\t"type": "page_id",\n\t\t\t\t"page_id": "59833787-2cf9-4fdf-8782-e53db20768a5"\n\t\t\t},\n\t\t\t"created_time": "2022-03-01T19:05:00.000Z",\n\t\t\t"last_edited_time": "2022-03-01T19:05:00.000Z",\n\t\t\t"created_by": {\n\t\t\t\t"object": "user",\n\t\t\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t\t\t},\n\t\t\t"last_edited_by": {\n\t\t\t\t"object": "user",\n\t\t\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t\t\t},\n\t\t\t"has_children": false,\n\t\t\t"archived": false,\n\t\t\t"type": "heading_2",\n\t\t\t"heading_2": {\n\t\t\t\t"rich_text": [\n\t\t\t\t\t{\n\t\t\t\t\t\t"type": "text",\n\t\t\t\t\t\t"text": {\n\t\t\t\t\t\t\t"content": "Lacinato kale",\n\t\t\t\t\t\t\t"link": null\n\t\t\t\t\t\t},\n\t\t\t\t\t\t"annotations": {\n\t\t\t\t\t\t\t"bold": false,\n\t\t\t\t\t\t\t"italic": false,\n\t\t\t\t\t\t\t"strikethrough": false,\n\t\t\t\t\t\t\t"underline": false,\n\t\t\t\t\t\t\t"code": false,\n\t\t\t\t\t\t\t"color": "default"\n\t\t\t\t\t\t},\n\t\t\t\t\t\t"plain_text": "Lacinato kale",\n\t\t\t\t\t\t"href": null\n\t\t\t\t\t}\n\t\t\t\t],\n\t\t\t\t"color": "default",\n        "is_toggleable": false\n\t\t\t}\n\t\t},\n\t\t{\n\t\t\t"object": "block",\n\t\t\t"id": "acc7eb06-05cd-4603-a384-5e1e4f1f4e72",\n\t\t\t"parent": {\n\t\t\t\t"type": "page_id",\n\t\t\t\t"page_id": "59833787-2cf9-4fdf-8782-e53db20768a5"\n\t\t\t},\n\t\t\t"created_time": "2022-03-01T19:05:00.000Z",\n\t\t\t"last_edited_time": "2022-03-01T19:05:00.000Z",\n\t\t\t"created_by": {\n\t\t\t\t"object": "user",\n\t\t\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t\t\t},\n\t\t\t"last_edited_by": {\n\t\t\t\t"object": "user",\n\t\t\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t\t\t},\n\t\t\t"has_children": false,\n\t\t\t"archived": false,\n\t\t\t"type": "paragraph",\n\t\t\t"paragraph": {\n\t\t\t\t"rich_text": [\n\t\t\t\t\t{\n\t\t\t\t\t\t"type": "text",\n\t\t\t\t\t\t"text": {\n\t\t\t\t\t\t\t"content": "Lacinato kale is a variety of kale with a long tradition in Italian cuisine, especially that of Tuscany. It is also known as Tuscan kale, Italian kale, dinosaur kale, kale, flat back kale, palm tree kale, or black Tuscan palm.",\n\t\t\t\t\t\t\t"link": {\n\t\t\t\t\t\t\t\t"url": "https://en.wikipedia.org/wiki/Lacinato_kale"\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t},\n\t\t\t\t\t\t"annotations": {\n\t\t\t\t\t\t\t"bold": false,\n\t\t\t\t\t\t\t"italic": false,\n\t\t\t\t\t\t\t"strikethrough": false,\n\t\t\t\t\t\t\t"underline": false,\n\t\t\t\t\t\t\t"code": false,\n\t\t\t\t\t\t\t"color": "default"\n\t\t\t\t\t\t},\n\t\t\t\t\t\t"plain_text": "Lacinato kale is a variety of kale with a long tradition in Italian cuisine, especially that of Tuscany. It is also known as Tuscan kale, Italian kale, dinosaur kale, kale, flat back kale, palm tree kale, or black Tuscan palm.",\n\t\t\t\t\t\t"href": "https://en.wikipedia.org/wiki/Lacinato_kale"\n\t\t\t\t\t}\n\t\t\t\t],\n\t\t\t\t"color": "default"\n\t\t\t}\n\t\t}\n\t],\n\t"next_cursor": null,\n\t"has_more": false,\n\t"type": "block",\n\t"block": {}\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'list';
                  };
                  results: {
                    type: 'array';
                    items: {
                      type: 'object';
                      properties: {
                        object: {
                          type: 'string';
                          example: 'block';
                        };
                        id: {
                          type: 'string';
                          example: 'c02fc1d3-db8b-45c5-a222-27595b15aea7';
                        };
                        parent: {
                          type: 'object';
                          properties: {
                            type: {
                              type: 'string';
                              example: 'page_id';
                            };
                            page_id: {
                              type: 'string';
                              example: '59833787-2cf9-4fdf-8782-e53db20768a5';
                            };
                          };
                        };
                        created_time: {
                          type: 'string';
                          example: '2022-03-01T19:05:00.000Z';
                        };
                        last_edited_time: {
                          type: 'string';
                          example: '2022-03-01T19:05:00.000Z';
                        };
                        created_by: {
                          type: 'object';
                          properties: {
                            object: {
                              type: 'string';
                              example: 'user';
                            };
                            id: {
                              type: 'string';
                              example: 'ee5f0f84-409a-440f-983a-a5315961c6e4';
                            };
                          };
                        };
                        last_edited_by: {
                          type: 'object';
                          properties: {
                            object: {
                              type: 'string';
                              example: 'user';
                            };
                            id: {
                              type: 'string';
                              example: 'ee5f0f84-409a-440f-983a-a5315961c6e4';
                            };
                          };
                        };
                        has_children: {
                          type: 'boolean';
                          example: false;
                          default: true;
                        };
                        archived: {
                          type: 'boolean';
                          example: false;
                          default: true;
                        };
                        type: {
                          type: 'string';
                          example: 'heading_2';
                        };
                        heading_2: {
                          type: 'object';
                          properties: {
                            rich_text: {
                              type: 'array';
                              items: {
                                type: 'object';
                                properties: {
                                  type: {
                                    type: 'string';
                                    example: 'text';
                                  };
                                  text: {
                                    type: 'object';
                                    properties: {
                                      content: {
                                        type: 'string';
                                        example: 'Lacinato kale';
                                      };
                                      link: {};
                                    };
                                  };
                                  annotations: {
                                    type: 'object';
                                    properties: {
                                      bold: {
                                        type: 'boolean';
                                        example: false;
                                        default: true;
                                      };
                                      italic: {
                                        type: 'boolean';
                                        example: false;
                                        default: true;
                                      };
                                      strikethrough: {
                                        type: 'boolean';
                                        example: false;
                                        default: true;
                                      };
                                      underline: {
                                        type: 'boolean';
                                        example: false;
                                        default: true;
                                      };
                                      code: {
                                        type: 'boolean';
                                        example: false;
                                        default: true;
                                      };
                                      color: {
                                        type: 'string';
                                        example: 'default';
                                      };
                                    };
                                  };
                                  plain_text: {
                                    type: 'string';
                                    example: 'Lacinato kale';
                                  };
                                  href: {};
                                };
                              };
                            };
                            color: {
                              type: 'string';
                              example: 'default';
                            };
                            is_toggleable: {
                              type: 'boolean';
                              example: false;
                              default: true;
                            };
                          };
                        };
                      };
                    };
                  };
                  next_cursor: {};
                  has_more: {
                    type: 'boolean';
                    example: false;
                    default: true;
                  };
                  type: {
                    type: 'string';
                    example: 'block';
                  };
                  block: {
                    type: 'object';
                    properties: {};
                  };
                };
              };
            };
          };
        };
        '400': {
          description: '400';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}';
                };
              };
              schema: {
                type: 'object';
                properties: {};
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript';
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const blockId = '59833787-2cf9-4fdf-8782-e53db20768a5';\n  const response = await notion.blocks.children.list({\n    block_id: blockId,\n    page_size: 50,\n  });\n  console.log(response);\n})();";
            name: 'Notion SDK for JavaScript';
          },
          {
            language: 'curl';
            code: "curl 'https://api.notion.com/v1/blocks/b55c9c91-384d-452b-81db-d1ef79372b75/children?page_size=100' \\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"'' \\\n  -H \"Notion-Version: 2022-06-28\"";
          },
        ];
        'samples-languages': ['javascript', 'curl'];
      };
    };
    patch: {
      summary: 'Append block children';
      description: '';
      operationId: 'patch-block-children';
      parameters: [
        {
          name: 'block_id';
          in: 'path';
          description: 'Identifier for a [block](ref:block). Also accepts a [page](ref:page) ID.';
          schema: {
            type: 'string';
          };
          required: true;
        },
        {
          name: 'Notion-Version';
          in: 'header';
          required: true;
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['children'];
              properties: {
                children: {
                  type: 'array';
                  description: 'Child content to append to a container block as an array of [block objects](ref:block)';
                };
                after: {
                  type: 'string';
                  description: 'The ID of the existing block that the new block should be appended after.';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n\t"object": "list",\n\t"results": [\n\t\t{\n\t\t\t"object": "block",\n\t\t\t"id": "c02fc1d3-db8b-45c5-a222-27595b15aea7",\n\t\t\t"parent": {\n\t\t\t\t"type": "page_id",\n\t\t\t\t"page_id": "59833787-2cf9-4fdf-8782-e53db20768a5"\n\t\t\t},\n\t\t\t"created_time": "2022-03-01T19:05:00.000Z",\n\t\t\t"last_edited_time": "2022-07-06T19:41:00.000Z",\n\t\t\t"created_by": {\n\t\t\t\t"object": "user",\n\t\t\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t\t\t},\n\t\t\t"last_edited_by": {\n\t\t\t\t"object": "user",\n\t\t\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t\t\t},\n\t\t\t"has_children": false,\n\t\t\t"archived": false,\n\t\t\t"type": "heading_2",\n\t\t\t"heading_2": {\n\t\t\t\t"rich_text": [\n\t\t\t\t\t{\n\t\t\t\t\t\t"type": "text",\n\t\t\t\t\t\t"text": {\n\t\t\t\t\t\t\t"content": "Lacinato kale",\n\t\t\t\t\t\t\t"link": null\n\t\t\t\t\t\t},\n\t\t\t\t\t\t"annotations": {\n\t\t\t\t\t\t\t"bold": false,\n\t\t\t\t\t\t\t"italic": false,\n\t\t\t\t\t\t\t"strikethrough": false,\n\t\t\t\t\t\t\t"underline": false,\n\t\t\t\t\t\t\t"code": false,\n\t\t\t\t\t\t\t"color": "default"\n\t\t\t\t\t\t},\n\t\t\t\t\t\t"plain_text": "Lacinato kale",\n\t\t\t\t\t\t"href": null\n\t\t\t\t\t}\n\t\t\t\t],\n\t\t\t\t"color": "default",\n        "is_toggleable": false\n\t\t\t}\n\t\t},\n\t\t{\n\t\t\t"object": "block",\n\t\t\t"id": "acc7eb06-05cd-4603-a384-5e1e4f1f4e72",\n\t\t\t"parent": {\n\t\t\t\t"type": "page_id",\n\t\t\t\t"page_id": "59833787-2cf9-4fdf-8782-e53db20768a5"\n\t\t\t},\n\t\t\t"created_time": "2022-03-01T19:05:00.000Z",\n\t\t\t"last_edited_time": "2022-07-06T19:51:00.000Z",\n\t\t\t"created_by": {\n\t\t\t\t"object": "user",\n\t\t\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t\t\t},\n\t\t\t"last_edited_by": {\n\t\t\t\t"object": "user",\n\t\t\t\t"id": "0c3e9826-b8f7-4f73-927d-2caaf86f1103"\n\t\t\t},\n\t\t\t"has_children": false,\n\t\t\t"archived": false,\n\t\t\t"type": "paragraph",\n\t\t\t"paragraph": {\n\t\t\t\t"rich_text": [\n\t\t\t\t\t{\n\t\t\t\t\t\t"type": "text",\n\t\t\t\t\t\t"text": {\n\t\t\t\t\t\t\t"content": "Lacinato kale is a variety of kale with a long tradition in Italian cuisine, especially that of Tuscany. It is also known as Tuscan kale, Italian kale, dinosaur kale, kale, flat back kale, palm tree kale, or black Tuscan palm.",\n\t\t\t\t\t\t\t"link": {\n\t\t\t\t\t\t\t\t"url": "https://en.wikipedia.org/wiki/Lacinato_kale"\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t},\n\t\t\t\t\t\t"annotations": {\n\t\t\t\t\t\t\t"bold": false,\n\t\t\t\t\t\t\t"italic": false,\n\t\t\t\t\t\t\t"strikethrough": false,\n\t\t\t\t\t\t\t"underline": false,\n\t\t\t\t\t\t\t"code": false,\n\t\t\t\t\t\t\t"color": "default"\n\t\t\t\t\t\t},\n\t\t\t\t\t\t"plain_text": "Lacinato kale is a variety of kale with a long tradition in Italian cuisine, especially that of Tuscany. It is also known as Tuscan kale, Italian kale, dinosaur kale, kale, flat back kale, palm tree kale, or black Tuscan palm.",\n\t\t\t\t\t\t"href": "https://en.wikipedia.org/wiki/Lacinato_kale"\n\t\t\t\t\t}\n\t\t\t\t],\n\t\t\t\t"color": "default"\n\t\t\t}\n\t\t}\n\t],\n\t"next_cursor": null,\n\t"has_more": false,\n\t"type": "block",\n\t"block": {}\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'list';
                  };
                  results: {
                    type: 'array';
                    items: {
                      type: 'object';
                      properties: {
                        object: {
                          type: 'string';
                          example: 'block';
                        };
                        id: {
                          type: 'string';
                          example: 'c02fc1d3-db8b-45c5-a222-27595b15aea7';
                        };
                        parent: {
                          type: 'object';
                          properties: {
                            type: {
                              type: 'string';
                              example: 'page_id';
                            };
                            page_id: {
                              type: 'string';
                              example: '59833787-2cf9-4fdf-8782-e53db20768a5';
                            };
                          };
                        };
                        created_time: {
                          type: 'string';
                          example: '2022-03-01T19:05:00.000Z';
                        };
                        last_edited_time: {
                          type: 'string';
                          example: '2022-07-06T19:41:00.000Z';
                        };
                        created_by: {
                          type: 'object';
                          properties: {
                            object: {
                              type: 'string';
                              example: 'user';
                            };
                            id: {
                              type: 'string';
                              example: 'ee5f0f84-409a-440f-983a-a5315961c6e4';
                            };
                          };
                        };
                        last_edited_by: {
                          type: 'object';
                          properties: {
                            object: {
                              type: 'string';
                              example: 'user';
                            };
                            id: {
                              type: 'string';
                              example: 'ee5f0f84-409a-440f-983a-a5315961c6e4';
                            };
                          };
                        };
                        has_children: {
                          type: 'boolean';
                          example: false;
                          default: true;
                        };
                        archived: {
                          type: 'boolean';
                          example: false;
                          default: true;
                        };
                        type: {
                          type: 'string';
                          example: 'heading_2';
                        };
                        heading_2: {
                          type: 'object';
                          properties: {
                            rich_text: {
                              type: 'array';
                              items: {
                                type: 'object';
                                properties: {
                                  type: {
                                    type: 'string';
                                    example: 'text';
                                  };
                                  text: {
                                    type: 'object';
                                    properties: {
                                      content: {
                                        type: 'string';
                                        example: 'Lacinato kale';
                                      };
                                      link: {};
                                    };
                                  };
                                  annotations: {
                                    type: 'object';
                                    properties: {
                                      bold: {
                                        type: 'boolean';
                                        example: false;
                                        default: true;
                                      };
                                      italic: {
                                        type: 'boolean';
                                        example: false;
                                        default: true;
                                      };
                                      strikethrough: {
                                        type: 'boolean';
                                        example: false;
                                        default: true;
                                      };
                                      underline: {
                                        type: 'boolean';
                                        example: false;
                                        default: true;
                                      };
                                      code: {
                                        type: 'boolean';
                                        example: false;
                                        default: true;
                                      };
                                      color: {
                                        type: 'string';
                                        example: 'default';
                                      };
                                    };
                                  };
                                  plain_text: {
                                    type: 'string';
                                    example: 'Lacinato kale';
                                  };
                                  href: {};
                                };
                              };
                            };
                            color: {
                              type: 'string';
                              example: 'default';
                            };
                            is_toggleable: {
                              type: 'boolean';
                              example: false;
                              default: true;
                            };
                          };
                        };
                      };
                    };
                  };
                  next_cursor: {};
                  has_more: {
                    type: 'boolean';
                    example: false;
                    default: true;
                  };
                  type: {
                    type: 'string';
                    example: 'block';
                  };
                  block: {
                    type: 'object';
                    properties: {};
                  };
                };
              };
            };
          };
        };
        '400': {
          description: '400';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}';
                };
              };
              schema: {
                type: 'object';
                properties: {};
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript';
            code: 'const { Client } = require(\'@notionhq/client\');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const blockId = \'b55c9c91-384d-452b-81db-d1ef79372b75\';\n  const response = await notion.blocks.children.append({\n    block_id: blockId,\n    children: [\n      {\n        "heading_2": {\n          "rich_text": [\n            {\n              "text": {\n                "content": "Lacinato kale"\n              }\n            }\n          ]\n        }\n      },\n      {\n        "paragraph": {\n          "rich_text": [\n            {\n              "text": {\n                "content": "Lacinato kale is a variety of kale with a long tradition in Italian cuisine, especially that of Tuscany. It is also known as Tuscan kale, Italian kale, dinosaur kale, kale, flat back kale, palm tree kale, or black Tuscan palm.",\n                "link": {\n                  "url": "https://en.wikipedia.org/wiki/Lacinato_kale"\n                }\n              }\n            }\n          ]\n        }\n      }\n    ],\n  });\n  console.log(response);\n})();';
            name: 'Notion SDK for JavaScript';
          },
          {
            language: 'curl';
            code: 'curl -X PATCH \'https://api.notion.com/v1/blocks/b55c9c91-384d-452b-81db-d1ef79372b75/children\' \\\n  -H \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n  -H "Content-Type: application/json" \\\n  -H "Notion-Version: 2022-06-28" \\\n  --data \'{\n\t"children": [\n\t\t{\n\t\t\t"object": "block",\n\t\t\t"type": "heading_2",\n\t\t\t"heading_2": {\n\t\t\t\t"rich_text": [{ "type": "text", "text": { "content": "Lacinato kale" } }]\n\t\t\t}\n\t\t},\n\t\t{\n\t\t\t"object": "block",\n\t\t\t"type": "paragraph",\n\t\t\t"paragraph": {\n\t\t\t\t"rich_text": [\n\t\t\t\t\t{\n\t\t\t\t\t\t"type": "text",\n\t\t\t\t\t\t"text": {\n\t\t\t\t\t\t\t"content": "Lacinato kale is a variety of kale with a long tradition in Italian cuisine, especially that of Tuscany. It is also known as Tuscan kale, Italian kale, dinosaur kale, kale, flat back kale, palm tree kale, or black Tuscan palm.",\n\t\t\t\t\t\t\t"link": { "url": "https://en.wikipedia.org/wiki/Lacinato_kale" }\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t]\n\t\t\t}\n\t\t}\n\t]\n}\'';
          },
        ];
        'samples-languages': ['javascript', 'curl'];
      };
    };
  };
  '/v1/blocks/{block_id}': {
    get: {
      summary: 'Retrieve a block';
      description: '';
      operationId: 'retrieve-a-block';
      parameters: [
        {
          name: 'block_id';
          in: 'path';
          description: 'Identifier for a Notion block';
          schema: {
            type: 'string';
          };
          required: true;
        },
        {
          name: 'Notion-Version';
          in: 'header';
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n\t"object": "block",\n\t"id": "c02fc1d3-db8b-45c5-a222-27595b15aea7",\n\t"parent": {\n\t\t"type": "page_id",\n\t\t"page_id": "59833787-2cf9-4fdf-8782-e53db20768a5"\n\t},\n\t"created_time": "2022-03-01T19:05:00.000Z",\n\t"last_edited_time": "2022-03-01T19:05:00.000Z",\n\t"created_by": {\n\t\t"object": "user",\n\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t},\n\t"last_edited_by": {\n\t\t"object": "user",\n\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t},\n\t"has_children": false,\n\t"archived": false,\n\t"type": "heading_2",\n\t"heading_2": {\n\t\t"rich_text": [\n\t\t\t{\n\t\t\t\t"type": "text",\n\t\t\t\t"text": {\n\t\t\t\t\t"content": "Lacinato kale",\n\t\t\t\t\t"link": null\n\t\t\t\t},\n\t\t\t\t"annotations": {\n\t\t\t\t\t"bold": false,\n\t\t\t\t\t"italic": false,\n\t\t\t\t\t"strikethrough": false,\n\t\t\t\t\t"underline": false,\n\t\t\t\t\t"code": false,\n\t\t\t\t\t"color": "default"\n\t\t\t\t},\n\t\t\t\t"plain_text": "Lacinato kale",\n\t\t\t\t"href": null\n\t\t\t}\n\t\t],\n\t\t"color": "default",\n    "is_toggleable": false\n\t}\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'block';
                  };
                  id: {
                    type: 'string';
                    example: 'c02fc1d3-db8b-45c5-a222-27595b15aea7';
                  };
                  parent: {
                    type: 'object';
                    properties: {
                      type: {
                        type: 'string';
                        example: 'page_id';
                      };
                      page_id: {
                        type: 'string';
                        example: '59833787-2cf9-4fdf-8782-e53db20768a5';
                      };
                    };
                  };
                  created_time: {
                    type: 'string';
                    example: '2022-03-01T19:05:00.000Z';
                  };
                  last_edited_time: {
                    type: 'string';
                    example: '2022-03-01T19:05:00.000Z';
                  };
                  created_by: {
                    type: 'object';
                    properties: {
                      object: {
                        type: 'string';
                        example: 'user';
                      };
                      id: {
                        type: 'string';
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4';
                      };
                    };
                  };
                  last_edited_by: {
                    type: 'object';
                    properties: {
                      object: {
                        type: 'string';
                        example: 'user';
                      };
                      id: {
                        type: 'string';
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4';
                      };
                    };
                  };
                  has_children: {
                    type: 'boolean';
                    example: false;
                    default: true;
                  };
                  archived: {
                    type: 'boolean';
                    example: false;
                    default: true;
                  };
                  type: {
                    type: 'string';
                    example: 'heading_2';
                  };
                  heading_2: {
                    type: 'object';
                    properties: {
                      rich_text: {
                        type: 'array';
                        items: {
                          type: 'object';
                          properties: {
                            type: {
                              type: 'string';
                              example: 'text';
                            };
                            text: {
                              type: 'object';
                              properties: {
                                content: {
                                  type: 'string';
                                  example: 'Lacinato kale';
                                };
                                link: {};
                              };
                            };
                            annotations: {
                              type: 'object';
                              properties: {
                                bold: {
                                  type: 'boolean';
                                  example: false;
                                  default: true;
                                };
                                italic: {
                                  type: 'boolean';
                                  example: false;
                                  default: true;
                                };
                                strikethrough: {
                                  type: 'boolean';
                                  example: false;
                                  default: true;
                                };
                                underline: {
                                  type: 'boolean';
                                  example: false;
                                  default: true;
                                };
                                code: {
                                  type: 'boolean';
                                  example: false;
                                  default: true;
                                };
                                color: {
                                  type: 'string';
                                  example: 'default';
                                };
                              };
                            };
                            plain_text: {
                              type: 'string';
                              example: 'Lacinato kale';
                            };
                            href: {};
                          };
                        };
                      };
                      color: {
                        type: 'string';
                        example: 'default';
                      };
                      is_toggleable: {
                        type: 'boolean';
                        example: false;
                        default: true;
                      };
                    };
                  };
                };
              };
            };
          };
        };
        '400': {
          description: '400';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}';
                };
              };
              schema: {
                type: 'object';
                properties: {};
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript';
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const blockId = 'c02fc1d3-db8b-45c5-a222-27595b15aea7';\n  const response = await notion.blocks.retrieve({\n    block_id: blockId,\n  });\n  console.log(response);\n})();";
            name: 'Notion SDK for JavaScript';
          },
          {
            language: 'curl';
            code: "curl 'https://api.notion.com/v1/blocks/0c940186-ab70-4351-bb34-2d16f0635d49' \\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"'' \\\n  -H 'Notion-Version: 2022-06-28'";
          },
        ];
        'samples-languages': ['javascript', 'curl'];
      };
    };
    patch: {
      summary: 'Update a block';
      description: '';
      operationId: 'update-a-block';
      parameters: [
        {
          name: 'block_id';
          in: 'path';
          description: 'Identifier for a Notion block';
          schema: {
            type: 'string';
          };
          required: true;
        },
        {
          name: 'Notion-Version';
          in: 'header';
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                '{type}': {
                  type: 'object';
                  description: 'The [block object `type`](ref:block#block-object-keys) value with the properties to be updated. Currently only `text` (for supported block types) and `checked` (for `to_do` blocks) fields can be updated.';
                  properties: {};
                };
                archived: {
                  type: 'boolean';
                  description: 'Set to true to archive (delete) a block. Set to false to un-archive (restore) a block.';
                  default: true;
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n\t"object": "block",\n\t"id": "c02fc1d3-db8b-45c5-a222-27595b15aea7",\n\t"parent": {\n\t\t"type": "page_id",\n\t\t"page_id": "59833787-2cf9-4fdf-8782-e53db20768a5"\n\t},\n\t"created_time": "2022-03-01T19:05:00.000Z",\n\t"last_edited_time": "2022-07-06T19:41:00.000Z",\n\t"created_by": {\n\t\t"object": "user",\n\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t},\n\t"last_edited_by": {\n\t\t"object": "user",\n\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t},\n\t"has_children": false,\n\t"archived": false,\n\t"type": "heading_2",\n\t"heading_2": {\n\t\t"rich_text": [\n\t\t\t{\n\t\t\t\t"type": "text",\n\t\t\t\t"text": {\n\t\t\t\t\t"content": "Lacinato kale",\n\t\t\t\t\t"link": null\n\t\t\t\t},\n\t\t\t\t"annotations": {\n\t\t\t\t\t"bold": false,\n\t\t\t\t\t"italic": false,\n\t\t\t\t\t"strikethrough": false,\n\t\t\t\t\t"underline": false,\n\t\t\t\t\t"code": false,\n\t\t\t\t\t"color": "green"\n\t\t\t\t},\n\t\t\t\t"plain_text": "Lacinato kale",\n\t\t\t\t"href": null\n\t\t\t}\n\t\t],\n\t\t"color": "default",\n    "is_toggleable": false\n\t}\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'block';
                  };
                  id: {
                    type: 'string';
                    example: 'c02fc1d3-db8b-45c5-a222-27595b15aea7';
                  };
                  parent: {
                    type: 'object';
                    properties: {
                      type: {
                        type: 'string';
                        example: 'page_id';
                      };
                      page_id: {
                        type: 'string';
                        example: '59833787-2cf9-4fdf-8782-e53db20768a5';
                      };
                    };
                  };
                  created_time: {
                    type: 'string';
                    example: '2022-03-01T19:05:00.000Z';
                  };
                  last_edited_time: {
                    type: 'string';
                    example: '2022-07-06T19:41:00.000Z';
                  };
                  created_by: {
                    type: 'object';
                    properties: {
                      object: {
                        type: 'string';
                        example: 'user';
                      };
                      id: {
                        type: 'string';
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4';
                      };
                    };
                  };
                  last_edited_by: {
                    type: 'object';
                    properties: {
                      object: {
                        type: 'string';
                        example: 'user';
                      };
                      id: {
                        type: 'string';
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4';
                      };
                    };
                  };
                  has_children: {
                    type: 'boolean';
                    example: false;
                    default: true;
                  };
                  archived: {
                    type: 'boolean';
                    example: false;
                    default: true;
                  };
                  type: {
                    type: 'string';
                    example: 'heading_2';
                  };
                  heading_2: {
                    type: 'object';
                    properties: {
                      rich_text: {
                        type: 'array';
                        items: {
                          type: 'object';
                          properties: {
                            type: {
                              type: 'string';
                              example: 'text';
                            };
                            text: {
                              type: 'object';
                              properties: {
                                content: {
                                  type: 'string';
                                  example: 'Lacinato kale';
                                };
                                link: {};
                              };
                            };
                            annotations: {
                              type: 'object';
                              properties: {
                                bold: {
                                  type: 'boolean';
                                  example: false;
                                  default: true;
                                };
                                italic: {
                                  type: 'boolean';
                                  example: false;
                                  default: true;
                                };
                                strikethrough: {
                                  type: 'boolean';
                                  example: false;
                                  default: true;
                                };
                                underline: {
                                  type: 'boolean';
                                  example: false;
                                  default: true;
                                };
                                code: {
                                  type: 'boolean';
                                  example: false;
                                  default: true;
                                };
                                color: {
                                  type: 'string';
                                  example: 'green';
                                };
                              };
                            };
                            plain_text: {
                              type: 'string';
                              example: 'Lacinato kale';
                            };
                            href: {};
                          };
                        };
                      };
                      color: {
                        type: 'string';
                        example: 'default';
                      };
                      is_toggleable: {
                        type: 'boolean';
                        example: false;
                        default: true;
                      };
                    };
                  };
                };
              };
            };
          };
        };
        '400': {
          description: '400';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}';
                };
              };
              schema: {
                type: 'object';
                properties: {};
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript';
            code: 'const { Client } = require(\'@notionhq/client\');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const blockId = \'9bc30ad4-9373-46a5-84ab-0a7845ee52e6\';\n  const response = await notion.blocks.update({\n\t"block_id": blockId,\n\t"heading_2": {\n\t\t"rich_text": [\n\t\t\t{\n\t\t\t\t"text": {\n\t\t\t\t\t"content": "Lacinato kale"\n\t\t\t\t},\n\t\t\t\t"annotations": {\n\t\t\t\t\t"color": "green"\n\t\t\t\t}\n\t\t\t}\n\t\t]\n\t}\n});\n  console.log(response);\n})();';
            name: 'Notion SDK for JavaScript';
          },
          {
            language: 'curl';
            code: 'curl https://api.notion.com/v1/blocks/9bc30ad4-9373-46a5-84ab-0a7845ee52e6 \\\n  -H \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n  -H "Content-Type: application/json" \\\n  -H "Notion-Version: 2022-06-28" \\\n  -X PATCH \\\n  --data \'{\n  "to_do": {\n    "rich_text": [{ \n      "text": { "content": "Lacinato kale" } \n      }],\n    "checked": false\n  }\n}\'';
          },
        ];
        'samples-languages': ['javascript', 'curl'];
      };
    };
    delete: {
      summary: 'Delete a block';
      description: '';
      operationId: 'delete-a-block';
      parameters: [
        {
          name: 'block_id';
          in: 'path';
          description: 'Identifier for a Notion block';
          schema: {
            type: 'string';
          };
          required: true;
        },
        {
          name: 'Notion-Version';
          in: 'header';
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n\t"object": "block",\n\t"id": "7985540b-2e77-4ac6-8615-c3047e36f872",\n\t"parent": {\n\t\t"type": "page_id",\n\t\t"page_id": "59833787-2cf9-4fdf-8782-e53db20768a5"\n\t},\n\t"created_time": "2022-07-06T19:52:00.000Z",\n\t"last_edited_time": "2022-07-06T19:52:00.000Z",\n\t"created_by": {\n\t\t"object": "user",\n\t\t"id": "0c3e9826-b8f7-4f73-927d-2caaf86f1103"\n\t},\n\t"last_edited_by": {\n\t\t"object": "user",\n\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t},\n\t"has_children": false,\n\t"archived": true,\n\t"type": "paragraph",\n\t"paragraph": {\n\t\t"rich_text": [],\n\t\t"color": "default"\n\t}\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'block';
                  };
                  id: {
                    type: 'string';
                    example: '7985540b-2e77-4ac6-8615-c3047e36f872';
                  };
                  parent: {
                    type: 'object';
                    properties: {
                      type: {
                        type: 'string';
                        example: 'page_id';
                      };
                      page_id: {
                        type: 'string';
                        example: '59833787-2cf9-4fdf-8782-e53db20768a5';
                      };
                    };
                  };
                  created_time: {
                    type: 'string';
                    example: '2022-07-06T19:52:00.000Z';
                  };
                  last_edited_time: {
                    type: 'string';
                    example: '2022-07-06T19:52:00.000Z';
                  };
                  created_by: {
                    type: 'object';
                    properties: {
                      object: {
                        type: 'string';
                        example: 'user';
                      };
                      id: {
                        type: 'string';
                        example: '0c3e9826-b8f7-4f73-927d-2caaf86f1103';
                      };
                    };
                  };
                  last_edited_by: {
                    type: 'object';
                    properties: {
                      object: {
                        type: 'string';
                        example: 'user';
                      };
                      id: {
                        type: 'string';
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4';
                      };
                    };
                  };
                  has_children: {
                    type: 'boolean';
                    example: false;
                    default: true;
                  };
                  archived: {
                    type: 'boolean';
                    example: true;
                    default: true;
                  };
                  type: {
                    type: 'string';
                    example: 'paragraph';
                  };
                  paragraph: {
                    type: 'object';
                    properties: {
                      rich_text: {
                        type: 'array';
                      };
                      color: {
                        type: 'string';
                        example: 'default';
                      };
                    };
                  };
                };
              };
            };
          };
        };
        '400': {
          description: '400';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}';
                };
              };
              schema: {
                type: 'object';
                properties: {};
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript';
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const blockId = '7985540b-2e77-4ac6-8615-c3047e36f872';\n  const response = await notion.blocks.delete({\n    block_id: blockId,\n  });\n  console.log(response);\n})();";
            name: 'Notion SDK for JavaScript';
          },
          {
            language: 'curl';
            code: "curl -X DELETE 'https://api.notion.com/v1/blocks/9bc30ad4-9373-46a5-84ab-0a7845ee52e6' \\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"'' \\\n  -H 'Notion-Version: 2022-06-28'";
          },
        ];
        'samples-languages': ['javascript', 'curl'];
      };
    };
  };
  '/v1/pages/{page_id}': {
    get: {
      summary: 'Retrieve a page';
      description: '';
      operationId: 'retrieve-a-page';
      parameters: [
        {
          name: 'page_id';
          in: 'path';
          description: 'Identifier for a Notion page';
          schema: {
            type: 'string';
          };
          required: true;
        },
        {
          name: 'filter_properties';
          in: 'query';
          description: 'A list of page property value IDs associated with the page. Use this param to limit the response to a specific page property value or values. To retrieve multiple properties, specify each page property ID. For example: `?filter_properties=iAk8&filter_properties=b7dh`.';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'Notion-Version';
          in: 'header';
          required: true;
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n  "object": "page",\n  "id": "59833787-2cf9-4fdf-8782-e53db20768a5",\n  "created_time": "2022-03-01T19:05:00.000Z",\n  "last_edited_time": "2022-07-06T20:25:00.000Z",\n  "created_by": {\n    "object": "user",\n    "id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n  },\n  "last_edited_by": {\n    "object": "user",\n    "id": "0c3e9826-b8f7-4f73-927d-2caaf86f1103"\n  },\n  "cover": {\n    "type": "external",\n    "external": {\n      "url": "https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg"\n    }\n  },\n  "icon": {\n    "type": "emoji",\n    "emoji": "🥬"\n  },\n  "parent": {\n    "type": "database_id",\n    "database_id": "d9824bdc-8445-4327-be8b-5b47500af6ce"\n  },\n  "archived": false,\n  "properties": {\n    "Store availability": {\n      "id": "%3AUPp",\n      "type": "multi_select",\n      "multi_select": [\n        {\n          "id": "t|O@",\n          "name": "Gus\'s Community Market",\n          "color": "yellow"\n        },\n        {\n          "id": "{Ml\\\\",\n          "name": "Rainbow Grocery",\n          "color": "gray"\n        }\n      ]\n    },\n    "Food group": {\n      "id": "A%40Hk",\n      "type": "select",\n      "select": {\n        "id": "5e8e7e8f-432e-4d8a-8166-1821e10225fc",\n        "name": "🥬 Vegetable",\n        "color": "pink"\n      }\n    },\n    "Price": {\n      "id": "BJXS",\n      "type": "number",\n      "number": 2.5\n    },\n    "Responsible Person": {\n      "id": "Iowm",\n      "type": "people",\n      "people": [\n        {\n          "object": "user",\n          "id": "cbfe3c6e-71cf-4cd3-b6e7-02f38f371bcc",\n          "name": "Cristina Cordova",\n          "avatar_url": "https://lh6.googleusercontent.com/-rapvfCoTq5A/AAAAAAAAAAI/AAAAAAAAAAA/AKF05nDKmmUpkpFvWNBzvu9rnZEy7cbl8Q/photo.jpg",\n          "type": "person",\n          "person": {\n            "email": "cristina@makenotion.com"\n          }\n        }\n      ]\n    },\n    "Last ordered": {\n      "id": "Jsfb",\n      "type": "date",\n      "date": {\n        "start": "2022-02-22",\n        "end": null,\n        "time_zone": null\n      }\n    },\n    "Cost of next trip": {\n      "id": "WOd%3B",\n      "type": "formula",\n      "formula": {\n        "type": "number",\n        "number": 0\n      }\n    },\n    "Recipes": {\n      "id": "YfIu",\n      "type": "relation",\n      "relation": [\n        {\n          "id": "90eeeed8-2cdd-4af4-9cc1-3d24aff5f63c"\n        },\n        {\n          "id": "a2da43ee-d43c-4285-8ae2-6d811f12629a"\n        }\n      ],\n\t\t\t"has_more": false\n    },\n    "Description": {\n      "id": "_Tc_",\n      "type": "rich_text",\n      "rich_text": [\n        {\n          "type": "text",\n          "text": {\n            "content": "A dark ",\n            "link": null\n          },\n          "annotations": {\n            "bold": false,\n            "italic": false,\n            "strikethrough": false,\n            "underline": false,\n            "code": false,\n            "color": "default"\n          },\n          "plain_text": "A dark ",\n          "href": null\n        },\n        {\n          "type": "text",\n          "text": {\n            "content": "green",\n            "link": null\n          },\n          "annotations": {\n            "bold": false,\n            "italic": false,\n            "strikethrough": false,\n            "underline": false,\n            "code": false,\n            "color": "green"\n          },\n          "plain_text": "green",\n          "href": null\n        },\n        {\n          "type": "text",\n          "text": {\n            "content": " leafy vegetable",\n            "link": null\n          },\n          "annotations": {\n            "bold": false,\n            "italic": false,\n            "strikethrough": false,\n            "underline": false,\n            "code": false,\n            "color": "default"\n          },\n          "plain_text": " leafy vegetable",\n          "href": null\n        }\n      ]\n    },\n    "In stock": {\n      "id": "%60%5Bq%3F",\n      "type": "checkbox",\n      "checkbox": true\n    },\n    "Number of meals": {\n      "id": "zag~",\n      "type": "rollup",\n      "rollup": {\n        "type": "number",\n        "number": 2,\n        "function": "count"\n      }\n    },\n    "Photo": {\n      "id": "%7DF_L",\n      "type": "url",\n      "url": "https://i.insider.com/612fb23c9ef1e50018f93198?width=1136&format=jpeg"\n    },\n    "Name": {\n      "id": "title",\n      "type": "title",\n      "title": [\n        {\n          "type": "text",\n          "text": {\n            "content": "Tuscan kale",\n            "link": null\n          },\n          "annotations": {\n            "bold": false,\n            "italic": false,\n            "strikethrough": false,\n            "underline": false,\n            "code": false,\n            "color": "default"\n          },\n          "plain_text": "Tuscan kale",\n          "href": null\n        }\n      ]\n    }\n  },\n  "url": "https://www.notion.so/Tuscan-kale-598337872cf94fdf8782e53db20768a5",\n  "public_url": null\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'page';
                  };
                  id: {
                    type: 'string';
                    example: '59833787-2cf9-4fdf-8782-e53db20768a5';
                  };
                  created_time: {
                    type: 'string';
                    example: '2022-03-01T19:05:00.000Z';
                  };
                  last_edited_time: {
                    type: 'string';
                    example: '2022-07-06T20:25:00.000Z';
                  };
                  created_by: {
                    type: 'object';
                    properties: {
                      object: {
                        type: 'string';
                        example: 'user';
                      };
                      id: {
                        type: 'string';
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4';
                      };
                    };
                  };
                  last_edited_by: {
                    type: 'object';
                    properties: {
                      object: {
                        type: 'string';
                        example: 'user';
                      };
                      id: {
                        type: 'string';
                        example: '0c3e9826-b8f7-4f73-927d-2caaf86f1103';
                      };
                    };
                  };
                  cover: {
                    type: 'object';
                    properties: {
                      type: {
                        type: 'string';
                        example: 'external';
                      };
                      external: {
                        type: 'object';
                        properties: {
                          url: {
                            type: 'string';
                            example: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg';
                          };
                        };
                      };
                    };
                  };
                  icon: {
                    type: 'object';
                    properties: {
                      type: {
                        type: 'string';
                        example: 'emoji';
                      };
                      emoji: {
                        type: 'string';
                        example: '🥬';
                      };
                    };
                  };
                  parent: {
                    type: 'object';
                    properties: {
                      type: {
                        type: 'string';
                        example: 'database_id';
                      };
                      database_id: {
                        type: 'string';
                        example: 'd9824bdc-8445-4327-be8b-5b47500af6ce';
                      };
                    };
                  };
                  archived: {
                    type: 'boolean';
                    example: false;
                    default: true;
                  };
                  properties: {
                    type: 'object';
                    properties: {
                      'Store availability': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: '%3AUPp';
                          };
                          type: {
                            type: 'string';
                            example: 'multi_select';
                          };
                          multi_select: {
                            type: 'array';
                            items: {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: 't|O@';
                                };
                                name: {
                                  type: 'string';
                                  example: "Gus's Community Market";
                                };
                                color: {
                                  type: 'string';
                                  example: 'yellow';
                                };
                              };
                            };
                          };
                        };
                      };
                      'Food group': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'A%40Hk';
                          };
                          type: {
                            type: 'string';
                            example: 'select';
                          };
                          select: {
                            type: 'object';
                            properties: {
                              id: {
                                type: 'string';
                                example: '5e8e7e8f-432e-4d8a-8166-1821e10225fc';
                              };
                              name: {
                                type: 'string';
                                example: '🥬 Vegetable';
                              };
                              color: {
                                type: 'string';
                                example: 'pink';
                              };
                            };
                          };
                        };
                      };
                      Price: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'BJXS';
                          };
                          type: {
                            type: 'string';
                            example: 'number';
                          };
                          number: {
                            type: 'number';
                            example: 2.5;
                            default: 0;
                          };
                        };
                      };
                      'Responsible Person': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'Iowm';
                          };
                          type: {
                            type: 'string';
                            example: 'people';
                          };
                          people: {
                            type: 'array';
                            items: {
                              type: 'object';
                              properties: {
                                object: {
                                  type: 'string';
                                  example: 'user';
                                };
                                id: {
                                  type: 'string';
                                  example: 'cbfe3c6e-71cf-4cd3-b6e7-02f38f371bcc';
                                };
                                name: {
                                  type: 'string';
                                  example: 'Cristina Cordova';
                                };
                                avatar_url: {
                                  type: 'string';
                                  example: 'https://lh6.googleusercontent.com/-rapvfCoTq5A/AAAAAAAAAAI/AAAAAAAAAAA/AKF05nDKmmUpkpFvWNBzvu9rnZEy7cbl8Q/photo.jpg';
                                };
                                type: {
                                  type: 'string';
                                  example: 'person';
                                };
                                person: {
                                  type: 'object';
                                  properties: {
                                    email: {
                                      type: 'string';
                                      example: 'cristina@makenotion.com';
                                    };
                                  };
                                };
                              };
                            };
                          };
                        };
                      };
                      'Last ordered': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'Jsfb';
                          };
                          type: {
                            type: 'string';
                            example: 'date';
                          };
                          date: {
                            type: 'object';
                            properties: {
                              start: {
                                type: 'string';
                                example: '2022-02-22';
                              };
                              end: {};
                              time_zone: {};
                            };
                          };
                        };
                      };
                      'Cost of next trip': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'WOd%3B';
                          };
                          type: {
                            type: 'string';
                            example: 'formula';
                          };
                          formula: {
                            type: 'object';
                            properties: {
                              type: {
                                type: 'string';
                                example: 'number';
                              };
                              number: {
                                type: 'integer';
                                example: 0;
                                default: 0;
                              };
                            };
                          };
                        };
                      };
                      Recipes: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'YfIu';
                          };
                          type: {
                            type: 'string';
                            example: 'relation';
                          };
                          relation: {
                            type: 'array';
                            items: {
                              type: 'object';
                              properties: {
                                id: {
                                  type: 'string';
                                  example: '90eeeed8-2cdd-4af4-9cc1-3d24aff5f63c';
                                };
                              };
                            };
                          };
                          has_more: {
                            type: 'boolean';
                            example: false;
                            default: true;
                          };
                        };
                      };
                      Description: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: '_Tc_';
                          };
                          type: {
                            type: 'string';
                            example: 'rich_text';
                          };
                          rich_text: {
                            type: 'array';
                            items: {
                              type: 'object';
                              properties: {
                                type: {
                                  type: 'string';
                                  example: 'text';
                                };
                                text: {
                                  type: 'object';
                                  properties: {
                                    content: {
                                      type: 'string';
                                      example: 'A dark ';
                                    };
                                    link: {};
                                  };
                                };
                                annotations: {
                                  type: 'object';
                                  properties: {
                                    bold: {
                                      type: 'boolean';
                                      example: false;
                                      default: true;
                                    };
                                    italic: {
                                      type: 'boolean';
                                      example: false;
                                      default: true;
                                    };
                                    strikethrough: {
                                      type: 'boolean';
                                      example: false;
                                      default: true;
                                    };
                                    underline: {
                                      type: 'boolean';
                                      example: false;
                                      default: true;
                                    };
                                    code: {
                                      type: 'boolean';
                                      example: false;
                                      default: true;
                                    };
                                    color: {
                                      type: 'string';
                                      example: 'default';
                                    };
                                  };
                                };
                                plain_text: {
                                  type: 'string';
                                  example: 'A dark ';
                                };
                                href: {};
                              };
                            };
                          };
                        };
                      };
                      'In stock': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: '%60%5Bq%3F';
                          };
                          type: {
                            type: 'string';
                            example: 'checkbox';
                          };
                          checkbox: {
                            type: 'boolean';
                            example: true;
                            default: true;
                          };
                        };
                      };
                      'Number of meals': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'zag~';
                          };
                          type: {
                            type: 'string';
                            example: 'rollup';
                          };
                          rollup: {
                            type: 'object';
                            properties: {
                              type: {
                                type: 'string';
                                example: 'number';
                              };
                              number: {
                                type: 'integer';
                                example: 2;
                                default: 0;
                              };
                              function: {
                                type: 'string';
                                example: 'count';
                              };
                            };
                          };
                        };
                      };
                      Photo: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: '%7DF_L';
                          };
                          type: {
                            type: 'string';
                            example: 'url';
                          };
                          url: {
                            type: 'string';
                            example: 'https://i.insider.com/612fb23c9ef1e50018f93198?width=1136&format=jpeg';
                          };
                        };
                      };
                      Name: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'title';
                          };
                          type: {
                            type: 'string';
                            example: 'title';
                          };
                          title: {
                            type: 'array';
                            items: {
                              type: 'object';
                              properties: {
                                type: {
                                  type: 'string';
                                  example: 'text';
                                };
                                text: {
                                  type: 'object';
                                  properties: {
                                    content: {
                                      type: 'string';
                                      example: 'Tuscan kale';
                                    };
                                    link: {};
                                  };
                                };
                                annotations: {
                                  type: 'object';
                                  properties: {
                                    bold: {
                                      type: 'boolean';
                                      example: false;
                                      default: true;
                                    };
                                    italic: {
                                      type: 'boolean';
                                      example: false;
                                      default: true;
                                    };
                                    strikethrough: {
                                      type: 'boolean';
                                      example: false;
                                      default: true;
                                    };
                                    underline: {
                                      type: 'boolean';
                                      example: false;
                                      default: true;
                                    };
                                    code: {
                                      type: 'boolean';
                                      example: false;
                                      default: true;
                                    };
                                    color: {
                                      type: 'string';
                                      example: 'default';
                                    };
                                  };
                                };
                                plain_text: {
                                  type: 'string';
                                  example: 'Tuscan kale';
                                };
                                href: {};
                              };
                            };
                          };
                        };
                      };
                    };
                  };
                  url: {
                    type: 'string';
                    example: 'https://www.notion.so/Tuscan-kale-598337872cf94fdf8782e53db20768a5';
                  };
                  public_url: {};
                };
              };
            };
          };
        };
        '400': {
          description: '400';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}';
                };
              };
              schema: {
                type: 'object';
                properties: {};
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript';
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const pageId = '59833787-2cf9-4fdf-8782-e53db20768a5';\n  const response = await notion.pages.retrieve({ page_id: pageId });\n  console.log(response);\n})();";
            name: 'Notion SDK for JavaScript';
          },
          {
            language: 'curl';
            code: "curl 'https://api.notion.com/v1/pages/b55c9c91-384d-452b-81db-d1ef79372b75' \\\n  -H 'Notion-Version: 2022-06-28' \\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"''";
          },
        ];
        'samples-languages': ['javascript', 'curl'];
      };
    };
    patch: {
      summary: 'Update page properties';
      description: '';
      operationId: 'patch-page';
      parameters: [
        {
          name: 'page_id';
          in: 'path';
          description: 'The identifier for the Notion page to be updated.';
          schema: {
            type: 'string';
          };
          required: true;
        },
        {
          name: 'Notion-Version';
          in: 'header';
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                properties: {
                  type: 'string';
                  description: 'The property values to update for the page. The keys are the names or IDs of the property and the values are property values. If a page property ID is not included, then it is not changed.';
                  format: 'json';
                };
                in_trash: {
                  type: 'boolean';
                  description: 'Set to true to delete a block. Set to false to restore a block.';
                  default: false;
                };
                icon: {
                  type: 'string';
                  description: 'A page icon for the page. Supported types are [external file object](https://developers.notion.com/reference/file-object) or [emoji object](https://developers.notion.com/reference/emoji-object).';
                  format: 'json';
                };
                cover: {
                  type: 'string';
                  description: 'A cover image for the page. Only [external file objects](https://developers.notion.com/reference/file-object) are supported.';
                  format: 'json';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n\t"object": "page",\n\t"id": "59833787-2cf9-4fdf-8782-e53db20768a5",\n\t"created_time": "2022-03-01T19:05:00.000Z",\n\t"last_edited_time": "2022-07-06T19:16:00.000Z",\n\t"created_by": {\n\t\t"object": "user",\n\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t},\n\t"last_edited_by": {\n\t\t"object": "user",\n\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t},\n\t"cover": {\n\t\t"type": "external",\n\t\t"external": {\n\t\t\t"url": "https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg"\n\t\t}\n\t},\n\t"icon": {\n\t\t"type": "emoji",\n\t\t"emoji": "🥬"\n\t},\n\t"parent": {\n\t\t"type": "database_id",\n\t\t"database_id": "d9824bdc-8445-4327-be8b-5b47500af6ce"\n\t},\n\t"archived": false,\n\t"properties": {\n\t\t"Store availability": {\n\t\t\t"id": "%3AUPp"\n\t\t},\n\t\t"Food group": {\n\t\t\t"id": "A%40Hk"\n\t\t},\n\t\t"Price": {\n\t\t\t"id": "BJXS"\n\t\t},\n\t\t"Responsible Person": {\n\t\t\t"id": "Iowm"\n\t\t},\n\t\t"Last ordered": {\n\t\t\t"id": "Jsfb"\n\t\t},\n\t\t"Cost of next trip": {\n\t\t\t"id": "WOd%3B"\n\t\t},\n\t\t"Recipes": {\n\t\t\t"id": "YfIu"\n\t\t},\n\t\t"Description": {\n\t\t\t"id": "_Tc_"\n\t\t},\n\t\t"In stock": {\n\t\t\t"id": "%60%5Bq%3F"\n\t\t},\n\t\t"Number of meals": {\n\t\t\t"id": "zag~"\n\t\t},\n\t\t"Photo": {\n\t\t\t"id": "%7DF_L"\n\t\t},\n\t\t"Name": {\n\t\t\t"id": "title"\n\t\t}\n\t},\n\t"url": "https://www.notion.so/Tuscan-Kale-598337872cf94fdf8782e53db20768a5"\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'page';
                  };
                  id: {
                    type: 'string';
                    example: '59833787-2cf9-4fdf-8782-e53db20768a5';
                  };
                  created_time: {
                    type: 'string';
                    example: '2022-03-01T19:05:00.000Z';
                  };
                  last_edited_time: {
                    type: 'string';
                    example: '2022-07-06T19:16:00.000Z';
                  };
                  created_by: {
                    type: 'object';
                    properties: {
                      object: {
                        type: 'string';
                        example: 'user';
                      };
                      id: {
                        type: 'string';
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4';
                      };
                    };
                  };
                  last_edited_by: {
                    type: 'object';
                    properties: {
                      object: {
                        type: 'string';
                        example: 'user';
                      };
                      id: {
                        type: 'string';
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4';
                      };
                    };
                  };
                  cover: {
                    type: 'object';
                    properties: {
                      type: {
                        type: 'string';
                        example: 'external';
                      };
                      external: {
                        type: 'object';
                        properties: {
                          url: {
                            type: 'string';
                            example: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg';
                          };
                        };
                      };
                    };
                  };
                  icon: {
                    type: 'object';
                    properties: {
                      type: {
                        type: 'string';
                        example: 'emoji';
                      };
                      emoji: {
                        type: 'string';
                        example: '🥬';
                      };
                    };
                  };
                  parent: {
                    type: 'object';
                    properties: {
                      type: {
                        type: 'string';
                        example: 'database_id';
                      };
                      database_id: {
                        type: 'string';
                        example: 'd9824bdc-8445-4327-be8b-5b47500af6ce';
                      };
                    };
                  };
                  archived: {
                    type: 'boolean';
                    example: false;
                    default: true;
                  };
                  properties: {
                    type: 'object';
                    properties: {
                      'Store availability': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: '%3AUPp';
                          };
                        };
                      };
                      'Food group': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'A%40Hk';
                          };
                        };
                      };
                      Price: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'BJXS';
                          };
                        };
                      };
                      'Responsible Person': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'Iowm';
                          };
                        };
                      };
                      'Last ordered': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'Jsfb';
                          };
                        };
                      };
                      'Cost of next trip': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'WOd%3B';
                          };
                        };
                      };
                      Recipes: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'YfIu';
                          };
                        };
                      };
                      Description: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: '_Tc_';
                          };
                        };
                      };
                      'In stock': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: '%60%5Bq%3F';
                          };
                        };
                      };
                      'Number of meals': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'zag~';
                          };
                        };
                      };
                      Photo: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: '%7DF_L';
                          };
                        };
                      };
                      Name: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'title';
                          };
                        };
                      };
                    };
                  };
                  url: {
                    type: 'string';
                    example: 'https://www.notion.so/Tuscan-Kale-598337872cf94fdf8782e53db20768a5';
                  };
                };
              };
            };
          };
        };
        '400': {
          description: '400';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}';
                };
                'has_more is set to true for a page property': {
                  value: '{\n  "object": "error",\n  "status": 400,\n  "code": "invalid_request",\n  "message": ”Can\'t update page because has_more is set to true for page property \'${invalidPageProperty}’”\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {};
              };
            };
          };
        };
        '404': {
          description: '404';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n    "object": "error",\n    "status": 404,\n    "code": "object_not_found",\n    "message": "Could not find page with ID: 4cc3b486-0b48-4cfe-8ce9-67c47100eb6a. Make sure the relevant pages and databases are shared with your integration."\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'error';
                  };
                  status: {
                    type: 'integer';
                    example: 404;
                    default: 0;
                  };
                  code: {
                    type: 'string';
                    example: 'object_not_found';
                  };
                  message: {
                    type: 'string';
                    example: 'Could not find page with ID: 4cc3b486-0b48-4cfe-8ce9-67c47100eb6a. Make sure the relevant pages and databases are shared with your integration.';
                  };
                };
              };
            };
          };
        };
        '429': {
          description: '429';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n  "object": "error",\n  "status": 429,\n  "code": "rate_limited",\n  "message": "You have been rate limited. Please try again in a few minutes."\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'error';
                  };
                  status: {
                    type: 'integer';
                    example: 429;
                    default: 0;
                  };
                  code: {
                    type: 'string';
                    example: 'rate_limited';
                  };
                  message: {
                    type: 'string';
                    example: 'You have been rate limited. Please try again in a few minutes.';
                  };
                };
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript';
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const pageId = '59833787-2cf9-4fdf-8782-e53db20768a5';\n  const response = await notion.pages.update({\n    page_id: pageId,\n    properties: {\n      'In stock': {\n        checkbox: true,\n      },\n    },\n  });\n  console.log(response);\n})();";
            name: 'Notion SDK for JavaScript';
          },
          {
            language: 'curl';
            code: 'curl https://api.notion.com/v1/pages/60bdc8bd-3880-44b8-a9cd-8a145b3ffbd7 \\\n  -H \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n  -H "Content-Type: application/json" \\\n  -H "Notion-Version: 2022-06-28" \\\n  -X PATCH \\\n\t--data \'{\n  "properties": {\n    "In stock": { "checkbox": true }\n  }\n}\'';
          },
        ];
        'samples-languages': ['javascript', 'curl'];
      };
    };
  };
  '/v1/pages': {
    post: {
      summary: 'Create a page';
      description: '';
      operationId: 'post-page';
      parameters: [
        {
          name: 'Notion-Version';
          in: 'header';
          required: true;
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['parent', 'properties'];
              properties: {
                parent: {
                  type: 'string';
                  description: 'The parent page or database where the new page is inserted, represented as a JSON object with a `page_id` or `database_id` key, and the corresponding ID.';
                  format: 'json';
                };
                properties: {
                  type: 'string';
                  description: 'The values of the page’s properties. If the `parent` is a database, then the schema must match the parent database’s properties. If the `parent` is a page, then the only valid object key is `title`.';
                  format: 'json';
                };
                children: {
                  type: 'array';
                  description: 'The content to be rendered on the new page, represented as an array of [block objects](https://developers.notion.com/reference/block).';
                  items: {
                    type: 'string';
                  };
                };
                icon: {
                  type: 'string';
                  description: 'The icon of the new page. Either an [emoji object](https://developers.notion.com/reference/emoji-object) or an [external file object](https://developers.notion.com/reference/file-object)..';
                  format: 'json';
                };
                cover: {
                  type: 'string';
                  description: 'The cover image of the new page, represented as a [file object](https://developers.notion.com/reference/file-object).';
                  format: 'json';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n  "object": "page",\n  "id": "59833787-2cf9-4fdf-8782-e53db20768a5",\n  "created_time": "2022-03-01T19:05:00.000Z",\n  "last_edited_time": "2022-07-06T19:16:00.000Z",\n  "created_by": {\n    "object": "user",\n    "id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n  },\n  "last_edited_by": {\n    "object": "user",\n    "id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n  },\n  "cover": {\n    "type": "external",\n    "external": {\n      "url": "https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg"\n    }\n  },\n  "icon": {\n    "type": "emoji",\n    "emoji": "🥬"\n  },\n  "parent": {\n    "type": "database_id",\n    "database_id": "d9824bdc-8445-4327-be8b-5b47500af6ce"\n  },\n  "archived": false,\n  "properties": {\n    "Store availability": {\n      "id": "%3AUPp"\n    },\n    "Food group": {\n      "id": "A%40Hk"\n    },\n    "Price": {\n      "id": "BJXS"\n    },\n    "Responsible Person": {\n      "id": "Iowm"\n    },\n    "Last ordered": {\n      "id": "Jsfb"\n    },\n    "Cost of next trip": {\n      "id": "WOd%3B"\n    },\n    "Recipes": {\n      "id": "YfIu"\n    },\n    "Description": {\n      "id": "_Tc_"\n    },\n    "In stock": {\n      "id": "%60%5Bq%3F"\n    },\n    "Number of meals": {\n      "id": "zag~"\n    },\n    "Photo": {\n      "id": "%7DF_L"\n    },\n    "Name": {\n      "id": "title"\n    }\n  },\n  "url": "https://www.notion.so/Tuscan-Kale-598337872cf94fdf8782e53db20768a5"\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'page';
                  };
                  id: {
                    type: 'string';
                    example: '59833787-2cf9-4fdf-8782-e53db20768a5';
                  };
                  created_time: {
                    type: 'string';
                    example: '2022-03-01T19:05:00.000Z';
                  };
                  last_edited_time: {
                    type: 'string';
                    example: '2022-07-06T19:16:00.000Z';
                  };
                  created_by: {
                    type: 'object';
                    properties: {
                      object: {
                        type: 'string';
                        example: 'user';
                      };
                      id: {
                        type: 'string';
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4';
                      };
                    };
                  };
                  last_edited_by: {
                    type: 'object';
                    properties: {
                      object: {
                        type: 'string';
                        example: 'user';
                      };
                      id: {
                        type: 'string';
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4';
                      };
                    };
                  };
                  cover: {
                    type: 'object';
                    properties: {
                      type: {
                        type: 'string';
                        example: 'external';
                      };
                      external: {
                        type: 'object';
                        properties: {
                          url: {
                            type: 'string';
                            example: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg';
                          };
                        };
                      };
                    };
                  };
                  icon: {
                    type: 'object';
                    properties: {
                      type: {
                        type: 'string';
                        example: 'emoji';
                      };
                      emoji: {
                        type: 'string';
                        example: '🥬';
                      };
                    };
                  };
                  parent: {
                    type: 'object';
                    properties: {
                      type: {
                        type: 'string';
                        example: 'database_id';
                      };
                      database_id: {
                        type: 'string';
                        example: 'd9824bdc-8445-4327-be8b-5b47500af6ce';
                      };
                    };
                  };
                  archived: {
                    type: 'boolean';
                    example: false;
                    default: true;
                  };
                  properties: {
                    type: 'object';
                    properties: {
                      'Store availability': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: '%3AUPp';
                          };
                        };
                      };
                      'Food group': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'A%40Hk';
                          };
                        };
                      };
                      Price: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'BJXS';
                          };
                        };
                      };
                      'Responsible Person': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'Iowm';
                          };
                        };
                      };
                      'Last ordered': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'Jsfb';
                          };
                        };
                      };
                      'Cost of next trip': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'WOd%3B';
                          };
                        };
                      };
                      Recipes: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'YfIu';
                          };
                        };
                      };
                      Description: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: '_Tc_';
                          };
                        };
                      };
                      'In stock': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: '%60%5Bq%3F';
                          };
                        };
                      };
                      'Number of meals': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'zag~';
                          };
                        };
                      };
                      Photo: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: '%7DF_L';
                          };
                        };
                      };
                      Name: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'title';
                          };
                        };
                      };
                    };
                  };
                  url: {
                    type: 'string';
                    example: 'https://www.notion.so/Tuscan-Kale-598337872cf94fdf8782e53db20768a5';
                  };
                };
              };
            };
          };
        };
        '400': {
          description: '400';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}';
                };
              };
              schema: {
                type: 'object';
                properties: {};
              };
            };
          };
        };
        '404': {
          description: '404';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n    "object": "error",\n    "status": 404,\n    "code": "object_not_found",\n    "message": "Could not find page with ID: 4cc3b486-0b48-4cfe-8ce9-67c47100eb6a. Make sure the relevant pages and databases are shared with your integration."\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'error';
                  };
                  status: {
                    type: 'integer';
                    example: 404;
                    default: 0;
                  };
                  code: {
                    type: 'string';
                    example: 'object_not_found';
                  };
                  message: {
                    type: 'string';
                    example: 'Could not find page with ID: 4cc3b486-0b48-4cfe-8ce9-67c47100eb6a. Make sure the relevant pages and databases are shared with your integration.';
                  };
                };
              };
            };
          };
        };
        '429': {
          description: '429';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n  "object": "error",\n  "status": 429,\n  "code": "rate_limited",\n  "message": "You have been rate limited. Please try again in a few minutes."\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'error';
                  };
                  status: {
                    type: 'integer';
                    example: 429;
                    default: 0;
                  };
                  code: {
                    type: 'string';
                    example: 'rate_limited';
                  };
                  message: {
                    type: 'string';
                    example: 'You have been rate limited. Please try again in a few minutes.';
                  };
                };
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript';
            code: 'const { Client } = require(\'@notionhq/client\');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const response = await notion.pages.create({\n    "cover": {\n        "type": "external",\n        "external": {\n            "url": "https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg"\n        }\n    },\n    "icon": {\n        "type": "emoji",\n        "emoji": "🥬"\n    },\n    "parent": {\n        "type": "database_id",\n        "database_id": "d9824bdc-8445-4327-be8b-5b47500af6ce"\n    },\n    "properties": {\n        "Name": {\n            "title": [\n                {\n                    "text": {\n                        "content": "Tuscan kale"\n                    }\n                }\n            ]\n        },\n        "Description": {\n            "rich_text": [\n                {\n                    "text": {\n                        "content": "A dark green leafy vegetable"\n                    }\n                }\n            ]\n        },\n        "Food group": {\n            "select": {\n                "name": "🥬 Vegetable"\n            }\n        }\n    },\n    "children": [\n        {\n            "object": "block",\n            "heading_2": {\n                "rich_text": [\n                    {\n                        "text": {\n                            "content": "Lacinato kale"\n                        }\n                    }\n                ]\n            }\n        },\n        {\n            "object": "block",\n            "paragraph": {\n                "rich_text": [\n                    {\n                        "text": {\n                            "content": "Lacinato kale is a variety of kale with a long tradition in Italian cuisine, especially that of Tuscany. It is also known as Tuscan kale, Italian kale, dinosaur kale, kale, flat back kale, palm tree kale, or black Tuscan palm.",\n                            "link": {\n                                "url": "https://en.wikipedia.org/wiki/Lacinato_kale"\n                            }\n                        },\n                        "href": "https://en.wikipedia.org/wiki/Lacinato_kale"\n                    }\n                ],\n                "color": "default"\n            }\n        }\n    ]\n});\n  console.log(response);\n})();';
            name: 'Notion SDK for JavaScript';
          },
          {
            language: 'curl';
            code: 'curl \'https://api.notion.com/v1/pages\' \\\n  -H \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n  -H "Content-Type: application/json" \\\n  -H "Notion-Version: 2022-06-28" \\\n  --data \'{\n\t"parent": { "database_id": "d9824bdc84454327be8b5b47500af6ce" },\n  "icon": {\n  \t"emoji": "🥬"\n  },\n\t"cover": {\n\t\t"external": {\n\t\t\t"url": "https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg"\n\t\t}\n\t},\n\t"properties": {\n\t\t"Name": {\n\t\t\t"title": [\n\t\t\t\t{\n\t\t\t\t\t"text": {\n\t\t\t\t\t\t"content": "Tuscan Kale"\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t]\n\t\t},\n\t\t"Description": {\n\t\t\t"rich_text": [\n\t\t\t\t{\n\t\t\t\t\t"text": {\n\t\t\t\t\t\t"content": "A dark green leafy vegetable"\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t]\n\t\t},\n\t\t"Food group": {\n\t\t\t"select": {\n\t\t\t\t"name": "Vegetable"\n\t\t\t}\n\t\t},\n\t\t"Price": { "number": 2.5 }\n\t},\n\t"children": [\n\t\t{\n\t\t\t"object": "block",\n\t\t\t"type": "heading_2",\n\t\t\t"heading_2": {\n\t\t\t\t"rich_text": [{ "type": "text", "text": { "content": "Lacinato kale" } }]\n\t\t\t}\n\t\t},\n\t\t{\n\t\t\t"object": "block",\n\t\t\t"type": "paragraph",\n\t\t\t"paragraph": {\n\t\t\t\t"rich_text": [\n\t\t\t\t\t{\n\t\t\t\t\t\t"type": "text",\n\t\t\t\t\t\t"text": {\n\t\t\t\t\t\t\t"content": "Lacinato kale is a variety of kale with a long tradition in Italian cuisine, especially that of Tuscany. It is also known as Tuscan kale, Italian kale, dinosaur kale, kale, flat back kale, palm tree kale, or black Tuscan palm.",\n\t\t\t\t\t\t\t"link": { "url": "https://en.wikipedia.org/wiki/Lacinato_kale" }\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t]\n\t\t\t}\n\t\t}\n\t]\n}\'';
          },
        ];
        'samples-languages': ['javascript', 'curl'];
      };
    };
  };
  '/v1/databases': {
    post: {
      summary: 'Create a database';
      description: '';
      operationId: 'create-a-database';
      parameters: [
        {
          name: 'Notion-Version';
          in: 'header';
          required: true;
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['parent', 'properties'];
              properties: {
                parent: {
                  type: 'string';
                  description: 'A [page parent](/reference/database#page-parent)';
                  format: 'json';
                };
                title: {
                  type: 'array';
                  description: 'Title of database as it appears in Notion. An array of [rich text objects](ref:rich-text).';
                };
                properties: {
                  type: 'string';
                  description: 'Property schema of database. The keys are the names of properties as they appear in Notion and the values are [property schema objects](https://developers.notion.com/reference/property-schema-object).';
                  format: 'json';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n    "object": "database",\n    "id": "bc1211ca-e3f1-4939-ae34-5260b16f627c",\n    "created_time": "2021-07-08T23:50:00.000Z",\n    "last_edited_time": "2021-07-08T23:50:00.000Z",\n    "icon": {\n        "type": "emoji",\n        "emoji": "🎉"\n    },\n    "cover": {\n        "type": "external",\n        "external": {\n            "url": "https://website.domain/images/image.png"\n        }\n    },\n    "url": "https://www.notion.so/bc1211cae3f14939ae34260b16f627c",\n    "title": [\n        {\n            "type": "text",\n            "text": {\n                "content": "Grocery List",\n                "link": null\n            },\n            "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n            },\n            "plain_text": "Grocery List",\n            "href": null\n        }\n    ],\n    "properties": {\n        "+1": {\n            "id": "Wp%3DC",\n            "name": "+1",\n            "type": "people",\n            "people": {}\n        },\n        "In stock": {\n            "id": "fk%5EY",\n            "name": "In stock",\n            "type": "checkbox",\n            "checkbox": {}\n        },\n        "Price": {\n            "id": "evWq",\n            "name": "Price",\n            "type": "number",\n            "number": {\n                "format": "dollar"\n            }\n        },\n        "Description": {\n            "id": "V}lX",\n            "name": "Description",\n            "type": "rich_text",\n            "rich_text": {}\n        },\n        "Last ordered": {\n            "id": "eVnV",\n            "name": "Last ordered",\n            "type": "date",\n            "date": {}\n        },\n        "Meals": {\n            "id": "%7DWA~",\n            "name": "Meals",\n            "type": "relation",\n            "relation": {\n                "database_id": "668d797c-76fa-4934-9b05-ad288df2d136",\n                "single_property": {}\n            }\n        },\n        "Number of meals": {\n            "id": "Z\\\\Eh",\n            "name": "Number of meals",\n            "type": "rollup",\n            "rollup": {\n                "rollup_property_name": "Name",\n                "relation_property_name": "Meals",\n                "rollup_property_id": "title",\n                "relation_property_id": "mxp^",\n                "function": "count"\n            }\n        },\n        "Store availability": {\n            "id": "s}Kq",\n            "name": "Store availability",\n            "type": "multi_select",\n            "multi_select": {\n                "options": [\n                    {\n                        "id": "cb79b393-d1c1-4528-b517-c450859de766",\n                        "name": "Duc Loi Market",\n                        "color": "blue"\n                    },\n                    {\n                        "id": "58aae162-75d4-403b-a793-3bc7308e4cd2",\n                        "name": "Rainbow Grocery",\n                        "color": "gray"\n                    },\n                    {\n                        "id": "22d0f199-babc-44ff-bd80-a9eae3e3fcbf",\n                        "name": "Nijiya Market",\n                        "color": "purple"\n                    },\n                    {\n                        "id": "0d069987-ffb0-4347-bde2-8e4068003dbc",\n                        "name": "Gus\'s Community Market",\n                        "color": "yellow"\n                    }\n                ]\n            }\n        },\n        "Photo": {\n            "id": "yfiK",\n            "name": "Photo",\n            "type": "files",\n            "files": {}\n        },\n        "Food group": {\n            "id": "CM%3EH",\n            "name": "Food group",\n            "type": "select",\n            "select": {\n                "options": [\n                    {\n                        "id": "6d4523fa-88cb-4ffd-9364-1e39d0f4e566",\n                        "name": "🥦Vegetable",\n                        "color": "green"\n                    },\n                    {\n                        "id": "268d7e75-de8f-4c4b-8b9d-de0f97021833",\n                        "name": "🍎Fruit",\n                        "color": "red"\n                    },\n                    {\n                        "id": "1b234a00-dc97-489c-b987-829264cfdfef",\n                        "name": "💪Protein",\n                        "color": "yellow"\n                    }\n                ]\n            }\n        },\n        "Name": {\n            "id": "title",\n            "name": "Name",\n            "type": "title",\n            "title": {}\n        }\n    },\n    "parent": {\n        "type": "page_id",\n        "page_id": "98ad959b-2b6a-4774-80ee-00246fb0ea9b"\n    },\n    "archived": false\n}{\n    "object": "database",\n    "id": "bc1211ca-e3f1-4939-ae34-5260b16f627c",\n    "created_time": "2021-07-08T23:50:00.000Z",\n    "last_edited_time": "2021-07-08T23:50:00.000Z",\n    "icon": {\n        "type": "emoji",\n        "emoji": "🎉"\n    },\n    "cover": {\n        "type": "external",\n        "external": {\n            "url": "https://website.domain/images/image.png"\n        }\n    },\n    "url": "https://www.notion.so/bc1211cae3f14939ae34260b16f627c",\n    "title": [\n        {\n            "type": "text",\n            "text": {\n                "content": "Grocery List",\n                "link": null\n            },\n            "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n            },\n            "plain_text": "Grocery List",\n            "href": null\n        }\n    ],\n    "properties": {\n        "+1": {\n            "id": "Wp%3DC",\n            "name": "+1",\n            "type": "people",\n            "people": {}\n        },\n        "In stock": {\n            "id": "fk%5EY",\n            "name": "In stock",\n            "type": "checkbox",\n            "checkbox": {}\n        },\n        "Price": {\n            "id": "evWq",\n            "name": "Price",\n            "type": "number",\n            "number": {\n                "format": "dollar"\n            }\n        },\n        "Description": {\n            "id": "V}lX",\n            "name": "Description",\n            "type": "rich_text",\n            "rich_text": {}\n        },\n        "Last ordered": {\n            "id": "eVnV",\n            "name": "Last ordered",\n            "type": "date",\n            "date": {}\n        },\n        "Meals": {\n            "id": "%7DWA~",\n            "name": "Meals",\n            "type": "relation",\n            "relation": {\n                "database_id": "668d797c-76fa-4934-9b05-ad288df2d136",\n                "synced_property_name": "Related to Grocery List (Meals)"\n            }\n        },\n        "Number of meals": {\n            "id": "Z\\\\Eh",\n            "name": "Number of meals",\n            "type": "rollup",\n            "rollup": {\n                "rollup_property_name": "Name",\n                "relation_property_name": "Meals",\n                "rollup_property_id": "title",\n                "relation_property_id": "mxp^",\n                "function": "count"\n            }\n        },\n        "Store availability": {\n            "id": "s}Kq",\n            "name": "Store availability",\n            "type": "multi_select",\n            "multi_select": {\n                "options": [\n                    {\n                        "id": "cb79b393-d1c1-4528-b517-c450859de766",\n                        "name": "Duc Loi Market",\n                        "color": "blue"\n                    },\n                    {\n                        "id": "58aae162-75d4-403b-a793-3bc7308e4cd2",\n                        "name": "Rainbow Grocery",\n                        "color": "gray"\n                    },\n                    {\n                        "id": "22d0f199-babc-44ff-bd80-a9eae3e3fcbf",\n                        "name": "Nijiya Market",\n                        "color": "purple"\n                    },\n                    {\n                        "id": "0d069987-ffb0-4347-bde2-8e4068003dbc",\n                        "name": "Gus\'s Community Market",\n                        "color": "yellow"\n                    }\n                ]\n            }\n        },\n        "Photo": {\n            "id": "yfiK",\n            "name": "Photo",\n            "type": "files",\n            "files": {}\n        },\n        "Food group": {\n            "id": "CM%3EH",\n            "name": "Food group",\n            "type": "select",\n            "select": {\n                "options": [\n                    {\n                        "id": "6d4523fa-88cb-4ffd-9364-1e39d0f4e566",\n                        "name": "🥦Vegetable",\n                        "color": "green"\n                    },\n                    {\n                        "id": "268d7e75-de8f-4c4b-8b9d-de0f97021833",\n                        "name": "🍎Fruit",\n                        "color": "red"\n                    },\n                    {\n                        "id": "1b234a00-dc97-489c-b987-829264cfdfef",\n                        "name": "💪Protein",\n                        "color": "yellow"\n                    }\n                ]\n            }\n        },\n        "Name": {\n            "id": "title",\n            "name": "Name",\n            "type": "title",\n            "title": {}\n        }\n    },\n    "parent": {\n        "type": "page_id",\n        "page_id": "98ad959b-2b6a-4774-80ee-00246fb0ea9b"\n    },\n    "archived": false,\n    "is_inline": false\n}';
                };
              };
            };
          };
        };
        '400': {
          description: '400';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}';
                };
              };
              schema: {
                type: 'object';
                properties: {};
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'curl';
            code: 'curl --location --request POST \'https://api.notion.com/v1/databases/\' \\\n--header \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n--header \'Content-Type: application/json\' \\\n--header \'Notion-Version: 2022-06-28\' \\\n--data \'{\n    "parent": {\n        "type": "page_id",\n        "page_id": "98ad959b-2b6a-4774-80ee-00246fb0ea9b"\n    },\n    "icon": {\n    \t"type": "emoji",\n\t\t\t"emoji": "📝"\n  \t},\n  \t"cover": {\n  \t\t"type": "external",\n    \t"external": {\n    \t\t"url": "https://website.domain/images/image.png"\n    \t}\n  \t},\n    "title": [\n        {\n            "type": "text",\n            "text": {\n                "content": "Grocery List",\n                "link": null\n            }\n        }\n    ],\n    "properties": {\n        "Name": {\n            "title": {}\n        },\n        "Description": {\n            "rich_text": {}\n        },\n        "In stock": {\n            "checkbox": {}\n        },\n        "Food group": {\n            "select": {\n                "options": [\n                    {\n                        "name": "🥦Vegetable",\n                        "color": "green"\n                    },\n                    {\n                        "name": "🍎Fruit",\n                        "color": "red"\n                    },\n                    {\n                        "name": "💪Protein",\n                        "color": "yellow"\n                    }\n                ]\n            }\n        },\n        "Price": {\n            "number": {\n                "format": "dollar"\n            }\n        },\n        "Last ordered": {\n            "date": {}\n        },\n        "Meals": {\n          "relation": {\n            "database_id": "668d797c-76fa-4934-9b05-ad288df2d136",\n            "single_property": {}\n          }\n    \t\t},\n        "Number of meals": {\n          "rollup": {\n            "rollup_property_name": "Name",\n            "relation_property_name": "Meals",\n            "function": "count"\n          }\n        },\n        "Store availability": {\n            "type": "multi_select",\n            "multi_select": {\n                "options": [\n                    {\n                        "name": "Duc Loi Market",\n                        "color": "blue"\n                    },\n                    {\n                        "name": "Rainbow Grocery",\n                        "color": "gray"\n                    },\n                    {\n                        "name": "Nijiya Market",\n                        "color": "purple"\n                    },\n                    {\n                        "name": "Gus\'\\\'\'s Community Market",\n                        "color": "yellow"\n                    }\n                ]\n            }\n        },\n        "+1": {\n            "people": {}\n        },\n        "Photo": {\n            "files": {}\n        }\n    }\n}\'';
          },
          {
            language: 'javascript';
            code: 'const { Client } = require(\'@notionhq/client\');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const response = await notion.databases.create({\n      parent: {\n        type: "page_id",\n        page_id: "98ad959b-2b6a-4774-80ee-00246fb0ea9b",\n      },\n      icon: {\n        type: "emoji",\n        emoji: "📝",\n      },\n      cover: {\n        type: "external",\n        external: {\n          url: "https://website.domain/images/image.png",\n        },\n      },\n      title: [\n        {\n          type: "text",\n          text: {\n            content: "Grocery List",\n            link: null,\n          },\n        },\n      ],\n      properties: {\n        Name: {\n          title: {},\n        },\n        Description: {\n          rich_text: {},\n        },\n        "In stock": {\n          checkbox: {},\n        },\n        "Food group": {\n          select: {\n            options: [\n              {\n                name: "🥦Vegetable",\n                color: "green",\n              },\n              {\n                name: "🍎Fruit",\n                color: "red",\n              },\n              {\n                name: "💪Protein",\n                color: "yellow",\n              },\n            ],\n          },\n        },\n        Price: {\n          number: {\n            format: "dollar",\n          },\n        },\n        "Last ordered": {\n          date: {},\n        },\n        Meals: {\n          relation: {\n            database_id: "668d797c-76fa-4934-9b05-ad288df2d136",\n            single_property: {},\n          },\n        },\n        "Number of meals": {\n          rollup: {\n            rollup_property_name: "Name",\n            relation_property_name: "Meals",\n            function: "count",\n          },\n        },\n        "Store availability": {\n          type: "multi_select",\n          multi_select: {\n            options: [\n              {\n                name: "Duc Loi Market",\n                color: "blue",\n              },\n              {\n                name: "Rainbow Grocery",\n                color: "gray",\n              },\n              {\n                name: "Nijiya Market",\n                color: "purple",\n              },\n              {\n                name: "Gus\'\'\'s Community Market",\n                color: "yellow",\n              },\n            ],\n          },\n        },\n        "+1": {\n          people: {},\n        },\n        Photo: {\n          files: {},\n        },\n      },\n    });\n  console.log(response);\n})();';
            name: 'Notion SDK for JavaScript';
          },
        ];
        'samples-languages': ['curl', 'javascript'];
      };
    };
  };
  '/v1/databases/{database_id}': {
    patch: {
      summary: 'Update a database';
      description: '';
      operationId: 'update-a-database';
      parameters: [
        {
          name: 'database_id';
          in: 'path';
          description: 'identifier for a Notion database';
          schema: {
            type: 'string';
          };
          required: true;
        },
        {
          name: 'Notion-Version';
          in: 'header';
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                title: {
                  type: 'array';
                  description: 'An array of [rich text objects](https://developers.notion.com/reference/rich-text) that represents the title of the database that is displayed in the Notion UI. If omitted, then the database title remains unchanged.';
                };
                description: {
                  type: 'array';
                  description: 'An array of [rich text objects](https://developers.notion.com/reference/rich-text) that represents the description of the database that is displayed in the Notion UI. If omitted, then the database description remains unchanged.';
                };
                properties: {
                  type: 'string';
                  description: 'The properties of a database to be changed in the request, in the form of a JSON object. If updating an existing property, then the keys are the names or IDs of the properties as they appear in Notion, and the values are [property schema objects](ref:property-schema-object). If adding a new property, then the key is the name of the new database property and the value is a [property schema object](ref:property-schema-object).';
                  format: 'json';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n  "object": "database",\n  "id": "668d797c-76fa-4934-9b05-ad288df2d136",\n  "created_time": "2020-03-17T19:10:00.000Z",\n  "last_edited_time": "2021-08-11T17:26:00.000Z",\n  "parent": {\n    "type": "page_id",\n    "page_id": "48f8fee9-cd79-4180-bc2f-ec0398253067"\n  },  \n  "icon": {\n    "type": "emoji",\n    "emoji": "📝"\n \t},\n  "cover": {\n  \t"type": "external",\n    "external": {\n    \t"url": "https://website.domain/images/image.png"\n    }\n  },\n  "url": "https://www.notion.so/668d797c76fa49349b05ad288df2d136",\n  "title": [\n    {\n      "type": "text",\n      "text": {\n        "content": "Today\'\\\'\'s grocery list",\n        "link": null\n      },\n      "annotations": {\n        "bold": false,\n        "italic": false,\n        "strikethrough": false,\n        "underline": false,\n        "code": false,\n        "color": "default"\n      },\n      "plain_text": "Today\'\\\'\'s grocery list",\n      "href": null\n    }\n  ],\n  "description": [\n    {\n      "type": "text",\n      "text": {\n        "content": "Grocery list for just kale 🥬",\n        "link": null\n      },\n      "annotations": {\n        "bold": false,\n        "italic": false,\n        "strikethrough": false,\n        "underline": false,\n        "code": false,\n        "color": "default"\n      },\n      "plain_text": "Grocery list for just kale 🥬",\n      "href": null\n    }\n  ],\n  "properties": {\n    "Name": {\n      "id": "title",\n\t\t\t"name": "Name",\n      "type": "title",\n      "title": {}\n    },\n    "Description": {\n      "id": "J@cS",\n\t\t\t"name": "Description",\n      "type": "rich_text",\n      "rich_text": {}\n    },\n    "In stock": {\n      "id": "{xY`",\n\t\t\t"name": "In stock",\n      "type": "checkbox",\n      "checkbox": {}\n    },\n    "Food group": {\n      "id": "TJmr",\n\t\t\t"name": "Food group",\n      "type": "select",\n      "select": {\n        "options": [\n          {\n            "id": "96eb622f-4b88-4283-919d-ece2fbed3841",\n            "name": "🥦Vegetable",\n            "color": "green"\n          },\n          {\n            "id": "bb443819-81dc-46fb-882d-ebee6e22c432",\n            "name": "🍎Fruit",\n            "color": "red"\n          },\n          {\n            "id": "7da9d1b9-8685-472e-9da3-3af57bdb221e",\n            "name": "💪Protein",\n            "color": "yellow"\n          }\n        ]\n      }\n    },\n    "Price": {\n      "id": "cU^N",\n\t\t\t"name": "Price",\n      "type": "number",\n      "number": {\n        "format": "dollar"\n      }\n    },\n    "Cost of next trip": {\n      "id": "p:sC",\n\t\t\t"name": "Cost of next trip",\n      "type": "formula",\n      "formula": {\n        "value": "if(prop(\\"In stock\\"), 0, prop(\\"Price\\"))"\n      }\n    },\n    "Last ordered": {\n      "id": "]\\\\R[",\n\t\t\t"name": "Last ordered",\n      "type": "date",\n      "date": {}\n    },\n    "Meals": {\n\t\t\t"id": "gqk%60",\n            "name": "Meals",\n      "type": "relation",\n      "relation": {\n        "database": "668d797c-76fa-4934-9b05-ad288df2d136",\n        "synced_property_name": null\n      }\n    },\n    "Number of meals": {\n      "id": "Z\\\\Eh",\n\t\t\t"name": "Number of meals",\n      "type": "rollup",\n      "rollup": {\n        "rollup_property_name": "Name",\n        "relation_property_name": "Meals",\n        "rollup_property_id": "title",\n        "relation_property_id": "mxp^",\n        "function": "count"\n      }\n    },\n    "Store availability": {\n\t\t\t"id": "G%7Dji",\n      "name": "Store availability",\n      "type": "multi_select",\n      "multi_select": {\n        "options": [\n          [\n            {\n              "id": "d209b920-212c-4040-9d4a-bdf349dd8b2a",\n              "name": "Duc Loi Market",\n              "color": "blue"\n            },\n            {\n              "id": "70104074-0f91-467b-9787-00d59e6e1e41",\n              "name": "Rainbow Grocery",\n              "color": "gray"\n            },\n            {\n              "id": "6c3867c5-d542-4f84-b6e9-a420c43094e7",\n              "name": "Gus\'s Community Market",\n              "color": "yellow"\n            },\n            {\n\t\t\t\t\t\t\t"id": "a62fbb5f-fed4-44a4-8cac-cba5f518c1a1",\n              "name": "The Good Life Grocery",\n              "color": "orange"\n           }\n          ]\n        ]\n      }\n    }\n    "Photo": {\n      "id": "aTIT",\n\t\t\t"name": "Photo",\n      "type": "url",\n      "url": {}\n    }\n  },\n  "is_inline": false\n}';
                };
              };
            };
          };
        };
        '400': {
          description: '400';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n    "object": "error",\n    "status": 400,\n    "code": "validation_error",\n    "message": "body failed validation: body.title[0].text.content.length should be ≤ `2000`, instead was `2022`."\n}';
                };
              };
              schema: {
                oneOf: [
                  {
                    type: 'object';
                    properties: {
                      object: {
                        type: 'string';
                        example: 'error';
                      };
                      status: {
                        type: 'integer';
                        example: 400;
                        default: 0;
                      };
                      code: {
                        type: 'string';
                        example: 'invalid_json';
                      };
                      message: {
                        type: 'string';
                        example: 'Error parsing JSON body.';
                      };
                    };
                  },
                  {
                    type: 'object';
                    properties: {
                      object: {
                        type: 'string';
                        example: 'error';
                      };
                      status: {
                        type: 'integer';
                        example: 400;
                        default: 0;
                      };
                      code: {
                        type: 'string';
                        example: 'validation_error';
                      };
                      message: {
                        type: 'string';
                        example: 'body failed validation: body.title[0].text.content.length should be ≤ `2000`, instead was `2022`.';
                      };
                    };
                  },
                ];
              };
            };
          };
        };
        '404': {
          description: '404';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n    "object": "error",\n    "status": 404,\n    "code": "object_not_found",\n    "message": "Could not find database with ID: a1d8501e-1ac1-43e9-a6bd-ea9fe6c8822c. Make sure the relevant pages and databases are shared with your integration."\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'error';
                  };
                  status: {
                    type: 'integer';
                    example: 404;
                    default: 0;
                  };
                  code: {
                    type: 'string';
                    example: 'object_not_found';
                  };
                  message: {
                    type: 'string';
                    example: 'Could not find database with ID: a1d8501e-1ac1-43e9-a6bd-ea9fe6c8822c. Make sure the relevant pages and databases are shared with your integration.';
                  };
                };
              };
            };
          };
        };
        '429': {
          description: '429';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n\t"object": "error",\n\t"status": 429,\n\t"code": "rate_limited",\n\t"message": "You have been rate limited. Please try again in a few minutes."\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'error';
                  };
                  status: {
                    type: 'integer';
                    example: 429;
                    default: 0;
                  };
                  code: {
                    type: 'string';
                    example: 'rate_limited';
                  };
                  message: {
                    type: 'string';
                    example: 'You have been rate limited. Please try again in a few minutes.';
                  };
                };
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'curl';
            code: 'curl --location --request PATCH \'https://api.notion.com/v1/databases/668d797c-76fa-4934-9b05-ad288df2d136\' \\\n--header \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n--header \'Content-Type: application/json\' \\\n--header \'Notion-Version: 2022-06-28\' \\\n--data \'{\n    "title": [\n        {\n            "text": {\n                "content": "Today\'\\\'\'s grocery list"\n            }\n        }\n    ],\n    "description": [\n        {\n            "text": {\n                "content": "Grocery list for just kale 🥬"\n            }\n        }\n    ],\n    "properties": {\n        "+1": null,\n        "Photo": {\n            "url": {}\n        },\n        "Store availability": {\n            "multi_select": {\n                "options": [\n                    {\n                        "name": "Duc Loi Market"\n                    },\n                    {\n                        "name": "Rainbow Grocery"\n                    },\n                    {\n                        "name": "Gus\'\\\'\'s Community Market"\n                    },\n                    {\n                        "name": "The Good Life Grocery",\n                        "color": "orange"\n                    }\n                ]\n            }\n        }\n    }       \n}\'';
          },
        ];
        'samples-languages': ['curl'];
      };
    };
    get: {
      summary: 'Retrieve a database';
      description: '';
      operationId: 'retrieve-a-database';
      parameters: [
        {
          name: 'database_id';
          in: 'path';
          description: 'An identifier for the Notion database.';
          schema: {
            type: 'string';
          };
          required: true;
        },
        {
          name: 'Notion-Version';
          in: 'header';
          required: true;
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n    "object": "database",\n    "id": "bc1211ca-e3f1-4939-ae34-5260b16f627c",\n    "created_time": "2021-07-08T23:50:00.000Z",\n    "last_edited_time": "2021-07-08T23:50:00.000Z",\n    "icon": {\n        "type": "emoji",\n        "emoji": "🎉"\n    },\n    "cover": {\n        "type": "external",\n        "external": {\n            "url": "https://website.domain/images/image.png"\n        }\n    },\n    "url": "https://www.notion.so/bc1211cae3f14939ae34260b16f627c",\n    "title": [\n        {\n            "type": "text",\n            "text": {\n                "content": "Grocery List",\n                "link": null\n            },\n            "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n            },\n            "plain_text": "Grocery List",\n            "href": null\n        }\n    ],\n    "description": [\n        {\n            "type": "text",\n            "text": {\n                "content": "Grocery list for just kale 🥬",\n                "link": null\n            },\n            "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n            },\n            "plain_text": "Grocery list for just kale 🥬",\n            "href": null\n        }\n    ],\n    "properties": {\n        "+1": {\n            "id": "Wp%3DC",\n            "name": "+1",\n            "type": "people",\n            "people": {}\n        },\n        "In stock": {\n            "id": "fk%5EY",\n            "name": "In stock",\n            "type": "checkbox",\n            "checkbox": {}\n        },\n        "Price": {\n            "id": "evWq",\n            "name": "Price",\n            "type": "number",\n            "number": {\n                "format": "dollar"\n            }\n        },\n        "Description": {\n            "id": "V}lX",\n            "name": "Description",\n            "type": "rich_text",\n            "rich_text": {}\n        },\n        "Last ordered": {\n            "id": "eVnV",\n            "name": "Last ordered",\n            "type": "date",\n            "date": {}\n        },\n        "Meals": {\n            "id": "%7DWA~",\n            "name": "Meals",\n            "type": "relation",\n            "relation": {\n                "database_id": "668d797c-76fa-4934-9b05-ad288df2d136",\n                "synced_property_name": "Related to Grocery List (Meals)"\n            }\n        },\n        "Number of meals": {\n            "id": "Z\\\\Eh",\n            "name": "Number of meals",\n            "type": "rollup",\n            "rollup": {\n                "rollup_property_name": "Name",\n                "relation_property_name": "Meals",\n                "rollup_property_id": "title",\n                "relation_property_id": "mxp^",\n                "function": "count"\n            }\n        },\n        "Store availability": {\n            "id": "s}Kq",\n            "name": "Store availability",\n            "type": "multi_select",\n            "multi_select": {\n                "options": [\n                    {\n                        "id": "cb79b393-d1c1-4528-b517-c450859de766",\n                        "name": "Duc Loi Market",\n                        "color": "blue"\n                    },\n                    {\n                        "id": "58aae162-75d4-403b-a793-3bc7308e4cd2",\n                        "name": "Rainbow Grocery",\n                        "color": "gray"\n                    },\n                    {\n                        "id": "22d0f199-babc-44ff-bd80-a9eae3e3fcbf",\n                        "name": "Nijiya Market",\n                        "color": "purple"\n                    },\n                    {\n                        "id": "0d069987-ffb0-4347-bde2-8e4068003dbc",\n                        "name": "Gus\'s Community Market",\n                        "color": "yellow"\n                    }\n                ]\n            }\n        },\n        "Photo": {\n            "id": "yfiK",\n            "name": "Photo",\n            "type": "files",\n            "files": {}\n        },\n        "Food group": {\n            "id": "CM%3EH",\n            "name": "Food group",\n            "type": "select",\n            "select": {\n                "options": [\n                    {\n                        "id": "6d4523fa-88cb-4ffd-9364-1e39d0f4e566",\n                        "name": "🥦Vegetable",\n                        "color": "green"\n                    },\n                    {\n                        "id": "268d7e75-de8f-4c4b-8b9d-de0f97021833",\n                        "name": "🍎Fruit",\n                        "color": "red"\n                    },\n                    {\n                        "id": "1b234a00-dc97-489c-b987-829264cfdfef",\n                        "name": "💪Protein",\n                        "color": "yellow"\n                    }\n                ]\n            }\n        },\n        "Name": {\n            "id": "title",\n            "name": "Name",\n            "type": "title",\n            "title": {}\n        }\n    },\n    "parent": {\n        "type": "page_id",\n        "page_id": "98ad959b-2b6a-4774-80ee-00246fb0ea9b"\n    },\n    "archived": false,\n    "is_inline": false,\n    "public_url": null\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'database';
                  };
                  id: {
                    type: 'string';
                    example: 'bc1211ca-e3f1-4939-ae34-5260b16f627c';
                  };
                  created_time: {
                    type: 'string';
                    example: '2021-07-08T23:50:00.000Z';
                  };
                  last_edited_time: {
                    type: 'string';
                    example: '2021-07-08T23:50:00.000Z';
                  };
                  icon: {
                    type: 'object';
                    properties: {
                      type: {
                        type: 'string';
                        example: 'emoji';
                      };
                      emoji: {
                        type: 'string';
                        example: '🎉';
                      };
                    };
                  };
                  cover: {
                    type: 'object';
                    properties: {
                      type: {
                        type: 'string';
                        example: 'external';
                      };
                      external: {
                        type: 'object';
                        properties: {
                          url: {
                            type: 'string';
                            example: 'https://website.domain/images/image.png';
                          };
                        };
                      };
                    };
                  };
                  url: {
                    type: 'string';
                    example: 'https://www.notion.so/bc1211cae3f14939ae34260b16f627c';
                  };
                  title: {
                    type: 'array';
                    items: {
                      type: 'object';
                      properties: {
                        type: {
                          type: 'string';
                          example: 'text';
                        };
                        text: {
                          type: 'object';
                          properties: {
                            content: {
                              type: 'string';
                              example: 'Grocery List';
                            };
                            link: {};
                          };
                        };
                        annotations: {
                          type: 'object';
                          properties: {
                            bold: {
                              type: 'boolean';
                              example: false;
                              default: true;
                            };
                            italic: {
                              type: 'boolean';
                              example: false;
                              default: true;
                            };
                            strikethrough: {
                              type: 'boolean';
                              example: false;
                              default: true;
                            };
                            underline: {
                              type: 'boolean';
                              example: false;
                              default: true;
                            };
                            code: {
                              type: 'boolean';
                              example: false;
                              default: true;
                            };
                            color: {
                              type: 'string';
                              example: 'default';
                            };
                          };
                        };
                        plain_text: {
                          type: 'string';
                          example: 'Grocery List';
                        };
                        href: {};
                      };
                    };
                  };
                  description: {
                    type: 'array';
                    items: {
                      type: 'object';
                      properties: {
                        type: {
                          type: 'string';
                          example: 'text';
                        };
                        text: {
                          type: 'object';
                          properties: {
                            content: {
                              type: 'string';
                              example: 'Grocery list for just kale 🥬';
                            };
                            link: {};
                          };
                        };
                        annotations: {
                          type: 'object';
                          properties: {
                            bold: {
                              type: 'boolean';
                              example: false;
                              default: true;
                            };
                            italic: {
                              type: 'boolean';
                              example: false;
                              default: true;
                            };
                            strikethrough: {
                              type: 'boolean';
                              example: false;
                              default: true;
                            };
                            underline: {
                              type: 'boolean';
                              example: false;
                              default: true;
                            };
                            code: {
                              type: 'boolean';
                              example: false;
                              default: true;
                            };
                            color: {
                              type: 'string';
                              example: 'default';
                            };
                          };
                        };
                        plain_text: {
                          type: 'string';
                          example: 'Grocery list for just kale 🥬';
                        };
                        href: {};
                      };
                    };
                  };
                  properties: {
                    type: 'object';
                    properties: {
                      '+1': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'Wp%3DC';
                          };
                          name: {
                            type: 'string';
                            example: '+1';
                          };
                          type: {
                            type: 'string';
                            example: 'people';
                          };
                          people: {
                            type: 'object';
                            properties: {};
                          };
                        };
                      };
                      'In stock': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'fk%5EY';
                          };
                          name: {
                            type: 'string';
                            example: 'In stock';
                          };
                          type: {
                            type: 'string';
                            example: 'checkbox';
                          };
                          checkbox: {
                            type: 'object';
                            properties: {};
                          };
                        };
                      };
                      Price: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'evWq';
                          };
                          name: {
                            type: 'string';
                            example: 'Price';
                          };
                          type: {
                            type: 'string';
                            example: 'number';
                          };
                          number: {
                            type: 'object';
                            properties: {
                              format: {
                                type: 'string';
                                example: 'dollar';
                              };
                            };
                          };
                        };
                      };
                      Description: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'V}lX';
                          };
                          name: {
                            type: 'string';
                            example: 'Description';
                          };
                          type: {
                            type: 'string';
                            example: 'rich_text';
                          };
                          rich_text: {
                            type: 'object';
                            properties: {};
                          };
                        };
                      };
                      'Last ordered': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'eVnV';
                          };
                          name: {
                            type: 'string';
                            example: 'Last ordered';
                          };
                          type: {
                            type: 'string';
                            example: 'date';
                          };
                          date: {
                            type: 'object';
                            properties: {};
                          };
                        };
                      };
                      Meals: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: '%7DWA~';
                          };
                          name: {
                            type: 'string';
                            example: 'Meals';
                          };
                          type: {
                            type: 'string';
                            example: 'relation';
                          };
                          relation: {
                            type: 'object';
                            properties: {
                              database_id: {
                                type: 'string';
                                example: '668d797c-76fa-4934-9b05-ad288df2d136';
                              };
                              synced_property_name: {
                                type: 'string';
                                example: 'Related to Grocery List (Meals)';
                              };
                            };
                          };
                        };
                      };
                      'Number of meals': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'Z\\Eh';
                          };
                          name: {
                            type: 'string';
                            example: 'Number of meals';
                          };
                          type: {
                            type: 'string';
                            example: 'rollup';
                          };
                          rollup: {
                            type: 'object';
                            properties: {
                              rollup_property_name: {
                                type: 'string';
                                example: 'Name';
                              };
                              relation_property_name: {
                                type: 'string';
                                example: 'Meals';
                              };
                              rollup_property_id: {
                                type: 'string';
                                example: 'title';
                              };
                              relation_property_id: {
                                type: 'string';
                                example: 'mxp^';
                              };
                              function: {
                                type: 'string';
                                example: 'count';
                              };
                            };
                          };
                        };
                      };
                      'Store availability': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 's}Kq';
                          };
                          name: {
                            type: 'string';
                            example: 'Store availability';
                          };
                          type: {
                            type: 'string';
                            example: 'multi_select';
                          };
                          multi_select: {
                            type: 'object';
                            properties: {
                              options: {
                                type: 'array';
                                items: {
                                  type: 'object';
                                  properties: {
                                    id: {
                                      type: 'string';
                                      example: 'cb79b393-d1c1-4528-b517-c450859de766';
                                    };
                                    name: {
                                      type: 'string';
                                      example: 'Duc Loi Market';
                                    };
                                    color: {
                                      type: 'string';
                                      example: 'blue';
                                    };
                                  };
                                };
                              };
                            };
                          };
                        };
                      };
                      Photo: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'yfiK';
                          };
                          name: {
                            type: 'string';
                            example: 'Photo';
                          };
                          type: {
                            type: 'string';
                            example: 'files';
                          };
                          files: {
                            type: 'object';
                            properties: {};
                          };
                        };
                      };
                      'Food group': {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'CM%3EH';
                          };
                          name: {
                            type: 'string';
                            example: 'Food group';
                          };
                          type: {
                            type: 'string';
                            example: 'select';
                          };
                          select: {
                            type: 'object';
                            properties: {
                              options: {
                                type: 'array';
                                items: {
                                  type: 'object';
                                  properties: {
                                    id: {
                                      type: 'string';
                                      example: '6d4523fa-88cb-4ffd-9364-1e39d0f4e566';
                                    };
                                    name: {
                                      type: 'string';
                                      example: '🥦Vegetable';
                                    };
                                    color: {
                                      type: 'string';
                                      example: 'green';
                                    };
                                  };
                                };
                              };
                            };
                          };
                        };
                      };
                      Name: {
                        type: 'object';
                        properties: {
                          id: {
                            type: 'string';
                            example: 'title';
                          };
                          name: {
                            type: 'string';
                            example: 'Name';
                          };
                          type: {
                            type: 'string';
                            example: 'title';
                          };
                          title: {
                            type: 'object';
                            properties: {};
                          };
                        };
                      };
                    };
                  };
                  parent: {
                    type: 'object';
                    properties: {
                      type: {
                        type: 'string';
                        example: 'page_id';
                      };
                      page_id: {
                        type: 'string';
                        example: '98ad959b-2b6a-4774-80ee-00246fb0ea9b';
                      };
                    };
                  };
                  archived: {
                    type: 'boolean';
                    example: false;
                    default: true;
                  };
                  is_inline: {
                    type: 'boolean';
                    example: false;
                    default: true;
                  };
                  public_url: {};
                };
              };
            };
          };
        };
        '400': {
          description: '400';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}';
                };
              };
              schema: {
                type: 'object';
                properties: {};
              };
            };
          };
        };
        '404': {
          description: '404';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n  "object": "error",\n  "status": 404,\n  "code": "object_not_found",\n  "message": "Could not find database with ID: a1d8501e-1ac1-43e9-a6bd-ea9fe6c8822c. Make sure the relevant pages and databases are shared with your integration."\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'error';
                  };
                  status: {
                    type: 'integer';
                    example: 404;
                    default: 0;
                  };
                  code: {
                    type: 'string';
                    example: 'object_not_found';
                  };
                  message: {
                    type: 'string';
                    example: 'Could not find database with ID: a1d8501e-1ac1-43e9-a6bd-ea9fe6c8822c. Make sure the relevant pages and databases are shared with your integration.';
                  };
                };
              };
            };
          };
        };
        '429': {
          description: '429';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n  "object": "error",\n  "status": 429,\n  "code": "rate_limited",\n  "message": "You have been rate limited. Please try again in a few minutes."\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'error';
                  };
                  status: {
                    type: 'integer';
                    example: 429;
                    default: 0;
                  };
                  code: {
                    type: 'string';
                    example: 'rate_limited';
                  };
                  message: {
                    type: 'string';
                    example: 'You have been rate limited. Please try again in a few minutes.';
                  };
                };
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript';
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const databaseId = '668d797c-76fa-4934-9b05-ad288df2d136';\n  const response = await notion.databases.retrieve({ database_id: databaseId });\n  console.log(response);\n})();";
            name: 'Notion SDK for JavaScript';
          },
          {
            language: 'curl';
            code: "curl 'https://api.notion.com/v1/databases/668d797c-76fa-4934-9b05-ad288df2d136' \\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"'' \\\n  -H 'Notion-Version: 2022-06-28'";
          },
        ];
        'samples-languages': ['javascript', 'curl'];
      };
    };
  };
  '/v1/pages/{page_id}/properties/{property_id}': {
    get: {
      summary: 'Retrieve a page property item';
      description: '';
      operationId: 'retrieve-a-page-property';
      parameters: [
        {
          name: 'page_id';
          in: 'path';
          description: 'Identifier for a Notion page';
          schema: {
            type: 'string';
          };
          required: true;
        },
        {
          name: 'property_id';
          in: 'path';
          description: 'Identifier for a page [property](https://developers.notion.com/reference/page#all-property-values)';
          schema: {
            type: 'string';
          };
          required: true;
        },
        {
          name: 'page_size';
          in: 'query';
          description: 'For paginated properties. The max number of property item objects on a page. The default size is 100';
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
        {
          name: 'start_cursor';
          in: 'query';
          description: 'For paginated properties.';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'Notion-Version';
          in: 'header';
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                'Number Property Item': {
                  value: '{\n  "object": "property_item",\n  "id" "kjPO",\n  "type": "number",\n  "number": 2\n}';
                };
                Result: {
                  value: '{\n    "object": "list",\n    "results": [\n        {\n            "object": "property_item",\n            "id" "kjPO",\n            "type": "rich_text",\n            "rich_text": {\n                "type": "text",\n                "text": {\n                    "content": "Avocado ",\n                    "link": null\n                },\n                "annotations": {\n                    "bold": false,\n                    "italic": false,\n                    "strikethrough": false,\n                    "underline": false,\n                    "code": false,\n                    "color": "default"\n                },\n                "plain_text": "Avocado ",\n                "href": null\n            }\n        },\n        {\n            "object": "property_item",\n            "id" "ijPO",\n            "type": "rich_text",\n            "rich_text": {\n                "type": "mention",\n                "mention": {\n                    "type": "page",\n                    "page": {\n                        "id": "41117fd7-69a5-4694-bc07-c1e3a682c857"\n                    }\n                },\n                "annotations": {\n                    "bold": false,\n                    "italic": false,\n                    "strikethrough": false,\n                    "underline": false,\n                    "code": false,\n                    "color": "default"\n                },\n                "plain_text": "Lemons",\n                "href": "http://notion.so/41117fd769a54694bc07c1e3a682c857"\n            }\n        },\n        {\n            "object": "property_item",\n            "id" "kjPO",\n            "type": "rich_text",\n            "rich_text": {\n                "type": "text",\n                "text": {\n                    "content": " Tomato ",\n                    "link": null\n                },\n                "annotations": {\n                    "bold": false,\n                    "italic": false,\n                    "strikethrough": false,\n                    "underline": false,\n                    "code": false,\n                    "color": "default"\n                },\n                "plain_text": " Tomato ",\n                "href": null\n            }\n        },\n...\n    ],\n    "next_cursor": "some-next-cursor-value",\n    "has_more": true,\n\t\t"next_url": "http://api.notion.com/v1/pages/0e5235bf86aa4efb93aa772cce7eab71/properties/NVv^?start_cursor=some-next-cursor-value&page_size=25",\n    "property_item": {\n      "id": "NVv^",\n      "next_url": null,\n      "type": "rich_text",\n      "rich_text": {}\n    }\n}';
                };
                'Rollup List Property Item': {
                  value: '{\n    "object": "list",\n    "results": [\n        {\n            "object": "property_item",\n          \t"id": "dj2l",\n            "type": "relation",\n            "relation": {\n                "id": "83f92c9d-523d-466e-8c1f-9bc2c25a99fe"\n            }\n        },\n        {\n            "object": "property_item",\n          \t"id": "dj2l",\n            "type": "relation",\n            "relation": {\n                "id": "45cfb825-3463-4891-8932-7e6d8c170630"\n            }\n        },\n        {\n            "object": "property_item",\n          \t"id": "dj2l",\n            "type": "relation",\n            "relation": {\n                "id": "1688be1a-a197-4f2a-9688-e528c4b56d94"\n            }\n        }\n    ],\n    "next_cursor": "some-next-cursor-value",\n    "has_more": true,\n\t\t"property_item": {\n      "id": "y}~p",\n      "next_url": "http://api.notion.com/v1/pages/0e5235bf86aa4efb93aa772cce7eab71/properties/y%7D~p?start_cursor=1QaTunT5&page_size=25",\n      "type": "rollup",\n      "rollup": {\n        "function": "sum",\n        "type": "incomplete",\n        "incomplete": {}\n      }\n    }\n    "type": "property_item"\n}';
                };
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript';
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const pageId = 'b55c9c91-384d-452b-81db-d1ef79372b75';\n  const propertyId = \"aBcD123\n  const response = await notion.pages.properties.retrieve({ page_id: pageId, property_id: propertyId });\n  console.log(response);\n})();";
            name: 'Notion SDK for JavaScript';
          },
          {
            language: 'curl';
            code: "curl --request GET \\\n  --url https://api.notion.com/v1/pages/b55c9c91-384d-452b-81db-d1ef79372b75/properties/some-property-id \\\n  --header 'Authorization: Bearer $NOTION_API_KEY' \\\n  --header 'Notion-Version: 2022-06-28'";
          },
        ];
        'samples-languages': ['javascript', 'curl'];
      };
    };
  };
  '/v1/users/me': {
    get: {
      summary: "Retrieve your token's bot user";
      description: '';
      operationId: 'get-self';
      parameters: [
        {
          name: 'Notion-Version';
          in: 'header';
          required: true;
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n  "object": "user",\n  "id": "16d84278-ab0e-484c-9bdd-b35da3bd8905",\n  "name": "pied piper",\n  "avatar_url": null,\n  "type": "bot",\n  "bot": {\n    "owner": {\n      "type": "user",\n      "user": {\n        "object": "user",\n        "id": "5389a034-eb5c-47b5-8a9e-f79c99ef166c",\n        "name": "christine makenotion",\n        "avatar_url": null,\n        "type": "person",\n        "person": {\n          "email": "christine@makenotion.com"\n        }\n      }\n    }\n  }\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'user';
                  };
                  id: {
                    type: 'string';
                    example: '16d84278-ab0e-484c-9bdd-b35da3bd8905';
                  };
                  name: {
                    type: 'string';
                    example: 'pied piper';
                  };
                  avatar_url: {};
                  type: {
                    type: 'string';
                    example: 'bot';
                  };
                  bot: {
                    type: 'object';
                    properties: {
                      owner: {
                        type: 'object';
                        properties: {
                          type: {
                            type: 'string';
                            example: 'user';
                          };
                          user: {
                            type: 'object';
                            properties: {
                              object: {
                                type: 'string';
                                example: 'user';
                              };
                              id: {
                                type: 'string';
                                example: '5389a034-eb5c-47b5-8a9e-f79c99ef166c';
                              };
                              name: {
                                type: 'string';
                                example: 'christine makenotion';
                              };
                              avatar_url: {};
                              type: {
                                type: 'string';
                                example: 'person';
                              };
                              person: {
                                type: 'object';
                                properties: {
                                  email: {
                                    type: 'string';
                                    example: 'christine@makenotion.com';
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
              };
            };
          };
        };
        '400': {
          description: '400';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}';
                };
              };
              schema: {
                type: 'object';
                properties: {};
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript';
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const response = await notion.users.me();\n  console.log(response);\n})();";
            name: 'Notion SDK for JavaScript';
          },
          {
            language: 'curl';
            code: "curl 'https://api.notion.com/v1/users/me' \\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"'' \\\n  -H \"Notion-Version: 2022-06-28\" \\";
          },
        ];
        'samples-languages': ['javascript', 'curl'];
      };
    };
  };
  '/v1/comments': {
    get: {
      summary: 'Retrieve comments';
      description: 'Retrieves a list of un-resolved [Comment objects](ref:comment-object) from a page or block.';
      operationId: 'retrieve-a-comment';
      parameters: [
        {
          name: 'Notion-Version';
          in: 'header';
          required: true;
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
        {
          name: 'block_id';
          in: 'query';
          description: 'Identifier for a Notion block or page';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'start_cursor';
          in: 'query';
          description: 'If supplied, this endpoint will return a page of results starting after the cursor provided. If not supplied, this endpoint will return the first page of results.';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'page_size';
          in: 'query';
          description: 'The number of items from the full list desired in the response. Maximum: 100';
          schema: {
            type: 'integer';
            format: 'int32';
          };
        },
      ];
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                OK: {
                  value: '{\n    "object": "list",\n    "results": [\n        {\n            "object": "comment",\n            "id": "94cc56ab-9f02-409d-9f99-1037e9fe502f",\n            "parent": {\n                "type": "page_id",\n                "page_id": "5c6a2821-6bb1-4a7e-b6e1-c50111515c3d"\n            },\n            "discussion_id": "f1407351-36f5-4c49-a13c-49f8ba11776d",\n            "created_time": "2022-07-15T16:52:00.000Z",\n            "last_edited_time": "2022-07-15T19:16:00.000Z",\n            "created_by": {\n                "object": "user",\n                "id": "9b15170a-9941-4297-8ee6-83fa7649a87a"\n            },\n            "rich_text": [\n                {\n                    "type": "text",\n                    "text": {\n                        "content": "Single comment",\n                        "link": null\n                    },\n                    "annotations": {\n                        "bold": false,\n                        "italic": false,\n                        "strikethrough": false,\n                        "underline": false,\n                        "code": false,\n                        "color": "default"\n                    },\n                    "plain_text": "Single comment",\n                    "href": null\n                }\n            ]\n        }\n    ],\n    "next_cursor": null,\n    "has_more": false,\n    "type": "comment",\n    "comment": {}\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'list';
                  };
                  results: {
                    type: 'array';
                    items: {
                      type: 'object';
                      properties: {
                        object: {
                          type: 'string';
                          example: 'comment';
                        };
                        id: {
                          type: 'string';
                          example: '94cc56ab-9f02-409d-9f99-1037e9fe502f';
                        };
                        parent: {
                          type: 'object';
                          properties: {
                            type: {
                              type: 'string';
                              example: 'page_id';
                            };
                            page_id: {
                              type: 'string';
                              example: '5c6a2821-6bb1-4a7e-b6e1-c50111515c3d';
                            };
                          };
                        };
                        discussion_id: {
                          type: 'string';
                          example: 'f1407351-36f5-4c49-a13c-49f8ba11776d';
                        };
                        created_time: {
                          type: 'string';
                          example: '2022-07-15T16:52:00.000Z';
                        };
                        last_edited_time: {
                          type: 'string';
                          example: '2022-07-15T19:16:00.000Z';
                        };
                        created_by: {
                          type: 'object';
                          properties: {
                            object: {
                              type: 'string';
                              example: 'user';
                            };
                            id: {
                              type: 'string';
                              example: '9b15170a-9941-4297-8ee6-83fa7649a87a';
                            };
                          };
                        };
                        rich_text: {
                          type: 'array';
                          items: {
                            type: 'object';
                            properties: {
                              type: {
                                type: 'string';
                                example: 'text';
                              };
                              text: {
                                type: 'object';
                                properties: {
                                  content: {
                                    type: 'string';
                                    example: 'Single comment';
                                  };
                                  link: {};
                                };
                              };
                              annotations: {
                                type: 'object';
                                properties: {
                                  bold: {
                                    type: 'boolean';
                                    example: false;
                                    default: true;
                                  };
                                  italic: {
                                    type: 'boolean';
                                    example: false;
                                    default: true;
                                  };
                                  strikethrough: {
                                    type: 'boolean';
                                    example: false;
                                    default: true;
                                  };
                                  underline: {
                                    type: 'boolean';
                                    example: false;
                                    default: true;
                                  };
                                  code: {
                                    type: 'boolean';
                                    example: false;
                                    default: true;
                                  };
                                  color: {
                                    type: 'string';
                                    example: 'default';
                                  };
                                };
                              };
                              plain_text: {
                                type: 'string';
                                example: 'Single comment';
                              };
                              href: {};
                            };
                          };
                        };
                      };
                    };
                  };
                  next_cursor: {};
                  has_more: {
                    type: 'boolean';
                    example: false;
                    default: true;
                  };
                  type: {
                    type: 'string';
                    example: 'comment';
                  };
                  comment: {
                    type: 'object';
                    properties: {};
                  };
                };
              };
            };
          };
        };
        '403': {
          description: '403';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n    "object": "error",\n    "status": 403,\n    "code": "restricted_resource",\n    "message": "Insufficient permissions for this endpoint."\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'error';
                  };
                  status: {
                    type: 'integer';
                    example: 403;
                    default: 0;
                  };
                  code: {
                    type: 'string';
                    example: 'restricted_resource';
                  };
                  message: {
                    type: 'string';
                    example: 'Insufficient permissions for this endpoint.';
                  };
                };
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript';
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const blockId = 'd40e767c-d7af-4b18-a86d-55c61f1e39a4';\n  const response = await notion.comments.list({ block_id: blockId });\n  console.log(response);\n})();";
            name: 'Notion SDK for JavaScript';
          },
          {
            language: 'curl';
            code: "curl 'https://api.notion.com/v1/comments?block_id=5c6a28216bb14a7eb6e1c50111515c3d'\\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"'' \\\n  -H \"Notion-Version: 2022-06-28\"";
          },
        ];
        'samples-languages': ['javascript', 'curl'];
      };
    };
    post: {
      summary: 'Create comment';
      description: 'Creates a comment in a page or existing discussion thread.';
      operationId: 'create-a-comment';
      parameters: [
        {
          name: 'Notion-Version';
          in: 'header';
          required: true;
          schema: {
            type: 'string';
            default: '2022-06-28';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['rich_text'];
              properties: {
                parent: {
                  type: 'string';
                  description: 'A [page parent](/reference/database#page-parent). Either this or a discussion_id is required (not both)';
                  format: 'json';
                };
                discussion_id: {
                  type: 'string';
                  description: 'A UUID identifier for a discussion thread. Either this or a parent object is required (not both)';
                };
                rich_text: {
                  type: 'string';
                  description: 'A [rich text object](ref:rich-text)';
                  format: 'json';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n    "object": "comment",\n    "id": "b52b8ed6-e029-4707-a671-832549c09de3",\n    "parent": {\n        "type": "page_id",\n        "page_id": "5c6a2821-6bb1-4a7e-b6e1-c50111515c3d"\n    },\n    "discussion_id": "f1407351-36f5-4c49-a13c-49f8ba11776d",\n    "created_time": "2022-07-15T20:53:00.000Z",\n    "last_edited_time": "2022-07-15T20:53:00.000Z",\n    "created_by": {\n        "object": "user",\n        "id": "067dee40-6ebd-496f-b446-093c715fb5ec"\n    },\n    "rich_text": [\n        {\n            "type": "text",\n            "text": {\n                "content": "Hello world",\n                "link": null\n            },\n            "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n            },\n            "plain_text": "Hello world",\n            "href": null\n        }\n    ]\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'comment';
                  };
                  id: {
                    type: 'string';
                    example: 'b52b8ed6-e029-4707-a671-832549c09de3';
                  };
                  parent: {
                    type: 'object';
                    properties: {
                      type: {
                        type: 'string';
                        example: 'page_id';
                      };
                      page_id: {
                        type: 'string';
                        example: '5c6a2821-6bb1-4a7e-b6e1-c50111515c3d';
                      };
                    };
                  };
                  discussion_id: {
                    type: 'string';
                    example: 'f1407351-36f5-4c49-a13c-49f8ba11776d';
                  };
                  created_time: {
                    type: 'string';
                    example: '2022-07-15T20:53:00.000Z';
                  };
                  last_edited_time: {
                    type: 'string';
                    example: '2022-07-15T20:53:00.000Z';
                  };
                  created_by: {
                    type: 'object';
                    properties: {
                      object: {
                        type: 'string';
                        example: 'user';
                      };
                      id: {
                        type: 'string';
                        example: '067dee40-6ebd-496f-b446-093c715fb5ec';
                      };
                    };
                  };
                  rich_text: {
                    type: 'array';
                    items: {
                      type: 'object';
                      properties: {
                        type: {
                          type: 'string';
                          example: 'text';
                        };
                        text: {
                          type: 'object';
                          properties: {
                            content: {
                              type: 'string';
                              example: 'Hello world';
                            };
                            link: {};
                          };
                        };
                        annotations: {
                          type: 'object';
                          properties: {
                            bold: {
                              type: 'boolean';
                              example: false;
                              default: true;
                            };
                            italic: {
                              type: 'boolean';
                              example: false;
                              default: true;
                            };
                            strikethrough: {
                              type: 'boolean';
                              example: false;
                              default: true;
                            };
                            underline: {
                              type: 'boolean';
                              example: false;
                              default: true;
                            };
                            code: {
                              type: 'boolean';
                              example: false;
                              default: true;
                            };
                            color: {
                              type: 'string';
                              example: 'default';
                            };
                          };
                        };
                        plain_text: {
                          type: 'string';
                          example: 'Hello world';
                        };
                        href: {};
                      };
                    };
                  };
                };
              };
            };
          };
        };
        '403': {
          description: '403';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n    "object": "error",\n    "status": 403,\n    "code": "restricted_resource",\n    "message": "Insufficient permissions for this endpoint."\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  object: {
                    type: 'string';
                    example: 'error';
                  };
                  status: {
                    type: 'integer';
                    example: 403;
                    default: 0;
                  };
                  code: {
                    type: 'string';
                    example: 'restricted_resource';
                  };
                  message: {
                    type: 'string';
                    example: 'Insufficient permissions for this endpoint.';
                  };
                };
              };
            };
          };
        };
      };
      deprecated: false;
      security: [];
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript';
            code: 'const { Client } = require(\'@notionhq/client\');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const response = await notion.comments.create({\n    "parent": {\n      "page_id": "5c6a28216bb14a7eb6e1c50111515c3d"\n    },\n    "rich_text": [\n      {\n        "text": {\n          "content": "Hello world"\n        }\n      }\n    ]\n\t});\n  \n  console.log(response);\n})();\n';
            name: 'Notion SDK for JavaScript';
          },
          {
            language: 'curl';
            code: 'curl \'https://api.notion.com/v1/comments\' \\\n  -H \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n  -H "Notion-Version: 2022-06-28" \\\n  --data \'{\n    "parent": {\n      "page_id": "5c6a28216bb14a7eb6e1c50111515c3d"\n    },\n    "rich_text": [\n      {\n        "text": {\n          "content": "Hello world"\n        }\n      }\n    ]\n\t}\'';
          },
        ];
        'samples-languages': ['javascript', 'curl'];
      };
    };
  };
  '/v1/oauth/token': {
    post: {
      summary: 'Create a token';
      description: 'Creates an access token that a third-party service can use to authenticate with Notion.';
      operationId: 'create-a-token';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object';
              required: ['code', 'grant_type', 'redirect_uri'];
              properties: {
                code: {
                  type: 'string';
                  description: 'A unique random code that Notion generates to authenticate with your service, generated when a user initiates the OAuth flow.';
                };
                grant_type: {
                  type: 'string';
                  description: 'A constant string: "authorization_code".';
                  default: '"authorization_code"';
                };
                redirect_uri: {
                  type: 'string';
                  description: 'The `"redirect_uri"` that was provided in the OAuth Domain & URI section of the integration\'s Authorization settings. Do not include this field if a `"redirect_uri"` query param was not included in the Authorization URL provided to users. In most cases, this field is required.';
                };
                external_account: {
                  type: 'object';
                  description: 'Required if and only when building [Link Preview](https://developers.notion.com/docs/link-previews) integrations (otherwise ignored). An object with `key` and `name` properties. `key` should be a unique identifier for the account. Notion uses the `key` to determine whether or not the user is re-connecting the same account. `name` should be some way for the user to know which account they used to authenticate with your service. If a user has authenticated Notion with your integration before and `key` is the same but `name` is different, then Notion updates the `name` associated with your integration.';
                  properties: {};
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: '200';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n  "access_token": "e202e8c9-0990-40af-855f-ff8f872b1ec6c",\n  "bot_id": "b3414d659-1224-5ty7-6ffr-cc9d8773drt601288f",\n  "duplicated_template_id": null,\n  "owner": {\n    "workspace": true\n  },\n  "workspace_icon": "https://website.domain/images/image.png",\n  "workspace_id": "j565j4d7x3-2882-61bs-564a-jj9d9ui-c36hxfr7x",\n  "workspace_name": "Ada\'s Notion Workspace"\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  access_token: {
                    type: 'string';
                    example: 'e202e8c9-0990-40af-855f-ff8f872b1ec6c';
                  };
                  bot_id: {
                    type: 'string';
                    example: 'b3414d659-1224-5ty7-6ffr-cc9d8773drt601288f';
                  };
                  duplicated_template_id: {};
                  owner: {
                    type: 'object';
                    properties: {
                      workspace: {
                        type: 'boolean';
                        example: true;
                        default: true;
                      };
                    };
                  };
                  workspace_icon: {
                    type: 'string';
                    example: 'https://website.domain/images/image.png';
                  };
                  workspace_id: {
                    type: 'string';
                    example: 'j565j4d7x3-2882-61bs-564a-jj9d9ui-c36hxfr7x';
                  };
                  workspace_name: {
                    type: 'string';
                    example: "Ada's Notion Workspace";
                  };
                };
              };
            };
          };
        };
        '400': {
          description: '400';
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{\n    "error": "invalid_request",\n    "error_description": "body failed validation: body.redirect_uri should be defined, instead was `undefined`."\n}';
                };
              };
              schema: {
                type: 'object';
                properties: {
                  error: {
                    type: 'string';
                    example: 'invalid_request';
                  };
                  error_description: {
                    type: 'string';
                    example: 'body failed validation: body.redirect_uri should be defined, instead was `undefined`.';
                  };
                };
              };
            };
          };
        };
      };
      deprecated: false;
      'x-readme': {
        'code-samples': [
          {
            language: 'curl';
            code: 'curl --location --request POST \'https://api.notion.com/v1/oauth/token\' \\\n--header \'Authorization: Basic \'"$BASE64_ENCODED_ID_AND_SECRET"\'\' \\\n--header \'Content-Type: application/json\' \\\n--header \'Notion-Version: 2022-06-28\' \\\n--data \'{\n  "grant_type": "authorization_code",\n  "code": "e202e8c9-0990-40af-855f-ff8f872b1ec6",\n  "redirect_uri": "https://wwww.my-integration-endpoint.dev/callback",\n   "external_account": {\n        "key": "A83823453409384",\n        "name": "Notion - team@makenotion.com"\n    }\n}\'';
            name: 'Create a token for a Link Preview';
          },
          {
            language: 'curl';
            code: 'curl --location --request POST \'https://api.notion.com/v1/databases/\' \\\n--header \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n--header \'Content-Type: application/json\' \\\n--header \'Notion-Version: 2022-06-28\' \\\n--data \'{\n\t"grant_type": "authorization_code",\n  "code": "e202e8c9-0990-40af-855f-ff8f872b1ec6",\n  "redirect_uri": "https://example.com/auth/notion/callback"\n}\'';
            name: 'Create a token for a public integration';
          },
        ];
        'samples-languages': ['curl'];
      };
    };
  };
};
export const paths = {
  '/v1/users/{user_id}': {
    get: {
      summary: 'Retrieve a user',
      description: '',
      operationId: 'get-user',
      parameters: [
        {
          name: 'user_id',
          in: 'path',
          description: 'Identifier for a Notion user',
          schema: {
            type: 'string',
          },
          required: true,
        },
        {
          name: 'Notion-Version',
          in: 'header',
          required: true,
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n  "object": "user",\n  "id": "d40e767c-d7af-4b18-a86d-55c61f1e39a4",\n  "type": "person",\n\t"person": {\n\t\t"email": "avo@example.org",\n\t},\n  "name": "Avocado Lovelace",\n  "avatar_url": "https://secure.notion-static.com/e6a352a8-8381-44d0-a1dc-9ed80e62b53d.jpg",\n}',
                },
              },
            },
          },
        },
        '400': {
          description: '400',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}',
                },
              },
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript',
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const userId = 'd40e767c-d7af-4b18-a86d-55c61f1e39a4';\n  const response = await notion.users.retrieve({ user_id: userId });\n  console.log(response);\n})();",
            name: 'Notion SDK for JavaScript',
          },
          {
            language: 'curl',
            code: "curl 'https://api.notion.com/v1/users/d40e767c-d7af-4b18-a86d-55c61f1e39a4' \\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"'' \\\n  -H \"Notion-Version: 2022-06-28\" \\",
          },
        ],
        'samples-languages': ['javascript', 'curl'],
      },
    },
  },
  '/v1/users': {
    get: {
      summary: 'List all users',
      description: '',
      operationId: 'get-users',
      parameters: [
        {
          name: 'start_cursor',
          in: 'query',
          description:
            'If supplied, this endpoint will return a page of results starting after the cursor provided. If not supplied, this endpoint will return the first page of results.',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'page_size',
          in: 'query',
          description: 'The number of items from the full list desired in the response. Maximum: 100',
          schema: {
            type: 'integer',
            format: 'int32',
            default: 100,
          },
        },
        {
          name: 'Notion-Version',
          in: 'header',
          required: true,
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n  "results": [\n    {\n      "object": "user",\n      "id": "d40e767c-d7af-4b18-a86d-55c61f1e39a4",\n      "type": "person",\n      "person": {\n        "email": "avo@example.org",\n      },\n      "name": "Avocado Lovelace",\n      "avatar_url": "https://secure.notion-static.com/e6a352a8-8381-44d0-a1dc-9ed80e62b53d.jpg",\n    },\n    {\n      "object": "user",\n      "id": "9a3b5ae0-c6e6-482d-b0e1-ed315ee6dc57",\n      "type": "bot",\n      "bot": {},\n      "name": "Doug Engelbot",\n      "avatar_url": "https://secure.notion-static.com/6720d746-3402-4171-8ebb-28d15144923c.jpg",\n    }\n  ],\n  "next_cursor": "fe2cc560-036c-44cd-90e8-294d5a74cebc",\n  "has_more": true\n}',
                },
              },
            },
          },
        },
        '400': {
          description: '400',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}',
                },
              },
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript',
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const response = await notion.users.list();\n  console.log(response);\n})();",
            name: 'Notion SDK for JavaScript',
          },
          {
            language: 'curl',
            code: "curl 'https://api.notion.com/v1/users' \\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"'' \\\n  -H \"Notion-Version: 2022-06-28\"",
          },
        ],
        'samples-languages': ['javascript', 'curl'],
      },
    },
  },
  '/v1/databases/{database_id}/query': {
    post: {
      summary: 'Query a database',
      description: '',
      operationId: 'post-database-query',
      parameters: [
        {
          name: 'database_id',
          in: 'path',
          description: 'Identifier for a Notion database.',
          schema: {
            type: 'string',
          },
          required: true,
        },
        {
          name: 'filter_properties',
          in: 'query',
          description:
            'A list of page property value IDs associated with the database. Use this param to limit the response to a specific page property value or values for pages that meet the `filter` criteria.',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'Notion-Version',
          in: 'header',
          required: true,
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                filter: {
                  type: 'string',
                  description:
                    'When supplied, limits which pages are returned based on the [filter conditions](ref:post-database-query-filter).',
                  format: 'json',
                },
                sorts: {
                  type: 'array',
                  description:
                    'When supplied, orders the results based on the provided [sort criteria](ref:post-database-query-sort).',
                },
                start_cursor: {
                  type: 'string',
                  description:
                    'When supplied, returns a page of results starting after the cursor provided. If not supplied, this endpoint will return the first page of results.',
                },
                page_size: {
                  type: 'integer',
                  description: 'The number of items from the full list desired in the response. Maximum: 100',
                  default: 100,
                  format: 'int32',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n  "object": "list",\n  "results": [\n    {\n      "object": "page",\n      "id": "59833787-2cf9-4fdf-8782-e53db20768a5",\n      "created_time": "2022-03-01T19:05:00.000Z",\n      "last_edited_time": "2022-07-06T20:25:00.000Z",\n      "created_by": {\n        "object": "user",\n        "id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n      },\n      "last_edited_by": {\n        "object": "user",\n        "id": "0c3e9826-b8f7-4f73-927d-2caaf86f1103"\n      },\n      "cover": {\n        "type": "external",\n        "external": {\n          "url": "https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg"\n        }\n      },\n      "icon": {\n        "type": "emoji",\n        "emoji": "🥬"\n      },\n      "parent": {\n        "type": "database_id",\n        "database_id": "d9824bdc-8445-4327-be8b-5b47500af6ce"\n      },\n      "archived": false,\n      "properties": {\n        "Store availability": {\n          "id": "%3AUPp",\n          "type": "multi_select",\n          "multi_select": [\n            {\n              "id": "t|O@",\n              "name": "Gus\'s Community Market",\n              "color": "yellow"\n            },\n            {\n              "id": "{Ml\\\\",\n              "name": "Rainbow Grocery",\n              "color": "gray"\n            }\n          ]\n        },\n        "Food group": {\n          "id": "A%40Hk",\n          "type": "select",\n          "select": {\n            "id": "5e8e7e8f-432e-4d8a-8166-1821e10225fc",\n            "name": "🥬 Vegetable",\n            "color": "pink"\n          }\n        },\n        "Price": {\n          "id": "BJXS",\n          "type": "number",\n          "number": 2.5\n        },\n        "Responsible Person": {\n          "id": "Iowm",\n          "type": "people",\n          "people": [\n            {\n              "object": "user",\n              "id": "cbfe3c6e-71cf-4cd3-b6e7-02f38f371bcc",\n              "name": "Cristina Cordova",\n              "avatar_url": "https://lh6.googleusercontent.com/-rapvfCoTq5A/AAAAAAAAAAI/AAAAAAAAAAA/AKF05nDKmmUpkpFvWNBzvu9rnZEy7cbl8Q/photo.jpg",\n              "type": "person",\n              "person": {\n                "email": "cristina@makenotion.com"\n              }\n            }\n          ]\n        },\n        "Last ordered": {\n          "id": "Jsfb",\n          "type": "date",\n          "date": {\n            "start": "2022-02-22",\n            "end": null,\n            "time_zone": null\n          }\n        },\n        "Cost of next trip": {\n          "id": "WOd%3B",\n          "type": "formula",\n          "formula": {\n            "type": "number",\n            "number": 0\n          }\n        },\n        "Recipes": {\n          "id": "YfIu",\n          "type": "relation",\n          "relation": [\n            {\n              "id": "90eeeed8-2cdd-4af4-9cc1-3d24aff5f63c"\n            },\n            {\n              "id": "a2da43ee-d43c-4285-8ae2-6d811f12629a"\n            }\n          ],\n\t\t\t\t\t"has_more": false\n        },\n        "Description": {\n          "id": "_Tc_",\n          "type": "rich_text",\n          "rich_text": [\n            {\n              "type": "text",\n              "text": {\n                "content": "A dark ",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n              },\n              "plain_text": "A dark ",\n              "href": null\n            },\n            {\n              "type": "text",\n              "text": {\n                "content": "green",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "green"\n              },\n              "plain_text": "green",\n              "href": null\n            },\n            {\n              "type": "text",\n              "text": {\n                "content": " leafy vegetable",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n              },\n              "plain_text": " leafy vegetable",\n              "href": null\n            }\n          ]\n        },\n        "In stock": {\n          "id": "%60%5Bq%3F",\n          "type": "checkbox",\n          "checkbox": true\n        },\n        "Number of meals": {\n          "id": "zag~",\n          "type": "rollup",\n          "rollup": {\n            "type": "number",\n            "number": 2,\n            "function": "count"\n          }\n        },\n        "Photo": {\n          "id": "%7DF_L",\n          "type": "url",\n          "url": "https://i.insider.com/612fb23c9ef1e50018f93198?width=1136&format=jpeg"\n        },\n        "Name": {\n          "id": "title",\n          "type": "title",\n          "title": [\n            {\n              "type": "text",\n              "text": {\n                "content": "Tuscan kale",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n              },\n              "plain_text": "Tuscan kale",\n              "href": null\n            }\n          ]\n        }\n      },\n      "url": "https://www.notion.so/Tuscan-kale-598337872cf94fdf8782e53db20768a5"\n    }\n  ],\n  "next_cursor": null,\n  "has_more": false,\n  "type": "page_or_database",\n\t"page_or_database": {}\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'list',
                  },
                  results: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        object: {
                          type: 'string',
                          example: 'page',
                        },
                        id: {
                          type: 'string',
                          example: '59833787-2cf9-4fdf-8782-e53db20768a5',
                        },
                        created_time: {
                          type: 'string',
                          example: '2022-03-01T19:05:00.000Z',
                        },
                        last_edited_time: {
                          type: 'string',
                          example: '2022-07-06T20:25:00.000Z',
                        },
                        created_by: {
                          type: 'object',
                          properties: {
                            object: {
                              type: 'string',
                              example: 'user',
                            },
                            id: {
                              type: 'string',
                              example: 'ee5f0f84-409a-440f-983a-a5315961c6e4',
                            },
                          },
                        },
                        last_edited_by: {
                          type: 'object',
                          properties: {
                            object: {
                              type: 'string',
                              example: 'user',
                            },
                            id: {
                              type: 'string',
                              example: '0c3e9826-b8f7-4f73-927d-2caaf86f1103',
                            },
                          },
                        },
                        cover: {
                          type: 'object',
                          properties: {
                            type: {
                              type: 'string',
                              example: 'external',
                            },
                            external: {
                              type: 'object',
                              properties: {
                                url: {
                                  type: 'string',
                                  example: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg',
                                },
                              },
                            },
                          },
                        },
                        icon: {
                          type: 'object',
                          properties: {
                            type: {
                              type: 'string',
                              example: 'emoji',
                            },
                            emoji: {
                              type: 'string',
                              example: '🥬',
                            },
                          },
                        },
                        parent: {
                          type: 'object',
                          properties: {
                            type: {
                              type: 'string',
                              example: 'database_id',
                            },
                            database_id: {
                              type: 'string',
                              example: 'd9824bdc-8445-4327-be8b-5b47500af6ce',
                            },
                          },
                        },
                        archived: {
                          type: 'boolean',
                          example: false,
                          default: true,
                        },
                        properties: {
                          type: 'object',
                          properties: {
                            'Store availability': {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: '%3AUPp',
                                },
                                type: {
                                  type: 'string',
                                  example: 'multi_select',
                                },
                                multi_select: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      id: {
                                        type: 'string',
                                        example: 't|O@',
                                      },
                                      name: {
                                        type: 'string',
                                        example: "Gus's Community Market",
                                      },
                                      color: {
                                        type: 'string',
                                        example: 'yellow',
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            'Food group': {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: 'A%40Hk',
                                },
                                type: {
                                  type: 'string',
                                  example: 'select',
                                },
                                select: {
                                  type: 'object',
                                  properties: {
                                    id: {
                                      type: 'string',
                                      example: '5e8e7e8f-432e-4d8a-8166-1821e10225fc',
                                    },
                                    name: {
                                      type: 'string',
                                      example: '🥬 Vegetable',
                                    },
                                    color: {
                                      type: 'string',
                                      example: 'pink',
                                    },
                                  },
                                },
                              },
                            },
                            Price: {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: 'BJXS',
                                },
                                type: {
                                  type: 'string',
                                  example: 'number',
                                },
                                number: {
                                  type: 'number',
                                  example: 2.5,
                                  default: 0,
                                },
                              },
                            },
                            'Responsible Person': {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: 'Iowm',
                                },
                                type: {
                                  type: 'string',
                                  example: 'people',
                                },
                                people: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      object: {
                                        type: 'string',
                                        example: 'user',
                                      },
                                      id: {
                                        type: 'string',
                                        example: 'cbfe3c6e-71cf-4cd3-b6e7-02f38f371bcc',
                                      },
                                      name: {
                                        type: 'string',
                                        example: 'Cristina Cordova',
                                      },
                                      avatar_url: {
                                        type: 'string',
                                        example:
                                          'https://lh6.googleusercontent.com/-rapvfCoTq5A/AAAAAAAAAAI/AAAAAAAAAAA/AKF05nDKmmUpkpFvWNBzvu9rnZEy7cbl8Q/photo.jpg',
                                      },
                                      type: {
                                        type: 'string',
                                        example: 'person',
                                      },
                                      person: {
                                        type: 'object',
                                        properties: {
                                          email: {
                                            type: 'string',
                                            example: 'cristina@makenotion.com',
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            'Last ordered': {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: 'Jsfb',
                                },
                                type: {
                                  type: 'string',
                                  example: 'date',
                                },
                                date: {
                                  type: 'object',
                                  properties: {
                                    start: {
                                      type: 'string',
                                      example: '2022-02-22',
                                    },
                                    end: {},
                                    time_zone: {},
                                  },
                                },
                              },
                            },
                            'Cost of next trip': {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: 'WOd%3B',
                                },
                                type: {
                                  type: 'string',
                                  example: 'formula',
                                },
                                formula: {
                                  type: 'object',
                                  properties: {
                                    type: {
                                      type: 'string',
                                      example: 'number',
                                    },
                                    number: {
                                      type: 'integer',
                                      example: 0,
                                      default: 0,
                                    },
                                  },
                                },
                              },
                            },
                            Recipes: {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: 'YfIu',
                                },
                                type: {
                                  type: 'string',
                                  example: 'relation',
                                },
                                relation: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      id: {
                                        type: 'string',
                                        example: '90eeeed8-2cdd-4af4-9cc1-3d24aff5f63c',
                                      },
                                    },
                                  },
                                },
                                has_more: {
                                  type: 'boolean',
                                  example: false,
                                  default: true,
                                },
                              },
                            },
                            Description: {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: '_Tc_',
                                },
                                type: {
                                  type: 'string',
                                  example: 'rich_text',
                                },
                                rich_text: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      type: {
                                        type: 'string',
                                        example: 'text',
                                      },
                                      text: {
                                        type: 'object',
                                        properties: {
                                          content: {
                                            type: 'string',
                                            example: 'A dark ',
                                          },
                                          link: {},
                                        },
                                      },
                                      annotations: {
                                        type: 'object',
                                        properties: {
                                          bold: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          italic: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          strikethrough: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          underline: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          code: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          color: {
                                            type: 'string',
                                            example: 'default',
                                          },
                                        },
                                      },
                                      plain_text: {
                                        type: 'string',
                                        example: 'A dark ',
                                      },
                                      href: {},
                                    },
                                  },
                                },
                              },
                            },
                            'In stock': {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: '%60%5Bq%3F',
                                },
                                type: {
                                  type: 'string',
                                  example: 'checkbox',
                                },
                                checkbox: {
                                  type: 'boolean',
                                  example: true,
                                  default: true,
                                },
                              },
                            },
                            'Number of meals': {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: 'zag~',
                                },
                                type: {
                                  type: 'string',
                                  example: 'rollup',
                                },
                                rollup: {
                                  type: 'object',
                                  properties: {
                                    type: {
                                      type: 'string',
                                      example: 'number',
                                    },
                                    number: {
                                      type: 'integer',
                                      example: 2,
                                      default: 0,
                                    },
                                    function: {
                                      type: 'string',
                                      example: 'count',
                                    },
                                  },
                                },
                              },
                            },
                            Photo: {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: '%7DF_L',
                                },
                                type: {
                                  type: 'string',
                                  example: 'url',
                                },
                                url: {
                                  type: 'string',
                                  example: 'https://i.insider.com/612fb23c9ef1e50018f93198?width=1136&format=jpeg',
                                },
                              },
                            },
                            Name: {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: 'title',
                                },
                                type: {
                                  type: 'string',
                                  example: 'title',
                                },
                                title: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      type: {
                                        type: 'string',
                                        example: 'text',
                                      },
                                      text: {
                                        type: 'object',
                                        properties: {
                                          content: {
                                            type: 'string',
                                            example: 'Tuscan kale',
                                          },
                                          link: {},
                                        },
                                      },
                                      annotations: {
                                        type: 'object',
                                        properties: {
                                          bold: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          italic: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          strikethrough: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          underline: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          code: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          color: {
                                            type: 'string',
                                            example: 'default',
                                          },
                                        },
                                      },
                                      plain_text: {
                                        type: 'string',
                                        example: 'Tuscan kale',
                                      },
                                      href: {},
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                        url: {
                          type: 'string',
                          example: 'https://www.notion.so/Tuscan-kale-598337872cf94fdf8782e53db20768a5',
                        },
                      },
                    },
                  },
                  next_cursor: {},
                  has_more: {
                    type: 'boolean',
                    example: false,
                    default: true,
                  },
                  type: {
                    type: 'string',
                    example: 'page_or_database',
                  },
                  page_or_database: {
                    type: 'object',
                    properties: {},
                  },
                },
              },
            },
          },
        },
        '400': {
          description: '400',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}',
                },
              },
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'curl',
            code: 'curl -X POST \'https://api.notion.com/v1/databases/897e5a76ae524b489fdfe71f5945d1af/query\' \\\n  -H \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n  -H \'Notion-Version: 2022-06-28\' \\\n  -H "Content-Type: application/json" \\\n--data \'{\n  "filter": {\n    "or": [\n      {\n        "property": "In stock",\n"checkbox": {\n"equals": true\n}\n      },\n      {\n"property": "Cost of next trip",\n"number": {\n"greater_than_or_equal_to": 2\n}\n}\n]\n},\n  "sorts": [\n    {\n      "property": "Last ordered",\n      "direction": "ascending"\n    }\n  ]\n}\'',
          },
          {
            language: 'javascript',
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const databaseId = 'd9824bdc-8445-4327-be8b-5b47500af6ce';\n  const response = await notion.databases.query({\n    database_id: databaseId,\n    filter: {\n      or: [\n        {\n          property: 'In stock',\n          checkbox: {\n            equals: true,\n          },\n        },\n        {\n          property: 'Cost of next trip',\n          number: {\n            greater_than_or_equal_to: 2,\n          },\n        },\n      ],\n    },\n    sorts: [\n      {\n        property: 'Last ordered',\n        direction: 'ascending',\n      },\n    ],\n  });\n  console.log(response);\n})();",
          },
        ],
        'samples-languages': ['curl', 'javascript'],
      },
    },
  },
  '/v1/search': {
    post: {
      summary: 'Search by title',
      description: '',
      operationId: 'post-search',
      parameters: [
        {
          name: 'Notion-Version',
          in: 'header',
          required: true,
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The text that the API compares page and database titles against.',
                },
                sort: {
                  type: 'object',
                  description:
                    'A set of criteria, `direction` and `timestamp` keys, that orders the results. The **only** supported timestamp value is `"last_edited_time"`. Supported `direction` values are `"ascending"` and `"descending"`. If `sort` is not provided, then the most recently edited results are returned first.',
                  properties: {
                    direction: {
                      type: 'string',
                      description: 'The direction to sort. Possible values include `ascending` and `descending`.',
                    },
                    timestamp: {
                      type: 'string',
                      description:
                        'The name of the timestamp to sort against. Possible values include `last_edited_time`.',
                    },
                  },
                },
                filter: {
                  type: 'object',
                  description:
                    'A set of criteria, `value` and `property` keys, that limits the results to either only pages or only databases. Possible `value` values are `"page"` or `"database"`. The only supported `property` value is `"object"`.',
                  properties: {
                    value: {
                      type: 'string',
                      description:
                        'The value of the property to filter the results by.  Possible values for object type include `page` or `database`.  **Limitation**: Currently the only filter allowed is `object` which will filter by type of object (either `page` or `database`)',
                    },
                    property: {
                      type: 'string',
                      description:
                        'The name of the property to filter by. Currently the only property you can filter by is the object type.  Possible values include `object`.   Limitation: Currently the only filter allowed is `object` which will filter by type of object (either `page` or `database`)',
                    },
                  },
                },
                start_cursor: {
                  type: 'string',
                  description:
                    'A `cursor` value returned in a previous response that If supplied, limits the response to results starting after the `cursor`. If not supplied, then the first page of results is returned. Refer to [pagination](https://developers.notion.com/reference/intro#pagination) for more details.',
                },
                page_size: {
                  type: 'integer',
                  description: 'The number of items from the full list to include in the response. Maximum: `100`.',
                  default: 100,
                  format: 'int32',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n  "object": "list",\n  "results": [\n    {\n      "object": "page",\n      "id": "954b67f9-3f87-41db-8874-23b92bbd31ee",\n      "created_time": "2022-07-06T19:30:00.000Z",\n      "last_edited_time": "2022-07-06T19:30:00.000Z",\n      "created_by": {\n        "object": "user",\n        "id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n      },\n      "last_edited_by": {\n        "object": "user",\n        "id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n      },\n      "cover": {\n        "type": "external",\n        "external": {\n          "url": "https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg"\n        }\n      },\n      "icon": {\n        "type": "emoji",\n        "emoji": "🥬"\n      },\n      "parent": {\n        "type": "database_id",\n        "database_id": "d9824bdc-8445-4327-be8b-5b47500af6ce"\n      },\n      "archived": false,\n      "properties": {\n        "Store availability": {\n          "id": "%3AUPp",\n          "type": "multi_select",\n          "multi_select": []\n        },\n        "Food group": {\n          "id": "A%40Hk",\n          "type": "select",\n          "select": {\n            "id": "5e8e7e8f-432e-4d8a-8166-1821e10225fc",\n            "name": "🥬 Vegetable",\n            "color": "pink"\n          }\n        },\n        "Price": {\n          "id": "BJXS",\n          "type": "number",\n          "number": null\n        },\n        "Responsible Person": {\n          "id": "Iowm",\n          "type": "people",\n          "people": []\n        },\n        "Last ordered": {\n          "id": "Jsfb",\n          "type": "date",\n          "date": null\n        },\n        "Cost of next trip": {\n          "id": "WOd%3B",\n          "type": "formula",\n          "formula": {\n            "type": "number",\n            "number": null\n          }\n        },\n        "Recipes": {\n          "id": "YfIu",\n          "type": "relation",\n          "relation": []\n        },\n        "Description": {\n          "id": "_Tc_",\n          "type": "rich_text",\n          "rich_text": [\n            {\n              "type": "text",\n              "text": {\n                "content": "A dark green leafy vegetable",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n              },\n              "plain_text": "A dark green leafy vegetable",\n              "href": null\n            }\n          ]\n        },\n        "In stock": {\n          "id": "%60%5Bq%3F",\n          "type": "checkbox",\n          "checkbox": false\n        },\n        "Number of meals": {\n          "id": "zag~",\n          "type": "rollup",\n          "rollup": {\n            "type": "number",\n            "number": 0,\n            "function": "count"\n          }\n        },\n        "Photo": {\n          "id": "%7DF_L",\n          "type": "url",\n          "url": null\n        },\n        "Name": {\n          "id": "title",\n          "type": "title",\n          "title": [\n            {\n              "type": "text",\n              "text": {\n                "content": "Tuscan kale",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n              },\n              "plain_text": "Tuscan kale",\n              "href": null\n            }\n          ]\n        }\n      },\n      "url": "https://www.notion.so/Tuscan-kale-954b67f93f8741db887423b92bbd31ee"\n    },\n    {\n      "object": "page",\n      "id": "59833787-2cf9-4fdf-8782-e53db20768a5",\n      "created_time": "2022-03-01T19:05:00.000Z",\n      "last_edited_time": "2022-07-06T20:25:00.000Z",\n      "created_by": {\n        "object": "user",\n        "id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n      },\n      "last_edited_by": {\n        "object": "user",\n        "id": "0c3e9826-b8f7-4f73-927d-2caaf86f1103"\n      },\n      "cover": {\n        "type": "external",\n        "external": {\n          "url": "https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg"\n        }\n      },\n      "icon": {\n        "type": "emoji",\n        "emoji": "🥬"\n      },\n      "parent": {\n        "type": "database_id",\n        "database_id": "d9824bdc-8445-4327-be8b-5b47500af6ce"\n      },\n      "archived": false,\n      "properties": {\n        "Store availability": {\n          "id": "%3AUPp",\n          "type": "multi_select",\n          "multi_select": [\n            {\n              "id": "t|O@",\n              "name": "Gus\'s Community Market",\n              "color": "yellow"\n            },\n            {\n              "id": "{Ml\\\\",\n              "name": "Rainbow Grocery",\n              "color": "gray"\n            }\n          ]\n        },\n        "Food group": {\n          "id": "A%40Hk",\n          "type": "select",\n          "select": {\n            "id": "5e8e7e8f-432e-4d8a-8166-1821e10225fc",\n            "name": "🥬 Vegetable",\n            "color": "pink"\n          }\n        },\n        "Price": {\n          "id": "BJXS",\n          "type": "number",\n          "number": 2.5\n        },\n        "Responsible Person": {\n          "id": "Iowm",\n          "type": "people",\n          "people": [\n            {\n              "object": "user",\n              "id": "cbfe3c6e-71cf-4cd3-b6e7-02f38f371bcc",\n              "name": "Cristina Cordova",\n              "avatar_url": "https://lh6.googleusercontent.com/-rapvfCoTq5A/AAAAAAAAAAI/AAAAAAAAAAA/AKF05nDKmmUpkpFvWNBzvu9rnZEy7cbl8Q/photo.jpg",\n              "type": "person",\n              "person": {\n                "email": "cristina@makenotion.com"\n              }\n            }\n          ]\n        },\n        "Last ordered": {\n          "id": "Jsfb",\n          "type": "date",\n          "date": {\n            "start": "2022-02-22",\n            "end": null,\n            "time_zone": null\n          }\n        },\n        "Cost of next trip": {\n          "id": "WOd%3B",\n          "type": "formula",\n          "formula": {\n            "type": "number",\n            "number": 0\n          }\n        },\n        "Recipes": {\n          "id": "YfIu",\n          "type": "relation",\n          "relation": [\n            {\n              "id": "90eeeed8-2cdd-4af4-9cc1-3d24aff5f63c"\n            },\n            {\n              "id": "a2da43ee-d43c-4285-8ae2-6d811f12629a"\n            }\n          ],\n\t\t\t\t\t"has_more": false\n        },\n        "Description": {\n          "id": "_Tc_",\n          "type": "rich_text",\n          "rich_text": [\n            {\n              "type": "text",\n              "text": {\n                "content": "A dark ",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n              },\n              "plain_text": "A dark ",\n              "href": null\n            },\n            {\n              "type": "text",\n              "text": {\n                "content": "green",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "green"\n              },\n              "plain_text": "green",\n              "href": null\n            },\n            {\n              "type": "text",\n              "text": {\n                "content": " leafy vegetable",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n              },\n              "plain_text": " leafy vegetable",\n              "href": null\n            }\n          ]\n        },\n        "In stock": {\n          "id": "%60%5Bq%3F",\n          "type": "checkbox",\n          "checkbox": true\n        },\n        "Number of meals": {\n          "id": "zag~",\n          "type": "rollup",\n          "rollup": {\n            "type": "number",\n            "number": 2,\n            "function": "count"\n          }\n        },\n        "Photo": {\n          "id": "%7DF_L",\n          "type": "url",\n          "url": "https://i.insider.com/612fb23c9ef1e50018f93198?width=1136&format=jpeg"\n        },\n        "Name": {\n          "id": "title",\n          "type": "title",\n          "title": [\n            {\n              "type": "text",\n              "text": {\n                "content": "Tuscan kale",\n                "link": null\n              },\n              "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n              },\n              "plain_text": "Tuscan kale",\n              "href": null\n            }\n          ]\n        }\n      },\n      "url": "https://www.notion.so/Tuscan-kale-598337872cf94fdf8782e53db20768a5"\n    }\n  ],\n  "next_cursor": null,\n  "has_more": false,\n  "type": "page_or_database",\n  "page_or_database": {}\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'list',
                  },
                  results: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        object: {
                          type: 'string',
                          example: 'page',
                        },
                        id: {
                          type: 'string',
                          example: '954b67f9-3f87-41db-8874-23b92bbd31ee',
                        },
                        created_time: {
                          type: 'string',
                          example: '2022-07-06T19:30:00.000Z',
                        },
                        last_edited_time: {
                          type: 'string',
                          example: '2022-07-06T19:30:00.000Z',
                        },
                        created_by: {
                          type: 'object',
                          properties: {
                            object: {
                              type: 'string',
                              example: 'user',
                            },
                            id: {
                              type: 'string',
                              example: 'ee5f0f84-409a-440f-983a-a5315961c6e4',
                            },
                          },
                        },
                        last_edited_by: {
                          type: 'object',
                          properties: {
                            object: {
                              type: 'string',
                              example: 'user',
                            },
                            id: {
                              type: 'string',
                              example: 'ee5f0f84-409a-440f-983a-a5315961c6e4',
                            },
                          },
                        },
                        cover: {
                          type: 'object',
                          properties: {
                            type: {
                              type: 'string',
                              example: 'external',
                            },
                            external: {
                              type: 'object',
                              properties: {
                                url: {
                                  type: 'string',
                                  example: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg',
                                },
                              },
                            },
                          },
                        },
                        icon: {
                          type: 'object',
                          properties: {
                            type: {
                              type: 'string',
                              example: 'emoji',
                            },
                            emoji: {
                              type: 'string',
                              example: '🥬',
                            },
                          },
                        },
                        parent: {
                          type: 'object',
                          properties: {
                            type: {
                              type: 'string',
                              example: 'database_id',
                            },
                            database_id: {
                              type: 'string',
                              example: 'd9824bdc-8445-4327-be8b-5b47500af6ce',
                            },
                          },
                        },
                        archived: {
                          type: 'boolean',
                          example: false,
                          default: true,
                        },
                        properties: {
                          type: 'object',
                          properties: {
                            'Store availability': {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: '%3AUPp',
                                },
                                type: {
                                  type: 'string',
                                  example: 'multi_select',
                                },
                                multi_select: {
                                  type: 'array',
                                },
                              },
                            },
                            'Food group': {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: 'A%40Hk',
                                },
                                type: {
                                  type: 'string',
                                  example: 'select',
                                },
                                select: {
                                  type: 'object',
                                  properties: {
                                    id: {
                                      type: 'string',
                                      example: '5e8e7e8f-432e-4d8a-8166-1821e10225fc',
                                    },
                                    name: {
                                      type: 'string',
                                      example: '🥬 Vegetable',
                                    },
                                    color: {
                                      type: 'string',
                                      example: 'pink',
                                    },
                                  },
                                },
                              },
                            },
                            Price: {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: 'BJXS',
                                },
                                type: {
                                  type: 'string',
                                  example: 'number',
                                },
                                number: {},
                              },
                            },
                            'Responsible Person': {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: 'Iowm',
                                },
                                type: {
                                  type: 'string',
                                  example: 'people',
                                },
                                people: {
                                  type: 'array',
                                },
                              },
                            },
                            'Last ordered': {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: 'Jsfb',
                                },
                                type: {
                                  type: 'string',
                                  example: 'date',
                                },
                                date: {},
                              },
                            },
                            'Cost of next trip': {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: 'WOd%3B',
                                },
                                type: {
                                  type: 'string',
                                  example: 'formula',
                                },
                                formula: {
                                  type: 'object',
                                  properties: {
                                    type: {
                                      type: 'string',
                                      example: 'number',
                                    },
                                    number: {},
                                  },
                                },
                              },
                            },
                            Recipes: {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: 'YfIu',
                                },
                                type: {
                                  type: 'string',
                                  example: 'relation',
                                },
                                relation: {
                                  type: 'array',
                                },
                              },
                            },
                            Description: {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: '_Tc_',
                                },
                                type: {
                                  type: 'string',
                                  example: 'rich_text',
                                },
                                rich_text: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      type: {
                                        type: 'string',
                                        example: 'text',
                                      },
                                      text: {
                                        type: 'object',
                                        properties: {
                                          content: {
                                            type: 'string',
                                            example: 'A dark green leafy vegetable',
                                          },
                                          link: {},
                                        },
                                      },
                                      annotations: {
                                        type: 'object',
                                        properties: {
                                          bold: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          italic: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          strikethrough: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          underline: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          code: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          color: {
                                            type: 'string',
                                            example: 'default',
                                          },
                                        },
                                      },
                                      plain_text: {
                                        type: 'string',
                                        example: 'A dark green leafy vegetable',
                                      },
                                      href: {},
                                    },
                                  },
                                },
                              },
                            },
                            'In stock': {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: '%60%5Bq%3F',
                                },
                                type: {
                                  type: 'string',
                                  example: 'checkbox',
                                },
                                checkbox: {
                                  type: 'boolean',
                                  example: false,
                                  default: true,
                                },
                              },
                            },
                            'Number of meals': {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: 'zag~',
                                },
                                type: {
                                  type: 'string',
                                  example: 'rollup',
                                },
                                rollup: {
                                  type: 'object',
                                  properties: {
                                    type: {
                                      type: 'string',
                                      example: 'number',
                                    },
                                    number: {
                                      type: 'integer',
                                      example: 0,
                                      default: 0,
                                    },
                                    function: {
                                      type: 'string',
                                      example: 'count',
                                    },
                                  },
                                },
                              },
                            },
                            Photo: {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: '%7DF_L',
                                },
                                type: {
                                  type: 'string',
                                  example: 'url',
                                },
                                url: {},
                              },
                            },
                            Name: {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: 'title',
                                },
                                type: {
                                  type: 'string',
                                  example: 'title',
                                },
                                title: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      type: {
                                        type: 'string',
                                        example: 'text',
                                      },
                                      text: {
                                        type: 'object',
                                        properties: {
                                          content: {
                                            type: 'string',
                                            example: 'Tuscan kale',
                                          },
                                          link: {},
                                        },
                                      },
                                      annotations: {
                                        type: 'object',
                                        properties: {
                                          bold: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          italic: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          strikethrough: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          underline: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          code: {
                                            type: 'boolean',
                                            example: false,
                                            default: true,
                                          },
                                          color: {
                                            type: 'string',
                                            example: 'default',
                                          },
                                        },
                                      },
                                      plain_text: {
                                        type: 'string',
                                        example: 'Tuscan kale',
                                      },
                                      href: {},
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                        url: {
                          type: 'string',
                          example: 'https://www.notion.so/Tuscan-kale-954b67f93f8741db887423b92bbd31ee',
                        },
                      },
                    },
                  },
                  next_cursor: {},
                  has_more: {
                    type: 'boolean',
                    example: false,
                    default: true,
                  },
                  type: {
                    type: 'string',
                    example: 'page_or_database',
                  },
                  page_or_database: {
                    type: 'object',
                    properties: {},
                  },
                },
              },
            },
          },
        },
        '400': {
          description: '400',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n    "object": "error",\n    "status": 400,\n    "code": "invalid_json",\n    "message": "Error parsing JSON body."\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'error',
                  },
                  status: {
                    type: 'integer',
                    example: 400,
                    default: 0,
                  },
                  code: {
                    type: 'string',
                    example: 'invalid_json',
                  },
                  message: {
                    type: 'string',
                    example: 'Error parsing JSON body.',
                  },
                },
              },
            },
          },
        },
        '429': {
          description: '429',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n  "object": "error",\n  "status": 429,\n  "code": "rate_limited",\n  "message": "You have been rate limited. Please try again in a few minutes."\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'error',
                  },
                  status: {
                    type: 'integer',
                    example: 429,
                    default: 0,
                  },
                  code: {
                    type: 'string',
                    example: 'rate_limited',
                  },
                  message: {
                    type: 'string',
                    example: 'You have been rate limited. Please try again in a few minutes.',
                  },
                },
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript',
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const response = await notion.search({\n    query: 'External tasks',\n    filter: {\n      value: 'database',\n      property: 'object'\n    },\n    sort: {\n      direction: 'ascending',\n      timestamp: 'last_edited_time'\n    },\n  });\n  console.log(response);\n})();",
            name: 'Notion SDK for JavaScript',
          },
          {
            language: 'curl',
            code: 'curl -X POST \'https://api.notion.com/v1/search\' \\\n  -H \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n  -H \'Content-Type: application/json\' \\\n  -H \'Notion-Version: 2022-06-28\' \\\n  --data \'{\n    "query":"External tasks",\n    "filter": {\n        "value": "database",\n        "property": "object"\n    },\n    "sort":{\n      "direction":"ascending",\n      "timestamp":"last_edited_time"\n    }\n  }\'',
          },
        ],
        'samples-languages': ['javascript', 'curl'],
      },
    },
  },
  '/v1/blocks/{block_id}/children': {
    get: {
      summary: 'Retrieve block children',
      description: '',
      operationId: 'get-block-children',
      parameters: [
        {
          name: 'block_id',
          in: 'path',
          description: 'Identifier for a [block](ref:block)',
          schema: {
            type: 'string',
          },
          required: true,
        },
        {
          name: 'start_cursor',
          in: 'query',
          description:
            'If supplied, this endpoint will return a page of results starting after the cursor provided. If not supplied, this endpoint will return the first page of results.',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'page_size',
          in: 'query',
          description: 'The number of items from the full list desired in the response. Maximum: 100',
          schema: {
            type: 'integer',
            format: 'int32',
            default: 100,
          },
        },
        {
          name: 'Notion-Version',
          in: 'header',
          required: true,
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n\t"object": "list",\n\t"results": [\n\t\t{\n\t\t\t"object": "block",\n\t\t\t"id": "c02fc1d3-db8b-45c5-a222-27595b15aea7",\n\t\t\t"parent": {\n\t\t\t\t"type": "page_id",\n\t\t\t\t"page_id": "59833787-2cf9-4fdf-8782-e53db20768a5"\n\t\t\t},\n\t\t\t"created_time": "2022-03-01T19:05:00.000Z",\n\t\t\t"last_edited_time": "2022-03-01T19:05:00.000Z",\n\t\t\t"created_by": {\n\t\t\t\t"object": "user",\n\t\t\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t\t\t},\n\t\t\t"last_edited_by": {\n\t\t\t\t"object": "user",\n\t\t\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t\t\t},\n\t\t\t"has_children": false,\n\t\t\t"archived": false,\n\t\t\t"type": "heading_2",\n\t\t\t"heading_2": {\n\t\t\t\t"rich_text": [\n\t\t\t\t\t{\n\t\t\t\t\t\t"type": "text",\n\t\t\t\t\t\t"text": {\n\t\t\t\t\t\t\t"content": "Lacinato kale",\n\t\t\t\t\t\t\t"link": null\n\t\t\t\t\t\t},\n\t\t\t\t\t\t"annotations": {\n\t\t\t\t\t\t\t"bold": false,\n\t\t\t\t\t\t\t"italic": false,\n\t\t\t\t\t\t\t"strikethrough": false,\n\t\t\t\t\t\t\t"underline": false,\n\t\t\t\t\t\t\t"code": false,\n\t\t\t\t\t\t\t"color": "default"\n\t\t\t\t\t\t},\n\t\t\t\t\t\t"plain_text": "Lacinato kale",\n\t\t\t\t\t\t"href": null\n\t\t\t\t\t}\n\t\t\t\t],\n\t\t\t\t"color": "default",\n        "is_toggleable": false\n\t\t\t}\n\t\t},\n\t\t{\n\t\t\t"object": "block",\n\t\t\t"id": "acc7eb06-05cd-4603-a384-5e1e4f1f4e72",\n\t\t\t"parent": {\n\t\t\t\t"type": "page_id",\n\t\t\t\t"page_id": "59833787-2cf9-4fdf-8782-e53db20768a5"\n\t\t\t},\n\t\t\t"created_time": "2022-03-01T19:05:00.000Z",\n\t\t\t"last_edited_time": "2022-03-01T19:05:00.000Z",\n\t\t\t"created_by": {\n\t\t\t\t"object": "user",\n\t\t\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t\t\t},\n\t\t\t"last_edited_by": {\n\t\t\t\t"object": "user",\n\t\t\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t\t\t},\n\t\t\t"has_children": false,\n\t\t\t"archived": false,\n\t\t\t"type": "paragraph",\n\t\t\t"paragraph": {\n\t\t\t\t"rich_text": [\n\t\t\t\t\t{\n\t\t\t\t\t\t"type": "text",\n\t\t\t\t\t\t"text": {\n\t\t\t\t\t\t\t"content": "Lacinato kale is a variety of kale with a long tradition in Italian cuisine, especially that of Tuscany. It is also known as Tuscan kale, Italian kale, dinosaur kale, kale, flat back kale, palm tree kale, or black Tuscan palm.",\n\t\t\t\t\t\t\t"link": {\n\t\t\t\t\t\t\t\t"url": "https://en.wikipedia.org/wiki/Lacinato_kale"\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t},\n\t\t\t\t\t\t"annotations": {\n\t\t\t\t\t\t\t"bold": false,\n\t\t\t\t\t\t\t"italic": false,\n\t\t\t\t\t\t\t"strikethrough": false,\n\t\t\t\t\t\t\t"underline": false,\n\t\t\t\t\t\t\t"code": false,\n\t\t\t\t\t\t\t"color": "default"\n\t\t\t\t\t\t},\n\t\t\t\t\t\t"plain_text": "Lacinato kale is a variety of kale with a long tradition in Italian cuisine, especially that of Tuscany. It is also known as Tuscan kale, Italian kale, dinosaur kale, kale, flat back kale, palm tree kale, or black Tuscan palm.",\n\t\t\t\t\t\t"href": "https://en.wikipedia.org/wiki/Lacinato_kale"\n\t\t\t\t\t}\n\t\t\t\t],\n\t\t\t\t"color": "default"\n\t\t\t}\n\t\t}\n\t],\n\t"next_cursor": null,\n\t"has_more": false,\n\t"type": "block",\n\t"block": {}\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'list',
                  },
                  results: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        object: {
                          type: 'string',
                          example: 'block',
                        },
                        id: {
                          type: 'string',
                          example: 'c02fc1d3-db8b-45c5-a222-27595b15aea7',
                        },
                        parent: {
                          type: 'object',
                          properties: {
                            type: {
                              type: 'string',
                              example: 'page_id',
                            },
                            page_id: {
                              type: 'string',
                              example: '59833787-2cf9-4fdf-8782-e53db20768a5',
                            },
                          },
                        },
                        created_time: {
                          type: 'string',
                          example: '2022-03-01T19:05:00.000Z',
                        },
                        last_edited_time: {
                          type: 'string',
                          example: '2022-03-01T19:05:00.000Z',
                        },
                        created_by: {
                          type: 'object',
                          properties: {
                            object: {
                              type: 'string',
                              example: 'user',
                            },
                            id: {
                              type: 'string',
                              example: 'ee5f0f84-409a-440f-983a-a5315961c6e4',
                            },
                          },
                        },
                        last_edited_by: {
                          type: 'object',
                          properties: {
                            object: {
                              type: 'string',
                              example: 'user',
                            },
                            id: {
                              type: 'string',
                              example: 'ee5f0f84-409a-440f-983a-a5315961c6e4',
                            },
                          },
                        },
                        has_children: {
                          type: 'boolean',
                          example: false,
                          default: true,
                        },
                        archived: {
                          type: 'boolean',
                          example: false,
                          default: true,
                        },
                        type: {
                          type: 'string',
                          example: 'heading_2',
                        },
                        heading_2: {
                          type: 'object',
                          properties: {
                            rich_text: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  type: {
                                    type: 'string',
                                    example: 'text',
                                  },
                                  text: {
                                    type: 'object',
                                    properties: {
                                      content: {
                                        type: 'string',
                                        example: 'Lacinato kale',
                                      },
                                      link: {},
                                    },
                                  },
                                  annotations: {
                                    type: 'object',
                                    properties: {
                                      bold: {
                                        type: 'boolean',
                                        example: false,
                                        default: true,
                                      },
                                      italic: {
                                        type: 'boolean',
                                        example: false,
                                        default: true,
                                      },
                                      strikethrough: {
                                        type: 'boolean',
                                        example: false,
                                        default: true,
                                      },
                                      underline: {
                                        type: 'boolean',
                                        example: false,
                                        default: true,
                                      },
                                      code: {
                                        type: 'boolean',
                                        example: false,
                                        default: true,
                                      },
                                      color: {
                                        type: 'string',
                                        example: 'default',
                                      },
                                    },
                                  },
                                  plain_text: {
                                    type: 'string',
                                    example: 'Lacinato kale',
                                  },
                                  href: {},
                                },
                              },
                            },
                            color: {
                              type: 'string',
                              example: 'default',
                            },
                            is_toggleable: {
                              type: 'boolean',
                              example: false,
                              default: true,
                            },
                          },
                        },
                      },
                    },
                  },
                  next_cursor: {},
                  has_more: {
                    type: 'boolean',
                    example: false,
                    default: true,
                  },
                  type: {
                    type: 'string',
                    example: 'block',
                  },
                  block: {
                    type: 'object',
                    properties: {},
                  },
                },
              },
            },
          },
        },
        '400': {
          description: '400',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}',
                },
              },
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript',
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const blockId = '59833787-2cf9-4fdf-8782-e53db20768a5';\n  const response = await notion.blocks.children.list({\n    block_id: blockId,\n    page_size: 50,\n  });\n  console.log(response);\n})();",
            name: 'Notion SDK for JavaScript',
          },
          {
            language: 'curl',
            code: "curl 'https://api.notion.com/v1/blocks/b55c9c91-384d-452b-81db-d1ef79372b75/children?page_size=100' \\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"'' \\\n  -H \"Notion-Version: 2022-06-28\"",
          },
        ],
        'samples-languages': ['javascript', 'curl'],
      },
    },
    patch: {
      summary: 'Append block children',
      description: '',
      operationId: 'patch-block-children',
      parameters: [
        {
          name: 'block_id',
          in: 'path',
          description: 'Identifier for a [block](ref:block). Also accepts a [page](ref:page) ID.',
          schema: {
            type: 'string',
          },
          required: true,
        },
        {
          name: 'Notion-Version',
          in: 'header',
          required: true,
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['children'],
              properties: {
                children: {
                  type: 'array',
                  description: 'Child content to append to a container block as an array of [block objects](ref:block)',
                },
                after: {
                  type: 'string',
                  description: 'The ID of the existing block that the new block should be appended after.',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n\t"object": "list",\n\t"results": [\n\t\t{\n\t\t\t"object": "block",\n\t\t\t"id": "c02fc1d3-db8b-45c5-a222-27595b15aea7",\n\t\t\t"parent": {\n\t\t\t\t"type": "page_id",\n\t\t\t\t"page_id": "59833787-2cf9-4fdf-8782-e53db20768a5"\n\t\t\t},\n\t\t\t"created_time": "2022-03-01T19:05:00.000Z",\n\t\t\t"last_edited_time": "2022-07-06T19:41:00.000Z",\n\t\t\t"created_by": {\n\t\t\t\t"object": "user",\n\t\t\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t\t\t},\n\t\t\t"last_edited_by": {\n\t\t\t\t"object": "user",\n\t\t\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t\t\t},\n\t\t\t"has_children": false,\n\t\t\t"archived": false,\n\t\t\t"type": "heading_2",\n\t\t\t"heading_2": {\n\t\t\t\t"rich_text": [\n\t\t\t\t\t{\n\t\t\t\t\t\t"type": "text",\n\t\t\t\t\t\t"text": {\n\t\t\t\t\t\t\t"content": "Lacinato kale",\n\t\t\t\t\t\t\t"link": null\n\t\t\t\t\t\t},\n\t\t\t\t\t\t"annotations": {\n\t\t\t\t\t\t\t"bold": false,\n\t\t\t\t\t\t\t"italic": false,\n\t\t\t\t\t\t\t"strikethrough": false,\n\t\t\t\t\t\t\t"underline": false,\n\t\t\t\t\t\t\t"code": false,\n\t\t\t\t\t\t\t"color": "default"\n\t\t\t\t\t\t},\n\t\t\t\t\t\t"plain_text": "Lacinato kale",\n\t\t\t\t\t\t"href": null\n\t\t\t\t\t}\n\t\t\t\t],\n\t\t\t\t"color": "default",\n        "is_toggleable": false\n\t\t\t}\n\t\t},\n\t\t{\n\t\t\t"object": "block",\n\t\t\t"id": "acc7eb06-05cd-4603-a384-5e1e4f1f4e72",\n\t\t\t"parent": {\n\t\t\t\t"type": "page_id",\n\t\t\t\t"page_id": "59833787-2cf9-4fdf-8782-e53db20768a5"\n\t\t\t},\n\t\t\t"created_time": "2022-03-01T19:05:00.000Z",\n\t\t\t"last_edited_time": "2022-07-06T19:51:00.000Z",\n\t\t\t"created_by": {\n\t\t\t\t"object": "user",\n\t\t\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t\t\t},\n\t\t\t"last_edited_by": {\n\t\t\t\t"object": "user",\n\t\t\t\t"id": "0c3e9826-b8f7-4f73-927d-2caaf86f1103"\n\t\t\t},\n\t\t\t"has_children": false,\n\t\t\t"archived": false,\n\t\t\t"type": "paragraph",\n\t\t\t"paragraph": {\n\t\t\t\t"rich_text": [\n\t\t\t\t\t{\n\t\t\t\t\t\t"type": "text",\n\t\t\t\t\t\t"text": {\n\t\t\t\t\t\t\t"content": "Lacinato kale is a variety of kale with a long tradition in Italian cuisine, especially that of Tuscany. It is also known as Tuscan kale, Italian kale, dinosaur kale, kale, flat back kale, palm tree kale, or black Tuscan palm.",\n\t\t\t\t\t\t\t"link": {\n\t\t\t\t\t\t\t\t"url": "https://en.wikipedia.org/wiki/Lacinato_kale"\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t},\n\t\t\t\t\t\t"annotations": {\n\t\t\t\t\t\t\t"bold": false,\n\t\t\t\t\t\t\t"italic": false,\n\t\t\t\t\t\t\t"strikethrough": false,\n\t\t\t\t\t\t\t"underline": false,\n\t\t\t\t\t\t\t"code": false,\n\t\t\t\t\t\t\t"color": "default"\n\t\t\t\t\t\t},\n\t\t\t\t\t\t"plain_text": "Lacinato kale is a variety of kale with a long tradition in Italian cuisine, especially that of Tuscany. It is also known as Tuscan kale, Italian kale, dinosaur kale, kale, flat back kale, palm tree kale, or black Tuscan palm.",\n\t\t\t\t\t\t"href": "https://en.wikipedia.org/wiki/Lacinato_kale"\n\t\t\t\t\t}\n\t\t\t\t],\n\t\t\t\t"color": "default"\n\t\t\t}\n\t\t}\n\t],\n\t"next_cursor": null,\n\t"has_more": false,\n\t"type": "block",\n\t"block": {}\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'list',
                  },
                  results: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        object: {
                          type: 'string',
                          example: 'block',
                        },
                        id: {
                          type: 'string',
                          example: 'c02fc1d3-db8b-45c5-a222-27595b15aea7',
                        },
                        parent: {
                          type: 'object',
                          properties: {
                            type: {
                              type: 'string',
                              example: 'page_id',
                            },
                            page_id: {
                              type: 'string',
                              example: '59833787-2cf9-4fdf-8782-e53db20768a5',
                            },
                          },
                        },
                        created_time: {
                          type: 'string',
                          example: '2022-03-01T19:05:00.000Z',
                        },
                        last_edited_time: {
                          type: 'string',
                          example: '2022-07-06T19:41:00.000Z',
                        },
                        created_by: {
                          type: 'object',
                          properties: {
                            object: {
                              type: 'string',
                              example: 'user',
                            },
                            id: {
                              type: 'string',
                              example: 'ee5f0f84-409a-440f-983a-a5315961c6e4',
                            },
                          },
                        },
                        last_edited_by: {
                          type: 'object',
                          properties: {
                            object: {
                              type: 'string',
                              example: 'user',
                            },
                            id: {
                              type: 'string',
                              example: 'ee5f0f84-409a-440f-983a-a5315961c6e4',
                            },
                          },
                        },
                        has_children: {
                          type: 'boolean',
                          example: false,
                          default: true,
                        },
                        archived: {
                          type: 'boolean',
                          example: false,
                          default: true,
                        },
                        type: {
                          type: 'string',
                          example: 'heading_2',
                        },
                        heading_2: {
                          type: 'object',
                          properties: {
                            rich_text: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  type: {
                                    type: 'string',
                                    example: 'text',
                                  },
                                  text: {
                                    type: 'object',
                                    properties: {
                                      content: {
                                        type: 'string',
                                        example: 'Lacinato kale',
                                      },
                                      link: {},
                                    },
                                  },
                                  annotations: {
                                    type: 'object',
                                    properties: {
                                      bold: {
                                        type: 'boolean',
                                        example: false,
                                        default: true,
                                      },
                                      italic: {
                                        type: 'boolean',
                                        example: false,
                                        default: true,
                                      },
                                      strikethrough: {
                                        type: 'boolean',
                                        example: false,
                                        default: true,
                                      },
                                      underline: {
                                        type: 'boolean',
                                        example: false,
                                        default: true,
                                      },
                                      code: {
                                        type: 'boolean',
                                        example: false,
                                        default: true,
                                      },
                                      color: {
                                        type: 'string',
                                        example: 'default',
                                      },
                                    },
                                  },
                                  plain_text: {
                                    type: 'string',
                                    example: 'Lacinato kale',
                                  },
                                  href: {},
                                },
                              },
                            },
                            color: {
                              type: 'string',
                              example: 'default',
                            },
                            is_toggleable: {
                              type: 'boolean',
                              example: false,
                              default: true,
                            },
                          },
                        },
                      },
                    },
                  },
                  next_cursor: {},
                  has_more: {
                    type: 'boolean',
                    example: false,
                    default: true,
                  },
                  type: {
                    type: 'string',
                    example: 'block',
                  },
                  block: {
                    type: 'object',
                    properties: {},
                  },
                },
              },
            },
          },
        },
        '400': {
          description: '400',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}',
                },
              },
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript',
            code: 'const { Client } = require(\'@notionhq/client\');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const blockId = \'b55c9c91-384d-452b-81db-d1ef79372b75\';\n  const response = await notion.blocks.children.append({\n    block_id: blockId,\n    children: [\n      {\n        "heading_2": {\n          "rich_text": [\n            {\n              "text": {\n                "content": "Lacinato kale"\n              }\n            }\n          ]\n        }\n      },\n      {\n        "paragraph": {\n          "rich_text": [\n            {\n              "text": {\n                "content": "Lacinato kale is a variety of kale with a long tradition in Italian cuisine, especially that of Tuscany. It is also known as Tuscan kale, Italian kale, dinosaur kale, kale, flat back kale, palm tree kale, or black Tuscan palm.",\n                "link": {\n                  "url": "https://en.wikipedia.org/wiki/Lacinato_kale"\n                }\n              }\n            }\n          ]\n        }\n      }\n    ],\n  });\n  console.log(response);\n})();',
            name: 'Notion SDK for JavaScript',
          },
          {
            language: 'curl',
            code: 'curl -X PATCH \'https://api.notion.com/v1/blocks/b55c9c91-384d-452b-81db-d1ef79372b75/children\' \\\n  -H \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n  -H "Content-Type: application/json" \\\n  -H "Notion-Version: 2022-06-28" \\\n  --data \'{\n\t"children": [\n\t\t{\n\t\t\t"object": "block",\n\t\t\t"type": "heading_2",\n\t\t\t"heading_2": {\n\t\t\t\t"rich_text": [{ "type": "text", "text": { "content": "Lacinato kale" } }]\n\t\t\t}\n\t\t},\n\t\t{\n\t\t\t"object": "block",\n\t\t\t"type": "paragraph",\n\t\t\t"paragraph": {\n\t\t\t\t"rich_text": [\n\t\t\t\t\t{\n\t\t\t\t\t\t"type": "text",\n\t\t\t\t\t\t"text": {\n\t\t\t\t\t\t\t"content": "Lacinato kale is a variety of kale with a long tradition in Italian cuisine, especially that of Tuscany. It is also known as Tuscan kale, Italian kale, dinosaur kale, kale, flat back kale, palm tree kale, or black Tuscan palm.",\n\t\t\t\t\t\t\t"link": { "url": "https://en.wikipedia.org/wiki/Lacinato_kale" }\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t]\n\t\t\t}\n\t\t}\n\t]\n}\'',
          },
        ],
        'samples-languages': ['javascript', 'curl'],
      },
    },
  },
  '/v1/blocks/{block_id}': {
    get: {
      summary: 'Retrieve a block',
      description: '',
      operationId: 'retrieve-a-block',
      parameters: [
        {
          name: 'block_id',
          in: 'path',
          description: 'Identifier for a Notion block',
          schema: {
            type: 'string',
          },
          required: true,
        },
        {
          name: 'Notion-Version',
          in: 'header',
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n\t"object": "block",\n\t"id": "c02fc1d3-db8b-45c5-a222-27595b15aea7",\n\t"parent": {\n\t\t"type": "page_id",\n\t\t"page_id": "59833787-2cf9-4fdf-8782-e53db20768a5"\n\t},\n\t"created_time": "2022-03-01T19:05:00.000Z",\n\t"last_edited_time": "2022-03-01T19:05:00.000Z",\n\t"created_by": {\n\t\t"object": "user",\n\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t},\n\t"last_edited_by": {\n\t\t"object": "user",\n\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t},\n\t"has_children": false,\n\t"archived": false,\n\t"type": "heading_2",\n\t"heading_2": {\n\t\t"rich_text": [\n\t\t\t{\n\t\t\t\t"type": "text",\n\t\t\t\t"text": {\n\t\t\t\t\t"content": "Lacinato kale",\n\t\t\t\t\t"link": null\n\t\t\t\t},\n\t\t\t\t"annotations": {\n\t\t\t\t\t"bold": false,\n\t\t\t\t\t"italic": false,\n\t\t\t\t\t"strikethrough": false,\n\t\t\t\t\t"underline": false,\n\t\t\t\t\t"code": false,\n\t\t\t\t\t"color": "default"\n\t\t\t\t},\n\t\t\t\t"plain_text": "Lacinato kale",\n\t\t\t\t"href": null\n\t\t\t}\n\t\t],\n\t\t"color": "default",\n    "is_toggleable": false\n\t}\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'block',
                  },
                  id: {
                    type: 'string',
                    example: 'c02fc1d3-db8b-45c5-a222-27595b15aea7',
                  },
                  parent: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        example: 'page_id',
                      },
                      page_id: {
                        type: 'string',
                        example: '59833787-2cf9-4fdf-8782-e53db20768a5',
                      },
                    },
                  },
                  created_time: {
                    type: 'string',
                    example: '2022-03-01T19:05:00.000Z',
                  },
                  last_edited_time: {
                    type: 'string',
                    example: '2022-03-01T19:05:00.000Z',
                  },
                  created_by: {
                    type: 'object',
                    properties: {
                      object: {
                        type: 'string',
                        example: 'user',
                      },
                      id: {
                        type: 'string',
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4',
                      },
                    },
                  },
                  last_edited_by: {
                    type: 'object',
                    properties: {
                      object: {
                        type: 'string',
                        example: 'user',
                      },
                      id: {
                        type: 'string',
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4',
                      },
                    },
                  },
                  has_children: {
                    type: 'boolean',
                    example: false,
                    default: true,
                  },
                  archived: {
                    type: 'boolean',
                    example: false,
                    default: true,
                  },
                  type: {
                    type: 'string',
                    example: 'heading_2',
                  },
                  heading_2: {
                    type: 'object',
                    properties: {
                      rich_text: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            type: {
                              type: 'string',
                              example: 'text',
                            },
                            text: {
                              type: 'object',
                              properties: {
                                content: {
                                  type: 'string',
                                  example: 'Lacinato kale',
                                },
                                link: {},
                              },
                            },
                            annotations: {
                              type: 'object',
                              properties: {
                                bold: {
                                  type: 'boolean',
                                  example: false,
                                  default: true,
                                },
                                italic: {
                                  type: 'boolean',
                                  example: false,
                                  default: true,
                                },
                                strikethrough: {
                                  type: 'boolean',
                                  example: false,
                                  default: true,
                                },
                                underline: {
                                  type: 'boolean',
                                  example: false,
                                  default: true,
                                },
                                code: {
                                  type: 'boolean',
                                  example: false,
                                  default: true,
                                },
                                color: {
                                  type: 'string',
                                  example: 'default',
                                },
                              },
                            },
                            plain_text: {
                              type: 'string',
                              example: 'Lacinato kale',
                            },
                            href: {},
                          },
                        },
                      },
                      color: {
                        type: 'string',
                        example: 'default',
                      },
                      is_toggleable: {
                        type: 'boolean',
                        example: false,
                        default: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '400': {
          description: '400',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}',
                },
              },
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript',
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const blockId = 'c02fc1d3-db8b-45c5-a222-27595b15aea7';\n  const response = await notion.blocks.retrieve({\n    block_id: blockId,\n  });\n  console.log(response);\n})();",
            name: 'Notion SDK for JavaScript',
          },
          {
            language: 'curl',
            code: "curl 'https://api.notion.com/v1/blocks/0c940186-ab70-4351-bb34-2d16f0635d49' \\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"'' \\\n  -H 'Notion-Version: 2022-06-28'",
          },
        ],
        'samples-languages': ['javascript', 'curl'],
      },
    },
    patch: {
      summary: 'Update a block',
      description: '',
      operationId: 'update-a-block',
      parameters: [
        {
          name: 'block_id',
          in: 'path',
          description: 'Identifier for a Notion block',
          schema: {
            type: 'string',
          },
          required: true,
        },
        {
          name: 'Notion-Version',
          in: 'header',
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                '{type}': {
                  type: 'object',
                  description:
                    'The [block object `type`](ref:block#block-object-keys) value with the properties to be updated. Currently only `text` (for supported block types) and `checked` (for `to_do` blocks) fields can be updated.',
                  properties: {},
                },
                archived: {
                  type: 'boolean',
                  description: 'Set to true to archive (delete) a block. Set to false to un-archive (restore) a block.',
                  default: true,
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n\t"object": "block",\n\t"id": "c02fc1d3-db8b-45c5-a222-27595b15aea7",\n\t"parent": {\n\t\t"type": "page_id",\n\t\t"page_id": "59833787-2cf9-4fdf-8782-e53db20768a5"\n\t},\n\t"created_time": "2022-03-01T19:05:00.000Z",\n\t"last_edited_time": "2022-07-06T19:41:00.000Z",\n\t"created_by": {\n\t\t"object": "user",\n\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t},\n\t"last_edited_by": {\n\t\t"object": "user",\n\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t},\n\t"has_children": false,\n\t"archived": false,\n\t"type": "heading_2",\n\t"heading_2": {\n\t\t"rich_text": [\n\t\t\t{\n\t\t\t\t"type": "text",\n\t\t\t\t"text": {\n\t\t\t\t\t"content": "Lacinato kale",\n\t\t\t\t\t"link": null\n\t\t\t\t},\n\t\t\t\t"annotations": {\n\t\t\t\t\t"bold": false,\n\t\t\t\t\t"italic": false,\n\t\t\t\t\t"strikethrough": false,\n\t\t\t\t\t"underline": false,\n\t\t\t\t\t"code": false,\n\t\t\t\t\t"color": "green"\n\t\t\t\t},\n\t\t\t\t"plain_text": "Lacinato kale",\n\t\t\t\t"href": null\n\t\t\t}\n\t\t],\n\t\t"color": "default",\n    "is_toggleable": false\n\t}\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'block',
                  },
                  id: {
                    type: 'string',
                    example: 'c02fc1d3-db8b-45c5-a222-27595b15aea7',
                  },
                  parent: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        example: 'page_id',
                      },
                      page_id: {
                        type: 'string',
                        example: '59833787-2cf9-4fdf-8782-e53db20768a5',
                      },
                    },
                  },
                  created_time: {
                    type: 'string',
                    example: '2022-03-01T19:05:00.000Z',
                  },
                  last_edited_time: {
                    type: 'string',
                    example: '2022-07-06T19:41:00.000Z',
                  },
                  created_by: {
                    type: 'object',
                    properties: {
                      object: {
                        type: 'string',
                        example: 'user',
                      },
                      id: {
                        type: 'string',
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4',
                      },
                    },
                  },
                  last_edited_by: {
                    type: 'object',
                    properties: {
                      object: {
                        type: 'string',
                        example: 'user',
                      },
                      id: {
                        type: 'string',
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4',
                      },
                    },
                  },
                  has_children: {
                    type: 'boolean',
                    example: false,
                    default: true,
                  },
                  archived: {
                    type: 'boolean',
                    example: false,
                    default: true,
                  },
                  type: {
                    type: 'string',
                    example: 'heading_2',
                  },
                  heading_2: {
                    type: 'object',
                    properties: {
                      rich_text: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            type: {
                              type: 'string',
                              example: 'text',
                            },
                            text: {
                              type: 'object',
                              properties: {
                                content: {
                                  type: 'string',
                                  example: 'Lacinato kale',
                                },
                                link: {},
                              },
                            },
                            annotations: {
                              type: 'object',
                              properties: {
                                bold: {
                                  type: 'boolean',
                                  example: false,
                                  default: true,
                                },
                                italic: {
                                  type: 'boolean',
                                  example: false,
                                  default: true,
                                },
                                strikethrough: {
                                  type: 'boolean',
                                  example: false,
                                  default: true,
                                },
                                underline: {
                                  type: 'boolean',
                                  example: false,
                                  default: true,
                                },
                                code: {
                                  type: 'boolean',
                                  example: false,
                                  default: true,
                                },
                                color: {
                                  type: 'string',
                                  example: 'green',
                                },
                              },
                            },
                            plain_text: {
                              type: 'string',
                              example: 'Lacinato kale',
                            },
                            href: {},
                          },
                        },
                      },
                      color: {
                        type: 'string',
                        example: 'default',
                      },
                      is_toggleable: {
                        type: 'boolean',
                        example: false,
                        default: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '400': {
          description: '400',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}',
                },
              },
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript',
            code: 'const { Client } = require(\'@notionhq/client\');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const blockId = \'9bc30ad4-9373-46a5-84ab-0a7845ee52e6\';\n  const response = await notion.blocks.update({\n\t"block_id": blockId,\n\t"heading_2": {\n\t\t"rich_text": [\n\t\t\t{\n\t\t\t\t"text": {\n\t\t\t\t\t"content": "Lacinato kale"\n\t\t\t\t},\n\t\t\t\t"annotations": {\n\t\t\t\t\t"color": "green"\n\t\t\t\t}\n\t\t\t}\n\t\t]\n\t}\n});\n  console.log(response);\n})();',
            name: 'Notion SDK for JavaScript',
          },
          {
            language: 'curl',
            code: 'curl https://api.notion.com/v1/blocks/9bc30ad4-9373-46a5-84ab-0a7845ee52e6 \\\n  -H \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n  -H "Content-Type: application/json" \\\n  -H "Notion-Version: 2022-06-28" \\\n  -X PATCH \\\n  --data \'{\n  "to_do": {\n    "rich_text": [{ \n      "text": { "content": "Lacinato kale" } \n      }],\n    "checked": false\n  }\n}\'',
          },
        ],
        'samples-languages': ['javascript', 'curl'],
      },
    },
    delete: {
      summary: 'Delete a block',
      description: '',
      operationId: 'delete-a-block',
      parameters: [
        {
          name: 'block_id',
          in: 'path',
          description: 'Identifier for a Notion block',
          schema: {
            type: 'string',
          },
          required: true,
        },
        {
          name: 'Notion-Version',
          in: 'header',
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n\t"object": "block",\n\t"id": "7985540b-2e77-4ac6-8615-c3047e36f872",\n\t"parent": {\n\t\t"type": "page_id",\n\t\t"page_id": "59833787-2cf9-4fdf-8782-e53db20768a5"\n\t},\n\t"created_time": "2022-07-06T19:52:00.000Z",\n\t"last_edited_time": "2022-07-06T19:52:00.000Z",\n\t"created_by": {\n\t\t"object": "user",\n\t\t"id": "0c3e9826-b8f7-4f73-927d-2caaf86f1103"\n\t},\n\t"last_edited_by": {\n\t\t"object": "user",\n\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t},\n\t"has_children": false,\n\t"archived": true,\n\t"type": "paragraph",\n\t"paragraph": {\n\t\t"rich_text": [],\n\t\t"color": "default"\n\t}\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'block',
                  },
                  id: {
                    type: 'string',
                    example: '7985540b-2e77-4ac6-8615-c3047e36f872',
                  },
                  parent: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        example: 'page_id',
                      },
                      page_id: {
                        type: 'string',
                        example: '59833787-2cf9-4fdf-8782-e53db20768a5',
                      },
                    },
                  },
                  created_time: {
                    type: 'string',
                    example: '2022-07-06T19:52:00.000Z',
                  },
                  last_edited_time: {
                    type: 'string',
                    example: '2022-07-06T19:52:00.000Z',
                  },
                  created_by: {
                    type: 'object',
                    properties: {
                      object: {
                        type: 'string',
                        example: 'user',
                      },
                      id: {
                        type: 'string',
                        example: '0c3e9826-b8f7-4f73-927d-2caaf86f1103',
                      },
                    },
                  },
                  last_edited_by: {
                    type: 'object',
                    properties: {
                      object: {
                        type: 'string',
                        example: 'user',
                      },
                      id: {
                        type: 'string',
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4',
                      },
                    },
                  },
                  has_children: {
                    type: 'boolean',
                    example: false,
                    default: true,
                  },
                  archived: {
                    type: 'boolean',
                    example: true,
                    default: true,
                  },
                  type: {
                    type: 'string',
                    example: 'paragraph',
                  },
                  paragraph: {
                    type: 'object',
                    properties: {
                      rich_text: {
                        type: 'array',
                      },
                      color: {
                        type: 'string',
                        example: 'default',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '400': {
          description: '400',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}',
                },
              },
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript',
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const blockId = '7985540b-2e77-4ac6-8615-c3047e36f872';\n  const response = await notion.blocks.delete({\n    block_id: blockId,\n  });\n  console.log(response);\n})();",
            name: 'Notion SDK for JavaScript',
          },
          {
            language: 'curl',
            code: "curl -X DELETE 'https://api.notion.com/v1/blocks/9bc30ad4-9373-46a5-84ab-0a7845ee52e6' \\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"'' \\\n  -H 'Notion-Version: 2022-06-28'",
          },
        ],
        'samples-languages': ['javascript', 'curl'],
      },
    },
  },
  '/v1/pages/{page_id}': {
    get: {
      summary: 'Retrieve a page',
      description: '',
      operationId: 'retrieve-a-page',
      parameters: [
        {
          name: 'page_id',
          in: 'path',
          description: 'Identifier for a Notion page',
          schema: {
            type: 'string',
          },
          required: true,
        },
        {
          name: 'filter_properties',
          in: 'query',
          description:
            'A list of page property value IDs associated with the page. Use this param to limit the response to a specific page property value or values. To retrieve multiple properties, specify each page property ID. For example: `?filter_properties=iAk8&filter_properties=b7dh`.',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'Notion-Version',
          in: 'header',
          required: true,
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n  "object": "page",\n  "id": "59833787-2cf9-4fdf-8782-e53db20768a5",\n  "created_time": "2022-03-01T19:05:00.000Z",\n  "last_edited_time": "2022-07-06T20:25:00.000Z",\n  "created_by": {\n    "object": "user",\n    "id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n  },\n  "last_edited_by": {\n    "object": "user",\n    "id": "0c3e9826-b8f7-4f73-927d-2caaf86f1103"\n  },\n  "cover": {\n    "type": "external",\n    "external": {\n      "url": "https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg"\n    }\n  },\n  "icon": {\n    "type": "emoji",\n    "emoji": "🥬"\n  },\n  "parent": {\n    "type": "database_id",\n    "database_id": "d9824bdc-8445-4327-be8b-5b47500af6ce"\n  },\n  "archived": false,\n  "properties": {\n    "Store availability": {\n      "id": "%3AUPp",\n      "type": "multi_select",\n      "multi_select": [\n        {\n          "id": "t|O@",\n          "name": "Gus\'s Community Market",\n          "color": "yellow"\n        },\n        {\n          "id": "{Ml\\\\",\n          "name": "Rainbow Grocery",\n          "color": "gray"\n        }\n      ]\n    },\n    "Food group": {\n      "id": "A%40Hk",\n      "type": "select",\n      "select": {\n        "id": "5e8e7e8f-432e-4d8a-8166-1821e10225fc",\n        "name": "🥬 Vegetable",\n        "color": "pink"\n      }\n    },\n    "Price": {\n      "id": "BJXS",\n      "type": "number",\n      "number": 2.5\n    },\n    "Responsible Person": {\n      "id": "Iowm",\n      "type": "people",\n      "people": [\n        {\n          "object": "user",\n          "id": "cbfe3c6e-71cf-4cd3-b6e7-02f38f371bcc",\n          "name": "Cristina Cordova",\n          "avatar_url": "https://lh6.googleusercontent.com/-rapvfCoTq5A/AAAAAAAAAAI/AAAAAAAAAAA/AKF05nDKmmUpkpFvWNBzvu9rnZEy7cbl8Q/photo.jpg",\n          "type": "person",\n          "person": {\n            "email": "cristina@makenotion.com"\n          }\n        }\n      ]\n    },\n    "Last ordered": {\n      "id": "Jsfb",\n      "type": "date",\n      "date": {\n        "start": "2022-02-22",\n        "end": null,\n        "time_zone": null\n      }\n    },\n    "Cost of next trip": {\n      "id": "WOd%3B",\n      "type": "formula",\n      "formula": {\n        "type": "number",\n        "number": 0\n      }\n    },\n    "Recipes": {\n      "id": "YfIu",\n      "type": "relation",\n      "relation": [\n        {\n          "id": "90eeeed8-2cdd-4af4-9cc1-3d24aff5f63c"\n        },\n        {\n          "id": "a2da43ee-d43c-4285-8ae2-6d811f12629a"\n        }\n      ],\n\t\t\t"has_more": false\n    },\n    "Description": {\n      "id": "_Tc_",\n      "type": "rich_text",\n      "rich_text": [\n        {\n          "type": "text",\n          "text": {\n            "content": "A dark ",\n            "link": null\n          },\n          "annotations": {\n            "bold": false,\n            "italic": false,\n            "strikethrough": false,\n            "underline": false,\n            "code": false,\n            "color": "default"\n          },\n          "plain_text": "A dark ",\n          "href": null\n        },\n        {\n          "type": "text",\n          "text": {\n            "content": "green",\n            "link": null\n          },\n          "annotations": {\n            "bold": false,\n            "italic": false,\n            "strikethrough": false,\n            "underline": false,\n            "code": false,\n            "color": "green"\n          },\n          "plain_text": "green",\n          "href": null\n        },\n        {\n          "type": "text",\n          "text": {\n            "content": " leafy vegetable",\n            "link": null\n          },\n          "annotations": {\n            "bold": false,\n            "italic": false,\n            "strikethrough": false,\n            "underline": false,\n            "code": false,\n            "color": "default"\n          },\n          "plain_text": " leafy vegetable",\n          "href": null\n        }\n      ]\n    },\n    "In stock": {\n      "id": "%60%5Bq%3F",\n      "type": "checkbox",\n      "checkbox": true\n    },\n    "Number of meals": {\n      "id": "zag~",\n      "type": "rollup",\n      "rollup": {\n        "type": "number",\n        "number": 2,\n        "function": "count"\n      }\n    },\n    "Photo": {\n      "id": "%7DF_L",\n      "type": "url",\n      "url": "https://i.insider.com/612fb23c9ef1e50018f93198?width=1136&format=jpeg"\n    },\n    "Name": {\n      "id": "title",\n      "type": "title",\n      "title": [\n        {\n          "type": "text",\n          "text": {\n            "content": "Tuscan kale",\n            "link": null\n          },\n          "annotations": {\n            "bold": false,\n            "italic": false,\n            "strikethrough": false,\n            "underline": false,\n            "code": false,\n            "color": "default"\n          },\n          "plain_text": "Tuscan kale",\n          "href": null\n        }\n      ]\n    }\n  },\n  "url": "https://www.notion.so/Tuscan-kale-598337872cf94fdf8782e53db20768a5",\n  "public_url": null\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'page',
                  },
                  id: {
                    type: 'string',
                    example: '59833787-2cf9-4fdf-8782-e53db20768a5',
                  },
                  created_time: {
                    type: 'string',
                    example: '2022-03-01T19:05:00.000Z',
                  },
                  last_edited_time: {
                    type: 'string',
                    example: '2022-07-06T20:25:00.000Z',
                  },
                  created_by: {
                    type: 'object',
                    properties: {
                      object: {
                        type: 'string',
                        example: 'user',
                      },
                      id: {
                        type: 'string',
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4',
                      },
                    },
                  },
                  last_edited_by: {
                    type: 'object',
                    properties: {
                      object: {
                        type: 'string',
                        example: 'user',
                      },
                      id: {
                        type: 'string',
                        example: '0c3e9826-b8f7-4f73-927d-2caaf86f1103',
                      },
                    },
                  },
                  cover: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        example: 'external',
                      },
                      external: {
                        type: 'object',
                        properties: {
                          url: {
                            type: 'string',
                            example: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg',
                          },
                        },
                      },
                    },
                  },
                  icon: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        example: 'emoji',
                      },
                      emoji: {
                        type: 'string',
                        example: '🥬',
                      },
                    },
                  },
                  parent: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        example: 'database_id',
                      },
                      database_id: {
                        type: 'string',
                        example: 'd9824bdc-8445-4327-be8b-5b47500af6ce',
                      },
                    },
                  },
                  archived: {
                    type: 'boolean',
                    example: false,
                    default: true,
                  },
                  properties: {
                    type: 'object',
                    properties: {
                      'Store availability': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: '%3AUPp',
                          },
                          type: {
                            type: 'string',
                            example: 'multi_select',
                          },
                          multi_select: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: 't|O@',
                                },
                                name: {
                                  type: 'string',
                                  example: "Gus's Community Market",
                                },
                                color: {
                                  type: 'string',
                                  example: 'yellow',
                                },
                              },
                            },
                          },
                        },
                      },
                      'Food group': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'A%40Hk',
                          },
                          type: {
                            type: 'string',
                            example: 'select',
                          },
                          select: {
                            type: 'object',
                            properties: {
                              id: {
                                type: 'string',
                                example: '5e8e7e8f-432e-4d8a-8166-1821e10225fc',
                              },
                              name: {
                                type: 'string',
                                example: '🥬 Vegetable',
                              },
                              color: {
                                type: 'string',
                                example: 'pink',
                              },
                            },
                          },
                        },
                      },
                      Price: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'BJXS',
                          },
                          type: {
                            type: 'string',
                            example: 'number',
                          },
                          number: {
                            type: 'number',
                            example: 2.5,
                            default: 0,
                          },
                        },
                      },
                      'Responsible Person': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'Iowm',
                          },
                          type: {
                            type: 'string',
                            example: 'people',
                          },
                          people: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                object: {
                                  type: 'string',
                                  example: 'user',
                                },
                                id: {
                                  type: 'string',
                                  example: 'cbfe3c6e-71cf-4cd3-b6e7-02f38f371bcc',
                                },
                                name: {
                                  type: 'string',
                                  example: 'Cristina Cordova',
                                },
                                avatar_url: {
                                  type: 'string',
                                  example:
                                    'https://lh6.googleusercontent.com/-rapvfCoTq5A/AAAAAAAAAAI/AAAAAAAAAAA/AKF05nDKmmUpkpFvWNBzvu9rnZEy7cbl8Q/photo.jpg',
                                },
                                type: {
                                  type: 'string',
                                  example: 'person',
                                },
                                person: {
                                  type: 'object',
                                  properties: {
                                    email: {
                                      type: 'string',
                                      example: 'cristina@makenotion.com',
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                      'Last ordered': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'Jsfb',
                          },
                          type: {
                            type: 'string',
                            example: 'date',
                          },
                          date: {
                            type: 'object',
                            properties: {
                              start: {
                                type: 'string',
                                example: '2022-02-22',
                              },
                              end: {},
                              time_zone: {},
                            },
                          },
                        },
                      },
                      'Cost of next trip': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'WOd%3B',
                          },
                          type: {
                            type: 'string',
                            example: 'formula',
                          },
                          formula: {
                            type: 'object',
                            properties: {
                              type: {
                                type: 'string',
                                example: 'number',
                              },
                              number: {
                                type: 'integer',
                                example: 0,
                                default: 0,
                              },
                            },
                          },
                        },
                      },
                      Recipes: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'YfIu',
                          },
                          type: {
                            type: 'string',
                            example: 'relation',
                          },
                          relation: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: {
                                  type: 'string',
                                  example: '90eeeed8-2cdd-4af4-9cc1-3d24aff5f63c',
                                },
                              },
                            },
                          },
                          has_more: {
                            type: 'boolean',
                            example: false,
                            default: true,
                          },
                        },
                      },
                      Description: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: '_Tc_',
                          },
                          type: {
                            type: 'string',
                            example: 'rich_text',
                          },
                          rich_text: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                type: {
                                  type: 'string',
                                  example: 'text',
                                },
                                text: {
                                  type: 'object',
                                  properties: {
                                    content: {
                                      type: 'string',
                                      example: 'A dark ',
                                    },
                                    link: {},
                                  },
                                },
                                annotations: {
                                  type: 'object',
                                  properties: {
                                    bold: {
                                      type: 'boolean',
                                      example: false,
                                      default: true,
                                    },
                                    italic: {
                                      type: 'boolean',
                                      example: false,
                                      default: true,
                                    },
                                    strikethrough: {
                                      type: 'boolean',
                                      example: false,
                                      default: true,
                                    },
                                    underline: {
                                      type: 'boolean',
                                      example: false,
                                      default: true,
                                    },
                                    code: {
                                      type: 'boolean',
                                      example: false,
                                      default: true,
                                    },
                                    color: {
                                      type: 'string',
                                      example: 'default',
                                    },
                                  },
                                },
                                plain_text: {
                                  type: 'string',
                                  example: 'A dark ',
                                },
                                href: {},
                              },
                            },
                          },
                        },
                      },
                      'In stock': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: '%60%5Bq%3F',
                          },
                          type: {
                            type: 'string',
                            example: 'checkbox',
                          },
                          checkbox: {
                            type: 'boolean',
                            example: true,
                            default: true,
                          },
                        },
                      },
                      'Number of meals': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'zag~',
                          },
                          type: {
                            type: 'string',
                            example: 'rollup',
                          },
                          rollup: {
                            type: 'object',
                            properties: {
                              type: {
                                type: 'string',
                                example: 'number',
                              },
                              number: {
                                type: 'integer',
                                example: 2,
                                default: 0,
                              },
                              function: {
                                type: 'string',
                                example: 'count',
                              },
                            },
                          },
                        },
                      },
                      Photo: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: '%7DF_L',
                          },
                          type: {
                            type: 'string',
                            example: 'url',
                          },
                          url: {
                            type: 'string',
                            example: 'https://i.insider.com/612fb23c9ef1e50018f93198?width=1136&format=jpeg',
                          },
                        },
                      },
                      Name: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'title',
                          },
                          type: {
                            type: 'string',
                            example: 'title',
                          },
                          title: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                type: {
                                  type: 'string',
                                  example: 'text',
                                },
                                text: {
                                  type: 'object',
                                  properties: {
                                    content: {
                                      type: 'string',
                                      example: 'Tuscan kale',
                                    },
                                    link: {},
                                  },
                                },
                                annotations: {
                                  type: 'object',
                                  properties: {
                                    bold: {
                                      type: 'boolean',
                                      example: false,
                                      default: true,
                                    },
                                    italic: {
                                      type: 'boolean',
                                      example: false,
                                      default: true,
                                    },
                                    strikethrough: {
                                      type: 'boolean',
                                      example: false,
                                      default: true,
                                    },
                                    underline: {
                                      type: 'boolean',
                                      example: false,
                                      default: true,
                                    },
                                    code: {
                                      type: 'boolean',
                                      example: false,
                                      default: true,
                                    },
                                    color: {
                                      type: 'string',
                                      example: 'default',
                                    },
                                  },
                                },
                                plain_text: {
                                  type: 'string',
                                  example: 'Tuscan kale',
                                },
                                href: {},
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  url: {
                    type: 'string',
                    example: 'https://www.notion.so/Tuscan-kale-598337872cf94fdf8782e53db20768a5',
                  },
                  public_url: {},
                },
              },
            },
          },
        },
        '400': {
          description: '400',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}',
                },
              },
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript',
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const pageId = '59833787-2cf9-4fdf-8782-e53db20768a5';\n  const response = await notion.pages.retrieve({ page_id: pageId });\n  console.log(response);\n})();",
            name: 'Notion SDK for JavaScript',
          },
          {
            language: 'curl',
            code: "curl 'https://api.notion.com/v1/pages/b55c9c91-384d-452b-81db-d1ef79372b75' \\\n  -H 'Notion-Version: 2022-06-28' \\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"''",
          },
        ],
        'samples-languages': ['javascript', 'curl'],
      },
    },
    patch: {
      summary: 'Update page properties',
      description: '',
      operationId: 'patch-page',
      parameters: [
        {
          name: 'page_id',
          in: 'path',
          description: 'The identifier for the Notion page to be updated.',
          schema: {
            type: 'string',
          },
          required: true,
        },
        {
          name: 'Notion-Version',
          in: 'header',
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                properties: {
                  type: 'string',
                  description:
                    'The property values to update for the page. The keys are the names or IDs of the property and the values are property values. If a page property ID is not included, then it is not changed.',
                  format: 'json',
                },
                in_trash: {
                  type: 'boolean',
                  description: 'Set to true to delete a block. Set to false to restore a block.',
                  default: false,
                },
                icon: {
                  type: 'string',
                  description:
                    'A page icon for the page. Supported types are [external file object](https://developers.notion.com/reference/file-object) or [emoji object](https://developers.notion.com/reference/emoji-object).',
                  format: 'json',
                },
                cover: {
                  type: 'string',
                  description:
                    'A cover image for the page. Only [external file objects](https://developers.notion.com/reference/file-object) are supported.',
                  format: 'json',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n\t"object": "page",\n\t"id": "59833787-2cf9-4fdf-8782-e53db20768a5",\n\t"created_time": "2022-03-01T19:05:00.000Z",\n\t"last_edited_time": "2022-07-06T19:16:00.000Z",\n\t"created_by": {\n\t\t"object": "user",\n\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t},\n\t"last_edited_by": {\n\t\t"object": "user",\n\t\t"id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n\t},\n\t"cover": {\n\t\t"type": "external",\n\t\t"external": {\n\t\t\t"url": "https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg"\n\t\t}\n\t},\n\t"icon": {\n\t\t"type": "emoji",\n\t\t"emoji": "🥬"\n\t},\n\t"parent": {\n\t\t"type": "database_id",\n\t\t"database_id": "d9824bdc-8445-4327-be8b-5b47500af6ce"\n\t},\n\t"archived": false,\n\t"properties": {\n\t\t"Store availability": {\n\t\t\t"id": "%3AUPp"\n\t\t},\n\t\t"Food group": {\n\t\t\t"id": "A%40Hk"\n\t\t},\n\t\t"Price": {\n\t\t\t"id": "BJXS"\n\t\t},\n\t\t"Responsible Person": {\n\t\t\t"id": "Iowm"\n\t\t},\n\t\t"Last ordered": {\n\t\t\t"id": "Jsfb"\n\t\t},\n\t\t"Cost of next trip": {\n\t\t\t"id": "WOd%3B"\n\t\t},\n\t\t"Recipes": {\n\t\t\t"id": "YfIu"\n\t\t},\n\t\t"Description": {\n\t\t\t"id": "_Tc_"\n\t\t},\n\t\t"In stock": {\n\t\t\t"id": "%60%5Bq%3F"\n\t\t},\n\t\t"Number of meals": {\n\t\t\t"id": "zag~"\n\t\t},\n\t\t"Photo": {\n\t\t\t"id": "%7DF_L"\n\t\t},\n\t\t"Name": {\n\t\t\t"id": "title"\n\t\t}\n\t},\n\t"url": "https://www.notion.so/Tuscan-Kale-598337872cf94fdf8782e53db20768a5"\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'page',
                  },
                  id: {
                    type: 'string',
                    example: '59833787-2cf9-4fdf-8782-e53db20768a5',
                  },
                  created_time: {
                    type: 'string',
                    example: '2022-03-01T19:05:00.000Z',
                  },
                  last_edited_time: {
                    type: 'string',
                    example: '2022-07-06T19:16:00.000Z',
                  },
                  created_by: {
                    type: 'object',
                    properties: {
                      object: {
                        type: 'string',
                        example: 'user',
                      },
                      id: {
                        type: 'string',
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4',
                      },
                    },
                  },
                  last_edited_by: {
                    type: 'object',
                    properties: {
                      object: {
                        type: 'string',
                        example: 'user',
                      },
                      id: {
                        type: 'string',
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4',
                      },
                    },
                  },
                  cover: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        example: 'external',
                      },
                      external: {
                        type: 'object',
                        properties: {
                          url: {
                            type: 'string',
                            example: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg',
                          },
                        },
                      },
                    },
                  },
                  icon: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        example: 'emoji',
                      },
                      emoji: {
                        type: 'string',
                        example: '🥬',
                      },
                    },
                  },
                  parent: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        example: 'database_id',
                      },
                      database_id: {
                        type: 'string',
                        example: 'd9824bdc-8445-4327-be8b-5b47500af6ce',
                      },
                    },
                  },
                  archived: {
                    type: 'boolean',
                    example: false,
                    default: true,
                  },
                  properties: {
                    type: 'object',
                    properties: {
                      'Store availability': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: '%3AUPp',
                          },
                        },
                      },
                      'Food group': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'A%40Hk',
                          },
                        },
                      },
                      Price: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'BJXS',
                          },
                        },
                      },
                      'Responsible Person': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'Iowm',
                          },
                        },
                      },
                      'Last ordered': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'Jsfb',
                          },
                        },
                      },
                      'Cost of next trip': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'WOd%3B',
                          },
                        },
                      },
                      Recipes: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'YfIu',
                          },
                        },
                      },
                      Description: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: '_Tc_',
                          },
                        },
                      },
                      'In stock': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: '%60%5Bq%3F',
                          },
                        },
                      },
                      'Number of meals': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'zag~',
                          },
                        },
                      },
                      Photo: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: '%7DF_L',
                          },
                        },
                      },
                      Name: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'title',
                          },
                        },
                      },
                    },
                  },
                  url: {
                    type: 'string',
                    example: 'https://www.notion.so/Tuscan-Kale-598337872cf94fdf8782e53db20768a5',
                  },
                },
              },
            },
          },
        },
        '400': {
          description: '400',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}',
                },
                'has_more is set to true for a page property': {
                  value:
                    '{\n  "object": "error",\n  "status": 400,\n  "code": "invalid_request",\n  "message": ”Can\'t update page because has_more is set to true for page property \'${invalidPageProperty}’”\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
        '404': {
          description: '404',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n    "object": "error",\n    "status": 404,\n    "code": "object_not_found",\n    "message": "Could not find page with ID: 4cc3b486-0b48-4cfe-8ce9-67c47100eb6a. Make sure the relevant pages and databases are shared with your integration."\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'error',
                  },
                  status: {
                    type: 'integer',
                    example: 404,
                    default: 0,
                  },
                  code: {
                    type: 'string',
                    example: 'object_not_found',
                  },
                  message: {
                    type: 'string',
                    example:
                      'Could not find page with ID: 4cc3b486-0b48-4cfe-8ce9-67c47100eb6a. Make sure the relevant pages and databases are shared with your integration.',
                  },
                },
              },
            },
          },
        },
        '429': {
          description: '429',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n  "object": "error",\n  "status": 429,\n  "code": "rate_limited",\n  "message": "You have been rate limited. Please try again in a few minutes."\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'error',
                  },
                  status: {
                    type: 'integer',
                    example: 429,
                    default: 0,
                  },
                  code: {
                    type: 'string',
                    example: 'rate_limited',
                  },
                  message: {
                    type: 'string',
                    example: 'You have been rate limited. Please try again in a few minutes.',
                  },
                },
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript',
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const pageId = '59833787-2cf9-4fdf-8782-e53db20768a5';\n  const response = await notion.pages.update({\n    page_id: pageId,\n    properties: {\n      'In stock': {\n        checkbox: true,\n      },\n    },\n  });\n  console.log(response);\n})();",
            name: 'Notion SDK for JavaScript',
          },
          {
            language: 'curl',
            code: 'curl https://api.notion.com/v1/pages/60bdc8bd-3880-44b8-a9cd-8a145b3ffbd7 \\\n  -H \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n  -H "Content-Type: application/json" \\\n  -H "Notion-Version: 2022-06-28" \\\n  -X PATCH \\\n\t--data \'{\n  "properties": {\n    "In stock": { "checkbox": true }\n  }\n}\'',
          },
        ],
        'samples-languages': ['javascript', 'curl'],
      },
    },
  },
  '/v1/pages': {
    post: {
      summary: 'Create a page',
      description: '',
      operationId: 'post-page',
      parameters: [
        {
          name: 'Notion-Version',
          in: 'header',
          required: true,
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['parent', 'properties'],
              properties: {
                parent: {
                  type: 'string',
                  description:
                    'The parent page or database where the new page is inserted, represented as a JSON object with a `page_id` or `database_id` key, and the corresponding ID.',
                  format: 'json',
                },
                properties: {
                  type: 'string',
                  description:
                    'The values of the page’s properties. If the `parent` is a database, then the schema must match the parent database’s properties. If the `parent` is a page, then the only valid object key is `title`.',
                  format: 'json',
                },
                children: {
                  type: 'array',
                  description:
                    'The content to be rendered on the new page, represented as an array of [block objects](https://developers.notion.com/reference/block).',
                  items: {
                    type: 'string',
                  },
                },
                icon: {
                  type: 'string',
                  description:
                    'The icon of the new page. Either an [emoji object](https://developers.notion.com/reference/emoji-object) or an [external file object](https://developers.notion.com/reference/file-object)..',
                  format: 'json',
                },
                cover: {
                  type: 'string',
                  description:
                    'The cover image of the new page, represented as a [file object](https://developers.notion.com/reference/file-object).',
                  format: 'json',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n  "object": "page",\n  "id": "59833787-2cf9-4fdf-8782-e53db20768a5",\n  "created_time": "2022-03-01T19:05:00.000Z",\n  "last_edited_time": "2022-07-06T19:16:00.000Z",\n  "created_by": {\n    "object": "user",\n    "id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n  },\n  "last_edited_by": {\n    "object": "user",\n    "id": "ee5f0f84-409a-440f-983a-a5315961c6e4"\n  },\n  "cover": {\n    "type": "external",\n    "external": {\n      "url": "https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg"\n    }\n  },\n  "icon": {\n    "type": "emoji",\n    "emoji": "🥬"\n  },\n  "parent": {\n    "type": "database_id",\n    "database_id": "d9824bdc-8445-4327-be8b-5b47500af6ce"\n  },\n  "archived": false,\n  "properties": {\n    "Store availability": {\n      "id": "%3AUPp"\n    },\n    "Food group": {\n      "id": "A%40Hk"\n    },\n    "Price": {\n      "id": "BJXS"\n    },\n    "Responsible Person": {\n      "id": "Iowm"\n    },\n    "Last ordered": {\n      "id": "Jsfb"\n    },\n    "Cost of next trip": {\n      "id": "WOd%3B"\n    },\n    "Recipes": {\n      "id": "YfIu"\n    },\n    "Description": {\n      "id": "_Tc_"\n    },\n    "In stock": {\n      "id": "%60%5Bq%3F"\n    },\n    "Number of meals": {\n      "id": "zag~"\n    },\n    "Photo": {\n      "id": "%7DF_L"\n    },\n    "Name": {\n      "id": "title"\n    }\n  },\n  "url": "https://www.notion.so/Tuscan-Kale-598337872cf94fdf8782e53db20768a5"\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'page',
                  },
                  id: {
                    type: 'string',
                    example: '59833787-2cf9-4fdf-8782-e53db20768a5',
                  },
                  created_time: {
                    type: 'string',
                    example: '2022-03-01T19:05:00.000Z',
                  },
                  last_edited_time: {
                    type: 'string',
                    example: '2022-07-06T19:16:00.000Z',
                  },
                  created_by: {
                    type: 'object',
                    properties: {
                      object: {
                        type: 'string',
                        example: 'user',
                      },
                      id: {
                        type: 'string',
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4',
                      },
                    },
                  },
                  last_edited_by: {
                    type: 'object',
                    properties: {
                      object: {
                        type: 'string',
                        example: 'user',
                      },
                      id: {
                        type: 'string',
                        example: 'ee5f0f84-409a-440f-983a-a5315961c6e4',
                      },
                    },
                  },
                  cover: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        example: 'external',
                      },
                      external: {
                        type: 'object',
                        properties: {
                          url: {
                            type: 'string',
                            example: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg',
                          },
                        },
                      },
                    },
                  },
                  icon: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        example: 'emoji',
                      },
                      emoji: {
                        type: 'string',
                        example: '🥬',
                      },
                    },
                  },
                  parent: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        example: 'database_id',
                      },
                      database_id: {
                        type: 'string',
                        example: 'd9824bdc-8445-4327-be8b-5b47500af6ce',
                      },
                    },
                  },
                  archived: {
                    type: 'boolean',
                    example: false,
                    default: true,
                  },
                  properties: {
                    type: 'object',
                    properties: {
                      'Store availability': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: '%3AUPp',
                          },
                        },
                      },
                      'Food group': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'A%40Hk',
                          },
                        },
                      },
                      Price: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'BJXS',
                          },
                        },
                      },
                      'Responsible Person': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'Iowm',
                          },
                        },
                      },
                      'Last ordered': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'Jsfb',
                          },
                        },
                      },
                      'Cost of next trip': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'WOd%3B',
                          },
                        },
                      },
                      Recipes: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'YfIu',
                          },
                        },
                      },
                      Description: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: '_Tc_',
                          },
                        },
                      },
                      'In stock': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: '%60%5Bq%3F',
                          },
                        },
                      },
                      'Number of meals': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'zag~',
                          },
                        },
                      },
                      Photo: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: '%7DF_L',
                          },
                        },
                      },
                      Name: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'title',
                          },
                        },
                      },
                    },
                  },
                  url: {
                    type: 'string',
                    example: 'https://www.notion.so/Tuscan-Kale-598337872cf94fdf8782e53db20768a5',
                  },
                },
              },
            },
          },
        },
        '400': {
          description: '400',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}',
                },
              },
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
        '404': {
          description: '404',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n    "object": "error",\n    "status": 404,\n    "code": "object_not_found",\n    "message": "Could not find page with ID: 4cc3b486-0b48-4cfe-8ce9-67c47100eb6a. Make sure the relevant pages and databases are shared with your integration."\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'error',
                  },
                  status: {
                    type: 'integer',
                    example: 404,
                    default: 0,
                  },
                  code: {
                    type: 'string',
                    example: 'object_not_found',
                  },
                  message: {
                    type: 'string',
                    example:
                      'Could not find page with ID: 4cc3b486-0b48-4cfe-8ce9-67c47100eb6a. Make sure the relevant pages and databases are shared with your integration.',
                  },
                },
              },
            },
          },
        },
        '429': {
          description: '429',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n  "object": "error",\n  "status": 429,\n  "code": "rate_limited",\n  "message": "You have been rate limited. Please try again in a few minutes."\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'error',
                  },
                  status: {
                    type: 'integer',
                    example: 429,
                    default: 0,
                  },
                  code: {
                    type: 'string',
                    example: 'rate_limited',
                  },
                  message: {
                    type: 'string',
                    example: 'You have been rate limited. Please try again in a few minutes.',
                  },
                },
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript',
            code: 'const { Client } = require(\'@notionhq/client\');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const response = await notion.pages.create({\n    "cover": {\n        "type": "external",\n        "external": {\n            "url": "https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg"\n        }\n    },\n    "icon": {\n        "type": "emoji",\n        "emoji": "🥬"\n    },\n    "parent": {\n        "type": "database_id",\n        "database_id": "d9824bdc-8445-4327-be8b-5b47500af6ce"\n    },\n    "properties": {\n        "Name": {\n            "title": [\n                {\n                    "text": {\n                        "content": "Tuscan kale"\n                    }\n                }\n            ]\n        },\n        "Description": {\n            "rich_text": [\n                {\n                    "text": {\n                        "content": "A dark green leafy vegetable"\n                    }\n                }\n            ]\n        },\n        "Food group": {\n            "select": {\n                "name": "🥬 Vegetable"\n            }\n        }\n    },\n    "children": [\n        {\n            "object": "block",\n            "heading_2": {\n                "rich_text": [\n                    {\n                        "text": {\n                            "content": "Lacinato kale"\n                        }\n                    }\n                ]\n            }\n        },\n        {\n            "object": "block",\n            "paragraph": {\n                "rich_text": [\n                    {\n                        "text": {\n                            "content": "Lacinato kale is a variety of kale with a long tradition in Italian cuisine, especially that of Tuscany. It is also known as Tuscan kale, Italian kale, dinosaur kale, kale, flat back kale, palm tree kale, or black Tuscan palm.",\n                            "link": {\n                                "url": "https://en.wikipedia.org/wiki/Lacinato_kale"\n                            }\n                        },\n                        "href": "https://en.wikipedia.org/wiki/Lacinato_kale"\n                    }\n                ],\n                "color": "default"\n            }\n        }\n    ]\n});\n  console.log(response);\n})();',
            name: 'Notion SDK for JavaScript',
          },
          {
            language: 'curl',
            code: 'curl \'https://api.notion.com/v1/pages\' \\\n  -H \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n  -H "Content-Type: application/json" \\\n  -H "Notion-Version: 2022-06-28" \\\n  --data \'{\n\t"parent": { "database_id": "d9824bdc84454327be8b5b47500af6ce" },\n  "icon": {\n  \t"emoji": "🥬"\n  },\n\t"cover": {\n\t\t"external": {\n\t\t\t"url": "https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg"\n\t\t}\n\t},\n\t"properties": {\n\t\t"Name": {\n\t\t\t"title": [\n\t\t\t\t{\n\t\t\t\t\t"text": {\n\t\t\t\t\t\t"content": "Tuscan Kale"\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t]\n\t\t},\n\t\t"Description": {\n\t\t\t"rich_text": [\n\t\t\t\t{\n\t\t\t\t\t"text": {\n\t\t\t\t\t\t"content": "A dark green leafy vegetable"\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t]\n\t\t},\n\t\t"Food group": {\n\t\t\t"select": {\n\t\t\t\t"name": "Vegetable"\n\t\t\t}\n\t\t},\n\t\t"Price": { "number": 2.5 }\n\t},\n\t"children": [\n\t\t{\n\t\t\t"object": "block",\n\t\t\t"type": "heading_2",\n\t\t\t"heading_2": {\n\t\t\t\t"rich_text": [{ "type": "text", "text": { "content": "Lacinato kale" } }]\n\t\t\t}\n\t\t},\n\t\t{\n\t\t\t"object": "block",\n\t\t\t"type": "paragraph",\n\t\t\t"paragraph": {\n\t\t\t\t"rich_text": [\n\t\t\t\t\t{\n\t\t\t\t\t\t"type": "text",\n\t\t\t\t\t\t"text": {\n\t\t\t\t\t\t\t"content": "Lacinato kale is a variety of kale with a long tradition in Italian cuisine, especially that of Tuscany. It is also known as Tuscan kale, Italian kale, dinosaur kale, kale, flat back kale, palm tree kale, or black Tuscan palm.",\n\t\t\t\t\t\t\t"link": { "url": "https://en.wikipedia.org/wiki/Lacinato_kale" }\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t]\n\t\t\t}\n\t\t}\n\t]\n}\'',
          },
        ],
        'samples-languages': ['javascript', 'curl'],
      },
    },
  },
  '/v1/databases': {
    post: {
      summary: 'Create a database',
      description: '',
      operationId: 'create-a-database',
      parameters: [
        {
          name: 'Notion-Version',
          in: 'header',
          required: true,
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['parent', 'properties'],
              properties: {
                parent: {
                  type: 'string',
                  description: 'A [page parent](/reference/database#page-parent)',
                  format: 'json',
                },
                title: {
                  type: 'array',
                  description:
                    'Title of database as it appears in Notion. An array of [rich text objects](ref:rich-text).',
                },
                properties: {
                  type: 'string',
                  description:
                    'Property schema of database. The keys are the names of properties as they appear in Notion and the values are [property schema objects](https://developers.notion.com/reference/property-schema-object).',
                  format: 'json',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n    "object": "database",\n    "id": "bc1211ca-e3f1-4939-ae34-5260b16f627c",\n    "created_time": "2021-07-08T23:50:00.000Z",\n    "last_edited_time": "2021-07-08T23:50:00.000Z",\n    "icon": {\n        "type": "emoji",\n        "emoji": "🎉"\n    },\n    "cover": {\n        "type": "external",\n        "external": {\n            "url": "https://website.domain/images/image.png"\n        }\n    },\n    "url": "https://www.notion.so/bc1211cae3f14939ae34260b16f627c",\n    "title": [\n        {\n            "type": "text",\n            "text": {\n                "content": "Grocery List",\n                "link": null\n            },\n            "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n            },\n            "plain_text": "Grocery List",\n            "href": null\n        }\n    ],\n    "properties": {\n        "+1": {\n            "id": "Wp%3DC",\n            "name": "+1",\n            "type": "people",\n            "people": {}\n        },\n        "In stock": {\n            "id": "fk%5EY",\n            "name": "In stock",\n            "type": "checkbox",\n            "checkbox": {}\n        },\n        "Price": {\n            "id": "evWq",\n            "name": "Price",\n            "type": "number",\n            "number": {\n                "format": "dollar"\n            }\n        },\n        "Description": {\n            "id": "V}lX",\n            "name": "Description",\n            "type": "rich_text",\n            "rich_text": {}\n        },\n        "Last ordered": {\n            "id": "eVnV",\n            "name": "Last ordered",\n            "type": "date",\n            "date": {}\n        },\n        "Meals": {\n            "id": "%7DWA~",\n            "name": "Meals",\n            "type": "relation",\n            "relation": {\n                "database_id": "668d797c-76fa-4934-9b05-ad288df2d136",\n                "single_property": {}\n            }\n        },\n        "Number of meals": {\n            "id": "Z\\\\Eh",\n            "name": "Number of meals",\n            "type": "rollup",\n            "rollup": {\n                "rollup_property_name": "Name",\n                "relation_property_name": "Meals",\n                "rollup_property_id": "title",\n                "relation_property_id": "mxp^",\n                "function": "count"\n            }\n        },\n        "Store availability": {\n            "id": "s}Kq",\n            "name": "Store availability",\n            "type": "multi_select",\n            "multi_select": {\n                "options": [\n                    {\n                        "id": "cb79b393-d1c1-4528-b517-c450859de766",\n                        "name": "Duc Loi Market",\n                        "color": "blue"\n                    },\n                    {\n                        "id": "58aae162-75d4-403b-a793-3bc7308e4cd2",\n                        "name": "Rainbow Grocery",\n                        "color": "gray"\n                    },\n                    {\n                        "id": "22d0f199-babc-44ff-bd80-a9eae3e3fcbf",\n                        "name": "Nijiya Market",\n                        "color": "purple"\n                    },\n                    {\n                        "id": "0d069987-ffb0-4347-bde2-8e4068003dbc",\n                        "name": "Gus\'s Community Market",\n                        "color": "yellow"\n                    }\n                ]\n            }\n        },\n        "Photo": {\n            "id": "yfiK",\n            "name": "Photo",\n            "type": "files",\n            "files": {}\n        },\n        "Food group": {\n            "id": "CM%3EH",\n            "name": "Food group",\n            "type": "select",\n            "select": {\n                "options": [\n                    {\n                        "id": "6d4523fa-88cb-4ffd-9364-1e39d0f4e566",\n                        "name": "🥦Vegetable",\n                        "color": "green"\n                    },\n                    {\n                        "id": "268d7e75-de8f-4c4b-8b9d-de0f97021833",\n                        "name": "🍎Fruit",\n                        "color": "red"\n                    },\n                    {\n                        "id": "1b234a00-dc97-489c-b987-829264cfdfef",\n                        "name": "💪Protein",\n                        "color": "yellow"\n                    }\n                ]\n            }\n        },\n        "Name": {\n            "id": "title",\n            "name": "Name",\n            "type": "title",\n            "title": {}\n        }\n    },\n    "parent": {\n        "type": "page_id",\n        "page_id": "98ad959b-2b6a-4774-80ee-00246fb0ea9b"\n    },\n    "archived": false\n}{\n    "object": "database",\n    "id": "bc1211ca-e3f1-4939-ae34-5260b16f627c",\n    "created_time": "2021-07-08T23:50:00.000Z",\n    "last_edited_time": "2021-07-08T23:50:00.000Z",\n    "icon": {\n        "type": "emoji",\n        "emoji": "🎉"\n    },\n    "cover": {\n        "type": "external",\n        "external": {\n            "url": "https://website.domain/images/image.png"\n        }\n    },\n    "url": "https://www.notion.so/bc1211cae3f14939ae34260b16f627c",\n    "title": [\n        {\n            "type": "text",\n            "text": {\n                "content": "Grocery List",\n                "link": null\n            },\n            "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n            },\n            "plain_text": "Grocery List",\n            "href": null\n        }\n    ],\n    "properties": {\n        "+1": {\n            "id": "Wp%3DC",\n            "name": "+1",\n            "type": "people",\n            "people": {}\n        },\n        "In stock": {\n            "id": "fk%5EY",\n            "name": "In stock",\n            "type": "checkbox",\n            "checkbox": {}\n        },\n        "Price": {\n            "id": "evWq",\n            "name": "Price",\n            "type": "number",\n            "number": {\n                "format": "dollar"\n            }\n        },\n        "Description": {\n            "id": "V}lX",\n            "name": "Description",\n            "type": "rich_text",\n            "rich_text": {}\n        },\n        "Last ordered": {\n            "id": "eVnV",\n            "name": "Last ordered",\n            "type": "date",\n            "date": {}\n        },\n        "Meals": {\n            "id": "%7DWA~",\n            "name": "Meals",\n            "type": "relation",\n            "relation": {\n                "database_id": "668d797c-76fa-4934-9b05-ad288df2d136",\n                "synced_property_name": "Related to Grocery List (Meals)"\n            }\n        },\n        "Number of meals": {\n            "id": "Z\\\\Eh",\n            "name": "Number of meals",\n            "type": "rollup",\n            "rollup": {\n                "rollup_property_name": "Name",\n                "relation_property_name": "Meals",\n                "rollup_property_id": "title",\n                "relation_property_id": "mxp^",\n                "function": "count"\n            }\n        },\n        "Store availability": {\n            "id": "s}Kq",\n            "name": "Store availability",\n            "type": "multi_select",\n            "multi_select": {\n                "options": [\n                    {\n                        "id": "cb79b393-d1c1-4528-b517-c450859de766",\n                        "name": "Duc Loi Market",\n                        "color": "blue"\n                    },\n                    {\n                        "id": "58aae162-75d4-403b-a793-3bc7308e4cd2",\n                        "name": "Rainbow Grocery",\n                        "color": "gray"\n                    },\n                    {\n                        "id": "22d0f199-babc-44ff-bd80-a9eae3e3fcbf",\n                        "name": "Nijiya Market",\n                        "color": "purple"\n                    },\n                    {\n                        "id": "0d069987-ffb0-4347-bde2-8e4068003dbc",\n                        "name": "Gus\'s Community Market",\n                        "color": "yellow"\n                    }\n                ]\n            }\n        },\n        "Photo": {\n            "id": "yfiK",\n            "name": "Photo",\n            "type": "files",\n            "files": {}\n        },\n        "Food group": {\n            "id": "CM%3EH",\n            "name": "Food group",\n            "type": "select",\n            "select": {\n                "options": [\n                    {\n                        "id": "6d4523fa-88cb-4ffd-9364-1e39d0f4e566",\n                        "name": "🥦Vegetable",\n                        "color": "green"\n                    },\n                    {\n                        "id": "268d7e75-de8f-4c4b-8b9d-de0f97021833",\n                        "name": "🍎Fruit",\n                        "color": "red"\n                    },\n                    {\n                        "id": "1b234a00-dc97-489c-b987-829264cfdfef",\n                        "name": "💪Protein",\n                        "color": "yellow"\n                    }\n                ]\n            }\n        },\n        "Name": {\n            "id": "title",\n            "name": "Name",\n            "type": "title",\n            "title": {}\n        }\n    },\n    "parent": {\n        "type": "page_id",\n        "page_id": "98ad959b-2b6a-4774-80ee-00246fb0ea9b"\n    },\n    "archived": false,\n    "is_inline": false\n}',
                },
              },
            },
          },
        },
        '400': {
          description: '400',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}',
                },
              },
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'curl',
            code: 'curl --location --request POST \'https://api.notion.com/v1/databases/\' \\\n--header \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n--header \'Content-Type: application/json\' \\\n--header \'Notion-Version: 2022-06-28\' \\\n--data \'{\n    "parent": {\n        "type": "page_id",\n        "page_id": "98ad959b-2b6a-4774-80ee-00246fb0ea9b"\n    },\n    "icon": {\n    \t"type": "emoji",\n\t\t\t"emoji": "📝"\n  \t},\n  \t"cover": {\n  \t\t"type": "external",\n    \t"external": {\n    \t\t"url": "https://website.domain/images/image.png"\n    \t}\n  \t},\n    "title": [\n        {\n            "type": "text",\n            "text": {\n                "content": "Grocery List",\n                "link": null\n            }\n        }\n    ],\n    "properties": {\n        "Name": {\n            "title": {}\n        },\n        "Description": {\n            "rich_text": {}\n        },\n        "In stock": {\n            "checkbox": {}\n        },\n        "Food group": {\n            "select": {\n                "options": [\n                    {\n                        "name": "🥦Vegetable",\n                        "color": "green"\n                    },\n                    {\n                        "name": "🍎Fruit",\n                        "color": "red"\n                    },\n                    {\n                        "name": "💪Protein",\n                        "color": "yellow"\n                    }\n                ]\n            }\n        },\n        "Price": {\n            "number": {\n                "format": "dollar"\n            }\n        },\n        "Last ordered": {\n            "date": {}\n        },\n        "Meals": {\n          "relation": {\n            "database_id": "668d797c-76fa-4934-9b05-ad288df2d136",\n            "single_property": {}\n          }\n    \t\t},\n        "Number of meals": {\n          "rollup": {\n            "rollup_property_name": "Name",\n            "relation_property_name": "Meals",\n            "function": "count"\n          }\n        },\n        "Store availability": {\n            "type": "multi_select",\n            "multi_select": {\n                "options": [\n                    {\n                        "name": "Duc Loi Market",\n                        "color": "blue"\n                    },\n                    {\n                        "name": "Rainbow Grocery",\n                        "color": "gray"\n                    },\n                    {\n                        "name": "Nijiya Market",\n                        "color": "purple"\n                    },\n                    {\n                        "name": "Gus\'\\\'\'s Community Market",\n                        "color": "yellow"\n                    }\n                ]\n            }\n        },\n        "+1": {\n            "people": {}\n        },\n        "Photo": {\n            "files": {}\n        }\n    }\n}\'',
          },
          {
            language: 'javascript',
            code: 'const { Client } = require(\'@notionhq/client\');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const response = await notion.databases.create({\n      parent: {\n        type: "page_id",\n        page_id: "98ad959b-2b6a-4774-80ee-00246fb0ea9b",\n      },\n      icon: {\n        type: "emoji",\n        emoji: "📝",\n      },\n      cover: {\n        type: "external",\n        external: {\n          url: "https://website.domain/images/image.png",\n        },\n      },\n      title: [\n        {\n          type: "text",\n          text: {\n            content: "Grocery List",\n            link: null,\n          },\n        },\n      ],\n      properties: {\n        Name: {\n          title: {},\n        },\n        Description: {\n          rich_text: {},\n        },\n        "In stock": {\n          checkbox: {},\n        },\n        "Food group": {\n          select: {\n            options: [\n              {\n                name: "🥦Vegetable",\n                color: "green",\n              },\n              {\n                name: "🍎Fruit",\n                color: "red",\n              },\n              {\n                name: "💪Protein",\n                color: "yellow",\n              },\n            ],\n          },\n        },\n        Price: {\n          number: {\n            format: "dollar",\n          },\n        },\n        "Last ordered": {\n          date: {},\n        },\n        Meals: {\n          relation: {\n            database_id: "668d797c-76fa-4934-9b05-ad288df2d136",\n            single_property: {},\n          },\n        },\n        "Number of meals": {\n          rollup: {\n            rollup_property_name: "Name",\n            relation_property_name: "Meals",\n            function: "count",\n          },\n        },\n        "Store availability": {\n          type: "multi_select",\n          multi_select: {\n            options: [\n              {\n                name: "Duc Loi Market",\n                color: "blue",\n              },\n              {\n                name: "Rainbow Grocery",\n                color: "gray",\n              },\n              {\n                name: "Nijiya Market",\n                color: "purple",\n              },\n              {\n                name: "Gus\'\'\'s Community Market",\n                color: "yellow",\n              },\n            ],\n          },\n        },\n        "+1": {\n          people: {},\n        },\n        Photo: {\n          files: {},\n        },\n      },\n    });\n  console.log(response);\n})();',
            name: 'Notion SDK for JavaScript',
          },
        ],
        'samples-languages': ['curl', 'javascript'],
      },
    },
  },
  '/v1/databases/{database_id}': {
    patch: {
      summary: 'Update a database',
      description: '',
      operationId: 'update-a-database',
      parameters: [
        {
          name: 'database_id',
          in: 'path',
          description: 'identifier for a Notion database',
          schema: {
            type: 'string',
          },
          required: true,
        },
        {
          name: 'Notion-Version',
          in: 'header',
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                title: {
                  type: 'array',
                  description:
                    'An array of [rich text objects](https://developers.notion.com/reference/rich-text) that represents the title of the database that is displayed in the Notion UI. If omitted, then the database title remains unchanged.',
                },
                description: {
                  type: 'array',
                  description:
                    'An array of [rich text objects](https://developers.notion.com/reference/rich-text) that represents the description of the database that is displayed in the Notion UI. If omitted, then the database description remains unchanged.',
                },
                properties: {
                  type: 'string',
                  description:
                    'The properties of a database to be changed in the request, in the form of a JSON object. If updating an existing property, then the keys are the names or IDs of the properties as they appear in Notion, and the values are [property schema objects](ref:property-schema-object). If adding a new property, then the key is the name of the new database property and the value is a [property schema object](ref:property-schema-object).',
                  format: 'json',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n  "object": "database",\n  "id": "668d797c-76fa-4934-9b05-ad288df2d136",\n  "created_time": "2020-03-17T19:10:00.000Z",\n  "last_edited_time": "2021-08-11T17:26:00.000Z",\n  "parent": {\n    "type": "page_id",\n    "page_id": "48f8fee9-cd79-4180-bc2f-ec0398253067"\n  },  \n  "icon": {\n    "type": "emoji",\n    "emoji": "📝"\n \t},\n  "cover": {\n  \t"type": "external",\n    "external": {\n    \t"url": "https://website.domain/images/image.png"\n    }\n  },\n  "url": "https://www.notion.so/668d797c76fa49349b05ad288df2d136",\n  "title": [\n    {\n      "type": "text",\n      "text": {\n        "content": "Today\'\\\'\'s grocery list",\n        "link": null\n      },\n      "annotations": {\n        "bold": false,\n        "italic": false,\n        "strikethrough": false,\n        "underline": false,\n        "code": false,\n        "color": "default"\n      },\n      "plain_text": "Today\'\\\'\'s grocery list",\n      "href": null\n    }\n  ],\n  "description": [\n    {\n      "type": "text",\n      "text": {\n        "content": "Grocery list for just kale 🥬",\n        "link": null\n      },\n      "annotations": {\n        "bold": false,\n        "italic": false,\n        "strikethrough": false,\n        "underline": false,\n        "code": false,\n        "color": "default"\n      },\n      "plain_text": "Grocery list for just kale 🥬",\n      "href": null\n    }\n  ],\n  "properties": {\n    "Name": {\n      "id": "title",\n\t\t\t"name": "Name",\n      "type": "title",\n      "title": {}\n    },\n    "Description": {\n      "id": "J@cS",\n\t\t\t"name": "Description",\n      "type": "rich_text",\n      "rich_text": {}\n    },\n    "In stock": {\n      "id": "{xY`",\n\t\t\t"name": "In stock",\n      "type": "checkbox",\n      "checkbox": {}\n    },\n    "Food group": {\n      "id": "TJmr",\n\t\t\t"name": "Food group",\n      "type": "select",\n      "select": {\n        "options": [\n          {\n            "id": "96eb622f-4b88-4283-919d-ece2fbed3841",\n            "name": "🥦Vegetable",\n            "color": "green"\n          },\n          {\n            "id": "bb443819-81dc-46fb-882d-ebee6e22c432",\n            "name": "🍎Fruit",\n            "color": "red"\n          },\n          {\n            "id": "7da9d1b9-8685-472e-9da3-3af57bdb221e",\n            "name": "💪Protein",\n            "color": "yellow"\n          }\n        ]\n      }\n    },\n    "Price": {\n      "id": "cU^N",\n\t\t\t"name": "Price",\n      "type": "number",\n      "number": {\n        "format": "dollar"\n      }\n    },\n    "Cost of next trip": {\n      "id": "p:sC",\n\t\t\t"name": "Cost of next trip",\n      "type": "formula",\n      "formula": {\n        "value": "if(prop(\\"In stock\\"), 0, prop(\\"Price\\"))"\n      }\n    },\n    "Last ordered": {\n      "id": "]\\\\R[",\n\t\t\t"name": "Last ordered",\n      "type": "date",\n      "date": {}\n    },\n    "Meals": {\n\t\t\t"id": "gqk%60",\n            "name": "Meals",\n      "type": "relation",\n      "relation": {\n        "database": "668d797c-76fa-4934-9b05-ad288df2d136",\n        "synced_property_name": null\n      }\n    },\n    "Number of meals": {\n      "id": "Z\\\\Eh",\n\t\t\t"name": "Number of meals",\n      "type": "rollup",\n      "rollup": {\n        "rollup_property_name": "Name",\n        "relation_property_name": "Meals",\n        "rollup_property_id": "title",\n        "relation_property_id": "mxp^",\n        "function": "count"\n      }\n    },\n    "Store availability": {\n\t\t\t"id": "G%7Dji",\n      "name": "Store availability",\n      "type": "multi_select",\n      "multi_select": {\n        "options": [\n          [\n            {\n              "id": "d209b920-212c-4040-9d4a-bdf349dd8b2a",\n              "name": "Duc Loi Market",\n              "color": "blue"\n            },\n            {\n              "id": "70104074-0f91-467b-9787-00d59e6e1e41",\n              "name": "Rainbow Grocery",\n              "color": "gray"\n            },\n            {\n              "id": "6c3867c5-d542-4f84-b6e9-a420c43094e7",\n              "name": "Gus\'s Community Market",\n              "color": "yellow"\n            },\n            {\n\t\t\t\t\t\t\t"id": "a62fbb5f-fed4-44a4-8cac-cba5f518c1a1",\n              "name": "The Good Life Grocery",\n              "color": "orange"\n           }\n          ]\n        ]\n      }\n    }\n    "Photo": {\n      "id": "aTIT",\n\t\t\t"name": "Photo",\n      "type": "url",\n      "url": {}\n    }\n  },\n  "is_inline": false\n}',
                },
              },
            },
          },
        },
        '400': {
          description: '400',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n    "object": "error",\n    "status": 400,\n    "code": "validation_error",\n    "message": "body failed validation: body.title[0].text.content.length should be ≤ `2000`, instead was `2022`."\n}',
                },
              },
              schema: {
                oneOf: [
                  {
                    type: 'object',
                    properties: {
                      object: {
                        type: 'string',
                        example: 'error',
                      },
                      status: {
                        type: 'integer',
                        example: 400,
                        default: 0,
                      },
                      code: {
                        type: 'string',
                        example: 'invalid_json',
                      },
                      message: {
                        type: 'string',
                        example: 'Error parsing JSON body.',
                      },
                    },
                  },
                  {
                    type: 'object',
                    properties: {
                      object: {
                        type: 'string',
                        example: 'error',
                      },
                      status: {
                        type: 'integer',
                        example: 400,
                        default: 0,
                      },
                      code: {
                        type: 'string',
                        example: 'validation_error',
                      },
                      message: {
                        type: 'string',
                        example:
                          'body failed validation: body.title[0].text.content.length should be ≤ `2000`, instead was `2022`.',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        '404': {
          description: '404',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n    "object": "error",\n    "status": 404,\n    "code": "object_not_found",\n    "message": "Could not find database with ID: a1d8501e-1ac1-43e9-a6bd-ea9fe6c8822c. Make sure the relevant pages and databases are shared with your integration."\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'error',
                  },
                  status: {
                    type: 'integer',
                    example: 404,
                    default: 0,
                  },
                  code: {
                    type: 'string',
                    example: 'object_not_found',
                  },
                  message: {
                    type: 'string',
                    example:
                      'Could not find database with ID: a1d8501e-1ac1-43e9-a6bd-ea9fe6c8822c. Make sure the relevant pages and databases are shared with your integration.',
                  },
                },
              },
            },
          },
        },
        '429': {
          description: '429',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n\t"object": "error",\n\t"status": 429,\n\t"code": "rate_limited",\n\t"message": "You have been rate limited. Please try again in a few minutes."\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'error',
                  },
                  status: {
                    type: 'integer',
                    example: 429,
                    default: 0,
                  },
                  code: {
                    type: 'string',
                    example: 'rate_limited',
                  },
                  message: {
                    type: 'string',
                    example: 'You have been rate limited. Please try again in a few minutes.',
                  },
                },
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'curl',
            code: 'curl --location --request PATCH \'https://api.notion.com/v1/databases/668d797c-76fa-4934-9b05-ad288df2d136\' \\\n--header \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n--header \'Content-Type: application/json\' \\\n--header \'Notion-Version: 2022-06-28\' \\\n--data \'{\n    "title": [\n        {\n            "text": {\n                "content": "Today\'\\\'\'s grocery list"\n            }\n        }\n    ],\n    "description": [\n        {\n            "text": {\n                "content": "Grocery list for just kale 🥬"\n            }\n        }\n    ],\n    "properties": {\n        "+1": null,\n        "Photo": {\n            "url": {}\n        },\n        "Store availability": {\n            "multi_select": {\n                "options": [\n                    {\n                        "name": "Duc Loi Market"\n                    },\n                    {\n                        "name": "Rainbow Grocery"\n                    },\n                    {\n                        "name": "Gus\'\\\'\'s Community Market"\n                    },\n                    {\n                        "name": "The Good Life Grocery",\n                        "color": "orange"\n                    }\n                ]\n            }\n        }\n    }       \n}\'',
          },
        ],
        'samples-languages': ['curl'],
      },
    },
    get: {
      summary: 'Retrieve a database',
      description: '',
      operationId: 'retrieve-a-database',
      parameters: [
        {
          name: 'database_id',
          in: 'path',
          description: 'An identifier for the Notion database.',
          schema: {
            type: 'string',
          },
          required: true,
        },
        {
          name: 'Notion-Version',
          in: 'header',
          required: true,
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n    "object": "database",\n    "id": "bc1211ca-e3f1-4939-ae34-5260b16f627c",\n    "created_time": "2021-07-08T23:50:00.000Z",\n    "last_edited_time": "2021-07-08T23:50:00.000Z",\n    "icon": {\n        "type": "emoji",\n        "emoji": "🎉"\n    },\n    "cover": {\n        "type": "external",\n        "external": {\n            "url": "https://website.domain/images/image.png"\n        }\n    },\n    "url": "https://www.notion.so/bc1211cae3f14939ae34260b16f627c",\n    "title": [\n        {\n            "type": "text",\n            "text": {\n                "content": "Grocery List",\n                "link": null\n            },\n            "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n            },\n            "plain_text": "Grocery List",\n            "href": null\n        }\n    ],\n    "description": [\n        {\n            "type": "text",\n            "text": {\n                "content": "Grocery list for just kale 🥬",\n                "link": null\n            },\n            "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n            },\n            "plain_text": "Grocery list for just kale 🥬",\n            "href": null\n        }\n    ],\n    "properties": {\n        "+1": {\n            "id": "Wp%3DC",\n            "name": "+1",\n            "type": "people",\n            "people": {}\n        },\n        "In stock": {\n            "id": "fk%5EY",\n            "name": "In stock",\n            "type": "checkbox",\n            "checkbox": {}\n        },\n        "Price": {\n            "id": "evWq",\n            "name": "Price",\n            "type": "number",\n            "number": {\n                "format": "dollar"\n            }\n        },\n        "Description": {\n            "id": "V}lX",\n            "name": "Description",\n            "type": "rich_text",\n            "rich_text": {}\n        },\n        "Last ordered": {\n            "id": "eVnV",\n            "name": "Last ordered",\n            "type": "date",\n            "date": {}\n        },\n        "Meals": {\n            "id": "%7DWA~",\n            "name": "Meals",\n            "type": "relation",\n            "relation": {\n                "database_id": "668d797c-76fa-4934-9b05-ad288df2d136",\n                "synced_property_name": "Related to Grocery List (Meals)"\n            }\n        },\n        "Number of meals": {\n            "id": "Z\\\\Eh",\n            "name": "Number of meals",\n            "type": "rollup",\n            "rollup": {\n                "rollup_property_name": "Name",\n                "relation_property_name": "Meals",\n                "rollup_property_id": "title",\n                "relation_property_id": "mxp^",\n                "function": "count"\n            }\n        },\n        "Store availability": {\n            "id": "s}Kq",\n            "name": "Store availability",\n            "type": "multi_select",\n            "multi_select": {\n                "options": [\n                    {\n                        "id": "cb79b393-d1c1-4528-b517-c450859de766",\n                        "name": "Duc Loi Market",\n                        "color": "blue"\n                    },\n                    {\n                        "id": "58aae162-75d4-403b-a793-3bc7308e4cd2",\n                        "name": "Rainbow Grocery",\n                        "color": "gray"\n                    },\n                    {\n                        "id": "22d0f199-babc-44ff-bd80-a9eae3e3fcbf",\n                        "name": "Nijiya Market",\n                        "color": "purple"\n                    },\n                    {\n                        "id": "0d069987-ffb0-4347-bde2-8e4068003dbc",\n                        "name": "Gus\'s Community Market",\n                        "color": "yellow"\n                    }\n                ]\n            }\n        },\n        "Photo": {\n            "id": "yfiK",\n            "name": "Photo",\n            "type": "files",\n            "files": {}\n        },\n        "Food group": {\n            "id": "CM%3EH",\n            "name": "Food group",\n            "type": "select",\n            "select": {\n                "options": [\n                    {\n                        "id": "6d4523fa-88cb-4ffd-9364-1e39d0f4e566",\n                        "name": "🥦Vegetable",\n                        "color": "green"\n                    },\n                    {\n                        "id": "268d7e75-de8f-4c4b-8b9d-de0f97021833",\n                        "name": "🍎Fruit",\n                        "color": "red"\n                    },\n                    {\n                        "id": "1b234a00-dc97-489c-b987-829264cfdfef",\n                        "name": "💪Protein",\n                        "color": "yellow"\n                    }\n                ]\n            }\n        },\n        "Name": {\n            "id": "title",\n            "name": "Name",\n            "type": "title",\n            "title": {}\n        }\n    },\n    "parent": {\n        "type": "page_id",\n        "page_id": "98ad959b-2b6a-4774-80ee-00246fb0ea9b"\n    },\n    "archived": false,\n    "is_inline": false,\n    "public_url": null\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'database',
                  },
                  id: {
                    type: 'string',
                    example: 'bc1211ca-e3f1-4939-ae34-5260b16f627c',
                  },
                  created_time: {
                    type: 'string',
                    example: '2021-07-08T23:50:00.000Z',
                  },
                  last_edited_time: {
                    type: 'string',
                    example: '2021-07-08T23:50:00.000Z',
                  },
                  icon: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        example: 'emoji',
                      },
                      emoji: {
                        type: 'string',
                        example: '🎉',
                      },
                    },
                  },
                  cover: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        example: 'external',
                      },
                      external: {
                        type: 'object',
                        properties: {
                          url: {
                            type: 'string',
                            example: 'https://website.domain/images/image.png',
                          },
                        },
                      },
                    },
                  },
                  url: {
                    type: 'string',
                    example: 'https://www.notion.so/bc1211cae3f14939ae34260b16f627c',
                  },
                  title: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: {
                          type: 'string',
                          example: 'text',
                        },
                        text: {
                          type: 'object',
                          properties: {
                            content: {
                              type: 'string',
                              example: 'Grocery List',
                            },
                            link: {},
                          },
                        },
                        annotations: {
                          type: 'object',
                          properties: {
                            bold: {
                              type: 'boolean',
                              example: false,
                              default: true,
                            },
                            italic: {
                              type: 'boolean',
                              example: false,
                              default: true,
                            },
                            strikethrough: {
                              type: 'boolean',
                              example: false,
                              default: true,
                            },
                            underline: {
                              type: 'boolean',
                              example: false,
                              default: true,
                            },
                            code: {
                              type: 'boolean',
                              example: false,
                              default: true,
                            },
                            color: {
                              type: 'string',
                              example: 'default',
                            },
                          },
                        },
                        plain_text: {
                          type: 'string',
                          example: 'Grocery List',
                        },
                        href: {},
                      },
                    },
                  },
                  description: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: {
                          type: 'string',
                          example: 'text',
                        },
                        text: {
                          type: 'object',
                          properties: {
                            content: {
                              type: 'string',
                              example: 'Grocery list for just kale 🥬',
                            },
                            link: {},
                          },
                        },
                        annotations: {
                          type: 'object',
                          properties: {
                            bold: {
                              type: 'boolean',
                              example: false,
                              default: true,
                            },
                            italic: {
                              type: 'boolean',
                              example: false,
                              default: true,
                            },
                            strikethrough: {
                              type: 'boolean',
                              example: false,
                              default: true,
                            },
                            underline: {
                              type: 'boolean',
                              example: false,
                              default: true,
                            },
                            code: {
                              type: 'boolean',
                              example: false,
                              default: true,
                            },
                            color: {
                              type: 'string',
                              example: 'default',
                            },
                          },
                        },
                        plain_text: {
                          type: 'string',
                          example: 'Grocery list for just kale 🥬',
                        },
                        href: {},
                      },
                    },
                  },
                  properties: {
                    type: 'object',
                    properties: {
                      '+1': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'Wp%3DC',
                          },
                          name: {
                            type: 'string',
                            example: '+1',
                          },
                          type: {
                            type: 'string',
                            example: 'people',
                          },
                          people: {
                            type: 'object',
                            properties: {},
                          },
                        },
                      },
                      'In stock': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'fk%5EY',
                          },
                          name: {
                            type: 'string',
                            example: 'In stock',
                          },
                          type: {
                            type: 'string',
                            example: 'checkbox',
                          },
                          checkbox: {
                            type: 'object',
                            properties: {},
                          },
                        },
                      },
                      Price: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'evWq',
                          },
                          name: {
                            type: 'string',
                            example: 'Price',
                          },
                          type: {
                            type: 'string',
                            example: 'number',
                          },
                          number: {
                            type: 'object',
                            properties: {
                              format: {
                                type: 'string',
                                example: 'dollar',
                              },
                            },
                          },
                        },
                      },
                      Description: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'V}lX',
                          },
                          name: {
                            type: 'string',
                            example: 'Description',
                          },
                          type: {
                            type: 'string',
                            example: 'rich_text',
                          },
                          rich_text: {
                            type: 'object',
                            properties: {},
                          },
                        },
                      },
                      'Last ordered': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'eVnV',
                          },
                          name: {
                            type: 'string',
                            example: 'Last ordered',
                          },
                          type: {
                            type: 'string',
                            example: 'date',
                          },
                          date: {
                            type: 'object',
                            properties: {},
                          },
                        },
                      },
                      Meals: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: '%7DWA~',
                          },
                          name: {
                            type: 'string',
                            example: 'Meals',
                          },
                          type: {
                            type: 'string',
                            example: 'relation',
                          },
                          relation: {
                            type: 'object',
                            properties: {
                              database_id: {
                                type: 'string',
                                example: '668d797c-76fa-4934-9b05-ad288df2d136',
                              },
                              synced_property_name: {
                                type: 'string',
                                example: 'Related to Grocery List (Meals)',
                              },
                            },
                          },
                        },
                      },
                      'Number of meals': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'Z\\Eh',
                          },
                          name: {
                            type: 'string',
                            example: 'Number of meals',
                          },
                          type: {
                            type: 'string',
                            example: 'rollup',
                          },
                          rollup: {
                            type: 'object',
                            properties: {
                              rollup_property_name: {
                                type: 'string',
                                example: 'Name',
                              },
                              relation_property_name: {
                                type: 'string',
                                example: 'Meals',
                              },
                              rollup_property_id: {
                                type: 'string',
                                example: 'title',
                              },
                              relation_property_id: {
                                type: 'string',
                                example: 'mxp^',
                              },
                              function: {
                                type: 'string',
                                example: 'count',
                              },
                            },
                          },
                        },
                      },
                      'Store availability': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 's}Kq',
                          },
                          name: {
                            type: 'string',
                            example: 'Store availability',
                          },
                          type: {
                            type: 'string',
                            example: 'multi_select',
                          },
                          multi_select: {
                            type: 'object',
                            properties: {
                              options: {
                                type: 'array',
                                items: {
                                  type: 'object',
                                  properties: {
                                    id: {
                                      type: 'string',
                                      example: 'cb79b393-d1c1-4528-b517-c450859de766',
                                    },
                                    name: {
                                      type: 'string',
                                      example: 'Duc Loi Market',
                                    },
                                    color: {
                                      type: 'string',
                                      example: 'blue',
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                      Photo: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'yfiK',
                          },
                          name: {
                            type: 'string',
                            example: 'Photo',
                          },
                          type: {
                            type: 'string',
                            example: 'files',
                          },
                          files: {
                            type: 'object',
                            properties: {},
                          },
                        },
                      },
                      'Food group': {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'CM%3EH',
                          },
                          name: {
                            type: 'string',
                            example: 'Food group',
                          },
                          type: {
                            type: 'string',
                            example: 'select',
                          },
                          select: {
                            type: 'object',
                            properties: {
                              options: {
                                type: 'array',
                                items: {
                                  type: 'object',
                                  properties: {
                                    id: {
                                      type: 'string',
                                      example: '6d4523fa-88cb-4ffd-9364-1e39d0f4e566',
                                    },
                                    name: {
                                      type: 'string',
                                      example: '🥦Vegetable',
                                    },
                                    color: {
                                      type: 'string',
                                      example: 'green',
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                      Name: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            example: 'title',
                          },
                          name: {
                            type: 'string',
                            example: 'Name',
                          },
                          type: {
                            type: 'string',
                            example: 'title',
                          },
                          title: {
                            type: 'object',
                            properties: {},
                          },
                        },
                      },
                    },
                  },
                  parent: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        example: 'page_id',
                      },
                      page_id: {
                        type: 'string',
                        example: '98ad959b-2b6a-4774-80ee-00246fb0ea9b',
                      },
                    },
                  },
                  archived: {
                    type: 'boolean',
                    example: false,
                    default: true,
                  },
                  is_inline: {
                    type: 'boolean',
                    example: false,
                    default: true,
                  },
                  public_url: {},
                },
              },
            },
          },
        },
        '400': {
          description: '400',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}',
                },
              },
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
        '404': {
          description: '404',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n  "object": "error",\n  "status": 404,\n  "code": "object_not_found",\n  "message": "Could not find database with ID: a1d8501e-1ac1-43e9-a6bd-ea9fe6c8822c. Make sure the relevant pages and databases are shared with your integration."\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'error',
                  },
                  status: {
                    type: 'integer',
                    example: 404,
                    default: 0,
                  },
                  code: {
                    type: 'string',
                    example: 'object_not_found',
                  },
                  message: {
                    type: 'string',
                    example:
                      'Could not find database with ID: a1d8501e-1ac1-43e9-a6bd-ea9fe6c8822c. Make sure the relevant pages and databases are shared with your integration.',
                  },
                },
              },
            },
          },
        },
        '429': {
          description: '429',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n  "object": "error",\n  "status": 429,\n  "code": "rate_limited",\n  "message": "You have been rate limited. Please try again in a few minutes."\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'error',
                  },
                  status: {
                    type: 'integer',
                    example: 429,
                    default: 0,
                  },
                  code: {
                    type: 'string',
                    example: 'rate_limited',
                  },
                  message: {
                    type: 'string',
                    example: 'You have been rate limited. Please try again in a few minutes.',
                  },
                },
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript',
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const databaseId = '668d797c-76fa-4934-9b05-ad288df2d136';\n  const response = await notion.databases.retrieve({ database_id: databaseId });\n  console.log(response);\n})();",
            name: 'Notion SDK for JavaScript',
          },
          {
            language: 'curl',
            code: "curl 'https://api.notion.com/v1/databases/668d797c-76fa-4934-9b05-ad288df2d136' \\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"'' \\\n  -H 'Notion-Version: 2022-06-28'",
          },
        ],
        'samples-languages': ['javascript', 'curl'],
      },
    },
  },
  '/v1/pages/{page_id}/properties/{property_id}': {
    get: {
      summary: 'Retrieve a page property item',
      description: '',
      operationId: 'retrieve-a-page-property',
      parameters: [
        {
          name: 'page_id',
          in: 'path',
          description: 'Identifier for a Notion page',
          schema: {
            type: 'string',
          },
          required: true,
        },
        {
          name: 'property_id',
          in: 'path',
          description:
            'Identifier for a page [property](https://developers.notion.com/reference/page#all-property-values)',
          schema: {
            type: 'string',
          },
          required: true,
        },
        {
          name: 'page_size',
          in: 'query',
          description:
            'For paginated properties. The max number of property item objects on a page. The default size is 100',
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
        {
          name: 'start_cursor',
          in: 'query',
          description: 'For paginated properties.',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'Notion-Version',
          in: 'header',
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                'Number Property Item': {
                  value: '{\n  "object": "property_item",\n  "id" "kjPO",\n  "type": "number",\n  "number": 2\n}',
                },
                Result: {
                  value:
                    '{\n    "object": "list",\n    "results": [\n        {\n            "object": "property_item",\n            "id" "kjPO",\n            "type": "rich_text",\n            "rich_text": {\n                "type": "text",\n                "text": {\n                    "content": "Avocado ",\n                    "link": null\n                },\n                "annotations": {\n                    "bold": false,\n                    "italic": false,\n                    "strikethrough": false,\n                    "underline": false,\n                    "code": false,\n                    "color": "default"\n                },\n                "plain_text": "Avocado ",\n                "href": null\n            }\n        },\n        {\n            "object": "property_item",\n            "id" "ijPO",\n            "type": "rich_text",\n            "rich_text": {\n                "type": "mention",\n                "mention": {\n                    "type": "page",\n                    "page": {\n                        "id": "41117fd7-69a5-4694-bc07-c1e3a682c857"\n                    }\n                },\n                "annotations": {\n                    "bold": false,\n                    "italic": false,\n                    "strikethrough": false,\n                    "underline": false,\n                    "code": false,\n                    "color": "default"\n                },\n                "plain_text": "Lemons",\n                "href": "http://notion.so/41117fd769a54694bc07c1e3a682c857"\n            }\n        },\n        {\n            "object": "property_item",\n            "id" "kjPO",\n            "type": "rich_text",\n            "rich_text": {\n                "type": "text",\n                "text": {\n                    "content": " Tomato ",\n                    "link": null\n                },\n                "annotations": {\n                    "bold": false,\n                    "italic": false,\n                    "strikethrough": false,\n                    "underline": false,\n                    "code": false,\n                    "color": "default"\n                },\n                "plain_text": " Tomato ",\n                "href": null\n            }\n        },\n...\n    ],\n    "next_cursor": "some-next-cursor-value",\n    "has_more": true,\n\t\t"next_url": "http://api.notion.com/v1/pages/0e5235bf86aa4efb93aa772cce7eab71/properties/NVv^?start_cursor=some-next-cursor-value&page_size=25",\n    "property_item": {\n      "id": "NVv^",\n      "next_url": null,\n      "type": "rich_text",\n      "rich_text": {}\n    }\n}',
                },
                'Rollup List Property Item': {
                  value:
                    '{\n    "object": "list",\n    "results": [\n        {\n            "object": "property_item",\n          \t"id": "dj2l",\n            "type": "relation",\n            "relation": {\n                "id": "83f92c9d-523d-466e-8c1f-9bc2c25a99fe"\n            }\n        },\n        {\n            "object": "property_item",\n          \t"id": "dj2l",\n            "type": "relation",\n            "relation": {\n                "id": "45cfb825-3463-4891-8932-7e6d8c170630"\n            }\n        },\n        {\n            "object": "property_item",\n          \t"id": "dj2l",\n            "type": "relation",\n            "relation": {\n                "id": "1688be1a-a197-4f2a-9688-e528c4b56d94"\n            }\n        }\n    ],\n    "next_cursor": "some-next-cursor-value",\n    "has_more": true,\n\t\t"property_item": {\n      "id": "y}~p",\n      "next_url": "http://api.notion.com/v1/pages/0e5235bf86aa4efb93aa772cce7eab71/properties/y%7D~p?start_cursor=1QaTunT5&page_size=25",\n      "type": "rollup",\n      "rollup": {\n        "function": "sum",\n        "type": "incomplete",\n        "incomplete": {}\n      }\n    }\n    "type": "property_item"\n}',
                },
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript',
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const pageId = 'b55c9c91-384d-452b-81db-d1ef79372b75';\n  const propertyId = \"aBcD123\n  const response = await notion.pages.properties.retrieve({ page_id: pageId, property_id: propertyId });\n  console.log(response);\n})();",
            name: 'Notion SDK for JavaScript',
          },
          {
            language: 'curl',
            code: "curl --request GET \\\n  --url https://api.notion.com/v1/pages/b55c9c91-384d-452b-81db-d1ef79372b75/properties/some-property-id \\\n  --header 'Authorization: Bearer $NOTION_API_KEY' \\\n  --header 'Notion-Version: 2022-06-28'",
          },
        ],
        'samples-languages': ['javascript', 'curl'],
      },
    },
  },
  '/v1/users/me': {
    get: {
      summary: "Retrieve your token's bot user",
      description: '',
      operationId: 'get-self',
      parameters: [
        {
          name: 'Notion-Version',
          in: 'header',
          required: true,
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n  "object": "user",\n  "id": "16d84278-ab0e-484c-9bdd-b35da3bd8905",\n  "name": "pied piper",\n  "avatar_url": null,\n  "type": "bot",\n  "bot": {\n    "owner": {\n      "type": "user",\n      "user": {\n        "object": "user",\n        "id": "5389a034-eb5c-47b5-8a9e-f79c99ef166c",\n        "name": "christine makenotion",\n        "avatar_url": null,\n        "type": "person",\n        "person": {\n          "email": "christine@makenotion.com"\n        }\n      }\n    }\n  }\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'user',
                  },
                  id: {
                    type: 'string',
                    example: '16d84278-ab0e-484c-9bdd-b35da3bd8905',
                  },
                  name: {
                    type: 'string',
                    example: 'pied piper',
                  },
                  avatar_url: {},
                  type: {
                    type: 'string',
                    example: 'bot',
                  },
                  bot: {
                    type: 'object',
                    properties: {
                      owner: {
                        type: 'object',
                        properties: {
                          type: {
                            type: 'string',
                            example: 'user',
                          },
                          user: {
                            type: 'object',
                            properties: {
                              object: {
                                type: 'string',
                                example: 'user',
                              },
                              id: {
                                type: 'string',
                                example: '5389a034-eb5c-47b5-8a9e-f79c99ef166c',
                              },
                              name: {
                                type: 'string',
                                example: 'christine makenotion',
                              },
                              avatar_url: {},
                              type: {
                                type: 'string',
                                example: 'person',
                              },
                              person: {
                                type: 'object',
                                properties: {
                                  email: {
                                    type: 'string',
                                    example: 'christine@makenotion.com',
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '400': {
          description: '400',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value: '{}',
                },
              },
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript',
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const response = await notion.users.me();\n  console.log(response);\n})();",
            name: 'Notion SDK for JavaScript',
          },
          {
            language: 'curl',
            code: "curl 'https://api.notion.com/v1/users/me' \\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"'' \\\n  -H \"Notion-Version: 2022-06-28\" \\",
          },
        ],
        'samples-languages': ['javascript', 'curl'],
      },
    },
  },
  '/v1/comments': {
    get: {
      summary: 'Retrieve comments',
      description: 'Retrieves a list of un-resolved [Comment objects](ref:comment-object) from a page or block.',
      operationId: 'retrieve-a-comment',
      parameters: [
        {
          name: 'Notion-Version',
          in: 'header',
          required: true,
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
        {
          name: 'block_id',
          in: 'query',
          description: 'Identifier for a Notion block or page',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'start_cursor',
          in: 'query',
          description:
            'If supplied, this endpoint will return a page of results starting after the cursor provided. If not supplied, this endpoint will return the first page of results.',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'page_size',
          in: 'query',
          description: 'The number of items from the full list desired in the response. Maximum: 100',
          schema: {
            type: 'integer',
            format: 'int32',
          },
        },
      ],
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                OK: {
                  value:
                    '{\n    "object": "list",\n    "results": [\n        {\n            "object": "comment",\n            "id": "94cc56ab-9f02-409d-9f99-1037e9fe502f",\n            "parent": {\n                "type": "page_id",\n                "page_id": "5c6a2821-6bb1-4a7e-b6e1-c50111515c3d"\n            },\n            "discussion_id": "f1407351-36f5-4c49-a13c-49f8ba11776d",\n            "created_time": "2022-07-15T16:52:00.000Z",\n            "last_edited_time": "2022-07-15T19:16:00.000Z",\n            "created_by": {\n                "object": "user",\n                "id": "9b15170a-9941-4297-8ee6-83fa7649a87a"\n            },\n            "rich_text": [\n                {\n                    "type": "text",\n                    "text": {\n                        "content": "Single comment",\n                        "link": null\n                    },\n                    "annotations": {\n                        "bold": false,\n                        "italic": false,\n                        "strikethrough": false,\n                        "underline": false,\n                        "code": false,\n                        "color": "default"\n                    },\n                    "plain_text": "Single comment",\n                    "href": null\n                }\n            ]\n        }\n    ],\n    "next_cursor": null,\n    "has_more": false,\n    "type": "comment",\n    "comment": {}\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'list',
                  },
                  results: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        object: {
                          type: 'string',
                          example: 'comment',
                        },
                        id: {
                          type: 'string',
                          example: '94cc56ab-9f02-409d-9f99-1037e9fe502f',
                        },
                        parent: {
                          type: 'object',
                          properties: {
                            type: {
                              type: 'string',
                              example: 'page_id',
                            },
                            page_id: {
                              type: 'string',
                              example: '5c6a2821-6bb1-4a7e-b6e1-c50111515c3d',
                            },
                          },
                        },
                        discussion_id: {
                          type: 'string',
                          example: 'f1407351-36f5-4c49-a13c-49f8ba11776d',
                        },
                        created_time: {
                          type: 'string',
                          example: '2022-07-15T16:52:00.000Z',
                        },
                        last_edited_time: {
                          type: 'string',
                          example: '2022-07-15T19:16:00.000Z',
                        },
                        created_by: {
                          type: 'object',
                          properties: {
                            object: {
                              type: 'string',
                              example: 'user',
                            },
                            id: {
                              type: 'string',
                              example: '9b15170a-9941-4297-8ee6-83fa7649a87a',
                            },
                          },
                        },
                        rich_text: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              type: {
                                type: 'string',
                                example: 'text',
                              },
                              text: {
                                type: 'object',
                                properties: {
                                  content: {
                                    type: 'string',
                                    example: 'Single comment',
                                  },
                                  link: {},
                                },
                              },
                              annotations: {
                                type: 'object',
                                properties: {
                                  bold: {
                                    type: 'boolean',
                                    example: false,
                                    default: true,
                                  },
                                  italic: {
                                    type: 'boolean',
                                    example: false,
                                    default: true,
                                  },
                                  strikethrough: {
                                    type: 'boolean',
                                    example: false,
                                    default: true,
                                  },
                                  underline: {
                                    type: 'boolean',
                                    example: false,
                                    default: true,
                                  },
                                  code: {
                                    type: 'boolean',
                                    example: false,
                                    default: true,
                                  },
                                  color: {
                                    type: 'string',
                                    example: 'default',
                                  },
                                },
                              },
                              plain_text: {
                                type: 'string',
                                example: 'Single comment',
                              },
                              href: {},
                            },
                          },
                        },
                      },
                    },
                  },
                  next_cursor: {},
                  has_more: {
                    type: 'boolean',
                    example: false,
                    default: true,
                  },
                  type: {
                    type: 'string',
                    example: 'comment',
                  },
                  comment: {
                    type: 'object',
                    properties: {},
                  },
                },
              },
            },
          },
        },
        '403': {
          description: '403',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n    "object": "error",\n    "status": 403,\n    "code": "restricted_resource",\n    "message": "Insufficient permissions for this endpoint."\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'error',
                  },
                  status: {
                    type: 'integer',
                    example: 403,
                    default: 0,
                  },
                  code: {
                    type: 'string',
                    example: 'restricted_resource',
                  },
                  message: {
                    type: 'string',
                    example: 'Insufficient permissions for this endpoint.',
                  },
                },
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript',
            code: "const { Client } = require('@notionhq/client');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const blockId = 'd40e767c-d7af-4b18-a86d-55c61f1e39a4';\n  const response = await notion.comments.list({ block_id: blockId });\n  console.log(response);\n})();",
            name: 'Notion SDK for JavaScript',
          },
          {
            language: 'curl',
            code: "curl 'https://api.notion.com/v1/comments?block_id=5c6a28216bb14a7eb6e1c50111515c3d'\\\n  -H 'Authorization: Bearer '\"$NOTION_API_KEY\"'' \\\n  -H \"Notion-Version: 2022-06-28\"",
          },
        ],
        'samples-languages': ['javascript', 'curl'],
      },
    },
    post: {
      summary: 'Create comment',
      description: 'Creates a comment in a page or existing discussion thread.',
      operationId: 'create-a-comment',
      parameters: [
        {
          name: 'Notion-Version',
          in: 'header',
          required: true,
          schema: {
            type: 'string',
            default: '2022-06-28',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['rich_text'],
              properties: {
                parent: {
                  type: 'string',
                  description:
                    'A [page parent](/reference/database#page-parent). Either this or a discussion_id is required (not both)',
                  format: 'json',
                },
                discussion_id: {
                  type: 'string',
                  description:
                    'A UUID identifier for a discussion thread. Either this or a parent object is required (not both)',
                },
                rich_text: {
                  type: 'string',
                  description: 'A [rich text object](ref:rich-text)',
                  format: 'json',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n    "object": "comment",\n    "id": "b52b8ed6-e029-4707-a671-832549c09de3",\n    "parent": {\n        "type": "page_id",\n        "page_id": "5c6a2821-6bb1-4a7e-b6e1-c50111515c3d"\n    },\n    "discussion_id": "f1407351-36f5-4c49-a13c-49f8ba11776d",\n    "created_time": "2022-07-15T20:53:00.000Z",\n    "last_edited_time": "2022-07-15T20:53:00.000Z",\n    "created_by": {\n        "object": "user",\n        "id": "067dee40-6ebd-496f-b446-093c715fb5ec"\n    },\n    "rich_text": [\n        {\n            "type": "text",\n            "text": {\n                "content": "Hello world",\n                "link": null\n            },\n            "annotations": {\n                "bold": false,\n                "italic": false,\n                "strikethrough": false,\n                "underline": false,\n                "code": false,\n                "color": "default"\n            },\n            "plain_text": "Hello world",\n            "href": null\n        }\n    ]\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'comment',
                  },
                  id: {
                    type: 'string',
                    example: 'b52b8ed6-e029-4707-a671-832549c09de3',
                  },
                  parent: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        example: 'page_id',
                      },
                      page_id: {
                        type: 'string',
                        example: '5c6a2821-6bb1-4a7e-b6e1-c50111515c3d',
                      },
                    },
                  },
                  discussion_id: {
                    type: 'string',
                    example: 'f1407351-36f5-4c49-a13c-49f8ba11776d',
                  },
                  created_time: {
                    type: 'string',
                    example: '2022-07-15T20:53:00.000Z',
                  },
                  last_edited_time: {
                    type: 'string',
                    example: '2022-07-15T20:53:00.000Z',
                  },
                  created_by: {
                    type: 'object',
                    properties: {
                      object: {
                        type: 'string',
                        example: 'user',
                      },
                      id: {
                        type: 'string',
                        example: '067dee40-6ebd-496f-b446-093c715fb5ec',
                      },
                    },
                  },
                  rich_text: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: {
                          type: 'string',
                          example: 'text',
                        },
                        text: {
                          type: 'object',
                          properties: {
                            content: {
                              type: 'string',
                              example: 'Hello world',
                            },
                            link: {},
                          },
                        },
                        annotations: {
                          type: 'object',
                          properties: {
                            bold: {
                              type: 'boolean',
                              example: false,
                              default: true,
                            },
                            italic: {
                              type: 'boolean',
                              example: false,
                              default: true,
                            },
                            strikethrough: {
                              type: 'boolean',
                              example: false,
                              default: true,
                            },
                            underline: {
                              type: 'boolean',
                              example: false,
                              default: true,
                            },
                            code: {
                              type: 'boolean',
                              example: false,
                              default: true,
                            },
                            color: {
                              type: 'string',
                              example: 'default',
                            },
                          },
                        },
                        plain_text: {
                          type: 'string',
                          example: 'Hello world',
                        },
                        href: {},
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '403': {
          description: '403',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n    "object": "error",\n    "status": 403,\n    "code": "restricted_resource",\n    "message": "Insufficient permissions for this endpoint."\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  object: {
                    type: 'string',
                    example: 'error',
                  },
                  status: {
                    type: 'integer',
                    example: 403,
                    default: 0,
                  },
                  code: {
                    type: 'string',
                    example: 'restricted_resource',
                  },
                  message: {
                    type: 'string',
                    example: 'Insufficient permissions for this endpoint.',
                  },
                },
              },
            },
          },
        },
      },
      deprecated: false,
      security: [],
      'x-readme': {
        'code-samples': [
          {
            language: 'javascript',
            code: 'const { Client } = require(\'@notionhq/client\');\n\nconst notion = new Client({ auth: process.env.NOTION_API_KEY });\n\n(async () => {\n  const response = await notion.comments.create({\n    "parent": {\n      "page_id": "5c6a28216bb14a7eb6e1c50111515c3d"\n    },\n    "rich_text": [\n      {\n        "text": {\n          "content": "Hello world"\n        }\n      }\n    ]\n\t});\n  \n  console.log(response);\n})();\n',
            name: 'Notion SDK for JavaScript',
          },
          {
            language: 'curl',
            code: 'curl \'https://api.notion.com/v1/comments\' \\\n  -H \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n  -H "Notion-Version: 2022-06-28" \\\n  --data \'{\n    "parent": {\n      "page_id": "5c6a28216bb14a7eb6e1c50111515c3d"\n    },\n    "rich_text": [\n      {\n        "text": {\n          "content": "Hello world"\n        }\n      }\n    ]\n\t}\'',
          },
        ],
        'samples-languages': ['javascript', 'curl'],
      },
    },
  },
  '/v1/oauth/token': {
    post: {
      summary: 'Create a token',
      description: 'Creates an access token that a third-party service can use to authenticate with Notion.',
      operationId: 'create-a-token',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['code', 'grant_type', 'redirect_uri'],
              properties: {
                code: {
                  type: 'string',
                  description:
                    'A unique random code that Notion generates to authenticate with your service, generated when a user initiates the OAuth flow.',
                },
                grant_type: {
                  type: 'string',
                  description: 'A constant string: "authorization_code".',
                  default: '"authorization_code"',
                },
                redirect_uri: {
                  type: 'string',
                  description:
                    'The `"redirect_uri"` that was provided in the OAuth Domain & URI section of the integration\'s Authorization settings. Do not include this field if a `"redirect_uri"` query param was not included in the Authorization URL provided to users. In most cases, this field is required.',
                },
                external_account: {
                  type: 'object',
                  description:
                    'Required if and only when building [Link Preview](https://developers.notion.com/docs/link-previews) integrations (otherwise ignored). An object with `key` and `name` properties. `key` should be a unique identifier for the account. Notion uses the `key` to determine whether or not the user is re-connecting the same account. `name` should be some way for the user to know which account they used to authenticate with your service. If a user has authenticated Notion with your integration before and `key` is the same but `name` is different, then Notion updates the `name` associated with your integration.',
                  properties: {},
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: '200',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n  "access_token": "e202e8c9-0990-40af-855f-ff8f872b1ec6c",\n  "bot_id": "b3414d659-1224-5ty7-6ffr-cc9d8773drt601288f",\n  "duplicated_template_id": null,\n  "owner": {\n    "workspace": true\n  },\n  "workspace_icon": "https://website.domain/images/image.png",\n  "workspace_id": "j565j4d7x3-2882-61bs-564a-jj9d9ui-c36hxfr7x",\n  "workspace_name": "Ada\'s Notion Workspace"\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  access_token: {
                    type: 'string',
                    example: 'e202e8c9-0990-40af-855f-ff8f872b1ec6c',
                  },
                  bot_id: {
                    type: 'string',
                    example: 'b3414d659-1224-5ty7-6ffr-cc9d8773drt601288f',
                  },
                  duplicated_template_id: {},
                  owner: {
                    type: 'object',
                    properties: {
                      workspace: {
                        type: 'boolean',
                        example: true,
                        default: true,
                      },
                    },
                  },
                  workspace_icon: {
                    type: 'string',
                    example: 'https://website.domain/images/image.png',
                  },
                  workspace_id: {
                    type: 'string',
                    example: 'j565j4d7x3-2882-61bs-564a-jj9d9ui-c36hxfr7x',
                  },
                  workspace_name: {
                    type: 'string',
                    example: "Ada's Notion Workspace",
                  },
                },
              },
            },
          },
        },
        '400': {
          description: '400',
          content: {
            'application/json': {
              examples: {
                Result: {
                  value:
                    '{\n    "error": "invalid_request",\n    "error_description": "body failed validation: body.redirect_uri should be defined, instead was `undefined`."\n}',
                },
              },
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    example: 'invalid_request',
                  },
                  error_description: {
                    type: 'string',
                    example: 'body failed validation: body.redirect_uri should be defined, instead was `undefined`.',
                  },
                },
              },
            },
          },
        },
      },
      deprecated: false,
      'x-readme': {
        'code-samples': [
          {
            language: 'curl',
            code: 'curl --location --request POST \'https://api.notion.com/v1/oauth/token\' \\\n--header \'Authorization: Basic \'"$BASE64_ENCODED_ID_AND_SECRET"\'\' \\\n--header \'Content-Type: application/json\' \\\n--header \'Notion-Version: 2022-06-28\' \\\n--data \'{\n  "grant_type": "authorization_code",\n  "code": "e202e8c9-0990-40af-855f-ff8f872b1ec6",\n  "redirect_uri": "https://wwww.my-integration-endpoint.dev/callback",\n   "external_account": {\n        "key": "A83823453409384",\n        "name": "Notion - team@makenotion.com"\n    }\n}\'',
            name: 'Create a token for a Link Preview',
          },
          {
            language: 'curl',
            code: 'curl --location --request POST \'https://api.notion.com/v1/databases/\' \\\n--header \'Authorization: Bearer \'"$NOTION_API_KEY"\'\' \\\n--header \'Content-Type: application/json\' \\\n--header \'Notion-Version: 2022-06-28\' \\\n--data \'{\n\t"grant_type": "authorization_code",\n  "code": "e202e8c9-0990-40af-855f-ff8f872b1ec6",\n  "redirect_uri": "https://example.com/auth/notion/callback"\n}\'',
            name: 'Create a token for a public integration',
          },
        ],
        'samples-languages': ['curl'],
      },
    },
  },
} as TPaths;
