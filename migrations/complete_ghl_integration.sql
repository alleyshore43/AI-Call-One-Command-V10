-- Complete SQL for GoHighLevel integration
-- Safe, non-destructive SQL that checks if tables exist before creating them

-- Check if uuid-ossp extension is available and enable it if not already enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
    ) THEN
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    END IF;
END
$$;

-- Create integrations table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'integrations'
    ) THEN
        CREATE TABLE public.integrations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL,
            type VARCHAR(50) NOT NULL,
            credentials JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(user_id, type)
        );
        
        -- Create indexes for integrations table
        CREATE INDEX idx_integrations_user_id ON public.integrations(user_id);
        CREATE INDEX idx_integrations_type ON public.integrations(type);
        
        -- Enable RLS for integrations table
        ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
        
        -- Create RLS policies for integrations table
        CREATE POLICY "Users can view their own integrations" 
            ON public.integrations FOR SELECT 
            USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can insert their own integrations" 
            ON public.integrations FOR INSERT 
            WITH CHECK (auth.uid() = user_id);
        
        CREATE POLICY "Users can update their own integrations" 
            ON public.integrations FOR UPDATE 
            USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can delete their own integrations" 
            ON public.integrations FOR DELETE 
            USING (auth.uid() = user_id);
    END IF;
END
$$;

-- Create integration_settings table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'integration_settings'
    ) THEN
        CREATE TABLE public.integration_settings (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            integration_id UUID NOT NULL,
            settings JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Add foreign key only if integrations table exists
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'integrations'
        ) THEN
            ALTER TABLE public.integration_settings 
            ADD CONSTRAINT fk_integration_settings_integration_id 
            FOREIGN KEY (integration_id) 
            REFERENCES public.integrations(id) 
            ON DELETE CASCADE;
        END IF;
        
        -- Create index for integration_settings table
        CREATE INDEX idx_integration_settings_integration_id 
        ON public.integration_settings(integration_id);
        
        -- Enable RLS for integration_settings table
        ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
        
        -- Create RLS policies for integration_settings table
        CREATE POLICY "Users can view their own integration settings" 
            ON public.integration_settings FOR SELECT 
            USING (EXISTS (
                SELECT 1 FROM public.integrations 
                WHERE integrations.id = integration_settings.integration_id 
                AND integrations.user_id = auth.uid()
            ));
        
        CREATE POLICY "Users can insert their own integration settings" 
            ON public.integration_settings FOR INSERT 
            WITH CHECK (EXISTS (
                SELECT 1 FROM public.integrations 
                WHERE integrations.id = integration_settings.integration_id 
                AND integrations.user_id = auth.uid()
            ));
        
        CREATE POLICY "Users can update their own integration settings" 
            ON public.integration_settings FOR UPDATE 
            USING (EXISTS (
                SELECT 1 FROM public.integrations 
                WHERE integrations.id = integration_settings.integration_id 
                AND integrations.user_id = auth.uid()
            ));
        
        CREATE POLICY "Users can delete their own integration settings" 
            ON public.integration_settings FOR DELETE 
            USING (EXISTS (
                SELECT 1 FROM public.integrations 
                WHERE integrations.id = integration_settings.integration_id 
                AND integrations.user_id = auth.uid()
            ));
    END IF;
END
$$;

-- Create ghl_function_calls table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'ghl_function_calls'
    ) THEN
        CREATE TABLE public.ghl_function_calls (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            profile_id UUID NOT NULL,
            function_name TEXT NOT NULL,
            parameters JSONB NOT NULL,
            result JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes for ghl_function_calls table
        CREATE INDEX idx_ghl_function_calls_profile_id ON public.ghl_function_calls(profile_id);
        CREATE INDEX idx_ghl_function_calls_function_name ON public.ghl_function_calls(function_name);
        
        -- Enable RLS for ghl_function_calls table
        ALTER TABLE public.ghl_function_calls ENABLE ROW LEVEL SECURITY;
        
        -- Create RLS policies for ghl_function_calls table
        CREATE POLICY "Users can view their own function calls" 
            ON public.ghl_function_calls FOR SELECT 
            USING (auth.uid() = profile_id);
        
        CREATE POLICY "Users can insert their own function calls" 
            ON public.ghl_function_calls FOR INSERT 
            WITH CHECK (auth.uid() = profile_id);
        
        CREATE POLICY "Users can update their own function calls" 
            ON public.ghl_function_calls FOR UPDATE 
            USING (auth.uid() = profile_id);
        
        CREATE POLICY "Users can delete their own function calls" 
            ON public.ghl_function_calls FOR DELETE 
            USING (auth.uid() = profile_id);
    END IF;
END
$$;

-- Create ghl_contacts table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'ghl_contacts'
    ) THEN
        CREATE TABLE public.ghl_contacts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            integration_id UUID NOT NULL,
            ghl_contact_id VARCHAR(100) NOT NULL,
            contact_data JSONB NOT NULL,
            last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(integration_id, ghl_contact_id)
        );
        
        -- Add foreign key only if integrations table exists
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'integrations'
        ) THEN
            ALTER TABLE public.ghl_contacts 
            ADD CONSTRAINT fk_ghl_contacts_integration_id 
            FOREIGN KEY (integration_id) 
            REFERENCES public.integrations(id) 
            ON DELETE CASCADE;
        END IF;
        
        -- Create index for ghl_contacts table
        CREATE INDEX idx_ghl_contacts_integration_id ON public.ghl_contacts(integration_id);
        
        -- Enable RLS for ghl_contacts table
        ALTER TABLE public.ghl_contacts ENABLE ROW LEVEL SECURITY;
        
        -- Create RLS policies for ghl_contacts table
        CREATE POLICY "Users can view their own GHL contacts" 
            ON public.ghl_contacts FOR SELECT 
            USING (EXISTS (
                SELECT 1 FROM public.integrations 
                WHERE integrations.id = ghl_contacts.integration_id 
                AND integrations.user_id = auth.uid()
            ));
        
        CREATE POLICY "Users can insert their own GHL contacts" 
            ON public.ghl_contacts FOR INSERT 
            WITH CHECK (EXISTS (
                SELECT 1 FROM public.integrations 
                WHERE integrations.id = ghl_contacts.integration_id 
                AND integrations.user_id = auth.uid()
            ));
        
        CREATE POLICY "Users can update their own GHL contacts" 
            ON public.ghl_contacts FOR UPDATE 
            USING (EXISTS (
                SELECT 1 FROM public.integrations 
                WHERE integrations.id = ghl_contacts.integration_id 
                AND integrations.user_id = auth.uid()
            ));
        
        CREATE POLICY "Users can delete their own GHL contacts" 
            ON public.ghl_contacts FOR DELETE 
            USING (EXISTS (
                SELECT 1 FROM public.integrations 
                WHERE integrations.id = ghl_contacts.integration_id 
                AND integrations.user_id = auth.uid()
            ));
    END IF;
END
$$;