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

export const constructStructuredOutput = (
  structuredOutputs: StructuredOutput[],
  childrenStructuredOutputs: ChildStructuredOutput[],
) => {
  const allOutputs = [...structuredOutputs, ...childrenStructuredOutputs]?.reduce((acc, item) => {
    const parentKey = (item as ChildStructuredOutput).parentKey;
    if (parentKey) {
      const parent = acc[parentKey];
      if (parent.arrayItemType && parent.arrayItemType === 'object') {
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
