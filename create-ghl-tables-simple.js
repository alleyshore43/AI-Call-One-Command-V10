import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
  try {
    console.log('🚀 Creating GoHighLevel integration tables in Supabase...');
    
    // Create integrations table
    console.log('Creating integrations table...');
    const { error: integrationsError } = await supabase.from('integrations').select('count(*)', { count: 'exact', head: true });
    
    if (integrationsError && integrationsError.code === '42P01') {
      console.log('Integrations table does not exist, creating...');
      
      // Use raw SQL query through Supabase REST API
      const { error: createError } = await supabase.rpc('exec_sql', { 
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
      
      if (createError) {
        console.error('❌ Error creating integrations table:', createError);
        console.log('⚠️ You may need to create this table manually in the Supabase dashboard SQL editor.');
      } else {
        console.log('✅ Integrations table created successfully');
      }
    } else {
      console.log('✅ Integrations table already exists');
    }
    
    // Insert test data
    console.log('📊 Inserting test data...');
    
    // Get the user ID from the CSV file
    const userId = '5d5f69d3-0cb7-42db-9b10-1246da9c4c22'; // From the CSV file
    
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
    
    console.log('\n📋 SQL for manual execution in Supabase SQL Editor:');
    console.log(`
-- Create integrations table
CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    credentials JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, type)
);

-- Create integration_settings table
CREATE TABLE IF NOT EXISTS public.integration_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
    settings JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert test data
INSERT INTO public.integrations (user_id, type, credentials)
VALUES (
    '5d5f69d3-0cb7-42db-9b10-1246da9c4c22',
    'GHL',
    '{"api_key": "test-api-key", "location_id": "test-location-id"}'
)
ON CONFLICT (user_id, type) 
DO UPDATE SET 
    credentials = '{"api_key": "test-api-key", "location_id": "test-location-id"}',
    updated_at = NOW();
    `);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

createTables();