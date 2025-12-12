import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://inmgonuewvkilddynasj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWdvbnVld3ZraWxkZHluYXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMzAzNzgsImV4cCI6MjA3OTcwNjM3OH0.P994ICjQhuqD11fBjX8ioKy6z5X5zy6PUvLTJR-MPTk';

export const supabase = createClient(supabaseUrl, supabaseKey);
