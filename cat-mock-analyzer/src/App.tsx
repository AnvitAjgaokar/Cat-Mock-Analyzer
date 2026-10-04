import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Mocks from './pages/Mocks';
import Settings from './pages/Settings';
import Wizard from './pages/Wizard';
import Analytics from './pages/Analytics';

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `text-sm px-3 py-1.5 rounded transition-colors ${
          isActive
            ? 'bg-accent/20 text-accent font-medium'
            : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [isLight, setIsLight] = React.useState(() => document.documentElement.classList.contains('theme-light'));

  const toggleTheme = () => {
    if (isLight) {
      document.documentElement.classList.remove('theme-light');
      setIsLight(false);
    } else {
      document.documentElement.classList.add('theme-light');
      setIsLight(true);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="border-b border-zinc-800 px-4 py-3 flex-shrink-0 h-[65px]">
        <div className="max-w-[1100px] mx-auto flex items-center gap-4 h-full">
          <span className="font-bold text-accent text-lg">CAT Mock Analyzer</span>
          <nav className="flex gap-1 ml-4 hidden md:flex">
            <NavItem to="/" label="Home" />
            <NavItem to="/mocks" label="Mocks" />
            <NavItem to="/analytics" label="Analytics" />
            <NavItem to="/settings" label="Settings" />
          </nav>
          
          <div className="ml-auto flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="text-zinc-400 hover:text-white transition-colors"
              title="Toggle Theme"
            >
              {isLight ? '🌙' : '☀️'}
            </button>
            <button 
              onClick={() => navigate('/mock/new')} 
              className="bg-accent hover:bg-accent-600 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
            >
              + New Mock
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-[1100px] mx-auto w-full">{children}</main>
    </div>
  );
}

function Stub({ name }: { name: string }) {
  return (
    <div className="p-8 text-zinc-400 text-center">
      <p className="text-2xl mb-2">🚧</p>
      <p className="font-semibold">{name}</p>
      <p className="text-sm">Coming in Phase 3</p>
    </div>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/mocks" element={<Layout><Mocks /></Layout>} />
        <Route path="/analytics" element={<Layout><Analytics /></Layout>} />
        <Route path="/settings" element={<Layout><Settings /></Layout>} />
        <Route path="/mock/:id" element={<Layout><Wizard /></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}
