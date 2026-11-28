import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const PASSWORD_HASH_ITERATIONS = 310000;
const PASSWORD_HASH_BYTES = 32;

/**
 * Derives the existing PBKDF2-HMAC-SHA256 password hash.
 * Noble's audited JS implementation is used because Workers caps native
 * PBKDF2 calls at 100,000 iterations. The derived bytes remain RFC 8018
 * compatible with existing salt:hex password hashes.
 */
export async function derivePasswordHash(password: string, salt: string): Promise<Uint8Array> {
  return pbkdf2Async(sha256, password, salt, {
    c: PASSWORD_HASH_ITERATIONS,
    dkLen: PASSWORD_HASH_BYTES,
    asyncTick: 10,
  });
}
