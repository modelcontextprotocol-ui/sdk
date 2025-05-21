/**
 * MCP-UI Embedding Protocol SDK
 * Version: 1.0.0
 *
 * A TypeScript SDK for implementing embeddable UI elements that conform to the
 * MCP-UI Embedding Protocol Specification (Version 1.0.0).
 */

import * as JWTUtils from "./jwt";
import type {
	Message,
	InitMessage,
	UpdateContextMessage,
	ThemeMessage,
	AuthUpdateMessage,
	PermissionGrantedMessage,
	PermissionRevokedMessage,
	User,
	Auth,
	ThemeSettings,
	ReadyMessage,
	ErrorMessage,
	ActionMessage,
	RequestPermissionMessage,
	ResizeMessage,
} from "../types";

import {
	PROTOCOL_VERSION,
	HostMessageType,
	UIMessageType,
	isHostMessage,
	ErrorCode,
} from "../types";

/**
 * Core SDK class that manages communication between the embedded UI and host
 */
export class MCPUI {
	private hostOrigin: string | null = null;
	private initialized = false;
	private auth: Auth | null = null;
	private user: User | null = null;
	private context: Record<string, unknown> | null = null;
	private themeSettings: ThemeSettings | null = null;
	private protocolVersion: string | null = null;
	private validatedJwt = false;
	private grantedScopes: Set<string> = new Set();
	private eventHandlers: Map<string, Set<(data: unknown) => void>> = new Map();
	private resizeObserver: ResizeObserver | null = null;
	private observedElement: HTMLElement | null = null;
	public autoResize = false;

	constructor() {
		this.setupMessageListener();
	}

	/**
	 * Sets up the message listener for host communications
	 */
	private setupMessageListener(): void {
		window.addEventListener("message", (event) => {
			try {
				const message = event.data as Message;

				// Validate origin for all messages except init
				if (
					message.type !== HostMessageType.INIT &&
					this.hostOrigin !== null &&
					event.origin !== this.hostOrigin
				) {
					console.warn(
						`Ignoring message from unauthorized origin: ${event.origin}`,
					);
					return;
				}

				if (isHostMessage(message)) {
					this.handleHostMessage(message, event.origin);
				}
			} catch (error) {
				console.error("Error processing message:", error);
			}
		});
	}

	/**
	 * Handles messages from the host
	 */
	private handleHostMessage(message: Message, origin: string): void {
		switch (message.type) {
			case HostMessageType.INIT:
				this.handleInit(message as InitMessage, origin);
				break;
			case HostMessageType.UPDATE_CONTEXT:
				this.handleUpdateContext(message as UpdateContextMessage);
				break;
			case HostMessageType.THEME:
				this.handleTheme(message as ThemeMessage);
				break;
			case HostMessageType.AUTH_UPDATE:
				this.handleAuthUpdate(message as AuthUpdateMessage);
				break;
			case HostMessageType.AUTH_REVOKE:
				this.handleAuthRevoke();
				break;
			case HostMessageType.PERMISSION_GRANTED:
				this.handlePermissionGranted(message as PermissionGrantedMessage);
				break;
			case HostMessageType.PERMISSION_REVOKED:
				this.handlePermissionRevoked(message as PermissionRevokedMessage);
				break;
			default:
				console.warn(`Unknown message type: ${message.type}`);
				break;
		}

		// Trigger event handlers
		this.triggerEvent(message.type, message);
	}

	/**
	 * Handles the init message from the host
	 */
	private handleInit(message: InitMessage, origin: string): void {
		// Store origin for future message validation
		this.hostOrigin = origin;

		// Store protocol version
		this.protocolVersion = message.protocol_version;

		// Validate protocol version
		if (!this.isCompatibleVersion(message.protocol_version)) {
			this.sendError(
				ErrorCode.PROTOCOL_ERROR,
				`Incompatible protocol version: ${message.protocol_version}. This UI requires version ${PROTOCOL_VERSION}`,
			);
			return;
		}

		// Store user, auth, context, and theme settings
		this.user = message.user || null;
		this.auth = message.auth || null;
		this.context = message.context || null;
		this.themeSettings = message.theme_settings || null;

		// Validate auth token if provided
		if (this.auth) {
			this.validateAuthToken();
		}

		// Mark as initialized and notify event handlers
		this.initialized = true;
		this.triggerEvent("initialized", message);

		// Send ready message back to host
		this.sendReady();
	}

