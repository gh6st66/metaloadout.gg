/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { useLoadoutState, Loadout } from "./loadout-sharing";

// --- Type Definitions ---
type ClassType = "Light" | "Medium" | "Heavy";
type ViewState = { type: 'meta' | 'category' | 'builder'; content: string | number | null };

interface Catalog {
  weapons: any[];
  gadgets: any[];
  specializations: any[];
  metaLoadouts: any[];
}

// --- Helper Functions ---
const getAvailableItems = (items: any[], className: ClassType | ''): any[] => {
  if (!className) return [];
  return items.filter(item => {
    if (!item.class || item.class === 'All') return true;
    if (Array.isArray(item.class)) return item.class.includes(className);
    return item.class === className;
  }).sort((a, b) => a.name.localeCompare(b.name));
};

// --- React Components ---

const App = () => {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [view, setView] = useState<ViewState>({ type: 'meta', content: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    fetch('catalog.json')
      .then(res => res.json())
      .then(data => setCatalog(data))
      .catch(err => {
        console.error("Failed to load catalog:", err);
        setError("Could not load game data catalog. Please refresh the page.");
      });
  }, []);

  useEffect(() => {
    // If a shared loadout is in the URL, switch to the builder view on load.
    if (new URL(window.location.href).searchParams.has('l')) {
      setView({ type: 'builder', content: null });
    }
  }, []);

  if (error) {
    return <main><p className="error-message">{error}</p></main>;
  }

  if (!catalog) {
    return (
      <main>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading Game Catalog...</p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <header>
        <h1>THE FINALS Game Catalog & Builder</h1>
        <p>Explore meta builds, browse the catalog, or create your own loadout.</p>
      </header>
      <div className="app-container">
        <Sidebar catalog={catalog} setView={setView} activeView={view} />
        <ContentView catalog={catalog} view={view} />
      </div>
    </main>
  );
};

const Sidebar = ({ catalog, setView, activeView }) => {
  const isActive = (type, content) => activeView.type === type && activeView.content === content;

  return (
    <aside className="sidebar">
       <div className="sidebar-section">
        <h2>Tools</h2>
        <button
          className={`sidebar-button ${isActive('builder', null) ? 'active' : ''}`}
          onClick={() => setView({ type: 'builder', content: null })}
        >
          Loadout Builder
        </button>
      </div>
      <div className="sidebar-section">
        <h2>Meta Loadouts</h2>
        {catalog.metaLoadouts.map((loadout, index) => (
          <button
            key={index}
            className={`sidebar-button ${isActive('meta', index) ? 'active' : ''}`}
            onClick={() => setView({ type: 'meta', content: index })}
          >
            {loadout.class} - {loadout.weapon}
          </button>
        ))}
      </div>
      <div className="sidebar-section">
        <h2>Catalog</h2>
        <button className={`sidebar-button ${isActive('category', 'weapons') ? 'active' : ''}`} onClick={() => setView({ type: 'category', content: 'weapons' })}>Weapons</button>
        <button className={`sidebar-button ${isActive('category', 'gadgets') ? 'active' : ''}`} onClick={() => setView({ type: 'category', content: 'gadgets' })}>Gadgets</button>
        <button className={`sidebar-button ${isActive('category', 'specializations') ? 'active' : ''}`} onClick={() => setView({ type: 'category', content: 'specializations' })}>Specializations</button>
      </div>
    </aside>
  );
};

const ContentView = ({ catalog, view }) => {
  const renderContent = () => {
    switch (view.type) {
      case 'meta':
        const loadout = catalog.metaLoadouts[view.content as number];
        return <MetaLoadoutDetail loadout={loadout} />;
      case 'builder':
        return <LoadoutBuilder catalog={catalog} />;
      case 'category':
        const items = catalog[view.content as string];
        const categoryName = (view.content as string).charAt(0).toUpperCase() + (view.content as string).slice(1);
        return (
          <div className="card-list">
            <h2>{categoryName}</h2>
            {items.map(item => {
              switch (view.content) {
                case 'weapons': return <WeaponCard key={item.name} item={item} />;
                case 'gadgets': return <GadgetCard key={item.name} item={item} />;
                case 'specializations': return <SpecializationCard key={item.name} item={item} />;
                default: return null;
              }
            })}
          </div>
        );
      default:
        return <p>Select an item to view details.</p>;
    }
  };

  return (
    <div className="content-view">
      {renderContent()}
    </div>
  );
};

const LoadoutBuilder = ({ catalog }) => {
    const { loadout, setLoadout, shareURL, copyShareURL, reset } = useLoadoutState();
    const [copySuccess, setCopySuccess] = useState(false);

    const availableWeapons = useMemo(() => getAvailableItems(catalog.weapons, loadout.class), [catalog.weapons, loadout.class]);
    const availableSpecs = useMemo(() => getAvailableItems(catalog.specializations, loadout.class), [catalog.specializations, loadout.class]);
    const availableGadgets = useMemo(() => getAvailableItems(catalog.gadgets, loadout.class), [catalog.gadgets, loadout.class]);

    const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setLoadout({
            class: e.target.value as ClassType,
            weapon: '',
            specialization: '',
            gadgets: []
        });
    };

    const handleGadgetToggle = (gadgetName: string) => {
        const newGadgets = [...loadout.gadgets];
        const index = newGadgets.indexOf(gadgetName);
        if (index > -1) {
            newGadgets.splice(index, 1);
        } else if (newGadgets.length < 3) {
            newGadgets.push(gadgetName);
        }
        setLoadout(prev => ({ ...prev, gadgets: newGadgets }));
    };

    const handleCopy = async () => {
        const success = await copyShareURL();
        if (success) {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        }
    };
    
    // Effect to reset incompatible selections if class changes
    useEffect(() => {
      if (loadout.class) {
        if (loadout.weapon && !availableWeapons.some(w => w.name === loadout.weapon)) {
          setLoadout(prev => ({ ...prev, weapon: '' }));
        }
        if (loadout.specialization && !availableSpecs.some(s => s.name === loadout.specialization)) {
          setLoadout(prev => ({ ...prev, specialization: '' }));
        }
        const filteredGadgets = loadout.gadgets.filter(g => availableGadgets.some(ag => ag.name === g));
        if (filteredGadgets.length !== loadout.gadgets.length) {
          setLoadout(prev => ({ ...prev, gadgets: filteredGadgets }));
        }
      }
    }, [loadout.class, availableWeapons, availableSpecs, availableGadgets, setLoadout]);


    return (
        <div className="card large-card loadout-builder">
            <h2 className="class-title">Loadout Builder</h2>
            <div className="builder-grid">
                {/* Class Selection */}
                <div className="builder-item">
                    <label htmlFor="class-select">Class</label>
                    <select id="class-select" className="select-control" value={loadout.class} onChange={handleClassChange}>
                        <option value="" disabled>Select a Class</option>
                        <option value="Light">Light</option>
                        <option value="Medium">Medium</option>
                        <option value="Heavy">Heavy</option>
                    </select>
                </div>
                
                {/* Weapon Selection */}
                <div className="builder-item">
                    <label htmlFor="weapon-select">Weapon</label>
                    <select id="weapon-select" className="select-control" value={loadout.weapon} onChange={e => setLoadout(p => ({...p, weapon: e.target.value}))} disabled={!loadout.class}>
                        <option value="" disabled>Select a Weapon</option>
                        {availableWeapons.map(w => <option key={w.name} value={w.name}>{w.name}</option>)}
                    </select>
                </div>

                {/* Specialization Selection */}
                <div className="builder-item full-width">
                     <label htmlFor="spec-select">Specialization</label>
                    <select id="spec-select" className="select-control" value={loadout.specialization} onChange={e => setLoadout(p => ({...p, specialization: e.target.value}))} disabled={!loadout.class}>
                        <option value="" disabled>Select a Specialization</option>
                        {availableSpecs.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                </div>

                {/* Gadget Selection */}
                <div className="builder-item full-width">
                    <label>Gadgets (Select up to 3)</label>
                    <div className="gadget-selector">
                        {availableGadgets.map(g => (
                            <button 
                                key={g.name}
                                className={`gadget-button ${loadout.gadgets.includes(g.name) ? 'selected' : ''}`}
                                onClick={() => handleGadgetToggle(g.name)}
                                disabled={!loadout.gadgets.includes(g.name) && loadout.gadgets.length >= 3}
                            >
                                {g.name}
                            </button>
                        ))}
                         {availableGadgets.length === 0 && loadout.class && <p className="no-items-placeholder">No gadgets available for this class.</p>}
                         {!loadout.class && <p className="no-items-placeholder">Select a class to see available gadgets.</p>}
                    </div>
                </div>
            </div>

            <div className="share-controls">
                <h3>Share Loadout</h3>
                <div className="share-input-group">
                    <input type="text" readOnly value={shareURL || 'Select a class to generate a share link'} className="share-url-input" />
                    <button onClick={handleCopy} disabled={!shareURL} className="copy-button">
                        {copySuccess ? 'Copied!' : 'Copy'}
                    </button>
                </div>
            </div>

            <div className="actions-row">
                <button className="button-secondary" onClick={reset}>Clear & Reset</button>
            </div>
        </div>
    );
}

const MetaLoadoutDetail = ({ loadout }) => (
  <div className="card large-card">
    <h2 className={`class-title ${loadout.class.toLowerCase()}`}>{loadout.class} Meta Build</h2>
    <div className="meta-details">
      <div className="meta-item">
        <h3>Weapon</h3>
        <p>{loadout.weapon}</p>
      </div>
      <div className="meta-item">
        <h3>Specialization</h3>
        <p>{loadout.specialization}</p>
      </div>
      <div className="meta-item full-width">
        <h3>Gadgets</h3>
        <ul className="gadget-list">
          {loadout.gadgets.map(g => <li key={g}>{g}</li>)}
        </ul>
      </div>
      {loadout.metaNotes && (
        <div className="meta-notes full-width">
          <h3>Notes</h3>
          <p>{loadout.metaNotes}</p>
        </div>
      )}
    </div>
  </div>
);

const renderClassTag = (classType) => {
    const classes = Array.isArray(classType) ? classType : [classType];
    return (
        <div className="card-tags">
            {classes.map(c => (
                 <span key={c} className={`class-tag ${c.toLowerCase()}`}>{c}</span>
            ))}
        </div>
    );
}

const WeaponCard = ({ item }) => (
  <div className="card item-card">
    <div className="card-header">
      <h3>{item.name}</h3>
      {renderClassTag(item.class)}
    </div>
    <p className="item-type">{item.type}</p>
    <dl className="item-stats">
      {item.damage && <><dt>Damage</dt><dd>{item.damage}</dd></>}
      {item.headshotMultiplier && <><dt>Headshot x</dt><dd>{item.headshotMultiplier}</dd></>}
      {item.fireRate && <><dt>Fire Rate</dt><dd>{item.fireRate}</dd></>}
      {item.magSize && <><dt>Mag Size</dt><dd>{item.magSize}</dd></>}
    </dl>
    {item.notes && <p className="item-notes">{item.notes}</p>}
  </div>
);

const GadgetCard = ({ item }) => (
  <div className="card item-card">
    <div className="card-header">
      <h3>{item.name}</h3>
      {renderClassTag(item.class)}
    </div>
    <p className="item-type">{item.type}</p>
    <dl className="item-stats">
      {item.cooldown && <><dt>Cooldown</dt><dd>{item.cooldown}</dd></>}
      {item.effect && <><dt>Effect</dt><dd>{item.effect}</dd></>}
    </dl>
    {item.notes && <p className="item-notes">{item.notes}</p>}
  </div>
);

const SpecializationCard = ({ item }) => (
  <div className="card item-card">
    <div className="card-header">
      <h3>{item.name}</h3>
      {renderClassTag(item.class)}
    </div>
    {item.description && <p className="item-description">{item.description}</p>}
  </div>
);

const root = createRoot(document.getElementById("root")!);
root.render(<App />);