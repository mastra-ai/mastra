const { TableIndex, TransactionMethods, DataOptions } = require("./types");
const { getEntityIdentifiers, matchToEntityAlias } = require("./entity");

function cleanseCanceledData(
  index = TableIndex,
  entities,
  data = {},
  config = {},
) {
  if (config.data === DataOptions.raw) {
    return data;
  }
  const identifiers = getEntityIdentifiers(entities);
  const canceled = data.canceled || [];
  const paramItems = config._paramItems || [];
  const results = [];
  for (let i = 0; i < canceled.length; i++) {
    const { Item, Code, Message } = canceled[i] || {};
    const paramItem = paramItems[i];
    const code = Code || "None";
    const rejected = code !== "None";
    const result = {
      rejected,
      code,
      message: Message,
    };

    if (Item) {
      const entityAlias = matchToEntityAlias({
        record: Item,
        paramItem,
        identifiers,
      });
      result.item = entities[entityAlias].formatResponse({ Item }, index, {
        ...config,
        pager: false,
        parse: undefined,
      }).data;
    } else {
      result.item = null;
    }

    results.push(result);
  }

  return results;
}

function cleanseTransactionData(
  index = TableIndex,
  entities,
  data = {},
  config = {},
) {
  if (config.data === DataOptions.raw) {
    return data;
  }
  const identifiers = getEntityIdentifiers(entities);
  data.Items = data.Items || [];
  const paramItems = config._paramItems || [];
  const results = [];
  for (let i = 0; i < data.Items.length; i++) {
    const record = data.Items[i];
    if (!record) {
      results.push(null);
      continue;
    }

    const paramItem = paramItems[i];
    const entityAlias = matchToEntityAlias({ paramItem, identifiers, record });
    if (!entityAlias) {
      continue;
    }

    // pager=false because we don't want the entity trying to parse the lastEvaluatedKey
    let formatted = entities[entityAlias].formatResponse(
      { Item: record },
      index,
      {
        ...config,
        pager: false,
        parse: undefined,
      },
    );

    results.push(formatted.data);
  }

  return results.map((item) => ({
    rejected: false,
    item,
  }));
}

function createTransaction(options) {
  const { fn, method, getEntities } = options;
  const operations = {
    params: (options = {}) => {
      const paramItems = fn(getEntities());
      const params = {
        TransactItems: paramItems,
      };

      if (typeof options.token === "string" && options.token.length) {
        params["ClientRequestToken"] = options.token;
      }
      if (options._returnParamItems) {
        return { params, paramItems };
      }
      return params;
    },
    go: async (options) => {
      const driver = Object.values(getEntities())[0];

      if (!driver) {
        throw new Error(
          "At least one entity must exist to perform a transaction",
        );
      }

      const { params, paramItems } = operations.params({
        ...options,
        _returnParamItems: true,
      });

      let canceled = false;
      if (paramItems.length === 0) {
        return {
          canceled,
          data: [],
        };
      }
      if (options && options.logger) {
        if (!options.listeners) {
          options.listeners = [];
        }
        options.listeners.push(options.logger);
      }
      const response = await driver.go(method, params, {
        ...options,
        parse: (options, data) => {
          if (options.data === DataOptions.raw) {
            return data;
          } else if (data.canceled) {
            canceled = true;
            return cleanseCanceledData(TableIndex, getEntities(), data, {
              ...options,
              _isTransaction: true,
              _paramItems: paramItems,
            });
          } else if (data.Responses) {
            return cleanseTransactionData(
              TableIndex,
              getEntities(),
              {
                Items: data.Responses.map((response) => response.Item),
              },
              {
                ...options,
                _isTransaction: true,
                _paramItems: paramItems,
              },
            );
          } else {
            return new Array(paramItems ? paramItems.length : 0).fill({
              item: null,
              code: "None",
              rejected: false,
              message: undefined,
            });
          }
        },
      });

      return {
        ...response,
        canceled,
      };
    },
  };

  return operations;
}

function createWriteTransaction(entities, fn) {
  return createTransaction({
    fn,
    method: TransactionMethods.transactWrite,
    getEntities: () => entities,
  });
}

function createGetTransaction(entities, fn) {
  return createTransaction({
    fn,
    method: TransactionMethods.transactGet,
    getEntities: () => entities,
  });
}

module.exports = {
  createTransaction,
  createWriteTransaction,
  createGetTransaction,
};
