-- Add customizable text fields for QR code download cards
ALTER TABLE public.qr_codes 
ADD COLUMN card_headline TEXT NOT NULL DEFAULT 'Happy with our service?',
ADD COLUMN card_subtitle TEXT NOT NULL DEFAULT 'Help spread the word. Review us on Google or Cloutly.',
ADD COLUMN card_business_name TEXT,
ADD COLUMN card_footer_text TEXT NOT NULL DEFAULT 'Scan QR code to review us';
