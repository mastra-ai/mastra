export const sequentialStepGraph = {
  initial: [
    {
      step: {
        id: 'stepOne',
        description: 'Doubles the input value',
        inputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
        outputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
      },
      config: {
        data: {
          inputValue: {
            step: 'trigger',
            path: 'firstValue',
          },
        },
        variables: {
          inputValue: {
            step: 'trigger',
            path: 'firstValue',
          },
        },
      },
    },
  ],
  stepOne: [
    {
      step: {
        id: 'stepTwo',
        description: 'Adds 1 to the input value',
        inputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
        outputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
      },
      config: {
        data: {
          valueToIncrement: {
            step: {
              id: 'stepOne',
              description: 'Doubles the input value',
              inputSchema: {
                _def: {
                  unknownKeys: 'strip',
                  catchall: {
                    _def: {
                      typeName: 'ZodNever',
                    },
                    '~standard': {
                      version: 1,
                      vendor: 'zod',
                    },
                  },
                  typeName: 'ZodObject',
                },
                '~standard': {
                  version: 1,
                  vendor: 'zod',
                },
                _cached: null,
              },
              outputSchema: {
                _def: {
                  unknownKeys: 'strip',
                  catchall: {
                    _def: {
                      typeName: 'ZodNever',
                    },
                    '~standard': {
                      version: 1,
                      vendor: 'zod',
                    },
                  },
                  typeName: 'ZodObject',
                },
                '~standard': {
                  version: 1,
                  vendor: 'zod',
                },
                _cached: null,
              },
            },
            path: 'doubledValue',
          },
        },
        variables: {
          valueToIncrement: {
            step: {
              id: 'stepOne',
              description: 'Doubles the input value',
              inputSchema: {
                _def: {
                  unknownKeys: 'strip',
                  catchall: {
                    _def: {
                      typeName: 'ZodNever',
                    },
                    '~standard': {
                      version: 1,
                      vendor: 'zod',
                    },
                  },
                  typeName: 'ZodObject',
                },
                '~standard': {
                  version: 1,
                  vendor: 'zod',
                },
                _cached: null,
              },
              outputSchema: {
                _def: {
                  unknownKeys: 'strip',
                  catchall: {
                    _def: {
                      typeName: 'ZodNever',
                    },
                    '~standard': {
                      version: 1,
                      vendor: 'zod',
                    },
                  },
                  typeName: 'ZodObject',
                },
                '~standard': {
                  version: 1,
                  vendor: 'zod',
                },
                _cached: null,
              },
            },
            path: 'doubledValue',
          },
        },
      },
    },
    {
      step: {
        id: 'stepThree',
        description: 'Squares the input value',
        inputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
        outputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
      },
      config: {
        data: {},
      },
    },
    {
      step: {
        id: 'stepFour',
        description: 'Gives the square root of the input value',
        inputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
        outputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
      },
      config: {
        data: {},
      },
    },
    {
      step: {
        id: 'stepFive',
        description: 'Triples the input value',
        inputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
        outputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
      },
      config: {
        data: {},
      },
    },
  ],
};

export const parallelStepGraph = {
  initial: [
    {
      step: {
        id: 'stepOne',
        description: 'Doubles the input value',
        inputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
        outputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
      },
      config: {
        data: {},
      },
    },
    {
      step: {
        id: 'stepTwo',
        description: 'Adds 1 to the input value',
        inputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
        outputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
      },
      config: {
        data: {},
      },
    },
    {
      step: {
        id: 'stepThree',
        description: 'Squares the input value',
        inputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
        outputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
      },
      config: {
        data: {},
      },
    },
  ],
  stepOne: [],
  stepTwo: [],
  stepThree: [],
};

export const branchedStepGraph = {
  initial: [
    {
      step: {
        id: 'stepOne',
        description: 'Doubles the input value',
        inputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
        outputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
      },
      config: {
        data: {},
      },
    },
  ],
  stepOne: [
    {
      step: {
        id: 'stepTwo',
        description: 'Adds 1 to the input value',
        inputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
        outputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
      },
      config: {
        data: {},
      },
    },
    {
      step: {
        id: 'stepFour',
        description: 'Gives the square root of the input value',
        inputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
        outputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
      },
      config: {
        data: {},
      },
    },
  ],
};

