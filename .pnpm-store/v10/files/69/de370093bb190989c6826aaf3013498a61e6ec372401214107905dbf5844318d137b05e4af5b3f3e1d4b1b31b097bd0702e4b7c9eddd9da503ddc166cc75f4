import { AddressEntry } from "./AddressEntry";
import { PhoneNumberEntry } from "./PhoneNumberEntry";
/**
 * Internal class representing an Item in the DGI v1 grammar.
 */
export interface Item {
    /**
     * Represents the Text in an IntentText in the grammar.
     * Required when Type = IntentText or IntentEntity
     * No spaces and punctuation allowed.
     * References IntentEntity within "{""}"
     */
    text?: string;
    /**
     * Gets the Name in an People/Place in the grammar.
     */
    name?: string;
    /**
     * Gets the FirstName in an People in the grammar.
     */
    first?: string;
    /**
     * Gets the MiddleName in an People in the grammar.
     * This field is not supported for now.
     */
    middle?: string;
    /**
     * Gets the LastName in an People in the grammar.
     */
    last?: string;
    /**
     * Gets Addresses in the grammar.
     */
    addresses?: AddressEntry[];
    /**
     * Gets Phone numbers in the grammar.
     */
    phoneNumbers?: PhoneNumberEntry[];
    /**
     * Gets the Synonyms of IntentText in the grammar.
     * Optional only when when Type=IntextText or People.
     */
    synonyms?: string[];
    /**
     * Gets the Weight
     * This is an optional weight to associate with this item and its synonyms.
     * Optional only when when Type=IntextText or Person. Value between 0 and 1.
     */
    weight?: number;
}
