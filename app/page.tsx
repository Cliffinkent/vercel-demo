import { Onboarding } from "@/components/Onboarding";
import { isSupabaseConfigured } from "@/lib/supabaseServer";

export default function Home() {
  return <Onboarding demoMode={!isSupabaseConfigured()} />;
}
