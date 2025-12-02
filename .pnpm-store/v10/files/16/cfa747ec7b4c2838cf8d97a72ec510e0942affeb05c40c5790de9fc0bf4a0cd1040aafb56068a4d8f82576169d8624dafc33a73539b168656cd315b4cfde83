import { BetterAuthOptions } from "@better-auth/core";
import { DBAdapter } from "@better-auth/core/db/adapter";

//#region src/adapters/test.d.ts
interface AdapterTestOptions {
  getAdapter: (customOptions?: Omit<BetterAuthOptions, "database">) => Promise<DBAdapter<BetterAuthOptions>> | DBAdapter<BetterAuthOptions>;
  disableTests?: Partial<Record<keyof typeof adapterTests, boolean>>;
  testPrefix?: string;
}
interface NumberIdAdapterTestOptions {
  getAdapter: (customOptions?: Omit<BetterAuthOptions, "database">) => Promise<DBAdapter<BetterAuthOptions>>;
  disableTests?: Partial<Record<keyof typeof numberIdAdapterTests, boolean>>;
  testPrefix?: string;
}
declare const adapterTests: {
  readonly CREATE_MODEL: "create model";
  readonly CREATE_MODEL_SHOULD_ALWAYS_RETURN_AN_ID: "create model should always return an id";
  readonly FIND_MODEL: "find model";
  readonly FIND_MODEL_WITHOUT_ID: "find model without id";
  readonly FIND_MODEL_WITH_SELECT: "find model with select";
  readonly FIND_MODEL_WITH_MODIFIED_FIELD_NAME: "find model with modified field name";
  readonly UPDATE_MODEL: "update model";
  readonly SHOULD_FIND_MANY: "should find many";
  readonly SHOULD_FIND_MANY_WITH_WHERE: "should find many with where";
  readonly SHOULD_FIND_MANY_WITH_OPERATORS: "should find many with operators";
  readonly SHOULD_WORK_WITH_REFERENCE_FIELDS: "should work with reference fields";
  readonly SHOULD_FIND_MANY_WITH_NOT_IN_OPERATOR: "should find many with not in operator";
  readonly SHOULD_FIND_MANY_WITH_SORT_BY: "should find many with sortBy";
  readonly SHOULD_FIND_MANY_WITH_LIMIT: "should find many with limit";
  readonly SHOULD_FIND_MANY_WITH_OFFSET: "should find many with offset";
  readonly SHOULD_UPDATE_WITH_MULTIPLE_WHERE: "should update with multiple where";
  readonly DELETE_MODEL: "delete model";
  readonly SHOULD_DELETE_MANY: "should delete many";
  readonly SHOULD_NOT_THROW_ON_DELETE_RECORD_NOT_FOUND: "shouldn't throw on delete record not found";
  readonly SHOULD_NOT_THROW_ON_RECORD_NOT_FOUND: "shouldn't throw on record not found";
  readonly SHOULD_FIND_MANY_WITH_CONTAINS_OPERATOR: "should find many with contains operator";
  readonly SHOULD_SEARCH_USERS_WITH_STARTS_WITH: "should search users with startsWith";
  readonly SHOULD_SEARCH_USERS_WITH_ENDS_WITH: "should search users with endsWith";
  readonly SHOULD_PREFER_GENERATE_ID_IF_PROVIDED: "should prefer generateId if provided";
  readonly SHOULD_ROLLBACK_FAILING_TRANSACTION: "should rollback failing transaction";
  readonly SHOULD_RETURN_TRANSACTION_RESULT: "should return transaction result";
  readonly SHOULD_FIND_MANY_WITH_CONNECTORS: "should find many with connectors";
};
declare const numberIdAdapterTests: {
  SHOULD_RETURN_A_NUMBER_ID_AS_A_RESULT: string;
  SHOULD_INCREMENT_THE_ID_BY_1: string;
  CREATE_MODEL: "create model";
  CREATE_MODEL_SHOULD_ALWAYS_RETURN_AN_ID: "create model should always return an id";
  FIND_MODEL: "find model";
  FIND_MODEL_WITHOUT_ID: "find model without id";
  FIND_MODEL_WITH_SELECT: "find model with select";
  FIND_MODEL_WITH_MODIFIED_FIELD_NAME: "find model with modified field name";
  UPDATE_MODEL: "update model";
  SHOULD_FIND_MANY: "should find many";
  SHOULD_FIND_MANY_WITH_WHERE: "should find many with where";
  SHOULD_FIND_MANY_WITH_OPERATORS: "should find many with operators";
  SHOULD_WORK_WITH_REFERENCE_FIELDS: "should work with reference fields";
  SHOULD_FIND_MANY_WITH_NOT_IN_OPERATOR: "should find many with not in operator";
  SHOULD_FIND_MANY_WITH_SORT_BY: "should find many with sortBy";
  SHOULD_FIND_MANY_WITH_LIMIT: "should find many with limit";
  SHOULD_FIND_MANY_WITH_OFFSET: "should find many with offset";
  SHOULD_UPDATE_WITH_MULTIPLE_WHERE: "should update with multiple where";
  DELETE_MODEL: "delete model";
  SHOULD_DELETE_MANY: "should delete many";
  SHOULD_NOT_THROW_ON_DELETE_RECORD_NOT_FOUND: "shouldn't throw on delete record not found";
  SHOULD_NOT_THROW_ON_RECORD_NOT_FOUND: "shouldn't throw on record not found";
  SHOULD_FIND_MANY_WITH_CONTAINS_OPERATOR: "should find many with contains operator";
  SHOULD_SEARCH_USERS_WITH_STARTS_WITH: "should search users with startsWith";
  SHOULD_SEARCH_USERS_WITH_ENDS_WITH: "should search users with endsWith";
  SHOULD_PREFER_GENERATE_ID_IF_PROVIDED: "should prefer generateId if provided";
  SHOULD_ROLLBACK_FAILING_TRANSACTION: "should rollback failing transaction";
  SHOULD_RETURN_TRANSACTION_RESULT: "should return transaction result";
  SHOULD_FIND_MANY_WITH_CONNECTORS: "should find many with connectors";
};
declare function runAdapterTest(opts: AdapterTestOptions): void;
declare function runNumberIdAdapterTest(opts: NumberIdAdapterTestOptions): void;
declare function recoverProcessTZ(): {
  [Symbol.dispose]: () => void;
};
//#endregion
export { recoverProcessTZ, runAdapterTest, runNumberIdAdapterTest };