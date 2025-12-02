import { Hints } from "./Hints";
import { Item } from "./Item";
/**
 * Represents the type of the Intent.
 */
export declare enum GroupType {
    IntentText = "IntentText",
    IntentEntity = "IntentEntity",
    Generic = "Generic",
    People = "People",
    Place = "Place",
    DynamicEntity = "DynamicEntity"
}
/**
 * Represents the type of the substring match.
 */
export declare enum SubstringMatchType {
    None = "None",
    LeftRooted = "LeftRooted",
    PartialName = "PartialName",
    MiddleOfSentence = "MiddleOfSentence"
}
/**
 * Internal class representing a Group in the DGI v1 grammar.
 */
export interface Group {
    /**
     * The Type of the Group in the grammar.
     */
    type: GroupType;
    /**
     * Gets the Hints in the Grammar.
     * Required when Type=IntentEntity
     */
    hints?: Hints;
    /**
     * Gets the Grammar name.
     */
    name?: string;
    /**
     * Gets the substring match.
     */
    substringMatch?: SubstringMatchType;
    /**
     * Gets the Items in the Grammar.
     * Required when Type=IntentText, Optional when Type=IntentEntity but need to remove unused Open IntentEntity
     */
    items?: Item[];
}
