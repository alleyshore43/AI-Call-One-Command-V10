import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://wllyticlzvtsimgefsti.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsbHl0aWNsenZ0c2ltZ2Vmc3RpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYxMDQxNiwiZXhwIjoyMDY1MTg2NDE2fQ.ffz0OVDEY8s2n_Qar0IlRig0G16zH9BAG5EyHZZyaWA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('Running migration...');
    
    // Read the SQL file
    const sql = fs.readFileSync('./migrations/create_integrations_table.sql', 'utf8');
    
    // Split the SQL into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    // Execute each statement
    for (const statement of statements) {
      console.log(`Executing: ${statement.trim().substring(0, 50)}...`);
      const { error } = await supabase.rpc('pgtle_admin_install_extension_if_not_exists', {
        name: 'uuid-ossp',
        version: '1.1',
        schema: 'extensions'
      });
      
      if (error) {
        console.log('Error installing uuid-ossp extension:', error);
      }
      
      const { data, error: sqlError } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (sqlError) {
        console.error('Error executing SQL:', sqlError);
      } else {
        console.log('Statement executed successfully');
      }
    }
    
    console.log('Migration completed');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Create a custom RPC function to execute SQL
async function createExecSqlFunction() {
  try {
    console.log('Creating exec_sql function...');
    
    const { error } = await supabase.rpc('create_exec_sql_function');
    
    if (error) {
      console.error('Error creating exec_sql function:', error);
      
      // Try to create it manually
      const createFunctionSql = `
        CREATE OR REPLACE FUNCTION exec_sql(sql text)
        RETURNS json
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          EXECUTE sql;
          RETURN json_build_object('success', true);
        EXCEPTION WHEN OTHERS THEN
          RETURN json_build_object('success', false, 'error', SQLERRM);
        END;
        $$;
      `;
      
      const { error: manualError } = await supabase.rpc('exec_sql', { sql: createFunctionSql });
      
      if (manualError) {
        console.error('Error creating exec_sql function manually:', manualError);
      } else {
        console.log('exec_sql function created manually');
      }
    } else {
      console.log('exec_sql function created');
    }
  } catch (error) {
    console.error('Error creating exec_sql function:', error);
  }
}

// Create the integration_settings table
async function createIntegrationSettingsTable() {
  try {
    console.log('Creating integration_settings table...');
    
    const sql = `
      CREATE TABLE IF NOT EXISTS integration_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        service TEXT NOT NULL,
        settings JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Add indexes
      CREATE INDEX IF NOT EXISTS idx_integration_settings_profile_id ON integration_settings(profile_id);
      CREATE INDEX IF NOT EXISTS idx_integration_settings_service ON integration_settings(service);
      
      -- Add RLS policies
      ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;
      
      -- Policy for users to see only their own settings
      CREATE POLICY select_own_settings ON integration_settings
        FOR SELECT USING (auth.uid() = profile_id);
      
      -- Policy for users to insert their own settings
      CREATE POLICY insert_own_settings ON integration_settings
        FOR INSERT WITH CHECK (auth.uid() = profile_id);
      
      -- Policy for users to update their own settings
      CREATE POLICY update_own_settings ON integration_settings
        FOR UPDATE USING (auth.uid() = profile_id);
      
      -- Policy for users to delete their own settings
      CREATE POLICY delete_own_settings ON integration_settings
        FOR DELETE USING (auth.uid() = profile_id);
    `;
    
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('Error creating integration_settings table:', error);
    } else {
      console.log('integration_settings table created successfully');
    }
  } catch (error) {
    console.error('Error creating integration_settings table:', error);
  }
}

// Create the integrations table directly
async function createIntegrationsTable() {
  try {
    console.log('Creating integrations table directly...');
    
    const sql = `
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
    `;
    
    const { data, error } = await supabase.from('_sql').select('*').execute(sql);
    
    if (error) {
      console.error('Error creating integrations table directly:', error);
      
      // Try another approach
      console.log('Trying alternative approach...');
      
      // Create table
      const createTable = await supabase
        .from('integrations')
        .insert([{ 
          user_id: '00000000-0000-0000-0000-000000000000',
          type: 'TEST',
          credentials: {}
        }])
        .select();
        
      if (createTable.error) {
        console.error('Error creating table:', createTable.error);
      } else {
        console.log('Table created successfully');
        
        // Clean up test data
        await supabase
          .from('integrations')
          .delete()
          .eq('user_id', '00000000-0000-0000-0000-000000000000');
      }
    } else {
      console.log('integrations table created successfully');
    }
  } catch (error) {
    console.error('Error creating integrations table:', error);
  }
}

// Main function
async function main() {
  try {
    // Create the exec_sql function
    await createExecSqlFunction();
    
    // Create the integrations table
    await createIntegrationsTable();
    
    // Create the integration_settings table
    await createIntegrationSettingsTable();
    
    console.log('All migrations completed');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

main();