export const branchedSubscriberGraph = {
  stepOne: {
    initial: [
      {
        step: {
          id: 'stepThree',
          description: 'Squares the input value',
          inputSchema: {
            _def: {
              unknownKeys: 'strip',
              catchall: {
                _def: {
                  typeName: 'ZodNever',
                },
                '~standard': {
                  version: 1,
                  vendor: 'zod',
                },
              },
              typeName: 'ZodObject',
            },
            '~standard': {
              version: 1,
              vendor: 'zod',
            },
            _cached: null,
          },
          outputSchema: {
            _def: {
              unknownKeys: 'strip',
              catchall: {
                _def: {
                  typeName: 'ZodNever',
                },
                '~standard': {
                  version: 1,
                  vendor: 'zod',
                },
              },
              typeName: 'ZodObject',
            },
            '~standard': {
              version: 1,
              vendor: 'zod',
            },
            _cached: null,
          },
        },
        config: {
          data: {},
        },
      },
    ],
    stepThree: [
      {
        step: {
          id: 'stepFive',
          description: 'Triples the input value',
          inputSchema: {
            _def: {
              unknownKeys: 'strip',
              catchall: {
                _def: {
                  typeName: 'ZodNever',
                },
                '~standard': {
                  version: 1,
                  vendor: 'zod',
                },
              },
              typeName: 'ZodObject',
            },
            '~standard': {
              version: 1,
              vendor: 'zod',
            },
            _cached: null,
          },
          outputSchema: {
            _def: {
              unknownKeys: 'strip',
              catchall: {
                _def: {
                  typeName: 'ZodNever',
                },
                '~standard': {
                  version: 1,
                  vendor: 'zod',
                },
              },
              typeName: 'ZodObject',
            },
            '~standard': {
              version: 1,
              vendor: 'zod',
            },
            _cached: null,
          },
        },
        config: {
          data: {},
        },
      },
    ],
  },
};

export const cyclicalStepGraph = {
  initial: [
    {
      step: {
        id: 'stepOne',
        description: 'Doubles the input value',
        inputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
        outputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
      },
      config: {
        data: {},
      },
    },
  ],
  stepOne: [
    {
      step: {
        id: 'stepTwo',
        description: 'Adds 1 to the input value',
        inputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
        outputSchema: {
          _def: {
            unknownKeys: 'strip',
            catchall: {
              _def: {
                typeName: 'ZodNever',
              },
              '~standard': {
                version: 1,
                vendor: 'zod',
              },
            },
            typeName: 'ZodObject',
          },
          '~standard': {
            version: 1,
            vendor: 'zod',
          },
          _cached: null,
        },
      },
      config: {
        data: {},
      },
    },
  ],
};

