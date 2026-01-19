import { 
  Truck, Driver, DriverType, SafetyCategory, 
  ScoreCardItem, SafetyEvent, ScoreCardEvent,
  DBStoreState, TruckHistoryEvent 
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
  truck_history_by_truck: Record<number, TruckHistoryEvent[]> = {};

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

      // Find the driver to see what their OLD truck was
      const driver = this.drivers.find(d => d.driver_id === driverId);
      const oldTruckId = driver?.truck_id;

      this.trucks = this.trucks.map(t => {
        // 1. Mark the NEW truck as assigned
        if (truckId && t.truck_id === truckId) {
          return { ...t, status: 'assigned' };
        }
        // 2. Mark the OLD truck as available again
        if (oldTruckId && t.truck_id === oldTruckId) {
          return { ...t, status: 'available' };
        }
        return t;
      });

      // Update the driver's truck_id locally
      this.drivers = this.drivers.map(d => 
        d.driver_id === driverId ? { ...d, truck_id: truckId } : d
      );

      this.notify(); 
    } catch (err) {
      console.error("Assignment failed", err);
    }
  }

  async saveDriver(data: Partial<Driver>): Promise<Driver> {
    const isUpdate = !!data.driver_id;
    const path = isUpdate ? `/drivers/${data.driver_id}` : '/drivers';

    // 1. Perform the API call
    const savedDriver = await (isUpdate 
      ? this.http.put<Driver>(path, data) 
      : this.http.post<Driver>(path, data));

    // 2. Refresh everything (trucks, drivers, types) in one shot
    // This ensures Unit 2544 is now marked as 'assigned' in the local state
    await this.init(); 

    return savedDriver;
  }

  async deleteDriver(id: number) {
    await this.http.delete(`/drivers/${id}`);
    
    // Update local state: remove driver and free up their truck
    const driverToDelete = this.drivers.find(d => d.driver_id === id);
    if (driverToDelete?.truck_id) {
      this.trucks = this.trucks.map(t => 
        t.truck_id === driverToDelete.truck_id ? { ...t, status: 'available' } : t
      );
    }
    
    this.drivers = this.drivers.filter(d => d.driver_id !== id);
    this.notify();
  }

  async assignTruckToDriver(truckId: number, driverId: number | null) {
    try {
      await this.http.post<any>(`/trucks/${truckId}/assign-driver`, {
        driver_id: driverId
      });
      await this.init(); 
    } catch (err) {
      console.error("Assignment failed", err);
    }
  }
 
  async saveTruck(data: Partial<Truck>): Promise<Truck> {
    const isUpdate = !!data.truck_id;
    const path = isUpdate ? `/trucks/${data.truck_id}` : '/trucks';
    const savedTruck = await (isUpdate 
      ? this.http.put<Truck>(path, data) 
      : this.http.post<Truck>(path, data));

    if (isUpdate) {
      this.trucks = this.trucks.map(t => t.truck_id === savedTruck.truck_id ? savedTruck : t);
    } else {
      this.trucks = [...this.trucks, savedTruck];
    }

    this.notify(); 
    return savedTruck;
  }

  async fetchTruckHistory(truckId: number): Promise<TruckHistoryEvent[]> {
    const events = await this.http.get<TruckHistoryEvent[]>(`/trucks/${truckId}/history`);
    this.truck_history_by_truck[truckId] = events;
    this.notify(); // force subscribers to re-render
    return events;
  }
}

export const db = new DBStore();