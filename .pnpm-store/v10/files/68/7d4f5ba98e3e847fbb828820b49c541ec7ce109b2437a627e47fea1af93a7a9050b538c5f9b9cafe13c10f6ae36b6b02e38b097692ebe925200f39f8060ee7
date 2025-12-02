export type DocumentClientMethod = (parameters: any) => {
  promise: () => Promise<any>;
};

type TransactWriteItem =
  | { Put: { [param: string]: any } }
  | { Update: { [param: string]: any } }
  | { Delete: { [param: string]: any } }
  | { ConditionCheck: { [param: string]: any } };

type TransactWriteCommandInput = {
  TransactItems: TransactWriteItem[];
  ClientRequestToken?: string;
};

type TransactGetItem = { Get: { [param: string]: any } };

type TransactGetCommandInput = {
  TransactItems: TransactGetItem[];
};

export type DocumentClient =
  | {
      get: DocumentClientMethod;
      put: DocumentClientMethod;
      delete: DocumentClientMethod;
      update: DocumentClientMethod;
      batchWrite: DocumentClientMethod;
      batchGet: DocumentClientMethod;
      scan: DocumentClientMethod;
      transactGet: DocumentClientMethod;
      transactWrite: DocumentClientMethod;
    }
  | {
      send: (command: any) => Promise<any>;
    };

export type AllCollectionNames<
  E extends { [name: string]: Entity<any, any, any, any> },
> = {
  [Name in keyof E]: E[Name] extends Entity<infer A, infer F, infer C, infer S>
    ? {
        [Collection in keyof EntityCollections<A, F, C, S>]: Collection;
      }[keyof EntityCollections<A, F, C, S>]
    : never;
}[keyof E];

export type ClusteredCollectionNames<
  E extends { [name: string]: Entity<any, any, any, any> },
> = {
  [Name in keyof E]: E[Name] extends Entity<infer A, infer F, infer C, infer S>
    ? {
        [Collection in keyof ClusteredEntityCollections<
          A,
          F,
          C,
          S
        >]: Collection;
      }[keyof ClusteredEntityCollections<A, F, C, S>]
    : never;
}[keyof E];

export type IsolatedCollectionNames<
  E extends { [name: string]: Entity<any, any, any, any> },
> = {
  [Name in keyof E]: E[Name] extends Entity<infer A, infer F, infer C, infer S>
    ? {
        [Collection in keyof IsolatedEntityCollections<A, F, C, S>]: Collection;
      }[keyof IsolatedEntityCollections<A, F, C, S>]
    : never;
}[keyof E];

export type IsolatedCollectionAssociations<
  E extends { [name: string]: Entity<any, any, any, any> },
> = {
  [Collection in IsolatedCollectionNames<E>]: {
    [Name in keyof E]: E[Name] extends Entity<
      infer A,
      infer F,
      infer C,
      infer S
    >
      ? Collection extends keyof IsolatedEntityCollections<A, F, C, S>
        ? Name
        : never
      : never;
  }[keyof E];
};

export type AllEntityAttributeNames<
  E extends { [name: string]: Entity<any, any, any, any> },
> = {
  [Name in keyof E]: {
    [A in keyof E[Name]["schema"]["attributes"]]: A;
  }[keyof E[Name]["schema"]["attributes"]];
}[keyof E];

export type AllEntityAttributes<
  E extends { [name: string]: Entity<any, any, any, any> },
> = {
  [Attr in AllEntityAttributeNames<E>]: {
    [Name in keyof E]: Attr extends keyof E[Name]["schema"]["attributes"]
      ? ItemAttribute<E[Name]["schema"]["attributes"][Attr]>
      : never;
  }[keyof E];
};

export type CollectionAssociations<
  E extends { [name: string]: Entity<any, any, any, any> },
> = {
  [Collection in AllCollectionNames<E>]: {
    [Name in keyof E]: E[Name] extends Entity<
      infer A,
      infer F,
      infer C,
      infer S
    >
      ? Collection extends keyof EntityCollections<A, F, C, S>
        ? Name
        : never
      : never;
  }[keyof E];
};

export type ClusteredCollectionAssociations<
  E extends { [name: string]: Entity<any, any, any, any> },
> = {
  [Collection in ClusteredCollectionNames<E>]: {
    [Name in keyof E]: E[Name] extends Entity<
      infer A,
      infer F,
      infer C,
      infer S
    >
      ? Collection extends keyof ClusteredEntityCollections<A, F, C, S>
        ? Name
        : never
      : never;
  }[keyof E];
};

export type CollectionAttributes<
  E extends { [name: string]: Entity<any, any, any, any> },
  Collections extends CollectionAssociations<E>,
> = {
  [Collection in keyof Collections]: {
    [EntityName in keyof E]: E[EntityName] extends Entity<
      infer A,
      infer F,
      infer C,
      infer S
    >
      ? EntityName extends Collections[Collection]
        ? keyof S["attributes"]
        : never
      : never;
  }[keyof E];
};

export type ClusteredCollectionAttributes<
  E extends { [name: string]: Entity<any, any, any, any> },
  Collections extends ClusteredCollectionAssociations<E>,
> = {
  [Collection in keyof Collections]: {
    [EntityName in keyof E]: E[EntityName] extends Entity<
      infer A,
      infer F,
      infer C,
      infer S
    >
      ? EntityName extends Collections[Collection]
        ? keyof S["attributes"]
        : never
      : never;
  }[keyof E];
};

export type IsolatedCollectionAttributes<
  E extends { [name: string]: Entity<any, any, any, any> },
  Collections extends IsolatedCollectionAssociations<E>,
> = {
  [Collection in keyof Collections]: {
    [EntityName in keyof E]: E[EntityName] extends Entity<
      infer A,
      infer F,
      infer C,
      infer S
    >
      ? EntityName extends Collections[Collection]
        ? keyof S["attributes"]
        : never
      : never;
  }[keyof E];
};

type DynamoDBAttributeType =
  | "S"
  | "SS"
  | "N"
  | "NS"
  | "B"
  | "BS"
  | "BOOL"
  | "NULL"
  | "L"
  | "M";

export interface CollectionWhereOperations {
  eq: <T, A extends WhereAttributeSymbol<T>>(attr: A, value: T) => string;
  ne: <T, A extends WhereAttributeSymbol<T>>(attr: A, value: T) => string;
  gt: <T, A extends WhereAttributeSymbol<T>>(attr: A, value: T) => string;
  lt: <T, A extends WhereAttributeSymbol<T>>(attr: A, value: T) => string;
  gte: <T, A extends WhereAttributeSymbol<T>>(attr: A, value: T) => string;
  lte: <T, A extends WhereAttributeSymbol<T>>(attr: A, value: T) => string;
  between: <T, A extends WhereAttributeSymbol<T>>(
    attr: A,
    value: T,
    value2: T,
  ) => string;
  begins: <T, A extends WhereAttributeSymbol<T>>(attr: A, value: T) => string;
  exists: <T, A extends WhereAttributeSymbol<T>>(attr: A) => string;
  notExists: <T, A extends WhereAttributeSymbol<T>>(attr: A) => string;
  contains: <T, A extends WhereAttributeSymbol<T>>(
    attr: A,
    value: A extends WhereAttributeSymbol<infer V>
      ? V extends Array<infer I>
        ? I
        : V
      : never,
  ) => string;
  notContains: <T, A extends WhereAttributeSymbol<T>>(
    attr: A,
    value: A extends WhereAttributeSymbol<infer V>
      ? V extends Array<infer I>
        ? I
        : V
      : never,
  ) => string;
  field: (name: string) => string;
  name: <T, A extends WhereAttributeSymbol<T>>(attr: A) => string;
  value: <T, A extends WhereAttributeSymbol<T>>(attr: A, value: T) => string;
  size: <T, A extends WhereAttributeSymbol<T>>(attr: A) => string;
  type: <T, A extends WhereAttributeSymbol<T>>(
    attr: A,
    type: DynamoDBAttributeType,
  ) => string;
  escape: <T extends string | number | boolean>(
    value: T,
  ) => T extends string
    ? string
    : T extends number
    ? number
    : T extends boolean
    ? boolean
    : never;
}

export type CollectionWhereCallback<
  E extends { [name: string]: Entity<any, any, any, any> },
  I extends Partial<AllEntityAttributes<E>>,
> = <W extends { [A in keyof I]: WhereAttributeSymbol<I[A]> }>(
  attributes: W,
  operations: CollectionWhereOperations,
) => string;

export type CollectionWhereClause<
  E extends { [name: string]: Entity<any, any, any, any> },
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends Partial<AllEntityAttributes<E>>,
  T,
> = (where: CollectionWhereCallback<E, I>) => T;

export interface ServiceWhereRecordsActionOptions<
  E extends { [name: string]: Entity<any, any, any, any> },
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends Partial<AllEntityAttributes<E>>,
  Items,
  IndexCompositeAttributes,
> {
  go: ServiceQueryRecordsGo<Items>;
  params: ParamRecord;
  where: CollectionWhereClause<
    E,
    A,
    F,
    C,
    S,
    I,
    ServiceWhereRecordsActionOptions<
      E,
      A,
      F,
      C,
      S,
      I,
      Items,
      IndexCompositeAttributes
    >
  >;
}

export type CollectionIndexKeys<
  Entities extends { [name: string]: Entity<any, any, any, any> },
  Collections extends CollectionAssociations<Entities>,
> = {
  [Collection in keyof Collections]: {
    [EntityResultName in Collections[Collection]]: EntityResultName extends keyof Entities
      ? Entities[EntityResultName] extends Entity<
          infer A,
          infer F,
          infer C,
          infer S
        >
        ? keyof TableIndexCompositeAttributes<A, F, C, S>
        : never
      : never;
  }[Collections[Collection]];
};

export type ClusteredCollectionIndexKeys<
  Entities extends { [name: string]: Entity<any, any, any, any> },
  Collections extends ClusteredCollectionAssociations<Entities>,
> = {
  [Collection in keyof Collections]: {
    [EntityResultName in Collections[Collection]]: EntityResultName extends keyof Entities
      ? Entities[EntityResultName] extends Entity<
          infer A,
          infer F,
          infer C,
          infer S
        >
        ? keyof TableIndexCompositeAttributes<A, F, C, S>
        : never
      : never;
  }[Collections[Collection]];
};

export type IsolatedCollectionIndexKeys<
  Entities extends { [name: string]: Entity<any, any, any, any> },
  Collections extends IsolatedCollectionAssociations<Entities>,
> = {
  [Collection in keyof Collections]: {
    [EntityResultName in Collections[Collection]]: EntityResultName extends keyof Entities
      ? Entities[EntityResultName] extends Entity<
          infer A,
          infer F,
          infer C,
          infer S
        >
        ? keyof TableIndexCompositeAttributes<A, F, C, S>
        : never
      : never;
  }[Collections[Collection]];
};

export type CollectionPageKeys<
  Entities extends { [name: string]: Entity<any, any, any, any> },
  Collections extends CollectionAssociations<Entities>,
> = {
  [Collection in keyof Collections]: {
    [EntityResultName in Collections[Collection]]: EntityResultName extends keyof Entities
      ? Entities[EntityResultName] extends Entity<
          infer A,
          infer F,
          infer C,
          infer S
        >
        ? keyof Parameters<
            Entities[EntityResultName]["query"][Collection extends keyof EntityCollections<
              A,
              F,
              C,
              S
            >
              ? EntityCollections<A, F, C, S>[Collection]
              : never]
          >[0]
        : never
      : never;
  }[Collections[Collection]];
};

export type ClusteredCollectionPageKeys<
  Entities extends { [name: string]: Entity<any, any, any, any> },
  Collections extends ClusteredCollectionAssociations<Entities>,
> = {
  [Collection in keyof Collections]: {
    [EntityResultName in Collections[Collection]]: EntityResultName extends keyof Entities
      ? Entities[EntityResultName] extends Entity<
          infer A,
          infer F,
          infer C,
          infer S
        >
        ? keyof Parameters<
            Entities[EntityResultName]["query"][Collection extends keyof ClusteredEntityCollections<
              A,
              F,
              C,
              S
            >
              ? ClusteredEntityCollections<A, F, C, S>[Collection]
              : never]
          >[0]
        : never
      : never;
  }[Collections[Collection]];
};

export type IsolatedCollectionPageKeys<
  Entities extends { [name: string]: Entity<any, any, any, any> },
  Collections extends IsolatedCollectionAssociations<Entities>,
> = {
  [Collection in keyof Collections]: {
    [EntityResultName in Collections[Collection]]: EntityResultName extends keyof Entities
      ? Entities[EntityResultName] extends Entity<
          infer A,
          infer F,
          infer C,
          infer S
        >
        ? keyof Parameters<
            Entities[EntityResultName]["query"][Collection extends keyof IsolatedEntityCollections<
              A,
              F,
              C,
              S
            >
              ? IsolatedEntityCollections<A, F, C, S>[Collection]
              : never]
          >[0]
        : never
      : never;
  }[Collections[Collection]];
};

export type CollectionIndexAttributes<
  Entities extends { [name: string]: Entity<any, any, any, any> },
  Collections extends CollectionAssociations<Entities>,
> = {
  [Collection in keyof CollectionIndexKeys<Entities, Collections>]: {
    [key in CollectionIndexKeys<
      Entities,
      Collections
    >[Collection]]: key extends keyof AllEntityAttributes<Entities>
      ? AllEntityAttributes<Entities>[key]
      : never;
  };
};

export type ClusteredCollectionIndexAttributes<
  Entities extends { [name: string]: Entity<any, any, any, any> },
  Collections extends ClusteredCollectionAssociations<Entities>,
> = {
  [Collection in keyof ClusteredCollectionIndexKeys<Entities, Collections>]: {
    [Key in ClusteredCollectionIndexKeys<
      Entities,
      Collections
    >[Collection]]: Key extends keyof AllEntityAttributes<Entities>
      ? AllEntityAttributes<Entities>[Key]
      : never;
  };
};

export type IsolatedCollectionIndexAttributes<
  Entities extends { [name: string]: Entity<any, any, any, any> },
  Collections extends IsolatedCollectionAssociations<Entities>,
> = {
  [Collection in keyof IsolatedCollectionIndexKeys<Entities, Collections>]: {
    [Key in IsolatedCollectionIndexKeys<
      Entities,
      Collections
    >[Collection]]: Key extends keyof AllEntityAttributes<Entities>
      ? AllEntityAttributes<Entities>[Key]
      : never;
  };
};

export type CollectionPageAttributes<
  Entities extends { [name: string]: Entity<any, any, any, any> },
  Collections extends CollectionAssociations<Entities>,
> = {
  [Collection in keyof CollectionPageKeys<Entities, Collections>]: {
    [key in CollectionPageKeys<
      Entities,
      Collections
    >[Collection]]: key extends keyof AllEntityAttributes<Entities>
      ? AllEntityAttributes<Entities>[key]
      : never;
  };
};

export type ClusteredCollectionPageAttributes<
  Entities extends { [name: string]: Entity<any, any, any, any> },
  Collections extends ClusteredCollectionAssociations<Entities>,
> = {
  [Collection in keyof ClusteredCollectionPageKeys<Entities, Collections>]: {
    [key in ClusteredCollectionPageKeys<
      Entities,
      Collections
    >[Collection]]: key extends keyof AllEntityAttributes<Entities>
      ? AllEntityAttributes<Entities>[key]
      : never;
  };
};

export type IsolatedCollectionPageAttributes<
  Entities extends { [name: string]: Entity<any, any, any, any> },
  Collections extends IsolatedCollectionAssociations<Entities>,
> = {
  [Collection in keyof IsolatedCollectionPageKeys<Entities, Collections>]: {
    [key in IsolatedCollectionPageKeys<
      Entities,
      Collections
    >[Collection]]: key extends keyof AllEntityAttributes<Entities>
      ? AllEntityAttributes<Entities>[key]
      : never;
  };
};

export type OptionalPropertyNames<T> = {
  [K in keyof T]: undefined extends T[K] ? K : never;
}[keyof T];

// Common properties from L and R with undefined in R[K] replaced by type in L[K]
export type SpreadProperties<L, R, K extends keyof L & keyof R> = {
  [P in K]: L[P] | Exclude<R[P], undefined>;
};

export type Id<T> = { [K in keyof T]: T[K] }; // see note at bottom*

// Type of { ...L, ...R }
export type Spread<L, R> = Id<
  // Properties in L that don't exist in R
  Pick<L, Exclude<keyof L, keyof R>> &
    // Properties in R with types that exclude undefined
    Pick<R, Exclude<keyof R, OptionalPropertyNames<R>>> &
    // Properties in R, with types that include undefined, that don't exist in L
    Pick<R, Exclude<OptionalPropertyNames<R>, keyof L>> &
    // Properties in R, with types that include undefined, that exist in L
    SpreadProperties<L, R, OptionalPropertyNames<R> & keyof L>
>;

export type RequiredProperties<T> = Pick<
  T,
  { [K in keyof T]-?: {} extends Pick<T, K> ? never : K }[keyof T]
>;

export type CollectionQueries<
  E extends { [name: string]: Entity<any, any, any, any> },
  Collections extends CollectionAssociations<E>,
