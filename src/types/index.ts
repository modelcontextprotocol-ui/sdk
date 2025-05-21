/**
 * MCP-UI Embedding Protocol SDK - Shared Types
 * Version: 1.0.0
 */

/**
 * Protocol version supported by this SDK
 */
export const PROTOCOL_VERSION = "1.0.0";

/**
 * Message types for Host → UI communication
 */
export enum HostMessageType {
	INIT = "init",
	UPDATE_CONTEXT = "update_context",
	THEME = "theme",
	AUTH_UPDATE = "auth_update",
	AUTH_REVOKE = "auth_revoke",
	PERMISSION_GRANTED = "permission_granted",
	PERMISSION_REVOKED = "permission_revoked",
}

/**
 * Message types for UI → Host communication
 */
export enum UIMessageType {
	READY = "ready",
	ACTION = "action",
	ERROR = "error",
	RESIZE = "resize",
	REQUEST_PERMISSION = "request_permission",
}

/**
 * Error codes for UI → Host error messages
 */
export enum ErrorCode {
	PROTOCOL_ERROR = "protocol_error",
	AUTH_ERROR = "auth_error",
	CONTEXT_ERROR = "context_error",
	RENDER_ERROR = "render_error",
	PERMISSION_ERROR = "permission_error",
	UNKNOWN_ERROR = "unknown_error",
}

/**
 * Basic user information
 */
export interface User {
	id: string;
	[key: string]: unknown; // Additional user properties
}

/**
 * Authentication information
 */
export interface Auth {
	token: string;
	jwks_url: string;
	[key: string]: unknown; // Additional auth properties
}

/**
 * Theme settings
 */
export interface ThemeSettings {
	mode?: "light" | "dark";
	primary_color?: string;
	secondary_color?: string;
	font_family?: string;
	border_radius?: string;
	[key: string]: unknown; // Additional theme settings
}

/**
 * Base message structure
 */
export interface Message {
	type: string;
	[key: string]: unknown;
}

/**
 * Init message from Host to UI
 */
export interface InitMessage extends Message {
	type: HostMessageType.INIT;
	protocol_version: string;
	user?: User | null;
	auth?: Auth | null;
	context?: Record<string, unknown>;
	theme_settings?: ThemeSettings | null;
}

/**
 * Update context message from Host to UI
 */
export interface UpdateContextMessage extends Message {
	type: HostMessageType.UPDATE_CONTEXT;
	context: Record<string, unknown> | null;
}

/**
 * Theme message from Host to UI
 */
export interface ThemeMessage extends Message {
	type: HostMessageType.THEME;
	theme_settings: ThemeSettings;
}

/**
 * Auth update message from Host to UI
 */
export interface AuthUpdateMessage extends Message {
	type: HostMessageType.AUTH_UPDATE;
	auth: Auth;
}

/**
 * Auth revoke message from Host to UI
 */
export interface AuthRevokeMessage extends Message {
	type: HostMessageType.AUTH_REVOKE;
}

/**
 * Permission granted message from Host to UI
 */
export interface PermissionGrantedMessage extends Message {
	type: HostMessageType.PERMISSION_GRANTED;
	scope: string;
	granted: boolean;
	auth?: Auth;
}

/**
 * Permission revoked message from Host to UI
 */
export interface PermissionRevokedMessage extends Message {
	type: HostMessageType.PERMISSION_REVOKED;
	scope: string;
}

/**
 * Ready message from UI to Host
 */
export interface ReadyMessage extends Message {
	type: UIMessageType.READY;
}

/**
 * Action message from UI to Host
 */
export interface ActionMessage extends Message {
	type: UIMessageType.ACTION;
	action_name: string;
	payload?: Record<string, unknown>;
}

/**
 * Error message from UI to Host
 */
export interface ErrorMessage extends Message {
	type: UIMessageType.ERROR;
	code: ErrorCode | string;
	message: string;
}

/**
 * Resize message from UI to Host
 */
export interface ResizeMessage extends Message {
	type: UIMessageType.RESIZE;
	width?: string;
	height?: string;
}

/**
 * Request permission message from UI to Host
 */
export interface RequestPermissionMessage extends Message {
	type: UIMessageType.REQUEST_PERMISSION;
	scope: string;
	reasoning?: string;
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
	].includes(message.type as HostMessageType);
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
	].includes(message.type as UIMessageType);
}

/**
 * Type guard for checking if a message is an init message
 */
export function isInitMessage(message: Message): message is InitMessage {
	return message.type === HostMessageType.INIT;
}

/**
 * Interface for UI Registration Payload as defined in the spec
 */
export interface UIRegistrationPayload {
	ui_name: string;
	ui_url_template: string;
	description: string;
	capabilities: string[];
	tool_association?: string;
	data_type_handled?: string;
	permissions: {
		required_scopes: string[];
		optional_scopes: string[];
	};
	protocol_support: {
		min_version: string;
		target_version: string;
	};
}
