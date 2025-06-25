#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Use the service role key for admin access
const supabaseUrl = 'https://wllyticlzvtsimgefsti.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsbHl0aWNsenZ0c2ltZ2Vmc3RpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYxMDQxNiwiZXhwIjoyMDY1MTg2NDE2fQ.ffz0OVDEY8s2n_Qar0IlRig0G16zH9BAG5EyHZZyaWA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('🔍 Checking database schema...');
    
    try {
        // Check ai_agents table
        console.log('\n📋 AI Agents Table:');
        const { data: aiAgents, error: aiAgentsError } = await supabase
            .from('ai_agents')
            .select('*')
            .limit(1);
            
        if (aiAgentsError) {
            console.log('❌ Error accessing ai_agents table:', aiAgentsError.message);
        } else if (aiAgents && aiAgents.length > 0) {
            console.log('✅ Available columns:', Object.keys(aiAgents[0]));
            console.log('Sample data:', aiAgents[0]);
        } else {
            console.log('ℹ️ No records found in ai_agents table');
        }
        
        // Check ivr_menus table
        console.log('\n📋 IVR Menus Table:');
        const { data: ivrMenus, error: ivrMenusError } = await supabase
            .from('ivr_menus')
            .select('*')
            .limit(1);
            
        if (ivrMenusError) {
            console.log('❌ Error accessing ivr_menus table:', ivrMenusError.message);
        } else if (ivrMenus && ivrMenus.length > 0) {
            console.log('✅ Available columns:', Object.keys(ivrMenus[0]));
            console.log('Sample data:', ivrMenus[0]);
        } else {
            console.log('ℹ️ No records found in ivr_menus table');
        }
        
        // Check ivr_options table
        console.log('\n📋 IVR Options Table:');
        const { data: ivrOptions, error: ivrOptionsError } = await supabase
            .from('ivr_options')
            .select('*')
            .limit(1);
            
        if (ivrOptionsError) {
            console.log('❌ Error accessing ivr_options table:', ivrOptionsError.message);
        } else if (ivrOptions && ivrOptions.length > 0) {
            console.log('✅ Available columns:', Object.keys(ivrOptions[0]));
            console.log('Sample data:', ivrOptions[0]);
        } else {
            console.log('ℹ️ No records found in ivr_options table');
        }
        
        // List all tables in the database
        console.log('\n📋 All Tables:');
        const { data: tables, error: tablesError } = await supabase
            .rpc('list_tables');
            
        if (tablesError) {
            console.log('❌ Error listing tables:', tablesError.message);
        } else {
            console.log('✅ Available tables:', tables);
        }
    } catch (err) {
        console.error('💥 Unexpected error:', err);
    }
}

checkSchema().catch(console.error);