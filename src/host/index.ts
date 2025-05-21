/**
 * MCP-UI Embedding Protocol SDK - Host Implementation
 * Version: 1.0.0
 */

import {
	type Message,
	type InitMessage,
	type UpdateContextMessage,
	type ThemeMessage,
	type AuthUpdateMessage,
	type AuthRevokeMessage,
	type PermissionGrantedMessage,
	type PermissionRevokedMessage,
	type ActionMessage,
	type ErrorMessage,
	type ResizeMessage,
	type RequestPermissionMessage,
	isUIMessage,
	type User,
	type Auth,
	type ThemeSettings,
	type UIRegistrationPayload,
} from "../types";

import { PROTOCOL_VERSION, HostMessageType, UIMessageType } from "../types";

import { KeyManager, type JWKS, type JWTPayload } from "./jwt";
import * as JWTFunctions from "./jwt";

/**
 * Option flags for embedded UI configuration
 */
export interface UIEmbedOptions {
	sandboxAllowSameOrigin?: boolean;
	sandboxAllowForms?: boolean;
	sandboxAllowScripts?: boolean;
	sandboxAllowPopups?: boolean;
	width?: string;
	height?: string;
	autoResize?: boolean;
	className?: string;
}

/**
 * Permission request handler function signature
 */
export type PermissionRequestHandler = (
	scope: string,
	reasoning?: string,
) => Promise<boolean>;

/**
 * Action handler function signature
 */
export type ActionHandler = (
	actionName: string,
	payload?: Record<string, unknown>,
	ui?: EmbeddedUI,
) => void;

/**
 * Error handler function signature
 */
export type ErrorHandler = (
	code: string,
	message: string,
	ui?: EmbeddedUI,
) => void;

/**
 * Resize handler function signature
 */
export type ResizeHandler = (
	width?: string,
	height?: string,
	ui?: EmbeddedUI,
) => void;

/**
 * Class representing an embedded UI instance
 */
export class EmbeddedUI {
	private iframe: HTMLIFrameElement;
	private container: HTMLElement;
	private options: UIEmbedOptions;
	private registration: UIRegistrationPayload;
	private ready = false;
	private grantedScopes: Set<string> = new Set();
	private url: string;
	private eventHandlers: Map<string, Set<(data: unknown) => void>> = new Map();
	private auth: Auth | null = null;
	public user: User | null = null;
	public context: Record<string, unknown> | null = null;
	public themeSettings: ThemeSettings | null = null;
	private permissionRequestHandler: PermissionRequestHandler | null = null;
	private actionHandler: ActionHandler | null = null;
	private errorHandler: ErrorHandler | null = null;
	private resizeHandler: ResizeHandler | null = null;

	/**
	 * Creates a new embedded UI instance
	 */
	constructor(
		container: HTMLElement,
		registration: UIRegistrationPayload,
		url: string,
		options: UIEmbedOptions = {},
	) {
		this.container = container;
		this.registration = registration;
		this.url = url;
		this.options = this.normalizeOptions(options);

		// Create iframe element
		this.iframe = document.createElement("iframe");
		this.setupIframe();

		// Add iframe to container
		this.container.appendChild(this.iframe);

		// Setup message listener
		this.setupMessageListener();
	}

	/**
	 * Normalizes the options with defaults
	 */
	private normalizeOptions(options: UIEmbedOptions): UIEmbedOptions {
		return {
			sandboxAllowSameOrigin: true,
			sandboxAllowForms: true,
			sandboxAllowScripts: true,
			sandboxAllowPopups: false,
			width: "100%",
			height: "auto",
			autoResize: true,
			className: "",
			...options,
		};
	}

