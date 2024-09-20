// @ts-nocheck
export type TPaths = {
  '/v1/departments/{id}': {
    get: {
      operationId: 'getDepartment';
      parameters: [
        {
          in: 'path';
          name: 'id';
          description: 'The ID of the department to retrieve';
          schema: {
            type: 'string';
            description: 'The ID of the department to retrieve';
          };
          required: true;
        },
        {
          in: 'query';
          name: 'render_as';
          description: "This parameter defines how to represent the list of departments. The default value is 'list’, which returns a flat list of departments. If this is set to 'tree’, departments are represented in a tree-like structure where they may include sub-departments as children.";
          schema: {
            type: ['string', 'null'];
            enum: ['list', 'tree'];
            default: 'list';
            description: "This parameter defines how to represent the list of departments. The default value is 'list’, which returns a flat list of departments. If this is set to 'tree’, departments are represented in a tree-like structure where they may include sub-departments as children.";
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {};
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/department';
              };
            };
          };
        };
      };
    };
  };
  '/v1/departments': {
    get: {
      operationId: 'getDepartments';
      parameters: [
        {
          in: 'query';
          name: 'render_as';
          description: "This parameter defines how to represent the list of departments. The default value is 'list’, which returns a flat list of departments. If this is set to 'tree’, departments are represented in a tree-like structure where they may include sub-departments as children.";
          schema: {
            type: ['string', 'null'];
            enum: ['list', 'tree'];
            default: 'list';
            description: "This parameter defines how to represent the list of departments. The default value is 'list’, which returns a flat list of departments. If this is set to 'tree’, departments are represented in a tree-like structure where they may include sub-departments as children.";
          };
        },
        {
          in: 'query';
          name: 'per_page';
          description: 'Return up to this number of objects per response. Must be an integer between 1 and 500. Defaults to 100.';
          schema: {
            type: 'number';
            minimum: 1;
            maximum: 500;
            description: 'Return up to this number of objects per response. Must be an integer between 1 and 500. Defaults to 100.';
            default: 100;
          };
        },
        {
          in: 'query';
          name: 'page';
          description: 'A cursor for use in pagination. Returns the n-th chunk of per_page objects.';
          schema: {
            type: 'number';
            description: 'A cursor for use in pagination. Returns the n-th chunk of per_page objects.';
          };
        },
        {
          in: 'query';
          name: 'external_id';
          description: 'If supplied, only return department(s) with that external ID.';
          schema: {
            type: 'string';
            description: 'If supplied, only return department(s) with that external ID.';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {};
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/department';
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/jobs/{id}': {
    get: {
      operationId: 'getJob';
      parameters: [
        {
          in: 'path';
          name: 'id';
          description: 'The ID of the job to retrieve';
          schema: {
            type: 'string';
            description: 'The ID of the job to retrieve';
          };
          required: true;
        },
      ];
      requestBody: {
        content: {
          'application/json': {};
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/job';
              };
            };
          };
        };
      };
    };
  };
  '/v1/jobs': {
    get: {
      operationId: 'getJobs';
      parameters: [
        {
          in: 'query';
          name: 'per_page';
          description: 'Return up to this number of objects per response. Must be an integer between 1 and 500. Defaults to 100.';
          schema: {
            type: 'number';
            minimum: 1;
            maximum: 500;
            description: 'Return up to this number of objects per response. Must be an integer between 1 and 500. Defaults to 100.';
            default: 100;
          };
        },
        {
          in: 'query';
          name: 'page';
          description: 'A cursor for use in pagination. Returns the n-th chunk of per_page objects.';
          schema: {
            type: 'number';
            description: 'A cursor for use in pagination. Returns the n-th chunk of per_page objects.';
          };
        },
        {
          in: 'query';
          name: 'external_id';
          description: 'If supplied, only return department(s) with that external ID.';
          schema: {
            type: 'string';
            description: 'If supplied, only return department(s) with that external ID.';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {};
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/job';
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/offers/{id}': {
    get: {
      operationId: 'getOffer';
      parameters: [
        {
          in: 'path';
          name: 'id';
          description: 'The ID of the offer to retrieve';
          schema: {
            type: 'string';
            description: 'The ID of the offer to retrieve';
          };
          required: true;
        },
      ];
      requestBody: {
        content: {
          'application/json': {};
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/offer';
              };
            };
          };
        };
      };
    };
  };
  '/v1/offers': {
    get: {
      operationId: 'getOffers';
      parameters: [
        {
          in: 'query';
          name: 'per_page';
          description: 'Return up to this number of objects per response. Must be an integer between 1 and 500. Defaults to 100.';
          schema: {
            type: 'number';
            minimum: 1;
            maximum: 500;
            description: 'Return up to this number of objects per response. Must be an integer between 1 and 500. Defaults to 100.';
            default: 100;
          };
        },
        {
          in: 'query';
          name: 'page';
          description: 'A cursor for use in pagination. Returns the n-th chunk of per_page objects.';
          schema: {
            type: 'number';
            description: 'A cursor for use in pagination. Returns the n-th chunk of per_page objects.';
          };
        },
        {
          in: 'query';
          name: 'external_id';
          description: 'If supplied, only return department(s) with that external ID.';
          schema: {
            type: 'string';
            description: 'If supplied, only return department(s) with that external ID.';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {};
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/offer';
                };
              };
            };
          };
        };
      };
    };
  };
  '/v1/candidates/{id}': {
    get: {
      operationId: 'getCandidate';
      parameters: [
        {
          in: 'path';
          name: 'id';
          description: 'The ID of the candidate to retrieve';
          schema: {
            type: 'string';
            description: 'The ID of the candidate to retrieve';
          };
          required: true;
        },
      ];
      requestBody: {
        content: {
          'application/json': {};
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/candidate';
              };
            };
          };
        };
      };
    };
  };
  '/v1/candidates': {
    get: {
      operationId: 'getCandidates';
      parameters: [
        {
          in: 'query';
          name: 'per_page';
          description: 'Return up to this number of objects per response. Must be an integer between 1 and 500. Defaults to 100.';
          schema: {
            type: 'number';
            minimum: 1;
            maximum: 500;
            description: 'Return up to this number of objects per response. Must be an integer between 1 and 500. Defaults to 100.';
            default: 100;
          };
        },
        {
          in: 'query';
          name: 'page';
          description: 'A cursor for use in pagination. Returns the n-th chunk of per_page objects.';
          schema: {
            type: 'number';
            description: 'A cursor for use in pagination. Returns the n-th chunk of per_page objects.';
          };
        },
        {
          in: 'query';
          name: 'external_id';
          description: 'If supplied, only return department(s) with that external ID.';
          schema: {
            type: 'string';
            description: 'If supplied, only return department(s) with that external ID.';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {};
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/candidate';
                };
              };
            };
          };
        };
      };
    };
  };
};
export const paths = {
  '/v1/departments/{id}': {
    get: {
      operationId: 'getDepartment',
      parameters: [
        {
          in: 'path',
          name: 'id',
          description: 'The ID of the department to retrieve',
          schema: {
            type: 'string',
            description: 'The ID of the department to retrieve',
          },
          required: true,
        },
        {
          in: 'query',
          name: 'render_as',
          description:
            "This parameter defines how to represent the list of departments. The default value is 'list’, which returns a flat list of departments. If this is set to 'tree’, departments are represented in a tree-like structure where they may include sub-departments as children.",
          schema: {
            type: ['string', 'null'],
            enum: ['list', 'tree'],
            default: 'list',
            description:
              "This parameter defines how to represent the list of departments. The default value is 'list’, which returns a flat list of departments. If this is set to 'tree’, departments are represented in a tree-like structure where they may include sub-departments as children.",
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {},
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/department',
              },
            },
          },
        },
      },
    },
  },
  '/v1/departments': {
    get: {
      operationId: 'getDepartments',
      parameters: [
        {
          in: 'query',
          name: 'render_as',
          description:
            "This parameter defines how to represent the list of departments. The default value is 'list’, which returns a flat list of departments. If this is set to 'tree’, departments are represented in a tree-like structure where they may include sub-departments as children.",
          schema: {
            type: ['string', 'null'],
            enum: ['list', 'tree'],
            default: 'list',
            description:
              "This parameter defines how to represent the list of departments. The default value is 'list’, which returns a flat list of departments. If this is set to 'tree’, departments are represented in a tree-like structure where they may include sub-departments as children.",
          },
        },
        {
          in: 'query',
          name: 'per_page',
          description:
            'Return up to this number of objects per response. Must be an integer between 1 and 500. Defaults to 100.',
          schema: {
            type: 'number',
            minimum: 1,
            maximum: 500,
            description:
              'Return up to this number of objects per response. Must be an integer between 1 and 500. Defaults to 100.',
            default: 100,
          },
        },
        {
          in: 'query',
          name: 'page',
          description: 'A cursor for use in pagination. Returns the n-th chunk of per_page objects.',
          schema: {
            type: 'number',
            description: 'A cursor for use in pagination. Returns the n-th chunk of per_page objects.',
          },
        },
        {
          in: 'query',
          name: 'external_id',
          description: 'If supplied, only return department(s) with that external ID.',
          schema: {
            type: 'string',
            description: 'If supplied, only return department(s) with that external ID.',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {},
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/department',
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/jobs/{id}': {
    get: {
      operationId: 'getJob',
      parameters: [
        {
          in: 'path',
          name: 'id',
          description: 'The ID of the job to retrieve',
          schema: {
            type: 'string',
            description: 'The ID of the job to retrieve',
          },
          required: true,
        },
      ],
      requestBody: {
        content: {
          'application/json': {},
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/job',
              },
            },
          },
        },
      },
    },
  },
  '/v1/jobs': {
    get: {
      operationId: 'getJobs',
      parameters: [
        {
          in: 'query',
          name: 'per_page',
          description:
            'Return up to this number of objects per response. Must be an integer between 1 and 500. Defaults to 100.',
          schema: {
            type: 'number',
            minimum: 1,
            maximum: 500,
            description:
              'Return up to this number of objects per response. Must be an integer between 1 and 500. Defaults to 100.',
            default: 100,
          },
        },
        {
          in: 'query',
          name: 'page',
          description: 'A cursor for use in pagination. Returns the n-th chunk of per_page objects.',
          schema: {
            type: 'number',
            description: 'A cursor for use in pagination. Returns the n-th chunk of per_page objects.',
          },
        },
        {
          in: 'query',
          name: 'external_id',
          description: 'If supplied, only return department(s) with that external ID.',
          schema: {
            type: 'string',
            description: 'If supplied, only return department(s) with that external ID.',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {},
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/job',
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/offers/{id}': {
    get: {
      operationId: 'getOffer',
      parameters: [
        {
          in: 'path',
          name: 'id',
          description: 'The ID of the offer to retrieve',
          schema: {
            type: 'string',
            description: 'The ID of the offer to retrieve',
          },
          required: true,
        },
      ],
      requestBody: {
        content: {
          'application/json': {},
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/offer',
              },
            },
          },
        },
      },
    },
  },
  '/v1/offers': {
    get: {
      operationId: 'getOffers',
      parameters: [
        {
          in: 'query',
          name: 'per_page',
          description:
            'Return up to this number of objects per response. Must be an integer between 1 and 500. Defaults to 100.',
          schema: {
            type: 'number',
            minimum: 1,
            maximum: 500,
            description:
              'Return up to this number of objects per response. Must be an integer between 1 and 500. Defaults to 100.',
            default: 100,
          },
        },
        {
          in: 'query',
          name: 'page',
          description: 'A cursor for use in pagination. Returns the n-th chunk of per_page objects.',
          schema: {
            type: 'number',
            description: 'A cursor for use in pagination. Returns the n-th chunk of per_page objects.',
          },
        },
        {
          in: 'query',
          name: 'external_id',
          description: 'If supplied, only return department(s) with that external ID.',
          schema: {
            type: 'string',
            description: 'If supplied, only return department(s) with that external ID.',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {},
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/offer',
                },
              },
            },
          },
        },
      },
    },
  },
  '/v1/candidates/{id}': {
    get: {
      operationId: 'getCandidate',
      parameters: [
        {
          in: 'path',
          name: 'id',
          description: 'The ID of the candidate to retrieve',
          schema: {
            type: 'string',
            description: 'The ID of the candidate to retrieve',
          },
          required: true,
        },
      ],
      requestBody: {
        content: {
          'application/json': {},
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/candidate',
              },
            },
          },
        },
      },
    },
  },
  '/v1/candidates': {
    get: {
      operationId: 'getCandidates',
      parameters: [
        {
          in: 'query',
          name: 'per_page',
          description:
            'Return up to this number of objects per response. Must be an integer between 1 and 500. Defaults to 100.',
          schema: {
            type: 'number',
            minimum: 1,
            maximum: 500,
            description:
              'Return up to this number of objects per response. Must be an integer between 1 and 500. Defaults to 100.',
            default: 100,
          },
        },
        {
          in: 'query',
          name: 'page',
          description: 'A cursor for use in pagination. Returns the n-th chunk of per_page objects.',
          schema: {
            type: 'number',
            description: 'A cursor for use in pagination. Returns the n-th chunk of per_page objects.',
          },
        },
        {
          in: 'query',
          name: 'external_id',
          description: 'If supplied, only return department(s) with that external ID.',
          schema: {
            type: 'string',
            description: 'If supplied, only return department(s) with that external ID.',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {},
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/candidate',
                },
              },
            },
          },
        },
      },
    },
  },
} as TPaths;
