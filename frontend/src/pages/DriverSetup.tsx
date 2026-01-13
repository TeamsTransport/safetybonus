import React, { useState, useRef, useMemo, useEffect } from 'react';
import { db } from '../services/dbStore';
import { Driver } from '../types';

const DriverSetup = () => {
  const [drivers, setDrivers] = useState<Driver[]>(db.drivers || []);
  const [trucks, setTrucks] = useState(db.trucks || []);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [truckSearch, setTruckSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Standardized formData to match Go/DB snake_case
  const [formData, setFormData] = useState<Omit<Driver, 'driver_id'>>({
    driver_code: '',
    first_name: '',
    last_name: '',
    start_date: new Date().toISOString().split('T')[0],
    truck_id: null,
    driver_type_id: 2, // Standardizes to ID
    profile_pic: ''
  });

  useEffect(() => {
    if (db.drivers.length === 0) db.init();
    
    const unsubscribe = db.subscribe(() => {
      setDrivers([...db.drivers]);
      setTrucks([...db.trucks]);
    });
    return () => unsubscribe();
  }, []);

  // Updated to use db.trucks (snake_case)
  const availableTrucks = useMemo(() => {
    const list = trucks || [];
    return list.filter(t => 
      t.status !== 'assigned' || (editingDriver && t.truck_id === editingDriver.truck_id)
    );
  }, [trucks, editingDriver]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert("Image is too large (1MB limit).");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, profile_pic: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

const handleSave = async () => {
  if (!formData.first_name || !formData.last_name || !formData.driver_code) {
    alert('Please fill in all required fields.');
    return;
  }

  try {
    // 1. Capture the original truck ID and the new selection
    const oldTruckId = editingDriver?.truck_id || null;
    const newTruckId = formData.truck_id ? Number(formData.truck_id) : null;
    
    // Prepare the driver profile payload
    const payload = {
      ...formData,
      truck_id: newTruckId,
      driver_type_id: Number(formData.driver_type_id)
    };

    // 2. Save Driver Profile 
    let saved: Driver;
    if (editingDriver) {
      saved = await db.saveDriver({ ...payload, driver_id: editingDriver.driver_id } as Driver);
    } else {
      saved = await db.saveDriver(payload as Driver);
    }

    if (oldTruckId !== newTruckId) {
      await db.assignDriverToTruck(saved.driver_id, newTruckId);
    }

    await db.init(); 

    resetForm();
    (document.getElementById('driver_modal') as any)?.close();
    
  } catch (error) {
    console.error("Save error:", error);
    alert("Failed to save driver profile. Check console for details.");
  }
};

  const resetForm = () => {
    setEditingDriver(null);
    setFormData({
      driver_code: '',
      first_name: '',
      last_name: '',
      start_date: new Date().toISOString().split('T')[0],
      truck_id: null,
      driver_type_id: 2,
      profile_pic: ''
    });
    setTruckSearch('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({
      driver_code: driver.driver_code,
      first_name: driver.first_name,
      last_name: driver.last_name,
      start_date: driver.start_date,
      truck_id: driver.truck_id,
      driver_type_id: driver.driver_type_id,
      profile_pic: driver.profile_pic || ''
    });
    const modal = document.getElementById('driver_modal') as any;
    modal?.showModal();
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Permanently delete this driver?')) {
      try {
        await db.deleteDriver(id);
      } catch (error) {
        alert("Failed to delete driver.");
      }
    }
  };

  const filteredDrivers = useMemo(() => {
    const list = drivers || [];
    const term = searchTerm.toLowerCase().trim();

    if (!term) return list;

    return list.filter(d => 
      d.first_name.toLowerCase().includes(term) ||
      d.last_name.toLowerCase().includes(term) ||
      d.driver_code.toLowerCase().includes(term)
    );
  }, [drivers, searchTerm]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold">Driver Administration</h2>
          <p className="text-base-content/60">Maintain driver profiles and database records</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => {
            setEditingDriver(null);
            resetForm();
            (document.getElementById('driver_modal') as any)?.showModal();
          }}
        >
          <i className="fa-solid fa-user-plus mr-2"></i> Register New Driver
        </button>
      </header>

      <div className="card bg-base-100 shadow-xl border border-base-200">
        <div className="p-4 border-b border-base-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 opacity-40"></i>
            <input 
              type="text" 
              placeholder="Search by name or code..." 
              className="input input-bordered w-full pl-11" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="badge badge-outline gap-2">{filteredDrivers.length} Registered</div>
        </div>

        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr className="bg-base-200/50">
                <th>Avatar</th>
                <th>Code</th>
                <th>Driver Name</th>
                <th>Hire Date</th>
                <th>Type</th>
                <th>Current Asset</th>
                <th className="text-right">Manage</th>
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 opacity-40 italic">No drivers found.</td>
                </tr>
              ) : (
                filteredDrivers.map(d => {
                  const type = (db.driver_types || []).find(t => t.driver_type_id === d.driver_type_id);
                  const truck = (db.trucks || []).find(t => t.truck_id === d.truck_id);
                  const avatarUrl = d.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(`${d.first_name} ${d.last_name}`)}&background=random&color=fff&bold=true`;
                  
                  return (
                    <tr key={d.driver_id} className="hover">
                      <td>
                        <div className="avatar">
                          <div className="w-8 rounded-full bg-base-300">
                            <img src={avatarUrl} alt="Avatar" />
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-xs">{d.driver_code}</td>
                      <td>
                        <div className="font-bold">{d.first_name} {d.last_name}</div>
                      </td>
                      <td>{new Date(d.start_date).toLocaleDateString()}</td>
                      <td>
                        <span className="badge badge-sm badge-ghost">{type?.driver_type}</span>
                      </td>
                      <td>
                        {truck ? (
                          <span className="flex items-center gap-1 text-xs">
                            <i className="fa-solid fa-truck text-primary"></i> {truck.unit_number}
                          </span>
                        ) : (
                          <span className="text-xs opacity-40">Unassigned</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button 
                            className="btn btn-ghost btn-xs text-info"
                            onClick={() => handleEdit(d)}
                          >
                            <i className="fa-solid fa-user-pen"></i>
                          </button>
                          <button 
                            className="btn btn-ghost btn-xs text-error"
                            onClick={() => handleDelete(d.driver_id)}
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

      <dialog id="driver_modal" className="modal">
        <div className="modal-box w-11/12 max-w-lg relative">
          {/* Close X Button */}
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>

          <h3 className="font-bold text-xl mb-6 pr-8">
            {editingDriver ? 'Update Driver Profile' : 'New Driver Registration'}
          </h3>
          
          <div className="flex flex-col items-center mb-6">
            <div className="avatar mb-4 relative group">
              <div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 bg-base-200 overflow-hidden">
                <img 
                  src={formData.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(`${formData.first_name || 'D'} ${formData.last_name || 'U'}`)}&background=888&color=fff&bold=true&size=128`} 
                  alt="Profile Preview" 
                />
              </div>
              <button 
                type="button"
                className="btn btn-circle btn-xs btn-primary absolute bottom-0 right-0 shadow-lg"
                onClick={() => fileInputRef.current?.click()}
              >
                <i className="fa-solid fa-camera"></i>
              </button>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange}
            />
            <p className="text-[10px] opacity-50 uppercase font-bold">Profile Picture</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-control col-span-2">
              <label className="label font-bold text-xs uppercase opacity-70">Driver Code</label>
              <input 
                type="text" 
                className="input input-bordered" 
                placeholder="D000"
                value={formData.driver_code}
                onChange={e => setFormData({...formData, driver_code: e.target.value})}
              />
            </div>
            
            <div className="form-control">
              <label className="label font-bold text-xs uppercase opacity-70">First Name</label>
              <input 
                type="text" 
                className="input input-bordered" 
                value={formData.first_name}
                onChange={e => setFormData({...formData, first_name: e.target.value})}
              />
            </div>

            <div className="form-control">
              <label className="label font-bold text-xs uppercase opacity-70">Last Name</label>
              <input 
                type="text" 
                className="input input-bordered" 
                value={formData.last_name}
                onChange={e => setFormData({...formData, last_name: e.target.value})}
              />
            </div>

            <div className="form-control">
              <label className="label font-bold text-xs uppercase opacity-70">Start Date</label>
              <input 
                type="date" 
                className="input input-bordered" 
                value={formData.start_date}
                onChange={e => setFormData({...formData, start_date: e.target.value})}
              />
            </div>

            <div className="form-control">
              <label className="label font-bold text-xs uppercase opacity-70">Driver Type</label>
              <select 
                className="select select-bordered"
                value={formData.driver_type_id || 2}
                onChange={e => setFormData({...formData, driver_type_id: Number(e.target.value)})}
              >
                {(db.driver_types || []).map(t => (
                  <option key={t.driver_type_id} value={t.driver_type_id}>{t.driver_type}</option>
                ))}
              </select>
            </div>

            {/* Truck Assignment Dropdown */}
            <div className="form-control col-span-2">
              <label className="label font-bold text-xs uppercase opacity-70">Asset / Truck Assignment</label>
              <div className="flex flex-col gap-2">
                {/*
                <input 
                  type="text" 
                  placeholder="Filter available trucks..." 
                  className="input input-bordered input-sm"
                  value={truckSearch}
                  onChange={e => setTruckSearch(e.target.value)}
                />
                */}
                <select 
                  className="select select-bordered w-full"
                  value={formData.truck_id || ""}
                  onChange={e => setFormData({...formData, truck_id: e.target.value ? Number(e.target.value) : null})}
                >
                  <option value="">Unassigned / Spare</option>
                  {availableTrucks.map(t => (
                    <option key={t.truck_id} value={t.truck_id}>
                      Unit {t.unit_number} ({t.year}) - {t.status}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] opacity-40 px-1 italic">
                  * Only showing unassigned or currently linked assets.
                </p>
              </div>
            </div>
          </div>

          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => (document.getElementById('driver_modal') as any)?.close()}>Cancel</button>
            <button className="btn btn-primary px-8" onClick={handleSave}>
              {editingDriver ? 'Update Profile' : 'Save Driver'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default DriverSetup;
