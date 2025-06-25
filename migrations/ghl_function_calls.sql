-- Safe, non-destructive SQL for creating GoHighLevel function calls table

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