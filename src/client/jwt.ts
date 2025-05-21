/**
 * MCP-UI Embedding Protocol SDK - Client JWT Utilities
 * Version: 1.0.0
 */

import type { JWTHeader, JWTPayload, JWK, JWKS } from "../host/jwt";

/**
 * JWT utilities for the client side
 */

/**
 * Decodes a JWT token without validation
 */
export function decode(token: string): {
	header: JWTHeader;
	payload: JWTPayload;
} {
	const parts = token.split(".");
	if (parts.length !== 3) {
		throw new Error("Invalid JWT format");
	}

	try {
		const header = JSON.parse(base64UrlDecode(parts[0])) as JWTHeader;
		const payload = JSON.parse(base64UrlDecode(parts[1])) as JWTPayload;

		return { header, payload };
	} catch (error) {
		throw new Error("Failed to decode JWT");
	}
}

/**
 * Validates a JWT token against a JWKS URL
 */
export async function validate(
	token: string,
	jwksUrl: string,
): Promise<boolean> {
	try {
		// Decode the token to get the header and payload
		const { header, payload } = decode(token);

		// Check if token is expired
		const now = Math.floor(Date.now() / 1000);
		if (payload.exp && payload.exp < now) {
			console.warn("Token is expired");
			return false;
		}

		// Fetch the JWKS
		const jwks = await fetchJWKS(jwksUrl);

		// Find the key that matches the kid in the token header
		const key = jwks.keys.find((k) => k.kid === header.kid);
		if (!key) {
			console.warn("No matching key found in JWKS");
			return false;
		}

		// Import the public key
		const publicKey = await importPublicKey(key);

		// Verify the signature
		return await verifySignature(token, publicKey);
	} catch (error) {
		console.error("JWT validation error:", error);
		return false;
	}
}

/**
 * Fetches JWKS from a URL
 */
async function fetchJWKS(jwksUrl: string): Promise<JWKS> {
	const response = await fetch(jwksUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch JWKS: ${response.statusText}`);
	}
	return (await response.json()) as JWKS;
}

/**
 * Imports a JWK as a CryptoKey
 */
async function importPublicKey(jwk: JWK): Promise<CryptoKey> {
	return await crypto.subtle.importKey(
		"jwk",
		jwk,
		{
			name: "RSASSA-PKCS1-v1_5",
			hash: { name: "SHA-256" },
		},
		false,
		["verify"],
	);
}

/**
 * Verifies the signature of a JWT
 */
async function verifySignature(
	token: string,
	publicKey: CryptoKey,
): Promise<boolean> {
	const parts = token.split(".");
	const signatureBase = `${parts[0]}.${parts[1]}`;
	const signature = base64UrlToArrayBuffer(parts[2]);

	return await crypto.subtle.verify(
		{ name: "RSASSA-PKCS1-v1_5" },
		publicKey,
		signature,
		new TextEncoder().encode(signatureBase),
	);
}

/**
 * Decodes a base64url string
 */
function base64UrlDecode(input: string): string {
	// Convert base64url to base64
	const base64 = input
		.replace(/-/g, "+")
		.replace(/_/g, "/")
		.padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");

	// Decode base64
	return atob(base64);
}

/**
 * Converts a base64url string to an ArrayBuffer
 */
function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
	const base64 = base64url
		.replace(/-/g, "+")
		.replace(/_/g, "/")
		.padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), "=");

	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}
