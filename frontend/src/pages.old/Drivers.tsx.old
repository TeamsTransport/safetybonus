
import React, { useState } from 'react';
import { db } from '../services/dbStore';
import { Driver } from '../types';

const Drivers = () => {
  const [typeFilter, setTypeFilter] = useState<number | 'all'>('all');

  const filteredDrivers = typeFilter === 'all' 
    ? db.drivers 
    : db.drivers.filter(d => d.driver_type_id === typeFilter);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold">Driver Roster</h2>
          <p className="text-base-content/60">Fleet performance and safety monitoring</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="form-control">
            <select 
              className="select select-bordered w-full sm:w-48"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            >
              <option value="all">All Driver Types</option>
              {db.driverTypes.map(type => (
                <option key={type.driver_type_id} value={type.driver_type_id}>
                  {type.driver_type}
                </option>
              ))}
            </select>
          </div>
        </div>
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
                  const stats = db.getDriverStats(driver.driver_id);
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
