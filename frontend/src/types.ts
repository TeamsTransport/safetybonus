
export interface Truck {
  truck_id: number;
  unit_number: string;
  year: number;
  status: 'available' | 'maintenance' | 'assigned';
}

export interface TruckHistoryEvent {
  truck_history_id: number;
  truck_id: number;
  driver_id: number | null;
  date: string;
  type: 'assignment' | 'maintenance' | 'status_change';
  notes: string;
}

export interface DriverType {
  driver_type_id: number;
  driver_type: string;
}

export interface Driver {
  driver_id: number;
  driver_code: string;
  first_name: string;
  last_name: string;
  start_date: string;
  truck_id: number | null;
  driver_type_id: number | null;
  profile_pic?: string; // Base64 or URL
}

export interface SafetyCategory {
  category_id: number;
  code: string;
  description: string;
  scoring_system: number;
  p_i_score: number;
}

export interface ScoreCardItem {
  sc_category_id: number;
  sc_category: string;
  sc_description: string;
  driver_type_id?: number | null;
}

export interface SafetyEvent {
  safety_event_id: number;
  driver_id: number;
  event_date: string;
  category_id: number;
  notes: string;
  bonus_score: number;
  p_i_score: number;
  bonus_period: boolean;
}

export interface ScoreCardEvent {
  scorecard_event_id: number;
  driver_id: number;
  event_date: string;
  sc_category_id: number;
  sc_score: number;
  notes: string;
}

export interface ScoreCardSummary {
  score_id: number;
  driver_id: number;
  month: number;
  year: number;
  safety_score: number;
  maintenance_score: number;
  dispatch_score: number;
  notes: string;
}

export interface DBStoreState {
  drivers: Driver[];
  trucks: Truck[];
  driver_types: DriverType[];
  safety_categories: SafetyCategory[];
  scorecard_metrics: ScoreCardItem[];
  safety_events: SafetyEvent[];
  scorecard_events: ScoreCardEvent[];
}
