import { z } from 'zod';

import {
  evaluateCondition,
  replacePayloadVariables,
  resolveCondition,
  resolvePath,
  resolvePayload,
  resolveSchemaPath,
} from '../src/workflows/runner';
import { FilterOpToValueMapEnum } from '../src/workflows/conditions/constants';
import { AutomationBlueprint } from '../src/workflows/types';
import { IntegrationAction, IntegrationEvent } from '../src/types';
import { CORE_PLUGIN_NAME, createFramework } from '../src';
import { createMockAction, createMockEvent, MockPlugin } from './utils';

describe('replacePayloadVariables', () => {
  it('Replaces variables in payload', () => {
    expect(
      replacePayloadVariables({
        stringContainingVariables: `Hello {{name}}`,
        variable: `name`,
        value: `Dayo`,
      })
    ).toBe(`Hello Dayo`);
  });

  it('Replaces array variables in payload', () => {
    expect(
      replacePayloadVariables({
        stringContainingVariables: [`Hello {{name}}`, `Goodbye {{name}}`],
        variable: `name`,
        value: `Dayo`,
      })
    ).toEqual([`Hello Dayo`, `Goodbye Dayo`]);
  });
});

describe(`resolvePayload`, () => {
  it(`resolvePath`, () => {
    expect(
      resolvePath({
        path: `data.name`,
        replacementDataPayload: {
          data: {
            name: `dayo`,
          },
        },
      })
    ).toBe(`dayo`);
  });

  it(`should resolve payload`, () => {
    expect(
      resolvePayload({
        payload: {
          title: `Hello {{name}}`,
        },
        dataContext: {
          [`1`]: { name: `Dayo` },
        },
        variables: {
          title: {
            name: {
              path: `name`,
              refBlockId: `1`,
            },
          },
        },
      })
    ).toEqual({ title: `Hello Dayo` });
  });
});

describe(`resolveSchemaPath/resolveCondition`, () => {
  it(`resolveCondition - Optional field`, () => {
    expect(
      resolveCondition({
        c: {
          field: 'data.name',
          operator: FilterOpToValueMapEnum.EQUAL,
          value: `Dayo`,
        },
        dataCtx: {
          [`1`]: { data: { name: `Dayo` } },
        },
        schema: z.string().optional() as z.ZodSchema<unknown>,
        triggerId: `1`,
      })
    ).toBeTruthy();

    expect(
      resolveCondition({
        c: {
          field: 'data.name',
          operator: FilterOpToValueMapEnum.EQUAL,
          value: `Dayo`,
        },
        dataCtx: {
          [`1`]: { data: { name: `Dayo` } },
        },
        schema: z.number().optional() as z.ZodSchema<unknown>,
        triggerId: `1`,
      })
    ).toBeFalsy();
  });

  it(`should resolve schema path and resolve condition`, () => {
    const targetSchema = resolveSchemaPath({
      schema: z.object({
        name: z.string(),
      }),
      currentPath: '',
      finalMap: {},
      targetPath: 'name',
    });

    expect((targetSchema?._def as any).typeName).toBe(`ZodString`);

    expect(
      resolveCondition({
        c: {
          field: 'data.name',
          operator: FilterOpToValueMapEnum.EQUAL,
          value: `Day`,
        },
        dataCtx: {
          [`1`]: { data: { name: `Dayo` } },
        },
        schema: targetSchema as z.ZodSchema<unknown>,
        triggerId: `1`,
      })
    ).toBeFalsy();

    expect(
      resolveCondition({
        c: {
          field: 'data.name',
          operator: FilterOpToValueMapEnum.EQUAL,
          value: `Dayo`,
        },
        dataCtx: {
          [`1`]: { data: { name: `Dayo` } },
        },
        schema: targetSchema as z.ZodSchema<unknown>,
        triggerId: `1`,
      })
    ).toBeTruthy();
  });

  it(`should resolve schema path and resolve SET and NOT_SET conditions`, () => {
    const targetSchema = resolveSchemaPath({
      schema: z.object({
        name: z.string(),
      }),
      currentPath: '',
      finalMap: {},
      targetPath: 'name',
    });

    expect((targetSchema?._def as any).typeName).toBe(`ZodString`);

    expect(
      resolveCondition({
        c: {
          field: 'data.name',
          operator: FilterOpToValueMapEnum.SET,
          value: ``,
        },
        dataCtx: {
          [`1`]: { data: { name: `Dayo` } },
        },
        schema: targetSchema as z.ZodSchema<unknown>,
        triggerId: `1`,
      })
    ).toBeTruthy();

    expect(
      resolveCondition({
        c: {
          field: 'data.name',
          operator: FilterOpToValueMapEnum.NOT_SET,
          value: ``,
        },
        dataCtx: {
          [`1`]: { data: { name: `Dayo` } },
        },
        schema: targetSchema as z.ZodSchema<unknown>,
        triggerId: `1`,
      })
    ).toBeFalsy();
  });

  it(`evaluateCondition - AND/OR/BASE`, () => {
    expect(
      evaluateCondition({
        c: {
          field: 'data.last',
          operator: FilterOpToValueMapEnum.EQUAL,
          value: `Suh`,
          and: [
            {
              field: 'data.name',
              operator: FilterOpToValueMapEnum.EQUAL,
              value: `Dayo`,
            },
            {
              field: 'data.age',
              operator: FilterOpToValueMapEnum.EQUAL,
              value: 20,
            },
          ],
          or: [
            {
              field: 'data.type',
              operator: FilterOpToValueMapEnum.EQUAL,
              value: `Human`,
            },
            {
              field: 'data.type',
              operator: FilterOpToValueMapEnum.EQUAL,
              value: `Alien`,
            },
          ],
        },
        schema: z.object({
          data: z.object({
            name: z.string(),
            age: z.number(),
            last: z.string(),
            type: z.string(),
          }),
        }),
        dataCtx: {
          [`1`]: {
            data: { name: `Dayo`, age: 20, last: `Suh`, type: `Human` },
          },
        },
        triggerId: `1`,
      })
    ).toBeTruthy();
  });
});

