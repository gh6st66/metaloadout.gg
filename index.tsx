/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { useLoadoutState, Loadout } from "./loadout-sharing";
import { GoogleGenAI, Type } from "@google/genai";


// --- Type Definitions ---
type ClassType = "Light" | "Medium" | "Heavy";
type AppView = "builder" | "meta" | "catalog";

interface Catalog {
  weapons: any[];
  gadgets: any[];
  specializations: any[];
  metaLoadouts: any[];
}

interface Analysis {
    playstyle: string;
    strengths: string[];
    weaknesses: string[];
    synergy_tips: string[];
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
  const [view, setView] = useState<AppView>('builder');
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
  
  // Effect to switch to builder if a share link is used
  useEffect(() => {
    if (new URL(window.location.href).searchParams.has('l')) {
      setView('builder');
    }
  }, []);

  const renderContent = () => {
    if (error) return <p className="error-message">{error}</p>;
    if (!catalog) {
      return (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading Game Catalog...</p>
        </div>
      );
    }

    switch(view) {
        case 'builder': return <LoadoutBuilder catalog={catalog} />;
        case 'meta': return <MetaLoadoutsPage catalog={catalog} />;
        case 'catalog': return <CatalogPage catalog={catalog} />;
        default: return <LoadoutBuilder catalog={catalog} />;
    }
  };
  
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>THE FINALS // LOADOUT_ANALYZER</h1>
        <nav>
          <button onClick={() => setView('builder')} className={view === 'builder' ? 'active' : ''}>Builder</button>
          <button onClick={() => setView('meta')} className={view === 'meta' ? 'active' : ''}>Meta Builds</button>
          <button onClick={() => setView('catalog')} className={view === 'catalog' ? 'active' : ''}>Catalog</button>
        </nav>
      </header>
      <main>
        {renderContent()}
      </main>
    </div>
  );
};

