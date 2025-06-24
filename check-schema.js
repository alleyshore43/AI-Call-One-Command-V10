#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkSchema() {
    console.log('🔍 Checking ai_agents table schema...');
    
    // Try to create a very minimal agent to see what columns exist
    const minimalAgent = {
        name: 'Test Agent',
        agent_type: 'general',
        voice_name: 'Puck',
        language_code: 'en-US',
        is_active: true,
        max_concurrent_calls: 1,
        profile_id: randomUUID()
    };

    console.log('Attempting to create minimal agent...');
    try {
        const { data, error } = await supabase
            .from('ai_agents')
            .insert(minimalAgent)
            .select()
            .single();

        if (error) {
            console.log('❌ Error:', error.message);
            
            // Try even more minimal
            const superMinimal = {
                name: 'Test Agent',
                profile_id: randomUUID()
            };
            
            console.log('Trying super minimal agent...');
            const { data: data2, error: error2 } = await supabase
                .from('ai_agents')
                .insert(superMinimal)
                .select()
                .single();
                
            if (error2) {
                console.log('❌ Super minimal error:', error2.message);
            } else {
                console.log('✅ Super minimal success! Available columns:', Object.keys(data2));
                await supabase.from('ai_agents').delete().eq('id', data2.id);
            }
        } else {
            console.log('✅ Success! Available columns:', Object.keys(data));
            console.log('📋 Agent data:', data);
            // Clean up
            await supabase.from('ai_agents').delete().eq('id', data.id);
            console.log('🧹 Test agent cleaned up');
        }
    } catch (err) {
        console.error('💥 Unexpected error:', err);
    }
}

checkSchema().catch(console.error);