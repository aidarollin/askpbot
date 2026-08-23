/**
 * Limits that both the server and the browser need to agree on.
 *
 * Kept out of `lib/config.ts` on purpose: that module is server-only, and
 * importing it from a client component would bundle server config into the
 * browser and silently resolve its env vars to `undefined` there. These use the
 * NEXT_PUBLIC_ prefix so a single setting reaches both sides — the composer
 * greys out Send at the same threshold the API rejects at, instead of letting
 * someone write 5,000 characters and only then find out.
 *
 * The server still validates independently. The client checks are UX, not
 * enforcement.
 */

export const MAX_INPUT_CHARS = Number(
  process.env.NEXT_PUBLIC_ASKPBOT_MAX_INPUT_CHARS ?? 4000,
);

/**
 * Largest attachment, in decoded bytes. Claude accepts base64 images up to
 * ~5MB; 4MB leaves room for the rest of the request body.
 */
export const MAX_IMAGE_BYTES = Number(
  process.env.NEXT_PUBLIC_ASKPBOT_MAX_IMAGE_BYTES ?? 4_000_000,
);

/** base64 encodes 3 bytes as 4 characters, so the string is ~1.34x the payload. */
export const MAX_IMAGE_BASE64_CHARS = Math.ceil((MAX_IMAGE_BYTES / 3) * 4);