	/**
	 * Sets up the iframe element
	 */
	private setupIframe(): void {
		// Set sandbox attributes based on options
		const sandboxValues: string[] = [];
		if (this.options.sandboxAllowSameOrigin)
			sandboxValues.push("allow-same-origin");
		if (this.options.sandboxAllowForms) sandboxValues.push("allow-forms");
		if (this.options.sandboxAllowScripts) sandboxValues.push("allow-scripts");
		if (this.options.sandboxAllowPopups) sandboxValues.push("allow-popups");

		// Apply sandbox attribute if any values present
		if (sandboxValues.length > 0) {
			this.iframe.sandbox.add(...sandboxValues);
		}

		// Set other iframe attributes
		this.iframe.src = this.url;
		this.iframe.width = this.options.width || "100%";
		this.iframe.height = this.options.height || "auto";

		// Apply custom class if provided
		if (this.options.className) {
			this.iframe.className = this.options.className;
		}
	}

	/**
	 * Sets up the message listener for iframe communications
	 */
	private setupMessageListener(): void {
		window.addEventListener("message", (event) => {
			// Validate the origin matches our iframe's src origin
			const iframeOrigin = new URL(this.iframe.src).origin;
			if (event.origin !== iframeOrigin) {
				return;
			}

			// Handle message if it's from our iframe and is a valid UI message
			if (
				event.source === this.iframe.contentWindow &&
				isUIMessage(event.data)
			) {
				this.handleUIMessage(event.data);
			}
		});
	}

	/**
	 * Handles messages from the UI
	 */
	private handleUIMessage(message: Message): void {
		switch (message.type) {
			case UIMessageType.READY:
				this.handleReady();
				break;
			case UIMessageType.ACTION: {
				const actionMsg = message as ActionMessage;
				this.handleAction(actionMsg.action_name, actionMsg.payload);
				break;
			}
			case UIMessageType.ERROR: {
				const errorMsg = message as ErrorMessage;
				this.handleError(errorMsg.code, errorMsg.message);
				break;
			}
			case UIMessageType.RESIZE: {
				const resizeMsg = message as ResizeMessage;
				this.handleResize(resizeMsg.width, resizeMsg.height);
				break;
			}
			case UIMessageType.REQUEST_PERMISSION: {
				const permissionMsg = message as RequestPermissionMessage;
				this.handleRequestPermission(
					permissionMsg.scope,
					permissionMsg.reasoning,
				);
				break;
			}
			default:
				console.warn(`Unknown message type: ${message.type}`);
				break;
		}

		// Trigger event handlers
		this.triggerEvent(message.type, message);
	}

	/**
	 * Handles the ready message from the UI
	 */
	private handleReady(): void {
		this.ready = true;
		this.triggerEvent("ready", null);
	}

	/**
	 * Handles the action message from the UI
	 */
	private handleAction(
		actionName: string,
		payload?: Record<string, unknown>,
	): void {
		if (this.actionHandler) {
			this.actionHandler(actionName, payload, this);
		}
		this.triggerEvent("action", { actionName, payload });
	}

	/**
	 * Handles the error message from the UI
	 */
	private handleError(code: string, message: string): void {
		if (this.errorHandler) {
			this.errorHandler(code, message, this);
		}
		this.triggerEvent("error", { code, message });
	}

	/**
	 * Handles the resize message from the UI
	 */
	private handleResize(width?: string, height?: string): void {
		if (this.options.autoResize) {
			if (height) {
				this.iframe.height = height;
			}
			if (width) {
				this.iframe.width = width;
			}
		}

		if (this.resizeHandler) {
			this.resizeHandler(width, height, this);
		}

		this.triggerEvent("resize", { width, height });
	}

	/**
	 * Handles permission requests from the UI
	 */
	private async handleRequestPermission(
		scope: string,
		reasoning?: string,
	): Promise<void> {
		let granted = false;

		// Check if the scope is in the registration's optional scopes
		const isOptionalScope =
			this.registration.permissions.optional_scopes.includes(scope);
		if (!isOptionalScope) {
			console.warn(
				`UI requested scope '${scope}' which is not declared in its optional_scopes`,
			);
			this.sendPermissionGranted(scope, false);
			return;
		}

		// Check if permission was already granted
		if (this.grantedScopes.has(scope)) {
			this.sendPermissionGranted(scope, true);
			return;
		}

		// Use the permission request handler if available
		if (this.permissionRequestHandler) {
			try {
				granted = await this.permissionRequestHandler(scope, reasoning);
			} catch (error) {
				console.error("Error in permission request handler:", error);
				granted = false;
			}
		} else {
			// Default implementation: display a simple confirm dialog
			const uiName = this.registration.ui_name;
			const scopeDescription = reasoning || `access to ${scope}`;
			granted = window.confirm(
				`"${uiName}" is requesting ${scopeDescription}. Do you want to allow this?`,
			);
		}

		// Update granted scopes and send response
		if (granted) {
			this.grantedScopes.add(scope);
		}

		this.sendPermissionGranted(scope, granted);
	}