describe.skip('run blueprint', () => {
  const testFrameworkName = 'TEST_FRAMEWORK';
  const testPluginName = 'TEST_PLUGIN';
  const testActionType = 'TEST_ACTION';
  const testEventKey = 'TEST_EVENT';
  const testPluginActionType = 'TEST_PLUGIN_ACTION';
  const testPluginEventKey = 'TEST_PLUGIN_EVENT';

  const mockSystemActions: IntegrationAction[] = [
    createMockAction(testActionType, CORE_PLUGIN_NAME),
  ];

  const mockPluginAction: IntegrationAction = createMockAction(
    testPluginActionType,
    testPluginName
  );

  const mockPluginEvent: IntegrationEvent = createMockEvent(testPluginEventKey);

  const mockSystemEvents: IntegrationEvent[] = [createMockEvent(testEventKey)];

  const integrationFramework = createFramework({
    name: testFrameworkName,
    plugins: [
      new MockPlugin({
        name: testPluginName,
        logoUrl: 'test',
        events: { [testPluginEventKey]: mockPluginEvent },
        actions: { [testPluginActionType]: mockPluginAction },
      }),
    ],
    systemActions: mockSystemActions,
    systemEvents: mockSystemEvents,
    db: {
      provider: 'postgres',
      uri: 'test',
    },
  });

  // let ctx: { userId: string; workspaceId: string } = {} as any;

  const getTestBlueprint = ({ props }: { props: any }) =>
    ({
      id: 'clz8opoy40000qb8kzj1or85l',
      title: 'New Workflow',
      description: 'dummy description',
      status: 'PUBLISHED',
      runs: [],
      ...props,
    } as any);

  const mock_system_actions: Record<string, any> = {
    CREATE_RECORD: jest.fn(),
    CREATE_TASK: jest.fn(),
    CREATE_NOTE: jest.fn(),
  };

  const addSystemAction = ({
    actions,
  }: {
    actions: { name: string; executor: IntegrationAction['executor'] }[];
  }) =>
    integrationFramework.globalActions.set('SYSTEM', {
      ...Object.entries(
        integrationFramework.globalActions.get('SYSTEM') || {}
      ).reduce((acc, [key, value]) => {
        acc[key] = {
          ...value,
          executor: mock_system_actions[key],
        };
        return acc;
      }, {} as Record<string, IntegrationAction<any>>),
      ...actions.reduce((acc, action) => {
        acc[action.name] = {
          pluginName: 'system',
          type: action.name,
          label: 'Create test',
          icon: {
            alt: 'plus-icon',
            icon: 'plus-icon',
          },
          category: 'RECORD',
          description: 'Create a new record',
          executor: action.executor,
          schema: z.object({
            title: z.string(),
          }),
        };
        return acc;
      }, {} as Record<string, IntegrationAction<any>>),
    });

  it('should run a blueprint CONTAINS true or false', async () => {
    let testExecutor = jest.fn();
    const systemActions = [
      {
        name: 'TEST_FUNC',
        executor: testExecutor,
      },
    ];

    addSystemAction({ actions: systemActions });

    let dataCtx = {
      data: {
        name: 'ee',
      },
    };

    const trigger = {
      id: 'yu4a87uuivmh7uzmteelvsaw',
      type: 'RECORD_CREATED',
      payload: {
        value: {
          recordType: 'companies',
        },
      },
      condition: {
        field: 'data.name',
        value: 'ee',
        operator: FilterOpToValueMapEnum.CONTAINS,
      },
    };

    const actions = [
      {
        id: 'jedd1k00e1tsrw2zsbefdsqb',
        type: 'TEST_FUNC',
        payload: {
          title: 'abhi',
        },
        variables: {},
        subActions: [],
      },
    ];

    const test_blueprint = getTestBlueprint({
      props: { trigger, actions },
    }) as any;

    await integrationFramework.runBlueprint({
      blueprint: test_blueprint as any,
      dataCtx,
    });

    expect(testExecutor).toHaveBeenCalled();

    dataCtx = {
      data: {
        name: 'uu',
      },
    };

    testExecutor = jest.fn();

    await integrationFramework.runBlueprint({
      blueprint: test_blueprint as any,
      dataCtx,
    });

    expect(testExecutor).not.toHaveBeenCalled();
  });

  it('should run a blueprint with condition AND', async () => {
    let testExecutor = jest.fn();
    const systemActions = [
      {
        name: 'TEST_FUNC',
        executor: testExecutor,
      },
    ];

    addSystemAction({ actions: systemActions });

    let dataCtx = {
      data: {
        name: 'ee',
        website: `ff`,
      },
    };

    const trigger = {
      id: 'yu4a87uuivmh7uzmteelvsaw',
      type: 'RECORD_CREATED',
      payload: {
        value: {
          recordType: 'companies',
        },
      },
      condition: {
        and: [
          {
            field: 'data.name',
            value: 'ee',
            operator: FilterOpToValueMapEnum.CONTAINS,
          },
          {
            field: 'data.website',
            value: 'ff',
            operator: FilterOpToValueMapEnum.CONTAINS,
          },
        ],
      },
    };

    const actions = [
      {
        id: 'jedd1k00e1tsrw2zsbefdsqb',
        type: 'TEST_FUNC',
        payload: {
          title: 'abhi',
        },
        variables: {},
        subActions: [],
      },
    ];

    const test_blueprint = getTestBlueprint({
      props: { trigger, actions },
    }) as any;

    await integrationFramework.runBlueprint({
      blueprint: test_blueprint as any,
      dataCtx,
    });

    expect(testExecutor).toHaveBeenCalled();
  });

  it('Should filter blueprint using EQUALS and NOT_EQUALS operator', async () => {
    let testExecutor = jest.fn();
    const systemActions = [
      {
        name: 'TEST_FUNC',
        executor: testExecutor,
      },
    ];

    addSystemAction({ actions: systemActions });

    const dataCtx = {
      data: {
        name: 'ee',
      },
    };

    const trigger = {
      id: 'yu4a87uuivmh7uzmteelvsaw',
      type: 'RECORD_CREATED',
      payload: {
        value: {
          recordType: 'companies',
        },
      },
      condition: {
        field: 'data.name',
        value: 'ee',
        operator: FilterOpToValueMapEnum.EQUAL,
      },
    };

    const actions = [
      {
        id: 'jedd1k00e1tsrw2zsbefdsqb',
        type: 'TEST_FUNC',
        payload: {
          title: 'abhi',
        },
        variables: {},
        subActions: [],
      },
    ];

    const test_blueprint = getTestBlueprint({
      props: { trigger, actions },
    }) as any;

    await integrationFramework.runBlueprint({
      blueprint: test_blueprint as any,
      dataCtx,
    });

    expect(testExecutor).toHaveBeenCalled();

    const dataCtx2 = {
      data: {
        name: 'pp',
      },
    };

    testExecutor = jest.fn();

    await integrationFramework.runBlueprint({
      blueprint: test_blueprint as any,
      dataCtx: dataCtx2,
    });

    expect(testExecutor).not.toHaveBeenCalled();
  });

  it('Should run condition block actions', async () => {
    const testExecutor = jest.fn(() => 'called testExecutor');
    const testExecutor2 = jest.fn();

    const systemActions = [
      {
        name: 'TEST_FUNC',
        executor: testExecutor,
      },
      {
        name: 'TEST_FUNC_2',
        executor: testExecutor2,
      },
    ];

    addSystemAction({ actions: systemActions as any });

    const dataCtx = {
      data: {
        name: 'ee',
      },
    };

    const trigger = {
      id: 'yu4a87uuivmh7uzmteelvsaw',
      type: 'RECORD_CREATED',
      payload: {
        value: {
          recordType: 'companies',
        },
      },
      condition: {
        field: 'data.name',
        value: 'ee',
        operator: FilterOpToValueMapEnum.EQUAL,
      },
    };

    const actions = [
      {
        id: 'mg46akzlvl9dsv83rutjwxwj',
        type: 'CONDITIONS',
        condition: [
          {
            id: 'nbv65r22pj9rsg3l541qyx7b',
            field: 'data.name',
            value: 'ee',
            actionId: 'je2vn0ptpwkdm0qdaxuuvu9l',
            operator: FilterOpToValueMapEnum.EQUAL,
            automationBlockId: 'yu4a87uuivmh7uzmteelvsaw',
          },
          {
            id: 'k93xrxdyxaqsle4flv5l1jjq',
            field: 'data.name',
            value: 'bourne',
            actionId: 'a6bg9smy0cv4fm6hitf8y3mr',
            operator: FilterOpToValueMapEnum.EQUAL,
            automationBlockId: 'yu4a87uuivmh7uzmteelvsaw',
          },
        ],
        subActions: [
          {
            id: 'je2vn0ptpwkdm0qdaxuuvu9l',
            type: 'TEST_FUNC',
            subActions: [],
            payload: {
              title: 'james',
            },
            parentActionId: 'mg46akzlvl9dsv83rutjwxwj',
          },
          {
            id: 'a6bg9smy0cv4fm6hitf8y3mr',
            type: 'TEST_FUNC_2',
            payload: {
              title: 'john',
            },
            subActions: [],
            parentActionId: 'mg46akzlvl9dsv83rutjwxwj',
          },
        ],
      },
    ];

    const test_blueprint = getTestBlueprint({
      props: { trigger, actions },
    }) as any;

    await integrationFramework.runBlueprint({
      blueprint: test_blueprint as any,
      dataCtx,
    });

    expect(testExecutor).toHaveBeenCalled();
    expect(testExecutor2).not.toHaveBeenCalled();
  });

  it('Should not run default condition when other conditions are met', async () => {
    const testExecutor = jest.fn(() => 'called testExecutor');
    const testExecutor2 = jest.fn();

    const systemActions = [
      {
        name: 'TEST_FUNC',
        executor: testExecutor,
      },
      {
        name: 'TEST_FUNC_2',
        executor: testExecutor2,
      },
    ];

    addSystemAction({ actions: systemActions as any });

    const dataCtx = {
      data: {
        name: 'ee',
      },
    };

    const trigger = {
      id: 'yu4a87uuivmh7uzmteelvsaw',
      type: 'RECORD_CREATED',
      payload: {
        value: {
          recordType: 'companies',
        },
      },
      condition: {
        field: 'data.name',
        value: 'ee',
        operator: FilterOpToValueMapEnum.EQUAL,
      },
    };

    const actions = [
      {
        id: 'mg46akzlvl9dsv83rutjwxwj',
        type: 'CONDITIONS',
        condition: [
          {
            id: 'nbv65r22pj9rsg3l541qyx7b',
            isDefault: true,
            actionId: 'je2vn0ptpwkdm0qdaxuuvu9l',
          },
          {
            id: 'k93xrxdyxaqsle4flv5l1jjq',
            field: 'data.name',
            value: 'ee',
            actionId: 'a6bg9smy0cv4fm6hitf8y3mr',
            operator: FilterOpToValueMapEnum.EQUAL,
            automationBlockId: 'yu4a87uuivmh7uzmteelvsaw',
          },
        ],
        subActions: [
          {
            id: 'je2vn0ptpwkdm0qdaxuuvu9l',
            type: 'TEST_FUNC',
            subActions: [],
            payload: {
              title: 'james',
            },
            parentActionId: 'mg46akzlvl9dsv83rutjwxwj',
          },
          {
            id: 'a6bg9smy0cv4fm6hitf8y3mr',
            type: 'TEST_FUNC_2',
            payload: {
              title: 'john',
            },
            subActions: [],
            parentActionId: 'mg46akzlvl9dsv83rutjwxwj',
          },
        ],
      },
    ];

    const test_blueprint = getTestBlueprint({
      props: { trigger, actions },
    }) as any;

    await integrationFramework.runBlueprint({
      blueprint: test_blueprint as any,
      dataCtx,
    });

    expect(testExecutor).not.toHaveBeenCalled();
    expect(testExecutor2).toHaveBeenCalled();
  });

  it('Should run default condition when other conditions are not met', async () => {
    const testExecutor = jest.fn(() => 'called testExecutor');
    const testExecutor2 = jest.fn();

    const systemActions = [
      {
        name: 'TEST_FUNC',
        executor: testExecutor,
      },
      {
        name: 'TEST_FUNC_2',
        executor: testExecutor2,
      },
    ];

    addSystemAction({ actions: systemActions as any });

    const dataCtx = {
      data: {
        name: 'ee',
      },
    };

    const trigger = {
      id: 'yu4a87uuivmh7uzmteelvsaw',
      type: 'RECORD_CREATED',
      payload: {
        value: {
          recordType: 'companies',
        },
      },
      condition: {
        field: 'data.name',
        value: 'ee',
        operator: FilterOpToValueMapEnum.EQUAL,
      },
    };

    const actions = [
      {
        id: 'mg46akzlvl9dsv83rutjwxwj',
        type: 'CONDITIONS',
        condition: [
          {
            id: 'nbv65r22pj9rsg3l541qyx7b',
            isDefault: true,
            actionId: 'je2vn0ptpwkdm0qdaxuuvu9l',
          },
          {
            id: 'k93xrxdyxaqsle4flv5l1jjq',
            field: 'data.name',
            value: 'ray',
            actionId: 'a6bg9smy0cv4fm6hitf8y3mr',
            operator: FilterOpToValueMapEnum.EQUAL,
            automationBlockId: 'yu4a87uuivmh7uzmteelvsaw',
          },
        ],
        subActions: [
          {
            id: 'je2vn0ptpwkdm0qdaxuuvu9l',
            type: 'TEST_FUNC',
            subActions: [],
            payload: {
              title: 'james',
            },
            parentActionId: 'mg46akzlvl9dsv83rutjwxwj',
          },
          {
            id: 'a6bg9smy0cv4fm6hitf8y3mr',
            type: 'TEST_FUNC_2',
            payload: {
              title: 'john',
            },
            subActions: [],
            parentActionId: 'mg46akzlvl9dsv83rutjwxwj',
          },
        ],
      },
    ];

    const test_blueprint = getTestBlueprint({
      props: { trigger, actions },
    }) as any;

    await integrationFramework.runBlueprint({
      blueprint: test_blueprint as any,
      dataCtx,
    });

    expect(testExecutor).toHaveBeenCalled();
    expect(testExecutor2).not.toHaveBeenCalled();
  });

  it('Should make action executor output available to children actions', async () => {
    const testExecutor = jest.fn(() => ({
      data: {
        name: 'uu',
      },
    }));
    const testExecutor2 = jest.fn();

    const systemActions = [
      {
        name: 'TEST_FUNC',
        executor: testExecutor,
      },
      {
        name: 'TEST_FUNC_2',
        executor: testExecutor2,
      },
    ];

    addSystemAction({ actions: systemActions as any });

    const dataCtx = {
      data: {
        name: 'ee',
      },
    };

    const trigger = {
      id: 'yu4a87uuivmh7uzmteelvsaw',
      type: 'RECORD_CREATED',
      payload: {
        value: {
          recordType: 'companies',
        },
      },
      condition: {
        field: 'data.name',
        value: 'ee',
        operator: FilterOpToValueMapEnum.EQUAL,
      },
    };

    const actions = [
      {
        id: 'je2vn0ptpwkdm0qdaxuuvu9l',
        type: 'TEST_FUNC',
        subActions: [
          {
            id: 'je2vn0ptpwkdm0qdaxuuvu9z',
            type: 'TEST_FUNC_2',
            subActions: [],
            payload: {
              title: '{{var}}',
            },
            variables: {
              title: {
                var: {
                  path: 'data.name',
                  refBlockId: 'je2vn0ptpwkdm0qdaxuuvu9l',
                },
              },
            },
            parentActionId: 'je2vn0ptpwkdm0qdaxuuvu9l',
          },
        ],
        payload: {
          title: 'james',
        },
      },
    ];

    const test_blueprint = getTestBlueprint({
      props: { trigger, actions },
    }) as any;

    await integrationFramework.runBlueprint({
      blueprint: test_blueprint as any,
      dataCtx,
    });

    expect(testExecutor).toHaveBeenCalled();
    expect(testExecutor2).toHaveBeenCalledWith({
      data: {
        title: 'uu',
      },
    });
  });

  it('Should run a blueprint CONTAINS true and CREATE_NOTE', async () => {
    let testExecutor = jest.fn();
    const systemActions = [
      {
        name: 'TEST_FUNC',
        executor: testExecutor,
      },
    ];

    addSystemAction({ actions: systemActions });

    let dataCtx = {
      data: {
        name: 'ee',
      },
    };

    const trigger = {
      id: 'yu4a87uuivmh7uzmteelvsaw',
      type: 'RECORD_CREATED',
      payload: {
        value: {
          recordType: 'companies',
        },
      },
      condition: {
        field: 'data.name',
        value: 'ee',
        operator: FilterOpToValueMapEnum.CONTAINS,
      },
    };

    const actions = [
      {
        id: 'jedd1k00e1tsrw2zsbefdsqb',
        type: 'CREATE_NOTE',
        payload: {
          title: 'ee',
          id: 'jedd1k00e1tsrw2zsbefdsqb',
          publicId: 'jedd1k00e1tsrw2zsbefdsqc',
          status: 'ACTIVE',
        },
        variables: {},
        subActions: [],
      },
    ];

    const test_blueprint = getTestBlueprint({
      props: { trigger, actions },
    }) as any;

    await integrationFramework.runBlueprint({
      blueprint: test_blueprint as any,
      dataCtx,
    });

    expect(mock_system_actions.CREATE_NOTE).toHaveBeenCalled();
  });
});
