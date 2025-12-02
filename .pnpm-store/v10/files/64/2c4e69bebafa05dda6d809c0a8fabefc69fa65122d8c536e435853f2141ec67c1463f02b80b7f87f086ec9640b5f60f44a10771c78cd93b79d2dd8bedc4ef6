import { Context } from "../../bundler/context.js";
import { SystemIndexes } from "../../server/system_fields.js";
import {
  ComponentDirectory,
  toComponentDefinitionPath,
} from "../lib/components/definition/directoryStructure.js";
import {
  AnalyzedSchema,
  TableDefinition,
} from "../lib/deployApi/componentDefinition.js";
import { StartPushResponse } from "../lib/deployApi/startPush.js";
import { ConvexValidator } from "../lib/deployApi/validator.js";
import { compareStrings, header } from "./common.js";
import { validatorToType } from "./validator_helpers.js";

const NO_SCHEMA_DATA_MODEL_CONTENT = `
  ${header("Generated data model types.")}
  import { AnyDataModel } from "convex/server";
  import type { GenericId } from "convex/values";

  /**
   * No \`schema.ts\` file found!
   *
   * This generated code has permissive types like \`Doc = any\` because
   * Convex doesn't know your schema. If you'd like more type safety, see
   * https://docs.convex.dev/using/schemas for instructions on how to add a
   * schema file.
   *
   * After you change a schema, rerun codegen with \`npx convex dev\`.
   */

  /**
   * The names of all of your Convex tables.
   */
  export type TableNames = string;

  /**
   * The type of a document stored in Convex.
   */
  export type Doc = any;

  /**
   * An identifier for a document in Convex.
   *
   * Convex documents are uniquely identified by their \`Id\`, which is accessible
   * on the \`_id\` field. To learn more, see [Document IDs](https://docs.convex.dev/using/document-ids).
   *
   * Documents can be loaded using \`db.get(id)\` in query and mutation functions.
   *
   * IDs are just strings at runtime, but this type can be used to distinguish them from other
   * strings when type checking.
   */
  export type Id<TableName extends TableNames = TableNames> = GenericId<TableName>;

  /**
   * A type describing your Convex data model.
   *
   * This type includes information about what tables you have, the type of
   * documents stored in those tables, and the indexes defined on them.
   *
   * This type is used to parameterize methods like \`queryGeneric\` and
   * \`mutationGeneric\` to make them type-safe.
   */
  export type DataModel = AnyDataModel;`;

export function noSchemaDataModelDTS() {
  return NO_SCHEMA_DATA_MODEL_CONTENT;
}

export function noSchemaDataModelTS() {
  return NO_SCHEMA_DATA_MODEL_CONTENT;
}

const dynamicDataModelContent = `
  ${header("Generated data model types.")}
  import type { DataModelFromSchemaDefinition, DocumentByName, TableNamesInDataModel, SystemTableNames } from "convex/server";
  import type { GenericId } from "convex/values";
  import schema from "../schema.js";

  /**
   * The names of all of your Convex tables.
   */
  export type TableNames = TableNamesInDataModel<DataModel>;

  /**
   * The type of a document stored in Convex.
   *
   * @typeParam TableName - A string literal type of the table name (like "users").
   */
  export type Doc<TableName extends TableNames> = DocumentByName<DataModel, TableName>;

  /**
   * An identifier for a document in Convex.
   *
   * Convex documents are uniquely identified by their \`Id\`, which is accessible
   * on the \`_id\` field. To learn more, see [Document IDs](https://docs.convex.dev/using/document-ids).
   *
   * Documents can be loaded using \`db.get(id)\` in query and mutation functions.
   *
   * IDs are just strings at runtime, but this type can be used to distinguish them from other
   * strings when type checking.
   *
   * @typeParam TableName - A string literal type of the table name (like "users").
   */
  export type Id<TableName extends TableNames | SystemTableNames> = GenericId<TableName>;

  /**
   * A type describing your Convex data model.
   *
   * This type includes information about what tables you have, the type of
   * documents stored in those tables, and the indexes defined on them.
   *
   * This type is used to parameterize methods like \`queryGeneric\` and
   * \`mutationGeneric\` to make them type-safe.
   */
  export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
  `;

