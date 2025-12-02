"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Walker = void 0;
const clone_1 = __importDefault(require("clone"));
const json_schema_ref_parser_1 = __importDefault(require("@apidevtools/json-schema-ref-parser"));
const visited = Symbol("visited");
const NEXT_SCHEMA_KEYWORD = Symbol("NEXT_SCHEMA_KEYWORD");
const NEXT_LDO_KEYWORD = Symbol("NEXT_LDO_KEYWORD");
/**
 * This is a hotfix and really only a partial solution as it does not cover all cases.
 *
 * But it's the best we can do until we find or build a better library to handle references.
 *
 * original source https://github.com/asyncapi/modelina/pull/829/files
 */
const handleRootReference = (input) => {
    //Because of https://github.com/APIDevTools/json-schema-ref-parser/issues/201 the tool cannot handle root references.
    //This really is a bad patch to fix an underlying problem, but until a full library is available, this is best we can do.
    const hasRootRef = input.$ref !== undefined;
    if (hasRootRef) {
        //When we encounter it, manually try to resolve the reference in the definitions section
        const hasDefinitionSection = input.definitions !== undefined;
        if (hasDefinitionSection) {
            const definitionLink = "#/definitions/";
            const referenceLink = input.$ref.slice(0, definitionLink.length);
            const referenceIsLocal = referenceLink === definitionLink;
            if (referenceIsLocal) {
                const definitionName = input.$ref.slice(definitionLink.length);
                const definition = input.definitions[String(definitionName)];
                const definitionExist = definition !== undefined;
                if (definitionExist) {
                    delete input.$ref;
                    return { ...definition, ...input };
                }
            }
        }
    }
    return input;
};
class Walker {
    constructor() {
        this.loadSchema = async (schema, options) => {
            const { cloneSchema = true, dereference = false, dereferenceOptions } = options || {};
            this.rootSchema = cloneSchema ? (0, clone_1.default)(schema) : schema;
            if (dereference) {
                const parser = new json_schema_ref_parser_1.default();
                this.rootSchema = (await parser.dereference(handleRootReference(schema), dereferenceOptions || {}));
            }
        };
        this.walk = async (processor, vocabulary) => {
            this.vocabulary = vocabulary ?? this.vocabularies.DRAFT_07;
            this.walker = processor;
            this.walker(this.rootSchema);
            await this.subschemaWalk(this.rootSchema);
            // clean up the symbols we injected to check for circular references
            this.cleanupVisited(this.rootSchema);
        };
        this.cleanupVisited = (schema) => {
            for (const entry of Object.values(schema)) {
                if (entry && typeof entry === "object" && entry[visited]) {
                    delete entry[visited];
                    this.cleanupVisited(entry);
                }
            }
        };
        this.isValidSubSchema = (schema) => (schema instanceof Object && !Array.isArray(schema)) || typeof schema === "boolean";
        this.applyUserProcessor = (schema, key) => {
            const schemaElement = schema[key];
            if (typeof schemaElement !== "object") {
                return;
            }
            schemaElement[visited] = true;
            this.walker(schemaElement);
            this.subschemaWalk(schemaElement);
        };
        this.subschemaWalk = (schema) => {
            for (const keyword in schema) {
                try {
                    this.processSchemaKey(schema, keyword);
                }
                catch (e) {
                    if (e !== NEXT_SCHEMA_KEYWORD) {
                        throw e;
                    }
                }
            }
        };
        // These are the processors
        this.processSchemaKey = (schema, keyword) => {
            if (!schema[keyword] || typeof schema[keyword] !== "object") {
                return;
            }
            const processorFunction = this.vocabulary[keyword];
            if (!processorFunction) {
                return;
            }
            schema[keyword][visited] = true;
            processorFunction(schema, keyword);
        };
        this.processObjectOfSchemas = (schema, keyword) => {
            for (const prop of Object.getOwnPropertyNames(schema[keyword])) {
                const schemaElem = schema[keyword][prop];
                if (typeof schemaElem === "object" && schemaElem) {
                    this.applyUserProcessor(schema[keyword], prop);
                }
            }
        };
        this.processArrayOfSchemas = (schema, keyword) => {
            for (const prop of Object.getOwnPropertyNames(schema[keyword])) {
                const schemaElem = schema[keyword][prop];
                if (schemaElem && typeof schemaElem === "object") {
                    this.applyUserProcessor(schema[keyword], prop);
                }
            }
            for (let i = 0; i < schema[keyword].length; i++) {
                this.applyUserProcessor(schema[keyword], i);
            }
        };
        this.processSingleOrArrayOfSchemas = (schema, keyword) => {
            if (this.isValidSubSchema(schema[keyword])) {
                this.processSingleSchema(schema, keyword);
            }
            else {
                this.processArrayOfSchemas(schema, keyword);
            }
        };
        this.processSingleSchema = (schema, keyword) => {
            this.applyUserProcessor(schema, keyword);
        };
        /**
         * Loop over the links and apply the callbacks, while
         * handling LDO keyword deletions by catching NEXT_LDO_KEYWORD.
         */
        this.getProcessLinks = (ldoVocabulary) => {
            return (schema, keyword) => {
                for (const ldo of schema.links) {
                    for (const key in ldo) {
                        try {
                            ldoVocabulary[keyword]?.(schema, key);
                        }
                        catch (e) {
                            if (e !== NEXT_LDO_KEYWORD) {
                                throw e;
                            }
                        }
                    }
                }
            };
        };
        // vocabulary initialization
        this.initVocabulary = () => {
            const DRAFT_04 = {
                properties: this.processObjectOfSchemas,
                patternProperties: this.processObjectOfSchemas,
                additionalProperties: this.processSingleSchema,
                dependencies: this.processObjectOfSchemas,
                items: this.processSingleOrArrayOfSchemas,
                additionalItems: this.processSingleSchema,
                allOf: this.processArrayOfSchemas,
                anyOf: this.processArrayOfSchemas,
                oneOf: this.processArrayOfSchemas,
                not: this.processSingleSchema,
                if: this.processSingleSchema,
                then: this.processSingleSchema,
                else: this.processSingleSchema,
            };
            /**
             * LDO keywords call _apply directly as they have a different
             * mapping from the schema keyword into the path that _apply
             * expects.  This is done in the function returned from
             * _getProcessLinks();
             */
            const DRAFT_04_HYPER_LDO = {
                schema: this.applyUserProcessor,
                targetSchema: this.applyUserProcessor,
            };
            const DRAFT_04_HYPER = {
                ...DRAFT_04,
                links: this.getProcessLinks(DRAFT_04_HYPER_LDO),
            };
            const DRAFT_06 = {
                ...DRAFT_04,
                propertyNames: this.processObjectOfSchemas,
            };
            const DRAFT_06_HYPER_LDO = {
                hrefSchema: this.applyUserProcessor,
                targetSchema: this.applyUserProcessor,
                submissionSchema: this.applyUserProcessor,
            };
            const DRAFT_06_HYPER = {
                ...DRAFT_06,
                links: this.getProcessLinks(DRAFT_06_HYPER_LDO),
            };
            const DRAFT_07 = { ...DRAFT_06 };
            const DRAFT_07_HYPER_LDO = {
                ...DRAFT_06_HYPER_LDO,
                headerSchema: this.applyUserProcessor,
            };
            const DRAFT_07_HYPER = {
                ...DRAFT_07,
                links: this.getProcessLinks(DRAFT_07_HYPER_LDO),
            };
            const CLOUDFLARE_DOCA = {
                ...DRAFT_04,
                links: this.getProcessLinks({
                    ...DRAFT_04_HYPER_LDO,
                    ...DRAFT_07_HYPER_LDO,
                }),
            };
            this.vocabularies = {
                DRAFT_04,
                DRAFT_04_HYPER,
                DRAFT_04_HYPER_LDO,
                DRAFT_06,
                DRAFT_06_HYPER,
                DRAFT_06_HYPER_LDO,
                DRAFT_07,
                DRAFT_07_HYPER,
                DRAFT_07_HYPER_LDO,
                CLOUDFLARE_DOCA,
            };
        };
        this.initVocabulary();
    }
}
exports.Walker = Walker;