	/**
	 * Sends a message to the UI
	 */
	private sendMessage(message: Message): void {
		if (!this.iframe.contentWindow) {
			console.warn("Cannot send message: iframe content window not available");
			return;
		}

		const iframeOrigin = new URL(this.iframe.src).origin;
		this.iframe.contentWindow.postMessage(message, iframeOrigin);
	}

	/**
	 * Initializes the UI with the provided configuration
	 */
	public init({
		user = null,
		auth = null,
		context = null,
		themeSettings = null,
	}: {
		user?: User | null;
		auth?: Auth | null;
		context?: Record<string, unknown> | null;
		themeSettings?: ThemeSettings | null;
	} = {}): void {
		this.user = user;
		this.auth = auth;
		this.context = context;
		this.themeSettings = themeSettings;

		// If auth is provided, add the scopes from the token to granted scopes
		if (auth?.token) {
			try {
				const [, payload] = auth.token.split(".");
				const decodedPayload = JSON.parse(atob(payload));
				if (Array.isArray(decodedPayload.scope)) {
					for (const scope of decodedPayload.scope) {
						this.grantedScopes.add(scope);
					}
				}
			} catch (error) {
				console.error("Error extracting scopes from token:", error);
			}
		}

		// Send init message
		const message: InitMessage = {
			type: HostMessageType.INIT,
			protocol_version: PROTOCOL_VERSION,
			user,
			auth,
			context: context as Record<string, unknown> | undefined,
			theme_settings: themeSettings,
		};

		this.sendMessage(message);
	}

	/**
	 * Sends an update_context message to the UI
	 */
	public updateContext(context: Record<string, unknown> | null): void {
		this.context = context;

		const message: UpdateContextMessage = {
			type: HostMessageType.UPDATE_CONTEXT,
			context,
		};

		this.sendMessage(message);
	}

	/**
	 * Sends a theme message to the UI
	 */
	public updateTheme(themeSettings: ThemeSettings): void {
		this.themeSettings = themeSettings;

		const message: ThemeMessage = {
			type: HostMessageType.THEME,
			theme_settings: themeSettings,
		};

		this.sendMessage(message);
	}

	/**
	 * Sends an auth_update message to the UI
	 */
	public updateAuth(auth: Auth): void {
		this.auth = auth;

		const message: AuthUpdateMessage = {
			type: HostMessageType.AUTH_UPDATE,
			auth,
		};

		this.sendMessage(message);
	}

	/**
	 * Sends an auth_revoke message to the UI
	 */
	public revokeAuth(): void {
		this.auth = null;
		this.grantedScopes.clear();

		const message: AuthRevokeMessage = {
			type: HostMessageType.AUTH_REVOKE,
		};

		this.sendMessage(message);
	}

	/**
	 * Sends a permission_granted message to the UI
	 */
	public sendPermissionGranted(scope: string, granted: boolean): void {
		let updatedAuth: Auth | undefined = undefined;

		// If permission is granted and we have auth, update the token with the new scope
		if (granted && this.auth) {
			// In a real implementation, you would re-issue the token with the new scope
			// For this example, we're just passing the existing auth object
			updatedAuth = this.auth;
		}

		const message: PermissionGrantedMessage = {
			type: HostMessageType.PERMISSION_GRANTED,
			scope,
			granted,
			auth: updatedAuth,
		};

		this.sendMessage(message);
	}

