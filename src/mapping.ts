/**
 * Dot-path field extraction for mapping API responses to records
 */

/**
 * Extract a value from a nested object using a dot-separated path.
 *
 * Examples:
 *   resolve({ a: { b: 1 } }, "a.b") → 1
 *   resolve({ items: [1, 2] }, "items") → [1, 2]
 *   resolve({ a: 1 }, "x.y") → undefined
 */
export function resolve(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;

  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Apply a mapping config to an API response item.
 * Returns a flat data object with mapped fields.
 *
 * Example:
 *   mapping: { "subject": "payload.headers.Subject", "snippet": "snippet" }
 *   item: { payload: { headers: { Subject: "Hello" } }, snippet: "Hi..." }
 *   result: { subject: "Hello", snippet: "Hi..." }
 */
export function applyMapping(
  item: Record<string, unknown>,
  mapping: Record<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [targetField, sourcePath] of Object.entries(mapping)) {
    const value = resolve(item, sourcePath);
    result[targetField] = value ?? null;
  }

  return result;
}

/**
 * Extract the external ID from an item using a field path.
 */
export function extractId(item: Record<string, unknown>, idField: string): string | null {
  const value = resolve(item, idField);
  if (value === null || value === undefined) return null;
  return String(value);
}

/**
 * Build an external URL from a template and item data.
 *
 * Template: "https://mail.google.com/mail/#inbox/{id}"
 * Replaces {fieldName} with values from the item.
 */
export function buildExternalUrl(
  template: string,
  item: Record<string, unknown>
): string {
  return template.replace(/\{(\w+)\}/g, (_, field) => {
    const value = resolve(item, field);
    return value !== null && value !== undefined ? String(value) : "";
  });
}
