const {
  Entity,
  getEntityIdentifiers,
  matchToEntityAlias,
} = require("./entity");
const { clauses } = require("./clauses");
const {
  TableIndex,
  TransactionMethods,
  KeyCasing,
  ServiceVersions,
  ElectroInstance,
  ElectroInstanceTypes,
  ModelVersions,
  IndexTypes,
  DataOptions,
} = require("./types");
const { FilterFactory } = require("./filters");
const { FilterOperations } = require("./operations");
const { WhereFactory } = require("./where");
const v = require("./validations");
const c = require("./client");
const e = require("./errors");
const u = require("./util");
const txn = require("./transaction");
const {
  getInstanceType,
  getModelVersion,
  applyBetaModelOverrides,
} = require("./util");

const ConstructorTypes = {
  beta: "beta",
  v1: "v1",
  v1Map: "v1Map",
  unknown: "unknown",
};

function inferConstructorType(service) {
  if (v.isNameEntityRecordType(service) || v.isNameModelRecordType(service)) {
    return ConstructorTypes.v1Map;
  } else if (v.isBetaServiceConfig(service)) {
    return ConstructorTypes.beta;
  } else if (v.isStringHasLength(service)) {
    return ConstructorTypes.v1;
  } else {
    return ConstructorTypes.unknown;
  }
}

function inferJoinValues(alias, instance, config) {
  let hasAlias = true;
  let args = { alias, instance, config, hasAlias };
  if (typeof alias !== "string") {
    args.config = instance;
    args.instance = alias;
    args.hasAlias = false;
  }
  return args;
}

class Service {
  _betaConstructor(service, config) {
    this.service = {};
    this._modelOverrides = {};

    // Unique to Beta
    this._modelVersion = ModelVersions.beta;
    this._modelOverrides = {
      table: service.table,
      service: service.service,
      version: service.version,
    };
    this.service.name = service.name || service.service;
    this.service.table = service.table;
    this.service.version = service.version;
    // Unique to Beta

    this.config = config;
    this.client = config.client;
    if (v.isFunction(config.logger)) {
      this.logger = config.logger;
    }
    this.entities = {};
    this.find = {};
    this.collectionSchema = {};
    this.compositeAttributes = {};
    this.collections = {};
    this.identifiers = {};
    this.transaction = {
      get: (fn) => {
        return txn.createTransaction({
          fn,
          getEntities: () => this.entities,
          method: TransactionMethods.transactGet,
        });
      },
      write: (fn) => {
        return txn.createTransaction({
          fn,
          getEntities: () => this.entities,
          method: TransactionMethods.transactWrite,
        });
      },
    };
    this._instance = ElectroInstance.service;
    this._instanceType = ElectroInstanceTypes.service;
  }

  _v1Constructor(service, config) {
    this.service = {};
    this._modelOverrides = {};

    // Unique to V1
    this._modelVersion = ModelVersions.v1;
    this.service.name = service;
    this.service.table = config.table;
    this._modelOverrides.table = config.table;
    // Unique to V1

    this.config = config;
    this.client = config.client;
    if (v.isFunction(config.logger)) {
      this.logger = config.logger;
    }
    this.entities = {};
    this.find = {};
    this.collectionSchema = {};
    this.compositeAttributes = {};
    this.collections = {};
    this.identifiers = {};
    this.transaction = {
      get: (fn) => {
        return txn.createTransaction({
          fn,
          getEntities: () => this.entities,
          method: TransactionMethods.transactGet,
        });
      },
      write: (fn) => {
        return txn.createTransaction({
          fn,
          getEntities: () => this.entities,
          method: TransactionMethods.transactWrite,
        });
      },
    };
    this._instance = ElectroInstance.service;
    this._instanceType = ElectroInstanceTypes.service;
  }

  _v1MapConstructor(service, config) {
    let entityNames = Object.keys(service);
    let serviceName = this._inferServiceNameFromEntityMap(service);
    this._v1Constructor(serviceName, config);
    for (let name of entityNames) {
      let entity = service[name];
      this.join(name, entity, config);
    }
  }