> = {
  [Collection in keyof Collections]: {
    [EntityName in keyof E]: EntityName extends Collections[Collection]
      ? (
          params: RequiredProperties<
            Parameters<
              E[EntityName]["query"][E[EntityName] extends Entity<
                infer A,
                infer F,
                infer C,
                infer S
              >
                ? Collection extends keyof EntityCollections<A, F, C, S>
                  ? EntityCollections<A, F, C, S>[Collection]
                  : never
                : never]
            >[0]
          >,
        ) => {
          go: ServiceQueryRecordsGo<{
            [EntityResultName in Collections[Collection]]: EntityResultName extends keyof E
              ? E[EntityResultName] extends Entity<
                  infer A,
                  infer F,
                  infer C,
                  infer S
                >
                ? ResponseItem<A, F, C, S>[]
                : never
              : never;
          }>;
          params: ParamRecord;
          where: {
            [EntityResultName in Collections[Collection]]: EntityResultName extends keyof E
              ? E[EntityResultName] extends Entity<
                  infer A,
                  infer F,
                  infer C,
                  infer S
                >
                ? Pick<
                    AllEntityAttributes<E>,
                    Extract<
                      AllEntityAttributeNames<E>,
                      CollectionAttributes<E, Collections>[Collection]
                    >
                  > extends Partial<AllEntityAttributes<E>>
                  ? CollectionWhereClause<
                      E,
                      A,
                      F,
                      C,
                      S,
                      Pick<
                        AllEntityAttributes<E>,
                        Extract<
                          AllEntityAttributeNames<E>,
                          CollectionAttributes<E, Collections>[Collection]
                        >
                      >,
                      ServiceWhereRecordsActionOptions<
                        E,
                        A,
                        F,
                        C,
                        S,
                        Pick<
                          AllEntityAttributes<E>,
                          Extract<
                            AllEntityAttributeNames<E>,
                            CollectionAttributes<E, Collections>[Collection]
                          >
                        >,
                        {
                          [EntityResultName in Collections[Collection]]: EntityResultName extends keyof E
                            ? E[EntityResultName] extends Entity<
                                infer A,
                                infer F,
                                infer C,
                                infer S
                              >
                              ? ResponseItem<A, F, C, S>[]
                              : never
                            : never;
                        },
                        Partial<
                          Spread<
                            Collection extends keyof CollectionPageAttributes<
                              E,
                              Collections
                            >
                              ? CollectionPageAttributes<
                                  E,
                                  Collections
                                >[Collection]
                              : {},
                            Collection extends keyof CollectionIndexAttributes<
                              E,
                              Collections
                            >
                              ? CollectionIndexAttributes<
                                  E,
                                  Collections
                                >[Collection]
                              : {}
                          >
                        >
                      >
                    >
                  : never
                : never
              : never;
          }[Collections[Collection]];
        }
      : never;
  }[keyof E];
};

type ClusteredCollectionOperations<
  E extends { [name: string]: Entity<any, any, any, any> },
  Collections extends ClusteredCollectionAssociations<E>,
  Collection extends keyof Collections,
  EntityName extends keyof E,
> = EntityName extends Collections[Collection]
  ? {
      go: ServiceQueryRecordsGo<{
        [EntityResultName in Collections[Collection]]: EntityResultName extends keyof E
          ? E[EntityResultName] extends Entity<
              infer A,
              infer F,
              infer C,
              infer S
            >
            ? ResponseItem<A, F, C, S>[]
            : never
          : never;
      }>;
      params: ParamRecord;
      where: {
        [EntityResultName in Collections[Collection]]: EntityResultName extends keyof E
          ? E[EntityResultName] extends Entity<
              infer A,
              infer F,
              infer C,
              infer S
            >
            ? Pick<
                AllEntityAttributes<E>,
                Extract<
                  AllEntityAttributeNames<E>,
                  ClusteredCollectionAttributes<E, Collections>[Collection]
                >
              > extends Partial<AllEntityAttributes<E>>
              ? CollectionWhereClause<
                  E,
                  A,
                  F,
                  C,
                  S,
                  Pick<
                    AllEntityAttributes<E>,
                    Extract<
                      AllEntityAttributeNames<E>,
                      ClusteredCollectionAttributes<E, Collections>[Collection]
                    >
                  >,
                  ServiceWhereRecordsActionOptions<
                    E,
                    A,
                    F,
                    C,
                    S,
                    Pick<
                      AllEntityAttributes<E>,
                      Extract<
                        AllEntityAttributeNames<E>,
                        ClusteredCollectionAttributes<
                          E,
                          Collections
                        >[Collection]
                      >
                    >,
                    {
                      [EntityResultName in Collections[Collection]]: EntityResultName extends keyof E
                        ? E[EntityResultName] extends Entity<
                            infer A,
                            infer F,
                            infer C,
                            infer S
                          >
                          ? ResponseItem<A, F, C, S>[]
                          : never
                        : never;
                    },
                    Partial<
                      Spread<
                        Collection extends keyof ClusteredCollectionPageAttributes<
                          E,
                          Collections
                        >
                          ? ClusteredCollectionPageAttributes<
                              E,
                              Collections
                            >[Collection]
                          : {},
                        Collection extends keyof ClusteredCollectionIndexAttributes<
                          E,
                          Collections
                        >
                          ? ClusteredCollectionIndexAttributes<
                              E,
                              Collections
                            >[Collection]
                          : {}
                      >
                    >
                  >
                >
              : never
            : never
          : never;
      }[Collections[Collection]];
    }
  : never;

type ClusteredCompositeAttributes<
  E extends { [name: string]: Entity<any, any, any, any> },
  Collections extends ClusteredCollectionAssociations<E>,
  Collection extends keyof Collections,
  EntityName extends keyof E,
> = EntityName extends Collections[Collection]
  ? Parameters<
      E[EntityName]["query"][E[EntityName] extends Entity<
        infer A,
        infer F,
        infer C,
        infer S
      >
        ? Collection extends keyof ClusteredEntityCollections<A, F, C, S>
          ? ClusteredEntityCollections<A, F, C, S>[Collection]
          : never
        : never]
    >[0]
  : never;

type ClusteredCollectionQueryOperations<Param, Result> = {
  between(
    skCompositeAttributesStart: Param,
    skCompositeAttributesEnd: Param,
  ): Result;
  gt(skCompositeAttributes: Param): Result;
  gte(skCompositeAttributes: Param): Result;
  lt(skCompositeAttributes: Param): Result;
  lte(skCompositeAttributes: Param): Result;
  begins(skCompositeAttributes: Param): Result;
};

type OptionalPropertyOf<T extends object> = Exclude<
  {
    [K in keyof T]: T extends Record<K, T[K]> ? never : K;
  }[keyof T],
  undefined
>;

type ClusteredCollectionQueryParams<
  E extends { [name: string]: Entity<any, any, any, any> },
  Collections extends ClusteredCollectionAssociations<E>,
> = {
  [Collection in keyof Collections as Collections[Collection] extends keyof E
    ? Collection
    : never]: {
    [EntityName in keyof E]: EntityName extends Collections[Collection]
      ? ClusteredCompositeAttributes<E, Collections, Collection, EntityName>
      : never;
  }[keyof E];
};

export type ClusteredCollectionQueries<
  E extends { [name: string]: Entity<any, any, any, any> },
  Collections extends ClusteredCollectionAssociations<E>,
> = {
  [Collection in keyof Collections as Collections[Collection] extends keyof E
    ? Collection
    : never]: {
    [EntityName in keyof E]: EntityName extends Collections[Collection]
      ? (
          params: ClusteredCompositeAttributes<
            E,
            Collections,
            Collection,
            EntityName
          >,
        ) => ClusteredCollectionOperations<
          E,
          Collections,
          Collection,
          EntityName
        > &
          ClusteredCollectionQueryOperations<
            Pick<
              ClusteredCompositeAttributes<
                E,
                Collections,
                Collection,
                EntityName
              >,
              OptionalPropertyOf<
                ClusteredCompositeAttributes<
                  E,
                  Collections,
                  Collection,
                  EntityName
                >
              >
            >,
            ClusteredCollectionOperations<
              E,
              Collections,
              Collection,
              EntityName
            >
          >
      : never;
  }[keyof E];
};

export type IsolatedCollectionQueries<
  E extends { [name: string]: Entity<any, any, any, any> },
  Collections extends IsolatedCollectionAssociations<E>,
> = {
  [Collection in keyof Collections]: {
    [EntityName in keyof E]: EntityName extends Collections[Collection]
      ? (
          params: RequiredProperties<
            Parameters<
              E[EntityName]["query"][E[EntityName] extends Entity<
                infer A,
                infer F,
                infer C,
                infer S
              >
                ? Collection extends keyof IsolatedEntityCollections<A, F, C, S>
                  ? IsolatedEntityCollections<A, F, C, S>[Collection]
                  : never
                : never]
            >[0]
          >,
        ) => {
          go: ServiceQueryRecordsGo<{
            [EntityResultName in Collections[Collection]]: EntityResultName extends keyof E
              ? E[EntityResultName] extends Entity<
                  infer A,
                  infer F,
                  infer C,
                  infer S
                >
                ? ResponseItem<A, F, C, S>[]
                : never
              : never;
          }>;
          params: ParamRecord;
          where: {
            [EntityResultName in Collections[Collection]]: EntityResultName extends keyof E
              ? E[EntityResultName] extends Entity<
                  infer A,
                  infer F,
                  infer C,
                  infer S
                >
                ? Pick<
                    AllEntityAttributes<E>,
                    Extract<
                      AllEntityAttributeNames<E>,
                      IsolatedCollectionAttributes<E, Collections>[Collection]
                    >
                  > extends Partial<AllEntityAttributes<E>>
                  ? CollectionWhereClause<
                      E,
                      A,
                      F,
                      C,
                      S,
                      Pick<
                        AllEntityAttributes<E>,
                        Extract<
                          AllEntityAttributeNames<E>,
                          IsolatedCollectionAttributes<
                            E,
                            Collections
                          >[Collection]
                        >
                      >,
                      ServiceWhereRecordsActionOptions<
                        E,
                        A,
                        F,
                        C,
                        S,
                        Pick<
                          AllEntityAttributes<E>,
                          Extract<
                            AllEntityAttributeNames<E>,
                            IsolatedCollectionAttributes<
                              E,
                              Collections
                            >[Collection]
                          >
                        >,
                        {
                          [EntityResultName in Collections[Collection]]: EntityResultName extends keyof E
                            ? E[EntityResultName] extends Entity<
                                infer A,
                                infer F,
                                infer C,
                                infer S
                              >
                              ? ResponseItem<A, F, C, S>[]
                              : never
                            : never;
                        },
                        Partial<
                          Spread<
                            Collection extends keyof IsolatedCollectionPageAttributes<
                              E,
                              Collections
                            >
                              ? IsolatedCollectionPageAttributes<
                                  E,
                                  Collections
                                >[Collection]
                              : {},
                            Collection extends keyof IsolatedCollectionIndexAttributes<
                              E,
                              Collections
                            >
                              ? IsolatedCollectionIndexAttributes<
                                  E,
                                  Collections
                                >[Collection]
                              : {}
                          >
                        >
                      >
                    >
                  : never
                : never
              : never;
          }[Collections[Collection]];
        }
      : never;
  }[keyof E];
};

export type ElectroDBMethodTypes =
  | "put"
  | "get"
  | "query"
  | "scan"
  | "update"
  | "delete"
  | "remove"
  | "patch"
  | "create"
  | "batchGet"
  | "batchWrite";

export interface ElectroQueryEvent<P extends any = any> {
  type: "query";
  method: ElectroDBMethodTypes;
  config: any;
  params: P;
}

export interface ElectroResultsEvent<R extends any = any> {
  type: "results";
  method: ElectroDBMethodTypes;
  config: any;
  results: R;
  success: boolean;
}

export type ElectroEvent = ElectroQueryEvent | ElectroResultsEvent;

export type ElectroEventType = Pick<ElectroEvent, "type">;

export type ElectroEventListener = (event: ElectroEvent) => void;

// todo: coming soon, more events!
// | {
//     name: "error";
//     type: "configuration_error" | "invalid_query" | "dynamodb_client";
//     message: string;
//     details: ElectroError;
// } | {
//     name: "error";
//     type: "user_defined";
//     message: string;
//     details: ElectroValidationError;
// } | {
//     name: "warn";
//     type: "deprecation_warning" | "optimization_suggestion";
//     message: string;
//     details: any;
// } | {
//     name: "info";
//     type: "client_updated" | "table_overwritten";
//     message: string;
//     details: any;
// };

export type EntityIdentifiers<E extends Entity<any, any, any, any>> =
  E extends Entity<infer A, infer F, infer C, infer S>
    ? AllTableIndexCompositeAttributes<A, F, C, S>
    : never;

export type EntityItem<E extends Entity<any, any, any, any>> = E extends Entity<
  infer A,
  infer F,
  infer C,
  infer S
>
  ? ResponseItem<A, F, C, S>
  : never;

export type CreateEntityItem<E extends Entity<any, any, any, any>> =
  E extends Entity<infer A, infer F, infer C, infer S>
    ? PutItem<A, F, C, S>
    : never;

export type BatchWriteEntityItem<E extends Entity<any, any, any, any>> =
  E extends Entity<infer A, infer F, infer C, infer S>
    ? PutItem<A, F, C, S>[]
    : never;

export type BatchGetEntityItem<E extends Entity<any, any, any, any>> =
  E extends Entity<infer A, infer F, infer C, infer S>
    ? ResponseItem<A, F, C, S>[]
    : never;

export type UpdateEntityResponseItem<E extends Entity<any, any, any, any>> =
  E extends Entity<infer A, infer F, infer C, infer S>
    ? AllTableIndexCompositeAttributes<A, F, C, S>
    : never;

export type UpdateEntityItem<E extends Entity<any, any, any, any>> =
  E extends Entity<infer A, infer F, infer C, infer S>
    ? SetItem<A, F, C, S>
    : never;

export type UpdateAddEntityItem<E extends Entity<any, any, any, any>> =
  E extends Entity<infer A, infer F, infer C, infer S>
    ? AddItem<A, F, C, S>
    : never;

export type UpdateSubtractEntityItem<E extends Entity<any, any, any, any>> =
  E extends Entity<infer A, infer F, infer C, infer S>
    ? SubtractItem<A, F, C, S>
    : never;

export type UpdateAppendEntityItem<E extends Entity<any, any, any, any>> =
  E extends Entity<infer A, infer F, infer C, infer S>
    ? AppendItem<A, F, C, S>
    : never;

export type UpdateRemoveEntityItem<E extends Entity<any, any, any, any>> =
  E extends Entity<infer A, infer F, infer C, infer S>
    ? RemoveItem<A, F, C, S>
    : never;

export type UpdateDeleteEntityItem<E extends Entity<any, any, any, any>> =
  E extends Entity<infer A, infer F, infer C, infer S>
    ? DeleteItem<A, F, C, S>
    : never;

export type EntityRecord<E extends Entity<any, any, any, any>> =
  E extends Entity<infer A, infer F, infer C, infer S>
    ? Item<A, F, C, S, S["attributes"]>
    : never;

export type CollectionItem<
  SERVICE extends Service<any>,
  COLLECTION extends keyof SERVICE["collections"],
> = SERVICE extends Service<infer E>
  ? Pick<
      {
        [EntityName in keyof E]: E[EntityName] extends Entity<
          infer A,
          infer F,
          infer C,
          infer S
        >
          ? COLLECTION extends keyof CollectionAssociations<E>
            ? EntityName extends CollectionAssociations<E>[COLLECTION]
              ? ResponseItem<A, F, C, S>[]
              : never
            : never
          : never;
      },
      COLLECTION extends keyof CollectionAssociations<E>
        ? CollectionAssociations<E>[COLLECTION]
        : never
    >
  : never;

export type QueryResponse<E extends Entity<any, any, any, any>> = {
  data: EntityItem<E>[];
  cursor: string | null;
};

export type CreateEntityResponse<E extends Entity<any, any, any, any>> = {
  data: CreateEntityItem<E>;
};

export type BatchWriteResponse<E extends Entity<any, any, any, any>> =
  E extends Entity<infer A, infer F, infer C, infer S>
    ? {
        unprocessed: AllTableIndexCompositeAttributes<A, F, C, S>[];
      }
    : never;

export type BatchGetResponse<E extends Entity<any, any, any, any>> =
  E extends Entity<infer A, infer F, infer C, infer S>
    ? {
        data: EntityItem<E>[];
        unprocessed: AllTableIndexCompositeAttributes<A, F, C, S>[];
      }
    : never;

export type UpdateEntityResponse<E extends Entity<any, any, any, any>> = {
  data: UpdateEntityResponseItem<E>;
};
export type UpdateAddEntityResponse<E extends Entity<any, any, any, any>> = {
  data: UpdateAddEntityItem<E>;
};
export type UpdateSubtractEntityResponse<E extends Entity<any, any, any, any>> =
  {
    data: UpdateSubtractEntityItem<E>;
  };
export type UpdateAppendEntityResponse<E extends Entity<any, any, any, any>> = {
  data: UpdateAppendEntityItem<E>;
};
export type UpdateRemoveEntityResponse<E extends Entity<any, any, any, any>> = {
  data: UpdateRemoveEntityItem<E>;
};
export type UpdateDeleteEntityResponse<E extends Entity<any, any, any, any>> = {
  data: UpdateDeleteEntityItem<E>;
};

export type CollectionResponse<
  SERVICE extends Service<any>,
  COLLECTION extends keyof SERVICE["collections"],
> = {
  data: CollectionItem<SERVICE, COLLECTION>;
  cursor: string | null;
};

export interface QueryBranches<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseItem,
  IndexCompositeAttributes,
> {
  go: GoQueryTerminal<A, F, C, S, ResponseItem>;
  params: ParamTerminal<A, F, C, S, ResponseItem>;
  where: WhereClause<
    A,
    F,
    C,
    S,
    Item<A, F, C, S, S["attributes"]>,
    QueryBranches<A, F, C, S, ResponseItem, IndexCompositeAttributes>
  >;
}

export interface RecordsActionOptions<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseItem,
  IndexCompositeAttributes,
> {
  go: QueryRecordsGo<ResponseItem>;
  params: ParamRecord;
  where: WhereClause<
    A,
    F,
    C,
    S,
    Item<A, F, C, S, S["attributes"]>,
    RecordsActionOptions<A, F, C, S, ResponseItem, IndexCompositeAttributes>
  >;
}

