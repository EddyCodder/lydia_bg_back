-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('contacto_inicial', 'negociacion', 'promesa_pago', 'discusion_contrato', 'matriculado', 'venta_perdida');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "leadNumber" TEXT NOT NULL,
    "contactName" VARCHAR(100) NOT NULL,
    "company" VARCHAR(100),
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "position" VARCHAR(100),
    "source" VARCHAR(50) NOT NULL,
    "budget" VARCHAR(50),
    "budgetAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stage" "LeadStage" NOT NULL DEFAULT 'contacto_inicial',
    "hasPendingTasks" BOOLEAN NOT NULL DEFAULT false,
    "chatId" TEXT,
    "assignedAgentId" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_leadNumber_key" ON "Lead"("leadNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_chatId_key" ON "Lead"("chatId");

-- CreateIndex
CREATE INDEX "Lead_stage_idx" ON "Lead"("stage");

-- CreateIndex
CREATE INDEX "Lead_assignedAgentId_idx" ON "Lead"("assignedAgentId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
