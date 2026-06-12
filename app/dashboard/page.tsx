import { Dashboard } from "@/components/Dashboard";

export default function DashboardPage() {
  return (
    <Dashboard
      voiceEnabled={Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID)}
    />
  );
}
