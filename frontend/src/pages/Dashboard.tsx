
import React, { useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { db } from '../services/dbStore';

const Dashboard = () => {
  const drivers = db.drivers;
  const events = db.safetyEvents;

  // --- Aggregate Stats ---
  const totalEvents = events.length;
  const activeTrucks = db.trucks.filter(t => t.status === 'assigned').length;
  
  const avgBonusScore = useMemo(() => {
    if (totalEvents === 0) return 0;
    return events.reduce((s, e) => s + (Number(e.bonus_score) || 0), 0) / totalEvents;
  }, [events, totalEvents]);

  // --- Dynamic Risk Profile Calculation ---
  const riskProfileData = useMemo(() => {
    let low = 0, med = 0, high = 0;
    
    drivers.forEach(driver => {
      const stats = db.getDriverStats(driver.driver_id);
      if (stats.totalBonusScore > 10) high++;
      else if (stats.totalBonusScore > 5) med++;
      else low++;
    });

    const total = drivers.length || 1;
    return [
      { name: 'Low Risk (0-5)', value: Math.round((low / total) * 100), color: '#10b981', count: low },
      { name: 'Med Risk (6-10)', value: Math.round((med / total) * 100), color: '#f59e0b', count: med },
      { name: 'High Risk (>10)', value: Math.round((high / total) * 100), color: '#ef4444', count: high }
    ];
  }, [drivers, events]);

  // --- Logic for Weekly Trend of Top 5 Safety Events (3 Month Period) ---
  const trendData = useMemo(() => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentEvents = events.filter(e => new Date(e.event_date) >= threeMonthsAgo);

    // 1. Identify Top 5 Categories by frequency
    const categoryCounts: Record<number, number> = {};
    recentEvents.forEach(e => {
      categoryCounts[e.category_id] = (categoryCounts[e.category_id] || 0) + 1;
    });

    const top5CategoryIds = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => Number(id));

    const top5Details = top5CategoryIds.map(id => ({
      id,
      code: db.safetyCategories.find(c => c.category_id === id)?.code || `CAT-${id}`
    }));

    // 2. Generate 12 weeks of data points
    const weeks: any[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - (i * 7));
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      
      const label = `${monday.getMonth() + 1}/${monday.getDate()}`;
      const weekStart = new Date(monday.setHours(0,0,0,0));
      const weekEnd = new Date(monday);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const dataPoint: any = { week: label };
      
      top5Details.forEach(cat => {
        const count = recentEvents.filter(e => {
          const evDate = new Date(e.event_date);
          return e.category_id === cat.id && evDate >= weekStart && evDate < weekEnd;
        }).length;
        dataPoint[cat.code] = count;
      });

      weeks.push(dataPoint);
    }
    return { weeks, top5Details };
  }, [events, db.safetyCategories]);

  const recentLogs = useMemo(() => {
    return [...events].sort((a, b) => b.event_date.localeCompare(a.event_date)).slice(0, 5);
  }, [events]);

  const lineColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold">Fleet Command Center</h2>
          <p className="text-base-content/60">Safety performance monitoring & active bonus metrics</p>
        </div>
        <div className="flex gap-2">
          <div className="badge badge-success gap-2 py-4 px-4 font-bold shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            System Live
          </div>
        </div>
      </header>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stats shadow bg-base-100 border border-base-200">
          <div className="stat">
            <div className="stat-figure text-primary">
              <i className="fa-solid fa-users text-3xl opacity-30"></i>
            </div>
            <div className="stat-title text-xs uppercase font-black opacity-40">Active Drivers</div>
            <div className="stat-value text-primary">{drivers.length}</div>
            <div className="stat-desc font-medium">Full Roster Count</div>
          </div>
        </div>

        <div className="stats shadow bg-base-100 border border-base-200">
          <div className="stat">
            <div className="stat-figure text-secondary">
              <i className="fa-solid fa-triangle-exclamation text-3xl opacity-30"></i>
            </div>
            <div className="stat-title text-xs uppercase font-black opacity-40">Safety Events</div>
            <div className="stat-value text-secondary">{totalEvents}</div>
            <div className="stat-desc font-medium">Logged Violations/Credits</div>
          </div>
        </div>

        <div className="stats shadow bg-base-100 border border-base-200">
          <div className="stat">
            <div className="stat-figure text-success">
              <i className="fa-solid fa-award text-3xl opacity-30"></i>
            </div>
            <div className="stat-title text-xs uppercase font-black opacity-40">Avg Bonus Pts</div>
            <div className="stat-value text-success">{avgBonusScore.toFixed(1)}</div>
            <div className="stat-desc font-medium text-success">Goal: &lt; 5.0</div>
          </div>
        </div>

        <div className="stats shadow bg-base-100 border border-base-200">
          <div className="stat">
            <div className="stat-figure text-info">
              <i className="fa-solid fa-truck text-3xl opacity-30"></i>
            </div>
            <div className="stat-title text-xs uppercase font-black opacity-40">Fleet Utilization</div>
            <div className="stat-value text-info">{activeTrucks}</div>
            <div className="stat-desc font-medium">of {db.trucks.length} Units Assigned</div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card bg-base-100 shadow-xl col-span-2 border border-base-200">
          <div className="card-body">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="card-title text-lg font-bold">Top 5 Violation Trends</h3>
                <p className="text-xs opacity-50">Weekly frequency over the last 90 days</p>
              </div>
              <div className="badge badge-outline text-[10px] font-black uppercase tracking-tighter">12 Week Analysis</div>
            </div>
            <div className="h-[300px] w-full">
              {trendData.top5Details.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData.weeks}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis 
                      dataKey="week" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fill: 'currentColor', opacity: 0.5}}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fill: 'currentColor', opacity: 0.5}}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="circle"
                      wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}}
                    />
                    {trendData.top5Details.map((cat, idx) => (
                      <Line 
                        key={cat.id}
                        type="monotone" 
                        dataKey={cat.code} 
                        stroke={lineColors[idx % lineColors.length]} 
                        strokeWidth={4}
                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full opacity-30 italic">
                  <i className="fa-solid fa-chart-line text-4xl mb-2"></i>
                  <p>Insufficient data for trend analysis</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl border border-base-200">
          <div className="card-body">
            <h3 className="card-title text-lg font-bold">Driver Risk Distribution</h3>
            <p className="text-xs opacity-50 mb-4">Based on cumulative safety scores</p>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskProfileData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {riskProfileData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center Text for Donut */}
              <div className="absolute top-[58%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <span className="text-2xl font-black block leading-none">{drivers.length}</span>
                <span className="text-[10px] uppercase opacity-40 font-bold">Drivers</span>
              </div>
            </div>
            <div className="space-y-3 mt-4">
              {riskProfileData.map(item => (
                <div key={item.name} className="flex items-center justify-between text-xs font-bold p-2 rounded-lg bg-base-200/50">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span className="opacity-70">{item.name}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-sm badge-ghost opacity-50">{item.count} Drv</span>
                    <span className="text-sm">{item.value}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="card bg-base-100 shadow-xl overflow-hidden border border-base-200">
        <div className="card-body p-0">
          <div className="p-6 border-b border-base-200 flex justify-between items-center">
            <h3 className="card-title text-lg font-bold">Latest Safety Records</h3>
            <span className="text-xs font-bold opacity-40 uppercase tracking-widest">Showing 5 Most Recent</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr className="bg-base-200/50">
                  <th>Driver Profile</th>
                  <th>Event Date</th>
                  <th>Category Code</th>
                  <th className="text-center">Bonus Impact</th>
                  <th>Classification</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16 opacity-30 italic">No safety events recorded yet.</td>
                  </tr>
                ) : (
                  recentLogs.map(event => {
                    const driver = db.getDriver(event.driver_id);
                    const cat = db.safetyCategories.find(c => c.category_id === event.category_id);
                    const avatarUrl = driver?.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(`${driver?.first_name} ${driver?.last_name}`)}&background=random&color=fff&bold=true`;
                    
                    return (
                      <tr key={event.safety_event_id} className="hover:bg-base-200/40 transition-colors">
                        <td className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className="avatar">
                              <div className="w-9 rounded-full bg-base-300 ring-1 ring-base-300 ring-offset-2 overflow-hidden">
                                <img src={avatarUrl} alt="Avatar" />
                              </div>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-sm">{driver?.first_name} {driver?.last_name}</span>
                              <span className="text-[10px] opacity-40 font-mono">{driver?.driver_code}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm opacity-70">{new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </td>
                        <td><div className="badge badge-ghost font-mono text-[10px] py-3 px-3 uppercase tracking-tighter">{cat?.code || 'N/A'}</div></td>
                        <td className="text-center">
                          <span className={`font-black text-sm px-3 py-1 rounded-lg ${event.bonus_score > 0 ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
                            {event.bonus_score > 0 ? `+${event.bonus_score}` : event.bonus_score}
                          </span>
                        </td>
                        <td>
                          {event.bonus_period ? (
                            <div className="flex items-center gap-1 text-[10px] font-black uppercase text-primary">
                              <i className="fa-solid fa-clock-rotate-left"></i> Current Period
                            </div>
                          ) : (
                            <div className="text-[10px] font-black uppercase opacity-20">Archive</div>
                          )}
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
    </div>
  );
};

export default Dashboard;