export type TransactionItemCode =
  | "None"
  | "ConditionalCheckFailed"
  | "ItemCollectionSizeLimitExceeded"
  | "TransactionConflict"
  | "ProvisionedThroughputExceeded"
  | "ThrottlingError"
  | "ValidationError";

export type TransactionItem<T> = {
  item: null | T;
  rejected: boolean;
  code: TransactionItemCode;
  message?: string | undefined;
};

type CommittedTransactionResult<T, Params> = Params & {
  [TransactionSymbol]: T;
};

export interface SingleRecordOperationOptions<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseType,
> {
  go: GoGetTerminal<A, F, C, S, ResponseType>;
  params: ParamTerminal<A, F, C, S, ResponseType>;
  where: WhereClause<
    A,
    F,
    C,
    S,
    Item<A, F, C, S, S["attributes"]>,
    SingleRecordOperationOptions<A, F, C, S, ResponseType>
  >;
}

type GoGetTerminalTransaction<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseItem,
  Params,
> = <Options extends TransactGetQueryOptions<keyof ResponseItem>>(
  options?: Options,
) => Options extends GoQueryTerminalOptions<infer Attr>
  ? CommittedTransactionResult<
      {
        [Name in keyof ResponseItem as Name extends Attr
          ? Name
          : never]: ResponseItem[Name];
      },
      Params
    >
  : CommittedTransactionResult<ResponseItem, Params>;

type GoSingleTerminalTransaction<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseItem,
  Params,
> = <Options extends TransactWriteQueryOptions>(
  options?: Options,
) => CommittedTransactionResult<ResponseItem, Params>;

export interface SingleRecordOperationOptionsTransaction<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseType,
  Params,
> {
  commit: GoSingleTerminalTransaction<A, F, C, S, ResponseType, Params>;
  where: WhereClause<
    A,
    F,
    C,
    S,
    Item<A, F, C, S, S["attributes"]>,
    SingleRecordOperationOptionsTransaction<A, F, C, S, ResponseType, Params>
  >;
}

export interface GetOperationOptionsTransaction<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseType,
  Params,
> {
  commit: GoGetTerminalTransaction<A, F, C, S, ResponseType, Params>;
}

export type DeleteRecordOperationGoTransaction<
  ResponseType,
  Options = TransactWriteQueryOptions,
> = <T = ResponseType>(
  options?: Options,
) => CommittedTransactionResult<T, TransactWriteItem>;

export interface DeleteRecordOperationOptionsTransaction<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseType,
> {
  commit: DeleteRecordOperationGoTransaction<
    ResponseType,
    TransactWriteQueryOptions
  >;
  where: WhereClause<
    A,
    F,
    C,
    S,
    Item<A, F, C, S, S["attributes"]>,
    DeleteRecordOperationOptionsTransaction<A, F, C, S, ResponseType>
  >;
}

export type PutRecordGoTransaction<
  ResponseType,
  Options = TransactWriteQueryOptions,
> = <T = ResponseType>(
  options?: Options,
) => CommittedTransactionResult<T, TransactWriteItem>;

export interface PutRecordOperationOptionsTransaction<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseType,
> {
  commit: PutRecordGoTransaction<ResponseType, TransactWriteQueryOptions>;
  where: WhereClause<
    A,
    F,
    C,
    S,
    Item<A, F, C, S, S["attributes"]>,
    PutRecordOperationOptionsTransaction<A, F, C, S, ResponseType>
  >;
}

export type UpdateRecordGoTransaction<ResponseType> = <
  T = ResponseType,
  Options extends TransactWriteQueryOptions = TransactWriteQueryOptions,
>(
  options?: Options,
) => CommittedTransactionResult<Partial<T>, TransactWriteItem>;

export interface SetRecordActionOptionsTransaction<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  SetAttr,
  IndexCompositeAttributes,
  TableItem,
> {
  commit: UpdateRecordGoTransaction<TableItem>;
  params: ParamRecord<UpdateQueryParams>;
  set: SetRecordTransaction<
    A,
    F,
    C,
    S,
    SetItem<A, F, C, S>,
    IndexCompositeAttributes,
    TableItem
  >;
  remove: RemoveRecordTransaction<
    A,
    F,
    C,
    S,
    Array<keyof SetItem<A, F, C, S>>,
    IndexCompositeAttributes,
    TableItem
  >;
  add: SetRecordTransaction<
    A,
    F,
    C,
    S,
    AddItem<A, F, C, S>,
    IndexCompositeAttributes,
    TableItem
  >;
  subtract: SetRecordTransaction<
    A,
    F,
    C,
    S,
    SubtractItem<A, F, C, S>,
    IndexCompositeAttributes,
    TableItem
  >;
  append: SetRecordTransaction<
    A,
    F,
    C,
    S,
    AppendItem<A, F, C, S>,
    IndexCompositeAttributes,
    TableItem
  >;
  delete: SetRecordTransaction<
    A,
    F,
    C,
    S,
    DeleteItem<A, F, C, S>,
    IndexCompositeAttributes,
    TableItem
  >;
  data: DataUpdateMethodRecordTransaction<
    A,
    F,
    C,
    S,
    Item<A, F, C, S, S["attributes"]>,
    IndexCompositeAttributes,
    TableItem
  >;
  composite: UpdateComposite<
    A,
    F,
    C,
    S,
    SetRecordActionOptionsTransaction<
      A,
      F,
      C,
      S,
      SetAttr,
      IndexCompositeAttributes,
      TableItem
    >
  >;
  where: WhereClause<
    A,
    F,
    C,
    S,
    Item<A, F, C, S, S["attributes"]>,
    SetRecordActionOptionsTransaction<
      A,
      F,
      C,
      S,
      SetAttr,
      IndexCompositeAttributes,
      TableItem
    >
  >;
}

export type RemoveRecordTransaction<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  RemoveAttr,
  IndexCompositeAttributes,
  TableItem,
> = (
  properties: RemoveAttr,
) => SetRecordActionOptionsTransaction<
  A,
  F,
  C,
  S,
  RemoveAttr,
  IndexCompositeAttributes,
  TableItem
>;

export type SetRecordTransaction<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  SetAttr,
  IndexCompositeAttributes,
  TableItem,
> = (
  properties: SetAttr,
) => SetRecordActionOptionsTransaction<
  A,
  F,
  C,
  S,
  SetAttr,
  IndexCompositeAttributes,
  TableItem
>;

export type DataUpdateMethodRecordTransaction<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  SetAttr,
  IndexCompositeAttributes,
  TableItem,
> = DataUpdateMethod<
  A,
  F,
  C,
  S,
  UpdateData<A, F, C, S>,
  SetRecordActionOptionsTransaction<
    A,
    F,
    C,
    S,
    SetAttr,
    IndexCompositeAttributes,
    TableItem
  >
>;

export interface BatchGetRecordOperationOptions<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseType,
> {
  go: GoBatchGetTerminal<A, F, C, S, ResponseType>;
  params: ParamTerminal<A, F, C, S, ResponseType>;
}

export interface PutRecordOperationOptions<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseType,
> {
  go: PutRecordGo<ResponseType>;
  params: ParamRecord<PutQueryOptions>;
  where: WhereClause<
    A,
    F,
    C,
    S,
    Item<A, F, C, S, S["attributes"]>,
    PutRecordOperationOptions<A, F, C, S, ResponseType>
  >;
}

type RequiredKeys<T> = Exclude<
  { [K in keyof T]-?: {} extends Pick<T, K> ? never : K }[keyof T],
  symbol
>;

type OverlappingProperties<T1, T2> = {
  [Key in keyof T1 as Key extends keyof T2 ? Key : never]: Key extends keyof T2
    ? T2[Key]
    : never;
};

type NonOverlappingProperties<T1, T2> = {
  [Key in keyof T1 as Key extends keyof T2 ? never : Key]: T1[Key];
};

export type UpsertRecordOperationOptionsTransaction<
    A extends string,
    F extends string,
    C extends string,
    S extends Schema<A, F, C>,
    ResponseType,
    FullExpectedItem,
    RemainingExpectedItem,
    ProvidedItem,
> =
    [RequiredKeys<RemainingExpectedItem>] extends [never]
        ? {
          commit: PutRecordGoTransaction<ResponseType, TransactWriteQueryOptions>;

          where: WhereClause<
              A,
              F,
              C,
              S,
              Item<A, F, C, S, S["attributes"]>,
              UpsertRecordOperationOptionsTransaction<
                  A,
                  F,
                  C,
                  S,
                  ResponseType,
                  FullExpectedItem,
                  RemainingExpectedItem,
                  ProvidedItem
              >
          >;

          set: <
              ReceivedItem extends Partial<
                  OverlappingProperties<RemainingExpectedItem, PutItem<A, F, C, S>>
              >,
          >(
              item: ReceivedItem,
          ) => UpsertRecordOperationOptionsTransaction<
              A,
              F,
              C,
              S,
              ResponseType,
              FullExpectedItem,
              NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
              NonOverlappingProperties<ProvidedItem, ReceivedItem>
          >;
          ifNotExists: <
              ReceivedItem extends Partial<
                  OverlappingProperties<RemainingExpectedItem, PutItem<A, F, C, S>>
              >,
          >(
              item: ReceivedItem,
          ) => UpsertRecordOperationOptionsTransaction<
              A,
              F,
              C,
              S,
              ResponseType,
              FullExpectedItem,
              NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
              NonOverlappingProperties<ProvidedItem, ReceivedItem>
          >;
          add: <
              ReceivedItem extends Partial<
                  OverlappingProperties<RemainingExpectedItem, AddItem<A, F, C, S>>
              >,
          >(
              item: ReceivedItem,
          ) => UpsertRecordOperationOptionsTransaction<
              A,
              F,
              C,
              S,
              ResponseType,
              FullExpectedItem,
              NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
              NonOverlappingProperties<ProvidedItem, ReceivedItem>
          >;
          subtract: <
              ReceivedItem extends Partial<
                  OverlappingProperties<
                      RemainingExpectedItem,
                      SubtractItem<A, F, C, S>
                  >
              >,
          >(
              item: ReceivedItem,
          ) => UpsertRecordOperationOptionsTransaction<
              A,
              F,
              C,
              S,
              ResponseType,
              FullExpectedItem,
              NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
              NonOverlappingProperties<ProvidedItem, ReceivedItem>
          >;
          append: <
              ReceivedItem extends Partial<
                  OverlappingProperties<RemainingExpectedItem, AppendItem<A, F, C, S>>
              >,
          >(
              item: ReceivedItem,
          ) => UpsertRecordOperationOptionsTransaction<
              A,
              F,
              C,
              S,
              ResponseType,
              FullExpectedItem,
              NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
              NonOverlappingProperties<ProvidedItem, ReceivedItem>
          >;
        }
        : {
          // these are strings to give context to the user this is a builder pattern
          commit:
              | `Missing required attributes to perform upsert`
              | `Required: ${RequiredKeys<RemainingExpectedItem>}`;

          where: WhereClause<
              A,
              F,
              C,
              S,
              Item<A, F, C, S, S["attributes"]>,
              UpsertRecordOperationOptionsTransaction<
                  A,
                  F,
                  C,
                  S,
                  ResponseType,
                  FullExpectedItem,
                  RemainingExpectedItem,
                  ProvidedItem
              >
          >;

          set: <
              ReceivedItem extends Partial<
                  OverlappingProperties<RemainingExpectedItem, PutItem<A, F, C, S>>
              >,
          >(
              item: ReceivedItem,
          ) => UpsertRecordOperationOptionsTransaction<
              A,
              F,
              C,
              S,
              ResponseType,
              FullExpectedItem,
              NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
              NonOverlappingProperties<ProvidedItem, ReceivedItem>
          >;
          ifNotExists: <
              ReceivedItem extends Partial<
                  OverlappingProperties<RemainingExpectedItem, PutItem<A, F, C, S>>
              >,
          >(
              item: ReceivedItem,
          ) => UpsertRecordOperationOptionsTransaction<
              A,
              F,
              C,
              S,
              ResponseType,
              FullExpectedItem,
              NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
              NonOverlappingProperties<ProvidedItem, ReceivedItem>
          >;
          add: <
              ReceivedItem extends Partial<
                  OverlappingProperties<RemainingExpectedItem, AddItem<A, F, C, S>>
              >,
          >(
              item: ReceivedItem,
          ) => UpsertRecordOperationOptionsTransaction<
              A,
              F,
              C,
              S,
              ResponseType,
              FullExpectedItem,
              NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
              NonOverlappingProperties<ProvidedItem, ReceivedItem>
          >;
          subtract: <
              ReceivedItem extends Partial<
                  OverlappingProperties<
                      RemainingExpectedItem,
                      SubtractItem<A, F, C, S>
                  >
              >,
          >(
              item: ReceivedItem,
          ) => UpsertRecordOperationOptionsTransaction<
              A,
              F,
              C,
              S,
              ResponseType,
              FullExpectedItem,
              NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
              NonOverlappingProperties<ProvidedItem, ReceivedItem>
          >;
          append: <
              ReceivedItem extends Partial<
                  OverlappingProperties<RemainingExpectedItem, AppendItem<A, F, C, S>>
              >,
          >(
              item: ReceivedItem,
          ) => UpsertRecordOperationOptionsTransaction<
              A,
              F,
              C,
              S,
              ResponseType,
              FullExpectedItem,
              NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
              NonOverlappingProperties<ProvidedItem, ReceivedItem>
          >;
        };


export type UpsertRecordOperationOptions<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseType,
  FullExpectedItem,
  RemainingExpectedItem,
  ProvidedItem,
> =
  [RequiredKeys<RemainingExpectedItem>] extends [never]
    ? {
        go: UpsertRecordGo<
          ResponseType,
          AllTableIndexCompositeAttributes<A, F, C, S>
        >;
        params: ParamRecord<UpdateQueryParams>;

        where: WhereClause<
          A,
          F,
          C,
          S,
          Item<A, F, C, S, S["attributes"]>,
          UpsertRecordOperationOptions<
            A,
            F,
            C,
            S,
            ResponseType,
            FullExpectedItem,
            RemainingExpectedItem,
            ProvidedItem
          >
        >;

        set: <
          ReceivedItem extends Partial<
            OverlappingProperties<RemainingExpectedItem, PutItem<A, F, C, S>>
          >,
        >(
          item: ReceivedItem,
        ) => UpsertRecordOperationOptions<
          A,
          F,
          C,
          S,
          ResponseType,
          FullExpectedItem,
          NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
          NonOverlappingProperties<ProvidedItem, ReceivedItem>
        >;
        ifNotExists: <
          ReceivedItem extends Partial<
            OverlappingProperties<RemainingExpectedItem, PutItem<A, F, C, S>>
          >,
        >(
          item: ReceivedItem,
        ) => UpsertRecordOperationOptions<
          A,
          F,
          C,
          S,
          ResponseType,
          FullExpectedItem,
          NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
          NonOverlappingProperties<ProvidedItem, ReceivedItem>
        >;
        add: <
          ReceivedItem extends Partial<
            OverlappingProperties<RemainingExpectedItem, AddItem<A, F, C, S>>
          >,
        >(
          item: ReceivedItem,
        ) => UpsertRecordOperationOptions<
          A,
          F,
          C,
          S,
          ResponseType,
          FullExpectedItem,
          NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
          NonOverlappingProperties<ProvidedItem, ReceivedItem>
        >;
        subtract: <
          ReceivedItem extends Partial<
            OverlappingProperties<
              RemainingExpectedItem,
              SubtractItem<A, F, C, S>
            >
          >,
        >(
          item: ReceivedItem,
        ) => UpsertRecordOperationOptions<
          A,
          F,
          C,
          S,
          ResponseType,
          FullExpectedItem,
          NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
          NonOverlappingProperties<ProvidedItem, ReceivedItem>
        >;
        append: <
          ReceivedItem extends Partial<
            OverlappingProperties<RemainingExpectedItem, AppendItem<A, F, C, S>>
          >,
        >(
          item: ReceivedItem,
        ) => UpsertRecordOperationOptions<
          A,
          F,
          C,
          S,
          ResponseType,
          FullExpectedItem,
          NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
          NonOverlappingProperties<ProvidedItem, ReceivedItem>
        >;
      }
    : {
        // these are strings to give context to the user this is a builder pattern
        go:
          | `Missing required attributes to perform upsert`
          | `Required: ${RequiredKeys<RemainingExpectedItem>}`;
        params:
          | `Missing required attributes to perform upsert`
          | `Required: ${RequiredKeys<RemainingExpectedItem>}`;

        where: WhereClause<
          A,
          F,
          C,
          S,
          Item<A, F, C, S, S["attributes"]>,
          UpsertRecordOperationOptions<
            A,
            F,
            C,
            S,
            ResponseType,
            FullExpectedItem,
            RemainingExpectedItem,
            ProvidedItem
          >
        >;

        set: <
          ReceivedItem extends Partial<
            OverlappingProperties<RemainingExpectedItem, PutItem<A, F, C, S>>
          >,
        >(
          item: ReceivedItem,
        ) => UpsertRecordOperationOptions<
          A,
          F,
          C,
          S,
          ResponseType,
          FullExpectedItem,
          NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
          NonOverlappingProperties<ProvidedItem, ReceivedItem>
        >;
        ifNotExists: <
          ReceivedItem extends Partial<
            OverlappingProperties<RemainingExpectedItem, PutItem<A, F, C, S>>
          >,
        >(
          item: ReceivedItem,
        ) => UpsertRecordOperationOptions<
          A,
          F,
          C,
          S,
          ResponseType,
          FullExpectedItem,
          NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
          NonOverlappingProperties<ProvidedItem, ReceivedItem>
        >;
        add: <
          ReceivedItem extends Partial<
            OverlappingProperties<RemainingExpectedItem, AddItem<A, F, C, S>>
          >,
        >(
          item: ReceivedItem,
        ) => UpsertRecordOperationOptions<
          A,
          F,
          C,
          S,
          ResponseType,
          FullExpectedItem,
          NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
          NonOverlappingProperties<ProvidedItem, ReceivedItem>
        >;
        subtract: <
          ReceivedItem extends Partial<
            OverlappingProperties<
              RemainingExpectedItem,
              SubtractItem<A, F, C, S>
            >
          >,
        >(
          item: ReceivedItem,
        ) => UpsertRecordOperationOptions<
          A,
          F,
          C,
          S,
          ResponseType,
          FullExpectedItem,
          NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
          NonOverlappingProperties<ProvidedItem, ReceivedItem>
        >;
        append: <
          ReceivedItem extends Partial<
            OverlappingProperties<RemainingExpectedItem, AppendItem<A, F, C, S>>
          >,
        >(
          item: ReceivedItem,
        ) => UpsertRecordOperationOptions<
          A,
          F,
          C,
          S,
          ResponseType,
          FullExpectedItem,
          NonOverlappingProperties<RemainingExpectedItem, ReceivedItem>,
          NonOverlappingProperties<ProvidedItem, ReceivedItem>
        >;
      };

