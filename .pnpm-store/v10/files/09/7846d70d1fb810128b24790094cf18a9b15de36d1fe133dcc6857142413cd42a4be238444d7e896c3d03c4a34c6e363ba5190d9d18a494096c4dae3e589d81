const arbitraryValueRegex = /^\[(?:(\w[\w-]*):)?(.+)\]$/i
const arbitraryVariableRegex = /^\((?:(\w[\w-]*):)?(.+)\)$/i
const fractionRegex = /^\d+\/\d+$/
const tshirtUnitRegex = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/
const lengthUnitRegex =
    /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/
const colorFunctionRegex = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/
// Shadow always begins with x and y offset separated by underscore optionally prepended by inset
const shadowRegex = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/
const imageRegex =
    /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/

export const isFraction = (value: string) => fractionRegex.test(value)

export const isNumber = (value: string) => !!value && !Number.isNaN(Number(value))

export const isInteger = (value: string) => !!value && Number.isInteger(Number(value))

export const isPercent = (value: string) => value.endsWith('%') && isNumber(value.slice(0, -1))

export const isTshirtSize = (value: string) => tshirtUnitRegex.test(value)

export const isAny = () => true

const isLengthOnly = (value: string) =>
    // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
    // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
    // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
    lengthUnitRegex.test(value) && !colorFunctionRegex.test(value)

const isNever = () => false

const isShadow = (value: string) => shadowRegex.test(value)

const isImage = (value: string) => imageRegex.test(value)

export const isAnyNonArbitrary = (value: string) =>
    !isArbitraryValue(value) && !isArbitraryVariable(value)

export const isArbitrarySize = (value: string) => getIsArbitraryValue(value, isLabelSize, isNever)

export const isArbitraryValue = (value: string) => arbitraryValueRegex.test(value)

export const isArbitraryLength = (value: string) =>
    getIsArbitraryValue(value, isLabelLength, isLengthOnly)

export const isArbitraryNumber = (value: string) =>
    getIsArbitraryValue(value, isLabelNumber, isNumber)

export const isArbitraryPosition = (value: string) =>
    getIsArbitraryValue(value, isLabelPosition, isNever)

export const isArbitraryImage = (value: string) => getIsArbitraryValue(value, isLabelImage, isImage)

export const isArbitraryShadow = (value: string) =>
    getIsArbitraryValue(value, isLabelShadow, isShadow)

export const isArbitraryVariable = (value: string) => arbitraryVariableRegex.test(value)

export const isArbitraryVariableLength = (value: string) =>
    getIsArbitraryVariable(value, isLabelLength)

export const isArbitraryVariableFamilyName = (value: string) =>
    getIsArbitraryVariable(value, isLabelFamilyName)

export const isArbitraryVariablePosition = (value: string) =>
    getIsArbitraryVariable(value, isLabelPosition)

export const isArbitraryVariableSize = (value: string) => getIsArbitraryVariable(value, isLabelSize)

export const isArbitraryVariableImage = (value: string) =>
    getIsArbitraryVariable(value, isLabelImage)

export const isArbitraryVariableShadow = (value: string) =>
    getIsArbitraryVariable(value, isLabelShadow, true)

// Helpers

const getIsArbitraryValue = (
    value: string,
    testLabel: (label: string) => boolean,
    testValue: (value: string) => boolean,
) => {
    const result = arbitraryValueRegex.exec(value)

    if (result) {
        if (result[1]) {
            return testLabel(result[1])
        }

        return testValue(result[2]!)
    }

    return false
}

const getIsArbitraryVariable = (
    value: string,
    testLabel: (label: string) => boolean,
    shouldMatchNoLabel = false,
) => {
    const result = arbitraryVariableRegex.exec(value)

    if (result) {
        if (result[1]) {
            return testLabel(result[1])
        }
        return shouldMatchNoLabel
    }

    return false
}

// Labels

const isLabelPosition = (label: string) => label === 'position' || label === 'percentage'

const isLabelImage = (label: string) => label === 'image' || label === 'url'

const isLabelSize = (label: string) => label === 'length' || label === 'size' || label === 'bg-size'

const isLabelLength = (label: string) => label === 'length'

const isLabelNumber = (label: string) => label === 'number'

const isLabelFamilyName = (label: string) => label === 'family-name'

const isLabelShadow = (label: string) => label === 'shadow'
