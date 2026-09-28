// LYD-60: helpers puros de la busqueda de mensajes del inbox -- separados de
// crm.service.ts para poder testearlos sin Prisma ni base de datos.

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_DEFAULT_LIMIT = 50;
export const SEARCH_MAX_LIMIT = 200;

// Escapa los comodines de LIKE/ILIKE (% y _) y el propio caracter de escape,
// para que lo que tipea la asesora se busque literal (ej. "50%" no es "50
// seguido de cualquier cosa").
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function normalizeSearchLimit(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return SEARCH_DEFAULT_LIMIT;
  return Math.min(n, SEARCH_MAX_LIMIT);
}

// Recorte del texto alrededor de la primera coincidencia (case-insensitive),
// estilo WhatsApp: un poco de contexto antes, mas despues, con "…" si se
// corto. Si no hay coincidencia literal (ILIKE de Postgres y toLowerCase de
// JS no pliegan exactamente igual algunos caracteres) cae al inicio del texto.
export function buildSnippet(text: string, term: string, before = 30, after = 90): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const idx = clean.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) {
    return clean.length > before + after ? `${clean.slice(0, before + after).trimEnd()}…` : clean;
  }
  const start = Math.max(0, idx - before);
  const end = Math.min(clean.length, idx + term.length + after);
  const head = start > 0 ? '…' : '';
  const tail = end < clean.length ? '…' : '';
  return `${head}${clean.slice(start, end).trim()}${tail}`;
}
