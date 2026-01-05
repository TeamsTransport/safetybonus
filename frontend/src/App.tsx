import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Drivers from './pages/Drivers';
import SafetyEvents from './pages/SafetyEvents';
import Scorecards from './pages/Scorecards';
import Trucks from './pages/Trucks';
import ScorecardSetup from './pages/ScorecardSetup';
import DriverSetup from './pages/DriverSetup';
import SafetyEventSetup from './pages/SafetyEventSetup';
import DriverTypeSetup from './pages/DriverTypeSetup';

const Sidebar = () => {
  const location = useLocation();
  const menuItems = [
    { path: '/', icon: 'fa-chart-line', label: 'Dashboard' },
    { path: '/drivers', icon: 'fa-users', label: 'Drivers' },
    { path: '/safety-events', icon: 'fa-triangle-exclamation', label: 'Safety Events' },
    { path: '/scorecards', icon: 'fa-clipboard-check', label: 'Scorecards' },
  ];

  const adminItems = [
    { path: '/trucks', icon: 'fa-truck', label: 'Trucks' },
    { path: '/driver-setup', icon: 'fa-user-gear', label: 'Driver Setup' },
    { path: '/driver-type-setup', icon: 'fa-id-card-clip', label: 'Driver Type Setup' },
    { path: '/safety-event-setup', icon: 'fa-triangle-exclamation', label: 'Safety Event Setup' },
    { path: '/scorecard-setup', icon: 'fa-gears', label: 'Scorecard Setup' },
  ];

  return (
    <div className="drawer lg:drawer-open">
      <input id="my-drawer-2" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col p-4 md:p-8 bg-base-200 min-h-screen relative">
        <label htmlFor="my-drawer-2" className="btn btn-primary drawer-button lg:hidden mb-4">
          <i className="fa-solid fa-bars mr-2"></i> Menu
        </label>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/trucks" element={<Trucks />} />
          <Route path="/safety-events" element={<SafetyEvents />} />
          <Route path="/scorecards" element={<Scorecards />} />
          <Route path="/scorecard-setup" element={<ScorecardSetup />} />
          <Route path="/driver-setup" element={<DriverSetup />} />
          <Route path="/driver-type-setup" element={<DriverTypeSetup />} />
          <Route path="/safety-event-setup" element={<SafetyEventSetup />} />
        </Routes>
      </div>
      <div className="drawer-side">
        <label htmlFor="my-drawer-2" className="drawer-overlay"></label>
        <ul className="menu p-4 w-80 min-h-full bg-base-100 text-base-content border-r border-base-300">
          <li className="mb-10 px-4 flex flex-col items-center">
            <div className="w-full flex flex-col items-center py-4">
              <div className="bg-primary/10 p-4 rounded-2xl mb-3">
                <i className="fa-solid fa-truck-fast text-5xl text-primary"></i>
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-black tracking-tighter text-base-content leading-none">Safe Driving</h1>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-[0.3em] mt-2">Bonus Tracker</p>
              </div>
            </div>
          </li>
          
          <div className="text-xs font-bold opacity-40 px-4 mb-2 uppercase tracking-widest">Main Menu</div>
          {menuItems.map((item) => (
            <li key={item.path} className="mb-1">
              <Link 
                to={item.path} 
                className={`${location.pathname === item.path ? 'active font-bold' : ''} transition-all`}
              >
                <i className={`fa-solid ${item.icon} w-6`}></i>
                {item.label}
              </Link>
            </li>
          ))}

          <div className="text-xs font-bold opacity-40 px-4 mb-2 mt-6 uppercase tracking-widest">Configuration</div>
          {adminItems.map((item) => (
            <li key={item.path} className="mb-1">
              <Link 
                to={item.path} 
                className={`${location.pathname === item.path ? 'active font-bold' : ''} transition-all`}
              >
                <i className={`fa-solid ${item.icon} w-6`}></i>
                {item.label}
              </Link>
            </li>
          ))}

          <div className="mt-auto p-4 border-t border-base-300 opacity-60 text-xs text-center">
            <p>© 2025 Teams Transport Inc.</p>
            <p>Safety Terminal v1.4.0</p>
          </div>
        </ul>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <HashRouter>
      <Sidebar />
    </HashRouter>
  );
}