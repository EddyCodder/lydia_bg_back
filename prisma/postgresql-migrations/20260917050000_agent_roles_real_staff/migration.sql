-- CreateEnum
CREATE TYPE "AgentRole" AS ENUM ('asesor', 'administrador');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN "role" "AgentRole" NOT NULL DEFAULT 'asesor';

-- Saca los 4 agentes semilla de ejemplo (Mafer/Bustamante/Centro/Cayma,
-- CRM-12): no son personas reales. Seguro porque Chat.assignedAgentId y
-- ConversationNote.agentId son ON DELETE SET NULL, y todavia no hay ninguna
-- instancia de WhatsApp conectada (nada les apunta hoy).
DELETE FROM "Agent" WHERE "id" IN ('agent_mafer', 'agent_bustamante', 'agent_centro', 'agent_cayma');

-- Asesoras reales de Brittany Group (rol "asesora" activo en la base de
-- produccion del SGA, payxiohs_sga_prod, consultado 2026-09-17). No incluye
-- "Desarrollo Brit" (cuenta de prueba) ni las inactivas.
INSERT INTO "Agent" ("id", "name", "email", "role", "updatedAt") VALUES
    ('agent_aalvarado', 'Avril Alvarado Celada', 'aalvarado@brittanygroup.edu.pe', 'asesor', CURRENT_TIMESTAMP),
    ('agent_cveliz', 'Cynthia Veliz Fernandini', 'cveliz@brittanygroup.edu.pe', 'asesor', CURRENT_TIMESTAMP),
    ('agent_fkasparette', 'Fiorella Kasparette Melgar', 'fkasparette@brittanygroup.edu.pe', 'asesor', CURRENT_TIMESTAMP),
    ('agent_marcila', 'Maliuw Arcila Pérez', 'marcila@brittanygroup.edu.pe', 'asesor', CURRENT_TIMESTAMP),
    ('agent_mmaturrano', 'María Fernanda Maturano Evangelista', 'mmaturrano@brittanygroup.edu.pe', 'asesor', CURRENT_TIMESTAMP),
    ('agent_mquilluya', 'María Fernanda Quilluya Hallasi', 'mquilluya@brittanygroup.edu.pe', 'asesor', CURRENT_TIMESTAMP),
    ('agent_prueda', 'Paola Fernanda Rueda Pacheco', 'prueda@brittanygroup.edu.pe', 'asesor', CURRENT_TIMESTAMP),
    ('agent_pkasparette', 'Pierina Kasparette Melgar', 'pkasparette@brittanygroup.edu.pe', 'asesor', CURRENT_TIMESTAMP),
    ('agent_pccope', 'Polet Ccope Ccencho', 'pccope@brittanygroup.edu.pe', 'asesor', CURRENT_TIMESTAMP),
    ('agent_vrivera', 'Yoxsana Valentina Rivera Molina', 'vrivera@brittanygroup.edu.pe', 'asesor', CURRENT_TIMESTAMP);

-- Administradores (para tenerlos en cuenta desde ya, sin logica de permisos
-- especial todavia). Mismos correos que usan en el SGA.
INSERT INTO "Agent" ("id", "name", "email", "role", "updatedAt") VALUES
    ('agent_christian', 'Christian Valdivia Chávez', 'christian@brittanygroup.edu.pe', 'administrador', CURRENT_TIMESTAMP),
    ('agent_brodriguez', 'Betsy Rodríguez Murguía', 'brodriguez@brittanygroup.edu.pe', 'administrador', CURRENT_TIMESTAMP),
    ('agent_pilar', 'María del Pilar Angles García', 'pilar@brittanygroup.edu.pe', 'administrador', CURRENT_TIMESTAMP),
    ('agent_gaguilar', 'Gustavo Aguilar Flores', 'gaguilar@brittanygroup.edu.pe', 'administrador', CURRENT_TIMESTAMP),
    ('agent_edurand', 'Eduardo Durand Obando', 'edurand@brittanygroup.edu.pe', 'administrador', CURRENT_TIMESTAMP);
