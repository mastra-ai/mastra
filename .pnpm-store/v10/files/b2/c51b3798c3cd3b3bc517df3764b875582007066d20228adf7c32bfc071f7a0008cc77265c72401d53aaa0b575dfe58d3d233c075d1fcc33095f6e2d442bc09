import type { GenFile, GenMessage } from "../../../../codegenv2/types.js";
import type { SourceContext, SourceContextJson } from "./source_context_pb.js";
import type { Option, OptionJson, Syntax, SyntaxJson } from "./type_pb.js";
import type { Message } from "../../../../types.js";
/**
 * Describes the file google/protobuf/api.proto.
 */
export declare const file_google_protobuf_api: GenFile;
/**
 * Api is a light-weight descriptor for an API Interface.
 *
 * Interfaces are also described as "protocol buffer services" in some contexts,
 * such as by the "service" keyword in a .proto file, but they are different
 * from API Services, which represent a concrete implementation of an interface
 * as opposed to simply a description of methods and bindings. They are also
 * sometimes simply referred to as "APIs" in other contexts, such as the name of
 * this message itself. See https://cloud.google.com/apis/design/glossary for
 * detailed terminology.
 *
 * New usages of this message as an alternative to ServiceDescriptorProto are
 * strongly discouraged. This message does not reliability preserve all
 * information necessary to model the schema and preserve semantics. Instead
 * make use of FileDescriptorSet which preserves the necessary information.
 *
 * @generated from message google.protobuf.Api
 */
export type Api = Message<"google.protobuf.Api"> & {
    /**
     * The fully qualified name of this interface, including package name
     * followed by the interface's simple name.
     *
     * @generated from field: string name = 1;
     */
    name: string;
    /**
     * The methods of this interface, in unspecified order.
     *
     * @generated from field: repeated google.protobuf.Method methods = 2;
     */
    methods: Method[];
    /**
     * Any metadata attached to the interface.
     *
     * @generated from field: repeated google.protobuf.Option options = 3;
     */
    options: Option[];
    /**
     * A version string for this interface. If specified, must have the form
     * `major-version.minor-version`, as in `1.10`. If the minor version is
     * omitted, it defaults to zero. If the entire version field is empty, the
     * major version is derived from the package name, as outlined below. If the
     * field is not empty, the version in the package name will be verified to be
     * consistent with what is provided here.
     *
     * The versioning schema uses [semantic
     * versioning](http://semver.org) where the major version number
     * indicates a breaking change and the minor version an additive,
     * non-breaking change. Both version numbers are signals to users
     * what to expect from different versions, and should be carefully
     * chosen based on the product plan.
     *
     * The major version is also reflected in the package name of the
     * interface, which must end in `v<major-version>`, as in
     * `google.feature.v1`. For major versions 0 and 1, the suffix can
     * be omitted. Zero major versions must only be used for
     * experimental, non-GA interfaces.
     *
     *
     * @generated from field: string version = 4;
     */
    version: string;
    /**
     * Source context for the protocol buffer service represented by this
     * message.
     *
     * @generated from field: google.protobuf.SourceContext source_context = 5;
     */
    sourceContext?: SourceContext;
    /**
     * Included interfaces. See [Mixin][].
     *
     * @generated from field: repeated google.protobuf.Mixin mixins = 6;
     */
    mixins: Mixin[];
    /**
     * The source syntax of the service.
     *
     * @generated from field: google.protobuf.Syntax syntax = 7;
     */
    syntax: Syntax;
    /**
     * The source edition string, only valid when syntax is SYNTAX_EDITIONS.
     *
     * @generated from field: string edition = 8;
     */
    edition: string;
};
/**
 * Api is a light-weight descriptor for an API Interface.
 *
 * Interfaces are also described as "protocol buffer services" in some contexts,
 * such as by the "service" keyword in a .proto file, but they are different
 * from API Services, which represent a concrete implementation of an interface
 * as opposed to simply a description of methods and bindings. They are also
 * sometimes simply referred to as "APIs" in other contexts, such as the name of
 * this message itself. See https://cloud.google.com/apis/design/glossary for
 * detailed terminology.
 *
 * New usages of this message as an alternative to ServiceDescriptorProto are
 * strongly discouraged. This message does not reliability preserve all
 * information necessary to model the schema and preserve semantics. Instead
 * make use of FileDescriptorSet which preserves the necessary information.
 *
 * @generated from message google.protobuf.Api
 */
