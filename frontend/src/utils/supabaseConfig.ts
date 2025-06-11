import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://flrbhyqpragbtlljvmjl.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZscmJoeXFwcmFnYnRsbGp2bWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2MzAzNzYsImV4cCI6MjA2NDIwNjM3Nn0.YgLkpchqLuDjnVglpGo0Srr_g68RpZSREo9BcYeh38g";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log("Supabase client initialized");
