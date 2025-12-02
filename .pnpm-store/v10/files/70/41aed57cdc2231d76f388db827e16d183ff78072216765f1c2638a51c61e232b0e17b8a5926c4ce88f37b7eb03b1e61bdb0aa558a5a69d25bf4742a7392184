// # Errors:
// 1000 - Configuration Errors
// 2000 - Invalid Queries
// 3000 - User Defined Errors
// 4000 - DynamoDB Errors
// 5000 - Unexpected Errors

function getHelpLink(section) {
  section = section || "unknown-error-5001";
  return `https://electrodb.dev/en/reference/errors/#${section}`;
}

const ErrorCode = Symbol("error-code");

const ErrorCodes = {
  NoClientDefined: {
    code: 1001,
    section: "no-client-defined-on-model",
    name: "NoClientDefined",
    sym: ErrorCode,
  },
  InvalidIdentifier: {
    code: 1002,
    section: "invalid-identifier",
    name: "InvalidIdentifier",
    sym: ErrorCode,
  },
  InvalidKeyCompositeAttributeTemplate: {
    code: 1003,
    section: "invalid-key-composite-attribute-template",
    name: "InvalidKeyCompositeAttributeTemplate",
    sym: ErrorCode,
  },
  DuplicateIndexes: {
    code: 1004,
    section: "duplicate-indexes",
    name: "DuplicateIndexes",
    sym: ErrorCode,
  },
  CollectionNoSK: {
    code: 1005,
    section: "collection-without-an-sk",
    name: "CollectionNoSK",
    sym: ErrorCode,
  },
  DuplicateCollections: {
    code: 1006,
    section: "duplicate-collections",
    name: "DuplicateCollections",
    sym: ErrorCode,
  },
  MissingPrimaryIndex: {
    code: 1007,
    section: "missing-primary-index",
    name: "MissingPrimaryIndex",
    sym: ErrorCode,
  },
  InvalidAttributeDefinition: {
    code: 1008,
    section: "invalid-attribute-definition",
    name: "InvalidAttributeDefinition",
    sym: ErrorCode,
  },
  InvalidModel: {
    code: 1009,
    section: "invalid-model",
    name: "InvalidModel",
    sym: ErrorCode,
  },
  InvalidOptions: {
    code: 1010,
    section: "invalid-options",
    name: "InvalidOptions",
    sym: ErrorCode,
  },
  InvalidFilter: {
    code: 1011,
    section: "filters",
    name: "InvalidFilter",
    sym: ErrorCode,
  },
  InvalidWhere: {
    code: 1012,
    section: "where",
    name: "InvalidWhere",
    sym: ErrorCode,
  },
  InvalidJoin: {
    code: 1013,
    section: "join",
    name: "InvalidJoin",
    sym: ErrorCode,
  },
  DuplicateIndexFields: {
    code: 1014,
    section: "duplicate-index-fields",
    name: "DuplicateIndexField",
    sym: ErrorCode,
  },
  DuplicateIndexCompositeAttributes: {
    code: 1015,
    section: "duplicate-index-composite-attributes",
    name: "DuplicateIndexCompositeAttributes",
    sym: ErrorCode,
  },
  InvalidAttributeWatchDefinition: {
    code: 1016,
    section: "invalid-attribute-watch-definition",
    name: "InvalidAttributeWatchDefinition",
    sym: ErrorCode,
  },
  IncompatibleKeyCompositeAttributeTemplate: {
    code: 1017,
    section: "incompatible-key-composite-attribute-template",
    name: "IncompatibleKeyCompositeAttributeTemplate",
    sym: ErrorCode,
  },
  InvalidIndexWithAttributeName: {
    code: 1018,
    section: "invalid-index-with-attribute-name",
    name: "InvalidIndexWithAttributeName",
    sym: ErrorCode,
  },
  InvalidCollectionOnIndexWithAttributeFieldNames: {
    code: 1019,
    section: "invalid-collection-on-index-with-attribute-field-names",
    name: "InvalidIndexCompositeWithAttributeName",
    sym: ErrorCode,
  },
  IncompatibleKeyCasing: {
    code: 1020,
    section: "incompatible-key-casing",
    name: "IncompatibleKeyCasing",
    sym: ErrorCode,
  },
  InvalidListenerProvided: {
    code: 1020,
    section: "invalid-listener-provided",
    name: "InvalidListenerProvided",
    sym: ErrorCode,
  },
  InvalidLoggerProvided: {
    code: 1020,
    section: "invalid-listener-provided",
    name: "InvalidListenerProvided",
    sym: ErrorCode,
  },
  InvalidClientProvided: {
    code: 1021,
    section: "invalid-client-provided",
    name: "InvalidClientProvided",
    sym: ErrorCode,
  },
  InconsistentIndexDefinition: {
    code: 1022,
    section: "inconsistent-index-definition",
    name: "Inconsistent Index Definition",
    sym: ErrorCode,
  },
  MissingAttribute: {
    code: 2001,
    section: "missing-attribute",
    name: "MissingAttribute",
    sym: ErrorCode,
  },
  IncompleteCompositeAttributes: {
    code: 2002,
    section: "missing-composite-attributes",
    name: "IncompleteCompositeAttributes",
    sym: ErrorCode,
  },
  MissingTable: {
    code: 2003,
    section: "missing-table",
    name: "MissingTable",
    sym: ErrorCode,
  },
  InvalidConcurrencyOption: {
    code: 2004,
    section: "invalid-concurrency-option",
    name: "InvalidConcurrencyOption",
    sym: ErrorCode,
  },
  InvalidPagesOption: {
    code: 2005,
    section: "invalid-pages-option",
    name: "InvalidPagesOption",
    sym: ErrorCode,
  },
  InvalidLimitOption: {
    code: 2006,
    section: "invalid-limit-option",
    name: "InvalidLimitOption",
    sym: ErrorCode,
  },
  InvalidConversionKeysProvided: {
    code: 2007,
    section: "invalid-conversion-values-provided",
    name: "InvalidConversionKeysProvided",
    sym: ErrorCode,
  },
  InvalidConversionCursorProvided: {
    code: 2008,
    section: "invalid-conversion-values-provided",
    name: "InvalidConversionCursorProvided",
    sym: ErrorCode,
  },
  InvalidConversionCompositeProvided: {
    code: 2009,
    section: "invalid-conversion-values-provided",
    name: "InvalidConversionCompositeProvided",
    sym: ErrorCode,
  },
  DuplicateUpdateCompositesProvided: {
    code: 2010,
    section: "duplicate-update-composites-provided",
    name: "DuplicateUpdateCompositesProvided",
    sym: ErrorCode,
  },
  InvalidIndexCondition: {
    code: 2011,
    section: "invalid-index-option",
    name: "InvalidIndexOption",
    sym: ErrorCode,
  },
  IncompleteIndexCompositesAttributesProvided: {
    code: 2012,
    section: "invalid-index-composite-attributes-provided",
    name: "IncompleteIndexCompositesAttributesProvided",
    sym: ErrorCode,
  },
  InvalidAttribute: {
    code: 3001,
    section: "invalid-attribute",
    name: "InvalidAttribute",
    sym: ErrorCode,
  },
  AWSError: {
    code: 4001,
    section: "aws-error",
    name: "AWSError",
    sym: ErrorCode,
  },
  UnknownError: {
    code: 5001,
    section: "unknown-error",
    name: "UnknownError",
    sym: ErrorCode,
  },
  GeneralError: {
    code: 5002,
    section: "",
    name: "GeneralError",
    sym: ErrorCode,
  },
  LastEvaluatedKey: {
    code: 5003,
    section: "invalid-last-evaluated-key",
    name: "LastEvaluatedKey",
    sym: ErrorCode,
  },
  NoOwnerForPager: {
    code: 5004,
    section: "no-owner-for-pager",
    name: "NoOwnerForPager",
    sym: ErrorCode,
  },
  NoOwnerForCursor: {
    code: 5004,
    section: "no-owner-for-pager",
    name: "NoOwnerForCursor",
    sym: ErrorCode,
  },
  PagerNotUnique: {
    code: 5005,
    section: "pager-not-unique",
    name: "NoOwnerForPager",
    sym: ErrorCode,
  },
};

