-- LYD-60: busqueda contextual de mensajes del inbox (GET /crm/conversations/search).
-- Indice trigram sobre el texto buscable de Message.message para que el
-- ILIKE '%...%' no sea un seq scan de toda la tabla. La expresion tiene que
-- ser IDENTICA a MESSAGE_SEARCH_TEXT en src/api/services/crm.service.ts (sin
-- el alias "m"), si no Postgres no usa el indice.
--
-- Prisma no sabe modelar indices por expresion: si un `prisma migrate dev`
-- futuro propone un DROP INDEX "Message_search_text_trgm_idx", sacarlo a mano
-- de la migracion generada.

-- pg_trgm es una extension "trusted" desde PG13: la puede crear el owner de la base.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Message_search_text_trgm_idx" ON "Message" USING gin ((COALESCE(
  "message"->>'conversation',
  "message"->'extendedTextMessage'->>'text',
  "message"->'imageMessage'->>'caption',
  "message"->'videoMessage'->>'caption',
  "message"->'documentMessage'->>'caption',
  "message"->'documentMessage'->>'fileName',
  ''
)) gin_trgm_ops);
