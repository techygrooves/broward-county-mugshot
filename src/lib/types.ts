export interface Charge {
  description: string;
  statute?: string | null;
  bond_amount?: string | null;
  court_case?: string | null;
}

export interface BondInfo {
  total_bond?: string | null;
  bond_type?: string | null;
  notes?: string | null;
}

export type RecordStatus = "published" | "pending";

export interface ArrestRecord {
  id: string;
  source: string;
  county: string;
  arrest_number: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  full_name: string;
  sex: string | null;
  age: number | null;
  booking_date: string | null;
  arrest_date: string | null;
  release_date: string | null;
  location: string | null;
  charges_json: Charge[] | null;
  bond_json: BondInfo | null;
  charges_text: string | null;
  mugshot_url: string | null;
  official_detail_url: string | null;
  status: RecordStatus;
  is_hidden: boolean;
  hidden_reason: string | null;
  mugshot_hidden: boolean;
  removal_requested: boolean;
  removal_requested_at: string | null;
  removed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ScraperRunStatus =
  | "running"
  | "success"
  | "partial"
  | "blocked"
  | "no_data"
  | "error"
  | "dry_run";

export interface ScraperRun {
  id: string;
  source: string;
  started_at: string;
  completed_at: string | null;
  status: ScraperRunStatus;
  records_found: number;
  records_inserted: number;
  records_updated: number;
  errors_json: string[] | null;
  created_at: string;
}

export type RemovalRequestStatus = "pending" | "approved" | "rejected";

export interface RemovalRequest {
  id: string;
  arrest_id: string | null;
  requester_name: string;
  requester_email: string;
  requester_phone: string | null;
  relationship_to_person: string | null;
  proof_notes: string | null;
  message: string | null;
  status: RemovalRequestStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface SuppressionEntry {
  id: string;
  arrest_number: string | null;
  full_name: string | null;
  reason: string | null;
  created_at: string;
}

export interface SearchParams {
  first_name?: string;
  last_name?: string;
  arrest_number?: string;
  charge?: string;
  booking_date_from?: string;
  booking_date_to?: string;
  page?: number;
}

export interface SearchResult {
  records: ArrestRecord[];
  total: number;
  page: number;
  pageSize: number;
  isDemo: boolean;
}
