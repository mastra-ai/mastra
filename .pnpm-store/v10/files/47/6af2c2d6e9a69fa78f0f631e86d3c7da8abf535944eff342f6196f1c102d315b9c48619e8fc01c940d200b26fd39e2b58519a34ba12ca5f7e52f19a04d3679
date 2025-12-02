// types copied over from @solana/wallet-standard-features and @wallet-standard/base so this library doesn't depend on them

/**
 * A namespaced identifier in the format `${namespace}:${reference}`.
 *
 * Used by {@link IdentifierArray} and {@link IdentifierRecord}.
 *
 * @group Identifier
 */
export type IdentifierString = `${string}:${string}`

/**
 * A read-only array of namespaced identifiers in the format `${namespace}:${reference}`.
 *
 * Used by {@link Wallet.chains | Wallet::chains}, {@link WalletAccount.chains | WalletAccount::chains}, and
 * {@link WalletAccount.features | WalletAccount::features}.
 *
 * @group Identifier
 */
export type IdentifierArray = readonly IdentifierString[]

/**
 * Version of the Wallet Standard implemented by a {@link Wallet}.
 *
 * Used by {@link Wallet.version | Wallet::version}.
 *
 * Note that this is _NOT_ a version of the Wallet, but a version of the Wallet Standard itself that the Wallet
 * supports.
 *
 * This may be used by the app to determine compatibility and feature detect.
 *
 * @group Wallet
 */
export type WalletVersion = '1.0.0'

/**
 * A data URI containing a base64-encoded SVG, WebP, PNG, or GIF image.
 *
 * Used by {@link Wallet.icon | Wallet::icon} and {@link WalletAccount.icon | WalletAccount::icon}.
 *
 * @group Wallet
 */
export type WalletIcon = `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`

/**
 * Interface of a **WalletAccount**, also referred to as an **Account**.
 *
 * An account is a _read-only data object_ that is provided from the Wallet to the app, authorizing the app to use it.
 *
 * The app can use an account to display and query information from a chain.
 *
 * The app can also act using an account by passing it to {@link Wallet.features | features} of the Wallet.
 *
 * Wallets may use or extend {@link "@wallet-standard/wallet".ReadonlyWalletAccount} which implements this interface.
 *
 * @group Wallet
 */
export interface WalletAccount {
  /** Address of the account, corresponding with a public key. */
  readonly address: string

  /** Public key of the account, corresponding with a secret key to use. */
  readonly publicKey: Uint8Array

  /**
   * Chains supported by the account.
   *
   * This must be a subset of the {@link Wallet.chains | chains} of the Wallet.
   */
  readonly chains: IdentifierArray

  /**
   * Feature names supported by the account.
   *
   * This must be a subset of the names of {@link Wallet.features | features} of the Wallet.
   */
  readonly features: IdentifierArray

  /** Optional user-friendly descriptive label or name for the account. This may be displayed by the app. */
  readonly label?: string

  /** Optional user-friendly icon for the account. This may be displayed by the app. */
  readonly icon?: WalletIcon
}

/** Input for signing in. */
export interface SolanaSignInInput {
  /**
   * Optional EIP-4361 Domain.
   * If not provided, the wallet must determine the Domain to include in the message.
   */
  readonly domain?: string

  /**
   * Optional EIP-4361 Address.
   * If not provided, the wallet must determine the Address to include in the message.
   */
  readonly address?: string

  /**
   * Optional EIP-4361 Statement.
   * If not provided, the wallet must not include Statement in the message.
   */
  readonly statement?: string

  /**
   * Optional EIP-4361 URI.
   * If not provided, the wallet must not include URI in the message.
   */
  readonly uri?: string

  /**
   * Optional EIP-4361 Version.
   * If not provided, the wallet must not include Version in the message.
   */
  readonly version?: string

  /**
   * Optional EIP-4361 Chain ID.
   * If not provided, the wallet must not include Chain ID in the message.
   */
  readonly chainId?: string

  /**
   * Optional EIP-4361 Nonce.
   * If not provided, the wallet must not include Nonce in the message.
   */
  readonly nonce?: string

  /**
   * Optional EIP-4361 Issued At.
   * If not provided, the wallet must not include Issued At in the message.
   */
  readonly issuedAt?: string

  /**
   * Optional EIP-4361 Expiration Time.
   * If not provided, the wallet must not include Expiration Time in the message.
   */
  readonly expirationTime?: string

  /**
   * Optional EIP-4361 Not Before.
   * If not provided, the wallet must not include Not Before in the message.
   */
  readonly notBefore?: string

  /**
   * Optional EIP-4361 Request ID.
   * If not provided, the wallet must not include Request ID in the message.
   */
  readonly requestId?: string

  /**
   * Optional EIP-4361 Resources.
   * If not provided, the wallet must not include Resources in the message.
   */
  readonly resources?: readonly string[]
}

/** Output of signing in. */
export interface SolanaSignInOutput {
  /**
   * Account that was signed in.
   * The address of the account may be different from the provided input Address.
   */
  readonly account: WalletAccount

  /**
   * Message bytes that were signed.
   * The wallet may prefix or otherwise modify the message before signing it.
   */
  readonly signedMessage: Uint8Array

  /**
   * Message signature produced.
   * If the signature type is provided, the signature must be Ed25519.
   */
  readonly signature: Uint8Array

  /**
   * Optional type of the message signature produced.
   * If not provided, the signature must be Ed25519.
   */
  readonly signatureType?: 'ed25519'
}
