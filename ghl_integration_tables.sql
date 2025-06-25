-- Create integrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    credentials JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, type)
);

-- Create integration_settings table if it doesn't exist
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

-- Insert test data for the user from the CSV file
INSERT INTO public.integrations (user_id, type, credentials)
VALUES (
    '5d5f69d3-0cb7-42db-9b10-1246da9c4c22',
    'GHL',
    '{"api_key": "test-api-key", "location_id": "test-location-id"}'
)
ON CONFLICT (user_id, type) 
DO UPDATE SET 
    credentials = '{"api_key": "test-api-key", "location_id": "test-location-id"}',
    updated_at = NOW();

-- Insert a test contact
INSERT INTO public.ghl_contacts (
    integration_id,
    ghl_contact_id,
    contact_data
)
SELECT 
    id,
    'test-contact-123',
    '{"name": "Test Contact", "email": "gamblerspassion@gmail.com", "phone": "+15551234567"}'
FROM 
    public.integrations
WHERE 
    user_id = '5d5f69d3-0cb7-42db-9b10-1246da9c4c22'
    AND type = 'GHL'
ON CONFLICT DO NOTHING;

-- Insert a test opportunity
INSERT INTO public.ghl_opportunities (
    integration_id,
    ghl_opportunity_id,
    opportunity_data
)
SELECT 
    id,
    'test-opportunity-123',
    '{"title": "Test Opportunity", "value": 1000, "status": "open"}'
FROM 
    public.integrations
WHERE 
    user_id = '5d5f69d3-0cb7-42db-9b10-1246da9c4c22'
    AND type = 'GHL'
ON CONFLICT DO NOTHING;

-- Insert a test appointment
INSERT INTO public.ghl_appointments (
    integration_id,
    ghl_appointment_id,
    appointment_data
)
SELECT 
    id,
    'test-appointment-123',
    '{"title": "Test Appointment", "start_time": "2025-07-01T10:00:00Z", "end_time": "2025-07-01T11:00:00Z"}'
FROM 
    public.integrations
WHERE 
    user_id = '5d5f69d3-0cb7-42db-9b10-1246da9c4c22'
    AND type = 'GHL'
ON CONFLICT DO NOTHING;