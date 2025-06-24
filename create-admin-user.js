#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration');
    console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function createAdminUser() {
    console.log('🚀 Creating admin user for AI Call Center...');
    
    const adminEmail = 'admin@aicallcenter.com';
    const adminPassword = 'admin123!';
    
    try {
        // Create the user
        console.log('📧 Creating user account...');
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: adminEmail,
            password: adminPassword,
            email_confirm: true,
            user_metadata: {
                role: 'admin',
                name: 'Admin User'
            }
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                console.log('✅ Admin user already exists');
                console.log('📧 Email:', adminEmail);
                console.log('🔑 Password:', adminPassword);
                return;
            }
            throw authError;
        }

        console.log('✅ Admin user created successfully!');
        console.log('📧 Email:', adminEmail);
        console.log('🔑 Password:', adminPassword);
        console.log('🆔 User ID:', authData.user.id);

        // Create user profile
        console.log('👤 Creating user profile...');
        const { error: profileError } = await supabase
            .from('users')
            .insert({
                id: authData.user.id,
                email: adminEmail,
                role: 'admin',
                subscription_plan: 'enterprise',
                minutes_limit: 10000,
                max_agents: 50,
                allowed_features: ['all']
            });

        if (profileError && !profileError.message.includes('duplicate key')) {
            console.warn('⚠️ Profile creation warning:', profileError.message);
        } else {
            console.log('✅ User profile created');
        }

        console.log('\n🎉 Setup Complete!');
        console.log('🌐 Access the dashboard at: http://localhost:12000');
        console.log('📧 Login with: admin@aicallcenter.com');
        console.log('🔑 Password: admin123!');

    } catch (error) {
        console.error('❌ Error creating admin user:', error.message);
        process.exit(1);
    }
}

createAdminUser();