export interface DeleteRecordOperationOptions<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseType,
> {
  go: DeleteRecordOperationGo<
    ResponseType,
    AllTableIndexCompositeAttributes<A, F, C, S>
  >;
  params: ParamRecord<DeleteQueryOptions>;
  where: WhereClause<
    A,
    F,
    C,
    S,
    Item<A, F, C, S, S["attributes"]>,
    DeleteRecordOperationOptions<A, F, C, S, ResponseType>
  >;
}

export interface BatchWriteOperationOptions<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseType,
> {
  go: BatchWriteGo<ResponseType>;
  params: ParamRecord<BulkOptions>;
}

export interface SetRecordActionOptions<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  SetAttr,
  IndexCompositeAttributes,
  TableItem,
> {
  go: UpdateRecordGo<TableItem, AllTableIndexCompositeAttributes<A, F, C, S>>;
  params: ParamRecord<UpdateQueryParams>;
  set: SetRecord<
    A,
    F,
    C,
    S,
    SetItem<A, F, C, S>,
    IndexCompositeAttributes,
    TableItem
  >;
  // ifNotExists: SetRecord<A,F,C,S, SetItem<A,F,C,S>,IndexCompositeAttributes,TableItem>;
  remove: SetRecord<
    A,
    F,
    C,
    S,
    Array<keyof SetItem<A, F, C, S>>,
    IndexCompositeAttributes,
    TableItem
  >;
  add: SetRecord<
    A,
    F,
    C,
    S,
    AddItem<A, F, C, S>,
    IndexCompositeAttributes,
    TableItem
  >;
  subtract: SetRecord<
    A,
    F,
    C,
    S,
    SubtractItem<A, F, C, S>,
    IndexCompositeAttributes,
    TableItem
  >;
  append: SetRecord<
    A,
    F,
    C,
    S,
    AppendItem<A, F, C, S>,
    IndexCompositeAttributes,
    TableItem
  >;
  delete: SetRecord<
    A,
    F,
    C,
    S,
    DeleteItem<A, F, C, S>,
    IndexCompositeAttributes,
    TableItem
  >;
  composite: UpdateComposite<
    A,
    F,
    C,
    S,
    SetRecordActionOptions<
      A,
      F,
      C,
      S,
      SetAttr,
      IndexCompositeAttributes,
      TableItem
    >
  >;
  data: DataUpdateMethodRecord<
    A,
    F,
    C,
    S,
    Item<A, F, C, S, S["attributes"]>,
    IndexCompositeAttributes,
    TableItem
  >;
  where: WhereClause<
    A,
    F,
    C,
    S,
    Item<A, F, C, S, S["attributes"]>,
    SetRecordActionOptions<
      A,
      F,
      C,
      S,
      SetAttr,
      IndexCompositeAttributes,
      TableItem
    >
  >;
}

export type SetRecord<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  SetAttr,
  IndexCompositeAttributes,
  TableItem,
> = (
  properties: SetAttr,
) => SetRecordActionOptions<
  A,
  F,
  C,
  S,
  SetAttr,
  IndexCompositeAttributes,
  TableItem
>;

export type RemoveRecord<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  RemoveAttr,
  IndexCompositeAttributes,
  TableItem,
> = (
  properties: RemoveAttr,
) => SetRecordActionOptions<
  A,
  F,
  C,
  S,
  RemoveAttr,
  IndexCompositeAttributes,
  TableItem
>;

export type DataUpdateMethodRecord<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  SetAttr,
  IndexCompositeAttributes,
  TableItem,
> = DataUpdateMethod<
  A,
  F,
  C,
  S,
  UpdateData<A, F, C, S>,
  SetRecordActionOptions<
    A,
    F,
    C,
    S,
    SetAttr,
    IndexCompositeAttributes,
    TableItem
  >
>;

interface QueryOperations<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  CompositeAttributes,
  ResponseItem,
  IndexCompositeAttributes,
> {
  between: (
    skCompositeAttributesStart: CompositeAttributes,
    skCompositeAttributesEnd: CompositeAttributes,
  ) => QueryBranches<A, F, C, S, ResponseItem, IndexCompositeAttributes>;
  gt: (
    skCompositeAttributes: CompositeAttributes,
  ) => QueryBranches<A, F, C, S, ResponseItem, IndexCompositeAttributes>;
  gte: (
    skCompositeAttributes: CompositeAttributes,
  ) => QueryBranches<A, F, C, S, ResponseItem, IndexCompositeAttributes>;
  lt: (
    skCompositeAttributes: CompositeAttributes,
  ) => QueryBranches<A, F, C, S, ResponseItem, IndexCompositeAttributes>;
  lte: (
    skCompositeAttributes: CompositeAttributes,
  ) => QueryBranches<A, F, C, S, ResponseItem, IndexCompositeAttributes>;
  begins: (
    skCompositeAttributes: CompositeAttributes,
  ) => QueryBranches<A, F, C, S, ResponseItem, IndexCompositeAttributes>;
  go: GoQueryTerminal<A, F, C, S, ResponseItem>;
  params: ParamTerminal<A, F, C, S, ResponseItem>;
  where: WhereClause<
    A,
    F,
    C,
    S,
    Item<A, F, C, S, S["attributes"]>,
    QueryBranches<A, F, C, S, ResponseItem, IndexCompositeAttributes>
  >;
}

type IndexKeyComposite<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends keyof S["indexes"],
> = IndexCompositeAttributes<A, F, C, S, I> &
  TableIndexCompositeAttributes<A, F, C, S>;

type IndexKeyCompositeWithMaybeTableIndex<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends keyof S["indexes"],
> = IndexCompositeAttributes<A, F, C, S, I> &
  Partial<TableIndexCompositeAttributes<A, F, C, S>>;

type IndexKeyCompositeFromItem<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends keyof S["indexes"],
> = Partial<IndexCompositeAttributes<A, F, C, S, I>> &
  Partial<TableIndexCompositeAttributes<A, F, C, S>>;

type ConversionOptions = {
  strict?: "all" | "pk" | "none";
};

export type Conversions<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  fromComposite: {
    toCursor: (
      composite: {
        [I in keyof S["indexes"]]: IndexKeyCompositeWithMaybeTableIndex<
          A,
          F,
          C,
          S,
          I
        >;
      }[keyof S["indexes"]],
    ) => string;
    toKeys: <T = Record<string, string | number>>(
      composite: {
        [I in keyof S["indexes"]]: IndexKeyCompositeWithMaybeTableIndex<
          A,
          F,
          C,
          S,
          I
        >;
      }[keyof S["indexes"]],
      options?: ConversionOptions,
    ) => T;
  };
  fromKeys: {
    toComposite: <
      T = {
        [I in keyof S["indexes"]]: IndexKeyCompositeFromItem<A, F, C, S, I>;
      }[keyof S["indexes"]],
    >(
      keys: Record<string, string | number>,
    ) => T;
    toCursor: (keys: Record<string, string | number>) => string;
  };
  fromCursor: {
    toKeys: <T = Record<string, string | number>>(cursor: string) => T;
    toComposite: <
      T = Partial<{
        [I in keyof S["indexes"]]: IndexKeyCompositeFromItem<A, F, C, S, I>;
      }>[keyof S["indexes"]],
    >(
      cursor: string,
    ) => T;
  };
  byAccessPattern: {
    [I in keyof S["indexes"]]: {
      fromKeys: {
        toCursor: (keys: Record<string, string | number>) => string;
        // keys supplied may include the table index, maybe not so composite attributes for the table index are `Partial`
        toComposite: <T = IndexKeyCompositeWithMaybeTableIndex<A, F, C, S, I>>(
          keys: Record<string, string | number>,
          options?: ConversionOptions,
        ) => T;
      };
      fromCursor: {
        toKeys: <T = Record<string, string | number>>(
          cursor: string,
          options?: ConversionOptions,
        ) => T;
        // a cursor must have the table index defined along with the keys for the index (if applicable)
        toComposite: <T = IndexKeyComposite<A, F, C, S, I>>(
          cursor: string,
          options?: ConversionOptions,
        ) => T;
      };
      fromComposite: {
        // a cursor must have the table index defined along with the keys for the index (if applicable)
        toCursor: (
          composite: IndexKeyComposite<A, F, C, S, I>,
          options?: ConversionOptions,
        ) => string;
        // maybe the only keys you need are for this index and not the
        toKeys: <T = Record<string, string | number>>(
          composite: IndexKeyCompositeWithMaybeTableIndex<A, F, C, S, I>,
          options?: ConversionOptions,
        ) => T;
      };
    };
  };
};

export type Queries<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  [I in keyof S["indexes"]]: <
    CompositeAttributes extends IndexCompositeAttributes<A, F, C, S, I>,
  >(
    composite: CompositeAttributes,
  ) => IndexSKAttributes<A, F, C, S, I> extends infer SK
    ? // If there is no SK, dont show query operations (when an empty array is provided)
      [keyof SK] extends [never]
      ? QueryBranches<
          A,
          F,
          C,
          S,
          ResponseItem<A, F, C, S>,
          AllTableIndexCompositeAttributes<A, F, C, S> &
            Required<CompositeAttributes>
        >
      : // If there is no SK, dont show query operations (When no PK is specified)
      S["indexes"][I] extends IndexWithSortKey
      ? QueryOperations<
          A,
          F,
          C,
          S,
          // Omit the composite attributes already provided
          Omit<
            Partial<IndexSKAttributes<A, F, C, S, I>>,
            keyof CompositeAttributes
          >,
          ResponseItem<A, F, C, S>,
          AllTableIndexCompositeAttributes<A, F, C, S> &
            Required<CompositeAttributes> &
            SK
        >
      : QueryBranches<
          A,
          F,
          C,
          S,
          ResponseItem<A, F, C, S>,
          AllTableIndexCompositeAttributes<A, F, C, S> &
            Required<CompositeAttributes> &
            SK
        >
    : never;
};

export type ParseSingleInput =
  | {
      Item?: { [key: string]: any };
    }
  | {
      Attributes?: { [key: string]: any };
    }
  | null;

export type ParseMultiInput = {
  Items?: { [key: string]: any }[];
};

export type ReturnValues =
  | "default"
  | "none"
  | "all_old"
  | "updated_old"
  | "all_new"
  | "updated_new";

export interface QueryOptions {
  cursor?: string | null;
  params?: object;
  table?: string;
  limit?: number;
  count?: number;
  originalErr?: boolean;
  ignoreOwnership?: boolean;
  pages?: number | "all";
  listeners?: Array<ElectroEventListener>;
  logger?: ElectroEventListener;
  data?: "raw" | "includeKeys" | "attributes";
  order?: "asc" | "desc";
  consistent?: boolean;
}

// subset of QueryOptions
export interface ParseOptions<Attributes> {
  attributes?: ReadonlyArray<Attributes>;
  ignoreOwnership?: boolean;
}

export interface UpdateQueryOptions extends QueryOptions {
  response?:
    | "default"
    | "none"
    | "all_old"
    | "updated_old"
    | "all_new"
    | "updated_new";
}

export interface UpdateQueryParams {
  response?:
    | "default"
    | "none"
    | "all_old"
    | "updated_old"
    | "all_new"
    | "updated_new";
  table?: string;
  params?: object;
  originalErr?: boolean;
}

export interface DeleteQueryOptions extends QueryOptions {
  response?: "default" | "none" | "all_old";
}

export interface PutQueryOptions extends QueryOptions {
  response?: "default" | "none" | "all_old" | "all_new";
}

export type ParamOptions = {
  cursor?: string | null;
  params?: object;
  table?: string;
  limit?: number;
  response?:
    | "default"
    | "none"
    | "all_old"
    | "updated_old"
    | "all_new"
    | "updated_new";
  order?: "asc" | "desc";
  consistent?: boolean;
} & QueryExecutionComparisonParts;

export interface BulkOptions extends QueryOptions {
  unprocessed?: "raw" | "item";
  concurrency?: number;
  preserveBatchOrder?: boolean;
}

export type OptionalDefaultEntityIdentifiers = {
  __edb_e__?: string;
  __edb_v__?: string;
};

interface GoBatchGetTerminalOptions<Attributes> {
  data?: "raw" | "includeKeys" | "attributes";
  table?: string;
  limit?: number;
  params?: object;
  originalErr?: boolean;
  ignoreOwnership?: boolean;
  pages?: number;
  attributes?: ReadonlyArray<Attributes>;
  unprocessed?: "raw" | "item";
  concurrency?: number;
  preserveBatchOrder?: boolean;
  listeners?: Array<ElectroEventListener>;
  logger?: ElectroEventListener;
  consistent?: boolean;
}

export type ExecutionOptionCompare = "keys" | "attributes" | "v2";

export type QueryExecutionComparisonParts = {
  compare?: "keys" | "attributes"
} | {
  /**
   * @deprecated 'v2' exists to ease user migration to ElectroDB v3. Support for this option will eventually be dropped.
   */
  compare?: "v2"
}

type ServiceQueryGoTerminalOptions = {
  cursor?: string | null;
  data?: "raw" | "includeKeys" | "attributes";
  table?: string;
  limit?: number;
  params?: object;
  originalErr?: boolean;
  ignoreOwnership?: boolean;
  pages?: number | "all";
  listeners?: Array<ElectroEventListener>;
  logger?: ElectroEventListener;
  order?: "asc" | "desc";
  hydrate?: boolean;
  consistent?: boolean;
} & QueryExecutionComparisonParts;

type GoQueryTerminalOptions<Attributes> = {
  cursor?: string | null;
  data?: "raw" | "includeKeys" | "attributes";
  table?: string;
  limit?: number;
  count?: number;
  params?: object;
  originalErr?: boolean;
  ignoreOwnership?: boolean;
  pages?: number | "all";
  attributes?: ReadonlyArray<Attributes>;
  listeners?: Array<ElectroEventListener>;
  logger?: ElectroEventListener;
  order?: "asc" | "desc";
  hydrate?: boolean;
  consistent?: boolean;
} & QueryExecutionComparisonParts;

interface TransactWriteQueryOptions {
  data?: "raw" | "includeKeys" | "attributes";
  table?: string;
  params?: object;
  originalErr?: boolean;
  ignoreOwnership?: boolean;
  listeners?: Array<ElectroEventListener>;
  logger?: ElectroEventListener;
  response?: "all_old";
}

interface TransactGetQueryOptions<Attributes> {
  data?: "raw" | "includeKeys" | "attributes";
  table?: string;
  params?: object;
  originalErr?: boolean;
  ignoreOwnership?: boolean;
  attributes?: ReadonlyArray<Attributes>;
  listeners?: Array<ElectroEventListener>;
  logger?: ElectroEventListener;
  consistent?: boolean;
}

export type ParamTerminalOptions<Attributes> = {
  table?: string;
  limit?: number;
  params?: object;
  originalErr?: boolean;
  consistent?: boolean;
  attributes?: ReadonlyArray<Attributes>;
  response?:
    | "default"
    | "none"
    | "all_old"
    | "updated_old"
    | "all_new"
    | "updated_new";
  order?: "asc" | "desc";
} & QueryExecutionComparisonParts;

type GoBatchGetTerminal<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseItem,
> = <Options extends GoBatchGetTerminalOptions<keyof ResponseItem>>(
  options?: Options,
) => Options extends GoBatchGetTerminalOptions<infer Attr>
    ? "preserveBatchOrder" extends keyof Options
      ? Options["preserveBatchOrder"] extends true
        ? Promise<{
            data: Array<
              Resolve<
                | {
                    [Name in keyof ResponseItem as Name extends Attr
                      ? Name
                      : never]: ResponseItem[Name];
                  }
                | null
              >
            >;
            unprocessed: Array<
              Resolve<AllTableIndexCompositeAttributes<A, F, C, S>>
            >;
          }>
      : Promise<{
          data: Array<
            Resolve<{
              [Name in keyof ResponseItem as Name extends Attr
                ? Name
                : never]: ResponseItem[Name];
            }>
          >;
          unprocessed: Array<
            Resolve<AllTableIndexCompositeAttributes<A, F, C, S>>
          >;
        }>
    : Promise<{
        data: Array<
          Resolve<{
            [Name in keyof ResponseItem as Name extends Attr
              ? Name
              : never]: ResponseItem[Name];
          }>
        >;
        unprocessed: Array<
          Resolve<AllTableIndexCompositeAttributes<A, F, C, S>>
        >;
      }>
  : "preserveBatchOrder" extends keyof Options
    ? Options["preserveBatchOrder"] extends true
      ? Promise<{
          data: Array<Resolve<ResponseItem | null>>;
          unprocessed: Array<
            Resolve<AllTableIndexCompositeAttributes<A, F, C, S>>
          >;
        }>
      : Promise<{
          data: Array<Resolve<ResponseItem>>;
          unprocessed: Array<
            Resolve<AllTableIndexCompositeAttributes<A, F, C, S>>
          >;
        }>
    : Promise<{
        data: Array<Resolve<ResponseItem>>;
        unprocessed: Array<Resolve<AllTableIndexCompositeAttributes<A, F, C, S>>>;
      }>;

