
import React, { useState, useRef } from 'react';
import { db } from '../services/dbStore';
import { SafetyCategory } from '../types';

const SafetyEventSetup = () => {
  const setupModalRef = useRef<HTMLDialogElement>(null);
  const deleteModalRef = useRef<HTMLDialogElement>(null);

  const [categories, setCategories] = useState<SafetyCategory[]>(db.safetyCategories);
  const [editingCategory, setEditingCategory] = useState<SafetyCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Omit<SafetyCategory, 'category_id'>>({
    code: '',
    description: '',
    scoring_system: 0,
    p_i_score: 0
  });

  const refresh = () => setCategories([...db.safetyCategories]);

  const handleSave = () => {
    if (!formData.code || !formData.description) {
      alert('Please fill in Code and Description.');
      return;
    }

    if (editingCategory) {
      db.updateSafetyCategory({ ...formData, category_id: editingCategory.category_id });
      setEditingCategory(null);
    } else {
      db.addSafetyCategory(formData);
    }

    setFormData({
      code: '',
      description: '',
      scoring_system: 0,
      p_i_score: 0
    });
    refresh();
    setupModalRef.current?.close();
  };

  const handleEdit = (cat: SafetyCategory) => {
    setEditingCategory(cat);
    setFormData({
      code: cat.code,
      description: cat.description,
      scoring_system: cat.scoring_system,
      p_i_score: cat.p_i_score
    });
    setupModalRef.current?.showModal();
  };

  const openDeleteModal = (id: number) => {
    setCategoryToDelete(id);
    deleteModalRef.current?.showModal();
  };

  const confirmDelete = () => {
    if (categoryToDelete !== null) {
      db.deleteSafetyCategory(categoryToDelete);
      setCategoryToDelete(null);
      deleteModalRef.current?.close();
      refresh();
    }
  };

  const filteredCategories = categories.filter(c => 
    c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold">Safety Event Configuration</h2>
          <p className="text-base-content/60">Manage violation types and credit categories</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => {
            setEditingCategory(null);
            setFormData({ code: '', description: '', scoring_system: 0, p_i_score: 0 });
            setupModalRef.current?.showModal();
          }}
        >
          <i className="fa-solid fa-plus mr-2"></i> Add Category
        </button>
      </header>

      <div className="card bg-base-100 shadow-xl border border-base-200">
        <div className="p-4 border-b border-base-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 opacity-40"></i>
            <input 
              type="text" 
              placeholder="Search by code or description..." 
              className="input input-bordered w-full pl-11" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-xs opacity-50 font-bold uppercase tracking-wider">{filteredCategories.length} Categories Defined</div>
        </div>

        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr className="bg-base-200/50">
                <th className="w-24">Code</th>
                <th>Description</th>
                <th className="text-center">Bonus Impact</th>
                <th className="text-center">P&I Impact</th>
                <th className="text-right">Manage</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 opacity-40 italic">No categories found.</td>
                </tr>
              ) : (
                filteredCategories.map(cat => (
                  <tr key={cat.category_id} className="hover">
                    <td className="font-mono text-xs font-bold">{cat.code}</td>
                    <td>{cat.description}</td>
                    <td className="text-center">
                      <span className={`badge badge-sm font-bold ${cat.scoring_system > 0 ? 'badge-error' : cat.scoring_system < 0 ? 'badge-success' : 'badge-ghost'}`}>
                        {cat.scoring_system > 0 ? `+${cat.scoring_system}` : cat.scoring_system}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`badge badge-sm font-bold ${cat.p_i_score > 0 ? 'badge-error' : cat.p_i_score < 0 ? 'badge-success' : 'badge-ghost'}`}>
                        {cat.p_i_score > 0 ? `+${cat.p_i_score}` : cat.p_i_score}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button className="btn btn-ghost btn-xs text-info" onClick={() => handleEdit(cat)}>
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button className="btn btn-ghost btn-xs text-error" onClick={() => openDeleteModal(cat.category_id)}>
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

      {/* Delete Confirmation Modal */}
      <dialog ref={deleteModalRef} className="modal">
        <div className="modal-box max-w-md text-center">
          <div className="bg-error/10 text-error p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-trash-can text-2xl"></i>
          </div>
          <h3 className="font-bold text-xl">Delete Category?</h3>
          <p className="py-2 opacity-70">Are you sure you want to delete this safety category? Logged events using this category will still exist, but new events cannot use it.</p>
          <div className="modal-action flex justify-center gap-4">
            <button className="btn btn-ghost flex-1" onClick={() => deleteModalRef.current?.close()}>Cancel</button>
            <button className="btn btn-error flex-1" onClick={confirmDelete}>Delete</button>
          </div>
        </div>
      </dialog>

      <dialog ref={setupModalRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-xl mb-6">{editingCategory ? 'Update Safety Category' : 'New Safety Category'}</h3>
          <div className="space-y-4">
            <div className="form-control">
              <label className="label font-bold text-xs uppercase opacity-70">Category Code</label>
              <input type="text" className="input input-bordered" placeholder="e.g. B0001" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
            </div>
            <div className="form-control">
              <label className="label font-bold text-xs uppercase opacity-70">Description</label>
              <textarea className="textarea textarea-bordered h-24" placeholder="Detailed description..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label font-bold text-xs uppercase opacity-70">Bonus Pts Impact</label>
                <input type="number" className="input input-bordered" value={formData.scoring_system} onChange={e => setFormData({...formData, scoring_system: Number(e.target.value)})} />
              </div>
              <div className="form-control">
                <label className="label font-bold text-xs uppercase opacity-70">P&I Pts Impact</label>
                <input type="number" className="input input-bordered" value={formData.p_i_score} onChange={e => setFormData({...formData, p_i_score: Number(e.target.value)})} />
              </div>
            </div>
          </div>
          <div className="modal-action mt-8">
            <button className="btn btn-ghost" onClick={() => setupModalRef.current?.close()}>Cancel</button>
            <button className="btn btn-primary px-8" onClick={handleSave}>{editingCategory ? 'Save Changes' : 'Create Category'}</button>
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default SafetyEventSetup;
