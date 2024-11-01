import { createId } from '@paralleldrive/cuid2';

export const structuredOutputTypes = ['array', 'string', 'number', 'object', 'boolean', 'date'] as const;

export type StructuredOutputType = (typeof structuredOutputTypes)[number];

export interface StructuredOutput {
  id: string;
  type: StructuredOutputType;
  name: string;
  arrayItemType?: StructuredOutputType;
}

export interface ChildStructuredOutput {
  id: string;
  type: StructuredOutputType;
  name: string;
  parentKey: string;
}

export interface StructuredResponse {
  [key: string]:
    | {
        type: StructuredOutputType;
      }
    | {
        type: 'object';
        items: {
          [key: string]: {
            type: 'string' | 'date' | 'number' | 'boolean';
          };
        };
      }
    | {
        type: 'array';
        items:
          | {
              type: 'string' | 'date' | 'number' | 'boolean';
            }
          | {
              type: 'object';
              items: {
                [key: string]: {
                  type: 'string' | 'date' | 'number' | 'boolean';
                };
              };
            };
      };
}

export const constructStructuredOutput = (
  structuredOutputs: StructuredOutput[],
  childrenStructuredOutputs: ChildStructuredOutput[],
) => {
  const allOutputs = [...structuredOutputs, ...childrenStructuredOutputs]?.reduce((acc, item) => {
    const parentKey = (item as ChildStructuredOutput).parentKey;
    if (parentKey) {
      const parent = acc[parentKey];
      if (parent.items?.type && parent.items?.type === 'object') {
        return {
          ...acc,
          [parentKey]: {
            ...(parent || {}),
            items: {
              ...(parent?.items || {}),
              items: {
                ...(parent?.items?.items || {}),
                [item.name]: {
                  type: item.type,
                },
              },
            },
          },
        };
      }
      return {
        ...acc,
        [parentKey]: {
          ...(parent || {}),
          items: {
            ...(parent?.items || {}),
            [item.name]: {
              type: item.type,
            },
          },
        },
      };
    }
    if (item.type === 'object') {
      return { ...acc, [item.name]: { type: item.type, items: {} } };
    }
    if (item.type === 'array') {
      return {
        ...acc,
        [item.name]: {
          type: item.type,
          items: {
            type: (item as StructuredOutput).arrayItemType,
          },
        },
      };
    }
    return { ...acc, [item.name]: { type: item.type } };
  }, {} as { [key: string]: any });

  return allOutputs;
};

export const constructStrucuturedOutputArr = (structuredResponse: StructuredResponse) => {
  let structuredOutput: StructuredOutput[] = [];
  let childrenOutput: ChildStructuredOutput[] = [];

  function recurseDip(obj: { [key: string]: any }, parent?: string) {
    for (const [key, value] of Object.entries(obj)) {
      if (!parent) {
        if (value.type === 'array') {
          structuredOutput = [
            ...structuredOutput,
            { id: createId(), type: value.type, name: key, arrayItemType: (value as any).items?.type },
          ];
          if ((value as any).items?.type === 'object' && (value as any).items?.items) {
            recurseDip((value as any).items?.items, key);
          }
        } else if (value.type === 'object') {
          structuredOutput = [...structuredOutput, { id: createId(), type: value.type, name: key }];
          if ((value as any).items) {
            recurseDip((value as any).items, key);
          }
        } else {
          structuredOutput = [...structuredOutput, { id: createId(), type: value.type, name: key }];
        }
      } else if (parent) {
        childrenOutput = [...childrenOutput, { id: createId(), type: value.type, name: key, parentKey: parent }];
      }
    }
  }

  if (Object.entries(structuredResponse).length) {
    recurseDip(structuredResponse);
  }

  return { structuredOutput, childrenOutput };
};
