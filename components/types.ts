import type { ExtractionResult } from "@/lib/extractSchoolComms";

export type ChildProfile = {
  parentName: string;
  childName: string;
  childAge: number;
  schoolName: string;
  schoolWebsiteUrl: string;
};

export type StoredTask = ExtractionResult["tasks"][number] & {
  id: string;
  status: "open" | "done";
};

export type SourceMessage = {
  id: string;
  sourceType: string;
  subject: string;
  sender?: string;
  rawText: string;
  processedAt: string;
  confidence: number;
};

export type AppState = {
  profile: ChildProfile | null;
  summary: string;
  events: ExtractionResult["events"];
  tasks: StoredTask[];
  lunchMenu: ExtractionResult["lunchMenu"];
  childNotes: ExtractionResult["childNotes"];
  warnings: string[];
  sources: SourceMessage[];
};