export function dynamicDataModelDTS() {
  return dynamicDataModelContent;
}

export function dynamicDataModelTS() {
  return dynamicDataModelContent;
}

async function staticDataModelImpl(
  ctx: Context,
  startPush: StartPushResponse,
  rootComponent: ComponentDirectory,
  componentDirectory: ComponentDirectory,
  useTypeScript: boolean,
): Promise<string> {
  const definitionPath = toComponentDefinitionPath(
    rootComponent,
    componentDirectory,
  );

  const analysis = startPush.analysis[definitionPath];
  if (!analysis) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `No analysis found for component ${definitionPath} orig: ${definitionPath}\nin\n${Object.keys(startPush.analysis).toString()}`,
    });
  }
  if (!analysis.schema) {
    return useTypeScript ? noSchemaDataModelTS() : noSchemaDataModelDTS();
  }

  const lines = [
    header("Generated data model types."),
    `import type { DocumentByName, TableNamesInDataModel, SystemTableNames, AnyDataModel } from "convex/server";`,
    `import type { GenericId } from "convex/values";`,
  ];
  for await (const line of codegenDataModel(ctx, analysis.schema)) {
    lines.push(line);
  }
  lines.push(`
    /**
     * The names of all of your Convex tables.
     */
    export type TableNames = TableNamesInDataModel<DataModel>;

    /**
     * The type of a document stored in Convex.
     *
     * @typeParam TableName - A string literal type of the table name (like "users").
     */
    export type Doc<TableName extends TableNames> = DocumentByName<DataModel, TableName>;

    /**
     * An identifier for a document in Convex.
     *
     * Convex documents are uniquely identified by their \`Id\`, which is accessible
     * on the \`_id\` field. To learn more, see [Document IDs](https://docs.convex.dev/using/document-ids).
     *
     * Documents can be loaded using \`db.get(id)\` in query and mutation functions.
     *
     * IDs are just strings at runtime, but this type can be used to distinguish them from other
     * strings when type checking.
     *
     * @typeParam TableName - A string literal type of the table name (like "users").
     */
    export type Id<TableName extends TableNames | SystemTableNames> = GenericId<TableName>;
    `);

  return lines.join("\n");
}

export async function staticDataModelDTS(
  ctx: Context,
  startPush: StartPushResponse,
  rootComponent: ComponentDirectory,
  componentDirectory: ComponentDirectory,
) {
  return staticDataModelImpl(
    ctx,
    startPush,
    rootComponent,
    componentDirectory,
    false,
  );
}

// Used for components and root
export async function staticDataModelTS(
  ctx: Context,
  startPush: StartPushResponse,
  rootComponent: ComponentDirectory,
  componentDirectory: ComponentDirectory,
) {
  return staticDataModelImpl(
    ctx,
    startPush,
    rootComponent,
    componentDirectory,
    true,
  );
}

async function* codegenDataModel(ctx: Context, schema: AnalyzedSchema) {
  yield `
    /**
     * A type describing your Convex data model.
     *
     * This type includes information about what tables you have, the type of
     * documents stored in those tables, and the indexes defined on them.
     *
     * This type is used to parameterize methods like \`queryGeneric\` and
     * \`mutationGeneric\` to make them type-safe.
     */
  `;
  const tables = [...schema.tables];
  tables.sort((a, b) => compareStrings(a.tableName, b.tableName));

  yield `export type DataModel = {`;
  for (const table of tables) {
    yield `  ${table.tableName}:`;
    yield* codegenTable(ctx, table);
    yield `,`;
  }
  yield `}`;
  if (!schema.schemaValidation) {
    yield ` & AnyDataModel`;
  }
  yield `;`;
}