type GoGetTerminal<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseItem,
> = <Options extends GoQueryTerminalOptions<keyof ResponseItem>>(
  options?: Options,
) => Options extends GoQueryTerminalOptions<infer Attr>
  ? Promise<{
      data:
        | {
            [Name in keyof ResponseItem as Name extends Attr
              ? Name
              : never]: ResponseItem[Name];
          }
        | null;
    }>
  : Promise<{ data: ResponseItem | null }>;

export type GoQueryTerminal<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  Item,
> = <Options extends GoQueryTerminalOptions<keyof Item>>(
  options?: Options,
) => Options extends GoQueryTerminalOptions<infer Attr>
  ? Promise<{
      data: Array<{
        [Name in keyof Item as Name extends Attr ? Name : never]: Item[Name];
      }>;
      cursor: string | null;
    }>
  : Promise<{ data: Array<Item>; cursor: string | null }>;

export type EntityParseMultipleItems<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseItem,
> = <Options extends ParseOptions<keyof ResponseItem>>(
  item: ParseMultiInput,
  options?: Options,
) => Options extends ParseOptions<infer Attr>
  ? {
      data: Array<{
        [Name in keyof ResponseItem as Name extends Attr
          ? Name
          : never]: ResponseItem[Name];
      }>;
      cursor?: string | null;
    }
  : { data: Array<ResponseItem>; cursor?: string | null };

export type ParamTerminal<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  ResponseItem,
> = <
  P extends any = any,
  Options extends ParamTerminalOptions<
    keyof ResponseItem
  > = ParamTerminalOptions<keyof ResponseItem>,
>(
  options?: Options,
) => P;

export type ServiceQueryRecordsGo<
  ResponseType,
  Options = ServiceQueryGoTerminalOptions,
> = <T = ResponseType>(
  options?: Options,
) => Promise<{ data: T; cursor: string | null }>;

export type QueryRecordsGo<Item> = <Options extends GoQueryTerminalOptions<keyof Item>>(
  options?: Options,
) => Options extends GoQueryTerminalOptions<infer Attr>
  ? Promise<{
      data: Array<{
        [Name in keyof Item as Name extends Attr ? Name : never]: Item[Name];
      }>;
      cursor: string | null;
    }>
  : Promise<{ data: Array<Item>; cursor: string | null }>;

export type UpdateRecordGo<ResponseType, Keys> = <
  T = ResponseType,
  Options extends UpdateQueryOptions = UpdateQueryOptions,
>(
  options?: Options,
) => Options extends infer O
  ? "response" extends keyof O
    ? O["response"] extends "all_new"
      ? Promise<{ data: T }>
      : O["response"] extends "all_old"
      ? Promise<{ data: T }>
      : O["response"] extends "default"
      ? Promise<{ data: Keys }>
      : O["response"] extends "none"
      ? Promise<{ data: null }>
      : Promise<{ data: Partial<T> }>
    : Promise<{ data: Keys }>
  : never;

export type UpsertRecordGo<ResponseType, Keys> = <
  T = ResponseType,
  Options extends UpdateQueryOptions = UpdateQueryOptions,
>(
  options?: Options,
) => Options extends infer O
  ? "response" extends keyof O
    ? O["response"] extends "all_new"
      ? Promise<{ data: T }>
      : O["response"] extends "all_old"
      ? Promise<{ data: T }>
      : O["response"] extends "default"
      ? Promise<{ data: Keys }>
      : O["response"] extends "none"
      ? Promise<{ data: null }>
      : Promise<{ data: Partial<T> }>
    : Promise<{ data: Keys }>
  : never;

export type PutRecordGo<ResponseType> = <
  T = ResponseType,
  Options extends PutQueryOptions = PutQueryOptions,
>(
  options?: Options,
) => Promise<{ data: T }>;

export type DeleteRecordOperationGo<ResponseType, Keys> = <
  T = ResponseType,
  Options extends DeleteQueryOptions = DeleteQueryOptions,
>(
  options?: Options,
) => Options extends infer O
  ? "response" extends keyof O
    ? O["response"] extends "all_old"
      ? Promise<{ data: T | null }>
      : O["response"] extends "default"
        ? Promise<{ data: Keys }>
        : O["response"] extends "none"
          ? Promise<{ data: null }>
          : Promise<{ data: Keys | null }>
    : Promise<{ data: Keys  }>
  : never;

export type BatchWriteGo<ResponseType> = <O extends BulkOptions>(
  options?: O,
) => Promise<{ unprocessed: ResponseType }>;

export type ParamRecord<Options = ParamOptions> = <P = Record<string, any>>(
  options?: Options,
) => P;

export class ElectroError<E extends Error = Error> extends Error {
  readonly name: "ElectroError";
  readonly code: number;
  readonly date: number;
  readonly cause: E | undefined;
  readonly isElectroError: boolean;
  readonly params: <T = Record<string, unknown>>() => T | null;
  readonly ref: {
    readonly code: number;
    readonly section: string;
    readonly name: string;
    readonly sym: unique symbol;
  };
}

export interface ElectroValidationErrorFieldReference<T extends Error = Error> {
  /**
   * The json path to the attribute that had a validation error
   */
  readonly field: string;

  /**
   * A description of the validation error for that attribute
   */
  readonly reason: string;

  /**
   * Index of the value passed (present only in List attribute validation errors)
   */
  readonly index: number | undefined;

  /**
   * The error thrown from the attribute's validate callback (if applicable)
   */
  readonly cause: T | undefined;
}

export class ElectroValidationError<
  T extends Error = Error,
> extends ElectroError<T> {
  readonly fields: ReadonlyArray<ElectroValidationErrorFieldReference<T>>;
}

export interface ReadOnlyAttribute {
  readonly readOnly: true;
}

export interface RequiredAttribute {
  required: true;
}

export interface HiddenAttribute {
  readonly hidden: true;
}

export interface DefaultedAttribute {
  readonly default: any;
}

export interface SecondaryIndex {
  readonly index: string;
}

export interface NestedBooleanAttribute {
  readonly type: "boolean";
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (val: boolean, item: any) => boolean | undefined | void;
  readonly set?: (val?: boolean, item?: any) => boolean | undefined | void;
  readonly default?: boolean | (() => boolean);
  readonly validate?: ((val: boolean) => boolean)
  readonly field?: string;
}

export interface BooleanAttribute {
  readonly type: "boolean";
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (val: boolean, item: any) => boolean | undefined | void;
  readonly set?: (val?: boolean, item?: any) => boolean | undefined | void;
  readonly default?: boolean | (() => boolean);
  readonly validate?: ((val: boolean) => boolean)
  readonly field?: string;
  readonly label?: string;
  readonly watch?: ReadonlyArray<string> | "*";
  readonly padding?: {
    length: number;
    char: string;
  };
}

export interface NestedNumberAttribute {
  readonly type: "number";
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (val: number, item: any) => number | undefined | void;
  readonly set?: (val?: number, item?: any) => number | undefined | void;
  readonly default?: number | (() => number);
  readonly validate?: ((val: number) => boolean)
  readonly field?: string;
}

export interface NumberAttribute {
  readonly type: "number";
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (val: number, item: any) => number | undefined | void;
  readonly set?: (val?: number, item?: any) => number | undefined | void;
  readonly default?: number | (() => number);
  readonly validate?: ((val: number) => boolean)
  readonly field?: string;
  readonly label?: string;
  readonly watch?: ReadonlyArray<string> | "*";
  readonly padding?: {
    length: number;
    char: string;
  };
}

export interface NestedStringAttribute {
  readonly type: "string";
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (val: string, item: any) => string | undefined | void;
  readonly set?: (val?: string, item?: any) => string | undefined | void;
  readonly default?: string | (() => string);
  readonly validate?:
    | ((val: string) => boolean)
    | RegExp;
  readonly field?: string;
}

export interface StringAttribute {
  readonly type: "string";
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (val: string, item: any) => string | undefined | void;
  readonly set?: (val?: string, item?: any) => string | undefined | void;
  readonly default?: string | (() => string);
  readonly validate?:
    | ((val: string) => boolean)
    | RegExp;
  readonly field?: string;
  readonly label?: string;
  readonly watch?: ReadonlyArray<string> | "*";
  readonly padding?: {
    length: number;
    char: string;
  };
}

export interface NestedEnumAttribute {
  readonly type: ReadonlyArray<string>;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (val: any, item: any) => any | undefined | void;
  readonly set?: (val?: any, item?: any) => any | undefined | void;
  readonly default?: string | (() => string);
  readonly validate?: ((val: any) => boolean)
  readonly field?: string;
  readonly label?: string;
}

export interface EnumAttribute {
  readonly type: ReadonlyArray<string>;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (val: any, item: any) => any | undefined | void;
  readonly set?: (val?: any, item?: any) => any | undefined | void;
  readonly default?: string | (() => string);
  readonly validate?: ((val: any) => boolean)
  readonly field?: string;
  readonly label?: string;
  readonly watch?: ReadonlyArray<string> | "*";
}

export interface NestedAnyAttribute {
  readonly type: "any";
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (val: any, item: any) => any | undefined | void;
  readonly set?: (val?: any, item?: any) => any | undefined | void;
  readonly default?: any | (() => any);
  readonly validate?: ((val: any) => boolean)
  readonly field?: string;
}

export interface AnyAttribute {
  readonly type: "any";
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (val: any, item: any) => any | undefined | void;
  readonly set?: (val?: any, item?: any) => any | undefined | void;
  readonly default?: any | (() => any);
  readonly validate?: ((val: any) => boolean)
  readonly field?: string;
  readonly label?: string;
  readonly watch?: ReadonlyArray<string> | "*";
}

export interface NestedMapAttribute {
  readonly type: "map";
  readonly properties: {
    readonly [name: string]: NestedAttributes;
  };
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
    val: Record<string, any>,
    item: any,
  ) => Record<string, any> | undefined | void;
  readonly set?: (
    val?: Record<string, any>,
    item?: any,
  ) => Record<string, any> | undefined | void;
  readonly default?: Record<string, any> | (() => Record<string, any>);
  readonly validate?: ((val: Record<string, any>) => boolean)
  readonly field?: string;
}

export interface MapAttribute {
  readonly type: "map";
  readonly properties: {
    readonly [name: string]: NestedAttributes;
  };
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
    val: Record<string, any>,
    item: any,
  ) => Record<string, any> | undefined | void;
  readonly set?: (
    val?: Record<string, any>,
    item?: any,
  ) => Record<string, any> | undefined | void;
  readonly default?: Record<string, any> | (() => Record<string, any>);
  readonly validate?: ((val: Record<string, any>) => boolean)
  readonly field?: string;
  readonly watch?: ReadonlyArray<string> | "*";
}

export interface NestedCustomListAttribute {
  readonly type: "list";
  readonly items: CustomAttribute;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
      val: Array<any>,
      item: any,
  ) => Array<string> | undefined | void;
  readonly set?: (
      val?: Array<any>,
      item?: any,
  ) => Array<any> | undefined | void;
  readonly default?: Array<any> | (() => Array<any>);
  readonly validate?: ((val: Array<any>) => boolean)
}

export interface NestedStringListAttribute {
  readonly type: "list";
  readonly items: {
    readonly type: "string";
    readonly required?: boolean;
    readonly hidden?: boolean;
    readonly readOnly?: boolean;
    readonly get?: (val: string, item: any) => string | undefined | void;
    readonly set?: (val?: string, item?: any) => string | undefined | void;
    readonly default?: string | (() => string);
    readonly validate?:
      | ((val: string) => boolean)
      | RegExp;
    readonly field?: string;
  };
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
    val: Array<string>,
    item: any,
  ) => Array<string> | undefined | void;
  readonly set?: (
    val?: Array<string>,
    item?: any,
  ) => Array<string> | undefined | void;
  readonly default?: Array<string> | (() => Array<string>);
  readonly validate?: ((val: Array<string>) => boolean)
}

export interface StringListAttribute {
  readonly type: "list";
  readonly items: {
    readonly type: "string";
    readonly required?: boolean;
    readonly hidden?: boolean;
    readonly readOnly?: boolean;
    readonly get?: (val: string, item: any) => string | undefined | void;
    readonly set?: (val?: string, item?: any) => string | undefined | void;
    readonly default?: string | (() => string);
    readonly validate?:
      | ((val: string) => boolean)
      | RegExp;
    readonly field?: string;
  };
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
    val: Array<string>,
    item: any,
  ) => Array<string> | undefined | void;
  readonly set?: (
    val?: Array<string>,
    item?: any,
  ) => Array<string> | undefined | void;
  readonly default?: Array<string> | (() => Array<string>);
  readonly validate?: ((val: Array<string>) => boolean)
  readonly watch?: ReadonlyArray<string> | "*";
}

export interface NestedNumberListAttribute {
  readonly type: "list";
  readonly items: NestedNumberAttribute;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
    val: Array<number>,
    item: any,
  ) => Array<number> | undefined | void;
  readonly set?: (
    val?: Array<number>,
    item?: any,
  ) => Array<number> | undefined | void;
  readonly default?: Array<number> | (() => Array<number>);
  readonly validate?: ((val: Array<number>) => boolean)
  readonly field?: string;
}

export interface NumberListAttribute {
  readonly type: "list";
  readonly items: NestedNumberAttribute;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
    val: Array<number>,
    item: any,
  ) => Array<number> | undefined | void;
  readonly set?: (
    val?: Array<number>,
    item?: any,
  ) => Array<number> | undefined | void;
  readonly default?: Array<number> | (() => Array<number>);
  readonly validate?: ((val: Array<number>) => boolean)
  readonly field?: string;
  readonly watch?: ReadonlyArray<string> | "*";
}

export interface NestedMapListAttribute {
  readonly type: "list";
  readonly items: NestedMapAttribute;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
    val: Record<string, any>[],
    item: any,
  ) => Record<string, any>[] | undefined | void;
  readonly set?: (
    val?: Record<string, any>[],
    item?: any,
  ) => Record<string, any>[] | undefined | void;
  readonly default?: Record<string, any>[] | (() => Record<string, any>[]);
  readonly validate?: ((val: Record<string, any>[]) => boolean)
  readonly field?: string;
}

export interface NestedAnyListAttribute {
  readonly type: "list";
  readonly items: NestedAnyAttribute;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
      val: Record<string, any>[],
      item: any,
  ) => Record<string, any>[] | undefined | void;
  readonly set?: (
      val?: Record<string, any>[],
      item?: any,
  ) => Record<string, any>[] | undefined | void;
  readonly default?: Record<string, any>[] | (() => Record<string, any>[]);
  readonly validate?: ((val: Record<string, any>[]) => boolean)
  readonly field?: string;
}

export interface MapListAttribute {
  readonly type: "list";
  readonly items: NestedMapAttribute;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
    val: Record<string, any>[],
    item: any,
  ) => Record<string, any>[] | undefined | void;
  readonly set?: (
    val?: Record<string, any>[],
    item?: any,
  ) => Record<string, any>[] | undefined | void;
  readonly default?: Record<string, any>[] | (() => Record<string, any>[]);
  readonly validate?: ((val: Record<string, any>[]) => boolean)
  readonly field?: string;
  readonly watch?: ReadonlyArray<string> | "*";
}

export interface CustomListAttribute {
  readonly type: "list";
  readonly items: NestedCustomAttribute;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
      val: Array<any>,
      item: any,
  ) => Array<any> | undefined | void;
  readonly set?: (
      val?: Array<any>,
      item?: any,
  ) => Array<any> | undefined | void;
  readonly default?: Array<any> | (() => Array<any>);
  readonly validate?: ((val: Array<any>) => boolean);
  readonly field?: string;
  readonly watch?: ReadonlyArray<string> | "*";
}

export interface AnyListAttribute {
  readonly type: "list";
  readonly items: NestedAnyAttribute;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
      val: Array<any>,
      item: any,
  ) => Array<any> | undefined | void;
  readonly set?: (
      val?: Array<any>,
      item?: any,
  ) => Array<any> | undefined | void;
  readonly default?: Array<any> | (() => Array<any>);
  readonly validate?: ((val: Array<any>) => boolean)
  readonly field?: string;
  readonly watch?: ReadonlyArray<string> | "*";
}

export interface NestedStringSetAttribute {
  readonly type: "set";
  readonly items: "string";
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
    val: Array<string>,
    item: any,
  ) => Array<string> | undefined | void;
  readonly set?: (
    val?: Array<string>,
    item?: any,
  ) => Array<string> | undefined | void;
  readonly default?: Array<string> | (() => Array<string>);
  readonly validate?:
    | ((val: Array<string>) => boolean)
    | RegExp;
  readonly field?: string;
}

export interface NestedEnumNumberSetAttribute {
  readonly type: "set";
  readonly items: ReadonlyArray<number>;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
    val: Array<number>,
    item: any,
  ) => Array<number> | undefined | void;
  readonly set?: (
    val?: Array<number>,
    item?: any,
  ) => Array<number> | undefined | void;
  readonly default?: Array<number> | (() => Array<number>);
  readonly validate?: ((val: Array<number>) => boolean)
  readonly field?: string;
}

export interface EnumNumberSetAttribute {
  readonly type: "set";
  readonly items: ReadonlyArray<number>;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
    val: Array<number>,
    item: any,
  ) => Array<number> | undefined | void;
  readonly set?: (
    val?: Array<number>,
    item?: any,
  ) => Array<number> | undefined | void;
  readonly default?: Array<number> | (() => Array<number>);
  readonly validate?: ((val: Array<number>) => boolean)
  readonly field?: string;
  readonly watch?: ReadonlyArray<string> | "*";
}

