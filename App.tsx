
import React, { useState, useMemo } from 'react';
import { 
  OSPAScoreState, 
  Level, 
  Rank, 
  Position, 
  Achievement, 
  LeadershipEntry, 
  ServiceEntry, 
  InterviewScores,
  RatingEntry,
  MOVFile
} from './types';
import { SCORING_RUBRIC } from './constants';

const NCR_DIVISIONS = [
  "Caloocan",
  "Las Piñas",
  "Makati",
  "Malabon",
  "Mandaluyong",
  "Manila",
  "Marikina",
  "Muntinlupa",
  "Navotas",
  "Parañaque",
  "Pasay",
  "Pasig",
  "Quezon City",
  "San Juan",
  "Taguig City and Pateros (TAPAT)",
  "Valenzuela"
];

// Deployed Google Apps Script Web App URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHlgnvlzqFfvMxy02xY_gor93x8rzZEBB0LUjEJfD3rr5Qj_5c2t5irOvzg8gUA7oN/exec";

const INITIAL_STATE: OSPAScoreState = {
  candidateName: '',
  division: '',
  schoolName: '',
  movFile: null,
  performanceRatings: [
    { year: '2024-2025', score: 4.0 },
    { year: '2023-2024', score: 4.0 },
    { year: '2022-2023', score: 4.0 },
    { year: '2021-2022', score: 4.0 },
    { year: '2020-2021', score: 4.0 },
  ],
  individualContests: [],
  groupContests: [],
  specialAwards: [],
  publicationContests: [],
  leadership: [],
  extensionServices: [],
  innovations: [],
  speakership: [],
  publishedBooks: [],
  publishedArticles: [],
  interview: {
    principles: 0,
    leadership: 0,
    engagement: 0,
    commitment: 0,
    communication: 0
  }
};

