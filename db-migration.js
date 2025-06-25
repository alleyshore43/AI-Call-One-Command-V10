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
    console.log('🔄 Running database migration...');
    
    try {
        // 1. Add routing_type column to ai_agents table if it doesn't exist
        console.log('Adding routing_type column to ai_agents table...');
        const { error: routingTypeError } = await supabase.rpc('add_column_if_not_exists', {
            table_name: 'ai_agents',
            column_name: 'routing_type',
            column_type: 'text',
            column_default: "'direct'"
        });
        
        if (routingTypeError) {
            console.error('Error adding routing_type column:', routingTypeError);
            // Try alternative approach
            const { error: alterTableError } = await supabase.rpc('execute_sql', {
                sql_query: "ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS routing_type TEXT DEFAULT 'direct'"
            });
            
            if (alterTableError) {
                console.error('Error with alternative approach:', alterTableError);
                console.log('⚠️ Could not add routing_type column. You may need to add it manually.');
            } else {
                console.log('✅ Added routing_type column using alternative approach');
            }
        } else {
            console.log('✅ Added routing_type column');
        }
        
        // 2. Add forward_number column to ai_agents table if it doesn't exist
        console.log('Adding forward_number column to ai_agents table...');
        const { error: forwardNumberError } = await supabase.rpc('add_column_if_not_exists', {
            table_name: 'ai_agents',
            column_name: 'forward_number',
            column_type: 'text',
            column_default: "NULL"
        });
        
        if (forwardNumberError) {
            console.error('Error adding forward_number column:', forwardNumberError);
            // Try alternative approach
            const { error: alterTableError } = await supabase.rpc('execute_sql', {
                sql_query: "ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS forward_number TEXT"
            });
            
            if (alterTableError) {
                console.error('Error with alternative approach:', alterTableError);
                console.log('⚠️ Could not add forward_number column. You may need to add it manually.');
            } else {
                console.log('✅ Added forward_number column using alternative approach');
            }
        } else {
            console.log('✅ Added forward_number column');
        }
        
        // 3. Add ivr_menu_id column to ai_agents table if it doesn't exist
        console.log('Adding ivr_menu_id column to ai_agents table...');
        const { error: ivrMenuIdError } = await supabase.rpc('add_column_if_not_exists', {
            table_name: 'ai_agents',
            column_name: 'ivr_menu_id',
            column_type: 'uuid',
            column_default: "NULL"
        });
        
        if (ivrMenuIdError) {
            console.error('Error adding ivr_menu_id column:', ivrMenuIdError);
            // Try alternative approach
            const { error: alterTableError } = await supabase.rpc('execute_sql', {
                sql_query: "ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS ivr_menu_id UUID"
            });
            
            if (alterTableError) {
                console.error('Error with alternative approach:', alterTableError);
                console.log('⚠️ Could not add ivr_menu_id column. You may need to add it manually.');
            } else {
                console.log('✅ Added ivr_menu_id column using alternative approach');
            }
        } else {
            console.log('✅ Added ivr_menu_id column');
        }
        
        // 4. Create ivr_menus table if it doesn't exist
        console.log('Creating ivr_menus table if it doesn\'t exist...');
        const { error: createIvrMenusError } = await supabase.rpc('execute_sql', {
            sql_query: `
                CREATE TABLE IF NOT EXISTS ivr_menus (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name TEXT NOT NULL,
                    greeting_text TEXT NOT NULL,
                    timeout_message TEXT,
                    invalid_message TEXT,
                    max_attempts INTEGER DEFAULT 3,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `
        });
        
        if (createIvrMenusError) {
            console.error('Error creating ivr_menus table:', createIvrMenusError);
            console.log('⚠️ Could not create ivr_menus table. You may need to create it manually.');
        } else {
            console.log('✅ Created ivr_menus table');
        }
        
        // 5. Create ivr_options table if it doesn't exist
        console.log('Creating ivr_options table if it doesn\'t exist...');
        const { error: createIvrOptionsError } = await supabase.rpc('execute_sql', {
            sql_query: `
                CREATE TABLE IF NOT EXISTS ivr_options (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    ivr_menu_id UUID NOT NULL REFERENCES ivr_menus(id) ON DELETE CASCADE,
                    digit TEXT NOT NULL,
                    description TEXT,
                    agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    UNIQUE(ivr_menu_id, digit)
                );
            `
        });
        
        if (createIvrOptionsError) {
            console.error('Error creating ivr_options table:', createIvrOptionsError);
            console.log('⚠️ Could not create ivr_options table. You may need to create it manually.');
        } else {
            console.log('✅ Created ivr_options table');
        }
        
        // 6. Create a sample IVR menu for testing
        console.log('Creating a sample IVR menu for testing...');
        
        // First, check if we already have a sample menu
        const { data: existingMenus, error: checkMenuError } = await supabase
            .from('ivr_menus')
            .select('*')
            .eq('name', 'Sample IVR Menu')
            .limit(1);
            
        if (checkMenuError) {
            console.error('Error checking for existing menus:', checkMenuError);
        } else if (existingMenus && existingMenus.length > 0) {
            console.log('✅ Sample IVR menu already exists');
        } else {
            // Create a sample menu
            const { data: newMenu, error: createMenuError } = await supabase
                .from('ivr_menus')
                .insert([{
                    name: 'Sample IVR Menu',
                    greeting_text: 'Thank you for calling. Press 1 for sales, press 2 for support, or press 0 to speak with a general assistant.',
                    timeout_message: 'I didn\'t hear your selection. Let me connect you with our general assistant.',
                    invalid_message: 'That\'s not a valid option. Let me connect you with our general assistant.',
                    max_attempts: 3
                }])
                .select()
                .single();
                
            if (createMenuError) {
                console.error('Error creating sample IVR menu:', createMenuError);
            } else if (newMenu) {
                console.log('✅ Created sample IVR menu with ID:', newMenu.id);
                
                // Get some agents to use for the options
                const { data: agents, error: agentsError } = await supabase
                    .from('ai_agents')
                    .select('id, agent_type')
                    .limit(3);
                    
                if (agentsError) {
                    console.error('Error fetching agents:', agentsError);
                } else if (agents && agents.length > 0) {
                    // Create sample options
                    const options = [];
                    
                    // Option 1: Sales
                    const salesAgent = agents.find(a => a.agent_type === 'sales') || agents[0];
                    options.push({
                        ivr_menu_id: newMenu.id,
                        digit: '1',
                        description: 'Sales Department',
                        agent_id: salesAgent.id
                    });
                    
                    // Option 2: Support
                    const supportAgent = agents.find(a => a.agent_type === 'support') || 
                                        agents.find(a => a.agent_type === 'customer_service') || 
                                        agents[agents.length > 1 ? 1 : 0];
                    options.push({
                        ivr_menu_id: newMenu.id,
                        digit: '2',
                        description: 'Support Department',
                        agent_id: supportAgent.id
                    });
                    
                    // Option 0: General
                    const generalAgent = agents.find(a => a.agent_type === 'general') || 
                                        agents[agents.length > 2 ? 2 : 0];
                    options.push({
                        ivr_menu_id: newMenu.id,
                        digit: '0',
                        description: 'General Assistance',
                        agent_id: generalAgent.id
                    });
                    
                    // Insert the options
                    const { error: optionsError } = await supabase
                        .from('ivr_options')
                        .insert(options);
                        
                    if (optionsError) {
                        console.error('Error creating sample IVR options:', optionsError);
                    } else {
                        console.log('✅ Created sample IVR options');
                    }
                    
                    // Update one of the agents to use this IVR menu
                    const { error: updateAgentError } = await supabase
                        .from('ai_agents')
                        .update({ 
                            routing_type: 'ivr',
                            ivr_menu_id: newMenu.id
                        })
                        .eq('id', agents[0].id);
                        
                    if (updateAgentError) {
                        console.error('Error updating agent with IVR menu:', updateAgentError);
                    } else {
                        console.log(`✅ Updated agent ${agents[0].id} to use the sample IVR menu`);
                    }
                }
            }
        }
        
        console.log('✅ Database migration completed successfully!');
    } catch (error) {
        console.error('❌ Error in database migration:', error);
    }
}

runMigration().catch(console.error);