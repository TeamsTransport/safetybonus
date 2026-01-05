
import React, { useState } from 'react';
import { db } from '../services/dbStore';
import { Truck, Driver, TruckHistoryEvent } from '../types';

const Trucks = () => {
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [historyTruck, setHistoryTruck] = useState<Truck | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [drivers, setDrivers] = useState<Driver[]>(db.drivers);
  const [trucks, setTrucks] = useState<Truck[]>(db.trucks);
  
  const [formData, setFormData] = useState<Omit<Truck, 'truck_id'>>({
    unit_number: '',
    year: new Date().getFullYear(),
    status: 'available'
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available': return 'badge-success';
      case 'maintenance': return 'badge-warning';
      case 'assigned': return 'badge-info';
      default: return 'badge-ghost';
    }
  };

  const refreshData = () => {
    setDrivers([...db.drivers]);
    setTrucks([...db.trucks]);
  };

  const handleOpenAssignModal = (truck: Truck) => {
    setSelectedTruck(truck);
    (window as any).assign_modal?.showModal();
  };

  const handleOpenHistoryModal = (truck: Truck) => {
    setHistoryTruck(truck);
    (window as any).history_modal?.showModal();
  };

  const handleAssignDriver = (driverId: number | null) => {
    if (!selectedTruck) return;
    db.assignDriverToTruck(driverId, selectedTruck.truck_id);
    refreshData();
    (window as any).assign_modal?.close();
    setSelectedTruck(null);
  };

  const handleSaveTruck = () => {
    if (!formData.unit_number) {
      alert('Unit Number is required');
      return;
    }
    db.addTruck(formData);
    setFormData({ unit_number: '', year: new Date().getFullYear(), status: 'available' });
    refreshData();
    (window as any).truck_modal?.close();
  };

  const handleDeleteTruck = (id: number) => {
    if (confirm('Permanently remove this unit from the fleet database?')) {
      db.deleteTruck(id);
      refreshData();
    }
  };

  const filteredTrucks = trucks.filter(t => {
    const assignedDriver = drivers.find(d => d.truck_id === t.truck_id);
    const driverName = assignedDriver ? `${assignedDriver.first_name} ${assignedDriver.last_name}` : '';
    return t.unit_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
           driverName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const truckHistory = historyTruck ? db.getTruckHistory(historyTruck.truck_id) : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold">Fleet Management</h2>
          <p className="text-base-content/60">Maintain truck database and monitor asset availability</p>
        </div>
        <button className="btn btn-primary" onClick={() => (window as any).truck_modal?.showModal()}>
          <i className="fa-solid fa-plus mr-2"></i> Add Truck
        </button>
      </header>

      <div className="card bg-base-100 shadow-xl border border-base-200">
        <div className="p-4 border-b border-base-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 opacity-40"></i>
            <input 
              type="text" 
              placeholder="Search by unit # or driver..." 
              className="input input-bordered w-full pl-11" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="badge badge-outline gap-2">{filteredTrucks.length} Units in Fleet</div>
        </div>

        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr className="bg-base-200/50">
                <th>Unit Number</th>
                <th>Model Year</th>
                <th>Current Status</th>
                <th>Assigned To</th>
                <th className="text-right">Manage</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrucks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 opacity-40 italic">No matching fleet units found.</td>
                </tr>
              ) : (
                filteredTrucks.map(truck => {
                  const assignedDriver = drivers.find(d => d.truck_id === truck.truck_id);
                  return (
                    <tr key={truck.truck_id} className="hover">
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded text-primary">
                            <i className="fa-solid fa-truck"></i>
                          </div>
                          <span className="font-bold">{truck.unit_number}</span>
                        </div>
                      </td>
                      <td>{truck.year}</td>
                      <td>
                        <span className={`badge badge-sm font-bold uppercase ${getStatusBadge(truck.status)}`}>
                          {truck.status}
                        </span>
                      </td>
                      <td>
                        {assignedDriver ? (
                          <div className="flex items-center gap-2">
                            <div className="avatar placeholder">
                              <div className="bg-neutral text-neutral-content rounded-full w-6">
                                <span className="text-[10px]">{assignedDriver.first_name[0]}{assignedDriver.last_name[0]}</span>
                              </div>
                            </div>
                            <span className="text-sm font-medium">{assignedDriver.first_name} {assignedDriver.last_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs opacity-40 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button 
                            className="btn btn-ghost btn-xs text-primary"
                            onClick={() => handleOpenAssignModal(truck)}
                            title="Assign Driver"
                          >
                            <i className="fa-solid fa-user-plus"></i>
                          </button>
                          <button 
                            className="btn btn-ghost btn-xs text-info"
                            onClick={() => handleOpenHistoryModal(truck)}
                            title="View History"
                          >
                            <i className="fa-solid fa-clock-rotate-left"></i>
                          </button>
                          <button 
                            className="btn btn-ghost btn-xs text-error"
                            onClick={() => handleDeleteTruck(truck.truck_id)}
                            title="Delete Unit"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
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

      {/* History Modal */}
      <dialog id="history_modal" className="modal">
        <div className="modal-box w-11/12 max-w-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-2xl flex items-center gap-3">
              <i className="fa-solid fa-clock-rotate-left text-primary"></i>
              History: {historyTruck?.unit_number}
            </h3>
            <button className="btn btn-sm btn-circle btn-ghost" onClick={() => (window as any).history_modal.close()}>✕</button>
          </div>
          
          <div className="space-y-4">
            {truckHistory.length === 0 ? (
              <div className="text-center py-10 opacity-50 italic">
                No history events recorded for this unit.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr className="bg-base-200">
                      <th>Date</th>
                      <th>Type</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {truckHistory.map(event => (
                      <tr key={event.truck_history_id} className="hover">
                        <td className="whitespace-nowrap text-sm opacity-70">
                          {new Date(event.date).toLocaleDateString()}
                        </td>
                        <td>
                          <span className={`badge badge-sm font-bold uppercase ${
                            event.type === 'assignment' ? 'badge-info' : 
                            event.type === 'maintenance' ? 'badge-warning' : 'badge-ghost'
                          }`}>
                            {event.type}
                          </span>
                        </td>
                        <td className="text-sm font-medium">
                          {event.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="modal-action">
            <button className="btn" onClick={() => (window as any).history_modal.close()}>Close</button>
          </div>
        </div>
      </dialog>

      {/* Assign Driver Modal */}
      <dialog id="assign_modal" className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-xl mb-4">Assign Driver to {selectedTruck?.unit_number}</h3>
          <p className="text-sm opacity-60 mb-6">Select a driver to link with this fleet unit. This will automatically update current assignments.</p>
          
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            <button 
              className="btn btn-outline btn-block justify-between font-normal normal-case border-dashed"
              onClick={() => handleAssignDriver(null)}
            >
              Unassign Current Driver
              <i className="fa-solid fa-user-slash"></i>
            </button>
            <div className="divider text-[10px] font-bold opacity-40 uppercase tracking-widest">Available Drivers</div>
            {drivers.map(driver => (
              <button 
                key={driver.driver_id}
                className={`btn btn-block justify-between font-normal normal-case ${driver.truck_id === selectedTruck?.truck_id ? 'btn-active' : driver.truck_id ? 'opacity-50' : ''}`}
                onClick={() => handleAssignDriver(driver.driver_id)}
                disabled={driver.truck_id !== null && driver.truck_id !== selectedTruck?.truck_id}
              >
                <div className="flex items-center gap-2">
                   <div className="avatar placeholder">
                    <div className="bg-neutral text-neutral-content rounded-full w-6">
                      <span className="text-[10px]">{driver.first_name[0]}{driver.last_name[0]}</span>
                    </div>
                  </div>
                  <span>{driver.first_name} {driver.last_name} <span className="text-xs opacity-50 ml-1">({driver.driver_code})</span></span>
                </div>
                {driver.truck_id === selectedTruck?.truck_id ? (
                  <span className="badge badge-primary badge-xs">Currently Assigned</span>
                ) : driver.truck_id ? (
                  <span className="badge badge-ghost badge-xs">On {trucks.find(t => t.truck_id === driver.truck_id)?.unit_number}</span>
                ) : (
                  <i className="fa-solid fa-plus text-success"></i>
                )}
              </button>
            ))}
          </div>

          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => (window as any).assign_modal.close()}>Cancel</button>
          </div>
        </div>
      </dialog>

      <dialog id="truck_modal" className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-xl mb-6">Add New Fleet Unit</h3>
          <div className="space-y-4">
            <div className="form-control">
              <label className="label font-bold text-xs uppercase opacity-70">Unit Number</label>
              <input 
                type="text" 
                className="input input-bordered" 
                placeholder="e.g. T-400" 
                value={formData.unit_number}
                onChange={e => setFormData({...formData, unit_number: e.target.value})}
              />
            </div>
            <div className="form-control">
              <label className="label font-bold text-xs uppercase opacity-70">Model Year</label>
              <input 
                type="number" 
                className="input input-bordered" 
                placeholder="2024" 
                value={formData.year}
                onChange={e => setFormData({...formData, year: Number(e.target.value)})}
              />
            </div>
            <div className="form-control">
              <label className="label font-bold text-xs uppercase opacity-70">Initial Status</label>
              <select 
                className="select select-bordered"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as any})}
              >
                <option value="available">available</option>
                <option value="maintenance">maintenance</option>
              </select>
            </div>
          </div>
          <div className="modal-action mt-8">
            <button className="btn btn-ghost" onClick={() => (window as any).truck_modal.close()}>Cancel</button>
            <button className="btn btn-primary px-8" onClick={handleSaveTruck}>Create Unit</button>
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default Trucks;
