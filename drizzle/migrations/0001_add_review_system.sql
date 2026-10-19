-- Categories table (hotel, restaurant, cafe, shop, etc.)
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'store',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agency_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

-- Review templates (pre-written reviews for each category)
CREATE TABLE public.review_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 150),
  content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 10 AND 1000),
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_templates TO authenticated;
GRANT ALL ON public.review_templates TO service_role;

-- Submitted reviews (from users who scanned QR)
CREATE TABLE public.submitted_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  qr_code_id UUID REFERENCES public.qr_codes(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.review_templates(id) ON DELETE SET NULL,
  reviewer_name TEXT DEFAULT 'Anonymous',
  reviewer_email TEXT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT NOT NULL CHECK (length(trim(review_text)) BETWEEN 1 AND 2000),
  is_custom BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  device_category TEXT DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submitted_reviews TO authenticated;
GRANT ALL ON public.submitted_reviews TO service_role;
-- Allow anonymous users to insert reviews (when scanning QR)
GRANT INSERT ON public.submitted_reviews TO anon;

-- Add category_id to qr_codes table
ALTER TABLE public.qr_codes ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX categories_agency_idx ON public.categories (agency_id);
CREATE INDEX review_templates_category_idx ON public.review_templates (category_id, is_active);
CREATE INDEX submitted_reviews_agency_idx ON public.submitted_reviews (agency_id, created_at DESC);
CREATE INDEX submitted_reviews_status_idx ON public.submitted_reviews (agency_id, status);

-- Function to get random review templates for a category
CREATE OR REPLACE FUNCTION public.get_random_templates(_category_id UUID, _limit INTEGER DEFAULT 3)
RETURNS SETOF public.review_templates
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.review_templates 
  WHERE category_id = _category_id AND is_active = true
  ORDER BY random()
  LIMIT _limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_random_templates(UUID, INTEGER) TO anon, authenticated;

-- Function to submit a review (accessible by anyone scanning QR)
CREATE OR REPLACE FUNCTION public.submit_review(
  _qr_code TEXT,
  _rating INTEGER,
  _review_text TEXT,
  _template_id UUID DEFAULT NULL,
  _reviewer_name TEXT DEFAULT 'Anonymous',
  _reviewer_email TEXT DEFAULT NULL,
  _device_category TEXT DEFAULT 'unknown'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  qr_record RECORD;
  new_review_id UUID;
BEGIN
  -- Find the QR code and get agency/category info
  SELECT qr.id as qr_id, qr.agency_id, qr.category_id
  INTO qr_record
  FROM public.qr_codes qr
  WHERE qr.unique_code = _qr_code
    AND qr.status = 'active'
    AND (qr.expires_at IS NULL OR qr.expires_at > now());

  IF qr_record.qr_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Insert the review
  INSERT INTO public.submitted_reviews (
    agency_id,
    qr_code_id,
    category_id,
    template_id,
    reviewer_name,
    reviewer_email,
    rating,
    review_text,
    is_custom,
    device_category
  ) VALUES (
    qr_record.agency_id,
    qr_record.qr_id,
    qr_record.category_id,
    _template_id,
    COALESCE(NULLIF(trim(_reviewer_name), ''), 'Anonymous'),
    NULLIF(trim(_reviewer_email), ''),
    _rating,
    trim(_review_text),
    _template_id IS NULL,
    CASE WHEN _device_category IN ('mobile', 'desktop', 'tablet') THEN _device_category ELSE 'unknown' END
  )
  RETURNING id INTO new_review_id;

  RETURN new_review_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_review(TEXT, INTEGER, TEXT, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Function to get QR code details for review page
CREATE OR REPLACE FUNCTION public.get_qr_review_info(_code TEXT)
RETURNS TABLE (
  qr_id UUID,
  qr_name TEXT,
  agency_id UUID,
  agency_name TEXT,
  category_id UUID,
  category_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 
    qr.id as qr_id,
    qr.name as qr_name,
    a.id as agency_id,
    a.name as agency_name,
    c.id as category_id,
    c.name as category_name
  FROM public.qr_codes qr
  JOIN public.agencies a ON a.id = qr.agency_id
  LEFT JOIN public.categories c ON c.id = qr.category_id
  WHERE qr.unique_code = _code
    AND qr.status = 'active'
    AND (qr.expires_at IS NULL OR qr.expires_at > now());
$$;
GRANT EXECUTE ON FUNCTION public.get_qr_review_info(TEXT) TO anon, authenticated;
