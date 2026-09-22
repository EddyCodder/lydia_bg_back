# CLAUDE.md

This file provides comprehensive guidance to Claude AI when working with the Evolution API codebase.

## Project Overview

**Evolution API** is a powerful, production-ready REST API for WhatsApp communication that supports multiple WhatsApp providers:
- **Baileys** (WhatsApp Web) - Open-source WhatsApp Web client
- **Meta Business API** - Official WhatsApp Business API
- **Evolution API** - Custom WhatsApp integration

Built with **Node.js 20+**, **TypeScript 5+**, and **Express.js**, it provides extensive integrations with chatbots, CRM systems, and messaging platforms in a **multi-tenant architecture**.

## Common Development Commands

### Build and Run
```bash
# Development
npm run dev:server    # Run in development with hot reload (tsx watch)

# Production
npm run build        # TypeScript check + tsup build
npm run start:prod   # Run production build

# Direct execution
npm start           # Run with tsx
```

### Code Quality
```bash
npm run lint        # ESLint with auto-fix
npm run lint:check  # ESLint check only
npm run commit      # Interactive commit with commitizen
```

### Database Management
```bash
# Set database provider first
export DATABASE_PROVIDER=postgresql  # or mysql

# Generate Prisma client (automatically uses DATABASE_PROVIDER env)
npm run db:generate

# Deploy migrations (production)
npm run db:deploy      # Unix/Mac
npm run db:deploy:win  # Windows

# Development migrations (with sync to provider folder)
npm run db:migrate:dev      # Unix/Mac
npm run db:migrate:dev:win  # Windows

# Open Prisma Studio
npm run db:studio

# Development migrations
npm run db:migrate:dev      # Unix/Mac
npm run db:migrate:dev:win  # Windows
```

### Testing
```bash
npm test    # Run tests with watch mode
```

## Architecture Overview

### Core Structure
- **Multi-tenant SaaS**: Complete instance isolation with per-tenant authentication
- **Multi-provider database**: PostgreSQL and MySQL via Prisma ORM with provider-specific schemas and migrations
- **WhatsApp integrations**: Baileys, Meta Business API, and Evolution API with unified interface
- **Event-driven architecture**: EventEmitter2 for internal events + WebSocket, RabbitMQ, SQS, NATS, Pusher for external events
- **Microservices pattern**: Modular integrations for chatbots, storage, and external services

### Directory Layout
```
src/
├── api/
│   ├── controllers/     # HTTP route handlers (thin layer)
│   ├── services/        # Business logic (core functionality)
│   ├── repository/      # Data access layer (Prisma)
│   ├── dto/            # Data Transfer Objects (simple classes)
│   ├── guards/         # Authentication/authorization middleware
│   ├── integrations/   # External service integrations
│   │   ├── channel/    # WhatsApp providers (Baileys, Business API, Evolution)
│   │   ├── chatbot/    # AI/Bot integrations (OpenAI, Dify, Typebot, Chatwoot)
│   │   ├── event/      # Event systems (WebSocket, RabbitMQ, SQS, NATS, Pusher)
│   │   └── storage/    # File storage (S3, MinIO)
│   ├── routes/         # Express route definitions (RouterBroker pattern)
│   └── types/          # TypeScript type definitions
├── config/             # Environment and app configuration
├── cache/             # Redis and local cache implementations
├── exceptions/        # Custom HTTP exception classes
├── utils/            # Shared utilities and helpers
└── validate/         # JSONSchema7 validation schemas
```

### Key Integration Points

**Channel Integrations** (`src/api/integrations/channel/`):
- **Baileys**: WhatsApp Web client with QR code authentication
- **Business API**: Official Meta WhatsApp Business API
- **Evolution API**: Custom WhatsApp integration
- Connection lifecycle management per instance with automatic reconnection

**Chatbot Integrations** (`src/api/integrations/chatbot/`):
- **EvolutionBot**: Native chatbot with trigger system
- **Chatwoot**: Customer service platform integration
- **Typebot**: Visual chatbot flow builder
- **OpenAI**: AI capabilities including GPT and Whisper (audio transcription)
- **Dify**: AI agent workflow platform
- **Flowise**: LangChain visual builder
- **N8N**: Workflow automation platform
- **EvoAI**: Custom AI integration

