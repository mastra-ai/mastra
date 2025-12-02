import { $SchemaRef, SchemaTraits } from "../schema/schema";
/**
 * @alpha
 */
export type StaticSchemaIdSimple = 0;
/**
 * @alpha
 */
export type StaticSchemaIdList = 1;
/**
 * @alpha
 */
export type StaticSchemaIdMap = 2;
/**
 * @alpha
 */
export type StaticSchemaIdStruct = 3;
/**
 * @alpha
 */
export type StaticSchemaIdError = -3;
/**
 * @alpha
 */
export type StaticSchemaIdOperation = 9;
/**
 * @alpha
 */
export type StaticSchema = StaticSimpleSchema | StaticListSchema | StaticMapSchema | StaticStructureSchema | StaticErrorSchema | StaticOperationSchema;
/**
 * @alpha
 */
export type ShapeName = string;
/**
 * @alpha
 */
export type ShapeNamespace = string;
/**
 * @alpha
 */
export type StaticSimpleSchema = [
    StaticSchemaIdSimple,
    ShapeNamespace,
    ShapeName,
    SchemaTraits,
    $SchemaRef
];
/**
 * @alpha
 */
export type StaticListSchema = [
    StaticSchemaIdList,
    ShapeNamespace,
    ShapeName,
    SchemaTraits,
    $SchemaRef
];
/**
 * @alpha
 */
export type StaticMapSchema = [
    StaticSchemaIdMap,
    ShapeNamespace,
    ShapeName,
    SchemaTraits,
    $SchemaRef,
    $SchemaRef
];
/**
 * @alpha
 */
export type StaticStructureSchema = [
    StaticSchemaIdStruct,
    ShapeNamespace,
    ShapeName,
    SchemaTraits,
    string[],
    $SchemaRef[]
];
/**
 * @alpha
 */
export type StaticErrorSchema = [
    StaticSchemaIdError,
    ShapeNamespace,
    ShapeName,
    SchemaTraits,
    string[],
    $SchemaRef[]
];
/**
 * @alpha
 */
export type StaticOperationSchema = [
    StaticSchemaIdOperation,
    ShapeNamespace,
    ShapeName,
    SchemaTraits,
    $SchemaRef,
    $SchemaRef
];
