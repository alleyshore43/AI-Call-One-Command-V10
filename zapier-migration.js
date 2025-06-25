#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

// Load environment variables
dotenv.config();

// Use the service role key for admin access
const supabaseUrl = 'https://wllyticlzvtsimgefsti.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsbHl0aWNsenZ0c2ltZ2Vmc3RpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYxMDQxNiwiZXhwIjoyMDY1MTg2NDE2fQ.ffz0OVDEY8s2n_Qar0IlRig0G16zH9BAG5EyHZZyaWA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    console.log('🔄 Running Zapier integration database migration...');
    
    try {
        // Create agent_zaps table
        console.log('Creating agent_zaps table...');
        
        // First check if the table already exists
        const { data: existingTable, error: checkError } = await supabase
            .from('agent_zaps')
            .select('id')
            .limit(1);
            
        if (checkError && checkError.code !== 'PGRST116') {
            console.error('Error checking for agent_zaps table:', checkError);
        }
        
        // If we got data or an error that's not "relation does not exist", the table exists
        const tableExists = !checkError || (checkError && checkError.code !== 'PGRST116');
        
        if (tableExists) {
            console.log('✅ agent_zaps table already exists');
        } else {
            // Create the table using SQL
            const { error: createTableError } = await supabase.rpc('execute_sql', {
                sql_query: `
                    CREATE TABLE agent_zaps (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
                        name TEXT NOT NULL,
                        description TEXT NOT NULL,
                        webhook_url TEXT NOT NULL,
                        parameter_schema JSONB NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );
                    
                    -- Create index for faster lookups by agent_id
                    CREATE INDEX agent_zaps_agent_id_idx ON agent_zaps(agent_id);
                    
                    -- Create unique constraint on agent_id and name
                    ALTER TABLE agent_zaps ADD CONSTRAINT agent_zaps_agent_id_name_unique UNIQUE (agent_id, name);
                `
            });
            
            if (createTableError) {
                console.error('Error creating agent_zaps table:', createTableError);
                
                // Try alternative approach with direct SQL
                console.log('Trying alternative approach...');
                
                // We'll use the SQL API directly
                const { error: sqlError } = await supabase.rpc('execute_sql', {
                    sql_query: `
                        CREATE TABLE IF NOT EXISTS agent_zaps (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            agent_id UUID NOT NULL,
                            name TEXT NOT NULL,
                            description TEXT NOT NULL,
                            webhook_url TEXT NOT NULL,
                            parameter_schema JSONB NOT NULL,
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                            CONSTRAINT agent_zaps_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE,
                            CONSTRAINT agent_zaps_agent_id_name_unique UNIQUE (agent_id, name)
                        );
                        
                        CREATE INDEX IF NOT EXISTS agent_zaps_agent_id_idx ON agent_zaps(agent_id);
                    `
                });
                
                if (sqlError) {
                    console.error('Error with alternative approach:', sqlError);
                    console.log('⚠️ Could not create agent_zaps table. You may need to create it manually.');
                } else {
                    console.log('✅ Created agent_zaps table using alternative approach');
                }
            } else {
                console.log('✅ Created agent_zaps table');
            }
        }
        
        // Create a sample Zapier integration for testing
        console.log('Creating a sample Zapier integration for testing...');
        
        // First, get a valid agent ID
        const { data: agents, error: agentsError } = await supabase
            .from('ai_agents')
            .select('id')
            .limit(1);
            
        if (agentsError) {
            console.error('Error fetching agents:', agentsError);
        } else if (agents && agents.length > 0) {
            const agentId = agents[0].id;
            
            // Check if a sample already exists
            const { data: existingZaps, error: zapsError } = await supabase
                .from('agent_zaps')
                .select('id')
                .eq('agent_id', agentId)
                .eq('name', 'add_lead_to_crm')
                .limit(1);
                
            if (zapsError) {
                console.error('Error checking for existing zaps:', zapsError);
            } else if (existingZaps && existingZaps.length > 0) {
                console.log('✅ Sample Zapier integration already exists');
            } else {
                // Create a sample Zapier integration
                const { data: newZap, error: createZapError } = await supabase
                    .from('agent_zaps')
                    .insert([{
                        agent_id: agentId,
                        name: 'add_lead_to_crm',
                        description: 'Add a new lead to the CRM system with contact information and interest level',
                        webhook_url: 'https://hooks.zapier.com/hooks/catch/example/add-lead-to-crm/',
                        parameter_schema: {
                            type: 'object',
                            properties: {
                                first_name: { type: 'string', description: 'First name of the lead' },
                                last_name: { type: 'string', description: 'Last name of the lead' },
                                email: { type: 'string', description: 'Email address of the lead' },
                                phone: { type: 'string', description: 'Phone number of the lead' },
                                interest_level: { 
                                    type: 'string', 
                                    enum: ['high', 'medium', 'low'],
                                    description: 'Level of interest expressed by the lead' 
                                },
                                notes: { type: 'string', description: 'Additional notes from the conversation' }
                            },
                            required: ['first_name', 'last_name', 'email', 'interest_level']
                        }
                    }])
                    .select();
                    
                if (createZapError) {
                    console.error('Error creating sample Zapier integration:', createZapError);
                } else {
                    console.log('✅ Created sample Zapier integration with ID:', newZap[0].id);
                    
                    // Create a second sample
                    const { data: newZap2, error: createZap2Error } = await supabase
                        .from('agent_zaps')
                        .insert([{
                            agent_id: agentId,
                            name: 'send_slack_notification',
                            description: 'Send a notification to Slack about an important customer interaction',
                            webhook_url: 'https://hooks.zapier.com/hooks/catch/example/slack-notification/',
                            parameter_schema: {
                                type: 'object',
                                properties: {
                                    customer_name: { type: 'string', description: 'Name of the customer' },
                                    urgency: { 
                                        type: 'string', 
                                        enum: ['high', 'medium', 'low'],
                                        description: 'Urgency level of the notification' 
                                    },
                                    message: { type: 'string', description: 'Message to send to the team' },
                                    requires_followup: { type: 'boolean', description: 'Whether this requires follow-up' }
                                },
                                required: ['customer_name', 'urgency', 'message']
                            }
                        }])
                        .select();
                        
                    if (createZap2Error) {
                        console.error('Error creating second sample Zapier integration:', createZap2Error);
                    } else {
                        console.log('✅ Created second sample Zapier integration with ID:', newZap2[0].id);
                    }
                }
            }
        } else {
            console.log('⚠️ No agents found to create sample Zapier integration');
        }
        
        console.log('✅ Zapier integration database migration completed successfully!');
    } catch (error) {
        console.error('❌ Error in Zapier integration database migration:', error);
    }
}

runMigration().catch(console.error);