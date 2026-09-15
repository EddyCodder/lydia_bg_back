# evolution_brittanygroup

Fork propio de [evolution-foundation/evolution-api](https://github.com/evolution-foundation/evolution-api) (CRM-8, 2026-09-15). El org se renombró desde `EvolutionAPI`; la imagen Docker Hub correspondiente es `evoapicloud/evolution-api`, que es lo que reemplaza este fork en `CRM_brittanygroup/docker-compose.yml` — ese cambio (buildear desde este fork en vez de pullear la imagen oficial) todavía no está hecho.

Ver `CRM_brittanygroup/CLAUDE.md` para el contexto completo del proyecto CRM (Chatwoot + Evolution API + Lydia).

## Remotos

- `origin` → `EddyCodder/evolution-api` (el fork, donde se pushea).
- `upstream` → `evolution-foundation/evolution-api` (el oficial, para traer actualizaciones: `git fetch upstream` + merge/rebase).

## ⚠️ Licencia — leer antes de tocar código

Apache 2.0 + condición adicional: si Evolution API se usa como parte de un sistema (incluido uno cerrado/propietario, como Lydia), **es obligatorio mostrar una notificación visible de que se está usando Evolution API**, accesible para administradores (ej. una pantalla de configuración). Todavía no está agregada en Lydia — pendiente.

## Flujo

Igual que el resto del ecosistema Brittany: ningún cambio de código sin ticket `CRM-` primero (ver `docs_ragnargroup/flujo_desarrollo.md` y el `CLAUDE.md` del workspace).
