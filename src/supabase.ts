import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://inmgonuewvkilddynasj.supabase.co';
const supabaseKey = 'sb_publishable_Z3C-9-5umFjUyKaihHQl2w_6Jz-yH9Z';

export const supabase = createClient(supabaseUrl, supabaseKey);
