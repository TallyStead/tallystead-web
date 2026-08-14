export type PasskeyOptions = { ceremony_id: string; public_key: Record<string, unknown> };

function decodeBase64Url(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)).buffer;
}

function encodeBase64Url(value: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function registrationPublicKey(options: Record<string, unknown>): PublicKeyCredentialCreationOptions {
  const user = options.user as Record<string, unknown>;
  return { ...options, challenge: decodeBase64Url(options.challenge as string), user: { ...user, id: decodeBase64Url(user.id as string) }, excludeCredentials: ((options.excludeCredentials as Array<Record<string, unknown>> | undefined) ?? []).map((item) => ({ ...item, id: decodeBase64Url(item.id as string) })) } as PublicKeyCredentialCreationOptions;
}

export function authenticationPublicKey(options: Record<string, unknown>): PublicKeyCredentialRequestOptions {
  return { ...options, challenge: decodeBase64Url(options.challenge as string), allowCredentials: ((options.allowCredentials as Array<Record<string, unknown>> | undefined) ?? []).map((item) => ({ ...item, id: decodeBase64Url(item.id as string) })) } as PublicKeyCredentialRequestOptions;
}

export function registrationCredential(credential: PublicKeyCredential): Record<string, unknown> {
  const response = credential.response as AuthenticatorAttestationResponse;
  return { id: credential.id, rawId: encodeBase64Url(credential.rawId), type: credential.type, authenticatorAttachment: credential.authenticatorAttachment, clientExtensionResults: credential.getClientExtensionResults(), response: { clientDataJSON: encodeBase64Url(response.clientDataJSON), attestationObject: encodeBase64Url(response.attestationObject), transports: response.getTransports?.() ?? [] } };
}

export function authenticationCredential(credential: PublicKeyCredential): Record<string, unknown> {
  const response = credential.response as AuthenticatorAssertionResponse;
  return { id: credential.id, rawId: encodeBase64Url(credential.rawId), type: credential.type, authenticatorAttachment: credential.authenticatorAttachment, clientExtensionResults: credential.getClientExtensionResults(), response: { clientDataJSON: encodeBase64Url(response.clientDataJSON), authenticatorData: encodeBase64Url(response.authenticatorData), signature: encodeBase64Url(response.signature), userHandle: response.userHandle ? encodeBase64Url(response.userHandle) : null } };
}
