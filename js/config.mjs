// Public configuration. Both values are MEANT to be public (they ship to every browser):
// security comes from the row-level-security policies in supabase/schema.sql, not from hiding them.
// NEVER put the service_role key here or anywhere in this repository.
//
// Supabase dashboard -> Project settings -> API -> "Project URL" and "anon public" key.
// While they are empty, the app runs exactly as before (no accounts, plan read from the browser).
export const SUPABASE_URL = 'https://umkzjafphozxekhffyct.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVta3pqYWZwaG96eGVraGZmeWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDQzMzIsImV4cCI6MjEwNTQ4MDMzMn0.VYWoNv6wYzEojeckqL0xcnbOIsjOFM6EvtSGnco1vX0';