export interface NestedEnumStringSetAttribute {
  readonly type: "set";
  readonly items: ReadonlyArray<string>;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
    val: Array<string>,
    item: any,
  ) => Array<string> | undefined | void;
  readonly set?: (
    val?: Array<string>,
    item?: any,
  ) => Array<string> | undefined | void;
  readonly default?: Array<string> | (() => Array<string>);
  readonly validate?:
    | ((val: Array<string>) => boolean)
    | RegExp;
  readonly field?: string;
}

export interface EnumStringSetAttribute {
  readonly type: "set";
  readonly items: ReadonlyArray<string>;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
    val: Array<string>,
    item: any,
  ) => Array<string> | undefined | void;
  readonly set?: (
    val?: Array<string>,
    item?: any,
  ) => Array<string> | undefined | void;
  readonly default?: Array<string> | (() => Array<string>);
  readonly validate?:
    | ((val: Array<string>) => boolean)
    | RegExp;
  readonly field?: string;
  readonly watch?: ReadonlyArray<string> | "*";
}

export interface StringSetAttribute {
  readonly type: "set";
  readonly items: "string";
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
    val: Array<string>,
    item: any,
  ) => Array<string> | undefined | void;
  readonly set?: (
    val?: Array<string>,
    item?: any,
  ) => Array<string> | undefined | void;
  readonly default?: Array<string> | (() => Array<string>);
  readonly validate?:
    | ((val: Array<string>) => boolean)
    | RegExp;
  readonly field?: string;
  readonly watch?: ReadonlyArray<string> | "*";
}

export interface NestedNumberSetAttribute {
  readonly type: "set";
  readonly items: "number";
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
    val: Array<number>,
    item: any,
  ) => Array<number> | undefined | void;
  readonly set?: (
    val?: Array<number>,
    item?: any,
  ) => Array<number> | undefined | void;
  readonly default?: Array<number> | (() => Array<number>);
  readonly validate?: ((val: Array<number>) => boolean)
  readonly field?: string;
}

export interface NumberSetAttribute {
  readonly type: "set";
  readonly items: "number";
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (
    val: Array<number>,
    item: any,
  ) => Array<number> | undefined | void;
  readonly set?: (
    val?: Array<number>,
    item?: any,
  ) => Array<number> | undefined | void;
  readonly default?: Array<number> | (() => Array<number>);
  readonly validate?: ((val: Array<number>) => boolean)
  readonly field?: string;
  readonly watch?: ReadonlyArray<string> | "*";
}

interface CustomAttributeTypeName<T> {
  readonly [CustomAttributeSymbol]: T;
}

interface CustomPrimitiveTypeName<T> {
  readonly [OpaquePrimitiveSymbol]: T;
}

export type OpaquePrimitiveTypeName<T extends string | number | boolean> =
  T extends string
    ? "string" & CustomPrimitiveTypeName<T>
    : T extends number
    ? "number" & CustomPrimitiveTypeName<T>
    : T extends boolean
    ? "boolean" & CustomPrimitiveTypeName<T>
    : never;

type CustomAttribute = {
  readonly type: CustomAttributeTypeName<any> | OpaquePrimitiveTypeName<any>;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (val: any, item: any) => any | undefined | void;
  readonly set?: (val?: any, item?: any) => any | undefined | void;
  readonly default?: any | (() => any);
  readonly validate?: ((val: any) => boolean)
  readonly field?: string;
  readonly watch?: ReadonlyArray<string> | "*";
};

type NestedCustomAttribute = {
  readonly type: CustomAttributeTypeName<any> | OpaquePrimitiveTypeName<any>;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (val: any, item: any) => any | undefined | void;
  readonly set?: (val?: any, item?: any) => any | undefined | void;
  readonly default?: any | (() => any);
  readonly validate?: ((val: any) => boolean)
  readonly field?: string;
};

export type Attribute =
  | BooleanAttribute
  | NumberAttribute
  | StringAttribute
  | EnumAttribute
  | AnyAttribute
  | MapAttribute
  | StringSetAttribute
  | NumberSetAttribute
  | StringListAttribute
  | NumberListAttribute
  | MapListAttribute
  | AnyListAttribute
  | CustomListAttribute
  | CustomAttribute
  | EnumNumberSetAttribute
  | EnumStringSetAttribute;

export type NestedAttributes =
  | NestedBooleanAttribute
  | NestedNumberAttribute
  | NestedStringAttribute
  | NestedAnyAttribute
  | NestedMapAttribute
  | NestedStringListAttribute
  | NestedCustomListAttribute
  | NestedNumberListAttribute
  | NestedMapListAttribute
  | NestedAnyListAttribute
  | NestedStringSetAttribute
  | NestedNumberSetAttribute
  | NestedEnumAttribute
  | NestedCustomAttribute
  | NestedEnumNumberSetAttribute
  | NestedEnumStringSetAttribute;

export interface IndexWithSortKey {
  readonly sk: {
    readonly field: string;
    readonly composite: ReadonlyArray<string>;
    readonly template?: string;
  };
}

export type AccessPatternCollection<C extends string> = C | ReadonlyArray<C>;

export type KeyCastOption = "string" | "number";

export type KeyCasingOption = "upper" | "lower" | "none" | "default";

export interface Schema<A extends string, F extends string, C extends string> {
  readonly model: {
    readonly entity: string;
    readonly service: string;
    readonly version: string;
  };
  readonly attributes: {
    readonly [a in A]: Attribute;
  };
  readonly indexes: {
    [accessPattern: string]: {
      readonly project?: "keys_only";
      readonly index?: string;
      readonly scope?: string;
      readonly type?: "clustered" | "isolated";
      readonly collection?: AccessPatternCollection<C>;
      readonly condition?: (composite: Record<string, unknown>) => boolean;
      readonly pk: {
        readonly casing?: KeyCasingOption;
        readonly field: string;
        readonly composite: ReadonlyArray<F>;
        readonly template?: string;
        readonly cast?: KeyCastOption;
      };
      readonly sk?: {
        readonly casing?: KeyCasingOption;
        readonly field: string;
        readonly composite: ReadonlyArray<F>;
        readonly template?: string;
        readonly cast?: KeyCastOption;
      };
    };
  };
}

export type Attributes<A extends string> = Record<A, Attribute>;

export type IndexCollections<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  [i in keyof S["indexes"]]: S["indexes"][i]["collection"] extends AccessPatternCollection<
    infer Name
  >
    ? Name
    : never;
}[keyof S["indexes"]];

export type IndexCollectionsMap<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  [i in keyof S["indexes"]]: S["indexes"][i]["collection"] extends AccessPatternCollection<
    infer Name
  >
    ? Name
    : never;
};

type ClusteredIndexNameMap<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  [I in keyof S["indexes"] as S["indexes"][I] extends { type: "clustered" }
    ? I
    : never]: S["indexes"][I]["collection"] extends AccessPatternCollection<
    infer Name
  >
    ? Name
    : never;
};

type ThingValues<T> = T[keyof T];

type IsolatedIndexNameMap<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  [I in keyof S["indexes"] as S["indexes"][I] extends { type: "clustered" }
    ? never
    : I]: S["indexes"][I]["collection"] extends AccessPatternCollection<
    infer Name
  >
    ? Name
    : never;
};

export type ClusteredIndexCollections<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = ThingValues<ClusteredIndexNameMap<A, F, C, S>>;

export type IsolatedIndexCollections<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = ThingValues<IsolatedIndexNameMap<A, F, C, S>>;

export type EntityCollections<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  [N in IndexCollections<A, F, C, S>]: {
    [i in keyof S["indexes"]]: S["indexes"][i]["collection"] extends AccessPatternCollection<
      infer Name
    >
      ? Name extends N
        ? i
        : never
      : never;
  }[keyof S["indexes"]];
};

export type ClusteredEntityCollections<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  [N in ClusteredIndexCollections<A, F, C, S>]: {
    [I in keyof S["indexes"]]: S["indexes"][I]["collection"] extends AccessPatternCollection<
      infer Name
    >
      ? Name extends N
        ? I
        : never
      : never;
  }[keyof S["indexes"]];
};

export type IsolatedEntityCollections<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  [N in IsolatedIndexCollections<A, F, C, S>]: {
    [I in keyof S["indexes"]]: S["indexes"][I]["collection"] extends AccessPatternCollection<
      infer Name
    >
      ? Name extends N
        ? I
        : never
      : never;
  }[keyof S["indexes"]];
};

declare const SkipSymbol: unique symbol;
type SkipValue = typeof SkipSymbol;

type PartialDefinedKeys<T> = {
  [P in keyof T as [undefined] extends [T[P]]
    ? never
    : SkipValue extends T[P]
    ? never
    : P]?: T[P] | undefined;
};

export type ItemAttribute<A extends Attribute> =
  A["type"] extends infer T
    ? T extends OpaquePrimitiveTypeName<infer OP>
      ? OP
      : T extends CustomAttributeTypeName<infer CA>
      ? CA
      : T extends infer R
      ? R extends "string"
        ? string
        : R extends "number"
        ? number
        : R extends "boolean"
        ? boolean
        : R extends ReadonlyArray<infer E>
        ? E
        : R extends "map"
        ? "properties" extends keyof A
          ? {
              [P in keyof A["properties"]]: A["properties"][P] extends infer M
                ? M extends Attribute
                  ? ItemAttribute<M>
                  : never
                : never;
            }
          : never
        : R extends "list"
        ? "items" extends keyof A
          ? A["items"] extends infer I
            ? I extends Attribute
              ? Array<ItemAttribute<I>>
              : never
            : never
          : never
        : R extends "set"
        ? "items" extends keyof A
          ? A["items"] extends infer I
            ? I extends "string"
              ? string[]
              : I extends "number"
              ? number[]
              : I extends ReadonlyArray<infer ENUM>
              ? ENUM[]
              : never
            : never
          : never
        : R extends "any"
        ? any
        : never
      : never
    : never;

export type ReturnedAttribute<A extends Attribute> =
  A["type"] extends infer T
    ? T extends OpaquePrimitiveTypeName<infer OP>
      ? OP
      : T extends CustomAttributeTypeName<infer CA>
      ? CA
      : T extends infer R
      ? R extends "static"
        ? never
        : R extends "string"
        ? string
        : R extends "number"
        ? number
        : R extends "boolean"
        ? boolean
        : R extends ReadonlyArray<infer E>
        ? E
        : R extends "map"
        ? "properties" extends keyof A
          ? {
              [P in keyof A["properties"] as A["properties"][P] extends RequiredAttribute
                ? P
                : never]: A["properties"][P] extends infer M
                ? M extends Attribute
                  ? ReturnedAttribute<M>
                  : never
                : never;
            } & {
              [P in keyof A["properties"] as A["properties"][P] extends
                | HiddenAttribute
                | RequiredAttribute
                ? never
                : P]?: A["properties"][P] extends infer M
                ? M extends Attribute
                  ? ReturnedAttribute<M> | undefined
                  : never
                : never;
            }
          : never
        : R extends "list"
        ? "items" extends keyof A
          ? A["items"] extends infer I
            ? I extends Attribute
              ? ReturnedAttribute<I>[]
              : never
            : never
          : never
        : R extends "set"
        ? "items" extends keyof A
          ? A["items"] extends infer I
            ? I extends "string"
              ? string[]
              : I extends "number"
              ? number[]
              : I extends ReadonlyArray<infer ENUM>
              ? ENUM[]
              : never
            : never
          : never
        : R extends "any"
        ? any
        : never
      : never
    : never;

export type CreatedAttribute<A extends Attribute> =
  A["type"] extends OpaquePrimitiveTypeName<infer T>
    ? T
    : A["type"] extends CustomAttributeTypeName<infer T>
    ? T
    : A["type"] extends infer R
    ? R extends "static"
      ? never
      : R extends "string"
      ? string
      : R extends "number"
      ? number
      : R extends "boolean"
      ? boolean
      : R extends ReadonlyArray<infer E>
      ? E
      : R extends "map"
      ? "properties" extends keyof A
        ? {
            [P in keyof A["properties"] as A["properties"][P] extends RequiredAttribute
              ? A["properties"][P] extends DefaultedAttribute
                ? never
                : P
              : never]: A["properties"][P] extends infer M
              ? M extends Attribute
                ? CreatedAttribute<M>
                : never
              : never;
          } & {
            [P in keyof A["properties"] as A["properties"][P] extends HiddenAttribute
              ? never
              : P]?: A["properties"][P] extends infer M
              ? M extends Attribute
                ? CreatedAttribute<M> | undefined
                : never
              : never;
          }
        : never
      : R extends "list"
      ? "items" extends keyof A
        ? A["items"] extends infer I
          ? I extends Attribute
            ? CreatedAttribute<I>[]
            : never
          : never
        : never
      : R extends "set"
      ? "items" extends keyof A
        ? A["items"] extends infer I
          ? I extends "string"
            ? string[]
            : I extends "number"
            ? number[]
            : I extends ReadonlyArray<infer ENUM>
            ? ENUM[]
            : never
          : never
        : never
      : R extends "any"
      ? any
      : never
    : never;

export type ReturnedItem<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  Attr extends S["attributes"],
> = {
  [a in keyof Attr]: ReturnedAttribute<Attr[a]>;
};

export type CreatedItem<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  Attr extends S["attributes"],
> = {
  [a in keyof Attr]: CreatedAttribute<Attr[a]>;
};

export type EditableItemAttribute<A extends Attribute> =
  A["type"] extends OpaquePrimitiveTypeName<infer T>
    ? T
    : A["type"] extends CustomAttributeTypeName<infer T>
    ? T
    : A extends ReadOnlyAttribute
    ? never
    : A["type"] extends infer R
    ? R extends "static"
      ? never
      : R extends "string"
      ? string
      : R extends "number"
      ? number
      : R extends "boolean"
      ? boolean
      : R extends ReadonlyArray<infer E>
      ? E
      : R extends "map"
      ? "properties" extends keyof A
        ? {
            [P in keyof A["properties"] as A["properties"][P] extends ReadOnlyAttribute
              ? never
              : P]: A["properties"][P] extends infer M
              ? M extends Attribute
                ? EditableItemAttribute<M>
                : never
              : never;
          }
        : never
      : R extends "list"
      ? "items" extends keyof A
        ? A["items"] extends infer I
          ? I extends Attribute
            ? Array<EditableItemAttribute<I>>
            : never
          : never
        : never
      : R extends "set"
      ? "items" extends keyof A
        ? A["items"] extends infer I
          ? I extends "string"
            ? string[]
            : I extends "number"
            ? number[]
            : I extends ReadonlyArray<infer ENUM>
            ? ENUM[]
            : never
          : never
        : never
      : R extends "any"
      ? any
      : never
    : never;

export type UpdatableItemAttribute<A extends Attribute> =
  A["type"] extends OpaquePrimitiveTypeName<infer T>
    ? T
    : A["type"] extends CustomAttributeTypeName<infer T>
    ? T
    : A extends ReadOnlyAttribute
    ? never
    : A["type"] extends infer R
    ? R extends "static"
      ? never
      : R extends "string"
      ? string
      : R extends "number"
      ? number
      : R extends "boolean"
      ? boolean
      : R extends ReadonlyArray<infer E>
      ? E
      : R extends "map"
      ? "properties" extends keyof A
        ? {
            [P in keyof A["properties"] as A["properties"][P] extends ReadOnlyAttribute
              ? never
              : A["properties"][P] extends RequiredAttribute
              ? P
              : never]: A["properties"][P] extends infer M
              ? M extends Attribute
                ? UpdatableItemAttribute<M>
                : never
              : never;
          } & {
            [P in keyof A["properties"] as A["properties"][P] extends ReadOnlyAttribute
              ? never
              : A["properties"][P] extends RequiredAttribute
              ? never
              : P]?: A["properties"][P] extends infer M
              ? M extends Attribute
                ? UpdatableItemAttribute<M>
                : never
              : never;
          }
        : never
      : R extends "list"
      ? "items" extends keyof A
        ? A["items"] extends infer I
          ? I extends Attribute
            ? Array<UpdatableItemAttribute<I>>
            : never
          : never
        : never
      : R extends "set"
      ? "items" extends keyof A
        ? A["items"] extends infer I
          ? I extends "string"
            ? string[]
            : I extends "number"
            ? number[]
            : I extends ReadonlyArray<infer ENUM>
            ? ENUM[]
            : never
          : never
        : never
      : R extends "any"
      ? any
      : never
    : never;

type UpdateComposite<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  Response,
> = (
  compositeAttributes: Partial<
    {
      [I in keyof S["indexes"] as I extends infer Name
        ? Name extends TableIndexName<A, F, C, S>
          ? never
          : Name
        : never]: IndexPKAttributes<A, F, C, S, I> &
        IndexSKAttributes<A, F, C, S, I>;
    }[keyof S["indexes"] extends infer KeyName
      ? KeyName extends TableIndexName<A, F, C, S>
        ? never
        : KeyName
      : never]
  >,
) => Response;

export type RemovableItemAttribute<A extends Attribute> =
  A["type"] extends OpaquePrimitiveTypeName<infer T>
    ? T
    : A["type"] extends CustomAttributeTypeName<infer T>
    ? T
    : A extends ReadOnlyAttribute | RequiredAttribute
    ? never
    : A["type"] extends infer R
    ? R extends "static"
      ? never
      : R extends "string"
      ? string
      : R extends "number"
      ? number
      : R extends "boolean"
      ? boolean
      : R extends ReadonlyArray<infer E>
      ? E
      : R extends "map"
      ? "properties" extends keyof A
        ? {
            [P in keyof A["properties"] as A["properties"][P] extends
              | ReadOnlyAttribute
              | RequiredAttribute
              ? never
              : P]?: A["properties"][P] extends infer M
              ? M extends Attribute
                ? UpdatableItemAttribute<M>
                : never
              : never;
          }
        : never
      : R extends "list"
      ? "items" extends keyof A
        ? A["items"] extends infer I
          ? I extends Attribute
            ? Array<UpdatableItemAttribute<I>>
            : never
          : never
        : never
      : R extends "set"
      ? "items" extends keyof A
        ? A["items"] extends infer I
          ? I extends "string"
            ? string[]
            : I extends "number"
            ? number[]
            : I extends ReadonlyArray<infer ENUM>
            ? ENUM[]
            : never
          : never
        : never
      : R extends "any"
      ? any
      : never
    : never;

