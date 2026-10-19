// Run this script to add the QR card text columns to the database
// Usage: node add-columns.mjs

const SUPABASE_URL = 'https://lgvoebcgzujddbaalobe.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxndm9lYmNnenVqZGRiYWFsb2JlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjM3NjI4NywiZXhwIjoyMTA3OTUyMjg3fQ.ofqC1V3k7Nea9PB8tGMu9dozXva79F49y16bCtDWp4M';

async function checkAndAddColumns() {
  // First, check if columns exist by trying to select them
  console.log('Checking if columns exist...');
  
  const checkResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/qr_codes?select=card_headline&limit=1`,
    {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      }
    }
  );
  
  if (checkResponse.ok) {
    console.log('✅ Columns already exist! The migration has been applied.');
    console.log('If your data is not showing, check:');
    console.log('1. Are you seeing any error when saving?');
    console.log('2. Refresh the page after saving');
    return;
  }
  
  console.log('Columns do not exist. You need to run the following SQL in Supabase Dashboard:');
  console.log('');
  console.log('Go to: https://supabase.com/dashboard/project/lgvoebcgzujddbaalobe/sql/new');
  console.log('');
  console.log('And paste this SQL:');
  console.log('');
  console.log(`
ALTER TABLE public.qr_codes 
ADD COLUMN IF NOT EXISTS card_headline TEXT NOT NULL DEFAULT 'Happy with our service?',
ADD COLUMN IF NOT EXISTS card_subtitle TEXT NOT NULL DEFAULT 'Help spread the word. Review us on Google or Cloutly.',
ADD COLUMN IF NOT EXISTS card_business_name TEXT,
ADD COLUMN IF NOT EXISTS card_footer_text TEXT NOT NULL DEFAULT 'Scan QR code to review us';
  `);
}

checkAndAddColumns().catch(console.error);