async function* codegenTable(ctx: Context, table: TableDefinition) {
  const documentType = await addSystemFields(
    ctx,
    table.tableName,
    table.documentType,
  );

  const indexJson: Record<string, string[]> = {};
  for (const index of table.indexes) {
    indexJson[index.indexDescriptor] = index.fields;
  }

  yield `{`;
  yield `  document: ${validatorToType(documentType, true)},`;

  const fieldPaths = new Set<string>();
  for (const fieldPath of extractFieldPaths(documentType)) {
    fieldPaths.add(fieldPath.join("."));
  }
  yield `  fieldPaths: ${stringLiteralUnionType(Array.from(fieldPaths).sort(compareStrings))},`;

  yield `  indexes: {`;
  const systemIndexes: SystemIndexes = {
    by_id: ["_id"],
    by_creation_time: ["_creationTime"],
  };
  const indexes: Record<string, string[]> = {};
  for (const [indexDescriptor, fields] of Object.entries(systemIndexes)) {
    indexes[indexDescriptor] = fields;
  }
  for (const index of table.indexes) {
    if (indexes[index.indexDescriptor]) {
      yield await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Duplicate index name ${index.indexDescriptor} in table ${table.tableName}.`,
      });
    }
    indexes[index.indexDescriptor] = index.fields;
  }
  for (const [indexDescriptor, fields] of Object.entries(indexes)) {
    yield `    "${indexDescriptor}": ${JSON.stringify(fields)},`;
  }
  yield `  },`;

  yield `  searchIndexes: {`;
  for (const index of table.searchIndexes ?? []) {
    yield `    "${index.indexDescriptor}": {`;
    yield `      searchField: "${index.searchField}",`;
    yield `      filterFields: ${stringLiteralUnionType(index.filterFields)},`;
    yield `    },`;
  }
  yield `  },`;

  yield `  vectorIndexes: {`;
  for (const index of table.vectorIndexes ?? []) {
    yield `    "${index.indexDescriptor}": {`;
    yield `      vectorField: "${index.vectorField}",`;
    yield `      dimensions: number,`;
    yield `      filterFields: ${stringLiteralUnionType(index.filterFields)},`;
    yield `    },`;
  }
  yield `  },`;
  yield `}`;
}

const SYSTEM_FIELDS = ["_id", "_creationTime"];

async function addSystemFields(
  ctx: Context,
  tableName: string,
  validator: ConvexValidator,
): Promise<ConvexValidator> {
  if (validator.type === "object") {
    return addSystemFieldsToObject(ctx, tableName, validator);
  } else if (validator.type === "any") {
    return { type: "any" };
  } else if (validator.type === "union") {
    const newSubValidators = [];
    for (const subValidator of validator.value) {
      const newSubValidator = await addSystemFieldsToObject(
        ctx,
        tableName,
        subValidator,
      );
      newSubValidators.push(newSubValidator);
    }
    return { type: "union", value: newSubValidators };
  } else {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Invalid top-level validator for ${tableName}.`,
    });
  }
}

async function addSystemFieldsToObject(
  ctx: Context,
  tableName: string,
  validator: ConvexValidator,
): Promise<ConvexValidator> {
  if (validator.type !== "object") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `System fields can only be added to objects.`,
    });
  }
  for (const systemField of SYSTEM_FIELDS) {
    if (Object.hasOwn(validator.value, systemField)) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `System field ${systemField} present in table ${tableName}.`,
      });
    }
  }
  return {
    type: "object",
    value: {
      ...validator.value,
      _id: {
        fieldType: { type: "id", tableName },
        optional: false,
      },
      _creationTime: {
        fieldType: { type: "number" },
        optional: false,
      },
    },
  };
}

function* extractFieldPaths(validator: ConvexValidator): Generator<string[]> {
  if (validator.type === "object") {
    for (const [fieldName, fieldValidator] of Object.entries(validator.value)) {
      yield [fieldName];
      for (const subFieldPath of extractFieldPaths(fieldValidator.fieldType)) {
        if (subFieldPath.length > 0) {
          yield [fieldName, ...subFieldPath];
        }
      }
    }
  } else if (validator.type === "union") {
    for (const subValidator of validator.value) {
      yield* extractFieldPaths(subValidator);
    }
  } else if (validator.type === "record") {
    yield ["${string}"];
  } else {
    yield [];
  }
}

function stringLiteralUnionType(fields: string[]) {
  if (fields.length === 0) {
    return "never";
  } else {
    return fields
      .map((field) => (field.includes("${") ? `\`${field}\`` : `"${field}"`))
      .join(" | ");
  }
}
