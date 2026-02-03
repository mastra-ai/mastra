import type { FieldOption, JsonSchema, JsonSchemaProperty } from "./types";

/**
 * Gets the primary type from a JSON Schema property
 */
export const getPropertyType = (property: JsonSchemaProperty): string => {
  if (Array.isArray(property.type)) {
    // Return the first non-null type
    return property.type.find((t) => t !== "null") || "string";
  }
  return property.type || "string";
};

/**
 * Checks if a property has nested children (object or array of objects)
 */
export const hasNestedChildren = (property: JsonSchemaProperty): boolean => {
  const type = getPropertyType(property);

  if (type === "object" && property.properties) {
    return Object.keys(property.properties).length > 0;
  }

  if (type === "array" && property.items) {
    const itemType = getPropertyType(property.items);
    return itemType === "object" && !!property.items.properties;
  }

  return false;
};

/**
 * Extracts field options from JSON Schema properties at a given level
 */
export const getFieldOptionsFromProperties = (
  properties: Record<string, JsonSchemaProperty> | undefined,
  parentPath: string = ""
): FieldOption[] => {
  if (!properties) return [];

  return Object.entries(properties).map(([key, property]) => {
    const path = parentPath ? `${parentPath}.${key}` : key;
    const type = getPropertyType(property);
    const hasChildren = hasNestedChildren(property);

    return {
      path,
      label: property.title || key,
      type,
      hasChildren,
      children: type === "object" ? property.properties : undefined,
      items: type === "array" ? property.items : undefined,
    };
  });
};

/**
 * Gets field options from the root schema
 */
export const getFieldOptionsFromSchema = (schema: JsonSchema): FieldOption[] => {
  return getFieldOptionsFromProperties(schema.properties);
};

/**
 * Gets child field options for a given field option
 */
export const getChildFieldOptions = (
  fieldOption: FieldOption,
  currentPath: string
): FieldOption[] => {
  if (fieldOption.type === "object" && fieldOption.children) {
    return getFieldOptionsFromProperties(fieldOption.children, currentPath);
  }

  if (fieldOption.type === "array" && fieldOption.items) {
    const itemType = getPropertyType(fieldOption.items);
    if (itemType === "object" && fieldOption.items.properties) {
      // For arrays, we use the current path directly (user will access via index or iteration)
      return getFieldOptionsFromProperties(
        fieldOption.items.properties,
        currentPath
      );
    }
  }

  return [];
};

/**
 * Parses a field path into segments
 */
export const parseFieldPath = (path: string): string[] => {
  return path.split(".").filter(Boolean);
};

/**
 * Gets the field option at a specific path in the schema
 */
export const getFieldOptionAtPath = (
  schema: JsonSchema,
  path: string
): FieldOption | undefined => {
  const segments = parseFieldPath(path);
  if (segments.length === 0) return undefined;

  let currentProperties = schema.properties;
  let currentPath = "";
  let result: FieldOption | undefined;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!currentProperties || !currentProperties[segment]) {
      return undefined;
    }

    const property = currentProperties[segment];
    currentPath = currentPath ? `${currentPath}.${segment}` : segment;
    const type = getPropertyType(property);
    const hasChildren = hasNestedChildren(property);

    result = {
      path: currentPath,
      label: property.title || segment,
      type,
      hasChildren,
      children: type === "object" ? property.properties : undefined,
      items: type === "array" ? property.items : undefined,
    };

    // Navigate deeper
    if (type === "object" && property.properties) {
      currentProperties = property.properties;
    } else if (type === "array" && property.items?.properties) {
      currentProperties = property.items.properties;
    } else {
      currentProperties = undefined;
    }
  }

  return result;
};
