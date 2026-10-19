CREATE TABLE public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT 'friendkt@yahoo.com',
  phone TEXT NOT NULL DEFAULT '+91 9783160761',
  website TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agencies TO authenticated;
GRANT ALL ON public.agencies TO service_role;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency owners manage their agencies" ON public.agencies FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.review_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  platform_type TEXT NOT NULL CHECK (platform_type IN ('routard', 'tripadvisor', 'custom')),
  display_name TEXT NOT NULL,
  profile_url TEXT,
  review_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agency_id, platform_type),
  CHECK (profile_url IS NULL OR profile_url ~* '^https://[^/[:space:]?#@]+([/?#][^[:space:]]*)?$'),
  CHECK (review_url IS NULL OR review_url ~* '^https://[^/[:space:]?#@]+([/?#][^[:space:]]*)?$')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_platforms TO authenticated;
GRANT ALL ON public.review_platforms TO service_role;
ALTER TABLE public.review_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency owners manage their review platforms" ON public.review_platforms FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.agencies WHERE agencies.id = review_platforms.agency_id AND agencies.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.agencies WHERE agencies.id = review_platforms.agency_id AND agencies.owner_id = auth.uid()));

CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency owners manage their campaigns" ON public.campaigns FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.agencies WHERE agencies.id = campaigns.agency_id AND agencies.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.agencies WHERE agencies.id = campaigns.agency_id AND agencies.owner_id = auth.uid()));

CREATE TABLE public.qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES public.review_platforms(id) ON DELETE RESTRICT,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  unique_code TEXT NOT NULL UNIQUE CHECK (unique_code ~ '^[a-zA-Z0-9_-]{8,48}$'),
  qr_type TEXT NOT NULL DEFAULT 'tracked' CHECK (qr_type IN ('tracked', 'direct')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_codes TO authenticated;
GRANT ALL ON public.qr_codes TO service_role;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency owners manage their QR codes" ON public.qr_codes FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.agencies WHERE agencies.id = qr_codes.agency_id AND agencies.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.agencies WHERE agencies.id = qr_codes.agency_id AND agencies.owner_id = auth.uid()));

CREATE TABLE public.scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id UUID NOT NULL REFERENCES public.qr_codes(id) ON DELETE CASCADE,
  device_category TEXT NOT NULL DEFAULT 'unknown' CHECK (device_category IN ('mobile', 'desktop', 'tablet', 'unknown')),
  referrer_host TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scan_events TO authenticated;
GRANT ALL ON public.scan_events TO service_role;
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency owners can read scan events" ON public.scan_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.qr_codes JOIN public.agencies ON agencies.id = qr_codes.agency_id WHERE qr_codes.id = scan_events.qr_code_id AND agencies.owner_id = auth.uid()));
CREATE INDEX scan_events_qr_code_created_at_idx ON public.scan_events (qr_code_id, created_at DESC);
CREATE INDEX campaigns_agency_status_idx ON public.campaigns (agency_id, status);
CREATE INDEX qr_codes_agency_created_at_idx ON public.qr_codes (agency_id, created_at DESC);

CREATE TABLE public.review_card_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Thank you card',
  headline TEXT NOT NULL DEFAULT 'Thank you for travelling with us!',
  body_text TEXT NOT NULL DEFAULT E'We hope you enjoyed your trip.\n\nYour feedback helps other travellers discover great experiences.\n\nScan the QR code below to share your honest experience.\n\nThank you for your support!',
  platform_id UUID REFERENCES public.review_platforms(id) ON DELETE SET NULL,
  orientation TEXT NOT NULL DEFAULT 'portrait' CHECK (orientation IN ('portrait', 'landscape')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_card_templates TO authenticated;
GRANT ALL ON public.review_card_templates TO service_role;
ALTER TABLE public.review_card_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency owners manage their review card templates" ON public.review_card_templates FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.agencies WHERE agencies.id = review_card_templates.agency_id AND agencies.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.agencies WHERE agencies.id = review_card_templates.agency_id AND agencies.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.record_review_scan(_code TEXT, _device_category TEXT DEFAULT 'unknown', _referrer_host TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  matched_qr_id UUID;
  destination TEXT;
BEGIN
  SELECT qr_codes.id, review_platforms.review_url
    INTO matched_qr_id, destination
    FROM public.qr_codes
    JOIN public.review_platforms ON review_platforms.id = qr_codes.platform_id
    JOIN public.agencies ON agencies.id = qr_codes.agency_id
   WHERE qr_codes.unique_code = _code
     AND qr_codes.status = 'active'
     AND (qr_codes.expires_at IS NULL OR qr_codes.expires_at > now())
     AND review_platforms.enabled = true
     AND review_platforms.verification_status = 'verified'
     AND review_platforms.review_url IS NOT NULL;

  IF destination IS NULL OR matched_qr_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.scan_events (qr_code_id, device_category, referrer_host)
  VALUES (
    matched_qr_id,
    CASE WHEN _device_category IN ('mobile', 'desktop', 'tablet') THEN _device_category ELSE 'unknown' END,
    CASE WHEN _referrer_host IS NULL OR length(_referrer_host) > 255 THEN NULL ELSE _referrer_host END
  );

  RETURN destination;
END;
$$;
REVOKE ALL ON FUNCTION public.record_review_scan(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_review_scan(TEXT, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_initial_review_agency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_agency_id UUID;
BEGIN
  INSERT INTO public.agencies (owner_id, email, phone)
  VALUES (NEW.id, 'friendkt@yahoo.com', '+91 9783160761')
  RETURNING id INTO new_agency_id;

  INSERT INTO public.review_platforms (agency_id, platform_type, display_name)
  VALUES
    (new_agency_id, 'routard', 'Routard.fr'),
    (new_agency_id, 'tripadvisor', 'Tripadvisor'),
    (new_agency_id, 'custom', 'Custom review URL');

  INSERT INTO public.review_card_templates (agency_id)
  VALUES (new_agency_id);

  RETURN NEW;
END;
$$;
CREATE TRIGGER create_initial_review_agency_after_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_initial_review_agency();