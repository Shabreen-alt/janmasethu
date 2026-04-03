import { Module, Global } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseProvider = {
  provide: 'SUPABASE_CLIENT',
  useFactory: (): SupabaseClient => {
    // Note: In a real app, use @nestjs/config ConfigService instead of process.env directly
    const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
    const supabaseKey = process.env.SUPABASE_KEY || 'YOUR_SUPABASE_KEY';
    
    return createClient(supabaseUrl, supabaseKey);
  },
};

@Global()
@Module({
  providers: [supabaseProvider],
  exports: [supabaseProvider],
})
export class DatabaseModule {}
