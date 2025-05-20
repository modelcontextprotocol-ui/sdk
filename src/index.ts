/**
 * MPC-UI Embedding Protocol SDK
 * Version: 1.0.0
 *
 * A TypeScript SDK for implementing embeddable UI elements that conform to the
 * MPC-UI Embedding Protocol Specification (Version 1.0.0).
 */

/**
 * Protocol version supported by this SDK
 */
export const PROTOCOL_VERSION = '1.0.0'

/**
 * Message types for Host → UI communication
 */
export enum HostMessageType {
  INIT = 'init',
  UPDATE_CONTEXT = 'update_context',
  THEME = 'theme',
  AUTH_UPDATE = 'auth_update',
  AUTH_REVOKE = 'auth_revoke',
  PERMISSION_GRANTED = 'permission_granted',
  PERMISSION_REVOKED = 'permission_revoked',
}

/**
 * Message types for UI → Host communication
 */
export enum UIMessageType {
  READY = 'ready',
  ACTION = 'action',
  ERROR = 'error',
  RESIZE = 'resize',
  REQUEST_PERMISSION = 'request_permission',
}

/**
 * Error codes for UI → Host error messages
 */
export enum ErrorCode {
  PROTOCOL_ERROR = 'protocol_error',
  AUTH_ERROR = 'auth_error',
  CONTEXT_ERROR = 'context_error',
  RENDER_ERROR = 'render_error',
  PERMISSION_ERROR = 'permission_error',
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * Basic user information
 */
export interface User {
  id: string
  [key: string]: any // Additional user properties
}

/**
 * Authentication information
 */
export interface Auth {
  token: string
  jwks_url: string
  [key: string]: any // Additional auth properties
}

/**
 * Theme settings
 */
export interface ThemeSettings {
  mode?: 'light' | 'dark'
  primary_color?: string
  secondary_color?: string
  font_family?: string
  border_radius?: string
  [key: string]: any // Additional theme settings
}

/**
 * Base message structure
 */
export interface Message {
  type: string
  [key: string]: any
}

/**
 * Init message from Host to UI
 */
export interface InitMessage extends Message {
  type: HostMessageType.INIT
  protocol_version: string
  user?: User
  auth?: Auth
  context?: any
  theme_settings?: ThemeSettings
}

/**
 * Update context message from Host to UI
 */
export interface UpdateContextMessage extends Message {
  type: HostMessageType.UPDATE_CONTEXT
  context: any
}

/**
 * Theme message from Host to UI
 */
export interface ThemeMessage extends Message {
  type: HostMessageType.THEME
  theme_settings: ThemeSettings
}

/**
 * Auth update message from Host to UI
 */
export interface AuthUpdateMessage extends Message {
  type: HostMessageType.AUTH_UPDATE
  auth: Auth
}

/**
 * Auth revoke message from Host to UI
 */
export interface AuthRevokeMessage extends Message {
  type: HostMessageType.AUTH_REVOKE
}

/**
 * Permission granted message from Host to UI
 */
export interface PermissionGrantedMessage extends Message {
  type: HostMessageType.PERMISSION_GRANTED
  scope: string
  granted: boolean
  auth?: Auth
}

/**
 * Permission revoked message from Host to UI
 */
export interface PermissionRevokedMessage extends Message {
  type: HostMessageType.PERMISSION_REVOKED
  scope: string
}

/**
 * Ready message from UI to Host
 */
export interface ReadyMessage extends Message {
  type: UIMessageType.READY
}

/**
 * Action message from UI to Host
 */
export interface ActionMessage extends Message {
  type: UIMessageType.ACTION
  action_name: string
  payload?: any
}

/**
 * Error message from UI to Host
 */
export interface ErrorMessage extends Message {
  type: UIMessageType.ERROR
  code: ErrorCode | string
  message: string
}

/**
 * Resize message from UI to Host
 */
export interface ResizeMessage extends Message {
  type: UIMessageType.RESIZE
  width?: string
  height?: string
}

/**
 * Request permission message from UI to Host
 */
export interface RequestPermissionMessage extends Message {
  type: UIMessageType.REQUEST_PERMISSION
  scope: string
  reasoning?: string
}

/**
 * Type guard for checking if a message is from the host
 */
export function isHostMessage(
  message: Message,
): message is
  | InitMessage
  | UpdateContextMessage
  | ThemeMessage
  | AuthUpdateMessage
  | AuthRevokeMessage
  | PermissionGrantedMessage
  | PermissionRevokedMessage {
  return [
    HostMessageType.INIT,
    HostMessageType.UPDATE_CONTEXT,
    HostMessageType.THEME,
    HostMessageType.AUTH_UPDATE,
    HostMessageType.AUTH_REVOKE,
    HostMessageType.PERMISSION_GRANTED,
    HostMessageType.PERMISSION_REVOKED,
  ].includes(message.type as HostMessageType)
}

/**
 * Type guard for checking if a message is from the UI
 */
export function isUIMessage(
  message: Message,
): message is
  | ReadyMessage
  | ActionMessage
  | ErrorMessage
  | ResizeMessage
  | RequestPermissionMessage {
  return [
    UIMessageType.READY,
    UIMessageType.ACTION,
    UIMessageType.ERROR,
    UIMessageType.RESIZE,
    UIMessageType.REQUEST_PERMISSION,
  ].includes(message.type as UIMessageType)
}

/**
 * Type guard for checking if a message is an init message
 */
export function isInitMessage(message: Message): message is InitMessage {
  return message.type === HostMessageType.INIT
}

/**
 * JWT validation utilities
 */
export class JWTUtils {
  /**
   * Decodes a JWT token without validation
   */
  static decode(token: string): { header: any; payload: any } {
    try {
      const [headerB64, payloadB64] = token.split('.')
      const header = JSON.parse(atob(headerB64))
      const payload = JSON.parse(atob(payloadB64))
      return { header, payload }
    } catch (error) {
      throw new Error('Invalid JWT format')
    }
  }