export type Item<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  Attr extends Attributes<A>,
> = {
  [a in keyof Attr]: ItemAttribute<Attr[a]>;
};

export type ItemTypeDescription<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  [a in keyof S["attributes"]]: S["attributes"][a]["type"] extends infer R
    ? R
    : never;
};

export type RequiredAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = ExtractKeysOfValueType<
  {
    [a in keyof S["attributes"]]: S["attributes"][a] extends RequiredAttribute
      ? true
      : false;
  },
  true
>;

export type HiddenAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = ExtractKeysOfValueType<
  {
    [a in keyof S["attributes"]]: S["attributes"][a] extends HiddenAttribute
      ? true
      : false;
  },
  true
>;

export type ReadOnlyAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = ExtractKeysOfValueType<
  {
    [a in keyof S["attributes"]]: S["attributes"][a] extends ReadOnlyAttribute
      ? true
      : false;
  },
  true
>;

type ExtractKeysOfValueType<T, K> = {
  [I in keyof T]: T[I] extends K ? I : never;
}[keyof T];

export type TableIndexes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  [i in keyof S["indexes"]]: S["indexes"][i] extends SecondaryIndex
    ? "secondary"
    : "table";
};

export type TableIndexName<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = ExtractKeysOfValueType<TableIndexes<A, F, C, S>, "table">;

export type PKCompositeAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  [i in keyof S["indexes"]]: S["indexes"][i]["pk"]["composite"] extends ReadonlyArray<
    infer Composite
  >
    ? Composite
    : never;
};

export type SKCompositeAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  [i in keyof S["indexes"]]: S["indexes"][i] extends IndexWithSortKey
    ? S["indexes"][i]["sk"]["composite"] extends ReadonlyArray<infer Composite>
      ? Composite
      : never
    : never;
};

export type TableIndexPKCompositeAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = Pick<PKCompositeAttributes<A, F, C, S>, TableIndexName<A, F, C, S>>;

export type TableIndexSKCompositeAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = Pick<SKCompositeAttributes<A, F, C, S>, TableIndexName<A, F, C, S>>;

export type IndexPKCompositeAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends keyof S["indexes"],
> = Pick<PKCompositeAttributes<A, F, C, S>, I>;

export type IndexSKCompositeAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends keyof S["indexes"],
> = Pick<SKCompositeAttributes<A, F, C, S>, I>;

export type TableIndexPKAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = TableIndexName<A, F, C, S> extends keyof TableIndexPKCompositeAttributes<
  A,
  F,
  C,
  S
>
  ? TableIndexPKCompositeAttributes<A, F, C, S>[TableIndexName<
      A,
      F,
      C,
      S
    >] extends keyof Item<A, F, C, S, S["attributes"]>
    ? Pick<
        Item<A, F, C, S, S["attributes"]>,
        TableIndexPKCompositeAttributes<A, F, C, S>[TableIndexName<A, F, C, S>]
      >
    : never
  : never;

export type TableIndexSKAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = TableIndexSKCompositeAttributes<A, F, C, S>[TableIndexName<
  A,
  F,
  C,
  S
>] extends keyof S["attributes"]
  ? Pick<
      Item<A, F, C, S, S["attributes"]>,
      TableIndexSKCompositeAttributes<A, F, C, S>[TableIndexName<A, F, C, S>]
    >
  : Item<A, F, C, S, S["attributes"]>;

export type IndexPKAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends keyof S["indexes"],
> = I extends keyof IndexPKCompositeAttributes<A, F, C, S, I>
  ? IndexPKCompositeAttributes<A, F, C, S, I>[I] extends keyof Item<
      A,
      F,
      C,
      S,
      S["attributes"]
    >
    ? Pick<
        Item<A, F, C, S, S["attributes"]>,
        IndexPKCompositeAttributes<A, F, C, S, I>[I]
      >
    : never
  : never;

export type IndexSKAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends keyof S["indexes"],
> = IndexSKCompositeAttributes<A, F, C, S, I>[I] extends keyof S["attributes"]
  ? Pick<
      Item<A, F, C, S, S["attributes"]>,
      IndexSKCompositeAttributes<A, F, C, S, I>[I]
    >
  : Item<A, F, C, S, S["attributes"]>;

export type TableIndexCompositeAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = TableIndexPKAttributes<A, F, C, S> &
  Partial<TableIndexSKAttributes<A, F, C, S>>;

export type AllTableIndexCompositeAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = TableIndexPKAttributes<A, F, C, S> & TableIndexSKAttributes<A, F, C, S>;

export type IndexCompositeAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends keyof S["indexes"],
> = IndexPKAttributes<A, F, C, S, I> &
  Partial<IndexSKAttributes<A, F, C, S, I>>;

export type TableItem<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = AllTableIndexCompositeAttributes<A, F, C, S> &
  Pick<
    ReturnedItem<A, F, C, S, S["attributes"]>,
    RequiredAttributes<A, F, C, S>
  > &
  Partial<
    Omit<
      ReturnedItem<A, F, C, S, S["attributes"]>,
      RequiredAttributes<A, F, C, S>
    >
  >;

export type ResponseItem<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = Omit<TableItem<A, F, C, S>, HiddenAttributes<A, F, C, S>>;

export type RequiredPutItems<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  [Attribute in keyof S["attributes"]]: "default" extends keyof S["attributes"][Attribute]
    ? false
    : "required" extends keyof S["attributes"][Attribute]
    ? true extends S["attributes"][Attribute]["required"]
      ? true
      : Attribute extends keyof TableIndexCompositeAttributes<A, F, C, S>
      ? true
      : false
    : Attribute extends keyof TableIndexCompositeAttributes<A, F, C, S>
    ? true
    : false;
};

export type PutItem<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = Pick<
  CreatedItem<A, F, C, S, S["attributes"]>,
  ExtractKeysOfValueType<RequiredPutItems<A, F, C, S>, true>
> &
  Partial<CreatedItem<A, F, C, S, S["attributes"]>>;

export type UpsertItem<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = Partial<PutItem<A, F, C, S>>;

export type UpdateData<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = Omit<
  {
    [Attr in keyof S["attributes"]]: EditableItemAttribute<
      S["attributes"][Attr]
    >;
  },
  | keyof AllTableIndexCompositeAttributes<A, F, C, S>
  | ReadOnlyAttributes<A, F, C, S>
>;

export type SetItem<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> =
  // UpdatableItemAttribute
  Omit<
    {
      [Attr in keyof S["attributes"]]?: UpdatableItemAttribute<
        S["attributes"][Attr]
      >;
    },
    | keyof AllTableIndexCompositeAttributes<A, F, C, S>
    | ReadOnlyAttributes<A, F, C, S>
  >;

// type RemoveItem<A extends string, F extends string, C extends string, S extends Schema<A,F,C>> =
//     Array<keyof SetItem<A,F,C,S>>
export type RemoveItem<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = Array<
  keyof Omit<
    {
      [Attr in keyof S["attributes"]]?: RemovableItemAttribute<
        S["attributes"][Attr]
      >;
    },
    | keyof AllTableIndexCompositeAttributes<A, F, C, S>
    | ReadOnlyAttributes<A, F, C, S>
    | RequiredAttributes<A, F, C, S>
  >
>;

export type AppendItem<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  [P in keyof ItemTypeDescription<A, F, C, S> as ItemTypeDescription<
    A,
    F,
    C,
    S
  >[P] extends "list" | "any" | "custom" | CustomAttributeTypeName<any>
    ? P
    : never]?: P extends keyof SetItem<A, F, C, S>
    ? SetItem<A, F, C, S>[P] | undefined
    : never;
};

export type AddItem<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  [P in keyof ItemTypeDescription<A, F, C, S> as ItemTypeDescription<
    A,
    F,
    C,
    S
  >[P] extends
    | "number"
    | "any"
    | "set"
    | "custom"
    | CustomAttributeTypeName<any>
    | OpaquePrimitiveTypeName<number>
    ? P
    : never]?: P extends keyof SetItem<A, F, C, S>
    ? SetItem<A, F, C, S>[P] | undefined
    : never;
};

export type SubtractItem<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  [P in keyof ItemTypeDescription<A, F, C, S> as ItemTypeDescription<
    A,
    F,
    C,
    S
  >[P] extends "number" | "any" | "custom" | OpaquePrimitiveTypeName<number>
    ? P
    : never]?: P extends keyof SetItem<A, F, C, S>
    ? SetItem<A, F, C, S>[P] | undefined
    : never;
};

export type DeleteItem<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> = {
  [P in keyof ItemTypeDescription<A, F, C, S> as ItemTypeDescription<
    A,
    F,
    C,
    S
  >[P] extends "any" | "set" | "custom" | CustomAttributeTypeName<any>
    ? P
    : never]?: P extends keyof SetItem<A, F, C, S>
    ? SetItem<A, F, C, S>[P] | undefined
    : never;
};

export declare const WhereSymbol: unique symbol;
export declare const UpdateDataSymbol: unique symbol;
export declare const CustomAttributeSymbol: unique symbol;
export declare const OpaquePrimitiveSymbol: unique symbol;
export declare const TransactionSymbol: unique symbol;

export type WhereAttributeSymbol<T extends any> = {
  [WhereSymbol]: void;
} & T extends string
  ? T
  : T extends number
  ? T
  : T extends boolean
  ? T
  : T extends { [key: string]: any }
  ? { [key in keyof T]: WhereAttributeSymbol<T[key]> }
  : T extends ReadonlyArray<infer A>
  ? ReadonlyArray<WhereAttributeSymbol<A>>
  : T extends Array<infer I>
  ? Array<WhereAttributeSymbol<I>>
  : T;

export type WhereAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends Item<A, F, C, S, S["attributes"]>,
> = {
  [Attr in keyof I]: WhereAttributeSymbol<I[Attr]>;
};

export type DataUpdateAttributeSymbol<T extends any> = {
  [UpdateDataSymbol]: void;
} & T extends string
  ? T
  : T extends number
  ? T
  : T extends boolean
  ? T
  : T extends { [key: string]: any }
  ? { [key in keyof T]: DataUpdateAttributeSymbol<T[key]> }
  : T extends ReadonlyArray<infer A>
  ? ReadonlyArray<DataUpdateAttributeSymbol<A>>
  : T extends Array<infer I>
  ? Array<DataUpdateAttributeSymbol<I>>
  : [T] extends [never]
  ? never
  : T;

export type DataUpdateAttributeValues<
  A extends DataUpdateAttributeSymbol<any>,
> = A extends DataUpdateAttributeSymbol<infer T>
  ? T extends string
    ? T
    : T extends number
    ? T
    : T extends boolean
    ? T
    : T extends { [key: string]: any }
    ? { [key in keyof T]?: DataUpdateAttributeValues<T[key]> }
    : T extends ReadonlyArray<infer A>
    ? ReadonlyArray<DataUpdateAttributeValues<A>>
    : T extends Array<infer I>
    ? Array<DataUpdateAttributeValues<I>>
    : [T] extends [never]
    ? never
    : T
  : never;

export type DataUpdateAttributes<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends UpdateData<A, F, C, S>,
> = {
  [Attr in keyof I]: DataUpdateAttributeSymbol<I[Attr]>;
};

export interface WhereOperations<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends Item<A, F, C, S, S["attributes"]>,
> {
  eq: <T, A extends WhereAttributeSymbol<T>>(attr: A, value: T) => string;
  ne: <T, A extends WhereAttributeSymbol<T>>(attr: A, value: T) => string;
  gt: <T, A extends WhereAttributeSymbol<T>>(attr: A, value: T) => string;
  lt: <T, A extends WhereAttributeSymbol<T>>(attr: A, value: T) => string;
  gte: <T, A extends WhereAttributeSymbol<T>>(attr: A, value: T) => string;
  lte: <T, A extends WhereAttributeSymbol<T>>(attr: A, value: T) => string;
  between: <T, A extends WhereAttributeSymbol<T>>(
    attr: A,
    value: T,
    value2: T,
  ) => string;
  begins: <T, A extends WhereAttributeSymbol<T>>(attr: A, value: T) => string;
  exists: <A extends WhereAttributeSymbol<any>>(attr: A) => string;
  notExists: <A extends WhereAttributeSymbol<any>>(attr: A) => string;
  contains: <T, A extends WhereAttributeSymbol<T>>(
    attr: A,
    value: A extends WhereAttributeSymbol<infer V>
      ? V extends Array<infer I>
        ? I
        : V
      : never,
  ) => string;
  notContains: <T, A extends WhereAttributeSymbol<T>>(
    attr: A,
    value: A extends WhereAttributeSymbol<infer V>
      ? V extends Array<infer I>
        ? I
        : V
      : never,
  ) => string;
  value: <T, A extends WhereAttributeSymbol<T>>(
    attr: A,
    value: A extends WhereAttributeSymbol<infer V> ? V : never,
  ) => A extends WhereAttributeSymbol<infer V> ? V : never;
  name: <A extends WhereAttributeSymbol<any>>(attr: A) => string;
  size: <T, A extends WhereAttributeSymbol<T>>(attr: A) => number;
  type: <T, A extends WhereAttributeSymbol<T>>(
    attr: A,
    type: DynamoDBAttributeType,
  ) => string;
  field: (name: string) => string;
  escape: <T extends string | number | boolean>(
    value: T,
  ) => T extends string
    ? string
    : T extends number
    ? number
    : T extends boolean
    ? boolean
    : never;
}

export interface DataUpdateOperations<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends UpdateData<A, F, C, S>,
> {
  set: <T, A extends DataUpdateAttributeSymbol<T>>(
    attr: A,
    value: DataUpdateAttributeValues<A>,
  ) => any;
  remove: <T, A extends DataUpdateAttributeSymbol<T>>(
    attr: [T] extends [never] ? never : A,
  ) => any;
  append: <T, A extends DataUpdateAttributeSymbol<T>>(
    attr: A,
    value: DataUpdateAttributeValues<A> extends Array<any>
      ? DataUpdateAttributeValues<A>
      : never,
  ) => any;
  add: <T, A extends DataUpdateAttributeSymbol<T>>(
    attr: A,
    value: A extends DataUpdateAttributeSymbol<infer V>
      ? V extends number | Array<any>
        ? V
        : [V] extends [any]
        ? V
        : never
      : never,
    defaultValue?: A extends DataUpdateAttributeSymbol<infer V>
      ? V extends number
        ? V
        : never
      : never,
  ) => any;
  subtract: <T, A extends DataUpdateAttributeSymbol<T>>(
    attr: A,
    value: A extends DataUpdateAttributeSymbol<infer V>
      ? V extends number
        ? V
        : [V] extends [any]
        ? V
        : never
      : never,
    defaultValue?: A extends DataUpdateAttributeSymbol<infer V>
      ? V extends number
        ? V
        : never
      : never,
  ) => any;
  delete: <T, A extends DataUpdateAttributeSymbol<T>>(
    attr: A,
    value: A extends DataUpdateAttributeSymbol<infer V>
      ? V extends Array<any>
        ? V
        : [V] extends [any]
        ? V
        : never
      : never,
  ) => any;
  del: <T, A extends DataUpdateAttributeSymbol<T>>(
    attr: A,
    value: A extends DataUpdateAttributeSymbol<infer V>
      ? V extends Array<any>
        ? V
        : never
      : never,
  ) => any;
  value: <T, A extends DataUpdateAttributeSymbol<T>>(
    attr: A,
    value: DataUpdateAttributeValues<A>,
  ) => Required<DataUpdateAttributeValues<A>>;
  name: <T, A extends DataUpdateAttributeSymbol<T>>(attr: A) => any;
  ifNotExists: <T, A extends DataUpdateAttributeSymbol<T>>(
    attr: A,
    value: DataUpdateAttributeValues<A>,
  ) => any;
}

export interface UpsertDataUpdateOperations<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends UpdateData<A, F, C, S>,
> {
  set: <T, A extends DataUpdateAttributeSymbol<T>>(
    attr: A,
    value: DataUpdateAttributeValues<A>,
  ) => any;
  append: <T, A extends DataUpdateAttributeSymbol<T>>(
    attr: A,
    value: DataUpdateAttributeValues<A> extends Array<any>
      ? DataUpdateAttributeValues<A>
      : never,
  ) => any;
  add: <T, A extends DataUpdateAttributeSymbol<T>>(
    attr: A,
    value: A extends DataUpdateAttributeSymbol<infer V>
      ? V extends number | Array<any>
        ? V
        : [V] extends [any]
        ? V
        : never
      : never,
    defaultValue?: A extends DataUpdateAttributeSymbol<infer V>
      ? V extends number
        ? V
        : never
      : never,
  ) => any;
  subtract: <T, A extends DataUpdateAttributeSymbol<T>>(
    attr: A,
    value: A extends DataUpdateAttributeSymbol<infer V>
      ? V extends number
        ? V
        : [V] extends [any]
        ? V
        : never
      : never,
    defaultValue?: A extends DataUpdateAttributeSymbol<infer V>
      ? V extends number
        ? V
        : never
      : never,
  ) => any;
  ifNotExists: <T, A extends DataUpdateAttributeSymbol<T>>(
    attr: A,
    value: DataUpdateAttributeValues<A>,
  ) => any;
}

export type WhereCallback<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends Item<A, F, C, S, S["attributes"]>,
> = <W extends WhereAttributes<A, F, C, S, I>>(
  attributes: W,
  operations: WhereOperations<A, F, C, S, I>,
) => string;

