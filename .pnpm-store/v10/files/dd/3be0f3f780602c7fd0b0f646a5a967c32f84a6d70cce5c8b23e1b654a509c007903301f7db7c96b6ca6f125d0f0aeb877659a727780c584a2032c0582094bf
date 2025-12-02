/**
 * Type the tailwind-merge configuration adheres to.
 */
export interface Config<ClassGroupIds extends string, ThemeGroupIds extends string>
    extends ConfigStaticPart,
        ConfigGroupsPart<ClassGroupIds, ThemeGroupIds> {}

/**
 * The static part of the tailwind-merge configuration. When merging multiple configurations, the properties of this interface are always overridden.
 */
interface ConfigStaticPart {
    /**
     * Integer indicating size of LRU cache used for memoizing results.
     * - Cache might be up to twice as big as `cacheSize`
     * - No cache is used for values <= 0
     */
    cacheSize: number
    /**
     * Prefix added to Tailwind-generated classes
     * @see https://tailwindcss.com/docs/configuration#prefix
     */
    prefix?: string
    /**
     * Allows to customize parsing of individual classes passed to `twMerge`.
     * All classes passed to `twMerge` outside of cache hits are passed to this function before it is determined whether the class is a valid Tailwind CSS class.
     *
     * This is an experimental feature and may introduce breaking changes in any minor version update.
     */
    experimentalParseClassName?(param: ExperimentalParseClassNameParam): ParsedClassName
}

/**
 * Type of param passed to the `experimentalParseClassName` function.
 *
 * This is an experimental feature and may introduce breaking changes in any minor version update.
 */
export interface ExperimentalParseClassNameParam {
    className: string
    parseClassName(className: string): ParsedClassName
}

/**
 * Type of the result returned by the `experimentalParseClassName` function.
 *
 * This is an experimental feature and may introduce breaking changes in any minor version update.
 */
export interface ParsedClassName {
    /**
     * Whether the class is external and merging logic should be sipped.
     *
     * If this is `true`, the class will be treated as if it wasn't a Tailwind class and will be passed through as is.
     */
    isExternal?: boolean
    /**
     * Modifiers of the class in the order they appear in the class.
     *
     * @example ['hover', 'dark'] // for `hover:dark:bg-gray-100`
     */
    modifiers: string[]
    /**
     * Whether the class has an `!important` modifier.
     *
     * @example true // for `hover:dark:!bg-gray-100`
     */
    hasImportantModifier: boolean
    /**
     * Base class without preceding modifiers.
     *
     * @example 'bg-gray-100' // for `hover:dark:bg-gray-100`
     */
    baseClassName: string
    /**
     * Index position of a possible postfix modifier in the class.
     * If the class has no postfix modifier, this is `undefined`.
     *
     * This property is prefixed with "maybe" because tailwind-merge does not know whether something is a postfix modifier or part of the base class since it's possible to configure Tailwind CSS classes which include a `/` in the base class name.
     *
     * If a `maybePostfixModifierPosition` is present, tailwind-merge first tries to match the `baseClassName` without the possible postfix modifier to a class group. If that fails, it tries again with the possible postfix modifier.
     *
     * @example 11 // for `bg-gray-100/50`
     */
    maybePostfixModifierPosition: number | undefined
}

/**
 * The dynamic part of the tailwind-merge configuration. When merging multiple configurations, the user can choose to either override or extend the properties of this interface.
 */
interface ConfigGroupsPart<ClassGroupIds extends string, ThemeGroupIds extends string> {
    /**
     * Theme scales used in classGroups.
     *
     * The keys are the same as in the Tailwind config but the values are sometimes defined more broadly.
     */
    theme: NoInfer<ThemeObject<ThemeGroupIds>>
    /**
     * Object with groups of classes.
     *
     * @example
     * {
     *     // Creates group of classes `group`, `of` and `classes`
     *     'group-id': ['group', 'of', 'classes'],
     *     // Creates group of classes `look-at-me-other` and `look-at-me-group`.
     *     'other-group': [{ 'look-at-me': ['other', 'group']}]
     * }
     */
    classGroups: NoInfer<Record<ClassGroupIds, ClassGroup<ThemeGroupIds>>>
    /**
     * Conflicting classes across groups.
     *
     * The key is the ID of a class group which creates a conflict, values are IDs of class groups which receive a conflict. That means if a class from from the key ID is present, all preceding classes from the values are removed.
     *
     * A class group ID is the key of a class group in the classGroups object.
     *
     * @example { gap: ['gap-x', 'gap-y'] }
     */
    conflictingClassGroups: NoInfer<Partial<Record<ClassGroupIds, readonly ClassGroupIds[]>>>
    /**
     * Postfix modifiers conflicting with other class groups.
     *
     * A class group ID is the key of a class group in classGroups object.
     *
     * @example { 'font-size': ['leading'] }
     */
    conflictingClassGroupModifiers: NoInfer<
        Partial<Record<ClassGroupIds, readonly ClassGroupIds[]>>
    >
    /**
     * Modifiers whose order among multiple modifiers should be preserved because their order changes which element gets targeted.
     *
     * tailwind-merge makes sure that classes with these modifiers are not overwritten by classes with the same modifiers with order-sensitive modifiers being in a different position.
     */
    orderSensitiveModifiers: string[]
}

