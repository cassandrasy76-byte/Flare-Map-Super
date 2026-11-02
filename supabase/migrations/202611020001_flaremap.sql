
-- FLAREMAP DATABASE SETUP

-- 1. ADMIN USERS
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view the admin list.
CREATE POLICY "Admins can view admin users"
ON public.admin_users
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.admin_users AS admins
        WHERE admins.id = auth.uid()
    )
);

-- 2. ALARM EVENTS / INCIDENT REPORTS
CREATE TABLE IF NOT EXISTS public.alarm_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location TEXT NOT NULL,
    incident_type TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'reported'
        CHECK (status IN ('reported', 'investigating', 'resolved')),
    is_test BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.alarm_events ENABLE ROW LEVEL SECURITY;

-- Signed-in users can submit reports.
CREATE POLICY "Authenticated users can submit reports"
ON public.alarm_events
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = created_by
    AND is_test = FALSE
);

-- Signed-in users can read reports.
CREATE POLICY "Authenticated users can view reports"
ON public.alarm_events
FOR SELECT
TO authenticated
USING (TRUE);

-- Only admins can update reports.
CREATE POLICY "Admins can update reports"
ON public.alarm_events
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE id = auth.uid()
    )
);

-- 3. PUSH SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    subscription JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can add their own push subscriptions"
ON public.push_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own push subscriptions"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions"
ON public.push_subscriptions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. ENABLE REALTIME FOR INCIDENT REPORTS
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime
    ADD TABLE public.alarm_events;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