const LoadoutAnalysis = ({ analysis }: { analysis: Analysis }) => (
    <div className="analysis-result-grid" aria-live="polite">
        <div className="analysis-result-card">
            <h4><span className="icon">🎯</span>Playstyle</h4>
            <p>{analysis.playstyle}</p>
        </div>
        <div className="analysis-result-card">
            <h4><span className="icon">💪</span>Strengths</h4>
            <ul>
                {analysis.strengths.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
        </div>
        <div className="analysis-result-card">
            <h4><span className="icon">⚠️</span>Weaknesses</h4>
            <ul>
                {analysis.weaknesses.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
        </div>
        <div className="analysis-result-card">
            <h4><span className="icon">🤝</span>Synergies</h4>
             <ul>
                {analysis.synergy_tips.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
        </div>
    </div>
);


const LoadoutBuilder = ({ catalog }) => {
    const { loadout, setLoadout, shareURL, copyShareURL, reset } = useLoadoutState();
    const [copySuccess, setCopySuccess] = useState(false);
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState('');

    const availableWeapons = useMemo(() => getAvailableItems(catalog.weapons, loadout.class), [catalog.weapons, loadout.class]);
    const availableSpecs = useMemo(() => getAvailableItems(catalog.specializations, loadout.class), [catalog.specializations, loadout.class]);
    const availableGadgets = useMemo(() => getAvailableItems(catalog.gadgets, loadout.class), [catalog.gadgets, loadout.class]);

    const handleClassChange = (newClass: ClassType) => {
        setLoadout({
            class: newClass,
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
    
    useEffect(() => {
        setAnalysis(null);
        setAnalysisError('');
    }, [loadout]);

    const canAnalyze = loadout.class && loadout.weapon && loadout.specialization;

    const handleAnalyzeLoadout = useCallback(async () => {
        if (!canAnalyze) return;
        setIsAnalyzing(true);
        setAnalysis(null);
        setAnalysisError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Analyze this loadout for THE FINALS game: Class: ${loadout.class}, Weapon: ${loadout.weapon}, Specialization: ${loadout.specialization}, Gadgets: ${loadout.gadgets.join(', ') || 'None'}. Provide a tactical analysis.`;
            const analysisSchema = {
                type: Type.OBJECT,
                properties: {
                    playstyle: { type: Type.STRING, description: 'A brief 1-2 sentence summary of the optimal playstyle.' },
                    strengths: { type: Type.ARRAY, description: 'A list of 2-3 key strengths.', items: { type: Type.STRING } },
                    weaknesses: { type: Type.ARRAY, description: 'A list of 2-3 weaknesses or counters.', items: { type: Type.STRING } },
                    synergy_tips: { type: Type.ARRAY, description: 'A list of 2-3 tips on how the items work together.', items: { type: Type.STRING } }
                },
                required: ['playstyle', 'strengths', 'weaknesses', 'synergy_tips']
            };
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    systemInstruction: "You are an expert analyst for 'THE FINALS'. Your analysis is tactical, insightful, and concise, like a professional esports coach.",
                    responseMimeType: "application/json",
                    responseSchema: analysisSchema,
                }
            });
            setAnalysis(JSON.parse(response.text));
        } catch (err) {
            console.error("Analysis failed:", err);
            setAnalysisError("Failed to analyze the loadout. The model may be busy. Please try again.");
        } finally {
            setIsAnalyzing(false);
        }
    }, [loadout, canAnalyze]);
    
    return (
        <div className="builder-page">
            <div className={`builder-grid ${loadout.class ? loadout.class.toLowerCase() : ''}`}>
                <div className="builder-column class-column">
                    <h3><span className="col-num">01</span>CLASS & SPEC</h3>
                    <div className="class-selector">
                        {(['Light', 'Medium', 'Heavy'] as ClassType[]).map(c => 
                            <button key={c} className={`class-btn ${loadout.class === c ? 'active' : ''}`} onClick={() => handleClassChange(c)}>{c}</button>
                        )}
                    </div>
                    <ItemSelector 
                        items={availableSpecs}
                        onSelect={(itemName) => setLoadout(p => ({...p, specialization: itemName}))}
                        selectedValue={loadout.specialization}
                        title="Specialization"
                        disabled={!loadout.class}
                        placeholder="Select Specialization"
                        itemType="specialization"
                    />
                </div>
                <div className="builder-column weapon-column">
                    <h3><span className="col-num">02</span>WEAPON</h3>
                    <ItemSelector 
                        items={availableWeapons}
                        onSelect={(itemName) => setLoadout(p => ({...p, weapon: itemName}))}
                        selectedValue={loadout.weapon}
                        title="Weapon"
                        disabled={!loadout.class}
                        placeholder="Select Weapon"
                        itemType="weapon"
                    />
                </div>
                <div className="builder-column gadget-column">
                    <h3><span className="col-num">03</span>GADGETS (3)</h3>
                    <MultiItemSelector 
                        items={availableGadgets}
                        onToggle={handleGadgetToggle}
                        selectedValues={loadout.gadgets}
                        max={3}
                        title="Gadgets"
                        disabled={!loadout.class}
                        placeholder="Select Gadgets"
                    />
                </div>
            </div>
            
            <div className="action-bar">
                <div className="share-controls">
                     <input type="text" readOnly value={shareURL || 'Complete loadout to get share link'} className="share-url-input" aria-label="Shareable Loadout URL" />
                    <button onClick={handleCopy} disabled={!shareURL} className="action-btn">
                        {copySuccess ? 'COPIED!' : 'COPY'}
                    </button>
                </div>
                <button 
                    className="analyze-button"
                    onClick={handleAnalyzeLoadout} 
                    disabled={!canAnalyze || isAnalyzing}
                >
                    {isAnalyzing ? 'ANALYZING...' : 'ANALYZE LOADOUT'}
                </button>
                 <button className="action-btn secondary" onClick={reset}>RESET</button>
            </div>

            <div className="analysis-content">
                {isAnalyzing && (
                    <div className="analysis-spinner-container" role="status" aria-label="Analyzing loadout">
                        <div className="spinner"></div>
                        <p>AI COACH IS ANALYZING YOUR BUILD...</p>
                    </div>
                )}
                {analysisError && <div className="analysis-error" role="alert">{analysisError}</div>}
                {analysis && <LoadoutAnalysis analysis={analysis} />}
            </div>
        </div>
    );
}

const ItemSelector = ({ items, onSelect, selectedValue, title, disabled, placeholder, itemType }) => {
    const selectedItem = items.find(i => i.name === selectedValue);
    return (
        <div className={`item-selector ${disabled ? 'disabled' : ''}`}>
            {selectedItem ? (
                 <div className="selected-item-card">
                    <h4>{selectedItem.name}</h4>
                    {itemType === 'weapon' && <p className="item-sub">{selectedItem.type}</p>}
                    <button onClick={() => onSelect('')}>CHANGE</button>
                </div>
            ) : (
                <div className="item-placeholder">{placeholder}</div>
            )}
            {!disabled && !selectedValue && (
                <div className="item-list">
                    {items.map(item => <button key={item.name} onClick={() => onSelect(item.name)}>{item.name}</button>)}
                </div>
            )}
        </div>
    )
};

// Fix: Add 'title' to props destructuring to allow the 'title' prop to be passed without error.
const MultiItemSelector = ({ items, onToggle, selectedValues, max, title, disabled, placeholder }) => {
    return (
        <div className={`multi-item-selector ${disabled ? 'disabled' : ''}`}>
            <div className="selected-gadgets">
                {[...Array(max)].map((_, i) => {
                    const gadgetName = selectedValues[i];
                    if(gadgetName) {
                        return (
                            <div key={i} className="selected-gadget-card">
                                <span>{gadgetName}</span>
                                <button onClick={() => onToggle(gadgetName)}>✕</button>
                            </div>
                        )
                    }
                    return <div key={i} className="gadget-placeholder">{i === 0 && selectedValues.length === 0 ? placeholder : `SLOT ${i+1}`}</div>
                })}
            </div>
             {!disabled && (
                <div className="item-list">
                    {items.map(item => (
                        <button 
                            key={item.name} 
                            onClick={() => onToggle(item.name)} 
                            className={selectedValues.includes(item.name) ? 'selected' : ''}
                            disabled={!selectedValues.includes(item.name) && selectedValues.length >= max}
                        >
                            {item.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const MetaLoadoutsPage = ({ catalog }) => (
    <div className="page-container">
        <h2>Meta Loadouts</h2>
        <p className="page-description">Professionally curated top-tier loadouts for competitive play.</p>
        <div className="meta-grid">
            {catalog.metaLoadouts.map(loadout => <MetaLoadoutCard key={loadout.weapon} loadout={loadout} />)}
        </div>
    </div>
);

const MetaLoadoutCard = ({ loadout }) => (
  <div className={`card meta-card ${loadout.class.toLowerCase()}`}>
    <h3 className={`class-title ${loadout.class.toLowerCase()}`}>{loadout.class}</h3>
    <div className="meta-item">
        <h4>Weapon</h4>
        <p>{loadout.weapon}</p>
    </div>
    <div className="meta-item">
        <h4>Specialization</h4>
        <p>{loadout.specialization}</p>
    </div>
    <div className="meta-item">
        <h4>Gadgets</h4>
        <ul className="gadget-list">
            {loadout.gadgets.map(g => <li key={g}>{g}</li>)}
        </ul>
    </div>
    {loadout.metaNotes && (
        <div className="meta-notes">
            <p>{loadout.metaNotes}</p>
        </div>
    )}
  </div>
);

const CatalogPage = ({ catalog }) => {
    const [category, setCategory] = useState('weapons');
    
    const renderCards = () => {
        const items = catalog[category];
        switch(category) {
            case 'weapons': return items.map(i => <WeaponCard key={i.name} item={i}/>);
            case 'gadgets': return items.map(i => <GadgetCard key={i.name} item={i}/>);
            case 'specializations': return items.map(i => <SpecializationCard key={i.name} item={i}/>);
            default: return null;
        }
    }

    return (
         <div className="page-container">
            <h2>Item Catalog</h2>
            <p className="page-description">Browse all available weapons, gadgets, and specializations in the game.</p>
            <div className="catalog-nav">
                <button onClick={() => setCategory('weapons')} className={category === 'weapons' ? 'active' : ''}>Weapons</button>
                <button onClick={() => setCategory('gadgets')} className={category === 'gadgets' ? 'active' : ''}>Gadgets</button>
                <button onClick={() => setCategory('specializations')} className={category === 'specializations' ? 'active' : ''}>Specializations</button>
            </div>
            <div className="catalog-grid">
                {renderCards()}
            </div>
        </div>
    )
};

const renderClassTag = (classType) => {
    const classes = Array.isArray(classType) ? classType : [classType || 'All'];
    return (
        <div className="card-tags">
            {classes.map(c => <span key={c} className={`class-tag ${c.toLowerCase()}`}>{c}</span>)}
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
     {item.effect && <p className="item-notes">{item.effect}</p>}
  </div>
);

const SpecializationCard = ({ item }) => (
  <div className="card item-card">
    <div className="card-header">
      <h3>{item.name}</h3>
      {renderClassTag(item.class)}
    </div>
    {item.description && <p className="item-notes">{item.description}</p>}
  </div>
);

const root = createRoot(document.getElementById("root")!);
root.render(<App />);