export type ApiJson = {
    /**
     * The fully qualified name of this interface, including package name
     * followed by the interface's simple name.
     *
     * @generated from field: string name = 1;
     */
    name?: string;
    /**
     * The methods of this interface, in unspecified order.
     *
     * @generated from field: repeated google.protobuf.Method methods = 2;
     */
    methods?: MethodJson[];
    /**
     * Any metadata attached to the interface.
     *
     * @generated from field: repeated google.protobuf.Option options = 3;
     */
    options?: OptionJson[];
    /**
     * A version string for this interface. If specified, must have the form
     * `major-version.minor-version`, as in `1.10`. If the minor version is
     * omitted, it defaults to zero. If the entire version field is empty, the
     * major version is derived from the package name, as outlined below. If the
     * field is not empty, the version in the package name will be verified to be
     * consistent with what is provided here.
     *
     * The versioning schema uses [semantic
     * versioning](http://semver.org) where the major version number
     * indicates a breaking change and the minor version an additive,
     * non-breaking change. Both version numbers are signals to users
     * what to expect from different versions, and should be carefully
     * chosen based on the product plan.
     *
     * The major version is also reflected in the package name of the
     * interface, which must end in `v<major-version>`, as in
     * `google.feature.v1`. For major versions 0 and 1, the suffix can
     * be omitted. Zero major versions must only be used for
     * experimental, non-GA interfaces.
     *
     *
     * @generated from field: string version = 4;
     */
    version?: string;
    /**
     * Source context for the protocol buffer service represented by this
     * message.
     *
     * @generated from field: google.protobuf.SourceContext source_context = 5;
     */
    sourceContext?: SourceContextJson;
    /**
     * Included interfaces. See [Mixin][].
     *
     * @generated from field: repeated google.protobuf.Mixin mixins = 6;
     */
    mixins?: MixinJson[];
    /**
     * The source syntax of the service.
     *
     * @generated from field: google.protobuf.Syntax syntax = 7;
     */
    syntax?: SyntaxJson;
    /**
     * The source edition string, only valid when syntax is SYNTAX_EDITIONS.
     *
     * @generated from field: string edition = 8;
     */
    edition?: string;
};
/**
 * Describes the message google.protobuf.Api.
 * Use `create(ApiSchema)` to create a new message.
 */
export declare const ApiSchema: GenMessage<Api, {
    jsonType: ApiJson;
}>;
/**
 * Method represents a method of an API interface.
 *
 * New usages of this message as an alternative to MethodDescriptorProto are
 * strongly discouraged. This message does not reliability preserve all
 * information necessary to model the schema and preserve semantics. Instead
 * make use of FileDescriptorSet which preserves the necessary information.
 *
 * @generated from message google.protobuf.Method
 */
export type Method = Message<"google.protobuf.Method"> & {
    /**
     * The simple name of this method.
     *
     * @generated from field: string name = 1;
     */
    name: string;
    /**
     * A URL of the input message type.
     *
     * @generated from field: string request_type_url = 2;
     */
    requestTypeUrl: string;
    /**
     * If true, the request is streamed.
     *
     * @generated from field: bool request_streaming = 3;
     */
    requestStreaming: boolean;
    /**
     * The URL of the output message type.
     *
     * @generated from field: string response_type_url = 4;
     */
    responseTypeUrl: string;
    /**
     * If true, the response is streamed.
     *
     * @generated from field: bool response_streaming = 5;
     */
    responseStreaming: boolean;
    /**
     * Any metadata attached to the method.
     *
     * @generated from field: repeated google.protobuf.Option options = 6;
     */
    options: Option[];
    /**
     * The source syntax of this method.
     *
     * This field should be ignored, instead the syntax should be inherited from
     * Api. This is similar to Field and EnumValue.
     *
     * @generated from field: google.protobuf.Syntax syntax = 7 [deprecated = true];
     * @deprecated
     */
    syntax: Syntax;
    /**
     * The source edition string, only valid when syntax is SYNTAX_EDITIONS.
     *
     * This field should be ignored, instead the edition should be inherited from
     * Api. This is similar to Field and EnumValue.
     *
     * @generated from field: string edition = 8 [deprecated = true];
     * @deprecated
     */
    edition: string;
};
/**
 * Method represents a method of an API interface.
 *
 * New usages of this message as an alternative to MethodDescriptorProto are
 * strongly discouraged. This message does not reliability preserve all
 * information necessary to model the schema and preserve semantics. Instead
 * make use of FileDescriptorSet which preserves the necessary information.
 *
 * @generated from message google.protobuf.Method
 */