	/**
	 * Sends a permission_revoked message to the UI
	 */
	public revokePermission(scope: string): void {
		this.grantedScopes.delete(scope);

		const message: PermissionRevokedMessage = {
			type: HostMessageType.PERMISSION_REVOKED,
			scope,
		};

		this.sendMessage(message);
	}

	/**
	 * Updates the iframe source URL
	 */
	public updateUrl(url: string): void {
		this.url = url;
		this.iframe.src = url;
		this.ready = false;
	}

	/**
	 * Removes the iframe from the DOM and cleans up resources
	 */
	public destroy(): void {
		// Remove event listeners
		this.eventHandlers.clear();

		// Remove iframe from container
		if (this.iframe.parentNode) {
			this.iframe.parentNode.removeChild(this.iframe);
		}
	}

	/**
	 * Sets the permission request handler
	 */
	public setPermissionRequestHandler(handler: PermissionRequestHandler): void {
		this.permissionRequestHandler = handler;
	}

	/**
	 * Sets the action handler
	 */
	public setActionHandler(handler: ActionHandler): void {
		this.actionHandler = handler;
	}

	/**
	 * Sets the error handler
	 */
	public setErrorHandler(handler: ErrorHandler): void {
		this.errorHandler = handler;
	}

	/**
	 * Sets the resize handler
	 */
	public setResizeHandler(handler: ResizeHandler): void {
		this.resizeHandler = handler;
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
	 * Gets the UI registration payload
	 */
	public getRegistration(): UIRegistrationPayload {
		return this.registration;
	}

	/**
	 * Gets the granted scopes
	 */
	public getGrantedScopes(): string[] {
		return Array.from(this.grantedScopes);
	}

	/**
	 * Gets the current URL
	 */
	public getUrl(): string {
		return this.url;
	}

	/**
	 * Checks if the UI is ready
	 */
	public isReady(): boolean {
		return this.ready;
	}

	/**
	 * Gets the iframe element
	 */
	public getIframe(): HTMLIFrameElement {
		return this.iframe;
	}
}

/**
 * Main class for managing embedded UI components
 */
export class MCUHost {
	private embeddedUIs: Map<string, EmbeddedUI> = new Map();
	private keyManager: KeyManager;
	private jwksUrl: string;
	private tokenExpiration = 3600; // Default to 1 hour
	private issuer: string;
	private defaultPermissionRequestHandler: PermissionRequestHandler | null =
		null;
	private defaultActionHandler: ActionHandler | null = null;
	private defaultErrorHandler: ErrorHandler | null = null;
	private defaultResizeHandler: ResizeHandler | null = null;

	/**
	 * Creates a new MCUHost instance
	 */
	constructor(options: {
		jwksUrl: string;
		issuer: string;
		keyId?: string;
		tokenExpiration?: number;
	}) {
		this.jwksUrl = options.jwksUrl;
		this.issuer = options.issuer;
		this.keyManager = new KeyManager(options.keyId);

		if (options.tokenExpiration) {
			this.tokenExpiration = options.tokenExpiration;
		}
	}

	/**
	 * Embeds a UI into the specified container
	 */
	public embedUI(
		id: string,
		container: HTMLElement,
		registration: UIRegistrationPayload,
		url: string,
		options: UIEmbedOptions = {},
	): EmbeddedUI {
		// Create the embedded UI instance
		const ui = new EmbeddedUI(container, registration, url, options);

		// Set default handlers if available
		if (this.defaultPermissionRequestHandler) {
			ui.setPermissionRequestHandler(this.defaultPermissionRequestHandler);
		}

		if (this.defaultActionHandler) {
			ui.setActionHandler(this.defaultActionHandler);
		}

		if (this.defaultErrorHandler) {
			ui.setErrorHandler(this.defaultErrorHandler);
		}

		if (this.defaultResizeHandler) {
			ui.setResizeHandler(this.defaultResizeHandler);
		}

		// Store the UI instance
		this.embeddedUIs.set(id, ui);

		return ui;
	}

