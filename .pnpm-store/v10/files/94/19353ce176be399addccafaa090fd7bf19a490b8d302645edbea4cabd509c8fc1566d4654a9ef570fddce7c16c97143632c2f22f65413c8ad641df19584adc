import type { GenEnum, GenExtension, GenFile, GenMessage } from "../../../../codegenv2/types.js";
import type { FeatureSet } from "./descriptor_pb.js";
import type { Message } from "../../../../types.js";
/**
 * Describes the file google/protobuf/cpp_features.proto.
 */
export declare const file_google_protobuf_cpp_features: GenFile;
/**
 * @generated from message pb.CppFeatures
 */
export type CppFeatures = Message<"pb.CppFeatures"> & {
    /**
     * Whether or not to treat an enum field as closed.  This option is only
     * applicable to enum fields, and will be removed in the future.  It is
     * consistent with the legacy behavior of using proto3 enum types for proto2
     * fields.
     *
     * @generated from field: optional bool legacy_closed_enum = 1;
     */
    legacyClosedEnum: boolean;
    /**
     * @generated from field: optional pb.CppFeatures.StringType string_type = 2;
     */
    stringType: CppFeatures_StringType;
    /**
     * @generated from field: optional bool enum_name_uses_string_view = 3;
     */
    enumNameUsesStringView: boolean;
};
/**
 * @generated from message pb.CppFeatures
 */
export type CppFeaturesJson = {
    /**
     * Whether or not to treat an enum field as closed.  This option is only
     * applicable to enum fields, and will be removed in the future.  It is
     * consistent with the legacy behavior of using proto3 enum types for proto2
     * fields.
     *
     * @generated from field: optional bool legacy_closed_enum = 1;
     */
    legacyClosedEnum?: boolean;
    /**
     * @generated from field: optional pb.CppFeatures.StringType string_type = 2;
     */
    stringType?: CppFeatures_StringTypeJson;
    /**
     * @generated from field: optional bool enum_name_uses_string_view = 3;
     */
    enumNameUsesStringView?: boolean;
};
/**
 * Describes the message pb.CppFeatures.
 * Use `create(CppFeaturesSchema)` to create a new message.
 */
export declare const CppFeaturesSchema: GenMessage<CppFeatures, {
    jsonType: CppFeaturesJson;
}>;
/**
 * @generated from enum pb.CppFeatures.StringType
 */
export declare enum CppFeatures_StringType {
    /**
     * @generated from enum value: STRING_TYPE_UNKNOWN = 0;
     */
    STRING_TYPE_UNKNOWN = 0,
    /**
     * @generated from enum value: VIEW = 1;
     */
    VIEW = 1,
    /**
     * @generated from enum value: CORD = 2;
     */
    CORD = 2,
    /**
     * @generated from enum value: STRING = 3;
     */
    STRING = 3
}
/**
 * @generated from enum pb.CppFeatures.StringType
 */
export type CppFeatures_StringTypeJson = "STRING_TYPE_UNKNOWN" | "VIEW" | "CORD" | "STRING";
/**
 * Describes the enum pb.CppFeatures.StringType.
 */
export declare const CppFeatures_StringTypeSchema: GenEnum<CppFeatures_StringType, CppFeatures_StringTypeJson>;
/**
 * @generated from extension: optional pb.CppFeatures cpp = 1000;
 */
export declare const cpp: GenExtension<FeatureSet, CppFeatures>;
