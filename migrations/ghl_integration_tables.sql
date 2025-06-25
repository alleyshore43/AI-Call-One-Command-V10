-- Safe, non-destructive SQL for creating GoHighLevel integration tables

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