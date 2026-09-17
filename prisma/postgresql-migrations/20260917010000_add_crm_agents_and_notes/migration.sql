-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('open', 'pending', 'resolved');

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "color" VARCHAR(20),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationNote" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "agentId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_email_key" ON "Agent"("email");

-- CreateIndex
CREATE INDEX "ConversationNote_chatId_idx" ON "ConversationNote"("chatId");

-- AlterTable
ALTER TABLE "Chat"
    ADD COLUMN "status" "ChatStatus" NOT NULL DEFAULT 'open',
    ADD COLUMN "assignedAgentId" TEXT;

-- CreateIndex
CREATE INDEX "Chat_assignedAgentId_idx" ON "Chat"("assignedAgentId");

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationNote" ADD CONSTRAINT "ConversationNote_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationNote" ADD CONSTRAINT "ConversationNote_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: los 4 agentes que ya existian como datos de ejemplo en el frontend
-- (mock-data.ts) antes de CRM-12, para que el inbox real tenga a quien
-- asignar desde el primer deploy.
INSERT INTO "Agent" ("id", "name", "color", "updatedAt") VALUES
    ('agent_mafer', 'Mafer', '#235bcc', CURRENT_TIMESTAMP),
    ('agent_bustamante', 'Bustamante', '#22c55e', CURRENT_TIMESTAMP),
    ('agent_centro', 'Centro', '#ff8e15', CURRENT_TIMESTAMP),
    ('agent_cayma', 'Cayma', '#8b5cf6', CURRENT_TIMESTAMP);