const App: React.FC = () => {
  const [data, setData] = useState<OSPAScoreState>(INITIAL_STATE);
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const averageRating = useMemo(() => {
    const sum = data.performanceRatings.reduce((acc, curr) => acc + curr.score, 0);
    return sum / data.performanceRatings.length;
  }, [data.performanceRatings]);

  const totals = useMemo(() => {
    const calculateAchievementScore = (items: Achievement[], rubric: any) => {
      let total = 0;
      Object.values(Level).forEach(lvl => {
        const levelItems = items.filter(i => i.level === lvl);
        const levelRubric = rubric[lvl];
        if (!levelRubric) return;
        let levelPoints = 0;
        levelItems.forEach(item => {
          levelPoints += (levelRubric[item.rank] || 0);
        });
        total += levelPoints * (levelRubric.weight || 0);
      });
      return total;
    };

    const calculateSectionScore = (items: ServiceEntry[], rubric: any) => {
      let totalPoints = 0;
      items.forEach(item => {
        totalPoints += (rubric[item.level] || 0);
      });
      return totalPoints * (rubric.weight || 1);
    };

    const indiv = calculateAchievementScore(data.individualContests, SCORING_RUBRIC.INDIVIDUAL);
    const group = calculateAchievementScore(data.groupContests, SCORING_RUBRIC.GROUP);
    const special = calculateAchievementScore(data.specialAwards, SCORING_RUBRIC.SPECIAL_AWARDS);
    const pub = calculateAchievementScore(data.publicationContests, SCORING_RUBRIC.PUBLICATION);
    
    const leadershipScoresByLevel = { [Level.NATIONAL]: 0, [Level.REGIONAL]: 0, [Level.DIVISION]: 0 };
    data.leadership.forEach(entry => {
      const levelRubric = (SCORING_RUBRIC.LEADERSHIP as any)[entry.level];
      const pts = levelRubric?.[entry.position] || 0;
      if (pts > leadershipScoresByLevel[entry.level as keyof typeof leadershipScoresByLevel]) {
        leadershipScoresByLevel[entry.level as keyof typeof leadershipScoresByLevel] = pts;
      }
    });
    const leadershipTotal = (Object.values(leadershipScoresByLevel) as number[]).reduce((a: number, b: number) => a + b, 0) * SCORING_RUBRIC.LEADERSHIP.weight;

    const extension = calculateSectionScore(data.extensionServices, SCORING_RUBRIC.EXTENSION);
    const innovations = calculateSectionScore(data.innovations, SCORING_RUBRIC.INNOVATIONS);
    const speakership = calculateSectionScore(data.speakership, SCORING_RUBRIC.SPEAKERSHIP);
    const books = calculateSectionScore(data.publishedBooks, SCORING_RUBRIC.BOOKS);
    const articles = calculateSectionScore(data.publishedArticles, SCORING_RUBRIC.ARTICLES);
    
    const interviewRaw = (Object.values(data.interview) as number[]).reduce((a: number, b: number) => a + b, 0);
    const interviewTotal = interviewRaw * 2;

    const grandTotal = indiv + group + special + pub + leadershipTotal + extension + innovations + speakership + books + articles + interviewTotal;

    return {
      indiv, group, special, pub, leadershipTotal, extension, innovations, speakership, books, articles, interviewTotal, grandTotal
    };
  }, [data]);

  const isFormValid = useMemo(() => {
    return (
      data.division !== '' && 
      data.schoolName.trim() !== '' && 
      data.candidateName.trim() !== '' &&
      data.movFile !== null
    );
  }, [data.division, data.schoolName, data.candidateName, data.movFile]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert("Invalid Format: Please upload a PDF file only.");
      return;
    }

    // Google Apps Script payload limit is approx 50MB, but base64 increases size. 15MB is a safe limit.
    if (file.size > 15 * 1024 * 1024) {
      alert("File too large: Please limit your consolidated PDF to 15MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      setData(prev => ({
        ...prev,
        movFile: {
          name: file.name, // Original name temporarily stored
          data: base64String,
          mimeType: file.type
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!isFormValid) {
      setShowValidationErrors(true);
      setActiveTab('basic');
      let missingFields = [];
      if (!data.division) missingFields.push("Division");
      if (!data.schoolName) missingFields.push("School Name");
      if (!data.candidateName) missingFields.push("Candidate Name");
      if (!data.movFile) missingFields.push("Consolidated MOV PDF");
      
      alert(`Validation Error: Please complete the following:\n- ${missingFields.join('\n- ')}`);
      return;
    }

    setIsSubmitting(true);

    // Apply strict naming convention: Division_School_Name.pdf (sanitizing special characters)
    const sanitizedName = data.candidateName.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
    const sanitizedSchool = data.schoolName.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
    const finalFileName = `${data.division}_${sanitizedSchool}_${sanitizedName}.pdf`;
    
    const updatedMOV = data.movFile ? { ...data.movFile, name: finalFileName } : null;

    const payload = {
      timestamp: new Date().toLocaleString(),
      candidateName: data.candidateName,
      division: data.division,
      schoolName: data.schoolName,
      averageRating: averageRating.toFixed(3),
      grandTotal: totals.grandTotal.toFixed(2),
      movFile: updatedMOV,
      details: {
        contests: (totals.indiv + totals.group + totals.special + totals.pub).toFixed(2),
        leadership: totals.leadershipTotal.toFixed(2),
        services: (totals.extension + totals.innovations + totals.speakership).toFixed(2),
        interview: totals.interviewTotal.toFixed(2)
      },
      rawJson: JSON.stringify(data)
    };

    try {
      // Sending payload to Apps Script. mode: 'no-cors' is required for simple Web App triggers.
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      alert(`Submission successful!\n\n1. MOV PDF saved as: ${finalFileName}\n2. Record saved to the Sheet.\n\nYou can now check the Drive folder and Google Sheet.`);
      setShowValidationErrors(false);
    } catch (error) {
      console.error("Submission error:", error);
      alert("Submission failed. Ensure your Google Apps Script is correctly deployed as a Web App with access for 'Anyone'.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateRating = (year: string, score: number) => {
    setData(prev => ({
      ...prev,
      performanceRatings: prev.performanceRatings.map(r => r.year === year ? { ...r, score } : r)
    }));
  };

  const addItem = (category: keyof OSPAScoreState, newItem: any) => {
    setData(prev => ({
      ...prev,
      [category]: [...(prev[category] as any[]), { ...newItem, id: Math.random().toString(36).substr(2, 9) }]
    }));
  };

  const removeItem = (category: keyof OSPAScoreState, id: string) => {
    setData(prev => ({
      ...prev,
      [category]: (prev[category] as any[]).filter(item => item.id !== id)
    }));
  };

  const renderAchievementSection = (title: string, category: keyof OSPAScoreState, ranks: Rank[], levels: Level[]) => (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-black text-slate-800 tracking-tight">{title}</h3>
        <span className="bg-indigo-600 text-white px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest">
          Weighted: {totals[category as keyof typeof totals]?.toFixed(2) || '0.00'}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <select id={`${category}-lvl`} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100">
          {levels.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select id={`${category}-rnk`} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100">
          {ranks.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input id={`${category}-yr`} type="text" placeholder="Year" className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100" />
        <button 
          onClick={() => {
            const lvl = (document.getElementById(`${category}-lvl`) as HTMLSelectElement).value as Level;
            const rnk = (document.getElementById(`${category}-rnk`) as HTMLSelectElement).value as Rank;
            const yr = (document.getElementById(`${category}-yr`) as HTMLInputElement).value;
            if (yr) {
              addItem(category, { level: lvl, rank: rnk, year: yr });
              (document.getElementById(`${category}-yr`) as HTMLInputElement).value = '';
            }
          }}
          className="bg-indigo-600 text-white px-4 py-3 rounded-xl hover:bg-indigo-700 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100"
        >
          Add Achievement
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <th className="py-3 px-2">Level</th>
              <th className="py-3 px-2">Rank</th>
              <th className="py-3 px-2">Year</th>
              <th className="py-3 px-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {(data[category] as Achievement[]).map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-2 text-xs font-bold text-slate-700">{item.level}</td>
                <td className="py-3 px-2 text-xs font-bold text-slate-700">{item.rank}</td>
                <td className="py-3 px-2 text-xs font-bold text-slate-700">{item.year}</td>
                <td className="py-3 px-2 text-right">
                  <button onClick={() => removeItem(category, item.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all">
                    <i className="fas fa-trash-alt text-xs"></i>
                  </button>
                </td>
              </tr>
            ))}
            {(data[category] as Achievement[]).length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-slate-400 text-[10px] font-bold italic tracking-widest">No entries added yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderServiceSection = (title: string, category: keyof OSPAScoreState, levels: Level[]) => (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-black text-slate-800 tracking-tight">{title}</h3>
        <span className="bg-emerald-600 text-white px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest">
          Weighted: {totals[category as keyof typeof totals]?.toFixed(2) || '0.00'}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <select id={`${category}-slvl`} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-100">
          {levels.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <button 
          onClick={() => {
            const lvl = (document.getElementById(`${category}-slvl`) as HTMLSelectElement).value as Level;
            addItem(category, { level: lvl });
          }}
          className="bg-emerald-600 text-white px-4 py-3 rounded-xl hover:bg-emerald-700 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 col-span-2"
        >
          Add Service Entry
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <th className="py-3 px-2">Level</th>
              <th className="py-3 px-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {(data[category] as ServiceEntry[]).map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-2 text-xs font-bold text-slate-700">{item.level}</td>
                <td className="py-3 px-2 text-right">
                  <button onClick={() => removeItem(category, item.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all">
                    <i className="fas fa-trash-alt text-xs"></i>
                  </button>
                </td>
              </tr>
            ))}
            {(data[category] as ServiceEntry[]).length === 0 && (
              <tr><td colSpan={2} className="py-8 text-center text-slate-400 text-[10px] font-bold italic tracking-widest">No entries added yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 bg-slate-50 selection:bg-indigo-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl shadow-indigo-100">
              <i className="fas fa-newspaper"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black text-indigo-900 leading-tight tracking-tight">OSPA SCORER</h1>
              <p className="text-[10px] text-slate-400 font-black tracking-[0.2em] uppercase">DepEd NCR Journalism</p>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-10">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Score</p>
              <p className="text-4xl font-black text-indigo-600 leading-none tabular-nums">{totals.grandTotal.toFixed(2)}</p>
            </div>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`px-10 py-4 rounded-[1.25rem] font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 shadow-2xl ${isSubmitting ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 shadow-indigo-200'}`}
            >
              {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-database"></i>}
              {isSubmitting ? 'Submitting...' : 'Save Record'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-3">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200 sticky top-28 space-y-8">
            <div className="space-y-6">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Profile Details</label>
              
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-2 ml-1 tracking-widest">Division</label>
                  <select 
                    className={`w-full p-4 bg-slate-50 border rounded-2xl text-xs font-bold outline-none transition-all ${showValidationErrors && !data.division ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-100 focus:ring-4 focus:ring-indigo-50'}`}
                    value={data.division}
                    onChange={e => setData({...data, division: e.target.value})}
                  >
                    <option value="">Choose Division...</option>
                    {NCR_DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-2 ml-1 tracking-widest">School</label>
                  <input 
                    type="text" 
                    placeholder="Enter school name" 
                    className={`w-full p-4 bg-slate-50 border rounded-2xl text-xs font-bold outline-none transition-all ${showValidationErrors && !data.schoolName.trim() ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-100 focus:ring-4 focus:ring-indigo-50'}`}
                    value={data.schoolName}
                    onChange={e => setData({...data, schoolName: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-2 ml-1 tracking-widest">Full Name</label>
                  <input 
                    type="text" 
                    placeholder="Surname, First Name" 
                    className={`w-full p-4 bg-slate-50 border rounded-2xl text-xs font-bold outline-none transition-all ${showValidationErrors && !data.candidateName.trim() ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-100 focus:ring-4 focus:ring-indigo-50'}`}
                    value={data.candidateName}
                    onChange={e => setData({...data, candidateName: e.target.value})}
                  />
                </div>

                <div className="pt-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-2 ml-1 tracking-widest">Consolidated MOV (PDF)</label>
                  <div className={`relative border-2 border-dashed rounded-[1.5rem] p-5 transition-all text-center group ${data.movFile ? 'border-emerald-500 bg-emerald-50' : (showValidationErrors && !data.movFile ? 'border-red-500 bg-red-50 animate-pulse' : 'border-slate-200 hover:border-indigo-400 bg-slate-50')}`}>
                    <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileUpload} />
                    <i className={`fas ${data.movFile ? 'fa-check-circle text-emerald-500' : 'fa-cloud-upload-alt text-slate-300 group-hover:text-indigo-400'} text-3xl mb-3`}></i>
                    <p className={`text-[9px] font-black uppercase tracking-widest truncate ${data.movFile ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {data.movFile ? data.movFile.name : 'Upload MOVs'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <nav className="space-y-1.5 pt-6 border-t border-slate-100">
              {[
                { id: 'basic', label: 'Ratings & Profile', icon: 'fa-chart-bar' },
                { id: 'contests', label: 'Contests', icon: 'fa-trophy' },
                { id: 'leadership', label: 'Leadership', icon: 'fa-user-tie' },
                { id: 'services', label: 'Extensions', icon: 'fa-lightbulb' },
                { id: 'interview', label: 'Interview', icon: 'fa-comment-dots' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}
                >
                  <i className={`fas ${tab.icon} w-5 text-center`}></i>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <section className="lg:col-span-9 space-y-8">
          {activeTab === 'basic' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200">
                  <div className="flex items-center gap-5 mb-10">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-sm">
                      <i className="fas fa-file-invoice"></i>
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-800 tracking-tight">IPCRF Rating History</h2>
                      <p className="text-slate-400 text-xs font-bold tracking-widest uppercase">Ratings for the last 5 evaluation cycles</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {data.performanceRatings.map((entry) => (
                      <div key={entry.year} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 group hover:border-indigo-200 transition-all">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">{entry.year}</label>
                        <input 
                          type="number"
                          step="0.001"
                          placeholder="0.000"
                          className="w-full bg-transparent text-2xl font-black text-indigo-600 outline-none group-focus-within:text-indigo-800"
                          value={entry.score}
                          onChange={(e) => updateRating(entry.year, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-10 p-8 bg-indigo-600 rounded-[2.5rem] flex items-center justify-between text-white shadow-2xl shadow-indigo-100">
                    <div className="flex items-center gap-6">
                       <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl">
                         <i className="fas fa-star-half-alt"></i>
                       </div>
                       <div>
                         <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Average Performance Grade</p>
                         <p className="text-4xl font-black">{averageRating.toFixed(3)}</p>
                       </div>
                    </div>
                    <div className="px-6 py-3 bg-white text-indigo-600 rounded-2xl text-xs font-black uppercase tracking-widest">
                      {averageRating >= 4.5 ? 'Outstanding' : averageRating >= 3.5 ? 'Very Satisfactory' : 'Needs Improvement'}
                    </div>
                  </div>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Journalism', value: (totals.indiv + totals.group + totals.special + totals.pub).toFixed(2), icon: 'fa-pen-fancy', color: 'text-amber-500' },
                    { label: 'Leadership', value: totals.leadershipTotal.toFixed(2), icon: 'fa-user-shield', color: 'text-indigo-500' },
                    { label: 'Extensions', value: (totals.extension + totals.innovations + totals.speakership).toFixed(2), icon: 'fa-share-nodes', color: 'text-emerald-500' },
                    { label: 'Interview', value: totals.interviewTotal.toFixed(2), icon: 'fa-user-check', color: 'text-blue-500' }
                  ].map((stat, i) => (
                    <div key={i} className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm transition-all hover:scale-105">
                      <div className={`w-10 h-10 ${stat.color} bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-xl`}>
                        <i className={`fas ${stat.icon}`}></i>
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
                      <p className="text-3xl font-black text-slate-800">{stat.value}</p>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {activeTab === 'contests' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {renderAchievementSection('1. Individual Journalism Contests', 'individualContests', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
              {renderAchievementSection('2. Group Journalism Contests', 'groupContests', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
              {renderAchievementSection('2.1 Special Awards (Group)', 'specialAwards', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
              {renderAchievementSection('3. Publication Contests', 'publicationContests', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
            </div>
          )}

          {activeTab === 'leadership' && (
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200 animate-in fade-in">
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-5">
                   <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl">
                     <i className="fas fa-users-cog"></i>
                   </div>
                   <h3 className="text-2xl font-black text-slate-800 tracking-tight">4. Leadership Roles</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Weighted Points</span>
                  <span className="text-4xl font-black text-indigo-600 leading-none">{totals.leadershipTotal.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10 p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Level</label>
                   <select id="lead-lvl" className="w-full p-4 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-50">
                     <option value={Level.NATIONAL}>National</option>
                     <option value={Level.REGIONAL}>Regional</option>
                     <option value={Level.DIVISION}>Division</option>
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Position</label>
                   <select id="lead-pos" className="w-full p-4 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-50">
                     <option value={Position.PRESIDENT}>President</option>
                     <option value={Position.VICE_PRESIDENT}>Vice President</option>
                     <option value={Position.OTHER}>Other Officer</option>
                   </select>
                </div>
                <div className="md:col-span-2 flex items-end">
                   <button 
                     onClick={() => {
                       const lvl = (document.getElementById('lead-lvl') as HTMLSelectElement).value as Level;
                       const pos = (document.getElementById('lead-pos') as HTMLSelectElement).value as Position;
                       addItem('leadership', { level: lvl, position: pos });
                     }}
                     className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                   >
                     Add Leadership Record
                   </button>
                </div>
              </div>

              <div className="space-y-4">
                {data.leadership.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-300 transition-all group">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-slate-50 text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-2xl flex items-center justify-center text-xl transition-all">
                        <i className="fas fa-certificate"></i>
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-sm tracking-tight">{item.position}</p>
                        <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">{item.level}</p>
                      </div>
                    </div>
                    <button onClick={() => removeItem('leadership', item.id)} className="w-10 h-10 flex items-center justify-center text-red-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all">
                      <i className="fas fa-times-circle text-lg"></i>
                    </button>
                  </div>
                ))}
                {data.leadership.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-[10px] font-bold italic tracking-widest uppercase">No leadership records found.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'services' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {renderServiceSection('5. Extension Services', 'extensionServices', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
              {renderServiceSection('Innovations & Advocacies', 'innovations', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION, Level.DISTRICT, Level.SCHOOL])}
              {renderServiceSection('6. Speakership Roles', 'speakership', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
              {renderServiceSection('7. Books & Modules', 'publishedBooks', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
              {renderServiceSection('8. Published Articles', 'publishedArticles', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
            </div>
          )}

          {activeTab === 'interview' && (
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200 animate-in fade-in">
              <div className="flex justify-between items-center mb-12">
                <div className="flex items-center gap-5">
                   <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl">
                     <i className="fas fa-user-check"></i>
                   </div>
                   <h3 className="text-2xl font-black text-slate-800 tracking-tight">9. Panel Interview</h3>
                </div>
                <div className="text-right">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Weighted (Max 10)</span>
                   <span className="text-4xl font-black text-blue-600 leading-none tabular-nums">{totals.interviewTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-12 max-w-2xl mx-auto">
                {[
                  { key: 'principles', label: 'Journalism Principles & Ethics' },
                  { key: 'leadership', label: 'Leadership & Mentorship' },
                  { key: 'engagement', label: 'Campus Engagement' },
                  { key: 'commitment', label: 'Growth Commitment' },
                  { key: 'communication', label: 'Communication Skills' }
                ].map(indicator => (
                  <div key={indicator.key} className="space-y-5">
                    <div className="flex justify-between items-end">
                      <label className="font-black text-slate-700 text-[11px] uppercase tracking-widest">{indicator.label}</label>
                      <div className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black tracking-widest uppercase">
                        {data.interview[indicator.key as keyof InterviewScores].toFixed(1)} / 1.0
                      </div>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.1" 
                      value={data.interview[indicator.key as keyof InterviewScores]}
                      onChange={e => setData({ ...data, interview: { ...data.interview, [indicator.key]: parseFloat(e.target.value) } })}
                      className="w-full h-2.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Mobile Footer */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-5 flex items-center justify-between shadow-2xl z-50 rounded-t-[2.5rem]">
        <div className="flex flex-col">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Grand Total</p>
          <p className="text-3xl font-black text-indigo-600 leading-none">{totals.grandTotal.toFixed(2)}</p>
        </div>
        <button 
          onClick={handleSubmit}
          className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-indigo-100"
        >
          {isSubmitting ? '...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default App;
