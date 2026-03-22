-- Ask the Cohort: run this in your Supabase SQL editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE cohort_questions (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name       TEXT NOT NULL,
  question   TEXT NOT NULL,
  vote_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE cohort_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read"
  ON cohort_questions FOR SELECT USING (true);

CREATE POLICY "public_insert"
  ON cohort_questions FOR INSERT WITH CHECK (true);

-- Atomic vote increment via RPC (avoids race conditions)
CREATE OR REPLACE FUNCTION increment_vote(question_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE cohort_questions
  SET vote_count = vote_count + 1
  WHERE id = question_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_vote(UUID) TO anon;

-- Replies table
CREATE TABLE cohort_replies (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question_id UUID REFERENCES cohort_questions(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cohort_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_replies"
  ON cohort_replies FOR SELECT USING (true);

CREATE POLICY "authenticated_insert_replies"
  ON cohort_replies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
