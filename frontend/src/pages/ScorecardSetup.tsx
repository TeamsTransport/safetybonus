import React, { useState, useRef, useEffect, useMemo } from 'react';
import { db } from '../services/dbStore';
import { ScoreCardItem } from '../types';

const ScorecardSetup = () => {
  // Use a single modal ref if possible, or keep yours
  const addModalRef = useRef<HTMLDialogElement>(null);
  const editModalRef = useRef<HTMLDialogElement>(null);
  const deleteModalRef = useRef<HTMLDialogElement>(null);

  // --- 1. State Management ---
  // Standardized to db.scorecard_metrics (snake_case)
  const [items, setItems] = useState<ScoreCardItem[]>(db.scorecard_metrics || []);
  const [editingItem, setEditingItem] = useState<ScoreCardItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  
  // Use formData for both Add and Edit to simplify logic
  const [formData, setFormData] = useState<Omit<ScoreCardItem, 'sc_category_id'>>({ 
    sc_category: 'SAFETY', 
    sc_description: '',
    driver_type_id: null 
  });

  // --- 2. Reactivity via Subscription ---
  useEffect(() => {
    if (db.scorecard_metrics.length === 0) db.init();

    const unsubscribe = db.subscribe(() => {
      setItems([...db.scorecard_metrics]);
    });
    return () => unsubscribe();
  }, []);

  // --- 3. Handlers ---

  const handleSave = async () => {
    if (!formData.sc_description.trim()) {
      alert("Please enter a description.");
      return;
    }

    try {
      // Unified Upsert: includes the ID if we are editing
      await db.saveScorecardMetric({
        ...formData,
        ...(editingItem && { sc_category_id: editingItem.sc_category_id })
      } as ScoreCardItem);

      resetForm();
      addModalRef.current?.close();
      editModalRef.current?.close();
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save metric.");
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      sc_category: 'SAFETY',
      sc_description: '',
      driver_type_id: null
    });
  };

  const openEdit = (item: ScoreCardItem) => {
    setEditingItem(item);
    setFormData({
      sc_category: item.sc_category,
      sc_description: item.sc_description,
      driver_type_id: item.driver_type_id
    });
    editModalRef.current?.showModal();
  };

  const confirmDelete = async () => {
    if (itemToDelete !== null) {
      try {
        await db.deleteScoreCardItem(itemToDelete);
        setItemToDelete(null);
        deleteModalRef.current?.close();
      } catch (err) {
        alert("Failed to delete metric.");
      }
    }
  };

  const openDeleteModal = (id: number) => {
    setItemToDelete(id);
    deleteModalRef.current?.showModal();
  };

  // --- 4. Helpers (Standardized to db.driver_types) ---

  const getDriverTypeName = (id?: number | null) => {
    if (!id) return 'All Drivers';
    // Changed to db.driver_types
    return db.driver_types.find(t => t.driver_type_id === id)?.driver_type || 'Unknown';
  };

  const getDriverTypeBadgeClass = (id?: number | null) => {
    if (!id) return 'badge-ghost opacity-60';
    const type = db.driver_types.find(t => t.driver_type_id === id);
    if (type?.driver_type.includes('Company')) return 'badge-success badge-outline';
    if (type?.driver_type.includes('Owner')) return 'badge-neutral';
    return 'badge-info badge-outline';
  };

  const categories = ['SAFETY', 'MAINTENANCE', 'DISPATCH'];

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold">Scorecard Configuration</h2>
          <p className="text-base-content/60">Define qualitative grading metrics for monthly performance reviews</p>
        </div>
        <button className="btn btn-primary" onClick={() => addModalRef.current?.showModal()}>
          <i className="fa-solid fa-plus mr-2"></i> Add Metric
        </button>
      </header>

      <div className="grid grid-cols-1 gap-8">
        {categories.map(cat => (
          <div key={cat} className="card bg-base-100 shadow-xl overflow-hidden border border-base-200">
            <div className="bg-base-200 px-6 py-4 flex justify-between items-center font-bold uppercase tracking-wider text-xs">
              <span className="flex items-center gap-2">
                <i className={`fa-solid ${cat === 'SAFETY' ? 'fa-shield-halved' : cat === 'MAINTENANCE' ? 'fa-wrench' : 'fa-truck-ramp-box'}`}></i>
                {cat} METRICS
              </span>
              <div className="badge badge-sm badge-outline font-black">{items.filter(i => i.sc_category === cat).length} Definitions</div>
            </div>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="bg-base-200/30">
                    <th className="w-16">ID</th>
                    <th>Description</th>
                    <th>Applies To</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.filter(i => i.sc_category === cat).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-10 opacity-40 italic">No {cat.toLowerCase()} metrics defined.</td>
                    </tr>
                  ) : (
                    items.filter(i => i.sc_category === cat).map(item => (
                      <tr key={item.sc_category_id} className="hover">
                        <td className="text-xs opacity-50 font-mono">{item.sc_category_id.toString().slice(-4)}</td>
                        <td className="font-medium">{item.sc_description}</td>
                        <td>
                          <span className={`badge badge-sm font-bold uppercase tracking-tighter ${getDriverTypeBadgeClass(item.driver_type_id)}`}>
                            {getDriverTypeName(item.driver_type_id)}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1">
                            <button className="btn btn-ghost btn-xs text-info" onClick={() => openEdit(item)}>
                              <i className="fa-solid fa-pen"></i>
                            </button>
                            <button className="btn btn-ghost btn-xs text-error" onClick={() => openDeleteModal(item.sc_category_id)}>
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      <dialog ref={deleteModalRef} className="modal">
        <div className="modal-box max-w-md text-center">
          <div className="bg-error/10 text-error p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-trash-can text-2xl"></i>
          </div>
          <h3 className="font-bold text-xl">Delete Metric?</h3>
          <p className="py-2 opacity-70">This will remove this metric from future monthly scorecards. Historical entries will remain saved but this criteria will no longer appear for new grades.</p>
          <div className="modal-action flex justify-center gap-4">
            <button className="btn btn-ghost flex-1" onClick={() => deleteModalRef.current?.close()}>Cancel</button>
            <button className="btn btn-error flex-1" onClick={confirmDelete}>Delete Metric</button>
          </div>
        </div>
      </dialog>

      {/* Add Metric Modal */}
      <dialog ref={addModalRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-xl mb-6">New Grading Metric</h3>
          <div className="space-y-4">
            <div className="form-control">
              <label className="label font-bold text-xs uppercase opacity-70">Metric Category</label>
              <select className="select select-bordered w-full" value={newItem.sc_category} onChange={(e) => setNewItem({ ...newItem, sc_category: e.target.value })}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <div className="form-control">
              <label className="label font-bold text-xs uppercase opacity-70">Description</label>
              <textarea className="textarea textarea-bordered w-full h-24" placeholder="e.g. Completes DVIR accurately daily..." value={newItem.sc_description} onChange={(e) => setNewItem({ ...newItem, sc_description: e.target.value })}></textarea>
            </div>

            <div className="form-control">
              <label className="label font-bold text-xs uppercase opacity-70">Applies To (Classification)</label>
              <select 
                className="select select-bordered w-full" 
                value={newItem.driver_type_id || ""} 
                onChange={(e) => setNewItem({ ...newItem, driver_type_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">All Drivers (Global Metric)</option>
                {db.driverTypes.map(t => (
                  <option key={t.driver_type_id} value={t.driver_type_id}>{t.driver_type}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => addModalRef.current?.close()}>Cancel</button>
            <button className="btn btn-primary px-10" onClick={handleAdd}>Save Metric</button>
          </div>
        </div>
      </dialog>

      {/* Edit Metric Modal */}
      <dialog ref={editModalRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-xl mb-6">Update Metric</h3>
          {editingItem && (
            <div className="space-y-4">
              <div className="form-control">
                <label className="label font-bold text-xs uppercase opacity-70">Metric Category</label>
                <select className="select select-bordered w-full" value={editingItem.sc_category} onChange={(e) => setEditingItem({ ...editingItem, sc_category: e.target.value })}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-control">
                <label className="label font-bold text-xs uppercase opacity-70">Description</label>
                <textarea className="textarea textarea-bordered w-full h-24" value={editingItem.sc_description} onChange={(e) => setEditingItem({ ...editingItem, sc_description: e.target.value })}></textarea>
              </div>

              <div className="form-control">
                <label className="label font-bold text-xs uppercase opacity-70">Applies To (Classification)</label>
                <select 
                  className="select select-bordered w-full" 
                  value={editingItem.driver_type_id || ""} 
                  onChange={(e) => setEditingItem({ ...editingItem, driver_type_id: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">All Drivers (Global Metric)</option>
                  {db.driverTypes.map(t => (
                    <option key={t.driver_type_id} value={t.driver_type_id}>{t.driver_type}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => editModalRef.current?.close()}>Cancel</button>
            <button className="btn btn-primary px-10" onClick={handleUpdate}>Update Changes</button>
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default ScorecardSetup;
