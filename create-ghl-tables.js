import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
  try {
    console.log('🚀 Creating GoHighLevel integration tables in Supabase...');
    
    // Read SQL file
    const sqlFilePath = path.join(process.cwd(), 'migrations', 'create_integrations_tables.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute SQL
    const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('❌ Error creating tables:', error);
      
      // Try creating tables one by one
      console.log('⚠️ Trying to create tables individually...');
      
      // Create integrations table
      console.log('Creating integrations table...');
      const { error: integrationsError } = await supabase.rpc('exec_sql', { 
        sql: `
          CREATE TABLE IF NOT EXISTS public.integrations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL,
            type VARCHAR(50) NOT NULL,
            credentials JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(user_id, type)
          );
        `
      });
      
      if (integrationsError) {
        console.error('❌ Error creating integrations table:', integrationsError);
      } else {
        console.log('✅ Integrations table created successfully');
      }
      
      // Create integration_settings table
      console.log('Creating integration_settings table...');
      const { error: settingsError } = await supabase.rpc('exec_sql', { 
        sql: `
          CREATE TABLE IF NOT EXISTS public.integration_settings (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            integration_id UUID NOT NULL,
            settings JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });
      
      if (settingsError) {
        console.error('❌ Error creating integration_settings table:', settingsError);
      } else {
        console.log('✅ Integration_settings table created successfully');
      }
      
      return;
    }
    
    console.log('✅ All GoHighLevel integration tables created successfully!');
    
    // Insert test data
    console.log('📊 Inserting test data...');
    
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (userData && userData.length > 0) {
      const userId = userData[0].id;
      
      const { error: insertError } = await supabase
        .from('integrations')
        .upsert({
          user_id: userId,
          type: 'GHL',
          credentials: {
            api_key: 'test-api-key',
            location_id: 'test-location-id'
          }
        });
      
      if (insertError) {
        console.error('❌ Error inserting test data:', insertError);
      } else {
        console.log('✅ Test data inserted successfully');
      }
    } else {
      console.log('⚠️ No users found for test data');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

createTables();