export const cyclicalSubscriberGraph = {
  stepOne: {
    initial: [
      {
        step: {
          id: 'stepThree',
          description: 'Squares the input value',
          inputSchema: {
            _def: {
              unknownKeys: 'strip',
              catchall: {
                _def: {
                  typeName: 'ZodNever',
                },
                '~standard': {
                  version: 1,
                  vendor: 'zod',
                },
              },
              typeName: 'ZodObject',
            },
            '~standard': {
              version: 1,
              vendor: 'zod',
            },
            _cached: null,
          },
          outputSchema: {
            _def: {
              unknownKeys: 'strip',
              catchall: {
                _def: {
                  typeName: 'ZodNever',
                },
                '~standard': {
                  version: 1,
                  vendor: 'zod',
                },
              },
              typeName: 'ZodObject',
            },
            '~standard': {
              version: 1,
              vendor: 'zod',
            },
            _cached: null,
          },
        },
        config: {
          data: {},
          when: {
            ref: {
              step: {
                id: 'stepOne',
                description: 'Doubles the input value',
                inputSchema: {
                  _def: {
                    unknownKeys: 'strip',
                    catchall: {
                      _def: {
                        typeName: 'ZodNever',
                      },
                      '~standard': {
                        version: 1,
                        vendor: 'zod',
                      },
                    },
                    typeName: 'ZodObject',
                  },
                  '~standard': {
                    version: 1,
                    vendor: 'zod',
                  },
                  _cached: null,
                },
                outputSchema: {
                  _def: {
                    unknownKeys: 'strip',
                    catchall: {
                      _def: {
                        typeName: 'ZodNever',
                      },
                      '~standard': {
                        version: 1,
                        vendor: 'zod',
                      },
                    },
                    typeName: 'ZodObject',
                  },
                  '~standard': {
                    version: 1,
                    vendor: 'zod',
                  },
                  _cached: null,
                },
              },
              path: 'doubledValue',
            },
            query: {
              $eq: 10,
            },
          },
        },
      },
      {
        step: {
          id: 'stepOne',
          description: 'Doubles the input value',
          inputSchema: {
            _def: {
              unknownKeys: 'strip',
              catchall: {
                _def: {
                  typeName: 'ZodNever',
                },
                '~standard': {
                  version: 1,
                  vendor: 'zod',
                },
              },
              typeName: 'ZodObject',
            },
            '~standard': {
              version: 1,
              vendor: 'zod',
            },
            _cached: null,
          },
          outputSchema: {
            _def: {
              unknownKeys: 'strip',
              catchall: {
                _def: {
                  typeName: 'ZodNever',
                },
                '~standard': {
                  version: 1,
                  vendor: 'zod',
                },
              },
              typeName: 'ZodObject',
            },
            '~standard': {
              version: 1,
              vendor: 'zod',
            },
            _cached: null,
          },
        },
        config: {
          data: {},
          when: {
            ref: {
              step: {
                id: 'stepOne',
                description: 'Doubles the input value',
                inputSchema: {
                  _def: {
                    unknownKeys: 'strip',
                    catchall: {
                      _def: {
                        typeName: 'ZodNever',
                      },
                      '~standard': {
                        version: 1,
                        vendor: 'zod',
                      },
                    },
                    typeName: 'ZodObject',
                  },
                  '~standard': {
                    version: 1,
                    vendor: 'zod',
                  },
                  _cached: null,
                },
                outputSchema: {
                  _def: {
                    unknownKeys: 'strip',
                    catchall: {
                      _def: {
                        typeName: 'ZodNever',
                      },
                      '~standard': {
                        version: 1,
                        vendor: 'zod',
                      },
                    },
                    typeName: 'ZodObject',
                  },
                  '~standard': {
                    version: 1,
                    vendor: 'zod',
                  },
                  _cached: null,
                },
              },
              path: 'doubledValue',
            },
            query: {
              $eq: 12,
            },
            and: [
              {
                ref: {
                  step: {
                    id: 'stepOne',
                    description: 'Doubles the input value',
                    inputSchema: {
                      _def: {
                        unknownKeys: 'strip',
                        catchall: {
                          _def: {
                            typeName: 'ZodNever',
                          },
                          '~standard': {
                            version: 1,
                            vendor: 'zod',
                          },
                        },
                        typeName: 'ZodObject',
                      },
                      '~standard': {
                        version: 1,
                        vendor: 'zod',
                      },
                      _cached: null,
                    },
                    outputSchema: {
                      _def: {
                        unknownKeys: 'strip',
                        catchall: {
                          _def: {
                            typeName: 'ZodNever',
                          },
                          '~standard': {
                            version: 1,
                            vendor: 'zod',
                          },
                        },
                        typeName: 'ZodObject',
                      },
                      '~standard': {
                        version: 1,
                        vendor: 'zod',
                      },
                      _cached: null,
                    },
                  },
                  path: 'doubledValue',
                },
                query: {
                  $eq: 10,
                },
              },
            ],
            or: [
              {
                ref: {
                  step: {
                    id: 'stepOne',
                    description: 'Doubles the input value',
                    inputSchema: {
                      _def: {
                        unknownKeys: 'strip',
                        catchall: {
                          _def: {
                            typeName: 'ZodNever',
                          },
                          '~standard': {
                            version: 1,
                            vendor: 'zod',
                          },
                        },
                        typeName: 'ZodObject',
                      },
                      '~standard': {
                        version: 1,
                        vendor: 'zod',
                      },
                      _cached: null,
                    },
                    outputSchema: {
                      _def: {
                        unknownKeys: 'strip',
                        catchall: {
                          _def: {
                            typeName: 'ZodNever',
                          },
                          '~standard': {
                            version: 1,
                            vendor: 'zod',
                          },
                        },
                        typeName: 'ZodObject',
                      },
                      '~standard': {
                        version: 1,
                        vendor: 'zod',
                      },
                      _cached: null,
                    },
                  },
                  path: 'doubledValue',
                },
                query: {
                  $eq: 11,
                },
              },
            ],
          },
        },
      },
    ],
    stepThree: [],
    stepOne: [],
  },
};