function makeMessage(message, section) {
  return `${message} - For more detail on this error reference: ${getHelpLink(
    section,
  )}`;
}

class ElectroError extends Error {
  constructor(code, message, cause, params = null) {
    super(message, { cause });
    let detail = ErrorCodes.UnknownError;
    if (code && code.sym === ErrorCode) {
      detail = code;
    }
    this._message = message;
    // this.message = `${message} - For more detail on this error reference: ${getHelpLink(detail.section)}`;
    this.message = makeMessage(message, detail.section);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ElectroError);
    }

    this.name = "ElectroError";
    this.ref = code;
    this.code = detail.code;
    this.date = Date.now();
    this.isElectroError = true;
    applyParamsFn(this, params);
  }
}

function applyParamsFn(error, params = null) {
  Object.defineProperty(error, 'params', {
    enumerable: false,
    writable: true,
    configurable: true,
    value: () => {
      return params;
    }
  });
}

class ElectroValidationError extends ElectroError {
  constructor(errors = []) {
    const fields = [];
    const messages = [];
    for (let i = 0; i < errors.length; i++) {
      const error = errors[i];
      const message = error ? error._message || error.message : undefined;
      messages.push(message);
      if (error instanceof ElectroUserValidationError) {
        fields.push({
          field: error.field,
          index: error.index,
          reason: message,
          cause: error.cause,
          type: "validation",
        });
      } else if (error instanceof ElectroAttributeValidationError) {
        fields.push({
          field: error.field,
          index: error.index,
          reason: message,
          cause: error.cause || error, // error | undefined
          type: "validation",
        });
      } else if (message) {
        fields.push({
          field: "",
          index: error.index,
          reason: message,
          cause: error !== undefined ? error.cause || error : undefined,
          type: "fatal",
        });
      }
    }

    const message =
      messages
        .filter((message) => typeof message === "string" && message.length)
        .join(", ") || `Invalid value(s) provided`;

    super(ErrorCodes.InvalidAttribute, message);
    this.fields = fields;
    this.name = "ElectroValidationError";
  }
}

class ElectroUserValidationError extends ElectroError {
  constructor(field, cause) {
    let message;
    let hasCause = false;
    if (typeof cause === "string") {
      message = cause;
    } else if (
      cause !== undefined &&
      typeof cause._message === "string" &&
      cause._message.length
    ) {
      message = cause._message;
      hasCause = true;
    } else if (
      cause !== undefined &&
      typeof cause.message === "string" &&
      cause.message.length
    ) {
      message = cause.message;
      hasCause = true;
    } else {
      message = "Invalid value provided";
    }
    super(ErrorCodes.InvalidAttribute, message);
    this.field = field;
    this.name = "ElectroUserValidationError";
    if (hasCause) {
      this.cause = cause;
    }
  }
}

class ElectroAttributeValidationError extends ElectroError {
  constructor(field, reason) {
    super(ErrorCodes.InvalidAttribute, reason);
    this.field = field;
  }
}

module.exports = {
  ErrorCodes,
  ElectroError,
  applyParamsFn,
  ElectroValidationError,
  ElectroUserValidationError,
  ElectroAttributeValidationError,
};