export type MethodJson = {
    /**
     * The simple name of this method.
     *
     * @generated from field: string name = 1;
     */
    name?: string;
    /**
     * A URL of the input message type.
     *
     * @generated from field: string request_type_url = 2;
     */
    requestTypeUrl?: string;
    /**
     * If true, the request is streamed.
     *
     * @generated from field: bool request_streaming = 3;
     */
    requestStreaming?: boolean;
    /**
     * The URL of the output message type.
     *
     * @generated from field: string response_type_url = 4;
     */
    responseTypeUrl?: string;
    /**
     * If true, the response is streamed.
     *
     * @generated from field: bool response_streaming = 5;
     */
    responseStreaming?: boolean;
    /**
     * Any metadata attached to the method.
     *
     * @generated from field: repeated google.protobuf.Option options = 6;
     */
    options?: OptionJson[];
    /**
     * The source syntax of this method.
     *
     * This field should be ignored, instead the syntax should be inherited from
     * Api. This is similar to Field and EnumValue.
     *
     * @generated from field: google.protobuf.Syntax syntax = 7 [deprecated = true];
     * @deprecated
     */
    syntax?: SyntaxJson;
    /**
     * The source edition string, only valid when syntax is SYNTAX_EDITIONS.
     *
     * This field should be ignored, instead the edition should be inherited from
     * Api. This is similar to Field and EnumValue.
     *
     * @generated from field: string edition = 8 [deprecated = true];
     * @deprecated
     */
    edition?: string;
};
/**
 * Describes the message google.protobuf.Method.
 * Use `create(MethodSchema)` to create a new message.
 */
export declare const MethodSchema: GenMessage<Method, {
    jsonType: MethodJson;
}>;
/**
 * Declares an API Interface to be included in this interface. The including
 * interface must redeclare all the methods from the included interface, but
 * documentation and options are inherited as follows:
 *
 * - If after comment and whitespace stripping, the documentation
 *   string of the redeclared method is empty, it will be inherited
 *   from the original method.
 *
 * - Each annotation belonging to the service config (http,
 *   visibility) which is not set in the redeclared method will be
 *   inherited.
 *
 * - If an http annotation is inherited, the path pattern will be
 *   modified as follows. Any version prefix will be replaced by the
 *   version of the including interface plus the [root][] path if
 *   specified.
 *
 * Example of a simple mixin:
 *
 *     package google.acl.v1;
 *     service AccessControl {
 *       // Get the underlying ACL object.
 *       rpc GetAcl(GetAclRequest) returns (Acl) {
 *         option (google.api.http).get = "/v1/{resource=**}:getAcl";
 *       }
 *     }
 *
 *     package google.storage.v2;
 *     service Storage {
 *       rpc GetAcl(GetAclRequest) returns (Acl);
 *
 *       // Get a data record.
 *       rpc GetData(GetDataRequest) returns (Data) {
 *         option (google.api.http).get = "/v2/{resource=**}";
 *       }
 *     }
 *
 * Example of a mixin configuration:
 *
 *     apis:
 *     - name: google.storage.v2.Storage
 *       mixins:
 *       - name: google.acl.v1.AccessControl
 *
 * The mixin construct implies that all methods in `AccessControl` are
 * also declared with same name and request/response types in
 * `Storage`. A documentation generator or annotation processor will
 * see the effective `Storage.GetAcl` method after inheriting
 * documentation and annotations as follows:
 *
 *     service Storage {
 *       // Get the underlying ACL object.
 *       rpc GetAcl(GetAclRequest) returns (Acl) {
 *         option (google.api.http).get = "/v2/{resource=**}:getAcl";
 *       }
 *       ...
 *     }
 *
 * Note how the version in the path pattern changed from `v1` to `v2`.
 *
 * If the `root` field in the mixin is specified, it should be a
 * relative path under which inherited HTTP paths are placed. Example:
 *
 *     apis:
 *     - name: google.storage.v2.Storage
 *       mixins:
 *       - name: google.acl.v1.AccessControl
 *         root: acls
 *
 * This implies the following inherited HTTP annotation:
 *
 *     service Storage {
 *       // Get the underlying ACL object.
 *       rpc GetAcl(GetAclRequest) returns (Acl) {
 *         option (google.api.http).get = "/v2/acls/{resource=**}:getAcl";
 *       }
 *       ...
 *     }
 *
 * @generated from message google.protobuf.Mixin
 */