export type DataUpdateCallback<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends UpdateData<A, F, C, S>,
> = <W extends DataUpdateAttributes<A, F, C, S, I>>(
  attributes: W,
  operations: DataUpdateOperations<A, F, C, S, I>,
) => any;

export type UpsertDataUpdateCallback<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends UpdateData<A, F, C, S>,
> = <W extends DataUpdateAttributes<A, F, C, S, I>>(
  attributes: W,
  operations: UpsertDataUpdateOperations<A, F, C, S, I>,
) => any;

export type WhereClause<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends Item<A, F, C, S, S["attributes"]>,
  T,
> = (where: WhereCallback<A, F, C, S, I>) => T;

export type DataUpdateMethod<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends UpdateData<A, F, C, S>,
  T,
> = (update: DataUpdateCallback<A, F, C, S, I>) => T;

export type UpsertDataUpdateMethod<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
  I extends UpdateData<A, F, C, S>,
  T,
> = (update: UpsertDataUpdateCallback<A, F, C, S, I>) => T;

type Resolve<T> = T extends Function | string | number | boolean
  ? T
  : { [Key in keyof T]: Resolve<T[Key]> };

export type EntityConfiguration = {
  table?: string;
  client?: DocumentClient;
  listeners?: Array<ElectroEventListener>;
  logger?: ElectroEventListener;
  identifiers?: {
    entity?: string;
    version?: string;
  };
  ignoreOwnership?: boolean;
};

export class Entity<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> {
  readonly schema: S;
  private config?: EntityConfiguration;
  constructor(schema: S, config?: EntityConfiguration);

  get(
    key: AllTableIndexCompositeAttributes<A, F, C, S>,
  ): SingleRecordOperationOptions<A, F, C, S, ResponseItem<A, F, C, S>>;
  get(
    key: AllTableIndexCompositeAttributes<A, F, C, S>[],
  ): BatchGetRecordOperationOptions<A, F, C, S, ResponseItem<A, F, C, S>>;

  delete(
    key: AllTableIndexCompositeAttributes<A, F, C, S>,
  ): DeleteRecordOperationOptions<A, F, C, S, ResponseItem<A, F, C, S>>;
  delete(
    key: AllTableIndexCompositeAttributes<A, F, C, S>[],
  ): BatchWriteOperationOptions<
    A,
    F,
    C,
    S,
    AllTableIndexCompositeAttributes<A, F, C, S>[]
  >;
  remove(
    key: AllTableIndexCompositeAttributes<A, F, C, S>,
  ): DeleteRecordOperationOptions<A, F, C, S, ResponseItem<A, F, C, S>>;

  put(
    record: PutItem<A, F, C, S>,
  ): PutRecordOperationOptions<A, F, C, S, ResponseItem<A, F, C, S>>;
  put(
    record: PutItem<A, F, C, S>[],
  ): BatchWriteOperationOptions<
    A,
    F,
    C,
    S,
    AllTableIndexCompositeAttributes<A, F, C, S>[]
  >;
  create(
    record: PutItem<A, F, C, S>,
  ): PutRecordOperationOptions<A, F, C, S, ResponseItem<A, F, C, S>>;

  upsert<InitialItem extends UpsertItem<A, F, C, S>>(
    record: InitialItem,
  ): UpsertRecordOperationOptions<
    A,
    F,
    C,
    S,
    ResponseItem<A, F, C, S>,
    PutItem<A, F, C, S>,
    [keyof InitialItem] extends [never]
      ? PutItem<A, F, C, S>
      : Omit<PutItem<A, F, C, S>, keyof InitialItem>,
    InitialItem
  >;

  update(key: AllTableIndexCompositeAttributes<A, F, C, S>): {
    set: SetRecord<
      A,
      F,
      C,
      S,
      SetItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      Partial<ResponseItem<A, F, C, S>>
    >;
    ifNotExists: SetRecord<
      A,
      F,
      C,
      S,
      SetItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      Partial<ResponseItem<A, F, C, S>>
    >;
    remove: RemoveRecord<
      A,
      F,
      C,
      S,
      RemoveItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      Partial<ResponseItem<A, F, C, S>>
    >;
    add: SetRecord<
      A,
      F,
      C,
      S,
      AddItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      Partial<ResponseItem<A, F, C, S>>
    >;
    subtract: SetRecord<
      A,
      F,
      C,
      S,
      SubtractItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      Partial<ResponseItem<A, F, C, S>>
    >;
    append: SetRecord<
      A,
      F,
      C,
      S,
      AppendItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      Partial<ResponseItem<A, F, C, S>>
    >;
    delete: SetRecord<
      A,
      F,
      C,
      S,
      DeleteItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      Partial<ResponseItem<A, F, C, S>>
    >;
    data: DataUpdateMethodRecord<
      A,
      F,
      C,
      S,
      Item<A, F, C, S, S["attributes"]>,
      TableIndexCompositeAttributes<A, F, C, S>,
      Partial<ResponseItem<A, F, C, S>>
    >;
    composite: UpdateComposite<
      A,
      F,
      C,
      S,
      SetRecordActionOptions<
        A,
        F,
        C,
        S,
        SetItem<A, F, C, S>,
        TableIndexCompositeAttributes<A, F, C, S>,
        Partial<ResponseItem<A, F, C, S>>
      >
    >;
  };
  patch(key: AllTableIndexCompositeAttributes<A, F, C, S>): {
    set: SetRecord<
      A,
      F,
      C,
      S,
      SetItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    remove: RemoveRecord<
      A,
      F,
      C,
      S,
      RemoveItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    ifNotExists: SetRecord<
      A,
      F,
      C,
      S,
      SetItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      Partial<ResponseItem<A, F, C, S>>
    >;
    add: SetRecord<
      A,
      F,
      C,
      S,
      AddItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    subtract: SetRecord<
      A,
      F,
      C,
      S,
      SubtractItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    append: SetRecord<
      A,
      F,
      C,
      S,
      AppendItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    delete: SetRecord<
      A,
      F,
      C,
      S,
      DeleteItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    data: DataUpdateMethodRecord<
      A,
      F,
      C,
      S,
      Item<A, F, C, S, S["attributes"]>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    composite: UpdateComposite<
      A,
      F,
      C,
      S,
      SetRecordActionOptions<
        A,
        F,
        C,
        S,
        SetItem<A, F, C, S>,
        TableIndexCompositeAttributes<A, F, C, S>,
        ResponseItem<A, F, C, S>
      >
    >;
  };

  find(
    record: Partial<Item<A, F, C, S, S["attributes"]>>,
  ): RecordsActionOptions<
    A,
    F,
    C,
    S,
    ResponseItem<A, F, C, S>,
    AllTableIndexCompositeAttributes<A, F, C, S>
  >;

  match(
    record: Partial<Item<A, F, C, S, S["attributes"]>>,
  ): RecordsActionOptions<
    A,
    F,
    C,
    S,
    ResponseItem<A, F, C, S>,
    AllTableIndexCompositeAttributes<A, F, C, S>
  >;

  scan: RecordsActionOptions<
    A,
    F,
    C,
    S,
    ResponseItem<A, F, C, S>,
    TableIndexCompositeAttributes<A, F, C, S>
  >;
  query: Queries<A, F, C, S>;

  parse<Options extends ParseOptions<keyof ResponseItem<A, F, C, S>>>(
    item: ParseSingleInput,
    options?: Options,
  ): Options extends ParseOptions<infer Attr>
    ? {
        data:
          | {
              [Name in keyof ResponseItem<A, F, C, S> as Name extends Attr
                ? Name
                : never]: ResponseItem<A, F, C, S>[Name];
            }
          | null;
      }
    : { data: ResponseItem<A, F, C, S> | null };
  parse<Options extends ParseOptions<keyof ResponseItem<A, F, C, S>>>(
    item: ParseMultiInput,
    options?: Options,
  ): Options extends ParseOptions<infer Attr>
    ? {
        data: Array<{
          [Name in keyof ResponseItem<A, F, C, S> as Name extends Attr
            ? Name
            : never]: ResponseItem<A, F, C, S>[Name];
        }>;
        cursor: string | null;
      }
    : { data: Array<ResponseItem<A, F, C, S>>; cursor: string | null };

  setIdentifier(type: "entity" | "version", value: string): void;
  setTableName(tableName: string): void;
  getTableName(): string | undefined;
  setClient(client: DocumentClient): void;
  client: any;
}

declare function createConversions<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
>(entity: Entity<A,F,C,S>): Conversions<A, F, C, S>;

export class TransactWriteEntity<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> {
  readonly schema: S;
  constructor(schema: S);

  check(
    key: AllTableIndexCompositeAttributes<A, F, C, S>,
  ): SingleRecordOperationOptionsTransaction<
    A,
    F,
    C,
    S,
    ResponseItem<A, F, C, S>,
    TransactWriteItem
  >;
  delete(
    key: AllTableIndexCompositeAttributes<A, F, C, S>,
  ): DeleteRecordOperationOptionsTransaction<
    A,
    F,
    C,
    S,
    ResponseItem<A, F, C, S>
  >;
  remove(
    key: AllTableIndexCompositeAttributes<A, F, C, S>,
  ): DeleteRecordOperationOptionsTransaction<
    A,
    F,
    C,
    S,
    ResponseItem<A, F, C, S>
  >;
  put(
    record: PutItem<A, F, C, S>,
  ): PutRecordOperationOptionsTransaction<A, F, C, S, ResponseItem<A, F, C, S>>;
  create(
    record: PutItem<A, F, C, S>,
  ): PutRecordOperationOptionsTransaction<A, F, C, S, ResponseItem<A, F, C, S>>;
  upsert<InitialItem extends UpsertItem<A, F, C, S>>(
    record: InitialItem,
  ): UpsertRecordOperationOptionsTransaction<
    A,
    F,
    C,
    S,
    ResponseItem<A, F, C, S>,
    PutItem<A, F, C, S>,
    [keyof InitialItem] extends [never]
        ? PutItem<A, F, C, S>
        : Omit<PutItem<A, F, C, S>, keyof InitialItem>,
    InitialItem
  >;
  update(key: AllTableIndexCompositeAttributes<A, F, C, S>): {
    set: SetRecordTransaction<
      A,
      F,
      C,
      S,
      SetItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    remove: RemoveRecordTransaction<
      A,
      F,
      C,
      S,
      RemoveItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    add: SetRecordTransaction<
      A,
      F,
      C,
      S,
      AddItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    subtract: SetRecordTransaction<
      A,
      F,
      C,
      S,
      SubtractItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    append: SetRecordTransaction<
      A,
      F,
      C,
      S,
      AppendItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    delete: SetRecordTransaction<
      A,
      F,
      C,
      S,
      DeleteItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    data: DataUpdateMethodRecordTransaction<
      A,
      F,
      C,
      S,
      Item<A, F, C, S, S["attributes"]>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
  };
  patch(key: AllTableIndexCompositeAttributes<A, F, C, S>): {
    set: SetRecordTransaction<
      A,
      F,
      C,
      S,
      SetItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    remove: RemoveRecordTransaction<
      A,
      F,
      C,
      S,
      RemoveItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    add: SetRecordTransaction<
      A,
      F,
      C,
      S,
      AddItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    subtract: SetRecordTransaction<
      A,
      F,
      C,
      S,
      SubtractItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    append: SetRecordTransaction<
      A,
      F,
      C,
      S,
      AppendItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    delete: SetRecordTransaction<
      A,
      F,
      C,
      S,
      DeleteItem<A, F, C, S>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
    data: DataUpdateMethodRecordTransaction<
      A,
      F,
      C,
      S,
      Item<A, F, C, S, S["attributes"]>,
      TableIndexCompositeAttributes<A, F, C, S>,
      ResponseItem<A, F, C, S>
    >;
  };
}

export class TransactGetEntity<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
> {
  readonly schema: S;
  constructor(schema: S);

  get(
    key: AllTableIndexCompositeAttributes<A, F, C, S>,
  ): GetOperationOptionsTransaction<
    A,
    F,
    C,
    S,
    ResponseItem<A, F, C, S>,
    TransactGetItem
  >;
}

type TransactWriteFunctionOptions = {
  token?: string;
  logger?: ElectroEventListener;
};

type TransactGetFunctionOptions = {};

type TransactWriteExtractedType<
  T extends readonly any[],
  A extends readonly any[] = [],
> = T extends [infer F, ...infer R]
  ? F extends CommittedTransactionResult<infer V, TransactWriteItem>
    ? TransactWriteExtractedType<R, [...A, TransactionItem<V>]>
    : never
  : A;

type TransactGetExtractedType<
  T extends readonly any[],
  A extends readonly any[] = [],
> = T extends [infer F, ...infer R]
  ? F extends CommittedTransactionResult<infer V, TransactGetItem>
    ? TransactGetExtractedType<R, [...A, TransactionItem<V>]>
    : never
  : A;

type TransactWriteEntities<
  E extends { [name: string]: Entity<any, any, any, any> },
> = {
  [EntityName in keyof E]: E[EntityName] extends Entity<
    infer A,
    infer F,
    infer C,
    infer S
  >
    ? TransactWriteEntity<A, F, C, S>
    : never;
};

type TransactGetEntities<
  E extends { [name: string]: Entity<any, any, any, any> },
> = {
  [EntityName in keyof E]: E[EntityName] extends Entity<
    infer A,
    infer F,
    infer C,
    infer S
  >
    ? TransactGetEntity<A, F, C, S>
    : never;
};

type TransactWriteFunction<
  E extends { [name: string]: Entity<any, any, any, any> },
  T,
  R extends ReadonlyArray<CommittedTransactionResult<T, TransactWriteItem>>,
> = (entities: TransactWriteEntities<E>) => [...R];

type TransactGetFunction<
  E extends { [name: string]: Entity<any, any, any, any> },
  T,
  R extends ReadonlyArray<CommittedTransactionResult<T, TransactGetItem>>,
> = (entities: TransactGetEntities<E>) => [...R];

export type ServiceConfiguration = {
  table?: string;
  client?: DocumentClient;
  listeners?: Array<ElectroEventListener>;
  logger?: ElectroEventListener;
};

declare function createWriteTransaction<
  E extends { [name: string]: Entity<any, any, any, any> },
  T,
  R extends ReadonlyArray<CommittedTransactionResult<T, TransactWriteItem>>,
>(
  entities: E,
  fn: TransactWriteFunction<E, T, R>,
): {
  go: (options?: TransactWriteFunctionOptions) => Promise<{
    canceled: boolean;
    data: TransactWriteExtractedType<R>;
  }>;
  params: <
    O extends TransactWriteFunctionOptions = TransactWriteFunctionOptions,
  >(
    options?: O,
  ) => TransactWriteCommandInput;
};

declare function createGetTransaction<
  E extends { [name: string]: Entity<any, any, any, any> },
  T,
  R extends ReadonlyArray<CommittedTransactionResult<T, TransactGetItem>>,
>(
  entities: E,
  fn: TransactGetFunction<E, T, R>,
): {
  go: (options?: TransactGetFunctionOptions) => Promise<{
    canceled: boolean;
    data: TransactGetExtractedType<R>;
  }>;
  params: <O extends TransactGetFunctionOptions = TransactGetFunctionOptions>(
    options?: O,
  ) => TransactGetCommandInput;
};

export class Service<E extends { [name: string]: Entity<any, any, any, any> }> {
  entities: E;
  collections: ClusteredCollectionQueries<
    E,
    ClusteredCollectionAssociations<E>
  > &
    IsolatedCollectionQueries<E, IsolatedCollectionAssociations<E>>;

  transaction: {
    write: <
      T,
      R extends ReadonlyArray<CommittedTransactionResult<T, TransactWriteItem>>,
    >(
      fn: TransactWriteFunction<E, T, R>,
    ) => {
      go: (options?: TransactWriteFunctionOptions) => Promise<{
        canceled: boolean;
        data: TransactWriteExtractedType<R>;
      }>;
      params: <
        O extends TransactWriteFunctionOptions = TransactWriteFunctionOptions,
      >(
        options?: O,
      ) => TransactWriteCommandInput;
    };

    get: <
      T,
      R extends ReadonlyArray<CommittedTransactionResult<T, TransactGetItem>>,
    >(
      fn: TransactGetFunction<E, T, R>,
    ) => {
      go: (options?: TransactGetFunctionOptions) => Promise<{
        canceled: boolean;
        data: TransactGetExtractedType<R>;
      }>;
      params: <
        O extends TransactGetFunctionOptions = TransactGetFunctionOptions,
      >(
        options?: O,
      ) => TransactGetCommandInput;
    };
  };

  constructor(entities: E, config?: ServiceConfiguration);

  setTableName(tableName: string): void;
  getTableName(): string | undefined;
  setClient(client: DocumentClient): void;
}

type CustomAttributeDefinition<T> = {
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly readOnly?: boolean;
  readonly get?: (val: T, item: any) => T | undefined | void;
  readonly set?: (val?: T, item?: any) => T | undefined | void;
  readonly default?: T | (() => T);
  readonly validate?: ((val: T) => boolean)
  readonly field?: string;
  readonly watch?: ReadonlyArray<string> | "*";
};

/** @depricated use 'CustomAttributeType' or 'OpaquePrimitiveType' instead */
declare function createCustomAttribute<
  T,
  A extends Readonly<CustomAttributeDefinition<T>> = Readonly<
    CustomAttributeDefinition<T>
  >,
>(definition?: A): A & { type: CustomAttributeTypeName<T> };

declare function CustomAttributeType<T>(
  base: T extends string
    ? "string"
    : T extends number
    ? "number"
    : T extends boolean
    ? "boolean"
    : "any",
): T extends string | number | boolean
  ? OpaquePrimitiveTypeName<T>
  : CustomAttributeTypeName<T>;

declare function createSchema<
  A extends string,
  F extends string,
  C extends string,
  S extends Schema<A, F, C>,
>(schema: S): S;