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

-- Create integration_logs table for tracking API calls and events
CREATE TABLE IF NOT EXISTS public.integration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    request_data JSONB,
    response_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create GHL contacts table to store synced contacts
CREATE TABLE IF NOT EXISTS public.ghl_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
    ghl_contact_id VARCHAR(100) NOT NULL,
    contact_data JSONB NOT NULL,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(integration_id, ghl_contact_id)
);

-- Create GHL opportunities table to store synced opportunities
CREATE TABLE IF NOT EXISTS public.ghl_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
    ghl_opportunity_id VARCHAR(100) NOT NULL,
    opportunity_data JSONB NOT NULL,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(integration_id, ghl_opportunity_id)
);

-- Create GHL appointments table to store synced appointments
CREATE TABLE IF NOT EXISTS public.ghl_appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
    ghl_appointment_id VARCHAR(100) NOT NULL,
    appointment_data JSONB NOT NULL,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(integration_id, ghl_appointment_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON public.integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON public.integrations(type);
CREATE INDEX IF NOT EXISTS idx_integration_settings_integration_id ON public.integration_settings(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_integration_id ON public.integration_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_event_type ON public.integration_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_integration_id ON public.ghl_contacts(integration_id);
CREATE INDEX IF NOT EXISTS idx_ghl_opportunities_integration_id ON public.ghl_opportunities(integration_id);
CREATE INDEX IF NOT EXISTS idx_ghl_appointments_integration_id ON public.ghl_appointments(integration_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_appointments ENABLE ROW LEVEL SECURITY;

-- Create policies for integrations table
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

-- Create policies for integration_settings table
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

-- Create similar policies for the other tables
-- (Abbreviated for brevity, but follow the same pattern as above)