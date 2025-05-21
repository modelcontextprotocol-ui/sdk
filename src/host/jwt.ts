/**
 * MCP-UI Embedding Protocol SDK - Host JWT Utilities
 * Version: 1.0.0
 */

import type { Auth } from "../types";

/**
 * Interface for JWT header
 */
export interface JWTHeader {
	alg: string;
	typ: string;
	kid: string;
}

/**
 * Interface for JWT payload
 */
export interface JWTPayload {
	iss: string;
	sub: string;
	aud: string;
	exp: number;
	scope: string[];
	nonce: string;
	[key: string]: unknown;
}

/**
 * Interface for JWK (JSON Web Key)
 */
export interface JWK {
	kty: string;
	kid: string;
	use: string;
	alg: string;
	n: string;
	e: string;
	[key: string]: unknown;
}

/**
 * Interface for JWKS (JSON Web Key Set)
 */
export interface JWKS {
	keys: JWK[];
}

/**
 * JWT utilities for the host side
 */
const encoder = new TextEncoder();

/**
 * Creates a JWT with the given payload
 * Note: In a production environment, this should use proper cryptographic signing
 */
export async function createToken(
	payload: JWTPayload,
	privateKey: CryptoKey,
	keyId: string,
): Promise<string> {
	// Create header
	const header: JWTHeader = {
		alg: "RS256",
		typ: "JWT",
		kid: keyId,
	};

	// Base64 encode header and payload
	const headerB64 = btoa(JSON.stringify(header))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");

	const payloadB64 = btoa(JSON.stringify(payload))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");

	// Create signature base
	const signatureBase = `${headerB64}.${payloadB64}`;

	// Sign the token
	const signatureBuffer = await crypto.subtle.sign(
		{ name: "RSASSA-PKCS1-v1_5" },
		privateKey,
		encoder.encode(signatureBase),
	);

	// Convert signature to base64
	const signature = btoa(
		String.fromCharCode(...new Uint8Array(signatureBuffer)),
	)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");

	// Return complete JWT
	return `${signatureBase}.${signature}`;
}

/**
 * Generates a random nonce for use in JWTs
 */
export function generateNonce(): string {
	const array = new Uint8Array(16);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

/**
 * Creates a complete Auth object with token and jwks_url
 */
export async function createAuthObject(
	payload: JWTPayload,
	privateKey: CryptoKey,
	keyId: string,
	jwksUrl: string,
): Promise<Auth> {
	const token = await createToken(payload, privateKey, keyId);
	return {
		token,
		jwks_url: jwksUrl,
	};
}

/**
 * Key management utilities
 */
export class KeyManager {
	private keyPair: CryptoKeyPair | null = null;
	private keyId: string;
	private jwks: JWKS | null = null;

	constructor(keyId: string = this.generateKeyId()) {
		this.keyId = keyId;
	}

	/**
	 * Generates a key ID in the format used in the spec
	 */
	private generateKeyId(): string {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-key1`;
	}

	/**
	 * Gets or generates the RSA key pair
	 */
	async getKeyPair(): Promise<CryptoKeyPair> {
		if (!this.keyPair) {
			this.keyPair = await crypto.subtle.generateKey(
				{
					name: "RSASSA-PKCS1-v1_5",
					modulusLength: 2048,
					publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
					hash: { name: "SHA-256" },
				},
				true,
				["sign", "verify"],
			);
		}

		return this.keyPair;
	}

	/**
	 * Gets the private key
	 */
	async getPrivateKey(): Promise<CryptoKey> {
		const keyPair = await this.getKeyPair();
		return keyPair.privateKey;
	}

	/**
	 * Gets the public key
	 */
	async getPublicKey(): Promise<CryptoKey> {
		const keyPair = await this.getKeyPair();
		return keyPair.publicKey;
	}

	/**
	 * Gets the key ID
	 */
	getKeyId(): string {
		return this.keyId;
	}

	/**
	 * Exports the public key as JWK
	 */
	async exportPublicKeyAsJWK(): Promise<JWK> {
		const publicKey = await this.getPublicKey();
		const jwk = (await crypto.subtle.exportKey("jwk", publicKey)) as JWK;

		// Add additional JWK properties
		jwk.kid = this.keyId;
		jwk.use = "sig";
		jwk.alg = "RS256";

		return jwk;
	}

	/**
	 * Gets the JWKS (JSON Web Key Set)
	 */
	async getJWKS(): Promise<JWKS> {
		if (!this.jwks) {
			const jwk = await this.exportPublicKeyAsJWK();
			this.jwks = {
				keys: [jwk],
			};
		}

		return this.jwks;
	}
}
