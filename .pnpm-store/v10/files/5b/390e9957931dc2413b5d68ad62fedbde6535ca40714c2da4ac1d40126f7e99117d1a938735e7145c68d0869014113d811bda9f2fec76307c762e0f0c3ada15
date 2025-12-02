import type { GenEnum, GenExtension, GenFile, GenMessage } from "../../../../codegenv2/types.js";
import type { FeatureSet } from "./descriptor_pb.js";
import type { Message } from "../../../../types.js";
/**
 * Describes the file google/protobuf/java_features.proto.
 */
export declare const file_google_protobuf_java_features: GenFile;
/**
 * @generated from message pb.JavaFeatures
 */
export type JavaFeatures = Message<"pb.JavaFeatures"> & {
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
     * @generated from field: optional pb.JavaFeatures.Utf8Validation utf8_validation = 2;
     */
    utf8Validation: JavaFeatures_Utf8Validation;
    /**
     * Allows creation of large Java enums, extending beyond the standard
     * constant limits imposed by the Java language.
     *
     * @generated from field: optional bool large_enum = 3;
     */
    largeEnum: boolean;
    /**
     * Whether to use the old default outer class name scheme, or the new feature
     * which adds a "Proto" suffix to the outer class name.
     *
     * Users will not be able to set this option, because we removed it in the
     * same edition that it was introduced. But we use it to determine which
     * naming scheme to use for outer class name defaults.
     *
     * @generated from field: optional bool use_old_outer_classname_default = 4;
     */
    useOldOuterClassnameDefault: boolean;
    /**
     * Whether to nest the generated class in the generated file class. This is
     * only applicable to *top-level* messages, enums, and services.
     *
     * @generated from field: optional pb.JavaFeatures.NestInFileClassFeature.NestInFileClass nest_in_file_class = 5;
     */
    nestInFileClass: JavaFeatures_NestInFileClassFeature_NestInFileClass;
};
/**
 * @generated from message pb.JavaFeatures
 */
export type JavaFeaturesJson = {
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
     * @generated from field: optional pb.JavaFeatures.Utf8Validation utf8_validation = 2;
     */
    utf8Validation?: JavaFeatures_Utf8ValidationJson;
    /**
     * Allows creation of large Java enums, extending beyond the standard
     * constant limits imposed by the Java language.
     *
     * @generated from field: optional bool large_enum = 3;
     */
    largeEnum?: boolean;
    /**
     * Whether to use the old default outer class name scheme, or the new feature
     * which adds a "Proto" suffix to the outer class name.
     *
     * Users will not be able to set this option, because we removed it in the
     * same edition that it was introduced. But we use it to determine which
     * naming scheme to use for outer class name defaults.
     *
     * @generated from field: optional bool use_old_outer_classname_default = 4;
     */
    useOldOuterClassnameDefault?: boolean;
    /**
     * Whether to nest the generated class in the generated file class. This is
     * only applicable to *top-level* messages, enums, and services.
     *
     * @generated from field: optional pb.JavaFeatures.NestInFileClassFeature.NestInFileClass nest_in_file_class = 5;
     */
    nestInFileClass?: JavaFeatures_NestInFileClassFeature_NestInFileClassJson;
};
/**
 * Describes the message pb.JavaFeatures.
 * Use `create(JavaFeaturesSchema)` to create a new message.
 */
export declare const JavaFeaturesSchema: GenMessage<JavaFeatures, {
    jsonType: JavaFeaturesJson;
}>;
/**
 * @generated from message pb.JavaFeatures.NestInFileClassFeature
 */
export type JavaFeatures_NestInFileClassFeature = Message<"pb.JavaFeatures.NestInFileClassFeature"> & {};
/**
 * @generated from message pb.JavaFeatures.NestInFileClassFeature
 */
export type JavaFeatures_NestInFileClassFeatureJson = {};
/**
 * Describes the message pb.JavaFeatures.NestInFileClassFeature.
 * Use `create(JavaFeatures_NestInFileClassFeatureSchema)` to create a new message.
 */
export declare const JavaFeatures_NestInFileClassFeatureSchema: GenMessage<JavaFeatures_NestInFileClassFeature, {
    jsonType: JavaFeatures_NestInFileClassFeatureJson;
}>;
/**
 * @generated from enum pb.JavaFeatures.NestInFileClassFeature.NestInFileClass
 */
export declare enum JavaFeatures_NestInFileClassFeature_NestInFileClass {
    /**
     * Invalid default, which should never be used.
     *
     * @generated from enum value: NEST_IN_FILE_CLASS_UNKNOWN = 0;
     */
    NEST_IN_FILE_CLASS_UNKNOWN = 0,
    /**
     * Do not nest the generated class in the file class.
     *
     * @generated from enum value: NO = 1;
     */
    NO = 1,
    /**
     * Nest the generated class in the file class.
     *
     * @generated from enum value: YES = 2;
     */
    YES = 2,
    /**
     * Fall back to the `java_multiple_files` option. Users won't be able to
     * set this option.
     *
     * @generated from enum value: LEGACY = 3;
     */
    LEGACY = 3
}
/**
 * @generated from enum pb.JavaFeatures.NestInFileClassFeature.NestInFileClass
 */
export type JavaFeatures_NestInFileClassFeature_NestInFileClassJson = "NEST_IN_FILE_CLASS_UNKNOWN" | "NO" | "YES" | "LEGACY";
/**
 * Describes the enum pb.JavaFeatures.NestInFileClassFeature.NestInFileClass.
 */
export declare const JavaFeatures_NestInFileClassFeature_NestInFileClassSchema: GenEnum<JavaFeatures_NestInFileClassFeature_NestInFileClass, JavaFeatures_NestInFileClassFeature_NestInFileClassJson>;
/**
 * The UTF8 validation strategy to use.
 *
 * @generated from enum pb.JavaFeatures.Utf8Validation
 */
export declare enum JavaFeatures_Utf8Validation {
    /**
     * Invalid default, which should never be used.
     *
     * @generated from enum value: UTF8_VALIDATION_UNKNOWN = 0;
     */
    UTF8_VALIDATION_UNKNOWN = 0,
    /**
     * Respect the UTF8 validation behavior specified by the global
     * utf8_validation feature.
     *
     * @generated from enum value: DEFAULT = 1;
     */
    DEFAULT = 1,
    /**
     * Verifies UTF8 validity overriding the global utf8_validation
     * feature. This represents the legacy java_string_check_utf8 option.
     *
     * @generated from enum value: VERIFY = 2;
     */
    VERIFY = 2
}
/**
 * The UTF8 validation strategy to use.
 *
 * @generated from enum pb.JavaFeatures.Utf8Validation
 */
export type JavaFeatures_Utf8ValidationJson = "UTF8_VALIDATION_UNKNOWN" | "DEFAULT" | "VERIFY";
/**
 * Describes the enum pb.JavaFeatures.Utf8Validation.
 */
export declare const JavaFeatures_Utf8ValidationSchema: GenEnum<JavaFeatures_Utf8Validation, JavaFeatures_Utf8ValidationJson>;
/**
 * @generated from extension: optional pb.JavaFeatures java = 1001;
 */
export declare const java: GenExtension<FeatureSet, JavaFeatures>;
