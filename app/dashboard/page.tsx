import { Dashboard } from "@/components/Dashboard";
import { isSupabaseConfigured } from "@/lib/supabaseServer";

export default function DashboardPage() {
  return (
    <Dashboard
      demoMode={!isSupabaseConfigured()}
      voiceEnabled={Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID)}
    />
  );
}
