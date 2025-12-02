// types and functions copied over from viem so this library doesn't depend on it

export type Hex = `0x${string}`

export type Address = Hex

export type EIP1193EventMap = {
  accountsChanged(accounts: Address[]): void
  chainChanged(chainId: string): void
  connect(connectInfo: { chainId: string }): void
  disconnect(error: { code: number; message: string }): void
  message(message: { type: string; data: unknown }): void
}

export type EIP1193Events = {
  on<event extends keyof EIP1193EventMap>(event: event, listener: EIP1193EventMap[event]): void
  removeListener<event extends keyof EIP1193EventMap>(
    event: event,
    listener: EIP1193EventMap[event]
  ): void
}

export type EIP1193RequestFn = (args: { method: string; params?: unknown }) => Promise<unknown>

export type EIP1193Provider = EIP1193Events & {
  address: string
  request: EIP1193RequestFn
}

export type EthereumWallet = EIP1193Provider

/**
 * EIP-4361 message fields
 */
export type SiweMessage = {
  /**
   * The Ethereum address performing the signing.
   */
  address: Address
  /**
   * The [EIP-155](https://eips.ethereum.org/EIPS/eip-155) Chain ID to which the session is bound,
   */
  chainId: number
  /**
   * [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) authority that is requesting the signing.
   */
  domain: string
  /**
   * Time when the signed authentication message is no longer valid.
   */
  expirationTime?: Date | undefined
  /**
   * Time when the message was generated, typically the current time.
   */
  issuedAt?: Date | undefined
  /**
   * A random string typically chosen by the relying party and used to prevent replay attacks.
   */
  nonce?: string
  /**
   * Time when the signed authentication message will become valid.
   */
  notBefore?: Date | undefined
  /**
   * A system-specific identifier that may be used to uniquely refer to the sign-in request.
   */
  requestId?: string | undefined
  /**
   * A list of information or references to information the user wishes to have resolved as part of authentication by the relying party.
   */
  resources?: string[] | undefined
  /**
   * [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986#section-3.1) URI scheme of the origin of the request.
   */
  scheme?: string | undefined
  /**
   * A human-readable ASCII assertion that the user will sign.
   */
  statement?: string | undefined
  /**
   * [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) URI referring to the resource that is the subject of the signing (as in the subject of a claim).
   */
  uri: string
  /**
   * The current version of the SIWE Message.
   */
  version: '1'
}

export type EthereumSignInInput = SiweMessage

export function getAddress(address: string): Address {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`@supabase/auth-js: Address "${address}" is invalid.`)
  }
  return address.toLowerCase() as Address
}

export function fromHex(hex: Hex): number {
  return parseInt(hex, 16)
}

export function toHex(value: string): Hex {
  const bytes = new TextEncoder().encode(value)
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return ('0x' + hex) as Hex
}

/**
 * Creates EIP-4361 formatted message.
 */
export function createSiweMessage(parameters: SiweMessage): string {
  const {
    chainId,
    domain,
    expirationTime,
    issuedAt = new Date(),
    nonce,
    notBefore,
    requestId,
    resources,
    scheme,
    uri,
    version,
  } = parameters

  // Validate fields
  {
    if (!Number.isInteger(chainId))
      throw new Error(
        `@supabase/auth-js: Invalid SIWE message field "chainId". Chain ID must be a EIP-155 chain ID. Provided value: ${chainId}`
      )

    if (!domain)
      throw new Error(
        `@supabase/auth-js: Invalid SIWE message field "domain". Domain must be provided.`
      )

    if (nonce && nonce.length < 8)
      throw new Error(
        `@supabase/auth-js: Invalid SIWE message field "nonce". Nonce must be at least 8 characters. Provided value: ${nonce}`
      )

    if (!uri)
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "uri". URI must be provided.`)

    if (version !== '1')
      throw new Error(
        `@supabase/auth-js: Invalid SIWE message field "version". Version must be '1'. Provided value: ${version}`
      )

    if (parameters.statement?.includes('\n'))
      throw new Error(
        `@supabase/auth-js: Invalid SIWE message field "statement". Statement must not include '\\n'. Provided value: ${parameters.statement}`
      )
  }

  // Construct message
  const address = getAddress(parameters.address)
  const origin = scheme ? `${scheme}://${domain}` : domain
  const statement = parameters.statement ? `${parameters.statement}\n` : ''
  const prefix = `${origin} wants you to sign in with your Ethereum account:\n${address}\n\n${statement}`

  let suffix = `URI: ${uri}\nVersion: ${version}\nChain ID: ${chainId}${
    nonce ? `\nNonce: ${nonce}` : ''
  }\nIssued At: ${issuedAt.toISOString()}`

  if (expirationTime) suffix += `\nExpiration Time: ${expirationTime.toISOString()}`
  if (notBefore) suffix += `\nNot Before: ${notBefore.toISOString()}`
  if (requestId) suffix += `\nRequest ID: ${requestId}`
  if (resources) {
    let content = '\nResources:'
    for (const resource of resources) {
      if (!resource || typeof resource !== 'string')
        throw new Error(
          `@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: ${resource}`
        )
      content += `\n- ${resource}`
    }
    suffix += content
  }

  return `${prefix}\n${suffix}`
}
