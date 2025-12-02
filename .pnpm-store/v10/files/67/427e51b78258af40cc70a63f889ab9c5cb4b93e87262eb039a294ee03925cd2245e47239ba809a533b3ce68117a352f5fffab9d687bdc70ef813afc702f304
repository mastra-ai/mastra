import { CallOptions } from 'google-gax';
import { google } from '../protos/protos';
import { Attributes } from './publisher';
import { PubSub } from './pubsub';
/**
 * A Schema object allows you to interact with a Cloud Pub/Sub schema.
 *
 * This should only be instantiated by the PubSub class. To obtain an
 * instance for end user usage, call pubsub.schema().
 *
 * @class
 * @param {PubSub} pubsub The PubSub object creating this object.
 * @param {id} id name or ID of the schema.
 *
 * @example Creating an instance of this class.
 * ```
 * const {PubSub} = require('@google-cloud/pubsub');
 * const pubsub = new PubSub();
 *
 * const schema = pubsub.schema('my-schema');
 *
 * ```
 * @example Getting the details of a schema. Note that Schema methods do not provide a callback interface. Use .then() or await.
 * ```
 * const {PubSub} = require('@google-cloud/pubsub');
 * const pubsub = new PubSub();
 *
 * const schema = pubsub.schema('my-schema');
 * schema.get(SchemaViews.Basic).then(console.log);
 * ```
 */
export declare class Schema {
    id: string;
    name_?: string;
    pubsub: PubSub;
    constructor(pubsub: PubSub, idOrName: string);
    /**
     * Return the fully qualified name of this schema.
     *
     * Note that we have to verify that we have a projectId before returning this,
     * so we have to check that first.
     *
     * @return {Promise<string>} a Promise that resolves to the full schema name
     */
    getName(): Promise<string>;
    /**
     * Create a schema.
     *
     * @see [Schemas: create API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.schemas/create}
     *
     * @throws {Error} if the schema type is incorrect.
     * @throws {Error} if the definition is invalid.
     *
     * @param {SchemaType} type The type of the schema (Protobuf, Avro, etc).
     * @param {string} definition The text describing the schema in terms of the type.
     * @param {object} [options] Request configuration options, outlined
     *   here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @returns {Promise<void>}
     *
     * @example Create a schema.
     * ```
     * const {PubSub} = require('@google-cloud/pubsub');
     * const pubsub = new PubSub();
     *
     * const schema = pubsub.schema('messageType');
     * await schema.create(
     *   SchemaTypes.Avro,
     *   '{...avro definition...}'
     * );
     * ```
     */
    create(type: SchemaType, definition: string, gaxOpts?: CallOptions): Promise<void>;
    /**
     * Get full information about the schema from the service.
     *
     * @see [Schemas: getSchema API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.schemas/get}
     *
     * @param {google.pubsub.v1.SchemaView} [view] The type of schema object
     *   requested, which should be an enum value from {@link SchemaViews}. Defaults
     *   to Full.
     * @param {object} [options] Request configuration options, outlined
     *   here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @returns {Promise<ISchema>}
     */
    get(view?: SchemaView, gaxOpts?: CallOptions): Promise<ISchema>;
    /**
     * Delete the schema from the project.
     *
     * @see [Schemas: deleteSchema API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.schemas/delete}
     *
     * @param {object} [options] Request configuration options, outlined
     *   here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @returns {Promise<void>}
     */
    delete(gaxOpts?: CallOptions): Promise<void>;
    /**
     * Validate a message against this schema's definition.
     *
     * If you would like to validate a message against an arbitrary schema, please
     * use the {@link SchemaServiceClient} GAPIC class directly, using your
     * {@link PubSub} instance's configuration, via {@link PubSub#getClientConfig}.
     *
     * @see [Schemas: validateMessage API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.schemas/validateMessage}
     *
     * @throws {Error} if the validation fails.
     * @throws {Error} if other parameters are invalid.
     *
     * @param {string} message The message to validate.
     * @param {Encoding | "JSON" | "BINARY"} encoding The encoding of the message to validate.
     * @param {object} [options] Request configuration options, outlined
     *   here: https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html.
     * @returns {Promise<void>}
     */
    validateMessage(message: string, encoding: google.pubsub.v1.Encoding | keyof typeof google.pubsub.v1.Encoding, gaxOpts?: CallOptions): Promise<void>;
    /*!
     * Format the name of a schema. A schema's full name is in the
     * format of projects/{projectId}/schemas/{schemaName}.
     *
     * The GAPIC client should do this for us, but since we maintain
     * names rather than IDs, this is simpler.
     *
     * @private
     */
    static formatName_(projectId: string, nameOrId: string): string;
    /**
     * Translates the schema attributes in messages delivered from Pub/Sub.
     * All resulting fields may end up being blank.
     */
    static metadataFromMessage(attributes: Attributes): SchemaMessageMetadata;
}
/**
 * Schema metadata that might be gathered from a Pub/Sub message.
 * This is created for you from {@link Schema#metadataForMessage}.
 */
export interface SchemaMessageMetadata {
    /**
     * Schema name; may be queried using {@link PubSub#schema}.
     */
    name?: string;
    /**
     * Schema revision; this goes with {@link name} as needed.
     */
    revision?: string;
    /**
     * Encoding; this will be Encodings.Json or Encodings.Binary.
     */
    encoding: SchemaEncoding | undefined;
}
export type CreateSchemaResponse = google.pubsub.v1.Schema;
export type ISchema = google.pubsub.v1.ISchema;
export type SchemaType = keyof typeof google.pubsub.v1.Schema.Type;
export type SchemaView = keyof typeof google.pubsub.v1.SchemaView;
export type ICreateSchemaRequest = google.pubsub.v1.ICreateSchemaRequest;
export type SchemaEncoding = keyof typeof google.pubsub.v1.Encoding;
export declare const SchemaTypes: {
    ProtocolBuffer: "PROTOCOL_BUFFER";
    Avro: "AVRO";
};
export declare const SchemaViews: {
    Basic: "BASIC";
    Full: "FULL";
};
export declare const Encodings: {
    Json: "JSON";
    Binary: "BINARY";
};