/**
 * Type of the configuration object that can be passed to `extendTailwindMerge`.
 */
export interface ConfigExtension<ClassGroupIds extends string, ThemeGroupIds extends string>
    extends Partial<ConfigStaticPart> {
    override?: PartialPartial<ConfigGroupsPart<ClassGroupIds, ThemeGroupIds>>
    extend?: PartialPartial<ConfigGroupsPart<ClassGroupIds, ThemeGroupIds>>
}

type PartialPartial<T> = {
    [P in keyof T]?: T[P] extends any[] ? T[P] : Partial<T[P]>
}

export type ThemeObject<ThemeGroupIds extends string> = Record<
    ThemeGroupIds,
    ClassGroup<ThemeGroupIds>
>
export type ClassGroup<ThemeGroupIds extends string> = readonly ClassDefinition<ThemeGroupIds>[]
type ClassDefinition<ThemeGroupIds extends string> =
    | string
    | ClassValidator
    | ThemeGetter
    | ClassObject<ThemeGroupIds>
export type ClassValidator = (classPart: string) => boolean
export interface ThemeGetter {
    (theme: ThemeObject<AnyThemeGroupIds>): ClassGroup<AnyClassGroupIds>
    isThemeGetter: true
}
type ClassObject<ThemeGroupIds extends string> = Record<
    string,
    readonly ClassDefinition<ThemeGroupIds>[]
>

/**
 * Hack from https://stackoverflow.com/questions/56687668/a-way-to-disable-type-argument-inference-in-generics/56688073#56688073
 *
 * Could be replaced with NoInfer utility type from TypeScript (https://www.typescriptlang.org/docs/handbook/utility-types.html#noinfertype), but that is only supported in TypeScript 5.4 or higher, so I should wait some time before using it.
 */
export type NoInfer<T> = [T][T extends any ? 0 : never]

/**
 * Theme group IDs included in the default configuration of tailwind-merge.
 *
 * If you want to use a scale that is not supported in the `ThemeObject` type,
 * consider using `classGroups` instead of `theme`.
 *
 * @see https://github.com/dcastil/tailwind-merge/blob/main/docs/configuration.md#theme
 *      (the list of supported keys may vary between `tailwind-merge` versions)
 */
export type DefaultThemeGroupIds =
    | 'animate'
    | 'aspect'
    | 'blur'
    | 'breakpoint'
    | 'color'
    | 'container'
    | 'drop-shadow'
    | 'ease'
    | 'font-weight'
    | 'font'
    | 'inset-shadow'
    | 'leading'
    | 'perspective'
    | 'radius'
    | 'shadow'
    | 'spacing'
    | 'text'
    | 'text-shadow'
    | 'tracking'

/**
 * Class group IDs included in the default configuration of tailwind-merge.
 */
