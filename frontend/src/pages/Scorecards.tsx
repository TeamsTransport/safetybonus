import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/dbStore';
import { ScoreCardEvent } from '../types';

const Scorecards = () => {
  const deleteModalRef = useRef<HTMLDialogElement>(null);

  const [activeTab, setActiveTab] = useState<'SAFETY' | 'MAINTENANCE' | 'DISPATCH'>('SAFETY');
  const [selectedDriverId, setSelectedDriverId] = useState<number>(0);
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0].substring(0, 7)); // YYYY-MM
  const [overallNotes, setOverallNotes] = useState('');
  const [scores, setScores] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [hasExistingGrade, setHasExistingGrade] = useState(false);
  
  const [dbUpdateCount, setDbUpdateCount] = useState(0);

  const selectedDriver = useMemo(() => 
    db.drivers.find(d => d.driver_id === selectedDriverId), 
  [selectedDriverId]);

  const getMetricsForCategory = (cat: 'SAFETY' | 'MAINTENANCE' | 'DISPATCH') => {
    return db.scoreCard.filter(item => {
      const isCorrectTab = item.sc_category === cat;
      const isGlobal = !item.driver_type_id;
      const matchesDriverType = selectedDriver && item.driver_type_id === selectedDriver.driver_type_id;
      return isCorrectTab && (isGlobal || matchesDriverType);
    });
  };

  const activeMetrics = useMemo(() => getMetricsForCategory(activeTab), [activeTab, selectedDriver]);

  const categoryStats = useMemo(() => {
    const cats: ('SAFETY' | 'MAINTENANCE' | 'DISPATCH')[] = ['SAFETY', 'MAINTENANCE', 'DISPATCH'];
    return cats.map(cat => {
      if (!selectedDriverId || !eventDate) return { name: cat, label: '---', icon: null, color: 'opacity-20', bg: 'bg-base-200' };
      const metrics = getMetricsForCategory(cat);
      if (metrics.length === 0) return { name: cat, label: 'N/A', icon: <i className="fa-solid fa-ban"></i>, color: 'opacity-30', bg: 'bg-base-200' };
      const events = db.getScoreCardEvents(selectedDriverId, eventDate, cat);
      
      const totalEarned = events.reduce((sum, e) => sum + e.sc_score, 0);
      
      if (events.length === 0) return { name: cat, label: 'Pending', icon: <i className="fa-solid fa-triangle-exclamation"></i>, color: 'text-warning', bg: 'bg-warning/10' };
      
      const totalPossible = metrics.length * 5;
      const percentage = Math.round((totalEarned / (totalPossible || 1)) * 100);
      
      if (percentage === 100) return { name: cat, label: '100%', icon: <i className="fa-solid fa-circle-check"></i>, color: 'text-success', bg: 'bg-success/10' };
      if (percentage === 0) return { name: cat, label: '0%', icon: <i className="fa-solid fa-circle-xmark"></i>, color: 'text-error', bg: 'bg-error/10' };
      
      return { name: cat, label: `${percentage}%`, icon: <i className="fa-solid fa-circle-info"></i>, color: 'text-info', bg: 'bg-info/10' };
    });
  }, [selectedDriverId, eventDate, selectedDriver, dbUpdateCount]);

  useEffect(() => {
    if (selectedDriverId && eventDate) {
      const existingEvents = db.getScoreCardEvents(selectedDriverId, eventDate, activeTab);
      if (existingEvents.length > 0) {
        setHasExistingGrade(true);
        const newScores: Record<number, number> = {};
        existingEvents.forEach(e => newScores[e.sc_category_id] = e.sc_score);
        setOverallNotes(existingEvents[0].notes || '');
        activeMetrics.forEach(item => { 
          if (newScores[item.sc_category_id] === undefined) newScores[item.sc_category_id] = 0; 
        });
        setScores(newScores);
      } else {
        setHasExistingGrade(false);
        setOverallNotes('');
        const blankScores: Record<number, number> = {};
        activeMetrics.forEach(item => blankScores[item.sc_category_id] = 0);
        setScores(blankScores);
      }
    }
  }, [selectedDriverId, eventDate, activeTab, activeMetrics]);

  const handleSubmit = async () => {
    if (selectedDriverId === 0) return;
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 600));
    db.deleteScoreCardEvents(selectedDriverId, eventDate, activeTab);
    activeMetrics.forEach(item => {
      db.addScoreCardEvent({
        driver_id: selectedDriverId,
        sc_category_id: item.sc_category_id,
        sc_score: scores[item.sc_category_id] ?? 0,
        event_date: `${eventDate}-01`,
        notes: overallNotes
      });
    });
    setHasExistingGrade(true);
    setIsSubmitting(false);
    setShowSuccess(true);
    setDbUpdateCount(prev => prev + 1);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const confirmDeleteGrade = () => {
    db.deleteScoreCardEvents(selectedDriverId, eventDate, activeTab);
    setHasExistingGrade(false);
    setOverallNotes('');
    const blankScores: Record<number, number> = {};
    activeMetrics.forEach(item => blankScores[item.sc_category_id] = 0);
    setScores(blankScores);
    setDbUpdateCount(prev => prev + 1);
    deleteModalRef.current?.close();
  };

  const getDriver = (id: number) => db.drivers.find(d => d.driver_id === id);

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold">Monthly Scorecard Entry</h2>
          <p className="text-base-content/60">Grading qualitative performance indicators for driver bonuses</p>
        </div>
        <div className="flex items-center gap-3">
          {hasExistingGrade && <div className="badge badge-info gap-2 py-4 px-4 font-bold shadow-sm">Grade Loaded</div>}
          {showSuccess && <div className="alert alert-success py-2 px-4 shadow-lg w-auto animate-bounce">Grades saved!</div>}
        </div>
      </header>

      <div className="card bg-base-100 shadow-xl border border-base-200">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4 items-end">
            <div className="form-control">
              <label className="label font-bold text-xs uppercase opacity-70">1. Select Driver</label>
              <select className="select select-bordered" value={selectedDriverId} onChange={(e) => setSelectedDriverId(Number(e.target.value))}>
                <option value={0}>Choose driver...</option>
                {db.drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.first_name} {d.last_name}</option>)}
              </select>
            </div>
            <div className="form-control">
              <label className="label font-bold text-xs uppercase opacity-70">2. Review Period</label>
              <input type="month" className="input input-bordered" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <div className="flex justify-center md:justify-end">
              <div className="tabs tabs-boxed bg-base-200 p-1">
                {['SAFETY', 'MAINTENANCE', 'DISPATCH'].map(cat => (
                  <button key={cat} className={`tab transition-all ${activeTab === cat ? 'tab-active font-bold' : ''}`} onClick={() => setActiveTab(cat as any)}>{cat}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {categoryStats.map(stat => (
              <div key={stat.name} className={`p-3 rounded-xl border border-base-300 flex items-center justify-between ${stat.bg} transition-all duration-300`}>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase opacity-40 tracking-widest">{stat.name}</span>
                  <span className={`text-lg font-black flex items-center gap-2 ${stat.color}`}>{stat.icon}{stat.label}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {activeMetrics.map(item => {
              const currentScore = scores[item.sc_category_id] ?? 0;
              return (
                <div key={item.sc_category_id} className="p-6 bg-base-200/50 hover:bg-base-200 rounded-2xl border border-base-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="text-left w-full md:w-auto md:flex-1">
                    <h4 className="font-bold text-lg leading-tight">{item.sc_description}</h4>
                    <p className="text-[10px] opacity-40 uppercase font-black tracking-widest mt-1">Classification: {selectedDriver?.driver_type_id ? db.driverTypes.find(t => t.driver_type_id === selectedDriver.driver_type_id)?.driver_type : 'Global'}</p>
                  </div>
                  
                  <div className="flex flex-col items-end w-full md:w-auto">
                    <div className="flex items-center gap-4 bg-base-100 px-6 py-3 rounded-full border border-base-300 shadow-sm transition-shadow hover:shadow-md">
                      {/* Integrated Zero/No Score Label & Radio */}
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black transition-opacity uppercase tracking-tighter ${currentScore === 0 ? 'opacity-100 text-neutral' : 'opacity-30'}`}>Zero</span>
                        <input 
                          type="radio" 
                          name={`rating-${item.sc_category_id}`} 
                          className="radio radio-sm border-neutral checked:bg-neutral" 
                          checked={currentScore === 0}
                          onChange={() => setScores(prev => ({ ...prev, [item.sc_category_id]: 0 }))}
                        />
                      </div>

                      <div className="h-6 w-[1px] bg-base-300 mx-1"></div>

                      {/* Standard Stars - Dynamically Greyed when Zero is selected */}
                      <div className="rating rating-md gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <input 
                            key={star} 
                            type="radio" 
                            name={`rating-${item.sc_category_id}`} 
                            className={`mask mask-star-2 ${currentScore === 0 ? 'bg-base-300' : 'bg-orange-400'}`} 
                            checked={currentScore === star} 
                            onChange={() => setScores(prev => ({ ...prev, [item.sc_category_id]: star }))} 
                          />
                        ))}
                      </div>
                    </div>
                    
                    {/* Score Indicator */}
                    <div className="mt-2 pr-4 text-right">
                      <span className="text-[10px] font-black opacity-30 uppercase tracking-widest block">
                        {currentScore === 0 ? 'No Credits Earned' : `Score: ${currentScore} / 5`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedDriverId !== 0 && (
            <div className="mt-10 pt-6 border-t border-base-200 space-y-6">
              <textarea className="textarea textarea-bordered h-24 w-full" placeholder="Overall Performance Notes..." value={overallNotes} onChange={(e) => setOverallNotes(e.target.value)}></textarea>
              <div className="flex justify-between items-center">
                <div className="text-sm opacity-60 flex items-center gap-2">
                  <i className="fa-solid fa-circle-info text-info"></i>
                  Scoring affects bonus eligibility and safety standing.
                </div>
                <div className="flex gap-2">
                  {hasExistingGrade && <button className="btn btn-outline btn-error" onClick={() => deleteModalRef.current?.showModal()}>Delete Grade</button>}
                  <button className={`btn btn-primary px-10 ${isSubmitting ? 'loading' : ''}`} onClick={handleSubmit} disabled={isSubmitting || activeMetrics.length === 0}>Save {activeTab} Grade</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <dialog ref={deleteModalRef} className="modal">
        <div className="modal-box max-w-md text-center">
          <div className="bg-error/10 text-error p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-trash-can text-2xl"></i>
          </div>
          <h3 className="font-bold text-xl">Delete Evaluation?</h3>
          <p className="py-2 opacity-70">Are you sure you want to delete the {activeTab} evaluation for {getDriver(selectedDriverId)?.first_name}?</p>
          <div className="modal-action flex justify-center gap-4">
            <button className="btn btn-ghost flex-1" onClick={() => deleteModalRef.current?.close()}>Cancel</button>
            <button className="btn btn-error flex-1" onClick={confirmDeleteGrade}>Delete</button>
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default Scorecards;
