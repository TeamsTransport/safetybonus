import { 
  Truck, Driver, DriverType, SafetyCategory, 
  ScoreCardItem, SafetyEvent, ScoreCardEvent,
  DBStoreState 
} from '../types';

type Id = number;
type Listener = () => void;

// 1. Centralized HTTP client
class HttpClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }
  
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    console.log(`Attempting ${method} request to: ${url}`); // <--- ADD THIS LOG

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      
      if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
      return res.json();
    } catch (error) {
      console.error("Fetch implementation error:", error); // <--- ADD THIS LOG
      throw error;
    }
  }

  get<T>(path: string) { return this.request<T>('GET', path); }
  post<T>(path: string, body: unknown) { return this.request<T>('POST', path, body); }
  put<T>(path: string, body: unknown) { return this.request<T>('PUT', path, body); }
  delete<T>(path: string) { return this.request<T>('DELETE', path); }
}

// 2. The Store
export class DBStore implements DBStoreState {
  // Properties now match Go JSON keys exactly
  drivers: Driver[] = [];
  trucks: Truck[] = [];
  driver_types: DriverType[] = [];
  safety_categories: SafetyCategory[] = [];
  scorecard_metrics: ScoreCardItem[] = [];
  safety_events: SafetyEvent[] = [];
  scorecard_events: ScoreCardEvent[] = [];

  private listeners: Set<Listener> = new Set();
  private http = new HttpClient('http://localhost:8080/api');

  async init() {
    console.log("LOG: dbStore.init() was triggered by the component.");
    try {
      const data = await this.http.get<any>('/bootstrap');
      this.applyBootstrap(data);
    } catch (err) {
      console.error("Store init failed:", err);
    }
  }

  private applyBootstrap(data: any) {
    // Direct assignment works because names are identical
    Object.assign(this, {
      drivers: data.drivers || [],
      trucks: data.trucks || [],
      driver_types: data.driver_types || [],
      safety_categories: data.safety_categories || [],
      scorecard_metrics: data.scorecard_metrics || [],
      safety_events: data.safety_events || [],
      scorecard_events: data.scorecard_events || []
    });
    this.notify();
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  // Example Helper: Save Driver
  async assignDriverToTruck(driverId: number, truckId: number | null) {
    try {
      await this.http.post<any>(`/drivers/${driverId}/assign-truck`, {
        truck_id: truckId
      });

      this.trucks = this.trucks.map(t => {
        if (truckId && t.truck_id === truckId) {
          return { ...t, status: 'assigned' };
        }

        const driver = this.drivers.find(d => d.driver_id === driverId);
        if (driver && t.truck_id === driver.truck_id && t.truck_id !== truckId) {
          return { ...t, status: 'available' };
        }

        return t;
      });

      this.drivers = this.drivers.map(d => 
        d.driver_id === driverId ? { ...d, truck_id: truckId } : d
      );

      this.notify(); 
    } catch (err) {
      console.error("Assignment failed", err);
    }
  }
}

export const db = new DBStore();