export type Mixin = Message<"google.protobuf.Mixin"> & {
    /**
     * The fully qualified name of the interface which is included.
     *
     * @generated from field: string name = 1;
     */
    name: string;
    /**
     * If non-empty specifies a path under which inherited HTTP paths
     * are rooted.
     *
     * @generated from field: string root = 2;
     */
    root: string;
};
/**
 * Declares an API Interface to be included in this interface. The including
 * interface must redeclare all the methods from the included interface, but
 * documentation and options are inherited as follows:
 *
 * - If after comment and whitespace stripping, the documentation
 *   string of the redeclared method is empty, it will be inherited
 *   from the original method.
 *
 * - Each annotation belonging to the service config (http,
 *   visibility) which is not set in the redeclared method will be
 *   inherited.
 *
 * - If an http annotation is inherited, the path pattern will be
 *   modified as follows. Any version prefix will be replaced by the
 *   version of the including interface plus the [root][] path if
 *   specified.
 *
 * Example of a simple mixin:
 *
 *     package google.acl.v1;
 *     service AccessControl {
 *       // Get the underlying ACL object.
 *       rpc GetAcl(GetAclRequest) returns (Acl) {
 *         option (google.api.http).get = "/v1/{resource=**}:getAcl";
 *       }
 *     }
 *
 *     package google.storage.v2;
 *     service Storage {
 *       rpc GetAcl(GetAclRequest) returns (Acl);
 *
 *       // Get a data record.
 *       rpc GetData(GetDataRequest) returns (Data) {
 *         option (google.api.http).get = "/v2/{resource=**}";
 *       }
 *     }
 *
 * Example of a mixin configuration:
 *
 *     apis:
 *     - name: google.storage.v2.Storage
 *       mixins:
 *       - name: google.acl.v1.AccessControl
 *
 * The mixin construct implies that all methods in `AccessControl` are
 * also declared with same name and request/response types in
 * `Storage`. A documentation generator or annotation processor will
 * see the effective `Storage.GetAcl` method after inheriting
 * documentation and annotations as follows:
 *
 *     service Storage {
 *       // Get the underlying ACL object.
 *       rpc GetAcl(GetAclRequest) returns (Acl) {
 *         option (google.api.http).get = "/v2/{resource=**}:getAcl";
 *       }
 *       ...
 *     }
 *
 * Note how the version in the path pattern changed from `v1` to `v2`.
 *
 * If the `root` field in the mixin is specified, it should be a
 * relative path under which inherited HTTP paths are placed. Example:
 *
 *     apis:
 *     - name: google.storage.v2.Storage
 *       mixins:
 *       - name: google.acl.v1.AccessControl
 *         root: acls
 *
 * This implies the following inherited HTTP annotation:
 *
 *     service Storage {
 *       // Get the underlying ACL object.
 *       rpc GetAcl(GetAclRequest) returns (Acl) {
 *         option (google.api.http).get = "/v2/acls/{resource=**}:getAcl";
 *       }
 *       ...
 *     }
 *
 * @generated from message google.protobuf.Mixin
 */
export type MixinJson = {
    /**
     * The fully qualified name of the interface which is included.
     *
     * @generated from field: string name = 1;
     */
    name?: string;
    /**
     * If non-empty specifies a path under which inherited HTTP paths
     * are rooted.
     *
     * @generated from field: string root = 2;
     */
    root?: string;
};
/**
 * Describes the message google.protobuf.Mixin.
 * Use `create(MixinSchema)` to create a new message.
 */
export declare const MixinSchema: GenMessage<Mixin, {
    jsonType: MixinJson;
}>;