	/**
	 * Validates the auth token
	 */
	private async validateAuthToken(): Promise<void> {
		if (!this.auth || !this.auth.token || !this.auth.jwks_url) {
			this.validatedJwt = false;
			return;
		}

		try {
			const isValid = await JWTUtils.validate(
				this.auth.token,
				this.auth.jwks_url,
			);
			this.validatedJwt = isValid;

			if (!isValid) {
				this.sendError(ErrorCode.AUTH_ERROR, "Invalid authentication token");
			} else {
				// Extract scopes from token
				const { payload } = JWTUtils.decode(this.auth.token);
				if (Array.isArray(payload.scope)) {
					this.grantedScopes = new Set(payload.scope);
				}
			}
		} catch (error) {
			console.error("Auth validation error:", error);
			this.validatedJwt = false;
			this.sendError(
				ErrorCode.AUTH_ERROR,
				"Failed to validate authentication token",
			);
		}
	}

	/**
	 * Handles the update_context message from the host
	 */
	private handleUpdateContext(message: UpdateContextMessage): void {
		this.context = message.context;
		this.triggerEvent("contextUpdated", this.context);
	}

	/**
	 * Handles the theme message from the host
	 */
	private handleTheme(message: ThemeMessage): void {
		this.themeSettings = message.theme_settings;
		this.triggerEvent("themeUpdated", this.themeSettings);
	}

	/**
	 * Handles the auth_update message from the host
	 */
	private handleAuthUpdate(message: AuthUpdateMessage): void {
		this.auth = message.auth;
		this.validateAuthToken();
		this.triggerEvent("authUpdated", this.auth);
	}

	/**
	 * Handles the auth_revoke message from the host
	 */
	private handleAuthRevoke(): void {
		this.auth = null;
		this.validatedJwt = false;
		this.grantedScopes.clear();
		this.triggerEvent("authRevoked", null);
	}

	/**
	 * Handles the permission_granted message from the host
	 */
	private handlePermissionGranted(message: PermissionGrantedMessage): void {
		if (message.granted) {
			this.grantedScopes.add(message.scope);

			// If a new auth token is provided, update it
			if (message.auth) {
				this.auth = message.auth;
				this.validateAuthToken();
			}
		}

		this.triggerEvent("permissionResponse", {
			scope: message.scope,
			granted: message.granted,
		});
	}

	/**
	 * Handles the permission_revoked message from the host
	 */
	private handlePermissionRevoked(message: PermissionRevokedMessage): void {
		this.grantedScopes.delete(message.scope);
		this.triggerEvent("permissionRevoked", message.scope);
	}

	/**
	 * Sends a message to the host
	 */
	private sendMessage(message: Message): void {
		if (!this.hostOrigin) {
			console.warn("Cannot send message: host origin unknown");
			return;
		}

		window.parent.postMessage(message, this.hostOrigin);
	}

	/**
	 * Sends a ready message to the host
	 */
	private sendReady(): void {
		const message: ReadyMessage = {
			type: UIMessageType.READY,
		};
		this.sendMessage(message);
	}

	/**
	 * Sends an error message to the host
	 */
	private sendError(code: ErrorCode | string, message: string): void {
		const errorMessage: ErrorMessage = {
			type: UIMessageType.ERROR,
			code,
			message,
		};
		this.sendMessage(errorMessage);
	}

