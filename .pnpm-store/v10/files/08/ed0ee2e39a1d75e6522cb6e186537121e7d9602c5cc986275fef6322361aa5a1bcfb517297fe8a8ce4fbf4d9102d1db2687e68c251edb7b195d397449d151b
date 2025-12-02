/**
 * Represents the type of the IntentEntity.
 */
export declare enum EntityType {
    Unknown = "Unknown",
    Open = "Open",
    BuiltIn = "BuiltIn",
    ClosedList = "ClosedList",
    Dynamic = "Dynamic"
}
/**
 * Substring match for IntentText.
 */
export declare enum SubStringMatch {
    None = "None",
    LeftRooted = "LeftRooted"
}
/**
 * Internal class representing Hints in the DGI v1 Grammar.
 */
export interface Hints {
    /**
     * Gets the EntityType of an IntentEntity.
     * Required when Type=IntentEntity.
     */
    entityType: EntityType;
    /**
     * Gets the Name of an IntentEntity.
     * Required when Type=IntentEntity.
     */
    entityName?: string;
    /**
     * Gets the synonyms of the IntentEntity name as comma seperated values.
     * Optional when Type=IntentEntity
     */
    entitySynonyms?: string;
    /**
     * Gets the Substring match for an IntentEntity
     * Optional only when Type=IntentEntity
     */
    subStringMatch: SubStringMatch;
    /**
     * Gets the Invocation Name for an IntentText.
     * Optional only when Type=IntentText
     */
    invocationName?: string;
    /**
     * Gets the ReferenceGrammar id associated with a previously registered intent payload.
     * Optional only when Type=Generic
     */
    referenceGrammar?: string;
    /**
     * Gets the ReferenceGrammar class name to be linked to above Reference Grammar
     */
    referenceGrammarClassName?: string;
}
