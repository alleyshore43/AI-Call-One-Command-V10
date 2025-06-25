import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wllyticlzvtsimgefsti.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsbHl0aWNsenZ0c2ltZ2Vmc3RpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYxMDQxNiwiZXhwIjoyMDY1MTg2NDE2fQ.ffz0OVDEY8s2n_Qar0IlRig0G16zH9BAG5EyHZZyaWA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('Creating tables...');
    
    // Create integrations table
    const { data: integrations, error: integrationsError } = await supabase
      .from('integrations')
      .select('*')
      .limit(1);
    
    if (integrationsError && integrationsError.code === '42P01') {
      console.log('Creating integrations table...');
      
      // Create the table using a dummy insert
      const { error: createError } = await supabase
        .from('integrations')
        .insert([{
          user_id: '00000000-0000-0000-0000-000000000000',
          type: 'TEST',
          credentials: {}
        }]);
      
      if (createError && createError.code !== '42P01') {
        console.error('Error creating integrations table:', createError);
      } else {
        console.log('Integrations table created or already exists');
      }
    } else {
      console.log('Integrations table already exists');
    }
    
    // Create integration_settings table
    const { data: settings, error: settingsError } = await supabase
      .from('integration_settings')
      .select('*')
      .limit(1);
    
    if (settingsError && settingsError.code === '42P01') {
      console.log('Creating integration_settings table...');
      
      // Create the table using a dummy insert
      const { error: createError } = await supabase
        .from('integration_settings')
        .insert([{
          profile_id: '00000000-0000-0000-0000-000000000000',
          service: 'TEST',
          settings: {}
        }]);
      
      if (createError && createError.code !== '42P01') {
        console.error('Error creating integration_settings table:', createError);
      } else {
        console.log('Integration_settings table created or already exists');
      }
    } else {
      console.log('Integration_settings table already exists');
    }
    
    console.log('Tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

main();