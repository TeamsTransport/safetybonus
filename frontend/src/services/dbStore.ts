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
  async saveDriver(driver: Driver): Promise<Driver> {
    const saved = driver.driver_id 
      ? await this.http.put<Driver>(`/drivers/${driver.driver_id}`, driver)
      : await this.http.post<Driver>('/drivers', driver);
    
    if (driver.driver_id) {
      this.drivers = this.drivers.map(d => d.driver_id === saved.driver_id ? saved : d);
    } else {
      this.drivers = [...this.drivers, saved];
    }

    this.trucks = this.trucks.map(t => {
      if (t.truck_id === saved.truck_id) {
        return { ...t, status: 'assigned' };
      }
      return t;
    });

    this.notify(); 
    return saved;
  }

  async assignDriverToTruck(driverId: number, truckId: number | null) {
    try {
      const response = await this.http.post<any>(`/drivers/${driverId}/assign-truck`, {
        truck_id: truckId
      });

      this.drivers = this.drivers.map(d => 
        d.driver_id === driverId ? { ...d, truck_id: truckId } : d
      );

      this.trucks = this.trucks.map(t => {
        if (t.truck_id === truckId) {
          return { ...t, status: 'assigned' };
        }
        const wasPreviousTruck = this.drivers.find(d => d.driver_id === driverId)?.truck_id === t.truck_id;
        if (wasPreviousTruck && t.truck_id !== truckId) {
          return { ...t, status: 'available' };
        }
        return t;
      });

      this.notify();
      
      return response;
    } catch (err) {
      console.error("Failed to assign truck:", err);
      throw err;
    }
  }
}

export const db = new DBStore();