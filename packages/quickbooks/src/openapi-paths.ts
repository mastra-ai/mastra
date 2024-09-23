// @ts-nocheck
export type TPaths = {
  '/account/{id}': {
    get: {
      operationId: 'getAccount';
      parameters: [
        {
          in: 'path';
          name: 'id';
          schema: {
            type: 'string';
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
                type: 'object';
                properties: {
                  Account: {
                    $ref: '#/components/schemas/Account';
                  };
                  time: {
                    type: 'string';
                    format: 'date-time';
                  };
                };
                required: ['Account', 'time'];
              };
            };
          };
        };
      };
    };
  };
  '/purchase/{id}': {
    get: {
      operationId: 'getPurchase';
      parameters: [
        {
          in: 'path';
          name: 'id';
          schema: {
            type: 'string';
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
                type: 'object';
                properties: {
                  Purchase: {
                    $ref: '#/components/schemas/Purchase';
                  };
                  time: {
                    type: 'string';
                    format: 'date-time';
                  };
                };
                required: ['Purchase', 'time'];
              };
            };
          };
        };
      };
    };
  };
  '/journalentry/{id}': {
    get: {
      operationId: 'getJournalEntry';
      parameters: [
        {
          in: 'path';
          name: 'id';
          schema: {
            type: 'string';
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
                type: 'object';
                properties: {
                  JournalEntry: {
                    $ref: '#/components/schemas/JournalEntry';
                  };
                  time: {
                    type: 'string';
                    format: 'date-time';
                  };
                };
                required: ['JournalEntry', 'time'];
              };
            };
          };
        };
      };
    };
  };
  '/invoice/{id}': {
    get: {
      operationId: 'getInvoice';
      parameters: [
        {
          in: 'path';
          name: 'id';
          schema: {
            type: 'string';
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
                type: 'object';
                properties: {
                  Invoice: {
                    $ref: '#/components/schemas/Invoice';
                  };
                  time: {
                    type: 'string';
                    format: 'date-time';
                  };
                };
                required: ['Invoice', 'time'];
              };
            };
          };
        };
      };
    };
  };
  '/payment/{id}': {
    get: {
      operationId: 'getPayment';
      parameters: [
        {
          in: 'path';
          name: 'id';
          schema: {
            type: 'string';
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
                type: 'object';
                properties: {
                  Payment: {
                    $ref: '#/components/schemas/Payment';
                  };
                  time: {
                    type: 'string';
                    format: 'date-time';
                  };
                };
                required: ['Payment', 'time'];
              };
            };
          };
        };
      };
    };
  };
  '/bill/{id}': {
    get: {
      operationId: 'getBill';
      parameters: [
        {
          in: 'path';
          name: 'id';
          schema: {
            type: 'string';
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
                type: 'object';
                properties: {
                  Bill: {};
                  time: {
                    type: 'string';
                    format: 'date-time';
                  };
                };
                required: ['time'];
              };
            };
          };
        };
      };
    };
  };
  '/billpayment/{id}': {
    get: {
      operationId: 'getBillPayment';
      parameters: [
        {
          in: 'path';
          name: 'id';
          schema: {
            type: 'string';
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
                type: 'object';
                properties: {
                  BillPayment: {};
                  time: {
                    type: 'string';
                    format: 'date-time';
                  };
                };
                required: ['time'];
              };
            };
          };
        };
      };
    };
  };
  '/creditmemo/{id}': {
    get: {
      operationId: 'getCreditMemo';
      parameters: [
        {
          in: 'path';
          name: 'id';
          schema: {
            type: 'string';
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
                type: 'object';
                properties: {
                  CreditMemo: {};
                  time: {
                    type: 'string';
                    format: 'date-time';
                  };
                };
                required: ['time'];
              };
            };
          };
        };
      };
    };
  };
  '/deposit/{id}': {
    get: {
      operationId: 'getDeposit';
      parameters: [
        {
          in: 'path';
          name: 'id';
          schema: {
            type: 'string';
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
                type: 'object';
                properties: {
                  Deposit: {
                    $ref: '#/components/schemas/Deposit';
                  };
                  time: {
                    type: 'string';
                    format: 'date-time';
                  };
                };
                required: ['Deposit', 'time'];
              };
            };
          };
        };
      };
    };
  };
  '/transfer/{id}': {
    get: {
      operationId: 'getTransfer';
      parameters: [
        {
          in: 'path';
          name: 'id';
          schema: {
            type: 'string';
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
                type: 'object';
                properties: {
                  Transfer: {};
                  time: {
                    type: 'string';
                    format: 'date-time';
                  };
                };
                required: ['time'];
              };
            };
          };
        };
      };
    };
  };
  '/vendor/{id}': {
    get: {
      operationId: 'getVendor';
      parameters: [
        {
          in: 'path';
          name: 'id';
          schema: {
            type: 'string';
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
                type: 'object';
                properties: {
                  Vendor: {
                    $ref: '#/components/schemas/Vendor';
                  };
                  time: {
                    type: 'string';
                    format: 'date-time';
                  };
                };
                required: ['Vendor', 'time'];
              };
            };
          };
        };
      };
    };
  };
  '/customer/{id}': {
    get: {
      operationId: 'getCustomer';
      parameters: [
        {
          in: 'path';
          name: 'id';
          schema: {
            type: 'string';
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
                type: 'object';
                properties: {
                  Customer: {};
                  time: {
                    type: 'string';
                    format: 'date-time';
                  };
                };
                required: ['time'];
              };
            };
          };
        };
      };
    };
  };
  '/item/{id}': {
    get: {
      operationId: 'getItem';
      parameters: [
        {
          in: 'path';
          name: 'id';
          schema: {
            type: 'string';
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
                type: 'object';
                properties: {
                  Item: {};
                  time: {
                    type: 'string';
                    format: 'date-time';
                  };
                };
                required: ['time'];
              };
            };
          };
        };
      };
    };
  };
  '/companyinfo/{id}': {
    get: {
      operationId: 'getCompanyInfo';
      parameters: [
        {
          in: 'path';
          name: 'id';
          schema: {
            type: 'string';
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
                type: 'object';
                properties: {
                  CompanyInfo: {
                    $ref: '#/components/schemas/CompanyInfo';
                  };
                  time: {
                    type: 'string';
                    format: 'date-time';
                  };
                };
                required: ['CompanyInfo', 'time'];
              };
            };
          };
        };
      };
    };
  };
  '/query': {
    get: {
      operationId: 'query';
      parameters: [
        {
          in: 'query';
          name: 'query';
          schema: {
            type: 'string';
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
                type: 'object';
                properties: {
                  QueryResponse: {
                    $ref: '#/components/schemas/QueryResponse';
                  };
                  time: {
                    type: 'string';
                  };
                };
                required: ['QueryResponse', 'time'];
              };
            };
          };
        };
      };
    };
  };
  '/preferences': {
    get: {
      operationId: 'getPreferences';
      requestBody: {
        content: {
          'application/json': {};
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {};
            };
          };
        };
      };
    };
  };
  '/reports/TransactionList': {
    get: {
      operationId: 'getTransactionList';
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
                $ref: '#/components/schemas/Report';
              };
            };
          };
        };
      };
    };
  };
  '/cdc': {
    get: {
      operationId: 'cdc';
      parameters: [
        {
          in: 'query';
          name: 'changedSince';
          schema: {
            type: 'string';
          };
          required: true;
        },
        {
          in: 'query';
          name: 'entities';
          schema: {
            type: 'string';
            description: 'Comma separated list of entity names';
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
                $ref: '#/components/schemas/CDCPayload';
              };
            };
          };
        };
      };
    };
  };
};
export const paths = {
  '/account/{id}': {
    get: {
      operationId: 'getAccount',
      parameters: [
        {
          in: 'path',
          name: 'id',
          schema: {
            type: 'string',
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
                type: 'object',
                properties: {
                  Account: {
                    $ref: '#/components/schemas/Account',
                  },
                  time: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
                required: ['Account', 'time'],
              },
            },
          },
        },
      },
    },
  },
  '/purchase/{id}': {
    get: {
      operationId: 'getPurchase',
      parameters: [
        {
          in: 'path',
          name: 'id',
          schema: {
            type: 'string',
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
                type: 'object',
                properties: {
                  Purchase: {
                    $ref: '#/components/schemas/Purchase',
                  },
                  time: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
                required: ['Purchase', 'time'],
              },
            },
          },
        },
      },
    },
  },
  '/journalentry/{id}': {
    get: {
      operationId: 'getJournalEntry',
      parameters: [
        {
          in: 'path',
          name: 'id',
          schema: {
            type: 'string',
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
                type: 'object',
                properties: {
                  JournalEntry: {
                    $ref: '#/components/schemas/JournalEntry',
                  },
                  time: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
                required: ['JournalEntry', 'time'],
              },
            },
          },
        },
      },
    },
  },
  '/invoice/{id}': {
    get: {
      operationId: 'getInvoice',
      parameters: [
        {
          in: 'path',
          name: 'id',
          schema: {
            type: 'string',
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
                type: 'object',
                properties: {
                  Invoice: {
                    $ref: '#/components/schemas/Invoice',
                  },
                  time: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
                required: ['Invoice', 'time'],
              },
            },
          },
        },
      },
    },
  },
  '/payment/{id}': {
    get: {
      operationId: 'getPayment',
      parameters: [
        {
          in: 'path',
          name: 'id',
          schema: {
            type: 'string',
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
                type: 'object',
                properties: {
                  Payment: {
                    $ref: '#/components/schemas/Payment',
                  },
                  time: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
                required: ['Payment', 'time'],
              },
            },
          },
        },
      },
    },
  },
  '/bill/{id}': {
    get: {
      operationId: 'getBill',
      parameters: [
        {
          in: 'path',
          name: 'id',
          schema: {
            type: 'string',
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
                type: 'object',
                properties: {
                  Bill: {},
                  time: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
                required: ['time'],
              },
            },
          },
        },
      },
    },
  },
  '/billpayment/{id}': {
    get: {
      operationId: 'getBillPayment',
      parameters: [
        {
          in: 'path',
          name: 'id',
          schema: {
            type: 'string',
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
                type: 'object',
                properties: {
                  BillPayment: {},
                  time: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
                required: ['time'],
              },
            },
          },
        },
      },
    },
  },
  '/creditmemo/{id}': {
    get: {
      operationId: 'getCreditMemo',
      parameters: [
        {
          in: 'path',
          name: 'id',
          schema: {
            type: 'string',
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
                type: 'object',
                properties: {
                  CreditMemo: {},
                  time: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
                required: ['time'],
              },
            },
          },
        },
      },
    },
  },
  '/deposit/{id}': {
    get: {
      operationId: 'getDeposit',
      parameters: [
        {
          in: 'path',
          name: 'id',
          schema: {
            type: 'string',
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
                type: 'object',
                properties: {
                  Deposit: {
                    $ref: '#/components/schemas/Deposit',
                  },
                  time: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
                required: ['Deposit', 'time'],
              },
            },
          },
        },
      },
    },
  },
  '/transfer/{id}': {
    get: {
      operationId: 'getTransfer',
      parameters: [
        {
          in: 'path',
          name: 'id',
          schema: {
            type: 'string',
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
                type: 'object',
                properties: {
                  Transfer: {},
                  time: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
                required: ['time'],
              },
            },
          },
        },
      },
    },
  },
  '/vendor/{id}': {
    get: {
      operationId: 'getVendor',
      parameters: [
        {
          in: 'path',
          name: 'id',
          schema: {
            type: 'string',
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
                type: 'object',
                properties: {
                  Vendor: {
                    $ref: '#/components/schemas/Vendor',
                  },
                  time: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
                required: ['Vendor', 'time'],
              },
            },
          },
        },
      },
    },
  },
  '/customer/{id}': {
    get: {
      operationId: 'getCustomer',
      parameters: [
        {
          in: 'path',
          name: 'id',
          schema: {
            type: 'string',
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
                type: 'object',
                properties: {
                  Customer: {},
                  time: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
                required: ['time'],
              },
            },
          },
        },
      },
    },
  },
  '/item/{id}': {
    get: {
      operationId: 'getItem',
      parameters: [
        {
          in: 'path',
          name: 'id',
          schema: {
            type: 'string',
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
                type: 'object',
                properties: {
                  Item: {},
                  time: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
                required: ['time'],
              },
            },
          },
        },
      },
    },
  },
  '/companyinfo/{id}': {
    get: {
      operationId: 'getCompanyInfo',
      parameters: [
        {
          in: 'path',
          name: 'id',
          schema: {
            type: 'string',
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
                type: 'object',
                properties: {
                  CompanyInfo: {
                    $ref: '#/components/schemas/CompanyInfo',
                  },
                  time: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
                required: ['CompanyInfo', 'time'],
              },
            },
          },
        },
      },
    },
  },
  '/query': {
    get: {
      operationId: 'query',
      parameters: [
        {
          in: 'query',
          name: 'query',
          schema: {
            type: 'string',
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
                type: 'object',
                properties: {
                  QueryResponse: {
                    $ref: '#/components/schemas/QueryResponse',
                  },
                  time: {
                    type: 'string',
                  },
                },
                required: ['QueryResponse', 'time'],
              },
            },
          },
        },
      },
    },
  },
  '/preferences': {
    get: {
      operationId: 'getPreferences',
      requestBody: {
        content: {
          'application/json': {},
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {},
            },
          },
        },
      },
    },
  },
  '/reports/TransactionList': {
    get: {
      operationId: 'getTransactionList',
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
                $ref: '#/components/schemas/Report',
              },
            },
          },
        },
      },
    },
  },
  '/cdc': {
    get: {
      operationId: 'cdc',
      parameters: [
        {
          in: 'query',
          name: 'changedSince',
          schema: {
            type: 'string',
          },
          required: true,
        },
        {
          in: 'query',
          name: 'entities',
          schema: {
            type: 'string',
            description: 'Comma separated list of entity names',
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
                $ref: '#/components/schemas/CDCPayload',
              },
            },
          },
        },
      },
    },
  },
} as TPaths;
