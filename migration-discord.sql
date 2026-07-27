-- ============================================================
-- MIGRACIÓN: agregar columna discord a la tabla users
-- Pega esto en Supabase → SQL Editor → New query → Run
-- Es seguro ejecutarlo aunque la columna ya exista (IF NOT EXISTS)
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS discord TEXT;