  constructor(service = "", config = {}) {
    config = c.normalizeConfig(config);
    this.version = ServiceVersions.v1;
    let type = inferConstructorType(service);
    switch (type) {
      case ConstructorTypes.v1Map:
        this._v1MapConstructor(service, config);
        break;
      case ConstructorTypes.beta:
        this._betaConstructor(service, config);
        break;
      case ConstructorTypes.v1:
        this._v1Constructor(service, config);
        break;
      default:
        throw new e.ElectroError(
          e.ErrorCodes.InvalidJoin,
          `Invalid service name: ${JSON.stringify(
            service,
          )}. Service name must have length greater than zero`,
        );
    }
  }

  _inferServiceNameFromEntityMap(service) {
    let names = Object.keys(service);
    let entity = names
      .map((name) => service[name])
      .map((instance) => this._inferJoinEntity(instance))
      .find((entity) => entity && entity.model && entity.model.service);

    if (!entity || !entity.model || !entity.model.service) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidJoin,
        `Invalid service name: Entities/Models provided do not contain property for Service Name`,
      );
    }

    return entity.model.service;
  }

  _inferJoinEntity(instance, options) {
    let entity = {};
    let type = getInstanceType(instance);
    let modelVersion = getModelVersion(instance);
    switch (type) {
      case ElectroInstanceTypes.model:
        entity = new Entity(instance, options);
        break;
      case ElectroInstanceTypes.entity:
        entity = instance;
        break;
      default:
        /** start beta/v1 condition **/
        if (modelVersion !== this._modelVersion) {
          throw new e.ElectroError(
            e.ErrorCodes.InvalidJoin,
            "Invalid instance: Valid instances to join include Models and Entity instances.",
          );
        } else if (modelVersion === ModelVersions.beta) {
          instance = applyBetaModelOverrides(instance, this._modelOverrides);
        } else {
          throw new e.ElectroError(
            e.ErrorCodes.InvalidJoin,
            `Invalid instance: Valid instances to join include Models and Entity instances.`,
          );
        }
        entity = new Entity(instance, options);
        /** end beta/v1 condition **/
        break;
    }
    return entity;
  }

  /**
   * Join
   * @param {string} alias
   * @param instance
   * @param config
   * @returns {Service}
   */
  join(...args) {
    let { alias, instance, config, hasAlias } = inferJoinValues(...args);
    let options = { ...config, ...this.config };

    let entity = this._inferJoinEntity(instance, options);

    let name = hasAlias ? alias : entity.getName();

    if (
      this.service.name.toLowerCase() !== entity.model.service.toLowerCase()
    ) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidJoin,
        `Service name defined on joined instance, ${entity.model.service}, does not match the name of this Service: ${this.service.name}. Verify or update the service name on the Entity/Model to match the name defined on this service.`,
      );
    }

    if (this.getTableName()) {
      entity.setTableName(this.getTableName());
    }

    if (options.client) {
      entity.setClient(options.client);
    }

    if (options.logger) {
      entity._addLogger(options.logger);
    }

    if (options.listeners) {
      entity.addListeners(options.listeners);
    }

    if (this._modelVersion === ModelVersions.beta && this.service.version) {
      entity.model.version = this.service.version;
    }

    this.entities[name] = entity;
    for (let collection of this.entities[name].model.collections) {
      // todo: this used to be inside the collection callback, it does not do well being ran multiple times
      // this forlook adds the entity filters multiple times
      this._addCollectionEntity(collection, name, this.entities[name]);
      this.collections[collection] = (...facets) => {
        return this._makeCollectionChain(
          {
            name: collection,
            initialClauses: clauses,
          },
          ...facets,
        );
      };
    }
    for (const collection in this.collectionSchema) {
      const collectionSchema = this.collectionSchema[collection];
      this.compositeAttributes[collection] =
        this._collectionSchemaToCompositeAttributes(collectionSchema);
    }
    this.find = { ...this.entities, ...this.collections };
    return this;
  }

  _collectionSchemaToCompositeAttributes(schema) {
    const keys = schema.keys;
    return {
      hasSortKeys: keys.hasSk,
      customFacets: {
        pk: keys.pk.isCustom,
        sk: keys.sk.isCustom,
      },
      pk: keys.pk.facets,
      sk: keys.sk.facets,
      all: [
        ...keys.pk.facets.map((name) => {
          return {
            name,
            index: keys.index,
            type: "pk",
          };
        }),
        ...keys.sk.facets.map((name) => {
          return {
            name,
            index: keys.index,
            type: "sk",
          };
        }),
      ],
      collection: keys.collection,
      hasSubCollections: schema.hasSubCollections,
      casing: {
        pk: keys.pk.casing,
        sk: keys.sk.casing,
      },
    };
  }

  setClient(client) {
    if (client !== undefined) {
      for (let entity of Object.values(this.entities)) {
        entity.setClient(client);
      }
    }
  }

  cleanseRetrievedData(index = TableIndex, entities, data = {}, config = {}) {
    if (config.data === DataOptions.raw) {
      return data;
    }
    const identifiers = getEntityIdentifiers(entities);

    data.Items = data.Items || [];

    const results = {};
    for (let { alias } of identifiers) {
      results[alias] = [];
    }

    for (let i = 0; i < data.Items.length; i++) {
      const record = data.Items[i];

      if (!record) {
        continue;
      }

      const entityAlias = matchToEntityAlias({
        identifiers,
        record,
        entities: this.entities,
        allowMatchOnKeys: config.ignoreOwnership,
      });

      if (!entityAlias) {
        continue;
      }

      // pager=false because we don't want the entity trying to parse the lastEvaluatedKey
      let formatted;
      if (config.hydrate) {
        formatted = {
          data: record, // entities[entityAlias]._formatKeysToItem(index, record),
        };
      } else {
        formatted = entities[entityAlias].formatResponse(
          { Item: record },
          index,
          {
            ...config,
            pager: false,
            parse: undefined,
          },
        );
      }

      results[entityAlias].push(formatted.data);
    }
    return results;
  }

  findKeyOwner(lastEvaluatedKey) {
    return Object.values(this.entities)[0];
    // return Object.values(this.entities)
    // 	.find((entity) => entity.ownsLastEvaluatedKey(lastEvaluatedKey));
  }

  expectKeyOwner(lastEvaluatedKey) {
    const owner = this.findKeyOwner(lastEvaluatedKey);
    if (owner === undefined) {
      throw new e.ElectroError(
        e.ErrorCodes.NoOwnerForCursor,
        `Supplied cursor does not resolve to Entity within the Service ${this.service.name}`,
      );
    }
    return owner;
  }

  findCursorOwner(cursor) {
    return Object.values(this.entities)[0];
    // return Object.values(this.entities)
    // 	.find(entity => entity.ownsCursor(cursor));
  }

  expectCursorOwner(cursor) {
    const owner = this.findCursorOwner(cursor);
    if (owner === undefined) {
      throw new e.ElectroError(
        e.ErrorCodes.NoOwnerForCursor,
        `Supplied cursor does not resolve to Entity within the Service ${this.service.name}`,
      );
    }
    return owner;
  }

  getTableName() {
    return this.service.table;
  }

  setTableName(table) {
    this.service.table = table;
    for (let entity of Object.values(this.entities)) {
      entity.setTableName(table);
    }
  }

  _makeCollectionChain({ name = "", initialClauses = {} }, facets = {}) {
    const { entities, attributes, identifiers, indexType, index } =
      this.collectionSchema[name];
    const compositeAttributes = this.compositeAttributes[name];
    const allEntities = Object.values(entities);
    const entity = allEntities[0];

    let filterBuilder = new FilterFactory(attributes, FilterOperations);
    let whereBuilder = new WhereFactory(attributes, FilterOperations);
    let clauses = { ...initialClauses };

    clauses = filterBuilder.injectFilterClauses(clauses);
    clauses = whereBuilder.injectWhereClauses(clauses);

    const expression = identifiers.expression || "";

    let options = {
      // expressions, // DynamoDB doesnt return what I expect it would when provided with these entity filters
      parse: (options, data) => {
        if (options.data === DataOptions.raw) {
          return data;
        }
        return this.cleanseRetrievedData(index, entities, data, options);
      },
      formatCursor: {
        serialize: (key) => {
          return this.expectKeyOwner(key).serializeCursor(key);
        },
        deserialize: (cursor) => {
          return this.expectCursorOwner(cursor).deserializeCursor(cursor);
        },
      },
      identifiers: {
        names: identifiers.names || {},
        values: identifiers.values || {},
        expression: allEntities.length > 1 ? `(${expression})` : expression,
      },
      expressions: {
        names: {},
        values: {},
        expression: "",
      },
      attributes,
      entities,
      indexType,
      compositeAttributes,
      hydrator: async (entity, index, items, config) => {
        if (entity && entities[entity]) {
          return entities[entity].hydrate(index, items, {
            ...config,
            parse: undefined,
            hydrator: undefined,
            _isCollectionQuery: false,
            ignoreOwnership: config._providedIgnoreOwnership,
          });
        }

        // let itemLookup = [];
        let entityItemRefs = {};
        // let entityResultRefs = {};
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          for (let entityName in entities) {
            entityItemRefs[entityName] = entityItemRefs[entityName] || [];
            const entity = entities[entityName];
            // if (entity.ownsKeys({ keys: item })) {
            if (entity.ownsKeys(item)) {
              // const entityItemRefsIndex =
              entityItemRefs[entityName].push({
                item,
                itemSlot: i,
              });
              // itemLookup[i] = {
              // 	entityName,
              // 	entityItemRefsIndex,
              // 	originalItem: item,
              // }
            }
          }
        }

        let unprocessed = [];
        let data = new Array(items.length).fill(null);
        for (const entityName in entityItemRefs) {
          const itemRefs = entityItemRefs[entityName];
          const items = itemRefs.map((ref) => ref.item);
          const results = await entities[entity].hydrate(index, items, {
            ...config,
            parse: undefined,
            hydrate: false,
            hydrator: undefined,
            _isCollectionQuery: false,
            ignoreOwnership: config._providedIgnoreOwnership,
          });
          unprocessed = unprocessed.concat(results.unprocessed);
          if (results.data.length !== itemRefs.length) {
            throw new Error("Temporary: something wrong");
          }
          for (let r = 0; r < itemRefs.length; r++) {
            const itemRef = itemRefs[r];
            const hydrated = results.data[r];
            data[itemRef.itemSlot] = hydrated;
          }
        }

        return {
          data,
          unprocessed,
        };
      },
    };

    return entity.collection(name, clauses, facets, options);
  }

  _validateIndexCasingMatch(definition = {}, providedIndex = {}) {
    const definitionSk = definition.sk || {};
    const providedSk = providedIndex.sk || {};
    const pkCasingMatch = v.isMatchingCasing(
      definition.pk.casing,
      providedIndex.pk.casing,
    );
    const skCasingMatch = v.isMatchingCasing(
      definitionSk.casing,
      providedSk.casing,
    );
    return {
      pk: pkCasingMatch,
      sk: skCasingMatch,
    };
  }

  _validateCollectionDefinition(definition = {}, providedIndex = {}) {
    let isCustomMatchPK = definition.pk.isCustom === providedIndex.pk.isCustom;
    let isCustomMatchSK =
      !!(definition.sk && definition.sk.isCustom) ===
      !!(providedIndex.sk && providedIndex.sk.isCustom);
    let indexMatch = definition.index === providedIndex.index;
    let pkFieldMatch = definition.pk.field === providedIndex.pk.field;
    let pkFacetLengthMatch =
      definition.pk.facets.length === providedIndex.pk.facets.length;
    let scopeMatch = definition.scope === providedIndex.scope;
    let mismatchedFacetLabels = [];
    let collectionDifferences = [];
    let definitionIndexName = u.formatIndexNameForDisplay(definition.index);
    let providedIndexName = u.formatIndexNameForDisplay(providedIndex.index);
    let matchingKeyCasing = this._validateIndexCasingMatch(
      definition,
      providedIndex,
    );

    for (
      let i = 0;
      i < Math.max(definition.pk.labels.length, providedIndex.pk.labels.length);
      i++
    ) {
      let definitionFacet =
        definition.pk.labels[i] && definition.pk.labels[i].name;
      let definitionLabel =
        definition.pk.labels[i] && definition.pk.labels[i].label;
      let providedFacet =
        providedIndex.pk.labels[i] && providedIndex.pk.labels[i].name;
      let providedLabel =
        providedIndex.pk.labels[i] && providedIndex.pk.labels[i].label;
      let noLabels =
        definitionLabel === definitionFacet && providedLabel === providedFacet;
      if (definitionLabel !== providedLabel) {
        mismatchedFacetLabels.push({
          definitionFacet,
          definitionLabel,
          providedFacet,
          providedLabel,
          kind: "Partition",
          type: noLabels ? "facet" : "label",
        });
        break;
      } else if (definitionFacet !== providedFacet) {
        mismatchedFacetLabels.push({
          definitionFacet,
          definitionLabel,
          providedFacet,
          providedLabel,
          kind: "Partition",
          type: "facet",
        });
        break;
      }
    }

    if (!scopeMatch) {
      collectionDifferences.push(
        `The index scope value provided "${
          providedIndex.scope || "undefined"
        }" does not match established index scope value "${
          definition.scope || "undefined"
        }" on index "${providedIndexName}". Index scope options must match across all entities participating in a collection`,
      );
    }

    if (!isCustomMatchPK) {
      collectionDifferences.push(
        `The usage of key templates the partition key on index ${definitionIndexName} must be consistent across all Entities, some entities provided use template while others do not`,
      );
    }

    if (!isCustomMatchSK) {
      collectionDifferences.push(
        `The usage of key templates the sort key on index ${definitionIndexName} must be consistent across all Entities, some entities provided use template while others do not`,
      );
    }

    if (definition.type === "clustered") {
      for (
        let i = 0;
        i <
        Math.min(definition.sk.labels.length, providedIndex.sk.labels.length);
        i++
      ) {
        let definitionFacet =
          definition.sk.labels[i] && definition.sk.labels[i].name;
        let definitionLabel =
          definition.sk.labels[i] && definition.sk.labels[i].label;
        let providedFacet =
          providedIndex.sk.labels[i] && providedIndex.sk.labels[i].name;
        let providedLabel =
          providedIndex.sk.labels[i] && providedIndex.sk.labels[i].label;
        let noLabels =
          definitionLabel === definitionFacet &&
          providedLabel === providedFacet;
        if (definitionFacet === providedFacet) {
          if (definitionLabel !== providedLabel) {
            mismatchedFacetLabels.push({
              definitionFacet,
              definitionLabel,
              providedFacet,
              providedLabel,
              kind: "Sort",
              type: noLabels ? "facet" : "label",
            });
          }
        } else {
          break;
        }
      }
    }

    if (!matchingKeyCasing.pk) {
      collectionDifferences.push(
        `The pk property "casing" provided "${
          providedIndex.pk.casing || KeyCasing.default
        }" does not match established casing "${
          definition.pk.casing || KeyCasing.default
        }" on index "${providedIndexName}". Index casing options must match across all entities participating in a collection`,
      );
    }

    if (!matchingKeyCasing.sk) {
      const definedSk = definition.sk || {};
      const providedSk = providedIndex.sk || {};
      collectionDifferences.push(
        `The sk property "casing" provided "${
          definedSk.casing || KeyCasing.default
        }" does not match established casing "${
          providedSk.casing || KeyCasing.default
        }" on index "${providedIndexName}". Index casing options must match across all entities participating in a collection`,
      );
    }

    if (!indexMatch) {
      collectionDifferences.push(
        `Collection defined on provided index "${providedIndexName}" does not match collection established index "${definitionIndexName}". Collections must be defined on the same index across all entities within a service.`,
      );
    } else if (!pkFieldMatch) {
      collectionDifferences.push(
        `Partition Key composite attributes provided "${providedIndex.pk.field}" for index "${providedIndexName}" do not match established field "${definition.pk.field}" on established index "${definitionIndexName}"`,
      );
    }

    if (!pkFacetLengthMatch) {
      collectionDifferences.push(
        `Partition Key composite attributes provided [${providedIndex.pk.facets
          .map((val) => `"${val}"`)
          .join(
            ", ",
          )}] for index "${providedIndexName}" do not match established composite attributes [${definition.pk.facets
          .map((val) => `"${val}"`)
          .join(", ")}] on established index "${definitionIndexName}"`,
      );
      // Else if used here because if they don't even have the same facet length then the data collected for the mismatched facets would include undefined values
      // which would make the error messages even more confusing.
    } else if (mismatchedFacetLabels.length > 0) {
      for (let mismatch of mismatchedFacetLabels) {
        if (mismatch.type === "facet") {
          collectionDifferences.push(
            `${mismatch.kind} Key composite attributes provided for index "${providedIndexName}" do not match established composite attribute "${mismatch.definitionFacet}" on established index "${definitionIndexName}": "${mismatch.definitionLabel}" != "${mismatch.providedLabel}"; Composite attribute definitions must match between all members of a collection to ensure key structures will resolve to identical Partition Keys. Please ensure these composite attribute definitions are identical for all entities associated with this service.`,
          );
        } else {
          collectionDifferences.push(
            `${
              mismatch.kind
            } Key composite attributes provided for index "${providedIndexName}" contain conflicting composite attribute labels for established composite attribute "${
              mismatch.definitionFacet || ""
            }" on established index "${definitionIndexName}". Established composite attribute "${
              mismatch.definitionFacet || ""
            }" on established index "${definitionIndexName}" was defined with label "${
              mismatch.definitionLabel
            }" while provided composite attribute "${
              mismatch.providedFacet || ""
            }" on provided index "${providedIndexName}" is defined with label "${
              mismatch.providedLabel
            }". Composite attribute labels definitions must match between all members of a collection to ensure key structures will resolve to identical Partition Keys. Please ensure these labels definitions are identical for all entities associated with this service.`,
          );
        }
      }
    }
    return [!!collectionDifferences.length, collectionDifferences];
  }

  _compareEntityAttributes(
    entityName,
    definition = {},
    providedAttributes = {},
    keys,
  ) {
    let results = {
      additions: {},
      invalid: [],
    };
    for (let [name, detail] of Object.entries(providedAttributes)) {
      let defined = definition[name];
      if (defined === undefined) {
        results.additions[name] = detail;
      } else if (defined.field !== detail.field) {
        results.invalid.push(
          `The attribute "${name}" with Table Field "${detail.field}" does not match established Table Field "${defined.field}"`,
        );
      }
      if (defined && detail && (defined.padding || detail.padding)) {
        const definedPadding = defined.padding || {};
        const detailPadding = detail.padding || {};
        if (
          keys.pk.facets.includes(name) &&
          (definedPadding.length !== detailPadding.length ||
            definedPadding.char !== detailPadding.char)
        ) {
          results.invalid.push(
            `The attribute "${name}" contains inconsistent padding definitions that impact how keys are formed`,
          );
        }
      }
    }
    return [!!results.invalid.length, results];
  }

  _processEntityAttributes(
    entityName,
    definition = {},
    providedAttributes = {},
    keys,
  ) {
    let [attributesAreIncompatible, attributeResults] =
      this._compareEntityAttributes(
        entityName,
        definition,
        providedAttributes,
        keys,
      );
    if (attributesAreIncompatible) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidJoin,
        `Inconsistent attribute(s) on the entity "${entityName}". The following attribute(s) are defined with incompatible or conflicting definitions across participating entities: ${attributeResults.invalid.join(
          ", ",
        )}. These attribute definitions must match among all members of the collection.`,
      );
    } else {
      return {
        ...definition,
        ...attributeResults.additions,
      };
    }
  }

  _processEntityKeys(name, definition = {}, providedIndex = {}) {
    if (!Object.keys(definition).length) {
      definition = providedIndex;
    }
    const [invalidDefinition, invalidIndexMessages] =
      this._validateCollectionDefinition(definition, providedIndex);
    if (invalidDefinition) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidJoin,
        `Validation Error while joining entity, "${name}". ${invalidIndexMessages.join(
          "; ",
        )}`,
      );
    }
    const sharedSortKeyAttributes = [];
    const sharedSortKeyCompositeAttributeLabels = [];
    const sharedSortKeyLabels = [];
    if (
      providedIndex.hasSk &&
      definition.hasSk &&
      Array.isArray(definition.sk.labels)
    ) {
      for (let i = 0; i < definition.sk.labels.length; i++) {
        const providedLabels = providedIndex.sk.labels[i];
        const definedLabels = definition.sk.labels[i];

        const namesMatch =
          providedLabels && providedLabels.name === definedLabels.name;
        const labelsMatch =
          providedLabels && providedLabels.label === definedLabels.label;
        if (!namesMatch || !labelsMatch) {
          break;
        }
        sharedSortKeyLabels.push({ ...definedLabels });
        sharedSortKeyCompositeAttributeLabels.push({
          ...definition.sk.facetLabels[i],
        });
        sharedSortKeyAttributes.push(definition.sk.facets[i]);
      }
    }
    return {
      ...definition,
      sk: {
        ...definition.sk,
        facets: sharedSortKeyAttributes,
        facetLabels: sharedSortKeyCompositeAttributeLabels,
        labels: sharedSortKeyLabels,
      },
    };
  }

  _getEntityIndexFromCollectionName(collection, entity) {
    for (let index of Object.values(entity.model.indexes)) {
      let names = [];
      if (v.isArrayHasLength(index.collection)) {
        names = index.collection;
      } else {
        names.push(index.collection);
      }

      for (let name of names) {
        if (v.isStringHasLength(name) && name === collection) {
          return index;
        }
      }
    }
    return Object.values(entity.model.indexes).find((index) => {
      if (v.isStringHasLength(index.collection)) {
        return index.collection === collection;
      } else if (v.isArrayHasLength(index.collection)) {
        return index.collection.indexOf(collection) > 0;
      }
    });
  }

  _processSubCollections(
    providedType,
    existing,
    provided,
    entityName,
    collectionName,
  ) {
    let existingSubCollections;
    let providedSubCollections;
    if (v.isArrayHasLength(existing)) {
      existingSubCollections = existing;
    } else {
      existingSubCollections = [existing];
    }
    if (v.isArrayHasLength(provided)) {
      providedSubCollections = provided;
    } else {
      providedSubCollections = [provided];
    }

    if (
      providedSubCollections.length > 1 &&
      providedType === IndexTypes.clustered
    ) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidJoin,
        `Clustered indexes do not support sub-collections. The sub-collection "${collectionName}", on Entity "${entityName}" must be defined as either an individual collection name or the index must be redefined as an isolated cluster`,
      );
    }
    const existingRequiredIndex =
      existingSubCollections.indexOf(collectionName);
    const providedRequiredIndex =
      providedSubCollections.indexOf(collectionName);
    if (providedRequiredIndex < 0) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidJoin,
        `The collection definition for Collection "${collectionName}" does not exist on Entity "${entityName}".`,
      );
    }
    if (
      existingRequiredIndex >= 0 &&
      existingRequiredIndex !== providedRequiredIndex
    ) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidJoin,
        `The collection definition for Collection "${collectionName}", on Entity "${entityName}", does not match the established sub-collection order for this service. The collection name provided in slot ${
          providedRequiredIndex + 1
        }, ${
          providedSubCollections[existingRequiredIndex] === undefined
            ? "(not found)"
            : `"${providedSubCollections[existingRequiredIndex]}"`
        }, on Entity "${entityName}", does not match the established collection name in slot ${
          existingRequiredIndex + 1
        }, "${collectionName}". When using sub-collections, all Entities within a Service must must implement the same order for all preceding sub-collections.`,
      );
    }
    let length = Math.max(existingRequiredIndex, providedRequiredIndex);

    for (let i = 0; i <= length; i++) {
      let existingCollection = existingSubCollections[i];
      let providedCollection = providedSubCollections[i];
      if (v.isStringHasLength(existingCollection)) {
        if (
          existingCollection === providedCollection &&
          providedCollection === collectionName
        ) {
          return i;
        }
        if (existingCollection !== providedCollection) {
          throw new e.ElectroError(
            e.ErrorCodes.InvalidJoin,
            `The collection definition for Collection "${collectionName}", on Entity "${entityName}", does not match the established sub-collection order for this service. The collection name provided in slot ${
              i + 1
            }, "${providedCollection}", on Entity "${entityName}", does not match the established collection name in slot ${
              i + 1
            }, "${existingCollection}". When using sub-collections, all Entities within a Service must must implement the same order for all preceding sub-collections.`,
          );
        }
      } else if (v.isStringHasLength(providedCollection)) {
        if (providedCollection === collectionName) {
          return i;
        }
      }
    }
  }

  _addCollectionEntity(collection = "", name = "", entity = {}) {
    let providedIndex = this._getEntityIndexFromCollectionName(
      collection,
      entity,
    );

    this.collectionSchema[collection] = this.collectionSchema[collection] || {
      entities: {},
      keys: {},
      attributes: {},
      identifiers: {
        names: {},
        values: {},
        expression: "",
      },
      index: undefined,
      table: "",
      collection: [],
      indexType: undefined,
      hasSubCollections: undefined,
    };
    const providedType = providedIndex.type || IndexTypes.isolated;
    if (this.collectionSchema[collection].indexType === undefined) {
      this.collectionSchema[collection].indexType = providedType;
    } else if (this.collectionSchema[collection].indexType !== providedType) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidJoin,
        `Index type mismatch on collection ${collection}. The entity ${name} defines the index as type ${providedType} while the established type for that index is ${this.collectionSchema[collection].indexType}. Note that when omitted, indexes default to the type "${IndexTypes.isolated}"`,
      );
    }
    if (this.collectionSchema[collection].entities[name] !== undefined) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidJoin,
        `Entity with name '${name}' has already been joined to this service.`,
      );
    }

    if (this.collectionSchema[collection].table !== "") {
      if (this.collectionSchema[collection].table !== entity.getTableName()) {
        throw new e.ElectroError(
          e.ErrorCodes.InvalidJoin,
          `Entity with name '${name}' is defined to use a different Table than what is defined on other Service Entities and/or the Service itself. Entity '${name}' is defined with table name '${entity.getTableName()}' but the Service has been defined to use table name '${
            this.collectionSchema[collection].table
          }'. All Entities in a Service must reference the same DynamoDB table. To ensure all Entities will use the same DynamoDB table, it is possible to apply the property 'table' to the Service constructor's configuration parameter.`,
        );
      }
    } else {
      this.collectionSchema[collection].table = entity.getTableName();
    }

    this.collectionSchema[collection].keys = this._processEntityKeys(
      name,
      this.collectionSchema[collection].keys,
      providedIndex,
    );
    this.collectionSchema[collection].attributes =
      this._processEntityAttributes(
        name,
        this.collectionSchema[collection].attributes,
        entity.model.schema.attributes,
        this.collectionSchema[collection].keys,
      );
    this.collectionSchema[collection].entities[name] = entity;
    this.collectionSchema[collection].identifiers =
      this._processEntityIdentifiers(
        this.collectionSchema[collection].identifiers,
        entity.getIdentifierExpressions(name),
      );
    this.collectionSchema[collection].index =
      this._processEntityCollectionIndex(
        this.collectionSchema[collection].index,
        providedIndex.index,
        name,
        collection,
      );
    let collectionIndex = this._processSubCollections(
      providedType,
      this.collectionSchema[collection].collection,
      providedIndex.collection,
      name,
      collection,
    );
    this.collectionSchema[collection].collection[collectionIndex] = collection;
    this.collectionSchema[collection].hasSubCollections =
      this.collectionSchema[collection].hasSubCollections ||
      Array.isArray(providedIndex.collection);
    return this.collectionSchema[collection];
  }

  _processEntityCollectionIndex(existing, provided, name, collection) {
    if (typeof provided !== "string") {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidJoin,
        `Entity with name '${name}' does not have collection ${collection} defined on it's model`,
      );
    } else if (existing === undefined) {
      return provided;
    } else if (provided !== existing) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidJoin,
        `Entity with name '${name}' defines collection ${collection} on index `,
      );
    } else {
      return existing;
    }
  }

  _processEntityIdentifiers(existing = {}, { names, values, expression } = {}) {
    let identifiers = {};
    if (names) {
      identifiers.names = Object.assign({}, existing.names, names);
    }
    if (values) {
      identifiers.values = Object.assign({}, existing.values, values);
    }
    if (expression) {
      identifiers.expression = [existing.expression, expression]
        .filter(Boolean)
        .join(" OR ");
    }
    return identifiers;
  }
}

module.exports = {
  Service,
};