**Event Integrations** (`src/api/integrations/event/`):
- **WebSocket**: Real-time Socket.io connections
- **RabbitMQ**: Message queue for async processing
- **Amazon SQS**: Cloud-based message queuing
- **NATS**: High-performance messaging system
- **Pusher**: Real-time push notifications

**Storage Integrations** (`src/api/integrations/storage/`):
- **AWS S3**: Cloud object storage
- **MinIO**: Self-hosted S3-compatible storage
- Media file management and URL generation

### Database Schema Management
- Separate schema files: `postgresql-schema.prisma` and `mysql-schema.prisma`
- Environment variable `DATABASE_PROVIDER` determines active database
- Migration folders are provider-specific and auto-selected during deployment

### Authentication & Security
- **API key-based authentication** via `apikey` header (global or per-instance)
- **Instance-specific tokens** for WhatsApp connection authentication
- **Guards system** for route protection and authorization
- **Input validation** using JSONSchema7 with RouterBroker `dataValidate`
- **Rate limiting** and security middleware
- **Webhook signature validation** for external integrations

## Important Implementation Details

### WhatsApp Instance Management
- Each WhatsApp connection is an "instance" with unique name
- Instance data stored in database with connection state
- Session persistence in database or file system (configurable)
- Automatic reconnection handling with exponential backoff

### Message Queue Architecture
- Supports RabbitMQ, Amazon SQS, and WebSocket for events
- Event types: message.received, message.sent, connection.update, etc.
- Configurable per instance which events to send

### Media Handling
- Local storage or S3/Minio for media files
- Automatic media download from WhatsApp
- Media URL generation for external access
- Support for audio transcription via OpenAI

### Multi-tenancy Support
- Instance isolation at database level
- Separate webhook configurations per instance
- Independent integration settings per instance

## Environment Configuration

Key environment variables are defined in `.env.example`. The system uses a strongly-typed configuration system via `src/config/env.config.ts`.

Critical configurations:
- `DATABASE_PROVIDER`: postgresql or mysql
- `DATABASE_CONNECTION_URI`: Database connection string
- `AUTHENTICATION_API_KEY`: Global API authentication
- `REDIS_ENABLED`: Enable Redis cache
- `RABBITMQ_ENABLED`/`SQS_ENABLED`: Message queue options

## Development Guidelines

The project follows comprehensive development standards defined in `.cursor/rules/`:

### Core Principles
- **Always respond in Portuguese (PT-BR)** for user communication
- **Follow established architecture patterns** (Service Layer, RouterBroker, etc.)
- **Robust error handling** with retry logic and graceful degradation
- **Multi-database compatibility** (PostgreSQL and MySQL)
- **Security-first approach** with input validation and rate limiting
- **Performance optimizations** with Redis caching and connection pooling

### Code Standards
- **TypeScript strict mode** with full type coverage
- **JSONSchema7** for input validation (not class-validator)
- **Conventional Commits** enforced by commitlint
- **ESLint + Prettier** for code formatting
- **Service Object pattern** for business logic
- **RouterBroker pattern** for route handling with `dataValidate`

### Architecture Patterns
- **Multi-tenant isolation** at database and instance level
- **Event-driven communication** with EventEmitter2
- **Microservices integration** pattern for external services
- **Connection pooling** and lifecycle management
- **Caching strategy** with Redis primary and Node-cache fallback

## Testing Approach

Currently, the project has minimal formal testing infrastructure:
- **Manual testing** is the primary approach
- **Integration testing** in development environment
- **No unit test suite** currently implemented
- Test files can be placed in `test/` directory as `*.test.ts`
- Run `npm test` for watch mode development testing

### Recommended Testing Strategy
- Focus on **critical business logic** in services
- **Mock external dependencies** (WhatsApp APIs, databases)
- **Integration tests** for API endpoints
- **Manual testing** for WhatsApp connection flows

## Deployment Considerations

- Docker support with `Dockerfile` and `docker-compose.yaml`
- Graceful shutdown handling for connections
- Health check endpoints for monitoring
- Sentry integration for error tracking
- Telemetry for usage analytics (non-sensitive data only)

