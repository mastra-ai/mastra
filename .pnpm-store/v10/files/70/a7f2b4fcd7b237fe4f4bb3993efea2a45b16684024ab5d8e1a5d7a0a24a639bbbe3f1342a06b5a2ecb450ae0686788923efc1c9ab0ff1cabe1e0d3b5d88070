import type { GenEnum, GenExtension, GenFile, GenMessage } from "../../../../codegenv2/types.js";
import type { FeatureSet } from "./descriptor_pb.js";
import type { Message } from "../../../../types.js";
/**
 * Describes the file google/protobuf/go_features.proto.
 */
export declare const file_google_protobuf_go_features: GenFile;
/**
 * @generated from message pb.GoFeatures
 */
export type GoFeatures = Message<"pb.GoFeatures"> & {
    /**
     * Whether or not to generate the deprecated UnmarshalJSON method for enums.
     * Can only be true for proto using the Open Struct api.
     *
     * @generated from field: optional bool legacy_unmarshal_json_enum = 1;
     */
    legacyUnmarshalJsonEnum: boolean;
    /**
     * One of OPEN, HYBRID or OPAQUE.
     *
     * @generated from field: optional pb.GoFeatures.APILevel api_level = 2;
     */
    apiLevel: GoFeatures_APILevel;
    /**
     * @generated from field: optional pb.GoFeatures.StripEnumPrefix strip_enum_prefix = 3;
     */
    stripEnumPrefix: GoFeatures_StripEnumPrefix;
};
/**
 * @generated from message pb.GoFeatures
 */
export type GoFeaturesJson = {
    /**
     * Whether or not to generate the deprecated UnmarshalJSON method for enums.
     * Can only be true for proto using the Open Struct api.
     *
     * @generated from field: optional bool legacy_unmarshal_json_enum = 1;
     */
    legacyUnmarshalJsonEnum?: boolean;
    /**
     * One of OPEN, HYBRID or OPAQUE.
     *
     * @generated from field: optional pb.GoFeatures.APILevel api_level = 2;
     */
    apiLevel?: GoFeatures_APILevelJson;
    /**
     * @generated from field: optional pb.GoFeatures.StripEnumPrefix strip_enum_prefix = 3;
     */
    stripEnumPrefix?: GoFeatures_StripEnumPrefixJson;
};
/**
 * Describes the message pb.GoFeatures.
 * Use `create(GoFeaturesSchema)` to create a new message.
 */
export declare const GoFeaturesSchema: GenMessage<GoFeatures, {
    jsonType: GoFeaturesJson;
}>;
/**
 * @generated from enum pb.GoFeatures.APILevel
 */
export declare enum GoFeatures_APILevel {
    /**
     * API_LEVEL_UNSPECIFIED results in selecting the OPEN API,
     * but needs to be a separate value to distinguish between
     * an explicitly set api level or a missing api level.
     *
     * @generated from enum value: API_LEVEL_UNSPECIFIED = 0;
     */
    API_LEVEL_UNSPECIFIED = 0,
    /**
     * @generated from enum value: API_OPEN = 1;
     */
    API_OPEN = 1,
    /**
     * @generated from enum value: API_HYBRID = 2;
     */
    API_HYBRID = 2,
    /**
     * @generated from enum value: API_OPAQUE = 3;
     */
    API_OPAQUE = 3
}
/**
 * @generated from enum pb.GoFeatures.APILevel
 */
export type GoFeatures_APILevelJson = "API_LEVEL_UNSPECIFIED" | "API_OPEN" | "API_HYBRID" | "API_OPAQUE";
/**
 * Describes the enum pb.GoFeatures.APILevel.
 */
export declare const GoFeatures_APILevelSchema: GenEnum<GoFeatures_APILevel, GoFeatures_APILevelJson>;
/**
 * @generated from enum pb.GoFeatures.StripEnumPrefix
 */
export declare enum GoFeatures_StripEnumPrefix {
    /**
     * @generated from enum value: STRIP_ENUM_PREFIX_UNSPECIFIED = 0;
     */
    UNSPECIFIED = 0,
    /**
     * @generated from enum value: STRIP_ENUM_PREFIX_KEEP = 1;
     */
    KEEP = 1,
    /**
     * @generated from enum value: STRIP_ENUM_PREFIX_GENERATE_BOTH = 2;
     */
    GENERATE_BOTH = 2,
    /**
     * @generated from enum value: STRIP_ENUM_PREFIX_STRIP = 3;
     */
    STRIP = 3
}
/**
 * @generated from enum pb.GoFeatures.StripEnumPrefix
 */
export type GoFeatures_StripEnumPrefixJson = "STRIP_ENUM_PREFIX_UNSPECIFIED" | "STRIP_ENUM_PREFIX_KEEP" | "STRIP_ENUM_PREFIX_GENERATE_BOTH" | "STRIP_ENUM_PREFIX_STRIP";
/**
 * Describes the enum pb.GoFeatures.StripEnumPrefix.
 */
export declare const GoFeatures_StripEnumPrefixSchema: GenEnum<GoFeatures_StripEnumPrefix, GoFeatures_StripEnumPrefixJson>;
/**
 * @generated from extension: optional pb.GoFeatures go = 1002;
 */
export declare const go: GenExtension<FeatureSet, GoFeatures>;
