// Supabase Configuration
// ----------------------
// You need to replace the placeholder values below with your actual
// Supabase Project URL and Anon Key.
//
// How to find them:
// 1. Go to https://supabase.com and log in.
// 2. Select your project.
// 3. In the left sidebar, click the gear icon for 'Project Settings'.
// 4. In the Project Settings menu, click 'API'.
// 5. On the API page, you will find:
//    - Your 'Project URL'
//    - Your 'Project API Keys'. Copy the key labeled 'anon' and 'public'.
//
// IMPORTANT: The Anon key is safe to use in frontend code.
//            DO NOT use the 'service_role' secret key here.

import { createClient } from '@supabase/supabase-js';

// --- PASTE YOUR CREDENTIALS BELOW --- 

const supabaseUrl = "https://qzhvszlpmwaroqitwuzq.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6aHZzemxwbXdhcm9xaXR3dXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyODIyNzgsImV4cCI6MjA2MDg1ODI3OH0.OoBurZr4sWhdQ8VuUWEifqZDoHvD4l-iZKOcjaLGqYA";

// --- END OF CREDENTIALS --- 


// Basic validation to prevent common errors
if (
  supabaseUrl.includes("YOUR_SUPABASE_PROJECT_URL") || 
  supabaseAnonKey.includes("YOUR_SUPABASE_ANON_KEY")
) {
  console.warn(
    `Supabase credentials are placeholders in supabaseConfig.ts! 
     Authentication will not work until you replace them with your actual Supabase URL and Anon Key. 
     Find them in your Supabase project settings -> API.`
  );
}

// Create and export the Supabase client instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log("Supabase client initialized (check console warning if using placeholders)");
