import { test } from "vitest";
import { GenericId } from "../values/index.js";
import { FieldTypeFromFieldPath } from "./data_model.js";
import { assert, Equals } from "../test/type_testing.js";

/**
 * Compile time tests to make sure our data model types are doing what we
 * expect.
 */
type Document = {
  _id: GenericId<"tableName">;
  stringField: string;
  nestedObject: {
    numberField: number;
    doublyNestedObject: {
      booleanField: boolean;
    };
  };
  optionalField?: string;
  nestedOptionalObject?: {
    numberField: number;
  };
};

// This method is doing some fancy inference so test it carefully.
test("FieldTypeFromFieldPath allows accessing all the primitives in the document", () => {
  assert<
    Equals<FieldTypeFromFieldPath<Document, "_id">, GenericId<"tableName">>
  >();
  assert<Equals<FieldTypeFromFieldPath<Document, "stringField">, string>>();
  assert<
    Equals<FieldTypeFromFieldPath<Document, "nestedObject.numberField">, number>
  >();
  assert<
    Equals<
      FieldTypeFromFieldPath<Document, "nestedOptionalObject.numberField">,
      number | undefined
    >
  >();
  assert<
    Equals<
      FieldTypeFromFieldPath<
        Document,
        "nestedObject.doublyNestedObject.booleanField"
      >,
      boolean
    >
  >();
});

test("FieldTypeFromFieldPath includes `undefined` if the fields is optional", () => {
  assert<
    Equals<
      FieldTypeFromFieldPath<Document, "optionalField">,
      string | undefined
    >
  >();
});

test("FieldTypeFromFieldPath resolves to undefined if it can't find a field", () => {
  assert<Equals<FieldTypeFromFieldPath<Document, "missingField">, undefined>>();
  assert<
    Equals<
      FieldTypeFromFieldPath<Document, "missingField.nestedField">,
      undefined
    >
  >();
  assert<
    Equals<
      FieldTypeFromFieldPath<Document, "stringField.nestedField">,
      undefined
    >
  >();
  assert<Equals<FieldTypeFromFieldPath<Document, "">, undefined>>();
});

type DocumentWithUnion =
  | {
      _id: GenericId<"tableName">;
      _creationTime: number;
      tag: "A";
      stringField: string;
      a: string;
      nestedObject: {
        numberField: number;
      };
    }
  | {
      _id: GenericId<"tableName">;
      _creationTime: number;
      tag: "B";
      stringField: string;
      b: number;
    };

test("FieldTypeFromFieldPath with unions", () => {
  assert<
    Equals<FieldTypeFromFieldPath<DocumentWithUnion, "a">, string | undefined>
  >();
  assert<
    Equals<FieldTypeFromFieldPath<DocumentWithUnion, "b">, number | undefined>
  >();
  assert<Equals<FieldTypeFromFieldPath<DocumentWithUnion, "tag">, "A" | "B">>();
  assert<
    Equals<
      FieldTypeFromFieldPath<DocumentWithUnion, "nestedObject.numberField">,
      number | undefined
    >
  >();
});

type DocumentWithMixedTypes = {
  _id: GenericId<"tableName">;
  // This field can be either a document or a primitive value
  mixedField:
    | {
        nestedValue: string;
      }
    | number;
  // This is a document with a field that can be a document or primitive
  container: {
    mixedField:
      | {
          nestedValue: boolean;
        }
      | string;
  };
  // Array of documents
  documentArray: Array<{
    value: number;
  }>;
  // Optional mixed field
  optionalMixedField?:
    | {
        nestedValue: number;
      }
    | string;
};

test("FieldTypeFromFieldPath handles fields that can be either documents or primitive values", () => {
  // When accessing a nested path on a field that could be a document or primitive,
  // we should get the nested value type or undefined
  assert<
    Equals<
      FieldTypeFromFieldPath<DocumentWithMixedTypes, "mixedField.nestedValue">,
      string | undefined
    >
  >();

  // Nested mixed field inside a document
  assert<
    Equals<
      FieldTypeFromFieldPath<
        DocumentWithMixedTypes,
        "container.mixedField.nestedValue"
      >,
      boolean | undefined
    >
  >();

  // Optional mixed field
  assert<
    Equals<
      FieldTypeFromFieldPath<
        DocumentWithMixedTypes,
        "optionalMixedField.nestedValue"
      >,
      number | undefined
    >
  >();

  // Accessing the mixed field directly should return the union type
  assert<
    Equals<
      FieldTypeFromFieldPath<DocumentWithMixedTypes, "mixedField">,
      { nestedValue: string } | number
    >
  >();

  // We can't access array elements by index in the path, but this tests
  // that we handle array types correctly
  assert<
    Equals<
      FieldTypeFromFieldPath<DocumentWithMixedTypes, "documentArray">,
      Array<{ value: number }>
    >
  >();
});

// Test for deeply nested mixed types
type DeepMixedDocument = {
  level1: {
    level2:
      | {
          level3:
            | {
                value: string;
              }
            | number;
        }
      | boolean;
  };
};

test("FieldTypeFromFieldPath handles deeply nested mixed types", () => {
  // Deep path where intermediate fields could be non-documents
  assert<
    Equals<
      FieldTypeFromFieldPath<DeepMixedDocument, "level1.level2.level3.value">,
      string | undefined
    >
  >();

  // Accessing intermediate fields
  assert<
    Equals<
      FieldTypeFromFieldPath<DeepMixedDocument, "level1.level2">,
      { level3: { value: string } | number } | boolean
    >
  >();
});
