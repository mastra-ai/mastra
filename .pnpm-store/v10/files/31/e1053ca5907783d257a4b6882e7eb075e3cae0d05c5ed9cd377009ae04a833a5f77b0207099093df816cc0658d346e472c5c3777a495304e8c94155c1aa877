import { AnyConfig } from './types'

/**
 * Sorts modifiers according to following schema:
 * - Predefined modifiers are sorted alphabetically
 * - When an arbitrary variant appears, it must be preserved which modifiers are before and after it
 */
export const createSortModifiers = (config: AnyConfig) => {
    const orderSensitiveModifiers = Object.fromEntries(
        config.orderSensitiveModifiers.map((modifier) => [modifier, true]),
    )

    const sortModifiers = (modifiers: string[]) => {
        if (modifiers.length <= 1) {
            return modifiers
        }

        const sortedModifiers: string[] = []
        let unsortedModifiers: string[] = []

        modifiers.forEach((modifier) => {
            const isPositionSensitive = modifier[0] === '[' || orderSensitiveModifiers[modifier]

            if (isPositionSensitive) {
                sortedModifiers.push(...unsortedModifiers.sort(), modifier)
                unsortedModifiers = []
            } else {
                unsortedModifiers.push(modifier)
            }
        })

        sortedModifiers.push(...unsortedModifiers.sort())

        return sortedModifiers
    }

    return sortModifiers
}
