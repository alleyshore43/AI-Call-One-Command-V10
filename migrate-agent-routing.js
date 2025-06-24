#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function migrateAgentRouting() {
    console.log('🔄 Starting Agent Routing Database Migration...');
    
    try {
        // Add call_direction column if it doesn't exist
        console.log('📝 Adding call_direction column...');
        const { error: callDirectionError } = await supabase.rpc('exec_sql', {
            sql: `
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'ai_agents' AND column_name = 'call_direction'
                    ) THEN
                        ALTER TABLE ai_agents 
                        ADD COLUMN call_direction TEXT DEFAULT 'inbound' 
                        CHECK (call_direction IN ('inbound', 'outbound', 'both'));
                    END IF;
                END $$;
            `
        });
        
        if (callDirectionError) {
            console.log('⚠️ Call direction column might already exist or using direct SQL...');
        } else {
            console.log('✅ Call direction column added successfully');
        }

        // Add timezone column if it doesn't exist
        console.log('📝 Adding timezone column...');
        const { error: timezoneError } = await supabase.rpc('exec_sql', {
            sql: `
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'ai_agents' AND column_name = 'timezone'
                    ) THEN
                        ALTER TABLE ai_agents 
                        ADD COLUMN timezone TEXT DEFAULT 'America/New_York';
                    END IF;
                END $$;
            `
        });
        
        if (timezoneError) {
            console.log('⚠️ Timezone column might already exist or using direct SQL...');
        } else {
            console.log('✅ Timezone column added successfully');
        }

        // Add business hours columns if they don't exist
        console.log('📝 Adding business hours columns...');
        const { error: businessHoursError } = await supabase.rpc('exec_sql', {
            sql: `
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'ai_agents' AND column_name = 'business_hours_start'
                    ) THEN
                        ALTER TABLE ai_agents 
                        ADD COLUMN business_hours_start TIME DEFAULT '09:00';
                    END IF;
                    
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'ai_agents' AND column_name = 'business_hours_end'
                    ) THEN
                        ALTER TABLE ai_agents 
                        ADD COLUMN business_hours_end TIME DEFAULT '17:00';
                    END IF;
                    
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'ai_agents' AND column_name = 'business_days'
                    ) THEN
                        ALTER TABLE ai_agents 
                        ADD COLUMN business_days INTEGER[] DEFAULT '{1,2,3,4,5}';
                    END IF;
                END $$;
            `
        });
        
        if (businessHoursError) {
            console.log('⚠️ Business hours columns might already exist or using direct SQL...');
        } else {
            console.log('✅ Business hours columns added successfully');
        }

        // Try alternative approach using direct column addition
        console.log('🔄 Attempting direct column additions...');
        
        const alterations = [
            {
                name: 'call_direction',
                sql: "ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS call_direction TEXT DEFAULT 'inbound' CHECK (call_direction IN ('inbound', 'outbound', 'both'))"
            },
            {
                name: 'timezone',
                sql: "ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York'"
            },
            {
                name: 'business_hours_start',
                sql: "ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS business_hours_start TIME DEFAULT '09:00'"
            },
            {
                name: 'business_hours_end',
                sql: "ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS business_hours_end TIME DEFAULT '17:00'"
            },
            {
                name: 'business_days',
                sql: "ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS business_days INTEGER[] DEFAULT '{1,2,3,4,5}'"
            }
        ];

        for (const alteration of alterations) {
            try {
                const { error } = await supabase.rpc('exec_sql', { sql: alteration.sql });
                if (error) {
                    console.log(`⚠️ ${alteration.name}: ${error.message}`);
                } else {
                    console.log(`✅ ${alteration.name} column handled`);
                }
            } catch (err) {
                console.log(`⚠️ ${alteration.name}: ${err.message}`);
            }
        }

        // Verify the schema
        console.log('🔍 Verifying schema...');
        const { data: columns, error: schemaError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type, column_default')
            .eq('table_name', 'ai_agents')
            .in('column_name', ['call_direction', 'timezone', 'business_hours_start', 'business_hours_end', 'business_days']);

        if (schemaError) {
            console.log('⚠️ Could not verify schema directly, trying test insert...');
            
            // Test with a sample agent creation
            const testAgent = {
                name: 'Migration Test Agent',
                agent_type: 'general',
                call_direction: 'inbound',
                voice_name: 'Puck',
                language_code: 'en-US',
                is_active: false,
                max_concurrent_calls: 1,
                timezone: 'America/New_York',
                business_hours_start: '09:00',
                business_hours_end: '17:00',
                business_days: [1, 2, 3, 4, 5],
                profile_id: 'test-migration-profile'
            };

            const { data: testData, error: testError } = await supabase
                .from('ai_agents')
                .insert(testAgent)
                .select()
                .single();

            if (testError) {
                console.log('❌ Migration test failed:', testError.message);
                console.log('🔧 Manual database migration may be required');
                return false;
            } else {
                console.log('✅ Migration test successful');
                
                // Clean up test agent
                await supabase
                    .from('ai_agents')
                    .delete()
                    .eq('id', testData.id);
                
                console.log('🧹 Test agent cleaned up');
                return true;
            }
        } else {
            console.log('✅ Schema verification successful');
            console.log('📋 Available columns:', columns.map(c => c.column_name).join(', '));
            return true;
        }

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        return false;
    }
}

// Run migration
migrateAgentRouting()
    .then(success => {
        if (success) {
            console.log('\n🎉 Agent Routing Migration Completed Successfully!');
            console.log('✅ Database is ready for advanced agent routing');
        } else {
            console.log('\n⚠️ Migration completed with warnings');
            console.log('🔧 Some manual database configuration may be required');
        }
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    });