---

# lydia_bg_back — notas de Brittany Group

Todo lo de arriba es la documentación original del proyecto Evolution API (no tocada). Lo de acá abajo es específico de cómo Brittany Group usa este fork — para trabajo propio de Brittany, esto tiene prioridad sobre "Always respond in Portuguese" de la sección anterior (esa instrucción es para contribuir al proyecto Evolution API en sí, no para el trabajo de Brittany sobre el fork).

Fork propio de [evolution-foundation/evolution-api](https://github.com/evolution-foundation/evolution-api) (CRM-8, 2026-09-15; carpeta y repo renombrados el mismo día de `evolution_brittanygroup` a `lydia_bg_back`). El org se renombró desde `EvolutionAPI`; la imagen Docker Hub correspondiente es `evoapicloud/evolution-api`, que es lo que reemplaza este fork en `CRM_brittanygroup/docker-compose.yml` — ese cambio (buildear desde este fork en vez de pullear la imagen oficial) todavía no está hecho.

Ver `CRM_brittanygroup/CLAUDE.md` para el contexto completo del proyecto CRM (Chatwoot + Evolution API + Lydia).

## Remotos

- `origin` → `EddyCodder/lydia_bg_back` (el fork, donde se pushea).
- `upstream` → `evolution-foundation/evolution-api` (el oficial, para traer actualizaciones: `git fetch upstream` + merge/rebase).

## ⚠️ Licencia — leer antes de tocar código

Apache 2.0 + condición adicional: si Evolution API se usa como parte de un sistema (incluido uno cerrado/propietario, como Lydia), **es obligatorio mostrar una notificación visible de que se está usando Evolution API**, accesible para administradores (ej. una pantalla de configuración). Todavía no está agregada en Lydia — pendiente.

## Flujo

Igual que el resto del ecosistema Brittany: ningún cambio de código sin ticket primero (ver `docs_ragnargroup/flujo_desarrollo.md` y el `CLAUDE.md` del workspace). El prefijo de este proyecto es `LYD-` (visto por primera vez 2026-09-17, LYD-1..LYD-12) -- `CRM-` (hasta CRM-12) queda solo como referencia histórica de tickets ya cerrados.

## Canales de Meta distintos de WhatsApp (LYD-26)

Facebook Messenger (`integration: FACEBOOK-MESSENGER`) e Instagram DM (`INSTAGRAM`) son instancias como las de WhatsApp Cloud API, servidas por `MetaSocialStartupService` (`src/api/integrations/channel/meta/meta.social.service.ts`). Crear una instancia: `POST /instance/create` con `integration`, `number` = id de la Pagina (Messenger) o de la cuenta profesional de Instagram (es el `entry.id` que Meta manda en el webhook) y `token` = access token de la Pagina (permisos `pages_messaging`, `pages_manage_metadata`, `instagram_manage_messages`).

- Webhook: el mismo `POST /webhook/meta` de WhatsApp (misma verificacion de firma `X-Hub-Signature-256`). `MetaController` enruta por `object`: `page` -> Messenger, `instagram` -> Instagram, y dentro por `entry.id` -> `Instance.number`. En la app de Meta hay que suscribir los objetos `page` e `instagram` a esa URL, con los campos `messages`, `message_echoes`, `message_reads` y `message_deliveries`.
- `remoteJid` = `<PSID|IGSID>@messenger` / `<IGSID>@instagram`. No hay telefono: el contacto solo tiene id de usuario de Meta.
- Se guardan en las mismas tablas (`Message`, `Chat`, `Contact`) que WhatsApp, asi que el inbox de `/crm/conversations?instanceName=...` los lista igual.
- Envio por `/message/sendText` y `/message/sendMedia`. Fuera de la ventana de 24 h Meta rechaza el envio y el error llega tal cual al CRM. Instagram solo acepta adjuntos como URL publica (no soporta subir archivos); Messenger sube el archivo con la Attachment Upload API.
- Los adjuntos entrantes guardan la URL de la CDN de Meta (expira) y se bajan al pedir `getBase64FromMediaMessage`; no se persisten en S3.