export type DefaultClassGroupIds =
    | 'accent'
    | 'align-content'
    | 'align-items'
    | 'align-self'
    | 'animate'
    | 'appearance'
    | 'aspect'
    | 'auto-cols'
    | 'auto-rows'
    | 'backdrop-blur'
    | 'backdrop-brightness'
    | 'backdrop-contrast'
    | 'backdrop-filter'
    | 'backdrop-grayscale'
    | 'backdrop-hue-rotate'
    | 'backdrop-invert'
    | 'backdrop-opacity'
    | 'backdrop-saturate'
    | 'backdrop-sepia'
    | 'backface'
    | 'basis'
    | 'bg-attachment'
    | 'bg-blend'
    | 'bg-clip'
    | 'bg-color'
    | 'bg-image'
    | 'bg-origin'
    | 'bg-position'
    | 'bg-repeat'
    | 'bg-size'
    | 'blur'
    | 'border-collapse'
    | 'border-color-b'
    | 'border-color-e'
    | 'border-color-l'
    | 'border-color-r'
    | 'border-color-s'
    | 'border-color-t'
    | 'border-color-x'
    | 'border-color-y'
    | 'border-color'
    | 'border-spacing-x'
    | 'border-spacing-y'
    | 'border-spacing'
    | 'border-style'
    | 'border-w-b'
    | 'border-w-e'
    | 'border-w-l'
    | 'border-w-r'
    | 'border-w-s'
    | 'border-w-t'
    | 'border-w-x'
    | 'border-w-y'
    | 'border-w'
    | 'bottom'
    | 'box-decoration'
    | 'box'
    | 'break-after'
    | 'break-before'
    | 'break-inside'
    | 'break'
    | 'brightness'
    | 'caption'
    | 'caret-color'
    | 'clear'
    | 'col-end'
    | 'col-start-end'
    | 'col-start'
    | 'color-scheme'
    | 'columns'
    | 'container'
    | 'content'
    | 'contrast'
    | 'cursor'
    | 'delay'
    | 'display'
    | 'divide-color'
    | 'divide-style'
    | 'divide-x-reverse'
    | 'divide-x'
    | 'divide-y-reverse'
    | 'divide-y'
    | 'drop-shadow'
    | 'drop-shadow-color'
    | 'duration'
    | 'ease'
    | 'end'
    | 'field-sizing'
    | 'fill'
    | 'filter'
    | 'flex-direction'
    | 'flex-wrap'
    | 'flex'
    | 'float'
    | 'font-family'
    | 'font-size'
    | 'font-smoothing'
    | 'font-stretch'
    | 'font-style'
    | 'font-weight'
    | 'forced-color-adjust'
    | 'fvn-figure'
    | 'fvn-fraction'
    | 'fvn-normal'
    | 'fvn-ordinal'
    | 'fvn-slashed-zero'
    | 'fvn-spacing'
    | 'gap-x'
    | 'gap-y'
    | 'gap'
    | 'gradient-from-pos'
    | 'gradient-from'
    | 'gradient-to-pos'
    | 'gradient-to'
    | 'gradient-via-pos'
    | 'gradient-via'
    | 'grayscale'
    | 'grid-cols'
    | 'grid-flow'
    | 'grid-rows'
    | 'grow'
    | 'h'
    | 'hue-rotate'
    | 'hyphens'
    | 'indent'
    | 'inset-ring-color'
    | 'inset-ring-w'
    | 'inset-shadow-color'
    | 'inset-shadow'
    | 'inset-x'
    | 'inset-y'
    | 'inset'
    | 'invert'
    | 'isolation'
    | 'justify-content'
    | 'justify-items'
    | 'justify-self'
    | 'leading'
    | 'left'
    | 'line-clamp'
    | 'list-image'
    | 'list-style-position'
    | 'list-style-type'
    | 'm'
    | 'mask-clip'
    | 'mask-composite'
    | 'mask-image-b-from-color'
    | 'mask-image-b-from-pos'
    | 'mask-image-b-to-color'
    | 'mask-image-b-to-pos'
    | 'mask-image-conic-from-color'
    | 'mask-image-conic-from-pos'
    | 'mask-image-conic-pos'
    | 'mask-image-conic-to-color'
    | 'mask-image-conic-to-pos'
    | 'mask-image-l-from-color'
    | 'mask-image-l-from-pos'
    | 'mask-image-l-to-color'
    | 'mask-image-l-to-pos'
    | 'mask-image-linear-from-color'
    | 'mask-image-linear-from-pos'
    | 'mask-image-linear-pos'
    | 'mask-image-linear-to-color'
    | 'mask-image-linear-to-pos'
    | 'mask-image-r-from-color'
    | 'mask-image-r-from-pos'
    | 'mask-image-r-to-color'
    | 'mask-image-r-to-pos'
    | 'mask-image-radial-from-color'
    | 'mask-image-radial-from-pos'
    | 'mask-image-radial-pos'
    | 'mask-image-radial-shape'
    | 'mask-image-radial-size'
    | 'mask-image-radial-to-color'
    | 'mask-image-radial-to-pos'
    | 'mask-image-radial'
    | 'mask-image-t-from-color'
    | 'mask-image-t-from-pos'
    | 'mask-image-t-to-color'
    | 'mask-image-t-to-pos'
    | 'mask-image-x-from-color'
    | 'mask-image-x-from-pos'
    | 'mask-image-x-to-color'
    | 'mask-image-x-to-pos'
    | 'mask-image-y-from-color'
    | 'mask-image-y-from-pos'
    | 'mask-image-y-to-color'
    | 'mask-image-y-to-pos'
    | 'mask-image'
    | 'mask-mode'
    | 'mask-origin'
    | 'mask-position'
    | 'mask-repeat'
    | 'mask-size'
    | 'mask-type'
    | 'max-h'
    | 'max-w'
    | 'mb'
    | 'me'
    | 'min-h'
    | 'min-w'
    | 'mix-blend'
    | 'ml'
    | 'mr'
    | 'ms'
    | 'mt'
    | 'mx'
    | 'my'
    | 'object-fit'
    | 'object-position'
    | 'opacity'
    | 'order'
    | 'outline-color'
    | 'outline-offset'
    | 'outline-style'
    | 'outline-w'
    | 'overflow-x'
    | 'overflow-y'
    | 'overflow'
    | 'overscroll-x'
    | 'overscroll-y'
    | 'overscroll'
    | 'p'
    | 'pb'
    | 'pe'
    | 'perspective-origin'
    | 'perspective'
    | 'pl'
    | 'place-content'
    | 'place-items'
    | 'place-self'
    | 'placeholder-color'
    | 'pointer-events'
    | 'position'
    | 'pr'
    | 'ps'
    | 'pt'
    | 'px'
    | 'py'
    | 'resize'
    | 'right'
    | 'ring-color'
    | 'ring-offset-color'
    | 'ring-offset-w'
    | 'ring-w-inset'
    | 'ring-w'
    | 'rotate-x'
    | 'rotate-y'
    | 'rotate-z'
    | 'rotate'
    | 'rounded-b'
    | 'rounded-bl'
    | 'rounded-br'
    | 'rounded-e'
    | 'rounded-ee'
    | 'rounded-es'
    | 'rounded-l'
    | 'rounded-r'
    | 'rounded-s'
    | 'rounded-se'
    | 'rounded-ss'
    | 'rounded-t'
    | 'rounded-tl'
    | 'rounded-tr'
    | 'rounded'
    | 'row-end'
    | 'row-start-end'
    | 'row-start'
    | 'saturate'
    | 'scale-3d'
    | 'scale-x'
    | 'scale-y'
    | 'scale-z'
    | 'scale'
    | 'scroll-behavior'
    | 'scroll-m'
    | 'scroll-mb'
    | 'scroll-me'
    | 'scroll-ml'
    | 'scroll-mr'
    | 'scroll-ms'
    | 'scroll-mt'
    | 'scroll-mx'
    | 'scroll-my'
    | 'scroll-p'
    | 'scroll-pb'
    | 'scroll-pe'
    | 'scroll-pl'
    | 'scroll-pr'
    | 'scroll-ps'
    | 'scroll-pt'
    | 'scroll-px'
    | 'scroll-py'
    | 'select'
    | 'sepia'
    | 'shadow-color'
    | 'shadow'
    | 'shrink'
    | 'size'
    | 'skew-x'
    | 'skew-y'
    | 'skew'
    | 'snap-align'
    | 'snap-stop'
    | 'snap-strictness'
    | 'snap-type'
    | 'space-x-reverse'
    | 'space-x'
    | 'space-y-reverse'
    | 'space-y'
    | 'sr'
    | 'start'
    | 'stroke-w'
    | 'stroke'
    | 'table-layout'
    | 'text-alignment'
    | 'text-color'
    | 'text-decoration-color'
    | 'text-decoration-style'
    | 'text-decoration-thickness'
    | 'text-decoration'
    | 'text-overflow'
    | 'text-shadow'
    | 'text-shadow-color'
    | 'text-transform'
    | 'text-wrap'
    | 'top'
    | 'touch-pz'
    | 'touch-x'
    | 'touch-y'
    | 'touch'
    | 'tracking'
    | 'transform-origin'
    | 'transform-style'
    | 'transform'
    | 'transition-behavior'
    | 'transition'
    | 'translate-none'
    | 'translate-x'
    | 'translate-y'
    | 'translate-z'
    | 'translate'
    | 'underline-offset'
    | 'vertical-align'
    | 'visibility'
    | 'w'
    | 'whitespace'
    | 'will-change'
    | 'wrap'
    | 'z'

export type AnyClassGroupIds = string
export type AnyThemeGroupIds = string

/**
 * type of the tailwind-merge configuration that allows for any possible configuration.
 */
export type AnyConfig = Config<AnyClassGroupIds, AnyThemeGroupIds>
