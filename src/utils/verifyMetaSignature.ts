import { createHmac, timingSafeEqual } from 'crypto';

// Meta firma cada POST del webhook con HMAC-SHA256 del body crudo usando el App Secret,
// en el header `X-Hub-Signature-256: sha256=<hex>`.
export function isValidMetaSignature(
  rawBody: Buffer | undefined,
  header: string | undefined,
  appSecret: string,
): boolean {
  if (!rawBody || !header || !appSecret) return false;

  const [scheme, received] = header.split('=');
  if (scheme !== 'sha256' || !received) return false;

  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  const receivedBuffer = Buffer.from(received, 'hex');

  return receivedBuffer.length === expected.length && timingSafeEqual(receivedBuffer, expected);
}
