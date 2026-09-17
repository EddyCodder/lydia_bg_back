-- CreateTable
CREATE TABLE "TemplateGroup" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "TemplateGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickReplyTemplate" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "command" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "QuickReplyTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuickReplyTemplate_groupId_command_key" ON "QuickReplyTemplate"("groupId", "command");

-- AddForeignKey
ALTER TABLE "QuickReplyTemplate" ADD CONSTRAINT "QuickReplyTemplate_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TemplateGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
