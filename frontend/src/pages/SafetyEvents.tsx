import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../services/dbStore';
import { SafetyCategory, SafetyEvent } from '../types';

const SafetyEvents = () => {
  const logModalRef = useRef<HTMLDialogElement>(null);
  const deleteModalRef = useRef<HTMLDialogElement>(null);

  // --- 1. Date Helpers ---
  const getInitialStartDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  };
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  // --- 2. State Management ---
  const [driverIdFilter, setDriverIdFilter] = useState<number>(0);
  const [startDateFilter, setStartDateFilter] = useState(getInitialStartDate());
  const [endDateFilter, setEndDateFilter] = useState(getTodayDate());
  
  const [selectedDriverId, setSelectedDriverId] = useState<number>(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [eventDate, setEventDate] = useState(getTodayDate());
  
  const [eventToDelete, setEventToDelete] = useState<number | null>(null);
  const [storeTick, setStoreTick] = useState(0); // Used to trigger re-renders on store updates

  // --- 3. Reactivity & Initialization ---
  useEffect(() => {
    if (db.safety_events.length === 0) db.init();

    const unsubscribe = db.subscribe(() => {
      setStoreTick(prev => prev + 1); // Refresh local memoized filters when store changes
    });
    return () => unsubscribe();
  }, []);

  // --- 4. Filtering Logic (Memoized) ---
  const filteredEvents = useMemo(() => {
    // Standardized to db.safety_events
    let list = [...(db.safety_events || [])];

    if (startDateFilter) list = list.filter(e => e.event_date >= startDateFilter);
    if (endDateFilter) list = list.filter(e => e.event_date <= endDateFilter);
    if (driverIdFilter !== 0) list = list.filter(e => e.driver_id === driverIdFilter);

    return list.sort((a, b) => b.event_date.localeCompare(a.event_date));
  }, [storeTick, driverIdFilter, startDateFilter, endDateFilter]);

  // --- 5. Event Handlers ---

  const handleResetFilters = () => {
    setDriverIdFilter(0);
    setStartDateFilter(getInitialStartDate());
    setEndDateFilter(getTodayDate());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Standardized to db.safety_categories
    const category = db.safety_categories.find(c => c.category_id === selectedCategoryId);
    
    if (!selectedDriverId || !category) {
      alert("Please select a driver and a category.");
      return;
    }

    const newEvent: Omit<SafetyEvent, 'safety_event_id'> = {
      driver_id: selectedDriverId,
      event_date: eventDate,
      category_id: selectedCategoryId,
      notes: notes,
      bonus_score: category.scoring_system,
      p_i_score: category.p_i_score,
      bonus_period: true
    };

    try {
      // Assuming you've unified to saveSafetyEvent in dbStore
      await db.saveSafetyEvent(newEvent as SafetyEvent);

      // Reset form
      setSelectedDriverId(0);
      setSelectedCategoryId(0);
      setNotes('');
      setEventDate(getTodayDate());
      
      logModalRef.current?.close();
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save safety event.");
    }
  };

  const openDeleteModal = (id: number) => {
    setEventToDelete(id);
    deleteModalRef.current?.showModal();
  };

  const confirmDelete = async () => {
    if (eventToDelete !== null) {
      try {
        await db.deleteSafetyEvent(eventToDelete);
        setEventToDelete(null);
        deleteModalRef.current?.close();
      } catch (err) {
        alert("Failed to delete event.");
      }
    }
  };

  // Helper for Roster/Table display
  const getDriverName = (id: number) => {
    const d = db.drivers.find(drv => drv.driver_id === id);
    return d ? `${d.first_name} ${d.last_name}` : 'Unknown';
  };

  const getCategoryCode = (id: number) => {
    return db.safety_categories.find(c => c.category_id === id)?.code || 'N/A';
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold">Safety Event Logs</h2>
          <p className="text-base-content/60">Historical record of inspections, violations, and credits</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => logModalRef.current?.showModal()}
        >
          <i className="fa-solid fa-plus mr-2"></i> Log Safety Event
        </button>
      </header>

      {/* Filter Bar */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="form-control">
              <label className="label text-[10px] font-bold uppercase opacity-50 p-1">Filter Driver</label>
              <select className="select select-bordered select-sm" value={driverIdFilter} onChange={(e) => setDriverIdFilter(Number(e.target.value))}>
                <option value={0}>All Drivers</option>
                {db.drivers.map(d => (
                  <option key={d.driver_id} value={d.driver_id}>{d.first_name} {d.last_name}</option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label text-[10px] font-bold uppercase opacity-50 p-1">Start Date</label>
              <input type="date" className="input input-bordered input-sm" value={startDateFilter} onChange={(e) => setStartDateFilter(e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label text-[10px] font-bold uppercase opacity-50 p-1">End Date</label>
              <input type="date" className="input input-bordered input-sm" value={endDateFilter} onChange={(e) => setEndDateFilter(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button className={`btn btn-sm btn-primary flex-1 ${isSearching ? 'loading' : ''}`} onClick={applyFilters}>
                {!isSearching && <i className="fa-solid fa-magnifying-glass mr-1"></i>} Go
              </button>
              <button className="btn btn-sm btn-ghost flex-1" onClick={handleResetFilters}>Reset</button>
            </div>
            <div className="flex justify-end">
              <div className="badge badge-info badge-outline py-3 px-4 w-full md:w-auto h-auto text-xs font-bold">
                {events.length} Logs Found
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card bg-base-100 shadow-xl border border-base-200 overflow-hidden relative">
        {isSearching && (
          <div className="absolute inset-0 bg-base-100/50 z-10 flex items-center justify-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr className="bg-base-200/50">
                <th>Date</th>
                <th>Driver</th>
                <th>Category</th>
                <th>Notes</th>
                <th className="text-center">Pts</th>
                <th className="text-right">Manage</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-20 opacity-40 italic">No safety logs found.</td>
                </tr>
              ) : (
                events.map(event => {
                  const driver = db.getDriver(event.driver_id);
                  const cat = db.safetyCategories.find(c => c.category_id === event.category_id);
                  const avatarUrl = driver?.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(`${driver?.first_name} ${driver?.last_name}`)}&background=random&color=fff&bold=true`;
                  return (
                    <tr key={event.safety_event_id} className="hover">
                      <td className="whitespace-nowrap font-medium text-xs">{new Date(event.event_date).toLocaleDateString()}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="avatar">
                            <div className="w-8 rounded-full bg-base-300 overflow-hidden"><img src={avatarUrl} alt="Avatar" /></div>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{driver?.first_name} {driver?.last_name}</span>
                            <span className="text-[10px] opacity-40 font-mono">{driver?.driver_code}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span className="badge badge-ghost badge-sm font-mono text-[10px]">{cat?.code}</span>
                          <span className="text-xs font-medium max-w-[200px] truncate">{cat?.description}</span>
                        </div>
                      </td>
                      <td className="text-xs opacity-70 italic max-w-xs truncate">{event.notes}</td>
                      <td className="text-center">
                        <span className={`font-black text-sm ${event.bonus_score > 0 ? 'text-error' : 'text-success'}`}>
                          {event.bonus_score > 0 ? `+${event.bonus_score}` : event.bonus_score}
                        </span>
                      </td>
                      <td className="text-right">
                        <button className="btn btn-ghost btn-xs text-error" onClick={() => openDeleteModal(event.safety_event_id)}>
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <dialog ref={deleteModalRef} className="modal">
        <div className="modal-box max-w-md text-center">
          <div className="bg-error/10 text-error p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-trash-can text-2xl"></i>
          </div>
          <h3 className="font-bold text-xl">Delete Safety Log?</h3>
          <p className="py-2 opacity-70">Are you sure you want to permanently delete this logged safety event? This action cannot be undone.</p>
          <div className="modal-action flex justify-center gap-4">
            <button className="btn btn-ghost flex-1" onClick={() => deleteModalRef.current?.close()}>Cancel</button>
            <button className="btn btn-error flex-1" onClick={confirmDelete}>Delete Log</button>
          </div>
        </div>
      </dialog>

      {/* Log Event Modal */}
      <dialog ref={logModalRef} className="modal">
        <div className="modal-box w-11/12 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="font-bold text-2xl flex items-center gap-2">
              <i className="fa-solid fa-file-signature text-primary"></i> Log New Safety Event
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-control">
                <label className="label font-bold text-xs uppercase opacity-70">Driver</label>
                <select className="select select-bordered" value={selectedDriverId} onChange={(e) => setSelectedDriverId(Number(e.target.value))} required>
                  <option value={0}>Choose a driver...</option>
                  {db.drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.first_name} {d.last_name}</option>)}
                </select>
              </div>
              <div className="form-control">
                <label className="label font-bold text-xs uppercase opacity-70">Event Date</label>
                <input type="date" className="input input-bordered" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
              </div>
            </div>
            <div className="form-control">
              <label className="label font-bold text-xs uppercase opacity-70">Violation / Action Type</label>
              <select className="select select-bordered" value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(Number(e.target.value))} required>
                <option value={0}>Choose a category...</option>
                {db.safetyCategories.map(cat => (
                  <option key={cat.category_id} value={cat.category_id}>{cat.code} - {cat.description} ({cat.scoring_system > 0 ? `+${cat.scoring_system}` : cat.scoring_system} pts)</option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label font-bold text-xs uppercase opacity-70">Supporting Notes</label>
              <textarea className="textarea textarea-bordered h-32 text-sm" placeholder="Details..." value={notes} onChange={(e) => setNotes(e.target.value)}></textarea>
            </div>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => logModalRef.current?.close()}>Cancel</button>
              <button type="submit" className="btn btn-primary px-10">Record Event</button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
};

export default SafetyEvents;
