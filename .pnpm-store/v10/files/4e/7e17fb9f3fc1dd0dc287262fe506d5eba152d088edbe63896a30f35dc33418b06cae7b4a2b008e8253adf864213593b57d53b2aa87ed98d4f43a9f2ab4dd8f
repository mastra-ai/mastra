/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * Copyright 2021 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomSignalOperator = exports.PercentConditionOperator = void 0;
/**
 * Defines supported operators for percent conditions.
 */
var PercentConditionOperator;
(function (PercentConditionOperator) {
    /**
     * A catchall error case.
     */
    PercentConditionOperator["UNKNOWN"] = "UNKNOWN";
    /**
     * Target percentiles less than or equal to the target percent.
     * A condition using this operator must specify microPercent.
     */
    PercentConditionOperator["LESS_OR_EQUAL"] = "LESS_OR_EQUAL";
    /**
     * Target percentiles greater than the target percent.
     * A condition using this operator must specify microPercent.
     */
    PercentConditionOperator["GREATER_THAN"] = "GREATER_THAN";
    /**
     * Target percentiles within an interval defined by a lower bound and an
     * upper bound. The lower bound is an exclusive (open) bound and the
     * micro_percent_range_upper_bound is an inclusive (closed) bound.
     * A condition using this operator must specify microPercentRange.
     */
    PercentConditionOperator["BETWEEN"] = "BETWEEN";
})(PercentConditionOperator || (exports.PercentConditionOperator = PercentConditionOperator = {}));
/**
 * Defines supported operators for custom signal conditions.
 */
var CustomSignalOperator;
(function (CustomSignalOperator) {
    /**
     * A catchall error case.
     */
    CustomSignalOperator["UNKNOWN"] = "UNKNOWN";
    /**
     * Matches a numeric value less than the target value.
     */
    CustomSignalOperator["NUMERIC_LESS_THAN"] = "NUMERIC_LESS_THAN";
    /**
     * Matches a numeric value less than or equal to the target value.
     */
    CustomSignalOperator["NUMERIC_LESS_EQUAL"] = "NUMERIC_LESS_EQUAL";
    /**
     * Matches a numeric value equal to the target value.
     */
    CustomSignalOperator["NUMERIC_EQUAL"] = "NUMERIC_EQUAL";
    /**
     * Matches a numeric value not equal to the target value.
     */
    CustomSignalOperator["NUMERIC_NOT_EQUAL"] = "NUMERIC_NOT_EQUAL";
    /**
     * Matches a numeric value greater than the target value.
     */
    CustomSignalOperator["NUMERIC_GREATER_THAN"] = "NUMERIC_GREATER_THAN";
    /**
     * Matches a numeric value greater than or equal to the target value.
     */
    CustomSignalOperator["NUMERIC_GREATER_EQUAL"] = "NUMERIC_GREATER_EQUAL";
    /**
     * Matches if at least one of the target values is a substring of the actual custom
     * signal value (e.g. "abc" contains the string "a", "bc").
     */
    CustomSignalOperator["STRING_CONTAINS"] = "STRING_CONTAINS";
    /**
     * Matches if none of the target values is a substring of the actual custom signal value.
     */
    CustomSignalOperator["STRING_DOES_NOT_CONTAIN"] = "STRING_DOES_NOT_CONTAIN";
    /**
     * Matches if the actual value exactly matches at least one of the target values.
     */
    CustomSignalOperator["STRING_EXACTLY_MATCHES"] = "STRING_EXACTLY_MATCHES";
    /**
     * The target regular expression matches at least one of the actual values.
     * The regex conforms to RE2 format. See https://github.com/google/re2/wiki/Syntax
     */
    CustomSignalOperator["STRING_CONTAINS_REGEX"] = "STRING_CONTAINS_REGEX";
    /**
     * Matches if the actual version value is less than the target value.
     */
    CustomSignalOperator["SEMANTIC_VERSION_LESS_THAN"] = "SEMANTIC_VERSION_LESS_THAN";
    /**
     * Matches if the actual version value is less than or equal to the target value.
     */
    CustomSignalOperator["SEMANTIC_VERSION_LESS_EQUAL"] = "SEMANTIC_VERSION_LESS_EQUAL";
    /**
     * Matches if the actual version value is equal to the target value.
     */
    CustomSignalOperator["SEMANTIC_VERSION_EQUAL"] = "SEMANTIC_VERSION_EQUAL";
    /**
     * Matches if the actual version value is not equal to the target value.
     */
    CustomSignalOperator["SEMANTIC_VERSION_NOT_EQUAL"] = "SEMANTIC_VERSION_NOT_EQUAL";
    /**
     * Matches if the actual version value is greater than the target value.
     */
    CustomSignalOperator["SEMANTIC_VERSION_GREATER_THAN"] = "SEMANTIC_VERSION_GREATER_THAN";
    /**
     * Matches if the actual version value is greater than or equal to the target value.
     */
    CustomSignalOperator["SEMANTIC_VERSION_GREATER_EQUAL"] = "SEMANTIC_VERSION_GREATER_EQUAL";
})(CustomSignalOperator || (exports.CustomSignalOperator = CustomSignalOperator = {}));
