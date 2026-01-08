
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/dbStore';
import { Driver } from '../types';

const Drivers = () => {
  // --- 1. Reactivity via Subscription ---
  const [drivers, setDrivers] = useState<Driver[]>(db.drivers);
  const [typeFilter, setTypeFilter] = useState<number | 'all'>('all');

  useEffect(() => {
    if (db.drivers.length === 0) {
      db.init();
    }
    // Listen for any CRUD changes from the Go backend via the store
    const unsubscribe = db.subscribe(() => {
      setDrivers([...db.drivers]);
    });
    return () => unsubscribe();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // --- 2. Score & Status Calculation (Restored from .old) ---
  const getDriverStats = (driverId: number) => {
    const safetyEvents = db.safetyEvents.filter(e => e.driver_id === driverId);
    const totalBonusScore = safetyEvents.reduce((sum, event) => sum + event.bonus_score, 0);
    const status = totalBonusScore > 5 ? 'Warning' : 'Good';
    
    return {
      totalBonusScore: totalScore,
      status: totalScore > 5 ? 'Warning' : 'Good'
    };
  };

  const filteredDrivers = useMemo(() => {
    return typeFilter === 'all' 
      ? drivers 
      : drivers.filter(d => d.driver_type_id === typeFilter);
  }, [drivers, typeFilter]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold">Driver Roster</h2>
          <p className="text-base-content/60">Live performance monitoring</p>
        </div>
        
        <select 
          className="select select-bordered w-full sm:w-48"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        >
          <option value="all">All Driver Types</option>
          {/* Safety check: use optional chaining on driverTypes */}
          {db.driverTypes?.map(t => (
            <option key={t.driver_type_id} value={t.driver_type_id}>{t.driver_type}</option>
          ))}
        </select>
      </header>

      <div className="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr className="bg-base-200/50">
                <th>Driver Name</th>
                <th>Code</th>
                <th>Driver Type</th>
                <th>Assigned Truck</th>
                <th>Start Date</th>
                <th>Bonus Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-20 opacity-40 italic">
                    <div className="flex flex-col items-center gap-2">
                      <i className="fa-solid fa-user-slash text-4xl"></i>
                      <p>No drivers found matching this filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDrivers.map(driver => {
                  const stats = getDriverStats(driver.driver_id);
                  const truck = db.trucks.find(t => t.truck_id === driver.truck_id);
                  const type = db.driverTypes.find(t => t.driver_type_id === driver.driver_type_id);
                  const avatarUrl = driver.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(`${driver.first_name} ${driver.last_name}`)}&background=random&color=fff&size=64&font-size=0.45&bold=true`;
                  
                  return (
                    <tr key={driver.driver_id} className="hover:bg-base-200/30 transition-colors">
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="avatar">
                            <div className="w-10 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 overflow-hidden bg-base-300">
                              <img src={avatarUrl} alt={`${driver.first_name} ${driver.last_name}`} />
                            </div>
                          </div>
                          <div className="font-bold">{driver.first_name} {driver.last_name}</div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-ghost font-mono text-xs">{driver.driver_code}</span>
                      </td>
                      <td>
                        <span className={`badge badge-sm border font-medium px-3 py-2 h-auto ${
                          type?.driver_type === 'Company Driver' 
                            ? 'bg-green-100 text-green-800 border-green-200' 
                            : type?.driver_type === 'Owner Operator'
                            ? 'bg-gray-700 text-gray-100 border-gray-800'
                            : 'badge-outline border-base-300'
                        }`}>
                          {type?.driver_type || 'Unassigned'}
                        </span>
                      </td>
                      <td>
                        {truck ? (
                          <div className="flex items-center gap-2 text-sm">
                            <i className="fa-solid fa-truck text-primary"></i>
                            {truck.unit_number}
                          </div>
                        ) : (
                          <span className="text-xs opacity-40 italic">None</span>
                        )}
                      </td>
                      <td>
                        <span className="text-sm opacity-70">{formatDate(driver.start_date)}</span>
                      </td>
                      <td>
                        <div className={`font-bold ${stats.totalBonusScore > 5 ? 'text-error' : 'text-success'}`}>
                          {stats.totalBonusScore}
                        </div>
                      </td>
                      <td>
                        <div className={`badge badge-sm ${stats.status === 'Good' ? 'badge-success' : 'badge-error'}`}>
                          {stats.status}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Drivers;
