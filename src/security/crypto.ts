import { env } from "../config/env";

const encoder = new TextEncoder();

function decodeBase64(input: string) {
  return Buffer.from(input, "base64");
}

function toOwnedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

const rawKey = decodeBase64(env.encryptionKey);

if (rawKey.byteLength !== 32) {
  throw new Error("ENCRYPTION_KEY must be a base64-encoded 32-byte AES-256-GCM key");
}

const key = await crypto.subtle.importKey("raw", toOwnedArrayBuffer(rawKey), "AES-GCM", false, ["encrypt", "decrypt"]);

export async function encryptSecret(secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(secret));

  return `${Buffer.from(iv).toString("base64")}:${Buffer.from(ciphertext).toString("base64")}`;
}

export async function decryptSecret(payload: string) {
  const [ivPart, ciphertextPart] = payload.split(":");
  if (!ivPart || !ciphertextPart) {
    throw new Error("Invalid encrypted payload format");
  }

  const iv = decodeBase64(ivPart);
  const ciphertext = decodeBase64(ciphertextPart);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(toOwnedArrayBuffer(iv)) },
    key,
    toOwnedArrayBuffer(ciphertext),
  );

  return Buffer.from(plaintext).toString("utf8");
}