	/**
	 * Gets an embedded UI by ID
	 */
	public getUI(id: string): EmbeddedUI | undefined {
		return this.embeddedUIs.get(id);
	}

	/**
	 * Removes an embedded UI by ID
	 */
	public removeUI(id: string): boolean {
		const ui = this.embeddedUIs.get(id);
		if (ui) {
			ui.destroy();
			return this.embeddedUIs.delete(id);
		}
		return false;
	}

	/**
	 * Sets the default permission request handler for all UIs
	 */
	public setDefaultPermissionRequestHandler(
		handler: PermissionRequestHandler,
	): void {
		this.defaultPermissionRequestHandler = handler;

		// Apply to existing UIs
		for (const ui of this.embeddedUIs.values()) {
			ui.setPermissionRequestHandler(handler);
		}
	}

	/**
	 * Sets the default action handler for all UIs
	 */
	public setDefaultActionHandler(handler: ActionHandler): void {
		this.defaultActionHandler = handler;

		// Apply to existing UIs
		for (const ui of this.embeddedUIs.values()) {
			ui.setActionHandler(handler);
		}
	}

	/**
	 * Sets the default error handler for all UIs
	 */
	public setDefaultErrorHandler(handler: ErrorHandler): void {
		this.defaultErrorHandler = handler;

		// Apply to existing UIs
		for (const ui of this.embeddedUIs.values()) {
			ui.setErrorHandler(handler);
		}
	}

	/**
	 * Sets the default resize handler for all UIs
	 */
	public setDefaultResizeHandler(handler: ResizeHandler): void {
		this.defaultResizeHandler = handler;

		// Apply to existing UIs
		for (const ui of this.embeddedUIs.values()) {
			ui.setResizeHandler(handler);
		}
	}

	/**
	 * Gets the JWKS URL
	 */
	public getJwksUrl(): string {
		return this.jwksUrl;
	}

	/**
	 * Creates a JWT for authentication
	 */
	public async createToken(
		userId: string,
		audience: string,
		scopes: string[] = [],
	): Promise<string> {
		const now = Math.floor(Date.now() / 1000);
		const payload: JWTPayload = {
			iss: this.issuer,
			sub: userId,
			aud: audience,
			exp: now + this.tokenExpiration,
			scope: scopes,
			nonce: JWTFunctions.generateNonce(),
		};

		const privateKey = await this.keyManager.getPrivateKey();
		const keyId = this.keyManager.getKeyId();

		return JWTFunctions.createToken(payload, privateKey, keyId);
	}

	/**
	 * Creates an Auth object with token and JWKS URL
	 */
	public async createAuth(
		userId: string,
		audience: string,
		scopes: string[] = [],
	): Promise<Auth> {
		const token = await this.createToken(userId, audience, scopes);
		return {
			token,
			jwks_url: this.jwksUrl,
		};
	}

	/**
	 * Gets the JWKS for the current key pair
	 */
	public async getJWKS(): Promise<JWKS> {
		return this.keyManager.getJWKS();
	}

	/**
	 * Serves the JWKS as JSON
	 * This is a helper method for Express/Koa/etc. handlers
	 */
	public async serveJWKS(): Promise<string> {
		const jwks = await this.getJWKS();
		return JSON.stringify(jwks);
	}
}

/**
 * URL parameter utilities for templating
 */

/**
 * Parses a URL template and replaces placeholders with values
 */
export function fillTemplate(
	template: string,
	params: Record<string, string>,
): string {
	return template.replace(/{([^}]+)}/g, (match, key) => {
		const value = params[key];
		if (value === undefined) {
			console.warn(`Missing parameter for template placeholder: ${key}`);
			return match;
		}
		return encodeURIComponent(String(value));
	});
}

/**
 * Factory function to create a new MCUHost instance
 */
export function createMCUHost(options: {
	jwksUrl: string;
	issuer: string;
	keyId?: string;
	tokenExpiration?: number;
}): MCUHost {
	return new MCUHost(options);
}
