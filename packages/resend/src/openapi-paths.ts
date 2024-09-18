// @ts-nocheck
export type TPaths = {
  '/emails': {
    post: {
      tags: ['Emails'];
      summary: 'Send an email';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/SendEmailRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SendEmailResponse';
              };
            };
          };
        };
      };
    };
  };
  '/emails/{email_id}': {
    get: {
      tags: ['Emails'];
      summary: 'Retrieve a single email';
      parameters: [
        {
          name: 'email_id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The ID of the email.';
          };
        },
      ];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Email';
              };
            };
          };
        };
      };
    };
    patch: {
      tags: ['Emails'];
      summary: 'Update a single email';
      parameters: [
        {
          name: 'email_id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The ID of the email.';
          };
        },
      ];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateEmailOptions';
              };
            };
          };
        };
      };
    };
  };
  '/emails/{email_id}/cancel': {
    post: {
      tags: ['Emails'];
      summary: 'Cancel the schedule of the e-mail.';
      parameters: [
        {
          name: 'email_id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The ID of the email.';
          };
        },
      ];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Email';
              };
            };
          };
        };
      };
    };
  };
  '/emails/batch': {
    post: {
      tags: ['Emails'];
      summary: 'Trigger up to 100 batch emails at once.';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/SendEmailRequest';
              };
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateBatchEmailsResponse';
              };
            };
          };
        };
      };
    };
  };
  '/domains': {
    post: {
      tags: ['Domains'];
      summary: 'Create a new domain';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateDomainRequest';
            };
          };
        };
      };
      responses: {
        '201': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateDomainResponse';
              };
            };
          };
        };
      };
    };
    get: {
      tags: ['Domains'];
      summary: 'Retrieve a list of domains';
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListDomainsResponse';
              };
            };
          };
        };
      };
    };
  };
  '/domains/{domain_id}': {
    get: {
      tags: ['Domains'];
      summary: 'Retrieve a single domain';
      parameters: [
        {
          name: 'domain_id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The ID of the domain.';
          };
        },
      ];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Domain';
              };
            };
          };
        };
      };
    };
    patch: {
      tags: ['Domains'];
      summary: 'Update an existing domain';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdateDomainOptions';
            };
          };
        };
      };
      parameters: [
        {
          name: 'domain_id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The ID of the domain.';
          };
        },
      ];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateDomainResponseSuccess';
              };
            };
          };
        };
      };
    };
    delete: {
      tags: ['Domains'];
      summary: 'Remove an existing domain';
      parameters: [
        {
          name: 'domain_id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The ID of the domain.';
          };
        },
      ];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeleteDomainResponse';
              };
            };
          };
        };
      };
    };
  };
  '/domains/{domain_id}/verify': {
    post: {
      tags: ['Domains'];
      summary: 'Verify an existing domain';
      parameters: [
        {
          name: 'domain_id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The ID of the domain.';
          };
        },
      ];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/VerifyDomainResponse';
              };
            };
          };
        };
      };
    };
  };
  '/api-keys': {
    post: {
      tags: ['API Keys'];
      summary: 'Create a new API key';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateApiKeyRequest';
            };
          };
        };
      };
      responses: {
        '201': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateApiKeyResponse';
              };
            };
          };
        };
      };
    };
    get: {
      tags: ['API Keys'];
      summary: 'Retrieve a list of API keys';
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListApiKeysResponse';
              };
            };
          };
        };
      };
    };
  };
  '/api-keys/{api_key_id}': {
    delete: {
      tags: ['API Keys'];
      summary: 'Remove an existing API key';
      parameters: [
        {
          name: 'api_key_id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The API key ID.';
          };
        },
      ];
      responses: {
        '200': {
          description: 'OK';
        };
      };
    };
  };
  '/audiences': {
    post: {
      tags: ['Audiences'];
      summary: 'Create a list of contacts';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateAudienceOptions';
            };
          };
        };
      };
      responses: {
        '201': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateAudienceResponseSuccess';
              };
            };
          };
        };
      };
    };
    get: {
      tags: ['Audiences'];
      summary: 'Retrieve a list of audiences';
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListAudiencesResponseSuccess';
              };
            };
          };
        };
      };
    };
  };
  '/audiences/{id}': {
    delete: {
      tags: ['Audiences'];
      summary: 'Remove an existing audience';
      parameters: [
        {
          name: 'id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The Audience ID.';
          };
        },
      ];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RemoveAudienceResponseSuccess';
              };
            };
          };
        };
      };
    };
    get: {
      tags: ['Audiences'];
      summary: 'Retrieve a single audience';
      parameters: [
        {
          name: 'id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The Audience ID.';
          };
        },
      ];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GetAudienceResponseSuccess';
              };
            };
          };
        };
      };
    };
  };
  '/audiences/{audience_id}/contacts': {
    post: {
      tags: ['Contacts'];
      summary: 'Create a new contact';
      parameters: [
        {
          name: 'audience_id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The Audience ID.';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateContactOptions';
            };
          };
        };
      };
      responses: {
        '201': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateContactResponseSuccess';
              };
            };
          };
        };
      };
    };
    get: {
      tags: ['Contacts'];
      summary: 'Retrieve a list of contacts';
      parameters: [
        {
          name: 'audience_id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The Audience ID.';
          };
        },
      ];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListContactsResponseSuccess';
              };
            };
          };
        };
      };
    };
  };
  '/audiences/{audience_id}/contacts/{email}': {
    delete: {
      tags: ['Contacts'];
      summary: 'Remove an existing contact by email';
      parameters: [
        {
          name: 'email';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The Contact ID.';
          };
        },
        {
          name: 'audience_id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The Audience ID.';
          };
        },
      ];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RemoveContactResponseSuccess';
              };
            };
          };
        };
      };
    };
  };
  '/audiences/{audience_id}/contacts/{id}': {
    delete: {
      tags: ['Contacts'];
      summary: 'Remove an existing contact by id';
      parameters: [
        {
          name: 'id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The Contact ID.';
          };
        },
        {
          name: 'audience_id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The Audience ID.';
          };
        },
      ];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RemoveContactResponseSuccess';
              };
            };
          };
        };
      };
    };
    get: {
      tags: ['Contacts'];
      summary: 'Retrieve a single contact';
      parameters: [
        {
          name: 'id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The Contact ID.';
          };
        },
        {
          name: 'audience_id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The Audience ID.';
          };
        },
      ];
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GetContactResponseSuccess';
              };
            };
          };
        };
      };
    };
    patch: {
      tags: ['Contacts'];
      summary: 'Update a single contact';
      parameters: [
        {
          name: 'id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The Contact ID.';
          };
        },
        {
          name: 'audience_id';
          in: 'path';
          required: true;
          schema: {
            type: 'string';
            description: 'The Audience ID.';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdateContactOptions';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'OK';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateContactResponseSuccess';
              };
            };
          };
        };
      };
    };
  };
};
export const paths = {
  '/emails': {
    post: {
      tags: ['Emails'],
      summary: 'Send an email',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/SendEmailRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SendEmailResponse',
              },
            },
          },
        },
      },
    },
  },
  '/emails/{email_id}': {
    get: {
      tags: ['Emails'],
      summary: 'Retrieve a single email',
      parameters: [
        {
          name: 'email_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The ID of the email.',
          },
        },
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Email',
              },
            },
          },
        },
      },
    },
    patch: {
      tags: ['Emails'],
      summary: 'Update a single email',
      parameters: [
        {
          name: 'email_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The ID of the email.',
          },
        },
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateEmailOptions',
              },
            },
          },
        },
      },
    },
  },
  '/emails/{email_id}/cancel': {
    post: {
      tags: ['Emails'],
      summary: 'Cancel the schedule of the e-mail.',
      parameters: [
        {
          name: 'email_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The ID of the email.',
          },
        },
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Email',
              },
            },
          },
        },
      },
    },
  },
  '/emails/batch': {
    post: {
      tags: ['Emails'],
      summary: 'Trigger up to 100 batch emails at once.',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/SendEmailRequest',
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateBatchEmailsResponse',
              },
            },
          },
        },
      },
    },
  },
  '/domains': {
    post: {
      tags: ['Domains'],
      summary: 'Create a new domain',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateDomainRequest',
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateDomainResponse',
              },
            },
          },
        },
      },
    },
    get: {
      tags: ['Domains'],
      summary: 'Retrieve a list of domains',
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListDomainsResponse',
              },
            },
          },
        },
      },
    },
  },
  '/domains/{domain_id}': {
    get: {
      tags: ['Domains'],
      summary: 'Retrieve a single domain',
      parameters: [
        {
          name: 'domain_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The ID of the domain.',
          },
        },
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Domain',
              },
            },
          },
        },
      },
    },
    patch: {
      tags: ['Domains'],
      summary: 'Update an existing domain',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdateDomainOptions',
            },
          },
        },
      },
      parameters: [
        {
          name: 'domain_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The ID of the domain.',
          },
        },
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateDomainResponseSuccess',
              },
            },
          },
        },
      },
    },
    delete: {
      tags: ['Domains'],
      summary: 'Remove an existing domain',
      parameters: [
        {
          name: 'domain_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The ID of the domain.',
          },
        },
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeleteDomainResponse',
              },
            },
          },
        },
      },
    },
  },
  '/domains/{domain_id}/verify': {
    post: {
      tags: ['Domains'],
      summary: 'Verify an existing domain',
      parameters: [
        {
          name: 'domain_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The ID of the domain.',
          },
        },
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/VerifyDomainResponse',
              },
            },
          },
        },
      },
    },
  },
  '/api-keys': {
    post: {
      tags: ['API Keys'],
      summary: 'Create a new API key',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateApiKeyRequest',
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateApiKeyResponse',
              },
            },
          },
        },
      },
    },
    get: {
      tags: ['API Keys'],
      summary: 'Retrieve a list of API keys',
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListApiKeysResponse',
              },
            },
          },
        },
      },
    },
  },
  '/api-keys/{api_key_id}': {
    delete: {
      tags: ['API Keys'],
      summary: 'Remove an existing API key',
      parameters: [
        {
          name: 'api_key_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The API key ID.',
          },
        },
      ],
      responses: {
        '200': {
          description: 'OK',
        },
      },
    },
  },
  '/audiences': {
    post: {
      tags: ['Audiences'],
      summary: 'Create a list of contacts',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateAudienceOptions',
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateAudienceResponseSuccess',
              },
            },
          },
        },
      },
    },
    get: {
      tags: ['Audiences'],
      summary: 'Retrieve a list of audiences',
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListAudiencesResponseSuccess',
              },
            },
          },
        },
      },
    },
  },
  '/audiences/{id}': {
    delete: {
      tags: ['Audiences'],
      summary: 'Remove an existing audience',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The Audience ID.',
          },
        },
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RemoveAudienceResponseSuccess',
              },
            },
          },
        },
      },
    },
    get: {
      tags: ['Audiences'],
      summary: 'Retrieve a single audience',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The Audience ID.',
          },
        },
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GetAudienceResponseSuccess',
              },
            },
          },
        },
      },
    },
  },
  '/audiences/{audience_id}/contacts': {
    post: {
      tags: ['Contacts'],
      summary: 'Create a new contact',
      parameters: [
        {
          name: 'audience_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The Audience ID.',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreateContactOptions',
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateContactResponseSuccess',
              },
            },
          },
        },
      },
    },
    get: {
      tags: ['Contacts'],
      summary: 'Retrieve a list of contacts',
      parameters: [
        {
          name: 'audience_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The Audience ID.',
          },
        },
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListContactsResponseSuccess',
              },
            },
          },
        },
      },
    },
  },
  '/audiences/{audience_id}/contacts/{email}': {
    delete: {
      tags: ['Contacts'],
      summary: 'Remove an existing contact by email',
      parameters: [
        {
          name: 'email',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The Contact ID.',
          },
        },
        {
          name: 'audience_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The Audience ID.',
          },
        },
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RemoveContactResponseSuccess',
              },
            },
          },
        },
      },
    },
  },
  '/audiences/{audience_id}/contacts/{id}': {
    delete: {
      tags: ['Contacts'],
      summary: 'Remove an existing contact by id',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The Contact ID.',
          },
        },
        {
          name: 'audience_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The Audience ID.',
          },
        },
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RemoveContactResponseSuccess',
              },
            },
          },
        },
      },
    },
    get: {
      tags: ['Contacts'],
      summary: 'Retrieve a single contact',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The Contact ID.',
          },
        },
        {
          name: 'audience_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The Audience ID.',
          },
        },
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GetContactResponseSuccess',
              },
            },
          },
        },
      },
    },
    patch: {
      tags: ['Contacts'],
      summary: 'Update a single contact',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The Contact ID.',
          },
        },
        {
          name: 'audience_id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            description: 'The Audience ID.',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdateContactOptions',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateContactResponseSuccess',
              },
            },
          },
        },
      },
    },
  },
} as TPaths;