	/**
	 * Checks if the host's protocol version is compatible
	 */
	private isCompatibleVersion(hostVersion: string): boolean {
		// Extract major version
		const hostMajor = Number.parseInt(hostVersion.split(".")[0], 10);
		const ourMajor = Number.parseInt(PROTOCOL_VERSION.split(".")[0], 10);

		// Major versions must match
		return hostMajor === ourMajor;
	}

	/**
	 * Triggers event handlers for a specific event
	 */
	private triggerEvent(event: string, data: unknown): void {
		const handlers = this.eventHandlers.get(event);
		if (handlers) {
			for (const handler of handlers) {
				try {
					handler(data);
				} catch (error) {
					console.error(`Error in event handler for ${event}:`, error);
				}
			}
		}
	}

	/**
	 * Adds an event handler
	 */
	public on(event: string, handler: (data: unknown) => void): void {
		if (!this.eventHandlers.has(event)) {
			this.eventHandlers.set(event, new Set());
		}

		this.eventHandlers.get(event)?.add(handler);
	}

	/**
	 * Removes an event handler
	 */
	public off(event: string, handler: (data: unknown) => void): void {
		const handlers = this.eventHandlers.get(event);
		if (handlers) {
			handlers.delete(handler);
		}
	}

	/**
	 * Sends an action message to the host
	 */
	public sendAction(
		actionName: string,
		payload?: Record<string, unknown>,
	): void {
		const message: ActionMessage = {
			type: UIMessageType.ACTION,
			action_name: actionName,
			payload,
		};
		this.sendMessage(message);
	}

	/**
	 * Requests permission for a scope
	 */
	public requestPermission(scope: string, reasoning?: string): void {
		const message: RequestPermissionMessage = {
			type: UIMessageType.REQUEST_PERMISSION,
			scope,
			reasoning,
		};
		this.sendMessage(message);
	}

	/**
	 * Checks if a scope has been granted
	 */
	public hasPermission(scope: string): boolean {
		return this.grantedScopes.has(scope);
	}

	/**
	 * Sends a resize request to the host
	 */
	public resize(width?: string, height?: string): void {
		const message: ResizeMessage = {
			type: UIMessageType.RESIZE,
			width,
			height,
		};
		this.sendMessage(message);
	}

	/**
	 * Enables auto-resizing for an element
	 */
	public enableAutoResize(element: HTMLElement): void {
		if (!this.resizeObserver) {
			this.resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					const { height } = entry.contentRect;
					this.resize(undefined, `${height}px`);
				}
			});
		}

		if (this.observedElement) {
			this.resizeObserver.unobserve(this.observedElement);
		}

		this.observedElement = element;
		this.resizeObserver.observe(element);
		this.autoResize = true;
	}

	/**
	 * Disables auto-resizing
	 */
	public disableAutoResize(): void {
		if (this.resizeObserver && this.observedElement) {
			this.resizeObserver.unobserve(this.observedElement);
			this.observedElement = null;
			this.autoResize = false;
		}
	}

	/**
	 * Gets the user object
	 */
	public getUser(): User | null {
		return this.user;
	}

	/**
	 * Gets the context object
	 */
	public getContext(): Record<string, unknown> | null {
		return this.context;
	}

	/**
	 * Gets the theme settings
	 */
	public getThemeSettings(): ThemeSettings | null {
		return this.themeSettings;
	}

	/**
	 * Checks if the UI is initialized
	 */
	public isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Gets the protocol version
	 */
	public getProtocolVersion(): string | null {
		return this.protocolVersion;
	}

	/**
	 * Gets the auth object
	 */
	public getAuth(): Auth | null {
		return this.auth;
	}

	/**
	 * Checks if the JWT is validated
	 */
	public isAuthenticated(): boolean {
		return this.validatedJwt;
	}

	/**
	 * Gets the granted scopes
	 */
	public getGrantedScopes(): string[] {
		return Array.from(this.grantedScopes);
	}
}

/**
 * Factory function to create a new MCP-UI instance
 */
export function createMCPUI(): MCPUI {
	return new MCPUI();
}
