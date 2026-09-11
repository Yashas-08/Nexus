-- Migration: 20260911_create_cases.sql
-- Description: Creates the dedicated cases table for NEXUS situations with Row Level Security (RLS)

-- 1. Create cases table
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  situation TEXT NOT NULL,
  intent TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
  urgency TEXT NOT NULL CHECK (urgency IN ('ROUTINE', 'SOON', 'URGENT', 'IMMEDIATE')),
  analysis JSONB NOT NULL,
  external_context JSONB DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cases_user_created ON public.cases(user_id, created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies (Strict User Ownership)

-- Users can only select their own cases
CREATE POLICY "cases_select_policy"
  ON public.cases
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can only insert cases with their own user_id
CREATE POLICY "cases_insert_policy"
  ON public.cases
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own cases
CREATE POLICY "cases_update_policy"
  ON public.cases
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own cases
CREATE POLICY "cases_delete_policy"
  ON public.cases
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