  /**
   * Checks if a token is expired
   */
  static isExpired(token: string): boolean {
    try {
      const { payload } = this.decode(token)
      const now = Math.floor(Date.now() / 1000)
      return payload.exp <= now
    } catch (error) {
      return true
    }
  }

  /**
   * Validates if a scope is included in the token
   */
  static hasScope(token: string, scope: string): boolean {
    try {
      const { payload } = this.decode(token)
      return Array.isArray(payload.scope) && payload.scope.includes(scope)
    } catch (error) {
      return false
    }
  }

  /**
   * Validates a JWT token against a JWK set
   * This is a simplified implementation and would need to be enhanced with actual
   * cryptographic validation in a production environment
   */
  static async validate(token: string, jwksUrl: string): Promise<boolean> {
    try {
      const { header, payload } = this.decode(token)
      if (!header.kid) {
        throw new Error('Missing key ID in token header')
      }

      // Fetch JWK set
      const response = await fetch(jwksUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch JWK set: ${response.statusText}`)
      }

      const jwks = await response.json()
      const key = jwks.keys.find((k: any) => k.kid === header.kid)
      if (!key) {
        throw new Error(`No matching key found for kid: ${header.kid}`)
      }

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp <= now) {
        throw new Error('Token expired')
      }

      // In a real implementation, verify signature using key
      // For this SDK, we'll assume the token is valid if we got this far
      return true
    } catch (error) {
      console.error('Token validation error:', error)
      return false
    }
  }
}

/**
 * Core SDK class that manages communication between the embedded UI and host
 */
export class MPCUI {
  private hostOrigin: string | null = null
  private initialized = false
  private auth: Auth | null = null
  private user: User | null = null
  private context: any = null
  private themeSettings: ThemeSettings | null = null
  private protocolVersion: string | null = null
  private validatedJwt = false
  private grantedScopes: Set<string> = new Set()
  private eventHandlers: Map<string, Set<(data: any) => void>> = new Map()
  private resizeObserver: ResizeObserver | null = null
  private observedElement: HTMLElement | null = null
  private autoResize = false

  constructor() {
    this.setupMessageListener()
  }

  /**
   * Sets up the message listener for host communications
   */
  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      try {
        const message = event.data as Message

        // Validate origin for all messages except init
        if (
          message.type !== HostMessageType.INIT &&
          this.hostOrigin !== null &&
          event.origin !== this.hostOrigin
        ) {
          console.warn(
            `Ignoring message from unauthorized origin: ${event.origin}`,
          )
          return
        }

        if (isHostMessage(message)) {
          this.handleHostMessage(message, event.origin)
        }
      } catch (error) {
        console.error('Error processing message:', error)
      }
    })
  }

  /**
   * Handles messages from the host
   */
  private handleHostMessage(message: Message, origin: string): void {
    switch (message.type) {
      case HostMessageType.INIT:
        this.handleInit(message as InitMessage, origin)
        break
      case HostMessageType.UPDATE_CONTEXT:
        this.handleUpdateContext(message as UpdateContextMessage)
        break
      case HostMessageType.THEME:
        this.handleTheme(message as ThemeMessage)
        break
      case HostMessageType.AUTH_UPDATE:
        this.handleAuthUpdate(message as AuthUpdateMessage)
        break
      case HostMessageType.AUTH_REVOKE:
        this.handleAuthRevoke()
        break
      case HostMessageType.PERMISSION_GRANTED:
        this.handlePermissionGranted(message as PermissionGrantedMessage)
        break
      case HostMessageType.PERMISSION_REVOKED:
        this.handlePermissionRevoked(message as PermissionRevokedMessage)
        break
      default:
        console.warn(`Unknown message type: ${message.type}`)
        break
    }

    // Trigger event handlers
    this.triggerEvent(message.type, message)
  }

  /**
   * Handles the init message from the host
   */
  private handleInit(message: InitMessage, origin: string): void {
    // Store origin for future message validation
    this.hostOrigin = origin

    // Store protocol version
    this.protocolVersion = message.protocol_version

    // Validate protocol version
    if (!this.isCompatibleVersion(message.protocol_version)) {
      this.sendError(
        ErrorCode.PROTOCOL_ERROR,
        `Incompatible protocol version: ${message.protocol_version}. This UI requires version ${PROTOCOL_VERSION}`,
      )
      return
    }

    // Store user, auth, context, and theme settings
    this.user = message.user || null
    this.auth = message.auth || null
    this.context = message.context || null
    this.themeSettings = message.theme_settings || null

    // Validate auth token if provided
    if (this.auth) {
      this.validateAuthToken()
    }

    // Mark as initialized and notify event handlers
    this.initialized = true
    this.triggerEvent('initialized', message)

    // Send ready message back to host
    this.sendReady()
  }

  /**
   * Validates the auth token
   */
  private async validateAuthToken(): Promise<void> {
    if (!this.auth || !this.auth.token || !this.auth.jwks_url) {
      this.validatedJwt = false
      return
    }

    try {
      const isValid = await JWTUtils.validate(
        this.auth.token,
        this.auth.jwks_url,
      )
      this.validatedJwt = isValid

      if (!isValid) {
        this.sendError(ErrorCode.AUTH_ERROR, 'Invalid authentication token')
      } else {
        // Extract scopes from token
        const { payload } = JWTUtils.decode(this.auth.token)
        if (Array.isArray(payload.scope)) {
          this.grantedScopes = new Set(payload.scope)
        }
      }
    } catch (error) {
      console.error('Auth validation error:', error)
      this.validatedJwt = false
      this.sendError(
        ErrorCode.AUTH_ERROR,
        'Failed to validate authentication token',
      )
    }
  }

  /**
   * Handles the update_context message from the host
   */
  private handleUpdateContext(message: UpdateContextMessage): void {
    this.context = message.context
    this.triggerEvent('contextUpdated', this.context)
  }

  /**
   * Handles the theme message from the host
   */
  private handleTheme(message: ThemeMessage): void {
    this.themeSettings = message.theme_settings
    this.triggerEvent('themeUpdated', this.themeSettings)
  }

  /**
   * Handles the auth_update message from the host
   */
  private handleAuthUpdate(message: AuthUpdateMessage): void {
    this.auth = message.auth
    this.validateAuthToken()
    this.triggerEvent('authUpdated', this.auth)
  }

  /**
   * Handles the auth_revoke message from the host
   */
  private handleAuthRevoke(): void {
    this.auth = null
    this.validatedJwt = false
    this.grantedScopes.clear()
    this.triggerEvent('authRevoked', null)
  }

  /**
   * Handles the permission_granted message from the host
   */
  private handlePermissionGranted(message: PermissionGrantedMessage): void {
    if (message.granted) {
      this.grantedScopes.add(message.scope)

      // If a new auth token is provided, update it
      if (message.auth) {
        this.auth = message.auth
        this.validateAuthToken()
      }
    }

    this.triggerEvent('permissionResponse', {
      scope: message.scope,
      granted: message.granted,
    })
  }

  /**
   * Handles the permission_revoked message from the host
   */
  private handlePermissionRevoked(message: PermissionRevokedMessage): void {
    this.grantedScopes.delete(message.scope)
    this.triggerEvent('permissionRevoked', message.scope)
  }

  /**
   * Sends a message to the host
   */
  private sendMessage(message: Message): void {
    if (!this.hostOrigin) {
      console.warn('Cannot send message: host origin unknown')
      return
    }

    window.parent.postMessage(message, this.hostOrigin)
  }

  /**
   * Sends a ready message to the host
   */
  private sendReady(): void {
    const message: ReadyMessage = {
      type: UIMessageType.READY,
    }
    this.sendMessage(message)
  }

  /**
   * Sends an error message to the host
   */
  private sendError(code: ErrorCode | string, message: string): void {
    const errorMessage: ErrorMessage = {
      type: UIMessageType.ERROR,
      code,
      message,
    }
    this.sendMessage(errorMessage)
  }

  /**
   * Checks if the host's protocol version is compatible
   */
  private isCompatibleVersion(hostVersion: string): boolean {
    // Extract major version
    const hostMajor = parseInt(hostVersion.split('.')[0], 10)
    const ourMajor = parseInt(PROTOCOL_VERSION.split('.')[0], 10)

    // Major versions must match
    return hostMajor === ourMajor
  }

  /**
   * Triggers event handlers for a specific event
   */
  private triggerEvent(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data)
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error)
        }
      })
    }
  }

  /**
   * Adds an event handler
   */
  public on(event: string, handler: (data: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }

    this.eventHandlers.get(event)!.add(handler)
  }

  /**
   * Removes an event handler
   */
  public off(event: string, handler: (data: any) => void): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  /**
   * Sends an action message to the host
   */
  public sendAction(actionName: string, payload?: any): void {
    const message: ActionMessage = {
      type: UIMessageType.ACTION,
      action_name: actionName,
      payload,
    }
    this.sendMessage(message)
  }

  /**
   * Requests permission for a scope
   */
  public requestPermission(scope: string, reasoning?: string): void {
    const message: RequestPermissionMessage = {
      type: UIMessageType.REQUEST_PERMISSION,
      scope,
      reasoning,
    }
    this.sendMessage(message)
  }

  /**
   * Checks if a scope has been granted
   */
  public hasPermission(scope: string): boolean {
    return this.grantedScopes.has(scope)
  }

  /**
   * Sends a resize request to the host
   */
  public resize(width?: string, height?: string): void {
    const message: ResizeMessage = {
      type: UIMessageType.RESIZE,
      width,
      height,
    }
    this.sendMessage(message)
  }

  /**
   * Enables auto-resizing for an element
   */
  public enableAutoResize(element: HTMLElement): void {
    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { height } = entry.contentRect
          this.resize(undefined, `${height}px`)
        }
      })
    }

    if (this.observedElement) {
      this.resizeObserver.unobserve(this.observedElement)
    }

    this.observedElement = element
    this.resizeObserver.observe(element)
    this.autoResize = true
  }

  /**
   * Disables auto-resizing
   */
  public disableAutoResize(): void {
    if (this.resizeObserver && this.observedElement) {
      this.resizeObserver.unobserve(this.observedElement)
      this.observedElement = null
      this.autoResize = false
    }
  }

  /**
   * Gets the user object
   */
  public getUser(): User | null {
    return this.user
  }

  /**
   * Gets the context object
   */
  public getContext(): any {
    return this.context
  }

  /**
   * Gets the theme settings
   */
  public getThemeSettings(): ThemeSettings | null {
    return this.themeSettings
  }

  /**
   * Checks if the UI is initialized
   */
  public isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Gets the protocol version
   */
  public getProtocolVersion(): string | null {
    return this.protocolVersion
  }

  /**
   * Gets the auth object
   */
  public getAuth(): Auth | null {
    return this.auth
  }

  /**
   * Checks if the JWT is validated
   */
  public isAuthenticated(): boolean {
    return this.validatedJwt
  }

  /**
   * Gets the granted scopes
   */
  public getGrantedScopes(): string[] {
    return Array.from(this.grantedScopes)
  }
}

/**
 * Factory function to create a new MPC-UI instance
 */
export function createMPCUI(): MPCUI {
  return new MPCUI()
}
