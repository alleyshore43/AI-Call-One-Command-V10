-- Create integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  credentials JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type);

-- Add RLS policies
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Policy for users to see only their own integrations
CREATE POLICY select_own_integrations ON integrations
  FOR SELECT USING (auth.uid() = user_id);

-- Policy for users to insert their own integrations
CREATE POLICY insert_own_integrations ON integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own integrations
CREATE POLICY update_own_integrations ON integrations
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy for users to delete their own integrations
CREATE POLICY delete_own_integrations ON integrations
  FOR DELETE USING (auth.uid() = user_id);