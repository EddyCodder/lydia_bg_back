-- AlterTable
ALTER TABLE "Chat" ADD COLUMN "welcomeMessageSentAt" TIMESTAMP;

-- CreateTable
CREATE TABLE "WelcomeMessageConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "WelcomeMessageConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WelcomeMessageConfig_instanceId_key" ON "WelcomeMessageConfig"("instanceId");

-- AddForeignKey
ALTER TABLE "WelcomeMessageConfig" ADD CONSTRAINT "WelcomeMessageConfig_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
