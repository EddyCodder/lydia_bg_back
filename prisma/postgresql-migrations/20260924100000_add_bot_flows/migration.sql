-- CreateEnum
CREATE TYPE "BotSessionStatus" AS ENUM ('active', 'done', 'handoff');

-- CreateTable
CREATE TABLE "BotFlow" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "graph" JSONB NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "BotFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotSession" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "currentNodeId" VARCHAR(64),
    "status" "BotSessionStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "BotSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotFlow_instanceId_key" ON "BotFlow"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "BotSession_chatId_key" ON "BotSession"("chatId");

-- CreateIndex
CREATE INDEX "BotSession_flowId_idx" ON "BotSession"("flowId");

-- AddForeignKey
ALTER TABLE "BotFlow" ADD CONSTRAINT "BotFlow_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotSession" ADD CONSTRAINT "BotSession_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotSession" ADD CONSTRAINT "BotSession_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "BotFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
