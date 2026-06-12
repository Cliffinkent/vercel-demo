import { SetupForwarding } from "@/components/SetupForwarding";
import { isSupabaseConfigured } from "@/lib/supabaseServer";

export default function SetupForwardingPage() {
  return <SetupForwarding demoMode={!isSupabaseConfigured()} />;
}
